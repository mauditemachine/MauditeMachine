/**
 * La face du MM-RYTM V.4.0 en millimetres (2026-10-27, Mika : "faceplate
 * Octatrack x Digitakt ; la machine sera aussi construite en vrai, la face
 * doit correspondre exactement a la future machine physique") : LA source de
 * verite de la face, des donnees seules. La scene 3D (theme.ts la ramene en
 * unites : 20 mm l'unite, MM_PER_UNIT), les jumeaux HTML et, plus tard,
 * l'export SVG de la decoupe la lisent. Ce module n'importe que des donnees
 * (ni three, ni le theme : theme.ts l'importe, et un script node doit pouvoir
 * le prendre seul avec esbuild, comme scripts/mm-studio-patterns.mjs prend
 * beatcode.ts) : la version du firmware vient de firmware.json (2026-10-27).
 *
 * Repere : le coin en haut a gauche de la face, x vers la droite, y vers le
 * bas (vers l'utilisateur sur la machine). Un rectangle par son coin en haut a
 * gauche (x, y) et sa taille (w, h) ; un cercle par son centre et son diametre.
 *
 * Ce que Mika a fixe (2026-10-27) : la face 256 x 156 ; l'ecran 4.3 pouces
 * 800 x 480 en 8, 8, 106 x 67 ; huit potards de 28 en 2 x 4 au pas de 32,
 * centres x 134 166 198 230, y 24 et 56 (DIST CHORUS DELAY REVERB, STRETCH
 * SWING BIT COMP), chacun son anneau de valeur (la machine aura des potards
 * motorises qui suivent la valeur) ; douze touches de 12 x 12 en y 84,
 * x = 8 + 14 i (TRK VOICE FLTR ENV FX EDIT OPEN RUN/STOP CLEAR RANDOM MUTE
 * SOLO) ; SCENE A en 180, 84, la fente du crossfader de x 196
 * a 232 sur y 90, SCENE B en 236, 84 ; seize pas de 27.6 x 20 en deux rangees
 * de huit au pas de 30.4 depuis x 8, en y 104 et 128, les pas 1 a 8 portent le
 * nom d'une voix (BD SD CH OH CP TOM HT CY). Les dix pads disparaissent.
 * V.5.0 (2026-10-29, l'etape D1 facon Digitakt, docs/v4/digitakt-d1-spec.md) : quatorze touches de 10.4 x 12 au pas
 * de 12 (FUNC TRK PTN REC PLAY STOP TRIG SRC FLTR AMP FX MOD YES NO), leur fonction secondaire en orange sous elles ;
 * CLEAR, RANDOM, MUTE, SOLO et OPEN quittent la rangee (FUNC + PLAY, TRIG + YES, FUNC + TRK...), le logo M ouvre le capot.
 * Le reste (le capuchon des potards, la fente, les legendes, la serigraphie,
 * les hauteurs, les coins, les temoins et les impressions des touches) est une
 * proposition a valider : tout est ici, un seul endroit a changer (la revue du
 * 2026-10-27 : les details de la face qui restaient en unites dans theme.ts y
 * sont revenus en mm).
 *
 * Les legendes des douze touches (V.4.2, 2026-10-27, Mika apres les pictogrammes : "appuie-toi pour Rytm de la Digitakt
 * pour les boutons parce que les icones des fois c'est difficile a deviner c'est quoi") : comme sur une Digitakt, le nom
 * de la fonction imprime sur la touche, un mot court en capitales (buttons.keys legend), le meme corps pour les douze
 * (buttons.legend, celui de RANDOM, le plus long, qui tient) ; RUN/STOP porte les signes du transport, le triangle PLAY
 * et le carre STOP cote a cote (buttons.marks), une encre fixe comme les touches PLAY et STOP de la Digitakt. Les
 * pictogrammes Tabler (le 2026-10-27, "pas de texte sur les boutons") sont partis. Proposition a valider.
 *
 * A valider avec Mika (la revue du 2026-10-27) : knobs.d (28) est lu comme
 * l'emprise du potard et de son anneau, le capuchon en fait 17 ; si 28 est le
 * capuchon, l'anneau passe sur le capuchon (au pas de 32, rien autour). Les pas
 * finissent en x 248.4 (8 + 7 x 30.4 + 27.6) : 7.6 mm de marge a droite pour 8
 * a gauche, 0.4 mm au-dela du bord droit de SCENE B (faceplateNotes).
 */

import FW from '../firmware.json';
import { DT2_BUTTONS, DT2_SIDE_KNOBS, type Dt2ButtonId, type Dt2KeyClass } from './dtFaceIds';

/** Les millimetres d'une unite de la scene (Mika, 2026-10-27) : la face fait 12.8 x 7.8 unites. */
export const MM_PER_UNIT = 20;

export interface FpRect {
  readonly x: number;
  readonly y: number;
  readonly w: number;
  readonly h: number;
}
export interface FpCircle {
  readonly cx: number;
  readonly cy: number;
  readonly d: number;
}

export type FpVoice = 'BD' | 'SD' | 'CH' | 'OH' | 'CP' | 'TOM' | 'HT' | 'CY';
export type FpFx = 'dist' | 'chorus' | 'delay' | 'reverb' | 'stretch' | 'swing' | 'bits' | 'comp';
/**
 * Les quatorze touches de la rangee (V.5.0, 2026-10-29, l'etape D1 de la MM-RYTM facon Digitakt, docs/v4/digitakt-d1-spec.md) :
 * FUNC TRK PTN REC PLAY STOP, les six touches de page TRIG SRC FLTR AMP FX MOD, YES et NO. Les ids des zones de saisie
 * gardes (hotspot) : trk, pad-edit (PTN), run (PLAY), pkey-voice (SRC), pkey-fltr, pkey-env (AMP), pkey-fx.
 */
export type FpButtonId = 'func' | 'trk' | 'ptn' | 'rec' | 'play' | 'stop' | 'trig' | 'src' | 'fltr' | 'amp' | 'fx' | 'mod' | 'yes' | 'no';
/**
 * Un signe imprime (V.4.2, 2026-10-27) : le triangle PLAY, le carre STOP ; V.5.0 (2026-10-29) : le rond de REC, comme la
 * Digitakt ; V.6.0 (2026-10-30, la face DT2) : les chevrons des quatre fleches.
 */
export type FpMark = 'play' | 'stop' | 'rec' | 'up' | 'down' | 'left' | 'right';

