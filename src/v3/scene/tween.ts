/**
 * Tweens scalaires minimalistes : une liste, un update par frame, un
 * finishAll() pour sauter a la fin (clic pendant l'intro, reduced motion).
 * Aucune dependance : le chunk /v3 reste three + le code du site.
 */

export type Ease = (x: number) => number;

export const linear: Ease = (x) => x;
export const easeOutQuint: Ease = (x) => 1 - Math.pow(1 - x, 5);
export const easeOutCubic: Ease = (x) => 1 - Math.pow(1 - x, 3);
export const easeInCubic: Ease = (x) => x * x * x;
export const easeInOutCubic: Ease = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);
export const easeOutBack = (k = 1.70158): Ease => (x) => 1 + (k + 1) * Math.pow(x - 1, 3) + k * Math.pow(x - 1, 2);

interface Tween {
  from: number;
  to: number;
  start: number;
  dur: number;
  ease: Ease;
  set: (v: number) => void;
  onDone?: () => void;
  tag?: string;
  started: boolean;
}

export class Tweens {
  private list: Tween[] = [];

  /** Nombre de tweens encore vivants (reduced motion : rendu a la demande). */
  get alive(): number {
    return this.list.length;
  }

  /**
   * Lance un tween ; `delay` en secondes. Un tag permet d'annuler la
   * precedente animation de la meme cible (ex. "wrapA") sans la finir.
   */
  run(
    set: (v: number) => void,
    from: number,
    to: number,
    dur: number,
    ease: Ease,
    now: number,
    opts: { delay?: number; tag?: string; onDone?: () => void } = {}
  ): void {
    if (opts.tag) this.cancel(opts.tag);
    if (dur <= 0 && !opts.delay) {
      set(to);
      opts.onDone?.();
      return;
    }
    this.list.push({
      from,
      to,
      start: now + (opts.delay ?? 0),
      dur: Math.max(dur, 0.0001),
      ease,
      set,
      onDone: opts.onDone,
      tag: opts.tag,
      started: false,
    });
  }

  cancel(tag: string): void {
    this.list = this.list.filter((t) => t.tag !== tag);
  }

  update(now: number): void {
    if (!this.list.length) return;
    const done: Tween[] = [];
    for (const t of this.list) {
      if (now < t.start) continue;
      t.started = true;
      const x = Math.min(1, (now - t.start) / t.dur);
      t.set(t.from + (t.to - t.from) * t.ease(x));
      if (x >= 1) done.push(t);
    }
    if (done.length) {
      this.list = this.list.filter((t) => !done.includes(t));
      for (const t of done) t.onDone?.();
    }
  }

  /** Saute a la fin de tout ce qui court (intro sautee, reduced motion). */
  finishAll(): void {
    const l = this.list;
    this.list = [];
    for (const t of l) {
      t.set(t.to);
      t.onDone?.();
    }
  }

  clear(): void {
    this.list = [];
  }
}
