import { describe, expect, it } from "vitest";
import { DEFAULT_PARAMS, type Params } from "../src/model/params";
import { derive, initState, run, step, upgrade } from "../src/model/sim";

const P = DEFAULT_PARAMS;

function pressAndSettle(presses: number, params: Params = P, settleWeeks = 120) {
  let s = initState(params);
  for (let i = 0; i < presses; i++) {
    s = upgrade(s);
    s = run(s, params, 20);
  }
  s = run(s, params, settleWeeks);
  return s;
}

describe("the opening scene", () => {
  it("starts at parity: same wage, same price, ratio 1", () => {
    const s = initState(P);
    const d = derive(s, P);
    expect(s.wEng).toBe(P.baseWage);
    expect(s.wSit).toBe(P.baseWage);
    expect(d.pSoftware).toBe(P.baseWage);
    expect(d.pSit).toBe(P.baseWage);
    expect(d.ratio).toBe(1);
    expect(d.coverage).toBe(1);
    expect(d.materialIndex).toBeCloseTo(1, 5);
  });

  it("holds still when nobody presses the button", () => {
    const s = run(initState(P), P, 50);
    const d = derive(s, P);
    expect(d.ratio).toBeCloseTo(1, 2);
    expect(s.sitters).toBeCloseTo(P.totalWorkers / 2, 1);
    expect(d.coverage).toBeGreaterThan(0.99);
  });
});

describe("the Baumol mechanism", () => {
  it("three doublings make a sitter-hour cost ~8 software units", () => {
    const s = pressAndSettle(3);
    const d = derive(s, P);
    expect(s.aEng).toBeCloseTo(8, 1);
    // The ratio converges to aEng within the labor-market deadband and the
    // small scarcity premium sitters can sustain.
    expect(d.ratio).toBeGreaterThan(8 * 0.85);
    expect(d.ratio).toBeLessThan(8 * 1.1);
    expect(s.wSit / s.wEng).toBeLessThanOrEqual(1.081);
  });

  it("raises the sitter wage even though sitting is unchanged", () => {
    const s = pressAndSettle(3);
    expect(s.wSit).toBeGreaterThan(P.baseWage * 5);
    // And the sitter wage tracks the engineer wage, not sitter productivity.
    expect(s.wSit / s.wEng).toBeGreaterThan(0.8);
  });

  it("cuts software's time price to minutes while care stays an hour", () => {
    const s = pressAndSettle(3);
    const d = derive(s, P);
    // A software unit costs 1/aEng hours of anyone's work: 7.5 minutes.
    expect((d.pSoftware / s.wEng) * 60).toBeCloseTo(7.5, 1);
    // A sitter-hour still costs about one hour of anyone's work.
    expect(d.pSit / s.wSit).toBeCloseTo(1, 5);
  });

  it("leaves the town materially richer, not poorer", () => {
    const s = pressAndSettle(3);
    const d = derive(s, P);
    expect(d.materialIndex).toBeGreaterThan(3);
  });

  it("survives every pass-through setting: the gap changes costume, not size", () => {
    // With full pass-through the sitter's dollar rate soars; with none, the
    // dollar rate stays flat and software collapses in price instead. The
    // RELATIVE price — the actual disease — lands near aEng either way.
    for (const passThrough of [0, 0.5, 1]) {
      const params: Params = { ...P, passThrough };
      const s = pressAndSettle(3, params, 200);
      const d = derive(s, params);
      expect(d.ratio, `ratio at passThrough=${passThrough}`).toBeGreaterThan(8 * 0.8);
      expect(d.ratio, `ratio at passThrough=${passThrough}`).toBeLessThan(8 * 1.15);
    }
    // ...but the nominal form differs: no pass-through leaves rates flat.
    const flat: Params = { ...P, passThrough: 0 };
    const s = pressAndSettle(3, flat);
    const d = derive(s, flat);
    expect(s.wEng).toBeCloseTo(P.baseWage, 1);
    expect(d.pSit).toBeLessThan(P.baseWage * 1.5);
    expect(d.pSoftware).toBeLessThan(P.baseWage / 4);
  });
});

describe("the demand side", () => {
  it("poor substitutes: care spending share rises", () => {
    const params: Params = { ...P, sigma: 0.4 };
    const s = pressAndSettle(3, params);
    const d = derive(s, params);
    expect(d.careSpendShare).toBeGreaterThan(0.5);
  });

  it("willing substitutes: families walk away from human care", () => {
    const params: Params = { ...P, sigma: 2.0, needFloorShare: 0.2 };
    const s = pressAndSettle(3, params);
    const sBase = pressAndSettle(3, P);
    expect(s.demandHours).toBeLessThan(sBase.demandHours);
    const d = derive(s, params);
    const dBase = derive(sBase, P);
    expect(d.careSpendShare).toBeLessThan(dBase.careSpendShare);
  });

  it("sigma near 1 keeps spending shares roughly flat", () => {
    const params: Params = { ...P, sigma: 1.0, incomeElasticity: 1.0 };
    const s = pressAndSettle(3, params);
    const d = derive(s, params);
    expect(d.careSpendShare).toBeGreaterThan(0.35);
    expect(d.careSpendShare).toBeLessThan(0.65);
  });
});

