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
 *
 * Le dossier Rekordbox (2026-10-18, Mika : "en desktop seulement je
 * voudrais que ce soit possible de rajouter les dossiers de iCloud Drive >
 * Rekordbox ; ne rien copier dans le site, juste faire un mapping
 * automatique sur le dossier de mon systeme") : c'est le mode RELIE, rendu
 * solide pour un dossier iCloud de quelques milliers de fichiers. Les
 * entrees cachees (.DS_Store, .Track.mp3.icloud) sont sautees, comme les
 * analyses USBANLZ de Rekordbox, la descente s'arrete a 12 niveaux, la
 * base s'ecrit par paquets de 100 (une seule transaction chacun : relier
 * 3 000 fichiers ne prend plus des minutes ; relu tel quel, rien ne se
 * reecrit), et un fichier iCloud non telecharge (getFile echoue, ou 0
 * octet avec son .icloud a cote) se compte a part : "NOT DOWNLOADED", a
 * telecharger dans le Finder. Un sous-dossier qui ne se lit pas jusqu'au
 * bout ne fait rien effacer ; une liaison a la fois. Un export XML de la
 * collection Rekordbox trouve dans le dossier (dj/rekordbox.ts) donne les
 * BPM, les tonalites et les playlists "RB ..." ; rien n'est copie, tout
 * est optionnel. En desktop seulement (canLink).
 */

import { decodeAudio } from './decode';
import { analyseGrid } from './grid';
import { camelot } from './math';
import { isRekordboxXml, matchRekordbox, parseRekordbox, type LinkedFile, type RbCollection } from './rekordbox';
import type { DjTrack } from './state';
import { tagsOfFile, titleFromName } from './tags';

const DB = 'mm-dj-crate';
const TRACKS = 'tracks';
const ROOTS = 'roots';
/** Les playlists (2026-10-04, Mika : "faut vraiment faire fonctionner les playlists et les dossiers") */
const LISTS = 'lists';
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
  /**
   * d'ou vient bpm : les tags du fichier ('tag'), ou l'analyse du son
   * ('audio', en fond ou sur une platine). Absent sur les morceaux entres
   * avant le 2026-10-08 : traite comme un tag, jamais remplace.
   */
  bpmFrom?: 'tag' | 'audio';
  key: string | null;
  duration: number;
  /** le chemin du dossier, depuis le dossier relie ou glisse : "Musique/Techno/Peak" ('' : en vrac) */
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
    const r = indexedDB.open(DB, 2);
    r.onupgradeneeded = () => {
      if (!r.result.objectStoreNames.contains(TRACKS)) r.result.createObjectStore(TRACKS, { keyPath: 'id' });
      if (!r.result.objectStoreNames.contains(ROOTS)) r.result.createObjectStore(ROOTS, { keyPath: 'name' });
      if (!r.result.objectStoreNames.contains(LISTS)) r.result.createObjectStore(LISTS, { keyPath: 'id' });
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

/** Une ecriture par entree, c'est une transaction par entree : 3 000 fichiers relies prenaient des minutes. Par paquets de BATCH. */
const BATCH = 100;

/** Plusieurs ecritures (ou effacements, avec del) dans une seule transaction. */
function many(items: readonly unknown[], store: string, del = false): Promise<void> {
  if (items.length === 0) return Promise.resolve();
  return open().then(
    (d) =>
      new Promise<void>((ok, ko) => {
        const tx = d.transaction(store, 'readwrite');
        const fail = (): void => ko(tx.error ?? new Error('IndexedDB'));
        tx.oncomplete = () => ok();
        tx.onerror = fail;
        tx.onabort = fail;
        try {
          const s = tx.objectStore(store);
          for (const it of items) {
            if (del) s.delete(it as IDBValidKey);
            else s.put(it);
          }
        } catch (e) {
          ko(e instanceof Error ? e : new Error('IndexedDB'));
        }
      })
  );
}
const putMany = (items: readonly unknown[], store = TRACKS): Promise<void> => many(items, store);
const deleteMany = (keys: readonly IDBValidKey[], store = TRACKS): Promise<void> => many(keys, store, true);

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
    ...(tags.bpm != null ? { bpmFrom: 'tag' as const } : {}),
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
  showDirectoryPicker?: (o?: { id?: string; mode?: 'read'; startIn?: string }) => Promise<FileSystemDirectoryHandle>;
}
/**
 * Un telephone ne relie pas (2026-10-18, Mika : "en desktop seulement") :
 * Chrome sur Android connait aussi le selecteur de dossiers, mais le
 * telephone garde la copie et le selecteur de fichiers, sans la ligne
 * LINKED FOLDERS.
 */
