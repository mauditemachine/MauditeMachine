/**
 * BIT et COMP du MM-RYTM (2026-10-10, Mika : "on a deja DELAY, remplace DLY
 * TIME et DLY FB par bit reduction et compressor") : sur toute la sortie du
 * MM-RYTM, kick, REVERB et DELAY compris (audio/drums.ts).
 * - BIT : la profondeur tombe de 16 a 4 bits ('bits'), l'echantillonnage se
 *   divise de 1 a 16 ('rate', BIT RATE de sa page). A 0, le son passe tel
 *   quel (quel que soit 'rate').
 * - COMP : un compresseur de bus, voir plus bas.
 * Le passage de 0 a un peu se fait en 10 ms (pas de clic). Rien n'est alloue
 * dans process() ; une valeur non finie vaut celle de depart.
 *
 * COMP refait une deuxieme fois le 2026-10-18 (Mika : "la compression fait
 * juste compresser, le son etouffe ; ca doit etre bien meilleur ! Donne-moi
 * le choix avec du ratio et threshold ! Fais un bon compresseur"). Le COMP du
 * 2026-10-11 avait un seul potard (le seuil de -6 a -24 dB et le rapport de
 * 1.5 a 4 ensemble). Ce qui l'etouffait, mesure hors ligne sur le motif de
 * depart (sans son ; a l'entree du COMP, avant RYTM_TRIM : il y crete vers
 * 0 dBFS) :
 * - son attaque reelle etait de 3 ms, pas les 30 ms affiches (drums.ts
 *   FX_BEFORE rendait la constante d'avant a la valeur de depart) : la frappe
 *   du kick et du snare deja serree ;
 * - le seuil descendait avec la quantite : a mi-course 9 dB de reduction sur
 *   chaque kick, 15 dB a fond, la machine entiere tiree vers le bas a chaque
 *   temps (le corps du kick et tout ce qui le suit), aucun moyen de demander
 *   "un peu de colle" ;
 * - le detecteur lisait chaque echantillon (pas d'enveloppe) : l'attaque et
 *   le retour alternaient dans chaque periode du kick, le gain ondulait avec
 *   son onde (0.44 dB crete a crete dans le corps du kick a mi-course, 2.1 dB
 *   aux temps courts), une modulation posee sur tout le reste ;
 * - le rattrapage suivait la reduction moyenne sur 1.5 s : le niveau respirait
 *   avec le motif ;
 * - le lien stereo par la somme (L + R) / 2 lisait trop bas ce qui est large
 *   (les retours de REVERB et de DELAY) ; le genou de 8 dB comprimait des 4 dB
 *   sous le seuil.
 *
 * Desormais un compresseur de bus facon SSL G / API 2500, en avant (feed
 * forward), sans anticipation (aucune latence : le MM-RYTM reste cale sur le
 * MM-BASS et le MM-ARP) :
 * - 'comp' est le MIX (la compression parallele, facon New York) : 0 = le son
 *   tel quel au bit pres (le traitement saute), 1 = tout compresse ; le gain se
 *   mele au sec, sans decalage entre les deux ;
 * - la chaine laterale : passe-haut 2 poles ('hpf' : 0 = aucun, 60 ou 120 Hz)
 *   pour que le grave du kick ne tire pas tout ; le lien stereo par le plus fort
 *   des deux cotes ;
 * - le detecteur : crete et RMS meles dans le domaine des dB (PEAK_W de la
 *   crete qui retombe en 10 ms, le reste un RMS de 8 ms), cale pour qu'un sinus
 *   lise sa crete ;
 * - la courbe dans le domaine des dB : seuil 'thr', rapport 'ratio', genou doux
 *   'knee' (dB, 0 : genou dur) ;
 * - le lissage sur la reduction elle-meme (une branche pour creuser, une pour
 *   relacher) : attaque 'atk', retour 'rel' (s) ; 'rauto' a 1 : le retour suit
 *   la musique (deux etages : 60 ms apres un coup bref, jusqu'a 1.2 s quand la
 *   compression dure plusieurs secondes, comme l'AUTO d'un SSL) ;
 * - le gain rattrape 'makeup' (dB) : fixe, calcule de la courbe par drums.ts
 *   (pattern.ts compMakeup) quand MAKEUP est sur AUTO ; il ne bouge jamais tout
 *   seul ;
 * - seuil, rapport, genou et rattrapage glissent en 20 ms (aucun clic quand on
 *   les tourne) ; les enveloppes tombent a 0 sous 1e-15 (pas de nombres
 *   denormaux dans les silences).
 * Mesure hors ligne au depart de la page (-18 dB, 4:1, 10 ms, AUTO) contre
 * l'ancien a mi-course : la frappe du kick ressort plus (crete des 5 premieres
 * ms contre le corps : +4.5 dB contre +4.1), l'ondulation du gain dans le corps
 * du kick 2.4 fois plus faible, les aigus (au-dessus de 5 kHz) baissent moins
 * que l'ensemble (+1.2 dB : rien d'etouffe), MAKEUP AUTO rend le niveau a
 * 0.1 dB pres ; sur un sinus tenu, la reduction vaut (niveau - seuil) x
 * (1 - 1/rapport) a 0.1 dB pres a 1 kHz (0.4 dB a 100 Hz).
 * La reduction se lit par le port ('gr' : la plus forte depuis la derniere
 * lecture, en dB), pour l'aiguille de la page COMP.
 */

