/**
 * Les ecrans du MM-DECKS (2026-10-04) : une seule texture canvas (un atlas)
 * pour les deux ecrans des platines, celui des effets de la table et les
 * deux ecrans ronds au centre des jogs ; un seul mesh, un draw call. Le
 * verre est noir profond, non eclaire (MeshBasicMaterial), le texte os,
 * l'accent orange ; chaque zone se redessine seule, quand son contenu
 * change.
 *
 * Platine : le titre et l'artiste (SF Pro Display), a droite le BPM, la
 * tonalite en Camelot (Mika : "je prefere 9A") et le temps restant ; en bas
 * la forme d'onde de toute la piste et la tete de lecture. Table : l'effet
 * qu'on tourne, le temps, le tempo. Jog : la position dans la piste, un
 * repere qui tourne comme la platine.
 */

import { BufferGeometry, CircleGeometry, Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeCanvasTexture } from '../scene/silk';
import { FONT_DISPLAY, FONT_MONO } from '../theme';
import { DECK, DJ_BEZEL, DJ_LIGHT, MIX, UNIT_X, type DjDeck } from './theme';

const W = 1024;
const H = 1024;
const BONE = '#F6F1E7';
const DIM = 'rgba(246, 241, 231, 0.45)';
const FAINT = 'rgba(246, 241, 231, 0.16)';

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

const deckH = Math.round((W * DECK.screen.d) / DECK.screen.w);
const fxW = 640;
const fxH = Math.round((fxW * MIX.screen.d) / MIX.screen.w);
const JOG = 256;
const REGION = {
  a: { x: 0, y: 0, w: W, h: deckH },
  b: { x: 0, y: deckH + 4, w: W, h: deckH },
  fx: { x: 0, y: 2 * deckH + 8, w: fxW, h: fxH },
  jogA: { x: 0, y: 2 * deckH + fxH + 12, w: JOG, h: JOG },
  jogB: { x: JOG + 4, y: 2 * deckH + fxH + 12, w: JOG, h: JOG },
} as const;

/** Plaque la zone r de l'atlas sur une geometrie dont les UV vont de 0 a 1. */
function mapUv(g: BufferGeometry, r: Region): BufferGeometry {
  const uv = g.getAttribute('uv');
  const u0 = r.x / W;
  const u1 = (r.x + r.w) / W;
  const v0 = 1 - (r.y + r.h) / H;
  const v1 = 1 - r.y / H;
  for (let i = 0; i < uv.count; i += 1) uv.setXY(i, u0 + uv.getX(i) * (u1 - u0), v0 + uv.getY(i) * (v1 - v0));
  return g;
}

