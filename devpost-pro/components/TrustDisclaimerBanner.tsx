"use client";

import { Info } from "lucide-react";

/** Shown when trust score is in the 60–79 “medium” band (per build guide). */
export function TrustDisclaimerBanner() {
  return (
    <div className="flex gap-3 rounded-2xl border border-amber-200 bg-amber-50/90 p-4 text-sm text-amber-950 shadow-sm">
      <Info className="mt-0.5 h-5 w-5 shrink-0 text-[var(--warning)]" />
      <div>
        <p className="font-semibold text-[var(--text-primary)]">
          Standard authenticity band
        </p>
        <p className="mt-1 leading-relaxed text-[var(--text-secondary)]">
          Your project passed the minimum bar for generation, but some signals
          are moderate (e.g. contributor count or README depth). Review posts
          carefully before publishing—you may want to add context in your own
          words.
        </p>
      </div>
    </div>
  );
}
