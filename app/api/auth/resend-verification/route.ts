import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../lib/auth/api";
import { issueVerificationEmail } from "../../../../lib/auth/verification";

export async function POST(request: Request) {
  const auth = await requireApiUser(request); if (!auth.user) return auth.response!;
  if (auth.user.emailVerifiedAt) return NextResponse.json({ ok: true, message: "Email is already verified." });
  const result = await issueVerificationEmail(auth.user);
  if (!result.ok) return NextResponse.json({ error: result.error }, { status: 502 });
  return NextResponse.json({ ok: true, message: result.rateLimited ? "A verification email was already requested. Try again in a minute." : "Verification email sent.", ...(("debugUrl" in result && result.debugUrl) ? { debugUrl: result.debugUrl } : {}) });
}
