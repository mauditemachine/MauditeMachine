/**
 * Les actions du MM-RYTM : les presets (presetTurn, presetKey, presetEnter, editToggle, presetFaceKnob). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/presets.ts.
 */

import type { Stage } from '../scene/renderer';
import { lcdMessage } from '../state/lcdMessage';
import { editor, type EditorId } from '../state/editor';
import { patterns, slotName } from '../state/patterns';
import { presetMode, type PresetKey } from '../state/presetMode';
import { undo } from '../state/undo';
import { type PresetMachine } from '../state/presets';
import { dtFace } from '../state/dtFace';
import { DT_FACE, SCREEN_TOUCH } from '../theme';
import { voyMsg } from '../voyager/msg';
import { eventAt, gesture } from './shared';
import { bankViewClose, bankViewToggle } from './internal/patterns';
import { presetAbs } from './internal/dials';
import { funcTake } from './internal/face';
import { presetSoftKey } from './internal/presets';
import { funcDrop } from './face';

/**
 * Le mode presets du desktop du MM-RYTM (2026-10-27, la V.4.2, rytm/presetKeys.ts) : l'ecran ne se touche plus
 * (theme.ts SCREEN_TOUCH), la face fait tout. EDIT pressee deux fois de suite les ouvre (editToggle : PATTERNS, puis
 * PRESETS dans EDIT_AGAIN_MS ; plus tard, EDIT ferme la grille) ; les cinq touches sous l'ecran apres TRK (VOICE FLTR ENV FX
 * EDIT) sont les siennes (presetSoftKey) ; un potard tourne la liste, A et B le nom (presetTurn, presetFaceKnob).
 * Le telephone garde son ecran a toucher et ses touches de page.
 */
export const presetTurns = (): boolean => !SCREEN_TOUCH && presetMode.on('mm808');

/** Un potard de la face tourne de d crans pendant le mode presets du desktop ; true s'il a servi. */
export function presetTurn(k: number, d: number): boolean {
  if (!presetTurns()) return false;
  gesture();
  funcDrop();
  return presetMode.turn('mm808', k, d);
}

/** Entree en mode presets (2026-10-27, le clavier) : LOAD sur la liste, OK sur le nom ; rien aux questions (OVERWRITE, DELETE?). */
export function presetEnter(m: PresetMachine): void {
  const st = presetMode.get().stage;
  if (st === 'browse') presetKey(m, 'load');
  else if (st === 'name') {
    gesture();
    presetMode.nameOk(m);
  }
}

/** Une touche de l'ecran en mode presets (state/presetMode.ts), ou l'ecran touche au repos (open). */
export function presetKey(m: PresetMachine, k: PresetKey): void {
  gesture();
  // Les potards absolus (MIDI) repartent de leur prochaine valeur a chaque ouverture
  if (k === 'open') {
    presetAbs.u = [];
    presetAbs.acc = [];
  }
  // UNDO (2026-10-11, Mika : "j'ai du passer un preset nouveau.. je voulais revenir en arriere") : le geste d'avant se
  // ferme ; LOAD charge un preset (2026-10-27 : PREV et NEXT ne chargent plus, ils deplacent le curseur), son etape a
  // lui (des presets charges a la suite : une seule)
  undo.boundary(m, presetMode.loads(m, k) ? 'preset' : undefined);
  presetMode.key(m, k);
}

/**
 * EDIT (2026-10-04, Mika : "un bouton EDIT sur la machine") : l'editeur de
 * la machine s'ouvre ou se ferme (la suite de l'arpege du MM-ARP, le motif
 * et ses velocites du MM-RYTM, state/editor.ts) ; le bouton s'enfonce,
 * l'ecran le dit.
 */
