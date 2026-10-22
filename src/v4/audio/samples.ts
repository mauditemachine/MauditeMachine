/**
 * Les echantillons de Mika dans le choix de son du MM-RYTM (2026-10-05,
 * Mika : "je voudrais que tu mettes ces samples dans le selecteur de
 * samples, pour BD et SD"). Un fichier audio pose dans
 * public/samples/rytm/<famille>/ devient un cran de plus du choix de son de
 * sa famille, apres 909, 808 et MM, dans l'ordre des noms de fichier (01,
 * 02... d'abord). La liste vient du build (vite.config.ts,
 * virtual:rytm-samples) ; le fichier reste a part (rien dans le code) et
 * n'est telecharge qu'une fois choisi. Son nom a l'ecran : celui du fichier
 * sans son numero, sans "AT" ni le nom de la famille (01 AT BluePrint -
 * Kick F.wav : BLUEPRINT F ; Psy_Snares02.wav : PSY 02). Ce qu'on publie se
 * telecharge : un echantillon sous licence d'un pack doit permettre d'etre
 * diffuse ainsi.
 * Les noms (2026-10-05, Mika : "je les veux dans le knob avec les noms,
 * genre Engelhardt, Carassi, Stein ; enleve la fenetre Samples on this
 * device") : la plaque ecrit le nom de chaque echantillon a son cran.
 * Une famille par voix depuis le 2026-10-18 (Mika : "un selecteur de sample
 * environ 20 samples dans chacun des voices") : bd, sd, ch, oh, cp, tom, ht,
 * cy, les huit dossiers (hh, tom pour deux voix et rs n'existent plus :
 * audio/kit.ts traduit ce qui etait retenu).
 * Les samples de Mika gardes dans ce navigateur (2026-10-18,
 * audio/usersamples.ts : un fichier depose ou choisi, jamais publie) suivent
 * ceux du site dans la liste de leur famille, dans l'ordre ou ils sont
 * arrives ; leur cle '<famille>/u:<id>'. samplesOf, sampleByKey et
 * loadSample les connaissent comme les autres (le fichier vient de
 * IndexedDB) ; samplesChanged dit quand la liste bouge (les listes gardees
 * d'actions.ts se refont, le kit lache un sample retire).
 */

import FOUND from 'virtual:rytm-samples';
import type { SamplePcm } from './sampledsp';
import { sampleLabel } from './samplelabel';
import { decodeAudio, userSamples } from './usersamples';

/** Le nom court d'un fichier (audio/samplelabel.ts, partage avec l'admin) : sans extension, numero, "AT", ni le nom de la famille. */
export { sampleLabel };

/** Les familles de voix qui peuvent jouer un echantillon (celles de audio/kit.ts, une par voix), les dossiers du site. */
const FAMILY_DIRS = ['bd', 'sd', 'ch', 'oh', 'cp', 'tom', 'ht', 'cy'] as const;
export type SampleFamily = (typeof FAMILY_DIRS)[number];
export const SAMPLE_FAMILIES: readonly SampleFamily[] = FAMILY_DIRS;
export const isSampleFamily = (f: unknown): f is SampleFamily => typeof f === 'string' && (FAMILY_DIRS as readonly string[]).includes(f);

export interface KitSample {
  /** la cle retenue (kit, presets) : famille/fichier ; famille/u:id pour un sample de Mika garde dans ce navigateur */
  key: string;
  family: SampleFamily;
  file: string;
  /** le nom court, en capitales (l'ecran, les jumeaux) */
  label: string;
  /** l'adresse du fichier du site ('' pour un sample de ce navigateur : il vient de IndexedDB) */
  url: string;
  /** un sample de Mika garde dans ce navigateur (audio/usersamples.ts), pas un fichier du site */
  user?: boolean;
}

/** Une cle de sample de Mika garde dans ce navigateur ('<famille>/u:<id>'), connue ou non. */
export const isUserKey = (key: string): boolean => /^[a-z]+\/u:/.test(key);

