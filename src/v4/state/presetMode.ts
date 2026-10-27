/**
 * Les presets sur l'ecran des machines (2026-10-04, Mika : "le bouton
 * preset doit etre dans les machines, et on voit avec l'ecran des
 * machines"). L'ecran du MM-RYTM et celui du MM-ARP s'ouvrent sur le mode
 * presets ; le MM-BASS aussi (2026-10-07), sa touche PRESET ou son en-tete ;
 * ses 35 presets d'usine (2026-10-09) montrent leur style devant leur rang,
 * et chaque preset du MM-BASS sa ligne sous son nom (ou tombent les notes).
 * Les presets eux-memes : state/presets.ts ; apres ceux de Mika, ceux
 * d'usine (2026-10-07, des styles electro).
 *
 * Plus simple (2026-10-27, la V.4.2, Mika : "je voudrais que la gestion des presets soit plus simple ! et aussi qu'on
 * puisse nommer ses presets ! un nom d'utilisateur 4 lettres et le nom du preset jusqu'a 10 lettres, en mobile et en
 * desktop" ; "appuie-toi pour Rytm de la Digitakt pour les boutons") : une liste, cinq touches toujours a la meme
 * place, un nom choisi.
 *   PRESETS            3/27     le titre (LOADED ou EDITED sur le preset charge, FACTORY, la note un instant) et le rang
 *   < MIKA/DEEP KICK* >         le curseur ; PREV et NEXT le deplacent sans rien charger (comme une Digitakt : on
 *                               regarde, puis on confirme) ; il s'ouvre sur le preset charge
 *   LOAD SAVE NAME DEL EXIT     les cinq touches (des places : leur nom vient de la vue, l'etape les change)
 * - LOAD charge le preset du curseur, en un geste ; le son du moment, s'il n'est garde nulle part, est mis de cote
 *   d'abord (YOUR SOUND en tete de liste, NOT SAVED ; il revient par LOAD, DEL l'oublie) et UNDO le rend aussi.
 * - SAVE : rien de charge (ou un preset d'usine, ou un son mis de cote) : le nom (stage name : le dialogue,
 *   ui/PresetNameDialog.tsx, et l'ecran ; un nom drole et court propose) ; un preset a toi charge : OVERWRITE (le
 *   meme, sa place, son nom) ou AS NEW (le nom, le sien numerote propose), ou CANCEL (stage choice).
 * - NAME (sur un preset a toi) : le dialogue, prerempli.
 * - DEL (sur un preset a toi ou un son mis de cote) : DELETE? YES (la meme place, ignoree DEL_GUARD_MS apres DEL :
 *   un double clic n'efface rien) ou NO (stage confirm).
 * - EXIT ferme ; Echap revient d'un cran (back) ; un preset d'usine ne se renomme ni ne s'efface (NAME et DEL vides).
 * - Nommer : l'utilisateur (4) et le nom (1 a 10) aux regles de state/presetName.ts ; au desktop du MM-RYTM, le
 *   potard A tourne la lettre et le potard B le curseur (le repli materiel, facon Elektron, turn) ; OK (la premiere
 *   place) garde, CANCEL (la derniere) revient a la liste.
 * Echap, une autre machine ou 60 s sans geste en sortent (jamais pendant le nom) ; dans les 10 s qui suivent une
 * fermeture par l'attente, gauche et droite le rouvrent au lieu de changer de machine (resumable), sauf apres Echap ou
 * une autre machine (2026-10-22, la revue). Les index des sons mis de cote sont negatifs (-1 le plus recent), ceux des
 * presets ne bougent pas (voyager/patch.ts lit LOADED et SAVED dans presets.list). PREV et NEXT moins de 600 ms apres
 * l'ouverture ne font rien (la deuxieme tape d'un double clic, 2026-10-11).
 */

import { BASS_SCALES, BASS_STYLES, SCALE_TONES, stepOf } from '../bass/params';
import { cleanSteps } from '../bass/state';
import { focus } from './focus';
import { PRESET_MAX, presets, type Draft, type Preset, type PresetMachine, type StoreFail } from './presets';
import { draftLine, draftResult, moveCursor, nameOk, nextName, suggestName, turnChar, typeChars, userOk, NAME_MAX, NAME_TAKEN, USER_LEN, type NameDraft } from './presetName';

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