function phone(): boolean {
  const n = navigator as Navigator & { userAgentData?: { mobile?: boolean } };
  return n.userAgentData?.mobile === true || /Android|iPhone|iPad|iPod|Mobile/i.test(n.userAgent);
}
export const canLink = (): boolean => typeof window !== 'undefined' && typeof (window as unknown as Picker).showDirectoryPicker === 'function' && !phone();

type Children = AsyncIterable<FileSystemHandle>;
/** Au-dela, on ne descend plus : un dossier de Rekordbox ou d'iCloud peut cacher des milliers de fichiers qui ne sont pas de la musique. */
const MAX_DEPTH = 12;
/** Les analyses de Rekordbox (PIONEER/USBANLZ d'une cle exportee) : des milliers de .DAT et .EXT, jamais un son. */
const NOT_MUSIC = /^usbanlz$/i;
/** Un fichier iCloud pas encore telecharge : ".Track.mp3.icloud" a la place de, ou a cote de, "Track.mp3". */
const ICLOUD = /^\.(.+)\.icloud$/i;
/** Un export XML de Rekordbox se cherche dans le dossier relie et ses deux premiers niveaux. */
const XML_DEPTH = 2;
const MAX_XML = 64 * 1024 * 1024;

/** Un dossier relie, tel que la base le garde. */
interface RootRow {
  name: string;
  handle: FileSystemDirectoryHandle;
}

/** Ce qu'un parcours du dossier relie a trouve. */
interface Scan {
  sounds: { h: FileSystemFileHandle; folder: string }[];
  xmls: FileSystemFileHandle[];
  /** "Dossier/Track.mp3" des sons qui ont un .icloud a cote : a 0 octet, ils ne sont pas telecharges */
  placeholders: Set<string>;
  /** les .icloud sans fichier a cote : des sons pas telecharges du tout */
  missing: number;
  /** les sous-dossiers qui n'ont pas pu se lire jusqu'au bout (iCloud, acces) : leurs morceaux deja connus restent */
  failed: string[];
}

/**
 * Les sons d'un dossier relie et de ses sous-dossiers, chacun avec le
 * chemin de son dossier ("Musique/Techno") ; les entrees cachees sont
 * sautees (en notant les .icloud), les .xml des premiers niveaux gardes
 * pour Rekordbox, la descente bornee a MAX_DEPTH. Un sous-dossier illisible
 * est note et saute ; le dossier du haut illisible, la liaison echoue (et
 * rien ne s'efface).
 */
async function scanDir(d: FileSystemDirectoryHandle, path: string, depth: number, out: Scan, found: () => void): Promise<void> {
  if (depth > MAX_DEPTH) return;
  const here = new Set<string>();
  const ghosts: string[] = [];
  try {
    for await (const h of (d as unknown as { values(): Children }).values()) {
      if (h.name.startsWith('.')) {
        const m = ICLOUD.exec(h.name);
        if (m && h.kind === 'file' && SOUND.test(m[1] ?? '')) ghosts.push(m[1] ?? '');
        continue;
      }
      if (h.kind === 'directory') {
        if (!NOT_MUSIC.test(h.name)) await scanDir(h as FileSystemDirectoryHandle, `${path}/${h.name}`, depth + 1, out, found);
      } else if (SOUND.test(h.name)) {
        here.add(h.name);
        out.sounds.push({ h: h as FileSystemFileHandle, folder: path });
        found();
      } else if (depth <= XML_DEPTH && /\.xml$/i.test(h.name)) out.xmls.push(h as FileSystemFileHandle);
    }
  } catch (e) {
    if (depth === 0) throw e;
    out.failed.push(path);
    console.warn('[crate] folder not fully read', path, e);
  }
  for (const g of ghosts) {
    if (here.has(g)) out.placeholders.add(`${path}/${g}`);
    else out.missing += 1;
  }
}

/** Ce qu'une liaison a fait : morceaux relies, fichiers iCloud pas telecharges, morceaux et playlists venus de Rekordbox. */
export interface LinkResult {
  name: string;
  n: number;
  missing: number;
  /** morceaux retrouves dans l'export Rekordbox (BPM, tonalite) */
  rb: number;
  /** playlists "RB ..." creees */
  lists: number;
}

