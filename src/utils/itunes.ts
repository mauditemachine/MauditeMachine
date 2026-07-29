/**
 * Moteur de donnees de l'explorateur Radar : API iTunes Search.
 * Gratuite, CORS ouvert, sans cle. Fournit pochettes (artworkUrl100) et
 * extraits audio 30 s (previewUrl).
 *
 * Rien n'est appele avant une interaction utilisateur, et chaque nom
 * cherche est mis en cache memoire (Map de promesses : les clics rapides
 * successifs sur le meme nom partagent la meme requete).
 */

export interface ExplorerItem {
  id: number;
  kind: 'song' | 'album';
  title: string;
  artist: string;
  album?: string;
  date: string;
  artwork: string;
  previewUrl?: string;
  /** Pour les albums : id iTunes permettant de resoudre un extrait a la demande. */
  collectionId?: number;
  storeUrl?: string;
}

export interface ExplorerResult {
  items: ExplorerItem[];
  /** true quand le filtre label n'a rien matche et qu'on montre les resultats bruts. */
  approximate: boolean;
  /**
   * Nom composee resolu vers UN artiste ("Damon Jee & Darlyn Vlys" ->
   * "Damon Jee") : le panneau affiche cet artiste-la.
   */
  resolvedArtist?: string;
  /** Les autres artistes du combo, a afficher en chips cliquables. */
  otherArtists?: string[];
}

/**
 * Decoupe un nom compose en artistes individuels.
 * Separateurs : "&", ",", " x ", "vs", "feat." / "ft.", prefixe "V/A -".
 * "Damon Jee & Darlyn Vlys" -> ["Damon Jee", "Darlyn Vlys"].
 */
export function splitArtists(name: string): string[] {
  const base = String(name || '')
    .replace(/^\s*V\s*\/\s*A\s*[-–—:]*\s*/i, '')
    .trim();
  const parts = base
    .split(/\s*&\s*|\s*,\s*|\s+x\s+|\s+vs\.?\s+|\s+feat\.?\s+|\s+ft\.?\s+/i)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);
  return parts.length > 0 ? parts : [base];
}

const API = 'https://itunes.apple.com';

const cache = new Map<string, Promise<ExplorerResult>>();
const previewCache = new Map<string, Promise<string | null>>();

