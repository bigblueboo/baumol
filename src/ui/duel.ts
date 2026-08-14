/**
 * The duel strip: on narrow screens the panning scene can't show both price
 * signs at once, so this compact two-cell comparison keeps the whole lesson
 * on screen. Hidden by CSS on wide viewports.
 */

import type { AppStore } from "../app/store";
import { money } from "../model/format";

export function buildDuel(host: HTMLElement, store: AppStore): { update(): void } {
  host.innerHTML = `
    <div class="duel-cell studio-cell">
      <span class="who">Engineer</span>
      <span class="big" id="duel-eng-wage">$12/hr</span>
      <span class="small" id="duel-eng-out">ships 1 unit/hr</span>
    </div>
    <div class="duel-cell care-cell">
      <span class="who">Babysitter</span>
      <span class="big" id="duel-sit-rate">$12/hr</span>
      <span class="small">1 hour = 1 hour, always</span>
    </div>
  `;
  const engWage = host.querySelector<HTMLElement>("#duel-eng-wage")!;
  const engOut = host.querySelector<HTMLElement>("#duel-eng-out")!;
  const sitRate = host.querySelector<HTMLElement>("#duel-sit-rate")!;

  return {
    update() {
      const { sim } = store.getState();
      const w = `${money(sim.wEng)}/hr`;
      if (engWage.textContent !== w) engWage.textContent = w;
      const rate = Math.round(sim.aEng * 10) / 10;
      const o = `ships ${rate >= 10 ? Math.round(rate) : rate} unit${rate >= 1.05 ? "s" : ""}/hr`;
      if (engOut.textContent !== o) engOut.textContent = o;
      const r = `${money(sim.wSit)}/hr`;
      if (sitRate.textContent !== r) sitRate.textContent = r;
    },
  };
}
