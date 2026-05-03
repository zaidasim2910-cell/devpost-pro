/**
 * Server-side calls to the Python DevPost Pro backend (FastAPI).
 * Set DEVPOST_BACKEND_URL (server) or NEXT_PUBLIC_DEVPOST_BACKEND_URL for builds that expose it.
 */

function backendUrl(): string | null {
  return (
    process.env.DEVPOST_BACKEND_URL?.trim() ||
    process.env.NEXT_PUBLIC_DEVPOST_BACKEND_URL?.trim() ||
    null
  );
}

export function getBackendUrl(): string | null {
  return backendUrl();
}

function joinPath(base: string, path: string): string {
  return `${base.replace(/\/$/, "")}${path.startsWith("/") ? path : `/${path}`}`;
}

export async function fetchBackendAnalyze(body: unknown): Promise<Response> {
  const base = backendUrl();
  if (!base) {
    throw new Error("DEVPOST_BACKEND_URL is not configured.");
  }
  return fetch(joinPath(base, "/webhook/analyze"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(120_000),
  });
}

export async function fetchBackendPost(
  body: Record<string, unknown>,
  auth: { access_token: string; linkedin_user_id: string }
): Promise<Response> {
  const base = backendUrl();
  if (!base) {
    throw new Error("DEVPOST_BACKEND_URL is not configured.");
  }
  return fetch(joinPath(base, "/webhook/post-to-linkedin"), {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ ...body, ...auth }),
    signal: AbortSignal.timeout(120_000),
  });
}
