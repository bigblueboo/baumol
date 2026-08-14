/**
 * Hand-rolled SVG line/area charts in the paper-and-ink style. One y-axis
 * each, thin marks, recessive hairline grid, legend + selective end labels,
 * hover crosshair with tooltip, and a table twin for accessibility.
 *
 * Charts unlock as the story earns them: the price chart after the first
 * chain, work/spending after the second era, affordability at the crisis.
 * Era and policy votes appear as labeled moments on the price chart and as
 * quiet ticks on the others.
 */

import type { AppStore, EventMark, Sample } from "../app/store";

const W = 520;
const H = 280;
const M = { l: 46, r: 88, t: 18, b: 30 };
const PW = W - M.l - M.r;
const PH = H - M.t - M.b;
const NS = "http://www.w3.org/2000/svg";
const MAX_POINTS = 700; // ~1.3 per horizontal pixel; decimate beyond this

interface SeriesSpec {
  key: string;
  label: string;
  color: string;
  get(s: Sample): number;
  /** Render as background reference (thinner) per the emphasis pattern. */
  deemph?: boolean;
  /** Only include when this returns true for the current history. */
  active?(hist: Sample[]): boolean;
}

interface ChartSpec {
  id: string;
  title: string;
  sub: string;
  series: SeriesSpec[];
  stacked?: boolean;
  /** Label era/policy markers (vs quiet ticks only). */
  labelEvents?: boolean;
  yDomain(hist: Sample[], active: SeriesSpec[]): [number, number];
  yTicks(domain: [number, number]): number[];
  fmt(v: number): string;
  fmtLong?(v: number): string;
}

function svgEl<K extends keyof SVGElementTagNameMap>(
  tag: K,
  attrs: Record<string, string | number> = {},
  parent?: Element,
): SVGElementTagNameMap[K] {
  const node = document.createElementNS(NS, tag);
  for (const [k, v] of Object.entries(attrs)) node.setAttribute(k, String(v));
  parent?.appendChild(node);
  return node;
}

function fmtYear(week: number): string {
  if (week < 2) return "start";
  const y = week / 52;
  return y < 9.5 ? `yr ${Math.round(y * 10) / 10}` : `yr ${Math.round(y)}`;
}

/** Thin the middle of a long history, always keeping first and last. */
function decimate(hist: Sample[]): Sample[] {
  if (hist.length <= MAX_POINTS) return hist;
  const stride = Math.ceil(hist.length / MAX_POINTS);
  const out: Sample[] = [];
  for (let i = 0; i < hist.length; i += stride) out.push(hist[i]!);
  const last = hist[hist.length - 1]!;
  if (out[out.length - 1] !== last) out.push(last);
  return out;
}

class Chart {
  readonly root: HTMLElement;
  private plot: SVGGElement;
  private gridG: SVGGElement;
  private seriesG: SVGGElement;
  private labelsG: SVGGElement;
  private axisG: SVGGElement;
  private eventsG: SVGGElement;
  private cross: SVGLineElement;
  private dots: SVGCircleElement[] = [];
  private tooltip: HTMLDivElement;
  private svg: SVGSVGElement;
  private table: HTMLTableElement;
  private hist: Sample[] = [];
  private activeSeries: SeriesSpec[] = [];
  private lastDrawnLen = 0;
  private lastEventCount = 0;
  visible = true;

