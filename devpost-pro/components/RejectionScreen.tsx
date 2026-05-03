"use client";

import { AlertTriangle, ArrowLeft } from "lucide-react";
import type { TrustBreakdown } from "@/lib/types";

export function RejectionScreen({
  reason,
  score,
  breakdown,
  onBack,
}: {
  reason: string;
  score?: number;
  breakdown?: TrustBreakdown;
  onBack: () => void;
}) {
  return (
    <div className="rounded-2xl border border-amber-200 bg-amber-50/80 p-8 shadow-sm">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[var(--warning)]/15 text-[var(--warning)]">
          <AlertTriangle className="h-6 w-6" />
        </div>
        <div className="min-w-0 flex-1">
          <h2 className="text-xl font-bold text-[var(--text-primary)]">
            We couldn&apos;t proceed
          </h2>
          {typeof score === "number" ? (
            <p className="mt-1 text-sm font-semibold text-[var(--text-secondary)]">
              Trust score: {score}/100
            </p>
          ) : null}
          <p className="mt-3 text-[var(--text-primary)] leading-relaxed">
            {reason}
          </p>

          <div className="mt-6 rounded-xl border border-amber-100 bg-white/80 p-4">
            <p className="text-sm font-semibold text-[var(--text-primary)]">
              How to improve your score
            </p>
            <ul className="mt-2 list-disc space-y-1 pl-5 text-sm text-[var(--text-secondary)]">
              <li>Use an original public repo with a solid README and real commits.</li>
              <li>Make sure your LinkedIn URL is public and complete.</li>
              <li>Avoid forks unless you have substantial original work to showcase elsewhere.</li>
            </ul>
          </div>

          {breakdown?.warnings?.length ? (
            <p className="mt-4 text-xs text-[var(--text-muted)]">
              Warnings: {breakdown.warnings.join(", ")}
            </p>
          ) : null}

          <button
            type="button"
            onClick={onBack}
            className="mt-6 inline-flex items-center gap-2 rounded-full bg-[var(--text-primary)] px-5 py-2.5 text-sm font-semibold text-white transition hover:opacity-90"
          >
            <ArrowLeft className="h-4 w-4" />
            Try a different repository
          </button>
        </div>
      </div>
    </div>
  );
}
