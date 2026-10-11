import { describe, expect, it } from "vitest";
import { makeParams } from "../src/model/params";
import { CASES, courseOf, recipeOf, runCase, type Case } from "../src/figures/casebook";
import { RUN_YEARS } from "../src/figures/runCharts";

const caseOf = (scenario: Case["scenario"]): Case => {
  const c = CASES.find((x) => x.scenario === scenario);
  if (!c) throw new Error(`no case for ${scenario}`);
  return c;
};

const priceAt = (c: Case, t: number): number => {
  const sample = runCase(c).samples.find((s) => s.t >= t);
  if (!sample) throw new Error(`no sample at ${t}`);
  return sample.snap.price;
};

describe("casebook", () => {
  it("keeps every case's rules inside the schema's ranges for the whole run", () => {
    for (const c of CASES) {
      for (let t = 0; t <= RUN_YEARS; t += 5) expect(() => makeParams(courseOf(c).rules(t))).not.toThrow();
    }
  });

  it("covers each scenario once", () => {
    expect(new Set(CASES.map((c) => c.scenario)).size).toBe(CASES.length);
  });

  it("matches the essay: about tenfold where nothing intervenes, less where something gives", () => {
    for (const c of CASES) {
      const { start, end } = runCase(c);
      const growth = end.price / start.price;
      const intervenes = ["lessons", "restaurants", "law"].includes(c.scenario);
      if (intervenes) expect(growth).toBeLessThan(7.5);
      else expect(growth).toBeGreaterThan(8.5);
    }
  });

  it("restaurants: once the kitchen improves, the price climbs about half as fast", () => {
    const c = caseOf("restaurants");
    const before = Math.log(priceAt(c, 20) / priceAt(c, 0));
    const after = Math.log(priceAt(c, 40) / priceAt(c, 20));
    expect(after / before).toBeGreaterThan(0.3);
    expect(after / before).toBeLessThan(0.7);
  });

  it("opens in the lab with the final year's settings", () => {
    const law = recipeOf(caseOf("law"));
    expect(law.scenario).toBe("law");
    expect(law.params.automation).toBeCloseTo(0.45);
  });
});
