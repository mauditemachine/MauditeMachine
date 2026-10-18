/**
 * La collection Rekordbox (2026-10-18, Mika : "en desktop seulement je
 * voudrais que ce soit possible de rajouter les dossiers de iCloud Drive >
 * Rekordbox concernant la musique ; ne rien copier dans le site, juste
 * faire un mapping automatique sur le dossier de mon systeme"). Quand un
 * dossier relie (dj/crate.ts) contient un export XML de Rekordbox (dans
 * Rekordbox : Fichier > Exporter la collection au format xml), on le lit
 * une fois par liaison ou relecture : le BPM et la tonalite de chaque
 * morceau tels que Rekordbox les a analyses, et ses playlists, prefixees
 * "RB " pour les reconnaitre. Rien n'est envoye, rien n'est copie : le XML
 * se lit sur le disque, dans le navigateur, et seul ce qui retrouve un
 * morceau deja relie compte.
 *
 * Ce module ne fait que lire le XML et retrouver nos morceaux ; la caisse
 * (crate.ts) applique. Un XML abime rend null, la liaison du dossier n'en
 * souffre pas.
 */

export interface RbTrack {
  /** TrackID */
  id: string;
  name: string;
  artist: string;
  /** AverageBpm, ou null */
  bpm: number | null;
  /** Tonality telle quelle ("Am", "F#m", "11A"), ou null */
  key: string | null;
  /** TotalTime, en secondes */
  seconds: number;
  /** Size, en octets, ou null */
  size: number | null;
  /** Location decodee, sans "file://localhost" : "/Users/mika/.../Rekordbox/Techno/Track.mp3" */
  path: string;
}

export interface RbPlaylist {
  /** le nom, dossiers compris : "Sets / Peak" */
  name: string;
  /** les TrackID de ses morceaux, dans l'ordre */
  trackIds: string[];
}

export interface RbCollection {
  tracks: RbTrack[];
  playlists: RbPlaylist[];
}

/** La tete d'un .xml (2 ko suffisent) : un export Rekordbox ? */
export const isRekordboxXml = (head: string): boolean => head.includes('<DJ_PLAYLISTS');

/** "file://localhost/Users/mika/My%20Music/Track.mp3" : "/Users/mika/My Music/Track.mp3" (un % mal forme reste tel quel). */
export function locationPath(loc: string): string {
  let p = loc.trim().replace(/^file:\/\/(?:localhost)?/i, '');
  try {
    p = decodeURIComponent(p);
  } catch {
    /* un % orphelin : le chemin brut */
  }
  return p.normalize('NFC');
}

const num = (s: string | null): number | null => {
  const n = Number.parseFloat((s ?? '').replace(',', '.'));
  return Number.isFinite(n) ? n : null;
};

/**
 * Lit un export Rekordbox. Rend null si ce n'en est pas un ou s'il est
 * abime (DOMParser pose alors un <parsererror>). Les playlists des
 * dossiers (NODE Type 0) gardent leur chemin dans leur nom ; une playlist
 * par chemins (KeyType 1) retrouve ses TrackID par la collection.
 */
