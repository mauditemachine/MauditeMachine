/**
 * Les presets sur la face du MM-RYTM (2026-10-27, la V.4.2, Mika : "la gestion doit etre plus simple" ; "appuie-toi
 * pour Rytm de la Digitakt pour les boutons") : au desktop l'ecran ne se touche pas (U3, SCREEN_TOUCH), les presets
 * passent par la face, comme sur la future machine :
 * - EDIT pressee deux fois de suite (la grille des patterns, puis les presets, dans les 1600 ms ou l'ecran dit EDIT AGAIN:
 *   PRESETS ; plus tard, EDIT ferme la grille : actions.ts editToggle) ; l'ecran de HOME le dit (EDIT 2X: PRESETS) ;
 * - en mode presets, cinq touches de la rangee sont les touches de l'ecran (soft keys) : l'ecran dessine leur nom au-dessus
 *   d'elles (LOAD SAVE NAME DEL EXIT, puis OVERWRITE, YES, OK... selon l'etape) ;
 * - un potard fait defiler la liste ; pour nommer, A tourne la lettre et B deplace le curseur.
 * Des donnees seules (les touches de l'ecran, ou une touche PRESET sur la face un jour, se changent ici).
 */

import { RYTM_FACEPLATE, buttonIndex, type FpButtonId } from './faceplate';
import type { PresetSlot } from '../state/presetMode';

/**
 * Les cinq touches de l'ecran en mode presets, dans l'ordre de PRESET_SLOTS : les memes hotspots qu'en V.4.2 (la revue de
 * D1, K1 : le MIDI appris et la touche E gardent leur effet) : SRC (pkey-voice) LOAD, FLTR SAVE, AMP (pkey-env) NAME, FX
 * DEL, PTN (pad-edit) EXIT. Depuis V.5.0 (KIT, PTN pressee deux fois) YES valide aussi (LOAD, OK, OVERWRITE, YES) et NO
 * revient en arriere (actions.ts yesKey, noKey), comme la Digitakt.
 */
export const PRESET_SOFT_KEYS: Readonly<Record<PresetSlot, FpButtonId>> = { load: 'src', save: 'fltr', name: 'amp', del: 'fx', exit: 'ptn' };

/** La place de l'ecran d'une touche de la face (null : elle reste elle-meme). */
export function softSlotOf(id: FpButtonId): PresetSlot | null {
  for (const [slot, key] of Object.entries(PRESET_SOFT_KEYS) as [PresetSlot, FpButtonId][]) if (key === id) return slot;
  return null;
}

/** Le centre reel d'une touche de l'ecran sur la zone active, de 0 (bord gauche) a 1 (bord droit), au-dela si elle en sort. */
function realU(slot: PresetSlot): number {
  const B = RYTM_FACEPLATE.buttons;
  const S = RYTM_FACEPLATE.screen;
  const cx = B.x0 + B.pitch * buttonIndex(PRESET_SOFT_KEYS[slot]) + B.w / 2;
  const x0 = S.rect.x + (S.rect.w - S.active.w) / 2;
  return (cx - x0) / S.active.w;
}

/**
 * La rangee V.5.0 a quatorze touches : FLTR, AMP et FX sont sous les potards, a droite de l'ecran. Les touches de la moitie
 * gauche gardent leur pastille au-dessus d'elles (PTN) ; celles de droite (SRC FLTR AMP FX) se rangent dans leur ordre sur
 * la moitie droite de l'ecran, le nom de leur touche au-dessus de la pastille (scene/screen.ts).
 */
const PACK = { half: 0.5, from: 0.46, to: 0.92 } as const;
const SLOTS = Object.keys(PRESET_SOFT_KEYS) as PresetSlot[];
const PACKED: readonly PresetSlot[] = SLOTS.filter((s) => realU(s) > PACK.half).sort((a, b) => realU(a) - realU(b));

/** Le centre de la pastille d'une touche de l'ecran, de 0 a 1 sur la zone active : au-dessus de sa touche, ou rangee a droite. */
export function softKeyU(slot: PresetSlot): number {
  const j = PACKED.indexOf(slot);
  if (j < 0) return realU(slot);
  return PACKED.length > 1 ? PACK.from + ((PACK.to - PACK.from) * j) / (PACKED.length - 1) : PACK.to;
}

/** La largeur dont une pastille dispose, en part de la zone active (l'ecart le plus serre entre deux pastilles). */
export const softKeyPitchU = (): number => Math.min(RYTM_FACEPLATE.buttons.pitch / RYTM_FACEPLATE.screen.active.w, PACKED.length > 1 ? (PACK.to - PACK.from) / (PACKED.length - 1) : 1);

/** Le nom de la touche de la face d'une place (SRC, FLTR, AMP, FX, PTN) : l'ecran l'ecrit au-dessus de la pastille. */
export function softKeyName(slot: PresetSlot): string {
  return RYTM_FACEPLATE.buttons.keys[buttonIndex(PRESET_SOFT_KEYS[slot])]?.name ?? '';
}
