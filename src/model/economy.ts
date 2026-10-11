import type { Params } from "./params";
import { residentsFor, type Resident } from "./residents";

/**
 * A two-sector town. Gadgets ("goods") are the unit of account, so the goods price is always 1.
 * Productivities, prices and incomes are normalized so the starting town has every value at 1:
 * one worker-hour makes one unit of goods or one unit of service, and earns one unit of goods.
 *
 * The dynamic state is deliberately tiny. Everything a reader sees is derived from it by
 * `observe`, so a figure can never show a number the model did not produce.
 */
export interface EconState {
  /** Goods per worker-hour (A_G). */
  goodsTech: number;
  /** Where goodsTech is heading. Figures step it ("invent a better machine"); growth drifts it. */
  goodsTarget: number;
  /** Service units per worker-hour from genuine augmentation (A_S). */
  serviceTech: number;
  /** Workers in the service sector. Continuous: sprites round it. */
  careWorkers: number;
  /** Hourly service wage, in goods. */
  careWage: number;
  /** Ceiling on careWage while a wage cap is in force; set from the wage when the cap is switched on. */
  capWage: number | null;
  /**
   * Years the service provider has been short-staffed or paying under the market. Pay is
   * sticky: it is only revised once this reaches WAGE_REVIEW_YEARS, so a gap opens and people
   * walk before the provider answers.
   */
  strain: number;
}

/**
 * What a town is built with and keeps for life: how many people live there, and what the
 * scenario supplies. Rules that can change mid-run live in Params instead.
 */
export interface Calibration {
  /** Townspeople, each both worker and household. */
  population: number;
  /** Share of workers in the service sector at the start. */
  baseShare: number;
  /** Quality of the automated substitute, 0..1, relative to a human at baseline caseload. */
  machineQuality: number;
}

/**
 * Prices, quantities and staffing for one instant: everything the dynamics need. `observe`
 * adds the per-household picture on top; `step` uses this alone, so the hot loop never
 * allocates a resident list.
 */
interface Market {
  population: number;
  /** Caseload and automation actually in force, after any quality standard. */
  caseload: number;
  automation: number;

  factoryWage: number;
  careWage: number;
  /** Mean hourly pay across both sectors, in goods. */
  averageWage: number;
  /** careWage / factoryWage. Below 1, service workers have a reason to leave. */
  wageRatio: number;

  /** Cost of one human-delivered service unit, in goods. */
  humanPrice: number;
  /** Cost of one machine-delivered unit, in goods. */
  machinePrice: number;
  /** Blended cost of one delivered unit, in goods. Equals A_G/A_S in the pure Baumol case. */
  price: number;
  /** What a household pays per unit at the counter. */
  userPrice: number;

  factoryWorkers: number;
  careWorkers: number;
  careLaborDemand: number;
  vacancies: number;

  /** Units per resident-hour the town wants, given prices, incomes and institutions. */
  demandPerCapita: number;
  /** Units actually delivered (human + machine), total. */
  delivered: number;
  /** Fraction of delivered units provided by a person. */
  presence: number;
  quality: number;
  waitDays: number;

  income: number;
  /** Goods consumption per resident relative to the start. */
  material: number;
  /** Total service spending as a share of income. */
  serviceShare: number;
  /** Public spending on the service as a share of income (= tax rate). */
  publicShare: number;
}

export interface Snapshot extends Market {
  goodsTech: number;
  /** Where the machine is heading: each invention doubles it. */
  goodsTarget: number;
  /** The service provider is in the middle of revising its pay. */
  revisingPay: boolean;
  serviceTech: number;
  /** The rules this snapshot was computed under. */
  params: Params;
  residents: Resident[];
  coverage: number;
  /** Households who can't afford basic need at the counter price. */
  pricedOut: number;
  /** Households who could pay but find no room: a queue, or a budget that won't stretch. */
  rationed: number;
  /** Households who could pay but bought an alternative instead. Not a hardship. */
  optedOut: number;
}

