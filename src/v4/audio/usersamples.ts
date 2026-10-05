/**
 * Tes samples dans le MM-RYTM (2026-10-05, Mika : "je ne peux toujours pas
 * selectionner les samples que je t'ai donnes, les kicks ; ou explique-moi
 * comment aller les chercher"). Les fichiers audio choisis sur l'appareil
 * (le panneau SAMPLES, machine ouverte, ou un fichier depose sur un pad)
 * restent dans ce navigateur : leur liste dans localStorage (lue tout de
 * suite au chargement : le choix de son connait ses crans des le depart),
 * leurs octets dans IndexedDB (lus a la demande, comme un telechargement).
 * Rien n'est envoye. IndexedDB refuse (navigation privee) : les fichiers
 * vivent le temps de la visite. Chaque famille de voix (bd, sd, hh, cp,
 * tom, rs) a les siens ; audio/samples.ts les met apres ceux du site.
 */

export type UserFamily = 'bd' | 'sd' | 'hh' | 'cp' | 'tom' | 'rs';

export interface UserSampleEntry {
  id: string;
  family: UserFamily;
  /** le nom du fichier (son nom court en vient) */
  file: string;
}

const INDEX_KEY = 'mm.v4.usersamples.1';
const DB_NAME = 'mm-v4-rytm-samples';
const STORE = 'files';
/** Un fichier plus gros n'est pas un coup de batterie (20 Mo). */
const MAX_BYTES = 20 * 1024 * 1024;
/** Au plus, par famille. */
const MAX_PER_FAMILY = 32;
const FAMILIES: readonly UserFamily[] = ['bd', 'sd', 'hh', 'cp', 'tom', 'rs'];
export const AUDIO_FILE = /\.(wav|aiff?|mp3|m4a|flac|ogg|caf)$/i;

function readIndex(): UserSampleEntry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = window.localStorage.getItem(INDEX_KEY);
    const list = raw ? (JSON.parse(raw) as unknown) : [];
    if (!Array.isArray(list)) return [];
    return list.filter(
      (e): e is UserSampleEntry =>
        !!e && typeof e === 'object' && typeof (e as UserSampleEntry).id === 'string' && typeof (e as UserSampleEntry).file === 'string' && FAMILIES.includes((e as UserSampleEntry).family)
    );
  } catch {
    return [];
  }
}

let entries: UserSampleEntry[] = readIndex();
/** Les octets gardes en memoire quand IndexedDB manque (la visite seulement). */
const mem = new Map<string, ArrayBuffer>();
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

function writeIndex(): void {
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(entries.filter((e) => !mem.has(e.id))));
  } catch {
    /* stockage plein ou refuse : la liste vit pour la visite */
  }
}

/* ---------------- IndexedDB ---------------- */

let dbP: Promise<IDBDatabase | null> | null = null;
function db(): Promise<IDBDatabase | null> {
  if (dbP) return dbP;
  dbP = new Promise((resolve) => {
    try {
      if (typeof indexedDB === 'undefined') {
        resolve(null);
        return;
      }
      const req = indexedDB.open(DB_NAME, 1);
      req.onupgradeneeded = () => {
        if (!req.result.objectStoreNames.contains(STORE)) req.result.createObjectStore(STORE);
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
      req.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return dbP;
}

function tx<T>(mode: IDBTransactionMode, fn: (s: IDBObjectStore) => IDBRequest<T>): Promise<T | null> {
  return db().then(
    (d) =>
      new Promise<T | null>((resolve) => {
        if (!d) {
          resolve(null);
          return;
        }
        try {
          const req = fn(d.transaction(STORE, mode).objectStore(STORE));
          req.onsuccess = () => resolve(req.result ?? null);
          req.onerror = () => resolve(null);
        } catch {
          resolve(null);
        }
      })
  );
}

/* ---------------- ce qu'on en fait ---------------- */

const newId = (): string => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;

/** Le fichier est-il un son que le navigateur sait lire ? */
async function decodes(buf: ArrayBuffer): Promise<boolean> {
  try {
    const ctx = new OfflineAudioContext(1, 1, 48000);
    const b = await ctx.decodeAudioData(buf.slice(0));
    return b.length > 0;
  } catch {
    return false;
  }
}

export interface AddResult {
  added: UserSampleEntry[];
  /** les fichiers laisses de cote (pas un son lisible, trop gros, trop nombreux) */
  skipped: string[];
}

export const userSamples = {
  list: (): readonly UserSampleEntry[] => entries,
  of: (f: string): UserSampleEntry[] => entries.filter((e) => e.family === f),
  byId: (id: string): UserSampleEntry | undefined => entries.find((e) => e.id === id),

  /** Ajoute des fichiers a une famille, dans l'ordre de leur nom. */
  async add(family: UserFamily, files: readonly File[]): Promise<AddResult> {
    const out: AddResult = { added: [], skipped: [] };
    const sorted = [...files].sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: 'base' }));
    for (const file of sorted) {
      const audio = file.type.startsWith('audio/') || AUDIO_FILE.test(file.name);
      if (!audio || file.size > MAX_BYTES || userSamples.of(family).length + out.added.length >= MAX_PER_FAMILY) {
        out.skipped.push(file.name);
        continue;
      }
      let buf: ArrayBuffer;
      try {
        buf = await file.arrayBuffer();
      } catch {
        out.skipped.push(file.name);
        continue;
      }
      if (!(await decodes(buf))) {
        out.skipped.push(file.name);
        continue;
      }
      const e: UserSampleEntry = { id: newId(), family, file: file.name };
      const ok = await tx('readwrite', (s) => s.put(buf, e.id));
      if (ok === null) mem.set(e.id, buf);
      out.added.push(e);
    }
    if (out.added.length > 0) {
      entries = [...entries, ...out.added];
      writeIndex();
      emit();
    }
    return out;
  },

  /** Retire un sample (sa voix revient a son son calcule si elle le jouait : audio/kit.ts). */
  async remove(id: string): Promise<void> {
    if (!entries.some((e) => e.id === id)) return;
    entries = entries.filter((e) => e.id !== id);
    mem.delete(id);
    writeIndex();
    emit();
    await tx('readwrite', (s) => s.delete(id));
  },

  /** Les octets d'un sample (une copie : le decodage les consomme). */
  async data(id: string): Promise<ArrayBuffer | null> {
    const m = mem.get(id);
    if (m) return m.slice(0);
    const v = await tx<ArrayBuffer>('readonly', (s) => s.get(id) as IDBRequest<ArrayBuffer>);
    return v instanceof ArrayBuffer ? v : null;
  },

  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
