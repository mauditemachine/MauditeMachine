/**
 * Les presets sur la face du MM-RYTM (2026-10-27, la V.4.2, Mika : "la gestion doit etre plus simple" ; "appuie-toi
 * pour Rytm de la Digitakt pour les boutons") : au desktop l'ecran ne se touche pas (U3, SCREEN_TOUCH), les presets
 * passent par la face, comme sur la future machine :
 * - EDIT pressee deux fois de suite (la grille des patterns, puis les presets, dans les 1600 ms ou l'ecran dit EDIT AGAIN:
 *   PRESETS ; plus tard, EDIT ferme la grille : actions.ts editToggle) ; l'ecran de HOME le dit (EDIT 2X: PRESETS) ;
 * - en mode presets, cinq touches de la rangee sont les touches de l'ecran (soft keys) : l'ecran dessine leur nom juste
 *   au-dessus d'elles (VOICE FLTR ENV FX EDIT : LOAD SAVE NAME DEL EXIT, puis OVERWRITE, YES, OK... selon l'etape) ;
 * - un potard fait defiler la liste ; pour nommer, A tourne la lettre et B deplace le curseur.
 * Des donnees seules (les touches de l'ecran, ou une touche PRESET sur la face un jour, se changent ici).
 */

import { RYTM_FACEPLATE, buttonIndex, type FpButtonId } from './faceplate';
import type { PresetSlot } from '../state/presetMode';

/** Les cinq touches de l'ecran en mode presets, dans l'ordre de PRESET_SLOTS : les cinq touches sous l'ecran apres TRK. */
export const PRESET_SOFT_KEYS: Readonly<Record<PresetSlot, FpButtonId>> = { load: 'voice', save: 'fltr', name: 'env', del: 'fx', exit: 'edit' };

/** La place de l'ecran d'une touche de la face (null : elle reste elle-meme). */
export function softSlotOf(id: FpButtonId): PresetSlot | null {
  for (const [slot, key] of Object.entries(PRESET_SOFT_KEYS) as [PresetSlot, FpButtonId][]) if (key === id) return slot;
  return null;
}

/**
 * Le centre d'une touche de l'ecran sur la zone active de l'ecran, de 0 (bord gauche) a 1 (bord droit) : l'ecran y
 * dessine son nom, juste au-dessus de la touche (le centre de la touche en mm, rapporte a la zone active 5:3 centree
 * dans le verre).
 */
export function softKeyU(slot: PresetSlot): number {
  const B = RYTM_FACEPLATE.buttons;
  const S = RYTM_FACEPLATE.screen;
  const cx = B.x0 + B.pitch * buttonIndex(PRESET_SOFT_KEYS[slot]) + B.size / 2;
  const x0 = S.rect.x + (S.rect.w - S.active.w) / 2;
  return (cx - x0) / S.active.w;
}

/** L'ecart entre deux touches de l'ecran, en part de la zone active (la largeur dont une pastille dispose). */
export const softKeyPitchU = (): number => RYTM_FACEPLATE.buttons.pitch / RYTM_FACEPLATE.screen.active.w;
