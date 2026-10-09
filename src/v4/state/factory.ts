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
 * qui tient), plus DEEP SUB pour la basse ; depuis le 2026-10-09 le MM-BASS
 * en a 35, chacun sa ligne (plus bas, la grosse liste). Tout est en fa diese
 * mineur, la tonalite du site : les kicks sont accordes sur F# (un demi-ton), la basse
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
import { BASS_KNOBS, BASS_POLS, BASS_ROOTS, BASS_SCALES, BASS_STYLES, attackOfMs, cutoffOf, decayOfTau, envOct, fineOf, glideOfMs, legacyOf, modeOf, polOf, rangeOf, resoOfEmph, semiOf, waveOf, type BassKnobId, type BassMode, type BassStyle } from '../bass/params';
import type { BassRecipe, BassStep } from '../bass/state';

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

/*
 * La grosse liste du MM-BASS (2026-10-09, Mika : "dans BASS on doit avoir une
 * bonne grosse liste de presets ! Fais-en au moins 30 avec des placements de
 * notes differents"). 35 presets, chacun sa ligne de seize pas ecrite a la
 * main : aucune ne pose ses notes, ses silences et ses liaisons aux memes
 * pas qu'une autre (verifie hors ligne : les masques note / silence /
 * liaison sont tous differents, et deux lignes different toujours d'au moins
 * trois attaques). Ranges par style pour que PREV / NEXT les parcoure d'un
 * style a l'autre, le meilleur d'abord, le monde de Mika en tete (dark disco,
 * indie dance, minimale hypnotique, psy prog), puis italo, EBM, electro,
 * acid, techno, house, sub. Le premier de chaque style porte le nom du style
 * (le meme preset sur le MM-RYTM et le MM-ARP : les trois ensemble font un
 * morceau qui tient) ; les autres ont leur nom, douze lettres au plus.
 *
 * Les onze d'avant restent (leur son, lui, passe au moteur MONARK le meme jour, plus bas : les patchs Moog) : EBM perd trois doubles croches
 * (xxx. au lieu de toutes : elle tombait sur la meme grille que ITALO), ACID
 * une (la septieme avant le dernier accent), TECHNO remonte de 2 dB (sa crete
 * etait a -13 dBFS, sous la regle).
 *
 * Les tonalites : fa diese mineur presque partout (les kicks y sont
 * accordes, le MM-ARP y joue) ; ARP sur les lignes qui tiennent sur la
 * tonique (elles suivent les accords) ; la couleur phrygienne la ou la ligne
 * joue la note qui change (le sol bequarre de CURSED KISS et STEEL BOOTS).
 * Une couleur de gamme sur une tonique fixe frotte contre les accords du
 * MM-ARP de son style (un accord par mesure ; 2026-10-09, la revue : le re
 * diese dorien de WAREHOUSE contre le re de Dmaj7 et de Bm, le mi diese
 * harmonique de COSMIC LOVE contre le mi de A et de E, le sol de CURSED KISS
 * contre le sol diese de E) : ces trois-la suivent les accords (ARP), en
 * mineur ou en phrygien, les deux seules gammes ou ARP tombe toujours sur la
 * racine de l'accord (en DORIAN, la racine re donnerait do diese ; en
 * HARMONIC, mi donnerait re). Quatre lignes sur une
 * autre tonique, toujours dans les notes de fa diese mineur (une pedale :
 * GHOST NOTES sur la, DEEP CUT sur do diese, DUB CHAMBER sur re, SUB PULSE
 * sur si ; leurs lignes n'y jouent que la tonique et la quinte).
 */

interface BassGenre {
  name: string;
  style: BassStyle;
  /** les potards du son et du generateur (0 a 1 ; les reglages fins par BU, en ms, en %, en pas) */
  p: Partial<Record<BassKnobId, number>>;
  octave: -2 | -1 | 0;
  range: 1 | 2 | 3;
  scale: (typeof BASS_SCALES)[number];
  /** ARP : la tonique suit les accords du MM-ARP (le style change d'accord) ; sinon elle reste (F#, ou une autre) */
  root: (typeof BASS_ROOTS)[number];
  /**
   * la ligne, seize pas (des espaces entre les temps pour la lire) : . un
   * silence, - une liaison (la note d'avant continue), sinon le degre de la
   * gamme (0 la tonique, 2 la tierce, 4 la quinte, 6 la septieme), suivi de
   * + (une octave au-dessus, ++ deux) ou _ (une octave en dessous :
   * 2026-10-09, la quinte grave sous la tonique), A (accent), S (slide vers
   * la note suivante, celle du pas 1 apres le pas 16)
   */
  line: string;
}

/** Les reglages fins en unites (bass/params.ts, les memes lois) : un preset se lit en ms, en %, en pas. */
const lawOf = (lo: number, hi: number, x: number): number => Math.round((Math.log(x / lo) / Math.log(hi / lo)) * 1000) / 1000;
/** Au millieme (un preset se lit, et ses valeurs retombent sur les crans du store). */
const r3 = (v: number): number => Math.round(v * 1000) / 1000;
const BU = {
  /** ATTACK et F.ATTACK, 0.5 ms a 1 s (2.5 ms : le depart d'avant ; l'echelle : le temps du plein, la meme loi) */
  atk: (ms: number): number => r3(attackOfMs(ms)),
  /** AMP DECAY vers SUSTAIN, 20 ms a 4 s */
  adec: (ms: number): number => lawOf(20, 4000, ms),
  /** RELEASE, 6 a 400 ms (14 ms : le depart) */
  rel: (ms: number): number => lawOf(6, 400, ms),
  /** ACC DECAY, 80 a 600 ms (200 ms : la 303) */
  accd: (ms: number): number => lawOf(80, 600, ms),
  /** LENGTH, 10 a 100 % du pas (absent : AUTO, la longueur du style) */
  len: (pct: number): number => Math.round(((pct - 10) / 90) * 1000) / 1000,
  /** PW, 50 a 95 % */
  pw: (pct: number): number => Math.round(((pct - 50) / 45) * 1000) / 1000,
  /** DLY FB, 0 a 90 % */
  fb: (pct: number): number => Math.round((pct / 90) * 1000) / 1000,
  /** REV SIZE (RT60), 0.3 a 8 s */
  rsize: (s: number): number => lawOf(0.3, 8, s),
  /** REV TONE, 800 Hz a 12 kHz */
  rtone: (hz: number): number => lawOf(800, 12000, hz),
  /** DLY TIME, en pas du tempo */
  dt: { '1/16': 0, '1/8': 0.2, '3/16': 0.4, '1/4': 0.6, '3/8': 0.8, '1/2': 1 },
  /* Le moteur MONARK (2026-10-09) : les lois de bass/params.ts, en unites reelles (le chantier des presets les ecrit) */
  /** CUTOFF en Hz (60 Hz a 6 kHz) */
  cut: (hz: number): number => r3(cutoffOf(hz)),
  /** RESO par l'emphase de l'echelle (0 a 1 ; k = 4.3 EMPH) */
  emph: (e: number): number => r3(resoOfEmph(e)),
  /** ENV MOD en octaves (son signe : POLARITY), par la loi de bass/params.ts (envOct, lineaire : son plein en 1) */
  env: (oct: number): number => r3(Math.abs(oct) / envOct(1)),
  /** DECAY de l'echelle, sa constante de temps en ms (10 ms a 2.5 s) */
  tau: (ms: number): number => r3(decayOfTau(ms, 'LP24')),
  /** GLIDE en ms (par octave sur l'echelle) */
  glide: (ms: number): number => r3(glideOfMs(ms)),
  /** la forme d'OSC 2 ou OSC 3 par son nom (TRI SHARK SAW SQR WIDE NARROW, REV SAW pour OSC 3) */
  wave: (name: string): number => r3(waveOf(name)),
  /** RANGE en pieds (32' 16' 8' 4') ; un cran exact, pas arrondi au millieme (le store pose 1/3, pas 0.333 : le preset
   * charge serait sinon a 3e-4 de ses donnees, 2026-10-09, le chantier des presets) */
  range: (ft: string): number => rangeOf(ft),
  /** SEMI en demi-tons (-7 a +7), un cran exact lui aussi */
  semi: (st: number): number => semiOf(st),
  /** FINE en cents (-50 a +50) */
  fine: (ct: number): number => r3(fineOf(ct)),
  /** MODE par son nom (LP24 LP12 LP6 BP 303) */
  mode: (name: BassMode): number => r3(modeOf(name)),
  /** POLARITY par son nom (POS NEG) */
  pol: (name: (typeof BASS_POLS)[number]): number => polOf(name),
} as const;

