/**
 * Les reglages d'aspect du plugin MM-ARP (2026-11-16, Mika : "un parametre dans les settings pour attenuer le cuir") :
 * - leather : la texture du cuir, 0 (la laque lisse d'avant) a 1 (le cuir du fond de Legend HZ, v35) ; 1 au depart ;
 * - light : la lumiere du panneau, 0 a 1 (0.5 : neutre) ;
 * - hue (v31, 2026-11-18) : la teinte de la couleur d'accent, en degres (336 : #FF0066), a saturation et luminosite fixes
 *   (accent.ts).
 * Ni potard ni parametre de l'hote (rien d'automatisable) : gardes dans le localStorage sous mm.v4.plugin.arp.look, une
 * cle mm.v4.* qui part dans l'etat du projet (bridge.ts) et revient au chargement (plugin/restore.ts). La face 3D les
 * applique (LookPanel.tsx FaceLook), OPEN par deux variables CSS (--mm-leather, --mm-light) posees ici sur la racine.
 */

import { setLeatherPhoto } from '../../voyager/leather';
import { ACCENT_HUE_DEFAULT, applyAccent } from './accent';
import leatherUrl from './retro/leather.png';

// v35 : la photo du cuir de la face 3D (la meme image que les pages d'OPEN, hood.css) ; le plugin seul la charge
setLeatherPhoto(leatherUrl);

export const LOOK_STORAGE_KEY = 'mm.v4.plugin.arp.look';

export interface Look {
  leather: number;
  light: number;
  hue: number;
}

export const LOOK_DEFAULTS: Look = { leather: 1, light: 0.5, hue: ACCENT_HUE_DEFAULT };
/** La version des reglages gardes : 2 depuis le cuir en photo (v35) ; un reglage d'avant reprend le cuir de depart. */
const LOOK_VERSION = 2;

/** Borne a 0..1, au centieme (le curseur montre 0 a 100). */
const clamp = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? Math.round(Math.min(1, Math.max(0, v)) * 100) / 100 : d);
/** Une teinte en degres entiers, 0 a 359. */
const clampHue = (v: unknown, d: number): number => (typeof v === 'number' && Number.isFinite(v) ? ((Math.round(v) % 360) + 360) % 360 : d);

function load(): Look {
  try {
    const raw = JSON.parse(window.localStorage.getItem(LOOK_STORAGE_KEY) ?? 'null') as (Partial<Look> & { v?: number }) | null;
    if (raw && typeof raw === 'object') {
      // un reglage d'avant la v35 dosait l'ancien grain (0.45 ou 0.7) : il reprend le cuir de depart, le reste est garde
      const old = !(typeof raw.v === 'number' && raw.v >= LOOK_VERSION);
      return { leather: old ? LOOK_DEFAULTS.leather : clamp(raw.leather, LOOK_DEFAULTS.leather), light: clamp(raw.light, LOOK_DEFAULTS.light), hue: clampHue(raw.hue, LOOK_DEFAULTS.hue) };
    }
  } catch {
    /* illisible : les valeurs de depart */
  }
  return { ...LOOK_DEFAULTS };
}

let state: Look = typeof window === 'undefined' ? { ...LOOK_DEFAULTS } : load();
const listeners = new Set<() => void>();

function applyCss(): void {
  if (typeof document === 'undefined') return;
  const r = document.documentElement.style;
  r.setProperty('--mm-leather', state.leather.toFixed(3));
  r.setProperty('--mm-light', state.light.toFixed(3));
  applyAccent(state.hue);
}
applyCss();

function save(): void {
  try {
    window.localStorage.setItem(LOOK_STORAGE_KEY, JSON.stringify({ v: LOOK_VERSION, ...state }));
  } catch {
    /* stockage refuse : le reglage dure le temps de la fenetre */
  }
}

export const look = {
  get: (): Look => state,
  set(next: Partial<Look>): void {
    const s = {
      leather: clamp(next.leather ?? state.leather, state.leather),
      light: clamp(next.light ?? state.light, state.light),
      hue: clampHue(next.hue ?? state.hue, state.hue),
    };
    if (s.leather === state.leather && s.light === state.light && s.hue === state.hue) return;
    state = s;
    save();
    applyCss();
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
