import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const token = url.searchParams.get("token") || "";
  const base = (process.env.APP_URL || url.origin).replace(/\/$/, "");
  if (!token) return NextResponse.redirect(`${base}/dashboard?verify=invalid`);
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const record = await prisma.emailVerificationToken.findUnique({ where: { tokenHash } });
  if (!record || record.usedAt || record.expiresAt <= new Date()) return NextResponse.redirect(`${base}/dashboard?verify=invalid`);
  await prisma.$transaction([
    prisma.user.update({ where: { id: record.userId }, data: { emailVerifiedAt: new Date() } }),
    prisma.emailVerificationToken.update({ where: { id: record.id }, data: { usedAt: new Date() } }),
    prisma.emailVerificationToken.updateMany({ where: { userId: record.userId, id: { not: record.id }, usedAt: null }, data: { usedAt: new Date() } }),
  ]);
  return NextResponse.redirect(`${base}/dashboard?verified=1`);
}
