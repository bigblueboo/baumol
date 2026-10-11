import "./choices.css";
import type { Snapshot } from "../model/economy";
import { makeParams, type Params } from "../model/params";
import { SCENARIOS, calibrationOf } from "../model/scenarios";
import { TownSim, type Course } from "../sim/townSim";
import { radioGroup } from "../ui/controls";
import { h, setText } from "../ui/dom";
import { sound } from "../ui/sound";
import { plateHead } from "./common";
import { METRICS, metricsPanel, type MetricKey } from "./metrics";
import { Town, steady } from "./town";

const YEARS = 12;
const YEARS_PER_SECOND = 1.5;
/** The machine improves eightfold over the first ten years, then holds while the town settles. */
const GROWTH_YEARS = 10;
const GROWTH = 8 ** (1 / GROWTH_YEARS) - 1;
/** Gains tilted a little toward the top, so paying at the counter leaves some households out. */
const CONCENTRATION = 0.3;
/** A result this much worse than simply paying gets marked. */
const WORSE_BY = 0.08;
const WORSE_SLACK = 0.005;

type ResponseId = "pay" | "cap" | "caseload" | "substitute" | "less" | "public" | "invest";

interface Response {
  id: ResponseId;
  title: string;
  blurb: string;
  params: Partial<Params>;
  /** Caseload and automation reached by year twelve, phased in rather than imposed on day one. */
  ramp: Pick<Params, "caseload" | "automation">;
}

const NO_RAMP = { caseload: 1, automation: 0 };

const PAY: Response = { id: "pay", title: "Pay the higher price", blurb: "Households pay what care costs.", params: {}, ramp: NO_RAMP };
const RESPONSES: Response[] = [
  PAY,
  { id: "cap", title: "Cap wages and prices", blurb: "Care wages may rise 1% a year, no more.", params: { wageCap: true }, ramp: NO_RAMP },
  { id: "caseload", title: "Raise caseloads", blurb: "Each caregiver looks after more residents.", params: {}, ramp: { ...NO_RAMP, caseload: 2.5 } },
  { id: "substitute", title: "Substitute machines", blurb: "Care robots take over 60% of the hours.", params: {}, ramp: { ...NO_RAMP, automation: 0.6 } },
  { id: "less", title: "Buy less care", blurb: "Hold care spending where it was.", params: { budgetFrozen: true }, ramp: NO_RAMP },
  { id: "public", title: "Provide it publicly", blurb: "Free at the door, paid from taxes.", params: { funding: "public" }, ramp: NO_RAMP },
  {
    id: "invest",
    title: "Invest in care technology",
    blurb: "An assumption, not a lever: tools let each caregiver do 6% more a year.",
    params: { serviceGrowth: 0.06 },
    ramp: NO_RAMP,
  },
];

const REPORT_KEYS: MetricKey[] = ["price", "coverage", "wait", "quality", "public", "material"];
const REPORT = METRICS.filter((m) => REPORT_KEYS.includes(m.key));

function isWorse(better: "low" | "high" | null, v: number, ref: number): boolean {
  if (better === "low") return v > ref * (1 + WORSE_BY) + WORSE_SLACK;
  if (better === "high") return v < ref * (1 - WORSE_BY) - WORSE_SLACK;
  return false;
}

const SCENARIO = SCENARIOS.care;
const BASE = makeParams({ ...SCENARIO.defaults, concentration: CONCENTRATION });

/**
 * A response as a twelve-year course: its rules at each moment, with any ramp phased in.
 * Plain object spread rather than a schema parse: this runs every fixed step, and every
 * ramp stays inside the ranges BASE was validated against.
 */
function courseOf(r: Response): Course {
  return {
    years: YEARS,
    rules: (t) => {
      const k = Math.min(1, t / YEARS);
      return {
        ...BASE,
        goodsGrowth: t < GROWTH_YEARS ? GROWTH : 0,
        ...r.params,
        caseload: 1 + (r.ramp.caseload - 1) * k,
        automation: r.ramp.automation * k,
      };
    },
  };
}

/** Run a response to year twelve off-screen; the same course, so the same result as on screen. */
function runHeadless(r: Response): Snapshot {
  const sim = new TownSim(courseOf(r), calibrationOf(SCENARIO));
  sim.advance(YEARS);
  return sim.snap;
}

