/**
 * MM-VOYAGER (2026-10-03, demande de Mika) : les potards du synthe, leurs
 * valeurs (0 a 1) et leur traduction en son. Un petit store observable,
 * persiste sous mm.v4.voyager.1 (try/catch partout : navigation privee,
 * stockage plein, JSON corrompu, rien ne leve).
 *
 * Sections, facon Voyager : ARPEGGIATOR (RATE, MODE, RANGE, NOTES, GATE,
 * OCTAVE, sur le plateau), OSCILLATORS (WAVE 1, WAVE 2, TUNE 2, MIX, FINE,
 * GLIDE ; deux oscillateurs facon Typhon depuis le 2026-10-03), FILTER (CUTOFF, RES, ENV AMT),
 * deux enveloppes ADSR (FILTER EG et AMP EG), EFFECTS (OVERDRIVE, CHORUS, DELAY,
 * REVERB) et OUTPUT (VOLUME). Les potards a crans (RATE, MODE, RANGE,
 * NOTES, OCTAVE, RANGE, SEMI, ON...) gardent une valeur ronde : idx / (n - 1).
 *
 * NOTES (2026-10-03, Mika : "le choix du nombre de notes dans l'arp") : la
 * longueur du motif. ALL : toutes les notes de l'accord sur RANGE octaves,
 * dans l'ordre du MODE ; 1 a 8 : les N premieres de cette suite, puis le
 * motif reprend (au-dela de la suite, elle reboucle) ; 3 notes sur des
 * doubles croches tournent contre la mesure.
 *
 * FINE desaccorde les deux oscillateurs l'un contre l'autre, de part et
 * d'autre de la note : le centre reste juste, le son grossit sans jamais
 * sortir de la tonalite (la demande de Mika).
 *
 * 2026-10-04 (Mika : "il me faut les volumes des oscillators" et "trouve
 * quelque chose a rajouter dans la synthese pour avoir quelque chose de
 * different") : OSC 1 et OSC 2, le volume de chaque oscillateur (a la place
 * de MIX) ; MODE, le filtre multimode (LP 24, LP 12, BP, HP, a la place de
 * SLOPE) ; MOD, un LFO cale sur le tempo : SPEED (1/16 a 4 mesures), SHAPE
 * (triangle, dent de scie, carre, echantillonne-bloque), TARGET (les formes
 * d'onde, la coupure, la FM, la hauteur, ou formes et coupure) et DEPTH.
 *
 * Les oscillateurs facon Mini V (2026-10-04, Mika, une photo du panneau
 * d'oscillateurs du Mini V : "tu pourrais avoir les oscillateurs de cette
 * maniere") : une rangee par oscillateur, WAVEFORM, RANGE (LO, 32', 16',
 * 8', 4', 2' : de trois octaves dessous a deux dessus), SEMI (-7 a +7
 * demi-tons), FINE (-50 a +50 cents) et ON (le couper sans toucher a son
 * volume). Ils remplacent TUNE 2 et FINE (un desaccord de part et d'autre
 * de la note) : au depart OSC 1 en 8' et OSC 2 en 16', FINE a -8 et +8
 * cents, le son d'avant ; un reglage ou un preset d'avant se convertit
 * (migrateKnobs).
 */

export type VoyKnobId =
  | 'rate'
  | 'mode'
  | 'range'
  | 'notes'
  | 'gate'
  | 'wave1'
  | 'range1'
  | 'semi1'
  | 'fine1'
  | 'on1'
  | 'wave2'
  | 'range2'
  | 'semi2'
  | 'fine2'
  | 'on2'
  | 'osc1'
  | 'osc2'
  | 'fm'
  | 'ratio'
  | 'octave'
  | 'glide'
  | 'cutoff'
  | 'res'
  | 'envAmt'
  | 'noise'
  | 'fmode'
  | 'fA'
  | 'fD'
  | 'fS'
  | 'fR'
  | 'aA'
  | 'aD'
  | 'aS'
  | 'aR'
  | 'lfoRate'
  | 'lfoShape'
  | 'lfoDest'
  | 'lfoAmt'
  | 'dist'
  | 'chorus'
  | 'delay'
  | 'reverb'
  | 'volume'
  // TWEAKS (2026-10-04) : sous le capot, sur la carte (voyager/tweaks.ts)
  | 'phase'
  | 'drift'
  | 'width'
  | 'monoLow'
  | 'keyTrack'
  | 'accent'
  | 'sync'
  | 'duck'
  | 'chord';

