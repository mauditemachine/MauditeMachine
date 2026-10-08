/**
 * La liste des morceaux, dans l'ecran de chaque platine (2026-10-04, Mika :
 * "je veux un plus grand ecran et voir la playlist a l'interieur de chaque
 * deck ; pas besoin d'assigner a A ou B, on a directement les tracks a
 * l'interieur des decks et on les load sur le deck qu'on veut, comme un
 * CDJ"). Plus de liste commune en bas ni de touches A et B : chaque
 * platine a son navigateur, pose exactement sur son ecran 3D (une page
 * HTML deformee par une homographie, matrix3d, recalculee a chaque vue).
 * Choisir un morceau le pose sur cette platine et l'ecran revient au
 * morceau ; toucher l'ecran le rouvre (dj/browser.ts) ; une platine vide
 * montre sa liste.
 *
 * Les sources, comme avant :
 * - MAUDITE : les morceaux du compte SoundCloud de Mika, que tout le monde
 *   peut mixer (il y consent) ; ouverte par defaut.
 * - SOUNDCLOUD : par le Worker de Sonaa, seulement les licences Creative
 *   Commons qui autorisent le remix ; chaque titre renvoie a sa page.
 * - MY SC : on se connecte avec SoundCloud (pas de compte sur le site) et
 *   on mixe ses propres morceaux publics.
 * - FILES : la caisse (dj/crate.ts), les fichiers de l'appareil gardes
 *   d'une visite a l'autre, ranges par dossier ; rien n'est envoye. Un gros
 *   import demande : copier dans le navigateur, ou relier pour la visite.
 *   Un morceau d'une visite passee (2026-10-04, Mika : "quand je clique sur
 *   une track d'un dossier que j'avais rajoute avant, ca ne fait rien") se
 *   touche : on choisit son dossier de nouveau, il part sur la platine, et
 *   le dossier est garde sur l'appareil (relie sur Chrome et Edge, copie
 *   ailleurs s'il y a la place) : on ne le redemande plus.
 * Le nom DjBrowser et ses props ne changent pas (index.tsx, state/djload.ts).
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { gesture } from '../actions';
import type { Stage } from '../scene/renderer';
import { focus } from '../state/focus';
import { intro } from '../state/intro';
import { djLoad, djPosition } from './actions';
import { djBrowser } from './browser';
import {
  addFiles,
  addToList,
  analyzeAll,
  canLink,
  crateEvents,
  crateLists,
  crateRoots,
  crateTracks,
  createList,
  deleteList,
  crateFile,
  fingerprint,
  folderOfPath,
  isSound,
  linkFolder,
  listEvents,
  moveInList,
  pickAndLink,
  readDrop,
  reconnectRoot,
  removeFolder,
  removeFromList,
  renameList,
  rescanRoots,
  storageLeft,
  type DjList,
  type ImportMode,
  type PlacedFile,
} from './crate';
import { DJ_KEY_LEGEND, listenDjKeys } from './keys';
import { DeckSampler } from './SamplerScreen';
import { samplerOf } from '../sampler/sampler';
import { LICENSE_LABEL, connectSoundcloud, disconnectSoundcloud, mauditeTracks, myTracks, scAccount, searchSoundcloud } from './soundcloud';
import { djState, type DjTrack } from './state';
import { DECK, DJ_BEZEL, DJ_DECKS, UNIT_X, djDecks, type DjDeck } from './theme';
import './dj.css';

const ROWS = 200;
/** Le second appui qui pose un morceau sur une platine qui joue (TrackBrowser load) */
const SURE_LOAD_MS = 3000;

/** La caisse, relue a chaque changement ; null tant qu'elle n'est pas lue. */
function useCrate(on: boolean): DjTrack[] | null {
  const [tracks, setTracks] = useState<DjTrack[] | null>(null);
  const v = useSyncExternalStore(crateEvents.subscribe, crateEvents.version, crateEvents.version);
  useEffect(() => {
    if (!on) return undefined;
    let live = true;
    void crateTracks().then((t) => {
      if (live) setTracks(t);
    });
    return () => {
      live = false;
    };
  }, [on, v]);
  return tracks;
}

/** Les playlists, relues a chaque changement. */
function useLists(): DjList[] {
  const [lists, setLists] = useState<DjList[]>([]);
  const v = useSyncExternalStore(listEvents.subscribe, listEvents.version, listEvents.version);
  useEffect(() => {
    let live = true;
    void crateLists().then((l) => {
      if (live) setLists(l);
    });
    return () => {
      live = false;
    };
  }, [v]);
  return lists;
}

/**
 * Les dossiers sous un chemin (FILES, Mika : "faut vraiment faire
 * fonctionner les dossiers") : les sous-dossiers directs, chacun avec le
 * nombre de morceaux qu'il contient, sous-dossiers compris.
 */
function childFolders(tracks: readonly DjTrack[], path: string): { name: string; path: string; n: number }[] {
  const prefix = path ? `${path}/` : '';
  const out = new Map<string, number>();
  for (const t of tracks) {
    const f = t.folder ?? '';
    if (!f || (path && !f.startsWith(prefix))) continue;
    const rest = f.slice(prefix.length);
    if (!rest) continue;
    const name = rest.split('/')[0];
    out.set(name, (out.get(name) ?? 0) + 1);
  }
  return [...out.entries()].sort((a, b) => a[0].localeCompare(b[0])).map(([name, n]) => ({ name, path: prefix + name, n }));
}

type Tab = 'maudite' | 'soundcloud' | 'mysc' | 'files' | 'lists';
const TABS: readonly Tab[] = ['maudite', 'soundcloud', 'mysc', 'files', 'lists'];
const TAB_LABEL: Readonly<Record<Tab, string>> = { maudite: 'MAUDITE', soundcloud: 'SOUNDCLOUD', mysc: 'MY SC', files: 'FILES', lists: 'PLAYLISTS' };
const PLACEHOLDER: Readonly<Record<Tab, string>> = {
  maudite: 'Search Maudite Machine',
  soundcloud: 'Search SoundCloud (CC)',
  mysc: 'Search my SoundCloud',
  files: 'Search all my files',
  lists: 'Search this playlist',
};
/** La playlist ouverte, retenue. */
const LIST_KEY = 'mm.v4.dj.list';
/** Le dossier ouvert dans FILES, retenu. */
const PATH_KEY = 'mm.v4.dj.path';
const readKey = (k: string): string => {
  try {
    return window.localStorage.getItem(k) ?? '';
  } catch {
    return '';
  }
};
const saveKey = (k: string, v: string): void => {
  try {
    window.localStorage.setItem(k, v);
  } catch {
    /* rien a retenir */
  }
};