export interface FpButton {
  readonly id: FpButtonId;
  /**
   * V.4.2 (2026-10-27, facon Digitakt) : la legende imprimee sur la touche, un mot court en capitales ; marks : des signes
   * a la place du mot (V.5.0 : le rond de REC, le triangle de PLAY, le carre de STOP), legend reste alors son nom ecrit
   * (les tests, l'export)
   */
  readonly legend: string;
  readonly marks?: readonly FpMark[];
  /**
   * V.5.0 (2026-10-29) : la fonction secondaire (FUNC + la touche), imprimee en orange sur la face sous la touche, comme la
   * Digitakt ; absente : rien d'imprime (FUNC elle-meme)
   */
  readonly alt?: string;
  /** le nom court (celui de Mika) ; title : le nom complet (l'infobulle et le nom du jumeau) */
  readonly name: string;
  readonly title: string;
  /** l'id de sa zone de saisie (scene/hit.ts) et de son jumeau */
  readonly hotspot: string;
  /**
   * 1 : la touche agit ; 2 : visible et inerte (son infobulle dit coming soon, sa carte INFOS BIENTOT, son curseur la
   * fleche). Depuis la phase 2 (2026-10-27) toutes les touches de la face agissent (TRK compris) : 2 reste pour une touche
   * a venir, dessinee avant d'agir.
   */
  readonly phase: 1 | 2;
}

export interface FpScene {
  readonly rect: FpRect;
  readonly letter: 'A' | 'B';
  readonly title: string;
  readonly hotspot: string;
  /** 1 : agit (SCENE A et B depuis la phase 2, le 2026-10-27, P2-19) ; 2 : visible et inerte */
  readonly phase: 1 | 2;
}

export const RYTM_FACEPLATE = {
  version: 'V.5.0',
  size: { w: 256, h: 156 },
  /** pris du panneau 3D (PANEL : chanfrein de 0.1 unite, coins de 0.2 + 0.1) ; la decoupe reelle reste a valider */
  edge: { chamfer: 2, corner: 6 },
  screen: {
    /** le verre visible, l'ecran 4.3 pouces 800 x 480 (Mika) */
    rect: { x: 8, y: 8, w: 106, h: 67 },
    /** la zone active 5:3 centree dans le verre : 0.117 mm le pixel, 4.30 pouces de diagonale */
    active: { w: 93.6, h: 56.16 },
    px: { w: 800, h: 480 },
    diagonalIn: 4.3,
  },
  knobs: {
    /** 28 (Mika) : lu comme l'emprise du potard et de son anneau (interpretation a valider, voir plus haut) */
    d: 28,
    pitch: 32,
    cx: [134, 166, 198, 230],
    cy: [24, 56],
    /** le jeu de la page GLOBAL FX, celui de la face V.4.0 phase 1 (les potards suivent la page depuis le 2026-10-27) */
    fx: ['dist', 'chorus', 'delay', 'reverb', 'stretch', 'swing', 'bits', 'comp'] as readonly FpFx[],
    /**
     * la serigraphie de chaque potard (2026-10-27, les potards suivent la page) : une lettre, A a D en haut, E a H dessous ;
     * l'impression ne change jamais, l'ecran dit la fonction (le bloc k au-dessus du potard k)
     */
    labels: ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H'],
    /** proposition (a valider) : le capuchon (diametre en bas, en haut, hauteur), sa jupe, l'anneau a plat autour, le nom a 6 h dans la fente de l'anneau */
    cap: { d: 17, top: 16, h: 8 },
    skirt: { d: 18.6, h: 0.8 },
    ring: { inner: 23.2, outer: 27.2, sweepDeg: 270, segments: 27, airDeg: 3 },
    label: { r: 12.6, cap: 1.8 },
  },
  /*
   * V.5.0 (2026-10-29, l'etape D1 facon Digitakt, docs/v4/digitakt-d1-spec.md section 1) : quatorze touches de 10.4 x 12
   * au pas de 12 depuis x 8 (la derniere finit a 174.4), en y 84 ; SCENE A, la fente et SCENE B ne bougent pas. Le meme
   * relief, le meme temoin, les memes legendes (le corps un rien plus petit : FUNC, TRIG et RELOAD tiennent dans 9 mm) ;
   * la fonction secondaire (FUNC + la touche) imprimee en orange sur la face sous chaque touche (alt).
   */
  buttons: {
    w: 10.4,
    h: 12,
    x0: 8,
    pitch: 12,
    y: 84,
    /**
     * proposition : la hauteur de la touche au-dessus de la face, ses coins ; le temoin (w x h, son centre a dy du bord du
     * haut). V.4.2 (2026-10-27, Mika : "plus avec un effet 3d, parce que je trouve ca plat"), proposition a valider : 3.2
     * de haut (2 avant), un chanfrein de 0.6 autour du dessus (bevel, le dessus a plat fait 10.8), la course de l'appui
     * (travel, 1.4 : 0.9 avant)
     */
    capHeight: 3.2,
    corner: 0.8,
    bevel: 0.6,
    travel: 1.4,
    led: { w: 5.4, h: 0.8, dy: 1.5 },
    /**
     * V.4.2 (2026-10-27, proposition a valider) : la legende imprimee, facon Digitakt ; cap, sa hauteur de capitale (V.5.0 :
     * 1.35, le meme corps pour les quatorze), tracking son interlettrage (en em, plus serre que la serigraphie de la face,
     * 0.2), w la largeur qu'elle peut prendre (9 mm sur 10.4), dy son centre sous celui de la touche (le temoin est
     * derriere) ; marks, les signes de REC, PLAY et STOP : leur hauteur, l'air entre eux, leur centre
     */
    legend: { cap: 1.35, tracking: 0.06, w: 9, dy: 0.6 },
    marks: { h: 2.4, gap: 1.7, dy: 0.6 },
    /**
     * V.5.0 (2026-10-29) : la legende secondaire (FUNC + la touche), en orange sur la face, centree sous la touche : son
     * centre (cy, entre la touche qui finit a 96 et les pas qui commencent a 104), sa hauteur de capitale, la largeur
     * qu'elle peut prendre (le pas de la rangee moins l'air entre deux) ; le meme corps pour toutes (le plus petit)
     */
    alt: { cy: 98.6, cap: 1.25, w: 11.4 },
    keys: [
      { id: 'func', legend: 'FUNC', name: 'FUNC', title: 'Function', hotspot: 'func', phase: 1 },
      { id: 'trk', legend: 'TRK', alt: 'MUTE', name: 'TRK', title: 'Track', hotspot: 'trk', phase: 1 },
      { id: 'ptn', legend: 'PTN', alt: 'BANK', name: 'PTN', title: 'Pattern', hotspot: 'pad-edit', phase: 1 },
      { id: 'rec', legend: 'REC', marks: ['rec'], alt: 'COPY', name: 'REC', title: 'Record: write the steps', hotspot: 'rec', phase: 1 },
      { id: 'play', legend: 'PLAY', marks: ['play'], alt: 'CLEAR', name: 'PLAY', title: 'Play, pause', hotspot: 'run', phase: 1 },
      { id: 'stop', legend: 'STOP', marks: ['stop'], alt: 'PASTE', name: 'STOP', title: 'Stop', hotspot: 'stop', phase: 1 },
      { id: 'trig', legend: 'TRIG', alt: 'TEMPO', name: 'TRIG', title: 'Trig page', hotspot: 'pkey-trig', phase: 1 },
      { id: 'src', legend: 'SRC', alt: 'SOUNDS', name: 'SRC', title: 'Source page', hotspot: 'pkey-voice', phase: 1 },
      { id: 'fltr', legend: 'FLTR', alt: 'SETUP', name: 'FLTR', title: 'Filter page', hotspot: 'pkey-fltr', phase: 1 },
      { id: 'amp', legend: 'AMP', alt: 'EUCLID', name: 'AMP', title: 'Amp page, the envelope', hotspot: 'pkey-env', phase: 1 },
      { id: 'fx', legend: 'FX', alt: 'SEND FX', name: 'FX', title: 'Effects page of the voice', hotspot: 'pkey-fx', phase: 1 },
      { id: 'mod', legend: 'MOD', alt: 'MIXER', name: 'MOD', title: 'Modulation page', hotspot: 'pkey-mod', phase: 1 },
      { id: 'yes', legend: 'YES', alt: 'SAVE', name: 'YES', title: 'Yes', hotspot: 'yes', phase: 1 },
      { id: 'no', legend: 'NO', alt: 'RELOAD', name: 'NO', title: 'No, back', hotspot: 'no', phase: 1 },
    ] as readonly FpButton[],
  },
  /**
   * V.5.0 (2026-10-29) : OPEN quitte la rangee, le logo M s'ouvre (le capot) : sa zone sur la face, a droite de la bande
   * du logo (le M serigraphie, silk.mark, finit en x 248 sur 9 de haut), sans temoin ; l'id de zone du pad OPEN reste.
   */
  open: { rect: { x: 237.4, y: 72.5, w: 10.6, h: 9 }, title: 'Open the machine (the M logo)', hotspot: 'pad-open' },
  scenes: {
    a: { rect: { x: 180, y: 84, w: 12, h: 12 }, letter: 'A', title: 'Scene A', hotspot: 'scene-a', phase: 1 } as FpScene,
    b: { rect: { x: 236, y: 84, w: 12, h: 12 }, letter: 'B', title: 'Scene B', hotspot: 'scene-b', phase: 1 } as FpScene,
    /** proposition : la lettre imprimee sur SCENE A et B (sa hauteur de capitale, la largeur de son impression) ; la touche, celle des boutons */
    legend: { cap: 3.2, w: 6 },
    /**
     * la fente (Mika : de x 196 a 232 sur y 90) ; proposition : 2.4 de large, bouts ronds ; le capuchon 8 x 12, 7 de haut,
     * au milieu en phase 1, a x depuis P2-20 (2026-10-27, theme.ts xfadeCapX : son centre de x0 + cap.w / 2, la scene A,
     * a x1 - cap.w / 2, la scene B)
     */
    xfade: { x0: 196, x1: 232, y: 90, slot: 2.4, cap: { w: 8, h: 12, z: 7 }, title: 'Crossfader, scene A to scene B', hotspot: 'xfade' },
  },
  steps: {
    w: 27.6,
    h: 20,
    pitch: 30.4,
    x0: 8,
    rows: [104, 128],
    perRow: 8,
    voices: ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'] as readonly FpVoice[],
    /**
     * les legendes sur la touche (proposition) : le numero en haut a gauche (dx, dy : son coin), la voix des pas 1 a 8 en
     * bas au centre (dy : sa ligne) ; w, la largeur de leur impression
     */
    legend: { num: { dx: 3.2, dy: 3.2, cap: 1.2, w: 3.2 }, voice: { dy: 15, cap: 1.5, w: 10 } },
    /**
     * proposition : la hauteur de la touche, ses coins ; le cadre des temps imprime sur les pas 1, 5, 9 et 13 (sa marge, son
     * trait) ; la marque des verrous (w x h, son centre a dy du bord du haut)
     */
    capHeight: 3.2,
    corner: 1.2,
    /** V.4.2 (2026-10-27, proposition a valider) : le chanfrein autour du dessus (le cadre des temps reste sur le plat), la course de l'appui */
    bevel: 0.8,
    travel: 1.4,
    beatFrame: { inset: 1.6, line: 0.5 },
    lockMark: { w: 8, h: 0.9, dy: 2.6 },
    /**
     * TRK (2026-10-27, la phase 2) : TRK tenu, les pas 1 a 8 s'allument. D'une seule couleur depuis V.4.2 (2026-10-27,
     * Mika : "je veux des boutons d'une meme couleur et pas arc en ciel") : l'orange de la machine, la voix choisie plus
     * forte ; les LED RGB des pas du boitier, la meme (sRGB d'affichage). La table d'une couleur par voix est partie.
     */
    trkColor: '#FF6A13',
  },
  /** la serigraphie : imprimee, jamais decoupee ; places provisoires (x : le bord d'alignement, cy : le centre) */
  silk: {
    provisional: true,
    wordmark: { x: 8, cy: 79.5, w: 56 },
    model: { text: 'MM-RYTM', x: 114, cy: 79.5, cap: 2.4 },
    firmware: { text: `FIRMWARE V.${FW.mm808.version} / 2026`, x: 235, cy: 79.5, cap: 1.3 },
    mark: { x: 248, cy: 77, h: 9 },
    hint: { cx: 128.2, cy: 152, cap: 1.36 },
  },
} as const;

