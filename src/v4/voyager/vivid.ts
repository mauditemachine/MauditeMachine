/**
 * v53 (2026-11-25, Mika : "le design est vraiment abouti je suis super content ! je voudrais juste que la ou ya de la
 * couleur que ce soit un peu plus voyant.. la les selecteurs de formes d'onde sont peut-etre un peu trop fins..") : UN
 * reglage, la vivacite de la couleur d'accent sur la FACE du plugin MM-ARP (pas les pages d'OPEN, pas le site), en trois
 * niveaux du plus sage au plus fort (A, B, C), plus 'off' : la face de la v52, au pixel.
 *
 * Ce qu'il regle :
 * - les selecteurs de forme d'onde d'OSC 1 et OSC 2 (silk.ts selectors) : l'epaisseur des arcs (elle gagne vers
 *   l'exterieur, le bord interieur reste au ras du potard), le trait et la taille des petits dessins, la forme choisie
 *   dans un halo leger, les autres plus lisibles, le mot FM plus gras ;
 * - l'encre de couleur de la serigraphie (les selecteurs, les noms des touches allumees, les LED) : la courbe ACES de la
 *   scene delave un cyan ou un jaune vifs (le cyan de Mika sortait #5FC9CB) ; ink est la part de cette encre rendue
 *   telle quelle, sans la courbe (0 : la v52, 1 : la couleur d'accent exacte) ;
 * - les pads et les touches-pilules allumes (pads.ts) : leur lueur dans la courbe (tm, une part de celle de la v52) et une
 *   lueur ajoutee apres la courbe, a la teinte exacte de l'accent (post, en part de l'accent lineaire) : un pad cyan
 *   allume sortait #3CB4C0, terne ; leurs halos (halo, un multiple de celui de la v52) ; les pads eteints un peu teintes ;
 *   l'accord qui joue garde plus de sa lueur dans la courbe : il reste le plus chaud (un rien blanchi), distinct des pads
 *   de la progression ;
 * - les LED (la serigraphie et l'encart d'EDIT : leur halo), la courbe de l'ecran des enveloppes (egScreen.ts), les
 *   touches POLARITY et VOICE (EgColumn.tsx), la pastille CHORDS (keySelect.css), les arcs de modulation (FaceModArcs.tsx).
 * Les potards (les PNG de Mika) et le cuir ne changent pas.
 *
 * Le choix : VIVID_LEVEL, plus bas (une constante). Pour comparer sans rien rebatir, ?vivid=A, ?vivid=B, ?vivid=C ou
 * ?vivid=off dans l'URL de la face (les captures, Chromium) ; lu une fois, au chargement. Aucune cle gardee (rien ne part
 * dans l'etat du projet). Ce module ne depend que de theme/base.
 */

import { PLUGIN_ARP } from '../theme/base';

export type VividLevel = 'off' | 'A' | 'B' | 'C';

/**
 * LE REGLAGE de la face publiee. 'off' : la face de la v52, rien ne change. Le choix de Mika fait (A, B ou C), il
 * suffit de le poser ici.
 */
export const VIVID_LEVEL: VividLevel = 'off';

/** Une lueur : dans la courbe (tm, multiple de celle de la v52), apres la courbe (post, part de l'accent), le halo (multiple). */
export interface VividGlow {
  tm: number;
  post: number;
  halo: number;
}

