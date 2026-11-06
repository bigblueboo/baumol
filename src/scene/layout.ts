/** Geometry of the town drawing, in viewBox units. One place, so props and people agree. */
export const LAYOUT = {
  width: 1000,
  height: 414,
  groundY: 300,
  roadTop: 350,
  roadY: 365,
  roadBottom: 380,
  queueY: 406,
  yard: { cols: 9, rows: 3, colGap: 29, rowGap: 15, frontY: 344, goodsRoadX: 372, serviceRoadX: 628 },
  factory: { left: 34, right: 360, top: 168, roof: 130 },
  service: { left: 646, right: 924, top: 184, apex: 86, cx: 785 },
  board: { left: 424, right: 576, top: 96, bottom: 256 },
  bin: { x: 372, y: 300 },
  /** Chimney top centre: smoke rises from here; the dish and beacon perch on it. */
  chimney: { x: 309, top: 58 },
  /** Conveyor top, and the line items ride along. */
  belt: { y: 278, itemY: 266 },
} as const;

export type Job = "goods" | "service";

export interface Point {
  x: number;
  y: number;
}

/** Where townspeople stand, and the way they walk between yards. Each scene supplies its own. */
export interface Yards {
  slot(job: Job, slot: number): Point;
  /** Waypoints from where someone stands to a new spot, by way of the road. */
  route(from: Point, to: Point): Point[];
}

/**
 * Yard slots in the flat drawing: the front row fills first, and column 0 sits by the road so
 * arrivals and departures don't cross the crowd.
 */
export function flatYards(serviceDx: number): Yards {
  const { cols, colGap, rowGap, rows, frontY, goodsRoadX, serviceRoadX } = LAYOUT.yard;
  return {
    slot(job, slot) {
      const col = slot % cols;
      const row = Math.floor(slot / cols) % rows;
      const stagger = row % 2 ? colGap / 2 : 0;
      const x = job === "goods" ? goodsRoadX - col * colGap - stagger : serviceRoadX + serviceDx + col * colGap + stagger;
      return { x, y: frontY - row * rowGap };
    },
    route: (from, to) => [{ x: from.x, y: LAYOUT.roadY }, { x: to.x, y: LAYOUT.roadY }, to],
  };
}

/**
 * How the drawing is arranged. Phones get the compact composition: the noticeboard moves out
 * into an HTML strip and the service building slides left, so the town draws about a third larger.
 */
export interface Composition {
  width: number;
  /** Horizontal shift applied to the service building, its yard and its queue. */
  serviceDx: number;
  /** Where wages and price are shown: the noticeboard in the drawing, or a strip under it. */
  readout: "board" | "strip";
  gateX: number;
}

export const WIDE: Composition = { width: LAYOUT.width, serviceDx: 0, readout: "board", gateX: 500 };
export const COMPACT: Composition = { width: 744, serviceDx: -216, readout: "strip", gateX: 392 };
