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
  /** pas programme : orange, pour voir d'un coup d'oeil quels pas sont mis */
  ledSet: '#FF6A13',
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
 * Chassis : 14 x 9 au sol, dessous a y 0.12 (les pieds), 2.2 de haut a
 * l'arriere et 1.3 a l'avant au-dessus du dessous : le panneau s'incline
 * de atan(0.9 / 9) = 5.711 deg vers l'utilisateur (la signature Elektron).
 * Toutes les aretes sont chanfreinees (chamfer).
 */
export const BODY = { w: 14, d: 9, back: 2.2, front: 1.3, feet: 0.12, chamfer: 0.06 } as const;
/** Inclinaison du panneau (rad) : son avant descend. */
export const TILT = Math.atan((BODY.back - BODY.front) / BODY.d);

/**
 * Panneau (spec 20.3.3) : dalle a coins arrondis 13.8 x 8.845 + chanfrein
 * de 0.1 (empreinte 14 x 9.045 le long de la pente, 14 x 9 au sol), 0.14
 * d'epaisseur, dessus a y 0 du repere panneau. Le cadre de l'ecran OLED
 * lui est fusionne.
 */
export const PANEL = {
  shapeW: 13.8,
  shapeD: 8.845,
  radius: 0.2,
  /** three subdivise les arcs en 2 x curveSegments */
  curveSegments: 4,
  t: 0.14,
  bevelThickness: 0.05,
  bevelSize: 0.1,
} as const;
/** Longueur de la pente du panneau : 9 / cos 5.711 = 9.045. */
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
export const FEET = { r: 0.42, h: BODY.feet, x: 6.45, z: 3.95, segments: { desktop: 16, mobile: 12 } } as const;

/**
 * Connectique de la face arriere (z -4.5), decorative, fusionnee au
 * chassis (zero draw call) : la recompense de l'orbite. Prise secteur,
 * USB-B, deux jacks 6.35 (ecrou hexagonal, fut, trou). x, y : centre.
 */
