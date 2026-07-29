/**
 * RadarPage v3.2 — tableau de bord musical : flux + explorateur, lecteur global.
 *
 * Layout adaptatif : sans selection, le flux prend TOUTE la largeur (lignes
 * aerees, libelles lisibles). Selectionner un artiste ou un label ouvre le
 * split deux colonnes (transition douce sur grid-template-columns) et
 * l'explorateur occupe toute la hauteur disponible a droite, en verre
 * depoli comme les panneaux de la page Shows (.radar-glass). Fermer le
 * panneau rend la pleine largeur au flux.
 *
 * Le lecteur (file, deux moteurs, barre du bas) vit desormais dans
 * PlayerContext au niveau du Layout : cette page ne fait que construire
 * des files et les lui confier. La lecture survit a la navigation.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { loadReleases, type Release } from '../utils/adminApi';
import {
  searchArtist,
  searchLabel,
  fallbackLinks,
  type ExplorerItem,
  type ExplorerResult,
} from '../utils/itunes';
import { usePlayer, type QueueTrack } from '../context/PlayerContext';
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
const ExternalIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" aria-hidden="true">
    <path d="M7 17L17 7M17 7H8M17 7v9" />
  </svg>
);
const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={cn('inline-block w-4 h-4 rounded-full border-2 border-white/20 border-t-white/80 animate-spin', className)}
    aria-hidden="true"
  />
);

const RadarPage: React.FC = () => {
  const { t, lang } = useTranslation();
  const r = t.radar;
  const player = usePlayer();

  const [releases, setReleases] = useState<Release[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [following, setFollowing] = useState<Following>({ artists: [], labels: [], topLabels: [] });

  const [explorer, setExplorer] = useState<ExplorerState | null>(null);
  const [resolvingRow, setResolvingRow] = useState<number | null>(null);

  const [query, setQuery] = useState('');
  const [suggestOpen, setSuggestOpen] = useState(false);
  const [activeSuggest, setActiveSuggest] = useState(0);

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

  const locale = DATE_LOCALE[lang] || 'en-CA';
  const formatDate = (iso: string) => {
    if (!iso) return '';
    const d = new Date(`${iso}T12:00:00`);
    if (Number.isNaN(d.getTime())) return iso;
    return d.toLocaleDateString(locale, { day: 'numeric', month: 'short', year: 'numeric' });
  };

  // ----- Donnees du flux -----

  const cutoff = new Date(Date.now() - NEWS_WINDOW_DAYS * 86400000).toISOString().slice(0, 10);
  const news = releases.filter((rel) => (rel.releaseDate || '') >= cutoff);

  const releasesWord = (n: number) => (n > 1 ? r.releasesPlural : r.releasesSingular);

  /** File du flux : toutes les Nouveautes, lecture demarree a la ligne cliquee. */
  const fluxQueue = (): QueueTrack[] =>
    news.map((rel) => ({
      title: rel.title,
      artist: rel.artist,
      soundcloudUrl: (rel.soundcloudUrl || '').trim() || undefined,
      link: rel.link || undefined,
    }));

  const playFlux = async (rowIndex: number, rel: Release) => {
    setResolvingRow(rel.id);
    try {
      await player.playQueue(fluxQueue(), rowIndex);
    } finally {
      setResolvingRow(null);
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

  /** Items jouables d'un panneau, dans l'ordre affiche. */
  const panelQueue = (items: ExplorerItem[]): QueueTrack[] =>
    items
      .filter((i) => i.previewUrl || i.collectionId)
      .map((i) => ({
        title: i.title,
        artist: i.artist,
        previewUrl: i.previewUrl,
        collectionId: i.collectionId,
        link: i.storeUrl,
      }));

  /** Groupes du panneau label : par artiste, tries par sortie la plus recente. */
  const labelGroups = useMemo(() => {
    if (!explorer || explorer.type !== 'label' || !explorer.result) return [];
    const map = new Map<string, ExplorerItem[]>();
    for (const item of explorer.result.items) {
      const key = item.artist || '?';
      if (!map.has(key)) map.set(key, []);
      map.get(key)!.push(item);
    }
    return Array.from(map.entries())
      .map(([artist, items]) => ({
        artist,
        items: items.sort((a, b) => (b.date || '').localeCompare(a.date || '')),
        latest: items.reduce((m, i) => ((i.date || '') > m ? i.date : m), ''),
      }))
      .sort((a, b) => b.latest.localeCompare(a.latest));
  }, [explorer]);

  /** Ordre de lecture du panneau label = ordre affiche (groupes puis items). */
  const labelOrderedItems = useMemo(() => labelGroups.flatMap((g) => g.items), [labelGroups]);

  const playPanel = (items: ExplorerItem[], startItem?: ExplorerItem) => {
    const queue = panelQueue(items);
    if (queue.length === 0) return;
    let start = 0;
    if (startItem) {
      const idx = queue.findIndex(
        (q) => norm(q.title) === norm(startItem.title) && q.collectionId === startItem.collectionId,
      );
      start = idx >= 0 ? idx : 0;
    }
    player.playQueue(queue, start);
  };

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

  const isCurrentPlaying = (artist: string, title: string) =>
    player.status === 'playing' && player.isCurrent(artist, title);

  /**
   * Ligne du flux. compact = split ouvert (colonne gauche resserree) ;
   * sinon la ligne respire : hauteur plus grande, label et date en clair.
   */
  const renderRow = (rel: Release, rowIndex: number, compact: boolean) => {
    const cover = String(rel.cover || '').trim();
    const coverSrc = cover
      ? /^https?:\/\//.test(cover)
        ? cover
        : `/${cover.replace(/^\//, '')}`
      : null;
    const resolving = resolvingRow === rel.id;
    const playingThis = isCurrentPlaying(rel.artist, rel.title);

    return (
      <div
        key={rel.id}
        role="button"
        tabIndex={0}
        onClick={() => openExplorer('artist', rel.artist)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            openExplorer('artist', rel.artist);
          }
        }}
        aria-label={`${rel.artist}, ${rel.title}`}
        className={cn(
          'group flex items-center gap-3 px-2 -mx-2 rounded-lg cursor-pointer hover:bg-white/[0.05] transition-colors min-w-0',
          compact ? 'h-12' : 'h-12 md:h-14',
        )}
      >
        {/* Play permanent et contraste : joue sans ouvrir l'explorateur */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            if (playingThis) player.toggle();
            else playFlux(rowIndex, rel);
          }}
          aria-label={`${playingThis ? r.pause : r.listen} : ${rel.artist}, ${rel.title}`}
          className="shrink-0 w-9 h-9 rounded-full bg-white text-black border-0 cursor-pointer flex items-center justify-center hover:scale-105 transition-transform"
        >
          {resolving ? (
            <Spinner className="border-black/20 border-t-black" />
          ) : playingThis ? (
            <PauseIcon className="w-4 h-4" />
          ) : (
            <PlayIcon className="w-4 h-4 ml-0.5" />
          )}
        </button>

        <div
          className={cn('shrink-0 rounded overflow-hidden', compact ? 'w-10 h-10' : 'w-10 h-10 md:w-11 md:h-11')}
          style={
            coverSrc
              ? undefined
              : { background: `linear-gradient(150deg, ${rel.colorFrom || '#242427'}, ${rel.colorTo || '#0a0a0a'})` }
          }
          aria-hidden="true"
        >
          {coverSrc ? (
            <img src={coverSrc} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <span className="w-full h-full flex items-center justify-center font-display font-black text-white/90 text-xs">
              {initials(rel.artist)}
            </span>
          )}
        </div>

        <div className="flex-1 min-w-0 flex items-baseline gap-2 overflow-hidden whitespace-nowrap">
          {rel.favorite && (
            <span className="radar-pick-bg shrink-0 inline-block w-1.5 h-1.5 rounded-full" title={r.badgeFavorite} />
          )}
          <span className="shrink-0 font-body font-bold text-ink-95 text-sm md:text-base leading-tight group-hover:text-white transition-colors">
            {rel.artist}
          </span>
          <span className="truncate font-body text-white/55 text-xs md:text-sm">{rel.title}</span>
        </div>

        {/* Libelles : aeres en pleine largeur, condenses quand le split est ouvert */}
        {compact ? (
          <>
            <div className="shrink-0 text-right leading-tight hidden sm:block">
              {rel.label && <div className="radar-label-tag font-body text-[11px]">{rel.label}</div>}
              <div className="font-body text-[11px] text-white/55">{formatDate(rel.releaseDate)}</div>
            </div>
            <div className="shrink-0 sm:hidden font-body text-[11px] text-white/55">
              {formatDate(rel.releaseDate)}
            </div>
          </>
        ) : (
          <>
            <div className="shrink-0 hidden sm:flex items-center gap-4 md:gap-6">
              {rel.label && (
                <span className="radar-label-tag font-body text-xs md:text-sm whitespace-nowrap">{rel.label}</span>
              )}
              <span className="font-body text-xs md:text-sm text-white/60 whitespace-nowrap w-28 text-right">
                {formatDate(rel.releaseDate)}
              </span>
            </div>
            <div className="shrink-0 sm:hidden font-body text-[11px] text-white/55">
              {formatDate(rel.releaseDate)}
            </div>
          </>
        )}

        {rel.link && (
          <a
            href={rel.link}
            target="_blank"
            rel="noopener noreferrer"
            onClick={(e) => e.stopPropagation()}
            aria-label={`${rel.artist}, ${rel.title} (${rel.label})`}
            className="shrink-0 p-1.5 rounded text-white/35 hover:text-white hover:bg-white/10 transition-colors"
          >
            <ExternalIcon className="w-4 h-4" />
          </a>
        )}
      </div>
    );
  };

  /** Rangee jouable de l'explorateur. */
  const renderExplorerItem = (item: ExplorerItem, allItems: ExplorerItem[]) => {
    const playable = !!item.previewUrl || !!item.collectionId;
    const playingThis = isCurrentPlaying(item.artist, item.title);
    return (
      <div key={`${item.kind}-${item.id}`} className="flex items-center gap-3 py-2.5 min-w-0">
        <img src={item.artwork} alt="" loading="lazy" className="shrink-0 w-12 h-12 rounded object-cover bg-white/10" />
        <div className="flex-1 min-w-0">
          <div className="font-body font-semibold text-white text-sm leading-tight truncate">{item.title}</div>
          {(item.album || explorer?.type === 'label') && (
            <div className="font-body text-xs text-white/60 leading-tight truncate mt-0.5">
              {explorer?.type === 'label' ? item.artist : item.album}
            </div>
          )}
          <div className="font-body text-[11px] text-white/55 mt-0.5">{formatDate(item.date)}</div>
        </div>
        {playable && (
          <button
            type="button"
            onClick={() => (playingThis ? player.toggle() : playPanel(allItems, item))}
            aria-label={`${playingThis ? r.pause : r.listen} : ${item.artist}, ${item.title}`}
            className="shrink-0 w-9 h-9 rounded-full bg-white text-black border-0 cursor-pointer flex items-center justify-center hover:scale-105 transition-transform"
          >
            {playingThis ? <PauseIcon className="w-4 h-4" /> : <PlayIcon className="w-4 h-4 ml-0.5" />}
          </button>
        )}
      </div>
    );
  };

  /**
   * Panneau explorateur, en verre depoli (recette du site).
   * fill = true dans la colonne droite : hauteur pleine, liste qui scrolle
   * a l'interieur. false dans la bottom sheet mobile, qui scrolle elle-meme.
   */
  const explorerPanel = (fill: boolean) =>
    explorer && (
      <div className={cn('radar-glass rounded-2xl md:rounded-3xl p-4 md:p-6', fill && 'h-full flex flex-col min-h-0')}>
        <div className="shrink-0 flex items-center justify-between gap-3 mb-2">
          <div className="min-w-0">
            <span className="font-body text-[11px] text-white/55">
              {explorer.type === 'artist' ? r.artistTag : r.labelTag}
            </span>
            <div className="font-body font-extrabold text-white text-base md:text-lg leading-tight truncate">
              {explorer.name}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            {explorer.status === 'done' &&
              explorer.result &&
              panelQueue(explorer.type === 'label' ? labelOrderedItems : explorer.result.items).length > 0 && (
                <button
                  type="button"
                  onClick={() => playPanel(explorer.type === 'label' ? labelOrderedItems : explorer.result!.items)}
                  className="flex items-center gap-1.5 font-body font-semibold text-xs md:text-sm bg-white text-black border-0 rounded-full pl-2.5 pr-3.5 py-1.5 cursor-pointer hover:scale-[1.03] transition-transform"
                >
                  <PlayIcon className="w-3.5 h-3.5" /> {r.playAll}
                </button>
              )}
            <button
              type="button"
              onClick={closeExplorer}
              aria-label={r.close}
              className="w-8 h-8 rounded-full bg-white/10 border border-white/15 text-white/80 hover:text-white hover:border-white/40 cursor-pointer text-base leading-none"
            >
              ×
            </button>
          </div>
        </div>

        <div className={cn(fill && 'flex-1 min-h-0 overflow-y-auto custom-scrollbar pr-1')}>
          {explorer.status === 'loading' && (
            <div className="flex items-center gap-3 py-8 text-white/60 font-body text-sm">
              <Spinner /> {r.explorerLoading}
            </div>
          )}

          {explorer.status === 'error' && (
            <p className="py-6 text-white/60 font-body text-sm m-0">{r.explorerError}</p>
          )}

          {explorer.status === 'done' && explorer.result && (
            <>
              {explorer.result.approximate && explorer.result.items.length > 0 && (
                <p className="font-body text-xs text-white/55 mt-1 mb-2">{r.explorerApprox}</p>
              )}

              {explorer.result.items.length === 0 ? (
                <div className="py-4">
                  <p className="font-body text-sm text-white/70 m-0 mb-3">{r.explorerNone}</p>
                  <p className="font-body text-xs text-white/55 m-0 mb-2">{r.explorerElsewhere}</p>
                  <div className="flex flex-wrap gap-2">
                    {fallbackLinks(explorer.name).map((l) => (
                      <a
                        key={l.site}
                        href={l.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="font-body text-xs text-white/80 border border-white/15 rounded-full px-3 py-1 no-underline hover:text-white hover:border-white/45 transition-colors"
                      >
                        {l.site} ↗
                      </a>
                    ))}
                  </div>
                </div>
              ) : explorer.type === 'label' ? (
                /* Panneau label : groupe par artiste, tries par sortie recente */
                <div className="mt-1">
                  {labelGroups.map((group) => (
                    <div key={group.artist} className="py-2 border-t border-white/10 first:border-t-0">
                      <div className="flex items-baseline justify-between gap-3">
                        <button
                          type="button"
                          onClick={() => openExplorer('artist', group.artist)}
                          className="min-w-0 truncate font-body font-bold text-white text-sm md:text-base bg-transparent border-0 p-0 cursor-pointer hover:underline underline-offset-2 text-left"
                        >
                          {group.artist}
                        </button>
                        <span className="shrink-0 font-body text-[11px] text-white/55">
                          {group.items.length} {releasesWord(group.items.length)}
                        </span>
                      </div>
                      <div className="divide-y divide-white/[0.06]">
                        {group.items.map((item) => renderExplorerItem(item, labelOrderedItems))}
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <div className="divide-y divide-white/[0.06] mt-1">
                  {explorer.result.items.map((item) => renderExplorerItem(item, explorer.result!.items))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    );

  const split = !!explorer;

  return (
    <section className="radar-page pt-24 pb-32 py-20 md:py-32 px-4 md:px-10 max-w-7xl mx-auto w-full">
      <h1 className="sr-only">{t.headings.radar}</h1>

      <p className="font-body text-sm md:text-base text-white/60 leading-relaxed max-w-2xl mb-8 md:mb-12 animate-fade-up">
        {r.subtitle}
      </p>

      {/*
        Layout adaptatif : une colonne pleine largeur au repos, split 3/2
        quand l'explorateur est ouvert. La transition anime les fractions
        de grille (0fr -> 2fr) ; l'aside collabe via overflow-hidden.
      */}
      <div
        className={cn('lg:grid items-start')}
        style={{
          gridTemplateColumns: split ? 'minmax(0, 3fr) minmax(0, 2fr)' : 'minmax(0, 1fr) minmax(0, 0fr)',
          gap: split ? '2rem' : '0rem',
          transition:
            'grid-template-columns 0.5s cubic-bezier(0.22, 1, 0.36, 1), gap 0.5s cubic-bezier(0.22, 1, 0.36, 1)',
        }}
      >
        {/* ================= COLONNE GAUCHE : le flux + les boites ================= */}
        <div className="min-w-0">
          <div className="flex items-baseline justify-between mb-4 md:mb-6">
            <div className="text-base md:text-lg font-extrabold text-white font-body">{r.sectionNews}</div>
            <div className="text-sm font-bold text-white/60 font-body">
              {news.length} {releasesWord(news.length)}
            </div>
          </div>

          {news.length > 0 ? (
            <div className="pk-glass rounded-2xl p-3 md:p-4">
              <div className="divide-y divide-white/5">{news.map((rel, i) => renderRow(rel, i, split))}</div>
            </div>
          ) : (
            <p className="font-body text-white/50">{loaded ? r.emptyNews : r.loading}</p>
          )}

          {/* Boite artistes suivis : recherche seule */}
          <div className="mt-10 md:mt-14 pk-glass rounded-2xl p-4 md:p-6">
            <div className="flex items-baseline justify-between mb-3">
              <div className="text-base md:text-lg font-extrabold text-white font-body">{r.followingArtists}</div>
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

        {/* ================= COLONNE DROITE : explorateur pleine hauteur ================= */}
        <aside
          className={cn(
            'hidden lg:block min-w-0 overflow-hidden lg:sticky lg:top-24 transition-opacity duration-300',
            split ? 'opacity-100 lg:h-[calc(100vh-7.5rem)]' : 'opacity-0 lg:h-0',
          )}
          aria-hidden={!split}
        >
          {explorerPanel(true)}
        </aside>
      </div>

      {/* ================= EXPLORATEUR MOBILE : bottom sheet ================= */}
      {explorer && (
        <div className="lg:hidden" role="dialog" aria-label={explorer.name}>
          <div style={{ position: 'fixed', inset: 0, zIndex: 70 }} className="bg-black/60" onClick={closeExplorer} />
          <div
            style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 71 }}
            className="max-h-[75vh] overflow-y-auto custom-scrollbar rounded-t-2xl p-3 pb-6"
          >
            {explorerPanel(false)}
          </div>
        </div>
      )}
    </section>
  );
};

export default RadarPage;
