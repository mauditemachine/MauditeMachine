/**
 * /v4 MM-808 : palette, dimensions, cadrage, lumieres. Revision 2 (spec
 * 20) : la machine devient une boite a rythmes noire facon Elektron
 * Analog Rytm, un coin (wedge) plus epais a l'arriere (2.2) qu'a l'avant
 * (1.3), le panneau du dessus incline d'environ 6 deg vers l'utilisateur.
 * Tout nombre de la scene vit ici : la scene 3D, les jumeaux HTML et le SVG
 * de repli lisent les memes constantes.
 * Repere monde : +y vers le haut, +x la largeur (droite), +z vers l'avant
 * (l'utilisateur), sol a y 0 ; le corps fait 14 x 9 au sol.
 * Repere "panneau" : celui du plateauGroup, origine au centre du dessus du
 * panneau, x a droite, z qui descend la pente vers l'utilisateur, y 0 = le
 * dessus du panneau.
 */

/* ---------- disposition portrait (essai mobile, 2026-10-01) ---------- */

/**
 * Disposition portrait (2026-10-01, demande de Mika) : sur telephone, la
 * machine en hauteur plutot qu'en largeur, facon Traktor X1 ou SP-404 : les
 * memes elements, places autrement (8.2 x 14.4 au sol, l'ecran et MASTER /
 * TEMPO en haut, le transport, la rangee GLOBAL, les pads, la rangee
 * VOICE, puis les 16 pas en deux rangees de 8), boutons deux fois plus
 * grands a l'ecran. Par defaut sous 768 px de large, au chargement ;
 * ?portrait=1 ou ?portrait=0 la forcent dans un sens ou dans l'autre (a
 * toute largeur, retenu pour l'onglet). Toutes les cotes en decoulent ; le
 * desktop ne change pas. Changer de largeur ensuite ne la change pas :
 * recharger.
 */
export const PORTRAIT: boolean = (() => {
  if (typeof window === 'undefined') return false;
  try {
    const q = new URLSearchParams(window.location.search).get('portrait');
    if (q === '1' || q === '0') window.sessionStorage.setItem('mm.v4.portrait', q);
    const forced = window.sessionStorage.getItem('mm.v4.portrait');
    if (forced === '1') return true;
    if (forced === '0') return false;
    return window.matchMedia('(max-width: 767px)').matches;
  } catch {
    return false;
  }
})();

/* ---------- couleurs (spec 4.4 et 20.3) ---------- */

export const HEX = {
  ink: '#0A0A0B',
  graphite: '#141417',
  graphiteHi: '#1C1D21',
  graphiteLo: '#08080A',
  line: '#2E3036',
  bone: '#F6F1E7',
  yellow: '#F2C230',
  yellowHi: '#FFD75E',
  red: '#C8442F',
  /** orange de navigation : noms des pages et des puces, pas programmes (demande de Mika, 2026-09-30) */
  orange: '#FF6A13',
  /** pas programme : orange, pour voir d'un coup d'oeil quels pas sont mis (velocite forte) */
  ledSet: '#FF6A13',
  /** velocite moyenne : l'orange a 68 % */
  ledMid: '#AD480D',
  /** velocite douce : l'orange a 38 % */
  ledLow: '#612807',
  ledHover: '#A9A69F',
  // Revision 2 (spec 20.3), couleurs AFFICHEES visees (voir GAIN)
  /** flancs et dessous du chassis, mats (brief) */
  body: '#0C0C0E',
  /** chanfreins du chassis tournes vers le haut : ils accrochent la lumiere */
  bodyEdge: '#2A2B30',
  /** dessus du chassis, vu seulement panneau leve */
  bodyTop: '#09090A',
  /** pieds en caoutchouc */
  rubber: '#050506',
  /** dessus du panneau, aluminium anodise noir mat (brief) */
  panel: '#141417',
  /** chanfrein du panneau : l'arete anodisee qui accroche la lumiere */
  panelEdge: '#3A3B40',
  panelSide: '#101012',
  /** verre et cadre de l'ecran OLED : noir profond */
  oled: '#050506',
  /** pads en caoutchouc noir */
  pad: '#111113',
  /** touches trig */
  key: '#1E1F23',
  /** encodeurs noirs et leur collerette */
  encoder: '#101012',
  collar: '#1A1B1F',
  // Le PCB de la vue eclatee (spec 5.6)
  pcb: '#12301F',
  /** piste sous le vernis (2026-10-01) : le cuivre eclaircit le vert, sans briller */
  pcbTrace: '#22573A',
  pcbSide: '#0E2418',
  pcbPadCore: '#0B1A11',
  copper: '#B8763A',
  chip: '#0B0B0D',
  leg: '#8A8F98',
  capBody: '#23283A',
  capTop: '#4A5068',
  cell: '#B9BCC4',
  resistor: '#C9B48A',
} as const;

export type Tone = keyof typeof HEX;

/** Les memes teintes en nombres, pour three (Color, setClearColor). */
export const COLOR = Object.fromEntries(
  (Object.keys(HEX) as Tone[]).map((k) => [k, parseInt(HEX[k].slice(1), 16)])
) as Record<Tone, number>;

/**
 * Les teintes du brief sont des couleurs AFFICHEES (section 19 point 12) :
 * sous l'eclairage et l'ACES, un albedo egal a la teinte rend bien plus
 * sombre (le pied de la courbe ACES ecrase les noirs). Albedo = teinte
 * lineaire x gain, un gain par teinte, cale par lecture de pixels a
 * 1440 x 900 a la vue par defaut (azimut 45, elevation 38) sur la face qui
 * definit la teinte : body sur les faces avant et droite du chassis (la
 * cle les eclaire de biais : gain fort), panel sur le dessus du panneau
 * (metalness 0.35 sans carte d'environnement : 35 % du diffus en moins),
 * panelEdge sur son chanfrein (face a la cle : gain faible). Mesures en
 * section 20.16.
 */
export const GAIN: Readonly<Partial<Record<Tone, number>>> & { parts: number } = {
  body: 7.5,
  bodyEdge: 3,
  bodyTop: 3,
  panel: 4.2,
  panelEdge: 2.3,
  panelSide: 18,
  pad: 1.8,
  encoder: 2.4,
  collar: 2.4,
  /** pieds, connectique, cadre de l'ecran */
  parts: 3,
};
/** Gain d'une teinte (GAIN, sinon celui des pieces). */
export const gainOf = (t: Tone): number => GAIN[t] ?? GAIN.parts;

/** Gain historique des corps (revision 1) : PCB et composants gardent le leur. */
export const ALBEDO_GAIN = 3;

/** bone (#F6F1E7) a une opacite donnee (canvas, CSS). */
export const boneA = (a: number): string => `rgba(246, 241, 231, ${a})`;

/* ---------- polices ---------- */

export const FONT_DISPLAY = '"SF Pro Display", system-ui, -apple-system, sans-serif';
export const FONT_TITLE = '"Robot Radicals", "SF Pro Display", system-ui, sans-serif';
export const FONT_MONO = 'ui-monospace, Menlo, Consolas, monospace';
/**
 * Ce que les textures canvas attendent avant leur dessin definitif (spec
 * 4.5) : 500 et 600 pour la serigraphie du panneau (revision 2, legendes
 * fines), 700 pour celle du PCB.
 */
export const FONT_LOADS = [
  '500 40px "SF Pro Display"',
  '600 40px "SF Pro Display"',
  '700 40px "SF Pro Display"',
  '400 40px "Robot Radicals"',
] as const;
export const FONT_TIMEOUT_MS = 3000;

/**
 * Serigraphie du panneau (spec 20.3.9), facon legendes Elektron : SF Pro
 * Display 500, capitales fines et espacees (0.2 em), bone 85 % ; le nom de
 * la machine en 600. Filets de 0.012, bone 35 %.
 */
export const SILK = {
  weight: 500,
  strongWeight: 600,
  tracking: 0.2,
  alpha: 0.85,
  /** hauteur de capitale de SF Pro Display, en em */
  capRatio: 0.7,
  lineWidth: 0.012,
  lineAlpha: 0.35,
  /** lueur des noms orange (emissif = leur couleur x orangeGlow) : lisibles sous la lumiere */
  orangeGlow: 0.6,
} as const;

/** Serigraphie du PCB : l'ancienne, 700, 0.18 em (spec 5.7). */
export const PCB_TYPE = { weight: 700, tracking: 0.18 } as const;

/* ---------- le corps : chassis en coin, panneau, pieds (spec 20.3.2 et 20.3.3) ---------- */

/**
 * Chassis : 12.6 x 8 au sol (2026-10-01, plus compact : 14 x 9 avant,
 * LABEL et SONAA ont quitte les pads), dessous a y 0.12 (les pieds), 2.2
 * de haut a l'arriere et 1.3 a l'avant au-dessus du dessous : le panneau
 * s'incline de atan(0.9 / 8) = 6.42 deg vers l'utilisateur (la signature
 * Elektron). Toutes les aretes sont chanfreinees (chamfer).
 */
export const BODY = PORTRAIT
  ? ({ w: 8.2, d: 14.4, back: 2.2, front: 1.3, feet: 0.12, chamfer: 0.06 } as const)
  : ({ w: 12.6, d: 8, back: 2.2, front: 1.3, feet: 0.12, chamfer: 0.06 } as const);
/** Inclinaison du panneau (rad) : son avant descend. */
export const TILT = Math.atan((BODY.back - BODY.front) / BODY.d);

/**
 * Panneau (spec 20.3.3) : dalle a coins arrondis (le chassis moins 0.2) +
 * chanfrein de 0.1 (empreinte BODY.w x BODY.d / cos TILT le long de la
 * pente, BODY.w x BODY.d au sol), 0.14 d'epaisseur, dessus a y 0 du repere
 * panneau. Le cadre de l'ecran OLED lui est fusionne.
 */
export const PANEL = {
  shapeW: BODY.w - 0.2,
  shapeD: BODY.d / Math.cos(TILT) - 0.2,
  radius: 0.2,
  /** three subdivise les arcs en 2 x curveSegments */
  curveSegments: 4,
  t: 0.14,
  bevelThickness: 0.05,
  bevelSize: 0.1,
} as const;
/** Longueur de la pente du panneau : BODY.d / cos TILT. */
export const PANEL_D = PANEL.shapeD + 2 * PANEL.bevelSize;
/** Centre du dessus du panneau, monde, machine fermee : 0.12 + (2.2 + 1.3) / 2. */
export const PANEL_TOP_Y = BODY.feet + (BODY.back + BODY.front) / 2;
/**
 * Dessus du chassis (= dessous du panneau) a la profondeur z (monde) :
 * y = PANEL_TOP_Y - epaisseur verticale du panneau - z tan(TILT).
 */
export const chassisTopY = (z: number): number => PANEL_TOP_Y - PANEL.t / Math.cos(TILT) - z * Math.tan(TILT);

/**
 * Le dessus du chassis est un bac (spec 20.3.11) : un rebord de wall, des
 * parois et un fond depth plus bas, paralleles au panneau. Le PCB y dort
 * machine fermee et en sort a l'ouverture sans traverser aucune surface
 * (ouverture 13.52 x 8.51 dans le repere du panneau, carte 12.6 x 7.8).
 */
export const TRAY = { wall: 0.18, depth: 0.55 } as const;

/** Pieds en caoutchouc aux quatre coins (visibles en orbite basse). */
export const FEET = { r: 0.42, h: BODY.feet, x: BODY.w / 2 - 0.55, z: BODY.d / 2 - 0.55, segments: { desktop: 16, mobile: 12 } } as const;

/**
 * Face arriere (2026-10-01, plus realiste) : la connectique d'une vraie
 * boite a rythmes et sa serigraphie, le logo a gauche. u : abscisse vue de
 * derriere (de gauche a droite pour qui regarde l'arriere ; x monde = -u),
 * y : hauteur du centre. La face va de y 0.12 a 2.32 (z -BODY.d / 2).
 * Les pieces sont fusionnees au chassis (zero draw call) ; la serigraphie
 * est une texture sur un plan pose 0.003 devant la face (scene/backplate.ts).
 */
