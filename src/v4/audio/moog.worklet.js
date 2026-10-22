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
 * le son d'avant au bit pres (scripts/arp-bench.mjs le verifie) :
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
 * bouts : le milieu garde de quoi sonner en mono). STACK_PAN2 : la part moyenne de la largeur (le carre moyen des
 * places), pour la puissance egale de WIDE.
 */
const MAX_STACK = 3;
const STACK_OFF = [[0], [-0.7, 0.7], [-1, 0, 1]];
const STACK_PAN = [[0], [-1, 1], [-1, 0, 1]];
const STACK_PAN1 = [-0.8, 0.8];
const STACK_PAN2 = [0.64, 1, 2 / 3];
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
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
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
    b.set(input.subarray(0, n2), T);
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
  return { a, b, m, q1: NaN, q2: NaN, sb: 0, g: live ? 1 : 0, gt: live ? 1 : 0, off: 0, r: 1, pan1: STACK_PAN1[0], pan2: STACK_PAN1[1], live };
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
    this.fr = { pu: 0, s1: 0, s2: 0, s3: 0, s4: 0, u: 0, y1: 0, y2: 0 };
    this.wl = false;
    this.wideOK = true;
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
    this.accent = 1;
    this.age = 0;
    this.quick = false;
    // Les petits ecarts de la note (noteOn) : coupure, enveloppes, accord, place stereo
    this.vCut = 1;
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
 * (process) ; x l'entree deja poussee par OVERDRIVE ; rend la sortie du quatrieme etage, garde u, y1 et y2 (MODE).
 */
