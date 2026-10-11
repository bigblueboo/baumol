import type { Snapshot } from "../model/economy";
import { s, setAttr, toggleClass } from "../ui/dom";
import type { Facade, Scenario } from "../model/scenarios";
import { iconGroup, type IconName } from "./icons";
import { isHiring } from "./signals";
import { LAYOUT } from "./layout";

/** A drawn building that animates itself from the model's snapshot and the scene clock. */
export interface Building {
  el: SVGGElement;
  update(snap: Snapshot, clock: number, dt: number): void;
}

/** Real seconds per scene "hour". The service clock turns once per hour, whatever happens. */
export const HOUR_SECONDS = 4;

/** A part that spins about its own centre. */
interface Spinner {
  /** Positioned wrapper; place this in the drawing. */
  holder: SVGGElement;
  /** Rotated element inside the holder. */
  el: SVGGElement;
  /** Degrees per unit of machine speed. */
  rate: number;
}

interface Seat {
  human: SVGGElement;
  robot: SVGGElement;
  clients: SVGGElement[];
}

/** Helper/client seats in the service windows. */
const SEATS = 4;
const MAX_CLIENTS_PER_SEAT = 4;
/** Machine speed: base, and extra per doubling of productivity. */
const MACHINE_SPEED = 0.55;
const SPIN_DEG_PER_SECOND = 120;

function signPlank(x: number, y: number, w: number, label: string, iconName: IconName, cls: string): SVGGElement {
  return s(
    "g",
    { class: `plank ${cls}` },
    s("rect", { class: "plank__board", x, y, width: w, height: 26, rx: 2 }),
    iconGroup(iconName, x + 7, y + 4, 18, "plank__icon"),
    s("text", { class: "plank__text", x: x + 31, y: y + 18 }, label.toUpperCase()),
  );
}

function spinner(cx: number, cy: number, r: number, rate: number, cls = ""): Spinner {
  const el = s("g", { class: `spinner ${cls}` }, iconGroup("gear", -r, -r, 2 * r, "gear"));
  const holder = s("g", { transform: `translate(${cx} ${cy})` }, el);
  return { holder, el, rate };
}

/** A robot arm whose upper segment swings about the shoulder. */
function robotArm(x: number, y: number): { el: SVGGElement; upper: SVGGElement } {
  const upper = s(
    "g",
    { class: "arm__upper" },
    s("path", { class: "arm__seg", d: "M0 0L18 -22" }),
    s("path", { class: "arm__seg", d: "M18 -22L34 -12" }),
    s("path", { class: "arm__claw", d: "M34 -12l5 -2M34 -12l4 4" }),
    s("circle", { class: "arm__joint", cx: 18, cy: -22, r: 3 }),
  );
  const el = s(
    "g",
    { class: "arm", transform: `translate(${x} ${y})` },
    s("rect", { class: "arm__base", x: -8, y: -4, width: 16, height: 6, rx: 1.5 }),
    s("circle", { class: "arm__joint", cx: 0, cy: 0, r: 3.5 }),
    upper,
  );
  return { el, upper };
}