export type BackPortKind = 'jack' | 'mini' | 'din' | 'usb' | 'dc' | 'power';
export const BACK = {
  portY: 1.0,
  /** libelle sous chaque groupe : nom du port ; au-dessus : titre du groupe et son crochet */
  labelY: 1.43,
  bracketY: 1.6,
  groupY: 1.75,
  cap: 0.075,
  groupCap: 0.065,
  /** portrait : la meme connectique resserree sur 8.2 de large */
  ports: (PORTRAIT
    ? [
        { id: 'phones', kind: 'jack', u: -3.45, label: 'PHONES' },
        { id: 'outL', kind: 'jack', u: -2.65, label: 'L', group: 'MAIN OUT' },
        { id: 'outR', kind: 'jack', u: -2.0, label: 'R', group: 'MAIN OUT' },
        { id: 'syncIn', kind: 'mini', u: -1.2, label: 'IN', group: 'SYNC' },
        { id: 'syncOut', kind: 'mini', u: -0.65, label: 'OUT', group: 'SYNC' },
        { id: 'midiIn', kind: 'din', u: 0.2, label: 'IN', group: 'MIDI' },
        { id: 'midiOut', kind: 'din', u: 0.9, label: 'OUT', group: 'MIDI' },
        { id: 'usb', kind: 'usb', u: 1.75, label: 'USB' },
        { id: 'dc', kind: 'dc', u: 2.55, label: 'DC 12V' },
        { id: 'power', kind: 'power', u: 3.35, label: 'POWER' },
      ]
    : [
        { id: 'phones', kind: 'jack', u: -1.9, label: 'PHONES' },
        { id: 'outL', kind: 'jack', u: -1.0, label: 'L', group: 'MAIN OUT' },
        { id: 'outR', kind: 'jack', u: -0.25, label: 'R', group: 'MAIN OUT' },
        { id: 'syncIn', kind: 'mini', u: 0.65, label: 'IN', group: 'SYNC' },
        { id: 'syncOut', kind: 'mini', u: 1.25, label: 'OUT', group: 'SYNC' },
        { id: 'midiIn', kind: 'din', u: 2.2, label: 'IN', group: 'MIDI' },
        { id: 'midiOut', kind: 'din', u: 2.95, label: 'OUT', group: 'MIDI' },
        { id: 'usb', kind: 'usb', u: 3.85, label: 'USB' },
        { id: 'dc', kind: 'dc', u: 4.65, label: 'DC 12V' },
        { id: 'power', kind: 'power', u: 5.45, label: 'POWER' },
      ]) as readonly { id: string; kind: BackPortKind; u: number; label: string; group?: string }[],
  /** jack 6.35 : ecrou hexagonal, fut, trou ; mini-jack 3.5 : plus petit */
  jack: { nut: 0.2, nutH: 0.05, barrel: 0.14, barrelH: 0.08, hole: 0.065 },
  mini: { nut: 0.13, nutH: 0.04, barrel: 0.09, barrelH: 0.06, hole: 0.04 },
  /** DIN 5 broches : collerette, fut, fond noir, broches sur un demi-cercle, ergot */
  din: { flange: 0.28, flangeH: 0.02, shell: 0.23, shellH: 0.06, inner: 0.19, pinR: 0.022, pinRing: 0.11, key: 0.05 },
  /** USB-C : coque en stade, fond noir, languette */
  usb: { w: 0.34, h: 0.13, d: 0.04, inner: { w: 0.29, h: 0.085 }, tongue: { w: 0.17, h: 0.026 } },
  /** jack d'alimentation : boitier carre, trou, broche centrale */
  dc: { w: 0.36, d: 0.05, hole: 0.11, pin: 0.03 },
  /** interrupteur a bascule : cadre, bascule inclinee */
  power: { w: 0.32, h: 0.5, d: 0.05, rocker: { w: 0.25, h: 0.42, d: 0.06, tiltDeg: 9 } },
  /** serigraphie : plan de la face, texture (px), logo, textes, etiquette du numero de serie */
  plane: { w: BODY.w - 0.3, y0: 0.2, y1: 2.24, gap: 0.003 },
  tex: { desktop: 2048, mobile: 1024 },
  logo: PORTRAIT ? { u: -3.8, y: 0.5, w: 1.6 } : { u: -5.95, y: 1.66, w: 3.2 },
  model: { u: PORTRAIT ? -2.05 : -5.95, y: PORTRAIT ? 0.55 : 1.3, text: 'MM-808 DRUM MACHINE', cap: PORTRAIT ? 0.06 : 0.08 },
  firmware: { u: PORTRAIT ? -2.05 : -5.95, y: PORTRAIT ? 0.38 : 1.08, text: 'FIRMWARE V.2.1 / 2026', cap: PORTRAIT ? 0.05 : 0.06, alpha: 0.55 },
  sticker: PORTRAIT
    ? { u0: 2.3, u1: 3.8, y0: 0.26, y1: 0.58, serial: 'S/N MM808-000808' }
    : { u0: -5.95, u1: -4.45, y0: 0.42, y1: 0.78, serial: 'S/N MM808-000808' },
} as const;

/**
 * Brossage du panneau (brief) : une texture de gris, une valeur par ligne
 * (0.86 a 1, une ligne sur 12 une strie a 0.8 ou 1), en roughnessMap,
 * repetee 0.5 fois par unite (UV en unites) : fines lignes horizontales,
 * invisibles de loin (mipmaps), visibles de pres.
 */
export const BRUSH = { size: 256, min: 0.86, streakEvery: 12, streakLo: 0.8, repeat: 0.5, seed: 808 } as const;

/** Materiaux du brief : panneau anodise mat, chassis mat. */
export const MATERIAL = {
  panel: { roughness: 0.62, metalness: 0.35 },
  chassis: { roughness: 0.85, metalness: 0 },
  pad: { roughness: 0.9, metalness: 0 },
  key: { roughness: 0.6, metalness: 0 },
  encoder: { roughness: 0.55, metalness: 0 },
} as const;

/* ---------- PCB (spec 5.6 et 20.3.11) ---------- */

/**
 * Carte : le chassis moins 1.4 x 1.2 (11.2 x 6.8), 0.1 d'epaisseur, dans
 * pcbGroup (incline comme le panneau). Revision 5 : chanfrein de 0.03 sur
 * les quatre bords (la fibre de verre nue en tranche), pistes sur une
 * grille de 0.2 a 45 deg (jamais d'angle droit), largeurs en unites de la
 * carte (signal, alimentation, paires differentielles), textures de
 * 2048 x 1280 (desktop) generees a la premiere apparition du PCB.
 */
export const PCB = {
  /** portrait : la carte d'origine (11.2 x 6.8), tournee d'un quart de tour (PCB_TURN) */
  w: PORTRAIT ? BODY.d - 3.2 : BODY.w - 1.4,
  d: PORTRAIT ? BODY.w - 1.4 : BODY.d - 1.2,
  h: 0.1,
  chamfer: 0.03,
  tex: { desktop: [2048, 1280], mobile: [2048, 1280] },
  /** generateur des pistes (spec 5.7) : grille de 0.2, graine 808 (mulberry32) */
  grid: 0.2,
  seed: 808,
  traces: 150,
  vias: 90,
  /** largeurs (unites de la carte) ; 2026-10-01 : plus fines, plus nombreuses, sous le vernis */
  signalW: 0.022,
  powerW: 0.08,
  pairW: 0.018,
  pairGap: 0.06,
  padR: 0.035,
  viaR: 0.03,
  viaHole: 0.013,
  /** paires differentielles, pistes d'alimentation, serpentins d'egalisation */
  pairs: 4,
  power: 4,
  meanders: 2,
  /** px de la texture de reference (1024 de large) : traits et textes */
  outline: 1,
  chipFrame: 1,
  designatorPx: 10,
  chipLabelPx: 30,
} as const;

/**
 * Une position de la carte dessinee pour la carte d'origine 12.6 x 7.8,
 * ramenee a la carte actuelle (2026-10-01, machine compacte) : les
 * composants, les puces et la serigraphie gardent leur place relative.
 */
export const pcbAt = (x: number, z: number): { x: number; z: number } => ({ x: (x * PCB.w) / 12.6, z: (z * PCB.d) / 7.8 });
/** Portrait : la carte tourne d'un quart de tour dans son plan (rad, autour de y du pcbGroup). */
export const PCB_TURN = PORTRAIT ? Math.PI / 2 : 0;

/**
 * Origines des trois couches (monde, machine fermee). Le plateauGroup est
 * au centre du dessus du panneau ; le pcbGroup, incline pareil, pose la
 * carte dans le chassis, son dessus 0.1 sous le dessus du chassis (cachee
 * tant que la machine est fermee) ; le socle (chassis et sol) ne bouge
 * jamais.
 */
export const LAYERS = {
  plateauY: PANEL_TOP_Y,
  pcbY: PANEL_TOP_Y - (PANEL.t + 0.1 + PCB.h) / Math.cos(TILT),
  socleY: 0,
} as const;

/* ---------- plan de serigraphie ---------- */

/** Plan de serigraphie : tout le panneau (spec 20.3.9), 146.3 / 73.1 px par unite. */
export const SILK_PLANE = {
  w: BODY.w,
  d: PANEL_D,
  y: 0.004,
  /** mobile en pleine definition depuis le 2026-10-01 : a 1024, la serigraphie bavait au DPR 3 */
  tex: PORTRAIT ? { desktop: [1166, 2048], mobile: [1166, 2048] } : { desktop: [2048, 1323], mobile: [2048, 1323] },
} as const;

/**
 * Sol (spec 20.2.6) : un grand plan opaque a l'encre sous la machine,
 * enfant du socle (il suit l'intro). Son shader (scene/floor.ts, un seul
 * draw call) porte un halo radial tres discret au centre (le sol y vaut
 * haloHex, l'encre ailleurs), l'ombre portee de la cle (opacite shadow ;
 * 0.8 depuis la revue de la revision 2 : a 0.5 elle ne sortait que de 4
 * niveaux sur 255 sur le sol sombre),
 * l'ombre de contact autour de l'empreinte 14 x 9 du chassis (0.6 au
 * bord, nulle a falloff : le sol au ras de la base passe sous l'encre
 * malgre le halo) et un brouillard exponentiel carre
 * 1 - exp(-(fog x r)^2) sur la distance r au centre, qui efface ombres et
 * halo vers le bord. La base du sol EST la couleur de fond : aucune ligne
 * d'horizon, meme a 18 deg d'elevation. Pas de fog de scene : il laverait
 * aussi la machine.
 */
export const FLOOR = {
  size: 120,
  y: -0.001,
  haloHex: '#121215',
  haloR: 9,
  fog: 0.045,
  shadow: 0.8,
  contact: { halfW: BODY.w / 2, halfD: BODY.d / 2, radius: 0.1, falloff: 1.4, opacity: 0.6 },
} as const;

/**
 * Fond granite de la machine noire (2026-10-01, demande de Mika : le fond
 * de sonaa.ca). La page porte le granite (v4.css : page #0C0B09, soit
 * oklch(0.15 0.004 70), et la tuile SVG de Sonaa a 12 %) ; le canevas
 * devient transparent et le sol n'y ecrit plus que son ombre, en alpha.
 * Pas de halo : un eclaircissement additif (couleur plus forte que l'alpha)
 * n'est garde par Chrome que la ou l'alpha est non nul, il dessinait un
 * rectangle clair autour de la machine. La machine claire garde son sol
 * opaque creme. applyAppearance le pose.
 */
export const BACKDROP: { transparent: boolean; readonly page: string } = { transparent: true, page: '#0C0B09' };

/* ---------- panneau : moitie gauche (spec 20.3.4) ---------- */

/** Ecran OLED en haut a gauche : verre 3.6 x 1.35, cadre fusionne au panneau. */
export const OLED = {
  x: PORTRAIT ? -1.82 : -3.95,
  z: PORTRAIT ? -5.2 : -2.05,
  w: 3.6,
  d: 1.35,
  y: 0.025,
  tex: [640, 240],
  bezel: { w: 3.86, d: 1.61, h: 0.02 },
} as const;

/**
 * Dessin de l'ecran (spec 20.3.8) : texte bone sur noir profond,
 * monospace 40 px, marges de 24 px, trois lignes a 64, 136 et 208 px. La
 * texture (640 x 240) a les proportions du verre : aucune compression.
 */
