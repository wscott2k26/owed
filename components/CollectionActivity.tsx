type Item = {
  id: string;
  customerName: string;
  invoiceNumber: string;
  channel: "email" | "sms";
  stage: number;
  sentAt: string;
  result: string | null;
};

export default function CollectionActivity({ items }: { items: Item[] }) {
  return <section className="card p-5">
    <div className="flex items-center justify-between gap-3">
      <div><h2 className="text-lg font-bold">Collection activity</h2><p className="mt-1 text-sm text-faint">A shared timeline of recent reminder touches.</p></div>
      <span className="text-xs text-faint">Last {items.length}</span>
    </div>
    <div className="mt-4 space-y-2">
      {items.length ? items.map(item => <div key={item.id} className="flex items-center justify-between gap-3 rounded-md bg-surface2 px-3 py-2">
        <div className="min-w-0"><p className="truncate text-sm font-semibold">{item.customerName}</p><p className="text-xs text-faint">{item.invoiceNumber} · stage {item.stage} · {item.channel.toUpperCase()}</p></div>
        <div className="text-right"><p className="text-xs text-muted">{new Date(item.sentAt).toLocaleDateString("en-US",{month:"short",day:"numeric"})}</p><p className="max-w-40 truncate text-[11px] text-faint">{item.result || "sent"}</p></div>
      </div>) : <p className="text-sm text-faint">No reminder activity yet.</p>}
    </div>
  </section>;
}
