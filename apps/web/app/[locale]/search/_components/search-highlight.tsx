export function HighlightMatch({
  text,
  query
}: {
  text: string | null | undefined;
  query: string | null | undefined;
}) {
  const safeText = text ?? "";
  const q = (query ?? "").trim();
  if (!q) return <>{safeText}</>;
  const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const parts = safeText.split(new RegExp(`(${escaped})`, "gi"));
  return (
    <>
      {parts.map((part, i) =>
        part.toLowerCase() === q.toLowerCase() ? (
          <mark key={i} className="rounded-sm bg-accent/15 px-0.5 text-inherit">
            {part}
          </mark>
        ) : (
          <span key={i}>{part}</span>
        )
      )}
    </>
  );
}
