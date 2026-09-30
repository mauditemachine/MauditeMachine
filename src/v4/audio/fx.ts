/**
 * Effets du bus (revision 2, spec 20.8), branches par drums.ts :
 *
 *   bus -> sec (1 - m) -----------------------------------> TONE -> LEVEL
 *   bus -> pre (D / K) -> WaveShaper -> mouille (m) -------> TONE      DIST
 *   LEVEL -> envoi (0.3 r) -> Convolver -> analyseur (avant master)    REVERB
 *
 * DIST : saturation parallele. Courbe tanh(K u) calculee une fois ; la
 * branche mouillee vaut tanh(D x) avec D = 1 + 5 d, melangee a m = d / 2.
 * A 0 : sec 1, mouille 0 et la branche debranchee : le signal d'origine,
 * la saturation ne calcule rien (0 = bypass). Avant TONE et LEVEL : LEVEL
 * reste un volume (baisser le niveau ne nettoie pas la saturation), TONE
 * adoucit les harmoniques qu'elle ajoute.
 * REVERB : un envoi apres LEVEL vers un ConvolverNode dont la reponse
 * (bruit stereo a decroissance exponentielle, 1.2 s, -60 dB a la fin, aigus
 * amortis) est generee une fois, au premier reglage au-dessus de 0 ; le
 * retour entre dans l'analyseur, avant le master (?mute=1 tient, le signal
 * reste mesurable). Mouille bas : 0.3 au maximum pour une reponse d'energie
 * unite.
 * Chaque reglage rejoint sa valeur en 20 ms ; une branche revenue a 0 se
 * debranche apres sa rampe (la queue de reverbe deja partie s'eteint seule).
 * Demontage de /v4 (silence) : le contexte va dormir, et un ConvolverNode
 * gele garde sa queue ; il est donc debranche et oublie (la reponse reste
 * en memoire), sinon la queue d'avant rejouerait au premier geste de la
 * visite suivante. Le prochain reglage au-dessus de 0 en rebranche un neuf.
 */

/** Rampe des reglages du bus (TONE, LEVEL, DIST, REVERB) : 20 ms, section 19 item 51. */
export const GLIDE_S = 0.02;

/** DIST : D = 1 + gain x d, melange m = mix x d, courbe tanh(k u) sur `points` valeurs (nombre impair : 0 exact au centre). */
const DRIVE = { gain: 5, mix: 0.5, k: 8, points: 2049 } as const;

/**
 * REVERB : longueur de la reponse (s), pre-delai, entree en fondu, envoi a
 * r = 1, passe-bas du bruit (Hz) du debut a la fin de la queue, graines.
 */
const REVERB = { seconds: 1.2, preDelay: 0.01, fadeIn: 0.003, send: 0.3, hiStart: 9000, hiEnd: 2500, seeds: [808, 909] } as const;

/** Une branche revenue a 0 se debranche apres sa rampe (20 ms) et une marge. */
const UNLINK_MS = 60;

/**
 * Rampe lineaire de 20 ms depuis une valeur posee a l'instant present.
 * Pas setTargetAtTime : Chrome calcule cette approche pas a pas sur les
 * blocs REELLEMENT rendus, et un noeud au repos (bus muet entre deux coups)
 * n'en rend aucun ; le premier coup apres un reglage partait alors avec
 * l'ancienne valeur (mesure a l'analyseur : CH plein pot juste apres TONE
 * a 0). Une rampe se calcule depuis ses deux points, rendu ou non.
 */
export function glide(p: AudioParam, target: number, c: BaseAudioContext): void {
  const now = c.currentTime;
  p.cancelScheduledValues(now);
  p.setValueAtTime(p.value, now);
  p.linearRampToValueAtTime(target, now + GLIDE_S);
}

/** PRNG a graine (mulberry32) : la meme reponse a chaque visite. */
function prng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** tanh(k u) pour u de -1 a 1 : l'entree du WaveShaper est pre-divisee par k. */
function driveCurve() {
  const n = DRIVE.points;
  const c = new Float32Array(n);
  for (let i = 0; i < n; i += 1) c[i] = Math.tanh(DRIVE.k * ((i / (n - 1)) * 2 - 1));
  return c;
}

