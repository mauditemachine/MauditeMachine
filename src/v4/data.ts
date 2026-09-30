/**
 * Adaptateur de donnees de /v4 (spec 11.1) : la source de /v3 (BEADS de
 * src/v3/data/beads.ts, lecture seule : 37 pistes et 5 mixtapes), les
 * contacts de la v2, les reseaux propres a /v4 (data/socials.ts, la liste
 * du brief de la revision 2), les dates de public/events.json lues au
 * runtime. Les listes vont du plus recent au plus ancien. Tout ce qui est
 * affiche est une donnee ; les seuls textes ecrits ici sont les liens de
 * presse et de LIVE et les messages vides (le francais de LIVE et de SONAA
 * est dans leurs composants).
 */

import type { V2Track } from '../v2/context/AudioPlayerContext';
import { BOOKING_CONTACTS, type BookingContact } from '../v2/data/contacts';
import { BEADS, fmtTime, type Bead } from '../v3/data/beads';
import { LABEL_URL } from './theme';

export { SOCIALS, type Social, type SocialId } from './data/socials';
export { fmtTime };
export type { BookingContact };

/** Une ligne de TRACKS ou MIXTAPES. */
export interface PlayItem {
  id: string;
  title: string;
  /** "Original, 2026, Single / EP" ou "Mixtape 39, 2026, 1:29:33" */
  meta: string;
  /** false : pas de SoundCloud, la ligne renvoie a Bandcamp */
  playable: boolean;
  link: string;
  track: V2Track;
}

/**
 * Type, annee, projet (la donnee n'a pas de label, spec 19 point 2). Les
 * remix ont "Remix" pour projet : le mot n'est pas repete.
 */
function trackMeta(b: Bead): string {
  const parts = [b.categoryLabel, String(b.year)];
  if (b.track.project && b.track.project !== b.categoryLabel) parts.push(b.track.project);
  return parts.join(', ');
}

const item = (b: Bead, meta: string): PlayItem => ({
  id: b.id,
  title: b.track.title,
  meta,
  playable: b.playable,
  link: b.track.link,
  track: b.track,
});

/** Les 37 pistes, la plus recente d'abord. */
export const TRACKS: readonly PlayItem[] = BEADS.filter((b) => b.kind === 'track')
  .reverse()
  .map((b) => item(b, trackMeta(b)));

/** Les 5 mixtapes, la plus recente d'abord. */
export const MIXTAPES: readonly PlayItem[] = BEADS.filter((b) => b.kind === 'mixtape')
  .reverse()
  .map((b) => item(b, [`Mixtape ${b.mixtape?.number ?? ''}`, String(b.year), b.mixtape?.duration ?? ''].join(', ')));

/** Files passees au moteur : les lignes jouables, dans l'ordre affiche. */
export const TRACK_QUEUE: V2Track[] = TRACKS.filter((t) => t.playable).map((t) => t.track);
export const MIXTAPE_QUEUE: V2Track[] = MIXTAPES.filter((t) => t.playable).map((t) => t.track);

export const PRESS_TEXT = 'Press kit, tech rider, hi-res photos and artwork.';
export const PRESS_LINKS: readonly { label: string; href: string }[] = [
  { label: 'Press kit (PDF)', href: '/Presskit_Maudite_Machine_2026-27.pdf' },
  { label: 'Tech rider (PDF)', href: '/Tech_Rider_Maudite_Machine_2026-27.pdf' },
  { label: 'Press assets', href: '/press/' },
];

/**
 * LABEL (revision 2, pad LABEL) : une ligne, le label, et sa page Bandcamp
 * (verifiee par la session principale), la meme que la puce LABEL. Rien
 * d'autre n'est invente.
 */
export const LABEL_NAME = 'VRSTL Records';
export const LABEL_LINK = { label: 'Bandcamp', href: LABEL_URL } as const;

/** SONAA (revision 2, pad SONAA) : le lien ; le texte francais est dans ui/sections/Sonaa.tsx. */
export const SONAA_LINK = { label: 'sonaa.ca', href: 'https://sonaa.ca' } as const;

