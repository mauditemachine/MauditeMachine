/**
 * OPEN : la vue eclatee sur le coin (spec 20.3.11 et 20.1 R2-8), trois
 * couches qui se separent sans jamais se traverser.
 * 1. plateauGroup (le panneau et tout ce qui est dessus) monte de 3.6,
 *    recule de 1.5 et s'incline de +5.7 deg (sa pente) a -12 deg (le bord
 *    avant monte, comme un capot), rotation autour de l'axe x de la
 *    machine passant par le centre du panneau ;
 * 2. le PCB, cache dans le chassis, sort de 0.9 (pcbGroup visible des le
 *    depart) et ses composants poussent de la carte (parts.scale.y 0.001 a
 *    1) ;
 * 3. le chassis (et le sol) ne bouge pas : la machine reste sur la table.
 * 900 ms easeInOutQuart par couche, 80 ms de decalage : a l'ouverture le
 * panneau part d'abord, le PCB ensuite ; a la fermeture le PCB redescend
 * d'abord, le panneau ensuite. Le PCB (1.52 de montee au plus, carte et
 * composants) reste ainsi toujours en retard sur le dessous du panneau
 * (2.2 de montee au moins) : aucune interpenetration a aucun instant. Le
 * cadrage suit la couche la plus ecartee, max(panneau, PCB). Reduced
 * motion : les deux etats extremes seulement, poses a la frame suivante.
 * Le sequenceur n'est jamais touche : la musique continue.
 */

import type { Object3D } from 'three';
import { EXPLODE, INTRO, LAYERS, TILT } from '../theme';
import { easeInOutCubic, easeInOutQuart } from './tween';

const DEG = Math.PI / 180;
/** ouverture ou fermeture complete, decalage compris */
export const EXPLODE_TOTAL_MS = EXPLODE.ms + EXPLODE.staggerMs;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);

export interface ExplodeLayers {
  plateau: Object3D;
  /** pcbGroup : visible de l'ouverture a la fin de la fermeture */
  pcb: Object3D;
  /** les composants du PCB (echelle verticale) */
  parts: Object3D;
}

/** Progression (apres la courbe) de chaque couche et du cadrage, 0 ferme a 1 ouvert. */
export interface ExplodeProgress {
  plateau: number;
  pcb: number;
  frame: number;
}

export interface ExplodeInfo extends ExplodeProgress {
  animating: boolean;
  /** vers ou va (ou est) la vue : true ouverte */
  open: boolean;
  plateauY: number;
  plateauZ: number;
  tiltDeg: number;
  pcbY: number;
  partsScaleY: number;
  pcbVisible: boolean;
  /** animations terminees et duree mesuree de la derniere (ms, horloge des frames) */
  runs: number;
  lastMs: number;
}

/**
 * La geometrie d'une ouverture : montee, recul et cabrage du capot, sortie
 * de la carte, et l'etat ferme (hauteurs, pente) ; la 808 par defaut, le
 * MM-VOYAGEUR a la sienne (2026-10-03).
 */
export interface ExplodeCfg {
  lift: number;
  slideZ: number;
  tiltOpenDeg: number;
  pcbRise: number;
  plateauY: number;
  pcbY: number;
  /** pente du capot ferme (rad) */
  tilt: number;
}

export const EXPLODE_808: ExplodeCfg = {
  lift: EXPLODE.lift,
  slideZ: EXPLODE.slideZ,
  tiltOpenDeg: EXPLODE.tiltOpenDeg,
  pcbRise: EXPLODE.pcbRise,
  plateauY: LAYERS.plateauY,
  pcbY: LAYERS.pcbY,
  tilt: TILT,
};

/** Pose des couches pour les progressions (panneau, PCB) : la meme fonction pour l'animation et les tests. */
export function applyLayers(layers: ExplodeLayers, plateau: number, pcb: number, cfg: ExplodeCfg = EXPLODE_808): void {
  const { plateau: pg, pcb: cg, parts } = layers;
  pg.position.set(pg.position.x, cfg.plateauY + cfg.lift * plateau, cfg.slideZ * plateau);
  pg.rotation.x = cfg.tilt + (cfg.tiltOpenDeg * DEG - cfg.tilt) * plateau;
  cg.position.y = cfg.pcbY + cfg.pcbRise * pcb;
  parts.scale.y = Math.max(EXPLODE.partsMin, pcb);
}

export class Explode {
  readonly p: ExplodeProgress = { plateau: 0, pcb: 0, frame: 0 };
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
    private onSettle: (open: boolean) => void,
    private cfg: ExplodeCfg = EXPLODE_808
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
    this.p.frame = v;
    this.layers.pcb.visible = open;
    this.apply();
  }

  /**
   * Intro (2026-10-01) : la machine eclatee s'assemble, t ms apres la
   * premiere frame (INTRO). Le store OPEN reste a closed : rien ne repond
   * comme vue ouverte (puces, pad OPEN) pendant l'assemblage.
   */
  assemble(t: number): void {
    this.open = false;
    this.dir = 0;
    const e = (from: number, ms: number): number => easeInOutCubic(clamp01((t - from) / ms));
    const p = this.p;
    p.pcb = 1 - e(INTRO.pcb.from, INTRO.pcb.ms);
    p.plateau = 1 - e(INTRO.plateau.from, INTRO.plateau.ms);
    p.frame = Math.max(p.plateau, p.pcb);
    this.layers.pcb.visible = p.frame > 0;
    this.apply();
  }

  /** Progression d'une couche partie apres `delay` ms, t ms apres le depart. */
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
    } else {
      p.pcb = 1 - this.k(t, 0);
      p.plateau = 1 - this.k(t, s);
    }
    // Le cadrage tient la couche la plus ecartee (le panneau leve, en haut)
    p.frame = Math.max(p.plateau, p.pcb);
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
    applyLayers(this.layers, this.p.plateau, this.p.pcb, this.cfg);
  }

  info(): ExplodeInfo {
    const r4 = (v: number): number => +v.toFixed(4);
    const { plateau, pcb, parts } = this.layers;
    return {
      plateau: r4(this.p.plateau),
      pcb: r4(this.p.pcb),
      frame: r4(this.p.frame),
      animating: this.animating,
      open: this.open,
      plateauY: r4(plateau.position.y),
      plateauZ: r4(plateau.position.z),
      tiltDeg: r4(plateau.rotation.x / DEG),
      pcbY: r4(pcb.position.y),
      partsScaleY: r4(parts.scale.y),
      pcbVisible: pcb.visible,
      runs: this.runs,
      lastMs: +this.lastMs.toFixed(1),
    };
  }
}
