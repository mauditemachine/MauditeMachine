/**
 * Les presets d'usine du plugin MM-RYTM (2026-11-11). Mika : "ce serait bien de mettre des variations de presets dans la
 * liste, genre D&B 1 2 3, Indie Dance 1 2 3, pour avoir des variations mais toujours dans le meme theme ! c'est super
 * important que ce soit super efficace, pour avoir quelque chose de base qui fonctionne parfaitement".
 *
 * Chaque style a trois variations : 1 la base (le motif du style, nu), 2 le groove (des fantomes, des percussions), 3 la
 * version pleine ou cassee. Un style garde son kit (les charleys, les toms, les percussions) ; d'une variation a l'autre
 * le kick, la caisse claire et le clap changent pour un cousin (meme famille de son).
 *
 * Le lot 27 (2026-11-12, Mika : "mets plus de presets encore et fais en sorte qu'ils soient super bons") : 24 styles (72
 * presets), les 12 premiers gardent leur rang (un projet Live qui en a charge un garde son nom) et les 12 nouveaux suivent
 * (NU DISCO ... TRIBAL, les styles de Mika d'abord). Et ils vivent, comme une Elektron bien programmee :
 * - les fills et les crashs viennent tout seuls : COND A:B (un roulement de toms toutes les 2 ou 4 mesures, une caisse en
 *   retrig 1/32 qui monte toutes les 8, le crash sur la 1re mesure de chaque phrase de 8) ;
 * - les fantomes ont une PROB (un kick ou une caisse fantome une fois sur deux, un shaker qui respire) ;
 * - VAR humanise : les charleys bougent un peu de niveau a chaque coup, les congas et les percussions un peu de hauteur ;
 * - uTIME : le clap et la caisse un rien en retard (le groove pose, house, disco, hip hop) ;
 * - TLEN : des percussions sur 3, 5 ou 7 pas contre les 16 du kick (la polymetrie hypnotique de MINIMAL et HYPNOTIC) ;
 * - les LFO : les charleys ouverts qui s'ouvrent et se ferment sur 2 ou 4 mesures (DEC), un filtre qui balaie les
 *   charleys (FREQ), un shaker ou un rim qui voyage dans la stereo (PAN) ;
 * - les FX globaux par style : COMP en parallele pour la colle, BIT pour LO-FI, une grande reverbe et un delay pointe qui
 *   reinjecte pour DUB TECHNO et COSMIC DISCO.
 *
 * Le plugin n'a pas de synthese : chaque piste joue un sample de son type (audio/tracks.ts TYPED_TRACKS). Ici chaque piste
 * a son sample de la banque (public/samples/rytm, "bd/Bd 14.wav"), son niveau, son panoramique, ses envois ; CH et OH se
 * coupent (choke 1), comme CH2 et OH2 (choke 2).
 *
 * Les samples sont choisis par mesure, pas a l'oreille (leur duree, leur decroissance, leur centre spectral, leur
 * fondamentale et leur niveau RMS, releves sur chaque fichier) : un kick court pour MINIMAL et D&B, long pour ELECTRO, une
 * caisse claire brillante pour ITALO, etc. Les niveaux partent d'un mixage par role (kick 0 dB, caisse -3, charley -10...)
 * corrige du RMS du fichier (TRIM). A valider a l'oreille par Mika.
 */

import { NEUTRAL_FX, type Fx, type Steps } from '../audio/pattern';
import { TRACK_KEYS, type StoredKit16, type TrackKey } from '../audio/tracks';
import type { KitFamily } from '../audio/kit';
import { CONDS, LEN_STEPS, RATE_DENS, type TrigRow, type TrigSet } from '../audio/trig';
import { LFO_DESTS, LFO_MODES, LFO_WAVES, type LfoDest, type LfoMode, type LfoWave } from '../audio/lfo';
import { LOCKS_V, type Locks, type StepLock } from '../audio/locks';
import type { RytmFactory } from './factory';

export const FAMS: readonly KitFamily[] = ['bd', 'sd', 'ch', 'oh', 'cp', 'tom', 'ht', 'cy'];
const FILE: Readonly<Record<KitFamily, string>> = { bd: 'Bd', sd: 'Sd', ch: 'Ch', oh: 'Oh', cp: 'Cp', tom: 'Tom', ht: 'Ht', cy: 'Cy' };

/** Le niveau de depart de chaque piste (dB, le kick a 0) : son role dans le mixage. */
export const ROLE_DB: readonly number[] = [0, -3, -10, -11, -4, -6, -7, -13, -6, -9, -14, -14, -9, -8, -9, -15];
/** Le panoramique de depart (-1 a 1) : le kick et la caisse au centre, le reste ouvert. */
export const ROLE_PAN: readonly number[] = [0, 0, 0.12, -0.12, 0, -0.3, 0.3, 0.2, 0, -0.15, -0.25, 0.25, 0.2, -0.4, 0.4, -0.2];
/** Le choke : CH et OH (1), CH2 et OH2 (2). */
const ROLE_CHOKE: readonly number[] = [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0];

/**
 * La correction de niveau d'un sample (dB), de son RMS mesure : un fichier dense baisse, un fichier maigre monte (au plus
 * +3.9 dB, le haut du reglage). "famille numero".
 */
const TRIM: Readonly<Record<string, number>> = {
  'bd 4': -1.5, 'bd 5': 1, 'bd 9': 1.5, 'bd 15': 1, 'bd 16': -1, 'bd 22': -1, 'bd 25': -1, 'bd 26': -1,
  'sd 8': 2, 'sd 9': 3, 'sd 12': 1, 'sd 16': 1, 'sd 17': 2, 'sd 20': 1, 'sd 23': 1, 'sd 26': 2,
  'ch 4': 1, 'ch 5': -2, 'ch 10': -1, 'ch 12': 1, 'ch 15': 3, 'ch 17': 1, 'ch 18': 1,
  'oh 5': 3, 'oh 8': 2, 'oh 9': 3, 'oh 10': 2, 'oh 13': -1, 'oh 18': 1, 'oh 21': 1,
  'cp 4': 1, 'cp 8': 3.5, 'cp 9': 2, 'cp 13': 3.5, 'cp 14': 2, 'cp 15': 3,
  'tom 10': 1, 'tom 14': -1,
  'ht 1': 3.9,
  'cy 11': 2,
};

/** La vitesse d'un LFO (comme MOD 1/2, actions/lfoRate.ts) : 4B un cycle en 4 mesures ... 1/16 un par double croche. */
export type Rate = '8B' | '4B' | '2B' | '1B' | '1/2' | '1/4' | '1/8' | '1/16';
const RATE_OF: Readonly<Record<Rate, readonly [number, number]>> = {
  '8B': [1, 0], '4B': [2, 0], '2B': [4, 0], '1B': [8, 0], '1/2': [16, 0], '1/4': [32, 0], '1/8': [32, 1], '1/16': [32, 2],
};
/** Un LFO de piste : sa destination, sa vitesse, sa profondeur (-64 a 63), sa forme (TRI) et son mode (FRE). */
export interface LfoSpec {
  d: LfoDest;
  r: Rate;
  dep: number;
  w?: LfoWave;
  m?: LfoMode;
}

/**
 * Une piste d'un kit : le numero du sample, puis ses reglages (db : en plus du role ; tune : en demi-tons ; ft, cut, res :
 * le filtre de FLTR ; lfo : le LFO 1 de MOD ; les autres : des reglages de piste, 0 a 1).
 */
