/**
 * Les samples de Mika gardes dans ce navigateur (2026-10-18, Mika : "un
 * selecteur de sample environ 20 samples dans chacun des voices" ; le
 * navigateur de samples a l'ecran, "glisser-deposer WAV") : un fichier
 * depose ou choisi (wav, aif, aiff, mp3, flac, m4a ; 10 Mo au plus) devient
 * un sample de sa famille, apres ceux du site (audio/samples.ts), dans
 * l'ordre ou il est arrive. Rien ne part sur le site ni ailleurs : le
 * fichier reste dans ce navigateur, sur cet appareil.
 * - IndexedDB 'mm-v4-rytm-user', magasin 'samples' : { id, family, file,
 *   label, added, blob } (le fichier). Pas 'mm-v4-rytm-samples' :
 *   audio/samples.ts efface cette ancienne base au demarrage (le panneau
 *   "samples de l'appareil" du 2026-10-05, retire) ;
 * - localStorage 'mm.v4.rytm.user.1' : l'index [{ key, family, file, label,
 *   added }], lu d'un coup au demarrage : les listes sont completes avant
 *   que IndexedDB reponde (le kit retenu retrouve son sample, les crans du
 *   potard sont les bons). IndexedDB repond ensuite et l'index se recale sur
 *   elle (un fichier parti : il sort de la liste ; un index perdu : il se
 *   refait) ;
 * - la cle d'un sample : '<famille>/u:<id>' (audio/kit.ts resolveSample ne
 *   la prend pas pour un numero de fichier : un sample parti reste parti,
 *   un autre ne joue pas a sa place).
 * 60 par famille au plus ; un refus dit pourquoi (UserSampleError : TOO BIG,
 * NOT AUDIO, TOO MANY, STORAGE OFF). Le fichier est decode une fois a l'ajout
 * (OfflineAudioContext, comme samples.ts loadSample) : ce qui ne se decode
 * pas n'entre pas, et le son decode est donne a samples.ts (takePcm) pour ne
 * pas le refaire (celui du fichier qui va jouer ; les autres le lachent,
 * release, 2026-10-22). Le nom a l'ecran : sampleLabel du nom de fichier, comme
 * ceux du site. Pur de tout store du site : audio/samples.ts s'y abonne et
 * fond les deux listes.
 */

import type { KitSample } from './samples';
import { sampleLabel } from './samples';
import type { SamplePcm } from './sampledsp';
import { cleanPcm, decodeAiff, isAiff, probeAudio } from './audiofile';

export const USER_SAMPLES_DB = 'mm-v4-rytm-user';
const STORE = 'samples';
const INDEX_KEY = 'mm.v4.rytm.user.1';
/** Au-dela, ce n'est plus un coup de batterie (scripts/import-rytm-samples.mjs a la meme borne). */
export const USER_SAMPLE_MAX_BYTES = 10 * 1024 * 1024;
/** Par famille : la liste de SOUND reste lisible (le potard ecrit les numeros au-dela de 8). */
export const USER_SAMPLES_PER_FAMILY = 60;
/**
 * Un coup de batterie, pas un morceau (revue du 2026-10-18) : au-dela, refuse. Un mp3 de 10 Mo (dix minutes) se
 * decodait en ~250 Mo de PCM, garde en memoire, copie au worker et rendu entier dans chaque coup.
 */
export const USER_SAMPLE_MAX_SECONDS = 12;
/** Les familles (une copie de audio/kit.ts KIT_FAMILIES : ce module ne lit aucun store du site). */
const FAMILIES: readonly string[] = ['bd', 'sd', 'ch', 'oh', 'cp', 'tom', 'ht', 'cy'];
// .aifc aussi (2026-10-21) : audio/audiofile.ts lit l'AIFC non compresse
const AUDIO_EXT = /\.(wav|aiff?|aifc|mp3|flac|m4a)$/i;
/** La forme d'une cle de sample de Mika : famille, '/u:', un id. */
const KEY_RE = /^([a-z]+)\/u:([a-z0-9]+)$/;
/** La frequence de decodage (la meme que samples.ts : le calcul relit a celle du contexte). */
const DECODE_SR = 48000;

/**
 * Un fichier muet (2026-10-21, audit RS-14) : sa crete sous -60 dBFS. Il entrait et la voix se taisait sans rien
 * dire ; il est refuse (SILENT FILE).
 */
export const USER_SAMPLE_SILENT_PEAK = 0.001;

