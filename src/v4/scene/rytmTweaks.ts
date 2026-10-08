/**
 * TWEAKS du MM-RYTM (2026-10-04, Mika : "met un kick de 909 s'il te plait et
 * tweakable comme il faut dans le OPEN de la machine ; sous le capot, a la
 * place des liens de mauditemachine qui sont deja dans le header, un
 * systeme de Tweaks.. genre changement de samples pour les voices"). Ils
 * reglent le kit (audio/kit.ts) :
 * - KICK (son son : 909, 808, MM, puis les echantillons de Mika), ses
 *   TUNE, ATTACK, DECAY, DRIVE ;
 * - SNARE (son son), son SNAPPY, GATE (2026-10-04 : la reverbe a porte de
 *   la caisse claire et du clap, OFF ou ON) ;
 * - le son du clap, des charleys (HATS) et des toms (909, 808, MM).
 *
 * 2026-10-08 (Mika : "c'est moche des grosses cases par dessus un PCB..
 * avoir de la finesse design ici") : plus de plaque, les reglages sont
 * soudes sur la carte (scene/tweakplate.ts) : potards de precision,
 * glissieres, selecteurs a legende, groupes KICK, SNARE et VOICES en
 * cadres fins de serigraphie, un cartouche MM-RYTM / TWEAKS dans le coin.
 *
 * Le contenu est une donnee (RYTM_TWEAK_LAYOUT) : chaque reglage (son id
 * du kit, sa place), chaque groupe (son titre, son cadre), le cartouche et
 * la touche CLOSE. La lane R3 (les couches SYNTH et SAMPLE de KICK et
 * SNARE) change cette liste sans toucher au dessin : un reglage sans crans
 * est un potard, deux ou trois crans une glissiere, plus un selecteur
 * (scene/tweakplate.ts tweakKind). Cibles rk-<id>, vivantes capot ouvert
 * seulement (scene/renderer.ts, comme les puces).
 */

import type { HotspotDef } from './hit';
import { TweakPlate, tweakClearOf, type TweakGroup, type TweakItem, type TweakPlateDims, type TweakTitle } from './tweakplate';
import { GATE_LABELS, KIT_IDS, KIT_LABEL, isFamily, kit, kitStepLabels, kitSteps, type KitId } from '../audio/kit';
import { EXPLODE, LAYERS, PCB, PORTRAIT, TILT } from '../theme';

/** Un reglage de la liste : l'id du kit et sa place (repere de la zone : x a droite, z vers soi). */
export interface RytmTweakSlot {
  id: KitId;
  x: number;
  z: number;
  /** les bouts de course d'un potard */
  ends?: readonly [string, string];
}

/** La mise en page des TWEAKS : la zone sur la carte, les reglages, les groupes, le cartouche, CLOSE. */
export interface RytmTweakLayout {
  dims: TweakPlateDims;
  cellW: number;
  slots: readonly RytmTweakSlot[];
  groups: readonly TweakGroup[];
  title: TweakTitle;
  close: { x: number; z: number; w: number; d: number; y: number };
}

/**
 * Desktop : deux rangees sur l'avant de la carte (la ou etaient la plaque
 * et, avant elle, les puces) ; KICK en haut (le selecteur a legende puis
 * TUNE, ATTACK, DECAY, DRIVE), le cartouche a droite et CLOSE dessous ;
 * SNARE (selecteur, SNAPPY, GATE) et VOICES (CLAP, HATS, TOMS) en bas.
 * Portrait : la carte debout, trois colonnes, le cartouche en tete.
 */
