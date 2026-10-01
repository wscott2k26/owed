import { NextResponse } from "next/server";
import { destroySession } from "../../../../lib/auth/session";
import { rejectCrossSiteMutation } from "../../../../lib/auth/api";
export async function POST(request: Request) {
  const rejected = rejectCrossSiteMutation(request); if (rejected) return rejected;
  await destroySession(); return NextResponse.json({ ok: true });
}
