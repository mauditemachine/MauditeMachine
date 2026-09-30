/**
 * Voix BASS (revision 4) : une basse monophonique synthetisee, sans
 * fichier. Dent de scie, plus un carre une octave en dessous a 30 %, deux
 * passe-bas en cascade (Q 6 sur le premier) dont la coupure descend de
 * 1200 a 180 Hz en 120 ms, enveloppe d'amplitude 4 ms d'attaque, 380 ms de
 * decroissance. Gamme verrouillee : do mineur pentatonique, une octave a
 * partir de do2 (65,4 Hz). Glissando de 30 ms quand le pas precedent joue
 * aussi (l'horloge le dit), jamais apres un silence. Monophonique : une
 * note coupe la precedente en 5 ms (sa porte). Elle rejoint le bus commun
 * de drums.ts : TONE, LEVEL, DIST, REVERB et le mute s'appliquent.
 */

import { BASS_DEGREES } from './pattern';

/** Reglages de la voix (brief de la revision 4). */
export const BASS_SYNTH = {
  /** do2 */
  rootHz: 65.406,
  /** do, mi bemol, fa, sol, si bemol : demi-tons au-dessus de do */
  semitones: [0, 3, 5, 7, 10],
  /** carre une octave en dessous */
  sub: 0.3,
  q: 6,
  cutoffFrom: 1200,
  cutoffTo: 180,
  sweep: 0.12,
  attack: 0.004,
  decay: 0.38,
  glide: 0.03,
  /** coupure de la note precedente (monophonie) */
  gateMs: 5,
  /**
   * Niveau de sortie, cale a l'analyseur : environ 4 dB sous la grosse
   * caisse en crete (mesure de la revision 4, voir docs/v4/spec.md).
   */
  out: 0.42,
} as const;

/** Fin de l'enveloppe + 50 ms : les sources s'arretent, puis tout se debranche. */
const STOP_PAD = 0.05;

/** Frequence d'un degre (1 a 5) ; hors bornes : la fondamentale. */
export function bassHz(degree: number): number {
  const d = Number.isInteger(degree) && degree >= 1 && degree <= BASS_DEGREES ? degree : 1;
  return BASS_SYNTH.rootHz * Math.pow(2, BASS_SYNTH.semitones[d - 1] / 12);
}

/** Notes affichees par l'ecran : C, EB, F, G, BB. */
export const BASS_NOTE_NAMES = ['C', 'EB', 'F', 'G', 'BB'] as const;

export interface BassVoice {
  when: number;
  srcs: AudioScheduledSourceNode[];
  nodes: AudioNode[];
}

/** La porte de la derniere note programmee et la fin de son enveloppe (monophonie). */
let lastGate: GainNode | null = null;
let lastEnd = 0;

/**
 * Programme une note a `when` sur `dest` (le bus). `from` : degre du pas
 * precedent s'il jouait (glissando), 0 sinon.
 */
export function bassVoice(c: AudioContext, dest: AudioNode, when: number, degree: number, from: number): BassVoice {
  const S = BASS_SYNTH;
  const f = bassHz(degree);
  const end = when + S.attack + S.decay;

  const saw = c.createOscillator();
  saw.type = 'sawtooth';
  const sq = c.createOscillator();
  sq.type = 'square';
  if (from >= 1) {
    const f0 = bassHz(from);
    saw.frequency.setValueAtTime(f0, when);
    saw.frequency.exponentialRampToValueAtTime(f, when + S.glide);
    sq.frequency.setValueAtTime(f0 / 2, when);
    sq.frequency.exponentialRampToValueAtTime(f / 2, when + S.glide);
  } else {
    saw.frequency.setValueAtTime(f, when);
    sq.frequency.setValueAtTime(f / 2, when);
  }
  const sub = c.createGain();
  sub.gain.value = S.sub;

  const lp1 = c.createBiquadFilter();
  lp1.type = 'lowpass';
  lp1.Q.value = S.q;
  const lp2 = c.createBiquadFilter();
  lp2.type = 'lowpass';
  lp2.Q.value = 0.7;
  for (const lp of [lp1, lp2]) {
    lp.frequency.setValueAtTime(S.cutoffFrom, when);
    lp.frequency.exponentialRampToValueAtTime(S.cutoffTo, when + S.sweep);
  }

  const env = c.createGain();
  env.gain.setValueAtTime(0, when);
  env.gain.linearRampToValueAtTime(1, when + S.attack);
  env.gain.exponentialRampToValueAtTime(0.001, end);

  // La porte : ouverte ; la note suivante la ferme en 5 ms
  const gate = c.createGain();
  gate.gain.value = 1;
  const out = c.createGain();
  out.gain.value = S.out;

  saw.connect(lp1);
  sq.connect(sub);
  sub.connect(lp1);
  lp1.connect(lp2);
  lp2.connect(env);
  env.connect(gate);
  gate.connect(out);
  out.connect(dest);

  // Monophonie : la note precedente qui sonne encore se ferme a `when`
  if (lastGate && lastEnd > when) {
    lastGate.gain.setValueAtTime(1, when);
    lastGate.gain.linearRampToValueAtTime(0, when + S.gateMs / 1000);
  }
  lastGate = gate;
  lastEnd = end;

  const nodes: AudioNode[] = [saw, sq, sub, lp1, lp2, env, gate, out];
  saw.onended = () => {
    for (const n of nodes) n.disconnect();
    if (lastGate === gate) lastGate = null;
  };
  saw.start(when);
  sq.start(when);
  saw.stop(end + STOP_PAD);
  sq.stop(end + STOP_PAD);
  return { when, srcs: [saw, sq], nodes };
}

/** Oublie la derniere note (STOP : ses voix sont annulees). */
export function resetBass(): void {
  lastGate = null;
  lastEnd = 0;
}
