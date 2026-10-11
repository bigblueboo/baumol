import "./minutes.css";
import { SCENARIOS, minutesPerUnit } from "../model/scenarios";
import { icon } from "../scene/icons";
import { animate } from "../ui/loop";
import { slider } from "../ui/controls";
import { h, s, setAttr, setText } from "../ui/dom";
import { count, minutes, num, quarters } from "../ui/format";
import { machinesStepper, plateHead } from "./common";

const START_WAGE_DOLLARS = 20;

/** A clock face with a wedge for "minutes of human work". */
function minuteDial(tone: "things" | "time") {
  const wedge = s("path", { class: `dial__wedge tone-${tone}` });
  const ticks = Array.from({ length: 12 }, (_, i) => {
    const a = (i / 12) * Math.PI * 2;
    return `M${50 + Math.sin(a) * 40} ${50 - Math.cos(a) * 40}L${50 + Math.sin(a) * 45} ${50 - Math.cos(a) * 45}`;
  }).join("");
  const el = s(
    "svg",
    { class: "dial", viewBox: "0 0 100 100", "aria-hidden": "true" },
    s("circle", { class: "dial__face", cx: 50, cy: 50, r: 46 }),
    wedge,
    s("path", { class: "dial__ticks", d: ticks }),
    s("circle", { class: "dial__pin", cx: 50, cy: 50, r: 2.5 }),
  );
  return {
    el,
    set(mins: number) {
      const f = Math.min(0.9999, mins / 60);
      const a = f * Math.PI * 2;
      const x = 50 + Math.sin(a) * 46;
      const y = 50 - Math.cos(a) * 46;
      setAttr(wedge, "d", `M50 50L50 4A46 46 0 ${f > 0.5 ? 1 : 0} 1 ${x.toFixed(2)} ${y.toFixed(2)}Z`);
    },
  };
}