export const OLED_DRAW = { font: `400 40px ${FONT_MONO}`, pad: 24, baselines: [64, 136, 208] } as const;

/**
 * Barre de progression de l'ecran (2026-10-01), ligne 3, en px de la
 * texture : 22 de haut, posee 3 au-dessus de la ligne de base, a 14 des
 * temps ; contour de 2, remplissage en retrait de 4. Un clic dessus (et sur
 * toute la bande de la ligne 3) fait avancer la piste.
 */
export const OLED_BAR = { h: 22, lift: 3, gap: 14, stroke: 2, inset: 4, bandY0: 160, bandY1: 236 } as const;

/**
 * Page MIX de l'ecran (2026-10-01, facon Elektron), px de la texture
 * 640 x 240 : cinq cellules de 128 separees par un filet (bone 30 %) ; en
 * haut le nom de la voix (la voix reglee en negatif, dans une etiquette
 * arrondie), au milieu un potard dessine (piste de 270 deg comme les
 * encodeurs, arc de la valeur, aiguille du centre vers le bord), en bas la
 * valeur (0 a 100).
 */
export const OLED_MIX = {
  font: `400 30px ${FONT_MONO}`,
  valueFont: `400 26px ${FONT_MONO}`,
  labelY: 42,
  tag: { w: 94, h: 40, r: 8 },
  dialY: 128,
  r: 40,
  track: 3,
  trackA: 0.35,
  arc: 6,
  needle: 4,
  valueY: 212,
  rule: 2,
  ruleA: 0.3,
  ruleInset: 14,
} as const;

/** level : le volume principal (MASTER) ; vol : le volume de la voix selectionnee (VOLUME). */
/**
 * Deux jeux de potards depuis le 2026-10-01 (demande de Mika) : GLOBAL a
 * gauche, sous RUN/STOP (SWING, STRETCH, DIST, CHORUS, DELAY, REVERB : tout
 * le pattern), VOICE a droite, sous les pads (VOLUME, TONE et les effets de
 * la voix selectionnee). Les potards de voix ont leurs ids (vstretch...) :
 * deux STRETCH, deux DIST... coexistent sur le panneau.
 */
export type EncId =
  | 'tempo'
  | 'level'
  | 'swing'
  | 'stretch'
  | 'dist'
  | 'chorus'
  | 'delay'
  | 'reverb'
  | 'vol'
  | 'tone'
  | 'vstretch'
  | 'vdist'
  | 'vchorus'
  | 'vdelay'
  | 'vreverb';

/**
 * Les potards de la rangee VOICE et le parametre de voix qu'ils reglent
 * (audio/voicefx.ts) : sans pad selectionne, ils demandent d'en toucher un
 * (TAP A PAD FIRST). TEMPO, MASTER et la rangee GLOBAL reglent le pattern.
 */
export const VOICE_PARAM = {
  vol: 'level',
  tone: 'tone',
  vstretch: 'stretch',
  vdist: 'dist',
  vchorus: 'chorus',
  vdelay: 'delay',
  vreverb: 'reverb',
} as const;
export type VoiceEncId = keyof typeof VOICE_PARAM;
export const VOICE_ENCODERS = Object.keys(VOICE_PARAM) as readonly VoiceEncId[];
export const isVoiceEnc = (id: EncId): id is VoiceEncId => id in VOICE_PARAM;

/** Potards a zero au centre (-1 a 1) : TONE et les deux STRETCH. */
export const BIPOLAR: readonly EncId[] = ['tone', 'stretch', 'vstretch'];
export const isBipolar = (id: EncId): boolean => BIPOLAR.includes(id);

/**
 * Encodeurs noirs a repere blanc (spec 20.3.7 ; STRETCH a cote de TONE en
 * revision 5, DELAY et CHORUS le 2026-10-01) : corps legerement conique
 * (0.27 a la base, 0.256 en haut, 0.42 de haut), repere bone du centre
 * vers l'arriere, collerette a la base. Places : encPos (apres KEYS). Ceux
 * de la rangee VOICE sont a l'echelle voiceScale (6 px de moins a l'ecran
 * a 1440 x 900 : 34.5 px contre 40.6, 2026-10-01).
 */
export const ENCODER = {
  r: 0.27,
  rTop: 0.256,
  h: 0.42,
  collar: { r: 0.32, h: 0.025 },
  mark: { w: 0.036, h: 0.012, d: 0.18 },
  segments: { desktop: 32, mobile: 20 },
  voiceScale: 0.85,
} as const;

/**
 * Dans l'ordre de lecture (2026-10-01) : MASTER au-dessus de TEMPO, a
 * droite de l'ecran ; la rangee GLOBAL a gauche (SWING, STRETCH, puis les
 * effets dans l'ordre du signal : DIST, CHORUS, DELAY, REVERB) ; la rangee
 * VOICE a droite (VOLUME, TONE, STRETCH et les memes effets, pour la voix
 * selectionnee). MASTER est l'ancien LEVEL, le volume principal seul.
 * aria : nom du jumeau (role slider).
 */
export const ENCODERS: readonly { id: EncId; label: string; aria: string }[] = [
  { id: 'level', label: 'MASTER', aria: 'Master volume' },
  { id: 'tempo', label: 'TEMPO', aria: 'Tempo' },
  { id: 'swing', label: 'SWING', aria: 'Global swing' },
  { id: 'stretch', label: 'STRETCH', aria: 'Global stretch, shorter or longer hits' },
  { id: 'dist', label: 'DIST', aria: 'Global distortion' },
  { id: 'chorus', label: 'CHORUS', aria: 'Global chorus' },
  { id: 'delay', label: 'DELAY', aria: 'Global delay' },
  { id: 'reverb', label: 'REVERB', aria: 'Global reverb' },
  { id: 'vol', label: 'VOLUME', aria: 'Voice volume' },
  { id: 'tone', label: 'TONE', aria: 'Voice tone, pitch and filter' },
  { id: 'vstretch', label: 'STRETCH', aria: 'Voice stretch, shorter or longer hits' },
  { id: 'vdist', label: 'DIST', aria: 'Voice distortion' },
  { id: 'vchorus', label: 'CHORUS', aria: 'Voice chorus' },
  { id: 'vdelay', label: 'DELAY', aria: 'Voice delay' },
  { id: 'vreverb', label: 'REVERB', aria: 'Voice reverb' },
];

/** Libelle serigraphie d'un encodeur (l'ecran l'affiche aussi : VOLUME 80%). */
export const encLabel = (id: EncId): string => ENCODERS.find((e) => e.id === id)?.label ?? id.toUpperCase();

/**
 * RUN/STOP, CLEAR, RANDOM, MUTE et SOLO (2026-10-01) : boutons carres de
 * 0.8 (0.62 avant, environ 30 px de plus a l'ecran), sous l'ecran, alignes
 * sur le bord gauche de son cadre (x -5.88), pas de 1.0 ; libelles 0.58
 * sous leur centre, comme les pads. Remontes de 0.06 le 2026-10-01 : la
 * rangee GLOBAL est dessous (TEMPO garde 0.1 au-dessus de SOLO). RANDOM tire un motif house
 * (audio/house.ts). MUTE coupe la voix selectionnee, SOLO ne laisse jouer
 * qu'elle (state/voices.ts).
 */
export const TRANSPORT = {
  size: 0.8,
  h: 0.1,
  radius: 0.04,
  z: PORTRAIT ? -3.6 : -0.56,
  labelZ: PORTRAIT ? -3.02 : 0.02,
  run: { x: PORTRAIT ? -2.6 : -5.48 },
  clear: { x: PORTRAIT ? -1.3 : -4.48 },
  random: { x: PORTRAIT ? 0 : -3.48 },
  mute: { x: PORTRAIT ? 1.3 : -2.48 },
  solo: { x: PORTRAIT ? 2.6 : -1.48 },
} as const;

/**
 * Temoin des boutons du transport (2026-10-01) : un fin trait lumineux sur
 * le dessus, pres du bord arriere (back : du bord a son centre), comme un
 * guide de lumiere. Eteint, une fente discrete (line) ; allume, l'orange
 * des pas programmes (ledSet), jaune (yellowHi) sur RUN, rouge. RUN/STOP, MUTE et SOLO restent allumes tant
 * que leur etat dure (lecture, voix coupee, solo) ; chaque appui le fait
 * briller flashMs (plein sur hold de sa duree, puis il s'eteint), le seul
 * signe de CLEAR et RANDOM, boutons a un coup.
 */
export const BTN_LED = { w: 0.46, d: 0.05, back: 0.13, y: 0.002, flashMs: 520, hold: 0.5 } as const;

/* ---------- panneau : moitie droite, les 12 pads (spec 20.3.5) ---------- */

export type Inst = 'BD' | 'SD' | 'TOM' | 'CH' | 'OH';
/** Les cinq pages du site, pads de navigation (touches 1 a 5). */
export type PageId = 'tracks' | 'mixtapes' | 'press' | 'shows' | 'contact';
/** Les sections du panneau : les cinq pages, GOODIES, MERCH et STUDIO (puces de la vue eclatee). */
export type SectionId = PageId | 'goodies' | 'merch' | 'studio';
export type PadId = Inst | PageId | 'open';

/**
 * Pad en caoutchouc : 0.86 x 0.22 x 0.86 a coins arrondis (0.08), dome de
 * 0.04 sur son dessus plat ; deux rangees de six, pas de 1.0 (2026-10-01 :
 * 12 pads, LABEL et SONAA sont partis dans CONTACT ; la rangee finit a
 * l'aplomb de la derniere touche trig).
 * Frappe : il s'enfonce de 0.06 en 60 ms, remonte en 180 ms. Halo : un
 * carre de 1.0 a plat sous chaque pad (retroeclairage).
 */
export const PAD = {
  size: 0.86,
  height: 0.22,
  radius: 0.08,
  segments: { desktop: 3, mobile: 2 },
  dome: 0.04,
  domeSegments: 6,
  /** hauteur du plan du dome, un soupcon au-dessus du dessus plat (pas de z-fight) */
  domeY: 0.222,
  x0: PORTRAIT ? -2.8 : 0.37,
  pitch: PORTRAIT ? 1.12 : 1.0,
  rowZ: PORTRAIT ? [-0.5, 0.8] : [-2.05, -0.75],
  /** serigraphie sous chaque pad */
  labelDz: 0.58,
  press: 0.06,
  halo: 1.0,
  haloY: 0.003,
} as const;

export interface VoicePad {
  id: Inst;
  kind: 'voice';
  label: string;
  key: string;
  x: number;
  z: number;
}
export interface PagePad {
  id: PageId;
  kind: 'page';
  label: string;
  key: string;
  x: number;
  z: number;
}
export interface OpenPad {
  id: 'open';
  kind: 'open';
  label: string;
  key: string;
  x: number;
  z: number;
}
export type PadSpec = VoicePad | PagePad | OpenPad;

/** Un pad de la grille : colonne 0 a 4, rangee 0 (voix) ou 1 (pages). */
const padAt = (col: number, row: 0 | 1): { x: number; z: number } => ({ x: PAD.x0 + PAD.pitch * col, z: PAD.rowZ[row] });

/**
 * Les 11 pads (2026-10-01, LIVE fondu dans PRESS) : les cinq voix en haut
 * (BD SD TOM CH OH), les cinq pages en bas (TRACKS MIXTAPES SHOWS PRESS
 * CONTACT : PRESS a gauche de CONTACT depuis le 2026-10-01), OPEN seul dans
 * la sixieme colonne, a mi-hauteur des deux rangees. Voix : A S D F G.
 * Pages : 1 a 5. OPEN : 6 (et O).
 */
