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
 *   | e  |  LA MACHINE 3D (1016 x 604)    |  OSC +, FILTER +,  | e  |
 *   |    |  six rangees                   |  PHASER, FLANGER,  |    |
 *   |    |                                |  PUMP, CRUSH, SPACE|    |
 *   |    +--------------------------------+--------------------+    | 650
 *   |    |  STEP SEQUENCER (1400 x 160)                        |    |
 *   +----+-----------------------------------------------------+----+ 810
 *
 * UNE grille pour toute la fenetre (2026-11-12, Mika : "c'est le bordel partout ... plus EPUREE ou au moins DROITE") :
 * GRID, plus bas ; la machine 3D pose ses potards sur la meme (voyager/theme.ts VOY_PLUGIN_GRID porte les memes cotes).
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
export const CROP = { x: 42, y: 63, w: 1016, h: 604 } as const;
/** La machine dans la fenetre. */
export const FACE = { x: CHEEK_W, y: HEAD_H, w: CROP.w, h: CROP.h } as const;
/** Le rack, a droite de la machine, sur sa hauteur. */
export const RACK = { x: FACE.x + FACE.w, y: HEAD_H, w: UI_W - CHEEK_W - (FACE.x + FACE.w), h: FACE.h } as const;
/** Le sequenceur par pas, sous la machine et le rack, sur toute la largeur. */
export const SEQ = { x: CHEEK_W, y: FACE.y + FACE.h, w: UI_W - 2 * CHEEK_W, h: UI_H - (FACE.y + FACE.h) } as const;

/**
 * La grille de la fenetre (les memes cotes que voyager/theme.ts VOY_PLUGIN_GRID, qui y pose les potards de la machine) :
 * 22 colonnes de 63.5 px depuis la joue gauche (16 sous la machine, 6 sous le rack) ; des rangees de 100 px, la ligne de
 * la premiere a 110 px du haut (sept sur la face : six pour la machine et le rack, la septieme pour le sequenceur). Une
 * rangee va de 60 px au-dessus de sa ligne a 40 dessous : le titre de sa section a -50, son filet a sa suite sur la meme
 * ligne, les potards sur la ligne, leurs noms a +30. Un potard normal fait 42.4 px (R = 21.2), comme ceux de la machine.
 */
export const GRID = {
  left: CHEEK_W,
  col: 63.5,
  cols: 22,
  row: 100,
  y0: 110,
  /** du haut d'une rangee a sa ligne */
  above: 60,
  title: -50,
  label: 30,
  /** le bord d'un potard normal dans sa colonne */
  inset: 10.5,
  knobR: 21.2,
} as const;
/** Le centre de la colonne c (0.5 : a cheval sur les colonnes 0 et 1), en px de la fenetre. */
export const colX = (c: number): number => GRID.left + GRID.col * (c + 0.5);
/** La ligne de la rangee k, en px de la fenetre. */
export const rowY = (k: number): number => GRID.y0 + GRID.row * k;

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

/**
 * Les pages d'OPEN : la meme grille (les colonnes, le titre a -50, la ligne, les noms a +30), six rangees sur toute la
 * hauteur sous le bandeau, au pas de 125 px (la face en a sept de 100).
 */
export const OPEN_ROW = 125;
/** Le haut de la rangee k d'une page d'OPEN, dans le repere du panneau (sous le bandeau). */
export const openTop = (k: number): number => GRID.y0 - GRID.above - HEAD_H + OPEN_ROW * k;
