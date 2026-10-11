import { settledAt, type Snapshot } from "../model/economy";
import { makeParams } from "../model/params";
import { SCENARIOS, calibrationOf } from "../model/scenarios";
import { steadyCourse } from "../sim/townSim";
import { h } from "../ui/dom";
import { count, num } from "../ui/format";
import { sound } from "../ui/sound";
import { HourTray, inventControls, plateHead } from "./common";
import { createStory, type Beat } from "./story";
import { Town, WARMUP_TOWN, steady } from "./town";

const MAX_INVENTIONS = 5;
const YEARS_PER_SECOND = 0.55;

/** The gap counts as open once the barbers earn this much less than the hatters. */
const GAP_OPEN = 0.9;
/** How close to the new resting point each number must be before the story calls it settled. */
const ADOPTED = 0.995;
const PARITY = 0.005;
const FEW_VACANCIES = 0.15;

/**
 * Which beat of the causal chain the town is in, read straight off the model:
 * 0 the machine speeds up, 1 the wage gap opens (the shop hasn't moved), 2 the shop is
 * revising pay, 3 everything has settled.
 */
function beatOf(snap: Snapshot): number {
  const { goodsTech, goodsTarget, wageRatio, vacancies } = snap;
  if (goodsTech > goodsTarget * ADOPTED && Math.abs(wageRatio - 1) < PARITY && vacancies < FEW_VACANCIES) return 3;
  if (snap.revisingPay) return 2;
  return wageRatio < GAP_OPEN ? 1 : 0;
}

/**
 * Fig. 1: the warm-up. One button, and the causal chain narrated as it happens:
 * the machine speeds up, the wage gap opens, barbers walk, the shop answers.
 */
export function mountHats(host: HTMLElement): void {
  const sc = SCENARIOS.hats;
  const params = makeParams({ mobility: 0.9, trainingYears: 0 });
  const hatTray = new HourTray("things", "One hatter, one hour", "hat");
  const cutTray = new HourTray("time", "One barber, one hour", "scissors");
  let clock = 0;

  const town = new Town(host, {
    scenario: sc,
    course: steadyCourse(params),
    population: WARMUP_TOWN,
    title: "A town with a hat works on the left, a barbershop on the right, and a noticeboard of wages between them",
    pace: steady(YEARS_PER_SECOND),
    onFrame: (_snap, dt) => {
      clock += dt;
      hatTray.update(hats(), clock, `${num(hats())} hats`);
      cutTray.update(sc.perHour, clock, count(sc.perHour, "haircut", "haircuts"));
      if (story.update(beatOf(town.snap), dt) === "settled") {
        logUpTo(town.inventions);
        sound.settle();
      }
    },
  });

  const hats = () => town.snap.goodsTech * sc.perHour;
  /** The barbershop's pay when the machine improved: what "still pays" refers to. */
  let payAtPress = 1;
  const wage = (w: number) => num(w * sc.perHour);
  const price = () => count(town.snap.price, "hat", "hats");
  const beats: Beat[] = [
    {
      title: "The press speeds up",
      text: () => `One hatter now makes ${num(hats())} hats an hour. The barber still gives two haircuts an hour.`,
    },
    {
      title: "The wage gap opens",
      text: () =>
        `A hatter now earns ${wage(town.snap.factoryWage)} hats an hour. The barbershop still pays ${wage(payAtPress)}. Barbers start drifting across the street.`,
    },
    {
      title: "The shop answers",
      text: () =>
        `Short of barbers, the shop raises its wage to ${wage(town.snap.careWage)} hats an hour, and to pay it, its price to ${price()} a haircut.`,
    },
    {
      title: "A new normal",
      text: () => `The barbers are back. A haircut now costs ${price()}. It still takes thirty minutes.`,
    },
  ];
  const story = createStory(beats, () => "Both jobs pay two hats an hour, so a haircut costs one hat. Press the button.");

  // The ledger records where each invention leaves the town once it has settled, straight from
  // the model's resting state, one row per machine even if the reader pressed again mid-way.
  const ledgerBody = h("tbody");
  let logged = -1;
  const logUpTo = (n: number) => {
    while (logged < n) {
      logged++;
      const rest = settledAt(params, calibrationOf(sc, WARMUP_TOWN), logged);
      ledgerBody.append(
        h(
          "tr",
          { class: "ledger__row" },
          h("th", { scope: "row" }, logged === 0 ? "Start" : `#${logged}`),
          h("td", { class: "tone-things" }, num(rest.goodsTech * sc.perHour)),
          h("td", { class: "tone-time" }, num(rest.serviceTech * sc.perHour)),
          h("td", { class: "tone-coin" }, num(rest.careWage * sc.perHour)),
          h("td", { class: "is-strong" }, num(rest.price)),
        ),
      );
    }
  };
  const columns = ["", "Hats/hr", "Cuts/hr", "Wage", "Price"];
  const ledger = h(
    "table",
    { class: "ledger" },
    h(
      "caption",
      { class: "ledger__caption" },
      "Each machine, once the town settles: hats a hatter makes per hour, haircuts a barber gives per hour, the wage in hats per hour, and a haircut's price in hats.",
    ),
    h("thead", {}, h("tr", {}, ...columns.map((c) => h("th", { scope: "col" }, c)))),
    ledgerBody,
  );
  logUpTo(0);

  const doneNote = h("p", { class: "plate__aside" }, "That's as far as this press goes. The haircut is unchanged.");
  const controls = inventControls(town, {
    max: MAX_INVENTIONS,
    onInvent: () => {
      payAtPress = town.snap.careWage;
      story.start();
      doneNote.classList.toggle("is-on", controls.done());
    },
    onReset: () => {
      story.reset();
      ledgerBody.replaceChildren();
      logged = -1;
      logUpTo(0);
      doneNote.classList.remove("is-on");
    },
  });

  host.append(
    plateHead(1, "The hat works and the barbershop"),
    h(
      "div",
      { class: "stage-stack" },
      town.frame,
      h("div", { class: "trays" }, hatTray.el, cutTray.el),
      h("div", { class: "console" }, controls.el, story.el),
    ),
    doneNote,
    h("div", { class: "ledger-wrap" }, ledger),
  );
}