export function parseRekordbox(xml: string): RbCollection | null {
  const doc = new DOMParser().parseFromString(xml, 'application/xml');
  if (doc.getElementsByTagName('parsererror').length > 0) return null;
  const root = doc.documentElement;
  if (!root || root.tagName !== 'DJ_PLAYLISTS') return null;
  const tracks: RbTrack[] = [];
  const byPath = new Map<string, string>();
  const collection = root.getElementsByTagName('COLLECTION')[0];
  if (collection) {
    for (const t of Array.from(collection.children)) {
      if (t.tagName !== 'TRACK') continue;
      const id = t.getAttribute('TrackID') ?? '';
      const path = locationPath(t.getAttribute('Location') ?? '');
      if (!id || !path) continue;
      const bpm = num(t.getAttribute('AverageBpm'));
      const size = num(t.getAttribute('Size'));
      tracks.push({
        id,
        name: t.getAttribute('Name') ?? '',
        artist: t.getAttribute('Artist') ?? '',
        bpm: bpm !== null && bpm > 0 ? bpm : null,
        key: (t.getAttribute('Tonality') ?? '').trim() || null,
        seconds: Math.max(0, num(t.getAttribute('TotalTime')) ?? 0),
        size: size !== null && size > 0 ? size : null,
        path,
      });
      byPath.set(path.toLowerCase(), id);
    }
  }
  const playlists: RbPlaylist[] = [];
  const walk = (node: Element, trail: string[]): void => {
    const type = node.getAttribute('Type');
    const name = (node.getAttribute('Name') ?? '').trim();
    if (type === '1') {
      const byLocation = node.getAttribute('KeyType') === '1';
      const trackIds: string[] = [];
      for (const t of Array.from(node.children)) {
        if (t.tagName !== 'TRACK') continue;
        const k = t.getAttribute('Key') ?? '';
        const id = byLocation ? byPath.get(locationPath(k).toLowerCase()) : k;
        if (id) trackIds.push(id);
      }
      playlists.push({ name: [...trail, name || 'Playlist'].join(' / '), trackIds });
      return;
    }
    // Un dossier (Type 0) : ROOT au sommet ne compte pas dans le nom
    const next = trail.length === 0 && (name === 'ROOT' || !name) ? trail : [...trail, name];
    for (const c of Array.from(node.children)) if (c.tagName === 'NODE') walk(c, next);
  };
  const lists = root.getElementsByTagName('PLAYLISTS')[0];
  if (lists) for (const c of Array.from(lists.children)) if (c.tagName === 'NODE') walk(c, []);
  return { tracks, playlists };
}

/** Un morceau relie de la caisse, le temps de la liaison : son chemin depuis le dossier relie ("Rekordbox/Techno/Track.mp3"). */
export interface LinkedFile {
  id: string;
  path: string;
  name: string;
  size: number;
}

const fold = (s: string): string => s.normalize('NFC').toLowerCase();
const baseOf = (p: string): string => p.slice(p.lastIndexOf('/') + 1);

/**
 * Retrouve nos morceaux relies dans la collection : pour chaque TrackID
 * retrouve, l'id de la caisse. D'abord par le chemin sous le nom du
 * dossier relie (la fin de Location ; chaque endroit ou ce nom parait, un
 * sous-dossier peut porter le meme), sinon par nom de fichier et taille
 * (un dossier relie en dessous de la collection, ou deplace) ; sans
 * taille dans l'export, par le nom seul quand il n'existe qu'une fois des
 * deux cotes. Insensible a la casse et a la forme des accents (macOS,
 * iCloud).
 */
export function matchRekordbox(col: RbCollection, linked: readonly LinkedFile[], root: string): Map<string, string> {
  const byPath = new Map<string, string>();
  const bySize = new Map<string, string>();
  /** un nom de fichier relie, null s'il y en a plusieurs */
  const byName = new Map<string, string | null>();
  for (const f of linked) {
    const base = fold(f.name);
    byPath.set(fold(f.path), f.id);
    bySize.set(`${base}|${f.size}`, f.id);
    byName.set(base, byName.has(base) ? null : f.id);
  }
  const rbNames = new Map<string, number>();
  for (const t of col.tracks) {
    const base = baseOf(fold(t.path));
    rbNames.set(base, (rbNames.get(base) ?? 0) + 1);
  }
  const needle = `/${fold(root)}/`;
  const out = new Map<string, string>();
  for (const t of col.tracks) {
    const p = fold(t.path);
    let id: string | undefined;
    if (root) for (let i = p.indexOf(needle); i >= 0 && !id; i = p.indexOf(needle, i + 1)) id = byPath.get(p.slice(i + 1));
    const base = baseOf(p);
    if (!id && t.size !== null) id = bySize.get(`${base}|${t.size}`);
    if (!id && t.size === null && rbNames.get(base) === 1) id = byName.get(base) ?? undefined;
    if (id) out.set(t.id, id);
  }
  return out;
}