/** Les echantillons du site (le dossier public/samples/rytm), dans l'ordre des crans. */
export const SAMPLES: readonly KitSample[] = FOUND.filter((x) => (FAMILY_DIRS as readonly string[]).includes(x.family))
  .map(
    (x): KitSample => ({
      key: `${x.family}/${x.file}`,
      family: x.family as SampleFamily,
      file: x.file,
      label: sampleLabel(x.file),
      url: `${import.meta.env.BASE_URL}samples/rytm/${x.family}/${encodeURIComponent(x.file)}`,
    })
  )
  .sort((a, b) => a.file.localeCompare(b.file, undefined, { numeric: true, sensitivity: 'base' }));

/* ---------------- les listes (le site, puis ce navigateur) ---------------- */

const byFamily = new Map<string, KitSample[]>();
const byKey = new Map<string, KitSample>();
/** Monte a chaque changement de liste : les listes gardees ailleurs (actions.ts) le mettent dans leur signature. */
let version = 0;
let indexed = false;
const changeListeners = new Set<() => void>();

function index(): void {
  byFamily.clear();
  byKey.clear();
  const put = (s: KitSample): void => {
    const list = byFamily.get(s.family) ?? [];
    list.push(s);
    byFamily.set(s.family, list);
    byKey.set(s.key, s);
  };
  for (const s of SAMPLES) put(s);
  // Les samples de Mika de ce navigateur apres ceux du site, dans l'ordre d'arrivee (audio/usersamples.ts)
  for (const f of FAMILY_DIRS) for (const s of userSamples.list(f)) put(s);
}

/**
 * Les listes se font a la premiere demande, pas au chargement du module :
 * audio/usersamples.ts importe sampleLabel d'ici (un cycle), et selon qui
 * est charge le premier son store n'est pas encore la pendant ce chargement.
 * A la premiere demande (audio/kit.ts, son kit de depart), tout est charge.
 */
function ensure(): void {
  if (indexed) return;
  indexed = true;
  index();
  userSamples.subscribe(() => {
    index();
    version += 1;
    // Un sample retire de ce navigateur : son PCM et son etat partent avec lui (2026-10-21, audit RS-5 : il restait en
    // memoire pour la visite, et le worker en gardait une copie)
    for (const key of [...slots.keys(), ...pcm.keys()]) if (!byKey.has(key)) forget(key);
    changeListeners.forEach((fn) => fn());
  });
}

/** Les echantillons d'une famille, dans l'ordre des crans (ceux du site, puis ceux de ce navigateur). */
export const samplesOf = (f: string): readonly KitSample[] => {
  ensure();
  return byFamily.get(f) ?? [];
};
export const sampleByKey = (key: string): KitSample | undefined => {
  ensure();
  return byKey.get(key);
};
/** Le numero de la liste du moment : change a chaque ajout ou retrait d'un sample de ce navigateur. */
export const samplesVersion = (): number => {
  ensure();
  return version;
};
/** La liste des samples a change (un sample de Mika ajoute ou retire) : les listes qui en dependent se refont. */
export const samplesChanged = {
  subscribe(fn: () => void): () => void {
    ensure();
    changeListeners.add(fn);
    return () => {
      changeListeners.delete(fn);
    };
  },
};

/* ---------------- chargement ---------------- */

