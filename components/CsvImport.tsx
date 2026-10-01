"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
export default function CsvImport() {
  const router = useRouter(); const [message, setMessage] = useState(""); const [busy, setBusy] = useState(false);
  async function submit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault(); setBusy(true); setMessage(""); const form = new FormData(e.currentTarget);
    const res = await fetch("/api/invoices/import", { method: "POST", body: form });
    const data = await res.json().catch(() => ({})) as { error?: string; details?: Array<{ line: number; message: string }>; imported?: number; updated?: number };
    setBusy(false);
    if (!res.ok) { const detail = Array.isArray(data.details) ? ` ${data.details.slice(0,3).map((x)=>`Line ${x.line}: ${x.message}`).join(" ")}` : ""; return setMessage((data.error || "Import failed.") + detail); }
    setMessage(`Imported ${data.imported ?? 0}; updated ${data.updated ?? 0}.`); (e.currentTarget as HTMLFormElement).reset(); router.refresh();
  }
  return <section className="card p-5">
    <h2 className="text-lg font-bold">Import invoices</h2><p className="mt-1 text-sm text-faint">CSV columns: invoice_number, customer_name, customer_email, customer_phone, amount, due_date, notes.</p>
    <form onSubmit={submit} className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center"><input name="file" type="file" accept=".csv,text/csv" required className="text-sm text-muted file:mr-3 file:rounded file:border-0 file:bg-surface2 file:px-3 file:py-2 file:text-ink"/><button disabled={busy} className="btn-primary shrink-0">{busy ? "Importing…" : "Import CSV"}</button></form>
    {message && <p className="mt-3 text-xs text-muted">{message}</p>}
  </section>;
}