export const CONNECTORS = {
  inlet: { x: 5.2, y: 1.15, w: 1.1, h: 0.75, d: 0.06, recess: { w: 0.8, h: 0.5 }, pin: { w: 0.05, h: 0.18, d: 0.04, dx: 0.2 } },
  usb: { x: 3.9, y: 1.15, w: 0.46, h: 0.42, d: 0.05, inner: { w: 0.3, h: 0.26 } },
  jacks: [
    { x: -3.6, y: 1.1 },
    { x: -4.4, y: 1.1 },
  ],
  nut: { r: 0.2, h: 0.05 },
  barrel: { r: 0.14, h: 0.08 },
  hole: { r: 0.065 },
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

/** Carte : 12.6 x 0.1 x 7.8 dans pcbGroup (incline comme le panneau). */
export const PCB = {
  w: 12.6,
  d: 7.8,
  h: 0.1,
  tex: { desktop: [1024, 640], mobile: [512, 320] },
  /** generateur des pistes (spec 5.7) : grille de 0.4, graine 808 (mulberry32) */
  grid: 0.4,
  seed: 808,
  traces: 24,
  vias: 20,
  /** en px de la texture desktop (1024 de large) ; la moitie sur mobile */
  traceW: 3,
  padR: 6,
  padRing: 2,
  outline: 1,
  chipFrame: 2,
  designatorPx: 16,
  chipLabelPx: 30,
} as const;

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
  tex: { desktop: [2048, 1323], mobile: [1024, 662] },
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

/* ---------- panneau : moitie gauche (spec 20.3.4) ---------- */

/** Ecran OLED en haut a gauche : verre 3.6 x 1.35, cadre fusionne au panneau. */
export const OLED = {
  x: -4.5,
  z: -2.35,
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

export type EncId = 'tempo' | 'tone' | 'level' | 'swing' | 'dist' | 'reverb';

/**
 * Six encodeurs noirs a repere blanc, sous l'ecran (spec 20.3.7) : corps
 * legerement conique (0.3 a la base, 0.285 en haut, 0.42 de haut), repere
 * bone du centre vers l'arriere, collerette a la base.
 */
export const ENCODER = {
  r: 0.3,
  rTop: 0.285,
  h: 0.42,
  z: -0.95,
  x0: -6.0,
  pitch: 0.98,
  labelZ: -0.45,
  collar: { r: 0.36, h: 0.025 },
  mark: { w: 0.04, h: 0.012, d: 0.2 },
  segments: { desktop: 32, mobile: 20 },
} as const;
export const encX = (i: number): number => ENCODER.x0 + ENCODER.pitch * i;

/** De gauche a droite ; aria : nom du jumeau (role slider). */
export const ENCODERS: readonly { id: EncId; label: string; aria: string }[] = [
  { id: 'tempo', label: 'TEMPO', aria: 'Tempo' },
  { id: 'tone', label: 'TONE', aria: 'Tone' },
  { id: 'level', label: 'LEVEL', aria: 'Level' },
  { id: 'swing', label: 'SWING', aria: 'Swing' },
  { id: 'dist', label: 'DIST', aria: 'Distortion' },
  { id: 'reverb', label: 'REVERB', aria: 'Reverb' },
];

/** RUN/STOP et CLEAR : boutons carres sous les encodeurs. */
export const TRANSPORT = {
  size: 0.62,
  h: 0.1,
  z: 0.35,
  labelZ: 0.85,
  run: { x: -6.0 },
  clear: { x: -5.02 },
} as const;

/* ---------- panneau : moitie droite, les 12 pads (spec 20.3.5) ---------- */

export type Inst = 'BD' | 'SD' | 'TOM' | 'CH';
/** Les sept pages du site, pads de navigation (touches 1 a 7). */
export type PageId = 'tracks' | 'mixtapes' | 'press' | 'shows' | 'contact' | 'label' | 'sonaa';
/** Les sections du panneau : les sept pages, LIVE et STUDIO (puces de la vue eclatee). */
export type SectionId = PageId | 'live' | 'studio' | 'merch';
export type PadId = Inst | PageId | 'open';

/**
 * Pad en caoutchouc : 0.96 x 0.22 x 0.96 a coins arrondis (0.08), dome de
 * 0.04 sur son dessus plat ; deux rangees de six, pas de 1.12. Frappe : il
 * s'enfonce de 0.06 en 60 ms, remonte en 180 ms. Halo : un carre de 1.25
 * a plat sous chaque pad (retroeclairage).
 */
export const PAD = {
  size: 0.96,
  height: 0.22,
  radius: 0.08,
  segments: { desktop: 3, mobile: 2 },
  dome: 0.04,
  domeSegments: 6,
  /** hauteur du plan du dome, un soupcon au-dessus du dessus plat (pas de z-fight) */
  domeY: 0.222,
  x0: 0.47,
  pitch: 1.12,
  rowZ: [-2.4, -1.0],
  /** serigraphie sous chaque pad */
  labelDz: 0.62,
  press: 0.06,
  halo: 1.25,
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

const padAt = (i: number): { x: number; z: number } => ({ x: PAD.x0 + PAD.pitch * (i % 6), z: PAD.rowZ[i < 6 ? 0 : 1] });

/**
 * Les 12 pads en ordre de lecture (spec 20.3.5) : rangee du haut BD SD TOM
 * CH TRACKS MIXTAPES, rangee du bas PRESS SHOWS CONTACT LABEL SONAA OPEN.
 * Voix : A S D F. Pages : 1 a 7. OPEN : 8 (et O).
 */
export const PADS: readonly PadSpec[] = [
  { id: 'BD', kind: 'voice', label: 'BD', key: 'A', ...padAt(0) },
  { id: 'SD', kind: 'voice', label: 'SD', key: 'S', ...padAt(1) },
  { id: 'TOM', kind: 'voice', label: 'TOM', key: 'D', ...padAt(2) },
  { id: 'CH', kind: 'voice', label: 'CH', key: 'F', ...padAt(3) },
  { id: 'tracks', kind: 'page', label: 'TRACKS', key: '1', ...padAt(4) },
  { id: 'mixtapes', kind: 'page', label: 'MIXTAPES', key: '2', ...padAt(5) },
  { id: 'press', kind: 'page', label: 'PRESS', key: '3', ...padAt(6) },
  { id: 'shows', kind: 'page', label: 'SHOWS', key: '4', ...padAt(7) },
  { id: 'contact', kind: 'page', label: 'CONTACT', key: '5', ...padAt(8) },
  { id: 'label', kind: 'page', label: 'LABEL', key: '6', ...padAt(9) },
  { id: 'sonaa', kind: 'page', label: 'SONAA', key: '7', ...padAt(10) },
  { id: 'open', kind: 'open', label: 'OPEN', key: '8', ...padAt(11) },
];

/** Les sept pages, dans l'ordre des pads (onglets de la feuille, touches 1 a 7). */
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
} as const;

/**
 * Intensite du halo additif autour de chaque pad, par etat (jaune, ou
 * blanc chaud pour la selection, lineaire x intensite) : +20 niveaux au
 * ras d'une page au repos, +75 autour de la page ouverte.
 */
export const PAD_HALO = { selected: 0.025, faint: 0.025, hover: 0.06, active: 0.35, flash: 0.45 } as const;

/* ---------- panneau : les 16 touches trig (spec 20.3.6) ---------- */

/**
 * Touches trig etroites (0.52 x 0.9, 0.1 de haut, coins de 0.04) en bas du
 * panneau, une LED au-dessus de chacune (0.22 x 0.07), numeros 1 a 16
 * dessous, un crochet serigraphie sous chaque groupe de quatre.
 */
export const KEYS = {
  count: 16,
  x0: -6.0,
  pitch: 0.8,
  z: 2.5,
  w: 0.52,
  d: 0.9,
  h: 0.1,
  radius: 0.04,
  ledZ: 1.72,
  ledW: 0.22,
  ledD: 0.07,
  ledY: 0.006,
  numberZ: 3.18,
  bracketZ: 3.35,
  bracketTick: 0.06,
} as const;
export const keyX = (i: number): number => KEYS.x0 + KEYS.pitch * i;

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
export const INST_NAMES: Readonly<Record<Inst, string>> = { BD: 'bass drum', SD: 'snare', TOM: 'tom', CH: 'hi-hat' };

/**
 * Albedos LINEAIRES des touches (spec 20.3.6), cales sur la couleur
 * AFFICHEE du dessus a 1440 x 900 (vue par defaut) : key #1E1F23 ; run :
 * red #C8442F ; runOn (avec RUN_GLOW) : jaune, le bleu hors gamut sous
 * l'ACES ; clear : graphiteHi #1C1D21.
 */
export const LIT = {
  key: [0.0286, 0.0299, 0.0495],
  run: [0.61, 0.0805, 0.0478],
  runOn: [1.0709, 0.3069, 0],
  clear: [0.0217, 0.0229, 0.0385],
  /** repere des encodeurs : bone */
  mark: [2.8308, 2.6988, 2.4532],
} as const;

/** Emissif de RUN pendant la lecture : jaune x 0.5 (spec 5.3), lineaire. */
export const RUN_GLOW = [0.444, 0.2635, 0.0148] as const;

/**
 * TEMPO (spec 6.1) : glisser vertical, 100 px = 50 BPM (vers le haut =
 * plus vite) ; molette 1 BPM par cran de 100 px ; double tape = 130.
 * Angle d'un encodeur : 270 deg de course centree sur le repere a 0, sens
 * horaire vu du dessus quand la valeur monte (section 19). Le glisser part
 * au seuil de l'orbite (6 px) ; parti d'un encodeur, il ne fait jamais
 * orbiter la vue : l'axe dominant au seuil le tourne (vers le haut ou vers
 * la droite = plus ; spec 20.17 FX-5, qui remplace la regle verticale de
 * R2-2). Au doigt, apres un repos seulement (ENC_GRAB).
 */
export const TEMPO_UI = { pxPerBpm: 2, wheelPx: 100, tapMs: 350, sweepDeg: 270 } as const;

/**
 * Les cinq autres encodeurs : glisser, 150 px = toute la course ; molette
 * 2 % par cran de 100 px ; double tape = valeur de depart (TONE ouvert,
 * LEVEL 80 %, SWING, DIST et REVERB a 0, leur neutre). Ecran : la valeur
 * reste 1200 ms en ligne 3 (spec 20.3.8).
 */
export const POT_UI = {
  pxRange: 150,
  wheelPx: 100,
  wheelStep: 0.02,
  readoutMs: 1200,
  reset: { tone: 1, level: 0.8, swing: 0, dist: 0, reverb: 0 },
} as const;

/**
 * Au doigt, un encodeur (TEMPO compris) ne se prend qu'apres touchHoldMs
 * de repos sur lui : un glisser qui en part plus tot fait tourner la vue
 * (revue de la revision 2 : au telephone les six cibles couvrent 12 % de
 * la machine, orbiter changeait le tempo et le sauvegardait). La souris
 * et le stylet gardent la prise immediate (spec 20.17 FX-5).
 */
export const ENC_GRAB = { touchHoldMs: 250 } as const;

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
  label: 'LABEL',
  sonaa: 'SONAA',
  live: 'LIVE',
  studio: 'STUDIO',
  merch: 'MERCH',
};

/**
 * Cadrage quand une section est ouverte (desktop, spec 20.2.5 et R2-6) :
 * la machine glisse a gauche du panneau, centre a stageW / 2 avec
 * stageW = bord gauche du panneau - gap, et tient par son cercle
 * englobant (rayon horizontal : la plus grande distance d'un sommet a
 * l'axe vertical du pivot, measure().fit.radius sur les maillages reels :
 * 8.32 fermee, les coins du chassis ; 9.17 ouverte, le panneau recule) :
 * aucune orientation ne la fait passer sous le panneau a zoom <= 1.
 * Jamais plus grande qu'au repos.
 */
export const SECTION_FRAME = { ms: 400, gap: 16, radius: { closed: 8.33, open: 9.18 } } as const;

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
}

