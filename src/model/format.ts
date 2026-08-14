/** Number formatting for the readouts. Pure; no locale surprises. */

/** $12, $12.50, $0.19 — money that reads at a glance. */
export function money(x: number): string {
  if (!Number.isFinite(x)) return "—";
  if (x >= 100) return `$${Math.round(x)}`;
  if (x >= 10) {
    const r = Math.round(x * 10) / 10;
    return Number.isInteger(r) ? `$${r}` : `$${r.toFixed(2)}`;
  }
  if (x >= 1) return `$${x.toFixed(2)}`;
  return `$${x.toFixed(2)}`;
}

/** 1×, 2.5×, 32× — multipliers. */
export function times(x: number): string {
  if (!Number.isFinite(x)) return "—";
  const r = x >= 9.5 ? Math.round(x) : Math.round(x * 10) / 10;
  return `${Number.isInteger(r) ? r : r.toFixed(1)}×`;
}

/** 73% — whole-number percentage. */
export function pct(x: number): string {
  if (!Number.isFinite(x)) return "—";
  return `${Math.round(x * 100)}%`;
}

/** 6.2 hr, 0.8 hr. */
export function hours(x: number): string {
  if (!Number.isFinite(x)) return "—";
  return `${x >= 9.5 ? Math.round(x) : (Math.round(x * 10) / 10).toFixed(1)} hr`;
}

/** 11 days, 3 months. */
export function waitTime(days: number): string {
  if (!Number.isFinite(days)) return "—";
  if (days < 1) return "none";
  if (days < 45) return `${Math.round(days)} days`;
  return `${Math.round(days / 30)} months`;
}

/** Whole-ish people counts for the roster: 11.4 -> "11". */
export function people(x: number): string {
  return `${Math.round(x)}`;
}
