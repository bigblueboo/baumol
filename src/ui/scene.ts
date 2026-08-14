/**
 * The town, drawn in ink on paper. Left: the studio, where tools multiply
 * what an hour produces. Right: a living room, where an hour is an hour.
 * Between them: the street every wage in town walks across.
 *
 * All animation is imperative (attributes set per frame on persistent nodes),
 * so nothing the user might interact with is ever rebuilt wholesale.
 */

import type { AppStore } from "../app/store";
import { currentEra } from "../model/eras";
import { waitTime } from "../model/format";

const NS = "http://www.w3.org/2000/svg";
const INK = "var(--scene-ink, #3a332a)";

// Layout constants (viewBox 1200x560)
const GROUND = 470;
const STUDIO = { x: 60, w: 390, doorX: 415 };
const HOME = { x: 770, w: 360, doorX: 1052 };
const BENCH = { x: 565, w: 120 };
const DESK_SLOTS = 12; // drawn desks; labels carry exact counts
const SITTER_SLOTS = 3; // sitter+kids groups drawn in the room

function el<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

function text(
  content: string,
  attrs: Record<string, string | number>,
  parent: Element,
): SVGTextElement {
  const t = el("text", attrs, parent);
  t.textContent = content;
  return t;
}

/** A small standing person: head + capsule body. Origin at feet. */
function person(color: string, scale = 1): SVGGElement {
  const g = el("g");
  g.setAttribute("class", "person");
  el("circle", { cx: 0, cy: -21 * scale, r: 4.6 * scale, fill: INK }, g);
  el(
    "rect",
    {
      x: -4.4 * scale,
      y: -16.5 * scale,
      width: 8.8 * scale,
      height: 16.5 * scale,
      rx: 4.2 * scale,
      fill: color,
    },
    g,
  );
  return g;
}

/** A seated person (for desks and the bench). Origin at seat front. */
function seatedPerson(color: string, scale = 1): SVGGElement {
  const g = el("g");
  el("circle", { cx: 0, cy: -19 * scale, r: 4.4 * scale, fill: INK }, g);
  el(
    "rect",
    { x: -4.2 * scale, y: -15 * scale, width: 8.4 * scale, height: 11 * scale, rx: 4 * scale, fill: color },
    g,
  );
  el(
    "rect",
    { x: -4.2 * scale, y: -5 * scale, width: 11 * scale, height: 4.4 * scale, rx: 2.2 * scale, fill: color },
    g,
  );
  return g;
}

/** A small child: origin at feet. */
function kid(scale = 1): SVGGElement {
  const g = el("g");
  el("circle", { cx: 0, cy: -12.5 * scale, r: 3.6 * scale, fill: INK }, g);
  el(
    "rect",
    { x: -3.2 * scale, y: -9.5 * scale, width: 6.4 * scale, height: 9.5 * scale, rx: 3 * scale, fill: "var(--scene-kid, #8a8274)" },
    g,
  );
  return g;
}

