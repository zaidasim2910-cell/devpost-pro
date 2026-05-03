"use client";

import { Check, X } from "lucide-react";
import { useEffect, useState } from "react";
import type { TrustBreakdown } from "@/lib/types";

function scoreColor(score: number): string {
  if (score >= 80) return "var(--trust-high)";
  if (score >= 60) return "var(--trust-medium)";
  return "var(--trust-low)";
}

export function TrustScoreCard({
  score,
  level,
  badge,
  breakdown,
}: {
  score: number;
  level: "HIGH" | "MEDIUM" | "LOW";
  badge: "VERIFIED" | "STANDARD";
  breakdown: TrustBreakdown;
}) {
  const [display, setDisplay] = useState(0);
  const color = scoreColor(score);
  const r = 52;
  const c = 2 * Math.PI * r;

  useEffect(() => {
    const t = window.setTimeout(() => setDisplay(score), 50);
    return () => window.clearTimeout(t);
  }, [score]);

  const rows: { label: string; ok: boolean }[] = [
    { label: "Original work (not a fork)", ok: breakdown.checks.is_original_work },
    { label: "Solo or lead author", ok: breakdown.checks.solo_or_lead_author },
    { label: "Meaningful commit history", ok: breakdown.checks.has_commit_history },
    { label: "README quality", ok: breakdown.checks.readme_quality },
    { label: "LinkedIn profile found", ok: breakdown.checks.linkedin_profile_real },
  ];

  return (
    <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
      <div className="flex flex-col items-center gap-6 md:flex-row md:items-start">
        <div className="relative flex h-40 w-40 shrink-0 items-center justify-center">
          <svg width="160" height="160" className="-rotate-90">
            <circle
              cx="80"
              cy="80"
              r={r}
              stroke="currentColor"
              strokeWidth="10"
              fill="none"
              className="text-slate-100"
            />
            <circle
              cx="80"
              cy="80"
              r={r}
              stroke={color}
              strokeWidth="10"
              fill="none"
              strokeLinecap="round"
              strokeDasharray={`${c} ${c}`}
              strokeDashoffset={c * (1 - display / 100)}
              className="transition-[stroke-dashoffset] duration-1000 ease-out"
            />
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <div className="text-3xl font-bold tabular-nums" style={{ color }}>
              {Math.round(display)}
            </div>
            <div className="text-xs font-semibold text-[var(--text-muted)]">
              / 100
            </div>
          </div>
        </div>

        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-3">
            <h2 className="text-xl font-bold text-[var(--text-primary)]">
              Trust score
            </h2>
            <span
              className={`rounded-full px-3 py-1 text-xs font-semibold ${
                badge === "VERIFIED"
                  ? "bg-emerald-50 text-[var(--success)]"
                  : "bg-amber-50 text-[var(--warning)]"
              }`}
            >
              {badge === "VERIFIED"
                ? "Verified authentic work"
                : "Standard"}
            </span>
            <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
              Level: {level}
            </span>
          </div>
          <p className="mt-2 text-sm text-[var(--text-secondary)]">
            GitHub component ~{breakdown.github_component} · LinkedIn ~
            {breakdown.linkedin_component}
          </p>

          <details className="mt-4 rounded-xl border border-slate-100 bg-slate-50/60 p-4">
            <summary className="cursor-pointer text-sm font-semibold text-[var(--text-primary)]">
              Score breakdown
            </summary>
            <ul className="mt-3 space-y-2">
              {rows.map((row) => (
                <li
                  key={row.label}
                  className="flex items-center justify-between gap-3 text-sm"
                >
                  <span className="text-[var(--text-secondary)]">{row.label}</span>
                  {row.ok ? (
                    <Check className="h-4 w-4 text-[var(--success)]" />
                  ) : (
                    <X className="h-4 w-4 text-[var(--danger)]" />
                  )}
                </li>
              ))}
            </ul>
          </details>
        </div>
      </div>
    </div>
  );
}
