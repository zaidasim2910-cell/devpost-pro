import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import bcrypt from "bcryptjs";

export type StoredUser = {
  id: string;
  name: string;
  email: string;
  passwordHash: string;
  createdAt: string;
};

const DATA_DIR = path.join(process.cwd(), "data");
const USERS_FILE = path.join(DATA_DIR, "users.json");

async function ensureStore() {
  await fs.mkdir(DATA_DIR, { recursive: true });
  try {
    await fs.access(USERS_FILE);
  } catch {
    await fs.writeFile(USERS_FILE, "[]", "utf8");
  }
}

async function readUsers(): Promise<StoredUser[]> {
  await ensureStore();
  const raw = await fs.readFile(USERS_FILE, "utf8");
  const parsed = JSON.parse(raw) as StoredUser[];
  return Array.isArray(parsed) ? parsed : [];
}

async function writeUsers(users: StoredUser[]) {
  await ensureStore();
  await fs.writeFile(USERS_FILE, JSON.stringify(users, null, 2), "utf8");
}

export async function createUser(input: {
  name: string;
  email: string;
  password: string;
}): Promise<{ id: string; name: string; email: string }> {
  const email = input.email.trim().toLowerCase();
  const users = await readUsers();
  if (users.some((u) => u.email === email)) {
    throw new Error("An account with this email already exists.");
  }

  const passwordHash = await bcrypt.hash(input.password, 10);
  const user: StoredUser = {
    id: randomUUID(),
    name: input.name.trim(),
    email,
    passwordHash,
    createdAt: new Date().toISOString(),
  };
  users.push(user);
  await writeUsers(users);
  return { id: user.id, name: user.name, email: user.email };
}

export async function verifyUserPassword(
  emailInput: string,
  password: string
): Promise<{ id: string; email: string; name: string } | null> {
  const email = emailInput.trim().toLowerCase();
  const users = await readUsers();
  const found = users.find((u) => u.email === email);
  if (!found) return null;
  const ok = await bcrypt.compare(password, found.passwordHash);
  if (!ok) return null;
  return { id: found.id, email: found.email, name: found.name };
}
