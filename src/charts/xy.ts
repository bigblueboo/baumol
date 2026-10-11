import "./xy.css";
import { s, setAttr, setText, toggleClass } from "../ui/dom";

export type Pt = readonly [number, number];

/** Colour family, mapped to the .tone-* classes in tokens.css. */
type Tone = "things" | "time" | "coin" | "muted";

export interface Axis {
  min: number;
  max: number;
  ticks: number[];
  format: (v: number) => string;
  /** Logarithmic (base 2) scale: equal steps per doubling. */
  log?: boolean;
  label?: string;
}

export interface Line {
  kind: "line";
  points: Pt[];
  tone: Tone;
  label?: string;
  dashed?: boolean;
}

interface Band {
  kind: "band";
  lower: Pt[];
  upper: Pt[];
  tone: Tone;
  label?: string;
}

export type Mark = Line | Band;

const PAD = { left: 46, right: 92, top: 18, bottom: 40 };

/** Smaller viewBoxes print the same 12px labels larger relative to the plot. */
const CHART_SIZES = {
  regular: { w: 520, h: 280 },
  compact: { w: 340, h: 250 },
} as const;

/**
 * A small, direct-labelled XY chart. Series are labelled at their right ends instead of in a
 * legend; the same element is reused across updates so paths can animate between states.
 */
export class XYChart {
  readonly el: SVGSVGElement;
  private readonly marks: SVGGElement;
  private readonly labels: SVGGElement;
  private readonly cursor: SVGGElement;
  private readonly cursorText: SVGTextElement;
  private readonly paths = new Map<string, SVGPathElement>();
  private readonly ends = new Map<string, SVGTextElement>();

  private readonly W: number;
  private readonly H: number;

  constructor(
    private x: Axis,
    private y: Axis,
    title: string,
    size: keyof typeof CHART_SIZES = "regular",
  ) {
    const { w: W, h: H } = CHART_SIZES[size];
    this.W = W;
    this.H = H;
    this.el = s("svg", { class: "xy", viewBox: `0 0 ${W} ${H}`, role: "img", "aria-label": title });
    const grid = s("g", { class: "xy__grid" });
    for (const t of y.ticks) {
      const py = this.py(t);
      grid.append(
        s("line", { x1: PAD.left, x2: W - PAD.right, y1: py, y2: py }),
        s("text", { class: "xy__tick xy__tick--y", x: PAD.left - 8, y: py + 4 }, y.format(t)),
      );
    }
    for (const t of x.ticks) {
      grid.append(s("text", { class: "xy__tick xy__tick--x", x: this.px(t), y: H - PAD.bottom + 18 }, x.format(t)));
    }
    grid.append(s("line", { class: "xy__axis", x1: PAD.left, x2: W - PAD.right, y1: H - PAD.bottom, y2: H - PAD.bottom }));
    if (x.label) grid.append(s("text", { class: "xy__axis-label", x: (PAD.left + W - PAD.right) / 2, y: H - 4 }, x.label));
    if (y.label) grid.append(s("text", { class: "xy__axis-label xy__axis-label--y", x: PAD.left - 38, y: PAD.top - 4 }, y.label));
    this.marks = s("g", { class: "xy__marks" });
    this.labels = s("g", { class: "xy__labels" });
    this.cursorText = s("text", { class: "xy__cursor-text", x: 0, y: PAD.top + 10 });
    this.cursor = s("g", { class: "xy__cursor" }, s("line", { x1: 0, x2: 0, y1: PAD.top, y2: this.H - PAD.bottom }), this.cursorText);
    this.el.append(grid, this.marks, this.cursor, this.labels);
  }

  px(v: number): number {
    return PAD.left + this.frac(this.x, v) * (this.W - PAD.left - PAD.right);
  }

  py(v: number): number {
    return this.H - PAD.bottom - this.frac(this.y, v) * (this.H - PAD.top - PAD.bottom);
  }

  private frac(a: Axis, v: number): number {
    const c = Math.min(a.max, Math.max(a.min, v));
    return a.log ? Math.log2(c / a.min) / Math.log2(a.max / a.min) : (c - a.min) / (a.max - a.min);
  }

  private polyline(pts: Pt[]): string {
    return pts.map(([a, b], i) => `${i ? "L" : "M"}${this.px(a).toFixed(1)} ${this.py(b).toFixed(1)}`).join("");
  }

  private path(key: string, cls: string): SVGPathElement {
    let p = this.paths.get(key);
    if (!p) {
      p = s("path", { class: cls });
      this.paths.set(key, p);
      this.marks.append(p);
    }
    return p;
  }

  /** Place (or move) a series' end label. Returns it with its ideal baseline for dodging. */
  private endLabel(key: string, at: Pt, text: string, tone: Tone): { el: SVGTextElement; y: number } {
    let t = this.ends.get(key);
    if (!t) {
      t = s("text", { class: `xy__end tone-${tone}` });
      this.ends.set(key, t);
      this.labels.append(t);
    }
    setAttr(t, "x", (this.px(at[0]) + 8).toFixed(1));
    setText(t, text);
    return { el: t, y: this.py(at[1]) + 4 };
  }

  /** Marks are keyed by position, so the same figure state always reuses the same paths. */
  update(marks: Mark[]): void {
    const placed: { el: SVGTextElement; y: number }[] = [];
    marks.forEach((m, i) => {
      const key = `m${i}`;
      if (m.kind === "line") {
        const p = this.path(key, `xy__line tone-${m.tone}${m.dashed ? " is-dashed" : ""}`);
        setAttr(p, "d", this.polyline(m.points));
        const last = m.points[m.points.length - 1];
        if (m.label && last) placed.push(this.endLabel(key, last, m.label, m.tone));
      } else {
        const p = this.path(key, `xy__band tone-${m.tone}`);
        const d = this.polyline(m.upper) + this.polyline([...m.lower].reverse()).replace(/^M/, "L") + "Z";
        setAttr(p, "d", d);
        const lu = m.upper[m.upper.length - 1];
        const ll = m.lower[m.lower.length - 1];
        if (m.label && lu && ll) placed.push(this.endLabel(key, [lu[0], (lu[1] + ll[1]) / 2], m.label, m.tone));
      }
    });
    dodge(placed);
  }

  /** A vertical "you are here" marker. */
  setCursor(xValue: number, text: string): void {
    toggleClass(this.cursor, "is-on", true);
    const px = this.px(xValue);
    setAttr(this.cursor, "transform", `translate(${px.toFixed(1)} 0)`);
    setText(this.cursorText, text);
  }
}

/** Labels closer than this (in viewBox units) are pushed apart. */
const LABEL_GAP = 14;

/** Push overlapping end labels apart vertically, keeping their order. */
function dodge(labels: { el: SVGTextElement; y: number }[]): void {
  const sorted = [...labels].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    const prev = sorted[i - 1];
    const cur = sorted[i];
    if (prev && cur && cur.y - prev.y < LABEL_GAP) cur.y = prev.y + LABEL_GAP;
  }
  for (const l of sorted) setAttr(l.el, "y", l.y.toFixed(1));
}
