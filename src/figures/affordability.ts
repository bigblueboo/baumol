import type { Snapshot } from "../model/economy";
import type { Funding } from "../model/params";
import { quarterStats } from "../model/residents";
import type { Scenario } from "../model/scenarios";
import { num, pct } from "../ui/format";

interface Reading {
  text: string;
  /** 0..1, for a gauge bar. */
  fraction: number;
}

interface Bar {
  value: number;
  /** A reference tick: where that household started, or its pre-tax income. */
  ghost: number;
}

/**
 * How to read affordability, which depends on who pays. At the counter, the question is how
 * much service an hour of income buys at full cost; with public provision the service is free,
 * and the question becomes how much income each household keeps after the tax that pays for it.
 * Fig. 8 and the lab both read through these, so they can't disagree.
 */
interface Lens {
  /** One bar per household, poorest first; `start` is the same town before any machines. */
  bars: (snap: Snapshot, start: Snapshot) => Bar[];
  unit: (sc: Scenario) => string;
  readings: (snap: Snapshot) => { all: Reading; bottom: Reading };
}

/** The gauges fill at this many service units per hour of income. */
const GAUGE_FULL = 2;

/** What an hour of after-tax income buys at the counter, subsidy included. */
const buys = (snap: Snapshot) => quarterStats(snap.residents, (r) => r.net / snap.userPrice);

export const LENSES: Record<Funding, Lens> = {
  market: {
    bars: (snap, start) =>
      snap.residents.map((r, i) => ({ value: r.net / snap.userPrice, ghost: (start.residents[i] ?? r).net / start.userPrice })),
    unit: (sc) => `${sc.service.many} per hour of income`,
    readings: (snap) => {
      const b = buys(snap);
      return { all: { text: num(b.all), fraction: b.all / GAUGE_FULL }, bottom: { text: num(b.bottom), fraction: b.bottom / GAUGE_FULL } };
    },
  },
  public: {
    bars: (snap) => snap.residents.map((r) => ({ value: r.net, ghost: r.gross })),
    unit: () => "share of income kept after tax",
    readings: (snap) => {
      const net = quarterStats(snap.residents, (r) => r.net);
      const gross = quarterStats(snap.residents, (r) => r.gross);
      const all = net.all / gross.all;
      const bottom = net.bottom / gross.bottom;
      return { all: { text: pct(all), fraction: all }, bottom: { text: pct(bottom), fraction: bottom } };
    },
  },
};
