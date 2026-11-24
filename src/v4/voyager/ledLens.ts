/**
 * Une LED a lentille dessinee sur une toile, celles du plugin MM-ARP (2026-11-24, Mika : "quand on ne selectionne pas la
 * diode est rouge eteinte.. peut-etre faire quelque chose de transparent et quand on selectionne ca prend la couleur
 * fondamentale choisie") : la bague noire, la lentille bombee et son reflet blanc ;
 * - eteinte : un verre clair et neutre (aucune teinte), sombre, la lumiere qui le traverse en bas a droite : on la voit
 *   sans qu'elle attire l'oeil ;
 * - allumee : la couleur d'accent (lit, #RRGGBB : SETTINGS, ACCENT COLOR), son point chaud presque blanc, son halo.
 * Les memes que les LED d'OPEN (face.css --mm-led-glass, les regles allumees a var(--mm-accent)). Utilisee par la
 * serigraphie de la face (silk.ts, le plugin seul) et l'encart d'EDIT (plugin/arp). Aucune dependance : rien d'autre.
 */

/** Le halo d'une LED allumee : du rayon r0 au rayon r1 (en rayons de la lentille), l'opacite de chaque arret (0..1). */
export interface LedHalo {
  r0: number;
  r1: number;
  stops: readonly (readonly [number, number])[];
}

export interface LedOpts {
  /** le halo (allumee seulement) ; aucun par defaut */
  halo?: LedHalo | null;
  /** le rayon de la bague noire, en rayons de la lentille (1.28 : celle de la face) */
  ring?: number;
  /**
   * le verre eteint, du centre au bord (trois couleurs) : neutre par defaut ; la serigraphie de la face, eclairee par des
   * lumieres chaudes, le prend un rien plus froid pour qu'il sorte neutre a l'ecran
   */
  glass?: readonly [string, string, string];
}

/** Le verre eteint de depart : gris neutre, du centre au bord. */
export const LED_GLASS: readonly [string, string, string] = ['#3a3c40', '#1a1b1d', '#0c0c0d'];

const rgbOf = (hex: string): [number, number, number] => {
  const n = parseInt(hex.slice(1), 16);
  return [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};

/** Une LED de rayon r (px de la toile) en (x, y) ; lit : la couleur allumee (#RRGGBB), null eteinte. */
export function paintLed(g: CanvasRenderingContext2D, x: number, y: number, r: number, lit: string | null, o: LedOpts = {}): void {
  const c = lit && /^#[0-9a-f]{6}$/i.test(lit) ? rgbOf(lit) : null;
  if (c && o.halo) {
    const h = o.halo;
    const hg = g.createRadialGradient(x, y, r * h.r0, x, y, r * h.r1);
    for (const [t, a] of h.stops) hg.addColorStop(t, `rgba(${c[0]}, ${c[1]}, ${c[2]}, ${a})`);
    g.fillStyle = hg;
    g.beginPath();
    g.arc(x, y, r * h.r1, 0, Math.PI * 2);
    g.fill();
  }
  // la bague noire
  g.fillStyle = '#050404';
  g.beginPath();
  g.arc(x, y + r * 0.08, r * (o.ring ?? 1.28), 0, Math.PI * 2);
  g.fill();
  // la lentille
  const lens = g.createRadialGradient(x - r * 0.3, y - r * 0.35, r * 0.05, x, y, r);
  if (c) {
    const k = (m: number): string => `rgb(${c.map((v) => Math.round(Math.min(255, v * m))).join(', ')})`;
    lens.addColorStop(0, `rgb(${c.map((v) => Math.round(255 - (255 - v) * 0.06)).join(', ')})`);
    lens.addColorStop(0.3, k(1.25));
    lens.addColorStop(0.75, k(1));
    lens.addColorStop(1, k(0.62));
  } else {
    const gl = o.glass ?? LED_GLASS;
    lens.addColorStop(0, gl[0]);
    lens.addColorStop(0.6, gl[1]);
    lens.addColorStop(1, gl[2]);
  }
  g.fillStyle = lens;
  g.beginPath();
  g.arc(x, y, r, 0, Math.PI * 2);
  g.fill();
  if (!c) {
    // eteinte : la lumiere qui traverse le verre clair, en bas a droite
    const cs = g.createRadialGradient(x + r * 0.28, y + r * 0.36, 0, x + r * 0.28, y + r * 0.36, r * 0.62);
    cs.addColorStop(0, 'rgba(226, 230, 236, 0.24)');
    cs.addColorStop(1, 'rgba(226, 230, 236, 0)');
    g.fillStyle = cs;
    g.beginPath();
    g.arc(x, y, r, 0, Math.PI * 2);
    g.fill();
  }
  // le reflet blanc
  g.fillStyle = c ? 'rgba(255, 255, 255, 0.75)' : 'rgba(255, 255, 255, 0.55)';
  g.beginPath();
  g.ellipse(x - r * 0.32, y - r * 0.38, r * 0.28, r * 0.17, -0.6, 0, Math.PI * 2);
  g.fill();
}
