import { NextResponse } from "next/server";
import { prisma } from "../../../../lib/db";
import { requireApiUser } from "../../../../lib/auth/api";
import { importCsv } from "../../../../lib/import/validate";
import { intEnv } from "../../../../lib/config";

export async function POST(request: Request) {
  const auth = await requireApiUser(request); if (!auth.user) return auth.response!;
  const form = await request.formData(); const file = form.get("file");
  if (!(file instanceof File)) return NextResponse.json({ error: "Attach a CSV file." }, { status: 400 });
  if (file.size > 2_000_000) return NextResponse.json({ error: "CSV must be under 2 MB." }, { status: 413 });
  const text = await file.text(); const parsed = importCsv(text);
  const maxRows = intEnv("MAX_INVOICES_PER_IMPORT", 1000, 1, 10_000);
  if (parsed.records.length > maxRows) return NextResponse.json({ error: `CSV exceeds the ${maxRows}-invoice import safety limit.` }, { status: 413 });
  if (parsed.errors.length) return NextResponse.json({ error: "CSV has validation errors.", details: parsed.errors.slice(0, 25) }, { status: 400 });
  let imported = 0; let updated = 0;
  for (const row of parsed.records) {
    let customer = row.customerEmail ? await prisma.customer.findFirst({ where: { userId: auth.user.id, email: row.customerEmail } }) : null;
    if (!customer && row.customerPhone) customer = await prisma.customer.findFirst({ where: { userId: auth.user.id, phone: row.customerPhone } });
    if (!customer) customer = await prisma.customer.findFirst({ where: { userId: auth.user.id, name: row.customerName } });
    if (!customer) customer = await prisma.customer.create({ data: { userId: auth.user.id, name: row.customerName, email: row.customerEmail || null, phone: row.customerPhone || null } });
    else customer = await prisma.customer.update({ where: { id: customer.id }, data: { name: row.customerName, email: row.customerEmail || customer.email, phone: row.customerPhone || customer.phone } });
    const existing = await prisma.invoice.findUnique({ where: { userId_number: { userId: auth.user.id, number: row.number } } });
    await prisma.invoice.upsert({
      where: { userId_number: { userId: auth.user.id, number: row.number } },
      update: { customerId: customer.id, amountCents: row.amountCents, dueDate: row.dueDate, notes: row.notes || null },
      create: { userId: auth.user.id, customerId: customer.id, number: row.number, amountCents: row.amountCents, dueDate: row.dueDate, notes: row.notes || null },
    });
    if (existing) updated += 1;
    else imported += 1;
  }
  return NextResponse.json({ ok: true, imported, updated });
}
