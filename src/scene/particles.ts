import { setAttr } from "../ui/dom";

interface Placement {
  x: number;
  y: number;
  scale: number;
  opacity: number;
}

interface Particle {
  el: SVGGElement;
  age: number;
  life: number;
  active: boolean;
}

const MAX_PARTICLES = 16;

/**
 * A small recycled pool of short-lived decorations (smoke puffs, items on a belt). Each
 * particle's look is a pure function of its progress k ∈ [0, 1).
 */
export class ParticlePool {
  private readonly pool: Particle[] = [];
  private timer = 0;

  constructor(
    private readonly layer: SVGGElement,
    private readonly make: () => SVGGElement,
    private readonly life: number,
    private readonly place: (k: number, seed: number) => Placement,
  ) {}

  /** Spawn at `perSecond`, then move every live particle along its path. */
  update(dt: number, perSecond: number): void {
    this.timer -= dt;
    if (perSecond > 0 && this.timer <= 0) {
      this.timer = 1 / perSecond;
      this.spawn();
    }
    this.pool.forEach((p, seed) => {
      if (!p.active) return;
      p.age += dt;
      const k = p.age / p.life;
      if (k >= 1) {
        p.active = false;
        setAttr(p.el, "opacity", 0);
        return;
      }
      const at = this.place(k, seed);
      setAttr(p.el, "transform", `translate(${at.x.toFixed(1)} ${at.y.toFixed(1)}) scale(${at.scale.toFixed(3)})`);
      setAttr(p.el, "opacity", at.opacity.toFixed(2));
    });
  }

  clear(): void {
    for (const p of this.pool) p.el.remove();
    this.pool.length = 0;
  }

  private spawn(): void {
    let p = this.pool.find((q) => !q.active);
    if (!p) {
      if (this.pool.length >= MAX_PARTICLES) return;
      p = { el: this.make(), age: 0, life: this.life, active: false };
      this.pool.push(p);
      this.layer.append(p.el);
    }
    p.active = true;
    p.age = 0;
    // A little deterministic variety in lifetime per slot.
    p.life = this.life * (0.9 + ((this.pool.indexOf(p) * 0.137) % 0.2));
  }
}
