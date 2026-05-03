"use client";

import { CheckCircle2, ClipboardList, Copy, Linkedin, Loader2 } from "lucide-react";
import { useSession } from "next-auth/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ImageCard, type ImageCardHandle } from "@/components/ImageCard";
import { PostSelector, type PostKey } from "@/components/PostSelector";
import { TrustDisclaimerBanner } from "@/components/TrustDisclaimerBanner";
import { TrustScoreCard } from "@/components/TrustScoreCard";
import { RESULTS_STORAGE_KEY } from "@/lib/constants";
import { blobToBase64 } from "@/lib/blob";
import { friendlyError } from "@/lib/errors";
import type { AnalyzeSuccess, Post } from "@/lib/types";
import { isAnalyzeSuccess } from "@/lib/types";

export default function ResultsPage() {
  const router = useRouter();
  const { data: session, status } = useSession();

  const [data, setData] = useState<AnalyzeSuccess | null>(null);
  const [posts, setPosts] = useState<AnalyzeSuccess["posts"] | null>(null);
  const [selected, setSelected] = useState<PostKey | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [posting, setPosting] = useState(false);
  const [postError, setPostError] = useState<string | null>(null);
  const [postSuccess, setPostSuccess] = useState<{
    post_url?: string;
    message?: string;
  } | null>(null);
  const imageCardRef = useRef<ImageCardHandle>(null);
  const [oneClickBusy, setOneClickBusy] = useState(false);
  const [oneClickHint, setOneClickHint] = useState<string | null>(null);

  useEffect(() => {
    const raw = sessionStorage.getItem(RESULTS_STORAGE_KEY);
    if (!raw) {
      router.replace("/");
      return;
    }
    try {
      const parsed = JSON.parse(raw) as unknown;
      if (!isAnalyzeSuccess(parsed)) {
        router.replace("/");
        return;
      }
      setData(parsed);
      setPosts(parsed.posts);
    } catch {
      router.replace("/");
    }
  }, [router]);

  const linkedInConnected =
    status === "authenticated" && !!session?.linkedinAccessToken;

  const updateContent = useCallback((key: PostKey, content: string) => {
    setPosts((p) => (p ? { ...p, [key]: { ...p[key], content } } : p));
  }, []);

  const updateHashtags = useCallback((key: PostKey, hashtags: string[]) => {
    setPosts((p) => (p ? { ...p, [key]: { ...p[key], hashtags } } : p));
  }, []);

  const selectedPost: Post | null = useMemo(() => {
    if (!selected || !posts) return null;
    return posts[selected];
  }, [posts, selected]);

  const recruiterScore = useCallback(
    (key: PostKey) => {
      if (!data) return 7;
      if (key === "technical") return data.recruiter_scores.technical_post;
      if (key === "story") return data.recruiter_scores.story_post;
      return data.recruiter_scores.announcement_post;
    },
    [data]
  );

  const buildExportText = useCallback(() => {
    if (!selectedPost || !data) return "";
    const hashtags = selectedPost.hashtags.join(" ");
    const repo = data.profile.github.url;
    return `${selectedPost.content}\n\n${hashtags}${
      repo ? `\n\n${repo}` : ""
    }`.trim();
  }, [data, selectedPost]);

  async function copySelected() {
    if (!selectedPost) return;
    await navigator.clipboard.writeText(buildExportText());
  }

  async function oneClickExport() {
    if (!selectedPost || !data) return;
    setOneClickBusy(true);
    setOneClickHint(null);
    try {
      const blob = await imageCardRef.current?.capture();
      if (!blob) {
        setOneClickHint(
          "Could not capture the image card. Scroll to the Image card section and try again."
        );
        return;
      }
      const text = buildExportText();
      const safeBase =
        data.profile.github.repo_name
          .replace(/[^a-z0-9]+/gi, "-")
          .toLowerCase()
          .replace(/^-+|-+$/g, "") || "devpost-pro-card";

      try {
        await navigator.clipboard.write([
          new ClipboardItem({
            "text/plain": new Blob([text], { type: "text/plain" }),
            "image/png": blob,
          }),
        ]);
        setOneClickHint(
          "Copied post text, hashtags, repo link, and image to your clipboard."
        );
      } catch {
        await navigator.clipboard.writeText(text);
        const url = URL.createObjectURL(blob);
        const filename = `${safeBase}-linkedin-card.png`;
        const a = document.createElement("a");
        a.href = url;
        a.download = filename;
        a.rel = "noopener";
        a.style.display = "none";
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.setTimeout(() => URL.revokeObjectURL(url), 2500);
        setOneClickHint(
          "Copied post text to clipboard and downloaded the PNG (your browser wouldn’t store image + text together)."
        );
      }

      const dl = typeof window !== "undefined" ? window : undefined;
      const layer = dl && (dl as unknown as { dataLayer?: Record<string, unknown>[] }).dataLayer;
      if (layer) {
        layer.push({ event: "devpost_one_click_export" });
      }
    } catch (e) {
      setOneClickHint(friendlyError(e, "Could not finish export."));
    } finally {
      setOneClickBusy(false);
    }
  }

  async function publish() {
    if (!data || !selected || !posts) return;
    setPostError(null);
    const p = posts[selected];
    if (!imageBlob) {
      setPostError(
        "Capture the image card first (tap Regenerate image once in the Image card section)."
      );
      return;
    }
    if (!linkedInConnected) {
      setPostError("Connect LinkedIn from the home page to publish directly.");
      return;
    }

    setPosting(true);
    try {
      const image_base64 = await blobToBase64(imageBlob);
      const res = await fetch("/api/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          post_content: p.content,
          hashtags: p.hashtags,
          image_base64,
          image_html: data.image_card.html,
          repo_name: data.profile.github.repo_name,
        }),
      });
      const payload: unknown = await res.json().catch(() => null);
      if (!res.ok || (payload && typeof payload === "object" && "error" in payload)) {
        const errMsg =
          payload &&
          typeof payload === "object" &&
          "error" in payload &&
          typeof (payload as { error: unknown }).error === "string"
            ? (payload as { error: string }).error
            : "Post failed";
        setPostError(friendlyError(errMsg, "Couldn’t publish to LinkedIn."));
        return;
      }
      setPostSuccess(payload as { post_url?: string; message?: string });
      setConfirmOpen(false);
    } catch (e) {
      setPostError(friendlyError(e, "Couldn’t publish to LinkedIn."));
    } finally {
      setPosting(false);
    }
  }

  if (!data || !posts) {
    return (
      <main className="flex min-h-screen items-center justify-center bg-[var(--bg-secondary)]">
        <Loader2 className="h-8 w-8 animate-spin text-[var(--primary)]" />
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[var(--bg-secondary)]">
      <div className="mx-auto max-w-[1200px] px-6 py-10 md:px-12">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <h1 className="text-2xl font-bold text-[var(--text-primary)]">
              Your generated posts
            </h1>
            <p className="mt-1 text-sm text-[var(--text-secondary)]">
              Preview, edit, capture the image card, then publish or copy.
            </p>
          </div>
          <Link
            href="/"
            className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-slate-300"
          >
            New analysis
          </Link>
        </div>

        <div className="mt-8 space-y-8">
          <TrustScoreCard
            score={data.trust.score}
            level={data.trust.level}
            badge={data.trust.badge}
            breakdown={data.trust.breakdown}
          />

          {data.trust.level === "MEDIUM" ? <TrustDisclaimerBanner /> : null}

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Project summary
            </h2>
            <div className="mt-4 grid gap-4 md:grid-cols-2">
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">
                  GitHub
                </p>
                <p className="mt-1 text-xl font-bold text-[var(--text-primary)]">
                  {data.profile.github.repo_name}
                </p>
                <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
                  {data.profile.github.description || "—"}
                </p>
                <div className="mt-3 flex flex-wrap gap-2 text-xs font-semibold text-[var(--text-secondary)]">
                  <span>⭐ {data.profile.github.stars}</span>
                  <span>·</span>
                  <span>{data.profile.github.commits} commits</span>
                  <span>·</span>
                  <span>{data.profile.github.contributors} contributors</span>
                  <span>·</span>
                  <span>{data.profile.github.language}</span>
                </div>
              </div>
              <div>
                <p className="text-xs font-semibold uppercase text-[var(--text-muted)]">
                  LinkedIn
                </p>
                <p className="mt-1 text-lg font-bold text-[var(--text-primary)]">
                  {data.profile.linkedin.name}
                </p>
                <p className="mt-1 text-sm text-[var(--text-secondary)]">
                  {data.profile.linkedin.headline}
                </p>
                <p className="mt-1 text-xs text-[var(--text-muted)]">
                  {data.profile.linkedin.location}
                </p>
              </div>
            </div>

            <div className="mt-5">
              <p className="text-xs font-semibold text-[var(--text-secondary)]">
                Tech stack
              </p>
              <div className="mt-2 flex flex-wrap gap-2">
                {Object.values(data.tech_stack)
                  .flat()
                  .slice(0, 24)
                  .map((t) => (
                    <span
                      key={t}
                      className="rounded-full bg-blue-50 px-3 py-1 text-xs font-semibold text-[var(--primary)]"
                    >
                      {t}
                    </span>
                  ))}
              </div>
            </div>
          </section>

          <PostSelector
            posts={posts}
            selected={selected}
            recruiterScore={recruiterScore}
            onSelect={setSelected}
            onContentChange={updateContent}
            onHashtagsChange={updateHashtags}
            recruiterReasoning={data.recruiter_scores.reasoning}
          />

          <ImageCard
            ref={imageCardRef}
            html={data.image_card.html}
            onCapture={setImageBlob}
            downloadBasename={
              data.profile.github.repo_name
                .replace(/[^a-z0-9]+/gi, "-")
                .toLowerCase()
                .replace(/^-+|-+$/g, "") || "devpost-pro-card"
            }
          />

          <section className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Post actions
            </h2>
            {postSuccess ? (
              <div className="mt-4 rounded-xl border border-emerald-200 bg-emerald-50 p-4 text-sm text-emerald-950">
                <div className="flex items-center gap-2 font-semibold">
                  <CheckCircle2 className="h-5 w-5" />
                  {postSuccess.message ?? "Your post is live on LinkedIn."}
                </div>
                {postSuccess.post_url ? (
                  <a
                    className="mt-2 inline-block text-sm font-semibold text-[var(--primary)] hover:underline"
                    href={postSuccess.post_url}
                    target="_blank"
                    rel="noreferrer"
                  >
                    View post
                  </a>
                ) : null}
              </div>
            ) : null}

            {!selectedPost ? (
              <p className="mt-3 text-sm text-[var(--text-secondary)]">
                Select a post variant above to enable actions.
              </p>
            ) : (
              <div className="mt-4 space-y-4">
                <p className="text-sm text-[var(--text-secondary)]">
                  Selected:{" "}
                  <span className="font-semibold text-[var(--text-primary)]">
                    {selectedPost.post_type}
                  </span>
                </p>
                <button
                  type="button"
                  disabled={oneClickBusy}
                  onClick={() => void oneClickExport()}
                  className="flex w-full flex-wrap items-center justify-center gap-2 rounded-2xl bg-gradient-to-r from-[var(--primary)] to-indigo-600 px-5 py-3.5 text-sm font-semibold text-white shadow-md transition hover:opacity-95 disabled:opacity-60 md:inline-flex md:w-auto"
                >
                  {oneClickBusy ? (
                    <Loader2 className="h-5 w-5 animate-spin" />
                  ) : (
                    <ClipboardList className="h-5 w-5" />
                  )}
                  One-click: copy text &amp; tags + save image
                </button>
                {oneClickHint ? (
                  <p className="text-sm text-[var(--text-secondary)]">{oneClickHint}</p>
                ) : null}
                {postError ? (
                  <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-900">
                    {postError}
                  </div>
                ) : null}
                <div className="flex flex-wrap gap-3 border-t border-slate-100 pt-4">
                  <button
                    type="button"
                    onClick={() => void copySelected()}
                    className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-[var(--text-primary)] hover:border-slate-300"
                  >
                    <Copy className="h-4 w-4" />
                    Copy text only
                  </button>

                  {linkedInConnected ? (
                    <button
                      type="button"
                      onClick={() => setConfirmOpen(true)}
                      className="inline-flex items-center gap-2 rounded-full bg-[var(--primary)] px-4 py-2 text-sm font-semibold text-white hover:bg-[var(--primary-hover)]"
                    >
                      <Linkedin className="h-4 w-4" />
                      Post to LinkedIn now
                    </button>
                  ) : (
                    <p className="w-full text-sm text-[var(--text-secondary)]">
                      Want one-click publishing? Connect LinkedIn on the home
                      page.
                    </p>
                  )}
                </div>
              </div>
            )}
          </section>

          <p className="text-xs text-[var(--text-muted)]">
            Generated {new Date(data.generated_at).toLocaleString()}
          </p>
        </div>
      </div>

      {confirmOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 p-6 backdrop-blur-sm">
          <div className="w-full max-w-lg rounded-2xl border border-slate-200 bg-white p-6 shadow-2xl">
            <h2 className="text-lg font-bold text-[var(--text-primary)]">
              Confirm publish
            </h2>
            <p className="mt-2 text-sm text-[var(--text-secondary)] leading-relaxed">
              You’re about to post as{" "}
              <span className="font-semibold text-[var(--text-primary)]">
                {data.profile.linkedin.name}
              </span>
              . Make sure the selected text and image look right.
            </p>
            <div className="mt-5 flex flex-wrap gap-3">
              <button
                type="button"
                disabled={posting}
                onClick={() => void publish()}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--text-primary)] px-5 py-2.5 text-sm font-semibold text-white hover:opacity-90 disabled:opacity-60"
              >
                {posting ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : null}
                Confirm post
              </button>
              <button
                type="button"
                disabled={posting}
                onClick={() => setConfirmOpen(false)}
                className="rounded-full px-5 py-2.5 text-sm font-semibold text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </main>
  );
}
