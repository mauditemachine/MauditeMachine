/**
 * Adaptateur de donnees de /v4 (spec 11.1) : la source de /v3 (BEADS de
 * src/v3/data/beads.ts, lecture seule : 37 pistes et 5 mixtapes), les
 * contacts de la v2, les reseaux propres a /v4 (data/socials.ts, la liste
 * du brief de la revision 2), les dates de public/events.json lues au
 * runtime. Les listes vont du plus recent au plus ancien. Tout ce qui est
 * affiche est une donnee ; les seuls textes ecrits ici sont les liens de
 * presse et de LIVE et les messages vides. Tout le site est en anglais
 * (2026-09-30) : LIVE et SONAA aussi. MERCH lit public/store.json au
 * runtime, la meme source que la boutique v2 et l'admin.
 */

import type { V2Track } from '../v2/context/AudioPlayerContext';
import { BOOKING_CONTACTS, type BookingContact } from '../v2/data/contacts';
import { BEADS, fmtTime, type Bead } from '../v3/data/beads';
import { GOODIES, type GoodieCategory, type GoodieItem } from '../data/goodies';
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
  /**
   * Page Bandcamp de la sortie (track ou album) : le lien Buy de la ligne
   * (2026-09-30), null sans page precise (mixtapes, lien vers l'accueil).
   */
  buy: string | null;
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

