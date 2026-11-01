/**
 * Cibles MIDI de V.6.0, lane B6 : les pistes T9 a T16 et TRK LEV (midi/targets/reserved.ts tracks60, cahier dt2 3.12, 4.1
 * et 4.5). Le fichier reserve de P0 (2026-10-30, cahier dt2 5.5) : la lane n'ajoute qu'ici, a la suite, dans l'ordre ou
 * ses cibles sortent du CSV (npm run docs:midi : des lignes ajoutees seulement, a la fin du bloc mm808). L'ordre des
 * fichiers est fige dans midi/targets/index.ts (GROUPS).
 *
 * Ce qui sort, dans cet ordre (V.6.0, 2026-11-01) :
 * 1. rytm:voice:<K>:tlev pour les 16 pistes (BD a CY puis T9 a T16) : TRK LEV, 0 a 127 (0.8 = 0 dB, le depart), hors des
 *    scenes (passthrough) ;
 * 2. rytm:voice:<T9..T16>:<reglage> pour chaque reglage de voix d'aujourd'hui (VOICE_PARAMS, les memes lois que BD..CY,
 *    les scenes comprises) ;
 * 3. rytm:voice:<T9..T16>:mute (1 coupee, 0 rendue, sans le mode MUTE) ;
 * 4. rytm:pad:<T9..T16> (joue la piste a l'arret, actions/phone.ts trackPlay) ;
 * 5. rytm:voice:select:<T9..T16> (la piste active, sans un son : actions/face.ts trackSelect de B4, l'integration de la
 *    V.6.0 ; la face V.5.3, ?face=v5, n'a pas de piste 9 a 16 a choisir : SOON) ;
 * 6. rytm:seq:voice:<T9..T16> (la voix des pas du Roto RSEQ, midi/seqlink.ts) ;
 * 7. rytm:voice:<T9..T16>:<reglage de trig, LFO> (TRIG_PARAMS puis LFO_PARAMS, comme BD..CY en V.5.1).
 * Les ids BD..CY d'avant (rytm:voice:BD:level...) gardent leur effet : ce sont toujours les pistes 1 a 8. Les cibles
 * existent tout le temps (des ajouts) ; sur la face V.5.3 (DT2_FACE faux), elles reglent le moteur sans rien dessiner.
 */

import { sceneEdit01, sceneFollowId, sceneHeard01, sceneTakeId, trackMute, trackPlay, trackSelect } from '../../actions';
import { DT2_FACE } from '../../theme';
import { LFO_PARAMS } from '../../audio/lfo';
import { TRIG_PARAMS } from '../../audio/trig';
import { TRACK_KEYS, TRACK_NAMES, trackIndex, tracks, type TrackKey } from '../../audio/tracks';
import { VOICE_PARAMS } from '../../audio/voicefx';
import { lcdMessage } from '../../state/lcdMessage';
import { voices } from '../../state/voices';
import { seqVoiceTrack } from '../seqlink';
import type { MidiTarget } from './types';
import { stageNow as getStage } from './stage';
import { press, seqTarget, VOICE_LABEL } from './helpers';

/** Les pistes 9 a 16. */
const HI: readonly TrackKey[] = TRACK_KEYS.slice(8);
/** Le nom affiche d'une piste (T1 a T16, cahier 4.1). */
const nameOf = (k: TrackKey): string => TRACK_NAMES[trackIndex(k)] ?? k;

/** TRK LEV : 128 crans (0 a 127, la course de la DT2). */
const TLEV_STEPS = 128;

/**
 * Un reglage de voix d'une piste 9 a 16 : la loi de rytm:voice:<BD..CY>:<reglage> (midi/targets/rytm.ts), sur le store
 * tracks. La rangee VOICE (rytm:enc:vol..., SELECTED VOICE) la reprend quand la piste active de la face DT2 est 9 a 16.
 */
