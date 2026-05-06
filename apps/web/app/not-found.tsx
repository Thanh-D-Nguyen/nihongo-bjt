import Link from "next/link";

export default function NotFound() {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-5xl font-bold text-ink">404</h1>
      <p className="mt-2 text-sm text-muted">
        Trang bạn tìm không tồn tại. / ページが見つかりません。
      </p>
      <Link
        className="mt-6 inline-flex rounded-xl bg-ink px-5 py-2.5 text-sm font-medium text-surface hover:bg-ink/90"
        href="/vi"
      >
        Về trang chủ / ホームに戻る
      </Link>
    </main>
  );
}
