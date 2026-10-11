import { h, setText, toggleClass } from "../ui/dom";

export interface Beat {
  title: string;
  /** Called every frame while the beat is showing, so numbers stay live. */
  text: () => string;
}

/** Each beat stays up at least this long, so a fast simulation still reads in order. */
const MIN_DWELL = 1;

/**
 * A narrated sequence of beats driven by the simulation. The figure reports which beat the
 * model has reached; the story advances one beat at a time, never skipping, never going back.
 */
export function createStory(beats: Beat[], idle: () => string) {
  const items = beats.map((b, i) =>
    h("li", { class: "story__beat" }, h("span", { class: "story__n" }, String(i + 1)), h("span", { class: "story__title" }, b.title)),
  );
  const text = h("p", { class: "story__text" });
  const live = h("p", { class: "visually-hidden", "aria-live": "polite" });
  const el = h("div", { class: "story" }, h("ol", { class: "story__beats" }, ...items), text, live);

  let shown = -1;
  let reached = -1;
  let dwell = 0;

  const paint = () => {
    items.forEach((li, i) => {
      toggleClass(li, "is-done", i < shown);
      toggleClass(li, "is-active", i === shown);
    });
    toggleClass(el, "is-idle", shown < 0);
  };
  const show = (i: number) => {
    shown = i;
    dwell = 0;
    paint();
    const t = shown < 0 ? idle() : (beats[shown]?.text() ?? "");
    setText(live, t);
  };
  show(-1);
  setText(text, idle());

  return {
    el,
    start() {
      reached = 0;
      show(0);
    },
    reset() {
      reached = -1;
      show(-1);
      setText(text, idle());
    },
    /** Returns "settled" on the frame the final beat first appears. */
    update(raw: number, dt: number): "settled" | null {
      if (shown < 0) return null;
      reached = Math.max(reached, Math.min(raw, beats.length - 1));
      dwell += dt;
      let event: "settled" | null = null;
      if (shown < reached && dwell >= MIN_DWELL) {
        show(shown + 1);
        if (shown === beats.length - 1) event = "settled";
      }
      setText(text, beats[shown]?.text() ?? "");
      return event;
    },
  };
}