/* ---------- aides (pures) ---------- */

const F = RYTM_FACEPLATE;

/** x d'un point de la face (mm) dans le repere du panneau (unites, origine au centre du dessus). */
export const fpX = (xMm: number): number => (xMm - F.size.w / 2) / MM_PER_UNIT;
/** z d'un point de la face (y en mm, vers l'utilisateur) dans le repere du panneau (unites). */
export const fpZ = (yMm: number): number => (yMm - F.size.h / 2) / MM_PER_UNIT;
/** Une longueur (mm) en unites. */
export const fpU = (mm: number): number => mm / MM_PER_UNIT;

/** La touche i de la rangee (0 FUNC a 13 NO depuis V.5.0, 2026-10-29). */
export const buttonRect = (i: number): FpRect => ({ x: F.buttons.x0 + F.buttons.pitch * i, y: F.buttons.y, w: F.buttons.w, h: F.buttons.h });
/** Le pas i (0 a 15) : les huit premiers en haut. */
export const stepRect = (i: number): FpRect => ({
  x: F.steps.x0 + F.steps.pitch * (i % F.steps.perRow),
  y: F.steps.rows[Math.floor(i / F.steps.perRow)] ?? F.steps.rows[0],
  w: F.steps.w,
  h: F.steps.h,
});
/** Le potard k (0 a 7) : A B C D en haut, E F G H dessous (2026-10-27 ; la page GLOBAL FX y pose DIST CHORUS DELAY REVERB, STRETCH SWING BIT COMP). */
export const knobCircle = (k: number): FpCircle => ({ cx: F.knobs.cx[k % 4], cy: F.knobs.cy[k >> 2] ?? F.knobs.cy[0], d: F.knobs.d });
/** Le rang (0 a 13) d'une touche de la rangee par son id. */
export const buttonIndex = (id: FpButtonId): number => F.buttons.keys.findIndex((k) => k.id === id);
/** Le centre d'un rectangle de la face, dans le repere du panneau (unites). */
export const rectCenter = (r: FpRect): { x: number; z: number } => ({ x: fpX(r.x + r.w / 2), z: fpZ(r.y + r.h / 2) });
/** La fente du crossfader en rectangle (son trait de x0 a x1, sa largeur slot). */
export const xfadeRect = (): FpRect => ({ x: F.scenes.xfade.x0, y: F.scenes.xfade.y - F.scenes.xfade.slot / 2, w: F.scenes.xfade.x1 - F.scenes.xfade.x0, h: F.scenes.xfade.slot });

