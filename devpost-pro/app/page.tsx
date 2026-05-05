"use client";

import { CheckCircle2, Linkedin, Sparkles } from "lucide-react";
import Link from "next/link";
import { signIn, signOut, useSession } from "next-auth/react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { InputForm, type Tone } from "@/components/InputForm";
import { LoadingScreen } from "@/components/LoadingScreen";
import { RejectionScreen } from "@/components/RejectionScreen";
import { trackEvent } from "@/lib/analytics";
import { friendlyError } from "@/lib/errors";
import { RESULTS_STORAGE_KEY } from "@/lib/constants";
import type { AnalyzeRejected, AnalyzeResponse } from "@/lib/types";
import { isAnalyzeSuccess } from "@/lib/types";
import { validateGithubUrl, validateLinkedinUrl } from "@/lib/validation";

export default function HomePage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [githubUrl, setGithubUrl] = useState("");
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [tone, setTone] = useState<Tone>("professional");
  const [githubError, setGithubError] = useState<string | null>(null);
  const [linkedinError, setLinkedinError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  const [rejection, setRejection] = useState<AnalyzeRejected | null>(null);
  const [bannerError, setBannerError] = useState<string | null>(null);
  const [linkedinModal, setLinkedinModal] = useState(false);

  const linkedInConnected =
    status === "authenticated" && !!session?.linkedinAccessToken;

  async function runAnalyze() {
    setBannerError(null);
    setRejection(null);

    const ge = validateGithubUrl(githubUrl.trim());
    const le = validateLinkedinUrl(linkedinUrl.trim());
    setGithubError(ge);
    setLinkedinError(le);
    if (ge || le) return;

    if (!linkedInConnected) {
      setLinkedinModal(true);
      return;
    }
    trackEvent("analyze_submit", { tone });

    await submitAnalyze();
  }

  async function submitAnalyze() {
    setLinkedinModal(false);
    setBusy(true);
    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          github_url: githubUrl.trim().replace(/\/$/, ""),
          linkedin_url: linkedinUrl.trim().replace(/\/$/, ""),
          tone,
        }),
      });

      const data: unknown = await res.json().catch(() => null);

      if (!res.ok || (data && typeof data === "object" && "error" in data)) {
        const errMsg =
          data &&
          typeof data === "object" &&
          "error" in data &&
          typeof (data as { error: unknown }).error === "string"
            ? (data as { error: string }).error
            : "Request failed";
        setBannerError(
          friendlyError(errMsg, "We couldn’t analyze that request. Please try again.")
        );
        return;
      }

      const parsed = data as AnalyzeResponse;
      if (parsed.status === "rejected") {
        setRejection(parsed);
        return;
      }

      if (isAnalyzeSuccess(parsed)) {
        trackEvent("generation_success", { trust_score: parsed.trust.score });
        sessionStorage.setItem(RESULTS_STORAGE_KEY, JSON.stringify(parsed));
        router.push("/results");
        return;
      }

      setBannerError("Unexpected response from analyzer. Please try again.");
    } catch (e) {
      setBannerError(friendlyError(e, "Network error. Please try again."));
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="min-h-screen bg-[var(--bg-secondary)]">
      <LoadingScreen active={busy} />

      {linkedinModal ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Connect LinkedIn for one-click posting
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
              DevPost Pro can generate posts without LinkedIn, but connecting
              unlocks direct publishing. You can still generate now and copy
              manually.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                className="rounded-full bg-[var(--primary)] px-5 py-2.5 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]"
                onClick={() => void signIn("linkedin")}
              >
                Connect LinkedIn
              </button>
              <button
                type="button"
                className="rounded-full border border-slate-200 bg-white px-5 py-2.5 text-sm font-semibold text-[var(--text-primary)] hover:border-slate-300"
                onClick={() => void submitAnalyze()}
              >
                Continue without posting
              </button>
              <button
                type="button"
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
                onClick={() => setLinkedinModal(false)}
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}

      <div className="mx-auto max-w-[1200px] px-6 py-12 md:px-12 md:py-16">
        <header className="flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="flex items-start gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-[var(--primary)] text-white shadow-lg shadow-blue-200">
              <Sparkles className="h-6 w-6" />
            </div>
            <div>
              <p className="text-sm font-semibold text-[var(--primary)]">
                DevPost Pro
              </p>
              <h1 className="mt-1 text-3xl font-bold tracking-tight text-[var(--text-primary)] md:text-4xl">
                Turn your GitHub into your greatest recruiter
              </h1>
              <p className="mt-3 max-w-2xl text-[var(--text-secondary)] leading-relaxed">
                Paste a public repo + your LinkedIn profile. We validate
                authenticity, generate three post variants, and (optionally)
                publish with an image card.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/pricing"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-slate-300"
            >
              Pricing
            </Link>
            <Link
              href="/feedback"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-slate-300"
            >
              Feedback
            </Link>
            <Link
              href="/referrals"
              className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-slate-300"
            >
              Refer
            </Link>
            <button
              type="button"
              onClick={() => void signIn("linkedin")}
              className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--text-primary)] shadow-sm hover:border-slate-300"
            >
              <Linkedin className="h-4 w-4 text-[#0077B5]" />
              Connect LinkedIn
            </button>
            <div
              className={`inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm font-semibold ${
                linkedInConnected
                  ? "bg-emerald-50 text-[var(--success)]"
                  : "bg-slate-100 text-[var(--text-secondary)]"
              }`}
            >
              <CheckCircle2 className="h-4 w-4" />
              {linkedInConnected ? "LinkedIn connected" : "LinkedIn not connected"}
            </div>
            {status === "authenticated" ? (
              <button
                type="button"
                onClick={() => void signOut({ callbackUrl: "/" })}
                className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-slate-300"
              >
                Sign out
              </button>
            ) : (
              <Link
                href="/auth/signin"
                className="rounded-full bg-[var(--text-primary)] px-4 py-2 text-sm font-semibold text-white"
              >
                Sign in
              </Link>
            )}
          </div>
        </header>

        <div className="mt-10 grid gap-8 lg:grid-cols-5 lg:items-start">
          <section className="lg:col-span-3">
            <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm md:p-8">
              {rejection ? (
                <RejectionScreen
                  reason={rejection.rejection_reason}
                  score={rejection.trust_score}
                  breakdown={rejection.score_breakdown}
                  onBack={() => setRejection(null)}
                />
              ) : (
                <>
                  <h2 className="text-lg font-bold text-[var(--text-primary)]">
                    Analyze &amp; generate
                  </h2>
                  <p className="mt-1 text-sm text-[var(--text-secondary)]">
                    The Python backend should expose{" "}
                    <span className="font-mono text-xs">
                      POST /webhook/analyze
                    </span>{" "}
                    (see repo <span className="font-mono text-xs">backend/</span>
                    ).
                  </p>

                  {bannerError ? (
                    <div className="mt-4 rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-900">
                      {bannerError}
                    </div>
                  ) : null}

                  <div className="mt-6">
                    <InputForm
                      githubUrl={githubUrl}
                      linkedinUrl={linkedinUrl}
                      tone={tone}
                      githubError={githubError}
                      linkedinError={linkedinError}
                      onGithubChange={(v) => {
                        setGithubUrl(v);
                        setGithubError(null);
                        setBannerError(null);
                      }}
                      onLinkedinChange={(v) => {
                        setLinkedinUrl(v);
                        setLinkedinError(null);
                        setBannerError(null);
                      }}
                      onToneChange={setTone}
                      disabled={busy}
                    />
                  </div>

                  <div className="mt-4 rounded-xl border border-slate-100 bg-slate-50 p-4 text-sm text-[var(--text-secondary)]">
                    We only process{" "}
                    <span className="font-semibold text-[var(--text-primary)]">
                      public
                    </span>{" "}
                    GitHub repositories.
                  </div>

                  <button
                    type="button"
                    disabled={busy}
                    onClick={() => void runAnalyze()}
                    className="mt-6 w-full rounded-full bg-[var(--text-primary)] py-3 text-sm font-semibold text-white shadow-sm transition hover:opacity-90 disabled:opacity-60"
                  >
                    Analyze &amp; Generate
                  </button>
                </>
              )}
            </div>

            <div className="mt-8 rounded-2xl border border-amber-100 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                Private or non-existent repository?
              </h3>
              <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                DevPost Pro only processes public GitHub repositories. If a repo
                returns 404, make it public in GitHub settings or use a showcase
                README repo instead.
              </p>
            </div>
          </section>

          <aside className="lg:col-span-2">
            <div className="sticky top-8 rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
              <h3 className="text-sm font-bold text-[var(--text-primary)]">
                What the trust score means
              </h3>
              <ul className="mt-4 space-y-3 text-sm text-[var(--text-secondary)]">
                <li>
                  <span className="font-semibold text-[var(--trust-high)]">
                    80+:
                  </span>{" "}
                  Strong authenticity signals — verified badge.
                </li>
                <li>
                  <span className="font-semibold text-[var(--trust-medium)]">
                    60–79:
                  </span>{" "}
                  Proceed with a standard badge / disclaimer path in your
                  workflow.
                </li>
                <li>
                  <span className="font-semibold text-[var(--trust-low)]">
                    &lt;60:
                  </span>{" "}
                  Likely rejected with a specific reason you can action.
                </li>
              </ul>
              <p className="mt-4 text-xs text-[var(--text-muted)] leading-relaxed">
                This app calls the DevPost Pro API (FastAPI + LangGraph), renders
                previews, and (when OAuth is configured) forwards tokens for
                LinkedIn posting.
              </p>
            </div>
          </aside>
        </div>
      </div>
    </main>
  );
}
