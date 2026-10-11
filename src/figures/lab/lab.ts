import "./lab.css";
import { XYChart } from "../../charts/xy";
import { RANGES, makeParams, type Funding, type NumKey, type Params } from "../../model/params";
import { SCENARIOS, SCENARIO_IDS, type Scenario } from "../../model/scenarios";
import { icon } from "../../scene/icons";
import { steadyCourse } from "../../sim/townSim";
import { LENSES } from "../affordability";
import { segmented, slider, toggle } from "../../ui/controls";
import { h, setText, toggleClass } from "../../ui/dom";
import { capitalize, num, pct, plural } from "../../ui/format";
import { sound } from "../../ui/sound";
import { gauge, plateHead, scenarioChips } from "../common";
import { PRICE_AXIS, RUN_YEARS, SHARE_AXIS, YEARS_AXIS, accessMarks, jobsMarks, priceMarks, type RunSample } from "../runCharts";
import { metricsPanel } from "../metrics";
import { Town } from "../town";
import { CONTROL_GROUPS, FUNDING_OPTIONS, type ControlSpec } from "./spec";
import { registerLab } from "./opener";
import { SPEEDS, createLabStore, decode, encode, paramsFor, type LabState, type Speed } from "./store";

const SAMPLE_YEARS = 0.25;
const SHARE_NOTE_MS = 2200;

function buildCharts(sc: Scenario) {
  const price = new XYChart(YEARS_AXIS, PRICE_AXIS, `Price of one ${sc.service.one} in ${sc.goods.many}`, "compact");
  const jobs = new XYChart(YEARS_AXIS, SHARE_AXIS, "Share of workers in each sector", "compact");
  const access = new XYChart(YEARS_AXIS, SHARE_AXIS, "Access and quality", "compact");
  const box = (title: string, chart: XYChart) => h("figure", { class: "lab__chart" }, h("figcaption", { class: "chart-title" }, title), chart.el);
  return {
    el: h(
      "div",
      { class: "lab__charts" },
      box(`One ${sc.service.one}, in ${sc.goods.many}`, price),
      box("Who works where", jobs),
      box(`${capitalize(sc.clients.many)} served, and quality`, access),
    ),
    update(hist: RunSample[]) {
      price.update(priceMarks(hist));
      jobs.update(jobsMarks(hist, sc));
      access.update(accessMarks(hist));
    },
  };
}

/** A numeric param's bounds, from the same table the schema is built from. */
function rangeOf(key: NumKey): { min: number; max: number } {
  const [min, max] = RANGES[key];
  return { min, max };
}

/** The control panel, plus a way to move every control to new values without redrawing it. */
function buildControls(sc: Scenario, params: Params, set: (patch: Partial<Params>) => void): { el: HTMLElement; sync(p: Params): void } {
  const syncs: ((p: Params) => void)[] = [];
  const make = (spec: ControlSpec): HTMLElement => {
    switch (spec.kind) {
      case "slider": {
        const c = slider({ ...spec, ...rangeOf(spec.key), label: spec.label(sc), value: params[spec.key], onInput: (v) => set({ [spec.key]: v }) });
        syncs.push((p) => c.set(p[spec.key]));
        return c.el;
      }
      case "toggle": {
        const c = toggle({ label: spec.label(sc), value: params[spec.key], hint: spec.hint, onChange: (v) => set({ [spec.key]: v }) });
        syncs.push((p) => c.set(p[spec.key]));
        return c.el;
      }
      case "funding": {
        const c = segmented<Funding>({
          label: spec.label(sc),
          options: FUNDING_OPTIONS,
          value: params.funding,
          compact: true,
          onChange: (v) => set({ funding: v }),
        });
        syncs.push((p) => c.set(p.funding));
        return c.el;
      }
    }
  };
  const el = h(
    "div",
    { class: "lab__controls" },
    ...CONTROL_GROUPS.map((g) =>
      h("details", { class: "ctl-group", open: g.open }, h("summary", { class: "ctl-group__title" }, g.title), h("div", { class: "ctl-group__body" }, ...g.controls.map(make))),
    ),
  );
  return { el, sync: (p) => syncs.forEach((f) => f(p)) };
}

function scenarioNote(sc: Scenario): HTMLElement {
  return h(
    "aside",
    { class: "lab__note" },
    h("p", { class: "lab__note-title" }, `${sc.domain}: ${sc.title}`),
    h("dl", {}, h("dt", {}, "Teaches"), h("dd", {}, sc.teaches), h("dt", {}, "Where it strains"), h("dd", {}, sc.complication)),
    sc.lens
      ? h("div", { class: "lens" }, h("p", { class: "lens__title" }, sc.lens.title), h("dl", {}, ...sc.lens.items.flatMap(([t, d]) => [h("dt", {}, t), h("dd", {}, d)])))
      : null,
  );
}

