/**
 * Les presets d'usine du plugin MM-RYTM (2026-11-11). Mika : "ce serait bien de mettre des variations de presets dans la
 * liste, genre D&B 1 2 3, Indie Dance 1 2 3, pour avoir des variations mais toujours dans le meme theme ! c'est super
 * important que ce soit super efficace, pour avoir quelque chose de base qui fonctionne parfaitement".
 *
 * Douze styles, trois variations chacun (36 presets) : 1 la base (le motif du style, nu), 2 le groove (des fantomes, des
 * percussions), 3 la version pleine ou cassee. Un style garde son kit (les charleys, les toms, les percussions) ; d'une
 * variation a l'autre le kick, la caisse claire et le clap changent pour un cousin (meme famille de son).
 *
 * Le plugin n'a pas de synthese : chaque piste joue un sample de son type (audio/tracks.ts TYPED_TRACKS). Les presets
 * d'usine du site (state/factory.ts) y perdaient donc leur kit (toutes les pistes sur le premier sample). Ici chaque piste
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
import type { RytmFactory } from './factory';

const FAMS: readonly KitFamily[] = ['bd', 'sd', 'ch', 'oh', 'cp', 'tom', 'ht', 'cy'];
const FILE: Readonly<Record<KitFamily, string>> = { bd: 'Bd', sd: 'Sd', ch: 'Ch', oh: 'Oh', cp: 'Cp', tom: 'Tom', ht: 'Ht', cy: 'Cy' };

/** Le niveau de depart de chaque piste (dB, le kick a 0) : son role dans le mixage. */
const ROLE_DB: readonly number[] = [0, -3, -10, -11, -4, -6, -7, -13, -6, -9, -14, -14, -9, -8, -9, -15];
/** Le panoramique de depart (-1 a 1) : le kick et la caisse au centre, le reste ouvert. */
const ROLE_PAN: readonly number[] = [0, 0, 0.12, -0.12, 0, -0.3, 0.3, 0.2, 0, -0.15, -0.25, 0.25, 0.2, -0.4, 0.4, -0.2];
/** Le choke : CH et OH (1), CH2 et OH2 (2). */
const ROLE_CHOKE: readonly number[] = [0, 0, 1, 1, 0, 0, 0, 0, 0, 0, 2, 2, 0, 0, 0, 0];

/**
 * La correction de niveau d'un sample (dB), de son RMS mesure : un fichier dense baisse, un fichier maigre monte (au plus
 * +3.9 dB, le haut du reglage). "famille numero".
 */
const TRIM: Readonly<Record<string, number>> = {
  'bd 4': -1.5, 'bd 5': 1, 'bd 15': 1, 'bd 16': -1, 'bd 22': -1, 'bd 25': -1, 'bd 26': -1,
  'sd 8': 2, 'sd 9': 3, 'sd 12': 1, 'sd 16': 1, 'sd 17': 2, 'sd 20': 1, 'sd 23': 1,
  'ch 4': 1, 'ch 5': -2, 'ch 10': -1, 'ch 12': 1, 'ch 15': 3,
  'oh 8': 2, 'oh 10': 2, 'oh 13': -1, 'oh 18': 1, 'oh 21': 1,
  'cp 4': 1, 'cp 9': 2, 'cp 14': 2, 'cp 15': 3,
  'tom 14': -1,
  'ht 1': 3.9,
};

/** Une piste d'un kit : le numero du sample, puis ses reglages (db : en plus du role ; les autres : des reglages de piste). */
type Tk = number | { n: number; db?: number; pan?: number; decay?: number; tune?: number; reverb?: number; delay?: number; chorus?: number; dist?: number };
type Kit = Partial<Record<TrackKey, Tk>>;
type Rows = Partial<Record<TrackKey, string>>;