/** Toutes les pieces decoupees ou posees (pas la serigraphie) : l'export SVG et le controle les lisent. */
export function faceplateParts(): { id: string; kind: 'screen' | 'knob' | 'button' | 'scene' | 'xfade' | 'step'; rect: FpRect }[] {
  const out: { id: string; kind: 'screen' | 'knob' | 'button' | 'scene' | 'xfade' | 'step'; rect: FpRect }[] = [];
  out.push({ id: 'screen', kind: 'screen', rect: F.screen.rect });
  for (let k = 0; k < 8; k += 1) {
    const c = knobCircle(k);
    out.push({ id: `knob-${F.knobs.labels[k].toLowerCase()}`, kind: 'knob', rect: { x: c.cx - c.d / 2, y: c.cy - c.d / 2, w: c.d, h: c.d } });
  }
  F.buttons.keys.forEach((b, i) => out.push({ id: `btn-${b.id}`, kind: 'button', rect: buttonRect(i) }));
  out.push({ id: 'scene-a', kind: 'scene', rect: F.scenes.a.rect });
  out.push({ id: 'xfade', kind: 'xfade', rect: xfadeRect() });
  out.push({ id: 'scene-b', kind: 'scene', rect: F.scenes.b.rect });
  for (let i = 0; i < 16; i += 1) out.push({ id: `step-${i + 1}`, kind: 'step', rect: stepRect(i) });
  return out;
}

/**
 * Les points de la face a faire valider (la revue du 2026-10-27), des chiffres de Mika : rien a corriger seul, d'ou une
 * liste a part (faceplateCheck reste []). Les marges gauche et droite des pas, leur bord droit contre celui de SCENE B ;
 * aujourd'hui : 8 et 7.6, 0.4 au-dela (un pas de 30.343, ou des pas de 27.2 au pas de 30.4, rendraient 8 et 8).
 */
export function faceplateNotes(): string[] {
  const r2 = (v: number): number => Math.round(v * 100) / 100;
  const notes: string[] = [];
  const first = stepRect(0);
  const last = stepRect(F.steps.perRow - 1);
  const left = r2(first.x);
  const right = r2(F.size.w - (last.x + last.w));
  if (left !== right) notes.push(`steps: marge ${left} a gauche, ${right} a droite`);
  const b = F.scenes.b.rect;
  const over = r2(last.x + last.w - (b.x + b.w));
  if (over !== 0) notes.push(`steps: le bord droit ${over > 0 ? 'depasse de' : 'rentre de'} ${Math.abs(over)} celui de SCENE B`);
  return notes;
}

/** Les problemes de la face : une piece hors de la face, deux pieces qui se touchent ; [] attendu. */
export function faceplateCheck(): string[] {
  const parts = faceplateParts();
  const bad: string[] = [];
  for (const p of parts) {
    const r = p.rect;
    if (r.x < 0 || r.y < 0 || r.x + r.w > F.size.w || r.y + r.h > F.size.h) bad.push(`${p.id}: hors de la face`);
  }
  for (let i = 0; i < parts.length; i += 1) {
    for (let j = i + 1; j < parts.length; j += 1) {
      const a = parts[i].rect;
      const b = parts[j].rect;
      if (a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h) bad.push(`${parts[i].id} / ${parts[j].id}: se touchent`);
    }
  }
  return bad;
}

/* ---------- V.6.0 : la face Digitakt II de Mika (option A, 256 x 156) ---------- */

/*
 * La face DT2 (V.6.0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 2.2 a 2.4 ; Mika : "refais la Digitakt mais avec mon
 * design ; tous les boutons, le placement des choses et toutes les fonctionnalites c'est base sur la Digitakt, sans le cote
 * sampler" ; ses reponses : sa taille 256 x 156 et son ecran 4.3 pouces, les scenes A et B quittent la face, SAMPLING
 * devient SOUNDS). Les memes regles que RYTM_FACEPLATE : des donnees seules, en mm, le meme repere. Derriere le drapeau
 * ?face=dt2 (theme/base.ts DT2_FACE) tant que la V.6.0 n'est pas integree : sans lui, rien ne la lit.
 *
 * Les places : la grille A du cahier (2.2), dont les centres et les classes de touches sont figes dans rytm/dtFaceIds.ts
 * (DT2_BUTTONS, DT2_SIDE_KNOBS) : rien n'est recopie ici. Les tailles (option A) : potards A a H de 24 d'emprise (anneau
 * 19.8 a 23.2, capuchon 14.5 / 13.6 / 7), MAIN VOLUME 20 (un anneau fin), LEVEL/DATA 22 ; touches P 12 x 11, L 22 x 11, G
 * (PAGE) 26 x 11 ; TRIG 22 x 19 au pas de 190 / 7. Le relief, les coins, le temoin, les legendes : ceux de la V.5.3.
 */

/** La taille des quatre classes de touches (2.2) : P petite, L large, G la touche PAGE, A fleche/OPEN compacte. */
export const DT2_KEY_SIZE: Readonly<Record<Dt2KeyClass, { readonly w: number; readonly h: number }>> = {
  P: { w: 12, h: 11 },
  L: { w: 22, h: 11 },
  G: { w: 26, h: 11 },
  A: { w: 9.6, h: 9.6 },
};

/** Une touche de la face DT2 : sa classe et son rectangle, ce qu'elle porte, sa zone (les ids d'avant gardes, 2.6). */
export interface Dt2Key {
  readonly id: Dt2ButtonId;
  readonly cls: Dt2KeyClass;
  readonly rect: FpRect;
  /** le mot imprime sur la touche (marks : des signes a la place, legend reste son nom ecrit) */
  readonly legend: string;
  readonly marks?: readonly FpMark[];
  /** la fonction orange (FUNC +), imprimee sous la touche ; absente : rien */
  readonly alt?: string;
  readonly name: string;
  readonly title: string;
  readonly hotspot: string;
  /** 1 : agit (les touches de la V.5.3) ; 2 : dessinee, inerte tant que la lane B4 ne l'a pas branchee */
  readonly phase: 1 | 2;
}

