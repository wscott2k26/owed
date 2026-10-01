import { formatMoney } from "../lib/format";

interface CashAtRiskProps {
  amountCents: number;
  openCount: number;
}

/** Hero card: total collectible amount outstanding. Server component. */
export default function CashAtRisk({ amountCents, openCount }: CashAtRiskProps) {
  return (
    <section
      aria-label="Cash at risk"
      className="border-t-2 border-t-amber bg-surface border border-hairline rounded-lg px-6 py-8 sm:px-10"
    >
      <p className="text-sm uppercase tracking-[0.18em] text-muted">
        Cash at risk
      </p>
      <p className="tnum mt-3 text-5xl sm:text-6xl font-bold text-ink leading-none">
        {formatMoney(amountCents)}
      </p>
      <p className="mt-4 text-sm text-faint">
        across{" "}
        <span className="text-muted">
          {openCount} open invoice{openCount === 1 ? "" : "s"}
        </span>
      </p>
    </section>
  );
}
