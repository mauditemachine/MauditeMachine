/**
 * Les one-shots du MM-RYTM, prets a jouer (2026-10-03) : le calcul est dans
 * audio/shotsdsp.ts (fait dans un worker, audio/shots.worker.ts), ce module
 * garde les AudioBuffer et choisit celui de chaque coup.
 * - Un echantillon depend de son STRETCH (la duree des enveloppes),
 *   arrondi au huitieme de facteur 4 (shotKey) : calcule a la demande, garde
 *   (LRU, MAX_ENTRIES).
 * - shots.warm() prepare tous les sons a STRETCH 0, un a la fois, dans
 *   le worker (sans worker : une tache chacun), la variante 0 de chaque son
 *   d'abord, dans l'ordre du motif d'arrivee. Une premiere fois a 48 kHz
 *   des que la page est calme (shots.prewarm, sans aucun AudioContext), puis
 *   a la frequence du contexte des qu'il existe.
 * - Un coup dont l'echantillon n'est pas pret prend le plus proche deja
 *   calcule : meme frequence et STRETCH voisin, sinon l'autre frequence (le
 *   navigateur reechantillonne), sinon une autre variante ; et le bon part
 *   en file. Aucun (2026-10-05) : ce coup ne joue pas et son son passe en
 *   tete de file. Jamais de calcul sur le fil principal pendant la lecture :
 *   100 a 250 ms qui gelaient l'ordonnanceur au premier RUN (le son se
 *   coupait). Le rendu hors ligne (sync) calcule toujours tout de suite.
 * - Les sons bruites ont plusieurs variantes, tirees au hasard, jamais deux
 *   fois la meme de suite.
 * - TONE (2026-10-04, pour l'ecoute aux intra-auriculaires) : un coup
 *   transpose n'est plus relu plus vite ou plus lentement (le navigateur
 *   interpole lineairement : aigus ternis et flottants) ; il est calcule a
 *   sa hauteur, au millieme de demi-ton (pitchKey) : rendu a sr / pf puis
 *   lu a sr, vitesse 1, l'echantillon exact. En attendant qu'il soit pret,
 *   le plus proche, relu a la vitesse qu'il faut.
 * - Un echantillon de Mika (2026-10-05, audio/samples.ts) se calcule sur le
 *   fil principal (relire un fichier ne coute presque rien, le worker n'a
 *   pas le fichier) une fois telecharge ; en attendant, la voix joue le son
 *   calcule le plus proche, puis le bon des qu'il est la.
 * - Un coup verrouille (2026-10-08, les parameter locks, audio/locks.ts) :
 *   son son (un "sample lock" : un autre son de sa famille, ou d'une autre)
 *   et sa hauteur (TUNE) viennent du pas, pas du kit ; il passe par un
 *   ShotOverride (le calcul et sa signature), joue toujours la variante 0,
 *   et ses calculs en attente ne sont jamais purges par un reglage du kit
 *   qui tourne (ils ne sont pas a lui). drums.ts les prepare a l'avance
 *   (prepare), un coup verrouille arrive donc deja calcule.
 * - Les deux couches (2026-10-08, l'etape R3, Mika : "comme la ANALOG Rytm
 *   ou on peut mettre des samples mais le kick peut etre parametre comme une
 *   machine") : un coup est sa couche SYNTH et sa couche SAMPLE ensemble
 *   (shotsdsp.ts renderLayers), calcule d'un bloc dans le worker ;
 *   l'echantillon decode lui est envoye une fois (pcmSent). Sans worker, le
 *   meme calcul sur le fil principal, en tache de fond.
 *
 * La selection des samples sans accroc (2026-10-21, audit des samples, Mika :
 * "controle les selections de samples dans RYTM ! je ne veux plus que ca
 * plante") :
 * - le plus proche n'est plus n'importe quel coup de la voix (le premier
 *   rendu gagnait : le kick par defaut jouait les 3 a 5 coups apres chaque
 *   changement, et l'ecoute a l'arret faisait entendre BLUEPRINT au lieu du
 *   son choisi) : seulement le MEME son (meme signature) a une autre hauteur,
 *   un autre STRETCH, une autre variante ou frequence ; sinon le son
 *   precedent de la voix (le dernier coup qu'elle a joue, lastPlayed), sinon
 *   le repli ;
 * - le repli (kit.ts synthFallback) : la couche SYNTH de la voix seule, a son
 *   plein niveau, quand son echantillon est en echec (le reseau coupe, un
 *   fichier manquant : l'ecran le dit) ou en chargement sans son precedent ;
 *   calcule dans le worker comme les autres, la meme regle hors ligne
 *   (makeNow) ;
 * - un son muet (OFF, les deux couches a 0) ne joue rien, jamais un autre
 *   son a sa place, et ne se calcule pas ;
 * - un nouveau choix de son (kit.choice) se calcule tout de suite, en tete de
 *   file, a la hauteur et au STRETCH du dernier coup de la voix (lastReq),
 *   sans attendre la fin du geste (120 ms : ce delai reste pour un potard) ;
 *   whenReady : l'ecoute a l'arret attend ce coup exact (actions.ts) ;
 * - un calcul dont l'echantillon n'est pas encore decode attend son arrivee
 *   (waitSample, tous et non plus seulement ceux des verrous) et repart en
 *   tete de file (avant : lache, redemande au coup suivant, en fin de file) ;
 * - la frequence du prechauffage ne remplace plus celle du contexte (un
 *   contexte a 44,1 kHz cree avant l'appel du prechauffage : tout se
 *   recalculait a 48 kHz, pour rien) ;
 * - le cache a un budget d'octets (MAX_BYTES, en plus de MAX_ENTRIES) et se
 *   rafraichit a chaque coup joue (LRU) ; un sample retire de ce navigateur
 *   emporte ses coups, son PCM et sa copie dans le worker ;
 * - une exception dans le worker ne coupe plus le worker pour la visite : il
 *   repond par une erreur, le calcul est retente une fois puis son repli
 *   joue ; un worker qui plante en route est relance (MAX_RESTARTS fois).
 */

