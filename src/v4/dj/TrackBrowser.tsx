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
 * Le nom DjBrowser et ses props ne changent pas (index.tsx, state/djload.ts).
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { gesture } from '../actions';
import type { Stage } from '../scene/renderer';
import { focus } from '../state/focus';
import { intro } from '../state/intro';
import { djLoad } from './actions';
import { djBrowser } from './browser';
import { addFiles, analyzeAll, canLink, crateEvents, crateTracks, folderOfPath, isSound, linkFolder, pickAndLink, readDrop, removeFolder, storageLeft, type ImportMode, type PlacedFile } from './crate';
import { DJ_KEY_LEGEND, listenDjKeys } from './keys';
import { LICENSE_LABEL, connectSoundcloud, disconnectSoundcloud, mauditeTracks, myTracks, scAccount, searchSoundcloud } from './soundcloud';
import { djState, type DjTrack } from './state';
import { DECK, DJ_BEZEL, DJ_DECKS, UNIT_X, djDecks, type DjDeck } from './theme';
import './dj.css';

const ROWS = 200;

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

/** Les dossiers de la caisse, en ordre alphabetique ; '' (en vrac) a la fin. */
const foldersOf = (t: readonly DjTrack[]): string[] => {
  const set = new Set(t.map((x) => x.folder ?? ''));
  return [...set].sort((x, y) => (x === '' ? 1 : y === '' ? -1 : x.localeCompare(y)));
};

type Tab = 'maudite' | 'soundcloud' | 'mysc' | 'files';
const TABS: readonly Tab[] = ['maudite', 'soundcloud', 'mysc', 'files'];
const TAB_LABEL: Readonly<Record<Tab, string>> = { maudite: 'MAUDITE', soundcloud: 'SOUNDCLOUD', mysc: 'MY SC', files: 'FILES' };
const PLACEHOLDER: Readonly<Record<Tab, string>> = {
  maudite: 'Search Maudite Machine',
  soundcloud: 'Search SoundCloud (CC)',
  mysc: 'Search my SoundCloud',
  files: 'Search my files',
};

