import { s, setAttr, toggleClass } from "../ui/dom";
import { iconGroup, type IconName } from "./icons";
import type { Job, Point, Yards } from "./layout";

/** What a tempted service worker is thinking about: the factory's wage. */
interface Temptation {
  text: string;
  icon: IconName;
}

const WALK_SPEED = 120; // viewBox units per second
const SKIN_TONES = ["skin-a", "skin-b", "skin-c"] as const;

/** How a townsperson is drawn. The crowd moves people about; the figure only strikes poses. */
export interface Figure {
  readonly el: SVGGElement;
  /** How far above the feet the thought bubble floats, relative to the flat figure's. */
  readonly bubbleLift: number;
  /** `phase` counts strides; `facing` is 1 walking toward +x, -1 toward -x. */
  pose(moving: boolean, phase: number, facing: number, job: Job): void;
}

export type FigureMaker = (id: number) => Figure;

/** The flat town's little riso figure: legs that swing, a cap for factory hands. */
export function risoFigure(id: number): Figure {
  const legL = s("line", { class: "person__leg", x1: -2.4, y1: -11, x2: -2.4, y2: 0 });
  const legR = s("line", { class: "person__leg", x1: 2.4, y1: -11, x2: 2.4, y2: 0 });
  const body = s("path", { class: "person__body", d: "M-6.2 -9.5C-6.4 -19 -4.4 -24 0 -24s6.4 5 6.2 14.5z" });
  const head = s("circle", { class: `person__head ${SKIN_TONES[id % 3]}`, cx: 0, cy: -29.5, r: 5.2 });
  const hair = s("path", { class: "person__hair", d: id % 2 ? "M-5.2 -30.5a5.2 5.2 0 0 1 10.4 0c-2.5-1.6-6-1.8-10.4 0z" : "M-5 -31a5.2 5.2 0 0 1 10 -1c-3 .2-6 0-10 1z" });
  const cap = s("path", { class: "person__cap", d: "M-5.6 -31.2a5.6 4.6 0 0 1 11.2 0zM4.8 -31.2h3.4" });
  const el = s("g", { class: "person__figure" }, legL, legR, body, head, hair, cap);
  return {
    el,
    bubbleLift: 0,
    pose(moving, phase, facing) {
      const swing = moving ? Math.sin(phase * Math.PI * 2) * 3.4 : 0;
      const bob = moving ? Math.abs(Math.cos(phase * Math.PI * 2)) * -1.4 : 0;
      setAttr(legL, "x2", (-2.4 + swing).toFixed(2));
      setAttr(legR, "x2", (2.4 - swing).toFixed(2));
      setAttr(el, "transform", `translate(0 ${bob.toFixed(2)}) scale(${facing} 1)`);
    },
  };
}

/** One townsperson, walking between yards by way of the road. */
class Person {
  readonly el: SVGGElement;
  private readonly figure: Figure;
  private readonly bubble: SVGGElement;
  private readonly bubbleText: SVGTextElement;
  private bubbleIcon: SVGGElement | null = null;
  private bubbleIconName: IconName | null = null;

  job: Job;
  slot = -1;
  private pos: Point;
  private route: Point[] = [];
  private phase: number;
  private facing = 1;

  constructor(
    readonly id: number,
    job: Job,
    at: Point,
    makeFigure: FigureMaker,
  ) {
    this.job = job;
    this.pos = { ...at };
    this.phase = (id * 0.37) % 1;
    this.figure = makeFigure(id);
    this.bubbleText = s("text", { class: "bubble__text", x: 6, y: -50 });
    this.bubble = s(
      "g",
      { class: "bubble" },
      s("circle", { class: "bubble__dot", cx: 3, cy: -38, r: 1.6 }),
      s("circle", { class: "bubble__dot", cx: 6, cy: -42.5, r: 2.4 }),
      s("rect", { class: "bubble__cloud", x: -14, y: -64, width: 46, height: 20, rx: 10 }),
      this.bubbleText,
    );
    if (this.figure.bubbleLift) this.bubble.setAttribute("transform", `translate(0 ${-this.figure.bubbleLift})`);
    this.el = s("g", { class: `person person--${job}` }, this.figure.el, this.bubble);
  }

  /** Stand at a point at once, abandoning any walk in progress. */
  placeAt(target: Point): void {
    this.route = [];
    this.pos = { ...target };
    this.update(0, true);
  }

  walkTo(route: Point[]): void {
    this.route = route;
  }

  get at(): Point {
    return this.pos;
  }

  get walking(): boolean {
    return this.route.length > 0;
  }

  /** The figure's current x, so the crowd can pick who is nearest the road. */
  get x(): number {
    return this.pos.x;
  }

