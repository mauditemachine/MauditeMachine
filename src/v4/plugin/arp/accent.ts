/**
 * v27 : la couleur d'accent du plugin (theme/base.ts PLUGIN_ACCENT, un seul jeton) posee en variable CSS pour
 * OPEN et la face (--mm-accent, --mm-accent-ink sur les fonds clairs). Les LED restent rouges.
 */
import { PLUGIN_ACCENT, PLUGIN_ACCENT_INK } from '../../theme/base';

export const MM_ACCENT = PLUGIN_ACCENT;
export const MM_ACCENT_INK = PLUGIN_ACCENT_INK;
if (typeof document !== 'undefined') {
  document.documentElement.style.setProperty('--mm-accent', MM_ACCENT);
  document.documentElement.style.setProperty('--mm-accent-ink', MM_ACCENT_INK);
}