/** Ouvre le selecteur de dossier (dans Musique) et relie ce qu'on choisit ; null si l'on renonce. */
export async function pickAndLink(progress: (done: number, total: number) => void): Promise<LinkResult | null> {
  const pick = (window as unknown as Picker).showDirectoryPicker;
  if (!pick) return null;
  let dir: FileSystemDirectoryHandle;
  try {
    dir = await pick({ id: 'mm-dj-crate', mode: 'read', startIn: 'music' });
  } catch {
    return null;
  }
  return linkFolder(dir, progress);
}

/** La derniere lecture de chaque dossier relie pendant cette visite (la ligne LINKED FOLDERS : UP TO DATE, NOT DOWNLOADED). */
const lastScan = new Map<string, { missing: number }>();

/**
 * Une liaison a la fois (la relecture de la visite, + FOLDER, RECONNECT,
 * REMOVE) : deux parcours du meme dossier en meme temps se marcheraient
 * dessus dans la base.
 */
let linkQueue: Promise<unknown> = Promise.resolve();
function queued<T>(fn: () => Promise<T>): Promise<T> {
  const run = linkQueue.then(fn);
  linkQueue = run.catch(() => undefined);
  return run;
}

/**
 * Relie un dossier deja choisi (selecteur, ou lache sur un ecran) : rien
 * n'est copie. Ses sous-dossiers gardent leur chemin ("Musique/Techno").
 * Relu a chaque visite (rescanRoots) : les morceaux ajoutes sur le disque
 * entrent, ceux qui en sont partis sortent ; une seule fois relie, le
 * dossier reste a jour (Mika : "ca me saoule de refaire le mapping a
 * chaque fois"). L'avancement : progress(trouves, 0) pendant le parcours
 * du dossier, puis (fait, total) tous les dix fichiers.
 */
export function linkFolder(dir: FileSystemDirectoryHandle, progress: (done: number, total: number) => void): Promise<LinkResult> {
  return queued(() => linkNow(dir, progress));
}

