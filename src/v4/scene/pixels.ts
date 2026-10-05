/**
 * Un ecran a pixels (2026-10-05, Mika : "l'ecran du MM-RYTM dans le design
 * de pixel comme la Digitakt 2, mais bien plus simple") : une image a trois
 * niveaux (eteint, demi, plein), dessinee avec des polices bitmap faites ici.
 * Plus fine depuis le 2026-10-05 (Mika : "fais les choses plus fines,
 * meilleur graphisme") : la mise en page compte en unites (160 x 60, comme
 * avant), mais l'image a deux points par unite (320 x 120). Les polices
 * gardent leur taille et leur dessin (5 x 7, 3 x 5), tracees d'un trait
 * deux fois plus mince : chaque point de la police devient un noeud, ses
 * voisins sont relies par un trait d'un point (le grand texte : quatre
 * points par noeud, un trait de deux). Les filets et les cadres font un
 * point. Chaque point devient un carre de trois texels (960 x 360), sa
 * derniere rangee et sa derniere colonne un peu plus sombres (de pres, la
 * trame d'un OLED).
 */

/** La mise en page, en unites. */
export const PIX_W = 160;
export const PIX_H = 60;
/** Points par unite. */
export const PIX_K = 2;
/** Agrandissement d'un point dans la texture (texels). */
export const PIX_SCALE = 3;
/** Les coordonnees de texture du reste du site (theme OLED.tex, 640 x 240) : quatre par unite. */
export const PIX_TEX = 4;
/** L'image (points). */
const FW = PIX_W * PIX_K;
const FH = PIX_H * PIX_K;
/** Le canvas de la texture (texels). */
export const PIX_CANVAS: readonly [number, number] = [FW * PIX_SCALE, FH * PIX_SCALE];

export type Level = 0 | 1 | 2;
/** std : le texte ; mini : les etiquettes ; big : la voix, le pattern ; tiny : la police 5 x 7 au point (les legendes). */
export type Font = 'std' | 'mini' | 'big' | 'tiny';

/* ---------------- les polices ---------------- */

