/**
 * RadarPage — veille musicale : dernieres sorties des labels et artistes suivis.
 *
 * Donnees : public/releases.json, editable depuis l'onglet "releases" du panel
 * admin (AdminEvents.tsx) -> POST /api/save-releases (local) -> commit -> deploy.
 *
 * Structure calquee sur la page Shows :
 * - "Nouveautes" : sorties des 60 derniers jours, cartes GlassCard comme les
 *   events a venir, coups de coeur en tete de liste.
 * - "Archives" : le reste, groupe par annee comme le Wall of Fame (grosse
 *   annee a gauche, liste typographique a droite).
 * Les accents de couleur restent confines a .radar-page (radar.css), le reste
 * du site demeure monochrome.
 */

import React, { useEffect, useState } from 'react';
import { loadReleases, type Release } from '../utils/adminApi';
import { useTranslation } from '../lib/i18n';
import GlassCard from '../components/ui/GlassCard';
import { cn } from '../lib/cn';
import '../styles/radar.css';

/** Locales Intl par langue du site. */
const DATE_LOCALE: Record<string, string> = { fr: 'fr-CA', en: 'en-CA', es: 'es-ES' };

/** Fenetre "Nouveautes" : 60 jours. */
const NEWS_WINDOW_DAYS = 60;

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

const RadarPage: React.FC = () => {
  const { t, lang } = useTranslation();
  const r = t.radar;
  const [releases, setReleases] = useState<Release[]>([]);
  const [loaded, setLoaded] = useState(false);

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

  // Coups de coeur en tete, puis date decroissante
  const news = releases
    .filter((rel) => (rel.releaseDate || '') >= cutoff)
    .sort(
      (a, b) =>
        (b.favorite ? 1 : 0) - (a.favorite ? 1 : 0) ||
        (b.releaseDate || '').localeCompare(a.releaseDate || ''),
    );

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

  /** Meta d'une sortie : label (accent violet), format, genre. */
  const metaLine = (rel: Release) =>
    [rel.format, rel.genre].filter(Boolean).join(' · ');

  const renderNewsCard = (rel: Release, index: number) => {
    const hasCover = !!(rel.cover && rel.cover.trim());
    const coverSrc = hasCover
      ? /^https?:\/\//.test(rel.cover!)
        ? rel.cover!
        : `/${rel.cover!.replace(/^\//, '')}`
      : null;

    return (
      <GlassCard
        key={rel.id}
        href={rel.link || undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${rel.artist}, ${rel.title} (${rel.label})`}
        className="group"
        index={index}
      >
        <div className="flex items-center gap-4 md:gap-5 p-4 md:p-5">
          {/* Vignette : cover si fournie, sinon degrade + initiales */}
          <div
            className="shrink-0 w-16 h-16 md:w-20 md:h-20 rounded-xl overflow-hidden flex items-center justify-center"
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
            {rel.favorite && (
              <div className="radar-pick font-body font-bold text-xs md:text-sm leading-none mb-1.5">
                {r.badgeFavorite}
              </div>
            )}
            <div className="font-body font-bold text-ink-95 text-base md:text-xl leading-tight group-hover:text-white transition-colors">
              {rel.artist}
            </div>
            {rel.title && (
              <div className="font-body text-sm md:text-base text-white/60 leading-tight mt-0.5">
                {rel.title}
              </div>
            )}
            <div className="font-body text-xs md:text-sm text-white/40 leading-tight mt-1.5">
              {rel.label && <span className="radar-label-tag">{rel.label}</span>}
              {rel.label && metaLine(rel) ? ' · ' : ''}
              {metaLine(rel)}
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
        </div>
      </GlassCard>
    );
  };

  const renderArchiveRow = (rel: Release) => {
    const content = (
      <>
        <span className="flex-1 min-w-0">
          <div className="font-body font-medium leading-tight text-ink-95 text-base md:text-xl lg:text-2xl group-hover:text-white transition-colors">
            {rel.artist}
          </div>
          <div className="font-body text-xs md:text-sm text-white/50 leading-tight mt-0.5">
            {rel.title}
            {rel.label ? (
              <>
                {' · '}
                <span className="radar-label-tag">{rel.label}</span>
              </>
            ) : null}
            {rel.genre ? ` · ${rel.genre}` : ''}
            {rel.releaseDate ? ` · ${formatDate(rel.releaseDate)}` : ''}
          </div>
        </span>
        {rel.link && (
          <ArrowIcon className="shrink-0 w-4 h-4 md:w-5 md:h-5 mt-1 text-white/30 group-hover:text-white transition-colors" />
        )}
      </>
    );

    const rowClass =
      'group flex items-start gap-3 md:gap-4 no-underline text-inherit hover:bg-white/[0.03] rounded-lg px-2 py-1 -mx-2 transition-colors';

    return rel.link ? (
      <a
        key={rel.id}
        href={rel.link}
        target="_blank"
        rel="noopener noreferrer"
        className={rowClass}
        aria-label={`${rel.artist}, ${rel.title} (${rel.label})`}
      >
        {content}
      </a>
    ) : (
      <div key={rel.id} className={rowClass.replace(' hover:bg-white/[0.03]', '')}>
        {content}
      </div>
    );
  };

  return (
    <section className="radar-page pt-24 pb-32 py-20 md:py-32 px-4 md:px-10 max-w-7xl mx-auto w-full">
      <h1 className="sr-only">{t.headings.radar}</h1>

      {/* Intro courte, meme registre que le reste du site */}
      <p className="font-body text-sm md:text-base text-white/60 leading-relaxed max-w-2xl mb-10 md:mb-14 animate-fade-up">
        {r.subtitle}
      </p>

      {/* NOUVEAUTES : 60 derniers jours, cartes comme la page events */}
      <div className="flex items-baseline justify-between mb-8 md:mb-14">
        <div className="text-base md:text-lg font-extrabold text-white font-body">
          {r.sectionNews}
        </div>
        <div className="text-sm md:text-base font-bold text-white/60 font-body">
          {news.length} {releasesWord(news.length)}
        </div>
      </div>

      {news.length > 0 ? (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5 md:gap-6">
          {news.map((rel, i) => renderNewsCard(rel, i))}
        </div>
      ) : (
        <p className="font-body text-white/50">{loaded ? r.emptyNews : r.loading}</p>
      )}

      {/* ARCHIVES : le reste, groupe par annee comme le Wall of Fame */}
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
                  style={{
                    animationDelay: `${100 + i * 60}ms`,
                    animationFillMode: 'both',
                  }}
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
                  <div className="flex flex-col gap-2 md:gap-3 min-w-0">
                    {row.items.map((rel) => renderArchiveRow(rel))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}
    </section>
  );
};

export default RadarPage;