  constructor(
    host: HTMLElement,
    private spec: ChartSpec,
  ) {
    this.root = document.createElement("figure");
    this.root.className = "chart";
    this.root.id = `chart-${spec.id}`;
    this.root.style.margin = "0";
    // charts start locked; the gate opens them as the story earns them
    this.root.hidden = true;
    this.root.innerHTML = `
      <h3>${spec.title}</h3>
      <p class="chart-sub">${spec.sub}</p>
      <div class="legend" role="list"></div>
      <div class="plot-wrap"></div>
      <details class="table-view"><summary>Read as a table</summary><table></table></details>
    `;
    host.appendChild(this.root);

    const wrap = this.root.querySelector<HTMLElement>(".plot-wrap")!;
    this.svg = svgEl("svg", {
      viewBox: `0 0 ${W} ${H}`,
      role: "img",
      "aria-label": `${spec.title}. ${spec.sub} Data also available in the table below.`,
    });
    wrap.appendChild(this.svg);
    this.gridG = svgEl("g", {}, this.svg);
    this.eventsG = svgEl("g", {}, this.svg);
    this.seriesG = svgEl("g", {}, this.svg);
    this.labelsG = svgEl("g", {}, this.svg);
    this.axisG = svgEl("g", {}, this.svg);
    this.cross = svgEl("line", {
      y1: M.t, y2: M.t + PH,
      stroke: "var(--ink-faint)", "stroke-width": 1, opacity: 0,
    }, this.svg);
    this.plot = svgEl("g", {}, this.svg);

    this.tooltip = document.createElement("div");
    this.tooltip.className = "tooltip";
    wrap.appendChild(this.tooltip);
    this.table = this.root.querySelector("table")!;

    this.svg.addEventListener("pointermove", (e) => this.onHover(e));
    this.svg.addEventListener("pointerleave", () => this.hideHover());
    this.root
      .querySelector("details")!
      .addEventListener("toggle", () => this.renderTable());
  }

  private x(week: number, maxWeek: number): number {
    return M.l + (week / maxWeek) * PW;
  }

  private y(v: number, dom: [number, number]): number {
    const [lo, hi] = dom;
    return M.t + PH - ((v - lo) / (hi - lo)) * PH;
  }

