import "./afford.css";
import { settledAt, type Snapshot } from "../model/economy";
import { RANGES, makeParams, type Funding } from "../model/params";
import { FUNDING_OPTIONS, WORDING } from "./lab/spec";
import { affordLine } from "../model/residents";
import { SCENARIOS, calibrationOf } from "../model/scenarios";
import { iconGroup } from "../scene/icons";
import { segmented, slider } from "../ui/controls";
import { h, s, setAttr, setText, toggleClass } from "../ui/dom";
import { pct } from "../ui/format";
import { LENSES } from "./affordability";
import { gauge, machinesStepper, plateHead } from "./common";

/** Chart viewBoxes: wide and short on desktop, narrower and taller on phones so bars stay legible. */
const SIZES = { wide: { W: 900, H: 300 }, narrow: { W: 560, H: 360 } };
const NARROW_BELOW_PX = 640;
const PAD = { left: 10, right: 10, top: 34, bottom: 30 };
/** Bars never shrink below this, so the poorest households stay visible. */
const MIN_BAR = 3;

/** Who carries the care tax: the top quarter's share of it against the bottom quarter's. */
function whoPays(snap: Snapshot): string {
  const paid = snap.residents.map((r) => r.gross - r.net);
  const total = paid.reduce((a, b) => a + b, 0);
  const q = Math.floor(paid.length / 4);
  const share = (xs: number[]) => xs.reduce((a, b) => a + b, 0) / total;
  return `the top quarter pays ${pct(share(paid.slice(-q)))} of it, the bottom quarter ${pct(share(paid.slice(0, q)))}`;
}

