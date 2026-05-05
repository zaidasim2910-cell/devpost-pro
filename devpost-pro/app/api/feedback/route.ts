import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { NextResponse } from "next/server";

const DATA_DIR = path.join(process.cwd(), "data");
const FEEDBACK_FILE = path.join(DATA_DIR, "feedback.json");

async function appendFeedback(entry: Record<string, unknown>) {
  await fs.mkdir(DATA_DIR, { recursive: true });
  let items: Record<string, unknown>[] = [];
  try {
    const raw = await fs.readFile(FEEDBACK_FILE, "utf8");
    const parsed = JSON.parse(raw) as Record<string, unknown>[];
    items = Array.isArray(parsed) ? parsed : [];
  } catch {
    items = [];
  }
  items.push(entry);
  await fs.writeFile(FEEDBACK_FILE, JSON.stringify(items, null, 2), "utf8");
}

export async function POST(req: Request) {
  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const rating = Number(body.rating ?? 0);
  const message = String(body.message ?? "").trim();
  const email = String(body.email ?? "").trim();

  if (!message || Number.isNaN(rating) || rating < 1 || rating > 5) {
    return NextResponse.json(
      { error: "Please provide a message and rating between 1-5." },
      { status: 400 }
    );
  }

  await appendFeedback({
    id: randomUUID(),
    rating,
    message,
    email,
    createdAt: new Date().toISOString(),
  });

  return NextResponse.json({ status: "received" });
}
