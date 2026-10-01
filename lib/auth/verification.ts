import { createHash, randomBytes } from "node:crypto";
import { prisma } from "../db";
import { sendEmail } from "../integrations/email";

export async function issueVerificationEmail(user: { id: string; email: string; businessName?: string | null }) {
  const recent = await prisma.emailVerificationToken.findFirst({
    where: { userId: user.id, usedAt: null, createdAt: { gte: new Date(Date.now() - 60_000) } },
    orderBy: { createdAt: "desc" },
  });
  if (recent) return { ok: true as const, rateLimited: true as const };

  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  await prisma.emailVerificationToken.deleteMany({ where: { userId: user.id, usedAt: null } });
  await prisma.emailVerificationToken.create({ data: { userId: user.id, tokenHash, expiresAt: new Date(Date.now() + 24 * 60 * 60_000) } });
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const url = `${base}/api/auth/verify-email?token=${encodeURIComponent(token)}`;
  const sent = await sendEmail({
    to: user.email,
    subject: "Verify your Owed account",
    text: `Verify your email to enable automated invoice reminders for ${user.businessName || "your business"}. This link expires in 24 hours:\n\n${url}\n\nIf you did not create this account, you can ignore this message.`,
  });
  if (!sent.ok) return { ok: false as const, error: (sent as { ok: false; error: string }).error };
  const debugUrl = sent.simulated && process.env.NODE_ENV !== "production" ? url : undefined;
  return { ok: true as const, rateLimited: false as const, ...(debugUrl ? { debugUrl } : {}) };
}
