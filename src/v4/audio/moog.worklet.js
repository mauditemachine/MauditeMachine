/**
 * MM-VOYAGER : le moteur (AudioWorklet, 2026-10-03). Le plus pres possible
 * d'un Minimoog Voyager dans un navigateur, calcule echantillon par
 * echantillon :
 * - deux oscillateurs par note, facon Dreadbox Typhon (2026-10-03) : WAVE
 *   fait MORPHER chaque oscillateur d'une forme a la suivante (sinus,
 *   triangle, dent de scie, carre, impulsion ; OSC 1 finit sur la FM, sa
 *   sinusoide modulee par OSC 2) ; les formes ont toutes leur fondamentale
 *   en phase, le fondu de l'une a l'autre ne creuse jamais le son. Chaque
 *   oscillateur accorde par RANGE et SEMI, FINE a part (2026-10-04, facon
 *   Mini V ; TUNE 2 et l'ecart FINE avant), dose par son volume ; sans repliement
 *   (PolyBLEP) ; chaque oscillateur derive lentement (quelques cents, comme
 *   un VCO) ; l'operateur FM module les DEUX oscillateurs ;
 * - presque analogique (2026-10-03, Mika : "presque du analog") : chaque
 *   note a ses petits ecarts, comme les voix d'un vrai polyphonique (la
 *   coupure a +/- 2.8 %, les enveloppes a +/- 5 %, l'accord a +/- 1.5
 *   cent), et sa place dans l'image stereo (une note a gauche, la suivante
 *   a droite, de peu : WIDTH) ;
 * - le filtre en echelle 24 dB (quatre poles, retroaction resolue sans
 *   retard) a saturation DANS chaque etage, comme les transistors d'un
 *   Moog (la methode "cheap" de Mystran : chaque etage prend la pente de
 *   sa tangente hyperbolique au point de l'echantillon precedent, puis
 *   l'echelle se resout lineairement, sans retard) : les forts signaux
 *   arrondissent, la resonance s'auto-limite en chantant ; les graves
 *   fondent moins quand elle monte (BASS_KEEP) ; OVERDRIVE (DIST avant
 *   le 2026-10-04) pousse un peu son entree, puis chauffe la sortie
 *   (OD_GAIN, une Tube Screamer) ;
 * - deux enveloppes ADSR a courbes de condensateur (attaque vers 1.3,
 *   decroissance et relachement exponentiels), redeclenchees depuis leur
 *   niveau : jamais de clic ;
 * - GLIDE glisse depuis la note precedente en hauteur logarithmique.
 * TWEAKS (2026-10-04, sous le capot, Mika : "pas de probleme de phase dans
 * les low ; l'impression d'analog, mais un peu trop intense") :
 * - phase : -1, les oscillateurs tournent librement (chaque voix neuve part
 *   d'une phase au hasard, comme avant) ; 0 a 1, chaque note repart de
 *   cette phase, les trois oscillateurs ensemble : l'attaque est la meme a
 *   chaque note, la basse frappe toujours pareil. Seulement si la voix est
 *   (presque) muette : pas de clic sur une voix reprise en plein son ;
 * - drift : la part d'analogique (1 : celle d'avant) : derive lente des
 *   oscillateurs et petits ecarts par note (coupure, enveloppes, accord) ;
 *   0 : tout est stable et juste ;
 * - width : l'ecart stereo des notes (0.22 avant, SPREAD) ;
 * - keyTrack : la coupure suit la note (0.5 avant, KEY_TRACK) ;
 * - sync : OSC 2 repart a chaque cycle d'OSC 1 (hard sync) : il ne bat
 *   plus contre lui, son accord devient un timbre.
 * Les rangees d'oscillateurs facon Mini V (2026-10-04) : chaque oscillateur
 * a son accord (tune1, tune2 : RANGE et SEMI, en demi-tons) et son FINE
 * (fine1, fine2, en cents) ; ils remplacent TUNE 2 et l'ecart FINE de part
 * et d'autre de la note. Son ON (on1, on2, qui multipliait son gain) est
 * parti le 2026-10-11 (Mika : "si on veut pas les osc on coupe les
 * volumes") : osc1 ou osc2 a 0 le coupe, lisse de meme.
 * SUB (2026-10-10, Mika : "pour l'ARP rajoute un sub parametrable") : un
 * troisieme oscillateur, une ou deux octaves sous la note jouee (subOct : 1
 * ou 2), sinus, triangle ou carre (subWave : la forme 0, 1 ou 3), dose par
 * sub (lisse). Il suit la note (pas RANGE ni SEMI d'OSC 1), mais prend le
 * FINE et la derive d'OSC 1 : cale sur lui, il ne bat pas contre lui ; pas
 * de FM ni de SYNC (des graves propres) ; il passe par le filtre, comme les
 * autres. A 0, ni forme ni phase calculees (le son d'avant, au bit pres).
 * Jusqu'a 12 notes en meme temps (les queues de RELEASE se chevauchent) ;
 * au-dela, la plus ancienne repart de son niveau.
 * Notes recues avec leur instant (temps du contexte), jouees a
 * l'echantillon pres ; reglages lisses, sans craquement. Sortie stereo,
 * les effets suivent dans le graphe.
 *
 * Qualite (2026-10-03, Mika : "le son sortant de la meilleure qualite") :
 * tout le moteur tourne a OS fois la frequence du contexte (4 sur
 * ordinateur, 2 au telephone : processorOptions.os) ; les saturations
 * (entree du filtre, OVERDRIVE, sortie) ne replient presque plus leurs
 * harmoniques dans l'audible. Le retour a la frequence du contexte passe
 * par des filtres demi-bande en cascade (fenetre de Kaiser : 4x -> 2x en
 * 31 coefficients, 2x -> 1x en 63, environ -80 dB au-dessus de la bande
 * utile), calcules au demarrage.
 *
 * Le son revu (2026-10-21, audit, Mika : "je voudrais que tu ameliores le
 * son drastiquement sur ARP") :
 * - les pentes des etages du filtre se recalculent a CHAQUE echantillon
 *   surechantillonne (avant : une fois par echantillon du contexte, tenues
 *   x2 ou x4 : un echantillonneur-bloqueur a 48 kHz dans un chemin non
 *   lineaire, qui repliait autour de 48 kHz) ; la formule sans appel a
 *   nl() garde la meme courbure en petit signal (NL_K) : purete d'une scie
 *   C7 de 46 a 65 dB, l'auto-oscillation juste a quelques cents pres ;
 * - la resonance chante plus tot (resK : identique jusqu'a RES 0.7, puis
 *   plus raide ; l'auto-oscillation des RES 0.9 au lieu de 0.976) ;
 * - des bloqueurs de continu : sur la branche OVERDRIVE (sa courbe
 *   asymetrique fabriquait un decalage qui suivait chaque note) et sur la
 *   sortie du moteur (8 Hz, le couplage d'une vraie sortie de synthe) ;
 * - OVERDRIVE compense a l'oreille (OD_COMP, mesure) : il chauffe sans
 *   monter de 6 dB ; un ecreteur doux en sortie (au-dessus de -6 dBFS
 *   apres VOLUME, jamais au-dessus de -3) ;
 * - ACCENT ouvre aussi le filtre (accFlt, le TWEAK ACC FILTER : les notes
 *   appuyees brillent, les douces s'assombrissent, facon 303), le meme
 *   chemin servira a la velocite ;
 * - une vraie PWM entre SQUARE et PULSE, la SYNC et la FM sans repliement
 *   (BLEP a la remise de phase, pas instantane sous FM) ;
 * - une voix s'eteint a -66 dB (au lieu de -86), 8 voix au telephone, la
 *   voix volee est la plus discrete (et sa place stereo glisse en 4 ms : plus
 *   de tic) ;
 * - DRIFT plus vivant : une derive lente (quelques secondes), une moyenne,
 *   une gigue, et un etalonnage par voix tire une fois (comme les voix d'un
 *   vrai polyphonique), le meme ecart d'ensemble a DRIFT 5.
 *
 * Plus gras, plus large, plus colle (2026-10-22, audit P8 et P9, Mika : "je
 * voudrais que tu ameliores le son drastiquement sur ARP") ; chacun a 0 rend
 * le son d'avant au bit pres, celui du moteur du 2026-10-21
 * (scripts/arp-bench.mjs --against le verifie ; pas celui de la prod d'avant,
 * 2026-10-22, relecture : RES qui siffle des 0.9, la vraie PWM et l'OVERDRIVE
 * moins fort changent deja un son garde) :
 * - STACK (stack, en cents) : chaque oscillateur en deux ou trois exemplaires
 *   desaccordes de part et d'autre de la note (l'unisson d'un Prophet ou la
 *   supersaw d'un JP-8000), chacun sa phase, au gain 1 / racine(n) : la meme
 *   sonie, un son plus epais. Trois au bureau, deux au telephone
 *   (processorOptions.maxStack). Le nombre se fixe a chaque note (une voix
 *   reprise en plein son y glisse en 5 ms), l'ecart se regle en direct. Le SUB
 *   et le bruit restent seuls, au centre ;
 * - WIDE (wide, 0 a 1) : un second filtre par voix, pour la droite ; les
 *   exemplaires de STACK (sans STACK : OSC 1 et OSC 2) se partagent la
 *   gauche et la droite avant les filtres : une vraie image stereo dans la
 *   note, a puissance egale, alors que WIDTH ne place que la note entiere ;
 * - GLUE (glue, 0 a 1) : la colle du bus de l'ARP, apres l'OVERDRIVE et le
 *   bloqueur de continu : un compresseur lie stereo doux (valeur efficace,
 *   8 ms et 150 ms, 2:1, genou de 8 dB, seuil de -6 a -14 dB du moteur selon
 *   le potard, rattrapage automatique sur le niveau moyen), puis un arrondi
 *   des cretes au-dessus d'un genou (tangente hyperbolique, anti-repliement
 *   ADAA du premier ordre, au surechantillonnage), ce qu'il retire en valeur
 *   efficace rendu ; dose en fondu sur le premier quart du potard. Mesure sur
 *   les presets d'usine (moteur seul) : a 3.5, crete -1 a -4 dB, sonie a
 *   0.6 dB pres ; a 10, crete jusqu'a -6 dB, sonie a 1 dB pres.
 * Le hasard du moteur peut suivre une graine (processorOptions.seed) : la
 * base des tests de non-regression et du futur plugin (VST3, AU).
 * Un vrai relachement (message noteOff, 2026-10-22, audit VST3) : une note
 * jouee sans fin (gate infini) s'arrete a l'heure dite, comme sous un clavier
 * MIDI ou un clip d'Ableton ; l'arpegiateur n'en a pas besoin.
 */

/** Voix au plus (processorOptions.maxVoices : 12 sur ordinateur, 8 au telephone, audio/synth.ts). */
const MAX_VOICES = 12;
/** Une voix en fin de relachement s'eteint sous ce niveau (-66 dB ; 0.00005, -86 dB, avant le 2026-10-21). */
const VOICE_OFF = 0.0005;
/** Bloqueurs de continu (2026-10-21) : la branche OVERDRIVE, puis la sortie du moteur. */
const OD_DC_HZ = 20;
const OUT_DC_HZ = 8;
/**
 * Ecreteur doux de sortie (2026-10-21, audit F7 : un patch dense a VOLUME 1 sortait a +6 dBFS et faisait pomper le
 * limiteur commun, kick compris), en niveau apres VOLUME (outLevel) : lineaire jusqu'a CLIP_KNEE (-6 dBFS, aucun
 * preset ne l'atteint), jamais au-dessus de CLIP_CEIL (-3 dBFS : la place du DELAY et de la REVERB par-dessus).
 */
const CLIP_KNEE = 0.5;
const CLIP_CEIL = 0.71;
/** La place stereo d'une voix volee glisse en PAN_S (pas de marche, audit 2026-10-21). */
const PAN_S = 0.004;
/** Surechantillonnage par defaut (sans processorOptions.os). */
const OS_DEFAULT = 4;
/**
 * STACK (2026-10-22) : les exemplaires de chaque oscillateur au plus (processorOptions.maxStack : 3 au bureau, 2 au
 * telephone, audio/synth.ts), la place de chacun dans l'ecart (en part de stack, en cents) et dans l'image de WIDE
 * (-1 gauche, +1 droite). Sans STACK, WIDE met OSC 1 a gauche et OSC 2 a droite (STACK_PAN1, pas tout a fait aux
 * bouts : le milieu garde de quoi sonner en mono), au meme niveau ; a des niveaux differents, le plus fort se
 * rapproche du centre (2026-10-22, relecture : la note reste au milieu, un oscillateur seul n'est pas elargi).
 * STACK_PAN2 : la part moyenne de la largeur (le carre moyen des places), pour la puissance egale de WIDE.
 */
const MAX_STACK = 3;
const STACK_OFF = [[0], [-0.7, 0.7], [-1, 0, 1]];
const STACK_PAN = [[0], [-1, 1], [-1, 0, 1]];
const STACK_PAN1 = [-0.8, 0.8];
const STACK_PAN2 = [0.64, 1, 2 / 3];
/**
 * WIDE sans STACK (2026-10-22, relecture) : la puissance de chaque forme (shape : sinus, triangle, dent de scie,
 * carre, impulsion de 14 % (PULSE_W), puis le cran FM d'OSC 1, un sinus), pour l'equilibre d'OSC 1 et d'OSC 2 ; mesuree apres
 * le filtre, a 10 % pres (le carre sonne trois fois la dent de scie : a niveau egal, il tirait la note de son cote,
 * de 4 dB a WIDE 10). Entre deux formes, la droite ; la PWM, 4 d (1 - d).
 */
const WAVE_POW = [0.5, 1 / 3, 1 / 3, 1, 4 * 0.14 * 0.86, 0.5];
const wavePow = (i, f, pwm, d) => (pwm ? 4 * d * (1 - d) : f > 1e-4 ? WAVE_POW[i] + (WAVE_POW[i + 1] - WAVE_POW[i]) * f : WAVE_POW[i]);
/** Un exemplaire qui arrive (ou part) sur une voix qui sonne glisse en STACK_S ; l'ecart, d'un bloc a l'autre, en STACK_D_S. */
const STACK_S = 0.005;
const STACK_D_S = 0.03;
/**
 * GLUE (2026-10-22, audit P9) : le compresseur (seuil GLUE_THR0 - GLUE_THR_SPAN x potard, en dB du detecteur, la
 * valeur efficace des deux cotes, attaque et retour en s ; rapport 2:1 ; genou doux), son rattrapage automatique (la
 * reduction que la courbe donne au niveau moyen du son, suivi sur GLUE_AVG_S : la meme sonie, les ecarts d'une note
 * ou d'un accord a l'autre resserres), puis l'arrondi des cretes, pousse de 1 + GLUE_DRIVE x potard : lineaire sous la
 * moitie de son plafond, jamais au-dessus (1 / poussee). Les reglages mesures sur les presets d'usine
 * (scripts/arp-bench.mjs) : le detecteur s'y tient de -6 a -18 dB.
 */
const GLUE_THR0 = -6;
const GLUE_THR_SPAN = 8;
const GLUE_SLOPE = 0.5;
const GLUE_KNEE = 8;
const GLUE_ATK_S = 0.008;
const GLUE_REL_S = 0.15;
const GLUE_AVG_S = 2;
const GLUE_DRIVE = 0.8;
const GLUE_KNEE_AT = 0.5;
const GLUE_S = 0.02;
const DB_LN = 0.11512925464970229;
const LN_DB = 4.342944819032518;

/**
 * Le hasard du moteur (2026-10-22, la base du futur plugin, audit VST3) : Math.random, ou, avec
 * processorOptions.seed, un generateur a graine (mulberry32) : deux rendus de meme graine sont identiques au bit
 * pres, dans Node comme dans le navigateur (scripts/arp-bench.mjs), et un portage C++ tirera la meme suite.
 */
