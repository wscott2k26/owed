import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { rejectCrossSiteMutation } from "../../../../lib/auth/api";
import { prisma } from "../../../../lib/db";
import { hashPassword, validatePassword } from "../../../../lib/auth/password";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const body = await request.json().catch(() => ({}));
  const token = String(body.token || ""); const password = String(body.password || "");
  const pwError = validatePassword(password); if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });
  if (!token) return NextResponse.json({ error: "Reset token is missing." }, { status: 400 });
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const reset = await prisma.passwordResetToken.findUnique({ where: { tokenHash } });
  if (!reset || reset.usedAt || reset.expiresAt <= new Date()) return NextResponse.json({ error: "This reset link is invalid or expired." }, { status: 400 });
  await prisma.$transaction([
    prisma.user.update({ where: { id: reset.userId }, data: { passwordHash: hashPassword(password) } }),
    prisma.passwordResetToken.update({ where: { id: reset.id }, data: { usedAt: new Date() } }),
    prisma.session.deleteMany({ where: { userId: reset.userId } }),
  ]);
  return NextResponse.json({ ok: true });
}
