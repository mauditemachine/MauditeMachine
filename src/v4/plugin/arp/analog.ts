/**
 * Le son analogique du plugin MM-ARP (v43, 2026-11-20, Mika : "Tous les presets doivent sonner absolument parfait !
 * sans filtre pas trop aigu et que ca sonne putain ! que ca sonne vraiment bon synth analog ! evite les fx sur tous les
 * presets ! ou des filtres, si tu en utilises alors pas trop intense !").
 *
 * Les regles, en un seul endroit, pour la banque d'usine (plugin/mm-arp/presets/build.mjs et tests/presets-check.mjs
 * les verifient : un preset hors des regles ne s'ecrit pas) et pour RANDOM de la face (hypno.ts : analogTame borne le
 * tirage, ANALOG_FX_OFF_EXTRA coupe les effets du VST3 seul) :
 *
 * - AUCUN effet : OVERDRIVE / DISTO (dist), CHORUS, DELAY, REVERB, TAPE, GLUE, SIDECHAIN a l'arret ; dans le VST3 seul,
 *   WARMTH, PHASER, FLANGER, PUMP, CRUSH, SHIMMER, HELL, RING, FOLD, HIGH PASS et COMB a 0. Le son, c'est la voix : les
 *   oscillateurs, le SUB, le desaccord (FINE, STACK), LOAD, le filtre, les enveloppes, la derive.
 * - Le filtre : un passe-bas (MOOG, LP12 ou MS-10 ; jamais BP ni HP), ouvert a mi-ouvert (CUTOFF 0.25 a 0.6 : 150 Hz a
 *   1.6 kHz), RES 0.45 au plus, ENV AMT 0.5 au plus, et l'enveloppe ne l'ouvre jamais au-dela de 6 kHz (9.3 CUTOFF +
 *   6 ENV AMT <= 7.6, les lois de params.ts : cutoffHz, envOctaves) ; ACC FILTER 0.6 au plus ; une modulation de la
 *   coupure par le LFO de 0.25 au plus (3 x 0.25 = 3/4 d'octave de chaque cote).
 * - Pas trop aigu : OCTAVE 0 au plus, RANGE des oscillateurs 4' au plus, FM 0.2 au plus, NOISE 0.12 au plus, le
 *   vibrato (MOD vers PITCH) a 0.08 au plus ; SYNC seulement avec OSC 2 en 8' ou plus bas et le filtre a mi-course.
 *
 * Aucune dependance (ni DOM, ni store) : Node le lit tel quel (build.mjs, presets-check.mjs).
 */

/** Une valeur 0..1 par potard (VoyKnobId), ou par reglage du VST3 seul (extra-params.json). */
export type AnalogValues = Record<string, number>;

/** Les effets des potards, a l'arret (les crans : CHORUS OFF = 0). */
export const ANALOG_FX_OFF: Readonly<AnalogValues> = { dist: 0, chorus: 0, delay: 0, reverb: 0, tape: 0, glue: 0, duck: 0 };

/** Les effets et colorations du VST3 seul, a l'arret (MIX, profondeur ou quantite a 0 : contournes au bit pres). */
export const ANALOG_FX_OFF_EXTRA: Readonly<AnalogValues> = {
  xWarmth: 0,
  xPhMix: 0,
  xFlMix: 0,
  xPumpDepth: 0,
  xCrushBits: 0,
  xCrushRate: 0,
  xShimmer: 0,
  xHellMix: 0,
  xRing: 0,
  xFold: 0,
  xHpf: 0,
  xComb: 0,
};

/** Les bornes du filtre et du registre (voir en tete). */
export const ANALOG = {
  /** les modes permis : MOOG (0), LP12 (0.25), MS-10 (0.5) ; BP (0.75) et HP (1) jamais */
  fmodeMax: 0.5,
  cutoffMin: 0.25,
  cutoffMax: 0.6,
  resMax: 0.45,
  envMax: 0.5,
  /** l'ouverture la plus haute : 9.3 CUTOFF + 6 ENV AMT (en octaves au-dessus de 30 Hz) ; 7.6 : 6 kHz */
  openMax: 7.6,
  accFltMax: 0.6,
  /** MOD (LFO 1) vers CUTOFF ou W+CUT, et le LFO 2 / la seconde cible du LFO 1 vers CUTOFF ou RES */
  lfoCutMax: 0.25,
  /** MOD vers PITCH (100 cents x DEPTH) */
  lfoPitchMax: 0.08,
  /** OCTAVE 0 (le cran du milieu) au plus */
  octaveMax: 0.5,
  /** RANGE 4' au plus */
  rangeMax: 0.8,
  fmMax: 0.2,
  noiseMax: 0.12,
} as const;