type Tk =
  | number
  | { n: number; db?: number; pan?: number; decay?: number; tune?: number; reverb?: number; delay?: number; chorus?: number; dist?: number; ft?: 'LP' | 'HP' | 'BP'; cut?: number; res?: number; lfo?: LfoSpec };
type Kit = Partial<Record<TrackKey, Tk>>;
type Rows = Partial<Record<TrackKey, string>>;
/** Les reglages de trig de toute la piste (PROB, uTIME, TLEN, VAR...) ; c : sa COND par son nom ('1:8', '2:2', '!1ST'). */
type Row = Omit<TrigRow, 'cond'> & { c?: string };
/**
 * Un pas verrouille : c sa COND ('4:4'...), p sa PROB, u son uTIME (en 1/24 de pas), roll un retrig [1/n, VFAD, RLEN en
 * pas], tune en demi-tons, decay, level, pan (leurs domaines).
 */
interface Lk {
  c?: string;
  p?: number;
  u?: number;
  roll?: readonly [number, number, number?];
  tune?: number;
  decay?: number;
  level?: number;
  pan?: number;
}

interface Variation {
  /** ce qui change du kit du style (le kick, la caisse, le clap, un LFO) */
  kit?: Kit;
  steps: Rows;
  fx?: Partial<Fx>;
  trigs?: Partial<Record<TrackKey, Row>>;
  /** les verrous, par piste et par pas (de 1 a 16, comme les touches) */
  locks?: Partial<Record<TrackKey, Readonly<Record<number, Lk>>>>;
}
interface Style {
  name: string;
  bpm: number;
  fx: Partial<Fx>;
  kit: Kit;
  vars: readonly [Variation, Variation, Variation];
}

/* Les motifs de base (16 pas ; 9 l'accent, 6 a 8 un coup, 2 a 4 un fantome) */
const F4 = '9000900090009000';
const BK = '0000900000009000';
const B8 = '0000800000008000';
const B7 = '0000700000007000';
const B6 = '0000600000006000';
/** le charley ouvert sur les contretemps */
const OFF = '0070007000700070';
/** les doubles croches autour du charley ouvert (le temps, e, a) : le 'a' le referme (choke) */
const H16 = '6404640464046404';
/** les croches */
const H8 = '7050705070507050';
/** e et a seulement */
const HEA = '0404040404040404';
/** les doubles croches droites */
const HS16 = '7575757575757575';
/** le crash du premier temps (avec la COND 1:8 : la premiere mesure de chaque phrase de 8) */
const CRASH = '7000000000000000';

/* Les gestes qui reviennent */
/** les charleys qui bougent un peu de niveau a chaque coup (VAR LEV) */
const HATS: Row = { vlev: 12 };
/** le crash une mesure sur 8 */
const PHRASE: Row = { c: '1:8' };
/** un charley ouvert qui respire : DEC raccourci, un LFO DEC en sinus sur 2 mesures l'ouvre et le ferme */
const breath = (n: number, r: Rate = '2B'): Tk => ({ n, decay: 0.62, lfo: { d: 'DECAY', r, dep: 10, w: 'SINE' } });
/**
 * des charleys sous un passe-bas qu'un LFO balaie lentement (FREQ) ; cut selon leur brillance (0.84 : 7.5 kHz ; 0.9 : 10 kHz
 * pour un charley tres aigu), +2 dB : ce que le filtre leur prend en moyenne (mesure au rendu du moteur)
 */
const sweep = (n: number, r: Rate = '4B', cut = 0.84, dep = 14): Tk => ({ n, db: 2, ft: 'LP', cut, lfo: { d: 'FREQ', r, dep, w: 'SINE' } });
/** la meme COND sur plusieurs pas (un fill) */
const fill = (c: string, steps: readonly number[], extra: readonly Lk[] = []): Record<number, Lk> => Object.fromEntries(steps.map((s, i) => [s, { c, ...(extra[i] ?? {}) }]));

