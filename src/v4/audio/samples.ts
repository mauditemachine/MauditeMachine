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
import { decodeAudio, userSamples } from './usersamples';

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

/** Le nom court d'un fichier : sans extension, numero, "AT", ni le nom de la famille. */
export function sampleLabel(file: string): string {
  let t = file.replace(/\.[a-z0-9]+$/i, '').replace(/_/g, ' ');
  t = t.replace(/^\s*\d+\s*[-.]?\s+/, '');
  t = t.replace(/^AT\s+/i, '');
  t = t.replace(/\b(master\s+)?(kicks?|snares?|claps?|hats?|hihats?|toms?|rims?|cymbals?|cyms?)\b/gi, ' ');
  t = t.replace(/(master\s+)?(kicks?|snares?)(?=\d)/gi, ' ');
  t = t.replace(/^\s*(BD|SD|CP|HH|CH|OH|HT|CY|RS)\s+/i, '');
  t = t.replace(/\s+-\s+/g, ' ').replace(/\s-\s*$/, '').replace(/\s+/g, ' ').trim();
  return (t || file).toUpperCase().slice(0, 18);
}

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

const pcm = new Map<string, SamplePcm>();
const pending = new Map<string, Promise<SamplePcm | null>>();
const failed = new Set<string>();
const listeners = new Set<(key: string) => void>();

/** L'echantillon decode, s'il est la. */
export const samplePcm = (key: string): SamplePcm | undefined => pcm.get(key);

/**
 * Telecharge et decode un echantillon (une fois) ; ses abonnes l'apprennent.
 * Un sample de ce navigateur vient de IndexedDB (audio/usersamples.ts), deja
 * decode s'il vient d'etre ajoute.
 */
export function loadSample(key: string): Promise<SamplePcm | null> {
  const hit = pcm.get(key);
  if (hit) return Promise.resolve(hit);
  const p = pending.get(key);
  if (p) return p;
  const s = sampleByKey(key);
  if (!s || failed.has(key) || typeof window === 'undefined') return Promise.resolve(null);
  const job = (async (): Promise<SamplePcm | null> => {
    try {
      let out: SamplePcm | undefined = s.user ? userSamples.takePcm(key) : undefined;
      if (!out) {
        let data: ArrayBuffer | null;
        if (s.user) data = await userSamples.bytes(key);
        else {
          const res = await fetch(s.url);
          if (!res.ok) throw new Error(`HTTP ${res.status}`);
          data = await res.arrayBuffer();
        }
        if (!data) throw new Error('gone');
        out = await decodeAudio(data);
      }
      pcm.set(key, out);
      listeners.forEach((fn) => fn(key));
      return out;
    } catch {
      // Un fichier illisible (ou parti de ce navigateur) : sa voix garde son son calcule
      failed.add(key);
      return null;
    } finally {
      pending.delete(key);
    }
  })();
  pending.set(key, job);
  return job;
}

/** Un echantillon vient d'etre decode. */
export function onSampleLoaded(fn: (key: string) => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

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