/** Une page precise de Bandcamp (/track/ ou /album/), sinon null. */
const BUY_RE = /^https:\/\/[a-z0-9-]+\.bandcamp\.com\/(track|album)\/[^/?#]+\/?$/;
const buyUrl = (link: string | undefined): string | null => (link && BUY_RE.test(link) ? link : null);

const item = (b: Bead, meta: string): PlayItem => ({
  id: b.id,
  title: b.track.title,
  meta,
  playable: b.playable,
  link: b.track.link,
  buy: b.kind === 'track' ? buyUrl(b.track.link) : null,
  track: b.track,
});

/** Melange de Fisher-Yates (une nouvelle copie). */
function shuffled<T>(list: readonly T[]): T[] {
  const out = list.slice();
  for (let i = out.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/**
 * Les 37 pistes, dans un ordre tire au hasard a chaque visite (2026-10-03,
 * demande de Mika : la playlist ne part plus toujours de la meme piste).
 */
export const TRACKS: readonly PlayItem[] = shuffled(BEADS.filter((b) => b.kind === 'track').map((b) => item(b, trackMeta(b))));

/** Les 5 mixtapes, la plus recente d'abord. */
export const MIXTAPES: readonly PlayItem[] = BEADS.filter((b) => b.kind === 'mixtape')
  .reverse()
  .map((b) => item(b, [`Mixtape ${b.mixtape?.number ?? ''}`, String(b.year), b.mixtape?.duration ?? ''].join(', ')));

/** Files passees au moteur : les lignes jouables, dans l'ordre affiche. */
export const TRACK_QUEUE: V2Track[] = TRACKS.filter((t) => t.playable).map((t) => t.track);
export const MIXTAPE_QUEUE: V2Track[] = MIXTAPES.filter((t) => t.playable).map((t) => t.track);

export const PRESS_TEXT = 'Press kit, tech rider, hi-res photos and artwork.';

/**
 * PRESS (2026-10-01, LIVE y est fondu) : le setup et la duree des sets,
 * puis les documents.
 */
export const PRESS_SETUP: readonly string[] = [
  'DJ set on CDJs, or hybrid live set with synths and grooveboxes.',
  'Length: 90 minutes to 4 hours as a DJ, 60 to 75 minutes live.',
];

/**
 * Liens de CONTACT (2026-10-01), en tete du panneau avec les reseaux : le
 * label (VRSTL Records sur Bandcamp, la page de l'ancienne puce LABEL),
 * SONAA (l'ancien pad SONAA) et Massive Medias. Nouvel onglet.
 */
export const CONTACT_LINKS: readonly { label: string; href: string }[] = [
  { label: 'VRSTL Records, the label', href: LABEL_URL },
  { label: 'SONAA, electronic music atlas', href: 'https://sonaa.ca' },
  { label: 'Print and merch, Massive Medias', href: 'https://massivemedias.com' },
];

/**
 * Documents de PRESS : la fiche technique en telechargement (2 pages,
 * regeneree par docs/presskit-2027/build.mjs) et le press kit 2027 (six
 * pages), qui s'ouvre dans la visionneuse (ui/PresskitViewer.tsx, ses
 * donnees dans data/presskit.ts) ; son lien reste un vrai lien vers le PDF
 * (clic du milieu, sans JavaScript).
 */
export const LIVE_DOCS: readonly { label: string; href: string; size: string; viewer?: boolean }[] = [
  { label: 'Press kit 2027', href: '/Presskit_Maudite_Machine_2027_generic.pdf', size: '6 pages', viewer: true },
  { label: 'Tech rider (PDF)', href: '/Tech_Rider_Maudite_Machine_2026-27.pdf', size: '0.1 MB' },
];

/** Les deux pages du site ouvertes par PRESS, en nouvel onglet. */
export const LIVE_PAGES = { press: '/press/', techrider: '/techrider' } as const;

/** Massive Medias (revision 4) : STUDIO et CONTACT, nouvel onglet ; https://massivemedias.com repond 200. */
export const MASSIVE_LINK = {
  href: 'https://massivemedias.com',
  label: 'massivemedias.com',
  contactLabel: 'Print and merch, Massive Medias',
} as const;

/** STUDIO (puce de la vue eclatee, revision 4) : le texte du brief, en anglais. */
export const STUDIO = {
  setup: 'Synths and grooveboxes, a studio built for production and live sets.',
  lessons: ['Ableton Live production, one to one, remote or in person.', 'Over 70 students since 2010. Beginners welcome.'],
  print: 'Posters, stickers, waterproof menus, apparel, produced in house.',
} as const;

/* ---------------- goodies (src/data/goodies.ts, la source de /goodies) ---------------- */

export { goodieFilename } from '../data/goodies';

/** Poids affiche : 520 KB, 1.4 MB (unites decimales, comme les PDF de LIVE). */
export function fmtBytes(b: number): string {
  if (!Number.isFinite(b) || b <= 0) return '';
  return b < 1e6 ? `${Math.max(1, Math.round(b / 1e3))} KB` : `${(b / 1e6).toFixed(1)} MB`;
}

export const GOODIE_GROUPS: readonly { category: GoodieCategory; title: string; items: readonly GoodieItem[] }[] = (
  [
    ['wallpaper-desktop', 'Desktop wallpapers'],
    ['wallpaper-phone', 'Phone wallpapers'],
    ['cover', 'Release covers'],
  ] as const
).map(([category, title]) => ({ category, title, items: GOODIES.filter((g) => g.category === category) }));

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

/* ---------------- merch (public/store.json, public/stickers.json) ---------------- */

/**
 * La boutique (puce MERCH de la vue eclatee). public/store.json reste A
 * PLAT (une entree par vue : face, dos, couleur) : c'est le format que
 * l'admin ecrit (server.js, /api/save-merch) et que lisent /v1 et /v2 ;
 * le regrouper par produit ici evite de casser l'admin. Chemins absolus.
 * Les vues d'un meme produit (category) deviennent un produit : textiles
 * (face, dos, tailles), sacs (une vue par couleur, chacune son stock).
 * Pas de panier : la commande part par le formulaire de CONTACT (orderDraft).
 */
interface StoreView {
  id: number;
  src: string;
  alt: string;
  caption: string;
  price: string;
  category: string;
  active: boolean;
  sizes?: Record<string, boolean>;
  soldOut: boolean;
}

/** Une vue d'un produit : face ou dos (textiles), une couleur (sacs). */
export interface MerchView {
  src: string;
  alt: string;
  /** Front, Back, ou le nom de la couleur */
  label: string;
  inStock: boolean;
}

export interface MerchProduct {
  id: string;
  name: string;
  price: string;
  /** colors : chaque vue est une couleur a choisir ; views : face et dos d'un meme article */
  kind: 'views' | 'colors';
  views: MerchView[];
  /** tailles dans l'ordre S M L XL, en stock ou non ; null sans tailles */
  sizes: { size: string; inStock: boolean }[] | null;
  available: boolean;
}

/**
 * Le produit mis en avant (2026-10-09, Mika : "faut mettre ces hoodies en
 * avant... toute taille et ca coute 50$") : le hoodie WE ARE MUSIC MAKERS,
 * le "A" des machines devant, WE ARE MUSIC MAKERS, le grand A et MAUDITE
 * MACHINE dans le dos. Son encart est dans le menu (ui/MenuSheet.tsx) et en
 * tete de MERCH (sections/Merch.tsx), ui/HoodieFeature.tsx pour les deux.
 * Le produit lui-meme (photos, prix, tailles, stock) vient de
 * public/store.json comme les autres : id est sa category la-bas
 * ('hoodie-wamm', a part de 'hoodie' : toutes les boutiques et l'admin
 * regroupent les vues par category, le meme mot aurait fondu les deux
 * hoodies en un). Retire ou inactif dans l'admin : plus d'encart nulle part.
 */
export const FEATURED_MERCH = {
  id: 'hoodie-wamm',
  kicker: 'New drop',
  name: 'Hoodie',
  line: 'We Are Music Makers',
  /** les photos detourees : 927 x 1287 (fond transparent, ombre de contact gardee) */
  w: 927,
  h: 1287,
  alt: {
    Front: 'Black hoodie, front: the A of the machines on the chest',
    Back: 'Black hoodie, back: WE ARE MUSIC MAKERS, the big A and MAUDITE MACHINE',
  } as Readonly<Record<string, string>>,
} as const;

/**
 * Le mot de Mika dans le menu, au-dessus de Under the hood (2026-10-09,
 * Mika : "ma description de Maudite Machine et un petit texte disant que je
 * suis l'auteur de ce site web et de ces machines, donc ce serait bien qu'il
 * fasse un tour dans la boutique ou dans mon bandcamp pour me supporter,
 * faire la promo des t-shirts"). La bio est celle du press kit 2027
 * (docs/presskit-2027/content.mjs), raccourcie ; le mot est a la premiere
 * personne, signe.
 */
export const MENU_ABOUT = {
  kicker: 'Behind the machines',
  bio: 'Maudite Machine is a DJ and producer based between Canada, France and Spain, after fifteen years in the Montréal underground. He plays indie dance and psy prog: deep, rolling, made for the second half of the night.',
  note: 'I built this website and every machine on it myself. If you like playing with them, you can support me: grab a tee or the new hoodie in the shop, or pick up some music on Bandcamp. Thank you!',
  sign: 'Mika',
} as const;

export const MERCH_TEXT = 'Small runs, first come first served. No online payment: pick a piece, your order is written for you in the contact form.';
export const MERCH_EMPTY = 'The store is being restocked. Check back soon.';
export const MERCH_NOTE = 'Payment details and shipping cost sent by reply.';
const SIZE_ORDER = ['S', 'M', 'L', 'XL'];

/** Chemin absolu (barre oblique initiale), espaces encodes. */
const absPath = (p: string): string => encodeURI(`/${p.replace(/^\/+/, '')}`);

const isView = (v: unknown): v is StoreView => {
  if (!v || typeof v !== 'object') return false;
  const o = v as Record<string, unknown>;
  return typeof o.src === 'string' && typeof o.caption === 'string' && typeof o.category === 'string' && typeof o.price === 'string';
};

/** "Bag Brown" -> "Brown", "Hoodie Front" -> "Front" : le dernier mot du alt. */
const viewLabel = (alt: string): string => {
  const w = alt.trim().split(/\s+/);
  const last = w[w.length - 1] || alt;
  return last.charAt(0).toUpperCase() + last.slice(1);
};

/** Les vues actives regroupees en produits, dans l'ordre du fichier ; la face avant d'abord. */
export function groupMerch(raw: unknown): MerchProduct[] {
  if (!Array.isArray(raw)) return [];
  const byCat = new Map<string, StoreView[]>();
  for (const v of raw) {
    if (!isView(v) || v.active === false) continue;
    const list = byCat.get(v.category) ?? [];
    list.push(v);
    byCat.set(v.category, list);
  }
  return [...byCat.entries()].map(([category, list]) => {
    const colors = !list[0].sizes;
    const ordered = colors ? list : [...list].sort((a, b) => Number(/front/i.test(b.alt)) - Number(/front/i.test(a.alt)));
    const views = ordered.map((v) => ({ src: absPath(v.src), alt: v.alt, label: viewLabel(v.alt), inStock: !v.soldOut }));
    const first = ordered[0];
    const sizes = first.sizes
      ? SIZE_ORDER.filter((k) => k in first.sizes!).map((k) => ({ size: k, inStock: !first.soldOut && first.sizes![k] === true }))
      : null;
    const available = colors ? views.some((v) => v.inStock) : !first.soldOut && (!sizes || sizes.some((z) => z.inStock));
    return { id: category, name: first.caption, price: first.price, kind: colors ? 'colors' : 'views', views, sizes, available };
  });
}

/**
 * Commande (2026-10-01) : elle passe par le formulaire de CONTACT, objet
 * "Merch order - <produit>" et la commande deja ecrite dans le message
 * (taille et couleur choisies, sinon n/a) ; l'acheteur complete l'adresse.
 */
export function orderDraft(o: { name: string; price: string; size?: string | null; colour?: string | null }): { subject: string; message: string } {
  const message = [
    `Product : ${o.name}`,
    `Size : ${o.size || 'n/a'}`,
    `Colour : ${o.colour || 'n/a'}`,
    'Quantity : 1',
    `Price : ${o.price}`,
    '',
    'Shipping address :',
    'Country :',
    'Phone :',
  ].join('\n');
  return { subject: `Merch order - ${o.name}`, message };
}

let merchPromise: Promise<MerchProduct[]> | null = null;

/** Une lecture par page (cache) ; un echec rend [] et laisse le prochain montage reessayer. */
export function fetchMerch(): Promise<MerchProduct[]> {
  if (!merchPromise) {
    const p: Promise<MerchProduct[]> = fetch('/store.json', { cache: 'no-cache' })
      .then((r) => (r.ok ? r.json() : []))
      .then(groupMerch, () => {
        if (merchPromise === p) merchPromise = null;
        return [];
      });
    merchPromise = p;
  }
  return merchPromise;
}

/**
 * Packs d'autocollants (revision 4) : public/stickers.json, { packs: [...] }.
 * Un pack s'affiche s'il est actif, complet (nom, prix, couverture, au
 * moins un visuel) et s'il contient un autocollant VRSTL Records ET un
 * autocollant Massive Medias (items[].brand 'vrstl' et 'massive'). Fichier
 * absent, illisible ou sans pack affichable : la section n'existe pas.
 * Les PNG vont dans public/images/stickers/.
 */
export interface StickerItem {
  src: string;
  alt: string;
  brand: 'mm' | 'vrstl' | 'massive';
}

export interface StickerPack {
  id: string;
  name: string;
  price: string;
  count: number;
  soldOut: boolean;
  cover: string;
  items: StickerItem[];
}

const BRANDS = ['mm', 'vrstl', 'massive'] as const;

function toPack(v: unknown): StickerPack | null {
  if (!v || typeof v !== 'object') return null;
  const o = v as Record<string, unknown>;
  if (o.active !== true) return null;
  if (typeof o.id !== 'string' || typeof o.name !== 'string' || typeof o.price !== 'string' || typeof o.cover !== 'string') return null;
  if (!Array.isArray(o.items)) return null;
  const items: StickerItem[] = [];
  for (const it of o.items) {
    if (!it || typeof it !== 'object') continue;
    const r = it as Record<string, unknown>;
    if (typeof r.src !== 'string') continue;
    const brand = BRANDS.find((b) => b === r.brand) ?? 'mm';
    items.push({ src: absPath(r.src), alt: typeof r.alt === 'string' ? r.alt : '', brand });
  }
  if (items.length === 0 || !items.some((i) => i.brand === 'vrstl') || !items.some((i) => i.brand === 'massive')) return null;
  const count = typeof o.count === 'number' && Number.isInteger(o.count) && o.count > 0 ? o.count : items.length;
  return { id: o.id, name: o.name, price: o.price, count, soldOut: o.soldOut === true, cover: absPath(o.cover), items };
}

export function parseStickers(raw: unknown): StickerPack[] {
  if (!raw || typeof raw !== 'object') return [];
  const packs = (raw as { packs?: unknown }).packs;
  if (!Array.isArray(packs)) return [];
  return packs.map(toPack).filter((p): p is StickerPack => p !== null);
}

let stickersPromise: Promise<StickerPack[]> | null = null;

/** Une lecture par page ; absent (404, repli HTML de Pages) ou illisible : []. */
export function fetchStickers(): Promise<StickerPack[]> {
  if (!stickersPromise) {
    stickersPromise = fetch('/stickers.json', { cache: 'no-cache' })
      .then((r) => (r.ok && (r.headers.get('content-type') ?? '').includes('json') ? r.json() : null))
      .then(parseStickers, () => []);
  }
  return stickersPromise;
}
