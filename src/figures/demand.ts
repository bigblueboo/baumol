import "./demand.css";
import { XYChart, type Pt } from "../charts/xy";
import { settledAt } from "../model/economy";
import { RANGES, makeParams } from "../model/params";
import { WORDING } from "./lab/spec";
import { SCENARIOS, calibrationOf } from "../model/scenarios";
import { slider } from "../ui/controls";
import { h, setText } from "../ui/dom";
import { DOUBLINGS, DOUBLINGS_AXIS, doublingsPriceChart, plateHead } from "./common";


function substituteExample(sigma: number): string {
  if (sigma < 0.35) return "Like eldercare: nothing else will do.";
  if (sigma < 0.85) return "Like childcare or tutoring: alternatives exist, and they're worse.";
  if (sigma < 1.15) return "Indifferent: spending shares stay put.";
  return "Like concerts: for most people, a recording will do.";
}

const LAST = DOUBLINGS[5];

/** Fig. 7: the price claim and the employment claim, side by side, with only one of them moving. */
export function mountDemand(host: HTMLElement): void {
  const sc = SCENARIOS.care;
  const cal = calibrationOf(sc);
  let sigma = 0.5;
  let eta = 1;

  const priceChart = doublingsPriceChart("Price of a care-hour in gadgets");
  const jobsChart = new XYChart(
    DOUBLINGS_AXIS,
    { min: 0, max: 1, ticks: [0, 0.25, 0.5, 0.75, 1], format: (v) => `${Math.round(v * 100)}%` },
    "Share of workers in care",
  );
  const jobsNote = h("p", { class: "panel__note" });
  const example = h("p", { class: "ctl__example" });

  let pending = false;
  const paint = () => {
    pending = false;
    const params = makeParams({ substitutability: sigma, incomeSensitivity: eta, essentialFloor: 0 });
    // Endpoints first, middle after: every doubling is settled once, and both ends are typed.
    const first = settledAt(params, cal, 0);
    const last = settledAt(params, cal, LAST);
    const snaps = [first, ...DOUBLINGS.slice(1, -1).map((d) => settledAt(params, cal, d)), last];
    const price: Pt[] = snaps.map((s, i) => [i, s.price]);
    const share: Pt[] = snaps.map((s, i) => [i, s.careWorkers / s.population]);
    priceChart.update([{ kind: "line", points: price, tone: "time", label: "care-hour" }]);
    jobsChart.update([
      { kind: "band", lower: share.map(([x]) => [x, 0]), upper: share, tone: "time", label: "care" },
      { kind: "band", lower: share, upper: share.map(([x]) => [x, 1]), tone: "things", label: "factory" },
    ]);
    setText(jobsNote, `After five machines, ${Math.round(last.careWorkers)} of ${last.population} townspeople work in care. At the start it was ${Math.round(first.careWorkers)}.`);
    setText(example, substituteExample(sigma));
  };
  const schedule = () => {
    if (pending) return;
    pending = true;
    requestAnimationFrame(paint);
  };

  const sigmaSlider = slider({
    ...WORDING.substitutability,
    min: RANGES.substitutability[0],
    max: RANGES.substitutability[1],
    step: 0.05,
    value: sigma,
    onInput: (v) => {
      sigma = v;
      schedule();
    },
  });
  const etaSlider = slider({
    ...WORDING.incomeSensitivity,
    min: 0.5,
    max: 1.8,
    step: 0.05,
    value: eta,
    onInput: (v) => {
      eta = v;
      schedule();
    },
  });

  host.append(
    plateHead(7, "Two claims, one of which needs an assumption"),
    h("div", { class: "fig-controls fig-controls--pair" }, h("div", {}, sigmaSlider.el, example), etaSlider.el),
    h(
      "div",
      { class: "panels" },
      h(
        "section",
        { class: "panel" },
        h("h3", { class: "panel__title" }, h("span", { class: "panel__num" }, "1"), "Cost disease"),
        h("p", { class: "panel__sub" }, "A care-hour's price, in gadgets"),
        priceChart.el,
        h("p", { class: "panel__note panel__note--locked" }, "Set by production and wages. The sliders can't reach it."),
      ),
      h(
        "section",
        { class: "panel" },
        h("h3", { class: "panel__title" }, h("span", { class: "panel__num" }, "2"), "Structural change"),
        h("p", { class: "panel__sub" }, "Where the town's workers end up"),
        jobsChart.el,
        jobsNote,
      ),
    ),
  );
  paint();
}