/**
 * EDIT pressee encore dans ce temps (la grille des patterns vient de s'ouvrir, l'ecran dit EDIT AGAIN: PRESETS) : les
 * presets du desktop ; plus tard, EDIT ferme la grille, comme avant V.4.2 (2026-10-27, la revue P5 : EDIT ne fermait plus
 * la grille, il ouvrait les presets, un geste de tous les jours change). L'instant du geste : l'horodatage de l'evenement
 * (un fil principal pris ne le rallonge pas), sinon maintenant.
 */
const EDIT_AGAIN_MS = 1600;
let editOpenedAt = -Infinity;

export function editToggle(which: EditorId, stage: Stage | null = null): void {
  // Le mode presets du desktop (2026-10-27) : EDIT est sa touche EXIT (ou CANCEL, NO), l'editeur ne s'ouvre pas
  if (which === 'mm808' && presetSoftKey('ptn', () => stage?.pressRytmPad('edit'))) return;
  gesture();
  // FUNC + PTN : BANK (V.5.2), la vue des banques A a H
  if (which === 'mm808' && funcTake()) {
    bankViewToggle(stage);
    return;
  }
  // PTN dans la vue BANK : elle se ferme
  if (which === 'mm808' && DT_FACE && dtFace.bank()) {
    stage?.pressRytmPad('edit');
    bankViewClose();
    return;
  }
  // La grille des patterns gagne sur le mode MUTE (V.5.0) : il se ferme
  if (which === 'mm808' && DT_FACE && dtFace.mute() !== 'off') dtFace.setMute('off');
  // L'ecran ne se touche plus au desktop (V.4.2, 2026-10-27, theme.ts SCREEN_TOUCH) : les presets du MM-RYTM passent par
  // EDIT pressee deux fois de suite (EDIT 2X : la grille des patterns, puis les presets, dans EDIT_AGAIN_MS) ; ouverts, EDIT
  // est leur touche EXIT (plus haut, presetSoftKey) ; presetFaceKnob y met les potards. EDIT plus tard ferme la grille.
  const t = eventAt();
  if (which === 'mm808' && !SCREEN_TOUCH && editor.get() === 'mm808' && t - editOpenedAt < EDIT_AGAIN_MS) {
    editOpenedAt = -Infinity;
    stage?.pressRytmPad('edit');
    editor.toggle('mm808');
    presetKey('mm808', 'open');
    return;
  }
  editor.toggle(which);
  const on = editor.get() === which;
  if (which === 'voy') {
    stage?.voy?.keys.pressButton('edit');
    voyMsg.show(on ? 'EDIT SEQUENCE' : 'EDIT CLOSED');
  } else {
    editOpenedAt = on ? t : -Infinity;
    stage?.pressRytmPad('edit');
    const p = patterns.get();
    // V.5.0 au desktop : PTN, et ses presets s'appellent KIT
    const again = DT_FACE ? ' · PTN AGAIN: KIT' : ' · EDIT AGAIN: PRESETS';
    lcdMessage.show(on ? `PATTERNS: ${slotName(p.cur)}${SCREEN_TOUCH ? '' : again}` : DT_FACE ? 'PTN CLOSED' : 'EDIT CLOSED', on && !SCREEN_TOUCH ? EDIT_AGAIN_MS : undefined);
  }
}

/**
 * Les presets sur les potards de la face (V.4.2, 2026-10-27 : l'ecran ne se touche plus au desktop, theme.ts SCREEN_TOUCH) :
 * un potard tourne de turn crans (le glisser, la molette ; vers la droite, vers le bas de la liste), une tape (turn 0).
 * true si le mode presets du MM-RYTM etait la (le geste est pris).
 */
export function presetFaceKnob(k: number, turn = 0): boolean {
  if (!presetTurns()) return false;
  // 2026-10-27 (la gestion des presets refaite, state/presetMode.ts) : tourner, la liste (tout potard) ou le nom (A la
  // lettre, B le curseur) ; les touches sous l'ecran font les actions (presetSoftKey), une tape de potard est prise et ne
  // fait rien (ni la page d'un FX, ni la liste des sons, cachees sous les presets)
  if (turn !== 0) presetTurn(k, turn);
  return true;
}
