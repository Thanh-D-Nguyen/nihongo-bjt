"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";
import { useSharePostcard } from "../../../_hooks/use-share-postcard";

interface PetData {
  name: string;
  stage: string;
  xp: number;
  happiness: number;
  mood: string;
  costumeSlug: string | null;
  totalFeedings: number;
  nextStage: string | null;
  nextThreshold: number | null;
  stageProgress: number;
}

const STAGE_EMOJI: Record<string, string> = {
  egg: "🥚",
  baby: "🐣",
  teen: "🐕",
  adult: "🐕‍🦺",
  master: "👑🐕",
};

const STAGE_LABEL: Record<string, string> = {
  egg: "Trứng",
  baby: "Sơ sinh",
  teen: "Thiếu niên",
  adult: "Trưởng thành",
  master: "Bậc thầy",
};

const MOOD_EMOJI: Record<string, string> = {
  happy: "😊",
  neutral: "😐",
  sad: "😢",
  sick: "🤒",
};

const MOOD_ANIMATION: Record<string, string> = {
  happy: "animate-bounce",
  neutral: "",
  sad: "animate-pulse",
  sick: "animate-[shake_1s_ease-in-out_infinite]",
};

export function CompanionPetWidget({ locale }: { locale: string }) {
  const { userId } = useKeycloakAuth();
  const [pet, setPet] = useState<PetData | null>(null);
  const [loading, setLoading] = useState(true);
  const [editing, setEditing] = useState(false);
  const [nameInput, setNameInput] = useState("");
  const { share, sharing } = useSharePostcard();

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await learnerApiFetch("/api/gamification/pet");
      if (r.ok) {
        const data = await r.json();
        setPet(data);
        setNameInput(data.name);
      }
    } catch {
      /* no-op */
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    void load();
  }, [load]);

  const handleRename = async () => {
    if (!nameInput.trim() || nameInput === pet?.name) {
      setEditing(false);
      return;
    }
    try {
      await learnerApiFetch("/api/gamification/pet/rename", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name: nameInput.trim() }),
      });
      setPet((p) => (p ? { ...p, name: nameInput.trim() } : p));
    } catch {
      /* no-op */
    }
    setEditing(false);
  };

  if (!userId) return null;

  if (loading) {
    return (
      <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm animate-pulse">
        <div className="h-4 w-20 rounded bg-ink/10" />
        <div className="mt-4 mx-auto h-16 w-16 rounded-full bg-ink/5" />
        <div className="mt-3 h-2 rounded bg-ink/5" />
      </div>
    );
  }

  if (!pet) return null;

  const happinessColor =
    pet.happiness >= 70
      ? "bg-[var(--color-matcha)]"
      : pet.happiness >= 40
        ? "bg-[var(--color-gold,#f59e0b)]"
        : "bg-[var(--color-sakura)]";

  return (
    <div className="rounded-2xl border border-ink/8 bg-surface p-4 shadow-sm">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5">
          <span className="text-sm">🐾</span>
          {editing ? (
            <input
              value={nameInput}
              onChange={(e) => setNameInput(e.target.value)}
              onBlur={() => void handleRename()}
              onKeyDown={(e) => e.key === "Enter" && void handleRename()}
              className="w-20 bg-transparent text-sm font-bold text-ink outline-none border-b border-ink/20 focus:border-[var(--color-matcha)]"
              maxLength={30}
              autoFocus
            />
          ) : (
            <button
              onClick={() => setEditing(true)}
              className="text-sm font-bold text-ink hover:text-[var(--color-matcha)] transition-colors"
              title="Đổi tên"
            >
              {pet.name}
            </button>
          )}
        </div>
        <span className="rounded-full bg-ink/5 px-2 py-0.5 text-[10px] font-bold text-muted">
          {STAGE_LABEL[pet.stage] ?? pet.stage}
        </span>
      </div>

      {/* Pet display */}
      <div className="mt-3 flex flex-col items-center">
        <div
          className={cn(
            "text-4xl transition-transform",
            MOOD_ANIMATION[pet.mood],
          )}
        >
          {STAGE_EMOJI[pet.stage] ?? "🐕"}
        </div>
        <span className="mt-1 text-xs">{MOOD_EMOJI[pet.mood]}</span>
      </div>

      {/* Happiness bar */}
      <div className="mt-3">
        <div className="flex items-center justify-between text-[10px] text-muted">
          <span>Hạnh phúc</span>
          <span>{pet.happiness}%</span>
        </div>
        <div className="mt-1 h-1.5 w-full rounded-full bg-ink/10">
          <div
            className={cn(
              "h-full rounded-full transition-all duration-500",
              happinessColor,
            )}
            style={{ width: `${pet.happiness}%` }}
          />
        </div>
      </div>

      {/* Evolution progress */}
      {pet.nextStage && pet.nextThreshold && (
        <div className="mt-2">
          <div className="flex items-center justify-between text-[10px] text-muted">
            <span>Tiến hóa → {STAGE_LABEL[pet.nextStage]}</span>
            <span>
              {pet.xp}/{pet.nextThreshold} XP
            </span>
          </div>
          <div className="mt-1 h-1.5 w-full rounded-full bg-ink/10">
            <div
              className="h-full rounded-full bg-[var(--color-matcha)] transition-all duration-500"
              style={{ width: `${pet.stageProgress}%` }}
            />
          </div>
        </div>
      )}

      {pet.stage === "master" && (
        <p className="mt-2 text-center text-[10px] font-bold text-[var(--color-gold,#f59e0b)]">
          ✨ Bậc thầy — {pet.xp} XP
        </p>
      )}

      {/* Warning if unhappy */}
      {pet.happiness < 30 && (
        <p className="mt-2 text-center text-[10px] text-[var(--color-sakura)] font-medium">
          {pet.name} đang buồn, hãy học để vui lên! 🥺
        </p>
      )}

      {/* Share button for evolved pets */}
      {(pet.stage === "teen" || pet.stage === "adult" || pet.stage === "master") && (
        <button
          onClick={() => void share("/api/learner/shares/pet-evolution")}
          disabled={sharing}
          className="mt-2 w-full rounded-lg bg-ink/5 py-1.5 text-[10px] font-medium text-muted hover:bg-ink/10 transition-colors"
        >
          {sharing ? "Đang tạo..." : "📤 Chia sẻ thành tựu"}
        </button>
      )}

      <style jsx>{`
        @keyframes shake {
          0%,
          100% {
            transform: translateX(0);
          }
          25% {
            transform: translateX(-3px);
          }
          75% {
            transform: translateX(3px);
          }
        }
      `}</style>
    </div>
  );
}
