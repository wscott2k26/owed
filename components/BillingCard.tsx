"use client";
import { useState } from "react";
export default function BillingCard({ plan, status, configured }: { plan: string; status: string; configured: boolean }) {
  const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function post(path: string, body?: unknown) { setBusy(true); setMessage(""); const res = await fetch(path, { method:"POST", headers: body ? {"Content-Type":"application/json"} : undefined, body: body ? JSON.stringify(body) : undefined }); const data = await res.json().catch(()=>({})); setBusy(false); if(!res.ok) return setMessage(data.error || "Billing action failed."); if(data.url) window.location.href = data.url; }
  return <section className="card p-5"><div className="flex items-center justify-between gap-3"><div><h2 className="text-lg font-bold">Plan</h2><p className="mt-1 text-sm text-faint">{plan} · {status}</p></div><span className={`rounded-full px-2.5 py-1 text-xs ${configured ? "bg-success/15 text-success" : "bg-surface2 text-muted"}`}>{configured ? "Stripe ready" : "Stripe not configured"}</span></div>
    <div className="mt-4 flex flex-wrap gap-2"><button disabled={busy || !configured} onClick={()=>post("/api/billing/checkout", {plan:"starter"})} className="btn-secondary">Starter $29</button><button disabled={busy || !configured} onClick={()=>post("/api/billing/checkout", {plan:"pro"})} className="btn-primary">Pro $39</button><button disabled={busy || !configured} onClick={()=>post("/api/billing/portal")} className="btn-secondary">Manage billing</button></div>{message && <p className="mt-3 text-xs text-danger">{message}</p>}
  </section>;
}
