/**
 * The town ledger — seven readouts that update in place. Text nodes only
 * change when their formatted value changes.
 */

import type { AppStore } from "../app/store";
import { hours, money, pct, times, waitTime } from "../model/format";
import { ROBO_ATTENTION } from "../model/sim";

type St = ReturnType<AppStore["getState"]>;

interface Entry {
  id: string;
  label: string;
  dot?: string;
  hero?: boolean;
  value(st: St): string;
  note(st: St): string;
  alarm?(st: St): boolean;
}

function blendedAttention(st: St): number {
  return st.d.attention * (1 - st.d.roboShare) + st.d.roboShare * ROBO_ATTENTION;
}

const ENTRIES: Entry[] = [
  {
    id: "sit-rate",
    label: "Sitter's rate",
    dot: "var(--care)",
    value: (st) => `${money(st.sim.wSit)}/hr`,
    note: (st) =>
      st.sim.wSit > st.params.baseWage * 1.15
        ? `was ${money(st.params.baseWage)} — bid up, not improved`
        : "same as the engineer",
  },
  {
    id: "eng-wage",
    label: "Engineer's wage",
    dot: "var(--studio)",
    value: (st) => `${money(st.sim.wEng)}/hr`,
    note: (st) =>
      st.sim.wEng > st.params.baseWage * 1.15 ? "pay follows output" : "same as the sitter",
  },
  {
    id: "ratio",
    label: "An hour of sitting costs",
    hero: true,
    value: (st) => `${times(st.d.ratio)} <span class="unit">software</span>`,
    note: (st) => {
      if (st.params.kidsPerSitter > 1) return "per kid-hour — at shared attention";
      if (st.d.ratio > 1.5) return "1× in 1999 — and sitting hasn't changed";
      return "exactly what it did in 1999";
    },
  },
  {
    id: "coverage",
    label: "Requests staffed",
    value: (st) => pct(st.d.coverage),
    note: (st) => {
      const base = `1999-level hours covered: ${pct(st.d.baselineCovered)}`;
      if (st.sim.waitDays >= 1.5)
        return `${base} · wait ${waitTime(st.sim.waitDays)}`;
      return base;
    },
    alarm: (st) => st.d.coverage < 0.9 || st.d.baselineCovered < 0.8,
  },
  {
    id: "afford",
    label: "Sitting the budget covers",
    dot: "var(--care)",
    value: (st) => `${hours(st.d.affordQ1)}/wk`,
    note: (st) =>
      `bottom quartile, after tax, at the posted rate · average ${hours(st.d.affordAvg)}`,
    alarm: (st) => st.d.affordQ1 < st.d.affordAvg * 0.4,
  },
  {
    id: "attention",
    label: "Attention per kid",
    value: (st) => pct(blendedAttention(st)),
    note: (st) => {
      if (st.d.roboShare > 0.05) return `${pct(st.d.roboShare)} of hours are an app`;
      if (st.params.kidsPerSitter > 1) return `${st.params.kidsPerSitter} kids share one sitter`;
      return "one-on-one";
    },
    alarm: (st) => blendedAttention(st) < 0.6,
  },
  {
    id: "material",
    label: "Software the town ships",
    dot: "var(--studio)",
    value: (st) => times(st.d.materialIndex),
    note: (st) =>
      st.d.materialIndex > 2 ? "vs 1999. Rich in things, squeezed on hours" : "vs 1999",
  },
];

export function buildLedger(host: HTMLElement, store: AppStore): { update(): void } {
  const nodes = ENTRIES.map((e) => {
    const div = document.createElement("div");
    div.className = `entry${e.hero ? " hero" : ""}`;
    div.id = `ledger-${e.id}`;
    div.innerHTML = `
      <div class="label">${e.dot ? `<span class="dot" style="background:${e.dot}"></span>` : ""}${e.label}</div>
      <div class="value"></div>
      <div class="note"></div>
    `;
    host.appendChild(div);
    return {
      e,
      value: div.querySelector<HTMLElement>(".value")!,
      note: div.querySelector<HTMLElement>(".note")!,
    };
  });

  return {
    update() {
      const st = store.getState();
      for (const { e, value, note } of nodes) {
        const v = e.value(st);
        if (value.dataset.v !== v) {
          value.dataset.v = v;
          value.innerHTML = v;
        }
        const n = e.note(st);
        if (note.textContent !== n) note.textContent = n;
        value.classList.toggle("alarm", e.alarm?.(st) ?? false);
      }
    },
  };
}
