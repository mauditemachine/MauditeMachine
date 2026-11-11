/**
 * L'echelle des couches HTML du plugin MM-ARP (2026-11-11, Mika : "je ne peux plus agrandir le plugin comme je veux") :
 * la fenetre du VST3 se redimensionne a proportions fixes (880 a 2200 px de large environ). La scene 3D se recadre
 * seule (scene/renderer.ts) ; les couches HTML (le panneau du capot, les dialogues, la pastille MIDI LEARN, la carte
 * INFOS) sont dessinees pour une fenetre de UI_W px de large et mises a l'echelle : largeur de la fenetre / UI_W. Le
 * panneau du capot fait donc toujours 1100 px de large dans son repere, quelle que soit la WebView : rien n'y deborde.
 * Hors du plugin MM-ARP : toujours 1 (le site ne change pas).
 */
import { PLUGIN_ARP } from '../../theme/base';

/** La largeur de dessin des couches HTML (la fenetre d'origine du plugin : 1100 x 704). */
export const UI_W = 1100;

const read = (): number => {
  if (!PLUGIN_ARP || typeof window === 'undefined') return 1;
  const w = window.innerWidth || document.documentElement.clientWidth || UI_W;
  // Au millieme : une valeur stable pour React, des textes nets
  return Math.max(0.25, Math.round((w / UI_W) * 1000) / 1000);
};

let scale = read();
const listeners = new Set<() => void>();
if (PLUGIN_ARP && typeof window !== 'undefined') {
  window.addEventListener('resize', () => {
    const next = read();
    if (next === scale) return;
    scale = next;
    for (const fn of [...listeners]) fn();
  });
}

export const uiScale = {
  get: (): number => scale,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
