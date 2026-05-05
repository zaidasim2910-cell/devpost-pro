"use client";

import Link from "next/link";
import { useMemo, useState } from "react";
import { useSession } from "next-auth/react";
import { trackEvent } from "@/lib/analytics";

export default function ReferralsPage() {
  const { data: session } = useSession();
  const [copied, setCopied] = useState(false);

  const referralLink = useMemo(() => {
    const code =
      session?.user?.email?.split("@")[0]?.replace(/[^a-z0-9]/gi, "") ||
      "devpost";
    const origin =
      typeof window !== "undefined" ? window.location.origin : "http://localhost:3000";
    return `${origin}/?ref=${code}`;
  }, [session?.user?.email]);

  async function copyReferral() {
    await navigator.clipboard.writeText(referralLink);
    setCopied(true);
    trackEvent("referral_share", { method: "copy_link" });
    setTimeout(() => setCopied(false), 2000);
  }

  return (
    <main className="min-h-screen bg-[var(--bg-secondary)] p-6">
      <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Refer DevPost Pro</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Share your referral link. We’ll add rewards logic in the next iteration.
        </p>
        <div className="mt-5 rounded-xl border border-slate-200 bg-slate-50 p-4">
          <p className="text-xs text-[var(--text-muted)]">Your referral link</p>
          <p className="mt-1 break-all text-sm text-[var(--text-primary)]">{referralLink}</p>
          <button
            onClick={() => void copyReferral()}
            className="mt-3 rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-white"
          >
            {copied ? "Copied!" : "Copy link"}
          </button>
        </div>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-[var(--primary)]">
          ← Back
        </Link>
      </div>
    </main>
  );
}
