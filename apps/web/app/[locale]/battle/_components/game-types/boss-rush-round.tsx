"use client";

import { useEffect, useState } from "react";
import type { GameTypeRoundProps } from "./shared-props";

/**
 * Boss Rush: HP bar boss mechanic.
 * Each correct answer = damage to boss. Wrong = boss attacks (shake + your HP loss).
 * Visual: boss sprite, HP bars, floating damage numbers.
 */
export function BossRushRound({
  answerPending,
  answerResult,
  canAnswer,
  onSubmitAnswer,
  round,
  selectedOptionKey
}: GameTypeRoundProps) {
  const totalRounds = round.totalRounds;
  const currentRound = round.roundIndex;

  // Boss HP: starts at 100%, each correct = -(100/totalRounds)%
  // Simulate based on round progression (server doesn't track boss HP, we derive)
  const bossMaxHp = totalRounds * 10;
  const [bossHp, setBossHp] = useState(bossMaxHp);
  const [playerHp, setPlayerHp] = useState(100);
  const [damageFloat, setDamageFloat] = useState<{ value: number; isPlayer: boolean } | null>(null);
  const [bossShake, setBossShake] = useState(false);
  const [playerShake, setPlayerShake] = useState(false);

  // Reset boss HP on first round
  useEffect(() => {
    if (currentRound === 0) {
      setBossHp(bossMaxHp);
      setPlayerHp(100);
    }
  }, [currentRound, bossMaxHp]);

  // React to answer results
  useEffect(() => {
    if (!answerResult) return;
    if (answerResult.userCorrect) {
      // Damage boss
      const dmg = 10;
      setBossHp((h) => Math.max(0, h - dmg));
      setDamageFloat({ value: dmg, isPlayer: false });
      setBossShake(true);
      setTimeout(() => setBossShake(false), 400);
    } else {
      // Boss attacks player
      const dmg = Math.floor(100 / totalRounds);
      setPlayerHp((h) => Math.max(0, h - dmg));
      setDamageFloat({ value: dmg, isPlayer: true });
      setPlayerShake(true);
      setTimeout(() => setPlayerShake(false), 400);
    }
    setTimeout(() => setDamageFloat(null), 1200);
  }, [answerResult, totalRounds]);

  const bossHpPct = Math.max(0, (bossHp / bossMaxHp) * 100);
  const playerHpPct = Math.max(0, playerHp);
  const wave = currentRound + 1;
  const isFinalWave = wave >= totalRounds * 0.8;

  // Boss appearance changes based on HP
  const bossEmoji = bossHpPct > 60 ? "👹" : bossHpPct > 30 ? "😤" : "💀";
  const bossGlow = bossHpPct > 60 ? "from-red-500 to-orange-500" : bossHpPct > 30 ? "from-orange-500 to-yellow-500" : "from-purple-600 to-red-500";

  return (
    <div className="space-y-4">
      {/* Wave header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span className="text-lg" aria-hidden>🔥</span>
          <span className="text-xs font-black uppercase text-orange-600">
            Wave {wave}/{totalRounds}
          </span>
          {isFinalWave && (
            <span className="animate-pulse rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-black text-red-600">
              BOSS ENRAGED
            </span>
          )}
        </div>
      </div>

      {/* Boss arena */}
      <div className="relative rounded-2xl border border-orange-200/60 bg-gradient-to-b from-slate-900 to-slate-800 p-4 overflow-hidden">
        {/* Background particles */}
        <div className="absolute inset-0 opacity-20" aria-hidden>
          {isFinalWave && (
            <div className="absolute inset-0 bg-gradient-to-t from-red-900/40 to-transparent animate-pulse" />
          )}
        </div>

        <div className="relative flex items-center justify-between gap-4">
          {/* Player side */}
          <div className={`flex flex-col items-center gap-1 ${playerShake ? "animate-bounce" : ""}`}>
            <div className="grid h-12 w-12 place-items-center rounded-full bg-gradient-to-br from-blue-500 to-indigo-600 text-lg shadow-lg shadow-blue-500/30">
              ⚔️
            </div>
            <div className="w-16">
              <div className="h-2 rounded-full bg-slate-700">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-blue-400 to-cyan-400 transition-all duration-500"
                  style={{ width: `${playerHpPct}%` }}
                />
              </div>
              <p className="mt-0.5 text-center text-[9px] font-bold text-slate-400">You</p>
            </div>
            {damageFloat?.isPlayer && (
              <span className="absolute -top-2 left-4 animate-bounce text-sm font-black text-red-400">
                -{damageFloat.value}
              </span>
            )}
          </div>

          {/* VS */}
          <span className="text-lg font-black text-slate-500">VS</span>

          {/* Boss side */}
          <div className={`flex flex-col items-center gap-1 ${bossShake ? "animate-bounce" : ""}`}>
            <div className={`grid h-16 w-16 place-items-center rounded-full bg-gradient-to-br ${bossGlow} text-2xl shadow-lg shadow-red-500/30 ${isFinalWave ? "animate-pulse" : ""}`}>
              {bossEmoji}
            </div>
            <div className="w-20">
              <div className="h-2.5 rounded-full bg-slate-700 ring-1 ring-red-500/30">
                <div
                  className={`h-full rounded-full transition-all duration-700 ${
                    bossHpPct > 60 ? "bg-gradient-to-r from-red-500 to-red-400" :
                    bossHpPct > 30 ? "bg-gradient-to-r from-orange-500 to-yellow-400" :
                    "bg-gradient-to-r from-purple-500 to-red-400 animate-pulse"
                  }`}
                  style={{ width: `${bossHpPct}%` }}
                />
              </div>
              <p className="mt-0.5 text-center text-[9px] font-bold text-slate-400">BOSS</p>
            </div>
            {damageFloat && !damageFloat.isPlayer && (
              <span className="absolute -top-2 right-4 animate-bounce text-sm font-black text-yellow-400">
                -{damageFloat.value}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Question prompt */}
      <p className="rounded-xl border border-orange-100 bg-orange-50/50 p-3 text-sm font-semibold text-ink">
        {round.question.prompt}
      </p>

      {/* Attack options */}
      <div className="grid grid-cols-2 gap-2">
        {round.question.options.map((option) => {
          const picked = selectedOptionKey === option.optionKey;
          const correct = answerResult?.correctOptionKey === option.optionKey;
          const wrong = picked && answerResult && !answerResult.userCorrect;
          return (
            <button
              key={option.optionKey}
              className={`relative min-h-14 rounded-xl border px-3 py-2.5 text-center text-sm font-bold leading-5 transition-all ${
                correct
                  ? "border-yellow-300 bg-yellow-100 text-yellow-800 ring-2 ring-yellow-300"
                  : wrong
                    ? "border-red-300 bg-red-100 text-red-700 ring-2 ring-red-200"
                    : picked
                      ? "border-orange-300 bg-orange-50 text-orange-800"
                      : "border-ink/10 bg-white text-ink hover:border-orange-200 hover:bg-orange-50/50 active:scale-[0.95]"
              } ${answerPending || answerResult ? "pointer-events-none" : ""}`}
              disabled={!canAnswer}
              onClick={() => onSubmitAnswer(option.optionKey)}
              type="button"
            >
              {option.text}
              {canAnswer && !answerResult && (
                <span className="absolute -top-1 -right-1 grid h-4 w-4 place-items-center rounded-full bg-orange-500 text-[8px] text-white">⚔</span>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
