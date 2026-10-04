/**
 * Un point de l'ecran du canvas vers un plan projete (2026-10-04, sorti de
 * dj/gestures.ts : le MM-DECKS et le MM-SMPL s'en servent pour leurs ecrans).
 */

/**
 * Homographie du carre unite vers le quadrilatere projete d'un ecran
 * (p0 haut gauche, p1 haut droite, p2 bas droite, p3 bas gauche), et son
 * inverse : un point de l'ecran du canvas -> (u, v) dans l'ecran 3D, exact
 * en perspective (l'ecran est plan).
 */
export function quadToUnit(q: readonly number[], x: number, y: number): { u: number; v: number } | null {
  const [x0, y0, x1, y1, x2, y2, x3, y3] = q;
  const dx1 = x1 - x2;
  const dx2 = x3 - x2;
  const dx3 = x0 - x1 + x2 - x3;
  const dy1 = y1 - y2;
  const dy2 = y3 - y2;
  const dy3 = y0 - y1 + y2 - y3;
  const det = dx1 * dy2 - dx2 * dy1;
  if (Math.abs(det) < 1e-9) return null;
  const g = (dx3 * dy2 - dx2 * dy3) / det;
  const h = (dx1 * dy3 - dx3 * dy1) / det;
  const a = x1 - x0 + g * x1;
  const b = x3 - x0 + h * x3;
  const c = x0;
  const d = y1 - y0 + g * y1;
  const e = y3 - y0 + h * y3;
  const f = y0;
  // Inverse de [[a b c] [d e f] [g h 1]]
  const A = e - f * h;
  const B = c * h - b;
  const C = b * f - c * e;
  const D = f * g - d;
  const E = a - c * g;
  const F = c * d - a * f;
  const G = d * h - e * g;
  const H = b * g - a * h;
  const I = a * e - b * d;
  const w = G * x + H * y + I;
  if (Math.abs(w) < 1e-12) return null;
  return { u: (A * x + B * y + C) / w, v: (D * x + E * y + F) / w };
}