export const PADS: readonly PadSpec[] = [
  { id: 'BD', kind: 'voice', label: 'BD', key: 'A', ...padAt(0, 0) },
  { id: 'SD', kind: 'voice', label: 'SD', key: 'S', ...padAt(1, 0) },
  { id: 'TOM', kind: 'voice', label: 'TOM', key: 'D', ...padAt(2, 0) },
  { id: 'CH', kind: 'voice', label: 'CH', key: 'F', ...padAt(3, 0) },
  { id: 'OH', kind: 'voice', label: 'OH', key: 'G', ...padAt(4, 0) },
  { id: 'tracks', kind: 'page', label: 'TRACKS', key: '1', ...padAt(0, 1) },
  { id: 'mixtapes', kind: 'page', label: 'MIXTAPES', key: '2', ...padAt(1, 1) },
  { id: 'shows', kind: 'page', label: 'SHOWS', key: '3', ...padAt(2, 1) },
  { id: 'press', kind: 'page', label: 'PRESS', key: '4', ...padAt(3, 1) },
  { id: 'contact', kind: 'page', label: 'CONTACT', key: '5', ...padAt(4, 1) },
  { id: 'open', kind: 'open', label: 'OPEN', key: '6', x: PAD.x0 + 5 * PAD.pitch, z: (PAD.rowZ[0] + PAD.rowZ[1]) / 2 },
];

/** Les cinq pages, dans l'ordre des pads (onglets de la feuille, touches 1 a 5). */
export const PAGES: readonly PagePad[] = PADS.filter((p): p is PagePad => p.kind === 'page');
export const isPage = (s: string | null): s is PageId => PAGES.some((p) => p.id === s);

/**
 * Frappe d'un pad (spec 20.3.5), en ms. Un appui immobile de plus de
 * 400 ms n'active rien (regle du brief, spec 20.1 R2-1) : plus de charley
 * ouvert au pointeur.
 */
export const PAD_FX = {
  downMs: 60,
  upMs: 180,
  flashMs: 120,
  /** coup du sequenceur : flash seul, sans mouvement */
  seqFlashMs: 100,
} as const;

/**
 * Retroeclairage des pads (spec 20.3.5), emissif lineaire du dessus (le
 * dome et le dessus plat, 55 % sur les flancs), cale sur la couleur
 * AFFICHEE par lecture de pixels (section 19 point 22) :
 * voix : flash jaune vif (#F2C230) 120 ms a la frappe, 100 ms par coup du
 * sequenceur ; l'instrument selectionne reste en blanc chaud faible ;
 * pages : jaune faible en permanence, plus fort au survol (souris), jaune
 * vif (yellowHi #FFD75E) pour la page ouverte, une seule a la fois ;
 * OPEN : jaune faible, yellowHi pendant l'ouverture et vue ouverte.
 */
export const PAD_GLOW = {
  /** dessus 241,193,74 (#F2C230 : 242,194,48, le bleu hors gamut sous l'ACES) */
  flash: [1.2, 0.42, 0],
  /** dessus 30,28,25 : le caoutchouc (18,17,16) plus 12 niveaux, blanc chaud */
  selected: [0.011, 0.0105, 0.0085],
  /** dessus 40,34,18 : environ 10 % de jaune sur le caoutchouc */
  faint: [0.022, 0.016, 0.001],
  /** dessus 86,71,24 : environ 30 % */
  hover: [0.085, 0.06, 0.003],
  /** dessus 246,223,124 (#FFD75E : 255,215,94, meme limite de gamut) */
  active: [1.8, 0.85, 0.02],
  /** OPEN, machine fermee (revision 4) : orange plein, l'action qui transforme la page */
  orange: [1.6, 0.2, 0.004],
  /** OPEN devenu CLOSE, machine ouverte : orange faible */
  orangeDim: [0.16, 0.024, 0],
} as const;

/**
 * Intensite du halo additif autour de chaque pad, par etat (jaune, ou
 * blanc chaud pour la selection, lineaire x intensite) : +20 niveaux au
 * ras d'une page au repos, +75 autour de la page ouverte.
 */
export const PAD_HALO = { selected: 0.025, faint: 0.025, hover: 0.06, active: 0.35, flash: 0.45, orange: 0.3, orangeDim: 0.06 } as const;

/**
 * Pads de voix coupes ou en solo (2026-10-01, demande de Mika) : le
 * caoutchouc change de teinte, meme matiere (rugosite, dome, flancs) ;
 * MUTE en rose (un rose poudre, pas bonbon), SOLO en bleu. Couleurs
 * AFFICHEES visees, converties par pads.ts en multiplicateur du
 * caoutchouc. Le solo passe avant le mute (state/voices.ts). La machine
 * claire a les siennes (applyAppearance).
 */
export const VOICE_TINT = { mute: '#7A5662', solo: '#2B5896' };

/**
 * OPEN respire (2026-10-01, demande de Mika : le pad lui-meme, plus le
 * carre lumineux pose sur son jumeau) : son retroeclairage et son halo
 * descendent a min puis remontent, une sinusoide de periodMs, machine
 * fermee seulement ; ni en mouvement reduit, ni au palier mobile (le Dock
 * a son bouton OPEN qui respire deja). Sa teinte (OPEN_TINT) suit, de
 * tintMin a 1 : sur la machine claire l'orange plein sature, la lumiere
 * seule ne se voyait pas (246,112,63 a 248,119,78 mesure). Une image
 * toutes les frameMs (20 par seconde), sans passe d'ombre : la boucle ne
 * dort plus machine fermee, mais ne rend que la lumiere.
 */
export const OPEN_BREATHE = { periodMs: 3200, min: 0.45, tintMin: 0.5, frameMs: 50 } as const;

/* ---------- panneau : les 16 touches trig (spec 20.3.6) ---------- */

/**
 * Touches trig etroites (0.5 x 0.9, 0.1 de haut, coins de 0.04) en bas du
 * panneau, une LED au-dessus de chacune (0.22 x 0.055), numeros 1 a 16
 * dessous, un crochet serigraphie sous chaque groupe de quatre. Coins et
 * aretes vraiment arrondis depuis le 2026-10-01 (trois segments, deux sur
 * mobile) : avec un seul, c'etaient des pans coupes a 45 deg.
 */
export const KEYS = {
  count: 16,
  x0: PORTRAIT ? -3.01 : -5.55,
  pitch: PORTRAIT ? 0.86 : 0.74,
  z: PORTRAIT ? 4.0 : 2.4,
  /** portrait : deux rangees de 8, la seconde rowDz plus bas */
  perRow: PORTRAIT ? 8 : 16,
  rowDz: PORTRAIT ? 1.95 : 0,
  w: 0.5,
  d: 0.9,
  h: 0.1,
  radius: 0.04,
  segments: { desktop: 3, mobile: 2 },
  ledZ: PORTRAIT ? 3.22 : 1.62,
  ledW: 0.22,
  ledD: 0.055,
  ledY: 0.006,
  /**
   * Velocite (2026-10-01) : jusqu'a trois traits empiles au-dessus de la
   * touche (vers l'arriere, pas de 0.09), la LED du bas comprise : fort
   * trois, moyen deux, doux un ; un pas vide n'a que la LED du bas, eteinte.
   */
  velBars: 3,
  velPitch: 0.09,
  numberZ: PORTRAIT ? 4.68 : 3.08,
  bracketZ: PORTRAIT ? 4.85 : 3.25,
  bracketTick: 0.06,
} as const;
/** x du pas i ; sa rangee le decale de keyDz en z (portrait : deux rangees de 8). */
export const keyX = (i: number): number => KEYS.x0 + KEYS.pitch * (i % KEYS.perRow);
export const keyDz = (i: number): number => KEYS.rowDz * Math.floor(i / KEYS.perRow);

/**
 * Places des encodeurs (2026-10-01) :
 * - MASTER au-dessus de TEMPO, a droite de l'ecran, centres entre son
 *   cadre et les pads ; un pas de 1.07 (TEMPO, devant, ne cache pas le
 *   libelle de MASTER), libelles 0.45 sous leur centre ;
 * - deux rangees alignees sur la grille des touches trig (pas de 0.74) :
 *   GLOBAL au-dessus des touches 1 a 6, sous RUN/STOP ; VOICE au-dessus
 *   des touches 10 a 16, sous les pads, plus petits (ENCODER.voiceScale),
 *   libelles remontes d'autant. Un filet de groupe sous chaque rangee,
 *   coupe par son nom (ENC_GROUPS).
 */
const ENC_SIDE = { masterZ: -2.62, tempoZ: -1.55, labelDz: 0.45 } as const;
const ENC_GLOBAL: readonly EncId[] = ['swing', 'stretch', 'dist', 'chorus', 'delay', 'reverb'];
const ENC_ROW_Z = { z: 0.62, labelDz: 0.48 } as const;

export interface EncPlace {
  x: number;
  z: number;
  labelZ: number;
  /** echelle du potard (1, ou voiceScale pour la rangee VOICE) */
  s: number;
}

/**
 * Portrait : MASTER et TEMPO cote a cote a droite de l'ecran ; GLOBAL sous
 * le transport, sur les colonnes 2 a 7 des pas ; VOICE sous les pads, a
 * cheval sur les colonnes (sept potards pour huit colonnes). Plus gros au
 * doigt (2026-10-02, Mika) : MASTER et TEMPO x1.35, GLOBAL x1.25, VOICE
 * x1.15 (0.85 sur desktop), environ 29, 27 et 26 px de diametre a 390 px
 * de large ; les collerettes gardent un jour entre elles (pas de 0.86) et
 * les libelles suivent leur bord.
 */
const ENC_PORTRAIT = { sideX: [1.25, 2.75], sideZ: -5.35, globalZ: -2.2, voiceZ: 2.2, scale: { side: 1.35, global: 1.25, voice: 1.15 } } as const;

function encPlaces(): Record<EncId, EncPlace> {
  const out = {} as Record<EncId, EncPlace>;
  if (PORTRAIT) {
    const P = ENC_PORTRAIT;
    // Le libelle suit le bord de la collerette a l'echelle s
    const below = (dz: number, sc: number): number => dz + ENCODER.collar.r * (sc - 1);
    const ss = P.scale.side;
    out.level = { x: P.sideX[0], z: P.sideZ, labelZ: P.sideZ + below(ENC_SIDE.labelDz, ss), s: ss };
    out.tempo = { x: P.sideX[1], z: P.sideZ, labelZ: P.sideZ + below(ENC_SIDE.labelDz, ss), s: ss };
    const gs = P.scale.global;
    ENC_GLOBAL.forEach((id, k) => {
      out[id] = { x: keyX(k + 1), z: P.globalZ, labelZ: P.globalZ + below(ENC_ROW_Z.labelDz, gs), s: gs };
    });
    const vs = P.scale.voice;
    VOICE_ENCODERS.forEach((id, k) => {
      out[id] = { x: KEYS.x0 + KEYS.pitch * (k + 0.5), z: P.voiceZ, labelZ: P.voiceZ + below(ENC_ROW_Z.labelDz, vs), s: vs };
    });
    return out;
  }
  const left = OLED.x + OLED.bezel.w / 2;
  const right = PAD.x0 - PAD.size / 2;
  const mid = (left + right) / 2;
  out.level = { x: mid, z: ENC_SIDE.masterZ, labelZ: ENC_SIDE.masterZ + ENC_SIDE.labelDz, s: 1 };
  out.tempo = { x: mid, z: ENC_SIDE.tempoZ, labelZ: ENC_SIDE.tempoZ + ENC_SIDE.labelDz, s: 1 };
  const z = ENC_ROW_Z.z;
  ENC_GLOBAL.forEach((id, k) => {
    out[id] = { x: keyX(k), z, labelZ: z + ENC_ROW_Z.labelDz, s: 1 };
  });
  const s = ENCODER.voiceScale;
  // Le libelle suit le bord de la collerette : remonte de ce qu'elle perd
  const labelZ = z + ENC_ROW_Z.labelDz - ENCODER.collar.r * (1 - s);
  VOICE_ENCODERS.forEach((id, k) => {
    out[id] = { x: keyX(KEYS.count - VOICE_ENCODERS.length + k), z, labelZ, s };
  });
  return out;
}

let places: Record<EncId, EncPlace> | null = null;
/** Place de l'encodeur i (ordre de ENCODERS). */
export const encPos = (i: number): EncPlace => {
  places ??= encPlaces();
  return places[ENCODERS[i].id];
};

/**
 * Les deux rangees nommees (2026-10-01 ; zones le 2026-10-02, Mika : le
 * petit GLOBAL sous la rangee ne se remarquait pas) : chaque rangee dans
 * sa zone serigraphiee, un cadre a peine teinte (fill) autour des potards
 * et de leurs libelles, coupe en bas au centre par son nom en gras
 * (GLOBAL FX, VOICE FX), 0.1 de capitale (0.06 avant).
 */
