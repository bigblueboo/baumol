import { s, setAttr, toggleClass } from "../ui/dom";
import { iconGroup, type IconName } from "./icons";
import { LAYOUT } from "./layout";

type Job = "goods" | "service";

/** What a tempted service worker is thinking about: the factory's wage. */
interface Temptation {
  text: string;
  icon: IconName;
}

interface Point {
  x: number;
  y: number;
}

const WALK_SPEED = 120; // viewBox units per second
const SKIN_TONES = ["skin-a", "skin-b", "skin-c"] as const;

/** One townsperson: a little riso figure that walks between yards along the road. */
class Person {
  readonly el: SVGGElement;
  private readonly legL: SVGLineElement;
  private readonly legR: SVGLineElement;
  private readonly figure: SVGGElement;
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
  ) {
    this.job = job;
    this.pos = { ...at };
    this.phase = (id * 0.37) % 1;
    this.legL = s("line", { class: "person__leg", x1: -2.4, y1: -11, x2: -2.4, y2: 0 });
    this.legR = s("line", { class: "person__leg", x1: 2.4, y1: -11, x2: 2.4, y2: 0 });
    const body = s("path", { class: "person__body", d: "M-6.2 -9.5C-6.4 -19 -4.4 -24 0 -24s6.4 5 6.2 14.5z" });
    const head = s("circle", { class: `person__head ${SKIN_TONES[id % 3]}`, cx: 0, cy: -29.5, r: 5.2 });
    const hair = s("path", { class: "person__hair", d: id % 2 ? "M-5.2 -30.5a5.2 5.2 0 0 1 10.4 0c-2.5-1.6-6-1.8-10.4 0z" : "M-5 -31a5.2 5.2 0 0 1 10 -1c-3 .2-6 0-10 1z" });
    const cap = s("path", { class: "person__cap", d: "M-5.6 -31.2a5.6 4.6 0 0 1 11.2 0zM4.8 -31.2h3.4" });
    this.figure = s("g", { class: "person__figure" }, this.legL, this.legR, body, head, hair, cap);
    this.bubbleText = s("text", { class: "bubble__text", x: 6, y: -50 });
    this.bubble = s(
      "g",
      { class: "bubble" },
      s("circle", { class: "bubble__dot", cx: 3, cy: -38, r: 1.6 }),
      s("circle", { class: "bubble__dot", cx: 6, cy: -42.5, r: 2.4 }),
      s("rect", { class: "bubble__cloud", x: -14, y: -64, width: 46, height: 20, rx: 10 }),
      this.bubbleText,
    );
    this.el = s("g", { class: `person person--${job}` }, this.figure, this.bubble);
  }

  /** Stand at a point at once, abandoning any walk in progress. */
  placeAt(target: Point): void {
    this.route = [];
    this.pos = { ...target };
    this.update(0, true);
  }

  walkTo(target: Point, viaRoad: boolean): void {
    const road = LAYOUT.roadY;
    this.route = viaRoad ? [{ x: this.pos.x, y: road }, { x: target.x, y: road }, target] : [target];
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
    const swing = moving ? Math.sin(this.phase * Math.PI * 2) * 3.4 : 0;
    const bob = moving ? Math.abs(Math.cos(this.phase * Math.PI * 2)) * -1.4 : 0;
    setAttr(this.legL, "x2", (-2.4 + swing).toFixed(2));
    setAttr(this.legR, "x2", (2.4 - swing).toFixed(2));
    setAttr(this.figure, "transform", `translate(0 ${bob.toFixed(2)}) scale(${this.facing} 1)`);
    setAttr(this.el, "transform", `translate(${this.pos.x.toFixed(1)} ${this.pos.y.toFixed(1)})`);
    toggleClass(this.el, "is-walking", moving);
  }

  setJob(job: Job): void {
    if (this.job === job) return;
    this.job = job;
    this.el.classList.replace(job === "goods" ? "person--service" : "person--goods", `person--${job}`);
  }
}

/**
 * Yard slots: the front row fills first, and column 0 sits by the road so arrivals and
 * departures don't cross the crowd.
 */
function slotPoint(job: Job, slot: number, serviceDx: number): Point {
  const { cols, colGap, rowGap, rows } = LAYOUT.yard;
  const col = slot % cols;
  const row = Math.floor(slot / cols) % rows;
  const stagger = row % 2 ? colGap / 2 : 0;
  const x = job === "goods" ? LAYOUT.yard.goodsRoadX - col * colGap - stagger : LAYOUT.yard.serviceRoadX + serviceDx + col * colGap + stagger;
  return { x, y: LAYOUT.yard.frontY - row * rowGap };
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
    private readonly serviceDx: number,
    private readonly reduced: boolean,
  ) {
    this.el = s("g", { class: "crowd" });
    const k = Math.round(initialService);
    this.people = Array.from({ length: population }, (_, i) => {
      const job: Job = i < k ? "service" : "goods";
      const slot = job === "service" ? i : i - k;
      const p = new Person(i, job, slotPoint(job, slot, serviceDx));
      p.slot = slot;
      return p;
    });
    this.restack();
    for (const p of this.people) p.update(0, true);
  }

  /** Back rows first so the front row overlaps them; rerun whenever anyone changes slot. */
  private restack(): void {
    const depth = (p: Person) => slotPoint(p.job, p.slot, this.serviceDx).y;
    for (const p of [...this.people].sort((a, b) => depth(a) - depth(b))) this.el.append(p.el);
  }

  /** Put everyone straight into the right yards, as when a fresh run starts. */
  place(serviceCount: number): void {
    const k = Math.max(0, Math.min(this.people.length, Math.round(serviceCount)));
    this.people.forEach((p, i) => {
      const job: Job = i < k ? "service" : "goods";
      p.setJob(job);
      p.slot = job === "service" ? i : i - k;
      p.placeAt(slotPoint(job, p.slot, this.serviceDx));
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
    p.walkTo(slotPoint(job, slot, this.serviceDx), true);
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
