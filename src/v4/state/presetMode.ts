/**
 * Les presets sur l'ecran des machines (2026-10-04, Mika : "le bouton
 * preset doit etre dans les machines, et on voit avec l'ecran des
 * machines"). L'ecran du MM-RYTM et celui du MM-ARP portent une etiquette
 * PRESETS ; le toucher ouvre le mode presets de la machine, sur son ecran :
 *   PRESETS 3/7
 *   < HUNGRY PANCAKE >      le haut de l'ecran : gauche, le precedent ;
 *                           droite, le suivant (recharge aussitot)
 *   SAVE NAME DEL  EXIT     la ligne du bas, quatre touches : garder l'etat
 *                           sous un nom au hasard, un autre nom, effacer
 *                           (touchee deux fois : DEL?), sortir
 * Echap, une autre machine ou 15 s sans rien toucher en sortent. Les
 * presets eux-memes : state/presets.ts ; apres ceux de Mika, ceux d'usine
 * (2026-10-07, des styles electro : FACTORY en titre, ni NAME ni DEL). Le
 * MM-BASS aussi (2026-10-07) ; ses 35 presets d'usine (2026-10-09) montrent
 * leur style devant leur rang.
 */

import { BASS_STYLES, stepOf } from '../bass/params';
import { focus } from './focus';
import { presets, type Preset, type PresetMachine } from './presets';

/**
 * Le style d'un preset d'usine du MM-BASS (2026-10-09 : 35 presets ranges par style, Mika : "une bonne grosse
 * liste") : l'ecran le montre devant le rang (DARK DISCO 4/35), on sait ou l'on est en parcourant PREV / NEXT.
 */
function bassGroup(p: Preset): string {
  const v = (p.data as { params?: Record<string, number> }).params?.style;
  return typeof v === 'number' ? BASS_STYLES[stepOf('style', v)] : '';
}

export type PresetKey = 'open' | 'prev' | 'next' | 'save' | 'name' | 'del' | 'exit';

interface ModeState {
  machine: PresetMachine | null;
  /** le preset montre (0 : le plus recent) */
  index: number;
  /** DEL touche une fois : SURE? */
  confirm: boolean;
  /** ce qui vient de se passer (SAVED, LOADED...), le temps d'un coup d'oeil */
  note: string;
}

const IDLE_MS = 15000;
const NOTE_MS = 1600;

let state: ModeState = { machine: null, index: 0, confirm: false, note: '' };
const listeners = new Set<() => void>();
let idle = 0;
let noteTimer = 0;

function commit(next: ModeState): void {
  state = next;
  listeners.forEach((fn) => fn());
}

function touch(): void {
  window.clearTimeout(idle);
  idle = window.setTimeout(() => presetMode.close(), IDLE_MS);
}

function note(text: string): void {
  window.clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => {
    if (state.note) commit({ ...state, note: '' });
  }, NOTE_MS);
  commit({ ...state, note: text });
}

/** Le texte de l'ecran en mode presets (20 colonnes ou plus, selon l'ecran). */
export interface PresetView {
  title: string;
  count: string;
  name: string;
  keys: readonly [string, string, string, string];
  empty: boolean;
}

/** Les jumeaux (lecteurs d'ecran, clavier) : le nom de chaque touche de l'ecran. */
export const PRESET_KEY_ARIA: Readonly<Record<PresetKey, string>> = {
  open: 'Presets, on the screen',
  prev: 'Previous preset',
  next: 'Next preset',
  save: 'Save this as a new preset',
  name: 'Another name for this preset',
  del: 'Delete this preset, press twice',
  exit: 'Close the presets',
};
/** Les touches de l'ecran, mode ferme puis ouvert. */
export const PRESET_KEYS_OFF: readonly PresetKey[] = ['open'];
export const PRESET_KEYS_ON: readonly PresetKey[] = ['prev', 'next', 'save', 'name', 'del', 'exit'];

export const presetMode = {
  get: (): ModeState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Le mode presets de cette machine est-il ouvert ? */
  on: (m: PresetMachine): boolean => state.machine === m,
  close(): void {
    window.clearTimeout(idle);
    if (state.machine) commit({ machine: null, index: 0, confirm: false, note: '' });
  },
  /** Une touche de l'ecran. */
  key(m: PresetMachine, k: PresetKey): void {
    if (k === 'open') {
      touch();
      commit({ machine: m, index: Math.min(state.machine === m ? state.index : 0, Math.max(0, presets.list(m).length - 1)), confirm: false, note: '' });
      return;
    }
    if (state.machine !== m) return;
    if (k === 'exit') {
      presetMode.close();
      return;
    }
    touch();
    const list = presets.list(m);
    if (k === 'save') {
      presets.save(m);
      commit({ ...state, index: 0, confirm: false });
      // Le nom est dessous : le titre le dit en un mot
      note('SAVED');
      return;
    }
    if (list.length === 0) return;
    const cur = list[Math.min(state.index, list.length - 1)];
    if (k === 'prev' || k === 'next') {
      const i = (state.index + (k === 'next' ? 1 : -1) + list.length) % list.length;
      presets.load(m, list[i].id);
      commit({ ...state, index: i, confirm: false });
      note('LOADED');
      return;
    }
    // Un preset d'usine ne se renomme ni ne s'efface (SAVE en fait un a soi)
    if ((k === 'name' || k === 'del') && cur.factory) {
      note('FACTORY');
      return;
    }
    if (k === 'name') {
      presets.rename(m, cur.id);
      commit({ ...state, confirm: false });
      return;
    }
    if (k === 'del') {
      if (!state.confirm) {
        commit({ ...state, confirm: true });
        return;
      }
      presets.remove(m, cur.id);
      commit({ ...state, index: Math.max(0, Math.min(state.index, list.length - 2)), confirm: false });
      note('DELETED');
    }
  },
  /** Ce que l'ecran montre (null : le mode est ferme pour cette machine). */
  view(m: PresetMachine): PresetView | null {
    if (state.machine !== m) return null;
    const list = presets.list(m);
    const empty = list.length === 0;
    const i = Math.min(state.index, Math.max(0, list.length - 1));
    const fac = !empty && !!list[i].factory;
    const group = fac && m === 'bass' ? bassGroup(list[i]) : '';
    return {
      title: state.note || (fac ? 'FACTORY' : 'PRESETS'),
      count: empty ? '' : `${group ? `${group}  ` : ''}${i + 1}/${list.length}`,
      name: empty ? 'NOTHING SAVED YET' : list[i].name.toUpperCase(),
      keys: ['SAVE', empty || fac ? '' : 'NAME', empty || fac ? '' : state.confirm ? 'DEL?' : 'DEL', 'EXIT'],
      empty,
    };
  },
};

// Une autre machine (ou la vue d'ensemble) : le mode se ferme ; une liste qui change : on reste dans ses bornes
focus.subscribe(() => {
  if (state.machine && focus.get() !== state.machine) presetMode.close();
});
presets.subscribe(() => {
  if (state.machine) listeners.forEach((fn) => fn());
});