export const ENC_GROUPS: readonly { text: string; ids: readonly EncId[] }[] = [
  { text: 'GLOBAL FX', ids: ENC_GLOBAL },
  { text: 'VOICE FX', ids: VOICE_ENCODERS },
];
export const ENC_GROUP_TYPE = { cap: 0.1, weight: 700, dz: 0.18, top: 0.16, side: 0.16, gapPerChar: 0.125, pad: 0.12, fill: 0.07, radius: 0.12 } as const;
/** Index d'un encodeur dans ENCODERS. */
export const encIndex = (id: EncId): number => ENCODERS.findIndex((e) => e.id === id);

/** Appui long sur un pas (revision 4) : il se vide au lieu de changer, en ms. */
export const STEP_HOLD_MS = 400;

/**
 * Appui sur un pas (2026-10-01) : la touche s'enfonce de depth et s'eclaire
 * (emissif glow, lineaire) en downMs, remonte et s'eteint en upMs.
 */
export const STEP_PRESS = { depth: 0.045, downMs: 40, upMs: 160, glow: [0.16, 0.04, 0.004] } as const;

/* ---------- picking (spec 6.2, 6.5 et 20.7) ---------- */

/** Picking, en px CSS. */
export const HIT = {
  /** tactile : un point hors de toute forme compte a moins de 24 px du bord */
  touchSlop: 24,
  /** rectangle cible minimal (jumeaux, zone tactile) : tactile, souris */
  minCoarse: 48,
  minFine: 32,
} as const;

/** Noms parles des instruments : etiquettes aria, Dock. */
export const INST_NAMES: Readonly<Record<Inst, string>> = { BD: 'bass drum', SD: 'snare', TOM: 'tom', CH: 'closed hi-hat', OH: 'open hi-hat' };

/**
 * Albedos LINEAIRES des touches (spec 20.3.6), cales sur la couleur
 * AFFICHEE du dessus a 1440 x 900 (vue par defaut) : key #1E1F23 ; run :
 * red #C8442F ; clear : graphiteHi #1C1D21. Depuis le 2026-10-01, RUN,
 * MUTE et SOLO gardent leur teinte allumes : leur etat passe par le temoin
 * (BTN_LED), plus par un bouton entier jaune ou orange.
 */
export const LIT = {
  key: [0.0286, 0.0299, 0.0495],
  run: [0.61, 0.0805, 0.0478],
  clear: [0.0217, 0.0229, 0.0385],
  /** repere des encodeurs : bone */
  mark: [2.8308, 2.6988, 2.4532],
} as const;

/**
 * TEMPO (spec 6.1) : glisser vertical, 100 px = 50 BPM (vers le haut =
 * plus vite) ; molette 1 BPM par cran de 100 px ; double tape = 130.
 * Angle d'un encodeur : 270 deg de course centree sur le repere a 0, sens
 * horaire vu du dessus quand la valeur monte (section 19). Le glisser part
 * au seuil de l'orbite (6 px) ; parti d'un encodeur, il ne fait jamais
 * orbiter la vue : l'axe dominant au seuil le tourne (vers le haut ou vers
 * la droite = plus ; spec 20.17 FX-5, qui remplace la regle verticale de
 * R2-2). Au doigt aussi, tout de suite depuis le 2026-10-01 : un seul
 * doigt ne tourne plus la vue (scene/orbit.ts), plus rien a departager.
 */
export const TEMPO_UI = { pxPerBpm: 2, wheelPx: 100, tapMs: 350, sweepDeg: 270 } as const;

/**
 * Les autres encodeurs : glisser, 150 px = toute la course ; molette
 * 2 % par cran de 100 px ; double tape = valeur de depart (TONE et STRETCH
 * au centre, LEVEL 80 %, SWING, DIST, REVERB, DELAY et CHORUS a 0, leur
 * neutre). Ecran : la valeur reste 1200 ms en ligne 3 (spec 20.3.8). TONE
 * et STRETCH vont de -1 a 1 (leur course fait 2) : molette et fleches de
 * 0.05, pour sortir du cran du centre (+/-0.04) en un pas.
 */
export const POT_UI = {
  pxRange: 150,
  wheelPx: 100,
  wheelStep: 0.02,
  bipolarStep: 0.05,
  readoutMs: 1200,
  reset: { level: 0.8, swing: 0, stretch: 0, dist: 0, chorus: 0, delay: 0, reverb: 0, vol: 0.8, tone: 0, vstretch: 0, vdist: 0, vchorus: 0, vdelay: 0, vreverb: 0 },
} as const;

/** Bornes d'un encodeur hors TEMPO : TONE et STRETCH -1 a 1, les autres 0 a 1. */
export const potMin = (id: EncId): number => (isBipolar(id) ? -1 : 0);
/** Course 0 a 1 d'un encodeur hors TEMPO (angle) : TONE et STRETCH au centre a 0. */
export const potCourse = (id: EncId, v: number): number => (isBipolar(id) ? (v + 1) / 2 : v);

/**
 * SWING (spec 20.8) : les pas pairs (2, 4 ... 16) partent en retard, de 0
 * a un tiers de pas (maxDelay : le shuffle de triolet). L'ecran et le
 * jumeau l'affichent en rapport de doubles croches, 50 % (droit) a 67 %.
 */
export const SWING = { maxDelay: 1 / 3 } as const;
export const swingRatio = (v: number): number => Math.round(50 * (1 + v * SWING.maxDelay));

/* ---------- navigation : sections, panneau, trace (spec 11 et 20.2.7) ---------- */

/** Titres des sections : panneau, onglets, ecran (spec 11.1). */
export const SECTION_TITLES: Readonly<Record<SectionId, string>> = {
  tracks: 'TRACKS',
  mixtapes: 'MIXTAPES',
  press: 'PRESS',
  shows: 'SHOWS',
  contact: 'CONTACT',
  goodies: 'GOODIES',
  merch: 'MERCH',
  studio: 'STUDIO',
};

/**
 * Cadrage quand une section est ouverte (desktop, spec 20.2.5 et R2-6) :
 * la machine glisse a gauche du panneau, centre a stageW / 2 avec
 * stageW = bord gauche du panneau - gap, et tient par son cercle
 * englobant (rayon horizontal : la plus grande distance d'un sommet a
 * l'axe vertical du pivot, measure().fit.radius sur les maillages reels :
 * 7.46 fermee, les coins du chassis ; 8.32 ouverte, le panneau recule ; machine compacte) :
 * aucune orientation ne la fait passer sous le panneau a zoom <= 1.
 * Jamais plus grande qu'au repos.
 */
/** portrait : les rayons de la machine en hauteur (measure().fit.radius : 8.29 fermee, 10.26 ouverte) */
export const SECTION_FRAME = { ms: 400, gap: 16, radius: PORTRAIT ? { closed: 8.3, open: 10.3 } : { closed: 7.47, open: 8.33 } } as const;

/**
 * Boite du panneau desktop, en phase avec v4.css (.v4-panel) : 460 px au
 * plus a 32 px du bord, jamais plus que la largeur moins 340 px ; sous
 * 1100 px, 420 px a 16 px du bord, largeur moins 280 px au plus.
 */
export const PANEL_BOX = {
  wideMin: 1100,
  wide: { right: 32, maxW: 460, margin: 340 },
  narrow: { right: 16, maxW: 420, margin: 280 },
} as const;

/** Bord gauche du panneau desktop pour une largeur de fenetre W (px CSS). */
export function panelLeft(W: number): number {
  const b = W >= PANEL_BOX.wideMin ? PANEL_BOX.wide : PANEL_BOX.narrow;
  return W - b.right - Math.max(0, Math.min(b.maxW, W - b.margin));
}

/**
 * Trace de l'objet au panneau (spec 11.2 et 20.2.7), px CSS et ms :
 * droite, un ou deux coudes a angle droit, dessinee en 400 ms, un point
 * lumineux la parcourt une fois (350 ms, apres le dessin). L'ancre (le
 * dessus du pad de la page, ou de la puce LIVE ou STUDIO) est reprojetee
 * a chaque frame rendue ; hors du canvas (edgeMargin), a moins de
 * panelMargin du panneau ou cachee par la machine, la trace s'efface
 * (fondu de fadeMs) et le panneau ne bouge jamais.
 */
export const TRACE = {
  drawMs: 400,
  dotDelayMs: 400,
  dotMs: 350,
  fadeMs: 150,
  clearance: 28,
  panelGap: 40,
  anchorDy: 36,
  straightTol: 12,
  minRun: 12,
  edgeMargin: 8,
  panelMargin: 12,
} as const;

/** Feuille mobile (spec 11.3) : fermee par un glisser de 80 px ou un geste vif. */
export const SHEET = { closeDragPx: 80, flickPxPerMs: 0.5, dragSlopPx: 6 } as const;

/** Ecran (spec 5.5 et 20.3.8) : 20 colonnes, compose au plus 4 fois par seconde. */
export const LCD_TEXT = {
  cols: 20,
  tickMs: 250,
  idle: 'MM-808',
  ready: 'READY',
  run: 'RUN',
  loading: 'LOADING',
  paused: 'PAUSED',
  skipped: 'SKIPPED',
  noSignal: 'NO SIGNAL',
  noSignalMs: 4000,
  pendingMs: 8000,
} as const;

/* ---------- serigraphie du panneau (spec 20.3.4 et 20.3.9) ---------- */

export interface SilkText {
  text: string;
  x: number;
  z: number;
  /** hauteur de capitale, en unites */
  cap: number;
  alpha?: number;
  align?: 'center' | 'left' | 'right';
  /** largeur max en unites : le corps reduit pour tenir (voisins, bords) */
  maxW?: number;
  /** les textes d'un meme groupe partagent le plus petit corps */
  group?: string;
  weight?: number;
  /** encre : bone (defaut) ou orange (noms des pages et OPEN, en gras) */
  ink?: 'bone' | 'orange';
  /** texte de repli d'un logo : dessine seulement si l'image du logo n'a pas pu se charger */
  fallbackFor?: SilkLogoId;
}

export type SilkLogoId = 'wordmark' | 'mark';

/**
 * Logos serigraphies sur le panneau (2026-09-30) : dessines dans la meme
 * texture que les legendes, ils suivent la machine en 3D. Le logo aligne
 * (wordmark, 971 x 57) prend la place du texte MAUDITE MACHINE en haut a
 * gauche ; le logotype (le M, 1891 x 1612) se pose en haut a droite, FIRMWARE V.2.1 /
 * 2026 a sa gauche. Images blanches, teintees a l'encre de la serigraphie.
 * x : bord d'alignement, z : centre ; w ou h fixe la taille (unites).
 */
/** L'en-tete du panneau : wordmark, MM-808, firmware et logotype (portrait : plus serres, en haut). */
const HEAD = PORTRAIT
  ? { z: -6.6, word: { x: -3.75, w: 3.0 }, model: -0.55, firmware: 3.05, mark: { x: 3.75, h: 0.5 } }
  : { z: -3.5, word: { x: -5.8, w: 3.5 }, model: -1.95, firmware: 4.95, mark: { x: 5.8, h: 0.52 } };

export const SILK_LOGOS: readonly { id: SilkLogoId; src: string; x: number; z: number; w?: number; h?: number; align: 'left' | 'right' }[] = [
  { id: 'wordmark', src: '/logo/mauditemachine-logo-aligned.svg', x: HEAD.word.x, z: HEAD.z, w: HEAD.word.w, align: 'left' },
  { id: 'mark', src: '/logo/mauditemachine-logotype.png', x: HEAD.mark.x, z: HEAD.z, h: HEAD.mark.h, align: 'right' },
];

/** Le libelle du pad OPEN (OPEN, CLOSE vue eclatee) : l'index de son texte dans SILK_TEXTS. */
const PAD_CAP = 0.09;
/**
 * Zone d'une rangee nommee : x0 / x1 (bords des collerettes plus la marge),
 * z0 (au-dessus des potards), z (le bas, ou se pose son nom), mid.
 */
