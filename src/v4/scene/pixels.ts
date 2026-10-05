/**
 * Un ecran a pixels (2026-10-05, Mika : "l'ecran du MM-RYTM dans le design
 * de pixel comme la Digitakt 2, mais bien plus simple") : une image de
 * 160 x 60 points a trois niveaux (eteint, demi, plein), dessinee avec deux
 * polices bitmap faites ici (5 x 7 pour le texte, 3 x 5 pour les petites
 * etiquettes), puis agrandie quatre fois dans le canvas de la texture
 * (640 x 240) : chaque point devient un carre net, sa derniere rangee et sa
 * derniere colonne un peu plus sombres (de pres, la trame d'un OLED).
 */

export const PIX_W = 160;
export const PIX_H = 60;
/** Agrandissement d'un point dans la texture. */
export const PIX_SCALE = 4;

export type Level = 0 | 1 | 2;
export type Font = 'std' | 'mini' | 'big';

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
function glyphs(text: string, font: Record<string, readonly string[]>): (readonly string[])[] {
  const plain = text.normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase();
  return [...plain].map((ch) => font[ch] ?? font['?'] ?? font[' ']);
}

const FONTS = {
  std: { map: STD, w: 5, h: 7, adv: 6, k: 1 },
  mini: { map: MINI, w: 3, h: 5, adv: 4, k: 1 },
  big: { map: STD, w: 5, h: 7, adv: 11, k: 2 },
} as const;

/** La largeur d'un texte (points), sans le jour apres la derniere lettre. */
export function textWidth(text: string, font: Font = 'std'): number {
  const f = FONTS[font];
  const n = [...text].length;
  return n === 0 ? 0 : n * f.adv - (f.adv - f.w * f.k);
}

/** Combien de lettres tiennent dans w points. */
export const fitChars = (w: number, font: Font = 'std'): number => Math.max(0, Math.floor((w + (FONTS[font].adv - FONTS[font].w * FONTS[font].k)) / FONTS[font].adv));

/* ---------------- l'image ---------------- */

export class PixelBuffer {
  readonly px = new Uint8Array(PIX_W * PIX_H);

  clear(): void {
    this.px.fill(0);
  }

  set(x: number, y: number, v: Level): void {
    if (x < 0 || y < 0 || x >= PIX_W || y >= PIX_H) return;
    this.px[y * PIX_W + x] = v;
  }

  rect(x: number, y: number, w: number, h: number, v: Level): void {
    const x0 = Math.max(0, Math.floor(x));
    const y0 = Math.max(0, Math.floor(y));
    const x1 = Math.min(PIX_W, Math.floor(x + w));
    const y1 = Math.min(PIX_H, Math.floor(y + h));
    for (let j = y0; j < y1; j += 1) this.px.fill(v, j * PIX_W + x0, j * PIX_W + x1);
  }

  frame(x: number, y: number, w: number, h: number, v: Level): void {
    this.rect(x, y, w, 1, v);
    this.rect(x, y + h - 1, w, 1, v);
    this.rect(x, y, 1, h, v);
    this.rect(x + w - 1, y, 1, h, v);
  }

  /** Un trait horizontal en pointilles (un point sur deux). */
  dots(x: number, y: number, w: number, v: Level): void {
    for (let i = 0; i < w; i += 2) this.set(x + i, y, v);
  }

  /** Un texte, son coin haut gauche en (x, y) ; v : son niveau (0 : en creux, sur un fond allume). */
  text(text: string, x: number, y: number, v: Level = 2, font: Font = 'std'): number {
    const f = FONTS[font];
    let cx = Math.round(x);
    for (const g of glyphs(text, f.map)) {
      for (let r = 0; r < f.h; r += 1) {
        const row = g[r];
        for (let c = 0; c < f.w; c += 1) {
          if (row.charCodeAt(c) !== 35) continue;
          if (f.k === 1) this.set(cx + c, y + r, v);
          else this.rect(cx + c * f.k, y + r * f.k, f.k, f.k, v);
        }
      }
      cx += f.adv;
    }
    return cx - Math.round(x);
  }

  /** Un texte aligne a droite sur x. */
  textRight(text: string, x: number, y: number, v: Level = 2, font: Font = 'std'): void {
    this.text(text, x - textWidth(text, font), y, v, font);
  }

  /** Un texte en negatif : un pave allume, les lettres en creux (une touche, l'emplacement courant). */
  tag(text: string, x: number, y: number, font: Font = 'std', pad = 1): number {
    const w = textWidth(text, font) + 2 * pad;
    const h = FONTS[font].h * FONTS[font].k + 2 * pad;
    this.rect(x, y - pad, w, h, 2);
    this.text(text, x + pad, y, 0, font);
    return w;
  }

  /**
   * Agrandit l'image dans le canvas : chaque point un carre de PIX_SCALE,
   * sa derniere rangee et sa derniere colonne a 82 % (la trame, de pres).
   */
  blit(ctx: CanvasRenderingContext2D, img: ImageData, off: readonly number[], dim: readonly number[], full: readonly number[]): void {
    const d = img.data;
    const S = PIX_SCALE;
    const W = PIX_W * S;
    const shade = (c: readonly number[], k: number): number[] => [Math.round(c[0] * k), Math.round(c[1] * k), Math.round(c[2] * k)];
    const tones = [off, dim, full];
    const edges = [off, shade(dim, 0.82), shade(full, 0.82)];
    for (let y = 0; y < PIX_H; y += 1) {
      for (let x = 0; x < PIX_W; x += 1) {
        const v = this.px[y * PIX_W + x];
        const c = tones[v];
        const e = edges[v];
        for (let j = 0; j < S; j += 1) {
          let o = ((y * S + j) * W + x * S) * 4;
          for (let i = 0; i < S; i += 1) {
            const t = i === S - 1 || j === S - 1 ? e : c;
            d[o] = t[0];
            d[o + 1] = t[1];
            d[o + 2] = t[2];
            d[o + 3] = 255;
            o += 4;
          }
        }
      }
    }
    ctx.putImageData(img, 0, 0);
  }
}
