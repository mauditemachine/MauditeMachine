/**
 * La place et le dessus du MM-BASS (2026-10-07, Mika : "un prototype de
 * generateur de bassline ; la meme taille que MM-RYTM et bien sur
 * completement adapte en mobile ; inspire-toi de ces synthes, trouve le
 * meilleur de chacun : Moog Minitaur, Norand Mono, Torso T-1, TB-303,
 * Syntakt, Roland SE-02"). Un bloc de la famille du MM-DECKS (le coin, le
 * dessus brosse, les vis, les potards, les touches en caoutchouc a LED), a
 * la taille du MM-RYTM, pose a droite du MM-ARP ; le MM-DECKS apres lui. Le
 * dessus, du fond vers soi (repere top : x de -6.3 a 6.3, z de -4 a 4) :
 * - l'en-tete : MM-BASS, BASSLINE GENERATOR / ACID / SUB, le logotype ;
 * - l'ecran a gauche (la ligne de basse, facon OP-1, bass/screen.ts) ; a sa
 *   droite le grand CUTOFF en aluminium (celui du Minitaur), puis deux
 *   rangees : FILTER, les potards de la TB-303 (RESO, ENV MOD, DECAY,
 *   ACCENT) et VOLUME ; VOICE (WAVE, SUB, DRIVE, GLIDE, OCTAVE) ;
 * - GENERATOR, la rangee facon Torso T-1 : STYLE, DENSITY, SLIDES, ACCENTS,
 *   RANGE, ROOT, SCALE (potards noirs, noms en orange) ;
 * - dix touches : RUN | GEN, MUTATE, CLEAR | ACCENT, SLIDE | NOTE -, NOTE +,
 *   OCT -, OCT + ;
 * - seize pas en une rangee, par groupes de quatre (la TB-303, le Norand
 *   Mono) : orange une note (plus vif accentuee), pale une liaison, jaune
 *   le pas qui joue.
 * Au telephone (PORTRAIT) : le bloc debout comme le MM-RYTM, l'ecran sur
 * toute la largeur, les potards en rangees de quatre, les touches en deux
 * rangees de cinq, les pas en deux rangees de huit.
 * Ce module reste dans le chargement principal (le Stage en a besoin pour
 * cadrer) ; le reste du MM-BASS arrive a part (state/bassload.ts).
 */

import { BODY, PORTRAIT } from '../theme';
import { VOY_BODY, VOY_X } from '../voyager/theme';
import type { BassKnobId } from './params';

/** La taille du MM-RYTM. */
export const BASS_W = BODY.w;
export const BASS_D = BODY.d;
/** Le jour avec la machine de gauche : celui du MM-DECKS avec le MM-ARP. */
const GAP = PORTRAIT ? 1.8 : 2.6;

/** Le centre du MM-BASS : a droite du MM-ARP, le MM-DECKS apres lui. */
export function bassX(): number {
  return VOY_X + VOY_BODY.w / 2 + GAP + BASS_W / 2;
}

/** Le cadrage : de face, sa hauteur projetee. */
export const BASS_FRAME = { h: BASS_D + 0.5, targetY: 1.3 } as const;

export const BASS = PORTRAIT
  ? {
      head: { z: -6.62 },
      logo: { h: 0.32, z: -6.62 },
      screen: { x: 0, z: -4.92, w: 7.4, d: 2.5 },
      keys: { w: 1.24, d: 0.46 },
      trigs: { w: 0.8, d: 0.64, h: 1.15 },
    }
  : {
      head: { z: -3.42 },
      logo: { h: 0.3, z: -3.42 },
      screen: { x: -3.95, z: -1.72, w: 4.3, d: 2.3 },
      keys: { w: 0.82, d: 0.4 },
      trigs: { w: 0.62, d: 0.62, h: 1.15 },
    };

/** Les familles de potards (leur nom sur le panneau, en orange pour le generateur). */
export const BASS_GROUPS = { filter: 'FILTER', voice: 'VOICE', gen: 'GENERATOR' } as const;

/** Le potard en vedette : le grand CUTOFF. */
export const BASS_HERO: BassKnobId = 'cutoff';

/** Les potards, leur place (repere top), leur echelle. */
interface KnobPlace {
  id: BassKnobId;
  x: number;
  z: number;
  s: number;
}

const desk = (): KnobPlace[] => {
  const xs = [0.85, 2.05, 3.25, 4.45, 5.65];
  const r1: BassKnobId[] = ['reso', 'envmod', 'decay', 'accent', 'volume'];
  const r2: BassKnobId[] = ['wave', 'sub', 'drive', 'glide', 'octave'];
  const gen: BassKnobId[] = ['style', 'density', 'slides', 'accents', 'range', 'root', 'scale'];
  return [
    { id: 'cutoff', x: -0.72, z: -1.66, s: 2.05 },
    ...r1.map((id, i) => ({ id, x: xs[i], z: -2.3, s: 0.95 })),
    ...r2.map((id, i) => ({ id, x: xs[i], z: -1.02, s: 0.95 })),
    ...gen.map((id, i) => ({ id, x: -5.4 + i * 1.8, z: 0.5, s: 0.9 })),
  ];
};

