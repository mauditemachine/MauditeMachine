/**
 * Les presets d'usine (2026-10-07, Mika : "je voudrais qu'il y ait deja des
 * presets de styles de musique electro differents, et pas juste Disco").
 * Refaits le meme jour (Mika : "je n'aime pas du tout les presets, ce ne
 * sont pas des sons dans les styles dont ils portent le nom ; refais-les en
 * analysant la construction de chaque style ; pour les kicks et les snares,
 * utilise mes samples") : chaque style est ecrit a la main, d'apres sa
 * construction (la grille de la batterie et ses dynamiques, le son de
 * chaque voix, la ligne de basse, le patch et les accords du synthe), plus
 * aucune ligne tiree au hasard. Les memes dix styles sur le MM-RYTM, le
 * MM-ARP et le MM-BASS (charger DARK DISCO sur les trois donne un morceau
 * qui tient), plus DEEP SUB pour la basse. Tout est en fa diese mineur, la
 * tonalite du site : les kicks sont accordes sur F# (un demi-ton), la basse
 * suit les accords du MM-ARP quand le style change d'accord (ROOT ARP).
 *
 * Les kicks et les snares sont les samples de Mika (public/samples/rytm),
 * choisis par leur analyse (hauteur, longueur, attaque) :
 * - kicks : BLUEPRINT (sol 1, court, attaque ronde : house, italo),
 *   VNTM (fa 1, le plus court et le plus grave : minimal), ENGELHARDT (sol
 *   1, le plus long, aucune attaque, presque une 808 : techno, electro),
 *   CARASSI (sol 1, le plus claquant, queue rapide : acid, psy prog, EBM),
 *   STEIN (sol 1, un corps qui tient : dark disco), AFFKT (la 1, le plus
 *   aigu, attaque nette : indie dance) ;
 * - snares : PSY 02 (corps rond vers 140 Hz : indie dance, techno, house),
 *   PSY 12 (brillante et seche : acid, minimal, psy prog), PSY 26 (tres
 *   brillante, longue queue : EBM, coupee par DECAY), 707 (courte, annees
 *   80 : dark disco, electro, italo).
 * Les deux couches (2026-10-08, l'etape R3, audio/kit.ts) : ces samples
 * jouent sur la couche SAMPLE (son TUNE vers F#, son LEN quand le style
 * coupe la queue), la couche SYNTH a 0, prete : sa MACHINE (le son calcule
 * qui remplacait le sample s'il manquait) accordee elle aussi sur F#1 ; la
 * monter double le kick d'un 909 juste. Un sample parti (Mika a remplace le
 * dossier par scripts/import-rytm-samples.mjs) : celui du meme numero, sinon
 * le premier de la famille ; aucun : la synthese joue seule.
 * Les niveaux (2026-10-07, la meme demande) : le kick est la reference,
 * le reste dessous (audio/shotsdsp.ts) ; les velocites des patterns s'y
 * lisent : 9 l'accent, 6 a 8 le jeu, 2 a 4 les notes fantomes.
 *
 * Construction de chaque style (la batterie ; la basse ; le synthe) :
 * - ACID (130) : l'acid house de Chicago et sa suite techno ; kick 4/4,
 *   clap 2 et 4, charleys en doubles croches, l'ouvert a contretemps, a
 *   peine de swing ; la 303 fait tout : doubles croches, accents a
 *   contretemps, slides, sauts d'octave, filtre ferme et resonance haute ;
 *   un second motif de trois notes, tres resonant, qui tourne contre la
 *   mesure.
 * - DARK DISCO (118) : le disco lent et lourd (Curses, Kiwi, Rodion, entre
 *   italo, new wave et EBM) ; kick droit, snare et clap sur 2 et 4 avec de
 *   la piece, l'ouvert a contretemps, des doubles croches humaines, une
 *   conga pour le groove ; la basse galope (x.xx) avec l'octave, scie dans
 *   un filtre a mi-course, un peu de drive ; l'arpege monte et descend sur
 *   F#m, D, E, F#m, delai pointe et chorus.
 * - INDIE DANCE (122) : l'energie rock et new wave sur une grille club ;
 *   kick qui claque, snare et clap ensemble, charleys qui poussent, l'ouvert
 *   a contretemps, des percussions decalees ; la basse en croches avec
 *   l'octave sur le "et", une relance en fin de mesure ; l'arpege en
 *   croches, large et chorusse, sur F#m, A, E, D.
 * - MINIMAL (125) : la minimale hypnotique (Raresh, Rhadoo, Villalobos) ;
 *   un swing lourd (57 %), un kick court et rond, un clap doux sur 2 et 4,
 *   presque rien sur les temps : des doubles croches de shaker aux
 *   dynamiques inegales, de petites percussions accordees qui se
 *   repondent, tout est court et sec, l'espace est dans le delai ; la basse,
 *   quatre notes rondes entre les kicks, la meme figure ; le synthe, un bip
 *   de trois notes contre la mesure, beaucoup de delai.
 * - PSY PROG (138) : la psytrance progressive (Ace Ventura, Liquid Soul) ;
 *   tout droit, un kick court sur chaque temps et la basse qui roule sur
 *   les trois doubles croches d'apres (K B B B), clap et snare brillants sur
 *   2 et 4, l'ouvert a contretemps ; une note de basse, staccato, enveloppe
 *   rapide ; l'arpege en doubles croches, resonant, un LFO qui ouvre le
 *   filtre sur deux mesures, un long delai.
 * - TECHNO (132) : la techno de hangar (Ben Klock, Dettmann) ; le kick long
 *   et grave, l'ouvert sur chaque contretemps, les doubles croches dessous,
 *   un clap discret, des toms decales, sature ; la basse sur le "et" avec
 *   une double croche qui gronde ; un seul motif de quatre notes qui
 *   descend, filtre et delai, une ouverture lente sur quatre mesures.
 * - HOUSE (124) : de Chicago a la deep house (Larry Heard, Kerri Chandler) ;
 *   le swing de la MPC (58 %), kick et clap de 909, l'ouvert a contretemps,
 *   un shaker swingue, des congas ; la basse bouge (octaves, quintes, notes
 *   tenues) ; des accords de septieme arpeges lentement, doux, chorusses,
 *   sur F#m7, Dmaj7, Bm, C#m.
 * - ELECTRO (128) : l'electro de Detroit (Drexciya, Aux 88, d'apres
 *   Kraftwerk) ; le kick ne joue pas les quatre temps : il syncope (1, le
 *   "et" de 2, le "et" de 3), snare et clap sur 2 et 4, les charleys de 808
 *   en doubles croches, des toms pour finir la mesure ; la basse suit la
 *   syncope avec des sauts d'octave ; l'arpege carre sur trois octaves,
 *   F#m et C#m.
 * - EBM (124) : l'Electronic Body Music (DAF, Front 242, Nitzer Ebb) ; carre
 *   et martial : un kick dur et sature, un gros snare a porte sur 2 et 4,
 *   des croches de charley sans dynamique, aucun swing ; la basse martele
 *   toutes les doubles croches, l'octave sur la troisieme, saturee ; le
 *   synthe, un coup court et agressif, F#m et D.
 * - ITALO (120) : l'italo disco (Moroder, Klein + M.B.O., Kano) ; boite des
 *   annees 80, kick 4/4, snare seche et clap sur 2 et 4, charleys en
 *   doubles croches, l'ouvert a contretemps, une relance de toms ; la basse
 *   en octaves qui rebondissent en doubles croches (I Feel Love), sur les
 *   accords ; l'arpege brillant, chorus et delai, sur F#m, D, A, E.
 * - DEEP SUB (basse seule) : de longues notes de sub liees, qui glissent.
 */

