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
  AdminStatusBadge
} from "@nihongo-bjt/ui";
import { useCallback, useEffect, useState } from "react";

import { permsFromMe, type MePayload } from "@/app/_components/admin-client-utils";
import { adminApiFetch } from "@/lib/admin-api";

type CommonLabels = { empty: string; error: string; loading: string; records: string };
type Labels = Record<string, string>;

type ModuleRow = {
  category: string;
  defaultPriority: number;
  descriptionVi: string;
  id: string;
  isEnabled: boolean;
  isSpotlightEligible: boolean;
  moduleKey: string;
  moduleType: string;
  routePath: string | null;
  status: string;
  titleJa: string;
  titleVi: string;
  updatedAt: string;
  visualTheme: string | null;
};

type CardRow = {
  badgeTextVi: string | null;
  category: string;
  ctaLabelVi: string;
  descriptionVi: string;
  estimatedMinutes: number | null;
  id: string;
  isPinned: boolean;
  isSpotlight: boolean;
  levelLabel: string | null;
  moduleConfigId: string;
  moduleConfig?: { moduleKey: string; titleVi: string };
  moduleType: string;
  priority: number;
  recommendationReasonVi: string | null;
  slug: string;
  status: string;
  targetRoute: string | null;
  titleVi: string;
  updatedAt: string;
  visualTheme: string | null;
};

type Summary = {
  archivedCards: number;
  draftCards: number;
  enabledModules: number;
  publishedCards: number;
  spotlight: { id: string; titleVi: string } | null;
  totalModules: number;
};

const emptyModule = (): Partial<ModuleRow> => ({
  category: "life",
  defaultPriority: 0,
  descriptionVi: "",
  isEnabled: true,
  isSpotlightEligible: false,
  moduleKey: "",
  moduleType: "content",
  routePath: "",
  status: "draft",
  titleJa: "",
  titleVi: "",
  visualTheme: "green_life"
});

const emptyCard = (moduleId = ""): Partial<CardRow> => ({
  category: "life",
  ctaLabelVi: "Xem ngay",
  descriptionVi: "",
  estimatedMinutes: 5,
  isPinned: false,
  isSpotlight: false,
  moduleConfigId: moduleId,
  moduleType: "content",
  priority: 0,
  slug: "",
  status: "draft",
  targetRoute: "",
  titleVi: "",
  visualTheme: "green_life"
});

function statusTone(status: string): "danger" | "good" | "neutral" | "warning" {
  if (status === "published") return "good";
  if (status === "draft") return "warning";
  if (status === "archived") return "neutral";
  return "danger";
}

function parseJson(value: string) {
  if (!value.trim()) return {};
  return JSON.parse(value) as Record<string, unknown>;
}

