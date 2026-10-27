/**
 * La face du MM-RYTM V.4.0 en millimetres (2026-10-27, Mika : "faceplate
 * Octatrack x Digitakt ; la machine sera aussi construite en vrai, la face
 * doit correspondre exactement a la future machine physique") : LA source de
 * verite de la face, des donnees seules. La scene 3D (theme.ts la ramene en
 * unites : 20 mm l'unite, MM_PER_UNIT), les jumeaux HTML et, plus tard,
 * l'export SVG de la decoupe la lisent. Ce module n'importe rien (ni three, ni
 * le theme : theme.ts l'importe, et un script node doit pouvoir le prendre
 * seul avec esbuild, comme scripts/mm-studio-patterns.mjs prend beatcode.ts).
 *
 * Repere : le coin en haut a gauche de la face, x vers la droite, y vers le
 * bas (vers l'utilisateur sur la machine). Un rectangle par son coin en haut a
 * gauche (x, y) et sa taille (w, h) ; un cercle par son centre et son diametre.
 *
 * Ce que Mika a fixe (2026-10-27) : la face 256 x 156 ; l'ecran 4.3 pouces
 * 800 x 480 en 8, 8, 106 x 67 ; huit potards de 28 en 2 x 4 au pas de 32,
 * centres x 134 166 198 230, y 24 et 56 (DIST CHORUS DELAY REVERB, STRETCH
 * SWING BIT COMP), chacun son anneau de valeur (la machine aura des potards
 * motorises qui suivent la valeur) ; douze touches a pictogramme de 12 x 12 en
 * y 84, x = 8 + 14 i (TRK VOICE FLTR ENV FX EDIT OPEN RUN/STOP CLEAR RANDOM
 * MUTE SOLO), sans texte ; SCENE A en 180, 84, la fente du crossfader de x 196
 * a 232 sur y 90, SCENE B en 236, 84 ; seize pas de 27.6 x 20 en deux rangees
 * de huit au pas de 30.4 depuis x 8, en y 104 et 128, les pas 1 a 8 portent le
 * nom d'une voix (BD SD CH OH CP TOM HT CY). Les dix pads disparaissent.
 * Le reste (le capuchon des potards, la fente, les legendes, la serigraphie)
 * est une proposition a valider : tout est ici, un seul endroit a changer.
 */

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
export type FpButtonId = 'trk' | 'voice' | 'fltr' | 'env' | 'fx' | 'edit' | 'open' | 'run' | 'clear' | 'random' | 'mute' | 'solo';
export type FpIconId =
  | 'stack-2'
  | 'wave-sine'
  | 'lowpass'
  | 'adsr'
  | 'sparkles'
  | 'layout-grid'
  | 'folder-open'
  | 'player-play'
  | 'player-stop'
  | 'eraser'
  | 'dice-5'
  | 'volume-off'
  | 'headphones';

export interface FpButton {
  readonly id: FpButtonId;
  /** son pictogramme (rytm/icons.ts) ; alt : celui de l'etat actif (RUN/STOP pendant la lecture) */
  readonly icon: FpIconId;
  readonly alt?: FpIconId;
  /** le nom court (celui de Mika) ; title : le nom complet (l'infobulle et le nom du jumeau) */
  readonly name: string;
  readonly title: string;
  /** l'id de sa zone de saisie (scene/hit.ts) et de son jumeau */
  readonly hotspot: string;
  /** 1 : agit des la phase 1 ; 2 : visible et inerte jusqu'a la phase 2 */
  readonly phase: 1 | 2;
}

export interface FpScene {
  readonly rect: FpRect;
  readonly letter: 'A' | 'B';
  readonly title: string;
  readonly hotspot: string;
}