function mulberry32(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

interface Walker {
  node: SVGGElement;
  from: number;
  to: number;
  t: number; // 0..1
  dur: number; // seconds
  toStudio: boolean;
}

interface Box {
  node: SVGRectElement;
  t: number;
  dur: number;
  x0: number;
  y0: number;
}

export interface Scene {
  /** dtReal: wall seconds this frame; simWeeks: sim time the engine
   *  actually consumed (not a re-derivation from speed, which drifts). */
  update(dtReal: number, simWeeks: number): void;
}

export function buildScene(host: HTMLElement, store: AppStore, seed: number): Scene {
  const rand = mulberry32(seed);
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

  const svg = el("svg", {
    viewBox: "0 80 1200 445",
    role: "img",
    "aria-label":
      "A town scene: a software studio on the left, a family home on the right, a code school between them. Workers walk between the buildings as wages change.",
  });
  host.appendChild(svg);

  // ---------- ground & street ----------
  el("line", { x1: 20, y1: GROUND, x2: 1180, y2: GROUND, stroke: INK, "stroke-width": 2 }, svg);
  // street dashes between the buildings
  for (let x = STUDIO.doorX + 40; x < HOME.x - 10; x += 46) {
    el("rect", { x, y: GROUND + 12, width: 22, height: 2.5, rx: 1.25, fill: "var(--hairline)" }, svg);
  }

  // ---------- studio ----------
  const studio = el("g", {}, svg);
  el(
    "rect",
    { x: STUDIO.x, y: 160, width: STUDIO.w, height: GROUND - 160, fill: "var(--studio-wash)", stroke: INK, "stroke-width": 2.5, rx: 4 },
    studio,
  );
  // roofline sign
  text("THE STUDIO", { x: STUDIO.x + 24, y: 148, "font-size": 19, "font-weight": 700, "letter-spacing": 3, fill: INK }, studio);
  // era flag
  const flagPole = el("g", {}, studio);
  el("line", { x1: STUDIO.x + 302, y1: 160, x2: STUDIO.x + 302, y2: 106, stroke: INK, "stroke-width": 2.5 }, flagPole);
  const flag = el("path", { d: `M${STUDIO.x + 302} 106 h78 l-12 11 12 11 h-78 z`, fill: "var(--studio)" }, flagPole);
  const eraLabel = text("", { x: STUDIO.x + 302, y: 96, "font-size": 14, "font-weight": 650, fill: "var(--studio-deep)" }, studio);

  // windows strip
  for (let i = 0; i < 6; i++) {
    el("rect", { x: STUDIO.x + 22 + i * 62, y: 180, width: 42, height: 26, rx: 3, fill: "var(--paper)", stroke: INK, "stroke-width": 1.5 }, studio);
  }

  // desks (three rows of four)
  const deskGroup = el("g", {}, studio);
  const deskFigures: SVGGElement[] = [];
  const deskPositions: { x: number; y: number }[] = [];
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 4; c++) {
      const x = STUDIO.x + 52 + c * 88;
      const y = 268 + r * 62;
      deskPositions.push({ x, y });
      el("rect", { x: x - 16, y: y - 14, width: 34, height: 3.5, rx: 1.75, fill: INK }, deskGroup);
      el("line", { x1: x - 12, y1: y - 10, x2: x - 12, y2: y, stroke: INK, "stroke-width": 2 }, deskGroup);
      el("line", { x1: x + 14, y1: y - 10, x2: x + 14, y2: y, stroke: INK, "stroke-width": 2 }, deskGroup);
      el("rect", { x: x + 2, y: y - 26, width: 13, height: 9, rx: 1.5, fill: "var(--paper)", stroke: INK, "stroke-width": 1.5 }, deskGroup);
      const fig = seatedPerson("var(--studio)");
      fig.setAttribute("transform", `translate(${x - 6} ${y})`);
      fig.style.transition = "opacity 400ms";
      deskGroup.appendChild(fig);
      deskFigures.push(fig);
    }
  }
  const engCount = text("", { x: STUDIO.x + 24, y: GROUND - 18, "font-size": 15, "font-weight": 600, fill: "var(--studio-deep)" }, studio);

  // output meter over the dock
  el("rect", { x: STUDIO.doorX - 6, y: 190, width: 118, height: 52, rx: 5, fill: "var(--paper)", stroke: INK, "stroke-width": 2 }, studio);
  const outMeter = text("", { x: STUDIO.doorX + 53, y: 213, "font-size": 15, "font-weight": 700, fill: "var(--studio-deep)", "text-anchor": "middle" }, studio);
  text("per engineer, per hour", { x: STUDIO.doorX + 53, y: 230, "font-size": 10.5, fill: "var(--ink-faint)", "text-anchor": "middle" }, studio);

  // wage sign on the studio wall
  const wageSign = el("g", {}, studio);
  const wageSignRect = el("rect", { x: STUDIO.x + 8, y: 218, width: 148, height: 46, rx: 5, fill: "var(--paper)", stroke: INK, "stroke-width": 2 }, wageSign);
  text("ENGINEERS WANTED", { x: STUDIO.x + 82, y: 236, "font-size": 10.5, "font-weight": 700, "letter-spacing": 1, fill: "var(--ink-faint)", "text-anchor": "middle" }, wageSign);
  const wageText = text("$12/hr", { x: STUDIO.x + 82, y: 256, "font-size": 18, "font-weight": 750, fill: "var(--studio-deep)", "text-anchor": "middle" }, wageSign);

  // shipping dock & pile
  const dock = el("g", {}, svg);
  el("rect", { x: STUDIO.doorX + 14, y: GROUND - 26, width: 76, height: 26, fill: "var(--paper-well)", stroke: INK, "stroke-width": 2 }, dock);
  const pileGroup = el("g", {}, dock);
  const shipped = text("", { x: STUDIO.doorX + 52, y: GROUND + 30, "font-size": 12.5, fill: "var(--ink-soft)", "text-anchor": "middle" }, dock);
  const boxLayer = el("g", {}, svg);

  // ---------- code school ----------
  const school = el("g", {}, svg);
  el("rect", { x: BENCH.x, y: 356, width: BENCH.w, height: 22, rx: 4, fill: "var(--school-wash)", stroke: "var(--school)", "stroke-width": 2 }, school);
  el("line", { x1: BENCH.x + 10, y1: 378, x2: BENCH.x + 10, y2: GROUND, stroke: "var(--school)", "stroke-width": 2.5 }, school);
  el("line", { x1: BENCH.x + BENCH.w - 10, y1: 378, x2: BENCH.x + BENCH.w - 10, y2: GROUND, stroke: "var(--school)", "stroke-width": 2.5 }, school);
  text("CODE SCHOOL", { x: BENCH.x + BENCH.w / 2, y: 348, "font-size": 12, "font-weight": 700, "letter-spacing": 1.5, fill: "var(--school)", "text-anchor": "middle" }, school);
  const benchSeats: SVGGElement[] = [];
  for (let i = 0; i < 4; i++) {
    const fig = seatedPerson("var(--school)", 0.92);
    fig.setAttribute("transform", `translate(${BENCH.x + 22 + i * 26} ${GROUND})`);
    fig.style.transition = "opacity 300ms";
    school.appendChild(fig);
    benchSeats.push(fig);
  }
  const benchLabel = text("", { x: BENCH.x + BENCH.w / 2, y: GROUND + 30, "font-size": 12.5, fill: "var(--school)", "text-anchor": "middle" }, school);

  // ---------- home ----------
  const home = el("g", {}, svg);
  // chimney behind the gable, with a lazy curl of smoke
  el("rect", { x: HOME.x + 252, y: 138, width: 26, height: 70, fill: "var(--paper-deep)", stroke: INK, "stroke-width": 2.5 }, home);
  el("path", { d: `M${HOME.x + 265} 130 q 8 -10 2 -18 q -5 -8 3 -14`, fill: "none", stroke: "var(--ink-faint)", "stroke-width": 2, "stroke-linecap": "round", opacity: 0.7 }, home);
  // gable
  el("path", { d: `M${HOME.x - 16} 230 L${HOME.x + HOME.w / 2} 128 L${HOME.x + HOME.w + 16} 230 Z`, fill: "var(--paper-deep)", stroke: INK, "stroke-width": 2.5 }, home);
  el("rect", { x: HOME.x, y: 230, width: HOME.w, height: GROUND - 230, fill: "var(--care-wash)", stroke: INK, "stroke-width": 2.5 }, home);
  text("HOME", { x: HOME.x + HOME.w / 2, y: 205, "font-size": 17, "font-weight": 700, "letter-spacing": 4, fill: INK, "text-anchor": "middle" }, home);
  // a plant by the door
  el("path", { d: `M${HOME.doorX + 38} ${GROUND} l4 -14 l4 14 z`, fill: "var(--care-wash)", stroke: INK, "stroke-width": 2 }, home);
  el("circle", { cx: HOME.doorX + 42, cy: GROUND - 20, r: 7, fill: "var(--school-wash)", stroke: INK, "stroke-width": 2 }, home);

  // living-room cutaway
  const room = el("g", {}, home);
  el("rect", { x: HOME.x + 24, y: 258, width: 214, height: GROUND - 258 - 12, rx: 6, fill: "var(--paper)", stroke: INK, "stroke-width": 2 }, room);
  // rug
  el("ellipse", { cx: HOME.x + 130, cy: GROUND - 24, rx: 86, ry: 9, fill: "var(--care-wash)" }, room);

  // the clock — the whole point
  const clock = el("g", {}, home);
  const CLOCK_X = HOME.x + 130;
  const CLOCK_Y = 300;
  el("circle", { cx: CLOCK_X, cy: CLOCK_Y, r: 30, fill: "var(--paper)", stroke: INK, "stroke-width": 2.5 }, clock);
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    el("line", {
      x1: CLOCK_X + Math.sin(a) * 25, y1: CLOCK_Y - Math.cos(a) * 25,
      x2: CLOCK_X + Math.sin(a) * 28, y2: CLOCK_Y - Math.cos(a) * 28,
      stroke: INK, "stroke-width": 1.5,
    }, clock);
  }
  const hourHand = el("line", { x1: CLOCK_X, y1: CLOCK_Y, x2: CLOCK_X, y2: CLOCK_Y - 14, stroke: INK, "stroke-width": 3, "stroke-linecap": "round" }, clock);
  const minHand = el("line", { x1: CLOCK_X, y1: CLOCK_Y, x2: CLOCK_X, y2: CLOCK_Y - 22, stroke: INK, "stroke-width": 2, "stroke-linecap": "round" }, clock);
  text("one hour = one hour", { x: CLOCK_X, y: CLOCK_Y + 52, "font-size": 11.5, "font-style": "italic", fill: "var(--ink-faint)", "text-anchor": "middle", "font-family": "var(--serif)" }, clock);

  // sitters & kids in the room
  const sitterGroups: { g: SVGGElement; kids: SVGGElement[]; tablet: SVGGElement }[] = [];
  for (let i = 0; i < SITTER_SLOTS; i++) {
    const g = el("g", {}, room);
    const x = HOME.x + 58 + i * 62;
    g.setAttribute("transform", `translate(${x} ${GROUND - 16})`);
    g.style.transition = "opacity 400ms";
    const sitter = person("var(--care)");
    g.appendChild(sitter);
    // the book being read aloud
    el("path", { d: "M4 -12 l7 -2 l0 5 l-7 2 z M4 -12 l-7 -2 l0 5 l7 2 z", fill: "var(--paper)", stroke: INK, "stroke-width": 1.3 }, g);
    const kids: SVGGElement[] = [];
    for (let k = 0; k < 3; k++) {
      const c = kid();
      c.setAttribute("transform", `translate(${14 + k * 12} 0)`);
      c.style.transition = "opacity 300ms";
      g.appendChild(c);
      kids.push(c);
    }
    const tablet = el("g", {}, g);
    el("rect", { x: 24, y: -22, width: 13, height: 18, rx: 2, fill: "var(--paper)", stroke: "var(--school)", "stroke-width": 2 }, tablet);
    el("line", { x1: 30, y1: -4, x2: 30, y2: 0, stroke: "var(--school)", "stroke-width": 2 }, tablet);
    tablet.style.transition = "opacity 300ms";
    sitterGroups.push({ g, kids, tablet });
  }
  const sitCount = text("", { x: HOME.x + 26, y: GROUND + 30, "font-size": 15, "font-weight": 600, fill: "var(--care-deep)" }, home);

  // door + rate sign
  el("rect", { x: HOME.doorX - 22, y: 356, width: 44, height: GROUND - 356, rx: 3, fill: "var(--paper-deep)", stroke: INK, "stroke-width": 2 }, home);
  el("circle", { cx: HOME.doorX + 12, cy: 415, r: 2.5, fill: INK }, home);
  const rateSign = el("g", {}, home);
  const rateSignRect = el("rect", { x: HOME.doorX - 52, y: 288, width: 116, height: 52, rx: 5, fill: "var(--paper)", stroke: INK, "stroke-width": 2 }, rateSign);
  text("BABYSITTING", { x: HOME.doorX + 6, y: 306, "font-size": 10.5, "font-weight": 700, "letter-spacing": 1, fill: "var(--ink-faint)", "text-anchor": "middle" }, rateSign);
  const rateText = text("$12/hr", { x: HOME.doorX + 6, y: 328, "font-size": 18, "font-weight": 750, fill: "var(--care-deep)", "text-anchor": "middle" }, rateSign);

  // waiting queue
  const queueGroup = el("g", {}, svg);
  const queueFigs: SVGGElement[] = [];
  for (let i = 0; i < 4; i++) {
    const g = el("g", {}, queueGroup);
    g.setAttribute("transform", `translate(${HOME.doorX + 52 + i * 26} ${GROUND})`);
    g.style.transition = "opacity 400ms";
    const c = kid(1.05);
    g.appendChild(c);
    const p = person("var(--scene-kid, #8a8274)", 0.8);
    p.setAttribute("transform", "translate(10 0)");
    g.appendChild(p);
    queueFigs.push(g);
  }
  const queueLabel = text("", { x: HOME.doorX + 88, y: GROUND + 30, "font-size": 12.5, "font-weight": 600, fill: "var(--alarm)", "text-anchor": "middle" }, svg);

  // thought bubble (used during beat 3)
  const bubble = el("g", {}, svg);
  bubble.style.transition = "opacity 300ms";
  bubble.style.opacity = "0";
  el("rect", { x: HOME.x + 20, y: 218, width: 132, height: 30, rx: 14, fill: "var(--paper)", stroke: INK, "stroke-width": 1.8 }, bubble);
  el("circle", { cx: HOME.x + 46, cy: 254, r: 4, fill: "var(--paper)", stroke: INK, "stroke-width": 1.5 }, bubble);
  el("circle", { cx: HOME.x + 40, cy: 262, r: 2.4, fill: "var(--paper)", stroke: INK, "stroke-width": 1.4 }, bubble);
  const bubbleText = text("", { x: HOME.x + 86, y: 238, "font-size": 13, "font-weight": 650, fill: "var(--studio-deep)", "text-anchor": "middle" }, bubble);

  // pile of shipped software
  const pileRects: SVGRectElement[] = [];
  for (let row = 0; row < 6; row++) {
    for (let col = 0; col < 5; col++) {
      const r = el("rect", {
        x: STUDIO.doorX + 18 + col * 14,
        y: GROUND - 40 - row * 14,
        width: 11, height: 11, rx: 2,
        fill: "var(--studio)", stroke: "var(--paper)", "stroke-width": 1.5,
      }, pileGroup);
      r.style.opacity = "0";
      r.style.transition = "opacity 250ms";
      pileRects.push(r);
    }
  }

  // ---------- dynamic state ----------
  const walkers: Walker[] = [];
  const boxes: Box[] = [];
  let shownEngineers = store.getState().sim.engineers;
  let shownSitters = store.getState().sim.sitters;
  let boxCarry = 0;
  let unitsShipped = 0;
  let lastWage = 12;
  let lastRate = 12;
  /** Steady wall-clock for the illustrative clock and the shipping stream —
   *  deliberately independent of sim speed, frozen only by pause. The
   *  comparison the scene draws is "output per clock revolution", so the
   *  clock must never accelerate. */
  let visualClock = 0;
  let shippedLabelTimer = 0;
  const activePulses = new Map<Element, Animation>();

  function pulse(node: SVGGElement) {
    if (reduced) return;
    node.style.transformOrigin = "center";
    node.style.transformBox = "fill-box";
    activePulses.get(node)?.cancel();
    const anim = node.animate(
      [{ transform: "scale(1)" }, { transform: "scale(1.12)" }, { transform: "scale(1)" }],
      { duration: 500, easing: "cubic-bezier(0.2, 0.8, 0.3, 1)" },
    );
    activePulses.set(node, anim);
  }

  function spawnWalker(toStudio: boolean) {
    const fig = person(toStudio ? "var(--care)" : "var(--studio)", 0.95);
    svg.appendChild(fig);
    const from = toStudio ? HOME.doorX : STUDIO.doorX + 30;
    const to = toStudio ? STUDIO.doorX + 30 : HOME.doorX;
    walkers.push({ node: fig, from, to, t: 0, dur: reduced ? 0.6 : 2.6 + rand() * 1.2, toStudio });
  }

  function update(dtReal: number, simWeeks: number): void {
    const st = store.getState();
    const { sim, d, params } = st;
    const simDt = simWeeks;

    // era flag
    const era = currentEra(sim.aEngTarget);
    if (eraLabel.textContent !== era.name) {
      eraLabel.textContent = era.name;
      pulse(flagPole);
    }
    flag.setAttribute("fill", "var(--studio)");

    // meters & signs
    const rate = Math.round(sim.aEng * 10) / 10;
    outMeter.textContent = `${rate >= 10 ? Math.round(rate) : rate} unit${rate >= 1.05 ? "s" : ""}`;
    const wage = Math.round(sim.wEng);
    if (wage !== lastWage) {
      wageText.textContent = `$${wage}/hr`;
      if (Math.abs(wage - lastWage) >= 1) pulse(wageSign);
      lastWage = wage;
    }
    const rrate = Math.round(sim.wSit);
    if (rrate !== lastRate) {
      rateText.textContent = `$${rrate}/hr`;
      if (Math.abs(rrate - lastRate) >= 1) pulse(rateSign);
      lastRate = rrate;
    }

    // engineers at desks
    const engineers = Math.round(sim.engineers);
    for (let i = 0; i < deskFigures.length; i++) {
      deskFigures[i]!.style.opacity = i < Math.min(engineers, DESK_SLOTS) ? "1" : "0.12";
    }
    engCount.textContent = `${engineers} engineer${engineers === 1 ? "" : "s"}`;

    // sitters in the room — each drawn group stands for a share of the sector
    const sitters = Math.round(sim.sitters);
    const visible = Math.max(sitters > 0 ? 1 : 0, Math.min(SITTER_SLOTS, Math.round(sitters / 4)));
    const kidsEach = params.kidsPerSitter;
    for (let i = 0; i < sitterGroups.length; i++) {
      const grp = sitterGroups[i]!;
      grp.g.style.opacity = i < visible ? "1" : "0.1";
      grp.kids.forEach((k, ki) => {
        k.style.opacity = ki < Math.min(kidsEach, 3) ? "1" : "0";
      });
      grp.tablet.style.opacity = params.roboSitter && d.roboShare > 0.05 ? "1" : "0";
    }
    sitCount.textContent = `${sitters} sitter${sitters === 1 ? "" : "s"}`;

    // code school bench
    const trainees = Math.round(d.trainees);
    benchSeats.forEach((fig, i) => {
      fig.style.opacity = i < Math.min(trainees, benchSeats.length) ? "1" : "0";
    });
    benchLabel.textContent = trainees > 0 ? `${trainees} retraining` : "";

    // clock — one steady sweep, whatever the sim speed. The point.
    if (!st.paused) visualClock += dtReal;
    const minutes = reduced ? Math.floor(visualClock) : visualClock;
    const mA = ((minutes * 6) % 360) * 1;
    const hA = ((minutes / 12) % 60) * 6;
    minHand.setAttribute("transform", `rotate(${mA} ${CLOCK_X} ${CLOCK_Y})`);
    hourHand.setAttribute("transform", `rotate(${hA} ${CLOCK_X} ${CLOCK_Y})`);

    // queue outside the door
    const unmet = 1 - d.coverage;
    const queued = unmet < 0.03 ? 0 : Math.min(4, Math.ceil(unmet * 5));
    queueFigs.forEach((g, i) => {
      g.style.opacity = i < queued ? "1" : "0";
    });
    queueLabel.textContent =
      queued > 0 && sim.waitDays >= 1 ? `waiting · ${waitTime(sim.waitDays)}` : queued > 0 ? "waiting" : "";

    // thought bubble during the "sitters notice" beat
    const showBubble = st.beat === 3;
    bubble.style.opacity = showBubble ? "1" : "0";
    if (showBubble) bubbleText.textContent = `$${wage}/hr to code…`;

    // during narration, halo the sign the beat is about
    wageSignRect.setAttribute("stroke", st.beat === 2 ? "var(--studio)" : INK);
    wageSignRect.setAttribute("stroke-width", st.beat === 2 ? "3.5" : "2");
    rateSignRect.setAttribute("stroke", st.beat === 4 ? "var(--care)" : INK);
    rateSignRect.setAttribute("stroke-width", st.beat === 4 ? "3.5" : "2");

    // walker flows — mirror net movement between the buildings
    const targetEng = sim.engineers + d.trainees;
    if (targetEng - shownEngineers >= 1) {
      if (!reduced) spawnWalker(true);
      shownEngineers += 1;
      shownSitters -= 1;
    } else if (shownSitters + 1 <= sim.sitters) {
      if (!reduced) spawnWalker(false);
      shownSitters += 1;
      shownEngineers -= 1;
    }
    for (let i = walkers.length - 1; i >= 0; i--) {
      const w = walkers[i]!;
      w.t += dtReal / w.dur;
      if (w.t >= 1) {
        w.node.remove();
        walkers.splice(i, 1);
        continue;
      }
      const x = w.from + (w.to - w.from) * w.t;
      const bob = reduced ? 0 : Math.sin(w.t * 40) * 1.6;
      w.node.setAttribute("transform", `translate(${x} ${GROUND + bob})`);
      w.node.style.opacity = w.t < 0.06 ? String(w.t / 0.06) : w.t > 0.94 ? String((1 - w.t) / 0.06) : "1";
    }

    // shipping boxes — rate follows productivity (capped for sanity)
    unitsShipped += sim.engineers * sim.aEng * simDt * params.hoursPerWeek;
    shippedLabelTimer += dtReal;
    if (shippedLabelTimer > 0.25) {
      shippedLabelTimer = 0;
      const txt = `${Math.round(unitsShipped).toLocaleString("en-US")} units shipped so far`;
      if (shipped.textContent !== txt) shipped.textContent = txt;
    }
    if (!reduced) {
      const boxDt = st.paused ? 0 : dtReal;
      boxCarry += Math.min(sim.aEng * 1.1, 14) * boxDt * 0.8;
      while (boxCarry >= 1 && boxes.length < 24) {
        boxCarry -= 1;
        const node = el("rect", { width: 10, height: 10, rx: 2, fill: "var(--studio)", stroke: "var(--paper)", "stroke-width": 1.5 }, boxLayer);
        boxes.push({ node, t: 0, dur: 0.8 + rand() * 0.3, x0: STUDIO.doorX + 4, y0: GROUND - 22 - rand() * 10 });
      }
      if (boxCarry > 4) boxCarry = 4;
      for (let i = boxes.length - 1; i >= 0; i--) {
        const b = boxes[i]!;
        b.t += dtReal / b.dur;
        if (b.t >= 1) {
          b.node.remove();
          boxes.splice(i, 1);
          continue;
        }
        // pop out of the dock door and hop onto the pile
        const x = b.x0 + (34 + 42 * ((b.y0 * 7) % 1)) * b.t;
        const y = b.y0 - Math.sin(b.t * Math.PI) * 30 - b.t * 14;
        b.node.setAttribute("x", String(x));
        b.node.setAttribute("y", String(y));
        b.node.style.opacity = b.t > 0.85 ? String((1 - b.t) / 0.15) : "1";
      }
    }

    // pile grows with the log of everything ever shipped
    const filled = Math.min(pileRects.length, Math.floor(Math.log2(1 + unitsShipped / 200) * 5));
    for (let i = 0; i < pileRects.length; i++) {
      pileRects[i]!.style.opacity = i < filled ? "1" : "0";
    }
  }

  // On narrow screens the scene pans; start centered on the street. Layout
  // may not have settled on the first frame, so retry until it takes.
  let centered = false;
  let centerTries = 0;
  const tryCenter = () => {
    if (centered || centerTries++ > 120) return;
    if (host.scrollWidth > host.clientWidth) {
      host.scrollLeft = (host.scrollWidth - host.clientWidth) / 2;
      centered = host.scrollLeft > 0;
    }
    if (!centered) requestAnimationFrame(tryCenter);
  };
  requestAnimationFrame(tryCenter);

  return { update };
}
