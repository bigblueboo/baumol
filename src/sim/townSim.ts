import { initialState, observe, step, type Calibration, type EconState, type Snapshot } from "../model/economy";
import type { Params } from "../model/params";

/** Model years per fixed step. Small enough that the dynamics look continuous. */
const STEP_YEARS = 1 / 120;
const STEP_SLACK = 1e-6;

/**
 * What a town lives through: the rules in force at each moment, and how long the run lasts.
 * Rules are read once per fixed step, so a course plays out identically on screen and off.
 */
export interface Course {
  rules: (t: number) => Params;
  years: number;
}

/** Fixed rules, open-ended (or for `years`). */
export function steadyCourse(params: Params, years = Infinity): Course {
  return { rules: () => params, years };
}

/**
 * A running town: owns the model state and advances it in fixed steps. Time is counted in
 * whole steps, so "is the run over?" is an integer comparison, never a float tolerance.
 */
export class TownSim {
  private s: EconState;
  private course: Course;
  private c: Calibration;
  private steps = 0;
  private carry = 0;
  snap: Snapshot;

  constructor(course: Course, cal: Calibration, state?: EconState) {
    this.course = course;
    this.c = cal;
    this.s = state ?? initialState(cal);
    this.snap = observe(course.rules(0), cal, this.s);
  }

  /** The rules in force right now. */
  get params(): Params {
    return this.course.rules(this.year);
  }

  /** Years elapsed, exactly. */
  get year(): number {
    return this.steps * STEP_YEARS;
  }

  get done(): boolean {
    return this.steps >= Math.round(this.course.years / STEP_YEARS);
  }

  /** Inventions so far, read off the machine's target. */
  get inventions(): number {
    return Math.round(Math.log2(this.s.goodsTarget));
  }

  /** Change the rules mid-run (and the calibration, when the scenario changes). */
  configure(course: Course, cal: Calibration = this.c): void {
    this.course = course;
    this.c = cal;
    this.snap = observe(this.params, cal, this.s);
  }

  /** Back to year zero. */
  restart(): void {
    this.s = initialState(this.c);
    this.steps = 0;
    this.carry = 0;
    this.snap = observe(this.params, this.c, this.s);
  }

  setGoodsTarget(target: number): void {
    this.s = { ...this.s, goodsTarget: target };
  }

  /** Double the machine's target productivity. */
  invent(): void {
    this.setGoodsTarget(this.s.goodsTarget * 2);
  }

  advance(years: number): void {
    // Carry is kept in steps, and the floor gets a hair of slack, so six years is exactly 720
    // steps however the six years were sliced into frames.
    this.carry += years / STEP_YEARS;
    const whole = Math.floor(this.carry + STEP_SLACK);
    this.carry = Math.max(0, this.carry - whole);
    for (let i = 0; i < whole && !this.done; i++) {
      this.s = step(this.params, this.c, this.s, STEP_YEARS);
      this.steps++;
    }
    if (this.done) this.carry = 0;
    this.snap = observe(this.params, this.c, this.s);
  }
}