async function linkNow(dir: FileSystemDirectoryHandle, progress: (done: number, total: number) => void): Promise<LinkResult> {
  // Le meme dossier qu'a la derniere fois (la relecture de la visite) : un morceau deja a sa place ne se reecrit pas
  let same = false;
  try {
    const before = await req<RootRow | undefined>('readonly', (s) => s.get(dir.name), ROOTS);
    const h = before?.handle as (FileSystemDirectoryHandle & { isSameEntry?: (o: FileSystemHandle) => Promise<boolean> }) | undefined;
    same = typeof h?.isSameEntry === 'function' && (await h.isSameEntry(dir));
  } catch {
    same = false;
  }
  if (!same) {
    try {
      await req('readwrite', (s) => s.put({ name: dir.name, handle: dir }), ROOTS);
    } catch (e) {
      console.warn('[crate] linked folder not kept for next visit', e);
    }
  }
  progress(0, 0);
  const scan: Scan = { sounds: [], xmls: [], placeholders: new Set(), missing: 0, failed: [] };
  let found = 0;
  await scanDir(dir, dir.name, 0, scan, () => {
    found += 1;
    if (found % 50 === 0) progress(found, 0);
  });
  // La caisse lue une fois, et tenue a jour en memoire : pas une lecture par fichier
  const known = new Map<string, Entry>();
  for (const e of await req<Entry[]>('readonly', (s) => s.getAll())) known.set(e.id, e);
  const seen = new Set<string>();
  const linked: LinkedFile[] = [];
  const total = scan.sounds.length;
  let batch: Entry[] = [];
  let n = 0;
  let missing = scan.missing;
  let shown = performance.now();
  const flush = async (): Promise<void> => {
    if (batch.length === 0) return;
    const b = batch;
    batch = [];
    await putMany(b);
    // Les listes se relisent au plus une fois par seconde pendant une grosse liaison
    if (performance.now() - shown > 1000) {
      shown = performance.now();
      changed();
    }
  };
  for (let i = 0; i < total; i += 1) {
    const { h, folder } = scan.sounds[i];
    if (i % 10 === 0 || i === total - 1) progress(i + 1, total);
    let f: File;
    try {
      f = await h.getFile();
    } catch {
      // getFile echoue : un fichier iCloud pas telecharge (ou parti pendant le parcours)
      missing += 1;
      continue;
    }
    // Un fichier iCloud pas telecharge : 0 octet et son .icloud a cote
    if (f.size === 0 && scan.placeholders.has(`${folder}/${h.name}`)) {
      missing += 1;
      continue;
    }
    if (f.size > MAX_BYTES) continue;
    const id = fingerprint(f);
    seen.add(id);
    linked.push({ id, path: `${folder}/${h.name}`, name: h.name, size: f.size });
    n += 1;
    const old = known.get(id);
    let e: Entry;
    if (old && old.handle && old.root === dir.name && old.folder === folder && !old.visit) {
      // Deja connu a la meme place : rien a ecrire si le dossier est le meme ; sinon la poignee (le dossier a pu etre rechoisi ailleurs)
      if (same) continue;
      e = { ...old, handle: h };
    } else e = old ? { ...old, folder, handle: h, root: dir.name, visit: undefined } : await entryOf(f, id, folder, { handle: h, root: dir.name });
    known.set(id, e);
    batch.push(e);
    if (batch.length >= BATCH) await flush();
  }
  await flush();
  // Ce qui etait relie a ce dossier et n'y est plus s'en va (ses cues restent retenues) ; rien sous un dossier mal lu
  const unread = (folder: string): boolean => scan.failed.some((p) => folder === p || folder.startsWith(`${p}/`));
  const gone: string[] = [];
  for (const e of known.values()) {
    if (e.root !== dir.name || !e.handle || seen.has(e.id)) continue;
    if (!unread(e.folder)) gone.push(e.id);
    // Garde sous un dossier mal lu : il reste dans ses playlists Rekordbox (par son chemin, sa taille n'est pas gardee)
    else linked.push({ id: e.id, path: `${e.folder}/${e.name}`, name: e.name, size: -1 });
  }
  for (const id of gone) known.delete(id);
  for (let i = 0; i < gone.length; i += BATCH) await deleteMany(gone.slice(i, i + BATCH));
  const rb = scan.xmls.length > 0 ? await importRekordbox(dir.name, scan.xmls, linked, known) : { tracks: 0, lists: 0 };
  lastScan.set(dir.name, { missing });
  changed();
  void analyzeAll();
  return { name: dir.name, n, missing, rb: rb.tracks, lists: rb.lists };
}

/**
 * L'export XML de la collection Rekordbox trouve dans le dossier relie
 * (dj/rekordbox.ts ; le plus recent s'il y en a plusieurs) : le BPM et la
 * tonalite de chaque morceau retrouve (comme un tag : l'analyse ne les
 * remplace jamais ; la duree aussi quand le BPM est connu, alors l'analyse
 * de fond n'a plus rien a chercher), et ses playlists, "RB ..." (les
 * anciennes de ce dossier s'effacent d'abord ; seulement quand un export
 * se lit : un XML abime ou absent laisse celles d'avant). Tout est
 * optionnel : un XML abime est ignore (console.warn).
 */
