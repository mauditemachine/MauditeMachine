/**
 * Le Roto-Control tout regle (2026-10-05, Mika : "le MIDI LEARN fonctionne,
 * mais je voudrais que ce soit parametre en entier automatiquement sur le
 * Roto-Control ; j'ai Roto-Setup pour assigner toutes les touches, passe par
 * la pour tout configurer, mets de bonnes couleurs, les bonnes
 * denominations ; les machines sur le Roto devraient s'appeler RYTM, ARP,
 * DECK, MIXER, SMPL"). Six setups MIDI du Roto, un par machine (le MM-DECKS
 * en deux : ses platines, sa table), et LIVE (2026-10-05, Mika : "le mieux
 * possible pour le jeu en live, je veux controler toutes les machines") :
 * la table, le MM-RYTM et ses mutes, le MM-ARP et ses accords, les effets,
 * sans changer de setup :
 * - chacun sur son canal : les potards sur 1 (RYTM), 2 (ARP), 3 (DECK),
 *   4 (MIXER), 5 (SMPL), 6 (LIVE), ses boutons sur le canal + 8 (9 a 14) ;
 * - une page du Roto montre huit potards et huit boutons : ils vont
 *   ensemble (la voix choisie et ses boutons de choix, les volumes et leurs
 *   mutes, le filtre et les accords) ;
 * - le potard ou le bouton n (0 a 31, quatre pages de huit) envoie le CC
 *   14 + n (n < 18), sinon 102 + (n - 18) : des CC sans role reserve par la
 *   norme MIDI (ni 0 bank, ni 1 modulation, ni 6/38 data, ni 64 pedale, ni
 *   96 a 101 RPN/NRPN, ni 120 a 127 messages de canal) ;
 * - 0 a 127 sur toute la course (le test de Mika : son potard etait borne
 *   de 15 a 115 dans son setup) ; un selecteur a crans du site devient un
 *   potard a crans du Roto (TYPE STEP), ses crans nommes quand le site les
 *   connait ; un etat (RUN, un mute, OSC ON), un bouton TOGGLE dont la
 *   LED suit le site ; une action, un bouton PUSH ; un potard bipolaire
 *   (EQ, FILTER, GAIN, PITCH, TONE...), un cran au milieu ;
 * - les noms courts (12 lettres au plus, la limite du Roto), une couleur par
 *   page (la palette du Roto : 83 couleurs numerotees).
 * Le site connait la meme table (rotoTarget) : branche le Roto, il repond
 * tout de suite, sans MIDI LEARN (une assignation apprise passe avant), et
 * ses potards motorises suivent les valeurs du site. Les fichiers .json se
 * telechargent du panneau MIDI (ui/MidiPanel.tsx) et s'importent dans
 * ROTO-SETUP (File > Import, sur le setup choisi avec SEL).
 * Format : celui des exports de ROTO-SETUP (version 1, verifie sur des
 * exports reels de l'app : controlIndex, controlMode, controlChannel 1 a
 * 16, controlParam, minValue, maxValue, controlName, colorScheme, hapticMode,
 * hapticSteps, stepNames ; ledOnColor et ledOffColor pour les boutons).
 */

import { KIT_MODELS, KIT_MODEL_LABEL, type KitFamily } from '../audio/kit';
import { samplesOf } from '../audio/samples';
import { voyKnob, type VoyKnobId } from '../voyager/params';

export type RotoSetupName = 'RYTM' | 'ARP' | 'DECK' | 'MIXER' | 'SMPL' | 'LIVE';

/** Les couleurs de la palette du Roto utilisees ici (son numero). */
const C = {
  orange: 15,
  gold: 1,
  yellow: 17,
  cream: 3,
  white: 13,
  red: 14,
  green: 5,
  lime: 4,
  cyan: 21,
  blue: 22,
  purple: 24,
  pink: 26,
  peach: 29,
  off: 70,
} as const;

