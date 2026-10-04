/**
 * La caisse du MM-DECKS (2026-10-04, Mika : "la memoire des fichiers") : les
 * morceaux de l'appareil, gardes d'une visite a l'autre dans le navigateur
 * (IndexedDB), sur cet appareil seulement. Rien ne part sur internet. Reprise
 * de la caisse des Decks de sonaa.ca (ADR-099 de Sonaa).
 *
 * Trois facons d'entrer :
 * - COPIE : le fichier est copie dans le navigateur (Safari, Firefox, iPhone,
 *   fichiers seuls). Avant un gros import, on dit combien il pese et s'il y
 *   a la place (storageLeft).
 * - RELIE (Chrome, Edge) : un dossier choisi ou glisse ; la caisse ne garde
 *   que l'adresse de chaque fichier sur le disque et le lit la ou il est.
 *   A la visite suivante, le navigateur redemande une fois l'acces, au
 *   premier morceau qu'on charge (un clic).
 * - POUR LA VISITE : trop gros pour etre copie ailleurs que sur Chrome
 *   (Mika : 1 800 morceaux) ; les fichiers restent en memoire, seuls leurs
 *   tags et leur BPM sont gardes ; la fois suivante, on glisse le dossier de
 *   nouveau et chaque morceau retrouve ses donnees et ses cues.
 *
 * A l'entree on ne lit que les tags (dj/tags.ts) ; la duree, et le BPM quand
 * le tag n'en dit rien, se calculent ensuite en fond, un morceau a la fois,
 * et jamais pendant qu'une platine joue. Le meme fichier glisse deux fois
 * est le meme morceau (son empreinte : nom, taille, date), avec ses cues.
 */

import { camelot, estimateBpm } from './math';
import type { DjTrack } from './state';
import { tagsOfFile, titleFromName } from './tags';

const DB = 'mm-dj-crate';
const TRACKS = 'tracks';
const ROOTS = 'roots';
/** Decode en entier, un fichier de plus de 200 Mo (un mix de deux heures) pese trop lourd sur un telephone. */
const MAX_BYTES = 200 * 1024 * 1024;
const SOUND = /\.(mp3|wav|aiff?|flac|m4a|aac|ogg|opus)$/i;
export const isSound = (f: File): boolean => f.type.startsWith('audio/') || SOUND.test(f.name);

interface Entry {
  id: string;
  name: string;
  title: string;
  artist: string;
  bpm: number | null;
  key: string | null;
  duration: number;
  folder: string;
  added: number;
  /** copie dans le navigateur */
  blob?: Blob;
  /** relie sur le disque (Chrome, Edge), et le dossier relie qui le contient */
  handle?: FileSystemFileHandle;
  root?: string;
  /** relie pour la visite seulement */
  visit?: boolean;
  unreadable?: boolean;
}

/* ---------------- la base ---------------- */

let db: Promise<IDBDatabase> | null = null;
function open(): Promise<IDBDatabase> {
  db ??= new Promise((ok, ko) => {
    const r = indexedDB.open(DB, 1);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(TRACKS)) r.result.createObjectStore(TRACKS, { keyPath: 'id' });
      if (!r.result.objectStoreNames.contains(ROOTS)) r.result.createObjectStore(ROOTS, { keyPath: 'name' });
    };
    r.onsuccess = () => ok(r.result);
    r.onerror = () => ko(r.error ?? new Error('IndexedDB'));
  });
  return db;
}

function req<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest, store = TRACKS): Promise<T> {
  return open().then(
    (d) =>
      new Promise<T>((ok, ko) => {
        const r = fn(d.transaction(store, mode).objectStore(store));
        r.onsuccess = () => ok(r.result as T);
        r.onerror = () => ko(r.error ?? new Error('IndexedDB'));
      })
  );
}

/* ---------------- ecoute ---------------- */

const listeners = new Set<() => void>();
let version = 0;
function changed(): void {
  version += 1;
  listeners.forEach((fn) => fn());
}

