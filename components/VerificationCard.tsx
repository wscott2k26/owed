"use client";
import { useState } from "react";

export default function VerificationCard({ verified }: { verified: boolean }) {
  const [message,setMessage]=useState("");
  const [debugUrl,setDebugUrl]=useState("");
  const [busy,setBusy]=useState(false);
  if (verified) return null;
  async function resend(){
    setBusy(true); setMessage(""); setDebugUrl("");
    const response=await fetch('/api/auth/resend-verification',{method:'POST'});
    const data=await response.json().catch(()=>({})); setBusy(false);
    if(!response.ok){ setMessage(data.error||'Could not send verification email.'); return; }
    setMessage(data.message||'Verification email sent.'); if(data.debugUrl) setDebugUrl(data.debugUrl);
  }
  return <section className="mt-6 rounded-lg border border-amber/30 bg-amber-dim p-4 text-sm">
    <div className="flex flex-wrap items-center justify-between gap-3"><div><p className="font-semibold text-amber">Verify your account email</p><p className="mt-1 text-muted">Automated reminders stay disabled until the account owner verifies the signup email.</p></div><button disabled={busy} onClick={resend} className="btn-secondary">{busy?'Sending…':'Resend verification'}</button></div>
    {message&&<p className="mt-3 text-xs text-muted">{message}</p>}
    {debugUrl&&<a className="mt-2 block break-all text-xs text-amber underline" href={debugUrl}>Local simulation verification link</a>}
  </section>;
}
