/**
 * TOUS les reseaux de Maudite Machine, liste canonique fournie par Mika
 * (2026-09). Importee par le menu overlay et le footer : une seule
 * source, plus de listes dupliquees. Le Linktree est l'URL directe
 * (le bit.ly fourni resolvait vers linktr.ee/mauditemachine).
 */

export interface SocialLink {
  label: string;
  href: string;
  /** cle dans SOCIAL_ICONS ; null = pastille initiale (marque hors FA) */
  icon: string | null;
}

export const SOCIALS: SocialLink[] = [
  { label: 'Facebook', href: 'https://www.facebook.com/MauditeMachine', icon: 'facebook' },
  { label: 'Instagram', href: 'https://www.instagram.com/mauditemachine/', icon: 'instagram' },
  { label: 'Spotify', href: 'https://open.spotify.com/artist/2FHPGWPEBQbCsgkLP9uuI4', icon: 'spotify' },
  { label: 'Deezer', href: 'https://www.deezer.com/fr/artist/8651600', icon: 'deezer' },
  { label: 'SoundCloud', href: 'https://www.soundcloud.com/mauditemachine/', icon: 'soundcloud' },
  { label: 'Bandcamp', href: 'https://mauditemachine.bandcamp.com/', icon: 'bandcamp' },
  { label: 'YouTube', href: 'https://www.youtube.com/@mauditemachine-official', icon: 'youtube' },
  { label: 'Mixcloud', href: 'https://www.mixcloud.com/mauditemachine/', icon: 'mixcloud' },
  { label: 'TikTok', href: 'https://www.tiktok.com/@mauditemachine', icon: 'tiktok' },
  { label: 'Linktree', href: 'https://linktr.ee/mauditemachine', icon: 'linktree' },
  { label: 'Hypeddit', href: 'https://music.vrstlrecords.com/mauditemachine', icon: null },
  { label: 'Songkick', href: 'https://www.songkick.com/artists/10363218-maudite-machine', icon: null },
  { label: 'Apple Music', href: 'https://music.apple.com/us/artist/maudite-machine/1028417516', icon: 'applemusic' },
  { label: 'Beatport', href: 'https://www.beatport.com/fr/artist/maudite-machine/500537', icon: null },
];