/**
 * LIVE (revision 2, puce LIVE) : les deux PDF en telechargement, leur
 * taille mesuree (878 617 et 4 460 360 octets) ; le reste du texte, en
 * francais, est dans ui/sections/Live.tsx.
 */
export const LIVE_DOCS: readonly { label: string; href: string; size: string }[] = [
  { label: 'Tech rider (PDF)', href: '/Tech_Rider_Maudite_Machine_2026-27.pdf', size: '0.9 MB' },
  { label: 'Press kit (PDF)', href: '/Presskit_Maudite_Machine_2026-27.pdf', size: '4.5 MB' },
];
/** Les deux pages du site ouvertes par LIVE, en nouvel onglet. */
export const LIVE_PAGES = { press: '/press/', techrider: '/techrider' } as const;

/** Le setup materiel (section STUDIO, ouverte par la puce de la vue eclatee). */
export const STUDIO_GEAR: readonly string[] = ['Ableton Live', 'Push 3', 'Dreadbox Typhon', 'Minilogue XD', 'APC40', 'SSL 2+'];

export const CONTACTS: readonly BookingContact[] = BOOKING_CONTACTS;

/* ---------------- dates (public/events.json) ---------------- */

export interface Show {
  /** AAAA-MM-JJ */
  date: string;
  title: string;
  location: string;
  /** page de l'evenement, ou null si l'URL n'est pas http(s) */
  url: string | null;
}

export const SHOWS_EMPTY = 'No upcoming dates.';
export const SHOWS_LINK = { label: 'All shows', href: '/shows' } as const;

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;
const pad2 = (n: number): string => (n < 10 ? `0${n}` : String(n));

/** Aujourd'hui en AAAA-MM-JJ, horloge locale. */
export function isoToday(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`;
}

/** Garde les dates a venir (date >= aujourd'hui), triees de la plus proche a la plus lointaine. */
export function upcoming(raw: unknown, today: string = isoToday()): Show[] {
  if (!Array.isArray(raw)) return [];
  const out: Show[] = [];
  for (const e of raw) {
    if (!e || typeof e !== 'object') continue;
    const o = e as Record<string, unknown>;
    if (typeof o.date !== 'string' || !DATE_RE.test(o.date) || typeof o.title !== 'string') continue;
    if (o.date < today) continue;
    const url = typeof o.url === 'string' && /^https?:\/\//.test(o.url) ? o.url : null;
    out.push({ date: o.date, title: o.title, location: typeof o.location === 'string' ? o.location : '', url });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date) || a.title.localeCompare(b.title));
}

let showsPromise: Promise<Show[]> | null = null;
/** Une lecture bloquee ne laisse pas SHOWS en attente : abandon apres 5 s. */
const SHOWS_TIMEOUT_MS = 5000;

/** Une lecture par page (cache) ; un echec ou 5 s sans reponse rendent [] et laissent le prochain montage reessayer. */
export function fetchShows(): Promise<Show[]> {
  if (!showsPromise) {
    const ctrl = typeof AbortController !== 'undefined' ? new AbortController() : null;
    const timer = window.setTimeout(() => ctrl?.abort(), SHOWS_TIMEOUT_MS);
    const p: Promise<Show[]> = fetch('/events.json', { cache: 'no-cache', signal: ctrl?.signal })
      .then((r) => (r.ok ? r.json() : []))
      .then(
        (data: unknown) => {
          window.clearTimeout(timer);
          return upcoming(data);
        },
        () => {
          window.clearTimeout(timer);
          if (showsPromise === p) showsPromise = null;
          return [];
        }
      );
    showsPromise = p;
  }
  return showsPromise;
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

/** '2026-10-16' -> '16 Oct 2026' (anglais, sans dependre de la locale du navigateur). */
export function fmtShowDate(iso: string): string {
  const [y, m, d] = iso.split('-').map(Number);
  return `${d} ${MONTHS[(m || 1) - 1] ?? ''} ${y}`;
}
