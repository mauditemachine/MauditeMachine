/**
 * La place et le dessus du MM-SMPL (2026-10-04, Mika : "une machine de
 * travail du sample avec une partie granulaire, rajoute-la dans la liste
 * des machines"). Redessine le 2026-10-05 (Mika : "un petit Elektron
 * Tonverk, mais a mes couleurs, avec les fonctionnalites de samples") : un
 * bloc large et peu profond, la pente et les pieces du MM-DECKS (le coin,
 * le dessus brosse, les potards, les touches en caoutchouc), pose a droite
 * de la table. Le dessus, du fond vers soi (repere top du bloc : x de -6.2
 * a 6.2, z de -3.8 a 3.8) :
 * - l'en-tete : MM-SMPL, SAMPLER / SLICER / GRANULAR, le logotype ;
 * - en haut, l'ecran (le sample, la region, les slices, ce qui joue, la
 *   sequence). Refait le 2026-10-05 (Mika : "les trois boutons sont
 *   vraiment trop gros et les autres trop petits, travaille sur quelque
 *   chose d'ergonomique") : a sa gauche LEVEL et PITCH, a peine plus gros,
 *   en aluminium ; a sa droite une grille de dix potards de meme taille,
 *   deux rangees (SAMPLE, GRAIN : leur nom en orange) ;
 * - une rangee de douze touches de fonction : REC, PLAY, STOP | FILE,
 *   SLICES, MODE, REV, LOOP | RANDOM, CLEAR, EDIT, SAVE (GRAB A et GRAB B
 *   retires : le mixer envoie sa boucle, LOOP > SMPL) ;
 * - seize trigs en deux rangees de huit, plus larges : les slices (orange
 *   pale quand elles en ont une, or quand elles sonnent), en EDIT les pas
 *   de la sequence (smpl/seq.ts).
 * Ce module reste dans le chargement principal (le Stage en a besoin pour
 * cadrer) ; le reste du MM-SMPL arrive a part (state/smplload.ts).
 */

import { PORTRAIT } from '../theme';
import { VOY_BODY, VOY_X } from '../voyager/theme';
import type { SmplKnobId } from './params';

/**
 * Au telephone (2026-10-05, Mika : "la vue mobile du SMPL ne fonctionne pas,
 * je veux la meme forme que les deux autres") : un bloc en hauteur comme le
 * MM-RYTM et le MM-ARP (PORTRAIT) : l'ecran sur toute la largeur, les douze
 * potards en trois rangees de quatre, les touches en deux rangees de six,
 * les seize trigs dessous en deux rangees de huit.
 */
export const SMPL_W = PORTRAIT ? 8.6 : 12.4;
export const SMPL_D = PORTRAIT ? 12.4 : 7.6;
/** Le jour avec la machine de gauche : celui du MM-DECKS avec le MM-ARP. */
const GAP = PORTRAIT ? 1.8 : 2.6;

/**
 * Le centre du MM-SMPL : a droite du MM-ARP (2026-10-05, Mika : "j'aimerais
 * que MM-SMPL soit place a droite de MM-ARP"), le MM-DECKS apres lui.
 */
export function smplX(): number {
  return VOY_X + VOY_BODY.w / 2 + GAP + SMPL_W / 2;
}

/** Le cadrage : de face, sa hauteur projetee (moins profond que le MM-DECKS). */
export const SMPL_FRAME = { h: SMPL_D + 0.5, targetY: 1.3 } as const;

/**
 * Les touches de trig (2026-10-05, refonte) : seize en deux rangees de
 * huit, par groupes de quatre (un jour de plus au milieu de chaque rangee) :
 * plus larges qu'en ligne, a la souris comme au doigt. Pas d'une colonne,
 * jour en plus au milieu, les deux rangees.
 */
const TRIG = PORTRAIT
  ? ({ pitch: 0.97, group: 0.1, zs: [3.95, 5.05] as readonly number[], w: 0.86, d: 0.8, h: 1.15 } as const)
  : ({ pitch: 1.34, group: 0.12, zs: [1.3, 2.46] as readonly number[], w: 1.08, d: 0.8, h: 1.15 } as const);

