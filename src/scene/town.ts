import type { Snapshot } from "../model/economy";
import { type Scenario } from "../model/scenarios";
import { h, prefersReducedMotion, restartAnimation, s, setText, toggleClass } from "../ui/dom";
import { num } from "../ui/format";
import { HOUR_SECONDS, drawFactory, drawService, type Building } from "./buildings";
import { icon, iconGroup } from "./icons";
import { COMPACT, LAYOUT, WIDE, type Composition } from "./layout";
import { ParticlePool } from "./particles";
import { Crowd } from "./people";
import { isTempted, readoutModel, rulesLine, type ReadoutModel } from "./signals";

const MAX_QUEUE = 9;
/** One more resident joins the visible queue for each extra stretch of waiting. */
const QUEUE_FREE_DAYS = 2;
const QUEUE_DAYS_PER_PERSON = 5;
const MORPH_MS = 700;
/** Belt items are capped so a 32× machine still reads as a stream, not a blur. */
const MAX_ITEMS_PER_SECOND = 9;


/** Wages and the service price, shown either on the noticeboard or, on phones, as a strip. */
interface Readout {
  /** Put the readout in place: into the drawing's layer, or under the drawing in its wrapper. */
  mount(layer: SVGGElement, wrap: HTMLElement): void;
  /** Take it away again when the scenario changes. Art inside the old layer folds away with it. */
  unmount(): void;
  update(m: ReadoutModel): void;
}

interface Art {
  factory: Building;
  service: Building;
  readout: Readout;
}

interface SceneOptions {
  scenario: Scenario;
  title: string;
  compact: boolean;
  /** Draw the far sidewalk where a waiting list forms. */
  queue?: boolean;
}

/**
 * The town drawing. Static art is built once per scenario; each frame renders straight from
 * the model's snapshot, so the picture can't disagree with the numbers.
 */
export class TownScene {
  /** The drawing plus, on phones, the HTML strip that stands in for the noticeboard. */
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
    this.crowd = new Crowd(start.population, start.careWorkers, dx, this.reduced);
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

  /** Jump the crowd to a snapshot's staffing without anyone walking: for fresh runs. */
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

/** Swap a value's text, flipping its card only when the whole-number part changes. */
function flipper() {
  let whole = NaN;
  return (t: Element, value: number) => {
    const text = num(value);
    if (t.textContent === text) return;
    t.textContent = text;
    if (Math.floor(value) === whole) return;
    whole = Math.floor(value);
    restartAnimation(t, "is-flipping");
  };
}

/** The town noticeboard between the two buildings: two wages and one price. */
function drawBoard(sc: Scenario): Readout {
  const { left, right, top, bottom } = LAYOUT.board;
  const w = right - left;
  const goodsWage = s("text", { class: "board__num tone-things", x: right - 14, y: top + 64 });
  const serviceWage = s("text", { class: "board__num tone-time", x: right - 14, y: top + 116 });
  const priceNum = s("text", { class: "tag__num", x: 0, y: 6 });
  // Institutions in force, as one status line along the board's foot.
  const status = s("text", { class: "board__status", x: left + w / 2, y: bottom - 9 });
  // A bracket between the two wages while they differ: the gap that sends people walking.
  const gapText = s("text", { class: "gap__text", x: right + 10, y: top + 86 });
  const gap = s(
    "g",
    { class: "gap" },
    s("path", { class: "gap__bracket", d: `M${right + 2} ${top + 52}h5v46h-5` }),
    gapText,
  );
  const tag = s(
    "g",
    { class: "tag" },
    s("path", { class: "tag__string", d: "M-40 -30L0 -46L40 -30" }),
    s("path", { class: "tag__card", d: "M-66 -30h132v44h-132z" }),
    iconGroup(sc.service.icon, -60, -20, 24, "tag__icon tone-time"),
    s("text", { class: "tag__eq", x: -26, y: 6 }, "="),
    priceNum,
    iconGroup(sc.goods.icon, 36, -20, 24, "tag__icon tone-things"),
  );
  const el = s(
    "g",
    { class: "board" },
    s("path", { class: "board__post", d: `M${left + 18} ${bottom}V${LAYOUT.groundY}M${right - 18} ${bottom}V${LAYOUT.groundY}` }),
    s("rect", { class: "board__panel", x: left, y: top, width: w, height: bottom - top, rx: 3 }),
    s("text", { class: "board__title", x: left + w / 2, y: top + 19 }, "WAGE PER HOUR"),
    s("path", { class: "board__rule", d: `M${left + 12} ${top + 28}H${right - 12}M${left + 12} ${top + 80}H${right - 12}` }),
    iconGroup(sc.goods.icon, left + 12, top + 38, 30, "board__icon tone-things"),
    goodsWage,
    iconGroup(sc.service.icon, left + 12, top + 90, 30, "board__icon tone-time"),
    serviceWage,
    s("path", { class: "board__rule", d: `M${left + 12} ${bottom - 26}H${right - 12}` }),
    status,
    gap,
    s("g", { transform: `translate(${left + w / 2} ${bottom + 48})` }, tag),
  );
  const flipGoods = flipper();
  const flipService = flipper();
  return {
    mount: (layer) => layer.append(el),
    unmount: () => undefined,
    update(m) {
      flipGoods(goodsWage, m.goodsWage);
      flipService(serviceWage, m.serviceWage);
      const price = num(m.price);
      if (priceNum.textContent !== price) {
        priceNum.textContent = price;
        restartAnimation(tag, "is-swinging");
      }
      setText(status, rulesLine(m.rules));
      toggleClass(status, "is-alert", m.rules.length > 0);
      // A gap that rounds to nothing isn't worth a bracket.
      const shown = m.gap !== null && num(m.gap) !== "0";
      toggleClass(gap, "is-on", shown);
      if (m.gap !== null) setText(gapText, `gap ${num(m.gap)}`);
    },
  };
}

/** The noticeboard's numbers as an HTML strip under the drawing, for the compact composition. */
function drawStrip(sc: Scenario): Readout {
  const gw = h("strong", {});
  const sw = h("strong", {});
  const pr = h("strong", {});
  const rules = h("span", { class: "town-strip__rules" });
  const el = h(
    "div",
    { class: "town-strip" },
    h("span", { class: "town-strip__item tone-things" }, h("small", {}, `${sc.goods.worker.one} pay`), gw, icon(sc.goods.icon), h("small", {}, "/hr")),
    h("span", { class: "town-strip__item tone-time" }, h("small", {}, `${sc.service.worker.one} pay`), sw, icon(sc.goods.icon), h("small", {}, "/hr")),
    h("span", { class: "town-strip__item town-strip__item--price" }, icon(sc.service.icon), "=", pr, icon(sc.goods.icon)),
    rules,
  );
  return {
    mount: (_layer, wrap) => wrap.append(el),
    unmount: () => el.remove(),
    update(m) {
      setText(gw, num(m.goodsWage));
      setText(sw, num(m.serviceWage));
      setText(pr, num(m.price));
      setText(rules, m.rules.length ? m.rules.join(" · ") : "");
    },
  };
}

const READOUTS: Record<Composition["readout"], (sc: Scenario) => Readout> = { board: drawBoard, strip: drawStrip };

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