/** Pourquoi un fichier n'entre pas. */
export type UserSampleReason = 'too-big' | 'too-long' | 'not-audio' | 'too-many' | 'storage' | 'silent';
const REASON_TEXT: Readonly<Record<UserSampleReason, string>> = {
  'too-big': 'TOO BIG: 10 MB MAX',
  'too-long': `TOO LONG: ${USER_SAMPLE_MAX_SECONDS} S MAX`,
  'not-audio': 'NOT AUDIO',
  'too-many': `TOO MANY: ${USER_SAMPLES_PER_FAMILY} MAX`,
  storage: 'STORAGE OFF',
  silent: 'SILENT FILE',
};

/** Un refus : sa raison (reason) et ce que l'ecran dit (text, en capitales). */
export class UserSampleError extends Error {
  readonly reason: UserSampleReason;
  readonly text: string;
  constructor(reason: UserSampleReason) {
    super(REASON_TEXT[reason]);
    this.name = 'UserSampleError';
    this.reason = reason;
    this.text = REASON_TEXT[reason];
  }
}

/** Une ligne de l'index (localStorage) : la cle et ce que l'ecran en montre. */
interface Entry {
  key: string;
  family: string;
  file: string;
  label: string;
  /** Date.now() a l'ajout : l'ordre des crans */
  added: number;
}

/** Une ligne de IndexedDB : l'index et le fichier. */
interface Row extends Entry {
  id: string;
  blob: Blob;
}

const idOf = (key: string): string => key.slice(key.indexOf('/u:') + 3);
const keyOf = (family: string, id: string): string => `${family}/u:${id}`;
const byAdded = (a: Entry, b: Entry): number => a.added - b.added || (a.key < b.key ? -1 : a.key > b.key ? 1 : 0);

function cleanEntry(o: unknown): Entry | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  if (typeof x.key !== 'string' || typeof x.family !== 'string' || typeof x.file !== 'string') return null;
  const m = KEY_RE.exec(x.key);
  if (!m || m[1] !== x.family || !FAMILIES.includes(x.family)) return null;
  return {
    key: x.key,
    family: x.family,
    file: x.file.slice(0, 200),
    label: typeof x.label === 'string' && x.label ? x.label.slice(0, 18) : sampleLabelSafe(x.file),
    added: typeof x.added === 'number' && Number.isFinite(x.added) ? x.added : 0,
  };
}

/** sampleLabel, ou le nom tel quel si le module des samples n'est pas encore la (un cycle d'import au demarrage). */
function sampleLabelSafe(file: string): string {
  try {
    return sampleLabel(file);
  } catch {
    return file.replace(/\.[a-z0-9]+$/i, '').toUpperCase().slice(0, 18);
  }
}

function readIndex(): Entry[] {
  if (typeof window === 'undefined') return [];
  try {
    const raw = JSON.parse(window.localStorage.getItem(INDEX_KEY) ?? 'null') as unknown;
    if (!Array.isArray(raw)) return [];
    const out: Entry[] = [];
    const seen = new Set<string>();
    for (const o of raw) {
      const e = cleanEntry(o);
      if (!e || seen.has(e.key)) continue;
      seen.add(e.key);
      out.push(e);
    }
    return out.sort(byAdded);
  } catch {
    return [];
  }
}

function writeIndex(): void {
  if (typeof window === 'undefined') return;
  try {
    window.localStorage.setItem(INDEX_KEY, JSON.stringify(list));
  } catch {
    /* stockage plein ou refuse : la liste vit pour la visite, IndexedDB la refait au prochain demarrage */
  }
}

let list: Entry[] = readIndex();
/** Les fichiers de cette visite (ajoutes ou relus de IndexedDB) : pas deux lectures. */
const blobs = new Map<string, Blob>();
/** Le son decode a l'ajout, a prendre une fois (samples.ts loadSample). */
const decoded = new Map<string, SamplePcm>();
const listeners = new Set<() => void>();
let opening: Promise<IDBDatabase | null> | null = null;

/* ---------------- IndexedDB ---------------- */

const req = <T>(r: IDBRequest<T>): Promise<T> =>
  new Promise((resolve, reject) => {
    r.onsuccess = () => resolve(r.result);
    r.onerror = () => reject(r.error ?? new Error('indexeddb'));
  });

