import { describe, expect, it } from "vitest";
import { effectiveInstitutions, initialState, observe, settledAt, step, willingShare, type Calibration } from "../src/model/economy";
import { makeParams, type Params } from "../src/model/params";
import { quarterStats } from "../src/model/residents";
import type { Snapshot } from "../src/model/economy";

const afford = (s: Snapshot) => quarterStats(s.residents, (r) => r.net / s.price);

const cal: Calibration = { population: 24, baseShare: 1 / 3, machineQuality: 0.5 };

function run(p: Params, years: number, growth = 2 ** (1 / 4) - 1) {
  let s = initialState(cal);
  const params = { ...p, goodsGrowth: growth };
  for (let i = 0; i < years * 120; i++) s = step(params, cal, s, 1 / 120);
  return observe(params, cal, s);
}

describe("the Baumol identity", () => {
  it.each([0, 0.5, 1, 1.5])("the service's relative price equals A_G / A_S at any substitutability (σ=%s)", (sigma) => {
    for (const d of [0, 2, 4]) {
      const snap = settledAt(makeParams({ substitutability: sigma }), cal, d);
      expect(snap.price).toBeCloseTo(2 ** d, 1);
    }
  });

  it("reaches the exact ratio even when shrinking demand never strains the provider", () => {
    const watch = { population: 24, baseShare: 1 / 6, machineQuality: 0.6 };
    expect(settledAt(makeParams({ substitutability: 1.6 }), watch, 3).price).toBeCloseTo(8, 2);
  });

  it("divides by service productivity too", () => {
    const snap = settledAt(makeParams(), cal, 3, 2);
    expect(snap.price).toBeCloseTo(4, 1);
  });

  it("vanishes when workers cannot switch jobs", () => {
    const snap = settledAt(makeParams({ sharedLaborMarket: false }), cal, 3);
    expect(snap.price).toBeCloseTo(1, 5);
    expect(snap.factoryWage).toBeCloseTo(8, 5);
  });

  it("vanishes when the machine's gains go to owners instead of wages", () => {
    const snap = settledAt(makeParams({ wagePassThrough: 0 }), cal, 3);
    expect(snap.price).toBeCloseTo(1, 2);
  });
});

describe("structural change depends on demand", () => {
  const share = (sigma: number, d: number) => settledAt(makeParams({ substitutability: sigma }), cal, d).careWorkers / 24;

  it("pulls workers into the service when people won't accept an alternative", () => {
    expect(share(0.5, 4)).toBeGreaterThan(share(0.5, 0) + 0.2);
  });

  it("keeps shares fixed at unit substitutability", () => {
    expect(share(1, 4)).toBeCloseTo(share(1, 0), 2);
  });

  it("shrinks the human service when substitutes are acceptable", () => {
    expect(share(1.5, 4)).toBeLessThan(share(1.5, 0) - 0.15);
  });

  it("leaves the town materially richer either way", () => {
    for (const sigma of [0.3, 1, 1.7]) expect(settledAt(makeParams({ substitutability: sigma }), cal, 3).material).toBeGreaterThan(2);
  });
});

describe("policy responses", () => {
  const base = makeParams({ substitutability: 0.5, essentialFloor: 0.6 });
  const pay = run(base, 12);

  it("paying the price keeps everyone served with short waits", () => {
    expect(pay.coverage).toBe(1);
    expect(pay.waitDays).toBeLessThan(5);
  });

  it("a wage cap produces vacancies, queues and lost coverage", () => {
    const cap = run({ ...base, wageCap: true }, 12);
    expect(cap.careWorkers).toBeLessThan(pay.careWorkers / 2);
    expect(cap.waitDays).toBeGreaterThan(30);
    expect(cap.coverage).toBeLessThan(0.6);
  });

  it("a frozen budget delivers a fraction of the care", () => {
    const frozen = run({ ...base, budgetFrozen: true }, 12);
    expect(frozen.coverage).toBeLessThan(0.3);
  });

  it("bigger caseloads lower the price and the quality", () => {
    const busy = run({ ...base, caseload: 2.5 }, 12);
    expect(busy.price).toBeLessThan(pay.price * 0.6);
    expect(busy.quality).toBeLessThan(0.7);
  });

  it("automation lowers the price and the human share", () => {
    const robots = run({ ...base, automation: 0.6 }, 12);
    expect(robots.price).toBeLessThan(pay.price * 0.6);
    expect(robots.presence).toBeLessThan(0.5);
  });

  it("public provision serves everyone and shows up in the budget", () => {
    const pub = run({ ...base, funding: "public" }, 12);
    expect(pub.coverage).toBe(1);
    expect(pub.publicShare).toBeGreaterThan(0.4);
  });

  it("a quality standard caps caseload and automation", () => {
    const wanted = makeParams({ ...base, caseload: 3, automation: 0.8, qualityStandard: true });
    const eff = effectiveInstitutions(wanted, cal);
    expect(eff.caseload).toBeLessThanOrEqual(1.25);
    expect(eff.automation).toBeLessThan(0.8);
    expect(settledAt(wanted, cal, 3).quality).toBeGreaterThanOrEqual(0.85 - 1e-6);
  });
});

