import type { Scenario } from "../model/scenarios";
import { h, restartAnimation, s, setText, toggleClass } from "../ui/dom";
import { num } from "../ui/format";
import { icon, iconGroup } from "./icons";
import { LAYOUT, type Composition } from "./layout";
import { rulesLine, type ReadoutModel } from "./signals";

/** Wages and the service price, shown either on the noticeboard or, on phones, as a strip. */
export interface Readout {
  /** Put the readout in place: into the drawing's layer, or under the drawing in its wrapper. */
  mount(layer: SVGGElement, wrap: HTMLElement): void;
  /** Take it away again when the scenario changes. Art inside the old layer folds away with it. */
  unmount(): void;
  update(m: ReadoutModel): void;
}

/** Swap a value's text, flipping its card only when the whole-number part changes. */
function flipper() {
  let whole = NaN;
  return (t: Element, value: number) => {
    const text = num(value);
    if (t.textContent === text) return;
    t.textContent = text;
    if (Math.floor(value) === whole) return;
    whole = Math.floor(value);
    restartAnimation(t, "is-flipping");
  };
}

/** The town noticeboard between the two buildings: two wages and one price. */
function drawBoard(sc: Scenario): Readout {
  const { left, right, top, bottom } = LAYOUT.board;
  const w = right - left;
  const goodsWage = s("text", { class: "board__num tone-things", x: right - 14, y: top + 64 });
  const serviceWage = s("text", { class: "board__num tone-time", x: right - 14, y: top + 116 });
  const priceNum = s("text", { class: "tag__num", x: 0, y: 6 });
  // Institutions in force, as one status line along the board's foot.
  const status = s("text", { class: "board__status", x: left + w / 2, y: bottom - 9 });
  // A bracket between the two wages while they differ: the gap that sends people walking.
  const gapText = s("text", { class: "gap__text", x: right + 10, y: top + 86 });
  const gap = s(
    "g",
    { class: "gap" },
    s("path", { class: "gap__bracket", d: `M${right + 2} ${top + 52}h5v46h-5` }),
    gapText,
  );
  const tag = s(
    "g",
    { class: "tag" },
    s("path", { class: "tag__string", d: "M-40 -30L0 -46L40 -30" }),
    s("path", { class: "tag__card", d: "M-66 -30h132v44h-132z" }),
    iconGroup(sc.service.icon, -60, -20, 24, "tag__icon tone-time"),
    s("text", { class: "tag__eq", x: -26, y: 6 }, "="),
    priceNum,
    iconGroup(sc.goods.icon, 36, -20, 24, "tag__icon tone-things"),
  );
  const el = s(
    "g",
    { class: "board" },
    s("path", { class: "board__post", d: `M${left + 18} ${bottom}V${LAYOUT.groundY}M${right - 18} ${bottom}V${LAYOUT.groundY}` }),
    s("rect", { class: "board__panel", x: left, y: top, width: w, height: bottom - top, rx: 3 }),
    s("text", { class: "board__title", x: left + w / 2, y: top + 19 }, "WAGE PER HOUR"),
    s("path", { class: "board__rule", d: `M${left + 12} ${top + 28}H${right - 12}M${left + 12} ${top + 80}H${right - 12}` }),
    iconGroup(sc.goods.icon, left + 12, top + 38, 30, "board__icon tone-things"),
    goodsWage,
    iconGroup(sc.service.icon, left + 12, top + 90, 30, "board__icon tone-time"),
    serviceWage,
    s("path", { class: "board__rule", d: `M${left + 12} ${bottom - 26}H${right - 12}` }),
    status,
    gap,
    s("g", { transform: `translate(${left + w / 2} ${bottom + 48})` }, tag),
  );
  const flipGoods = flipper();
  const flipService = flipper();
  return {
    mount: (layer) => layer.append(el),
    unmount: () => undefined,
    update(m) {
      flipGoods(goodsWage, m.goodsWage);
      flipService(serviceWage, m.serviceWage);
      const price = num(m.price);
      if (priceNum.textContent !== price) {
        priceNum.textContent = price;
        restartAnimation(tag, "is-swinging");
      }
      setText(status, rulesLine(m.rules));
      toggleClass(status, "is-alert", m.rules.length > 0);
      // A gap that rounds to nothing isn't worth a bracket.
      const shown = m.gap !== null && num(m.gap) !== "0";
      toggleClass(gap, "is-on", shown);
      if (m.gap !== null) setText(gapText, `gap ${num(m.gap)}`);
    },
  };
}

/** The noticeboard's numbers as an HTML strip under the drawing, for the compact composition. */
function drawStrip(sc: Scenario): Readout {
  const gw = h("strong", {});
  const sw = h("strong", {});
  const pr = h("strong", {});
  const rules = h("span", { class: "town-strip__rules" });
  const el = h(
    "div",
    { class: "town-strip" },
    h("span", { class: "town-strip__item tone-things" }, h("small", {}, `${sc.goods.worker.one} pay`), gw, icon(sc.goods.icon), h("small", {}, "/hr")),
    h("span", { class: "town-strip__item tone-time" }, h("small", {}, `${sc.service.worker.one} pay`), sw, icon(sc.goods.icon), h("small", {}, "/hr")),
    h("span", { class: "town-strip__item town-strip__item--price" }, icon(sc.service.icon), "=", pr, icon(sc.goods.icon)),
    rules,
  );
  return {
    mount: (_layer, wrap) => wrap.append(el),
    unmount: () => el.remove(),
    update(m) {
      setText(gw, num(m.goodsWage));
      setText(sw, num(m.serviceWage));
      setText(pr, num(m.price));
      setText(rules, m.rules.length ? m.rules.join(" · ") : "");
    },
  };
}

export const READOUTS: Record<Composition["readout"], (sc: Scenario) => Readout> = { board: drawBoard, strip: drawStrip };
