/**
 * Metronome 130 BPM en doubles-croches : un repere LUMINEUX qui demarre
 * quand la lecture demarre. Ce n'est pas une synchro avec le morceau et
 * l'interface ne le pretend jamais.
 */

export const STEP_MS = 60000 / 130 / 4; // 115.38 ms

export class BeatClock {
  private startAt = -1;

  start(nowMs: number): void {
    this.startAt = nowMs;
  }

  stop(): void {
    this.startAt = -1;
  }

  get running(): boolean {
    return this.startAt >= 0;
  }

  /** Pas courant 0..15, ou -1 a l'arret. */
  step(nowMs: number): number {
    if (this.startAt < 0) return -1;
    return Math.floor((nowMs - this.startAt) / STEP_MS) % 16;
  }
}