/**
 * Reponse de la reverbe : deux canaux de bruit independants (stereo
 * decorrelee), passe-bas a un pole dont la coupure descend de 9 kHz a
 * 2.5 kHz (les aigus meurent avant les graves), enveloppe exponentielle a
 * -60 dB en fin de reponse, 10 ms de pre-delai, 3 ms d'entree en fondu (pas
 * de clic). Chaque canal ramene a une energie de 1 : le niveau ne depend
 * que de l'envoi, quel que soit le taux d'echantillonnage.
 */
function makeImpulse(c: BaseAudioContext): AudioBuffer {
  const sr = c.sampleRate;
  const n = Math.max(2, Math.round(REVERB.seconds * sr));
  const pre = Math.round(REVERB.preDelay * sr);
  const len = n - pre;
  const fade = Math.max(1, Math.round(REVERB.fadeIn * sr));
  const decay = Math.exp(Math.log(0.001) / len);
  const buf = c.createBuffer(2, n, sr);
  for (let ch = 0; ch < 2; ch += 1) {
    const d = buf.getChannelData(ch);
    const rnd = prng(REVERB.seeds[ch]);
    let y = 0;
    let a = 0;
    let env = 1;
    let energy = 0;
    for (let i = 0; i < len; i += 1) {
      // Coupure recalculee tous les 64 echantillons : assez lisse, peu couteux
      if ((i & 63) === 0) {
        const fc = REVERB.hiStart * Math.pow(REVERB.hiEnd / REVERB.hiStart, i / len);
        a = 1 - Math.exp((-2 * Math.PI * fc) / sr);
      }
      y += a * (rnd() * 2 - 1 - y);
      const v = y * env * (i < fade ? i / fade : 1);
      d[pre + i] = v;
      energy += v * v;
      env *= decay;
    }
    const g = energy > 0 ? 1 / Math.sqrt(energy) : 0;
    for (let i = pre; i < n; i += 1) d[i] *= g;
  }
  return buf;
}

export interface FxInfo {
  /** reglages appliques (0 a 1) */
  drive: number;
  reverb: number;
  /** branche mouillee de DIST branchee sur le bus */
  driveOn: boolean;
  /** envoi de REVERB branche apres LEVEL */
  reverbOn: boolean;
  /** duree de la reponse generee (s), 0 avant le premier usage */
  irSeconds: number;
  /** cout de la generation et du chargement de la reponse (ms), une fois */
  irMs: number;
  /** envois (drive, reverb) debranches depuis la creation */
  unlinks: number;
}

export interface FxChain {
  setDrive(d: number): void;
  setReverb(r: number): void;
  /** Demontage : la reverbe perd sa queue (convolueur debranche et oublie), l'etat applique revient a 0. */
  silence(): void;
  info(): FxInfo;
}

export interface FxPorts {
  /** sortie des voix */
  bus: AudioNode;
  /** passe-bas TONE : recoit le sec et le mouille de DIST */
  tone: AudioNode;
  /** gain LEVEL : source de l'envoi de REVERB */
  level: AudioNode;
  /** retour de REVERB : l'analyseur (avant le master) */
  out: AudioNode;
}

