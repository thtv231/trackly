import Link from "next/link";

export default function NotFound() {
  return (
    <div className="py-16 text-center">
      <h1 className="text-2xl font-bold">Page not found</h1>
      <p className="mt-2 text-zinc-600">This page does not exist, or it was deleted.</p>
      <Link href="/" className="mt-6 inline-block font-medium text-indigo-600 hover:underline">
        Back to projects
      </Link>
    </div>
  );
}