  update(fullHist: Sample[], events: EventMark[], force = false): void {
    if (!force && fullHist.length === this.lastDrawnLen && events.length === this.lastEventCount) {
      return;
    }
    this.lastDrawnLen = fullHist.length;
    this.lastEventCount = events.length;
    const hist = decimate(fullHist);
    this.hist = hist;
    this.activeSeries = this.spec.series.filter((s) => !s.active || s.active(hist));

    const maxWeek = Math.max(hist[hist.length - 1]?.week ?? 1, 26);
    const dom = this.spec.yDomain(hist, this.activeSeries);

    // legend
    const legend = this.root.querySelector(".legend")!;
    const legendHtml = this.activeSeries
      .map(
        (s) =>
          `<span class="key" role="listitem"><span class="swatch" style="background:${s.color}"></span>${s.label}</span>`,
      )
      .join("");
    if (legend.innerHTML !== legendHtml) legend.innerHTML = legendHtml;

    // grid + axis
    this.gridG.replaceChildren();
    this.axisG.replaceChildren();
    const ticks = this.spec.yTicks(dom);
    for (const t of ticks) {
      const yy = this.y(t, dom);
      svgEl("line", { x1: M.l, x2: M.l + PW, y1: yy, y2: yy, stroke: "var(--hairline)", "stroke-width": 1 }, this.gridG);
      const lbl = svgEl("text", { x: M.l - 7, y: yy + 3.5, "font-size": 11, fill: "var(--ink-faint)", "text-anchor": "end" }, this.axisG);
      lbl.textContent = this.spec.fmt(t);
    }
    const stepWeeks =
      [13, 26, 52, 104, 260, 520].find((s) => maxWeek / s <= 5.5) ?? 1040;
    for (let w = 0; w <= maxWeek; w += stepWeeks) {
      const xx = this.x(w, maxWeek);
      const lbl = svgEl("text", { x: xx, y: M.t + PH + 18, "font-size": 11, fill: "var(--ink-faint)", "text-anchor": "middle" }, this.axisG);
      lbl.textContent =
        w === 0 ? "start" : w < 52 ? `${Math.round(w / 4.33)} mo` : `yr ${Math.round(w / 52)}`;
    }
    svgEl("line", { x1: M.l, x2: M.l + PW, y1: M.t + PH, y2: M.t + PH, stroke: "var(--ink-faint)", "stroke-width": 1 }, this.axisG);

    // era/policy moments
    this.eventsG.replaceChildren();
    for (const ev of events) {
      const xx = this.x(ev.week, maxWeek);
      svgEl("line", {
        x1: xx, x2: xx, y1: M.t + (this.spec.labelEvents ? 8 : 0), y2: M.t + PH,
        stroke: ev.kind === "era" ? "var(--studio)" : "var(--care)",
        "stroke-width": 1, opacity: 0.35,
      }, this.eventsG);
      if (this.spec.labelEvents) {
        const lbl = svgEl("text", {
          x: xx + 3, y: M.t + 4, "font-size": 9.5, "font-weight": 600,
          fill: ev.kind === "era" ? "var(--studio-deep)" : "var(--care-deep)",
        }, this.eventsG);
        lbl.textContent = ev.label;
      }
    }
    if (this.spec.labelEvents) this.fixEventLabelCollisions();

    // series
    this.seriesG.replaceChildren();
    this.labelsG.replaceChildren();

    if (this.spec.stacked) {
      // stacked areas with a 2px paper gap between bands
      let base = new Array<number>(hist.length).fill(0);
      for (const s of this.activeSeries) {
        const tops = hist.map((pt, i) => (base[i] ?? 0) + s.get(pt));
        let d = "";
        for (let i = 0; i < hist.length; i++) {
          d += `${i ? "L" : "M"}${this.x(hist[i]!.week, maxWeek).toFixed(1)},${this.y(tops[i]!, dom).toFixed(1)}`;
        }
        for (let i = hist.length - 1; i >= 0; i--) {
          d += `L${this.x(hist[i]!.week, maxWeek).toFixed(1)},${this.y(base[i]!, dom).toFixed(1)}`;
        }
        svgEl("path", { d: d + "Z", fill: s.color, "fill-opacity": 0.55, stroke: "var(--paper)", "stroke-width": 2 }, this.seriesG);
        base = tops;
      }
      let b2 = 0;
      const last = hist[hist.length - 1];
      if (last) {
        for (const s of this.activeSeries) {
          const v = s.get(last);
          if (v / (dom[1] - dom[0]) > 0.07) {
            const mid = this.y(b2 + v / 2, dom);
            const lbl = svgEl("text", { x: M.l + PW + 6, y: mid + 3.5, "font-size": 11.5, "font-weight": 600, fill: "var(--ink-soft)" }, this.labelsG);
            lbl.textContent = `${s.label} ${this.spec.fmt(v)}`;
          }
          b2 += v;
        }
      }
    } else {
      for (const s of this.activeSeries) {
        let d = "";
        for (let i = 0; i < hist.length; i++) {
          d += `${i ? "L" : "M"}${this.x(hist[i]!.week, maxWeek).toFixed(1)},${this.y(s.get(hist[i]!), dom).toFixed(1)}`;
        }
        svgEl("path", {
          d,
          fill: "none",
          stroke: s.color,
          "stroke-width": s.deemph ? 1.5 : 2,
          "stroke-linecap": "round",
          "stroke-linejoin": "round",
        }, this.seriesG);
        const last = hist[hist.length - 1];
        if (last) {
          const yy = this.y(s.get(last), dom);
          svgEl("circle", {
            cx: M.l + PW, cy: yy, r: 4,
            fill: s.color,
            stroke: "var(--paper)", "stroke-width": 2,
          }, this.labelsG);
          const lbl = svgEl("text", { x: M.l + PW + 7, y: yy + 3.5, "font-size": 11.5, "font-weight": 600, fill: "var(--ink-soft)" }, this.labelsG);
          lbl.textContent = this.spec.fmt(s.get(last));
        }
      }
      this.fixLabelCollisions();
    }

    if (this.root.querySelector("details")!.open) this.renderTable();
  }

  /** Nudge colliding end labels apart. */
  private fixLabelCollisions(): void {
    const labels = [...this.labelsG.querySelectorAll("text")];
    labels.sort((a, b) => Number(a.getAttribute("y")) - Number(b.getAttribute("y")));
    let lastY = -Infinity;
    for (const l of labels) {
      let y = Number(l.getAttribute("y"));
      if (y - lastY < 13) {
        y = lastY + 13;
        l.setAttribute("y", String(y));
      }
      lastY = y;
    }
  }

