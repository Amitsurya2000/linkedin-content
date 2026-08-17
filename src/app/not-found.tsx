import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50">
      <div className="text-center">
        <h1 className="text-6xl font-bold text-gray-300">404</h1>
        <p className="mt-4 text-lg text-gray-600">Page not found</p>
        <Link
          href="/dashboard"
          className="mt-6 inline-block rounded-lg bg-red-600 px-6 py-2.5 text-sm font-medium text-[#1A1414] hover:bg-red-700"
        >
          Back to Dashboard
        </Link>
      </div>
    </div>
  );
}
