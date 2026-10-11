import type { Params } from "./params";

export interface Resident {
  /** Position in the income ranking, 0 = poorest. */
  rank: number;
  gross: number;
  net: number;
  /** Could meet basic need without spending more than NEED_BUDGET_SHARE of net income. */
  canAfford: boolean;
  served: boolean;
}

interface Inputs {
  params: Params;
  population: number;
  goodsTech: number;
  /** Average gross income per resident, in goods. */
  income: number;
  /** Public spending as a share of income; raised by flat or progressive tax. */
  taxRate: number;
  /** What meeting one resident's basic need costs at the counter. */
  needCost: number;
  /** How many residents' worth of need the service sector delivers. */
  capacity: number;
  isPublic: boolean;
}

/** A household spends at most this share of its income to meet its basic need. */
const NEED_BUDGET_SHARE = 0.5;
/** Inequality the town starts with, before any growth. */
const BASE_SPREAD = 0.25;
/** How fast concentrated gains pull the top away from the bottom, per log-unit of growth. */
const GROWTH_SPREAD = 0.6;
/** Progressive tax: income below this share of the average is exempt, if revenue allows. */
const EXEMPTION = 0.6;
const EXEMPTION_STEP = 0.05;
/** The progressive rate on income above the exemption never exceeds this. */
const MAX_RATE = 0.9;
/** Rounding slack so a household exactly on the line counts as able to afford. */
const ON_THE_LINE = 1e-9;

/** An average over all households and over the poorest quarter. */
export function quarterStats(rs: Resident[], f: (r: Resident) => number): { all: number; bottom: number } {
  const mean = (xs: Resident[]) => sum(xs.map(f)) / Math.max(1, xs.length);
  return { all: mean(rs), bottom: mean(rs.slice(0, Math.floor(rs.length / 4))) };
}

/**
 * The affordability line, in service units per unit of income: a household whose income buys
 * fewer than this many units at full price would spend over half its income on basic need.
 */
export function affordLine(need: number): number {
  return need / NEED_BUDGET_SHARE;
}

/**
 * The town's households, poorest first. Total income is fixed by production; `concentration`
 * only decides who gets it. With concentration at zero everyone shares growth equally.
 */
export function residentsFor(x: Inputs): Resident[] {
  const N = x.population;
  const spread = BASE_SPREAD + x.params.concentration * GROWTH_SPREAD * Math.log(Math.max(1, x.goodsTech));
  const weights = Array.from({ length: N }, (_, i) => Math.exp(spread * ((2 * i) / (N - 1) - 1)));
  const meanWeight = sum(weights) / N;
  const gross = weights.map((wt) => (x.income * wt) / meanWeight);

  const paid = taxes(gross, x.taxRate, x.params.progressiveTax);
  const people: Resident[] = gross.map((g, i) => {
    const net = g - (paid[i] ?? 0);
    return { rank: i, gross: g, net, canAfford: x.isPublic || x.needCost <= NEED_BUDGET_SHARE * net + ON_THE_LINE, served: false };
  });

  // Markets ration by price (richest affordable first); public services ration by queue.
  const order = x.isPublic ? queueOrder(N) : [...people.keys()].reverse();
  let slots = Math.round(x.capacity);
  for (const i of order) {
    const p = people[i];
    if (slots <= 0 || !p?.canAfford) continue;
    p.served = true;
    slots--;
  }
  return people;
}

/**
 * Per-household tax payments that raise `taxRate` of total income. Flat: everyone pays the same
 * share. Progressive: a single rate on income above an exemption, so the poorest pay least and,
 * because the rate stays below 100%, after-tax incomes keep their order however high taxes go.
 */
function taxes(gross: number[], taxRate: number, progressive: boolean): number[] {
  const revenue = taxRate * sum(gross);
  if (!progressive || revenue <= 0) return gross.map((g) => g * taxRate);
  const meanGross = sum(gross) / gross.length;
  // Lower the exemption until the rate needed on the remainder is affordable.
  for (let exempt = EXEMPTION * meanGross; exempt >= 0; exempt -= EXEMPTION_STEP * meanGross) {
    const base = sum(gross.map((g) => Math.max(0, g - exempt)));
    const rate = revenue / base;
    if (rate <= MAX_RATE) return gross.map((g) => rate * Math.max(0, g - exempt));
  }
  return gross.map((g) => g * taxRate);
}

/** A fixed, income-blind arrival order: a stride permutation of 0..N-1. */
function queueOrder(N: number): number[] {
  let stride = Math.max(1, Math.round(N * 0.618));
  while (gcd(stride, N) !== 1) stride++;
  return Array.from({ length: N }, (_, i) => (i * stride + 3) % N);
}

function gcd(a: number, b: number): number {
  return b === 0 ? a : gcd(b, a % b);
}

function sum(xs: number[]): number {
  return xs.reduce((a, b) => a + b, 0);
}