/*
 * Un etat par echantillon (2026-10-21, audit RS-1, RS-4 du rodage et RS-8, Mika : "controle les selections de samples
 * dans RYTM ! je ne veux plus que ca plante"). Avant, un telechargement rate (404, reseau coupe, delai) mettait la cle
 * dans un ensemble d'echecs pour toute la visite : la voix se taisait ou jouait un autre son, l'ecran affichait le nom
 * du sample sans rien dire, et rien ne reessayait meme le reseau revenu. Maintenant :
 * - idle (rien de demande), loading, ready (decode), failed et pourquoi : offline (reseau coupe, delai de
 *   FETCH_TIMEOUT_MS depasse, serveur en panne), missing (le fichier n'est plus sur le site : 404), bad (illisible),
 *   storage (la base de ce navigateur fermee un instant), gone (retire de ce navigateur) ;
 * - un seul chargement par cle, un AbortController qui coupe au bout de FETCH_TIMEOUT_MS ;
 * - offline et storage se retentent seuls (RETRY_MS : 1 s, 4 s, 15 s, puis toutes les 10 s tant que le kit joue ce
 *   sample : un reseau qui revient sans le dire), et des que le reseau revient (window 'online', missing aussi ; un
 *   telechargement parti avant, encore en attente, repart lui aussi) ;
 *   missing une seule fois de plus (un deploiement qui renomme les fichiers pendant que la page est ouverte) ; bad et
 *   gone jamais ;
 * - un choix explicite (requestSample : le navigateur des sons, le potard SOUND, un preset) retente tout de suite ce
 *   qui a echoue pour une raison passagere ;
 * - onSampleLoaded, onSampleFailed, onSampleStatus (tout changement d'etat : l'ecran) ; onSampleDropped quand un PCM
 *   est libere (un sample retire de ce navigateur, ou le budget de memoire) ;
 * - un jeton par chargement : un resultat d'un chargement depasse (le sample retire entre-temps) ne compte pas ;
 * - les PCM decodes tiennent dans un budget d'octets (PCM_BUDGET, le moins recemment servi part d'abord, jamais un
 *   sample que le kit joue : keepSample) ; un PCM parti se recharge a la demande.
 */

/** L'etat d'un echantillon. */
export type SampleState = 'idle' | 'loading' | 'ready' | 'failed';
/** Pourquoi il manque. */
export type SampleFail = 'offline' | 'missing' | 'bad' | 'storage' | 'gone';
export interface SampleStatus {
  state: SampleState;
  why?: SampleFail;
}

/** Au-dela, un telechargement est coupe et compte comme le reseau coupe (il se retente). */
export const FETCH_TIMEOUT_MS = 8000;
/** Les attentes avant chaque nouvel essai d'un echec passager ; ensuite, toutes les RETRY_KEPT_MS tant que le kit le joue. */
export const RETRY_MS: readonly number[] = [1000, 4000, 15000];
const RETRY_KEPT_MS = 10000;
/** Un choix explicite ne retente pas plus d'une fois par EXPLICIT_GAP_MS (un potard qui balaie la liste). */
const EXPLICIT_GAP_MS = 1500;
/** Un fichier manquant (404) ne se retente sur un choix explicite qu'apres MISSING_GAP_MS. */
const MISSING_GAP_MS = 3000;
const COARSE = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
/** Le budget des PCM decodes (octets) : un sample de 12 s en stereo fait 4,6 Mo a 48 kHz. */
export const PCM_BUDGET = (COARSE ? 48 : 160) * 1024 * 1024;

interface Slot {
  state: SampleState;
  why?: SampleFail;
  /** les essais rates d'affilee (l'attente du prochain) */
  tries: number;
  /** performance.now() du dernier essai */
  at: number;
  /** le jeton du chargement en cours */
  gen: number;
  timer: number;
  abort: AbortController | null;
  promise: Promise<SamplePcm | null> | null;
}

const pcm = new Map<string, SamplePcm>();
let pcmBytes = 0;
const slots = new Map<string, Slot>();
let genSeq = 0;
const loadedFns = new Set<(key: string) => void>();
const failedFns = new Set<(key: string, why: SampleFail) => void>();
const statusFns = new Set<(key: string) => void>();
const droppedFns = new Set<(key: string, gone: boolean) => void>();
/** Les samples que le kit joue (audio/shots.ts le dit) : jamais liberes par le budget. */
let keepFn: (key: string) => boolean = () => false;

