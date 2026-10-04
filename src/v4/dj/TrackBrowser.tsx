/**
 * La liste des morceaux du MM-DECKS (2026-10-04), ouverte par LOAD : comme
 * dans les Decks de sonaa.ca, deux sources.
 * - AUDIUS : des morceaux entiers en MP3 que la page a le droit de traiter
 *   (CORS ouvert), avec leur BPM et leur tonalite ; les tendances
 *   electroniques au depart, une recherche ensuite.
 * - MY FILES : les fichiers de l'appareil (bouton, dossier, ou glisses sur
 *   la liste). Ils restent sur l'appareil : la platine les lit sur place,
 *   rien n'est envoye (Mika, 2026-10-03 : "ca va pas les uploader ?").
 * Chaque ligne a deux touches, A et B : le morceau part sur la platine
 * choisie. Desktop : un panneau a droite ; telephone : une feuille en bas.
 * Echap ferme.
 */

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { gesture } from '../actions';
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

export const DjBrowser: React.FC = () => {
  const b = useSyncExternalStore(djBrowser.subscribe, djBrowser.get, djBrowser.get);
  const dj = useSyncExternalStore(djState.subscribe, djState.get, djState.get);
  const mine = useSyncExternalStore(fileStore.subscribe, fileStore.get, fileStore.get);
  const [tab, setTab] = useState<Tab>('audius');
  const [query, setQuery] = useState('');
  const [list, setList] = useState<DjTrack[] | null>(null);
  const [drop, setDrop] = useState(false);
  const panel = useRef<HTMLDivElement>(null);
  const pick = useRef<HTMLInputElement>(null);
  const pickDir = useRef<HTMLInputElement>(null);

  // Audius : les tendances electroniques, ou la recherche (300 ms apres la frappe)
  useEffect(() => {
    if (!b.open || tab !== 'audius') return undefined;
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
  }, [b.open, tab, query]);

  // Fermee : hors du clavier et des lecteurs d'ecran (inert n'est pas type par React 18)
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    if (b.open) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
  }, [b.open]);

  // Echap ferme (avant les raccourcis des machines)
  useEffect(() => {
    if (!b.open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      djBrowser.close();
    };
    window.addEventListener('keydown', onKey, true);
    panel.current?.querySelector<HTMLElement>('input, button')?.focus({ preventScroll: true });
    return () => window.removeEventListener('keydown', onKey, true);
  }, [b.open]);

  const shown = useMemo(() => {
    const src = tab === 'audius' ? (list ?? []) : mine;
    const q = query.trim().toLowerCase();
    const f = tab === 'files' && q ? src.filter((t) => `${t.title} ${t.artist}`.toLowerCase().includes(q)) : src;
    return f.slice(0, ROWS);
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

  return (
    <div
      ref={panel}
      className="dj-browser"
      data-open={b.open ? '1' : '0'}
      data-drop={drop ? '1' : '0'}
      role="dialog"
      aria-label={`Load a track on deck ${b.deck.toUpperCase()}`}
      aria-hidden={!b.open}
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
      <div className="dj-browser-head">
        <p className="dj-browser-title">
          LOAD <span>DECK {b.deck.toUpperCase()}</span>
        </p>
        <button type="button" className="dj-browser-close" aria-label="Close" onClick={() => djBrowser.close()}>
          <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true">
            <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className="dj-browser-tabs" role="tablist">
        {(['audius', 'files'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={tab === t} className="dj-browser-tab" onClick={() => setTab(t)}>
            {t === 'audius' ? 'AUDIUS' : `MY FILES${mine.length ? ` (${mine.length})` : ''}`}
          </button>
        ))}
      </div>
      <div className="dj-browser-tools">
        <input
          className="dj-browser-search"
          type="search"
          placeholder={tab === 'audius' ? 'Search Audius' : 'Search my files'}
          aria-label="Search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
        />
        {tab === 'files' && (
          <>
            <button type="button" className="dj-browser-add" onClick={() => pick.current?.click()}>
              + FILES
            </button>
            <button type="button" className="dj-browser-add" onClick={() => pickDir.current?.click()}>
              + FOLDER
            </button>
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
      {tab === 'files' && <p className="dj-browser-note">Your files stay on this device. Nothing is uploaded.</p>}
      <ul className="dj-browser-list">
        {tab === 'audius' && list === null && <li className="dj-browser-empty">Loading...</li>}
        {shown.length === 0 && (tab === 'files' || list !== null) && (
          <li className="dj-browser-empty">{tab === 'files' ? 'Drop audio files here, or add files or a folder.' : 'No track found.'}</li>
        )}
        {shown.map((t) => (
          <li key={t.id} className="dj-browser-row" aria-current={t.id === loadedId('a') || t.id === loadedId('b') ? 'true' : undefined}>
            <span className="dj-browser-names">
              <span className="dj-browser-name">{t.title}</span>
              <span className="dj-browser-artist">{t.artist}</span>
            </span>
            <span className="dj-browser-meta">
              <span>{t.bpm ? t.bpm.toFixed(0) : '--'}</span>
              <span>{t.key ?? ''}</span>
              <span>{fmtTime(t.duration)}</span>
            </span>
            <span className="dj-browser-decks">
              {(['a', 'b'] as const).map((d) => (
                <button key={d} type="button" aria-label={`Load ${t.title} on deck ${d.toUpperCase()}`} data-target={b.deck === d ? '1' : '0'} onClick={() => load(t, d)}>
                  {d.toUpperCase()}
                </button>
              ))}
            </span>
          </li>
        ))}
      </ul>
      {tab === 'audius' && (
        <p className="dj-browser-credit">
          Tracks from{' '}
          <a href="https://audius.co" target="_blank" rel="noopener noreferrer">
            Audius
          </a>
          , streamed from the artists.
        </p>
      )}
    </div>
  );
};

export default DjBrowser;
