import { createHash, randomBytes } from "node:crypto";
import { cookies } from "next/headers";
import { prisma } from "../db";
import { intEnv } from "../config";

const cookieName = () => process.env.SESSION_COOKIE_NAME?.trim() || "owed_session";
const sessionDays = () => intEnv("SESSION_DAYS", 30, 1, 365);
const tokenHash = (token: string) => createHash("sha256").update(token).digest("hex");

export async function createSession(userId: string): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + sessionDays() * 86_400_000);
  await prisma.session.create({ data: { userId, tokenHash: tokenHash(token), expiresAt } });
  const store = await cookies();
  store.set(cookieName(), token, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const token = store.get(cookieName())?.value;
  if (token) await prisma.session.deleteMany({ where: { tokenHash: tokenHash(token) } });
  store.set(cookieName(), "", { httpOnly: true, sameSite: "lax", path: "/", expires: new Date(0) });
}

export async function getCurrentUser() {
  const token = (await cookies()).get(cookieName())?.value;
  if (!token) return null;
  const session = await prisma.session.findUnique({
    where: { tokenHash: tokenHash(token) },
    include: { user: true },
  });
  if (!session || session.expiresAt <= new Date()) {
    if (session) await prisma.session.delete({ where: { id: session.id } }).catch(() => undefined);
    return null;
  }
  return session.user;
}
