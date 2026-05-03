import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { fetchBackendAnalyze, getBackendUrl } from "@/lib/backend";

export async function POST(req: Request) {
  if (!getBackendUrl()) {
    return NextResponse.json(
      { error: "DEVPOST_BACKEND_URL is not configured." },
      { status: 500 }
    );
  }

  const session = await getServerSession(authOptions);
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const analyzePayload = {
    github_url: body.github_url,
    linkedin_url: body.linkedin_url,
    tone: body.tone ?? "professional",
    linkedin_access_token: session?.linkedinAccessToken ?? "",
    linkedin_user_id: session?.linkedinId ?? "",
  };

  try {
    const response = await fetchBackendAnalyze(analyzePayload);

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        {
          error: "Invalid response from analyzer",
          detail: text.slice(0, 500),
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        {
          error: "Analyzer request failed",
          status: response.status,
          detail: data,
        },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 504 });
  }
}
