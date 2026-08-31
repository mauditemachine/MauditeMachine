/**
 * /v2/radar — veille musicale dans la DA v2, page dediee (pas une ancre).
 *
 * Reprend les donnees et la mecanique du Radar v1 (public/releases.json,
 * public/following.json, moteur iTunes de src/utils/itunes.ts) avec le
 * player HTML5 v2 : extraits 30 s resolus a la demande, ZERO iframe (le
 * moteur SoundCloud full-track du v1 reste un outil admin). Jamais
 * d'onglet externe ouvert par un play : en cas d'echec la ligne le dit et
 * le lien plateforme reste le seul chemin sortant.
 *
 * Flux : Nouveautes (60 jours glissants) / Archives. Explorateur : clic
 * artiste ou recherche -> dernieres sorties iTunes (albums recents, chips
 * multi-artistes). Annuaire : les 515 artistes + 35 labels suivis,
 * cliquables vers l'explorateur.
 */

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import '../v2.css';
import {
  searchArtist,
  searchLabel,
  resolveTrackPreviewSmart,
  fallbackLinks,
  type ExplorerItem,
  type ExplorerResult,
} from '../../utils/itunes';
import {
  AudioPlayerProvider,
  useAudioPlayer,
  type V2Track,
} from '../context/AudioPlayerContext';
import Cursor from '../components/Cursor';
import StickyPlayer from '../components/StickyPlayer';
import useReveals from '../hooks/useReveals';
import useV2Chrome from '../hooks/useV2Chrome';

const NEWS_WINDOW_DAYS = 60;

interface Release {
  id: number | string;
  artist: string;
  title: string;
  label?: string;
  releaseDate: string;
  genre?: string;
  format?: string;
  link?: string;
  cover?: string;
  publishedRadar?: boolean;
}

interface Following {
  artists: string[];
  labels: string[];
  topLabels?: string[];
}

const fmtDate = (iso: string) => {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
    .toUpperCase();
};

/** Cover locale : les chemins du JSON sont relatifs a public/. */
const coverSrc = (r: Release) => (r.cover ? `/${r.cover.replace(/^\//, '')}` : null);