function groupSpan(ids: readonly EncId[]): { x0: number; x1: number; z0: number; mid: number; z: number } {
  const T = ENC_GROUP_TYPE;
  const ps = ids.map((id) => encPos(encIndex(id)));
  const x0 = ps[0].x - ENCODER.collar.r * ps[0].s - T.side;
  const x1 = ps[ps.length - 1].x + ENCODER.collar.r * ps[ps.length - 1].s + T.side;
  const z0 = Math.min(...ps.map((p) => p.z - ENCODER.collar.r * p.s)) - T.top;
  return { x0, x1, z0, mid: (x0 + x1) / 2, z: Math.max(...ps.map((p) => p.labelZ)) + T.dz };
}

/** Les zones des rangees GLOBAL et VOICE, teintees sur la serigraphie (silk.ts, repli SVG). */
export const SILK_ZONES: readonly { x0: number; z0: number; x1: number; z1: number; r: number; alpha: number }[] = ENC_GROUPS.map((g) => {
  const { x0, x1, z0, z } = groupSpan(g.ids);
  return { x0, z0, x1, z1: z, r: ENC_GROUP_TYPE.radius, alpha: ENC_GROUP_TYPE.fill };
});

const padLabel = (p: PadSpec): SilkText =>
  p.kind === 'voice'
    ? { text: p.label, x: p.x, z: p.z + PAD.labelDz, cap: PAD_CAP, maxW: 0.94, group: 'pads' }
    : { text: p.label, x: p.x, z: p.z + PAD.labelDz, cap: PAD_CAP, maxW: 0.94, group: 'pads', weight: 700, ink: 'orange', alpha: 1 };

export const SILK_TEXTS: readonly SilkText[] = [
  { text: 'MAUDITE MACHINE', x: HEAD.word.x, z: HEAD.z, cap: 0.2, align: 'left', weight: SILK.strongWeight, fallbackFor: 'wordmark' },
  { text: 'MM-808', x: HEAD.model, z: HEAD.z, cap: 0.13, align: 'left' },
  { text: 'FIRMWARE V.2.1 / 2026', x: HEAD.firmware, z: HEAD.z, cap: PORTRAIT ? 0.06 : 0.07, align: 'right', alpha: 0.45 },
  { text: 'VOICES', x: PAD.x0 - PAD.size / 2, z: PAD.rowZ[0] - 0.72, cap: 0.06, align: 'left' },
  ...ENCODERS.map((e, i) => ({ text: e.label, x: encPos(i).x, z: encPos(i).labelZ, cap: 0.085, maxW: 0.66, group: 'enc' })),
  ...ENC_GROUPS.map((g) => ({ text: g.text, x: groupSpan(g.ids).mid, z: groupSpan(g.ids).z, cap: ENC_GROUP_TYPE.cap, weight: ENC_GROUP_TYPE.weight, alpha: 1 })),
  { text: 'RUN/STOP', x: TRANSPORT.run.x, z: TRANSPORT.labelZ, cap: 0.085, maxW: 0.9, group: 'tr' },
  { text: 'CLEAR', x: TRANSPORT.clear.x, z: TRANSPORT.labelZ, cap: 0.085, maxW: 0.9, group: 'tr' },
  { text: 'RANDOM', x: TRANSPORT.random.x, z: TRANSPORT.labelZ, cap: 0.085, maxW: 0.9, group: 'tr' },
  { text: 'MUTE', x: TRANSPORT.mute.x, z: TRANSPORT.labelZ, cap: 0.085, maxW: 0.9, group: 'tr' },
  { text: 'SOLO', x: TRANSPORT.solo.x, z: TRANSPORT.labelZ, cap: 0.085, maxW: 0.9, group: 'tr' },
  ...PADS.map(padLabel),
  ...Array.from({ length: KEYS.count }, (_, i) => ({ text: String(i + 1), x: keyX(i), z: KEYS.numberZ + keyDz(i), cap: 0.075 })),
];
/** Index du libelle du pad OPEN dans SILK_TEXTS (redessine en CLOSE pendant la vue eclatee). */
export const OPEN_SILK_INDEX = SILK_TEXTS.findIndex((t) => t.text === 'OPEN');

/**
 * Filets du panneau (polylignes [x0, z0, x1, z1, ...]) : celui qui separe
 * les voix des pages (a droite de CH, puis sous la rangee des voix) et un
 * crochet sous chaque groupe de quatre touches trig.
 */
export const SILK_LINES: readonly (readonly number[])[] = [
  // le cran du centre de TONE (revision 5) et des STRETCH : un trait a midi, derriere l'encodeur
  ...BIPOLAR.map((id) => {
    const { x, z, s } = encPos(encIndex(id));
    const r = ENCODER.collar.r * s;
    return [x, z - r - 0.05, x, z - r - 0.05 - 0.12 * s];
  }),
  // le cadre de chaque rangee nommee, ouvert en bas au centre pour son nom
  ...ENC_GROUPS.map((g) => {
    const { x0, x1, z0, mid, z } = groupSpan(g.ids);
    const half = (g.text.length * ENC_GROUP_TYPE.gapPerChar) / 2 + ENC_GROUP_TYPE.pad;
    return [mid - half, z, x0, z, x0, z0, x1, z0, x1, z, mid + half, z];
  }),
  // sous la rangee des voix (les pages dessous), puis la colonne d'OPEN a part
  [PAD.x0 - PAD.size / 2 - 0.09, PAD.rowZ[0] + 0.73, PAD.x0 + 4.5 * PAD.pitch, PAD.rowZ[0] + 0.73],
  [PAD.x0 + 4.5 * PAD.pitch, PAD.rowZ[0] - 0.5, PAD.x0 + 4.5 * PAD.pitch, PAD.rowZ[1] + 0.72],
  ...[0, 1, 2, 3].map((g) => {
    const a = keyX(4 * g) - KEYS.w / 2;
    const b = keyX(4 * g + 3) + KEYS.w / 2;
    const z = KEYS.bracketZ + keyDz(4 * g);
    const t = z - KEYS.bracketTick;
    return [a, t, a, z, b, z, b, t];
  }),
];

/* ---------- camera, orbite et cadrage (spec 20.2) ---------- */

export const FRAME_DESKTOP = 0.78;
/** portrait : 0.86, la face avant (plus pres de la camera) touchait les bords a 0.92 */
export const FRAME_MOBILE = PORTRAIT ? 0.86 : 0.92;
/** Largeur projetee de l'empreinte 14 x 9 (coins vifs) a l'azimut 45 : 0.7071 x (14 + 9). */
export const PLATEAU_W = Math.SQRT1_2 * (BODY.w + BODY.d);
/**
 * Mobile (2026-10-01) : un seul doigt ne tourne plus la vue, la machine
 * reste de face ; le cadre suit sa largeur reelle (14) et non celle de
 * l'azimut 45 (16.3) : environ 20 % plus grande a l'ecran. Tournee a deux
 * doigts, elle peut deborder un peu : c'est le geste qui le veut.
 */
export const FRONT_W = BODY.w;
/**
 * Hauteur projetee de la machine fermee a la vue par defaut (azimut 45,
 * elevation 38), mesuree sur les sommets reels (measure().fit, encodeurs
 * compris) : 10.64 pour la machine compacte du 2026-10-01 (11.68 a 14 x 9). Elle
 * tient toujours dans 86 % du canvas a la vue par defaut ; le cadre ne suit
 * jamais l'orbite (echelle constante, spec 20.1 R2-5).
 */
export const MACHINE_H = PORTRAIT ? 14.2 : 10.64;
export const FIT_H = 0.86;

/**
 * Orbite (spec 20.2.1), controleur maison scene/orbit.ts. Azimut libre,
 * mesure de +z vers +x (camera en +x +z de la cible a 45) ; elevation
 * bornee 18 a 78 deg (jamais sous la table, jamais a la verticale) ; zoom
 * = camera.zoom borne 0.55 a 2.4 (molette et pincement, jamais la
 * position) ; aucun decalage lateral. Inertie 0.08 par frame a 60 fps
 * (independante du framerate) sur la rotation et le log du zoom ; arret
 * net quand le pas d'une frame passe sous stop (0.001 rad, 0.001 de
 * log-zoom) une fois le pointeur relache ; pointeur tenu immobile : le
 * reste, sous snap, est applique d'un coup. Vitesse : pi rad par hauteur
 * de canvas (px CSS). Molette : zoom x exp(-deltaY x wheel), x wheelCtrl
 * avec Ctrl. Tape : moins de tapPx ET moins de tapMs, un seul pointeur.
 * Double tape du fond : deux tapes a moins de bgTapMs et bgTapPx. Retour
 * a la vue par defaut en resetMs (easeOutCubic, azimut par le plus court).
 * La vue a "bouge" (RESET VIEW visible) au-dela de movedDeg ou movedZoom.
 * Cible (pivot) : le centre projete de la machine fermee a la vue par
 * defaut (mesure sur les sommets reels) ; la vue eclatee la monte vers
 * EXPLODE.targetY.
 */
export const ORBIT = {
  /**
   * Vue d'arrivee (2026-10-01) : la machine de face, droite, vue de haut
   * (69 deg, l'angle choisi par Mika sur une capture : le panneau se lit en
   * entier, la face avant n'est plus qu'un filet). Le cadrage reste celui
   * de l'azimut 45 (le pire cas, PLATEAU_W et MACHINE_H) : tourner ne la
   * fait jamais sortir.
   */
  azDeg: 0,
  elDeg: 69,
  zoom: 1,
  elMinDeg: 18,
  elMaxDeg: 78,
  zoomMin: 0.55,
  zoomMax: 2.4,
  damping: 0.08,
  stop: 0.001,
  snap: 0.0001,
  radPerHeight: Math.PI,
  wheel: 0.0015,
  wheelCtrl: 6,
  tapPx: 6,
  tapMs: 400,
  bgTapMs: 300,
  bgTapPx: 30,
  resetMs: 500,
  movedDeg: 0.5,
  movedZoom: 0.01,
  /** distance de depart ; le Stage la recalcule (cadrage en perspective) */
  distance: 30,
  /**
   * Camera perspective (2026-10-01, a la place de l'orthographique : les
   * proportions se deformaient en tournant). Champ vertical de 30 deg, un
   * cadrage de photo produit : la perspective se voit sans deformer.
   */
  fovDeg: 30,
  near: 0.1,
  far: 160,
  /** centre projete de la machine fermee a la vue d'arrivee (measure().fit.targetY : 1.216, machine compacte ; 1.269 en portrait) */
  targetY: PORTRAIT ? 1.269 : 1.216,
} as const;

export const MOBILE_QUERY = '(max-width: 767px)';
export const COARSE_QUERY = '(hover: none) and (pointer: coarse)';
/**
 * Plafond de densite de pixels. Mobile 3 depuis le 2026-10-01 (1.5 avant) :
 * a 1.5 et sans lissage, la machine paraissait pixellisee sur l'iPhone de
 * Mika ; le rendu est a la demande, la pleine definition ne coute qu'aux
 * images rendues.
 */
export const DPR_MAX = { desktop: 2, mobile: 3 } as const;

/* ---------- lumieres (spec 4.2, 4.3 et 20.3.10) ---------- */

/**
 * Lumiere cle, fixe dans le MONDE (jamais attachee a la camera) : l'ombre
 * reste la meme sous tous les angles de l'orbite. Sa camera d'ombre ne
 * depend pas de la vue ; etendue 11.5 (11 en revision 1) : elle couvre la
 * pile ouverte du coin (spec 20.2.6, mesure en section 20.16).
 */
export const LIGHT_KEY = {
  color: 0xfff6e8,
  intensity: 2.2,
  x: 8,
  y: 14,
  z: 6,
  mapSize: { desktop: 1024, mobile: 1024 },
  extent: 11.5,
  near: 1,
  far: 40,
  bias: -0.0004,
  normalBias: 0.02,
  /** PCF de three 0.186 : rayon du disque d'echantillons, en texels (ombre douce) */
  radius: { desktop: 4, mobile: 3 },
} as const;

export const LIGHT_HEMI = { sky: COLOR.bone, ground: COLOR.ink, intensity: 0.35 } as const;

/**
 * Lisere chaud rasant depuis la gauche (section 19 point 80) : un
 * PointLight jaune a decroissance physique, fixe dans le monde.
 */
export const LIGHT_RIM = {
  color: COLOR.yellow,
  intensity: 6,
  decay: 2,
  x: -9,
  y: 3,
  z: 0,
} as const;