const STYLES: readonly Style[] = [
  {
    name: 'DARK DISCO',
    bpm: 118,
    fx: { swing: 0.16, drive: 0.14, reverb: 0.22, delay: 0.12, chorus: 0.1, comp: 0.18 },
    kit: { BD: 14, SD: 13, CH: 12, OH: 15, CP: { n: 5, reverb: 0.25 }, TOM: { n: 9, reverb: 0.15 }, HT: { n: 4, reverb: 0.15 }, CY: 7, T9: 25, T10: 5, T11: 13, T12: 18, T13: 6, T14: 8, T15: 1, T16: 6 },
    vars: [
      { steps: { BD: F4, CP: B8, OH: OFF, CH: H16 }, trigs: { CH: HATS, CP: { utime: 2 } } },
      {
        kit: { BD: 24, CP: { n: 4, reverb: 0.25 }, OH: breath(15) },
        steps: { BD: '9000900090009003', CP: B8, OH: OFF, CH: H16, TOM: '0000000600000060', HT: '0000000000050000', T10: '0020000000200200', T11: '3232323232323232', T16: CRASH },
        trigs: { CH: HATS, CP: { utime: 2 }, HT: { vtun: 6 }, T10: { prob: 70 }, T11: { vlev: 30, vpan: 25 }, T16: PHRASE },
        locks: { BD: { 16: { p: 65 } } },
      },
      {
        kit: { BD: 23, CP: { n: 9, reverb: 0.25 }, OH: breath(15) },
        steps: { BD: F4, SD: '0000700000007004', CP: B8, OH: OFF, CH: H16, TOM: '0060000000600000', HT: '0000000050000050', T13: '0000000000000030', T14: '0000030000000300', T15: '0000000000400000', T16: CRASH },
        trigs: { CH: HATS, CP: { utime: 2 }, T13: { c: '4:4' }, T14: { vtun: 5, vpan: 30 }, T15: { c: '2:2' }, T16: PHRASE },
        // la caisse en retrig 1/32 qui monte, a la fin de chaque phrase de 8
        locks: { SD: { 16: { c: '8:8', roll: [32, 40] } } },
      },
    ],
  },
  {
    name: 'INDIE DANCE',
    bpm: 122,
    fx: { swing: 0.12, drive: 0.18, reverb: 0.16, delay: 0.1, comp: 0.22 },
    kit: { BD: 26, SD: 14, CH: 10, OH: 12, CP: { n: 7, reverb: 0.15 }, TOM: 14, HT: 12, CY: 4, T9: 11, T10: 5, T11: 6, T12: 1, T13: 1, T14: { n: 8, delay: 0.2 }, T15: 5, T16: 6 },
    vars: [
      { steps: { BD: F4, SD: B7, CP: B8, OH: OFF, CH: H16 }, trigs: { CH: HATS } },
      {
        kit: { BD: 1, SD: 22, CP: { n: 12, reverb: 0.15 } },
        steps: { BD: '9000900090009020', SD: '0000800000008002', CP: B7, OH: OFF, CH: H16, HT: '0000000000000600', T10: '0000000200000567', T14: '0003000000030000', T16: CRASH },
        trigs: { CH: HATS, T14: { prob: 75 }, T16: PHRASE },
        // le rim qui relance toutes les 4 mesures
        locks: { BD: { 15: { p: 60 } }, SD: { 16: { p: 50 } }, T10: fill('4:4', [14, 15, 16]) },
      },
      {
        kit: { BD: 6, SD: 18, CP: { n: 4, reverb: 0.15 } },
        steps: { BD: '9000009000900000', SD: BK, CP: '0000000000007000', CH: H8, OH: '0000000700000000', TOM: '0000000000000060', HT: '0000000000600000', T9: '0000000000000300', T11: HEA, T13: '0000000003000000' },
        // un tambourin joue a la main entre les croches
        trigs: { CH: HATS, HT: { vtun: 4 }, T9: { prob: 60 }, T11: { prob: 65, vlev: 35 } },
      },
    ],
  },
  {
    name: 'MINIMAL',
    bpm: 125,
    fx: { swing: 0.35, reverb: 0.14, delay: 0.2, comp: 0.12 },
    kit: { BD: 11, SD: 5, CH: 1, OH: 16, CP: 6, TOM: { n: 8, delay: 0.3 }, HT: { n: 5, delay: 0.25 }, CY: 4, T9: 4, T10: 1, T11: 5, T12: 8, T13: 1, T14: { n: 1, delay: 0.2 }, T15: { n: 12, delay: 0.25 }, T16: 12 },
    vars: [
      { steps: { BD: F4, CP: B7, CH: '0050005000500050', TOM: '0000003000000300', HT: '0030000000000000', SD: '0000000000000040' }, trigs: { CH: { vlev: 18 }, TOM: { vtun: 3 } } },
      {
        kit: { BD: 4, SD: 19, CP: 12 },
        steps: { BD: F4, CP: B7, CH: '3050305030503050', OH: '0000000000000006', HT: '0000004000000000', SD: '0000000300000030', T13: '0300000000000000', T14: '0303030003030300', T15: '0000000000040000' },
        // T13, un clic sur 5 pas contre les 16 du kick
        trigs: { CH: { vlev: 18 }, OH: { c: '2:2' }, T13: { tlen: 5, vlev: 25 }, T14: { prob: 70, vtun: 5 }, T15: { c: '2:2' } },
      },
      {
        kit: { BD: 22, SD: 9, CP: 11, CH: sweep(1, '4B', 0.9) },
        steps: { BD: '9000900090009030', CP: B6, CH: '4353435343534353', TOM: '0030000000300003', HT: '0000030000000300', T10: '0000000000000200', T11: '3030030000000000', T12: '0000000060000000', T13: '0000000004000000' },
        // T11 sur 7 pas ; les charleys sous un filtre qui s'ouvre en 4 mesures
        trigs: { CH: { vlev: 15 }, HT: { vtun: 4 }, T11: { tlen: 7, vlev: 25 }, T12: { c: '2:2' } },
        locks: { BD: { 15: { p: 55 } } },
      },
    ],
  },
  {
    name: 'ITALO',
    bpm: 120,
    fx: { swing: 0, drive: 0.08, reverb: 0.22, delay: 0.14, chorus: 0.16 },
    kit: { BD: 9, SD: { n: 10, reverb: 0.3 }, CH: 9, OH: 1, CP: { n: 14, reverb: 0.25 }, TOM: { n: 16, reverb: 0.2 }, HT: { n: 6, reverb: 0.2 }, CY: 1, T9: 24, T10: 5, T11: 4, T12: 14, T13: 6, T14: { n: 13, reverb: 0.2 }, T15: { n: 9, reverb: 0.2 }, T16: 6 },
    vars: [
      { steps: { BD: F4, SD: BK, CP: B6, OH: OFF, CH: '6000600060006000' } },
      // Le roulement de toms de la fin de mesure, du plus aigu au plus grave, une mesure sur deux
      {
        kit: { BD: 13, SD: { n: 11, reverb: 0.3 }, CP: { n: 9, reverb: 0.25 } },
        steps: { BD: F4, SD: BK, CP: '0000000000008000', OH: OFF, CH: H16, T15: '0000000000007000', HT: '0000000000000700', T14: '0000000000000070', TOM: '0000000000000007', T16: CRASH },
        trigs: { CH: HATS, T15: { c: '2:2' }, HT: { c: '2:2' }, T14: { c: '2:2' }, TOM: { c: '2:2' }, T16: PHRASE },
      },
      {
        kit: { BD: 24, SD: { n: 15, reverb: 0.3 }, CP: { n: 5, reverb: 0.25 } },
        steps: { BD: F4, SD: BK, CP: '0000700000007070', CH: H8, OH: '0000000700000007', TOM: '0000006000000000', HT: '0000000060000000', T16: CRASH },
        trigs: { CH: HATS, T16: PHRASE },
        locks: { CP: { 15: { c: '2:2' } } },
      },
    ],
  },
  {
    name: 'EBM',
    bpm: 124,
    fx: { swing: 0, drive: 0.38, reverb: 0.22, comp: 0.25 },
    kit: { BD: 22, SD: 18, CH: 5, OH: 8, CP: 4, TOM: 14, HT: 12, CY: 12, T9: 16, T10: 28, T11: 10, T12: 21, T13: 12, T14: 6, T15: 4, T16: 6 },
    vars: [
      { steps: { BD: F4, SD: BK, CH: HS16 } },
      {
        kit: { BD: 16, SD: 14 },
        steps: { BD: F4, SD: '0000900000009666', CH: H8, OH: '0000000000000008', TOM: '0060006000600060', T10: '0000000030000030' },
        // les trois doubles croches de caisse a la fin de chaque phrase de 4
        locks: { SD: fill('4:4', [14, 15, 16]) },
      },
      {
        kit: { BD: 13, SD: 12 },
        steps: { BD: '9009000090090000', SD: BK, CH: HS16, CP: '0000000000008000', HT: '0000000600000006' },
        locks: { HT: { 16: { tune: 5 } } },
      },
    ],
  },
  {
    name: 'ELECTRO',
    bpm: 128,
    fx: { swing: 0.1, drive: 0.12, reverb: 0.14, delay: 0.14 },
    kit: { BD: 15, SD: 8, CH: 10, OH: 16, CP: { n: 12, reverb: 0.15 }, TOM: 16, HT: 5, CY: 4, T9: 9, T10: 5, T11: 1, T12: 12, T13: 1, T14: 13, T15: 12, T16: 6 },
    vars: [
      { steps: { BD: '9000009000900000', SD: BK, CH: HS16 } },
      {
        kit: { BD: 5, SD: 16, CP: { n: 7, reverb: 0.15 } },
        steps: { BD: '9009000000900000', SD: BK, CP: '0000000000007000', CH: '7070757070707500', OH: '0000000000000070', HT: '0060006000000060' },
        // un charley en ratchet 1/32 une fois sur deux ; le dernier coup de HT une quinte plus haut
        locks: { CH: { 13: { roll: [32, -20], p: 50 } }, HT: { 15: { tune: 7 } } },
      },
      {
        kit: { BD: 21, SD: 20, CP: { n: 15, reverb: 0.15 } },
        steps: { BD: '9000009000090090', SD: BK, CH: HS16, CP: '0000700000000000', TOM: '0000000000000066' },
        trigs: { TOM: { c: '2:2' } },
        locks: { TOM: { 15: { tune: 3 }, 16: { tune: -2 } } },
      },
    ],
  },
  {
    name: 'HOUSE',
    bpm: 124,
    fx: { swing: 0.48, drive: 0.08, reverb: 0.16, delay: 0.08, comp: 0.15 },
    kit: { BD: 25, SD: 22, CH: 9, OH: 13, CP: { n: 9, reverb: 0.2 }, TOM: 12, HT: 7, CY: 5, T9: 1, T10: 5, T11: 13, T12: 10, T13: 6, T14: 8, T15: 5, T16: 6 },
    vars: [
      { steps: { BD: F4, CP: B8, OH: OFF, CH: H16 }, trigs: { CH: { vlev: 15 }, CP: { utime: 1 } } },
      {
        kit: { BD: 1, CP: { n: 4, reverb: 0.2 } },
        steps: { BD: F4, CP: B8, SD: '0000000300000003', OH: OFF, CH: H16, HT: '0000000000030000', T11: '0303030303030303' },
        trigs: { CH: { vlev: 15 }, CP: { utime: 1 }, SD: { prob: 70 }, HT: { vtun: 4 }, T11: { vlev: 30, prob: 90 } },
      },
      {
        kit: { BD: 10, CP: { n: 5, reverb: 0.2 } },
        steps: { BD: '9000900090009003', CP: B8, OH: OFF, CH: H16, TOM: '0000006000000600', HT: '0000000000600000', T13: '0000000000000060', T16: CRASH },
        trigs: { CH: { vlev: 15 }, CP: { utime: 1 }, TOM: { vtun: 3 }, T13: { c: '2:2' }, T16: PHRASE },
        locks: { BD: { 16: { p: 60 } } },
      },
    ],
  },
  {
    name: 'TECHNO',
    bpm: 132,
    fx: { swing: 0.05, drive: 0.3, reverb: 0.2, delay: 0.06, comp: 0.3 },
    kit: { BD: 17, SD: 12, CH: 10, OH: 21, CP: { n: 4, reverb: 0.3 }, TOM: 6, HT: { n: 11, db: -3, reverb: 0.35 }, CY: 8, T9: 11, T10: 19, T11: 5, T12: 7, T13: 12, T14: 9, T15: { n: 4, delay: 0.3 }, T16: 6 },
    vars: [
      { steps: { BD: F4, OH: OFF, CH: HEA, CP: B6 }, trigs: { CH: { vlev: 15 } } },
      {
        kit: { BD: 19, CP: { n: 15, reverb: 0.3 } },
        steps: { BD: F4, OH: OFF, CH: H16, CP: B7, TOM: '0000000600000060', HT: '0030003000300030', T15: '0030000000000000' },
        // le grondement (HT grave dans la reverbe) ; T15 sur 5 pas, dans le delay
        trigs: { CH: { vlev: 15 }, T15: { tlen: 5, vtun: 3 } },
      },
      {
        kit: { BD: 7, CH: sweep(10, '2B', 0.84, 12) },
        steps: { BD: F4, CH: HS16, CY: OFF, TOM: '0060000000600000', HT: '0000000030000003', T10: '0000000700000000' },
        trigs: { CY: { vlev: 25 } },
        locks: { CH: { 16: { c: '2:2', roll: [32, -24] } } },
      },
    ],
  },
  {
    name: 'ACID',
    bpm: 130,
    fx: { swing: 0.1, drive: 0.2, reverb: 0.12, delay: 0.08, comp: 0.2 },
    kit: { BD: 8, SD: 16, CH: 10, OH: 12, CP: { n: 7, reverb: 0.15 }, TOM: 13, HT: 12, CY: 4, T9: 22, T10: 5, T11: 1, T12: 16, T13: 1, T14: 8, T15: 5, T16: 6 },
    vars: [
      { steps: { BD: F4, CP: B8, SD: '0000000000000057', CH: '7408740874087409', OH: '0080008000800080' }, trigs: { CH: HATS } },
      {
        kit: { BD: 12, SD: 9, CP: { n: 12, reverb: 0.15 } },
        steps: { BD: F4, CP: B8, SD: '0000000000050057', CH: '7405740574057405', OH: '0080008000800080', TOM: '0000000000600600', HT: '0000060000000000', T16: CRASH },
        trigs: { CH: HATS, TOM: { vtun: 3 }, T16: PHRASE },
      },
      {
        kit: { BD: 20, SD: 8, CP: { n: 4, reverb: 0.15 } },
        steps: { BD: '9000900090009090', CP: B8, SD: '0000000000002468', CH: H16, OH: OFF },
        // la montee de caisse entiere toutes les 4 mesures, sa fin seulement les autres
        trigs: { CH: HATS },
        locks: { SD: fill('4:4', [13, 14]) },
      },
    ],
  },
  {
    name: 'ROLLING',
    bpm: 138,
    fx: { swing: 0, drive: 0.15, reverb: 0.14, delay: 0.08, comp: 0.25 },
    // T9 : le kick court en fantome, serre, qui roule entre les temps
    kit: { BD: 4, SD: 19, CH: 5, OH: 16, CP: { n: 12, reverb: 0.2 }, TOM: 6, HT: 11, CY: 8, T9: { n: 11, db: -2, decay: 0.5 }, T10: 5, T11: 1, T12: 21, T13: 1, T14: 9, T15: 4, T16: 6 },
    vars: [
      { steps: { BD: F4, T9: '0033003300330033', OH: OFF, CH: HEA, CP: B6 }, trigs: { CH: HATS, T9: { vlev: 15 } } },
      {
        kit: { BD: 26 },
        steps: { BD: F4, T9: '0303030303030303', OH: OFF, CH: H16, SD: '0000000000004000', HT: '0000000000000050' },
        trigs: { CH: HATS, HT: { c: '2:2' }, T9: { vlev: 20, prob: 85 } },
      },
      {
        kit: { BD: 18 },
        steps: { BD: F4, T9: '0033003300330033', CH: HS16, CY: OFF, CP: B7, TOM: '0000000000000660', T16: CRASH },
        trigs: { CY: { vlev: 25 }, TOM: { c: '4:4' }, T9: { vlev: 15 }, T16: PHRASE },
      },
    ],
  },
  {
    name: 'BREAKBEAT',
    bpm: 130,
    fx: { swing: 0.16, drive: 0.24, reverb: 0.2, delay: 0.16, comp: 0.2 },
    kit: { BD: 13, SD: { n: 13, reverb: 0.1 }, CH: 9, OH: 10, CP: 7, TOM: 16, HT: 12, CY: 5, T9: 9, T10: 5, T11: 6, T12: 12, T13: 6, T14: 14, T15: 6, T16: 6 },
    vars: [
      { steps: { BD: '9000000000900000', SD: BK, T10: '0000000300000030', CH: '7070707070707000', OH: '0000000000000080' }, trigs: { T10: { prob: 80, vlev: 20 } } },
      {
        kit: { BD: 9, SD: { n: 17, reverb: 0.1 } },
        steps: { BD: '9090000000900000', SD: BK, T10: '0000000303000003', CH: '7070707070707070', T16: CRASH },
        trigs: { CH: HATS, T10: { prob: 75 }, T16: PHRASE },
      },
      {
        kit: { BD: 22, SD: { n: 21, reverb: 0.1 } },
        steps: { BD: '9000000000990000', SD: '0000900000009003', T10: '0030000300000030', CH: HS16, TOM: '0000000000000060' },
        trigs: { CH: HATS, T10: { prob: 70 } },
        locks: { SD: { 16: { c: '8:8', roll: [32, 40] } } },
      },
    ],
  },
  {
    name: 'D&B',
    bpm: 174,
    fx: { swing: 0.04, drive: 0.3, reverb: 0.16, delay: 0.14, comp: 0.25 },
    kit: { BD: 22, SD: { n: 14, reverb: 0.12 }, CH: 10, OH: 12, CP: 12, TOM: 16, HT: 12, CY: 4, T9: 13, T10: 5, T11: 1, T12: 16, T13: 6, T14: 14, T15: 5, T16: 6 },
    vars: [
      // Le two-step : le kick sur 1 et le "et" de 3, la caisse sur 2 et 4
      { steps: { BD: '9000000000900000', SD: BK, CH: '7070707070707070' }, trigs: { CH: HATS } },
      {
        kit: { BD: 13, SD: { n: 18, reverb: 0.12 } },
        steps: { BD: '9000000000900000', SD: BK, T10: '0000000303000003', CH: '7000700070007000', CY: '0060006000600060', T16: CRASH },
        trigs: { CH: HATS, CY: { vlev: 20 }, T10: { prob: 75 }, T16: PHRASE },
      },
      {
        kit: { BD: 11, SD: { n: 22, reverb: 0.12 } },
        steps: { BD: '9000009000900000', SD: '0000900000009003', T10: '0000000003000030', CH: HS16, CP: B6 },
        trigs: { CH: HATS, T10: { prob: 70 } },
        locks: { SD: { 16: { c: '4:4', roll: [32, 36] } } },
      },
    ],
  },

  /* ---------------- le lot 27 : douze styles de plus ---------------- */
  {
    name: 'NU DISCO',
    bpm: 120,
    fx: { swing: 0.22, drive: 0.1, reverb: 0.18, delay: 0.12, chorus: 0.12, comp: 0.2 },
    // la caisse brillante, basse, sous le clap ; HT et T15 des congas ; CY un tambourin sur 2 et 4
    kit: { BD: 25, SD: { n: 10, db: -5 }, CH: 9, OH: 10, CP: { n: 9, reverb: 0.2 }, TOM: { n: 13, reverb: 0.1 }, HT: { n: 6, reverb: 0.1 }, CY: { n: 4, db: 2 }, T9: 1, T10: 5, T11: 18, T12: 21, T13: 12, T14: 8, T15: 12, T16: 1 },
    vars: [
      { steps: { BD: F4, CP: B8, SD: B6, OH: OFF, CH: H16 }, trigs: { CH: HATS, CP: { utime: 2 }, SD: { utime: 2 } } },
      {
        steps: { BD: F4, CP: B8, SD: B6, OH: OFF, CH: H16, HT: '0000600006006000', T15: '0060000000060060', T11: '4242424242424242', CY: '0000500000005000' },
        trigs: { CH: HATS, CP: { utime: 2 }, SD: { utime: 2 }, HT: { vtun: 3, vlev: 15 }, T15: { vtun: 3, vlev: 20 }, T11: { vlev: 30, vpan: 20 } },
      },
      {
        // le shaker voyage dans la stereo ; les congas descendent toutes les 4 mesures ; le crash ouvre chaque phrase de 8
        kit: { BD: 24, T11: { n: 18, lfo: { d: 'PAN', r: '2B', dep: 26, w: 'SINE' } } },
        steps: { BD: '9000900090009020', CP: B8, SD: B6, OH: OFF, CH: H16, HT: '0000600006006000', T15: '0060000000060060', T11: '4242424242424242', TOM: '0000000000000765', T16: CRASH },
        trigs: { CH: HATS, CP: { utime: 2 }, SD: { utime: 2 }, HT: { vtun: 3, vlev: 15 }, T15: { vtun: 3, vlev: 20 }, T11: { vlev: 30 }, T16: PHRASE },
        locks: { BD: { 15: { p: 60 } }, TOM: fill('4:4', [14, 15, 16], [{ tune: 5 }, { tune: 2 }, { tune: -2 }]) },
      },
    ],
  },
  {
    name: 'COSMIC DISCO',
    bpm: 112,
    // lent et spatial : une grande reverbe, un delay en croche pointee qui reinjecte, du chorus
    fx: { swing: 0.1, drive: 0.12, reverb: 0.3, delay: 0.22, chorus: 0.25, rsize: 0.7, dtime: 0.4, dfb: 0.62, comp: 0.12 },
    kit: { BD: 7, SD: { n: 26, reverb: 0.2 }, CH: 17, OH: breath(9, '4B'), CP: { n: 13, reverb: 0.3 }, TOM: { n: 11, reverb: 0.25, delay: 0.3 }, HT: { n: 13, reverb: 0.25 }, CY: 5, T9: 5, T10: { n: 1, delay: 0.25 }, T11: 15, T12: 11, T13: 5, T14: { n: 13, delay: 0.35 }, T15: { n: 1, db: -3, delay: 0.4, reverb: 0.25 }, T16: 6 },
    vars: [
      { steps: { BD: F4, SD: BK, OH: OFF, CH: H16 }, trigs: { CH: { vlev: 15 } } },
      {
        steps: { BD: F4, SD: BK, OH: OFF, CH: H16, T15: '0030000000000300', TOM: '0000000000600000', T11: '0000600000006000' },
        trigs: { CH: { vlev: 15 }, T15: { prob: 70 }, T11: { vlev: 20 } },
        locks: { T15: { 14: { tune: 5 } } },
      },
      {
        // des toms qui tombent (accordes pas a pas), une cloche sur 6 pas dans le delay
        steps: { BD: F4, SD: BK, CP: '0000000000006000', OH: OFF, CH: H16, TOM: '0000000000600606', T14: '3000000000000000', T15: '0030000000000300', T16: CRASH },
        trigs: { CH: { vlev: 15 }, T14: { tlen: 6, vtun: 2 }, T15: { prob: 70 }, T16: PHRASE },
        locks: { TOM: { 14: { tune: -3 }, 16: { tune: -7 } }, T15: { 14: { tune: 5 } } },
      },
    ],
  },
  {
    name: 'NEW BEAT',
    bpm: 112,
    // le EBM belge ralenti : mecanique, sans humanisation, sature et compresse
    fx: { swing: 0, drive: 0.32, reverb: 0.18, delay: 0.06, comp: 0.3 },
    kit: { BD: 22, SD: 18, CH: 5, OH: 8, CP: { n: 4, reverb: 0.2 }, TOM: { n: 14, db: -4 }, HT: 12, CY: 12, T9: 16, T10: 28, T11: 10, T12: 13, T13: 11, T14: 1, T15: 4, T16: 6 },
    vars: [
      { steps: { BD: F4, SD: BK, CP: B8, CH: H8 } },
      {
        steps: { BD: F4, SD: BK, CP: B8, CH: H8, TOM: '0006000600060006', T10: '0000000000300030', OH: '0000000000000060' },
        trigs: { OH: { c: '2:2' } },
      },
      {
        steps: { BD: '9000900090009009', SD: '0000900000009666', CP: B8, CH: HS16, TOM: '0006000600060006', T15: '0000000000006000' },
        locks: { BD: { 16: { p: 50 } }, SD: fill('8:8', [14, 15, 16]), T15: { 13: { tune: -5 } } },
      },
    ],
  },
  {
    name: 'ELECTROCLASH',
    bpm: 126,
    // un kick long et profond, une caisse tres brillante, une cloche ; un peu de BIT pour le grain
    fx: { swing: 0.05, drive: 0.3, bits: 0.12, reverb: 0.12, delay: 0.1, comp: 0.25 },
    kit: { BD: 21, SD: 16, CH: 1, OH: 5, CP: 12, TOM: 16, HT: { n: 1, db: -4 }, CY: 4, T9: 11, T10: 9, T11: 15, T12: 19, T13: 15, T14: 13, T15: 5, T16: 10 },
    vars: [
      { steps: { BD: F4, SD: BK, CP: BK, CH: H8, OH: '0000000000000070' } },
      {
        steps: { BD: '9000900090009090', SD: BK, CP: BK, CH: HS16, HT: '0000700000070000' },
        trigs: { CH: { vlev: 10 } },
        locks: { HT: { 12: { tune: 5 } } },
      },
      {
        steps: { BD: '9000900000909000', SD: BK, CP: BK, CH: HS16, OH: '0000000000000060', T10: '0000000000000300', HT: '0000700000070000' },
        trigs: { CH: { vlev: 10 }, OH: { c: '2:2' } },
        locks: { CH: { 16: { roll: [32, -20], p: 60 } }, HT: { 12: { tune: 5 } } },
      },
    ],
  },
  {
    name: 'HYPNOTIC',
    bpm: 128,
    // la techno hypnotique : des percussions sur 3, 5 et 7 pas contre le kick, un grondement, des delays pointes
    fx: { swing: 0.12, drive: 0.16, reverb: 0.2, delay: 0.18, dtime: 0.4, dfb: 0.6, comp: 0.2 },
    kit: { BD: 17, SD: 19, CH: 17, OH: 14, CP: { n: 6, reverb: 0.3, delay: 0.2 }, TOM: { n: 13, delay: 0.25 }, HT: { n: 12, delay: 0.2 }, CY: 12, T9: { n: 15, db: -4, reverb: 0.45, decay: 0.62 }, T10: { n: 1, delay: 0.3 }, T11: 13, T12: 18, T13: 1, T14: { n: 8, delay: 0.3 }, T15: 5, T16: 6 },
    vars: [
      // le rim sur 3 pas : il tombe a cote du kick et ne revient au meme endroit que toutes les 3 mesures
      { steps: { BD: F4, OH: OFF, CH: HEA, T10: '6000000000000000' }, trigs: { CH: { vlev: 20 }, T10: { tlen: 3, vlev: 20 } } },
      {
        kit: { CH: sweep(17, '4B', 0.84, 16) },
        steps: { BD: F4, OH: OFF, CH: HEA, T10: '6000000000000000', TOM: '0500000000000000', HT: '0004000000000000', T9: '0030003000300030' },
        trigs: { CH: { vlev: 20 }, T10: { tlen: 3, vlev: 20 }, TOM: { tlen: 5, vtun: 3 }, HT: { tlen: 7, vtun: 3 } },
      },
      {
        kit: { CH: sweep(17, '4B', 0.84, 16) },
        steps: { BD: F4, OH: OFF, CH: HEA, CP: B6, CY: '3050305030503050', T10: '6000000000000000', TOM: '0500000000000000', HT: '0004000000000000', T9: '0030003000300030' },
        trigs: { CH: { vlev: 20 }, CY: { vlev: 35 }, T10: { tlen: 3, vlev: 20 }, TOM: { tlen: 5, vtun: 3 }, HT: { tlen: 7, vtun: 3 } },
      },
    ],
  },
  {
    name: 'DUB TECHNO',
    bpm: 122,
    // le rim dans un delay pointe qui reinjecte longtemps (la place des accords), une reverbe sombre et grande
    fx: { swing: 0.08, drive: 0.1, reverb: 0.38, delay: 0.32, chorus: 0.08, dtime: 0.4, dfb: 0.72, rsize: 0.75, rtone: 0.35, dtone: 0.5, comp: 0.15 },
    kit: { BD: 12, SD: 26, CH: 6, OH: breath(9, '4B'), CP: { n: 8, reverb: 0.5 }, TOM: { n: 10, delay: 0.4 }, HT: 7, CY: 11, T9: 15, T10: { n: 1, delay: 0.55, reverb: 0.3 }, T11: 13, T12: 17, T13: 5, T14: { n: 4, delay: 0.4 }, T15: 9, T16: 11 },
    vars: [
      { steps: { BD: F4, OH: OFF, CH: HEA, CP: B6, T10: '0003000000300000' }, trigs: { CH: { vlev: 20 } } },
      {
        steps: { BD: F4, OH: OFF, CH: HEA, CP: B6, T10: '0003000000300000', T11: '3232323232323232', TOM: '0000000000000400' },
        trigs: { CH: { vlev: 20 }, T11: { vlev: 35, prob: 85 } },
      },
      {
        // la ride a la place du charley ouvert ; le rim voyage d'un cote a l'autre en 2 mesures
        kit: { T10: { n: 1, delay: 0.55, reverb: 0.3, lfo: { d: 'PAN', r: '2B', dep: 30, w: 'SINE' } } },
        steps: { BD: F4, CH: HEA, CP: B6, CY: '0060006000600060', T10: '0003000000300000', T11: '3232323232323232', TOM: '0000000000000400' },
        trigs: { CH: { vlev: 20 }, CY: { vlev: 20 }, T11: { vlev: 35, prob: 85 } },
      },
    ],
  },
  {
    name: 'DEEP HOUSE',
    bpm: 120,
    fx: { swing: 0.55, drive: 0.06, reverb: 0.2, delay: 0.1, chorus: 0.1, comp: 0.15 },
    kit: { BD: 10, SD: 21, CH: 17, OH: 18, CP: { n: 7, reverb: 0.2 }, TOM: 16, HT: 6, CY: 7, T9: 1, T10: 29, T11: 18, T12: 21, T13: 12, T14: 13, T15: 12, T16: 1 },
    vars: [
      { steps: { BD: F4, CP: B8, OH: OFF, CH: H16 }, trigs: { CH: { vlev: 20 }, CP: { utime: 2 } } },
      {
        steps: { BD: F4, CP: B8, OH: OFF, CH: H16, T10: '0000003000000300', T11: '0404040404040404', HT: '0000000600000600' },
        trigs: { CH: { vlev: 20 }, CP: { utime: 2 }, HT: { vtun: 3, vlev: 15 }, T10: { prob: 80 }, T11: { vlev: 35 } },
      },
      {
        steps: { BD: '9000900090009300', CP: B8, SD: '0000000000000300', OH: OFF, CH: H16, T10: '0000003000000300', T11: '0404040404040404', HT: '0000000600000600', T13: '0000000000000060', T16: CRASH },
        trigs: { CH: { vlev: 20 }, CP: { utime: 2 }, SD: { prob: 60 }, HT: { vtun: 3, vlev: 15 }, T10: { prob: 80 }, T11: { vlev: 35 }, T13: { c: '2:2' }, T16: PHRASE },
        locks: { BD: { 14: { p: 55 } } },
      },
    ],
  },
  {
    name: 'AFRO HOUSE',
    bpm: 122,
    // le shaker en doubles croches, la clave son 3-2 au rim, les congas (HT grave, T15 aigue) qui bougent de hauteur
    fx: { swing: 0.3, drive: 0.08, reverb: 0.18, delay: 0.1, comp: 0.15 },
    kit: { BD: 1, SD: 21, CH: 13, OH: 21, CP: 7, TOM: 13, HT: 6, CY: 4, T9: 6, T10: 5, T11: 18, T12: 12, T13: 12, T14: 16, T15: 5, T16: 1 },
    vars: [
      { steps: { BD: F4, CP: B8, CH: '5363536353635363', T10: '7007007000707000' }, trigs: { CH: { vlev: 25 } } },
      {
        steps: { BD: F4, CP: B8, CH: '5363536353635363', T10: '7007007000707000', HT: '0000600000606000', T15: '0060000600000060', TOM: '0000000060000000' },
        trigs: { CH: { vlev: 25 }, HT: { vtun: 3, vlev: 20 }, T15: { vtun: 3, vlev: 20 }, TOM: { vtun: 2 } },
      },
      {
        kit: { T15: { n: 5, lfo: { d: 'PAN', r: '1B', dep: 20, w: 'SINE' } } },
        steps: { BD: F4, CP: B8, CH: '5363536353635363', T10: '7007007000707000', HT: '0000600000606000', T15: '0060000600000060', TOM: '0000000060000000', T14: '6000300000006000', OH: '0000000000000060', T16: CRASH },
        trigs: { CH: { vlev: 25 }, HT: { vtun: 3, vlev: 20 }, T15: { vtun: 3, vlev: 20 }, TOM: { vtun: 2 }, T14: { vtun: 3, vlev: 15 }, OH: { c: '2:2' }, T16: PHRASE },
      },
    ],
  },
  {
    name: 'UK GARAGE',
    bpm: 132,
    // le 2-step : le kick sur 1 et le "et" de 3, un shuffle fort (63 %), le shaker sur les doubles croches decalees
    fx: { swing: 0.78, drive: 0.12, reverb: 0.14, delay: 0.08, comp: 0.2 },
    kit: { BD: 13, SD: 22, CH: 10, OH: 13, CP: 12, TOM: 14, HT: 5, CY: 4, T9: 22, T10: 19, T11: 18, T12: 16, T13: 6, T14: 8, T15: 12, T16: 1 },
    vars: [
      { steps: { BD: '9000000000900000', SD: BK, CP: BK, CH: '3070307030703070', T11: '0303030303030303' }, trigs: { T11: { vlev: 30 } } },
      {
        steps: { BD: '9000000000900000', SD: BK, CP: BK, CH: '3070307030703070', T11: '0303030303030303', T9: '0000000300000003', T10: '0000000000030000', OH: '0000000000000060' },
        trigs: { T11: { vlev: 30 }, T9: { prob: 60 }, T10: { prob: 70 }, OH: { c: '2:2' } },
      },
      {
        steps: { BD: '9000000000900100', SD: BK, CP: BK, CH: '3070307030703070', T11: '0303030303030303', T9: '0000000300000003', T10: '0020000000030000', HT: '0000000000000050', T16: CRASH },
        trigs: { T11: { vlev: 30 }, T9: { prob: 60 }, T10: { prob: 70 }, HT: { c: '4:4' }, T16: PHRASE },
      },
    ],
  },
  {
    name: 'LO-FI HIP HOP',
    bpm: 88,
    // le boom bap fatigue : BIT et DRIVE pour le grain, la caisse en retard, des charleys qui ne frappent jamais pareil
    fx: { swing: 0.6, drive: 0.22, bits: 0.25, reverb: 0.16, delay: 0.06, comp: 0.25 },
    kit: { BD: 9, SD: { n: 13, db: -2 }, CH: 12, OH: 15, CP: 5, TOM: 9, HT: 7, CY: 11, T9: 13, T10: 28, T11: 13, T12: 8, T13: 1, T14: 8, T15: 12, T16: 11 },
    vars: [
      { steps: { BD: '9000000090100000', SD: BK, CH: H8 }, trigs: { CH: { vlev: 25, vdec: 15 }, SD: { utime: 2 } } },
      {
        steps: { BD: '9000000090100010', SD: BK, CH: H8, T10: '0000000030000003', T9: '0000000000000300' },
        trigs: { CH: { vlev: 25, vdec: 15 }, SD: { utime: 2 }, T9: { prob: 50 }, T10: { prob: 60 } },
      },
      {
        steps: { BD: '9000000090100010', SD: BK, CH: H8, OH: '0000000000000070', T10: '0000000030000003', T9: '0000000000000300', T11: '0303030303030303' },
        trigs: { CH: { vlev: 25, vdec: 15 }, SD: { utime: 2 }, OH: { c: '2:2' }, T9: { prob: 50 }, T10: { prob: 60 }, T11: { prob: 70, vlev: 40 } },
      },
    ],
  },
  {
    name: 'INDUSTRIAL',
    bpm: 140,
    // le kick sec et le grondement (un 808 long dans une grande reverbe) sur les contretemps ; tout sature
    fx: { swing: 0, drive: 0.5, bits: 0.08, reverb: 0.25, rsize: 0.75, comp: 0.35 },
    kit: { BD: 22, SD: 16, CH: 5, OH: 7, CP: { n: 15, reverb: 0.3 }, TOM: { n: 7, db: -4 }, HT: 11, CY: 12, T9: { n: 15, db: -3, reverb: 0.45, decay: 0.62 }, T10: 8, T11: 1, T12: 20, T13: 11, T14: 1, T15: 4, T16: 10 },
    vars: [
      { steps: { BD: F4, T9: '0030003000300030', CH: HS16, CP: B6 }, trigs: { CH: { vlev: 15 } } },
      {
        steps: { BD: F4, T9: '0030003000300030', CH: HS16, CP: B6, TOM: '0006000600060006', T10: '0000000000000300' },
        trigs: { CH: { vlev: 15 } },
      },
      {
        steps: { BD: F4, T9: '0030003000300030', CH: HS16, CP: B6, TOM: '0006000600060006', T10: '0000000000000300', SD: '0000000000000006' },
        trigs: { CH: { vlev: 15 } },
        locks: { CH: { 16: { c: '2:2', roll: [32, -24] } }, SD: { 16: { c: '8:8', roll: [32, 40] } } },
      },
    ],
  },
  {
    name: 'TRIBAL',
    bpm: 128,
    // des toms partout : le grave et le medium qui se repondent, puis T14 sur 6 pas et T15 sur 5
    fx: { swing: 0.2, drive: 0.15, reverb: 0.18, delay: 0.1, comp: 0.2 },
    kit: { BD: 19, SD: 21, CH: 9, OH: 18, CP: 7, TOM: 12, HT: 8, CY: 7, T9: 6, T10: 5, T11: 13, T12: 21, T13: 12, T14: 16, T15: 9, T16: 1 },
    vars: [
      { steps: { BD: F4, CH: HEA, TOM: '0060000600600000', HT: '0000600000006000' }, trigs: { TOM: { vtun: 3, vlev: 15 }, HT: { vtun: 3, vlev: 15 } } },
      {
        steps: { BD: F4, CH: HEA, OH: OFF, TOM: '0060000600600000', HT: '0000600000006000', T14: '6000000000000000', T15: '0050000000000000' },
        trigs: { TOM: { vtun: 3, vlev: 15 }, HT: { vtun: 3, vlev: 15 }, T14: { tlen: 6, vtun: 3 }, T15: { tlen: 5, vtun: 3 } },
      },
      {
        steps: { BD: F4, CH: HEA, OH: OFF, CP: B8, TOM: '0060000600600666', HT: '0000600000006000', T14: '6000000000000000', T15: '0050000000000000', T16: CRASH },
        trigs: { TOM: { vtun: 3, vlev: 15 }, HT: { vtun: 3, vlev: 15 }, T14: { tlen: 6, vtun: 3 }, T15: { tlen: 5, vtun: 3 }, T16: PHRASE },
        locks: { TOM: fill('4:4', [14, 15, 16], [{ tune: 5 }, { tune: 3 }, { tune: 0 }]) },
      },
    ],
  },
];

