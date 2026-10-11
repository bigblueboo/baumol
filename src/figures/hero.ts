import "./hero.css";
import { iconGroup } from "../scene/icons";
import { animate } from "../ui/loop";
import { prefersReducedMotion, s, setAttr, setText, toggleClass } from "../ui/dom";
import { plural } from "../ui/format";

/** Gadgets per worker-hour at each step, and how long it holds: brisk at first, slower near the top. */
const LEVELS = [
  { n: 1, hold: 1.1 },
  { n: 2, hold: 1.1 },
  { n: 4, hold: 1.3 },
  { n: 8, hold: 1.8 },
  { n: 16, hold: 2.2 },
  { n: 32, hold: 4.2 },
] as const;

interface HeroLayout {
  width: number;
  height: number;
  /** Rows of the heap, bottom first; they sum to the top level (32). */
  heap: { x: number; base: number; size: number; rows: number[] };
  count: { x: number; y: number };
  clock: { cx: number; cy: number; r: number };
}

/** Side by side on wide screens; heap above clock on phones, so nothing is pushed off-canvas. */
const WIDE: HeroLayout = {
  width: 1000,
  height: 250,
  heap: { x: 12, base: 232, size: 36, rows: [8, 7, 6, 5, 3, 2, 1] },
  count: { x: 360, y: 214 },
  clock: { cx: 860, cy: 125, r: 100 },
};
const NARROW: HeroLayout = {
  width: 520,
  height: 360,
  // A wider, flatter heap on phones, so the empty room above it stays small.
  heap: { x: 8, base: 160, size: 34, rows: [12, 10, 7, 3] },
  count: { x: 8, y: 228 },
  clock: { cx: 432, cy: 268, r: 80 },
};
const NARROW_BELOW_PX = 600;

/**
 * The opening image: a heap of gadgets that keeps doubling beside a clock that keeps its pace.
 * The whole argument, before a word of it.
 */
export function mountHero(host: HTMLElement): void {
  const c = host.clientWidth < NARROW_BELOW_PX ? NARROW : WIDE;
  const { size } = c.heap;
  const step = size * 1.05;
  const widest = Math.max(...c.heap.rows);
  const icons = c.heap.rows.flatMap((n, row) =>
    Array.from({ length: n }, (_, i) => {
      const x = c.heap.x + ((widest - n) * step) / 2 + i * step;
      const y = c.heap.base - (row + 1) * size * 0.92;
      const g = iconGroup("gadget", x, y, size, "hero__gadget");
      g.style.setProperty("--i", String(i));
      return g;
    }),
  );
  const count = s("text", { class: "hero__count", x: c.count.x, y: c.count.y });
  const countLabel = s("text", { class: "hero__count-label", x: c.count.x + 100, y: c.count.y - 22 });
  const countLabel2 = s("text", { class: "hero__count-label hero__count-label--soft", x: c.count.x + 100, y: c.count.y }, "and it keeps doubling");

  const { cx, cy, r } = c.clock;
  const ticks = Array.from({ length: 60 }, (_, i) => {
    const a = (i / 60) * Math.PI * 2;
    const r1 = i % 5 === 0 ? r - 14 : r - 7;
    return `M${(cx + Math.sin(a) * r1).toFixed(1)} ${(cy - Math.cos(a) * r1).toFixed(1)}L${(cx + Math.sin(a) * (r - 3)).toFixed(1)} ${(cy - Math.cos(a) * (r - 3)).toFixed(1)}`;
  }).join("");
  const hand = s("line", { class: "hero__hand", x1: cx, y1: cy + 12, x2: cx, y2: cy - r + 18 });

  host.append(
    s(
      "svg",
      { class: "hero-art", viewBox: `0 0 ${c.width} ${c.height}`, "aria-hidden": "true" },
      ...icons,
      count,
      countLabel,
      countLabel2,
      s("circle", { class: "hero__face", cx, cy, r }),
      s("path", { class: "hero__ticks", d: ticks }),
      hand,
      s("circle", { class: "hero__pin", cx, cy, r: 5 }),
      s("text", { class: "hero__clock-label", x: cx - r - 22, y: cy + 4 }, "one care-hour"),
      s("text", { class: "hero__clock-label hero__count-label--soft", x: cx - r - 22, y: cy + 24 }, "still sixty minutes"),
    ),
  );

  // Start partly built, so the first screen already shows a pile beside the clock.
  let level: (typeof LEVELS)[number] = LEVELS[2];
  const paint = () => {
    const { n } = level;
    icons.forEach((g, i) => toggleClass(g, "is-on", i < n));
    setText(count, String(n));
    setText(countLabel, `${plural(n, "gadget", "gadgets")} from one worker-hour`);
  };
  if (prefersReducedMotion()) {
    level = LEVELS[3];
    paint();
    return;
  }
  paint();

  let held = 0;
  let angle = 0;
  animate(host, (dt) => {
    angle = (angle + dt * 6) % 360;
    setAttr(hand, "transform", `rotate(${angle.toFixed(2)} ${cx} ${cy})`);
    held += dt;
    if (held >= level.hold) {
      held = 0;
      level = LEVELS[(LEVELS.indexOf(level) + 1) % LEVELS.length] ?? LEVELS[0];
      paint();
    }
  });
}
