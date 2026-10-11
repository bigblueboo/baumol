type Tick = (dt: number) => void;

interface Entry {
  tick: Tick;
  visible: boolean;
}

/** `?fast` runs every figure four times faster, so end-to-end tests can play whole stories. */
const SPEED = new URLSearchParams(location.search).has("fast") ? 4 : 1;

const entries = new Map<Element, Entry>();
let frame = 0;
let last = 0;

const observer = new IntersectionObserver(
  (records) => {
    for (const r of records) {
      const e = entries.get(r.target);
      if (e) e.visible = r.isIntersecting;
    }
    ensureRunning();
  },
  { rootMargin: "120px 0px" },
);

function loop(now: number): void {
  const dt = (last ? Math.min(0.05, (now - last) / 1000) : 1 / 60) * SPEED;
  last = now;
  let any = false;
  for (const e of entries.values()) {
    if (!e.visible) continue;
    any = true;
    e.tick(dt);
  }
  frame = any && !document.hidden ? requestAnimationFrame(loop) : 0;
  if (!frame) last = 0;
}

function ensureRunning(): void {
  if (frame || document.hidden) return;
  if ([...entries.values()].some((e) => e.visible)) frame = requestAnimationFrame(loop);
}

document.addEventListener("visibilitychange", ensureRunning);

/**
 * Drive `tick` every animation frame while `host` is on screen. One shared rAF serves
 * every figure, and figures scrolled out of view cost nothing.
 */
export function animate(host: Element, tick: Tick): () => void {
  entries.set(host, { tick, visible: false });
  observer.observe(host);
  return () => {
    observer.unobserve(host);
    entries.delete(host);
  };
}
