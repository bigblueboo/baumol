import type { Funding, NumKey, Params } from "../../model/params";
import type { Scenario } from "../../model/scenarios";
import type { Option } from "../../ui/controls";
import { pct } from "../../ui/format";

type BoolKey = { [K in keyof Params]: Params[K] extends boolean ? K : never }[keyof Params];

export type ControlSpec =
  | {
      kind: "slider";
      key: NumKey;
      label: (sc: Scenario) => string;
      /** Range comes from the params schema, so a slider can never disagree with what the model accepts. */
      step: number;
      format: (v: number) => string;
      ends?: [string, string];
    }
  | { kind: "toggle"; key: BoolKey; label: (sc: Scenario) => string; hint?: string }
  | { kind: "funding"; label: (sc: Scenario) => string };

interface ControlGroup {
  title: string;
  open: boolean;
  controls: ControlSpec[];
}

const perYear = (v: number) => `${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%/yr`;
/**
 * How the essay and the lab talk about the knobs readers meet in both places. Figures 7 and 8
 * use these too, so the words can't drift apart.
 */
export const WORDING = {
  substitutability: {
    label: "Will people accept an alternative?",
    format: (v: number) => (v < 0.35 ? "Never" : v < 1.15 ? "Sometimes" : "Readily"),
    ends: ["Never", "Readily"] as [string, string],
  },
  incomeSensitivity: {
    label: "Do richer towns want more of it?",
    format: (v: number) => (v < 0.9 ? "Less" : v > 1.1 ? "More" : "Same share"),
    ends: ["Less", "More"] as [string, string],
  },
  concentration: {
    label: "Who gets the machine's gains?",
    format: (v: number) => (v < 0.1 ? "Evenly" : v > 0.75 ? "Mostly the top" : "Tilted up"),
    ends: ["Shared evenly", "Concentrated at the top"] as [string, string],
  },
};

export const FUNDING_OPTIONS: Option<Funding>[] = [
  { value: "market", label: "Households" },
  { value: "public", label: "Taxes" },
];

/** Everything the lab exposes, grouped the way the design groups it. */
export const CONTROL_GROUPS: ControlGroup[] = [
  {
    title: "Productivity",
    open: true,
    controls: [
      { kind: "slider", key: "goodsGrowth", label: (sc) => `${sc.goods.building} productivity growth`, step: 0.005, format: perYear },
      { kind: "slider", key: "serviceGrowth", label: (sc) => `${sc.service.building} productivity growth`, step: 0.0025, format: perYear, ends: ["Stagnant", "Catching up"] },
      { kind: "slider", key: "automation", label: (sc) => `Hours handed to the ${sc.machine.one}`, step: 0.05, format: pct, ends: ["Augment people", "Replace people"] },
    ],
  },
  {
    title: "Labor market",
    open: false,
    controls: [
      { kind: "toggle", key: "sharedLaborMarket", label: () => "Workers can switch jobs" },
      { kind: "slider", key: "mobility", label: () => "Ease of changing jobs", step: 0.05, format: pct },
      { kind: "slider", key: "trainingYears", label: () => "Training delay", step: 0.25, format: (v) => `${v} yr` },
      { kind: "slider", key: "wagePassThrough", label: () => "Machine gains paid as wages", step: 0.05, format: pct, ends: ["To owners", "To wages"] },
    ],
  },
  {
    title: "Demand",
    open: false,
    controls: [
      { kind: "slider", key: "substitutability", ...WORDING.substitutability, label: () => WORDING.substitutability.label, step: 0.05 },
      { kind: "slider", key: "incomeSensitivity", ...WORDING.incomeSensitivity, label: () => WORDING.incomeSensitivity.label, step: 0.05 },
      { kind: "slider", key: "essentialFloor", label: () => "Minimum everyone insists on", step: 0.05, format: pct },
    ],
  },
  {
    title: "Institutions",
    open: true,
    controls: [
      { kind: "funding", label: () => "Who pays" },
      { kind: "slider", key: "subsidy", label: () => "Subsidy (if households pay)", step: 0.05, format: pct },
      { kind: "slider", key: "caseload", label: (sc) => sc.caseloadLabel, step: 0.25, format: (v) => `${v}×` },
      { kind: "toggle", key: "wageCap", label: (sc) => `Cap ${sc.service.worker.one} wages (+1%/yr)` },
      { kind: "toggle", key: "budgetFrozen", label: () => "Hold spending at the starting level" },
      { kind: "toggle", key: "qualityStandard", label: () => "Enforce a quality standard", hint: "Limits caseloads and automation so quality stays above 85%." },
    ],
  },
  {
    title: "Distribution",
    open: false,
    controls: [
      { kind: "slider", key: "concentration", ...WORDING.concentration, label: () => WORDING.concentration.label, step: 0.05 },
      { kind: "toggle", key: "progressiveTax", label: () => "Progressive taxes" },
    ],
  },
];
