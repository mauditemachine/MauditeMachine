import React from 'react';
import { useApp } from '../context/AppContext';

interface GoodieItem {
  src: string;        // Affichage (low-res via CSS)
  downloadSrc?: string; // Téléchargement (résolution d'origine, fallback: src)
  title: string;
  category: string;
}

const FULL_PREFIX = 'images/goodies/full/';
const goodies: GoodieItem[] = [
  // Sticker
  { src: 'images/goodies/sticker.png', downloadSrc: FULL_PREFIX + 'sticker.png', title: 'Custom Sticker', category: 'sticker' },
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
  { src: 'images/goodies/cover-discowriders.png', downloadSrc: FULL_PREFIX + 'cover-discowriders.png', title: 'Discowriders', category: 'cover' },
  { src: 'images/goodies/cover-coagule.png', downloadSrc: FULL_PREFIX + 'cover-coagule.png', title: 'Coagule', category: 'cover' },
  { src: 'images/goodies/cover-voodoo.png', downloadSrc: FULL_PREFIX + 'cover-voodoo.png', title: 'Voodoo', category: 'cover' },
  { src: 'images/goodies/cover-autopsynth.png', downloadSrc: FULL_PREFIX + 'cover-autopsynth.png', title: 'Autopsynth', category: 'cover' },
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

const Goodies: React.FC<GoodiesProps> = ({ mobileOnly = false }) => {
  const { t } = useApp();
  const sticker = goodies.filter(g => g.category === 'sticker');
  const desktopWallpapers = goodies.filter(g => g.category === 'wallpaper-desktop');
  const phoneWallpapers = goodies.filter(g => g.category === 'wallpaper-phone');
  const covers = goodies.filter(g => g.category === 'cover');

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

  if (mobileOnly) {
    return (
      <div className="goodies-page goodies-mobile-compact">
        <div className="goodies-grid goodies-grid-phone-compact">
          {phoneWallpapers.map((item, i) => (
            <div key={i} className="goodie-card">
              <img src={`/${item.src}`} alt={item.title} className="goodie-image" />
              <div className="goodie-info">
                <button className="goodie-download" onClick={() => handleDownload(item)}>{t.goodies.download}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="goodies-page">
      {/* Sticker */}
      <div className="goodies-section">
        <h3 className="goodies-category">{t.goodies.sticker}</h3>
        <div className="goodies-grid goodies-grid-large">
          {sticker.map((item, i) => (
            <div key={i} className="goodie-card">
              <img src={`/${item.src}`} alt={item.title} className="goodie-image" />
              <div className="goodie-info">
                <span className="goodie-title">{item.title}</span>
                <button className="goodie-download" onClick={() => handleDownload(item)}>{t.goodies.download}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Wallpapers */}
      <div className="goodies-section">
        <h3 className="goodies-category">{t.goodies.desktopWallpapers}</h3>
        <div className="goodies-grid goodies-grid-desktop">
          {desktopWallpapers.map((item, i) => (
            <div key={i} className="goodie-card">
              <img src={`/${item.src}`} alt={item.title} className="goodie-image" />
              <div className="goodie-info">
                <span className="goodie-title">{item.title}</span>
                <button className="goodie-download" onClick={() => handleDownload(item)}>{t.goodies.download}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Phone Wallpapers */}
      <div className="goodies-section">
        <h3 className="goodies-category">{t.goodies.phoneWallpapers}</h3>
        <div className="goodies-grid goodies-grid-phone">
          {phoneWallpapers.map((item, i) => (
            <div key={i} className="goodie-card">
              <img src={`/${item.src}`} alt={item.title} className="goodie-image" />
              <div className="goodie-info">
                <span className="goodie-title">{item.title}</span>
                <button className="goodie-download" onClick={() => handleDownload(item)}>{t.goodies.download}</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Album Covers */}
      <div className="goodies-section">
        <h3 className="goodies-category">{t.goodies.albumCovers}</h3>
        <div className="goodies-grid goodies-grid-covers">
          {covers.map((item, i) => (
            <div key={i} className="goodie-card">
              <img src={`/${item.src}`} alt={item.title} className="goodie-image" />
              <div className="goodie-info">
                <span className="goodie-title">{item.title}</span>
                <button className="goodie-download" onClick={() => handleDownload(item)}>{t.goodies.download}</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Goodies;