/**
 * Les touches du mode : open (l'ecran au repos), close (la touche qui l'a ouvert, encore : PRESET du MM-BASS, P au
 * clavier ; ferme a toute etape), prev et next (le curseur), et les cinq places du bas (PRESET_SLOTS).
 */
export type PresetKey = 'open' | 'close' | 'prev' | 'next' | 'load' | 'save' | 'name' | 'del' | 'exit';
/** Les cinq touches du bas, dans l'ordre (2026-10-27) : des places ; leur nom et leur action viennent de l'etape. */
export const PRESET_SLOTS = ['load', 'save', 'name', 'del', 'exit'] as const;
export type PresetSlot = (typeof PRESET_SLOTS)[number];
/** L'etape : la liste, OVERWRITE ou AS NEW, DELETE?, le nom. */
export type PresetStage = 'browse' | 'choice' | 'confirm' | 'name';

/** Le nom en cours (stage name) : un nouveau preset ou celui qu'on renomme, l'edition, ce que les regles reprochent. */
export interface PresetNamingState {
  kind: 'new' | 'rename';
  /** le preset renomme ; null : un nouveau */
  id: string | null;
  draft: NameDraft;
  /** '' : rien a redire ; sinon ce que l'ecran et le dialogue disent (USER: 4 CHARACTERS...) */
  problem: string;
  /** l'utilisateur n'a jamais ete choisi dans ce navigateur : le dialogue le demande d'abord */
  askUser: boolean;
  /** le nom d'avant la migration des noms du preset renomme (Gentle Jellyfish) ; '' sinon (le dialogue le montre) */
  was: string;
}

interface ModeState {
  machine: PresetMachine | null;
  /** le curseur (0 : le plus recent de presets.list) ; -1, -2, -3 : un son mis de cote (presets.drafts, -1 le plus recent) */
  index: number;
  stage: PresetStage;
  /** ce qui vient de se passer (SAVED, LOADED...), le temps d'un coup d'oeil */
  note: string;
  /** stage name : le nom en cours ; null sinon */
  naming: PresetNamingState | null;
}

const IDLE_MS = 60000;
/** Apres une fermeture par l'attente (2026-10-21, audit) : le temps ou les fleches rouvrent le mode au lieu de changer de machine. */
const RESUME_MS = 10000;
const NOTE_MS = 1600;
/** Un echec (NOT SAVED, FULL) reste le temps d'etre lu. */
const FAIL_MS = 4500;
/**
 * PREV et NEXT si tot apres l'ouverture : la deuxieme tape d'un double clic, rien ne bouge (2026-10-11 ; le double
 * clic des systemes va jusqu'a 500 ms).
 */
const DOUBLE_MS = 600;
/** YES de DELETE? est a la place de DEL (2026-10-27) : un double clic sur DEL n'efface rien, il faut un second geste. */
const DEL_GUARD_MS = 350;

let state: ModeState = { machine: null, index: 0, stage: 'browse', note: '', naming: null };
let openedAt = -Infinity;
let confirmAt = -Infinity;

/**
 * L'instant du geste : celui de l'evenement en cours (window.event : la tape, le clic, la touche), meme traite en
 * retard (un telephone lent, l'ecran qui se redessine apres l'ouverture : la deuxieme tape d'un double clic arrivait
 * 700 ms apres la premiere) ; hors d'un evenement, ou un horodatage d'une autre horloge : maintenant.
 */
function gestureAt(): number {
  const now = performance.now();
  const e = typeof window !== 'undefined' ? (window as { event?: Event }).event : undefined;
  const t = e?.timeStamp;
  return typeof t === 'number' && t > 0 && t <= now && now - t < 5000 ? t : now;
}

/**
 * Le geste en cours est-il un pointeur (une tape, un clic) ? La garde du double clic ne vaut que pour lui (2026-10-27 : P
 * puis une fleche tout de suite, au clavier, ne deplacait rien).
 */
function pointerGesture(): boolean {
  const e = typeof window !== 'undefined' ? (window as { event?: Event }).event : undefined;
  return !!e && /^(pointer|mouse|touch|click)/.test(e.type);
}

/**
 * Ce que dit l'ecran quand le navigateur n'a pas pris une ecriture (plein, ou refuse : navigation privee) ; 20 lettres au
 * plus, la ligne du titre du MM-RYTM (state/lcd.ts), le rang s'efface le temps de la lire (LONG_NOTE).
 */
