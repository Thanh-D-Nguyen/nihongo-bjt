import en from "../../../messages/en.json";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { OperationsResourceClient } from "../_components/operations-resource-client";

const messages = { ja, vi, en };

export default async function AdminGrammarPage({ params }: { params: Promise<{ locale: keyof typeof messages }> }) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;
  return (
    <OperationsResourceClient
      columns={[
        { key: "pattern", label: t.shell.grammar },
        {
          key: "jlptLevel",
          label: t.adminConsole.common.level,
          thTitle: t.adminConsole.common.levelColumnHint
        },
        { key: "meaningVi", label: t.adminConsole.common.meaning },
        { key: "status", label: t.adminConsole.common.status },
        { key: "updatedAt", label: t.adminConsole.common.updatedAt }
      ]}
      common={t.adminConsole.common}
      contentCms={{
        kind: "grammar",
        labels: t.adminConsole.cms,
        levelFieldLabel: t.adminConsole.common.levelFieldLabel
      }}
      endpoint="/api/admin/content?type=grammar"
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
        }
      ]}
      grammarFilterLabels={t.adminConsole.grammarCategoryFilter}
      grammarGroupLabels={t.adminConsole.grammarCategoryGroups}
      page={t.adminConsole.grammar}
    />
  );
}
