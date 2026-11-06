import type { Snapshot } from "../model/economy";
import { type Scenario } from "../model/scenarios";
import { h, prefersReducedMotion, s, setText, toggleClass } from "../ui/dom";
import { num } from "../ui/format";
import { HOUR_SECONDS, drawFactory, drawService, type Building } from "./buildings";
import { iconGroup } from "./icons";
import { COMPACT, LAYOUT, WIDE, flatYards, type Composition } from "./layout";
import { ParticlePool } from "./particles";
import { Crowd } from "./people";
import { READOUTS, type Readout } from "./readout";
import type { Scene, SceneOptions } from "./scene";
import { isTempted, readoutModel } from "./signals";

const MAX_QUEUE = 9;
/** One more resident joins the visible queue for each extra stretch of waiting. */
const QUEUE_FREE_DAYS = 2;
const QUEUE_DAYS_PER_PERSON = 5;
const MORPH_MS = 700;
/** Belt items are capped so a 32× machine still reads as a stream, not a blur. */
const MAX_ITEMS_PER_SECOND = 9;


interface Art {
  factory: Building;
  service: Building;
  readout: Readout;
}


/** The flat, front-on town: buildings face the reader across one straight road. */
export class TownScene implements Scene {
  readonly el: HTMLElement;
  private scenario: Scenario;
  private art: Art;
  private readonly svg: SVGSVGElement;
  private readonly comp: Composition;
  private readonly stage: SVGGElement;
  private readonly crowd: Crowd;
  private readonly smoke: ParticlePool;
  private readonly items: ParticlePool;
  private readonly queue: SVGGElement[];
  private readonly queueSign: SVGGElement;
  private readonly queueText: SVGTextElement;
  private readonly gate: SVGGElement;
  private readonly reduced = prefersReducedMotion();
  private clock = 0;

  constructor(start: Snapshot, opts: SceneOptions) {
    this.scenario = opts.scenario;
    this.comp = opts.compact ? COMPACT : WIDE;
    const dx = this.comp.serviceDx;
    // Figures without a waiting list don't need the far sidewalk where the queue stands.
    const height = opts.queue ? LAYOUT.height : LAYOUT.roadBottom + 8;
    this.svg = s("svg", {
      class: "town",
      viewBox: `0 0 ${this.comp.width} ${height}`,
      role: "img",
      "aria-label": opts.title,
      preserveAspectRatio: "xMidYMid meet",
    });
    this.stage = s("g", { class: "town__stage" });
    const fx = s("g", { class: "town__fx" });
    this.gate = drawGate(this.comp.gateX);
    this.queueText = s("text", { class: "queue__text", x: 53, y: 0 });
    this.queueSign = s(
      "g",
      { class: "queue__sign", transform: `translate(${LAYOUT.service.cx + dx + 22} ${LAYOUT.queueY - 30})` },
      s("rect", { class: "queue__card", x: -2, y: -16, width: 110, height: 21, rx: 2 }),
      this.queueText,
    );
    // Only figures that model waiting draw the far sidewalk and its queue.
    this.queue = opts.queue ? Array.from({ length: MAX_QUEUE }, (_, i) => queuer(LAYOUT.service.cx + dx + 30 + i * 19, LAYOUT.queueY, i)) : [];
    this.crowd = new Crowd(start.population, start.careWorkers, flatYards(dx), this.reduced);
    this.smoke = new ParticlePool(fx, () => s("g", { class: "puff" }, s("circle", { cx: 0, cy: 0, r: 6 })), 3.2, (k, seed) => ({
      x: LAYOUT.chimney.x + Math.sin(k * 3 + seed * 2.1) * 6 + k * 34,
      y: LAYOUT.chimney.top - 4 - k * 62,
      scale: 0.7 + k * 1.8,
      opacity: 0.55 * (1 - k),
    }));
    const beltStart = LAYOUT.factory.right - 8;
    const beltEnd = LAYOUT.bin.x + 18;
    this.items = new ParticlePool(fx, () => this.beltItem(), 1.3, (k) => {
      const along = Math.min(1, k / 0.75);
      const drop = Math.max(0, (k - 0.75) / 0.25);
      return { x: beltStart + (beltEnd - beltStart) * along, y: LAYOUT.belt.itemY + drop * drop * 16, scale: 13 / 24, opacity: 1 - drop };
    });
    this.svg.append(backdrop(this.comp.width), this.stage, fx, this.gate, this.crowd.el, ...(opts.queue ? [this.queueSign] : []), ...this.queue);
    this.el = h("div", { class: `town-wrap${opts.compact ? " is-compact" : ""}` }, this.svg);
    this.art = this.build(this.scenario, null);
  }

  place(snap: Snapshot): void {
    this.crowd.place(snap.careWorkers);
  }

  setScenario(sc: Scenario): void {
    if (sc.id === this.scenario.id) return;
    this.scenario = sc;
    this.art = this.build(sc, this.art);
  }

  private beltItem(): SVGGElement {
    return iconGroup(this.scenario.goods.icon, 0, 0, 24, "belt__item");
  }

  private build(sc: Scenario, previous: Art | null): Art {
    const old = Array.from(this.stage.children);
    const factory = drawFactory(sc);
    const service = drawService(sc);
    previous?.readout.unmount();
    const readout = READOUTS[this.comp.readout](sc);
    const shifted = s("g", { transform: `translate(${this.comp.serviceDx} 0)` }, service.el);
    const layer = s("g", { class: "town__layer" }, factory.el, shifted);
    readout.mount(layer, this.el);
    this.stage.append(layer);
    this.items.clear();
    this.smoke.clear();
    if (previous && !this.reduced) {
      // Old art folds down while the new art rises, like a pop-up book: start the new layer
      // collapsed, commit that style, then release it so the transition runs.
      layer.classList.add("is-entering");
      void layer.getBoundingClientRect();
      layer.classList.remove("is-entering");
      for (const o of old) {
        o.classList.add("is-leaving");
        window.setTimeout(() => o.remove(), MORPH_MS);
      }
    } else {
      for (const o of old) o.remove();
    }
    return { factory, service, readout };
  }