/** Fig. 10: the whole engine, every control, twelve settings, shareable by URL. */
export function mountLab(host: HTMLElement): void {
  const store = createLabStore(decode(location.hash));
  const get = () => store.getState();
  let sc = SCENARIOS[get().scenario];
  const metrics = metricsPanel(sc);
  const avg = gauge("Average household", "time", "", false);
  const bottom = gauge("Bottom quarter", "coin", "", false);
  // On phones the transport carries the two numbers that answer "what did that slider do?".
  const miniPrice = h("span", { class: "transport__mini" });
  const miniServed = h("span", { class: "transport__mini" });
  const year = h("span", { class: "transport__year" });
  let hist: RunSample[] = [];
  let charts = buildCharts(sc);

  const pace = (dt: number) => {
    const { playing, speed } = get();
    return playing ? dt * speed : 0;
  };
  const town = new Town(host, {
    scenario: sc,
    course: steadyCourse(get().params, RUN_YEARS),
    queue: true,
    title: "The lab town",
    pace,
    onFrame: (snap) => {
      const last = hist[hist.length - 1];
      if (!last || town.year - last.t >= SAMPLE_YEARS) {
        hist.push({ t: town.year, snap });
        charts.update(hist);
      }
      if (get().playing && town.done) store.setState({ playing: false });
      metrics.update(snap);
      // The same lens as Fig. 8: care bought at the counter, or income kept under public provision.
      const lens = LENSES[snap.params.funding];
      const r = lens.readings(snap);
      avg.set(r.all.text);
      bottom.set(r.bottom.text);
      avg.describe(lens.unit(sc));
      bottom.describe(lens.unit(sc));
      setText(year, town.done ? `Year ${RUN_YEARS} of ${RUN_YEARS} · done` : `Year ${Math.floor(town.year)} of ${RUN_YEARS}`);
      setText(miniPrice, `${num(snap.price)} ${plural(snap.price, sc.goods.one, sc.goods.many)}`);
      setText(miniServed, `${pct(snap.coverage)} served`);
      toggleClass(chartSlot, "is-waiting", hist.length < 2);
    },
  });

  const set = (patch: Partial<Params>) => store.setState({ params: makeParams({ ...get().params, ...patch }) });
  let controls = buildControls(sc, get().params, set);
  let note = scenarioNote(sc);
  const chartSlot = h("div", { class: "lab__chart-slot is-waiting", "data-hint": "Press Play to draw forty years" }, charts.el);

  const chips = scenarioChips([...SCENARIO_IDS], get().scenario, (id) => store.setState({ scenario: id, params: paramsFor(id), playing: false }));

  const playLabel = h("span", {}, "Play");
  const playIcon = h("span", { class: "transport__icon" }, icon("play"));
  const play = h("button", { type: "button", class: "transport__play" }, playIcon, playLabel);
  play.addEventListener("click", () => {
    if (town.done) restart();
    store.setState({ playing: !get().playing });
  });
  const speed = segmented<Speed>({
    label: "Speed",
    options: SPEEDS.map((v) => ({ value: v, label: `${v}×` })),
    value: get().speed,
    compact: true,
    onChange: (v) => store.setState({ speed: v }),
  });
  const button = (iconName: "gear" | "reset" | "link", label: string, onClick: () => void) => {
    const b = h("button", { type: "button", class: "transport__btn" }, icon(iconName), label);
    b.addEventListener("click", onClick);
    return b;
  };
  const inventBtn = button("gear", "Double the machine", () => {
    town.invent();
    sound.invent(town.inventions);
  });
  const resetBtn = button("reset", "Reset", () => {
    restart();
    sound.tick();
  });
  const shareBtn = button("link", "Copy link", () => void share());

  async function share(): Promise<void> {
    const hash = encode(get());
    history.replaceState(null, "", hash);
    let message = "Copied";
    try {
      await navigator.clipboard.writeText(`${location.origin}${location.pathname}${location.search}${hash}`);
    } catch {
      message = "Link is in the address bar";
    }
    shareBtn.replaceChildren(icon("link"), message);
    window.setTimeout(() => shareBtn.replaceChildren(icon("link"), "Copy link"), SHARE_NOTE_MS);
  }

  function restart(): void {
    town.restart();
    hist = [{ t: 0, snap: town.snap }];
    charts.update(hist);
    onTransport(get());
  }

  // Three reactions, each keyed on its own slice of the store.
  function onScenario(state: LabState): void {
    sc = SCENARIOS[state.scenario];
    town.reskin(sc, steadyCourse(state.params, RUN_YEARS));
    metrics.setScenario(sc);
    charts = buildCharts(sc);
    chartSlot.replaceChildren(charts.el);
    rebuildSide(state);
    chips.set(state.scenario);
    restart();
  }

  /** A new scenario relabels everything, so the note and control panel are drawn afresh. */
  function rebuildSide(state: LabState): void {
    const nextNote = scenarioNote(sc);
    const nextControls = buildControls(sc, state.params, set);
    note.replaceWith(nextNote);
    controls.el.replaceWith(nextControls.el);
    note = nextNote;
    controls = nextControls;
  }

  function onTransport(state: LabState): void {
    playIcon.replaceChildren(icon(state.playing ? "pause" : "play"));
    setText(playLabel, state.playing ? "Pause" : town.done ? "Run again" : "Play");
    toggleClass(host, "is-playing", state.playing);
  }

  store.subscribe((state, prev) => {
    if (state.scenario !== prev.scenario) onScenario(state);
    else if (state.params !== prev.params) {
      town.configure(steadyCourse(state.params, RUN_YEARS));
      controls.sync(state.params);
    }
    if (state.playing !== prev.playing) onTransport(state);
    if (state.scenario !== prev.scenario || state.params !== prev.params) history.replaceState(null, "", encode(state));
  });

  host.append(
    plateHead(10, "The lab"),
    h("div", { class: "chips--scenarios" }, chips.el),
    h(
      "div",
      { class: "lab" },
      h(
        "div",
        { class: "lab__main" },
        town.frame,
        h("div", { class: "transport" }, play, year, h("span", { class: "transport__minis" }, miniPrice, miniServed)),
        h("div", { class: "transport-extra" }, speed.el, inventBtn, resetBtn, shareBtn),
        metrics.el,
        h("div", { class: "gauges gauges--compact" }, avg.el, bottom.el),
        chartSlot,
      ),
      h("div", { class: "lab__side" }, note, controls.el),
    ),
  );
  onTransport(get());
  restart();

  // Links elsewhere on the page (the casebook's "Open in the lab") load a recipe and start fresh.
  registerLab((recipe) => {
    store.setState({ ...recipe, playing: false });
    restart();
  });
}
