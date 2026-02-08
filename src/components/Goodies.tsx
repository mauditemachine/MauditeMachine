import React from 'react';

interface GoodieItem {
  src: string;
  title: string;
  category: string;
}

const goodies: GoodieItem[] = [
  // Sticker
  { src: 'images/goodies/sticker.png', title: 'Custom Sticker', category: 'sticker' },
  // Desktop Wallpapers
  { src: 'images/goodies/wallpaper-desktop-1.png', title: 'Desktop Wallpaper 1', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-2.png', title: 'Desktop Wallpaper 2', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-3.png', title: 'Desktop Wallpaper 3', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-4.png', title: 'Desktop Wallpaper 4', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-5.png', title: 'Desktop Wallpaper 5', category: 'wallpaper-desktop' },
  { src: 'images/goodies/wallpaper-desktop-6.png', title: 'Desktop Wallpaper 6', category: 'wallpaper-desktop' },
  // Phone Wallpapers
  { src: 'images/goodies/wallpaper-phone-1.png', title: 'Phone Wallpaper 1', category: 'wallpaper-phone' },
  { src: 'images/goodies/wallpaper-phone-2.png', title: 'Phone Wallpaper 2', category: 'wallpaper-phone' },
  { src: 'images/goodies/wallpaper-phone-3.png', title: 'Phone Wallpaper 3', category: 'wallpaper-phone' },
  { src: 'images/goodies/wallpaper-phone-4.png', title: 'Phone Wallpaper 4', category: 'wallpaper-phone' },
  { src: 'images/goodies/wallpaper-phone-5.png', title: 'Phone Wallpaper 5', category: 'wallpaper-phone' },
  // Album Covers
  { src: 'images/goodies/cover-limbos.png', title: 'Limbos', category: 'cover' },
  { src: 'images/goodies/cover-anarchic.png', title: 'Anarchic', category: 'cover' },
  { src: 'images/goodies/cover-nocturne.png', title: 'Nocturne', category: 'cover' },
  { src: 'images/goodies/cover-backontrack.png', title: 'Back On Track', category: 'cover' },
  { src: 'images/goodies/cover-dramaqueen.png', title: 'Drama Queen', category: 'cover' },
  { src: 'images/goodies/cover-taticardi.png', title: 'Crush On You', category: 'cover' },
  { src: 'images/goodies/cover-taticardi2.png', title: 'Tati Cardi', category: 'cover' },
  { src: 'images/goodies/cover-discowriders.png', title: 'Discowriders', category: 'cover' },
  { src: 'images/goodies/cover-coagule.png', title: 'Coagule', category: 'cover' },
  { src: 'images/goodies/cover-voodoo.png', title: 'Voodoo', category: 'cover' },
  { src: 'images/goodies/cover-autopsynth.png', title: 'Autopsynth', category: 'cover' },
  { src: 'images/goodies/cover-richie.png', title: 'Richie', category: 'cover' },
  { src: 'images/goodies/cover-kouklikou.png', title: 'Kouklikou', category: 'cover' },
  { src: 'images/goodies/cover-syncbutton.png', title: 'Where Is The Sync Button', category: 'cover' },
  { src: 'images/goodies/cover-digitalworms.png', title: 'Digital Worms Attack', category: 'cover' },
  { src: 'images/goodies/cover-vsnocide.png', title: 'VS Nocide', category: 'cover' },
  { src: 'images/goodies/cover-mixtape36.png', title: 'Mixtape 36', category: 'cover' },
  { src: 'images/goodies/cover-mixtape37.png', title: 'Mixtape 37', category: 'cover' },
  { src: 'images/goodies/cover-mixtape38.png', title: 'Mixtape 38', category: 'cover' },
];

const Goodies: React.FC = () => {
  const sticker = goodies.filter(g => g.category === 'sticker');
  const desktopWallpapers = goodies.filter(g => g.category === 'wallpaper-desktop');
  const phoneWallpapers = goodies.filter(g => g.category === 'wallpaper-phone');
  const covers = goodies.filter(g => g.category === 'cover');

  const handleDownload = (src: string, title: string) => {
    const link = document.createElement('a');
    link.href = `/${src}`;
    link.download = `MauditeMachine_${title.replace(/\s+/g, '_')}.png`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="goodies-page">
      {/* Sticker */}
      <div className="goodies-section">
        <h3 className="goodies-category">Custom Sticker</h3>
        <div className="goodies-grid goodies-grid-large">
          {sticker.map((item, i) => (
            <div key={i} className="goodie-card">
              <img src={`/${item.src}`} alt={item.title} className="goodie-image" />
              <div className="goodie-info">
                <span className="goodie-title">{item.title}</span>
                <button className="goodie-download" onClick={() => handleDownload(item.src, item.title)}>Download</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Desktop Wallpapers */}
      <div className="goodies-section">
        <h3 className="goodies-category">Desktop Wallpapers</h3>
        <div className="goodies-grid goodies-grid-desktop">
          {desktopWallpapers.map((item, i) => (
            <div key={i} className="goodie-card">
              <img src={`/${item.src}`} alt={item.title} className="goodie-image" />
              <div className="goodie-info">
                <span className="goodie-title">{item.title}</span>
                <button className="goodie-download" onClick={() => handleDownload(item.src, item.title)}>Download</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Phone Wallpapers */}
      <div className="goodies-section">
        <h3 className="goodies-category">Phone Wallpapers</h3>
        <div className="goodies-grid goodies-grid-phone">
          {phoneWallpapers.map((item, i) => (
            <div key={i} className="goodie-card">
              <img src={`/${item.src}`} alt={item.title} className="goodie-image" />
              <div className="goodie-info">
                <span className="goodie-title">{item.title}</span>
                <button className="goodie-download" onClick={() => handleDownload(item.src, item.title)}>Download</button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Album Covers */}
      <div className="goodies-section">
        <h3 className="goodies-category">Album Covers</h3>
        <div className="goodies-grid goodies-grid-covers">
          {covers.map((item, i) => (
            <div key={i} className="goodie-card">
              <img src={`/${item.src}`} alt={item.title} className="goodie-image" />
              <div className="goodie-info">
                <span className="goodie-title">{item.title}</span>
                <button className="goodie-download" onClick={() => handleDownload(item.src, item.title)}>Download</button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export default Goodies;
