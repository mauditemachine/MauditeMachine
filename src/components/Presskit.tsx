/**
 * Page Presskit — contenu du PDF officiel 2026, design liquid-glass.
 */

import React from 'react';
import { useApp } from '../context/AppContext';
import SectionHeader from './ui/SectionHeader';
import { cn } from '../lib/cn';

interface PresskitProps {
  onNavigateToMessage?: () => void;
}

const PDF_URL = `${import.meta.env.BASE_URL}Presskit_Maudite_Machine_2026.pdf`;

const STATS = [
  { num: '15+', fr: 'Années de carrière', en: 'Years active' },
  { num: '21',  fr: 'EPs sur VRSTL',      en: 'EPs released' },
  { num: '02',  fr: 'Albums publiés',     en: 'Albums released' },
  { num: '70+', fr: 'Élèves formés',      en: 'Students taught' },
];

const LIMBOS_TRACKS = [
  'Abyss', 'Cephal', 'Limbos', 'Reaper', 'Nortkele',
  'Muld', 'Simetra', 'Zenith', 'Chimie Électrique (Emotional Remix)',
];

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
  const { t } = useApp();

  return (
    <div className="pk-page">
      {/* === SECTION HEADER MAGAZINE === */}
      <div className="mb-12 md:mb-20 px-0">
        <SectionHeader
          number="02"
          kicker="Presskit · About"
          title="About"
        />
      </div>

      {/* === STORYTELLING : RAW. HYPNOTIC. UNDERGROUND. - fluid + tight === */}
      <section className="py-6 md:py-10 mb-6 md:mb-10">
        {['Raw.', 'Hypnotic.', 'Underground.'].map((word, i) => (
          <div
            key={word}
            className={cn(
              'font-display font-black uppercase text-ink-95',
              'text-[clamp(3rem,13vw,10rem)]',
              'leading-none tracking-[-0.05em]',
              'animate-fade-up',
              i === 0 && 'text-left',
              i === 1 && 'text-right',
              i === 2 && 'text-left md:text-center',
            )}
            style={{
              animationDelay: `${200 + i * 150}ms`,
              animationFillMode: 'both',
            }}
          >
            {word}
          </div>
        ))}
      </section>

      {/* === HERO MAGAZINE : 2-col image / bio + meta === */}
      <section className="py-8 md:py-16 mb-12 md:mb-20">
        {/* Kicker metadata — plus visible : font-medium + text-white/80 */}
        <div className="flex flex-wrap items-center gap-x-6 gap-y-2 mb-8 md:mb-12 text-xs md:text-sm font-medium uppercase tracking-[0.25em] text-white/80">
          <span>Press Kit / 2026</span>
          <span className="opacity-40">·</span>
          <span>Minimal</span>
          <span className="opacity-40">·</span>
          <span>Indie Dance</span>
          <span className="opacity-40">·</span>
          <span>Dark Disco</span>
        </div>

        {/* Titre magazine massif */}
        <h1 className="font-display font-black uppercase text-ink-95 text-[clamp(2.5rem,10vw,8rem)] leading-[0.85] tracking-[-0.05em] mb-10 md:mb-16 animate-fade-up">
          Maudite
          <br />
          Machine
        </h1>

        {/* Grid 2-col : image gauche / bio droite */}
        <div className="grid grid-cols-1 md:grid-cols-12 gap-6 md:gap-10 items-start">
          {/* Image magazine — col 5 */}
          <div
            className="md:col-span-5 animate-fade-up"
            style={{ animationDelay: '120ms', animationFillMode: 'both' }}
          >
            <div className="relative w-full aspect-[4/5] overflow-hidden rounded-2xl md:rounded-3xl">
              <img
                src="/images/presskit-hero.webp"
                alt="Maudite Machine"
                className="absolute inset-0 w-full h-full object-cover"
                loading="eager"
              />
              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent" />
              <div className="absolute bottom-4 left-4 right-4 text-white/90 text-xs md:text-sm font-medium uppercase tracking-[0.2em]">
                DJ · Producer · VRSTL Records
                <div className="text-white/60 mt-1 normal-case tracking-normal">Montréal / Canada</div>
              </div>
            </div>
          </div>

          {/* Bio — col 7, one main paragraph FR + EN condense */}
          <div
            className="md:col-span-7 animate-fade-up"
            style={{ animationDelay: '220ms', animationFillMode: 'both' }}
          >
            <div className="text-sm md:text-base font-medium uppercase tracking-[0.25em] text-white/80 mb-5 md:mb-7">
              — Biographie / Biography
            </div>
            <p className="font-body text-lg md:text-xl lg:text-2xl leading-relaxed text-ink-95 mb-5 md:mb-6 [text-shadow:_0_2px_10px_rgba(0,0,0,0.5)]">
              Maudite Machine est un DJ et producteur canadien reconnu pour son approche
              brute et hypnotique de la minimal et de l'indie dance. Né de l'underground
              montréalais, il s'est produit dans des événements majeurs et des lieux
              emblématiques à travers le pays, livrant des sets qui brouillent la frontière
              entre intensité et atmosphère.
            </p>
            <p className="font-body text-base md:text-lg leading-relaxed text-ink-70 mb-6 md:mb-8">
              As the founder of VRSTL Records, he curates a sound that embraces tension,
              groove, and experimentation — pushing boundaries and redefining the underground
              with a distinct sonic signature.
            </p>
            <blockquote className="font-display italic text-xl md:text-3xl lg:text-4xl leading-tight tracking-[-0.02em] text-ink-95 border-l-2 border-white/30 pl-5 md:pl-7">
              <span className="text-white/40">« </span>
              Un son qui embrasse la tension, le groove et l'expérimentation
              <span className="text-white/40"> »</span>
            </blockquote>
          </div>
        </div>
      </section>

      {/* === STATS : 4 col une seule ligne, subtitles font-semibold === */}
      <section className="pk-section">
        <div className="text-sm md:text-base font-medium uppercase tracking-[0.25em] text-white/80 mb-8 md:mb-12">
          — En chiffres / By the numbers
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-6 md:gap-8">
          {STATS.map((s, i) => (
            <div
              key={s.num}
              className="flex flex-col gap-2 md:gap-3 animate-fade-up border-l-2 border-white/20 pl-4 md:pl-6"
              style={{
                animationDelay: `${150 + i * 100}ms`,
                animationFillMode: 'both',
              }}
            >
              <span className="font-display font-black text-ink-95
                               text-[clamp(3rem,7vw,6rem)]
                               leading-none tracking-[-0.04em]">
                {s.num}
              </span>
              <span className="font-body text-sm md:text-base
                               font-semibold uppercase tracking-[0.15em] text-white/90
                               leading-tight">
                {s.fr}
              </span>
              <span className="font-body text-xs md:text-sm text-white/50 leading-tight">
                {s.en}
              </span>
            </div>
          ))}
        </div>
      </section>

      {/* === REMIX WORK (Performances deplacees vers #shows Wall of Fame) === */}
      <section className="pk-section">
        <div className="text-sm md:text-base font-medium uppercase tracking-[0.25em] text-white/80 mb-6 md:mb-8">
          — Remix work for / Remixes pour
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
            Full performance archive → Wall of Fame
          </div>
        </div>
      </section>

      {/* === LATEST ALBUM === */}
      <section className="pk-section">
        <div className="pk-section-label">— Dernier album / Latest album</div>
        <div className="pk-album pk-glass">
          <img className="pk-album-cover" src="/images/Limbos.webp" alt="Limbos" loading="lazy" />
          <div className="pk-album-info">
            <h2 className="pk-album-title">LIMBOS</h2>
            <div className="pk-album-meta pk-dim">VRSTL Records · Octobre 2025 · 9 tracks</div>
            <p className="pk-album-desc">
              L'espace entre la fin et le recommencement. Cet album traduit en impulsions
              électroniques l'expérience d'un arrêt complet, le passage vers l'au-delà et le
              retour inattendu. Chaque titre explore ces territoires extrêmes où la conscience
              se dissout puis se reforme.
            </p>
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
          — Full catalogue / Catalogue complet
        </div>
        <div className="pk-catalogue-intro pk-glass mb-8 md:mb-12">
          <h2 className="pk-section-title-huge">13 RELEASES.<br/>2024 — 2026.</h2>
          <p>
            De Discowriders (Jul 2024) à Voodoo (Feb 2026), un flux constant de productions
            originales sur VRSTL Records. Singles, EPs et un album, dans une esthétique dark
            disco, indie dance et minimal hypnotique.
          </p>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4 overflow-visible">
          {CATALOGUE.map((r, i) => (
            <div
              key={r.title}
              className={cn(
                'group relative rounded-xl md:rounded-2xl overflow-hidden',
                'border border-white/10 bg-black/20 backdrop-blur-sm',
                'transition-all duration-300 ease-out-expo',
                'hover:scale-125 hover:z-50 hover:shadow-2xl hover:border-white/40',
                'cursor-pointer origin-center',
                'animate-fade-up',
              )}
              style={{
                animationDelay: `${i * 60}ms`,
                animationFillMode: 'both',
              }}
            >
              <div className="relative aspect-square overflow-hidden">
                <img
                  src={r.img}
                  alt={r.title}
                  loading="lazy"
                  className="absolute inset-0 w-full h-full object-cover"
                />
                {/* Overlay details au hover */}
                <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/40 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex flex-col justify-end p-3">
                  <div className="font-display font-bold text-white text-sm md:text-base leading-tight">
                    {r.title}
                  </div>
                  <div className="font-body text-[10px] md:text-xs text-white/70 uppercase tracking-wider mt-1">
                    {r.type} · {r.date}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* === VRSTL LABEL : logo SVG grand + texte cote === */}
      <section className="pk-section">
        <div className="text-sm md:text-base font-medium uppercase tracking-[0.25em] text-white/80 mb-6 md:mb-10">
          — Label
        </div>
        <div className="pk-glass p-6 md:p-12 rounded-2xl md:rounded-3xl">
          {/* Grid : logo XXL gauche / texte droite */}
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
                <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-[2px] rounded bg-white/10 border border-white/20 mr-2 align-middle">FR</span>
                VRSTL Records est un label indépendant canadien dédié à l'Indie Dance et au Dark Disco.
                Depuis sa fondation, le label a publié 21 EPs et 2 albums, signant des artistes
                émergents d'Argentine, du Québec et d'Europe.
              </p>
              <p className="font-body text-base md:text-lg leading-relaxed text-ink-70">
                <span className="inline-block text-[10px] font-bold uppercase tracking-[0.2em] px-2 py-[2px] rounded bg-white/10 border border-white/20 mr-2 align-middle">EN</span>
                VRSTL Records is an independent Canadian label dedicated to Indie Dance and Dark Disco.
                Since its founding, the label has released 21 EPs and 2 albums.
              </p>
              <p className="font-body text-sm md:text-base italic text-white/60">
                Direction artistique : tension, groove, expérimentation. Un catalogue qui redéfinit
                les frontières de l'underground électronique.
              </p>
            </div>
          </div>

          {/* Roster */}
          <div className="border-t border-white/10 pt-6 md:pt-8">
            <div className="text-xs md:text-sm font-medium uppercase tracking-[0.25em] text-white/80 mb-3 md:mb-4">
              Roster / Artistes signés
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
          — Contact
        </div>
        <div className="pk-contact-top">
          <div className="pk-contact-card pk-glass">
            <div className="pk-contact-label pk-dim">Booking · Management</div>
            <div className="pk-contact-name">Mika</div>
            <a href="mailto:mauditemachine@gmail.com" className="pk-contact-link">mauditemachine@gmail.com</a>
            <a href="tel:+15146531423" className="pk-contact-link">+1 514 653 1423</a>
          </div>
          <div className="pk-contact-card pk-glass">
            <div className="pk-contact-label pk-dim">Label</div>
            <div className="pk-contact-name">VRSTL Records</div>
            <a href="mailto:vrstlrecords@gmail.com" className="pk-contact-link">vrstlrecords@gmail.com</a>
            <a href="https://vrstlrecords.com" target="_blank" rel="noreferrer" className="pk-contact-link">vrstlrecords.com</a>
          </div>
        </div>

        {/* Social grid : icones blanches + label + value */}
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4 mt-6 md:mt-10">
          {CONTACTS.map((c) => (
            <a
              key={c.label}
              href={c.href}
              target="_blank"
              rel="noreferrer"
              className={cn(
                'group pk-glass rounded-xl md:rounded-2xl p-4 md:p-5',
                'flex items-center gap-3 md:gap-4',
                'transition-all duration-300',
                'hover:border-white/40 hover:bg-white/[0.07]',
              )}
            >
              <span className="shrink-0 w-10 h-10 md:w-11 md:h-11 rounded-full bg-white/10 border border-white/20 flex items-center justify-center text-white group-hover:bg-white/20 group-hover:scale-110 transition-all duration-300">
                {c.icon}
              </span>
              <span className="flex-1 min-w-0">
                <span className="block text-[10px] md:text-xs font-semibold uppercase tracking-[0.15em] text-white/60 mb-0.5">
                  {c.label}
                </span>
                <span className="block text-sm md:text-base font-medium text-white truncate">
                  {c.value}
                </span>
              </span>
            </a>
          ))}
        </div>

        {onNavigateToMessage && (
          <div className="pk-contact-footer">
            <p className="pk-dim">
              {t.presskit?.mediaText || 'Pour interviews, bookings et demandes média,'}{' '}
              <button onClick={onNavigateToMessage} className="pk-inline-link">
                {t.presskit?.mediaLink || 'écrire un message ici'}
              </button>
            </p>
          </div>
        )}
        <div className="pk-footer-version pk-dim">© 2026 Maudite Machine / VRSTL Records · Press Kit V.2026</div>
      </section>

      {/* === XXL DOWNLOAD BLOCK : le bloc "aimant a clics" === */}
      <a
        href={PDF_URL}
        download
        onClick={trackDownload}
        aria-label="Télécharger le press kit (PDF 10 MB)"
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
          {/* Kicker top */}
          <div className="flex items-center justify-between mb-6 md:mb-10 text-sm md:text-sm uppercase tracking-[0.3em] text-ink-50 font-body">
            <span>PDF · 10 MB · EN / FR</span>
            <span>2026 Edition</span>
          </div>

          {/* Titre massif qui se remplit au hover (blanc dim → blanc pur) */}
          <div className="font-display font-black uppercase
                          text-[clamp(3rem,13vw,11rem)]
                          leading-[0.85] tracking-[-0.045em]
                          text-ink-30 group-hover:text-ink-95
                          transition-colors duration-700 ease-out-expo">
            Download
            <br />
            Presskit
          </div>

          {/* Footer : fleche + meta */}
          <div className="mt-8 md:mt-12 flex items-center justify-between">
            <span className="text-sm md:text-base text-ink-70 font-body">
              Full dossier · photos · bio · tech rider
            </span>
            <span
              className="inline-flex items-center justify-center w-14 h-14 md:w-20 md:h-20
                         rounded-full border border-ink-20 group-hover:border-ink-95
                         text-ink-85 group-hover:text-ink-95
                         transition-colors duration-500"
            >
              <svg
                width="28"
                height="28"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.5"
                className="transform group-hover:translate-y-1 transition-transform duration-400 ease-out-expo"
              >
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