export const RYTM_TWEAK_LAYOUT: RytmTweakLayout = PORTRAIT
  ? (() => {
      // Les rangees, et les cadres : 1.02 au-dessus d'une rangee (le titre du groupe, puis le nom), 0.66 dessous
      const R = [-1.98, -0.13, 1.87, 3.87];
      const C = [-2.15, 0, 2.15];
      return {
        dims: { cx: 0, cz: 0, w: 6.6, d: 10.6 },
        cellW: 2.05,
        slots: [
          { id: 'bd', x: -2.55, z: R[0] },
          { id: 'tune', x: C[2], z: R[0], ends: ['LOW', 'HIGH'] },
          { id: 'attack', x: C[0], z: R[1], ends: ['SOFT', 'HARD'] },
          { id: 'decay', x: C[1], z: R[1], ends: ['SHORT', 'LONG'] },
          { id: 'drive', x: C[2], z: R[1], ends: ['CLEAN', 'HOT'] },
          { id: 'sd', x: -2.55, z: R[2] },
          { id: 'snappy', x: 1.0, z: R[2], ends: ['TONE', 'SNAP'] },
          { id: 'gate', x: 2.45, z: R[2] },
          { id: 'cp', x: C[0], z: R[3] },
          { id: 'hh', x: C[1], z: R[3] },
          { id: 'tom', x: C[2], z: R[3] },
        ],
        groups: [
          { title: 'KICK', x0: -3.15, z0: R[0] - 1.02, x1: 3.15, z1: R[1] + 0.66, accent: true },
          { title: 'SNARE', x0: -3.15, z0: R[2] - 1.02, x1: 3.15, z1: R[2] + 0.66 },
          { title: 'VOICES', x0: -3.15, z0: R[3] - 1.02, x1: 3.15, z1: R[3] + 0.66 },
        ],
        title: { x0: -3.15, z0: -4.2, x1: 3.15, z1: -3.35, name: 'MM-RYTM', sub: 'DRUM VOICES', rev: 'REV 1.0 / 2026' },
        close: { x: 2.2, z: -3.77, w: 1.5, d: 0.5, y: 0.01 },
      };
    })()
  : (() => {
      const A = -0.66;
      const B = 0.92;
      return {
        dims: { cx: 0, cz: 1.25, w: 10.2, d: 3.4 },
        cellW: 1.12,
        slots: [
          { id: 'bd', x: -4.45, z: A },
          { id: 'tune', x: -1.62, z: A, ends: ['LOW', 'HIGH'] },
          { id: 'attack', x: -0.5, z: A, ends: ['SOFT', 'HARD'] },
          { id: 'decay', x: 0.62, z: A, ends: ['SHORT', 'LONG'] },
          { id: 'drive', x: 1.74, z: A, ends: ['CLEAN', 'HOT'] },
          { id: 'sd', x: -4.45, z: B },
          { id: 'snappy', x: -2.05, z: B, ends: ['TONE', 'SNAP'] },
          { id: 'gate', x: -0.85, z: B },
          { id: 'cp', x: 1.15, z: B },
          { id: 'hh', x: 2.6, z: B },
          { id: 'tom', x: 4.05, z: B },
        ],
        groups: [
          { title: 'KICK', x0: -4.95, z0: A - 0.62, x1: 2.3, z1: A + 0.52, accent: true },
          { title: 'SNARE', x0: -4.95, z0: B - 0.62, x1: -0.2, z1: B + 0.52 },
          { title: 'VOICES', x0: 0.2, z0: B - 0.62, x1: 4.95, z1: B + 0.52 },
        ],
        title: { x0: 2.7, z0: A - 0.62, x1: 4.95, z1: A - 0.05, name: 'MM-RYTM', sub: 'DRUM VOICES', rev: 'REV 1.0' },
        close: { x: 4.95 - 0.47, z: A + 0.2, w: 0.94, d: 0.25, y: 0.01 },
      };
    })();

/** La zone (repere de la carte : son centre ; puis la sienne, x a droite, z vers soi). */
export const RYTM_TWEAK_PLATE: TweakPlateDims = RYTM_TWEAK_LAYOUT.dims;

/**
 * Le cadrage ouvert (renderer, OPEN_VIEW ; 2026-10-08, Mika : "deja c'est
 * super zoome") : le pivot sur le dessus de la carte sortie, un peu derriere
 * son centre (le bord du capot leve se devine en haut), la largeur a tenir :
 * la carte entiere (debout au telephone). La carte suit la pente du
 * panneau : son dessus descend vers soi de tan(TILT).
 */
