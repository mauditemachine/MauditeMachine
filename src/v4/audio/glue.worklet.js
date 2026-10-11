/**
 * BIT et COMP du MM-RYTM (2026-10-10, Mika : "on a deja DELAY, remplace DLY
 * TIME et DLY FB par bit reduction et compressor") : sur toute la sortie du
 * MM-RYTM, kick, REVERB et DELAY compris (audio/drums.ts).
 * - BIT : la profondeur tombe de 16 a 4 bits ('bits'), l'echantillonnage se
 *   divise de 1 a 16 ('rate', BIT RATE de sa page, 2026-10-10 : avant, 'bits'
 *   divisait aussi, jusqu'a 8). A 0, le son passe tel quel (quel que soit
 *   'rate' : un reglage du FX, comme les autres).
 * - COMP : un compresseur sans anticipation (le MM-RYTM reste cale sur le
 *   MM-BASS et le MM-ARP) : seuil de 0 a -30 dB, rapport de 1 a 8, attaque
 *   'atk' et retour 'rel' (s, COMP ATTACK et RELEASE de sa page, 2026-10-10 ;
 *   3 ms et 120 ms au depart, ceux d'avant), le gain rattrape a 60 %. A 0,
 *   rien ne bouge.
 * Le passage de 0 a un peu se fait en 10 ms (pas de clic). Rien n'est alloue
 * dans process() ; une valeur non finie vaut celle de depart.
 *
 * COMP refait le 2026-10-11 (Mika : "la compression generale de RYTM est
 * mauvaise, j'aimerais quelque chose de vraiment de qualite ; quand je leve
 * la compression ca baisse le snare, en fait ca baisse tout"). Avant : un
 * detecteur de crete plein spectre (le kick tirait tout vers le bas a chaque
 * coup, le snare compris) et un rattrapage fixe de 60 % (le niveau baissait
 * a mesure que COMP montait). Desormais, un compresseur de bus facon SSL :
 * - detecteur stereo lie (la somme), passe-haut 2 poles a 60 Hz (le sub du
 *   kick ne fait plus pomper le reste) ;
 * - courbe a genou doux (8 dB), seuil de -6 a -24 dB (vite au debut de la
 *   course : la racine de COMP), rapport de 1.5 a 4 (les crans d'un SSL) ;
 * - lissage dans le domaine des dB, attaque et retour de la page COMP (30 ms
 *   et 150 ms au depart : la frappe passe, le corps et les queues se serrent) ;
 * - rattrapage automatique : la reduction moyenne (sur 1.5 s, gelee dans les
 *   silences) est rendue, le niveau reste le meme quand COMP monte ; borne a
 *   +15 dB.
 * Mesure hors ligne sur le motif de depart (sans son) : le RMS a +/-0.2 dB de
 * COMP 0 a 1, la crete de -6.5 a -2.9 dBFS au plus (plus de rouge), le snare
 * 0.6 dB sous son ecart au kick a mi-course, 1.4 dB a fond (4.2 avant).
 */
const ATK0 = 0.003;
const REL0 = 0.12;

/** La reduction (dB, <= 0) de la courbe a genou doux pour un niveau x (dB) : seuil t, pente 1 - 1/rapport, genou w. */
function staticGr(x, t, slope, w) {
  const o = x - t;
  if (2 * o <= -w) return 0;
  if (2 * o < w) {
    const q = o + w / 2;
    return (-slope * q * q) / (2 * w);
  }
  return -slope * o;
}

/** Une valeur finie bornee, sinon d. */
function fin(v, lo, hi, d) {
  return Number.isFinite(v) ? (v < lo ? lo : v > hi ? hi : v) : d;
}

