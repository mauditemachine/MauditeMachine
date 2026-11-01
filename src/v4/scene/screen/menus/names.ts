/**
 * Le nom des patterns (V.6.0, lane B5, 2026-11-01, cahier dt2 3.11 : SETTINGS > PATTERN > RENAME) : l'en-tete de l'ecran
 * le montre apres la case A01, comme la DT2. Les 128 emplacements (state/patterns.ts) n'ont pas encore de nom a eux : il
 * vit ici, a part (cle NAMES_KEY, un objet { "<emplacement>": "NOM" }), lu et ecrit seul ; un retour arriere l'ignore.
 * V.6.2 (lane D1) le range dans le pattern du projet. 8 caracteres au plus, capitales, chiffres et quelques signes.
 */

export const NAMES_KEY = 'mm.v4.rytm.ptnNames.1';
export const NAME_MAX = 8;
/** Les caracteres de l'ecran de nommage, dans l'ordre de UP / DOWN (l'espace d'abord). */
export const NAME_CHARS = ' ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789-+&!?#';

let names: Record<string, string> | null = null;
const listeners = new Set<() => void>();

function load(): Record<string, string> {
  if (names) return names;
  names = {};
  try {
    const raw = typeof window === 'undefined' ? null : window.localStorage.getItem(NAMES_KEY);
    const o = raw ? (JSON.parse(raw) as unknown) : null;
    if (o && typeof o === 'object') for (const [k, v] of Object.entries(o as Record<string, unknown>)) if (/^\d{1,3}$/.test(k) && typeof v === 'string') names[k] = clean(v);
  } catch {
    names = {};
  }
  return names;
}

/** Un nom propre : capitales, les caracteres de l'ecran, 8 au plus, sans espaces au bout. */
export function clean(s: string): string {
  return [...s.toUpperCase()]
    .filter((c) => NAME_CHARS.includes(c))
    .join('')
    .slice(0, NAME_MAX)
    .trim();
}

/** Le nom d'un emplacement (0 a 127) ; '' : aucun. */
export function patternName(slot: number): string {
  return load()[String(slot)] ?? '';
}

/** Nomme un emplacement ('' : retire le nom). */
export function setPatternName(slot: number, name: string): void {
  const n = load();
  const c = clean(name);
  if ((n[String(slot)] ?? '') === c) return;
  if (c) n[String(slot)] = c;
  else delete n[String(slot)];
  try {
    window.localStorage.setItem(NAMES_KEY, JSON.stringify(n));
  } catch {
    // Le stockage plein ou refuse : le nom reste pour la visite
  }
  listeners.forEach((fn) => fn());
}

export function subscribeNames(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}
