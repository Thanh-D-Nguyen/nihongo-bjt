import { createPrismaClient, type Prisma } from "@nihongo-bjt/database";
import { scheduleSrsReview, type SrsRating } from "@nihongo-bjt/shared";
import { randomBytes, randomUUID } from "node:crypto";
import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";

function parseAccessibilityMetadata(value: Prisma.JsonValue | null | undefined): {
  altText?: string;
  reducedMotionSafe?: boolean;
} {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return {};
  }
  const record = value as Record<string, unknown>;
  return {
    altText: typeof record.altText === "string" ? record.altText.trim() : undefined,
    reducedMotionSafe:
      typeof record.reducedMotionSafe === "boolean" ? record.reducedMotionSafe : undefined
  };
}

@Injectable()
export class FlashcardsRepository {
  private readonly logger = new Logger(FlashcardsRepository.name);
  private readonly prisma = createPrismaClient();

  decks(userId: string, limit: number) {
    return this.prisma.deck.findMany({
      include: { _count: { select: { cards: true } } },
      orderBy: { createdAt: "desc" },
      take: limit,
      where: {
        status: "active",
        OR: [{ ownerUserId: userId }, { visibility: "public" }]
      }
    });
  }

  /**
   * Learner removes their own deck from the active library.
   *
   * **Policy**
   * - Deck must be `status: active` and `ownerUserId` must match `userId` (otherwise 404 — no leak).
   * - Transaction: delete all `deck_card` rows for this deck; set deck `status` to `archived` (retain row for audits).
   * - **SRS**: For each card that was in the deck, if the learner has **no** remaining `deck_card` link to any
   *   **active** deck that is still visible to them (`ownerUserId = user` OR `visibility = public`), delete that
   *   learner's `user_flashcard` row. `review_event` rows cascade from `user_flashcard`.
   * - Other learners' `user_flashcard` rows are untouched. `flashcard_variant` rows may remain as shared content.
   */
  async archiveOwnedDeckForLearner(userId: string, deckId: string) {
    const deck = await this.prisma.deck.findFirst({
      where: { id: deckId, ownerUserId: userId, status: "active" }
    });
    if (!deck) {
      throw new NotFoundException({ code: "deck_not_found", message: "Deck not found" });
    }

    const result = await this.prisma.$transaction(async (tx) => {
      const links = await tx.deckCard.findMany({
        select: { cardId: true },
        where: { deckId }
      });
      const cardIds = [...new Set(links.map((l) => l.cardId))];

      const removedLinks = await tx.deckCard.deleteMany({ where: { deckId } });

      await tx.deck.update({
        data: { status: "archived" },
        where: { id: deckId }
      });

      // Batch query: find which cards still have links to other active decks
      const stillLinkedCards = await tx.deckCard.groupBy({
        by: ["cardId"],
        where: {
          cardId: { in: cardIds },
          deck: {
            status: "active",
            OR: [{ ownerUserId: userId }, { visibility: "public" }]
          }
        }
      });
      const stillLinkedCardIds = new Set(stillLinkedCards.map((r) => r.cardId));
      const orphanedCardIds = cardIds.filter((id) => !stillLinkedCardIds.has(id));

      let deletedUserFlashcardCount = 0;
      if (orphanedCardIds.length > 0) {
        const del = await tx.userFlashcard.deleteMany({
          where: { userId, cardId: { in: orphanedCardIds } }
        });
        deletedUserFlashcardCount = del.count;
      }

      return {
        deletedUserFlashcardCount,
        deckId,
        policy: "archive_owned_deck_prune_srs" as const,
        removedDeckCardCount: removedLinks.count,
        status: "archived" as const
      };
    });

    try {
      await this.prisma.analyticsEvent.create({
        data: {
          eventName: "learner_deck_archived",
          payload: {
            deckId,
            deletedUserFlashcardCount: result.deletedUserFlashcardCount,
            policy: "archive_owned_deck_prune_srs",
            removedDeckCardCount: result.removedDeckCardCount
          } as Prisma.InputJsonValue,
          source: "api",
          userId
        }
      });
    } catch (error: unknown) {
      this.logger.warn(
        `Failed to record analytics for deck archive deckId=${deckId}: ${error instanceof Error ? error.message : String(error)}`
      );
    }

    return result;
  }

