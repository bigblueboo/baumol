import { z } from "zod";
import { createStore } from "zustand/vanilla";
import { ParamsSchema, makeParams, type Params } from "../../model/params";
import { SCENARIOS, SCENARIO_IDS, type ScenarioId } from "../../model/scenarios";

export const SPEEDS = [1, 2, 4] as const;
export type Speed = (typeof SPEEDS)[number];

export interface LabState {
  scenario: ScenarioId;
  params: Params;
  playing: boolean;
  speed: Speed;
}

export type Recipe = Pick<LabState, "scenario" | "params">;

/** A scenario's own starting point; the lab always has some growth so Play does something. */
export function paramsFor(id: ScenarioId): Params {
  return makeParams({ goodsGrowth: 0.07, ...SCENARIOS[id].defaults });
}

const HASH_PREFIX = "#lab?";
const PARAM_KEYS = ParamsSchema.keyof().options;
const ScenarioIdSchema = z.enum(SCENARIO_IDS);

/**
 * Lab settings live in the address bar as only the values that differ from the scenario's
 * defaults, so a shared link reads like a recipe: `#lab?s=lessons&caseload=2`.
 */
export function encode({ scenario, params }: Recipe): string {
  const q = new URLSearchParams({ s: scenario });
  const defaults = paramsFor(scenario);
  for (const key of PARAM_KEYS) if (params[key] !== defaults[key]) q.set(key, String(params[key]));
  return HASH_PREFIX + q.toString();
}

function coerce(v: string): string | number | boolean {
  if (v === "true" || v === "false") return v === "true";
  return v !== "" && Number.isFinite(Number(v)) ? Number(v) : v;
}

/** Each setting is validated on its own: one bad value is dropped, the rest of the recipe survives. */
export function decode(hash: string): Recipe | null {
  if (!hash.startsWith(HASH_PREFIX)) return null;
  const q = new URLSearchParams(hash.slice(HASH_PREFIX.length));
  const scenario = ScenarioIdSchema.safeParse(q.get("s"));
  if (!scenario.success) return null;
  const overrides: Partial<Params> = {};
  for (const key of PARAM_KEYS) {
    const raw = q.get(key);
    if (raw === null) continue;
    const parsed = ParamsSchema.shape[key].safeParse(coerce(raw));
    if (parsed.success) Object.assign(overrides, { [key]: parsed.data });
  }
  return { scenario: scenario.data, params: makeParams({ ...paramsFor(scenario.data), ...overrides }) };
}

export function createLabStore(initial: Recipe | null) {
  const scenario = initial?.scenario ?? "care";
  return createStore<LabState>(() => ({
    scenario,
    params: initial?.params ?? paramsFor(scenario),
    playing: false,
    speed: 1,
  }));
}