/** Normalisation fuzzy : casse et accents ignores, espaces compactes. */
const norm = (s: string) =>
  String(s || '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();

/** Correspondance souple entre deux noms (l'un contient l'autre). */
const fuzzyMatch = (a: string, b: string) => {
  const na = norm(a);
  const nb = norm(b);
  return !!na && !!nb && (na === nb || na.includes(nb) || nb.includes(na));
};

const artwork300 = (url: string | undefined) =>
  String(url || '').replace('100x100', '300x300');

async function itunesFetch(path: string, params: Record<string, string>): Promise<any[]> {
  const qs = new URLSearchParams(params).toString();
  const res = await fetch(`${API}${path}?${qs}`);
  if (!res.ok) throw new Error(`iTunes HTTP ${res.status}`);
  const data = await res.json();
  return Array.isArray(data.results) ? data.results : [];
}

const byDateDesc = (a: ExplorerItem, b: ExplorerItem) => (b.date || '').localeCompare(a.date || '');

/**
 * Cle de dedoublonnage des albums : titre normalise sans les qualificatifs
 * type "(Radio Edit)" / "(Extended Mix)" ni le suffixe " - Single/EP"
 * qu'iTunes accole, plus la date. Deux editions du meme EP a la meme date
 * ne comptent qu'une fois.
 */
const albumKey = (title: string, date: string) =>
  `${norm(
    String(title || '')
      .replace(/\s*[([][^)\]]*\b(edit|mix|version|remaster(?:ed)?)\b[^)\]]*[)\]]/gi, '')
      .replace(/\s*-\s*(single|ep)\s*$/i, ''),
  )}|${date}`;

const albumToItem = (r: any, i: number): ExplorerItem => ({
  id: r.collectionId || i,
  kind: 'album',
  title: r.collectionName || '',
  artist: r.artistName || '',
  date: String(r.releaseDate || '').slice(0, 10),
  artwork: artwork300(r.artworkUrl100),
  collectionId: r.collectionId || undefined,
  storeUrl: r.collectionViewUrl || undefined,
});

/**
 * Ancienne recherche par morceaux : /search?entity=song trie par POPULARITE,
 * donc elle remonte les vieux hits (2020-2022) avant les sorties recentes.
 * Conservee uniquement en secours quand l'artiste n'a pas de fiche iTunes.
 */
async function searchArtistBySongs(name: string): Promise<ExplorerResult> {
  const raw = await itunesFetch('/search', {
    term: name,
    entity: 'song',
    limit: '25',
  });
  const seen = new Set<string>();
  const items: ExplorerItem[] = [];
  for (const r of raw) {
    if (!fuzzyMatch(r.artistName, name)) continue;
    const dedupe = norm(`${r.trackName}|${r.collectionName}`);
    if (seen.has(dedupe)) continue;
    seen.add(dedupe);
    items.push({
      id: r.trackId || r.collectionId || items.length,
      kind: 'song',
      title: r.trackName || '',
      artist: r.artistName || '',
      album: r.collectionName || '',
      date: String(r.releaseDate || '').slice(0, 10),
      artwork: artwork300(r.artworkUrl100),
      previewUrl: r.previewUrl || undefined,
      storeUrl: r.trackViewUrl || r.collectionViewUrl || undefined,
    });
  }
  items.sort(byDateDesc);
  return { items, approximate: items.length > 0 };
}

/**
 * Dernieres sorties d'un artiste, DU PLUS RECENT AU PLUS ANCIEN.
 * Methode en 2 etapes :
 * 1. /search entity=musicArtist -> artistId (nom exact insensible a la
 *    casse et aux accents, sinon premier resultat)
 * 2. /lookup id=<artistId> entity=album sort=recent -> sa discographie
 *    triee par date (re-triee cote client par securite)
 * Sans fiche artiste ou sans albums : retour a la recherche par morceaux.
 */
export function searchArtist(name: string): Promise<ExplorerResult> {
  const key = `a:${norm(name)}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        // Nom compose ("Damon Jee & Darlyn Vlys") : les duos n'ont presque
        // jamais de fiche iTunes. On tente l'artistId sur le nom complet
        // PUIS sur chaque artiste du combo, premier match exact gagnant.
        const parts = splitArtists(name);
        const candidates = [name, ...parts.filter((p) => norm(p) !== norm(name))];

        let picked: any = null;
        let exact = false;
        for (const cand of candidates) {
          const artists = await itunesFetch('/search', {
            term: cand,
            entity: 'musicArtist',
            limit: '5',
          });
          const hit = artists.find((a) => norm(a.artistName || '') === norm(cand));
          if (hit) {
            picked = hit;
            exact = true;
            break;
          }
          // Nom simple sans match exact : on garde le comportement souple
          // d'avant (premier resultat, marque approximatif).
          if (!picked && candidates.length === 1 && artists[0]) picked = artists[0];
        }

        const artistId = picked?.artistId;
        const resolvedArtist = picked ? String(picked.artistName || '') : undefined;
        const otherArtists =
          parts.length > 1
            ? parts.filter((p) => !resolvedArtist || norm(p) !== norm(resolvedArtist))
            : [];

        if (artistId) {
          const raw = await itunesFetch('/lookup', {
            id: String(artistId),
            entity: 'album',
            sort: 'recent',
            limit: '50',
          });
          const seen = new Set<string>();
          const items: ExplorerItem[] = [];
          for (const r of raw) {
            if (r.wrapperType !== 'collection') continue; // le 1er resultat est la fiche artiste
            const item = albumToItem(r, items.length);
            const dedupe = albumKey(item.title, item.date);
            if (seen.has(dedupe)) continue;
            seen.add(dedupe);
            items.push(item);
          }
          items.sort(byDateDesc);
          if (items.length > 0) {
            // approximate quand on est parti d'un match non exact
            return { items, approximate: !exact, resolvedArtist, otherArtists };
          }
        }

        // Aucun artistId : recherche par morceaux (triee par date et
        // dedupliquee), chips pour chaque artiste du combo quand meme.
        const fallback = await searchArtistBySongs(name);
        return { ...fallback, otherArtists: parts.length > 1 ? parts : [] };
      })().catch((err) => {
        cache.delete(key); // un echec reseau ne doit pas s'installer dans le cache
        throw err;
      }),
    );
  }
  return cache.get(key)!;
}

/**
 * Dernieres sorties d'un label : albums dont le copyright ou le titre
 * mentionne le label. Si rien ne matche, resultats bruts marques approximatifs.
 */
export function searchLabel(name: string): Promise<ExplorerResult> {
  const key = `l:${norm(name)}`;
  if (!cache.has(key)) {
    cache.set(
      key,
      (async () => {
        const raw = await itunesFetch('/search', {
          term: name,
          entity: 'album',
          limit: '25',
        });
        const target = norm(name);
        // Le copyright ("P 2024 Permanent Vacation") identifie vraiment le
        // label. Le titre d'album n'est qu'un second choix : chercher
        // "Permanent Vacation" par titre ramene surtout des morceaux
        // homonymes sans rapport avec le label.
        const byCopyright = raw.filter((r) => norm(r.copyright || '').includes(target));
        const byName = raw.filter(
          (r) => !byCopyright.includes(r) && norm(r.collectionName || '').includes(target),
        );
        const matched = byCopyright.length > 0 ? byCopyright : byName;
        const approximate = byCopyright.length === 0 && raw.length > 0;
        const source = matched.length > 0 ? matched : raw;
        const seen = new Set<string>();
        const items: ExplorerItem[] = [];
        for (const r of source) {
          const item = albumToItem(r, items.length);
          const dedupe = albumKey(item.title, item.date);
          if (seen.has(dedupe)) continue;
          seen.add(dedupe);
          items.push(item);
        }
        items.sort(byDateDesc);
        return { items, approximate };
      })().catch((err) => {
        cache.delete(key);
        throw err;
      }),
    );
  }
  return cache.get(key)!;
}

export interface AlbumTrack {
  title: string;
  artist: string;
  previewUrl: string;
}

const albumTracksCache = new Map<string, Promise<AlbumTrack[]>>();

/**
 * Pistes jouables d'un album, dans l'ordre du disque (lookup a la demande,
 * mis en cache). Le lecteur les injecte dans la file a la place de l'album.
 */
export function albumTracks(collectionId: number): Promise<AlbumTrack[]> {
  const key = `c:${collectionId}`;
  if (!albumTracksCache.has(key)) {
    albumTracksCache.set(
      key,
      (async () => {
        const raw = await itunesFetch('/lookup', {
          id: String(collectionId),
          entity: 'song',
          limit: '50',
        });
        return raw
          .filter((r) => r.wrapperType === 'track' && r.previewUrl)
          .map((r) => ({
            title: String(r.trackName || ''),
            artist: String(r.artistName || ''),
            previewUrl: String(r.previewUrl),
          }));
      })().catch(() => {
        albumTracksCache.delete(key);
        return [];
      }),
    );
  }
  return albumTracksCache.get(key)!;
}

/**
 * Resout l'extrait d'une ligne du flux (artiste + titre de la release).
 * null si iTunes ne connait pas le morceau : l'appelant retombe sur le lien.
 */
export function resolveTrackPreview(artist: string, title: string): Promise<string | null> {
  const key = `t:${norm(artist)}|${norm(title)}`;
  if (!previewCache.has(key)) {
    previewCache.set(
      key,
      (async () => {
        const raw = await itunesFetch('/search', {
          term: `${artist} ${title}`,
          entity: 'song',
          limit: '10',
        });
        const match = raw.find(
          (r) =>
            r.previewUrl &&
            fuzzyMatch(r.artistName, artist) &&
            (fuzzyMatch(r.trackName, title) || fuzzyMatch(r.collectionName || '', title)),
        );
        const loose = match || raw.find((r) => r.previewUrl && fuzzyMatch(r.artistName, artist));
        return loose ? String(loose.previewUrl) : null;
      })().catch(() => {
        previewCache.delete(key);
        return null;
      }),
    );
  }
  return previewCache.get(key)!;
}

/** Titre nettoye des parentheses, crochets et suffixes remix/edit. */
const cleanTitle = (t: string) =>
  String(t || '')
    .replace(/\s*[([][^)\]]*[)\]]/g, ' ')
    .replace(/\s+(?:rmx|remix(?:es)?|edit|extended|original mix|club mix)\b.*$/i, '')
    .replace(/\s+/g, ' ')
    .trim();

/**
 * Resolution renforcee d'un extrait : plusieurs requetes successives avant
 * d'abandonner. Le lecteur ne doit JAMAIS ouvrir un onglet a la place du
 * play : si tout echoue ici, il affiche un message et passe a la suivante.
 * 1. artiste complet + titre
 * 2. premier artiste du combo + titre
 * 3. premier artiste + titre nettoye (parentheses, rmx...)
 * 4. titre seul, filtre par n'importe quel artiste du combo
 */
export function resolveTrackPreviewSmart(artist: string, title: string): Promise<string | null> {
  const key = `ts:${norm(artist)}|${norm(title)}`;
  if (!previewCache.has(key)) {
    previewCache.set(
      key,
      (async () => {
        const parts = splitArtists(artist);
        const first = parts[0] || artist;
        const cleaned = cleanTitle(title);

        const attempts: Array<() => Promise<string | null>> = [
          () => resolveTrackPreview(artist, title),
        ];
        if (norm(first) !== norm(artist)) attempts.push(() => resolveTrackPreview(first, title));
        if (cleaned && norm(cleaned) !== norm(title))
          attempts.push(() => resolveTrackPreview(first, cleaned));
        attempts.push(async () => {
          const raw = await itunesFetch('/search', {
            term: cleaned || title,
            entity: 'song',
            limit: '15',
          });
          const hit = raw.find(
            (s) => s.previewUrl && parts.some((p) => fuzzyMatch(s.artistName, p)),
          );
          return hit ? String(hit.previewUrl) : null;
        });

        for (const attempt of attempts) {
          try {
            const url = await attempt();
            if (url) return url;
          } catch {}
        }
        return null;
      })().catch(() => {
        previewCache.delete(key);
        return null;
      }),
    );
  }
  return previewCache.get(key)!;
}

/** Liens de secours quand iTunes ne connait pas un nom. */
export const fallbackLinks = (name: string) => [
  { site: 'Beatport', url: `https://www.beatport.com/search/releases?q=${encodeURIComponent(name)}` },
  { site: 'SoundCloud', url: `https://soundcloud.com/search?q=${encodeURIComponent(name)}` },
  { site: 'Spotify', url: `https://open.spotify.com/search/${encodeURIComponent(name)}` },
];