export const SMPL = {
  head: { z: PORTRAIT ? -5.82 : -3.42 },
  logo: { h: 0.3, z: PORTRAIT ? -5.82 : -3.42 },
  /** l'ecran, et dedans : la bande de texte en haut, la forme d'onde dessous (fractions de sa hauteur) */
  screen: PORTRAIT
    ? { x: 0, z: -3.98, w: 7.6, d: 2.6, text: 0.24, wave: { v0: 0.3, v1: 0.95, u0: 0.02, u1: 0.98 } }
    : { x: -1.62, z: -1.86, w: 5.0, d: 2.2, text: 0.24, wave: { v0: 0.3, v1: 0.95, u0: 0.02, u1: 0.98 } },
  /** la bande des pas sous la forme d'onde quand une sequence existe (EDIT) : la forme d'onde finit a wave1 */
  steps: { wave1: 0.7, v0: 0.76, v1: 0.96 },
  /** les touches de fonction : x de la premiere, pas, jours en plus entre les groupes */
  keys: PORTRAIT ? { z: 1.95, x0: -3.25, pitch: 1.3, gap: 0, w: 1.0, d: 0.44, rowDz: 0.86 } : { z: 0.1, x0: -5.03, pitch: 0.86, gap: 0.3, w: 0.66, d: 0.4, rowDz: 0 },
  /**
   * les potards : a gauche de l'ecran LEVEL et PITCH (ceux qu'on tient en
   * jouant, un peu plus gros) ; a sa droite une grille de deux rangees de
   * cinq, la meme taille pour tous (2026-10-05, Mika : "les trois boutons
   * sont vraiment trop gros et les autres trop petits")
   */
  knobs: PORTRAIT
    ? {
        perf: { x: 0, zs: [] as readonly number[], s: 1.05 },
        grid: { xs: [-2.85, -0.95, 0.95, 2.85] as readonly number[], zs: [-1.7, -0.4, 0.9] as readonly number[], s: 1.05 },
      }
    : {
        perf: { x: -5.26, zs: [-2.32, -1.12] as readonly number[], s: 1.1 },
        grid: { xs: [1.66, 2.6, 3.54, 4.48, 5.42] as readonly number[], zs: [-2.32, -1.12] as readonly number[], s: 0.92 },
      },
  trigs: TRIG,
} as const;

/**
 * Les touches de fonction, de gauche a droite, en trois groupes : le
 * transport (REC, PLAY, STOP), le son (FILE, SLICES, MODE, REV, LOOP), la
 * sequence (RANDOM, CLEAR, EDIT) et SAVE. 2026-10-05 : GRAB A et GRAB B
 * retires (Mika : "c'est moi qui envoie quelque chose a la machine" : le
 * mixer le fait, LOOP > SMPL).
 */
export type SmplKeyKind = 'rec' | 'play' | 'stop' | 'file' | 'slices' | 'mode' | 'rev' | 'loop' | 'random' | 'clear' | 'edit' | 'save';
export const SMPL_KEYS: readonly { kind: SmplKeyKind; label: string; aria: string }[] = [
  { kind: 'rec', label: 'REC', aria: 'Record the site output, press again to stop' },
  { kind: 'play', label: 'PLAY', aria: 'Play the sequence, or the whole region, or the grain cloud at POSITION' },
  { kind: 'stop', label: 'STOP', aria: 'Stop everything that plays' },
  { kind: 'file', label: 'FILE', aria: 'Load an audio file' },
  { kind: 'slices', label: 'SLICES', aria: 'Slices: 4, 8, 16 or auto (the hits)' },
  { kind: 'mode', label: 'MODE', aria: 'Mode: slice or grain' },
  { kind: 'rev', label: 'REV', aria: 'Reverse' },
  { kind: 'loop', label: 'LOOP', aria: 'Loop while a pad is held' },
  { kind: 'random', label: 'RANDOM', aria: 'A random sequence of the slices' },
  { kind: 'clear', label: 'CLEAR', aria: 'Clear the sequence' },
  { kind: 'edit', label: 'EDIT', aria: 'Edit the sequence on the trigs' },
  { kind: 'save', label: 'SAVE', aria: 'Save the region as a WAV file' },
];
/** Les groupes de touches (un filet et un jour entre eux) : transport, son, sequence et SAVE. */
export const SMPL_KEY_GROUPS: readonly number[] = [3, 8];

