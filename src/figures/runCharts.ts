import { type Axis, type Mark, type Pt } from "../charts/xy";
import type { Snapshot } from "../model/economy";
import type { Scenario } from "../model/scenarios";
import { num } from "../ui/format";

/** Every long run on the page, the casebook's and the lab's, lasts this many years. */
export const RUN_YEARS = 40;

export interface RunSample {
  t: number;
  snap: Snapshot;
}

export const YEARS_AXIS: Axis = { min: 0, max: RUN_YEARS, ticks: [0, 10, 20, 30, 40], format: String, label: "Years" };
export const SHARE_AXIS: Axis = { min: 0, max: 1, ticks: [0, 0.5, 1], format: (v) => `${Math.round(v * 100)}%` };
/** Wide enough for a price that falls (caseloads, robots) or climbs a hundredfold. */
export const PRICE_AXIS: Axis = { min: 0.25, max: 256, log: true, ticks: [0.25, 1, 4, 16, 64, 256], format: num };

const series = (samples: RunSample[], f: (s: Snapshot) => number): Pt[] => samples.map(({ t, snap }) => [t, f(snap)]);

/** The service's price against what pure Baumol (productivity ratio alone) would give. */
export function priceMarks(samples: RunSample[]): Mark[] {
  return [
    { kind: "line", points: series(samples, (s) => s.goodsTech / s.serviceTech), tone: "muted", dashed: true, label: "pure Baumol" },
    { kind: "line", points: series(samples, (s) => s.price), tone: "time", label: "actual" },
  ];
}

/** Who works where: the service's workers below, the factory's above. */
export function jobsMarks(samples: RunSample[], sc: Scenario): Mark[] {
  const care = series(samples, (s) => s.careWorkers / s.population);
  return [
    { kind: "band", lower: care.map(([x]) => [x, 0]), upper: care, tone: "time", label: sc.service.worker.many },
    { kind: "band", lower: care, upper: care.map(([x]) => [x, 1]), tone: "things", label: sc.goods.worker.many },
  ];
}

/** Access, quality and how much of the service still comes from a person. */
export function accessMarks(samples: RunSample[]): Mark[] {
  return [
    { kind: "line", points: series(samples, (s) => s.coverage), tone: "time", label: "served" },
    { kind: "line", points: series(samples, (s) => s.quality), tone: "coin", label: "quality" },
    { kind: "line", points: series(samples, (s) => s.presence), tone: "muted", dashed: true, label: "human" },
  ];
}