interface Variation {
  /** ce qui change du kit du style (le kick, la caisse, le clap) */
  kit?: Kit;
  steps: Rows;
  fx?: Partial<Fx>;
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

const STYLES: readonly Style[] = [
  {
    name: 'DARK DISCO',
    bpm: 118,
    fx: { swing: 0.16, drive: 0.14, reverb: 0.22, delay: 0.12, chorus: 0.1 },
    kit: { BD: 14, SD: 13, CH: 12, OH: 15, CP: { n: 5, reverb: 0.25 }, TOM: { n: 9, reverb: 0.15 }, HT: { n: 4, reverb: 0.15 }, CY: 7, T9: 25, T10: 5, T11: 13, T12: 18, T13: 6, T14: 8, T15: 1, T16: 6 },
    vars: [
      { steps: { BD: F4, CP: B8, OH: OFF, CH: H16 } },
      { kit: { BD: 24, CP: { n: 4, reverb: 0.25 } }, steps: { BD: '9000900090009003', CP: B8, OH: OFF, CH: H16, TOM: '0000000600000060', HT: '0000000000050000', T10: '0020000000200200', T11: '3232323232323232' } },
      { kit: { BD: 23, CP: { n: 9, reverb: 0.25 } }, steps: { BD: F4, SD: B7, CP: B8, OH: OFF, CH: H16, TOM: '0060000000600000', HT: '0000000050000050', T13: '0000000000000030', T14: '0000030000000300', T15: '0000000000400000' } },
    ],
  },
  {
    name: 'INDIE DANCE',
    bpm: 122,
    fx: { swing: 0.12, drive: 0.18, reverb: 0.16, delay: 0.1 },
    kit: { BD: 26, SD: 14, CH: 10, OH: 12, CP: { n: 7, reverb: 0.15 }, TOM: 14, HT: 12, CY: 4, T9: 11, T10: 5, T11: 6, T12: 1, T13: 1, T14: { n: 8, delay: 0.2 }, T15: 5, T16: 6 },
    vars: [
      { steps: { BD: F4, SD: B7, CP: B8, OH: OFF, CH: H16 } },
      { kit: { BD: 1, SD: 22, CP: { n: 12, reverb: 0.15 } }, steps: { BD: '9000900090009020', SD: '0000800000008002', CP: B7, OH: OFF, CH: H16, HT: '0000000000000600', T10: '0000000200000000', T14: '0003000000030000' } },
      { kit: { BD: 6, SD: 18, CP: { n: 4, reverb: 0.15 } }, steps: { BD: '9000009000900000', SD: BK, CP: '0000000000007000', CH: H8, OH: '0000000700000000', TOM: '0000000000000060', HT: '0000000000600000', T9: '0000000000000300', T13: '0000000003000000' } },
    ],
  },
  {
    name: 'MINIMAL',
    bpm: 125,
    fx: { swing: 0.35, reverb: 0.14, delay: 0.2 },
    kit: { BD: 11, SD: 5, CH: 1, OH: 16, CP: 6, TOM: { n: 8, delay: 0.3 }, HT: { n: 5, delay: 0.25 }, CY: 4, T9: 4, T10: 1, T11: 5, T12: 8, T13: 1, T14: { n: 1, delay: 0.2 }, T15: { n: 12, delay: 0.25 }, T16: 12 },
    vars: [
      { steps: { BD: F4, CP: B7, CH: '0050005000500050', TOM: '0000003000000300', HT: '0030000000000000', SD: '0000000000000040' } },
      { kit: { BD: 4, SD: 19, CP: 12 }, steps: { BD: F4, CP: B7, CH: '3050305030503050', OH: '0000000000000006', HT: '0000004000000000', SD: '0000000300000030', T14: '0303030003030300', T15: '0000000000040000' } },
      { kit: { BD: 22, SD: 9, CP: 11 }, steps: { BD: '9000900090009030', CP: B6, CH: '4353435343534353', TOM: '0030000000300003', HT: '0000030000000300', T10: '0000000000000200', T12: '0000000060000000', T13: '0000000004000000' } },
    ],
  },
  {
    name: 'ITALO',
    bpm: 120,
    fx: { swing: 0, drive: 0.08, reverb: 0.22, delay: 0.14, chorus: 0.16 },
    kit: { BD: 9, SD: { n: 10, reverb: 0.3 }, CH: 9, OH: 1, CP: { n: 14, reverb: 0.25 }, TOM: { n: 16, reverb: 0.2 }, HT: { n: 6, reverb: 0.2 }, CY: 1, T9: 24, T10: 5, T11: 4, T12: 14, T13: 6, T14: { n: 13, reverb: 0.2 }, T15: { n: 9, reverb: 0.2 }, T16: 6 },
    vars: [
      { steps: { BD: F4, SD: BK, CP: B6, OH: OFF, CH: '6000600060006000' } },
      // Le roulement de toms de la fin de mesure, du plus aigu au plus grave
      { kit: { BD: 13, SD: { n: 11, reverb: 0.3 }, CP: { n: 9, reverb: 0.25 } }, steps: { BD: F4, SD: BK, CP: '0000000000008000', OH: OFF, CH: H16, T15: '0000000000007000', HT: '0000000000000700', T14: '0000000000000070', TOM: '0000000000000007' } },
      { kit: { BD: 24, SD: { n: 15, reverb: 0.3 }, CP: { n: 5, reverb: 0.25 } }, steps: { BD: F4, SD: BK, CP: '0000700000007070', CH: H8, OH: '0000000700000007', TOM: '0000006000000000', HT: '0000000060000000' } },
    ],
  },
  {
    name: 'EBM',
    bpm: 124,
    fx: { swing: 0, drive: 0.38, reverb: 0.22 },
    kit: { BD: 22, SD: 18, CH: 5, OH: 8, CP: 4, TOM: 14, HT: 12, CY: 12, T9: 16, T10: 28, T11: 10, T12: 21, T13: 12, T14: 6, T15: 4, T16: 6 },
    vars: [
      { steps: { BD: F4, SD: BK, CH: HS16 } },
      { kit: { BD: 16, SD: 14 }, steps: { BD: F4, SD: BK, CH: H8, OH: '0000000000000008', TOM: '0060006000600060', T10: '0000000030000030' } },
      { kit: { BD: 13, SD: 12 }, steps: { BD: '9009000090090000', SD: BK, CH: HS16, CP: '0000000000008000', HT: '0000000600000006' } },
    ],
  },
  {
    name: 'ELECTRO',
    bpm: 128,
    fx: { swing: 0.1, drive: 0.12, reverb: 0.14, delay: 0.14 },
    kit: { BD: 15, SD: 8, CH: 10, OH: 16, CP: { n: 12, reverb: 0.15 }, TOM: 16, HT: 5, CY: 4, T9: 9, T10: 5, T11: 1, T12: 12, T13: 1, T14: 13, T15: 12, T16: 6 },
    vars: [
      { steps: { BD: '9000009000900000', SD: BK, CH: HS16 } },
      { kit: { BD: 5, SD: 16, CP: { n: 7, reverb: 0.15 } }, steps: { BD: '9009000000900000', SD: BK, CP: '0000000000007000', CH: '7070757070707500', OH: '0000000000000070', HT: '0060006000000060' } },
      { kit: { BD: 21, SD: 20, CP: { n: 15, reverb: 0.15 } }, steps: { BD: '9000009000090090', SD: BK, CH: HS16, CP: '0000700000000000', TOM: '0000000000000066' } },
    ],
  },
  {
    name: 'HOUSE',
    bpm: 124,
    fx: { swing: 0.48, drive: 0.08, reverb: 0.16, delay: 0.08 },
    kit: { BD: 25, SD: 22, CH: 9, OH: 13, CP: { n: 9, reverb: 0.2 }, TOM: 12, HT: 7, CY: 5, T9: 1, T10: 5, T11: 13, T12: 10, T13: 6, T14: 8, T15: 5, T16: 6 },
    vars: [
      { steps: { BD: F4, CP: B8, OH: OFF, CH: H16 } },
      { kit: { BD: 1, CP: { n: 4, reverb: 0.2 } }, steps: { BD: F4, CP: B8, SD: '0000000300000003', OH: OFF, CH: H16, HT: '0000000000030000', T11: '0303030303030303' } },
      { kit: { BD: 10, CP: { n: 5, reverb: 0.2 } }, steps: { BD: '9000900090009003', CP: B8, OH: OFF, CH: H16, TOM: '0000006000000600', HT: '0000000000600000', T13: '0000000000000060' } },
    ],
  },
  {
    name: 'TECHNO',
    bpm: 132,
    fx: { swing: 0.05, drive: 0.3, reverb: 0.2, delay: 0.06 },
    kit: { BD: 17, SD: 12, CH: 10, OH: 21, CP: { n: 4, reverb: 0.3 }, TOM: 6, HT: { n: 11, db: -3, reverb: 0.35 }, CY: 8, T9: 11, T10: 19, T11: 5, T12: 7, T13: 12, T14: 9, T15: 4, T16: 6 },
    vars: [
      { steps: { BD: F4, OH: OFF, CH: HEA, CP: B6 } },
      { kit: { BD: 19, CP: { n: 15, reverb: 0.3 } }, steps: { BD: F4, OH: OFF, CH: H16, CP: B7, TOM: '0000000600000060', HT: '0030003000300030' } },
      { kit: { BD: 7 }, steps: { BD: F4, CH: HS16, CY: OFF, TOM: '0060000000600000', HT: '0000000030000003', T10: '0000000700000000' } },
    ],
  },
  {
    name: 'ACID',
    bpm: 130,
    fx: { swing: 0.1, drive: 0.2, reverb: 0.12, delay: 0.08 },
    kit: { BD: 8, SD: 16, CH: 10, OH: 12, CP: { n: 7, reverb: 0.15 }, TOM: 13, HT: 12, CY: 4, T9: 22, T10: 5, T11: 1, T12: 16, T13: 1, T14: 8, T15: 5, T16: 6 },
    vars: [
      { steps: { BD: F4, CP: B8, SD: '0000000000000057', CH: '7408740874087409', OH: '0080008000800080' } },
      { kit: { BD: 12, SD: 9, CP: { n: 12, reverb: 0.15 } }, steps: { BD: F4, CP: B8, SD: '0000000000050057', CH: '7405740574057405', OH: '0080008000800080', TOM: '0000000000600600', HT: '0000060000000000' } },
      { kit: { BD: 20, SD: 8, CP: { n: 4, reverb: 0.15 } }, steps: { BD: '9000900090009090', CP: B8, SD: '0000000000002468', CH: H16, OH: OFF } },
    ],
  },
  {
    name: 'ROLLING',
    bpm: 138,
    fx: { swing: 0, drive: 0.15, reverb: 0.14, delay: 0.08 },
    // T9 : le kick court en fantome, serre, qui roule entre les temps
    kit: { BD: 4, SD: 19, CH: 5, OH: 16, CP: { n: 12, reverb: 0.2 }, TOM: 6, HT: 11, CY: 8, T9: { n: 11, db: -2, decay: 0.5 }, T10: 5, T11: 1, T12: 21, T13: 1, T14: 9, T15: 4, T16: 6 },
    vars: [
      { steps: { BD: F4, T9: '0033003300330033', OH: OFF, CH: HEA, CP: B6 } },
      { kit: { BD: 26 }, steps: { BD: F4, T9: '0303030303030303', OH: OFF, CH: H16, SD: '0000000000004000', HT: '0000000000000050' } },
      { kit: { BD: 18 }, steps: { BD: F4, T9: '0033003300330033', CH: HS16, CY: OFF, CP: B7, TOM: '0000000000000660' } },
    ],
  },
  {
    name: 'BREAKBEAT',
    bpm: 130,
    fx: { swing: 0.16, drive: 0.24, reverb: 0.2, delay: 0.16 },
    kit: { BD: 13, SD: { n: 13, reverb: 0.1 }, CH: 9, OH: 10, CP: 7, TOM: 16, HT: 12, CY: 5, T9: 9, T10: 5, T11: 6, T12: 12, T13: 6, T14: 14, T15: 6, T16: 6 },
    vars: [
      { steps: { BD: '9000000000900000', SD: BK, T10: '0000000300000030', CH: '7070707070707000', OH: '0000000000000080' } },
      { kit: { BD: 9, SD: { n: 17, reverb: 0.1 } }, steps: { BD: '9090000000900000', SD: BK, T10: '0000000303000003', CH: '7070707070707070' } },
      { kit: { BD: 22, SD: { n: 21, reverb: 0.1 } }, steps: { BD: '9000000000990000', SD: BK, T10: '0030000300000030', CH: HS16, TOM: '0000000000000060' } },
    ],
  },
  {
    name: 'D&B',
    bpm: 174,
    fx: { swing: 0.04, drive: 0.3, reverb: 0.16, delay: 0.14 },
    kit: { BD: 22, SD: { n: 14, reverb: 0.12 }, CH: 10, OH: 12, CP: 12, TOM: 16, HT: 12, CY: 4, T9: 13, T10: 5, T11: 1, T12: 16, T13: 6, T14: 14, T15: 5, T16: 6 },
    vars: [
      // Le two-step : le kick sur 1 et le "et" de 3, la caisse sur 2 et 4
      { steps: { BD: '9000000000900000', SD: BK, CH: '7070707070707070' } },
      { kit: { BD: 13, SD: { n: 18, reverb: 0.12 } }, steps: { BD: '9000000000900000', SD: BK, T10: '0000000303000003', CH: '7000700070007000', CY: '0060006000600060' } },
      { kit: { BD: 11, SD: { n: 22, reverb: 0.12 } }, steps: { BD: '9000009000900000', SD: BK, T10: '0000000003000030', CH: HS16, CP: B6 } },
    ],
  },
];

const BLANK = '0000000000000000';
/** Une rangee de 16 pas, toujours (des chiffres de 0 a 9). */
const row = (s: string | undefined): string => (s && /^[0-9]{16}$/.test(s) ? s : BLANK);
/** dB -> le reglage VOL d'une piste (gain (v / 0.8)^2 : 0 dB a 0.8, +3.9 dB a fond). */
const levelOf = (db: number): number => Math.round(Math.max(0, Math.min(1, 0.8 * Math.pow(10, db / 40))) * 1000) / 1000;

function kitOf(base: Kit, over: Kit | undefined): StoredKit16 {
  const t: NonNullable<StoredKit16['t']> = {};
  TRACK_KEYS.forEach((key, i) => {
    const spec = over?.[key] ?? base[key];
    if (spec === undefined) return;
    const o = typeof spec === 'number' ? { n: spec } : spec;
    const fam = FAMS[i % 8];
    const p: Record<string, number> = { level: levelOf(ROLE_DB[i] + (TRIM[`${fam} ${o.n}`] ?? 0) + (o.db ?? 0)) };
    const pan = o.pan ?? ROLE_PAN[i];
    if (pan !== 0) p.pan = pan;
    if (o.decay !== undefined) p.decay = o.decay;
    if (o.tune !== undefined) p.tune = o.tune / 24;
    if (o.reverb) p.reverb = o.reverb;
    if (o.delay) p.delay = o.delay;
    if (o.chorus) p.chorus = o.chorus;
    if (o.dist) p.dist = o.dist;
    t[key] = { m: 'oneshot', s: `${fam}/${FILE[fam]} ${o.n}.wav`, p, ...(ROLE_CHOKE[i] ? { ch: ROLE_CHOKE[i] } : {}) };
  });
  return { v: 1, t };
}

/** Les presets d'usine du plugin : DARK DISCO 1, 2, 3, INDIE DANCE 1... (la liste de PRESETS). */
export function pluginRytmFactory(): { name: string; data: RytmFactory }[] {
  const out: { name: string; data: RytmFactory }[] = [];
  for (const s of STYLES) {
    s.vars.forEach((v, k) => {
      const steps = Object.fromEntries(TRACK_KEYS.map((key) => [key, row(v.steps[key])])) as unknown as Steps;
      const fx: Fx = { ...NEUTRAL_FX, ...s.fx, ...(v.fx ?? {}) };
      // Le kit entier est dans tracks (les 16 pistes) : pas de kit d'avant (state/presets.ts apply le pose tel quel)
      const data = { steps, bpm: s.bpm, fx, stretch: 0, voices: {}, tracks: kitOf(s.kit, v.kit) } as unknown as RytmFactory;
      out.push({ name: `${s.name} ${k + 1}`, data });
    });
  }
  return out;
}