/*
 * Les patchs Moog des presets (2026-10-09, Mika : "je veux vraiment un son a la MONARK de Native Instruments !
 * BASS doit etre vraiment bon ! et les presets vraiment excellents !") : treize recettes de Model D (sound.md
 * section 8), en unites reelles par BU ; chaque preset MONARK part d'une d'elles et y pose ses ecarts. Les regles :
 * la resonance basse (la brillance vient du contour et d'un cutoff bas), le gras par LOAD (DRIVE) et les trois
 * niveaux du melangeur (pas par SUB), le desaccord seulement entre OSC 1 et OSC 2, OSC 3 a 32' pour le poids,
 * l'ampli plus long que le contour du filtre, KEY TRK a 1/3 sur les lignes qui sautent d'octave. DECAY, AMP DECAY et
 * RELEASE sont des constantes de temps (un temps a -40 dB du Model D de T ms : T / 4.6). Ce que la recette ne dit
 * pas : F.ATTACK 0.5 ms (0), POLARITY POS, SEMI 0, SUB OCT -1, TUNE 0, ACC DECAY 200 ms ; un oscillateur coupe :
 * son niveau a 0. Le grave le plus bas d'un preset ne descend jamais sous 30 Hz (OSC 3 a 32' avec OCTAVE -1 y
 * passerait : ces presets-la mettent leur oscillateur grave a 16').
 */