import { KIT_FAMILIES, familyOf, kit, shotsOf, silentTweak, synthFallback, type KitFamily } from './kit';
import { keepSample, loadSample, onSampleDropped, onSampleFailed, onSampleLoaded, requestSample, samplePcm, sampleStatus } from './samples';
import { renderLayers, VARIANTS, type ShotId, type ShotTweak } from './shotsdsp';
import { boot } from '../state/boot';

export type { ShotId } from './shotsdsp';

/** STRETCH arrondi au huitieme de facteur 4 : la cle d'un echantillon. */
export const shotKey = (ts: number): number => Math.max(-11, Math.min(10, Math.round((Math.log(ts) / Math.log(4)) * 8)));
const keyTs = (k: number): number => Math.pow(4, k / 8);
/** TONE en milliemes de demi-ton : la hauteur d'un echantillon. */
export const pitchKey = (pf: number): number => Math.round(Math.log2(pf) * 12000);
const keyPf = (pk: number): number => Math.pow(2, pk / 12000);

const COARSE = typeof window !== 'undefined' && !!window.matchMedia?.('(pointer: coarse)').matches;
/** Le budget du cache (2026-10-21, audit RS-5 : un coup de sample perso long pesait jusqu'a 100 Mo) : en octets, et en entrees (le plus proche les parcourt). */
const MAX_BYTES = (COARSE ? 40 : 96) * 1024 * 1024;
const MAX_ENTRIES = 240;
/** Un worker qui plante en route est relance, MAX_RESTARTS fois au plus (ensuite le fil principal, comme sans worker). */
const MAX_RESTARTS = 3;
/** Les calculs en attente de leur echantillon gardes au plus. */
const MAX_WAITING = 64;
/** Ordre du prechauffage : les voix du motif d'arrivee d'abord. */
// Huit voix (2026-10-05) : RS et PC ne se calculent plus
const IDS: readonly ShotId[] = ['BD', 'CH', 'CP', 'SD', 'TOM', 'CY', 'OH', 'HT', 'CHopen'];
/** Frequence du prechauffage, avant tout contexte (la plus courante). */
const PREWARM_SR = 48000;
let prewarmed = false;

interface Job {
  key: string;
  id: ShotId;
  /** frequence du contexte (celle de l'AudioBuffer) */
  sr: number;
  /** STRETCH : sa cle (shotKey) et son facteur */
  k: number;
  ts: number;
  v: number;
  /** hauteur (milliemes de demi-ton) : le calcul se fait a sr / pf */
  pk: number;
  /** le kit du moment pour ce son (audio/kit.ts), et sa signature dans la cle */
  tw: ShotTweak;
  sig: string;
  /** un coup verrouille (2026-10-08) : jamais purge par un reglage du kit */
  lock?: boolean;
  /** un repli (2026-10-21) : la couche SYNTH seule, pour un sample qui manque */
  fb?: boolean;
  /** les essais rates dans le worker (une erreur, un echantillon qu'il n'avait plus) */
  tries?: number;
}
type JobSpec = Omit<Job, 'key' | 'ts'>;

/**
 * Un son verrouille (2026-10-08) : ce que son calcul doit savoir (le son du
 * pas au lieu de celui du kit) et sa signature dans la cle ; la variante 0.
 */
export interface ShotOverride {
  tw: ShotTweak;
  sig: string;
}

/** Un coup pret a partir : l'echantillon, et sa vitesse de lecture (1 : exact). */
export interface ShotPlay {
  buf: AudioBuffer;
  rate: number;
}

