import { NextResponse } from "next/server";
import { createUser } from "@/lib/user-store";

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const name = String(body.name ?? "").trim();
  const email = String(body.email ?? "").trim().toLowerCase();
  const password = String(body.password ?? "");

  if (!name || !email || !password) {
    return NextResponse.json(
      { error: "Name, email, and password are required." },
      { status: 400 }
    );
  }
  if (password.length < 8) {
    return NextResponse.json(
      { error: "Password must be at least 8 characters." },
      { status: 400 }
    );
  }

  try {
    const user = await createUser({ name, email, password });
    return NextResponse.json({ status: "created", user });
  } catch (e) {
    const message =
      e instanceof Error ? e.message : "Could not create account.";
    return NextResponse.json({ error: message }, { status: 409 });
  }
}