/** The y-axis always shows at least this much, so small differences don't look dramatic. */
const MIN_SCALE = 1.6;
/** Fig. 8: averages versus the bottom quarter, household by household. */
export function mountAfford(host: HTMLElement): void {
  const sc = SCENARIOS.care;
  const cal = calibrationOf(sc);
  const { W, H } = host.clientWidth < NARROW_BELOW_PX ? SIZES.narrow : SIZES.wide;
  let concentration = 0;
  let funding: Funding = "market";
  let progressive = false;
  let doublings = 4;

  const paramsNow = () => makeParams({ ...sc.defaults, concentration, funding, progressiveTax: progressive });
  const first = settledAt(paramsNow(), cal, 0);
  const N = first.residents.length;
  const slot = (W - PAD.left - PAD.right) / N;
  const barW = slot * 0.62;
  const quarterOf = Math.floor(N / 4);
  // One row of marks per household, built once and moved on every repaint.
  const rows = first.residents.map((_, i) => ({
    x: PAD.left + i * slot + slot * 0.19,
    bar: s("rect", { class: "hh__bar", width: barW.toFixed(1), rx: 2 }),
    ghost: s("line", { class: "hh__ghost" }),
    heart: iconGroup("heart", PAD.left + i * slot + slot / 2 - 9, H - PAD.bottom + 6, 18, "hh__heart"),
  }));
  const needLine = s("line", { class: "hh__need", x1: PAD.left, x2: W - PAD.right });
  const chart = s(
    "svg",
    { class: "hh", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": `${N} households ranked by income` },
    s("rect", { class: "hh__quarter", x: PAD.left - 2, y: PAD.top - 24, width: slot * quarterOf + 2, height: H - PAD.top - PAD.bottom + 24, rx: 3 }),
    s("text", { class: "hh__quarter-text", x: PAD.left + 4, y: PAD.top - 10 }, "Bottom quarter"),
    ...rows.map((r) => r.bar),
    ...rows.map((r) => r.ghost),
    needLine,
    ...rows.map((r) => r.heart),
  );

  const avg = gauge("Average household", "time", "");
  const bottom = gauge("Bottom quarter", "coin", "");
  const served = h("p", { class: "verdict" });
  const legendBar = h("span", {});
  const legendGhost = h("span", {});
  const lineLegend = h("span", { class: "hh-legend__item" }, h("span", { class: "hh-legend__dash" }), "Below the dashed line, basic care costs more than half of income");
  const legend = h(
    "p",
    { class: "hh-legend" },
    h("span", { class: "hh-legend__item" }, h("span", { class: "hh-legend__swatch" }), legendBar),
    h("span", { class: "hh-legend__item" }, h("span", { class: "hh-legend__tick" }), legendGhost),
    lineLegend,
  );

  const axisUnit = h("p", { class: "hh-axis" });
  const taxNote = h("p", { class: "plate__footnote" });
  /** Fig. 8's own words for each lens; the lens itself is shared with the lab. */
  const COPY: Record<Funding, { bars: string; ghosts: string; axis: string }> = {
    market: {
      bars: "Each bar: care-hours one hour of a household's income buys",
      ghosts: "Tick: the same household before any machines",
      axis: "↑ care-hours an hour of income buys",
    },
    public: {
      bars: "Each bar: a household's income after the care tax, in gadgets an hour",
      ghosts: "Tick: its income before tax. Care itself is free for everyone",
      axis: "↑ income after tax, gadgets an hour",
    },
  };

  const paint = () => {
    const params = paramsNow();
    const snap = settledAt(params, cal, doublings);
    const start = settledAt(params, cal, 0);
    const lens = LENSES[funding];
    const copy = COPY[funding];
    const marks = lens.bars(snap, start);
    const max = Math.max(MIN_SCALE, ...marks.flatMap((m) => [m.value, m.ghost])) * 1.08;
    const y = (v: number) => H - PAD.bottom - (Math.min(v, max) / max) * (H - PAD.top - PAD.bottom);
    snap.residents.forEach((r, i) => {
      const row = rows[i];
      const mark = marks[i];
      if (!row || !mark) return;
      const top = y(mark.value);
      setAttr(row.bar, "x", row.x.toFixed(1));
      setAttr(row.bar, "y", top.toFixed(1));
      setAttr(row.bar, "height", Math.max(MIN_BAR, H - PAD.bottom - top).toFixed(1));
      const gy = y(mark.ghost).toFixed(1);
      setAttr(row.ghost, "x1", (row.x - 3).toFixed(1));
      setAttr(row.ghost, "x2", (row.x + barW + 3).toFixed(1));
      setAttr(row.ghost, "y1", gy);
      setAttr(row.ghost, "y2", gy);
      toggleClass(row.bar, "is-priced-out", !r.canAfford);
      toggleClass(row.heart, "is-served", r.served);
    });
    // Only households paying at the counter face the affordability line.
    const atCounter = funding === "market";
    const line = y(affordLine(cal.baseShare)).toFixed(1);
    toggleClass(needLine, "is-on", atCounter);
    toggleClass(lineLegend, "is-hidden", !atCounter);
    setAttr(needLine, "y1", line);
    setAttr(needLine, "y2", line);
    setText(legendBar, copy.bars);
    setText(legendGhost, copy.ghosts);
    setText(axisUnit, copy.axis);
    setText(
      taxNote,
      atCounter
        ? ""
        : `Paying at the counter, the town would spend ${pct(settledAt({ ...params, funding: "market" }, cal, doublings).serviceShare)} of its income on care. Public provision mostly changes who pays. (A toy calibration: the shares are illustrative, not forecasts.)`,
    );

    const now = lens.readings(snap);
    const then = lens.readings(start);
    avg.set(now.all.text, now.all.fraction);
    bottom.set(now.bottom.text, now.bottom.fraction);
    avg.describe(lens.unit(sc), atCounter ? `started at ${then.all.text}` : "");
    bottom.describe(lens.unit(sc), atCounter ? `started at ${then.bottom.text}` : "");
    const count = Math.round(snap.coverage * N);
    const tail = atCounter ? (count < N ? " The rest are priced out, though the average looks fine." : "") : ` Taxes take ${pct(snap.publicShare)} of income; ${whoPays(snap)}.`;
    setText(served, `${count} of ${N} households get care.${tail}`);
    toggleClass(served, "is-warning", count < N);
  };

  const conc = slider({
    ...WORDING.concentration,
    min: RANGES.concentration[0],
    max: RANGES.concentration[1],
    step: 0.05,
    value: concentration,
    onInput: (v) => {
      concentration = v;
      paint();
    },
  });
  const tax = segmented<"flat" | "progressive">({
    label: "Tax",
    options: [
      { value: "flat", label: "Flat" },
      { value: "progressive", label: "Progressive" },
    ],
    value: "flat",
    onChange: (v) => {
      progressive = v === "progressive";
      paint();
    },
  });
  const taxWrap = h("div", { class: "is-muted" }, tax.el);
  const fund = segmented<Funding>({
    label: "Who pays for care",
    options: FUNDING_OPTIONS,
    value: funding,
    onChange: (v) => {
      funding = v;
      toggleClass(taxWrap, "is-muted", v !== "public");
      paint();
    },
  });
  const steps = machinesStepper(
    doublings,
    (v) => {
      doublings = v;
      paint();
    },
    true,
  );

  host.append(
    plateHead(8, "Can every household afford it?"),
    h(
      "div",
      { class: "afford-body" },
      h("div", { class: "fig-controls fig-controls--grid" }, conc.el, fund.el, taxWrap, steps.el),
      h("div", { class: "gauges" }, avg.el, bottom.el),
      h("div", { class: "hh-stage" }, legend, h("div", { class: "hh-wrap" }, axisUnit, chart), served, taxNote),
    ),
  );
  paint();
}