interface Ctl {
  /** la cible MIDI du site (midi/targets.ts, dj/midi.ts, smpl/midi.ts) */
  t: string;
  /** son nom sur l'ecran du Roto (12 lettres au plus) */
  n: string;
  c: number;
  /** crans : leur nombre et leurs noms (un potard a crans) ; bouton : bascule */
  steps?: readonly string[];
  toggle?: boolean;
  /** un cran au milieu (la valeur neutre d'un potard bipolaire) */
  center?: boolean;
}

export interface RotoSetup {
  name: RotoSetupName;
  /** le setup conseille sur le Roto (SETUP 11 a 16 : les premiers restent a toi) */
  slot: number;
  /** le canal des potards ; les boutons : + 8 */
  ch: number;
  knobs: readonly (Ctl | null)[];
  buttons: readonly (Ctl | null)[];
}

/** Le CC du controle n (0 a 31). */
export const rotoCc = (n: number): number => (n < 18 ? 14 + n : 102 + (n - 18));

const steps = (id: VoyKnobId): readonly string[] | undefined => {
  const k = voyKnob(id);
  return k.steps && !k.morph ? k.steps.map((s) => String(s).toUpperCase()) : undefined;
};

const k = (t: string, n: string, c: number, s?: readonly string[]): Ctl => ({ t, n, c, ...(s ? { steps: s } : {}) });
const b = (t: string, n: string, c: number, toggle = false): Ctl => ({ t, n, c, ...(toggle ? { toggle } : {}) });
const v = (id: VoyKnobId, n: string, c: number): Ctl => k(`voy:knob:${id}`, n, c, steps(id));
const dj = (id: string, n: string, c: number): Ctl => ({ t: `dj:dj-${id}`, n, c });

/* ---------------- les six setups ---------------- */

/*
 * Une page du Roto montre huit potards ET huit boutons : chaque page va
 * ensemble (2026-10-05, Mika : "tout mappe de la meilleure maniere possible,
 * la plus efficace pour le jeu en live") ; un bouton qui a un etat (RUN, un
 * mute, OSC ON) est une bascule dont la LED suit le site ; un potard
 * bipolaire (EQ, FILTER, GAIN, PITCH, TONE, STRETCH, TUNE) a un cran au
 * milieu (sa valeur neutre).
 */

const VOICES8 = ['BD', 'SD', 'TOM', 'CH', 'OH', 'CP', 'RS', 'HT'] as const;
const LIVE_MUTES = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'RS', 'HT'] as const;
const CHORD_NAMES = ['F#m', 'D', 'E', 'C#m', 'Bm', 'A', 'F#m7', 'Dmaj7'] as const;

/** Un potard au cran du milieu. */
const mid = (c: Ctl): Ctl => ({ ...c, center: true });
/** Un bouton a bascule (sa cible est une valeur 0 ou 1 : la LED suit). */
const tog = (t: string, n: string, c: number): Ctl => b(t, n, c, true);
/** Le choix de son d'une famille du kit : ses crans nommes (909, 808, MM, tes samples) quand il y en a 16 au plus. */
const kitSound = (f: KitFamily, n: string): Ctl => {
  const names = [...KIT_MODELS.map((m) => KIT_MODEL_LABEL[m]), ...samplesOf(f).map((s) => s.label)];
  return k(`rytm:kit:${f}`, n, C.gold, names.length <= 16 ? names : undefined);
};
const mute = (i: string): Ctl => tog(`rytm:voice:${i}:mute`, `MUTE ${i}`, C.pink);
const chord = (i: number): Ctl => b(`voy:pad:${i}`, CHORD_NAMES[i], C.blue);
const fx = (id: string, n: string): Ctl => dj(`fx-${id}`, n, C.purple);
const FX_TO: Ctl = { ...dj('fxto', 'FX TO', C.white), steps: ['ALL', 'RYTM', 'ARP', 'A', 'B'] };

