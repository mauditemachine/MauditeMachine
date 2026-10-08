/**
 * TWEAKS du MM-BASS (2026-10-08, Mika : "un bouton OPEN, et dans le OPEN des
 * parametres plus particuliers") : la plaque sous le capot
 * (scene/tweakplate.ts, celle du MM-RYTM et du MM-ARP) porte ce qu'on regle
 * une fois par morceau, pour que la face reste simple :
 * - GENERATOR : SLIDE PROB, ACC PROB (les chances qu'une
 *   note glisse ou soit accentuee quand GEN ecrit une ligne), RANGE (un
 *   commutateur a trois crans, l'etendue en octaves), ROOT (la tonique, ou
 *   ARP), SCALE ;
 * - VOICE : LENGTH (la longueur des notes, AUTO : celle du style), ACC DECAY,
 *   SWEEP, RELEASE, SUB OCT (un commutateur : une ou deux octaves sous la
 *   note), TUNE (cran au milieu).
 * 2026-10-08 (Mika : "c'est moche des grosses cases par dessus un PCB..
 * avoir de la finesse design ici") : plus de plaque, ils sont soudes sur la
 * carte (bass/theme.ts, la zone et les places) : potards de precision,
 * RANGE et SUB OCT en glissieres, TUNE a cran central, les groupes
 * GENERATOR et VOICE en cadres fins de serigraphie, le cartouche, INFOS et
 * CLOSE dessous. Cibles bass-tw-<id>, du meme genre que les potards de la
 * face (bassknob) : les memes gestes, vivantes capot ouvert seulement.
 */

import type { HotspotDef } from '../scene/hit';
import { TweakPlate, type TweakItem } from '../scene/tweakplate';
import { BASS_PLATE_KNOBS, type BassKnobId } from './params';
import { BASS_PLATE, BASS_TWEAK_CELL_W, BASS_TWEAK_GROUPS, BASS_TWEAK_TITLE, bassTweakAt } from './theme';

export const bassTweakId = (id: BassKnobId): string => `bass-tw-${id}`;

/** Les commutateurs (peu de crans, leurs noms a leurs reperes) ; les autres sont des potards et leurs bouts de course. */
const SWITCHES: Partial<Record<BassKnobId, readonly string[]>> = { range: ['1', '2', '3'], suboct: ['-1', '-2'] };
const ENDS: Partial<Record<BassKnobId, readonly [string, string]>> = {
  slides: ['0', '100 %'],
  accents: ['0', '100 %'],
  root: ['ARP', 'F'],
  scale: ['MINOR', 'PENTA'],
  length: ['AUTO', '100 %'],
  accdecay: ['SNAP', 'LONG'],
  sweep: ['0', '4 OCT'],
  release: ['DRY', 'TAIL'],
  tune: ['-50', '+50'],
};

function items(): TweakItem[] {
  return BASS_PLATE_KNOBS.map((k) => {
    const { x, z } = bassTweakAt(k.id);
    const sw = SWITCHES[k.id];
    return {
      hotspot: bassTweakId(k.id),
      label: k.label,
      x,
      z,
      ...(sw ? { steps: sw } : {}),
      // TUNE : un cran au milieu (le 0 cents)
      ...(k.id === 'tune' ? { center: true } : {}),
      ...(ENDS[k.id] ? { ends: ENDS[k.id] } : {}),
      // Le reglage d'origine en orange : AUTO de LENGTH (la longueur du style)
      ...(k.id === 'length' ? { endOrange: true } : {}),
    };
  });
}

export class BassTweaks extends TweakPlate {
  constructor(opts: { mobile: boolean; anisotropy: number }) {
    super({ name: 'bassTweaks', dims: BASS_PLATE, items: items(), groups: BASS_TWEAK_GROUPS, title: BASS_TWEAK_TITLE, cellW: BASS_TWEAK_CELL_W }, opts);
  }

  /** Les potards suivent leurs valeurs (value : celle que montre un potard, le verrou du pas en LOCK) ; true s'il faut une frame. */
  sync(value: (id: BassKnobId) => number): boolean {
    let changed = false;
    BASS_PLATE_KNOBS.forEach((k, i) => {
      if (this.setAt(i, value(k.id))) changed = true;
    });
    return changed;
  }

  /** Les cibles du picking : une par reglage (la piece et sa serigraphie), coupees capot ferme. */
  hotspots(): HotspotDef[] {
    return BASS_PLATE_KNOBS.map((k, i) => {
      const h = this.hitOf(i);
      return {
        id: this.spec.items[i].hotspot,
        kind: 'bassknob' as const,
        layer: this.top,
        shape: h.shape,
        x: h.x,
        z: h.z,
        hx: h.hx,
        hz: h.hz,
        y0: 0,
        y1: h.y1,
        enabled: false,
        bass: k.id,
      };
    });
  }

  info(): { ids: BassKnobId[]; angleDeg: number[]; draws: number } {
    return { ids: BASS_PLATE_KNOBS.map((k) => k.id), angleDeg: this.angles(), draws: this.draws };
  }
}