import { INSTRUMENTS, NEUTRAL_FX, type Fx, type Steps } from '../audio/pattern';
import { VOICE_FX_DEFAULT, type VoiceFx } from '../audio/voicefx';
import { KIT_FAMILIES, LAYER_DEFAULT, LAYER_TUNE_ST, resolveSample, type KitFamily, type KitKnob, type KitModel, type Layer } from '../audio/kit';
import { kickHz } from '../audio/shotsdsp';
import { lenOfDecay } from '../audio/sampledsp';
import type { Inst } from '../theme';
import { VOY_KNOB_IDS, voyKnob, type VoyKnobId } from '../voyager/params';
import { BASS_KNOBS, BASS_ROOTS, BASS_SCALES, BASS_STYLES, type BassKnobId, type BassStyle } from '../bass/params';
import type { BassStep } from '../bass/state';

/* ---------------- MM-RYTM ---------------- */

/** Les samples de Mika (public/samples/rytm), par leur cle. */
const KICK = {
  blueprint: 'bd/01 BluePrint.wav',
  vntm: 'bd/02 VNTM.wav',
  engelhardt: 'bd/03 Engelhardt.wav',
  carassi: 'bd/04 Carassi.wav',
  stein: 'bd/05 Stein.wav',
  affkt: 'bd/06 AFFKT.wav',
} as const;
const SNARE = {
  psy02: 'sd/01 Psy 02.wav',
  psy12: 'sd/02 Psy 12.wav',
  psy26: 'sd/03 Psy 26.wav',
  s707: 'sd/04 707.wav',
} as const;

/** TUNE d'un kick sample en demi-tons (audio/sampledsp.ts : 24 demi-tons sur la course) : vers F#. */
const st = (n: number): number => 0.5 + n / 24;

interface RytmGenre {
  name: string;
  bpm: number;
  fx: Partial<Fx>;
  /** les samples de Mika (kick, snare) et, s'ils manquent, le son calcule qui les remplace */
  kick: { key: string; or: KitModel };
  snare: { key: string; or: KitModel };
  /** les autres familles : charleys, clap, toms */
  hh: KitModel;
  cp: KitModel;
  tom: KitModel;
  /** les potards du kit (TUNE en demi-tons vers F#, ATTACK, DECAY, DRIVE ; SNAPPY ; GATE) */
  kit: Partial<Record<KitKnob, number>>;
  steps: Partial<Steps>;
  /** les effets de quelques voix (le reste neutre) */
  voices?: Partial<Record<Inst, Partial<VoiceFx>>>;
}