  async deckDetail(userId: string, deckId: string) {
    const deck = await this.prisma.deck.findFirstOrThrow({
      include: {
        cards: {
          include: { card: { include: { mediaLinks: { include: { asset: true } } } } },
          orderBy: { position: "asc" }
        }
      },
      where: {
        id: deckId,
        status: "active",
        OR: [{ ownerUserId: userId }, { visibility: "public" }]
      }
    });

    const examplesByCardId = await this.examplesForDeckCards(
      deck.cards.map((row) => ({
        cardId: row.cardId,
        sourceId: row.card.sourceId,
        sourceType: row.card.sourceType
      }))
    );

    return {
      ...deck,
      cards: deck.cards.map((row) => ({
        ...row,
        card: {
          ...row.card,
          examples: examplesByCardId.get(row.cardId) ?? []
        }
      }))
    };
  }

  deckCards(userId: string, deckId: string, limit: number) {
    return this.prisma.deckCard.findMany({
      include: { card: { include: { mediaLinks: { include: { asset: true } } } } },
      orderBy: { position: "asc" },
      take: limit,
      where: {
        deckId,
        deck: {
          status: "active",
          OR: [{ ownerUserId: userId }, { visibility: "public" }]
        }
      }
    });
  }

  reviewSummary(userId: string) {
    const start = new Date();
    start.setHours(0, 0, 0, 0);
    return this.prisma.reviewEvent.groupBy({
      _count: { id: true },
      by: ["rating"],
      where: { reviewedAt: { gte: start }, userId }
    });
  }

  /** Get or create a default "Saved Vocabulary" deck for the user. */
  async getOrCreateDefaultDeck(userId: string): Promise<string> {
    const existing = await this.prisma.deck.findFirst({
      where: { ownerUserId: userId, titleVi: "Từ vựng đã lưu", status: "active" },
      select: { id: true }
    });
    if (existing) return existing.id;

    const deck = await this.prisma.deck.create({
      data: {
        ownerUserId: userId,
        titleVi: "Từ vựng đã lưu",
        titleJa: "保存した語彙",
        descriptionVi: "Thẻ được thêm từ từ điển và nội dung học",
        visibility: "private"
      }
    });
    return deck.id;
  }

  createDeck(input: {
    cards?: Array<{
      backText: string;
      frontText: string;
      imageUrl?: string;
      primaryImageAssetId?: string;
      reading?: string;
    }>;
    descriptionJa?: string;
    descriptionVi?: string;
    titleJa?: string;
    titleVi: string;
    userId: string;
    visibility?: "private" | "public";
  }) {
    const data = {
      descriptionJa: input.descriptionJa,
      descriptionVi: input.descriptionVi,
      ownerUserId: input.userId,
      titleJa: input.titleJa,
      titleVi: input.titleVi,
      visibility: input.visibility ?? "private"
    };

    if (!input.cards?.length) {
      return this.prisma.deck.create({ data });
    }

    return this.prisma.$transaction(async (tx) => {
      const deck = await tx.deck.create({ data });
      let position = 0;
      for (const row of input.cards!) {
        const card = await tx.flashcardVariant.create({
          data: {
            backText: row.backText,
            frontText: row.frontText,
            reading: row.reading,
            sourceId: randomUUID(),
            sourceType: "reading_assist"
          }
        });

        await tx.deckCard.create({
          data: {
            cardId: card.id,
            deckId: deck.id,
            position: position++
          }
        });

        await tx.userFlashcard.create({
          data: {
            cardId: card.id,
            userId: input.userId
          }
        });

        if (row.primaryImageAssetId) {
          const asset = await tx.mediaAsset.findFirst({
            where: {
              id: row.primaryImageAssetId,
              ownerUserId: input.userId,
              status: "active"
            }
          });
          if (!asset) {
            throw new BadRequestException("Card image asset not found or not owned by user");
          }
          await tx.cardMediaLink.create({
            data: {
              assetId: asset.id,
              cardId: card.id,
              role: "primary_image"
            }
          });
        } else if (row.imageUrl) {
          const asset = await tx.mediaAsset.create({
            data: {
              accessibility: {
                altText: row.frontText.slice(0, 200),
                reducedMotionSafe: true
              },
              byteSize: 1,
              license: "user_supplied_link",
              mimeType: "image/jpeg",
              objectKey: `learning/external-ref/${randomUUID()}`,
              ownerUserId: input.userId,
              provenance: { kind: "flashcard_bulk_import_url" },
              provider: "external_url",
              rightsStatus: "cleared",
              sourceUrl: row.imageUrl,
              status: "active"
            }
          });

          await tx.cardMediaLink.create({
            data: {
              assetId: asset.id,
              cardId: card.id,
              role: "primary_image"
            }
          });
        }
      }

      return deck;
    });
  }

