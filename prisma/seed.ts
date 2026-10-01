import { readFileSync } from "node:fs";
import { join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { PrismaClient, Prisma } from "@prisma/client";
import { importCsv } from "../lib/import/validate.js";
import { DEFAULT_POLICY } from "../lib/escalation/engine.js";
import { hashPassword } from "../lib/auth/password.js";
import { processEscalations } from "../lib/services/reminders.js";

const root = join(dirname(fileURLToPath(import.meta.url)), "..");
const prisma = new PrismaClient({ datasourceUrl: process.env.DATABASE_URL ?? `file:${join(root,"prisma","dev.db")}` });

async function main(){
  const csvText=readFileSync(join(root,"data","sample-invoices.csv"),"utf8"); const {records,errors}=importCsv(csvText); if(errors.length) throw new Error(errors.map(e=>`line ${e.line}: ${e.message}`).join("\n"));
  await prisma.approval.deleteMany(); await prisma.reminderEvent.deleteMany(); await prisma.invoice.deleteMany(); await prisma.customer.deleteMany(); await prisma.escalationPolicy.deleteMany(); await prisma.passwordResetToken.deleteMany(); await prisma.emailVerificationToken.deleteMany(); await prisma.session.deleteMany(); await prisma.user.deleteMany();
  const user=await prisma.user.create({data:{email:"demo@owed.local",name:"Demo Owner",businessName:"Acme Plumbing & Heating",passwordHash:hashPassword("DemoPass2026!"),emailVerifiedAt:new Date(),timezone:"America/New_York",subscriptionStatus:"trialing",trialEndsAt:new Date(Date.now()+14*86_400_000),plan:"pro"}});
  await prisma.escalationPolicy.create({data:{userId:user.id,name:"Default",stages:DEFAULT_POLICY.stages as unknown as Prisma.InputJsonValue}});
  const cache=new Map<string,string>(); const tones=[15,45,70,90]; let ti=0;
  for(const r of records){ let customerId=cache.get(r.customerName); if(!customerId){const tone=tones[ti++%tones.length]; const c=await prisma.customer.create({data:{userId:user.id,name:r.customerName,email:r.customerEmail||null,phone:r.customerPhone||null,smsConsentAt:r.customerPhone?new Date():null,smsConsentSource:r.customerPhone?"demo_seed":null,toneDial:tone,toneMemory:tone<34?"Prefers a gentle nudge; keep it light.":tone<67?"Direct, professional reminders work best.":"Has needed firm reminders before; stay professional."}}); customerId=c.id; cache.set(r.customerName,c.id);} await prisma.invoice.create({data:{userId:user.id,customerId,number:r.number,amountCents:r.amountCents,dueDate:r.dueDate,notes:r.notes||null,status:"open"}}); }
  const stats = await processEscalations(new Date());
  console.log(`Seeded ${records.length} invoices; reminder QA: ${stats.sent} simulated sends, ${stats.approvalsCreated} approvals. Demo login: demo@owed.local / DemoPass2026!`);
}
main().catch(e=>{console.error(e);process.exit(1)}).finally(()=>prisma.$disconnect());