/**
 * Contre-jour (spec 20.1 R2-13) : une DirectionalLight bone fixe dans le
 * monde, depuis l'arriere gauche, sans ombre (0 draw call). La cle
 * n'atteint jamais la face arriere : sans elle, la connectique (la
 * recompense de l'orbite) serait noire. Rasante (y 2.5 et non 7 du plan)
 * et plus forte (0.9 et non 0.35) : la face arriere lit comme les flancs
 * (11,10,10 contre 2,2,2) sans eclaircir le dessus du panneau, deja cale
 * (mesures en section 20.16).
 */
export const LIGHT_BACK = { color: COLOR.bone, intensity: 0.9, x: -5, y: 2.5, z: -12 } as const;

/** Le premier rendu attend les polices, au plus ce delai. */
export const FIRST_FRAME_WAIT_MS = 1500;

/**
 * Intro (spec 7.4), mouvement complet seulement : la machine monte de
 * dropY a sa place en ms (easeOutCubic) pendant que les 16 LED font leur
 * test, de gauche a droite puis retour (ledMs, apres ledFromMs). Le
 * premier geste la termine d'un coup.
 */
/**
 * Intro (2026-10-01) : la machine arrive eclatee et s'assemble toute seule
 * en 3 s. Elle reste ouverte hold ms, le PCB rentre dans le chassis, puis
 * le panneau redescend (il part apres et finit apres : il reste toujours
 * au-dessus de la carte, aucune interpenetration), et les LED des pas font
 * leur test une fois posee. Le cadrage suit, du plan large au plan de la
 * machine fermee. Le premier geste la termine d'un coup ; rien sous
 * reduced motion.
 */
export const INTRO = {
  /** l'intro part plus bas (les couches se voient) et rejoint ORBIT.elDeg en s'assemblant */
  elFromDeg: 40,
  ms: 3100,
  hold: 300,
  pcb: { from: 300, ms: 1500 },
  plateau: { from: 800, ms: 2000 },
  ledFromMs: 2700,
  ledMs: 400,
} as const;

/* ---------- textes ---------- */

/**
 * /presskit (2026-10-01) : la machine, et la visionneuse du press kit
 * par-dessus, 250 ms apres le montage ; la machine a 20 images par seconde
 * au plus pendant qu'elle est ouverte ; la ligne d'apres fermeture 5 s.
 */
export const PRESSKIT_ROUTE = {
  re: /^\/presskit\/?$/,
  delayMs: 250,
  frameCapMs: 50,
  hintMs: 5000,
  title: 'Press Kit 2027 | Maudite Machine',
} as const;

export const COPY = {
  title: 'Maudite Machine | DJ & Producer \u00B7 Indie Dance \u00B7 Psy Prog',
  wordmark: 'MAUDITE MACHINE',
  model: 'MM-808',
} as const;

/* ---------- OPEN : vue eclatee (spec 20.3.11) ---------- */

/**
 * Vue eclatee sur le coin (spec 20.1 R2-8) : le panneau (et tout ce qui
 * est dessus) monte de lift, recule de slideZ et s'incline jusqu'a
 * tiltOpenDeg (le bord avant monte, comme un capot), rotation autour de
 * l'axe x de la machine passant par le centre du panneau ; le PCB sort du
 * chassis de pcbRise ; le chassis (et le sol) ne bouge pas. 900 ms
 * easeInOutQuart par couche : a l'ouverture le panneau part, le PCB 80 ms
 * apres ; a la fermeture le PCB d'abord, le panneau 80 ms apres : le PCB
 * ne rattrape jamais le panneau (aucune interpenetration). Cadrage : la
 * pile ouverte dans 86 % de la hauteur (fitHalfH) et le pivot qui monte a
 * targetY (mesures en section 20.16).
 */
/**
 * Portrait (2026-10-01) : le capot s'ouvre comme un couvercle a charniere
 * arriere (60 deg : son centre monte de 7.2 sin 60 et recule de
 * 7.2 (1 - cos 60)) ; glisse vers l'arriere comme sur desktop, il cachait
 * la carte, plus longue que large, sauf sa bande avant.
 */
export const EXPLODE = {
  ms: 900,
  staggerMs: 80,
  lift: PORTRAIT ? 6.3 : 4.0,
  slideZ: PORTRAIT ? -3.6 : -2.4,
  tiltOpenDeg: PORTRAIT ? -60 : -14,
  pcbRise: 0.9,
  /**
   * Ouverture du 2026-10-01 (plus grande) : la pile fait 11.30 de haut a la
   * vue d'arrivee et 16.76 a l'azimut 45 (le pire cas). 8.4 garde la part de
   * hauteur d'avant a l'arrivee (67 %) et tient encore l'azimut 45 entier
   * (100 % au lieu de 86 %) : la machine ouverte ne rapetisse que de 10 %.
   */
  fitHalfH: PORTRAIT ? 11.5 : 8.4,
  /** son centre projete a la vue d'arrivee (measure().fit.targetY, ouverte) ; portrait : la carte au milieu, le couvercle en haut */
  targetY: PORTRAIT ? 3.9 : 5.562,
  /** echelle verticale des composants replies (jamais 0 : matrice inversible) */
  partsMin: 0.001,
  /**
   * les puces ne repondent au pointeur qu'une fois decouvertes (panneau a
   * 85 % de sa course)
   */
  chipsFrom: 0.85,
} as const;

export type ChipId = 'goodies' | 'merch' | 'studio';

/**
 * Grosse puce (spec 5.6) : corps 1.7 x 0.2 x 1.2 pose 0.03 au-dessus de la
 * carte ; un point jaune marque la broche 1 des puces cliquables. Boitier
 * QFP depuis le 2026-10-01 : des pattes fines (0.04 de large, pas de 0.1)
 * sur les quatre cotes, 14 devant et derriere, 9 a gauche et a droite,
 * 0.14 de long, au ras du corps.
 */
export const CHIP = {
  w: 1.7,
  d: 1.2,
  y0: 0.03,
  y1: 0.23,
  legW: 0.04,
  legH: 0.035,
  legD: 0.14,
  legZ: 0.66,
  legX: 0.91,
  legPitch: 0.1,
  legsPerSide: 14,
  legsPerEnd: 9,
  dotR: 0.07,
  /** leur serigraphie : centree 1.02 devant le centre de la puce */
  labelDz: 1.02,
  /** survol : la puce se souleve (150 ms) */
  rise: 0.06,
  riseMs: 150,
  /**
   * Puce qui sort du site (LABEL, spec 20.5) : au survol et au focus
   * clavier de son jumeau, le dessus de la puce passe au jaune, sa
   * serigraphie aussi, et le chevron sortant (le trace de ExternalMark,
   * haut comme les capitales) apparait extGapPx apres le texte (px de la
   * texture desktop) ; le routage des pistes lui garde sa place. Son trait
   * (extStroke, dans la boite de 12) suit la graisse 700 de la serigraphie.
   */
  extGapPx: 7,
  extStroke: 2,
} as const;

/** Page Bandcamp du label (brief, verifiee par la session principale) : puce LABEL et section LABEL. */
export const LABEL_URL = 'https://vrstlrecords.bandcamp.com';

/**
 * Chevron sortant des liens qui quittent le site (spec 20.5) : une fleche
 * nord-est a equerre dans une boite de 12, trait de 1.4. Le meme trace pour
 * les liens HTML (ui/ExternalLink.tsx) et la puce LABEL du PCB.
 */
export const EXTERNAL_MARK = { d: 'M3.5 2.5h6v6M9.5 2.5l-7 7', box: 12, stroke: 1.4 } as const;

/**
 * Les trois puces cliquables (revision 4), rangee a z 2.6 de la carte :
 * sous le panneau leve et recule, la moitie avant de la carte se voit
 * depuis la vue par defaut, les cotes et les vues basses de l'arriere en
 * montrent une partie. GOODIES, MERCH et STUDIO ouvrent leur section (et
 * portent l'ancre de sa trace). LABEL et LIVE ont quitte la carte : ce
 * sont des pads de page (et des boutons du Dock), machine fermee. Une puce
 * a href (lien sortant) reste possible : pcb.ts sait la dessiner.
 */
export const CHIPS: readonly {
  id: ChipId;
  silk: string;
  x: number;
  z: number;
  /** nom du jumeau */
  aria: string;
  /** lien sortant du jumeau (nouvel onglet) ; null : la puce ouvre sa section */
  href: string | null;
  /** section ouverte par la puce */
  section: 'goodies' | 'merch' | 'studio' | null;
}[] = [
  { id: 'goodies', silk: 'GOODIES', ...pcbAt(-3.4, 2.45), aria: 'Goodies: wallpapers and covers', href: null, section: 'goodies' },
  { id: 'merch', silk: 'MERCH', ...pcbAt(0, 2.45), aria: 'Merch: apparel and stickers', href: null, section: 'merch' },
  { id: 'studio', silk: 'STUDIO', ...pcbAt(3.4, 2.45), aria: 'Studio: setup, lessons, print', href: null, section: 'studio' },
];

/**
 * Composants de decor (spec 5.6), repere de la carte (x, z), replaces pour
 * la vue ouverte du coin (section 20.16) : la bande avant de la carte
 * (z 0 a 3.9) et la bande droite (x > 4.4) se voient depuis la vue par
 * defaut, le reste passe sous le panneau leve.
 */
export const PCB_PARTS = {
  small: [pcbAt(-5.3, 2.6), pcbAt(5.3, 2.6), { x: 4.45, z: -2.75 }, pcbAt(-2.7, -2.9)],
  /** references serigraphiees en blanc sur le dessus des petites puces */
  smallRefs: ['TL072', 'NE555', '74HC595', 'LM386'],
  caps: [{ x: -4.5, z: 3.02 }, pcbAt(1.7, 2.3), pcbAt(5.55, -1.6), pcbAt(5.55, -2.35), pcbAt(-3.6, -2.2), pcbAt(0.4, -2.8)],
  /** deux hauteurs de condensateurs electrolytiques */
  capTall: [true, false, true, false, true, false],
  cell: pcbAt(5.35, -0.55),
  /** resistances CMS : la rangee d'origine et quatre entre les puces, code a trois chiffres */
  resistors: [
    ...Array.from({ length: 10 }, (_, k) => pcbAt(-4.6 + 0.9 * k, 1.25)),
    { x: -1.5, z: 2.3 },
    { x: -1.5, z: 2.6 },
    { x: 1.5, z: 2.6 },
    { x: -4.71, z: 1.66 },
    // 2026-10-01 : une rangee de plus sous MAUDITE MACHINE devenue plus petite
    ...[-1.2, -0.2, 0.8, 1.8, 2.8].map((x) => ({ x, z: 0.35 })),
  ],
  resistorCodes: ['103', '472', '221', '100', '331', '473', '102', '222', '470', '104', '101', '683', '152', '334', '473', '102', '220', '104', '331'],
  /** condensateurs ceramiques CMS (decouplage) */
  ceramics: [
    { x: -1.8, z: 1.7 },
    { x: -1.2, z: 1.7 },
    { x: 1.15, z: 1.55 },
    { x: 1.9, z: 1.55 },
    { x: 4.2, z: 1.6 },
    { x: 5.2, z: 1.6 },
    { x: -3.75, z: -2.8 },
    { x: -3.75, z: -1.62 },
    { x: 2.7, z: -1.9 },
    { x: -0.2, z: -1.6 },
    ...[-0.7, 0.3, 1.3, 2.3].map((x) => ({ x, z: 0.35 })),
  ],
  crystals: [pcbAt(-1.7, 3.5), pcbAt(1.7, 3.5)],
  /** regulateur TO-220 debout contre son dissipateur vertical, dans le plan de masse */
  regulator: { x: -4.3, z: -2.1 },
  /** connecteur de nappe 2 x 8 a broches dorees, et bornier a vis 3 points */
  header: { x: 1.7, z: -2.7, cols: 8 },
  terminal: { x: 3.2, z: -2.85, n: 3 },
  /** LED temoin, allumee */
  led: { x: 4.4, z: 3.12 },
  /** trous de fixation et leurs vis cruciformes, aux quatre coins */
  holes: [
    { x: -5.3, z: -3.1 },
    { x: 5.3, z: -3.1 },
    { x: -5.3, z: 3.1 },
    { x: 5.3, z: 3.1 },
  ],
  /** plan de masse hachure (unites de la carte) */
  pour: { x0: -5.5, z0: -3.3, x1: -0.7, z1: -0.55 },
  small3: { w: 0.8, h: 0.14, d: 0.6 },
  cap3: { r: 0.28, h: 0.6, hShort: 0.4, topH: 0.02 },
  cell3: { r: 0.5, h: 0.14 },
  resistor3: { w: 0.32, h: 0.08, d: 0.16 },
  ceramic3: { w: 0.26, h: 0.12, d: 0.14 },
  crystal3: { r: 0.12, l: 0.5 },
} as const;

