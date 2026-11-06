import "./iso.css";
import type { Snapshot } from "../../model/economy";
import type { Facade, Scenario } from "../../model/scenarios";
import { h, prefersReducedMotion, s, setAttr, setText, toggleClass } from "../../ui/dom";
import { num } from "../../ui/format";
import { HOUR_SECONDS, hiringCard, publicRibbon, signPlank, updateSeats, type Notice, type Seat } from "../buildings";
import { iconGroup } from "../icons";
import { LAYOUT, type Point } from "../layout";
import { ParticlePool } from "../particles";
import { Crowd } from "../people";
import { READOUTS, type Readout } from "../readout";
import type { Scene, SceneOptions } from "../scene";
import { isTempted, readoutModel } from "../signals";
import { PLAN, groundPath, iso, isoYards, wallAlongU } from "./geometry";
import { toyFigure } from "./toys";
import factory0 from "./sprites/factory-0.webp";
import factory1 from "./sprites/factory-1.webp";
import factory2 from "./sprites/factory-2.webp";
import factory3 from "./sprites/factory-3.webp";
import careUrl from "./sprites/care.webp";
import barbershopUrl from "./sprites/barbershop.webp";
import treeUrl from "./sprites/prop-tree.webp";
import bushUrl from "./sprites/prop-bush.webp";
import lampUrl from "./sprites/prop-lamp.webp";
import clipboardUrl from "./sprites/helper-clipboard.webp";
import cartUrl from "./sprites/helper-cart.webp";

/** A building or prop image: its size in pixels and the pixel where it meets the ground. */
interface Sprite {
  url: string;
  w: number;
  h: number;
  /** The footprint corner nearest the reader. */
  anchor: Point;
}

/** A sprite set down on the ground: where it landed, and how to find its features on screen. */
interface Placed {
  el: SVGImageElement;
  at(px: Point): Point;
  top: number;
}

/** Each factory stage is an edit of the first, so they share one frame and anchor. */
const FACTORY_FRAME = { w: 520, h: 576, anchor: { x: 291, y: 568 } };
const FACTORY_STAGES = [factory0, factory1, factory2, factory3];
const FACTORY = { scale: 0.74, chimney: { x: 420, y: 16 }, bay: { x: 168, y: 468 } };

interface ServiceArt {
  sprite: Sprite;
  clock: Point & { r: number };
  door: Point;
}

const CARE: ServiceArt = {
  sprite: { url: careUrl, w: 520, h: 541, anchor: { x: 206, y: 533 } },
  clock: { x: 166, y: 243, r: 56 },
  door: { x: 166, y: 410 },
};
const BARBERSHOP: ServiceArt = {
  sprite: { url: barbershopUrl, w: 520, h: 554, anchor: { x: 322, y: 545 } },
  clock: { x: 161, y: 226, r: 56 },
  door: { x: 252, y: 420 },
};
/** Settings without their own building borrow the care house until theirs is drawn. */
const SERVICE_ART: Partial<Record<Facade, ServiceArt>> = { home: CARE, shop: BARBERSHOP };
const SERVICE_SCALE = 0.64;

const TREE: Sprite = { url: treeUrl, w: 251, h: 309, anchor: { x: 130, y: 297 } };
const BUSH: Sprite = { url: bushUrl, w: 235, h: 175, anchor: { x: 86, y: 163 } };
const PROPS: { sprite: Sprite; u: number; v: number; scale: number }[] = [
  { sprite: TREE, u: 40, v: 70, scale: 0.46 },
  { sprite: TREE, u: 610, v: 64, scale: 0.42 },
  { sprite: BUSH, u: 268, v: 236, scale: 0.24 },
  { sprite: { url: lampUrl, w: 125, h: 318, anchor: { x: 60, y: 315 } }, u: 366, v: 300, scale: 0.26 },
  { sprite: TREE, u: 600, v: 500, scale: 0.36 },
];

/** Helpers on the service porch: the clipboard and cart poses, at 40 units tall. */
const helperA = { url: clipboardUrl, w: 98 * (40 / 150) };
const helperB = { url: cartUrl, w: 102 * (40 / 150) };

