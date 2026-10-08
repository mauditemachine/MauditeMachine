/**
 * La place et le dessus du MM-BASS (2026-10-07, Mika : "un prototype de
 * generateur de bassline ; la meme taille que MM-RYTM et bien sur
 * completement adapte en mobile ; inspire-toi de ces synthes, trouve le
 * meilleur de chacun : Moog Minitaur, Norand Mono, Torso T-1, TB-303,
 * Syntakt, Roland SE-02"). Un bloc de la famille du MM-DECKS (le coin, le
 * dessus brosse, les potards, les touches en caoutchouc a LED), a la taille
 * du MM-RYTM, pose a droite du MM-RYTM (puis le MM-ARP, le MM-DECKS).
 * La face depuis la refonte du 2026-10-08 (Mika : "MM-BASS est un peu
 * complexe ; je m'attendais plus a une machine qui ressemble a un MONARK
 * qu'a un T-1 incomprehensible ; j'aime Elektron : quelque chose
 * d'intuitif, pour qu'on ne cherche pas les choses ; un bouton EDIT, je n'en
 * vois pas"), du fond vers soi (repere top : x de -6.3 a 6.3, z de -4 a 4) :
 * - l'en-tete : MM-BASS, MONO BASS SYNTH, le firmware, le logotype ;
 * - l'ecran a gauche (bass/screen.ts) ; a sa droite le GENERATOR (STYLE,
 *   DENSITY, GEN, MUTATE : ce que la machine joue), puis EDIT et OPEN en
 *   haut a droite, plus grands, en orange, comme les pads EDIT et OPEN du
 *   MM-RYTM ;
 * - le son sur une rangee, dans l'ordre du signal comme un Minimoog (ou le
 *   Monark) : OSC (OCTAVE, WAVE, SUB) | FILTER (le grand CUTOFF, RESO) |
 *   ENVELOPE (ENV MOD, DECAY) | ACCENT / SLIDE (ACCENT, GLIDE) | OUTPUT
 *   (DRIVE, VOLUME), le nom de chaque section au-dessus d'elle ;
 * - la rangee de jeu : RUN | CLEAR | ACCENT SLIDE | NOTE - NOTE + OCT - OCT + ;
 * - seize boutons LOCK, un au-dessus de chaque pas (2026-10-07) ;
 * - seize pas en une rangee, par groupes de quatre : orange une note (plus
 *   vif accentuee), pale une liaison, jaune le pas qui joue ; le pas qu'on
 *   verrouille clignote.
 * Les regles du generateur (SLIDE PROB, ACC PROB, RANGE, ROOT, SCALE) et les
 * reglages fins de la voix sont sous le capot (OPEN, la plaque TWEAKS).
 *
 * La machine Elektron (2026-10-08, Mika : "faire comme un principe de
 * machine elektron ; les valeurs des knobs sont a l'ecran, pas sur les
 * encodeurs ; fais evoluer l'ecran parce que je pense que c'est la cle") :
 * les onze potards du son laissent la place a un ecran deux fois plus
 * grand, le coeur de la machine, et a huit encodeurs sans fin A a H en deux
 * rangees de quatre, a cote de lui comme sur un Digitakt (le bloc k de
 * l'ecran est a la place de l'encodeur k), les quatre touches de page
 * dessous (VOICE, FILTER, ENV, FX, sous le filet PARAMETER), une par
 * colonne. A droite : EDIT et OPEN en haut, puis le GENERATOR (STYLE,
 * DENSITY, GEN, MUTATE). Le reste ne bouge pas : la rangee de jeu, les LOCK,
 * les pas.
 * Au telephone (PORTRAIT) : l'ecran sur toute la largeur, les encodeurs en
 * deux rangees de quatre sous lui (meme ordre que ses blocs), les touches de
 * page, le GENERATOR sur une rangee, RUN CLEAR EDIT OPEN, les touches du pas
 * choisi, les pas en deux rangees de huit, chacun son LOCK au-dessus.
 * Ce module reste dans le chargement principal (le Stage en a besoin pour
 * cadrer) ; le reste du MM-BASS arrive a part (state/bassload.ts).
 */

import { BODY, PORTRAIT } from '../theme';
import type { BassKnobId } from './params';