export type VoySection = 'arp' | 'osc' | 'filter' | 'feg' | 'aeg' | 'mod' | 'fx' | 'out' | 'tweak';

export interface VoyKnob {
  id: VoyKnobId;
  /** nom a l'ecran (WAVE 1, RANGE 2...) ; aussi la serigraphie, sauf face */
  label: string;
  /** serigraphie quand elle differe (les rangees d'oscillateurs : WAVEFORM, RANGE, SEMI, FINE ; '' : rien) */
  face?: string;
  /** nom lu (jumeau, role slider) */
  aria: string;
  section: VoySection;
  /** valeur de depart (double tape) */
  def: number;
  /** crans nommes (RATE, MODE, RANGE) */
  steps?: readonly string[];
  /** morphing (WAVE 1 et 2, 2026-10-03, facon Typhon) : continu, ses crans ne sont que des reperes */
  morph?: boolean;
}

export const RATES = ['1/4', '1/8', '1/16', '1/32'] as const;
export const MODES = ['UP', 'DOWN', 'UP/DN', 'RAND'] as const;
export const RANGES = ['1 OCT', '2 OCT', '3 OCT'] as const;
export const OCTAVES = ['-2', '-1', '0', '+1', '+2'] as const;
/**
 * Deux oscillateurs facon Dreadbox Typhon (2026-10-03, Mika) : une forme
 * par cran, dessinee autour du selecteur. OSC 1 a la FM en dernier cran (sa
 * sinusoide modulee par OSC 2).
 */
export const WAVES1 = ['SINE', 'TRI', 'SAW', 'SQUARE', 'PULSE', 'FM'] as const;
export const WAVES2 = ['SINE', 'TRI', 'SAW', 'SQUARE', 'PULSE'] as const;
/** RANGE d'un oscillateur (pieds d'orgue, comme le Minimoog) et son decalage en demi-tons ; 8' : la note jouee. */
export const OSC_RANGES = ['LO', "32'", "16'", "8'", "4'", "2'"] as const;
const OSC_RANGE_SEMI = [-36, -24, -12, 0, 12, 24] as const;
/** SEMI : -7 a +7 demi-tons. */
export const SEMIS = ['-7', '-6', '-5', '-4', '-3', '-2', '-1', '0', '+1', '+2', '+3', '+4', '+5', '+6', '+7'] as const;
export const ON_OFF = ['OFF', 'ON'] as const;
/**
 * MODE du filtre (2026-10-04) : le passe-bas 24 dB du Moog (le filtre
 * d'origine, la position de depart ; nomme MOOG depuis que Mika ne le
 * retrouvait plus), passe-bas 12 dB, passe-bande, passe-haut.
 */
export const FMODES = ['MOOG', 'LP12', 'BP', 'HP'] as const;
/** MOD : la vitesse du LFO en duree d'un cycle, calee sur le tempo (en temps). */
export const LFO_RATES = ['1/16', '1/8', '1/4', '1/2', '1 BAR', '2 BAR', '4 BAR'] as const;
const LFO_BEATS = [0.25, 0.5, 1, 2, 4, 8, 16] as const;
export const LFO_SHAPES = ['TRI', 'SAW', 'SQR', 'S&H'] as const;
export const LFO_DESTS = ['WAVE', 'CUTOFF', 'FM', 'PITCH', 'W+CUT'] as const;
/** RATIO : frequence de l'operateur FM / OSC 1, des rapports harmoniques (le son reste dans la tonalite). */
export const RATIOS = ['1/2', '1', '3/2', '2', '3', '7/2', '4', '5', '7'] as const;
const RATIO_X = [0.5, 1, 1.5, 2, 3, 3.5, 4, 5, 7] as const;
export const NOTES = ['ALL', '1', '2', '3', '4', '5', '6', '7', '8'] as const;
/** CHORD : l'arpege d'avant (BASIC), puis les accords enchaines au plus pres, de la triade a la onzieme. */
export const CHORD_TYPES = ['BASIC', 'TRIAD', '7TH', '9TH', '11TH'] as const;

