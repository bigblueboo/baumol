/**
 * A few synthesized sounds. Off by default: the page is mostly read, and it should stay
 * quiet in a library or an office until someone asks. `?silent` locks it off.
 */
const STORAGE_KEY = "one-hour:sound";
let ctx: AudioContext | null = null;
let enabled = false;
const locked = new URLSearchParams(location.search).has("silent");

function audio(): AudioContext | null {
  if (!enabled || locked) return null;
  ctx ??= new AudioContext();
  if (ctx.state === "suspended") void ctx.resume();
  return ctx;
}

function tone(freq: number, dur: number, type: OscillatorType, gain: number, delay = 0, slideTo?: number): void {
  const a = audio();
  if (!a) return;
  const t = a.currentTime + delay;
  const osc = a.createOscillator();
  const g = a.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (slideTo) osc.frequency.exponentialRampToValueAtTime(slideTo, t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.exponentialRampToValueAtTime(gain, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(a.destination);
  osc.start(t);
  osc.stop(t + dur + 0.02);
}

export const sound = {
  /** The machine: a heavy mechanical clunk and a rising whirr. */
  invent(level: number): void {
    tone(90, 0.18, "square", 0.08);
    tone(220 * 2 ** (level / 4), 0.5, "sawtooth", 0.025, 0.05, 440 * 2 ** (level / 4));
  },
  /** A soft tick for toggles and steppers. */
  tick(): void {
    tone(1400, 0.04, "triangle", 0.05);
  },
  /** Prices settle: a small two-note chime. */
  settle(): void {
    tone(660, 0.5, "sine", 0.05);
    tone(990, 0.7, "sine", 0.04, 0.12);
  },
};

export function initSoundToggle(button: HTMLButtonElement): void {
  try {
    enabled = !locked && localStorage.getItem(STORAGE_KEY) === "on";
  } catch {
    enabled = false;
  }
  const label = button.querySelector(".sound-toggle__label");
  const render = () => {
    button.setAttribute("aria-pressed", String(enabled));
    if (label) label.textContent = enabled ? "Sound on" : "Sound off";
  };
  if (locked) button.hidden = true;
  render();
  button.addEventListener("click", () => {
    enabled = !enabled;
    try {
      localStorage.setItem(STORAGE_KEY, enabled ? "on" : "off");
    } catch {
      /* storage unavailable: the toggle still works for this visit */
    }
    render();
    sound.tick();
  });
}