/**
 * Ce qui n'est pas dans le contrat P0 : le nom complet (l'infobulle, le jumeau), l'id de zone (2.6 : func trk pad-edit rec
 * run stop pkey-* yes no gardes ; les touches nouvelles prennent leur id, PAGE prend ptnpage), les signes.
 */
const DT2_KEY_MORE: Readonly<Record<Dt2ButtonId, { title: string; hotspot: string; marks?: readonly FpMark[] }>> = {
  func: { title: 'Function', hotspot: 'func' },
  kbd: { title: 'Keyboard', hotspot: 'kbd' },
  trk: { title: 'Track', hotspot: 'trk' },
  ptn: { title: 'Pattern', hotspot: 'pad-edit' },
  mute: { title: 'Mute mode', hotspot: 'mute' },
  solo: { title: 'Solo mode', hotspot: 'solo' },
  preset: { title: 'Presets and kits', hotspot: 'preset' },
  random: { title: 'Random pattern and sounds', hotspot: 'random' },
  settings: { title: 'Settings', hotspot: 'settings' },
  sounds: { title: 'Sounds, your sample bank', hotspot: 'sounds' },
  tempo: { title: 'Tempo', hotspot: 'tempo' },
  rec: { title: 'Record', hotspot: 'rec', marks: ['rec'] },
  play: { title: 'Play, pause', hotspot: 'run', marks: ['play'] },
  stop: { title: 'Stop', hotspot: 'stop', marks: ['stop'] },
  trig: { title: 'Trig page', hotspot: 'pkey-trig' },
  src: { title: 'Source page', hotspot: 'pkey-voice' },
  fltr: { title: 'Filter page', hotspot: 'pkey-fltr' },
  amp: { title: 'Amp page, the envelope', hotspot: 'pkey-env' },
  fx: { title: 'Effects page of the track', hotspot: 'pkey-fx' },
  mod: { title: 'Modulation page', hotspot: 'pkey-mod' },
  yes: { title: 'Yes', hotspot: 'yes' },
  up: { title: 'Up', hotspot: 'up', marks: ['up'] },
  open: { title: 'Open the machine', hotspot: 'pad-open' },
  no: { title: 'No, back', hotspot: 'no' },
  left: { title: 'Left', hotspot: 'left', marks: ['left'] },
  down: { title: 'Down', hotspot: 'down', marks: ['down'] },
  right: { title: 'Right', hotspot: 'right', marks: ['right'] },
  ptnpage: { title: 'Pattern page', hotspot: 'ptnpage' },
};

/** Les quatorze touches de la V.5.3 (elles agissent) ; les autres sont branchees aussi. */
const DT2_KEPT: ReadonlySet<Dt2ButtonId> = new Set<Dt2ButtonId>(['func', 'trk', 'ptn', 'rec', 'play', 'stop', 'trig', 'src', 'fltr', 'amp', 'fx', 'mod', 'yes', 'no']);

/** Le rectangle d'une touche de classe cls centree en (cx, cy). */
const keyRect = (cls: Dt2KeyClass, cx: number, cy: number): FpRect => ({ x: cx - DT2_KEY_SIZE[cls].w / 2, y: cy - DT2_KEY_SIZE[cls].h / 2, w: DT2_KEY_SIZE[cls].w, h: DT2_KEY_SIZE[cls].h });

/** Les 27 touches dans l'ordre de lecture de la face (celui de DT2_BUTTONS, l'ordre de tabulation des jumeaux en derive). */
const DT2_KEYS: readonly Dt2Key[] = DT2_BUTTONS.map((b) => ({
  id: b.id,
  cls: b.cls,
  rect: keyRect(b.cls, b.cx, b.cy),
  legend: b.legend,
  ...(DT2_KEY_MORE[b.id].marks ? { marks: DT2_KEY_MORE[b.id].marks } : {}),
  ...(b.func ? { alt: b.func } : {}),
  name: b.legend,
  title: DT2_KEY_MORE[b.id].title,
  hotspot: DT2_KEY_MORE[b.id].hotspot,
  // V.6.0 (lane B4, 2026-11-01) : toutes branchees
  phase: DT2_KEPT.has(b.id) || b.id !== 'kbd' ? 1 : 2,
}));

/** Un potard de la colonne gauche (2.2) : son centre, son emprise (d), son capuchon, sa jupe, son anneau, ses legendes. */
export interface Dt2SideKnob {
  readonly id: 'mvol' | 'data';
  readonly cx: number;
  readonly cy: number;
  readonly d: number;
  readonly cap: { readonly d: number; readonly top: number; readonly h: number };
  readonly skirt: { readonly d: number; readonly h: number };
  readonly ring: { readonly inner: number; readonly outer: number; readonly segments: number; readonly airDeg: number };
  /** MAIN VOLUME a son repere (un potentiometre absolu, comme la DT2) ; LEVEL/DATA non (un encodeur sans fin) */
  readonly mark: boolean;
  readonly legend: string;
  readonly alt: string;
  readonly title: string;
}

/**
 * MAIN VOLUME et LEVEL/DATA : les tailles des potards A a H ramenees a leur emprise (20 / 24 et 22 / 24) ; MAIN VOLUME a
 * un anneau fin (2.2 : "pot d 20, repere, anneau fin"), LEVEL/DATA l'anneau des autres.
 */
const SIDE_MORE: Readonly<Record<'mvol' | 'data', Omit<Dt2SideKnob, 'id' | 'cx' | 'cy' | 'd' | 'legend' | 'alt'>>> = {
  mvol: { cap: { d: 12.1, top: 11.3, h: 5.8 }, skirt: { d: 13.2, h: 0.8 }, ring: { inner: 17.6, outer: 19.2, segments: 27, airDeg: 3 }, mark: true, title: 'Main volume' },
  data: { cap: { d: 13.3, top: 12.5, h: 6.4 }, skirt: { d: 14.5, h: 0.8 }, ring: { inner: 18.2, outer: 21.3, segments: 27, airDeg: 3 }, mark: false, title: 'Level / data: the level of the track, scrolls the menus' },
};