export interface Vivid {
  level: VividLevel;
  /** les selecteurs de forme d'onde (silk.ts selectors ; theme.ts VOY_SEL) */
  sel: {
    /** l'epaisseur des arcs, multiple de VOY_SEL.arcW (0.045) */
    arcW: number;
    /** le jour entre deux arcs (degres ; VOY_SEL.gapDeg 7) */
    gap: number;
    /** le trait des dessins, multiple de VOY_SEL.glyph.stroke (0.018) */
    glyph: number;
    /**
     * la largeur et la hauteur des dessins (et du mot FM : sa hauteur), multiples de VOY_SEL.glyph : un rien plus etroits
     * quand l'arc epaissit, pour qu'ils gardent leur jour avec lui sans toucher leurs voisins (le 1 et le 2 des rangees, le
     * LO de RANGE : leur bord exterieur ne depasse jamais celui de la v52)
     */
    glyphW: number;
    glyphH: number;
    /**
     * les dessins reculent de cette part de ce que l'arc gagne en epaisseur : out a l'horizontale (a gauche et a droite,
     * le 1 et le 2, le LO de RANGE sont tout pres), outV a la verticale (de la place) ; entre les deux, selon l'angle
     */
    out: number;
    outV: number;
    /** la taille du mot FM, multiple de celle de la v52 */
    fmSize: number;
    /** l'opacite des formes non choisies (VOY_SEL.dim.dark 0.42) */
    dim: number;
    /** le halo de la forme choisie : son flou en epaisseurs d'arc (0 : aucun), son opacite */
    halo: number;
    haloA: number;
    /** la graisse du mot FM (700) */
    fm: number;
  };
  /** la part de l'encre de couleur de la serigraphie rendue telle quelle, hors de la courbe ACES (0 : la v52) */
  ink: number;
  /** les pads : eteints (faint), survoles, dans la progression (queued, le pad clique), l'accord qui joue, le flash d'une note */
  pads: Record<'faint' | 'hover' | 'queued' | 'active' | 'flash', VividGlow>;
  /** les touches-pilules allumees (RUN/STOP, PRESET, EDIT, OPEN ; CHORUS, SUB OCT) */
  pill: VividGlow;
  /** le halo des LED allumees : son opacite (multiple, plafonnee a 1) et sa portee (multiple de son rayon) */
  led: { halo: number; reach: number };
  /** l'ecran des enveloppes : le trait de FILTER (multiple de 1.5 px), celui d'AMP, le flou et l'opacite du halo, le degrade */
  eg: { line: number; amp: number; blur: number; glowA: number; fill: number };
  /** les touches de POLARITY et VOICE : la LED (multiple de son rayon), l'opacite et la portee (rayons) de sa lueur */
  seg: { led: number; glowA: number; glowR: number };
  /** la pastille CHORDS : la lueur de la tonique (px, % d'accent), le lisere de la pastille (% d'accent ; 0 : aucun) */
  key: { glow: number; mix: number; ring: number };
  /** les arcs de modulation de la face : l'epaisseur (multiple), l'opacite de la plage, le flou (multiple) */
  mod: { w: number; range: number; blur: number };
}

const ONE: VividGlow = { tm: 1, post: 0, halo: 1 };