const cache = new Map<string, AudioBuffer>();
let cacheBytes = 0;
const queue: Job[] = [];
/** La commande en cours dans le worker (une a la fois). */
let busy: Job | null = null;
/** undefined : pas encore essaye ; null : pas de worker (calcul sur le fil principal). */
let worker: Worker | null | undefined;
/** Le worker a deja repondu une fois (sinon il ne demarre pas : le fil principal) ; ses relances. */
let workerOk = false;
let restarts = 0;
const stats = { rendered: 0, ms: 0, sync: 0, nearest: 0, inWorker: 0, skipped: 0, previous: 0, fallback: 0, errors: 0, restarts: 0, lastError: '' };
/** La derniere variante jouee de chaque son. */
const lastVar = new Map<ShotId, number>();
/** Le dernier coup joue par chaque voix hors verrou (2026-10-21) : son son precedent, tant que le nouveau se calcule. */
const lastPlayed = new Map<ShotId, { buf: AudioBuffer; pk: number; key: string }>();
/** La hauteur, le STRETCH et la frequence du dernier coup de chaque voix hors verrou : un nouveau choix s'y calcule. */
const lastReq = new Map<ShotId, { k: number; pk: number; sr: number }>();
/** Les calculs qui ont echoue deux fois (2026-10-21) : plus redemandes, leur repli joue. */
const broken = new Set<string>();
/** Ceux qu'on attend (whenReady : l'ecoute a l'arret). */
const waiters = new Map<string, Array<(ok: boolean) => void>>();
/**
 * Les voix qui viennent de jouer un son de remplacement (le meme son le plus proche, le son precedent, le repli) : des
 * qu'un de leurs coups arrive, l'horloge refait ses pas deja programmes (onReady). Avant, les 300 ms programmees
 * d'avance apres un changement gardaient le remplacant.
 */
const substituted = new Set<ShotId>();
const readyFns = new Set<() => void>();
let readyTimer = 0;
function substitute(id: ShotId): void {
  substituted.add(id);
}

/**
 * Les variantes d'un son : une seule quand sa famille ne joue que son
 * echantillon (toutes seraient le meme) ; la couche SYNTH a son niveau garde
 * les siennes (le bruit de la caisse claire change d'un coup a l'autre).
 */
const variantsOf = (id: ShotId): number => {
  const f = familyOf(id);
  return f && kit.get().sample[f] && kit.get().layer[f].syn <= 0 ? 1 : VARIANTS[id];
};

/** La cle d'un echantillon : son, STRETCH, variante, frequence, hauteur, et la signature du kit (audio/kit.ts, 2026-10-04). */
const cacheKey = (id: ShotId, k: number, v: number, sr: number, pk = 0, sig = kit.sig(id)): string => `${id}|${k}|${v}|${sr}|${pk}|${sig}`;
/** Une cle lue : la signature est tout ce qui suit le cinquieme separateur (celle d'un sample en contient un). */
const KEY_RE = /^([^|]+)\|(-?\d+)\|(\d+)\|([\d.]+)\|(-?\d+)\|(.*)$/;

/** Les echantillons dont les deux canaux different (un sample stereo) : le PAN d'un coup les garde stereo (drums.ts). */
const stereoBufs = new WeakSet<AudioBuffer>();

function toBuffer(L: Float32Array, R: Float32Array | null, sr: number): AudioBuffer {
  const b = new AudioBuffer({ length: L.length, numberOfChannels: 2, sampleRate: sr });
  b.copyToChannel(L as Float32Array<ArrayBuffer>, 0);
  b.copyToChannel((R ?? L) as Float32Array<ArrayBuffer>, 1);
  if (R && R !== L && differs(L, R)) stereoBufs.add(b);
  return b;
}

/**
 * Deux canaux vraiment differents : leur ecart au-dessus de -40 dB du son
 * (un fichier stereo en double mono reste mono pour le PAN, sa loi a
 * puissance constante).
 */
function differs(L: Float32Array, R: Float32Array): boolean {
  const n = Math.min(L.length, R.length);
  let d = 0;
  let e = 0;
  for (let i = 0; i < n; i += 1) {
    const x = L[i] - R[i];
    d += x * x;
    e += L[i] * L[i] + R[i] * R[i];
  }
  return d > 1e-4 * e;
}

const bytesOf = (b: AudioBuffer): number => b.length * b.numberOfChannels * 4;

/** Ceux qui attendaient ce coup l'apprennent. */
function settle(key: string, ok: boolean): void {
  const w = waiters.get(key);
  if (!w) return;
  waiters.delete(key);
  w.forEach((fn) => fn(ok));
}

function put(key: string, b: AudioBuffer): void {
  const old = cache.get(key);
  if (old) {
    cache.delete(key);
    cacheBytes -= bytesOf(old);
  }
  cache.set(key, b);
  cacheBytes += bytesOf(b);
  const id = key.slice(0, key.indexOf('|')) as ShotId;
  if (substituted.delete(id) && readyFns.size > 0 && typeof window !== 'undefined' && !readyTimer) {
    readyTimer = window.setTimeout(() => {
      readyTimer = 0;
      readyFns.forEach((fn) => fn());
    }, 0);
  }
  // Le budget : le moins recemment joue part d'abord (le dernier arrive reste)
  while ((cacheBytes > MAX_BYTES || cache.size > MAX_ENTRIES) && cache.size > 1) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    const fb = cache.get(first);
    cache.delete(first);
    if (fb) cacheBytes -= bytesOf(fb);
  }
  settle(key, true);
}

