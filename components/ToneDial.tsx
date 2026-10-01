"use client";
import { useEffect, useState } from "react";

export default function ToneDial({ customerId, customerName, initialTone, toneMemory, smsOptedOut, smsConsented }: { customerId:string; customerName:string; initialTone:number; toneMemory:string; smsOptedOut?:boolean; smsConsented?:boolean }) {
  const [tone,setTone]=useState(initialTone);
  const [memory,setMemory]=useState(toneMemory);
  const [consent,setConsent]=useState(!!smsConsented && !smsOptedOut);
  const [saved,setSaved]=useState(true);
  const [error,setError]=useState("");
  useEffect(()=>{
    if(saved) return;
    const id=setTimeout(async()=>{
      const res=await fetch(`/api/customers/${customerId}/tone`,{method:"PATCH",headers:{"Content-Type":"application/json"},body:JSON.stringify({toneDial:tone,toneMemory:memory,smsConsent:consent})});
      const data=await res.json().catch(()=>({}));
      if(!res.ok){ setError(data.error||"Could not save customer settings."); setSaved(true); return; }
      setError(""); setSaved(true);
    },500);
    return()=>clearTimeout(id);
  },[customerId,tone,memory,consent,saved]);
  return <div className="card p-5">
    <div className="flex items-baseline justify-between gap-3"><h3 className="truncate text-sm font-semibold">{customerName}</h3><span className="font-mono text-sm text-amber">{tone}</span></div>
    {smsOptedOut&&<p className="mt-1 text-[11px] text-danger">SMS opt-out recorded — SMS stays blocked until the customer opts back in by text.</p>}
    <div className="mt-4"><input type="range" min={0} max={100} value={tone} onChange={e=>{setTone(Number(e.target.value));setSaved(false)}} className="tone-dial w-full" aria-label={`Reminder tone for ${customerName}`}/><div className="mt-1.5 flex justify-between text-[11px] uppercase tracking-widest text-faint"><span>Friendly</span><span>Firm</span></div></div>
    <textarea className="field mt-3 min-h-16 text-xs" value={memory} onChange={e=>{setMemory(e.target.value);setSaved(false)}} placeholder="Tone memory / customer preferences"/>
    <label className="mt-3 flex items-start gap-2 text-xs text-muted"><input type="checkbox" className="mt-0.5" checked={consent} disabled={!!smsOptedOut} onChange={e=>{setConsent(e.target.checked);setSaved(false)}}/><span>I confirm this customer has consented to automated SMS invoice reminders.</span></label>
    {error&&<p className="mt-2 text-[11px] text-danger">{error}</p>}
    <p className="mt-2 text-[11px] text-faint">{saved?"Saved":"Saving…"}</p>
  </div>;
}