/**
 * La taille du MM-RYTM ; au telephone (2026-10-08, la revue : les LOCK et les pas tenaient 22 a 27 px chacun sous
 * le doigt) 2.8 de plus en profondeur : le bloc reste a la largeur de l'ecran (le cadrage tient encore la largeur,
 * il y avait 180 px de vide dessus et dessous), chaque rangee du bas et chaque bloc de l'ecran a ses 44 px.
 */
export const BASS_W = BODY.w;
export const BASS_D = PORTRAIT ? BODY.d + 2.8 : BODY.d;
/** Le jour avec la machine de gauche (le MM-RYTM) : le meme que partout. */
const GAP = PORTRAIT ? 1.8 : 2.6;

/** Le centre du MM-BASS : a droite du MM-RYTM (centre a 0), le MM-ARP apres lui. */
export function bassX(): number {
  return BODY.w / 2 + GAP + BASS_W / 2;
}

/** Le cadrage : de face, sa hauteur projetee. */
export const BASS_FRAME = { h: BASS_D + 0.5, targetY: 1.3 } as const;

export const BASS = PORTRAIT
  ? {
      head: { z: -8.2 },
      logo: { h: 0.32, z: -8.2 },
      // La machine Elektron (2026-10-08) : l'ecran plus profond (4.05 au lieu de 2.5 : son en-tete et ses blocs se touchent du doigt), toute la largeur
      screen: { x: 0, z: -5.775, w: 7.6, d: 4.05 },
      trigs: { w: 0.8, d: 0.56, h: 1.15 },
      // Plus grands au doigt (2026-10-08 : la bande de 15 px entre NOTE + et le pas ratait ; puis la revue : une
      // vraie touche, plus haute, a 44 px de son pas)
      locks: { w: 0.72, d: 0.42, h: 0.85 },
    }
  : {
      head: { z: -3.42 },
      logo: { h: 0.3, z: -3.42 },
      // La machine Elektron (2026-10-08) : 5.5 x 3.5 au lieu de 4.3 x 2.3, deux fois la surface
      screen: { x: -3.3, z: -1.25, w: 5.5, d: 3.5 },
      trigs: { w: 0.62, d: 0.62, h: 1.15 },
      locks: { w: 0.56, d: 0.26, h: 0.85 },
    };

/**
 * Les sections de la face qui gardent des potards dedies : le GENERATOR
 * (STYLE, DENSITY, ses touches GEN et MUTATE), en orange. Le son passe par
 * les encodeurs et les pages depuis la machine Elektron (2026-10-08).
 */
export const BASS_SECTIONS: readonly { name: string; ids: readonly BassKnobId[]; ink?: 'orange' }[] = [{ name: 'GENERATOR', ids: ['style', 'density'], ink: 'orange' }];

/** Les potards, leur place (repere top), leur echelle. */
interface KnobPlace {
  id: BassKnobId;
  x: number;
  z: number;
  s: number;
}

/** Les colonnes des encodeurs (et des touches de page), leurs rangees, leur echelle. */
const PH_X = [-2.85, -0.95, 0.95, 2.85];
/**
 * Au telephone, d'une rangee a l'autre au moins 1.05 (44 px sous le doigt ; 2026-10-08, la revue : les encodeurs
 * E a H mangeaient 10 px des touches de page) : les encodeurs, leurs pages a 1.15, le GENERATOR, RUN CLEAR EDIT
 * OPEN, les touches du pas, puis LOCK et pas, LOCK et pas.
 */
const ENC = PORTRAIT ? { x: PH_X, z: [-3.0, -1.7], s: 1.25, pageZ: -0.55 } : { x: [0.3, 1.3, 2.3, 3.3], z: [-2.25, -0.95], s: 1.1, pageZ: 0.3 };
/** La rangee du GENERATOR au telephone (STYLE, DENSITY, GEN, MUTATE). */
const PH_GEN_Z = 0.75;
/** Les rangees du bas : desktop la rangee de jeu (remontee pour le filet LOCK, la revue), telephone RUN et les touches du pas. */
const PLAY_Z = PORTRAIT ? { run: 2.3, keys: 3.4 } : { run: 1.5, keys: 1.5 };