const RYTM: readonly RytmGenre[] = [
  {
    name: 'ACID',
    bpm: 130,
    fx: { swing: 0.12, drive: 0.15, reverb: 0.08, delay: 0.05 },
    kick: { key: KICK.carassi, or: '909' },
    snare: { key: SNARE.psy12, or: '909' },
    hh: '909',
    cp: '909',
    tom: '909',
    kit: { tune: st(-1), attack: 0.62, decay: 0.45, drive: 0.32 },
    steps: {
      BD: '9000900090009000',
      CP: '0000800000008000',
      SD: '0000000000000304',
      CH: '7408740874087408',
      OH: '0080008000800080',
    },
    voices: { CP: { reverb: 0.15 }, OH: { decay: 0.8 } },
  },
  {
    name: 'DARK DISCO',
    bpm: 118,
    fx: { swing: 0.18, drive: 0.12, reverb: 0.2, delay: 0.1, chorus: 0.08 },
    kick: { key: KICK.stein, or: '909' },
    snare: { key: SNARE.s707, or: '808' },
    hh: '808',
    cp: '808',
    tom: '808',
    kit: { tune: st(-1), attack: 0.55, decay: 0.45, drive: 0.35 },
    steps: {
      BD: '9000900090009000',
      SD: '0000900000009003',
      CP: '0000600000006000',
      CH: '6407640764076408',
      OH: '0080008000800080',
      TOM: '0000000000400000',
      HT: '0000000300000000',
    },
    voices: { SD: { reverb: 0.35 }, CP: { reverb: 0.2 }, OH: { decay: 0.7 }, TOM: { tone: -0.2 } },
  },
  {
    name: 'INDIE DANCE',
    bpm: 122,
    fx: { swing: 0.08, drive: 0.18, reverb: 0.14, delay: 0.08 },
    kick: { key: KICK.affkt, or: '909' },
    snare: { key: SNARE.psy02, or: '909' },
    hh: '909',
    cp: '909',
    tom: 'mm',
    kit: { tune: st(-1), attack: 0.6, decay: 0.45, drive: 0.3 },
    steps: {
      BD: '9000900090009000',
      SD: '0000700000007000',
      CP: '0000500000005000',
      CH: '8508850885088509',
      OH: '0070007000700070',
      TOM: '0000000400000000',
      HT: '0004000000040000',
    },
    voices: { SD: { reverb: 0.18 }, HT: { tone: 0.3, decay: 0.5 }, TOM: { decay: 0.6 } },
  },
  {
    name: 'MINIMAL',
    bpm: 125,
    fx: { swing: 0.45, reverb: 0.12, delay: 0.18 },
    kick: { key: KICK.vntm, or: '808' },
    snare: { key: SNARE.psy12, or: '808' },
    hh: '808',
    cp: '808',
    tom: '808',
    kit: { tune: st(1), attack: 0.45, decay: 0.45, drive: 0.2 },
    steps: {
      BD: '9000900090009000',
      CP: '0000700000007000',
      SD: '0000000200000000',
      CH: '6385638563856305',
      OH: '0000000000000050',
      TOM: '0000004000000004',
      HT: '0005000005000000',
    },
    voices: {
      CH: { decay: 0.55 },
      CP: { decay: 0.6, reverb: 0.12 },
      TOM: { tone: 0.35, decay: 0.35 },
      HT: { tone: 0.5, decay: 0.3, delay: 0.3 },
    },
  },
  {
    name: 'PSY PROG',
    bpm: 138,
    fx: { swing: 0, drive: 0.1, reverb: 0.12, delay: 0.06 },
    kick: { key: KICK.carassi, or: '909' },
    snare: { key: SNARE.psy12, or: '909' },
    hh: '909',
    cp: '909',
    tom: 'mm',
    // La queue du kick coupee (DECAY : 70 % du sample) : la basse roule juste apres lui
    kit: { tune: st(-1), attack: 0.65, decay: 0.3, drive: 0.3 },
    steps: {
      BD: '9000900090009000',
      CP: '0000800000008000',
      SD: '0000500000005000',
      CH: '8507850785078507',
      OH: '0090009000900090',
    },
    voices: { CP: { reverb: 0.2 }, SD: { reverb: 0.12 } },
  },
  {
    name: 'TECHNO',
    bpm: 132,
    fx: { swing: 0.06, drive: 0.28, reverb: 0.18, delay: 0.05 },
    kick: { key: KICK.engelhardt, or: '909' },
    snare: { key: SNARE.psy02, or: '909' },
    hh: '909',
    cp: '909',
    tom: '909',
    kit: { tune: st(-1), attack: 0.55, decay: 0.45, drive: 0.45 },
    steps: {
      BD: '9000900090009000',
      CP: '0000700000007000',
      SD: '0000000000000020',
      CH: '7507750775077507',
      OH: '0090009000900090',
      TOM: '0000000004000400',
    },
    voices: { CP: { reverb: 0.25 }, OH: { decay: 0.75 }, TOM: { tone: -0.3, delay: 0.2 } },
  },
  {
    name: 'HOUSE',
    bpm: 124,
    fx: { swing: 0.5, drive: 0.05, reverb: 0.15, delay: 0.06 },
    kick: { key: KICK.blueprint, or: '909' },
    snare: { key: SNARE.psy02, or: '909' },
    hh: '909',
    cp: '909',
    tom: '808',
    kit: { tune: st(-1), attack: 0.5, decay: 0.45, drive: 0.25 },
    steps: {
      BD: '9000900090009000',
      CP: '0000900000009000',
      SD: '0000000000000003',
      CH: '5406540654065406',
      OH: '0080008000800080',
      TOM: '0000000400000400',
      HT: '0004000000040000',
    },
    voices: { CP: { reverb: 0.15 }, TOM: { tone: 0.25, decay: 0.5 }, HT: { tone: 0.4, decay: 0.45 } },
  },
  {
    name: 'ELECTRO',
    bpm: 128,
    fx: { swing: 0.1, drive: 0.1, reverb: 0.12, delay: 0.12 },
    kick: { key: KICK.engelhardt, or: '808' },
    snare: { key: SNARE.s707, or: '808' },
    hh: '808',
    cp: '808',
    tom: '808',
    kit: { tune: st(-1), attack: 0.5, decay: 0.45, drive: 0.25 },
    steps: {
      BD: '9000009000900000',
      SD: '0000800000008000',
      CP: '0000500000005000',
      CH: '8585858585858500',
      TOM: '0000000000000060',
      HT: '0000000000000005',
    },
    voices: { SD: { reverb: 0.12 }, TOM: { tone: -0.15, delay: 0.25 } },
  },
  {
    name: 'EBM',
    bpm: 124,
    fx: { swing: 0, drive: 0.35, reverb: 0.2 },
    kick: { key: KICK.carassi, or: '909' },
    snare: { key: SNARE.psy26, or: '909' },
    hh: '909',
    cp: '909',
    tom: '909',
    // La porte du clap (GATE) ; la longue queue du snare PSY 26 coupee par son DECAY
    kit: { tune: st(-1), attack: 0.7, decay: 0.45, drive: 0.6, gate: 1 },
    steps: {
      BD: '9000900090009000',
      SD: '0000800000008000',
      CP: '0000600000006000',
      CH: '7070707070707070',
    },
    voices: { SD: { decay: 0.55, reverb: 0.15 }, CP: { decay: 0.7 }, CH: { tone: -0.1 } },
  },
  {
    name: 'ITALO',
    bpm: 120,
    fx: { swing: 0, drive: 0.05, reverb: 0.2, delay: 0.12, chorus: 0.15 },
    kick: { key: KICK.blueprint, or: '808' },
    snare: { key: SNARE.s707, or: '808' },
    hh: '808',
    cp: '808',
    tom: 'mm',
    kit: { tune: st(-1), attack: 0.5, decay: 0.45, drive: 0.2 },
    steps: {
      BD: '9000900090009000',
      SD: '0000900000009000',
      CP: '0000500000005000',
      CH: '7507750775077507',
      OH: '0070007000700070',
      TOM: '0000000000000400',
      HT: '0000000000000040',
    },
    voices: { SD: { reverb: 0.25 }, TOM: { tone: 0.2 }, HT: { tone: 0.4 } },
  },
];