/** La table, les quatre voies : faders et filtres (la page 1 du MIXER et du LIVE). */
const MIX_PAGE: readonly Ctl[] = [
  dj('ch1-fader', 'FADER RYTM', C.white),
  dj('ch2-fader', 'FADER ARP', C.white),
  dj('ch3-fader', 'FADER A', C.white),
  dj('ch4-fader', 'FADER B', C.white),
  mid(dj('ch1-filter', 'FILTER RYTM', C.orange)),
  mid(dj('ch2-filter', 'FILTER ARP', C.orange)),
  mid(dj('ch3-filter', 'FILTER A', C.orange)),
  mid(dj('ch4-filter', 'FILTER B', C.orange)),
];
const FX_PAGE: readonly Ctl[] = [fx('overdrive', 'OVERDRIVE'), fx('crush', 'CRUSH'), fx('chorus', 'CHORUS'), fx('flanger', 'FLANGER'), fx('trans', 'TRANS'), fx('delay', 'DELAY'), fx('reverb', 'REVERB'), FX_TO];

/** Les setups, construits au telechargement (le choix de son du kit compte tes samples). */
function buildSetups(): RotoSetup[] {
  const RYTM: RotoSetup = {
    name: 'RYTM',
    slot: 11,
    ch: 1,
    knobs: [
      // 1 : la machine
      k('rytm:enc:level', 'MASTER', C.white),
      k('rytm:enc:tempo', 'TEMPO', C.white),
      k('rytm:enc:swing', 'SWING', C.orange),
      mid(k('rytm:enc:stretch', 'STRETCH', C.orange)),
      k('rytm:enc:dist', 'DIST', C.purple),
      k('rytm:enc:chorus', 'CHORUS', C.purple),
      k('rytm:enc:delay', 'DELAY', C.purple),
      k('rytm:enc:reverb', 'REVERB', C.purple),
      // 2 : la voix choisie (ses boutons la choisissent)
      k('rytm:enc:vol', 'VOLUME', C.yellow),
      mid(k('rytm:enc:tone', 'TONE', C.yellow)),
      k('rytm:enc:vdecay', 'DECAY', C.yellow),
      k('rytm:enc:vdist', 'V DIST', C.peach),
      k('rytm:enc:vchorus', 'V CHORUS', C.peach),
      k('rytm:enc:vdelay', 'V DELAY', C.peach),
      k('rytm:enc:vreverb', 'V REVERB', C.peach),
      mid(k('rytm:kit:tune', 'KICK TUNE', C.gold)),
      // 3 : les volumes des voix (leurs boutons : leurs mutes)
      ...VOICES8.map((i) => k(`rytm:voice:${i}:level`, `${i} VOL`, C.cream)),
      // 4 : CY et PC, le kit
      k('rytm:voice:CY:level', 'CY VOL', C.cream),
      k('rytm:voice:PC:level', 'PC VOL', C.cream),
      kitSound('bd', 'KICK SOUND'),
      k('rytm:kit:attack', 'KICK ATTACK', C.gold),
      k('rytm:kit:decay', 'KICK DECAY', C.gold),
      k('rytm:kit:drive', 'KICK DRIVE', C.gold),
      kitSound('sd', 'SNARE SOUND'),
      k('rytm:kit:snappy', 'SNAPPY', C.gold),
    ],
    buttons: [
      // 1 : jouer
      tog('rytm:running', 'RUN', C.red),
      b('rytm:random', 'RANDOM', C.orange),
      b('rytm:clear', 'CLEAR', C.orange),
      b('rytm:edit', 'EDIT', C.yellow),
      b('rytm:open', 'OPEN', C.orange),
      b('nav:machines', 'RYTM + ARP', C.red),
      b('nav:prev', 'PREV MACHINE', C.white),
      b('nav:next', 'NEXT MACHINE', C.white),
      // 2 : choisir la voix (en marche : sans la jouer)
      ...VOICES8.map((i) => b(`rytm:pad:${i}`, i, C.yellow)),
      // 3 : les mutes
      ...VOICES8.map(mute),
      // 4 : CY et PC, les quatre premiers patterns
      mute('CY'),
      mute('PC'),
      b('rytm:pad:CY', 'CY', C.yellow),
      b('rytm:pad:PC', 'PC', C.yellow),
      ...Array.from({ length: 4 }, (_, i) => b(`rytm:ptn:${i}`, `PTN A${String(i + 1).padStart(2, '0')}`, C.blue)),
    ],
  };

  const ARP: RotoSetup = {
    name: 'ARP',
    slot: 12,
    ch: 2,
    knobs: [
      // 1 : l'arpegiateur, le volume
      v('rate', 'RATE', C.orange),
      v('mode', 'MODE', C.orange),
      v('range', 'RANGE', C.orange),
      v('notes', 'NOTES', C.orange),
      v('gate', 'GATE', C.orange),
      v('octave', 'OCTAVE', C.orange),
      v('glide', 'GLIDE', C.orange),
      v('volume', 'VOLUME', C.white),
      // 2 : le filtre, les sources (ses boutons : les accords)
      v('cutoff', 'CUTOFF', C.yellow),
      v('res', 'RESONANCE', C.yellow),
      v('envAmt', 'ENV AMOUNT', C.yellow),
      v('fmode', 'FILTER MODE', C.yellow),
      v('osc1', 'OSC 1 LEVEL', C.gold),
      v('osc2', 'OSC 2 LEVEL', C.gold),
      v('noise', 'NOISE', C.gold),
      v('fm', 'FM', C.gold),
      // 3 : les enveloppes
      v('fA', 'FLT ATTACK', C.green),
      v('fD', 'FLT DECAY', C.green),
      v('fS', 'FLT SUSTAIN', C.green),
      v('fR', 'FLT RELEASE', C.green),
      v('aA', 'AMP ATTACK', C.lime),
      v('aD', 'AMP DECAY', C.lime),
      v('aS', 'AMP SUSTAIN', C.lime),
      v('aR', 'AMP RELEASE', C.lime),
      // 4 : la modulation, les effets
      v('lfoRate', 'MOD SPEED', C.cyan),
      v('lfoShape', 'MOD SHAPE', C.cyan),
      v('lfoDest', 'MOD TARGET', C.cyan),
      v('lfoAmt', 'MOD DEPTH', C.cyan),
      v('dist', 'OVERDRIVE', C.purple),
      v('chorus', 'CHORUS', C.purple),
      v('delay', 'DELAY', C.purple),
      v('reverb', 'REVERB', C.purple),
    ],
    buttons: [
      // 1 : jouer
      tog('voy:running', 'RUN', C.red),
      b('voy:random', 'RANDOM', C.orange),
      b('voy:clear', 'CLEAR', C.orange),
      b('voy:edit', 'EDIT', C.yellow),
      b('voy:open', 'OPEN', C.orange),
      b('nav:machines', 'RYTM + ARP', C.red),
      b('nav:prev', 'PREV MACHINE', C.white),
      b('nav:next', 'NEXT MACHINE', C.white),
      // 2 : les accords, sous le filtre
      ...CHORD_NAMES.map((_, i) => chord(i)),
      // 3 : les oscillateurs
      tog('voy:knob:on1', 'OSC 1 ON', C.green),
      tog('voy:knob:on2', 'OSC 2 ON', C.green),
    ],
  };

  /** Une platine : son pitch, sa voie au mixer. */
  const deckKnobs = (d: 'a' | 'b', ch: 3 | 4, c: number): Ctl[] => {
    const D = d.toUpperCase();
    return [
      mid(dj(`${d}-pitch`, `PITCH ${D}`, c)),
      dj(`ch${ch}-fader`, `FADER ${D}`, C.white),
      mid(dj(`ch${ch}-gain`, `GAIN ${D}`, c)),
      mid(dj(`ch${ch}-hi`, `HI ${D}`, c)),
      mid(dj(`ch${ch}-mid`, `MID ${D}`, c)),
      mid(dj(`ch${ch}-low`, `LOW ${D}`, c)),
      mid(dj(`ch${ch}-filter`, `FILTER ${D}`, C.orange)),
      dj('master', 'MASTER', C.white),
    ];
  };
  const deckKeys = (d: 'a' | 'b', c: number): Ctl[] => {
    const D = d.toUpperCase();
    return [
      dj(`${d}-cue`, `CUE ${D}`, C.orange),
      dj(`${d}-play`, `PLAY ${D}`, C.yellow),
      dj(`${d}-sync`, `SYNC ${D}`, C.white),
      ...[1, 2, 3, 4].map((n) => dj(`${d}-hotcue${n}`, `HOT CUE ${n} ${D}`, c)),
      dj(`${d}-loop4`, `LOOP 4 ${D}`, C.green),
    ];
  };
  const deckMore = (d: 'a' | 'b', c: number): (Ctl | null)[] => {
    const D = d.toUpperCase();
    return [
      ...[1, 2, 8].map((n) => dj(`${d}-loop${n}`, `LOOP ${n} ${D}`, C.green)),
      dj(`${d}-bendm`, `BEND - ${D}`, c),
      dj(`${d}-bendp`, `BEND + ${D}`, c),
      dj(`${d}-tempom`, `PITCH - ${D}`, c),
      dj(`${d}-tempop`, `PITCH + ${D}`, c),
      dj('export', 'LOOP > SMPL', C.orange),
    ];
  };

  const DECK: RotoSetup = {
    name: 'DECK',
    slot: 13,
    ch: 3,
    knobs: [
      ...deckKnobs('a', 3, C.cyan),
      ...deckKnobs('b', 4, C.pink),
      // 3 : les effets de la table
      ...FX_PAGE,
      // 4 : le MM-RYTM et le MM-ARP sous les platines
      dj('ch1-fader', 'FADER RYTM', C.white),
      mid(dj('ch1-filter', 'FILTER RYTM', C.orange)),
      mid(dj('ch1-low', 'LOW RYTM', C.yellow)),
      mid(dj('ch1-hi', 'HI RYTM', C.yellow)),
      dj('ch2-fader', 'FADER ARP', C.white),
      mid(dj('ch2-filter', 'FILTER ARP', C.orange)),
      mid(dj('ch2-low', 'LOW ARP', C.gold)),
      mid(dj('ch2-hi', 'HI ARP', C.gold)),
    ],
    buttons: [...deckKeys('a', C.cyan), ...deckKeys('b', C.pink), ...deckMore('a', C.cyan), ...deckMore('b', C.pink)],
  };

  const MIXER: RotoSetup = {
    name: 'MIXER',
    slot: 14,
    ch: 4,
    knobs: [
      // 1 : les quatre faders, les quatre filtres
      ...MIX_PAGE,
      // 2 : RYTM et ARP
      mid(dj('ch1-hi', 'HI RYTM', C.yellow)),
      mid(dj('ch1-mid', 'MID RYTM', C.yellow)),
      mid(dj('ch1-low', 'LOW RYTM', C.yellow)),
      mid(dj('ch2-hi', 'HI ARP', C.gold)),
      mid(dj('ch2-mid', 'MID ARP', C.gold)),
      mid(dj('ch2-low', 'LOW ARP', C.gold)),
      mid(dj('ch1-gain', 'GAIN RYTM', C.yellow)),
      mid(dj('ch2-gain', 'GAIN ARP', C.gold)),
      // 3 : les platines
      mid(dj('ch3-hi', 'HI A', C.cyan)),
      mid(dj('ch3-mid', 'MID A', C.cyan)),
      mid(dj('ch3-low', 'LOW A', C.cyan)),
      mid(dj('ch4-hi', 'HI B', C.pink)),
      mid(dj('ch4-mid', 'MID B', C.pink)),
      mid(dj('ch4-low', 'LOW B', C.pink)),
      mid(dj('ch3-gain', 'GAIN A', C.cyan)),
      mid(dj('ch4-gain', 'GAIN B', C.pink)),
      // 4 : les effets
      ...FX_PAGE,
    ],
    buttons: [
      // 1 : ce qui joue
      tog('rytm:running', 'RUN RYTM', C.red),
      tog('voy:running', 'RUN ARP', C.red),
      dj('a-play', 'PLAY A', C.yellow),
      dj('b-play', 'PLAY B', C.yellow),
      dj('a-cue', 'CUE A', C.orange),
      dj('b-cue', 'CUE B', C.orange),
      b('nav:machines', 'RYTM + ARP', C.red),
      dj('export', 'LOOP > SMPL', C.orange),
      // 2 : les mutes du MM-RYTM, sous ses EQ
      ...LIVE_MUTES.map(mute),
      // 3 : les platines
      dj('a-sync', 'SYNC A', C.white),
      dj('b-sync', 'SYNC B', C.white),
      dj('a-loop4', 'LOOP 4 A', C.green),
      dj('b-loop4', 'LOOP 4 B', C.green),
      dj('adddeck', 'ADD DECK', C.white),
      b('nav:prev', 'PREV MACHINE', C.white),
      b('nav:next', 'NEXT MACHINE', C.white),
      b('nav:all', 'MM-STUDIO', C.white),
      // 4 : le temps des effets
      dj('time1', 'FX TIME 1/4', C.purple),
      dj('time2', 'FX TIME 1/2', C.purple),
      dj('time3', 'FX TIME 3/4', C.purple),
      dj('time4', 'FX TIME 1', C.purple),
      dj('time5', 'FX TIME 2', C.purple),
      dj('time6', 'FX TIME 4', C.purple),
    ],
  };

  const SMPL: RotoSetup = {
    name: 'SMPL',
    slot: 15,
    ch: 5,
    knobs: [
      // Page 1 : le son ; page 2 : les grains (2026-10-05 : SCAN, la vitesse de la tete, remplace SPREAD)
      k('smpl:knob:level', 'LEVEL', C.white),
      mid(k('smpl:knob:pitch', 'PITCH', C.white)),
      k('smpl:knob:start', 'START', C.yellow),
      k('smpl:knob:end', 'END', C.yellow),
      k('smpl:knob:attack', 'ATTACK', C.yellow),
      k('smpl:knob:release', 'RELEASE', C.yellow),
      mid(k('smpl:knob:filter', 'FILTER', C.orange)),
      null,
      k('smpl:knob:position', 'POSITION', C.cyan),
      mid(k('smpl:knob:scan', 'SCAN', C.cyan)),
      k('smpl:knob:size', 'GRAIN SIZE', C.cyan),
      k('smpl:knob:density', 'DENSITY', C.cyan),
      k('smpl:knob:spray', 'SPRAY', C.cyan),
    ],
    buttons: [
      b('smpl:key:rec', 'REC', C.red),
      b('smpl:key:play', 'PLAY', C.yellow),
      b('smpl:key:stop', 'STOP', C.white),
      b('smpl:key:file', 'FILE', C.white),
      b('smpl:key:slices', 'SLICES', C.orange),
      b('smpl:key:mode', 'MODE', C.orange),
      b('smpl:key:rev', 'REV', C.orange),
      b('smpl:key:loop', 'LOOP', C.orange),
      b('smpl:key:random', 'RANDOM', C.orange),
      b('smpl:key:clear', 'CLEAR', C.orange),
      b('smpl:key:edit', 'EDIT', C.yellow),
      b('smpl:key:save', 'SAVE', C.white),
      null,
      null,
      b('nav:prev', 'PREV MACHINE', C.white),
      b('nav:next', 'NEXT MACHINE', C.white),
      ...Array.from({ length: 16 }, (_, i) => b(`smpl:pad:${i}`, `TRIG ${i + 1}`, C.blue)),
    ],
  };

  /**
   * LIVE : l'essentiel de toutes les machines sur un seul setup (rien a
   * changer en jouant) ; page 1 la table et ce qui joue, page 2 le MM-RYTM
   * et ses mutes, page 3 le MM-ARP et ses accords, page 4 les effets.
   */
  const LIVE: RotoSetup = {
    name: 'LIVE',
    slot: 16,
    ch: 6,
    knobs: [
      ...MIX_PAGE,
      k('rytm:enc:swing', 'SWING', C.orange),
      mid(k('rytm:enc:stretch', 'STRETCH', C.orange)),
      k('rytm:enc:dist', 'RYTM DIST', C.purple),
      k('rytm:enc:delay', 'RYTM DELAY', C.purple),
      k('rytm:enc:reverb', 'RYTM REVERB', C.purple),
      mid(k('rytm:kit:tune', 'KICK TUNE', C.gold)),
      k('rytm:kit:decay', 'KICK DECAY', C.gold),
      k('rytm:kit:drive', 'KICK DRIVE', C.gold),
      v('cutoff', 'CUTOFF', C.yellow),
      v('res', 'RESONANCE', C.yellow),
      v('envAmt', 'ENV AMOUNT', C.yellow),
      v('fD', 'FLT DECAY', C.green),
      v('gate', 'ARP GATE', C.orange),
      v('rate', 'ARP RATE', C.orange),
      v('delay', 'ARP DELAY', C.purple),
      v('reverb', 'ARP REVERB', C.purple),
      ...FX_PAGE,
    ],
    buttons: [
      tog('rytm:running', 'RUN RYTM', C.red),
      tog('voy:running', 'RUN ARP', C.red),
      dj('a-play', 'PLAY A', C.yellow),
      dj('b-play', 'PLAY B', C.yellow),
      dj('a-cue', 'CUE A', C.orange),
      dj('b-cue', 'CUE B', C.orange),
      b('nav:machines', 'RYTM + ARP', C.red),
      dj('export', 'LOOP > SMPL', C.orange),
      ...LIVE_MUTES.map(mute),
      ...CHORD_NAMES.map((_, i) => chord(i)),
      dj('time1', 'FX TIME 1/4', C.purple),
      dj('time2', 'FX TIME 1/2', C.purple),
      dj('time4', 'FX TIME 1', C.purple),
      dj('time5', 'FX TIME 2', C.purple),
      b('smpl:key:play', 'SMPL PLAY', C.yellow),
      b('smpl:key:stop', 'SMPL STOP', C.white),
      b('nav:prev', 'PREV MACHINE', C.white),
      b('nav:next', 'NEXT MACHINE', C.white),
    ],
  };

  return [RYTM, ARP, DECK, MIXER, SMPL, LIVE];
}