const MAX_QUEUE = 9;
const QUEUE_FREE_DAYS = 2;
const QUEUE_DAYS_PER_PERSON = 5;
const MAX_ITEMS_PER_SECOND = 9;
/** Queuers are drawn flat, a little larger to sit beside the toy figures. */
const QUEUER_SCALE = 1.35;

function place(sprite: Sprite, ground: Point, scale: number): Placed {
  const x = ground.x - sprite.anchor.x * scale;
  const y = ground.y - sprite.anchor.y * scale;
  const el = s("image", { href: sprite.url, x, y, width: sprite.w * scale, height: sprite.h * scale });
  return { el, at: (px) => ({ x: x + px.x * scale, y: y + px.y * scale }), top: y };
}

/** The diorama slab: grass on top, soil on the two faces toward the reader, then lots and street. */
function drawGround(): SVGGElement {
  const { u0, u1, v0, v1, depth } = PLAN.slab;
  const at = (u: number, v: number, drop = 0): string => `${iso(u, v).x.toFixed(1)} ${(iso(u, v).y + drop).toFixed(1)}`;
  const left = `M${at(u0, v1)}L${at(u1, v1)}L${at(u1, v1, depth)}L${at(u0, v1, depth)}Z`;
  const right = `M${at(u1, v0)}L${at(u1, v1)}L${at(u1, v1, depth)}L${at(u1, v0, depth)}Z`;
  const lot = (c: { u: number; v: number; hu: number; hv: number }) =>
    groundPath([
      [c.u - c.hu - 16, c.v - c.hv - 16],
      [c.u + c.hu + 16, c.v - c.hv - 16],
      [c.u + c.hu + 16, PLAN.yard.frontV + 18],
      [c.u - c.hu - 16, PLAN.yard.frontV + 18],
    ]);
  const { u0: su0, u1: su1, v0: sv0, v1: sv1 } = PLAN.street;
  const mid = (su0 + su1) / 2;
  const { v: cv, half } = PLAN.crossing;
  const dashes = Array.from({ length: 12 }, (_, i) => sv0 + 10 + i * 30)
    .filter((v) => v + 16 < sv1 && (v + 16 < cv - half || v > cv + half))
    .map((v) => groundPath([[mid, v], [mid, v + 16]], false))
    .join("");
  const zebra = Array.from({ length: 6 }, (_, i) => {
    const u = su0 + 4 + i * 11;
    return groundPath([[u, cv - half], [u + 6, cv - half], [u + 6, cv + half], [u, cv + half]]);
  }).join("");
  return s(
    "g",
    { class: "iso-ground" },
    s("path", { class: "iso-soil", d: left }),
    s("path", { class: "iso-soil iso-soil--side", d: right }),
    s("path", { class: "iso-grass", d: groundPath([[u0, v0], [u1, v0], [u1, v1], [u0, v1]]) }),
    s("path", { class: "iso-lot", d: lot(PLAN.factory) }),
    s("path", { class: "iso-lot", d: lot(PLAN.service) }),
    // The plaza at the head of the street, where the wage board stands.
    s("path", { class: "iso-walk", d: groundPath([[su0 - 26, 96], [su1 + 26, 96], [su1 + 26, sv0], [su0 - 26, sv0]]) }),
    s("path", { class: "iso-walk", d: groundPath([[su0 - 10, sv0], [su1 + 10, sv0], [su1 + 10, sv1], [su0 - 10, sv1]]) }),
    s("path", { class: "iso-street", d: groundPath([[su0, sv0], [su1, sv0], [su1, sv1], [su0, sv1]]) }),
    s("path", { class: "iso-dash", d: dashes }),
    s("path", { class: "iso-zebra", d: zebra }),
  );
}

/** The barrier across the street, standing in the plane that runs across it. */
function drawGate(): SVGGElement {
  const span = PLAN.street.u1 - PLAN.street.u0 + 8;
  const arm = s(
    "g",
    { class: "gate__arm" },
    s("rect", { class: "gate__bar", x: 0, y: -4, width: span, height: 8, rx: 2 }),
    s("path", { class: "gate__stripes", d: Array.from({ length: Math.floor(span / 16) }, (_, i) => `M${12 + i * 16} -4l-6 8`).join("") }),
  );
  return s(
    "g",
    { class: "gate", transform: wallAlongU(PLAN.gate.u - 4, PLAN.crossing.v - PLAN.crossing.half - 4) },
    s("rect", { class: "gate__post", x: -5, y: -36, width: 10, height: 36, rx: 2 }),
    s("g", { transform: "translate(0 -28)" }, s("g", { class: "gate__pivot" }, arm)),
  );
}