  /** Show what the factory pays, or hide the bubble with `null`. */
  setBubble(t: Temptation | null): void {
    toggleClass(this.bubble, "is-shown", t !== null);
    if (!t) return;
    if (this.bubbleText.textContent !== t.text) this.bubbleText.textContent = t.text;
    if (this.bubbleIconName !== t.icon) {
      this.bubbleIcon?.remove();
      this.bubbleIcon = iconGroup(t.icon, -11, -61, 14, "bubble__icon");
      this.bubble.append(this.bubbleIcon);
      this.bubbleIconName = t.icon;
    }
  }

  update(dt: number, reduced: boolean): void {
    let moving = false;
    let budget = WALK_SPEED * dt;
    for (let next = this.route[0]; next && budget > 0; next = this.route[0]) {
      const dx = next.x - this.pos.x;
      const dy = next.y - this.pos.y;
      const dist = Math.hypot(dx, dy);
      if (reduced || dist <= budget) {
        this.pos = { ...next };
        this.route.shift();
        budget -= dist;
      } else {
        this.pos.x += (dx / dist) * budget;
        this.pos.y += (dy / dist) * budget;
        if (Math.abs(dx) > 0.5) this.facing = Math.sign(dx);
        budget = 0;
      }
      moving = true;
    }
    if (moving) this.phase += dt * 3.2;
    this.figure.pose(moving, this.phase, this.facing, this.job);
    setAttr(this.el, "transform", `translate(${this.pos.x.toFixed(1)} ${this.pos.y.toFixed(1)})`);
    toggleClass(this.el, "is-walking", moving);
  }

  setJob(job: Job): void {
    if (this.job === job) return;
    this.job = job;
    this.el.classList.replace(job === "goods" ? "person--service" : "person--goods", `person--${job}`);
  }
}

interface CrowdFrame {
  serviceCount: number;
  /** Service workers who'd rather be at the factory show a bubble with this text. */
  temptation: Temptation | null;
}

/** All townspeople. Keeps job assignments stable: only the difference walks. */
export class Crowd {
  readonly el: SVGGElement;
  private readonly people: Person[];

  constructor(
    population: number,
    initialService: number,
    private readonly yards: Yards,
    private readonly reduced: boolean,
    makeFigure: FigureMaker = risoFigure,
  ) {
    this.el = s("g", { class: "crowd" });
    const k = Math.round(initialService);
    this.people = Array.from({ length: population }, (_, i) => {
      const job: Job = i < k ? "service" : "goods";
      const slot = job === "service" ? i : i - k;
      const p = new Person(i, job, yards.slot(job, slot), makeFigure);
      p.slot = slot;
      return p;
    });
    this.restack();
    for (const p of this.people) p.update(0, true);
  }

  /** Back rows first so the front row overlaps them; rerun whenever anyone changes slot. */
  private restack(): void {
    const depth = (p: Person) => this.yards.slot(p.job, p.slot).y;
    for (const p of [...this.people].sort((a, b) => depth(a) - depth(b))) this.el.append(p.el);
  }

  /** Put everyone straight into the right yards, as when a fresh run starts. */
  place(serviceCount: number): void {
    const k = Math.max(0, Math.min(this.people.length, Math.round(serviceCount)));
    this.people.forEach((p, i) => {
      const job: Job = i < k ? "service" : "goods";
      p.setJob(job);
      p.slot = job === "service" ? i : i - k;
      p.placeAt(this.yards.slot(job, p.slot));
    });
    this.restack();
  }

  private reassign(target: number): void {
    const service = this.people.filter((p) => p.job === "service");
    let diff = target - service.length;
    if (diff === 0) return;
    while (diff < 0) {
      // The newest arrivals (highest slot) leave first.
      const leaver = service.sort((a, b) => b.slot - a.slot).shift();
      if (!leaver) break;
      this.move(leaver, "goods");
      diff++;
    }
    while (diff > 0) {
      const goods = this.people.filter((p) => p.job === "goods");
      const joiner = goods.sort((a, b) => b.x - a.x)[0];
      if (!joiner) break;
      this.move(joiner, "service");
      diff--;
    }
    this.restack();
  }

  private move(p: Person, job: Job): void {
    const taken = new Set(this.people.filter((q) => q.job === job).map((q) => q.slot));
    let slot = 0;
    while (taken.has(slot)) slot++;
    p.setJob(job);
    p.slot = slot;
    p.walkTo(this.yards.route(p.at, this.yards.slot(job, slot)));
  }

  update(frame: CrowdFrame, dt: number): void {
    const target = Math.max(0, Math.min(this.people.length, Math.round(frame.serviceCount)));
    this.reassign(target);
    // At most two bubbles, on every other slot, so they never overlap.
    let bubbles = 0;
    for (const p of [...this.people].sort((a, b) => a.slot - b.slot)) {
      const shows = p.job === "service" && !p.walking && p.slot % 2 === 0 && bubbles < 2;
      const t = shows ? frame.temptation : null;
      if (t) bubbles++;
      p.setBubble(t);
      p.update(dt, this.reduced);
    }
  }
}
