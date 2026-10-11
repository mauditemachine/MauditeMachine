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
 * Echap, une autre machine ou 15 s sans rien toucher en sortent ; rouvert,
 * il repart du dernier preset charge ou garde (2026-10-09). Les
 * presets eux-memes : state/presets.ts ; apres ceux de Mika, ceux d'usine
 * (2026-10-07, des styles electro : FACTORY en titre, ni NAME ni DEL). Le
 * MM-BASS aussi (2026-10-07) ; ses 35 presets d'usine (2026-10-09) montrent
 * leur style devant leur rang, et chaque preset du MM-BASS sa ligne sous son
 * nom (ou tombent les notes).
 *
 * Rien ne se perd (2026-10-11, Mika : "je voulais enregistrer un preset que
 * j'avais fait mais ca ne fonctionne pas bien.. du coup j'ai tout perdu..
 * parce que j'ai du passer un preset nouveau.. je voulais revenir en
 * arriere") :
 * - ouvrir le mode avec un son garde nulle part le met de cote et le montre
 *   d'abord : NOT SAVED, YOUR SOUND, SAVE et EXIT ; avant, l'ecran montrait
 *   un preset d'usine (ACID) comme si c'etait le son du moment, et chercher
 *   une place libre avec NEXT ecrasait le son sans retour ;
 * - les sons mis de cote (state/presets.ts drafts, trois au plus) sont avant
 *   les presets : PREV depuis le premier preset y revient et les recharge
 *   (YOUR SOUND, YOUR SOUND 2, leur heure a la place du rang) ; leur index
 *   est negatif (-1 le plus recent), celui des presets ne bouge pas
 *   (voyager/patch.ts le lit dans presets.list) ;
 * - la deuxieme tape d'un double clic (ou d'une double tape) sur l'ecran
 *   n'est plus un PREV ou un NEXT : la zone qui ouvre le mode est sous celles
 *   de PREV et NEXT, un double clic ouvrait le mode ET chargeait un preset ;
 * - SAVE dit quand le navigateur ne l'a pas pris (NOT SAVED: STORAGE FULL,
 *   le titre THIS VISIT ONLY ensuite) et quand les 99 places sont prises
 *   (FULL: DELETE ONE FIRST) ; avant, SAVED dans tous les cas.
 */

import { BASS_SCALES, BASS_STYLES, SCALE_TONES, stepOf } from '../bass/params';
import { cleanSteps } from '../bass/state';
import { focus } from './focus';
import { presets, type Draft, type Preset, type PresetMachine, type StoreFail } from './presets';

/**
 * Le style d'un preset d'usine du MM-BASS (2026-10-09 : 35 presets ranges par style, Mika : "une bonne grosse
 * liste") : l'ecran le montre devant le rang (DARK DISCO 4/35), on sait ou l'on est en parcourant PREV / NEXT.
 */
function bassGroup(p: Preset): string {
  const v = (p.data as { params?: Record<string, number> }).params?.style;
  return typeof v === 'number' ? BASS_STYLES[stepOf('style', v)] : '';
}

/** Un pas de la ligne d'un preset du MM-BASS, sur l'ecran des presets. */
export interface PresetCell {
  kind: 'off' | 'note' | 'tie';
  acc: boolean;
  slide: boolean;
  /** la hauteur de la note dans la ligne, 0 (la plus grave) a 1 (la plus aigue) ; une liaison garde celle de sa note */
  y: number;
}

/**
 * La ligne d'un preset du MM-BASS (2026-10-09, la revue : Mika veut des "placements de notes differents", l'ecran
 * des presets ne montrait que le nom) : seize pas, ou tombent les notes, leurs liaisons, leurs accents et le contour
 * de la ligne dans sa gamme ; null si le preset n'a pas de ligne lisible.
 */
function bassLine(p: Preset): PresetCell[] | null {
  const d = p.data as { params?: Record<string, number>; steps?: unknown };
  const steps = cleanSteps(d.steps);
  if (!steps) return null;
  const sc = d.params?.scale;
  const tones = SCALE_TONES[BASS_SCALES[typeof sc === 'number' ? stepOf('scale', sc) : 0]];
  const L = tones.length;
  const semis = steps.map((x) => tones[((x.deg % L) + L) % L] + 12 * (Math.floor(x.deg / L) + x.oct));
  const notes = semis.filter((_, i) => steps[i].kind === 'note');
  const lo = Math.min(...notes);
  const span = Math.max(...notes) - lo;
  // Une liaison garde la hauteur de la note qu'elle tient (la derniere note avant elle, en tournant)
  const heldBy = (i: number): number => {
    for (let k = 0; k < steps.length; k += 1) {
      const j = (i - k + steps.length) % steps.length;
      if (steps[j].kind === 'note') return j;
      if (steps[j].kind === 'off') return -1;
    }
    return -1;
  };
  return steps.map((x, i) => {
    const j = x.kind === 'note' ? i : x.kind === 'tie' ? heldBy(i) : -1;
    const y = j < 0 || !notes.length ? 0 : span > 0 ? (semis[j] - lo) / span : 0.5;
    return { kind: x.kind, acc: x.kind === 'note' && x.acc, slide: x.kind === 'note' && x.slide, y };
  });
}

