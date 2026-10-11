import { h, restartAnimation } from "./dom";
import { icon } from "../scene/icons";
import { sound } from "./sound";

export interface Control<T> {
  el: HTMLElement;
  set(value: T): void;
}

let uid = 0;
const nextId = (p: string) => `${p}-${++uid}`;

export function slider(o: {
  label: string;
  min: number;
  max: number;
  step: number;
  value: number;
  format: (v: number) => string;
  ends?: [string, string];
  onInput: (v: number) => void;
}): Control<number> {
  const id = nextId("slider");
  const out = h("output", { class: "ctl__value", for: id });
  const input = h("input", { id, class: "ctl__range", type: "range", min: o.min, max: o.max, step: o.step });
  const paint = (v: number) => {
    out.textContent = o.format(v);
    input.style.setProperty("--fill", `${((v - o.min) / (o.max - o.min)) * 100}%`);
    input.setAttribute("aria-valuetext", o.format(v));
  };
  input.value = String(o.value);
  paint(o.value);
  input.addEventListener("input", () => {
    const v = Number(input.value);
    paint(v);
    o.onInput(v);
  });
  const el = h(
    "div",
    { class: "ctl ctl--slider" },
    h("div", { class: "ctl__row" }, h("label", { class: "ctl__label", for: id }, o.label), out),
    input,
    o.ends ? h("div", { class: "ctl__ends", "aria-hidden": "true" }, h("span", {}, o.ends[0]), h("span", {}, o.ends[1])) : null,
  );
  return {
    el,
    set(v) {
      input.value = String(v);
      paint(v);
    },
  };
}

export interface Option<T> {
  value: T;
  label: string;
}

/**
 * Keyboard and ARIA wiring for a row of buttons acting as one choice: radio roles, a roving
 * tab stop, arrow keys, and a click that only reports real changes. `null` means nothing is
 * chosen (when the choice lives in another control).
 */
export function radioGroup<T>(buttons: HTMLElement[], values: readonly T[], value: T | null, onChange: (v: T) => void): { set(v: T | null): void } {
  let current = value;
  const paint = () =>
    buttons.forEach((b, i) => {
      const on = values[i] === current;
      b.setAttribute("role", "radio");
      b.setAttribute("aria-checked", String(on));
      b.tabIndex = on || (current === null && i === 0) ? 0 : -1;
    });
  const choose = (i: number, focus: boolean) => {
    const v = values[i];
    if (v === undefined) return;
    if (focus) buttons[i]?.focus();
    if (v === current) return;
    current = v;
    paint();
    sound.tick();
    onChange(v);
  };
  buttons.forEach((b, i) => {
    b.addEventListener("click", () => choose(i, false));
    b.addEventListener("keydown", (e) => {
      const delta = e.key === "ArrowRight" || e.key === "ArrowDown" ? 1 : e.key === "ArrowLeft" || e.key === "ArrowUp" ? -1 : 0;
      if (!delta) return;
      e.preventDefault();
      choose((i + delta + buttons.length) % buttons.length, true);
    });
  });
  paint();
  return {
    set(v) {
      current = v;
      paint();
    },
  };
}

/** A pill-shaped radio group with a visible label. */
export function segmented<T extends string | number>(o: {
  label: string;
  options: Option<T>[];
  value: T | null;
  onChange: (v: T) => void;
  compact?: boolean;
}): Control<T | null> {
  const labelId = nextId("seg");
  const buttons = o.options.map((opt) => h("button", { type: "button", class: "seg__opt" }, opt.label));
  const group = radioGroup(
    buttons,
    o.options.map((opt) => opt.value),
    o.value,
    o.onChange,
  );
  const el = h(
    "div",
    { class: `ctl ctl--seg${o.compact ? " ctl--compact" : ""}` },
    h("span", { class: "ctl__label", id: labelId }, o.label),
    h("div", { class: "seg", role: "radiogroup", "aria-labelledby": labelId }, ...buttons),
  );
  return { el, set: group.set };
}

export function toggle(o: { label: string; value: boolean; onChange: (v: boolean) => void; hint?: string }): Control<boolean> {
  let on = o.value;
  const btn = h(
    "button",
    { type: "button", class: "switch", role: "switch" },
    h("span", { class: "switch__track", "aria-hidden": "true" }, h("span", { class: "switch__thumb" })),
    h("span", { class: "switch__label" }, o.label),
  );
  const paint = () => btn.setAttribute("aria-checked", String(on));
  btn.addEventListener("click", () => {
    on = !on;
    paint();
    sound.tick();
    o.onChange(on);
  });
  paint();
  const el = h("div", { class: "ctl ctl--switch" }, btn, o.hint ? h("p", { class: "ctl__hint" }, o.hint) : null);
  return {
    el,
    set(v) {
      on = v;
      paint();
    },
  };
}

/** The big button. Pips under it count inventions so far. */
export function inventButton(o: { max: number; onPress: () => void; doneLabel: string }): {
  el: HTMLElement;
  setCount(n: number): void;
} {
  const label = "Invent a better machine";
  const gear = icon("gear", "invent__gear");
  const text = h("span", { class: "invent__label" }, label);
  const button = h("button", { type: "button", class: "invent" }, gear, text);
  const pips = Array.from({ length: o.max }, () => h("span", { class: "invent__pip" }));
  button.addEventListener("click", () => {
    restartAnimation(gear, "is-turning");
    o.onPress();
  });
  return {
    el: h("div", { class: "invent-wrap" }, button, h("span", { class: "invent__pips", "aria-hidden": "true" }, ...pips)),
    setCount(n) {
      const done = n >= o.max;
      pips.forEach((p, i) => p.classList.toggle("is-on", i < n));
      button.disabled = done;
      text.textContent = done ? o.doneLabel : label;
      button.setAttribute("aria-label", done ? o.doneLabel : `${label} (${n} of ${o.max} so far)`);
    },
  };
}