/** Dans l'ordre de lecture du panneau (et de tabulation des jumeaux). */
export const VOY_KNOBS: readonly VoyKnob[] = [
  { id: 'rate', label: 'RATE', aria: 'Arpeggiator rate', section: 'arp', def: 2 / 3, steps: RATES },
  { id: 'mode', label: 'MODE', aria: 'Arpeggiator mode', section: 'arp', def: 0, steps: MODES },
  { id: 'range', label: 'RANGE', aria: 'Arpeggiator range', section: 'arp', def: 0.5, steps: RANGES },
  { id: 'notes', label: 'NOTES', aria: 'Arpeggiator notes, how many before the pattern starts again', section: 'arp', def: 0, steps: NOTES },
  { id: 'gate', label: 'GATE', aria: 'Arpeggiator gate length', section: 'arp', def: 0.5 },
  // Les deux rangees d'oscillateurs (facon Mini V, 2026-10-04)
  { id: 'wave1', label: 'WAVE 1', face: 'WAVEFORM', aria: 'Oscillator 1 wave, morphs from sine to triangle, saw, square, pulse and FM', section: 'osc', def: 2 / 5, steps: WAVES1, morph: true },
  { id: 'range1', label: 'RANGE 1', face: 'RANGE', aria: "Oscillator 1 range: LO, 32, 16, 8, 4 or 2 feet; 8 feet plays the note", section: 'osc', def: 3 / 5, steps: OSC_RANGES },
  { id: 'semi1', label: 'SEMI 1', face: 'SEMI', aria: 'Oscillator 1 semitones, -7 to +7', section: 'osc', def: 0.5, steps: SEMIS },
  { id: 'fine1', label: 'FINE 1', face: 'FINE', aria: 'Oscillator 1 fine tune, -50 to +50 cents', section: 'osc', def: 0.42 },
  { id: 'on1', label: 'OSC 1', face: '', aria: 'Oscillator 1 on or off', section: 'osc', def: 1, steps: ON_OFF },
  { id: 'wave2', label: 'WAVE 2', face: 'WAVEFORM', aria: 'Oscillator 2 wave, morphs from sine to triangle, saw, square and pulse', section: 'osc', def: 2 / 4, steps: WAVES2, morph: true },
  { id: 'range2', label: 'RANGE 2', face: 'RANGE', aria: "Oscillator 2 range: LO, 32, 16, 8, 4 or 2 feet; 8 feet plays the note", section: 'osc', def: 2 / 5, steps: OSC_RANGES },
  { id: 'semi2', label: 'SEMI 2', face: 'SEMI', aria: 'Oscillator 2 semitones, -7 to +7', section: 'osc', def: 0.5, steps: SEMIS },
  { id: 'fine2', label: 'FINE 2', face: 'FINE', aria: 'Oscillator 2 fine tune, -50 to +50 cents', section: 'osc', def: 0.58 },
  { id: 'on2', label: 'OSC 2', face: '', aria: 'Oscillator 2 on or off', section: 'osc', def: 1, steps: ON_OFF },
  // 0.84 : 0.62 de gain chacun, le MIX au centre d'avant
  { id: 'osc1', label: 'OSC 1', aria: 'Oscillator 1 level', section: 'osc', def: 0.84 },
  { id: 'osc2', label: 'OSC 2', aria: 'Oscillator 2 level', section: 'osc', def: 0.84 },
  { id: 'fm', label: 'FM', aria: 'FM amount, a sine operator modulates oscillator 1, shaped by the filter envelope', section: 'osc', def: 0 },
  { id: 'ratio', label: 'RATIO', aria: 'FM ratio, the operator frequency against oscillator 1', section: 'osc', def: 1 / 8, steps: RATIOS },
  { id: 'octave', label: 'OCTAVE', aria: 'Octave', section: 'osc', def: 0.5, steps: OCTAVES },
  { id: 'glide', label: 'GLIDE', aria: 'Glide between notes', section: 'osc', def: 0 },
  { id: 'cutoff', label: 'CUTOFF', aria: 'Filter cutoff', section: 'filter', def: 0.5 },
  { id: 'res', label: 'RES', aria: 'Filter resonance', section: 'filter', def: 0.35 },
  { id: 'envAmt', label: 'ENV AMT', aria: 'Filter envelope amount', section: 'filter', def: 0.5 },
  { id: 'noise', label: 'NOISE', aria: 'Noise level into the filter', section: 'filter', def: 0 },
  { id: 'fmode', label: 'MODE', aria: 'Filter mode: Moog 24 dB low pass, 12 dB low pass, band pass, high pass; tap for the next', section: 'filter', def: 0, steps: FMODES },
  { id: 'fA', label: 'ATTACK', aria: 'Filter envelope attack', section: 'feg', def: 0 },
  { id: 'fD', label: 'DECAY', aria: 'Filter envelope decay', section: 'feg', def: 0.3 },
  { id: 'fS', label: 'SUSTAIN', aria: 'Filter envelope sustain', section: 'feg', def: 0.2 },
  { id: 'fR', label: 'RELEASE', aria: 'Filter envelope release', section: 'feg', def: 0.3 },
  { id: 'aA', label: 'ATTACK', aria: 'Amp envelope attack', section: 'aeg', def: 0 },
  { id: 'aD', label: 'DECAY', aria: 'Amp envelope decay', section: 'aeg', def: 0.35 },
  { id: 'aS', label: 'SUSTAIN', aria: 'Amp envelope sustain', section: 'aeg', def: 0.6 },
  { id: 'aR', label: 'RELEASE', aria: 'Amp envelope release', section: 'aeg', def: 0.3 },
  { id: 'lfoRate', label: 'SPEED', aria: 'Modulation speed, in time with the tempo', section: 'mod', def: 4 / 6, steps: LFO_RATES },
  { id: 'lfoShape', label: 'SHAPE', aria: 'Modulation shape: triangle, saw, square, sample and hold', section: 'mod', def: 0, steps: LFO_SHAPES },
  { id: 'lfoDest', label: 'TARGET', aria: 'Modulation target: wave, cutoff, FM, pitch, or wave and cutoff', section: 'mod', def: 0, steps: LFO_DESTS },
  { id: 'lfoAmt', label: 'DEPTH', aria: 'Modulation depth', section: 'mod', def: 0 },
  // OVERDRIVE (2026-10-04, Mika : "c'est pas DIST qu'on veut c'est OVERDRIVE") : l'id reste 'dist' (reglages et presets retenus)
  { id: 'dist', label: 'OVERDRIVE', aria: 'Overdrive', section: 'fx', def: 0 },
  { id: 'chorus', label: 'CHORUS', aria: 'Chorus', section: 'fx', def: 0.4 },
  { id: 'delay', label: 'DELAY', aria: 'Delay', section: 'fx', def: 0.25 },
  { id: 'reverb', label: 'REVERB', aria: 'Reverb', section: 'fx', def: 0.25 },
  { id: 'volume', label: 'VOLUME', aria: 'Synth volume', section: 'out', def: 0.75 },
  /*
   * TWEAKS (2026-10-04, Mika : "un bouton pour qu'on n'ait pas de probleme de
   * phase dans les low ; ca dephase pour l'impression d'analog, mais c'est un
   * peu trop intense ; dans OPEN, d'autres boutons pour changer certaines
   * choses ; je veux un super synth"). Sous le capot (OPEN), sur une plaque
   * vissee a la carte (voyager/tweaks.ts). Leurs valeurs de depart donnent le
   * son d'avant, au plus pres :
   * - PHASE : FREE (les oscillateurs tournent librement, chaque note part
   *   d'une phase au hasard) ou, au-dela, chaque note repart de la meme phase
   *   (0 a 360 deg) : des basses qui frappent pareil a chaque note ;
   * - DRIFT : la part d'analogique (derive lente, petits ecarts par note) ;
   *   0 : parfaitement stable, 5 : celle d'avant, 10 : le double ;
   * - WIDTH : l'ecart gauche / droite des notes (5 : celui d'avant) ;
   * - BASS MONO : sous cette frequence, le son reste au centre et ne passe ni
   *   par le chorus ni par les effets (OFF, ou 40 a 300 Hz) : plus de phase
   *   qui se balade dans les graves ;
   * - KEY TRACK : la coupure suit la note (5 : la moitie, celle d'avant) ;
   * - ACCENT : la force des accents de l'arpege (le "a" de chaque temps) ;
   * - SYNC : OSC 2 synchronise sur OSC 1 (hard sync), le son acide qui crie
   *   quand OSC 2 monte (RANGE, SEMI) ;
   * - SIDECHAIN (2026-10-04, Mika : "un knob sidechain automatique, qui
   *   s'adapte parfaitement au kick et a sa longueur dans MM-RYTM") : la
   *   sortie du MM-ARP (effets compris) s'efface a chaque kick et revient
   *   avec lui, selon l'enveloppe mesuree du kick joue (son, TUNE, DECAY,
   *   STRETCH, velocite) : audio/duck.ts. OFF a 0, jusqu'a -24 dB au coup.
   * - CHORD (2026-10-05, Mika : "je trouve les arpeges un peu grossiers, y
   *   a pas plus de notes qu'on peut mettre ?") : les notes de chaque
   *   accord (voyager/chords.ts voicedDegrees). BASIC, l'arpege d'avant (la
   *   triade depuis sa racine : D et E sautaient d'une sixte au-dessus de
   *   F#m) ; TRIAD, 7TH, 9TH, 11TH : les accords poses dans la meme octave
   *   (fa diese 3 a fa 4), chacun au plus pres du precedent, la septieme
   *   en plus, puis la neuvieme et la onzieme au-dessus. 7TH au depart ; un
   *   preset d'avant garde BASIC (state/presets.ts).
   */
  { id: 'phase', label: 'PHASE', aria: 'Oscillator phase at each note: free, or the same start phase every note', section: 'tweak', def: 0 },
  { id: 'drift', label: 'DRIFT', aria: 'Analog drift and the small differences between notes', section: 'tweak', def: 0.5 },
  { id: 'width', label: 'WIDTH', aria: 'Stereo width of the notes', section: 'tweak', def: 0.5 },
  { id: 'monoLow', label: 'BASS MONO', aria: 'Bass mono: below this frequency the sound stays centred and dry', section: 'tweak', def: 0 },
  { id: 'keyTrack', label: 'KEY TRACK', aria: 'Filter key tracking, the cutoff follows the note', section: 'tweak', def: 0.5 },
  { id: 'accent', label: 'ACCENT', aria: 'Arpeggio accent depth', section: 'tweak', def: 0.5 },
  { id: 'sync', label: 'SYNC', aria: 'Oscillator 2 hard synced to oscillator 1', section: 'tweak', def: 0, steps: ['OFF', 'ON'] },
  { id: 'duck', label: 'SIDECHAIN', aria: 'Sidechain: the synth ducks under every MM-RYTM kick, for as long as the kick lasts', section: 'tweak', def: 0 },
  {
    id: 'chord',
    label: 'CHORD',
    aria: 'Chord notes: basic root position triads, or voice-led triads, sevenths, ninths and elevenths',
    section: 'tweak',
    def: 0.5,
    steps: CHORD_TYPES,
  },
];

