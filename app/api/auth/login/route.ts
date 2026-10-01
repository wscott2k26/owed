import { NextResponse } from "next/server";
import { rejectCrossSiteMutation } from "../../../../lib/auth/api";
import { prisma } from "../../../../lib/db";
import { hashPassword, verifyPassword } from "../../../../lib/auth/password";
import { createSession } from "../../../../lib/auth/session";

const DUMMY_HASH = hashPassword("OwedTimingGuard2026!");

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  if (password.length > 256) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  const user = await prisma.user.findUnique({ where: { email } });
  const valid = verifyPassword(password, user?.passwordHash || DUMMY_HASH);
  if (!user || !valid) return NextResponse.json({ error: "Email or password is incorrect." }, { status: 401 });
  await createSession(user.id);
  return NextResponse.json({ ok: true });
}
