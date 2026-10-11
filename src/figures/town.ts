import type { EconState, Snapshot } from "../model/economy";
import { TOWN_SIZE, calibrationOf, type Scenario } from "../model/scenarios";
import { TownScene } from "../scene/town";
import { TownSim, type Course } from "../sim/townSim";
import { animate } from "../ui/loop";
import { h } from "../ui/dom";

interface TownOptions {
  scenario: Scenario;
  course: Course;
  title: string;
  /** Townspeople; the warm-up figures use a smaller town. */
  population?: number;
  queue?: boolean;
  state?: EconState;
  /** Model years to advance this frame; a paused figure returns 0. The course decides when a run ends. */
  pace: (dt: number) => number;
  /** Figure-specific readouts, after the town has moved and been drawn. */
  onFrame?: (snap: Snapshot, dt: number) => void;
}

/** The warm-up figures use a smaller town, so a single barber walking out reads clearly. */
export const WARMUP_TOWN = 12;

/** Phones get the compact town composition. Decided once, at mount. */
const COMPACT_BELOW_PX = 640;

/**
 * A simulated town and its drawing, kept in step. Figures talk to this, never to the sim or
 * the scene directly, so a restart always resets the crowd and a re-skin always recalibrates.
 */
export class Town {
  /** The framed drawing, ready to place in the plate. */
  readonly frame: HTMLElement;
  private readonly sim: TownSim;
  private readonly scene: TownScene;
  private readonly population: number;

  constructor(host: HTMLElement, o: TownOptions) {
    this.population = o.population ?? TOWN_SIZE;
    this.sim = new TownSim(o.course, calibrationOf(o.scenario, this.population), o.state);
    this.scene = new TownScene(this.sim.snap, {
      scenario: o.scenario,
      title: o.title,
      queue: o.queue,
      compact: host.clientWidth < COMPACT_BELOW_PX,
    });
    this.frame = h("div", { class: "scene-frame" }, this.scene.el);
    animate(host, (dt) => {
      this.sim.advance(o.pace(dt));
      this.scene.render(this.sim.snap, dt);
      o.onFrame?.(this.sim.snap, dt);
    });
  }

  get snap(): Snapshot {
    return this.sim.snap;
  }
  get year(): number {
    return this.sim.year;
  }
  get done(): boolean {
    return this.sim.done;
  }
  get inventions(): number {
    return this.sim.inventions;
  }

  /** A fresh run: the model back to its start and everyone straight into their yards. */
  restart(): void {
    this.sim.restart();
    this.scene.place(this.sim.snap);
  }

  /** New rules mid-run. */
  configure(course: Course): void {
    this.sim.configure(course);
  }

  /** Another scenario: recalibrate the model and redraw the buildings. */
  reskin(sc: Scenario, course: Course): void {
    this.sim.configure(course, calibrationOf(sc, this.population));
    this.scene.setScenario(sc);
  }

  invent(): void {
    this.sim.invent();
  }

  setGoodsTarget(target: number): void {
    this.sim.setGoodsTarget(target);
  }
}

/** A constant pace, for figures that simply let time run. */
export function steady(yearsPerSecond: number): (dt: number) => number {
  return (dt) => dt * yearsPerSecond;
}
