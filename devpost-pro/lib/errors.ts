/** User-facing messages from build guide error table */
export function friendlyError(err: unknown, fallback: string): string {
  const msg =
    err instanceof Error
      ? err.message
      : typeof err === "string"
        ? err
        : "";

  const m = msg.toLowerCase();

  if (m.includes("404") || m.includes("not found"))
    return "This GitHub repository doesn't exist or is private. DevPost Pro only works with public repositories.";
  if (m.includes("rate limit") || m.includes("403"))
    return "We're experiencing high demand. Please try again in a few minutes.";
  if (
    m.includes("linkedin") &&
    (m.includes("scrape") || m.includes("profile"))
  )
    return "We couldn't load your LinkedIn profile details, but we can still generate posts. Some personalization may be reduced.";
  if (m.includes("timeout") || m.includes("aborted"))
    return "AI generation is taking longer than expected. Please try again.";
  if (m.includes("post") && m.includes("fail"))
    return "Your post couldn't be published. Please check your LinkedIn connection and try again, or copy the post text manually.";

  return fallback || "Something went wrong. Please try again.";
}