/** L'onglet retenu (FILES pour qui a sa caisse). */
const TAB_KEY = 'mm.v4.dj.tab';
const readTab = (): Tab => {
  try {
    const t = window.localStorage.getItem(TAB_KEY);
    return t === 'files' || t === 'soundcloud' || t === 'mysc' ? t : 'maudite';
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

/** Tous les dossiers a la fois. */
const ALL = '*';

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

const DeckBrowser: React.FC<DeckProps> = ({ deck, setRoot }) => {
  const dj = useSyncExternalStore(djState.subscribe, djState.get, djState.get);
  const sc = useSyncExternalStore(scAccount.subscribe, scAccount.get, scAccount.get);
  const me = sc.account;
  const [tab, setTabState] = useState<Tab>(readTab);
  const setTab = (t: Tab): void => {
    setTabState(t);
    saveTab(t);
  };
  const mine = useCrate(true) ?? [];
  const [folder, setFolderState] = useState<string>(ALL);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [work, setWork] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const [legend, setLegend] = useState(false);
  const [drop, setDrop] = useState(false);
  const [query, setQuery] = useState('');
  const [list, setList] = useState<DjTrack[] | null>(null);
  const [scDown, setScDown] = useState<'off' | 'down' | null>(null);
  const [scOff, setScOff] = useState(scProbeOff);
  const pick = useRef<HTMLInputElement>(null);
  const pickDir = useRef<HTMLInputElement>(null);
  const folders = useMemo(() => foldersOf(mine), [mine]);
  const shownFolder = folder === ALL || folders.includes(folder) ? folder : ALL;
  const setFolder = (f: string): void => {
    setFolderState(f);
    setSure(false);
  };

  // Les analyses de la caisse reprennent ou elles en etaient
  useEffect(() => {
    void analyzeAll();
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
      setTabState((t) => (t === 'files' ? t : 'files'));
    });
    return () => {
      live = false;
    };
  }, []);

  // SOUNDCLOUD cherche chez SoundCloud (300 ms apres la frappe) ; MAUDITE et MY SC se lisent une fois
  useEffect(() => {
    if (tab === 'files') return undefined;
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

  const rows = useMemo(() => {
    const src = tab !== 'files' ? (list ?? []) : mine.filter((t) => shownFolder === ALL || (t.folder ?? '') === shownFolder);
    const q = query.trim().toLowerCase();
    // SOUNDCLOUD cherche chez SoundCloud ; les autres filtrent sur place
    const out = tab !== 'soundcloud' && q ? src.filter((t) => `${t.title} ${t.artist} ${t.folder ?? ''}`.toLowerCase().includes(q)) : src;
    return out.slice(0, ROWS);
  }, [tab, list, mine, query, shownFolder]);

  /** Un morceau choisi : il part sur cette platine, l'ecran revient au morceau. */
  const load = (t: DjTrack): void => {
    gesture();
    void djLoad(deck, t);
    djBrowser.close(deck);
  };

  const progress = (done: number, total: number): void => setWork(`ADDING ${done} / ${total}`);

  /** Range des fichiers : un seul petit fichier entre tout de suite (copie) ; sinon on demande. */
  const offer = async (files: PlacedFile[]): Promise<void> => {
    const sounds = files.filter((x) => isSound(x.file));
    if (sounds.length === 0) return;
    setTab('files');
    const bytes = sounds.reduce((n, x) => n + x.file.size, 0);
    const named = sounds.find((x) => x.folder)?.folder ?? (shownFolder !== ALL ? shownFolder : '');
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
      const f = files[0]?.folder ?? '';
      if (n > 0) setFolder(files.every((x) => x.folder === f) ? f : ALL);
    } finally {
      setWork(null);
    }
  };

  const confirm = (mode: ImportMode): void => {
    if (!plan) return;
    void run(
      plan.files.map((x) => ({ ...x, folder: plan.folder.trim() })),
      mode
    );
  };

  const onFiles = (fl: FileList | null): void => {
    if (!fl) return;
    void offer(Array.from(fl).map((file) => ({ file, folder: folderOfPath(file) })));
  };

  /** + FOLDER : relie sur Chrome et Edge, le selecteur de dossiers ailleurs. */
  const addFolder = (): void => {
    if (!canLink()) {
      pickDir.current?.click();
      return;
    }
    void pickAndLink(progress)
      .then((r) => {
        if (r) {
          setTab('files');
          setFolder(r.name);
        }
      })
      .finally(() => setWork(null));
  };

  const onDrop = (items: DataTransferItemList): void => {
    const { dirs, files } = readDrop(items, shownFolder !== ALL ? shownFolder : '');
    void (async () => {
      const ds = await dirs;
      for (const d of ds) {
        const r = await linkFolder(d, progress);
        setTab('files');
        setFolder(r.name);
      }
      setWork(null);
      await offer(await files);
    })();
  };

  const forget = (): void => {
    if (!sure) {
      setSure(true);
      return;
    }
    setSure(false);
    void removeFolder(shownFolder === ALL ? '' : shownFolder).then(() => setFolder(ALL));
  };

  const loadedId = dj.deck[deck].track?.id ?? null;
  /** MY SC sans connexion : le bouton prend la place de la liste */
  const gate = tab === 'mysc' && !me;

  return (
    <div
      ref={(el) => setRoot(deck, el)}
      className="dj-scr"
      data-drop={drop ? '1' : '0'}
      role="region"
      aria-label={`Deck ${deck.toUpperCase()} track browser`}
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
      <div className="dj-scr-head">
        <span className="dj-scr-deck">{deck.toUpperCase()}</span>
        <div className="dj-scr-tabs" role="tablist">
          {TABS.filter((t) => t === 'files' || !scOff).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className="dj-scr-tab" onClick={() => setTab(t)}>
              {t === 'files' && mine.length ? `${TAB_LABEL.files} ${mine.length}` : TAB_LABEL[t]}
            </button>
          ))}
        </div>
        <button type="button" className="dj-scr-keys" aria-pressed={legend} onClick={() => setLegend(!legend)}>
          KEYS
        </button>
        <button type="button" className="dj-scr-done" onClick={() => djBrowser.close(deck)}>
          DONE
        </button>
      </div>
      <div className="dj-scr-tools">
        <input
          className="dj-scr-search"
          type="search"
          placeholder={PLACEHOLDER[tab]}
          aria-label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
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
      {tab === 'files' && (folders.length > 1 || (folders.length === 1 && folders[0] !== '')) && (
        <div className="dj-scr-folders" role="group" aria-label="Folders">
          {[ALL, ...folders].map((f) => (
            <button key={f || 'loose'} type="button" className="dj-scr-folder" aria-pressed={shownFolder === f} onClick={() => setFolder(f)}>
              {f === ALL ? `ALL ${mine.length}` : f === '' ? 'LOOSE' : f}
            </button>
          ))}
          {shownFolder !== ALL && (
            <button type="button" className="dj-scr-forget" data-sure={sure ? '1' : '0'} onClick={forget} onBlur={() => setSure(false)}>
              {sure ? 'REMOVE? YES' : 'REMOVE FOLDER'}
            </button>
          )}
        </div>
      )}
      {work && <p className="dj-scr-work">{work}</p>}
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
            {plan.files.length} tracks, {human(plan.bytes)}. {canLink() ? 'Tip: + FOLDER links a folder without copying it.' : 'They stay on this device: nothing is uploaded.'}
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
            <button type="button" onClick={() => confirm('visit')}>
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
        {!gate && tab !== 'files' && list === null && <li className="dj-scr-empty">Loading...</li>}
        {!gate && rows.length === 0 && (tab === 'files' || list !== null) && (
          <li className="dj-scr-empty">
            {tab === 'files'
              ? 'Drop audio files or a folder here, or add them. They stay on this device: nothing is uploaded.'
              : scDown === 'down'
                ? 'SoundCloud does not answer right now.'
                : tab === 'soundcloud'
                  ? 'No remixable track found: only Creative Commons licenses that allow remixes are shown.'
                  : tab === 'mysc' && !query.trim()
                    ? 'No public track on this SoundCloud account.'
                    : 'No track found.'}
          </li>
        )}
        {rows.map((t) => {
          const off = t.relink || t.unreadable;
          return (
            <li key={t.id} className="dj-scr-row" aria-current={t.id === loadedId ? 'true' : undefined}>
              <button type="button" className="dj-scr-load" disabled={off} aria-label={`Load ${t.title} on deck ${deck.toUpperCase()}`} onClick={() => load(t)}>
                <span className="dj-scr-names">
                  <span className="dj-scr-name">{t.title}</span>
                  <span className="dj-scr-artist">{t.unreadable ? 'Unreadable file' : t.relink ? 'Add its folder again to play it' : t.artist}</span>
                </span>
                <span className="dj-scr-meta">
                  <span className="dj-scr-bpm">{t.bpm ? t.bpm.toFixed(0) : '--'}</span>
                  <span className="dj-scr-key">{t.key ?? ''}</span>
                  {t.source === 'soundcloud' && LICENSE_LABEL[t.license ?? ''] ? <span className="dj-scr-lic">{LICENSE_LABEL[t.license ?? '']}</span> : null}
                </span>
              </button>
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
  // Une platine vide montre sa liste ; une platine chargee, son morceau (toucher l'ecran rouvre la liste)
  const browsing = (d: DjDeck): boolean => on && (b[d] ?? dj.deck[d].track === null);
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
      if (open.length === 0) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      for (const d of open) djBrowser.close(d);
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

  const open = DJ_DECKS.filter((d) => browsing(d));
  return (
    <div ref={clip} className="dj-scr-clip" data-on={open.length > 0 ? '1' : '0'}>
      {open.map((d) => (
        <DeckBrowser key={d} deck={d} setRoot={setRoot} />
      ))}
    </div>
  );
};

export default DjBrowser;