export const RYTM_OPEN_FRAME = (() => {
  const z = PORTRAIT ? 0 : -0.15;
  return { y: LAYERS.pcbY + EXPLODE.pcbRise + PCB.h - z * Math.tan(TILT), z, w: PORTRAIT ? PCB.d : PCB.w };
})();

/** La zone degagee de la carte (scene/pcb.ts clear) : les cadres et le cartouche, avec leur marge. */
export function rytmTweakClear(): { x0: number; x1: number; z0: number; z1: number } {
  const L = RYTM_TWEAK_LAYOUT;
  return tweakClearOf(L.dims, L.groups, L.title);
}

/**
 * CLOSE dans le MM-RYTM ouvert (2026-10-05, Mika : "quand on clique sur OPEN
 * on devrait voir un CLOSE a l'interieur de la machine, voyant") : desktop,
 * sous le cartouche (au telephone, ui/PcbClose.tsx). Repere de la zone
 * (ui/HoodClose.tsx).
 */
export const RYTM_CLOSE_KEY = RYTM_TWEAK_LAYOUT.close;

function items(): TweakItem[] {
  return KIT_IDS.map((id) => {
    const slot = RYTM_TWEAK_LAYOUT.slots.find((s) => s.id === id) ?? { id, x: 0, z: 0 };
    const sw = kitSteps(id) > 1;
    return {
      hotspot: `rk-${id}`,
      label: KIT_LABEL[id],
      x: slot.x,
      z: slot.z,
      // Un choix de son : 909, 808, MM, puis le nom de chaque echantillon de Mika (audio/samples.ts)
      ...(sw ? { steps: isFamily(id) ? kitStepLabels(id) : GATE_LABELS } : {}),
      ...(slot.ends ? { ends: slot.ends } : {}),
    };
  });
}

export class RytmTweaks extends TweakPlate {
  constructor(opts: { mobile: boolean; anisotropy: number }) {
    const L = RYTM_TWEAK_LAYOUT;
    super({ name: 'rytmTweaks', dims: L.dims, items: items(), groups: L.groups, title: L.title, cellW: L.cellW }, opts);
    this.sync();
  }

  /**
   * Les potards et commutateurs suivent le kit ; un choix de son suit aussi
   * ses crans (echantillons du dossier du site : leurs noms a la legende).
   * true s'il faut une frame.
   */
  sync(): boolean {
    let changed = false;
    let relabel = false;
    KIT_IDS.forEach((id, i) => {
      const it = this.spec.items[i];
      if (isFamily(id) && it) {
        const labels = kitStepLabels(id);
        if (!it.steps || it.steps.length !== labels.length || it.steps.some((l, k) => l !== labels[k])) {
          it.steps = labels;
          relabel = true;
        }
      }
    });
    if (relabel) {
      this.restep();
      changed = true;
    }
    KIT_IDS.forEach((id, i) => {
      if (this.setAt(i, kit.value(id))) changed = true;
    });
    if (relabel) this.draw();
    return changed;
  }

  /** Les cibles du picking : une par reglage (la piece et sa serigraphie), coupees capot ferme. */
  hotspots(): HotspotDef[] {
    return KIT_IDS.map((id, i) => {
      const h = this.hitOf(i);
      return {
        id: this.spec.items[i].hotspot,
        kind: 'rknob' as const,
        layer: this.top,
        shape: h.shape,
        x: h.x,
        z: h.z,
        hx: h.hx,
        hz: h.hz,
        y0: 0,
        y1: h.y1,
        enabled: false,
        rknob: id,
      };
    });
  }

  info(): { ids: readonly KitId[]; angleDeg: number[]; draws: number; kinds: string[] } {
    return { ids: KIT_IDS, angleDeg: this.angles(), draws: this.draws, kinds: KIT_IDS.map((_, i) => this.kindAt(i)) };
  }
}
