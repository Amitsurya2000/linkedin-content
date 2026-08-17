"use client";

import Link from "next/link";

export default function DashboardError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex flex-1 items-center justify-center">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-800">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-500">
          We hit an unexpected error. You can try again or head back to the dashboard.
        </p>
        <div className="mt-6 flex items-center justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-lg bg-red-600 px-5 py-2 text-sm font-medium text-[#1A1414] hover:bg-red-700"
          >
            Try again
          </button>
          <Link
            href="/dashboard"
            className="rounded-lg border border-gray-300 px-5 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}