const desk = (): KnobPlace[] => [
  // Le generateur, sous EDIT et OPEN : STYLE (le choix musical), DENSITY
  { id: 'style', x: 4.55, z: -1.2, s: 1.25 },
  { id: 'density', x: 5.55, z: -1.2, s: 0.98 },
];

const phone = (): KnobPlace[] => [
  { id: 'style', x: PH_X[0], z: PH_GEN_Z, s: 1.15 },
  { id: 'density', x: PH_X[1], z: PH_GEN_Z, s: 1.05 },
];

export const BASS_KNOB_PLACES: readonly KnobPlace[] = PORTRAIT ? phone() : desk();
export const bassKnobAt = (id: BassKnobId): KnobPlace => BASS_KNOB_PLACES.find((k) => k.id === id) ?? { id, x: 0, z: 0, s: 1 };

/** Le capuchon d'un potard dedie : noir pour le generateur. */
export type BassKnobTone = 'knob' | 'ring' | 'hot';
export const bassKnobTone = (_id: BassKnobId): BassKnobTone => 'knob';

/**
 * Les huit encodeurs (2026-10-08, la machine Elektron) : k de 0 a 7, A B C D
 * en haut, E F G H dessous, comme les blocs de l'ecran.
 */
export const BASS_ENC_S = ENC.s;
export const bassEncAt = (k: number): { x: number; z: number; s: number } => ({ x: ENC.x[k % 4], z: ENC.z[k < 4 ? 0 : 1], s: ENC.s });

/* ---------------- les touches ---------------- */

/** Les touches de page (2026-10-08) : une par colonne d'encodeurs. */
export type BassPageKey = 'pvoice' | 'pfilter' | 'penv' | 'pfx';
export const BASS_PAGE_KEYS: readonly BassPageKey[] = ['pvoice', 'pfilter', 'penv', 'pfx'];

export type BassKeyKind = 'run' | 'edit' | 'open' | 'gen' | 'mutate' | 'clear' | 'accent' | 'slide' | 'notedn' | 'noteup' | 'octdn' | 'octup' | BassPageKey;

/** Une touche : son nom, sa place et sa taille (repere top) ; orange : son nom en orange, sa LED orange (RUN en or). */
export interface BassKeyDef {
  kind: BassKeyKind;
  label: string;
  aria: string;
  x: number;
  z: number;
  w: number;
  d: number;
  orange?: boolean;
}

type KeyCopy = Pick<BassKeyDef, 'kind' | 'label' | 'aria' | 'orange'>;
const COPY: readonly KeyCopy[] = [
  { kind: 'run', label: 'RUN', aria: 'Run or stop the bassline, in time with the MM-RYTM, key Space', orange: true },
  { kind: 'edit', label: 'EDIT', aria: 'Edit: the sixteen steps become sixteen patterns, key E', orange: true },
  { kind: 'open', label: 'OPEN', aria: 'Open the machine: the fine settings and INFOS, key O', orange: true },
  { kind: 'gen', label: 'GEN', aria: 'Generate a new bassline with STYLE and DENSITY, key G', orange: true },
  { kind: 'mutate', label: 'MUTATE', aria: 'Change a few steps, key M' },
  { kind: 'clear', label: 'CLEAR', aria: 'Clear the bassline; while a step is locked, clear its locks' },
  { kind: 'accent', label: 'ACCENT', aria: 'Accent on the chosen step, key A' },
  { kind: 'slide', label: 'SLIDE', aria: 'Slide from the chosen step to the next, key S' },
  { kind: 'notedn', label: 'NOTE -', aria: 'Chosen step one note down in the scale, key Down' },
  { kind: 'noteup', label: 'NOTE +', aria: 'Chosen step one note up in the scale, key Up' },
  { kind: 'octdn', label: 'OCT -', aria: 'Chosen step one octave down, key Z' },
  { kind: 'octup', label: 'OCT +', aria: 'Chosen step one octave up, key X' },
  // Les pages (2026-10-08, la machine Elektron) : les huit encodeurs reglent la page allumee
  { kind: 'pvoice', label: 'VOICE', aria: 'Page VOICE: the eight encoders set the oscillator, the sub and the pitch, keys [ and ]' },
  { kind: 'pfilter', label: 'FILTER', aria: 'Page FILTER: the eight encoders set the 303 filter and the accent' },
  { kind: 'penv', label: 'ENV', aria: 'Page ENV: the eight encoders set the amp envelope, the note length and the volume' },
  { kind: 'pfx', label: 'FX', aria: 'Page FX: the eight encoders set the drive, the delay and the reverb' },
];