const pcmSize = (p: SamplePcm): number => (p.L.length + (p.R && p.R !== p.L ? p.R.length : 0)) * 4;
const slotOf = (key: string): Slot => {
  let s = slots.get(key);
  if (!s) {
    s = { state: 'idle', tries: 0, at: 0, gen: 0, timer: 0, abort: null, promise: null };
    slots.set(key, s);
  }
  return s;
};
const emitStatus = (key: string): void => statusFns.forEach((fn) => fn(key));
const emitDropped = (key: string, gone: boolean): void => droppedFns.forEach((fn) => fn(key, gone));

/** L'echantillon decode, s'il est la (le plus recemment servi reste le plus longtemps). */
export const samplePcm = (key: string): SamplePcm | undefined => {
  const p = pcm.get(key);
  if (p) {
    pcm.delete(key);
    pcm.set(key, p);
  }
  return p;
};

/** L'etat d'un echantillon ; une cle inconnue (un sample parti) : en echec, gone pour un sample de ce navigateur. */
export function sampleStatus(key: string): SampleStatus {
  if (pcm.has(key)) return { state: 'ready' };
  if (!sampleByKey(key)) return { state: 'failed', why: isUserKey(key) ? 'gone' : 'missing' };
  const s = slots.get(key);
  if (!s) return { state: 'idle' };
  return s.why ? { state: s.state, why: s.why } : { state: s.state };
}

/** Ce qui est gratuit a relacher : le PCM le moins recemment servi, ni celui qui arrive ni un que le kit joue. */
function trim(keepKey: string): void {
  if (pcmBytes <= PCM_BUDGET) return;
  for (const [k, p] of [...pcm]) {
    if (pcmBytes <= PCM_BUDGET) break;
    if (k === keepKey || keepFn(k)) continue;
    pcm.delete(k);
    pcmBytes -= pcmSize(p);
    const s = slots.get(k);
    if (s) {
      s.state = 'idle';
      // Plus rien en cours pour lui (2026-10-22, revue RA1-5) : le prochain loadSample le recharge
      s.promise = null;
    }
    emitDropped(k, false);
    emitStatus(k);
  }
}

class HttpError extends Error {
  readonly status: number;
  constructor(status: number) {
    super(`HTTP ${status}`);
    this.status = status;
  }
}
class BadFile extends Error {}

/** Pourquoi un essai a echoue. */
function failOf(e: unknown, user: boolean): SampleFail {
  if (e instanceof BadFile) return 'bad';
  if (e instanceof HttpError) return e.status === 404 || e.status === 410 || (e.status >= 400 && e.status < 500 && e.status !== 408 && e.status !== 429) ? 'missing' : 'offline';
  if (user) return 'storage';
  // TypeError de fetch (reseau coupe), AbortError (le delai) : passager
  return 'offline';
}

/** Le prochain essai d'un echec passager, apres RETRY_MS[tries - 1] ; missing : un seul, apres RETRY_MS[1]. */
function schedule(key: string, s: Slot): void {
  window.clearTimeout(s.timer);
  s.timer = 0;
  const passing = s.why === 'offline' || s.why === 'storage';
  const wait =
    s.why === 'missing' ? (s.tries <= 1 ? RETRY_MS[1] : -1) : !passing ? -1 : s.tries <= RETRY_MS.length ? RETRY_MS[s.tries - 1] : keepFn(key) ? RETRY_KEPT_MS : -1;
  if (!(wait >= 0)) return;
  s.timer = window.setTimeout(() => {
    s.timer = 0;
    if (s.state === 'failed' && slots.get(key) === s && sampleByKey(key)) void start(key, s);
  }, wait);
}

