/**
 * Page Presskit — contenu du PDF officiel 2026, design liquid-glass.
 * Tous les textes visibles passent par useTranslation() (i18n EN/FR/ES).
 */

import React from 'react';
import { useTranslation } from '../lib/i18n';
import SectionHeader from './ui/SectionHeader';
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

// Icones SVG monochromes blanches pour chaque reseau (inline pour eviter dep lucide)
const ICON_PROPS = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

const IconGlobe = (
  <svg {...ICON_PROPS}><circle cx="12" cy="12" r="10"/><path d="M2 12h20M12 2a15 15 0 0 1 0 20M12 2a15 15 0 0 0 0 20"/></svg>
);
const IconSpotify = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.38-1.32 9.78-.66 13.5 1.62.36.18.48.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z"/></svg>
);
const IconApple = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z"/></svg>
);
const IconInstagram = (
  <svg {...ICON_PROPS}><rect x="2" y="2" width="20" height="20" rx="5" ry="5"/><path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z"/><line x1="17.5" y1="6.5" x2="17.51" y2="6.5"/></svg>
);
const IconFacebook = (
  <svg {...ICON_PROPS}><path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z"/></svg>
);
const IconYouTube = (
  <svg {...ICON_PROPS}><path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z"/><polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02"/></svg>
);
const IconMusic = (
  <svg {...ICON_PROPS}><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
);
const IconSoundcloud = (
  <svg {...ICON_PROPS}><path d="M3 15v-3M6 17v-7M9 18V9M12 18V6M15 18v-9M18 18v-6"/><path d="M21 18a3 3 0 0 0 0-6"/></svg>
);
const IconTikTok = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.93a8.16 8.16 0 0 0 4.77 1.52V7a4.85 4.85 0 0 1-1.84-.31z"/></svg>
);
const IconLink = (
  <svg {...ICON_PROPS}><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
);