export interface RytmFactory {
  steps: Steps;
  bpm: number;
  fx: Fx;
  stretch: number;
  voices: Record<Inst, VoiceFx>;
  kit: Record<string, number>;
  sounds: Partial<Record<KitFamily, string>>;
  /** les deux couches (R3, state/presets.ts RytmData) */
  machines: Partial<Record<KitFamily, string>>;
  samples: Partial<Record<KitFamily, string>>;
  layers: Partial<Record<KitFamily, Layer>>;
  knobs: Record<string, number>;
}

const blank = '0000000000000000';
/** Les potards du kit poses par chaque preset (le reste de leur valeur de depart). */
const KIT_BASE: Record<KitKnob, number> = { tune: 0.5, attack: 0.5, decay: 0.45, drive: 0.25, snappy: 0.5, gate: 0, sweep: 0.5, sdtune: 0.5, sddecay: 0.5, sdtone: 0.5 };

/** Un sample de Mika s'il est la (ou celui du meme numero apres un nouvel import), sinon undefined. */
const sampleOf = (f: KitFamily, s: { key: string }): string | undefined => resolveSample(f, s.key);

/** Le K.TUNE qui pose le kick de synthese sur F#1 (46.25 Hz, la tonalite du site), au 127e. */
const kickOnF = (m: KitModel): number => Math.round((0.5 + Math.log2(46.25 / kickHz(m, 0.5))) * 127) / 127;