/** Fig. 2: the same fact counted in hats, in minutes, and in money. */
export function mountMinutes(host: HTMLElement): void {
  const sc = SCENARIOS.hats;
  let n = 3;
  let shown = 3;
  let anchor = 0.5;

  const hatDial = minuteDial("things");
  const cutDial = minuteDial("time");
  const hatMin = h("span", { class: "dial-card__num tone-things" });
  const cutMin = h("span", { class: "dial-card__num tone-time" });
  const dialCard = (dial: SVGSVGElement, numEl: HTMLElement, iconName: "hat" | "scissors", label: string) =>
    h(
      "div",
      { class: "dial-card" },
      dial,
      h("div", { class: "dial-card__text" }, h("span", { class: "dial-card__label" }, icon(iconName), label), numEl, h("span", { class: "dial-card__unit" }, "of someone's working time")),
    );

  const eqHats = h("span", { class: "eq__num tone-things" });
  const eqCuts = h("span", { class: "eq__num tone-time" });
  const eqRatio = h("span", { class: "eq__num eq__num--result" });
  const eqMinHaircut = h("span", { class: "eq__num tone-time" });
  const eqMinHat = h("span", { class: "eq__num tone-things" });
  const eqUnit = h("span", { class: "eq__note" });
  const equation = h(
    "div",
    { class: "eq", role: "group", "aria-label": "The cost-disease identity" },
    h("div", { class: "eq__line" }, h("span", { class: "eq__term" }, "A haircut, in hats"), h("span", { class: "eq__op" }, "="), eqRatio),
    // The output ratio first: it's the one a reader can check in their head.
    h(
      "div",
      { class: "eq__line eq__line--sub" },
      h("span", { class: "eq__op" }, "="),
      h("span", { class: "eq__frac" }, eqHats, h("span", { class: "eq__bar" }), eqCuts),
      h("span", { class: "eq__note" }, "hats per hatter-hour over haircuts per barber-hour"),
    ),
    h(
      "div",
      { class: "eq__line eq__line--sub" },
      h("span", { class: "eq__op" }, "="),
      h("span", { class: "eq__frac" }, eqMinHaircut, h("span", { class: "eq__bar" }), eqMinHat),
      eqUnit,
    ),
  );

  const money = {
    wage: h("span", { class: "tagcard__num" }),
    hat: h("span", { class: "tagcard__num" }),
    cut: h("span", { class: "tagcard__num" }),
    wageDelta: h("span", { class: "tagcard__delta" }),
    hatDelta: h("span", { class: "tagcard__delta" }),
    cutDelta: h("span", { class: "tagcard__delta" }),
  };
  const tagcard = (label: string, numEl: HTMLElement, delta: HTMLElement, tone: string) =>
    h("div", { class: `tagcard tone-${tone}` }, h("span", { class: "tagcard__label" }, label), numEl, delta);
  const ratioLock = h("p", { class: "money__lock" });

  const stepper = machinesStepper(n, (v) => {
    n = v;
    paintNumbers();
    paintMoney();
  });
  const anchorSlider = slider({
    label: "What your money keeps steady",
    min: 0,
    max: 1,
    step: 0.01,
    value: anchor,
    format: (v) => (v < 0.05 ? "hat prices" : v > 0.95 ? "wages" : "a mix"),
    ends: ["Hat prices", "Wages"],
    onInput: (v) => {
      anchor = v;
      paintMoney();
    },
  });

  const delta = (now: number, then: number) => {
    const r = now / then;
    if (Math.abs(r - 1) < 0.02) return "unchanged";
    if (r > 1) return `↑ ${num(r)}× since the start`;
    // Shrinking prices read better as fractions: "a quarter of", "1/32 of".
    const inv = Math.round(1 / r);
    return Math.abs(1 / r - inv) < 0.05 ? `↓ to 1/${inv} of the start` : `↓ to ${num(r)}× the start`;
  };
  // Whole dollars from $10, dollars and cents from $1, plain cents below.
  const dollars = (v: number) => (v >= 10 ? `$${Math.round(v)}` : v >= 1 ? `$${v.toFixed(2)}` : `${Math.round(v * 100)}¢`);
  /** Minutes when they come out in whole quarters, otherwise seconds, so every fraction shown is exact. */
  function unitOf(mins: number): { scale: number; unit: string; per: string } {
    return Number.isInteger(mins * 4) ? { scale: 1, unit: "min", per: "minutes" } : { scale: 60, unit: "sec", per: "seconds" };
  }

  /** A duration in whichever unit makes it exact: "3¾ min", "56¼ sec". */
  function exactTime(mins: number): string {
    const u = unitOf(mins);
    if (u.scale === 1) return `${quarters(mins)} min`;
    const secs = mins * 60;
    return secs >= 60 ? `${Math.floor(secs / 60)} min ${quarters(secs % 60)} s` : `${quarters(secs)} s`;
  }

  function paintNumbers(): void {
    const hatNow = minutesPerUnit(sc, 2 ** n);
    const cutNow = minutesPerUnit(sc, 1);
    const u = unitOf(hatNow);
    setText(hatMin, exactTime(hatNow));
    setText(cutMin, `${quarters(cutNow)} min`);
    setText(eqHats, num(sc.perHour * 2 ** n));
    setText(eqCuts, num(sc.perHour));
    setText(eqRatio, count(2 ** n, "hat", "hats"));
    setText(eqMinHaircut, quarters(cutNow * u.scale));
    setText(eqMinHat, quarters(hatNow * u.scale));
    setText(eqUnit, `${u.per} per haircut over ${u.per} per hat`);
  }

  function paintMoney(): void {
    const g = 2 ** n;
    const wage = START_WAGE_DOLLARS * g ** (1 - anchor);
    const hat = wage / (sc.perHour * g);
    const cut = wage / sc.perHour;
    const base = { wage: START_WAGE_DOLLARS, hat: START_WAGE_DOLLARS / sc.perHour, cut: START_WAGE_DOLLARS / sc.perHour };
    setText(money.wage, `${dollars(wage)}/hr`);
    setText(money.hat, dollars(hat));
    setText(money.cut, dollars(cut));
    setText(money.wageDelta, delta(wage, base.wage));
    setText(money.hatDelta, delta(hat, base.hat));
    setText(money.cutDelta, delta(cut, base.cut));
    ratioLock.replaceChildren(
      icon("lock"),
      `A haircut ÷ a hat = ${num(cut / hat)}, wherever the slider sits. ` +
        (n === 0
          ? `Both take ${minutes(minutesPerUnit(sc, 1))} of human time.`
          : `A haircut still costs ${minutes(minutesPerUnit(sc, 1))} of human time; a hat now costs ${exactTime(minutesPerUnit(sc, 2 ** n))}.`),
    );
  }
  paintNumbers();
  paintMoney();

  host.append(
    plateHead(2, "One fact, counted three ways"),
    h("div", { class: "fig-controls" }, stepper.el),
    h("div", { class: "dials" }, dialCard(hatDial.el, hatMin, "hat", "A hat costs"), dialCard(cutDial.el, cutMin, "scissors", "A haircut costs")),
    equation,
    h(
      "div",
      { class: "money" },
      h("h3", { class: "money__title" }, "And in money?"),
      h("p", { class: "money__intro" }, "Money is a yardstick, and you can peg it to anything. Slide it and watch which prices appear to move."),
      anchorSlider.el,
      h("div", { class: "tagcards" }, tagcard("Wage", money.wage, money.wageDelta, "coin"), tagcard("A hat", money.hat, money.hatDelta, "things"), tagcard("A haircut", money.cut, money.cutDelta, "time")),
      ratioLock,
    ),
  );

  // Ease the dials toward the selected step so the wedge visibly shrinks.
  // Only the dials glide; the numbers change when the stepper does.
  animate(host, (dt) => {
    shown += (n - shown) * (1 - Math.exp(-dt * 7));
    if (Math.abs(n - shown) < 0.002) shown = n;
    hatDial.set(minutesPerUnit(sc, 2 ** shown));
    cutDial.set(minutesPerUnit(sc, 1));
  });
}
