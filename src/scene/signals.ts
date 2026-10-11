import type { Snapshot } from "../model/economy";

/** Below this wage ratio, service workers start eyeing the factory. */
const TEMPTED_RATIO = 0.97;
/** Vacancies (in workers) before the provider hangs out a sign. */
const HIRING_SIGN_VACANCIES = 0.5;

/** Service workers would earn noticeably more at the factory: show the thought bubbles. */
export function isTempted(snap: Snapshot): boolean {
  return snap.wageRatio < TEMPTED_RATIO;
}

/** The provider is visibly short-staffed and could hire: hang out the sign. */
export function isHiring(snap: Snapshot): boolean {
  return snap.params.sharedLaborMarket && snap.vacancies >= HIRING_SIGN_VACANCIES;
}

/** Everything the noticeboard (or the phone strip) shows, in display units. */
export interface ReadoutModel {
  goodsWage: number;
  serviceWage: number;
  price: number;
  /** Institutions in force, as short labels. Empty means a plain market. */
  rules: string[];
  /** How far the service wage trails the factory's, while it visibly does. */
  gap: number | null;
}

export function readoutModel(snap: Snapshot, perHour: number): ReadoutModel {
  const p = snap.params;
  const rules = [
    !p.sharedLaborMarket && "NO SWITCHING",
    p.wageCap && "WAGE CAP",
    p.budgetFrozen && "BUDGET FROZEN",
    p.funding === "public" && "PUBLIC",
    p.funding === "market" && p.subsidy > 0 && `SUBSIDY ${Math.round(p.subsidy * 100)}%`,
    snap.caseload > 1.01 && `CASELOAD ×${Math.round(snap.caseload * 10) / 10}`,
    snap.automation > 0.01 && `${Math.round(snap.automation * 100)}% AUTOMATED`,
    p.qualityStandard && "QUALITY STANDARD",
  ].filter((r): r is string => typeof r === "string");
  return {
    goodsWage: snap.factoryWage * perHour,
    serviceWage: snap.careWage * perHour,
    price: snap.price,
    rules,
    gap: isTempted(snap) ? (snap.factoryWage - snap.careWage) * perHour : null,
  };
}

/** Rules as one line, abbreviated past `max` entries. */
export function rulesLine(rules: string[], max = 1): string {
  if (!rules.length) return "OPEN MARKET";
  const shown = rules.slice(0, max).join(" · ");
  return rules.length > max ? `${shown} +${rules.length - max}` : shown;
}