export function rytmFactory(): { name: string; data: RytmFactory }[] {
  return RYTM.map((g) => {
    const bd = sampleOf('bd', g.kick);
    const sd = sampleOf('sd', g.snare);
    // Avant R3, TUNE et DECAY reglaient le sample du kick : ils passent a sa couche SAMPLE, la synthese est accordee sur F#1
    const kitKnobs: Record<KitKnob, number> = { ...KIT_BASE, ...g.kit, tune: kickOnF(g.kick.or), decay: g.kit.decay ?? KIT_BASE.decay };
    const sampleTune = Math.round(((g.kit.tune ?? 0.5) - 0.5) * 24) / LAYER_TUNE_ST;
    const families: Record<KitFamily, string> = { bd: bd ?? g.kick.or, sd: sd ?? g.snare.or, hh: g.hh, cp: g.cp, tom: g.tom, rs: 'mm' };
    const machines: Record<KitFamily, KitModel> = { bd: g.kick.or, sd: g.snare.or, hh: g.hh, cp: g.cp, tom: g.tom, rs: 'mm' };
    const layers = Object.fromEntries(KIT_FAMILIES.map((f) => [f, { ...LAYER_DEFAULT }])) as Record<KitFamily, Layer>;
    if (bd) layers.bd = { ...LAYER_DEFAULT, syn: 0, tune: sampleTune, len: lenOfDecay(g.kit.decay ?? KIT_BASE.decay) };
    if (sd) layers.sd = { ...LAYER_DEFAULT, syn: 0 };
    return {
      name: g.name,
      data: {
        steps: Object.fromEntries(INSTRUMENTS.map((k) => [k, g.steps[k] ?? blank])) as Steps,
        bpm: g.bpm,
        fx: { ...NEUTRAL_FX, ...g.fx },
        stretch: 0,
        voices: Object.fromEntries(INSTRUMENTS.map((k) => [k, { ...VOICE_FX_DEFAULT, ...(g.voices?.[k] ?? {}) }])) as Record<Inst, VoiceFx>,
        kit: kitKnobs,
        sounds: Object.fromEntries(KIT_FAMILIES.filter((f) => f !== 'rs').map((f) => [f, families[f]])) as Partial<Record<KitFamily, string>>,
        machines,
        samples: { ...(bd ? { bd } : {}), ...(sd ? { sd } : {}) },
        layers,
        knobs: kitKnobs,
      },
    };
  });
}

/* ---------------- MM-ARP ---------------- */

interface ArpGenre {
  name: string;
  knobs: Partial<Record<VoyKnobId, number>>;
  prog: number[];
}

/** Les crans des potards (idx / (n - 1)). */
const RATE = { '1/8': 1 / 3, '1/16': 2 / 3 } as const;
const MODE = { UP: 0, DOWN: 1 / 3, UPDN: 2 / 3, RAND: 1 } as const;
const RANGE = { 1: 0, 2: 0.5, 3: 1 } as const;
const NOTES = (n: number): number => n / 8;
const WAVE1 = { SINE: 0, TRI: 0.2, SAW: 0.4, SQUARE: 0.6, PULSE: 0.8, FM: 1 } as const;
const WAVE2 = { SINE: 0, TRI: 0.25, SAW: 0.5, SQUARE: 0.75, PULSE: 1 } as const;
const FEET = { 32: 0.2, 16: 0.4, 8: 0.6, 4: 0.8, 2: 1 } as const;
const FMODE = { MOOG: 0, LP12: 1 / 3, BP: 2 / 3, HP: 1 } as const;
const LFO_RATE = { '1 BAR': 4 / 6, '2 BAR': 5 / 6, '4 BAR': 1 } as const;
const LFO_TO = { CUTOFF: 0.25 } as const;
const CHORD = { BASIC: 0, TRIAD: 0.25, '7TH': 0.5, '9TH': 0.75 } as const;
/** FINE en cents (+/-50 sur la course). */
const cents = (c: number): number => 0.5 + c / 100;

/**
 * Les accords (voyager/chords.ts) : 0 F#m, 1 D, 2 E, 3 C#m, 4 Bm, 5 A, 6 F#m7, 7 Dmaj7.
 * VOLUME de chaque patch : sa crete vers -8.5 dBFS, 4 dB sous le kick (mesure
 * hors ligne) ; le bip de MINIMAL reste plus bas, comme dans le style.
 */
