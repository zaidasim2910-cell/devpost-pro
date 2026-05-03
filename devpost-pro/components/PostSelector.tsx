"use client";

import { PostPreviewCard } from "@/components/PostPreviewCard";
import type { Post } from "@/lib/types";

export type PostKey = "technical" | "story" | "announcement";

const ORDER: PostKey[] = ["technical", "story", "announcement"];

export function PostSelector({
  posts,
  selected,
  recruiterScore,
  onSelect,
  onContentChange,
  onHashtagsChange,
  recruiterReasoning,
}: {
  posts: Record<PostKey, Post>;
  selected: PostKey | null;
  recruiterScore: (key: PostKey) => number;
  onSelect: (key: PostKey) => void;
  onContentChange: (key: PostKey, content: string) => void;
  onHashtagsChange: (key: PostKey, hashtags: string[]) => void;
  recruiterReasoning?: string;
}) {
  return (
    <section>
      <h2 className="text-lg font-bold text-[var(--text-primary)]">
        Post variants
      </h2>
      {recruiterReasoning ? (
        <p className="mt-1 text-sm text-[var(--text-secondary)]">
          {recruiterReasoning}
        </p>
      ) : null}
      <div className="mt-4 grid gap-5 lg:grid-cols-3">
        {ORDER.map((key) => (
          <PostPreviewCard
            key={key}
            post={posts[key]}
            recruiterScore={recruiterScore(key)}
            isSelected={selected === key}
            onSelect={() => onSelect(key)}
            onContentChange={(c) => onContentChange(key, c)}
            onHashtagsChange={(tags) => onHashtagsChange(key, tags)}
          />
        ))}
      </div>
    </section>
  );
}
