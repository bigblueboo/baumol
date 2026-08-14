/**
 * The town vote (policy cards) and the deeper levers. One place to change
 * the rules; the sim reacts live and each card reports its consequences.
 */

import type { Engine } from "../app/engine";
import type { AppStore, PolicyId } from "../app/store";
import type { Params } from "../model/params";
import { POLICIES, policyById } from "../app/policies";

interface SegOption {
  label: string;
  apply: Partial<Params>;
}

interface Knob {
  id: string;
  label: string;
  help: string;
  options: readonly SegOption[];
  current(params: Params): number;
}

const KNOBS: Knob[] = [
  {
    id: "sigma",
    label: "If sitting gets pricey, will families accept an alternative?",
    help: "Economists call this the elasticity of substitution. It decides whether an expensive service keeps its customers — not whether its relative price rises.",
    options: [
      { label: "Never", apply: { sigma: 0.35, roboAcceptance: 0.15 } },
      { label: "Sometimes", apply: { sigma: 1.0, roboAcceptance: 0.5 } },
      { label: "Readily", apply: { sigma: 2.1, roboAcceptance: 0.85 } },
    ],
    current: (p) => (p.sigma < 0.7 ? 0 : p.sigma < 1.5 ? 1 : 2),
  },
  {
    id: "training",
    label: "Retraining a sitter into an engineer takes…",
    help: "Friction in the labor market slows the wage squeeze but doesn't stop it.",
    options: [
      { label: "A weekend", apply: { trainingWeeks: 0 } },
      { label: "Months", apply: { trainingWeeks: 8 } },
      { label: "Years", apply: { trainingWeeks: 30 } },
    ],
    current: (p) => (p.trainingWeeks < 4 ? 0 : p.trainingWeeks < 20 ? 1 : 2),
  },
  {
    id: "passthrough",
    label: "Where do the productivity gains show up, from now on?",
    help: "Reroutes future gains — into paychecks, into cheaper software, or split. Dollar wages and prices will drift to the new arrangement. Watch the ratio while they do: the care-hour costs more software either way. Cost disease changes its costume, not its size.",
    options: [
      { label: "Paychecks", apply: { passThrough: 1 } },
      { label: "Split", apply: { passThrough: 0.55 } },
      { label: "Cheaper software", apply: { passThrough: 0.15 } },
    ],
    current: (p) => (p.passThrough > 0.8 ? 0 : p.passThrough > 0.35 ? 1 : 2),
  },
  {
    id: "distribution",
    label: "Who shares in the town's new wealth?",
    help: "Watch the affordability chart: 'the town can afford it' is not the same as 'everyone can.'",
    options: [
      { label: "Everyone", apply: { distribution: "shared" } },
      { label: "Mostly the studio", apply: { distribution: "concentrated" } },
    ],
    current: (p) => (p.distribution === "shared" ? 0 : 1),
  },
];

export function buildTownhall(
  policyHost: HTMLElement,
  knobHost: HTMLElement,
  store: AppStore,
  engine: Engine,
): { update(): void } {
  policyHost.innerHTML = `
    <h2>The town votes</h2>
    <p class="sub">Every answer below has been tried or proposed for childcare, healthcare, or schools. The toy applies one lever at a time so its effect stays readable; real towns combine them. Change your vote whenever you like.</p>
  `;
  const grid = document.createElement("div");
  grid.className = "policy-grid";
  grid.setAttribute("role", "group");
  grid.setAttribute("aria-label", "The town's answer — one policy in effect at a time");
  policyHost.appendChild(grid);

  const policyButtons = new Map<PolicyId, { btn: HTMLButtonElement; outcome: HTMLElement }>();
  for (const p of POLICIES) {
    const b = document.createElement("button");
    b.type = "button";
    b.className = "policy";
    b.id = `policy-${p.id}`;
    b.innerHTML = `<span class="name">${p.name}</span><span class="desc">${p.desc}</span><span class="outcome" aria-live="off"></span>`;
    b.addEventListener("click", () => choose(p.id));
    grid.appendChild(b);
    policyButtons.set(p.id, { btn: b, outcome: b.querySelector(".outcome")! });
  }

  // where the consequences get narrated, right next to the cards
  const voteNote = document.createElement("p");
  voteNote.id = "vote-note";
  voteNote.className = "vote-note";
  voteNote.setAttribute("aria-live", "polite");
  policyHost.appendChild(voteNote);

  function choose(id: PolicyId): void {
    const st = store.getState();
    if (st.policy === id) return;
    const def = policyById(id);
    const params = def.apply(st.params, st.sim);
    // The vote is cast; time rolls again so the consequences arrive — even
    // if the reader had paused to think it over.
    store.setState({ policy: id, speed: Math.max(st.speed, 4), paused: false });
    engine.applyParams(params);
    engine.markEvent(def.name, "policy");
  }

  const knobsWrap = document.createElement("div");
  knobsWrap.className = "body";
  knobHost.appendChild(knobsWrap);

  const segButtons: { knob: Knob; buttons: HTMLButtonElement[] }[] = [];
  for (const knob of KNOBS) {
    const div = document.createElement("div");
    div.className = "knob";
    div.innerHTML = `<div class="knob-label">${knob.label}</div>`;
    const seg = document.createElement("div");
    seg.className = "seg";
    seg.setAttribute("role", "group");
    seg.setAttribute("aria-label", knob.label);
    const buttons = knob.options.map((opt, i) => {
      const b = document.createElement("button");
      b.type = "button";
      b.textContent = opt.label;
      b.id = `knob-${knob.id}-${i}`;
      b.addEventListener("click", () => {
        const st = store.getState();
        engine.applyParams({ ...st.params, ...opt.apply });
      });
      seg.appendChild(b);
      return b;
    });
    div.appendChild(seg);
    const help = document.createElement("p");
    help.className = "knob-help";
    help.textContent = knob.help;
    div.appendChild(help);
    knobsWrap.appendChild(div);
    segButtons.push({ knob, buttons });
  }

  // reset — a full reload is the only reset that resets everything
  const resetWrap = document.createElement("div");
  const reset = document.createElement("button");
  reset.type = "button";
  reset.id = "reset-town";
  reset.textContent = "Start the town over";
  reset.style.cssText =
    "font-family:var(--sans);font-weight:600;font-size:0.9rem;color:var(--ink-soft);background:transparent;border:1.5px solid var(--hairline);border-radius:0.55rem;padding:0.5em 1.1em;cursor:pointer";
  reset.addEventListener("click", () => window.location.reload());
  resetWrap.appendChild(reset);
  knobsWrap.appendChild(resetWrap);

  return {
    update() {
      const st = store.getState();
      for (const [id, { btn, outcome }] of policyButtons) {
        const active = st.policy === id;
        btn.setAttribute("aria-pressed", String(active));
        const text = active ? policyById(id).outcome(st.sim, st.d, st.params) : "";
        if (outcome.textContent !== text) outcome.textContent = text;
      }
      for (const { knob, buttons } of segButtons) {
        const cur = knob.current(st.params);
        buttons.forEach((b, i) => b.setAttribute("aria-pressed", String(i === cur)));
      }
    },
  };
}