/** Un essai : le fichier (le site, ou IndexedDB pour un sample de ce navigateur), son decodage, l'annonce. */
function start(key: string, s: Slot): Promise<SamplePcm | null> {
  const smp = sampleByKey(key);
  if (!smp) return Promise.resolve(null);
  const gen = (genSeq += 1);
  s.gen = gen;
  s.state = 'loading';
  s.why = undefined;
  s.at = performance.now();
  const ac = typeof AbortController !== 'undefined' && !smp.user ? new AbortController() : null;
  s.abort = ac;
  const job = (async (): Promise<SamplePcm | null> => {
    // Toujours asynchrone (2026-10-22, revue RA1-5) : le son decode a l'ajout (takePcm) ne passait par aucune attente,
    // tout se faisait pendant l'appel. onSampleLoaded partait avant que shots.ts ait gare le calcul qui l'attend (il
    // restait gare pour rien), et le finally effacait s.promise avant qu'elle soit posee : une promesse deja tenue
    // restait la, rendue pour toujours une fois ce PCM libere par le budget (le sample ne revenait jamais)
    await Promise.resolve();
    const timer = ac ? window.setTimeout(() => ac.abort(), FETCH_TIMEOUT_MS) : 0;
    try {
      let out: SamplePcm | undefined = smp.user ? userSamples.takePcm(key) : undefined;
      if (!out) {
        let data: ArrayBuffer | null;
        if (smp.user) data = await userSamples.bytes(key);
        else {
          const res = await fetch(smp.url, ac ? { signal: ac.signal } : undefined);
          if (!res.ok) throw new HttpError(res.status);
          data = await res.arrayBuffer();
        }
        window.clearTimeout(timer);
        if (!data) throw new Error('storage');
        try {
          const d = await decodeAudio(data);
          out = { L: d.L, R: d.R, sr: d.sr };
        } catch {
          throw new BadFile('decode');
        }
      }
      // Un chargement depasse (le sample retire, ou un autre essai parti) : son resultat ne compte pas
      if (s.gen !== gen || slots.get(key) !== s) return pcm.get(key) ?? null;
      pcm.set(key, out);
      pcmBytes += pcmSize(out);
      s.state = 'ready';
      s.tries = 0;
      s.why = undefined;
      trim(key);
      loadedFns.forEach((fn) => fn(key));
      emitStatus(key);
      return out;
    } catch (e) {
      if (s.gen !== gen || slots.get(key) !== s) return null;
      // Un sample de ce navigateur retire pendant la lecture : parti pour de bon
      const why: SampleFail = smp.user && !sampleByKey(key) ? 'gone' : failOf(e, !!smp.user);
      s.state = 'failed';
      s.why = why;
      s.tries += 1;
      schedule(key, s);
      failedFns.forEach((fn) => fn(key, why));
      emitStatus(key);
      return null;
    } finally {
      window.clearTimeout(timer);
      if (s.gen === gen) {
        s.abort = null;
        s.promise = null;
      }
    }
  })();
  s.promise = job;
  emitStatus(key);
  return job;
}

/**
 * Telecharge et decode un echantillon (une fois) ; ses abonnes l'apprennent. Un echec ne se retente pas ici (les
 * essais suivants partent seuls, ou d'un choix explicite : requestSample) : null tout de suite.
 */
export function loadSample(key: string): Promise<SamplePcm | null> {
  const hit = pcm.get(key);
  if (hit) return Promise.resolve(hit);
  if (typeof window === 'undefined' || !sampleByKey(key)) return Promise.resolve(null);
  const s = slotOf(key);
  // Seulement un chargement en cours (2026-10-22, revue RA1-5) : une promesse d'un autre etat est depassee
  if (s.promise && s.state === 'loading') return s.promise;
  if (s.state === 'failed') return Promise.resolve(null);
  return start(key, s);
}

/**
 * Un echantillon que Mika vient de choisir (le navigateur des sons, SOUND, un preset, un verrou pose) : comme
 * loadSample, mais un echec passager (offline, storage ; missing apres MISSING_GAP_MS) se retente tout de suite, les
 * attentes repartent de zero.
 */
export function requestSample(key: string): Promise<SamplePcm | null> {
  const hit = pcm.get(key);
  if (hit) return Promise.resolve(hit);
  if (typeof window === 'undefined' || !sampleByKey(key)) return Promise.resolve(null);
  const s = slotOf(key);
  if (s.promise && s.state === 'loading') return s.promise;
  if (s.state === 'failed') {
    const since = performance.now() - s.at;
    const again = s.why === 'offline' || s.why === 'storage' ? since >= EXPLICIT_GAP_MS : s.why === 'missing' ? since >= MISSING_GAP_MS : false;
    if (!again) return Promise.resolve(null);
    window.clearTimeout(s.timer);
    s.timer = 0;
    s.tries = 0;
  }
  return start(key, s);
}

