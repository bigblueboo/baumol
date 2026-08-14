/**
 * The director paces the story. It owns the caption line, the narrated
 * causal chain after the first press, the inscriptions (the big lines the
 * piece exists to deliver), the endgame reveal of the town vote, and
 * one-shot observations as the town evolves.
 *
 * Narrative time is measured in *simulated progress*, handed in by the
 * engine each frame — so the words can never outrun the economy, even on a
 * stalled machine. During the opening chain the engine also freezes each
 * economic mechanism until its beat introduces it (see gatesForBeat).
 */

import { eraInstalled, type AppStore } from "./store";
import { money, pct, times, waitTime } from "../model/format";
import { currentEra } from "../model/eras";

interface Beat {
  n: number;
  minS: number;
  maxS: number;
  speed: number;
  text(st: St): string;
  done(st: St): boolean;
}

type St = ReturnType<AppStore["getState"]>;

const fig = (s: string) => `<span class="fig">${s}</span>`;

const CHAIN: Beat[] = [
  {
    n: 1,
    minS: 3.2,
    maxS: 12,
    speed: 2.2,
    text: () =>
      `The new tool doubles what an engineer ships. An hour of sitting still takes… an hour.`,
    done: (st) => st.sim.aEng >= 1.85,
  },
  {
    n: 2,
    minS: 3,
    maxS: 12,
    speed: 2.6,
    text: (st) =>
      `Studios compete for engineers, so the pay follows the output: ${fig(money(st.params.baseWage * 2) + "/hr")}.`,
    done: (st) => st.sim.wEng >= st.params.baseWage * 2 * 0.94,
  },
  {
    n: 3,
    minS: 3.2,
    maxS: 14,
    speed: 1.8,
    text: () =>
      `Sitters can read a sign. Some leave for code school — and a queue forms at the door.`,
    done: (st) => st.d.trainees >= 0.8 || st.sim.sitters <= st.params.totalWorkers / 2 - 1.2,
  },
  {
    n: 4,
    minS: 4,
    maxS: 18,
    speed: 9,
    text: () =>
      `Families bid the rest back. The same hour of care now costs what the studio pays.`,
    done: (st) => st.sim.wSit >= st.sim.wEng * 0.9 && st.d.coverage >= 0.88,
  },
];

interface Rule {
  id: string;
  when(st: St): boolean;
  fire(st: St, api: DirectorApi): void;
}

interface DirectorApi {
  caption(html: string): void;
  /** Also pin the line beside the policy cards, where the reader is. */
  note(html: string): void;
  inscribe(line: string, detail: string, button: string): void;
}

const RULES: Rule[] = [
  {
    id: "ratio-milestone",
    when: (st) => st.phase === "play" && st.d.ratio >= 3.4 && !st.crisisShown,
    fire: (st, api) =>
      api.caption(
        `An hour of sitting now costs ${fig(times(st.d.ratio))} what a unit of software costs. Nobody voted for this, and nobody can veto it. The town gets its say when the tools top out.`,
      ),
  },
  {
    id: "cap-bites",
    when: (st) => st.params.rateCap !== null && st.d.coverage < 0.72,
    fire: (st, api) => {
      const line = `The cap held the price. It did not hold the sitters: only ${fig(String(Math.round(st.sim.sitters)))} remain, and families wait ${fig(waitTime(Math.max(st.sim.waitDays, 2)))}. A price you can't charge becomes a service you can't find.`;
      api.caption(line);
      api.note(line);
    },
  },
  {
    id: "batch-bites",
    when: (st) => st.params.kidsPerSitter > 1 && st.d.attention <= 0.5,
    fire: (st, api) => {
      const line = `Splitting one sitter across ${fig(String(st.params.kidsPerSitter))} kids cut the bill per family. It also cut what's being sold: each kid now gets ${fig(pct(st.d.attention))} of a sitter. Cheaper hour, thinner hour.`;
      api.caption(line);
      api.note(line);
    },
  },
  {
    id: "robo-bites",
    when: (st) => st.d.roboShare > 0.25,
    fire: (st, api) => {
      const line = `RoboSitter now minds ${fig(pct(st.d.roboShare))} of care hours, at software prices — the one escape cost disease allows. The question the model can't answer: is an app watching your kid the same product as a person watching your kid?`;
      api.caption(line);
      api.note(line);
    },
  },
  {
    id: "subsidy-bites",
    when: (st) => st.d.publicShare > 0.1,
    fire: (st, api) => {
      const line = `The subsidy keeps requests staffed — and now ${fig(pct(st.d.publicShare))} of the town's income flows through the town budget to sitters. In this stripped-down town there is no administrative waste: care costs what it costs, the bill moved, and the tax comes out of every paycheck.`;
      api.caption(line);
      api.note(line);
    },
  },
  {
    id: "passthrough-gap",
    // fire only after the rerouted gains have substantially settled, so the
    // words describe what the ledger actually shows
    when: (st) =>
      st.params.passThrough < 0.3 &&
      st.sim.aEng >= 3.5 &&
      st.sim.wEng <= st.params.baseWage * Math.pow(st.sim.aEng, 0.35),
    fire: (st, api) => {
      const line = `The gains now land as cheaper software: the studio wage sank back, and the sitter's rate followed it down. But look at the ratio — one care-hour still costs ${fig(times(st.d.ratio))} software. The gap doesn't care which costume it wears.`;
      api.caption(line);
      api.note(line);
    },
  },
  {
    id: "sigma-high",
    when: (st) =>
      st.params.sigma > 1.5 && st.sim.aEng >= 3.5 && st.d.careWorkShare < 0.42,
    fire: (st, api) => {
      const line = `Families accept alternatives, so human sitting shrinks: ${fig(pct(st.d.careWorkShare))} of the town works in care and falling. The price gap didn't close — what changed is how much human care people keep buying.`;
      api.caption(line);
      api.note(line);
    },
  },
  {
    id: "concentrated",
    when: (st) =>
      st.params.distribution === "concentrated" && st.d.affordQ1 < st.d.affordAvg * 0.35,
    fire: (st, api) => {
      const line = `On average, the town can afford sitters. A bottom-quartile family's budget covers ${fig(
        `${Math.round(st.d.affordQ1 * 10) / 10} hr`,
      )} a week — down from about four in 1999. "Society can afford it" and "everyone can afford it" have quietly come apart.`;
      api.caption(line);
      api.note(line);
    },
  },
];

