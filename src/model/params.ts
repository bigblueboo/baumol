import { z } from "zod";

/**
 * The valid range of every numeric knob. The schema is built from this table and the lab's
 * sliders read it too, so a control can never offer a value the model would reject.
 */
export const RANGES = {
  goodsGrowth: [0, 0.2],
  serviceGrowth: [0, 0.1],
  mobility: [0, 1],
  trainingYears: [0, 5],
  wagePassThrough: [0, 1],
  substitutability: [0, 2],
  incomeSensitivity: [0, 2],
  essentialFloor: [0, 1],
  subsidy: [0, 0.9],
  caseload: [1, 4],
  automation: [0, 0.9],
  concentration: [0, 1],
} as const;
export type NumKey = keyof typeof RANGES;

const ranged = (k: NumKey) => z.number().min(RANGES[k][0]).max(RANGES[k][1]);

/**
 * Every knob the economy exposes. Figures pin most of these; the Lab exposes all of them.
 * Ranges are enforced by the schema so URL-supplied state can never push the model
 * into a region it was not calibrated for.
 */
export const ParamsSchema = z.object({
  // Productivity
  goodsGrowth: ranged("goodsGrowth"),
  serviceGrowth: ranged("serviceGrowth"),

  // Labor market
  sharedLaborMarket: z.boolean(),
  mobility: ranged("mobility"),
  trainingYears: ranged("trainingYears"),
  wagePassThrough: ranged("wagePassThrough"),

  // Demand
  substitutability: ranged("substitutability"),
  incomeSensitivity: ranged("incomeSensitivity"),
  essentialFloor: ranged("essentialFloor"),

  // Institutions
  funding: z.enum(["market", "public"]),
  subsidy: ranged("subsidy"),
  budgetFrozen: z.boolean(),
  wageCap: z.boolean(),
  caseload: ranged("caseload"),
  automation: ranged("automation"),
  qualityStandard: z.boolean(),

  // Distribution
  concentration: ranged("concentration"),
  progressiveTax: z.boolean(),
});

export type Params = z.infer<typeof ParamsSchema>;
export type Funding = Params["funding"];

const DEFAULT_PARAMS: Params = {
  goodsGrowth: 0,
  serviceGrowth: 0,
  sharedLaborMarket: true,
  mobility: 0.6,
  trainingYears: 0.5,
  wagePassThrough: 1,
  substitutability: 1,
  incomeSensitivity: 1,
  essentialFloor: 0,
  funding: "market",
  subsidy: 0,
  budgetFrozen: false,
  wageCap: false,
  caseload: 1,
  automation: 0,
  qualityStandard: false,
  concentration: 0,
  progressiveTax: false,
};

export function makeParams(overrides: Partial<Params> = {}): Params {
  return ParamsSchema.parse({ ...DEFAULT_PARAMS, ...overrides });
}
