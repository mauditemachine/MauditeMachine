/**
 * RadarPage — veille musicale : dernieres sorties + annuaire des suivis.
 *
 * Donnees :
 * - public/releases.json : le flux, editable depuis l'onglet "releases" de
 *   l'admin. Apres chaque import, `npm run covers` rapatrie les pochettes
 *   (og:image du lien de chaque sortie) dans public/images/releases/.
 * - public/following.json : artistes et labels suivis. Chaque nom ouvre la
 *   recherche releases Beatport correspondante, donc toujours a jour sans
 *   maintenance.
 *
 * Structure :
 * - "Nouveautes" : sorties des 60 derniers jours, une ligne par sortie
 *   (cover carree, artiste + titre, label, genre, date a droite).
 * - "Archives" : le reste, groupe par annee facon Wall of Fame.
 * - "Je suis" : deux blocs repliables de pills (artistes, labels) avec un
 *   filtre instantane commun.
 * Les accents de couleur restent confines a .radar-page (radar.css).
 */

import React, { useEffect, useMemo, useState } from 'react';
import { loadReleases, type Release } from '../utils/adminApi';
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
}

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

/** Recherche releases Beatport d'un nom, triee par nouveaute cote Beatport. */
const beatportSearch = (name: string) =>
  `https://www.beatport.com/search/releases?q=${encodeURIComponent(name)}`;

/** Normalisation pour le filtre : casse et accents ignores. */
const norm = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

/** Fleche externe, identique a celle du Wall of Fame. */
const ArrowIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg
    className={className}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M7 17L17 7M17 7H8M17 7v9" />
  </svg>
);

/** Chevron des blocs repliables. */
const ChevronIcon: React.FC<{ open: boolean }> = ({ open }) => (
  <svg
    className={cn('w-4 h-4 md:w-5 md:h-5 transition-transform', open && 'rotate-180')}
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    aria-hidden="true"
  >
    <path d="M6 9l6 6 6-6" />
  </svg>
);

const isDesktop = () =>
  typeof window !== 'undefined' && window.matchMedia('(min-width: 768px)').matches;

