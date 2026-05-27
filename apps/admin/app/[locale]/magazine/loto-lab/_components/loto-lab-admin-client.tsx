"use client";

import { useCallback, useEffect, useState } from "react";
import { AdminPageHeader, AdminSection } from "@nihongo-bjt/ui";
import { adminApiFetch } from "@/lib/admin-api";

/* ─── Types ─── */

type LotoGame = "loto6" | "loto7";

type Tab = "predictions" | "results" | "analytics" | "data" | "generation";

interface PredictionItem {
  id: string;
  slug: string;
  titleJp: string;
  titleVi: string;
  contentDate: string;
  approvalStatus: string;
  approvedAt: string | null;
  contentJson: any;
  status: string;
}

interface DrawResult {
  id: string;
  game: string;
  drawNumber: number;
  drawDate: string;
  mainNumbers: number[];
  bonusNumbers: number[];
}

interface Analytics {
  game: string;
  totalPredictions: number;
  matchedCount: number;
  avgHitRate: number;
  bestHit: number;
  bestDrawNumber: number | null;
  hitDistribution: Record<number, number>;
  totalViews: number;
}

interface LotoLabLabels {
  tabPredictions?: string;
  tabResults?: string;
  tabAnalytics?: string;
  tabData?: string;
  tabGeneration?: string;
  filterAll?: string;
  filterPending?: string;
  filterApproved?: string;
  filterRejected?: string;
  approve?: string;
  reject?: string;
  edit?: string;
  inputResult?: string;
  drawNumber?: string;
  drawDate?: string;
  mainNumbers?: string;
  bonusNumbers?: string;
  save?: string;
  totalPredictions?: string;
  avgHitRate?: string;
  bestHit?: string;
  totalViews?: string;
}