export class Director {
  private beatIdx = -1;
  private beatStart = 0;
  private fired = new Set<string>();
  private captionEl: HTMLElement;
  private overlay: HTMLElement;
  private overlayLine: HTMLElement;
  private overlayDetail: HTMLElement;
  private overlayBtn: HTMLButtonElement;
  private pendingCaption: string | null = null;
  private swapTimer = 0;
  private onInscriptionClose: (() => void) | null = null;
  private pausedBeforeInscription = false;
  /** Narrative clock: seconds of *achieved* simulation progress. */
  private clock = 0;

  constructor(
    private store: AppStore,
    private fast: boolean,
  ) {
    this.captionEl = document.getElementById("caption")!;

    this.overlay = document.createElement("div");
    this.overlay.className = "inscription";
    this.overlay.setAttribute("role", "dialog");
    this.overlay.setAttribute("aria-modal", "true");
    this.overlay.setAttribute("aria-labelledby", "inscription-line");
    this.overlay.setAttribute("aria-describedby", "inscription-detail");
    this.overlay.hidden = true;
    this.overlay.innerHTML = `<div class="card"><p class="line" id="inscription-line"></p><p class="detail" id="inscription-detail"></p><button type="button" id="inscription-continue"></button></div>`;
    document.body.appendChild(this.overlay);
    this.overlayLine = this.overlay.querySelector(".line")!;
    this.overlayDetail = this.overlay.querySelector(".detail")!;
    this.overlayBtn = this.overlay.querySelector("button")!;
    this.overlayBtn.addEventListener("click", () => this.closeInscription());
    document.addEventListener("keydown", (e) => {
      if (e.key === "Escape" && !this.overlay.hidden) this.closeInscription();
    });

    this.caption(
      `Everyone here earns ${fig("$12/hr")} — the engineer at a desk, the sitter with one kid and a clock. Software is hand-made, an hour of care is hand-made, and an hour costs an hour. Press the button to change exactly one of those things.`,
    );
  }

  private caption(html: string): void {
    if (this.captionEl.innerHTML === html) return;
    this.pendingCaption = html;
    this.captionEl.classList.add("is-swapping");
    window.clearTimeout(this.swapTimer);
    this.swapTimer = window.setTimeout(() => {
      if (this.pendingCaption !== null) this.captionEl.innerHTML = this.pendingCaption;
      this.pendingCaption = null;
      this.captionEl.classList.remove("is-swapping");
    }, 300);
  }

  private note(html: string): void {
    const el = document.getElementById("vote-note");
    if (el) el.innerHTML = html;
  }

  private inscribe(line: string, detail: string, button: string, onClose?: () => void): void {
    this.pausedBeforeInscription = this.store.getState().paused;
    this.store.setState({ inscription: { line, detail, button }, paused: true });
    this.overlayLine.textContent = line;
    this.overlayDetail.textContent = detail;
    this.overlayBtn.textContent = button;
    this.overlay.hidden = false;
    document.querySelector("main")?.setAttribute("inert", "");
    requestAnimationFrame(() => this.overlay.classList.add("show"));
    this.onInscriptionClose = onClose ?? null;
    this.overlayBtn.focus();
  }