/** Fig. 6: seven ways a town can respond, each run for twelve years. */
export function mountChoices(host: HTMLElement): void {
  const sc = SCENARIO;
  let response = PAY;
  // Every outcome is known up front (same course, same result); a row joins the report card
  // once the reader has watched that run end. Paying is the yardstick, so it starts there.
  const payOutcome = runHeadless(PAY);
  const runs = RESPONSES.map((r) => ({ response: r, outcome: r === PAY ? payOutcome : runHeadless(r) }));
  const shown = new Set<ResponseId>(["pay"]);
  const metrics = metricsPanel(sc);

  const yearLabel = h("span", { class: "runbar__year" });
  const activeBlurb = h("p", { class: "choices__active" });
  const fill = h("span", { class: "runbar__fill" });

  const town = new Town(host, {
    scenario: sc,
    course: courseOf(PAY),
    queue: true,
    title: "The care town over twelve years under the chosen response",
    pace: steady(YEARS_PER_SECOND),
    onFrame: (snap) => {
      if (town.done && !shown.has(response.id)) reveal(response.id);
      metrics.update(snap);
      setText(yearLabel, town.done ? `Year ${YEARS} · done` : `Year ${Math.floor(town.year)}`);
      fill.style.transform = `scaleX(${(town.year / YEARS).toFixed(3)})`;
    },
  });

  const cards = RESPONSES.map((r) =>
    h(
      "button",
      { type: "button", class: `choice${r.id === "pay" ? " is-tried" : ""}`, "data-id": r.id },
      h("span", { class: "choice__title" }, r.title),
      h("span", { class: "choice__blurb" }, r.blurb),
      h("span", { class: "choice__done", "aria-hidden": "true" }, "✓"),
    ),
  );
  const picker = radioGroup(cards, RESPONSES, PAY, (r) => {
    run(r);
    // On a phone the cards fill the screen; bring the town into view so the run is seen.
    if (town.frame.getBoundingClientRect().top > window.innerHeight * 0.6) town.frame.scrollIntoView({ behavior: "smooth", block: "center" });
  });

  const reportBody = h("tbody");
  const reportWrap = h(
    "div",
    { class: "ledger-wrap report-wrap" },
    h(
      "table",
      { class: "ledger report" },
      h("caption", { class: "report__caption" }, "Report card after twelve years. Red marks a result worse than simply paying."),
      h("thead", {}, h("tr", {}, h("th", { scope: "col" }, "Response"), ...REPORT.map((m) => h("th", { scope: "col" }, m.label(sc))))),
      reportBody,
    ),
  );

  function paintReport(): void {
    const rows = runs.flatMap(({ response: r, outcome: s }) => {
      if (!shown.has(r.id)) return [];
      const cells = REPORT.map((m) =>
        h("td", { class: isWorse(m.better, m.raw(s), m.raw(payOutcome)) ? "is-worse" : "", "data-label": m.label(sc) }, m.value(s, sc)),
      );
      return [h("tr", { class: `ledger__row${r.id === response.id ? " is-current" : ""}` }, h("th", { scope: "row" }, r.title), ...cells)];
    });
    reportBody.replaceChildren(...rows);
  }

  function reveal(id: ResponseId): void {
    shown.add(id);
    cards.find((c) => c.dataset.id === id)?.classList.add("is-tried");
    paintReport();
    sound.settle();
  }

  function run(r: Response): void {
    response = r;
    town.configure(courseOf(r));
    town.restart();
    picker.set(r);
    setText(activeBlurb, `${r.title}: ${r.blurb}`);
    paintReport();
  }

  const replay = h("button", { type: "button", class: "btn-ghost" }, "Run again");
  replay.addEventListener("click", () => run(response));

  host.append(
    plateHead(6, "Something has to give", "The machine improves eightfold over ten years, and its gains lean a little toward the better-off. Choose how the town responds, then watch twelve years."),
    h("div", { class: "choices", role: "radiogroup", "aria-label": "How the town responds" }, ...cards),
    town.frame,
    h("div", { class: "runbar" }, h("span", { class: "runbar__track" }, fill), yearLabel, replay),
    activeBlurb,
    metrics.el,
    reportWrap,
  );
  run(response);
}
