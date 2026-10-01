/**
 * Le press kit en popup (2026-09-30) : ouvert ou non, et sa langue. La
 * langue part de celle du navigateur (francais ou espagnol s'il les
 * prefere, l'anglais sinon), les boutons EN, FR, ES la changent. Rien
 * n'est persiste.
 */

export type KitLang = 'en' | 'fr' | 'es';

export const KIT_LANGS: readonly KitLang[] = ['en', 'fr', 'es'];

/** La premiere langue du navigateur parmi en, fr, es ; l'anglais par defaut. */
export function browserKitLang(): KitLang {
  if (typeof navigator === 'undefined') return 'en';
  const list = navigator.languages?.length ? navigator.languages : [navigator.language];
  for (const l of list) {
    const p = (l || '').toLowerCase().slice(0, 2);
    if (p === 'en' || p === 'fr' || p === 'es') return p;
  }
  return 'en';
}

interface KitState {
  open: boolean;
  lang: KitLang;
}

let state: KitState = { open: false, lang: 'en' };
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((l) => l());

export const presskit = {
  get: (): KitState => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Ouvre le popup dans la langue du navigateur (ou celle demandee). */
  open(lang: KitLang = browserKitLang()): void {
    state = { open: true, lang };
    emit();
  },
  close(): void {
    if (!state.open) return;
    state = { ...state, open: false };
    emit();
  },
  setLang(lang: KitLang): void {
    if (lang === state.lang) return;
    state = { ...state, lang };
    emit();
  },
};