/** Les potards, page par page (SAMPLE, GRAIN) : les onglets du telephone (smpl/Dock.tsx) ; LEVEL et PITCH en tete de SAMPLE. */
export const SMPL_KNOB_ROWS: readonly (readonly SmplKnobId[])[] = [
  ['level', 'pitch', 'start', 'end', 'attack', 'release', 'filter'],
  ['position', 'scan', 'size', 'density', 'spray'],
];
export const SMPL_ROW_NAMES = ['SAMPLE', 'GRAIN'] as const;

/**
 * La machine : LEVEL et PITCH a gauche de l'ecran, la grille a sa droite
 * (une rangee par page) ; au telephone, trois rangees de quatre sous
 * l'ecran (LEVEL et PITCH en tete, toujours en aluminium). 2026-10-05 :
 * SCAN prend la place de SPREAD, juste apres POSITION (la tete et sa
 * vitesse) ; au telephone, SPRAY monte a cote de FILTER.
 */
export const SMPL_PERF: readonly SmplKnobId[] = ['level', 'pitch'];
const PERF_HERO = new Set<SmplKnobId>(SMPL_PERF);
export const SMPL_GRID: readonly (readonly SmplKnobId[])[] = PORTRAIT
  ? [
      ['level', 'pitch', 'start', 'end'],
      ['attack', 'release', 'filter', 'spray'],
      ['position', 'scan', 'size', 'density'],
    ]
  : [
      ['start', 'end', 'attack', 'release', 'filter'],
      ['position', 'scan', 'size', 'density', 'spray'],
    ];
/** Les potards dessines a part, a gauche de l'ecran (desktop) ; aucun au telephone (ils sont dans la grille). */
export const SMPL_PERF_PLACED: readonly SmplKnobId[] = PORTRAIT ? [] : SMPL_PERF;

/** Le capuchon d'un potard : LEVEL et PITCH en aluminium (le repere noir), FILTER en orange, les autres noirs. */
export type SmplKnobTone = 'knob' | 'ring' | 'hot';
export const smplKnobTone = (id: SmplKnobId): SmplKnobTone => (id === 'filter' ? 'hot' : SMPL_PERF.includes(id) ? 'ring' : 'knob');

/** La place d'un potard (repere top du bloc), son echelle (s : le diametre, sy : la hauteur), gros ou non. */
export function smplKnobAt(id: SmplKnobId): { x: number; z: number; s: number; sy: number; hero: boolean } {
  const K = SMPL.knobs;
  const p = SMPL_PERF_PLACED.indexOf(id);
  if (p >= 0) return { x: K.perf.x, z: K.perf.zs[p], s: K.perf.s, sy: K.perf.s * 0.9, hero: true };
  for (let r = 0; r < SMPL_GRID.length; r += 1) {
    const c = SMPL_GRID[r].indexOf(id);
    if (c >= 0) return { x: K.grid.xs[c], z: K.grid.zs[r], s: K.grid.s, sy: K.grid.s, hero: PERF_HERO.has(id) };
  }
  return { x: 0, z: 0, s: 1, sy: 1, hero: false };
}

/** La place d'une touche de trig (0 a 15 : 1 a 8 en haut, 9 a 16 dessous, de gauche a droite). */
export function smplPadAt(i: number): { x: number; z: number } {
  const c = i % 8;
  return { x: (c - 3.5) * TRIG.pitch + (c >= 4 ? TRIG.group : -TRIG.group), z: TRIG.zs[i < 8 ? 0 : 1] };
}

/** La place d'une touche de fonction (un jour de plus apres chaque groupe ; au telephone, deux rangees de six). */
export const smplKeyAt = (i: number): { x: number; z: number } =>
  PORTRAIT
    ? { x: SMPL.keys.x0 + (i % 6) * SMPL.keys.pitch, z: SMPL.keys.z + (i < 6 ? 0 : SMPL.keys.rowDz) }
    : {
        x: SMPL.keys.x0 + i * SMPL.keys.pitch + SMPL_KEY_GROUPS.filter((g) => i >= g).length * SMPL.keys.gap,
        z: SMPL.keys.z,
      };