export function LotoLabAdminClient({
  labels,
  lotoLabels,
  locale,
}: {
  labels: any;
  lotoLabels?: LotoLabLabels;
  locale: string;
}) {
  const [tab, setTab] = useState<Tab>("predictions");
  const [game, setGame] = useState<LotoGame>("loto6");

  const tabs: { key: Tab; label: string; icon: string }[] = [
    { key: "generation", label: lotoLabels?.tabGeneration ?? "Sinh dãy số", icon: "🎲" },
    { key: "data", label: lotoLabels?.tabData ?? "Dữ liệu", icon: "📊" },
    { key: "predictions", label: lotoLabels?.tabPredictions ?? "Predictions", icon: "🔮" },
    { key: "results", label: lotoLabels?.tabResults ?? "Results", icon: "🎯" },
    { key: "analytics", label: lotoLabels?.tabAnalytics ?? "Analytics", icon: "📈" },
  ];

  return (
    <div className="space-y-6">
      <AdminPageHeader
        title={labels?.lotoLabTitle ?? "Loto Lab"}
        description={labels?.lotoLabDescription ?? "Quản lý dự đoán Loto"}
      />

      {/* Game selector */}
      <div className="flex items-center gap-4">
        <select
          value={game}
          onChange={(e) => setGame(e.target.value as LotoGame)}
          className="rounded-lg border border-border bg-surface px-3 py-2 text-sm"
        >
          <option value="loto6">Loto6 (6/43)</option>
          <option value="loto7">Loto7 (7/37)</option>
        </select>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 overflow-x-auto border-b border-border">
        {tabs.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={`flex items-center gap-1.5 whitespace-nowrap border-b-2 px-4 py-2.5 text-sm font-medium transition-colors ${
              tab === t.key
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <span>{t.icon}</span>
            {t.label}
          </button>
        ))}
      </div>

      {/* Tab content */}
      {tab === "generation" && <GenerationTab game={game} labels={labels} />}
      {tab === "data" && <DataTab game={game} labels={labels} />}
      {tab === "predictions" && <PredictionsTab game={game} labels={lotoLabels} />}
      {tab === "results" && <ResultsTab game={game} labels={lotoLabels} />}
      {tab === "analytics" && <AnalyticsTab game={game} labels={lotoLabels} />}
    </div>
  );
}

/* ─── Algorithm Constants ─── */

const DEFAULT_WEIGHTS = {
  frequencyHot: 0.18,
  frequencyCold: 0.08,
  overdue: 0.15,
  recentMomentum: 0.14,
  pairAffinity: 0.13,
  gapPattern: 0.10,
  positionBias: 0.06,
  weatherBias: 0.05,
  dreamTextBias: 0.04,
  dateNumerology: 0.03,
  randomEntropy: 0.04,
};

function parseNumberList(value: string): number[] {
  return value
    .split(/[,\s]+/u)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function NumberChips({ numbers, variant = "primary" }: { numbers: number[]; variant?: "primary" | "muted" }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {numbers.map((number, i) => (
        <span
          key={`${number}-${i}`}
          className={`inline-flex size-7 items-center justify-center rounded-full text-xs font-semibold ${
            variant === "primary"
              ? "bg-primary/10 text-primary"
              : "bg-muted/30 text-muted-foreground"
          }`}
        >
          {number}
        </span>
      ))}
    </span>
  );
}

/* ─── Data Health Summary Type ─── */

type LotoSummary = {
  game: LotoGame;
  drawCount: number;
  lastDraw: { drawNumber: number; drawDate: string; mainNumbers: number[]; bonusNumbers: number[] } | null;
  hotNumbers: number[];
  coldNumbers: number[];
  overdueNumbers: number[];
};

type LotoRun = {
  id: string;
  japaneseSentence?: { textJp?: string; reading?: string; textVi?: string };
  sets: Array<{
    id: string;
    rank: number;
    mainNumbers: number[];
    bonusNumbers: number[];
    score: number;
    explanation?: { signals?: Record<string, number[]> };
  }>;
};

/* ─── Generation Tab ─── */

function GenerationTab({ game, labels }: { game: LotoGame; labels: any }) {
  const [summary, setSummary] = useState<LotoSummary | null>(null);
  const [run, setRun] = useState<LotoRun | null>(null);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [targetDrawDate, setTargetDrawDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [setCount, setSetCount] = useState(3);
  const [seed, setSeed] = useState("");
  const [weatherText, setWeatherText] = useState("");
  const [dreamText, setDreamText] = useState("");
  const [luckyText, setLuckyText] = useState("");
  const [pinnedNumbers, setPinnedNumbers] = useState("");
  const [excludedNumbers, setExcludedNumbers] = useState("");
  const [weights, setWeights] = useState(DEFAULT_WEIGHTS);
  const [showAdvanced, setShowAdvanced] = useState(false);

  const loadSummary = useCallback(async () => {
    try {
      const res = await adminApiFetch(`/api/admin/magazine/loto/summary?game=${game}`);
      if (!res.ok) throw new Error("summary failed");
      setSummary((await res.json()) as LotoSummary);
    } catch {
      setSummary(null);
    }
  }, [game]);

  useEffect(() => {
    void loadSummary();
  }, [loadSummary]);

  const generateSets = async () => {
    setBusy(true);
    setMessage(null);
    try {
      const res = await adminApiFetch("/api/admin/magazine/loto/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          game,
          targetDrawDate,
          setCount,
          seed: seed || undefined,
          weights,
          weatherText: weatherText || undefined,
          dreamText: dreamText || undefined,
          luckyText: luckyText || undefined,
          pinnedNumbers: parseNumberList(pinnedNumbers),
          excludedNumbers: parseNumberList(excludedNumbers),
        }),
      });
      if (!res.ok) throw new Error("generate failed");
      setRun((await res.json()) as LotoRun);
      await loadSummary();
    } catch {
      setMessage(summary && summary.drawCount < 10 ? (labels?.lotoNeedData ?? "Cần nhập thêm dữ liệu lịch sử") : (labels?.error ?? "Lỗi"));
    } finally {
      setBusy(false);
    }
  };

  const resetWeights = () => setWeights(DEFAULT_WEIGHTS);

  return (
    <AdminSection>
      <div className="grid grid-cols-1 gap-5 lg:grid-cols-[minmax(0,1fr)_minmax(300px,380px)]">
        {/* Left: Generation Form */}
        <div className="space-y-4">
          <div className="rounded-xl border border-border/50 bg-gradient-to-br from-primary/[0.02] to-transparent p-5">
            <h3 className="text-sm font-semibold">🎲 Sinh dãy số dự đoán</h3>
            <p className="mt-1 text-xs text-muted-foreground">
              Mix thuật toán thống kê + ngữ cảnh bất định → sinh 1–5 dãy số {game === "loto6" ? "(6/43)" : "(7/37)"}
            </p>

            {/* Basic params */}
            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-muted-foreground">
                📅 Ngày quay dự kiến
                <input type="date" value={targetDrawDate} onChange={(e) => setTargetDrawDate(e.target.value)} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                🔢 Số bộ (1-5)
                <input type="number" min={1} max={5} value={setCount} onChange={(e) => setSetCount(Number(e.target.value))} className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                🌱 Seed (tùy chọn)
                <input value={seed} onChange={(e) => setSeed(e.target.value)} placeholder="random" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
              </label>
            </div>

            {/* Context inputs (uncertainty factors) */}
            <div className="mt-4">
              <h4 className="text-xs font-semibold text-muted-foreground">🌀 Ngữ cảnh bất định (entropy sources)</h4>
              <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-2">
                <label className="text-xs font-medium text-muted-foreground">
                  ☁️ Thời tiết hôm nay
                  <input value={weatherText} onChange={(e) => setWeatherText(e.target.value)} placeholder="Mưa rào, 28°C, ẩm 85%" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  💭 Giấc mơ / linh cảm
                  <input value={dreamText} onChange={(e) => setDreamText(e.target.value)} placeholder="Mơ thấy cá chép vàng..." className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  🍀 Chữ / câu may mắn
                  <input value={luckyText} onChange={(e) => setLuckyText(e.target.value)} placeholder="大吉 / fortune cookie..." className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                </label>
                <div className="grid grid-cols-2 gap-3">
                  <label className="text-xs font-medium text-muted-foreground">
                    📌 Ghim số
                    <input value={pinnedNumbers} onChange={(e) => setPinnedNumbers(e.target.value)} placeholder="7, 14" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                  <label className="text-xs font-medium text-muted-foreground">
                    🚫 Loại trừ
                    <input value={excludedNumbers} onChange={(e) => setExcludedNumbers(e.target.value)} placeholder="1, 2, 3" className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm" />
                  </label>
                </div>
              </div>
            </div>

            {/* Advanced: Weight Tuning */}
            <div className="mt-4">
              <button
                type="button"
                onClick={() => setShowAdvanced(!showAdvanced)}
                className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground hover:text-foreground transition-colors"
              >
                <span className={`transition-transform ${showAdvanced ? "rotate-90" : ""}`}>▶</span>
                ⚙️ Tinh chỉnh thuật toán ({Object.keys(weights).length} tham số)
              </button>
              {showAdvanced && (
                <div className="mt-3 rounded-lg border border-border/50 bg-muted/10 p-4">
                  <div className="mb-3 flex items-center justify-between">
                    <span className="text-[10px] text-muted-foreground">Tổng weight: {Object.values(weights).reduce((a, b) => a + b, 0).toFixed(2)}</span>
                    <button type="button" onClick={resetWeights} className="rounded px-2 py-1 text-[10px] font-medium text-primary hover:bg-primary/10 transition-colors">
                      Reset mặc định
                    </button>
                  </div>
                  <div className="grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                    {Object.entries(weights).map(([key, value]) => (
                      <label key={key} className="text-[11px] font-medium text-muted-foreground">
                        <span className="flex justify-between gap-2">
                          <span>{weightLabel(key)}</span>
                          <span className="tabular-nums">{value.toFixed(2)}</span>
                        </span>
                        <input
                          type="range"
                          min={0}
                          max={0.4}
                          step={0.01}
                          value={value}
                          onChange={(e) => setWeights((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                          className="mt-0.5 w-full accent-primary"
                        />
                      </label>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Generate button */}
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <button
                type="button"
                disabled={busy}
                onClick={generateSets}
                className="rounded-xl bg-primary px-5 py-2.5 text-sm font-semibold text-primary-foreground shadow-sm transition-all hover:bg-primary/90 hover:shadow-md active:scale-[0.97] disabled:opacity-50"
              >
                {busy ? "⏳ Đang sinh..." : "🎲 Sinh dãy số"}
              </button>
              {message && <span className="text-sm text-muted-foreground">{message}</span>}
            </div>
          </div>

          {/* Generated Results */}
          {run && (
            <div className="rounded-xl border border-border/50 bg-background p-5">
              <h4 className="text-sm font-semibold">🎯 Kết quả sinh ({run.sets.length} bộ)</h4>
              <div className="mt-3 grid gap-3">
                {run.sets.map((set) => (
                  <div key={set.id} className="rounded-lg border border-border/50 bg-muted/10 p-3 transition-colors hover:bg-muted/20">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                          {set.rank}
                        </span>
                        <NumberChips numbers={set.mainNumbers} />
                        {set.bonusNumbers.length > 0 && (
                          <span className="flex items-center gap-1 text-xs text-muted-foreground">
                            + <NumberChips numbers={set.bonusNumbers} variant="muted" />
                          </span>
                        )}
                      </div>
                      <span className="rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-medium text-emerald-700">
                        {set.score.toFixed(3)}
                      </span>
                    </div>
                    {/* Signal breakdown */}
                    {set.explanation?.signals && (
                      <div className="mt-2 flex flex-wrap gap-1">
                        {Object.entries(set.explanation.signals).map(([sig, nums]) => (
                          <span key={sig} className="rounded bg-muted/30 px-1.5 py-0.5 text-[10px] text-muted-foreground">
                            {sig}: [{(nums as number[]).join(",")}]
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                ))}
              </div>
              {/* Japanese sentence for learning */}
              {run.japaneseSentence?.textJp && (
                <div className="mt-4 rounded-lg bg-primary/5 p-3">
                  <p className="text-xs font-semibold text-primary">📝 Câu tiếng Nhật kèm theo</p>
                  <p className="mt-1 text-sm leading-relaxed">{run.japaneseSentence.textJp}</p>
                  {run.japaneseSentence.reading && (
                    <p className="text-xs text-muted-foreground">{run.japaneseSentence.reading}</p>
                  )}
                  <p className="mt-0.5 text-xs text-muted-foreground">{run.japaneseSentence.textVi}</p>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Right: Data Health Sidebar */}
        <aside className="rounded-xl border border-border/50 bg-background p-4">
          <h4 className="text-sm font-semibold">📊 Sức khỏe dữ liệu</h4>
          {summary ? (
            <div className="mt-3 space-y-3 text-sm">
              <p className="flex justify-between gap-3">
                <span className="text-muted-foreground">Số kỳ đã nhập</span>
                <strong className="tabular-nums">{summary.drawCount}</strong>
              </p>
              <p className="flex justify-between gap-3">
                <span className="text-muted-foreground">Kỳ cuối</span>
                <strong className="tabular-nums text-right">
                  {summary.lastDraw ? `#${summary.lastDraw.drawNumber} (${summary.lastDraw.drawDate})` : "—"}
                </strong>
              </p>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">🔥 Hot numbers</p>
                <NumberChips numbers={summary.hotNumbers ?? []} />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">❄️ Cold numbers</p>
                <NumberChips numbers={summary.coldNumbers ?? []} variant="muted" />
              </div>
              <div>
                <p className="mb-1.5 text-xs font-medium text-muted-foreground">⏰ Overdue numbers</p>
                <NumberChips numbers={summary.overdueNumbers ?? []} />
              </div>
              {summary.drawCount < 20 && (
                <div className="rounded-lg bg-amber-500/10 p-2.5 text-xs text-amber-700">
                  ⚠️ Cần ≥20 kỳ để thuật toán chính xác hơn. Hiện có {summary.drawCount} kỳ.
                </div>
              )}
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">Đang tải...</p>
          )}
        </aside>
      </div>
    </AdminSection>
  );
}

