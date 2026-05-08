"use client";

import type { BookmarkTargetType, SearchResult } from "@nihongo-bjt/shared";
import { cn } from "@nihongo-bjt/ui";
import Link from "next/link";

import { KanjiStrokeAnimation } from "./kanji-stroke-animation";
import type { KanjiDetailDto } from "./kanji-detail-dto";
import { LexemeKanjiStrokeStrip } from "./lexeme-kanji-stroke-strip";
import { SearchBookmarkToggle, SearchReadAloudButton } from "./search-detail-learner-actions";
import { HighlightMatch } from "./search-highlight";
import { hasRenderablePitch, PitchAccentDisplay } from "./pitch-accent-display";

export interface SearchDetailLabels {
  addToFlashcard: string;
  bjtCtaBattle: string;
  bjtCtaFlashcards: string;
  bjtCtaQuiz: string;
  bjtPhrasesLabel: string;
  bjtPhrasesBody: string;
  bjtSectionIntro: string;
  bjtSectionTitle: string;
  bjtTopicsBody: string;
  bjtTopicsLabel: string;
  closeSheet: string;
  detailAudioUnavailable: string;
  detailEmpty: string;
  detailError: string;
  detailExamplesLabel: string;
  detailGrammarPattern: string;
  detailKanjiReadings: string;
  detailKanjiStroke: string;
  detailKanjiStrokeAttributionTpl: string;
  detailKanjiStrokeErrorForbidden: string;
  detailKanjiStrokeErrorInvalidSvg: string;
  detailKanjiStrokeErrorNetwork: string;
  detailKanjiStrokeErrorNotFound: string;
  detailKanjiStrokeErrorUpstream: string;
  detailKanjiStrokeLoadError: string;
  detailKanjiStrokeLoading: string;
  detailKanjiStrokeNoDiagram: string;
  detailKanjiStrokeOrderTitle: string;
  detailKanjiStrokeReplay: string;
  detailLoading: string;
  detailMeaningsLabel: string;
  detailMobileHint: string;
  detailPartOfSpeech: string;
  detailPitchLabel: string;
  detailPitchLegend: string;
  detailPitchReadingTitle: string;
  detailPitchVariantLabel: string;
  detailPreviewHint: string;
  detailProductBadge: string;
  detailRomajiSoon: string;
  detailSense: string;
  detailActionsFootnote: string;
  detailBookmarkAdd: string;
  detailBookmarkBusy: string;
  detailBookmarkError: string;
  detailBookmarkRemove: string;
  detailBookmarkRetry: string;
  detailBookmarkSignIn: string;
  detailReadAloud: string;
  detailReadAloudSentence: string;
  detailReadAloudStop: string;
  /** Link to learner saved / bookmarks list */
  detailSavedListLink: string;
  /** aria-label for bookmark + read-aloud control group in detail header */
  detailLearnerToolsRegionLabel: string;
  kanjiComponentsLabel: string;
  kanjiComponentsNone: string;
  lovableProductTag: string;
}

export type DetailPayload =
  | { kind: "lexeme"; data: LexemeDetailDto }
  | { kind: "kanji"; data: KanjiDetailDto }
  | { kind: "grammar"; data: GrammarDetailDto }
  | { kind: "example"; data: null };

/** Minimal DTOs aligned with Prisma JSON over HTTP */
export interface LexemeDetailDto {
  headword: string;
  id: string;
  jlptLevel: string | null;
  kanjiMeaningVi: string | null;
  pronunciation: unknown;
  reading: string | null;
  senses: Array<{
    exampleLinks: Array<{ exampleSentence: ExampleDto | null }>;
    meaningVi: string;
    partOfSpeech: string | null;
    position: number;
  }>;
  shortMeaningVi: string | null;
}

interface ExampleDto {
  id: string;
  japaneseText: string;
  reading: string | null;
  translationVi: string | null;
}