/** L'ouverture la plus haute du filtre, en Hz (cutoffHz x 2^envOctaves, sans le suivi de clavier ni l'accent). */
export const analogOpenHz = (cutoff: number, envAmt: number): number => 30 * Math.pow(2, 9.3 * cutoff + 6 * envAmt);

const r3 = (v: number): number => Math.round(v * 1000) / 1000;
const clamp = (v: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, v));
/** LFO 1 (MOD) : TARGET, cinq crans (WAVE, CUTOFF, FM, PITCH, W+CUT). */
const lfoDestIdx = (v: number): number => Math.round(clamp(v, 0, 1) * 4);

/**
 * Ce qui sort des regles dans des potards (et, s'ils sont donnes, des reglages du VST3 seul) : une liste vide, c'est
 * un son analogique sans effet. Les valeurs absentes ne sont pas jugees.
 */
export function analogFaults(knobs: AnalogValues, extra?: AnalogValues, steps?: Readonly<Record<string, readonly string[]>>): string[] {
  const out: string[] = [];
  const has = (id: string): boolean => typeof knobs[id] === 'number';
  for (const [id, v] of Object.entries(ANALOG_FX_OFF)) if (has(id) && knobs[id] !== v) out.push(`${id} ${knobs[id]} : les effets restent a l'arret`);
  if (has('fmode') && knobs.fmode > ANALOG.fmodeMax) out.push(`MODE du filtre ${knobs.fmode} : un passe-bas (MOOG, LP12, MS-10)`);
  if (has('cutoff') && (knobs.cutoff < ANALOG.cutoffMin || knobs.cutoff > ANALOG.cutoffMax)) out.push(`CUTOFF ${knobs.cutoff} hors de ${ANALOG.cutoffMin}..${ANALOG.cutoffMax}`);
  if (has('res') && knobs.res > ANALOG.resMax) out.push(`RES ${knobs.res} > ${ANALOG.resMax}`);
  if (has('envAmt') && knobs.envAmt > ANALOG.envMax) out.push(`ENV AMT ${knobs.envAmt} > ${ANALOG.envMax}`);
  if (has('cutoff') && has('envAmt') && 9.3 * knobs.cutoff + 6 * knobs.envAmt > ANALOG.openMax + 1e-9)
    out.push(`le filtre s'ouvre a ${Math.round(analogOpenHz(knobs.cutoff, knobs.envAmt))} Hz (6000 au plus)`);
  if (has('accFlt') && knobs.accFlt > ANALOG.accFltMax) out.push(`ACC FILTER ${knobs.accFlt} > ${ANALOG.accFltMax}`);
  if (has('lfoDest') && has('lfoAmt')) {
    const d = lfoDestIdx(knobs.lfoDest);
    if ((d === 1 || d === 4) && knobs.lfoAmt > ANALOG.lfoCutMax) out.push(`MOD vers la coupure ${knobs.lfoAmt} > ${ANALOG.lfoCutMax}`);
    if (d === 3 && knobs.lfoAmt > ANALOG.lfoPitchMax) out.push(`MOD vers PITCH ${knobs.lfoAmt} > ${ANALOG.lfoPitchMax}`);
  }
  if (has('octave') && knobs.octave > ANALOG.octaveMax) out.push(`OCTAVE ${knobs.octave} : 0 au plus`);
  for (const id of ['range1', 'range2']) if (has(id) && knobs[id] > ANALOG.rangeMax) out.push(`${id} ${knobs[id]} : 4' au plus`);
  if (has('fm') && knobs.fm > ANALOG.fmMax) out.push(`FM ${knobs.fm} > ${ANALOG.fmMax}`);
  if (has('noise') && knobs.noise > ANALOG.noiseMax) out.push(`NOISE ${knobs.noise} > ${ANALOG.noiseMax}`);
  if (has('sync') && knobs.sync >= 0.5 && ((knobs.range2 ?? 0.6) > 0.6 || (knobs.cutoff ?? 0.5) > 0.5)) out.push("SYNC : OSC 2 en 8' au plus et CUTOFF 0.5 au plus");
  if (extra) {
    for (const [id, v] of Object.entries(ANALOG_FX_OFF_EXTRA)) if (typeof extra[id] === 'number' && extra[id] !== v) out.push(`${id} ${extra[id]} : les effets restent a l'arret`);
    // le LFO 2 et la seconde cible du LFO 1 (leurs crans, extra-params.json) : la coupure et la resonance tenues
    const name = (id: string): string => {
      const s = steps?.[id];
      return s && typeof extra[id] === 'number' ? s[Math.round(extra[id] * (s.length - 1))] : '';
    };
    const dests: [string, string][] = [
      ['xLfo2Dest', 'xLfo2Depth'],
      ['xLfo1Dest2', 'xLfo1Depth2'],
    ];
    for (const [dest, depth] of dests) {
      const n = name(dest);
      if ((n === 'CUTOFF' || n === 'RES') && extra[depth] > ANALOG.lfoCutMax) out.push(`${dest} ${n} ${extra[depth]} > ${ANALOG.lfoCutMax}`);
      if (n === 'PITCH' && extra[depth] > ANALOG.lfoPitchMax) out.push(`${dest} PITCH ${extra[depth]} > ${ANALOG.lfoPitchMax}`);
    }
  }
  return out;
}

