/**
 * The town's five answers to an expensive hour. One lever at a time, so each
 * cause keeps a visible effect; real towns combine them.
 */

import type { Params } from "../model/params";
import type { PolicyId } from "./store";
import type { Derived, SimState } from "../model/sim";
import { money, pct, waitTime } from "../model/format";

export interface PolicyDef {
  id: PolicyId;
  name: string;
  desc: string;
  apply(p: Params, sim: SimState): Params;
  /** Live one-line readout shown on the card while the policy is in effect. */
  outcome(sim: SimState, d: Derived, p: Params): string;
}

export const POLICIES: PolicyDef[] = [
  {
    id: "market",
    name: "Pay the rate",
    desc: "Let the price clear the market. Families who can't pay it drop out of the queue.",
    apply: (p) => ({
      ...p,
      rateCap: null,
      kidsPerSitter: 1,
      roboSitter: false,
      subsidyRate: 0,
    }),
    outcome: (sim, d) =>
      `rate ${money(sim.wSit)}/hr · requests staffed ${pct(d.coverage)} · 1999-level hours covered ${pct(d.baselineCovered)}`,
  },
  {
    id: "cap",
    name: "Cap the rate",
    desc: "Roll the rate back and freeze it. Sitters remain free to choose the studio instead.",
    apply: (p, sim) => ({
      ...p,
      rateCap: Math.max(p.baseWage, Math.round(sim.wSit * 0.6)),
      kidsPerSitter: 1,
      roboSitter: false,
      subsidyRate: 0,
    }),
    outcome: (sim, d, p) =>
      `capped at ${money(p.rateCap ?? sim.wSit)}/hr · 1999-level hours covered ${pct(d.baselineCovered)} · wait ${waitTime(sim.waitDays)}`,
  },
  {
    id: "batch",
    name: "Share the sitter",
    desc: "One sitter, three kids. The hourly bill splits three ways — and so does the sitter.",
    apply: (p) => ({
      ...p,
      rateCap: null,
      kidsPerSitter: 3,
      roboSitter: false,
      subsidyRate: 0,
    }),
    outcome: (sim, d, p) =>
      `${money(d.pSitFamily)}/kid-hour · attention ${pct(d.attention)} · quality-adjusted care ${pct(d.qualityCare)}`,
  },
  {
    id: "robo",
    name: "Ship RoboSitter",
    desc: "An app minds the kids at software prices — three units an hour. It is not a person.",
    apply: (p) => ({
      ...p,
      rateCap: null,
      kidsPerSitter: 1,
      roboSitter: true,
      subsidyRate: 0,
    }),
    outcome: (_sim, d) =>
      `robo minds ${pct(d.roboShare)} of care hours · human attention on the rest ${pct(d.attention)}`,
  },
  {
    id: "subsidy",
    name: "Subsidize sitting",
    desc: "The town pays half of every sitting bill, funded by a tax on everyone's income.",
    apply: (p) => ({
      ...p,
      rateCap: null,
      kidsPerSitter: 1,
      roboSitter: false,
      subsidyRate: 0.5,
    }),
    outcome: (_sim, d) =>
      `families pay ${money(d.pSitFamily)}/hr · town budget ${pct(d.publicShare)} of income`,
  },
];

export function policyById(id: PolicyId): PolicyDef {
  const def = POLICIES.find((p) => p.id === id);
  if (!def) throw new Error(`unknown policy ${id}`);
  return def;
}