async function importRekordbox(root: string, xmls: readonly FileSystemFileHandle[], linked: readonly LinkedFile[], known: Map<string, Entry>): Promise<{ tracks: number; lists: number }> {
  const none = { tracks: 0, lists: 0 };
  const exports: File[] = [];
  for (const h of xmls) {
    try {
      const f = await h.getFile();
      if (f.size > 0 && f.size <= MAX_XML && isRekordboxXml(await f.slice(0, 2048).text())) exports.push(f);
    } catch (e) {
      console.warn('[crate] rekordbox xml not read', h.name, e);
    }
  }
  exports.sort((a, b) => b.lastModified - a.lastModified);
  let col: RbCollection | null = null;
  for (const f of exports) {
    try {
      col = parseRekordbox(await f.text());
    } catch {
      col = null;
    }
    if (col) break;
    console.warn('[crate] rekordbox xml ignored (malformed)', f.name);
  }
  if (!col) return none;
  try {
    const found = matchRekordbox(col, linked, root);
    const byRb = new Map(col.tracks.map((t) => [t.id, t]));
    const updates: Entry[] = [];
    for (const [rbId, id] of found) {
      const t = byRb.get(rbId);
      const e = known.get(id);
      if (!t || !e) continue;
      const bpm = t.bpm !== null && t.bpm > 40 && t.bpm < 260 ? Math.round(t.bpm * 100) / 100 : null;
      const key = t.key ? (camelot(t.key) ?? t.key) : null;
      const next: Entry = {
        ...e,
        ...(bpm !== null ? { bpm, bpmFrom: 'tag' as const } : {}),
        ...(key ? { key } : {}),
        ...((bpm ?? e.bpm) !== null && e.duration === 0 && t.seconds > 0 ? { duration: t.seconds } : {}),
      };
      if (next.bpm !== e.bpm || next.key !== e.key || next.duration !== e.duration || next.bpmFrom !== e.bpmFrom) {
        known.set(id, next);
        updates.push(next);
      }
    }
    for (let i = 0; i < updates.length; i += BATCH) await putMany(updates.slice(i, i + BATCH));
    const lists = col.playlists
      .map((p) => ({
        name: `RB ${p.name}`,
        items: p.trackIds
          .map((k) => found.get(k))
          .filter((id): id is string => id !== undefined)
          .map((id) => known.get(id))
          .filter((e): e is Entry => e !== undefined)
          .map(toTrack),
      }))
      .filter((l) => l.items.length > 0);
    await replaceRbLists(root, lists);
    return { tracks: found.size, lists: lists.length };
  } catch (e) {
    console.warn('[crate] rekordbox collection not applied', e);
    return none;
  }
}

/** Un dossier relie (Chrome, Edge) : son acces (accorde, ou a redemander d'un clic), ses morceaux, sa derniere lecture. */
export interface CrateRoot {
  name: string;
  granted: boolean;
  n: number;
  /** relu pendant cette visite : UP TO DATE */
  fresh: boolean;
  /** fichiers iCloud pas telecharges a cette lecture */
  missing: number;
}

export async function crateRoots(): Promise<CrateRoot[]> {
  try {
    const roots = await req<RootRow[]>('readonly', (s) => s.getAll(), ROOTS);
    if (roots.length === 0) return [];
    const count = new Map<string, number>();
    for (const e of await req<Entry[]>('readonly', (s) => s.getAll())) if (e.root && e.handle) count.set(e.root, (count.get(e.root) ?? 0) + 1);
    return Promise.all(
      roots.map(async (r) => ({
        name: r.name,
        granted: await granted(r.handle, false).catch(() => false),
        n: count.get(r.name) ?? 0,
        fresh: lastScan.has(r.name),
        missing: lastScan.get(r.name)?.missing ?? 0,
      }))
    );
  } catch {
    return [];
  }
}

/**
 * Redonne l'acces a un dossier relie, pendant un clic (le navigateur le
 * demande ; "Autoriser a chaque visite" sur Chrome : plus jamais), puis le
 * relit. null si l'acces est refuse.
 */
export async function reconnectRoot(name: string, progress: (done: number, total: number) => void): Promise<LinkResult | null> {
  const r = await req<RootRow | undefined>('readonly', (s) => s.get(name), ROOTS);
  if (!r || !(await granted(r.handle, true).catch(() => false))) return null;
  waiting.clear();
  return linkFolder(r.handle, progress);
}

/**
 * REMOVE sur un dossier relie (2026-10-18, la ligne LINKED FOLDERS) : la
 * caisse oublie le dossier, ses morceaux relies et ses playlists "RB ...".
 * Leurs cues restent retenues (le dossier relie de nouveau, chaque morceau
 * retrouve les siennes) ; rien ne change sur le disque. Les copies rangees
 * sous un dossier du meme nom restent.
 */
export function forgetRoot(name: string): Promise<void> {
  return queued(async () => {
    const all = await req<Entry[]>('readonly', (s) => s.getAll());
    const gone = all.filter((e) => e.root === name && e.handle).map((e) => e.id);
    for (const id of gone) waiting.delete(id);
    for (let i = 0; i < gone.length; i += BATCH) await deleteMany(gone.slice(i, i + BATCH));
    await req('readwrite', (s) => s.delete(name), ROOTS).catch(() => undefined);
    await replaceRbLists(name, []).catch(() => undefined);
    lastScan.delete(name);
    changed();
  });
}

/**
 * Une fois par visite : relit les dossiers relies dont l'acces est deja
 * accorde (ajouts et departs sur le disque). Un second appel attend la
 * meme relecture ; chacun recoit l'avancement. Un dossier qui ne se relit
 * pas (deplace, iCloud) n'empeche pas les suivants.
 */
