/**
 * L'etat garde par le plugin (2026-11-08, plugin/mm-rytm) : AVANT tout module de la machine (les stores du site lisent le
 * localStorage a leur chargement), les cles mm.v4.* que le plugin a gardees dans le projet Ableton deviennent le
 * localStorage du site. Aucune dependance : plugin/main.tsx (et plugin/arp/main.tsx) l'appelle avant d'importer la face.
 *
 * Un stockage PAR INSTANCE (2026-11-10, Mika : "j'ai des erreurs quand je load le plugin, ca part dans tous les sens") :
 * toutes les WebViews d'Ableton ont la meme origine (juce://juce.backend), donc le meme localStorage. Deux MM-RYTM, ou un
 * MM-RYTM et un MM-ARP, dans un projet : chacun effacait les cles des autres en se restaurant, lisait l'etat de l'autre au
 * chargement de ses modules (une B vide ouvrait avec la pattern de la A), gardait dans le projet les cles de l'autre et
 * recevait ses evenements 'storage'. Desormais window.localStorage est, dans la page du plugin, un stockage en memoire,
 * a elle seule, rempli par l'etat du projet ; le vrai stockage ne garde que la bibliotheque commune (SHARED : presets,
 * nom d'utilisateur, personnalisation, apparence) et les cles hors mm.v4.*. Les evenements 'storage' des autres pages
 * s'arretent ici, sauf une nouvelle valeur de la bibliotheque (un preset garde ailleurs apparait).
 */

export const STATE_PREFIX = 'mm.v4.';

/** La bibliotheque commune a tous les projets (le vrai stockage) : elle l'emporte sur la copie du projet. */
const SHARED: ReadonlySet<string> = new Set(['mm.v4.presets.1', 'mm.v4.presets.user.1', 'mm.v4.rytm.personalize.1', 'mm.v4.appearance']);
const own = (k: string): boolean => k.startsWith(STATE_PREFIX) && !SHARED.has(k);

/** A peu pres le plafond d'un navigateur (5 M caracteres) : le site sait ceder (presets.ts : l'UNDO laisse la place). */
const QUOTA = 5_000_000;

class InstanceStorage {
  private readonly m = new Map<string, string>();
  private size = 0;
  constructor(private readonly real: Storage | null) {}
  get length(): number {
    return this.m.size;
  }
  key(i: number): string | null {
    if (!(i >= 0 && i < this.m.size)) return null;
    let n = 0;
    for (const k of this.m.keys()) if (n++ === i) return k;
    return null;
  }
  getItem(k: string): string | null {
    const v = this.m.get(String(k));
    return v === undefined ? null : v;
  }
  /** Sans le vrai stockage (le remplissage). */
  seed(k: string, v: string): void {
    this.size += v.length + k.length - (this.m.has(k) ? (this.m.get(k) as string).length + k.length : 0);
    this.m.set(k, v);
  }
  setItem(key: string, value: string): void {
    const k = String(key);
    const v = String(value);
    const was = this.m.get(k);
    const next = this.size + v.length + k.length - (was === undefined ? 0 : was.length + k.length);
    if (next > QUOTA) throw new DOMException('MM-RYTM storage full', 'QuotaExceededError');
    this.size = next;
    this.m.set(k, v);
    if (!own(k) && this.real) this.real.setItem(k, v);
  }
  removeItem(key: string): void {
    const k = String(key);
    const was = this.m.get(k);
    if (was !== undefined) this.size -= was.length + k.length;
    this.m.delete(k);
    if (!own(k) && this.real) {
      try {
        this.real.removeItem(k);
      } catch {
        /* rien */
      }
    }
  }
  clear(): void {
    for (const k of [...this.m.keys()]) this.removeItem(k);
  }
}

/** L'ancienne facon (si la page refuse un autre localStorage) : l'etat du projet dans le vrai stockage. */
function restoreShared(ls: Record<string, unknown>): boolean {
  try {
    const old: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && own(k)) old.push(k);
    }
    for (const k of old) window.localStorage.removeItem(k);
    for (const [k, v] of Object.entries(ls)) if (own(k) && typeof v === 'string') window.localStorage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
}

export function restoreState(): boolean {
  if (typeof window === 'undefined') return false;
  const init = (window as unknown as { __JUCE__?: { initialisationData?: Record<string, unknown[]> } }).__JUCE__?.initialisationData;
  const raw = init?.mmState?.[0];
  let ls: Record<string, unknown> | null = null;
  if (typeof raw === 'string' && raw.length > 0) {
    try {
      const st = JSON.parse(raw) as { ls?: unknown };
      if (st && typeof st.ls === 'object' && st.ls !== null) ls = st.ls as Record<string, unknown>;
    } catch {
      ls = null;
    }
  }
  let real: Storage | null = null;
  try {
    real = window.localStorage;
  } catch {
    real = null;
  }
  const mem = new InstanceStorage(real);
  // 1) le projet : ses cles mm.v4.* (la bibliotheque aussi, si le vrai stockage ne l'a pas)
  if (ls) for (const [k, v] of Object.entries(ls)) if (k.startsWith(STATE_PREFIX) && typeof v === 'string') mem.seed(k, v);
  // 2) le vrai stockage : la bibliotheque (la plus recente) et les cles hors mm.v4.* ; jamais l'etat d'une autre instance
  if (real) {
    try {
      for (let i = 0; i < real.length; i += 1) {
        const k = real.key(i);
        if (!k || own(k)) continue;
        const v = real.getItem(k);
        if (v !== null) mem.seed(k, v);
      }
    } catch {
      /* stockage refuse : le projet seul */
    }
  }
  try {
    Object.defineProperty(window, 'localStorage', { configurable: true, enumerable: true, get: () => mem });
  } catch {
    /* rien : verifie juste dessous */
  }
  if ((window.localStorage as unknown) !== mem) return ls ? restoreShared(ls) : false;
  // Les ecritures des autres pages (autres instances, MM-ARP) : rien n'en passe, sauf une nouvelle valeur de la bibliotheque
  window.addEventListener(
    'storage',
    (e) => {
      if (e.storageArea !== real && e.storageArea !== null) return;
      if (e.key !== null && SHARED.has(e.key) && e.newValue !== null) {
        mem.seed(e.key, e.newValue);
        return;
      }
      e.stopImmediatePropagation();
    },
    true,
  );
  return ls !== null;
}