/**
 * Serigraphie du PCB (spec 5.7), bone a 90 %, px de la texture desktop,
 * texte centre en z sur sa hauteur de capitale, dans la bande visible de
 * la vue ouverte. Pas de ville (regle du site, section 19 point 103) ;
 * pour la remettre : { text: 'MONTPELLIER', x: 6.0, z: -0.3, px: 28, align: 'right' }.
 */
export const PCB_SILK: readonly { text: string; x: number; z: number; px: number; align: 'left' | 'right' }[] = [
  { text: 'MAUDITE MACHINE', ...pcbAt(-6.0, 0.4), px: 26, align: 'left' },
  { text: 'MM-808  REV 4.0', ...pcbAt(6.0, 0.4), px: 18, align: 'right' },
  { text: 'V.4 2026', ...pcbAt(6.1, 1.25), px: 14, align: 'right' },
];

/* ---------- jumeaux HTML et clavier (spec 6.1, 6.3, 13 et 20.7) ---------- */

/** Noms des pads de voix pour leur jumeau : "Bass drum pad, key A". */
export const PAD_ARIA: Readonly<Record<Inst, string>> = {
  BD: 'Bass drum pad, key A',
  SD: 'Snare pad, key S',
  TOM: 'Tom pad, key D',
  CH: 'Hi-hat pad, key F',
  OH: 'Open hi-hat pad, key G',
};

/**
 * Jumeau du pad OPEN (spec 6.1) : un nom fixe, l'etat passe par
 * aria-pressed (un bouton bascule ne change pas de nom, revue).
 */
export const OPEN_ARIA = 'Open the machine, key 6 or O';

/** Bouton de retour a la vue par defaut (spec 20.2.9), visible des que la vue a bouge. */
export const RESET_VIEW = { label: 'RESET VIEW', aria: 'Reset view' } as const;

/** RUN : nom fixe, l'etat de lecture passe par aria-pressed (revue). */
export const TWIN_ARIA = {
  run: 'Run, Space',
  clear: 'Clear pattern',
  mute: 'Mute the selected voice',
  solo: 'Solo the selected voice',
  random: 'Random house pattern',
  group: 'MM-808 drum machine',
} as const;

/**
 * Encodeurs au clavier (jumeaux role slider) : fleches 1 BPM ou 2 %, avec
 * Maj ou Page 5 BPM ou 10 % ; Debut et Fin aux butees.
 */
export const DIAL_KEYS = { tempo: { step: 1, big: 5 }, pot: { step: 0.02, big: 0.1 } } as const;

/**
 * Reglage fin, Maj tenue sur un potard (2026-10-01, comme dans Ableton) :
 * le glisser dix fois plus fin (1 % pour 15 px au lieu de 1.5), la molette
 * a 1 % le cran (TEMPO garde 1 BPM le cran, deja son plus petit pas).
 */
export const DIAL_FINE = { drag: 0.1, wheelStep: 0.01 } as const;

/* ---------- apparence : sombre ou claire (2026-10-01) ---------- */

export type Appearance = 'dark' | 'light';

/**
 * Encre de la serigraphie du panneau et de la face arriere (r, g, b) :
 * bone sur la machine noire, le gris du press kit (#434343) sur la
 * machine claire. Le PCB garde la sienne (bone sur vert).
 */
export const INK = { silk: [246, 241, 231] as number[] };
/** L'encre de la serigraphie a une opacite donnee (canvas). */
export const silkA = (a: number): string => `rgba(${INK.silk[0]}, ${INK.silk[1]}, ${INK.silk[2]}, ${a})`;

/** Exposition du rendu, selon l'apparence. */
export const EXPOSURE = { value: 1 };
/** L'apparence posee sur la scene (lue a la construction des modules). */
export const APPEARANCE: { current: Appearance } = { current: 'dark' };

type Mutable<T> = { -readonly [K in keyof T]: T[K] extends object ? Mutable<T[K]> : T[K] };

/**
 * La machine claire (demande de Mika, 2026-10-01) : un blanc a peine creme,
 * plus blanc que le papier du press kit, sur une table creme (#F1EDE5) ;
 * serigraphie gris #434343, noms des pages en orange #FF6A13, encodeurs
 * charbon a repere bone, touches et pads gris tres clair, ecran noir.
 * Teintes AFFICHEES visees ; gains cales par lecture de pixels comme ceux
 * de la machine noire.
 */
const LIGHT = {
  hex: {
    ink: '#F1EDE5',
    body: '#E6E2DA',
    bodyEdge: '#F8F6F1',
    bodyTop: '#DCD8CF',
    rubber: '#3B3A37',
    panel: '#FAF8F4',
    panelEdge: '#FFFFFF',
    panelSide: '#E4E0D8',
    pad: '#E6E3DD',
    key: '#E8E5DF',
    encoder: '#26262A',
    collar: '#D4D0C8',
    line: '#D7D3CB',
    ledHover: '#8E8A83',
  } as Partial<Record<Tone, string>>,
  gain: { body: 1.25, bodyEdge: 1, bodyTop: 1.1, panel: 1, panelEdge: 1, panelSide: 1.2, pad: 1.05, encoder: 2.4, collar: 1 } as Partial<Record<Tone, number>>,
  lit: { key: [0.84, 0.82, 0.78], clear: [0.82, 0.8, 0.76] } as Record<string, number[]>,
  material: { panel: { roughness: 0.5, metalness: 0 }, chassis: { roughness: 0.7, metalness: 0 }, key: { roughness: 0.55, metalness: 0 }, pad: { roughness: 0.85, metalness: 0 } },
  /** lueurs des pads en orange (le jaune palit sur le caoutchouc clair) */
  glow: {
    selected: [0.05, 0.016, 0.0],
    active: [0.42, 0.1, 0.0],
    flash: [0.55, 0.14, 0.0],
    orange: [0.32, 0.035, 0.0],
    orangeDim: [0.08, 0.01, 0.0],
  } as Record<string, number[]>,
  floor: { haloHex: '#FAF8F4', shadow: 0.32, contact: 0.32 },
  hemi: { ground: 0xe9e5dd, intensity: 0.6, sky: 0xffffff },
  /** lumieres blanches neutres : la machine reste blanche, pas creme */
  key: 0xffffff,
  rim: 1.5,
  silk: [67, 67, 67],
  exposure: 1.3,
  /** appui d'une touche ou d'un bouton : un eclat orange franc (le faible ne se voyait pas sur le clair) */
  press: [0.55, 0.14, 0.012],
  /** OPEN, multiplicateur de sa couleur : l'orange plein sur le caoutchouc clair */
  openTint: [1.32, 0.19, 0.012],
  /** pads de voix coupes (rose poudre) et en solo (bleu) */
  voiceTint: { mute: '#E3B1A9', solo: '#8DB2E4' },
};

/** Multiplicateur de couleur du pad OPEN (blanc : la teinte du caoutchouc). */
export const OPEN_TINT: number[] = [1, 1, 1];
/**
 * Teinte d'une touche enfoncee (albedo lineaire), machine claire : l'orange
 * plein, l'eclat seul palissait en peche. null : l'eclat seul (machine noire).
 */
export const PRESS_TINT: { rgb: number[] | null } = { rgb: null };

/** L'etat sombre d'origine, copie au chargement pour pouvoir y revenir. */
const DARK = {
  hex: { ...HEX },
  gain: { ...GAIN },
  lit: Object.fromEntries(Object.entries(LIT).map(([k, v]) => [k, [...v]])) as Record<string, number[]>,
  material: JSON.parse(JSON.stringify(MATERIAL)) as Mutable<typeof MATERIAL>,
  glow: Object.fromEntries((['selected', 'active', 'flash', 'orange', 'orangeDim'] as const).map((k) => [k, [...PAD_GLOW[k]]])) as Record<string, number[]>,
  floor: { haloHex: FLOOR.haloHex as string, shadow: FLOOR.shadow as number, contact: FLOOR.contact.opacity as number },
  hemi: { ground: LIGHT_HEMI.ground as number, intensity: LIGHT_HEMI.intensity as number, sky: LIGHT_HEMI.sky as number },
  key: LIGHT_KEY.color as number,
  rim: LIGHT_RIM.intensity as number,
  press: [...STEP_PRESS.glow],
  silk: [...INK.silk],
  voiceTint: { ...VOICE_TINT },
};

/**
 * Pose une apparence sur les constantes de la scene, AVANT la creation du
 * Stage (index.tsx le reconstruit a chaque changement) : chaque module lit
 * ses teintes a la construction. Les memes objets sont modifies en place :
 * les references gardees ailleurs (pads, encodeurs) suivent.
 */
export function applyAppearance(a: Appearance): void {
  const L = a === 'light';
  const hex = HEX as Record<Tone, string>;
  Object.assign(hex, DARK.hex, L ? LIGHT.hex : {});
  const color = COLOR as Record<Tone, number>;
  for (const k of Object.keys(hex) as Tone[]) color[k] = parseInt(hex[k].slice(1), 16);
  const gain = GAIN as Record<string, number>;
  for (const k of Object.keys(gain)) delete gain[k];
  Object.assign(gain, DARK.gain, L ? LIGHT.gain : {});
  for (const [k, v] of Object.entries(DARK.lit)) Object.assign((LIT as unknown as Record<string, number[]>)[k], L && LIGHT.lit[k] ? LIGHT.lit[k] : v);
  const mat = MATERIAL as unknown as Mutable<typeof MATERIAL>;
  for (const k of Object.keys(DARK.material) as (keyof typeof MATERIAL)[]) {
    Object.assign(mat[k], DARK.material[k], L ? (LIGHT.material as Record<string, object>)[k] ?? {} : {});
  }
  for (const k of ['selected', 'active', 'flash', 'orange', 'orangeDim'] as const) Object.assign(PAD_GLOW[k] as unknown as number[], L ? LIGHT.glow[k] : DARK.glow[k]);
  Object.assign(STEP_PRESS.glow as unknown as number[], L ? LIGHT.press : DARK.press);
  const floor = FLOOR as unknown as { haloHex: string; shadow: number; contact: { opacity: number } };
  floor.haloHex = L ? LIGHT.floor.haloHex : DARK.floor.haloHex;
  floor.shadow = L ? LIGHT.floor.shadow : DARK.floor.shadow;
  floor.contact.opacity = L ? LIGHT.floor.contact : DARK.floor.contact;
  const hemi = LIGHT_HEMI as unknown as { ground: number; intensity: number; sky: number };
  hemi.ground = L ? LIGHT.hemi.ground : DARK.hemi.ground;
  hemi.intensity = L ? LIGHT.hemi.intensity : DARK.hemi.intensity;
  hemi.sky = L ? LIGHT.hemi.sky : DARK.hemi.sky;
  (LIGHT_KEY as unknown as { color: number }).color = L ? LIGHT.key : DARK.key;
  (LIGHT_RIM as unknown as { intensity: number }).intensity = L ? LIGHT.rim : DARK.rim;
  INK.silk.splice(0, 3, ...(L ? LIGHT.silk : DARK.silk));
  EXPOSURE.value = L ? LIGHT.exposure : 1;
  OPEN_TINT.splice(0, 3, ...(L ? LIGHT.openTint : [1, 1, 1]));
  PRESS_TINT.rgb = L ? [1.0, 0.24, 0.035] : null;
  BACKDROP.transparent = !L;
  Object.assign(VOICE_TINT, L ? LIGHT.voiceTint : DARK.voiceTint);
  APPEARANCE.current = a;
}
