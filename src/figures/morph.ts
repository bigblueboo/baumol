import "./morph.css";
import { settledAt, settledState } from "../model/economy";
import { makeParams } from "../model/params";
import { SCENARIOS, SCENARIO_IDS, calibrationOf, type Scenario, type ScenarioId } from "../model/scenarios";
import { segmented } from "../ui/controls";
import { h, restartAnimation, setText } from "../ui/dom";
import { num, plural } from "../ui/format";
import { steadyCourse } from "../sim/townSim";
import { DOUBLINGS, doublingsPriceChart, machinesStepper, plateHead, scenarioChips } from "./common";
import { Town, WARMUP_TOWN, steady } from "./town";


const START_INVENTIONS = 3;
const PAIR: ScenarioId[] = ["hats", "care"];

/** Fig. 3: swap the skin, keep the engine. The chart must not move, and it doesn't. */
export function mountMorph(host: HTMLElement): void {
  let sc: Scenario = SCENARIOS.hats;
  let n = START_INVENTIONS;
  const params = makeParams({ mobility: 0.9, trainingYears: 0 });
  const town = new Town(host, {
    scenario: sc,
    course: steadyCourse(params),
    title: "The same town, re-skinned",
    population: WARMUP_TOWN,
    state: settledState(params, calibrationOf(sc, WARMUP_TOWN), n),
    pace: steady(0.55),
  });

  const chart = doublingsPriceChart("Price of the service, in goods, after each invention");
  const chartTitle = h("p", { class: "chart-title" });
  const stamp = h("span", { class: "same-stamp", "aria-hidden": "true" }, "Unchanged");
  const transfer = h("p", { class: "chart-caption" });

  const paintChart = () => {
    const prices = DOUBLINGS.map((d) => settledAt(params, calibrationOf(sc, WARMUP_TOWN), d).price);
    chart.update([{ kind: "line", points: prices.map((p, d) => [d, p] as const), tone: "time", label: sc.service.many }]);
    const now = prices[n] ?? 1;
    const goods = plural(now, sc.goods.one, sc.goods.many);
    chart.setCursor(n, `${num(now)} ${goods}`);
    setText(chartTitle, `Price of one ${sc.service.one}, in ${sc.goods.many}`);
    setText(
      transfer,
      `${sc.domain}: after ${n} ${plural(n, "machine", "machines")}, one ${sc.service.one} costs ${num(now)} ${goods}. Wages on the board are counted in each town's own goods, so they differ; the ratio doesn't.`,
    );
  };

  // Two controls share one choice: the headline pair, and chips for everywhere else. Whichever
  // isn't holding the current scenario shows nothing chosen.
  const swap = (id: ScenarioId) => {
    if (id === sc.id) return;
    sc = SCENARIOS[id];
    town.reskin(sc, steadyCourse(params));
    paintChart();
    const inPair = PAIR.includes(id);
    pair.set(inPair ? id : null);
    elsewhere.set(inPair ? null : id);
    restartAnimation(stamp, "is-stamped");
  };

  const pair = segmented<ScenarioId>({
    label: "Setting",
    options: [
      { value: "hats", label: "Hats & haircuts" },
      { value: "care", label: "Things & care" },
    ],
    value: "hats",
    onChange: swap,
  });
  const elsewhere = scenarioChips(
    SCENARIO_IDS.filter((id) => !PAIR.includes(id)),
    null,
    (id) => {
      swap(id);
      // On a phone the chips sit below the town; bring the change into view.
      if (town.frame.getBoundingClientRect().bottom < 0) town.frame.scrollIntoView({ behavior: "smooth", block: "start" });
    },
  );
  const stepper = machinesStepper(
    n,
    (v) => {
      n = v;
      town.setGoodsTarget(2 ** v);
      paintChart();
    },
    true,
  );

  paintChart();
  host.append(
    plateHead(3, "Change the buildings, keep the arithmetic"),
    h("div", { class: "morph__controls" }, h("div", { class: "morph__pair" }, pair.el), stepper.el),
    h(
      "div",
      { class: "morph" },
      h("div", { class: "morph__scene" }, town.frame),
      h("div", { class: "morph__chart" }, chartTitle, h("div", { class: "chart-box" }, chart.el, stamp), transfer),
    ),
    h("div", { class: "morph__more" }, h("span", { class: "morph__more-label" }, "The same engine, elsewhere:"), elsewhere.el),
  );
}
