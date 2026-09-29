/**
 * Tweens scalaires maison (spec 16.2, pas de dependance) : une liste, un
 * update par frame, une cle par cible (relancer une cle remplace son
 * tween). Temps en ms sur l'horloge de performance.now(), celle des rAF.
 * La boucle de rendu n'alloue rien : les tweens finis passent par un
 * tampon reutilise.
 */

export type Ease = (t: number) => number;

export const linear: Ease = (t) => t;
export const easeOutCubic: Ease = (t) => 1 - (1 - t) ** 3;
export const easeInOutCubic: Ease = (t) => (t < 0.5 ? 4 * t ** 3 : 1 - (-2 * t + 2) ** 3 / 2);
export const easeInOutQuart: Ease = (t) => (t < 0.5 ? 8 * t ** 4 : 1 - (-2 * t + 2) ** 4 / 2);

interface Tween {
  key: string;
  set: (v: number) => void;
  from: number;
  to: number;
  t0: number;
  dur: number;
  ease: Ease;
  /** recoit l'instant exact de fin : un tween enchaine part de la, pas de la frame */
  done?: (end: number) => void;
}

export class Tweens {
  private list: Tween[] = [];
  private ended: Tween[] = [];

  get alive(): number {
    return this.list.length;
  }

  run(key: string, set: (v: number) => void, from: number, to: number, dur: number, ease: Ease, now: number, done?: (end: number) => void): void {
    this.cancel(key);
    if (dur <= 0) {
      set(to);
      done?.(now);
      return;
    }
    set(from);
    this.list.push({ key, set, from, to, t0: now, dur, ease, done });
  }

  cancel(key: string): void {
    const l = this.list;
    for (let i = l.length - 1; i >= 0; i -= 1) if (l[i].key === key) l.splice(i, 1);
  }

  /** Avance tout a `now` ; true si une valeur a change (une frame a rendre). */
  update(now: number): boolean {
    const l = this.list;
    if (l.length === 0) return false;
    for (let i = l.length - 1; i >= 0; i -= 1) {
      const t = l[i];
      const x = Math.min(1, Math.max(0, (now - t.t0) / t.dur));
      t.set(t.from + (t.to - t.from) * t.ease(x));
      if (x >= 1) {
        l.splice(i, 1);
        this.ended.push(t);
      }
    }
    // Apres la boucle : un done peut relancer un tween sur la meme cle
    for (let i = 0; i < this.ended.length; i += 1) this.ended[i].done?.(this.ended[i].t0 + this.ended[i].dur);
    this.ended.length = 0;
    return true;
  }

  /** Saute a la fin de tout (geste pendant l'intro, reduced motion). */
  finishAll(): void {
    for (let guard = 0; this.list.length > 0 && guard < 8; guard += 1) this.update(Infinity);
  }

  clear(): void {
    this.list.length = 0;
    this.ended.length = 0;
  }
}