const BLANK = '0000000000000000';
/** Une rangee de 16 pas, toujours (des chiffres de 0 a 9). */
const row = (s: string | undefined): string => (s && /^[0-9]{16}$/.test(s) ? s : BLANK);
/** dB -> le reglage VOL d'une piste (gain (v / 0.8)^2 : 0 dB a 0.8, +3.9 dB a fond). */
export const levelOf = (db: number): number => Math.round(Math.max(0, Math.min(1, 0.8 * Math.pow(10, db / 40))) * 1000) / 1000;
/** Le rang d'une COND par son nom (NONE si inconnu). */
export const condIx = (label: string): number => Math.max(0, CONDS.findIndex((c) => c.label === label));
const FT = { LP: 0, HP: 0.5, BP: 1 } as const;

/** Les reglages d'une piste (Tk sans son numero) : ce que les presets et le RANDOM du plugin (state/pluginRandom.ts) posent. */
export type TrackSpec = Omit<Exclude<Tk, number>, 'n'>;
/** La correction de RMS d'un sample de la banque par sa cle ("bd/Bd 14.wav" -> 'bd 14') ; 0 pour un sample perso. */
export const trimOf = (key: string): number => {
  const m = /^([a-z]+)\/[A-Za-z]+ (\d+)\.wav$/.exec(key);
  return m ? (TRIM[`${m[1]} ${m[2]}`] ?? 0) : 0;
};

