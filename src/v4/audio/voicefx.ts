/**
 * Effets par piste (2026-10-01) : chaque voix (BD a PC, dix depuis le 2026-10-03) a son
 * propre TONE (hauteur et filtre), DECAY (2026-10-04, la queue du coup ; le
 * STRETCH des voix avant), LEVEL, DIST, REVERB, DELAY et CHORUS.
 * Un pad selectionne : les potards reglent cette voix ; sans selection,
 * ils reglent tout le pattern (le bus, drums.ts). Neutre au depart :
 * TONE 0, DECAY 1 (la queue entiere), LEVEL 0.8 (gain 1, la voix telle quelle), le reste a 0 ; a ces
 * valeurs chaque insert est en bypass reel et chaque envoi debranche.
 * Garde en memoire seulement : une visite repart neutre.
 *
 * TUNE, PAN et START (2026-10-08, l'etape R2 des P-locks, Mika : "quand on
 * clic sur un step on selectionne la partie qu'on veut modifier ... on tourne
 * un encoder sur ce step et donc ce step a une valeur differente") : trois
 * reglages de plus par voix, comme sur une Digitakt (SRC TUNE, AMP PAN, SMPL
 * START), appliques coup par coup (audio/drums.ts hitParams) et donc
 * verrouillables pas par pas (audio/locks.ts). A 0 (leur depart), rien ne
 * change dans le graphe ni dans le son :
 * - TUNE : -1 a 1, au demi-ton (+/-24) ; le coup est calcule a sa hauteur,
 *   comme TONE (audio/shots.ts), jamais relu plus vite ;
 * - PAN : -1 (gauche) a 1 (droite), un StereoPannerNode par coup, seulement
 *   hors du centre ;
 * - START : 0 a 1, ou le coup commence dans son echantillon (0 : au debut).
 */


/*
 * V.5.9 (2026-10-30, le moteur a 16 pistes, docs/v4/dt2/dt2-master-spec.md 4.1) : ce module est la FACADE des reglages
 * des 8 voix sur le store des 16 pistes (audio/tracks.ts) ; toute son API d'aujourd'hui reste (environ 62 appels
 * voiceFx.*), sur les pistes 1 a 8. Les lois (VoiceParam, departs, crans, ENV, FINE, le filtre, TUNE, PAN, DECAY,
 * LEVEL) sont dans audio/voicelaw.ts, re-exporte ici tel quel.
 */

import type { Inst } from '../theme';
import { LFO_PARAMS, clampLfo, lfoDefault, type LfoParam } from './lfo';
import { VOICE_FX_DEFAULT, VOICE_PARAMS, voiceClamp, type VoiceFx, type VoiceParam } from './voicelaw';
import { isLegacyTrack, tracksLegacy } from './tracks';

export * from './voicelaw';

const listeners = new Set<() => void>();
// Un reglage d'une des 8 voix a change (ceux des pistes 9 a 16 ne sont pas les siens)
tracksLegacy.onChange((c) => {
  if (c.voice.some(isLegacyTrack)) listeners.forEach((l) => l());
});

export const voiceFx = {
  get: (): Readonly<Record<Inst, Readonly<VoiceFx>>> => tracksLegacy.voices(),
  of: (inst: Inst): Readonly<VoiceFx> => tracksLegacy.voice(inst),
  /** Un reglage d'une voix ; rien ne part si rien ne change. */
  set(inst: Inst, p: VoiceParam, v: number): void {
    const t = voiceClamp(p, v);
    if (tracksLegacy.voice(inst)[p] === t) return;
    tracksLegacy.writeVoice(inst, { [p]: t });
  },
  /** Un reglage d'un LFO de la voix (V.5.1) : le depart le retire ; rien ne part si rien ne change. */
  setLfo(inst: Inst, p: LfoParam, v: number): void {
    const t = clampLfo(p, v);
    if ((tracksLegacy.voice(inst)[p] ?? lfoDefault(p)) === t) return;
    tracksLegacy.writeVoice(inst, { [p]: t });
  },
  /** La voix revient au neutre (ses LFO aussi). */
  reset(inst: Inst): void {
    const patch: Partial<Record<VoiceParam | LfoParam, number>> = { ...VOICE_FX_DEFAULT };
    for (const p of LFO_PARAMS) patch[p] = lfoDefault(p);
    tracksLegacy.writeVoice(inst, patch);
  },
  /** true si la voix a au moins un effet engage. */
  active: (inst: Inst): boolean => {
    const s = tracksLegacy.voice(inst);
    return VOICE_PARAMS.some((p) => s[p] !== VOICE_FX_DEFAULT[p]) || LFO_PARAMS.some((p) => (s[p] ?? lfoDefault(p)) !== lfoDefault(p));
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
