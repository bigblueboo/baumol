/**
 * The town economy, stepped in fixed increments of simulated weeks.
 *
 * Pure and deterministic: no Date, no Math.random, no DOM. The UI layer owns
 * all randomness (visual jitter) and all pacing.
 *
 * Core identities (see DESIGN.md):
 *   pSoftware = wEng / aEng          — software price falls as tools improve
 *   pSit      = wSit / kidsPerSitter — a care-hour costs a sitter-hour
 *   pSit/pSoftware → aEng            — the Baumol ratio, the whole lesson
 */

import { clamp, type Params } from "./params";

export interface TrainingCohort {
  /** Workers in this cohort (fractional; the town is a fluid). */
  count: number;
  /** Weeks of retraining left before they start engineering. */
  weeksLeft: number;
}

export interface SimState {
  /** Simulated weeks since the start (call it 1999). */
  week: number;

  /** Software units one engineer ships per hour. Doubles each tool era. */
  aEng: number;
  /** Where aEng is ramping toward after an upgrade press. */
  aEngTarget: number;

  /** Engineer wage, $/hr. */
  wEng: number;
  /** Sitter rate, $/hr (market rate; families may pay less if subsidized). */
  wSit: number;

  /** Workers currently engineering. */
  engineers: number;
  /** Workers currently sitting. */
  sitters: number;
  /** Retraining pipeline, oldest cohort first. */
  training: TrainingCohort[];

  /** Kid-hours/week families want from human sitters (smoothed). */
  demandHours: number;
  /** Kid-hours/week families route to the robo-sitter app (smoothed). */
  roboHours: number;
  /** Kid-hours/week sitters can cover. */
  supplyHours: number;

  /** Days a family waits for a sitter (smoothed). */
  waitDays: number;

  /** Total labor income, $/week. */
  income: number;
  /** Town income at week 0, for indexing. */
  income0: number;
  /** Care demand at week 0, for the need floor. */
  demand0: number;
}

export interface Derived {
  /** $ per software unit. */
  pSoftware: number;
  /** $ per kid-hour of human care, before subsidy. */
  pSit: number;
  /** $ per kid-hour families actually pay. */
  pSitFamily: number;
  /** The Baumol ratio: a sitter-hour priced in software units. Starts at 1. */
  ratio: number;
  /** Share of workers in care (0..1). */
  careWorkShare: number;
  /** Share of all spending going to human care (0..1). */
  careSpendShare: number;
  /** Fraction of *requested* human care actually staffed (0..1). Requests
   *  already shrank with price — this is a fill rate, not access. */
  coverage: number;
  /** Care hours delivered (human + robo) against the town's original need
   *  (0..1) — a quantity measure, blind to attention. */
  baselineCovered: number;
  /** Same, but each hour weighted by the attention it carries (0..1). */
  qualityCare: number;
  /** Attention each kid gets, 0..1 (1 = one-on-one). */
  attention: number;
  /** Fraction of care demand served by the robo app (0..1). */
  roboShare: number;
  /** Weekly cost of the subsidy to the town, $. */
  subsidyBill: number;
  /** Subsidy bill as a share of town income (0..1). */
  publicShare: number;
  /** Sitter-hours/week the average household can buy with 15% of income. */
  affordAvg: number;
  /** Same, for a bottom-quartile household. */
  affordQ1: number;
  /** Software consumed per household, indexed to week 0 (starts at 1). */
  materialIndex: number;
  /** Workers currently retraining. */
  trainees: number;
}

const WAGE_APPROACH = 1.6; // 1/weeks — engineer wage catches up to productivity
const SIT_WAGE_KAPPA = 1.2; // sitter wage response to excess demand
const A_RAMP = 1.4; // 1/weeks — productivity ramps in visibly, not instantly
const GAP_DEADBAND = 0.03; // wage gaps below this don't move anyone
const DEMAND_SMOOTH = 2.0; // 1/weeks — families adjust habits over ~half a week
const CARE_BUDGET_SHARE = 0.15; // of income, for the affordability metric
const Q1_BASE_FRACTION = 0.7; // bottom-quartile income vs average, at start
const Q1_TRICKLE = 0.15; // share of growth reaching Q1 when gains concentrate
/** Robo-sitting burns this many software units per hour (shown on its card). */
export const ROBO_SOFTWARE_UNITS = 3;
/** Stylized attention a robo-hour gives a kid, vs 1.0 for a human hour. */
export const ROBO_ATTENTION = 0.25;