/** Les potards de la face (capot) et les TWEAKS (sous le capot, sur la carte : voyager/tweaks.ts). */
export const VOY_FACE_KNOBS: readonly VoyKnob[] = VOY_KNOBS.filter((k) => k.section !== 'tweak');
export const VOY_TWEAKS: readonly VoyKnob[] = VOY_KNOBS.filter((k) => k.section === 'tweak');

/** PHASE : sous ce seuil, FREE ; au-dessus, la phase de depart (0 a 1 cycle). */
export const PHASE_FREE = 0.04;
export const phaseStart = (v: number): number => (v < PHASE_FREE ? -1 : (v - PHASE_FREE) / (1 - PHASE_FREE));
/** SIDECHAIN : OFF sous 0.02, puis la baisse au coup du kick, jusqu'a 24 dB. */
export const DUCK_OFF = 0.02;
export const duckDepthDb = (v: number): number => (v < DUCK_OFF ? 0 : 24 * v);

/** BASS MONO : OFF sous 0.04, puis 40 a 300 Hz (exponentiel). */
export const monoLowHz = (v: number): number => (v < 0.04 ? 0 : 40 * Math.pow(7.5, (v - 0.04) / 0.96));

export const VOY_KNOB_IDS: readonly VoyKnobId[] = VOY_KNOBS.map((k) => k.id);
export const voyKnob = (id: VoyKnobId): VoyKnob => VOY_KNOBS.find((k) => k.id === id) as VoyKnob;

