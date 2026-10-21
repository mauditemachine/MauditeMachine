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

import { GLIDE_S, glide, pointAt } from './glide';

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

/**
 * Un debranchement qui ne leve jamais (2026-10-21, audit RS-3) : le navigateur leve InvalidAccessError quand le lien
 * n'existe plus (une branche deja demontee) ; un lien absent est deja ce qu'on veut.
 */
function cut(from: AudioNode | null, to: AudioNode): void {
  if (!from) return;
  try {
    from.disconnect(to);
  } catch {
    /* deja debranche */
  }
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
  /**
   * Pas de rampe avant cet instant (2026-10-21, audit F4, temps du contexte) : une branche neuve dont les lignes se
   * remplissent (le CHORUS : ses retards partent vides, le mouille arrivait d'un coup a 14 et 21 ms, deux clics) ;
   * le sec et le mouille restent ou ils sont jusque-la, puis glissent en 20 ms. 0 : tout de suite, comme avant.
   */
  private notBefore = 0;
  /** appele quand la branche est debranchee (repos atteint) */
  onIdle: (() => void) | null = null;

  constructor(
    private c: BaseAudioContext,
    private inp: AudioNode,
    private out: AudioNode
  ) {
    inp.connect(out);
  }

  /**
   * La branche de traitement (TONE : passe-haut et passe-bas ; STRETCH : le worklet). Une branche remplacee
   * engagee (le CHORUS qui passe au worklet) : la neuve est reliee a l'entree tout de suite, l'ancienne n'y est plus.
   */
  setBranch(bIn: AudioNode, bOut: AudioNode): void {
    if (this.branchIn === bIn && this.branchOut === bOut) return;
    const was = this.linked;
    if (this.linked) cut(this.inp, this.branchIn as AudioNode);
    this.linked = false;
    if (this.wetGain) cut(this.branchOut, this.wetGain);
    this.branchIn = bIn;
    this.branchOut = bOut;
    if (this.wetGain) bOut.connect(this.wetGain);
    if (was && !this.direct) {
      this.inp.connect(bIn);
      this.linked = true;
    }
  }

  /** Les rampes suivantes partent au plus tot a t (temps du contexte), audio/chorus.ts : une branche neuve qui se remplit. */
  holdRampsUntil(t: number): void {
    this.notBefore = t;
  }

  /** Une rampe de 20 ms vers v, partie maintenant ou a notBefore si la branche se remplit encore. */
  private ramp(p: AudioParam, v: number): void {
    const now = this.c.currentTime;
    if (this.notBefore <= now) {
      glide(p, v, this.c);
      return;
    }
    p.cancelScheduledValues(now);
    p.setValueAtTime(p.value, now);
    p.setValueAtTime(p.value, this.notBefore);
    p.linearRampToValueAtTime(v, this.notBefore + GLIDE_S);
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
    if (this.dryGain) this.ramp(this.dryGain.gain, dry);
    this.ramp(this.wetGain.gain, wet);
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
   * (glide) les effacent : audio/lockfx.ts les repose. prev (2026-10-21, audit
   * F14) : le sec et le mouille d'avant ce point ; donnes, le point est une
   * rampe de 3 ms qui finit au coup (la queue d'avant ne prend plus de marche).
   */
  at(when: number, dry: number, wet: number, prev?: { dry: number; wet: number }): boolean {
    if (this.direct || !this.dryGain || !this.wetGain) return false;
    // Une branche neuve qui se remplit encore : le point attend qu'elle soit pleine
    const t = Math.max(when, this.c.currentTime, this.notBefore);
    if (prev) {
      pointAt(this.dryGain.gain, prev.dry, dry, t, this.c);
      pointAt(this.wetGain.gain, prev.wet, wet, t, this.c);
    } else {
      this.dryGain.gain.setValueAtTime(dry, t);
      this.wetGain.gain.setValueAtTime(wet, t);
    }
    return true;
  }

  /**
   * Les points poses a partir de t s'en vont (2026-10-21 : un coup verrouille annule, sa rampe de 3 ms comprise) ;
   * les gains gardent la valeur du point d'avant.
   */
  clearFrom(t: number): void {
    if (!this.dryGain || !this.wetGain) return;
    const at = Math.max(t, this.c.currentTime);
    this.dryGain.gain.cancelScheduledValues(at);
    this.wetGain.gain.cancelScheduledValues(at);
  }

  /** Retour au repos : fondu vers le sec, puis lien direct et branche debranchee (tenu : les gains restent). */
  release(): void {
    if (this.direct) return;
    this.dry = 1;
    this.wet = 0;
    // Le retour au repos part tout de suite (une branche qui se remplissait n'a plus a attendre)
    this.notBefore = 0;
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
    // Chaque debranchement tolere un lien deja parti (2026-10-21, audit RS-3 : apres un CHORUS passe au worklet en
    // echec, celui-ci levait aussi, le mouille restait branche et la branche n'etait jamais rendue)
    if (this.linked && this.branchIn) {
      cut(this.inp, this.branchIn);
      this.linked = false;
      this.unlinks += 1;
    }
    if (!this.direct) {
      this.inp.connect(this.out);
      if (this.dryGain) {
        cut(this.inp, this.dryGain);
        this.dryGain.disconnect();
      }
      this.dryGain = null;
      this.direct = true;
    }
    if (this.wetGain) {
      cut(this.branchOut, this.wetGain);
      this.wetGain.disconnect();
      this.wetGain = null;
    }
    this.notBefore = 0;
    this.onIdle?.();
  }

  info(): InsertInfo {
    return { direct: this.direct, linked: this.linked, dry: this.dry, wet: this.wet, unlinks: this.unlinks };
  }
}