const ARP: readonly ArpGenre[] = [
  {
    // Un second motif de 303 : trois notes qui tournent contre la mesure, tres resonant
    name: 'ACID',
    knobs: { volume: 0.7, rate: RATE['1/16'], mode: MODE.UP, range: RANGE[1], notes: NOTES(3), gate: 0.35, wave1: WAVE1.SAW, on2: 0, fmode: FMODE.MOOG, cutoff: 0.3, res: 0.74, envAmt: 0.75, fA: 0, fD: 0.18, fS: 0, fR: 0.15, aA: 0, aD: 0.22, aS: 0.3, aR: 0.15, glide: 0.12, dist: 0.2, chorus: 0, delay: 0.28, reverb: 0.12, duck: 0.2, chord: CHORD.BASIC },
    prog: [0],
  },
  {
    // L'arpege qui monte et descend sur deux octaves, scie et carre a peine desaccordes, delai pointe, chorus
    name: 'DARK DISCO',
    knobs: { volume: 0.67, rate: RATE['1/16'], mode: MODE.UPDN, range: RANGE[2], gate: 0.45, wave1: WAVE1.SAW, wave2: WAVE2.SQUARE, range2: FEET[8], fine1: cents(-6), fine2: cents(6), osc2: 0.6, fmode: FMODE.LP12, cutoff: 0.42, res: 0.35, envAmt: 0.45, fD: 0.3, fS: 0.25, aD: 0.4, aS: 0.5, aR: 0.3, dist: 0.1, chorus: 0.35, delay: 0.35, reverb: 0.3, duck: 0.3, chord: CHORD.TRIAD },
    prog: [0, 1, 2, 0],
  },
  {
    // En croches, large et chorusse, deux scies desaccordees, des accords enchaines au plus pres
    name: 'INDIE DANCE',
    knobs: { volume: 0.71, rate: RATE['1/8'], mode: MODE.UP, range: RANGE[2], gate: 0.55, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-10), fine2: cents(10), fmode: FMODE.LP12, cutoff: 0.55, res: 0.3, envAmt: 0.35, fD: 0.4, fS: 0.3, aA: 0.05, aD: 0.5, aS: 0.6, aR: 0.45, chorus: 0.5, delay: 0.35, reverb: 0.4, duck: 0.35, chord: CHORD.TRIAD },
    prog: [0, 5, 2, 1],
  },
  {
    // Un bip de trois notes contre la mesure (triangle, une pointe de FM), court, beaucoup de delai
    name: 'MINIMAL',
    knobs: { volume: 1, rate: RATE['1/16'], mode: MODE.UP, range: RANGE[1], notes: NOTES(3), gate: 0.25, wave1: WAVE1.TRI, on2: 0, osc1: 1, fm: 0.22, ratio: 3 / 8, fmode: FMODE.LP12, cutoff: 0.58, res: 0.45, envAmt: 0.55, fD: 0.12, fS: 0, fR: 0.12, aD: 0.15, aS: 0, aR: 0.15, chorus: 0.05, delay: 0.5, reverb: 0.3, duck: 0.2, chord: CHORD.BASIC },
    prog: [0],
  },
  {
    // Doubles croches resonantes ; le LFO ouvre le filtre sur deux mesures ; un long delai
    name: 'PSY PROG',
    knobs: { volume: 0.79, rate: RATE['1/16'], mode: MODE.UP, range: RANGE[2], gate: 0.35, wave1: WAVE1.SAW, wave2: WAVE2.SQUARE, range2: FEET[8], fine2: cents(5), fmode: FMODE.MOOG, cutoff: 0.35, res: 0.62, envAmt: 0.55, fD: 0.2, fS: 0.1, aD: 0.25, aS: 0.2, aR: 0.2, lfoRate: LFO_RATE['2 BAR'], lfoShape: 0, lfoDest: LFO_TO.CUTOFF, lfoAmt: 0.35, chorus: 0.1, delay: 0.45, reverb: 0.25, duck: 0.4, chord: CHORD.BASIC },
    prog: [0],
  },
  {
    // Un motif de quatre notes qui descend, sature, une ouverture lente sur quatre mesures
    name: 'TECHNO',
    knobs: { rate: RATE['1/16'], mode: MODE.DOWN, range: RANGE[1], notes: NOTES(4), gate: 0.3, wave1: WAVE1.SAW, wave2: WAVE2.SQUARE, range2: FEET[16], fmode: FMODE.MOOG, cutoff: 0.32, res: 0.6, envAmt: 0.55, fD: 0.18, fS: 0.05, aD: 0.22, aS: 0.15, aR: 0.2, lfoRate: LFO_RATE['4 BAR'], lfoShape: 0, lfoDest: LFO_TO.CUTOFF, lfoAmt: 0.3, dist: 0.25, chorus: 0.1, delay: 0.4, reverb: 0.4, duck: 0.35, chord: CHORD.BASIC },
    prog: [0],
  },
  {
    // Des accords de septieme arpeges lentement, triangle et carre doux, chorus et reverbe
    name: 'HOUSE',
    knobs: { rate: RATE['1/8'], mode: MODE.UPDN, range: RANGE[2], gate: 0.6, wave1: WAVE1.TRI, wave2: WAVE2.SQUARE, range2: FEET[4], osc2: 0.4, fmode: FMODE.LP12, cutoff: 0.5, res: 0.15, envAmt: 0.25, fD: 0.4, fS: 0.35, aA: 0.02, aD: 0.55, aS: 0.45, aR: 0.5, chorus: 0.55, delay: 0.25, reverb: 0.4, duck: 0.25, chord: CHORD['7TH'] },
    prog: [6, 7, 4, 3],
  },
  {
    // Carre et pulse sur trois octaves, sec et robotique (Kraftwerk, Drexciya)
    name: 'ELECTRO',
    knobs: { rate: RATE['1/16'], mode: MODE.UP, range: RANGE[3], gate: 0.3, wave1: WAVE1.SQUARE, wave2: WAVE2.PULSE, range2: FEET[4], osc2: 0.5, fmode: FMODE.LP12, cutoff: 0.5, res: 0.3, envAmt: 0.4, fD: 0.22, fS: 0.15, aD: 0.25, aS: 0.3, aR: 0.18, chorus: 0, delay: 0.35, reverb: 0.2, duck: 0, chord: CHORD.BASIC },
    prog: [0, 3],
  },
  {
    // Un coup court et agressif : deux scies desaccordees, saturees, enveloppe seche
    name: 'EBM',
    knobs: { rate: RATE['1/8'], mode: MODE.UP, range: RANGE[1], notes: NOTES(2), gate: 0.3, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-12), fine2: cents(12), fmode: FMODE.MOOG, cutoff: 0.38, res: 0.3, envAmt: 0.6, fD: 0.15, fS: 0, fR: 0.12, aD: 0.2, aS: 0, aR: 0.12, dist: 0.45, chorus: 0, delay: 0.15, reverb: 0.3, duck: 0, chord: CHORD.BASIC },
    prog: [0, 1],
  },
  {
    // L'arpege brillant des annees 80 : deux scies desaccordees, beaucoup de chorus, delai
    name: 'ITALO',
    knobs: { volume: 0.72, rate: RATE['1/16'], mode: MODE.UPDN, range: RANGE[2], gate: 0.45, wave1: WAVE1.SAW, wave2: WAVE2.SAW, range2: FEET[8], fine1: cents(-14), fine2: cents(14), fmode: FMODE.LP12, cutoff: 0.62, res: 0.25, envAmt: 0.35, fD: 0.3, fS: 0.3, aD: 0.35, aS: 0.45, aR: 0.3, chorus: 0.65, delay: 0.35, reverb: 0.35, duck: 0, chord: CHORD.TRIAD },
    prog: [0, 1, 5, 2],
  },
];