/** Les setups (au chargement ; refaits au telechargement : rotoSetups). */
export const ROTO_SETUPS: readonly RotoSetup[] = buildSetups();
/** Les setups tels qu'a l'instant (le choix de son du kit avec tes samples). */
export const rotoSetups = (): readonly RotoSetup[] => buildSetups();
/** Le setup d'un canal du Roto (potards ou boutons), et la machine qu'il montre (LIVE : aucune). */
export function rotoSetupOfChannel(ch: number): RotoSetup | null {
  return ROTO_SETUPS.find((s) => s.ch === ch || s.ch + 8 === ch) ?? null;
}


/* ---------------- la table du site ---------------- */

/** Le message qu'envoie un controle : la cle du moteur MIDI (cc:canal:numero). */
const keyOf = (ch: number, n: number): string => `cc:${ch}:${rotoCc(n)}`;

const table = new Map<string, string>();
const knobKeys: string[] = [];
for (const s of ROTO_SETUPS) {
  s.knobs.forEach((c, n) => {
    if (!c) return;
    table.set(keyOf(s.ch, n), c.t);
    knobKeys.push(keyOf(s.ch, n));
  });
  s.buttons.forEach((c, n) => {
    if (c) table.set(keyOf(s.ch + 8, n), c.t);
  });
}