export const DT2_FACEPLATE = {
  version: 'V.6.0',
  size: RYTM_FACEPLATE.size,
  edge: RYTM_FACEPLATE.edge,
  screen: {
    /** le meme ecran 4.3 pouces (Q1), deplace a droite de la colonne gauche (2.2 : x 34 a 140, y 8 a 75) */
    rect: { x: 34, y: 8, w: 106, h: 67 },
    active: RYTM_FACEPLATE.screen.active,
    px: RYTM_FACEPLATE.screen.px,
    diagonalIn: RYTM_FACEPLATE.screen.diagonalIn,
  },
  knobs: {
    /** 24 d'emprise (le potard et son anneau), au pas de 80 / 3 en x, 26 en y (2.2) */
    d: 24,
    pitch: 80 / 3,
    cx: [156, 156 + 80 / 3, 156 + 160 / 3, 236],
    cy: [20, 46],
    fx: RYTM_FACEPLATE.knobs.fx,
    labels: RYTM_FACEPLATE.knobs.labels,
    /** inv-mm-face 8 : 6.8 + 7 / tan 69 = 9.5 < 9.9, le bord interieur de l'anneau reste visible a l'arrivee */
    cap: { d: 14.5, top: 13.6, h: 7 },
    skirt: { d: 15.8, h: 0.8 },
    ring: { inner: 19.8, outer: 23.2, sweepDeg: 270, segments: 27, airDeg: 3 },
    label: { r: 10.6, cap: 1.8 },
  },
  /** MAIN VOLUME et LEVEL/DATA (2.2), leurs legendes dessous (2.3) : le nom 1.3 sous le potard, la fonction orange 0.6 dessous */
  side: {
    knobs: DT2_SIDE_KNOBS.map((s): Dt2SideKnob => ({ id: s.id, cx: s.cx, cy: s.cy, d: s.d, legend: s.legend, alt: s.func, ...SIDE_MORE[s.id] })),
    legend: { gap: 1.3, cap: 1.4 },
    alt: { gap: 0.6, cap: 1.25 },
  },
  buttons: {
    sizes: DT2_KEY_SIZE,
    capHeight: RYTM_FACEPLATE.buttons.capHeight,
    corner: RYTM_FACEPLATE.buttons.corner,
    bevel: RYTM_FACEPLATE.buttons.bevel,
    travel: RYTM_FACEPLATE.buttons.travel,
    led: RYTM_FACEPLATE.buttons.led,
    /** la legende sur la touche : le corps de la V.5.3, la largeur de la touche moins margin de chaque cote */
    legend: { cap: RYTM_FACEPLATE.buttons.legend.cap, tracking: RYTM_FACEPLATE.buttons.legend.tracking, margin: 0.8, dy: RYTM_FACEPLATE.buttons.legend.dy },
    marks: RYTM_FACEPLATE.buttons.marks,
    /** la fonction orange (2.2) : affichee directement sur la touche quand FUNC est engagee */
    alt: { gap: 1.3, cap: 1.25, w: 17 },
    keys: DT2_KEYS,
  },
  /** Les 8 LED de page (2.2, 2.4) : une fenetre sombre en creux (2.3), deux rangees de quatre, d 3.4, a gauche de PAGE. */
  pageLeds: { window: { x: 193, y: 77.5, w: 25, h: 10 }, corner: 1.6, d: 3.4, cx: [196.8, 202.6, 208.4, 214.2], cy: [80, 85] },
  /** Le bouton OPEN sur la face (dans le bloc des fleches, a droite de UP). */
  open: { rect: { x: 179.7, y: 78, w: 9.6, h: 9.6 }, title: 'Open the machine (OPEN); FUNC + OPEN: + SAMPLE', hotspot: 'pad-open' },
  /** SCENE A, le crossfader et SCENE B (facon Octatrack MKII x Digitakt II), sous les LED de page et PAGE. */
  scenes: {
    a: { rect: { x: 193, y: 94, w: 10, h: 11 }, letter: 'A', title: 'Scene A', hotspot: 'scene-a', phase: 1 } as FpScene,
    b: { rect: { x: 240, y: 94, w: 10, h: 11 }, letter: 'B', title: 'Scene B', hotspot: 'scene-b', phase: 1 } as FpScene,
    legend: { cap: 2.8, w: 5.5 },
    xfade: { x0: 206, x1: 237, y: 99.5, slot: 2.4, cap: { w: 7.6, h: 11, z: 7 }, title: 'Crossfader, scene A to scene B', hotspot: 'xfade' },
  },
  steps: {
    w: 22,
    h: 19,
    pitch: 190 / 7,
    x0: 36,
    rows: [111, 133],
    perRow: 8,
    /** 16 pistes libres (2.2) : les pas ne portent que leur numero */
    voices: [] as readonly FpVoice[],
    legend: { num: RYTM_FACEPLATE.steps.legend.num },
    capHeight: RYTM_FACEPLATE.steps.capHeight,
    corner: RYTM_FACEPLATE.steps.corner,
    bevel: RYTM_FACEPLATE.steps.bevel,
    travel: RYTM_FACEPLATE.steps.travel,
    beatFrame: RYTM_FACEPLATE.steps.beatFrame,
    lockMark: RYTM_FACEPLATE.steps.lockMark,
    trkColor: RYTM_FACEPLATE.steps.trkColor,
  },
  /**
   * Les cadres (2.3) : des traits fins a coins arrondis, seulement autour des groupes de la DT2 (potards A a H, touches de
   * page, fleches + OPEN, TRIG 1 a 16 ; la fenetre des LED est une piece a part) ; members : ce qu'ils entourent, legendes comprises.
   */
  frames: [
    { id: 'knobs', rect: { x: 142, y: 6, w: 108, h: 53 }, r: 2, members: ['knob-a', 'knob-b', 'knob-c', 'knob-d', 'knob-e', 'knob-f', 'knob-g', 'knob-h'] },
    { id: 'pages', rect: { x: 142, y: 60, w: 108, h: 14.5 }, r: 2, members: ['btn-trig', 'btn-src', 'btn-fltr', 'btn-amp', 'btn-fx', 'btn-mod'] },
    { id: 'arrows', rect: { x: 156, y: 76.5, w: 35, h: 30.5 }, r: 2, members: ['btn-up', 'btn-open', 'btn-left', 'btn-down', 'btn-right'] },
    { id: 'trigs', rect: { x: 34, y: 109.5, w: 216, h: 44.5 }, r: 2, members: [...Array.from({ length: 16 }, (_, i) => `step-${i + 1}`), 'trackmute'] },
  ] as readonly { id: string; rect: FpRect; r: number; members: readonly string[] }[],
  silk: {
    /**
     * Le decalque du cadre de l'ecran (2.3, comme "Digitakt II") : dans la bande sous la zone active, le wordmark a gauche
     * (cale sur le bord gauche de la zone active), MM-RYTM et le firmware a droite (cales sur son bord droit, l'un sur
     * l'autre : la bande fait 5.4 de haut). Un petit maillage au-dessus du cadre (scene/silk.ts BezelDecal).
     */
    decal: {
      wordmark: { x: 40.2, cy: 72.3, w: 56, h: 3.3 },
      model: { text: 'MM-RYTM', x: 133.8, cy: 71.4, cap: 2 },
      firmware: { text: `FIRMWARE V.${FW.mm808.version} / 2026`, x: 133.8, cy: 73.7, cap: 1 },
    },
    /** le M serigraphie sur la zone du logo (cale a droite, comme avant) */
    mark: { x: 24.3, cy: 67, h: 9 },
    /** KB OCT (garde pour compatibilite de structure) */
    kbOct: { text: '↕ KB OCT', x: 194, cy: 83.5, cap: 1.25, w: 16 },
    /** TRACK/MUTE entre les deux rangees de TRIG (2.3), en orange, et son accolade pointillee de TRIG 1 a TRIG 8 */
    trackMute: { text: 'TRACK/MUTE', cx: 142, cy: 131.5, cap: 1.25, x0: 47, x1: 237, gap: 2.5, dot: 0.35, dash: 0.9, tick: 0.8 },
  },
} as const;

