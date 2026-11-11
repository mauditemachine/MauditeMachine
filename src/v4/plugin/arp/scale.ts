/**
 * L'echelle des couches HTML du plugin MM-ARP (2026-11-11, Mika : "je ne peux plus agrandir le plugin comme je veux") :
 * la fenetre du VST3 se redimensionne a proportions fixes (880 a 2200 px de large environ, 5 / 4 depuis le module avant). La scene 3D se recadre
 * seule (scene/renderer.ts) ; les couches HTML (le panneau du capot, les dialogues, la pastille MIDI LEARN, la carte
 * INFOS) sont dessinees pour une fenetre de UI_W px de large et mises a l'echelle : largeur de la fenetre / UI_W. Le
 * panneau du capot fait donc toujours 1100 px de large dans son repere, quelle que soit la WebView : rien n'y deborde.
 * Hors du plugin MM-ARP : toujours 1 (le site ne change pas).
 */
import { PLUGIN_ARP } from '../../theme/base';

/** La largeur de dessin des couches HTML (la fenetre du plugin par defaut : 1100 x 880). */
export const UI_W = 1100;
/**
 * La fenetre par defaut (2026-11-11, Mika : "agrandis la taille generale et place plus de choses sur le panneau avant") :
 * 1100 x 880, proportion 5 / 4 (1.25), a garder par le C++ (PluginEditor : kW 1100, kH 880, setFixedAspectRatio 1.25).
 * La face 3D garde ses 1100 x 704 en haut (FACE_H) ; dessous, le module d'extension toujours visible (FrontModule.tsx)
 * prend les 176 px qui restent (MODULE_H). 880 px de haut : tient sur un MacBook Pro 14 pouces (982 points) sous la
 * barre de titre d'Ableton.
 */
export const UI_H = 880;
/** La face 3D : la hauteur de la scene dans le repere de UI_W (64 % de la largeur de la fenetre, face.css .v4-stage). */
export const FACE_H = 704;
/** Le module d'extension de la face avant, sous la face 3D. */
export const MODULE_H = UI_H - FACE_H;
/** La proportion de la fenetre (largeur / hauteur). */
export const UI_ASPECT = UI_W / UI_H;

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