export const RYTM_FACEPLATE = {
  version: 'V.4.0',
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
    ring: { inner: 23.2, outer: 27.2, sweepDeg: 270, segments: 27 },
    label: { r: 12.6, cap: 1.8 },
  },
  buttons: {
    size: 12,
    x0: 8,
    pitch: 14,
    y: 84,
    keys: [
      { id: 'trk', icon: 'stack-2', name: 'TRK', title: 'Track', hotspot: 'trk', phase: 2 },
      { id: 'voice', icon: 'wave-sine', name: 'VOICE', title: 'Voice page', hotspot: 'pkey-voice', phase: 1 },
      { id: 'fltr', icon: 'lowpass', name: 'FLTR', title: 'Filter page', hotspot: 'pkey-fltr', phase: 1 },
      { id: 'env', icon: 'adsr', name: 'ENV', title: 'Envelope page', hotspot: 'pkey-env', phase: 1 },
      { id: 'fx', icon: 'sparkles', name: 'FX', title: 'Effects page', hotspot: 'pkey-fx', phase: 1 },
      { id: 'edit', icon: 'layout-grid', name: 'EDIT', title: 'Edit: the 16 patterns', hotspot: 'pad-edit', phase: 1 },
      { id: 'open', icon: 'folder-open', name: 'OPEN', title: 'Open the machine', hotspot: 'pad-open', phase: 1 },
      { id: 'run', icon: 'player-play', alt: 'player-stop', name: 'RUN/STOP', title: 'Run / Stop', hotspot: 'run', phase: 1 },
      { id: 'clear', icon: 'eraser', name: 'CLEAR', title: 'Clear', hotspot: 'clear', phase: 1 },
      { id: 'random', icon: 'dice-5', name: 'RANDOM', title: 'Random', hotspot: 'random', phase: 1 },
      { id: 'mute', icon: 'volume-off', name: 'MUTE', title: 'Mute', hotspot: 'mute', phase: 1 },
      { id: 'solo', icon: 'headphones', name: 'SOLO', title: 'Solo', hotspot: 'solo', phase: 1 },
    ] as readonly FpButton[],
  },
  scenes: {
    a: { rect: { x: 180, y: 84, w: 12, h: 12 }, letter: 'A', title: 'Scene A', hotspot: 'scene-a' } as FpScene,
    b: { rect: { x: 236, y: 84, w: 12, h: 12 }, letter: 'B', title: 'Scene B', hotspot: 'scene-b' } as FpScene,
    /**
     * la fente (Mika : de x 196 a 232 sur y 90) ; proposition : 2.4 de large, bouts ronds ; le capuchon 8 x 12, 7 de haut,
     * au milieu en phase 1 (sa course : son centre de x0 + cap.w / 2 a x1 - cap.w / 2)
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
    /** les legendes sur la touche (proposition) : le numero en haut a gauche (dx, dy : son coin), la voix des pas 1 a 8 en bas au centre (dy : sa ligne) */
    legend: { num: { dx: 3.2, dy: 3.2, cap: 1.2 }, voice: { dy: 15, cap: 1.5 } },
  },
  /** la serigraphie : imprimee, jamais decoupee ; places provisoires (x : le bord d'alignement, cy : le centre) */
  silk: {
    provisional: true,
    wordmark: { x: 8, cy: 79.5, w: 56 },
    model: { text: 'MM-RYTM', x: 114, cy: 79.5, cap: 2.4 },
    firmware: { text: 'FIRMWARE V.3.0 / 2026', x: 235, cy: 79.5, cap: 1.3 },
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

/** La touche a pictogramme i (0 TRK a 11 SOLO). */
export const buttonRect = (i: number): FpRect => ({ x: F.buttons.x0 + F.buttons.pitch * i, y: F.buttons.y, w: F.buttons.size, h: F.buttons.size });
/** Le pas i (0 a 15) : les huit premiers en haut. */
export const stepRect = (i: number): FpRect => ({
  x: F.steps.x0 + F.steps.pitch * (i % F.steps.perRow),
  y: F.steps.rows[Math.floor(i / F.steps.perRow)] ?? F.steps.rows[0],
  w: F.steps.w,
  h: F.steps.h,
});
/** Le potard k (0 a 7) : A B C D en haut, E F G H dessous (2026-10-27 ; la page GLOBAL FX y pose DIST CHORUS DELAY REVERB, STRETCH SWING BIT COMP). */
export const knobCircle = (k: number): FpCircle => ({ cx: F.knobs.cx[k % 4], cy: F.knobs.cy[k >> 2] ?? F.knobs.cy[0], d: F.knobs.d });
/** Le rang (0 a 11) d'une touche a pictogramme par son id. */
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