/** L'onglet retenu (FILES pour qui a sa caisse). */
const TAB_KEY = 'mm.v4.dj.tab';
const readTab = (): Tab => {
  try {
    const t = window.localStorage.getItem(TAB_KEY);
    return t === 'files' || t === 'soundcloud' || t === 'mysc' || t === 'lists' ? t : 'maudite';
  } catch {
    return 'maudite';
  }
};
const saveTab = (t: Tab): void => {
  try {
    window.localStorage.setItem(TAB_KEY, t);
  } catch {
    /* rien a retenir */
  }
};

/** Un import en attente de choix : ses fichiers, leur poids, le dossier propose, la place restante. */
interface Plan {
  files: PlacedFile[];
  bytes: number;
  folder: string;
  left: number | null;
}

const human = (b: number): string => (b >= 1e9 ? `${(b / 1e9).toFixed(1)} GB` : `${Math.max(1, Math.round(b / 1e6))} MB`);
/** Au-dela, on demande avant de copier. */
const ASK = { files: 1, bytes: 300 * 1e6 } as const;

/** Les morceaux de Maudite Machine, lus une fois par visite. */
let mauditeCache: DjTrack[] | null = null;
/** Les morceaux du compte connecte, lus une fois par visite et par seance. */
let myCache: { s: string; tracks: DjTrack[] } | null = null;
/** La reponse du Worker sur SoundCloud, une fois par visite. */
let scProbe: Promise<boolean> | null = null;
let scProbeOff = false;

/* ---------------- la pose sur l'ecran 3D ---------------- */

/**
 * L'homographie du rectangle (0, 0)-(w, h) vers le quadrilatere projete
 * (haut gauche, haut droite, bas droite, bas gauche), en matrix3d CSS
 * (colonnes) : la page se pose exactement sur l'ecran, en perspective.
 */
function matrix3d(q: readonly number[], w: number, h: number): string | null {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-9) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const hh = (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + hh * x3;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + hh * y3;
  const m = [a / w, d / w, 0, g / w, b / h, e / h, 0, hh / h, 0, 0, 1, 0, x0, y0, 0, 1];
  return `matrix3d(${m.map((v) => +v.toFixed(8)).join(',')})`;
}

/* ---------------- le navigateur d'une platine ---------------- */

interface DeckProps {
  deck: DjDeck;
  /** l'element pose sur l'ecran, pour son placement */
  setRoot: (d: DjDeck, el: HTMLDivElement | null) => void;
}

/** Petites icones (le code reste en ASCII) : monter, descendre, retirer, ajouter a une playlist. */
const Icon: React.FC<{ d: string }> = ({ d }) => (
  <svg viewBox="0 0 12 12" width="1em" height="1em" aria-hidden="true">
    <path d={d} fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);
const UP = 'M2.5 7.5 L6 4 L9.5 7.5';
const DOWN = 'M2.5 4.5 L6 8 L9.5 4.5';
const MINUS = 'M2.5 6 H9.5';
const PLUS = 'M2.5 6 H9.5 M6 2.5 V9.5';
const FOLDER_ICON = 'M1.5 3 H4.5 L5.5 4 H10.5 V9.5 H1.5 Z';
/** le retour au morceau (une fleche qui revient) : l'ecran de la platine dit "< TRACKS" pour l'aller, la liste ne reprend pas le meme chevron */
const RETURN_ICON = 'M4.5 2 L2 4.5 L4.5 7 M2 4.5 H7.5 A2.5 2.5 0 0 1 7.5 9.5 H5';

const clockOf = (s: number): string => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

/**
 * Le morceau de la platine, pendant qu'on choisit le suivant (2026-10-08,
 * BACK) : il continue de jouer, la ligne le dit (en jaune quand il joue),
 * avec son tempo et son temps restant ; le toucher ramene au morceau. Elle
 * est le retour (relecture du 2026-10-08) : la lettre de la platine et la
 * fleche qui revient, sur la premiere ligne ; la touche "< A" et DONE, qui
 * faisaient la meme chose, laissent la ligne du dessous aux sources.
 */
const NowPlaying: React.FC<{ deck: DjDeck; compact?: boolean }> = ({ deck, compact = false }) => {
  const dj = useSyncExternalStore(djState.subscribe, djState.get, djState.get);
  const ds = dj.deck[deck];
  const [, tick] = useState(0);
  useEffect(() => {
    if (!ds.playing) return undefined;
    const id = window.setInterval(() => tick((n) => n + 1), 500);
    return () => window.clearInterval(id);
  }, [ds.playing]);
  const t = ds.track;
  if (!t) return null;
  const bpm = t.bpm ? (t.bpm * (1 + (ds.pitch * ds.range) / 100)).toFixed(2) : '--.--';
  const state = ds.loading !== null ? 'LOADING' : ds.playing ? 'PLAYING' : 'PAUSED';
  const left = ds.loaded ? `-${clockOf((t.duration || 0) - djPosition(deck))}` : '';
  const label = `Back to deck ${deck.toUpperCase()}, ${state.toLowerCase()}: ${t.title}`;
  // Au doigt (relecture du 2026-10-08) : la touche compacte tient sur la ligne des sources, 44 px de haut, la liste garde sa place
  if (compact)
    return (
      <button type="button" className="dj-scr-now dj-scr-now-compact" data-state={state.toLowerCase()} onClick={() => djBrowser.close(deck)} aria-label={label}>
        <span className="dj-scr-now-back" aria-hidden="true">
          <Icon d={RETURN_ICON} />
          <span className="dj-scr-now-deck">{deck.toUpperCase()}</span>
        </span>
        <span className="dj-scr-now-dot" aria-hidden="true" />
        {left ? <span className="dj-scr-now-meta">{left}</span> : null}
      </button>
    );
  return (
    <button type="button" className="dj-scr-now dj-scr-now-full" data-state={state.toLowerCase()} onClick={() => djBrowser.close(deck)} aria-label={label} title="Back to the deck">
      <span className="dj-scr-now-back" aria-hidden="true">
        <Icon d={RETURN_ICON} />
        <span className="dj-scr-now-deck">{deck.toUpperCase()}</span>
      </span>
      <span className="dj-scr-now-dot" aria-hidden="true" />
      <span className="dj-scr-now-state">{state}</span>
      <span className="dj-scr-now-title">
        {t.title}
        {t.artist ? <span className="dj-scr-now-artist">{t.artist}</span> : null}
      </span>
      <span className="dj-scr-now-meta">
        <span>{bpm}</span>
        {left ? <span>{left}</span> : null}
      </span>
    </button>
  );
};

