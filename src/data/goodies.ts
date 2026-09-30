/**
 * Goodies en telechargement gratuit : fonds d'ecran bureau et telephone,
 * pochettes de sorties. Source unique, lue par la page /v1/goodies
 * (src/components/Goodies.tsx) et par la section GOODIES de la machine
 * (src/v4/ui/sections/Goodies.tsx). Chemins absolus ; src : l'apercu
 * leger, downloadSrc : le fichier haute resolution telecharge, bytes : son
 * poids mesure (a remesurer si un fichier change).
 */

export type GoodieCategory = 'wallpaper-desktop' | 'wallpaper-phone' | 'cover';

export interface GoodieItem {
  /** apercu leger, chemin absolu */
  src: string;
  /** fichier telecharge (haute resolution), chemin absolu */
  downloadSrc: string;
  title: string;
  category: GoodieCategory;
  /** poids de downloadSrc, en octets */
  bytes: number;
}

export const GOODIES: readonly GoodieItem[] = [
  // Desktop wallpapers
  { src: '/images/goodies/wallpaper-desktop-1.webp', downloadSrc: '/images/goodies/full/wallpaper-desktop-1.webp', title: 'Desktop Wallpaper 1', category: 'wallpaper-desktop', bytes: 225070 },
  { src: '/images/goodies/wallpaper-desktop-2.webp', downloadSrc: '/images/goodies/full/wallpaper-desktop-2.webp', title: 'Desktop Wallpaper 2', category: 'wallpaper-desktop', bytes: 519494 },
  { src: '/images/goodies/wallpaper-desktop-3.webp', downloadSrc: '/images/goodies/full/wallpaper-desktop-3.webp', title: 'Desktop Wallpaper 3', category: 'wallpaper-desktop', bytes: 407134 },
  { src: '/images/goodies/wallpaper-desktop-4.webp', downloadSrc: '/images/goodies/full/wallpaper-desktop-4.webp', title: 'Desktop Wallpaper 4', category: 'wallpaper-desktop', bytes: 320554 },
  { src: '/images/goodies/wallpaper-desktop-5.webp', downloadSrc: '/images/goodies/full/wallpaper-desktop-5.webp', title: 'Desktop Wallpaper 5', category: 'wallpaper-desktop', bytes: 279202 },
  { src: '/images/goodies/wallpaper-desktop-6.webp', downloadSrc: '/images/goodies/full/wallpaper-desktop-6.webp', title: 'Desktop Wallpaper 6', category: 'wallpaper-desktop', bytes: 360688 },
  // Phone wallpapers
  { src: '/images/goodies/wallpaper-phone-1.webp', downloadSrc: '/images/goodies/full/wallpaper-phone-1.webp', title: 'Phone Wallpaper 1', category: 'wallpaper-phone', bytes: 101586 },
  { src: '/images/goodies/wallpaper-phone-2.webp', downloadSrc: '/images/goodies/full/wallpaper-phone-2.webp', title: 'Phone Wallpaper 2', category: 'wallpaper-phone', bytes: 111328 },
  { src: '/images/goodies/wallpaper-phone-3.webp', downloadSrc: '/images/goodies/full/wallpaper-phone-3.webp', title: 'Phone Wallpaper 3', category: 'wallpaper-phone', bytes: 67768 },
  { src: '/images/goodies/wallpaper-phone-4.webp', downloadSrc: '/images/goodies/full/wallpaper-phone-4.webp', title: 'Phone Wallpaper 4', category: 'wallpaper-phone', bytes: 53514 },
  { src: '/images/goodies/wallpaper-phone-5.webp', downloadSrc: '/images/goodies/full/wallpaper-phone-5.webp', title: 'Phone Wallpaper 5', category: 'wallpaper-phone', bytes: 194348 },
  // Release covers
  { src: '/images/goodies/cover-limbos.webp', downloadSrc: '/images/goodies/full/cover-limbos.webp', title: 'Limbos', category: 'cover', bytes: 247610 },
  { src: '/images/goodies/cover-anarchic.webp', downloadSrc: '/images/goodies/full/cover-anarchic.webp', title: 'Anarchic', category: 'cover', bytes: 962200 },
  { src: '/images/goodies/cover-nocturne.webp', downloadSrc: '/images/goodies/full/cover-nocturne.webp', title: 'Nocturne', category: 'cover', bytes: 583752 },
  { src: '/images/goodies/cover-backontrack.webp', downloadSrc: '/images/goodies/full/cover-backontrack.webp', title: 'Back On Track', category: 'cover', bytes: 418392 },
  { src: '/images/goodies/cover-dramaqueen.webp', downloadSrc: '/images/goodies/full/cover-dramaqueen.webp', title: 'Drama Queen', category: 'cover', bytes: 343648 },
  { src: '/images/goodies/cover-taticardi.webp', downloadSrc: '/images/goodies/full/cover-taticardi.webp', title: 'Crush On You', category: 'cover', bytes: 449882 },
  { src: '/images/goodies/cover-taticardi2.webp', downloadSrc: '/images/goodies/full/cover-taticardi2.webp', title: 'Tati Cardi', category: 'cover', bytes: 449882 },
  { src: '/images/goodies/cover-taticardi-remixes.webp', downloadSrc: '/images/goodies/full/cover-taticardi-remixes.webp', title: 'Tati Cardi Remixes', category: 'cover', bytes: 410506 },
  { src: '/images/goodies/cover-discowriders.webp', downloadSrc: '/images/goodies/full/cover-discowriders.webp', title: 'Discowriders', category: 'cover', bytes: 891732 },
  { src: '/images/goodies/cover-coagule.webp', downloadSrc: '/images/goodies/full/cover-coagule.webp', title: 'Coagule', category: 'cover', bytes: 449752 },
  { src: '/images/goodies/cover-voodoo.webp', downloadSrc: '/images/goodies/full/cover-voodoo.webp', title: 'Voodoo', category: 'cover', bytes: 765092 },
  { src: '/images/goodies/cover-autopsynth.webp', downloadSrc: '/images/goodies/full/cover-autopsynth.webp', title: 'Autopsynth', category: 'cover', bytes: 923590 },
  { src: '/images/goodies/cover-autopsynth-alt.webp', downloadSrc: '/images/goodies/full/cover-autopsynth-alt.webp', title: 'Autopsynth (Alt)', category: 'cover', bytes: 309718 },
  { src: '/images/goodies/cover-richie.webp', downloadSrc: '/images/goodies/full/cover-richie.webp', title: 'Richie', category: 'cover', bytes: 617372 },
  { src: '/images/goodies/cover-kouklikou.webp', downloadSrc: '/images/goodies/full/cover-kouklikou.webp', title: 'Kouklikou', category: 'cover', bytes: 339724 },
  { src: '/images/goodies/cover-syncbutton.webp', downloadSrc: '/images/goodies/full/cover-syncbutton.webp', title: 'Where Is The Sync Button', category: 'cover', bytes: 70184 },
  { src: '/images/goodies/cover-digitalworms.webp', downloadSrc: '/images/goodies/full/cover-digitalworms.webp', title: 'Digital Worms Attack', category: 'cover', bytes: 455178 },
  { src: '/images/goodies/cover-vsnocide.webp', downloadSrc: '/images/goodies/full/cover-vsnocide.webp', title: 'VS Nocide', category: 'cover', bytes: 345702 },
  { src: '/images/goodies/cover-mixtape36.webp', downloadSrc: '/images/goodies/full/cover-mixtape36.webp', title: 'Mixtape 36', category: 'cover', bytes: 68704 },
  { src: '/images/goodies/cover-mixtape37.webp', downloadSrc: '/images/goodies/full/cover-mixtape37.webp', title: 'Mixtape 37', category: 'cover', bytes: 204920 },
  { src: '/images/goodies/cover-mixtape38.webp', downloadSrc: '/images/goodies/full/cover-mixtape38.webp', title: 'Mixtape 38', category: 'cover', bytes: 187774 },
];

/** Nom de fichier propre : MauditeMachine_<Title>.<ext> */
export function goodieFilename(item: GoodieItem): string {
  const ext = item.downloadSrc.split('.').pop() || 'webp';
  const safeName = item.title.replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `MauditeMachine_${safeName}.${ext}`;
}
