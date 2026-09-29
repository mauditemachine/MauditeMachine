/**
 * OPEN : la vue eclatee (spec 12), trois couches qui se separent.
 * 1. plateauGroup (pads, knobs, serigraphie, ecran) monte de 3.5 et
 *    s'incline de 12 deg autour de l'axe horizontal de l'ecran, pivot au
 *    centre de son dessus (theme.ts EXPLODE, signe en section 19) ;
 * 2. le PCB reste en place et se revele : pcbGroup visible des le depart,
 *    ses composants sortent de la carte (parts.scale.y 0.001 -> 1) ;
 * 3. socleGroup (ombre et mention comprises) descend de 1.5.
 * 900 ms easeInOutQuart par couche, 80 ms de decalage : ouverture plateau,
 * PCB, socle ; fermeture dans l'ordre inverse (socle, PCB, plateau), le
 * PCB se cache a la fin. Le cadrage (spec 3.4) suit la couche la plus
 * ecartee, max(plateau, socle) : a l'ouverture le plateau (sans decalage),
 * a la fermeture encore le plateau, qui ne redescend qu'apres 160 ms ; un
 * cadrage parti tout de suite coupait le haut du plateau encore leve sur
 * les ecrans larges (revue). Reduced motion : les deux etats extremes
 * seulement, poses a la frame suivante. Le sequenceur n'est jamais
 * touche : la musique continue.
 */

import { Vector3, type Object3D } from 'three';
import { EXPLODE, LAYERS } from '../theme';
import { easeInOutQuart } from './tween';

/** Axe horizontal de l'ecran : la droite de la camera. */
const AXIS = new Vector3(1, 0, -1).normalize();
const DEG = Math.PI / 180;
/** ouverture ou fermeture complete, decalages compris */
export const EXPLODE_TOTAL_MS = EXPLODE.ms + 2 * EXPLODE.staggerMs;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface ExplodeLayers {
  plateau: Object3D;
  /** pcbGroup : visible de l'ouverture a la fin de la fermeture */
  pcb: Object3D;
  /** les composants du PCB (echelle verticale) */
  parts: Object3D;
  socle: Object3D;
}

/** Progression (apres la courbe) de chaque couche et du cadrage, 0 ferme a 1 ouvert. */
export interface ExplodeProgress {
  plateau: number;
  pcb: number;
  socle: number;
  frame: number;
}

export interface ExplodeInfo extends ExplodeProgress {
  animating: boolean;
  /** vers ou va (ou est) la vue : true ouverte */
  open: boolean;
  plateauY: number;
  tiltDeg: number;
  socleY: number;
  partsScaleY: number;
  pcbVisible: boolean;
  /** animations terminees et duree mesuree de la derniere (ms, horloge des frames) */
  runs: number;
  lastMs: number;
}

export class Explode {
  readonly p: ExplodeProgress = { plateau: 0, pcb: 0, socle: 0, frame: 0 };
  /** 1 ouverture, -1 fermeture, 0 au repos */
  private dir: -1 | 0 | 1 = 0;
  private t0 = 0;
  private cut = false;
  private open = false;
  private runs = 0;
  private lastMs = 0;

  constructor(
    private layers: ExplodeLayers,
    /** fin d'une animation : la vue est posee ouverte (true) ou fermee */
    private onSettle: (open: boolean) => void
  ) {
    this.apply();
  }

  get animating(): boolean {
    return this.dir !== 0;
  }

  /**
   * Lance l'ouverture (open) ou la fermeture depuis l'etat pose. cut
   * (reduced motion) : l'etat final a la prochaine frame, sans animation.
   */
  start(open: boolean, now: number, cut: boolean): void {
    this.open = open;
    this.dir = open ? 1 : -1;
    this.t0 = now;
    this.cut = cut;
    this.layers.pcb.visible = true;
  }

  /** Etat final pose tout de suite (remontage, reinitialisation). */
  snap(open: boolean): void {
    this.open = open;
    this.dir = 0;
    const v = open ? 1 : 0;
    this.p.plateau = v;
    this.p.pcb = v;
    this.p.socle = v;
    this.p.frame = v;
    this.layers.pcb.visible = open;
    this.apply();
  }

  /** Progression d'une couche partie apres `delay` ms, t ms apres le depart (sans fermeture allouee par frame). */
  private k(t: number, delay: number): number {
    return easeInOutQuart(clamp01((t - delay) / EXPLODE.ms));
  }

  /** Animateur du Stage : true tant que les couches bougent (une frame par rAF). */
  update(now: number): boolean {
    if (this.dir === 0) return false;
    const t = this.cut ? Infinity : now - this.t0;
    const s = EXPLODE.staggerMs;
    const p = this.p;
    if (this.dir === 1) {
      p.plateau = this.k(t, 0);
      p.pcb = this.k(t, s);
      p.socle = this.k(t, 2 * s);
    } else {
      p.socle = 1 - this.k(t, 0);
      p.pcb = 1 - this.k(t, s);
      p.plateau = 1 - this.k(t, 2 * s);
    }
    // Le cadrage tient la couche la plus ecartee (le plateau leve, en haut)
    p.frame = Math.max(p.plateau, p.socle);
    this.apply();
    if (t >= EXPLODE_TOTAL_MS) {
      this.dir = 0;
      this.runs += 1;
      this.lastMs = this.cut ? 0 : now - this.t0;
      if (!this.open) this.layers.pcb.visible = false;
      this.onSettle(this.open);
    }
    return true;
  }

  private apply(): void {
    const { plateau, parts, socle } = this.layers;
    const p = this.p;
    plateau.position.y = LAYERS.plateauY + EXPLODE.lift * p.plateau;
    plateau.quaternion.setFromAxisAngle(AXIS, EXPLODE.tiltDeg * DEG * p.plateau);
    parts.scale.y = Math.max(EXPLODE.partsMin, p.pcb);
    socle.position.y = LAYERS.socleY - EXPLODE.drop * p.socle;
  }

  info(): ExplodeInfo {
    const r4 = (v: number): number => +v.toFixed(4);
    const { plateau, pcb, parts, socle } = this.layers;
    return {
      plateau: r4(this.p.plateau),
      pcb: r4(this.p.pcb),
      socle: r4(this.p.socle),
      frame: r4(this.p.frame),
      animating: this.animating,
      open: this.open,
      plateauY: r4(plateau.position.y),
      tiltDeg: r4(EXPLODE.tiltDeg * this.p.plateau),
      socleY: r4(socle.position.y),
      partsScaleY: r4(parts.scale.y),
      pcbVisible: pcb.visible,
      runs: this.runs,
      lastMs: +this.lastMs.toFixed(1),
    };
  }
}