/** Un coup du cache, rafraichi (le LRU : un coup qu'on joue reste). */
function touch(key: string): AudioBuffer | undefined {
  const b = cache.get(key);
  if (b) {
    cache.delete(key);
    cache.set(key, b);
  }
  return b;
}

/** Le plus proche deja calcule du MEME son (sig) : STRETCH voisin (1 par cran), hauteur (2 par demi-ton), autre frequence (+30), autre variante (+60). */
function nearest(id: ShotId, sig: string, k: number, pk: number, v: number, sr: number): { buf: AudioBuffer; pk: number } | null {
  let best: AudioBuffer | null = null;
  let bestPk = 0;
  let score = Infinity;
  const pre = `${id}|`;
  const end = `|${sig}`;
  for (const [ck, b] of cache) {
    if (!ck.startsWith(pre) || !ck.endsWith(end)) continue;
    const m = KEY_RE.exec(ck);
    if (!m || m[6] !== sig) continue;
    const sc = Math.abs(Number(m[2]) - k) + Math.abs(Number(m[5]) - pk) / 500 + (Number(m[4]) === sr ? 0 : 30) + (Number(m[3]) === v ? 0 : 60);
    if (sc < score) {
      best = b;
      bestPk = Number(m[5]);
      score = sc;
    }
  }
  return best ? { buf: best, pk: bestPk } : null;
}

/** L'echantillon audible de la couche SAMPLE d'un coup ('' : aucun). */
const smpOf = (tw: Readonly<ShotTweak>): string => (tw.sample && (tw.smp?.lev ?? 1) > 0 ? tw.sample : '');

/**
 * Calcul sur le fil principal (sans worker, ou un coup qui ne peut pas
 * attendre : le rendu hors ligne). Un echantillon qui manque : le repli,
 * sa couche SYNTH seule a son plein niveau (synthFallback, la regle du temps
 * reel), garde sous la cle du repli (le bon le remplacera). null : un son muet.
 */
function makeNow(j: Job): AudioBuffer | null {
  const t0 = performance.now();
  const smp = smpOf(j.tw);
  const pcm = smp ? samplePcm(smp) : undefined;
  const missing = !!smp && !pcm;
  const fb = missing ? synthFallback(j.id, j.tw) : null;
  const tw = fb ? fb.tw : j.tw;
  if (silentTweak(tw)) return null;
  const s = renderLayers(j.id, j.sr / keyPf(j.pk), j.ts, j.v, tw, pcm);
  const b = toBuffer(s.L, s.L === s.R ? null : s.R, j.sr);
  stats.ms += performance.now() - t0;
  stats.rendered += 1;
  if (fb) {
    put(cacheKey(j.id, j.k, j.v, j.sr, j.pk, fb.sig), b);
    void loadSample(smp);
  } else put(j.key, b);
  return b;
}

/** Les echantillons deja envoyes au worker (il les garde) ; un nouveau worker repart de rien. */
let pcmSent = new Set<string>();

/** Un calcul abandonne (deux echecs) : ceux qui l'attendaient le savent, et son repli se calcule s'il avait un sample. */
function giveUp(j: Job): void {
  broken.add(j.key);
  stats.errors += 1;
  settle(j.key, false);
  if (smpOf(j.tw) && !j.fb) addFallback(j.id, j.tw, j.k, j.pk, j.sr, !!j.lock, true);
}

/** Un essai rate dans le worker : une fois de plus (en tete de file), puis abandonne. */
function retry(j: Job): void {
  const tries = (j.tries ?? 0) + 1;
  if (tries < 2) queue.unshift({ ...j, tries });
  else giveUp(j);
}

