import { redirect } from "next/navigation";

/** Default admin locale shell (matches `generateStaticParams` in `[locale]/layout`). */
export default function AdminRootRedirect() {
  redirect("/vi");
}
