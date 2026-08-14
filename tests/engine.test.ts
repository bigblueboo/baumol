import { describe, expect, it } from "vitest";
import { createAppStore } from "../src/app/store";
import { Engine } from "../src/app/engine";

/**
 * The browser driver must be genuinely fixed-step: the same elapsed real
 * time must produce the same simulation trajectory no matter how the
 * frames were partitioned.
 */
describe("the engine", () => {
  function build() {
    const store = createAppStore();
    const engine = new Engine(store);
    store.setState({ speed: 8 });
    engine.press();
    return { store, engine };
  }

  it("is partition-invariant: same real time, same trajectory", () => {
    const a = build();
    const b = build();

    // a: steady 60fps frames for 3 seconds
    for (let i = 0; i < 180; i++) a.engine.advance(1 / 60);

    // b: ragged frames summing to the same 3 seconds
    const parts = [0.013, 0.021, 0.007, 0.033, 0.016, 0.041, 0.009];
    let t = 0;
    let i = 0;
    while (t < 3 - 1e-12) {
      const dt = Math.min(parts[i++ % parts.length]!, 3 - t);
      b.engine.advance(dt);
      t += dt;
    }

    // Each engine may hold up to one substep in its accumulator; that is
    // the whole permitted divergence.
    const SUBSTEP = 1 / 32;
    expect(
      Math.abs(a.store.getState().sim.week - b.store.getState().sim.week),
    ).toBeLessThanOrEqual(SUBSTEP + 1e-9);

    // Flushed to a common sim time, the trajectories are identical: both
    // walked the same fixed grid of substeps.
    for (const x of [a, b]) x.engine.advanceSimWeeks(30 - x.store.getState().sim.week);
    const sa = a.store.getState();
    const sb = b.store.getState();
    expect(sa.sim.week).toBeCloseTo(sb.sim.week, 9);
    expect(sa.sim.wSit).toBeCloseTo(sb.sim.wSit, 9);
    expect(sa.sim.wEng).toBeCloseTo(sb.sim.wEng, 9);
    expect(sa.sim.sitters).toBeCloseTo(sb.sim.sitters, 9);
  });

  it("advanceSimWeeks loses nothing, even for big jumps", () => {
    const a = build();
    a.engine.advanceSimWeeks(50);
    expect(a.store.getState().sim.week).toBeCloseTo(50, 6);
  });
});