let rescan: Promise<void> | null = null;
const rescanWatchers = new Set<(done: number, total: number) => void>();
export function rescanRoots(progress: (done: number, total: number) => void): Promise<void> {
  rescanWatchers.add(progress);
  rescan ??= (async () => {
    let roots: RootRow[] = [];
    try {
      roots = await req<RootRow[]>('readonly', (s) => s.getAll(), ROOTS);
    } catch {
      /* base indisponible : la caisse telle quelle */
    }
    for (const r of roots) {
      try {
        if (await granted(r.handle, false).catch(() => false)) await linkFolder(r.handle, (d, n) => rescanWatchers.forEach((fn) => fn(d, n)));
      } catch (e) {
        console.warn('[crate] linked folder not re-read', r.name, e);
      }
    }
  })();
  return rescan.finally(() => rescanWatchers.delete(progress));
}

/**
 * Ce qu'une platine a appris en chargeant le morceau (duree, BPM). Le BPM
 * des tags n'est jamais remplace (relecture du 2026-10-08 : un 160 lu 80
 * par l'analyse etait garde a 80, puis passe a 80 a l'analyse suivante, et
 * la liste le montrait faux pour toujours) ; il reste le guide de chaque
 * analyse. Seul un BPM trouve par l'analyse elle-meme (un fichier sans tag)
 * se precise : celui de la platine, au millieme, remplace celui du fond.
 */