  private closeInscription(): void {
    // Hide instantly — a fading ghost overlay still intercepts clicks and
    // confuses assistive tech. The entrance gets the fade; the exit is cut.
    this.overlay.classList.remove("show");
    this.overlay.hidden = true;
    document.querySelector("main")?.removeAttribute("inert");
    this.store.setState({ inscription: null, paused: this.pausedBeforeInscription });
    const cb = this.onInscriptionClose;
    this.onInscriptionClose = null;
    cb?.();
    const invent = document.getElementById("invent") as HTMLButtonElement | null;
    if (invent && !invent.disabled) invent.focus();
    else document.getElementById("time-play")?.focus();
  }

  /** Called by controls when the big button is pressed. */
  onPress(): void {
    const st = this.store.getState();
    const era = currentEra(st.sim.aEngTarget);
    if (st.pressCount === 1) {
      this.beatIdx = 0;
      this.beatStart = this.clock;
      const beat = CHAIN[0]!;
      this.store.setState({
        phase: "chain",
        beat: 1,
        paused: false,
        speed: beat.speed * (this.fast ? 3 : 1),
      });
      this.caption(beat.text(st));
    } else {
      this.caption(`${fig(era.name)}: ${era.flavor}`);
    }
  }

  /**
   * Advance narrative logic. dtNarrative is seconds of achieved simulation
   * progress (consumed weeks / speed), zero while paused or stalled.
   */
  update(dtNarrative: number): void {
    this.clock += dtNarrative;
    const st = this.store.getState();

    // the narrated chain
    if (st.phase === "chain" && this.beatIdx >= 0) {
      const beat = CHAIN[this.beatIdx]!;
      const elapsed = this.clock - this.beatStart;
      const minS = this.fast ? 0.3 : beat.minS;
      const maxS = this.fast ? 4 : beat.maxS;
      if ((elapsed >= minS && beat.done(st)) || elapsed >= maxS) {
        this.beatIdx++;
        if (this.beatIdx >= CHAIN.length) {
          this.beatIdx = -1;
          this.store.setState({ beat: 0, speed: 1 });
          this.inscribe(
            "Nothing happened to babysitting. Everything happened to its alternative.",
            `A sitter's hour still produces exactly what it produced in 1999: one hour of care. But its price is set by what that hour could earn across the street — so sitting now costs ${times(st.d.ratio)} what software costs, without changing at all. Four more tool eras await.`,
            "Keep going",
            () => {
              this.store.setState({
                phase: "play",
                speed: 4,
                paused: false,
                ledgerUnlocked: true,
                chartsUnlocked: true,
              });
              this.caption(
                `The ledger and the chart are open below. Keep pressing — and watch the two prices come apart.`,
              );
            },
          );
        } else {
          const nb = CHAIN[this.beatIdx]!;
          this.beatStart = this.clock;
          this.store.setState({ beat: nb.n, speed: nb.speed * (this.fast ? 3 : 1) });
          this.caption(nb.text(st));
        }
      }
      return;
    }

    if (st.phase !== "play" || st.inscription) return;

    // the closing inscription: fires once the last era has truly landed,
    // and its dismissal opens the town vote
    if (
      !this.fired.has("final") &&
      st.sim.aEngTarget >= 32 &&
      eraInstalled(st) &&
      st.sim.wSit >= st.sim.wEng * 0.85
    ) {
      this.fired.add("final");
      const d = st.d;
      this.inscribe(
        "One hour is still one hour.",
        `The town ships ${times(d.materialIndex)} the software it did in 1999, and a unit of it costs ${
          Math.round(((60 * d.pSoftware) / Math.max(st.sim.wEng, 1)) * 10) / 10
        } minutes of work instead of sixty. An hour of care still costs an hour — so on a receipt, care looks ${times(
          d.ratio,
        )} more expensive. That gap is Baumol's cost disease. It doesn't require waste or failure — real childcare has plenty of other problems layered on top — this toy isolates the part caused by the rising value of human time. Now: what should the town do about it?`,
        "Open the town vote",
        () => {
          this.store.setState({ crisisShown: true, townhallUnlocked: true, speed: 4 });
          this.caption(
            `Five answers, each one somebody has tried or proposed. Cast a vote below and watch it land — you can always change it.`,
          );
        },
      );
      return;
    }

    // one-shot observations
    for (const rule of RULES) {
      if (this.fired.has(rule.id) || !rule.when(st)) continue;
      this.fired.add(rule.id);
      rule.fire(st, {
        caption: (h) => this.caption(h),
        note: (h) => this.note(h),
        inscribe: (l, d, b) => this.inscribe(l, d, b),
      });
      break; // one narrative event per frame is plenty
    }
  }
}