export type PresetKey = 'open' | 'prev' | 'next' | 'save' | 'name' | 'del' | 'exit';

interface ModeState {
  machine: PresetMachine | null;
  /** le preset montre (0 : le plus recent de presets.list) ; -1, -2, -3 : un son mis de cote (presets.drafts, -1 le plus recent) */
  index: number;
  /** DEL touche une fois : SURE? */
  confirm: boolean;
  /** ce qui vient de se passer (SAVED, LOADED...), le temps d'un coup d'oeil */
  note: string;
}

const IDLE_MS = 15000;
const NOTE_MS = 1600;
/** Un echec (NOT SAVED, FULL) reste le temps d'etre lu. */
const FAIL_MS = 4500;
/** PREV et NEXT si tot apres l'ouverture : la deuxieme tape d'un double clic, rien ne se charge (2026-10-11). */
const DOUBLE_MS = 450;

let state: ModeState = { machine: null, index: 0, confirm: false, note: '' };
let openedAt = -Infinity;

/** Ce que dit l'ecran quand le navigateur n'a pas pris une ecriture. */
const FAIL_NOTE: Readonly<Record<StoreFail, string>> = { full: 'NOT SAVED: STORAGE FULL', off: 'NOT SAVED: STORAGE OFF' };

/** Les rangs du mode : les sons mis de cote (-n a -1), puis presets.list (0 a len - 1). */
function bounds(m: PresetMachine): { lo: number; hi: number } {
  return { lo: -presets.drafts(m).length, hi: presets.list(m).length - 1 };
}
const clampIndex = (m: PresetMachine, i: number): number => {
  const { lo, hi } = bounds(m);
  return Math.max(lo, Math.min(Math.max(lo, hi), i));
};
/** Le rang d'un son mis de cote (-1 le plus recent), 0 s'il n'y est plus. */
const draftIndex = (m: PresetMachine, id: string): number => {
  const j = presets.drafts(m).findIndex((d) => d.id === id);
  return j < 0 ? 0 : -(j + 1);
};
/** L'heure ou un son a ete mis de cote (14:32). */
const hhmm = (at: number): string => {
  const d = new Date(at);
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
};
/**
 * Le dernier preset charge ou garde de chaque machine, par son id (2026-10-09, la revue : avec 35 presets d'usine,
 * rouvrir le mode repartait de 1/35 et nommait un preset qui ne jouait pas ; NEXT rechargeait le deuxieme). Le mode
 * rouvre sur lui, PREV / NEXT repartent de lui ; EXIT et les 15 s sans geste ne l'oublient pas.
 */
const last: Partial<Record<PresetMachine, string>> = {};

/** Le rang ou rouvrir : le dernier preset (ou son mis de cote) charge ou garde s'il est encore la, sinon le premier preset. */
function startIndex(m: PresetMachine): number {
  const id = last[m];
  if (!id) return 0;
  const i = presets.list(m).findIndex((p) => p.id === id);
  return i >= 0 ? i : draftIndex(m, id);
}
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

function note(text: string, ms: number = NOTE_MS): void {
  window.clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => {
    if (state.note) commit({ ...state, note: '' });
  }, ms);
  commit({ ...state, note: text });
}

/** Le texte de l'ecran en mode presets (20 colonnes ou plus, selon l'ecran). */
export interface PresetView {
  title: string;
  /** le rang (4/35) */
  count: string;
  /** le style d'un preset d'usine du MM-BASS (DARK DISCO), devant le rang ; '' sinon */
  group: string;
  name: string;
  keys: readonly [string, string, string, string];
  empty: boolean;
  /** MM-BASS : la ligne du preset montre (seize pas) ; absente ailleurs */
  line?: PresetCell[];
}

