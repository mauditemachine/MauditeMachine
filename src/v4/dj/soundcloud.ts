/**
 * SoundCloud pour le MM-DECKS (2026-10-04, Mika : "ce qu'il y a sur Audius
 * c'est vraiment pourri", puis "oui branche soundcloud"). Le site est
 * statique : la cle de l'application SoundCloud vit dans le Worker de Sonaa
 * (sonaa-sets, worker/src/soundcloud.ts), qui cherche les morceaux et ouvre
 * leurs flux ; la page ne la voit jamais.
 *
 * Seulement les licences Creative Commons qui autorisent le remix (et le
 * domaine public) : les conditions de l'API interdisent de modifier un
 * morceau sans la permission de son auteur, et une platine le modifie
 * (vitesse, EQ, filtre, effets). L'auteur, SoundCloud et la page du morceau
 * sont credites dans la playlist et sur l'ecran de la platine. Le son n'est
 * garde nulle part : il est decode en memoire, le temps de la visite.
 *
 * Le son arrive en morceaux de fichier MP3 (HLS) que la page met bout a
 * bout : directement depuis le CDN de SoundCloud, ou par le relais du
 * Worker si le CDN refuse le navigateur.
 */

import type { DjTrack } from './state';
import { camelot } from './math';

const PASSERELLE = 'https://sonaa-sets.massivemedias.workers.dev/api/soundcloud';

/** Le nom court d'une licence, pour l'ecran. */
export const LICENSE_LABEL: Readonly<Record<string, string>> = {
  'cc-by': 'CC BY',
  'cc-by-sa': 'CC BY-SA',
  'cc-by-nc': 'CC BY-NC',
  'cc-by-nc-sa': 'CC BY-NC-SA',
  'no-rights-reserved': 'CC0',
};

interface Raw {
  id: string;
  title: string;
  artist: string;
  bpm: number | null;
  key: string | null;
  duration: number;
  license: string;
  link: string;
}

export type ScSearch = { ok: true; tracks: DjTrack[] } | { ok: false; reason: 'off' | 'down' };

/** Cherche (vide : des styles de club) ; 'off' tant que la cle n'est pas posee dans le Worker. */
export async function searchSoundcloud(q: string, signal: AbortSignal): Promise<ScSearch> {
  let r: Response;
  try {
    r = await fetch(`${PASSERELLE}/chercher?q=${encodeURIComponent(q)}`, { signal });
  } catch {
    if (signal.aborted) throw new DOMException('aborted', 'AbortError');
    return { ok: false, reason: 'down' };
  }
  if (r.status === 503) return { ok: false, reason: 'off' };
  if (!r.ok) return { ok: false, reason: 'down' };
  const d = (await r.json()) as { tracks?: Raw[] };
  return {
    ok: true,
    tracks: (d.tracks ?? []).map((t) => ({
      id: t.id,
      source: 'soundcloud' as const,
      title: t.title,
      artist: t.artist,
      bpm: t.bpm,
      key: camelot(t.key),
      duration: t.duration,
      link: t.link,
      license: t.license,
    })),
  };
}

/** Les octets d'un morceau : ses morceaux de fichier, quatre a la fois, mis bout a bout. */
export async function soundcloudBytes(urn: string, progress: (p: number) => void, signal: AbortSignal): Promise<ArrayBuffer> {
  const r = await fetch(`${PASSERELLE}/flux?urn=${encodeURIComponent(urn)}`, { signal });
  if (r.status === 503) throw new Error('SoundCloud is not connected');
  if (!r.ok) throw new Error(`SoundCloud ${r.status}`);
  const { pieces } = (await r.json()) as { format: 'mp3' | 'aac'; pieces: string[] };
  const parts: Uint8Array[] = new Array(pieces.length);
  let relay = false;
  let done = 0;
  const one = async (i: number): Promise<void> => {
    const direct = (): Promise<Response> => fetch(pieces[i], { signal });
    const relayed = (): Promise<Response> => fetch(`${PASSERELLE}/piece?u=${encodeURIComponent(pieces[i])}`, { signal });
    let res: Response;
    if (relay) res = await relayed();
    else {
      try {
        res = await direct();
      } catch (e) {
        if (signal.aborted) throw e;
        // Le CDN refuse la page (CORS) : tout passe desormais par le relais
        relay = true;
        res = await relayed();
      }
    }
    if (!res.ok) throw new Error(`SoundCloud piece ${res.status}`);
    parts[i] = new Uint8Array(await res.arrayBuffer());
    done += 1;
    progress(done / pieces.length);
  };
  // Le premier seul (il decide du relais), puis quatre a la fois
  await one(0);
  let next = 1;
  const worker = async (): Promise<void> => {
    while (next < pieces.length) {
      const i = next;
      next += 1;
      await one(i);
    }
  };
  await Promise.all([worker(), worker(), worker(), worker()]);
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total);
  let o = 0;
  for (const p of parts) {
    out.set(p, o);
    o += p.length;
  }
  return out.buffer;
}