  /** Drop event labels that would overlap their left neighbor. */
  private fixEventLabelCollisions(): void {
    const labels = [...this.eventsG.querySelectorAll("text")];
    let lastEnd = -Infinity;
    for (const l of labels) {
      const x = Number(l.getAttribute("x"));
      const width = (l.textContent?.length ?? 0) * 5.2;
      if (x < lastEnd + 6) {
        l.remove();
        continue;
      }
      lastEnd = x + width;
    }
  }

  private onHover(e: PointerEvent): void {
    if (this.hist.length < 2) return;
    const rect = this.svg.getBoundingClientRect();
    const px = ((e.clientX - rect.left) / rect.width) * W;
    const maxWeek = Math.max(this.hist[this.hist.length - 1]?.week ?? 1, 26);
    const week = ((px - M.l) / PW) * maxWeek;
    let nearest = this.hist[0]!;
    let best = Infinity;
    for (const s of this.hist) {
      const dd = Math.abs(s.week - week);
      if (dd < best) {
        best = dd;
        nearest = s;
      }
    }
    const xx = this.x(nearest.week, maxWeek);
    this.cross.setAttribute("x1", String(xx));
    this.cross.setAttribute("x2", String(xx));
    this.cross.setAttribute("opacity", "1");

    const dom = this.spec.yDomain(this.hist, this.activeSeries);
    this.dots.forEach((d) => d.remove());
    this.dots = this.activeSeries.map((s) => {
      let v = s.get(nearest);
      if (this.spec.stacked) {
        let acc = 0;
        for (const s2 of this.activeSeries) {
          acc += s2.get(nearest);
          if (s2 === s) break;
        }
        v = acc;
      }
      return svgEl("circle", {
        cx: xx, cy: this.y(v, dom), r: 4,
        fill: s.color,
        stroke: "var(--paper)", "stroke-width": 2,
      }, this.plot);
    });

    const fmt = this.spec.fmtLong ?? this.spec.fmt;
    this.tooltip.innerHTML =
      `<strong>${fmtYear(nearest.week)}</strong><br>` +
      this.activeSeries.map((s) => `${s.label}: ${fmt(s.get(nearest))}`).join("<br>");
    const wrapRect = this.tooltip.parentElement!.getBoundingClientRect();
    const tx = (xx / W) * wrapRect.width;
    const ty = (M.t / H) * wrapRect.height + 8;
    this.tooltip.style.left = `${tx}px`;
    this.tooltip.style.top = `${ty}px`;
    this.tooltip.style.opacity = "1";
  }

  private hideHover(): void {
    this.cross.setAttribute("opacity", "0");
    this.tooltip.style.opacity = "0";
    this.dots.forEach((d) => d.remove());
    this.dots = [];
  }

  private renderTable(): void {
    const rows: Sample[] = [];
    const step = Math.max(1, Math.floor(this.hist.length / 12));
    for (let i = 0; i < this.hist.length; i += step) rows.push(this.hist[i]!);
    const lastRow = this.hist[this.hist.length - 1];
    if (lastRow && rows[rows.length - 1] !== lastRow) rows.push(lastRow);
    const fmt = this.spec.fmtLong ?? this.spec.fmt;
    this.table.innerHTML =
      `<thead><tr><th>Time</th>${this.activeSeries.map((s) => `<th>${s.label}</th>`).join("")}</tr></thead>` +
      `<tbody>${rows
        .map(
          (r) =>
            `<tr><td>${fmtYear(r.week)}</td>${this.activeSeries
              .map((s) => `<td>${fmt(s.get(r))}</td>`)
              .join("")}</tr>`,
        )
        .join("")}</tbody>`;
  }
}

// ---------- the four charts ----------

const STUDIO_C = "#2f6aa8";
const CARE_C = "#c25a34";
const SCHOOL_C = "#7a6bb5";
const DEEMPH_C = "#59524a";

function niceTicks(lo: number, hi: number, n = 4): number[] {
  const span = hi - lo;
  const raw = span / n;
  const mag = Math.pow(10, Math.floor(Math.log10(raw)));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => span / s <= n + 0.5) ?? mag * 10;
  const ticks: number[] = [];
  for (let v = Math.ceil(lo / step) * step; v <= hi + 1e-9; v += step) ticks.push(v);
  return ticks;
}