/** Les jumeaux (lecteurs d'ecran, clavier) : le nom de chaque touche de l'ecran. */
export const PRESET_KEY_ARIA: Readonly<Record<PresetKey, string>> = {
  open: 'Presets, on the screen',
  prev: 'Previous preset, or back to your sound',
  next: 'Next preset',
  save: 'Save the sound playing now as a new preset',
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
      if (state.machine === m) {
        commit({ ...state, index: clampIndex(m, state.index), confirm: false, note: '' });
        return;
      }
      openedAt = performance.now();
      // Le son du moment, garde nulle part : mis de cote et montre d'abord (YOUR SOUND, NOT SAVED), SAVE dessous
      const fresh = presets.setAside(m);
      const index = fresh ? -1 : clampIndex(m, startIndex(m));
      if (fresh) last[m] = presets.drafts(m)[0]?.id;
      commit({ machine: m, index, confirm: false, note: '' });
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
      const r = presets.save(m);
      if (!r.preset) {
        // 99 presets : rien n'est garde, le son du moment ne bouge pas
        commit({ ...state, confirm: false });
        note('FULL: DELETE ONE FIRST', FAIL_MS);
        return;
      }
      last[m] = r.preset.id;
      commit({ ...state, index: 0, confirm: false });
      // Le nom est dessous : le titre le dit en un mot ; le navigateur ne l'a pas pris : l'ecran le dit, plus longtemps
      if (r.kept) note('SAVED');
      else note(FAIL_NOTE[r.why], FAIL_MS);
      return;
    }
    if (k === 'prev' || k === 'next') {
      // La deuxieme tape d'un double clic sur l'ecran (la premiere l'a ouvert) : rien ne se charge
      if (performance.now() - openedAt < DOUBLE_MS) return;
      const { lo, hi } = bounds(m);
      const span = hi - lo + 1;
      if (span <= 0) return;
      const at = clampIndex(m, state.index);
      const i = ((at + (k === 'next' ? 1 : -1) - lo + span) % span) + lo;
      if (i < 0) {
        // Un son mis de cote : il revient (celui du moment, s'il n'est garde nulle part, est mis de cote avant)
        const d = presets.drafts(m)[-i - 1];
        if (d && presets.restore(m, d.id)) last[m] = d.id;
        commit({ ...state, index: d ? draftIndex(m, d.id) : 0, confirm: false });
        note('RESTORED');
        return;
      }
      if (presets.load(m, list[i].id)) last[m] = list[i].id;
      commit({ ...state, index: i, confirm: false });
      note('LOADED');
      return;
    }
    // Un son mis de cote n'a ni nom ni place a effacer : SAVE en fait un preset
    if (state.index < 0 || list.length === 0) return;
    const cur = list[Math.min(state.index, list.length - 1)];
    // Un preset d'usine ne se renomme ni ne s'efface (SAVE en fait un a soi)
    if ((k === 'name' || k === 'del') && cur.factory) {
      note('FACTORY');
      return;
    }
    if (k === 'name') {
      const res = presets.rename(m, cur.id);
      commit({ ...state, confirm: false });
      if (res !== 'ok') note(FAIL_NOTE[res], FAIL_MS);
      return;
    }
    if (k === 'del') {
      if (!state.confirm) {
        commit({ ...state, confirm: true });
        return;
      }
      const res = presets.remove(m, cur.id);
      commit({ ...state, index: Math.max(0, Math.min(state.index, presets.list(m).length - 1)), confirm: false });
      note(res === 'ok' ? 'DELETED' : FAIL_NOTE[res], res === 'ok' ? NOTE_MS : FAIL_MS);
    }
  },
  /** Ce que l'ecran montre (null : le mode est ferme pour cette machine). */
  view(m: PresetMachine): PresetView | null {
    if (state.machine !== m) return null;
    const list = presets.list(m);
    const i = clampIndex(m, state.index);
    // Un son mis de cote (2026-10-11) : NOT SAVED, YOUR SOUND (YOUR SOUND 2...), son heure a la place du rang, SAVE et EXIT
    const d: Draft | undefined = i < 0 ? presets.drafts(m)[-i - 1] : undefined;
    if (d) {
      const line = m === 'bass' ? bassLine({ id: d.id, name: '', at: d.at, data: d.data }) : null;
      return {
        title: state.note || 'NOT SAVED',
        count: hhmm(d.at),
        group: '',
        name: i === -1 ? 'YOUR SOUND' : `YOUR SOUND ${-i}`,
        keys: ['SAVE', '', '', 'EXIT'],
        empty: false,
        ...(line ? { line } : {}),
      };
    }
    const empty = list.length === 0;
    const j = Math.max(0, i);
    const fac = !empty && !!list[j].factory;
    const group = fac && m === 'bass' ? bassGroup(list[j]) : '';
    const line = !empty && m === 'bass' ? bassLine(list[j]) : null;
    // Un preset que le navigateur n'a pas pris (plein ou refuse) : il partira au rechargement, le titre le dit
    const visit = !empty && !fac && presets.unsaved(list[j].id);
    return {
      title: state.note || (fac ? 'FACTORY' : visit ? 'THIS VISIT ONLY' : 'PRESETS'),
      count: empty ? '' : `${j + 1}/${list.length}`,
      group,
      name: empty ? 'NOTHING SAVED YET' : list[j].name.toUpperCase(),
      keys: ['SAVE', empty || fac ? '' : 'NAME', empty || fac ? '' : state.confirm ? 'DEL?' : 'DEL', 'EXIT'],
      empty,
      ...(line ? { line } : {}),
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
