import React, { useState } from 'react';
import { useApp } from '../context/AppContext';
import { cn } from '../lib/cn';
import GlassCard from './ui/GlassCard';

interface GoodieItem {
  src: string;        // Affichage (low-res via CSS)
  downloadSrc?: string; // Téléchargement (résolution d'origine, fallback: src)
  title: string;
  category: string;
}

const FULL_PREFIX = 'images/goodies/full/';
const goodies: GoodieItem[] = [
  // Desktop Wallpapers
  { src: 'images/goodies/wallpaper-desktop-1.png', downloadSrc: FULL_PREFIX + 'wallpaper-desktop-1.jpg', title: 'Desktop Wallpaper 1', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-2.png', downloadSrc: FULL_PREFIX + 'wallpaper-desktop-2.jpg', title: 'Desktop Wallpaper 2', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-3.png', downloadSrc: FULL_PREFIX + 'wallpaper-desktop-3.jpg', title: 'Desktop Wallpaper 3', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-4.png', downloadSrc: FULL_PREFIX + 'wallpaper-desktop-4.jpg', title: 'Desktop Wallpaper 4', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-5.png', downloadSrc: FULL_PREFIX + 'wallpaper-desktop-5.jpg', title: 'Desktop Wallpaper 5', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-6.png', downloadSrc: FULL_PREFIX + 'wallpaper-desktop-6.jpg', title: 'Desktop Wallpaper 6', category: 'wallpaper-desktop' },
  // Phone Wallpapers
  { src: 'images/goodies/wallpaper-phone-1.png', downloadSrc: FULL_PREFIX + 'wallpaper-phone-1.jpg', title: 'Phone Wallpaper 1', category: 'wallpaper-phone' },
  { src: 'images/goodies/wallpaper-phone-2.png', downloadSrc: FULL_PREFIX + 'wallpaper-phone-2.jpg', title: 'Phone Wallpaper 2', category: 'wallpaper-phone' },
  { src: 'images/goodies/wallpaper-phone-3.png', downloadSrc: FULL_PREFIX + 'wallpaper-phone-3.jpg', title: 'Phone Wallpaper 3', category: 'wallpaper-phone' },
  { src: 'images/goodies/wallpaper-phone-4.png', downloadSrc: FULL_PREFIX + 'wallpaper-phone-4.jpg', title: 'Phone Wallpaper 4', category: 'wallpaper-phone' },
  { src: 'images/goodies/wallpaper-phone-5.png', downloadSrc: FULL_PREFIX + 'wallpaper-phone-5.jpg', title: 'Phone Wallpaper 5', category: 'wallpaper-phone' },
  // Album Covers
  { src: 'images/goodies/cover-limbos.png', downloadSrc: FULL_PREFIX + 'cover-limbos.png', title: 'Limbos', category: 'cover' },
  { src: 'images/goodies/cover-anarchic.png', downloadSrc: FULL_PREFIX + 'cover-anarchic.png', title: 'Anarchic', category: 'cover' },
  { src: 'images/goodies/cover-nocturne.png', downloadSrc: FULL_PREFIX + 'cover-nocturne.png', title: 'Nocturne', category: 'cover' },
  { src: 'images/goodies/cover-backontrack.png', downloadSrc: FULL_PREFIX + 'cover-backontrack.png', title: 'Back On Track', category: 'cover' },
  { src: 'images/goodies/cover-dramaqueen.png', downloadSrc: FULL_PREFIX + 'cover-dramaqueen.png', title: 'Drama Queen', category: 'cover' },
  { src: 'images/goodies/cover-taticardi.png', downloadSrc: FULL_PREFIX + 'cover-taticardi.png', title: 'Crush On You', category: 'cover' },
  { src: 'images/goodies/cover-taticardi2.png', downloadSrc: FULL_PREFIX + 'cover-taticardi2.png', title: 'Tati Cardi', category: 'cover' },
  { src: 'images/goodies/cover-taticardi-remixes.png', downloadSrc: FULL_PREFIX + 'cover-taticardi-remixes.png', title: 'Tati Cardi Remixes', category: 'cover' },
  { src: 'images/goodies/cover-discowriders.png', downloadSrc: FULL_PREFIX + 'cover-discowriders.png', title: 'Discowriders', category: 'cover' },
  { src: 'images/goodies/cover-coagule.png', downloadSrc: FULL_PREFIX + 'cover-coagule.png', title: 'Coagule', category: 'cover' },
  { src: 'images/goodies/cover-voodoo.png', downloadSrc: FULL_PREFIX + 'cover-voodoo.png', title: 'Voodoo', category: 'cover' },
  { src: 'images/goodies/cover-autopsynth.png', downloadSrc: FULL_PREFIX + 'cover-autopsynth.png', title: 'Autopsynth', category: 'cover' },
  { src: 'images/goodies/cover-autopsynth-alt.png', downloadSrc: FULL_PREFIX + 'cover-autopsynth-alt.png', title: 'Autopsynth (Alt)', category: 'cover' },
  { src: 'images/goodies/cover-richie.png', downloadSrc: FULL_PREFIX + 'cover-richie.png', title: 'Richie', category: 'cover' },
  { src: 'images/goodies/cover-kouklikou.png', downloadSrc: FULL_PREFIX + 'cover-kouklikou.png', title: 'Kouklikou', category: 'cover' },
  { src: 'images/goodies/cover-syncbutton.png', downloadSrc: FULL_PREFIX + 'cover-syncbutton.png', title: 'Where Is The Sync Button', category: 'cover' },
  { src: 'images/goodies/cover-digitalworms.png', downloadSrc: FULL_PREFIX + 'cover-digitalworms.png', title: 'Digital Worms Attack', category: 'cover' },
  { src: 'images/goodies/cover-vsnocide.png', downloadSrc: FULL_PREFIX + 'cover-vsnocide.png', title: 'VS Nocide', category: 'cover' },
  { src: 'images/goodies/cover-mixtape36.png', downloadSrc: FULL_PREFIX + 'cover-mixtape36.png', title: 'Mixtape 36', category: 'cover' },
  { src: 'images/goodies/cover-mixtape37.png', downloadSrc: FULL_PREFIX + 'cover-mixtape37.png', title: 'Mixtape 37', category: 'cover' },
  { src: 'images/goodies/cover-mixtape38.png', downloadSrc: FULL_PREFIX + 'cover-mixtape38.png', title: 'Mixtape 38', category: 'cover' },
];

interface GoodiesProps {
  mobileOnly?: boolean;
}

type AccordionKey = 'desktop' | 'phone' | 'covers';

const Goodies: React.FC<GoodiesProps> = ({ mobileOnly = false }) => {
  const { t } = useApp();
  const desktopWallpapers = goodies.filter(g => g.category === 'wallpaper-desktop');
  const phoneWallpapers = goodies.filter(g => g.category === 'wallpaper-phone');
  const covers = goodies.filter(g => g.category === 'cover');
  const [openSection, setOpenSection] = useState<AccordionKey | null>('covers');

  const toggle = (key: AccordionKey) => {
    setOpenSection(prev => prev === key ? null : key);
  };

  const handleDownload = async (item: GoodieItem) => {
    const downloadUrl = item.downloadSrc || item.src;
    const ext = downloadUrl.split('.').pop() || 'png';
    const filename = `MauditeMachine_${item.title.replace(/\s+/g, '_')}.${ext}`;
    try {
      // Fetch le fichier en blob pour forcer le téléchargement en pleine résolution
      const response = await fetch(`/${downloadUrl}`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
    } catch {
      // Fallback : ouvrir dans un nouvel onglet
      window.open(`/${downloadUrl}`, '_blank');
    }
  };

  // Styles du bouton download — monochrome blanc, pas de gold
  const downloadBtnClass = cn(
    'flex-shrink-0 px-3 py-1 rounded-full',
    'bg-ink-10 hover:bg-ink-20 border border-ink-15 hover:border-ink-50',
    'text-[10px] font-bold uppercase tracking-wider text-ink-95 font-body',
    'transition-all duration-250 ease-out-expo',
    'hover:shadow-glow-white-soft',
  );

  if (mobileOnly) {
    return (
      <div className="w-full">
        <div className="grid grid-cols-5 gap-2">
          {phoneWallpapers.map((item, i) => (
            <GlassCard key={i} className="group p-1.5" onClick={() => handleDownload(item)} index={i} staggerMs={40}>
              <div className="relative aspect-[9/16] overflow-hidden rounded-md bg-black/40">
                <img
                  src={`/${item.src}`}
                  alt={item.title}
                  loading="lazy"
                  className="w-full h-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.06]"
                />
              </div>
              <div className="mt-1.5 flex justify-center">
                <button
                  type="button"
                  onClick={(e) => { e.stopPropagation(); handleDownload(item); }}
                  className={downloadBtnClass}
                >
                  {t.goodies.download}
                </button>
              </div>
            </GlassCard>
          ))}
        </div>
      </div>
    );
  }

  // Render grille pour une categorie — aspect ratio different selon type
  const renderGrid = (items: GoodieItem[], kind: 'desktop' | 'phone' | 'covers') => {
    const gridClass = kind === 'desktop'
      ? 'grid grid-cols-[repeat(auto-fill,minmax(240px,1fr))] gap-3.5'
      : 'grid grid-cols-[repeat(auto-fill,minmax(140px,1fr))] gap-3';

    const aspectClass = kind === 'desktop'
      ? 'aspect-video'
      : kind === 'phone'
      ? 'aspect-[9/16]'
      : 'aspect-square';

    return (
      <div className={gridClass}>
        {items.map((item, i) => (
          <GlassCard key={i} className="group p-2" index={i} staggerMs={40}>
            <div className={cn('relative overflow-hidden rounded-md bg-black/40', aspectClass)}>
              <img
                src={`/${item.src}`}
                alt={item.title}
                loading="lazy"
                className="w-full h-full object-cover transition-transform duration-700 ease-out-expo group-hover:scale-[1.06]"
              />
            </div>
            <div className="mt-2 px-1 flex items-center justify-between gap-2">
              <span className="text-[11px] text-ink-70 truncate font-body" title={item.title}>
                {item.title}
              </span>
              <button
                type="button"
                onClick={() => handleDownload(item)}
                className={downloadBtnClass}
              >
                {t.goodies.download}
              </button>
            </div>
          </GlassCard>
        ))}
      </div>
    );
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
            {isOpen && (
              <div className="goodies-acc-content">
                {renderGrid(s.items, s.kind)}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export default Goodies;