/** A helper (or robot) on the porch with the clients waiting beside them. */
function toySeat(p: Point, i: number): Seat {
  const helper = (i % 2 ? helperB : helperA);
  const human = s("g", { class: "seat__human" }, s("image", { href: helper.url, x: p.x - helper.w / 2, y: p.y - 40, width: helper.w, height: 40 }));
  const robot = iconGroup("robot", p.x - 11, p.y - 26, 22, "seat__robot");
  const clients = Array.from({ length: 4 }, (_, j) => {
    const c = queuer({ x: p.x + 12 + j * 7, y: p.y + 2 + j * 2 }, j + i);
    c.setAttribute("class", "seat__client");
    return c;
  });
  return { human, robot, clients };
}

function queuer(p: Point, i: number): SVGGElement {
  return s(
    "g",
    { class: "queuer", transform: `translate(${p.x.toFixed(1)} ${p.y.toFixed(1)}) scale(${QUEUER_SCALE})`, style: `--i:${i}` },
    s("path", { class: "queuer__body", d: "M-5.5 0c0-9 2-13 5.5-13s5.5 4 5.5 13z" }),
    s("circle", { class: "queuer__head", cx: 0, cy: -17.5, r: 4.4 }),
    i % 3 === 1 ? s("path", { class: "queuer__cane", d: "M-8 0l2-12h2" }) : null,
  );
}

interface Art {
  layer: SVGGElement;
  readout: Readout;
  update(snap: Snapshot, clock: number): void;
}

/** The isometric town: a diorama on a slab, buildings facing a street that runs across it. */
export class IsoTownScene implements Scene {
  readonly el: HTMLElement;
  private scenario: Scenario;
  private art: Art;
  private readonly svg: SVGSVGElement;
  private readonly compact: boolean;
  private readonly stage: SVGGElement;
  /** Art standing in front of the yards: drawn after the crowd. */
  private readonly front: SVGGElement;
  private readonly crowd: Crowd;
  private readonly smoke: ParticlePool;
  private readonly items: ParticlePool;
  private readonly queue: SVGGElement[];
  private readonly queueSign: SVGGElement;
  private readonly queueText: SVGTextElement;
  private readonly gate: SVGGElement;
  private readonly reduced = prefersReducedMotion();
  private chimney: Point = { x: 0, y: 0 };
  private bay: Point = { x: 0, y: 0 };
  private clock = 0;