/**
 * Les places (2026-10-08) : desktop, GEN et MUTATE dans le bloc du
 * generateur, EDIT et OPEN en haut a droite (comme les pads EDIT et OPEN du
 * MM-RYTM : on les voit tout de suite), la rangee de jeu au-dessus des pas
 * (RUN | CLEAR | ACCENT SLIDE | NOTE - NOTE + OCT - OCT +) ; au telephone,
 * GEN et MUTATE a cote de STYLE et DENSITY, puis RUN CLEAR EDIT OPEN, puis
 * ACCENT SLIDE NOTE - NOTE + OCT - OCT +. Les touches de page (la machine
 * Elektron, le meme jour) sous les encodeurs, une par colonne ; GEN et
 * MUTATE sur leur rangee (desktop).
 */
const PLACES: Readonly<Record<BassKeyKind, { x: number; z: number; w: number; d: number }>> = PORTRAIT
  ? {
      pvoice: { x: ENC.x[0], z: ENC.pageZ, w: 1.55, d: 0.5 },
      pfilter: { x: ENC.x[1], z: ENC.pageZ, w: 1.55, d: 0.5 },
      penv: { x: ENC.x[2], z: ENC.pageZ, w: 1.55, d: 0.5 },
      pfx: { x: ENC.x[3], z: ENC.pageZ, w: 1.55, d: 0.5 },
      gen: { x: 0.95, z: PH_GEN_Z, w: 1.5, d: 0.58 },
      mutate: { x: 2.85, z: PH_GEN_Z, w: 1.5, d: 0.58 },
      run: { x: -2.95, z: PLAY_Z.run, w: 1.55, d: 0.6 },
      clear: { x: -0.98, z: PLAY_Z.run, w: 1.55, d: 0.6 },
      edit: { x: 0.98, z: PLAY_Z.run, w: 1.55, d: 0.6 },
      open: { x: 2.95, z: PLAY_Z.run, w: 1.55, d: 0.6 },
      accent: { x: -3.25, z: PLAY_Z.keys, w: 1.12, d: 0.5 },
      slide: { x: -1.95, z: PLAY_Z.keys, w: 1.12, d: 0.5 },
      notedn: { x: -0.65, z: PLAY_Z.keys, w: 1.12, d: 0.5 },
      noteup: { x: 0.65, z: PLAY_Z.keys, w: 1.12, d: 0.5 },
      octdn: { x: 1.95, z: PLAY_Z.keys, w: 1.12, d: 0.5 },
      octup: { x: 3.25, z: PLAY_Z.keys, w: 1.12, d: 0.5 },
    }
  : {
      pvoice: { x: ENC.x[0], z: ENC.pageZ, w: 0.8, d: 0.34 },
      pfilter: { x: ENC.x[1], z: ENC.pageZ, w: 0.8, d: 0.34 },
      penv: { x: ENC.x[2], z: ENC.pageZ, w: 0.8, d: 0.34 },
      pfx: { x: ENC.x[3], z: ENC.pageZ, w: 0.8, d: 0.34 },
      gen: { x: 4.55, z: 0.3, w: 0.92, d: 0.38 },
      mutate: { x: 5.55, z: 0.3, w: 0.92, d: 0.38 },
      edit: { x: 4.55, z: -2.55, w: 0.95, d: 0.44 },
      open: { x: 5.55, z: -2.55, w: 0.95, d: 0.44 },
      run: { x: -5.3, z: PLAY_Z.run, w: 1.1, d: 0.42 },
      clear: { x: -3.75, z: PLAY_Z.keys, w: 1.0, d: 0.42 },
      accent: { x: -2.2, z: PLAY_Z.keys, w: 1.0, d: 0.42 },
      slide: { x: -0.95, z: PLAY_Z.keys, w: 1.0, d: 0.42 },
      notedn: { x: 0.65, z: PLAY_Z.keys, w: 1.0, d: 0.42 },
      noteup: { x: 1.9, z: PLAY_Z.keys, w: 1.0, d: 0.42 },
      octdn: { x: 3.15, z: PLAY_Z.keys, w: 1.0, d: 0.42 },
      octup: { x: 4.4, z: PLAY_Z.keys, w: 1.0, d: 0.42 },
    };