class MMGlue extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [
      { name: 'bits', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'comp', defaultValue: 0, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
      { name: 'rate', defaultValue: 1, minValue: 1, maxValue: 16, automationRate: 'k-rate' },
      { name: 'atk', defaultValue: ATK0, minValue: 0.0001, maxValue: 0.05, automationRate: 'k-rate' },
      { name: 'rel', defaultValue: REL0, minValue: 0.02, maxValue: 0.8, automationRate: 'k-rate' },
    ];
  }

  constructor() {
    super();
    this.mixB = 0;
    this.mixC = 0;
    this.ph = 0;
    this.h0 = 0;
    this.h1 = 0;
    this.env = 0;
    this.atkS = ATK0;
    this.relS = REL0;
    this.atk = Math.exp(-1 / (ATK0 * sampleRate));
    this.rel = Math.exp(-1 / (REL0 * sampleRate));
    this.glide = 1 - Math.exp(-1 / (0.01 * sampleRate));
    // COMP : le passe-haut du detecteur (biquad, Butterworth, 60 Hz), son etat
    const w = (2 * Math.PI * 60) / sampleRate;
    const cw = Math.cos(w);
    const al = Math.sin(w) / Math.SQRT2;
    const a0 = 1 + al;
    this.hb0 = (1 + cw) / 2 / a0;
    this.hb1 = -(1 + cw) / a0;
    this.hb2 = (1 + cw) / 2 / a0;
    this.ha1 = (-2 * cw) / a0;
    this.ha2 = (1 - al) / a0;
    this.hx1 = 0;
    this.hx2 = 0;
    this.hy1 = 0;
    this.hy2 = 0;
    // la reduction lissee (dB, <= 0), sa moyenne lente (le rattrapage), l'enveloppe du detecteur (les silences)
    this.grS = 0;
    this.grAvg = null;
    this.det = 0;
    this.avgK = 1 - Math.exp(-1 / (1.5 * sampleRate));
    this.detRel = Math.exp(-1 / (0.05 * sampleRate));
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
    const b = fin(params.bits[0], 0, 1, 0);
    const cp = fin(params.comp[0], 0, 1, 0);
    // Le diviseur, entier ; comme chaque reglage d'un FX, il n'agit que BIT engage (bits > 0)
    const fac = Math.round(fin(params.rate ? params.rate[0] : 1, 1, 16, 1));
    const tB = b > 0 ? 1 : 0;
    const tC = cp > 0 ? 1 : 0;
    const q = Math.pow(2, 16 - 12 * b - 1);
    // L'attaque et le retour : coefficients recalcules seulement s'ils changent vraiment (le float32 d'un
    // AudioParam ne deplace pas 3 ms : le calcul d'avant au bit pres)
    const aS = fin(params.atk ? params.atk[0] : ATK0, 0.0001, 0.05, ATK0);
    const rS = fin(params.rel ? params.rel[0] : REL0, 0.02, 0.8, REL0);
    if (Math.abs(aS - this.atkS) > 1e-6 * this.atkS) {
      this.atkS = aS;
      this.atk = Math.exp(-1 / (aS * sampleRate));
    }
    if (Math.abs(rS - this.relS) > 1e-6 * this.relS) {
      this.relS = rS;
      this.rel = Math.exp(-1 / (rS * sampleRate));
    }
    // La courbe : seuil -6 a -24 dB (la racine de COMP), rapport 1.5 a 4, genou de 8 dB (pattern.ts compThreshold, compRatio)
    const thr = -6 - 18 * Math.sqrt(cp);
    const ratio = 1.5 + 2.5 * cp;
    const slope = 1 - 1 / ratio;
    const knee = 8;
    // Le rattrapage de depart (avant d'avoir entendu) : la reduction d'un niveau typique du detecteur (-14 dB)
    if (this.grAvg === null || (tC && this.mixC < 1e-4)) this.grAvg = staticGr(-14, thr, slope, knee);
    const k = this.glide;
    for (let i = 0; i < n; i += 1) {
      let l = inL[i];
      let r = inR[i];
      this.mixB += (tB - this.mixB) * k;
      this.mixC += (tC - this.mixC) * k;
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
        // Detecteur : la somme, passee au-dessus de 110 Hz
        const x = 0.5 * (l + r);
        const y = this.hb0 * x + this.hb1 * this.hx1 + this.hb2 * this.hx2 - this.ha1 * this.hy1 - this.ha2 * this.hy2;
        this.hx2 = this.hx1;
        this.hx1 = x;
        this.hy2 = this.hy1;
        this.hy1 = y;
        const ay = Math.abs(y);
        this.det = ay > this.det ? ay : this.det * this.detRel;
        const gr = staticGr(20 * Math.log10(ay + 1e-9), thr, slope, knee);
        // Lissage en dB : l'attaque quand la reduction se creuse, le retour quand elle se relache
        this.grS = gr < this.grS ? this.atk * this.grS + (1 - this.atk) * gr : this.rel * this.grS + (1 - this.rel) * gr;
        // Le rattrapage suit la reduction moyenne, gele quand rien ne joue (le detecteur sous -50 dB)
        if (this.det > 0.00316) this.grAvg += (this.grS - this.grAvg) * this.avgK;
        const makeup = Math.min(15, -this.grAvg);
        const g = Math.pow(10, (this.grS + makeup) / 20);
        const gm = 1 + (g - 1) * this.mixC;
        l *= gm;
        r *= gm;
      }
      oL[i] = Number.isFinite(l) ? l : 0;
      if (oR) oR[i] = Number.isFinite(r) ? r : 0;
    }
    if (!Number.isFinite(this.env)) this.env = 0;
    if (!Number.isFinite(this.grS)) this.grS = 0;
    if (!Number.isFinite(this.grAvg)) this.grAvg = null;
    if (!Number.isFinite(this.det)) this.det = 0;
    if (!Number.isFinite(this.hy1) || !Number.isFinite(this.hy2)) this.hx1 = this.hx2 = this.hy1 = this.hy2 = 0;
    if (!Number.isFinite(this.h0)) this.h0 = 0;
    if (!Number.isFinite(this.h1)) this.h1 = 0;
    return true;
  }
}

registerProcessor('mm-glue', MMGlue);
