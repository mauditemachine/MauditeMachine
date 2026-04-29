/**
 * SocialIcons — module partage : icones SVG monochromes + liste SOCIAL_LINKS.
 * Utilise par SocialSidebar (desktop fixed right) et MobileMenu (mobile row).
 */

import React from 'react';

const STROKE_PROPS = {
  width: 20,
  height: 20,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.8,
  strokeLinecap: 'round' as const,
  strokeLinejoin: 'round' as const,
};

export const IconSpotify = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M12 0C5.4 0 0 5.4 0 12s5.4 12 12 12 12-5.4 12-12S18.66 0 12 0zm5.52 17.34c-.24.36-.66.48-1.02.24-2.82-1.74-6.36-2.1-10.56-1.14-.42.12-.78-.18-.9-.54-.12-.42.18-.78.54-.9 4.56-1.02 8.52-.6 11.64 1.32.42.18.48.66.3 1.02zm1.44-3.3c-.3.42-.84.6-1.26.3-3.24-1.98-8.16-2.58-11.94-1.38-.48.12-1.02-.12-1.14-.6-.12-.48.12-1.02.6-1.14 4.38-1.32 9.78-.66 13.5 1.62.36.18.48.78.24 1.2zm.12-3.36C15.24 8.4 8.82 8.16 5.16 9.3c-.6.18-1.2-.18-1.38-.72-.18-.6.18-1.2.72-1.38 4.26-1.26 11.28-1.02 15.72 1.62.54.3.72 1.02.42 1.56-.3.42-1.02.6-1.56.3z" />
  </svg>
);

export const IconApple = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M17.05 20.28c-.98.95-2.05.8-3.08.35-1.09-.46-2.09-.48-3.24 0-1.44.62-2.2.44-3.06-.35C2.79 15.25 3.51 7.59 9.05 7.31c1.35.07 2.29.74 3.08.8 1.18-.24 2.31-.93 3.57-.84 1.51.12 2.65.72 3.4 1.8-3.12 1.87-2.38 5.98.48 7.13-.57 1.5-1.31 2.99-2.54 4.09l.01-.01zM12.03 7.25c-.15-2.23 1.66-4.07 3.74-4.25.29 2.58-2.34 4.5-3.74 4.25z" />
  </svg>
);

export const IconBeatport = (
  <svg {...STROKE_PROPS} aria-hidden="true">
    <circle cx="12" cy="12" r="10" />
    <circle cx="12" cy="12" r="3" fill="currentColor" stroke="none" />
  </svg>
);

export const IconBandcamp = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M3 4l7 16h11L14 4H3z" />
  </svg>
);

export const IconSoundcloud = (
  <svg {...STROKE_PROPS} aria-hidden="true">
    <path d="M3 15v-3M6 17v-7M9 18V9M12 18V6M15 18v-9M18 18v-6" />
    <path d="M21 18a3 3 0 0 0 0-6" />
  </svg>
);

export const IconMixcloud = (
  <svg {...STROKE_PROPS} aria-hidden="true">
    <path d="M2 15a4 4 0 0 1 4-4h0a5 5 0 0 1 9.5-1A4.5 4.5 0 0 1 22 14.5a4.5 4.5 0 0 1-4.5 4.5H6a4 4 0 0 1-4-4z" />
  </svg>
);

export const IconInstagram = (
  <svg {...STROKE_PROPS} aria-hidden="true">
    <rect x="2" y="2" width="20" height="20" rx="5" ry="5" />
    <path d="M16 11.37A4 4 0 1 1 12.63 8 4 4 0 0 1 16 11.37z" />
    <line x1="17.5" y1="6.5" x2="17.51" y2="6.5" />
  </svg>
);

export const IconYouTube = (
  <svg {...STROKE_PROPS} aria-hidden="true">
    <path d="M22.54 6.42a2.78 2.78 0 0 0-1.94-2C18.88 4 12 4 12 4s-6.88 0-8.6.46a2.78 2.78 0 0 0-1.94 2A29 29 0 0 0 1 11.75a29 29 0 0 0 .46 5.33A2.78 2.78 0 0 0 3.4 19c1.72.46 8.6.46 8.6.46s6.88 0 8.6-.46a2.78 2.78 0 0 0 1.94-2 29 29 0 0 0 .46-5.25 29 29 0 0 0-.46-5.33z" />
    <polygon points="9.75 15.02 15.5 11.75 9.75 8.48 9.75 15.02" fill="currentColor" stroke="none" />
  </svg>
);

export const IconFacebook = (
  <svg {...STROKE_PROPS} aria-hidden="true">
    <path d="M18 2h-3a5 5 0 0 0-5 5v3H7v4h3v8h4v-8h3l1-4h-4V7a1 1 0 0 1 1-1h3z" />
  </svg>
);

export const IconTikTok = (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M19.59 6.69a4.83 4.83 0 0 1-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 0 1-5.2 1.74 2.89 2.89 0 0 1 2.31-4.64 2.93 2.93 0 0 1 .88.13V9.4a6.84 6.84 0 0 0-1-.05A6.33 6.33 0 0 0 5.8 20.1a6.34 6.34 0 0 0 10.86-4.43V8.93a8.16 8.16 0 0 0 4.77 1.52V7a4.85 4.85 0 0 1-1.84-.31z" />
  </svg>
);

export interface SocialLink {
  label: string;
  href: string;
  icon: React.ReactNode;
}

// 10 reseaux principaux. "Site" et "Linktree" retires (redondants avec la
// page web elle-meme) pour garder la sidebar verticale compacte.
export const SOCIAL_LINKS: SocialLink[] = [
  { label: 'Spotify',     href: 'https://open.spotify.com/artist/maudite-machine',  icon: IconSpotify },
  { label: 'Apple Music', href: 'https://music.apple.com/artist/maudite-machine',   icon: IconApple },
  { label: 'Beatport',    href: 'https://beatport.com/artist/maudite-machine',      icon: IconBeatport },
  { label: 'Bandcamp',    href: 'https://mauditemachine.bandcamp.com',              icon: IconBandcamp },
  { label: 'SoundCloud',  href: 'https://soundcloud.com/mauditemachine',            icon: IconSoundcloud },
  { label: 'Mixcloud',    href: 'https://mixcloud.com/mauditemachine',              icon: IconMixcloud },
  { label: 'Instagram',   href: 'https://instagram.com/mauditemachine',             icon: IconInstagram },
  { label: 'YouTube',     href: 'https://youtube.com/@mauditemachine-official',     icon: IconYouTube },
  { label: 'Facebook',    href: 'https://facebook.com/mauditemachine',              icon: IconFacebook },
  { label: 'TikTok',      href: 'https://tiktok.com/@mauditemachine',               icon: IconTikTok },
];