export function buildCharts(host: HTMLElement, store: AppStore): { update(force?: boolean): void } {
  const specs: ChartSpec[] = [
    {
      id: "hour",
      title: "The price of an hour, in minutes of work",
      sub: "Minutes of paid work, at the town's going wage, to buy the full cost of each thing (before subsidies).",
      labelEvents: true,
      series: [
        { key: "sit", label: "1 hour of sitting", color: CARE_C, get: (s) => s.sitMin },
        { key: "soft", label: "1 unit of software", color: STUDIO_C, get: (s) => s.softMin },
      ],
      yDomain: () => [0, 68],
      yTicks: () => [0, 15, 30, 45, 60],
      fmt: (v) => (v >= 9.5 ? `${Math.round(v)} min` : `${Math.round(v * 10) / 10} min`),
    },
    {
      id: "work",
      title: "Where the town works",
      sub: "All 24 workers, by what they do all day.",
      stacked: true,
      // band order keeps indigo and violet apart (CVD separation)
      series: [
        { key: "eng", label: "engineers", color: STUDIO_C, get: (s) => s.engineers },
        { key: "sit", label: "sitters", color: CARE_C, get: (s) => s.sitters },
        { key: "train", label: "code school", color: SCHOOL_C, get: (s) => s.trainees, active: (h) => h.some((s) => s.trainees > 0.3) },
      ],
      yDomain: (h) => [0, Math.max(24, ...h.map((s) => s.engineers + s.trainees + s.sitters))],
      yTicks: (d) => niceTicks(0, d[1]),
      fmt: (v) => `${Math.round(v)}`,
      fmtLong: (v) => `${Math.round(v * 10) / 10} people`,
    },
    {
      id: "afford",
      title: "Who can still afford a sitter",
      sub: "Hours a week a household can buy with 15% of after-tax income.",
      series: [
        { key: "avg", label: "average household", color: DEEMPH_C, get: (s) => s.affordAvg, deemph: true },
        { key: "q1", label: "bottom-quartile household", color: CARE_C, get: (s) => s.affordQ1 },
      ],
      yDomain: (h) => [0, Math.max(8, ...h.map((s) => Math.max(s.affordAvg, s.affordQ1))) * 1.12],
      yTicks: (d) => niceTicks(0, d[1]),
      fmt: (v) => `${v >= 9.5 ? Math.round(v) : Math.round(v * 10) / 10} hr`,
      fmtLong: (v) => `${Math.round(v * 10) / 10} hr/week`,
    },
    {
      id: "spend",
      title: "Where the money goes",
      sub: "Care's slice of everything the town spends.",
      series: [
        { key: "care", label: "spent on sitting", color: CARE_C, get: (s) => s.careShare },
        { key: "pub", label: "of it via town taxes", color: SCHOOL_C, get: (s) => s.publicShare, active: (h) => h.some((s) => s.publicShare > 0.01) },
      ],
      yDomain: () => [0, 1],
      yTicks: () => [0, 0.25, 0.5, 0.75, 1],
      fmt: (v) => `${Math.round(v * 100)}%`,
    },
  ];

  const charts = specs.map((s) => new Chart(host, s));

  // Only redraw charts that are actually on screen.
  const io = new IntersectionObserver(
    (entries) => {
      for (const en of entries) {
        const c = charts.find((ch) => ch.root === en.target);
        if (c) c.visible = en.isIntersecting;
      }
    },
    { rootMargin: "200px" },
  );
  for (const c of charts) io.observe(c.root);

  // Charts unlock as the story earns them.
  function gate(id: string, open: boolean): void {
    const c = charts.find((ch) => ch.root.id === `chart-${id}`);
    if (c && c.root.hidden === open) {
      c.root.hidden = !open;
      if (open) c.root.classList.add("reveal");
    }
  }

  return {
    update(force = false) {
      const st = store.getState();
      gate("hour", st.chartsUnlocked);
      gate("work", st.pressCount >= 2);
      gate("spend", st.pressCount >= 2);
      gate("afford", st.crisisShown);
      for (const c of charts) {
        if (!c.root.hidden && (c.visible || force)) c.update(st.history, st.events, force);
      }
    },
  };
}
