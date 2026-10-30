/**
 * La table des accords de la face DT2 : le CONTRAT (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 2.7). Une entree =
 * (touche, modificateurs, contexte, priorite, action) ; le premier contexte vrai gagne, dans l'ordre de [MEN 2.5]. Un
 * fichier par lane (chords60, chords61seq, chords61face, chords62kit, chords62song, chords62settings), l'ordre des
 * fichiers fige dans actions/chords/index.ts. Vide en P0 : personne ne lit la table, rien ne change.
 * Le test de V.6.0 enumere la table : pas de doublon a meme priorite, chaque entree a un chemin souris, toucher et
 * clavier, et une carte INFOS.
 */

import type { Dt2ButtonId } from '../../rytm/dtFaceIds';
import type { GestureSnapshot, ModKey } from '../../state/gesture';

/** La touche qui declenche : une touche de la face, un TRIG (step:1 a step:16), un potard (knob:A a knob:H, mvol, data). */
export type ChordKey = Dt2ButtonId | `step:${number}` | `knob:${'A' | 'B' | 'C' | 'D' | 'E' | 'F' | 'G' | 'H'}` | 'mvol' | 'data';

/** Le geste de la touche : un appui, un lacher, une tenue, un cran de potard (tourne), un potard presse. */
export type ChordGesture = 'press' | 'release' | 'hold' | 'turn' | 'knobPress';

export interface ChordEvent {
  key: ChordKey;
  gesture: ChordGesture;
  /** les modificateurs engages a cet instant, dans leur ordre */
  mods: GestureSnapshot;
  /** un cran de potard (turn), sinon 0 */
  delta: number;
  /** l'heure de l'evenement (performance.now) */
  t: number;
  /** d'ou il vient */
  src: 'mouse' | 'touch' | 'key' | 'midi' | 'hw';
}

export interface Chord {
  /** unique et stable (les tests, INFOS, les rapports) */
  id: string;
  key: ChordKey;
  gesture: ChordGesture;
  /** les modificateurs requis, dans l'ordre ou ils doivent avoir ete engages (vide : aucun) */
  mods: readonly ModKey[];
  /** le contexte ou l'accord vaut (un menu ouvert, une vue, un mode) ; absent : partout */
  when?: () => boolean;
  /** plus grand d'abord ; a meme priorite, l'ordre de la table */
  prio: number;
  /** l'id de sa carte INFOS (rytm/infoIds.ts) */
  info: string;
  /** les chemins : a la souris, au doigt, au clavier (le test les exige) */
  paths: { mouse: string; touch: string; key: string };
  /** la version qui l'apporte ; inertes (BIENTOT) : leur message au lieu de l'action */
  version: '6.0' | '6.1' | '6.2';
  /** l'action ; false : l'accord passe la main au suivant */
  run: (e: ChordEvent) => boolean | void;
}
