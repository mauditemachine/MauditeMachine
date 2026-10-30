/**
 * Les actions du MM-RYTM, tracks : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { pattern } from '../../audio/pattern';
import { lcdMessage } from '../../state/lcdMessage';
import { lcdSamples } from '../../state/lcdSamples';
import { voices } from '../../state/voices';
import { type Inst } from '../../theme';

/** Mode SOLO : la voix passe en solo, ou en sort ; a une voix (ONE), le mode retombe ; l'ecran le dit. */
export function soloVoice(inst: Inst): void {
  voices.toggleSolo(inst);
  const v = voices.get();
  if (!v.soloMulti) voices.disarm('solo');
  lcdMessage.show(v.solo.includes(inst) ? `SOLO ${inst}` : `${inst} SOLO OFF`);
}

/** Mode MUTE : une voix coupee ou rendue ; a une voix (ONE), le mode retombe ; l'ecran le dit. */
export function muteVoice(inst: Inst): void {
  voices.toggleMute(inst);
  if (!voices.get().muteMulti) voices.disarm('mute');
  lcdMessage.show(`${inst} ${voices.isMuted(inst) ? 'MUTED' : 'ON'}`);
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