/** Une piste (i : 0 a 15) sur un sample (sa cle), a son role de mixage corrige de son RMS, avec ses reglages. */
export function trackEntry(i: number, key: string, q: TrackSpec): NonNullable<StoredKit16['t']>[TrackKey] {
  const p: Record<string, number> = { level: levelOf(ROLE_DB[i] + trimOf(key) + (q.db ?? 0)) };
  const pan = q.pan ?? ROLE_PAN[i];
  if (pan !== 0) p.pan = pan;
  if (q.decay !== undefined) p.decay = q.decay;
  if (q.tune !== undefined) p.tune = q.tune / 24;
  if (q.reverb) p.reverb = q.reverb;
  if (q.delay) p.delay = q.delay;
  if (q.chorus) p.chorus = q.chorus;
  if (q.dist) p.dist = q.dist;
  if (q.ft !== undefined && FT[q.ft]) p.ftype = FT[q.ft];
  if (q.cut !== undefined) p.fcut = q.cut;
  if (q.res !== undefined) p.freso = q.res;
  if (q.lfo) {
    const [spd, mul] = RATE_OF[q.lfo.r];
    p.l1dst = LFO_DESTS.indexOf(q.lfo.d);
    p.l1spd = spd;
    if (mul) p.l1mul = mul;
    p.l1dep = q.lfo.dep;
    if (q.lfo.w && q.lfo.w !== 'TRI') p.l1wav = LFO_WAVES.indexOf(q.lfo.w);
    if (q.lfo.m && q.lfo.m !== 'FRE') p.l1mod = LFO_MODES.indexOf(q.lfo.m);
  }
  return { m: 'oneshot', s: key, p, ...(ROLE_CHOKE[i] ? { ch: ROLE_CHOKE[i] } : {}) };
}

