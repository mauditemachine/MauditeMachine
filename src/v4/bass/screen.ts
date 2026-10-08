/**
 * L'ecran du MM-BASS (2026-10-07), dans le langage du nouvel ecran du
 * MM-RYTM (facon OP-1, Mika : "je ne veux pas de couleurs") : noir et os en
 * trois intensites, des formes nettes, peu de mots.
 * - En haut : la lecture (un triangle, un carre a l'arret), le style du
 *   generateur ; a droite la tonique et la gamme (ARP : elle suit le MM-ARP),
 *   le tempo.
 * - Au milieu, la ligne de basse en rouleau : seize colonnes, chaque note un
 *   trait a sa hauteur (plein accentuee, en demi-teinte sinon), une liaison
 *   le prolonge, un SLIDE un trait court vers la note suivante ; le pas choisi
 *   dans une bande a peine claire, le pas qui joue souligne.
 * - A droite, le filtre : sa courbe (la coupure, la resonance) et un point
 *   qui suit la coupure qui sonne (l'enveloppe, l'accent).
 * - En bas : le message du moment (un potard, un pas), sinon le pas choisi ;
 *   a droite, discret, TOUCH: PRESETS.
 * Trois pages de plus (2026-10-07) :
 * - LOCK : LOCK 05 en pastille a la place du style, le pas regle dans une
 *   bande plus claire, le filtre dessine avec ses verrous, la liste des
 *   verrous en bas ; un petit trait au-dessus de chaque pas verrouille ;
 * - EDIT : les seize patterns en deux rangees (le courant plein, celui qui
 *   attend cerne, la chaine numerotee), le courant en grand, la chaine ;
 * - PRESETS : le titre et le rang, le nom en grand entre deux fleches, les
 *   quatre touches en bas (SAVE NAME DEL EXIT), comme le MM-RYTM.
 * Deux de plus (2026-10-08, la refonte facon Monark et Elektron) :
 * - l'echo d'un potard (mode.knob, un instant apres qu'on l'a tourne, comme
 *   les Elektron) : sa section en petit, son nom et sa valeur en grand, son
 *   dessin des INFOS (bass/diagrams.ts, trace avec Path2D : os, HALF pour
 *   les fantomes, FAINT pour la grille), LOCKED en pastille s'il est
 *   verrouille sur le pas ; PRESS GEN sous les regles du generateur ;
 * - la grille LOCK (mode.lock.cells) : l'en-tete du pas en pastille (LOCK 05
 *   F#2 ACC SLD), les onze parametres verrouillables en cases (6 x 2 sur
 *   l'ecran large et bas du telephone, 4 x 3 sur desktop), les verrouilles
 *   en negatif (os plein, texte noir, la convention du Digitakt), les autres
 *   avec la valeur du potard en demi-teinte ; la derniere case compte les
 *   verrous ; en bas, les gestes.
 * Priorite : PRESETS, EDIT, l'echo, la grille LOCK, la ligne (en LOCK sans
 * cells, l'ancienne page : la liste des verrous en bas).
 * Une texture sur le verre, redessinee quand quelque chose change, et a
 * chaque image tant que la basse sonne (le point du filtre, la tete).
 */

import { Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { makeCanvasTexture } from '../scene/silk';
import { DJ_BEZEL } from '../dj/theme';
import { FONT_DISPLAY, HEX } from '../theme';
import type { PresetView } from '../state/presetMode';
import { bassDiagram, type BassDiagram } from './diagrams';
import { BASS_INFOS } from './infos';
import { BASS_ROOTS, BASS_SCALES, BASS_STYLES, bassKnob, bassValueText, stepOf, type BassKnobId, type BassValues } from './params';
import { BASS_STEPS, type BassLockId, type BassState } from './state';
import { BASS } from './theme';

const INK: string = HEX.bone;
const HALF: string = 'rgba(246, 241, 231, 0.5)';
const FAINT: string = 'rgba(246, 241, 231, 0.18)';
const BLACK: string = '#050506';

const font = (weight: number, size: number): string => `${weight} ${size}px ${FONT_DISPLAY}`;
const two = (i: number): string => String(i + 1).padStart(2, '0');

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

/** Une case de la page LOCK (2026-10-08) : un potard verrouillable, sa valeur sur ce pas, verrouillee ou non. */
export interface BassLockCell {
  id: BassLockId;
  /** le nom court (CUT, RES...) */
  label: string;
  /** la valeur lisible sur ce pas (celle du verrou, sinon celle du potard) */
  value: string;
  locked: boolean;
}

/** Les pages de l'ecran (2026-10-07). */
export interface BassScreenMode {
  edit: { cur: number; next: number; chain: readonly number[]; filled: readonly boolean[] } | null;
  /**
   * le pas dont on regle les verrous, et leur texte (CUTOFF 1.2 KHZ...) ;
   * head : l'en-tete (LOCK 05  F#2 ACC SLD), cells : la grille des
   * parametres verrouillables (2026-10-08)
   */
  lock: { step: number; items: readonly string[]; head?: string; cells?: readonly BassLockCell[] } | null;
  presets: PresetView | null;
  /**
   * le potard qu'on vient de tourner (2026-10-08, l'echo des Elektron) :
   * son id, sa valeur (0 a 1, celle du verrou en LOCK), verrouille ou non ;
   * null hors de l'instant
   */
  knob?: { id: BassKnobId; v: number; locked: boolean } | null;
}

const slot = (i: number): string => `A${String(i + 1).padStart(2, '0')}`;

export interface BassLive {
  /** la coupure du moment (Hz), 0 : rien ne sonne */
  cut: number;
  /** le pas qui joue (-1 : a l'arret) */
  step: number;
}

export class BassScreen {
  readonly mesh: Mesh;
  readonly texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  /** la mise en page en unites : 300 de large */
  private UW = 300;
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

  private text(s: string, x: number, y: number, size: number, color = INK, weight = 500, align: CanvasTextAlign = 'left'): number {
    const c = this.ctx;
    c.font = font(weight, size);
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = 'alphabetic';
    c.fillText(s, x, y);
    return c.measureText(s).width;
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

  /**
   * Redessine si quelque chose a change ; true si redessine. midis : la
   * hauteur de chaque pas (une liaison : celle de la note d'avant), null
   * pour un pas vide.
   */
  draw(s: BassState, v: BassValues, midis: readonly (number | null)[], bpm: number, live: BassLive, message: string | null, info: string, mode: BassScreenMode): boolean {
    const cutK = live.cut > 0 ? Math.round(Math.log2(live.cut) * 24) : 0;
    // L'echo dessine avec toutes les valeurs (le dessin de RESO lit CUTOFF, celui de DECAY le tempo...) et les verrous du pas
    const key = JSON.stringify([s.steps, s.sel, s.running, s.lock, v.cutoff, v.reso, v.style, v.root, v.scale, midis, Math.round(bpm), live.step, cutK, message, info, mode, mode.knob ? v : null]);
    if (key === this.key) return false;
    this.key = key;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = BLACK;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (mode.presets) this.drawPresets(mode.presets);
    else if (mode.edit) this.drawEdit(s, bpm, mode.edit, message);
    else if (mode.knob) this.drawKnob(s, v, bpm, mode.knob, mode.lock);
    else if (mode.lock?.cells) this.drawLockGrid(s, bpm, mode.lock, message);
    else this.drawLine(s, v, midis, bpm, live, message, info, mode.lock);
    this.texture.needsUpdate = true;
    this.draws += 1;
    return true;
  }

  /** Une pastille : pleine (le texte en noir) ou cernee. */
  private pill(text: string, x: number, y: number, size: number, full: boolean, align: 'left' | 'center' | 'right' = 'left'): number {
    const c = this.ctx;
    c.font = font(700, size);
    const tw = c.measureText(text).width;
    const w = tw + size * 1.4;
    const h = size * 1.55;
    const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    this.bar(x0, y - h + size * 0.38, w, h, full ? INK : null, full ? null : INK);
    this.text(text, x0 + w / 2, y, size, full ? BLACK : INK, 700, 'center');
    return w;
  }

  /** La page de la ligne : le rouleau, le filtre ; en LOCK, le pas regle et ses verrous. */
  private drawLine(s: BassState, v: BassValues, midis: readonly (number | null)[], bpm: number, live: BassLive, message: string | null, info: string, lock: BassScreenMode['lock']): void {
    const c = this.ctx;
    const UW = this.UW;
    const UH = this.UH;
    // L'en-tete
    const hy = 18;
    c.fillStyle = INK;
    if (s.running) {
      c.beginPath();
      c.moveTo(10, hy - 9);
      c.lineTo(18, hy - 4.5);
      c.lineTo(10, hy);
      c.closePath();
      c.fill();
    } else c.fillRect(10, hy - 8.5, 8, 8);
    if (lock) this.pill(`LOCK ${String(lock.step + 1).padStart(2, '0')}`, 24, hy, 9, true);
    else this.text(BASS_STYLES[stepOf('style', v.style)], 24, hy, 12, INK, 600);
    const root = BASS_ROOTS[stepOf('root', v.root)];
    const scale = BASS_SCALES[stepOf('scale', v.scale)];
    const bw = this.text('BPM', UW - 10, hy, 7, HALF, 600, 'right');
    const nw = this.text(String(Math.round(bpm)), UW - 14 - bw, hy, 12, INK, 400, 'right');
    this.text(`${root} ${scale}`, UW - 26 - bw - nw, hy, 9, HALF, 600, 'right');

    // Le filtre, a droite ; en LOCK, celui du pas regle
    const fw = Math.min(84, UW * 0.24);
    const fx1 = UW - 10;
    const fx0 = fx1 - fw;
    const fy0 = 32;
    const fy1 = UH - 26;
    const lv = lock ? { ...v, ...(s.steps[lock.step]?.locks ?? {}) } : v;
    this.drawFilter(fx0, fy0, fx1, fy1, lv, live.cut);

    // Le rouleau
    const rx0 = 10;
    const rx1 = fx0 - 12;
    const ry0 = 30;
    const ry1 = UH - 24;
    const cw = (rx1 - rx0) / BASS_STEPS;
    const notes = midis.filter((m): m is number => m !== null);
    let lo = notes.length ? Math.min(...notes) : 36;
    let hi = notes.length ? Math.max(...notes) : 48;
    if (hi - lo < 12) {
      const mid = (hi + lo) / 2;
      lo = Math.floor(mid - 6);
      hi = Math.ceil(mid + 6);
    }
    const yOf = (m: number): number => ry1 - 4 - ((m - lo) / Math.max(1, hi - lo)) * (ry1 - ry0 - 8);
    // Les temps : un trait fin tous les quatre pas ; le pas choisi (ou celui qu'on verrouille) dans une bande claire
    for (let i = 0; i <= BASS_STEPS; i += 4) {
      c.fillStyle = FAINT;
      c.fillRect(rx0 + i * cw - 0.3, ry0, 0.6, ry1 - ry0);
    }
    const band = lock ? lock.step : s.sel;
    c.fillStyle = lock ? 'rgba(246, 241, 231, 0.16)' : 'rgba(246, 241, 231, 0.08)';
    c.fillRect(rx0 + band * cw, ry0, cw, ry1 - ry0);
    c.fillStyle = HALF;
    c.fillRect(rx0 + s.sel * cw + 1, ry1 + 2, cw - 2, 1.2);
    for (let i = 0; i < BASS_STEPS; i += 1) {
      const st = s.steps[i];
      const m = midis[i];
      const x = rx0 + i * cw;
      // Un pas verrouille : un petit trait au-dessus de sa colonne
      if (st.locks) {
        c.fillStyle = lock && lock.step === i ? INK : HALF;
        c.fillRect(x + cw / 2 - 2, ry0 - 4, 4, 1.6);
      }
      if (st.kind === 'off' || m === null) {
        this.circle(x + cw / 2, ry1 - 2, 0.9, i % 4 === 0 ? HALF : FAINT);
        continue;
      }
      const y = yOf(m);
      const tieIn = st.kind === 'tie';
      const nx = s.steps[(i + 1) % BASS_STEPS];
      const tieOut = nx.kind === 'tie' && i < BASS_STEPS - 1;
      const x0 = tieIn ? x - 0.5 : x + 1.2;
      const x1 = tieOut ? x + cw + 0.5 : x + cw - 1.2;
      const head = st.kind === 'note';
      let accent = st.kind === 'note' ? st.acc : false;
      if (tieIn) for (let k = i - 1; k >= 0; k -= 1) if (s.steps[k].kind === 'note') {
        accent = s.steps[k].acc;
        break;
      }
      this.bar(x0, y - 3.2, x1 - x0, 6.4, accent ? INK : HALF);
      if (head && i === live.step) this.circle(x + cw / 2, y, 5, null, INK, 1.2);
      // SLIDE : un trait court qui glisse vers la note suivante (le portamento de la 303)
      if (st.slide && nx.kind === 'note' && i < BASS_STEPS - 1) {
        const m2 = midis[i + 1];
        if (m2 !== null) {
          c.strokeStyle = INK;
          c.lineWidth = 1.2;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(x1 - 1, y);
          c.lineTo(x + cw + 2.4, yOf(m2));
          c.stroke();
        }
      }
    }
    if (live.step >= 0) {
      c.fillStyle = INK;
      c.fillRect(rx0 + live.step * cw + 1, ry1 + 5, cw - 2, 1.6);
    }
    // Le bas : le message ; en LOCK la liste des verrous ; sinon le pas choisi et, discret, les presets
    if (message) this.text(message, rx0, UH - 7, 8.5, INK, 600);
    else if (lock) this.text(lock.items.length ? lock.items.join('   ') : 'TURN A SOUND KNOB TO LOCK IT ON THIS STEP', rx0, UH - 7, 8, lock.items.length ? INK : HALF, 600);
    else {
      this.text(info, rx0, UH - 7, 8.5, HALF, 600);
      this.text('TOUCH: PRESETS', UW - 10, UH - 7, 6, FAINT, 700, 'right');
    }
  }

  /** La lecture en haut a gauche : un triangle, un carre a l'arret. */
  private transport(running: boolean, hy: number): void {
    const c = this.ctx;
    c.fillStyle = INK;
    if (running) {
      c.beginPath();
      c.moveTo(10, hy - 9);
      c.lineTo(18, hy - 4.5);
      c.lineTo(10, hy);
      c.closePath();
      c.fill();
    } else c.fillRect(10, hy - 8.5, 8, 8);
  }

  /** Le tempo en haut a droite. */
  private tempo(bpm: number, hy: number): void {
    const bw = this.text('BPM', this.UW - 10, hy, 7, HALF, 600, 'right');
    this.text(String(Math.round(bpm)), this.UW - 14 - bw, hy, 12, INK, 400, 'right');
  }

  /** La plus grande taille (jusqu'a size) ou le texte tient dans maxW. */
  private fit(s: string, weight: number, size: number, maxW: number, min = 6): number {
    const c = this.ctx;
    let z = size;
    c.font = font(weight, z);
    while (z > min && c.measureText(s).width > maxW) {
      z -= 0.5;
      c.font = font(weight, z);
    }
    return z;
  }

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
   * L'echo d'un potard (2026-10-08, l'habitude des Elektron) : a gauche sa
   * section, son nom et sa valeur en grand ; a droite son dessin, avec les
   * valeurs du moment (en LOCK, celles du pas).
   */
  private drawKnob(s: BassState, v: BassValues, bpm: number, k: NonNullable<BassScreenMode['knob']>, lock: BassScreenMode['lock']): void {
    const UW = this.UW;
    const UH = this.UH;
    const hy = 18;
    this.transport(s.running, hy);
    let x = 24;
    if (lock) x += this.pill(`LOCK ${two(lock.step)}`, x, hy, 9, true) + 6;
    this.text(BASS_INFOS[k.id].section, x, hy, 8.5, HALF, 700);
    if (k.locked) this.pill('LOCKED', UW - 10, hy, 8, true, 'right');
    else this.tempo(bpm, hy);
    // Le nom et la valeur, centres dans la colonne de gauche
    const label = bassKnob(k.id).label;
    const value = bassValueText(k.id, k.v);
    const colW = UW * 0.42 - 12;
    const top = 28;
    const bot = UH - 10;
    const band = bot - top;
    const ls = this.fit(label, 700, Math.min(15, band * 0.2), colW);
    const vs = this.fit(value, 300, Math.min(30, band * 0.38), colW, 9);
    const block = ls + vs * 1.08 + 4;
    const y0 = top + Math.max(0, (band - block) / 2);
    this.text(label, 10, y0 + ls, ls, INK, 700);
    this.text(value, 9, y0 + ls + 4 + vs * 1.02, vs, INK, 300);
    if (GEN_RULES.has(k.id)) this.text('PRESS GEN TO HEAR IT', 10, UH - 6, 6.5, HALF, 700);
    // Le dessin, a droite
    const values = s.lock >= 0 && s.steps[s.lock]?.locks ? { ...v, ...s.steps[s.lock].locks } : v;
    const d = bassDiagram(k.id, { v: k.v, values, bpm, steps: s.steps });
    if (d) this.drawDiagram(d, UW * 0.44, 28, UW * 0.56 - 10, UH - 36);
  }

  /** La grille LOCK (2026-10-08, facon Digitakt) : les parametres verrouillables du pas, les verrouilles en negatif. */
  private drawLockGrid(s: BassState, bpm: number, lock: NonNullable<BassScreenMode['lock']>, message: string | null): void {
    const UW = this.UW;
    const UH = this.UH;
    const hy = 18;
    this.transport(s.running, hy);
    this.pill(lock.head ?? `LOCK ${two(lock.step)}`, 24, hy, 9, true);
    this.tempo(bpm, hy);
    const cells = lock.cells ?? [];
    // L'ecran du telephone est large et bas : deux rangees de six ; desktop : trois de quatre
    const cols = UH < 120 ? 6 : 4;
    const rows = Math.max(1, Math.ceil((cells.length + 1) / cols));
    const gx0 = 10;
    const gx1 = UW - 10;
    const gy0 = 28;
    const gy1 = UH - 16;
    const gap = 3;
    const cw = (gx1 - gx0 - gap * (cols - 1)) / cols;
    const chh = (gy1 - gy0 - gap * (rows - 1)) / rows;
    const ls = Math.max(5.5, Math.min(8, chh * 0.24));
    const vmax = Math.max(7, Math.min(13, chh * 0.4));
    const at = (i: number): { x: number; y: number } => ({ x: gx0 + (i % cols) * (cw + gap), y: gy0 + Math.floor(i / cols) * (chh + gap) });
    cells.forEach((cell, i) => {
      const { x, y } = at(i);
      if (cell.locked) this.box(x, y, cw, chh, INK, null);
      else this.box(x, y, cw, chh, null, FAINT);
      const ink = cell.locked ? BLACK : HALF;
      this.text(cell.label, x + 4, y + ls + 3, ls, ink, 700);
      const vs = this.fit(cell.value, cell.locked ? 700 : 500, vmax, cw - 8, 5.5);
      this.text(cell.value, x + 4, y + chh - 4.5, vs, ink, cell.locked ? 700 : 500);
    });
    // La case d'apres : combien de verrous sur ce pas
    if (cells.length < rows * cols) {
      const { x, y } = at(cells.length);
      const n = cells.filter((c) => c.locked).length;
      this.text(`${n}/${cells.length}`, x + cw / 2, y + chh - 6.5 - ls, vmax, n ? INK : HALF, 300, 'center');
      this.text('LOCKED', x + cw / 2, y + chh - 4.5, ls, HALF, 700, 'center');
    }
    this.text(message ?? 'TURN A KNOB: LOCK   DOUBLE TAP: UNLOCK   CLEAR: ALL', 10, UH - 6, 6.5, message ? INK : HALF, 600);
  }

  /** EDIT : les seize patterns. */
  private drawEdit(s: BassState, bpm: number, e: NonNullable<BassScreenMode['edit']>, message: string | null): void {
    const UW = this.UW;
    const UH = this.UH;
    const hy = 18;
    const c = this.ctx;
    c.fillStyle = INK;
    if (s.running) {
      c.beginPath();
      c.moveTo(10, hy - 9);
      c.lineTo(18, hy - 4.5);
      c.lineTo(10, hy);
      c.closePath();
      c.fill();
    } else c.fillRect(10, hy - 8.5, 8, 8);
    const pw = this.pill('EDIT', 24, hy, 9, false);
    this.text('PATTERNS', 30 + pw, hy, 9, HALF, 600);
    const bw = this.text('BPM', UW - 10, hy, 7, HALF, 600, 'right');
    this.text(String(Math.round(bpm)), UW - 14 - bw, hy, 12, INK, 400, 'right');
    // Les emplacements, deux rangees de huit
    const gx0 = 10;
    const gx1 = UW * 0.64;
    const gy0 = 30;
    const gw = (gx1 - gx0) / 8;
    const gh = (UH - 30 - 26) / 2;
    for (let i = 0; i < 16; i += 1) {
      const x = gx0 + (i % 8) * gw + 1.5;
      const y = gy0 + Math.floor(i / 8) * gh + 1.5;
      const w = gw - 3;
      const h = gh - 3;
      const cur = i === e.cur;
      const inChain = e.chain.length > 1 ? e.chain.indexOf(i) : -1;
      if (cur) this.box(x, y, w, h, INK, null);
      else if (e.filled[i]) this.box(x, y, w, h, 'rgba(246, 241, 231, 0.14)', null);
      else this.box(x, y, w, h, null, FAINT);
      if (i === e.next) this.box(x - 1, y - 1, w + 2, h + 2, null, INK, 1.6);
      this.text(String(i + 1), x + w / 2, y + h / 2 + 3, 8, cur ? BLACK : e.filled[i] ? INK : HALF, 600, 'center');
      if (inChain >= 0) this.text(String(inChain + 1), x + w - 2.5, y + 7, 5.5, cur ? BLACK : INK, 700, 'right');
    }
    // Le courant en grand, la chaine dessous
    const rx = UW * 0.82;
    this.text(slot(e.cur), rx, UH * 0.52, 30, INK, 300, 'center');
    const chain = e.chain.length > 1 ? e.chain.map(slot).join(' > ') : e.next >= 0 ? `NEXT ${slot(e.next)}` : e.filled[e.cur] ? 'PLAYING' : 'EMPTY';
    this.text(chain.length > 24 ? `${chain.slice(0, 23)}...` : chain, rx, UH * 0.52 + 16, 7, HALF, 600, 'center');
    this.text(message ?? 'TAP: PLAY   TAP MORE: CHAIN   HOLD AN EMPTY ONE: COPY', 10, UH - 7, 7.5, message ? INK : HALF, 600);
  }

  /** PRESETS : comme l'ecran du MM-RYTM. */
  private drawPresets(p: PresetView): void {
    const UW = this.UW;
    const UH = this.UH;
    this.text(p.title, 10, 18, 9, INK, 700);
    if (p.count) this.text(p.count, UW - 10, 18, 9, HALF, 600, 'right');
    // Le nom en grand entre les fleches (gauche : le precedent, droite : le suivant)
    const band = UH * 0.74;
    const my = band * 0.58 + 6;
    const c = this.ctx;
    if (!p.empty) {
      c.fillStyle = INK;
      for (const [x, d] of [
        [14, -1],
        [UW - 14, 1],
      ] as const) {
        // La pointe vers le bord (gauche : le precedent, droite : le suivant)
        c.beginPath();
        c.moveTo(x - d * 3, my - 6);
        c.lineTo(x + d * 4, my - 1);
        c.lineTo(x - d * 3, my + 4);
        c.closePath();
        c.fill();
      }
    }
    let size = 20;
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
      this.pill(k, i * kw + kw / 2, UH - 9, 8, k === 'EXIT', 'center');
    });
  }

  /** Un rectangle a coins arrondis (la pastille, les emplacements). */
  private box(x: number, y: number, w: number, h: number, fill: string | null, stroke: string | null, lw = 1): void {
    const c = this.ctx;
    const r = Math.min(3, w / 4, h / 4);
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

  /** La courbe du filtre (passe-bas a quatre poles, sa bosse de resonance) et la coupure qui sonne. */
  private drawFilter(x0: number, y0: number, x1: number, y1: number, v: BassValues, liveCut: number): void {
    const c = this.ctx;
    const fc = 60 * Math.pow(100, v.cutoff);
    const q = 0.6 + 7 * v.reso * v.reso;
    const xOf = (f: number): number => x0 + ((Math.log2(f) - Math.log2(30)) / (Math.log2(16000) - Math.log2(30))) * (x1 - x0);
    const dbAt = (f: number, cut: number): number => {
      const r = f / cut;
      const two = 1 / Math.sqrt((1 - r * r) ** 2 + (r / q) ** 2);
      return 20 * Math.log10(two * two) / 2;
    };
    const yOf = (db: number): number => y0 + (y1 - y0) * (0.4 - Math.max(-48, Math.min(18, db)) / 66 * 1.2);
    c.strokeStyle = FAINT;
    c.lineWidth = 0.8;
    c.beginPath();
    c.moveTo(x0, yOf(0));
    c.lineTo(x1, yOf(0));
    c.stroke();
    c.strokeStyle = INK;
    c.lineWidth = 1.8;
    c.lineCap = 'round';
    c.beginPath();
    for (let k = 0; k <= 48; k += 1) {
      const f = 30 * Math.pow(16000 / 30, k / 48);
      const y = yOf(dbAt(f, fc));
      if (k === 0) c.moveTo(xOf(f), y);
      else c.lineTo(xOf(f), y);
    }
    c.stroke();
    // La coupure qui sonne : un point sur la courbe deplacee
    if (liveCut > 0) {
      const f = Math.max(30, Math.min(16000, liveCut));
      this.circle(xOf(f), yOf(dbAt(f, liveCut)), 3.2, INK);
    }
    // En haut a droite (la ou la courbe est tombee) : le bas de l'ecran garde TOUCH: PRESETS
    this.text('FILTER', x1, y0 + 6, 6.5, HALF, 700, 'right');
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
