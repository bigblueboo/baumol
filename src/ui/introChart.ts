/**
 * The hook chart: what U.S. consumer prices did between 2000 and 2023,
 * rounded from BLS CPI series. Machine-multipliable things fell; things
 * that are mostly a human hour outran inflation. Static — no sim involved.
 */

const NS = "http://www.w3.org/2000/svg";

interface Row {
  label: string;
  /** Percent change, 2000 -> 2023 annual averages, nearest percent. */
  change: number;
  /** BLS CPI-U series id (U.S. city average), for the table twin. */
  series: string;
}

// Computed from BLS CPI-U monthly data (annual averages, 2000 vs 2023),
// fetched from the BLS public API; rounded to the nearest percent.
const ROWS: Row[] = [
  { label: "Hospital services", change: 238, series: "CUUR0000SEMD01" },
  { label: "College tuition & fees", change: 178, series: "CUUR0000SEEB01" },
  { label: "Day care & preschool", change: 123, series: "CUUR0000SEEB03" },
  { label: "New vehicles", change: 25, series: "CUUR0000SETA01" },
  { label: "Wireless phone service", change: -37, series: "CUUR0000SEED03" },
  { label: "Computer software", change: -72, series: "CUUR0000SEEE02" },
  { label: "Televisions", change: -98, series: "CUUR0000SERA01" },
];

const AVERAGE = 77; // all items (CUUR0000SA0), same computation

const RISE = "#c25a34";
const FALL = "#2f6aa8";

// Labels sit above their bars so the chart survives a 390px screen.
const W = 640;
const ROW_H = 47;
const M = { l: 8, r: 58, t: 30, b: 6 };
const MIN = -100;
const MAX = 260;
const BAR_H = 17;

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

function x(v: number): number {
  return M.l + ((v - MIN) / (MAX - MIN)) * (W - M.l - M.r);
}

export function buildIntroChart(host: HTMLElement): void {
  const H = M.t + ROWS.length * ROW_H + M.b;
  const svg = el("svg", {
    viewBox: `0 0 ${W} ${H}`,
    role: "img",
    "aria-label":
      "Change in U.S. consumer prices from 2000 to 2023: hospital services, college tuition, and childcare roughly doubled or tripled while software and televisions fell by 70 to 97 percent. Values are in the table below.",
  });
  // the chart sits above its caption, which is already in the markup
  host.insertBefore(svg, host.firstElementChild);

  // zero baseline and the overall-inflation reference
  el("line", { x1: x(0), x2: x(0), y1: M.t - 8, y2: H - M.b, stroke: "var(--ink-faint)", "stroke-width": 1.5 }, svg);
  el("line", { x1: x(AVERAGE), x2: x(AVERAGE), y1: M.t - 8, y2: H - M.b, stroke: "var(--hairline)", "stroke-width": 1.5 }, svg);
  const avgLbl = el("text", { x: x(AVERAGE), y: M.t - 14, "font-size": 13, fill: "var(--ink-faint)", "text-anchor": "middle" }, svg);
  avgLbl.textContent = `overall inflation +${AVERAGE}%`;

  ROWS.forEach((r, i) => {
    const rowTop = M.t + i * ROW_H;
    const cy = rowTop + 32; // bar center; label sits above
    const w = Math.abs(x(r.change) - x(0));
    const bx = r.change >= 0 ? x(0) : x(r.change);
    const rise = r.change >= 0;
    const h2 = BAR_H / 2;
    // rounded data-end, square at the zero baseline
    const path = rise
      ? `M${bx} ${cy - h2} h${w - 4} a4 4 0 0 1 4 4 v${BAR_H - 8} a4 4 0 0 1 -4 4 h${-(w - 4)} z`
      : `M${bx + w} ${cy - h2} h${-(w - 4)} a4 4 0 0 0 -4 4 v${BAR_H - 8} a4 4 0 0 0 4 4 h${w - 4} z`;
    el("path", { d: path, fill: rise ? RISE : FALL }, svg);

    // category label above the bar, aligned to the bar's own side of zero
    const name = el("text", {
      x: rise ? x(0) + 4 : x(0) - 4,
      y: rowTop + 12,
      "font-size": 14.5,
      fill: "var(--ink)",
      "text-anchor": rise ? "start" : "end",
    }, svg);
    name.textContent = r.label;

    // a fall reaching the left edge carries its value inside the bar
    const inside = !rise && x(r.change) < 52;
    const val = el("text", {
      x: rise ? x(r.change) + 7 : inside ? x(r.change) + 6 : x(r.change) - 7,
      y: cy + 4.5,
      "font-size": 14,
      "font-weight": 650,
      fill: inside ? "var(--paper)" : "var(--ink-soft)",
      "text-anchor": rise || inside ? "start" : "end",
    }, svg);
    val.textContent = `${r.change > 0 ? "+" : ""}${r.change}%`;
  });

  const table = document.createElement("details");
  table.className = "table-view";
  table.innerHTML =
    `<summary>Read as a table (with BLS series IDs)</summary><table><thead><tr><th>Item</th><th>CPI-U series</th><th>2000 → 2023</th></tr></thead><tbody>` +
    ROWS.map(
      (r) =>
        `<tr><td>${r.label}</td><td>${r.series}</td><td>${r.change > 0 ? "+" : ""}${r.change}%</td></tr>`,
    ).join("") +
    `<tr><td>All items</td><td>CUUR0000SA0</td><td>+${AVERAGE}%</td></tr></tbody></table>`;
  host.appendChild(table);
}