export const BASS_KEYS: readonly BassKeyDef[] = COPY.map((c) => ({ ...c, ...PLACES[c.kind] }));
export const bassKeyAt = (i: number): BassKeyDef => BASS_KEYS[i];

/** Desktop : les filets entre les groupes de la rangee de jeu (entre deux touches : leur milieu). */
export const BASS_KEY_SEPS: readonly [BassKeyKind, BassKeyKind][] = PORTRAIT
  ? []
  : [
      ['run', 'clear'],
      ['clear', 'accent'],
      ['slide', 'notedn'],
    ];

/* ---------------- les pas ---------------- */

/** La place d'un pas (0 a 15) : une rangee de seize par groupes de quatre ; au telephone, deux de huit. */
export function bassTrigAt(i: number): { x: number; z: number } {
  if (PORTRAIT) {
    const c = i % 8;
    return { x: (c - 3.5) * 0.95 + (c >= 4 ? 0.08 : -0.08), z: i < 8 ? 5.52 : 7.67 };
  }
  const g = Math.floor(i / 4);
  return { x: -5.69 + i * 0.74 + g * 0.1, z: 2.92 };
}

/** Le bouton LOCK d'un pas : au-dessus de lui (au telephone a 1.05, 44 px ; desktop sous le filet LOCK). */
export function bassLockAt(i: number): { x: number; z: number } {
  const t = bassTrigAt(i);
  return { x: t.x, z: PORTRAIT ? t.z - 1.05 : 2.3 };
}

/** Le filet LOCK au-dessus de chaque rangee de LOCK (2026-10-08, la revue : la rangee n'avait pas de nom). */
export const BASS_LOCK_LEGEND_DZ = PORTRAIT ? 0.47 : 0.35;

/* ---------------- OPEN : le capot, la plaque ---------------- */

/**
 * OPEN (2026-10-08, Mika : "je voudrais un bouton OPEN, et dans le OPEN des
 * parametres plus particuliers, et surtout un bouton INFOS") : le dessus est
 * un capot (la dalle arrondie, l'ecran et son cadre, toutes les commandes)
 * pose sur le coin descendu de son epaisseur, comme le MM-SMPL l'avait. OPEN
 * le souleve, le recule et le cabre (scene/explode.ts) ; la carte du
 * MM-RYTM sort du fond du bac et sa plaque TWEAKS (scene/tweakplate.ts)
 * porte les reglages fins : la rangee GENERATOR (SLIDE PROB, ACC PROB,
 * RANGE, ROOT, SCALE) et la rangee VOICE (LENGTH, ACC DECAY, SWEEP,
 * RELEASE, SUB OCT, TUNE), le titre, INFOS et CLOSE.
 */
export const BASS_LID = { t: 0.14 } as const;
export const BASS_EXPLODE = PORTRAIT ? { lift: 6.2, slideZ: -4.6, tiltOpenDeg: -58, pcbRise: 0.45 } : { lift: 4.4, slideZ: -3.6, tiltOpenDeg: -26, pcbRise: 0.45 };
/** La carte au fond du bac, repere du fond : sortie, son dessous a 0.03 du fond. */
export const BASS_PCB_Y = -BASS_LID.t + 0.03 - BASS_EXPLODE.pcbRise;

/** La plaque (repere de la carte : son centre ; puis le sien, x a droite, z vers soi), celle du MM-RYTM. */
export const BASS_PLATE = PORTRAIT
  ? { cx: -0.2, cz: 0, w: 6.3, d: 9.9, y: 0.5, t: 0.08, r: 0.12, screwIn: 0.17, frame: 0.28, label: 0.15, end: 0.09, title: 0.3 }
  : { cx: 0, cz: 1.2, w: 10.2, d: 3.95, y: 0.5, t: 0.08, r: 0.12, screwIn: 0.22, frame: 0.3, label: 0.12, end: 0.072, title: 0.26 };

