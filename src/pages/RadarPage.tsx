/**
 * RadarPage — veille musicale : dernieres sorties des labels et artistes suivis.
 *
 * Donnees : public/releases.json, editable depuis l'onglet "releases" du panel
 * admin (AdminEvents.tsx) -> POST /api/save-releases -> commit GitHub -> deploy.
 *
 * Trois sections : coups de coeur (feature), radar labels, radar artistes.
 * Une sortie sans image affiche un degrade colorFrom -> colorTo + les initiales.
 */

import React, { useEffect, useState } from 'react';
import { loadReleases, type Release, type ReleaseSection } from '../utils/adminApi';
import { useTranslation } from '../lib/i18n';
import '../styles/radar.css';

/** Locales Intl par langue du site. */
const DATE_LOCALE: Record<string, string> = { fr: 'fr-CA', en: 'en-CA', es: 'es-ES' };

/**
 * Initiales affichees sur les pochettes sans image.
 * Retire un prefixe "V/A —" puis prend la 1re lettre des 2 premiers mots.
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

const SECTION_ORDER: ReleaseSection[] = ['feature', 'labels', 'artistes'];

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

  // Plage de dates affichee dans le bandeau meta
  const dates = releases.map((rel) => rel.releaseDate).filter(Boolean).sort();
  const dateRange =
    dates.length === 0
      ? null
      : dates[0] === dates[dates.length - 1]
        ? formatDate(dates[0])
        : `${formatDate(dates[0])} – ${formatDate(dates[dates.length - 1])}`;

  const bySection = (section: ReleaseSection) => releases.filter((rel) => rel.section === section);

  const renderCard = (rel: Release, isFeature: boolean) => {
    const hasCover = !!(rel.cover && rel.cover.trim());
    const coverSrc = hasCover
      ? /^https?:\/\//.test(rel.cover!)
        ? rel.cover!
        : `/${rel.cover!.replace(/^\//, '')}`
      : null;

    return (
      <a
        key={rel.id}
        className="radar-card"
        href={rel.link || undefined}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${rel.artist} — ${rel.title} (${rel.label})`}
      >
        <div
          className="radar-cover"
          style={
            hasCover
              ? undefined
              : { background: `linear-gradient(150deg, ${rel.colorFrom || '#242427'}, ${rel.colorTo || '#0a0a0a'})` }
          }
        >
          {coverSrc && <img className="radar-cover-img" src={coverSrc} alt="" loading="lazy" />}
          <div className="radar-rings" aria-hidden="true" />
          {!hasCover && (
            <div className="radar-init" aria-hidden="true">
              {initials(rel.artist)}
            </div>
          )}
          {rel.favorite ? (
            <span className="radar-badge">{r.badgeFavorite}</span>
          ) : (
            rel.genre && <span className="radar-badge alt">{rel.genre}</span>
          )}
        </div>

        <div className="radar-body">
          <div className="radar-artist">{rel.artist}</div>
          {rel.title && <div className="radar-track">{rel.title}</div>}
          <div className="radar-tags">
            {rel.label && <span className="radar-tag is-label">{rel.label}</span>}
            {rel.format && <span className="radar-tag">{rel.format}</span>}
            {rel.genre && <span className="radar-tag">{rel.genre}</span>}
          </div>
          <div className="radar-row">
            <span className="radar-date">{formatDate(rel.releaseDate)}</span>
            <span className="radar-cta">{r.listen} ↗</span>
          </div>
        </div>
      </a>
    );
  };

  const sectionMeta: Record<ReleaseSection, { title: string; empty: string; anchor: string }> = {
    feature: { title: r.sectionFeature, empty: r.emptyFeature, anchor: 'coups-de-coeur' },
    labels: { title: r.sectionLabels, empty: r.emptyLabels, anchor: 'radar-labels' },
    artistes: { title: r.sectionArtists, empty: r.emptyArtists, anchor: 'radar-artistes' },
  };

  return (
    <section className="radar-page pt-24 pb-32 px-4 md:px-10 max-w-7xl mx-auto w-full">
      <div className="radar-grain" aria-hidden="true" />

      <header className="radar-hero">
        <h1 className="sr-only">{t.headings.radar}</h1>
        <div className="radar-kicker">{r.kicker}</div>
        <div className="radar-title" aria-hidden="true">
          {r.title}
        </div>
        <p className="radar-sub">{r.subtitle}</p>

        <div className="radar-meta">
          {dateRange && <span className="radar-pill">{dateRange}</span>}
          <span className="radar-pill">
            {releases.length} {releases.length > 1 ? r.releasesPlural : r.releasesSingular}
          </span>
          <span className="radar-pill">{t.signature.genres}</span>
        </div>

        <nav className="radar-anchors" aria-label={r.title}>
          {SECTION_ORDER.map((s) => (
            <a key={s} href={`#${sectionMeta[s].anchor}`}>
              {sectionMeta[s].title}
            </a>
          ))}
        </nav>
      </header>

      {SECTION_ORDER.map((section, i) => {
        const items = bySection(section);
        const meta = sectionMeta[section];
        return (
          <section key={section} id={meta.anchor} className="radar-section">
            <div className="radar-section-head">
              <span className="radar-num">{String(i + 1).padStart(2, '0')}</span>
              <h2 className="radar-section-title">{meta.title}</h2>
              <span className="radar-rule" aria-hidden="true" />
              <span className="radar-count">{items.length}</span>
            </div>

            {items.length > 0 ? (
              <div className={`radar-grid${section === 'feature' ? ' feature' : ''}`}>
                {items.map((rel) => renderCard(rel, section === 'feature'))}
              </div>
            ) : (
              <p className="radar-empty">{loaded ? meta.empty : r.loading}</p>
            )}
          </section>
        );
      })}
    </section>
  );
};

export default RadarPage;
