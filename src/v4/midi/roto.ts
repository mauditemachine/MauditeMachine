/**
 * Le Roto-Control tout regle (2026-10-05, Mika : "le MIDI LEARN fonctionne,
 * mais je voudrais que ce soit parametre en entier automatiquement sur le
 * Roto-Control ; j'ai Roto-Setup pour assigner toutes les touches, passe par
 * la pour tout configurer, mets de bonnes couleurs, les bonnes
 * denominations ; les machines sur le Roto devraient s'appeler RYTM, ARP,
 * DECK, MIXER, SMPL"). Un setup MIDI du Roto par machine (le MM-DECKS en
 * deux : ses platines, sa table ; le MM-SMPL est parti le 2026-10-07, son
 * sampler est dans chaque platine), et LIVE (2026-10-05, Mika : "le mieux
 * possible pour le jeu en live, je veux controler toutes les machines") :
 * la table, le MM-RYTM et ses mutes, le MM-ARP et ses accords, les effets,
 * sans changer de setup :
 * - chacun sur son canal : les potards sur 1 (RYTM), 2 (ARP), 3 (DECK),
 *   4 (MIXER), 5 (BASS, le MM-BASS du 2026-10-07, a la place du MM-SMPL),
 *   6 (LIVE), ses boutons sur le canal + 8 (9 a 14) ;
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
import { bassKnob, type BassKnobId } from '../bass/params';

export type RotoSetupName = 'RYTM' | 'ARP' | 'BASS' | 'DECK' | 'MIXER' | 'LIVE';

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
  /** la cible MIDI du site (midi/targets.ts, dj/midi.ts) */
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
/** Un potard du MM-BASS, ses crans nommes s'il en a. */
const bs = (id: BassKnobId, n: string, c: number): Ctl => k(`bass:knob:${id}`, n, c, bassKnob(id).names);

/* ---------------- les setups ---------------- */

/*
 * Une page du Roto montre huit potards ET huit boutons : chaque page va
 * ensemble (2026-10-05, Mika : "tout mappe de la meilleure maniere possible,
 * la plus efficace pour le jeu en live") ; un bouton qui a un etat (RUN, un
 * mute, OSC ON) est une bascule dont la LED suit le site ; un potard
 * bipolaire (EQ, FILTER, GAIN, PITCH, TONE, STRETCH, TUNE) a un cran au
 * milieu (sa valeur neutre).
 */

/** Les huit voix (2026-10-05 : plus de RS ni de PC), dans l'ordre des pads : une page du Roto les tient toutes. */
const VOICES8 = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'] as const;
const LIVE_MUTES = VOICES8;
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
const FX_TO: Ctl = { ...dj('fxto', 'FX TO', C.white), steps: ['ALL', 'RYTM', 'BASS', 'ARP', 'A', 'B'] };

/**
 * La table, ses cinq voies (2026-10-07 : 1 RYTM, 2 BASS, 3 ARP, 4 A, 5 B) :
 * les cinq faders et les filtres du MM-RYTM et des platines (la page 1 du
 * MIXER et du LIVE) ; les filtres du MM-BASS et du MM-ARP sont sur la page 2
 * du MIXER (et leur CUTOFF sur leur machine).
 */