const FAIL_NOTE: Readonly<Record<StoreFail, string>> = { full: 'NOT SAVED: NO SPACE', off: 'NOT SAVED: BLOCKED' };
/** Les 99 presets : SAVE refuse (OVERWRITE reste permis). */
const MAX_NOTE = 'LIST FULL: DEL ONE';
/** Une note plus longue : le rang ne s'affiche pas a cote d'elle (la ligne du titre du MM-RYTM tient 20 lettres). */
const LONG_NOTE = 12;

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
 * Ou etait le curseur de chaque machine (son id, 2026-10-09 ; depuis le 2026-10-27, le curseur seul : le preset charge
 * est retenu par presets.loadedId). EXIT et les 60 s sans geste ne l'oublient pas.
 */
const last: Partial<Record<PresetMachine, string>> = {};

/** Le rang d'un id (un preset de la liste, ou un son mis de cote) ; null s'il n'y est plus. */
function indexOf(m: PresetMachine, id: string | null | undefined): number | null {
  if (!id) return null;
  const i = presets.list(m).findIndex((p) => p.id === id);
  if (i >= 0) return i;
  const j = presets.drafts(m).findIndex((d) => d.id === id);
  return j >= 0 ? -(j + 1) : null;
}

/** Le rang ou s'ouvrir : le preset charge, sinon la ou etait le curseur, sinon ce qui joue tel quel, sinon le premier. */
function startIndex(m: PresetMachine): number {
  return indexOf(m, presets.loadedId(m)) ?? indexOf(m, last[m]) ?? indexOf(m, presets.playing(m)) ?? 0;
}

/** Ce qu'il y a sous le curseur. */
type Row = { kind: 'draft'; draft: Draft; at: number } | { kind: 'user' | 'factory'; preset: Preset; at: number } | { kind: 'none'; at: number };
function rowAt(m: PresetMachine, i: number): Row {
  if (i < 0) {
    const d = presets.drafts(m)[-i - 1];
    return d ? { kind: 'draft', draft: d, at: i } : { kind: 'none', at: i };
  }
  const p = presets.list(m)[i];
  return p ? { kind: p.factory ? 'factory' : 'user', preset: p, at: i } : { kind: 'none', at: i };
}
/** Le libelle d'une ligne : MIKA/DEEP KICK, ACID, YOUR SOUND (YOUR SOUND 2...). */
function rowLabel(r: Row): string {
  if (r.kind === 'draft') return r.at === -1 ? 'YOUR SOUND' : `YOUR SOUND ${-r.at}`;
  if (r.kind === 'none') return '';
  return presets.label(r.preset);
}
const rowId = (r: Row): string | null => (r.kind === 'draft' ? r.draft.id : r.kind === 'none' ? null : r.preset.id);
/** Le libelle lu d'une ligne : un preset migre dit aussi son nom d'avant (2026-10-27, la revue : was n'etait montre nulle part). */
function rowAria(r: Row): string {
  const lab = rowLabel(r);
  return r.kind === 'user' && r.preset.was ? `${lab} (was ${r.preset.was})` : lab;
}

const listeners = new Set<() => void>();
let idle = 0;
let noteTimer = 0;
/**
 * Le mode ferme par l'attente : sa machine, quand, et le compte des changements de machine a ce moment (null : ferme
 * autrement, ou rouvert). La revue du 2026-10-22 : une autre machine puis le retour, dans les 10 s, et la fleche
 * rouvrait les presets au lieu de changer de machine (focus.changes : une machine changee, meme revenue, l'annule ;
 * le cadrage arrive, focus.settle, ne compte pas).
 */
let idleClosed: { m: PresetMachine; at: number; changes: number } | null = null;

function commit(next: ModeState): void {
  state = next;
  listeners.forEach((fn) => fn());
}

function touch(): void {
  window.clearTimeout(idle);
  idle = window.setTimeout(() => {
    // Un nom en cours ne se ferme jamais seul (le dialogue peut attendre une frappe lente)
    if (state.stage === 'name') {
      touch();
      return;
    }
    const m = state.machine;
    presetMode.close();
    if (m) idleClosed = { m, at: performance.now(), changes: focus.changes };
  }, IDLE_MS);
}

