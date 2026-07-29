/**
 * RadarPage v3 — tableau de bord musical : flux dense + explorateur + lecteur.
 *
 * Desktop : deux colonnes. A gauche le flux des sorties (releases.json, lignes
 * fines), la recherche d'artistes suivis (autocompletion sur following.json)
 * et les 20 labels qui comptent (topLabels). A droite l'explorateur : les
 * dernieres sorties iTunes du nom clique, avec un extrait 30 s par piste.
 * Mobile : l'explorateur s'ouvre en bottom sheet.
 *
 * Lecteur global : une barre fine en bas de page, un seul <audio> natif.
 * Pieges connus respectes : `.page > * { position: relative }` ecrase le
 * `fixed` de Tailwind, donc tout element fixe passe par du style inline.
 * Le lecteur SoundCloud du site remonte (body.radar-audio-open) et se met en
 * pause quand un extrait Radar demarre (event mm:radar-play).
 *
 * Perf : rien n'est fetche vers iTunes avant une interaction. Le flux
 * s'affiche des le chargement comme avant.
 */

import React, { useEffect, useMemo, useRef, useState } from 'react';
import { loadReleases, type Release } from '../utils/adminApi';
import {
  searchArtist,
  searchLabel,
  resolveAlbumPreview,
  resolveTrackPreview,
  fallbackLinks,
  type ExplorerItem,
  type ExplorerResult,
} from '../utils/itunes';
import { useTranslation } from '../lib/i18n';
import { cn } from '../lib/cn';
import '../styles/radar.css';

/** Locales Intl par langue du site. */
const DATE_LOCALE: Record<string, string> = { fr: 'fr-CA', en: 'en-CA', es: 'es-ES' };

/** Fenetre "Nouveautes" : 60 jours glissants. */
const NEWS_WINDOW_DAYS = 60;

interface Following {
  artists: string[];
  labels: string[];
  topLabels: string[];
}

type ExplorerState = {
  type: 'artist' | 'label';
  name: string;
  status: 'loading' | 'done' | 'error';
  result?: ExplorerResult;
};

type PlayerTrack = { title: string; artist: string; previewUrl: string };
type PlayerState = {
  track: PlayerTrack | null;
  status: 'idle' | 'loading' | 'playing' | 'paused' | 'error';
};

/**
 * Initiales affichees sur les vignettes sans image.
 * Retire un prefixe "V/A -" puis prend la 1re lettre des 2 premiers mots.
 */
export function initials(name: string): string {
  const clean = (name || '')
    .replace(/^\s*V\s*\/\s*A\s*[-–—:]*\s*/i, '')
    .trim();
  const words = clean.split(/\s+/).filter((w) => /[\p{L}\p{N}]/u.test(w));
  return words
    .slice(0, 2)
    .map((w) => {
      const first = Array.from(w).find((c) => /[\p{L}\p{N}]/u.test(c));
      return first ? first.toUpperCase() : '';
    })
    .join('');
}

