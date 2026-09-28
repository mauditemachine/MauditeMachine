/**
 * Le pont React -> scene : un objet plat de refs que React ecrit dans UN
 * useEffect (miroir du moteur, selection, survol, groupe, pending, notice)
 * et que la boucle de rendu lit a chaque frame. Aucun render React par
 * frame ; la scene diffe ces valeurs pour declencher ses transitions.
 */

import type { GroupId } from '../data/beads';

export type V3State = 'boot' | 'idle' | 'selected' | 'loading' | 'playing' | 'paused';
export type DrawerKind = 'none' | 'tracklist' | 'info';

export interface Bridge {
  currentId: string | null;
  selectedId: string | null;
  hoverId: string | null;
  playing: boolean;
  progress: number;
  duration: number;
  pending: boolean;
  /** performance.now() en ms du dernier notice, 0 sinon */
  noticeAt: number;
  noticeId: string | null;
  group: GroupId;
  drawer: DrawerKind;
  state: V3State;
  isTouch: boolean;
  /** Le rotary vient de passer en IV sans mixtape selectionnee : plan coda. */
  codaSeq: number;
}

export const bridge: Bridge = {
  currentId: null,
  selectedId: null,
  hoverId: null,
  playing: false,
  progress: 0,
  duration: 0,
  pending: false,
  noticeAt: 0,
  noticeId: null,
  group: 1,
  drawer: 'none',
  state: 'boot',
  isTouch: false,
  codaSeq: 0,
};