  constructor(start: Snapshot, opts: SceneOptions) {
    this.scenario = opts.scenario;
    this.compact = opts.compact;
    this.svg = s("svg", { class: "town town--iso", role: "img", "aria-label": opts.title, preserveAspectRatio: "xMidYMid meet" });
    this.stage = s("g", { class: "town__stage" });
    this.front = s("g", { class: "town__front" });
    const fx = s("g", { class: "town__fx" });
    this.gate = drawGate();
    const first = iso(PLAN.queue.u, PLAN.queue.v);
    this.queueText = s("text", { class: "queue__text", x: 53, y: 0 });
    this.queueSign = s(
      "g",
      { class: "queue__sign", transform: `translate(${(first.x - 130).toFixed(1)} ${(first.y + 4).toFixed(1)})` },
      s("rect", { class: "queue__card", x: -2, y: -16, width: 110, height: 21, rx: 2 }),
      this.queueText,
    );
    this.queue = opts.queue
      ? Array.from({ length: MAX_QUEUE }, (_, i) => queuer(iso(PLAN.queue.u + i * PLAN.queue.gap, PLAN.queue.v), i))
      : [];
    this.crowd = new Crowd(start.population, start.careWorkers, isoYards, this.reduced, toyFigure);
    this.smoke = new ParticlePool(fx, () => s("g", { class: "puff" }, s("circle", { cx: 0, cy: 0, r: 7 })), 3.2, (k, seed) => ({
      x: this.chimney.x + Math.sin(k * 3 + seed * 2.1) * 6 + k * 40,
      y: this.chimney.y - 4 - k * 70,
      scale: 0.7 + k * 1.8,
      opacity: 0.55 * (1 - k),
    }));
    // Finished goods hop from the bay into the bin.
    const to = iso(PLAN.bin.u, PLAN.bin.v, 18);
    this.items = new ParticlePool(fx, () => iconGroup(this.scenario.goods.icon, 0, 0, 24, "belt__item"), 1.1, (k) => {
      const hop = Math.sin(Math.min(1, k / 0.8) * Math.PI) * 26;
      const fade = Math.max(0, (k - 0.8) / 0.2);
      const t = Math.min(1, k / 0.8);
      return { x: this.bay.x + (to.x - this.bay.x) * t - 7, y: this.bay.y + (to.y - this.bay.y) * t - hop - 7, scale: 14 / 24, opacity: 1 - fade };
    });
    this.svg.append(drawGround(), this.stage, fx, this.crowd.el, this.front, this.gate, ...(opts.queue ? [this.queueSign] : []), ...this.queue);
    this.el = h("div", { class: `town-wrap town-wrap--iso${opts.compact ? " is-compact" : ""}` }, this.svg);
    this.art = this.build(this.scenario, null);
    this.frame();
  }

  /** Fit the drawing to the slab on wide screens; on phones, crop to the town itself. */
  private frame(): void {
    const { u0, u1, v0, v1, depth } = PLAN.slab;
    const top = Math.min(this.topOfArt(), iso(u0, v0).y) - 14;
    const box = this.compact
      ? { x0: iso(u0 + 20, v1 - 40).x, x1: iso(u1 - 20, v0 + 40).x, y1: iso(u1, v1).y + depth + 4 }
      : { x0: iso(u0, v1).x - 6, x1: iso(u1, v0).x + 6, y1: iso(u1, v1).y + depth + 6 };
    setAttr(this.svg, "viewBox", `${box.x0.toFixed(0)} ${top.toFixed(0)} ${(box.x1 - box.x0).toFixed(0)} ${(box.y1 - top).toFixed(0)}`);
  }

  private topOfArt(): number {
    return Math.min(...Array.from(this.art.layer.querySelectorAll("image"), (img) => Number(img.getAttribute("y"))));
  }

  place(snap: Snapshot): void {
    this.crowd.place(snap.careWorkers);
  }

  setScenario(sc: Scenario): void {
    if (sc.id === this.scenario.id) return;
    this.scenario = sc;
    this.art = this.build(sc, this.art);
  }