const RadarShell: React.FC = () => {
  useV2Chrome('Maudite Machine — Radar');
  const rootRef = useRef<HTMLDivElement>(null);
  useReveals(rootRef);
  const { current, playing, play } = useAudioPlayer();

  const [releases, setReleases] = useState<Release[] | null>(null);
  const [following, setFollowing] = useState<Following | null>(null);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [failedIds, setFailedIds] = useState<Set<string>>(new Set());
  const resolvedRef = useRef(new Map<string, V2Track>());

  const [query, setQuery] = useState('');
  const [dirOpen, setDirOpen] = useState(false);
  const [explorer, setExplorer] = useState<{
    q: string;
    kind: 'artist' | 'label';
    loading: boolean;
    res: ExplorerResult | null;
  } | null>(null);
  const explorerRef = useRef<HTMLDivElement>(null);

  // La page monte en haut (le router conserve le scroll de la landing)
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'instant' as ScrollBehavior });
  }, []);

  useEffect(() => {
    let alive = true;
    fetch('/releases.json')
      .then((r) => r.json())
      .then((data) => {
        if (!alive) return;
        const list: Release[] = Array.isArray(data) ? data : data.releases || [];
        setReleases(list.filter((r) => r.publishedRadar !== false));
      })
      .catch(() => alive && setReleases([]));
    fetch('/following.json')
      .then((r) => r.json())
      .then((data) => alive && setFollowing(data))
      .catch(() => alive && setFollowing({ artists: [], labels: [] }));
    return () => {
      alive = false;
    };
  }, []);

  const { news, archives } = useMemo(() => {
    const list = [...(releases || [])].sort(
      (a, b) => +new Date(b.releaseDate) - +new Date(a.releaseDate)
    );
    const cutoff = Date.now() - NEWS_WINDOW_DAYS * 24 * 3600 * 1000;
    return {
      news: list.filter((r) => +new Date(r.releaseDate) >= cutoff),
      archives: list.filter((r) => +new Date(r.releaseDate) < cutoff),
    };
  }, [releases]);

  /** Play d'une release du flux : resolution smart au premier clic, cache ensuite. */
  const playRelease = useCallback(
    async (r: Release) => {
      const id = `radar-${r.id}`;
      const cached = resolvedRef.current.get(id);
      if (cached) {
        play(cached, [cached]);
        return;
      }
      if (resolvingId) return;
      setResolvingId(id);
      try {
        const url = await resolveTrackPreviewSmart(r.artist, r.title);
        if (url) {
          const track: V2Track = {
            id,
            title: r.title,
            artist: r.artist,
            project: r.label || r.artist,
            role: 'Preview',
            year: Number(r.releaseDate.slice(0, 4)) || 0,
            category: 'originals',
            audio: url,
            link: r.link || fallbackLinks(r.artist)[0].url,
          };
          resolvedRef.current.set(id, track);
          play(track, [track]);
        } else {
          setFailedIds((s) => new Set(s).add(id));
        }
      } finally {
        setResolvingId(null);
      }
    },
    [play, resolvingId]
  );

  /** Play d'un item de l'explorateur (song: preview directe, album: resolution). */
  const playItem = useCallback(
    async (item: ExplorerItem) => {
      const id = `radar-x-${item.id}`;
      const mk = (url: string): V2Track => ({
        id,
        title: item.title,
        artist: item.artist,
        project: item.album || item.artist,
        role: 'Preview',
        year: Number(item.date.slice(0, 4)) || 0,
        category: 'originals',
        audio: url,
        link: item.storeUrl || fallbackLinks(item.artist)[0].url,
      });
      const cached = resolvedRef.current.get(id);
      if (cached) {
        play(cached, [cached]);
        return;
      }
      if (item.previewUrl) {
        const track = mk(item.previewUrl);
        resolvedRef.current.set(id, track);
        play(track, [track]);
        return;
      }
      if (resolvingId) return;
      setResolvingId(id);
      try {
        const url = await resolveTrackPreviewSmart(item.artist, item.title);
        if (url) {
          const track = mk(url);
          resolvedRef.current.set(id, track);
          play(track, [track]);
        } else {
          setFailedIds((s) => new Set(s).add(id));
        }
      } finally {
        setResolvingId(null);
      }
    },
    [play, resolvingId]
  );

  const openExplorer = useCallback((q: string, kind: 'artist' | 'label') => {
    const name = q.trim();
    if (!name) return;
    setExplorer({ q: name, kind, loading: true, res: null });
    const search = kind === 'artist' ? searchArtist : searchLabel;
    search(name).then(
      (res) => {
        setExplorer((cur) =>
          cur && cur.q === name ? { ...cur, loading: false, res } : cur
        );
        // Amene le panneau en vue (sous le header en desktop)
        requestAnimationFrame(() => {
          explorerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        });
      },
      () => {
        setExplorer((cur) => (cur && cur.q === name ? { ...cur, loading: false, res: null } : cur));
      }
    );
  }, []);

  const renderRow = (r: Release) => {
    const id = `radar-${r.id}`;
    const isCurrent = current?.id === id;
    const isResolving = resolvingId === id;
    const hasFailed = failedIds.has(id);
    const cover = coverSrc(r);
    return (
      <div key={id} className={`v2-radar-row${isCurrent ? ' is-playing' : ''}`} role="row">
        {cover ? (
          <img className="v2-radar-cover" src={cover} alt="" loading="lazy" decoding="async" />
        ) : (
          <span className="v2-radar-cover v2-radar-cover-empty" aria-hidden="true" />
        )}
        <span className="v2-radar-main" role="cell">
          <button
            type="button"
            className="v2-radar-artist"
            onClick={() => openExplorer(r.artist, 'artist')}
            title="Explorer cet artiste"
          >
            {r.artist}
          </button>
          <span className="v2-radar-title">{r.title}</span>
          {hasFailed && <span className="v2-label v2-radar-noprev">No preview found</span>}
        </span>
        {r.label && (
          <button
            type="button"
            className="v2-label v2-radar-label"
            role="cell"
            onClick={() => openExplorer(r.label as string, 'label')}
            title="Explorer ce label"
          >
            {r.label}
          </button>
        )}
        <span className="v2-label v2-radar-date" role="cell">
          {fmtDate(r.releaseDate)}
        </span>
        <span className="v2-matrix-actions" role="cell">
          <button
            type="button"
            className={`v2-play-btn${isResolving ? ' is-loading' : ''}`}
            aria-label={
              isCurrent && playing ? `Mettre en pause ${r.title}` : `Écouter un extrait de ${r.title}`
            }
            disabled={isResolving}
            onClick={() => playRelease(r)}
          >
            {isResolving ? (
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" className="v2-spin">
                <circle
                  cx="8"
                  cy="8"
                  r="6"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.6"
                  strokeDasharray="26 12"
                />
              </svg>
            ) : isCurrent && playing ? (
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <rect x="2" y="2" width="4" height="12" fill="currentColor" />
                <rect x="10" y="2" width="4" height="12" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path d="M3 2l11 6-11 6z" fill="currentColor" />
              </svg>
            )}
          </button>
          {r.link && (
            <a
              className="v2-link-btn"
              href={r.link}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ouvrir ${r.title} sur la plateforme`}
            >
              <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                <path d="M6 3h7v7M13 3L7 9" stroke="currentColor" strokeWidth="1.6" fill="none" />
                <path d="M11 9v4H3V5h4" stroke="currentColor" strokeWidth="1.4" fill="none" />
              </svg>
            </a>
          )}
        </span>
      </div>
    );
  };

  const renderExplorerItem = (item: ExplorerItem) => {
    const id = `radar-x-${item.id}`;
    const isCurrent = current?.id === id;
    const isResolving = resolvingId === id;
    const hasFailed = failedIds.has(id);
    return (
      <div key={`${item.kind}-${item.id}`} className={`v2-radar-xitem${isCurrent ? ' is-playing' : ''}`}>
        {item.artwork ? (
          <img className="v2-radar-cover" src={item.artwork} alt="" loading="lazy" />
        ) : (
          <span className="v2-radar-cover v2-radar-cover-empty" aria-hidden="true" />
        )}
        <span className="v2-radar-main">
          <span className="v2-radar-artist-static">{item.artist}</span>
          <span className="v2-radar-title">
            {item.title}
            {item.kind === 'album' ? ' — album' : ''}
          </span>
          {hasFailed && <span className="v2-label v2-radar-noprev">No preview found</span>}
        </span>
        <span className="v2-label v2-radar-date">{item.date?.slice(0, 4)}</span>
        <span className="v2-matrix-actions">
          <button
            type="button"
            className="v2-play-btn"
            aria-label={`Écouter un extrait de ${item.title}`}
            disabled={isResolving}
            onClick={() => playItem(item)}
          >
            {isResolving ? (
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true" className="v2-spin">
                <circle cx="8" cy="8" r="6" fill="none" stroke="currentColor" strokeWidth="1.6" strokeDasharray="26 12" />
              </svg>
            ) : isCurrent && playing ? (
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <rect x="2" y="2" width="4" height="12" fill="currentColor" />
                <rect x="10" y="2" width="4" height="12" fill="currentColor" />
              </svg>
            ) : (
              <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                <path d="M3 2l11 6-11 6z" fill="currentColor" />
              </svg>
            )}
          </button>
          {item.storeUrl && (
            <a
              className="v2-link-btn"
              href={item.storeUrl}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={`Ouvrir ${item.title} sur la plateforme`}
            >
              <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                <path d="M6 3h7v7M13 3L7 9" stroke="currentColor" strokeWidth="1.6" fill="none" />
                <path d="M11 9v4H3V5h4" stroke="currentColor" strokeWidth="1.4" fill="none" />
              </svg>
            </a>
          )}
        </span>
      </div>
    );
  };

  return (
    <div ref={rootRef} className={`v2-root${current ? ' has-player' : ''}`}>
      <Cursor />

      <header className="v2-radar-top">
        <Link className="v2-label v2-radar-back" to="/v2">
          ← Back to site
        </Link>
        <div className="v2-section-head" style={{ marginBottom: 0 }}>
          <h1 className="v2-section-title">Radar</h1>
          <span className="v2-label">Curated releases &amp; discoveries</span>
        </div>
      </header>

      <section className="v2-section v2-radar-body">
        {/* Recherche + annuaire */}
        <div className="v2-radar-tools">
          <input
            type="search"
            className="v2-radar-search"
            placeholder="Search an artist or label…"
            aria-label="Rechercher un artiste ou un label"
            list="v2-radar-dir"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                const isLabel = !!following?.labels.some(
                  (l) => l.toLowerCase() === query.trim().toLowerCase()
                );
                openExplorer(query, isLabel ? 'label' : 'artist');
              }
            }}
          />
          <datalist id="v2-radar-dir">
            {(following?.artists || []).map((a) => (
              <option key={`a-${a}`} value={a} />
            ))}
            {(following?.labels || []).map((l) => (
              <option key={`l-${l}`} value={l} />
            ))}
          </datalist>
          <button
            type="button"
            className="v2-filter"
            onClick={() => {
              const q = query.trim();
              if (q) {
                const isLabel = !!following?.labels.some(
                  (l) => l.toLowerCase() === q.toLowerCase()
                );
                openExplorer(q, isLabel ? 'label' : 'artist');
              }
            }}
          >
            Search
          </button>
          <button
            type="button"
            className={`v2-filter${dirOpen ? ' is-active' : ''}`}
            aria-expanded={dirOpen}
            onClick={() => setDirOpen((o) => !o)}
          >
            Following · {(following?.artists.length || 0) + (following?.labels.length || 0)}
          </button>
        </div>

        {dirOpen && following && (
          <div className="v2-radar-dirpanel">
            {following.labels.length > 0 && (
              <>
                <span className="v2-label">Labels · {following.labels.length}</span>
                <div className="v2-radar-chips">
                  {following.labels.map((l) => (
                    <button
                      key={l}
                      type="button"
                      className="v2-chip"
                      onClick={() => openExplorer(l, 'label')}
                    >
                      {l}
                    </button>
                  ))}
                </div>
              </>
            )}
            <span className="v2-label">Artists · {following.artists.length}</span>
            <div className="v2-radar-chips v2-radar-chips-scroll">
              {following.artists.map((a) => (
                <button
                  key={a}
                  type="button"
                  className="v2-chip"
                  onClick={() => openExplorer(a, 'artist')}
                >
                  {a}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Explorateur */}
        {explorer && (
          <div ref={explorerRef} className="v2-radar-explorer" aria-live="polite">
            <div className="v2-radar-explorer-head">
              <span className="v2-subtitle" style={{ fontSize: 15 }}>
                {explorer.res?.resolvedArtist || explorer.q}
              </span>
              <span className="v2-label">
                {explorer.loading
                  ? 'Searching…'
                  : `${explorer.res?.items.length || 0} recent release${(explorer.res?.items.length || 0) > 1 ? 's' : ''}${explorer.res?.approximate ? ' · approximate' : ''}`}
              </span>
              <button
                type="button"
                className="v2-player-btn"
                aria-label="Fermer l'explorateur"
                onClick={() => setExplorer(null)}
              >
                <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                  <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" />
                </svg>
              </button>
            </div>

            {(explorer.res?.otherArtists?.length || 0) > 0 && (
              <div className="v2-radar-chips">
                {explorer.res!.otherArtists!.map((a) => (
                  <button
                    key={a}
                    type="button"
                    className="v2-chip"
                    onClick={() => openExplorer(a, 'artist')}
                  >
                    Also: {a}
                  </button>
                ))}
              </div>
            )}

            {!explorer.loading && (explorer.res?.items.length || 0) === 0 && (
              <div className="v2-radar-xempty">
                <span className="v2-label">Nothing on iTunes — try elsewhere:</span>
                <div className="v2-radar-chips">
                  {fallbackLinks(explorer.q).map((f) => (
                    <a
                      key={f.name}
                      className="v2-chip"
                      href={f.url}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      {f.name} ↗
                    </a>
                  ))}
                </div>
              </div>
            )}

            <div className="v2-radar-xlist">
              {(explorer.res?.items || []).map(renderExplorerItem)}
            </div>
          </div>
        )}

        {/* Flux */}
        <div className="v2-section-head" style={{ marginTop: 42 }}>
          <h2 className="v2-section-title" style={{ fontSize: 'clamp(22px, 3vw, 34px)' }}>
            New
          </h2>
          <span className="v2-label">Last {NEWS_WINDOW_DAYS} days · {news.length}</span>
        </div>
        <div className="v2-radar-list" role="table" aria-label="Nouveautés">
          {releases === null && <p className="v2-label">Loading…</p>}
          {releases !== null && news.length === 0 && (
            <p className="v2-label">Quiet weeks — check the archives below.</p>
          )}
          {news.map(renderRow)}
        </div>

        {archives.length > 0 && (
          <>
            <div className="v2-section-head" style={{ marginTop: 56 }}>
              <h2 className="v2-section-title" style={{ fontSize: 'clamp(22px, 3vw, 34px)' }}>
                Archives
              </h2>
              <span className="v2-label">{archives.length}</span>
            </div>
            <div className="v2-radar-list" role="table" aria-label="Archives">
              {archives.map(renderRow)}
            </div>
          </>
        )}

        <p className="v2-label v2-matrix-note">
          30-second previews via iTunes. Full releases on the linked platforms.
        </p>
      </section>

      <StickyPlayer />
    </div>
  );
};

const RadarPage: React.FC = () => (
  <AudioPlayerProvider>
    <RadarShell />
  </AudioPlayerProvider>
);

export default RadarPage;