/** Days of waiting when demand is double what's delivered; zero when nobody is turned away. */
const WAIT_AT_DOUBLE_DEMAND = 30;
const MAX_WAIT_DAYS = 365;
/** How fast a wage cap lets the ceiling rise, per year. */
const CAP_GROWTH = 0.01;
/** How the machine substitute's cost falls with goods productivity. */
const MACHINE_COST = 0.6;
const MACHINE_LEARNING = 0.5;
/** Caps on caseload and automation when a quality standard is in force. */
const STANDARD_MAX_CASELOAD = 1.25;
const STANDARD_MIN_QUALITY = 0.85;
/** Demand ceiling, in multiples of starting demand, for when the counter price is held near zero. */
const MAX_DEMAND_MULTIPLE = 2.8;
/** Demand is evaluated at no less than this share of full cost, however large the subsidy. */
const MIN_PRICE_SHARE = 0.05;
/** Floor on labor demand when turning vacancies into a rate, so a tiny sector can't divide by ~0. */
const MIN_DEMAND_FOR_RATE = 0.5;

/** Response speeds, per year. */
const TECH_ADOPTION = 3.5;
const WAGE_RESPONSE = 0.8;
const WAGE_RELAX = 5;
const PARITY_DRIFT = 2;
/** How long a provider tolerates strain before revising pay, in years. */
const WAGE_REVIEW_YEARS = 0.8;
/** What counts as strain: this share of posts unfilled, or pay this far under the market. */
const STRAIN_VACANCY_RATE = 0.1;
const STRAIN_PAY_GAP = 0.01;
/** How fast a sub-threshold pay gap closes without a review, per year. */
const ROUTINE_RAISES = 0.5;
const QUIT_RATE = 4;
const HIRE_RATE = 3;
const LAYOFF_RATE = 1.5;

export function initialState(cal: Calibration): EconState {
  return {
    goodsTech: 1,
    goodsTarget: 1,
    serviceTech: 1,
    careWorkers: cal.baseShare * cal.population,
    careWage: 1,
    capWage: null,
    strain: 0,
  };
}

/** Townspeople who stay in service work at any wage: the devoted. */
const DEVOTED_SHARE = 0.1;
/** Wage ratios over which willingness rises from the devoted few to everyone. */
const NOBODY_ELSE_BELOW = 0.85;

/**
 * Share of townspeople willing to do service work at a given service/factory wage ratio.
 * Workers are interchangeable, so supply is steep: almost nobody stays for 75% of the
 * factory wage, almost everybody is willing at parity.
 */
export function willingShare(wageRatio: number): number {
  const x = clamp01((wageRatio - NOBODY_ELSE_BELOW) / (1 - NOBODY_ELSE_BELOW));
  const smooth = x * x * (3 - 2 * x);
  return DEVOTED_SHARE + (1 - DEVOTED_SHARE) * smooth * smooth;
}

/**
 * The factory wage: the starting wage plus the share of the productivity gain that reaches pay.
 * With full pass-through a worker earns their whole output; with none, the gains go to owners.
 */
function factoryWage(params: Params, goodsTech: number): number {
  return 1 + params.wagePassThrough * (goodsTech - 1);
}

/** Caseload and automation after a quality standard has had its say. */
export function effectiveInstitutions(params: Params, cal: Calibration): { caseload: number; automation: number } {
  if (!params.qualityStandard) return { caseload: params.caseload, automation: params.automation };
  const caseload = Math.min(params.caseload, STANDARD_MAX_CASELOAD);
  const human = humanQuality(caseload);
  // Blend quality = (1-a)·human + a·machine ≥ floor  →  a ≤ (human - floor)/(human - machine)
  const room = human - cal.machineQuality;
  const maxAuto = room <= 0 ? 0 : clamp01((human - STANDARD_MIN_QUALITY) / room);
  return { caseload, automation: Math.min(params.automation, maxAuto) };
}

/** Attention per client falls with caseload; learning and care respond to it with diminishing returns. */
function humanQuality(caseload: number): number {
  return caseload ** -0.5;
}

/**
 * Units of service per resident that households would buy at `price`, holding income `income`.
 * A two-good CES split, calibrated so the starting town spends `baseShare` of income on service,
 * with an income-elasticity tilt and a floor for essential need.
 */
function cesDemand(params: Params, cal: Calibration, price: number, income: number): number {
  const k = cal.baseShare / (1 - cal.baseShare);
  const ratio = k * price ** (1 - params.substitutability) * income ** (params.incomeSensitivity - 1);
  const share = ratio / (1 + ratio);
  const wanted = (share * income) / price;
  const floor = params.essentialFloor * cal.baseShare;
  return Math.min(Math.max(wanted, floor), MAX_DEMAND_MULTIPLE * cal.baseShare);
}