/** Le libelle du pad OPEN (OPEN, CLOSE vue eclatee) : l'index de son texte dans SILK_TEXTS. */
const PAD_CAP = 0.09;
const padLabel = (p: PadSpec): SilkText =>
  p.kind === 'voice'
    ? { text: p.label, x: p.x, z: p.z + PAD.labelDz, cap: PAD_CAP, maxW: 1.0, group: 'pads' }
    : { text: p.label, x: p.x, z: p.z + PAD.labelDz, cap: PAD_CAP, maxW: 1.0, group: 'pads', weight: 700, ink: 'orange', alpha: 1 };

export const SILK_TEXTS: readonly SilkText[] = [
  { text: 'MAUDITE MACHINE', x: -6.3, z: -3.95, cap: 0.2, align: 'left', weight: SILK.strongWeight },
  { text: 'MM-808', x: -2.3, z: -3.95, cap: 0.13, align: 'left' },
  { text: 'V.4 / 2026', x: 6.5, z: -3.95, cap: 0.07, align: 'right', alpha: 0.45 },
  { text: 'VOICES', x: PAD.x0 - PAD.size / 2, z: -3.05, cap: 0.06, align: 'left' },
  { text: 'PAGES', x: PAD.x0 + 4 * PAD.pitch - PAD.size / 2, z: -3.05, cap: 0.06, align: 'left' },
  ...ENCODERS.map((e, i) => ({ text: e.label, x: encX(i), z: ENCODER.labelZ, cap: 0.085, maxW: 0.9, group: 'enc' })),
  { text: 'RUN/STOP', x: TRANSPORT.run.x, z: TRANSPORT.labelZ, cap: 0.085, maxW: 0.9, group: 'enc' },
  { text: 'CLEAR', x: TRANSPORT.clear.x, z: TRANSPORT.labelZ, cap: 0.085, maxW: 0.9, group: 'enc' },
  ...PADS.map(padLabel),
  ...Array.from({ length: KEYS.count }, (_, i) => ({ text: String(i + 1), x: keyX(i), z: KEYS.numberZ, cap: 0.075 })),
];
/** Index du libelle du pad OPEN dans SILK_TEXTS (redessine en CLOSE pendant la vue eclatee). */
export const OPEN_SILK_INDEX = SILK_TEXTS.findIndex((t) => t.text === 'OPEN');

