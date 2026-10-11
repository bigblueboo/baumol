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