export function hiVoiceTarget(k: TrackKey, p: (typeof VOICE_PARAMS)[number]): MidiTarget {
  const bip = p === 'tone' || p === 'tune' || p === 'pan' || p === 'fine' || p === 'fenv';
  const id = `rytm:voice:${k}:${p}`;
  const base = (): number => {
    const x = tracks.vfx(k)[p];
    return bip ? (x + 1) / 2 : x;
  };
  return {
    id,
    scope: 'mm808',
    label: `${nameOf(k)} ${VOICE_LABEL[p]}`,
    kind: 'value',
    ...(p === 'tune' ? { steps: 49 } : p === 'fine' ? { steps: 129 } : p === 'ftype' ? { steps: 3 } : {}),
    get: () => {
      const b = base();
      return sceneEdit01(id) ?? sceneHeard01(id, b) ?? b;
    },
    set: (v) => {
      if (sceneTakeId(id, v)) return;
      const put = (w: number): void => tracks.set(k, p, bip ? w * 2 - 1 : w);
      if (!sceneFollowId(id, v, base(), put)) put(v);
    },
  };
}

export function tracks60Targets(out: MidiTarget[]): void {
  // 1. TRK LEV des 16 pistes (cahier 4.1 : un reglage a part de AMP VOL, non verrouillable, dans le kit) ; l'ecran du
  // MIXER INTERNAL 1-8 / 9-16 est a B5, le potard LEVEL/DATA a B4 (rytm:data, midi/targets/face60.ts)
  for (const k of TRACK_KEYS) {
    out.push({
      id: `rytm:voice:${k}:tlev`,
      scope: 'mm808',
      label: `${nameOf(k)} TRK LEV`,
      kind: 'value',
      steps: TLEV_STEPS,
      get: () => tracks.param(k, 'tlev'),
      set: (v) => {
        if (sceneTakeId(`rytm:voice:${k}:tlev`, v)) return;
        tracks.set(k, 'tlev', Math.round(Math.max(0, Math.min(1, v)) * (TLEV_STEPS - 1)) / (TLEV_STEPS - 1));
      },
    });
  }
  // 2. Les reglages de voix des pistes 9 a 16 (les memes que BD..CY)
  for (const k of HI) for (const p of VOICE_PARAMS) out.push(hiVoiceTarget(k, p));
  // 3. Leurs mutes directs (le Roto en live, comme rytm:voice:<BD..CY>:mute)
  for (const k of HI) {
    out.push({
      id: `rytm:voice:${k}:mute`,
      scope: 'mm808',
      label: `MUTE ${nameOf(k)}`,
      kind: 'value',
      steps: 2,
      get: () => (voices.isMuted(k) ? 1 : 0),
      set: (v) => trackMute(k, v >= 0.5),
    });
  }
  // 4. Leurs pads (jouer la piste a l'arret)
  for (const k of HI) out.push(press(`rytm:pad:${k}`, 'mm808', `PAD ${nameOf(k)}`, () => trackPlay(k, getStage())));
  // 5. Choisir la piste sans un son (la face DT2 : TRK + TRIG 9-16, la piste active de B4 ; la face V.5.3 : SOON, l'ecran le dit)
  for (const k of HI)
    out.push(
      press(`rytm:voice:select:${k}`, 'mm808', DT2_FACE ? `TRACK ${nameOf(k)} (SELECT, SILENT)` : `TRACK ${nameOf(k)} (SELECT, SILENT; SOON)`, () => {
        if (!DT2_FACE) {
          lcdMessage.show(`TRK ${nameOf(k)}: SOON`);
          return;
        }
        trackSelect(k);
        lcdMessage.show(`TRK ${nameOf(k)}`, 900);
      }),
    );
  // 6. La voix des pas du Roto en sequenceur (RSEQ) : la piste, sans la jouer
  for (const k of HI) out.push(press(`rytm:seq:voice:${k}`, 'mm808', `SEQ TRACK ${nameOf(k)} (SELECT, SILENT)`, () => seqVoiceTrack(k)));
  // 7. Leurs reglages de trig et leurs deux LFO (V.5.1 pour BD..CY)
  for (const k of HI) {
    for (const p of TRIG_PARAMS) out.push(seqTarget(k, p));
    for (const p of LFO_PARAMS) out.push(seqTarget(k, p));
  }
}
