/**
 * Fixed-step simulation driver. Real time × speed is accumulated and spent in
 * constant substeps, so a given press sequence always produces the same
 * trajectory regardless of frame rate.
 */

import { ALL_OPEN, derive, step, upgrade, type Gates } from "../model/sim";
import { checkParams, type Params } from "../model/params";
import { makeSample, type AppStore } from "./store";

/** The narrated chain opens the economy one mechanism per beat. Demand stays
 *  frozen through beat 3 so the queue there is caused by departing sitters
 *  alone, not by richer engineers wanting more care. */
function gatesForBeat(beat: number): Gates {
  if (beat === 1) return { wage: false, labor: false, sitPrice: false, demand: false };
  if (beat === 2) return { wage: true, labor: false, sitPrice: false, demand: false };
  if (beat === 3) return { wage: true, labor: true, sitPrice: false, demand: false };
  return ALL_OPEN;
}

const SUBSTEP = 1 / 32; // weeks
const SAMPLE_EVERY = 0.25; // weeks
const MAX_SUBSTEPS_PER_FRAME = 96;
const MAX_HISTORY = 6000;

export class Engine {
  private acc = 0;
  private lastSampleWeek = 0;

  constructor(private store: AppStore) {}

  /** Advance by real seconds at the store's current speed. Frame-budgeted:
   *  a stalled frame sheds sim time rather than freezing the page. Only
   *  whole substeps run (the remainder carries over), so the browser path
   *  takes the same fixed steps regardless of frame timing. Returns the
   *  simulated weeks actually consumed, so narration can pace itself to
   *  what the economy really did rather than to wall time. */
  advance(dtReal: number): number {
    const st = this.store.getState();
    if (st.paused || st.speed <= 0) return 0;
    this.acc += dtReal * st.speed;
    const whole = Math.min(
      Math.floor(this.acc / SUBSTEP),
      MAX_SUBSTEPS_PER_FRAME,
    );
    const consumed = whole * SUBSTEP;
    // carry the remainder; discard backlog beyond one frame's budget
    this.acc = Math.min(this.acc - consumed, SUBSTEP);
    return this.runWeeks(consumed);
  }

  /** Advance exactly `weeks` of simulated time, losing nothing. For tests. */
  advanceSimWeeks(weeks: number): void {
    this.runWeeks(weeks);
  }

  private runWeeks(weeks: number): number {
    if (weeks <= 0) return 0;
    const st = this.store.getState();
    let { sim } = st;
    const { params } = st;
    const gates = gatesForBeat(st.beat);
    const newSamples = [];
    let remaining = weeks;
    while (remaining > 1e-9) {
      const h = Math.min(SUBSTEP, remaining);
      sim = step(sim, params, h, gates);
      remaining -= h;
      if (sim.week - this.lastSampleWeek >= SAMPLE_EVERY) {
        newSamples.push(makeSample(sim, params, derive(sim, params)));
        this.lastSampleWeek = sim.week;
      }
    }
    const d = derive(sim, params);
    const history =
      newSamples.length > 0
        ? [...st.history, ...newSamples].slice(-MAX_HISTORY)
        : st.history;
    this.store.setState({ sim, d, history });
    return weeks;
  }

  /** The big button. Records the era landing as a chart event marker. */
  press(): void {
    const st = this.store.getState();
    const sim = upgrade(st.sim);
    this.store.setState({
      sim,
      d: derive(sim, st.params),
      pressCount: st.pressCount + 1,
      lastPressWeek: sim.week,
    });
  }

  /** Validate and apply new rules; re-derive so readouts react immediately.
   *  supplyHours depends on params (kids per sitter), so recompute it before
   *  deriving — otherwise a policy change reads stale capacity until the
   *  next tick, indefinitely if the town is paused. */
  applyParams(params: Params): void {
    const checked = checkParams(params);
    const st = this.store.getState();
    const sim = {
      ...st.sim,
      supplyHours: st.sim.sitters * checked.hoursPerWeek * checked.kidsPerSitter,
    };
    this.store.setState({ params: checked, sim, d: derive(sim, checked) });
  }

  /** Drop a labeled marker onto the charts at the current sim week. */
  markEvent(label: string, kind: "era" | "policy"): void {
    const st = this.store.getState();
    this.store.setState({
      events: [...st.events, { week: st.sim.week, label, kind }],
    });
  }
}
