# Pet Costume System — Complete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Connect mystery box pet_costume rewards to the companion pet system — add inventory, equip API, auto-grant on claim, and costume display in the pet widget.

**Architecture:** New `PetCostumeInventory` table tracks owned costumes per user. Mystery box `openBox` auto-inserts into inventory when reward_type is `pet_costume`. New endpoints let users list/equip costumes. Widget renders equipped costume emoji overlay.

**Tech Stack:** Prisma migration, NestJS service/controller, React widget update

---

## File Structure

| File | Action | Responsibility |
|------|--------|----------------|
| `packages/database/prisma/migrations/20260521120000_pet_costume_inventory/migration.sql` | Create | New table + seed |
| `packages/database/prisma/schema.prisma` | Modify | Add `PetCostumeInventory` model |
| `apps/api/src/gamification/companion-pet.service.ts` | Modify | Add inventory/equip methods |
| `apps/api/src/gamification/mystery-box.service.ts` | Modify | Auto-grant costume on claim |
| `apps/api/src/gamification/gamification.controller.ts` | Modify | Add costume endpoints |
| `apps/web/app/[locale]/_components/homepage/companion-pet-widget.tsx` | Modify | Display costume + picker |

---

### Task 1: Database Migration — PetCostumeInventory Table

**Files:**
- Create: `packages/database/prisma/migrations/20260521120000_pet_costume_inventory/migration.sql`
- Modify: `packages/database/prisma/schema.prisma` (add model after CompanionPet)

- [ ] **Step 1: Create migration SQL**

```sql
-- CreateTable
CREATE TABLE "gamification"."pet_costume_inventory" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "user_id" UUID NOT NULL,
    "costume_slug" VARCHAR(50) NOT NULL,
    "obtained_from" VARCHAR(30) NOT NULL DEFAULT 'mystery_box',
    "obtained_at" TIMESTAMPTZ(6) NOT NULL DEFAULT now(),
    CONSTRAINT "pet_costume_inventory_pkey" PRIMARY KEY ("id")
);

-- Unique: one of each costume per user
CREATE UNIQUE INDEX "uq_pet_costume_user_slug" ON "gamification"."pet_costume_inventory"("user_id", "costume_slug");
CREATE INDEX "idx_pet_costume_user" ON "gamification"."pet_costume_inventory"("user_id");
```

- [ ] **Step 2: Add Prisma model to schema.prisma**

Add after the `CompanionPet` model (around line 2744):

```prisma
/// Tracks which pet costumes a user owns (from mystery box, events, etc.)
model PetCostumeInventory {
  id           String   @id @default(dbgenerated("gen_random_uuid()")) @db.Uuid
  userId       String   @map("user_id") @db.Uuid
  costumeSlug  String   @map("costume_slug") @db.VarChar(50)
  obtainedFrom String   @default("mystery_box") @map("obtained_from") @db.VarChar(30)
  obtainedAt   DateTime @default(now()) @map("obtained_at") @db.Timestamptz(6)

  @@unique([userId, costumeSlug], map: "uq_pet_costume_user_slug")
  @@index([userId], map: "idx_pet_costume_user")
  @@map("pet_costume_inventory")
  @@schema("gamification")
}
```

- [ ] **Step 3: Run migration**

```bash
cd packages/database && pnpm prisma migrate deploy
```

- [ ] **Step 4: Generate Prisma client**

```bash
pnpm prisma generate
```

- [ ] **Step 5: Commit**

```bash
git add packages/database/prisma/
git commit -m "feat(db): add pet_costume_inventory table"
```

---

### Task 2: Backend — Costume Inventory & Equip Methods

**Files:**
- Modify: `apps/api/src/gamification/companion-pet.service.ts`

- [ ] **Step 1: Add costume inventory methods to CompanionPetService**

Add after the `renamePet` method (around line 120):

```typescript
  /** Get user's owned costumes */
  async getCostumes(userId: string) {
    const inventory = await this.prisma.petCostumeInventory.findMany({
      where: { userId },
      orderBy: { obtainedAt: "desc" },
    });

    // Get reward metadata for each costume
    const slugs = inventory.map((i) => i.costumeSlug);
    const rewards = await this.prisma.mysteryBoxReward.findMany({
      where: { slug: { in: slugs }, rewardType: "pet_costume" },
    });
    const rewardMap = new Map(rewards.map((r) => [r.slug, r]));

    return inventory.map((item) => {
      const reward = rewardMap.get(item.costumeSlug);
      return {
        slug: item.costumeSlug,
        nameVi: reward?.nameVi ?? item.costumeSlug,
        nameJa: reward?.nameJa ?? null,
        iconEmoji: reward?.iconEmoji ?? "👕",
        rarity: reward?.rarity ?? "common",
        obtainedAt: item.obtainedAt,
      };
    });
  }

  /** Equip a costume (must own it). Pass null to unequip. */
  async equipCostume(userId: string, costumeSlug: string | null) {
    if (costumeSlug) {
      // Verify ownership
      const owned = await this.prisma.petCostumeInventory.findUnique({
        where: { userId_costumeSlug: { userId, costumeSlug } },
      });
      if (!owned) return { error: "not_owned" };
    }

    const pet = await this.prisma.companionPet.update({
      where: { userId },
      data: { costumeSlug },
    });

    return { costumeSlug: pet.costumeSlug };
  }

  /** Grant a costume to user inventory (idempotent — skips if already owned) */
  async grantCostume(userId: string, costumeSlug: string, source = "mystery_box") {
    try {
      await this.prisma.petCostumeInventory.create({
        data: { userId, costumeSlug, obtainedFrom: source },
      });
    } catch (e: unknown) {
      // Unique constraint violation = already owns it, which is fine
      if ((e as { code?: string }).code === "P2002") {
        this.logger.debug(`User ${userId} already owns costume ${costumeSlug}`);
        return;
      }
      throw e;
    }
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/gamification/companion-pet.service.ts
git commit -m "feat(api): add costume inventory/equip/grant methods"
```