const ATK0 = 0.01;
const REL0 = 0.12;
/** Le RMS du detecteur (s), la crete qui retombe (s), le glissement des reglages (s) */
const RMS_S = 0.008;
/** La part de la crete dans le detecteur (le reste : le RMS), en dB */
const PEAK_W = 0.75;
const PEAK_S = 0.01;
const PARAM_S = 0.02;
/** Le retour AUTO : l'etage rapide, puis le lent (sa charge, son retour) */
const AUTO_FAST = 0.06;
const AUTO_SLOW_ATK = 3;
const AUTO_SLOW_REL = 1.2;
/** dB par neper sur 20 : 20 / ln(10) ; et l'inverse */
const DB20 = 8.685889638065035;
const DB_TO_LN = 0.11512925464970229;
const TINY = 1e-15;

/** Une valeur finie bornee, sinon d. */
function fin(v, lo, hi, d) {
  return Number.isFinite(v) ? (v < lo ? lo : v > hi ? hi : v) : d;
}

/** Un reglage k-rate (absent : d), borne. */
function prm(params, name, lo, hi, d) {
  const a = params[name];
  return fin(a ? a[0] : d, lo, hi, d);
}

class MMGlue extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'comp', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'rate', defaultValue: 1, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
      { name: 'atk', defaultValue: ATK0, minValue: 0.0001, maxValue: 0.05, automationRate: 'k-rate' },
      { name: 'rel', defaultValue: REL0, minValue: 0.02, maxValue: 0.8, automationRate: 'k-rate' },
      { name: 'rauto', defaultValue: 1, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'thr', defaultValue: -18, minValue: -60, maxValue: 0, automationRate: 'k-rate' },
      { name: 'ratio', defaultValue: 4, minValue: 1, maxValue: 20, automationRate: 'k-rate' },
      { name: 'knee', defaultValue: 6, minValue: 0, maxValue: 24, automationRate: 'k-rate' },
      { name: 'makeup', defaultValue: 0, minValue: -24, maxValue: 24, automationRate: 'k-rate' },
      { name: 'hpf', defaultValue: 60, minValue: 0, maxValue: 400, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.mixB = 0;
    this.mixC = 0;
    this.ph = 0;
    this.h0 = 0;
    this.h1 = 0;
    this.glide = 1 - Math.exp(-1 / (0.01 * sampleRate));
    this.kParam = 1 - Math.exp(-1 / (PARAM_S * sampleRate));
    this.kRms = 1 - Math.exp(-1 / (RMS_S * sampleRate));
    this.pkRel = Math.exp(-1 / (PEAK_S * sampleRate));
    this.fastRel = Math.exp(-1 / (AUTO_FAST * sampleRate));
    this.slowAtk = Math.exp(-1 / (AUTO_SLOW_ATK * sampleRate));
    this.slowRel = Math.exp(-1 / (AUTO_SLOW_REL * sampleRate));
    this.atkS = -1;
    this.relS = -1;
    this.atk = 0;
    this.rel = 0;
    // La chaine laterale : un passe-haut par cote (biquad Butterworth), sa frequence
    this.hpHz = -1;
    this.hb0 = 1;
    this.hb1 = 0;
    this.hb2 = 0;
    this.ha1 = 0;
    this.ha2 = 0;
    this.lx1 = 0;
    this.lx2 = 0;
    this.ly1 = 0;
    this.ly2 = 0;
    this.rx1 = 0;
    this.rx2 = 0;
    this.ry1 = 0;
    this.ry2 = 0;
    // Le detecteur (la moyenne des carres, la crete qui retombe), la reduction (dB, >= 0 : l'etage rapide, le lent)
    this.ms = 0;
    this.pk = 0;
    this.gr = 0;
    this.slow = 0;
    // Les reglages glissants (null : pris tels quels au premier bloc)
    this.thrS = null;
    this.slopeS = 0;
    this.kneeS = 0;
    this.makeS = 0;
    // L'aiguille : la plus forte reduction depuis la derniere lecture
    this.grMax = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'gr') {
        this.port.postMessage({ gr: this.grMax, now: this.mixC > 1e-4 ? this.gr : 0 });
        this.grMax = 0;
      }
    };
  }

  /** Le passe-haut de la chaine laterale (Butterworth, 2 poles) ; hz <= 0 : aucun. */
  setHp(hz) {
    this.hpHz = hz;
    if (hz <= 0) return;
    const w = (2 * Math.PI * hz) / sampleRate;
    const cw = Math.cos(w);
    const al = Math.sin(w) / Math.SQRT2;
    const a0 = 1 + al;
    this.hb0 = (1 + cw) / 2 / a0;
    this.hb1 = -(1 + cw) / a0;
    this.hb2 = (1 + cw) / 2 / a0;
    this.ha1 = (-2 * cw) / a0;
    this.ha2 = (1 - al) / a0;
  }

  /** Le detecteur et la courbe au repos : rien de garde d'un passage d'avant. */
  rest() {
    this.ms = 0;
    this.pk = 0;
    this.gr = 0;
    this.slow = 0;
    this.lx1 = this.lx2 = this.ly1 = this.ly2 = 0;
    this.rx1 = this.rx2 = this.ry1 = this.ry2 = 0;
  }

  process(inputs, outputs, params) {
    const out = outputs[0];
    if (!out || !out.length) return true;
    const inp = inputs[0];
    const n = out[0].length;
    if (!inp || !inp.length) {
      for (const ch of out) ch.fill(0);
      return true;
    }
    const inL = inp[0];
    const inR = inp[1] || inp[0];
    const oL = out[0];
    const oR = out[1] || null;
    const b = prm(params, 'bits', 0, 1, 0);
    const cp = prm(params, 'comp', 0, 1, 0);
    // Le diviseur, entier ; comme chaque reglage d'un FX, il n'agit que BIT engage (bits > 0)
    const fac = Math.round(prm(params, 'rate', 1, 16, 1));
    const tB = b > 0 ? 1 : 0;
    const q = Math.pow(2, 16 - 12 * b - 1);
    // COMP : le MIX vise, et les reglages (recalcules seulement s'ils changent)
    const aS = prm(params, 'atk', 0.0001, 0.05, ATK0);
    const rS = prm(params, 'rel', 0.02, 0.8, REL0);
    if (aS !== this.atkS) {
      this.atkS = aS;
      this.atk = Math.exp(-1 / (aS * sampleRate));
    }
    if (rS !== this.relS) {
      this.relS = rS;
      this.rel = Math.exp(-1 / (rS * sampleRate));
    }
    const auto = prm(params, 'rauto', 0, 1, 1) >= 0.5;
    const thr = prm(params, 'thr', -60, 0, -18);
    const slope = 1 - 1 / prm(params, 'ratio', 1, 20, 4);
    const knee = prm(params, 'knee', 0, 24, 6);
    const make = prm(params, 'makeup', -24, 24, 0);
    const hz = Math.round(prm(params, 'hpf', 0, 400, 60));
    if (hz !== this.hpHz) this.setHp(hz);
    const hpOn = hz > 0;
    if (this.thrS === null) {
      this.thrS = thr;
      this.slopeS = slope;
      this.kneeS = knee;
      this.makeS = make;
    }
    const k = this.glide;
    const kp = this.kParam;
    const kr = this.kRms;
    const atk = this.atk;
    const rel = this.rel;
    let blockMax = this.grMax;
    for (let i = 0; i < n; i += 1) {
      let l = inL[i];
      let r = inR[i];
      this.mixB += (tB - this.mixB) * k;
      this.mixC += (cp - this.mixC) * k;
      if (this.mixB > 1e-4) {
        this.ph += 1;
        if (this.ph >= fac) {
          this.ph = 0;
          this.h0 = Math.round(l * q) / q;
          this.h1 = Math.round(r * q) / q;
        }
        l += (this.h0 - l) * this.mixB;
        r += (this.h1 - r) * this.mixB;
      }
      if (this.mixC > 1e-4) {
        // Les reglages glissent (20 ms)
        this.thrS += (thr - this.thrS) * kp;
        this.slopeS += (slope - this.slopeS) * kp;
        this.kneeS += (knee - this.kneeS) * kp;
        this.makeS += (make - this.makeS) * kp;
        // La chaine laterale : le passe-haut de chaque cote, puis le plus fort des deux
        let sl = l;
        let sr = r;
        if (hpOn) {
          sl = this.hb0 * l + this.hb1 * this.lx1 + this.hb2 * this.lx2 - this.ha1 * this.ly1 - this.ha2 * this.ly2;
          this.lx2 = this.lx1;
          this.lx1 = l;
          this.ly2 = this.ly1;
          this.ly1 = sl;
          sr = this.hb0 * r + this.hb1 * this.rx1 + this.hb2 * this.rx2 - this.ha1 * this.ry1 - this.ha2 * this.ry2;
          this.rx2 = this.rx1;
          this.rx1 = r;
          this.ry2 = this.ry1;
          this.ry1 = sr;
        }
        const al = sl < 0 ? -sl : sl;
        const ar = sr < 0 ? -sr : sr;
        const e = al > ar ? al : ar;
        // Le detecteur : la moyenne des carres (x2 : un sinus lit sa crete) et la crete qui retombe en 10 ms
        this.ms += (e * e - this.ms) * kr;
        this.pk = e > this.pk ? e : this.pk * this.pkRel;
        // Leurs dB meles (PEAK_W de la crete) : le niveau lu, en dB
        const lv = DB20 * (PEAK_W * Math.log(this.pk + 1e-15) + (0.5 - 0.5 * PEAK_W) * Math.log(2 * this.ms + 1e-30));
        // La courbe : la reduction voulue (dB, >= 0), genou doux de largeur kneeS
        const o = lv - this.thrS;
        const w = this.kneeS;
        let t = 0;
        if (w > 0.01 && 2 * o > -w && 2 * o < w) {
          const qk = o + w / 2;
          t = (this.slopeS * qk * qk) / (2 * w);
        } else if (o > 0) t = this.slopeS * o;
        // Le lissage sur la reduction : l'attaque quand elle se creuse, le retour quand elle se relache
        let g;
        if (auto) {
          this.gr = t > this.gr ? atk * this.gr + (1 - atk) * t : this.fastRel * this.gr + (1 - this.fastRel) * t;
          this.slow = t > this.slow ? this.slowAtk * this.slow + (1 - this.slowAtk) * t : this.slowRel * this.slow + (1 - this.slowRel) * t;
          if (this.slow > this.gr) this.gr = this.slow;
          g = this.gr;
        } else {
          this.gr = t > this.gr ? atk * this.gr + (1 - atk) * t : rel * this.gr + (1 - rel) * t;
          g = this.gr;
        }
        if (g > blockMax) blockMax = g;
        // Le gain (la reduction et le rattrapage), mele au sec par le MIX
        const lin = Math.exp((this.makeS - g) * DB_TO_LN);
        const gm = 1 + (lin - 1) * this.mixC;
        l *= gm;
        r *= gm;
      } else if (this.gr !== 0 || this.ms !== 0) this.rest();
      oL[i] = Number.isFinite(l) ? l : 0;
      if (oR) oR[i] = Number.isFinite(r) ? r : 0;
    }
    this.grMax = blockMax;
    // Les silences : les enveloppes tombent a 0 (pas de denormaux) ; une valeur non finie repart du repos
    if (this.ms < TINY) this.ms = 0;
    if (this.pk < TINY) this.pk = 0;
    if (this.gr < 1e-9) this.gr = 0;
    if (this.slow < 1e-9) this.slow = 0;
    if (Math.abs(this.ly1) < TINY && Math.abs(this.ly2) < TINY) this.ly1 = this.ly2 = 0;
    if (Math.abs(this.ry1) < TINY && Math.abs(this.ry2) < TINY) this.ry1 = this.ry2 = 0;
    if (!Number.isFinite(this.ms + this.pk + this.gr + this.slow + this.ly1 + this.ly2 + this.ry1 + this.ry2)) this.rest();
    if (!Number.isFinite(this.thrS + this.slopeS + this.kneeS + this.makeS)) this.thrS = null;
    if (!Number.isFinite(this.grMax)) this.grMax = 0;
    if (!Number.isFinite(this.h0)) this.h0 = 0;
    if (!Number.isFinite(this.h1)) this.h1 = 0;
    return true;
  }
}

registerProcessor('mm-glue', MMGlue);
