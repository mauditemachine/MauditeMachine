/**
 * Page Presskit — contenu du PDF officiel 2026, design liquid-glass.
 * Tous les textes visibles passent par useTranslation() (i18n EN/FR/ES).
 */

import React from 'react';
import { useTranslation } from '../lib/i18n';
import { cn } from '../lib/cn';

interface PresskitProps {
  onNavigateToMessage?: () => void;
}

const PDF_URL = `${import.meta.env.BASE_URL}Presskit_Maudite_Machine_2026.pdf`;

// Stats : les chiffres restent identiques, les labels viennent de t.presskit.stat*
const STAT_KEYS = ['statYears', 'statEps', 'statAlbums', 'statStudents'] as const;
const STAT_NUMS = ['15+', '21', '02', '70+'];

// Track names = proper nouns (album tracks)
const LIMBOS_TRACKS = [
  'Abyss', 'Cephal', 'Limbos', 'Reaper', 'Nortkele',
  'Muld', 'Simetra', 'Zenith', 'Chimie Électrique (Emotional Remix)',
];

// Catalogue : titles + dates techniques, rien a traduire (proper nouns)
const CATALOGUE = [
  { title: 'Voodoo',        type: 'Single', date: 'Feb 2026', img: '/images/Voodoo.webp' },
  { title: 'Limbos',        type: 'Album',  date: 'Oct 2025', img: '/images/Limbos.webp' },
  { title: 'Sync Button',   type: 'Single', date: 'May 2025', img: '/images/SyncButton.webp' },
  { title: 'Kouklikou',     type: 'Single', date: 'May 2025', img: '/images/Kouklikou.webp' },
  { title: 'Anarchic',      type: 'Single', date: 'May 2025', img: '/images/Anarchic.webp' },
  { title: 'Autopsynth',    type: 'Single', date: 'Mar 2025', img: '/images/Autopsynth.webp' },
  { title: 'Back On Track', type: 'Single', date: 'Mar 2025', img: '/images/BackOnTrack.webp' },
  { title: 'Nocturne',      type: 'Single', date: 'Feb 2025', img: '/images/Nocturne.webp' },
  { title: 'Coagule',       type: 'Single', date: 'Feb 2025', img: '/images/Coagule.webp' },
  { title: 'Richie',        type: 'Single', date: 'Jan 2025', img: '/images/Richie.webp' },
  { title: 'Tati Cardi',    type: 'EP',     date: 'Dec 2024', img: '/images/Tati Cardi.webp' },
  { title: 'Drama Queen',   type: 'Single', date: 'Dec 2024', img: '/images/Drama Queen 1.webp' },
  { title: 'Discowriders',  type: 'Single', date: 'Jul 2024', img: '/images/Discowriders.webp' },
];

// Icones sociales + liste CONTACTS deplacees vers ui/SocialIcons.tsx
// (utilisees par SocialSidebar desktop + MobileMenu burger).

function trackDownload() {
  if (typeof window !== 'undefined' && (window as any).fbq) {
    (window as any).fbq('track', 'Lead', {
      content_name: 'Press Kit Download 2026',
      content_category: 'Download',
    });
  }
}

