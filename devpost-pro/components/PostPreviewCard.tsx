"use client";

import { useMemo, useState } from "react";
import type { Post } from "@/lib/types";

const MAX = 3000;

export function PostPreviewCard({
  post,
  recruiterScore,
  isSelected,
  onSelect,
  onContentChange,
  onHashtagsChange,
}: {
  post: Post;
  recruiterScore: number;
  isSelected: boolean;
  onSelect: () => void;
  onContentChange: (content: string) => void;
  onHashtagsChange: (tags: string[]) => void;
}) {
  const [editing, setEditing] = useState(false);
  const len = post.content.length;
  const barPct = Math.min(100, (len / MAX) * 100);
  const barColor =
    len > MAX * 0.95 ? "var(--danger)" : len > MAX * 0.85 ? "var(--warning)" : "var(--success)";

  const hashtagString = useMemo(() => post.hashtags.join(" "), [post.hashtags]);

  return (
    <div
      className={`flex h-full flex-col rounded-2xl border bg-white p-5 shadow-sm transition ${
        isSelected
          ? "border-[var(--primary)] ring-2 ring-blue-100"
          : "border-slate-200 hover:border-slate-300"
      }`}
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div>
          <p className="text-xs font-semibold uppercase tracking-wide text-[var(--text-muted)]">
            Post variant
          </p>
          <h3 className="mt-1 text-lg font-bold text-[var(--text-primary)]">
            {post.post_type}
          </h3>
        </div>
        <span className="rounded-full bg-slate-100 px-3 py-1 text-xs font-semibold text-[var(--text-secondary)]">
          {recruiterScore}/10 recruiter appeal
        </span>
      </div>

      <p className="mt-3 text-xs text-[var(--text-secondary)]">
        Best time: {post.best_time_to_post}
      </p>
      <p className="text-xs text-[var(--text-muted)]">{post.expected_reach}</p>

      <div className="mt-4 flex-1">
        {editing ? (
          <textarea
            value={post.content}
            onChange={(e) => onContentChange(e.target.value)}
            onBlur={() => setEditing(false)}
            autoFocus
            className="min-h-[160px] w-full resize-y rounded-xl border border-slate-200 bg-slate-50 p-3 text-sm text-[var(--text-primary)] outline-none ring-[var(--primary)] focus:ring-2"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="w-full rounded-xl border border-transparent bg-slate-50 p-3 text-left text-sm text-[var(--text-primary)] transition hover:border-slate-200"
          >
            {post.content}
          </button>
        )}
        <div className="mt-2 h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className="h-full rounded-full transition-all"
            style={{ width: `${barPct}%`, background: barColor }}
          />
        </div>
        <p className="mt-1 text-right text-xs text-[var(--text-muted)]">
          {len} / {MAX}
        </p>
      </div>

      <div className="mt-4">
        <label className="text-xs font-semibold text-[var(--text-secondary)]">
          Hashtags
        </label>
        <input
          type="text"
          className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none ring-[var(--primary)] focus:ring-2"
          value={hashtagString}
          onChange={(e) =>
            onHashtagsChange(
              e.target.value
                .split(/\s+/)
                .map((t) => t.trim())
                .filter(Boolean)
            )
          }
        />
      </div>

      <button
        type="button"
        onClick={onSelect}
        className={`mt-5 w-full rounded-full py-3 text-sm font-semibold transition ${
          isSelected
            ? "bg-[var(--primary)] text-white"
            : "border border-slate-200 bg-white text-[var(--text-primary)] hover:border-slate-300"
        }`}
      >
        {isSelected ? "Selected" : "Select this post"}
      </button>
    </div>
  );
}
