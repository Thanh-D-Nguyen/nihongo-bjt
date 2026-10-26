import type { Metadata } from "next";
import { NotFoundClient } from "./_components/not-found-client";

export const metadata: Metadata = { title: "404 — KotobaWorks" };

export default function NotFound() {
  return <NotFoundClient />;
}