  render(snap: Snapshot, dt: number): void {
    this.clock += dt;
    this.art.factory.update(snap, this.clock, dt);
    this.art.service.update(snap, this.clock, dt);
    this.art.readout.update(readoutModel(snap, this.scenario.perHour));
    if (!this.reduced) {
      const doublings = Math.log2(Math.max(1, snap.goodsTech));
      this.smoke.update(dt, 0.6 + doublings * 0.55);
      this.items.update(dt, Math.min(MAX_ITEMS_PER_SECOND, (this.scenario.perHour * snap.goodsTech) / HOUR_SECONDS));
    }

    const waiting = Math.max(0, Math.min(MAX_QUEUE, Math.round((snap.waitDays - QUEUE_FREE_DAYS) / QUEUE_DAYS_PER_PERSON)));
    this.queue.forEach((q, i) => toggleClass(q, "is-on", i < waiting));
    toggleClass(this.queueSign, "is-on", waiting > 0);
    const waitDays = Math.round(snap.waitDays);
    setText(this.queueText, `WAIT ${waitDays} ${waitDays === 1 ? "DAY" : "DAYS"}`);
    toggleClass(this.gate, "is-closed", !snap.params.sharedLaborMarket);

    const sc = this.scenario;
    this.crowd.update(
      {
        serviceCount: snap.careWorkers,
        temptation: isTempted(snap) ? { text: num(snap.factoryWage * sc.perHour), icon: sc.goods.icon } : null,
      },
      dt,
    );
  }
}

function backdrop(width: number): SVGGElement {
  const { height, groundY, roadTop, roadBottom } = LAYOUT;
  const dashes = Array.from({ length: 26 }, (_, i) => `M${i * 40 + 6} ${(roadTop + roadBottom) / 2}h20`).join("");
  const stripes = s(
    "pattern",
    { id: "pole-stripes", width: 10, height: 12, patternUnits: "userSpaceOnUse", patternTransform: "skewY(-30)" },
    s("rect", { width: 10, height: 6, fill: "var(--things)" }),
    s("rect", { y: 6, width: 10, height: 6, fill: "var(--time)", opacity: 0.85 }),
    s("animateTransform", { attributeName: "patternTransform", type: "translate", from: "0 0", to: "0 12", dur: "1.6s", repeatCount: "indefinite", additive: "sum" }),
  );
  return s(
    "g",
    { class: "backdrop" },
    s("defs", {}, stripes),
    s("rect", { class: "sky", x: 0, y: 0, width, height: groundY }),
    s("circle", { class: "sun", cx: width - 48, cy: 54, r: 28 }),
    s("g", { class: "cloud cloud--a" }, s("path", { d: "M0 0c0-10 14-14 20-6 4-10 22-10 24 2 10-2 14 8 6 10H2c-2 0-2-4-2-6z" })),
    s("g", { class: "cloud cloud--b" }, s("path", { d: "M0 0c0-8 11-11 16-5 3-8 17-8 19 2 8-2 11 6 5 8H2c-2 0-2-3-2-5z" })),
    s("path", { class: "hill hill--far", d: `M0 ${groundY - 70}C120 ${groundY - 120} 240 ${groundY - 60} 380 ${groundY - 96}S700 ${groundY - 130} 1000 ${groundY - 84}V${groundY}H0z` }),
    s("path", { class: "hill hill--near", d: `M0 ${groundY - 30}C160 ${groundY - 70} 300 ${groundY - 20} 520 ${groundY - 52}S860 ${groundY - 40} 1000 ${groundY - 60}V${groundY}H0z` }),
    s("rect", { class: "ground", x: 0, y: groundY, width, height: height - groundY }),
    s("rect", { class: "road", x: 0, y: roadTop, width, height: roadBottom - roadTop }),
    s("path", { class: "road__dash", d: dashes }),
    s("path", { class: "ground__edge", d: `M0 ${groundY}H${width}` }),
  );
}

function drawGate(x: number): SVGGElement {
  const { roadTop, roadBottom } = LAYOUT;
  const arm = s(
    "g",
    { class: "gate__arm" },
    s("rect", { class: "gate__bar", x: 0, y: -4, width: 82, height: 8, rx: 2 }),
    s("path", { class: "gate__stripes", d: "M12 -4l-6 8M28 -4l-6 8M44 -4l-6 8M60 -4l-6 8M76 -4l-6 8" }),
  );
  return s(
    "g",
    { class: "gate", transform: `translate(${x - 41} ${roadTop - 4})` },
    s("rect", { class: "gate__post", x: -6, y: -26, width: 12, height: roadBottom - roadTop + 30, rx: 2 }),
    s("g", { class: "gate__pivot" }, arm),
  );
}

function queuer(x: number, y: number, i: number): SVGGElement {
  return s(
    "g",
    { class: "queuer", transform: `translate(${x} ${y})`, style: `--i:${i}` },
    s("path", { class: "queuer__body", d: "M-5.5 0c0-9 2-13 5.5-13s5.5 4 5.5 13z" }),
    s("circle", { class: "queuer__head", cx: 0, cy: -17.5, r: 4.4 }),
    i % 3 === 1 ? s("path", { class: "queuer__cane", d: "M-8 0l2-12h2" }) : null,
  );
}
