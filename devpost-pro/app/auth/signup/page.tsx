"use client";

import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";

export default function SignUpPage() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const res = await fetch("/api/auth/register", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, email, password }),
    });
    const payload = (await res.json().catch(() => null)) as
      | { error?: string }
      | null;
    if (!res.ok) {
      setBusy(false);
      setError(payload?.error ?? "Could not create account.");
      return;
    }
    const signin = await signIn("credentials", {
      email,
      password,
      redirect: false,
      callbackUrl: "/",
    });
    setBusy(false);
    if (signin?.error) {
      router.push("/auth/signin");
      return;
    }
    router.push("/");
  }

  return (
    <main className="min-h-screen bg-[var(--bg-secondary)] p-6">
      <div className="mx-auto mt-10 max-w-md rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Create account</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Start generating LinkedIn-ready content in one click.
        </p>
        <form className="mt-6 space-y-4" onSubmit={onSubmit}>
          <input
            type="text"
            required
            placeholder="Full name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-[var(--primary)] focus:ring-2"
          />
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
            minLength={8}
            placeholder="Password (8+ chars)"
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
            {busy ? "Creating..." : "Create account"}
          </button>
        </form>
        <p className="mt-4 text-sm text-[var(--text-secondary)]">
          Already have an account?{" "}
          <Link href="/auth/signin" className="font-semibold text-[var(--primary)]">
            Sign in
          </Link>
        </p>
      </div>
    </main>
  );
}