/**
 * Filets du panneau (polylignes [x0, z0, x1, z1, ...]) : celui qui separe
 * les voix des pages (a droite de CH, puis sous la rangee des voix) et un
 * crochet sous chaque groupe de quatre touches trig.
 */
export const SILK_LINES: readonly (readonly number[])[] = [
  [4.39, -3.2, 4.39, -1.6, -0.1, -1.6],
  ...[0, 1, 2, 3].map((g) => {
    const a = keyX(4 * g) - KEYS.w / 2;
    const b = keyX(4 * g + 3) + KEYS.w / 2;
    const z = KEYS.bracketZ;
    const t = z - KEYS.bracketTick;
    return [a, t, a, z, b, z, b, t];
  }),
];

/* ---------- camera, orbite et cadrage (spec 20.2) ---------- */

export const FRAME_DESKTOP = 0.78;
export const FRAME_MOBILE = 0.92;
/** Largeur projetee de l'empreinte 14 x 9 (coins vifs) a l'azimut 45 : 0.7071 x (14 + 9). */
export const PLATEAU_W = Math.SQRT1_2 * (BODY.w + BODY.d);
/**
 * Hauteur projetee de la machine fermee a la vue par defaut (azimut 45,
 * elevation 38), mesuree sur les sommets reels (measure().fit, encodeurs
 * compris) : 11.68 (le plan disait 11.84, sur un modele grossier). Elle
 * tient toujours dans 86 % du canvas a la vue par defaut ; le cadre ne suit
 * jamais l'orbite (echelle constante, spec 20.1 R2-5).
 */
