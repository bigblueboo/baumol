import { describe, expect, it } from "vitest";
import { decode, encode, paramsFor } from "../src/figures/lab/store";

describe("lab links", () => {
  it("round-trips settings through the hash", () => {
    const params = { ...paramsFor("lessons"), caseload: 2, wageCap: true, funding: "market" as const };
    const hash = encode({ scenario: "lessons", params });
    expect(hash).toContain("caseload=2");
    expect(decode(hash)).toEqual({ scenario: "lessons", params });
  });

  it("writes nothing but the scenario when settings are defaults", () => {
    expect(encode({ scenario: "care", params: paramsFor("care") })).toBe("#lab?s=care");
  });

  it("ignores unknown scenarios", () => {
    expect(decode("#lab?s=moon")).toBeNull();
  });

  it("drops a bad value but keeps the rest of the recipe", () => {
    expect(decode("#lab?s=care&caseload=99&wageCap=true&automation=")).toEqual({
      scenario: "care",
      params: { ...paramsFor("care"), wageCap: true },
    });
  });
});
