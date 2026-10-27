/**
 * Les scenes A et B du MM-RYTM (2026-10-27, la phase 2, Mika : "SCENE A, la fente du crossfader, SCENE B, comme un
 * Octatrack") : pur, sans import. Une scene est un jeu creux de valeurs : l'id ABSOLU d'une cible MIDI (rytm:enc:delay,
 * rytm:voice:SD:decay ; jamais rytm:knob:k ni p:k, resolus a l'enregistrement) vers sa valeur de 0 a 1 dans le domaine de
 * sa cible (le 0 a 1 du MIDI). Ce que le crossfader fait entendre : LA formule de Mika, morph01. Les deux bouts exacts :
 * x = 0 joue A (ou la base), x = 1 joue B (ou la base). Rien ici n'ecrit un store : audio/pattern.ts garde les scenes du
 * motif, state/patterns.ts et state/presets.ts les transportent.
 */

export type SceneId = 'a' | 'b';
export const SCENE_IDS: readonly SceneId[] = ['a', 'b'];
/** id absolu d'une cible -> sa valeur de 0 a 1 */
export type SceneMap = Readonly<Record<string, number>>;
export interface SceneSet {
  readonly a: SceneMap;
  readonly b: SceneMap;
}

const EMPTY: SceneMap = Object.freeze({}) as SceneMap;
/** Aucune scene : un seul objet gele (UNDO compare les identites). */
export const NO_SCENES: SceneSet = Object.freeze({ a: EMPTY, b: EMPTY });
/** La forme stockee des scenes. */
export const SCENE_V = 1;
/** Au plus 64 valeurs par scene : la 65e dit SCENE A FULL, rien n'est ecrit. */
export const SCENE_MAX_KEYS = 64;
export interface StoredScenes {
  v: 1;
  a?: Record<string, number>;
  b?: Record<string, number>;
}

/** LA formule (Mika) : a = A[p] ?? base, b = B[p] ?? base, v = a + (b - a) * x ; les deux bouts exacts. */
export function morph01(a: number | undefined, b: number | undefined, base: number, x: number): number {
  const va = a ?? base;
  const vb = b ?? base;
  return x <= 0 ? va : x >= 1 ? vb : va + (vb - va) * x;
}

/** Une valeur gardee : 0 a 1, au dix-millieme. */
export const sceneRound = (v: number): number => Math.round(Math.max(0, Math.min(1, v)) * 10000) / 10000;

/** Un id de cible du MM-RYTM bien forme (les inconnus restent, le morphing les ignore). */
const ID_RE = /^rytm:[a-z0-9]+(?::[A-Za-z0-9]+){1,3}$/;
export const isSceneKey = (id: unknown): id is string => typeof id === 'string' && id.length <= 64 && ID_RE.test(id);

/** Une scene lue (localStorage, un preset, l'UNDO) : propre, ou null ; jamais une exception. */
function cleanMap(raw: unknown, rename?: (id: string) => string): SceneMap | null {
  if (raw === undefined || raw === null) return EMPTY;
  if (typeof raw !== 'object' || Array.isArray(raw)) return null;
  const out: Record<string, number> = {};
  let n = 0;
  for (const [k0, v] of Object.entries(raw as Record<string, unknown>)) {
    if (n >= SCENE_MAX_KEYS) break;
    let k = k0;
    try {
      if (rename) k = rename(k0);
    } catch {
      k = k0;
    }
    if (!isSceneKey(k)) continue;
    if (typeof v !== 'number' || !Number.isFinite(v)) continue;
    out[k] = sceneRound(v);
    n += 1;
  }
  return n === 0 ? EMPTY : Object.freeze(out);
}

/**
 * Les scenes lues d'un stockage : { v: 1, a: {...}, b: {...} } (v absent accepte) ; les ids mal formes, les valeurs non
 * finies partent, les autres sont bornees a 0..1 et arrondies, au plus SCENE_MAX_KEYS par scene ; tout le reste : null.
 * Jamais une exception.
 */
export function cleanScenes(raw: unknown, rename?: (id: string) => string): SceneSet | null {
  try {
    if (raw === undefined || raw === null) return null;
    if (typeof raw !== 'object' || Array.isArray(raw)) return null;
    const r = raw as Record<string, unknown>;
    if (r.v !== undefined && r.v !== SCENE_V) return null;
    const a = cleanMap(r.a, rename);
    const b = cleanMap(r.b, rename);
    if (!a || !b) return null;
    return a === EMPTY && b === EMPTY ? NO_SCENES : Object.freeze({ a, b });
  } catch {
    return null;
  }
}

const sameMap = (x: SceneMap, y: SceneMap): boolean => {
  if (x === y) return true;
  const kx = Object.keys(x);
  if (kx.length !== Object.keys(y).length) return false;
  return kx.every((k) => y[k] === x[k]);
};
/** Les memes scenes (valeur pour valeur). */
export const sameScenes = (x: SceneSet, y: SceneSet): boolean => x === y || (sameMap(x.a, y.a) && sameMap(x.b, y.b));
/** Une scene au moins a une valeur. */
export const anyScenes = (s: SceneSet): boolean => Object.keys(s.a).length > 0 || Object.keys(s.b).length > 0;
/** Le nombre de valeurs d'une scene. */
export const sceneCount = (s: SceneSet, w: SceneId): number => Object.keys(s[w]).length;

/**
 * Une valeur ecrite dans une scene (arrondie) : les memes scenes (le meme objet) quand rien ne change, 'full' quand la
 * scene a deja SCENE_MAX_KEYS valeurs et que celle-ci est nouvelle.
 */
export function withScene(s: SceneSet, w: SceneId, id: string, v01: number): SceneSet | 'full' {
  if (!isSceneKey(id) || !Number.isFinite(v01)) return s;
  const v = sceneRound(v01);
  const m = s[w];
  if (m[id] === v) return s;
  if (m[id] === undefined && Object.keys(m).length >= SCENE_MAX_KEYS) return 'full';
  const next = Object.freeze({ ...m, [id]: v });
  return Object.freeze(w === 'a' ? { a: next, b: s.b } : { a: s.a, b: next });
}

/** Une valeur retiree d'une scene ; le meme objet si elle n'y etait pas. */
export function withoutScene(s: SceneSet, w: SceneId, id: string): SceneSet {
  const m = s[w];
  if (m[id] === undefined) return s;
  const { [id]: _gone, ...rest } = m;
  const next = Object.keys(rest).length === 0 ? EMPTY : Object.freeze(rest);
  const out = w === 'a' ? { a: next, b: s.b } : { a: s.a, b: next };
  return out.a === EMPTY && out.b === EMPTY ? NO_SCENES : Object.freeze(out);
}

/** Une scene videe ; le meme objet si elle l'etait. */
export function clearScene(s: SceneSet, w: SceneId): SceneSet {
  if (Object.keys(s[w]).length === 0) return s;
  const out = w === 'a' ? { a: EMPTY, b: s.b } : { a: s.a, b: EMPTY };
  return out.a === EMPTY && out.b === EMPTY ? NO_SCENES : Object.freeze(out);
}

/** La forme stockee (undefined sans scene : un motif sans scenes s'ecrit octet pour octet comme avant). */
export function toStored(s: SceneSet): StoredScenes | undefined {
  if (!anyScenes(s)) return undefined;
  const out: StoredScenes = { v: SCENE_V };
  if (Object.keys(s.a).length > 0) out.a = { ...s.a };
  if (Object.keys(s.b).length > 0) out.b = { ...s.b };
  return out;
}