function flat(w: number, d: number, x: number, y: number, z: number, r: Region): BufferGeometry {
  const g = new PlaneGeometry(w, d);
  mapUv(g, r);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

function disc(radius: number, x: number, y: number, z: number, r: Region, seg: number): BufferGeometry {
  const g = new CircleGeometry(radius, seg);
  mapUv(g, r);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

export interface DjDeckScreen {
  loaded: boolean;
  title: string;
  artist: string;
  bpm: number | null;
  key: string;
  /** secondes */
  position: number;
  duration: number;
  playing: boolean;
  pitch: number;
  /** la forme d'onde de toute la piste (0 a 1), ou null */
  peaks: Float32Array | null;
}

export interface DjFxScreen {
  label: string;
  time: string;
  bpm: number;
}

const deckKey = (s: DjDeckScreen): string =>
  `${s.loaded}|${s.title}|${s.artist}|${s.bpm}|${s.key}|${Math.floor(s.position * 4)}|${Math.round(s.duration)}|${s.playing}|${s.pitch.toFixed(2)}|${s.peaks ? s.peaks.length : 0}`;

const clock = (s: number): string => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export class DjScreens {
  readonly mesh: Mesh;
  readonly texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private shown = { a: '', b: '', fx: '', jogA: '', jogB: '' };
  draws = 0;

  constructor(anisotropy: number, mobile: boolean) {
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('dj: no 2d context');
    this.ctx = ctx;
    this.ctx.fillStyle = '#000';
    this.ctx.fillRect(0, 0, W, H);
    this.texture = makeCanvasTexture(this.canvas, anisotropy, false);
    const y = DJ_BEZEL.h + 0.003;
    const parts: BufferGeometry[] = [];
    for (const d of ['a', 'b'] as const) {
      parts.push(flat(DECK.screen.w, DECK.screen.d, UNIT_X[d] + DECK.screen.x, y, DECK.screen.z, REGION[d]));
      const r = d === 'a' ? REGION.jogA : REGION.jogB;
      parts.push(disc(DECK.jog.center, UNIT_X[d] + DECK.jog.x, DECK.jog.platterH + 0.004, DECK.jog.z, r, mobile ? 40 : 64));
    }
    parts.push(flat(MIX.screen.w, MIX.screen.d, UNIT_X.mix + MIX.screen.x, y, MIX.screen.z, REGION.fx));
    const g = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (!g) throw new Error('dj: screens merge failed');
    const mat = new MeshBasicMaterial({ map: this.texture, toneMapped: false });
    mat.name = 'djScreens';
    this.mesh = new Mesh(g, mat);
    this.mesh.name = 'djScreens';
  }

  /* ---------- platines ---------- */

  /** Redessine l'ecran d'une platine si son contenu a change ; true si redessine. */
  setDeck(d: DjDeck, s: DjDeckScreen): boolean {
    const k = deckKey(s);
    if (this.shown[d] === k) return false;
    this.shown[d] = k;
    this.drawDeck(REGION[d], d, s);
    this.done();
    return true;
  }

  private drawDeck(r: Region, d: DjDeck, s: DjDeckScreen): void {
    const c = this.ctx;
    c.save();
    c.beginPath();
    c.rect(r.x, r.y, r.w, r.h);
    c.clip();
    c.fillStyle = '#000';
    c.fillRect(r.x, r.y, r.w, r.h);
    const pad = 22;
    const x0 = r.x + pad;
    const x1 = r.x + r.w - pad;
    c.textBaseline = 'alphabetic';
    if (!s.loaded) {
      c.fillStyle = DIM;
      c.font = `600 30px ${FONT_DISPLAY}`;
      c.textAlign = 'left';
      c.fillText(`DECK ${d.toUpperCase()}`, x0, r.y + 52);
      c.fillStyle = BONE;
      c.font = `600 40px ${FONT_DISPLAY}`;
      c.fillText('NO TRACK', x0, r.y + 128);
      c.fillStyle = DJ_LIGHT.orange;
      c.font = `600 28px ${FONT_DISPLAY}`;
      c.fillText('PRESS LOAD', x0, r.y + 176);
    } else {
      // Titre et artiste a gauche, coupes avant la colonne des chiffres
      const colX = x1 - 300;
      c.textAlign = 'left';
      c.fillStyle = BONE;
      c.font = `600 38px ${FONT_DISPLAY}`;
      c.fillText(this.fit(s.title, colX - x0 - 20), x0, r.y + 56);
      c.fillStyle = DIM;
      c.font = `500 28px ${FONT_DISPLAY}`;
      c.fillText(this.fit(s.artist, colX - x0 - 20), x0, r.y + 96);
      // BPM (avec le pitch), tonalite, temps restant
      c.textAlign = 'right';
      c.fillStyle = BONE;
      c.font = `500 46px ${FONT_MONO}`;
      const bpm = s.bpm ? (s.bpm * (1 + s.pitch)).toFixed(1) : '--.-';
      c.fillText(bpm, x1, r.y + 58);
      c.fillStyle = DIM;
      c.font = `500 24px ${FONT_MONO}`;
      c.fillText(`BPM  ${s.key || '--'}`, x1, r.y + 94);
      c.fillStyle = s.playing ? DJ_LIGHT.yellow : BONE;
      c.font = `500 30px ${FONT_MONO}`;
      c.fillText(`-${clock(s.duration - s.position)}`, x1 - 160, r.y + 94);
    }
    // La forme d'onde de toute la piste, la tete de lecture
    const wy0 = r.y + r.h - 82;
    const wh = 56;
    c.fillStyle = FAINT;
    c.fillRect(x0, wy0 + wh / 2 - 1, x1 - x0, 2);
    if (s.loaded && s.peaks && s.peaks.length > 0) {
      const n = s.peaks.length;
      const w = x1 - x0;
      const head = s.duration > 0 ? s.position / s.duration : 0;
      for (let px = 0; px < w; px += 2) {
        const v = s.peaks[Math.min(n - 1, Math.floor((px / w) * n))];
        const h = Math.max(1, v * wh);
        c.fillStyle = px / w < head ? DIM : BONE;
        c.fillRect(x0 + px, wy0 + (wh - h) / 2, 1.5, h);
      }
      c.fillStyle = DJ_LIGHT.orange;
      c.fillRect(x0 + head * w - 1, wy0 - 6, 3, wh + 12);
    }
    c.restore();
  }

  /** Coupe un texte trop long d'un point de suspension (ASCII : trois points). */
  private fit(text: string, max: number): string {
    const c = this.ctx;
    if (c.measureText(text).width <= max) return text;
    let t = text;
    while (t.length > 1 && c.measureText(`${t}...`).width > max) t = t.slice(0, -1);
    return `${t.trimEnd()}...`;
  }

  /* ---------- table ---------- */

  setFx(s: DjFxScreen): boolean {
    const k = `${s.label}|${s.time}|${s.bpm.toFixed(1)}`;
    if (this.shown.fx === k) return false;
    this.shown.fx = k;
    const r = REGION.fx;
    const c = this.ctx;
    c.fillStyle = '#000';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.textBaseline = 'middle';
    const cy = r.y + r.h / 2;
    c.textAlign = 'left';
    c.fillStyle = BONE;
    c.font = `600 34px ${FONT_DISPLAY}`;
    c.fillText(s.label, r.x + 20, cy);
    c.textAlign = 'right';
    c.fillStyle = DJ_LIGHT.orange;
    c.font = `500 28px ${FONT_MONO}`;
    c.fillText(s.time, r.x + r.w - 190, cy);
    c.fillStyle = DIM;
    c.fillText(`${s.bpm.toFixed(1)}`, r.x + r.w - 20, cy);
    c.textBaseline = 'alphabetic';
    this.done();
    return true;
  }

  /* ---------- jogs ---------- */

  /** L'ecran rond d'un jog : la position (0 a 1) en arc, le repere qui tourne (rad). */
  setJog(d: DjDeck, progress: number, angle: number, loaded: boolean): boolean {
    const id = d === 'a' ? 'jogA' : 'jogB';
    const k = `${loaded}|${Math.round(progress * 200)}|${Math.round(angle * 40)}`;
    if (this.shown[id] === k) return false;
    this.shown[id] = k;
    const r = REGION[id];
    const c = this.ctx;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const R = r.w / 2;
    c.fillStyle = '#000';
    c.fillRect(r.x, r.y, r.w, r.h);
    // Anneau de la piste : jouee en os, restante en faible
    c.lineWidth = 10;
    c.strokeStyle = FAINT;
    c.beginPath();
    c.arc(cx, cy, R - 18, 0, Math.PI * 2);
    c.stroke();
    if (loaded) {
      c.strokeStyle = DJ_LIGHT.orange;
      c.beginPath();
      c.arc(cx, cy, R - 18, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0, Math.min(1, progress)));
      c.stroke();
      // Le repere de la platine
      c.strokeStyle = BONE;
      c.lineWidth = 8;
      c.lineCap = 'round';
      c.beginPath();
      c.moveTo(cx + Math.sin(angle) * (R - 50), cy - Math.cos(angle) * (R - 50));
      c.lineTo(cx + Math.sin(angle) * (R - 82), cy - Math.cos(angle) * (R - 82));
      c.stroke();
      c.lineCap = 'butt';
    }
    c.fillStyle = loaded ? BONE : DIM;
    c.font = `700 56px ${FONT_DISPLAY}`;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillText(d.toUpperCase(), cx, cy + 2);
    c.textBaseline = 'alphabetic';
    this.done();
    return true;
  }

  private done(): void {
    this.draws += 1;
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
