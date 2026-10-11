import "./metrics.css";
import type { Snapshot } from "../model/economy";
import { type Scenario } from "../model/scenarios";
import { h, setText, toggleClass } from "../ui/dom";
import { capitalize, days, num, pct, times } from "../ui/format";

export type MetricKey = "price" | "wage" | "workers" | "coverage" | "wait" | "quality" | "public" | "material";

interface Metric {
  key: MetricKey;
  label: (sc: Scenario) => string;
  value: (s: Snapshot, sc: Scenario) => string;
  sub: (s: Snapshot, sc: Scenario) => string;
  /** The underlying number, for comparing runs. */
  raw: (s: Snapshot) => number;
  better: "low" | "high" | null;
  /** 0..1 for a gauge under the number; omitted for unbounded values. */
  gauge?: (s: Snapshot) => number;
  /** When the reading should be flagged as a problem. */
  alarm?: (s: Snapshot) => boolean;
}

/** Who goes without, and why: priced out, rationed, or (no hardship) chose an alternative. */
function unservedNote(s: Snapshot): string | null {
  const parts = [
    s.pricedOut ? `${s.pricedOut} priced out` : "",
    s.rationed ? `${s.rationed} without a place` : "",
    s.optedOut ? `${s.optedOut} chose an alternative` : "",
  ].filter(Boolean);
  return parts.length ? parts.join(" · ") : null;
}

/** Share of the town going without against its will. */
const deprived = (s: Snapshot) => (s.pricedOut + s.rationed) / s.population;

/** Waits beyond this many days fill the gauge. */
const WAIT_GAUGE_DAYS = 60;

export const METRICS: Metric[] = [
  {
    key: "price",
    label: (sc) => `One ${sc.service.one}`,
    value: (s) => num(s.price),
    sub: (_s, sc) => `costs, in ${sc.goods.many}`,
    raw: (s) => s.price,
    better: "low",
  },
  {
    key: "wage",
    label: () => "Average wage",
    value: (s, sc) => num(s.averageWage * sc.perHour),
    sub: (_s, sc) => `${sc.goods.many} an hour`,
    raw: (s) => s.averageWage,
    better: null,
  },
  {
    key: "workers",
    label: () => "Workers",
    value: (s) => `${Math.round(s.factoryWorkers)} / ${Math.round(s.careWorkers)}`,
    sub: (_s, sc) => `${sc.goods.worker.many} / ${sc.service.worker.many}`,
    raw: (s) => s.careWorkers,
    better: null,
  },
  {
    key: "coverage",
    label: (sc) => `${capitalize(sc.clients.many)} served`,
    value: (s) => pct(s.coverage),
    sub: (s, sc) => unservedNote(s) ?? `${Math.round(s.coverage * s.population)} of ${s.population} ${sc.clients.many}`,
    raw: (s) => s.coverage,
    better: "high",
    gauge: (s) => s.coverage,
    alarm: (s) => deprived(s) > 0.2,
  },
  {
    key: "wait",
    label: () => "Average wait",
    // Rationing without a waiting list is still rationing: say so instead of "none".
    value: (s) => (s.waitDays < 1 && s.rationed > 0 ? "turned away" : days(s.waitDays)),
    sub: (s) => (s.waitDays >= 1 ? "to be seen" : s.rationed > 0 ? "no waiting list is kept" : "no queue"),
    // Being turned away outright ranks with the longest wait when comparing runs.
    raw: (s) => (s.rationed > 0 && s.waitDays < 1 ? 365 : s.waitDays),
    better: "low",
    gauge: (s) => s.waitDays / WAIT_GAUGE_DAYS,
    alarm: (s) => s.waitDays > 10 || (s.waitDays < 1 && s.rationed > 0),
  },
  {
    key: "quality",
    label: () => "Quality",
    value: (s) => pct(s.quality),
    sub: (s) => (s.presence < 0.99 ? `${pct(s.presence)} from a person` : "all from a person"),
    raw: (s) => s.quality,
    better: "high",
    gauge: (s) => s.quality,
    alarm: (s) => s.quality < 0.8,
  },
  {
    key: "public",
    label: () => "Public budget",
    value: (s) => pct(s.publicShare),
    sub: () => "of the town's income",
    raw: (s) => s.publicShare,
    better: "low",
    gauge: (s) => s.publicShare,
  },
  {
    key: "material",
    label: () => "Material wealth",
    value: (s) => times(s.material),
    sub: (_s, sc) => `${sc.goods.many} per head vs. the start`,
    raw: (s) => s.material,
    better: "high",
  },
];

/** The eight readouts the design asks to keep on screen. */
export function metricsPanel(sc: Scenario) {
  let scenario = sc;
  const cells = METRICS.map((m) => {
    const label = h("span", { class: "metric__label" });
    const value = h("span", { class: "metric__value" });
    const sub = h("span", { class: "metric__sub" });
    const fill = h("span", { class: "metric__fill" });
    const el = h("div", { class: `metric metric--${m.key}` }, label, value, sub, m.gauge ? h("span", { class: "metric__gauge" }, fill) : null);
    return { m, el, label, value, sub, fill };
  });
  const el = h("div", { class: "metrics", role: "group", "aria-label": "Town readouts" }, ...cells.map((c) => c.el));
  return {
    el,
    setScenario(next: Scenario) {
      scenario = next;
    },
    update(s: Snapshot) {
      for (const c of cells) {
        setText(c.label, c.m.label(scenario));
        setText(c.value, c.m.value(s, scenario));
        setText(c.sub, c.m.sub(s, scenario));
        if (c.m.gauge) c.fill.style.transform = `scaleX(${Math.max(0, Math.min(1, c.m.gauge(s))).toFixed(3)})`;
        toggleClass(c.el, "is-alarm", c.m.alarm?.(s) ?? false);
      }
    },
  };
}