/** La base, ouverte une fois ; null si le navigateur la refuse (navigation privee, stockage bloque). */
function open(): Promise<IDBDatabase | null> {
  if (opening) return opening;
  opening = new Promise((resolve) => {
    try {
      if (typeof window === 'undefined' || !window.indexedDB) {
        resolve(null);
        return;
      }
      const r = window.indexedDB.open(USER_SAMPLES_DB, 1);
      r.onupgradeneeded = () => {
        const d = r.result;
        if (!d.objectStoreNames.contains(STORE)) d.createObjectStore(STORE, { keyPath: 'id' });
      };
      r.onsuccess = () => {
        const d = r.result;
        // La base fermee de force (le navigateur fait de la place) : la prochaine demande la rouvre
        d.onclose = () => {
          opening = null;
        };
        d.onversionchange = () => {
          d.close();
          opening = null;
        };
        resolve(d);
      };
      r.onerror = () => resolve(null);
      r.onblocked = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
  return opening;
}

async function getAll(d: IDBDatabase): Promise<Row[]> {
  const rows = await req(d.transaction(STORE, 'readonly').objectStore(STORE).getAll());
  return (rows as unknown[]).filter((r): r is Row => !!r && typeof r === 'object' && typeof (r as Row).id === 'string' && (r as Row).blob instanceof Blob);
}

function putRow(d: IDBDatabase, row: Row): Promise<void> {
  return new Promise((resolve, reject) => {
    const tx = d.transaction(STORE, 'readwrite');
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error ?? new Error('indexeddb'));
    tx.onabort = () => reject(tx.error ?? new Error('indexeddb'));
    tx.objectStore(STORE).put(row);
  });
}

function deleteRow(d: IDBDatabase, id: string): Promise<void> {
  return new Promise((resolve) => {
    try {
      const tx = d.transaction(STORE, 'readwrite');
      tx.oncomplete = () => resolve();
      tx.onerror = () => resolve();
      tx.onabort = () => resolve();
      tx.objectStore(STORE).delete(id);
    } catch {
      resolve();
    }
  });
}

async function getRow(d: IDBDatabase, id: string): Promise<Row | undefined> {
  const r = (await req(d.transaction(STORE, 'readonly').objectStore(STORE).get(id))) as unknown;
  return r && typeof r === 'object' && (r as Row).blob instanceof Blob ? (r as Row) : undefined;
}

/* ---------------- la liste ---------------- */

const toSample = (e: Entry): KitSample => ({ key: e.key, family: e.family as KitSample['family'], file: e.file, label: e.label, url: '', user: true });

function emit(): void {
  listeners.forEach((fn) => fn());
}

/**
 * IndexedDB a repondu : l'index se recale sur elle. Une ligne de la base
 * sans index entre dans la liste (un index perdu) ; une ligne de l'index sans
 * fichier en sort (un fichier parti). Les fichiers lus restent en memoire.
 */
/** Les cles retirees pendant cette visite : reconcile ne les remet pas, la suppression ratee est retentee. */
const removed = new Set<string>();
/** Les ajouts en cours par famille (un glisser-deposer de plusieurs fichiers) : comptes contre la limite. */
const adding = new Map<string, number>();
/** Le dernier instant d'ajout donne : chaque ajout un cran plus tard, l'ordre du depot reste celui des crans. */
let lastAdded = 0;

async function reconcile(): Promise<void> {
  const d = await open();
  if (!d) return;
  let rows: Row[];
  try {
    rows = await getAll(d);
  } catch {
    return;
  }
  const have = new Map<string, Row>();
  // Une ligne lue avant son retrait (remove pendant la lecture) ne revient pas (revue du 2026-10-18)
  for (const r of rows) if (FAMILIES.includes(r.family) && typeof r.family === 'string' && !removed.has(keyOf(r.family, r.id))) have.set(keyOf(r.family, r.id), r);
  let changed = false;
  const next = list.filter((e) => {
    if (have.has(e.key)) return true;
    changed = true;
    return false;
  });
  for (const [key, r] of have) {
    blobs.set(key, r.blob);
    if (next.some((e) => e.key === key)) continue;
    const e = cleanEntry({ key, family: r.family, file: r.file, label: r.label, added: r.added });
    if (!e) continue;
    next.push(e);
    changed = true;
  }
  if (!changed) return;
  list = next.sort(byAdded);
  writeIndex();
  emit();
}

const settled: Promise<void> = typeof window === 'undefined' ? Promise.resolve() : reconcile().catch(() => undefined);

/**
 * Un fichier audio decode (samples.ts loadSample, l'ajout d'un fichier ici) ; rejette ce qui n'est pas de l'audio
 * lisible. Le decodage sur (2026-10-21, audit RS-4, RS-6, RS-7) :
 * - un AIFF ou un AIFC non compresse est lu ici, a sa frequence (audio/audiofile.ts : Chrome et Firefox ne savent
 *   pas le decoder) ; le reste par le navigateur, a 48 kHz (le calcul relit a celle du contexte) ;
 * - maxSeconds : la duree testee des que le navigateur a decode, avant toute copie (UserSampleError too-long) ;
 * - plus aucune copie : les canaux du decodage sont gardes tels quels (Float32Array.from passait par l'iterateur,
 *   des secondes et des centaines de Mo sur un long fichier) ;
 * - les valeurs non finies (un WAV flottant abime) a 0, le reste borne a +/-4 : peak, la crete qui reste.
 */
export async function decodeAudio(data: ArrayBuffer, maxSeconds = Infinity): Promise<SamplePcm & { peak: number }> {
  let pcm: SamplePcm | null = isAiff(data) ? decodeAiff(data) : null;
  if (pcm && pcm.L.length / pcm.sr > maxSeconds + 0.05) throw new UserSampleError('too-long');
  if (!pcm) {
    const ctx = new OfflineAudioContext(1, 1, DECODE_SR);
    const buf = await ctx.decodeAudioData(data);
    if (buf.duration > maxSeconds + 0.05) throw new UserSampleError('too-long');
    pcm = { L: buf.getChannelData(0), R: buf.numberOfChannels > 1 ? buf.getChannelData(1) : null, sr: buf.sampleRate };
  }
  const peak = cleanPcm(pcm);
  return { ...pcm, peak };
}

/**
 * La duree d'un fichier dont l'en-tete ne dit rien (un format que audio/audiofile.ts ne lit pas) : un element audio
 * qui ne lit que ses metadonnees (preload metadata, jamais play(), muet), 2,5 s au plus ; null si le navigateur ne la
 * donne pas (le decodage tranchera, apres coup).
 */
function mediaSeconds(file: Blob): Promise<number | null> {
  if (typeof document === 'undefined' || typeof URL === 'undefined' || !URL.createObjectURL) return Promise.resolve(null);
  return new Promise((resolve) => {
    let url = '';
    let el: HTMLAudioElement | null = null;
    const done = (v: number | null): void => {
      window.clearTimeout(timer);
      if (el) {
        el.onloadedmetadata = null;
        el.onerror = null;
        el.removeAttribute('src');
        el = null;
      }
      if (url) URL.revokeObjectURL(url);
      url = '';
      resolve(v);
    };
    const timer = window.setTimeout(() => done(null), 2500);
    try {
      url = URL.createObjectURL(file);
      el = document.createElement('audio');
      el.muted = true;
      el.setAttribute('muted', '');
      el.preload = 'metadata';
      el.onloadedmetadata = () => done(el && Number.isFinite(el.duration) ? el.duration : null);
      el.onerror = () => done(null);
      el.src = url;
    } catch {
      done(null);
    }
  });
}

/** Un fichier qui a l'air d'etre de l'audio : son extension, ou son type MIME. */
export const looksAudio = (file: { name: string; type?: string }): boolean => AUDIO_EXT.test(file.name) || /^audio\//i.test(file.type ?? '');

/** L'ajout lui-meme (userSamples.add a deja verifie la place, la taille et le type, et retenu sa place). */
async function addNow(family: string, file: File, added: number): Promise<KitSample> {
  const data = await file.arrayBuffer();
  // La duree AVANT le decodage (2026-10-21, audit RS-4) : lue dans l'en-tete ; une estimation (un mp3 que l'on n'a pas
  // pu compter jusqu'au bout) laisse de la marge, le decodage verifie ensuite au plus juste
  const probe = probeAudio(data);
  let secs = probe.seconds;
  // Une duree que l'en-tete ne dit pas, assez gros pour couter cher a decoder : le navigateur lit sa duree (un petit
  // fichier se decode vite, le test d'apres suffit). Quel que soit le format (2026-10-22, revue RA1-6 : un WAV sans
  // debit ni frequence lisible passait sans rien, seul un format inconnu y avait droit)
  if (secs === null && file.size > 1024 * 1024) secs = await mediaSeconds(file);
  if (secs !== null && secs > USER_SAMPLE_MAX_SECONDS * (probe.exact ? 1 : 3) + 0.05) throw new UserSampleError('too-long');
  let pcm: SamplePcm & { peak: number };
  try {
    // decodeAudioData prend le tampon (il le vide) : une copie part au decodage, le fichier reste entier
    pcm = await decodeAudio(data.slice(0), USER_SAMPLE_MAX_SECONDS);
  } catch (e) {
    throw e instanceof UserSampleError ? e : new UserSampleError('not-audio');
  }
  if (pcm.L.length === 0) throw new UserSampleError('not-audio');
  if (pcm.L.length / pcm.sr > USER_SAMPLE_MAX_SECONDS + 0.05) throw new UserSampleError('too-long');
  if (pcm.peak < USER_SAMPLE_SILENT_PEAK) throw new UserSampleError('silent');
  const id = `${added.toString(36)}${Math.floor(Math.random() * 1e6).toString(36)}`;
  const key = keyOf(family, id);
  const blob = new Blob([data], { type: file.type || 'application/octet-stream' });
  const entry: Entry = { key, family, file: file.name.slice(0, 200), label: sampleLabel(file.name), added };
  const d = await open();
  if (!d) throw new UserSampleError('storage');
  try {
    await putRow(d, { id, ...entry, blob });
  } catch {
    throw new UserSampleError('storage');
  }
  blobs.set(key, blob);
  decoded.set(key, { L: pcm.L, R: pcm.R, sr: pcm.sr });
  list = [...list.filter((e) => e.key !== key), entry].sort(byAdded);
  writeIndex();
  emit();
  return toSample(entry);
}

export const userSamples = {
  /** Les samples de Mika d'une famille, dans l'ordre d'arrivee (les crans apres ceux du site). */
  list(family: string): readonly KitSample[] {
    return list.filter((e) => e.family === family).map(toSample);
  },
  /** Tous, dans l'ordre d'arrivee. */
  all(): readonly KitSample[] {
    return list.map(toSample);
  },
  /** Combien dans une famille (60 au plus). */
  count(family: string): number {
    return list.filter((e) => e.family === family).length;
  },
  /** Une cle de sample de Mika (connue ou non) ? */
  isKey(key: string): boolean {
    return KEY_RE.test(key);
  },
  /**
   * Un fichier depose ou choisi entre dans une famille : verifie (taille,
   * audio decodable, place), garde dans IndexedDB, dans l'index, puis annonce.
   * Rejette avec UserSampleError (sa raison en clair pour l'ecran).
   */
  async add(family: string, file: File): Promise<KitSample> {
    if (!FAMILIES.includes(family)) throw new Error(`unknown family ${family}`);
    if (userSamples.count(family) + (adding.get(family) ?? 0) >= USER_SAMPLES_PER_FAMILY) throw new UserSampleError('too-many');
    if (file.size > USER_SAMPLE_MAX_BYTES) throw new UserSampleError('too-big');
    if (!looksAudio(file)) throw new UserSampleError('not-audio');
    // La place est retenue des maintenant : plusieurs fichiers deposes d'un coup ne depassent pas la limite
    adding.set(family, (adding.get(family) ?? 0) + 1);
    const added = (lastAdded = Math.max(Date.now(), lastAdded + 1));
    try {
      return await addNow(family, file, added);
    } finally {
      adding.set(family, Math.max(0, (adding.get(family) ?? 1) - 1));
    }
  },
  /** Retire un sample de Mika (la liste tout de suite, IndexedDB ensuite) ; false s'il n'y etait pas. */
  async remove(key: string): Promise<boolean> {
    if (!list.some((e) => e.key === key)) return false;
    removed.add(key);
    list = list.filter((e) => e.key !== key);
    blobs.delete(key);
    decoded.delete(key);
    writeIndex();
    emit();
    const d = await open();
    if (d) await deleteRow(d, idOf(key));
    return true;
  },
  /** Le fichier d'un sample (de la memoire, sinon de IndexedDB) ; null s'il est parti. */
  async bytes(key: string): Promise<ArrayBuffer | null> {
    if (!list.some((e) => e.key === key)) return null;
    let b = blobs.get(key);
    if (!b) {
      const d = await open();
      if (!d) return null;
      try {
        const row = await getRow(d, idOf(key));
        if (row) {
          b = row.blob;
          blobs.set(key, b);
        }
      } catch {
        return null;
      }
    }
    return b ? b.arrayBuffer() : null;
  },
  /** Le son decode a l'ajout, une fois (samples.ts le garde ensuite) ; undefined apres, ou pour un sample relu. */
  takePcm(key: string): SamplePcm | undefined {
    const p = decoded.get(key);
    if (p) decoded.delete(key);
    return p;
  },
  /**
   * Le son decode a l'ajout lache sans etre pris (2026-10-22, revue RA1-4) : un fichier ajoute mais pas choisi gardait
   * son PCM pour la visite, hors du budget de samples.ts (25 Mo pour 7 fichiers de 10 s). Il se decode depuis son
   * fichier, deja en memoire, a son premier choix.
   */
  release(key: string): void {
    decoded.delete(key);
  },
  /** La liste a change (un ajout, un retrait, IndexedDB qui recale l'index). */
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** IndexedDB a repondu et l'index est recale (tests). */
  ready(): Promise<void> {
    return settled;
  },
};