// Contacts : labels = noms des plateformes (proper nouns, pas traduisibles).
// Le premier (Site) utilise la cle "Site" qui peut etre localisee si besoin.
const CONTACTS: { label: string; value: string; href: string; icon: React.ReactNode }[] = [
  { label: 'Site',        value: 'mauditemachine.com',         href: 'https://mauditemachine.com',                       icon: IconGlobe },
  { label: 'Spotify',     value: '/artist/maudite-machine',    href: 'https://open.spotify.com/artist/maudite-machine',  icon: IconSpotify },
  { label: 'Beatport',    value: '/artist/maudite-machine',    href: 'https://beatport.com/artist/maudite-machine',      icon: IconMusic },
  { label: 'Bandcamp',    value: 'mauditemachine.bandcamp.com',href: 'https://mauditemachine.bandcamp.com',               icon: IconMusic },
  { label: 'SoundCloud',  value: '/mauditemachine',            href: 'https://soundcloud.com/mauditemachine',             icon: IconSoundcloud },
  { label: 'Apple Music', value: '/artist/maudite-machine',    href: 'https://music.apple.com/artist/maudite-machine',    icon: IconApple },
  { label: 'Instagram',   value: '@mauditemachine',            href: 'https://instagram.com/mauditemachine',              icon: IconInstagram },
  { label: 'Facebook',    value: '/mauditemachine',            href: 'https://facebook.com/mauditemachine',               icon: IconFacebook },
  { label: 'YouTube',     value: '@mauditemachine-official',   href: 'https://youtube.com/@mauditemachine-official',      icon: IconYouTube },
  { label: 'Mixcloud',    value: '/mauditemachine',            href: 'https://mixcloud.com/mauditemachine',               icon: IconMusic },
  { label: 'TikTok',      value: '@mauditemachine',            href: 'https://tiktok.com/@mauditemachine',                icon: IconTikTok },
  { label: 'Linktree',    value: 'bit.ly/41mdgdg',              href: 'https://bit.ly/41mdgdg',                             icon: IconLink },
];

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
      {/* === SECTION HEADER MAGAZINE === */}
      <div className="mb-12 md:mb-20 px-0">
        <SectionHeader title={p.sectionTitle} />
      </div>

      {/* === STORYTELLING : RAW. HYPNOTIC. UNDERGROUND. - texte normal === */}
      <section className="py-4 md:py-8 mb-6 md:mb-10">
        <div
          className="font-display font-black uppercase text-ink-95 whitespace-nowrap tracking-normal inline-block text-[clamp(2rem,5vw,5rem)] leading-none animate-fade-up"
          style={{ animationDelay: '200ms', animationFillMode: 'both' }}
        >
          {p.catchphrase}
        </div>
      </section>

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
              <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/10 to-transparent pointer-events-none" />
              <div className="absolute bottom-4 left-4 right-4">
                <div className="text-white text-xs md:text-sm font-semibold uppercase tracking-[0.2em]">
                  {p.metaLine1}
                </div>
                <div className="text-white/70 mt-1 text-xs md:text-sm font-medium">
                  {p.metaLine2}
                </div>
              </div>
            </div>
          </div>

          {/* Bio — col 7, main paragraph + secondary + quote */}
          <div
            className="md:col-span-7 animate-fade-up"
            style={{ animationDelay: '220ms', animationFillMode: 'both' }}
          >
            <div className="text-sm md:text-base font-medium uppercase tracking-[0.25em] text-white/80 mb-5 md:mb-7">
              {p.bioLabel}
            </div>
            <p className="font-body text-lg font-light leading-relaxed text-ink-95 mb-5 md:mb-6 [text-shadow:_0_2px_10px_rgba(0,0,0,0.5)]">
              {p.bioMain}
            </p>
            <p className="font-body text-lg font-light leading-relaxed text-ink-85 mb-6 md:mb-8">
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
        <div className="text-sm md:text-base font-medium uppercase tracking-[0.25em] text-white/80 mb-8 md:mb-12">
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
        <div className="text-sm md:text-base font-medium uppercase tracking-[0.25em] text-white/80 mb-6 md:mb-8">
          {p.remixLabel}
        </div>
        <div className="pk-glass p-6 md:p-10 rounded-2xl md:rounded-3xl">
          <div className="flex flex-wrap items-center gap-x-4 gap-y-3 font-display font-bold uppercase text-ink-95 text-2xl md:text-4xl lg:text-5xl tracking-[-0.02em]">
            <span>Laurent Garnier</span>
            <span className="text-white/30">/</span>
            <span>Adam Beyer</span>
            <span className="text-white/30">/</span>
            <span>DVS1</span>
          </div>
          <div className="mt-4 md:mt-6 text-xs md:text-sm font-medium uppercase tracking-[0.2em] text-white/60">
            {p.remixFooter}
          </div>
        </div>
      </section>

      {/* === LATEST ALBUM === */}
      <section className="pk-section">
        <div className="pk-section-label">{p.albumLabel}</div>
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
        <div className="text-sm md:text-base font-medium uppercase tracking-[0.25em] text-white/80 mb-6 md:mb-10">
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
        <div className="text-sm md:text-base font-medium uppercase tracking-[0.25em] text-white/80 mb-6 md:mb-10">
          {p.labelSection}
        </div>
        <div className="pk-glass p-6 md:p-12 rounded-2xl md:rounded-3xl">
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
            <div className="text-xs md:text-sm font-medium uppercase tracking-[0.25em] text-white/80 mb-3 md:mb-4">
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
        <div className="text-sm md:text-base font-medium uppercase tracking-[0.25em] text-white/80 mb-6 md:mb-10">
          {p.contactLabel}
        </div>
        <div className="pk-contact-top">
          <div className="pk-contact-card pk-glass">
            <div className="pk-contact-label pk-dim">{p.contactBooking}</div>
            <div className="pk-contact-name">Mika</div>
            <a href="mailto:mauditemachine@gmail.com" className="pk-contact-link">mauditemachine@gmail.com</a>
            <a href="tel:+15146531423" className="pk-contact-link">+1 514 653 1423</a>
          </div>
          <div className="pk-contact-card pk-glass">
            <div className="pk-contact-label pk-dim">{p.contactLabelLabel}</div>
            <div className="pk-contact-name">VRSTL Records</div>
            <a href="mailto:vrstlrecords@gmail.com" className="pk-contact-link">vrstlrecords@gmail.com</a>
            <a href="https://vrstlrecords.com" target="_blank" rel="noreferrer" className="pk-contact-link">vrstlrecords.com</a>
          </div>
        </div>

        {/* Social grid : icone + nom de plateforme uniquement (URLs cachees) */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mt-6 md:mt-10">
          {CONTACTS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              target="_blank"
              rel="noreferrer"
              aria-label={c.label}
              className={cn(
                'group pk-glass rounded-xl md:rounded-2xl',
                'p-5 md:p-6',
                'flex items-center gap-4 justify-center',
                'text-white no-underline',
                'transition-all duration-300',
                'hover:border-white/40 hover:bg-white/[0.07]',
              )}
              style={{ color: '#fff', textDecoration: 'none' }}
            >
              <span className="shrink-0 w-11 h-11 md:w-12 md:h-12 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300">
                {c.icon}
              </span>
              <span className="text-xl md:text-2xl font-bold text-white capitalize">
                {c.label}
              </span>
            </a>
          ))}
        </div>

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
        <div className="relative p-8 md:p-14 lg:p-20">
          <div className="flex items-center justify-between mb-6 md:mb-10 text-sm md:text-sm uppercase tracking-[0.3em] text-ink-50 font-body">
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
