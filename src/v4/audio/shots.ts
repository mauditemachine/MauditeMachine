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
 */

import { KIT_FAMILIES, familyOf, kit, shotsOf } from './kit';
import { loadSample, onSampleLoaded, samplePcm } from './samples';
import { renderLayers, VARIANTS, type ShotId, type ShotTweak } from './shotsdsp';

export type { ShotId } from './shotsdsp';

/** STRETCH arrondi au huitieme de facteur 4 : la cle d'un echantillon. */
export const shotKey = (ts: number): number => Math.max(-11, Math.min(10, Math.round((Math.log(ts) / Math.log(4)) * 8)));
const keyTs = (k: number): number => Math.pow(4, k / 8);
/** TONE en milliemes de demi-ton : la hauteur d'un echantillon. */
export const pitchKey = (pf: number): number => Math.round(Math.log2(pf) * 12000);
const keyPf = (pk: number): number => Math.pow(2, pk / 12000);

const MAX_ENTRIES = 160;
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
  ts: number;
  v: number;
  /** hauteur (milliemes de demi-ton) : le calcul se fait a sr / pf */
  pk: number;
  /** le kit du moment pour ce son (audio/kit.ts), et sa signature dans la cle */
  tw: ShotTweak;
  sig: string;
  /** un coup verrouille (2026-10-08) : jamais purge par un reglage du kit */
  lock?: boolean;
}

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
const queue: Job[] = [];
/** La commande en cours dans le worker (une a la fois). */
let busy: Job | null = null;
/** undefined : pas encore essaye ; null : pas de worker (calcul sur le fil principal). */
let worker: Worker | null | undefined;
const stats = { rendered: 0, ms: 0, sync: 0, nearest: 0, inWorker: 0, skipped: 0 };
/** La derniere variante jouee de chaque son. */
const lastVar = new Map<ShotId, number>();

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

/** Les echantillons dont les deux canaux different (un sample stereo) : le PAN d'un coup les garde stereo (drums.ts). */
const stereoBufs = new WeakSet<AudioBuffer>();

