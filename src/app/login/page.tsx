import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { currentUser } from "@/lib/auth";
import { LoginForm } from "./login-form";

export const metadata: Metadata = { title: "Sign in" };

export default async function LoginPage({ searchParams }: { searchParams: Promise<{ next?: string | string[] }> }) {
  const { next } = await searchParams;
  // Only allow local paths, so a link cannot send people to another site after signing in.
  const target = typeof next === "string" && next.startsWith("/") && !next.startsWith("//") ? next : "/";
  if (await currentUser()) redirect(target);
  return (
    <div className="mx-auto max-w-sm">
      <h1 className="mb-6 text-2xl font-bold">Sign in to Trackly</h1>
      <LoginForm next={target} />
      <p className="mt-6 text-sm text-zinc-500">
        Demo accounts: alice@trackly.test (admin), bob@trackly.test, carol@trackly.test, dave@trackly.test (viewer).
        Password: trackly-demo
      </p>
    </div>
  );
}