const phone = (): KnobPlace[] => {
  const xs = [-2.85, -0.95, 0.95, 2.85];
  const rows: (BassKnobId | null)[][] = [
    ['cutoff', 'reso', 'envmod', 'decay'],
    ['accent', 'volume', 'wave', 'sub'],
    ['drive', 'glide', 'octave', null],
    ['style', 'density', 'slides', 'accents'],
    ['range', 'root', 'scale', null],
  ];
  const zs = [-2.75, -1.45, -0.15, 1.35, 2.65];
  const out: KnobPlace[] = [];
  rows.forEach((row, r) =>
    row.forEach((id, c) => {
      if (id) out.push({ id, x: xs[c], z: zs[r], s: id === 'cutoff' ? 1.32 : 1.05 });
    })
  );
  return out;
};

export const BASS_KNOB_PLACES: readonly KnobPlace[] = PORTRAIT ? phone() : desk();
export const bassKnobAt = (id: BassKnobId): KnobPlace => BASS_KNOB_PLACES.find((k) => k.id === id) ?? { id, x: 0, z: 0, s: 1 };

/** Les familles : la rangee de chaque potard. */
export const BASS_FILTER: readonly BassKnobId[] = ['cutoff', 'reso', 'envmod', 'decay', 'accent', 'volume'];
export const BASS_VOICE: readonly BassKnobId[] = ['wave', 'sub', 'drive', 'glide', 'octave'];
export const BASS_GEN: readonly BassKnobId[] = ['style', 'density', 'slides', 'accents', 'range', 'root', 'scale'];

/** Le capuchon d'un potard : aluminium pour le son (CUTOFF le plus grand), orange pour ACCENT, noir pour le generateur. */
export type BassKnobTone = 'knob' | 'ring' | 'hot';
export const bassKnobTone = (id: BassKnobId): BassKnobTone => (id === 'accent' ? 'hot' : BASS_GEN.includes(id) ? 'knob' : 'ring');

/* ---------------- les touches ---------------- */

export type BassKeyKind = 'run' | 'gen' | 'mutate' | 'clear' | 'accent' | 'slide' | 'notedn' | 'noteup' | 'octdn' | 'octup';
export const BASS_KEYS: readonly { kind: BassKeyKind; label: string; aria: string }[] = [
  { kind: 'run', label: 'RUN', aria: 'Run or stop the bassline, in time with the MM-RYTM, key Space' },
  { kind: 'gen', label: 'GEN', aria: 'Generate a new bassline, key G' },
  { kind: 'mutate', label: 'MUTATE', aria: 'Change a few steps, key M' },
  { kind: 'clear', label: 'CLEAR', aria: 'Clear the bassline' },
  { kind: 'accent', label: 'ACCENT', aria: 'Accent on the chosen step, key A' },
  { kind: 'slide', label: 'SLIDE', aria: 'Slide from the chosen step to the next, key S' },
  { kind: 'notedn', label: 'NOTE -', aria: 'Chosen step one note down in the scale, key Down' },
  { kind: 'noteup', label: 'NOTE +', aria: 'Chosen step one note up in the scale, key Up' },
  { kind: 'octdn', label: 'OCT -', aria: 'Chosen step one octave down, key Z' },
  { kind: 'octup', label: 'OCT +', aria: 'Chosen step one octave up, key X' },
];
/** Desktop : un jour de plus apres RUN, apres CLEAR, apres SLIDE. */
const KEY_GROUPS = [1, 4, 6];

/** La place d'une touche (desktop : une rangee ; au telephone : deux rangees de cinq). */
export function bassKeyAt(i: number): { x: number; z: number } {
  if (PORTRAIT) {
    const xs = [-3.1, -1.55, 0, 1.55, 3.1];
    return { x: xs[i % 5], z: i < 5 ? 3.85 : 4.66 };
  }
  return { x: -5.42 + i * 1.12 + KEY_GROUPS.filter((g) => i >= g).length * 0.25, z: 1.6 };
}

/** Les filets entre les groupes de touches (desktop). */
export const BASS_KEY_GROUPS = KEY_GROUPS;

/* ---------------- les pas ---------------- */

/** La place d'un pas (0 a 15) : une rangee de seize par groupes de quatre ; au telephone, deux de huit. */
export function bassTrigAt(i: number): { x: number; z: number } {
  if (PORTRAIT) {
    const c = i % 8;
    return { x: (c - 3.5) * 0.95 + (c >= 4 ? 0.08 : -0.08), z: i < 8 ? 5.56 : 6.46 };
  }
  const g = Math.floor(i / 4);
  return { x: -5.69 + i * 0.74 + g * 0.1, z: 2.78 };
}