export async function crateLearn(id: string, duration: number, bpm: number | null): Promise<void> {
  try {
    const e = await req<Entry | undefined>('readonly', (s) => s.get(id));
    if (!e) return;
    const ours = e.bpm === null || e.bpmFrom === 'audio';
    const better = bpm !== null && ours && (e.bpm === null || Math.abs(e.bpm - bpm) > 0.0005);
    if (e.duration > 0 && !better) return;
    await req('readwrite', (s) => s.put({ ...e, duration, ...(better ? { bpm, bpmFrom: 'audio' as const } : {}) }));
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

/**
 * Retire tous les morceaux d'un dossier et de ses sous-dossiers (et, pour un
 * dossier du haut, l'acces relie et ses playlists Rekordbox). Leurs cues
 * restent retenues. Apres la liaison en cours, s'il y en a une.
 */
export function removeFolder(folder: string): Promise<void> {
  return queued(async () => {
    const all = await req<Entry[]>('readonly', (s) => s.getAll());
    const gone: string[] = [];
    for (const e of all) {
      if (e.folder !== folder && !(folder && e.folder.startsWith(`${folder}/`))) continue;
      gone.push(e.id);
      inMemory.delete(e.id);
    }
    for (let i = 0; i < gone.length; i += BATCH) await deleteMany(gone.slice(i, i + BATCH));
    if (folder) {
      await req('readwrite', (s) => s.delete(folder), ROOTS).catch(() => undefined);
      await replaceRbLists(folder, []).catch(() => undefined);
      lastScan.delete(folder);
    }
    changed();
  });
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
    // AIFF et WAV atypiques : notre decodeur prend le relais (un canal suffit au BPM)
    const snd = await decodeAudio(new OfflineAudioContext(1, 1, 22050), await raw.arrayBuffer(), true);
    // Le BPM par l'analyse entiere, dans le worker des platines (2026-10-08, dj/grid.ts) : la liste ne gele plus
    const found = e.bpm === null ? ((await analyseGrid(snd.getChannelData(0), snd.sampleRate, null))?.bpm ?? null) : null;
    out = { ...e, duration: snd.duration, ...(found !== null ? { bpm: Math.round(found * 100) / 100, bpmFrom: 'audio' as const } : {}) };
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

/** Le chemin du dossier d'un fichier choisi avec le selecteur de dossiers ("Musique/Techno"). */
export const folderOfPath = (f: File): string => f.webkitRelativePath.split('/').slice(0, -1).join('/').trim();

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
        if (e.isDirectory) return readDir(e as FileSystemDirectoryEntry, `${name}/${e.name}`);
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

/* ---------------- playlists ---------------- */

/**
 * Les playlists (2026-10-04, Mika : "faut vraiment faire fonctionner les
 * playlists") : gardees dans la meme base, sur cet appareil. Un morceau y
 * entre d'ou qu'il vienne (MAUDITE, SOUNDCLOUD, MY SC, FILES) : on garde
 * ce qu'il faut pour le retrouver et l'afficher (son id, sa source, ses
 * tags), jamais son son.
 */
export interface DjList {
  id: string;
  name: string;
  items: DjTrack[];
  created: number;
  /** venue de l'export Rekordbox de ce dossier relie ("RB ...") : remplacee a chaque relecture du dossier */
  rb?: string;
}

const listListeners = new Set<() => void>();
let listVersion = 0;
const listsChanged = (): void => {
  listVersion += 1;
  listListeners.forEach((fn) => fn());
};

export const listEvents = {
  version: (): number => listVersion,
  subscribe(fn: () => void): () => void {
    listListeners.add(fn);
    return () => {
      listListeners.delete(fn);
    };
  },
};

/** Les playlists, la plus recente d'abord. */
export async function crateLists(): Promise<DjList[]> {
  try {
    const all = await req<DjList[]>('readonly', (s) => s.getAll(), LISTS);
    return all.sort((a, b) => b.created - a.created);
  } catch {
    return [];
  }
}

export async function createList(name: string): Promise<DjList> {
  const l: DjList = { id: `l${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`, name: name.trim() || 'Playlist', items: [], created: Date.now() };
  await req('readwrite', (s) => s.put(l), LISTS);
  listsChanged();
  return l;
}

async function editList(id: string, fn: (l: DjList) => DjList): Promise<void> {
  const l = await req<DjList | undefined>('readonly', (s) => s.get(id), LISTS);
  if (!l) return;
  await req('readwrite', (s) => s.put(fn(l)), LISTS);
  listsChanged();
}

export const renameList = (id: string, name: string): Promise<void> => editList(id, (l) => ({ ...l, name: name.trim() || l.name }));

export async function deleteList(id: string): Promise<void> {
  await req('readwrite', (s) => s.delete(id), LISTS);
  listsChanged();
}

/** Ce qu'une playlist garde d'un morceau : ce qui le retrouve et l'affiche, sans fichier. */
const listItem = (t: DjTrack): DjTrack => ({
  id: t.id,
  source: t.source,
  title: t.title,
  artist: t.artist,
  bpm: t.bpm,
  key: t.key,
  duration: t.duration,
  ...(t.link ? { link: t.link } : {}),
  ...(t.license ? { license: t.license } : {}),
  ...(t.folder ? { folder: t.folder } : {}),
});

/** Un morceau entre dans une playlist (une seule fois). */
export function addToList(id: string, t: DjTrack): Promise<void> {
  const item = listItem(t);
  return editList(id, (l) => (l.items.some((x) => x.id === t.id) ? l : { ...l, items: [...l.items, item] }));
}

/**
 * Les playlists Rekordbox d'un dossier relie (2026-10-18) : celles de la
 * relecture precedente s'effacent, les nouvelles entrent d'un coup (une
 * transaction, pas une par morceau), dans l'ordre de l'export.
 */
async function replaceRbLists(root: string, lists: readonly { name: string; items: DjTrack[] }[]): Promise<void> {
  const all = await req<DjList[]>('readonly', (s) => s.getAll(), LISTS);
  const old = all.filter((l) => l.rb === root).map((l) => l.id);
  if (old.length === 0 && lists.length === 0) return;
  await deleteMany(old, LISTS);
  const now = Date.now();
  const stamp = now.toString(36);
  const fresh: DjList[] = lists.map((l, i) => ({ id: `rb${stamp}${i.toString(36)}`, name: l.name, items: l.items.map(listItem), created: now - i, rb: root }));
  for (let i = 0; i < fresh.length; i += BATCH) await putMany(fresh.slice(i, i + BATCH), LISTS);
  listsChanged();
}

export const removeFromList = (id: string, trackId: string): Promise<void> => editList(id, (l) => ({ ...l, items: l.items.filter((x) => x.id !== trackId) }));

/** Deplace un morceau d'une place (dir -1 : plus haut). */
export const moveInList = (id: string, trackId: string, dir: -1 | 1): Promise<void> =>
  editList(id, (l) => {
    const i = l.items.findIndex((x) => x.id === trackId);
    const j = i + dir;
    if (i < 0 || j < 0 || j >= l.items.length) return l;
    const items = l.items.slice();
    [items[i], items[j]] = [items[j], items[i]];
    return { ...l, items };
  });