export type VoyValues = Record<VoyKnobId, number>;

const DEFAULTS = Object.fromEntries(VOY_KNOBS.map((k) => [k.id, k.def])) as VoyValues;

/** Index du cran d'un potard a crans. */
export const stepIndex = (id: VoyKnobId, v: number): number => {
  const s = voyKnob(id).steps;
  if (!s) return 0;
  return Math.max(0, Math.min(s.length - 1, Math.round(v * (s.length - 1))));
};

/** Valeur posee : bornee, et ronde sur un potard a crans (pas sur un morphing). */
function clean(id: VoyKnobId, v: number): number {
  const t = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : DEFAULTS[id];
  const k = voyKnob(id);
  return k.steps && !k.morph ? stepIndex(id, t) / (k.steps.length - 1) : Math.round(t * 1000) / 1000;
}

/** Position d'un morphing : 0 a (crans - 1), fractionnaire. */
export const morphPos = (id: VoyKnobId, v: number): number => v * ((voyKnob(id).steps?.length ?? 1) - 1);

/** Un morphing en mots : "SAW" sur un cran, "SAW>SQUARE 40%" entre deux. */
export function morphText(id: VoyKnobId, v: number): string {
  const s = voyKnob(id).steps ?? [];
  const pos = morphPos(id, v);
  const i = Math.round(pos);
  if (Math.abs(pos - i) < 0.04) return s[i] ?? '';
  const a = Math.floor(pos);
  return `${s[a]}>${s[a + 1]} ${Math.round((pos - a) * 100)}%`;
}