function note(text: string, ms: number = NOTE_MS): void {
  window.clearTimeout(noteTimer);
  noteTimer = window.setTimeout(() => {
    if (state.note) commit({ ...state, note: '' });
  }, ms);
  commit({ ...state, note: text });
}

/** Retour a la liste (une etape annulee ou finie). */
const browse = (over: Partial<ModeState> = {}): ModeState => ({ ...state, stage: 'browse', naming: null, ...over });

/** Les noms deja pris par les presets a toi de la machine. */
const takenNames = (m: PresetMachine): Set<string> => new Set(presets.of(m).map((p) => p.name));

/** Le nom commence : un nouveau preset (base : le nom propose) ou celui qu'on renomme (was : son nom d'avant la migration). */
function startNaming(m: PresetMachine, kind: 'new' | 'rename', id: string | null, base: string, user: string | null, was = ''): void {
  const known = presets.user();
  const u = typeChars(user ?? known ?? '', USER_LEN);
  const name = typeChars(base, NAME_MAX);
  const askUser = !known;
  // Le curseur du potard B : sur l'utilisateur s'il manque, sinon au bout du nom
  const cursor = u.length < USER_LEN ? u.length : Math.min(USER_LEN + NAME_MAX - 1, USER_LEN + name.length);
  commit({ ...state, stage: 'name', naming: { kind, id, draft: { user: u, name, cursor }, problem: '', askUser, was }, note: '' });
}

/** Le texte de l'ecran en mode presets (20 colonnes ou plus, selon l'ecran). */
export interface PresetView {
  stage: PresetStage;
  title: string;
  /** le rang (4/35), l'heure d'un son mis de cote */
  count: string;
  /** le style d'un preset d'usine du MM-BASS (DARK DISCO), devant le rang ; '' sinon */
  group: string;
  /** le curseur : MIKA/DEEP KICK (une etoile s'il est le preset charge et a bouge), ACID, YOUR SOUND ; le nom en cours (stage name) */
  name: string;
  /** les cinq touches (PRESET_SLOTS), '' : vide */
  keys: readonly [string, string, string, string, string];
  /** ce que dit chaque touche aux lecteurs d'ecran ('' : vide) */
  aria: readonly [string, string, string, string, string];
  empty: boolean;
  /** MM-BASS : la ligne du preset montre (seize pas) ; absente ailleurs */
  line?: PresetCell[];
  /** les lignes d'avant et d'apres le curseur (le MM-RYTM les dessine pales) ; '' : aucune */
  prev: string;
  next: string;
  /** le curseur est le preset charge : 'loaded', 'edited' s'il a bouge ; '' sinon */
  mark: '' | 'loaded' | 'edited';
  /** ce qui est sous le curseur */
  kind: 'user' | 'factory' | 'draft' | 'none';
  /** stage name : la ligne USER/NAME et la case du curseur (potard B), ce que les regles reprochent */
  naming: { text: string; at: number; problem: string; kind: 'new' | 'rename' } | null;
}

/** Les jumeaux (lecteurs d'ecran, clavier) : le nom des touches qui ne changent pas. */
export const PRESET_KEY_ARIA: Readonly<Record<'open' | 'prev' | 'next', string>> = {
  open: 'Presets: load, save, name and delete the sounds of this machine',
  prev: 'Previous preset in the list (nothing loads)',
  next: 'Next preset in the list (nothing loads)',
};
/** Les touches de l'ecran, mode ferme puis ouvert. */
export const PRESET_KEYS_OFF: readonly PresetKey[] = ['open'];
export const PRESET_KEYS_ON: readonly PresetKey[] = ['prev', 'next', ...PRESET_SLOTS];