  async updateOwnedDeckForLearner(
    userId: string,
    deckId: string,
    input: {
      cards?: Array<{
        backText: string;
        cardId?: string;
        deckCardId?: string;
        frontText: string;
        imageUrl?: string;
        primaryImageAssetId?: string;
        reading?: string;
      }>;
      descriptionJa?: string;
      descriptionVi?: string;
      titleJa?: string;
      titleVi: string;
      visibility?: "private" | "public";
    }
  ) {
    const deck = await this.prisma.deck.findFirst({
      where: { id: deckId, ownerUserId: userId, status: "active" }
    });
    if (!deck) {
      throw new NotFoundException({ code: "deck_not_found", message: "Deck not found" });
    }

    return this.prisma.$transaction(async (tx) => {
      const existingLinks = await tx.deckCard.findMany({
        include: { card: true },
        orderBy: { position: "asc" },
        where: { deckId }
      });
      const existingByDeckCardId = new Map(existingLinks.map((link) => [link.id, link]));
      const existingByCardId = new Map(existingLinks.map((link) => [link.cardId, link]));

      await tx.deck.update({
        data: {
          descriptionJa: input.descriptionJa,
          descriptionVi: input.descriptionVi,
          titleJa: input.titleJa,
          titleVi: input.titleVi,
          visibility: input.visibility ?? "private"
        },
        where: { id: deckId }
      });

      if (!input.cards) {
        return {
          cardCount: existingLinks.length,
          deckId,
          status: "updated" as const
        };
      }

      const nextCardIds: string[] = [];
      const removedCardIds = existingLinks.map((link) => link.cardId);
      await tx.deckCard.deleteMany({ where: { deckId } });

      for (const [position, row] of input.cards.entries()) {
        const existing =
          (row.deckCardId ? existingByDeckCardId.get(row.deckCardId) : undefined) ??
          (row.cardId ? existingByCardId.get(row.cardId) : undefined);
        const card =
          existing?.cardId
            ? await tx.flashcardVariant.update({
                data: {
                  backText: row.backText,
                  frontText: row.frontText,
                  reading: row.reading
                },
                where: { id: existing.cardId }
              })
            : await tx.flashcardVariant.create({
                data: {
                  backText: row.backText,
                  frontText: row.frontText,
                  reading: row.reading,
                  sourceId: randomUUID(),
                  sourceType: "reading_assist"
                }
              });

        nextCardIds.push(card.id);
        await tx.deckCard.create({
          data: {
            cardId: card.id,
            deckId,
            position
          }
        });

        await tx.userFlashcard.upsert({
          create: {
            cardId: card.id,
            userId
          },
          update: {},
          where: {
            userId_cardId: {
              cardId: card.id,
              userId
            }
          }
        });

        await tx.cardMediaLink.deleteMany({
          where: {
            cardId: card.id,
            role: "primary_image"
          }
        });

        if (row.primaryImageAssetId) {
          const asset = await tx.mediaAsset.findFirst({
            where: {
              id: row.primaryImageAssetId,
              ownerUserId: userId,
              status: "active"
            }
          });
          if (!asset) {
            throw new BadRequestException("Card image asset not found or not owned by user");
          }
          await tx.cardMediaLink.create({
            data: {
              assetId: asset.id,
              cardId: card.id,
              role: "primary_image"
            }
          });
        } else if (row.imageUrl) {
          const asset = await tx.mediaAsset.create({
            data: {
              accessibility: {
                altText: row.frontText.slice(0, 200),
                reducedMotionSafe: true
              },
              byteSize: 1,
              license: "user_supplied_link",
              mimeType: "image/jpeg",
              objectKey: `learning/external-ref/${randomUUID()}`,
              ownerUserId: userId,
              provenance: { kind: "flashcard_edit_url" },
              provider: "external_url",
              rightsStatus: "cleared",
              sourceUrl: row.imageUrl,
              status: "active"
            }
          });
          await tx.cardMediaLink.create({
            data: {
              assetId: asset.id,
              cardId: card.id,
              role: "primary_image"
            }
          });
        }
      }

      const nextCardIdSet = new Set(nextCardIds);
      const removed = removedCardIds.filter((cardId) => !nextCardIdSet.has(cardId));
      if (removed.length > 0) {
        const stillLinkedCards = await tx.deckCard.groupBy({
          by: ["cardId"],
          where: {
            cardId: { in: removed },
            deck: {
              status: "active",
              OR: [{ ownerUserId: userId }, { visibility: "public" }]
            }
          }
        });
        const stillLinked = new Set(stillLinkedCards.map((row) => row.cardId));
        const orphaned = removed.filter((cardId) => !stillLinked.has(cardId));
        if (orphaned.length > 0) {
          await tx.userFlashcard.deleteMany({
            where: { cardId: { in: orphaned }, userId }
          });
        }
      }

      return {
        cardCount: nextCardIds.length,
        deckId,
        status: "updated" as const
      };
    });
  }