function toBuffer(L: Float32Array, R: Float32Array | null, sr: number): AudioBuffer {
  const b = new AudioBuffer({ length: L.length, numberOfChannels: 2, sampleRate: sr });
  b.copyToChannel(L, 0);
  b.copyToChannel(R ?? L, 1);
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

function put(key: string, b: AudioBuffer): void {
  cache.delete(key);
  cache.set(key, b);
  while (cache.size > MAX_ENTRIES) {
    const first = cache.keys().next().value;
    if (first === undefined) break;
    cache.delete(first);
  }
}

/**
 * Calcul sur le fil principal (sans worker, ou un coup qui ne peut pas
 * attendre : le rendu hors ligne). Un echantillon pas encore telecharge : la
 * couche SYNTH seule, au moins a son niveau plein (le son calcule de la voix
 * le remplace en attendant, 2026-10-05), non gardee (le bon la remplacera).
 */
function makeNow(j: Job): AudioBuffer {
  const t0 = performance.now();
  const pcm = j.tw.sample ? samplePcm(j.tw.sample) : undefined;
  const missing = !!j.tw.sample && !pcm;
  const tw: ShotTweak = missing ? { ...j.tw, sample: undefined, syn: Math.max(j.tw.syn ?? 1, 1) } : j.tw;
  const s = renderLayers(j.id, j.sr / keyPf(j.pk), j.ts, j.v, tw, pcm);
  const b = toBuffer(s.L, s.L === s.R ? null : s.R, j.sr);
  stats.ms += performance.now() - t0;
  stats.rendered += 1;
  if (!missing) put(j.key, b);
  else void loadSample(j.tw.sample as string);
  return b;
}

/** Les echantillons deja envoyes au worker (il les garde) ; un nouveau worker repart de rien. */
let pcmSent = new Set<string>();

function onDone(e: MessageEvent<{ key: string; L: Float32Array; R: Float32Array | null; ms: number; missing?: boolean }>): void {
  const d = e.data;
  const j = busy;
  busy = null;
  // Le worker n'avait pas l'echantillon (jamais : il part avec la commande) : il le recevra avec la prochaine
  if (d.missing) {
    if (j?.tw.sample) pcmSent.delete(j.tw.sample);
    pump();
    return;
  }
  if (j && j.key === d.key && !cache.has(d.key)) {
    put(d.key, toBuffer(d.L, d.R, j.sr));
    stats.rendered += 1;
    stats.inWorker += 1;
    stats.ms += d.ms;
  }
  pump();
}

function getWorker(): Worker | null {
  if (worker !== undefined) return worker;
  try {
    const w = new Worker(new URL('./shots.worker.ts', import.meta.url), { type: 'module' });
    w.onmessage = onDone;
    w.onerror = () => {
      // Le worker ne demarre pas (ou plante) : tout se calcule sur le fil principal
      w.terminate();
      worker = null;
      pcmSent = new Set();
      const j = busy;
      busy = null;
      if (j) queue.unshift(j);
      pump();
    };
    worker = w;
  } catch {
    worker = null;
  }
  return worker;
}

/** Les calculs verrouilles qui attendent leur echantillon (2026-10-08) : repris a son arrivee. */
const waitSample: Job[] = [];

function pump(): void {
  if (busy) return;
  let j = queue.shift();
  while (j && cache.has(j.key)) j = queue.shift();
  if (!j) return;
  // Un echantillon : sur le fil principal, une fois telecharge (son arrivee relance le calcul)
  if (j.tw.sample && !samplePcm(j.tw.sample)) {
    void loadSample(j.tw.sample);
    // Un son verrouille : le kit ne le relancera pas, il attend ici son fichier
    const key = j.key;
    if (j.lock && !waitSample.some((w) => w.key === key)) waitSample.push(j);
    pump();
    return;
  }
  const w = getWorker();
  busy = j;
  if (w) {
    // Le worker calcule a la frequence de rendu (sr / pf) ; le buffer gardera sr. L'echantillon de la couche
    // SAMPLE part avec la premiere commande qui en a besoin (une copie : le fil principal garde le sien)
    const key = j.tw.sample;
    const pcm = key && !pcmSent.has(key) ? samplePcm(key) : undefined;
    if (key && pcm) pcmSent.add(key);
    w.postMessage({ key: j.key, id: j.id, sr: j.sr / keyPf(j.pk), ts: j.ts, v: j.v, tw: j.tw, ...(pcm && key ? { pcm: { key, L: pcm.L, R: pcm.R, sr: pcm.sr } } : {}) });
    return;
  }
  setTimeout(() => {
    const cur = busy;
    busy = null;
    if (cur && !cache.has(cur.key)) makeNow(cur);
    pump();
  }, 0);
}

function enqueue(id: ShotId, k: number, v: number, sr: number, pk = 0, first = false, ov: ShotOverride | null = null): void {
  const sig = ov ? ov.sig : kit.sig(id);
  const key = cacheKey(id, k, v, sr, pk, sig);
  if (cache.has(key) || busy?.key === key) return;
  const at = queue.findIndex((j) => j.key === key);
  if (at >= 0) {
    // Deja en file : en tete si un coup l'attend
    if (first && at > 0) queue.unshift(...queue.splice(at, 1));
    return;
  }
  // Un reglage du kit tourne : les calculs en attente d'un reglage depasse de ce son ne servent plus
  // (ni ceux des verrous, 2026-10-08 : ils ne suivent pas le son du kit, gotcha 4 de l'etude)
  if (!ov) for (let i = queue.length - 1; i >= 0; i -= 1) if (queue[i].id === id && queue[i].sig !== sig && !queue[i].lock) queue.splice(i, 1);
  const job: Job = { key, id, sr, ts: keyTs(k), v, pk, tw: ov ? ov.tw : kit.tweak(id), sig, ...(ov ? { lock: true } : {}) };
  if (first) queue.unshift(job);
  else queue.push(job);
  pump();
}

/** La frequence des derniers sons prepares (celle du contexte), pour recalculer ceux qu'un TWEAK change. */
let warmSr = 0;
let rewarmTimer = 0;
const rewarmIds = new Set<ShotId>();

/**
 * Un TWEAK du kit tourne (audio/kit.ts) : ses sons se recalculent en fond,
 * a STRETCH 0 et hauteur d'origine (le cas courant), une fois le geste
 * pose (120 ms) ; un coup qui arrive avant joue le plus proche deja pret.
 */
kit.subscribe((changed) => {
  for (const f of changed) for (const id of shotsOf(f)) rewarmIds.add(id);
  if (typeof window === 'undefined' || warmSr === 0) return;
  window.clearTimeout(rewarmTimer);
  rewarmTimer = window.setTimeout(() => {
    for (const id of rewarmIds) for (let v = 0; v < variantsOf(id); v += 1) enqueue(id, 0, v, warmSr);
    rewarmIds.clear();
  }, 120);
});

/** Un echantillon telecharge : les voix qui le jouent se recalculent (a STRETCH 0, la variante 0). */
onSampleLoaded((key) => {
  // Les sons verrouilles qui l'attendaient (2026-10-08)
  for (let i = waitSample.length - 1; i >= 0; i -= 1) {
    const j = waitSample[i];
    if (j.tw.sample !== key) continue;
    waitSample.splice(i, 1);
    if (!cache.has(j.key) && !queue.some((q) => q.key === j.key)) queue.push(j);
  }
  pump();
  if (warmSr === 0) return;
  for (const f of KIT_FAMILIES) if (kit.get().sample[f] === key) for (const id of shotsOf(f)) enqueue(id, 0, 0, warmSr);
});

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
  /** Le prechauffage a 48 kHz, une fois, quand la page est calme (aucun AudioContext). */
  prewarm(): void {
    if (prewarmed || typeof window === 'undefined') return;
    prewarmed = true;
    const go = (): void => shots.warm(PREWARM_SR);
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    if (ric) ric(go, { timeout: 3000 });
    else setTimeout(go, 1000);
  },
  /**
   * L'echantillon d'un coup : sa variante (au hasard, jamais la derniere),
   * son STRETCH, sa hauteur (pf, TONE). sync : jamais d'approximation
   * (rendu hors ligne), jamais null. Sans sync, null quand ce son n'a encore
   * rien de pret (le coup ne joue pas, son son passe en tete de file).
   */
  get(id: ShotId, ts: number, pf: number, sr: number, sync = false, ov: ShotOverride | null = null): ShotPlay | null {
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
    const hit = cache.get(key);
    if (hit) return { buf: hit, rate: 1 };
    if (!sync) {
      // Le plus proche : STRETCH voisin (1 par cran), hauteur (2 par demi-ton), autre reglage du kit (+20), autre frequence (+30), autre variante (+60)
      let best: AudioBuffer | null = null;
      let bestPk = 0;
      let score = Infinity;
      const pre = `${id}|`;
      for (const [ck, b] of cache) {
        if (!ck.startsWith(pre)) continue;
        const [, kk, vv, ss, pp, sg] = ck.split('|');
        const sc = Math.abs(Number(kk) - k) + Math.abs(Number(pp) - pk) / 500 + (sg === sig ? 0 : 20) + (Number(ss) === sr ? 0 : 30) + (Number(vv) === v ? 0 : 60);
        if (sc < score) {
          best = b;
          bestPk = Number(pp);
          score = sc;
        }
      }
      if (best) {
        stats.nearest += 1;
        enqueue(id, k, v, sr, pk, false, ov);
        return { buf: best, rate: pf / keyPf(bestPk) };
      }
      stats.skipped += 1;
      enqueue(id, k, v, sr, pk, true, ov);
      return null;
    }
    stats.sync += 1;
    return { buf: makeNow({ key, id, sr, ts: keyTs(k), v, pk, tw: ov ? ov.tw : kit.tweak(id), sig }), rate: 1 };
  },
  /**
   * Un coup verrouille prepare a l'avance (2026-10-08, drums.ts prepareLocks) :
   * calcule en fond s'il manque, la variante 0 ; rien s'il est deja la.
   */
  prepare(id: ShotId, ts: number, pf: number, sr: number, ov: ShotOverride | null): void {
    enqueue(id, shotKey(ts), 0, sr, pitchKey(pf), false, ov);
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
  info: () => ({ ...stats, cached: cache.size, queued: queue.length + (busy ? 1 : 0), worker: worker === undefined ? 'idle' : worker ? 'on' : 'off' }),
};
