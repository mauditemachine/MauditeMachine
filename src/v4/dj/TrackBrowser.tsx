/**
 * La playlist du MM-DECKS (2026-10-04), posee sous les platines comme dans
 * les Decks de sonaa.ca (Mika : "c'est surtout la playlist que je peux
 * scroller, et je peux envoyer une track a A ou B"). Deux sources :
 * - SOUNDCLOUD (2026-10-04, Mika : "Audius c'est vraiment pourri") : par le
 *   Worker de Sonaa, seulement les licences Creative Commons qui autorisent
 *   le remix ; chaque ligne credite l'auteur et renvoie a sa page
 *   (dj/soundcloud.ts).
 * - AUDIUS : des morceaux entiers en MP3 que la page a le droit de traiter
 *   (CORS ouvert), avec leur BPM et leur tonalite ; les tendances
 *   electroniques au depart, une recherche ensuite.
 * - MY FILES : la caisse (dj/crate.ts), les fichiers de l'appareil gardes
 *   d'une visite a l'autre, ranges par dossier (bouton, dossier, ou glisses
 *   sur la liste). Ils restent sur l'appareil : rien n'est envoye (Mika,
 *   2026-10-03 : "ca va pas les uploader ?"). Un gros import demande : copier
 *   dans le navigateur (s'il y a la place), ou relier pour la visite ; sur
 *   Chrome et Edge, un dossier se relie sans rien copier.
 * Chaque ligne a deux touches, A et B : le morceau part sur la platine
 * choisie. Desktop : une bande en bas, sous les trois blocs ; telephone :
 * sous la platine cadree. Le cadrage de la scene remonte au-dessus d'elle
 * (Stage.setDjInset). LOAD sur une platine l'agrandit (par-dessus le jog au
 * telephone) et la vise ; un choix, Echap ou la touche d'en-tete la
 * replient.
 */

import React, { useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { gesture } from '../actions';
import type { Stage } from '../scene/renderer';
import { focus } from '../state/focus';
import { intro } from '../state/intro';
import { AUDIUS_APP, audiusHostUrl, djLoad } from './actions';
import { djBrowser } from './browser';
import { DJ_KEY_LEGEND, listenDjKeys } from './keys';
import { addFiles, analyzeAll, canLink, crateEvents, crateTracks, folderOfPath, isSound, linkFolder, pickAndLink, readDrop, removeFolder, storageLeft, type ImportMode, type PlacedFile } from './crate';
import { camelot } from './math';
import { LICENSE_LABEL, searchSoundcloud } from './soundcloud';
import { djState, type DjTrack } from './state';
import type { DjDeck } from './theme';
import './dj.css';

/** Un morceau, pas un set : une minute au moins, douze au plus (tout est decode en memoire). */
const MAX_S = 12 * 60;
const ROWS = 200;

interface Raw {
  id?: string;
  title?: string;
  bpm?: number | null;
  musical_key?: string | null;
  duration?: number;
  is_streamable?: boolean;
  permalink?: string;
  user?: { name?: string; handle?: string };
}

function fromAudius(b: Raw): DjTrack | null {
  if (!b.id || !b.title || b.is_streamable === false) return null;
  const d = b.duration ?? 0;
  if (d < 60 || d > MAX_S) return null;
  return {
    id: b.id,
    source: 'audius',
    title: b.title,
    artist: b.user?.name ?? b.user?.handle ?? '',
    bpm: typeof b.bpm === 'number' && b.bpm > 0 ? Math.round(b.bpm * 10) / 10 : null,
    key: camelot(b.musical_key),
    duration: d,
    link: `https://audius.co${b.permalink ?? ''}`,
  };
}

async function audius(path: string, signal: AbortSignal): Promise<DjTrack[]> {
  const host = await audiusHostUrl();
  const r = await fetch(`${host}${path}${path.includes('?') ? '&' : '?'}app_name=${AUDIUS_APP}`, { signal });
  if (!r.ok) return [];
  const d = (await r.json()) as { data?: Raw[] };
  return (d.data ?? []).map(fromAudius).filter((t): t is DjTrack => t !== null);
}

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
  // Les analyses reprennent ou elles en etaient, a chaque visite
  useEffect(() => {
    if (on) void analyzeAll();
  }, [on]);
  return tracks;
}