function kitOf(base: Kit, over: Kit | undefined): StoredKit16 {
  const t: NonNullable<StoredKit16['t']> = {};
  TRACK_KEYS.forEach((key, i) => {
    const spec = over?.[key] ?? base[key];
    if (spec === undefined) return;
    const { n, ...q }: Exclude<Tk, number> = typeof spec === 'number' ? { n: spec } : spec;
    const fam = FAMS[i % 8];
    t[key] = trackEntry(i, `${fam}/${FILE[fam]} ${n}.wav`, q);
  });
  return { v: 1, t };
}

/** Les reglages de trig de la variation (la forme des patterns) ; undefined : aucun. */
function trigsOf(v: Variation): TrigSet | undefined {
  if (!v.trigs) return undefined;
  const out: Partial<Record<TrackKey, TrigRow>> = {};
  for (const key of TRACK_KEYS) {
    const r = v.trigs[key];
    if (!r) continue;
    const { c, ...rest } = r;
    out[key] = { ...rest, ...(c ? { cond: condIx(c) } : {}) };
  }
  return out;
}

/** Un pas verrouille, dans les domaines des reglages (audio/locks.ts). */
function stepLock(l: Lk): StepLock {
  const o: StepLock = {};
  if (l.c) o.cond = condIx(l.c);
  if (l.p !== undefined) o.prob = l.p;
  if (l.u !== undefined) o.utime = l.u;
  if (l.roll) {
    o.rtrg = 1;
    o.rate = Math.max(0, RATE_DENS.indexOf(l.roll[0]));
    if (l.roll[1]) o.vfad = l.roll[1];
    if (l.roll[2] !== undefined) o.rlen = Math.max(0, LEN_STEPS.indexOf(l.roll[2]));
  }
  if (l.tune !== undefined) o.tune = l.tune / 24;
  if (l.decay !== undefined) o.decay = l.decay;
  if (l.level !== undefined) o.level = l.level;
  if (l.pan !== undefined) o.pan = l.pan;
  return o;
}