export function drawFactory(sc: Scenario): Building {
  const { left, right, top, roof } = LAYOUT.factory;
  const g = LAYOUT.groundY;
  const el = s("g", { class: "factory" });
  const teeth = 4;
  const tw = (right - left) / teeth;
  let roofPath = `M${left} ${top}`;
  for (let i = 0; i < teeth; i++) roofPath += `L${left + i * tw} ${roof}L${left + (i + 1) * tw} ${top}`;
  roofPath += "Z";

  const chimney = s(
    "g",
    { class: "chimney" },
    s("rect", { class: "bldg-body", x: 296, y: 62, width: 26, height: 96 }),
    s("rect", { class: "bldg-trim", x: 292, y: 58, width: 34, height: 9 }),
    s("path", { class: "bldg-line", d: "M296 92h26M296 120h26" }),
  );

  el.append(
    chimney,
    s("path", { class: "bldg-roof bldg-roof--things", d: roofPath }),
    ...Array.from({ length: teeth }, (_, i) => s("path", { class: "bldg-glass", d: `M${left + i * tw + 3} ${roof + 6}v${top - roof - 10}` })),
    s("rect", { class: "bldg-body", x: left, y: top, width: right - left, height: g - top }),
    s("path", { class: "bldg-line", d: `M${left} ${top + 10}H${right}` }),
    // Rolling door
    s("rect", { class: "bldg-door", x: 58, y: 236, width: 56, height: g - 236 }),
    s("path", { class: "bldg-line bldg-line--faint", d: Array.from({ length: 6 }, (_, i) => `M58 ${244 + i * 9}h56`).join("") }),
    // Windows
    s("rect", { class: "bldg-window", x: 130, y: 192, width: 96, height: 62, rx: 2 }),
    s("rect", { class: "bldg-window", x: 242, y: 192, width: 100, height: 62, rx: 2 }),
    signPlank(left + 14, 64, 190, sc.goods.building, sc.goods.icon, "plank--things"),
    s("path", { class: "bldg-line", d: `M${left + 30} 90V${roof + 4}M${left + 188} 90V${roof + 38}` }),
  );

  const big = spinner(166, 223, 22, 1);
  const small = spinner(204, 238, 13, -1.7);
  const third = spinner(316, 218, 16, 1.4);
  el.append(big.holder);

  // Press in the second window.
  const piston = s(
    "g",
    { class: "piston" },
    s("rect", { class: "piston__rod", x: 266, y: 196, width: 8, height: 26 }),
    s("rect", { class: "piston__head", x: 256, y: 220, width: 28, height: 10, rx: 2 }),
  );
  const anvil = s("rect", { class: "bldg-trim", x: 252, y: 244, width: 36, height: 6 });

  const arm1 = robotArm(150, roof + 2);
  const arm2 = robotArm(235, roof + 2);
  const solar = s(
    "g",
    {},
    ...[0, 1, 2].map((i) =>
      s("path", { class: "solar", d: `M${left + i * tw + 12} ${roof + 8}L${left + (i + 1) * tw - 8} ${top - 6}l-6 6L${left + i * tw + 10} ${roof + 16}z` }),
    ),
  );
  const dish = s(
    "g",
    { class: "dish", transform: `translate(${LAYOUT.chimney.x} ${LAYOUT.chimney.top})` },
    s("path", { class: "bldg-line", d: "M0 0v-14" }),
    s("path", { class: "dish__bowl", d: "M-12 -18a12 8 0 0 0 24 0z" }),
  );
  const beacon = s("circle", { class: "beacon", cx: LAYOUT.chimney.x, cy: LAYOUT.chimney.top - 8, r: 5 });

  const tiers = [
    s("g", { class: "tier is-on" }),
    s("g", { class: "tier" }, small.holder),
    s("g", { class: "tier" }, arm1.el),
    s("g", { class: "tier" }, piston, anvil, solar),
    s("g", { class: "tier" }, arm2.el, third.holder, dish),
    s("g", { class: "tier" }, beacon),
  ];
  el.append(...tiers);

  // Conveyor out to the bin, and the bin's heap.
  const { x: bx, y: by } = LAYOUT.bin;
  el.append(
    s("rect", { class: "belt", x: right - 6, y: LAYOUT.belt.y, width: bx - right + 18, height: 7, rx: 3.5 }),
    ...[0, 1, 2].map((i) => s("circle", { class: "belt__roller", cx: right + 4 + i * 11, cy: LAYOUT.belt.y + 3.5, r: 2.2 })),
    s("path", { class: "bin", d: `M${bx - 8} ${by - 26}l6 26h44l6-26` }),
  );
  const pile: SVGGElement[] = [];
  const rows = [5, 4, 3, 2, 1];
  rows.forEach((n, r) => {
    for (let i = 0; i < n; i++) {
      const icon = iconGroup(sc.goods.icon, bx + 1 + i * 9 + r * 4.5, by - 18 - r * 8, 13, "pile__item");
      pile.push(icon);
      el.append(icon);
    }
  });

  const spinners = [big, small, third];
  const arms = [arm1, arm2];
  let angle = 0;
  return {
    el,
    update(snap, clock, dt) {
      // Faster, and more machinery, with every doubling.
      const doublings = Math.log2(Math.max(1, snap.goodsTech));
      const speed = MACHINE_SPEED * (1 + doublings);
      angle += dt * speed * SPIN_DEG_PER_SECOND;
      for (const sp of spinners) setAttr(sp.el, "transform", `rotate(${(angle * sp.rate).toFixed(1)})`);
      const tier = Math.floor(doublings + 0.05);
      tiers.forEach((t, i) => toggleClass(t, "is-on", i <= tier));
      arms.forEach((arm, i) => setAttr(arm.upper, "transform", `rotate(${(Math.sin(clock * speed * 2.2 + i * 1.7) * 28).toFixed(1)})`));
      setAttr(piston, "transform", `translate(0 ${(Math.max(0, Math.sin(clock * speed * 4)) * 12).toFixed(1)})`);
      const heap = Math.min(pile.length, Math.round(snap.goodsTech));
      pile.forEach((p, i) => toggleClass(p, "is-on", i < heap));
    },
  };
}