export interface ArpFactory {
  knobs: Record<VoyKnobId, number>;
  seq: { edit: false; buf: number[]; len: number; has: false };
  prog: number[];
}

export function arpFactory(seqMax: number): { name: string; data: ArpFactory }[] {
  return ARP.map((g) => ({
    name: g.name,
    data: {
      knobs: Object.fromEntries(VOY_KNOB_IDS.map((id) => [id, g.knobs[id] ?? voyKnob(id).def])) as Record<VoyKnobId, number>,
      // AUTO : la suite que font les potards
      seq: { edit: false, buf: Array.from({ length: seqMax }, () => 0), len: 8, has: false },
      prog: [...g.prog],
    },
  }));
}

/* ---------------- MM-BASS ---------------- */

interface BassGenre {
  name: string;
  style: BassStyle;
  /** les potards du son et du generateur (0 a 1) */
  p: Partial<Record<BassKnobId, number>>;
  octave: -2 | -1 | 0;
  range: 1 | 2 | 3;
  scale: (typeof BASS_SCALES)[number];
  /** ARP : la tonique suit les accords du MM-ARP (le style change d'accord) ; F# : elle reste */
  root: 'ARP' | 'F#';
  /**
   * la ligne, seize pas : . un silence, - une liaison (la note d'avant
   * continue), sinon le degre de la gamme (0 la tonique, 2 la tierce, 4 la
   * quinte, 6 la septieme), suivi de + (une octave au-dessus), A (accent),
   * S (slide vers la note suivante)
   */
  line: string;
}