export type { KanjiDetailDto } from "./kanji-detail-dto";
export { normalizeKanjiDetailDto } from "./kanji-detail-dto";

export interface GrammarDetailDto {
  details?: Array<{ explanation: string; position?: number }>;
  id: string;
  jlptLevel: string | null;
  meaningVi: string;
  pattern: string;
}

function extractKanjiFromHeadword(headword: string): string[] {
  return [...headword].filter((ch) => /\p{Script=Han}/u.test(ch));
}

function bookmarkTargetForSearchResult(kind: SearchResult["kind"]): BookmarkTargetType | null {
  if (kind === "example") return null;
  return kind;
}

function collectPhraseSamples(dto: LexemeDetailDto, max = 4): string[] {
  const out: string[] = [];
  for (const sense of dto.senses) {
    for (const link of sense.exampleLinks) {
      const ex = link.exampleSentence;
      if (ex?.japaneseText && !out.includes(ex.japaneseText)) {
        out.push(ex.japaneseText);
        if (out.length >= max) return out;
      }
    }
  }
  return out;
}

export function SearchDetailPanel({
  detail,
  detailError,
  detailLoading,
  labels,
  locale,
  query,
  result,
  userId,
  variant
}: {
  detail: DetailPayload | null;
  detailError: boolean;
  detailLoading: boolean;
  labels: SearchDetailLabels;
  locale: string;
  query: string;
  result: SearchResult | null;
  userId: string | null;
  variant: "desktop" | "sheet";
}) {
  if (!result) {
    return (
      <div
        className={cn(
          "flex flex-col items-center justify-center rounded-2xl border border-ink/10 bg-surface p-8 text-center",
          variant === "sheet" && "min-h-[40vh]"
        )}
      >
        <p className="text-sm text-muted">{labels.detailEmpty}</p>
      </div>
    );
  }

  const bookmarkKind = bookmarkTargetForSearchResult(result.kind);
  const showReadToolbar = Boolean(bookmarkKind || (result.kind === "example" && result.title.trim()));

  return (
    <div
      className={cn(
        "flex flex-col overflow-hidden rounded-2xl border border-ink/10 bg-surface shadow-sm",
        variant === "desktop" && "sticky top-24 max-h-[calc(100vh-6rem)]",
        variant === "sheet" && "max-h-[85vh]"
      )}
    >
      <div className="shrink-0 border-b border-ink/8 bg-paper/80 px-4 py-3">
        <p className="text-[10px] font-bold uppercase tracking-wide text-muted">{labels.lovableProductTag}</p>
        <div className="mt-1 flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-3">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-baseline gap-2">
              <span className="jp-text text-2xl font-bold text-ink">
                <HighlightMatch query={query} text={result.title} />
              </span>
              {result.reading ? (
                <span className="jp-text text-base text-muted">
                  <HighlightMatch query={query} text={result.reading} />
                </span>
              ) : null}
            </div>
            <div className="mt-1 flex flex-wrap gap-2 text-[11px] font-semibold text-muted">
              {result.jlptLevel ? <span>{result.jlptLevel}</span> : null}
              <span className="rounded-md bg-ink/5 px-1.5 py-0.5 text-ink/80">{labels.detailProductBadge}</span>
            </div>
          </div>
          {showReadToolbar ? (
            <div
              aria-label={labels.detailLearnerToolsRegionLabel}
              className="flex shrink-0 flex-col gap-1 self-start sm:self-start sm:pt-0.5"
              role="group"
            >
              <div className="inline-flex items-center gap-1 rounded-xl border border-ink/8 bg-surface/95 p-1 shadow-sm">
                {bookmarkKind ? (
                  <SearchBookmarkToggle
                    labels={{
                      add: labels.detailBookmarkAdd,
                      busy: labels.detailBookmarkBusy,
                      error: labels.detailBookmarkError,
                      remove: labels.detailBookmarkRemove,
                      retry: labels.detailBookmarkRetry,
                      signIn: labels.detailBookmarkSignIn
                    }}
                    targetId={result.id}
                    targetType={bookmarkKind}
                    userId={userId}
                  />
                ) : null}
                <SearchReadAloudButton
                  className={cn(!bookmarkKind && "min-w-0")}
                  labels={{
                    read: labels.detailReadAloud,
                    readSentence: labels.detailReadAloudSentence,
                    stop: labels.detailReadAloudStop
                  }}
                  showTtsNotice={false}
                  text={result.title}
                />
              </div>
            </div>
          ) : null}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 py-4">
        {detailLoading ? (
          <p className="text-sm text-muted" role="status">
            {labels.detailLoading}
          </p>
        ) : null}
        {detailError ? (
          <p className="text-sm text-sakura" role="alert">
            {labels.detailError}
          </p>
        ) : null}

        {!detailLoading && !detailError && result.kind === "example" ? (
          <p className="text-sm leading-relaxed text-ink/80">{labels.detailPreviewHint}</p>
        ) : null}

        {!detailLoading && !detailError && detail?.kind === "lexeme" ? (
          <LexemeDetailBody
            dto={detail.data}
            labels={labels}
            locale={locale}
            query={query}
            result={result}
          />
        ) : null}

        {!detailLoading && !detailError && detail?.kind === "kanji" ? (
          <KanjiDetailBody dto={detail.data} labels={labels} locale={locale} />
        ) : null}

        {!detailLoading && !detailError && detail?.kind === "grammar" ? (
          <GrammarDetailBody dto={detail.data} labels={labels} />
        ) : null}

        {!detailLoading && !detailError && result.description && (result.kind === "example" || !detail) ? (
          <section className="mt-2">
            <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{labels.detailMeaningsLabel}</h3>
            <p className="mt-2 text-sm leading-relaxed text-ink/80">
              <HighlightMatch query={query} text={result.description} />
            </p>
          </section>
        ) : null}

        <DetailActions headword={result.title} labels={labels} locale={locale} />
      </div>
    </div>
  );
}