/* ---------------- traduction en son ---------------- */

/** Temps d'attaque : 1 ms a 2 s, exponentiel. */
export const attackS = (v: number): number => 0.001 * Math.pow(2000, v);
/** Decroissance : 5 ms a 2 s. */
export const decayS = (v: number): number => 0.005 * Math.pow(400, v);
/** Relachement : 5 ms a 3 s. */
export const releaseS = (v: number): number => 0.005 * Math.pow(600, v);
/** Coupure du filtre : 30 Hz a 19 kHz (9.3 octaves). */
export const cutoffHz = (v: number): number => 30 * Math.pow(2, v * 9.3);
/** Montee de l'enveloppe du filtre : 0 a 6 octaves au-dessus de la coupure. */
export const envOctaves = (v: number): number => v * 6;
/** Resonance du second etage (le Q des passe-bas Web Audio est en dB) : -3 a +20 dB. */
export const resDb = (v: number): number => -3 + v * 23;
/** Glissement entre deux notes (s) : jusqu'a 0.6 s, bien audible des le premier quart. */
export const glideS = (v: number): number => (v <= 0 ? 0 : 0.015 + v * v * 0.6);
/** FINE d'un oscillateur : -50 a +50 cents. */
export const fineCents = (v: number): number => (v - 0.5) * 100;
/** Duree d'une note de l'arpege, en fraction de l'intervalle entre deux notes. */
export const gateFrac = (v: number): number => 0.08 + 0.92 * v;
/** Pas de 16e par note : 1/4 = 4, 1/8 = 2, 1/16 = 1, 1/32 = 0.5. */
export const stepsPerNote = (v: number): number => [4, 2, 1, 0.5][stepIndex('rate', v)];
export const octaves = (v: number): number => stepIndex('range', v) + 1;
/** NOTES : longueur du motif (0 : ALL, toute la suite). */
export const notesCount = (v: number): number => stepIndex('notes', v);
/** CHORD : 0 BASIC, 1 TRIAD, 2 7TH, 3 9TH, 4 11TH. */
export const chordType = (v: number): number => stepIndex('chord', v);
/** OCTAVE : -2 a +2 octaves (le centre : l'octave d'origine). */
export const octaveShift = (v: number): number => stepIndex('octave', v) - 2;
/** Accord d'un oscillateur en demi-tons : RANGE (pieds) et SEMI. */
export const oscSemis = (range: number, semi: number): number => OSC_RANGE_SEMI[stepIndex('range1', range)] + stepIndex('semi1', semi) - 7;

/**
 * Un reglage d'avant les rangees d'oscillateurs (TUNE 2, FINE) : sa
 * traduction (RANGE 2 et SEMI 2, FINE 1 et 2), pour ce qui ne la porte
 * pas deja. TUNE 2 : -1 OCT, 0, 5TH, +1 OCT, +2 OCT ; FINE : 0 a 45 cents
 * d'ecart, de part et d'autre de la note.
 */