/* ─── Data Tab (Import CSV + History) ─── */

function DataTab({ game, labels }: { game: LotoGame; labels: any }) {
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [summary, setSummary] = useState<LotoSummary | null>(null);
  const [recentDraws, setRecentDraws] = useState<DrawResult[]>([]);

  const loadData = useCallback(async () => {
    try {
      const [summaryRes, drawsRes] = await Promise.all([
        adminApiFetch(`/api/admin/magazine/loto/summary?game=${game}`),
        adminApiFetch(`/api/admin/magazine/loto/draws?game=${game}&limit=20`),
      ]);
      if (summaryRes.ok) setSummary(await summaryRes.json());
      if (drawsRes.ok) setRecentDraws(await drawsRes.json());
    } catch {}
  }, [game]);

  useEffect(() => { void loadData(); }, [loadData]);

  const importCsv = async (file: File | null) => {
    if (!file) return;
    setBusy(true);
    setMessage(null);
    try {
      const csvText = await file.text();
      const res = await adminApiFetch("/api/admin/magazine/loto/import-csv", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game, csvText }),
      });
      if (!res.ok) throw new Error("import failed");
      const result = (await res.json()) as { created: number; updated: number; total: number };
      setMessage(`✅ Nhập thành công: ${result.created} mới, ${result.updated} cập nhật (tổng ${result.total})`);
      await loadData();
    } catch {
      setMessage("❌ Lỗi khi nhập file CSV");
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminSection>
      <div className="space-y-5">
        {/* Import section */}
        <div className="rounded-xl border border-border/50 bg-gradient-to-br from-blue-500/[0.02] to-transparent p-5">
          <h3 className="text-sm font-semibold">📥 Nhập lịch sử Loto6 / Loto7</h3>
          <p className="mt-1 text-xs text-muted-foreground">
            Upload file CSV từ trang chủ Loto Nhật (mizuho-bank). Format: drawNumber, drawDate, num1, num2, ..., bonus1, ...
          </p>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <label className="cursor-pointer rounded-xl border-2 border-dashed border-border bg-background px-5 py-3 text-sm font-medium text-foreground transition-all hover:border-primary/50 hover:bg-primary/5 active:scale-[0.97]">
              📎 Chọn file CSV ({game === "loto6" ? "Loto6" : "Loto7"})
              <input type="file" accept=".csv,text/csv" className="sr-only" disabled={busy} onChange={(e) => void importCsv(e.target.files?.[0] ?? null)} />
            </label>
            {busy && <span className="text-sm text-muted-foreground">⏳ Đang xử lý...</span>}
            {message && <span className="text-sm">{message}</span>}
          </div>
        </div>

        {/* Summary stats */}
        {summary && (
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <div className="rounded-xl border border-border bg-surface p-3 text-center">
              <p className="text-2xl font-bold">{summary.drawCount}</p>
              <p className="text-[11px] text-muted-foreground">Tổng kỳ</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3 text-center">
              <p className="text-2xl font-bold">{summary.lastDraw?.drawNumber ?? "—"}</p>
              <p className="text-[11px] text-muted-foreground">Kỳ cuối</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3 text-center">
              <p className="text-2xl font-bold">{summary.hotNumbers?.length ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">Hot numbers</p>
            </div>
            <div className="rounded-xl border border-border bg-surface p-3 text-center">
              <p className="text-2xl font-bold">{summary.overdueNumbers?.length ?? 0}</p>
              <p className="text-[11px] text-muted-foreground">Overdue</p>
            </div>
          </div>
        )}

        {/* Recent draws list */}
        {recentDraws.length > 0 && (
          <div>
            <h4 className="mb-2 text-xs font-semibold text-muted-foreground">📋 Lịch sử gần đây ({recentDraws.length} kỳ)</h4>
            <div className="space-y-1.5">
              {recentDraws.map((d) => (
                <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border/30 bg-muted/5 px-3 py-2 text-sm">
                  <span className="min-w-[50px] font-semibold tabular-nums">#{d.drawNumber}</span>
                  <span className="min-w-[80px] text-xs text-muted-foreground">{d.drawDate}</span>
                  <span className="flex flex-wrap gap-0.5">
                    {d.mainNumbers.map((n, i) => (
                      <span key={i} className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-[10px] font-bold text-primary">
                        {n}
                      </span>
                    ))}
                    {d.bonusNumbers.map((n, i) => (
                      <span key={`b${i}`} className="inline-flex size-5 items-center justify-center rounded-full border border-muted text-[9px] text-muted-foreground">
                        {n}
                      </span>
                    ))}
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}
      </div>
    </AdminSection>
  );
}

/* ─── Weight Labels ─── */

function weightLabel(key: string): string {
  const map: Record<string, string> = {
    frequencyHot: "🔥 Tần suất Hot",
    frequencyCold: "❄️ Tần suất Cold",
    overdue: "⏰ Overdue",
    recentMomentum: "📈 Momentum gần",
    pairAffinity: "🔗 Cặp liên kết",
    gapPattern: "📐 Pattern khoảng cách",
    positionBias: "📍 Vị trí bias",
    weatherBias: "☁️ Thời tiết",
    dreamTextBias: "💭 Giấc mơ",
    dateNumerology: "🔢 Số học ngày",
    randomEntropy: "🎲 Entropy ngẫu nhiên",
  };
  return map[key] ?? key;
}

/* ─── Predictions Tab ─── */

function PredictionsTab({ game, labels }: { game: LotoGame; labels?: LotoLabLabels }) {
  const [items, setItems] = useState<PredictionItem[]>([]);
  const [filter, setFilter] = useState<string>("");
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const qs = new URLSearchParams({ game });
      if (filter) qs.set("status", filter);
      const res = await adminApiFetch(`/api/admin/magazine/loto/predictions?${qs.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setItems(data.data ?? []);
      }
    } catch {}
    setLoading(false);
  }, [game, filter]);

  useEffect(() => { void load(); }, [load]);

  const approve = async (id: string) => {
    await adminApiFetch(`/api/admin/magazine/loto/predictions/${id}/approve`, { method: "PUT" });
    await load();
  };

  const reject = async (id: string) => {
    await adminApiFetch(`/api/admin/magazine/loto/predictions/${id}/reject`, { method: "PUT" });
    await load();
  };

  return (
    <AdminSection>
      <div className="mb-4 flex items-center gap-2">
        {["", "pending", "approved", "rejected"].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              filter === f ? "bg-primary text-primary-foreground" : "bg-muted/20 text-muted-foreground hover:bg-muted/40"
            }`}
          >
            {f === "" ? (labels?.filterAll ?? "All") : f.charAt(0).toUpperCase() + f.slice(1)}
          </button>
        ))}
      </div>

      {loading && <p className="text-sm text-muted-foreground">Đang tải…</p>}

      <div className="space-y-3">
        {items.map((item) => {
          const content = item.contentJson ?? {};
          const sets = content.sets ?? content.generatedSets ?? [];
          const jpSentence = content.japaneseSentence ?? content.jpSentence;
          return (
            <div key={item.id} className="rounded-xl border border-border bg-surface p-4">
              <div className="flex items-center justify-between gap-2">
                <div>
                  <span className="text-sm font-semibold">{item.contentDate}</span>
                  <span className={`ml-2 rounded-full px-2 py-0.5 text-xs font-medium ${
                    item.approvalStatus === "approved" ? "bg-green-100 text-green-700" :
                    item.approvalStatus === "rejected" ? "bg-red-100 text-red-700" :
                    item.approvalStatus === "pending" ? "bg-amber-100 text-amber-700" :
                    "bg-blue-100 text-blue-700"
                  }`}>
                    {item.approvalStatus}
                  </span>
                </div>
                <div className="flex gap-1.5">
                  {item.approvalStatus !== "approved" && (
                    <button
                      onClick={() => approve(item.id)}
                      className="rounded-lg bg-green-500/10 px-3 py-1.5 text-xs font-medium text-green-700 hover:bg-green-500/20"
                    >
                      ✓ {labels?.approve ?? "Approve"}
                    </button>
                  )}
                  {item.approvalStatus !== "rejected" && (
                    <button
                      onClick={() => reject(item.id)}
                      className="rounded-lg bg-red-500/10 px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-500/20"
                    >
                      ✗ {labels?.reject ?? "Reject"}
                    </button>
                  )}
                </div>
              </div>
              {/* Sets preview */}
              {sets.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-1">
                  {(sets[0]?.mainNumbers ?? []).map((n: number, i: number) => (
                    <span key={i} className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                      {n}
                    </span>
                  ))}
                </div>
              )}
              {jpSentence?.textJp && (
                <p className="mt-2 text-sm text-muted-foreground">「{jpSentence.textJp}」</p>
              )}
            </div>
          );
        })}
      </div>
    </AdminSection>
  );
}

