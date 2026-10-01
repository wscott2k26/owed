import { NextResponse } from "next/server";
import { requireApiUser } from "../../../../lib/auth/api";
import { getBillingPortalUrl } from "../../../../lib/integrations/billing";
export async function POST(request: Request) {
  const auth = await requireApiUser(request); if (!auth.user) return auth.response!;
  const base = (process.env.APP_URL || "http://localhost:3000").replace(/\/$/, "");
  const result = await getBillingPortalUrl(auth.user.stripeCustomerId || "", `${base}/dashboard`);
  if (result.ok) return NextResponse.json(result);
  return NextResponse.json({ error: (result as { ok: false; error: string }).error }, { status: 502 });
}
