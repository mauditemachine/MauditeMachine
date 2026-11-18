/**
 * La couleur d'accent du plugin (theme/base.ts PLUGIN_ACCENT, #FF0066 au depart) posee en variables CSS pour OPEN et la
 * face (--mm-accent, --mm-accent-ink sur les fonds clairs). Les LED restent rouges.
 * v31 (2026-11-18, Mika : "un crossfader dans les settings avec des couleurs de cette tranche de luminosite") : la teinte
 * se regle (look.ts hue, le curseur ACCENT COLOR) ; la saturation et la luminosite restent celles de #FF0066 (TSV 100 %,
 * 100 %), toute la roue des teintes vives. applyAccent pose la couleur partout : variables CSS, serigraphie et pads de la
 * face (theme.ts setPluginAccent ; la scene se redessine, LookPanel.tsx FaceLook).
 */
import { PLUGIN_ACCENT, PLUGIN_ACCENT_INK } from '../../theme/base';
import { setPluginAccent } from '../../theme';

export const MM_ACCENT = PLUGIN_ACCENT;
export const MM_ACCENT_INK = PLUGIN_ACCENT_INK;

/** La teinte de #FF0066 (degres) : le reglage de depart. */
export const ACCENT_HUE_DEFAULT = 336;

/** TSV (teinte en degres, saturation 1, valeur v) vers #RRGGBB. */
export function hsvHex(hue: number, v = 1): string {
  const h = (((hue % 360) + 360) % 360) / 60;
  const f = (n: number): number => {
    const k = (n + h) % 6;
    return v - v * Math.max(0, Math.min(k, 4 - k, 1));
  };
  const to = (x: number): string => Math.round(x * 255).toString(16).padStart(2, '0');
  return `#${to(f(5))}${to(f(3))}${to(f(1))}`.toUpperCase();
}

/** La couleur d'accent d'une teinte, et son encre (la meme, assombrie, pour les fonds clairs). */
export const accentOfHue = (hue: number): string => hsvHex(hue, 1);
export const inkOfHue = (hue: number): string => hsvHex(hue, 0.64);

let current = '';
let gen = 0;

/** Pose la couleur d'une teinte partout ; true si elle a change. accentGen() avance a chaque changement. */
export function applyAccent(hue: number): boolean {
  const hex = accentOfHue(hue);
  if (hex === current) return false;
  current = hex;
  gen += 1;
  if (typeof document !== 'undefined') {
    document.documentElement.style.setProperty('--mm-accent', hex);
    document.documentElement.style.setProperty('--mm-accent-ink', inkOfHue(hue));
  }
  setPluginAccent(hex);
  return true;
}

/** Le numero du dernier changement de couleur (la scene compare le sien). */
export const accentGen = (): number => gen;

applyAccent(ACCENT_HUE_DEFAULT);