/* ---------- aides de la face DT2 (pures) ---------- */

const D = DT2_FACEPLATE;

/** Le pas i (0 a 15) de la face DT2. */
export const dt2StepRect = (i: number): FpRect => ({
  x: D.steps.x0 + D.steps.pitch * (i % D.steps.perRow),
  y: D.steps.rows[Math.floor(i / D.steps.perRow)] ?? D.steps.rows[0],
  w: D.steps.w,
  h: D.steps.h,
});
/** Le potard k (0 a 7) de la face DT2. */
export const dt2KnobCircle = (k: number): FpCircle => ({ cx: D.knobs.cx[k % 4], cy: D.knobs.cy[k >> 2] ?? D.knobs.cy[0], d: D.knobs.d });
/** Une touche de la face DT2 par son id. */
export const dt2Key = (id: Dt2ButtonId): Dt2Key | undefined => D.buttons.keys.find((k) => k.id === id);

const circleRect = (c: FpCircle): FpRect => ({ x: c.cx - c.d / 2, y: c.cy - c.d / 2, w: c.d, h: c.d });
const dt2XfadeRect = (): FpRect => ({ x: D.scenes.xfade.x0, y: D.scenes.xfade.y - D.scenes.xfade.slot / 2, w: D.scenes.xfade.x1 - D.scenes.xfade.x0, h: D.scenes.xfade.slot });

export type Dt2PartKind = 'screen' | 'knob' | 'side' | 'button' | 'logo' | 'leds' | 'scene' | 'xfade' | 'step';

/** Toutes les pieces de la face DT2 (decoupees ou posees) : la jupe d'ombre, l'export et le controle les lisent. */
export function dt2FaceplateParts(): { id: string; kind: Dt2PartKind; rect: FpRect }[] {
  const out: { id: string; kind: Dt2PartKind; rect: FpRect }[] = [];
  out.push({ id: 'screen', kind: 'screen', rect: D.screen.rect });
  for (const s of D.side.knobs) out.push({ id: `side-${s.id}`, kind: 'side', rect: circleRect({ cx: s.cx, cy: s.cy, d: s.d }) });
  for (let k = 0; k < 8; k += 1) out.push({ id: `knob-${D.knobs.labels[k].toLowerCase()}`, kind: 'knob', rect: circleRect(dt2KnobCircle(k)) });
  for (const b of D.buttons.keys) out.push({ id: `btn-${b.id}`, kind: 'button', rect: b.rect });
  out.push({ id: 'page-leds', kind: 'leds', rect: D.pageLeds.window });
  out.push({ id: 'scene-a', kind: 'scene', rect: D.scenes.a.rect });
  out.push({ id: 'xfade', kind: 'xfade', rect: dt2XfadeRect() });
  out.push({ id: 'scene-b', kind: 'scene', rect: D.scenes.b.rect });
  for (let i = 0; i < 16; i += 1) out.push({ id: `step-${i + 1}`, kind: 'step', rect: dt2StepRect(i) });
  return out;
}

/**
 * La largeur estimee d'un texte de la serigraphie (sans police : node, le test) : une capitale moyenne de 0.62 em (un rien
 * plus large que SF Pro, une police de repli comprise), l'interlettrage entre les lettres. La scene reduit le corps d'un
 * texte trop large (maxW) : cette estimation est le pire cas.
 */
export const silkTextW = (text: string, cap: number, tracking = 0.2): number => (cap / 0.7) * (text.length * 0.62 + Math.max(0, text.length - 1) * tracking);

/** Une legende imprimee : sa boite (le haut et le bas des capitales), son texte, a qui elle est (le controle l'excuse sur sa piece). */
export interface Dt2Legend {
  readonly id: string;
  readonly text: string;
  readonly rect: FpRect;
  readonly cap: number;
  readonly ink: 'silk' | 'alt' | 'decal';
  /** la piece qui la porte (une lettre dans la fente de son anneau) */
  readonly owner?: string;
}

const boxAt = (text: string, cap: number, cx: number, cy: number, align: 'center' | 'left' | 'right' = 'center', tracking = 0.2): FpRect => {
  const w = silkTextW(text, cap, tracking);
  const x = align === 'left' ? cx : align === 'right' ? cx - w : cx - w / 2;
  return { x, y: cy - cap / 2, w, h: cap };
};

/** Toutes les legendes de la serigraphie de la face DT2 (hors celles imprimees sur les touches) et du decalque de l'ecran. */
export function dt2FaceplateLegends(): Dt2Legend[] {
  const out: Dt2Legend[] = [];
  for (const s of D.side.knobs) {
    const L = D.side.legend;
    const cy = s.cy + s.d / 2 + L.gap + L.cap / 2;
    out.push({ id: `side-${s.id}`, text: s.legend, cap: L.cap, ink: 'silk', rect: boxAt(s.legend, L.cap, s.cx, cy) });
    if (s.alt) {
      const S = D.side.alt;
      const cy2 = cy + L.cap / 2 + S.gap + S.cap / 2;
      out.push({ id: `side-${s.id}-alt`, text: s.alt, cap: S.cap, ink: 'alt', rect: boxAt(s.alt, S.cap, s.cx, cy2) });
    }
  }
  for (let k = 0; k < 8; k += 1) {
    const c = dt2KnobCircle(k);
    const l = D.knobs.labels[k];
    out.push({ id: `letter-${l.toLowerCase()}`, text: l, cap: D.knobs.label.cap, ink: 'silk', rect: boxAt(l, D.knobs.label.cap, c.cx, c.cy + D.knobs.label.r), owner: `knob-${l.toLowerCase()}` });
  }
  const T = D.silk.trackMute;
  out.push({ id: 'trackmute', text: T.text, cap: T.cap, ink: 'alt', rect: boxAt(T.text, T.cap, T.cx, T.cy) });
  const W = D.silk.decal;
  out.push({ id: 'decal-wordmark', text: 'MAUDITE MACHINE', cap: W.wordmark.h, ink: 'decal', rect: { x: W.wordmark.x, y: W.wordmark.cy - W.wordmark.h / 2, w: W.wordmark.w, h: W.wordmark.h } });
  out.push({ id: 'decal-model', text: W.model.text, cap: W.model.cap, ink: 'decal', rect: boxAt(W.model.text, W.model.cap, W.model.x, W.model.cy, 'right') });
  out.push({ id: 'decal-firmware', text: W.firmware.text, cap: W.firmware.cap, ink: 'decal', rect: boxAt(W.firmware.text, W.firmware.cap, W.firmware.x, W.firmware.cy, 'right') });
  return out;
}

