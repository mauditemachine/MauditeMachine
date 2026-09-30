/**
 * Reseaux de /v4 (revision 2, spec 20.4) : la liste finale du brief, 15
 * liens dans son ordre, ses URL exactes (verifiees par la session
 * principale dans un vrai navigateur). Hypeddit est retire (URL morte,
 * 410). Propre a /v4 : src/v2/data/socials.ts (menu et pied de page du
 * site) n'est ni lu ni modifie. L'icone de chaque lien : ui/icons.tsx.
 */

export type SocialId =
  | 'facebook'
  | 'instagram'
  | 'spotify'
  | 'deezer'
  | 'soundcloud'
  | 'bandcamp'
  | 'youtube'
  | 'mixcloud'
  | 'tiktok'
  | 'x'
  | 'applemusic'
  | 'beatport'
  | 'songkick'
  | 'gigmit'
  | 'linktree';

export interface Social {
  id: SocialId;
  /** nom du service : aria-label du lien */
  label: string;
  href: string;
}

export const SOCIALS: readonly Social[] = [
  { id: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/MauditeMachine' },
  { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/mauditemachine/' },
  { id: 'spotify', label: 'Spotify', href: 'https://open.spotify.com/artist/2FHPGWPEBQbCsgkLP9uuI4' },
  { id: 'deezer', label: 'Deezer', href: 'https://www.deezer.com/fr/artist/8651600' },
  { id: 'soundcloud', label: 'SoundCloud', href: 'https://soundcloud.com/mauditemachine' },
  { id: 'bandcamp', label: 'Bandcamp', href: 'https://mauditemachine.bandcamp.com' },
  { id: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@mauditemachine-official' },
  { id: 'mixcloud', label: 'Mixcloud', href: 'https://www.mixcloud.com/mauditemachine/' },
  { id: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@mauditemachine' },
  { id: 'x', label: 'X', href: 'https://x.com/mauditemachine' },
  { id: 'applemusic', label: 'Apple Music', href: 'https://music.apple.com/us/artist/maudite-machine/1028417516' },
  { id: 'beatport', label: 'Beatport', href: 'https://www.beatport.com/artist/maudite-machine/500537' },
  { id: 'songkick', label: 'Songkick', href: 'https://www.songkick.com/artists/10363218-maudite-machine' },
  { id: 'gigmit', label: 'gigmit', href: 'https://www.gigmit.com/maudite-machine' },
  { id: 'linktree', label: 'Linktree', href: 'https://linktr.ee/mauditemachine' },
];