export function migrateKnobs(raw: Readonly<Record<string, unknown>>): Partial<Record<VoyKnobId, number>> {
  const out: Partial<Record<VoyKnobId, number>> = {};
  const t = raw.tune2;
  if (typeof t === 'number' && Number.isFinite(t) && raw.range2 === undefined && raw.semi2 === undefined) {
    const i = Math.max(0, Math.min(4, Math.round(t * 4)));
    out.range2 = [2, 3, 3, 4, 5][i] / 5;
    out.semi2 = (i === 2 ? 14 : 7) / 14;
  }
  const f = raw.fine;
  if (typeof f === 'number' && Number.isFinite(f) && raw.fine1 === undefined && raw.fine2 === undefined) {
    const half = (Math.max(0, Math.min(1, f)) * 45) / 2;
    out.fine1 = Math.round((0.5 - half / 100) * 1000) / 1000;
    out.fine2 = Math.round((0.5 + half / 100) * 1000) / 1000;
  }
  return out;
}
/** RATIO en multiple de la frequence d'OSC 1. */
export const fmRatio = (v: number): number => RATIO_X[stepIndex('ratio', v)];

/**
 * Les reglages du moteur (audio/moog.worklet.js), en unites physiques :
 * secondes, hertz, octaves. Envoyes au moteur a chaque changement.
 */
export interface EngineParams {
  /** formes : position du morphing dans WAVES1 (0 a 5) et WAVES2 (0 a 4), fractionnaire */
  wave1: number;
  wave2: number;
  /** chaque oscillateur : accord en demi-tons (RANGE et SEMI), FINE en cents, ON (0 ou 1) ; OSC 1 et OSC 2 : son gain (0.88 x potard au carre) */
  tune1: number;
  tune2: number;
  fine1: number;
  fine2: number;
  on1: number;
  on2: number;
  osc1: number;
  osc2: number;
  /** FM : 0 a 1 (l'indice suit l'enveloppe du filtre) ; RATIO : operateur / OSC 1 */
  fm: number;
  ratio: number;
  glide: number;
  cutoff: number;
  res: number;
  envOct: number;
  /** NOISE : 0 a 1 ; MODE : 0 LP 24, 1 LP 12, 2 BP, 3 HP */
  noise: number;
  fmode: number;
  fA: number;
  fD: number;
  fS: number;
  fR: number;
  aA: number;
  aD: number;
  aS: number;
  aR: number;
  drive: number;
  /** MOD : un cycle du LFO en temps, sa forme et sa cible (index), sa profondeur (0 a 1) */
  lfoBeats: number;
  lfoShape: number;
  lfoDest: number;
  lfoAmt: number;
  /** TWEAKS : phase de depart (-1 : libre), derive (0 a 2, 1 : celle d'avant), ecart stereo, suivi du clavier, hard sync (0 ou 1) */
  phase: number;
  drift: number;
  width: number;
  keyTrack: number;
  sync: number;
}

export function engineParams(v: Readonly<VoyValues>): EngineParams {
  return {
    wave1: morphPos('wave1', v.wave1),
    wave2: morphPos('wave2', v.wave2),
    tune1: oscSemis(v.range1, v.semi1),
    tune2: oscSemis(v.range2, v.semi2),
    fine1: fineCents(v.fine1),
    fine2: fineCents(v.fine2),
    on1: stepIndex('on1', v.on1),
    on2: stepIndex('on2', v.on2),
    osc1: 0.88 * v.osc1 * v.osc1,
    osc2: 0.88 * v.osc2 * v.osc2,
    fm: v.fm,
    ratio: fmRatio(v.ratio),
    glide: glideS(v.glide),
    cutoff: cutoffHz(v.cutoff),
    res: v.res,
    envOct: envOctaves(v.envAmt),
    noise: v.noise,
    fmode: stepIndex('fmode', v.fmode),
    fA: attackS(v.fA),
    fD: decayS(v.fD),
    fS: v.fS,
    fR: releaseS(v.fR),
    aA: attackS(v.aA),
    aD: decayS(v.aD),
    aS: v.aS,
    aR: releaseS(v.aR),
    drive: v.dist,
    lfoBeats: LFO_BEATS[stepIndex('lfoRate', v.lfoRate)],
    lfoShape: stepIndex('lfoShape', v.lfoShape),
    lfoDest: stepIndex('lfoDest', v.lfoDest),
    lfoAmt: v.lfoAmt,
    phase: phaseStart(v.phase),
    drift: 2 * v.drift,
    width: 0.44 * v.width,
    keyTrack: v.keyTrack,
    sync: stepIndex('sync', v.sync),
  };
}

