import type { Metadata } from "next";
import Link from "next/link";
import { currentUser } from "@/lib/auth";
import { LogoutButton } from "./logout-button";
import "./globals.css";

export const metadata: Metadata = {
  title: { default: "Trackly", template: "%s · Trackly" },
  description: "Trackly: a small issue tracker for software teams.",
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const user = await currentUser();
  return (
    <html lang="en" className="h-full antialiased">
      <body className="flex min-h-full flex-col">
        <header className="border-b border-zinc-200 bg-white">
          <nav className="mx-auto flex max-w-6xl flex-wrap items-center gap-x-6 gap-y-2 px-4 py-3">
            <Link href="/" className="flex items-center gap-2 text-xl font-bold tracking-tight text-zinc-900">
              <span className="inline-block h-6 w-6 rounded-md bg-indigo-600" aria-hidden />
              Trackly
            </Link>
            {user && (
              <>
                <Link href="/" className="font-medium text-zinc-600 hover:text-indigo-600">
                  Projects
                </Link>
                <Link href="/notifications" className="font-medium text-zinc-600 hover:text-indigo-600">
                  Notifications
                </Link>
                <div className="ml-auto flex items-center gap-4">
                  <span className="text-sm text-zinc-600">
                    <span data-testid="current-user" className="font-medium text-zinc-900">
                      {user.name}
                    </span>
                    <span className="ml-2 rounded bg-zinc-100 px-1.5 py-0.5 text-xs uppercase text-zinc-500">
                      {user.role}
                    </span>
                  </span>
                  <LogoutButton />
                </div>
              </>
            )}
          </nav>
        </header>
        <main className="mx-auto w-full max-w-6xl flex-1 px-4 py-8">{children}</main>
        <footer className="border-t border-zinc-200 py-5 text-center text-sm text-zinc-500">
          Trackly · the course project of the Claude Code course
        </footer>
      </body>
    </html>
  );
}
