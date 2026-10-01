"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { formatMoney } from "../lib/format";

export interface ApprovalItem { id: string; invoiceNumber: string; customerName: string; amountCents: number; stage: number; channel: "email"|"sms"; draftBody: string; tone: number; }
export default function ApprovalQueue({ approvals }: { approvals: ApprovalItem[] }) {
  const router = useRouter(); const [editing, setEditing] = useState<string | null>(null); const [drafts, setDrafts] = useState<Record<string,string>>({}); const [busy, setBusy] = useState<string|null>(null); const [error,setError]=useState("");
  async function act(id: string, action: string) { setBusy(id); setError(""); const body: { action: string; draftBody?: string } = { action }; if(action==="edit-and-approve") body.draftBody=drafts[id]; const res=await fetch(`/api/approvals/${id}`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify(body)}); const data=await res.json().catch(()=>({})); setBusy(null); if(!res.ok) return setError(data.error||"Action failed."); setEditing(null); router.refresh(); }
  return <section aria-label="Approval queue" className="min-w-0">
    <div className="flex items-center gap-3"><h2 className="text-lg font-bold">Needs you</h2><span className="rounded-full bg-amber-dim px-2.5 py-0.5 text-xs font-semibold text-amber">{approvals.length}</span></div>
    <p className="mt-1 text-sm text-faint">Firm reminders wait for your approval before sending.</p>{error&&<p className="mt-3 rounded border border-danger/30 bg-danger/10 p-3 text-sm text-danger">{error}</p>}
    <div className="mt-5 space-y-4">{approvals.map(a=><article key={a.id} className="card p-5"><div className="flex flex-wrap items-center gap-2"><span className={`rounded px-2 py-0.5 font-mono text-[11px] font-semibold ${a.channel==="sms"?"bg-amber-dim text-amber":"bg-surface2 text-muted"}`}>{a.channel.toUpperCase()}</span><span className="font-mono text-sm">{a.invoiceNumber}</span><span className="text-sm text-muted">· {a.customerName}</span></div><div className="mt-2 flex flex-wrap gap-2 text-sm"><span className="font-semibold">{formatMoney(a.amountCents)}</span><span className="text-faint">·</span><span className="text-muted">Stage {a.stage+1}</span><span className="text-faint">·</span><span className="text-muted">Tone {a.tone}</span></div>
      {editing===a.id?<textarea className="field mt-4 min-h-40" value={drafts[a.id]??a.draftBody} onChange={e=>setDrafts({...drafts,[a.id]:e.target.value})}/>:<div className="mt-4 rounded-md bg-surface2 border border-hairline p-4"><p className="whitespace-pre-line text-sm leading-relaxed">{a.draftBody}</p></div>}
      <div className="mt-4 flex flex-wrap gap-2">{editing===a.id?<><button disabled={busy===a.id} onClick={()=>act(a.id,"edit-and-approve")} className="btn-primary">Save & send</button><button onClick={()=>setEditing(null)} className="btn-secondary">Cancel</button></>:<><button disabled={busy===a.id} onClick={()=>act(a.id,"approve")} className="btn-primary">{busy===a.id?"Sending…":"Approve & send"}</button><button onClick={()=>{setDrafts({...drafts,[a.id]:a.draftBody});setEditing(a.id)}} className="btn-secondary">Edit</button><button disabled={busy===a.id} onClick={()=>act(a.id,"snooze")} className="btn-secondary">Snooze 24h</button></>}</div></article>)}
      {approvals.length===0&&<p className="card p-6 text-sm text-muted">Queue clear. Nothing awaiting approval right now.</p>}
    </div>
  </section>;
}
