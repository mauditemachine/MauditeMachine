/**
 * Goodies — wallpapers + covers + stickers en telechargement gratuit.
 *
 * Telechargement BLINDE MOBILE : chaque carte est un <motion.a download>
 * natif HTML, pas de JS fetch/blob/createObjectURL qui bloque sur iOS Safari.
 * Le browser fait le download lui-meme via l'attribut HTML `download`,
 * fallback target=_blank pour iOS qui ignore parfois `download` -> au moins
 * l'utilisateur peut "Save Image" via long-press.
 */

import React, { useState } from 'react';
import { motion } from 'framer-motion';
import { useTranslation } from '../lib/i18n';
import { cn } from '../lib/cn';

interface GoodieItem {
  src: string;          // Affichage low-res (thumb)
  downloadSrc?: string; // Telechargement haute resolution (fallback: src)
  title: string;
  category: string;
}

const FULL_PREFIX = 'images/goodies/full/';
const goodies: GoodieItem[] = [
  // Desktop Wallpapers
  { src: 'images/goodies/wallpaper-desktop-1.webp', downloadSrc: FULL_PREFIX + 'wallpaper-desktop-1.webp', title: 'Desktop Wallpaper 1', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-2.webp', downloadSrc: FULL_PREFIX + 'wallpaper-desktop-2.webp', title: 'Desktop Wallpaper 2', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-3.webp', downloadSrc: FULL_PREFIX + 'wallpaper-desktop-3.webp', title: 'Desktop Wallpaper 3', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-4.webp', downloadSrc: FULL_PREFIX + 'wallpaper-desktop-4.webp', title: 'Desktop Wallpaper 4', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-5.webp', downloadSrc: FULL_PREFIX + 'wallpaper-desktop-5.webp', title: 'Desktop Wallpaper 5', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-6.webp', downloadSrc: FULL_PREFIX + 'wallpaper-desktop-6.webp', title: 'Desktop Wallpaper 6', category: 'wallpaper-desktop' },
  // Phone Wallpapers
  { src: 'images/goodies/wallpaper-phone-1.webp', downloadSrc: FULL_PREFIX + 'wallpaper-phone-1.webp', title: 'Phone Wallpaper 1', category: 'wallpaper-phone' },
  { src: 'images/goodies/wallpaper-phone-2.webp', downloadSrc: FULL_PREFIX + 'wallpaper-phone-2.webp', title: 'Phone Wallpaper 2', category: 'wallpaper-phone' },
  { src: 'images/goodies/wallpaper-phone-3.webp', downloadSrc: FULL_PREFIX + 'wallpaper-phone-3.webp', title: 'Phone Wallpaper 3', category: 'wallpaper-phone' },
  { src: 'images/goodies/wallpaper-phone-4.webp', downloadSrc: FULL_PREFIX + 'wallpaper-phone-4.webp', title: 'Phone Wallpaper 4', category: 'wallpaper-phone' },
  { src: 'images/goodies/wallpaper-phone-5.webp', downloadSrc: FULL_PREFIX + 'wallpaper-phone-5.webp', title: 'Phone Wallpaper 5', category: 'wallpaper-phone' },
  // Album Covers
  { src: 'images/goodies/cover-limbos.webp', downloadSrc: FULL_PREFIX + 'cover-limbos.webp', title: 'Limbos', category: 'cover' },
  { src: 'images/goodies/cover-anarchic.webp', downloadSrc: FULL_PREFIX + 'cover-anarchic.webp', title: 'Anarchic', category: 'cover' },
  { src: 'images/goodies/cover-nocturne.webp', downloadSrc: FULL_PREFIX + 'cover-nocturne.webp', title: 'Nocturne', category: 'cover' },
  { src: 'images/goodies/cover-backontrack.webp', downloadSrc: FULL_PREFIX + 'cover-backontrack.webp', title: 'Back On Track', category: 'cover' },
  { src: 'images/goodies/cover-dramaqueen.webp', downloadSrc: FULL_PREFIX + 'cover-dramaqueen.webp', title: 'Drama Queen', category: 'cover' },
  { src: 'images/goodies/cover-taticardi.webp', downloadSrc: FULL_PREFIX + 'cover-taticardi.webp', title: 'Crush On You', category: 'cover' },
  { src: 'images/goodies/cover-taticardi2.webp', downloadSrc: FULL_PREFIX + 'cover-taticardi2.webp', title: 'Tati Cardi', category: 'cover' },
  { src: 'images/goodies/cover-taticardi-remixes.webp', downloadSrc: FULL_PREFIX + 'cover-taticardi-remixes.webp', title: 'Tati Cardi Remixes', category: 'cover' },
  { src: 'images/goodies/cover-discowriders.webp', downloadSrc: FULL_PREFIX + 'cover-discowriders.webp', title: 'Discowriders', category: 'cover' },
  { src: 'images/goodies/cover-coagule.webp', downloadSrc: FULL_PREFIX + 'cover-coagule.webp', title: 'Coagule', category: 'cover' },
  { src: 'images/goodies/cover-voodoo.webp', downloadSrc: FULL_PREFIX + 'cover-voodoo.webp', title: 'Voodoo', category: 'cover' },
  { src: 'images/goodies/cover-autopsynth.webp', downloadSrc: FULL_PREFIX + 'cover-autopsynth.webp', title: 'Autopsynth', category: 'cover' },
  { src: 'images/goodies/cover-autopsynth-alt.webp', downloadSrc: FULL_PREFIX + 'cover-autopsynth-alt.webp', title: 'Autopsynth (Alt)', category: 'cover' },
  { src: 'images/goodies/cover-richie.webp', downloadSrc: FULL_PREFIX + 'cover-richie.webp', title: 'Richie', category: 'cover' },
  { src: 'images/goodies/cover-kouklikou.webp', downloadSrc: FULL_PREFIX + 'cover-kouklikou.webp', title: 'Kouklikou', category: 'cover' },
  { src: 'images/goodies/cover-syncbutton.webp', downloadSrc: FULL_PREFIX + 'cover-syncbutton.webp', title: 'Where Is The Sync Button', category: 'cover' },
  { src: 'images/goodies/cover-digitalworms.webp', downloadSrc: FULL_PREFIX + 'cover-digitalworms.webp', title: 'Digital Worms Attack', category: 'cover' },
  { src: 'images/goodies/cover-vsnocide.webp', downloadSrc: FULL_PREFIX + 'cover-vsnocide.webp', title: 'VS Nocide', category: 'cover' },
  { src: 'images/goodies/cover-mixtape36.webp', downloadSrc: FULL_PREFIX + 'cover-mixtape36.webp', title: 'Mixtape 36', category: 'cover' },
  { src: 'images/goodies/cover-mixtape37.webp', downloadSrc: FULL_PREFIX + 'cover-mixtape37.webp', title: 'Mixtape 37', category: 'cover' },
  { src: 'images/goodies/cover-mixtape38.webp', downloadSrc: FULL_PREFIX + 'cover-mixtape38.webp', title: 'Mixtape 38', category: 'cover' },
];

// Genere un nom de fichier propre : MauditeMachine_<Title>.<ext>
function buildFilename(item: GoodieItem): string {
  const downloadUrl = item.downloadSrc || item.src;
  const ext = downloadUrl.split('.').pop() || 'webp';
  const safeName = item.title.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `MauditeMachine_${safeName}.${ext}`;
}

// Icone download
const IconDownload = (
  <svg
    width="16"
    height="16"
    viewBox="0 0 24 24"
    fill="none"
    stroke="currentColor"
    strokeWidth="2"
    strokeLinecap="round"
    strokeLinejoin="round"
    aria-hidden="true"
  >
    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
    <polyline points="7 10 12 15 17 10" />
    <line x1="12" y1="15" x2="12" y2="3" />
  </svg>
);

interface GoodiesProps {
  mobileOnly?: boolean;
}

type AccordionKey = 'desktop' | 'phone' | 'covers';

const Goodies: React.FC<GoodiesProps> = ({ mobileOnly = false }) => {
  const { t } = useTranslation();
  const desktopWallpapers = goodies.filter((g) => g.category === 'wallpaper-desktop');
  const phoneWallpapers = goodies.filter((g) => g.category === 'wallpaper-phone');
  const covers = goodies.filter((g) => g.category === 'cover');
  const [openSection, setOpenSection] = useState<AccordionKey | null>('covers');

  const toggle = (key: AccordionKey) => {
    setOpenSection((prev) => (prev === key ? null : key));
  };

  // Carte download : <motion.a download> natif HTML, mobile-first.
  // Aucun JS fetch/blob/click() qui casse sur iOS Safari.
  const renderCard = (item: GoodieItem, i: number, aspectClass: string, staggerMs = 40) => {
    const downloadUrl = `/${item.downloadSrc || item.src}`;
    const filename = buildFilename(item);

    return (
      <motion.a
        key={i}
        href={downloadUrl}
        download={filename}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t.goodies.download} — ${item.title}`}
        whileHover={{ scale: 1.02, y: -2 }}
        whileTap={{ scale: 0.98 }}
        className={cn(
          'group relative block rounded-xl md:rounded-2xl',
          'bg-white/5 hover:bg-white/10',
          'border border-white/10 hover:border-white/30',
          'backdrop-blur-md',
          'overflow-hidden',
          'transition-all duration-300 ease-out',
          'hover:shadow-[0_0_20px_rgba(255,255,255,0.15)]',
          'no-underline text-inherit',
          'p-2 md:p-2.5',
          'animate-fade-up',
        )}
        style={{
          color: '#fff',
          textDecoration: 'none',
          animationDelay: `${i * staggerMs}ms`,
          animationFillMode: 'both',
        }}
      >
        <div className={cn('relative overflow-hidden rounded-md bg-black/40', aspectClass)}>
          <img
            src={`/${item.src}`}
            alt={item.title}
            loading="lazy"
            className="w-full h-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.06]"
          />
          {/* Overlay download icon (apparait au hover) */}
          <div className="absolute inset-0 bg-gradient-to-t from-black/70 via-black/20 to-transparent opacity-0 group-hover:opacity-100 transition-opacity duration-300 flex items-end justify-center pb-3">
            <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/15 border border-white/30 backdrop-blur-sm text-white text-xs uppercase tracking-wider font-semibold">
              {IconDownload}
              {t.goodies.download}
            </span>
          </div>
        </div>
        <div className="mt-2 px-1 flex items-center justify-between gap-2">
          <span className="text-sm text-ink-85 truncate font-body" title={item.title}>
            {item.title}
          </span>
          <span className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-full bg-white/5 border border-white/15 text-white/85 group-hover:bg-white/15 group-hover:border-white/40 group-hover:text-white transition-all duration-300">
            {IconDownload}
          </span>
        </div>
      </motion.a>
    );
  };

  if (mobileOnly) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {phoneWallpapers.map((item, i) => renderCard(item, i, 'aspect-[9/16]'))}
        </div>
      </div>
    );
  }

  // Render grille pour une categorie — aspect ratio different selon type
  const renderGrid = (items: GoodieItem[], kind: 'desktop' | 'phone' | 'covers') => {
    const gridClass =
      kind === 'desktop'
        ? 'grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-3 md:gap-4'
        : kind === 'phone'
        ? 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4'
        : 'grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3 md:gap-4';

    const aspectClass =
      kind === 'desktop' ? 'aspect-video' : kind === 'phone' ? 'aspect-[9/16]' : 'aspect-square';

    return <div className={gridClass}>{items.map((item, i) => renderCard(item, i, aspectClass))}</div>;
  };

  const sections: { key: AccordionKey; kind: 'desktop' | 'phone' | 'covers'; title: string; count: number; items: GoodieItem[] }[] = [
    { key: 'desktop', kind: 'desktop', title: t.goodies.desktopWallpapers, count: desktopWallpapers.length, items: desktopWallpapers },
    { key: 'phone',   kind: 'phone',   title: t.goodies.phoneWallpapers,   count: phoneWallpapers.length,   items: phoneWallpapers },
    { key: 'covers',  kind: 'covers',  title: t.goodies.albumCovers,       count: covers.length,            items: covers },
  ];

  return (
    <div className="goodies-page goodies-accordion">
      {sections.map((s) => {
        const isOpen = openSection === s.key;
        return (
          <div key={s.key} className={`goodies-acc-item ${isOpen ? 'open' : ''}`}>
            <button
              className="goodies-acc-header"
              onClick={() => toggle(s.key)}
              aria-expanded={isOpen}
            >
              <span className="goodies-acc-title">{s.title}</span>
              <span className="goodies-acc-count">{s.count}</span>
              <span className="goodies-acc-chevron">{isOpen ? '−' : '+'}</span>
            </button>
            {isOpen && <div className="goodies-acc-content">{renderGrid(s.items, s.kind)}</div>}
          </div>
        );
      })}
    </div>
  );
};

export default Goodies;