---

### Task 3: Backend — Wire Mystery Box to Auto-Grant Costume

**Files:**
- Modify: `apps/api/src/gamification/mystery-box.service.ts`

- [ ] **Step 1: Inject CompanionPetService into MysteryBoxService**

Replace the class declaration and add injection:

```typescript
import { Injectable, BadRequestException, Inject, forwardRef } from "@nestjs/common";
import { createPrismaClient } from "@nihongo-bjt/database";
import { CompanionPetService } from "./companion-pet.service.js";

@Injectable()
export class MysteryBoxService {
  private readonly prisma = createPrismaClient();

  constructor(
    @Inject(forwardRef(() => CompanionPetService))
    private readonly companionPetService: CompanionPetService,
  ) {}
```

- [ ] **Step 2: Add costume auto-grant after claim creation in `openBox`**

After the `create` call in openBox (around line 80), add:

```typescript
    // Auto-grant costume to pet inventory
    if (selected.rewardType === "pet_costume") {
      await this.companionPetService.grantCostume(userId, selected.slug, "mystery_box");
    }
```

- [ ] **Step 3: Commit**

```bash
git add apps/api/src/gamification/mystery-box.service.ts
git commit -m "feat(api): auto-grant pet costume on mystery box claim"
```

---

### Task 4: Backend — Controller Endpoints for Costumes

**Files:**
- Modify: `apps/api/src/gamification/gamification.controller.ts`

- [ ] **Step 1: Add costume endpoints after the pet/rename endpoint**

```typescript
  @Get("pet/costumes")
  @ApiOperation({ summary: "List user's owned pet costumes." })
  getPetCostumes(@CurrentUser() user: KeycloakAuthenticatedUser | undefined) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    return this.companionPetService.getCostumes(userId);
  }

  @Post("pet/equip")
  @ApiOperation({ summary: "Equip or unequip a pet costume (pass costumeSlug: null to unequip)." })
  equipPetCostume(
    @CurrentUser() user: KeycloakAuthenticatedUser | undefined,
    @Body() body: Record<string, unknown>,
  ) {
    const userId = resolveLearnerUserId(user, undefined, { required: true })!;
    const costumeSlug = body.costumeSlug ? String(body.costumeSlug) : null;
    return this.companionPetService.equipCostume(userId, costumeSlug);
  }
```

- [ ] **Step 2: Commit**

```bash
git add apps/api/src/gamification/gamification.controller.ts
git commit -m "feat(api): add GET pet/costumes and POST pet/equip endpoints"
```

---

### Task 5: Frontend — Display Costume on Pet & Add Costume Picker

**Files:**
- Modify: `apps/web/app/[locale]/_components/homepage/companion-pet-widget.tsx`

- [ ] **Step 1: Add costume data to PetData interface and add CostumeItem type**

```typescript
interface CostumeItem {
  slug: string;
  nameVi: string;
  iconEmoji: string;
  rarity: string;
}
```

- [ ] **Step 2: Add costume state and fetch in the component**

```typescript
  const [costumes, setCostumes] = useState<CostumeItem[]>([]);
  const [showCostumes, setShowCostumes] = useState(false);

  // Load costumes alongside pet
  const loadCostumes = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await learnerApiFetch("/api/gamification/pet/costumes");
      if (r.ok) setCostumes(await r.json());
    } catch { /* no-op */ }
  }, [userId]);

  useEffect(() => { void loadCostumes(); }, [loadCostumes]);
```

- [ ] **Step 3: Add equip handler**

```typescript
  const handleEquip = async (slug: string | null) => {
    try {
      const r = await learnerApiFetch("/api/gamification/pet/equip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ costumeSlug: slug }),
      });
      if (r.ok) {
        setPet((p) => p ? { ...p, costumeSlug: slug } : p);
        setShowCostumes(false);
      }
    } catch { /* no-op */ }
  };
```

- [ ] **Step 4: Display costume emoji overlay on pet + toggle button**

In the pet display section, add costume overlay:

