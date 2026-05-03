"use client";

import { Check, Loader2 } from "lucide-react";
import { useEffect, useState } from "react";

const STEPS = [
  "Checking GitHub repository...",
  "Scanning LinkedIn profile...",
  "Calculating trust score...",
  "Generating your posts...",
  "Building image card...",
];

export function LoadingScreen({ active }: { active: boolean }) {
  const [step, setStep] = useState(0);

  useEffect(() => {
    if (!active) {
      setStep(0);
      return;
    }
    const id = window.setInterval(() => {
      setStep((s) => Math.min(s + 1, STEPS.length - 1));
    }, 3000);
    return () => window.clearInterval(id);
  }, [active]);

  if (!active) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm">
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-white p-8 shadow-2xl">
        <h2 className="text-lg font-bold text-[var(--text-primary)]">
          DevPost Pro is working
        </h2>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          This can take 10–20 seconds while the backend validates GitHub and
          runs the AI generator.
        </p>
        <ul className="mt-6 space-y-3">
          {STEPS.map((label, i) => {
            const done = i < step;
            const current = i === step;
            return (
              <li key={label} className="flex items-center gap-3 text-sm">
                {done ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-[var(--success)]/15 text-[var(--success)]">
                    <Check className="h-4 w-4" />
                  </span>
                ) : current ? (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-blue-50 text-[var(--primary)]">
                    <Loader2 className="h-4 w-4 animate-spin" />
                  </span>
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-slate-100 text-slate-400">
                    <span className="h-2 w-2 rounded-full bg-current" />
                  </span>
                )}
                <span
                  className={
                    current || done
                      ? "font-medium text-[var(--text-primary)]"
                      : "text-[var(--text-muted)]"
                  }
                >
                  {label}
                </span>
              </li>
            );
          })}
        </ul>
        <p className="mt-6 rounded-lg bg-slate-50 p-3 text-xs text-[var(--text-secondary)]">
          Tip: Posts with project images get about 3× more impressions on
          LinkedIn.
        </p>
      </div>
    </div>
  );
}