export const crateEvents = {
  version: (): number => version,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/* ---------------- lecture ---------------- */

/** Les fichiers relies pour la visite : de simples references, perdues a la fermeture de la page. */
const inMemory = new Map<string, File>();

function toTrack(e: Entry): DjTrack {
  return {
    id: e.id,
    source: 'file',
    title: e.title,
    artist: e.artist,
    bpm: e.bpm,
    key: e.key,
    duration: e.duration,
    folder: e.folder,
    ...(e.unreadable ? { unreadable: true } : {}),
    ...(e.visit && !inMemory.has(e.id) && !e.blob ? { relink: true } : {}),
  };
}

/** Les morceaux de la caisse, les derniers entres en premier. */
export async function crateTracks(): Promise<DjTrack[]> {
  try {
    const all = await req<Entry[]>('readonly', (s) => s.getAll());
    return all.sort((a, b) => b.added - a.added).map(toTrack);
  } catch {
    return [];
  }
}

/* ---------------- acces aux fichiers relies ---------------- */

interface Permissions {
  queryPermission(o: { mode: 'read' }): Promise<PermissionState>;
  requestPermission(o: { mode: 'read' }): Promise<PermissionState>;
}
/** Morceaux qui attendent l'acces a leur dossier pour etre analyses. */
const waiting = new Set<string>();

async function granted(h: FileSystemHandle, ask: boolean): Promise<boolean> {
  const p = h as unknown as Permissions;
  if ((await p.queryPermission({ mode: 'read' })) === 'granted') return true;
  return ask && (await p.requestPermission({ mode: 'read' })) === 'granted';
}

/** Le contenu d'une entree : copie, en memoire, ou lu sur le disque si l'acces est accorde (demande si ask). */
async function contentOf(e: Entry, ask: boolean): Promise<Blob | null> {
  if (e.blob) return e.blob;
  const mem = inMemory.get(e.id);
  if (mem) return mem;
  if (!e.handle) return null;
  const root = e.root ? await req<{ handle: FileSystemDirectoryHandle } | undefined>('readonly', (s) => s.get(e.root ?? ''), ROOTS) : undefined;
  if (!(await granted(root?.handle ?? e.handle, ask))) return null;
  if (waiting.size > 0) {
    waiting.clear();
    void analyzeAll();
  }
  return e.handle.getFile();
}

/** Le fichier d'un morceau, pour le poser sur une platine (pendant un clic : l'acces peut etre demande). */
export async function crateFile(id: string): Promise<Blob | null> {
  const e = await req<Entry | undefined>('readonly', (s) => s.get(id));
  return e ? contentOf(e, true) : null;
}

/* ---------------- entrer ---------------- */

/** Le meme fichier glisse deux fois est le meme morceau, avec ses cues. */
export function fingerprint(f: File): string {
  let h = 0x811c9dc5;
  for (const c of `${f.name}|${f.size}|${f.lastModified}`) h = Math.imul(h ^ c.charCodeAt(0), 0x01000193);
  return `f${(h >>> 0).toString(16)}`;
}

async function entryOf(f: File, id: string, folder: string, where: Pick<Entry, 'blob' | 'handle' | 'root' | 'visit'>): Promise<Entry> {
  const tags = await tagsOfFile(f);
  const named = titleFromName(f.name);
  return {
    id,
    name: f.name,
    title: tags.title || named.title,
    artist: tags.artist || named.artist,
    bpm: tags.bpm ?? null,
    key: camelot(tags.key),
    duration: 0,
    folder,
    added: Date.now(),
    ...where,
  };
}

export interface PlacedFile {
  file: File;
  folder: string;
}

export type ImportMode = 'copy' | 'visit';

/**
 * Range des fichiers : copies dans le navigateur, ou relies pour la visite.
 * Deja dans la caisse, un morceau change seulement de dossier (et retrouve
 * son fichier pour la visite). Rend le nombre de morceaux ranges.
 */
export async function addFiles(list: readonly PlacedFile[], mode: ImportMode, progress: (done: number, total: number) => void): Promise<number> {
  let n = 0;
  for (let i = 0; i < list.length; i += 1) {
    const { file, folder } = list[i];
    progress(i + 1, list.length);
    if (!isSound(file) || file.size > MAX_BYTES) continue;
    try {
      const id = fingerprint(file);
      if (mode === 'visit') inMemory.set(id, file);
      const old = await req<Entry | undefined>('readonly', (s) => s.get(id));
      if (old) {
        const next: Entry = { ...old, folder: folder || old.folder, ...(mode === 'copy' && !old.blob && !old.handle ? { blob: file, visit: undefined } : {}) };
        await req('readwrite', (s) => s.put(next));
        waiting.delete(id);
      } else {
        const e = await entryOf(file, id, folder, mode === 'copy' ? { blob: file } : { visit: true });
        await req('readwrite', (s) => s.put(e));
      }
      n += 1;
      if (n % 50 === 0) changed();
    } catch {
      /* un fichier illisible : le suivant */
    }
  }
  changed();
  void analyzeAll();
  return n;
}

/* ---------------- relier un dossier (Chrome, Edge) ---------------- */

interface Picker {
  showDirectoryPicker?: (o?: { id?: string; mode?: 'read' }) => Promise<FileSystemDirectoryHandle>;
}
export const canLink = (): boolean => typeof window !== 'undefined' && typeof (window as unknown as Picker).showDirectoryPicker === 'function';

type Children = AsyncIterable<FileSystemHandle>;
async function soundsIn(d: FileSystemDirectoryHandle): Promise<FileSystemFileHandle[]> {
  const out: FileSystemFileHandle[] = [];
  for await (const h of (d as unknown as { values(): Children }).values()) {
    if (h.kind === 'directory') out.push(...(await soundsIn(h as FileSystemDirectoryHandle)));
    else if (SOUND.test(h.name)) out.push(h as FileSystemFileHandle);
  }
  return out;
}

/** Ouvre le selecteur de dossier et relie ce qu'on choisit ; null si l'on renonce. */
export async function pickAndLink(progress: (done: number, total: number) => void): Promise<{ name: string; n: number } | null> {
  const pick = (window as unknown as Picker).showDirectoryPicker;
  if (!pick) return null;
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await pick({ id: 'mm-dj-crate', mode: 'read' });
  } catch {
    return null;
  }
  return linkFolder(dir, progress);
}

