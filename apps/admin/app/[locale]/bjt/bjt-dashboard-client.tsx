"use client";

import {
  AdminChartCard,
  AdminDataTable,
  AdminDataTableBody,
  AdminDataTableHead,
  AdminDataTableRow,
  AdminDataTableTd,
  AdminDataTableTh,
  AdminEmptyState,
  AdminKpiCard,
  AdminPageHeader,
  AdminSection,
  AdminStatusBadge
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";
import { Bar, BarChart, CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

import { adminApiFetch } from "@/lib/admin-api";

type Labels = Record<string, string>;

type Summary = {
  generatedAt: string;
  range: { recentDays: number };
  kpis: {
    learnersTotal: number;
    learnersByLevel: { level: string; count: number }[];
    publishedMockExams: number;
    sessionsRecent: number;
    sessionsCompletedRecent: number;
    passRateRecent: number | null;
    avgScoreRecent: number | null;
  };
  passRateByLevelRecent: { level: string; sessions: number; passes: number; passRate: number | null }[];
  passRateTimeseries: { weekStart: string; sessions: number; passes: number; passRate: number | null }[];
  topTopicsRecent: { skillTag: string; attempts: number; correct: number; accuracy: number | null }[];
  upcomingMockExams: {
    id: string;
    slug: string;
    titleVi: string;
    titleJa: string | null;
    level: string | null;
    type: string;
    status: string;
    scheduledAt: string | null;
    timeLimitSeconds: number | null;
  }[];
  dropOffSections: {
    sectionCode: string;
    sectionTitleVi: string;
    testTitleVi: string;
    answeredQuestions: number;
    accuracy: number | null;
  }[];
  freshness: { lastSessionAt: string | null; lastQuestionAt: string | null };
};

function fmtPct(n: number | null): string {
  if (n == null || !isFinite(n)) return "—";
  return `${(n * 100).toFixed(1)}%`;
}
function fmtInt(n: number | null | undefined): string {
  if (n == null || !isFinite(n)) return "—";
  return new Intl.NumberFormat("vi-VN").format(Math.round(n));
}
function fmtDate(iso: string | null, locale: string): string {
  if (!iso) return "—";
  try {
    return new Intl.DateTimeFormat(locale === "ja" ? "ja-JP" : locale === "en" ? "en-US" : "vi-VN", {
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      month: "short",
      year: "numeric"
    }).format(new Date(iso));
  } catch {
    return iso;
  }
}
function fmtDuration(seconds: number | null): string {
  if (seconds == null || seconds <= 0) return "—";
  const mins = Math.round(seconds / 60);
  if (mins < 60) return `${mins} phút`;
  const hh = Math.floor(mins / 60);
  const mm = mins % 60;
  return mm > 0 ? `${hh}h ${mm}p` : `${hh}h`;
}

function passRateTone(n: number | null): "good" | "warning" | "danger" | "neutral" {
  if (n == null) return "neutral";
  if (n >= 0.8) return "good";
  if (n >= 0.6) return "warning";
  return "danger";
}

export function BjtDashboardClient({ labels, locale }: { labels: Labels; locale: string }) {
  const t = (k: string) => labels[k] ?? k;
  const [summary, setSummary] = useState<Summary | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const r = await adminApiFetch("/api/admin/bjt/summary");
      if (!r.ok) {
        setError(t("errorLoad"));
        setSummary(null);
        return;
      }
      setSummary((await r.json()) as Summary);
    } catch {
      setError(t("errorLoad"));
    } finally {
      setLoading(false);
    }
  }, [t]);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <div className="space-y-6 p-6">
      <AdminPageHeader
        actions={
          <button
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={loading}
            onClick={() => void load()}
            type="button"
          >
            {t("refresh")}
          </button>
        }
        description={t("subtitle")}
        title={t("title")}
      />

      {error ? (
        <AdminEmptyState title={t("errorLoad")}>
          <button
            className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
            onClick={() => void load()}
            type="button"
          >
            {t("refresh")}
          </button>
        </AdminEmptyState>
      ) : null}

      {loading && !summary ? (
        <AdminSection title={t("loading")}>
          <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
            {Array.from({ length: 6 }).map((_, i) => (
              <div className="h-24 animate-pulse rounded-lg bg-slate-100" key={i} />
            ))}
          </div>
        </AdminSection>
      ) : null}

      {summary ? (
        <>
          <AdminSection
            actions={
              <div className="text-xs text-slate-500">
                <span>{t("lastSession")}: {fmtDate(summary.freshness.lastSessionAt, locale)}</span>
                <span className="mx-2">·</span>
                <span>{t("lastQuestion")}: {fmtDate(summary.freshness.lastQuestionAt, locale)}</span>
              </div>
            }
            title={t("rangeLabel")}
          >
            <div className="grid grid-cols-1 gap-3 md:grid-cols-3 lg:grid-cols-6">
              <AdminKpiCard label={t("kpiLearners")} value={fmtInt(summary.kpis.learnersTotal)} />
              <AdminKpiCard label={t("kpiPublished")} value={fmtInt(summary.kpis.publishedMockExams)} />
              <AdminKpiCard label={t("kpiSessions")} value={fmtInt(summary.kpis.sessionsRecent)} />
              <AdminKpiCard label={t("kpiCompleted")} value={fmtInt(summary.kpis.sessionsCompletedRecent)} />
              <AdminKpiCard
                label={t("kpiPassRate")}
                tone={passRateTone(summary.kpis.passRateRecent)}
                value={fmtPct(summary.kpis.passRateRecent)}
              />
              <AdminKpiCard
                label={t("kpiAvgScore")}
                tone={passRateTone(summary.kpis.avgScoreRecent)}
                value={fmtPct(summary.kpis.avgScoreRecent)}
              />
            </div>
          </AdminSection>

          <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
            <AdminChartCard title={t("learnerDistribution")}>
              {summary.kpis.learnersByLevel.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer height="100%" width="100%">
                    <BarChart data={summary.kpis.learnersByLevel}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis dataKey="level" stroke="#475569" />
                      <YAxis allowDecimals={false} stroke="#475569" />
                      <Tooltip
                        formatter={(v) => [fmtInt(typeof v === "number" ? v : null), t("count")]}
                        labelFormatter={(l) => `${t("level")}: ${l}`}
                      />
                      <Bar dataKey="count" fill="#0f766e" radius={[4, 4, 0, 0]} />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t("noData")}</p>
              )}
            </AdminChartCard>

            <AdminChartCard title={t("passRateTimeseries")}>
              {summary.passRateTimeseries.length > 0 ? (
                <div className="h-64">
                  <ResponsiveContainer height="100%" width="100%">
                    <LineChart data={summary.passRateTimeseries}>
                      <CartesianGrid stroke="#e2e8f0" strokeDasharray="3 3" />
                      <XAxis dataKey="weekStart" stroke="#475569" />
                      <YAxis
                        domain={[0, 1]}
                        stroke="#475569"
                        tickFormatter={(v) => `${Math.round(Number(v) * 100)}%`}
                      />
                      <Tooltip
                        formatter={(v) => [fmtPct(typeof v === "number" ? v : null), t("passRateValue")]}
                        labelFormatter={(l) => String(l)}
                      />
                      <Line
                        dataKey="passRate"
                        dot={{ r: 3 }}
                        stroke="#0f766e"
                        strokeWidth={2}
                        type="monotone"
                      />
                    </LineChart>
                  </ResponsiveContainer>
                </div>
              ) : (
                <p className="text-sm text-slate-500">{t("noData")}</p>
              )}
            </AdminChartCard>
          </div>

          <AdminSection title={t("passRateBy")}>
            <AdminDataTable>
              <AdminDataTableHead>
                <AdminDataTableRow>
                  <AdminDataTableTh>{t("passRateLevel")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("passRateSessions")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("passRatePasses")}</AdminDataTableTh>
                  <AdminDataTableTh>{t("passRateValue")}</AdminDataTableTh>
                </AdminDataTableRow>
              </AdminDataTableHead>
              <AdminDataTableBody>
                {summary.passRateByLevelRecent.map((r) => (
                  <AdminDataTableRow key={r.level}>
                    <AdminDataTableTd>
                      <AdminStatusBadge tone="neutral">{r.level}</AdminStatusBadge>
                    </AdminDataTableTd>
                    <AdminDataTableTd>{fmtInt(r.sessions)}</AdminDataTableTd>
                    <AdminDataTableTd>{fmtInt(r.passes)}</AdminDataTableTd>
                    <AdminDataTableTd>
                      <span className="font-medium text-slate-950">{fmtPct(r.passRate)}</span>
                    </AdminDataTableTd>
                  </AdminDataTableRow>
                ))}
              </AdminDataTableBody>
            </AdminDataTable>
          </AdminSection>

          <AdminSection title={t("topicsTitle")}>
            {summary.topTopicsRecent.length === 0 ? (
              <AdminEmptyState title={t("noData")} />
            ) : (
              <AdminDataTable>
                <AdminDataTableHead>
                  <AdminDataTableRow>
                    <AdminDataTableTh>{t("topicSkill")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("topicAttempts")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("topicCorrect")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("topicAccuracy")}</AdminDataTableTh>
                  </AdminDataTableRow>
                </AdminDataTableHead>
                <AdminDataTableBody>
                  {summary.topTopicsRecent.map((r) => (
                    <AdminDataTableRow key={r.skillTag}>
                      <AdminDataTableTd>
                        <span className="font-mono text-xs">{r.skillTag}</span>
                      </AdminDataTableTd>
                      <AdminDataTableTd>{fmtInt(r.attempts)}</AdminDataTableTd>
                      <AdminDataTableTd>{fmtInt(r.correct)}</AdminDataTableTd>
                      <AdminDataTableTd>{fmtPct(r.accuracy)}</AdminDataTableTd>
                    </AdminDataTableRow>
                  ))}
                </AdminDataTableBody>
              </AdminDataTable>
            )}
          </AdminSection>

          <AdminSection title={t("upcomingTitle")}>
            {summary.upcomingMockExams.length === 0 ? (
              <AdminEmptyState title={t("upcomingTitleEmpty")} />
            ) : (
              <AdminDataTable>
                <AdminDataTableHead>
                  <AdminDataTableRow>
                    <AdminDataTableTh>{t("title")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("upcomingLevel")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("upcomingType")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("upcomingStatus")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("upcomingScheduledAt")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("upcomingTimeLimit")}</AdminDataTableTh>
                  </AdminDataTableRow>
                </AdminDataTableHead>
                <AdminDataTableBody>
                  {summary.upcomingMockExams.map((e) => (
                    <AdminDataTableRow key={e.id}>
                      <AdminDataTableTd>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-950">{e.titleVi}</span>
                          {e.titleJa ? <span className="text-xs text-slate-500">{e.titleJa}</span> : null}
                          <span className="font-mono text-xs text-slate-400">{e.slug}</span>
                        </div>
                      </AdminDataTableTd>
                      <AdminDataTableTd>{e.level ?? "—"}</AdminDataTableTd>
                      <AdminDataTableTd>{e.type}</AdminDataTableTd>
                      <AdminDataTableTd>
                        <AdminStatusBadge tone={e.status === "published" ? "good" : "neutral"}>{e.status}</AdminStatusBadge>
                      </AdminDataTableTd>
                      <AdminDataTableTd>{fmtDate(e.scheduledAt, locale)}</AdminDataTableTd>
                      <AdminDataTableTd>{fmtDuration(e.timeLimitSeconds)}</AdminDataTableTd>
                    </AdminDataTableRow>
                  ))}
                </AdminDataTableBody>
              </AdminDataTable>
            )}
          </AdminSection>

          <AdminSection title={t("dropOffTitle")}>
            {summary.dropOffSections.length === 0 ? (
              <AdminEmptyState title={t("dropOffEmpty")} />
            ) : (
              <AdminDataTable>
                <AdminDataTableHead>
                  <AdminDataTableRow>
                    <AdminDataTableTh>{t("dropOffSection")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("dropOffTest")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("dropOffAnswers")}</AdminDataTableTh>
                    <AdminDataTableTh>{t("dropOffAccuracy")}</AdminDataTableTh>
                  </AdminDataTableRow>
                </AdminDataTableHead>
                <AdminDataTableBody>
                  {summary.dropOffSections.map((r, idx) => (
                    <AdminDataTableRow key={`${r.testTitleVi}::${r.sectionCode}::${idx}`}>
                      <AdminDataTableTd>
                        <div className="flex flex-col">
                          <span className="font-medium text-slate-950">{r.sectionTitleVi}</span>
                          <span className="font-mono text-xs text-slate-400">{r.sectionCode}</span>
                        </div>
                      </AdminDataTableTd>
                      <AdminDataTableTd>{r.testTitleVi || "—"}</AdminDataTableTd>
                      <AdminDataTableTd>{fmtInt(r.answeredQuestions)}</AdminDataTableTd>
                      <AdminDataTableTd>
                        <AdminStatusBadge tone={passRateTone(r.accuracy)}>{fmtPct(r.accuracy)}</AdminStatusBadge>
                      </AdminDataTableTd>
                    </AdminDataTableRow>
                  ))}
                </AdminDataTableBody>
              </AdminDataTable>
            )}
          </AdminSection>

          <AdminSection title={t("quickLinks")}>
            <div className="flex flex-wrap gap-2">
              <a
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href={`/${locale}/assessment/mock-exams`}
              >
                {t("quickLinkMockExams")}
              </a>
              <a
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href={`/${locale}/assessment/question-bank`}
              >
                {t("quickLinkQuestionBank")}
              </a>
              <a
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href={`/${locale}/assessment/quiz-sessions`}
              >
                {t("quickLinkQuizSessions")}
              </a>
              <a
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href={`/${locale}/assessment/quiz-templates`}
              >
                {t("quickLinkQuizTemplates")}
              </a>
              <a
                className="inline-flex items-center rounded-md border border-slate-200 bg-white px-3 py-1.5 text-sm font-medium text-slate-700 hover:bg-slate-50"
                href={`/${locale}/assessment/remediation`}
              >
                {t("quickLinkRemediation")}
              </a>
            </div>
          </AdminSection>
        </>
      ) : null}
    </div>
  );
}