/** Normalisation pour l'autocompletion : casse et accents ignores. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const PauseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </svg>
);
const ArrowIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M7 17L17 7M17 7H8M17 7v9" />
  </svg>
);
const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <span className={cn('inline-block w-4 h-4 rounded-full border-2 border-white/20 border-t-white/80 animate-spin', className)} aria-hidden="true" />
);

const RadarPage: React.FC = () => {
  const { t, lang } = useTranslation();
  const r = t.radar;

  const [releases, setReleases] = useState<Release[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [following, setFollowing] = useState<Following>({ artists: [], labels: [], topLabels: [] });

  const [explorer, setExplorer] = useState<ExplorerState | null>(null);
  const [player, setPlayer] = useState<PlayerState>({ track: null, status: 'idle' });
  /** Id de la ligne du flux en cours de resolution iTunes (spinner local). */
  const [resolvingRow, setResolvingRow] = useState<number | null>(null);

  const [query, setQuery] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState(0);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.9);

  useEffect(() => {
    let cancelled = false;
    loadReleases()
      .then((data) => {
        if (cancelled) return;
        setReleases(
          data
            .filter((rel) => rel.publishedRadar !== false)
            .sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || '')),
        );
      })
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setLoaded(true);
      });

    fetch(`/following.json?t=${Date.now()}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (cancelled || !data) return;
        setFollowing({
          artists: Array.isArray(data.artists) ? data.artists : [],
          labels: Array.isArray(data.labels) ? data.labels : [],
          topLabels: Array.isArray(data.topLabels) ? data.topLabels : [],
        });
      })
      .catch(() => {});

    return () => {
      cancelled = true;
    };
  }, []);

  // Le lecteur SoundCloud du site remonte quand la barre Radar est visible
  useEffect(() => {
    if (player.track) document.body.classList.add('radar-audio-open');
    else document.body.classList.remove('radar-audio-open');
    return () => document.body.classList.remove('radar-audio-open');
  }, [player.track]);

  const locale = DATE_LOCALE[lang] || 'en-CA';
  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // ----- Lecteur -----

  const playPreview = (track: PlayerTrack) => {
    const audio = audioRef.current;
    if (!audio) return;
    window.dispatchEvent(new CustomEvent('mm:radar-play'));
    setPlayer({ track, status: 'loading' });
    setProgress(0);
    audio.src = track.previewUrl;
    audio.volume = volume;
    audio.play().catch(() => setPlayer({ track, status: 'error' }));
  };

  const togglePlayer = () => {
    const audio = audioRef.current;
    if (!audio || !player.track) return;
    if (player.status === 'playing') {
      audio.pause();
    } else if (player.status === 'paused') {
      window.dispatchEvent(new CustomEvent('mm:radar-play'));
      audio.play().catch(() => setPlayer((p) => ({ ...p, status: 'error' })));
    } else if (player.status === 'error') {
      playPreview(player.track);
    }
  };

  const closePlayer = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
    }
    setPlayer({ track: null, status: 'idle' });
    setProgress(0);
  };

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const audio = audioRef.current;
    if (!audio || !audio.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    audio.currentTime = ((e.clientX - rect.left) / rect.width) * audio.duration;
  };

  /** Play depuis une ligne du flux : resolution iTunes, sinon lien externe. */
  const playFromRow = async (rel: Release) => {
    setResolvingRow(rel.id);
    try {
      const previewUrl = await resolveTrackPreview(rel.artist, rel.title);
      if (previewUrl) {
        playPreview({ title: rel.title, artist: rel.artist, previewUrl });
      } else if (rel.link) {
        // Fallback honnete : pas d'extrait connu, on ouvre la page de la sortie
        window.open(rel.link, '_blank', 'noopener');
      }
    } finally {
      setResolvingRow(null);
    }
  };

  /** Play depuis l'explorateur (morceau direct ou album a resoudre). */
  const playFromExplorer = async (item: ExplorerItem) => {
    if (item.previewUrl) {
      playPreview({ title: item.title, artist: item.artist, previewUrl: item.previewUrl });
      return;
    }
    if (item.collectionId) {
      setPlayer({ track: { title: item.title, artist: item.artist, previewUrl: '' }, status: 'loading' });
      const previewUrl = await resolveAlbumPreview(item.collectionId);
      if (previewUrl) playPreview({ title: item.title, artist: item.artist, previewUrl });
      else if (item.storeUrl) {
        setPlayer({ track: null, status: 'idle' });
        window.open(item.storeUrl, '_blank', 'noopener');
      } else {
        setPlayer((p) => (p.track?.title === item.title ? { ...p, status: 'error' } : p));
      }
    }
  };

  // ----- Explorateur -----

  const openExplorer = (type: 'artist' | 'label', name: string) => {
    setExplorer({ type, name, status: 'loading' });
    const search = type === 'artist' ? searchArtist : searchLabel;
    search(name)
      .then((result) => {
        setExplorer((cur) =>
          cur && cur.name === name && cur.type === type ? { ...cur, status: 'done', result } : cur,
        );
      })
      .catch(() => {
        setExplorer((cur) =>
          cur && cur.name === name && cur.type === type ? { ...cur, status: 'error' } : cur,
        );
      });
  };

  const closeExplorer = () => setExplorer(null);

  // ----- Donnees du flux -----

  const cutoff = new Date(Date.now() - NEWS_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const news = releases.filter((rel) => (rel.releaseDate || '') >= cutoff);
  const archives = releases.filter((rel) => (rel.releaseDate || '') < cutoff);
  const archiveYears = Array.from(
    archives.reduce((map, rel) => {
      const year = Number((rel.releaseDate || '').slice(0, 4)) || 0;
      if (!map.has(year)) map.set(year, []);
      map.get(year)!.push(rel);
      return map;
    }, new Map<number, Release[]>()),
  )
    .map(([year, items]) => ({
      year,
      items: items.sort((a, b) => (b.releaseDate || '').localeCompare(a.releaseDate || '')),
    }))
    .sort((a, b) => b.year - a.year);

  const releasesWord = (n: number) => (n > 1 ? r.releasesPlural : r.releasesSingular);

  // ----- Autocompletion artistes -----

  const suggestions = useMemo(() => {
    const q = norm(query.trim());
    if (q.length < 2) return [];
    const starts: string[] = [];
    const contains: string[] = [];
    for (const name of following.artists) {
      const n = norm(name);
      if (n.startsWith(q)) starts.push(name);
      else if (n.includes(q)) contains.push(name);
    }
    return [...starts, ...contains].slice(0, 8);
  }, [query, following.artists]);

  const pickSuggestion = (name: string) => {
    setQuery(name);
    setSuggestOpen(false);
    openExplorer('artist', name);
  };

  const onSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (!suggestOpen || suggestions.length === 0) return;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActiveSuggest((i) => (i + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActiveSuggest((i) => (i - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter') {
      e.preventDefault();
      pickSuggestion(suggestions[activeSuggest] || suggestions[0]);
    } else if (e.key === 'Escape') {
      setSuggestOpen(false);
    }
  };

  // ----- Rendus -----

  /** Ligne fine du flux : cover 40px, artiste + titre sur une ligne. */
  const renderRow = (rel: Release) => {
    const cover = String(rel.cover || '').trim();
    const coverSrc = cover
      ? /^https?:\/\//.test(cover)
        ? cover
        : `/${cover.replace(/^\//, '')}`
      : null;
    const resolving = resolvingRow === rel.id;

    return (
      <div
        key={rel.id}
        className="group flex items-center gap-3 h-12 px-2 -mx-2 rounded-lg hover:bg-white/[0.03] transition-colors min-w-0"
      >
        {/* Cover 40px : bouton play au hover */}
        <button
          type="button"
          onClick={() => playFromRow(rel)}
          aria-label={`${r.listen} : ${rel.artist}, ${rel.title}`}
          className="relative shrink-0 w-10 h-10 rounded overflow-hidden border-0 p-0 cursor-pointer bg-transparent"
          style={
            coverSrc
              ? undefined
              : { background: `linear-gradient(150deg, ${rel.colorFrom || '#242427'}, ${rel.colorTo || '#0a0a0a'})` }
          }
        >
          {coverSrc ? (
            <img src={coverSrc} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full flex items-center justify-center font-display font-black text-white/90 text-xs">
              {initials(rel.artist)}
            </span>
          )}
          <span
            className={cn(
              'absolute inset-0 flex items-center justify-center bg-black/55 transition-opacity',
              resolving ? 'opacity-100' : 'opacity-0 group-hover:opacity-100',
            )}
          >
            {resolving ? <Spinner /> : <PlayIcon className="w-4 h-4 text-white" />}
          </span>
        </button>

        {/* Artiste (ouvre l'explorateur) + titre, une seule ligne */}
        <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden whitespace-nowrap">
          {rel.favorite && (
            <span className="radar-pick-bg shrink-0 inline-block w-1.5 h-1.5 rounded-full" title={r.badgeFavorite} />
          )}
          <button
            type="button"
            onClick={() => openExplorer('artist', rel.artist)}
            className="shrink-0 font-body font-bold text-ink-95 text-sm md:text-base leading-tight bg-transparent border-0 p-0 cursor-pointer hover:text-white hover:underline underline-offset-2 transition-colors"
          >
            {rel.artist}
          </button>
          <span className="truncate font-body text-white/50 text-xs md:text-sm">{rel.title}</span>
        </div>

        {/* Label + date, a droite en petit */}
        <div className="shrink-0 text-right leading-tight hidden sm:block">
          {rel.label && <div className="radar-label-tag font-body text-[11px]">{rel.label}</div>}
          <div className="font-body text-[11px] text-white/40">{formatDate(rel.releaseDate)}</div>
        </div>
        <div className="shrink-0 sm:hidden font-body text-[11px] text-white/40">
          {formatDate(rel.releaseDate)}
        </div>

        {rel.link && (
          <a
            href={rel.link}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`${rel.artist}, ${rel.title} (${rel.label})`}
            className="shrink-0 text-white/25 hover:text-white transition-colors"
          >
            <ArrowIcon className="w-4 h-4" />
          </a>
        )}
      </div>
    );
  };

  /** Contenu de l'explorateur, partage entre colonne droite et bottom sheet. */
  const explorerContent = explorer && (
    <div className="pk-glass rounded-2xl md:rounded-3xl p-4 md:p-6">
      <div className="flex items-center justify-between gap-3 mb-1">
        <div className="min-w-0">
          <span className="font-body text-[11px] text-white/40">
            {explorer.type === 'artist' ? r.artistTag : r.labelTag}
          </span>
          <div className="font-body font-extrabold text-white text-base md:text-lg leading-tight truncate">
            {explorer.name}
          </div>
        </div>
        <button
          type="button"
          onClick={closeExplorer}
          aria-label={r.close}
          className="shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white hover:border-white/30 cursor-pointer text-base leading-none"
        >
          ×
        </button>
      </div>

      {explorer.status === 'loading' && (
        <div className="flex items-center gap-3 py-8 text-white/50 font-body text-sm">
          <Spinner /> {r.explorerLoading}
        </div>
      )}

      {explorer.status === 'error' && (
        <p className="py-6 text-white/50 font-body text-sm m-0">{r.explorerError}</p>
      )}

      {explorer.status === 'done' && explorer.result && (
        <>
          {explorer.result.approximate && explorer.result.items.length > 0 && (
            <p className="font-body text-xs text-white/40 mt-1 mb-2">{r.explorerApprox}</p>
          )}

          {explorer.result.items.length > 0 ? (
            <div className="divide-y divide-white/5 mt-2">
              {explorer.result.items.map((item) => {
                const playable = !!item.previewUrl || !!item.collectionId;
                return (
                  <div key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-2.5 min-w-0">
                    <img
                      src={item.artwork}
                      alt=""
                      loading="lazy"
                      className="shrink-0 w-12 h-12 rounded object-cover bg-white/5"
                    />
                    <div className="flex-1 min-w-0">
                      <div className="font-body font-semibold text-ink-95 text-sm leading-tight truncate">
                        {item.title}
                      </div>
                      <div className="font-body text-xs text-white/45 leading-tight truncate mt-0.5">
                        {explorer.type === 'label' ? item.artist : item.album}
                      </div>
                      <div className="font-body text-[11px] text-white/35 mt-0.5">{formatDate(item.date)}</div>
                    </div>
                    {playable && (
                      <button
                        type="button"
                        onClick={() => playFromExplorer(item)}
                        aria-label={`${r.listen} : ${item.artist}, ${item.title}`}
                        className="shrink-0 w-9 h-9 rounded-full bg-white/8 border border-white/15 text-white/80 hover:text-white hover:border-white/40 cursor-pointer flex items-center justify-center transition-colors"
                      >
                        <PlayIcon className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="py-4">
              <p className="font-body text-sm text-white/55 m-0 mb-3">{r.explorerNone}</p>
              <p className="font-body text-xs text-white/40 m-0 mb-2">{r.explorerElsewhere}</p>
              <div className="flex flex-wrap gap-2">
                {fallbackLinks(explorer.name).map((l) => (
                  <a
                    key={l.site}
                    href={l.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="font-body text-xs text-white/70 border border-white/10 rounded-full px-3 py-1 no-underline hover:text-white hover:border-white/40 transition-colors"
                  >
                    {l.site} ↗
                  </a>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );

  return (
    <section
      className="radar-page pt-24 pb-32 py-20 md:py-32 px-4 md:px-10 max-w-7xl mx-auto w-full"
      style={player.track ? { paddingBottom: 120 } : undefined}
    >
      <h1 className="sr-only">{t.headings.radar}</h1>

      <p className="font-body text-sm md:text-base text-white/60 leading-relaxed max-w-2xl mb-8 md:mb-12 animate-fade-up">
        {r.subtitle}
      </p>

      <div className="lg:grid lg:grid-cols-[minmax(0,3fr)_minmax(0,2fr)] lg:gap-8 items-start">
        {/* ================= COLONNE GAUCHE ================= */}
        <div className="min-w-0">
          {/* Flux : nouveautes */}
          <div className="flex items-baseline justify-between mb-4 md:mb-6">
            <div className="text-base md:text-lg font-extrabold text-white font-body">{r.sectionNews}</div>
            <div className="text-sm font-bold text-white/60 font-body">
              {news.length} {releasesWord(news.length)}
            </div>
          </div>

          {news.length > 0 ? (
            <div className="pk-glass rounded-2xl p-3 md:p-4">
              <div className="divide-y divide-white/5">{news.map((rel) => renderRow(rel))}</div>
            </div>
          ) : (
            <p className="font-body text-white/50">{loaded ? r.emptyNews : r.loading}</p>
          )}

          {/* Flux : archives par annee */}
          {archives.length > 0 && (
            <div className="mt-10 md:mt-14">
              <div className="flex items-baseline justify-between mb-4 md:mb-6">
                <div className="text-base md:text-lg font-extrabold text-white font-body">
                  {r.sectionArchives}
                </div>
                <div className="text-sm font-bold text-white/60 font-body">
                  {archiveYears[archiveYears.length - 1]?.year} / {archiveYears[0]?.year}
                </div>
              </div>
              <div className="pk-glass rounded-2xl p-3 md:p-4">
                {archiveYears.map((row) => (
                  <div key={row.year} className="py-2 first:pt-0 last:pb-0">
                    <div className="font-display font-black text-ink-95 text-2xl md:text-3xl leading-none tracking-[-0.02em] mb-1 px-2 -mx-2">
                      {row.year}
                    </div>
                    <div className="divide-y divide-white/5">{row.items.map((rel) => renderRow(rel))}</div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Boite artistes suivis : recherche seule, pas de liste */}
          <div className="mt-10 md:mt-14 pk-glass rounded-2xl p-4 md:p-6">
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-base md:text-lg font-extrabold text-white font-body">
                {r.followingArtists}
              </div>
              <div className="text-sm font-bold text-white/60 font-body">
                {following.artists.length} {r.artistsWord}
              </div>
            </div>
            <div className="relative">
              <input
                type="search"
                value={query}
                onChange={(e) => {
                  setQuery(e.target.value);
                  setSuggestOpen(true);
                  setActiveSuggest(0);
                }}
                onFocus={() => setSuggestOpen(true)}
                onBlur={() => setTimeout(() => setSuggestOpen(false), 150)}
                onKeyDown={onSearchKeyDown}
                placeholder={r.searchArtistPlaceholder}
                aria-label={r.searchArtistPlaceholder}
                role="combobox"
                aria-expanded={suggestOpen && suggestions.length > 0}
                className="w-full font-body text-sm md:text-base text-white bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none placeholder:text-white/40 focus:border-white/30 transition-colors"
              />
              {suggestOpen && query.trim().length >= 2 && (
                <ul className="absolute left-0 right-0 top-full mt-2 z-30 m-0 p-1 list-none rounded-xl border border-white/10 bg-[#111113] shadow-[0_12px_40px_rgba(0,0,0,0.6)] max-h-72 overflow-y-auto custom-scrollbar">
                  {suggestions.length > 0 ? (
                    suggestions.map((name, i) => (
                      <li key={name}>
                        <button
                          type="button"
                          onMouseDown={(e) => {
                            e.preventDefault();
                            pickSuggestion(name);
                          }}
                          onMouseEnter={() => setActiveSuggest(i)}
                          className={cn(
                            'w-full text-left font-body text-sm text-white/80 rounded-lg px-3 py-2 border-0 cursor-pointer transition-colors',
                            i === activeSuggest ? 'bg-white/10 text-white' : 'bg-transparent hover:bg-white/5',
                          )}
                        >
                          {name}
                        </button>
                      </li>
                    ))
                  ) : (
                    <li className="font-body text-sm text-white/45 px-3 py-2">{r.noSuggestion}</li>
                  )}
                </ul>
              )}
            </div>
          </div>

          {/* Boite labels qui comptent */}
          <div className="mt-6 pk-glass rounded-2xl p-4 md:p-6">
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-base md:text-lg font-extrabold text-white font-body">{r.topLabelsTitle}</div>
              <div className="text-sm font-bold text-white/60 font-body">{following.topLabels.length}</div>
            </div>
            <div className="flex flex-wrap gap-2">
              {following.topLabels.map((name) => (
                <button
                  key={name}
                  type="button"
                  onClick={() => openExplorer('label', name)}
                  className={cn(
                    'font-body text-xs md:text-sm border rounded-full px-3 py-1 cursor-pointer transition-colors',
                    explorer?.type === 'label' && explorer.name === name
                      ? 'text-white border-white/50 bg-white/10'
                      : 'text-white/70 border-white/10 bg-transparent hover:text-white hover:border-white/40 hover:bg-white/[0.04]',
                  )}
                >
                  {name}
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* ================= COLONNE DROITE (desktop) ================= */}
        <aside className="hidden lg:block lg:sticky lg:top-24 min-w-0 max-h-[calc(100vh-8rem)] overflow-y-auto custom-scrollbar">
          {explorer ? (
            explorerContent
          ) : (
            <div className="pk-glass rounded-2xl md:rounded-3xl p-6 text-center">
              <p className="font-body text-sm text-white/50 leading-relaxed m-0">{r.explorerInvite}</p>
            </div>
          )}
        </aside>
      </div>

      {/* ================= EXPLORATEUR MOBILE : bottom sheet ================= */}
      {explorer && (
        <div className="lg:hidden" role="dialog" aria-label={explorer.name}>
          <div
            style={{ position: 'fixed', inset: 0, zIndex: 70 }}
            className="bg-black/60"
            onClick={closeExplorer}
          />
          <div
            style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 71 }}
            className="max-h-[75vh] overflow-y-auto custom-scrollbar rounded-t-2xl bg-[#0f0f10] border-t border-white/10 p-3 pb-6"
          >
            {explorerContent}
          </div>
        </div>
      )}

      {/* ================= LECTEUR GLOBAL ================= */}
      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => setPlayer((p) => (p.track ? { ...p, status: 'playing' } : p))}
        onPause={() => setPlayer((p) => (p.track && p.status !== 'error' ? { ...p, status: 'paused' } : p))}
        onEnded={() => setProgress(0)}
        onError={() => setPlayer((p) => (p.track ? { ...p, status: 'error' } : p))}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (a && a.duration) setProgress(a.currentTime / a.duration);
        }}
      />
      {player.track && (
        <div
          style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 80 }}
          className="bg-[#0a0a0a]/95 backdrop-blur-xl border-t border-white/10"
        >
          <div className="max-w-7xl mx-auto px-4 md:px-10 h-[60px] flex items-center gap-3 md:gap-4">
            <button
              type="button"
              onClick={togglePlayer}
              aria-label={player.status === 'playing' ? r.pause : r.listen}
              className="shrink-0 w-9 h-9 rounded-full bg-white text-black border-0 cursor-pointer flex items-center justify-center"
            >
              {player.status === 'loading' ? (
                <Spinner className="border-black/20 border-t-black" />
              ) : player.status === 'playing' ? (
                <PauseIcon className="w-4 h-4" />
              ) : (
                <PlayIcon className="w-4 h-4 ml-0.5" />
              )}
            </button>

            <div className="min-w-0 w-40 md:w-56">
              <div className="font-body font-semibold text-white text-xs md:text-sm truncate leading-tight">
                {player.track.title}
              </div>
              <div className="font-body text-[11px] text-white/50 truncate leading-tight mt-0.5">
                {player.status === 'error' ? r.playerError : `${player.track.artist} · ${r.playerPreview}`}
              </div>
            </div>

            <div
              className="flex-1 h-1.5 bg-white/15 rounded-full cursor-pointer overflow-hidden"
              onClick={seekTo}
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-white rounded-full" style={{ width: `${progress * 100}%` }} />
            </div>

            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => {
                const v = Number(e.target.value);
                setVolume(v);
                if (audioRef.current) audioRef.current.volume = v;
              }}
              aria-label="Volume"
              className="hidden md:block w-24 cursor-pointer"
            />

            <button
              type="button"
              onClick={closePlayer}
              aria-label={r.close}
              className="shrink-0 w-8 h-8 rounded-full bg-white/5 border border-white/10 text-white/70 hover:text-white cursor-pointer text-base leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </section>
  );
};

export default RadarPage;