function ladderR(st, x, g, k) {
  const x0 = st.pu;
  const x1 = st.s1;
  const x2 = st.s2;
  const x3 = st.s3;
  const x4 = st.s4;
  const ga = g / (1 + NL_K * (x0 * x0 + x0 * x1 + x1 * x1));
  const gb = g / (1 + NL_K * (x1 * x1 + x1 * x2 + x2 * x2));
  const gc = g / (1 + NL_K * (x2 * x2 + x2 * x3 + x3 * x3));
  const gd = g / (1 + NL_K * (x3 * x3 + x3 * x4 + x4 * x4));
  const Ga = ga / (1 + ga);
  const Gb = gb / (1 + gb);
  const Gc = gc / (1 + gc);
  const Gd = gd / (1 + gd);
  const S = Gd * Gc * Gb * (1 - Ga) * x1 + Gd * Gc * (1 - Gb) * x2 + Gd * (1 - Gc) * x3 + (1 - Gd) * x4;
  const u = (x - k * S) / (1 + k * Ga * Gb * Gc * Gd);
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
  return y;
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
const PULSE_W = 0.14;
const pwOf = (w, f) => (w === 3 ? 0.5 - (0.5 - PULSE_W) * f : w === 4 ? PULSE_W : 0.5);

class MMVoyager extends AudioWorkletProcessor {
  constructor(options) {
    super();
    const o = (options && options.processorOptions) || {};
    // Le hasard (2026-10-22) : a graine (processorOptions.seed, les tests et le futur plugin), sinon Math.random
    this.rnd = Number.isFinite(o.seed) ? mulberry32(o.seed) : Math.random;
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
    this.d4 = os === 4 ? new Decimator(31, 7) : null;
    this.d2 = os >= 2 ? new Decimator(63, 8) : null;
    this.d4R = os === 4 ? new Decimator(31, 7) : null;
    this.d2R = os >= 2 ? new Decimator(63, 8) : null;
    // OVERDRIVE : etats des filtres de la branche saturee (gauche, droite) et coefficients a la frequence du calcul
    // (dL, dxL, dR, dxR : son bloqueur de continu, 2026-10-21)
    this.od = { hpL: 0, xL: 0, lpL: 0, hpR: 0, xR: 0, lpR: 0, dL: 0, dxL: 0, dR: 0, dxR: 0 };
    this.odHp = Math.exp((-2 * Math.PI * OD_HP_HZ) / this.sr2);
    this.odLp = 1 - Math.exp((-2 * Math.PI * OD_TONE_HZ) / this.sr2);
    this.odDc = Math.exp((-2 * Math.PI * OD_DC_HZ) / this.sr2);
    // Le bloqueur de continu de la sortie (sortie, entree d'avant : gauche, puis droite), a la frequence du calcul
    this.dc = [0, 0, 0, 0];
    this.dcK = Math.exp((-2 * Math.PI * OUT_DC_HZ) / this.sr2);
    this.panK = coef(PAN_S, this.sr2);
    // STACK : le glissement du gain d'un exemplaire (2026-10-22)
    this.stK = coef(STACK_S, this.sr2);
    // La sortie de la saturation des voix, normalisee (calculee quand OVERDRIVE bouge)
    this.outDrive = -1;
    this.outNorm = 1;
    // Une note a gauche, la suivante a droite
    this.flip = false;
    // MODE du filtre : le poids de chaque sortie (LP 24, LP 12, BP, HP), en fondu
    this.wm = [1, 0, 0, 0];
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
      glue: 0,
    };
    // Valeurs lissees (un pole, environ 15 ms) : pas de craquement quand un potard tourne
    this.sm = { w1: 2, w2: 2, o1: 0.62, o2: 0.62, fm: 0, noise: 0, sub: 0, lfoAmt: 0, f1: -8, f2: 8, cutoff: 800, res: 0.3, envOct: 3, drive: 0, wide: 0 };
    this.smK = coef(0.015, this.sr2);
    this.c = {};
    if (o.params) Object.assign(this.p, o.params);
    Object.assign(this.sm, { w1: this.p.wave1, w2: this.p.wave2, o1: this.p.osc1, o2: this.p.osc2, fm: this.p.fm, noise: this.p.noise, sub: this.p.sub, lfoAmt: this.p.lfoAmt, f1: this.p.fine1, f2: this.p.fine2, cutoff: this.p.cutoff, res: this.p.res, envOct: this.p.envOct, drive: this.p.drive, wide: this.p.wide });
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
    this.rIdx = NaN;
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
      if (a.run) this.rIdx = NaN;
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
    const frame = Math.round(n.time * sampleRate);
    const q = this.queue;
    let i = q.length;
    while (i > 0 && q[i - 1].frame > frame) i -= 1;
    q.splice(i, 0, { frame, midi: n.midi, gate: n.gate, accent: n.accent || 1, from: n.from == null ? null : n.from });
  }

  onMsg(m) {
    if (m.type === 'note') this.add(m);
    else if (m.type === 'beat') this.addBeat(m);
    else if (m.type === 'params') {
      Object.assign(this.p, m.params);
      this.coefs();
      // Un tempo, transport libre (ou plus d'ancre depuis une seconde) : la position continue au nouveau tempo ;
      // en lecture, ce sont les ancres qui portent le tempo, a la frontiere de pas ou il change
      const stale = this.beats.length === 0 && currentFrame - this.tp.f > sampleRate;
      if (m.params && m.params.bpm > 0 && (!this.tpLocked || stale)) this.freeRun(currentFrame);
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
    for (const x of this.voices) if (!x.on) v = v && v.age < x.age ? v : x;
    const fresh = v !== null;
    if (!v) {
      // Plus de voix libre : elle repart de son niveau (pas de clic). La plus discrete des voix deja relachees
      // (2026-10-21, audit ; avant, la plus ancienne, encore sonore parfois), sinon la plus ancienne
      for (const x of this.voices) if (x.aStage === 3 && (!v || x.aV < v.aV)) v = x;
      if (!v) for (const x of this.voices) if (!v || x.age < v.age) v = x;
    }
    if (fresh) {
      // Une voix neuve : filtre au repos (celui de droite de WIDE aussi), phases libres
      v.s1 = v.s2 = v.s3 = v.s4 = 0;
      v.pu = 0;
      v.aV = 0;
      v.fV = 0;
      const fr = v.fr;
      fr.pu = fr.s1 = fr.s2 = fr.s3 = fr.s4 = 0;
      for (const P of v.pr) P.sb = 0;
    }
    v.g = 0;
    for (const P of v.pr) {
      P.q1 = NaN;
      P.q2 = NaN;
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
    v.vCut = Math.pow(2, (rnd() - 0.5) * 0.08 * dr);
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
    // WIDE : la note a son echelle de droite s'il en reste (une voix reprise en plein son garde la sienne : pas de saut)
    if (quiet) {
      let busy = 0;
      for (const x of this.voices) if (x.on && x !== v && x.wideOK) busy += 1;
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
    for (const v of this.voices) if (v.on) active = true;
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
    // une fois par bloc
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
    const rnd = this.rnd;
    for (const v of this.voices) {
      if (!v.on) continue;
      for (let k = 0; k < 2; k += 1) {
        let d = 0;
        for (let j = 0; j < wc.length; j += 1) {
          const w = v.walk[j];
          w[k] = w[k] * wc[j][0] + (rnd() - 0.5) * wc[j][1];
          d += w[k];
        }
        v.drift[k] = d > DRIFT_MAX ? DRIFT_MAX : d < -DRIFT_MAX ? -DRIFT_MAX : d;
      }
    }
    const p = this.p;
    const sm = this.sm;
    const c = this.c;
    const K = this.smK;
    // La coupure du filtre reste sous la bande utile du contexte
    const nyq = sampleRate * 0.45;
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
      gl.mk = gl.avg > 0 ? glueGr(LN_DB * Math.log(gl.avg) - gl.thr) : 0;
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
      const lraw = this.lfoRaw(pos / lfoBeats, p.lfoShape);
      if (probe && i2 - i * OS === 0) {
        this.pL[i] = lraw;
        this.pR[i] = pos;
      }
      this.lfoOut += (lraw - this.lfoOut) * this.lfoK;
      sm.lfoAmt += (p.lfoAmt - sm.lfoAmt) * K;
      const lfo = this.lfoOut * sm.lfoAmt;
      const dest = p.lfoDest;
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
      const subDiv = p.subOct === 2 ? 0.25 : 0.5;
      const subW = p.subWave === 1 ? 1 : p.subWave === 3 ? 3 : 0;
      const newNoise = i2 % OS === 0;
      // MODE du filtre : chaque sortie glisse vers son poids (1 pour le mode choisi)
      const wm = this.wm;
      for (let m = 0; m < 4; m += 1) wm[m] += ((m === p.fmode ? 1 : 0) - wm[m]) * K;
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
      // RANGE et SEMI de chaque oscillateur ; FINE en cents, lisse
      const ratio1 = Math.pow(2, p.tune1 / 12);
      const ratio2 = Math.pow(2, p.tune2 / 12);
      sm.f1 += (p.fine1 - sm.f1) * K;
      sm.f2 += (p.fine2 - sm.f2) * K;
      const fine1 = sm.f1;
      const fine2 = sm.f2;
      sm.cutoff += (p.cutoff - sm.cutoff) * K;
      sm.res += (p.res - sm.res) * K;
      sm.envOct += (p.envOct - sm.envOct) * K;
      sm.drive += (p.drive - sm.drive) * K;
      // WIDE (2026-10-22) : lisse ; revenu a 0, l'echelle de droite s'arrete (le calcul d'avant)
      if (sm.wide !== p.wide) {
        sm.wide += (p.wide - sm.wide) * K;
        if (p.wide === 0 && sm.wide < 1e-4) sm.wide = 0;
      }
      const wideOn = sm.wide > 0;
      const k = resK(sm.res);
      const driveIn = 1 + 2.5 * sm.drive;
      const driveOut = 1 + 1.5 * sm.drive;
      // La normalisation de la saturation des voix : une fois quand OVERDRIVE bouge (avant : pour chaque voix)
      if (sm.drive !== this.outDrive) {
        this.outDrive = sm.drive;
        this.outNorm = 1 / Math.pow(driveOut, 0.82);
      }
      const outNorm = this.outNorm;
      // OVERDRIVE : le gain de la branche saturee (progressif : les premiers crans chauffent a peine), le niveau
      // compense (OD_TRIM, puis la mesure OD_COMP)
      const odGain = 1 + OD_GAIN * sm.drive * sm.drive;
      const odMix = OD_MIX * Math.min(1, sm.drive * 4);
      const odTrim = odMix > 1e-4 ? odComp(sm.drive) / (1 + OD_TRIM * sm.drive) : 1;
      const drift = p.drift;
      const sync = p.sync === 1;
      // Les graves gardes en passe-bas (BASS_KEEP), et les poids des sorties de l'echelle (Xpander), communs aux voix
      const keep = 1 + k * BASS_KEEP;
      const w0 = wm[0] > 1e-4 ? wm[0] * keep : 0;
      const w1 = wm[1] > 1e-4 ? (wm[1] * keep) / (1 + k * SLOPE12_RES) : 0;
      const w2 = wm[2] > 1e-4 ? (wm[2] * 2 * BP_GAIN) / (1 + k * BP_RES) : 0;
      const w3 = wm[3] > 1e-4 ? (wm[3] * HP_GAIN) / (1 + k * HP_RES) : 0;
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
        const wideV = wideOn && v.wideOK;
        const wide = wideV ? sm.wide : 0;
        const wn = wideV ? 1 / Math.sqrt(1 + wide * wide * STACK_PAN2[v.n - 1]) : 1;
        let o = 0;
        let oR = 0;
        for (let j = 0; j < nl; j += 1) {
          const P = pr[j];
          const d1 = d1v * P.r;
          const d2 = d2v * P.r;
          // FM : l'operateur decale la phase des DEUX oscillateurs (indice en radians, suivi de l'enveloppe du filtre)
          const dm = d1 * p.ratio;
          const idx = fmDepth > 0 ? Math.min(fmDepth * (0.35 + 0.65 * Math.min(1, v.fV)), Math.max(0, 0.4 / dm - 1)) : 0;
          const pm = idx > 0 ? (idx * Math.sin(TAU * P.m)) / TAU : 0;
          // OSC 2 d'abord : il module OSC 1 au cran FM ; chaque forme fondue dans la suivante
          let q2 = P.b + pm;
          q2 -= Math.floor(q2);
          let p1 = P.a + pm;
          p1 -= Math.floor(p1);
          // FM sans repliement (2026-10-21) : PolyBLEP au pas instantane de la phase modulee (avant : le pas sans FM)
          const fmOn = pm !== 0 && P.q1 === P.q1;
          const dt1 = fmOn ? stepOf(p1, P.q1) : d1;
          const dt2 = fmOn && !sync ? stepOf(q2, P.q2) : d2;
          P.q1 = p1;
          P.q2 = q2;
          let o2 = pwm2 ? pulse(q2, dt2, pwd2) : shape(q2, dt2, i2w);
          if (f2m > 1e-4 && !pwm2) o2 += (shape(q2, dt2, i2w + 1) - o2) * f2m;
          // SYNC sans repliement (2026-10-21) : la remise de phase d'OSC 2 corrigee par PolyBLEP, sur cet echantillon
          // (avant la remise) et le suivant (apres) ; la marche que la forme corrige deja d'elle-meme a la phase 0 deduite
          if (P.sb !== 0) {
            o2 += P.sb;
            P.sb = 0;
          }
          if (sync && P.a + d1 >= 1) {
            const frac = (P.a + d1 - 1) / d1;
            let e = P.b + d2 * (1 - frac);
            e -= Math.floor(e);
            const e0 = pm - Math.floor(pm);
            let e1 = e + pm;
            e1 -= Math.floor(e1);
            let h;
            let nat;
            if (pwm2) {
              h = rawShape(e0, 3, pwd2) - rawShape(e1, 3, pwd2);
              nat = 2;
            } else {
              const da = pwOf(i2w, 0);
              h = rawShape(e0, i2w, da) - rawShape(e1, i2w, da);
              nat = natStep(i2w);
              if (f2m > 1e-4) {
                const wb = i2w + 1;
                const db = pwOf(wb, 0);
                h += (rawShape(e0, wb, db) - rawShape(e1, wb, db) - h) * f2m;
                nat += (natStep(wb) - nat) * f2m;
              }
            }
            if (pm !== 0) nat = 0;
            o2 += 0.5 * h * frac * frac;
            const r = 1 - frac;
            P.sb = -0.5 * (h - nat) * r * r;
          }
          let o1 = pwm1 ? pulse(p1, dt1, pwd1) : shape1(i1, p1, dt1, P.a, o2, pm);
          if (f1m > 1e-4 && !pwm1) o1 += (shape1(i1 + 1, p1, dt1, P.a, o2, pm) - o1) * f1m;
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
            o += s1 * (1 - wide * P.pan1) + s2 * (1 - wide * P.pan2);
            oR += s1 * (1 + wide * P.pan1) + s2 * (1 + wide * P.pan2);
          } else if (j === 0) o = gj === 1 ? g1 * o1 + g2 * o2 : gj * (g1 * o1 + g2 * o2);
          else o += gj * (g1 * o1 + g2 * o2);
        }
        // Un exemplaire qui s'est eteint (STACK retire) n'est plus calcule
        if (nl > 1 && pr[nl - 1].gt === 0 && pr[nl - 1].g === 0) v.nLoop = nl - 1;
        // SUB coupe : sa phase s'arrete (il revient en fondu depuis 0, pas de clic) ; le SUB et le bruit au centre (les
        // deux cotes de WIDE), ajoutes dans l'ordre d'avant
        if (g3 > 1e-6) {
          const sb = g3 * shape(v.subPh, v.d3, subW);
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
        // Filtre en echelle : coupure (enveloppe, accent, suivi du clavier), retroaction resolue
        // La coupure (sa tangente) : une fois par echantillon du contexte, elle bouge lentement a cette echelle
        if (newNoise || v.g === 0) {
          const env = sm.envOct * v.fV * (0.8 + 0.2 * v.accent) * v.envAcc;
          let fc = sm.cutoff * v.vCut * Math.pow(2, cutMod + env + v.cutAcc + v.calC * drift + (p.keyTrack * (v.midi - TRACK_ROOT)) / 12);
          if (fc > nyq) fc = nyq;
          else if (fc < 20) fc = 20;
          v.g = Math.tan((Math.PI * fc) / sr);
        }
        // Chaque etage sature : sa pente au point de son etat (Mystran), a CHAQUE echantillon surechantillonne
        // (2026-10-21), puis l'echelle lineaire
        const g = v.g;
        const x0 = v.pu;
        const x1 = v.s1;
        const x2 = v.s2;
        const x3 = v.s3;
        const x4 = v.s4;
        const ga = g / (1 + NL_K * (x0 * x0 + x0 * x1 + x1 * x1));
        const gb = g / (1 + NL_K * (x1 * x1 + x1 * x2 + x2 * x2));
        const gc = g / (1 + NL_K * (x2 * x2 + x2 * x3 + x3 * x3));
        const gd = g / (1 + NL_K * (x3 * x3 + x3 * x4 + x4 * x4));
        const Ga = ga / (1 + ga);
        const Gb = gb / (1 + gb);
        const Gc = gc / (1 + gc);
        const Gd = gd / (1 + gd);
        const S = Gd * Gc * Gb * (1 - Ga) * x1 + Gd * Gc * (1 - Gb) * x2 + Gd * (1 - Gc) * x3 + (1 - Gd) * x4;
        const u = (o * driveIn - k * S) / (1 + k * Ga * Gb * Gc * Gd);
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
        let yo = 0;
        if (w0 !== 0) yo += w0 * y;
        if (w1 !== 0) yo += w1 * y2;
        if (w2 !== 0) yo += w2 * (y1 - y2);
        if (w3 !== 0) yo += w3 * (u - 2 * y1 + y2);
        // VCA (l'accent, ou sa part de niveau quand il ouvre aussi le filtre), saturation de sortie (OVERDRIVE la
        // pousse a peine), puis la place de la note dans l'image (lissee)
        let a = yo * v.aV * v.ampAcc;
        a = Math.tanh(a * driveOut) * outNorm;
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
        if (!v.wl) {
          v.wl = true;
          fq.pu = x0;
          fq.s1 = x1;
          fq.s2 = x2;
          fq.s3 = x3;
          fq.s4 = x4;
        }
        const yr = ladderR(fq, oR * driveIn, g, k);
        let yoR = 0;
        if (w0 !== 0) yoR += w0 * yr;
        if (w1 !== 0) yoR += w1 * fq.y2;
        if (w2 !== 0) yoR += w2 * (fq.y1 - fq.y2);
        if (w3 !== 0) yoR += w3 * (fq.u - 2 * fq.y1 + fq.y2);
        let aR = yoR * v.aV * v.ampAcc;
        aR = Math.tanh(aR * driveOut) * outNorm;
        sumR += aR * v.gR;
      }
      // OVERDRIVE : le propre + la branche sans graves, amplifiee, arrondie, adoucie, sans continu (2026-10-21)
      if (odMix > 1e-4) {
        const od = this.od;
        const hpA = this.odHp;
        const lpA = this.odLp;
        const dA = this.odDc;
        od.hpL = hpA * (od.hpL + sum - od.xL);
        od.xL = sum;
        od.lpL += (odCurve(od.hpL * odGain) - od.lpL) * lpA;
        od.dL = dA * (od.dL + od.lpL - od.dxL);
        od.dxL = od.lpL;
        sum = (sum + od.dL * odMix) * odTrim;
        od.hpR = hpA * (od.hpR + sumR - od.xR);
        od.xR = sumR;
        od.lpR += (odCurve(od.hpR * odGain) - od.lpR) * lpA;
        od.dR = dA * (od.dR + od.lpR - od.dxR);
        od.dxR = od.lpR;
        sumR = (sumR + od.dR * odMix) * odTrim;
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
          gl.gain = Math.exp((gl.mk - glueGr(LN_DB * Math.log(gl.env + 1e-12) - gl.thr)) * DB_LN);
          gl.mix = gl.g >= 0.25 ? 1 : 4 * gl.g;
        }
        const zl = yl * gl.gain;
        const zr = yr * gl.gain;
        let cl = glueAdaa(this.glL, zl, gl.k, gl.w);
        let cr = glueAdaa(this.glRt, zr, gl.k, gl.w);
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
      raw[i2] = yl;
      rawR[i2] = yr;
    }
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
      L.set(raw.subarray(0, N));
      if (R) R.set(rawR.subarray(0, N));
    }
    // Tests : la sortie dit le LFO, a chaque echantillon du contexte (sa forme, la position en temps)
    if (probe) {
      L.set(this.pL.subarray(0, N));
      if (R) R.set(this.pR.subarray(0, N));
    }
    return true;
  }
}

registerProcessor('mm-voyager', MMVoyager);