/** Texte de l'ecran et du jumeau : CUTOFF 64%, RATE 1/16, MODE UP/DN. */
export function voyReadout(id: VoyKnobId, v: number): string {
  const k = voyKnob(id);
  if (id === 'phase' || id === 'monoLow' || id === 'fine1' || id === 'fine2' || id === 'duck') return `${k.label} ${voyValueText(id, v)}`;
  if (k.morph) return `${k.label} ${morphText(id, v)}`;
  if (k.steps) return `${k.label} ${k.steps[stepIndex(id, v)]}`;
  const sec = k.section === 'feg' ? 'F ' : k.section === 'aeg' ? 'A ' : '';
  return `${sec}${k.label} ${Math.round(v * 100)}%`;
}

/** Valeur lue d'un potard (jumeau) : "1/16", "64 %". */
export function voyValueText(id: VoyKnobId, v: number): string {
  const k = voyKnob(id);
  if (id === 'phase') return v < PHASE_FREE ? 'FREE' : `${Math.round(phaseStart(v) * 360)} DEG`;
  if (id === 'monoLow') return v < 0.04 ? 'OFF' : `${Math.round(monoLowHz(v))} HZ`;
  if (id === 'duck') return v < DUCK_OFF ? 'OFF' : `-${Math.round(duckDepthDb(v))} DB`;
  if (id === 'fine1' || id === 'fine2') {
    const c = Math.round(fineCents(v));
    return `${c > 0 ? '+' : ''}${c} CT`;
  }
  if (k.morph) return morphText(id, v);
  if (k.steps) return k.steps[stepIndex(id, v)];
  return `${Math.round(v * 100)} %`;
}

/* ---------------- store ---------------- */

export const VOY_STORAGE_KEY = 'mm.v4.voyager.1';
const SAVE_DEBOUNCE_MS = 300;

function load(): VoyValues {
  const out = { ...DEFAULTS };
  try {
    const text = window.localStorage.getItem(VOY_STORAGE_KEY);
    if (!text) return out;
    const raw = JSON.parse(text) as { v?: unknown; knobs?: Record<string, unknown> };
    if (raw.v !== 1 || !raw.knobs || typeof raw.knobs !== 'object') return out;
    // TUNE 2 et FINE d'avant les rangees d'oscillateurs : traduits
    const knobs: Record<string, unknown> = { ...raw.knobs, ...migrateKnobs(raw.knobs) };
    for (const id of VOY_KNOB_IDS) {
      const v = knobs[id];
      if (typeof v === 'number' && Number.isFinite(v) && v >= 0 && v <= 1) out[id] = clean(id, v);
    }
  } catch {
    /* stockage illisible : les valeurs de depart */
  }
  return out;
}

let values: VoyValues = typeof window === 'undefined' ? { ...DEFAULTS } : load();
let saveTimer = 0;
const listeners = new Set<() => void>();

function save(): void {
  window.clearTimeout(saveTimer);
  saveTimer = window.setTimeout(() => {
    saveTimer = 0;
    try {
      window.localStorage.setItem(VOY_STORAGE_KEY, JSON.stringify({ v: 1, knobs: values }));
    } catch {
      /* stockage plein ou bloque : la visite garde ses reglages */
    }
  }, SAVE_DEBOUNCE_MS);
}

export const voyParams = {
  get: (): Readonly<VoyValues> => values,
  of: (id: VoyKnobId): number => values[id],
  def: (id: VoyKnobId): number => DEFAULTS[id],
  /** true si la valeur a change. */
  set(id: VoyKnobId, v: number): boolean {
    const t = clean(id, v);
    if (t === values[id]) return false;
    values = { ...values, [id]: t };
    save();
    listeners.forEach((fn) => fn());
    return true;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Tests : tout aux valeurs de depart. */
  reset(): void {
    values = { ...DEFAULTS };
    save();
    listeners.forEach((fn) => fn());
  },
};