/** Les verrous de la variation (les pas comptes de 1 a 16 deviennent '0' a '15') ; undefined : aucun. */
function locksOf(v: Variation): Locks | undefined {
  if (!v.locks) return undefined;
  const out: Record<string, Record<string, StepLock>> = {};
  for (const key of TRACK_KEYS) {
    const per = v.locks[key];
    if (!per) continue;
    const r: Record<string, StepLock> = {};
    for (const [s, l] of Object.entries(per)) r[String(Number(s) - 1)] = stepLock(l);
    out[key] = r;
  }
  return { ...out, v: LOCKS_V } as Locks;
}

/** Les presets d'usine du plugin : DARK DISCO 1, 2, 3, INDIE DANCE 1... (la liste de PRESETS). */
export function pluginRytmFactory(): { name: string; data: RytmFactory }[] {
  const out: { name: string; data: RytmFactory }[] = [];
  for (const s of STYLES) {
    s.vars.forEach((v, k) => {
      const steps = Object.fromEntries(TRACK_KEYS.map((key) => [key, row(v.steps[key])])) as unknown as Steps;
      const fx: Fx = { ...NEUTRAL_FX, ...s.fx, ...(v.fx ?? {}) };
      const trigs = trigsOf(v);
      const locks = locksOf(v);
      // Le kit entier est dans tracks (les 16 pistes) : pas de kit d'avant (state/presets.ts apply le pose tel quel)
      const data = { steps, bpm: s.bpm, fx, stretch: 0, voices: {}, tracks: kitOf(s.kit, v.kit), ...(trigs ? { trigs } : {}), ...(locks ? { locks } : {}) } as unknown as RytmFactory;
      out.push({ name: `${s.name} ${k + 1}`, data });
    });
  }
  return out;
}