/** Relie un dossier deja choisi (selecteur, ou lache sur la playlist) : rien n'est copie. */
export async function linkFolder(dir: FileSystemDirectoryHandle, progress: (done: number, total: number) => void): Promise<{ name: string; n: number }> {
  await req('readwrite', (s) => s.put({ name: dir.name, handle: dir }), ROOTS);
  const sounds = await soundsIn(dir);
  let n = 0;
  for (let i = 0; i < sounds.length; i += 1) {
    const h = sounds[i];
    progress(i + 1, sounds.length);
    try {
      const f = await h.getFile();
      if (f.size > MAX_BYTES) continue;
      const id = fingerprint(f);
      const old = await req<Entry | undefined>('readonly', (s) => s.get(id));
      const e: Entry = old ? { ...old, folder: dir.name, handle: h, root: dir.name, visit: undefined } : await entryOf(f, id, dir.name, { handle: h, root: dir.name });
      await req('readwrite', (s) => s.put(e));
      n += 1;
      if (n % 50 === 0) changed();
    } catch {
      /* un fichier illisible ou disparu : le suivant */
    }
  }
  changed();
  void analyzeAll();
  return { name: dir.name, n };
}

/** Ce qu'une platine a appris en chargeant le morceau (duree, BPM). */
export async function crateLearn(id: string, duration: number, bpm: number | null): Promise<void> {
  try {
    const e = await req<Entry | undefined>('readonly', (s) => s.get(id));
    if (!e || (e.duration > 0 && e.bpm !== null)) return;
    await req('readwrite', (s) => s.put({ ...e, duration, bpm: e.bpm ?? bpm }));
    changed();
  } catch {
    /* base indisponible */
  }
}

/* ---------------- retirer ---------------- */

export async function removeTrack(id: string): Promise<void> {
  await req('readwrite', (s) => s.delete(id));
  inMemory.delete(id);
  changed();
}

/** Retire tous les morceaux d'un dossier (et l'acces relie a ce dossier). */
export async function removeFolder(folder: string): Promise<void> {
  const all = await req<Entry[]>('readonly', (s) => s.getAll());
  for (const e of all) {
    if (e.folder !== folder) continue;
    await req('readwrite', (s) => s.delete(e.id));
    inMemory.delete(e.id);
  }
  if (folder) await req('readwrite', (s) => s.delete(folder), ROOTS).catch(() => undefined);
  changed();
}

/* ---------------- analyse en fond ---------------- */

/** Une platine joue-t-elle ? (l'analyse ne lui vole jamais le processeur) */
let busy: () => boolean = () => false;
export function setCrateBusy(fn: () => boolean): void {
  busy = fn;
}

async function analyze(e: Entry, ask = false): Promise<Entry> {
  const raw = await contentOf(e, ask);
  if (!raw) {
    waiting.add(e.id);
    return e;
  }
  let out: Entry;
  try {
    // A 22 050 Hz : assez pour entendre les coups, deux fois moins lourd
    const snd = await new OfflineAudioContext(1, 1, 22050).decodeAudioData(await raw.arrayBuffer());
    out = { ...e, duration: snd.duration, bpm: e.bpm ?? estimateBpm(snd.getChannelData(0), snd.sampleRate) };
  } catch {
    out = { ...e, unreadable: true };
  }
  await req('readwrite', (s) => s.put(out));
  changed();
  return out;
}

