/**
 * TWEAKS du MM-RYTM (2026-10-04, Mika : "met un kick de 909 s'il te plait et
 * tweakable comme il faut dans le OPEN de la machine ; sous le capot, a la
 * place des liens de mauditemachine qui sont deja dans le header, un
 * systeme de Tweaks.. genre changement de samples pour les voices"). La
 * plaque (scene/tweakplate.ts, la meme que celle du MM-ARP) remplace les
 * puces des pages sur la carte, et regle le kit (audio/kit.ts) :
 * - KICK (son son : 909, 808, MM), puis ses TUNE, ATTACK, DECAY, DRIVE ;
 * - le son de la caisse claire (SNARE, et son SNAPPY), du clap, des
 *   charleys (HATS), des toms et du rim (909, 808, MM : des commutateurs a
 *   trois crans) ;
 * - GATE (2026-10-04) : la reverbe a porte de la caisse claire et du clap,
 *   OFF ou ON (un commutateur a deux crans, entre CLAP et HATS).
 * Desktop : deux rangees de sept, devant les composants (la ou etaient les
 * puces), le titre sur les deux dernieres cases du haut ; portrait : quatre
 * rangees de trois, debout, le titre en tete. Cibles rk-<id>, vivantes
 * capot ouvert seulement (scene/renderer.ts, comme les puces).
 */

import type { HotspotDef } from './hit';
import { TweakPlate, type TweakItem, type TweakPlateDims } from './tweakplate';
import { GATE_LABELS, KIT_IDS, KIT_LABEL, KIT_MODEL_LABEL, KIT_MODELS, isFamily, kit, kitSteps, type KitId } from '../audio/kit';
import { PORTRAIT } from '../theme';

/** La plaque (repere de la carte : son centre ; puis le sien, x a droite, z vers soi). */
export const RYTM_TWEAK_PLATE: TweakPlateDims = PORTRAIT
  ? { cx: -0.2, cz: 0, w: 6.3, d: 9.9, y: 0.5, t: 0.08, r: 0.12, screwIn: 0.17, frame: 0.28, label: 0.15, end: 0.09, title: 0.3 }
  : { cx: 0, cz: 1.2, w: 10.2, d: 3.95, y: 0.5, t: 0.08, r: 0.12, screwIn: 0.22, frame: 0.3, label: 0.12, end: 0.072, title: 0.26 };

/**
 * La place de la plaque sur la carte (repere de la carte, avec 0.3 de marge) :
 * aucun composant de decor n'y est pose (scene/pcb.ts clear). En portrait,
 * la plaque tourne d'un quart de tour par rapport a la carte : ses cotes
 * s'echangent.
 */
export function rytmTweakClear(): { x0: number; x1: number; z0: number; z1: number } {
  const P = RYTM_TWEAK_PLATE;
  const hx = (PORTRAIT ? P.d : P.w) / 2 + 0.3;
  const hz = (PORTRAIT ? P.w : P.d) / 2 + 0.3;
  return { x0: P.cx - hx, x1: P.cx + hx, z0: P.cz - hz, z1: P.cz + hz };
}

const COLS = PORTRAIT ? [-2.0, 0, 2.0] : [-4.05, -2.7, -1.35, 0, 1.35, 2.7, 4.05];
const ROWS = PORTRAIT ? [-2.55, -0.38, 1.79, 3.96] : [-0.5, 1.2];
/** Le titre : desktop sur les deux dernieres cases du haut, portrait en tete de plaque. */
const TITLE = PORTRAIT ? { x: 0, z: -4.1, w: 4 } : { x: (COLS[5] + COLS[6]) / 2, z: ROWS[0] - 0.1, w: 2.4 };
/** L'echelle des potards (desktop un peu plus petits depuis la septieme colonne, 2026-10-04) ; les commutateurs plus petits. */
const KNOB_S = PORTRAIT ? 1.55 : 1.25;
const SWITCH_S = PORTRAIT ? 0.82 : 0.8;