const Presskit: React.FC<PresskitProps> = ({ onNavigateToMessage }) => {
  const { t } = useTranslation();
  const p = t.presskit;

  // Stats dynamiques : combine chiffre + label localise
  const stats = STAT_KEYS.map((key, i) => ({
    num: STAT_NUMS[i],
    label: p[key],
  }));

  const [dlTitleLine1, dlTitleLine2] = p.downloadTitle.split('\n');

  return (
    <div className="pk-page">
      {/* SectionHeader retire : plus de gros titre "About" en tete */}

      {/* Catchphrase RAW. HYPNOTIC. UNDERGROUND. retiree d'ici - deplacee dans le Hero */}

      {/* === HERO MAGAZINE : 2-col image / bio (titre MAUDITE MACHINE + tags genres supprimes, redondants) === */}
      <section className="py-8 md:py-16 mb-12 md:mb-20">
        {/* Grid 2-col : image gauche / bio droite */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-start">
          {/* Image magazine — col 5 — vraie photo presse couleur Maudite Machine */}
          <div
            className="md:col-span-5 animate-fade-up"
            style={{ animationDelay: '120ms', animationFillMode: 'both' }}
          >
            <div className="relative w-full aspect-[4/5] overflow-hidden rounded-2xl md:rounded-3xl bg-black/40">
              <img
                src="/images/MauditeMachine-2.webp"
                alt="Maudite Machine"
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
              />
            </div>
          </div>

          {/* Bio — col 7 : kicker + TAGLINE MASSIVE + bio paragraphs + quote */}
          <div
            className="md:col-span-7 animate-fade-up"
            style={{ animationDelay: '220ms', animationFillMode: 'both' }}
          >
            <div className="text-base md:text-lg font-extrabold uppercase tracking-wide text-white mb-4 md:mb-5">
              {p.bioLabel}
            </div>

            {/* Tagline massive : introduction forte au-dessus de la bio */}
            <div className="mb-6 md:mb-8">
              <div className="font-body font-extrabold uppercase tracking-widest text-white text-lg md:text-xl [text-shadow:_0_2px_10px_rgba(0,0,0,0.5)]">
                {p.metaLine1}
              </div>
              <div className="mt-2 font-body font-semibold tracking-wider text-white/70 text-sm md:text-base [text-shadow:_0_2px_10px_rgba(0,0,0,0.5)]">
                {p.metaLine2}
              </div>
            </div>

            <p className="font-body text-lg font-medium leading-relaxed text-ink-95 mb-5 md:mb-6 [text-shadow:_0_2px_10px_rgba(0,0,0,0.5)]">
              {p.bioMain}
            </p>
            <p className="font-body text-lg font-medium leading-relaxed text-ink-85 mb-6 md:mb-8">
              {p.bioSecondary}
            </p>
            <blockquote className="font-display italic text-xl md:text-3xl lg:text-4xl leading-tight tracking-[-0.02em] text-ink-95 border-l-2 border-white/30 pl-5 md:pl-7">
              <span className="text-white/40">« </span>
              {p.bioQuote}
              <span className="text-white/40"> »</span>
            </blockquote>
          </div>
        </div>
      </section>

      {/* === STATS : 4 col une seule ligne, subtitles font-semibold === */}
      <section className="pk-section">
        <div className="text-base md:text-lg font-extrabold uppercase tracking-wide text-white mb-8 md:mb-12">
          {p.statsLabel}
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {stats.map((s, i) => (
            <div
              key={s.num}
              className="flex flex-col gap-2 md:gap-3 animate-fade-up border-l-2 border-white/20 pl-4 md:pl-6"
              style={{
                animationDelay: `${150 + i * 100}ms`,
                animationFillMode: 'both',
              }}
            >
              <span className="font-display font-black text-ink-95 text-[clamp(3rem,7vw,6rem)] leading-none tracking-[-0.04em]">
                {s.num}
              </span>
              <span className="font-body text-sm md:text-base font-semibold uppercase tracking-[0.15em] text-white/90 leading-tight">
                {s.label}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* === REMIX WORK === */}
      <section className="pk-section">
        <div className="text-base md:text-lg font-extrabold uppercase tracking-wide text-white mb-6 md:mb-8">
          {p.remixLabel}
        </div>
        <div className="pk-glass p-5 md:p-10 rounded-2xl md:rounded-3xl">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 font-display font-bold uppercase text-ink-95 text-2xl md:text-4xl lg:text-5xl tracking-[-0.02em]">
            <span>Laurent Garnier</span>
            <span className="text-white/30">/</span>
            <span>Adam Beyer</span>
            <span className="text-white/30">/</span>
            <span>DVS1</span>
          </div>
          <div className="mt-4 md:mt-6 text-xs md:text-sm font-medium text-white/60">
            {p.remixFooter}
          </div>
        </div>
      </section>

      {/* === LATEST ALBUM === */}
      <section className="pk-section">
        <div className="text-base md:text-lg font-extrabold uppercase tracking-wide text-white mb-5">{p.albumLabel}</div>
        <div className="pk-album pk-glass">
          <img className="pk-album-cover" src="/images/Limbos.webp" alt="Limbos" loading="lazy" />
          <div className="pk-album-info">
            <h2 className="pk-album-title">LIMBOS</h2>
            <div className="pk-album-meta pk-dim">{p.albumMeta}</div>
            <p className="pk-album-desc">{p.albumDesc}</p>
            <ol className="pk-tracklist">
              {LIMBOS_TRACKS.map((tr, i) => (
                <li key={tr}><span className="pk-track-num">{String(i+1).padStart(2,'0')}</span> {tr}</li>
              ))}
            </ol>
          </div>
        </div>
      </section>

      {/* === FULL CATALOGUE : 2/4/6 cols + hover massive === */}
      <section className="pk-section">
        <div className="text-base md:text-lg font-extrabold uppercase tracking-wide text-white mb-6 md:mb-10">
          {p.catalogueLabel}
        </div>
        <div className="pk-catalogue-intro pk-glass mb-8 md:mb-12">
          <h2 className="pk-section-title-huge whitespace-pre-line">{p.catalogueTitle}</h2>
          <p>{p.catalogueDesc}</p>
        </div>
        <div className="grid grid-cols-3 md:grid-cols-5 lg:grid-cols-8 gap-2 md:gap-3">
          {CATALOGUE.map((r, i) => (
            <div
              key={r.title}
              className={cn(
                'group relative aspect-square overflow-hidden',
                'rounded-lg md:rounded-xl',
                'border border-white/10 bg-black/20',
                'cursor-pointer',
                'animate-fade-up',
              )}
              style={{
                animationDelay: `${i * 50}ms`,
                animationFillMode: 'both',
              }}
            >
              <img
                src={r.img}
                alt={r.title}
                loading="lazy"
                className="absolute inset-0 w-full h-full object-cover transition-transform duration-500 ease-out-expo group-hover:scale-125"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/95 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-2 md:p-3">
                <div className="font-display font-bold text-white text-xs md:text-sm leading-tight truncate">
                  {r.title}
                </div>
                <div className="font-body text-[9px] md:text-[10px] text-white/70 uppercase tracking-wider mt-0.5 truncate">
                  {r.type} · {r.date}
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* === VRSTL LABEL : logo SVG grand + texte cote === */}
      <section className="pk-section">
        <div className="text-base md:text-lg font-extrabold uppercase tracking-wide text-white mb-6 md:mb-10">
          {p.labelSection}
        </div>
        <div className="pk-glass p-5 md:p-12 rounded-2xl md:rounded-3xl">
          <div className="grid grid-cols-1 md:grid-cols-12 gap-8 md:gap-12 items-center mb-8 md:mb-12">
            <div className="md:col-span-5 flex justify-center md:justify-start">
              <img
                src={import.meta.env.BASE_URL + 'logo/vrstl-logo-clean.svg'}
                alt="VRSTL Records"
                className="w-full max-w-[280px] md:max-w-none h-auto"
                style={{ filter: 'brightness(0) invert(1)' }}
              />
            </div>
            <div className="md:col-span-7 space-y-4 md:space-y-5">
              <p className="font-body text-base md:text-lg leading-relaxed text-ink-95">
                {p.labelDescMain}
              </p>
              <p className="font-body text-base md:text-lg leading-relaxed text-ink-70">
                {p.labelDescSecondary}
              </p>
              <p className="font-body text-sm md:text-base italic text-white/60">
                {p.labelArtisticDirection}
              </p>
            </div>
          </div>

          {/* Roster — noms d'artistes propres, pas traduisibles */}
          <div className="border-t border-white/10 pt-6 md:pt-8">
            <div className="text-sm md:text-base font-extrabold uppercase tracking-wide text-white mb-3 md:mb-4">
              {p.rosterLabel}
            </div>
            <div className="flex flex-wrap items-center gap-x-3 gap-y-2 font-display text-lg md:text-2xl lg:text-3xl font-bold text-ink-95 uppercase tracking-[-0.01em]">
              <span>Julian Rocci</span>
              <span className="text-white/30">·</span>
              <span>Alex Decker</span>
              <span className="text-white/30">·</span>
              <span>Lealtica</span>
              <span className="text-white/30">·</span>
              <span>Jabba2.3</span>
              <span className="text-white/30">·</span>
              <span>Manüman</span>
              <span className="text-white/30">·</span>
              <span>Maudite Machine</span>
            </div>
          </div>
        </div>
      </section>

      {/* === CONTACT === */}
      <section className="pk-section">
        <div className="text-base md:text-lg font-extrabold uppercase tracking-wide text-white mb-6 md:mb-10">
          {p.contactLabel}
        </div>
        <div className="pk-contact-top">
          <div className="pk-contact-card pk-glass">
            <div className="pk-contact-label pk-dim">{p.contactBooking}</div>
            <div className="pk-contact-name">Mika</div>
            <a href="mailto:mauditemachine@gmail.com" className="pk-contact-link">mauditemachine@gmail.com</a>
            <a href="tel:+15146531423" className="pk-contact-link">+1 514 653 1423</a>
            <a href="https://michaelsanchez.massivemedias.com" target="_blank" rel="noreferrer" className="pk-contact-link">Michael Sanchez, portfolio</a>
          </div>
          <div className="pk-contact-card pk-glass">
            <div className="pk-contact-label pk-dim">{p.contactLabelLabel}</div>
            <div className="pk-contact-name">VRSTL Records</div>
            <a href="mailto:vrstlrecords@gmail.com" className="pk-contact-link">vrstlrecords@gmail.com</a>
            <a href="https://vrstlrecords.com" target="_blank" rel="noreferrer" className="pk-contact-link">vrstlrecords.com</a>
          </div>
        </div>

        {/* Grille sociale massive RETIREE : remplacee par SocialSidebar (desktop fixed right)
            + row horizontale dans MobileMenu (burger). Cf src/components/ui/SocialSidebar.tsx */}

        {onNavigateToMessage && (
          <div className="pk-contact-footer">
            <p className="pk-dim">
              {p.mediaText}{' '}
              <button onClick={onNavigateToMessage} className="pk-inline-link">
                {p.mediaLink}
              </button>
            </p>
          </div>
        )}
        <div className="pk-footer-version pk-dim">{p.contactFooterVersion}</div>
      </section>

      {/* === XXL DOWNLOAD BLOCK : le bloc "aimant a clics" === */}
      <a
        href={PDF_URL}
        download
        onClick={trackDownload}
        aria-label={`${dlTitleLine1} ${dlTitleLine2}`}
        className={cn(
          'group block relative mt-16 md:mt-28 mb-8 md:mb-16',
          'rounded-2xl md:rounded-3xl overflow-hidden',
          'border border-ink-10 hover:border-ink-30',
          'bg-glass backdrop-blur-heavy backdrop-saturate-glass',
          'transition-all duration-500 ease-out-expo',
          'hover:shadow-glow-white hover:bg-glass-strong',
          'no-underline text-inherit',
          'animate-fade-up',
        )}
        style={{ animationDelay: '200ms', animationFillMode: 'both' }}
      >
        <div className="relative p-6 md:p-14 lg:p-20">
          <div className="flex items-center justify-between mb-6 md:mb-10 text-sm font-medium text-ink-50 font-body">
            <span>{p.downloadMeta}</span>
            <span>{p.downloadEdition}</span>
          </div>

          <div className="font-display font-black uppercase text-[clamp(3rem,13vw,11rem)] leading-[0.85] tracking-[-0.045em] text-ink-30 group-hover:text-ink-95 transition-colors duration-700 ease-out-expo whitespace-pre-line">
            {p.downloadTitle}
          </div>

          <div className="mt-8 md:mt-12 flex items-center justify-between">
            <span className="text-sm md:text-base text-ink-70 font-body">
              {p.downloadFooter}
            </span>
            <span className="inline-flex items-center justify-center w-14 h-14 md:w-20 md:h-20 rounded-full border border-ink-20 group-hover:border-ink-95 text-ink-85 group-hover:text-ink-95 transition-colors duration-500">
              <svg width="28" height="28" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" className="transform group-hover:translate-y-1 transition-transform duration-400 ease-out-expo">
                <line x1="12" y1="5" x2="12" y2="19" />
                <polyline points="19 12 12 19 5 12" />
              </svg>
            </span>
          </div>
        </div>
      </a>
    </div>
  );
};

export default Presskit;
