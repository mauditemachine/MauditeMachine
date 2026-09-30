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
  /**
   * Couleur de la marque, prise par l'icone au survol et au focus
   * (2026-10-01) : Simple Icons 16.33.0. X et TikTok sont noirs, invisibles
   * sur le graphite : X en blanc, TikTok en son cyan. gigmit (hors Simple
   * Icons) : le vert de sa feuille de style.
   */
  color: string;
}

export const SOCIALS: readonly Social[] = [
  { id: 'facebook', label: 'Facebook', href: 'https://www.facebook.com/MauditeMachine', color: '#0866FF' },
  { id: 'instagram', label: 'Instagram', href: 'https://www.instagram.com/mauditemachine/', color: '#FF0069' },
  { id: 'spotify', label: 'Spotify', href: 'https://open.spotify.com/artist/2FHPGWPEBQbCsgkLP9uuI4', color: '#1ED760' },
  { id: 'deezer', label: 'Deezer', href: 'https://www.deezer.com/fr/artist/8651600', color: '#A238FF' },
  { id: 'soundcloud', label: 'SoundCloud', href: 'https://soundcloud.com/mauditemachine', color: '#FF5500' },
  { id: 'bandcamp', label: 'Bandcamp', href: 'https://mauditemachine.bandcamp.com', color: '#408294' },
  { id: 'youtube', label: 'YouTube', href: 'https://www.youtube.com/@mauditemachine-official', color: '#FF0000' },
  { id: 'mixcloud', label: 'Mixcloud', href: 'https://www.mixcloud.com/mauditemachine/', color: '#5000FF' },
  { id: 'tiktok', label: 'TikTok', href: 'https://www.tiktok.com/@mauditemachine', color: '#25F4EE' },
  { id: 'x', label: 'X', href: 'https://x.com/mauditemachine', color: '#FFFFFF' },
  { id: 'applemusic', label: 'Apple Music', href: 'https://music.apple.com/us/artist/maudite-machine/1028417516', color: '#FA243C' },
  { id: 'beatport', label: 'Beatport', href: 'https://www.beatport.com/artist/maudite-machine/500537', color: '#01FF95' },
  { id: 'songkick', label: 'Songkick', href: 'https://www.songkick.com/artists/10363218-maudite-machine', color: '#F80046' },
  { id: 'gigmit', label: 'gigmit', href: 'https://www.gigmit.com/maudite-machine', color: '#16C98D' },
  { id: 'linktree', label: 'Linktree', href: 'https://linktr.ee/mauditemachine', color: '#43E55E' },
];