/* ---------------- RANDOM : un son analogique par famille ---------------- */

export type AnalogFamily = 'BASS' | 'ARP' | 'PAD' | 'DARK';
type Rnd = () => number;

const between = (rnd: Rnd, lo: number, hi: number): number => r3(lo + rnd() * (hi - lo));
const chance = (rnd: Rnd, p: number): boolean => rnd() < p;
const pick = <T>(rnd: Rnd, xs: readonly T[]): T => xs[Math.min(xs.length - 1, Math.floor(rnd() * xs.length))];
/** Un cran (i / (n - 1)) tire selon ses poids. */
function weighted(rnd: Rnd, weights: readonly number[]): number {
  const total = weights.reduce((a, b) => a + b, 0);
  let r = rnd() * total;
  for (let i = 0; i < weights.length; i += 1) {
    r -= weights[i];
    if (r <= 0) return i / (weights.length - 1);
  }
  return 1;
}
// Les crans des potards (params.ts) : WAVE 1 (SINE TRI SAW SQUARE PULSE FM), WAVE 2 (SINE TRI SAW SQUARE PULSE),
// RANGE (LO 32' 16' 8' 4' 2'), OCTAVE (-2 -1 0 +1 +2), SUB WAVE (SINE TRI SQUARE), MOD (SPEED, SHAPE, TARGET)
const W1 = { TRI: 0.2, SAW: 0.4, SQUARE: 0.6 };
const W2 = { TRI: 0.25, SAW: 0.5, SQUARE: 0.75 };
const FEET16 = 0.4;
const FEET8 = 0.6;
const OCT_M1 = 0.25;
const OCT_0 = 0.5;
const SUB_SINE = 0;
const SUB_TRI = 0.5;
const LFO_RATE = { '1 BAR': 4 / 6, '2 BAR': 5 / 6, '4 BAR': 1 };
const LFO_SHAPE = { TRI: 0, RND: 0.5, SH: 1 };
const LFO_DEST = { WAVE: 0, CUTOFF: 0.25, PITCH: 0.75 };
/** FINE de part et d'autre de la note (cents) : le desaccord des deux oscillateurs. */
const detune = (rnd: Rnd, lo: number, hi: number): AnalogValues => {
  const c = between(rnd, lo, hi);
  return { fine1: r3(0.5 - c / 100), fine2: r3(0.5 + c / 100) };
};
/** Le MOD (LFO 1) : une fois sur n, une coupure qui respire lentement, une largeur d'impulsion, un vibrato. */
function slowMod(rnd: Rnd, p: number, wave: boolean): AnalogValues {
  if (!chance(rnd, p)) return { lfoAmt: 0 };
  if (wave && chance(rnd, 0.4)) return { lfoDest: LFO_DEST.WAVE, lfoRate: pick(rnd, [LFO_RATE['1 BAR'], LFO_RATE['2 BAR'], LFO_RATE['4 BAR']]), lfoShape: LFO_SHAPE.TRI, lfoAmt: between(rnd, 0.15, 0.35) };
  return { lfoDest: LFO_DEST.CUTOFF, lfoRate: pick(rnd, [LFO_RATE['2 BAR'], LFO_RATE['4 BAR']]), lfoShape: pick(rnd, [LFO_SHAPE.TRI, LFO_SHAPE.RND]), lfoAmt: between(rnd, 0.08, 0.2) };
}

