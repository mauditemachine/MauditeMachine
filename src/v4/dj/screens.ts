/**
 * Les ecrans du MM-DECKS (2026-10-04) : une seule texture canvas (un atlas)
 * pour les deux ecrans des platines, celui des effets de la table et les
 * deux ecrans ronds au centre des jogs ; un seul mesh, un draw call. Le
 * verre est noir profond, non eclaire (MeshBasicMaterial), le texte os,
 * l'accent orange ; chaque zone se redessine seule, quand son contenu
 * change.
 *
 * Platine : le titre et l'artiste (SF Pro Display), a droite le BPM, la
 * tonalite en Camelot (Mika : "je prefere 9A") et le temps restant, et les
 * touches du zoom ; les formes d'onde sont dessinees par dj/waveform.ts. Table : l'effet
 * qu'on tourne, le temps, le tempo. Jog : la position dans la piste, un
 * repere qui tourne comme la platine, SYNC au milieu.
 *
 * L'ecran de la platine a grandi (Mika, 2026-10-04 : "plus d'ecran pour
 * voir la waveform") : seules sa bande de texte et ses touches de zoom
 * passent par l'atlas, le reste est le verre noir du cadre et les formes
 * d'onde ; la texture ne grandit donc pas avec lui.
 */

import { BufferGeometry, CircleGeometry, Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeCanvasTexture } from '../scene/silk';
import { FONT_DISPLAY, FONT_MONO } from '../theme';
import { DECK, DECK_SCREEN, DJ_BEZEL, DJ_DECKS, DJ_LIGHT, MIX, UNIT_X, type DjDeck } from './theme';

const W = 1024;
/** Quatre bandes de texte de platine, leurs zooms, l'ecran des effets et quatre cadrans de jog. */
const H = 1280;
const BONE = '#F6F1E7';
const DIM = 'rgba(246, 241, 231, 0.45)';
const FAINT = 'rgba(246, 241, 231, 0.16)';

interface Region {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** La densite de l'atlas : la largeur d'un ecran de platine en px. */
const PX = W / DECK.screen.w;
const T = DECK_SCREEN;
const textH = Math.round(T.text * DECK.screen.d * PX);
const zoomW = Math.round((T.zoom.u1 - T.zoom.u0) * DECK.screen.w * PX);
const zoomH = Math.round((T.zoom.v1 - T.zoom.v0) * DECK.screen.d * PX);
const fxW = 640;
const fxH = Math.round((fxW * MIX.screen.d) / MIX.screen.w);
const JOG = 200;
const zoomY = 4 * (textH + 4);
const fxY = zoomY + zoomH + 4;
const jogY = fxY + fxH + 4;
/** La bande de texte de chaque platine, et ses touches de zoom. */
const REGION: Record<DjDeck | 'fx', Region> = {
  a: { x: 0, y: 0, w: W, h: textH },
  b: { x: 0, y: textH + 4, w: W, h: textH },
  c: { x: 0, y: 2 * (textH + 4), w: W, h: textH },
  d: { x: 0, y: 3 * (textH + 4), w: W, h: textH },
  fx: { x: 0, y: fxY, w: fxW, h: fxH },
};
const ZOOM_REGION: Record<DjDeck, Region> = {
  a: { x: 0, y: zoomY, w: zoomW, h: zoomH },
  b: { x: zoomW + 4, y: zoomY, w: zoomW, h: zoomH },
  c: { x: 2 * (zoomW + 4), y: zoomY, w: zoomW, h: zoomH },
  d: { x: 3 * (zoomW + 4), y: zoomY, w: zoomW, h: zoomH },
};
/** Un coin jamais dessine (le canvas part noir) : le verre de l'ecran, sous la bande de texte et les formes d'onde. */
const GLASS: Region = { x: W - 12, y: H - 12, w: 8, h: 8 };
const JOG_REGION: Record<DjDeck, Region> = {
  a: { x: 0, y: jogY, w: JOG, h: JOG },
  b: { x: JOG + 4, y: jogY, w: JOG, h: JOG },
  c: { x: 2 * (JOG + 4), y: jogY, w: JOG, h: JOG },
  d: { x: 3 * (JOG + 4), y: jogY, w: JOG, h: JOG },
};

/** L'ecran rond du jog, la touche SYNC : rien a suivre, calable, cale. */
export type DjSyncLight = 'off' | 'ready' | 'on';

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
  /** la fenetre de la forme d'onde fine (secondes) */
  zoom: number;
}