/** Les niveaux. off : les valeurs de la v52 (la face au pixel). A, B, C : du plus sage au plus fort. */
export const VIVID_LEVELS: Readonly<Record<VividLevel, Vivid>> = {
  off: {
    level: 'off',
    sel: { arcW: 1, gap: 7, glyph: 1, glyphW: 1, glyphH: 1, out: 0, outV: 0, fmSize: 1, dim: 0.42, halo: 0, haloA: 0, fm: 700 },
    ink: 0,
    pads: { faint: ONE, hover: ONE, queued: ONE, active: ONE, flash: ONE },
    pill: ONE,
    led: { halo: 1, reach: 1 },
    eg: { line: 1, amp: 1, blur: 1, glowA: 0.6, fill: 0.32 },
    seg: { led: 1, glowA: 0.55, glowR: 3.2 },
    key: { glow: 0, mix: 0, ring: 0 },
    mod: { w: 1, range: 0.22, blur: 1 },
  },
  A: {
    level: 'A',
    sel: { arcW: 1.5, gap: 7, glyph: 1.3, glyphW: 0.97, glyphH: 1, out: 0, outV: 0.3, fmSize: 1, dim: 0.46, halo: 0.8, haloA: 0.35, fm: 700 },
    ink: 0.55,
    pads: {
      faint: { tm: 1, post: 0.004, halo: 1.2 },
      hover: { tm: 1, post: 0.01, halo: 1.2 },
      queued: { tm: 0.6, post: 0.32, halo: 1.6 },
      active: { tm: 0.8, post: 0.3, halo: 1.2 },
      flash: { tm: 0.75, post: 0.25, halo: 1.1 },
    },
    pill: { tm: 0.6, post: 0.3, halo: 1.15 },
    led: { halo: 1.2, reach: 1.1 },
    eg: { line: 1.35, amp: 1.1, blur: 1.4, glowA: 0.7, fill: 0.38 },
    seg: { led: 1.1, glowA: 0.7, glowR: 3.6 },
    key: { glow: 4, mix: 50, ring: 0 },
    mod: { w: 1.15, range: 0.28, blur: 1.2 },
  },
  B: {
    level: 'B',
    sel: { arcW: 2, gap: 7, glyph: 1.55, glyphW: 0.9, glyphH: 1.05, out: 0.1, outV: 0.5, fmSize: 1, dim: 0.48, halo: 1.1, haloA: 0.5, fm: 800 },
    ink: 0.8,
    pads: {
      faint: { tm: 1, post: 0.008, halo: 1.45 },
      hover: { tm: 1, post: 0.016, halo: 1.3 },
      queued: { tm: 0.5, post: 0.48, halo: 2.1 },
      active: { tm: 0.75, post: 0.38, halo: 1.4 },
      flash: { tm: 0.7, post: 0.32, halo: 1.2 },
    },
    pill: { tm: 0.45, post: 0.45, halo: 1.35 },
    led: { halo: 1.45, reach: 1.2 },
    eg: { line: 1.7, amp: 1.2, blur: 1.8, glowA: 0.8, fill: 0.44 },
    seg: { led: 1.2, glowA: 0.85, glowR: 4 },
    key: { glow: 6, mix: 65, ring: 25 },
    mod: { w: 1.3, range: 0.32, blur: 1.4 },
  },
  C: {
    level: 'C',
    sel: { arcW: 2.4, gap: 8, glyph: 1.7, glyphW: 0.78, glyphH: 1.05, out: 0.2, outV: 0.8, fmSize: 0.95, dim: 0.5, halo: 1.4, haloA: 0.65, fm: 800 },
    ink: 1,
    pads: {
      faint: { tm: 1, post: 0.014, halo: 1.8 },
      hover: { tm: 1, post: 0.024, halo: 1.5 },
      queued: { tm: 0.45, post: 0.62, halo: 2.7 },
      active: { tm: 0.7, post: 0.45, halo: 1.6 },
      flash: { tm: 0.65, post: 0.4, halo: 1.3 },
    },
    pill: { tm: 0.35, post: 0.6, halo: 1.6 },
    led: { halo: 1.75, reach: 1.3 },
    eg: { line: 2.1, amp: 1.3, blur: 2.2, glowA: 0.9, fill: 0.5 },
    seg: { led: 1.3, glowA: 1, glowR: 4.4 },
    key: { glow: 8, mix: 80, ring: 40 },
    mod: { w: 1.5, range: 0.38, blur: 1.6 },
  },
};

/** Le niveau de cette page : celui de VIVID_LEVEL, ou ?vivid= dans l'URL (les captures) ; 'off' hors du plugin MM-ARP. */
function pick(): VividLevel {
  if (!PLUGIN_ARP) return 'off';
  try {
    if (typeof window !== 'undefined') {
      const q = new URLSearchParams(window.location.search).get('vivid');
      if (q !== null) {
        const u = q.trim().toUpperCase();
        if (u === 'A' || u === 'B' || u === 'C') return u;
        if (u === 'OFF' || u === '0') return 'off';
      }
    }
  } catch {
    /* une URL illisible : la constante */
  }
  return VIVID_LEVEL;
}

/** Les valeurs du niveau de cette page (lues a la construction de la scene et des pieces de la face). */
export const VIVID: Readonly<Vivid> = VIVID_LEVELS[pick()];
/** Un niveau autre que 'off' : les chemins de rendu ajoutes (lueur apres la courbe, encre hors de la courbe) existent. */
export const VIVID_ON = VIVID.level !== 'off';

// La pastille CHORDS (keySelect.css) : html[data-mm-vivid] et ses variables ; rien a 'off'
if (VIVID_ON && typeof document !== 'undefined') {
  const r = document.documentElement;
  r.setAttribute('data-mm-vivid', VIVID.level);
  r.style.setProperty('--mm-vivid-glow', `${VIVID.key.glow}px`);
  r.style.setProperty('--mm-vivid-mix', `${VIVID.key.mix}%`);
  r.style.setProperty('--mm-vivid-ring', `${VIVID.key.ring}%`);
}
