import { NextResponse } from "next/server";
import { rejectCrossSiteMutation } from "../../../../lib/auth/api";
import { Prisma } from "@prisma/client";
import { prisma } from "../../../../lib/db";
import { hashPassword, validatePassword } from "../../../../lib/auth/password";
import { createSession } from "../../../../lib/auth/session";
import { DEFAULT_POLICY } from "../../../../lib/escalation/engine";
import { issueVerificationEmail } from "../../../../lib/auth/verification";

export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  const body = await request.json().catch(() => ({}));
  const email = String(body.email || "").trim().toLowerCase();
  const password = String(body.password || "");
  const businessName = String(body.businessName || "").trim();
  const name = String(body.name || "").trim();
  const timezone = String(body.timezone || "America/New_York").trim();
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return NextResponse.json({ error: "Enter a valid email address." }, { status: 400 });
  if (!businessName) return NextResponse.json({ error: "Business name is required." }, { status: 400 });
  const pwError = validatePassword(password); if (pwError) return NextResponse.json({ error: pwError }, { status: 400 });
  try { new Intl.DateTimeFormat("en-US", { timeZone: timezone }).format(); } catch { return NextResponse.json({ error: "Invalid timezone." }, { status: 400 }); }
  try {
    const user = await prisma.user.create({ data: { email, passwordHash: hashPassword(password), businessName, name: name || null, timezone, trialEndsAt: new Date(Date.now() + 14 * 86_400_000) } });
    await prisma.escalationPolicy.create({ data: { userId: user.id, stages: DEFAULT_POLICY.stages as unknown as Prisma.InputJsonValue } });
    await createSession(user.id);
    const verification = await issueVerificationEmail(user);
    const debugUrl = verification.ok && "debugUrl" in verification ? verification.debugUrl : undefined;
    return NextResponse.json({ ok: true, verificationSent: verification.ok, ...(debugUrl ? { debugUrl } : {}) });
  } catch (error: unknown) {
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === "P2002") return NextResponse.json({ error: "An account with that email already exists." }, { status: 409 });
    return NextResponse.json({ error: "Could not create account." }, { status: 500 });
  }
}