export function initState(p: Params): SimState {
  const engineers = p.totalWorkers / 2;
  const sitters = p.totalWorkers / 2;
  const income = (engineers + sitters) * p.baseWage * p.hoursPerWeek;
  const supply = sitters * p.hoursPerWeek * p.kidsPerSitter;
  return {
    week: 0,
    aEng: 1,
    aEngTarget: 1,
    wEng: p.baseWage,
    wSit: p.baseWage,
    engineers,
    sitters,
    training: [],
    demandHours: supply,
    roboHours: 0,
    supplyHours: supply,
    waitDays: 0,
    income,
    income0: income,
    demand0: supply,
  };
}

/** Press the big button: the next tool era doubles engineer output. */
export function upgrade(s: SimState): SimState {
  return { ...s, aEngTarget: s.aEngTarget * 2 };
}

export function derive(s: SimState, p: Params): Derived {
  const pSoftware = s.wEng / s.aEng;
  const pSit = s.wSit / p.kidsPerSitter;
  const pSitFamily = pSit * (1 - p.subsidyRate);
  const ratio = pSit / pSoftware;

  const trainees = s.training.reduce((a, c) => a + c.count, 0);
  const careWorkShare = s.sitters / p.totalWorkers;

  // "Staffed" is a fill rate against *requested* hours — and requests already
  // shrank with price. needMet holds the denominator fixed at the town's
  // original care need, so priced-out families still show up as unmet.
  const servedHours = Math.min(s.demandHours, s.supplyHours);
  const coverage = s.demandHours > 0.5 ? servedHours / s.demandHours : 1;
  const baselineCovered = clamp((servedHours + s.roboHours) / s.demand0, 0, 1);
  const qualityCare = clamp(
    (servedHours * (1 / p.kidsPerSitter) + s.roboHours * ROBO_ATTENTION) / s.demand0,
    0,
    1,
  );

  const careSpendFamily = servedHours * pSitFamily;
  const subsidyBill = servedHours * pSit * p.subsidyRate;
  const publicShare = s.income > 0 ? subsidyBill / s.income : 0;
  const careSpendShare = s.income > 0 ? (careSpendFamily + subsidyBill) / s.income : 0;

  const totalCare = s.demandHours + s.roboHours;
  const roboShare = totalCare > 0 ? s.roboHours / totalCare : 0;

  // Software output the town actually enjoys: what engineers ship, less what
  // the robo-sitter burns. Indexed to week 0 production.
  const softwareUnits0 = (p.totalWorkers / 2) * p.hoursPerWeek;
  const softwareUnits =
    s.engineers * p.hoursPerWeek * s.aEng - s.roboHours * ROBO_SOFTWARE_UNITS;
  const materialIndex = Math.max(softwareUnits, 0) / softwareUnits0;

  // Affordability is measured net of the tax that funds the subsidy
  // (proportional incidence), so a subsidy can't fake its own financing.
  const taxRate = s.income > 0 ? subsidyBill / s.income : 0;
  const avgIncome = (s.income / p.totalWorkers) * (1 - taxRate);
  const avgIncome0 = s.income0 / p.totalWorkers;
  const growth = avgIncome / avgIncome0 - 1;
  const q1Slice = p.distribution === "shared" ? 1 : Q1_TRICKLE;
  const q1Income = Q1_BASE_FRACTION * avgIncome0 * (1 + q1Slice * growth);

  const affordAvg = (CARE_BUDGET_SHARE * avgIncome) / pSitFamily;
  const affordQ1 = (CARE_BUDGET_SHARE * q1Income) / pSitFamily;

  return {
    pSoftware,
    pSit,
    pSitFamily,
    ratio,
    careWorkShare,
    careSpendShare,
    coverage,
    baselineCovered,
    qualityCare,
    attention: 1 / p.kidsPerSitter,
    roboShare,
    subsidyBill,
    publicShare,
    affordAvg,
    affordQ1,
    materialIndex,
    trainees,
  };
}