export interface DjFxScreen {
  label: string;
  time: string;
  bpm: number;
}

const deckKey = (s: DjDeckScreen): string =>
  `${s.loaded}|${s.title}|${s.artist}|${s.bpm}|${s.key}|${Math.floor(s.position * 4)}|${Math.round(s.duration)}|${s.playing}|${s.pitch.toFixed(2)}|${s.zoom}`;

const clock = (s: number): string => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export class DjScreens {
  readonly mesh: Mesh;
  readonly texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private shown: Record<string, string> = {};
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
    const S = DECK.screen;
    for (const d of DJ_DECKS) {
      const x0 = UNIT_X[d] + S.x - S.w / 2;
      const z0 = S.z - S.d / 2;
      // Le verre noir, un peu plus bas que le reste : entre les bandes, l'ecran reste un ecran
      parts.push(flat(S.w, S.d, x0 + S.w / 2, DJ_BEZEL.h + 0.0015, S.z, GLASS));
      // La bande de texte en haut de l'ecran, les touches du zoom en bas a droite
      parts.push(flat(S.w, T.text * S.d, x0 + S.w / 2, y, z0 + (T.text * S.d) / 2, REGION[d]));
      const zw = (T.zoom.u1 - T.zoom.u0) * S.w;
      const zd = (T.zoom.v1 - T.zoom.v0) * S.d;
      parts.push(flat(zw, zd, x0 + T.zoom.u0 * S.w + zw / 2, y, z0 + T.zoom.v0 * S.d + zd / 2, ZOOM_REGION[d]));
      parts.push(disc(DECK.jog.center, UNIT_X[d] + DECK.jog.x, DECK.jog.platterH + 0.004, DECK.jog.z, JOG_REGION[d], mobile ? 40 : 64));
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
    this.drawDeck(REGION[d], ZOOM_REGION[d], d, s);
    this.done();
    return true;
  }

  private drawDeck(r: Region, z: Region, d: DjDeck, s: DjDeckScreen): void {
    const c = this.ctx;
    c.save();
    c.beginPath();
    c.rect(r.x, r.y, r.w, r.h);
    c.clip();
    c.fillStyle = '#000';
    c.fillRect(r.x, r.y, r.w, r.h);
    const pad = 24;
    const x0 = r.x + pad;
    const x1 = r.x + r.w - pad;
    // Le texte : deux lignes, le titre et l'artiste a gauche, les chiffres a droite
    const l1 = r.y + r.h * 0.46;
    const l2 = r.y + r.h * 0.86;
    c.textBaseline = 'alphabetic';
    if (!s.loaded) {
      c.textAlign = 'left';
      c.fillStyle = BONE;
      c.font = `600 40px ${FONT_DISPLAY}`;
      c.fillText('NO TRACK', x0, l1);
      c.fillStyle = DJ_LIGHT.orange;
      c.font = `600 27px ${FONT_DISPLAY}`;
      c.fillText(`TOUCH THE SCREEN TO LOAD DECK ${d.toUpperCase()}`, x0, l2);
    } else {
      const colX = x1 - 320;
      c.textAlign = 'left';
      c.fillStyle = BONE;
      c.font = `600 38px ${FONT_DISPLAY}`;
      c.fillText(this.fit(s.title, colX - x0 - 20), x0, l1);
      c.fillStyle = DIM;
      c.font = `500 28px ${FONT_DISPLAY}`;
      c.fillText(this.fit(s.artist, colX - x0 - 20), x0, l2);
      // BPM (avec le pitch), le pitch au centieme de pour cent, la tonalite, le temps restant
      c.textAlign = 'right';
      c.fillStyle = BONE;
      c.font = `500 48px ${FONT_MONO}`;
      const bpm = s.bpm ? (s.bpm * (1 + s.pitch)).toFixed(1) : '--.-';
      c.fillText(bpm, x1, l1);
      c.fillStyle = DIM;
      c.font = `500 24px ${FONT_MONO}`;
      const pct = s.pitch * 100;
      const pitch = Math.abs(pct) < 0.005 ? '0.00%' : `${pct > 0 ? '+' : '-'}${Math.abs(pct).toFixed(2)}%`;
      c.fillText(`${pitch}   ${s.key || '--'}`, x1, l2);
      c.fillStyle = s.playing ? DJ_LIGHT.yellow : BONE;
      c.font = `500 30px ${FONT_MONO}`;
      c.fillText(`-${clock(s.duration - s.position)}`, x1 - 190, l2);
    }
    c.restore();
    // Les touches du zoom : - , la fenetre, +
    c.save();
    c.beginPath();
    c.rect(z.x, z.y, z.w, z.h);
    c.clip();
    c.fillStyle = '#000';
    c.fillRect(z.x, z.y, z.w, z.h);
    const zy = z.y + z.h / 2;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = s.loaded ? BONE : DIM;
    c.font = `600 32px ${FONT_MONO}`;
    c.fillText('-', z.x + z.w * 0.17, zy);
    c.fillText('+', z.x + z.w * 0.83, zy);
    c.fillStyle = DIM;
    c.font = `500 19px ${FONT_MONO}`;
    c.fillText(`${s.zoom}s`, z.x + z.w * 0.5, zy + 1);
    c.strokeStyle = FAINT;
    c.lineWidth = 2;
    c.strokeRect(z.x + 1, z.y + 1, z.w - 2, z.h - 2);
    c.textBaseline = 'alphabetic';
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

  /**
   * L'ecran rond d'un jog, la touche SYNC (2026-10-04) : la position (0 a 1)
   * en arc orange, le repere de la platine qui tourne (rad), et SYNC au
   * milieu : pale sans rien a suivre, en os quand on peut se caler, en
   * orange une fois cale.
   */
  setJog(d: DjDeck, progress: number, angle: number, loaded: boolean, sync: DjSyncLight): boolean {
    const id = `jog-${d}`;
    const k = `${loaded}|${Math.round(progress * 200)}|${Math.round(angle * 40)}|${sync}`;
    if (this.shown[id] === k) return false;
    this.shown[id] = k;
    const r = JOG_REGION[d];
    const c = this.ctx;
    const cx = r.x + r.w / 2;
    const cy = r.y + r.h / 2;
    const R = r.w / 2;
    c.fillStyle = '#000';
    c.fillRect(r.x, r.y, r.w, r.h);
    // Un cadran sans lettre (Mika, 2026-10-04 : "je n'aime pas le A") : soixante graduations, plus marquees au quart
    const ring = R - 12;
    for (let i = 0; i < 60; i += 1) {
      const a = (i / 60) * Math.PI * 2;
      const major = i % 15 === 0;
      const r0 = ring - (major ? 18 : 10);
      c.strokeStyle = major ? DIM : FAINT;
      c.lineWidth = major ? 3 : 1.5;
      c.beginPath();
      c.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0);
      c.lineTo(cx + Math.sin(a) * (ring - 3), cy - Math.cos(a) * (ring - 3));
      c.stroke();
    }
    c.lineWidth = 5;
    c.strokeStyle = FAINT;
    c.beginPath();
    c.arc(cx, cy, ring + 5, 0, Math.PI * 2);
    c.stroke();
    if (loaded) {
      c.strokeStyle = DJ_LIGHT.orange;
      c.lineCap = 'round';
      c.beginPath();
      c.arc(cx, cy, ring + 5, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * Math.max(0.002, Math.min(1, progress)));
      c.stroke();
      // Le repere de la platine, au bord : le milieu est a SYNC
      c.strokeStyle = BONE;
      c.lineWidth = 6;
      c.beginPath();
      c.moveTo(cx + Math.sin(angle) * (ring - 6), cy - Math.cos(angle) * (ring - 6));
      c.lineTo(cx + Math.sin(angle) * (R * 0.6), cy - Math.cos(angle) * (R * 0.6));
      c.stroke();
      c.lineCap = 'butt';
    }
    // SYNC : un disque plein en orange une fois cale, le mot en os sinon
    if (sync === 'on') {
      c.fillStyle = DJ_LIGHT.orange;
      c.beginPath();
      c.arc(cx, cy, R * 0.44, 0, Math.PI * 2);
      c.fill();
    }
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `700 30px ${FONT_DISPLAY}`;
    c.fillStyle = sync === 'on' ? '#000' : sync === 'ready' ? BONE : FAINT;
    c.fillText('SYNC', cx, cy + 1);
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
