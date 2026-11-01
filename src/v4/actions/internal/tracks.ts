/**
 * Les actions du MM-RYTM, tracks : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { pattern } from '../../audio/pattern';
import { lcdMessage } from '../../state/lcdMessage';
import { lcdSamples } from '../../state/lcdSamples';
import { voices } from '../../state/voices';
import { type Inst } from '../../theme';
import { isLegacyTrack, TRACK_NAMES, trackIndex, type TrackKey } from '../../audio/tracks';

/** Le nom d'une voix a l'ecran : BD..CY pour 1 a 8 (comme toujours), T9 a T16 ensuite. */
const voiceName = (k: TrackKey): string => (isLegacyTrack(k) ? k : (TRACK_NAMES[trackIndex(k)] ?? k));

/**
 * Mode SOLO : la voix passe en solo, ou en sort ; a une voix (ONE), le mode retombe ; l'ecran le dit. V.6.0 (l'integration) :
 * les 16 pistes (state/voices.ts : 1 a 8 dans solo, 9 a 16 dans hiSolo).
 */
export function soloVoice(k: TrackKey): void {
  voices.toggleSolo(k);
  const v = voices.get();
  if (!v.soloMulti) voices.disarm('solo');
  lcdMessage.show(voices.isSolo(k) ? `SOLO ${voiceName(k)}` : `${voiceName(k)} SOLO OFF`);
}

/** Mode MUTE : une voix coupee ou rendue ; a une voix (ONE), le mode retombe ; l'ecran le dit (16 pistes, comme soloVoice). */
export function muteVoice(k: TrackKey): void {
  voices.toggleMute(k);
  if (!voices.get().muteMulti) voices.disarm('mute');
  lcdMessage.show(`${voiceName(k)} ${voices.isMuted(k) ? 'MUTED' : 'ON'}`);
}

/**
 * La voix selectionnee : les pas et, depuis le 2026-10-01, les potards
 * d'effets la reglent. L'ecran le dit quand la cible change : KNOBS > BD,
 * ou KNOBS > PATTERN au retour a tout le pattern.
 */
export function selectVoice(inst: Inst | null): void {
  if (pattern.get().instrument === inst) return;
  pattern.select(inst);
  // Le navigateur des sons ouvert (2026-10-18) : il passe a la voix touchee (watchBrowser), son repos repart ; l'ecran ne
  // dit pas KNOBS > (la liste montre deja la voix)
  if (lcdSamples.isOpen()) lcdSamples.touch();
  else lcdMessage.show(`KNOBS > ${inst ?? 'PATTERN'}`);
}
/** L'aide de TRK reste tant que la touche est engagee ; elle s'eteint avec elle (une minute au plus : rien ne l'oublie). */
export const TRK_HINT_MS = 60000;
