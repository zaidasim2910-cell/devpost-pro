import { NextResponse } from "next/server";
import { getServerSession } from "next-auth/next";
import { authOptions } from "@/lib/auth";
import { fetchBackendPost, getBackendUrl } from "@/lib/backend";

export async function POST(req: Request) {
  const session = await getServerSession(authOptions);
  if (!session?.linkedinAccessToken || !session.linkedinId) {
    return NextResponse.json(
      { error: "LinkedIn not connected" },
      { status: 401 }
    );
  }

  if (!getBackendUrl()) {
    return NextResponse.json(
      { error: "DEVPOST_BACKEND_URL is not configured." },
      { status: 500 }
    );
  }

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  try {
    const response = await fetchBackendPost(body, {
      access_token: session.linkedinAccessToken,
      linkedin_user_id: session.linkedinId,
    });

    const text = await response.text();
    let data: unknown;
    try {
      data = text ? JSON.parse(text) : null;
    } catch {
      return NextResponse.json(
        {
          error: "Invalid response from post workflow",
          detail: text.slice(0, 500),
        },
        { status: 502 }
      );
    }

    if (!response.ok) {
      return NextResponse.json(
        { error: "Post workflow failed", status: response.status, detail: data },
        { status: 502 }
      );
    }

    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "Request failed";
    return NextResponse.json({ error: message }, { status: 504 });
  }
}