/** Les dossiers de la caisse, en ordre alphabetique ; '' (en vrac) a la fin. */
const foldersOf = (t: readonly DjTrack[]): string[] => {
  const set = new Set(t.map((x) => x.folder ?? ''));
  return [...set].sort((x, y) => (x === '' ? 1 : y === '' ? -1 : x.localeCompare(y)));
};

/** L'onglet retenu (MY FILES pour qui a sa caisse). */
const TAB_KEY = 'mm.v4.dj.tab';
const readTab = (): Tab => {
  try {
    const t = window.localStorage.getItem(TAB_KEY);
    return t === 'files' || t === 'audius' ? t : 'soundcloud';
  } catch {
    return 'soundcloud';
  }
};

/** Tous les dossiers a la fois. */
const ALL = '*';
const FOLDER_KEY = 'mm.v4.dj.folder';
const readFolder = (): string => {
  try {
    return window.localStorage.getItem(FOLDER_KEY) ?? ALL;
  } catch {
    return ALL;
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

type Tab = 'soundcloud' | 'audius' | 'files';
/** La reponse du Worker sur SoundCloud, une fois par visite. */
let scProbe: Promise<boolean> | null = null;
let scProbeOff = false;
const TABS: readonly Tab[] = ['soundcloud', 'audius', 'files'];
const fmtTime = (s: number): string => (s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');
/** Marge entre la playlist et le bas de la machine (px). */
const GAP = 12;
/** Desktop : la hauteur de l'en-tete (logo, MENU), que la machine laisse libre. */
const HEAD_PX = 56;

interface Props {
  /** le Stage : la playlist lui donne sa hauteur (le cadrage remonte au-dessus) */
  getStage?: () => Stage | null;
  /**
   * La scene courante : elle est recreee au changement Dark / Light, et la
   * nouvelle part sans marge ; l'effet qui la lui donne doit la suivre.
   */
  stage?: Stage | null;
}

export const DjBrowser: React.FC<Props> = ({ getStage, stage: current }) => {
  const b = useSyncExternalStore(djBrowser.subscribe, djBrowser.get, djBrowser.get);
  const dj = useSyncExternalStore(djState.subscribe, djState.get, djState.get);
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const introState = useSyncExternalStore(intro.subscribe, intro.get, intro.get);
  const shown = f === 'dj' && introState === 'done';
  const big = shown && b.open;
  const [tab, setTabState] = useState<Tab>(readTab);
  const setTab = (t: Tab): void => {
    setTabState(t);
    try {
      window.localStorage.setItem(TAB_KEY, t);
    } catch {
      /* rien a retenir */
    }
  };
  const mine = useCrate(shown) ?? [];
  const [folder, setFolderState] = useState<string>(readFolder);
  const [plan, setPlan] = useState<Plan | null>(null);
  const [work, setWork] = useState<string | null>(null);
  const [sure, setSure] = useState(false);
  const [legend, setLegend] = useState(false);
  // Le clavier des platines : actif seulement quand on utilise le MM-DECKS
  const shownRef = useRef(shown);
  shownRef.current = shown;
  useEffect(() => listenDjKeys(() => getStage?.() ?? null, () => shownRef.current), [getStage]);
  const folders = useMemo(() => foldersOf(mine), [mine]);
  // Un dossier retenu qui n'existe plus : tout montrer
  const shownFolder = folder === ALL || folders.includes(folder) ? folder : ALL;
  const setFolder = (f: string): void => {
    setFolderState(f);
    setSure(false);
    try {
      window.localStorage.setItem(FOLDER_KEY, f);
    } catch {
      /* rien a retenir */
    }
  };
  const [query, setQuery] = useState('');
  const [list, setList] = useState<DjTrack[] | null>(null);
  /** SoundCloud : sa cle n'est pas encore posee dans le Worker, ou il ne repond pas */
  const [scDown, setScDown] = useState<'off' | 'down' | null>(null);
  const [scOff, setScOff] = useState(scProbeOff);
  // SoundCloud branche ? Une recherche vide le dit (gardee au Worker) ; sinon l'onglet s'efface
  useEffect(() => {
    if (!shown) return;
    scProbe ??= searchSoundcloud('', new AbortController().signal).then((r) => {
      scProbeOff = !r.ok && r.reason === 'off';
      return scProbeOff;
    });
    void scProbe.then((off) => {
      if (!off) return;
      setScOff(true);
      if (tab === 'soundcloud') setTab('audius');
    });
  }, [shown]);
  const [drop, setDrop] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const pickDir = useRef<HTMLInputElement>(null);

  // SoundCloud et Audius : des styles de club au depart, ou la recherche (300 ms apres la frappe)
  useEffect(() => {
    if (!shown || tab === 'files') return undefined;
    const ctl = new AbortController();
    const q = query.trim();
    const t = window.setTimeout(
      () => {
        setList(null);
        setScDown(null);
        if (tab === 'soundcloud') {
          searchSoundcloud(q, ctl.signal)
            .then((r) => {
              if (r.ok) setList(r.tracks);
              else if (r.reason === 'off') {
                // Pas encore branche (la cle n'est pas posee dans le Worker) : l'onglet s'efface, Audius le remplace
                setScOff(true);
                setTab('audius');
              } else {
                setScDown(r.reason);
                setList([]);
              }
            })
            .catch(() => {
              if (!ctl.signal.aborted) setList([]);
            });
          return;
        }
        audius(q ? `/v1/tracks/search?query=${encodeURIComponent(q)}` : '/v1/tracks/trending?genre=Electronic&time=week', ctl.signal)
          .then(setList)
          .catch(() => {
            if (!ctl.signal.aborted) setList([]);
          });
      },
      q ? 300 : 0
    );
    return () => {
      window.clearTimeout(t);
      ctl.abort();
    };
  }, [shown, tab, query]);

  // Cachee : hors du clavier et des lecteurs d'ecran (inert n'est pas type par React 18)
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    if (shown) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
  }, [shown]);

  // La hauteur repliee de la playlist remonte le cadrage de la scene (agrandie, elle passe par-dessus)
  useLayoutEffect(() => {
    const el = panel.current;
    const stage = current ?? getStage?.();
    if (!el || !stage) return undefined;
    if (!shown) {
      stage.setDjInset(0);
      return undefined;
    }
    const apply = (): void => {
      if (el.dataset.big === '1') return;
      const r = el.getBoundingClientRect();
      const host = el.offsetParent instanceof HTMLElement ? el.offsetParent.getBoundingClientRect() : { top: 0, bottom: window.innerHeight };
      // En haut : le selecteur des machines au telephone, l'en-tete sur desktop
      const sw = document.querySelector('.v4-mswitch');
      const top = sw ? sw.getBoundingClientRect().bottom - host.top + GAP / 2 : HEAD_PX;
      stage.setDjInset(host.bottom - r.top + GAP, top);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown, getStage, current]);

  // LOAD : la recherche prend le clavier ; Echap replie (avant les raccourcis des machines)
  useEffect(() => {
    if (!big) return undefined;
    if (window.matchMedia('(hover: hover)').matches) search.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      djBrowser.close();
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [big]);

  const rows = useMemo(() => {
    const src = tab !== 'files' ? (list ?? []) : mine.filter((t) => shownFolder === ALL || (t.folder ?? '') === shownFolder);
    const q = query.trim().toLowerCase();
    const out = tab === 'files' && q ? src.filter((t) => `${t.title} ${t.artist} ${t.folder ?? ''}`.toLowerCase().includes(q)) : src;
    return out.slice(0, ROWS);
  }, [tab, list, mine, query, shownFolder]);

  const load = (t: DjTrack, d: DjDeck): void => {
    gesture();
    void djLoad(d, t);
    djBrowser.close();
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
    // Le choix prend de la place : la playlist s'agrandit
    if (!djBrowser.get().open) djBrowser.open(djBrowser.get().deck);
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

  const loadedId = (d: DjDeck): string | null => dj.deck[d].track?.id ?? null;
  const target = b.deck;

  return (
    <div
      ref={panel}
      className="dj-list"
      data-shown={shown ? '1' : '0'}
      data-big={big ? '1' : '0'}
      data-drop={drop ? '1' : '0'}
      role="region"
      aria-label="Playlist"
      aria-hidden={!shown}
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
      <div className="dj-list-head">
        <div className="dj-list-tabs" role="tablist">
          {TABS.filter((t) => t !== 'soundcloud' || !scOff).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className="dj-list-tab" onClick={() => setTab(t)}>
              {t === 'soundcloud' ? 'SOUNDCLOUD' : t === 'audius' ? 'AUDIUS' : `MY FILES${mine.length ? ` ${mine.length}` : ''}`}
            </button>
          ))}
        </div>
        <input
          ref={search}
          className="dj-list-search"
          type="search"
          placeholder={tab === 'soundcloud' ? 'Search SoundCloud (Creative Commons)' : tab === 'audius' ? 'Search Audius' : 'Search my files'}
          aria-label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {tab === 'files' && (
          <>
            <button type="button" className="dj-list-add" onClick={() => pick.current?.click()}>
              + FILES
            </button>
            <button type="button" className="dj-list-add" onClick={addFolder}>
              + FOLDER
            </button>
          </>
        )}
        <button type="button" className="dj-list-keys" aria-pressed={legend} onClick={() => setLegend(!legend)}>
          KEYS
        </button>
        {big && (
          <span className="dj-list-target">
            TO DECK <b>{target.toUpperCase()}</b>
          </span>
        )}
        <button
          type="button"
          className="dj-list-grow"
          aria-expanded={big}
          aria-label={big ? 'Shrink the playlist' : 'Expand the playlist'}
          onClick={() => (big ? djBrowser.close() : djBrowser.open(target))}
        >
          <svg viewBox="0 0 12 8" width="12" height="8" aria-hidden="true">
            <path d="M1 7 L6 2 L11 7" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
          </svg>
        </button>
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
        <div className="dj-list-folders" role="group" aria-label="Folders">
          {[ALL, ...folders].map((f) => (
            <button key={f || 'loose'} type="button" className="dj-list-folder" aria-pressed={shownFolder === f} onClick={() => setFolder(f)}>
              {f === ALL ? `ALL ${mine.length}` : f === '' ? 'LOOSE' : f}
            </button>
          ))}
          {shownFolder !== ALL && (
            <button type="button" className="dj-list-forget" data-sure={sure ? '1' : '0'} onClick={forget} onBlur={() => setSure(false)}>
              {sure ? 'REMOVE? YES' : 'REMOVE FOLDER'}
            </button>
          )}
        </div>
      )}
      {work && <p className="dj-list-work">{work}</p>}
      {legend && (
        <dl className="dj-list-legend" aria-label="Keyboard">
          {DJ_KEY_LEGEND.map((l) => (
            <div key={l.keys}>
              <dt>{l.keys}</dt>
              <dd>{l.what}</dd>
            </div>
          ))}
        </dl>
      )}
      {plan && (
        <div className="dj-list-plan" role="dialog" aria-label="Add files">
          <p>
            {plan.files.length} tracks, {human(plan.bytes)}.{' '}
            {canLink() ? 'Tip: + FOLDER links a folder without copying it.' : 'They stay on this device: nothing is uploaded.'}
          </p>
          <label className="dj-list-plan-folder">
            <span>FOLDER</span>
            <input type="text" value={plan.folder} placeholder="No folder" onChange={(e) => setPlan({ ...plan, folder: e.target.value })} />
          </label>
          <div className="dj-list-plan-actions">
            {(plan.left === null || plan.left > plan.bytes * 1.1) && (
              <button type="button" onClick={() => confirm('copy')}>
                KEEP ON THIS DEVICE
              </button>
            )}
            <button type="button" onClick={() => confirm('visit')}>
              THIS VISIT ONLY
            </button>
            <button type="button" className="dj-list-plan-cancel" onClick={() => setPlan(null)}>
              CANCEL
            </button>
          </div>
          {plan.left !== null && plan.left <= plan.bytes * 1.1 && (
            <p className="dj-list-plan-note">Not enough room to keep them: {human(Math.max(0, plan.left))} left. This visit only keeps their names, BPM and cues; next time, add the folder again.</p>
          )}
        </div>
      )}
      <ul className="dj-list-rows">
        {tab !== 'files' && list === null && <li className="dj-list-empty">Loading...</li>}
        {rows.length === 0 && (tab === 'files' || list !== null) && (
          <li className="dj-list-empty">
            {tab === 'files'
              ? 'Drop audio files or a folder here, or add them. They stay on this device and are remembered for your next visit: nothing is uploaded.'
              : tab === 'soundcloud' && scDown === 'off'
                ? 'SoundCloud is not connected yet.'
                : tab === 'soundcloud' && scDown === 'down'
                  ? 'SoundCloud does not answer right now.'
                  : tab === 'soundcloud'
                    ? 'No remixable track found: only Creative Commons licenses that allow remixes are shown.'
                    : 'No track found.'}
          </li>
        )}
        {rows.map((t) => (
          <li
            key={t.id}
            className="dj-list-row"
            data-off={t.relink || t.unreadable ? '1' : '0'}
            aria-current={t.id === loadedId('a') || t.id === loadedId('b') ? 'true' : undefined}
          >
            <span className="dj-list-names">
              {t.source === 'soundcloud' && t.link ? (
                <a className="dj-list-name" href={t.link} target="_blank" rel="noopener noreferrer" title="Open on SoundCloud">
                  {t.title}
                </a>
              ) : (
                <span className="dj-list-name">{t.title}</span>
              )}
              <span className="dj-list-artist">{t.unreadable ? 'Unreadable file' : t.relink ? 'Add its folder again to play it' : t.artist}</span>
            </span>
            <span className="dj-list-meta">
              <span>{t.bpm ? t.bpm.toFixed(0) : '--'}</span>
              <span>{t.key ?? ''}</span>
              <span>{t.source === 'soundcloud' ? (LICENSE_LABEL[t.license ?? ''] ?? '') : fmtTime(t.duration)}</span>
            </span>
            <span className="dj-list-decks">
              {(['a', 'b'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={`Load ${t.title} on deck ${d.toUpperCase()}`}
                  aria-pressed={loadedId(d) === t.id}
                  data-target={big && target === d ? '1' : '0'}
                  disabled={t.relink || t.unreadable}
                  onClick={() => load(t, d)}
                >
                  {d.toUpperCase()}
                </button>
              ))}
            </span>
          </li>
        ))}
        {tab === 'soundcloud' && rows.length > 0 && (
          <li className="dj-list-credit">
            Tracks from{' '}
            <a href="https://soundcloud.com" target="_blank" rel="noopener noreferrer">
              SoundCloud
            </a>
            , shared by their artists under Creative Commons licenses that allow remixes. Each title opens its SoundCloud page.
          </li>
        )}
        {tab === 'audius' && rows.length > 0 && (
          <li className="dj-list-credit">
            Tracks from{' '}
            <a href="https://audius.co" target="_blank" rel="noopener noreferrer">
              Audius
            </a>
            , streamed from the artists.
          </li>
        )}
      </ul>
    </div>
  );
};

export default DjBrowser;
