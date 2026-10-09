/**
 * Insert a bypass reel (revision 5) : TONE et STRETCH. Au repos, l'entree
 * est branchee DIRECTEMENT sur la sortie : aucun noeud de traitement dans
 * le graphe, pas meme un gain a 1. Engage, le signal passe par deux gains
 * en fondu de 20 ms : sec (entree -> sortie) et mouille (branche ->
 * sortie). Retour au repos : sec a 1 et mouille a 0 en 20 ms, puis la
 * branche est debranchee et le sec remplace par le lien direct (meme
 * signal, echange dans la meme tache : aucun saut).
 *
 *   repos   : in ------------------------------> out
 *   engage  : in -> sec (1 - m) ---------------> out
 *             in -> branche -> mouille (m) ----> out
 */

import { glide } from './glide';

/** Debranchement apres la rampe de 20 ms, avec une marge. */
export const UNLINK_MS = 60;

export interface InsertInfo {
  /** true : entree branchee directement sur la sortie, rien d'autre */
  direct: boolean;
  /** branche de traitement reliee a l'entree */
  linked: boolean;
  dry: number;
  wet: number;
  unlinks: number;
}

export class Insert {
  private dryGain: GainNode | null = null;
  private wetGain: GainNode | null = null;
  private branchIn: AudioNode | null = null;
  private branchOut: AudioNode | null = null;
  private direct = true;
  private linked = false;
  private dry = 1;
  private wet = 0;
  private timer: ReturnType<typeof setTimeout> | undefined;
  private unlinks = 0;
  /**
   * Tenu engage (2026-10-09, les verrous DIST et CHORUS d'une voix du
   * MM-RYTM, audio/lockfx.ts) : une voix qui a un verrou de cet insert garde
   * sa branche reliee meme a son repos (sec 1, mouille 0 : le meme signal),
   * pour que le coup verrouille trouve ses gains a l'instant ou il joue.
   */
  private held = false;
  /** appele quand la branche est debranchee (repos atteint) */
  onIdle: (() => void) | null = null;

  constructor(
    private c: BaseAudioContext,
    private inp: AudioNode,
    private out: AudioNode
  ) {
    inp.connect(out);
  }

  /** La branche de traitement (TONE : passe-haut et passe-bas ; STRETCH : le worklet). */
  setBranch(bIn: AudioNode, bOut: AudioNode): void {
    if (this.branchIn === bIn && this.branchOut === bOut) return;
    if (this.linked && this.branchIn) this.inp.disconnect(this.branchIn);
    this.linked = false;
    if (this.branchOut && this.wetGain) this.branchOut.disconnect(this.wetGain);
    this.branchIn = bIn;
    this.branchOut = bOut;
    if (this.wetGain) bOut.connect(this.wetGain);
  }

  get hasBranch(): boolean {
    return this.branchIn !== null;
  }

  /** Engage (ou suit) : sec et mouille en fondu de 20 ms. */
  engage(dry: number, wet: number): void {
    if (!this.branchIn || !this.branchOut) return;
    clearTimeout(this.timer);
    this.timer = undefined;
    if (this.direct) {
      // Le lien direct devient un gain a 1 : meme signal, meme tache
      const d = this.c.createGain();
      d.gain.value = 1;
      this.inp.connect(d);
      d.connect(this.out);
      this.inp.disconnect(this.out);
      this.dryGain = d;
      this.direct = false;
    }
    if (!this.wetGain) {
      const w = this.c.createGain();
      w.gain.value = 0;
      this.branchOut.connect(w);
      w.connect(this.out);
      this.wetGain = w;
    }
    if (!this.linked) {
      this.inp.connect(this.branchIn);
      this.linked = true;
    }
    this.dry = dry;
    this.wet = wet;
    if (this.dryGain) glide(this.dryGain.gain, dry, this.c);
    glide(this.wetGain.gain, wet, this.c);
  }

  /**
   * Tenu engage ou non (audio/lockfx.ts) : tenu, l'insert au repos passe par
   * ses gains (sec 1, mouille 0) ; lache, il revient au lien direct s'il est
   * au repos, sinon ses gains reviennent a la valeur de la voix (revue du
   * 2026-10-09 : le dernier verrou retire laissait l'insert a la valeur du
   * dernier coup verrouille, les points programmes compris).
   */
  hold(on: boolean): void {
    if (on === this.held) return;
    this.held = on;
    if (on) {
      // Un retour au lien direct en attente (un release juste avant) n'a plus lieu
      clearTimeout(this.timer);
      this.timer = undefined;
      if (this.direct) this.engage(1, 0);
    } else if (this.dry === 1 && this.wet === 0) this.release();
    else this.engage(this.dry, this.wet);
  }

  get isHeld(): boolean {
    return this.held;
  }

  /**
   * Le sec et le mouille a l'instant when (un coup verrouille, a l'avance) :
   * seulement engage (tenu) ; false sinon. Les rampes d'un reglage ulterieur
   * (glide) les effacent : audio/lockfx.ts les repose.
   */
  at(when: number, dry: number, wet: number): boolean {
    if (this.direct || !this.dryGain || !this.wetGain) return false;
    const t = Math.max(when, this.c.currentTime);
    this.dryGain.gain.setValueAtTime(dry, t);
    this.wetGain.gain.setValueAtTime(wet, t);
    return true;
  }

  /** Retour au repos : fondu vers le sec, puis lien direct et branche debranchee (tenu : les gains restent). */
  release(): void {
    if (this.direct) return;
    this.dry = 1;
    this.wet = 0;
    if (this.dryGain) glide(this.dryGain.gain, 1, this.c);
    if (this.wetGain) glide(this.wetGain.gain, 0, this.c);
    clearTimeout(this.timer);
    if (this.held) return;
    this.timer = setTimeout(() => {
      this.timer = undefined;
      this.toDirect();
    }, UNLINK_MS);
  }

  /** Repos immediat (demontage) : aucun fondu. */
  reset(): void {
    clearTimeout(this.timer);
    this.timer = undefined;
    this.held = false;
    this.dry = 1;
    this.wet = 0;
    this.toDirect();
  }

  private toDirect(): void {
    if (this.linked && this.branchIn) {
      this.inp.disconnect(this.branchIn);
      this.linked = false;
      this.unlinks += 1;
    }
    if (!this.direct) {
      this.inp.connect(this.out);
      if (this.dryGain) {
        this.inp.disconnect(this.dryGain);
        this.dryGain.disconnect();
      }
      this.dryGain = null;
      this.direct = true;
    }
    if (this.wetGain) {
      this.branchOut?.disconnect(this.wetGain);
      this.wetGain.disconnect();
      this.wetGain = null;
    }
    this.onIdle?.();
  }

  info(): InsertInfo {
    return { direct: this.direct, linked: this.linked, dry: this.dry, wet: this.wet, unlinks: this.unlinks };
  }
}
