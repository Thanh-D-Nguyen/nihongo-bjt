"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="en">
      <body>
        <main style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>An error occurred</h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
            Something went wrong. Please try again.
          </p>
          <button
            onClick={() => reset()}
            style={{ marginTop: "1.5rem", padding: "0.625rem 1.25rem", borderRadius: "0.75rem", backgroundColor: "#4f46e5", color: "#fff", fontSize: "0.875rem", fontWeight: "500", border: "none", cursor: "pointer" }}
            type="button"
          >
            Try again
          </button>
        </main>
      </body>
    </html>
  );
}
