"use client";

import {
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh,
  AdminEmptyState,
  AdminPageHeader,
  AdminSection,
  AdminStatusBadge,
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { adminApiFetch } from "@/lib/admin-api";

/* ─── Types ─── */

interface MagazineLabels {
  title: string;
  subtitle: string;
  eyebrow: string;
  loading: string;
  error: string;
  empty: string;
  colTitle: string;
  colKind: string;
  colDate: string;
  colStatus: string;
  colJlpt: string;
  colActions: string;
  generate: string;
  regenerate: string;
  delete: string;
  confirmDelete: string;
  generateTitle: string;
  generateDescription: string;
  fieldKind: string;
  fieldDate: string;
  fieldLocale: string;
  generating: string;
  generateSuccess: string;
  generateExists: string;
  viewOnLearner: string;
  regenerating: string;
  regenerateSuccess: string;
  deleteSuccess: string;
  statusPublished: string;
  statusDraft: string;
  kindVocab: string;
  kindWeather: string;
  kindHoroscope: string;
  kindLoto: string;
  kindLoto6: string;
  kindLoto7: string;
  kindBjtPhrase: string;
  lotoLabTitle: string;
  lotoLabDescription: string;
  lotoImportCsv: string;
  lotoGenerateSets: string;
  lotoSetCount: string;
  lotoSeed: string;
  lotoWeather: string;
  lotoDream: string;
  lotoLuckyText: string;
  lotoPinned: string;
  lotoExcluded: string;
  lotoDataHealth: string;
  lotoDrawCount: string;
  lotoLastDraw: string;
  lotoHot: string;
  lotoCold: string;
  lotoOverdue: string;
  lotoGeneratedSets: string;
  lotoJapaneseSentence: string;
  lotoImportSuccess: string;
  lotoNeedData: string;
}

interface MagazineArticle {
  id: string;
  slug: string;
  widgetKind: string;
  titleJp: string;
  titleVi: string;
  contentDate: string;
  jlptLevel: string | null;
  status: string;
  createdAt: string;
}

interface ListResponse {
  data: MagazineArticle[];
  total: number;
  page: number;
  limit: number;
}

const KIND_OPTIONS = [
  { value: "magazine_vocab", icon: "🌸" },
  { value: "magazine_weather", icon: "☀️" },
  { value: "magazine_horoscope", icon: "⭐" },
  { value: "magazine_loto6", icon: "⑥" },
  { value: "magazine_loto7", icon: "⑦" },
  { value: "magazine_bjt_phrase", icon: "💼" },
] as const;

type LotoGame = "loto6" | "loto7";

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

const DEFAULT_WEIGHTS = {
  frequencyHot: 0.2,
  frequencyCold: 0.08,
  overdue: 0.16,
  recentMomentum: 0.14,
  pairAffinity: 0.12,
  weatherBias: 0.08,
  dreamTextBias: 0.08,
  dateNumerology: 0.06,
  randomEntropy: 0.08,
};

const learnerBaseUrl = (process.env.NEXT_PUBLIC_WEB_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/u, "");

function buildMagazineSlug(date: string, widgetKind: string, locale: string): string {
  return `${date}-${widgetKind.replace("magazine_", "")}-${locale}`;
}

function parseNumberList(value: string): number[] {
  return value
    .split(/[,\s]+/u)
    .map((item) => Number(item.trim()))
    .filter((item) => Number.isInteger(item) && item > 0);
}

function NumberChips({ numbers }: { numbers: number[] }) {
  return (
    <span className="inline-flex flex-wrap gap-1">
      {numbers.map((number) => (
        <span key={number} className="inline-flex size-7 items-center justify-center rounded-full bg-primary/10 text-xs font-semibold text-primary">
          {number}
        </span>
      ))}
    </span>
  );
}

function LotoLabPanel({ labels }: { labels: MagazineLabels }) {
  const [game, setGame] = useState<LotoGame>("loto6");
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
      setMessage(labels.lotoImportSuccess.replace("{total}", String(result.total)));
      await loadSummary();
    } catch {
      setMessage(labels.error);
    } finally {
      setBusy(false);
    }
  };

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
          weatherText,
          dreamText,
          luckyText,
          pinnedNumbers: parseNumberList(pinnedNumbers),
          excludedNumbers: parseNumberList(excludedNumbers),
        }),
      });
      if (!res.ok) throw new Error("generate failed");
      setRun((await res.json()) as LotoRun);
      await loadSummary();
    } catch {
      setMessage(summary && summary.drawCount < 10 ? labels.lotoNeedData : labels.error);
    } finally {
      setBusy(false);
    }
  };

  return (
    <AdminSection>
      <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <h3 className="text-sm font-semibold">{labels.lotoLabTitle}</h3>
          <p className="mt-1 text-sm text-muted-foreground">{labels.lotoLabDescription}</p>
        </div>
        <select
          value={game}
          onChange={(event) => setGame(event.target.value as LotoGame)}
          className="min-h-[40px] rounded-md border border-border bg-background px-3 py-2 text-sm"
        >
          <option value="loto6">Loto6</option>
          <option value="loto7">Loto7</option>
        </select>
      </div>

      <div className="mt-5 grid grid-cols-1 gap-4 lg:grid-cols-[minmax(0,1fr)_minmax(320px,420px)]">
        <div className="space-y-4">
          <div className="rounded-lg border border-border/50 bg-muted/20 p-4">
            <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
              <label className="text-xs font-medium text-muted-foreground">
                {labels.fieldDate}
                <input type="date" value={targetDrawDate} onChange={(e) => setTargetDrawDate(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                {labels.lotoSetCount}
                <input type="number" min={1} max={5} value={setCount} onChange={(e) => setSetCount(Number(e.target.value))} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                {labels.lotoSeed}
                <input value={seed} onChange={(e) => setSeed(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </label>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-2">
              <label className="text-xs font-medium text-muted-foreground">
                {labels.lotoWeather}
                <input value={weatherText} onChange={(e) => setWeatherText(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                {labels.lotoDream}
                <input value={dreamText} onChange={(e) => setDreamText(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </label>
              <label className="text-xs font-medium text-muted-foreground">
                {labels.lotoLuckyText}
                <input value={luckyText} onChange={(e) => setLuckyText(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
              </label>
              <div className="grid grid-cols-2 gap-3">
                <label className="text-xs font-medium text-muted-foreground">
                  {labels.lotoPinned}
                  <input value={pinnedNumbers} onChange={(e) => setPinnedNumbers(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </label>
                <label className="text-xs font-medium text-muted-foreground">
                  {labels.lotoExcluded}
                  <input value={excludedNumbers} onChange={(e) => setExcludedNumbers(e.target.value)} className="mt-1 w-full rounded-md border border-border bg-background px-3 py-2 text-sm" />
                </label>
              </div>
            </div>

            <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
              {Object.entries(weights).map(([key, value]) => (
                <label key={key} className="text-xs font-medium text-muted-foreground">
                  <span className="flex justify-between gap-2"><span>{key}</span><span>{value.toFixed(2)}</span></span>
                  <input
                    type="range"
                    min={0}
                    max={0.5}
                    step={0.01}
                    value={value}
                    onChange={(e) => setWeights((prev) => ({ ...prev, [key]: Number(e.target.value) }))}
                    className="mt-1 w-full"
                  />
                </label>
              ))}
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-3">
              <button type="button" disabled={busy} onClick={generateSets} className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90 disabled:opacity-50">
                {labels.lotoGenerateSets}
              </button>
              <label className="rounded-lg border border-border bg-background px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent">
                {labels.lotoImportCsv}
                <input type="file" accept=".csv,text/csv" className="sr-only" onChange={(e) => void importCsv(e.target.files?.[0] ?? null)} />
              </label>
              {message && <span className="text-sm text-muted-foreground">{message}</span>}
            </div>
          </div>

          {run && (
            <div className="rounded-lg border border-border/50 bg-background p-4">
              <h4 className="text-sm font-semibold">{labels.lotoGeneratedSets}</h4>
              <div className="mt-3 grid gap-3">
                {run.sets.map((set) => (
                  <div key={set.id} className="rounded-lg border border-border/50 bg-muted/20 p-3">
                    <div className="flex flex-wrap items-center justify-between gap-3">
                      <div className="flex items-center gap-3">
                        <span className="text-xs font-semibold text-muted-foreground">#{set.rank}</span>
                        <NumberChips numbers={set.mainNumbers} />
                        {set.bonusNumbers.length > 0 && <span className="text-xs text-muted-foreground">+ {set.bonusNumbers.join(", ")}</span>}
                      </div>
                      <span className="text-xs font-medium text-muted-foreground">score {set.score.toFixed(3)}</span>
                    </div>
                  </div>
                ))}
              </div>
              {run.japaneseSentence?.textJp && (
                <div className="mt-4 rounded-lg bg-primary/5 p-3">
                  <p className="text-xs font-semibold text-primary">{labels.lotoJapaneseSentence}</p>
                  <p className="mt-1 text-sm leading-relaxed">{run.japaneseSentence.textJp}</p>
                  <p className="text-xs text-muted-foreground">{run.japaneseSentence.textVi}</p>
                </div>
              )}
            </div>
          )}
        </div>

        <aside className="rounded-lg border border-border/50 bg-background p-4">
          <h4 className="text-sm font-semibold">{labels.lotoDataHealth}</h4>
          {summary ? (
            <div className="mt-3 space-y-3 text-sm">
              <p className="flex justify-between gap-3"><span className="text-muted-foreground">{labels.lotoDrawCount}</span><strong>{summary.drawCount}</strong></p>
              <p className="flex justify-between gap-3"><span className="text-muted-foreground">{labels.lotoLastDraw}</span><strong>{summary.lastDraw ? `${summary.lastDraw.drawNumber} / ${summary.lastDraw.drawDate}` : "-"}</strong></p>
              <div><p className="mb-1 text-xs font-medium text-muted-foreground">{labels.lotoHot}</p><NumberChips numbers={summary.hotNumbers ?? []} /></div>
              <div><p className="mb-1 text-xs font-medium text-muted-foreground">{labels.lotoCold}</p><NumberChips numbers={summary.coldNumbers ?? []} /></div>
              <div><p className="mb-1 text-xs font-medium text-muted-foreground">{labels.lotoOverdue}</p><NumberChips numbers={summary.overdueNumbers ?? []} /></div>
            </div>
          ) : (
            <p className="mt-3 text-sm text-muted-foreground">{labels.loading}</p>
          )}
        </aside>
      </div>
    </AdminSection>
  );
}

/* ─── Component ─── */

export function MagazineAdminClient({
  labels,
  locale,
}: {
  labels: MagazineLabels;
  locale: string;
}) {
  const [articles, setArticles] = useState<MagazineArticle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [showGenerate, setShowGenerate] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [genMessage, setGenMessage] = useState<string | null>(null);
  const [generatedSlug, setGeneratedSlug] = useState<string | null>(null);

  // Generate form state
  const [genKind, setGenKind] = useState("magazine_vocab");
  const [genDate, setGenDate] = useState(() => new Date().toISOString().split("T")[0]);
  const [genLocale, setGenLocale] = useState("vi");

  const kindLabel = useCallback(
    (kind: string) => {
      const map: Record<string, string> = {
        magazine_vocab: labels.kindVocab,
        magazine_weather: labels.kindWeather,
        magazine_horoscope: labels.kindHoroscope,
        magazine_loto: labels.kindLoto,
        magazine_loto6: labels.kindLoto6,
        magazine_loto7: labels.kindLoto7,
        magazine_bjt_phrase: labels.kindBjtPhrase,
      };
      return map[kind] ?? kind;
    },
    [labels],
  );

  const loadArticles = useCallback(async () => {
    setLoading(true);
    setError(false);
    try {
      const res = await adminApiFetch(`/api/admin/magazine?locale=${locale}&limit=50`);
      if (!res.ok) throw new Error("fetch failed");
      const data = (await res.json()) as ListResponse;
      setArticles(data.data);
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, [locale]);

  useEffect(() => {
    void loadArticles();
  }, [loadArticles]);

  const handleGenerate = async () => {
    setGenerating(true);
    setGenMessage(null);
    setGeneratedSlug(null);
    try {
      const res = await adminApiFetch("/api/admin/magazine/generate", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ widgetKind: genKind, date: genDate, locale: genLocale }),
      });
      if (!res.ok) throw new Error("generate failed");
      const result = (await res.json()) as { id: string | null; generated: boolean };
      setGenMessage(result.generated ? labels.generateSuccess : labels.generateExists);
      setGeneratedSlug(buildMagazineSlug(genDate, genKind, genLocale));
      if (result.generated) {
        void loadArticles();
      }
    } catch {
      setGenMessage(labels.error);
    } finally {
      setGenerating(false);
    }
  };

  const handleRegenerate = async (slug: string) => {
    try {
      const res = await adminApiFetch(`/api/admin/magazine/${slug}/regenerate`, { method: "POST" });
      if (!res.ok) throw new Error("regenerate failed");
      void loadArticles();
    } catch {
      setError(true);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm(labels.confirmDelete)) return;
    try {
      const res = await adminApiFetch(`/api/admin/magazine/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      setArticles((prev) => prev.filter((a) => a.id !== id));
    } catch {
      setError(true);
    }
  };

  return (
    <div className="space-y-6">
      <AdminPageHeader breadcrumbs={labels.eyebrow} title={labels.title} description={labels.subtitle} />

      {/* Generate Panel */}
      <AdminSection>
        <div className="flex items-center justify-between">
          <h3 className="text-sm font-semibold">{labels.generateTitle}</h3>
          <button
            type="button"
            onClick={() => setShowGenerate(!showGenerate)}
            className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            {labels.generate}
          </button>
        </div>

        {showGenerate && (
          <div className="mt-4 space-y-4 rounded-lg border border-border/50 bg-muted/30 p-4">
            <p className="text-sm text-muted-foreground">{labels.generateDescription}</p>
            <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {labels.fieldKind}
                </label>
                <select
                  value={genKind}
                  onChange={(e) => setGenKind(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  {KIND_OPTIONS.map((k) => (
                    <option key={k.value} value={k.value}>
                      {k.icon} {kindLabel(k.value)}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {labels.fieldDate}
                </label>
                <input
                  type="date"
                  value={genDate}
                  onChange={(e) => setGenDate(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="mb-1 block text-xs font-medium text-muted-foreground">
                  {labels.fieldLocale}
                </label>
                <select
                  value={genLocale}
                  onChange={(e) => setGenLocale(e.target.value)}
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm"
                >
                  <option value="vi">Tiếng Việt</option>
                  <option value="ja">日本語</option>
                  <option value="en">English</option>
                </select>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <button
                type="button"
                disabled={generating}
                onClick={handleGenerate}
                className="rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-50 transition-colors"
              >
                {generating ? labels.generating : labels.generate}
              </button>
              {genMessage && (
                <span className="text-sm text-muted-foreground">{genMessage}</span>
              )}
              {generatedSlug && (
                <a
                  href={`${learnerBaseUrl}/${genLocale}/magazine/${generatedSlug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="text-sm font-medium text-primary underline-offset-4 hover:underline"
                >
                  {labels.viewOnLearner}
                </a>
              )}
            </div>
          </div>
        )}
      </AdminSection>

      <LotoLabPanel labels={labels} />

      {/* Articles Table */}
      <AdminSection>
        {loading ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{labels.loading}</p>
        ) : error ? (
          <p className="py-8 text-center text-sm text-destructive">{labels.error}</p>
        ) : articles.length === 0 ? (
          <AdminEmptyState
            title={labels.empty}
          />
        ) : (
          <AdminDataTable>
            <AdminDataTableHead>
              <AdminDataTableTh>{labels.colDate}</AdminDataTableTh>
              <AdminDataTableTh>{labels.colKind}</AdminDataTableTh>
              <AdminDataTableTh>{labels.colTitle}</AdminDataTableTh>
              <AdminDataTableTh>{labels.colJlpt}</AdminDataTableTh>
              <AdminDataTableTh>{labels.colStatus}</AdminDataTableTh>
              <AdminDataTableTh>{labels.colActions}</AdminDataTableTh>
            </AdminDataTableHead>
            <AdminDataTableBody>
              {articles.map((article) => (
                <AdminDataTableRow key={article.id}>
                  <AdminDataTableTd>
                    {new Date(article.contentDate).toLocaleDateString(locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "vi-VN")}
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <span className="inline-flex items-center gap-1.5">
                      <span>{KIND_OPTIONS.find((k) => k.value === article.widgetKind)?.icon ?? "📄"}</span>
                      <span className="text-xs">{kindLabel(article.widgetKind)}</span>
                    </span>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <div>
                      <p className="font-medium text-sm">{article.titleJp}</p>
                      <p className="text-xs text-muted-foreground">{article.titleVi}</p>
                    </div>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    {article.jlptLevel && (
                      <span className="rounded bg-primary/10 px-1.5 py-0.5 text-xs font-medium text-primary">
                        {article.jlptLevel}
                      </span>
                    )}
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <AdminStatusBadge
                      tone={article.status === "published" ? "good" : "neutral"}
                    >
                      {article.status === "published" ? labels.statusPublished : labels.statusDraft}
                    </AdminStatusBadge>
                  </AdminDataTableTd>
                  <AdminDataTableTd>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => handleRegenerate(article.slug)}
                        className="rounded px-2 py-1 text-xs font-medium text-primary hover:bg-primary/10 transition-colors"
                        title={labels.regenerate}
                      >
                        🔄
                      </button>
                      <button
                        type="button"
                        onClick={() => handleDelete(article.id)}
                        className="rounded px-2 py-1 text-xs font-medium text-destructive hover:bg-destructive/10 transition-colors"
                        title={labels.delete}
                      >
                        🗑️
                      </button>
                    </div>
                  </AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
      </AdminSection>
    </div>
  );
}