/** Le PCM d'un echantillon retire (un sample de ce navigateur) : libere, son chargement en cours oublie. */
function forget(key: string): void {
  const s = slots.get(key);
  if (s) {
    window.clearTimeout(s.timer);
    s.abort?.abort();
    slots.delete(key);
  }
  const p = pcm.get(key);
  if (p) {
    pcm.delete(key);
    pcmBytes -= pcmSize(p);
  }
  if (s || p) {
    emitDropped(key, true);
    emitStatus(key);
  }
}

/** Les samples que le kit joue ne sont jamais liberes par le budget (audio/shots.ts, qui connait le kit). */
export function keepSample(fn: (key: string) => boolean): void {
  keepFn = fn;
}

/** Un echantillon vient d'etre decode. */
export function onSampleLoaded(fn: (key: string) => void): () => void {
  loadedFns.add(fn);
  return () => {
    loadedFns.delete(fn);
  };
}
/** Un essai a echoue (et pourquoi). */
export function onSampleFailed(fn: (key: string, why: SampleFail) => void): () => void {
  failedFns.add(fn);
  return () => {
    failedFns.delete(fn);
  };
}
/** L'etat d'un echantillon a change (loading, ready, failed, idle) : l'ecran se redessine. */
export function onSampleStatus(fn: (key: string) => void): () => void {
  statusFns.add(fn);
  return () => {
    statusFns.delete(fn);
  };
}
/** Un PCM est libere (gone : le sample retire de ce navigateur ; sinon le budget, il se rechargera). */
export function onSampleDropped(fn: (key: string, gone: boolean) => void): () => void {
  droppedFns.add(fn);
  return () => {
    droppedFns.delete(fn);
  };
}

if (typeof window !== 'undefined') {
  // Le reseau revient : ce qui a echoue faute de reseau repart, de zero ; un telechargement parti avant et qui attend
  // encore (une requete perdue pendant la coupure, qui n'aurait echoue qu'au bout de FETCH_TIMEOUT_MS) repart aussi
  window.addEventListener('online', () => {
    const now = performance.now();
    for (const [key, s] of slots) {
      if (s.state === 'loading' && s.abort && now - s.at > 1000 && sampleByKey(key)) {
        s.abort.abort();
        s.tries = 0;
        void start(key, s);
        continue;
      }
      if (s.state !== 'failed' || (s.why !== 'offline' && s.why !== 'missing') || !sampleByKey(key)) continue;
      window.clearTimeout(s.timer);
      s.timer = 0;
      s.tries = 0;
      void start(key, s);
    }
  });
}

/** Les tests (window.__v4.audio.samples) : les etats et la memoire. */
export const sampleStats = (): { decoded: number; bytes: number; budget: number; slots: Record<string, string> } => ({
  decoded: pcm.size,
  bytes: pcmBytes,
  budget: PCM_BUDGET,
  slots: Object.fromEntries([...slots].filter(([, s]) => s.state !== 'ready').map(([k, s]) => [k, `${s.state}${s.why ? `:${s.why}` : ''}#${s.tries}`])),
});

// L'ancien panneau "samples de l'appareil" est retire (2026-10-05) : ce qu'il gardait dans ce navigateur part
// (pas 'mm-v4-rytm-user', la base des samples de Mika depuis le 2026-10-18, audio/usersamples.ts)
if (typeof window !== 'undefined') {
  try {
    window.localStorage.removeItem('mm.v4.usersamples.1');
    window.indexedDB?.deleteDatabase('mm-v4-rytm-samples');
  } catch {
    /* stockage refuse : rien a retirer */
  }
}
