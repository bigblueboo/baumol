import { describe, expect, it } from "vitest";
import { parseFlags } from "../src/app/flags";

describe("URL flags", () => {
  it("treats a bare ?fast as on", () => {
    expect(parseFlags("?fast").fast).toBe(true);
    expect(parseFlags("?fast&seed=7").fast).toBe(true);
    expect(parseFlags("?fast=1").fast).toBe(true);
  });

  it("is off by default and off when explicitly false", () => {
    expect(parseFlags("").fast).toBe(false);
    expect(parseFlags("?seed=7").fast).toBe(false);
    expect(parseFlags("?fast=false").fast).toBe(false);
  });

  it("parses seeds and rejects junk", () => {
    expect(parseFlags("?seed=7").seed).toBe(7);
    expect(parseFlags("?seed=banana").seed).toBe(1999);
    expect(parseFlags("?seed=-3").seed).toBe(1999);
    expect(parseFlags("").seed).toBe(1999);
  });
});