describe("distribution", () => {
  it("concentrated gains leave the bottom quarter behind while the average holds", () => {
    const even = settledAt(makeParams({ substitutability: 0.5 }), cal, 4);
    const top = settledAt(makeParams({ substitutability: 0.5, concentration: 1 }), cal, 4);
    expect(afford(top).all).toBeCloseTo(afford(even).all, 1);
    expect(afford(top).bottom).toBeLessThan(afford(even).bottom * 0.6);
    expect(top.coverage).toBeLessThan(even.coverage);
  });

  it("public provision restores access", () => {
    const top = settledAt(makeParams({ substitutability: 0.5, concentration: 1, funding: "public" }), cal, 4);
    expect(top.coverage).toBe(1);
  });

  it("residents come out poorest first", () => {
    const snap = settledAt(makeParams({ concentration: 0.5 }), cal, 3);
    const gross = snap.residents.map((r) => r.gross);
    expect([...gross].sort((a, b) => a - b)).toEqual(gross);
  });
});

describe("dynamics", () => {
  it("is deterministic", () => {
    const a = run(makeParams({ wageCap: true }), 6);
    const b = run(makeParams({ wageCap: true }), 6);
    expect(a).toEqual(b);
  });

  it("lets workers leave before the service wage catches up", () => {
    const p = makeParams({ mobility: 0.9, trainingYears: 0 });
    const small = { ...cal, population: 12 };
    let s = { ...initialState(small), goodsTarget: 2 };
    let low = s.careWorkers;
    for (let i = 0; i < 120; i++) {
      s = step(p, small, s, 1 / 120);
      low = Math.min(low, s.careWorkers);
    }
    expect(low).toBeLessThan(2.5);
    for (let i = 0; i < 600; i++) s = step(p, small, s, 1 / 120);
    expect(s.careWorkers).toBeGreaterThan(3.9);
    expect(s.careWage).toBeCloseTo(2, 1);
  });

  it("labor supply rises with the wage ratio", () => {
    expect(willingShare(0.3)).toBeGreaterThan(0);
    expect(willingShare(0.7)).toBeLessThan(willingShare(0.9));
    expect(willingShare(1)).toBe(1);
  });
});

describe("taxes", () => {
  it("never flip the income ranking, even at very high public spending", () => {
    for (const progressiveTax of [false, true]) {
      const snap = settledAt(makeParams({ substitutability: 0.3, funding: "public", progressiveTax }), cal, 5);
      const net = snap.residents.map((r) => r.net);
      expect([...net].sort((a, b) => a - b)).toEqual(net);
    }
  });

  it("progressive taxes leave the bottom quarter more", () => {
    const flat = settledAt(makeParams({ funding: "public", substitutability: 0.5 }), cal, 4);
    const prog = settledAt(makeParams({ funding: "public", substitutability: 0.5, progressiveTax: true }), cal, 4);
    expect(afford(prog).bottom).toBeGreaterThan(afford(flat).bottom);
  });
});

describe("courses", () => {
  it("play out the same whether advanced in one go or frame by frame", async () => {
    const { TownSim } = await import("../src/sim/townSim");
    const course = { years: 6, rules: (t: number) => makeParams({ goodsGrowth: 0.12, caseload: 1 + Math.min(1, t / 6) }) };
    const once = new TownSim(course, cal);
    once.advance(6);
    const framed = new TownSim(course, cal);
    for (let i = 0; i < 1000 && !framed.done; i++) framed.advance(0.0137 + (i % 3) * 0.004);
    expect(framed.done).toBe(true);
    expect(framed.snap).toEqual(once.snap);
  });
});

describe("sticky service pay", () => {
  it("holds while the gap opens, then catches up to the factory wage", () => {
    const p = makeParams();
    let s = { ...initialState(cal), goodsTarget: 4 };
    for (let i = 0; i < 60; i++) s = step(p, cal, s, 1 / 120);
    expect(s.careWage).toBe(1);
    expect(observe(p, cal, s).factoryWage).toBeGreaterThan(2);
    for (let i = 0; i < 1200; i++) s = step(p, cal, s, 1 / 120);
    expect(s.careWage).toBeCloseTo(4, 1);
  });

  it("holds again on the next invention, even right after settling", () => {
    const p = makeParams();
    let s = { ...initialState(cal), goodsTarget: 2 };
    for (let i = 0; i < 1200; i++) s = step(p, cal, s, 1 / 120);
    expect(s.careWage).toBeCloseTo(2, 2);
    s = { ...s, goodsTarget: 4 };
    for (let i = 0; i < 60; i++) s = step(p, cal, s, 1 / 120);
    expect(s.careWage).toBeCloseTo(2, 2);
  });

  it("tells choosing an alternative apart from being turned away", () => {
    const substitutes = settledAt(makeParams({ substitutability: 1.6 }), cal, 4);
    expect(substitutes.optedOut).toBeGreaterThan(0);
    expect(substitutes.rationed).toBe(0);
    const frozen = settledAt(makeParams({ budgetFrozen: true, funding: "public" }), cal, 3);
    expect(frozen.rationed).toBeGreaterThan(0);
    expect(frozen.optedOut).toBe(0);
  });
});
