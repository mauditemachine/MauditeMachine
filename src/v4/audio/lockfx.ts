/**
 * Les verrous DIST et CHORUS d'une voix du MM-RYTM (2026-10-09, l'etape 2 de
 * la refonte, Mika : "on doit ensuite avoir les FX du Voice selectionne") :
 * jusque-la NO LOCK a l'ecran, ces deux inserts de la tranche de la voix
 * (audio/drums.ts Channel) se verrouillent pas par pas comme ses envois
 * DELAY et REVERB (audio/sends.ts LockSend) : a l'instant du coup verrouille,
 * l'insert prend la valeur du pas, et la garde jusqu'au coup suivant de la
 * voix (verrouille ou non, qui remet la sienne), comme l'overdrive d'une
 * piste Elektron. La queue deja dans l'insert la prend avec (c'est la voix
 * qui change, pas le coup seul).
 * - une voix sans verrou de cet insert dans le motif : rien du tout (pas de
 *   tenue, pas un point : le son de toujours) ;
 * - une voix qui en a (hold) : l'insert reste engage, meme a son repos (sec
 *   1, mouille 0 : le meme signal), ses gains attendent les points ;
 * - un point par coup qui change la valeur (hit), retire si le coup est
 *   annule (cancel : STOP, re-programmation) ; un reglage de la voix tourne
 *   (glide efface ce qui etait programme) : les points a venir sont reposes
 *   (rebase).
 * Pur cote donnees : l'insert fait le son (audio/fx.ts buildDrive, audio/
 * chorus.ts buildChorus).
 */

/** Ce qu'il faut a l'insert : tenue, valeur a un instant, sa valeur a lui. */
export interface LockableInsert {
  lockHold?(on: boolean): void;
  lockAt?(when: number, v: number): void;
  value(): number;
}

interface Point {
  when: number;
  /** la valeur du pas, null : celle de la voix */
  v: number | null;
  tag: object;
}

export class InsertLocks {
  private pts: Point[] = [];
  private held = false;

  constructor(
    private c: BaseAudioContext,
    private stage: LockableInsert
  ) {}

  /** La voix a-t-elle un verrou de cet insert dans le motif ? Tenu engage tant qu'oui. */
  hold(on: boolean): void {
    if (on === this.held) return;
    this.held = on;
    this.stage.lockHold?.(on);
    if (!on) this.pts.length = 0;
  }

  get isHeld(): boolean {
    return this.held;
  }

  /** Les points deja passes s'en vont, sauf le dernier (il dit la valeur du moment). */
  private prune(): void {
    const now = this.c.currentTime;
    let keep = -1;
    for (let i = 0; i < this.pts.length; i += 1) if (this.pts[i].when <= now) keep = i;
    if (keep > 0) this.pts.splice(0, keep);
  }

  /** La valeur a l'instant t : celle du dernier point avant lui, sinon celle de la voix. */
  private valueAt(t: number): number {
    let v: number | null = null;
    let found = false;
    for (const p of this.pts) {
      if (p.when > t) break;
      v = p.v;
      found = true;
    }
    return found && v !== null ? v : this.stage.value();
  }

  /**
   * Un coup de la voix a when : lv, son verrou (null : la valeur de la voix).
   * true : un point pose (a retirer par cancel(tag) si le coup est annule).
   */
  hit(when: number, lv: number | null, tag: object): boolean {
    if (!this.held) return false;
    const v = lv === null || !Number.isFinite(lv) ? null : Math.min(1, Math.max(0, lv));
    if (v === null && this.pts.length === 0) return false;
    this.prune();
    const eff = v ?? this.stage.value();
    if (eff === this.valueAt(when)) return false;
    this.stage.lockAt?.(when, eff);
    let i = this.pts.length;
    while (i > 0 && this.pts[i - 1].when > when) i -= 1;
    this.pts.splice(i, 0, { when, v, tag });
    // Les points d'apres celui-ci (des coups deja programmes plus loin) gardent leur valeur
    for (let j = i + 1; j < this.pts.length; j += 1) this.stage.lockAt?.(this.pts[j].when, this.pts[j].v ?? this.stage.value());
    return true;
  }

  /** Le coup tag annule : son point s'en va, l'insert repart de ce qui vaut sans lui. */
  cancel(tag: object): void {
    const i = this.pts.findIndex((p) => p.tag === tag);
    if (i < 0) return;
    const t0 = this.pts[i].when;
    this.pts.splice(i, 1);
    const from = Math.max(t0, this.c.currentTime);
    this.stage.lockAt?.(from, this.valueAt(from));
    for (const p of this.pts) if (p.when > from) this.stage.lockAt?.(p.when, p.v ?? this.stage.value());
  }

  /** Un reglage de la voix vient de tourner (sa rampe a efface la suite) : les points a venir sont reposes. */
  rebase(): void {
    if (!this.held || this.pts.length === 0) return;
    const now = this.c.currentTime;
    for (const p of this.pts) if (p.when > now) this.stage.lockAt?.(p.when, p.v ?? this.stage.value());
  }

  info(): { held: boolean; points: number } {
    return { held: this.held, points: this.pts.length };
  }
}
