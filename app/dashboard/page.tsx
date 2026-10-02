import { redirect } from "next/navigation";
import DashboardHeader from "../../components/DashboardHeader";
import CashAtRisk from "../../components/CashAtRisk";
import ApprovalQueue from "../../components/ApprovalQueue";
import ToneDial from "../../components/ToneDial";
import InvoiceList from "../../components/InvoiceList";
import CsvImport from "../../components/CsvImport";
import BillingCard from "../../components/BillingCard";
import IntegrationStatus from "../../components/IntegrationStatus";
import VerificationCard from "../../components/VerificationCard";
import ArInsights from "../../components/ArInsights";
import CollectionActivity from "../../components/CollectionActivity";
import { getCurrentUser } from "../../lib/auth/session";
import { prisma } from "../../lib/db";
import { daysOverdue } from "../../lib/escalation/engine";
import { isBillingConfigured } from "../../lib/integrations/billing";
import { isEmailConfigured } from "../../lib/integrations/email";
import { isSmsConfigured } from "../../lib/integrations/sms";
import { isAiConfigured } from "../../lib/integrations/aiDraft";

export const dynamic = "force-dynamic";
export default async function DashboardPage(){
  const user=await getCurrentUser(); if(!user) redirect("/login");
  const [invoices,customers,approvals,activity]=await Promise.all([
    prisma.invoice.findMany({where:{userId:user.id},include:{customer:true},orderBy:{dueDate:"asc"}}),
    prisma.customer.findMany({where:{userId:user.id},include:{invoices:true},orderBy:{name:"asc"}}),
    prisma.approval.findMany({where:{userId:user.id,status:"pending"},include:{invoice:{include:{customer:true}}},orderBy:{createdAt:"asc"}}),
    prisma.reminderEvent.findMany({where:{invoice:{userId:user.id}},include:{invoice:{include:{customer:true}}},orderBy:{sentAt:"desc"},take:8}),
  ]);
  const active=invoices.filter(i=>!["paid","disputed"].includes(i.status)); const cash=active.reduce((s,i)=>s+i.amountCents,0); const now=new Date();
  const overdue=active.map(i=>({...i,days:daysOverdue(i.dueDate,now,user.timezone)})).filter(i=>i.days>0);
  const ranges=[["1–30d",1,30],["31–60d",31,60],["61–90d",61,90],["90+d",91,Number.POSITIVE_INFINITY]] as const;
  const aging=ranges.map(([label,min,max])=>{const rows=overdue.filter(i=>i.days>=min&&i.days<=max);return{label,amountCents:rows.reduce((s,i)=>s+i.amountCents,0),count:rows.length};});
  const priorities=[...overdue].sort((a,b)=>(b.days*b.amountCents)-(a.days*a.amountCents)).slice(0,5).map(i=>({id:i.id,number:i.number,customerName:i.customer.name,amountCents:i.amountCents,daysOverdue:i.days}));
  return <div className="min-h-screen"><DashboardHeader businessName={user.businessName||user.name||user.email} plan={user.plan} sendMode={(process.env.SEND_MODE||"simulate").toLowerCase()}/><main className="mx-auto max-w-6xl px-5 pb-16 sm:px-8"><VerificationCard verified={!!user.emailVerifiedAt}/><div className="pt-8"><CashAtRisk amountCents={cash} openCount={active.length}/></div><div className="mt-6"><ArInsights buckets={aging} priorities={priorities}/></div><div className="mt-6"><CollectionActivity items={activity.map(a=>({id:a.id,customerName:a.invoice.customer.name,invoiceNumber:a.invoice.number,channel:a.channel,stage:a.stage,sentAt:a.sentAt.toISOString(),result:a.result}))}/></div><div className="mt-6 grid gap-4 lg:grid-cols-3"><CsvImport/><BillingCard plan={user.plan} status={user.subscriptionStatus} configured={isBillingConfigured()}/><IntegrationStatus email={isEmailConfigured()} sms={isSmsConfigured()} ai={isAiConfigured()} billing={isBillingConfigured()} sendMode={(process.env.SEND_MODE||"simulate").toLowerCase()} businessName={user.businessName||user.name||""} timezone={user.timezone}/></div>
    <div className="mt-8 grid gap-10 border-t border-hairline pt-8 lg:grid-cols-[2fr_1fr]"><ApprovalQueue approvals={approvals.map(a=>({id:a.id,invoiceNumber:a.invoice.number,customerName:a.invoice.customer.name,amountCents:a.invoice.amountCents,stage:a.stage,channel:a.channel,draftBody:a.draftBody,tone:a.tone}))}/><aside><h2 className="text-lg font-bold">Customers & tone</h2><p className="mt-1 text-sm text-faint">Friendly ↔ firm, saved automatically per customer.</p><div className="mt-5 space-y-4">{customers.map(c=><ToneDial key={c.id} customerId={c.id} customerName={c.name} initialTone={c.toneDial} toneMemory={c.toneMemory||""} smsOptedOut={!!c.smsOptOutAt} smsConsented={!!c.smsConsentAt}/>)}</div></aside></div>
    <div className="mt-8 border-t border-hairline pt-8"><InvoiceList invoices={invoices.map(i=>({id:i.id,number:i.number,customerName:i.customer.name,amountCents:i.amountCents,dueDate:i.dueDate.toISOString().slice(0,10),daysOverdue:daysOverdue(i.dueDate,now,user.timezone),status:i.status}))}/></div><footer className="mt-12 border-t border-hairline pt-6 text-xs text-faint">Replies pause active reminders automatically. SMS opt-outs are honored. {process.env.SEND_MODE?.toLowerCase()==="live"?"Live providers enabled.":"Simulation mode is on; no customer messages leave the app."}</footer></main></div>
}