const BASS: readonly BassGenre[] = [
  // La 303 : doubles croches, accents a contretemps, slides, sauts d'octave
  { name: 'ACID', style: 'ACID', p: { cutoff: 0.26, reso: 0.82, envmod: 0.7, decay: 0.42, accent: 0.8, wave: 0, sub: 0.1, drive: 0.4, glide: 0.38, volume: 0.75, density: 0.75, slides: 0.45, accents: 0.45 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0A 0 0+S 0 . 0 3A 0+S 0 . 2A 0S 0+ 6 0A 4S' },
  // Le galop (x.xx) et l'octave sur la derniere double croche de chaque temps, une relance en fin de mesure
  { name: 'DARK DISCO', style: 'DARK DISCO', p: { cutoff: 0.34, reso: 0.42, envmod: 0.4, decay: 0.32, accent: 0.5, wave: 0.25, sub: 0.45, drive: 0.35, glide: 0.2, volume: 0.82, density: 0.6, slides: 0.1, accents: 0.3 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0A . 0 0+ 0 . 0 0+ 0A . 0 0+ 0 . 6 4' },
  // Des croches qui poussent, l'octave accentuee sur le "et", une relance tierce, quinte
  { name: 'INDIE DANCE', style: 'INDIE DANCE', p: { cutoff: 0.42, reso: 0.35, envmod: 0.45, decay: 0.3, accent: 0.55, wave: 0.55, sub: 0.4, drive: 0.45, glide: 0.25, volume: 0.71, density: 0.65, slides: 0.15, accents: 0.3 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0 . 0+A 0 0 . 0+A . 0 0 0+A . 0 2 0+A 4' },
  // Quatre notes rondes entre les kicks, la derniere sur la septieme ; une octave plus bas, sans sub
  { name: 'MINIMAL', style: 'MINIMAL', p: { cutoff: 0.24, reso: 0.45, envmod: 0.38, decay: 0.22, accent: 0.45, wave: 0.85, sub: 0, drive: 0.08, glide: 0.3, volume: 0.79, density: 0.35, slides: 0.05, accents: 0.2 }, octave: -1, range: 1, scale: 'MINOR', root: 'F#', line: '. . . 0 . . 0A . . . . 0 . . 6 .' },
  // Le roulement : la basse sur les trois doubles croches apres chaque kick (K B B B), une seule note
  { name: 'PSY PROG', style: 'PSY PROG', p: { cutoff: 0.3, reso: 0.35, envmod: 0.55, decay: 0.16, accent: 0.3, wave: 0, sub: 0, drive: 0.25, glide: 0.15, volume: 0.92, density: 0.85, slides: 0, accents: 0.15 }, octave: -1, range: 1, scale: 'MINOR', root: 'F#', line: '. 0 0 0 . 0 0 0 . 0 0 0 . 0 0 0' },
  // Sur le "et" de chaque temps, une double croche qui gronde derriere, la septieme pour relancer
  { name: 'TECHNO', style: 'TECHNO', p: { cutoff: 0.24, reso: 0.5, envmod: 0.4, decay: 0.25, accent: 0.5, wave: 0.25, sub: 0, drive: 0.55, glide: 0.15, volume: 0.88, density: 0.5, slides: 0.05, accents: 0.3 }, octave: -1, range: 1, scale: 'MINOR', root: 'F#', line: '. . 0A 0 . . 0A 0 . . 0A 0 . . 0A 6' },
  // La deep house : des notes tenues sur l'accord, l'octave, la quinte et la septieme pour tourner
  { name: 'HOUSE', style: 'HOUSE', p: { cutoff: 0.36, reso: 0.25, envmod: 0.25, decay: 0.5, accent: 0.35, wave: 0.8, sub: 0.5, drive: 0.12, glide: 0.4, volume: 0.79, density: 0.55, slides: 0.3, accents: 0.2 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '. . 0 - . 0 . 0+ . . 0 - . 4 . 6' },
  // La syncope du kick (1, le "et" de 2, le "et" de 3) et des sauts d'octave carres
  { name: 'ELECTRO', style: 'ELECTRO', p: { cutoff: 0.38, reso: 0.55, envmod: 0.5, decay: 0.28, accent: 0.6, wave: 1, sub: 0.35, drive: 0.3, glide: 0.2, volume: 0.65, density: 0.6, slides: 0.1, accents: 0.45 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0A . . 0+ . . 0 . . 0+ 0A . 2 . 0+ 6' },
  // Le sequenceur qui martele toutes les doubles croches, l'octave sur la troisieme, sature
  { name: 'EBM', style: 'EBM', p: { cutoff: 0.36, reso: 0.32, envmod: 0.55, decay: 0.17, accent: 0.55, wave: 0, sub: 0.3, drive: 0.65, glide: 0.1, volume: 0.78, density: 0.9, slides: 0, accents: 0.25 }, octave: 0, range: 1, scale: 'MINOR', root: 'ARP', line: '0A 0 0+ 0 0A 0 0+ 0 0A 0 0+ 0 0A 0 4 0+' },
  // L'octave qui rebondit en doubles croches (grave, aigue), sur les accords (I Feel Love)
  { name: 'ITALO', style: 'ITALO', p: { cutoff: 0.48, reso: 0.28, envmod: 0.38, decay: 0.28, accent: 0.4, wave: 0.4, sub: 0.3, drive: 0.2, glide: 0.15, volume: 0.92, density: 0.7, slides: 0.05, accents: 0.2 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0A 0+ 0 0+ 0 0+ 0 0+ 0A 0+ 0 0+ 0 0+ 0 0+' },
  // De longues notes de sub liees : la tonique, la quinte, la tierce qui glisse vers la tonique
  { name: 'DEEP SUB', style: 'SUB', p: { cutoff: 0.18, reso: 0.15, envmod: 0.12, decay: 0.7, accent: 0.2, wave: 1, sub: 0.85, drive: 0.05, glide: 0.5, volume: 0.69, density: 0.4, slides: 0.4, accents: 0.1 }, octave: 0, range: 1, scale: 'MINOR', root: 'F#', line: '0 - - - - - - . 4 - - - 2S 0 - -' },
];

/*
 * VOLUME de chaque ligne : sa crete environ 2 dB sous le kick du MM-RYTM
 * (mesure hors ligne de la ligne jouee ; vers -11 dBFS depuis le gain staging
 * du 2026-10-08, le kick vers -9 dBFS), DEEP SUB un peu plus bas
 * (un sinus tenu pese plus que sa crete).
 */

/** Une ligne ecrite (BassGenre.line) en seize pas. */
export function parseLine(line: string): BassStep[] {
  const out = line
    .trim()
    .split(/\s+/)
    .map((t): BassStep => {
      if (t === '.') return { kind: 'off', deg: 0, oct: 0, acc: false, slide: false };
      if (t === '-') return { kind: 'tie', deg: 0, oct: 0, acc: false, slide: false };
      const m = /^(\d+)(\+*)(A?)(S?)$/.exec(t);
      if (!m) throw new Error(`bass line: ${t}`);
      return { kind: 'note', deg: Number(m[1]), oct: m[2].length, acc: m[3] === 'A', slide: m[4] === 'S' };
    });
  if (out.length !== 16) throw new Error(`bass line: ${out.length} steps`);
  return out;
}

export interface BassFactory {
  params: Record<BassKnobId, number>;
  steps: BassStep[];
}

export function bassFactory(): { name: string; data: BassFactory }[] {
  return BASS.map((g) => {
    const params = Object.fromEntries(BASS_KNOBS.map((k) => [k.id, g.p[k.id] ?? k.def])) as Record<BassKnobId, number>;
    params.style = BASS_STYLES.indexOf(g.style) / (BASS_STYLES.length - 1);
    params.octave = (g.octave + 2) / 3;
    params.range = (g.range - 1) / 2;
    params.scale = BASS_SCALES.indexOf(g.scale) / (BASS_SCALES.length - 1);
    params.root = BASS_ROOTS.indexOf(g.root) / (BASS_ROOTS.length - 1);
    return { name: g.name, data: { params, steps: parseLine(g.line) } };
  });
}
