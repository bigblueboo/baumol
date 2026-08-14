import { createStore } from "zustand/vanilla";
import { DEFAULT_PARAMS, type Params } from "../model/params";
import { derive, initState, type Derived, type SimState } from "../model/sim";

export type Phase = "dawn" | "chain" | "play";

export type PolicyId = "market" | "cap" | "batch" | "robo" | "subsidy";

/** One point of chart history, sampled every quarter-week. */
export interface Sample {
  week: number;
  /** Minutes of typical work to buy one hour of sitting. */
  sitMin: number;
  /** Minutes of typical work to buy one software unit. */
  softMin: number;
  sitRate: number;
  engWage: number;
  engineers: number;
  trainees: number;
  sitters: number;
  careShare: number;
  publicShare: number;
  affordAvg: number;
  affordQ1: number;
  coverage: number;
  ratio: number;
}

/** A labeled moment (era landing, policy vote) drawn on the charts. */
export interface EventMark {
  week: number;
  label: string;
  kind: "era" | "policy";
}

export interface AppState {
  params: Params;
  sim: SimState;
  d: Derived;
  history: Sample[];
  events: EventMark[];
  pressCount: number;
  /** Sim week of the most recent press; gates the next press. */
  lastPressWeek: number;
  phase: Phase;
  /** 0 = not in the chain; 1..4 = the narrated causal beats. */
  beat: number;
  /** Sim speed in weeks per second of real time. */
  speed: number;
  paused: boolean;
  ledgerUnlocked: boolean;
  chartsUnlocked: boolean;
  townhallUnlocked: boolean;
  crisisShown: boolean;
  policy: PolicyId;
  inscription: { line: string; detail: string; button: string } | null;
}

/** Sim-weeks a new tool era takes to install before the next press — and
 *  before the story treats the era as having landed. */
export const DWELL_WEEKS = 8;

/** One shared definition of "the pressed era has actually landed". */
export function eraInstalled(st: Pick<AppState, "sim" | "lastPressWeek">): boolean {
  return (
    st.sim.aEng >= st.sim.aEngTarget * 0.93 &&
    st.sim.week - st.lastPressWeek >= DWELL_WEEKS
  );
}

/** The going rate for a worked hour: town income over hours actually worked
 *  (trainees and unbooked sitters don't work, so they don't dilute it). */
export function avgWage(sim: SimState, params: Params): number {
  const bookedSitterHours =
    Math.min(sim.supplyHours, sim.demandHours) / params.kidsPerSitter;
  const worked = sim.engineers * params.hoursPerWeek + bookedSitterHours;
  return worked > 1 ? sim.income / worked : params.baseWage;
}

export function makeSample(sim: SimState, params: Params, d: Derived): Sample {
  const w = Math.max(avgWage(sim, params), 0.01);
  return {
    week: sim.week,
    sitMin: (60 * d.pSit) / w,
    softMin: (60 * d.pSoftware) / w,
    sitRate: sim.wSit,
    engWage: sim.wEng,
    engineers: sim.engineers,
    trainees: d.trainees,
    sitters: sim.sitters,
    careShare: d.careSpendShare,
    publicShare: d.publicShare,
    affordAvg: d.affordAvg,
    affordQ1: d.affordQ1,
    coverage: d.coverage,
    ratio: d.ratio,
  };
}

export function createAppStore(params: Params = DEFAULT_PARAMS) {
  const sim = initState(params);
  const d = derive(sim, params);
  return createStore<AppState>()(() => ({
    params,
    sim,
    d,
    history: [makeSample(sim, params, d)],
    events: [],
    pressCount: 0,
    lastPressWeek: -Infinity,
    phase: "dawn" as Phase,
    beat: 0,
    speed: 4,
    paused: false,
    ledgerUnlocked: false,
    chartsUnlocked: false,
    townhallUnlocked: false,
    crisisShown: false,
    policy: "market" as PolicyId,
    inscription: null,
  }));
}

export type AppStore = ReturnType<typeof createAppStore>;