function mulberry32(seed) {
  // 2026-10-23 (zero allocation) : l'etat dans un tableau type, partage par le tirage a l'unite et par fill (les tirages
  // de DRIFT d'un bloc, ecrits dans un tableau : un nombre rendu par une fonction est mis en boite) ; la meme suite
  const st = new Uint32Array(1);
  st[0] = seed >>> 0;
  const next = () => {
    const a = (st[0] + 0x6d2b79f5) >>> 0;
    st[0] = a;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  next.fill = (buf, n) => {
    for (let i = 0; i < n; i += 1) {
      const a = (st[0] + 0x6d2b79f5) >>> 0;
      st[0] = a;
      let t = a;
      t = Math.imul(t ^ (t >>> 15), t | 1);
      t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
      buf[i] = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    }
  };
  return next;
}
/** Le hasard sans graine (Math.random), avec le meme fill. */
function unseeded() {
  const next = () => Math.random();
  next.fill = (buf, n) => {
    for (let i = 0; i < n; i += 1) buf[i] = Math.random();
  };
  return next;
}

/**
 * GLUE : la courbe de l'arrondi (impaire) : lineaire jusqu'au genou k, puis un arc de parabole qui rejoint le plafond
 * k + w avec une pente nulle (en k + 2w), plat au-dela. Un polynome plutot qu'une tangente hyperbolique (2026-10-22,
 * mesure : la primitive de tanh, un exp et un log1p a chaque echantillon surechantillonne, coutait 20 % du moteur) :
 * la meme rondeur, une primitive sans fonction transcendante.
 */
function glueClip(x, k, w) {
  const a = x < 0 ? -x : x;
  if (a <= k) return x;
  const u = a - k;
  const y = u >= 2 * w ? k + w : k + u - (u * u) / (4 * w);
  return x < 0 ? -y : y;
}
/** Sa primitive (paire), pour l'ADAA : x^2 / 2 sous le genou, puis celle de l'arc, puis le plafond. */
function glueClipF(x, k, w) {
  const a = x < 0 ? -x : x;
  if (a <= k) return 0.5 * x * x;
  const u = a - k;
  if (u < 2 * w) return 0.5 * k * k + k * u + 0.5 * u * u - (u * u * u) / (12 * w);
  // En k + 2w : 0.5 k^2 + 2 k w + 2 w^2 - 8 w^2 / 12 ; puis le plafond, pente k + w
  return 0.5 * k * k + 2 * k * w + (4 / 3) * w * w + (k + w) * (u - 2 * w);
}
/**
 * L'arrondi anti-repliement (ADAA du premier ordre) d'un cote (st : son entree d'avant x et sa primitive F, gardee) :
 * la moyenne de la courbe entre l'entree d'avant et celle-ci ; sous le genou des deux cotes, la moyenne des deux.
 */
function glueAdaa(st, x, k, w) {
  const x1 = st.x;
  const ax = x < 0 ? -x : x;
  const a1 = x1 < 0 ? -x1 : x1;
  let y;
  let F;
  if (ax <= k && a1 <= k) {
    y = 0.5 * (x + x1);
    F = 0.5 * x * x;
  } else {
    F = glueClipF(x, k, w);
    const d = x - x1;
    y = d < 1e-7 && d > -1e-7 ? glueClip(0.5 * (x + x1), k, w) : (F - st.F) / d;
  }
  st.x = x;
  st.F = F;
  return y;
}
/** GLUE : la reduction (dB, >= 0) de la courbe a over dB au-dessus du seuil : 2:1, genou doux de GLUE_KNEE dB. */
function glueGr(over) {
  if (over <= -GLUE_KNEE / 2) return 0;
  if (over >= GLUE_KNEE / 2) return GLUE_SLOPE * over;
  const t = over + GLUE_KNEE / 2;
  return (GLUE_SLOPE * t * t) / (2 * GLUE_KNEE);
}

/** Bessel I0 (serie), pour la fenetre de Kaiser. */
function besselI0(x) {
  let sum = 1;
  let term = 1;
  for (let k = 1; k < 40; k += 1) {
    term *= (x / (2 * k)) * (x / (2 * k));
    sum += term;
    if (term < 1e-12 * sum) break;
  }
  return sum;
}

/** Le filtre demi-bande (coupure au quart de sa frequence d'entree), gain 1 en continu. */
function halfband(taps, beta) {
  const c = (taps - 1) / 2;
  const h = new Float64Array(taps);
  const i0b = besselI0(beta);
  let sum = 0;
  for (let k = 0; k < taps; k += 1) {
    const n = k - c;
    const ideal = n === 0 ? 0.5 : Math.sin((Math.PI * n) / 2) / (Math.PI * n);
    const r = n / c;
    const w = besselI0(beta * Math.sqrt(Math.max(0, 1 - r * r))) / i0b;
    h[k] = ideal * w;
    sum += h[k];
  }
  for (let k = 0; k < taps; k += 1) h[k] /= sum;
  // Seuls le centre et les rangs impairs comptent (les autres sont nuls)
  const idx = [];
  for (let k = 0; k < taps; k += 1) if (Math.abs(h[k]) > 1e-12) idx.push(k);
  return { h, idx: Int32Array.from(idx) };
}

/** Un etage de decimation par 2 : le demi-bande, puis un echantillon sur deux ; garde son historique. */
class Decimator {
  constructor(taps, beta) {
    const hb = halfband(taps, beta);
    this.h = hb.h;
    this.idx = hb.idx;
    this.T = taps - 1;
    this.buf = new Float32Array(this.T + 1024);
  }
  /** n2 echantillons de input -> n2 / 2 dans out. */
  run(input, n2, out) {
    const T = this.T;
    if (this.buf.length < T + n2) {
      const grown = new Float32Array(T + n2);
      grown.set(this.buf.subarray(0, T));
      this.buf = grown;
    }
    const b = this.buf;
    // 2026-10-23 (zero allocation, Mika : "d'extreme bonne qualite") : une copie a la main, pas de vue subarray par bloc
    for (let i = 0; i < n2; i += 1) b[T + i] = input[i];
    const h = this.h;
    const idx = this.idx;
    const n = n2 >> 1;
    for (let i = 0; i < n; i += 1) {
      const base = T + 2 * i + 1;
      let y = 0;
      for (let j = 0; j < idx.length; j += 1) {
        const k = idx[j];
        y += h[k] * b[base - k];
      }
      out[i] = y;
    }
    b.copyWithin(0, n2, n2 + T);
  }
  clear() {
    this.buf.fill(0, 0, this.T);
  }
}
const TRACK_ROOT = 54;

/*
 * 2026-10-23 (zero allocation, Mika : "d'extreme bonne qualite") : polyblep, pulse, shape, shape1, rawShape, stepOf,
 * wavePow, odComp, odCurve, glueAdaa, glueClip et glueGr sont ecrites sur place dans process et busTick (un appel qui
 * prend ou rend un nombre le met en boite : 90 Ko par bloc avant, un ramasse-miettes toutes les 50 ms sur le fil
 * audio) ; ces fonctions restent la reference de ces copies (au bit pres, scripts/arp-bench.mjs --check) et servent
 * aux mesures (scripts/arp-quality/measure).
 */
function polyblep(t, dt) {
  if (t < dt) {
    const x = t / dt;
    return x + x - x * x - 1;
  }
  if (t > 1 - dt) {
    const x = (t - 1) / dt;
    return x * x + x + x + 1;
  }
  return 0;
}

/** Impulsion de rapport d, centree (sans composante continue), PolyBLEP. */
function pulse(ph, dt, d) {
  let y = ph < d ? 1 : -1;
  y += polyblep(ph, dt);
  let t2 = ph - d;
  if (t2 < 0) t2 += 1;
  y -= polyblep(t2, dt);
  return y - (2 * d - 1);
}

const TAU = Math.PI * 2;
/** Cran FM de WAVE 1 : OSC 2 decale la phase d'OSC 1 de FM_INDEX x 0.16 cycle au plus (environ 1.6 rad). */
const FM_INDEX = 1.6;
/**
 * Potard FM (2026-10-03, Mika : "de la synthese FM, comme le Typhon") :
 * un operateur sinus module la phase d'OSC 1, quelle que soit sa forme ;
 * l'indice monte avec le carre du potard jusqu'a FM_MAX radians et suit
 * l'enveloppe du filtre (35 % fixe, 65 % par elle) : l'attaque brille, la
 * tenue s'adoucit. RATIO (meme jour) : la frequence de l'operateur, en
 * multiple d'OSC 1 (1/2 a 7) ; l'indice est borne pour que les bandes
 * laterales restent sous 0.4 x la frequence d'echantillonnage interne.
 */
const FM_MAX = 6;
/**
 * NOISE (2026-10-03, Mika) : un bruit blanc par voix entre dans le filtre
 * avec les oscillateurs (niveau au carre du potard, un nouveau tirage par
 * echantillon du contexte, tenu pendant le surechantillonnage : le meme
 * niveau a x2 et x4).
 * MODE du filtre (2026-10-04, apres SLOPE) : les sorties de l'echelle
 * melangees comme sur un Oberheim Xpander, la retroaction restant celle des
 * quatre etages : LP 24 (le quatrieme etage), LP 12 (le deuxieme, sa bosse
 * de resonance ramenee par SLOPE12_RES), BP (2 x (premier - deuxieme)),
 * HP (entree - 2 x premier + deuxieme) ; en fondu de 15 ms d'un mode a
 * l'autre. Les graves gardes (BASS_KEEP) seulement en passe-bas.
 * OSC 1 et OSC 2 (2026-10-04, a la place de MIX) : le gain de chaque
 * oscillateur, lisse.
 * MOD (2026-10-04) : un LFO commun aux notes, cale sur le tempo (un cycle
 * = lfoBeats temps), adouci en 2 ms (pas de clic) ; il pousse les formes
 * d'onde (+/-2 crans), la coupure (+/-3 octaves), la FM (+/-0.6), la
 * hauteur (+/-1 demi-ton) ou formes et coupure a moitie chacune, selon DEPTH.
 * Cale sur la mesure (2026-10-18, Mika : "dans les MOD je veux un random
 * aussi et qui se cale au beat") : sa phase ne tourne plus d'elle-meme
 * (avant, elle repartait a la premiere note apres un STOP, s'arretait a
 * chaque silence du moteur et gardait son avance a un changement de
 * tempo : elle quittait la grille). Elle se lit sur la position du
 * transport, en temps : a chaque pas, l'arpegiateur dit ou il en est
 * ('beat' : a tel instant, tel temps depuis le debut de sa premiere
 * mesure, a tel tempo), et entre deux pas la position suit la droite de la
 * derniere ancre. Un cycle part donc toujours pile sur la grille de sa
 * division (1/16 sur chaque double croche, 1 BAR sur chaque mesure, 4 BAR
 * sur les mesures 1, 5, 9... de l'arpege), apres un RUN, un tempo change ou
 * un silence. Arrete (STOP), il tourne librement au tempo (bpm) ; sans
 * ancre depuis une seconde (un onglet gele), un tempo qui change s'y
 * applique aussi tout de suite. Les formes (lfoShape) : 0 triangle, 1 dent de
 * scie, 2 carre, 3 S&H (une valeur par cycle, tiree pile a son debut,
 * tenue), 4 RND (le hasard lisse : de la valeur du cycle a la suivante, en
 * S, arrivee pile au debut du cycle suivant) ; deux valeurs de suite du
 * hasard s'ecartent d'au moins LFO_MIN_JUMP (un quart de la course, -1 a
 * +1) : il s'entend toujours, jamais un tirage presque pareil au precedent.
 */
const LFO_MIN_JUMP = 0.5;
/** Le tirage suivant du hasard de MOD : partout entre -1 et +1, sauf a moins de LFO_MIN_JUMP du precedent (rnd : le hasard du moteur). */
function nextRandom(a, rnd) {
  const lo = Math.max(0, a - LFO_MIN_JUMP + 1);
  const hi = Math.max(0, 1 - a - LFO_MIN_JUMP);
  const r = rnd() * (lo + hi);
  return r < lo ? -1 + r : a + LFO_MIN_JUMP + (r - lo);
}
const NOISE_MAX = 1;
const SLOPE12_RES = 0.12;
/**
 * Gains des modes passe-bande et passe-haut, ramenes au niveau du passe-bas
 * (mesure hors ligne, arpege par defaut) ; un peu moins quand la resonance
 * monte (leur bosse grandit plus vite que celle du passe-bas). 2026-10-21
 * (audit F8 : HP sonnait 2 dB sous MOOG, BP 0.7 dB, en sonie ponderee K) :
 * 1.25 et 1.7 avant ; a 1.5 dB pres de MOOG sur RES 0 a 0.8 et CUTOFF 0.4 a
 * 0.5 (un passe-haut a une coupure haute reste forcement plus maigre).
 */
const BP_GAIN = 1.3;
const BP_RES = 0.12;
const HP_GAIN = 2.1;
const HP_RES = 0.1;

/**
 * Une forme : 0 sinus, 1 triangle, 2 dent de scie, 3 carre, 4 impulsion
 * de 14 % (5 : FM, calculee a part). Toutes en phase (fondamentale en
 * +sin) : le triangle decale d'un quart, la dent de scie descendante ; le
 * morphing de l'une a l'autre garde sa fondamentale.
 */
function shape(ph, dt, w) {
  switch (w) {
    case 0:
      return Math.sin(TAU * ph);
    case 1: {
      let q = ph + 0.25;
      if (q >= 1) q -= 1;
      return 1 - 4 * Math.abs(q - 0.5);
    }
    case 2:
      return 1 - 2 * ph + polyblep(ph, dt);
    case 3:
      return pulse(ph, dt, 0.5);
    default:
      return pulse(ph, dt, 0.14);
  }
}

/** OSC 1, forme w : le cran FM (5) est la sinusoide modulee par OSC 2. */
function shape1(w, p1, d1, ph0, o2, pm) {
  return w === 5 ? Math.sin(TAU * (ph0 + FM_INDEX * o2 * 0.16 + pm)) : shape(p1, d1, w);
}

/**
 * Saturation d'un etage du filtre : une tangente hyperbolique d'echelle NL_A (gain 1 en petit signal). Jusqu'au
 * 2026-10-21, la pente moyenne de sa forme rationnelle (nl, tq) entre l'entree et l'etat de l'etage, une fois par
 * echantillon du contexte ; depuis, a chaque echantillon surechantillonne, par sa forme approchee
 * 1 / (1 + NL_K (a^2 + ab + b^2)) : la meme courbure en petit signal (NL_K = NL_A^2 / 3), sans division de plus ni
 * borne dure (la mesure : le meme niveau sur les presets a 0.1 dB pres, le repliement parti, pas plus de calcul).
 */
const NL_A = 0.6;
const NL_K = (NL_A * NL_A) / 3;
/** Les graves gardes quand la resonance monte (0.3 avant le 2026-10-03). */
const BASS_KEEP = 0.45;
/**
 * RES -> retroaction de l'echelle (2026-10-21, audit : elle ne sifflait que sur les 2.4 derniers % du potard, les
 * crans MIDI 125 a 127). 4.1 x RES jusqu'a 0.7 (le son d'avant), puis plus raide : l'auto-oscillation (4) arrive a
 * RES 0.9 (le cran MIDI 114), comme sur un Minimoog ou un Typhon ; au-dessus, elle monte doucement jusqu'a 4.1 (le
 * maximum d'avant : meme niveau en butee, -6.7 dBFS, et juste a 11 cents pres ; un maximum a 4.6 la faisait crier
 * a -0.7 dBFS et baisser de 53 cents).
 */
const RES_KNEE = 0.7;
const RES_SING = 0.9;
const resK = (r) => (r <= RES_KNEE ? 4.1 * r : r <= RES_SING ? 2.87 + (r - RES_KNEE) * 5.65 : 4 + (r - RES_SING) * 1);
/**
 * La passe de correction de l'echelle (2026-10-23, S6, Mika : "que le son soit d'extreme bonne qualite") : la methode
 * "cheap" prend la pente de chaque etage a l'echantillon d'avant ; quand g est grand (coupure haute) et la retroaction
 * forte, ce retard destabilise la boucle : au telephone, RES 0.9 et plus avec une coupure au-dessus de 12 kHz, un
 * sifflement non harmonique jusqu'a +3.9 dBFS ; l'auto-oscillation y sonnait 149 a 432 cents trop bas. La passe reprend
 * les pentes au point de l'echantillon (la sortie predite de chaque etage), puis la retroaction. Sous porte : elle
 * s'ouvre de g LC_G0 (x4 4.9 kHz, x2 2.4 kHz) et k LC_K0 (RES 0.865) et l'est toute a g LC_G0 + LC_GW et k LC_K0 +
 * LC_KW, en fondu (pas de marche entre les deux methodes) ; fermee, le calcul d'avant au bit pres (aucun preset ne
 * l'ouvre : ACID NIGHT, RES 0.86, est a k 3.77).
 */
/**
 * L'auto-oscillation juste (2026-10-23, S7) : au-dessus du seuil (k > 4) l'oscillation descend avec son amplitude,
 * uniformement en frequence depuis S6 (-10.5 cents a RES 1, k 4.1) : la coupure monte de K_COMP cents par unite de k
 * au-dessus de 4 (modes de l'echelle : MOOG, LP12, BP, HP), sans pow de plus. Ajuste au banc (q.mjs selfosc, 1 kHz,
 * k 4.02 / 4.05 / 4.1). Sous le seuil (RES 0.9 et moins), le calcul d'avant au bit pres.
 */
const K_COMP = 105;
const LC_G0 = 0.08;
const LC_GW = 0.1;
const LC_K0 = 3.8;
const LC_KW = 0.15;
/**
 * MODE MS-10 (2026-10-23, S11, Mika : "entre Monark et un synth analog Moog Voyager et un Korg MS10") : le passe-bas
 * Korg35 du MS-10, un Sallen-Key a 12 dB dont les graves ne tombent pas avec la resonance, dont la bosse passe au-dessus
 * de la bande passante, et dont les deux diodes 1N4148 tete-beche du chemin direct (gain 58.4) compriment tout ce qui
 * passe et ecretent la resonance en cri (Stinchcombe 2006). Valeurs du MS-10 : C1 = 3 C2, denominateur normalise
 * s^2 + (7/3 - K) s + 1, auto-oscillation a K = 7/3, retroaction au bas de C1 (pas de retroaction au continu) :
 *   VA = K d(b) - c ;  dc/dt = w ((4/3) VA - x - b / 3) ;  db/dt = w (VA - b) ;  y = d(b)
 * Les diodes : Z + 0.030 sinh Z = X (k1 - 1) / k1, F(X) = X / k1 + Z, normalisee par F'(0) = 0.9714, en table
 * (Newton, une fois : K35_N + 1 points sur [0, K35_XMAX], interpolation lineaire, symetrie impaire, queue lineaire) ;
 * d(b) = lam F(b / lam), lam = K35_KNEE / 11.1 (le genou en unites du moteur). Integrateurs trapezoidaux (TPT), g
 * prechauffe, la diode lineairisee par sa secante a l'origine (extrapolee de l'echantillon d'avant, puis reprise au
 * point au-dessus de la porte comme S6) ; la coupure depend un peu du signe de la sortie (K35_ALPHA : l'asymetrie de
 * Stinchcombe, les harmoniques paires).
 */
const K35_K1 = 58.4;
const K35_N = 8192;
const K35_XMAX = 256;
const K35_INV = K35_N / K35_XMAX;
const K35_T = new Float64Array(K35_N + 1);
{
  const f0 = (K35_K1 + 0.03) / (1.03 * K35_K1);
  for (let i = 0; i <= K35_N; i += 1) {
    const xx = i / K35_INV;
    const r = (xx * (K35_K1 - 1)) / K35_K1;
    let z = r < 1 ? r / 1.03 : Math.asinh(r / 0.03);
    for (let it = 0; it < 60; it += 1) z -= (z + 0.03 * Math.sinh(z) - r) / (1 + 0.03 * Math.cosh(z));
    K35_T[i] = (xx / K35_K1 + z) / f0;
  }
}
const K35_TEND = K35_T[K35_N];
const K35_SLOPE = (K35_T[K35_N] - K35_T[K35_N - 1]) * K35_INV;
/** La secante d(x) / x en table (la meme grille ; 1 a l'origine) : une interpolation au lieu d'une division. */
const K35_S = new Float64Array(K35_N + 1);
K35_S[0] = 1;
for (let i = 1; i <= K35_N; i += 1) K35_S[i] = (K35_T[i] * K35_INV) / i;
/** Le genou des diodes en niveau du moteur : un sinus de 200 Hz a 0.62, filtre ouvert, RES 0, sort a H3 -30 dBc. */
const K35_KNEE = 1.6;
const K35_LAM = K35_KNEE / 11.1;
const K35_ILAM = 1 / K35_LAM;
const K35_ALPHA = 0.035;
/** RES -> kappa (K / (7/3)) : les bosses de MOOG au meme RES, l'auto-oscillation a RES 0.9, jusqu'a 1.15 a RES 1. */
const MS_RES_AT = [0, 0.3, 0.5, 0.7, 0.8, 0.85, 0.9, 1.0];
const MS_KAPPA = [0, 0.5, 0.72, 0.86, 0.935, 0.965, 1.0, 1.15];
/** La hauteur du depassement borne par les diodes : la coupure monte de C35 (kappa - 1)^2 cents au-dessus de 1. */
const C35 = 630;
/** Le niveau du MS-10 contre MOOG (INIT a 1 LU pres) ; la coupure bornee a 16 kHz (x4) et 13 kHz (x2) : le MS-10 finit vers 12 kHz. */
const MS_GAIN = 0.75;
const MS_FC_MAX4 = 16000;
const MS_FC_MAX2 = 13000;
/**
 * LOAD (2026-10-23, S12, Mika : "entre Monark et un synth analog Moog Voyager") : le gras du Moog, une saturation dans
 * le melangeur et le premier etage, AVANT le filtre : ses produits au-dessus de la coupure sont filtres, la resonance
 * est comprimee par les notes (le grognement), l'attaque passe avant le VCA. Par voix, apres le passe-bas de S3 :
 *   z = x gIn + b ; m = ADAA(clip, z) - clip(b), sans continu (LD_DC_HZ) ; l'entree du filtre x + wet (m - x)
 * gIn = 1 + 4 L^2, b = LD_BIAS L (les paires), la courbe de GLUE (lineaire jusqu'a LD_K, arrondie sur 2 LD_W, plafond),
 * le VCA rattrape gIn^-LD_MK, la saturation de sortie des voix soulagee (ldRel = 1 - 0.7 min(1, L / 0.1) : le grain
 * passe avant le filtre), la FIR du bus compense la seconde ADAA ((1 + wet) / 8). A LOAD 0 : le calcul d'avant.
 */
const LD_K = 0.8;
const LD_W = 0.8;
const LD_BIAS = 0.16;
const LD_DC_HZ = 7;
const LD_MK = 0.5;
/** Sous ce niveau d'enveloppe, une voix reprise peut repartir de la phase de PHASE sans clic. */
const PHASE_QUIET = 0.02;
/** Gain de sortie (1.5 avant le filtre a etages satures : recale au meme niveau, mesure hors ligne). */
const OUT_GAIN = 1.25;
/**
 * OVERDRIVE (2026-10-04, Mika : "pour ARP c'est pas DIST qu'on veut c'est
 * OVERDRIVE") : le montage d'une Tube Screamer plutot qu'un ecretage. Le
 * signal propre passe entier ; une copie privee de ses graves (passe-haut
 * OD_HP_HZ) est amplifiee (jusqu'a OD_GAIN fois), arrondie par une courbe
 * douce un peu asymetrique (OD_BIAS : des harmoniques paires, chaudes),
 * adoucie (passe-bas OD_TONE_HZ) et ajoutee. La basse reste ronde et
 * tendue, le grain vient dans les mediums ; le niveau est compense
 * (OD_TRIM). L'entree du filtre est poussee un peu (1 + 2.5 x), la
 * saturation de sortie des voix a peine (1 + 1.5 x) : avant (DIST), 1 + 5 x
 * et 1 + 7 x, un ecretage dur.
 */
const OD_HP_HZ = 720;
const OD_TONE_HZ = 4200;
const OD_GAIN = 40;
const OD_BIAS = 0.22;
const OD_TANH_BIAS = Math.tanh(OD_BIAS);
const OD_MIX = 0.42;
const OD_TRIM = 0.85;
/**
 * La compensation de niveau de l'OVERDRIVE (2026-10-21, audit F6 : OD_TRIM seul le laissait monter de 6 dB a 0.5) :
 * un gain mesure (valeur efficace egale a celle sans OVERDRIVE, sur trois patchs, a 1 dB pres), aux points
 * OD_COMP_AT, lineaire entre eux.
 */
const OD_COMP_AT = [0, 0.1, 0.25, 0.5, 0.75, 1];
const OD_COMP = [1, 0.85, 0.65, 0.54, 0.57, 0.64];
function odComp(d) {
  if (d <= 0) return 1;
  for (let i = 1; i < OD_COMP_AT.length; i += 1) {
    if (d <= OD_COMP_AT[i]) {
      const t = (d - OD_COMP_AT[i - 1]) / (OD_COMP_AT[i] - OD_COMP_AT[i - 1]);
      return OD_COMP[i - 1] + (OD_COMP[i] - OD_COMP[i - 1]) * t;
    }
  }
  return OD_COMP[OD_COMP.length - 1];
}
/** La courbe de l'overdrive : douce, asymetrique, nulle a zero (son continu part au bloqueur de la branche). */
const odCurve = (u) => Math.tanh(u + OD_BIAS) - OD_TANH_BIAS;
/**
 * La courbe de l'overdrive sans repliement (2026-10-23, S4, Mika : "que le son soit d'extreme bonne qualite") : la
 * meme courbe (le grain des sons gardes), par son integrale (ADAA du premier ordre) : F(u) = lncosh(u + OD_BIAS) -
 * u tanh(OD_BIAS), lncosh(x) = |x| + log1p(exp(-2|x|)) - ln 2 (depuis S5 : la table LNC), la sortie (F(u) - F(u1)) / (u - u1),
 * la courbe au milieu quand u bouge de moins de OD_ADAA_EPS (F n'y est pas calculee : elle le sera au besoin, pour
 * l'echantillon d'avant), et sous OD_LIN_U la courbe y est sa tangente au second ordre (les queues, sans fonction
 * transcendante). Ecrite dans busTick (zero allocation).
 */
const OD_ADAA_EPS = 1e-6;
const OD_LIN_U = 1e-5;
const OD_SECH2 = 1 - OD_TANH_BIAS * OD_TANH_BIAS;
const LN2 = Math.LN2;
/**
 * K2 (2026-10-23, S5) : au telephone (x2), un pole a OD_PRE_HZ sur l'entree de la courbe d'OVERDRIVE (apres son
 * passe-haut) : ce qu'il reste au-dessus de 20 kHz ne s'y replie plus (OD06 C8 x2 49.8 -> 53.5 dB). 7 kHz (le plan)
 * changeait H7 de 4.7 dB ; a 16 kHz, 1.3 dB au plus (H7 a -51 dBc), niveaux a 0.1 dB.
 */
const OD_PRE_HZ = 16000;
/**
 * lncosh en table (2026-10-23, S5) : l'integrale de tanh, pour l'ADAA de la saturation des voix et d'OVERDRIVE, sans
 * exp ni log1p a chaque echantillon (deux fonctions transcendantes : +17 % de calcul en x4 a 12 voix). Hermite cubique
 * par pas de 1/LNC_INV sur [0, LNC_MAX], valeurs (lncosh) et pentes (tanh) exactes aux noeuds, quatre coefficients par
 * pas ; au-dela, |x| - ln 2 (a l'arrondi pres). F a 2e-11 pres, sa pente a 1.5e-8 de tanh : la sortie de l'ADAA a
 * moins de 1e-8 de celle avec lncosh exacte (-103 dB d'un sinus a -60 dBFS, -170 dB a 0 dBFS). Paire en x : |x|.
 */
const LNC_INV = 128;
const LNC_MAX = 18;
const LNC = new Float64Array(4 * LNC_MAX * LNC_INV);
for (let i = 0; i < LNC_MAX * LNC_INV; i += 1) {
  const h = 1 / LNC_INV;
  const x0 = i * h;
  const x1 = x0 + h;
  const y0 = x0 + Math.log1p(Math.exp(-2 * x0)) - LN2;
  const y1 = x1 + Math.log1p(Math.exp(-2 * x1)) - LN2;
  const d0 = Math.tanh(x0);
  const d1 = Math.tanh(x1);
  LNC[4 * i] = y0;
  LNC[4 * i + 1] = h * d0;
  LNC[4 * i + 2] = 3 * (y1 - y0) - h * (2 * d0 + d1);
  LNC[4 * i + 3] = 2 * (y0 - y1) + h * (d0 + d1);
}
/**
 * DRIFT (2026-10-21, P11 de l'audit, "plus vivant") : la derive de chaque oscillateur est la somme de trois marches
 * au hasard (lente, moyenne, rapide : constante de temps en s, ecart type en cents a DRIFT 5). Avant, une seule marche
 * de 0.53 s (1 cent) : un frisson, jamais la lente vague d'un VCO qui chauffe. La lente domine maintenant (le
 * battement entre OSC 1 et OSC 2 accelere et ralentit sur quelques secondes), l'ensemble a peine plus large (1.1
 * cent). DRIFT_CAL : l'etalonnage de chaque voix (accord en cents, coupure en octaves, ecart maxi), tire une fois a sa
 * creation, comme les voix d'un vrai polyphonique.
 */
const DRIFT_WALKS = [
  [3, 1],
  [0.5, 0.5],
  [0.03, 0.2],
];
const DRIFT_MAX = 4;
const DRIFT_CAL = { tune: 1, cut: 0.03 };
/** Accent vers le filtre (accFlt a 1) : l'enveloppe x (1 + ACC_ENV a), la coupure + ACC_CUT a octave, a = accent - 1. */
const ACC_ENV = 1.5;
const ACC_CUT = 0.6;

const midiHz = (m) => 440 * Math.pow(2, (m - 69) / 12);
const coef = (seconds, sr) => 1 - Math.exp(-1 / Math.max(1, seconds * sr));

/**
 * Un exemplaire d'OSC 1 et d'OSC 2 (STACK, 2026-10-22) : leurs phases et celle de l'operateur FM (a, b, m), les
 * phases modulees d'avant (q1, q2, la FM sans repliement), la correction de la SYNC qui reste (sb), son gain (g, qui
 * glisse vers gt), sa place dans l'ecart (off) et son rapport de frequence (r : 1 sans STACK), ses places dans WIDE
 * (pan1, pan2). live : ses phases sont tirees (le premier, a la creation de la voix ; les autres, a leur premier
 * usage : sans STACK, le hasard du moteur suit la meme suite qu'avant).
 */
function stackPair(a, b, m, live) {
  return { a, b, m, q1: NaN, q2: NaN, sb: 0, sf: 0, g: live ? 1 : 0, gt: live ? 1 : 0, off: 0, r: 1, pan1: STACK_PAN1[0], pan2: STACK_PAN1[1], live };
}

class Voice {
  constructor(rnd) {
    this.on = false;
    this.midi = 60;
    this.logf = Math.log(261.6);
    this.logT = this.logf;
    // OSC 1, OSC 2, l'operateur FM (le premier exemplaire de STACK, 2026-10-22), puis la phase du SUB
    const a0 = rnd();
    const b0 = rnd();
    const m0 = rnd();
    this.pr = [stackPair(a0, b0, m0, true)];
    for (let j = 1; j < MAX_STACK; j += 1) this.pr.push(stackPair(0, 0, 0, false));
    this.subPh = rnd();
    // STACK : les exemplaires fixes a la note, et ceux que la boucle calcule encore (un qui s'eteint compris)
    this.n = 1;
    this.nLoop = 1;
    // WIDE : le filtre de droite (ses etages, l'entree du premier), s'il tourne, et si la note y a droit (wideVoices)
    this.fr = { pu: 0, s1: 0, s2: 0, s3: 0, s4: 0, u: 0, y1: 0, y2: 0, x: 0, g: 0, k: 0, y: 0 };
    this.wl = false;
    this.wideOK = true;
    // 2026-10-23 : l'etat en tableau type (VX_*), le passe-bas avant le filtre pour commencer
    this.x = new Float64Array(VX_SIZE);
    // Bruit : xorshift 32 bits, une graine par voix (jamais 0)
    this.seed = ((rnd() * 0x7fffffff) | 0) | 1;
    this.nz = 0;
    // DRIFT : la derive de chaque oscillateur (en cents, a DRIFT 5), ses trois marches (la lente part de son ecart
    // habituel : une voix neuve n'est pas plus juste que les autres), et l'etalonnage de la voix
    this.drift = [0, 0];
    this.walk = DRIFT_WALKS.map(([, sd], j) => [0, 0].map(() => (j === 0 ? (rnd() - 0.5) * 3.4641 * sd : 0)));
    this.calT = [(rnd() - 0.5) * 2 * DRIFT_CAL.tune, (rnd() - 0.5) * 2 * DRIFT_CAL.tune];
    this.calC = (rnd() - 0.5) * 2 * DRIFT_CAL.cut;
    this.aStage = 0;
    this.aV = 0;
    this.fStage = 0;
    this.fV = 0;
    this.s1 = 0;
    this.s2 = 0;
    this.s3 = 0;
    this.s4 = 0;
    this.off = 0;
    // La frame du depart de la note (2026-10-22, noteOff : jamais relachee avant ses 64 premiers echantillons)
    this.start = 0;
    this.accent = 1;
    this.age = 0;
    this.quick = false;
    // Les petits ecarts de la note (noteOn) : coupure, enveloppes, accord, place stereo
    this.vCut = 1;
    this.vCutE = 0;
    this.vEnv = 1;
    this.vTune = 0;
    // La place stereo : ou elle va (tL, tR) et ou elle en est (gL, gR, lissee : une voix volee ne saute pas)
    this.gL = 1;
    this.gR = 1;
    this.tL = 1;
    this.tR = 1;
    // ACCENT vers le filtre (2026-10-21, accFlt) : l'enveloppe et la coupure de la note, sa decroissance, son niveau
    this.envAcc = 1;
    this.cutAcc = 0;
    this.fdm = 1;
    this.ampAcc = 1;
    // L'entree du premier etage au dernier echantillon (pente de sa saturation)
    this.pu = 0;
    // Recalcules une fois par echantillon du contexte : les pas de phase et la frequence du filtre (g = tan) ; les
    // pentes des quatre etages, a chaque echantillon surechantillonne (2026-10-21)
    this.d1 = 0;
    this.d2 = 0;
    this.d3 = 0;
    this.g = 0;
    // La FM et la SYNC sans repliement (2026-10-21) : leurs etats sont ceux de chaque exemplaire (stackPair : q1, q2, sb)
  }
}

/**
 * WIDE (2026-10-22) : l'echelle de droite d'une voix (son etat st : pu, s1 a s4), le meme calcul que celle de gauche
 * (process) ; st.x l'entree deja poussee par OVERDRIVE ; la sortie du quatrieme etage dans st.y, garde u, y1 et y2
 * (MODE).
 */
function ladderR(st) {
  // 2026-10-23 (zero allocation) : l'entree, la coupure et la retroaction arrivent dans l'etat (st.x, st.g, st.k) et la
  // sortie y repart (st.y) : un appel avec des nombres les mettait en boite a chaque echantillon
  const x = st.x;
  const g = st.g;
  const k = st.k;
  const x0 = st.pu;
  const x1 = st.s1;
  const x2 = st.s2;
  const x3 = st.s3;
  const x4 = st.s4;
  const ga = g / (1 + NL_K * (x0 * x0 + x0 * x1 + x1 * x1));
  const gb = g / (1 + NL_K * (x1 * x1 + x1 * x2 + x2 * x2));
  const gc = g / (1 + NL_K * (x2 * x2 + x2 * x3 + x3 * x3));
  const gd = g / (1 + NL_K * (x3 * x3 + x3 * x4 + x4 * x4));
  let Ga = ga / (1 + ga);
  let Gb = gb / (1 + gb);
  let Gc = gc / (1 + gc);
  let Gd = gd / (1 + gd);
  let S = Gd * Gc * Gb * (1 - Ga) * x1 + Gd * Gc * (1 - Gb) * x2 + Gd * (1 - Gc) * x3 + (1 - Gd) * x4;
  let u = (x - k * S) / (1 + k * Ga * Gb * Gc * Gd);
  // La passe de correction (2026-10-23, S6), sous porte
  if (k > LC_K0 && g > LC_G0) {
    let ta = (g - LC_G0) / LC_GW;
    ta = ta >= 1 ? 1 : ta * ta * (3 - 2 * ta);
    let tb = (k - LC_K0) / LC_KW;
    tb = tb >= 1 ? 1 : tb * tb * (3 - 2 * tb);
    const om = ta * tb;
    const p1 = x1 + (u - x1) * Ga;
    const p2 = x2 + (p1 - x2) * Gb;
    const p3 = x3 + (p2 - x3) * Gc;
    const p4 = x4 + (p3 - x4) * Gd;
    const ha = g / (1 + NL_K * (u * u + u * p1 + p1 * p1));
    const hb = g / (1 + NL_K * (p1 * p1 + p1 * p2 + p2 * p2));
    const hc = g / (1 + NL_K * (p2 * p2 + p2 * p3 + p3 * p3));
    const hd = g / (1 + NL_K * (p3 * p3 + p3 * p4 + p4 * p4));
    Ga += om * (ha / (1 + ha) - Ga);
    Gb += om * (hb / (1 + hb) - Gb);
    Gc += om * (hc / (1 + hc) - Gc);
    Gd += om * (hd / (1 + hd) - Gd);
    S = Gd * Gc * Gb * (1 - Ga) * x1 + Gd * Gc * (1 - Gb) * x2 + Gd * (1 - Gc) * x3 + (1 - Gd) * x4;
    u = (x - k * S) / (1 + k * Ga * Gb * Gc * Gd);
  }
  st.pu = u;
  st.u = u;
  let w = (u - x1) * Ga;
  let y = w + x1;
  st.s1 = y + w;
  st.y1 = y;
  w = (y - x2) * Gb;
  y = w + x2;
  st.s2 = y + w;
  st.y2 = y;
  w = (y - x3) * Gc;
  y = w + x3;
  st.s3 = y + w;
  w = (y - x4) * Gd;
  y = w + x4;
  st.s4 = y + w;
  st.y = y;
}

/** Le pas instantane d'une phase modulee (de prev a cur, repliee), borne pour PolyBLEP. */
function stepOf(cur, prev) {
  let d = cur - prev;
  if (d < -0.5) d += 1;
  else if (d > 0.5) d -= 1;
  if (d < 0) d = -d;
  return d < 1e-5 ? 1e-5 : d > 0.5 ? 0.5 : d;
}

/**
 * La forme brute (sans PolyBLEP ni retrait du continu) d'un oscillateur a la phase ph, et la marche que PolyBLEP
 * corrige d'elle-meme a la phase 0 (2 pour la scie, le carre et l'impulsion, 0 pour le sinus et le triangle) : la
 * remise de phase de la SYNC (2026-10-21).
 */
function rawShape(ph, w, d) {
  switch (w) {
    case 0:
      return Math.sin(TAU * ph);
    case 1: {
      let q = ph + 0.25;
      if (q >= 1) q -= 1;
      return 1 - 4 * Math.abs(q - 0.5);
    }
    case 2:
      return 1 - 2 * ph;
    default:
      return ph < d ? 1 : -1;
  }
}
const natStep = (w) => (w >= 2 ? 2 : 0);
/** La largeur de l'impulsion d'un cran (3 carre, 4 impulsion) ; entre les deux, la PWM (2026-10-21). */
/**
 * La borne de l'indice FM au telephone (2026-10-23, S10) : la largeur de Carson de la FM sous 24 kHz au rythme x2 (sa
 * queue de Bessel n'atteint plus 48 kHz) ; en x4 la borne d'avant (0.4). FM1R35 C7 x2 33 -> plus de 50 dB.
 */
const FM_B_PHONE = 0.25;
const PULSE_W = 0.14;
/*
 * Le triangle (2026-10-23, S9, Mika : "que le son soit d'extreme bonne qualite") : ses deux coins replient (TRI C8 x2 50
 * dB) ; un polyBLAMP a 2 points, residu (1 - |x|)^3 / 6 a x echantillons du coin, la pente changeant de 8 dt (creux) ou
 * -8 dt (sommet) par echantillon, dt le pas instantane (FM compris) : OSC 1, OSC 2, SUB et chaque morphing qui passe par
 * le triangle. Symetrique : pas de continu.
 */
const pwOf = (w, f) => (w === 3 ? 0.5 - (0.5 - PULSE_W) * f : w === 4 ? PULSE_W : 0.5);

/**
 * Les nombres d'un echantillon passes de process a busTick (2026-10-23, zero allocation, Mika : "d'extreme bonne
 * qualite") : dans une seule grande fonction, le compilateur de V8 mettait des nombres en boite (90 Ko par bloc, un
 * ramasse-miettes toutes les 50 ms sur le fil audio) ; le bus dans sa propre methode, les nombres dans des tableaux types.
 */
const KS_ODGAIN = 0;
const KS_ODMIX = 1;
const KS_ODTRIM = 2;
const KS_CLIPT = 3;
const KS_CLIPW = 4;
/** S12 : le coefficient de la FIR de compensation (1/8, plus avec LOAD). */
const KS_VSC = 5;
const KS_SIZE = 6;
const KI_NEWNOISE = 0;
const KI_GLUEON = 1;
const KI_SIZE = 2;

/**
 * Les reglages acceptes (2026-10-23, Q7 du controle qualite, Mika : "d'extreme bonne qualite") : chaque cle du moteur,
 * sa plage (la plus large que voyager/params.ts engineParams peut donner, une marge de 1.5) et si elle est entiere (un
 * code : arrondi, borne). Une valeur qui n'est pas un nombre fini est ignoree (la precedente reste) : un NaN entre dans
 * les lissages et y restait pour toujours (sm += (x - NaN) K), une cle inconnue est laissee de cote.
 */
const P_RANGE = {
  wave1: [0, 5],
  wave2: [0, 4],
  tune1: [-64, 48],
  tune2: [-64, 48],
  fine1: [-75, 75],
  fine2: [-75, 75],
  osc1: [0, 1.32],
  osc2: [0, 1.32],
  fm: [0, 1.5],
  ratio: [0.25, 10.5],
  glide: [0, 0.93],
  noise: [0, 1.5],
  lfoBeats: [0.0625, 24],
  lfoAmt: [0, 1.5],
  bpm: [10, 600],
  cutoff: [20, 28500],
  res: [0, 1.5],
  envOct: [0, 9],
  fA: [0, 3],
  fD: [0, 3],
  fS: [0, 1.5],
  fR: [0, 4.5],
  aA: [0, 3],
  aD: [0, 3],
  aS: [0, 1.5],
  aR: [0, 4.5],
  drive: [0, 1.5],
  phase: [-1, 1],
  drift: [0, 3],
  width: [0, 0.66],
  keyTrack: [0, 1.5],
  sub: [0, 1.32],
  accFlt: [0, 1.5],
  outLevel: [0, 1.5],
  stack: [0, 45],
  wide: [0, 1.5],
  load: [0, 1],
  glue: [0, 1.5],
};
/** Les codes (entiers) : MODE (0 MOOG, 1 LP12, 2 BP, 3 HP), forme et cible du LFO, SYNC, octave et forme du SUB. */
const P_INT = { fmode: [0, 4], lfoShape: [0, 4], lfoDest: [0, 4], sync: [0, 1], subOct: [1, 2], subWave: [0, 3] };
/**
 * La garde d'une voix (2026-10-23) : une sortie de filtre hors de +/-VOICE_GUARD (jamais atteint par un son legal : HP
 * a fond d'OVERDRIVE, toutes les sources au maximum, reste sous 30) remet la voix au repos, sans bruit.
 */
const VOICE_GUARD = 64;
/** Sous ce niveau, un etat recursif est remis a 0 en fin de bloc (pas de sous-normaux, 2026-10-23). */
const TINY = 1e-20;
/**
 * Le passe-bas avant le filtre (2026-10-23, Mika : "que le son soit d'extreme bonne qualite") : un Butterworth a 4
 * poles a PRE_HZ (deux etages TPT, Q 0.5412 et 1.3066), a chaque echantillon surechantillonne, sur l'entree de l'echelle
 * (celle de droite aussi). Les etages satures de l'echelle melangeaient les restes de PolyBLEP et les images du bruit
 * au-dessus de 20 kHz : repliement (une scie C7 de 65.4 a 82.0 dB de purete en x4, de 57.6 a 63.2 en x2). Le chemin
 * ouvert : -0.02 dB a 10 kHz, -0.37 dB a 15 kHz (x2 : -0.01 et -0.24).
 */
const PRE_HZ = 20000;
const PRE_Q = [0.5411961, 1.306563];
/**
 * L'etat d'une voix en tableau type (2026-10-23, zero allocation ; les etats ajoutes depuis y vivent) : le passe-bas
 * avant le filtre (gauche P1A, P1B, P2A, P2B ; droite Q...), la place des suivants.
 */
const VX_P1A = 0;
const VX_P1B = 1;
const VX_P2A = 2;
const VX_P2B = 3;
const VX_Q1A = 4;
const VX_Q1B = 5;
const VX_Q2A = 6;
const VX_Q2B = 7;
/**
 * La saturation de sortie de la voix (S5), gauche puis droite : l'entree d'avant (TZ), lncosh de celle-ci (TF) et si
 * TF est a jour (TV).
 */
const VX_TZL = 8;
const VX_TFL = 9;
const VX_TVL = 10;
const VX_TZR = 11;
const VX_TFR = 12;
const VX_TVR = 13;
/** MS-10 (S11) : gauche KC, KB, KP, KQ, KY ; droite de meme ; K35 tourne (KON) ; son g (G35). */
const VX_KCL = 16;
const VX_KBL = 17;
const VX_KPL = 18;
const VX_KQL = 19;
const VX_KYL = 20;
const VX_KCR = 21;
const VX_KBR = 22;
const VX_KPR = 23;
const VX_KQR = 24;
const VX_KYR = 25;
const VX_KON = 26;
const VX_G35 = 27;
/** LOAD (S12), gauche puis droite : l'entree d'avant de la courbe et sa primitive, le bloqueur de continu, en route (LON). */
const VX_LZL = 28;
const VX_LFL = 29;
const VX_LXL = 30;
const VX_LHL = 31;
const VX_LZR = 32;
const VX_LFR = 33;
const VX_LXR = 34;
const VX_LHR = 35;
const VX_LON = 36;
const VX_SIZE = 40;
/**
 * La saturation de sortie des voix sans repliement (2026-10-23, S5, Mika : "que le son soit d'extreme bonne
 * qualite") : la meme tanh (le grain des sons gardes), par son integrale lncosh (ADAA du premier ordre, la table
 * LNC) : (lncosh(z) - lncosh(z1)) / (z - z1) ; quand z bouge de moins de VS_EPS, la pente de la table au milieu (tanh),
 * et lncosh(z1) n'est calculee qu'au besoin. La courbe algebrique z / sqrt(1 + 2/3 z^2) du plan changeait le timbre
 * des sons gardes des qu'OVERDRIVE monte (H3 -2.8 dB, H5 -6.1 dB a OVERDRIVE 1) : non.
 */
const VS_EPS = 1e-6;
/**
 * L'ADAA moyenne deux echantillons dans sa partie lineaire : cos(pi f / fs), -0.47 dB a 10 kHz et -1.09 dB a 15 kHz au
 * telephone. Le bus la compense (S5) sur le son propre : y[n] = (1 + 2c) x[n-1] - c (x[n] + x[n-2]), c = VS_COMP, gain
 * 1 + 4c sin^2(w/2) (l'inverse au second ordre), un echantillon surechantillonne de retard ; la branche OVERDRIVE prend
 * la somme d'avant la FIR (devant sa courbe, la FIR poussait le haut : OD06 C8 x4 65.1 -> 63.2 dB) et rejoint le propre
 * un echantillon plus tard (alignee ; sans, les bandes hautes d'EBM et d'ACID au telephone bougeaient de 1 dB).
 */
const VS_COMP = 1 / 8;

class MMVoyager extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    // Le hasard (2026-10-22) : a graine (processorOptions.seed, les tests et le futur plugin), sinon Math.random
    this.rnd = Number.isFinite(o.seed) ? mulberry32(o.seed) : unseeded();
    // Les tirages de DRIFT d'un bloc (2026-10-23) : six par voix (trois marches, deux oscillateurs)
    this.rndBuf = new Float64Array(6 * MAX_VOICES);
    const rnd = this.rnd;
    this.voices = [];
    // 8 voix au telephone (2026-10-21, audit : 12 voix en x4 jusqu'a -86 dB prenaient 70 a 135 % du temps reel)
    const nv = Number.isInteger(o.maxVoices) && o.maxVoices >= 1 && o.maxVoices <= MAX_VOICES ? o.maxVoices : MAX_VOICES;
    for (let i = 0; i < nv; i += 1) this.voices.push(new Voice(rnd));
    // STACK (2026-10-22) : trois exemplaires au plus (deux au telephone), l'ecart lisse d'un bloc a l'autre (cents)
    this.maxStack = Number.isInteger(o.maxStack) && o.maxStack >= 1 && o.maxStack <= MAX_STACK ? o.maxStack : MAX_STACK;
    // WIDE : les notes qui ont leur echelle de droite au plus en meme temps (4 au telephone : au-dela, une note neuve
    // joue au centre de sa place, une seule echelle ; toutes sur ordinateur)
    this.wideVoices = Number.isInteger(o.wideVoices) && o.wideVoices >= 0 ? o.wideVoices : MAX_VOICES;
    this.stD = 0;
    this.stDK = 1 - Math.exp(-128 / (STACK_D_S * sampleRate));
    // GLUE (2026-10-22) : son reglage lisse, le detecteur (valeur efficace), le gain, la dose, l'arrondi et ses entrees
    // d'avant (gauche, droite), au rythme du contexte pour le detecteur, du surechantillonnage pour l'arrondi
    this.gl = { g: 0, env: 0, avg: 0, gain: 1, mix: 0, k: 1, w: 1, mi: 0, mo: 0, gc: 1, thr: GLUE_THR0, mk: 0 };
    // 2026-10-23 : les nombres d'un echantillon entre process et busTick, la somme des voix (gauche, droite)
    this.ks = new Float64Array(KS_SIZE);
    this.ki = new Int32Array(KI_SIZE);
    this.acc = new Float64Array(2);
    this.glL = { x: 0, F: 0 };
    this.glRt = { x: 0, F: 0 };
    this.glK = coef(GLUE_S, sampleRate);
    this.glA = coef(GLUE_ATK_S, sampleRate);
    this.glR = coef(GLUE_REL_S, sampleRate);
    this.glAvg = coef(GLUE_AVG_S, sampleRate);
    this.queue = [];
    this.age = 0;
    const os = o.os === 1 || o.os === 2 || o.os === 4 ? o.os : OS_DEFAULT;
    this.os = os;
    this.sr2 = sampleRate * os;
    // Le bloc surechantillonne, l'etage intermediaire, et les decimateurs (4x -> 2x, 2x -> 1x)
    this.raw = new Float32Array(os * 128);
    this.rawR = new Float32Array(os * 128);
    this.mid = new Float32Array(256);
    this.midR = new Float32Array(256);
    // K1' (2026-10-23, Q2) : le premier etage du x4 (4x -> 2x) en Kaiser 9 (avant 7) : son pire repli de -79.9 a -94.3
    // dB (77.9 kHz -> 18.1 kHz), les memes 31 coefficients, ondulation 0.0003 dB, aucun calcul en plus
    this.d4 = os === 4 ? new Decimator(31, 9) : null;
    this.d2 = os >= 2 ? new Decimator(63, 8) : null;
    this.d4R = os === 4 ? new Decimator(31, 9) : null;
    this.d2R = os >= 2 ? new Decimator(63, 8) : null;
    // OVERDRIVE : etats des filtres de la branche saturee (gauche, droite) et coefficients a la frequence du calcul
    // (dL, dxL, dR, dxR : son bloqueur de continu, 2026-10-21)
    // 2026-10-23 (S4) : l'entree et l'integrale de la courbe a l'echantillon d'avant (uL, FL, uR, FR ; fL, fR : FL et
    // FR a jour), la branche allumee a l'echantillon d'avant (on : au retour, l'ADAA repart de l'entree du moment)
    this.od = { hpL: 0, xL: 0, lpL: 0, hpR: 0, xR: 0, lpR: 0, dL: 0, dxL: 0, dR: 0, dxR: 0, uL: 0, FL: 0, uR: 0, FR: 0, fL: 0, fR: 0, on: 0, pL: 0, pR: 0, wL: 0, wR: 0 };
    this.odHp = Math.exp((-2 * Math.PI * OD_HP_HZ) / this.sr2);
    this.odLp = 1 - Math.exp((-2 * Math.PI * OD_TONE_HZ) / this.sr2);
    // K2 (S5) : le pole sur l'entree de la courbe d'OVERDRIVE, au telephone seulement (1 : sans)
    this.odPre = os === 2 ? 1 - Math.exp((-2 * Math.PI * OD_PRE_HZ) / this.sr2) : 1;
    this.odDc = Math.exp((-2 * Math.PI * OD_DC_HZ) / this.sr2);
    // Le bloqueur de continu de la sortie (sortie, entree d'avant : gauche, puis droite), a la frequence du calcul
    this.dc = [0, 0, 0, 0];
    // La compensation de la saturation des voix (S5) : x[n-1] et x[n-2], gauche puis droite
    this.vsc = new Float64Array(4);
    this.dcK = Math.exp((-2 * Math.PI * OUT_DC_HZ) / this.sr2);
    // LOAD (S12) : son bloqueur de continu par voix, le rattrapage du VCA (calcule quand LOAD bouge)
    this.ldDc = Math.exp((-2 * Math.PI * LD_DC_HZ) / this.sr2);
    this.ldLast = -1;
    this.ldMk = 1;
    this.panK = coef(PAN_S, this.sr2);
    // Le passe-bas avant le filtre (2026-10-23) : pour chaque etage, g = tan(pi f / fs), 2R + g et 1 / (1 + 2Rg + g^2)
    const pg = Math.tan((Math.PI * PRE_HZ) / this.sr2);
    this.preG = pg;
    this.preA1 = 1 / PRE_Q[0] + pg;
    this.preH1 = 1 / (1 + pg / PRE_Q[0] + pg * pg);
    this.preA2 = 1 / PRE_Q[1] + pg;
    this.preH2 = 1 / (1 + pg / PRE_Q[1] + pg * pg);
    // STACK : le glissement du gain d'un exemplaire (2026-10-22)
    this.stK = coef(STACK_S, this.sr2);
    // La sortie de la saturation des voix, normalisee (calculee quand OVERDRIVE bouge)
    this.outDrive = -1;
    this.outNorm = 1;
    // Une note a gauche, la suivante a droite
    this.flip = false;
    // MODE du filtre : le poids de chaque sortie (LP 24, LP 12, BP, HP), en fondu
    // MODE : MOOG, LP12, BP, HP, MS-10 (code 4, S11 ; les codes 0 a 3 inchanges pour le banc et le plugin)
    this.wm = [1, 0, 0, 0, 0];
    // MOD : la sortie adoucie du LFO (sa phase vient du transport, plus bas)
    this.lfoOut = 0;
    this.lfoK = coef(0.002, this.sr2);
    this.p = {
      wave1: 2,
      wave2: 2,
      tune1: 0,
      tune2: -12,
      fine1: -8,
      fine2: 8,
      osc1: 0.62,
      osc2: 0.62,
      fm: 0,
      ratio: 1,
      glide: 0,
      noise: 0,
      fmode: 0,
      lfoBeats: 4,
      lfoShape: 0,
      lfoDest: 0,
      lfoAmt: 0,
      bpm: 130,
      cutoff: 800,
      res: 0.3,
      envOct: 3,
      fA: 0.001,
      fD: 0.3,
      fS: 0.2,
      fR: 0.3,
      aA: 0.002,
      aD: 0.35,
      aS: 0.6,
      aR: 0.3,
      drive: 0,
      phase: -1,
      drift: 1,
      width: 0.22,
      keyTrack: 0.5,
      sync: 0,
      sub: 0,
      subOct: 1,
      subWave: 0,
      // 2026-10-21 : ACCENT vers le filtre (0 : le niveau seul, le son d'avant) ; le niveau de sortie apres VOLUME
      // (audio/synth.ts, pour l'ecreteur ; 0 : pas d'ecreteur)
      accFlt: 0,
      outLevel: 0,
      // 2026-10-22 : STACK (l'ecart en cents, 0 : un seul exemplaire), WIDE (0 a 1), GLUE (0 a 1) ; a 0, le son d'avant
      stack: 0,
      wide: 0,
      // LOAD (S12) : 0, le son d'avant
      load: 0,
      glue: 0,
    };
    // Valeurs lissees (un pole, environ 15 ms) : pas de craquement quand un potard tourne
    this.sm = { w1: 2, w2: 2, o1: 0.62, o2: 0.62, fm: 0, noise: 0, sub: 0, lfoAmt: 0, f1: -8, f2: 8, cutoff: 800, res: 0.3, envOct: 3, drive: 0, wide: 0, load: 0 };
    this.smK = coef(0.015, this.sr2);
    this.c = {};
    if (o.params) this.setParams(o.params);
    // Le filtre part sur le MODE demande (2026-10-23 : avant, du MOOG en fondu de 15 ms)
    for (let m = 0; m < 5; m += 1) this.wm[m] = m === this.p.fmode ? 1 : 0;
    // Les remises au repos de la garde (une voix, le bus) depuis la creation (tests)
    this.heals = 0;
    Object.assign(this.sm, { w1: this.p.wave1, w2: this.p.wave2, o1: this.p.osc1, o2: this.p.osc2, fm: this.p.fm, noise: this.p.noise, sub: this.p.sub, lfoAmt: this.p.lfoAmt, f1: this.p.fine1, f2: this.p.fine2, cutoff: this.p.cutoff, res: this.p.res, envOct: this.p.envOct, drive: this.p.drive, wide: this.p.wide, load: this.p.load });
    this.stD = this.p.stack;
    this.gl.g = this.p.glue;
    this.coefs();
    // MOD cale sur la mesure (2026-10-18) : la position du transport en temps, la droite de la derniere ancre
    // (temps = b + (echantillon - f) x k, k : temps par echantillon du contexte) ; libre au depart, au tempo
    this.tp = { f: currentFrame, b: 0, k: this.p.bpm / 60 / sampleRate, run: false };
    this.tpLocked = false;
    // Les ancres a venir (l'arpegiateur les envoie avec leur instant), dans l'ordre
    this.beats = [];
    // Le hasard (S&H, RND) : le cycle en cours, sa valeur et celle du cycle suivant
    // -1 (2026-10-23, NaN avant) : le premier cycle (jamais negatif) tire tout de suite, comme avant
    this.rIdx = -1;
    this.rA = rnd() * 2 - 1;
    this.rB = nextRandom(this.rA, rnd);
    // Tests sans son (audio/synth.ts renderSynthOffline) : probe, la sortie dit le LFO (gauche : sa forme, droite :
    // la position en temps) ; timeline, des messages a leur instant, comme ceux du port
    this.probe = o.probe === true;
    this.pL = new Float32Array(128);
    this.pR = new Float32Array(128);
    this.timeline = Array.isArray(o.timeline) ? o.timeline.filter((x) => x && x.msg && Number.isFinite(x.at)).sort((a, b) => a.at - b.at) : [];
    if (o.notes) for (const n of o.notes) this.add(n);
    if (o.beats) for (const b of o.beats) this.addBeat(b);
    this.port.onmessage = (e) => this.onMsg(e.data);
  }

  /** Une ancre du transport ('beat') : a time (temps du contexte), la position beat (en temps), au tempo bpm jusqu'a la suivante ; run : le premier pas d'un RUN. */
  addBeat(m) {
    if (!m || !Number.isFinite(m.time) || !Number.isFinite(m.beat)) return;
    const bpm = Number.isFinite(m.bpm) && m.bpm > 0 ? m.bpm : this.p.bpm;
    // Son instant pose sur la grille surechantillonnee (comme une note sur son echantillon) : la frontiere d'un cycle
    // tombe sur un echantillon calcule, jamais a un bruit de flottant pres (un pas pile sur un echantillon)
    const OS = this.os;
    const a = { f: Math.round(m.time * sampleRate * OS) / OS, b: m.beat, k: bpm / 60 / sampleRate, run: m.run === true };
    const q = this.beats;
    let i = q.length;
    while (i > 0 && q[i - 1].f > a.f) i -= 1;
    q.splice(i, 0, a);
  }

  /** Les ancres arrivees a l'echantillon x (fractionnaire au surechantillonnage) : la derniere tient la position. */
  dueBeats(x) {
    const q = this.beats;
    while (q.length > 0 && q[0].f <= x) {
      const a = q.shift();
      this.tp = a;
      this.tpLocked = true;
      // Un RUN : le hasard repart d'un nouveau tirage
      if (a.run) this.rIdx = -1;
    }
  }

  /** La position du transport (en temps) a l'echantillon x. */
  beatAt(x) {
    const tp = this.tp;
    return tp.b + (x - tp.f) * tp.k;
  }

  /** Le transport libre (STOP, tempo change a l'arret) : il continue d'ou il est, au tempo du moment. */
  freeRun(x) {
    this.tp = { f: x, b: this.beatAt(x), k: this.p.bpm / 60 / sampleRate, run: false };
    this.tpLocked = false;
  }

  /**
   * MOD : la forme du LFO a la position cyc (en cycles depuis le debut du transport) ; le hasard avance pile au debut
   * de chaque cycle (la valeur du cycle : celle qu'il visait, puis un nouveau tirage pour le suivant).
   */
  lfoRaw(cyc, shape) {
    const c = Math.floor(cyc);
    if (c !== this.rIdx) {
      this.rIdx = c;
      this.rA = this.rB;
      this.rB = nextRandom(this.rA, this.rnd);
    }
    const ph = cyc - c;
    switch (shape) {
      case 1:
        return 1 - 2 * ph;
      case 2:
        return ph < 0.5 ? 1 : -1;
      case 3:
        return this.rA;
      case 4:
        return this.rA + (this.rB - this.rA) * ph * ph * (3 - 2 * ph);
      default:
        return 1 - 4 * Math.abs(ph - 0.5);
    }
  }

  coefs() {
    // Les enveloppes et GLIDE avancent a la frequence surechantillonnee
    const sr = this.sr2;
    const p = this.p;
    // Attaque vers 1.3 : elle atteint 1 en A (courbe de condensateur)
    this.c.aAtk = coef(p.aA / 1.466, sr);
    this.c.fAtk = coef(p.fA / 1.466, sr);
    // Decroissance et relachement : -40 dB en D et R
    this.c.aDec = coef(p.aD / 4.6, sr);
    this.c.fDec = coef(p.fD / 4.6, sr);
    this.c.aRel = coef(p.aR / 4.6, sr);
    this.c.fRel = coef(p.fR / 4.6, sr);
    this.c.quick = coef(0.012, sr);
    this.c.glide = p.glide > 0 ? coef(p.glide / 3, sr) : 1;
  }

  add(n) {
    // Une note sans hauteur, sans instant ou sans duree (2026-10-23, Q7) n'entre pas ; la porte peut etre sans fin
    // (+Infinity : noteOff), l'accent borne a 0..2 (absent ou 0 : 1, comme avant)
    if (!n || !Number.isFinite(n.midi) || !Number.isFinite(n.time) || typeof n.gate !== 'number' || !(n.gate > 0)) return;
    const ac = n.accent || 1;
    if (!Number.isFinite(ac)) return;
    const frame = Math.round(n.time * sampleRate);
    const q = this.queue;
    let i = q.length;
    while (i > 0 && q[i - 1].frame > frame) i -= 1;
    q.splice(i, 0, { frame, midi: n.midi, gate: n.gate, accent: ac < 0 ? 0 : ac > 2 ? 2 : ac, from: Number.isFinite(n.from) ? n.from : null });
  }

  /**
   * Des reglages (2026-10-23, Q7) : chaque cle connue, un nombre fini, bornee a sa plage (P_RANGE), un code arrondi
   * (P_INT) ; le reste ignore. Rend true si bpm a ete pris.
   */
  setParams(src) {
    if (!src || typeof src !== 'object') return false;
    const p = this.p;
    let bpm = false;
    for (const key in src) {
      const v = src[key];
      if (typeof v !== 'number' || !Number.isFinite(v)) continue;
      const r = P_RANGE[key];
      if (r !== undefined) {
        p[key] = v < r[0] ? r[0] : v > r[1] ? r[1] : v;
        if (key === 'bpm') bpm = true;
        continue;
      }
      const ri = P_INT[key];
      if (ri !== undefined) {
        const n = Math.round(v);
        p[key] = n < ri[0] ? ri[0] : n > ri[1] ? ri[1] : n;
      }
    }
    return bpm;
  }

  onMsg(m) {
    if (!m || typeof m !== 'object') return;
    if (m.type === 'note') this.add(m);
    else if (m.type === 'beat') this.addBeat(m);
    else if (m.type === 'params') {
      const bpm = this.setParams(m.params);
      this.coefs();
      // Un tempo, transport libre (ou plus d'ancre depuis une seconde) : la position continue au nouveau tempo ;
      // en lecture, ce sont les ancres qui portent le tempo, a la frontiere de pas ou il change
      const stale = this.beats.length === 0 && currentFrame - this.tp.f > sampleRate;
      if (bpm && (!this.tpLocked || stale)) this.freeRun(currentFrame);
    } else if (m.type === 'probe') {
      // Debug (window.__v4.voyager.synth.lfo) : le LFO maintenant, lu par le meme calcul que le son
      const x = currentFrame;
      this.dueBeats(x);
      const beat = this.beatAt(x);
      const cycle = beat / Math.max(0.0625, this.p.lfoBeats);
      const raw = this.lfoRaw(cycle, this.p.lfoShape);
      this.port.postMessage({ type: 'probe', id: m.id, frame: x, beat, cycle, raw, out: this.lfoOut, locked: this.tpLocked, bpm: this.tp.k * 60 * sampleRate, shape: this.p.lfoShape, pending: this.beats.length });
    } else if (m.type === 'cancel') {
      // Re-programmation (2026-10-05) : les notes attendues a partir de time sont oubliees, ce qui sonne continue ;
      // les ancres du transport aussi (2026-10-18 : l'arpegiateur renvoie les memes)
      const f = Math.round((m.time || 0) * sampleRate);
      this.queue = this.queue.filter((n) => n.frame < f);
      this.beats = this.beats.filter((a) => a.f < f - 0.5);
    } else if (m.type === 'noteOff') {
      // Un vrai relachement (2026-10-22, audit VST3 : un clavier MIDI, un clip d'Ableton, le futur plugin) : la note
      // midi relachee a time (temps du contexte ; tout de suite sans lui), jamais avant ses 64 premiers echantillons ;
      // une note jouee sans fin (gate infini) ne s'arrete que la. Les voix qui la jouent, et ses departs attendus avant
      // time. L'arpegiateur n'en envoie pas (ses notes ont leur duree) : rien ne change pour lui.
      const f = Number.isFinite(m.time) ? Math.round(m.time * sampleRate) : currentFrame;
      for (const v of this.voices) if (v.on && v.midi === m.midi && v.aStage < 3) v.off = Math.min(v.off, Math.max(f, v.start + 64));
      for (const n of this.queue) if (n.midi === m.midi && n.frame <= f) n.gate = Math.min(n.gate, Math.max(64, f - n.frame) / sampleRate);
    } else if (m.type === 'stop') {
      // STOP : plus rien d'attendu, ce qui sonne s'eteint en 12 ms ; le LFO tourne librement au tempo
      const f = Math.round((m.time || 0) * sampleRate);
      this.queue = this.queue.filter((n) => n.frame < f);
      // Le transport s'arrete : les ancres passees comptent, celles a venir n'ont plus de sens
      this.dueBeats(currentFrame);
      this.beats.length = 0;
      this.freeRun(currentFrame);
      for (const v of this.voices) {
        if (!v.on) continue;
        v.aStage = 3;
        v.fStage = 3;
        v.quick = true;
      }
    }
  }

  noteOn(n, frame) {
    let v = null;
    const vs = this.voices;
    for (let i = 0; i < vs.length; i += 1) {
      const x = vs[i];
      if (!x.on) v = v && v.age < x.age ? v : x;
    }
    const fresh = v !== null;
    if (!v) {
      // Plus de voix libre : elle repart de son niveau (pas de clic). La plus discrete des voix deja relachees
      // (2026-10-21, audit ; avant, la plus ancienne, encore sonore parfois), sinon la plus ancienne
      for (let i = 0; i < vs.length; i += 1) if (vs[i].aStage === 3 && (!v || vs[i].aV < v.aV)) v = vs[i];
      if (!v) for (let i = 0; i < vs.length; i += 1) if (!v || vs[i].age < v.age) v = vs[i];
    }
    if (fresh) {
      // Une voix neuve : filtre au repos (celui de droite de WIDE aussi), phases libres
      v.s1 = v.s2 = v.s3 = v.s4 = 0;
      v.pu = 0;
      v.aV = 0;
      v.fV = 0;
      const fr = v.fr;
      fr.pu = fr.s1 = fr.s2 = fr.s3 = fr.s4 = 0;
      for (let j = 0; j < v.pr.length; j += 1) v.pr[j].sb = v.pr[j].sf = 0;
      v.x.fill(0);
    }
    v.g = 0;
    for (let j = 0; j < v.pr.length; j += 1) {
      v.pr[j].q1 = NaN;
      v.pr[j].q2 = NaN;
    }
    const target = Math.log(midiHz(n.midi));
    v.logT = target;
    v.logf = this.p.glide > 0 && n.from !== null ? Math.log(midiHz(n.from)) : target;
    v.midi = n.midi;
    // Nouvelle hauteur : les pas de phase se recalculent au prochain echantillon
    v.d1 = 0;
    v.on = true;
    v.quick = false;
    v.aStage = 1;
    v.fStage = 1;
    v.off = frame + Math.max(64, Math.round(n.gate * sampleRate));
    v.start = frame;
    v.accent = n.accent;
    // ACCENT vers le filtre (2026-10-21, accFlt ; 0 : le niveau seul, comme avant) : une note appuyee ouvre plus
    // l'enveloppe et la coupure, son filtre retombe plus vite (l'accent de la 303) ; une note douce s'assombrit ;
    // l'ecart de niveau se resserre un peu (le filtre porte une part de l'accent)
    const af = this.p.accFlt > 0 ? Math.min(1, this.p.accFlt) : 0;
    const acc = n.accent - 1;
    v.envAcc = Math.max(0, 1 + ACC_ENV * af * acc);
    v.cutAcc = ACC_CUT * af * acc;
    v.fdm = 1 / Math.max(0.5, 1 - (0.5 * af * Math.max(0, acc)) / 0.24);
    v.ampAcc = af > 0 ? Math.pow(Math.max(1e-3, n.accent), 1 - 0.4 * af) : n.accent;
    // PHASE : la note repart de la meme phase (voix muette ou presque : pas de clic)
    const p = this.p;
    const quiet = v.aV < PHASE_QUIET;
    if (p.phase >= 0 && quiet) {
      const P = v.pr[0];
      P.a = p.phase;
      P.b = p.phase;
      P.m = p.phase;
      v.subPh = p.phase;
    }
    // Presque analogique (DRIFT) : chaque note a ses petits ecarts, et sa place dans l'image (WIDTH)
    const dr = p.drift;
    const rnd = this.rnd;
    // L'exposant de l'ecart de coupure garde (S11, B7 : le MS-10 le reduit pres de l'auto-oscillation), le meme tirage
    const vce = (rnd() - 0.5) * 0.08 * dr;
    v.vCutE = vce;
    v.vCut = Math.pow(2, vce);
    v.vEnv = 1 + (rnd() - 0.5) * 0.1 * dr;
    v.vTune = (rnd() - 0.5) * 3 * dr;
    this.flip = !this.flip;
    const pan = (this.flip ? 1 : -1) * p.width * (0.7 + 0.3 * rnd());
    v.tL = Math.cos(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    v.tR = Math.sin(((pan + 1) * Math.PI) / 4) * Math.SQRT2;
    // Une voix muette prend sa place d'un coup ; une voix volee en plein son y glisse (PAN_S, plus de tic)
    if (quiet) {
      v.gL = v.tL;
      v.gR = v.tR;
    }
    this.stackOn(v, p.stack > 0 ? this.maxStack : 1, quiet, p.phase);
    // WIDE : la note a son echelle de droite s'il en reste (une voix reprise en plein son garde la sienne : pas de saut).
    // WIDE revenu a OFF, une voix muette repart sans elle (2026-10-22, relecture : la voix la gardait jusqu'ici, process)
    if (quiet) {
      if (this.sm.wide === 0) v.wl = false;
      let busy = 0;
      for (let i = 0; i < vs.length; i += 1) if (vs[i].on && vs[i] !== v && vs[i].wideOK) busy += 1;
      v.wideOK = busy < this.wideVoices;
    }
    this.age += 1;
    v.age = this.age;
  }

  /**
   * STACK (2026-10-22) : les exemplaires de la note (n), leur place dans l'ecart et dans WIDE, leur gain ; une voix
   * muette les prend d'un coup, une voix reprise en plein son y glisse (STACK_S : pas de clic). Un exemplaire jamais
   * servi tire ses phases a son premier usage ; PHASE (phase >= 0) les place a des phases fixes, decalees l'une de
   * l'autre (la meme attaque a chaque note, sans les additionner en phase).
   */
  stackOn(v, n, quiet, phase) {
    v.n = n;
    const gt = n === 1 ? 1 : 1 / Math.sqrt(n);
    const offs = STACK_OFF[n - 1];
    const pans = STACK_PAN[n - 1];
    let loop = 1;
    for (let j = 0; j < MAX_STACK; j += 1) {
      const P = v.pr[j];
      if (j < n) {
        if (!P.live) {
          P.a = this.rnd();
          P.b = this.rnd();
          P.m = this.rnd();
          P.live = true;
          P.g = 0;
        }
        if (j > 0 && phase >= 0 && quiet) {
          const ph = phase + 0.37 * j;
          P.a = ph - Math.floor(ph);
          P.b = P.a;
          P.m = P.a;
        }
        P.gt = gt;
        P.off = offs[j];
        P.r = P.off === 0 ? 1 : Math.pow(2, (P.off * this.stD) / 1200);
        P.pan1 = n === 1 ? STACK_PAN1[0] : pans[j];
        P.pan2 = n === 1 ? STACK_PAN1[1] : pans[j];
      } else P.gt = 0;
      if (quiet) P.g = P.gt;
      if (P.gt > 0 || P.g > 1e-5) loop = j + 1;
    }
    v.nLoop = loop;
  }

  /**
   * Les voix pour un echantillon surechantillonne (2026-10-23, sorties de process, au bit pres) : enveloppes,
   * oscillateurs, filtre, VCA ; leur somme dans this.acc (gauche, droite). Les nombres de l'echantillon dans this.ks et
   * this.ki (process).
   */

  /**
   * Le bus d'un echantillon surechantillonne (2026-10-23, sorti de process, au bit pres) : OVERDRIVE, le bloqueur de
   * continu de la sortie, GLUE, l'ecreteur doux ; la somme des voix dans this.acc, la sortie dans raw et rawR.
   */
  busTick(i2) {
    const p = this.p;
    const acc = this.acc;
    const ks = this.ks;
    const ki = this.ki;
    const raw = this.raw;
    const rawR = this.rawR;
    const dc = this.dc;
    const dcK = this.dcK;
    const gl = this.gl;
    let sum = acc[0];
    let sumR = acc[1];
    const odGain = ks[KS_ODGAIN];
    const odMix = ks[KS_ODMIX];
    const odTrim = ks[KS_ODTRIM];
    const clipT = ks[KS_CLIPT];
    const clipW = ks[KS_CLIPW];
    const newNoise = ki[KI_NEWNOISE] === 1;
    const glueOn = ki[KI_GLUEON] === 1;
    // La compensation de la moyenne de l'ADAA des voix (2026-10-23, S5) : sur le propre (cl, cr) ; la branche OVERDRIVE
    // part de la somme des voix telle quelle et rejoint le propre un echantillon plus tard (le retard de la FIR)
    const vsc = this.vsc;
    // LOAD (S12) : sa seconde ADAA : c = (1 + wet) / 8
    const vc = ks[KS_VSC];
    const cl = (1 + 2 * vc) * vsc[0] - vc * (sum + vsc[1]);
    vsc[1] = vsc[0];
    vsc[0] = sum;
    const cr = (1 + 2 * vc) * vsc[2] - vc * (sumR + vsc[3]);
    vsc[3] = vsc[2];
    vsc[2] = sumR;
    // OVERDRIVE : le propre + la branche sans graves, amplifiee, arrondie, adoucie, sans continu (2026-10-21)
    if (odMix > 1e-4) {
      const od = this.od;
      const hpA = this.odHp;
      const lpA = this.odLp;
      const dA = this.odDc;
      const odPre = this.odPre;
      od.hpL = hpA * (od.hpL + sum - od.xL);
      od.xL = sum;
      // K2 (S5) : le pole d'avant la courbe, au telephone
      od.pL += (od.hpL - od.pL) * odPre;
      // La courbe par son integrale (ADAA, 2026-10-23, S4) : au retour de la branche, elle repart de l'entree du moment
      const uL = od.pL * odGain;
      const fresh = od.on === 0;
      if (fresh) {
        od.uL = uL;
        od.fL = 0;
        od.on = 1;
      }
      const duL = uL - od.uL;
      let yL;
      if (duL > OD_ADAA_EPS || duL < -OD_ADAA_EPS) {
        if (od.fL === 0) {
          const z1 = od.uL + OD_BIAS;
          const a1 = z1 < 0 ? -z1 : z1;
          let F1 = a1 - LN2;
          if (a1 < LNC_MAX) {
            const q1 = a1 * LNC_INV;
            const i1 = q1 | 0;
            const t1 = q1 - i1;
            const k1 = 4 * i1;
            F1 = LNC[k1] + t1 * (LNC[k1 + 1] + t1 * (LNC[k1 + 2] + t1 * LNC[k1 + 3]));
          }
          od.FL = F1 - od.uL * OD_TANH_BIAS;
        }
        const zL = uL + OD_BIAS;
        const aL = zL < 0 ? -zL : zL;
        let GL = aL - LN2;
        if (aL < LNC_MAX) {
          const q0 = aL * LNC_INV;
          const i0 = q0 | 0;
          const t0 = q0 - i0;
          const k0 = 4 * i0;
          GL = LNC[k0] + t0 * (LNC[k0 + 1] + t0 * (LNC[k0 + 2] + t0 * LNC[k0 + 3]));
        }
        const FL = GL - uL * OD_TANH_BIAS;
        yL = (FL - od.FL) / duL;
        od.FL = FL;
        od.fL = 1;
      } else {
        const mL = 0.5 * (uL + od.uL);
        yL = mL < OD_LIN_U && mL > -OD_LIN_U ? mL * OD_SECH2 * (1 - mL * OD_TANH_BIAS) : Math.tanh(mL + OD_BIAS) - OD_TANH_BIAS;
        od.fL = 0;
      }
      od.uL = uL;
      od.lpL += (yL - od.lpL) * lpA;
      od.dL = dA * (od.dL + od.lpL - od.dxL);
      od.dxL = od.lpL;
      sum = (cl + od.wL * odMix) * odTrim;
      od.wL = od.dL;
      od.hpR = hpA * (od.hpR + sumR - od.xR);
      od.xR = sumR;
      od.pR += (od.hpR - od.pR) * odPre;
      const uR = od.pR * odGain;
      if (fresh) {
        od.uR = uR;
        od.fR = 0;
      }
      const duR = uR - od.uR;
      let yR;
      if (duR > OD_ADAA_EPS || duR < -OD_ADAA_EPS) {
        if (od.fR === 0) {
          const z1 = od.uR + OD_BIAS;
          const a1 = z1 < 0 ? -z1 : z1;
          let F1 = a1 - LN2;
          if (a1 < LNC_MAX) {
            const q1 = a1 * LNC_INV;
            const i1 = q1 | 0;
            const t1 = q1 - i1;
            const k1 = 4 * i1;
            F1 = LNC[k1] + t1 * (LNC[k1 + 1] + t1 * (LNC[k1 + 2] + t1 * LNC[k1 + 3]));
          }
          od.FR = F1 - od.uR * OD_TANH_BIAS;
        }
        const zR = uR + OD_BIAS;
        const aR = zR < 0 ? -zR : zR;
        let GR = aR - LN2;
        if (aR < LNC_MAX) {
          const q0 = aR * LNC_INV;
          const i0 = q0 | 0;
          const t0 = q0 - i0;
          const k0 = 4 * i0;
          GR = LNC[k0] + t0 * (LNC[k0 + 1] + t0 * (LNC[k0 + 2] + t0 * LNC[k0 + 3]));
        }
        const FR = GR - uR * OD_TANH_BIAS;
        yR = (FR - od.FR) / duR;
        od.FR = FR;
        od.fR = 1;
      } else {
        const mR = 0.5 * (uR + od.uR);
        yR = mR < OD_LIN_U && mR > -OD_LIN_U ? mR * OD_SECH2 * (1 - mR * OD_TANH_BIAS) : Math.tanh(mR + OD_BIAS) - OD_TANH_BIAS;
        od.fR = 0;
      }
      od.uR = uR;
      od.lpR += (yR - od.lpR) * lpA;
      od.dR = dA * (od.dR + od.lpR - od.dxR);
      od.dxR = od.lpR;
      sumR = (cr + od.wR * odMix) * odTrim;
      od.wR = od.dR;
    } else {
      this.od.on = 0;
      sum = cl;
      sumR = cr;
    }
    // Sortie : sans continu (8 Hz, 2026-10-21 : la SYNC, la FM et les saturations en laissaient), puis l'ecreteur doux
    let yl = sum * OUT_GAIN;
    let yr = sumR * OUT_GAIN;
    dc[0] = dcK * (dc[0] + yl - dc[1]);
    dc[1] = yl;
    yl = dc[0];
    dc[2] = dcK * (dc[2] + yr - dc[3]);
    dc[3] = yr;
    yr = dc[2];
    // GLUE (2026-10-22) : le compresseur (son detecteur et son gain au rythme du contexte), puis l'arrondi des cretes
    // (ADAA, a chaque echantillon surechantillonne), dose en fondu sur le premier quart du potard
    if (glueOn) {
      if (newNoise) {
        gl.g += (p.glue - gl.g) * this.glK;
        if (p.glue === 0 && gl.g < 1e-5) gl.g = 0;
        const ms = 0.5 * (yl * yl + yr * yr);
        gl.env += (ms - gl.env) * (ms > gl.env ? this.glA : this.glR);
        // Le niveau moyen (la valeur efficace sur GLUE_AVG_S) : il part du premier son entendu, puis le suit lentement
        if (gl.env > 1e-9) gl.avg = gl.avg <= 0 ? gl.env : gl.avg + (gl.env - gl.avg) * this.glAvg;
        // glueGr ecrite ici (2026-10-23, zero allocation)
        const over = LN_DB * Math.log(gl.env + 1e-12) - gl.thr;
        let gr = 0;
        if (over <= -GLUE_KNEE / 2) gr = 0;
        else if (over >= GLUE_KNEE / 2) gr = GLUE_SLOPE * over;
        else {
          const t = over + GLUE_KNEE / 2;
          gr = (GLUE_SLOPE * t * t) / (2 * GLUE_KNEE);
        }
        gl.gain = Math.exp((gl.mk - gr) * DB_LN);
        gl.mix = gl.g >= 0.25 ? 1 : 4 * gl.g;
      }
      const zl = yl * gl.gain;
      const zr = yr * gl.gain;
      // glueAdaa, glueClipF et glueClip ecrites ici (2026-10-23, zero allocation), la gauche puis la droite
      let cl = 0;
      let cr = 0;
      const gk = gl.k;
      const gw = gl.w;
      for (let ch = 0; ch < 2; ch += 1) {
        const st = ch === 0 ? this.glL : this.glRt;
        const xg = ch === 0 ? zl : zr;
        const x1 = st.x;
        const ax = xg < 0 ? -xg : xg;
        const a1 = x1 < 0 ? -x1 : x1;
        let y;
        let F;
        if (ax <= gk && a1 <= gk) {
          y = 0.5 * (xg + x1);
          F = 0.5 * xg * xg;
        } else {
          if (ax <= gk) F = 0.5 * xg * xg;
          else {
            const u = ax - gk;
            // Les deux morceaux toujours calcules (le plateau, rare, ne fait plus repartir le compilateur a son premier
            // passage, 2026-10-23), le meme nombre choisi
            const Fa = 0.5 * gk * gk + gk * u + 0.5 * u * u - (u * u * u) / (12 * gw);
            const Fb = 0.5 * gk * gk + 2 * gk * gw + (4 / 3) * gw * gw + (gk + gw) * (u - 2 * gw);
            F = u < 2 * gw ? Fa : Fb;
          }
          const d = xg - x1;
          if (d < 1e-7 && d > -1e-7) {
            const xm = 0.5 * (xg + x1);
            const am = xm < 0 ? -xm : xm;
            if (am <= gk) y = xm;
            else {
              const u = am - gk;
              const ya = gk + gw;
              const yb = gk + u - (u * u) / (4 * gw);
              const yy = u >= 2 * gw ? ya : yb;
              y = xm < 0 ? -yy : yy;
            }
          } else y = (F - st.F) / d;
        }
        st.x = xg;
        st.F = F;
        if (ch === 0) cl = y;
        else cr = y;
      }
      // Ce que l'arrondi retire en valeur efficace, suivi sur GLUE_AVG_S (rendu par bloc, gl.gc) : la meme sonie
      if (newNoise) {
        gl.mi += (zl * zl + zr * zr - gl.mi) * this.glAvg;
        gl.mo += (cl * cl + cr * cr - gl.mo) * this.glAvg;
      }
      cl *= gl.gc;
      cr *= gl.gc;
      yl += (cl - yl) * gl.mix;
      yr += (cr - yr) * gl.mix;
    }
    if (yl > clipT) yl = clipT + clipW * Math.tanh((yl - clipT) / clipW);
    else if (yl < -clipT) yl = -clipT - clipW * Math.tanh((-yl - clipT) / clipW);
    if (yr > clipT) yr = clipT + clipW * Math.tanh((yr - clipT) / clipW);
    else if (yr < -clipT) yr = -clipT - clipW * Math.tanh((-yr - clipT) / clipW);
    // La garde du bus (2026-10-23, Q7) : une sortie non finie remet OVERDRIVE, le bloqueur et GLUE au repos
    if (!(yl - yl === 0 && yr - yr === 0)) {
      this.restBus();
      this.heals += 1;
      yl = 0;
      yr = 0;
    }
    raw[i2] = yl;
    rawR[i2] = yr;
  }

  /** Une voix au repos (2026-10-23) : son filtre, celui de droite (WIDE), les corrections de la SYNC. */
  rest(v) {
    v.pu = v.s1 = v.s2 = v.s3 = v.s4 = 0;
    const fr = v.fr;
    fr.pu = fr.s1 = fr.s2 = fr.s3 = fr.s4 = fr.u = fr.y1 = fr.y2 = fr.y = 0;
    for (let j = 0; j < v.pr.length; j += 1) v.pr[j].sb = v.pr[j].sf = 0;
    v.x.fill(0);
  }

  /** Le bus au repos (2026-10-23) : OVERDRIVE, le bloqueur de continu de la sortie, GLUE. */
  restBus() {
    const od = this.od;
    od.hpL = od.xL = od.lpL = od.hpR = od.xR = od.lpR = od.dL = od.dxL = od.dR = od.dxR = 0;
    od.uL = od.FL = od.uR = od.FR = od.fL = od.fR = od.on = od.pL = od.pR = od.wL = od.wR = 0;
    const dc = this.dc;
    dc[0] = dc[1] = dc[2] = dc[3] = 0;
    this.vsc.fill(0);
    const gl = this.gl;
    gl.env = gl.mi = gl.mo = 0;
    gl.gain = 1;
    this.glL.x = this.glL.F = this.glRt.x = this.glRt.F = 0;
  }

  /**
   * Les sous-normaux (2026-10-23, Q6 : jusqu'a 1.5e-323 dans la branche OVERDRIVE de six presets, figes pendant le
   * silence) : en fin de bloc, chaque etat recursif du bus sous TINY repart de 0 (un ecart sous -400 dB). Et les voix
   * allumees (2026-10-23, S3) : une note tenue dont OSC 1, OSC 2, SUB et NOISE passent a 0 laissait les niveaux lisses,
   * l'echelle puis le passe-bas d'avant le filtre descendre dans les sous-normaux apres une dizaine de secondes.
   */
  flushTiny() {
    const sm = this.sm;
    if (sm.o1 < TINY && sm.o1 > -TINY) sm.o1 = 0;
    if (sm.o2 < TINY && sm.o2 > -TINY) sm.o2 = 0;
    if (sm.fm < TINY && sm.fm > -TINY) sm.fm = 0;
    if (sm.noise < TINY && sm.noise > -TINY) sm.noise = 0;
    if (sm.sub < TINY && sm.sub > -TINY) sm.sub = 0;
    if (sm.lfoAmt < TINY && sm.lfoAmt > -TINY) sm.lfoAmt = 0;
    if (sm.drive < TINY && sm.drive > -TINY) sm.drive = 0;
    if (sm.wide < TINY && sm.wide > -TINY) sm.wide = 0;
    const vs = this.voices;
    for (let i = 0; i < vs.length; i += 1) {
      const v = vs[i];
      if (!v.on) continue;
      if (v.s1 < TINY && v.s1 > -TINY) v.s1 = 0;
      if (v.s2 < TINY && v.s2 > -TINY) v.s2 = 0;
      if (v.s3 < TINY && v.s3 > -TINY) v.s3 = 0;
      if (v.s4 < TINY && v.s4 > -TINY) v.s4 = 0;
      if (v.pu < TINY && v.pu > -TINY) v.pu = 0;
      const fr = v.fr;
      if (fr.s1 < TINY && fr.s1 > -TINY) fr.s1 = 0;
      if (fr.s2 < TINY && fr.s2 > -TINY) fr.s2 = 0;
      if (fr.s3 < TINY && fr.s3 > -TINY) fr.s3 = 0;
      if (fr.s4 < TINY && fr.s4 > -TINY) fr.s4 = 0;
      if (fr.pu < TINY && fr.pu > -TINY) fr.pu = 0;
      if (fr.u < TINY && fr.u > -TINY) fr.u = 0;
      if (fr.y1 < TINY && fr.y1 > -TINY) fr.y1 = 0;
      if (fr.y2 < TINY && fr.y2 > -TINY) fr.y2 = 0;
      const X = v.x;
      for (let j = 0; j < VX_SIZE; j += 1) if (X[j] < TINY && X[j] > -TINY) X[j] = 0;
    }
    const od = this.od;
    if (od.hpL < TINY && od.hpL > -TINY) od.hpL = 0;
    if (od.xL < TINY && od.xL > -TINY) od.xL = 0;
    if (od.lpL < TINY && od.lpL > -TINY) od.lpL = 0;
    if (od.dL < TINY && od.dL > -TINY) od.dL = 0;
    if (od.dxL < TINY && od.dxL > -TINY) od.dxL = 0;
    if (od.hpR < TINY && od.hpR > -TINY) od.hpR = 0;
    if (od.xR < TINY && od.xR > -TINY) od.xR = 0;
    if (od.lpR < TINY && od.lpR > -TINY) od.lpR = 0;
    if (od.dR < TINY && od.dR > -TINY) od.dR = 0;
    if (od.dxR < TINY && od.dxR > -TINY) od.dxR = 0;
    if (od.uL < TINY && od.uL > -TINY) od.uL = 0;
    if (od.uR < TINY && od.uR > -TINY) od.uR = 0;
    if (od.pL < TINY && od.pL > -TINY) od.pL = 0;
    if (od.pR < TINY && od.pR > -TINY) od.pR = 0;
    if (od.wL < TINY && od.wL > -TINY) od.wL = 0;
    if (od.wR < TINY && od.wR > -TINY) od.wR = 0;
    const dc = this.dc;
    for (let i = 0; i < 4; i += 1) if (dc[i] < TINY && dc[i] > -TINY) dc[i] = 0;
    const vsc = this.vsc;
    for (let i = 0; i < 4; i += 1) if (vsc[i] < TINY && vsc[i] > -TINY) vsc[i] = 0;
    const gl = this.gl;
    if (gl.env < TINY) gl.env = 0;
    if (gl.mi < TINY) gl.mi = 0;
    if (gl.mo < TINY) gl.mo = 0;
    const a = this.glL;
    const b = this.glRt;
    if (a.x < TINY && a.x > -TINY) a.x = 0;
    if (a.F < TINY && a.F > -TINY) a.F = 0;
    if (b.x < TINY && b.x > -TINY) b.x = 0;
    if (b.F < TINY && b.F > -TINY) b.F = 0;
  }

  /** DRIFT (2026-10-21) : les trois marches au hasard de chaque oscillateur des voix qui sonnent, une fois par bloc de N. */
  driftStep(N) {
    const dtB = N / sampleRate;
    if (this.walkDt !== dtB) {
      this.walkDt = dtB;
      // Par marche : son coefficient et l'amplitude de son tirage (ecart type tenu, tirage uniforme)
      this.walkC = DRIFT_WALKS.map(([tau, sd]) => {
        const a = Math.exp(-dtB / tau);
        return [a, sd * Math.sqrt(1 - a * a) * 3.4641];
      });
    }
    const wc = this.walkC;
    const vs0 = this.voices;
    // Les tirages du bloc d'un coup, dans l'ordre ou les marches les prennent (la meme suite qu'avant)
    let need = 0;
    for (let vi = 0; vi < vs0.length; vi += 1) if (vs0[vi].on) need += 2 * wc.length;
    const rb = this.rndBuf;
    this.rnd.fill(rb, need);
    let ri = 0;
    for (let vi = 0; vi < vs0.length; vi += 1) {
      const v = vs0[vi];
      if (!v.on) continue;
      for (let k = 0; k < 2; k += 1) {
        let d = 0;
        for (let j = 0; j < wc.length; j += 1) {
          const w = v.walk[j];
          w[k] = w[k] * wc[j][0] + (rb[ri] - 0.5) * wc[j][1];
          ri += 1;
          d += w[k];
        }
        v.drift[k] = d > DRIFT_MAX ? DRIFT_MAX : d < -DRIFT_MAX ? -DRIFT_MAX : d;
      }
    }
  }

  process(_inputs, outputs) {
    const out = outputs[0];
    const L = out[0];
    const R = out.length > 1 ? out[1] : null;
    const N = L.length;
    const sr = this.sr2;
    const t0 = currentFrame;
    // Tests (processorOptions.timeline) : les messages dont l'instant est venu, entre deux blocs comme ceux du port
    const tl = this.timeline;
    while (tl.length > 0 && tl[0].at * sampleRate <= t0) this.onMsg(tl.shift().msg);
    const q = this.queue;
    const lfoBeats = Math.max(0.0625, this.p.lfoBeats);
    let active = false;
    const vs0 = this.voices;
    for (let i = 0; i < vs0.length; i += 1) if (vs0[i].on) active = true;
    // Le bloqueur de continu de la sortie finit sa queue avant le silence (2026-10-21 : sans elle, une marche)
    const dc = this.dc;
    const dcBusy = Math.abs(dc[0]) + Math.abs(dc[1]) + Math.abs(dc[2]) + Math.abs(dc[3]) > 1e-7;
    if (!this.probe && !active && !dcBusy && (q.length === 0 || q[0].frame >= t0 + N)) {
      L.fill(0);
      if (R) R.fill(0);
      dc[0] = dc[1] = dc[2] = dc[3] = 0;
      // GLUE : son detecteur retombe pendant le silence (le retour), l'arrondi repart de 0
      const gl = this.gl;
      if (gl.env > 0) gl.env = gl.env < 1e-15 ? 0 : gl.env * Math.pow(1 - this.glR, N);
      this.glL.x = this.glL.F = 0;
      this.glRt.x = this.glRt.F = 0;
      this.flushTiny();
      // Silence : l'historique des demi-bandes repart a zero
      if (this.d4) this.d4.clear();
      if (this.d2) this.d2.clear();
      if (this.d4R) this.d4R.clear();
      if (this.d2R) this.d2R.clear();
      // MOD : le transport avance quand meme (ses ancres, le hasard tire au debut de chaque cycle) ; la sortie du
      // LFO y est deja quand une note revient
      const x = t0 + N - 1;
      this.dueBeats(x);
      this.lfoOut = this.lfoRaw(this.beatAt(x) / lfoBeats, this.p.lfoShape);
      return true;
    }
    // DRIFT (2026-10-21) : la derive de chaque oscillateur, trois marches au hasard bornees (lente, moyenne, rapide),
    // une fois par bloc (sa methode, 2026-10-23 : le hasard y rend ses nombres sans les mettre en boite)
    this.driftStep(N);
    const p = this.p;
    const sm = this.sm;
    const c = this.c;
    const K = this.smK;
    // La coupure du filtre reste sous la bande utile du contexte
    const nyq = sampleRate * 0.45;
    // MS-10 (S11) : sa coupure la plus haute
    const fcMax35 = Math.min(nyq, this.os === 4 ? MS_FC_MAX4 : MS_FC_MAX2);
    const OS = this.os;
    if (this.raw.length < OS * N) {
      this.raw = new Float32Array(OS * N);
      this.rawR = new Float32Array(OS * N);
    }
    if (this.mid.length < 2 * N) {
      this.mid = new Float32Array(2 * N);
      this.midR = new Float32Array(2 * N);
    }
    const raw = this.raw;
    const rawR = this.rawR;
    const beats = this.beats;
    const probe = this.probe;
    if (probe && this.pL.length < N) {
      this.pL = new Float32Array(N);
      this.pR = new Float32Array(N);
    }
    const voices = this.voices;
    const nv = voices.length;
    const panK = this.panK;
    const stK = this.stK;
    const dcK = this.dcK;
    const preG = this.preG;
    const ldDc = this.ldDc;
    const preA1 = this.preA1;
    const preH1 = this.preH1;
    const preA2 = this.preA2;
    const preH2 = this.preH2;
    // STACK (2026-10-22) : l'ecart lisse d'un bloc a l'autre, le rapport de chaque exemplaire des voix qui sonnent
    if (this.stD !== p.stack) {
      const dd = p.stack - this.stD;
      this.stD = dd < 1e-3 && dd > -1e-3 ? p.stack : this.stD + dd * this.stDK;
      for (let vi = 0; vi < nv; vi += 1) {
        const v = voices[vi];
        if (!v.on) continue;
        for (let j = 0; j < v.nLoop; j += 1) {
          const P = v.pr[j];
          P.r = P.off === 0 ? 1 : Math.pow(2, (P.off * this.stD) / 1200);
        }
      }
    }
    // GLUE (2026-10-22) : a 0 et revenu a 0, contourne (le son d'avant au bit pres)
    const gl = this.gl;
    const glueOn = p.glue > 0 || gl.g > 0;
    if (glueOn) {
      // Une fois par bloc (ils bougent lentement) : le seuil, le rattrapage (la reduction au niveau moyen), ce que
      // l'arrondi retire en valeur efficace (au plus +6 dB), le genou et le plafond de l'arrondi
      gl.thr = GLUE_THR0 - GLUE_THR_SPAN * gl.g;
      // glueGr, ecrite ici (2026-10-23, zero allocation : un appel avec un nombre le met en boite a chaque fois)
      let mk = 0;
      if (gl.avg > 0) {
        const over = LN_DB * Math.log(gl.avg) - gl.thr;
        if (over <= -GLUE_KNEE / 2) mk = 0;
        else if (over >= GLUE_KNEE / 2) mk = GLUE_SLOPE * over;
        else {
          const t = over + GLUE_KNEE / 2;
          mk = (GLUE_SLOPE * t * t) / (2 * GLUE_KNEE);
        }
      }
      gl.mk = mk;
      const r = gl.mo > 1e-12 ? Math.sqrt(gl.mi / gl.mo) : 1;
      gl.gc = r < 1 ? 1 : r > 2 ? 2 : r;
      const ceil = 1 / (1 + GLUE_DRIVE * gl.g);
      const kk = GLUE_KNEE_AT * ceil;
      if (kk !== gl.k) {
        // Un autre genou : la primitive gardee de l'entree d'avant suit
        gl.k = kk;
        gl.w = ceil - kk;
        this.glL.F = glueClipF(this.glL.x, gl.k, gl.w);
        this.glRt.F = glueClipF(this.glRt.x, gl.k, gl.w);
      }
    }
    // L'ecreteur de sortie (2026-10-21) : ses seuils en niveau du moteur (outLevel : le gain de VOLUME apres lui)
    const lvl = p.outLevel > 1e-6 ? p.outLevel : 0;
    const clipT = lvl > 0 ? CLIP_KNEE / lvl : Infinity;
    const clipW = lvl > 0 ? (CLIP_CEIL - CLIP_KNEE) / lvl : 1;
    // Les fonctions des seuls reglages (this.p ne change qu'entre deux blocs) : une fois par bloc, au bit pres (2026-10-23)
    const dest = p.lfoDest;
    const lfoShape = p.lfoShape;
    const subDiv = p.subOct === 2 ? 0.25 : 0.5;
    const subW = p.subWave === 1 ? 1 : p.subWave === 3 ? 3 : 0;
    const ratio1 = Math.pow(2, p.tune1 / 12);
    const ratio2 = Math.pow(2, p.tune2 / 12);
    const drift = p.drift;
    const sync = p.sync === 1;
    // S10 (2026-10-23) : la borne de l'indice FM (largeur de Carson) : 0.25 au telephone (sous 24 kHz), 0.4 en x4
    const fmB = this.os === 2 ? FM_B_PHONE : 0.4;
    // Les nombres du bloc pour busTick (2026-10-23), une fois
    const ks = this.ks;
    const ki = this.ki;
    ks[KS_CLIPT] = clipT;
    ks[KS_CLIPW] = clipW;
    ki[KI_GLUEON] = glueOn ? 1 : 0;
    for (let i2 = 0; i2 < OS * N; i2 += 1) {
      const i = (i2 / OS) | 0;
      const fr = t0 + i;
      if (i2 % OS === 0) while (q.length > 0 && q[0].frame <= fr) this.noteOn(q.shift(), fr);
      // MOD : la position du transport a cet echantillon (une ancre de l'arpege prend effet a son instant exact,
      // au surechantillonnage pres), en cycles du LFO, puis sa forme, adoucie
      const x = fr + (i2 - i * OS) / OS;
      if (beats.length > 0 && beats[0].f <= x) this.dueBeats(x);
      const tp = this.tp;
      const pos = tp.b + (x - tp.f) * tp.k;
      // lfoRaw, ecrite ici (2026-10-23, zero allocation) : le hasard avance pile au debut de chaque cycle
      const cyc = pos / lfoBeats;
      const cI = Math.floor(cyc);
      if (cI !== this.rIdx) {
        this.rIdx = cI;
        this.rA = this.rB;
        this.rB = nextRandom(this.rA, this.rnd);
      }
      const lph = cyc - cI;
      let lraw;
      if (lfoShape === 1) lraw = 1 - 2 * lph;
      else if (lfoShape === 2) lraw = lph < 0.5 ? 1 : -1;
      else if (lfoShape === 3) lraw = this.rA;
      else if (lfoShape === 4) lraw = this.rA + (this.rB - this.rA) * lph * lph * (3 - 2 * lph);
      else lraw = 1 - 4 * Math.abs(lph - 0.5);
      if (probe && i2 - i * OS === 0) {
        this.pL[i] = lraw;
        this.pR[i] = pos;
      }
      this.lfoOut += (lraw - this.lfoOut) * this.lfoK;
      sm.lfoAmt += (p.lfoAmt - sm.lfoAmt) * K;
      const lfo = this.lfoOut * sm.lfoAmt;
      const waveMod = dest === 0 ? 2 * lfo : dest === 4 ? lfo : 0;
      const cutMod = dest === 1 ? 3 * lfo : dest === 4 ? 1.5 * lfo : 0;
      const pitchMod = dest === 3 ? 100 * lfo : 0;
      sm.fm += (p.fm - sm.fm) * K;
      const fmEff = dest === 2 ? Math.min(1, Math.max(0, sm.fm + 0.6 * lfo)) : sm.fm;
      const fmDepth = fmEff * fmEff * FM_MAX;
      sm.noise += (p.noise - sm.noise) * K;
      const nGain = sm.noise * sm.noise * NOISE_MAX;
      // SUB : son gain (deja au carre, params.ts), son octave sous la note, sa forme
      sm.sub += (p.sub - sm.sub) * K;
      const g3 = sm.sub;
      const newNoise = i2 % OS === 0;
      // MODE du filtre : chaque sortie glisse vers son poids (1 pour le mode choisi)
      const wm = this.wm;
      for (let m = 0; m < 5; m += 1) wm[m] += ((m === p.fmode ? 1 : 0) - wm[m]) * K;
      // WAVE : la position de chaque morphing (lissee, poussee par MOD), la forme de depart et la part de la suivante
      sm.w1 += (p.wave1 - sm.w1) * K;
      sm.w2 += (p.wave2 - sm.w2) * K;
      const pw1 = Math.min(5, Math.max(0, sm.w1 + waveMod));
      const pw2 = Math.min(4, Math.max(0, sm.w2 + 0.8 * waveMod));
      const i1 = Math.min(4, Math.floor(pw1));
      const f1m = pw1 - i1;
      const i2w = Math.min(3, Math.floor(pw2));
      const f2m = pw2 - i2w;
      // PWM (2026-10-21) : entre SQUARE et PULSE, une seule impulsion dont la largeur glisse (avant : le fondu de deux)
      const pwm1 = i1 === 3 && f1m > 1e-4;
      const pwm2 = i2w === 3 && f2m > 1e-4;
      const pwd1 = pwm1 ? pwOf(3, f1m) : 0.5;
      const pwd2 = pwm2 ? pwOf(3, f2m) : 0.5;
      // OSC 1 et OSC 2 : le gain de chaque oscillateur (0.62 chacun au depart, le MIX au centre d'avant) ; a 0, coupe (lisse, pas de clic)
      sm.o1 += (p.osc1 - sm.o1) * K;
      sm.o2 += (p.osc2 - sm.o2) * K;
      const g1 = sm.o1;
      const g2 = sm.o2;
      // RANGE et SEMI de chaque oscillateur (ratio1, ratio2 : en haut du bloc) ; FINE en cents, lisse
      sm.f1 += (p.fine1 - sm.f1) * K;
      sm.f2 += (p.fine2 - sm.f2) * K;
      const fine1 = sm.f1;
      const fine2 = sm.f2;
      sm.cutoff += (p.cutoff - sm.cutoff) * K;
      sm.res += (p.res - sm.res) * K;
      sm.envOct += (p.envOct - sm.envOct) * K;
      sm.drive += (p.drive - sm.drive) * K;
      // WIDE (2026-10-22) : lisse ; revenu a 0, l'echelle de droite s'arrete (le calcul d'avant) a la note suivante
      // de chaque voix (plus bas, wideV)
      if (sm.wide !== p.wide) {
        sm.wide += (p.wide - sm.wide) * K;
        if (p.wide === 0 && sm.wide < 1e-4) sm.wide = 0;
      }
      const wideOn = sm.wide > 0;
      // LOAD (S12) : lisse, ramene a 0 net ; ses nombres de l'echantillon
      if (sm.load !== p.load) {
        sm.load += (p.load - sm.load) * K;
        if (p.load === 0 && sm.load < 1e-4) sm.load = 0;
      }
      const ldL = sm.load;
      const ldOn = ldL > 0;
      let ldG = 1;
      let ldB = 0;
      let ldWet = 0;
      let ldMk = 1;
      let ldRel = 1;
      if (ldOn) {
        ldG = 1 + 4 * ldL * ldL;
        ldB = LD_BIAS * ldL;
        ldWet = ldL >= 0.05 ? 1 : ldL / 0.05;
        if (ldL !== this.ldLast) {
          this.ldLast = ldL;
          this.ldMk = Math.pow(ldG, -LD_MK);
        }
        ldMk = this.ldMk;
        ldRel = 1 - 0.7 * (ldL >= 0.1 ? 1 : ldL / 0.1);
      }
      // WIDE sans STACK (2026-10-22, relecture : OSC 2 a 0, la note partait a gauche, +18 dB a WIDE 10) : OSC 1 et
      // OSC 2 se partagent les cotes selon leur equilibre en puissance (gain^2 x WAVE_POW : la somme des puissances
      // x place reste au centre) ; un oscillateur seul reste au milieu, deux a la meme puissance gardent STACK_PAN1
      // (le calcul d'avant, au bit pres). pn2w : le carre moyen des deux places, pour la puissance egale
      let pn1 = STACK_PAN1[0];
      let pn2 = STACK_PAN1[1];
      let pn2w = STACK_PAN2[0];
      // wavePow ecrite ici (2026-10-23, zero allocation)
      const a1 = wideOn ? g1 * g1 * (pwm1 ? 4 * pwd1 * (1 - pwd1) : f1m > 1e-4 ? WAVE_POW[i1] + (WAVE_POW[i1 + 1] - WAVE_POW[i1]) * f1m : WAVE_POW[i1]) : 0;
      const a2 = wideOn ? g2 * g2 * (pwm2 ? 4 * pwd2 * (1 - pwd2) : f2m > 1e-4 ? WAVE_POW[i2w] + (WAVE_POW[i2w + 1] - WAVE_POW[i2w]) * f2m : WAVE_POW[i2w]) : 0;
      if (a1 !== a2) {
        const am = a1 > a2 ? a1 : a2;
        if (am > 1e-12) {
          pn1 = (STACK_PAN1[0] * a2) / am;
          pn2 = (STACK_PAN1[1] * a1) / am;
          pn2w = (a1 * pn1 * pn1 + a2 * pn2 * pn2) / (a1 + a2);
        } else pn1 = pn2 = pn2w = 0;
      }
      const k = resK(sm.res);
      // S7 : la coupure remontee au-dessus du seuil (octaves), 0 en dessous
      const kTune = k > 4 ? (K_COMP * (k - 4)) / 1200 : 0;
      const driveIn = 1 + 2.5 * sm.drive;
      const driveOut = 1 + 1.5 * sm.drive;
      // La normalisation de la saturation des voix : une fois quand OVERDRIVE bouge (avant : pour chaque voix)
      if (sm.drive !== this.outDrive) {
        this.outDrive = sm.drive;
        this.outNorm = 1 / Math.pow(driveOut, 0.82);
      }
      const outNorm = this.outNorm;
      // LOAD (S12) : la saturation de sortie soulagee (a LOAD 0 : les nombres d'avant)
      const dO = ldOn ? driveOut * ldRel : driveOut;
      const oN = ldOn ? outNorm / ldRel : outNorm;
      // OVERDRIVE : le gain de la branche saturee (progressif : les premiers crans chauffent a peine), le niveau
      // compense (OD_TRIM, puis la mesure OD_COMP)
      const odGain = 1 + OD_GAIN * sm.drive * sm.drive;
      const odMix = OD_MIX * Math.min(1, sm.drive * 4);
      // odComp ecrite ici (2026-10-23, zero allocation)
      let odTrim = 1;
      if (odMix > 1e-4) {
        const dv = sm.drive;
        let oc = 1;
        if (dv > 0) {
          oc = OD_COMP[OD_COMP.length - 1];
          for (let ci = 1; ci < OD_COMP_AT.length; ci += 1) {
            if (dv <= OD_COMP_AT[ci]) {
              const t = (dv - OD_COMP_AT[ci - 1]) / (OD_COMP_AT[ci] - OD_COMP_AT[ci - 1]);
              oc = OD_COMP[ci - 1] + (OD_COMP[ci] - OD_COMP[ci - 1]) * t;
              break;
            }
          }
        }
        odTrim = oc / (1 + OD_TRIM * sm.drive);
      }
      // Les graves gardes en passe-bas (BASS_KEEP), et les poids des sorties de l'echelle (Xpander), communs aux voix
      const keep = 1 + k * BASS_KEEP;
      const w0 = wm[0] > 1e-4 ? wm[0] * keep : 0;
      const w1 = wm[1] > 1e-4 ? (wm[1] * keep) / (1 + k * SLOPE12_RES) : 0;
      const w2 = wm[2] > 1e-4 ? (wm[2] * 2 * BP_GAIN) / (1 + k * BP_RES) : 0;
      const w3 = wm[3] > 1e-4 ? (wm[3] * HP_GAIN) / (1 + k * HP_RES) : 0;
      // MS-10 (S11) : son poids, kappa (la table de RES), K, le depassement, la reduction des ecarts (B7) ; l'echelle
      // ne tourne pas quand ses quatre poids sont nuls (ses etats remis a 0 une fois)
      const w4 = wm[4] > 1e-4 ? wm[4] * MS_GAIN : 0;
      const ladOn = w0 !== 0 || w1 !== 0 || w2 !== 0 || w3 !== 0;
      let kap = 0;
      let c35o = 0;
      let sB7 = 1;
      if (w4 !== 0) {
        const rr = sm.res;
        if (rr >= 1) kap = MS_KAPPA[7];
        else if (rr > 0) {
          let mi = 1;
          while (mi < 7 && rr > MS_RES_AT[mi]) mi += 1;
          kap = MS_KAPPA[mi - 1] + ((MS_KAPPA[mi] - MS_KAPPA[mi - 1]) * (rr - MS_RES_AT[mi - 1])) / (MS_RES_AT[mi] - MS_RES_AT[mi - 1]);
        }
        if (kap > 1) c35o = (C35 * (kap - 1) * (kap - 1)) / 1200;
        let tb7 = (kap - 0.7) / 0.3;
        tb7 = tb7 <= 0 ? 0 : tb7 >= 1 ? 1 : tb7 * tb7 * (3 - 2 * tb7);
        sB7 = 1 - 0.75 * tb7;
      }
      const KK = (7 / 3) * kap;
      let omK = (kap - 0.93) / 0.04;
      omK = omK <= 0 ? 0 : omK >= 1 ? 1 : omK * omK * (3 - 2 * omK);
      // Le bus (2026-10-23, zero allocation : sa methode, les nombres de l'echantillon dans ks et ki), apres les voix
      ks[KS_ODGAIN] = odGain;
      ks[KS_ODMIX] = odMix;
      ks[KS_ODTRIM] = odTrim;
      ks[KS_VSC] = ldOn ? VS_COMP * (1 + ldWet) : VS_COMP;
      ki[KI_NEWNOISE] = newNoise ? 1 : 0;
      let sum = 0;
      let sumR = 0;
      for (let vi = 0; vi < nv; vi += 1) {
        const v = voices[vi];
        if (!v.on) continue;
        // Enveloppes
        if (v.aStage < 3 && fr >= v.off) {
          v.aStage = 3;
          v.fStage = 3;
        }
        const ve = v.vEnv;
        if (v.aStage === 1) {
          v.aV += (1.3 - v.aV) * c.aAtk * ve;
          if (v.aV >= 1) {
            v.aV = 1;
            v.aStage = 2;
          }
        } else if (v.aStage === 2) v.aV += (p.aS - v.aV) * c.aDec * ve;
        else {
          v.aV -= v.aV * (v.quick ? c.quick : c.aRel * ve);
          // -66 dB (2026-10-21 ; -86 avant) : la queue a -76 dBFS apres VOLUME, inaudible, et 23 % de calcul en moins
          if (v.aV < VOICE_OFF) {
            v.on = false;
            // Ses etats au repos (2026-10-23 : pas de sous-normaux qui restent dans une voix eteinte)
            this.rest(v);
            continue;
          }
        }
        if (v.fStage === 1) {
          v.fV += (1.3 - v.fV) * c.fAtk * ve;
          if (v.fV >= 1) {
            v.fV = 1;
            v.fStage = 2;
          }
        } else if (v.fStage === 2) v.fV += (p.fS - v.fV) * Math.min(1, c.fDec * ve * v.fdm);
        else v.fV -= v.fV * c.fRel * ve;
        // Hauteur et oscillateurs (les pas de phase : une fois par echantillon du contexte)
        v.logf += (v.logT - v.logf) * c.glide;
        if (newNoise || v.d1 === 0) {
          const f = Math.exp(v.logf);
          // DRIFT : la derive, l'ecart de la note et l'etalonnage de la voix, a la part de DRIFT
          v.d1 = (f * ratio1 * Math.pow(2, ((v.drift[0] + v.calT[0]) * drift + fine1 + v.vTune + pitchMod) / 1200)) / sr;
          v.d2 = (f * ratio2 * Math.pow(2, ((v.drift[1] + v.calT[1]) * drift + fine2 + v.vTune + pitchMod) / 1200)) / sr;
          // SUB : la note, une ou deux octaves dessous, avec le FINE et la derive d'OSC 1 (le pas d'OSC 1 sans son RANGE ni son SEMI)
          v.d3 = (v.d1 * subDiv) / ratio1;
        }
        const d1v = v.d1;
        const d2v = v.d2;
        // STACK (2026-10-22) : chaque exemplaire d'OSC 1 et d'OSC 2 (un seul sans STACK : le calcul d'avant), puis le
        // SUB et le bruit, au centre ; WIDE : la gauche et la droite de chaque exemplaire (oL, oR), a puissance egale
        const nl = v.nLoop;
        const pr = v.pr;
        // Une voix qui a son echelle de droite la garde quand WIDE revient a OFF (2026-10-22, relecture : la droite
        // sautait d'une echelle a l'autre, un clic sous une forte resonance) : a WIDE 0, la droite recoit la meme
        // entree que la gauche, sans marche ; elle s'arrete a la prochaine note de la voix, muette (noteOn)
        const wideV = v.wideOK && (wideOn || v.wl);
        const wide = wideV ? sm.wide : 0;
        // Sans STACK, les places d'OSC 1 et d'OSC 2 selon leur equilibre (pn1, pn2, plus haut)
        const one = v.n === 1;
        const wn = wideV ? 1 / Math.sqrt(1 + wide * wide * (one ? pn2w : STACK_PAN2[v.n - 1])) : 1;
        let o = 0;
        let oR = 0;
        for (let j = 0; j < nl; j += 1) {
          const P = pr[j];
          const d1 = d1v * P.r;
          const d2 = d2v * P.r;
          // FM : l'operateur decale la phase des DEUX oscillateurs (indice en radians, suivi de l'enveloppe du filtre)
          const dm = d1 * p.ratio;
          const idx = fmDepth > 0 ? Math.min(fmDepth * (0.35 + 0.65 * Math.min(1, v.fV)), Math.max(0, fmB / dm - 1)) : 0;
          const pm = idx > 0 ? (idx * Math.sin(TAU * P.m)) / TAU : 0;
          // OSC 2 d'abord : il module OSC 1 au cran FM ; chaque forme fondue dans la suivante
          let q2 = P.b + pm;
          q2 -= Math.floor(q2);
          let p1 = P.a + pm;
          p1 -= Math.floor(p1);
          // FM sans repliement (2026-10-21) : PolyBLEP au pas instantane de la phase modulee (avant : le pas sans FM)
          const fmOn = pm !== 0 && P.q1 === P.q1;
          // stepOf ecrite ici (2026-10-23, zero allocation)
          let dt1 = d1;
          let dt2 = d2;
          if (fmOn) {
            let dd = p1 - P.q1;
            if (dd < -0.5) dd += 1;
            else if (dd > 0.5) dd -= 1;
            if (dd < 0) dd = -dd;
            dt1 = dd < 1e-5 ? 1e-5 : dd > 0.5 ? 0.5 : dd;
            if (!sync) {
              dd = q2 - P.q2;
              if (dd < -0.5) dd += 1;
              else if (dd > 0.5) dd -= 1;
              if (dd < 0) dd = -dd;
              dt2 = dd < 1e-5 ? 1e-5 : dd > 0.5 ? 0.5 : dd;
            }
          }
          P.q1 = p1;
          P.q2 = q2;
          // shape, pulse et polyblep ecrites ici (2026-10-23, zero allocation : un appel qui rend un nombre l'alloue) ; la
          // forme (s 0) puis celle vers qui WAVE la fait glisser (s 1)
          let o2 = 0;
          // S8 : juste apres une remise de SYNC, la correction de la phase 0 est celle de la remise (P.sb), pas la forme
          const rs = P.sf === 1;
          P.sf = 0;
          for (let s = 0; s < 2; s += 1) {
            if (s === 1 && !(f2m > 1e-4 && !pwm2)) break;
            const w = i2w + s;
            let y;
            if (!pwm2 && w === 0) y = Math.sin(TAU * q2);
            else if (!pwm2 && w === 1) {
              let q = q2 + 0.25;
              if (q >= 1) q -= 1;
              y = 1 - 4 * Math.abs(q - 0.5);
              // polyBLAMP a 2 points (2026-10-23, S9) : la pente change de 8 dt par echantillon au creux, de -8 dt au sommet
              const kb = (8 * dt2) / 6;
              let xb = q / dt2;
              if (xb < 1) {
                const ub = 1 - xb;
                y += kb * ub * ub * ub;
              }
              xb = (1 - q) / dt2;
              if (xb < 1) {
                const ub = 1 - xb;
                y += kb * ub * ub * ub;
              }
              xb = (q - 0.5) / dt2;
              if (xb > -1 && xb < 1) {
                const ub = 1 - (xb < 0 ? -xb : xb);
                y -= kb * ub * ub * ub;
              }
            } else if (!pwm2 && w === 2) {
              let pb = 0;
              if (q2 < dt2) {
                if (!rs) {
                  const xx = q2 / dt2;
                  pb = xx + xx - xx * xx - 1;
                }
              } else if (q2 > 1 - dt2) {
                const xx = (q2 - 1) / dt2;
                pb = xx * xx + xx + xx + 1;
              }
              y = 1 - 2 * q2 + pb;
            } else {
              const d = pwm2 ? pwd2 : w === 3 ? 0.5 : PULSE_W;
              y = q2 < d ? 1 : -1;
              if (q2 < dt2) {
                if (!rs) {
                  const xx = q2 / dt2;
                  y += xx + xx - xx * xx - 1;
                }
              } else if (q2 > 1 - dt2) {
                const xx = (q2 - 1) / dt2;
                y += xx * xx + xx + xx + 1;
              }
              let t2 = q2 - d;
              if (t2 < 0) t2 += 1;
              if (t2 < dt2) {
                const xx = t2 / dt2;
                y -= xx + xx - xx * xx - 1;
              } else if (t2 > 1 - dt2) {
                const xx = (t2 - 1) / dt2;
                y -= xx * xx + xx + xx + 1;
              }
              y -= 2 * d - 1;
            }
            if (s === 0) o2 = y;
            else o2 += (y - o2) * f2m;
          }
          // SYNC sans repliement (2026-10-21) : la remise de phase d'OSC 2 corrigee par PolyBLEP, sur cet echantillon
          // (avant la remise) et le suivant (apres) ; la marche que la forme corrige deja d'elle-meme a la phase 0 deduite
          if (P.sb !== 0) {
            o2 += P.sb;
            P.sb = 0;
          }
          if (sync && P.a + d1 >= 1 && pm === 0) {
            // La SYNC aux fronts qui se croisent (2026-10-23, S8, Mika : "que le son soit d'extreme bonne qualite") :
            // la remise a tm = 1 - frac apres cet echantillon ; chaque discontinuite d'OSC 2 dans l'intervalle est un
            // evenement date : avant tm elle a lieu (sa demi-correction d'avant est deja dans la forme, celle d'apres va
            // a l'echantillon suivant), apres tm elle n'a jamais lieu (la demi-correction d'avant retiree) ; la marche de
            // la remise juste en valeur (la forme a la phase 0 moins la forme au moment de la remise, apres les fronts
            // gardes) ; l'echantillon d'apres ne corrige pas sa phase 0 lui-meme (P.sf). Chaque discontinuite qui a
            // lieu recoit un PolyBLEP a 2 points a son vrai moment, aucune autre.
            const frac = (P.a + d1 - 1) / d1;
            const tm = 1 - frac;
            let e = q2 + d2 * tm;
            e -= Math.floor(e);
            let cNow = 0;
            let cNext = 0;
            const passes = pwm2 || !(f2m > 1e-4) ? 1 : 2;
            for (let pass = 0; pass < passes; pass += 1) {
              const w = pwm2 ? 3 : i2w + pass;
              const d = pwm2 ? pwd2 : w === 4 ? PULSE_W : 0.5;
              let r1;
              let r0 = 0;
              let cn = 0;
              let cx = 0;
              if (w === 0) r1 = Math.sin(TAU * e);
              else if (w === 1) {
                let qb = e + 0.25;
                if (qb >= 1) qb -= 1;
                r1 = 1 - 4 * Math.abs(qb - 0.5);
              } else {
                r0 = 1;
                r1 = w === 2 ? 1 - 2 * e : e < d ? 1 : -1;
                // Le retour de phase d'OSC 2 dans l'intervalle (marche +2)
                if (q2 > 1 - d2) {
                  const t = (1 - q2) / d2;
                  if (t < tm) cx -= t * t;
                  else {
                    const u = 1 - t;
                    cn -= u * u;
                  }
                }
                // Le front de largeur (marche -2)
                if (w >= 3) {
                  let t2 = q2 - d;
                  if (t2 < 0) t2 += 1;
                  if (t2 > 1 - d2) {
                    const t = (1 - t2) / d2;
                    if (t < tm) cx += t * t;
                    else {
                      const u = 1 - t;
                      cn += u * u;
                    }
                  }
                }
              }
              const h = r0 - r1;
              cn += 0.5 * h * frac * frac;
              cx -= 0.5 * h * tm * tm;
              if (pass === 0) {
                cNow = cn;
                cNext = cx;
              } else {
                cNow += (cn - cNow) * f2m;
                cNext += (cx - cNext) * f2m;
              }
            }
            o2 += cNow;
            P.sb = cNext;
            P.sf = 1;
          } else if (sync && P.a + d1 >= 1) {
            // Sous FM : le calcul d'avant (2026-10-21)
            const frac = (P.a + d1 - 1) / d1;
            let e = P.b + d2 * (1 - frac);
            e -= Math.floor(e);
            const e0 = pm - Math.floor(pm);
            let e1 = e + pm;
            e1 -= Math.floor(e1);
            // rawShape, pwOf et natStep ecrites ici (2026-10-23, zero allocation) : la marche de la forme (pass 0), puis
            // celle vers qui WAVE la fait glisser (pass 1)
            let h = 0;
            let nat = 0;
            const passes = pwm2 || !(f2m > 1e-4) ? 1 : 2;
            for (let pass = 0; pass < passes; pass += 1) {
              const w = pwm2 ? 3 : i2w + pass;
              const d = pwm2 ? pwd2 : w === 4 ? PULSE_W : 0.5;
              let r0;
              let r1;
              if (w === 0) {
                r0 = Math.sin(TAU * e0);
                r1 = Math.sin(TAU * e1);
              } else if (w === 1) {
                let qa = e0 + 0.25;
                if (qa >= 1) qa -= 1;
                r0 = 1 - 4 * Math.abs(qa - 0.5);
                let qb = e1 + 0.25;
                if (qb >= 1) qb -= 1;
                r1 = 1 - 4 * Math.abs(qb - 0.5);
              } else if (w === 2) {
                r0 = 1 - 2 * e0;
                r1 = 1 - 2 * e1;
              } else {
                r0 = e0 < d ? 1 : -1;
                r1 = e1 < d ? 1 : -1;
              }
              const ns = pwm2 || w >= 2 ? 2 : 0;
              if (pass === 0) {
                h = r0 - r1;
                nat = ns;
              } else {
                h += (r0 - r1 - h) * f2m;
                nat += (ns - nat) * f2m;
              }
            }
            if (pm !== 0) nat = 0;
            o2 += 0.5 * h * frac * frac;
            const r = 1 - frac;
            P.sb = -0.5 * (h - nat) * r * r;
          }
          // OSC 1 de meme (shape1 : le cran FM, la sinusoide modulee par OSC 2)
          let o1 = 0;
          for (let s = 0; s < 2; s += 1) {
            if (s === 1 && !(f1m > 1e-4 && !pwm1)) break;
            const w = i1 + s;
            let y;
            if (!pwm1 && w === 0) y = Math.sin(TAU * p1);
            else if (!pwm1 && w === 1) {
              let q = p1 + 0.25;
              if (q >= 1) q -= 1;
              y = 1 - 4 * Math.abs(q - 0.5);
              // polyBLAMP a 2 points (2026-10-23, S9) : la pente change de 8 dt par echantillon au creux, de -8 dt au sommet
              const kb = (8 * dt1) / 6;
              let xb = q / dt1;
              if (xb < 1) {
                const ub = 1 - xb;
                y += kb * ub * ub * ub;
              }
              xb = (1 - q) / dt1;
              if (xb < 1) {
                const ub = 1 - xb;
                y += kb * ub * ub * ub;
              }
              xb = (q - 0.5) / dt1;
              if (xb > -1 && xb < 1) {
                const ub = 1 - (xb < 0 ? -xb : xb);
                y -= kb * ub * ub * ub;
              }
            } else if (!pwm1 && w === 2) {
              let pb = 0;
              if (p1 < dt1) {
                const xx = p1 / dt1;
                pb = xx + xx - xx * xx - 1;
              } else if (p1 > 1 - dt1) {
                const xx = (p1 - 1) / dt1;
                pb = xx * xx + xx + xx + 1;
              }
              y = 1 - 2 * p1 + pb;
            } else if (!pwm1 && w === 5) y = Math.sin(TAU * (P.a + FM_INDEX * o2 * 0.16 + pm));
            else {
              const d = pwm1 ? pwd1 : w === 3 ? 0.5 : PULSE_W;
              y = p1 < d ? 1 : -1;
              if (p1 < dt1) {
                const xx = p1 / dt1;
                y += xx + xx - xx * xx - 1;
              } else if (p1 > 1 - dt1) {
                const xx = (p1 - 1) / dt1;
                y += xx * xx + xx + xx + 1;
              }
              let t2 = p1 - d;
              if (t2 < 0) t2 += 1;
              if (t2 < dt1) {
                const xx = t2 / dt1;
                y -= xx + xx - xx * xx - 1;
              } else if (t2 > 1 - dt1) {
                const xx = (t2 - 1) / dt1;
                y -= xx * xx + xx + xx + 1;
              }
              y -= 2 * d - 1;
            }
            if (s === 0) o1 = y;
            else o1 += (y - o1) * f1m;
          }
          P.a += d1;
          P.b += d2;
          if (P.a >= 1) {
            P.a -= 1;
            // SYNC : OSC 2 repart avec OSC 1, a la fraction d'echantillon pres
            if (sync) P.b = (P.a / d1) * d2;
          }
          if (P.b >= 1) P.b -= Math.floor(P.b);
          P.m += dm;
          P.m -= Math.floor(P.m);
          // Le gain de l'exemplaire (1 sans STACK : le calcul d'avant), qui glisse quand STACK change en plein son
          let gj = 1;
          if (P.g !== P.gt) {
            P.g += (P.gt - P.g) * stK;
            if (P.g - P.gt < 1e-5 && P.gt - P.g < 1e-5) P.g = P.gt;
          }
          if (nl !== 1 || P.g !== 1) gj = P.g;
          if (wideV) {
            const s1 = g1 * o1 * gj * wn;
            const s2 = g2 * o2 * gj * wn;
            const c1 = one && j === 0 ? pn1 : P.pan1;
            const c2 = one && j === 0 ? pn2 : P.pan2;
            o += s1 * (1 - wide * c1) + s2 * (1 - wide * c2);
            oR += s1 * (1 + wide * c1) + s2 * (1 + wide * c2);
          } else if (j === 0) o = gj === 1 ? g1 * o1 + g2 * o2 : gj * (g1 * o1 + g2 * o2);
          else o += gj * (g1 * o1 + g2 * o2);
        }
        // Un exemplaire qui s'est eteint (STACK retire) n'est plus calcule
        if (nl > 1 && pr[nl - 1].gt === 0 && pr[nl - 1].g === 0) v.nLoop = nl - 1;
        // SUB coupe : sa phase s'arrete (il revient en fondu depuis 0, pas de clic) ; le SUB et le bruit au centre (les
        // deux cotes de WIDE), ajoutes dans l'ordre d'avant
        if (g3 > 1e-6) {
          const sph = v.subPh;
          const sdt = v.d3;
          let sy;
          if (!false && subW === 0) sy = Math.sin(TAU * sph);
          else if (!false && subW === 1) {
            let q = sph + 0.25;
            if (q >= 1) q -= 1;
            sy = 1 - 4 * Math.abs(q - 0.5);
            // polyBLAMP a 2 points (2026-10-23, S9) : la pente change de 8 dt par echantillon au creux, de -8 dt au sommet
            const kb = (8 * sdt) / 6;
            let xb = q / sdt;
            if (xb < 1) {
              const ub = 1 - xb;
              sy += kb * ub * ub * ub;
            }
            xb = (1 - q) / sdt;
            if (xb < 1) {
              const ub = 1 - xb;
              sy += kb * ub * ub * ub;
            }
            xb = (q - 0.5) / sdt;
            if (xb > -1 && xb < 1) {
              const ub = 1 - (xb < 0 ? -xb : xb);
              sy -= kb * ub * ub * ub;
            }
          } else if (!false && subW === 2) {
            let pb = 0;
            if (sph < sdt) {
              const xx = sph / sdt;
              pb = xx + xx - xx * xx - 1;
            } else if (sph > 1 - sdt) {
              const xx = (sph - 1) / sdt;
              pb = xx * xx + xx + xx + 1;
            }
            sy = 1 - 2 * sph + pb;
          } else {
            const d = false ? 0 : subW === 3 ? 0.5 : PULSE_W;
            sy = sph < d ? 1 : -1;
            if (sph < sdt) {
              const xx = sph / sdt;
              sy += xx + xx - xx * xx - 1;
            } else if (sph > 1 - sdt) {
              const xx = (sph - 1) / sdt;
              sy += xx * xx + xx + xx + 1;
            }
            let t2 = sph - d;
            if (t2 < 0) t2 += 1;
            if (t2 < sdt) {
              const xx = t2 / sdt;
              sy -= xx + xx - xx * xx - 1;
            } else if (t2 > 1 - sdt) {
              const xx = (t2 - 1) / sdt;
              sy -= xx * xx + xx + xx + 1;
            }
            sy -= 2 * d - 1;
          }
          const sb = g3 * sy;
          o += sb;
          oR += sb;
          v.subPh += v.d3;
          if (v.subPh >= 1) v.subPh -= Math.floor(v.subPh);
        }
        if (nGain > 1e-6) {
          if (newNoise) {
            let xr = v.seed;
            xr ^= xr << 13;
            xr ^= xr >>> 17;
            xr ^= xr << 5;
            v.seed = xr;
            v.nz = xr / 2147483648;
          }
          o += nGain * v.nz;
          oR += nGain * v.nz;
        }
        // Le passe-bas avant le filtre (2026-10-23) : deux etages TPT (Butterworth 4 poles, PRE_HZ), a gauche ; a droite
        // (WIDE) sur l'entree de droite, ou la sortie de gauche quand les deux entrees sont egales (WIDE a 0) ; la droite
        // part de l'etat de la gauche quand son echelle demarre
        const X = v.x;
        let hp = (o - preA1 * X[VX_P1A] - X[VX_P1B]) * preH1;
        let bp = preG * hp + X[VX_P1A];
        X[VX_P1A] = preG * hp + bp;
        let lp = preG * bp + X[VX_P1B];
        X[VX_P1B] = preG * bp + lp;
        hp = (lp - preA2 * X[VX_P2A] - X[VX_P2B]) * preH2;
        bp = preG * hp + X[VX_P2A];
        X[VX_P2A] = preG * hp + bp;
        const xin = preG * bp + X[VX_P2B];
        X[VX_P2B] = preG * bp + xin;
        let xinR = xin;
        if (wideV) {
          if (!v.wl) {
            X[VX_Q1A] = X[VX_P1A];
            X[VX_Q1B] = X[VX_P1B];
            X[VX_Q2A] = X[VX_P2A];
            X[VX_Q2B] = X[VX_P2B];
          } else if (wide !== 0) {
            hp = (oR - preA1 * X[VX_Q1A] - X[VX_Q1B]) * preH1;
            bp = preG * hp + X[VX_Q1A];
            X[VX_Q1A] = preG * hp + bp;
            lp = preG * bp + X[VX_Q1B];
            X[VX_Q1B] = preG * bp + lp;
            hp = (lp - preA2 * X[VX_Q2A] - X[VX_Q2B]) * preH2;
            bp = preG * hp + X[VX_Q2A];
            X[VX_Q2A] = preG * hp + bp;
            xinR = preG * bp + X[VX_Q2B];
            X[VX_Q2B] = preG * bp + xinR;
          } else {
            X[VX_Q1A] = X[VX_P1A];
            X[VX_Q1B] = X[VX_P1B];
            X[VX_Q2A] = X[VX_P2A];
            X[VX_Q2B] = X[VX_P2B];
          }
        }
        // LOAD (2026-10-23, S12) : la saturation avant le filtre (xd, xdR : les entrees du filtre)
        let xd = xin;
        let xdR = xinR;
        if (ldOn) {
          const zl = xin * ldG + ldB;
          if (X[VX_LON] === 0) {
            // Le depart : l'ADAA et le bloqueur partent de l'entree du moment
            const a0 = zl < 0 ? -zl : zl;
            let F0 = 0.5 * zl * zl;
            if (a0 > LD_K) {
              const u0 = a0 - LD_K;
              F0 = u0 < 2 * LD_W ? 0.5 * LD_K * LD_K + LD_K * u0 + 0.5 * u0 * u0 - (u0 * u0 * u0) / (12 * LD_W) : 0.5 * LD_K * LD_K + 2 * LD_K * LD_W + (4 / 3) * LD_W * LD_W + (LD_K + LD_W) * (u0 - 2 * LD_W);
            }
            X[VX_LZL] = zl;
            X[VX_LFL] = F0;
            X[VX_LXL] = 0;
            X[VX_LHL] = 0;
            X[VX_LON] = 1;
          }
          // WIDE qui demarre : la droite part de la gauche
          if (wideV && !v.wl) {
            X[VX_LZR] = X[VX_LZL];
            X[VX_LFR] = X[VX_LFL];
            X[VX_LXR] = X[VX_LXL];
            X[VX_LHR] = X[VX_LHL];
          }
          for (let sd = 0; sd < 2; sd += 1) {
            if (sd === 1 && !wideV) break;
            const zi = sd === 0 ? zl : xinR * ldG + ldB;
            const iz = sd === 0 ? VX_LZL : VX_LZR;
            const z1 = X[iz];
            const az = zi < 0 ? -zi : zi;
            const a1 = z1 < 0 ? -z1 : z1;
            let yc;
            let Fz;
            if (az <= LD_K && a1 <= LD_K) {
              yc = 0.5 * (zi + z1);
              Fz = 0.5 * zi * zi;
            } else {
              if (az <= LD_K) Fz = 0.5 * zi * zi;
              else {
                const u = az - LD_K;
                const Fa = 0.5 * LD_K * LD_K + LD_K * u + 0.5 * u * u - (u * u * u) / (12 * LD_W);
                const Fb = 0.5 * LD_K * LD_K + 2 * LD_K * LD_W + (4 / 3) * LD_W * LD_W + (LD_K + LD_W) * (u - 2 * LD_W);
                Fz = u < 2 * LD_W ? Fa : Fb;
              }
              const dz = zi - z1;
              if (dz < 1e-7 && dz > -1e-7) {
                const zm = 0.5 * (zi + z1);
                const am = zm < 0 ? -zm : zm;
                if (am <= LD_K) yc = zm;
                else {
                  const u = am - LD_K;
                  const ya = LD_K + LD_W;
                  const yb = LD_K + u - (u * u) / (4 * LD_W);
                  const yy = u >= 2 * LD_W ? ya : yb;
                  yc = zm < 0 ? -yy : yy;
                }
              } else yc = (Fz - X[iz + 1]) / dz;
            }
            X[iz] = zi;
            X[iz + 1] = Fz;
            // Sans le continu de la polarisation (sa valeur au repos retiree, puis un pole a LD_DC_HZ)
            const mm = yc - ldB;
            const hh = ldDc * (X[iz + 3] + mm - X[iz + 2]);
            X[iz + 2] = mm;
            X[iz + 3] = hh;
            if (sd === 0) xd = xin + ldWet * (hh - xin);
            else xdR = xinR + ldWet * (hh - xinR);
          }
          if (!wideV) xdR = xd;
        } else if (X[VX_LON] !== 0) X[VX_LON] = 0;
        // Filtre en echelle : coupure (enveloppe, accent, suivi du clavier), retroaction resolue
        // La coupure (sa tangente) : une fois par echantillon du contexte, elle bouge lentement a cette echelle
        if (newNoise || (ladOn ? v.g === 0 : X[VX_G35] === 0)) {
          const env = sm.envOct * v.fV * (0.8 + 0.2 * v.accent) * v.envAcc;
          if (ladOn) {
            let fc = sm.cutoff * v.vCut * Math.pow(2, cutMod + env + v.cutAcc + v.calC * drift + (p.keyTrack * (v.midi - TRACK_ROOT)) / 12 + kTune);
            if (fc > nyq) fc = nyq;
            else if (fc < 20) fc = 20;
            v.g = Math.tan((Math.PI * fc) / sr);
          }
          if (w4 !== 0) {
            let f35 = sm.cutoff * Math.pow(2, sB7 * v.vCutE + cutMod + env + v.cutAcc + sB7 * v.calC * drift + (p.keyTrack * (v.midi - TRACK_ROOT)) / 12 + c35o);
            if (f35 > fcMax35) f35 = fcMax35;
            else if (f35 < 20) f35 = 20;
            v.x[VX_G35] = Math.tan((Math.PI * f35) / sr);
          }
        }
        // Chaque etage sature : sa pente au point de son etat (Mystran), a CHAQUE echantillon surechantillonne
        // (2026-10-21), puis l'echelle lineaire
        const g = v.g;
        const x0 = v.pu;
        const x1 = v.s1;
        const x2 = v.s2;
        const x3 = v.s3;
        const x4 = v.s4;
        let yo = 0;
        if (ladOn) {
        const ga = g / (1 + NL_K * (x0 * x0 + x0 * x1 + x1 * x1));
        const gb = g / (1 + NL_K * (x1 * x1 + x1 * x2 + x2 * x2));
        const gc = g / (1 + NL_K * (x2 * x2 + x2 * x3 + x3 * x3));
        const gd = g / (1 + NL_K * (x3 * x3 + x3 * x4 + x4 * x4));
        let Ga = ga / (1 + ga);
        let Gb = gb / (1 + gb);
        let Gc = gc / (1 + gc);
        let Gd = gd / (1 + gd);
        let S = Gd * Gc * Gb * (1 - Ga) * x1 + Gd * Gc * (1 - Gb) * x2 + Gd * (1 - Gc) * x3 + (1 - Gd) * x4;
        let u = (xd * driveIn - k * S) / (1 + k * Ga * Gb * Gc * Gd);
        // La passe de correction (2026-10-23, S6) : les pentes reprises au point de l'echantillon, sous porte
        if (k > LC_K0 && g > LC_G0) {
          let ta = (g - LC_G0) / LC_GW;
          ta = ta >= 1 ? 1 : ta * ta * (3 - 2 * ta);
          let tb = (k - LC_K0) / LC_KW;
          tb = tb >= 1 ? 1 : tb * tb * (3 - 2 * tb);
          const om = ta * tb;
          const p1 = x1 + (u - x1) * Ga;
          const p2 = x2 + (p1 - x2) * Gb;
          const p3 = x3 + (p2 - x3) * Gc;
          const p4 = x4 + (p3 - x4) * Gd;
          const ha = g / (1 + NL_K * (u * u + u * p1 + p1 * p1));
          const hb = g / (1 + NL_K * (p1 * p1 + p1 * p2 + p2 * p2));
          const hc = g / (1 + NL_K * (p2 * p2 + p2 * p3 + p3 * p3));
          const hd = g / (1 + NL_K * (p3 * p3 + p3 * p4 + p4 * p4));
          Ga += om * (ha / (1 + ha) - Ga);
          Gb += om * (hb / (1 + hb) - Gb);
          Gc += om * (hc / (1 + hc) - Gc);
          Gd += om * (hd / (1 + hd) - Gd);
          S = Gd * Gc * Gb * (1 - Ga) * x1 + Gd * Gc * (1 - Gb) * x2 + Gd * (1 - Gc) * x3 + (1 - Gd) * x4;
          u = (xd * driveIn - k * S) / (1 + k * Ga * Gb * Gc * Gd);
        }
        v.pu = u;
        let w = (u - x1) * Ga;
        let y = w + x1;
        v.s1 = y + w;
        const y1 = y;
        w = (y - x2) * Gb;
        y = w + x2;
        v.s2 = y + w;
        const y2 = y;
        w = (y - x3) * Gc;
        y = w + x3;
        v.s3 = y + w;
        w = (y - x4) * Gd;
        y = w + x4;
        v.s4 = y + w;
        // MODE : les sorties de l'echelle melangees (Xpander) ; les graves gardes en passe-bas (BASS_KEEP)
        if (w0 !== 0) yo += w0 * y;
        if (w1 !== 0) yo += w1 * y2;
        if (w2 !== 0) yo += w2 * (y1 - y2);
        if (w3 !== 0) yo += w3 * (u - 2 * y1 + y2);
        } else if (x0 !== 0 || x1 !== 0 || x2 !== 0 || x3 !== 0 || x4 !== 0) {
          // MS-10 seul : l'echelle au repos (elle repartira de 0 sous le fondu de MODE)
          v.pu = v.s1 = v.s2 = v.s3 = v.s4 = 0;
        }
        // MS-10 (S11) : le Korg35, sur la meme entree que l'echelle
        if (w4 !== 0) {
          const kc = X[VX_KCL];
          const kb = X[VX_KBL];
          const kp = X[VX_KPL];
          const kq = X[VX_KQL];
          const ky = X[VX_KYL];
          // WIDE qui demarre : la droite part de l'etat de la gauche
          if (wideV && !v.wl) {
            X[VX_KCR] = kc;
            X[VX_KBR] = kb;
            X[VX_KPR] = kp;
            X[VX_KQR] = kq;
            X[VX_KYR] = ky;
          }
          const g35 = X[VX_G35];
          const xk = xd * driveIn;
          // La secante des diodes, extrapolee de l'echantillon d'avant
          const be = 2 * kp - kq;
          const xe = (be < 0 ? -be : be) * K35_ILAM;
          let sig;
          if (xe >= K35_XMAX) sig = (K35_TEND + (xe - K35_XMAX) * K35_SLOPE) / xe;
          else {
            const qe = xe * K35_INV;
            const ie = qe | 0;
            sig = K35_S[ie] + (qe - ie) * (K35_S[ie + 1] - K35_S[ie]);
          }
          const aky = ky < 0 ? -ky : ky;
          const gk = g35 * (1 - (K35_ALPHA * ky) / (K35_LAM + aky));
          let Kd = KK * sig;
          let iD1 = 1 / (1 + gk * (1 - Kd));
          let mk = (gk * (4 * Kd - 1) * iD1) / 3;
          let c = (kc - gk * xk + mk * kb) / (1 + (4 * gk) / 3 + mk * gk);
          let b = (kb - gk * c) * iD1;
          // La reprise au point, sous porte (coupure haute, pres de l'auto-oscillation)
          if (omK > 0 && g35 > LC_G0) {
            let tg = (g35 - LC_G0) / LC_GW;
            tg = tg >= 1 ? 1 : tg * tg * (3 - 2 * tg);
            const om = tg * omK;
            const xb = (b < 0 ? -b : b) * K35_ILAM;
            let s2;
            if (xb >= K35_XMAX) s2 = (K35_TEND + (xb - K35_XMAX) * K35_SLOPE) / xb;
            else {
              const qb = xb * K35_INV;
              const ib = qb | 0;
              s2 = K35_S[ib] + (qb - ib) * (K35_S[ib + 1] - K35_S[ib]);
            }
            Kd = KK * (sig + om * (s2 - sig));
            iD1 = 1 / (1 + gk * (1 - Kd));
            mk = (gk * (4 * Kd - 1) * iD1) / 3;
            c = (kc - gk * xk + mk * kb) / (1 + (4 * gk) / 3 + mk * gk);
            b = (kb - gk * c) * iD1;
          }
          X[VX_KCL] = 2 * c - kc;
          X[VX_KBL] = 2 * b - kb;
          X[VX_KQL] = kp;
          X[VX_KPL] = b;
          // La sortie : les diodes
          const xo = (b < 0 ? -b : b) * K35_ILAM;
          let fo;
          if (xo >= K35_XMAX) fo = K35_TEND + (xo - K35_XMAX) * K35_SLOPE;
          else {
            const qo = xo * K35_INV;
            const io = qo | 0;
            fo = K35_T[io] + (qo - io) * (K35_T[io + 1] - K35_T[io]);
          }
          const yk = b < 0 ? -K35_LAM * fo : K35_LAM * fo;
          X[VX_KYL] = yk;
          X[VX_KON] = 1;
          yo += w4 * yk;
        } else if (X[VX_KON] !== 0) {
          for (let j = VX_KCL; j <= VX_KYR; j += 1) X[j] = 0;
          X[VX_KON] = 0;
        }
        // La garde (2026-10-23, Q7) : une sortie folle (NaN, infinie, emballee) remet la voix au repos, sans bruit
        if (!(yo > -VOICE_GUARD && yo < VOICE_GUARD)) {
          this.rest(v);
          this.heals += 1;
          yo = 0;
        }
        // VCA (l'accent, ou sa part de niveau quand il ouvre aussi le filtre), saturation de sortie (OVERDRIVE la
        // pousse a peine), puis la place de la note dans l'image (lissee)
        let a = yo * v.aV * v.ampAcc;
        if (ldOn) a *= ldMk;
        // La saturation sans repliement (2026-10-23, S5) : tanh par son integrale lncosh (la table LNC, ecrite ici)
        const zs = a * dO;
        const zp = X[VX_TZL];
        const dzs = zs - zp;
        if (dzs > VS_EPS || dzs < -VS_EPS) {
          if (X[VX_TVL] === 0) {
            const a1 = zp < 0 ? -zp : zp;
            if (a1 >= LNC_MAX) X[VX_TFL] = a1 - LN2;
            else {
              const q1 = a1 * LNC_INV;
              const i1 = q1 | 0;
              const t1 = q1 - i1;
              const k1 = 4 * i1;
              X[VX_TFL] = LNC[k1] + t1 * (LNC[k1 + 1] + t1 * (LNC[k1 + 2] + t1 * LNC[k1 + 3]));
            }
          }
          const a0 = zs < 0 ? -zs : zs;
          let F0;
          if (a0 >= LNC_MAX) F0 = a0 - LN2;
          else {
            const q0 = a0 * LNC_INV;
            const i0 = q0 | 0;
            const t0 = q0 - i0;
            const k0 = 4 * i0;
            F0 = LNC[k0] + t0 * (LNC[k0 + 1] + t0 * (LNC[k0 + 2] + t0 * LNC[k0 + 3]));
          }
          a = ((F0 - X[VX_TFL]) / dzs) * oN;
          X[VX_TFL] = F0;
          X[VX_TVL] = 1;
        } else {
          const ms = 0.5 * (zs + zp);
          const am = ms < 0 ? -ms : ms;
          let ym = 1;
          if (am < LNC_MAX) {
            const qm = am * LNC_INV;
            const im = qm | 0;
            const tm = qm - im;
            const km = 4 * im;
            ym = (LNC[km + 1] + tm * (2 * LNC[km + 2] + 3 * tm * LNC[km + 3])) * LNC_INV;
          }
          a = (ms < 0 ? -ym : ym) * oN;
          X[VX_TVL] = 0;
        }
        X[VX_TZL] = zs;
        v.gL += (v.tL - v.gL) * panK;
        v.gR += (v.tR - v.gR) * panK;
        sum += a * v.gL;
        if (!wideV) {
          v.wl = false;
          sumR += a * v.gR;
          continue;
        }
        // WIDE (2026-10-22) : l'echelle de droite, a la meme coupure ; elle part de l'etat de celle de gauche
        const fq = v.fr;
        const startR = !v.wl;
        if (startR) {
          v.wl = true;
          fq.pu = x0;
          fq.s1 = x1;
          fq.s2 = x2;
          fq.s3 = x3;
          fq.s4 = x4;
        }
        let yoR = 0;
        if (ladOn) {
          fq.x = xdR * driveIn;
          fq.g = g;
          fq.k = k;
          ladderR(fq);
          const yr = fq.y;
          if (w0 !== 0) yoR += w0 * yr;
          if (w1 !== 0) yoR += w1 * fq.y2;
          if (w2 !== 0) yoR += w2 * (fq.y1 - fq.y2);
          if (w3 !== 0) yoR += w3 * (fq.u - 2 * fq.y1 + fq.y2);
        } else if (fq.pu !== 0 || fq.s1 !== 0 || fq.s2 !== 0 || fq.s3 !== 0 || fq.s4 !== 0) {
          fq.pu = fq.s1 = fq.s2 = fq.s3 = fq.s4 = 0;
        }
        // MS-10 de droite (S11)
        if (w4 !== 0) {
          const kc = X[VX_KCR];
          const kb = X[VX_KBR];
          const kp = X[VX_KPR];
          const kq = X[VX_KQR];
          const ky = X[VX_KYR];
          const g35 = X[VX_G35];
          const xk = xdR * driveIn;
          const be = 2 * kp - kq;
          const xe = (be < 0 ? -be : be) * K35_ILAM;
          let sig;
          if (xe >= K35_XMAX) sig = (K35_TEND + (xe - K35_XMAX) * K35_SLOPE) / xe;
          else {
            const qe = xe * K35_INV;
            const ie = qe | 0;
            sig = K35_S[ie] + (qe - ie) * (K35_S[ie + 1] - K35_S[ie]);
          }
          const aky = ky < 0 ? -ky : ky;
          const gk = g35 * (1 - (K35_ALPHA * ky) / (K35_LAM + aky));
          let Kd = KK * sig;
          let iD1 = 1 / (1 + gk * (1 - Kd));
          let mk = (gk * (4 * Kd - 1) * iD1) / 3;
          let c = (kc - gk * xk + mk * kb) / (1 + (4 * gk) / 3 + mk * gk);
          let b = (kb - gk * c) * iD1;
          if (omK > 0 && g35 > LC_G0) {
            let tg = (g35 - LC_G0) / LC_GW;
            tg = tg >= 1 ? 1 : tg * tg * (3 - 2 * tg);
            const om = tg * omK;
            const xb = (b < 0 ? -b : b) * K35_ILAM;
            let s2;
            if (xb >= K35_XMAX) s2 = (K35_TEND + (xb - K35_XMAX) * K35_SLOPE) / xb;
            else {
              const qb = xb * K35_INV;
              const ib = qb | 0;
              s2 = K35_S[ib] + (qb - ib) * (K35_S[ib + 1] - K35_S[ib]);
            }
            Kd = KK * (sig + om * (s2 - sig));
            iD1 = 1 / (1 + gk * (1 - Kd));
            mk = (gk * (4 * Kd - 1) * iD1) / 3;
            c = (kc - gk * xk + mk * kb) / (1 + (4 * gk) / 3 + mk * gk);
            b = (kb - gk * c) * iD1;
          }
          X[VX_KCR] = 2 * c - kc;
          X[VX_KBR] = 2 * b - kb;
          X[VX_KQR] = kp;
          X[VX_KPR] = b;
          const xo = (b < 0 ? -b : b) * K35_ILAM;
          let fo;
          if (xo >= K35_XMAX) fo = K35_TEND + (xo - K35_XMAX) * K35_SLOPE;
          else {
            const qo = xo * K35_INV;
            const io = qo | 0;
            fo = K35_T[io] + (qo - io) * (K35_T[io + 1] - K35_T[io]);
          }
          const yk = b < 0 ? -K35_LAM * fo : K35_LAM * fo;
          X[VX_KYR] = yk;
          yoR += w4 * yk;
        }
        if (!(yoR > -VOICE_GUARD && yoR < VOICE_GUARD)) {
          this.rest(v);
          this.heals += 1;
          yoR = 0;
        }
        let aR = yoR * v.aV * v.ampAcc;
        if (ldOn) aR *= ldMk;
        const zsR = aR * dO;
        // L'echelle de droite qui demarre (ce bloc) : sa saturation part de son entree du moment
        if (startR) {
          X[VX_TZR] = zsR;
          X[VX_TVR] = 0;
        }
        const zpR = X[VX_TZR];
        const dzR = zsR - zpR;
        if (dzR > VS_EPS || dzR < -VS_EPS) {
          if (X[VX_TVR] === 0) {
            const a1 = zpR < 0 ? -zpR : zpR;
            if (a1 >= LNC_MAX) X[VX_TFR] = a1 - LN2;
            else {
              const q1 = a1 * LNC_INV;
              const i1 = q1 | 0;
              const t1 = q1 - i1;
              const k1 = 4 * i1;
              X[VX_TFR] = LNC[k1] + t1 * (LNC[k1 + 1] + t1 * (LNC[k1 + 2] + t1 * LNC[k1 + 3]));
            }
          }
          const a0 = zsR < 0 ? -zsR : zsR;
          let F0;
          if (a0 >= LNC_MAX) F0 = a0 - LN2;
          else {
            const q0 = a0 * LNC_INV;
            const i0 = q0 | 0;
            const t0 = q0 - i0;
            const k0 = 4 * i0;
            F0 = LNC[k0] + t0 * (LNC[k0 + 1] + t0 * (LNC[k0 + 2] + t0 * LNC[k0 + 3]));
          }
          aR = ((F0 - X[VX_TFR]) / dzR) * oN;
          X[VX_TFR] = F0;
          X[VX_TVR] = 1;
        } else {
          const ms = 0.5 * (zsR + zpR);
          const am = ms < 0 ? -ms : ms;
          let ym = 1;
          if (am < LNC_MAX) {
            const qm = am * LNC_INV;
            const im = qm | 0;
            const tm = qm - im;
            const km = 4 * im;
            ym = (LNC[km + 1] + tm * (2 * LNC[km + 2] + 3 * tm * LNC[km + 3])) * LNC_INV;
          }
          aR = (ms < 0 ? -ym : ym) * oN;
          X[VX_TVR] = 0;
        }
        X[VX_TZR] = zsR;
        sumR += aR * v.gR;
      }
      const acc = this.acc;
      acc[0] = sum;
      acc[1] = sumR;
      this.busTick(i2);
    }
    this.flushTiny();
    // Retour a la frequence du contexte : les demi-bandes en cascade, un canal chacune
    if (OS === 4) {
      this.d4.run(raw, 4 * N, this.mid);
      this.d2.run(this.mid, 2 * N, L);
      if (R) {
        this.d4R.run(rawR, 4 * N, this.midR);
        this.d2R.run(this.midR, 2 * N, R);
      }
    } else if (OS === 2) {
      this.d2.run(raw, 2 * N, L);
      if (R) this.d2R.run(rawR, 2 * N, R);
    } else {
      for (let i = 0; i < N; i += 1) L[i] = raw[i];
      if (R) for (let i = 0; i < N; i += 1) R[i] = rawR[i];
    }
    // Tests : la sortie dit le LFO, a chaque echantillon du contexte (sa forme, la position en temps)
    if (probe) {
      for (let i = 0; i < N; i += 1) L[i] = this.pL[i];
      if (R) for (let i = 0; i < N; i += 1) R[i] = this.pR[i];
    }
    return true;
  }
}

registerProcessor('mm-voyager', MMVoyager);