type Patch = Partial<Record<BassKnobId, number>>;
const MOOG_BASE: Patch = {
  fmode: BU.mode('LP24'),
  wave: 0,
  pw: 0,
  o2wave: BU.wave('SAW'),
  o2range: BU.range("16'"),
  o2semi: BU.semi(0),
  o2fine: BU.fine(0),
  o3wave: BU.wave('SQR'),
  o3range: BU.range("32'"),
  o3semi: BU.semi(0),
  o3fine: BU.fine(0),
  noise: 0,
  feedback: 0,
  fattack: 0,
  fpol: BU.pol('POS'),
  accdecay: BU.accd(200),
  sub: 0,
  suboct: 0,
  tune: 0.5,
};
/** OSC 1 en carre (WAVE 1, PW 0 : 50 %), ou en impulsion large (PW 70 %). */
const O1_SQR: Patch = { wave: 1, pw: 0 };
const O1_WIDE: Patch = { wave: 1, pw: BU.pw(70) };
const PATCH = {
  /** MM CLASSIC, la basse Moog d'ecole (le patch de depart, les defs de bass/params.ts) : deux scies a 5 cents, le carre a 32' */
  CLASSIC: { ...MOOG_BASE, o1lvl: 0.9, o2fine: BU.fine(5), o2lvl: 0.8, o3fine: BU.fine(-3), o3lvl: 0.6, drive: 0.55, cutoff: BU.cut(140), reso: BU.emph(0.2), envmod: BU.env(2.6), decay: BU.tau(56.5), fsustain: 0.15, keytrack: 0.33, attack: BU.atk(1), adecay: BU.adec(130.4), sustain: 0.85, release: BU.rel(20), accent: 0.5, sweep: 0.15, glide: BU.glide(39.1), drift: 0.4 },
  /** NIGHT BASS : scie, carre a -7 cents, scie a 32', plus de LOAD et de contour, l'ampli qui retombe (le galop) */
  NIGHT: { ...MOOG_BASE, o1lvl: 0.8, o2wave: BU.wave('SQR'), o2fine: BU.fine(-7), o2lvl: 0.6, o3wave: BU.wave('SAW'), o3lvl: 0.5, drive: 0.65, cutoff: BU.cut(110), reso: BU.emph(0.3), envmod: BU.env(3), decay: BU.tau(39), fsustain: 0.1, keytrack: 0.33, attack: BU.atk(1), adecay: BU.adec(76), sustain: 0.6, release: BU.rel(20), accent: 0.6, sweep: 0.2, glide: BU.glide(39), drift: 0.4 },
  /** PUNK FUNK : deux scies a 12 cents (large), LOAD haut, FEEDBACK chaud, un souffle pour l'attaque du mediator */
  PUNK: { ...MOOG_BASE, o1lvl: 0.9, o2fine: BU.fine(12), o2lvl: 0.8, o3lvl: 0, noise: 0.05, drive: 0.8, feedback: 0.35, cutoff: BU.cut(300), reso: BU.emph(0.15), envmod: BU.env(2.2), decay: BU.tau(30), fsustain: 0.2, keytrack: 0.67, attack: BU.atk(1), adecay: BU.adec(54), sustain: 0.5, release: BU.rel(18), accent: 0.6, sweep: 0.2, glide: BU.glide(39), drift: 0.4 },
  /** BLOOP : le triangle rond, un peu de carre, un contour court et ample, KEY TRK plein (la minimale) */
  BLOOP: { ...MOOG_BASE, ...O1_SQR, o1lvl: 0.3, o2wave: BU.wave('TRI'), o2lvl: 1, o3lvl: 0, drive: 0.3, cutoff: BU.cut(90), reso: BU.emph(0.45), envmod: BU.env(3.5), decay: BU.tau(20), fsustain: 0, keytrack: 1, attack: BU.atk(1), adecay: BU.adec(43), sustain: 0.3, release: BU.rel(25), accent: 0.5, sweep: 0.1, glide: BU.glide(39), drift: 0.3 },
  /** MUNICH : deux scies a l'octave (16' et 8', Moroder), le filtre plus haut, des notes courtes */
  MUNICH: { ...MOOG_BASE, o1lvl: 0.9, o2range: BU.range("8'"), o2lvl: 0.5, o3lvl: 0, drive: 0.45, cutoff: BU.cut(400), reso: BU.emph(0.2), envmod: BU.env(2), decay: BU.tau(26), fsustain: 0.2, keytrack: 0.67, attack: BU.atk(1), adecay: BU.adec(39), sustain: 0.4, release: BU.rel(15), accent: 0.45, sweep: 0.1, glide: BU.glide(30), drift: 0.3 },
  /** BODY : deux scies a -9 cents, le carre a 32', LOAD presque au bout, FEEDBACK qui gratte, tout court (l'EBM) */
  BODY: { ...MOOG_BASE, o1lvl: 0.9, o2fine: BU.fine(-9), o2lvl: 0.8, o3lvl: 0.6, drive: 0.9, feedback: 0.25, cutoff: BU.cut(180), reso: BU.emph(0.25), envmod: BU.env(2.8), decay: BU.tau(24), fsustain: 0, keytrack: 0.33, attack: BU.atk(0.5), adecay: BU.adec(30), sustain: 0.6, release: BU.rel(10), accent: 0.6, sweep: 0.2, glide: BU.glide(25), drift: 0 },
  /** MOOG ACID : une scie seule, l'emphase haute, l'accent qui pousse (l'acid sur un Moog, pas une 303) */
  ACID: { ...MOOG_BASE, o1lvl: 1, o2lvl: 0, o3lvl: 0, drive: 0.4, cutoff: BU.cut(220), reso: BU.emph(0.85), envmod: BU.env(3.2), decay: BU.tau(65), fsustain: 0, keytrack: 0.33, attack: BU.atk(1), adecay: BU.adec(130), sustain: 0.9, release: BU.rel(20), accent: 0.8, sweep: 0.4, glide: BU.glide(60), drift: 0.3 },
  /** DEEP SUB : le triangle et une scie douce a 32', le filtre presque ferme, l'ampli plein, un glide lent */
  SUB: { ...MOOG_BASE, o1lvl: 0, o2wave: BU.wave('TRI'), o2lvl: 1, o3wave: BU.wave('SAW'), o3lvl: 0.35, drive: 0.25, cutoff: BU.cut(70), reso: BU.emph(0), envmod: BU.env(1.2), decay: BU.tau(87), fsustain: 0.3, keytrack: 0.33, attack: BU.atk(3), adecay: BU.adec(435), sustain: 1, release: BU.rel(60), accent: 0.2, sweep: 0, glide: BU.glide(150), drift: 0.1, sub: 0.3 },
  /** SHARK : la forme mi triangle mi scie, un triangle a +4 cents, une pointe de SUB : chaud (la house, le velours) */
  SHARK: { ...MOOG_BASE, o1lvl: 0.4, o2wave: BU.wave('SHARK'), o2lvl: 0.9, o3wave: BU.wave('TRI'), o3range: BU.range("16'"), o3fine: BU.fine(4), o3lvl: 0.5, drive: 0.6, cutoff: BU.cut(200), reso: BU.emph(0.35), envmod: BU.env(2.2), decay: BU.tau(43), fsustain: 0.2, keytrack: 0.33, attack: BU.atk(2), adecay: BU.adec(87), sustain: 0.7, release: BU.rel(30), accent: 0.4, sweep: 0.15, glide: BU.glide(60), drift: 0.5, sub: 0.15 },
  /** HOLLOW : le carre creux et une impulsion etroite a 8', le filtre ouvert (la new wave, l'electro) */
  HOLLOW: { ...MOOG_BASE, ...O1_SQR, o1lvl: 0.9, o2wave: BU.wave('NARROW'), o2range: BU.range("8'"), o2lvl: 0.5, o3lvl: 0, drive: 0.5, cutoff: BU.cut(350), reso: BU.emph(0.3), envmod: BU.env(1.8), decay: BU.tau(35), fsustain: 0.25, keytrack: 0.67, attack: BU.atk(1), adecay: BU.adec(65), sustain: 0.6, release: BU.rel(20), accent: 0.5, sweep: 0.15, glide: BU.glide(39), drift: 0.3 },
  /** SWELL : deux scies a 6 cents, le filtre haut et le contour NEG (il se creuse, puis revient : le pincement a l'envers) */
  SWELL: { ...MOOG_BASE, o1lvl: 0.9, o2fine: BU.fine(6), o2lvl: 0.7, o3lvl: 0, drive: 0.5, cutoff: BU.cut(1200), reso: BU.emph(0.3), envmod: BU.env(2), fpol: BU.pol('NEG'), decay: BU.tau(54), fsustain: 0, keytrack: 0.33, attack: BU.atk(1), adecay: BU.adec(87), sustain: 0.7, release: BU.rel(30), accent: 0.4, sweep: 0, glide: BU.glide(39), drift: 0.4 },
  /** GROWL : scie et carre a 32', LOAD et FEEDBACK hauts, un souffle (le grondement techno) */
  GROWL: { ...MOOG_BASE, o1lvl: 0.9, o2wave: BU.wave('SQR'), o2range: BU.range("32'"), o2lvl: 0.7, o3lvl: 0, noise: 0.08, drive: 0.8, feedback: 0.6, cutoff: BU.cut(160), reso: BU.emph(0.2), envmod: BU.env(2.4), decay: BU.tau(33), fsustain: 0.1, keytrack: 0.33, attack: BU.atk(1), adecay: BU.adec(65), sustain: 0.7, release: BU.rel(20), accent: 0.6, sweep: 0.2, glide: BU.glide(39), drift: 0.2 },
  /** PING : les oscillateurs presque fermes, l'echelle au bord de l'auto-oscillation : chaque note fait sonner le filtre */
  PING: { ...MOOG_BASE, o1lvl: 0.1, o2wave: BU.wave('TRI'), o2lvl: 0.1, o3lvl: 0, drive: 0.2, cutoff: BU.cut(92), reso: BU.emph(0.9), envmod: BU.env(1.5), decay: BU.tau(17), fsustain: 0, keytrack: 1, attack: BU.atk(0.5), adecay: BU.adec(26), sustain: 0, release: BU.rel(20), accent: 0.6, sweep: 0, glide: BU.glide(39), drift: 0.2 },
} as const;