function seat(x: number, y: number): Seat {
  const human = s(
    "g",
    { class: "seat__human" },
    s("path", { class: "seat__body", d: `M${x - 6} ${y + 14}c0-9 2.5-13 6-13s6 4 6 13z` }),
    s("circle", { class: "seat__head", cx: x, cy: y - 3, r: 4.6 }),
  );
  const robot = iconGroup("robot", x - 9, y - 8, 18, "seat__robot");
  const clients = Array.from({ length: MAX_CLIENTS_PER_SEAT }, (_, i) =>
    s(
      "g",
      { class: "seat__client" },
      s("path", { class: "seat__client-body", d: `M${x + 9 + i * 7} ${y + 14}c0-6 1.6-9 3.6-9s3.6 3 3.6 9z` }),
      s("circle", { class: "seat__client-head", cx: x + 12.6 + i * 7, cy: y + 1, r: 3.2 }),
    ),
  );
  return { human, robot, clients };
}

/** Each kind of service gets one distinguishing feature on a shared house. */
function facadeFeature(kind: Facade): SVGGElement {
  const { left, right, cx, apex } = LAYOUT.service;
  const g = LAYOUT.groundY;
  switch (kind) {
    case "shop":
      return s(
        "g",
        { class: "feature" },
        s("rect", { class: "pole", x: 818, y: 228, width: 10, height: 52, rx: 5 }),
        s("rect", { class: "pole__stripes", x: 818, y: 228, width: 10, height: 52, rx: 5 }),
        s("circle", { class: "bldg-trim", cx: 823, cy: 226, r: 6 }),
        s("path", { class: "awning", d: `M${left + 6} 210h80l6 14${"q-5.3 6 -10.6 0".repeat(8)}z` }),
      );
    case "home":
      return s(
        "g",
        { class: "feature" },
        s("path", { class: "bush", d: `M${left - 10} ${g}c0-14 10-20 18-14 6-10 20-6 20 4 8-2 12 4 10 10z` }),
        s("path", { class: "bush", d: `M${right - 32} ${g}c0-12 9-18 16-12 6-8 18-4 18 4 7-1 10 3 8 8z` }),
        s("rect", { class: "flowerbox", x: left + 12, y: 262, width: 72, height: 6 }),
        s("rect", { class: "flowerbox", x: right - 84, y: 262, width: 72, height: 6 }),
      );
    case "school":
      return s(
        "g",
        { class: "feature" },
        s("rect", { class: "bldg-body", x: cx - 13, y: apex - 30, width: 26, height: 26 }),
        s("path", { class: "bldg-roof bldg-roof--time", d: `M${cx - 18} ${apex - 30}L${cx} ${apex - 46}L${cx + 18} ${apex - 30}z` }),
        s("path", { class: "bell", d: `M${cx - 6} ${apex - 8}c0-8 2-12 6-12s6 4 6 12z` }),
        s("path", { class: "bldg-line", d: `M${cx} ${apex - 46}v-14` }),
        s("path", { class: "flag", d: `M${cx} ${apex - 60}h16l-4 5 4 5h-16z` }),
      );
    case "tower":
      return s(
        "g",
        { class: "feature" },
        s("path", { class: "bldg-body", d: `M${right - 44} ${g}L${right - 34} 40h30l10 ${g - 40}z` }),
        s("path", { class: "bldg-line bldg-line--faint", d: `M${right - 40} 120h38M${right - 37} 200h40M${right - 34} 40l38 ${g - 40}M${right - 4} 40l-40 ${g - 40}` }),
        s("rect", { class: "bldg-window bldg-window--lit", x: right - 42, y: 14, width: 46, height: 26, rx: 2 }),
        s("path", { class: "bldg-roof bldg-roof--time", d: `M${right - 50} 14L${right - 19} -4L${right + 12} 14z` }),
      );
    case "hall":
      return s(
        "g",
        { class: "feature" },
        ...[0, 1, 2, 3, 4].map((i) => s("rect", { class: "column", x: left + 6 + i * 62, y: 226, width: 12, height: g - 226 })),
        s("rect", { class: "bldg-trim", x: left - 4, y: 220, width: right - left + 8, height: 6 }),
        s("rect", { class: "bldg-trim", x: left - 4, y: g - 6, width: right - left + 8, height: 6 }),
      );
    case "parlor":
      return s(
        "g",
        { class: "feature" },
        s("path", { class: "curtain", d: `M${left + 10} 218q10 22 0 46h10q-6 -24 0 -46zM${right - 10} 218q-10 22 0 46h-10q6 -24 0 -46z` }),
        s("path", { class: "awning", d: `M${cx - 30} 228h60l4 10h-68z` }),
      );
    case "studio":
      return s(
        "g",
        { class: "feature" },
        s("path", { class: "bldg-line bldg-line--code", d: `M${left + 14} 226h22M${left + 14} 234h34M${left + 20} 242h18M${right - 72} 226h30M${right - 66} 234h20M${right - 72} 242h40` }),
        s("path", { class: "lamp", d: `M${cx + 30} 242l10 -18h12` }),
      );
    case "diner":
      return s(
        "g",
        { class: "feature" },
        s("path", { class: "awning", d: `M${left - 6} 208h${right - left + 12}l6 14${"q-5.62 6 -11.25 0".repeat(26)}z` }),
        s("rect", { class: "neon", x: cx - 26, y: 168, width: 52, height: 18, rx: 9 }),
        s("text", { class: "neon__text", x: cx, y: 181.5 }, "EAT"),
      );
    case "clinic":
      return s(
        "g",
        { class: "feature" },
        s("rect", { class: "bldg-body", x: right - 60, y: 196, width: 44, height: 44, rx: 4 }),
        s("path", { class: "medcross", d: `M${right - 38} 204v28M${right - 52} 218h28` }),
      );
    case "workshop":
      // A ladder against the wall and a toolbox by the door.
      return s(
        "g",
        { class: "feature" },
        s("path", { class: "ladder", d: `M${right + 2} ${g}L${right - 16} 200M${right + 14} ${g}L${right - 4} 200${[0, 1, 2, 3, 4].map((i) => `M${right - 13 + i * 3.4} ${214 + i * 18}h12`).join("")}` }),
        s("rect", { class: "toolbox", x: left + 14, y: g - 16, width: 34, height: 16, rx: 2 }),
        s("path", { class: "bldg-line", d: `M${left + 24} ${g - 16}v-5h14v5` }),
      );
    case "office":
      // A pediment over the door, pilasters either side, and a brass plate.
      return s(
        "g",
        { class: "feature" },
        s("path", { class: "bldg-roof bldg-roof--time", d: `M${cx - 34} 232L${cx} 214L${cx + 34} 232z` }),
        s("rect", { class: "column", x: cx - 32, y: 232, width: 8, height: g - 232 }),
        s("rect", { class: "column", x: cx + 24, y: 232, width: 8, height: g - 232 }),
        s("rect", { class: "brass", x: cx - 43, y: 248, width: 10, height: 13, rx: 1 }),
      );
    case "nursery":
      return s(
        "g",
        { class: "feature" },
        s("path", { class: "rainbow rainbow--a", d: `M${cx - 30} 240a30 18 0 0 1 60 0` }),
        s("path", { class: "rainbow rainbow--b", d: `M${cx - 25} 240a25 13 0 0 1 50 0` }),
        s("rect", { class: "block block--a", x: right - 40, y: g - 14, width: 14, height: 14 }),
        s("rect", { class: "block block--b", x: right - 24, y: g - 14, width: 14, height: 14 }),
        s("rect", { class: "block block--a", x: right - 32, y: g - 28, width: 14, height: 14 }),
      );
  }
}

