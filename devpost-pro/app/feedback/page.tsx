"use client";

import { useState } from "react";
import Link from "next/link";
import { trackEvent } from "@/lib/analytics";

export default function FeedbackPage() {
  const [rating, setRating] = useState(5);
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [status, setStatus] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setStatus(null);
    const res = await fetch("/api/feedback", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating, email, message }),
    });
    setBusy(false);
    if (!res.ok) {
      setStatus("Could not submit feedback. Please try again.");
      return;
    }
    trackEvent("feedback_submit", { rating });
    setMessage("");
    setStatus("Thanks! Your feedback was submitted.");
  }

  return (
    <main className="min-h-screen bg-[var(--bg-secondary)] p-6">
      <div className="mx-auto mt-8 max-w-2xl rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-[var(--text-primary)]">Feedback</h1>
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          Tell us what to improve next.
        </p>
        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block text-sm font-semibold text-[var(--text-primary)]">
            Rating
            <select
              value={rating}
              onChange={(e) => setRating(Number(e.target.value))}
              className="mt-2 w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-[var(--primary)] focus:ring-2"
            >
              {[5, 4, 3, 2, 1].map((n) => (
                <option key={n} value={n}>
                  {n} / 5
                </option>
              ))}
            </select>
          </label>
          <input
            type="email"
            placeholder="Email (optional)"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            className="w-full rounded-xl border border-slate-200 px-4 py-2.5 outline-none ring-[var(--primary)] focus:ring-2"
          />
          <textarea
            required
            placeholder="Your feedback..."
            value={message}
            onChange={(e) => setMessage(e.target.value)}
            rows={6}
            className="w-full rounded-xl border border-slate-200 px-4 py-3 outline-none ring-[var(--primary)] focus:ring-2"
          />
          <button
            type="submit"
            disabled={busy}
            className="rounded-full bg-[var(--text-primary)] px-5 py-2.5 text-sm font-semibold text-white disabled:opacity-60"
          >
            {busy ? "Submitting..." : "Submit feedback"}
          </button>
          {status ? <p className="text-sm text-[var(--text-secondary)]">{status}</p> : null}
        </form>
        <Link href="/" className="mt-6 inline-block text-sm font-semibold text-[var(--primary)]">
          ← Back
        </Link>
      </div>
    </main>
  );
}