```tsx
      {/* Pet display */}
      <div className="mt-3 flex flex-col items-center">
        <div className={cn("relative text-4xl transition-transform", MOOD_ANIMATION[pet.mood])}>
          {STAGE_EMOJI[pet.stage] ?? "🐕"}
          {pet.costumeSlug && (
            <span className="absolute -top-2 -right-2 text-lg drop-shadow-sm">
              {costumes.find((c) => c.slug === pet.costumeSlug)?.iconEmoji ?? "👕"}
            </span>
          )}
        </div>
        <span className="mt-1 text-xs">{MOOD_EMOJI[pet.mood]}</span>

        {/* Costume toggle */}
        {costumes.length > 0 && (
          <button
            onClick={() => setShowCostumes(!showCostumes)}
            className="mt-1 text-[10px] font-medium text-muted hover:text-ink transition-colors"
          >
            👗 Trang phục ({costumes.length})
          </button>
        )}
      </div>
```

- [ ] **Step 5: Add costume picker dropdown (below the pet display)**

```tsx
      {/* Costume picker */}
      {showCostumes && (
        <div className="mt-2 rounded-xl border border-ink/10 bg-ink/3 p-2 animate-in fade-in slide-in-from-top-2 duration-200">
          <div className="flex flex-wrap gap-1.5">
            {/* Unequip button */}
            <button
              onClick={() => void handleEquip(null)}
              className={cn(
                "flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors",
                !pet.costumeSlug ? "bg-ink/10 text-ink" : "bg-ink/5 text-muted hover:bg-ink/10",
              )}
            >
              ❌ Không
            </button>
            {costumes.map((c) => (
              <button
                key={c.slug}
                onClick={() => void handleEquip(c.slug)}
                className={cn(
                  "flex items-center gap-1 rounded-lg px-2 py-1 text-[10px] font-medium transition-colors",
                  pet.costumeSlug === c.slug
                    ? "bg-[var(--color-matcha)]/20 text-[var(--color-matcha)] ring-1 ring-[var(--color-matcha)]/30"
                    : "bg-ink/5 text-muted hover:bg-ink/10",
                )}
                title={c.nameVi}
              >
                {c.iconEmoji} {c.nameVi}
              </button>
            ))}
          </div>
        </div>
      )}
```

- [ ] **Step 6: Commit**

```bash
git add apps/web/app/[locale]/_components/homepage/companion-pet-widget.tsx
git commit -m "feat(web): display pet costume + costume picker UI"
```

---

### Task 6: Auto-Feed Pet on Study Actions (Wire Events)

**Files:**
- Modify: `apps/api/src/gamification/mystery-box.service.ts` (already wired)
- Modify: `apps/api/src/gamification/gamification.service.ts` (add pet feed trigger after XP/activity events)

- [ ] **Step 1: Find where gamification events are processed (XP awards)**

Look at `gamification.service.ts` for methods like `awardXp`, `recordActivity`, or similar that fire when a user completes study actions.

- [ ] **Step 2: Inject CompanionPetService into GamificationService**

Add to constructor:

```typescript
  constructor(
    private readonly companionPetService: CompanionPetService,
    // ... existing deps
  ) {}
```

- [ ] **Step 3: Call feedPet when recording study activity**

In the relevant method (after recording XP/activity):

```typescript
    // Auto-feed companion pet
    try {
      await this.companionPetService.feedPet(userId, action);
    } catch { /* pet feed is non-critical */ }
```

The `action` mapping:
- Flashcard review → `"review"`
- Quiz completion → `"quiz"`
- Daily phrase view → `"daily_phrase"`
- Focus timer completion → `"focus_session"`
- Daily login → `"login"`

- [ ] **Step 4: Commit**

```bash
git add apps/api/src/gamification/gamification.service.ts
git commit -m "feat(api): auto-feed pet on study activity completion"
```

---

### Task 7: Verify End-to-End

- [ ] **Step 1: Start API and verify endpoints respond**

```bash
pnpm dev:api
# In another terminal:
curl -s http://localhost:4000/api/gamification/pet/costumes -H "Authorization: Bearer $TOKEN" | jq
curl -s -X POST http://localhost:4000/api/gamification/pet/equip -H "Authorization: Bearer $TOKEN" -H "Content-Type: application/json" -d '{"costumeSlug":"pet_hat"}' | jq
```

- [ ] **Step 2: Verify UI renders costumes on pet widget**

```bash
pnpm dev:web
# Open http://localhost:3000 → Homepage → Check pet widget shows costume picker if user owns costumes
```

- [ ] **Step 3: Verify mystery box auto-grants costume**

Open mystery box until a pet_costume is rolled → verify it appears in `/pet/costumes` → equip it → verify it shows on pet.

- [ ] **Step 4: Final commit if any adjustments**

```bash
git add -A && git commit -m "fix: pet costume system adjustments from e2e testing"
```

---

## Summary of Changes

| What | Before | After |
|------|--------|-------|
| Mystery box `pet_costume` claim | Returns reward data, does nothing | Auto-grants to `PetCostumeInventory` |
| Pet costume inventory | Non-existent | Full table with ownership tracking |
| Equip costume | Dead `costumeSlug` field | Working API + persists to DB |
| Widget display | Ignores `costumeSlug` | Shows costume emoji on pet + picker UI |
| Pet feeding | Manual-only endpoint | Auto-triggered from study activity events |
