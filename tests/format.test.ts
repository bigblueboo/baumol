import { describe, expect, it } from "vitest";
import { count, minutes, num, quarters } from "../src/ui/format";

describe("formatting", () => {
  it("prints friendly numbers", () => {
    expect(num(8)).toBe("8");
    expect(num(7.98)).toBe("8");
    expect(num(3.75)).toBe("3.8");
    expect(num(1234)).toBe("1,234");
  });

  it("uses fractions for quarter minutes", () => {
    expect(quarters(3.75)).toBe("3¾");
    expect(quarters(7.5)).toBe("7½");
    expect(minutes(0.9375)).toBe("56 sec");
  });

  it("agrees nouns with printed numbers", () => {
    expect(count(1, "gadget", "gadgets")).toBe("1 gadget");
    expect(count(1.02, "gadget", "gadgets")).toBe("1 gadget");
    expect(count(2, "gadget", "gadgets")).toBe("2 gadgets");
  });
});
