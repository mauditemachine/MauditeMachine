/**
 * L'etat garde par le plugin (2026-11-08, plugin/mm-rytm) : AVANT tout module de la machine (les stores du site lisent le
 * localStorage a leur chargement), les cles mm.v4.* que le plugin a gardees dans le projet Ableton deviennent le
 * localStorage du site. Les autres cles mm.v4.* partent : deux instances du plugin partagent le stockage de la WebView,
 * chacune repart de son propre etat. Aucune dependance : plugin/main.tsx l'appelle avant d'importer la face.
 */

export const STATE_PREFIX = 'mm.v4.';

export function restoreState(): boolean {
  if (typeof window === 'undefined') return false;
  const init = (window as unknown as { __JUCE__?: { initialisationData?: Record<string, unknown[]> } }).__JUCE__?.initialisationData;
  const raw = init?.mmState?.[0];
  if (typeof raw !== 'string' || raw.length === 0) return false;
  try {
    const st = JSON.parse(raw) as { ls?: Record<string, unknown> };
    if (!st.ls || typeof st.ls !== 'object') return false;
    const old: string[] = [];
    for (let i = 0; i < window.localStorage.length; i += 1) {
      const k = window.localStorage.key(i);
      if (k && k.startsWith(STATE_PREFIX)) old.push(k);
    }
    for (const k of old) window.localStorage.removeItem(k);
    for (const [k, v] of Object.entries(st.ls)) if (k.startsWith(STATE_PREFIX) && typeof v === 'string') window.localStorage.setItem(k, v);
    return true;
  } catch {
    return false;
  }
}
