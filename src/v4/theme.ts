/**
 * /v4 MM-808 : palette, dimensions, cadrage, lumieres. Tout nombre de la
 * scene vit ici (docs/v4/spec.md sections 3 a 5) : la scene 3D, les
 * jumeaux HTML et le SVG de repli lisent les memes constantes.
 * Unites de scene : la machine fait 14 x 9 x 1.6 ; +x largeur, +z vers
 * l'avant (vers la camera), +y vers le haut. Positions "plateau" : repere
 * local du plateauGroup, origine au centre du dessus plat (y 0).
 */

/* ---------- couleurs (spec 4.4) ---------- */

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
  padTop: '#2F2F32',
  stepBtn: '#585756',
  ledSet: '#6E6C6A',
  ledHover: '#A9A69F',
  lcdBg: '#0F1410',
  lcdInk: '#9FB89A',
  lcdGlass: '#29322A',
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
 * Les teintes du brief sont des couleurs AFFICHEES : graphite = face du
 * dessus, graphiteHi = aretes eclairees, graphiteLo = flancs dans l'ombre.
 * Sous l'eclairage de la spec et l'ACES, un albedo egal a la teinte rend
 * deux fois plus sombre (le pied de la courbe ACES ecrase tout sous 0.003
 * lineaire) : le corps disparaissait dans le fond. Albedo = teinte x 3
 * (lineaire), mesure a 1440 x 900 : dessus 21 (#141417 = 20), chanfrein
 * eclaire 34 (#1C1D21 = 28), flancs 7 a 10 (#08080A = 8). Section 19.
 */
export const ALBEDO_GAIN = 3;
/**
 * Dessus des pads (padTop #2F2F32) : x 3 le rendait a 63,59,56 (l'ACES
 * n'est pas lineaire, une teinte plus claire demande moins de gain). x 2.1
 * donne 48-51,45-47,43-44 a 1440 x 900 : la luminance du jeton, la
 * dominante chaude de la lumiere comme le reste du corps.
 */
export const PAD_ALBEDO_GAIN = 2.1;

/** bone (#F6F1E7) a une opacite donnee (canvas, CSS). */
export const boneA = (a: number): string => `rgba(246, 241, 231, ${a})`;

/* ---------- polices ---------- */

export const FONT_DISPLAY = '"SF Pro Display", system-ui, -apple-system, sans-serif';
export const FONT_TITLE = '"Robot Radicals", "SF Pro Display", system-ui, sans-serif';
export const FONT_MONO = 'ui-monospace, Menlo, Consolas, monospace';
/** Ce que les textures canvas attendent avant leur dessin definitif (spec 4.5). */
export const FONT_LOADS = ['700 40px "SF Pro Display"', '400 40px "Robot Radicals"'] as const;
export const FONT_TIMEOUT_MS = 3000;

/** Serigraphie : SF Pro Display 700, capitales, interlettrage 0.18 em, bone 70 %. */
export const SILK = {
  weight: 700,
  tracking: 0.18,
  alpha: 0.7,
  /** hauteur de capitale de SF Pro Display, en em */
  capRatio: 0.7,
  /** epaisseur des filets, en unites */
  ruleWidth: 0.02,
} as const;

/* ---------- corps de la machine (spec 5.2) ---------- */

export const MACHINE = { width: 14, depth: 9, height: 1.6 } as const;

export interface BodySpec {
  /** forme extrudee (dessus plat) ; l'empreinte ajoute 2 x bevelSize */
  shapeW: number;
  shapeD: number;
  radius: number;
  /** three subdivise les arcs en 2 x curveSegments : 4 donne 8 facettes par coin */
  curveSegments: number;
  /** epaisseur TOTALE, chanfreins compris (la depth de three les exclut) */
  thickness: number;
  bevelThickness: number;
  bevelSize: number;
  bevelSegments: number;
}

/** Plateau : dessus 13.4 x 8.4, empreinte 14 x 9, y local -0.9 a 0. */
export const PLATE: BodySpec = {
  shapeW: 13.4,
  shapeD: 8.4,
  radius: 0.6,
  curveSegments: 4,
  thickness: 0.9,
  bevelThickness: 0.18,
  bevelSize: 0.3,
  bevelSegments: 2,
};

/** Socle : dessus 14.1 x 9.1, empreinte 14.3 x 9.3, y 0 a 0.7. */
export const SOCLE: BodySpec = {
  shapeW: 14.1,
  shapeD: 9.1,
  radius: 0.7,
  curveSegments: 4,
  thickness: 0.7,
  bevelThickness: 0.06,
  bevelSize: 0.1,
  bevelSegments: 1,
};

/** Origines des trois couches (monde, machine fermee ; spec 5.1). */
export const LAYERS = { plateauY: 1.6, pcbY: 0.72, socleY: 0 } as const;

/** Cadre sombre de l'ecran, fusionne au plateau : y 0 a 0.06. */
export const LCD_BEZEL = { w: 3.8, h: 0.06, d: 1.55, x: 4.35, z: -2.9 } as const;

/** Plan de serigraphie : couvre le dessus plat (spec 4.5 et 5.4). */
export const SILK_PLANE = {
  w: 13.4,
  d: 8.4,
  y: 0.004,
  tex: { desktop: [2048, 1284], mobile: [1024, 642] },
} as const;

export const SHADOW_PLANE = { size: 40, y: -0.001, opacity: 0.45 } as const;

/**
 * Ombre de contact (section 19, revue) : la lumiere cle (8, 14, 6) est du
 * cote de la camera, l'ombre portee tombe derriere la machine et elle la
 * cache. Le plan d'ombre ajoute donc, dans son propre shader (aucun draw
 * call de plus), un assombrissement doux autour de l'empreinte du socle
 * (14.3 x 9.3, coins de 0.8) : opacite 0.45 au bord (celle du brief),
 * nulle a falloff unites (smoothstep), centree (une occlusion de ciel est
 * symetrique ; seul l'avant se voit). Sur l'encre (10) : 6 au pied du
 * socle, 10 a une cinquantaine de px sur desktop.
 */
export const CONTACT_SHADOW = {
  halfW: SOCLE.shapeW / 2 + SOCLE.bevelSize,
  halfD: SOCLE.shapeD / 2 + SOCLE.bevelSize,
  radius: SOCLE.radius + SOCLE.bevelSize,
  falloff: 1.6,
  opacity: 0.45,
} as const;

/* ---------- objets du plateau (spec 5.3), lus par les stages suivants ---------- */

export type Inst = 'BD' | 'SD' | 'TOM' | 'CH';

export const PAD = { size: 2.2, height: 0.35, radius: 0.1, segments: 2, press: 0.12 } as const;
// BD et SD : etiquette a z -0.585 et non -0.38 (spec 5.4). A -0.38 la
// moitie basse des lettres passait derriere le dessus des pads TOM et CH
// (0.35 de haut, bord arriere a z 0.05 : ils masquent le plateau jusqu'a
// z -0.37, -0.45 avec la parallaxe) ; a -0.585 l'etiquette tient entre
// -0.715 et -0.455, sous le bord avant de son pad (z -0.8). Section 19.
export const PADS: readonly { id: Inst; x: number; z: number; key: string; labelZ: number }[] = [
  { id: 'BD', x: -5.05, z: -1.9, key: 'A', labelZ: -0.585 },
  { id: 'SD', x: -2.0, z: -1.9, key: 'S', labelZ: -0.585 },
  { id: 'TOM', x: -5.05, z: 1.15, key: 'D', labelZ: 2.6 },
  { id: 'CH', x: -2.0, z: 1.15, key: 'F', labelZ: 2.6 },
];

/** Frappe d'un pad (spec 5.3 et 7.2), en ms. */
export const PAD_FX = {
  downMs: 60,
  upMs: 180,
  flashMs: 120,
  /** coup du sequenceur : flash seul, sans mouvement */
  seqFlashMs: 100,
  /** CH tenu plus longtemps : charley ouvert */
  holdMs: 300,
} as const;

/**
 * Emissif de la face superieure des pads, rayonnement lineaire cale sur la
 * couleur AFFICHEE (section 19). Jaune x 1 (spec) rendait 228,207,118, un
 * jaune pastel ; jaune x 0.25 rendait 160,134,72, un kaki franc et non un
 * jaune faible. Valeurs obtenues en inversant l'ACES de three autour du
 * dessus rendu (48,45,43) : flash 241,194,91 (#F2C230, le bleu hors gamut) ;
 * selection 97,82,47, le dessus avec 25 % de jaune.
 */
export const PAD_GLOW = {
  flash: [1.214, 0.397, 0],
  selected: [0.073, 0.048, 0],
} as const;

/** Picking (spec 6.2 et 6.5), en px CSS. */
export const HIT = {
  /** tactile : un point hors de toute forme compte a moins de 24 px du bord */
  touchSlop: 24,
  /** rectangle cible minimal (jumeaux, zone tactile) : tactile, souris */
  minCoarse: 48,
  minFine: 32,
} as const;

export const STEPS = {
  count: 16,
  x0: -0.3,
  pitch: 0.42,
  z: 2.2,
  r: 0.17,
  h: 0.1,
  ledZ: 1.75,
  ledR: 0.09,
  ledY: 0.012,
  numberZ: 2.65,
} as const;
export const stepX = (i: number): number => STEPS.x0 + STEPS.pitch * i;

export const TRANSPORT = {
  run: { x: 1.5, z: 3.3, r: 0.42, h: 0.12 },
  clear: { x: 4.3, z: 3.3, r: 0.3, h: 0.12 },
  open: { x: 4.4, z: -1.75, r: 0.34, h: 0.12 },
  labelZ: 3.95,
} as const;

export const KNOB = { r: 0.42, h: 0.5, capR: 0.14, capH: 0.04, ringTube: 0.03, turnDeg: -30, rise: 0.08 } as const;

/** Les sections du site (spec 7.1) ; STUDIO s'ouvre par une puce de la vue eclatee. */
export type SectionId = 'tracks' | 'mixtapes' | 'press' | 'shows' | 'contact' | 'studio';
/** Les cinq sections qui ont un knob sur le plateau. */
export type NavId = Exclude<SectionId, 'studio'>;

/** Knobs de navigation, de gauche a droite ; key : raccourci clavier (spec 7.2). */
export const NAV_KNOBS: readonly { id: NavId; label: string; x: number; key: string }[] = [
  { id: 'tracks', label: 'TRACKS', x: 0.9, key: '1' },
  { id: 'mixtapes', label: 'MIXTAPES', x: 2.2, key: '2' },
  { id: 'press', label: 'PRESS', x: 3.5, key: '3' },
  { id: 'shows', label: 'SHOWS', x: 4.8, key: '4' },
  { id: 'contact', label: 'CONTACT', x: 6.1, key: '5' },
];
export const NAV_ROW = { z: 0.3, ledZ: -0.45, labelZ: 1.05, capY: 0.5 } as const;
export const AUDIO_KNOBS = {
  tempo: { x: 6.1, z: 3.3, scale: [0.95, 0.8, 0.95], capY: 0.4, label: 'TEMPO', labelX: 6.1, labelZ: 3.95 },
  tone: { x: 0.9, z: -2.4, scale: [0.67, 0.8, 0.67], capY: 0.4, label: 'TONE', labelX: 0.9, labelZ: -1.85 },
  level: { x: 2.1, z: -3.5, scale: [0.67, 0.8, 0.67], capY: 0.4, label: 'LEVEL', labelX: 2.0, labelZ: -2.95 },
} as const;

export const LCD = { w: 3.5, d: 1.25, x: 4.35, y: 0.065, z: -2.9, tex: [512, 192] } as const;
export const SCREWS = { x: 6.45, z: 4.0, scale: 0.65, rot: [0.3, 1.1, 2.0, 2.6] } as const;

/* ---------- sequenceur, transport, TEMPO (spec 5.3, 7.5, 9) ---------- */

/** Noms parles des instruments : etiquettes aria, Dock. */
export const INST_NAMES: Readonly<Record<Inst, string>> = { BD: 'bass drum', SD: 'snare', TOM: 'tom', CH: 'hi-hat' };

/** Facettes : cylindres des boutons, corps des knobs, liseres ; moins sur mobile. */
export const SEGMENTS = {
  button: { desktop: 24, mobile: 16 },
  knob: { desktop: 32, mobile: 24 },
  ring: { desktop: 40, mobile: 32 },
  cap: 20,
  led: 12,
} as const;

/**
 * Albedos LINEAIRES des objets eclaires, cales sur la couleur AFFICHEE du
 * dessus par lecture de pixels a 1440 x 900 (section 19), comme
 * ALBEDO_GAIN et PAD_ALBEDO_GAIN : sous l'ACES un albedo egal au jeton rend
 * plus sombre et plus terne. Les gris gardent la dominante chaude de la
 * lumiere (luminance calee, comme le corps et les pads) ; le rouge et le
 * jaune de RUN sont cales canal par canal.
 * step : stepBtn #585756 rendu 92,86,78 ; run : red #C8442F rendu
 * 200,68,47 ; runOn (avec RUN_GLOW) : yellow #F2C230 rendu 238,194,76, le
 * bleu hors gamut sous l'ACES comme le flash des pads ; clear et knob :
 * graphiteHi x 3 rendu 29,28,29 ; mark : bone rendu 241,238,234 ; cap :
 * leg (metal 0.7, roughness 0.55 du brief, sans environnement) rendu
 * 145,142,138, recale x 0.86 apres le passage de 0.45 a 0.55 (revue : a
 * albedo egal le capuchon montait a 156,153,149) ; slot : line (une
 * rainure de 1.4 px, sombre).
 */
export const LIT = {
  step: [0.162, 0.1584, 0.1547],
  run: [0.7442, 0.1006, 0.0598],
  runOn: [1.0709, 0.3069, 0],
  clear: [0.035, 0.037, 0.046],
  knob: [0.035, 0.037, 0.046],
  mark: [2.8308, 2.6988, 2.4532],
  cap: [0.8654, 0.8943, 0.9617],
  slot: [0.03, 0.032, 0.04],
} as const;

/** Emissif de RUN pendant la lecture : jaune x 0.5 (spec 5.3), lineaire. */
export const RUN_GLOW = [0.444, 0.2635, 0.0148] as const;

/** Lisere des knobs : repose sur le plateau (centre du tube a son rayon). */
export const RING_Y = KNOB.ringTube;

/** Les boutons et le lisere de TEMPO, pour le picking et la scene. */
export const TEMPO_KNOB = {
  id: 'tempo',
  x: AUDIO_KNOBS.tempo.x,
  z: AUDIO_KNOBS.tempo.z,
  scale: AUDIO_KNOBS.tempo.scale,
  capY: AUDIO_KNOBS.tempo.capY,
  ring: 'line',
} as const;

/**
 * TEMPO (spec 6.1) : glisser vertical, 100 px = 50 BPM (vers le haut =
 * plus vite) ; molette 1 BPM par cran de 100 px ; double tape = 130.
 * Angle : 270 deg de course centree sur le repere a 0, sens horaire vu du
 * dessus quand le tempo monte (section 19).
 */
export const TEMPO_UI = { pxPerBpm: 2, wheelPx: 100, tapMs: 350, slopPx: 3, sweepDeg: 270 } as const;

/** Un appui (pas, RUN, CLEAR) part au relachement s'il a bouge de moins de 10 px. */
export const PRESS_SLOP_PX = 10;

/* ---------- navigation : knobs, sections, panneau, trace (spec 3.3, 5.3, 11) ---------- */

/** Titres des sections : panneau, onglets, ecran (spec 11.1). */
export const SECTION_TITLES: Readonly<Record<SectionId, string>> = {
  tracks: 'TRACKS',
  mixtapes: 'MIXTAPES',
  press: 'PRESS',
  shows: 'SHOWS',
  contact: 'CONTACT',
  studio: 'STUDIO',
};

/** Les cinq knobs de navigation : corps plein (0.42 x 0.5), lisere jaune. */
export const NAV_KNOB_SPECS = NAV_KNOBS.map((k) => ({
  id: k.id,
  x: k.x,
  z: NAV_ROW.z,
  scale: [1, 1, 1] as readonly number[],
  capY: NAV_ROW.capY,
  ring: 'yellow' as const,
}));

/** TONE et LEVEL : petits potards du bus de batterie (spec 5.3 et 8.1). */
export const TONE_KNOB = {
  id: 'tone',
  x: AUDIO_KNOBS.tone.x,
  z: AUDIO_KNOBS.tone.z,
  scale: AUDIO_KNOBS.tone.scale,
  capY: AUDIO_KNOBS.tone.capY,
  ring: 'line',
} as const;
export const LEVEL_KNOB = {
  id: 'level',
  x: AUDIO_KNOBS.level.x,
  z: AUDIO_KNOBS.level.z,
  scale: AUDIO_KNOBS.level.scale,
  capY: AUDIO_KNOBS.level.capY,
  ring: 'line',
} as const;

/** Knob de navigation : quart de tour (220 ms) et soulevement au survol (150 ms). */
export const KNOB_FX = { turnMs: 220, riseMs: 150 } as const;

/**
 * TONE et LEVEL (spec 6.1) : glisser vertical, 150 px = toute la course
 * (vers le haut = plus) ; molette 2 % par cran de 100 px ; double tape =
 * valeur de depart (TONE ouvert, LEVEL 80 %).
 */
export const POT_UI = { pxRange: 150, wheelPx: 100, wheelStep: 0.02, reset: { tone: 1, level: 0.8 } } as const;

/**
 * Cadrage quand une section est ouverte (desktop, spec 3.3) : la machine
 * tient dans la largeur moins la goutiere du panneau et glisse a gauche ;
 * sous la contrainte que l'ecran (le coin droit de son cadre) reste a
 * lcdGap px du panneau, ce que la goutiere seule ne tient pas sous 1440 px
 * (section 19).
 */
export const SECTION_FRAME = { ms: 400, wideMin: 1100, gutterWide: 304, gutterNarrow: 200, lcdGap: 16 } as const;

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

/** Ecart horizontal projete (unites) du centre de la machine au coin droit du cadre de l'ecran. */
export const LCD_RIGHT_SX = Math.SQRT1_2 * (LCD_BEZEL.x + LCD_BEZEL.w / 2 - (LCD_BEZEL.z - LCD_BEZEL.d / 2));

/**
 * Trace du knob au panneau (spec 11.2), px CSS et ms : droite, un ou deux
 * coudes a angle droit, dessinee en 400 ms, un point lumineux la parcourt
 * une fois (350 ms, apres le dessin). corner : coin du plateau (x, z) qui
 * donne le bord droit projete de la machine.
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
  corner: [7, -4.5],
} as const;

/** Feuille mobile (spec 11.3) : fermee par un glisser de 80 px ou un geste vif. */
export const SHEET = { closeDragPx: 80, flickPxPerMs: 0.5, dragSlopPx: 6 } as const;

/** Ecran (spec 5.5) : 20 colonnes, compose au plus 4 fois par seconde. */
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

/* ---------- serigraphie (spec 5.4) ---------- */

export interface SilkText {
  text: string;
  x: number;
  z: number;
  /** hauteur de capitale, en unites */
  cap: number;
  alpha?: number;
  align?: 'center' | 'right';
  /** largeur max en unites : le corps reduit pour tenir (voisins, bords) */
  maxW?: number;
  /** les textes d'un meme groupe partagent le plus petit corps */
  group?: string;
}

const T = TRANSPORT;
export const SILK_TEXTS: readonly SilkText[] = [
  ...PADS.map((p) => ({ text: p.id, x: p.x, z: p.labelZ, cap: 0.26 })),
  { text: 'MAUDITE MACHINE', x: -3.5, z: 3.45, cap: 0.3, maxW: 5.3 },
  { text: 'MM-808', x: -3.5, z: 3.9, cap: 0.16 },
  // Numeros des pas : bone 70 % comme toute la serigraphie (brief)
  ...[0, 4, 8, 12].map((i) => ({ text: String(i + 1), x: stepX(i), z: STEPS.numberZ, cap: 0.13 })),
  { text: 'RUN/STOP', x: T.run.x, z: T.labelZ, cap: 0.16 },
  { text: 'CLEAR', x: T.clear.x, z: T.labelZ, cap: 0.16 },
  { text: 'TEMPO', x: AUDIO_KNOBS.tempo.labelX, z: AUDIO_KNOBS.tempo.labelZ, cap: 0.16, maxW: 1.1 },
  // Au corps de la spec, MIXTAPES deborde sur ses voisins et CONTACT sort
  // du dessus plat : la rangee partage le corps qui tient dans 1.18
  ...NAV_KNOBS.map((k) => ({ text: k.label, x: k.x, z: NAV_ROW.labelZ, cap: 0.18, maxW: 1.18, group: 'nav' })),
  // TONE et LEVEL tiennent dans 0.66 ; LEVEL recule de 0.1 : le cadre de
  // l'ecran (x 2.45, 0.06 de haut) masquait sa derniere lettre
  { text: AUDIO_KNOBS.tone.label, x: AUDIO_KNOBS.tone.labelX, z: AUDIO_KNOBS.tone.labelZ, cap: 0.16, maxW: 0.66, group: 'audio' },
  { text: AUDIO_KNOBS.level.label, x: AUDIO_KNOBS.level.labelX, z: AUDIO_KNOBS.level.labelZ, cap: 0.16, maxW: 0.66, group: 'audio' },
];

/** OPEN (ou CLOSE pendant la vue eclatee), aligne a droite dans son cadre jaune. */
export const OPEN_LABEL = { x: 3.95, z: -1.75, cap: 0.18, maxW: 0.85, align: 'right' } as const;
export const OPEN_FRAME = { x0: 3.0, z0: -2.12, x1: 4.95, z1: -1.38, stroke: 0.035, radius: 0.12 } as const;
export const SILK_RULES: readonly { x0: number; z0: number; x1: number; z1: number }[] = [
  { x0: -0.55, z0: -3.9, x1: -0.55, z1: 3.9 },
  { x0: -0.2, z0: 1.45, x1: 6.6, z1: 1.45 },
];

/* ---------- camera et cadrage (spec 3) ---------- */

export const CAMERA = { x: 12, y: 10, z: 12, near: 0.1, far: 100 } as const;
export const FRAME_DESKTOP = 0.78;
export const FRAME_MOBILE = 0.92;
/** Largeur projetee de l'empreinte 14 x 9 (coins vifs) : 0.7071 x (14 + 9). */
export const PLATEAU_W = Math.SQRT1_2 * (MACHINE.width + MACHINE.depth);
/** Hauteur projetee de la machine : elle tient toujours dans 86 % du canvas. */
export const MACHINE_H = 9.85;
export const FIT_H = 0.86;

export const MOBILE_QUERY = '(max-width: 767px)';
export const COARSE_QUERY = '(hover: none) and (pointer: coarse)';
export const DPR_MAX = { desktop: 2, mobile: 1.5 } as const;

/* ---------- lumieres (spec 4.2 et 4.3) ---------- */

export const LIGHT_KEY = {
  color: 0xfff6e8,
  intensity: 2.2,
  x: 8,
  y: 14,
  z: 6,
  mapSize: { desktop: 1024, mobile: 512 },
  extent: 11,
  near: 1,
  far: 40,
  bias: -0.0004,
  normalBias: 0.02,
  /** PCF de three 0.186 : rayon du disque d'echantillons, en texels (ombre douce) */
  radius: { desktop: 4, mobile: 3 },
} as const;

export const LIGHT_HEMI = { sky: COLOR.bone, ground: COLOR.ink, intensity: 0.35 } as const;

/**
 * Lisere chaud rasant depuis la gauche (spec 4.2). La spec voulait un
 * RectAreaLight (0.7, 6 x 3, en (-9, 2.5, 1)) : ses tables LTC pesent
 * 101 Ko gzip hors du build de base de three et faisaient passer /v4 a
 * 298 Ko contre 220 (section 19). Remplace par un PointLight jaune a
 * decroissance physique, cale par difference d'images a 1440 x 900 contre
 * le rendu du RectAreaLight : ecart moyen 0.2 niveau sur la machine fermee
 * (0.56 sans lisere), 0.15 ouverte, le lisere de l'arete gauche retrouve
 * (erreur moyenne -0.1 / 0.0 niveau sur les pixels qu'il eclairait).
 */
export const LIGHT_RIM = {
  color: COLOR.yellow,
  intensity: 6,
  decay: 2,
  x: -9,
  y: 3,
  z: 0,
} as const;

/** Le premier rendu attend les polices, au plus ce delai. */
export const FIRST_FRAME_WAIT_MS = 1500;

/* ---------- parallaxe (spec 3.5) ---------- */

export const PARALLAX = { maxDeg: 4, lerp: 0.06, epsilon: 0.0003 } as const;

/**
 * Intro (spec 7.4), mouvement complet seulement : la machine monte de
 * dropY a sa place en ms (easeOutCubic) pendant que les 16 LED font leur
 * test, de gauche a droite puis retour (ledMs, apres ledFromMs). Le
 * premier geste la termine d'un coup.
 */
export const INTRO = { ms: 700, dropY: 0.6, ledFromMs: 100, ledMs: 400 } as const;

/* ---------- textes ---------- */

export const COPY = {
  title: 'Maudite Machine | MM-808',
  wordmark: 'MAUDITE MACHINE',
  model: 'MM-808',
} as const;

/* ---------- ecran LCD (spec 5.5) ---------- */

/**
 * Dessin de l'ecran : verre lcdGlass (lcdInk a 18 % sur lcdBg), encre
 * lcdInk, 34 px monospace, marges de 24 px, lignes a 76 et 150 px. La
 * texture (512 x 192) couvre un plan de 3.5 x 1.25 : les glyphes sont
 * compresses de 0.952 en largeur pour garder leur proportion a l'ecran.
 */
export const LCD_DRAW = { font: `400 34px ${FONT_MONO}`, pad: 24, baselines: [76, 150] } as const;

/* ---------- OPEN : vue eclatee, PCB, socle (spec 5.2, 5.6, 5.7, 12) ---------- */

/**
 * Vue eclatee (spec 12) : le plateau monte de 3.5 et s'incline de 12 deg
 * autour de l'axe horizontal de l'ecran normalize(1, 0, -1), le PCB se
 * revele sur place, le socle descend de 1.5 ; 900 ms easeInOutQuart par
 * couche, 80 ms de decalage. Inclinaison NEGATIVE : le bord avant monte,
 * comme un capot qu'on souleve. A +12 (spec) le bord avant plongeait sur la
 * carte : elle n'etait visible qu'a 47 %, les trois puces cachees ; a -12,
 * 78 % (section 19). Le dessous du plateau reste invisible dans les deux
 * sens (inclinaison et parallaxe : 16 deg au plus, camera a 30.5 deg).
 * Cadrage : la pile eclatee fait 12.09 de haut en projection, son centre a
 * 0.74 au-dessus de la cible ; la vue monte de shiftY et garde au moins
 * fitHalfH de demi-hauteur (la pile dans 86 %, centree).
 */
export const EXPLODE = {
  ms: 900,
  staggerMs: 80,
  lift: 3.5,
  tiltDeg: -12,
  drop: 1.5,
  fitHalfH: 7.03,
  shiftY: 0.74,
  /** echelle verticale des composants replies (jamais 0 : matrice inversible) */
  partsMin: 0.001,
  /**
   * les puces ne repondent au pointeur qu'une fois decouvertes (plateau a
   * 85 % de sa course, 570 ms apres OPEN) : cachees sous le plateau, leur
   * silhouette capterait sinon l'avant des pads TOM et CH
   */
  chipsFrom: 0.85,
} as const;

/** Carte (spec 5.6) : 12.6 x 0.1 x 7.8 dans pcbGroup (y 0.72 monde). */
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

export type ChipId = 'label' | 'live' | 'studio';

/**
 * Grosse puce (spec 5.6) : corps 1.7 x 0.2 x 1.2 pose 0.03 au-dessus de la
 * carte, 2 x 8 pattes de 0.06 x 0.08 x 0.16 a z +/-0.66, pas de 0.2 ; un
 * point jaune marque la broche 1 des trois puces cliquables.
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
  /** survol : la puce se souleve (150 ms, comme un knob) */
  rise: 0.06,
} as const;

/**
 * Les trois puces cliquables (spec 6.1 et 7.2). Rangee a z 1.7 et non
 * -0.4 (spec) : sous le plateau leve, seules la moitie avant et la droite
 * de la carte se voient ; la plus petite marge (LABEL, parallaxe extreme en
 * bas a droite du canvas) reste 0.25 unite, 1.0 sans parallaxe (section 19).
 */
export const CHIPS: readonly {
  id: ChipId;
  silk: string;
  x: number;
  z: number;
  aria: string;
  /** lien du jumeau ; null : STUDIO ouvre sa section */
  href: string | null;
  external: boolean;
}[] = [
  { id: 'label', silk: 'LABEL', x: -2.8, z: 1.7, aria: 'VRSTL Records, label', href: 'https://vrstlrecords.com', external: true },
  { id: 'live', silk: 'LIVE', x: 0.6, z: 1.7, aria: 'Tech rider, live', href: '/techrider', external: false },
  { id: 'studio', silk: 'STUDIO', x: 4.0, z: 1.7, aria: 'Studio setup', href: null, external: false },
];

/**
 * Composants de decor (spec 5.6), repere de la carte (x, z). Les petites
 * puces (U4 a U7), les condensateurs (C1 a C6), la pile bouton (BT1), les
 * resistances (R1 a R10) et les quartz (X1, X2) : les plus parlants dans
 * la partie visible (avant, droite), le reste sous le plateau.
 */
export const PCB_PARTS = {
  small: [
    { x: -4.9, z: -0.2 },
    { x: -1.2, z: -0.4 },
    { x: 2.3, z: -2.4 },
    { x: -2.7, z: -2.9 },
  ],
  caps: [
    { x: -5.35, z: 2.35 },
    { x: -4.55, z: 2.35 },
    { x: 5.5, z: -2.6 },
    { x: 5.5, z: -1.8 },
    { x: -3.6, z: -2.2 },
    { x: 0.4, z: -2.8 },
  ],
  cell: { x: 4.2, z: -2.6 },
  resistors: Array.from({ length: 10 }, (_, k) => ({ x: -4.05 + 0.9 * k, z: -1.15 })),
  crystals: [
    { x: -0.9, z: 0.35 },
    { x: 2.3, z: 0.35 },
  ],
  small3: { w: 0.8, h: 0.14, d: 0.6 },
  cap3: { r: 0.28, h: 0.6, topH: 0.02 },
  cell3: { r: 0.5, h: 0.14 },
  resistor3: { w: 0.5, h: 0.16, d: 0.16 },
  crystal3: { r: 0.12, l: 0.5 },
} as const;

/**
 * Serigraphie du PCB (spec 5.7), bone a 90 %, px de la texture desktop,
 * texte centre en z sur sa hauteur de capitale. Pas de ville : le brief
 * demandait MONTPELLIER, la regle du site (commit 1e6cf7f, aucun lieu dans
 * les textes affiches) l'emporte (section 19, point 1 et revue) ; pour la
 * remettre : { text: 'MONTPELLIER', x: 6.0, z: -0.3, px: 28, align: 'right' }.
 */
export const PCB_SILK: readonly { text: string; x: number; z: number; px: number; align: 'left' | 'right' }[] = [
  { text: 'MAUDITE MACHINE', x: -6.0, z: 3.45, px: 48, align: 'left' },
  { text: 'MM-808  REV 4.0', x: 6.0, z: 3.45, px: 28, align: 'right' },
  { text: 'V.4 2026', x: 6.0, z: 0.15, px: 22, align: 'right' },
];

/** Mention discrete du socle (spec 5.2) : plan sur la face avant, texte en line. */
export const MENTION = { text: 'V.4 / 2026', w: 1.6, h: 0.22, x: -5.2, y: 0.35, z: 4.66, tex: [256, 36], px: 22 } as const;

/** Alimentation et connecteurs du flanc droit du socle (spec 5.2), fusionnes au socle. */
export const CONNECTORS = {
  inlet: { w: 0.12, h: 0.45, d: 0.7, x: 7.21, y: 0.35, z: 2.6 },
  jacks: [
    { x: 7.2, y: 0.35, z: 1.6 },
    { x: 7.2, y: 0.35, z: 1.1 },
  ],
  jackR: 0.14,
  jackL: 0.1,
  holeR: 0.06,
  usb: { w: 0.12, h: 0.22, d: 0.5, x: 7.21, y: 0.35, z: 0.3 },
} as const;

/**
 * Jumeau du bouton OPEN (spec 6.1) : un nom fixe, l'etat passe par
 * aria-pressed (un bouton bascule ne change pas de nom, revue).
 */
export const OPEN_ARIA = 'Open the machine, key O';

/* ---------- jumeaux HTML et clavier (spec 6.1, 6.3, 13) ---------- */

/** Noms des pads pour leur jumeau : "Bass drum pad, key A". */
export const PAD_ARIA: Readonly<Record<Inst, string>> = {
  BD: 'Bass drum pad, key A',
  SD: 'Snare pad, key S',
  TOM: 'Tom pad, key D',
  CH: 'Hi-hat pad, key F',
};

/** RUN : nom fixe, l'etat de lecture passe par aria-pressed (revue). */
export const TWIN_ARIA = {
  run: 'Run, Space',
  clear: 'Clear pattern',
  tempo: 'Tempo',
  tone: 'Tone',
  level: 'Level',
  group: 'MM-808 drum machine',
} as const;

/**
 * Potards au clavier (jumeaux role slider) : fleches 1 BPM ou 2 %, avec
 * Maj ou Page 5 BPM ou 10 % ; Debut et Fin aux butees.
 */
export const DIAL_KEYS = { tempo: { step: 1, big: 5 }, pot: { step: 0.02, big: 0.1 } } as const;
