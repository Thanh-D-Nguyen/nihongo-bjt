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
  kindBjtPhrase: string;
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
  { value: "magazine_loto", icon: "🎰" },
  { value: "magazine_bjt_phrase", icon: "💼" },
] as const;

const learnerBaseUrl = (process.env.NEXT_PUBLIC_WEB_PUBLIC_URL ?? "http://localhost:3000").replace(/\/$/u, "");

function buildMagazineSlug(date: string, widgetKind: string, locale: string): string {
  return `${date}-${widgetKind.replace("magazine_", "")}-${locale}`;
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