const DeckBrowser: React.FC<DeckProps> = ({ deck, setRoot }) => {
  const dj = useSyncExternalStore(djState.subscribe, djState.get, djState.get);
  const sc = useSyncExternalStore(scAccount.subscribe, scAccount.get, scAccount.get);
  const me = sc.account;
  const [tab, setTabState] = useState<Tab>(readTab);
  const setTab = (t: Tab): void => {
    setTabState(t);
    saveTab(t);
    setAdding(null);
    setLoadSure(null);
  };
  const mine = useCrate(true) ?? [];
  const lists = useLists();
  const [path, setPathState] = useState<string>(() => readKey(PATH_KEY));
  const [listId, setListIdState] = useState<string>(() => readKey(LIST_KEY));
  const [plan, setPlan] = useState<Plan | null>(null);
  const [work, setWork] = useState<string | null>(null);
  const [note, setNote] = useState<string | null>(null);
  const [sure, setSure] = useState<string | null>(null);
  const [legend, setLegend] = useState(false);
  const [drop, setDrop] = useState(false);
  const [query, setQuery] = useState('');
  const [list, setList] = useState<DjTrack[] | null>(null);
  const [scDown, setScDown] = useState<'off' | 'down' | null>(null);
  const [scOff, setScOff] = useState(scProbeOff);
  /** le morceau qu'on range dans une playlist (le choix s'ouvre sur l'ecran) */
  const [adding, setAdding] = useState<DjTrack | null>(null);
  /** le nom d'une playlist en cours d'ecriture (nouvelle, ou renommee) */
  const [naming, setNaming] = useState<{ id: string | null; name: string } | null>(null);
  const [roots, setRoots] = useState<{ name: string; granted: boolean }[]>([]);
  const pick = useRef<HTMLInputElement>(null);
  /*
   * Le clic fantome du telephone (2026-10-08) : la liste s'ouvre sous le
   * doigt (BACK, ou l'ecran touche), et le clic que le navigateur envoie
   * apres le toucher tombait sur ce qui vient d'apparaitre au meme endroit
   * (le retour au morceau, une source, un morceau). Pendant 500 ms, seul un
   * clic commence dans la liste compte.
   */
  const openedAt = useRef(performance.now());
  const downInside = useRef(false);
  /*
   * Les sources debordent (relecture du 2026-10-08 : FILES et PLAYLISTS
   * restaient hors champ, sans indice) : un fondu au bord ou il en reste,
   * et la molette les fait defiler.
   */
  const tabsRef = useRef<HTMLDivElement>(null);
  const [tabsMore, setTabsMore] = useState<string | undefined>(undefined);
  const measureTabs = (): void => {
    const el = tabsRef.current;
    if (!el) return;
    const left = el.scrollLeft > 2;
    const right = el.scrollLeft + el.clientWidth < el.scrollWidth - 2;
    const next = left && right ? 'both' : left ? 'left' : right ? 'right' : undefined;
    setTabsMore((m) => (m === next ? m : next));
  };
  useEffect(() => {
    const el = tabsRef.current;
    if (!el || typeof ResizeObserver === 'undefined') return undefined;
    const ro = new ResizeObserver(measureTabs);
    ro.observe(el);
    measureTabs();
    return () => ro.disconnect();
  });
  /*
   * Une platine qui joue ne se coupe pas d'un toucher de travers
   * (relecture du 2026-10-08 : BACK ouvre la liste en pleine lecture, et
   * choisir un morceau arrete la platine tout de suite) : le premier appui
   * sur un morceau arme le chargement (la ligne le dit), le second, dans
   * SURE_LOAD_MS, le pose. Comme REMOVE DECK.
   */
  const [loadSure, setLoadSure] = useState<string | null>(null);
  const sureTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(sureTimer.current), []);
  const pickDir = useRef<HTMLInputElement>(null);
  const setPath = (p: string): void => {
    setPathState(p);
    saveKey(PATH_KEY, p);
    setSure(null);
  };
  const setListId = (id: string): void => {
    setListIdState(id);
    saveKey(LIST_KEY, id);
    setSure(null);
  };
  const flash = (t: string): void => {
    setNote(t);
    window.setTimeout(() => setNote((n) => (n === t ? null : n)), 1800);
  };

  // Les analyses de la caisse reprennent ; les dossiers relies se relisent (une fois par visite) ; leur acces
  useEffect(() => {
    void analyzeAll();
    let live = true;
    const refresh = (): void => {
      void crateRoots().then((r) => {
        if (live) setRoots(r);
      });
    };
    refresh();
    void rescanRoots((d, n) => {
      if (live) setWork(`UPDATING FOLDERS ${d} / ${n}`);
    }).finally(() => {
      if (live) setWork(null);
      refresh();
    });
    return () => {
      live = false;
    };
  }, []);

  // SoundCloud branche ? Une recherche vide le dit (gardee au Worker) ; sinon ses onglets s'effacent
  useEffect(() => {
    scProbe ??= searchSoundcloud('', new AbortController().signal).then((r) => {
      scProbeOff = !r.ok && r.reason === 'off';
      return scProbeOff;
    });
    let live = true;
    void scProbe.then((off) => {
      if (!live || !off) return;
      setScOff(true);
      setTabState((t) => (t === 'files' || t === 'lists' ? t : 'files'));
    });
    return () => {
      live = false;
    };
  }, []);

  // SOUNDCLOUD cherche chez SoundCloud (300 ms apres la frappe) ; MAUDITE et MY SC se lisent une fois
  useEffect(() => {
    if (tab === 'files' || tab === 'lists') return undefined;
    if (tab === 'mysc' && !me) {
      setList([]);
      return undefined;
    }
    const ctl = new AbortController();
    const q = query.trim();
    const t = window.setTimeout(
      () => {
        setScDown(null);
        if (tab === 'maudite' && mauditeCache) {
          setList(mauditeCache);
          return;
        }
        if (tab === 'mysc' && me && myCache?.s === me.s) {
          setList(myCache.tracks);
          return;
        }
        setList(null);
        (tab === 'maudite' ? mauditeTracks(ctl.signal) : tab === 'mysc' ? myTracks(ctl.signal) : searchSoundcloud(q, ctl.signal))
          .then((r) => {
            if (r.ok) {
              if (tab === 'maudite') mauditeCache = r.tracks;
              if (tab === 'mysc' && me) myCache = { s: me.s, tracks: r.tracks };
              setList(r.tracks);
            } else if (r.reason === 'out') setList([]);
            else if (r.reason === 'off') {
              setScOff(true);
              setTab('files');
            } else {
              setScDown(r.reason);
              setList([]);
            }
          })
          .catch(() => {
            if (!ctl.signal.aborted) setList([]);
          });
      },
      q && tab === 'soundcloud' ? 300 : 0
    );
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [tab, tab === 'soundcloud' ? query : '', me]);

  /* ----- FILES : le dossier ouvert, ses sous-dossiers ----- */
  const folderPaths = useMemo(() => new Set(mine.map((t) => t.folder ?? '')), [mine]);
  // Un dossier retenu qui n'existe plus : on remonte en haut
  const here = path && ![...folderPaths].some((f) => f === path || f.startsWith(`${path}/`)) ? '' : path;
  const subfolders = useMemo(() => childFolders(mine, here), [mine, here]);
  const crumbs = here ? here.split('/') : [];

  /* ----- PLAYLISTS : la playlist ouverte, ses morceaux relus dans la caisse ----- */
  const current = lists.find((l) => l.id === listId) ?? lists[0] ?? null;
  const byId = useMemo(() => new Map(mine.map((t) => [t.id, t])), [mine]);
  const listItems = useMemo((): DjTrack[] => {
    if (!current) return [];
    // Un fichier : son etat d'aujourd'hui dans la caisse (relie, illisible, ou parti)
    return current.items.map((t) => (t.source === 'file' ? (byId.get(t.id) ?? { ...t, unreadable: true, artist: 'No longer in FILES' }) : t));
  }, [current, byId]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    const match = (t: DjTrack): boolean => `${t.title} ${t.artist} ${t.folder ?? ''}`.toLowerCase().includes(q);
    let src: DjTrack[];
    if (tab === 'files') src = q ? mine.filter(match) : mine.filter((t) => (t.folder ?? '') === here);
    else if (tab === 'lists') src = q ? listItems.filter(match) : listItems;
    else src = tab !== 'soundcloud' && q ? (list ?? []).filter(match) : (list ?? []);
    return src.slice(0, ROWS);
  }, [tab, list, mine, query, here, listItems]);

  /** Un morceau choisi : il part sur cette platine, l'ecran revient au morceau. sure : sans demander, meme si la platine joue. */
  const load = (t: DjTrack, sure = false): void => {
    gesture();
    if (!sure && djState.get().deck[deck].playing && loadSure !== t.id) {
      setLoadSure(t.id);
      window.clearTimeout(sureTimer.current);
      sureTimer.current = window.setTimeout(() => setLoadSure(null), SURE_LOAD_MS);
      return;
    }
    window.clearTimeout(sureTimer.current);
    setLoadSure(null);
    void djLoad(deck, t);
    djBrowser.close(deck);
  };

  const progress = (done: number, total: number): void => setWork(`ADDING ${done} / ${total}`);

  /** Le morceau d'une visite passee qu'on a touche : il part des que son dossier revient. */
  const waitingFor = useRef<DjTrack | null>(null);

  /** Un morceau d'une visite passee : on choisit son dossier de nouveau (relie sur Chrome et Edge, sinon le selecteur de dossiers). */
  const findFolder = (t: DjTrack): void => {
    gesture();
    waitingFor.current = t;
    if (!canLink()) {
      setWork(`PICK THE FOLDER ${(t.folder || 'OF THIS TRACK').split('/')[0].toUpperCase()}`);
      pickDir.current?.click();
      return;
    }
    void pickAndLink(progress)
      .then(async (r) => {
        const p = waitingFor.current;
        waitingFor.current = null;
        if (!r || !p) return;
        if (await crateFile(p.id).catch(() => null)) load({ ...p, relink: undefined }, true);
        else flash('THIS TRACK IS NOT IN THAT FOLDER');
      })
      .finally(() => {
        setWork(null);
        void crateRoots().then(setRoots);
      });
  };

  /** Range des fichiers : un seul petit fichier entre tout de suite (copie) ; sinon on demande. */
  const offer = async (files: PlacedFile[]): Promise<void> => {
    const sounds = files.filter((x) => isSound(x.file));
    if (sounds.length === 0) return;
    setTab('files');
    const bytes = sounds.reduce((n, x) => n + x.file.size, 0);
    // Le dossier d'un morceau touche revient : le morceau part tout de suite, puis le dossier se
    // garde sur l'appareil s'il y a la place (sinon pour la visite), sans rien demander de plus
    const p = waitingFor.current;
    if (p) {
      waitingFor.current = null;
      const hit = sounds.find((x) => fingerprint(x.file) === p.id);
      if (hit) load({ ...p, file: hit.file, relink: undefined }, true);
      else flash('THIS TRACK IS NOT IN THAT FOLDER');
      const left = await storageLeft();
      await run(sounds, left === null || left > bytes * 1.1 ? 'copy' : 'visit');
      return;
    }
    const named = sounds.find((x) => x.folder)?.folder ?? here;
    if (sounds.length <= ASK.files && bytes < ASK.bytes) {
      await run(sounds.map((x) => ({ ...x, folder: x.folder || named })), 'copy');
      return;
    }
    setPlan({ files: sounds, bytes, folder: named, left: await storageLeft() });
  };

  const run = async (files: PlacedFile[], mode: ImportMode): Promise<void> => {
    setPlan(null);
    try {
      const n = await addFiles(files, mode, progress);
      // Le dossier du haut de ce qui vient d'entrer s'ouvre
      const top = (files[0]?.folder ?? '').split('/')[0];
      if (n > 0) setPath(files.every((x) => x.folder.split('/')[0] === top) ? top : '');
    } finally {
      setWork(null);
    }
  };

  const confirm = (mode: ImportMode): void => {
    if (!plan) return;
    // Le nom choisi remplace le dossier du haut ; les sous-dossiers suivent
    const base = plan.folder.trim();
    const top = plan.files.find((x) => x.folder)?.folder.split('/')[0] ?? '';
    void run(
      plan.files.map((x) => ({ ...x, folder: top && x.folder.startsWith(top) ? base + x.folder.slice(top.length) : base || x.folder })),
      mode
    );
  };

  const onFiles = (fl: FileList | null): void => {
    if (!fl) return;
    void offer(Array.from(fl).map((file) => ({ file, folder: folderOfPath(file) })));
  };

  /** + FOLDER : relie sur Chrome et Edge (une fois pour toutes), le selecteur de dossiers ailleurs. */
  const addFolder = (): void => {
    if (!canLink()) {
      pickDir.current?.click();
      return;
    }
    void pickAndLink(progress)
      .then((r) => {
        if (r) {
          setTab('files');
          setPath(r.name);
        }
      })
      .finally(() => {
        setWork(null);
        void crateRoots().then(setRoots);
      });
  };

  /** Un dossier relie dont l'acces s'est perdu : un clic le redonne (et il se relit). */
  const reconnect = (name: string): void => {
    void reconnectRoot(name, (d, n) => setWork(`UPDATING ${d} / ${n}`))
      .then((ok) => {
        if (!ok) flash('ACCESS REFUSED');
      })
      .finally(() => {
        setWork(null);
        void crateRoots().then(setRoots);
      });
  };

  const onDrop = (items: DataTransferItemList): void => {
    const { dirs, files } = readDrop(items, here);
    void (async () => {
      const ds = await dirs;
      for (const d of ds) {
        const r = await linkFolder(d, progress);
        setTab('files');
        setPath(r.name);
      }
      // Le dossier d'un morceau touche, lache et relie (Chrome) : le morceau part
      const p = waitingFor.current;
      if (ds.length > 0 && p && (await crateFile(p.id).catch(() => null))) {
        waitingFor.current = null;
        load({ ...p, relink: undefined }, true);
      }
      setWork(null);
      void crateRoots().then(setRoots);
      await offer(await files);
    })();
  };

  /** Une action qui demande confirmation : le premier clic arme, le second agit. */
  const twice = (key: string, act: () => void): void => {
    if (sure !== key) {
      setSure(key);
      return;
    }
    setSure(null);
    act();
  };

  /** Ranger un morceau dans une playlist (la premiere se cree au besoin). */
  const putIn = (l: DjList | null, t: DjTrack): void => {
    setAdding(null);
    void (async () => {
      const target = l ?? (await createList(`Playlist ${lists.length + 1}`));
      await addToList(target.id, t);
      flash(`ADDED TO ${target.name.toUpperCase()}`);
    })();
  };

  const saveName = (): void => {
    if (!naming) return;
    const name = naming.name.trim();
    setNaming(null);
    if (!name) return;
    if (naming.id) void renameList(naming.id, name);
    else
      void createList(name).then((l) => {
        setTab('lists');
        setListId(l.id);
      });
  };

  const loadedId = dj.deck[deck].track?.id ?? null;
  /** la platine tient un morceau : BACK ramene a lui, la ligne du dessous le montre */
  const held = dj.deck[deck].track !== null;
  /** MY SC sans connexion : le bouton prend la place de la liste */
  const gate = tab === 'mysc' && !me;
  const locked = roots.filter((r) => !r.granted);
  const inList = tab === 'lists' && current !== null;

  return (
    <div
      ref={(el) => setRoot(deck, el)}
      className="dj-scr"
      data-drop={drop ? '1' : '0'}
      role="region"
      aria-label={`Deck ${deck.toUpperCase()} track browser`}
      onPointerDownCapture={() => {
        downInside.current = true;
      }}
      onClickCapture={(e) => {
        if (downInside.current || performance.now() - openedAt.current > 500) return;
        e.preventDefault();
        e.stopPropagation();
      }}
      onDragOver={(e) => {
        e.preventDefault();
        setDrop(true);
      }}
      onDragLeave={() => setDrop(false)}
      onDrop={(e) => {
        e.preventDefault();
        setDrop(false);
        onDrop(e.dataTransfer.items);
      }}
    >
      {/* BACK (2026-10-08) : la platine tient un morceau, sa ligne vient en premier et ramene a lui */}
      {held && <NowPlaying deck={deck} />}
      <div className="dj-scr-head" data-held={held ? '1' : undefined}>
        {held ? <NowPlaying deck={deck} compact /> : <span className="dj-scr-deck">{deck.toUpperCase()}</span>}
        <div
          ref={tabsRef}
          className="dj-scr-tabs"
          role="tablist"
          data-more={tabsMore}
          onScroll={measureTabs}
          onWheel={(e) => {
            // La molette fait defiler les sources (sans Maj)
            const el = e.currentTarget;
            if (el.scrollWidth <= el.clientWidth || Math.abs(e.deltaX) > Math.abs(e.deltaY)) return;
            el.scrollLeft += e.deltaY;
          }}
        >
          {TABS.filter((t) => t === 'files' || t === 'lists' || !scOff).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className="dj-scr-tab" onClick={() => setTab(t)}>
              {t === 'files' && mine.length ? `${TAB_LABEL.files} ${mine.length}` : t === 'lists' && lists.length ? `${TAB_LABEL.lists} ${lists.length}` : TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <button type="button" className="dj-scr-keys" aria-pressed={legend} onClick={() => setLegend(!legend)}>
          KEYS
        </button>
        {!held && (
          <button type="button" className="dj-scr-done" onClick={() => djBrowser.close(deck)}>
            DONE
          </button>
        )}
      </div>
      <div className="dj-scr-tools">
        {naming ? (
          <>
            <input
              className="dj-scr-search"
              type="text"
              autoFocus
              placeholder="Playlist name"
              aria-label="Playlist name"
              value={naming.name}
              onChange={(e) => setNaming({ ...naming, name: e.target.value })}
              onKeyDown={(e) => {
                if (e.key === 'Enter') saveName();
                if (e.key === 'Escape') {
                  e.stopPropagation();
                  setNaming(null);
                }
              }}
            />
            <button type="button" className="dj-scr-add" onClick={saveName}>
              SAVE
            </button>
            <button type="button" className="dj-scr-add dj-scr-quiet" onClick={() => setNaming(null)}>
              CANCEL
            </button>
          </>
        ) : (
          <>
            <input className="dj-scr-search" type="search" placeholder={PLACEHOLDER[tab]} aria-label="Search" value={query} onChange={(e) => setQuery(e.target.value)} />
            {tab === 'files' && (
              <>
                <button type="button" className="dj-scr-add" onClick={() => pick.current?.click()}>
                  + FILES
                </button>
                <button type="button" className="dj-scr-add" onClick={addFolder}>
                  + FOLDER
                </button>
              </>
            )}
            {tab === 'lists' && (
              <button type="button" className="dj-scr-add" onClick={() => setNaming({ id: null, name: '' })}>
                + NEW
              </button>
            )}
            {tab === 'mysc' && me && (
              <button
                type="button"
                className="dj-scr-add"
                title={me.name ? `Connected as ${me.name}` : undefined}
                onClick={() => {
                  myCache = null;
                  disconnectSoundcloud();
                }}
              >
                DISCONNECT
              </button>
            )}
          </>
        )}
        <input ref={pick} type="file" accept="audio/*" multiple hidden onChange={(e) => onFiles(e.target.files)} />
        <input
          ref={(el) => {
            pickDir.current = el;
            if (el) el.setAttribute('webkitdirectory', '');
          }}
          type="file"
          multiple
          hidden
          onChange={(e) => onFiles(e.target.files)}
        />
      </div>
      {/* FILES : un dossier relie dont l'acces s'est perdu (Chrome redemande a chaque visite, sauf "Autoriser a chaque visite") */}
      {tab === 'files' && locked.length > 0 && (
        <div className="dj-scr-locked">
          <span>
            {locked.length === 1 ? `"${locked[0].name}" needs access again.` : `${locked.length} linked folders need access again.`} Pick "Allow on every visit" and it will stay.
          </span>
          <button type="button" className="dj-scr-add" onClick={() => reconnect(locked[0].name)}>
            RECONNECT{locked.length > 1 ? ` ${locked[0].name.toUpperCase()}` : ''}
          </button>
        </div>
      )}
      {/* FILES : ou l'on est, et le chemin pour remonter */}
      {tab === 'files' && !query.trim() && (here || subfolders.length > 0) && (
        <div className="dj-scr-crumbs" role="navigation" aria-label="Folders">
          <button type="button" className="dj-scr-crumb" aria-current={here === '' ? 'true' : undefined} onClick={() => setPath('')}>
            ALL FOLDERS
          </button>
          {crumbs.map((c, i) => {
            const p = crumbs.slice(0, i + 1).join('/');
            return (
              <React.Fragment key={p}>
                <span className="dj-scr-sep" aria-hidden="true">
                  /
                </span>
                <button type="button" className="dj-scr-crumb" aria-current={p === here ? 'true' : undefined} onClick={() => setPath(p)}>
                  {c}
                </button>
              </React.Fragment>
            );
          })}
          {here && (
            <button type="button" className="dj-scr-forget" data-sure={sure === `f:${here}` ? '1' : '0'} onClick={() => twice(`f:${here}`, () => void removeFolder(here).then(() => setPath(here.split('/').slice(0, -1).join('/'))))} onBlur={() => setSure(null)}>
              {sure === `f:${here}` ? 'REMOVE? YES' : 'REMOVE'}
            </button>
          )}
        </div>
      )}
      {/* PLAYLISTS : les playlists, celle qu'on ouvre, la renommer ou la supprimer */}
      {tab === 'lists' && lists.length > 0 && (
        <div className="dj-scr-folders" role="group" aria-label="Playlists">
          {lists.map((l) => (
            <button key={l.id} type="button" className="dj-scr-folder" aria-pressed={current?.id === l.id} onClick={() => setListId(l.id)}>
              {l.name} {l.items.length}
            </button>
          ))}
          {current && (
            <>
              <button type="button" className="dj-scr-forget" onClick={() => setNaming({ id: current.id, name: current.name })}>
                RENAME
              </button>
              <button type="button" className="dj-scr-forget" data-sure={sure === `l:${current.id}` ? '1' : '0'} onClick={() => twice(`l:${current.id}`, () => void deleteList(current.id))} onBlur={() => setSure(null)}>
                {sure === `l:${current.id}` ? 'DELETE? YES' : 'DELETE'}
              </button>
            </>
          )}
        </div>
      )}
      {(work || note) && <p className="dj-scr-work">{work ?? note}</p>}
      {legend && (
        <dl className="dj-scr-legend" aria-label="Keyboard">
          {DJ_KEY_LEGEND.map((l) => (
            <div key={l.keys}>
              <dt>{l.keys}</dt>
              <dd>{l.what}</dd>
            </div>
          ))}
        </dl>
      )}
      {plan && (
        <div className="dj-scr-plan" role="dialog" aria-label="Add files">
          <p>
            {plan.files.length} tracks, {human(plan.bytes)}.{' '}
            {canLink() ? 'Tip: + FOLDER links a folder once, without copying it, and keeps it up to date.' : 'KEEP ON THIS DEVICE copies them once: they stay, nothing is uploaded.'}
          </p>
          <label className="dj-scr-plan-folder">
            <span>FOLDER</span>
            <input type="text" value={plan.folder} placeholder="No folder" onChange={(e) => setPlan({ ...plan, folder: e.target.value })} />
          </label>
          <div className="dj-scr-plan-actions">
            {(plan.left === null || plan.left > plan.bytes * 1.1) && (
              <button type="button" onClick={() => confirm('copy')}>
                KEEP ON THIS DEVICE
              </button>
            )}
            <button type="button" className="dj-scr-quiet" onClick={() => confirm('visit')}>
              THIS VISIT ONLY
            </button>
            <button type="button" className="dj-scr-plan-cancel" onClick={() => setPlan(null)}>
              CANCEL
            </button>
          </div>
          {plan.left !== null && plan.left <= plan.bytes * 1.1 && (
            <p className="dj-scr-plan-note">Not enough room to keep them: {human(Math.max(0, plan.left))} left. This visit only keeps their names, BPM and cues.</p>
          )}
        </div>
      )}
      {/* Ranger un morceau : les playlists, ou une nouvelle */}
      {adding && (
        <div className="dj-scr-plan" role="dialog" aria-label="Add to a playlist">
          <p>
            Add <b>{adding.title}</b> to:
          </p>
          <div className="dj-scr-plan-actions">
            {lists.map((l) => (
              <button key={l.id} type="button" onClick={() => putIn(l, adding)}>
                {l.name}
              </button>
            ))}
            <button type="button" onClick={() => putIn(null, adding)}>
              + NEW PLAYLIST
            </button>
            <button type="button" className="dj-scr-plan-cancel" onClick={() => setAdding(null)}>
              CANCEL
            </button>
          </div>
        </div>
      )}
      <ul className="dj-scr-rows">
        {gate && (
          <li className="dj-scr-connect">
            <p>Mix your own tracks: connect with SoundCloud. No account on this site, and nothing is kept.</p>
            <button type="button" className="dj-scr-sc" onClick={connectSoundcloud}>
              {sc.pending ? 'WAITING FOR SOUNDCLOUD...' : 'CONNECT WITH SOUNDCLOUD'}
            </button>
            {sc.failed && <p className="dj-scr-connect-note">SoundCloud did not connect. Try again.</p>}
          </li>
        )}
        {/* FILES : les sous-dossiers d'abord, comme sur un CDJ */}
        {tab === 'files' &&
          !query.trim() &&
          subfolders.map((f) => (
            <li key={f.path} className="dj-scr-row dj-scr-dir">
              <button type="button" className="dj-scr-load" onClick={() => setPath(f.path)}>
                <span className="dj-scr-icon">
                  <Icon d={FOLDER_ICON} />
                </span>
                <span className="dj-scr-names">
                  <span className="dj-scr-name">{f.name}</span>
                </span>
                <span className="dj-scr-meta">
                  <span className="dj-scr-key">{f.n}</span>
                </span>
              </button>
            </li>
          ))}
        {!gate && (tab === 'maudite' || tab === 'soundcloud' || tab === 'mysc') && list === null && <li className="dj-scr-empty">Loading...</li>}
        {!gate && rows.length === 0 && !(tab === 'files' && subfolders.length > 0 && !query.trim()) && (tab === 'files' || tab === 'lists' || list !== null) && (
          <li className="dj-scr-empty">
            {tab === 'files'
              ? query.trim()
                ? 'No track found.'
                : 'Drop audio files or a folder here, or add them. Linked folders stay up to date; copies stay on this device. Nothing is uploaded.'
              : tab === 'lists'
                ? current
                  ? query.trim()
                    ? 'No track found.'
                    : 'This playlist is empty: tap + on any track to add it here.'
                  : 'No playlist yet. Tap + on any track to start one, or + NEW.'
                : scDown === 'down'
                  ? 'SoundCloud does not answer right now.'
                  : tab === 'soundcloud'
                    ? 'No remixable track found: only Creative Commons licenses that allow remixes are shown.'
                    : tab === 'mysc' && !query.trim()
                      ? 'No public track on this SoundCloud account.'
                      : 'No track found.'}
          </li>
        )}
        {rows.map((t, i) => {
          // Un morceau d'une visite passee se touche aussi : on retrouve son dossier
          const off = t.unreadable;
          return (
            <li key={t.id} className="dj-scr-row" data-relink={t.relink ? '1' : undefined} data-sure={loadSure === t.id ? '1' : undefined} aria-current={t.id === loadedId ? 'true' : undefined}>
              <button
                type="button"
                className="dj-scr-load"
                disabled={off}
                aria-label={
                  t.relink
                    ? `Find the folder of ${t.title}, then load it on deck ${deck.toUpperCase()}`
                    : loadSure === t.id
                      ? `Deck ${deck.toUpperCase()} is playing: press again to load ${t.title}`
                      : `Load ${t.title} on deck ${deck.toUpperCase()}`
                }
                onClick={() => (t.relink ? findFolder(t) : load(t))}
              >
                <span className="dj-scr-names">
                  <span className="dj-scr-name">{t.title}</span>
                  {loadSure === t.id ? (
                    <span className="dj-scr-artist dj-scr-sure">DECK {deck.toUpperCase()} IS PLAYING: TAP AGAIN TO LOAD</span>
                  ) : (
                    <span className="dj-scr-artist">
                      {t.unreadable ? (t.artist === 'No longer in FILES' ? t.artist : 'Unreadable file') : t.relink ? 'Tap, then pick its folder again' : t.artist}
                      {tab === 'files' && query.trim() && t.folder ? `  /  ${t.folder}` : ''}
                    </span>
                  )}
                </span>
                <span className="dj-scr-meta">
                  <span className="dj-scr-bpm">{t.bpm ? t.bpm.toFixed(0) : '--'}</span>
                  <span className="dj-scr-key">{t.key ?? ''}</span>
                  {t.source === 'soundcloud' && LICENSE_LABEL[t.license ?? ''] ? <span className="dj-scr-lic">{LICENSE_LABEL[t.license ?? '']}</span> : null}
                </span>
              </button>
              {inList && current ? (
                <>
                  <button type="button" className="dj-scr-act" aria-label={`Move ${t.title} up`} disabled={i === 0} onClick={() => void moveInList(current.id, t.id, -1)}>
                    <Icon d={UP} />
                  </button>
                  <button type="button" className="dj-scr-act" aria-label={`Move ${t.title} down`} disabled={i === rows.length - 1} onClick={() => void moveInList(current.id, t.id, 1)}>
                    <Icon d={DOWN} />
                  </button>
                  <button type="button" className="dj-scr-act" aria-label={`Remove ${t.title} from ${current.name}`} onClick={() => void removeFromList(current.id, t.id)}>
                    <Icon d={MINUS} />
                  </button>
                </>
              ) : (
                <button type="button" className="dj-scr-act" aria-label={`Add ${t.title} to a playlist`} title="Add to a playlist" onClick={() => setAdding(t)}>
                  <Icon d={PLUS} />
                </button>
              )}
              {t.source === 'soundcloud' && t.link && (
                <a className="dj-scr-link" href={t.link} target="_blank" rel="noopener noreferrer" title="Open on SoundCloud" aria-label={`Open ${t.title} on SoundCloud`}>
                  SC
                </a>
              )}
            </li>
          );
        })}
        {tab === 'soundcloud' && rows.length > 0 && (
          <li className="dj-scr-credit">
            Tracks from{' '}
            <a href="https://soundcloud.com" target="_blank" rel="noopener noreferrer">
              SoundCloud
            </a>
            , shared by their artists under Creative Commons licenses that allow remixes. SC opens a track on SoundCloud.
          </li>
        )}
        {tab === 'mysc' && me && rows.length > 0 && (
          <li className="dj-scr-credit">
            Your public tracks on{' '}
            <a href="https://soundcloud.com" target="_blank" rel="noopener noreferrer">
              SoundCloud
            </a>
            {me.name ? `, connected as ${me.name}` : ''}. Only you see them here.
          </li>
        )}
        {tab === 'maudite' && rows.length > 0 && (
          <li className="dj-scr-credit">
            Tracks by{' '}
            <a href="https://soundcloud.com/mauditemachine" target="_blank" rel="noopener noreferrer">
              Maudite Machine
            </a>
            , streamed from SoundCloud. Mix them as you like.
          </li>
        )}
      </ul>
    </div>
  );
};

/* ---------------- les samplers des platines ---------------- */

/** Les platines dont la page SMPL est a l'ecran ('ab' : A et B), relu a chaque changement d'un sampler. */
let openKey = '';
const samplersOpen = (): string => {
  const k = DJ_DECKS.filter((d) => samplerOf(d).get().open).join('');
  if (k !== openKey) openKey = k;
  return openKey;
};
const subscribeSamplers = (fn: () => void): (() => void) => {
  const offs = DJ_DECKS.map((d) => samplerOf(d).subscribe(fn));
  const offDecks = djDecks.subscribe(fn);
  return () => {
    offs.forEach((off) => off());
    offDecks();
  };
};

/* ---------------- les navigateurs des platines ---------------- */

interface Props {
  /** le Stage : la pose des navigateurs sur les ecrans */
  getStage?: () => Stage | null;
  /** la scene courante : elle est recreee au changement Dark / Light ou du nombre de platines */
  stage?: Stage | null;
}

export const DjBrowser: React.FC<Props> = ({ getStage, stage: current }) => {
  const b = useSyncExternalStore(djBrowser.subscribe, djBrowser.get, djBrowser.get);
  const dj = useSyncExternalStore(djState.subscribe, djState.get, djState.get);
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const introState = useSyncExternalStore(intro.subscribe, intro.get, intro.get);
  useSyncExternalStore(djDecks.subscribe, djDecks.get, djDecks.get);
  const on = f === 'dj' && introState === 'done';
  // Le sampler de chaque platine (2026-10-07) : sa page prend l'ecran, a la place du morceau et de la liste
  const smplOpen = useSyncExternalStore(subscribeSamplers, samplersOpen, samplersOpen);
  const sampling = (d: DjDeck): boolean => on && smplOpen.includes(d);
  // Une platine vide montre sa liste ; une platine chargee, son morceau (toucher l'ecran rouvre la liste)
  const browsing = (d: DjDeck): boolean => on && !sampling(d) && (b[d] ?? dj.deck[d].track === null);
  const clip = useRef<HTMLDivElement>(null);
  const roots = useRef(new Map<DjDeck, HTMLDivElement>());
  const placeRef = useRef<() => void>(() => undefined);

  // Le clavier des platines : actif seulement quand on utilise le MM-DECKS
  const onRef = useRef(on);
  onRef.current = on;
  useEffect(() => listenDjKeys(() => getStage?.() ?? null, () => onRef.current), [getStage]);

  // Echap : les listes ouvertes se ferment (avant les raccourcis des machines)
  useEffect(() => {
    if (!on) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      const open = DJ_DECKS.filter((d) => browsing(d));
      const smpl = DJ_DECKS.filter((d) => sampling(d));
      if (open.length === 0 && smpl.length === 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      for (const d of open) djBrowser.close(d);
      for (const d of smpl) samplerOf(d).toggleOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  });

  const setRoot = (d: DjDeck, el: HTMLDivElement | null): void => {
    if (el) roots.current.set(d, el);
    else roots.current.delete(d);
    placeRef.current();
  };

  // Plus de liste en bas : la scene garde toute la hauteur
  useLayoutEffect(() => {
    const st = current ?? getStage?.();
    st?.setDjInset(0);
  }, [current, getStage]);

  /*
   * La pose : a chaque vue, les quatre coins de l'ecran de chaque platine,
   * projetes ; la page de la liste prend la taille de l'ecran a l'ecran
   * (le texte reste net) et une homographie la plaque dessus. La couche
   * entiere est decoupee au cadre du canvas.
   */
  useLayoutEffect(() => {
    const st = current ?? getStage?.();
    if (!st) return undefined;
    const out = { x: 0, y: 0 };
    const place = (): void => {
      const layer = st.dj?.top;
      const box = clip.current;
      const canvas = document.querySelector('.v4-canvas-host canvas');
      if (!layer || !box || !(canvas instanceof HTMLCanvasElement)) return;
      const r = canvas.getBoundingClientRect();
      box.style.transform = `translate(${r.left}px, ${r.top}px)`;
      box.style.width = `${r.width}px`;
      box.style.height = `${r.height}px`;
      const S = DECK.screen;
      const y = DJ_BEZEL.h + 0.008;
      for (const [d, el] of roots.current) {
        const x0 = UNIT_X[d] + S.x - S.w / 2;
        const x1 = x0 + S.w;
        const z0 = S.z - S.d / 2;
        const z1 = S.z + S.d / 2;
        const q: number[] = [];
        for (const [px, pz] of [
          [x0, z0],
          [x1, z0],
          [x1, z1],
          [x0, z1],
        ]) {
          const p = st.hit.project(layer, px, y, pz, out);
          q.push(p.x, p.y);
        }
        const w = Math.max(1, Math.hypot(q[2] - q[0], q[3] - q[1]));
        const h = Math.max(1, Math.hypot(q[6] - q[0], q[7] - q[1]));
        const m = matrix3d(q, w, h);
        if (!m) continue;
        el.style.width = `${w.toFixed(1)}px`;
        el.style.height = `${h.toFixed(1)}px`;
        el.style.transform = m;
        // La taille du texte suit la largeur de l'ecran a l'ecran
        el.style.fontSize = `${Math.max(7, Math.min(18, w * 0.036)).toFixed(2)}px`;
      }
    };
    placeRef.current = place;
    place();
    const a = st.onView(place);
    const c = st.onIdle(place);
    window.addEventListener('resize', place);
    return () => {
      a();
      c();
      window.removeEventListener('resize', place);
      placeRef.current = () => undefined;
    };
  }, [current, getStage]);

  const open = DJ_DECKS.filter((d) => browsing(d) || sampling(d));
  return (
    <div ref={clip} className="dj-scr-clip" data-on={open.length > 0 ? '1' : '0'}>
      {open.map((d) => (sampling(d) ? <DeckSampler key={`smpl-${d}`} deck={d} setRoot={setRoot} /> : <DeckBrowser key={d} deck={d} setRoot={setRoot} />))}
    </div>
  );
};

export default DjBrowser;
