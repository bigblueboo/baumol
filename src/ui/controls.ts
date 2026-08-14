/**
 * The console: one big button, the era track, and time controls.
 *
 * The button breathes: after a press it reads "installing…" until the new
 * tools have actually landed in the sim, so consequences stay attached to
 * causes even for impatient readers.
 */

import { eraInstalled, type AppStore } from "../app/store";
import type { Engine } from "../app/engine";
import { ERAS, currentEra, eraIndex, nextEra } from "../model/eras";

export function buildControls(
  store: AppStore,
  engine: Engine,
  onPress: () => void,
): { update(): void } {
  const button = document.getElementById("invent") as HTMLButtonElement;
  const track = document.getElementById("era-track") as HTMLOListElement;
  const timeHost = document.getElementById("time-controls") as HTMLElement;

  ERAS.forEach((era, i) => {
    const li = document.createElement("li");
    li.title = era.name;
    li.setAttribute("aria-label", `Era ${i + 1}: ${era.name}`);
    track.appendChild(li);
  });

  function pressable(st: ReturnType<AppStore["getState"]>): boolean {
    if (st.beat !== 0 || st.inscription !== null) return false;
    if (!nextEra(st.sim.aEngTarget)) return false;
    return st.pressCount === 0 || eraInstalled(st);
  }

  button.addEventListener("click", () => {
    const st = store.getState();
    if (!pressable(st)) return;
    engine.press();
    const era = currentEra(store.getState().sim.aEngTarget);
    engine.markEvent(era.short, "era");
    onPress();
  });

  // time controls
  const speeds: { id: string; label: string; speed: number; paused?: boolean }[] = [
    { id: "pause", label: "Pause", speed: 0, paused: true },
    { id: "play", label: "Play", speed: 4 },
    { id: "fast", label: "Fast", speed: 12 },
  ];
  const label = document.createElement("span");
  label.className = "label";
  label.textContent = "time";
  timeHost.appendChild(label);
  const timeButtons = speeds.map((s) => {
    const b = document.createElement("button");
    b.type = "button";
    b.id = `time-${s.id}`;
    b.textContent = s.label;
    b.addEventListener("click", () => {
      const st = store.getState();
      if (st.beat !== 0) return; // narration owns the clock during the chain
      store.setState({ paused: s.paused ?? false, speed: s.paused ? st.speed : s.speed });
    });
    timeHost.appendChild(b);
    return { s, b };
  });

  let lastLabel = "";
  return {
    update() {
      const st = store.getState();
      const next = nextEra(st.sim.aEngTarget);
      const canPress = pressable(st);
      // "installing…" applies to the final era too — the tools aren't maxed
      // out until the last ones have actually landed
      const installing =
        st.pressCount > 0 && st.beat === 0 && !st.inscription && !eraInstalled(st);

      const labelNow = installing
        ? `${currentEra(st.sim.aEngTarget).name}<span class="sub">installing…</span>`
        : !next
          ? `The tools are maxed out<span class="sub">explore the town below</span>`
          : `${next.button}<span class="sub">${next.flavor}</span>`;
      if (labelNow !== lastLabel) {
        button.innerHTML = labelNow;
        lastLabel = labelNow;
      }
      button.disabled = !canPress;

      const idx = eraIndex(st.sim.aEngTarget);
      [...track.children].forEach((li, i) => {
        li.className = i < idx ? "done" : i === idx ? "now" : "";
        if (i === idx) li.setAttribute("aria-current", "step");
        else li.removeAttribute("aria-current");
      });

      const chainOn = st.beat !== 0;
      for (const { s, b } of timeButtons) {
        b.disabled = chainOn;
        const active = st.paused
          ? s.paused === true
          : !s.paused && (s.id === "fast" ? st.speed >= 8 : st.speed < 8);
        b.setAttribute("aria-pressed", String(active));
      }
    },
  };
}
