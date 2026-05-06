"use client";

export default function AdminError({
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-[60vh] flex-col items-center justify-center px-4 text-center">
      <h1 className="text-2xl font-bold text-slate-900">An error occurred</h1>
      <p className="mt-2 text-sm text-slate-500">
        Something went wrong. Please try again.
      </p>
      <button
        className="mt-6 rounded-lg bg-indigo-600 px-5 py-2.5 text-sm font-medium text-white hover:bg-indigo-700"
        onClick={() => reset()}
        type="button"
      >
        Try again
      </button>
    </main>
  );
}