export function market(params: Params, cal: Calibration, s: EconState): Market {
  const N = cal.population;
  const { caseload, automation } = effectiveInstitutions(params, cal);
  const need = cal.baseShare;

  const w = factoryWage(params, s.goodsTech);
  const wS = s.careWage;
  const humanPrice = wS / (s.serviceTech * caseload);
  const machinePrice = MACHINE_COST / s.goodsTech ** MACHINE_LEARNING;
  const price = (1 - automation) * humanPrice + automation * machinePrice;

  const LS = s.careWorkers;
  const LG = N - LS;
  const income = (s.goodsTech * LG + wS * LS) / N;

  const isPublic = params.funding === "public";
  const userPrice = isPublic ? 0 : price * (1 - params.subsidy);

  // How much the town wants. Under public provision, the town votes at full cost and guarantees need.
  const wanted = isPublic
    ? Math.max(need, cesDemand(params, cal, price, income))
    : cesDemand(params, cal, Math.max(userPrice, MIN_PRICE_SHARE * price), income);
  const budgetLimit = params.budgetFrozen ? need / price : Infinity;
  const target = Math.min(wanted, budgetLimit);
  // Households who chose to buy less are not queueing; citizens denied a public service are.
  const queued = params.budgetFrozen && !isPublic ? target : wanted;

  const humanTarget = (1 - automation) * target * N;
  const careLaborDemand = humanTarget / (s.serviceTech * caseload);
  const humanDelivered = Math.min(humanTarget, LS * s.serviceTech * caseload);
  const machineDelivered = automation * target * N;
  const delivered = humanDelivered + machineDelivered;

  const presence = delivered > 0 ? humanDelivered / delivered : 0;
  const quality = delivered > 0 ? presence * humanQuality(caseload) + (1 - presence) * cal.machineQuality : 0;
  const shortfall = delivered > 0 ? (queued * N) / delivered : MAX_WAIT_DAYS;

  const machineCost = machineDelivered * machinePrice;
  const serviceSpend = wS * Math.min(LS, careLaborDemand) + machineCost;
  const publicSpend = isPublic ? serviceSpend : params.subsidy * serviceSpend;
  const totalIncome = income * N;

  return {
    population: N,
    caseload,
    automation,
    factoryWage: w,
    careWage: wS,
    averageWage: (w * LG + wS * LS) / N,
    wageRatio: wS / w,
    humanPrice,
    machinePrice,
    price,
    userPrice,
    factoryWorkers: LG,
    careWorkers: LS,
    careLaborDemand,
    vacancies: Math.max(0, careLaborDemand - LS),
    demandPerCapita: wanted,
    delivered,
    presence,
    quality,
    waitDays: Math.min(MAX_WAIT_DAYS, (WAIT_AT_DOUBLE_DEMAND / 3) * (Math.max(1, shortfall) ** 2 - 1)),
    income,
    material: (s.goodsTech * LG - machineCost) / N / (1 - cal.baseShare),
    serviceShare: serviceSpend / totalIncome,
    publicShare: publicSpend / totalIncome,
  };
}

export function observe(params: Params, cal: Calibration, s: EconState): Snapshot {
  const m = market(params, cal, s);
  const need = cal.baseShare;
  const shortOfRoom = m.waitDays >= 1 || params.budgetFrozen;
  const residents = residentsFor({
    params,
    population: cal.population,
    goodsTech: s.goodsTech,
    income: m.income,
    taxRate: m.publicShare,
    needCost: need * m.userPrice,
    capacity: m.delivered / need,
    isPublic: params.funding === "public",
  });
  const unserved = residents.filter((r) => r.canAfford && !r.served).length;
  return {
    ...m,
    goodsTech: s.goodsTech,
    goodsTarget: s.goodsTarget,
    revisingPay: s.strain >= WAGE_REVIEW_YEARS,
    serviceTech: s.serviceTech,
    params,
    residents,
    coverage: residents.filter((r) => r.served).length / residents.length,
    pricedOut: residents.filter((r) => !r.canAfford).length,
    // Affordable but unserved: rationed if there is a queue or a frozen budget, otherwise the
    // town simply chose to buy less of it.
    rationed: shortOfRoom ? unserved : 0,
    optedOut: shortOfRoom ? 0 : unserved,
  };
}