/** L'accolade pointillee de TRACK/MUTE : deux traits de x0 au texte et du texte a x1, une petite barre au bout. */
export function dt2TrackMuteDots(): { x0: number; x1: number; y: number; tick: number }[] {
  const T = D.silk.trackMute;
  const w = silkTextW(T.text, T.cap);
  return [
    { x0: T.x0, x1: T.cx - w / 2 - T.gap, y: T.cy, tick: T.tick },
    { x0: T.cx + w / 2 + T.gap, x1: T.x1, y: T.cy, tick: T.tick },
  ];
}

const inside = (a: FpRect, b: FpRect, m = 0): boolean => a.x >= b.x + m - 1e-9 && a.y >= b.y + m - 1e-9 && a.x + a.w <= b.x + b.w - m + 1e-9 && a.y + a.h <= b.y + b.h - m + 1e-9;
const overlap = (a: FpRect, b: FpRect): boolean => a.x < b.x + b.w && b.x < a.x + a.w && a.y < b.y + b.h && b.y < a.y + a.h;
const gapBetween = (a: FpRect, b: FpRect): number => Math.max(b.x - (a.x + a.w), a.x - (b.x + b.w), b.y - (a.y + a.h), a.y - (b.y + b.h));
const r2 = (v: number): number => Math.round(v * 100) / 100;

/** Le jeu minimal entre deux cadres (2.3, la critique : 0 mm avant, 2 mm sur la DT2) et la marge des pieces au bord (le chanfrein). */
export const DT2_CHECK = { frameGap: 0.8, edge: RYTM_FACEPLATE.edge.chamfer, frameIn: 0.5 } as const;

/**
 * Les problemes de la face DT2 ([] attendu, npm run face:test) : une piece ou une legende hors de la face (a moins du
 * chanfrein du bord), deux pieces qui se touchent, une legende sur une piece ou une autre legende, le decalque hors de la
 * bande du cadre de l'ecran, un cadre qui n'entoure pas ses membres (legendes comprises, frameIn de marge) ou qui coupe
 * une piece ou une legende, deux cadres a moins de frameGap.
 */
export function dt2FaceplateCheck(): string[] {
  const bad: string[] = [];
  const parts = dt2FaceplateParts();
  const legends = dt2FaceplateLegends();
  const E = DT2_CHECK.edge;
  const face: FpRect = { x: 0, y: 0, w: D.size.w, h: D.size.h };
  const all = [...parts.map((p) => ({ id: p.id, rect: p.rect })), ...legends.map((l) => ({ id: l.id, rect: l.rect })), ...D.frames.map((f) => ({ id: `frame-${f.id}`, rect: f.rect }))];
  for (const p of all) if (!inside(p.rect, face, E)) bad.push(`${p.id}: hors de la face (a moins de ${E} du bord)`);
  for (let i = 0; i < parts.length; i += 1) {
    for (let j = i + 1; j < parts.length; j += 1) if (overlap(parts[i].rect, parts[j].rect)) bad.push(`${parts[i].id} / ${parts[j].id}: se touchent`);
  }
  // Les legendes : ni sur une piece (sauf la sienne), ni sur une autre legende ; le decalque dans la bande du cadre
  const screen = D.screen.rect;
  const act = D.screen.active;
  const band: FpRect = { x: screen.x + (screen.w - act.w) / 2, y: screen.y + (screen.h + act.h) / 2, w: act.w, h: (screen.h - act.h) / 2 };
  for (const l of legends) {
    if (l.ink === 'decal') {
      if (!inside(l.rect, band)) bad.push(`${l.id}: hors de la bande du cadre de l'ecran`);
      continue;
    }
    for (const p of parts) if (p.id !== l.owner && overlap(l.rect, p.rect)) bad.push(`${l.id} / ${p.id}: la legende touche la piece`);
  }
  for (let i = 0; i < legends.length; i += 1) {
    for (let j = i + 1; j < legends.length; j += 1) if (overlap(legends[i].rect, legends[j].rect)) bad.push(`${legends[i].id} / ${legends[j].id}: les legendes se touchent`);
  }
  // Les cadres : leurs membres dedans (avec leurs legendes : la fonction orange d'une touche, la lettre d'un potard), rien
  // d'autre coupe ni dedans, le jeu entre deux cadres
  const byId = new Map(all.map((p) => [p.id, p.rect]));
  const ownLegends = (m: string): string[] => (m.startsWith('btn-') ? [`alt-${m.slice(4)}`] : m.startsWith('knob-') ? [`letter-${m.slice(5)}`] : []);
  for (const f of D.frames) {
    const mine = new Set(f.members.flatMap((m) => [m, ...ownLegends(m)]));
    for (const m of mine) {
      const r = byId.get(m);
      if (!r) continue;
      if (!inside(r, f.rect, DT2_CHECK.frameIn)) bad.push(`frame-${f.id}: ${m} n'est pas dedans (marge ${DT2_CHECK.frameIn})`);
    }
    for (const p of [...parts, ...legends]) {
      if (mine.has(p.id) || ('ink' in p && p.ink === 'decal')) continue;
      if (overlap(p.rect, f.rect)) bad.push(`frame-${f.id}: coupe ou contient ${p.id}`);
    }
  }
  for (let i = 0; i < D.frames.length; i += 1) {
    for (let j = i + 1; j < D.frames.length; j += 1) {
      const g = gapBetween(D.frames[i].rect, D.frames[j].rect);
      if (g < DT2_CHECK.frameGap) bad.push(`frame-${D.frames[i].id} / frame-${D.frames[j].id}: ${r2(g)} de jeu (${DT2_CHECK.frameGap} au moins)`);
    }
  }
  // La fenetre des LED : ses huit LED dedans
  for (const cy of D.pageLeds.cy) {
    for (const cx of D.pageLeds.cx) if (!inside(circleRect({ cx, cy, d: D.pageLeds.d }), D.pageLeds.window, 0.3)) bad.push(`page-leds: la LED ${cx}, ${cy} deborde de sa fenetre`);
  }
  // L'accolade de TRACK/MUTE : entre les deux rangees de TRIG
  for (const t of dt2TrackMuteDots()) {
    const r: FpRect = { x: t.x0, y: t.y - t.tick, w: t.x1 - t.x0, h: 2 * t.tick };
    if (r.w <= 0) bad.push('trackmute: l accolade n a plus de place');
    for (const p of parts) if (overlap(r, p.rect)) bad.push(`trackmute: l accolade touche ${p.id}`);
  }
  return bad;
}
