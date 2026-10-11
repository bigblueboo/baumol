import "./cases.css";
import { XYChart } from "../charts/xy";
import { SCENARIOS } from "../model/scenarios";
import { icon } from "../scene/icons";
import { radioGroup } from "../ui/controls";
import { h, setText } from "../ui/dom";
import { capitalize, num, pct, plural, times } from "../ui/format";
import { CASES, CASE_GROWTH, recipeOf, runCase, type Case, type CaseRun } from "./casebook";
import { plateHead } from "./common";
import { openLab } from "./lab/opener";
import { PRICE_AXIS, RUN_YEARS, SHARE_AXIS, YEARS_AXIS, jobsMarks, priceMarks } from "./runCharts";

/** What the run shows, in a few plain sentences built from its numbers. */
function modelSummary(c: Case, { start, end }: CaseRun): string {
  const sc = SCENARIOS[c.scenario];
  const parts = [
    `Over ${RUN_YEARS} years the machine gets ${times(end.goodsTech / start.goodsTech)} as productive, and one ${sc.service.one} goes from ${num(start.price)} to ${num(end.price)} ${plural(end.price, sc.goods.one, sc.goods.many)}.`,
    `${capitalize(sc.service.worker.many)} go from ${pct(start.careWorkers / start.population)} to ${pct(end.careWorkers / end.population)} of the town's workers.`,
  ];
  const without = end.pricedOut + end.rationed;
  if (without > 0) {
    const why = end.pricedOut === 0 ? "" : end.pricedOut === without ? ", priced out" : `, ${end.pricedOut} of them priced out`;
    parts.push(`${without} of ${end.population} ${sc.clients.many} ${without === 1 ? "goes" : "go"} without${why}.`);
  }
  if (end.optedOut > 0) parts.push(`${end.optedOut} of ${end.population} ${end.optedOut === 1 ? "chooses" : "choose"} an alternative instead.`);
  if (end.presence < 0.97) parts.push(`${pct(1 - end.presence)} of the work is done by the ${sc.machine.one}.`);
  if (end.quality < 0.97) parts.push(`Quality slips to ${pct(end.quality)}.`);
  if (end.publicShare > 0.02) parts.push(`Public spending on it reaches ${pct(end.publicShare)} of income.`);
  if (end.waitDays >= 1) parts.push(`The wait reaches ${Math.round(end.waitDays)} days.`);
  return parts.join(" ");
}

/** Fig. 9: the same forty years in eight industries, each with what studies of the real one found. */
export function mountCases(host: HTMLElement): void {
  const priceChart = new XYChart(YEARS_AXIS, PRICE_AXIS, "");
  const jobsChart = new XYChart(YEARS_AXIS, SHARE_AXIS, "");
  const priceTitle = h("p", { class: "chart-title" });

  const title = h("h3", { class: "case__title" });
  const intuition = h("p", { class: "case__intuition" });
  const model = h("p", { class: "case__model" });
  const evidence = h("p", { class: "case__evidence" });
  const sources = h("ol", { class: "case__sources" });
  const labLink = h("a", { class: "case__lab", href: "#lab" }, "Open this industry in the lab →");
  const changesOverTime = h("span", { class: "case__lab-note" }, "It opens with the settings of year forty.");

  let current = CASES[0];
  labLink.addEventListener("click", (e) => {
    e.preventDefault();
    openLab(recipeOf(current));
  });

  // Runs are deterministic, so each industry is computed once and kept.
  const runs = new Map<Case, CaseRun>();
  const show = (c: Case) => {
    current = c;
    const sc = SCENARIOS[c.scenario];
    const run = runs.get(c) ?? runCase(c);
    runs.set(c, run);
    priceChart.update(priceMarks(run.samples));
    jobsChart.update(jobsMarks(run.samples, sc));
    priceChart.el.setAttribute("aria-label", `Price of one ${sc.service.one} in ${sc.goods.many} over ${RUN_YEARS} years`);
    jobsChart.el.setAttribute("aria-label", `Share of the town's workers who are ${sc.service.worker.many}, over ${RUN_YEARS} years`);
    setText(priceTitle, `One ${sc.service.one}, in ${sc.goods.many}`);
    setText(title, `${sc.domain}: ${sc.title}`);
    setText(intuition, c.intuition);
    setText(model, modelSummary(c, run));
    setText(evidence, c.evidence);
    sources.replaceChildren(...c.sources.map((s) => h("li", {}, `${s.authors} (${s.year}). `, h("a", { href: s.url }, s.title), `. ${s.outlet}.`)));
    // Only a case whose rules move needs telling that the lab freezes them.
    changesOverTime.hidden = JSON.stringify(c.rules(0)) === JSON.stringify(c.rules(RUN_YEARS));
  };

  const chips = CASES.map((c) => {
    const sc = SCENARIOS[c.scenario];
    return h("button", { type: "button", class: "chip" }, icon(sc.service.icon), sc.domain);
  });
  radioGroup(chips, CASES, current, show);

  host.append(
    plateHead(
      9,
      "Same disease, eight industries",
      `Each runs for ${RUN_YEARS} years with the machine improving ${pct(CASE_GROWTH)} a year. The shares are a toy's, meant to show direction rather than forecast magnitudes.`,
    ),
    h("div", { class: "case-picker" }, h("div", { class: "chips", role: "radiogroup", "aria-label": "Industry" }, ...chips)),
    h(
      "div",
      { class: "case" },
      h(
        "div",
        { class: "case__charts" },
        h("figure", { class: "case__chart" }, priceTitle, priceChart.el),
        h("figure", { class: "case__chart" }, h("p", { class: "chart-title" }, "Who works where"), jobsChart.el),
      ),
      h(
        "div",
        { class: "case__text" },
        title,
        h("p", { class: "case__label" }, "The intuition"),
        intuition,
        h("p", { class: "case__label" }, "What the model shows"),
        model,
        h("p", { class: "case__label" }, "What the evidence says"),
        evidence,
        sources,
        h("p", { class: "case__lab-row" }, labLink, changesOverTime),
      ),
    ),
  );
  show(current);
}
