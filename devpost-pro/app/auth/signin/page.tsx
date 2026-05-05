"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

export default function SignInPage() {
  const router = useRouter();
  const [callbackUrl, setCallbackUrl] = useState("/");
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    setCallbackUrl(params.get("callbackUrl") || "/");
  }, []);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl,
    });
    setBusy(false);
    if (result?.error) {
      setError("Invalid email or password.");
      return;
    }
    router.push(result?.url || callbackUrl);
  }

  return (
    <main className="min-h-screen bg-[var(--bg-secondary)] p-6">
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Sign in</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Access your DevPost Pro workspace.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <input
            type="email"
            required
            placeholder="Email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-[var(--primary)] focus:ring-2"
          />
          <input
            type="password"
            required
            placeholder="Password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-[var(--primary)] focus:ring-2"
          />
          {error ? (
            <p className="rounded-lg bg-red-50 p-3 text-sm text-red-900">{error}</p>
          ) : null}
          <button
            disabled={busy}
            type="submit"
            className="w-full rounded-full bg-[var(--text-primary)] py-3 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Signing in..." : "Sign in"}
          </button>
          <button
            type="button"
            onClick={() => signIn("linkedin", { callbackUrl })}
            className="w-full rounded-full border border-slate-200 py-3 text-sm font-semibold"
          >
            Continue with LinkedIn
          </button>
        </form>
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          New here?{" "}
          <Link href="/auth/signup" className="font-semibold text-[var(--primary)]">
            Create account
          </Link>
        </p>
      </div>
    </main>
  );
}
