"use client";

import { Github, Linkedin } from "lucide-react";

export type Tone = "professional" | "casual" | "bold";

export function InputForm({
  githubUrl,
  linkedinUrl,
  tone,
  githubError,
  linkedinError,
  onGithubChange,
  onLinkedinChange,
  onToneChange,
  disabled,
}: {
  githubUrl: string;
  linkedinUrl: string;
  tone: Tone;
  githubError: string | null;
  linkedinError: string | null;
  onGithubChange: (v: string) => void;
  onLinkedinChange: (v: string) => void;
  onToneChange: (t: Tone) => void;
  disabled?: boolean;
}) {
  const tones: { id: Tone; label: string }[] = [
    { id: "professional", label: "Professional" },
    { id: "casual", label: "Casual" },
    { id: "bold", label: "Bold" },
  ];

  return (
    <div className="space-y-6">
      <div>
        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Github className="h-4 w-4 text-[var(--primary)]" aria-hidden />
          GitHub repository URL
        </label>
        <input
          type="url"
          autoComplete="off"
          disabled={disabled}
          placeholder="https://github.com/username/repo-name"
          value={githubUrl}
          onChange={(e) => onGithubChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[var(--text-primary)] shadow-sm outline-none ring-[var(--primary)] transition focus:ring-2 disabled:opacity-60"
        />
        {githubError ? (
          <p className="mt-2 text-sm text-[var(--danger)]">{githubError}</p>
        ) : null}
      </div>

      <div>
        <label className="mb-2 flex items-center gap-2 text-sm font-semibold text-[var(--text-primary)]">
          <Linkedin className="h-4 w-4 text-[var(--primary)]" aria-hidden />
          LinkedIn profile URL
        </label>
        <input
          type="url"
          autoComplete="off"
          disabled={disabled}
          placeholder="https://www.linkedin.com/in/your-handle"
          value={linkedinUrl}
          onChange={(e) => onLinkedinChange(e.target.value)}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-3 text-[var(--text-primary)] shadow-sm outline-none ring-[var(--primary)] transition focus:ring-2 disabled:opacity-60"
        />
        {linkedinError ? (
          <p className="mt-2 text-sm text-[var(--danger)]">{linkedinError}</p>
        ) : null}
      </div>

      <fieldset>
        <legend className="mb-3 text-sm font-semibold text-[var(--text-primary)]">
          Tone
        </legend>
        <div className="flex flex-wrap gap-3">
          {tones.map((t) => (
            <label
              key={t.id}
              className={`flex cursor-pointer items-center gap-2 rounded-full border px-4 py-2 text-sm font-semibold transition ${
                tone === t.id
                  ? "border-[var(--primary)] bg-blue-50 text-[var(--primary)]"
                  : "border-slate-200 bg-white text-[var(--text-secondary)] hover:border-slate-300"
              } ${disabled ? "pointer-events-none opacity-60" : ""}`}
            >
              <input
                type="radio"
                name="tone"
                className="sr-only"
                checked={tone === t.id}
                onChange={() => onToneChange(t.id)}
                disabled={disabled}
              />
              {t.label}
            </label>
          ))}
        </div>
      </fieldset>
    </div>
  );
}