  private build(sc: Scenario, previous: Art | null): Art {
    previous?.readout.unmount();
    previous?.layer.remove();
    this.items.clear();
    this.smoke.clear();

    // Factory: one image per stage of machinery, stacked so a new stage can fade in.
    const f = PLAN.factory;
    const fGround = iso(f.u + f.hu, f.v + f.hv);
    const stages = FACTORY_STAGES.map((url, i) => {
      const p = place({ url, ...FACTORY_FRAME }, fGround, FACTORY.scale);
      p.el.classList.add("iso-stage");
      if (i === 0) p.el.classList.add("is-on");
      return p;
    });
    const factory = stages[0];
    if (!factory) throw new Error("factory art missing");
    this.chimney = factory.at(FACTORY.chimney);
    this.bay = factory.at(FACTORY.bay);
    const fSign = factory.at({ x: 40, y: 150 });

    // Service: its own building where one exists, its clock hands drawn live on the blank face.
    const art = SERVICE_ART[sc.service.facade] ?? CARE;
    const sv = PLAN.service;
    const service = place(art.sprite, iso(sv.u + sv.hu, sv.v + sv.hv), SERVICE_SCALE);
    const c = service.at(art.clock);
    const r = art.clock.r * SERVICE_SCALE;
    const minute = s("line", { class: "clock__minute", x1: c.x, y1: c.y, x2: c.x, y2: c.y - r * 0.78 });
    const hour = s("line", { class: "clock__hour", x1: c.x, y1: c.y, x2: c.x, y2: c.y - r * 0.5 });
    const door = service.at(art.door);
    const hiring: Notice = hiringCard(door.x, door.y - 12);
    const ribbon: Notice = publicRibbon(service.at({ x: art.sprite.w / 2, y: 0 }).x, service.top - 24);
    const sSign = service.at({ x: 10, y: 330 });

    const seats: Seat[] = Array.from({ length: 4 }, (_, i) => {
      const p = iso(PLAN.porch.u0 + i * PLAN.porch.gap, PLAN.porch.v);
      return toySeat(p, i);
    });

    // The pile of finished goods at the end of the belt.
    const bin = iso(PLAN.bin.u, PLAN.bin.v);
    const pile: SVGGElement[] = [];
    [5, 4, 3, 2, 1].forEach((n, row) => {
      for (let i = 0; i < n; i++) pile.push(iconGroup(sc.goods.icon, bin.x - 22 + i * 9 + row * 4.5, bin.y - 14 - row * 8, 13, "pile__item"));
    });

    // Props behind the yards draw with the buildings; those nearer the reader, after the crowd.
    const behind = PROPS.filter((p) => p.v < PLAN.yard.frontV).map((p) => place(p.sprite, iso(p.u, p.v), p.scale).el);
    const inFront = PROPS.filter((p) => p.v >= PLAN.yard.frontV).map((p) => place(p.sprite, iso(p.u, p.v), p.scale).el);
    const board = iso(PLAN.board.u, PLAN.board.v);
    const boardLayer = s("g", { transform: `translate(${board.x.toFixed(1)} ${board.y.toFixed(1)}) scale(0.72) translate(-500 ${-LAYOUT.groundY})` });

    const layer = s(
      "g",
      { class: `town__layer iso-layer service--${sc.service.facade}` },
      ...behind,
      ...stages.map((p) => p.el),
      s("path", { class: "bin", d: `M${bin.x - 26} ${bin.y - 20}l5 20h40l5-20` }),
      ...pile,
      service.el,
      s("circle", { class: "clock__face clock__face--overlay", cx: c.x, cy: c.y, r: r * 0.08 }),
      hour,
      minute,
      s("circle", { class: "clock__pin", cx: c.x, cy: c.y, r: 2.6 }),
      ...seats.flatMap((st) => [st.human, st.robot, ...st.clients]),
      hiring.el,
      ribbon.el,
      signPlank(fSign.x, fSign.y, 170, sc.goods.building, sc.goods.icon, "plank--things"),
      signPlank(sSign.x, sSign.y, 150, sc.service.building, sc.service.icon, "plank--time"),
    );
    const readout = READOUTS[this.compact ? "strip" : "board"](sc);
    readout.mount(boardLayer, this.el);
    this.stage.append(layer);
    this.front.replaceChildren(boardLayer, ...inFront);

    return {
      layer,
      readout,
      update: (snap, clock) => {
        const doublings = Math.log2(Math.max(1, snap.goodsTech));
        const tier = Math.min(stages.length - 1, Math.floor(doublings + 0.05));
        stages.forEach((p, i) => toggleClass(p.el, "is-on", i <= tier));
        const heap = Math.min(pile.length, Math.round(snap.goodsTech));
        pile.forEach((p, i) => toggleClass(p, "is-on", i < heap));
        setAttr(minute, "transform", `rotate(${(((clock / HOUR_SECONDS) % 1) * 360).toFixed(1)} ${c.x} ${c.y})`);
        setAttr(hour, "transform", `rotate(${(((clock / (HOUR_SECONDS * 12)) % 1) * 360).toFixed(1)} ${c.x} ${c.y})`);
        updateSeats(seats, snap);
        hiring.update(snap);
        ribbon.update(snap);
      },
    };
  }

  render(snap: Snapshot, dt: number): void {
    this.clock += dt;
    this.art.update(snap, this.clock);
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
      { serviceCount: snap.careWorkers, temptation: isTempted(snap) ? { text: num(snap.factoryWage * sc.perHour), icon: sc.goods.icon } : null },
      dt,
    );
  }
}