const sleep = (ms: number): Promise<void> => new Promise((r) => window.setTimeout(r, ms));

/**
 * Les analyses en fond, une a la fois, page visible et platines a l'arret :
 * un dossier de 1 800 morceaux se range en quelques secondes, puis ses BPM
 * arrivent au fil des minutes. La caisse se lit une fois par tour.
 */
let running = false;
export async function analyzeAll(): Promise<void> {
  if (running) return;
  running = true;
  try {
    for (;;) {
      const all = await req<Entry[]>('readonly', (s) => s.getAll());
      const todo = all.filter((e) => e.duration === 0 && !e.unreadable && !waiting.has(e.id)).sort((a, b) => b.added - a.added);
      if (todo.length === 0) break;
      for (const e of todo) {
        while (document.hidden || busy()) await sleep(1000);
        const fresh = await req<Entry | undefined>('readonly', (s) => s.get(e.id));
        if (!fresh || fresh.duration > 0 || fresh.unreadable) continue;
        const after = await analyze(fresh);
        if (after !== fresh) await sleep(150);
      }
    }
  } catch {
    /* base indisponible (navigation privee) : rien a analyser */
  } finally {
    running = false;
  }
}

/* ---------------- place ---------------- */

/** Ce que le navigateur accorde encore (octets), null s'il ne le dit pas ; demande aussi que la caisse ne soit pas videe. */
export async function storageLeft(): Promise<number | null> {
  try {
    await navigator.storage?.persist?.();
    const e = await navigator.storage?.estimate?.();
    return e?.quota !== undefined ? e.quota - (e.usage ?? 0) : null;
  } catch {
    return null;
  }
}

/* ---------------- depots et selecteurs ---------------- */

/** Le dossier d'un fichier choisi avec le selecteur de dossiers. */
export const folderOfPath = (f: File): string => (f.webkitRelativePath.split('/')[0] ?? '').trim();

interface HandleItem {
  getAsFileSystemHandle?: () => Promise<FileSystemHandle | null>;
}

/**
 * Ce qu'on lache sur la playlist. Chrome : un dossier lache se RELIE (sa
 * poignee) ; ailleurs, l'arborescence se parcourt et ses sons se rangent
 * sous le nom du dossier lache. Les objets se lisent tout de suite : apres
 * la premiere attente, le depot n'est plus lisible.
 */
export function readDrop(items: DataTransferItemList, folder: string): { dirs: Promise<FileSystemDirectoryHandle[]>; files: Promise<PlacedFile[]> } {
  const list = [...items].filter((i) => i.kind === 'file');
  const handles = canLink() ? list.map((i) => (i as unknown as HandleItem).getAsFileSystemHandle?.() ?? Promise.resolve(null)) : [];
  const entries = list.map((i) => ({ entry: i.webkitGetAsEntry(), file: i.getAsFile() }));
  const dirs = Promise.all(handles).then((hs) => hs.filter((h): h is FileSystemDirectoryHandle => h?.kind === 'directory'));
  const readDir = async (d: FileSystemDirectoryEntry, name: string): Promise<PlacedFile[]> => {
    const reader = d.createReader();
    const all: FileSystemEntry[] = [];
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((ok, ko) => reader.readEntries(ok, ko));
      if (batch.length === 0) break;
      all.push(...batch);
    }
    const lists = await Promise.all(
      all.map(async (e): Promise<PlacedFile[]> => {
        if (e.isDirectory) return readDir(e as FileSystemDirectoryEntry, name);
        const f = await new Promise<File>((ok, ko) => (e as FileSystemFileEntry).file(ok, ko));
        return [{ file: f, folder: name }];
      })
    );
    return lists.flat();
  };
  const files = dirs.then((ds) =>
    Promise.all(
      entries.map(async ({ entry, file }): Promise<PlacedFile[]> => {
        // Un dossier deja relie (Chrome) ne se parcourt pas en plus
        if (entry?.isDirectory) return ds.length > 0 ? [] : readDir(entry as FileSystemDirectoryEntry, entry.name);
        return file ? [{ file, folder }] : [];
      })
    ).then((l) => l.flat().filter((x) => isSound(x.file)))
  );
  return { dirs, files };
}