/**
 * RANDOM du plugin (v43) : le son d'une famille, tire dans les plages de la banque d'usine (presets/build.mjs). Tout ce
 * qui fait le son est pose (aucun reglage ne reste du son d'avant) : oscillateurs, melangeur, SUB, filtre, enveloppes,
 * MOD, derive et largeur ; les effets a l'arret ; analogTame borne le tout. Ne touche ni au tempo de l'arpege, ni a la
 * suite, ni au VOLUME (RANDOM ne fait jamais sauter le niveau) ; GATE pour les basses et les nappes seulement.
 * - BASS : OCTAVE -1, une scie, un carre ou une impulsion, souvent un second oscillateur a l'octave dessous et un SUB,
 *   un passe-bas a mi-course qui claque, des enveloppes courtes, au centre ;
 * - ARP : le medium (OCTAVE -1 ou 0), deux oscillateurs desaccordes, un pincement du filtre, un peu de largeur ;
 * - PAD : attaques et relachements doux, deux scies ou triangles empilees et ecartees, filtre presque tenu ;
 * - DARK : le Korg ou le Moog plus fermes, carres et impulsions, de la derive, une coupure qui bouge.
 */
export function analogRandom(fam: AnalogFamily, rnd: Rnd): AnalogValues {
  const common: AnalogValues = { ...ANALOG_FX_OFF, glide: 0, fm: 0, ratio: 1 / 8, noise: 0, sync: 0, stack: 0, wide: 0, space: 0, fpol: 0, load: 0, range1: FEET8, semi1: 0.5, semi2: 0.5 };
  if (fam === 'BASS') {
    const two = chance(rnd, 0.55);
    return {
      ...common,
      octave: OCT_M1,
      gate: between(rnd, 0.38, 0.6),
      wave1: pick(rnd, [W1.SAW, W1.SAW, W1.SQUARE, between(rnd, 0.62, 0.76), between(rnd, 0.34, 0.4)]),
      osc1: between(rnd, 0.8, 0.95),
      wave2: pick(rnd, [W2.SAW, W2.SQUARE]),
      range2: chance(rnd, 0.4) ? FEET16 : FEET8,
      osc2: two ? between(rnd, 0.3, 0.55) : 0,
      ...detune(rnd, 2, 9),
      sub: chance(rnd, 0.5) ? between(rnd, 0.2, 0.4) : 0,
      subOct: 0,
      subWave: pick(rnd, [SUB_SINE, SUB_SINE, SUB_TRI]),
      fmode: weighted(rnd, [0.6, 0.25, 0.15]) * 0.5,
      cutoff: between(rnd, 0.46, 0.6),
      res: between(rnd, 0.12, 0.4),
      envAmt: between(rnd, 0.25, 0.4),
      keyTrack: between(rnd, 0.4, 0.6),
      fA: 0,
      fD: between(rnd, 0.28, 0.45),
      fS: between(rnd, 0, 0.3),
      fR: between(rnd, 0.15, 0.3),
      aA: 0,
      aD: between(rnd, 0.38, 0.55),
      aS: between(rnd, 0.35, 0.65),
      aR: between(rnd, 0.12, 0.25),
      accent: between(rnd, 0.45, 0.65),
      accFlt: between(rnd, 0.3, 0.55),
      phase: between(rnd, 0.1, 0.35),
      drift: between(rnd, 0.2, 0.4),
      width: between(rnd, 0.1, 0.3),
      monoLow: between(rnd, 0.4, 0.55),
      load: chance(rnd, 0.5) ? between(rnd, 0.1, 0.35) : 0,
      ...slowMod(rnd, 0.4, true),
    };
  }
  if (fam === 'ARP') {
    return {
      ...common,
      octave: chance(rnd, 0.2) ? OCT_M1 : OCT_0,
      range: 0,
      wave1: pick(rnd, [W1.SAW, W1.SQUARE, between(rnd, 0.62, 0.75), between(rnd, 0.26, 0.36)]),
      osc1: between(rnd, 0.82, 0.95),
      wave2: pick(rnd, [W2.SAW, W2.SQUARE, W2.TRI]),
      range2: FEET8,
      osc2: chance(rnd, 0.7) ? between(rnd, 0.35, 0.65) : 0,
      ...detune(rnd, 4, 10),
      sub: 0,
      fm: chance(rnd, 0.15) ? between(rnd, 0.08, 0.18) : 0,
      ratio: pick(rnd, [1 / 8, 3 / 8, 4 / 8]),
      fmode: weighted(rnd, [0.5, 0.4, 0.1]) * 0.5,
      cutoff: between(rnd, 0.48, 0.6),
      res: between(rnd, 0.1, 0.38),
      envAmt: between(rnd, 0.2, 0.36),
      keyTrack: between(rnd, 0.5, 0.7),
      fA: 0,
      fD: between(rnd, 0.25, 0.5),
      fS: between(rnd, 0, 0.35),
      fR: between(rnd, 0.2, 0.35),
      aA: 0,
      aD: between(rnd, 0.4, 0.6),
      aS: between(rnd, 0.25, 0.5),
      aR: between(rnd, 0.2, 0.4),
      accent: between(rnd, 0.4, 0.6),
      accFlt: between(rnd, 0.3, 0.5),
      phase: 0,
      drift: between(rnd, 0.25, 0.45),
      width: between(rnd, 0.3, 0.6),
      monoLow: 0,
      stack: chance(rnd, 0.25) ? between(rnd, 0.1, 0.25) : 0,
      wide: chance(rnd, 0.25) ? between(rnd, 0.2, 0.4) : 0,
      ...slowMod(rnd, 0.45, true),
    };
  }
  if (fam === 'PAD') {
    return {
      ...common,
      octave: chance(rnd, 0.3) ? OCT_M1 : OCT_0,
      rate: chance(rnd, 0.6) ? 1 / 3 : 0,
      gate: between(rnd, 0.85, 0.95),
      wave1: pick(rnd, [W1.SAW, W1.TRI, W1.SQUARE, between(rnd, 0.26, 0.36)]),
      osc1: between(rnd, 0.6, 0.7),
      wave2: pick(rnd, [W2.SAW, W2.TRI]),
      range2: FEET8,
      osc2: between(rnd, 0.4, 0.6),
      ...detune(rnd, 6, 10),
      noise: chance(rnd, 0.2) ? between(rnd, 0.03, 0.06) : 0,
      sub: 0,
      fmode: weighted(rnd, [0.6, 0.4]) * 0.25,
      cutoff: between(rnd, 0.46, 0.56),
      res: between(rnd, 0.08, 0.25),
      envAmt: between(rnd, 0.1, 0.28),
      keyTrack: between(rnd, 0.4, 0.6),
      fA: between(rnd, 0.3, 0.55),
      fD: between(rnd, 0.55, 0.75),
      fS: between(rnd, 0.4, 0.7),
      fR: between(rnd, 0.45, 0.6),
      aA: between(rnd, 0.4, 0.6),
      aD: between(rnd, 0.6, 0.75),
      aS: between(rnd, 0.6, 0.85),
      aR: between(rnd, 0.45, 0.6),
      accent: between(rnd, 0.2, 0.35),
      accFlt: between(rnd, 0.1, 0.3),
      phase: 0,
      drift: between(rnd, 0.4, 0.6),
      width: between(rnd, 0.5, 0.75),
      monoLow: 0.3,
      stack: between(rnd, 0.2, 0.4),
      wide: between(rnd, 0.25, 0.5),
      ...slowMod(rnd, 0.5, false),
    };
  }
  return {
    ...common,
    octave: chance(rnd, 0.6) ? OCT_M1 : OCT_0,
    wave1: pick(rnd, [W1.SQUARE, between(rnd, 0.7, 0.78), W1.SAW]),
    osc1: between(rnd, 0.8, 0.92),
    wave2: pick(rnd, [W2.SQUARE, W2.SAW]),
    range2: chance(rnd, 0.5) ? FEET16 : FEET8,
    osc2: chance(rnd, 0.6) ? between(rnd, 0.35, 0.55) : 0,
    ...detune(rnd, 4, 9),
    noise: chance(rnd, 0.3) ? between(rnd, 0.02, 0.06) : 0,
    sub: chance(rnd, 0.4) ? between(rnd, 0.2, 0.35) : 0,
    subOct: 0,
    subWave: SUB_SINE,
    fmode: weighted(rnd, [0.4, 0.2, 0.4]) * 0.5,
    cutoff: between(rnd, 0.38, 0.52),
    res: between(rnd, 0.2, 0.4),
    envAmt: between(rnd, 0.2, 0.38),
    keyTrack: between(rnd, 0.4, 0.6),
    fA: 0,
    fD: between(rnd, 0.3, 0.55),
    fS: between(rnd, 0.1, 0.4),
    fR: between(rnd, 0.25, 0.5),
    aA: chance(rnd, 0.4) ? between(rnd, 0.2, 0.45) : 0,
    aD: between(rnd, 0.4, 0.65),
    aS: between(rnd, 0.35, 0.7),
    aR: between(rnd, 0.25, 0.5),
    accent: between(rnd, 0.4, 0.6),
    accFlt: between(rnd, 0.25, 0.45),
    phase: 0,
    drift: between(rnd, 0.4, 0.8),
    width: between(rnd, 0.3, 0.55),
    monoLow: 0.35,
    load: chance(rnd, 0.4) ? between(rnd, 0.1, 0.3) : 0,
    ...(chance(rnd, 0.6)
      ? { lfoDest: chance(rnd, 0.6) ? LFO_DEST.CUTOFF : LFO_DEST.WAVE, lfoRate: pick(rnd, [LFO_RATE['1 BAR'], LFO_RATE['2 BAR']]), lfoShape: pick(rnd, [LFO_SHAPE.SH, LFO_SHAPE.RND]), lfoAmt: between(rnd, 0.12, 0.22) }
      : { lfoAmt: 0 }),
  };
}