export function drawService(sc: Scenario): Building {
  const { left, right, top, apex, cx } = LAYOUT.service;
  const g = LAYOUT.groundY;
  const el = s("g", { class: `service service--${sc.service.facade}` });
  const eave = 18;
  const feature = facadeFeature(sc.service.facade);
  const behind = sc.service.facade === "tower" || sc.service.facade === "school";

  if (behind) el.append(feature);
  el.append(
    s("rect", { class: "bldg-body", x: left, y: top, width: right - left, height: g - top }),
    s("path", { class: "bldg-roof bldg-roof--time", d: `M${left - eave} ${top + 2}L${cx} ${apex}L${right + eave} ${top + 2}z` }),
    s("path", { class: "bldg-line", d: `M${left} ${top + 2}H${right}` }),
    s("rect", { class: "bldg-window", x: left + 12, y: 218, width: 82, height: 48, rx: 2 }),
    s("rect", { class: "bldg-window", x: right - 94, y: 218, width: 82, height: 48, rx: 2 }),
    s("rect", { class: "bldg-door bldg-door--time", x: cx - 22, y: 232, width: 44, height: g - 232, rx: 2 }),
    s("circle", { class: "bldg-knob", cx: cx + 13, cy: 268, r: 2.2 }),
    s("rect", { class: "bldg-trim", x: cx - 30, y: g - 5, width: 60, height: 5 }),
    signPlank(cx - 92, top + 6, 184, sc.service.building, sc.service.icon, "plank--time"),
  );
  if (!behind) el.append(feature);

  // Clock in the gable: the one thing in town that never speeds up.
  const ccy = apex + 52;
  const r = 27;
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    const r1 = i % 3 === 0 ? r - 7 : r - 4.5;
    return `M${(cx + Math.sin(a) * r1).toFixed(1)} ${(ccy - Math.cos(a) * r1).toFixed(1)}L${(cx + Math.sin(a) * (r - 1.5)).toFixed(1)} ${(ccy - Math.cos(a) * (r - 1.5)).toFixed(1)}`;
  }).join("");
  const hourHand = s("line", { class: "clock__hour", x1: cx, y1: ccy, x2: cx, y2: ccy - 13 });
  const minuteHand = s("line", { class: "clock__minute", x1: cx, y1: ccy, x2: cx, y2: ccy - 21 });
  el.append(
    s("circle", { class: "clock__face", cx, cy: ccy, r }),
    s("path", { class: "clock__ticks", d: ticks }),
    hourHand,
    minuteHand,
    s("circle", { class: "clock__pin", cx, cy: ccy, r: 2.6 }),
  );

  const seats = [seat(left + 26, 244), seat(left + 62, 244), seat(right - 80, 244), seat(right - 44, 244)].map((st) => {
    el.append(st.human, st.robot, ...st.clients);
    return st;
  });
  // Seats are narrow; only the first client per seat fits beside the helper, extra clients
  // stack behind. Keep the art legible by offsetting extras upward.
  for (const st of seats) st.clients.forEach((c, i) => i > 0 && c.setAttribute("transform", `translate(${-i * 5.5} ${-i * 1.2})`));

  const hiring = s(
    "g",
    { class: "hiring" },
    s("path", { class: "hiring__string", d: `M${cx - 10} 240l10 -6 10 6` }),
    s("rect", { class: "hiring__card", x: cx - 20, y: 240, width: 40, height: 18, rx: 1.5 }),
    s("text", { class: "hiring__text", x: cx, y: 253 }, "HIRING"),
  );
  const publicBanner = s(
    "g",
    { class: "public-banner" },
    s("path", { class: "public-banner__ribbon", d: `M${cx - 74} ${top - 14}h148l-8 9 8 9h-148l8-9z` }),
    s("text", { class: "public-banner__text", x: cx, y: top - 1 }, "PUBLIC · TAX-FUNDED"),
  );
  el.append(hiring, publicBanner);

  let beam: SVGGElement | null = null;
  if (sc.service.facade === "tower") {
    beam = s("g", { class: "beam" }, s("path", { class: "beam__cone", d: "M0 0L-160 -22L-160 22z" }));
    const holder = s("g", { transform: `translate(${right - 19} 27)` }, beam);
    el.prepend(holder);
  }

  return {
    el,
    update(snap, clock) {
      setAttr(minuteHand, "transform", `rotate(${(((clock / HOUR_SECONDS) % 1) * 360).toFixed(1)} ${cx} ${ccy})`);
      setAttr(hourHand, "transform", `rotate(${(((clock / (HOUR_SECONDS * 12)) % 1) * 360).toFixed(1)} ${cx} ${ccy})`);
      // Inside: who is helping whom. Empty chairs for vacancies, robots for automation.
      const vacancyRate = snap.careLaborDemand > 0 ? Math.min(1, snap.vacancies / snap.careLaborDemand) : 0;
      const staffed = Math.round(SEATS * (1 - vacancyRate));
      const robots = Math.round(snap.automation * SEATS);
      const perSeat = Math.max(1, Math.min(MAX_CLIENTS_PER_SEAT, Math.round(snap.caseload)));
      seats.forEach((st, i) => {
        const isRobot = i >= SEATS - robots;
        toggleClass(st.robot, "is-on", isRobot);
        toggleClass(st.human, "is-on", !isRobot && i < staffed);
        st.clients.forEach((c, j) => toggleClass(c, "is-on", j < perSeat));
      });
      toggleClass(hiring, "is-on", isHiring(snap));
      toggleClass(publicBanner, "is-on", snap.params.funding === "public");
      if (beam) setAttr(beam, "transform", `rotate(${(Math.sin(clock * 0.9) * 22).toFixed(1)})`);
    },
  };
}
