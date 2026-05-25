import Link from "next/link";

import { cn } from "@nihongo-bjt/ui";

import en from "../../../../messages/en.json";
import ja from "../../../../messages/ja.json";
import vi from "../../../../messages/vi.json";
import { OperationsResourceClient } from "../../_components/operations-resource-client";

const messages = { ja, vi, en };

type ReviewKind = "grammar" | "kanji" | "lexeme";

function parseReviewKind(value: string | string[] | undefined): ReviewKind {
  if (value === "kanji" || value === "grammar" || value === "lexeme") {
    return value;
  }
  return "lexeme";
}

export default async function AdminContentQualityReviewPage({
  params,
  searchParams
}: {
  params: Promise<{ locale: keyof typeof messages }>;
  searchParams: Promise<{ type?: string | string[] }>;
}) {
  const { locale } = await params;
  const resolvedSearchParams = await searchParams;
  const reviewKind = parseReviewKind(resolvedSearchParams.type);
  const t = messages[locale] ?? messages.vi;

  const reviewLinks: Array<{ href: string; key: ReviewKind; label: string }> = [
    { href: `/${locale}/content/quality-review?type=lexeme`, key: "lexeme", label: t.content.toolDictionaryTitle },
    { href: `/${locale}/content/quality-review?type=kanji`, key: "kanji", label: t.content.toolKanjiTitle },
    { href: `/${locale}/content/quality-review?type=grammar`, key: "grammar", label: t.content.toolGrammarTitle }
  ];

  if (reviewKind === "kanji") {
    const levelFilterOptions = [
      { value: "", label: t.adminConsole.cms.allSchoolLevels },
      ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((value) => ({ label: String(value), value: String(value) }))
    ];

    return (
      <div className="space-y-4">
        <ReviewKindSwitcher activeKind={reviewKind} links={reviewLinks} />
        <OperationsResourceClient
          columns={[
            { key: "character", label: t.shell.kanji },
            {
              key: "level",
              label: t.adminConsole.cms.schoolLevel,
              thTitle: t.adminConsole.cms.schoolLevelColumnHint
            },
            { key: "strokeCount", label: t.adminConsole.common.strokes },
            { key: "status", label: t.adminConsole.common.status },
            { key: "updatedAt", label: t.adminConsole.common.updatedAt }
          ]}
          common={t.adminConsole.common}
          contentCms={{ kind: "kanji", labels: t.adminConsole.cms }}
          endpoint="/api/admin/content?type=kanji&status=needs_review"
          extraFilters={[
            {
              control: "number",
              label: t.adminConsole.cms.strokesFrom,
              max: 200,
              min: 0,
              param: "strokeCountMin"
            },
            {
              control: "number",
              label: t.adminConsole.cms.strokesTo,
              max: 200,
              min: 0,
              param: "strokeCountMax"
            },
            {
              control: "select",
              label: t.adminConsole.cms.levelFilter,
              options: levelFilterOptions,
              param: "level"
            }
          ]}
          page={{
            empty: t.adminConsole.common.empty,
            subtitle: t.content.toolsDescription,
            title: `${t.content.toolKanjiTitle} / ${t.adminConsole.common.statusLabelNeedsReview}`
          }}
        />
      </div>
    );
  }

  if (reviewKind === "grammar") {
    return (
      <div className="space-y-4">
        <ReviewKindSwitcher activeKind={reviewKind} links={reviewLinks} />
        <OperationsResourceClient
          columns={[
            { key: "pattern", label: t.content.toolGrammarTitle },
            {
              key: "jlptLevel",
              label: t.adminConsole.common.level,
              thTitle: t.adminConsole.common.levelColumnHint
            },
            { key: "category", label: t.adminConsole.cms.categoryLabel },
            { key: "status", label: t.adminConsole.common.status },
            { key: "updatedAt", label: t.adminConsole.common.updatedAt }
          ]}
          common={t.adminConsole.common}
          contentCms={{ kind: "grammar", labels: t.adminConsole.cms }}
          endpoint="/api/admin/content?type=grammar&status=needs_review"
          extraFilters={[
            {
              control: "text",
              label: t.adminConsole.cms.categoryLabel,
              param: "category",
              placeholder: t.adminConsole.cms.categoryPlaceholder
            },
            {
              control: "select",
              label: t.adminConsole.common.levelFilter,
              options: [
                { value: "", label: t.adminConsole.common.allLevels },
                { value: "N5", label: "N5" },
                { value: "N4", label: "N4" },
                { value: "N3", label: "N3" },
                { value: "N2", label: "N2" },
                { value: "N1", label: "N1" }
              ],
              param: "jlptLevel"
            }
          ]}
          page={{
            empty: t.adminConsole.common.empty,
            subtitle: t.content.toolsDescription,
            title: `${t.content.toolGrammarTitle} / ${t.adminConsole.common.statusLabelNeedsReview}`
          }}
        />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <ReviewKindSwitcher activeKind={reviewKind} links={reviewLinks} />
      <OperationsResourceClient
        columns={[
          { key: "headword", label: t.content.lexemes },
          { key: "reading", label: t.adminConsole.common.reading },
          {
            key: "jlptLevel",
            label: t.adminConsole.common.level,
            thTitle: t.adminConsole.common.levelColumnHint
          },
          { key: "status", label: t.adminConsole.common.status },
          { key: "updatedAt", label: t.adminConsole.common.updatedAt }
        ]}
        common={t.adminConsole.common}
        contentCms={{
          kind: "lexeme",
          labels: t.adminConsole.cms,
          levelFieldLabel: t.adminConsole.common.levelFieldLabel
        }}
        endpoint="/api/admin/content?type=lexeme&status=needs_review"
        extraFilters={[
          {
            control: "select",
            label: t.adminConsole.common.levelFilter,
            options: [
              { value: "", label: t.adminConsole.common.allLevels },
              { value: "N5", label: "N5" },
              { value: "N4", label: "N4" },
              { value: "N3", label: "N3" },
              { value: "N2", label: "N2" },
              { value: "N1", label: "N1" }
            ],
            param: "jlptLevel"
          },
          {
            control: "text",
            label: t.adminConsole.cms.reading,
            param: "reading",
            placeholder: "..."
          }
        ]}
        lexemeExampleLabels={t.adminConsole.lexemeExample}
        page={{
          empty: t.adminConsole.common.empty,
          subtitle: t.content.toolsDescription,
          title: `${t.content.toolDictionaryTitle} / ${t.adminConsole.common.statusLabelNeedsReview}`
        }}
      />
    </div>
  );
}

function ReviewKindSwitcher({
  activeKind,
  links
}: {
  activeKind: ReviewKind;
  links: Array<{ href: string; key: ReviewKind; label: string }>;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {links.map((link) => (
        <Link
          key={link.key}
          className={cn(
            "rounded-full border px-3 py-1.5 text-sm font-medium transition-colors",
            link.key === activeKind
              ? "border-amber-300 bg-amber-50 text-amber-950"
              : "border-slate-200 bg-white text-slate-700 hover:border-slate-300 hover:bg-slate-50"
          )}
          href={link.href}
        >
          {link.label}
        </Link>
      ))}
    </div>
  );
}
