/**
 * La playlist du MM-DECKS (2026-10-04), posee sous les platines comme dans
 * les Decks de sonaa.ca (Mika : "c'est surtout la playlist que je peux
 * scroller, et je peux envoyer une track a A ou B"). Deux sources :
 * - AUDIUS : des morceaux entiers en MP3 que la page a le droit de traiter
 *   (CORS ouvert), avec leur BPM et leur tonalite ; les tendances
 *   electroniques au depart, une recherche ensuite.
 * - MY FILES : les fichiers de l'appareil (bouton, dossier, ou glisses sur
 *   la liste). Ils restent sur l'appareil : la platine les lit sur place,
 *   rien n'est envoye (Mika, 2026-10-03 : "ca va pas les uploader ?").
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
import { camelot } from './math';
import { djState, type DjTrack } from './state';
import { tagsOfFile, titleFromName } from './tags';
import type { DjDeck } from './theme';
import './dj.css';

/** Un morceau, pas un set : une minute au moins, douze au plus (tout est decode en memoire). */
const MAX_S = 12 * 60;
const ROWS = 200;
const SOUND = /\.(mp3|m4a|aac|wav|aiff?|flac|ogg|opus)$/i;

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

/** Les fichiers ajoutes pendant la visite (en memoire seulement). */
let files: DjTrack[] = [];
let fileSeq = 0;
const fileListeners = new Set<() => void>();
const fileStore = {
  get: (): DjTrack[] => files,
  subscribe(fn: () => void): () => void {
    fileListeners.add(fn);
    return () => {
      fileListeners.delete(fn);
    };
  },
};

async function addFiles(list: readonly File[]): Promise<number> {
  const added: DjTrack[] = [];
  for (const f of list) {
    if (!(f.type.startsWith('audio/') || SOUND.test(f.name))) continue;
    const tags = await tagsOfFile(f);
    const named = titleFromName(f.name);
    fileSeq += 1;
    added.push({
      id: `file-${fileSeq}-${f.name}`,
      source: 'file',
      title: tags.title || named.title,
      artist: tags.artist || named.artist,
      bpm: tags.bpm ?? null,
      key: camelot(tags.key),
      duration: 0,
      file: f,
    });
  }
  if (added.length > 0) {
    files = [...files, ...added];
    fileListeners.forEach((fn) => fn());
  }
  return added.length;
}

type Tab = 'audius' | 'files';
const fmtTime = (s: number): string => (s > 0 ? `${Math.floor(s / 60)}:${String(Math.floor(s % 60)).padStart(2, '0')}` : '');
/** Marge entre la playlist et le bas de la machine (px). */
const GAP = 12;
/** Desktop : la hauteur de l'en-tete (logo, MENU), que la machine laisse libre. */
const HEAD_PX = 56;

interface Props {
  /** le Stage : la playlist lui donne sa hauteur (le cadrage remonte au-dessus) */
  getStage?: () => Stage | null;
}

export const DjBrowser: React.FC<Props> = ({ getStage }) => {
  const b = useSyncExternalStore(djBrowser.subscribe, djBrowser.get, djBrowser.get);
  const dj = useSyncExternalStore(djState.subscribe, djState.get, djState.get);
  const mine = useSyncExternalStore(fileStore.subscribe, fileStore.get, fileStore.get);
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const introState = useSyncExternalStore(intro.subscribe, intro.get, intro.get);
  const shown = f === 'dj' && introState === 'done';
  const big = shown && b.open;
  const [tab, setTab] = useState<Tab>('audius');
  const [query, setQuery] = useState('');
  const [list, setList] = useState<DjTrack[] | null>(null);
  const [drop, setDrop] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const search = useRef<HTMLInputElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const pickDir = useRef<HTMLInputElement>(null);

  // Audius : les tendances electroniques, ou la recherche (300 ms apres la frappe)
  useEffect(() => {
    if (!shown || tab !== 'audius') return undefined;
    const ctl = new AbortController();
    const q = query.trim();
    const t = window.setTimeout(
      () => {
        setList(null);
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
    const stage = getStage?.();
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
  }, [shown, getStage]);

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
    const src = tab === 'audius' ? (list ?? []) : mine;
    const q = query.trim().toLowerCase();
    const out = tab === 'files' && q ? src.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(q)) : src;
    return out.slice(0, ROWS);
  }, [tab, list, mine, query]);

  const load = (t: DjTrack, d: DjDeck): void => {
    gesture();
    void djLoad(d, t);
    djBrowser.close();
  };

  const onFiles = (fl: FileList | null): void => {
    if (!fl) return;
    void addFiles(Array.from(fl)).then((n) => {
      if (n > 0) setTab('files');
    });
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
        onFiles(e.dataTransfer.files);
      }}
    >
      <div className="dj-list-head">
        <div className="dj-list-tabs" role="tablist">
          {(['audius', 'files'] as const).map((t) => (
            <button key={t} type="button" role="tab" aria-selected={tab === t} className="dj-list-tab" onClick={() => setTab(t)}>
              {t === 'audius' ? 'AUDIUS' : `MY FILES${mine.length ? ` ${mine.length}` : ''}`}
            </button>
          ))}
        </div>
        <input
          ref={search}
          className="dj-list-search"
          type="search"
          placeholder={tab === 'audius' ? 'Search Audius' : 'Search my files'}
          aria-label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {tab === 'files' && (
          <>
            <button type="button" className="dj-list-add" onClick={() => pick.current?.click()}>
              + FILES
            </button>
            <button type="button" className="dj-list-add" onClick={() => pickDir.current?.click()}>
              + FOLDER
            </button>
          </>
        )}
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
      <ul className="dj-list-rows">
        {tab === 'audius' && list === null && <li className="dj-list-empty">Loading...</li>}
        {rows.length === 0 && (tab === 'files' || list !== null) && (
          <li className="dj-list-empty">
            {tab === 'files' ? 'Drop audio files here, or add files or a folder. They stay on this device: nothing is uploaded.' : 'No track found.'}
          </li>
        )}
        {rows.map((t) => (
          <li key={t.id} className="dj-list-row" aria-current={t.id === loadedId('a') || t.id === loadedId('b') ? 'true' : undefined}>
            <span className="dj-list-names">
              <span className="dj-list-name">{t.title}</span>
              <span className="dj-list-artist">{t.artist}</span>
            </span>
            <span className="dj-list-meta">
              <span>{t.bpm ? t.bpm.toFixed(0) : '--'}</span>
              <span>{t.key ?? ''}</span>
              <span>{fmtTime(t.duration)}</span>
            </span>
            <span className="dj-list-decks">
              {(['a', 'b'] as const).map((d) => (
                <button
                  key={d}
                  type="button"
                  aria-label={`Load ${t.title} on deck ${d.toUpperCase()}`}
                  aria-pressed={loadedId(d) === t.id}
                  data-target={big && target === d ? '1' : '0'}
                  onClick={() => load(t, d)}
                >
                  {d.toUpperCase()}
                </button>
              ))}
            </span>
          </li>
        ))}
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
