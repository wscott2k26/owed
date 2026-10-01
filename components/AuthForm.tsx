"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";

export default function AuthForm({ mode }: { mode: "login" | "signup" }) {
  const router = useRouter(); const [error, setError] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setError("");
    const form = new FormData(e.currentTarget);
    const body: Record<string, string> = Object.fromEntries([...form.entries()].map(([k,v]) => [k, String(v)]));
    if (mode === "signup") body.timezone = Intl.DateTimeFormat().resolvedOptions().timeZone || "America/New_York";
    const res = await fetch(`/api/auth/${mode}`, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body) });
    const data = await res.json().catch(() => ({})); setBusy(false);
    if (!res.ok) return setError(data.error || "Something went wrong.");
    if (mode === "signup" && data.debugUrl) { window.location.href = data.debugUrl; return; }
    router.push("/dashboard"); router.refresh();
  }
  return <form onSubmit={submit} className="mt-8 space-y-4">
    {mode === "signup" && <>
      <label className="block"><span className="text-sm text-muted">Your name</span><input name="name" autoComplete="name" className="field mt-1" placeholder="Will" /></label>
      <label className="block"><span className="text-sm text-muted">Business name</span><input name="businessName" required className="field mt-1" placeholder="Acme Plumbing" /></label>
    </>}
    <label className="block"><span className="text-sm text-muted">Email</span><input name="email" type="email" required autoComplete="email" className="field mt-1" placeholder="you@business.com" /></label>
    <label className="block"><span className="text-sm text-muted">Password</span><input name="password" type="password" required autoComplete={mode === "login" ? "current-password" : "new-password"} className="field mt-1" placeholder="••••••••••" /></label>
    {mode === "signup" && <p className="text-xs text-faint">10+ characters with uppercase, lowercase, and a number.</p>}
    {error && <p role="alert" className="rounded-md border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
    <button disabled={busy} className="btn-primary w-full">{busy ? "Working…" : mode === "login" ? "Sign in" : "Create account"}</button>
  </form>;
}