function LexemeDetailBody({
  dto,
  labels,
  locale,
  query,
  result
}: {
  dto: LexemeDetailDto;
  labels: SearchDetailLabels;
  locale: string;
  query: string;
  result: SearchResult;
}) {
  const phrases = collectPhraseSamples(dto);
  const kanjiChars = extractKanjiFromHeadword(dto.headword);
  const hasPitchDiagram = hasRenderablePitch(dto.pronunciation);

  return (
    <>
      {(dto.shortMeaningVi || result.description) && (
        <section className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{labels.detailMeaningsLabel}</h3>
          <p className="mt-2 text-sm font-medium leading-relaxed text-ink">
            {dto.shortMeaningVi ?? result.description ?? ""}
          </p>
        </section>
      )}

      <section className="mb-5 rounded-xl border border-ink/8 bg-paper/60 px-3 py-3">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{labels.detailPitchReadingTitle}</h3>
        {hasPitchDiagram ? (
          <div className="mt-3">
            <PitchAccentDisplay
              legend={labels.detailPitchLegend}
              pronunciation={dto.pronunciation}
              variantLabelTpl={labels.detailPitchVariantLabel}
            />
          </div>
        ) : dto.reading ? (
          <p className="jp-text mt-2 text-sm text-ink/90">{dto.reading}</p>
        ) : null}
        {!hasPitchDiagram && dto.pronunciation != null ? (
          <p className="mt-2 font-mono text-[10px] leading-relaxed text-muted">
            <span className="font-semibold">{labels.detailPitchLabel}: </span>
            {typeof dto.pronunciation === "string" ? dto.pronunciation : JSON.stringify(dto.pronunciation)}
          </p>
        ) : null}

        <div className={cn("border-t border-ink/8 pt-3", hasPitchDiagram || dto.reading ? "mt-4" : "mt-3")}>
          <p className="text-xs font-bold uppercase tracking-wide text-muted">{labels.detailAudioUnavailable}</p>
          <p className="mt-1 text-xs leading-relaxed text-muted">{labels.detailRomajiSoon}</p>
        </div>
      </section>

      {kanjiChars.length > 0 ? (
        <LexemeKanjiStrokeStrip
          headwordOrderChars={kanjiChars}
          labels={{
            attributionTpl: labels.detailKanjiStrokeAttributionTpl,
            errorForbidden: labels.detailKanjiStrokeErrorForbidden,
            errorGeneric: labels.detailKanjiStrokeLoadError,
            errorInvalidSvg: labels.detailKanjiStrokeErrorInvalidSvg,
            errorNetwork: labels.detailKanjiStrokeErrorNetwork,
            errorNotFound: labels.detailKanjiStrokeErrorNotFound,
            errorUpstream: labels.detailKanjiStrokeErrorUpstream,
            loading: labels.detailKanjiStrokeLoading,
            replay: labels.detailKanjiStrokeReplay,
            sectionTitle: labels.detailKanjiStrokeOrderTitle
          }}
        />
      ) : null}

      {dto.senses.length > 0 ? (
        <section className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{labels.detailSense}</h3>
          <ol className="mt-2 list-decimal space-y-3 pl-4 text-sm">
            {dto.senses.map((sense) => (
              <li
                key={`${sense.position}-${(sense.meaningVi ?? "").slice(0, 8)}`}
                className="leading-relaxed"
              >
                {sense.partOfSpeech ? (
                  <span className="mr-2 text-[11px] font-semibold text-muted">
                    {labels.detailPartOfSpeech}: {sense.partOfSpeech}
                  </span>
                ) : null}
                <span className="text-ink/90">{sense.meaningVi}</span>
                {sense.exampleLinks.length > 0 ? (
                  <ul className="mt-2 list-none space-y-2 border-l-2 border-accent/20 pl-3">
                    {sense.exampleLinks.slice(0, 4).map((link, i) => {
                      const ex = link.exampleSentence;
                      if (!ex) return null;
                      return (
                        <li key={`${ex.id}-${i}`}>
                          <p className="jp-text text-sm font-medium text-ink">
                            <HighlightMatch query={query} text={ex.japaneseText} />
                          </p>
                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            <SearchReadAloudButton
                              compact
                              labels={{
                                read: labels.detailReadAloud,
                                readSentence: labels.detailReadAloudSentence,
                                stop: labels.detailReadAloudStop
                              }}
                              showTtsNotice={false}
                              text={ex.japaneseText}
                            />
                          </div>
                          {ex.translationVi ? (
                            <p className="text-xs text-muted">{ex.translationVi}</p>
                          ) : null}
                        </li>
                      );
                    })}
                  </ul>
                ) : null}
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      {phrases.length > 0 ? (
        <section className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{labels.detailExamplesLabel}</h3>
          <ul className="mt-2 space-y-1.5">
            {phrases.map((p, i) => (
              <li className="jp-text text-sm text-ink/85" key={`${i}-${p}`}>
                {p}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {kanjiChars.length > 0 ? (
        <section className="mb-5">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{labels.kanjiComponentsLabel}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {kanjiChars.map((ch, i) => (
              <li key={`${i}-${ch}`}>
                <Link
                  className="inline-flex min-h-9 min-w-9 items-center justify-center rounded-lg border border-ink/12 bg-paper px-2 text-lg font-bold text-ink hover:border-accent/30 hover:bg-accent-soft/30"
                  href={`/${locale}/search?q=${encodeURIComponent(ch)}&scope=kanji`}
                >
                  {ch}
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <BjtBlock headword={dto.headword} labels={labels} phrases={phrases} />
    </>
  );
}

function KanjiDetailBody({
  dto,
  labels,
  locale
}: {
  dto: KanjiDetailDto;
  labels: SearchDetailLabels;
  locale: string;
}) {
  return (
    <>
      {dto.meaningVi ? (
        <section className="mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{labels.detailMeaningsLabel}</h3>
          <p className="mt-2 text-sm leading-relaxed text-ink">{dto.meaningVi}</p>
        </section>
      ) : null}
      <section className="mb-4 text-sm">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{labels.detailKanjiReadings}</h3>
        {dto.onyomi ? (
          <p className="mt-2">
            <span className="text-muted">On: </span>
            <span className="jp-text text-ink">{dto.onyomi}</span>
          </p>
        ) : null}
        {dto.kunyomi ? (
          <p className="mt-1">
            <span className="text-muted">Kun: </span>
            <span className="jp-text text-ink">{dto.kunyomi}</span>
          </p>
        ) : null}
        {dto.strokeCount != null ? (
          <p className="mt-1 text-xs text-muted">
            {labels.detailKanjiStroke}: {dto.strokeCount}
          </p>
        ) : null}
        {!dto.strokeSvgPath?.trim() ? (
          <p className="mt-2 text-[10px] leading-relaxed text-muted">{labels.detailKanjiStrokeNoDiagram}</p>
        ) : null}
      </section>
      {dto.strokeSvgPath?.trim() ? (
        <KanjiStrokeAnimation
          kanjiId={dto.id}
          labels={{
            attributionTpl: labels.detailKanjiStrokeAttributionTpl,
            errorForbidden: labels.detailKanjiStrokeErrorForbidden,
            errorGeneric: labels.detailKanjiStrokeLoadError,
            errorInvalidSvg: labels.detailKanjiStrokeErrorInvalidSvg,
            errorNetwork: labels.detailKanjiStrokeErrorNetwork,
            errorNotFound: labels.detailKanjiStrokeErrorNotFound,
            errorUpstream: labels.detailKanjiStrokeErrorUpstream,
            loading: labels.detailKanjiStrokeLoading,
            replay: labels.detailKanjiStrokeReplay,
            sectionTitle: labels.detailKanjiStrokeOrderTitle
          }}
          strokeSvgHash={dto.strokeSvgHash}
          strokeSvgPath={dto.strokeSvgPath}
          strokeSvgSource={dto.strokeSvgSource}
        />
      ) : null}
      {dto.components && dto.components.length > 0 ? (
        <section className="mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{labels.kanjiComponentsLabel}</h3>
          <ul className="mt-2 flex flex-wrap gap-2">
            {dto.components.map((c) => {
              const ch = c.character?.trim();
              if (!ch) return null;
              return (
                <li key={`${ch}-${c.position ?? 0}`}>
                  <Link
                    className="flex min-h-10 min-w-10 flex-col items-center justify-center rounded-lg border border-ink/12 bg-paper px-2 py-1 text-lg font-bold text-ink hover:border-accent/30"
                    href={`/${locale}/search?q=${encodeURIComponent(ch)}&scope=kanji`}
                    title={c.hanViet ?? undefined}
                  >
                    <span className="jp-text leading-none">{ch}</span>
                    {c.hanViet ? (
                      <span className="mt-0.5 max-w-[4.5rem] truncate text-[9px] font-normal text-muted">
                        {c.hanViet}
                      </span>
                    ) : null}
                  </Link>
                </li>
              );
            })}
          </ul>
        </section>
      ) : (
        <section className="mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{labels.kanjiComponentsLabel}</h3>
          <p className="mt-2 text-xs leading-relaxed text-muted">{labels.kanjiComponentsNone}</p>
        </section>
      )}
      <BjtBlock headword={dto.character} labels={labels} phrases={[]} />
    </>
  );
}

function GrammarDetailBody({ dto, labels }: { dto: GrammarDetailDto; labels: SearchDetailLabels }) {
  return (
    <>
      <section className="mb-4">
        <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{labels.detailGrammarPattern}</h3>
        <p className="jp-text mt-2 text-lg font-semibold text-ink">{dto.pattern}</p>
        <p className="mt-2 text-sm leading-relaxed text-ink/85">{dto.meaningVi}</p>
      </section>
      {dto.details && dto.details.length > 0 ? (
        <section className="mb-4">
          <h3 className="text-xs font-bold uppercase tracking-wide text-muted">{labels.detailSense}</h3>
          <ul className="mt-2 list-disc space-y-2 pl-4 text-sm text-ink/80">
            {dto.details.map((d, i) => (
              <li key={`${d.position ?? i}`}>{d.explanation}</li>
            ))}
          </ul>
        </section>
      ) : null}
      <BjtBlock headword={dto.pattern} labels={labels} phrases={[]} />
    </>
  );
}

function tplBody(s: string | undefined, headword: string): string {
  const base = typeof s === "string" ? s : "";
  return base.replace(/\{headword\}/g, headword ?? "");
}

function BjtBlock({
  headword,
  labels,
  phrases
}: {
  headword: string;
  labels: SearchDetailLabels;
  phrases: string[];
}) {
  return (
    <section className="rounded-xl border border-leaf/30 bg-leaf/10 p-4">
      <h3 className="text-xs font-bold uppercase tracking-wide text-ink">{labels.bjtSectionTitle}</h3>
      <p className="mt-2 text-xs leading-relaxed text-ink/80">{labels.bjtSectionIntro}</p>
      <div className="mt-3 space-y-2 text-xs">
        <p className="font-semibold text-ink">{labels.bjtTopicsLabel}</p>
        <p className="leading-relaxed text-ink/80">{tplBody(labels.bjtTopicsBody, headword)}</p>
        <p className="font-semibold text-ink">{labels.bjtPhrasesLabel}</p>
        <p className="leading-relaxed text-ink/80">
          {phrases.length > 0 ? phrases.slice(0, 5).join(" · ") : tplBody(labels.bjtPhrasesBody, headword)}
        </p>
      </div>
    </section>
  );
}

function DetailActions({
  headword,
  labels,
  locale
}: {
  headword: string;
  labels: SearchDetailLabels;
  locale: string;
}) {
  const q = encodeURIComponent(headword);
  return (
    <section className="mt-6 space-y-3 border-t border-ink/8 pt-4">
      <div className="flex flex-wrap gap-2">
        <Link
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl bg-accent px-3 text-xs font-bold text-white hover:bg-accent-hover sm:flex-none sm:px-4"
          href={`/${locale}/quiz`}
        >
          {labels.bjtCtaQuiz}
        </Link>
        <Link
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-ink/12 bg-paper px-3 text-xs font-bold text-ink hover:bg-ink/5 sm:flex-none sm:px-4"
          href={`/${locale}/flashcards`}
        >
          {labels.bjtCtaFlashcards}
        </Link>
        <Link
          className="inline-flex min-h-10 flex-1 items-center justify-center rounded-xl border border-ink/12 bg-paper px-3 text-xs font-bold text-ink hover:bg-ink/5 sm:flex-none sm:px-4"
          href={`/${locale}/battle`}
        >
          {labels.bjtCtaBattle}
        </Link>
      </div>
      <Link
        className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-dashed border-ink/15 px-3 text-xs font-semibold text-muted hover:text-ink"
        href={`/${locale}/flashcards?source=search&q=${q}`}
      >
        {labels.addToFlashcard}
      </Link>
      <p className="text-[10px] leading-relaxed text-muted">{labels.detailActionsFootnote}</p>
      <Link
        className="inline-flex min-h-10 w-full items-center justify-center rounded-xl border border-ink/10 bg-paper/80 px-3 text-xs font-semibold text-accent hover:bg-accent/5 focus:outline-none focus-visible:ring-2 focus-visible:ring-accent/30"
        href={`/${locale}/saved`}
      >
        {labels.detailSavedListLink}
      </Link>
    </section>
  );
}
