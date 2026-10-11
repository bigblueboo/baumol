import "./basket.css";
import { settledAt } from "../model/economy";
import { makeParams } from "../model/params";
import { icon } from "../scene/icons";
import { SCENARIOS, calibrationOf } from "../model/scenarios";
import { h, setText } from "../ui/dom";
import { count, pct, times } from "../ui/format";
import { machinesStepper, plateHead } from "./common";

const MAX_ICONS = 32;

/** Fig. 5: an hour of work still buys an hour of care, plus ever more stuff. */
export function mountBasket(host: HTMLElement): void {
  const sc = SCENARIOS.care;
  const params = makeParams({ ...sc.defaults });
  const cal = calibrationOf(sc);
  const start = settledAt(params, cal, 0);

  const gadgetRow = h("div", { class: "basket__icons tone-things" });
  const careRow = h("div", { class: "basket__icons basket__icons--single tone-time" }, icon("heart"));
  const gadgetCount = h("span", { class: "basket__count tone-things" });
  const careCount = h("span", { class: "basket__count tone-time" });

  const bar = {
    care: h("span", { class: "split__seg split__seg--time" }),
    goods: h("span", { class: "split__seg split__seg--things" }),
  };
  const careShare = h("span", { class: "split__label tone-time" });
  const goodsShare = h("span", { class: "split__label tone-things" });
  const material = h("span", { class: "ratio__num tone-things" });
  const carePer = h("span", { class: "ratio__num tone-time" });
  const carers = h("span", { class: "ratio__num tone-time" });
  const carersLabel = h("span", { class: "ratio__label" });
  const paradox = h("p", { class: "paradox" });

  const paint = (n: number) => {
    const snap = settledAt(params, cal, n);
    // What the average hourly wage buys, spent entirely on one or the other.
    const gadgets = snap.averageWage;
    setText(careCount, count(snap.averageWage / snap.price, "care-hour", "care-hours"));
    gadgetRow.replaceChildren(...Array.from({ length: Math.min(MAX_ICONS, Math.round(gadgets)) }, () => icon("gadget")));
    gadgetRow.classList.toggle("is-dense", gadgets > 8);
    setText(gadgetCount, count(gadgets, "gadget", "gadgets"));
    const share = snap.serviceShare;
    bar.care.style.flexGrow = String(share);
    bar.goods.style.flexGrow = String(1 - share);
    setText(careShare, `Care ${pct(share)}`);
    setText(goodsShare, `Gadgets ${pct(1 - share)}`);
    const carePerCapita = snap.delivered / snap.population / (start.delivered / start.population);
    setText(material, times(snap.material));
    setText(carePer, times(carePerCapita));
    // More care per resident comes from more caregivers, not faster ones.
    setText(carers, `${Math.round(start.careWorkers)} → ${Math.round(snap.careWorkers)}`);
    setText(carersLabel, `of ${snap.population} townspeople work in care; each still gives one care-hour an hour`);
    setText(
      paradox,
      n === 0
        ? `At the start, ${pct(start.serviceShare)} of spending goes on care.`
        : `Care's slice of the budget went from ${pct(start.serviceShare)} to ${pct(share)}. Over the same years each resident got ${times(snap.material)} the stuff and ${times(carePerCapita)} the care.`,
    );
  };

  const stepper = machinesStepper(3, paint);

  host.append(
    plateHead(5, "What an hour of work buys"),
    h("div", { class: "fig-controls" }, stepper.el),
    h(
      "div",
      { class: "basket" },
      h("div", { class: "basket__side" }, h("span", { class: "basket__label" }, "One hour's wage buys"), gadgetRow, gadgetCount),
      h("span", { class: "basket__or" }, "or"),
      h("div", { class: "basket__side basket__side--time" }, h("span", { class: "basket__label" }, "One hour's wage buys"), careRow, careCount),
    ),
    h(
      "div",
      { class: "split" },
      h("span", { class: "split__title" }, "How the town spends its income"),
      h("div", { class: "split__bar" }, bar.care, bar.goods),
      h("div", { class: "split__labels" }, careShare, goodsShare),
    ),
    h(
      "div",
      { class: "ratios" },
      h("div", { class: "ratio" }, material, h("span", { class: "ratio__label" }, "gadgets per resident, vs. the start")),
      h("div", { class: "ratio" }, carePer, h("span", { class: "ratio__label" }, "care per resident, vs. the start")),
      h("div", { class: "ratio" }, carers, carersLabel),
    ),
    paradox,
    h(
      "p",
      { class: "plate__footnote" },
      "The shift toward care assumes residents won't swap care for gadgets. Fig. 7 shows what happens if they will.",
    ),
  );
  paint(3);
}
