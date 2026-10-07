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
 * Une texture sur le verre, redessinee quand quelque chose change, et a
 * chaque image tant que la basse sonne (le point du filtre, la tete).
 */

import { Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { makeCanvasTexture } from '../scene/silk';
import { DJ_BEZEL } from '../dj/theme';
import { FONT_DISPLAY, HEX } from '../theme';
import type { PresetView } from '../state/presetMode';
import { BASS_ROOTS, BASS_SCALES, BASS_STYLES, stepOf, type BassValues } from './params';
import { BASS_STEPS, type BassState } from './state';
import { BASS } from './theme';

const INK: string = HEX.bone;
const HALF: string = 'rgba(246, 241, 231, 0.5)';
const FAINT: string = 'rgba(246, 241, 231, 0.18)';
const BLACK: string = '#050506';

const font = (weight: number, size: number): string => `${weight} ${size}px ${FONT_DISPLAY}`;

/** Les pages de l'ecran (2026-10-07). */
export interface BassScreenMode {
  edit: { cur: number; next: number; chain: readonly number[]; filled: readonly boolean[] } | null;
  /** le pas dont on regle les verrous, et leur texte (CUTOFF 1.2 KHZ...) */
  lock: { step: number; items: readonly string[] } | null;
  presets: PresetView | null;
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
    const key = JSON.stringify([s.steps, s.sel, s.running, v.cutoff, v.reso, v.style, v.root, v.scale, midis, Math.round(bpm), live.step, cutK, message, info, mode]);
    if (key === this.key) return false;
    this.key = key;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = BLACK;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    if (mode.presets) this.drawPresets(mode.presets);
    else if (mode.edit) this.drawEdit(s, bpm, mode.edit, message);
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
