"use client";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-2xl font-semibold text-gray-800">Something went wrong</h1>
        <p className="mt-2 text-sm text-gray-500">
          An unexpected error occurred. Please try again.
        </p>
        <button
          onClick={reset}
          className="mt-6 rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-[#1A1414] hover:bg-red-700"
        >
          Try again
        </button>
      </div>
    </div>
  );
}