/**
 * Un tirage ramene dans les regles (RANDOM de la face) : les effets a l'arret, le filtre passe-bas et modere, le
 * registre tenu. Les potards absents restent absents, sauf les effets (toujours poses).
 */
export function analogTame(p: AnalogValues): AnalogValues {
  const o: AnalogValues = { ...p, ...ANALOG_FX_OFF };
  if (typeof o.fmode === 'number' && o.fmode > ANALOG.fmodeMax) o.fmode = 0;
  if (typeof o.cutoff === 'number') o.cutoff = r3(clamp(o.cutoff, ANALOG.cutoffMin, ANALOG.cutoffMax));
  if (typeof o.res === 'number') o.res = r3(Math.min(o.res, ANALOG.resMax));
  if (typeof o.envAmt === 'number') {
    let e = Math.min(o.envAmt, ANALOG.envMax);
    const c = o.cutoff ?? 0.5;
    if (9.3 * c + 6 * e > ANALOG.openMax) e = Math.max(0, (ANALOG.openMax - 9.3 * c) / 6);
    o.envAmt = Math.floor(e * 1000) / 1000;
  }
  if (typeof o.accFlt === 'number') o.accFlt = r3(Math.min(o.accFlt, ANALOG.accFltMax));
  if (typeof o.lfoDest === 'number' && typeof o.lfoAmt === 'number') {
    const d = lfoDestIdx(o.lfoDest);
    if (d === 1 || d === 4) o.lfoAmt = r3(Math.min(o.lfoAmt, ANALOG.lfoCutMax));
    if (d === 3) o.lfoAmt = r3(Math.min(o.lfoAmt, ANALOG.lfoPitchMax));
  }
  if (typeof o.octave === 'number') o.octave = Math.min(o.octave, ANALOG.octaveMax);
  for (const id of ['range1', 'range2']) if (typeof o[id] === 'number') o[id] = Math.min(o[id], ANALOG.rangeMax);
  if (typeof o.fm === 'number') o.fm = r3(Math.min(o.fm, ANALOG.fmMax));
  if (typeof o.noise === 'number') o.noise = r3(Math.min(o.noise, ANALOG.noiseMax));
  if (typeof o.sync === 'number' && o.sync >= 0.5 && ((o.range2 ?? 0.6) > 0.6 || (o.cutoff ?? 0.5) > 0.5)) o.sync = 0;
  return o;
}
