"use client";

import { useParams } from "next/navigation";
import { useCallback, useState } from "react";
import ja from "../../../messages/ja.json";
import vi from "../../../messages/vi.json";

const messages: Record<string, typeof vi> = { ja, vi };

export default function FeedbackPage() {
  const params = useParams();
  const locale = (params?.locale as string) ?? "vi";
  const t = messages[locale]?.feedbackPage ?? messages.vi.feedbackPage;

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [category, setCategory] = useState("bug");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<"idle" | "success" | "error">("idle");

  const handleSubmit = useCallback(
    async (e: React.FormEvent) => {
      e.preventDefault();
      try {
        const res = await fetch("/api/feedback", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name, email, category, message }),
        });
        if (res.ok) {
          setStatus("success");
          setName("");
          setEmail("");
          setCategory("bug");
          setMessage("");
        } else {
          setStatus("error");
        }
      } catch {
        setStatus("error");
      }
    },
    [name, email, category, message],
  );

  const categories = [
    { value: "bug", label: t.categoryBug },
    { value: "feature", label: t.categoryFeature },
    { value: "content", label: t.categoryContent },
    { value: "other", label: t.categoryOther },
  ];

  return (
    <main className="mx-auto w-full max-w-2xl space-y-8 px-4 py-10">
      <div>
        <h1 className="text-2xl font-bold text-ink">{t.title}</h1>
        <p className="mt-1 text-sm text-muted">{t.subtitle}</p>
      </div>

      {status === "success" ? (
        <div className="rounded-xl border border-leaf/30 bg-leaf/5 p-6 text-center">
          <p className="text-sm font-medium text-leaf">{t.success}</p>
        </div>
      ) : (
        <form className="space-y-5" onSubmit={handleSubmit}>
          <div className="grid gap-4 sm:grid-cols-2">
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                {t.nameLabel}
              </label>
              <input
                className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-1 focus:ring-leaf"
                onChange={(e) => setName(e.target.value)}
                placeholder={t.namePlaceholder}
                type="text"
                value={name}
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-ink">
                {t.emailLabel}
              </label>
              <input
                className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-1 focus:ring-leaf"
                onChange={(e) => setEmail(e.target.value)}
                placeholder={t.emailPlaceholder}
                type="email"
                value={email}
              />
            </div>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              {t.categoryLabel}
            </label>
            <select
              className="w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-1 focus:ring-leaf"
              onChange={(e) => setCategory(e.target.value)}
              value={category}
            >
              {categories.map((c) => (
                <option key={c.value} value={c.value}>
                  {c.label}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="mb-1 block text-sm font-medium text-ink">
              {t.messageLabel}
            </label>
            <textarea
              className="min-h-[120px] w-full rounded-lg border border-ink/10 bg-white px-3 py-2 text-sm focus:border-leaf focus:outline-none focus:ring-1 focus:ring-leaf"
              onChange={(e) => setMessage(e.target.value)}
              placeholder={t.messagePlaceholder}
              required
              value={message}
            />
          </div>

          {status === "error" && (
            <p className="text-sm text-red-600">{t.error}</p>
          )}

          <button
            className="w-full rounded-lg bg-leaf px-4 py-2.5 text-sm font-medium text-white hover:bg-leaf/90 disabled:opacity-50"
            disabled={!message.trim()}
            type="submit"
          >
            {t.submit}
          </button>
        </form>
      )}
    </main>
  );
}