/** Advance the town by `dt` years. Pure: returns a new state. */
export function step(params: Params, cal: Calibration, s: EconState, dt: number): EconState {
  const mk = market(params, cal, s);
  const N = cal.population;

  const goodsTarget = s.goodsTarget * (1 + params.goodsGrowth) ** dt;
  const logGap = Math.log(goodsTarget / s.goodsTech);
  const goodsTech = s.goodsTech * Math.exp(logGap * (1 - Math.exp(-TECH_ADOPTION * dt)));
  const serviceTech = s.serviceTech * (1 + params.serviceGrowth) ** dt;
  const w = factoryWage(params, goodsTech);

  if (!params.sharedLaborMarket) {
    // Separate labor markets: service workers cannot leave, so nobody bids their pay up. It
    // simply stays where it was when the road closed.
    return { ...s, goodsTech, goodsTarget, serviceTech };
  }

  // Wages are sticky, in episodes. Strain builds while posts sit empty or pay trails the
  // factory's; once it has lasted WAGE_REVIEW_YEARS the provider revises pay, faster the more
  // posts are empty, and on closing to within STRAIN_PAY_GAP sets it at the going rate and the
  // episode ends. A wage left above parity (say after pass-through falls) relaxes back.
  const vacancyRate = mk.vacancies / Math.max(mk.careLaborDemand, MIN_DEMAND_FOR_RATE);
  const gap = Math.max(0, 1 - s.careWage / w);
  const strained = vacancyRate > STRAIN_VACANCY_RATE || gap > STRAIN_PAY_GAP;
  let strain = strained ? Math.min(WAGE_REVIEW_YEARS, s.strain + dt) : 0;
  let careWage = s.careWage;
  if (s.careWage > w) {
    careWage = w + (s.careWage - w) * Math.exp(-WAGE_RELAX * dt);
  } else if (strain >= WAGE_REVIEW_YEARS) {
    careWage = Math.min(w, s.careWage * Math.exp((WAGE_RESPONSE * vacancyRate + PARITY_DRIFT * gap) * dt));
    if (1 - careWage / w < STRAIN_PAY_GAP && vacancyRate <= STRAIN_VACANCY_RATE) {
      careWage = w;
      strain = 0;
    }
  } else if (!strained) {
    // A gap too small to strain anyone still closes slowly, as routine pay rises do.
    careWage = w - (w - s.careWage) * Math.exp(-ROUTINE_RAISES * dt);
  }
  let capWage: number | null = null;
  if (params.wageCap) {
    capWage = (s.capWage ?? s.careWage) * (1 + CAP_GROWTH) ** dt;
    careWage = Math.min(careWage, capWage);
  }

  // Workers: quit when underpaid, get hired (slowly, if training is long) when wanted and paid.
  const willing = N * willingShare(careWage / w);
  const demand = mk.careLaborDemand;
  const mobility = params.mobility;
  let careWorkers = s.careWorkers;
  if (careWorkers > willing) {
    careWorkers += (willing - careWorkers) * (1 - Math.exp(-QUIT_RATE * mobility * dt));
  } else if (careWorkers < demand) {
    const hire = (HIRE_RATE * mobility) / (1 + params.trainingYears);
    careWorkers += (Math.min(demand, willing) - careWorkers) * (1 - Math.exp(-hire * dt));
  } else {
    careWorkers += (demand - careWorkers) * (1 - Math.exp(-LAYOFF_RATE * dt));
  }

  return { goodsTech, goodsTarget, serviceTech, careWorkers, careWage, capWage, strain };
}

/**
 * Run with technology frozen until labor and wages stop moving. Used for static figures,
 * so they show exactly where the dynamic town would come to rest.
 */
function settle(params: Params, cal: Calibration, s: EconState, years = 60): EconState {
  const frozen = { ...params, goodsGrowth: 0, serviceGrowth: 0 };
  let cur: EconState = { ...s, goodsTech: s.goodsTarget };
  const dt = 0.1;
  for (let i = 0; i < years / dt; i++) cur = step(frozen, cal, cur, dt);
  return cur;
}

/** Where the town comes to rest after `doublings` inventions, starting from scratch. */
export function settledState(params: Params, cal: Calibration, doublings: number, serviceTech = 1): EconState {
  const target = 2 ** doublings;
  return settle(params, cal, { ...initialState(cal), goodsTarget: target, goodsTech: target, serviceTech });
}

export function settledAt(params: Params, cal: Calibration, doublings: number, serviceTech = 1): Snapshot {
  return observe(params, cal, settledState(params, cal, doublings, serviceTech));
}

function clamp01(x: number): number {
  return Math.min(1, Math.max(0, x));
}