/** Ce que fait une place a l'etape du moment, sur la ligne du curseur : son nom a l'ecran, son nom lu, son action. */
type SlotAct = 'load' | 'save' | 'rename' | 'delete' | 'exit' | 'overwrite' | 'asnew' | 'cancel' | 'yes' | 'no' | 'ok';
interface Slot {
  act: SlotAct;
  label: string;
  aria: string;
}
function slotsOf(m: PresetMachine): Partial<Record<PresetSlot, Slot>> {
  const r = rowAt(m, clampIndex(m, state.index));
  const lab = rowAria(r);
  if (state.stage === 'choice') {
    const l = presets.loaded(m);
    const what = l?.label ?? lab;
    // OVERWRITE et AS NEW a deux places d'ecart : leurs pastilles larges tiennent au-dessus des touches
    return {
      load: { act: 'overwrite', label: 'OVERWRITE', aria: `Overwrite ${what} with the sound playing now` },
      name: { act: 'asnew', label: 'AS NEW', aria: 'Save the sound playing now as a new preset (you name it)' },
      exit: { act: 'cancel', label: 'CANCEL', aria: 'Cancel, nothing is saved' },
    };
  }
  if (state.stage === 'confirm') {
    return {
      del: { act: 'yes', label: 'YES', aria: `Yes, delete ${lab}` },
      exit: { act: 'no', label: 'NO', aria: `No, keep ${lab}` },
    };
  }
  if (state.stage === 'name') {
    return {
      load: { act: 'ok', label: 'OK', aria: state.naming?.kind === 'rename' ? 'OK, rename the preset' : 'OK, save the preset under this name' },
      exit: { act: 'cancel', label: 'CANCEL', aria: 'Cancel, back to the list' },
    };
  }
  const out: Partial<Record<PresetSlot, Slot>> = {
    save: { act: 'save', label: 'SAVE', aria: 'Save the sound playing now: as a new preset, or over the loaded one' },
    exit: { act: 'exit', label: 'EXIT', aria: 'Close the presets' },
  };
  if (r.kind !== 'none') out.load = { act: 'load', label: 'LOAD', aria: `Load ${lab}` };
  if (r.kind === 'user') out.name = { act: 'rename', label: 'NAME', aria: `Rename ${lab}` };
  if (r.kind === 'user' || r.kind === 'draft') out.del = { act: 'delete', label: 'DEL', aria: `Delete ${lab} (asks to confirm)` };
  return out;
}

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
    idleClosed = null;
    if (state.machine) commit({ machine: null, index: 0, stage: 'browse', note: '', naming: null });
  },
  /**
   * Le mode de cette machine vient de se fermer seul (60 s sans geste, moins de RESUME_MS avant at, l'instant de la
   * touche : e.timeStamp, pas l'heure ou elle est traitee) : la machine, que les fleches rouvrent (hooks/useKeys.ts) ;
   * null sinon.
   */
  resumable(m: string, at = performance.now()): PresetMachine | null {
    const c = idleClosed;
    return c && c.m === m && state.machine === null && at - c.at < RESUME_MS && focus.changes === c.changes ? c.m : null;
  },
  /** Echap (2026-10-22, la revue : sans rien d'ouvert, la fleche suivante rouvrait quand meme les presets) : plus de reprise. */
  forget(): void {
    idleClosed = null;
  },
  /** La touche k chargera-t-elle un preset (LOAD sur la liste) ? actions.ts en fait une etape d'UNDO a elle. */
  loads(m: PresetMachine, k: PresetKey): boolean {
    if (state.machine !== m || state.stage !== 'browse' || k !== 'load') return false;
    return rowAt(m, clampIndex(m, state.index)).kind !== 'none';
  },
  /**
   * Echap (2026-10-27) : un cran en arriere ; le nom, OVERWRITE / AS NEW et DELETE? reviennent a la liste, la liste se
   * ferme. true si quelque chose a change.
   */
  back(): boolean {
    if (!state.machine) return false;
    if (state.stage !== 'browse') {
      commit(browse({ note: '' }));
      touch();
      return true;
    }
    presetMode.close();
    return true;
  },
  /** Une touche de l'ecran (ou son jumeau, une touche de la face, le clavier). */
  key(m: PresetMachine, k: PresetKey): void {
    if (k === 'open') {
      idleClosed = null;
      touch();
      if (state.machine === m) {
        commit({ ...state, index: clampIndex(m, state.index), note: '' });
        return;
      }
      openedAt = gestureAt();
      // Rien n'est mis de cote a l'ouverture (2026-10-27 : avant, NOT SAVED et YOUR SOUND des qu'on avait tourne un
      // potard) ; le curseur est sur le preset charge
      commit({ machine: m, index: clampIndex(m, startIndex(m)), stage: 'browse', note: '', naming: null });
      return;
    }
    if (state.machine !== m) return;
    if (k === 'close') {
      presetMode.close();
      return;
    }
    touch();
    if (k === 'prev' || k === 'next') {
      if (state.stage !== 'browse') return;
      // La deuxieme tape d'un double clic sur l'ecran (la premiere l'a ouvert) : rien ne bouge
      if (pointerGesture() && gestureAt() - openedAt < DOUBLE_MS) return;
      presetMode.step(m, k === 'next' ? 1 : -1, true);
      return;
    }
    const slot = slotsOf(m)[k];
    if (!slot) return;
    const r = rowAt(m, clampIndex(m, state.index));
    switch (slot.act) {
      case 'exit':
        presetMode.close();
        return;
      case 'cancel':
      case 'no':
        commit(browse({ note: '' }));
        return;
      case 'load': {
        if (r.kind === 'draft') {
          // Un son mis de cote revient (celui du moment, s'il n'est garde nulle part, est mis de cote avant)
          const d = presets.restore(m, r.draft.id);
          if (d) last[m] = d.id;
          commit(browse({ index: d ? draftIndex(m, d.id) : 0 }));
          note('LOADED');
          return;
        }
        if (r.kind === 'none') return;
        if (presets.load(m, r.preset.id)) last[m] = r.preset.id;
        commit(browse({ index: r.at }));
        note('LOADED');
        return;
      }
      case 'save': {
        const l = presets.loaded(m);
        if (l && !l.factory) {
          // Un preset a toi charge : OVERWRITE ou AS NEW, le curseur sur lui
          const i = indexOf(m, l.id);
          commit({ ...state, stage: 'choice', index: i ?? state.index, note: '' });
          return;
        }
        if (presets.of(m).length >= PRESET_MAX) {
          note(MAX_NOTE, FAIL_MS);
          return;
        }
        startNaming(m, 'new', null, suggestName(takenNames(m)), null);
        return;
      }
      case 'overwrite': {
        const l = presets.loaded(m);
        const res = l ? presets.overwrite(m, l.id) : null;
        if (!res) {
          commit(browse());
          return;
        }
        last[m] = res.preset.id;
        commit(browse({ index: indexOf(m, res.preset.id) ?? state.index }));
        if (res.res === 'ok') note('SAVED');
        else note(FAIL_NOTE[res.res], FAIL_MS);
        return;
      }
      case 'asnew': {
        if (presets.of(m).length >= PRESET_MAX) {
          commit(browse());
          note(MAX_NOTE, FAIL_MS);
          return;
        }
        const l = presets.loaded(m);
        const p = l ? presets.list(m).find((x) => x.id === l.id) : undefined;
        startNaming(m, 'new', null, p ? nextName(p.name, takenNames(m)) : suggestName(takenNames(m)), p?.user ?? null);
        return;
      }
      case 'rename': {
        if (r.kind !== 'user') return;
        startNaming(m, 'rename', r.preset.id, r.preset.name, r.preset.user ?? null, r.preset.was ?? '');
        return;
      }
      case 'delete':
        confirmAt = gestureAt();
        commit({ ...state, stage: 'confirm', note: '' });
        return;
      case 'yes': {
        // YES est a la place de DEL : la deuxieme tape d'un double clic n'efface rien
        if (gestureAt() - confirmAt < DEL_GUARD_MS) return;
        if (r.kind === 'draft') {
          presets.dropDraft(m, r.draft.id);
          commit(browse({ index: clampIndex(m, r.at + 1 > -1 ? 0 : r.at + 1) }));
          note('DELETED');
          return;
        }
        if (r.kind !== 'user') {
          commit(browse());
          return;
        }
        const res = presets.remove(m, r.preset.id);
        commit(browse({ index: clampIndex(m, state.index) }));
        note(res === 'ok' ? 'DELETED' : FAIL_NOTE[res], res === 'ok' ? NOTE_MS : FAIL_MS);
        return;
      }
      case 'ok':
        presetMode.nameOk(m);
        return;
    }
  },
  /**
   * Le curseur deplace de d lignes : PREV et NEXT tournent en boucle (wrap), le potard s'arrete aux bouts (comme la
   * liste d'une machine). Rien ne se charge.
   */
  step(m: PresetMachine, d: number, wrap = false): void {
    if (state.machine !== m || state.stage !== 'browse' || d === 0) return;
    const { lo, hi } = bounds(m);
    const span = hi - lo + 1;
    if (span <= 0) return;
    const at = clampIndex(m, state.index);
    const i = wrap ? ((((at + d - lo) % span) + span) % span) + lo : Math.max(lo, Math.min(hi, at + d));
    if (i === at && !state.note) return;
    const id = rowId(rowAt(m, i));
    if (id) last[m] = id;
    commit({ ...state, index: i, note: '' });
  },
  /**
   * Un potard de la face du MM-RYTM tourne de d crans pendant le mode (2026-10-27, desktop : l'ecran ne se touche
   * pas) : sur la liste, il deplace le curseur (le potard A d'abord, l'ecran le dit, mais tous) ; sur le nom, A tourne la
   * lettre et B deplace le curseur (le repli materiel, facon Elektron), les autres ne font rien. true si le potard a servi.
   */
  turn(m: PresetMachine, k: number, d: number): boolean {
    if (state.machine !== m || d === 0) return false;
    touch();
    // Sur la liste, tout potard la fait defiler (aucun ne reste mort sous la main) ; le nom : A et B seulement
    if (state.stage === 'browse') {
      presetMode.step(m, d);
      return true;
    }
    if (state.stage === 'name' && state.naming && (k === 0 || k === 1)) {
      const draft = k === 0 ? turnChar(state.naming.draft, d) : moveCursor(state.naming.draft, d);
      commit({ ...state, naming: { ...state.naming, draft, problem: '' } });
      return true;
    }
    return false;
  },
  /** Le dialogue (ui/PresetNameDialog.tsx) : ce qu'on tape, aux regles (majuscules, 4 et 10 au plus). */
  setName(m: PresetMachine, user: string, name: string, cursor?: number): void {
    if (state.machine !== m || state.stage !== 'name' || !state.naming) return;
    touch();
    // Deux espaces de suite fondus a la frappe (2026-10-27, la revue : le champ, son compte et le nom garde concordent)
    const u = typeChars(user, USER_LEN).replace(/ {2,}/g, ' ');
    const n = typeChars(name, NAME_MAX).replace(/ {2,}/g, ' ');
    const c = cursor === undefined ? state.naming.draft.cursor : Math.max(0, Math.min(USER_LEN + NAME_MAX - 1, cursor));
    if (u === state.naming.draft.user && n === state.naming.draft.name && c === state.naming.draft.cursor) return;
    commit({ ...state, naming: { ...state.naming, draft: { user: u, name: n, cursor: c }, problem: '' } });
  },
  /** OK du nom (la touche, Entree) : garde ou renomme ; aux regles seulement (sinon l'ecran et le dialogue disent quoi). */
  nameOk(m: PresetMachine): void {
    if (state.machine !== m || state.stage !== 'name' || !state.naming) return;
    const nm = state.naming;
    const r = draftResult(nm.draft);
    if (r.problem || !nameOk(r.name)) {
      commit({ ...state, naming: { ...nm, problem: r.problem || 'NAME: 1 TO 10 CHARACTERS' } });
      return;
    }
    // Jamais deux presets au meme USER/NAME sur une machine (2026-10-27, la revue : deux MIKA/TWO, sans un mot) ; un preset
    // d'avant les noms est sous l'utilisateur du navigateur, ou sous celui-ci s'il est le premier choisi (presets.setUser)
    const who = presets.user() ?? r.user;
    if (presets.of(m).some((p) => p.id !== nm.id && p.name === r.name && (userOk(p.user) ? p.user : who) === r.user)) {
      commit({ ...state, naming: { ...nm, problem: NAME_TAKEN } });
      return;
    }
    // L'utilisateur est retenu par ce navigateur : celui d'un nouveau preset, ou le premier jamais choisi
    if (nm.kind === 'new' || !presets.user()) presets.setUser(r.user);
    if (nm.kind === 'rename' && nm.id) {
      const res = presets.rename(m, nm.id, { user: r.user, name: r.name });
      commit(browse({ index: indexOf(m, nm.id) ?? state.index }));
      note(res === 'ok' ? 'RENAMED' : FAIL_NOTE[res], res === 'ok' ? NOTE_MS : FAIL_MS);
      return;
    }
    const res = presets.save(m, { user: r.user, name: r.name });
    if (!res.preset) {
      commit(browse());
      note(MAX_NOTE, FAIL_MS);
      return;
    }
    last[m] = res.preset.id;
    commit(browse({ index: indexOf(m, res.preset.id) ?? 0 }));
    if (res.kept) note('SAVED');
    else note(FAIL_NOTE[res.why], FAIL_MS);
  },
  /** Ce que dit la touche k aux lecteurs d'ecran, a l'etape du moment ('' : la place est vide). */
  aria(m: PresetMachine, k: PresetKey): string {
    if (k === 'open' || k === 'prev' || k === 'next') return PRESET_KEY_ARIA[k];
    if (k === 'close') return 'Close the presets';
    if (state.machine !== m) return '';
    return slotsOf(m)[k]?.aria ?? '';
  },
  /** Ce que l'ecran montre (null : le mode est ferme pour cette machine). */
  view(m: PresetMachine): PresetView | null {
    if (state.machine !== m) return null;
    const list = presets.list(m);
    const i = clampIndex(m, state.index);
    const r = rowAt(m, i);
    const slots = slotsOf(m);
    const keys = PRESET_SLOTS.map((k) => slots[k]?.label ?? '') as unknown as PresetView['keys'];
    const aria = PRESET_SLOTS.map((k) => slots[k]?.aria ?? '') as unknown as PresetView['aria'];
    const loaded = presets.loaded(m);
    const isCur = !!loaded && rowId(r) === loaded.id;
    const mark: PresetView['mark'] = isCur ? (loaded.edited ? 'edited' : 'loaded') : '';
    const { lo, hi } = bounds(m);
    const prev = state.stage === 'browse' && i - 1 >= lo ? rowLabel(rowAt(m, i - 1)) : '';
    const next = state.stage === 'browse' && i + 1 <= hi ? rowLabel(rowAt(m, i + 1)) : '';
    const line = m === 'bass' ? (r.kind === 'draft' ? bassLine({ id: r.draft.id, name: '', at: r.draft.at, data: r.draft.data }) : r.kind === 'none' ? null : bassLine(r.preset)) : null;
    const base = { stage: state.stage, keys, aria, prev, next, mark, kind: r.kind, naming: null, ...(line && state.stage !== 'name' ? { line } : {}) } as const;
    if (state.stage === 'name' && state.naming) {
      const nm = state.naming;
      const ln = draftLine(nm.draft);
      return {
        ...base,
        title: state.note || (nm.problem ? nm.problem : nm.kind === 'rename' ? 'RENAME' : 'SAVE AS'),
        count: '',
        group: '',
        // Les cases vides de l'utilisateur soulignees (____/DEEP KICK), comme l'ecran du MM-RYTM les dessine
        name: `${ln.text.slice(0, USER_LEN).replace(/ /g, '_')}${ln.text.slice(USER_LEN)}`.trimEnd(),
        empty: false,
        naming: { text: ln.text, at: ln.at, problem: nm.problem, kind: nm.kind },
      };
    }
    const label = rowLabel(r);
    const starred = mark === 'edited' ? `${label}*` : label;
    const long = state.note.length > LONG_NOTE;
    if (state.stage === 'choice') {
      return { ...base, title: state.note || 'SAVE', count: '', group: '', name: starred, empty: false };
    }
    if (state.stage === 'confirm') {
      return { ...base, title: state.note || 'DELETE?', count: '', group: '', name: label, empty: false };
    }
    // Un son mis de cote : NOT SAVED, YOUR SOUND (YOUR SOUND 2...), son heure a la place du rang
    if (r.kind === 'draft') {
      return { ...base, title: state.note || 'NOT SAVED', count: long ? '' : hhmm(r.draft.at), group: '', name: label, empty: false };
    }
    const empty = list.length === 0;
    const fac = r.kind === 'factory';
    const group = fac && m === 'bass' && r.kind === 'factory' ? bassGroup(r.preset) : '';
    // Un preset que le navigateur n'a pas pris (plein ou refuse) : il partira au rechargement, le titre le dit
    const visit = r.kind === 'user' && presets.unsaved(r.preset.id);
    const title = state.note || (visit ? 'NOT SAVED' : mark === 'edited' ? 'EDITED' : mark === 'loaded' ? 'LOADED' : fac ? 'FACTORY' : 'PRESETS');
    return {
      ...base,
      title,
      count: empty || long ? '' : `${i + 1}/${list.length}`,
      group,
      name: empty ? 'NOTHING SAVED YET' : starred,
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
