import { formatMoney } from "../lib/format";

type Bucket = { label: string; amountCents: number; count: number };
type Priority = { id: string; number: string; customerName: string; amountCents: number; daysOverdue: number };

export default function ArInsights({ buckets, priorities }: { buckets: Bucket[]; priorities: Priority[] }) {
  return <section className="grid gap-4 lg:grid-cols-[1.2fr_.8fr]">
    <article className="card p-5">
      <div className="flex items-center justify-between"><div><h2 className="text-lg font-bold">AR aging</h2><p className="mt-1 text-sm text-faint">See where overdue cash is stacking up.</p></div><span className="text-xs text-faint">Live</span></div>
      <div className="mt-4 grid gap-2 sm:grid-cols-4">{buckets.map(b=><div key={b.label} className="rounded-md bg-surface2 px-3 py-3"><p className="text-[11px] uppercase tracking-widest text-faint">{b.label}</p><p className="mt-1 text-lg font-bold tnum">{formatMoney(b.amountCents)}</p><p className="mt-1 text-xs text-muted">{b.count} invoice{b.count===1?"":"s"}</p></div>)}</div>
    </article>
    <article className="card p-5">
      <div><h2 className="text-lg font-bold">Focus today</h2><p className="mt-1 text-sm text-faint">Highest-value overdue invoices, prioritized by age and amount.</p></div>
      <div className="mt-4 space-y-2">{priorities.length?priorities.map(i=><div key={i.id} className="flex items-center justify-between gap-3 rounded-md bg-surface2 px-3 py-2"><div className="min-w-0"><p className="truncate text-sm font-semibold">{i.customerName}</p><p className="text-xs text-faint">{i.number} · {i.daysOverdue}d overdue</p></div><span className="text-sm font-bold tnum">{formatMoney(i.amountCents)}</span></div>):<p className="text-sm text-faint">Nothing overdue. Nice.</p>}</div>
    </article>
  </section>;
}