/** La cible d'un message du Roto (null : ce n'est pas un controle de ces setups). */
export const rotoTarget = (key: string): string | null => table.get(key) ?? null;
/** Les cles des controles qui recoivent les valeurs du site (potards, bascules), pour le retour vers le Roto. */
export const rotoFeedbackKeys = (): readonly string[] => [...table.keys()];
export const rotoKnobKeys = (): readonly string[] => knobKeys;

/* ---------------- les fichiers de ROTO-SETUP ---------------- */

const EMPTY_NAMES = Array.from({ length: 16 }, () => '');
const clip = (s: string): string => s.replace(/[^\x20-\x7e]/g, '').slice(0, 12);

/** Le setup au format des exports de ROTO-SETUP (un .json par setup, a importer sur le setup choisi). */
export function rotoSetupJson(s: RotoSetup): string {
  const knobs = s.knobs.flatMap((c, i) => {
    if (!c) return [];
    const st = c.steps && c.steps.length >= 2 && c.steps.length <= 16 ? c.steps : null;
    return [
      {
        controlIndex: i,
        controlMode: 0,
        controlChannel: s.ch,
        controlParam: rotoCc(i),
        nrpnAddress: 0,
        minValue: 0,
        maxValue: 127,
        controlName: clip(c.n),
        colorScheme: c.c,
        hapticMode: st ? 1 : 0,
        hapticIndent1: !st && c.center ? 64 : 255,
        hapticIndent2: 255,
        hapticSteps: st ? st.length : 0,
        stepNames: st ? [...st.map(clip), ...EMPTY_NAMES].slice(0, 16) : EMPTY_NAMES,
      },
    ];
  });
  const buttons = s.buttons.flatMap((c, i) => {
    if (!c) return [];
    return [
      {
        controlIndex: i,
        controlMode: 0,
        controlChannel: s.ch + 8,
        controlParam: rotoCc(i),
        nrpnAddress: 65535,
        minValue: 0,
        maxValue: 127,
        controlName: clip(c.n),
        colorScheme: c.c,
        ledOnColor: c.c,
        ledOffColor: C.off,
        hapticMode: c.toggle ? 1 : 0,
        hapticSteps: 0,
        stepNames: EMPTY_NAMES,
      },
    ];
  });
  return JSON.stringify({ version: 1, type: 'MIDI', name: s.name, index: s.slot - 1, knobs, buttons }, null, 2);
}