const BASS: readonly BassGenre[] = [
  /* ---- DARK DISCO (118 BPM) : le disco lent et lourd, entre italo, new wave et EBM ---- */
  // Le galop (x.xx) et l'octave sur la derniere double croche de chaque temps, une relance en fin de mesure.
  // MM CLASSIC tel quel : le son de depart de la machine (une premiere visite sonne comme A01)
  { name: 'DARK DISCO', style: 'DARK DISCO', p: { ...PATCH.CLASSIC, volume: 0.78, density: 0.6, slides: 0.1, accents: 0.3 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0A . 0 0+  0 . 0 0+  0A . 0 0+  0 . 6 4' },
  // La basse qui pompe entre les kicks (le "et"), l'octave apres le deuxieme, et une montee quinte grave, sixte,
  // septieme sur le dernier temps qui ramene la tonique. NIGHT BASS : scie, carre, scie a 32', LOAD pousse, un echo
  // court ; l'ampli tenu (SUSTAIN 0.85, RELEASE 90 ms) : six notes seulement, elles gardent le poids du style
  { name: 'NIGHT DRIVE', style: 'DARK DISCO', p: { ...PATCH.NIGHT, adecay: BU.adec(120), sustain: 0.85, accent: 0.5, drive: 0.7, release: BU.rel(90), delay: 0.08, dtime: BU.dt['1/8'], dfb: BU.fb(25), volume: 0.873, density: 0.55, slides: 0.15, accents: 0.35 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '. . 0 .  . . 0A 0+  . . 0 .  . 4_ 5_S 6_' },
  // Des notes tenues qui se lient et glissent : la tonique longue, l'octave, la tierce sur le "et", la quinte et
  // la quarte qui glisse vers le temps suivant. SHARK en velours : une attaque douce, un glide plus lent, DRIFT haut,
  // un contour faible et lent (F.ATTACK 8 ms, DECAY 120 ms) : un preset tenu, sans pincement
  { name: 'VELVET DISCO', style: 'DARK DISCO', p: { ...PATCH.SHARK, envmod: BU.env(1.1), decay: BU.tau(120), fsustain: 0.35, fattack: BU.atk(8), glide: BU.glide(77), attack: BU.atk(4), release: BU.rel(60), keytrack: 0.3, drift: 0.6, reverb: 0.06, rsize: BU.rsize(1.6), volume: 1.0, density: 0.45, slides: 0.35, accents: 0.15 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0 - - 0+  . 0 2 -  - 0 - 0+  . 4 - 3S' },
  // La menace phrygienne : la seconde mineure (sol) qui frotte contre la tonique, l'octave a contretemps, la
  // quinte grave et le sol qui redescend en glissant sur le temps. ARP (2026-10-09, la revue : en fa diese fixe, le sol
  // frottait contre le sol diese de l'accord de mi) : la ligne suit les accords, le sol ne sonne que sur fa diese.
  // MOOG ACID adouci : une seconde scie a +7 cents, l'emphase a mi-course, LOAD haut, des accents qui mordent
  { name: 'CURSED KISS', style: 'DARK DISCO', p: { ...PATCH.ACID, o2fine: BU.fine(7), o2lvl: 0.4, reso: BU.emph(0.55), drive: 0.7, accent: 0.75, sweep: 0.6, accdecay: BU.accd(160), keytrack: 0.15, volume: 0.708, density: 0.6, slides: 0.2, accents: 0.45 }, octave: 0, range: 2, scale: 'PHRYGIAN', root: 'ARP', line: '0A . 1 0  . 0 0+ .  0A . 1 0  . 0+ 4_ 1S' },
  // La cadence andalouse qui descend, un accord par temps (fa diese, mi, re, do diese) : le grave sur le temps,
  // l'octave sur sa derniere double croche. HOLLOW : le carre creux et l'impulsion a 8', un echo pointe
  { name: 'DESCENT', style: 'DARK DISCO', p: { ...PATCH.HOLLOW, keytrack: 0.35, delay: 0.1, dtime: BU.dt['3/16'], dfb: BU.fb(30), volume: 0.81, density: 0.55, slides: 0.1, accents: 0.35 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0A . . 0+  6_A . . 6  5_A . . 5  4_A . 4 4_' },
  // Elle esquive le premier temps : "e" et "et" en octave, l'accent sur les temps 2 et 4, la septieme et la quinte
  // graves pour finir. SWELL : le contour NEG creuse chaque note, l'ampli pince, l'accent plus fort (le NEG l'assombrit).
  // Sans l'impulsion large du cahier sur OSC 1 : a PW 70 % elle porte du continu (bass.worklet.js ne le retire que sur
  // OSC 2 et OSC 3), des coups sous 25 Hz a chaque note
  { name: 'BLACK SATIN', style: 'DARK DISCO', p: { ...PATCH.SWELL, accent: 0.7, adecay: BU.adec(54), sustain: 0.55, release: BU.rel(30), volume: 0.947, density: 0.55, slides: 0.15, accents: 0.4 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '. 0 0+ .  0A . . 0  . 0 0+ .  0A . 6_ 4_' },

  /* ---- INDIE DANCE (122 BPM) : l'energie rock et new wave sur une grille club ---- */
  // Des croches qui poussent, l'octave accentuee sur le "et", une relance tierce, quinte. PUNK FUNK : large et sale
  // (LOAD 0.6, SUSTAIN 0.4 : le niveau des autres du style)
  { name: 'INDIE DANCE', style: 'INDIE DANCE', p: { ...PATCH.PUNK, drive: 0.6, sustain: 0.4, volume: 0.743, density: 0.65, slides: 0.15, accents: 0.3 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0 . 0+A 0  0 . 0+A .  0 0 0+A .  0 2 0+A 4' },
  // Le tresillo du nu disco (3 + 3 + 2 par demi-mesure) : la tonique, l'octave sur la derniere double croche, la
  // septieme grave qui relance. MUNICH : les scies a l'octave, des notes un peu plus longues, un echo en croches,
  // l'ampli de l'indie (65 ms vers 0.5)
  { name: 'NEON HEART', style: 'INDIE DANCE', p: { ...PATCH.MUNICH, adecay: BU.adec(65), sustain: 0.5, drive: 0.55, length: BU.len(60), delay: 0.06, dtime: BU.dt['1/8'], dfb: BU.fb(20), volume: 0.863, density: 0.5, slides: 0.1, accents: 0.3 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0A . . 0+  . . 0 .  0A . . 0+  . . 6_ 0' },
  // Le disco punk : des doubles croches funk, l'octave sur le "e" du deuxieme temps, la tierce sur le "et" du
  // troisieme, la quinte puis la quarte qui glisse vers le premier temps ; les accents sur les temps 1 et 4.
  // GROWL plus propre : FEEDBACK 0.3, LOAD 0.65 (l'accent passe encore la saturation ; celui du premier temps est la
  // cible du slide du pas 16, sans nouvelle attaque), un souffle pour le mediator, l'ampli tenu
  { name: 'DISCO PUNK', style: 'INDIE DANCE', p: { ...PATCH.GROWL, feedback: 0.3, drive: 0.65, accent: 0.9, adecay: BU.adec(90), sustain: 0.85, noise: 0.06, release: BU.rel(40), keytrack: 0.25, volume: 0.732, density: 0.55, slides: 0.2, accents: 0.35 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0A . . 0  . 0+ . 0  . . 2 .  0+A . 4 3S' },
  // Le slow burn : quatre notes longues qui chantent (tonique, octave, quinte, quarte), la tierce qui glisse vers
  // la tonique. DEEP SUB qui s'ouvre un peu : une attaque douce, un glide lent, DRIFT haut, delai et reverbe
  { name: 'SLOW BURN', style: 'INDIE DANCE', p: { ...PATCH.SUB, cutoff: BU.cut(90), reso: BU.emph(0.15), glide: BU.glide(130), attack: BU.atk(12), release: BU.rel(90), drift: 0.6, delay: 0.07, dtime: BU.dt['3/8'], dfb: BU.fb(35), reverb: 0.1, rsize: BU.rsize(2.5), rtone: BU.rtone(3000), volume: 0.896, density: 0.35, slides: 0.4, accents: 0.1 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0 - - -  . . 0+ -  4 - - .  3 - 2S 0' },
  // La synth pop : deux doubles croches et un trou (grave, octave, rien, grave), sur la tonique, la tierce, la
  // quinte. HOLLOW en LP12 (le bourdonnement), court, un echo en croches ; l'ampli qui retombe vite (35 ms vers 0.15) :
  // la ligne la plus dense du style ne sonne pas plus fort que les autres
  { name: 'NEW ROMANCE', style: 'INDIE DANCE', p: { ...PATCH.HOLLOW, fmode: BU.mode('LP12'), envmod: BU.env(2.2), adecay: BU.adec(35), sustain: 0.15, drive: 0.35, keytrack: 0.35, length: BU.len(40), delay: 0.07, dtime: BU.dt['1/8'], dfb: BU.fb(20), volume: 0.941, density: 0.8, slides: 0.05, accents: 0.2 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0 0+ . 0  0 0+ . 0  2 2+ . 2  4 4+ . 3' },

  /* ---- MINIMAL (125 BPM, swing lourd) : la minimale hypnotique, presque rien sur les temps ---- */
  // Quatre notes rondes entre les kicks, la derniere sur la septieme ; une octave plus bas. BLOOP, le filtre a 120 Hz
  // (KEY TRK plein : une octave plus bas, a 90 Hz il se refermait sur la fondamentale), un RELEASE de 70 ms qui arrondit
  { name: 'MINIMAL', style: 'MINIMAL', p: { ...PATCH.BLOOP, cutoff: BU.cut(120), accent: 0.6, attack: BU.atk(3), adecay: BU.adec(50), release: BU.rel(70), volume: 0.946, density: 0.35, slides: 0.05, accents: 0.2 }, octave: -1, range: 1, scale: 'MINOR', root: 'F#', line: '. . . 0  . . 0A .  . . . 0  . . 6 .' },
  // Une seule note, sur les "e" (le swing les retarde) et un "a" : deux accents, le reste en notes fantomes (ACCENT
  // tres haut : sans accent, la note est loin dessous) ; une pedale de la sous le kick, l'espace dans le delai. BLOOP
  // plus pointu que MINIMAL : plus de carre, d'emphase et de contour (+4 oct, 15 ms)
  { name: 'GHOST NOTES', style: 'MINIMAL', p: { ...PATCH.BLOOP, o1lvl: 0.6, reso: BU.emph(0.55), envmod: BU.env(4), decay: BU.tau(15), cutoff: BU.cut(120), drive: 0.4, adecay: BU.adec(50), release: BU.rel(70), accent: 0.95, accdecay: BU.accd(260), sweep: 0.3, length: BU.len(30), delay: 0.12, dtime: BU.dt['3/16'], dfb: BU.fb(40), volume: 0.733, density: 0.3, slides: 0.05, accents: 0.3 }, octave: -1, range: 1, scale: 'MINOR', root: 'A', line: '. 0 . .  . 0A . 0  . 0 . .  . 0A . .' },
  // Trois contre quatre : une note tous les trois pas (2, 5, 8, 11, 14), la figure tourne contre la mesure ; l'echo
  // en 3/16 la redouble, une octave pour finir. BLOOP et un petit carre a 8' qui pique, des accents qui balaient le
  // filtre (SWEEP), une longue chute (RELEASE 150 ms)
  { name: 'THREE STEP', style: 'MINIMAL', p: { ...PATCH.BLOOP, o3range: BU.range("8'"), o3lvl: 0.2, cutoff: BU.cut(120), drive: 0.4, keytrack: 0.67, accent: 0.9, sweep: 0.3, attack: BU.atk(3), adecay: BU.adec(50), release: BU.rel(150), length: BU.len(35), delay: 0.1, dtime: BU.dt['3/16'], dfb: BU.fb(35), volume: 0.819, density: 0.4, slides: 0.05, accents: 0.25 }, octave: -1, range: 2, scale: 'MINOR', root: 'F#', line: '. 0 . .  0 . . 0A  . . 0 .  . 0+ . .' },
  // Profonde : deux notes tenues sur le "a" du premier temps et le "et" du troisieme, la quinte grave qui remonte
  // en glissant ; une pedale de do diese (la quinte de la tonalite). DEEP SUB creuse : OSC 1 en carre plein, le
  // triangle, la scie a 16' a +4 cents (deux formes a l'unisson exact s'annulent), sans SUB (la quinte grave est un sol
  // diese a 52 Hz : a 32' ou en SUB elle passerait sous 30 Hz), le filtre a 120 Hz, VOLUME au bout
  { name: 'DEEP CUT', style: 'MINIMAL', p: { ...PATCH.SUB, ...O1_SQR, o1lvl: 1, o3range: BU.range("16'"), o3fine: BU.fine(4), o3lvl: 0.5, sub: 0, cutoff: BU.cut(120), drive: 0.6, envmod: BU.env(1), fattack: BU.atk(10), attack: BU.atk(1), adecay: BU.adec(100), sustain: 0.3, glide: BU.glide(120), release: BU.rel(50), reverb: 0.05, rsize: BU.rsize(1.2), volume: 1.0, density: 0.3, slides: 0.25, accents: 0.15 }, octave: 0, range: 1, scale: 'MINOR', root: 'C#', line: '. . . 0  - . . .  . . 0 -  . . 4_S 0' },
  // Des bips courts et haut perches (l'octave sur le "et", un accent sur un "e", la tierce au bout). PING : l'echelle
  // sous l'auto-oscillation (EMPH 0.88) que chaque note fait sonner, le carre et le triangle pleins, un contour ample
  // (+3 oct) pour le bip, l'ampli assez long pour que l'anneau monte, beaucoup d'echo
  { name: 'MICRO BLEEP', style: 'MINIMAL', p: { ...PATCH.PING, ...O1_SQR, o1lvl: 1, o2lvl: 1, reso: BU.emph(0.88), drive: 0.4, envmod: BU.env(3), decay: BU.tau(20), adecay: BU.adec(160), sustain: 0.2, release: BU.rel(80), accent: 0.35, length: BU.len(25), delay: 0.14, dtime: BU.dt['1/8'], dfb: BU.fb(45), volume: 0.749, density: 0.35, slides: 0.05, accents: 0.3 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '. . 0+ .  . 0 . .  . 0+A . 0  . . . 2' },

  /* ---- PSY PROG (138 BPM) : la psytrance progressive, le kick seul sur le temps ---- */
  // Le roulement : la basse sur les trois doubles croches apres chaque kick (K B B B), une seule note. BODY serre :
  // les deux scies a -9 cents seules (OCTAVE -1 : le carre a 32' descendrait a 23 Hz, a 16' il annulait la fondamentale
  // des scies), un contour tres court, l'ampli court (60 ms vers 0.3), sans FEEDBACK ni DRIFT (la machine droite)
  { name: 'PSY PROG', style: 'PSY PROG', p: { ...PATCH.BODY, o1lvl: 1, o2lvl: 1, o3lvl: 0, cutoff: BU.cut(220), envmod: BU.env(3), decay: BU.tau(15), adecay: BU.adec(60), sustain: 0.3, release: BU.rel(15), feedback: 0, drive: 0.8, drift: 0, volume: 0.997, density: 0.85, slides: 0, accents: 0.15 }, octave: -1, range: 1, scale: 'MINOR', root: 'F#', line: '. 0 0 0  . 0 0 0  . 0 0 0  . 0 0 0' },
  // Le galop (K B B .) : deux doubles croches apres le kick, la derniere libre ; l'octave et la septieme pour
  // finir la mesure. Le BODY serre de PSY PROG, le contour un peu plus long, l'accent plus bref
  { name: 'MOON GALLOP', style: 'PSY PROG', p: { ...PATCH.BODY, o1lvl: 1, o2lvl: 1, o3lvl: 0, cutoff: BU.cut(220), envmod: BU.env(3), decay: BU.tau(18), accdecay: BU.accd(120), adecay: BU.adec(60), sustain: 0.3, release: BU.rel(15), feedback: 0, drive: 0.8, drift: 0, volume: 0.959, density: 0.75, slides: 0, accents: 0.15 }, octave: -1, range: 2, scale: 'MINOR', root: 'F#', line: '. 0 0 .  . 0 0 .  . 0 0 .  . 0+ 6 .' },

  /* ---- ITALO (120 BPM) : l'italo disco, Moroder, Kano, les boites des annees 80 ---- */
  // L'octave qui rebondit en doubles croches (grave, aigue), sur les accords. MUNICH
  { name: 'ITALO', style: 'ITALO', p: { ...PATCH.MUNICH, volume: 0.904, density: 0.7, slides: 0.05, accents: 0.2 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0A 0+ 0 0+  0 0+ 0 0+  0A 0+ 0 0+  0 0+ 0 0+' },
  // Munich, 1977 : des croches (grave, octave) que l'echo en double croche fait galoper ; fa diese deux temps, puis
  // re et mi graves, un accent au debut de chaque moitie. MUNICH, court, l'ampli un peu tenu, l'echo fort
  { name: 'MUNICH 77', style: 'ITALO', p: { ...PATCH.MUNICH, adecay: BU.adec(50), sustain: 0.6, length: BU.len(40), delay: 0.32, dtime: BU.dt['1/16'], dfb: BU.fb(18), volume: 0.88, density: 0.7, slides: 0.05, accents: 0.2 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0A . 0+ .  0 . 0+ .  5_A . 5 .  6_ . 6 .' },
  // L'octave en croches, poussee par une double croche aux temps 2 et 4 ; la note sous la tonique qui y remonte,
  // sur chaque accord (ARP : 2026-10-09, la revue : le mi diese de la gamme harmonique, en fa diese fixe, frottait
  // contre le mi des accords de la et de mi). MUNICH en LP12 (brillant), KEY TRK 0.45, echo et reverbe. Sans
  // l'impulsion large a 8' du cahier : sa fondamentale (l'octave) passait devant celle de la note, sur toutes
  { name: 'COSMIC LOVE', style: 'ITALO', p: { ...PATCH.MUNICH, fmode: BU.mode('LP12'), keytrack: 0.45, delay: 0.06, dtime: BU.dt['1/8'], dfb: BU.fb(20), reverb: 0.08, rsize: BU.rsize(1.8), volume: 0.985, density: 0.75, slides: 0.05, accents: 0.2 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0 . 0+ .  0 0+ . 0  0 . 0+ .  0 0+ . 6_' },

  /* ---- EBM (124 BPM) : l'Electronic Body Music, carre et martial, aucun swing ---- */
  // Le sequenceur qui martele : trois doubles croches et un trou par temps, l'octave sur la troisieme. BODY
  { name: 'EBM', style: 'EBM', p: { ...PATCH.BODY, volume: 0.926, density: 0.9, slides: 0, accents: 0.25 }, octave: 0, range: 1, scale: 'MINOR', root: 'ARP', line: '0A 0 0+ .  0A 0 0+ .  0A 0 0+ .  0A 0 4 0+' },
  // Des paires de doubles croches en 3 + 3 + 2 (xx. xx. xx), l'accent qui se deplace. BODY au carre, plus sec
  { name: 'BODY MUSIC', style: 'EBM', p: { ...PATCH.BODY, ...O1_SQR, release: BU.rel(10), volume: 0.895, density: 0.85, slides: 0, accents: 0.3 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0A 0 . 0+  0 . 0A 0  0+ 0 . 0A  0 . 0+ 0' },
  // La marche : chaque temps accentue, une double croche qui le pousse, la seconde phrygienne (sol) qui grince.
  // GROWL : LOAD et FEEDBACK hauts, le carre a 32' a mi-niveau, des accents qui balaient le filtre, un souffle, une
  // piece courte
  { name: 'STEEL BOOTS', style: 'EBM', p: { ...PATCH.GROWL, o2lvl: 0.5, accent: 0.8, sweep: 0.45, accdecay: BU.accd(140), noise: 0.08, reverb: 0.05, rsize: BU.rsize(0.8), volume: 0.8, density: 0.7, slides: 0, accents: 0.4 }, octave: 0, range: 1, scale: 'PHRYGIAN', root: 'F#', line: '0A . . 0  0A . 1 .  0A . . 0  0A 1 0 .' },

  /* ---- ELECTRO (128 BPM) : Detroit, d'apres Kraftwerk ---- */
  // La syncope du kick (1, le "et" de 2, le "et" de 3) et des sauts d'octave carres. HOLLOW en LP12, plus d'emphase
  { name: 'ELECTRO', style: 'ELECTRO', p: { ...PATCH.HOLLOW, fmode: BU.mode('LP12'), reso: BU.emph(0.45), accent: 0.6, volume: 0.87, density: 0.6, slides: 0.1, accents: 0.45 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0A . . 0+  . . 0 .  . 0+ 0A .  2 . 0+ 6' },
  // Sous la mer : des notes graves tenues par-dessus les temps (liaisons), l'octave sur le 2 et le "e" du 4, la
  // quinte au bout. SWELL : le contour NEG, un echo et une reverbe sombres
  { name: 'DEEP SEA', style: 'ELECTRO', p: { ...PATCH.SWELL, keytrack: 0.3, delay: 0.08, dtime: BU.dt['3/16'], dfb: BU.fb(40), reverb: 0.06, rsize: BU.rsize(2), rtone: BU.rtone(2000), volume: 0.891, density: 0.5, slides: 0.15, accents: 0.35 }, octave: -1, range: 2, scale: 'MINOR', root: 'F#', line: '0 - . .  0+ . . 0  - . 0 .  . 0+ . 4' },

  /* ---- ACID (130 BPM) : la TB-303, de Chicago a Berlin (MODE 303, le son d'avant a l'echantillon pres) ---- */
  // Doubles croches, accents a contretemps, slides, sauts d'octave
  { name: 'ACID', style: 'ACID', p: { cutoff: 0.26, reso: 0.82, envmod: 0.7, decay: 0.42, accent: 0.8, wave: 0, sub: 0.1, drive: 0.4, glide: 0.38, volume: 0.75, density: 0.75, slides: 0.45, accents: 0.45 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0A 0 0+S 0  . 0 3A 0+S  0 . 2A 0S  0+ . 0A 4S' },
  // Plus lente et plus sombre : des trous, l'octave accentuee qui glisse, la septieme et la quinte au troisieme
  // temps ; filtre ferme, resonance au bord, l'accent long qui s'accumule, un echo pointe
  { name: 'BERLIN ACID', style: 'ACID', p: { cutoff: 0.2, reso: 0.88, envmod: 0.75, decay: 0.5, accent: 0.85, wave: 0, sub: 0.15, drive: 0.55, glide: 0.42, accdecay: BU.accd(230), sweep: 0.7, delay: 0.1, dtime: BU.dt['3/16'], dfb: BU.fb(45), reverb: 0.04, volume: 0.73, density: 0.6, slides: 0.5, accents: 0.5 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0 . 0+AS 0  . 0 . 0+S  0A . 6S 4  . 0 0+A .' },
  // Le carre de la 303, des slides en chaine (octave, tonique, tierce), les accents sur les contretemps
  { name: 'ACID RAIN', style: 'ACID', p: { cutoff: 0.3, reso: 0.78, envmod: 0.65, decay: 0.3, accent: 0.75, wave: 1, sub: 0.1, drive: 0.3, glide: 0.35, keytrack: 0.2, sweep: 0.6, volume: 0.71, density: 0.7, slides: 0.55, accents: 0.45 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0S 0+A . 0  0 . 0+AS 0  . 0 0S 2A  . 0+S 0 .' },

  /* ---- TECHNO (132 BPM) : la techno de hangar ---- */
  // Sur le "et" de chaque temps, une double croche qui gronde derriere, la septieme pour relancer. GROWL, peu de
  // DRIFT ; OCTAVE -1 : son carre grave a 16' (a 32' il descendrait a 21 Hz)
  { name: 'TECHNO', style: 'TECHNO', p: { ...PATCH.GROWL, o2range: BU.range("16'"), drift: 0.2, volume: 0.912, density: 0.5, slides: 0.05, accents: 0.3 }, octave: -1, range: 1, scale: 'MINOR', root: 'F#', line: '. . 0A 0  . . 0A 0  . . 0A 0  . . 0A 6' },
  // La dub techno : trois notes tenues, presque rien, l'echo pointe et la grande reverbe font le reste ; une
  // pedale de re (la sixte de la tonalite). SHARK feutre : une attaque douce, l'ampli tenu, une longue chute
  { name: 'DUB CHAMBER', style: 'TECHNO', p: { ...PATCH.SHARK, sustain: 0.9, adecay: BU.adec(150), drive: 0.7, keytrack: 0.3, attack: BU.atk(6), release: BU.rel(120), delay: 0.3, dtime: BU.dt['3/16'], dfb: BU.fb(55), reverb: 0.15, rsize: BU.rsize(4), rtone: BU.rtone(2200), volume: 1.0, density: 0.25, slides: 0.1, accents: 0.1 }, octave: 0, range: 1, scale: 'MINOR', root: 'D', line: '. . 0 -  . . . .  . 0 . .  . . 0 -' },

  /* ---- HOUSE (124 BPM) : de Chicago a la deep house ---- */
  // La deep house : des notes tenues sur l'accord, l'octave, la quinte et la septieme pour tourner. SHARK, chaud,
  // un glide court sur les slides, un peu plus de SUB pour le systeme du club
  { name: 'HOUSE', style: 'HOUSE', p: { ...PATCH.SHARK, glide: BU.glide(46), sub: 0.25, volume: 0.95, density: 0.55, slides: 0.3, accents: 0.2 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '. . 0 -  . 0 . 0+  . . 0 -  . 4 . 6' },
  // Chicago qui jacke : la basse evite le premier temps, saute a l'octave sur les "a", l'accent sur le 3, la
  // septieme de l'accord au bout ; des notes un peu plus longues. ARP (2026-10-09, la revue : en fa diese fixe, la
  // sixte doriene, re diese, frottait contre le re des accords de re et de si) : elle suit les accords.
  // MM CLASSIC, un peu plus d'emphase, KEY TRK bas (l'octave reste ronde)
  { name: 'WAREHOUSE', style: 'HOUSE', p: { ...PATCH.CLASSIC, reso: BU.emph(0.35), keytrack: 0.2, length: BU.len(55), volume: 0.772, density: 0.6, slides: 0.15, accents: 0.3 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '. . 0 0+  . 0 . .  0A - 0 0+  . 0 . 6' },

  /* ---- SUB (basse seule) : les grandes notes graves ---- */
  // De longues notes de sub liees : la tonique, la quinte, la tierce qui glisse vers la tonique. DEEP SUB : le
  // triangle, la scie a 32', le SUB, le filtre a 85 Hz qui s'ouvre lentement (F.ATTACK 30 ms : aucun pincement)
  { name: 'DEEP SUB', style: 'SUB', p: { ...PATCH.SUB, cutoff: BU.cut(85), sub: 0.45, drive: 0.3, o3lvl: 0.45, envmod: BU.env(1), decay: BU.tau(100), fattack: BU.atk(30), volume: 0.933, density: 0.4, slides: 0.4, accents: 0.1 }, octave: 0, range: 1, scale: 'MINOR', root: 'F#', line: '0 - - -  - - - .  4 - - -  2S 0 - -' },
  // Des pulsations de sub sur chaque contretemps, tenues deux pas, la quinte grave a la fin ; une pedale de si
  // (la quarte de la tonalite). Un carre et un triangle a 16' sous un filtre ferme qui s'ouvre lentement, sans SUB (la
  // quinte grave est un fa diese a 46 Hz : le SUB y tomberait a 23 Hz)
  { name: 'SUB PULSE', style: 'SUB', p: { ...PATCH.SUB, ...O1_SQR, o1lvl: 0.9, o2lvl: 0.6, o3lvl: 0, cutoff: BU.cut(90), reso: BU.emph(0.1), envmod: BU.env(1), decay: BU.tau(100), fsustain: 0.3, fattack: BU.atk(30), attack: BU.atk(3), adecay: BU.adec(120), sustain: 0.85, release: BU.rel(40), sub: 0, volume: 0.942, density: 0.4, slides: 0.1, accents: 0.1 }, octave: -1, range: 1, scale: 'MINOR', root: 'B', line: '. . 0 -  . . 0 -  . . 0 -  . . 4_ -' },
];

/*
 * VOLUME de chaque ligne (2026-10-09, le moteur MONARK, Mika : "les presets vraiment excellents") : la regle de Mika,
 * la crete 2 dB sous le kick du MM-RYTM (il crete a -9.3 dBFS), -11.3 dBFS, SUB -12.0 (un sinus tenu pese plus que sa
 * crete). Chaque preset rendu hors ligne (le worklet du depot, la sequence de bass/seq.ts pas a pas, quatre mesures au
 * tempo de son style sur le MM-RYTM, puis 2.5 s de queues), VOLUME seul cale : les 32 MONARK cretent entre -11.3 et
 * -12.3 dBFS (VELVET DISCO, DEEP CUT et DUB CHAMBER a VOLUME 1 : -11.7, -12.3, -11.5), les deux SUB a -12.0. La crete
 * ne fait pas le niveau d'une basse (sound.md 9) : le son de chaque preset est regle pour que sa sonie (BS.1770, mesures
 * 2 a 4) tombe dans la fenetre de son style, -24 a -29 LUFS pour les styles pleins (de -24.3 a -28.8), -27 a -33 pour
 * la minimale (-27.8 a -31.5), -20 a -25 pour les SUB (-23.1, -24.2), au plus 4 LU d'ecart dans un style et entre deux
 * voisins de PREV / NEXT (6 d'un style a l'autre) ; facteur de crete de 7.2 a 16.9 dB. Une ligne qui ne tenait pas les
 * deux a change de son, pas de regle (plus de LOAD, un ampli tenu, un RELEASE plus long, un filtre plus ouvert). Le
 * trio ACID garde son VOLUME (le 303 d'avant) : -10.9 a -11.3 dBFS, -22.8 a -23.9 LUFS.
 */

/** Une ligne ecrite (BassGenre.line) en seize pas. */
export function parseLine(line: string): BassStep[] {
  const out = line
    .trim()
    .split(/\s+/)
    .map((t): BassStep => {
      if (t === '.') return { kind: 'off', deg: 0, oct: 0, acc: false, slide: false };
      if (t === '-') return { kind: 'tie', deg: 0, oct: 0, acc: false, slide: false };
      // + une octave au-dessus (++ deux), _ une en dessous (2026-10-09 ; state.ts garde OCT entre -1 et +2)
      const m = /^(\d+)(\+{1,2}|_?)(A?)(S?)$/.exec(t);
      if (!m) throw new Error(`bass line: ${t}`);
      return { kind: 'note', deg: Number(m[1]), oct: m[2] === '_' ? -1 : m[2].length, acc: m[3] === 'A', slide: m[4] === 'S' };
    });
  if (out.length !== 16) throw new Error(`bass line: ${out.length} steps`);
  return out;
}

export interface BassFactory {
  params: Record<BassKnobId, number>;
  steps: BassStep[];
  /**
   * la recette (2026-10-09, STYLE et DENSITY qui agissent) : une graine tiree du nom (la meme a chaque visite), ancree
   * a la DENSITY du preset, et la ligne ecrite (anchor, la revue du meme jour : ses notes ne sont pas les tiennes, elles
   * sont du preset, src gen) : au STYLE du preset la ligne est telle qu'ecrite a sa DENSITY, s'eclaircit au-dessous
   * (les temps en dernier, elles reviennent en remontant), recoit des notes du style au-dessus ; un autre STYLE rend une
   * ligne de ce style depuis la graine du preset, revenir au sien rend la ligne ecrite. Les notes et le son ne changent
   * pas (la ligne d'usine reste celle du couloir des presets)
   */
  recipe: BassRecipe;
}

/** La graine d'un preset d'usine : son nom hache (FNV-1a), la meme a chaque visite. */
function seedOfName(name: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < name.length; i += 1) h = Math.imul(h ^ name.charCodeAt(i), 0x01000193) >>> 0;
  return h >>> 0;
}

/**
 * Les presets d'usine du MM-BASS. Le remplissage (2026-10-09, le moteur MONARK) : un preset qui pose MODE (fmode) est
 * ecrit pour le moteur d'aujourd'hui, ce qu'il ne pose pas prend def (le patch de depart) ; un preset sans MODE est
 * d'avant, ce qu'il ne pose pas prend legacy ?? def (MODE 303 : son son d'avant, a l'echantillon pres).
 */
export function bassFactory(): { name: string; data: BassFactory }[] {
  return BASS.map((g) => {
    const monark = typeof g.p.fmode === 'number';
    const params = Object.fromEntries(BASS_KNOBS.map((k) => [k.id, g.p[k.id] ?? (monark ? k.def : legacyOf(k))])) as Record<BassKnobId, number>;
    params.style = BASS_STYLES.indexOf(g.style) / (BASS_STYLES.length - 1);
    params.octave = (g.octave + 2) / 3;
    params.range = (g.range - 1) / 2;
    params.scale = BASS_SCALES.indexOf(g.scale) / (BASS_SCALES.length - 1);
    params.root = BASS_ROOTS.indexOf(g.root) / (BASS_ROOTS.length - 1);
    const steps = parseLine(g.line).map((x): BassStep => ({ ...x, src: 'gen' }));
    const recipe: BassRecipe = { seed: seedOfName(g.name), base: params.density, gen: { style: params.style, density: params.density, slides: params.slides, accents: params.accents, range: params.range }, anchor: { steps, style: params.style } };
    return { name: g.name, data: { params, steps, recipe } };
  });
}
