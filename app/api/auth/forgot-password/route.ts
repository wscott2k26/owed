import { createHash, randomBytes } from "node:crypto";
import { NextResponse } from "next/server";
import { rejectCrossSiteMutation } from "../../../../lib/auth/api";
import { prisma } from "../../../../lib/db";
import { sendEmail } from "../../../../lib/integrations/email";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const user = email ? await prisma.user.findUnique({ where: { email } }) : null;
  let debugUrl: string | undefined;
  if (user) {
    const recent = await prisma.passwordResetToken.findFirst({ where: { userId: user.id, usedAt: null, createdAt: { gte: new Date(Date.now() - 60_000) } } });
    if (!recent) {
      const token = randomBytes(32).toString("base64url");
      const tokenHash = createHash("sha256").update(token).digest("hex");
      await prisma.passwordResetToken.deleteMany({ where: { userId: user.id, usedAt: null } });
      await prisma.passwordResetToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 60 * 60_000) } });
      const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
      const url = `${base}/reset-password?token=${encodeURIComponent(token)}`;
      const sent = await sendEmail({ to: user.email, subject: "Reset your Owed password", text: `A password reset was requested for your Owed account. This link expires in one hour:\n\n${url}\n\nIf you did not request this, you can ignore this message.` });
      if (sent.ok && sent.simulated && process.env.NODE_ENV !== "production") debugUrl = url;
    }
  }
  return NextResponse.json({ ok: true, message: "If an account exists for that email, a reset link has been sent.", ...(debugUrl ? { debugUrl } : {}) });
}