/* ---------------- un .zip des cinq (sans compression) ---------------- */

const CRC = (() => {
  const t = new Uint32Array(256);
  for (let n = 0; n < 256; n += 1) {
    let c = n;
    for (let k2 = 0; k2 < 8; k2 += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    t[n] = c >>> 0;
  }
  return t;
})();

function crc32(b: Uint8Array): number {
  let c = 0xffffffff;
  for (let i = 0; i < b.length; i += 1) c = CRC[(c ^ b[i]) & 0xff] ^ (c >>> 8);
  return (c ^ 0xffffffff) >>> 0;
}

/** Une archive .zip (methode "stored") des fichiers donnes. */
export function zipFiles(files: readonly { name: string; text: string }[]): Blob {
  const enc = new TextEncoder();
  const parts: Uint8Array[] = [];
  const central: Uint8Array[] = [];
  let offset = 0;
  for (const f of files) {
    const name = enc.encode(f.name);
    const data = enc.encode(f.text);
    const crc = crc32(data);
    const local = new Uint8Array(30 + name.length);
    const dv = new DataView(local.buffer);
    dv.setUint32(0, 0x04034b50, true);
    dv.setUint16(4, 20, true);
    dv.setUint16(8, 0, true);
    dv.setUint32(14, crc, true);
    dv.setUint32(18, data.length, true);
    dv.setUint32(22, data.length, true);
    dv.setUint16(26, name.length, true);
    local.set(name, 30);
    parts.push(local, data);
    const cen = new Uint8Array(46 + name.length);
    const cv = new DataView(cen.buffer);
    cv.setUint32(0, 0x02014b50, true);
    cv.setUint16(4, 20, true);
    cv.setUint16(6, 20, true);
    cv.setUint32(16, crc, true);
    cv.setUint32(20, data.length, true);
    cv.setUint32(24, data.length, true);
    cv.setUint16(28, name.length, true);
    cv.setUint32(42, offset, true);
    cen.set(name, 46);
    central.push(cen);
    offset += local.length + data.length;
  }
  const size = central.reduce((a, c) => a + c.length, 0);
  const end = new Uint8Array(22);
  const ev = new DataView(end.buffer);
  ev.setUint32(0, 0x06054b50, true);
  ev.setUint16(8, files.length, true);
  ev.setUint16(10, files.length, true);
  ev.setUint32(12, size, true);
  ev.setUint32(16, offset, true);
  return new Blob([...parts, ...central, end] as BlobPart[], { type: 'application/zip' });
}

/** Le nom de fichier d'un setup : MM RYTM (SETUP 11).json. */
export const rotoFileName = (s: RotoSetup): string => `MM ${s.name} (SETUP ${s.slot}).json`;