export const MACHINE_H = 11.68;
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
  azDeg: 45,
  elDeg: 38,
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
  distance: 30,
  near: 0.1,
  far: 100,
  /** centre projete de la machine fermee a la vue par defaut (measure().fit.targetY : 1.265) */
  targetY: 1.265,
} as const;

export const MOBILE_QUERY = '(max-width: 767px)';
export const COARSE_QUERY = '(hover: none) and (pointer: coarse)';
export const DPR_MAX = { desktop: 2, mobile: 1.5 } as const;

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
  mapSize: { desktop: 1024, mobile: 512 },
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
export const INTRO = { ms: 700, dropY: 0.6, ledFromMs: 100, ledMs: 400 } as const;

/* ---------- textes ---------- */

export const COPY = {
  title: 'Maudite Machine | DJ & Producer \u00B7 Hypnotic Techno',
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
export const EXPLODE = {
  ms: 900,
  staggerMs: 80,
  lift: 3.6,
  slideZ: -1.5,
  tiltOpenDeg: -12,
  pcbRise: 0.9,
  /** la pile ouverte fait 14.04 de haut a la vue par defaut : 14.04 / 0.86 / 2 */
  fitHalfH: 8.17,
  /** son centre projete (measure().fit.targetY, ouverte) */
  targetY: 2.763,
  /** echelle verticale des composants replies (jamais 0 : matrice inversible) */
  partsMin: 0.001,
  /**
   * les puces ne repondent au pointeur qu'une fois decouvertes (panneau a
   * 85 % de sa course)
   */
  chipsFrom: 0.85,
} as const;

export type ChipId = 'label' | 'live' | 'studio' | 'merch';

/**
 * Grosse puce (spec 5.6) : corps 1.7 x 0.2 x 1.2 pose 0.03 au-dessus de la
 * carte, 2 x 8 pattes de 0.06 x 0.08 x 0.16 a z +/-0.66, pas de 0.2 ; un
 * point jaune marque la broche 1 des puces cliquables.
 */
export const CHIP = {
  w: 1.7,
  d: 1.2,
  y0: 0.03,
  y1: 0.23,
  legW: 0.06,
  legH: 0.08,
  legD: 0.16,
  legZ: 0.66,
  legPitch: 0.2,
  legsPerSide: 8,
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
 * Les quatre puces cliquables (spec 6.1, 20.3.11 et 20.5), rangee a z 2.6
 * de la carte : sous le panneau leve et recule, la moitie avant de la
 * carte se voit depuis la vue par defaut, les cotes et les vues basses de
 * l'arriere en montrent une partie. LABEL est un lien direct, nouvel
 * onglet ; LIVE, STUDIO et MERCH ouvrent leur section (et portent l'ancre
 * de sa trace). MERCH (2026-09-30) : la quatrieme, les autres pieces de la
 * carte se sont ecartees pour lui faire place.
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
  section: 'live' | 'studio' | 'merch' | null;
}[] = [
  { id: 'label', silk: 'LABEL', x: -4.5, z: 2.6, aria: 'VRSTL Records on Bandcamp', href: LABEL_URL, section: null },
  { id: 'live', silk: 'LIVE', x: -1.5, z: 2.6, aria: 'Live setup and documents', href: null, section: 'live' },
  { id: 'studio', silk: 'STUDIO', x: 1.5, z: 2.6, aria: 'Studio', href: null, section: 'studio' },
  { id: 'merch', silk: 'MERCH', x: 4.5, z: 2.6, aria: 'Merch: hoodies and t-shirts', href: null, section: 'merch' },
];

/**
 * Composants de decor (spec 5.6), repere de la carte (x, z), replaces pour
 * la vue ouverte du coin (section 20.16) : la bande avant de la carte
 * (z 0 a 3.9) et la bande droite (x > 4.4) se voient depuis la vue par
 * defaut, le reste passe sous le panneau leve.
 */
export const PCB_PARTS = {
  small: [
    { x: -5.85, z: 2.6 },
    { x: 5.85, z: 2.6 },
    { x: 5.35, z: -3.2 },
    { x: -2.7, z: -2.9 },
  ],
  caps: [
    { x: -5.3, z: -1.0 },
    { x: 0, z: 2.3 },
    { x: 5.55, z: -1.6 },
    { x: 5.55, z: -2.35 },
    { x: -3.6, z: -2.2 },
    { x: 0.4, z: -2.8 },
  ],
  cell: { x: 5.35, z: -0.55 },
  resistors: Array.from({ length: 10 }, (_, k) => ({ x: -4.6 + 0.9 * k, z: 1.25 })),
  crystals: [
    { x: -3.0, z: 3.5 },
    { x: 3.0, z: 3.5 },
  ],
  small3: { w: 0.8, h: 0.14, d: 0.6 },
  cap3: { r: 0.28, h: 0.6, topH: 0.02 },
  cell3: { r: 0.5, h: 0.14 },
  resistor3: { w: 0.5, h: 0.16, d: 0.16 },
  crystal3: { r: 0.12, l: 0.5 },
} as const;

/**
 * Serigraphie du PCB (spec 5.7), bone a 90 %, px de la texture desktop,
 * texte centre en z sur sa hauteur de capitale, dans la bande visible de
 * la vue ouverte. Pas de ville (regle du site, section 19 point 103) ;
 * pour la remettre : { text: 'MONTPELLIER', x: 6.0, z: -0.3, px: 28, align: 'right' }.
 */
export const PCB_SILK: readonly { text: string; x: number; z: number; px: number; align: 'left' | 'right' }[] = [
  { text: 'MAUDITE MACHINE', x: -6.0, z: 0.4, px: 48, align: 'left' },
  { text: 'MM-808  REV 4.0', x: 6.0, z: 0.4, px: 28, align: 'right' },
  { text: 'V.4 2026', x: 6.1, z: 1.25, px: 22, align: 'right' },
];

/* ---------- jumeaux HTML et clavier (spec 6.1, 6.3, 13 et 20.7) ---------- */

/** Noms des pads de voix pour leur jumeau : "Bass drum pad, key A". */
export const PAD_ARIA: Readonly<Record<Inst, string>> = {
  BD: 'Bass drum pad, key A',
  SD: 'Snare pad, key S',
  TOM: 'Tom pad, key D',
  CH: 'Hi-hat pad, key F',
};

/**
 * Jumeau du pad OPEN (spec 6.1) : un nom fixe, l'etat passe par
 * aria-pressed (un bouton bascule ne change pas de nom, revue).
 */
export const OPEN_ARIA = 'Open the machine, key 8 or O';

/** Bouton de retour a la vue par defaut (spec 20.2.9), visible des que la vue a bouge. */
export const RESET_VIEW = { label: 'RESET VIEW', aria: 'Reset view' } as const;

/** RUN : nom fixe, l'etat de lecture passe par aria-pressed (revue). */
export const TWIN_ARIA = {
  run: 'Run, Space',
  clear: 'Clear pattern',
  group: 'MM-808 drum machine',
} as const;

/**
 * Encodeurs au clavier (jumeaux role slider) : fleches 1 BPM ou 2 %, avec
 * Maj ou Page 5 BPM ou 10 % ; Debut et Fin aux butees.
 */
export const DIAL_KEYS = { tempo: { step: 1, big: 5 }, pot: { step: 0.02, big: 0.1 } } as const;
