/**
 * Tunable parameters for the town economy.
 *
 * The model is a two-sector Baumol toy: a "progressive" sector (software,
 * where tools multiply output per hour) and a "stagnant" sector (babysitting,
 * where one hour of care takes one hour, always). Workers share one labor
 * market; that link is what spreads the factory's wage gains into the care
 * sector's prices.
 */

export type Distribution = "shared" | "concentrated";

export interface Params {
  /** Total workers in town (engineers + sitters + trainees). */
  totalWorkers: number;
  /** Paid hours per worker per week. */
  hoursPerWeek: number;
  /** Starting wage for everyone, $/hr. Circa-1999 parable money. */
  baseWage: number;

  // --- Productivity ---
  /** Fraction of productivity gains that reach engineer wages (0..1). */
  passThrough: number;

  // --- Labor market ---
  /** How readily sitters retrain as engineers (flow rate per week at full gap). */
  mobility: number;
  /** Weeks of unpaid retraining before a sitter can start engineering. */
  trainingWeeks: number;

  // --- Demand ---
  /**
   * CES elasticity of substitution between software and babysitting.
   * <1: poor substitutes (care spending share rises as it gets pricier).
   * =1: shares hold. >1: families substitute away from human care.
   */
  sigma: number;
  /** Income elasticity of care demand (>1: richer town wants relatively more care). */
  incomeElasticity: number;
  /** Kid-hours per week the town needs no matter the price (parents work). */
  needFloorShare: number;

  // --- Institutions / policies ---
  /** Cap on the sitter hourly rate, $/hr. null = market rate. */
  rateCap: number | null;
  /** Kids per sitter. 1 = one-on-one. Raising it batches care. */
  kidsPerSitter: number;
  /** Fraction of each sitter-hour bill paid by the town (0..0.95). */
  subsidyRate: number;
  /** Whether the robo-sitter app is on the market. */
  roboSitter: boolean;
  /** How readily families accept the robo-sitter (0..1). */
  roboAcceptance: number;

  // --- Distribution ---
  /** Who gets the productivity dividend. */
  distribution: Distribution;
}

export const DEFAULT_PARAMS: Params = {
  totalWorkers: 24,
  hoursPerWeek: 40,
  baseWage: 12,

  passThrough: 1,

  mobility: 0.28,
  trainingWeeks: 8,

  sigma: 0.55,
  incomeElasticity: 1.1,
  needFloorShare: 0.5,

  rateCap: null,
  kidsPerSitter: 1,
  subsidyRate: 0,
  roboSitter: false,
  roboAcceptance: 0.5,

  distribution: "shared",
};

/** Clamp helper used across the model. */
export function clamp(x: number, lo: number, hi: number): number {
  return Math.min(hi, Math.max(lo, x));
}

import { z } from "zod";

/** Bounds that keep every derived quantity finite and meaningful. */
const paramsSchema = z.object({
  totalWorkers: z.number().min(2).max(200),
  hoursPerWeek: z.number().min(1).max(80),
  baseWage: z.number().min(1).max(1000),
  passThrough: z.number().min(0).max(1),
  mobility: z.number().min(0).max(1),
  trainingWeeks: z.number().min(0).max(104),
  sigma: z.number().min(0.1).max(4),
  incomeElasticity: z.number().min(0.5).max(2),
  needFloorShare: z.number().min(0).max(1),
  rateCap: z.number().min(1).max(1e6).nullable(),
  kidsPerSitter: z.number().int().min(1).max(8),
  subsidyRate: z.number().min(0).max(0.9),
  roboSitter: z.boolean(),
  roboAcceptance: z.number().min(0).max(1),
  distribution: z.enum(["shared", "concentrated"]),
});

/**
 * Validate params from any outside source (UI knobs, the window.__town hook).
 * Throws with a readable message rather than letting a bad value reach the sim.
 */
export function checkParams(p: Params): Params {
  return paramsSchema.parse(p);
}