/** Branche DIST et REVERB sur le graphe de drums.ts, aux valeurs de depart (0 a 1). */
export function buildFx(c: BaseAudioContext, io: FxPorts, drive0: number, reverb0: number): FxChain {
  const dry = c.createGain();
  dry.gain.value = 1;
  const pre = c.createGain();
  pre.gain.value = 1 / DRIVE.k;
  const shaper = c.createWaveShaper();
  shaper.curve = driveCurve();
  // Pas de surechantillonnage : il retarde la branche mouillee de 1 a 2 ms
  // (filtres de reechantillonnage), et le melange avec le sec en parallele
  // creuserait un filtre en peigne ; les harmoniques d'un BD a 50-150 Hz
  // restent loin de Nyquist
  shaper.oversample = 'none';
  const wet = c.createGain();
  wet.gain.value = 0;
  io.bus.connect(dry);
  dry.connect(io.tone);
  pre.connect(shaper);
  shaper.connect(wet);
  wet.connect(io.tone);

  // REVERB : rien avant le premier usage ; la reponse survit a silence()
  let ir: AudioBuffer | null = null;
  let conv: ConvolverNode | null = null;
  let send: GainNode | null = null;
  let irSeconds = 0;
  let irMs = 0;

  let drive = 0;
  let reverb = 0;
  let driveOn = false;
  let reverbOn = false;
  let driveTimer: ReturnType<typeof setTimeout> | undefined;
  let reverbTimer: ReturnType<typeof setTimeout> | undefined;
  let unlinks = 0;

  const linkDrive = (): void => {
    clearTimeout(driveTimer);
    driveTimer = undefined;
    if (driveOn) return;
    io.bus.connect(pre);
    driveOn = true;
  };

  /**
   * Premier usage : la reponse, le convolueur et l'envoi ; ensuite l'envoi
   * seul se rebranche. Apres silence() : un convolueur neuf (vide) sur la
   * reponse gardee, sans la regenerer.
   */
  const linkReverb = (): void => {
    clearTimeout(reverbTimer);
    reverbTimer = undefined;
    let s = send;
    if (!s) {
      const t0 = performance.now();
      const first = !ir;
      const buf = ir ?? makeImpulse(c);
      ir = buf;
      const cv = c.createConvolver();
      // Energie deja ramenee a 1 : pas de normalisation propre au navigateur
      cv.normalize = false;
      cv.buffer = buf;
      if (first) {
        irMs = performance.now() - t0;
        irSeconds = buf.duration;
      }
      s = c.createGain();
      s.gain.value = 0;
      s.connect(cv);
      cv.connect(io.out);
      send = s;
      conv = cv;
    }
    if (reverbOn) return;
    io.level.connect(s);
    reverbOn = true;
  };

  const setDrive = (d: number): void => {
    if (d === drive) return;
    drive = d;
    if (d > 0) linkDrive();
    const m = DRIVE.mix * d;
    glide(dry.gain, 1 - m, c);
    glide(pre.gain, (1 + DRIVE.gain * d) / DRIVE.k, c);
    glide(wet.gain, m, c);
    if (d > 0 || !driveOn) return;
    clearTimeout(driveTimer);
    driveTimer = setTimeout(() => {
      driveTimer = undefined;
      if (drive > 0 || !driveOn) return;
      io.bus.disconnect(pre);
      driveOn = false;
      unlinks += 1;
    }, UNLINK_MS);
  };

  const setReverb = (r: number): void => {
    if (r === reverb) return;
    reverb = r;
    if (r > 0) linkReverb();
    if (send) glide(send.gain, REVERB.send * r, c);
    if (r > 0 || !reverbOn) return;
    clearTimeout(reverbTimer);
    reverbTimer = setTimeout(() => {
      reverbTimer = undefined;
      if (reverb > 0 || !reverbOn || !send) return;
      io.level.disconnect(send);
      reverbOn = false;
      unlinks += 1;
    }, UNLINK_MS);
  };

  const silence = (): void => {
    clearTimeout(reverbTimer);
    reverbTimer = undefined;
    if (send) {
      if (reverbOn) {
        io.level.disconnect(send);
        unlinks += 1;
      }
      send.disconnect();
      conv?.disconnect();
    }
    send = null;
    conv = null;
    reverbOn = false;
    // Reglage applique : aucun ; le store garde la valeur, drums.ts la
    // reapplique au prochain geste (un convolueur neuf)
    reverb = 0;
  };

  setDrive(drive0);
  setReverb(reverb0);

  return {
    setDrive,
    setReverb,
    silence,
    info: () => ({ drive, reverb, driveOn, reverbOn, irSeconds, irMs: Math.round(irMs * 100) / 100, unlinks }),
  };
}