const MIX_PAGE: readonly Ctl[] = [
  dj('ch1-fader', 'FADER RYTM', C.white),
  dj('ch2-fader', 'FADER BASS', C.white),
  dj('ch3-fader', 'FADER ARP', C.white),
  dj('ch4-fader', 'FADER A', C.white),
  dj('ch5-fader', 'FADER B', C.white),
  mid(dj('ch1-filter', 'FILTER RYTM', C.orange)),
  mid(dj('ch4-filter', 'FILTER A', C.orange)),
  mid(dj('ch5-filter', 'FILTER B', C.orange)),
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
      // 2 : la voix choisie (ses boutons la choisissent) : la rangee VOICE FX de la machine, dans son ordre
      // (2026-10-05 : SAMPLE a droite de VOLUME ; ses crans suivent la voix, il est continu sur le Roto)
      k('rytm:enc:vol', 'VOLUME', C.yellow),
      k('rytm:enc:vsound', 'SAMPLE', C.gold),
      mid(k('rytm:enc:tone', 'TONE', C.yellow)),
      k('rytm:enc:vdecay', 'DECAY', C.yellow),
      k('rytm:enc:vdist', 'V DIST', C.peach),
      k('rytm:enc:vchorus', 'V CHORUS', C.peach),
      k('rytm:enc:vdelay', 'V DELAY', C.peach),
      k('rytm:enc:vreverb', 'V REVERB', C.peach),
      // 3 : les volumes des voix (leurs boutons : leurs mutes)
      ...VOICES8.map((i) => k(`rytm:voice:${i}:level`, `${i} VOL`, C.cream)),
      // 4 : le kit (le son du kick, ses reglages, la caisse claire, les charleys)
      kitSound('bd', 'KICK SOUND'),
      mid(k('rytm:kit:tune', 'KICK TUNE', C.gold)),
      k('rytm:kit:attack', 'KICK ATTACK', C.gold),
      k('rytm:kit:decay', 'KICK DECAY', C.gold),
      k('rytm:kit:drive', 'KICK DRIVE', C.gold),
      kitSound('sd', 'SNARE SOUND'),
      k('rytm:kit:snappy', 'SNAPPY', C.gold),
      kitSound('hh', 'HATS SOUND'),
    ],
    buttons: [
      // 1 : jouer
      tog('rytm:running', 'RUN', C.red),
      b('rytm:random', 'RANDOM', C.orange),
      b('rytm:clear', 'CLEAR', C.orange),
      b('rytm:edit', 'EDIT', C.yellow),
      b('rytm:open', 'OPEN', C.orange),
      b('nav:machines', 'MACHINES', C.red),
      b('nav:prev', 'PREV MACHINE', C.white),
      b('nav:next', 'NEXT MACHINE', C.white),
      // 2 : choisir la voix (en marche : sans la jouer)
      ...VOICES8.map((i) => b(`rytm:pad:${i}`, i, C.yellow)),
      // 3 : les mutes
      ...VOICES8.map(mute),
      // 4 : les huit premiers patterns (un toucher joue, deux enchainent)
      ...Array.from({ length: 8 }, (_, i) => b(`rytm:ptn:${i}`, `PTN A${String(i + 1).padStart(2, '0')}`, C.blue)),
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
      b('nav:machines', 'MACHINES', C.red),
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
  const deckKnobs = (d: 'a' | 'b', ch: 4 | 5, c: number): Ctl[] => {
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
      // Le sampler de la platine (2026-10-07, a la place des hot cues)
      dj(`${d}-smpl-open`, `SMPL ${D}`, c),
      dj(`${d}-smpl-recdeck`, `REC DECK ${D}`, C.red),
      dj(`${d}-smpl-recmix`, `REC MIX ${D}`, C.red),
      dj(`${d}-smpl-play`, `SMPL PLAY ${D}`, C.yellow),
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
      b(`dj:smpl:${d}:mode`, `SMPL MODE ${D}`, C.orange),
    ];
  };

  /** Le sampler d'une platine : LEVEL, PITCH, FILTER, POSITION. */
  const smplKnobs = (d: 'a' | 'b', c: number): Ctl[] => {
    const D = d.toUpperCase();
    return [
      k(`dj:smpl:${d}:knob:level`, `SMPL LVL ${D}`, c),
      mid(k(`dj:smpl:${d}:knob:pitch`, `SMPL PITCH ${D}`, c)),
      mid(k(`dj:smpl:${d}:knob:filter`, `SMPL FLT ${D}`, C.orange)),
      k(`dj:smpl:${d}:knob:position`, `SMPL POS ${D}`, C.cyan),
    ];
  };

  const DECK: RotoSetup = {
    name: 'DECK',
    slot: 13,
    ch: 3,
    knobs: [
      ...deckKnobs('a', 4, C.cyan),
      ...deckKnobs('b', 5, C.pink),
      // 3 : les effets de la table
      ...FX_PAGE,
      // 4 : le sampler de chaque platine (2026-10-07 ; le MM-RYTM et le MM-ARP restent sur le MIXER)
      ...smplKnobs('a', C.cyan),
      ...smplKnobs('b', C.pink),
    ],
    buttons: [...deckKeys('a', C.cyan), ...deckKeys('b', C.pink), ...deckMore('a', C.cyan), ...deckMore('b', C.pink)],
  };

  const MIXER: RotoSetup = {
    name: 'MIXER',
    slot: 14,
    ch: 4,
    knobs: [
      // 1 : les cinq faders, les filtres du MM-RYTM et des platines
      ...MIX_PAGE,
      // 2 : les trois machines (2026-10-07) : les filtres du MM-BASS et du MM-ARP, HI et LOW de chacune
      mid(dj('ch2-filter', 'FILTER BASS', C.orange)),
      mid(dj('ch3-filter', 'FILTER ARP', C.orange)),
      mid(dj('ch1-hi', 'HI RYTM', C.yellow)),
      mid(dj('ch1-low', 'LOW RYTM', C.yellow)),
      mid(dj('ch2-hi', 'HI BASS', C.peach)),
      mid(dj('ch2-low', 'LOW BASS', C.peach)),
      mid(dj('ch3-hi', 'HI ARP', C.gold)),
      mid(dj('ch3-low', 'LOW ARP', C.gold)),
      // 3 : les platines
      mid(dj('ch4-hi', 'HI A', C.cyan)),
      mid(dj('ch4-mid', 'MID A', C.cyan)),
      mid(dj('ch4-low', 'LOW A', C.cyan)),
      mid(dj('ch5-hi', 'HI B', C.pink)),
      mid(dj('ch5-mid', 'MID B', C.pink)),
      mid(dj('ch5-low', 'LOW B', C.pink)),
      mid(dj('ch4-gain', 'GAIN A', C.cyan)),
      mid(dj('ch5-gain', 'GAIN B', C.pink)),
      // 4 : les effets
      ...FX_PAGE,
    ],
    buttons: [
      // 1 : ce qui joue (le MM-BASS depuis le 2026-10-07)
      tog('rytm:running', 'RUN RYTM', C.red),
      tog('bass:running', 'RUN BASS', C.red),
      tog('voy:running', 'RUN ARP', C.red),
      dj('a-play', 'PLAY A', C.yellow),
      dj('b-play', 'PLAY B', C.yellow),
      dj('a-cue', 'CUE A', C.orange),
      dj('b-cue', 'CUE B', C.orange),
      b('nav:machines', 'MACHINES', C.red),
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
      tog('bass:running', 'RUN BASS', C.red),
      tog('voy:running', 'RUN ARP', C.red),
      dj('a-play', 'PLAY A', C.yellow),
      dj('b-play', 'PLAY B', C.yellow),
      dj('a-cue', 'CUE A', C.orange),
      dj('b-cue', 'CUE B', C.orange),
      b('nav:machines', 'MACHINES', C.red),
      ...LIVE_MUTES.map(mute),
      ...CHORD_NAMES.map((_, i) => chord(i)),
      dj('time1', 'FX TIME 1/4', C.purple),
      dj('time2', 'FX TIME 1/2', C.purple),
      dj('time4', 'FX TIME 1', C.purple),
      dj('time5', 'FX TIME 2', C.purple),
      dj('a-smpl-play', 'SMPL PLAY A', C.yellow),
      dj('b-smpl-play', 'SMPL PLAY B', C.yellow),
      b('nav:prev', 'PREV MACHINE', C.white),
      b('nav:next', 'NEXT MACHINE', C.white),
    ],
  };

  /**
   * BASS (2026-10-07) : le MM-BASS sur le setup 15 (canal 5, celui du
   * MM-SMPL parti) ; page 1 le filtre de la TB-303 et RUN, GEN, MUTATE,
   * page 2 la voix et le generateur (les pas 1 a 8 dessous), page 3 la
   * gamme (les pas 9 a 16), page 4 les touches du pas choisi, LOCK et EDIT.
   * Les reglages fins sous le capot (2026-10-08) finissent la page 3 :
   * LENGTH, ACC DECAY, SWEEP, RELEASE, TUNE (SUB OCT, deux crans, reste au
   * capot) ; les potards 1 a 19 ne bougent pas (les mappings de Mika).
   */
  const BASS: RotoSetup = {
    name: 'BASS',
    slot: 15,
    ch: 5,
    knobs: [
      // 1 : le filtre
      bs('cutoff', 'CUTOFF', C.orange),
      bs('reso', 'RESO', C.orange),
      bs('envmod', 'ENV MOD', C.orange),
      bs('decay', 'DECAY', C.orange),
      bs('accent', 'ACCENT', C.red),
      bs('drive', 'DRIVE', C.purple),
      bs('sub', 'SUB', C.gold),
      bs('volume', 'VOLUME', C.white),
      // 2 : la voix, le generateur
      bs('wave', 'WAVE', C.gold),
      bs('glide', 'GLIDE', C.gold),
      bs('octave', 'OCTAVE', C.gold),
      bs('style', 'STYLE', C.yellow),
      bs('density', 'DENSITY', C.yellow),
      bs('slides', 'SLIDES', C.yellow),
      bs('accents', 'ACCENTS', C.yellow),
      bs('range', 'RANGE', C.yellow),
      // 3 : la gamme, le groove du MM-RYTM
      bs('root', 'ROOT', C.cyan),
      bs('scale', 'SCALE', C.cyan),
      k('rytm:enc:swing', 'SWING', C.white),
      // 3 (suite) : les reglages fins de la voix, comme leurs voisins de la page 1 et 2
      bs('length', 'LENGTH', C.gold),
      bs('accdecay', 'ACC DECAY', C.red),
      bs('sweep', 'SWEEP', C.red),
      bs('release', 'RELEASE', C.gold),
      bs('tune', 'TUNE', C.gold),
    ],
    buttons: [
      // 1 : jouer
      tog('bass:running', 'RUN', C.red),
      b('bass:key:gen', 'GEN', C.orange),
      b('bass:key:mutate', 'MUTATE', C.orange),
      b('bass:key:clear', 'CLEAR', C.orange),
      b('bass:key:accent', 'ACCENT', C.red),
      b('bass:key:slide', 'SLIDE', C.yellow),
      b('nav:prev', 'PREV MACHINE', C.white),
      b('nav:next', 'NEXT MACHINE', C.white),
      // 2 et 3 : les seize pas
      ...Array.from({ length: 16 }, (_, i) => b(`bass:trig:${i}`, `STEP ${i + 1}`, i < 8 ? C.orange : C.peach)),
      // 4 : le pas choisi, son LOCK (les potards ne changent que lui), EDIT (les patterns)
      b('bass:key:notedn', 'NOTE -', C.cyan),
      b('bass:key:noteup', 'NOTE +', C.cyan),
      b('bass:key:octdn', 'OCT -', C.cyan),
      b('bass:key:octup', 'OCT +', C.cyan),
      b('bass:lock', 'LOCK', C.yellow),
      b('bass:key:edit', 'EDIT', C.yellow),
      b('nav:machines', 'MACHINES', C.red),
      b('nav:all', 'MM-STUDIO', C.white),
    ],
  };

  return [RYTM, ARP, BASS, DECK, MIXER, LIVE];
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
