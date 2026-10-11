import "./common.css";
import { XYChart, type Axis } from "../charts/xy";
import type { Town } from "./town";
import { inventButton, radioGroup, segmented, type Control } from "../ui/controls";
import { SCENARIOS, type ScenarioId } from "../model/scenarios";
import { h, setText, toggleClass } from "../ui/dom";
import { sound } from "../ui/sound";
import { icon, type IconName } from "../scene/icons";
import { HOUR_SECONDS } from "../scene/buildings";

/** The plate's caption line: "Fig. 3 · Same engine". */
export function plateHead(n: number | string, title: string, note?: string): HTMLElement {
  return h(
    "figcaption",
    { class: "plate__head" },
    h("span", { class: "plate__num" }, `Fig. ${n}`),
    h("span", { class: "plate__title" }, title),
    note ? h("span", { class: "plate__note" }, note) : null,
  );
}

/**
 * "One worker, one hour" — a tray that fills with icons over each scene hour. The goods tray
 * fills fast and full; the service tray shows the same small number every time.
 */
export class HourTray {
  readonly el: HTMLElement;
  private readonly grid: HTMLElement;
  private readonly countEl: HTMLElement;
  private readonly dial: HTMLElement;
  private icons: HTMLElement[] = [];
  private shown = -1;

  constructor(
    kind: "things" | "time",
    title: string,
    private iconName: IconName,
  ) {
    this.countEl = h("span", { class: "tray__count" });
    this.grid = h("div", { class: "tray__grid", "aria-hidden": "true" });
    this.dial = h("span", { class: "tray__dial", "aria-hidden": "true" });
    this.el = h(
      "div",
      { class: `tray tone-${kind}` },
      h("div", { class: "tray__head" }, this.dial, h("span", { class: "tray__title" }, title)),
      this.grid,
      this.countEl,
    );
  }


  /** `perHour` items per worker-hour; `clock` is scene seconds, so trays tick with the town. */
  update(perHour: number, clock: number, label: string): void {
    const n = Math.max(1, Math.round(perHour));
    const cap = Math.min(n, 32);
    while (this.icons.length < cap) {
      const cell = h("span", { class: "tray__item" }, icon(this.iconName));
      this.icons.push(cell);
      this.grid.append(cell);
    }
    while (this.icons.length > cap) this.icons.pop()?.remove();
    toggleClass(this.grid, "is-dense", cap > 16);
    toggleClass(this.grid, "is-packed", cap > 32);
    const phase = (clock / HOUR_SECONDS) % 1;
    const visible = Math.min(cap, Math.floor(phase * cap) + 1);
    if (visible !== this.shown) {
      this.icons.forEach((el, i) => toggleClass(el, "is-on", i < visible));
      this.shown = visible;
    }
    this.dial.style.setProperty("--p", String(phase));
    setText(this.countEl, label);
  }
}

export const DOUBLINGS = [0, 1, 2, 3, 4, 5] as const;

/** The x-axis every "after n machines" chart shares. */
export const DOUBLINGS_AXIS: Axis = { min: 0, max: 5, ticks: [...DOUBLINGS], format: String, label: "Machines invented" };

/** Price of the service in goods after each invention: 1 to 32 on a log scale. */
export function doublingsPriceChart(title: string): XYChart {
  return new XYChart(DOUBLINGS_AXIS, { min: 1, max: 32, log: true, ticks: [1, 2, 4, 8, 16, 32], format: String }, title);
}

/** The 0–5 "machines invented" stepper several figures share. */
export function machinesStepper(value: number, onChange: (n: number) => void, compact = false): Control<number> {
  return segmented({
    label: "Machines invented",
    options: DOUBLINGS.map((v) => ({ value: v, label: String(v) })),
    value,
    compact,
    onChange,
  });
}

/** A labelled number with an optional bar, coloured by tone. */
export function gauge(label: string, tone: "things" | "time" | "coin", unit: string, track = true) {
  const value = h("span", { class: "gauge__num" });
  const fill = h("span", { class: "gauge__fill" });
  const unitEl = h("span", { class: "gauge__unit" }, unit);
  const noteEl = h("span", { class: "gauge__note" });
  const el = h(
    "div",
    { class: `gauge tone-${tone}` },
    h("span", { class: "gauge__label" }, label),
    value,
    track ? h("span", { class: "gauge__track" }, fill) : null,
    unitEl,
    noteEl,
  );
  return {
    el,
    set(text: string, fraction = 0) {
      setText(value, text);
      fill.style.transform = `scaleX(${Math.max(0, Math.min(1, fraction)).toFixed(3)})`;
    },
    /** Change what the number means, plus an optional reference ("started at 0.8"). */
    describe(nextUnit: string, note = "") {
      setText(unitEl, nextUnit);
      setText(noteEl, note);
    },
  };
}

/**
 * The invent button, its pips and a reset link, bound to a town. The count is read off the
 * machine itself, so there is no separate counter to keep in step.
 */
export function inventControls(town: Town, o: { max: number; onInvent?: () => void; onReset?: () => void }) {
  const button = inventButton({
    max: o.max,
    doneLabel: "Machine perfected",
    onPress: () => {
      town.invent();
      showReset(true);
      button.setCount(town.inventions);
      sound.invent(town.inventions);
      o.onInvent?.();
    },
  });
  button.setCount(town.inventions);
  // "Start over" appears once there is something to start over from.
  const reset = h("button", { type: "button", class: "btn-ghost" });
  // Keep its space so the page doesn't jump when it appears.
  const showReset = (on: boolean) => (reset.style.visibility = on ? "visible" : "hidden");
  showReset(town.inventions > 0);
  reset.append("Start over");
  reset.addEventListener("click", () => {
    town.restart();
    showReset(false);
    button.setCount(0);
    sound.tick();
    o.onReset?.();
  });
  return { el: h("div", { class: "console__actions" }, button.el, reset), done: () => town.inventions >= o.max };
}

/**
 * Scenario chips: a radio group of icon pills. `null` leaves none chosen (Fig. 3 shows its
 * two headline scenarios in a separate toggle). Arrow keys move between chips.
 */
export function scenarioChips(ids: ScenarioId[], value: ScenarioId | null, onChange: (id: ScenarioId) => void): Control<ScenarioId | null> {
  const chips = ids.map((id) => {
    const sc = SCENARIOS[id];
    return h("button", { type: "button", class: "chip", "data-id": id }, icon(sc.service.icon), sc.domain);
  });
  const group = radioGroup(chips, ids, value, onChange);
  return { el: h("div", { class: "chips", role: "radiogroup", "aria-label": "Scenario" }, ...chips), set: group.set };
}