const RadarPage: React.FC = () => {
  const { t, lang } = useTranslation();
  const r = t.radar;

  const [releases, setReleases] = useState<Release[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [following, setFollowing] = useState<Following>({ artists: [], labels: [] });
  const [query, setQuery] = useState('');
  // Ouverts par defaut sur desktop, replies sur mobile
  const [openArtists, setOpenArtists] = useState<boolean>(isDesktop);
  const [openLabels, setOpenLabels] = useState<boolean>(isDesktop);

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

  // Coupure nouveautes/archives : 60 jours glissants
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

  // Annuaire : tri alphabetique, filtre commun instantane
  const sortedArtists = useMemo(
    () => [...following.artists].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [following.artists],
  );
  const sortedLabels = useMemo(
    () => [...following.labels].sort((a, b) => a.localeCompare(b, undefined, { sensitivity: 'base' })),
    [following.labels],
  );
  const q = norm(query.trim());
  const filteredArtists = q ? sortedArtists.filter((n) => norm(n).includes(q)) : sortedArtists;
  const filteredLabels = q ? sortedLabels.filter((n) => norm(n).includes(q)) : sortedLabels;
  // Une recherche en cours deplie les deux blocs, sinon filtrer dans un bloc
  // replie semblerait ne rien faire
  const showArtists = openArtists || !!q;
  const showLabels = openLabels || !!q;

  /** Une ligne du flux : cover, artiste + titre, meta, date, fleche. */
  const renderRow = (rel: Release) => {
    const cover = String(rel.cover || '').trim();
    const coverSrc = cover
      ? /^https?:\/\//.test(cover)
        ? cover
        : `/${cover.replace(/^\//, '')}`
      : null;

    const inner = (
      <>
        <div
          className="shrink-0 w-[72px] h-[72px] md:w-24 md:h-24 rounded-lg overflow-hidden flex items-center justify-center"
          style={
            coverSrc
              ? undefined
              : {
                  background: `linear-gradient(150deg, ${rel.colorFrom || '#242427'}, ${rel.colorTo || '#0a0a0a'})`,
                }
          }
          aria-hidden="true"
        >
          {coverSrc ? (
            <img src={coverSrc} alt="" loading="lazy" className="w-full h-full object-cover" />
          ) : (
            <span className="font-display font-black text-white/90 text-lg md:text-xl">
              {initials(rel.artist)}
            </span>
          )}
        </div>

        <div className="min-w-0 flex-1">
          <div className="font-body font-bold text-ink-95 text-base md:text-xl leading-tight group-hover:text-white transition-colors">
            {rel.favorite && (
              <span
                className="radar-pick-bg inline-block w-1.5 h-1.5 rounded-full mr-2 align-middle"
                title={r.badgeFavorite}
              >
                <span className="sr-only">{r.badgeFavorite} </span>
              </span>
            )}
            {rel.artist}
          </div>
          {rel.title && (
            <div className="font-body text-sm md:text-base text-white/60 leading-tight mt-0.5">
              {rel.title}
            </div>
          )}
          <div className="font-body text-xs md:text-sm text-white/40 leading-tight mt-1.5">
            {rel.label && <span className="radar-label-tag">{rel.label}</span>}
            {rel.label && (rel.format || rel.genre) ? ' · ' : ''}
            {[rel.format, rel.genre].filter(Boolean).join(' · ')}
          </div>
        </div>

        <div className="shrink-0 flex flex-col items-end gap-2">
          <span className="font-body text-xs md:text-sm text-white/50 whitespace-nowrap">
            {formatDate(rel.releaseDate)}
          </span>
          {rel.link && (
            <ArrowIcon className="w-4 h-4 md:w-5 md:h-5 text-white/30 group-hover:text-white transition-colors" />
          )}
        </div>
      </>
    );

    const rowClass =
      'group flex items-center gap-4 md:gap-5 py-3 md:py-4 px-2 -mx-2 rounded-xl no-underline text-inherit transition-colors';

    return rel.link ? (
      <a
        key={rel.id}
        href={rel.link}
        target="_blank"
        rel="noopener noreferrer"
        className={cn(rowClass, 'hover:bg-white/[0.03]')}
        aria-label={`${rel.artist}, ${rel.title} (${rel.label})`}
      >
        {inner}
      </a>
    ) : (
      <div key={rel.id} className={rowClass}>
        {inner}
      </div>
    );
  };

  /** Un bloc de l'annuaire : entete repliable + pills. */
  const renderFollowingBlock = (
    title: string,
    names: string[],
    total: number,
    word: string,
    open: boolean,
    toggle: () => void,
  ) => (
    <div className="pk-glass rounded-2xl md:rounded-3xl p-4 md:p-6">
      <button
        type="button"
        onClick={toggle}
        aria-expanded={open}
        className="w-full flex items-center justify-between gap-4 bg-transparent border-0 p-0 cursor-pointer text-left"
      >
        <span className="text-base md:text-lg font-extrabold text-white font-body">{title}</span>
        <span className="flex items-center gap-3 text-sm md:text-base font-bold text-white/60 font-body whitespace-nowrap">
          {total} {word}
          <ChevronIcon open={open} />
        </span>
      </button>

      {open && (
        <div className="mt-4 md:mt-5">
          {names.length > 0 ? (
            <div className="flex flex-wrap gap-2">
              {names.map((name) => (
                <a
                  key={name}
                  href={beatportSearch(name)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="font-body text-xs md:text-sm text-white/70 border border-white/10 rounded-full px-3 py-1 no-underline hover:text-white hover:border-white/40 hover:bg-white/[0.04] transition-colors"
                >
                  {name}
                </a>
              ))}
            </div>
          ) : (
            <p className="font-body text-sm text-white/50 m-0">{r.followingEmpty}</p>
          )}
        </div>
      )}
    </div>
  );

  return (
    <section className="radar-page pt-24 pb-32 py-20 md:py-32 px-4 md:px-10 max-w-7xl mx-auto w-full">
      <h1 className="sr-only">{t.headings.radar}</h1>

      <p className="font-body text-sm md:text-base text-white/60 leading-relaxed max-w-2xl mb-10 md:mb-14 animate-fade-up">
        {r.subtitle}
      </p>

      {/* NOUVEAUTES : 60 derniers jours, une ligne par sortie */}
      <div className="flex items-baseline justify-between mb-8 md:mb-14">
        <div className="text-base md:text-lg font-extrabold text-white font-body">
          {r.sectionNews}
        </div>
        <div className="text-sm md:text-base font-bold text-white/60 font-body">
          {news.length} {releasesWord(news.length)}
        </div>
      </div>

      {news.length > 0 ? (
        <div className="pk-glass rounded-2xl md:rounded-3xl p-4 md:p-6">
          <div className="divide-y divide-white/5">{news.map((rel) => renderRow(rel))}</div>
        </div>
      ) : (
        <p className="font-body text-white/50">{loaded ? r.emptyNews : r.loading}</p>
      )}

      {/* ARCHIVES : le reste, groupe par annee */}
      {archives.length > 0 && (
        <div className="mt-24 md:mt-40">
          <div className="flex items-baseline justify-between mb-8 md:mb-14">
            <div className="text-base md:text-lg font-extrabold text-white font-body">
              {r.sectionArchives}
            </div>
            <div className="text-sm md:text-base font-bold text-white/60 font-body">
              {archiveYears[archiveYears.length - 1]?.year} / {archiveYears[0]?.year}
            </div>
          </div>

          <div className="pk-glass rounded-2xl md:rounded-3xl p-4 md:p-6">
            <div className="max-h-[500px] overflow-y-auto pr-4 custom-scrollbar divide-y divide-white/5">
              {archiveYears.map((row, i) => (
                <div
                  key={row.year}
                  className={cn(
                    'grid gap-4 md:gap-8 py-6 md:py-10 animate-fade-up items-start',
                    'grid-cols-1 md:grid-cols-[160px_1fr] lg:grid-cols-[200px_1fr]',
                  )}
                  style={{ animationDelay: `${100 + i * 60}ms`, animationFillMode: 'both' }}
                >
                  <div
                    className={cn(
                      'font-display font-black text-ink-95',
                      'text-4xl md:text-6xl lg:text-7xl',
                      'leading-none tracking-[-0.03em]',
                      'md:sticky md:top-0',
                    )}
                  >
                    {row.year}
                  </div>
                  <div className="flex flex-col min-w-0 divide-y divide-white/5">
                    {row.items.map((rel) => renderRow(rel))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* JE SUIS : annuaire artistes + labels, filtre commun */}
      {(following.artists.length > 0 || following.labels.length > 0) && (
        <div className="mt-24 md:mt-40">
          <div className="flex items-baseline justify-between mb-6 md:mb-8">
            <div className="text-base md:text-lg font-extrabold text-white font-body">
              {r.followingTitle}
            </div>
            <div className="text-sm md:text-base font-bold text-white/60 font-body">
              {following.artists.length} {r.artistsWord} · {following.labels.length} {r.labelsWord}
            </div>
          </div>

          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder={r.followingSearch}
            aria-label={r.followingSearch}
            className="w-full md:max-w-md mb-6 md:mb-8 font-body text-sm md:text-base text-white bg-white/5 border border-white/10 rounded-xl px-4 py-2.5 outline-none placeholder:text-white/40 focus:border-white/30 transition-colors"
          />

          <div className="flex flex-col gap-4 md:gap-6">
            {renderFollowingBlock(
              r.followingArtists,
              filteredArtists,
              following.artists.length,
              r.artistsWord,
              showArtists,
              () => setOpenArtists((v) => !v),
            )}
            {renderFollowingBlock(
              r.followingLabels,
              filteredLabels,
              following.labels.length,
              r.labelsWord,
              showLabels,
              () => setOpenLabels((v) => !v),
            )}
          </div>
        </div>
      )}
    </section>
  );
};

export default RadarPage;
