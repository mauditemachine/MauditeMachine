/**
 * L'ecran du MM-BASS (2026-10-07), dans le langage du nouvel ecran du
 * MM-RYTM (facon OP-1, Mika : "je ne veux pas de couleurs") : noir et os en
 * trois intensites, des formes nettes, peu de mots.
 *
 * La machine Elektron (2026-10-08, Mika : "les valeurs des knobs sont a
 * l'ecran, pas sur les encodeurs, de 0 a 127 ; on voit a l'ecran que quand
 * le sequenceur passe sur ce step alors le changement est fait ; fais
 * evoluer l'ecran parce que je pense que c'est la cle") : deux fois plus
 * grand, et sa vue PAGE toujours la (jamais un coup d'oeil minute) :
 * - l'en-tete : la lecture (triangle, carre), LOCK 05 en negatif quand un
 *   pas est verrouille, les quatre onglets (la page en negatif, un point sur
 *   celles qui portent des verrous), a droite le style, le pattern, le
 *   tempo et la touche "i" (INFOS, pleine quand le mode est allume) ;
 * - les huit blocs, dans l'ordre des encodeurs (A B C D, E F G H) : le nom,
 *   la lettre, le nombre de 0 a 127 (ou le nom du cran), l'unite, un petit
 *   dessin qui suit la valeur ; en negatif un verrou (LOCK) ou le verrou du
 *   pas qui joue (lecture), attenue ce qui n'est pas verrouille, GLOBAL ce
 *   qui ne se verrouille pas, cerne le bloc qu'on vient de tourner ;
 * - la bande des seize pas : le contour de la ligne, la tete de lecture, un
 *   point au-dessus de chaque pas verrouille (plein : sur cette page), le pas
 *   en LOCK en negatif ;
 * - la ligne du bas : le message du moment, en LOCK les gestes
 *   (TURN A KNOB: STEP 05 ONLY  2X: UNLOCK  CLEAR: ALL).
 * EDIT (le meme jour, "ne fais juste que voir les patterns et les
 * changements") : le rouleau de la ligne, les pistes des verrous de la page,
 * les seize patterns (bass/pageView.ts). PRESETS comme le MM-RYTM. L'echo
 * d'un reglage qui n'est pas sur la page a l'ecran (STYLE, DENSITY, une
 * regle du generateur, un potard de la plaque ou une cible MIDI d'une autre
 * page) : son nom, sa valeur et son dessin des INFOS, un instant.
 * Une texture sur le verre, redessinee seulement quand ce qu'elle montre
 * change (un pas de la lecture, un reglage) : elle part au GPU a chaque fois.
 *
 * Au telephone, l'ecran sans encodeurs (2026-10-09, Mika : "on change dans
 * l'ecran directement ; forcement donne-moi un ecran plus grand") : 7.6 x
 * 6.4 au lieu de 7.6 x 4.05, tout plus grand pour l'oeil et le doigt ; ses
 * blocs, plus hauts que larges, posent tout l'un sous l'autre (le nom et la
 * lettre, le nombre en grand, le dessin sur toute la largeur, l'unite) ; un
 * bloc tenu par un doigt est cerne d'un trait plein (held), on voit ce
 * qu'on regle avant meme que la valeur bouge (desktop : son encodeur tenu).
 */

import { Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { makeCanvasTexture } from '../scene/silk';
import { DJ_BEZEL } from '../dj/theme';
import { FONT_DISPLAY, HEX, PORTRAIT } from '../theme';
import type { PresetView } from '../state/presetMode';
import { bassDiagram, type BassDiagram } from './diagrams';
import { BASS_INFOS } from './infos';
import { bassBig, bassKnob, bassValueText, type BassKnobId, type BassValues } from './params';
import type { BassBlock, BassEditModel, BassPageModel } from './pageView';
import { BASS_STEPS, type BassStep } from './state';
import { BASS } from './theme';

const INK: string = HEX.bone;
const HALF: string = 'rgba(246, 241, 231, 0.5)';
const DIM: string = 'rgba(246, 241, 231, 0.3)';
const FAINT: string = 'rgba(246, 241, 231, 0.16)';
const GHOST: string = 'rgba(246, 241, 231, 0.07)';
const BLACK: string = '#050506';

const font = (weight: number, size: number): string => `${weight} ${size}px ${FONT_DISPLAY}`;
const two = (i: number): string => String(i + 1).padStart(2, '0');
const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'] as const;

/** Les roles d'un dessin des INFOS a l'ecran (en unites de l'ecran) : tout en os, la hierarchie par l'epaisseur et l'intensite. */
const DIAGRAM_INK: Readonly<Record<BassDiagram['paths'][number]['role'], { stroke: string; fill: string; lw: number }>> = {
  main: { stroke: INK, fill: HALF, lw: 1.1 },
  hot: { stroke: INK, fill: INK, lw: 1.8 },
  ghost: { stroke: HALF, fill: FAINT, lw: 0.8 },
  grid: { stroke: FAINT, fill: FAINT, lw: 0.7 },
  dash: { stroke: HALF, fill: HALF, lw: 0.9 },
};

/** Les regles du generateur : on les entend au prochain GEN (l'echo le dit). */
const GEN_RULES: ReadonlySet<BassKnobId> = new Set<BassKnobId>(['style', 'density', 'slides', 'accents', 'range']);

/**
 * La mise en page, en unites de l'ecran : desktop 300 de large (5.5 x 3.5,
 * 191 de haut) ; au telephone 230 (7.6 x 6.4 : 194 de haut depuis le
 * 2026-10-09, la place des encodeurs ; une unite y vaut 1.3 px CSS, 1.6 au
 * desktop), tout plus gros pour le doigt et l'oeil : le nombre d'un bloc a
 * 25 (19 avant, 14.5), son nom a 7.4, l'unite a 6.2, la bande des pas a 16.
 */
const LAY = PORTRAIT
  ? { UW: 230, pad: 6, hy: 15.5, tab: 6.9, small: 6.3, bpm: 10.2, i: 5.6, by0: 23.5, gap: 3, label: 7.4, letter: 5.4, big: 25, unit: 6.2, stripH: 16, line: 6.6, lanes: 3 }
  : { UW: 300, pad: 10, hy: 15, tab: 7.4, small: 6.6, bpm: 11, i: 5.4, by0: 23, gap: 4, label: 7, letter: 5.4, big: 23, unit: 6.1, stripH: 19, line: 7, lanes: 4 };
/** La ligne du bas : sa ligne de base depuis le bas du verre. */
const LINE_DY = PORTRAIT ? 4.4 : 6.5;

/** Le potard echo : son id, sa valeur, verrouille ou non, la ligne qui suit en direct. */
export interface BassKnobEcho {
  id: BassKnobId;
  v: number;
  locked: boolean;
  live?: boolean;
  lock: number;
}

/** Ce que l'ecran dessine (la priorite est au rig : PRESETS, EDIT, l'echo hors page, la PAGE). */
export type BassScreenView =
  | { view: 'page'; m: BassPageModel }
  | { view: 'edit'; m: BassEditModel }
  | { view: 'presets'; p: PresetView }
  | { view: 'knob'; k: BassKnobEcho; running: boolean; bpm: number; values: BassValues; steps: readonly BassStep[]; infos: boolean };

export class BassScreen {
  readonly mesh: Mesh;
  readonly texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private UW = LAY.UW;
  private UH: number;
  private scale: number;
  private key = '';
  draws = 0;

  constructor(anisotropy: number, mobile: boolean) {
    const S = BASS.screen;
    const W = mobile ? 1024 : 1280;
    const H = Math.round((W * S.d) / S.w);
    this.scale = W / this.UW;
    this.UH = H / this.scale;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('bass: no 2d context');
    this.ctx = ctx;
    this.texture = makeCanvasTexture(this.canvas, anisotropy);
    const g = new PlaneGeometry(S.w, S.d);
    g.rotateX(-Math.PI / 2);
    const mat = new MeshBasicMaterial({ map: this.texture, toneMapped: false });
    mat.name = 'bassScreen';
    this.mesh = new Mesh(g, mat);
    this.mesh.name = 'bassScreen';
    this.mesh.position.set(S.x, DJ_BEZEL.h + 0.003, S.z);
  }

  invalidate(): void {
    this.key = '';
  }

  /** La touche "i" (2026-10-08) : sa place sur le verre, de 0 a 1 (u vers la droite, v vers le bas), un peu plus large que son dessin. */
  iRect(): { u0: number; u1: number; v0: number; v1: number } {
    const c = this.iCenter();
    // Au telephone plus large (2026-10-09 : 40 px sous le doigt), sans descendre sur les blocs
    const r = LAY.i + (PORTRAIT ? 10 : 6);
    const v1 = (c.y + r) / this.UH;
    return { u0: (c.x - r) / this.UW, u1: Math.min(1, (c.x + r) / this.UW), v0: Math.max(0, (c.y - r) / this.UH), v1: PORTRAIT ? Math.min(v1, (LAY.by0 - LAY.gap / 2) / this.UH) : v1 };
  }

  private iCenter(): { x: number; y: number } {
    return { x: this.UW - LAY.pad - LAY.i, y: LAY.hy - LAY.i * 0.72 };
  }

  /** La PAGE : la boite du bloc k (unites de l'ecran), dans l'ordre des encodeurs. */
  private blockBox(k: number): { x: number; y: number; w: number; h: number } {
    const P = LAY.pad;
    const by0 = LAY.by0;
    const by1 = this.UH - LAY.line * 2.2 - LAY.stripH - (PORTRAIT ? 4 : 8);
    const gap = LAY.gap;
    const bw = (this.UW - 2 * P - 3 * gap) / 4;
    const bh = (by1 - by0 - gap) / 2;
    return { x: P + (k % 4) * (bw + gap), y: by0 + (k < 4 ? 0 : bh + gap), w: bw, h: bh };
  }

  /**
   * Les zones du verre (2026-10-08, la revue : toucher n'importe ou ouvrait les presets), de 0 a 1 : chaque bloc
   * repond comme son encodeur (le glisser le tourne, INFOS montre son reglage), jusqu'au milieu du jour entre deux
   * blocs ; l'en-tete ouvre les presets ; dessous (la bande des pas, la ligne du bas) le verre ne fait rien.
   */
  blockRect(k: number): { u0: number; u1: number; v0: number; v1: number } {
    const b = this.blockBox(k);
    const g = LAY.gap / 2;
    return { u0: (b.x - g) / this.UW, u1: (b.x + b.w + g) / this.UW, v0: (b.y - g) / this.UH, v1: (b.y + b.h + g) / this.UH };
  }

  headRect(): { u0: number; u1: number; v0: number; v1: number } {
    return { u0: 0, u1: this.iRect().u0, v0: 0, v1: (LAY.by0 - LAY.gap / 2) / this.UH };
  }

  /** Le verre sous les blocs (la bande des pas, la ligne du bas). */
  lowRect(): { u0: number; u1: number; v0: number; v1: number } {
    return { u0: 0, u1: 1, v0: this.blockRect(4).v1, v1: 1 };
  }

  /** Redessine si ce qu'il montre a change ; true si redessine. */
  draw(sv: BassScreenView): boolean {
    const key = JSON.stringify(sv);
    if (key === this.key) return false;
    this.key = key;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = BLACK;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (sv.view === 'presets') this.drawPresets(sv.p);
    else if (sv.view === 'edit') this.drawEdit(sv.m);
    else if (sv.view === 'knob') this.drawKnob(sv);
    else this.drawPage(sv.m);
    this.texture.needsUpdate = true;
    this.draws += 1;
    return true;
  }

  /* ---------------- les briques ---------------- */

  private text(s: string, x: number, y: number, size: number, color = INK, weight = 500, align: CanvasTextAlign = 'left'): number {
    const c = this.ctx;
    c.font = font(weight, size);
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = 'alphabetic';
    c.fillText(s, x, y);
    return c.measureText(s).width;
  }

  private measure(s: string, size: number, weight = 500): number {
    this.ctx.font = font(weight, size);
    return this.ctx.measureText(s).width;
  }

  private circle(x: number, y: number, r: number, fill: string | null, stroke: string | null = null, lw = 1.2): void {
    const c = this.ctx;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  }

  private bar(x: number, y: number, w: number, h: number, fill: string | null, stroke: string | null = null): void {
    const c = this.ctx;
    const r = Math.min(h / 2, w / 2);
    if (w <= 0 || h <= 0) return;
    c.beginPath();
    c.moveTo(x + r, y);
    c.lineTo(x + w - r, y);
    c.arc(x + w - r, y + r, r, -Math.PI / 2, Math.PI / 2);
    c.lineTo(x + r, y + h);
    c.arc(x + r, y + r, r, Math.PI / 2, (3 * Math.PI) / 2);
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = 1.2;
      c.stroke();
    }
  }

  /** Un rectangle a coins arrondis (les blocs, les emplacements). */
  private box(x: number, y: number, w: number, h: number, fill: string | null, stroke: string | null, lw = 1, rad = 3): void {
    const c = this.ctx;
    const r = Math.min(rad, w / 4, h / 4);
    c.beginPath();
    c.moveTo(x + r, y);
    c.arcTo(x + w, y, x + w, y + h, r);
    c.arcTo(x + w, y + h, x, y + h, r);
    c.arcTo(x, y + h, x, y, r);
    c.arcTo(x, y, x + w, y, r);
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  }

  /** Une pastille : pleine (le texte en noir) ou cernee ; rend sa largeur. */
  private pill(text: string, x: number, y: number, size: number, full: boolean, align: 'left' | 'center' | 'right' = 'left', ink = INK): number {
    const c = this.ctx;
    c.font = font(700, size);
    const tw = c.measureText(text).width;
    const w = tw + size * 1.3;
    const h = size * 1.5;
    const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    this.bar(x0, y - h + size * 0.36, w, h, full ? ink : null, full ? null : ink);
    this.text(text, x0 + w / 2, y, size, full ? BLACK : ink, 700, 'center');
    return w;
  }

  private stroke(pts: readonly (readonly [number, number])[], color: string, lw: number, dash: readonly number[] = []): void {
    if (pts.length < 2) return;
    const c = this.ctx;
    c.strokeStyle = color;
    c.lineWidth = lw;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.setLineDash(dash as number[]);
    c.beginPath();
    pts.forEach(([x, y], i) => (i ? c.lineTo(x, y) : c.moveTo(x, y)));
    c.stroke();
    c.setLineDash([]);
  }

  /**
   * Une ligne du bas (2026-10-08, la revue : les doubles espaces se fondaient, les trois consignes du LOCK se
   * lisaient d'un bloc) : les morceaux separes par deux espaces, un vrai jour et un point entre eux ; rend sa largeur.
   */
  private lineText(s: string, x: number, y: number, size: number, color: string, weight = 600, draw = true): number {
    const parts = s.split(/ {2,}/).filter((t) => t.length > 0);
    const gap = size * 1.5;
    let w = 0;
    parts.forEach((t, i) => {
      if (i > 0) {
        if (draw) this.circle(x + w + gap / 2, y - size * 0.34, Math.max(0.45, size * 0.1), color === INK ? HALF : FAINT);
        w += gap;
      }
      w += draw ? this.text(t, x + w, y, size, color, weight) : this.measure(t, size, weight);
    });
    return w;
  }

  /** La plus grande taille (jusqu'a size) ou la ligne du bas tient dans maxW. */
  private fitLine(s: string, size: number, maxW: number, min = 4): number {
    let z = size;
    while (z > min && this.lineText(s, 0, 0, z, INK, 600, false) > maxW) z -= 0.25;
    return z;
  }

  /** La plus grande taille (jusqu'a size) ou le texte tient dans maxW. */
  private fit(s: string, weight: number, size: number, maxW: number, min = 5): number {
    const c = this.ctx;
    let z = size;
    c.font = font(weight, z);
    while (z > min && c.measureText(s).width > maxW) {
      z -= 0.5;
      c.font = font(weight, z);
    }
    return z;
  }

  /** La lecture : un triangle, un carre a l'arret. */
  private transport(running: boolean, x: number, hy: number, s: number): void {
    const c = this.ctx;
    c.fillStyle = INK;
    if (running) {
      c.beginPath();
      c.moveTo(x, hy - s);
      c.lineTo(x + s * 0.88, hy - s / 2);
      c.lineTo(x, hy);
      c.closePath();
      c.fill();
    } else c.fillRect(x, hy - s * 0.92, s * 0.86, s * 0.86);
  }

  /** La touche "i" (2026-10-08) : un i cercle, plein quand INFOS est allume. */
  private iKey(on: boolean): void {
    const { x, y } = this.iCenter();
    const r = LAY.i;
    this.circle(x, y, r, on ? INK : null, on ? null : HALF, 0.9);
    const ink = on ? BLACK : INK;
    this.circle(x, y - r * 0.45, r * 0.16, ink);
    this.ctx.fillStyle = ink;
    this.ctx.fillRect(x - r * 0.12, y - r * 0.18, r * 0.24, r * 0.72);
  }

  /** Le tempo, a gauche de la touche "i" ; rend la place prise depuis la droite. */
  private tempo(bpm: number): number {
    const right = this.UW - LAY.pad - LAY.i * 2 - (PORTRAIT ? 5 : 7);
    const bw = this.text('BPM', right, LAY.hy, LAY.small * 0.82, HALF, 600, 'right');
    const nw = this.text(String(Math.round(bpm)), right - bw - 2.5, LAY.hy, LAY.bpm, INK, 400, 'right');
    return this.UW - right + bw + nw + 2.5;
  }

  /* ---------------- la PAGE ---------------- */

  private drawPage(m: BassPageModel): void {
    const UW = this.UW;
    const UH = this.UH;
    const P = LAY.pad;
    const hy = LAY.hy;
    // L'en-tete : la lecture, LOCK 05, les onglets ; a droite le style, le pattern (il ouvre les presets), le tempo, "i".
    // En LOCK (2026-10-08, la revue : au telephone le pas et ses verrous, minuscules, mordaient sur l'onglet FX) : le
    // tempo laisse sa place a la note du pas et a son compte de verrous, toujours a la taille du reste, apres un jour
    this.transport(m.running, P, hy, LAY.tab * 1.05);
    let x = P + LAY.tab + 4;
    if (m.lock) x += this.pill(`LOCK ${two(m.lock.step)}`, x, hy, LAY.tab, true) + (PORTRAIT ? 4 : 6);
    for (const p of m.pages) {
      const on = p.id === m.page;
      if (on) x += this.pill(p.label, x, hy, LAY.tab, true) + 2;
      else {
        const w = this.text(p.label, x + LAY.tab * 0.65, hy, LAY.tab, HALF, 700);
        x += w + LAY.tab * 1.3 + 2;
      }
      // Un point : cette page porte des verrous dans la ligne
      if (p.locks > 0) this.circle(x - 1.5, hy - LAY.tab * 1.02, PORTRAIT ? 0.95 : 1.15, on ? INK : HALF);
    }
    const iLeft = UW - P - LAY.i * 2 - (PORTRAIT ? 5 : 7);
    const left = x + (PORTRAIT ? 5 : 8);
    if (m.lock) {
      const n = m.lock.n;
      const count = n ? `${n} LOCK${n > 1 ? 'S' : ''}` : 'NO LOCK';
      const note = m.lock.what.split(' ')[0];
      // Du plus detaille au plus court : la note, ACC et SLD, puis la note seule, puis le compte seul
      const tries = [`${m.lock.what}  ${count}`, `${note}  ${count}`, count];
      const avail = iLeft - left;
      const min = LAY.small * 0.85;
      const pick = tries.find((t) => this.lineText(t, 0, 0, min, INK, 600, false) <= avail);
      if (pick) {
        const sz = this.fitLine(pick, LAY.small, avail, min);
        this.lineText(pick, iLeft - this.lineText(pick, 0, 0, sz, INK, 600, false), hy, sz, INK, 600);
      }
    } else {
      const used = this.tempo(m.bpm);
      const right = UW - used - (PORTRAIT ? 5 : 8);
      // Le pattern et un petit triangle : toucher l'en-tete ouvre les presets
      const tri = LAY.small * 0.5;
      const status = PORTRAIT ? m.pattern : `${m.style}  ${m.pattern}`;
      const avail = right - left - tri * 2.2;
      if (avail > 12) {
        const sz = this.fitLine(status, LAY.small, avail, 4);
        const tx = right - tri * 2.2;
        this.lineText(status, tx - this.lineText(status, 0, 0, sz, HALF, 600, false), hy, sz, HALF, 600);
        const c = this.ctx;
        c.fillStyle = HALF;
        c.beginPath();
        c.moveTo(tx + tri * 0.6, hy - sz * 0.62);
        c.lineTo(tx + tri * 1.8, hy - sz * 0.62);
        c.lineTo(tx + tri * 1.2, hy - sz * 0.62 + tri);
        c.closePath();
        c.fill();
      }
    }
    this.iKey(m.infos);

    // Les huit blocs
    const stripH = LAY.stripH;
    const by1 = UH - LAY.line * 2.2 - stripH - (PORTRAIT ? 4 : 8);
    for (const b of m.blocks) {
      const bb = this.blockBox(b.k);
      this.block(b, bb.x, bb.y, bb.w, bb.h, m.env);
    }

    // La bande des seize pas
    this.strip(m, P, by1 + (PORTRAIT ? 3 : 6), UW - 2 * P, stripH);

    // La ligne du bas ; a droite, le geste du LOCK (2026-10-08, la revue : au telephone c'est le seul texte lisible),
    // tant qu'il tient a cote du message
    const ly = UH - LINE_DY;
    const as = LAY.line * 0.86;
    const asideW = m.aside ? this.measure(m.aside, as, 700) + LAY.line * 2 : 0;
    const lineW = this.lineText(m.line, 0, 0, LAY.line, INK, 600, false);
    const aside = m.aside && lineW + asideW <= UW - 2 * P ? m.aside : '';
    const ls = this.fitLine(m.line, LAY.line, UW - 2 * P - (aside ? asideW : 0), 4);
    this.lineText(m.line, P, ly, ls, m.lineHot ? INK : HALF, 600);
    if (aside) this.text(aside, UW - P, ly, as, HALF, 700, 'right');
  }

  /**
   * Un bloc tenu par un pointeur (2026-10-09) : un trait plein autour, un peu au-dehors (il se voit aussi sur un bloc
   * en negatif), ses coins marques comme un viseur.
   */
  private heldRing(x: number, y: number, w: number, h: number): void {
    const o = PORTRAIT ? 1.3 : 1.6;
    this.box(x - o, y - o, w + 2 * o, h + 2 * o, null, INK, PORTRAIT ? 1.2 : 1.4, 4);
  }

  /** Un bloc : le nom et la lettre, le nombre, l'unite, son dessin. */
  private block(b: BassBlock, x: number, y: number, w: number, h: number, env: BassPageModel['env']): void {
    if (b.state === 'empty' || !b.id) {
      // Rien de dessine : la place de l'encodeur, a peine
      this.box(x, y, w, h, null, GHOST, 0.6);
      return;
    }
    if (PORTRAIT) {
      this.blockTall(b, x, y, w, h, env);
      if (b.held) this.heldRing(x, y, w, h);
      return;
    }
    const inv = b.state === 'lockOn' || b.state === 'flash';
    const dim = b.state === 'lockOff' || b.state === 'global';
    if (inv) this.box(x, y, w, h, INK, null);
    else this.box(x, y, w, h, b.state === 'global' ? null : b.held ? 'rgba(246, 241, 231, 0.08)' : 'rgba(246, 241, 231, 0.035)', b.echo ? INK : dim ? FAINT : DIM, b.echo ? 1.5 : 0.8);
    if (b.held) this.heldRing(x, y, w, h);
    const ink = inv ? BLACK : dim ? HALF : INK;
    const soft = inv ? 'rgba(5, 5, 6, 0.55)' : dim ? FAINT : HALF;
    const p = PORTRAIT ? 3.2 : 5;
    const ly = y + LAY.label + (PORTRAIT ? 1.6 : 3);
    const ls = this.fit(b.label, 700, LAY.label, w - p * 2 - LAY.letter - 3, 4);
    this.text(b.label, x + p, ly, ls, ink, 700);
    this.text(b.letter, x + w - p, ly, LAY.letter, soft, 700, 'right');
    // Le nombre (ou le nom du cran) a gauche, le dessin a droite
    const named = !/^[+-]?\d+$/.test(b.big);
    const bigMax = named ? w - p * 2 : w * 0.5;
    const bs = this.fit(b.big, named ? 500 : 300, named ? LAY.big * 0.62 : LAY.big, bigMax, 6);
    const bigY = PORTRAIT ? y + h * 0.69 : y + h * 0.63;
    this.text(b.big, x + p - (named ? 0 : 0.6), bigY, bs, ink, named ? 600 : 300);
    const uy = y + h - (PORTRAIT ? 2.4 : 4.6);
    const us = this.fit(b.unit, 600, LAY.unit, w - p * 2, 3.6);
    this.text(b.unit, x + p, uy, us, b.state === 'global' ? HALF : soft, 600);
    // Le dessin : a droite du nombre (un nom de cran prend la largeur : ses crans au-dessus de l'unite)
    const dx0 = named ? x + p : x + w * 0.52;
    const dx1 = x + w - p;
    const dy0 = named ? bigY + 1.5 : ly + (PORTRAIT ? 2.4 : 5);
    const dy1 = named ? uy - us - (PORTRAIT ? 1.2 : 2.5) : bigY;
    if (dy1 - dy0 > 2) this.glyph(b, dx0, dy0, dx1, dy1, inv ? BLACK : dim ? DIM : INK, inv ? 'rgba(5, 5, 6, 0.3)' : FAINT, env);
  }

  /**
   * Un bloc au telephone (2026-10-09) : plus haut que large, tout l'un sous l'autre (le nombre a cote du dessin ne
   * tenait qu'a 16) : le nom et la lettre, le nombre en grand (un nom de cran un peu moins), le dessin sur toute la
   * largeur, l'unite en bas.
   */
  private blockTall(b: BassBlock, x: number, y: number, w: number, h: number, env: BassPageModel['env']): void {
    const inv = b.state === 'lockOn' || b.state === 'flash';
    const dim = b.state === 'lockOff' || b.state === 'global';
    if (inv) this.box(x, y, w, h, INK, null, 1, 3.4);
    else this.box(x, y, w, h, b.state === 'global' ? null : b.held ? 'rgba(246, 241, 231, 0.08)' : 'rgba(246, 241, 231, 0.035)', b.echo ? INK : dim ? FAINT : DIM, b.echo ? 1.4 : 0.8, 3.4);
    const ink = inv ? BLACK : dim ? HALF : INK;
    const soft = inv ? 'rgba(5, 5, 6, 0.55)' : dim ? FAINT : HALF;
    const p = 4;
    const ly = y + p + LAY.label * 0.8 + 0.6;
    const lw = this.measure(b.letter, LAY.letter, 700);
    const ls = this.fit(b.label, 700, LAY.label, w - p * 2 - lw - 2.5, 4.4);
    this.text(b.label, x + p, ly, ls, ink, 700);
    this.text(b.letter, x + w - p, ly, LAY.letter, soft, 700, 'right');
    const named = !/^[+-]?\d+$/.test(b.big);
    const bs = this.fit(b.big, named ? 600 : 300, named ? LAY.big * 0.6 : LAY.big, w - p * 2 + 1, 7);
    const bigY = ly + 5.4 + bs * 0.72;
    this.text(b.big, x + p - (named ? 0 : 0.8), bigY, bs, ink, named ? 600 : 300);
    const uy = y + h - p + 0.4;
    const us = this.fit(b.unit, 600, LAY.unit, w - p * 2, 4);
    this.text(b.unit, x + p, uy, us, b.state === 'global' ? HALF : soft, 600);
    const dy0 = bigY + 4.4;
    const dy1 = uy - us - 2.6;
    if (dy1 - dy0 > 3) this.glyph(b, x + p, dy0, x + w - p, dy1, inv ? BLACK : dim ? DIM : INK, inv ? 'rgba(5, 5, 6, 0.3)' : FAINT, env);
  }

  /** Le petit dessin d'un bloc, dans la boite donnee. */
  private glyph(b: BassBlock, x0: number, y0: number, x1: number, y1: number, ink: string, faint: string, env: BassPageModel['env']): void {
    const w = x1 - x0;
    const h = y1 - y0;
    const v = Math.min(1, Math.max(0, b.v));
    const lw = PORTRAIT ? 1.1 : 1.2;
    const mid = y0 + h / 2;
    const pts: [number, number][] = [];
    switch (b.draw) {
      case 'notch': {
        const n = Math.max(2, b.notches);
        const r = Math.min(PORTRAIT ? 2.1 : 2.2, (w / n) * 0.3);
        for (let i = 0; i < n; i += 1) {
          const cx = x0 + r + ((w - 2 * r) * i) / (n - 1);
          if (i === b.notch) this.circle(cx, mid, r * 1.15, ink);
          else this.circle(cx, mid, r * 0.6, faint);
        }
        return;
      }
      case 'center': {
        this.stroke([[x0, mid], [x1, mid]], faint, lw);
        this.stroke([[x0 + w / 2, mid - h * 0.32], [x0 + w / 2, mid + h * 0.32]], faint, lw * 0.8);
        const cx = x0 + w * v;
        this.stroke([[x0 + w / 2, mid], [cx, mid]], ink, lw * 2.2);
        this.circle(cx, mid, lw * 1.6, ink);
        return;
      }
      case 'wave':
      case 'pulse': {
        // Deux periodes : la dent de scie qui devient carre (WAVE), ou le carre et sa largeur (PW)
        const per = w / 2;
        const top = y0 + h * 0.12;
        const bot = y1 - h * 0.12;
        const yv = (s: number): number => bot - ((s + 1) / 2) * (bot - top);
        for (let k = 0; k <= 64; k += 1) {
          const t = (k / 64) * 2;
          const ph = t % 1;
          let s: number;
          if (b.draw === 'wave') {
            const saw = 2 * ph - 1;
            const sq = ph < 0.5 ? 1 : -1;
            s = saw + (sq - saw) * v;
          } else s = ph < 0.5 + 0.45 * v ? 1 : -1;
          pts.push([x0 + t * per, yv(s)]);
        }
        this.stroke(pts, ink, lw);
        return;
      }
      case 'lp':
      case 'peak': {
        // Le passe-bas : la coupure (CUTOFF) et la bosse (RESO), sur la courbe de l'ecran d'avant
        const cut = b.draw === 'lp' ? v : 0.5;
        const reso = b.draw === 'peak' ? v : 0.35;
        const fc = Math.log2(60 * Math.pow(100, cut));
        const q = 0.6 + 7 * reso * reso;
        for (let k = 0; k <= 40; k += 1) {
          const f = Math.log2(30) + (k / 40) * (Math.log2(16000) - Math.log2(30));
          const r = Math.pow(2, f - fc);
          const mag = 1 / Math.sqrt((1 - r * r) ** 2 + (r / q) ** 2);
          const db = 20 * Math.log10(mag * mag) * 0.5;
          const yy = y0 + h * (0.42 - (Math.max(-40, Math.min(16, db)) / 56) * 1.0);
          pts.push([x0 + (k / 40) * w, Math.min(y1, Math.max(y0, yy))]);
        }
        this.stroke(pts, ink, lw);
        return;
      }
      case 'decay':
      case 'glide': {
        // La decroissance (DECAY, ACC DECAY, REV SIZE) ; GLIDE : la hauteur qui glisse d'une note a l'autre
        if (b.draw === 'glide') {
          const g = 0.08 + 0.75 * v;
          this.stroke([[x0, y1 - h * 0.15], [x0 + w * 0.15, y1 - h * 0.15], [x0 + w * (0.15 + g), y0 + h * 0.15], [x1, y0 + h * 0.15]], ink, lw);
          return;
        }
        const tau = 0.04 + 0.9 * v * v;
        for (let k = 0; k <= 40; k += 1) {
          const t = k / 40;
          pts.push([x0 + t * w, y1 - (h - 1) * Math.exp(-t / tau)]);
        }
        this.stroke([[x0, y1], [x1, y1]], faint, lw * 0.8);
        this.stroke(pts, ink, lw);
        return;
      }
      case 'adsr': {
        // L'ampli : les quatre temps, le segment de ce bloc en trait plein
        const [a, d, s, r] = env;
        const wa = 0.06 + 0.26 * a;
        const wd = 0.06 + 0.26 * d;
        const wr = 0.06 + 0.26 * r;
        const ws = Math.max(0.08, 1 - wa - wd - wr);
        const top = y0 + 1;
        const sy = y1 - (y1 - top) * s;
        const X = [x0, x0 + w * wa, x0 + w * (wa + wd), x0 + w * (wa + wd + ws), x1];
        const segs: [number, number][][] = [
          [[X[0], y1], [X[1], top]],
          [[X[1], top], [X[2], sy]],
          [[X[2], sy], [X[3], sy]],
          [[X[3], sy], [X[4], y1]],
        ];
        segs.forEach((sg, i) => this.stroke(sg, i === b.seg ? ink : faint, i === b.seg ? lw * 1.8 : lw));
        return;
      }
      case 'gate': {
        // LENGTH : la note dans son pas (AUTO : en pointille, la longueur du style)
        const auto = v < 0.02;
        const g = auto ? 0.5 : 0.1 + 0.9 * v;
        this.stroke([[x0, y1], [x1, y1]], faint, lw * 0.8);
        this.stroke([[x0 + w, y0], [x0 + w, y1]], faint, lw * 0.6);
        this.box(x0, y0 + h * 0.25, w * g, h * 0.5, auto ? null : ink, auto ? ink : null, lw, 1);
        return;
      }
      case 'tilt': {
        // REV TONE : les aigus gardes jusqu'a la coupure, puis la pente
        const kx = x0 + w * (0.15 + 0.75 * v);
        this.stroke([[x0, y0 + h * 0.3], [kx, y0 + h * 0.3], [x1, y1 - h * 0.05]], ink, lw);
        return;
      }
      case 'echo': {
        // DLY TIME : les repetitions, espacees du temps choisi
        const n = Math.max(2, b.notches);
        const sp = 0.12 + (0.5 * b.notch) / (n - 1);
        let amp = 1;
        for (let t = 0; t <= 1.0001; t += sp) {
          const xx = x0 + t * w;
          this.stroke([[xx, y1], [xx, y1 - (h - 1) * amp]], t === 0 ? ink : t < sp * 1.5 ? ink : faint, lw * 1.4);
          amp *= 0.62;
        }
        return;
      }
      default: {
        // Une barre : le niveau
        this.stroke([[x0, mid], [x1, mid]], faint, lw);
        const cx = x0 + w * v;
        this.stroke([[x0, mid], [cx, mid]], ink, lw * 2.2);
        this.circle(cx, mid, lw * 1.6, ink);
      }
    }
  }

  /** La bande des seize pas : le contour de la ligne, la tete, les verrous, le pas en LOCK. */
  private strip(m: BassPageModel, x0: number, y0: number, w: number, h: number): void {
    const S = m.strip;
    const cw = w / BASS_STEPS;
    const c = this.ctx;
    const top = y0 + (PORTRAIT ? 3.2 : 4);
    const bot = y0 + h - (PORTRAIT ? 2.4 : 3);
    for (let i = 0; i <= BASS_STEPS; i += 4) {
      c.fillStyle = FAINT;
      c.fillRect(x0 + i * cw - 0.25, top - 1, 0.5, bot - top + 2);
    }
    const yOf = (hh: number): number => bot - 1 - hh * (bot - top - 3);
    S.cells.forEach((cell, i) => {
      const x = x0 + i * cw;
      const locking = S.lock === i;
      const playing = S.play === i;
      if (locking) this.box(x + 0.8, top - 1.5, cw - 1.6, bot - top + 3, INK, null, 1, 1.5);
      else if (playing) this.box(x + 0.8, top - 1.5, cw - 1.6, bot - top + 3, 'rgba(246, 241, 231, 0.2)', null, 1, 1.5);
      const ink = locking ? BLACK : cell.acc ? INK : HALF;
      if (cell.kind === 'off') this.circle(x + cw / 2, bot - 0.5, PORTRAIT ? 0.75 : 0.8, locking ? BLACK : i % 4 === 0 ? HALF : FAINT);
      else {
        const yy = yOf(cell.h);
        const tieIn = cell.kind === 'tie';
        const tieOut = i < BASS_STEPS - 1 && S.cells[i + 1].kind === 'tie';
        const xa = tieIn ? x : x + 1.6;
        const xb = tieOut ? x + cw : x + cw - 1.6;
        this.bar(xa, yy - (PORTRAIT ? 1.4 : 1.6), xb - xa, PORTRAIT ? 2.8 : 3.2, ink);
        if (cell.slide && i < BASS_STEPS - 1 && S.cells[i + 1].kind === 'note') this.stroke([[xb - 0.5, yy], [x + cw + 1.6, yOf(S.cells[i + 1].h)]], ink, PORTRAIT ? 0.8 : 0.9);
      }
      // Un verrou : un point au-dessus (plein : un reglage de cette page)
      if (cell.lock) this.circle(x + cw / 2, y0 + (PORTRAIT ? 0.6 : 0.6), cell.lock === 2 ? (PORTRAIT ? 1.2 : 1.3) : PORTRAIT ? 0.8 : 0.85, cell.lock === 2 ? INK : HALF);
      if (playing) {
        c.fillStyle = INK;
        c.fillRect(x + 1, y0 + h + (PORTRAIT ? 0.3 : 0.6), cw - 2, PORTRAIT ? 1.2 : 1.3);
      } else if (S.sel === i && S.lock < 0) {
        c.fillStyle = HALF;
        c.fillRect(x + 1, y0 + h + (PORTRAIT ? 0.3 : 0.6), cw - 2, PORTRAIT ? 0.8 : 0.9);
      }
    });
  }

  /* ---------------- EDIT ---------------- */

  private drawEdit(m: BassEditModel): void {
    const UW = this.UW;
    const UH = this.UH;
    const P = LAY.pad;
    const hy = LAY.hy;
    this.transport(m.running, P, hy, LAY.tab * 1.05);
    let x = P + LAY.tab + 4;
    x += this.pill('EDIT', x, hy, LAY.tab, false) + 5;
    x += this.text(m.pattern, x, hy, LAY.tab * 1.3, INK, 600) + 5;
    const used = this.tempo(m.bpm);
    const right = UW - used - 6;
    if (right - x > 12) {
      const sz = this.fit(m.chain, 600, LAY.small, right - x - 2, 4);
      this.text(m.chain, x, hy, sz, HALF, 600);
    }
    this.iKey(m.infos);

    // Du bas vers le haut : la ligne, les patterns, les pistes des verrous (autant que de reglages verrouilles),
    // puis le rouleau prend le reste ; rouleau et pistes sur la meme grille de seize pas (une colonne par pas)
    const lineY = UH - LINE_DY;
    const slotH = PORTRAIT ? 14 : 16;
    const slotY = lineY - LAY.line - (PORTRAIT ? 2 : 5) - slotH;
    // Une piste : la valeur 0 a 127 de chaque verrou en haut, sa barre dessous (2026-10-08, la revue : des taches
    // sans nombre, 83 et 91 se ressemblaient)
    const lane = PORTRAIT ? 17.5 : 23;
    const lanesY1 = slotY - (PORTRAIT ? 3 : 6);
    const lanesY0 = lanesY1 - Math.max(1, m.lanes.length) * lane;
    const laneTop = lanesY0 - (PORTRAIT ? 1 : 2);
    const lx0 = PORTRAIT ? 46 : 58;
    const rx0 = lx0;
    const rx1 = UW - P;
    const ry0 = LAY.by0 - (PORTRAIT ? 1 : 0);
    const ry1 = laneTop - LAY.small - (PORTRAIT ? 3.5 : 6);
    const cw = (rx1 - rx0) / BASS_STEPS;
    const c = this.ctx;
    const notes = m.midis.filter((n): n is number => n !== null);
    let lo = notes.length ? Math.min(...notes) : 36;
    let hi = notes.length ? Math.max(...notes) : 48;
    if (hi - lo < 12) {
      const mid = (hi + lo) / 2;
      lo = Math.floor(mid - 6);
      hi = Math.ceil(mid + 6);
    }
    const yOf = (n: number): number => ry1 - 3 - ((n - lo) / Math.max(1, hi - lo)) * (ry1 - ry0 - 6);
    // A gauche du rouleau : la note la plus haute et la plus basse de la ligne, sous l'en-tete (2026-10-08, la revue :
    // au telephone la plus haute touchait la pastille EDIT) ; LINE au milieu
    const ns = LAY.small * 0.9;
    if (notes.length) {
      const nn = (x: number): string => `${NOTE_NAMES[((x % 12) + 12) % 12]}${Math.floor(x / 12) - 1}`;
      const top = Math.max(...notes);
      const low = Math.min(...notes);
      const yTop = Math.max(ry0 + ns + (PORTRAIT ? 1.5 : 2), yOf(top) + ns * 0.38);
      this.text(nn(top), P, yTop, ns, HALF, 600);
      if (low !== top) this.text(nn(low), P, Math.max(yTop + ns + 1, yOf(low) + ns * 0.38), ns, HALF, 600);
    }
    this.text('LINE', P, (ry0 + ry1) / 2 + LAY.small * 0.3, LAY.small * 0.8, FAINT, 700);
    for (let i = 0; i <= BASS_STEPS; i += 1) {
      c.fillStyle = i % 4 === 0 ? FAINT : GHOST;
      c.fillRect(rx0 + i * cw - 0.25, ry0, 0.5, ry1 - ry0);
    }
    if (m.play >= 0) {
      c.fillStyle = 'rgba(246, 241, 231, 0.14)';
      c.fillRect(rx0 + m.play * cw, ry0, cw, ry1 - ry0);
    }
    const nh = PORTRAIT ? 3.6 : 4.4;
    m.steps.forEach((st, i) => {
      const n = m.midis[i];
      const xx = rx0 + i * cw;
      if (st.kind === 'off' || n === null) return;
      const yy = yOf(n);
      const tieIn = st.kind === 'tie';
      const nx = m.steps[(i + 1) % BASS_STEPS];
      const tieOut = nx.kind === 'tie' && i < BASS_STEPS - 1;
      let accent = st.kind === 'note' ? st.acc : false;
      if (tieIn) for (let k = i - 1; k >= 0; k -= 1) if (m.steps[k].kind === 'note') {
        accent = m.steps[k].acc;
        break;
      }
      const xa = tieIn ? xx - 0.5 : xx + 1;
      const xb = tieOut ? xx + cw + 0.5 : xx + cw - 1;
      this.bar(xa, yy - nh / 2, xb - xa, nh, accent ? INK : HALF);
      if (st.locks) this.circle(xx + cw / 2, ry0 + (PORTRAIT ? 1 : 1.5), PORTRAIT ? 0.8 : 1.1, INK);
      if (st.slide && nx.kind === 'note' && i < BASS_STEPS - 1) {
        const n2 = m.midis[i + 1];
        if (n2 !== null) this.stroke([[xb - 0.8, yy], [xx + cw + 2, yOf(n2)]], INK, PORTRAIT ? 0.7 : 1.1);
      }
    });

    // Les verrous de la page : une piste par reglage verrouille, une barre par pas, sur la grille du rouleau
    const lh = PORTRAIT ? 7.4 : 8;
    const head = `LOCKS  ${m.pageLabel}`;
    this.text(head, P, laneTop, LAY.small * 0.92, INK, 700);
    const others = m.others.map((o) => `${o.label} ${o.n}`).join('   ');
    this.text(others, UW - P, laneTop, LAY.small * 0.86, m.others.some((o) => o.n > 0) ? HALF : FAINT, 600, 'right');
    if (!m.lanes.length) {
      // Au telephone (2026-10-09) : plus d'encodeur, on glisse un bloc
      const how = `NO LOCK ON THIS PAGE   HOLD A STEP + ${PORTRAIT ? 'DRAG A VALUE' : 'TURN AN ENCODER'}`;
      this.text(how, (lx0 + rx1) / 2, (lanesY0 + lanesY1) / 2 + 2, this.fit(how, 600, LAY.small * 0.92, rx1 - lx0, 4), HALF, 600, 'center');
    }
    const lcw = (rx1 - lx0) / BASS_STEPS;
    const vs = PORTRAIT ? 5.2 : 5.6;
    m.lanes.forEach((ln, j) => {
      const y0 = lanesY0 + j * lane;
      const y1 = y0 + lane - (PORTRAIT ? 1.4 : 2.2);
      // La barre : sous la ligne des valeurs, de la ligne de base jusqu'a sa valeur
      const b0 = y0 + vs + (PORTRAIT ? 1 : 1.6);
      const n = ln.cells.filter((v) => v !== null).length;
      const ls = this.fit(ln.label, 700, lh * 0.82, lx0 - P - 12, 3.6);
      this.text(ln.label, P, y1 - 0.5, ls, INK, 700);
      this.text(String(n), lx0 - 4, y1 - 0.5, lh * 0.78, HALF, 600, 'right');
      // Le niveau du son, en pointille
      const by = y1 - ln.base * (y1 - b0);
      this.stroke([[lx0, by], [rx1, by]], HALF, 0.7, [1.2, 1.6]);
      for (let i = 0; i < BASS_STEPS; i += 1) {
        const xx = lx0 + i * lcw;
        c.fillStyle = FAINT;
        c.fillRect(xx + 0.6, y1, lcw - 1.2, 0.6);
        const v = ln.cells[i];
        if (v === null) continue;
        const top = y1 - Math.max(0.8, v * (y1 - b0));
        const hot = i === m.play;
        this.box(xx + 1, top, lcw - 2, y1 - top, hot ? INK : 'rgba(246, 241, 231, 0.72)', null, 1, 0.8);
        // Le nombre de l'ecran (0 a 127, TUNE -64 a +63 ; un cran : son nom, court)
        const big = bassBig(ln.id, v);
        const t = /^[+-]?\d+$/.test(big) ? big : big.slice(0, 4);
        this.text(t, xx + lcw / 2, y0 + vs, this.fit(t, 600, vs, lcw - 1, 3), hot ? INK : HALF, 600, 'center');
      }
    });
    if (m.more > 0) this.text(`+${m.more} MORE`, UW - P, lanesY1 + (PORTRAIT ? 0.5 : 1), LAY.small * 0.8, HALF, 700, 'right');

    // Les seize patterns (sur les pas : en EDIT, ce sont eux qu'on touche)
    this.text('PATTERNS', P, slotY + slotH / 2 + LAY.small * 0.32, LAY.small * 0.8, HALF, 700);
    const sw = (rx1 - rx0) / 16;
    m.slots.forEach((s, i) => {
      const xx = rx0 + i * sw + 0.8;
      const w = sw - 1.6;
      if (s.cur) this.box(xx, slotY, w, slotH, INK, null, 1, 2);
      else if (s.filled) this.box(xx, slotY, w, slotH, 'rgba(246, 241, 231, 0.13)', null, 1, 2);
      else this.box(xx, slotY, w, slotH, null, FAINT, 0.7, 2);
      if (s.next) this.box(xx - 0.8, slotY - 0.8, w + 1.6, slotH + 1.6, null, INK, 1.3, 2.4);
      this.text(String(i + 1), xx + w / 2, slotY + slotH / 2 + LAY.small * 0.36, LAY.small * 0.95, s.cur ? BLACK : s.filled ? INK : HALF, 600, 'center');
      if (s.chain >= 0) this.text(String(s.chain + 1), xx + w - 1, slotY + LAY.small * 0.72, LAY.small * 0.62, s.cur ? BLACK : INK, 700, 'right');
    });
    const ls = this.fitLine(m.line, LAY.line, UW - 2 * P);
    this.lineText(m.line, P, lineY, ls, m.lineHot ? INK : HALF, 600);
  }

  /* ---------------- l'echo d'un reglage hors page ---------------- */

  /**
   * Un dessin des INFOS (bass/diagrams.ts) dans la boite donnee, a
   * l'echelle, centre : les traits en os (le principal fin, ce qui change
   * plus epais), HALF pour les fantomes et les pointilles, FAINT pour la
   * grille ; les etiquettes en HALF (la valeur, deja en grand, non).
   */
  private drawDiagram(d: BassDiagram, x: number, y: number, w: number, h: number): void {
    const c = this.ctx;
    const k = Math.min(w / d.w, h / d.h);
    c.save();
    c.translate(x + (w - d.w * k) / 2, y + (h - d.h * k) / 2);
    c.scale(k, k);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const p of d.paths) {
      const path = new Path2D(p.d);
      const ink = DIAGRAM_INK[p.role];
      if (p.fill) {
        c.fillStyle = ink.fill;
        c.fill(path);
        continue;
      }
      c.strokeStyle = ink.stroke;
      c.lineWidth = ink.lw / k;
      c.setLineDash(p.role === 'dash' ? [3 / k, 2.4 / k] : []);
      c.stroke(path);
    }
    c.setLineDash([]);
    c.font = font(600, 9.5);
    c.fillStyle = HALF;
    c.textBaseline = 'alphabetic';
    for (const t of d.texts) {
      if (t.role !== 'label') continue;
      c.textAlign = t.anchor === 'middle' ? 'center' : t.anchor === 'end' ? 'right' : 'left';
      c.fillText(t.text, t.x, t.y);
    }
    c.restore();
  }

  /**
   * L'echo d'un reglage qui n'est pas sur la page (2026-10-08, l'habitude
   * des Elektron) : a gauche sa section, son nom et sa valeur en grand ; a
   * droite son dessin, avec les valeurs du moment (en LOCK, celles du pas).
   */
  private drawKnob(sv: Extract<BassScreenView, { view: 'knob' }>): void {
    const UW = this.UW;
    const UH = this.UH;
    const P = LAY.pad;
    const hy = LAY.hy;
    const k = sv.k;
    this.transport(sv.running, P, hy, LAY.tab * 1.05);
    let x = P + LAY.tab + 4;
    if (k.lock >= 0) x += this.pill(`LOCK ${two(k.lock)}`, x, hy, LAY.tab, true) + 5;
    this.text(BASS_INFOS[k.id].section, x, hy, LAY.tab, HALF, 700);
    if (k.locked) this.pill('LOCKED', UW - P - LAY.i * 2 - 8, hy, LAY.tab * 0.95, true, 'right');
    else this.tempo(sv.bpm);
    this.iKey(sv.infos);
    const label = bassKnob(k.id).label;
    const value = bassValueText(k.id, k.v);
    const d = bassDiagram(k.id, { v: k.v, values: sv.values, bpm: sv.bpm, steps: sv.steps });
    const rule = GEN_RULES.has(k.id) ? (k.live ? 'THE LINE FOLLOWS LIVE' : 'PRESS GEN TO HEAR IT') : '';
    if (PORTRAIT) {
      // Au telephone (2026-10-09, l'ecran plus haut que large) : le nom et la valeur en haut, le dessin dessous sur toute
      // la largeur (1.6 fois plus grand qu'a droite de la valeur)
      const ls = this.fit(label, 700, 12, UW - 2 * P);
      const vs = this.fit(value, 300, 30, UW - 2 * P, 8);
      const ly = LAY.by0 + 2 + ls * 0.8;
      const vy = ly + 4 + vs * 0.74;
      this.text(label, P, ly, ls, INK, 700);
      this.text(value, P - 1, vy, vs, INK, 300);
      if (rule) this.text(rule, P, UH - LINE_DY, LAY.line * 0.9, HALF, 700);
      const dy0 = vy + 6;
      const dy1 = UH - (rule ? LINE_DY + LAY.line + 4 : P);
      if (d && dy1 - dy0 > 20) this.drawDiagram(d, P, dy0, UW - 2 * P, dy1 - dy0);
      return;
    }
    const colW = UW * 0.42 - P;
    const top = LAY.by0 + 2;
    const bot = UH - P;
    const band = bot - top;
    const ls = this.fit(label, 700, Math.min(15, band * 0.2), colW);
    const vs = this.fit(value, 300, Math.min(30, band * 0.38), colW, 8);
    const block = ls + vs * 1.08 + 4;
    const y0 = top + Math.max(0, (band - block) / 2);
    this.text(label, P, y0 + ls, ls, INK, 700);
    this.text(value, P - 1, y0 + ls + 4 + vs * 1.02, vs, INK, 300);
    if (rule) this.text(rule, P, UH - 6, LAY.line * 0.9, HALF, 700);
    if (d) this.drawDiagram(d, UW * 0.44, LAY.by0, UW * 0.56 - P, UH - LAY.by0 - P);
  }

  /* ---------------- PRESETS ---------------- */

  /** PRESETS : comme l'ecran du MM-RYTM. */
  private drawPresets(p: PresetView): void {
    const UW = this.UW;
    const UH = this.UH;
    const P = LAY.pad;
    this.text(p.title, P, LAY.hy + 2, LAY.tab * 1.2, INK, 700);
    if (p.count) this.text(p.count, UW - P, LAY.hy + 2, LAY.tab * 1.2, HALF, 600, 'right');
    // Le nom en grand entre les fleches (gauche : le precedent, droite : le suivant)
    const band = UH * 0.74;
    const my = band * 0.58 + 6;
    const c = this.ctx;
    // Les fleches : un peu plus grandes au telephone (2026-10-09, l'ecran plus grand)
    const ak = PORTRAIT ? 1.35 : 1;
    if (!p.empty) {
      c.fillStyle = INK;
      for (const [x, d] of [
        [P + 4 * ak, -1],
        [UW - P - 4 * ak, 1],
      ] as const) {
        c.beginPath();
        c.moveTo(x - d * 3 * ak, my - 6 * ak);
        c.lineTo(x + d * 4 * ak, my - 1 * ak);
        c.lineTo(x - d * 3 * ak, my + 4 * ak);
        c.closePath();
        c.fill();
      }
    }
    let size = PORTRAIT ? 24 : 26;
    c.font = font(400, size);
    while (size > 9 && c.measureText(p.name).width > UW - 60) {
      size -= 1;
      c.font = font(400, size);
    }
    this.text(p.name, UW / 2, my + size * 0.35, size, INK, 400, 'center');
    // Les quatre touches du bas
    const kw = UW / 4;
    p.keys.forEach((k, i) => {
      if (!k) return;
      // Au telephone (2026-10-09) : au milieu de la bande du bas, celle que le doigt touche (le quart du verre)
      this.pill(k, i * kw + kw / 2, PORTRAIT ? UH * 0.87 + 3 : UH - 10, PORTRAIT ? 8.6 : 9, k === 'EXIT', 'center');
    });
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
