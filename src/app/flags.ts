/**
 * URL flags. `?fast` is presence-based: bare `?fast` turns it on, and only
 * an explicit `?fast=false` turns it back off. (Coercing "" through Boolean
 * silently reads bare flags as false — exactly the wrong default.)
 */

export interface Flags {
  fast: boolean;
  seed: number;
}

export function parseFlags(search: string): Flags {
  const params = new URLSearchParams(search);
  const fast = params.has("fast") && params.get("fast") !== "false";
  const rawSeed = Number(params.get("seed") ?? 1999);
  const seed =
    Number.isInteger(rawSeed) && rawSeed > 0 ? rawSeed : 1999;
  return { fast, seed };
}