export function DailyRadarAdminClient({ common, labels }: { common: CommonLabels; labels: Labels }) {
  const t = (key: string) => labels[key] ?? key;
  const [perms, setPerms] = useState<Set<string> | null>(null);
  const canWrite = perms != null && perms.has("admin.content.write");
  const [summary, setSummary] = useState<Summary | null>(null);
  const [modules, setModules] = useState<ModuleRow[]>([]);
  const [cards, setCards] = useState<CardRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [mode, setMode] = useState<"card" | "module">("card");
  const [moduleForm, setModuleForm] = useState<Partial<ModuleRow> | null>(null);
  const [cardForm, setCardForm] = useState<Partial<CardRow> | null>(null);
  const [metadataText, setMetadataText] = useState("{}");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [summaryRes, moduleRes, cardRes] = await Promise.all([
        adminApiFetch("/api/admin/daily-radar/summary"),
        adminApiFetch("/api/admin/daily-radar/modules?limit=100"),
        adminApiFetch("/api/admin/daily-radar/cards?limit=100")
      ]);
      if (!summaryRes.ok || !moduleRes.ok || !cardRes.ok) throw new Error("load_failed");
      setSummary((await summaryRes.json()) as Summary);
      setModules(((await moduleRes.json()) as { items: ModuleRow[] }).items);
      setCards(((await cardRes.json()) as { items: CardRow[] }).items);
      setError(null);
    } catch {
      setError(common.error);
    } finally {
      setLoading(false);
    }
  }, [common.error]);

  useEffect(() => {
    let cancelled = false;
    void adminApiFetch("/api/admin/me")
      .then(async (r) => {
        if (!r.ok) return new Set<string>();
        return permsFromMe((await r.json()) as MePayload);
      })
      .then((next) => {
        if (!cancelled) setPerms(next);
      })
      .catch(() => {
        if (!cancelled) setPerms(new Set());
      });
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  function editModule(row?: ModuleRow) {
    setMode("module");
    setModuleForm(row ?? emptyModule());
    setCardForm(null);
    setMetadataText("{}");
  }

  function editCard(row?: CardRow) {
    setMode("card");
    setCardForm(row ?? emptyCard(modules[0]?.id));
    setModuleForm(null);
    setMetadataText("{}");
  }

  async function saveModule() {
    if (!moduleForm) return;
    setSaving(true);
    try {
      const body = {
        category: moduleForm.category,
        defaultPriority: Number(moduleForm.defaultPriority ?? 0),
        descriptionVi: moduleForm.descriptionVi,
        isEnabled: Boolean(moduleForm.isEnabled),
        isSpotlightEligible: Boolean(moduleForm.isSpotlightEligible),
        metadata: parseJson(metadataText),
        moduleKey: moduleForm.moduleKey,
        moduleType: moduleForm.moduleType,
        routePath: moduleForm.routePath || null,
        status: moduleForm.status,
        titleJa: moduleForm.titleJa || moduleForm.titleVi,
        titleVi: moduleForm.titleVi,
        visualTheme: moduleForm.visualTheme || null
      };
      const response = await adminApiFetch(
        moduleForm.id ? `/api/admin/daily-radar/modules/${moduleForm.id}` : "/api/admin/daily-radar/modules",
        { body: JSON.stringify(body), headers: { "content-type": "application/json" }, method: moduleForm.id ? "PATCH" : "POST" }
      );
      if (!response.ok) {
        const errBody = await response.json().catch(() => null) as { fieldErrors?: Record<string, string[]> } | null;
        const fields = errBody?.fieldErrors ? Object.entries(errBody.fieldErrors).map(([k, v]) => `${k}: ${v.join(", ")}`).join(" · ") : "";
        throw new Error(fields || "save_failed");
      }
      setModuleForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function saveCard() {
    if (!cardForm) return;
    setSaving(true);
    try {
      const selectedModule = modules.find((item) => item.id === cardForm.moduleConfigId);
      const body = {
        badgeTextVi: cardForm.badgeTextVi || null,
        category: cardForm.category,
        ctaLabelVi: cardForm.ctaLabelVi,
        descriptionVi: cardForm.descriptionVi,
        estimatedMinutes: cardForm.estimatedMinutes ? Number(cardForm.estimatedMinutes) : null,
        isPinned: Boolean(cardForm.isPinned),
        isSpotlight: Boolean(cardForm.isSpotlight),
        levelLabel: cardForm.levelLabel || null,
        metadata: parseJson(metadataText),
        moduleConfigId: cardForm.moduleConfigId,
        moduleType: cardForm.moduleType || selectedModule?.moduleType || "content",
        priority: Number(cardForm.priority ?? 0),
        recommendationReasonVi: cardForm.recommendationReasonVi || null,
        slug: cardForm.slug,
        status: cardForm.status,
        targetRoute: cardForm.targetRoute || null,
        titleVi: cardForm.titleVi,
        visualTheme: cardForm.visualTheme || selectedModule?.visualTheme || null
      };
      const response = await adminApiFetch(
        cardForm.id ? `/api/admin/daily-radar/cards/${cardForm.id}` : "/api/admin/daily-radar/cards",
        { body: JSON.stringify(body), headers: { "content-type": "application/json" }, method: cardForm.id ? "PATCH" : "POST" }
      );
      if (!response.ok) {
        const errBody = await response.json().catch(() => null) as { fieldErrors?: Record<string, string[]> } | null;
        const fields = errBody?.fieldErrors ? Object.entries(errBody.fieldErrors).map(([k, v]) => `${k}: ${v.join(", ")}`).join(" · ") : "";
        throw new Error(fields || "save_failed");
      }
      setCardForm(null);
      await load();
    } catch (err) {
      setError(err instanceof Error ? err.message : t("saveFailed"));
    } finally {
      setSaving(false);
    }
  }

  async function transitionCard(id: string, action: "archive" | "publish") {
    const response = await adminApiFetch(`/api/admin/daily-radar/cards/${id}/${action}`, {
      body: JSON.stringify({ reason: `Daily Radar ${action}` }),
      headers: { "content-type": "application/json" },
      method: "POST"
    });
    if (!response.ok) {
      setError(t("saveFailed"));
      return;
    }
    await load();
  }

  return (
    <div className="space-y-6">
      <AdminPageHeader description={t("subtitle")} title={t("title")} />
      {perms != null && !canWrite ? (
        <div className="rounded-md border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{t("readOnly")}</div>
      ) : null}
      {error ? <div className="rounded border border-red-300 bg-red-50 p-3 text-sm text-red-900">{error}</div> : null}

      <div className="grid gap-3 sm:grid-cols-5">
        {[
          [t("kpiModules"), summary?.totalModules ?? "—"],
          [t("kpiEnabled"), summary?.enabledModules ?? "—"],
          [t("kpiPublished"), summary?.publishedCards ?? "—"],
          [t("kpiDraft"), summary?.draftCards ?? "—"],
          [t("kpiSpotlight"), summary?.spotlight?.titleVi ?? "—"]
        ].map(([label, value]) => (
          <AdminSection key={String(label)}>
            <div className="text-xs font-semibold uppercase text-slate-500">{label}</div>
            <div className="mt-2 text-2xl font-semibold text-slate-950">{value}</div>
          </AdminSection>
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <button className="rounded bg-slate-950 px-3 py-2 text-sm font-semibold text-white" disabled={!canWrite} onClick={() => editCard()} type="button">
          {t("newCard")}
        </button>
        <button className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold" disabled={!canWrite} onClick={() => editModule()} type="button">
          {t("newModule")}
        </button>
        <button className="rounded border border-slate-300 px-3 py-2 text-sm font-semibold" onClick={() => void load()} type="button">
          {t("refresh")}
        </button>
      </div>

      {(moduleForm || cardForm) && canWrite ? (
        <AdminSection description={mode === "card" ? t("cardEditorHint") : t("moduleEditorHint")} title={mode === "card" ? t("cardEditor") : t("moduleEditor")}>
          {mode === "module" && moduleForm ? (
            <div className="grid gap-3 lg:grid-cols-2">
              <Field label={t("moduleKey")} value={moduleForm.moduleKey ?? ""} onChange={(v) => setModuleForm({ ...moduleForm, moduleKey: v })} />
              <Field label={t("titleVi")} value={moduleForm.titleVi ?? ""} onChange={(v) => setModuleForm({ ...moduleForm, titleVi: v })} />
              <Field label={t("titleJa")} value={moduleForm.titleJa ?? ""} onChange={(v) => setModuleForm({ ...moduleForm, titleJa: v })} />
              <Select label={t("category")} value={moduleForm.category ?? "life"} values={["work", "life", "news", "money", "entertainment", "procedure", "safety", "family", "study"]} onChange={(v) => setModuleForm({ ...moduleForm, category: v })} />
              <Field label={t("moduleType")} value={moduleForm.moduleType ?? ""} onChange={(v) => setModuleForm({ ...moduleForm, moduleType: v })} />
              <Field label={t("visualTheme")} value={moduleForm.visualTheme ?? ""} onChange={(v) => setModuleForm({ ...moduleForm, visualTheme: v })} />
              <Field label={t("routePath")} value={moduleForm.routePath ?? ""} onChange={(v) => setModuleForm({ ...moduleForm, routePath: v })} />
              <Field label={t("priority")} type="number" value={String(moduleForm.defaultPriority ?? 0)} onChange={(v) => setModuleForm({ ...moduleForm, defaultPriority: Number(v) })} />
              <TextArea label={t("descriptionVi")} value={moduleForm.descriptionVi ?? ""} onChange={(v) => setModuleForm({ ...moduleForm, descriptionVi: v })} />
              <Select label={t("status")} value={moduleForm.status ?? "draft"} values={["draft", "published", "archived"]} onChange={(v) => setModuleForm({ ...moduleForm, status: v })} />
              <Check label={t("enabled")} checked={Boolean(moduleForm.isEnabled)} onChange={(v) => setModuleForm({ ...moduleForm, isEnabled: v })} />
              <Check label={t("spotlightEligible")} checked={Boolean(moduleForm.isSpotlightEligible)} onChange={(v) => setModuleForm({ ...moduleForm, isSpotlightEligible: v })} />
            </div>
          ) : null}

          {mode === "card" && cardForm ? (
            <div className="grid gap-5 lg:grid-cols-[minmax(0,1fr)_22rem]">
              <div className="grid gap-3 lg:grid-cols-2">
                <Select label={t("module")} value={cardForm.moduleConfigId ?? ""} values={modules.map((item) => item.id)} labels={Object.fromEntries(modules.map((item) => [item.id, `${item.moduleKey} · ${item.titleVi}`]))} onChange={(v) => setCardForm({ ...cardForm, moduleConfigId: v })} />
                <Field label={t("slug")} value={cardForm.slug ?? ""} onChange={(v) => setCardForm({ ...cardForm, slug: v })} hint="a-z, 0-9, hyphens only" />
                <Field label={t("titleVi")} value={cardForm.titleVi ?? ""} onChange={(v) => {
                  const updates: Partial<CardRow> = { titleVi: v };
                  if (!cardForm.id && !cardForm.slug) {
                    updates.slug = v.toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^a-z0-9]+/g, "-").replace(/^-+|-+$/g, "").slice(0, 120) || "";
                  }
                  setCardForm({ ...cardForm, ...updates });
                }} />
                <Field label={t("badge")} value={cardForm.badgeTextVi ?? ""} onChange={(v) => setCardForm({ ...cardForm, badgeTextVi: v })} />
                <Select label={t("category")} value={cardForm.category ?? "life"} values={["work", "life", "news", "money", "entertainment", "procedure", "safety", "family", "study"]} onChange={(v) => setCardForm({ ...cardForm, category: v })} />
                <Field label={t("moduleType")} value={cardForm.moduleType ?? ""} onChange={(v) => setCardForm({ ...cardForm, moduleType: v })} />
                <Field label={t("cta")} value={cardForm.ctaLabelVi ?? ""} onChange={(v) => setCardForm({ ...cardForm, ctaLabelVi: v })} />
                <Field label={t("targetRoute")} value={cardForm.targetRoute ?? ""} onChange={(v) => setCardForm({ ...cardForm, targetRoute: v })} />
                <Field label={t("level")} value={cardForm.levelLabel ?? ""} onChange={(v) => setCardForm({ ...cardForm, levelLabel: v })} />
                <Field label={t("minutes")} type="number" value={String(cardForm.estimatedMinutes ?? "")} onChange={(v) => setCardForm({ ...cardForm, estimatedMinutes: Number(v) })} />
                <Field label={t("priority")} type="number" value={String(cardForm.priority ?? 0)} onChange={(v) => setCardForm({ ...cardForm, priority: Number(v) })} />
                <Select label={t("status")} value={cardForm.status ?? "draft"} values={["draft", "published", "archived"]} onChange={(v) => setCardForm({ ...cardForm, status: v })} />
                <TextArea label={t("descriptionVi")} value={cardForm.descriptionVi ?? ""} onChange={(v) => setCardForm({ ...cardForm, descriptionVi: v })} />
                <TextArea label={t("reason")} value={cardForm.recommendationReasonVi ?? ""} onChange={(v) => setCardForm({ ...cardForm, recommendationReasonVi: v })} />
                <Check label={t("spotlight")} checked={Boolean(cardForm.isSpotlight)} onChange={(v) => setCardForm({ ...cardForm, isSpotlight: v })} />
                <Check label={t("pinned")} checked={Boolean(cardForm.isPinned)} onChange={(v) => setCardForm({ ...cardForm, isPinned: v })} />
              </div>
              <Preview card={cardForm} labels={labels} />
            </div>
          ) : null}
          <TextArea label="metadata JSON" value={metadataText} onChange={setMetadataText} />
          <div className="mt-3 flex justify-end gap-2">
            <button className="rounded border px-3 py-2 text-sm" onClick={() => { setCardForm(null); setModuleForm(null); }} type="button">{t("cancel")}</button>
            <button className="rounded bg-indigo-600 px-3 py-2 text-sm font-semibold text-white disabled:opacity-50" disabled={saving} onClick={() => void (mode === "card" ? saveCard() : saveModule())} type="button">{t("save")}</button>
          </div>
        </AdminSection>
      ) : null}

      <AdminSection title={t("cards")}>
        {loading ? <p className="text-sm text-slate-600">{common.loading}</p> : null}
        {!loading && cards.length === 0 ? <AdminEmptyState title={common.empty} /> : null}
        {cards.length > 0 ? (
          <AdminDataTable>
            <AdminDataTableHead><AdminDataTableRow><AdminDataTableTh>{t("titleVi")}</AdminDataTableTh><AdminDataTableTh>{t("module")}</AdminDataTableTh><AdminDataTableTh>{t("category")}</AdminDataTableTh><AdminDataTableTh>{t("priority")}</AdminDataTableTh><AdminDataTableTh>{t("status")}</AdminDataTableTh><AdminDataTableTh>{t("actions")}</AdminDataTableTh></AdminDataTableRow></AdminDataTableHead>
            <AdminDataTableBody>
              {cards.map((row) => (
                <AdminDataTableRow key={row.id}>
                  <AdminDataTableTd>{row.titleVi}</AdminDataTableTd>
                  <AdminDataTableTd>{row.moduleConfig?.moduleKey}</AdminDataTableTd>
                  <AdminDataTableTd>{row.category}</AdminDataTableTd>
                  <AdminDataTableTd>{row.priority}</AdminDataTableTd>
                  <AdminDataTableTd><AdminStatusBadge tone={statusTone(row.status)}>{row.status}</AdminStatusBadge></AdminDataTableTd>
                  <AdminDataTableTd><div className="flex flex-wrap gap-1"><button className="rounded border px-2 py-1 text-xs" onClick={() => editCard(row)}>{t("edit")}</button>{row.status !== "published" ? <button className="rounded border px-2 py-1 text-xs" disabled={!canWrite} onClick={() => void transitionCard(row.id, "publish")}>{t("publish")}</button> : null}<button className="rounded border px-2 py-1 text-xs" disabled={!canWrite} onClick={() => void transitionCard(row.id, "archive")}>{t("archive")}</button></div></AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        ) : null}
      </AdminSection>

      <AdminSection title={t("modules")}>
        {modules.length === 0 ? <AdminEmptyState title={common.empty} /> : (
          <AdminDataTable>
            <AdminDataTableHead><AdminDataTableRow><AdminDataTableTh>{t("moduleKey")}</AdminDataTableTh><AdminDataTableTh>{t("titleVi")}</AdminDataTableTh><AdminDataTableTh>{t("category")}</AdminDataTableTh><AdminDataTableTh>{t("enabled")}</AdminDataTableTh><AdminDataTableTh>{t("priority")}</AdminDataTableTh><AdminDataTableTh>{t("status")}</AdminDataTableTh><AdminDataTableTh>{t("actions")}</AdminDataTableTh></AdminDataTableRow></AdminDataTableHead>
            <AdminDataTableBody>
              {modules.map((row) => (
                <AdminDataTableRow key={row.id}>
                  <AdminDataTableTd><span className="font-mono text-xs">{row.moduleKey}</span></AdminDataTableTd>
                  <AdminDataTableTd>{row.titleVi}</AdminDataTableTd>
                  <AdminDataTableTd>{row.category}</AdminDataTableTd>
                  <AdminDataTableTd>{row.isEnabled ? t("yes") : t("no")}</AdminDataTableTd>
                  <AdminDataTableTd>{row.defaultPriority}</AdminDataTableTd>
                  <AdminDataTableTd><AdminStatusBadge tone={statusTone(row.status)}>{row.status}</AdminStatusBadge></AdminDataTableTd>
                  <AdminDataTableTd><button className="rounded border px-2 py-1 text-xs" onClick={() => editModule(row)}>{t("edit")}</button></AdminDataTableTd>
                </AdminDataTableRow>
              ))}
            </AdminDataTableBody>
          </AdminDataTable>
        )}
      </AdminSection>
    </div>
  );
}

function Field({ hint, label, onChange, type = "text", value }: { hint?: string; label: string; onChange: (value: string) => void; type?: string; value: string }) {
  return (
    <label className="block text-sm">
      <span className="font-medium text-slate-700">{label}</span>
      {hint ? <span className="ml-2 text-xs text-slate-400">{hint}</span> : null}
      <input className="mt-1 w-full rounded border border-slate-300 px-3 py-2" type={type} value={value} onChange={(e) => onChange(e.target.value)} />
    </label>
  );
}

function TextArea({ label, onChange, value }: { label: string; onChange: (value: string) => void; value: string }) {
  return <label className="block text-sm"><span className="font-medium text-slate-700">{label}</span><textarea className="mt-1 min-h-24 w-full rounded border border-slate-300 px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)} /></label>;
}

function Select({ label, labels, onChange, value, values }: { label: string; labels?: Record<string, string>; onChange: (value: string) => void; value: string; values: string[] }) {
  return <label className="block text-sm"><span className="font-medium text-slate-700">{label}</span><select className="mt-1 w-full rounded border border-slate-300 px-3 py-2" value={value} onChange={(e) => onChange(e.target.value)}>{values.map((item) => <option key={item} value={item}>{labels?.[item] ?? item}</option>)}</select></label>;
}

function Check({ checked, label, onChange }: { checked: boolean; label: string; onChange: (value: boolean) => void }) {
  return <label className="flex items-center gap-2 text-sm font-medium text-slate-700"><input checked={checked} type="checkbox" onChange={(e) => onChange(e.target.checked)} />{label}</label>;
}

function Preview({ card, labels }: { card: Partial<CardRow>; labels: Labels }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-gradient-to-br from-slate-950 to-blue-700 p-4 text-white shadow-sm">
      <div className="text-xs font-bold uppercase tracking-wide text-blue-100">{card.badgeTextVi || labels.previewBadge}</div>
      <h3 className="mt-4 text-xl font-semibold">{card.titleVi || labels.previewTitle}</h3>
      <p className="mt-2 text-sm text-blue-50/85">{card.descriptionVi || labels.previewDescription}</p>
      {card.recommendationReasonVi ? <p className="mt-3 rounded-xl bg-white/10 p-3 text-xs">{card.recommendationReasonVi}</p> : null}
      <div className="mt-5 flex items-center justify-between gap-3">
        <span className="rounded-xl bg-white px-3 py-2 text-sm font-semibold text-slate-950">{card.ctaLabelVi || labels.cta}</span>
        <span className="text-xs text-blue-50/80">{card.levelLabel} · {card.estimatedMinutes ? `${card.estimatedMinutes}m` : ""}</span>
      </div>
    </div>
  );
}