  async createCardFromContent(input: {
    backText: string;
    deckId: string;
    frontText: string;
    reading?: string;
    sourceId: string;
    sourceType: "lexeme" | "kanji" | "grammar";
    userId: string;
  }) {
    const deck = await this.prisma.deck.findFirst({
      where: {
        id: input.deckId,
        ownerUserId: input.userId,
        status: "active"
      }
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
    }

    return this.prisma.$transaction(async (tx) => {
      const position = await tx.deckCard.count({ where: { deckId: input.deckId } });
      const card = await tx.flashcardVariant.create({
        data: {
          backText: input.backText,
          frontText: input.frontText,
          reading: input.reading,
          sourceId: input.sourceId,
          sourceType: input.sourceType
        }
      });

      await tx.deckCard.create({
        data: {
          cardId: card.id,
          deckId: input.deckId,
          position
        }
      });

      await tx.userFlashcard.create({
        data: {
          cardId: card.id,
          userId: input.userId
        }
      });

      return card;
    });
  }

  async createCardFromReadingAssist(input: {
    backText: string;
    deckId: string;
    frontText: string;
    reading?: string;
    userId: string;
  }) {
    const deck = await this.prisma.deck.findFirst({
      where: {
        id: input.deckId,
        ownerUserId: input.userId,
        status: "active"
      }
    });

    if (!deck) {
      throw new NotFoundException("Deck not found");
    }

    return this.prisma.$transaction(async (tx) => {
      const position = await tx.deckCard.count({ where: { deckId: input.deckId } });
      const card = await tx.flashcardVariant.create({
        data: {
          backText: input.backText,
          frontText: input.frontText,
          reading: input.reading,
          sourceId: randomUUID(),
          sourceType: "reading_assist"
        }
      });

      await tx.deckCard.create({
        data: {
          cardId: card.id,
          deckId: input.deckId,
          position
        }
      });

      await tx.userFlashcard.create({
        data: {
          cardId: card.id,
          userId: input.userId
        }
      });

      return card;
    });
  }

  dueReviews(userId: string, limit: number, deckId?: string) {
    const deckScope =
      deckId !== undefined && deckId.length > 0
        ? {
            card: {
              deckLinks: {
                some: {
                  deckId,
                  deck: {
                    OR: [{ ownerUserId: userId }, { visibility: "public" }],
                    status: "active"
                  }
                }
              }
            }
          }
        : {};

    return this.prisma.userFlashcard.findMany({
      include: { card: { include: { mediaLinks: { include: { asset: true } } } } },
      orderBy: { dueAt: "asc" },
      take: limit,
      where: {
        dueAt: { lte: new Date() },
        state: { in: ["new", "learning", "review", "lapsed"] },
        userId,
        ...deckScope
      }
    });
  }

  /** Count due SRS items (same predicate as `dueReviews`) for companion / dashboards. */
  countDueForLearner(userId: string, deckId?: string) {
    const deckScope =
      deckId !== undefined && deckId.length > 0
        ? {
            card: {
              deckLinks: {
                some: {
                  deckId,
                  deck: {
                    OR: [{ ownerUserId: userId }, { visibility: "public" }],
                    status: "active"
                  }
                }
              }
            }
          }
        : {};

    return this.prisma.userFlashcard.count({
      where: {
        dueAt: { lte: new Date() },
        state: { in: ["new", "learning", "review", "lapsed"] },
        userId,
        ...deckScope
      }
    });
  }

  async comebackSummary(userId: string, days: number) {
    const now = new Date();
    const since = new Date(now.getTime() - days * 24 * 60 * 60 * 1000);

    const [activeComebackCards, dueComebackCards, leechedCards, recentComebackReviews] =
      await Promise.all([
        this.prisma.userFlashcard.count({
          where: {
            comebackMode: true,
            userId
          }
        }),
        this.prisma.userFlashcard.count({
          where: {
            comebackMode: true,
            dueAt: { lte: now },
            state: { in: ["new", "learning", "review", "lapsed"] },
            userId
          }
        }),
        this.prisma.userFlashcard.count({
          where: {
            leeched: true,
            userId
          }
        }),
        this.prisma.reviewEvent.findMany({
          include: {
            userFlashcard: {
              include: {
                card: {
                  select: {
                    frontText: true,
                    id: true,
                    sourceType: true
                  }
                }
              }
            }
          },
          orderBy: { reviewedAt: "desc" },
          take: 5,
          where: {
            reviewedAt: { gte: since },
            userId,
            userFlashcard: {
              comebackMode: true
            }
          }
        })
      ]);

    return {
      activeComebackCards,
      dueComebackCards,
      leechedCards,
      range: {
        days,
        since,
        until: now
      },
      recentComebackReviews: recentComebackReviews.map((event) => ({
        cardId: event.userFlashcard.cardId,
        cardPreview: event.userFlashcard.card.frontText,
        nextDueAt: event.nextDueAt,
        rating: event.rating,
        reviewedAt: event.reviewedAt,
        sourceType: event.userFlashcard.card.sourceType,
        userFlashcardId: event.userFlashcardId
      }))
    };
  }

  /**
   * Writes the next SRS state + append-only `review_event`. Must run **inside** the caller's transaction
   * after quota consumption so `usage_counter` and card state stay aligned.
   *
   * **Leech detection:**
   * - When lapses >= 8, card is marked as leeched
   * - API response includes `leechDetected` flag for UI feedback
   */
  async applySubmitReview(
    tx: Prisma.TransactionClient,
    input: {
      elapsedMs?: number;
      rating: SrsRating;
      reviewedAt: Date;
      userFlashcardId: string;
      userId: string;
    }
  ) {
    const current = await tx.userFlashcard.findFirst({
      include: {
        card: {
          select: {
            sourceId: true,
            sourceType: true
          }
        }
      },
      where: { id: input.userFlashcardId, userId: input.userId }
    });

    if (!current) {
      throw new NotFoundException("User flashcard not found");
    }

    const next = scheduleSrsReview(
      {
        dueAt: current.dueAt,
        easeFactor: current.easeFactor,
        intervalDays: current.intervalDays,
        lapses: current.lapses,
        repetitions: current.repetitions,
        state: current.state as "new" | "learning" | "review" | "lapsed",
        leeched: current.leeched ?? false,
        comebackMode: current.comebackMode ?? false
      },
      input.rating,
      input.reviewedAt,
      current.comebackMode ?? false
    );

    // Detect if card just became leeched
    const leechDetected = !current.leeched && next.leeched;

    const updated = await tx.userFlashcard.update({
      data: {
        dueAt: next.dueAt,
        easeFactor: next.easeFactor,
        intervalDays: next.intervalDays,
        lapses: next.lapses,
        repetitions: next.repetitions,
        state: next.state,
        leeched: next.leeched,
        comebackMode: next.comebackMode
      },
      where: { id: current.id }
    });

    const reviewEvent = await tx.reviewEvent.create({
      data: {
        elapsedMs: input.elapsedMs,
        nextDueAt: next.dueAt,
        previousDueAt: current.dueAt,
        rating: input.rating,
        reviewedAt: input.reviewedAt,
        userFlashcardId: current.id,
        userId: input.userId
      }
    });

    const sourceIdKind = current.card.sourceType === "reading_assist" ? "opaque_ref" : "canonical_id";

    return {
      cardId: updated.cardId,
      dueAt: updated.dueAt,
      easeFactor: updated.easeFactor,
      intervalDays: updated.intervalDays,
      lapses: updated.lapses,
      leechDetected,
      leeched: updated.leeched,
      comebackMode: updated.comebackMode,
      nextDueAt: reviewEvent.nextDueAt,
      previousDueAt: reviewEvent.previousDueAt,
      rating: reviewEvent.rating,
      remediation: {
        sourceId: current.card.sourceId,
        sourceIdKind,
        sourceType: current.card.sourceType
      },
      remediationPolicy: {
        availability: "after_answer" as const,
        note: "Remediation metadata is returned only after a review answer is submitted."
      },
      repetitions: updated.repetitions,
      reviewEventId: reviewEvent.id,
      reviewedAt: reviewEvent.reviewedAt,
      state: updated.state,
      userFlashcardId: updated.id
    };
  }

  /**
   * Return up to `n` distractor backText strings for MatchReview quiz.
   * Pulled from active FlashcardVariant rows with the same sourceType, excluding the source card
   * and any rows whose backText equals the correct answer (dedup).
   */
  async distractorsForCard(userFlashcardId: string, userId: string, n: number): Promise<string[]> {
    const owned = await this.prisma.userFlashcard.findFirst({
      include: { card: { select: { backText: true, id: true, sourceType: true } } },
      where: { id: userFlashcardId, userId }
    });
    if (!owned) {
      throw new NotFoundException("User flashcard not found");
    }
    const correct = owned.card.backText;
    const correctLen = correct.length;

    // Fetch a pool from same sourceType (richer signal for "similar" distractors)
    const pool = await this.prisma.flashcardVariant.findMany({
      select: { backText: true },
      take: 300,
      where: {
        id: { not: owned.card.id },
        sourceType: owned.card.sourceType,
        status: "active",
        backText: { not: correct }
      }
    });

    // Dedup + filter empties
    const unique = Array.from(
      new Set(pool.map((p) => p.backText).filter((s): s is string => typeof s === "string" && s.trim().length > 0))
    );

    // Prefer similar-length distractors (within ±60% length) to avoid trivial guessing,
    // but fall back to any if too few candidates qualify.
    const close = unique.filter((s) => Math.abs(s.length - correctLen) <= Math.max(2, correctLen * 0.6));
    const candidates = close.length >= n ? close : unique;

    // Fisher–Yates shuffle, then slice
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    return candidates.slice(0, n);
  }

  async linkCardToMedia(input: { assetId: string; cardId: string; role: string; userId: string }) {
    const owned = await this.prisma.userFlashcard.findFirst({
      where: { cardId: input.cardId, userId: input.userId }
    });
    if (!owned) {
      throw new NotFoundException("Flashcard not found for user");
    }

    const asset = await this.prisma.mediaAsset.findFirst({
      where: { id: input.assetId, ownerUserId: input.userId, status: "active" }
    });
    if (!asset) {
      throw new NotFoundException("Media asset not found");
    }

    if (asset.byteSize === null || asset.byteSize < 1) {
      throw new BadRequestException(
        "Call POST /api/media/complete-upload after uploading to the presigned URL, then link the card"
      );
    }

    const hasRequiredRightsMetadata = asset.license?.trim().length && (asset.provider === "local" || asset.sourceUrl);
    if (!hasRequiredRightsMetadata || asset.rightsStatus !== "cleared") {
      throw new BadRequestException(
        "Call POST /api/media/assets/:assetId/rights-metadata and provide required provenance/license metadata before linking the card"
      );
    }

    const accessibility = parseAccessibilityMetadata(asset.accessibility);
    if (!accessibility.altText) {
      throw new BadRequestException(
        "Media accessibility metadata missing: accessibility.altText must be set before linking the card"
      );
    }
    if (asset.mimeType === "image/gif" && accessibility.reducedMotionSafe !== true) {
      throw new BadRequestException(
        "Animated GIF media must set accessibility.reducedMotionSafe before linking the card"
      );
    }

    return this.prisma.$transaction(async (tx) => {
      const exact = await tx.cardMediaLink.findFirst({
        where: { assetId: input.assetId, cardId: input.cardId, role: input.role }
      });
      if (exact) {
        return tx.cardMediaLink.findFirstOrThrow({
          include: { asset: true },
          where: { id: exact.id }
        });
      }

      if (input.role === "primary_image") {
        await tx.cardMediaLink.deleteMany({
          where: { cardId: input.cardId, role: "primary_image" }
        });
      }

      const link = await tx.cardMediaLink.create({
        data: { assetId: input.assetId, cardId: input.cardId, role: input.role },
        include: { asset: true }
      });

      await tx.analyticsEvent.create({
        data: {
          eventName: "flashcard_image_linked",
          payload: {
            assetId: input.assetId,
            cardId: input.cardId,
            role: input.role
          } as Prisma.InputJsonValue,
          source: "api",
          userId: input.userId
        }
      });

      return link;
    });
  }

  private async examplesForDeckCards(
    cards: Array<{ cardId: string; sourceId: string; sourceType: string }>
  ): Promise<Map<string, FlashcardExample[]>> {
    type CanonicalCard = { cardId: string; sourceId: string; sourceType: "grammar" | "kanji" | "lexeme" };
    const byCardId = new Map<string, FlashcardExample[]>();
    const fallbackCards = cards.filter((card) => !["lexeme", "grammar", "kanji"].includes(card.sourceType));
    const fallbackRows = fallbackCards.length
      ? await this.prisma.flashcardVariant.findMany({
          select: { frontText: true, id: true },
          where: { id: { in: fallbackCards.map((card) => card.cardId) } }
        })
      : [];
    const fallbackByCardId = new Map(fallbackRows.map((row) => [row.id, row.frontText]));
    const fallbackTargets = await Promise.all(
      fallbackCards.map(async (card) => {
        const target = await this.resolveFallbackCanonicalSource(card.sourceType, fallbackByCardId.get(card.cardId) ?? "");
        return target ? { ...card, sourceId: target.sourceId, sourceType: target.sourceType } : null;
      })
    );
    const canonicalCards: CanonicalCard[] = cards
      .filter((card) => ["lexeme", "grammar", "kanji"].includes(card.sourceType))
      .map((card) => ({
        cardId: card.cardId,
        sourceId: card.sourceId,
        sourceType: card.sourceType as "grammar" | "kanji" | "lexeme"
      }));
    const effectiveCards: CanonicalCard[] = [
      ...canonicalCards,
      ...fallbackTargets.filter((card): card is CanonicalCard => card != null)
    ];
    const lexemeCards = effectiveCards.filter((card) => card.sourceType === "lexeme");
    const grammarCards = effectiveCards.filter((card) => card.sourceType === "grammar");
    const kanjiCards = effectiveCards.filter((card) => card.sourceType === "kanji");
    const lexemeSourceToCards = groupCardIdsBySource(lexemeCards);
    const grammarSourceToCards = groupCardIdsBySource(grammarCards);
    const kanjiSourceToCards = groupCardIdsBySource(kanjiCards);

    await Promise.all([
      (async () => {
        if (lexemeCards.length === 0) return;
        const rows = await this.prisma.exampleSentence.findMany({
          include: {
            lexemeSenseExamples: {
              select: { sense: { select: { lexemeId: true } } },
              where: { sense: { lexemeId: { in: [...lexemeSourceToCards.keys()] } } }
            }
          },
          orderBy: { japaneseText: "asc" },
          where: {
            status: "active",
            lexemeSenseExamples: { some: { sense: { lexemeId: { in: [...lexemeSourceToCards.keys()] } } } }
          }
        });
        for (const row of rows) {
          for (const link of row.lexemeSenseExamples) {
            for (const cardId of lexemeSourceToCards.get(link.sense.lexemeId) ?? []) {
              appendExample(byCardId, cardId, {
                id: row.id,
                japaneseText: row.japaneseText,
                reading: row.reading,
                sourceKind: "lexeme",
                translationVi: row.translationVi
              });
            }
          }
        }
      })(),
      (async () => {
        if (grammarCards.length === 0) return;
        const rows = await this.prisma.exampleSentence.findMany({
          include: {
            grammarDetailExamples: {
              select: { detail: { select: { grammarPointId: true } } },
              where: { detail: { grammarPointId: { in: [...grammarSourceToCards.keys()] } } }
            }
          },
          orderBy: { japaneseText: "asc" },
          where: {
            status: "active",
            grammarDetailExamples: { some: { detail: { grammarPointId: { in: [...grammarSourceToCards.keys()] } } } }
          }
        });
        for (const row of rows) {
          for (const link of row.grammarDetailExamples) {
            for (const cardId of grammarSourceToCards.get(link.detail.grammarPointId) ?? []) {
              appendExample(byCardId, cardId, {
                id: row.id,
                japaneseText: row.japaneseText,
                reading: row.reading,
                sourceKind: "grammar",
                translationVi: row.translationVi
              });
            }
          }
        }
      })(),
      (async () => {
        if (kanjiCards.length === 0) return;
        const rows = await this.prisma.kanjiExample.findMany({
          orderBy: { position: "asc" },
          where: { kanjiId: { in: [...kanjiSourceToCards.keys()] } }
        });
        for (const row of rows) {
          for (const cardId of kanjiSourceToCards.get(row.kanjiId) ?? []) {
            appendExample(byCardId, cardId, {
              id: row.id,
              japaneseText: row.word,
              reading: row.reading,
              sourceKind: "kanji",
              translationVi: row.meaningVi
            });
          }
        }
      })()
    ]);

    for (const [cardId, examples] of byCardId) {
      byCardId.set(cardId, dedupeExamples(examples).slice(0, 8));
    }
    return byCardId;
  }

  private async resolveFallbackCanonicalSource(
    sourceType: string,
    frontText: string
  ): Promise<{ sourceId: string; sourceType: "grammar" | "kanji" | "lexeme" } | null> {
    const q = frontText.trim();
    if (!q) return null;

    if (sourceType.includes("grammar")) {
      const candidates = grammarPatternCandidates(q);
      const grammar = await this.prisma.grammarPoint.findFirst({
        select: { id: true },
        where: {
          status: "active",
          OR: candidates.map((pattern) => ({ pattern }))
        }
      });
      if (grammar) return { sourceId: grammar.id, sourceType: "grammar" };
    }

    if (sourceType.includes("kanji") || q.length === 1) {
      const kanji = await this.prisma.kanji.findFirst({
        select: { id: true },
        where: { character: q, status: "active" }
      });
      if (kanji) return { sourceId: kanji.id, sourceType: "kanji" };
    }

    const lexeme = await this.prisma.lexeme.findFirst({
      select: { id: true },
      where: {
        status: "active",
        OR: [{ headword: q }, { reading: q }]
      }
    });
    if (lexeme) return { sourceId: lexeme.id, sourceType: "lexeme" };

    return null;
  }

  // ─── Deck Sharing ────────────────────────────────────────────

  async findDeckByShareToken(token: string) {
    return this.prisma.deck.findFirst({
      where: { shareToken: token, status: "active" },
      include: { _count: { select: { cards: true } } },
    });
  }

  async generateShareToken(userId: string, deckId: string) {
    const deck = await this.prisma.deck.findFirst({
      where: { id: deckId, ownerUserId: userId, status: "active" },
    });
    if (!deck) throw new NotFoundException({ code: "deck_not_found", message: "Deck not found" });

    const token = randomBytes(18).toString("base64url");
    await this.prisma.deck.update({
      where: { id: deckId },
      data: { shareToken: token, visibility: "public" },
    });
    return { shareToken: token };
  }

  async revokeShareToken(userId: string, deckId: string) {
    const deck = await this.prisma.deck.findFirst({
      where: { id: deckId, ownerUserId: userId, status: "active" },
    });
    if (!deck) throw new NotFoundException({ code: "deck_not_found", message: "Deck not found" });

    await this.prisma.deck.update({
      where: { id: deckId },
      data: { shareToken: null, visibility: "private" },
    });
    return { status: "revoked" as const };
  }

  async publicDeckPreview(token: string) {
    const deck = await this.prisma.deck.findFirst({
      where: { shareToken: token, status: "active" },
      include: {
        cards: {
          include: { card: true },
          orderBy: { position: "asc" },
          take: 5,
        },
        _count: { select: { cards: true } },
      },
    });
    if (!deck) throw new NotFoundException({ code: "deck_not_found", message: "Shared deck not found" });

    return {
      id: deck.id,
      titleVi: deck.titleVi,
      titleJa: deck.titleJa,
      descriptionVi: deck.descriptionVi,
      descriptionJa: deck.descriptionJa,
      cardCount: deck._count.cards,
      cloneCount: deck.cloneCount,
      sampleCards: deck.cards.map((dc) => ({
        frontText: dc.card.frontText,
        reading: dc.card.reading,
      })),
    };
  }

  async cloneDeck(token: string, targetUserId: string) {
    const source = await this.prisma.deck.findFirst({
      where: { shareToken: token, status: "active" },
      include: {
        cards: {
          include: { card: true },
          orderBy: { position: "asc" },
        },
      },
    });
    if (!source) throw new NotFoundException({ code: "deck_not_found", message: "Shared deck not found" });

    return this.prisma.$transaction(async (tx) => {
      const cloned = await tx.deck.create({
        data: {
          ownerUserId: targetUserId,
          titleVi: source.titleVi,
          titleJa: source.titleJa,
          descriptionVi: source.descriptionVi,
          descriptionJa: source.descriptionJa,
          visibility: "private",
          sourceDeckId: source.id,
        },
      });

      for (const dc of source.cards) {
        const newCard = await tx.flashcardVariant.create({
          data: {
            sourceType: dc.card.sourceType,
            sourceId: dc.card.sourceId,
            frontText: dc.card.frontText,
            backText: dc.card.backText,
            reading: dc.card.reading,
          },
        });
        await tx.deckCard.create({
          data: {
            deckId: cloned.id,
            cardId: newCard.id,
            position: dc.position,
          },
        });
      }

      await tx.deck.update({
        where: { id: source.id },
        data: { cloneCount: { increment: 1 } },
      });

      return { newDeckId: cloned.id, cardCount: source.cards.length };
    });
  }
}

type FlashcardExample = {
  id: string;
  japaneseText: string;
  reading: string | null;
  sourceKind: "grammar" | "kanji" | "lexeme";
  translationVi: string | null;
};

function groupCardIdsBySource(cards: Array<{ cardId: string; sourceId: string }>) {
  const grouped = new Map<string, string[]>();
  for (const card of cards) {
    grouped.set(card.sourceId, [...(grouped.get(card.sourceId) ?? []), card.cardId]);
  }
  return grouped;
}

function appendExample(map: Map<string, FlashcardExample[]>, cardId: string, example: FlashcardExample) {
  map.set(cardId, [...(map.get(cardId) ?? []), example]);
}

function dedupeExamples(examples: FlashcardExample[]) {
  const seen = new Set<string>();
  return examples.filter((example) => {
    if (seen.has(example.id)) return false;
    seen.add(example.id);
    return true;
  });
}

function grammarPatternCandidates(value: string) {
  const trimmed = value.trim();
  const withoutWave = trimmed.replace(/^[〜~]/u, "");
  return [...new Set([trimmed, withoutWave, `〜${withoutWave}`, `~${withoutWave}`])];
}
