"use client";

import { cn } from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { useKeycloakAuth } from "../../../../components/auth/keycloak-auth-provider";
import { learnerApiFetch } from "../../../../lib/learner-api";

interface Challenge {
  id: string;
  title: string;
  targetValue: number;
  currentValue: number;
  completed: boolean;
  rewardXp: number;
}

interface SeasonalEvent {
  id: string;
  slug: string;
  nameVi: string;
  iconEmoji: string;
  bannerColor: string;
  description: string | null;
  endDate: string;
  joined: boolean;
  daysRemaining: number;
  participantCount: number;
  challenges: Challenge[];
}

export function SeasonalEventBanner({ locale }: { locale: string }) {
  const { userId } = useKeycloakAuth();
  const [event, setEvent] = useState<SeasonalEvent | null>(null);
  const [loading, setLoading] = useState(true);
  const [expanded, setExpanded] = useState(false);
  const [joining, setJoining] = useState(false);

  const load = useCallback(async () => {
    if (!userId) return;
    try {
      const r = await learnerApiFetch("/api/gamification/events");
      if (r.ok) {
        const events = await r.json();
        if (events.length > 0) {
          // Load first active event with progress
          const detail = await learnerApiFetch(`/api/gamification/events/${events[0].id}`);
          if (detail.ok) setEvent(await detail.json());
        }
      }
    } catch { /* no-op */ } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => { void load(); }, [load]);

  const handleJoin = async () => {
    if (!event || joining) return;
    setJoining(true);
    try {
      const r = await learnerApiFetch(`/api/gamification/events/${event.id}/join`, { method: "POST" });
      if (r.ok) {
        setEvent((e) => e ? { ...e, joined: true, participantCount: e.participantCount + 1 } : e);
      }
    } catch { /* no-op */ } finally {
      setJoining(false);
    }
  };

  if (!userId || loading) return null;
  if (!event) return null;

  const completedCount = event.challenges.filter((c) => c.completed).length;
  const totalXp = event.challenges.reduce((sum, c) => sum + c.rewardXp, 0);

  return (
    <div
      className="rounded-2xl border shadow-sm overflow-hidden"
      style={{ borderColor: `${event.bannerColor}30`, background: `${event.bannerColor}08` }}
    >
      {/* Header */}
      <div
        className="px-4 py-3 flex items-center justify-between cursor-pointer"
        style={{ background: `${event.bannerColor}15` }}
        onClick={() => setExpanded(!expanded)}
      >
        <div className="flex items-center gap-2">
          <span className="text-xl">{event.iconEmoji}</span>
          <div>
            <h3 className="text-sm font-black text-ink">{event.nameVi}</h3>
            <p className="text-[10px] text-muted">
              {event.daysRemaining} ngày còn lại · {event.participantCount} người tham gia
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {event.joined ? (
            <span className="rounded-full px-2 py-0.5 text-[10px] font-bold text-white" style={{ background: event.bannerColor }}>
              {completedCount}/{event.challenges.length} ✓
            </span>
          ) : (
            <button
              onClick={(e) => { e.stopPropagation(); void handleJoin(); }}
              disabled={joining}
              className="rounded-full px-3 py-1 text-xs font-bold text-white transition-transform active:scale-95"
              style={{ background: event.bannerColor }}
            >
              {joining ? "..." : "Tham gia"}
            </button>
          )}
          <span className={cn("text-xs text-muted transition-transform", expanded && "rotate-180")}>▼</span>
        </div>
      </div>

      {/* Expanded: challenges */}
      {expanded && (
        <div className="px-4 py-3 space-y-2">
          {event.description && (
            <p className="text-xs text-muted mb-3">{event.description}</p>
          )}

          {event.challenges.map((c) => {
            const pct = Math.min(100, Math.round((c.currentValue / c.targetValue) * 100));
            return (
              <div key={c.id} className="flex items-center gap-3">
                <div className="flex-1">
                  <div className="flex items-center justify-between">
                    <span className={cn("text-xs font-medium", c.completed ? "text-[var(--color-matcha)] line-through" : "text-ink")}>
                      {c.completed ? "✅ " : ""}{c.title}
                    </span>
                    <span className="text-[10px] text-muted">
                      {c.currentValue}/{c.targetValue} · +{c.rewardXp} XP
                    </span>
                  </div>
                  <div className="mt-1 h-1.5 w-full rounded-full bg-ink/10">
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{
                        width: `${pct}%`,
                        background: c.completed ? "var(--color-matcha)" : event.bannerColor,
                      }}
                    />
                  </div>
                </div>
              </div>
            );
          })}

          <p className="text-center text-[10px] text-muted pt-1">
            Tổng thưởng: {totalXp} XP
          </p>
        </div>
      )}
    </div>
  );
}
