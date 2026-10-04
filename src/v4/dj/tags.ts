/**
 * Les tags d'un fichier audio du DJ (2026-10-04), repris de sonaa.ca
 * (src/platines/tags.ts) : titre, artiste, BPM et tonalite tels que
 * Rekordbox, Serato ou Mixed In Key les ont ranges (ID3 2.2 a 2.4, TBPM et
 * TKEY). Sans tags (WAV, AIFF), le nom du fichier : "Artiste - Titre.wav".
 * Seule la tete du fichier est lue ; rien ne quitte l'appareil.
 */

export interface DjTags {
  title?: string;
  artist?: string;
  bpm?: number;
  key?: string;
}

const syncsafe = (o: Uint8Array, i: number): number => ((o[i] ?? 0) << 21) | ((o[i + 1] ?? 0) << 14) | ((o[i + 2] ?? 0) << 7) | (o[i + 3] ?? 0);
const int = (o: Uint8Array, i: number, n: number): number => {
  let v = 0;
  for (let k = 0; k < n; k += 1) v = v * 256 + (o[i + k] ?? 0);
  return v;
};

/** Les quatre encodages du texte ID3 ; plusieurs valeurs separees par un nul : la premiere. */
function text(o: Uint8Array, enc: number): string {
  let t: string;
  if (enc === 1) t = new TextDecoder(o[0] === 0xfe && o[1] === 0xff ? 'utf-16be' : 'utf-16le').decode(o);
  else if (enc === 2) t = new TextDecoder('utf-16be').decode(o);
  else if (enc === 3) t = new TextDecoder('utf-8').decode(o);
  else t = new TextDecoder('latin1').decode(o);
  return (t.replace(/^﻿/, '').split('\u0000')[0] ?? '').trim();
}

const FIELDS: Readonly<Record<string, keyof DjTags>> = {
  TIT2: 'title',
  TT2: 'title',
  TPE1: 'artist',
  TP1: 'artist',
  TBPM: 'bpm',
  TBP: 'bpm',
  TKEY: 'key',
  TKE: 'key',
};

/** Longueur des tags d'apres les dix premiers octets (0 sans tags). */
export function tagsLength(head: Uint8Array): number {
  if (head[0] !== 0x49 || head[1] !== 0x44 || head[2] !== 0x33) return 0;
  return 10 + syncsafe(head, 6);
}

export function readTags(buf: ArrayBuffer): DjTags {
  const o = new Uint8Array(buf);
  if (o[0] !== 0x49 || o[1] !== 0x44 || o[2] !== 0x33) return {};
  const version = o[3] ?? 0;
  const flags = o[5] ?? 0;
  const end = Math.min(o.length, 10 + syncsafe(o, 6));
  const v22 = version === 2;
  let i = 10;
  if (flags & 0x40 && !v22) i += version === 4 ? syncsafe(o, 10) : 4 + int(o, 10, 4);
  const out: DjTags = {};
  while (i + (v22 ? 6 : 10) <= end) {
    const id = new TextDecoder('latin1').decode(o.subarray(i, i + (v22 ? 3 : 4)));
    if (!/^[A-Z0-9]+$/.test(id)) break;
    const size = v22 ? int(o, i + 3, 3) : version === 4 ? syncsafe(o, i + 4) : int(o, i + 4, 4);
    const start = i + (v22 ? 6 : 10);
    if (size <= 0 || start + size > end) break;
    const body = o.subarray(start, start + size);
    const f = FIELDS[id];
    if (f && out[f] === undefined) {
      const v = text(body.subarray(1), body[0] ?? 0);
      if (f === 'bpm') {
        const n = Number.parseFloat(v.replace(',', '.'));
        if (n > 40 && n < 260) out.bpm = Math.round(n * 10) / 10;
      } else if (v) out[f] = v;
    }
    i = start + size;
  }
  return out;
}

/** "Artiste - Titre (Original Mix).mp3" : l'artiste et le titre ; un numero de piste devant s'en va. */
export function titleFromName(name: string): { title: string; artist: string } {
  const bare = name.replace(/\.[a-z0-9]{2,5}$/i, '').replace(/_/g, ' ').trim();
  const parts = bare.split(/\s+-\s+/);
  if (parts.length >= 2) {
    const artist = (parts[0] ?? '').replace(/^(?:\d{1,3}\s*[.)]\s*|\d{2}\s+)/, '').trim();
    return { artist, title: parts.slice(1).join(' - ').trim() };
  }
  return { title: bare, artist: '' };
}

/** Les tags d'un fichier sans le lire en entier : la tete, puis les tags seuls. */
export async function tagsOfFile(f: File): Promise<DjTags> {
  try {
    const head = new Uint8Array(await f.slice(0, 10).arrayBuffer());
    const n = tagsLength(head);
    if (n === 0) return {};
    return readTags(await f.slice(0, Math.min(f.size, n)).arrayBuffer());
  } catch {
    return {};
  }
}