/* ─── Results Tab ─── */

function ResultsTab({ game, labels }: { game: LotoGame; labels?: LotoLabLabels }) {
  const [drawNumber, setDrawNumber] = useState("");
  const [drawDate, setDrawDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [mainNumbers, setMainNumbers] = useState("");
  const [bonusNumbers, setBonusNumbers] = useState("");
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [recentDraws, setRecentDraws] = useState<DrawResult[]>([]);

  const loadDraws = useCallback(async () => {
    try {
      const res = await adminApiFetch(`/api/admin/magazine/loto/draws?game=${game}&limit=10`);
      if (res.ok) setRecentDraws(await res.json());
    } catch {}
  }, [game]);

  useEffect(() => { void loadDraws(); }, [loadDraws]);

  const saveResult = async () => {
    setSaving(true);
    setMessage(null);
    try {
      const nums = mainNumbers.split(/[,\s]+/).map(Number).filter((n) => n > 0);
      const bonus = bonusNumbers.split(/[,\s]+/).map(Number).filter((n) => n > 0);
      const res = await adminApiFetch("/api/admin/magazine/loto/predictions/results", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ game, drawNumber: Number(drawNumber), drawDate, mainNumbers: nums, bonusNumbers: bonus }),
      });
      if (res.ok) {
        setMessage("Đã lưu kết quả!");
        setDrawNumber("");
        setMainNumbers("");
        setBonusNumbers("");
        await loadDraws();
      } else {
        const err = await res.json().catch(() => ({}));
        setMessage(err.message ?? "Lỗi khi lưu");
      }
    } catch {
      setMessage("Lỗi khi lưu kết quả.");
    }
    setSaving(false);
  };

  return (
    <AdminSection>
      <h3 className="mb-4 text-sm font-semibold">🎯 {labels?.inputResult ?? "Nhập kết quả kỳ mới"}</h3>
      <div className="grid gap-3 sm:grid-cols-2">
        <div>
          <label className="text-xs text-muted-foreground">{labels?.drawNumber ?? "Kỳ số"}</label>
          <input
            type="number"
            value={drawNumber}
            onChange={(e) => setDrawNumber(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="1984"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{labels?.drawDate ?? "Ngày quay"}</label>
          <input
            type="date"
            value={drawDate}
            onChange={(e) => setDrawDate(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{labels?.mainNumbers ?? "Main numbers"} ({game === "loto6" ? 6 : 7})</label>
          <input
            type="text"
            value={mainNumbers}
            onChange={(e) => setMainNumbers(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="7, 14, 20, 31, 38, 41"
          />
        </div>
        <div>
          <label className="text-xs text-muted-foreground">{labels?.bonusNumbers ?? "Bonus numbers"} ({game === "loto6" ? 1 : 2})</label>
          <input
            type="text"
            value={bonusNumbers}
            onChange={(e) => setBonusNumbers(e.target.value)}
            className="mt-1 w-full rounded-lg border border-border bg-background px-3 py-2 text-sm"
            placeholder="15"
          />
        </div>
      </div>
      <button
        onClick={saveResult}
        disabled={saving}
        className="mt-4 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50"
      >
        💾 {labels?.save ?? "Lưu kết quả"}
      </button>
      {message && <p className="mt-2 text-sm text-muted-foreground">{message}</p>}

      {/* Recent draws */}
      <div className="mt-6">
        <h4 className="mb-2 text-xs font-semibold text-muted-foreground">Kết quả gần đây</h4>
        <div className="space-y-2">
          {recentDraws.map((d) => (
            <div key={d.id} className="flex items-center gap-3 rounded-lg border border-border/50 bg-muted/10 px-3 py-2 text-sm">
              <span className="font-semibold">#{d.drawNumber}</span>
              <span className="text-muted-foreground">{d.drawDate}</span>
              <span className="flex flex-wrap gap-1">
                {d.mainNumbers.map((n, i) => (
                  <span key={i} className="inline-flex size-6 items-center justify-center rounded-full bg-primary/10 text-xs font-bold text-primary">
                    {n}
                  </span>
                ))}
                {d.bonusNumbers.map((n, i) => (
                  <span key={`b${i}`} className="inline-flex size-5 items-center justify-center rounded-full border border-muted text-[10px] text-muted-foreground">
                    {n}
                  </span>
                ))}
              </span>
              <span className="text-xs text-green-600">✓</span>
            </div>
          ))}
        </div>
      </div>
    </AdminSection>
  );
}

/* ─── Analytics Tab ─── */

function AnalyticsTab({ game, labels }: { game: LotoGame; labels?: LotoLabLabels }) {
  const [analytics, setAnalytics] = useState<Analytics | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    setLoading(true);
    adminApiFetch(`/api/admin/magazine/loto/predictions/analytics?game=${game}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => { setAnalytics(data); setLoading(false); })
      .catch(() => setLoading(false));
  }, [game]);

  if (loading) return <p className="text-sm text-muted-foreground">Đang tải…</p>;
  if (!analytics) return <p className="text-sm text-muted-foreground">Không có dữ liệu.</p>;

  return (
    <AdminSection>
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label={labels?.totalPredictions ?? "Tổng kỳ dự đoán"} value={analytics.totalPredictions} />
        <StatCard label={labels?.avgHitRate ?? "Tỷ lệ trúng TB"} value={`${analytics.avgHitRate}/${game === "loto6" ? 6 : 7}`} />
        <StatCard label={labels?.bestHit ?? "Kỳ trúng cao nhất"} value={`${analytics.bestHit}/${game === "loto6" ? 6 : 7} (#${analytics.bestDrawNumber ?? "?"})`} />
        <StatCard label={labels?.totalViews ?? "Lượt xem"} value={analytics.totalViews} />
      </div>

      {/* Hit distribution */}
      <div className="mt-6">
        <h4 className="mb-3 text-sm font-semibold">Phân bố số trúng</h4>
        <div className="flex items-end gap-2">
          {Array.from({ length: (game === "loto6" ? 7 : 8) }, (_, i) => {
            const count = analytics.hitDistribution[i] ?? 0;
            const maxCount = Math.max(1, ...Object.values(analytics.hitDistribution));
            const height = Math.max(4, (count / maxCount) * 100);
            return (
              <div key={i} className="flex flex-col items-center gap-1">
                <span className="text-[10px] text-muted-foreground">{count}</span>
                <div
                  className="w-8 rounded-t bg-primary/60"
                  style={{ height: `${height}px` }}
                />
                <span className="text-xs font-medium">{i}</span>
              </div>
            );
          })}
        </div>
        <p className="mt-1 text-[10px] text-muted-foreground">Trục X: số trúng | Trục Y: số kỳ</p>
      </div>
    </AdminSection>
  );
}

function StatCard({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold">{value}</p>
    </div>
  );
}
