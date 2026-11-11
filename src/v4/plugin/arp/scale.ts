/**
 * L'echelle des couches HTML du plugin MM-ARP (2026-11-11, Mika : "je ne peux plus agrandir le plugin comme je veux") :
 * la fenetre du VST3 se redimensionne a proportions fixes. La scene 3D se recadre seule (scene/renderer.ts) ; les couches
 * HTML (le bandeau, le rack, le sequenceur, le panneau d'OPEN, les dialogues) sont dessinees pour une fenetre de UI_W px
 * de large et mises a l'echelle : largeur de la fenetre / UI_W. Hors du plugin MM-ARP : toujours 1 (le site ne change pas).
 *
 * Le format large (2026-11-11, Mika : "carre c'est pas bon, essaie de faire un peu plus en largeur") : 1440 x 810,
 * proportion 16 / 9 (1.7778), a garder par le C++ (PluginEditor : kW 1440, kH 810, setFixedAspectRatio 16.0 / 9.0).
 * 1440 x 810 tient sur un MacBook Pro 14 pouces (1512 x 982 points) sous la barre de titre d'Ableton.
 *
 * Le plan de la fenetre, dans le repere de UI_W (face.css reprend ces cotes en vw pour la scene) :
 *
 *   0    20                              1036                 1420  1440
 *   +----+--------------------------------+--------------------+----+   0
 *   | j  |  BANDEAU (logo, afficheur, OPEN)                    | j  |
 *   | o  +--------------------------------+--------------------+ o  |  46
 *   | u  |                                |  RACK              | u  |
 *   | e  |  LA MACHINE 3D (1016 x 624)    |  OSC +, FILTER +,  | e  |
 *   |    |                                |  PHASER, FLANGER,  |    |
 *   |    +--------------------------------+  PUMP, CRUSH,      |    | 670
 *   |    |  STEP SEQUENCER (1016 x 140)   |  SPACE             |    |
 *   +----+--------------------------------+--------------------+----+ 810
 *
 * La machine 3D garde l'echelle de sa fenetre d'avant (1100 x 704 : chaque potard a la meme taille a l'ecran), rognee
 * de ses joues de bois (elles passent aux bords de la fenetre, en HTML) et de son en-tete serigraphie (il passe dans le
 * bandeau) : VIEW est la vue entiere de la scene, CROP ce qu'on en montre.
 */
import { PLUGIN_ARP } from '../../theme/base';

/** La largeur de dessin des couches HTML (la fenetre du plugin par defaut : 1440 x 810). */
export const UI_W = 1440;
export const UI_H = 810;
/** La proportion de la fenetre (largeur / hauteur) : 16 / 9. */
export const UI_ASPECT = UI_W / UI_H;
/** Les joues de noyer, aux deux bords de la fenetre. */
export const CHEEK_W = 20;
/** Le bandeau du haut. */
export const HEAD_H = 46;
/** La vue de la scene 3D (la machine entiere, joues comprises, cadree bord a bord : voyager/theme.ts VOY_PLUGIN_FACE). */
export const VIEW = { w: 1100, h: 704 } as const;
/** Ce qu'on montre de la vue : le capot entre les joues, des bandeaux de section au bord avant du plateau. */
export const CROP = { x: 42, y: 63, w: 1016, h: 624 } as const;
/** La machine dans la fenetre. */
export const FACE = { x: CHEEK_W, y: HEAD_H, w: CROP.w, h: CROP.h } as const;
/** Le rack, a droite de la machine, sur toute la hauteur sous le bandeau. */
export const RACK = { x: FACE.x + FACE.w, y: HEAD_H, w: UI_W - CHEEK_W - (FACE.x + FACE.w), h: UI_H - HEAD_H } as const;
/** Le sequenceur par pas, sous la machine. */
export const SEQ = { x: FACE.x, y: FACE.y + FACE.h, w: FACE.w, h: UI_H - (FACE.y + FACE.h) } as const;

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
