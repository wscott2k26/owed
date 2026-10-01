/** Money formatting — always integer cents in, tabular-nums out. */

export function formatMoney(cents: number, currency = "USD"): string {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency,
    minimumFractionDigits: 2,
  }).format(cents / 100);
}

/** Whole-dollar shorthand for dense UI, e.g. $12.4k */
export function formatMoneyShort(cents: number): string {
  const dollars = cents / 100;
  if (Math.abs(dollars) >= 1000) {
    return `$${(dollars / 1000).toFixed(1)}k`;
  }
  return `$${dollars.toFixed(0)}`;
}

export function daysOverdue(dueDate: Date, now: Date = new Date()): number {
  const ms = now.getTime() - dueDate.getTime();
  return Math.max(0, Math.floor(ms / 86_400_000));
}
