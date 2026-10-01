import { NextResponse } from "next/server";
import { getCurrentUser } from "./session";

export function rejectCrossSiteMutation(request: Request): NextResponse | null {
  const origin = request.headers.get("origin");
  if (!origin) return null; // server-to-server clients and same-origin navigations may omit it
  let expected: string;
  try { expected = new URL(process.env.APP_URL || request.url).origin; }
  catch { return NextResponse.json({ error: "Server origin is not configured correctly." }, { status: 500 }); }
  if (origin !== expected) return NextResponse.json({ error: "Cross-site request rejected." }, { status: 403 });
  return null;
}

export async function requireApiUser(request?: Request) {
  if (request) {
    const rejected = rejectCrossSiteMutation(request);
    if (rejected) return { user: null, response: rejected };
  }
  const user = await getCurrentUser();
  if (!user) return { user: null, response: NextResponse.json({ error: "Unauthorized" }, { status: 401 }) };
  return { user, response: null };
}
