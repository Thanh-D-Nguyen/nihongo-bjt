"use client";

export default function GlobalError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <html lang="vi">
      <body>
        <main style={{ display: "flex", minHeight: "100vh", flexDirection: "column", alignItems: "center", justifyContent: "center", padding: "1rem", textAlign: "center" }}>
          <h1 style={{ fontSize: "1.5rem", fontWeight: "bold" }}>Đã xảy ra lỗi</h1>
          <p style={{ marginTop: "0.5rem", fontSize: "0.875rem", color: "#64748b" }}>
            Xin lỗi, có lỗi xảy ra. Vui lòng thử lại.
          </p>
          <button
            onClick={() => reset()}
            style={{ marginTop: "1.5rem", padding: "0.625rem 1.25rem", borderRadius: "0.75rem", backgroundColor: "#0f172a", color: "#fff", fontSize: "0.875rem", fontWeight: "500", border: "none", cursor: "pointer" }}
            type="button"
          >
            Thử lại
          </button>
        </main>
      </body>
    </html>
  );
}