/** La zone de la carte degagee sous la plaque (repere de la carte ; en portrait la plaque tourne, ses cotes s'echangent). */
export function bassPlateClear(): { x0: number; x1: number; z0: number; z1: number } {
  const P = BASS_PLATE;
  const hx = (PORTRAIT ? P.d : P.w) / 2 + 0.3;
  const hz = (PORTRAIT ? P.w : P.d) / 2 + 0.3;
  return { x0: P.cx - hx, x1: P.cx + hx, z0: P.cz - hz, z1: P.cz + hz };
}

const TW_COLS = PORTRAIT ? [-2.0, 0, 2.0] : [-4.05, -2.7, -1.35, 0, 1.35, 2.7, 4.05];
const TW_ROWS = PORTRAIT ? [-2.55, -0.38, 1.79, 3.96] : [-0.5, 1.2];
/** Le titre : desktop sur les deux dernieres cases du haut, portrait en tete. */
export const BASS_PLATE_TITLE = PORTRAIT ? { x: 0, z: -4.1, w: 4 } : { x: (TW_COLS[5] + TW_COLS[6]) / 2, z: TW_ROWS[0] - 0.1, w: 2.4 };
/** Les cases (colonne, rangee) : desktop GENERATOR en haut, VOICE en bas ; portrait quatre rangees de trois, INFOS dans la derniere case. */
const TW_CELLS: Readonly<Partial<Record<BassKnobId, readonly [number, number]>>> = PORTRAIT
  ? { slides: [0, 0], accents: [1, 0], range: [2, 0], root: [0, 1], scale: [1, 1], length: [2, 1], accdecay: [0, 2], sweep: [1, 2], release: [2, 2], suboct: [0, 3], tune: [1, 3] }
  : { slides: [0, 0], accents: [1, 0], range: [2, 0], root: [3, 0], scale: [4, 0], length: [0, 1], accdecay: [1.2, 1], sweep: [2.4, 1], release: [3.6, 1], suboct: [4.8, 1], tune: [6, 1] };
export const bassTweakAt = (id: BassKnobId): { x: number; z: number } => {
  const [col, row] = TW_CELLS[id] ?? [0, 0];
  return { x: TW_COLS[0] + (TW_COLS[1] - TW_COLS[0]) * col, z: TW_ROWS[row] };
};
export const BASS_TWEAK_CELL_W = (PORTRAIT ? 2.0 : 1.35) - 0.12;
export const BASS_TWEAK_S = { knob: PORTRAIT ? 1.55 : 1.25, switch: PORTRAIT ? 0.82 : 0.8 } as const;
/** Les noms des rangees de la plaque (desktop : a gauche de chaque rangee, en orange pour le generateur). */
export const BASS_TWEAK_ROWS = { gen: TW_ROWS[0], voice: TW_ROWS[1] } as const;
/**
 * INFOS et CLOSE (des touches du DOM posees sur la plaque, repere de son
 * dessus, ui/MachineKey.tsx) : desktop cote a cote sous le titre ; au
 * telephone INFOS dans la derniere case (CLOSE est en bas de l'ecran,
 * ui/PcbClose.tsx).
 */
export const BASS_INFOS_KEY = PORTRAIT ? { x: TW_COLS[2], z: TW_ROWS[3], w: 1.7, d: 0.5, y: 0.02 } : { x: BASS_PLATE_TITLE.x - 0.62, z: BASS_PLATE_TITLE.z + 0.74, w: 1.1, d: 0.32, y: 0.02 };
export const BASS_CLOSE_KEY = { x: BASS_PLATE_TITLE.x + 0.62, z: BASS_PLATE_TITLE.z + 0.74, w: 1.1, d: 0.32, y: 0.02 } as const;
/**
 * Le cadrage ouvert : la hauteur du dessus de la plaque au-dessus du dessus
 * ferme (le fond, la carte sortie, son epaisseur 0.1, puis y + t), le point
 * vise en z et la largeur a tenir (renderer, OPEN_VIEW), comme le MM-RYTM.
 */
export const BASS_OPEN_FRAME = { y: -BASS_LID.t + 0.03 + 0.1 + BASS_PLATE.y + BASS_PLATE.t, z: PORTRAIT ? 0 : 0.8, w: BASS_PLATE.w } as const;
