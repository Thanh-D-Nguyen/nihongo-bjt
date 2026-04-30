import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";
import { GrowthClient } from "./growth-client";

const messages = { ja, vi };

export default async function GrowthPage({
  params
}: {
  params: Promise<{ locale: keyof typeof messages }>;
}) {
  const { locale } = await params;
  const t = messages[locale] ?? messages.vi;

  return (
    <div className="mx-auto w-full max-w-6xl space-y-6">
      <section className="admin-card">
        <GrowthClient labels={t.growth} />
      </section>
    </div>
  );
}