/** Les cases : desktop KICK puis VOICES en deux rangees de sept ; portrait quatre rangees de trois. */
const CELLS: readonly [KitId, number, number][] = PORTRAIT
  ? [
      ['bd', 0, 0],
      ['tune', 1, 0],
      ['attack', 2, 0],
      ['decay', 0, 1],
      ['drive', 1, 1],
      ['hh', 2, 1],
      ['sd', 0, 2],
      ['snappy', 1, 2],
      ['gate', 2, 2],
      ['cp', 0, 3],
      ['tom', 1, 3],
      ['rs', 2, 3],
    ]
  : [
      ['bd', 0, 0],
      ['tune', 1, 0],
      ['attack', 2, 0],
      ['decay', 3, 0],
      ['drive', 4, 0],
      ['sd', 0, 1],
      ['snappy', 1, 1],
      ['cp', 2, 1],
      ['gate', 3, 1],
      ['hh', 4, 1],
      ['tom', 5, 1],
      ['rs', 6, 1],
    ];

/** Les bouts de course des potards (0, 10). */
const ENDS: Partial<Record<KitId, readonly [string, string]>> = {
  tune: ['LOW', 'HIGH'],
  attack: ['SOFT', 'HARD'],
  decay: ['SHORT', 'LONG'],
  drive: ['CLEAN', 'HOT'],
  snappy: ['TONE', 'SNAP'],
};

const cellOf = (id: KitId): { x: number; z: number } => {
  const c = CELLS.find((k) => k[0] === id);
  const [, col, row] = c ?? [id, 0, 0];
  return { x: COLS[col], z: ROWS[row] };
};

function items(): TweakItem[] {
  return KIT_IDS.map((id) => {
    const { x, z } = cellOf(id);
    const sw = kitSteps(id) > 1;
    return {
      hotspot: `rk-${id}`,
      label: KIT_LABEL[id],
      x,
      z,
      s: sw ? KNOB_S * SWITCH_S : KNOB_S,
      ...(sw ? { steps: isFamily(id) ? KIT_MODELS.map((m) => KIT_MODEL_LABEL[m]) : GATE_LABELS } : {}),
      ...(ENDS[id] ? { ends: ENDS[id] } : {}),
    };
  });
}

export class RytmTweaks extends TweakPlate {
  constructor(opts: { mobile: boolean; anisotropy: number }) {
    super(
      {
        name: 'rytmTweaks',
        dims: RYTM_TWEAK_PLATE,
        items: items(),
        title: { x: TITLE.x, z: TITLE.z, w: TITLE.w, sub: 'DRUM VOICES', model: 'MM-RYTM R1.0' },
        cellW: (PORTRAIT ? 2.0 : 1.35) - 0.12,
      },
      opts
    );
    this.sync();
  }

  /** Les potards et commutateurs suivent le kit ; true s'il faut une frame. */
  sync(): boolean {
    let changed = false;
    KIT_IDS.forEach((id, i) => {
      if (this.setAt(i, kit.value(id))) changed = true;
    });
    return changed;
  }

  /** Les cibles du picking : un cylindre par reglage, coupees capot ferme. */
  hotspots(): HotspotDef[] {
    return KIT_IDS.map((id, i) => {
      const it = this.spec.items[i];
      const r = this.hitR(it);
      return {
        id: it.hotspot,
        kind: 'rknob' as const,
        layer: this.top,
        shape: 'disc' as const,
        x: it.x,
        z: it.z,
        hx: r,
        hz: r,
        y0: 0,
        y1: this.hitY(it),
        enabled: false,
        rknob: id,
      };
    });
  }

  info(): { ids: readonly KitId[]; angleDeg: number[]; draws: number } {
    return { ids: KIT_IDS, angleDeg: this.angles(), draws: this.draws };
  }
}