/** 5 x 7 : une rangee par chaine, '#' allume. */
const STD: Record<string, readonly string[]> = {
  A: ['.###.', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  B: ['####.', '#...#', '#...#', '####.', '#...#', '#...#', '####.'],
  C: ['.###.', '#...#', '#....', '#....', '#....', '#...#', '.###.'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
  E: ['#####', '#....', '#....', '####.', '#....', '#....', '#####'],
  F: ['#####', '#....', '#....', '####.', '#....', '#....', '#....'],
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.####'],
  H: ['#...#', '#...#', '#...#', '#####', '#...#', '#...#', '#...#'],
  I: ['.###.', '..#..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  J: ['..###', '...#.', '...#.', '...#.', '...#.', '#..#.', '.##..'],
  K: ['#...#', '#..#.', '#.#..', '##...', '#.#..', '#..#.', '#...#'],
  L: ['#....', '#....', '#....', '#....', '#....', '#....', '#####'],
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#..##', '#...#', '#...#'],
  O: ['.###.', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  P: ['####.', '#...#', '#...#', '####.', '#....', '#....', '#....'],
  Q: ['.###.', '#...#', '#...#', '#...#', '#.#.#', '#..#.', '.##.#'],
  R: ['####.', '#...#', '#...#', '####.', '#.#..', '#..#.', '#...#'],
  S: ['.####', '#....', '#....', '.###.', '....#', '....#', '####.'],
  T: ['#####', '..#..', '..#..', '..#..', '..#..', '..#..', '..#..'],
  U: ['#...#', '#...#', '#...#', '#...#', '#...#', '#...#', '.###.'],
  V: ['#...#', '#...#', '#...#', '#...#', '#...#', '.#.#.', '..#..'],
  W: ['#...#', '#...#', '#...#', '#.#.#', '#.#.#', '#.#.#', '.#.#.'],
  X: ['#...#', '#...#', '.#.#.', '..#..', '.#.#.', '#...#', '#...#'],
  Y: ['#...#', '#...#', '.#.#.', '..#..', '..#..', '..#..', '..#..'],
  Z: ['#####', '....#', '...#.', '..#..', '.#...', '#....', '#####'],
  '0': ['.###.', '#...#', '#..##', '#.#.#', '##..#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '2': ['.###.', '#...#', '....#', '...#.', '..#..', '.#...', '#####'],
  '3': ['#####', '...#.', '..#..', '...#.', '....#', '#...#', '.###.'],
  '4': ['...#.', '..##.', '.#.#.', '#..#.', '#####', '...#.', '...#.'],
  '5': ['#####', '#....', '####.', '....#', '....#', '#...#', '.###.'],
  '6': ['..##.', '.#...', '#....', '####.', '#...#', '#...#', '.###.'],
  '7': ['#####', '....#', '...#.', '..#..', '.#...', '.#...', '.#...'],
  '8': ['.###.', '#...#', '#...#', '.###.', '#...#', '#...#', '.###.'],
  '9': ['.###.', '#...#', '#...#', '.####', '....#', '...#.', '.##..'],
  ' ': ['.....', '.....', '.....', '.....', '.....', '.....', '.....'],
  '.': ['.....', '.....', '.....', '.....', '.....', '.##..', '.##..'],
  ',': ['.....', '.....', '.....', '.....', '.##..', '..#..', '.#...'],
  ':': ['.....', '.##..', '.##..', '.....', '.##..', '.##..', '.....'],
  ';': ['.....', '.##..', '.##..', '.....', '.##..', '..#..', '.#...'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  '+': ['.....', '..#..', '..#..', '#####', '..#..', '..#..', '.....'],
  '/': ['.....', '....#', '...#.', '..#..', '.#...', '#....', '.....'],
  '%': ['##...', '##..#', '...#.', '..#..', '.#...', '#..##', '...##'],
  '#': ['.#.#.', '.#.#.', '#####', '.#.#.', '#####', '.#.#.', '.#.#.'],
  '<': ['...#.', '..#..', '.#...', '#....', '.#...', '..#..', '...#.'],
  '>': ['.#...', '..#..', '...#.', '....#', '...#.', '..#..', '.#...'],
  '!': ['..#..', '..#..', '..#..', '..#..', '..#..', '.....', '..#..'],
  '?': ['.###.', '#...#', '....#', '...#.', '..#..', '.....', '..#..'],
  "'": ['..#..', '..#..', '.#...', '.....', '.....', '.....', '.....'],
  '"': ['.#.#.', '.#.#.', '.....', '.....', '.....', '.....', '.....'],
  '(': ['...#.', '..#..', '.#...', '.#...', '.#...', '..#..', '...#.'],
  ')': ['.#...', '..#..', '...#.', '...#.', '...#.', '..#..', '.#...'],
  '[': ['.###.', '.#...', '.#...', '.#...', '.#...', '.#...', '.###.'],
  ']': ['.###.', '...#.', '...#.', '...#.', '...#.', '...#.', '.###.'],
  _: ['.....', '.....', '.....', '.....', '.....', '.....', '#####'],
  '=': ['.....', '.....', '#####', '.....', '#####', '.....', '.....'],
  '*': ['.....', '..#..', '#.#.#', '.###.', '#.#.#', '..#..', '.....'],
  '&': ['.##..', '#..#.', '#.#..', '.#...', '#.#.#', '#..#.', '.##.#'],
  '~': ['.....', '.....', '.#...', '#.#.#', '...#.', '.....', '.....'],
};

/** 3 x 5, pour les etiquettes sous les vumetres. */
const MINI: Record<string, readonly string[]> = {
  A: ['.#.', '#.#', '###', '#.#', '#.#'],
  B: ['##.', '#.#', '##.', '#.#', '##.'],
  C: ['.##', '#..', '#..', '#..', '.##'],
  D: ['##.', '#.#', '#.#', '#.#', '##.'],
  E: ['###', '#..', '##.', '#..', '###'],
  F: ['###', '#..', '##.', '#..', '#..'],
  G: ['.##', '#..', '#.#', '#.#', '.##'],
  H: ['#.#', '#.#', '###', '#.#', '#.#'],
  I: ['###', '.#.', '.#.', '.#.', '###'],
  J: ['..#', '..#', '..#', '#.#', '.#.'],
  K: ['#.#', '#.#', '##.', '#.#', '#.#'],
  L: ['#..', '#..', '#..', '#..', '###'],
  M: ['#.#', '###', '###', '#.#', '#.#'],
  N: ['##.', '#.#', '#.#', '#.#', '#.#'],
  O: ['.#.', '#.#', '#.#', '#.#', '.#.'],
  P: ['##.', '#.#', '##.', '#..', '#..'],
  Q: ['.#.', '#.#', '#.#', '##.', '.##'],
  R: ['##.', '#.#', '##.', '#.#', '#.#'],
  S: ['.##', '#..', '.#.', '..#', '##.'],
  T: ['###', '.#.', '.#.', '.#.', '.#.'],
  U: ['#.#', '#.#', '#.#', '#.#', '###'],
  V: ['#.#', '#.#', '#.#', '#.#', '.#.'],
  W: ['#.#', '#.#', '###', '###', '#.#'],
  X: ['#.#', '#.#', '.#.', '#.#', '#.#'],
  Y: ['#.#', '#.#', '.#.', '.#.', '.#.'],
  Z: ['###', '..#', '.#.', '#..', '###'],
  '0': ['###', '#.#', '#.#', '#.#', '###'],
  '1': ['.#.', '##.', '.#.', '.#.', '###'],
  '2': ['##.', '..#', '.#.', '#..', '###'],
  '3': ['##.', '..#', '.#.', '..#', '##.'],
  '4': ['#.#', '#.#', '###', '..#', '..#'],
  '5': ['###', '#..', '##.', '..#', '##.'],
  '6': ['.##', '#..', '###', '#.#', '###'],
  '7': ['###', '..#', '.#.', '.#.', '.#.'],
  '8': ['###', '#.#', '###', '#.#', '###'],
  '9': ['###', '#.#', '###', '..#', '##.'],
  ' ': ['...', '...', '...', '...', '...'],
  '-': ['...', '...', '###', '...', '...'],
  '>': ['#..', '.#.', '..#', '.#.', '#..'],
  '.': ['...', '...', '...', '...', '.#.'],
  '%': ['#.#', '..#', '.#.', '#..', '#.#'],
};

/** Les accents tombent (E pour E accent aigu) ; une lettre inconnue devient un point d'interrogation. */
function sourceGlyph(ch: string, font: Record<string, readonly string[]>): readonly string[] {
  return font[ch] ?? font['?'] ?? font[' '];
}

const plainText = (text: string): string => text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();

/**
 * Le trait mince : chaque point allume de la police devient un noeud tous
 * les k points, ses voisins (cote a cote, l'un sur l'autre, en diagonale
 * quand rien ne fait deja le coin) sont relies par un trait de s points.
 */
function thin(src: readonly string[], k: number, s: number): Uint8Array[] {
  const h = src.length;
  const w = src[0].length;
  const W = (w - 1) * k + s;
  const H = (h - 1) * k + s;
  const out = Array.from({ length: H }, () => new Uint8Array(W));
  const on = (c: number, r: number): boolean => r >= 0 && r < h && c >= 0 && c < w && src[r].charCodeAt(c) === 35;
  const dot = (x: number, y: number): void => {
    for (let j = 0; j < s; j += 1) for (let i = 0; i < s; i += 1) if (y + j < H && x + i < W && x + i >= 0) out[y + j][x + i] = 1;
  };
  for (let r = 0; r < h; r += 1) {
    for (let c = 0; c < w; c += 1) {
      if (!on(c, r)) continue;
      const x = c * k;
      const y = r * k;
      dot(x, y);
      for (let t = 1; t < k; t += 1) {
        if (on(c + 1, r)) dot(x + t, y);
        if (on(c, r + 1)) dot(x, y + t);
        if (on(c + 1, r + 1) && !on(c + 1, r) && !on(c, r + 1)) dot(x + t, y + t);
        if (on(c - 1, r + 1) && !on(c - 1, r) && !on(c, r + 1)) dot(x - t, y + t);
      }
    }
  }
  return out;
}

/**
 * Les petites lettres que le trait mince ne sait pas tirer de leurs 3 x 5
 * (M, N, W, S : il leur faut une diagonale) : dessinees directement en
 * 5 x 9 points.
 */
const MINI_FINE: Record<string, readonly string[]> = {
  M: ['#...#', '##.##', '#.#.#', '#.#.#', '#...#', '#...#', '#...#', '#...#', '#...#'],
  N: ['#...#', '#...#', '##..#', '#.#.#', '#.#.#', '#.#.#', '#..##', '#...#', '#...#'],
  W: ['#...#', '#...#', '#...#', '#...#', '#...#', '#.#.#', '#.#.#', '##.##', '#...#'],
  S: ['.###.', '#...#', '#....', '.#...', '..#..', '...#.', '....#', '#...#', '.###.'],
};

/** Au point (la police telle quelle). */
const raw = (src: readonly string[]): Uint8Array[] => src.map((row) => Uint8Array.from(row, (ch) => (ch === '#' ? 1 : 0)));

interface FontDef {
  map: Record<string, readonly string[]>;
  make: (src: readonly string[]) => Uint8Array[];
  /** largeur et hauteur d'une lettre, avance (points) */
  w: number;
  h: number;
  adv: number;
}

const FONTS: Record<Font, FontDef> = {
  std: { map: STD, make: (g) => thin(g, 2, 1), w: 9, h: 13, adv: 12 },
  mini: { map: MINI, make: (g) => thin(g, 2, 1), w: 5, h: 9, adv: 8 },
  big: { map: STD, make: (g) => thin(g, 4, 2), w: 18, h: 26, adv: 22 },
  tiny: { map: STD, make: raw, w: 5, h: 7, adv: 6 },
};

const cache = new Map<string, Uint8Array[]>();
function bitmap(font: Font, ch: string): Uint8Array[] {
  const key = `${font}:${ch}`;
  let b = cache.get(key);
  if (!b) {
    const fine = font === 'mini' ? MINI_FINE[ch] : undefined;
    b = fine ? raw(fine) : FONTS[font].make(sourceGlyph(ch, FONTS[font].map));
    cache.set(key, b);
  }
  return b;
}

/** La hauteur d'une police (unites). */
export const fontHeight = (font: Font = 'std'): number => FONTS[font].h / PIX_K;

/** La largeur d'un texte (unites), sans le jour apres la derniere lettre. */
export function textWidth(text: string, font: Font = 'std'): number {
  const f = FONTS[font];
  const n = [...text].length;
  return n === 0 ? 0 : (n * f.adv - (f.adv - f.w)) / PIX_K;
}

/** Combien de lettres tiennent dans w unites. */
export const fitChars = (w: number, font: Font = 'std'): number => Math.max(0, Math.floor((w * PIX_K + (FONTS[font].adv - FONTS[font].w)) / FONTS[font].adv));

/* ---------------- l'image ---------------- */

/** Une coordonnee en unites, au point le plus proche. */
const P = (u: number): number => Math.round(u * PIX_K);

export class PixelBuffer {
  readonly px = new Uint8Array(FW * FH);

  clear(): void {
    this.px.fill(0);
  }

  /** Un point (coordonnees en points). */
  dot(x: number, y: number, v: Level): void {
    if (x < 0 || y < 0 || x >= FW || y >= FH) return;
    this.px[y * FW + x] = v;
  }

  /** Un pave en points. */
  private fill(x0: number, y0: number, x1: number, y1: number, v: Level): void {
    const a = Math.max(0, x0);
    const b = Math.min(FW, x1);
    if (b <= a) return;
    for (let j = Math.max(0, y0); j < Math.min(FH, y1); j += 1) this.px.fill(v, j * FW + a, j * FW + b);
  }

  /** Un pave (unites, les demi-unites tombent sur un point). */
  rect(x: number, y: number, w: number, h: number, v: Level): void {
    this.fill(P(x), P(y), P(x + w), P(y + h), v);
  }

  /** Un cadre d'un point (unites). */
  frame(x: number, y: number, w: number, h: number, v: Level): void {
    const x0 = P(x);
    const y0 = P(y);
    const x1 = P(x + w);
    const y1 = P(y + h);
    this.fill(x0, y0, x1, y0 + 1, v);
    this.fill(x0, y1 - 1, x1, y1, v);
    this.fill(x0, y0, x0 + 1, y1, v);
    this.fill(x1 - 1, y0, x1, y1, v);
  }

  /** Un filet d'un point (unites). */
  hline(x: number, y: number, w: number, v: Level): void {
    const y0 = P(y);
    this.fill(P(x), y0, P(x + w), y0 + 1, v);
  }

  /** Un trait horizontal en pointilles : un point sur trois. */
  dots(x: number, y: number, w: number, v: Level): void {
    const y0 = P(y);
    for (let i = P(x); i < P(x + w); i += 3) this.dot(i, y0, v);
  }

  /** Un trait vertical en pointilles : un point sur trois. */
  vdots(x: number, y: number, h: number, v: Level): void {
    const x0 = P(x);
    for (let j = P(y); j < P(y + h); j += 3) this.dot(x0, j, v);
  }

  /** Un triangle plein vers la droite (lecture) : h unites de haut. */
  play(x: number, y: number, h: number, v: Level): void {
    const x0 = P(x);
    const y0 = P(y);
    const H = P(h);
    for (let j = 0; j < H; j += 1) {
      const d = Math.min(j, H - 1 - j);
      this.fill(x0, y0 + j, x0 + 1 + Math.round(d * 1.1), y0 + j + 1, v);
    }
  }

  /** Un texte, son coin haut gauche en (x, y) unites ; v : son niveau (0 : en creux, sur un fond allume). Rend sa largeur (unites). */
  text(text: string, x: number, y: number, v: Level = 2, font: Font = 'std'): number {
    const f = FONTS[font];
    const x0 = P(x);
    const y0 = P(y);
    let cx = x0;
    for (const ch of plainText(text)) {
      const g = bitmap(font, ch);
      for (let r = 0; r < g.length; r += 1) {
        const row = g[r];
        for (let c = 0; c < row.length; c += 1) if (row[c]) this.dot(cx + c, y0 + r, v);
      }
      cx += f.adv;
    }
    return (cx - x0) / PIX_K;
  }

  /** Un texte aligne a droite sur x. */
  textRight(text: string, x: number, y: number, v: Level = 2, font: Font = 'std'): void {
    this.text(text, x - textWidth(text, font), y, v, font);
  }

  /** Un texte en negatif : un pave allume, les lettres en creux (une touche, l'emplacement courant). Rend sa largeur. */
  tag(text: string, x: number, y: number, font: Font = 'std', pad = 1): number {
    const w = textWidth(text, font) + 2 * pad;
    const h = fontHeight(font) + 2 * pad;
    this.rect(x, y - pad, w, h, 2);
    this.text(text, x + pad, y, 0, font);
    return w;
  }

  /** Le petit canvas des points (un pixel par point) et la trame de l'OLED, faits une fois. */
  private small: { canvas: HTMLCanvasElement; ctx: CanvasRenderingContext2D; img: ImageData } | null = null;
  private grid: CanvasPattern | null = null;

  /**
   * Agrandit l'image dans le canvas : les points dans un petit canvas (un
   * pixel chacun), agrandis PIX_SCALE fois sans lissage par le navigateur,
   * puis la trame (la derniere rangee et la derniere colonne de chaque
   * point a 86 %) posee en une passe ; avant, chaque texel etait ecrit en
   * JavaScript (345 600 par image), ce qui chargeait le fil principal.
   */
  blit(ctx: CanvasRenderingContext2D, off: readonly number[], dim: readonly number[], full: readonly number[]): void {
    const S = PIX_SCALE;
    if (!this.small) {
      const canvas = document.createElement('canvas');
      canvas.width = FW;
      canvas.height = FH;
      const c = canvas.getContext('2d');
      if (!c) return;
      this.small = { canvas, ctx: c, img: c.createImageData(FW, FH) };
      // La trame : un carre de S texels, blanc, sa derniere rangee et sa derniere colonne a 86 %
      const tile = document.createElement('canvas');
      tile.width = S;
      tile.height = S;
      const t = tile.getContext('2d');
      if (t) {
        t.fillStyle = 'rgb(219, 219, 219)';
        t.fillRect(0, 0, S, S);
        t.fillStyle = '#ffffff';
        t.fillRect(0, 0, S - 1, S - 1);
        this.grid = ctx.createPattern(tile, 'repeat');
      }
    }
    const sm = this.small;
    const d = sm.img.data;
    const tones = [off, dim, full];
    for (let i = 0, o = 0; i < this.px.length; i += 1, o += 4) {
      const c = tones[this.px[i]];
      d[o] = c[0];
      d[o + 1] = c[1];
      d[o + 2] = c[2];
      d[o + 3] = 255;
    }
    sm.ctx.putImageData(sm.img, 0, 0);
    ctx.imageSmoothingEnabled = false;
    ctx.globalCompositeOperation = 'copy';
    ctx.drawImage(sm.canvas, 0, 0, FW * S, FH * S);
    if (this.grid) {
      ctx.globalCompositeOperation = 'multiply';
      ctx.fillStyle = this.grid;
      ctx.fillRect(0, 0, FW * S, FH * S);
    }
    ctx.globalCompositeOperation = 'source-over';
  }
}
