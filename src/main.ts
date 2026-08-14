import "@fontsource-variable/fraunces";
import "@fontsource-variable/instrument-sans";
import "./styles.css";

import { parseFlags } from "./app/flags";
import { createAppStore } from "./app/store";
import { Engine } from "./app/engine";
import { Director } from "./app/director";
import { buildScene } from "./ui/scene";
import { buildLedger } from "./ui/hud";
import { buildCharts } from "./ui/charts";
import { buildControls } from "./ui/controls";
import { buildTownhall } from "./ui/townhall";
import { buildDuel } from "./ui/duel";
import { DEFAULT_PARAMS } from "./model/params";

const flags = parseFlags(window.location.search);

const store = createAppStore({ ...DEFAULT_PARAMS });
const engine = new Engine(store);
const director = new Director(store, flags.fast);

const scene = buildScene(document.getElementById("scene-host")!, store, flags.seed);
const duel = buildDuel(document.getElementById("duel")!, store);
const ledger = buildLedger(document.getElementById("ledger")!, store);
const charts = buildCharts(document.getElementById("charts")!, store);
const townhall = buildTownhall(
  document.getElementById("crisis")!,
  document.getElementById("townhall-body")!,
  store,
  engine,
);
const controls = buildControls(store, engine, () => director.onPress());

const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;

// section reveals — flip `hidden` once, with a rise-in
const revealed = new Set<string>();
function reveal(id: string): void {
  if (revealed.has(id)) return;
  revealed.add(id);
  const node = document.getElementById(id)!;
  node.hidden = false;
  node.classList.add("reveal");
}

let chartClock = 0;
let last: number | null = null;

function frame(t: number): void {
  requestAnimationFrame(frame);
  if (last === null) {
    last = t;
    return;
  }
  const dtReal = Math.min((t - last) / 1000, 0.25);
  last = t;

  const pre = store.getState();
  const consumedWeeks = engine.advance(dtReal);
  // Narration runs on achieved simulation progress, so a stalled frame
  // stalls the words along with the numbers.
  const dtNarrative =
    pre.paused || pre.speed <= 0 ? 0 : consumedWeeks / pre.speed;
  director.update(dtNarrative);
  scene.update(dtReal, consumedWeeks);

  const st = store.getState();
  if (st.ledgerUnlocked) reveal("ledger");
  if (st.chartsUnlocked) reveal("charts");
  if (st.townhallUnlocked && !revealed.has("crisis")) {
    reveal("crisis");
    reveal("townhall-wrap");
    // The one moment the piece takes the wheel: bring the vote on screen.
    document.getElementById("crisis")!.scrollIntoView({
      behavior: reducedMotion ? "auto" : "smooth",
      block: "center",
    });
  }

  duel.update();
  ledger.update();
  controls.update();
  townhall.update();

  chartClock += dtReal;
  if (chartClock > 0.5) {
    chartClock = 0;
    if (st.chartsUnlocked) charts.update();
  }
}
requestAnimationFrame(frame);

// A stable hook for end-to-end tests and the curious.
declare global {
  interface Window {
    __town: {
      store: typeof store;
      engine: Engine;
      press(): void;
      advanceWeeks(w: number): void;
    };
  }
}

window.__town = {
  store,
  engine,
  press() {
    (document.getElementById("invent") as HTMLButtonElement).click();
  },
  advanceWeeks(w: number) {
    engine.advanceSimWeeks(w);
  },
};