/**
 * OPEN (2026-10-05, Mika : "le bouton INFO doit etre a l'interieur OPEN de
 * la machine SMPL") : le dessus du bloc devient un capot, une dalle de t
 * d'epaisseur (le coin descend d'autant, dj/body.ts wedge et lidSlab) qui
 * porte l'ecran, les potards, les touches et les trigs. OPEN le souleve, le
 * recule et le cabre comme celui du MM-ARP (scene/explode.ts) ; la carte
 * sort du fond du bac, ses composants poussent, et sa plaque porte INFO (le
 * mode d'emploi) et CLOSE. La touche OPEN prend la place d'INFO dans le
 * bandeau du haut.
 */
export const SMPL_LID = { t: 0.16 } as const;
export const SMPL_EXPLODE = PORTRAIT ? { lift: 6.2, slideZ: -4.6, tiltOpenDeg: -58, pcbRise: 0.45 } : { lift: 4.4, slideZ: -3.6, tiltOpenDeg: -26, pcbRise: 0.45 };
/** La carte (celle du MM-RYTM, meme taille) au fond du bac, repere du fond : sortie, son dessous a 0.03 du fond. */
export const SMPL_PCB_Y = -SMPL_LID.t + 0.03 - SMPL_EXPLODE.pcbRise;

/**
 * La plaque de l'interieur : sa place sur le fond (x, z du repere top), ses
 * cotes (scene/tweakplate.ts). Desktop : dans le bas de la carte, sous la
 * serigraphie MAUDITE MACHINE (la carte degagee sous elle) ; portrait : entre
 * les deux inscriptions, debout.
 */
const PLATE_AT = { x: 0, z: PORTRAIT ? -0.6 : 1.5 };
export const SMPL_PLATE = {
  // Repere de la carte (tournee d'un quart de tour en portrait, PCB_TURN) : (x, z) du fond -> (-z, x) de la carte
  cx: PORTRAIT ? -PLATE_AT.z : PLATE_AT.x,
  cz: PORTRAIT ? PLATE_AT.x : PLATE_AT.z,
  w: 3.4,
  d: 2.2,
  y: 0.5,
  t: 0.08,
  r: 0.12,
  screwIn: 0.17,
  frame: 0.22,
  knob: 1.3,
  label: 0.11,
  end: 0.068,
  title: 0.24,
} as const;
/** Le titre de la plaque (repere du dessus de la plaque) ; INFO et CLOSE dessous, cote a cote (au telephone, INFO seule). */
export const SMPL_PLATE_TITLE = { x: 0, z: -0.5, w: 3.0 } as const;
export const SMPL_INFO_KEY = { x: -0.6, z: 0.55, w: 0.95, d: 0.36, y: 0.02 } as const;
export const SMPL_INFO_KEY_SOLO = { x: 0, z: 0.55, w: 1.5, d: 0.4, y: 0.02 } as const;
export const SMPL_CLOSE_KEY = { x: 0.6, z: 0.55, w: 0.95, d: 0.36, y: 0.02 } as const;
/** La touche OPEN : dans le bandeau du haut, a gauche du logo (la place de l'INFO d'avant), repere du capot. */
export const SMPL_OPEN_KEY = PORTRAIT ? { x: SMPL_W / 2 - 1.85, y: 0.02, z: SMPL.head.z, w: 1.15, d: 0.42 } : { x: SMPL_W / 2 - 1.9, y: 0.02, z: SMPL.head.z, w: 0.9, d: 0.28 };
/**
 * Le cadrage ouvert : la hauteur du dessus de la plaque au-dessus du dessus
 * ferme (le fond, la carte sortie, son epaisseur 0.1, puis y + t), le point
 * vise en z (desktop : la carte entiere, la plaque dans son bas ; portrait :
 * la plaque) et la largeur a tenir (renderer, OPEN_VIEW).
 */
export const SMPL_OPEN_FRAME = { y: -SMPL_LID.t + 0.03 + 0.1 + SMPL_PLATE.y + SMPL_PLATE.t, z: PORTRAIT ? PLATE_AT.z : 0.2, w: SMPL_PLATE.w } as const;
