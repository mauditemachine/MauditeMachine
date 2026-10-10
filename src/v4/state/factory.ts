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
 * qui tient), plus DEEP SUB pour la basse ; depuis le 2026-10-10 le MM-BASS
 * en a 33, chacun son son et sa ligne (plus bas, la machine a bassline). Tout est en fa diese
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
import { curatedLadder } from '../bass/gen';
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
 * La machine a bassline (2026-10-10, Mika : "je veux dans PRESET des presets vraiment differents entre eux, JE VEUX
 * QUE CE SOIT UNE MACHINE A BASSLINE ! et que ce soit simple pour en faire une super bonne simplement et je peux aller
 * dans les details pour la custom"). Avant, 35 presets tires de treize recettes : trop se ressemblaient (MINIMAL,
 * THREE STEP et GHOST NOTES presque pareils, la meme famille de patch d'un style a l'autre). Maintenant 33 presets,
 * chacun son caractere et son patch complet (plus de recette partagee), nomme d'apres lui ; ensemble ils font le tour
 * des basses de machine qu'attend un DJ de dark disco, d'indie dance, de minimale, d'italo, d'EBM, d'acid, de techno
 * et de house : la scie grasse du Moog, le carre creux, l'impulsion nasale, le sinus du sub, les scies desaccordees
 * (reese), la 303 qui couine (MODE 303), le pincement en caoutchouc, le funk aux accents, la basse liee qui glisse, le
 * grondement de FEEDBACK et de DRIVE, la techno qui souffle, la basse de tete brillante, le dub qui flotte (DRIFT),
 * l'octave italo, les doubles croches de l'EBM, le filtre qui s'ouvre lentement (F.ATTACK), le contour a l'envers
 * (POLARITY NEG), les couleurs LP12, LP6 et BP, le bip aigu, l'orgue de la house. Chaque preset est une ligne finie
 * des qu'il charge (son niveau, son tempo de style, ses effets) ; ses potards restent loin des butees, pour le
 * retoucher.
 *
 * Mesure hors ligne (jamais de son : le worklet du depot, la sequence de bass/seq.ts, quatre mesures au tempo du
 * style) : un vecteur de traits par preset (brillance, aigus, grave, registre, grain, remplissage de la note,
 * attaque, creux des harmoniques impaires, mouvement du filtre, sonie, espace des effets) et sa ligne (attaques,
 * tenues, accents, slides, hauteurs), sur des echelles ou 1.0 est un ecart net sur un axe. La paire la plus proche
 * est a 2.80 (avant : 0.72, dix-huit paires sous 2.0 ; MINIMAL, THREE STEP et GHOST NOTES, que Mika entendait
 * pareils, etaient entre 2.0 et 2.2) ; deux lignes ont toujours au moins cinq points d'ecart (une attaque de plus ou
 * de moins compte un point), et chaque ligne a son masque note / silence / liaison a elle.
 *
 * Ranges par style pour que PREV / NEXT les parcoure d'un style a l'autre, le monde de Mika en tete (dark disco,
 * indie dance), puis l'acid, la techno, la minimale, l'italo, l'EBM, l'electro, la house, la psy prog, le sub ; dans
 * chaque style le plus fort d'abord. Le premier de chaque style porte le nom du style (le meme preset sur le MM-RYTM
 * et le MM-ARP : les trois ensemble font un morceau qui tient) et sa ligne est la prise 01 du potard STYLE ; les
 * autres portent le nom de leur caractere, douze lettres au plus (les noms d'avant restent la ou ils disent encore le
 * son).
 *
 * Les tonalites : fa diese mineur presque partout (les kicks y sont accordes, le MM-ARP y joue) ; ARP sur les lignes
 * qui tiennent sur la tonique (elles suivent les accords du MM-ARP de leur style), en mineur ou en phrygien, les deux
 * seules gammes ou ARP tombe toujours sur la racine de l'accord (2026-10-09, la revue : en DORIAN, la racine re
 * donnerait do diese ; en HARMONIC, mi donnerait re). Trois lignes sur une autre tonique, toujours dans les notes de fa
 * diese mineur (une pedale : DEEP CUT sur do diese, DUB CHAMBER sur re, SUB PULSE sur si ; leurs lignes n'y jouent que
 * la tonique et la quinte).
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
 * Les patchs (2026-10-10) : chaque preset ecrit le sien en entier, en unites reelles (BU), par quatre aides qui se
 * lisent comme la face : OSC 1, OSC 2, OSC 3 (forme, pieds, niveau, cents, demi-tons), le filtre (MODE, CUTOFF en Hz,
 * EMPH, ENV MOD en octaves, DECAY en constante de temps, F.SUSTAIN, KEY TRK), l'ampli (ATTACK, AMP DECAY vers SUSTAIN,
 * RELEASE, en ms). Ce qu'un preset ne dit pas : BASE (OSC 2 et OSC 3 coupes, NOISE, FEEDBACK, F.ATTACK et SUB a 0,
 * POLARITY POS, SEMI 0, SUB OCT -1, TUNE 0, ACC DECAY 200 ms, les effets a leur def). Le grave le plus bas d'un preset
 * ne descend jamais sous 30 Hz (OSC 3 a 32' sous une note grave, ou le SUB sous OCTAVE -1, y passeraient : ces
 * presets-la gardent leur oscillateur grave a 16').
 */
type Patch = Partial<Record<BassKnobId, number>>;
type Wave = 'TRI' | 'SHARK' | 'REV SAW' | 'SAW' | 'SQR' | 'WIDE' | 'NARROW';
type Feet = "32'" | "16'" | "8'" | "4'";
/**
 * OSC 1 : la scie ou le carre, et son niveau. Toujours a PW 50 % : une impulsion d'OSC 1 porte du continu
 * (bass.worklet.js ne le retire que sur OSC 2 et OSC 3), des coups sous 25 Hz a chaque note ; les impulsions etroites
 * passent par OSC 2 et OSC 3 (WIDE, NARROW)
 */
const o1 = (w: 'SAW' | 'SQR', lvl: number): Patch => ({ wave: w === 'SQR' ? 1 : 0, pw: 0, o1lvl: lvl });
/** OSC 2 : sa forme, ses pieds, son niveau, ses cents, ses demi-tons */
const o2 = (w: Wave, ft: Feet, lvl: number, ct = 0, st = 0): Patch => ({ o2wave: BU.wave(w), o2range: BU.range(ft), o2lvl: lvl, o2fine: BU.fine(ct), o2semi: BU.semi(st) });
/** OSC 3 : la meme chose (REV SAW a la place de SHARK) */
const o3 = (w: Wave, ft: Feet, lvl: number, ct = 0, st = 0): Patch => ({ o3wave: BU.wave(w), o3range: BU.range(ft), o3lvl: lvl, o3fine: BU.fine(ct), o3semi: BU.semi(st) });
/** Le filtre : MODE, CUTOFF (Hz), EMPH, ENV MOD (octaves), DECAY (constante de temps, ms), F.SUSTAIN, KEY TRK */
const flt = (mode: BassMode, hz: number, e: number, oct: number, tau: number, sus: number, kt: number): Patch => ({ fmode: BU.mode(mode), cutoff: BU.cut(hz), reso: BU.emph(e), envmod: BU.env(oct), decay: BU.tau(tau), fsustain: sus, keytrack: kt });
/** L'ampli : ATTACK, AMP DECAY (vers SUSTAIN), SUSTAIN, RELEASE (ms) */
const amp = (a: number, d: number, s: number, r: number): Patch => ({ attack: BU.atk(a), adecay: BU.adec(d), sustain: s, release: BU.rel(r) });
const BASE: Patch = {
  ...o2('SAW', "16'", 0),
  ...o3('SQR', "32'", 0),
  noise: 0,
  feedback: 0,
  fattack: 0,
  fpol: BU.pol('POS'),
  accdecay: BU.accd(200),
  sub: 0,
  suboct: 0,
  tune: 0.5,
};
/**
 * MM CLASSIC, la basse Moog d'ecole : le patch de depart de la machine (les defs de bass/params.ts, une premiere visite
 * sonne comme DARK DISCO) ; deux scies a 5 cents, le carre a 32', LOAD 0.55, le filtre a 140 Hz qui pince
 */
const CLASSIC: Patch = { ...BASE, ...o1('SAW', 0.9), ...o2('SAW', "16'", 0.8, 5), ...o3('SQR', "32'", 0.6, -3), drive: 0.55, cutoff: BU.cut(140), reso: BU.emph(0.2), envmod: BU.env(2.6), decay: BU.tau(56.5), fsustain: 0.15, keytrack: 0.33, attack: BU.atk(1), adecay: BU.adec(130.4), sustain: 0.85, release: BU.rel(20), accent: 0.5, sweep: 0.15, glide: BU.glide(39.1), drift: 0.4, fmode: BU.mode('LP24') };

const BASS: readonly BassGenre[] = [
  /* ---- DARK DISCO (118 BPM) : le disco lent et lourd, entre italo, new wave et EBM ---- */
  // LA SCIE GRASSE. Le galop (x.xx) et l'octave sur la derniere double croche de chaque temps, une relance en fin de
  // mesure ; MM CLASSIC tel quel
  { name: 'DARK DISCO', style: 'DARK DISCO', p: { ...CLASSIC, volume: 0.78, slides: 0.1, accents: 0.3 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0A . 0 0+  0 . 0 0+  0A . 0 0+  0 . 6 4' },
  // LE CONTOUR A L'ENVERS (POLARITY NEG) : chaque note part sombre (le filtre plonge de 3.5 octaves sous 2 kHz) et
  // s'ouvre en 70 ms, un "wouah" qui fleurit ; la ligne esquive le premier temps, l'accent sur 2 et 4, des notes
  // longues (LENGTH 75 %) pour l'entendre s'ouvrir
  { name: 'BLACK SATIN', style: 'DARK DISCO', p: { ...BASE, ...o1('SAW', 0.9), ...o2('SAW', "16'", 0.7, 7), ...flt('LP24', 2000, 0.35, 3.5, 70, 0, 0.33), fpol: BU.pol('NEG'), ...amp(1, 150, 0.6, 30), drive: 0.6, accent: 0.6, sweep: 0, glide: BU.glide(39), drift: 0.4, length: BU.len(75), volume: 0.843, slides: 0.15, accents: 0.4 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '. 0 0+ .  0A . . 0  . 0 0+ .  0A . 6_ 4_' },
  // LE FILTRE QUI S'OUVRE LENTEMENT : F.ATTACK 350 ms, de longues notes (six, quatre, deux pas) qui gonflent, l'emphase
  // (0.6) qui chante pendant l'ouverture ; scie, carre a -6 cents, scie a 32', une reverbe courte
  { name: 'SWELL', style: 'DARK DISCO', p: { ...BASE, ...o1('SAW', 0.9), ...o2('SQR', "16'", 0.6, -6), ...o3('SAW', "32'", 0.4, 3), ...flt('LP24', 70, 0.6, 4.2, 900, 0.6, 0.33), fattack: BU.atk(350), ...amp(4, 900, 1, 120), drive: 0.6, accent: 0.3, sweep: 0, glide: BU.glide(80), drift: 0.5, reverb: 0.06, rsize: BU.rsize(2.5), volume: 0.775, slides: 0.1, accents: 0.15 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0 - - -  - - . 0+  - - - .  6_ - 4_ -' },
  // L'EMPHASE QUI MORD (LP12) : la menace phrygienne, la seconde mineure (sol) qui frotte contre la tonique, l'octave a
  // contretemps ; une scie et une impulsion large, LP12 a l'emphase haute (0.78), LOAD pousse, des accents qui
  // balaient le filtre (SWEEP), des notes assez longues (LENGTH 70 %) pour que la resonance chante. ARP (2026-10-09,
  // la revue : en fa diese fixe, le sol frottait contre le sol diese de l'accord de mi)
  { name: 'CURSED KISS', style: 'DARK DISCO', p: { ...BASE, ...o1('SAW', 1), ...o2('WIDE', "16'", 0.4, 3), ...flt('LP12', 160, 0.78, 3.3, 75, 0.05, 0.4), ...amp(1, 220, 0.7, 30), drive: 0.75, accent: 0.85, sweep: 0.6, accdecay: BU.accd(160), glide: BU.glide(50), drift: 0.3, length: BU.len(70), volume: 0.863, slides: 0.2, accents: 0.45 }, octave: 0, range: 2, scale: 'PHRYGIAN', root: 'ARP', line: '0A . 1 0  . 0 0+ .  0A . 1 0  . 0+ 4_ 1S' },

  /* ---- INDIE DANCE (122 BPM) : l'energie rock et new wave sur une grille club ---- */
  // LA SCIE BRUTE (LP6) : le filtre a 6 dB par octave laisse passer tout le haut, deux scies a 14 cents, LOAD presque
  // au bout, FEEDBACK chaud, un souffle de mediator ; des croches qui poussent, l'octave accentuee sur le "et"
  { name: 'INDIE DANCE', style: 'INDIE DANCE', p: { ...BASE, ...o1('SAW', 0.9), ...o2('SAW', "16'", 0.8, 14), noise: 0.06, ...flt('LP6', 220, 0.1, 2.5, 45, 0.25, 0.67), ...amp(1, 90, 0.45, 20), drive: 0.85, feedback: 0.3, accent: 0.6, sweep: 0.2, glide: BU.glide(39), drift: 0.5, volume: 0.807, slides: 0.15, accents: 0.3 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0 . 0+A 0  0 . 0+A .  0 0 0+A .  0 2 0+A 4' },
  // L'IMPULSION NASALE : une impulsion etroite (NARROW) et une large a 8' dans le passe-bande (BP) a 700 Hz, le "nez"
  // de la new wave, un SUB propre dessous pour le poids ; le tresillo du nu disco (3 + 3 + 2), un echo en croches
  { name: 'NEON HEART', style: 'INDIE DANCE', p: { ...BASE, ...o1('SQR', 0.3), ...o2('NARROW', "16'", 0.9), ...o3('WIDE', "8'", 0.3, 5), ...flt('BP', 700, 0.4, 1, 70, 0.45, 0.67), sub: 0.35, ...amp(1, 200, 0.85, 25), drive: 0.6, accent: 0.5, sweep: 0.15, glide: BU.glide(39), drift: 0.3, delay: 0.06, dtime: BU.dt['1/8'], dfb: BU.fb(20), volume: 0.784, slides: 0.1, accents: 0.3 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0A . . 0+  . . 0 .  0A . . 0+  . . 6_ 0' },
  // LE FUNK : des doubles croches qui claquent, l'accent au maximum (le niveau et le contour sautent) et le SWEEP qui
  // charge, les notes fantomes dessous ; deux carres et le carre a 32' pour le poids, un contour enorme et tres court
  // (+4.2 octaves, 22 ms) pour le claquement, LOAD modere (l'accent passe au-dessus)
  { name: 'DISCO PUNK', style: 'INDIE DANCE', p: { ...BASE, ...o1('SQR', 0.9), ...o2('SQR', "16'", 0.6, -4), ...o3('SQR', "32'", 0.3), ...flt('LP24', 300, 0.3, 4.2, 22, 0.1, 0.5), ...amp(0.5, 150, 0.5, 15), drive: 0.55, feedback: 0.2, accent: 1, sweep: 0.6, accdecay: BU.accd(140), glide: BU.glide(39), drift: 0.3, volume: 0.586, slides: 0.2, accents: 0.35 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0A . . 0  . 0+A . 0  . . 2 .  0+A . 4 3S' },
  // LA BASSE QUI GLISSE : des notes tenues reliees par des glissements lents (GLIDE 140 ms par octave), tonique,
  // octave qui glisse vers la quinte, la quarte vers la tierce, la tonique vers la quinte grave ; scie et triangle,
  // l'ampli plein, DRIFT haut, un echo long
  { name: 'SLOW BURN', style: 'INDIE DANCE', p: { ...BASE, ...o1('SAW', 0.7), ...o2('TRI', "16'", 0.9, 4), ...flt('LP24', 140, 0.2, 1.2, 300, 0.6, 0.33), fattack: BU.atk(20), ...amp(6, 1500, 1, 120), drive: 0.5, accent: 0.3, sweep: 0, glide: BU.glide(140), drift: 0.6, delay: 0.07, dtime: BU.dt['3/8'], dfb: BU.fb(35), reverb: 0.08, rsize: BU.rsize(2.5), rtone: BU.rtone(3000), volume: 0.865, slides: 0.4, accents: 0.1 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0 - - 0+S  4 - - 3S  2 - - 0S  4_ - - .' },

  /* ---- ACID (130 BPM) : la TB-303, de Chicago a Berlin (MODE 303, la voix d'avant le moteur MONARK) ---- */
  // LA 303 QUI COUINE : doubles croches, accents a contretemps, slides, sauts d'octave
  { name: 'ACID', style: 'ACID', p: { cutoff: 0.26, reso: 0.82, envmod: 0.7, decay: 0.42, accent: 0.8, wave: 0, sub: 0.1, drive: 0.4, glide: 0.38, volume: 0.715, slides: 0.45, accents: 0.45 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0A 0 0+S 0  . 0 3A 0+S  0 . 2A 0S  0+ . 0A 4S' },
  // LA 303 CARREE ET GRAVE : le carre de la 303 une octave plus bas (OCTAVE -1, sans SUB : il tomberait a 23 Hz), le
  // filtre un peu plus ouvert ; des slides en chaine (octave, tonique, tierce), les accents sur les contretemps
  { name: 'ACID RAIN', style: 'ACID', p: { cutoff: 0.36, reso: 0.78, envmod: 0.65, decay: 0.3, accent: 0.75, wave: 1, sub: 0, drive: 0.3, glide: 0.35, keytrack: 0.2, sweep: 0.6, volume: 0.682, slides: 0.55, accents: 0.45 }, octave: -1, range: 2, scale: 'MINOR', root: 'F#', line: '0S 0+A . 0  0 . 0+AS 0  . 0 0S 2A  . 0+S 0 .' },
  // LA 303 DE NUIT : plus lente et plus sombre, des trous, l'octave accentuee qui glisse, la septieme et la quinte au
  // troisieme temps ; filtre ferme, resonance au bord, l'accent long qui s'accumule, un echo pointe
  { name: 'BERLIN ACID', style: 'ACID', p: { cutoff: 0.2, reso: 0.88, envmod: 0.75, decay: 0.5, accent: 0.85, wave: 0, sub: 0.15, drive: 0.55, glide: 0.42, accdecay: BU.accd(230), sweep: 0.7, delay: 0.1, dtime: BU.dt['3/16'], dfb: BU.fb(45), reverb: 0.04, volume: 0.706, slides: 0.5, accents: 0.5 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0 . 0+AS 0  . 0 . 0+S  0A . 6S 4  . 0 0+A .' },

  /* ---- TECHNO (132 BPM) : la techno de hangar ---- */
  // LA TECHNO QUI SOUFFLE : un grondement grave (OCTAVE -1) plein de bruit rose, de FEEDBACK et de LOAD, LP12 assez
  // ouvert pour que le souffle passe, des notes tenues (LENGTH 70 %) ; sur le "et" de chaque temps avec une double
  // croche derriere, la septieme pour relancer ; une piece courte
  { name: 'TECHNO', style: 'TECHNO', p: { ...BASE, ...o1('SAW', 0.8), ...o2('SQR', "16'", 0.6, -8), noise: 0.65, ...flt('LP12', 400, 0.2, 2, 35, 0.1, 0.33), ...amp(0.5, 120, 0.6, 40), drive: 0.9, feedback: 0.6, accent: 0.6, sweep: 0.2, glide: BU.glide(39), drift: 0.2, length: BU.len(70), reverb: 0.05, rsize: BU.rsize(1.5), volume: 0.851, slides: 0.05, accents: 0.3 }, octave: -1, range: 1, scale: 'MINOR', root: 'F#', line: '. . 0A 0  . . 0A 0  . . 0A 0  . . 0A 6' },
  // LES SCIES DESACCORDEES (REESE) : trois scies a -18 et +11 cents qui battent lentement, de longues notes, DRIFT haut,
  // le filtre qui s'entrouvre (F.ATTACK 30 ms) ; la tonique sur deux temps, la septieme grave, un glissement vers la
  // quinte grave
  { name: 'REESE', style: 'TECHNO', p: { ...BASE, ...o1('SAW', 0.9), ...o2('SAW', "16'", 0.9, -18), ...o3('SAW', "32'", 0.5, 11), ...flt('LP24', 260, 0.2, 1, 400, 0.5, 0.33), fattack: BU.atk(30), ...amp(3, 1200, 0.95, 80), drive: 0.7, accent: 0.4, sweep: 0.1, glide: BU.glide(90), drift: 0.8, volume: 0.878, slides: 0.3, accents: 0.15 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0 - - -  - - - 0S  6_ - - -  - . 5_S 4_' },
  // LE DUB QUI FLOTTE : deux triangles a 9 cents et DRIFT au bout (la hauteur et le filtre vacillent), LP12 tendre ;
  // trois notes tenues, presque rien, l'echo pointe et la grande reverbe font le reste ; une pedale de re
  { name: 'DUB CHAMBER', style: 'TECHNO', p: { ...BASE, ...o1('SAW', 0.25), ...o2('TRI', "16'", 0.9), ...o3('TRI', "16'", 0.6, 9), ...flt('LP12', 300, 0.3, 1.4, 160, 0.3, 0.33), ...amp(8, 400, 0.6, 150), drive: 0.55, accent: 0.3, sweep: 0, glide: BU.glide(39), drift: 1, delay: 0.32, dtime: BU.dt['3/16'], dfb: BU.fb(55), reverb: 0.15, rsize: BU.rsize(4), rtone: BU.rtone(2200), volume: 0.84, slides: 0.1, accents: 0.1 }, octave: 0, range: 1, scale: 'MINOR', root: 'D', line: '. . 0 -  . . . .  . 0 . .  . . 0 -' },

  /* ---- MINIMAL (125 BPM, swing lourd) : la minimale hypnotique, presque rien sur les temps ---- */
  // LE BLOOP ROND : quatre notes rondes entre les kicks (OCTAVE -1), la derniere sur la septieme ; le triangle et un
  // peu de carre, l'emphase a mi-course, un contour ample et tres court, KEY TRK plein
  { name: 'MINIMAL', style: 'MINIMAL', p: { ...BASE, ...o1('SQR', 0.3), ...o2('TRI', "16'", 1), ...flt('LP24', 120, 0.45, 3.5, 22, 0, 1), ...amp(3, 50, 0.3, 70), drive: 0.3, accent: 0.6, sweep: 0.1, glide: BU.glide(39), drift: 0.3, volume: 0.994, slides: 0.05, accents: 0.2 }, octave: -1, range: 1, scale: 'MINOR', root: 'F#', line: '. . . 0  . . 0A .  . . . 0  . . 6 .' },
  // LE BIP AIGU : le triangle a 8' et un carre a 4', l'echelle au bord de l'auto-oscillation (EMPH 0.9) que chaque note
  // fait sonner, un SUB propre une octave sous la note pour le poids (le bip de Sheffield) ; beaucoup d'echo
  { name: 'MICRO BLEEP', style: 'MINIMAL', p: { ...BASE, ...o1('SAW', 0), ...o2('TRI', "8'", 0.5), ...o3('SQR', "4'", 0.12), ...flt('LP24', 300, 0.9, 2, 40, 0, 1), sub: 0.5, ...amp(0.5, 180, 0.15, 60), drive: 0.35, accent: 0.4, sweep: 0, glide: BU.glide(39), drift: 0.2, length: BU.len(25), delay: 0.14, dtime: BU.dt['1/8'], dfb: BU.fb(45), volume: 0.874, slides: 0.05, accents: 0.3 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '. . 0+ .  . 0 . .  . 0+A . 0  . . . 2' },
  // LE FEUTRE (LP6) : deux triangles presque des sinus, une pointe d'octave, le filtre a 6 dB qui s'entrouvre a peine ;
  // deux notes tenues sur le "a" du premier temps et le "et" du troisieme, la quinte grave qui remonte en glissant ;
  // une pedale de do diese (la quinte de la tonalite)
  { name: 'DEEP CUT', style: 'MINIMAL', p: { ...BASE, ...o1('SAW', 0), ...o2('TRI', "16'", 1), ...o3('TRI', "8'", 0.15, 4), ...flt('LP6', 120, 0, 0.8, 150, 0.3, 0.33), fattack: BU.atk(10), ...amp(2, 300, 0.5, 60), drive: 0.45, accent: 0.3, sweep: 0, glide: BU.glide(120), drift: 0.4, reverb: 0.05, rsize: BU.rsize(1.2), volume: 1, slides: 0.25, accents: 0.15 }, octave: 0, range: 1, scale: 'MINOR', root: 'C#', line: '. . . 0  - . . .  . . 0 -  . . 4_S 0' },

  /* ---- ITALO (120 BPM) : l'italo disco, Moroder, Kano, les boites des annees 80 ---- */
  // L'OCTAVE QUI REBONDIT : grave, aigue, en doubles croches, sur les accords ; deux scies a l'octave (16' et 8'), le
  // filtre plus haut, des notes courtes
  { name: 'ITALO', style: 'ITALO', p: { ...BASE, ...o1('SAW', 0.9), ...o2('SAW', "8'", 0.6), ...flt('LP24', 800, 0.2, 2, 26, 0.2, 0.67), ...amp(1, 39, 0.4, 15), drive: 0.45, accent: 0.45, sweep: 0.1, glide: BU.glide(30), drift: 0.3, length: BU.len(30), volume: 0.883, slides: 0.05, accents: 0.2 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0A 0+ 0 0+  0 0+ 0 0+  0A 0+ 0 0+  0 0+ 0 0+' },
  // MUNICH, 1977 : des croches (grave, octave) que l'echo en double croche (fort, 30 % de retour) fait galoper ; une
  // scie seule et le carre a 32' dans LP12 ; fa diese deux temps, puis re et mi graves, un accent au debut de chaque
  // moitie
  { name: 'MUNICH 77', style: 'ITALO', p: { ...BASE, ...o1('SAW', 1), ...o3('SQR', "32'", 0.5), ...flt('LP12', 250, 0.35, 2.8, 50, 0.1, 0.5), ...amp(1, 60, 0.5, 20), drive: 0.35, accent: 0.5, sweep: 0.15, glide: BU.glide(39), drift: 0.3, length: BU.len(40), delay: 0.42, dtime: BU.dt['1/16'], dfb: BU.fb(30), volume: 0.84, slides: 0.05, accents: 0.2 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0A . 0+ .  0 . 0+ .  5_A . 5 .  6_ . 6 .' },
  // LA BASSE DE TETE : une scie, une scie a 8' une quinte plus haut (le reflet d'un oscillateur synchronise), le carre
  // a 32' pour le poids, LP12 a l'emphase haute que le contour (+4 octaves) balaie a travers les harmoniques ;
  // l'octave en croches poussee par une double croche, la note sous la tonique qui y remonte. ARP (2026-10-09, la revue : en fa diese fixe, le mi diese de
  // la gamme harmonique frottait contre le mi des accords de la et de mi)
  { name: 'COSMIC LOVE', style: 'ITALO', p: { ...BASE, ...o1('SAW', 0.8), ...o2('SAW', "8'", 0.35, 0, 7), ...o3('SQR', "32'", 0.45), ...flt('LP12', 200, 0.65, 4, 110, 0.25, 0.67), ...amp(1, 250, 0.7, 40), drive: 0.55, accent: 0.5, sweep: 0.3, glide: BU.glide(40), drift: 0.3, delay: 0.06, dtime: BU.dt['1/8'], dfb: BU.fb(20), reverb: 0.08, rsize: BU.rsize(1.8), volume: 0.899, slides: 0.05, accents: 0.2 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0 . 0+ .  0 0+ . 0  0 . 0+ .  0 0+ . 6_' },

  /* ---- EBM (124 BPM) : l'Electronic Body Music, carre et martial, aucun swing ---- */
  // LA MACHINE QUI MARTELE : trois doubles croches et un trou par temps, l'octave sur la troisieme ; deux scies a -9
  // cents, le carre a 32', LOAD presque au bout, FEEDBACK qui gratte, tout court, aucune derive
  { name: 'EBM', style: 'EBM', p: { ...BASE, ...o1('SAW', 0.9), ...o2('SAW', "16'", 0.8, -9), ...o3('SQR', "32'", 0.6), noise: 0.1, ...flt('LP24', 240, 0.25, 3.2, 18, 0, 0.33), ...amp(0.5, 20, 0.15, 8), drive: 0.9, feedback: 0.7, accent: 0.6, sweep: 0.2, glide: BU.glide(25), drift: 0, volume: 0.955, slides: 0, accents: 0.25 }, octave: 0, range: 1, scale: 'MINOR', root: 'ARP', line: '0A 0 0+ .  0A 0 0+ .  0A 0 0+ .  0A 0 4 0+' },
  // LE GRONDEMENT : FEEDBACK et LOAD presque au bout, un carre une quinte plus haut (un grain de FM), le carre a 32'
  // pour le poids, LP12 a l'emphase moyenne et un contour lent ; des notes tenues (LENGTH 75 %) qui grondent ; la
  // marche, chaque temps accentue, une double croche qui le pousse, la seconde phrygienne (sol) qui grince
  { name: 'GROWL', style: 'EBM', p: { ...BASE, ...o1('SAW', 0.9), ...o2('SQR', "16'", 0.45, 0, 7), ...o3('SQR', "32'", 0.5), noise: 0.05, ...flt('LP12', 320, 0.5, 2, 300, 0.4, 0.33), ...amp(0.5, 300, 0.7, 40), drive: 0.9, feedback: 0.85, accent: 0.8, sweep: 0.45, accdecay: BU.accd(140), glide: BU.glide(39), drift: 0.2, length: BU.len(75), reverb: 0.05, rsize: BU.rsize(0.8), volume: 0.759, slides: 0, accents: 0.4 }, octave: 0, range: 1, scale: 'PHRYGIAN', root: 'F#', line: '0A . . 0  0A . 1 .  0A . . 0  0A 1 0 .' },
  // LE CARRE DUR (BP) : deux carres dans le passe-bande, le creux et la durete de Nitzer Ebb, un SUB propre dessous ;
  // des paires de doubles croches en 3 + 3 + 2 (xx. xx. xx), l'accent qui se deplace
  { name: 'BODY MUSIC', style: 'EBM', p: { ...BASE, ...o1('SQR', 0.9), ...o2('SQR', "16'", 0.7, -6), ...flt('BP', 380, 0.25, 1.6, 40, 0.25, 0.5), sub: 0.35, ...amp(0.5, 120, 0.85, 12), drive: 0.9, accent: 0.45, sweep: 0.2, glide: BU.glide(25), drift: 0, volume: 0.749, slides: 0, accents: 0.3 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0A 0 . 0+  0 . 0A 0  0+ 0 . 0A  0 . 0+ 0' },

  /* ---- ELECTRO (128 BPM) : Detroit, d'apres Kraftwerk ---- */
  // LE CARRE CREUX : deux carres a -6 cents dans LP12 a l'emphase moyenne (les harmoniques impaires seules : le creux) ;
  // la syncope du kick (1, le "et" de 2, le "et" de 3) et des sauts d'octave
  { name: 'ELECTRO', style: 'ELECTRO', p: { ...BASE, ...o1('SQR', 0.9), ...o2('SQR', "16'", 0.6, -6), ...flt('LP12', 260, 0.5, 2, 35, 0.25, 0.67), ...amp(1, 65, 0.6, 20), drive: 0.5, accent: 0.6, sweep: 0.15, glide: BU.glide(39), drift: 0.3, volume: 0.755, slides: 0.1, accents: 0.45 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0A . . 0+  . . 0 .  . 0+ 0A .  2 . 0+ 6' },
  // LE ZAP : l'emphase haute (0.85) et un contour enorme (+5 octaves) qui retombe en 20 ms, un "pew" au debut de chaque
  // note grave (OCTAVE -1) ; carre et scie, LOAD faible (le zap reste net) ; la ligne qui saute de l'octave a la
  // tierce, syncopee
  { name: 'LASER', style: 'ELECTRO', p: { ...BASE, ...o1('SQR', 0.8), ...o2('SAW', "16'", 0.5, -5), ...flt('LP24', 100, 0.85, 5, 20, 0, 0.67), ...amp(0.5, 140, 0.65, 20), drive: 0.3, accent: 0.6, sweep: 0.2, glide: BU.glide(39), drift: 0.2, volume: 0.838, slides: 0.05, accents: 0.35 }, octave: -1, range: 2, scale: 'MINOR', root: 'F#', line: '0A . . 0+  2+ . 0+ .  0A . . 0+  6 . 4 .' },
  // SOUS LA MER (BP) : une scie et un triangle a 8' dans le passe-bande, un SUB propre pour le fond, le filtre qui
  // s'ouvre (F.ATTACK 80 ms), DRIFT ; des notes graves tenues par-dessus les temps, l'octave sur le 2 et le "e" du 4, un
  // echo pointe et une reverbe sombres
  { name: 'DEEP SEA', style: 'ELECTRO', p: { ...BASE, ...o1('SAW', 0), ...o2('SAW', "16'", 0.8), ...o3('TRI', "8'", 0.2), ...flt('BP', 220, 0.3, 1.5, 200, 0.3, 0.33), fattack: BU.atk(80), sub: 0.5, ...amp(5, 400, 0.7, 100), drive: 0.5, accent: 0.4, sweep: 0, glide: BU.glide(60), drift: 0.6, delay: 0.1, dtime: BU.dt['3/16'], dfb: BU.fb(45), reverb: 0.06, rsize: BU.rsize(2), rtone: BU.rtone(2000), volume: 0.793, slides: 0.15, accents: 0.35 }, octave: 0, range: 2, scale: 'MINOR', root: 'F#', line: '0 - . .  0+ . . 0  - . 0 .  . 0+ . 4' },

  /* ---- HOUSE (124 BPM) : de Chicago a la deep house ---- */
  // LA DEEP HOUSE CHAUDE : la forme SHARK, un triangle a +4 cents, une pointe de scie et de SUB, l'ampli tenu ; des
  // notes tenues sur l'accord, l'octave, la quinte et la septieme pour tourner
  { name: 'HOUSE', style: 'HOUSE', p: { ...BASE, ...o1('SAW', 0.3), ...o2('SHARK', "16'", 0.9), ...o3('TRI', "16'", 0.5, 4), ...flt('LP24', 200, 0.3, 1.6, 80, 0.3, 0.33), sub: 0.25, ...amp(2, 400, 0.75, 40), drive: 0.6, accent: 0.4, sweep: 0.1, glide: BU.glide(46), drift: 0.5, volume: 0.969, slides: 0.3, accents: 0.2 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '. . 0 -  . 0 . 0+  . . 0 -  . 4 . 6' },
  // LE CAOUTCHOUC : un contour enorme (+4.6 octaves) et tres court (16 ms) sous une emphase haute, l'ampli sans
  // SUSTAIN : chaque note rebondit ("boing") ; Chicago qui jacke, l'octave sur les "a", l'accent sur le 3
  { name: 'RUBBER', style: 'HOUSE', p: { ...BASE, ...o1('SAW', 0.6), ...o2('SQR', "16'", 0.7), ...flt('LP24', 80, 0.62, 4.6, 16, 0, 0.67), ...amp(0.5, 280, 0, 30), drive: 0.5, accent: 0.4, sweep: 0.3, glide: BU.glide(39), drift: 0.3, volume: 0.861, slides: 0.15, accents: 0.3 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '. . 0 0+  . 0 . .  0A - 0 0+  . 0 . 6' },
  // L'ORGUE : trois carres et triangles a 16', 8' et 4' (les tirettes d'un orgue), le filtre ouvert et immobile,
  // l'ampli plein qui coupe net ; la syncope de la house des annees 90 (1, le "a" du 1, le "et" de 2), la quinte et la
  // septieme graves
  { name: 'ORGAN BASS', style: 'HOUSE', p: { ...BASE, ...o1('SQR', 0.6), ...o2('SQR', "8'", 0.45), ...o3('TRI', "4'", 0.25), ...flt('LP12', 1500, 0.1, 0.3, 100, 0.8, 0.5), sub: 0.3, ...amp(1, 2000, 1, 25), drive: 0.3, accent: 0.3, sweep: 0, glide: BU.glide(39), drift: 0.3, reverb: 0.06, rsize: BU.rsize(1.2), volume: 0.745, slides: 0.05, accents: 0.2 }, octave: 0, range: 2, scale: 'MINOR', root: 'ARP', line: '0 . . 0  . . 0 -  . . 0 .  4_ . 6_ .' },

  /* ---- PSY PROG (138 BPM) : la psytrance progressive, le kick seul sur le temps ---- */
  // LE ROULEMENT : la basse sur les trois doubles croches apres chaque kick (K B B B), une seule note grave (OCTAVE -1) ;
  // deux scies a -9 cents, un contour tres court, l'ampli court, aucune derive (la machine droite)
  { name: 'PSY PROG', style: 'PSY PROG', p: { ...BASE, ...o1('SAW', 1), ...o2('SAW', "16'", 1, -9), ...flt('LP24', 300, 0.25, 3.5, 15, 0, 0.33), ...amp(0.5, 60, 0.3, 15), drive: 0.85, feedback: 0.2, accent: 0.5, sweep: 0.2, glide: BU.glide(25), drift: 0, volume: 0.946, slides: 0, accents: 0.15 }, octave: -1, range: 1, scale: 'MINOR', root: 'F#', line: '. 0 0 0  . 0 0 0  . 0 0 0  . 0 0 0' },
  // LE COUP SEC : le triangle et un peu de carre, grave (OCTAVE -1), un contour et un ampli tres courts (12 et 40 ms,
  // aucun SUSTAIN), propre : un coup de bois tendu ; deux doubles croches apres le kick (K B B .), l'octave et la
  // septieme pour finir la mesure
  { name: 'MOON GALLOP', style: 'PSY PROG', p: { ...BASE, ...o1('SQR', 0.4), ...o2('TRI', "16'", 1), ...flt('LP24', 250, 0.2, 2.5, 12, 0, 0.67), ...amp(0.5, 40, 0, 10), drive: 0.5, accent: 0.5, sweep: 0.2, accdecay: BU.accd(120), glide: BU.glide(25), drift: 0.1, volume: 0.987, slides: 0, accents: 0.15 }, octave: -1, range: 2, scale: 'MINOR', root: 'F#', line: '. 0 0 .  . 0 0 .  . 0 0 .  . 0+ 6 .' },

  /* ---- SUB (basse seule) : les grandes notes graves ---- */
  // LE SINUS DU SUB : un triangle seul sous un filtre presque ferme (presque un sinus), le SUB propre dessous ; de
  // longues notes liees, la tonique, la quinte, la tierce qui glisse vers la tonique, un glide lent
  { name: 'DEEP SUB', style: 'SUB', p: { ...BASE, ...o1('SAW', 0), ...o2('TRI', "16'", 1), ...flt('LP24', 70, 0, 0.5, 300, 0.5, 0.33), sub: 0.5, ...amp(3, 2000, 1, 80), drive: 0.25, accent: 0.2, sweep: 0, glide: BU.glide(150), drift: 0.1, volume: 0.958, slides: 0.4, accents: 0.1 }, octave: 0, range: 1, scale: 'MINOR', root: 'F#', line: '0 - - -  - - - .  4 - - -  2S 0 - -' },
  // LE SUB QUI POMPE : des pulsations sur chaque contretemps, tenues deux pas, une attaque de 15 ms et un filtre qui
  // s'ouvre lentement (le pompage du sidechain) ; un carre et un triangle a 16' sous un filtre ferme ; une pedale de si
  // (la quarte de la tonalite), la quinte grave a la fin
  { name: 'SUB PULSE', style: 'SUB', p: { ...BASE, ...o1('SQR', 0.9), ...o2('TRI', "16'", 0.6), ...flt('LP24', 90, 0.1, 1, 100, 0.3, 0.33), fattack: BU.atk(30), ...amp(15, 300, 0.6, 40), drive: 0.4, accent: 0.2, sweep: 0, glide: BU.glide(39), drift: 0.2, volume: 0.992, slides: 0.1, accents: 0.1 }, octave: -1, range: 1, scale: 'MINOR', root: 'B', line: '. . 0 -  . . 0 -  . . 0 -  . . 4_ -' },
];

/*
 * VOLUME de chaque ligne (2026-10-10) : la regle de Mika, la crete 2 dB sous le kick du MM-RYTM (il crete a -9.3
 * dBFS) : -11.3 dBFS, a 0.9 dB pres. Chaque preset rendu hors ligne (le worklet du depot, la sequence de bass/seq.ts
 * pas a pas, quatre mesures au tempo de son style sur le MM-RYTM, puis 2.5 s de queues), VOLUME seul cale : la crete
 * un peu plus basse pour un son tenu (REESE, SWELL, DEEP SUB : -12.2), un peu plus haute pour un son pince (RUBBER,
 * LASER, NEON HEART : -10.4), pour que PREV / NEXT ne saute pas trop fort. Les 33 cretent de -12.2 a -10.4 dBFS, leur
 * sonie (BS.1770, mesures 2 a 4) va de -30.6 a -21.0 LUFS ; aucun grave sous 34.6 Hz, aucun echantillon non fini, le
 * continu sous 1e-5. DARK DISCO garde VOLUME 0.78 (le patch de depart, -11.31 dBFS) ; le trio ACID est cale comme
 * les autres.
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
   * la recette (v2, 2026-10-09, Mika : "Je trouve Style et Density complexe a utiliser") : le style du preset, sa prise
   * (son rang parmi les lignes de ce style, dans l'ordre de BASS : BERLIN ACID est ACID 02), tous ses barreaux ecrits
   * actifs (on : son compte) et son echelle (bass/gen.ts curatedLadder) : charge, il sonne tel qu'ecrit, NOTES le
   * rend note a note, STYLE et GEN en partent. Les notes et le son ne changent pas
   */
  recipe: BassRecipe;
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
    // La prise : le rang de ce preset parmi les lignes de son style (2026-10-09, les numeros suivent l'ordre de BASS)
    const take = BASS.filter((x) => x.style === g.style).indexOf(g) + 1;
    const c = curatedLadder(g.style, steps, take, SCALE_DEGREES[g.scale] ?? 7);
    const recipe: BassRecipe = { v: 2, style: BASS_STYLES.indexOf(g.style), take, on: c.on, ladder: c.ladder, mutated: false, mem: {} };
    // NOTES suit la ligne (2026-10-09) : le compte ecrit, pour que l'en-tete nomme le preset une fois charge
    params.density = c.on / 16;
    return { name: g.name, data: { params, steps, recipe } };
  });
}

/** Le nombre de degres de chaque gamme (bass/params.ts SCALE_TONES : 5 en pentatonique). */
const SCALE_DEGREES: Readonly<Record<string, number>> = { MINOR: 7, PHRYGIAN: 7, DORIAN: 7, HARMONIC: 7, PENTA: 5 };

/**
 * Les lignes ecrites, une par preset d'usine, dans l'ordre de BASS (2026-10-09) : les prises 01 a k de chaque style
 * (bass/line.ts), la meme source que les presets (une prise et son preset ne divergent jamais). Nouvelle ligne : a la
 * suite de son style, jamais avant (les numeros des prises ne bougent pas).
 */
export function bassCuratedLines(): { name: string; style: BassStyle; line: string }[] {
  return BASS.map((g) => ({ name: g.name, style: g.style, line: g.line }));
}