function onDone(e: MessageEvent<{ key: string; L?: Float32Array; R?: Float32Array | null; ms?: number; missing?: boolean; error?: string }>): void {
  const d = e.data;
  const j = busy;
  busy = null;
  workerOk = true;
  // Le worker n'avait plus l'echantillon (son budget l'a libere), ou le calcul a leve une exception : un essai de plus
  if (d.missing || d.error) {
    if (j && j.key === d.key) {
      const smp = smpOf(j.tw);
      if (smp) pcmSent.delete(smp);
      if (d.error) stats.lastError = `${j.key}: ${d.error}`.slice(0, 300);
      retry(j);
    }
    pump();
    return;
  }
  if (j && j.key === d.key && d.L && !cache.has(d.key)) {
    put(d.key, toBuffer(d.L, d.R ?? null, j.sr));
    stats.rendered += 1;
    stats.inWorker += 1;
    stats.ms += d.ms ?? 0;
  }
  pump();
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    const w = new Worker(new URL('./shots.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = onDone;
    w.onerror = (ev) => {
      ev.preventDefault();
      w.terminate();
      pcmSent = new Set();
      // Il n'a jamais repondu (le navigateur ne le demarre pas) : tout se calcule sur le fil principal, comme avant ; il
      // a plante en route (2026-10-21, audit RS-9 : un seul mauvais calcul le coupait pour la visite) : un nouveau
      if (!workerOk || restarts >= MAX_RESTARTS) worker = null;
      else {
        restarts += 1;
        stats.restarts += 1;
        worker = undefined;
      }
      const j = busy;
      busy = null;
      if (j) retry(j);
      pump();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/**
 * Les calculs qui attendent leur echantillon (2026-10-08 pour les verrous, tous depuis le 2026-10-21) : repris en tete
 * de file a son arrivee (onSampleLoaded), leur repli calcule s'il echoue (onSampleFailed).
 */
const waitSample: Job[] = [];
function park(j: Job): void {
  if (waitSample.some((w) => w.key === j.key)) return;
  waitSample.push(j);
  while (waitSample.length > MAX_WAITING) {
    const old = waitSample.shift();
    if (old) settle(old.key, false);
  }
}

function pump(): void {
  if (busy) return;
  let j = queue.shift();
  while (j && cache.has(j.key)) j = queue.shift();
  if (!j) return;
  // Un echantillon pas encore decode : le calcul l'attend (son arrivee le remet en tete de file)
  const smp = smpOf(j.tw);
  if (smp && !samplePcm(smp)) {
    void loadSample(smp);
    park(j);
    pump();
    return;
  }
  const w = getWorker();
  busy = j;
  if (w) {
    // Le worker calcule a la frequence de rendu (sr / pf) ; le buffer gardera sr. L'echantillon de la couche
    // SAMPLE part avec la premiere commande qui en a besoin (une copie : le fil principal garde le sien)
    const key = smp;
    const pcm = key && !pcmSent.has(key) ? samplePcm(key) : undefined;
    if (key && pcm) pcmSent.add(key);
    w.postMessage({ key: j.key, id: j.id, sr: j.sr / keyPf(j.pk), ts: j.ts, v: j.v, tw: j.tw, ...(pcm && key ? { pcm: { key, L: pcm.L, R: pcm.R, sr: pcm.sr } } : {}) });
    return;
  }
  setTimeout(() => {
    const cur = busy;
    busy = null;
    // Une exception ici ne coupe plus la file (2026-10-21) : ce calcul seul est abandonne
    try {
      if (cur && !cache.has(cur.key)) makeNow(cur);
    } catch {
      if (cur) giveUp(cur);
    }
    pump();
  }, 0);
}

/** Un calcul en file (en tete si un coup l'attend) ; rien s'il est deja la, en cours, en attente ou abandonne. */
function addJob(spec: JobSpec, first: boolean): void {
  if (!(spec.sr > 0) || silentTweak(spec.tw)) return;
  const key = cacheKey(spec.id, spec.k, spec.v, spec.sr, spec.pk, spec.sig);
  if (cache.has(key) || busy?.key === key || broken.has(key)) return;
  const at = queue.findIndex((j) => j.key === key);
  if (at >= 0) {
    // Deja en file : en tete si un coup l'attend
    if (first && at > 0) queue.unshift(...queue.splice(at, 1));
    return;
  }
  const w = waitSample.findIndex((j) => j.key === key);
  if (w >= 0) {
    const smp = smpOf(waitSample[w].tw);
    if (smp && !samplePcm(smp)) return;
    waitSample.splice(w, 1);
  }
  // Un reglage du kit tourne : les calculs en attente d'un reglage depasse de ce son ne servent plus (ni ceux des
  // verrous, 2026-10-08 : ils ne suivent pas le son du kit, gotcha 4 de l'etude) ; son repli du moment reste
  if (!spec.lock) {
    const cur = kit.sig(spec.id);
    const curFb = synthFallback(spec.id, kit.tweak(spec.id)).sig;
    for (let i = queue.length - 1; i >= 0; i -= 1) {
      const q = queue[i];
      if (q.id === spec.id && !q.lock && q.sig !== cur && q.sig !== curFb && q.sig !== spec.sig) queue.splice(i, 1);
    }
  }
  const job: Job = { ...spec, key, ts: keyTs(spec.k) };
  if (first) queue.unshift(job);
  else queue.push(job);
  pump();
}

function enqueue(id: ShotId, k: number, v: number, sr: number, pk = 0, first = false, ov: ShotOverride | null = null): void {
  addJob({ id, k, v, sr, pk, tw: ov ? ov.tw : kit.tweak(id), sig: ov ? ov.sig : kit.sig(id), ...(ov ? { lock: true } : {}) }, first);
}

/** Le repli d'un coup (sa couche SYNTH seule) en file, la variante 0. */
function addFallback(id: ShotId, tw: Readonly<ShotTweak>, k: number, pk: number, sr: number, lock: boolean, first: boolean): { tw: ShotTweak; sig: string } {
  const fb = synthFallback(id, tw);
  addJob({ id, k, v: 0, sr, pk, tw: fb.tw, sig: fb.sig, fb: true, ...(lock ? { lock: true } : {}) }, first);
  return fb;
}

/** La frequence des derniers sons prepares (celle du contexte), pour recalculer ceux qu'un TWEAK change. */
let warmSr = 0;
let rewarmTimer = 0;
const rewarmIds = new Set<ShotId>();
/** Le dernier choix de son vu de chaque famille (kit.choice). */
const choiceAt = new Map<KitFamily, number>();

/**
 * Le son du moment d'une voix, tout de suite et en tete de file (2026-10-21) : a la hauteur, au STRETCH et a la
 * frequence de son dernier coup (lastReq), et a STRETCH 0 (le prechauffage) ; son echantillon pas encore la, son repli
 * aussi (il jouera si le fichier ne vient pas).
 */
function prime(id: ShotId): void {
  const r = lastReq.get(id);
  const sr = r?.sr || warmSr;
  if (!sr) return;
  const tw = kit.tweak(id);
  if (silentTweak(tw)) return;
  const k = r?.k ?? 0;
  const pk = r?.pk ?? 0;
  if (warmSr && (k !== 0 || pk !== 0 || sr !== warmSr)) enqueue(id, 0, 0, warmSr, 0, true);
  enqueue(id, k, 0, sr, pk, true);
  const smp = smpOf(tw);
  if (smp && !samplePcm(smp)) addFallback(id, tw, k, pk, sr, false, sampleStatus(smp).state === 'failed');
}

/**
 * Un TWEAK du kit tourne (audio/kit.ts) : ses sons se recalculent en fond,
 * a STRETCH 0 et hauteur d'origine (le cas courant), une fois le geste
 * pose (120 ms) ; un coup qui arrive avant joue le meme son le plus proche, ou
 * le son precedent de la voix. Un nouveau choix de son (2026-10-21) : sans
 * attendre (prime), son echantillon demande explicitement (un echec passager
 * se retente).
 */
kit.subscribe((changed) => {
  for (const f of changed) for (const id of shotsOf(f)) rewarmIds.add(id);
  if (typeof window === 'undefined') return;
  for (const f of changed) {
    const c = kit.choice(f);
    if (choiceAt.get(f) === c) continue;
    choiceAt.set(f, c);
    const key = kit.get().sample[f];
    // Pas avant le demarrage (2026-10-22, revue INT-2) : un lien SHARE pose le kit au montage, ses WAV partaient avant
    // la premiere image ; prewarm (apres boot.onReady) les charge de toute facon.
    if (key && kit.get().layer[f].lev > 0 && (warmSr !== 0 || boot.ready())) void requestSample(key);
    for (const id of shotsOf(f)) prime(id);
  }
  if (warmSr === 0) return;
  window.clearTimeout(rewarmTimer);
  rewarmTimer = window.setTimeout(() => {
    for (const id of rewarmIds) for (let v = 0; v < variantsOf(id); v += 1) enqueue(id, 0, v, warmSr);
    rewarmIds.clear();
  }, 120);
});

/** Un echantillon telecharge : les calculs qui l'attendaient repartent en tete de file, les voix qui le jouent aussi. */
onSampleLoaded((key) => {
  const back: Job[] = [];
  for (let i = waitSample.length - 1; i >= 0; i -= 1) {
    const j = waitSample[i];
    if (j.tw.sample !== key) continue;
    waitSample.splice(i, 1);
    if (cache.has(j.key) || queue.some((q) => q.key === j.key)) continue;
    // Ceux d'un reglage du kit depasse ne servent plus ; ceux des verrous, toujours
    if (j.lock || j.sig === kit.sig(j.id)) back.unshift(j);
    else settle(j.key, false);
  }
  queue.unshift(...back);
  for (const f of KIT_FAMILIES) if (kit.get().sample[f] === key) for (const id of shotsOf(f)) prime(id);
  pump();
});

/** Un echantillon en echec : le repli de ceux qui l'attendaient se calcule tout de suite (l'ecoute qui l'attendait renonce). */
onSampleFailed((key) => {
  for (const j of waitSample) {
    if (j.tw.sample !== key) continue;
    settle(j.key, false);
    addFallback(j.id, j.tw, j.k, j.pk, j.sr, !!j.lock, true);
  }
  for (const f of KIT_FAMILIES) if (kit.get().sample[f] === key) for (const id of shotsOf(f)) prime(id);
});

/** Un PCM libere : le worker lache sa copie ; un sample retire de ce navigateur emporte aussi ses coups. */
onSampleDropped((key, gone) => {
  pcmSent.delete(key);
  if (worker) worker.postMessage({ drop: key });
  if (!gone) return;
  const tag = `|${key}~`;
  for (const [ck, b] of [...cache]) {
    if (!ck.includes(tag)) continue;
    cache.delete(ck);
    cacheBytes -= bytesOf(b);
  }
  for (let i = queue.length - 1; i >= 0; i -= 1) if (queue[i].tw.sample === key) queue.splice(i, 1);
  for (let i = waitSample.length - 1; i >= 0; i -= 1) {
    if (waitSample[i].tw.sample !== key) continue;
    settle(waitSample[i].key, false);
    waitSample.splice(i, 1);
  }
  for (const [id, p] of [...lastPlayed]) if (p.key.includes(tag)) lastPlayed.delete(id);
});

// Les samples que le kit joue ne quittent jamais la memoire (audio/samples.ts, son budget)
keepSample((key) => KIT_FAMILIES.some((f) => kit.get().sample[f] === key));

/** Ce que joue un coup (hors verrou, hors rendu hors ligne : retenu comme le son precedent de la voix). */
function play(id: ShotId, ov: ShotOverride | null, buf: AudioBuffer, pk: number, key: string, rate: number): ShotPlay {
  if (!ov) lastPlayed.set(id, { buf, pk, key });
  return { buf, rate };
}

export const shots = {
  /** Prepare tous les sons a STRETCH 0 (le contexte vient d'etre cree). */
  warm(sr: number): void {
    warmSr = sr;
    // Les echantillons choisis : telecharges tout de suite
    for (const f of KIT_FAMILIES) {
      const key = kit.get().sample[f];
      if (key) void loadSample(key);
    }
    const most = Math.max(...IDS.map((id) => variantsOf(id)));
    for (let v = 0; v < most; v += 1) for (const id of IDS) if (v < variantsOf(id)) enqueue(id, 0, v, sr);
  },
  /** Le prechauffage a 48 kHz, une fois, quand la page est calme (aucun AudioContext) ; jamais apres le vrai (2026-10-21). */
  prewarm(): void {
    if (prewarmed || typeof window === 'undefined') return;
    prewarmed = true;
    const go = (): void => {
      if (warmSr === 0) shots.warm(PREWARM_SR);
    };
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(go, { timeout: 3000 });
    else setTimeout(go, 1000);
  },
  /**
   * L'echantillon d'un coup : sa variante (au hasard, jamais la derniere),
   * son STRETCH, sa hauteur (pf, TONE). sync : jamais d'approximation
   * (rendu hors ligne). null : un son muet, ou rien de pret pour ce son (le
   * coup ne joue pas, son son passe en tete de file).
   */
  get(id: ShotId, ts: number, pf: number, sr: number, sync = false, ov: ShotOverride | null = null): ShotPlay | null {
    const tw = ov ? ov.tw : kit.tweak(id);
    // Un son muet (OFF, les deux couches a 0) : rien, jamais un autre son a sa place (2026-10-21)
    if (silentTweak(tw)) return null;
    // Un coup verrouille (2026-10-08) : la variante 0, la rotation des autres coups n'en sait rien
    let v = 0;
    if (!ov) {
      const n = variantsOf(id);
      v = n > 1 ? Math.floor(Math.random() * (n - 1)) : 0;
      if (n > 1 && v >= (lastVar.get(id) ?? -1)) v += 1;
      v = Math.min(n - 1, v);
      lastVar.set(id, v);
    }
    const k = shotKey(ts);
    const pk = pitchKey(pf);
    const sig = ov ? ov.sig : kit.sig(id);
    const key = cacheKey(id, k, v, sr, pk, sig);
    if (!ov && !sync) lastReq.set(id, { k, pk, sr });
    const hit = touch(key);
    if (hit) return sync ? { buf: hit, rate: 1 } : play(id, ov, hit, pk, key, 1);
    if (sync) {
      stats.sync += 1;
      const b = makeNow({ key, id, sr, k, ts: keyTs(k), v, pk, tw, sig });
      return b ? { buf: b, rate: 1 } : null;
    }
    // Le meme son deja calcule a une autre hauteur, un autre STRETCH, une autre variante ou frequence
    const near = nearest(id, sig, k, pk, v, sr);
    substitute(id);
    if (near) {
      stats.nearest += 1;
      enqueue(id, k, v, sr, pk, false, ov);
      return play(id, ov, near.buf, near.pk, key, pf / keyPf(near.pk));
    }
    // Rien de ce son : il passe en tete de file ; son echantillon pas encore la, ou en echec
    const smp = smpOf(tw);
    const have = !smp || !!samplePcm(smp);
    const failed = (!have && sampleStatus(smp).state === 'failed') || broken.has(key);
    enqueue(id, k, v, sr, pk, !failed, ov);
    let fb: (ShotPlay & { pk: number; key: string }) | null = null;
    if (!have || broken.has(key)) {
      if (!have && !failed) void loadSample(smp);
      const f = addFallback(id, tw, k, pk, sr, !!ov, true);
      const fk = cacheKey(id, k, 0, sr, pk, f.sig);
      const exact = touch(fk);
      const fnear = exact ? null : nearest(id, f.sig, k, pk, 0, sr);
      if (exact) fb = { buf: exact, rate: 1, pk, key: fk };
      else if (fnear) fb = { buf: fnear.buf, rate: pf / keyPf(fnear.pk), pk: fnear.pk, key: fk };
    }
    // Un sample en echec : son repli (l'ecran dit OFFLINE: 909 PLAYS)
    if (failed && fb) {
      stats.fallback += 1;
      return play(id, ov, fb.buf, fb.pk, fb.key, fb.rate);
    }
    // Sinon le son precedent de la voix (un sample en chargement, un reglage qui change), puis le repli
    const prev = lastPlayed.get(id);
    if (prev) {
      stats.previous += 1;
      return { buf: prev.buf, rate: pf / keyPf(prev.pk) };
    }
    if (fb) {
      stats.fallback += 1;
      return play(id, ov, fb.buf, fb.pk, fb.key, fb.rate);
    }
    stats.skipped += 1;
    return null;
  },
  /**
   * Un coup verrouille prepare a l'avance (2026-10-08, drums.ts prepareLocks) :
   * calcule en fond s'il manque, la variante 0 ; rien s'il est deja la. Son
   * echantillon en echec : son repli (2026-10-21).
   */
  prepare(id: ShotId, ts: number, pf: number, sr: number, ov: ShotOverride | null): void {
    const k = shotKey(ts);
    const pk = pitchKey(pf);
    enqueue(id, k, 0, sr, pk, false, ov);
    const tw = ov ? ov.tw : kit.tweak(id);
    const smp = smpOf(tw);
    if (smp && !samplePcm(smp) && sampleStatus(smp).state === 'failed') addFallback(id, tw, k, pk, sr, !!ov, false);
  },
  /**
   * Ce coup exact, demande en tete de file (2026-10-21, audit RS-2 : l'ecoute a l'arret partait avant lui et jouait le
   * plus ancien coup de la voix, le kick par defaut) : true quand il est pret, false au bout de ms ou s'il ne peut
   * pas l'etre. Un echantillon en echec : son repli est le coup exact (ce que la voix joue).
   */
  whenReady(id: ShotId, ts: number, pf: number, sr: number, ov: ShotOverride | null, ms = 1500): Promise<boolean> {
    if (!(sr > 0) || typeof window === 'undefined') return Promise.resolve(false);
    const tw = ov ? ov.tw : kit.tweak(id);
    if (silentTweak(tw)) return Promise.resolve(true);
    const k = shotKey(ts);
    const pk = pitchKey(pf);
    const smp = smpOf(tw);
    const missing = !!smp && !samplePcm(smp);
    const fb = missing && sampleStatus(smp).state === 'failed' ? synthFallback(id, tw) : null;
    const spec: JobSpec = fb
      ? { id, k, v: 0, sr, pk, tw: fb.tw, sig: fb.sig, fb: true, ...(ov ? { lock: true } : {}) }
      : { id, k, v: 0, sr, pk, tw, sig: ov ? ov.sig : kit.sig(id), ...(ov ? { lock: true } : {}) };
    const key = cacheKey(id, k, 0, sr, pk, spec.sig);
    if (cache.has(key)) return Promise.resolve(true);
    if (broken.has(key)) return Promise.resolve(false);
    return new Promise((resolve) => {
      let done = false;
      const fin = (ok: boolean): void => {
        if (done) return;
        done = true;
        window.clearTimeout(timer);
        const w = waiters.get(key);
        if (w) {
          const i = w.indexOf(fin);
          if (i >= 0) w.splice(i, 1);
          if (w.length === 0) waiters.delete(key);
        }
        resolve(ok);
      };
      const timer = window.setTimeout(() => fin(false), ms);
      const list = waiters.get(key) ?? [];
      list.push(fin);
      waiters.set(key, list);
      addJob(spec, true);
      if (missing && !fb) void loadSample(smp);
    });
  },
  /** Un echantillon aux deux canaux differents (un sample stereo, revue de R2) ? */
  isStereo(b: AudioBuffer): boolean {
    return stereoBufs.has(b);
  },
  /** Ce coup est-il deja calcule (tests : un verrou prepare a l'avance) ? */
  ready(id: ShotId, ts: number, pf: number, sr: number, ov: ShotOverride | null): boolean {
    return cache.has(cacheKey(id, shotKey(ts), 0, sr, pitchKey(pf), ov ? ov.sig : kit.sig(id)));
  },
  /** La rotation des variantes repart du debut (rendus hors ligne reproductibles). */
  resetRotation(): void {
    lastVar.clear();
  },
  /** Un coup qui manquait vient d'arriver pour une voix qui jouait un remplacant (l'horloge reprogramme, audio/clock.ts). */
  onReady(fn: () => void): () => void {
    readyFns.add(fn);
    return () => {
      readyFns.delete(fn);
    };
  },
  info: () => ({
    ...stats,
    cached: cache.size,
    bytes: cacheBytes,
    queued: queue.length + (busy ? 1 : 0),
    waiting: waitSample.length,
    broken: broken.size,
    worker: worker === undefined ? 'idle' : worker ? 'on' : 'off',
  }),
};