/**
 * Which mechanisms are allowed to move. The narrated opening freezes each
 * one until its beat introduces it, so the causal chain plays out in order
 * instead of everything reacting at once. Absent gates = everything moves.
 */
export interface Gates {
  /** Engineer pay may respond to productivity. */
  wage: boolean;
  /** Workers may change occupations. */
  labor: boolean;
  /** The sitter rate may respond to scarcity. */
  sitPrice: boolean;
  /** Families may adjust how much care they want. */
  demand: boolean;
}

export const ALL_OPEN: Gates = { wage: true, labor: true, sitPrice: true, demand: true };

/**
 * Advance the town by dt weeks. Call with a fixed dt for determinism.
 */
export function step(s: SimState, p: Params, dt: number, gates: Gates = ALL_OPEN): SimState {
  const n: SimState = { ...s, training: s.training.map((c) => ({ ...c })) };
  n.week += dt;

  // 1. Tools ramp in. A press sets the target; output climbs over ~2 weeks.
  n.aEng += (n.aEngTarget - n.aEng) * (1 - Math.exp(-A_RAMP * dt));

  // 2. Engineer pay follows what an engineer produces.
  if (gates.wage) {
    const wEngTarget = p.baseWage * Math.pow(n.aEng, p.passThrough);
    n.wEng += (wEngTarget - n.wEng) * (1 - Math.exp(-WAGE_APPROACH * dt));
  }

  // 3. Families decide how much sitting to buy at today's prices. The
  //    subsidy is funded by a tax on this week's income (balanced budget) —
  //    without that, subsidized care demand feeds its own wage spiral.
  const pSoftware = n.wEng / n.aEng;
  const pSit = n.wSit / p.kidsPerSitter;
  const pSitFamily = pSit * (1 - p.subsidyRate);

  const lastServed = Math.min(n.demandHours, n.supplyHours);
  const taxBill = lastServed * pSit * p.subsidyRate;
  const disposable = Math.max(n.income - taxBill, n.income * 0.05);

  // When the robo-sitter is on the menu, willing families route the share
  // phi of their care hours to it, so the care they shop for is a blend —
  // and they pay the robo price for the robo part (budget-consistent).
  let phi = 0;
  let pRobo = 0;
  if (p.roboSitter) {
    pRobo = ROBO_SOFTWARE_UNITS * pSoftware;
    const advantage = clamp(1 - pRobo / pSitFamily, 0, 1);
    phi = p.roboAcceptance * advantage;
  }
  const pCareBlend = (1 - phi) * pSitFamily + phi * pRobo;

  const incomeFactor = Math.pow(n.income / n.income0, p.incomeElasticity - 1);
  // CES spending ratio: E_care/E_software = K * (pS/pG)^(1-sigma), K = 1 at start.
  const spendRatio =
    incomeFactor * Math.pow(pCareBlend / pSoftware, 1 - p.sigma);
  const careSpend = (disposable * spendRatio) / (1 + spendRatio);
  let wantedHours = careSpend / pCareBlend;

  // Parents work; some care is needed at any price.
  wantedHours = Math.max(wantedHours, p.needFloorShare * n.demand0);

  const roboWanted = wantedHours * phi;
  const humanWanted = wantedHours - roboWanted;

  // Habits adjust over days, not instants, so the story reads on screen.
  if (gates.demand) {
    const smooth = 1 - Math.exp(-DEMAND_SMOOTH * dt);
    n.demandHours += (humanWanted - n.demandHours) * smooth;
    n.roboHours += (roboWanted - n.roboHours) * smooth;
  }

  // 4. The sitter rate moves with scarcity: bid up when families can't find
  //    a sitter, drifting down when sitters go unbooked.
  n.supplyHours = n.sitters * p.hoursPerWeek * p.kidsPerSitter;
  if (gates.sitPrice) {
    const excess =
      n.supplyHours > 1
        ? (n.demandHours - n.supplyHours) / n.supplyHours
        : n.demandHours > 1
          ? 2
          : 0;
    n.wSit *= Math.exp(SIT_WAGE_KAPPA * clamp(excess, -0.6, 2) * dt);
    n.wSit = clamp(n.wSit, 0.4 * p.baseWage, 1e4 * p.baseWage);
    // Free entry: anyone can sit. A rate much above the engineer wage attracts
    // instant competition from moonlighting neighbors, so it can't stick.
    n.wSit = Math.min(n.wSit, Math.max(n.wEng * 1.08, 0.4 * p.baseWage));
    if (p.rateCap !== null) n.wSit = Math.min(n.wSit, p.rateCap);
  }

  // 5. Workers compare paychecks. Sitting -> engineering means retraining
  //    first (slow); engineering -> sitting is as easy as saying yes to the
  //    neighbors (fast). Retraining slows the flow but not its destination,
  //    so in the long run the two wages meet. A sitter's side of the
  //    comparison is occupancy-adjusted: an unbooked hour pays nothing.
  const occupancy =
    n.supplyHours > 1 ? clamp(n.demandHours / n.supplyHours, 0, 1) : 1;
  const sitReturn = Math.max(n.wSit * occupancy, 1);
  const gapToEng = gates.labor ? (n.wEng - sitReturn) / sitReturn : 0;
  const trainDrag = 1 / (1 + p.trainingWeeks / 16);
  if (gapToEng > GAP_DEADBAND) {
    const leaving =
      clamp(p.mobility * trainDrag * Math.min(gapToEng, 2) * dt, 0, 0.5) * n.sitters;
    n.sitters -= leaving;
    if (p.trainingWeeks <= 0) {
      n.engineers += leaving;
    } else if (leaving > 1e-9) {
      const last = n.training[n.training.length - 1];
      // Coalesce near-simultaneous departures into one cohort.
      if (last && p.trainingWeeks - last.weeksLeft < 0.5) {
        last.count += leaving;
      } else {
        n.training.push({ count: leaving, weeksLeft: p.trainingWeeks });
      }
    }
  } else if (gapToEng < -GAP_DEADBAND) {
    // No retraining needed in this direction, so the flow is brisk.
    const returning =
      clamp(p.mobility * 4 * Math.min(-gapToEng, 2) * dt, 0, 0.5) * n.engineers;
    n.engineers -= returning;
    n.sitters += returning;
  }

  // Trainees progress; finished cohorts start engineering.
  for (const cohort of n.training) cohort.weeksLeft -= dt;
  while (n.training.length > 0 && (n.training[0]?.weeksLeft ?? 1) <= 0) {
    n.engineers += n.training[0]?.count ?? 0;
    n.training.shift();
  }

  // 6. Bookkeeping the rest of the town runs on. Trainees earn nothing (the
  //    transition itself has a visible cost) and sitters are independents,
  //    paid only for booked hours — idle sitter-hours earn nothing.
  n.supplyHours = n.sitters * p.hoursPerWeek * p.kidsPerSitter;
  const bookedSitterHours =
    Math.min(n.supplyHours, n.demandHours) / p.kidsPerSitter;
  n.income = n.engineers * n.wEng * p.hoursPerWeek + n.wSit * bookedSitterHours;

  const unmet = Math.max(0, n.demandHours - n.supplyHours);
  const waitTarget = n.demandHours > 1 ? 90 * (unmet / n.demandHours) : 0;
  n.waitDays += (waitTarget - n.waitDays) * (1 - Math.exp(-1.2 * dt));

  return n;
}

/** Run the sim forward in fixed substeps until `weeks` have passed. */
export function run(s: SimState, p: Params, weeks: number, dt = 1 / 32): SimState {
  let cur = s;
  let remaining = weeks;
  while (remaining > 1e-9) {
    const h = Math.min(dt, remaining);
    cur = step(cur, p, h);
    remaining -= h;
  }
  return cur;
}