describe("policy responses", () => {
  it("a rate cap empties the care house: vacancies and waits, not savings", () => {
    const params: Params = { ...P, rateCap: P.baseWage * 1.5 };
    const s = pressAndSettle(3, params);
    const d = derive(s, params);
    expect(s.wSit).toBeLessThanOrEqual(P.baseWage * 1.5 + 1e-9);
    expect(d.coverage).toBeLessThan(0.6);
    expect(s.waitDays).toBeGreaterThan(20);
    // and the fixed-need measure shows the access damage too
    expect(d.baselineCovered).toBeLessThan(0.75);
  });

  it("batching cuts the per-kid price and the attention with it", () => {
    const params: Params = { ...P, kidsPerSitter: 3 };
    const capped = pressAndSettle(3, params);
    const dc = derive(capped, params);
    const base = pressAndSettle(3, P);
    const db = derive(base, P);
    expect(dc.pSitFamily).toBeLessThan(db.pSitFamily);
    expect(dc.attention).toBeCloseTo(1 / 3, 5);
  });

  it("subsidy keeps families covered but shows up in the public budget", () => {
    const params: Params = { ...P, subsidyRate: 0.5 };
    const s = pressAndSettle(3, params);
    const d = derive(s, params);
    expect(d.publicShare).toBeGreaterThan(0.05);
    expect(d.coverage).toBeGreaterThan(0.85);
  });

  it("the robo-sitter takes over exactly when it's cheap and accepted", () => {
    const params: Params = { ...P, roboSitter: true, roboAcceptance: 0.7 };
    const s = pressAndSettle(4, params);
    const d = derive(s, params);
    expect(d.roboShare).toBeGreaterThan(0.3);
    // At parity the robo app is no cheaper than a sitter: nobody switches.
    const early = run(upgrade(initState(params)), params, 0.5);
    const dEarly = derive(early, params);
    expect(dEarly.roboShare).toBeLessThan(0.1);
  });
});

describe("distribution", () => {
  it("shared gains: sitting stays about as affordable as in 1999", () => {
    const s = pressAndSettle(3, P);
    const d = derive(s, P);
    const d0 = derive(initState(P), P);
    // Wages and the sitter rate rise together, so affordability holds
    // roughly flat — the paradox is that it merely holds, while software
    // affordability multiplies.
    expect(d.affordAvg).toBeGreaterThan(d0.affordAvg * 0.8);
    expect(d.affordAvg).toBeLessThan(d0.affordAvg * 1.3);
    expect(d.affordQ1).toBeGreaterThan(d0.affordQ1 * 0.75);
  });

  it("concentrated gains: the average rises while the bottom quartile loses access", () => {
    const params: Params = { ...P, distribution: "concentrated" };
    const s = pressAndSettle(3, params);
    const d = derive(s, params);
    const d0 = derive(initState(params), params);
    expect(d.affordQ1).toBeLessThan(d0.affordQ1 * 0.6);
    expect(d.affordAvg).toBeGreaterThan(d.affordQ1 * 2);
  });
});

describe("honest metrics", () => {
  it("income is exactly engineer payroll plus booked sitter income", () => {
    const s = pressAndSettle(2);
    const booked = Math.min(s.supplyHours, s.demandHours) / P.kidsPerSitter;
    expect(s.income).toBeCloseTo(
      s.engineers * s.wEng * P.hoursPerWeek + s.wSit * booked,
      6,
    );
  });

  it("a shrunken queue can't fake access: staffed rises, baseline stays honest", () => {
    // Willing substitutes and no need floor: demand collapses with price,
    // fill rate looks great, but baseline hours covered falls.
    const params: Params = { ...P, sigma: 2.2, needFloorShare: 0 };
    const s = pressAndSettle(3, params);
    const d = derive(s, params);
    expect(d.coverage).toBeGreaterThan(0.9);
    expect(d.baselineCovered).toBeLessThan(0.85);
  });

  it("batching counts hours fully but quality-adjusts the care", () => {
    const params: Params = { ...P, kidsPerSitter: 3 };
    const s = pressAndSettle(2, params);
    const d = derive(s, params);
    expect(d.baselineCovered).toBeGreaterThan(d.qualityCare);
    expect(d.qualityCare).toBeLessThanOrEqual(d.baselineCovered / 2);
  });

  it("robo hours are paid for out of the family budget", () => {
    const params: Params = { ...P, roboSitter: true, roboAcceptance: 0.7 };
    const s = pressAndSettle(4, params);
    const d = derive(s, params);
    // robo captured real share, and total spending still adds up inside income
    expect(d.roboShare).toBeGreaterThan(0.2);
    const roboSpend = s.roboHours * 3 * d.pSoftware;
    const humanSpend = Math.min(s.demandHours, s.supplyHours) * d.pSitFamily;
    expect(roboSpend + humanSpend).toBeLessThan(s.income);
  });
});

describe("the machinery", () => {
  it("is deterministic: same presses, same history", () => {
    const a = pressAndSettle(2);
    const b = pressAndSettle(2);
    expect(a).toEqual(b);
  });

  it("conserves workers through the retraining pipeline", () => {
    let s = initState(P);
    s = upgrade(s);
    for (let i = 0; i < 400; i++) {
      s = step(s, P, 1 / 32);
      const total =
        s.engineers + s.sitters + s.training.reduce((a, c) => a + c.count, 0);
      expect(total).toBeCloseTo(P.totalWorkers, 6);
    }
  });

  it("keeps every displayed quantity finite under a harsh cap", () => {
    const params: Params = { ...P, rateCap: P.baseWage, mobility: 0.5 };
    let s = initState(params);
    for (let press = 0; press < 5; press++) {
      s = upgrade(s);
      s = run(s, params, 30);
      const d = derive(s, params);
      for (const [k, v] of Object.entries(d)) {
        expect(Number.isFinite(v), `${k} should be finite`).toBe(true);
      }
    }
  });

  it("training delay slows the exodus but not its destination", () => {
    const fast = pressAndSettle(2, { ...P, trainingWeeks: 0 });
    const slow = pressAndSettle(2, { ...P, trainingWeeks: 16 }, 300);
    expect(Math.abs(fast.wSit - slow.wSit) / fast.wSit).toBeLessThan(0.15);
  });
});
