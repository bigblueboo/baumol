import type { Job, Point, Yards } from "../layout";

/**
 * The isometric town is laid out on the ground in (u, v): u runs across the street, from the
 * factory's side to the service's; v runs from the back of the lots toward the reader. One affine
 * projection turns ground into drawing, so a straight walk on the ground stays straight on screen.
 */
const C = Math.cos(Math.PI / 6);
const S = 0.5;

/** Screen position of the ground origin (the slab's back corner). */
const ORIGIN = { x: 560, y: 160 };

export function iso(u: number, v: number, lift = 0): Point {
  return { x: ORIGIN.x + (u - v) * C, y: ORIGIN.y + (u + v) * S - lift };
}

/** Back from the drawing to the ground. */
function ground(p: Point): { u: number; v: number } {
  const a = (p.x - ORIGIN.x) / C;
  const b = (p.y - ORIGIN.y) / S;
  return { u: (a + b) / 2, v: (b - a) / 2 };
}

/** An SVG path through ground points. */
export function groundPath(points: [number, number][], close = true): string {
  return points.map(([u, v], i) => `${i ? "L" : "M"}${iso(u, v).x.toFixed(1)} ${iso(u, v).y.toFixed(1)}`).join("") + (close ? "Z" : "");
}

/**
 * The SVG transform that lays flat art onto a vertical wall running along u (a wall facing the
 * reader's lower left), with (0, 0) at ground point (u, v) and `lift` units up.
 */
export function wallAlongU(u: number, v: number, lift = 0): string {
  const o = iso(u, v, lift);
  return `matrix(${C.toFixed(4)} ${S} 0 1 ${o.x.toFixed(1)} ${o.y.toFixed(1)})`;
}

/**
 * The ground plan, in ground units. The street runs along v, between the two lots, from a little
 * plaza at the back (where the wage board stands) to the slab's front edge. Both buildings face
 * the reader with their yards in front; switching jobs means crossing the street at the zebra.
 */
export const PLAN = {
  slab: { u0: 0, u1: 630, v0: 40, v1: 570, depth: 26 },
  factory: { u: 150, v: 180, hu: 112, hv: 112 },
  service: { u: 505, v: 190, hu: 98, hv: 98 },
  street: { u0: 286, u1: 354, v0: 250, v1: 570 },
  /** The zebra crossing: everyone who changes jobs crosses here. */
  crossing: { v: 486, half: 16 },
  /** The wage board stands on the open lawn at the front, where nothing can hide it. */
  board: { u: 104, v: 556 },
  /** Workers stand in rows in front of their building; column 0 is by the street. */
  yard: { cols: 9, rows: 3, colGap: 25, rowGap: 19, frontV: 448, goodsU: 266, serviceU: 374 },
  /** The waiting list forms along the front of the slab, before the service. */
  queue: { u: 380, v: 532, gap: 24 },
  gate: { u: 286 },
  /** Where finished goods pile up, beside the factory bay. */
  bin: { u: 262, v: 330 },
  /** Seats in front of the service porch, where the helping happens. */
  porch: { u0: 432, gap: 36, v: 356 },
} as const;

export const isoYards: Yards = {
  slot(job: Job, slot: number): Point {
    const { cols, rows, colGap, rowGap, frontV, goodsU, serviceU } = PLAN.yard;
    const col = slot % cols;
    const row = Math.floor(slot / cols) % rows;
    const stagger = row % 2 ? colGap / 2 : 0;
    const u = job === "goods" ? goodsU - col * colGap - stagger : serviceU + col * colGap + stagger;
    return iso(u, frontV - row * rowGap);
  },
  route(from, to) {
    const v = PLAN.crossing.v;
    return [iso(ground(from).u, v), iso(ground(to).u, v), to];
  },
};
