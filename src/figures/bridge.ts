import "./bridge.css";
import type { Snapshot } from "../model/economy";
import { makeParams, type Params } from "../model/params";
import { SCENARIOS } from "../model/scenarios";
import { slider, toggle } from "../ui/controls";
import { h, setText, toggleClass } from "../ui/dom";
import { count, days, pct } from "../ui/format";
import { inventControls, plateHead } from "./common";
import { Town, WARMUP_TOWN, steady } from "./town";
import { steadyCourse } from "../sim/townSim";
import { isTempted } from "../scene/signals";

const MAX = 5;
/** Caregivers earning less than machinists by this factor count as visibly worse off. */
const VISIBLE_GAP = 1.3;
const LOW_PASS_THROUGH = 0.3;

function stat(label: string, tone: string) {
  const value = h("span", { class: "stat__value" });
  const note = h("span", { class: "stat__note" });
  const el = h("div", { class: `stat tone-${tone}` }, h("span", { class: "stat__label" }, label), value, note);
  return { el, value, note };
}

const gadgets = (n: number) => count(n, "gadget", "gadgets");

/** Fig. 4: close the road between the jobs, or divert the gains to owners, and the disease vanishes. */
export function mountBridge(host: HTMLElement): void {
  const sc = SCENARIOS.care;
  const machinist = stat("Machinist earns", "things");
  const caregiver = stat("Caregiver earns", "time");
  const price = stat("A care-hour costs", "coin");
  const verdict = h("p", { class: "verdict" });

  const town = new Town(host, {
    scenario: sc,
    course: steadyCourse(makeParams({ mobility: 0.9, trainingYears: 0 })),
    population: WARMUP_TOWN,
    title: "The gadget plant and the care house, with a gate that can close the road between them",
    pace: steady(0.55),
    onFrame: (snap) => {
      setText(machinist.value, `${gadgets(snap.factoryWage)}/hr`);
      setText(caregiver.value, `${gadgets(snap.careWage)}/hr`);
      setText(price.value, gadgets(snap.price));
      setText(machinist.note, `makes ${gadgets(snap.goodsTech)} an hour`);
      setText(caregiver.note, "gives 1 care-hour an hour");
      setText(price.note, snap.price > 1.05 ? "the price of a caregiver's hour" : "same as at the start");
      setText(verdict, verdictText(snap, town.inventions));
      toggleClass(verdict, "is-warning", trappedGap(snap) !== null);
    },
  });

  const set = (patch: Partial<Params>) => town.configure(steadyCourse(makeParams({ ...town.snap.params, ...patch })));
  const road = toggle({ label: "Caregivers can take factory jobs", value: true, onChange: (v) => set({ sharedLaborMarket: v }) });
  const passThrough = slider({
    label: "Share of the machine's gains paid as wages",
    min: 0,
    max: 1,
    step: 0.05,
    value: 1,
    format: pct,
    ends: ["All to owners", "All to wages"],
    onInput: (v) => set({ wagePassThrough: v }),
  });

  host.append(
    plateHead(4, "The road between the jobs"),
    town.frame,
    h("div", { class: "stats" }, machinist.el, caregiver.el, price.el),
    h(
      "div",
      { class: "console console--split" },
      inventControls(town, { max: MAX }).el,
      h("div", { class: "console__controls" }, road.el, passThrough.el, verdict),
    ),
  );
}

const FRACTION_WORDS: Record<number, string> = { 2: "half", 4: "a quarter", 8: "an eighth", 16: "a sixteenth", 32: "a thirty-second" };

/** "an eighth" when the gap sits on a doubling, "38%" in between. */
function fractionWords(gap: number): string {
  const n = Math.round(gap);
  const word = Math.abs(gap - n) < 0.05 ? FRACTION_WORDS[n] : undefined;
  return word ?? pct(1 / gap);
}

/** Caregivers are visibly stuck below machinists' pay with the road closed. */
function trappedGap(snap: Snapshot): number | null {
  const gap = snap.factoryWage / snap.careWage;
  return !snap.params.sharedLaborMarket && gap > VISIBLE_GAP ? gap : null;
}

function verdictText(snap: Snapshot, inventions: number): string {
  const gap = trappedGap(snap);
  const passThrough = snap.params.wagePassThrough;
  if (inventions === 0) return "Invent a machine or two, then close the road.";
  if (gap !== null) {
    const queue = snap.waitDays >= 1 ? ` And there aren't enough of them: residents wait ${days(snap.waitDays)}.` : "";
    return `Care stops getting dearer, because caregivers are stuck on ${fractionWords(gap)} of what machinists earn and can't leave.${queue}`;
  }
  if (passThrough === 0) return "Wages didn't rise at all; the gains went to whoever owns the machines. With care this cheap and the town richer, more people end up working in it.";
  if (passThrough < LOW_PASS_THROUGH) return "Wages barely rose, so the care house has little to match. Most of the gains went to whoever owns the machines.";
  if (isTempted(snap)) return "Caregivers are tempted. The care house will have to pay more or lose them.";
  return "Care costs more because a caregiver's hour is worth what it could earn at the plant.";
}
