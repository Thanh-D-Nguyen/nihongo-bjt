import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { OperationsResourceClient } from "../_components/operations-resource-client";

const messages = { ja, vi, en };

export default async function AdminKanjiPage({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  const levelFilterOptions = [
    { value: "", label: t.adminConsole.cms.allSchoolLevels },
    ...[0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10].map((n) => ({ label: String(n), value: String(n) }))
  ];

  return (
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
      endpoint="/api/admin/content?type=kanji"
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
        { control: "select", label: t.adminConsole.cms.levelFilter, options: levelFilterOptions, param: "level" }
      ]}
      page={t.adminConsole.kanji}
    />
  );
}
