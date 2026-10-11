const FRACTIONS: [number, string][] = [
  [0.25, "¼"],
  [0.5, "½"],
  [0.75, "¾"],
];

/** Friendly numbers: whole when close, one decimal when small, grouped when large. */
export function num(x: number): string {
  if (!Number.isFinite(x)) return "—";
  const a = Math.abs(x);
  if (a >= 1000) return Math.round(x).toLocaleString("en-US");
  if (a >= 20) return String(Math.round(x));
  if (Math.abs(x - Math.round(x)) < 0.05) return String(Math.round(x));
  if (a >= 0.1) return x.toFixed(1);
  return x.toFixed(2);
}

/** Like num, but prefers vulgar fractions for quarters: 3¾, 7½. */
export function quarters(x: number): string {
  const whole = Math.floor(x);
  const frac = x - whole;
  if (frac < 0.03) return String(whole);
  for (const [v, glyph] of FRACTIONS) if (Math.abs(frac - v) < 0.03) return whole === 0 ? glyph : `${whole}${glyph}`;
  if (frac > 0.97) return String(whole + 1);
  return num(x);
}

export function pct(x: number): string {
  return `${Math.round(x * 100)}%`;
}

export function times(x: number): string {
  return `${num(x)}×`;
}

export function minutes(m: number): string {
  if (m >= 1) return `${quarters(m)} min`;
  const sec = m * 60;
  return sec >= 1 ? `${Math.round(sec)} sec` : `${sec.toFixed(1)} sec`;
}

/** Waits under a day read as none: nobody is being turned away. */
export function days(d: number): string {
  if (d < 1) return "none";
  if (d >= 365) return "a year+";
  return `${Math.round(d)} ${Math.round(d) === 1 ? "day" : "days"}`;
}

/** Singular only when the number would print as exactly 1. */
export function plural(n: number, one: string, many: string): string {
  return num(n) === "1" ? one : many;
}

export function count(n: number, one: string, many: string): string {
  return `${num(n)} ${plural(n, one, many)}`;
}

export function capitalize(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1);
}
