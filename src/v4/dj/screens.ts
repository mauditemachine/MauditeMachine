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
 *
 * 2026-10-22 (audit SB-10) : l'atlas a ses mipmaps (le texte des platines
 * crenelait, 2 texels par pixel sans eux) et 8 px entre les zones (ce que
 * les mipmaps melangent) ; les jogs, redessines a chaque image en lecture,
 * ont leur petite texture a eux (JOG_W x JOG) dans un second mesh enfant :
 * une image n'envoie plus tout l'atlas (6 Mo) a la carte graphique, 650 Ko.
 * Au telephone, l'ecran des effets a 1024 px de large (640 avant, agrandi
 * 0.72 fois, flou). Les chiffres en SF Pro a chasse fixe (tab) : FONT_MONO
 * (ui-monospace, Menlo, Consolas) changeait d'un systeme a l'autre.
 */

import { BufferGeometry, CircleGeometry, Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { makeCanvasTexture } from '../scene/silk';
import { FONT_DISPLAY, PORTRAIT } from '../theme';
import { DECK, DECK_SCREEN, DJ_BEZEL, DJ_DECKS, DJ_LIGHT, MIX, UNIT_X, type DjDeck } from './theme';

const W = 1024;
/** L'air entre deux zones de l'atlas (px) : ce que les mipmaps melangent sans deborder sur la voisine (4 avant, sans mipmaps). */
const GAP = 8;
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
const waveW = Math.round((T.wave.u1 - T.wave.u0) * DECK.screen.w * PX);
const waveH = Math.round((T.wave.v1 - T.wave.v0) * DECK.screen.d * PX);
// Au telephone 1024 (2026-10-22, audit SB-10) : l'ecran des effets y couvre 295 px CSS x 3, 640 texels l'agrandissaient
const fxW = PORTRAIT ? 1024 : 640;
const fxH = Math.round((fxW * MIX.screen.d) / MIX.screen.w);
const JOG = 200;
const zoomY = 4 * (textH + GAP);
const fxY = zoomY + zoomH + GAP;
const waveY = fxY + fxH + GAP;
/** Quatre bandes de texte de platine, leurs zooms, l'ecran des effets et les touches WAVE (les jogs ont leur texture). */
const H = Math.ceil((waveY + waveH + GAP) / 8) * 8;
/** La texture des quatre jogs (2026-10-22) : cote a cote. */
const JOG_W = 4 * JOG + 3 * GAP;
/** La bande de texte de chaque platine, et ses touches de zoom. */
const REGION: Record<DjDeck | 'fx', Region> = {
  a: { x: 0, y: 0, w: W, h: textH },
  b: { x: 0, y: textH + GAP, w: W, h: textH },
  c: { x: 0, y: 2 * (textH + GAP), w: W, h: textH },
  d: { x: 0, y: 3 * (textH + GAP), w: W, h: textH },
  fx: { x: 0, y: fxY, w: fxW, h: fxH },
};
const ZOOM_REGION: Record<DjDeck, Region> = {
  a: { x: 0, y: zoomY, w: zoomW, h: zoomH },
  b: { x: zoomW + GAP, y: zoomY, w: zoomW, h: zoomH },
  c: { x: 2 * (zoomW + GAP), y: zoomY, w: zoomW, h: zoomH },
  d: { x: 3 * (zoomW + GAP), y: zoomY, w: zoomW, h: zoomH },
};
/** La touche WAVE de chaque platine (l'affichage des formes d'onde), sous l'ecran des effets. */
const WAVE_REGION: Record<DjDeck, Region> = {
  a: { x: 0, y: waveY, w: waveW, h: waveH },
  b: { x: waveW + GAP, y: waveY, w: waveW, h: waveH },
  c: { x: 2 * (waveW + GAP), y: waveY, w: waveW, h: waveH },
  d: { x: 3 * (waveW + GAP), y: waveY, w: waveW, h: waveH },
};
/** Un coin jamais dessine (le canvas part noir) : le verre de l'ecran, sous la bande de texte et les formes d'onde. */
const GLASS: Region = { x: W - 16, y: H - 16, w: 8, h: 8 };
/** Les jogs, dans leur texture (JOG_W x JOG). */
const JOG_REGION: Record<DjDeck, Region> = {
  a: { x: 0, y: 0, w: JOG, h: JOG },
  b: { x: JOG + GAP, y: 0, w: JOG, h: JOG },
  c: { x: 2 * (JOG + GAP), y: 0, w: JOG, h: JOG },
  d: { x: 3 * (JOG + GAP), y: 0, w: JOG, h: JOG },
};

/** L'ecran rond du jog, la touche SYNC : rien a suivre, calable, cale. */
export type DjSyncLight = 'off' | 'ready' | 'on';

/** Plaque la zone r d'une texture (tw x th : l'atlas par defaut) sur une geometrie dont les UV vont de 0 a 1. */
function mapUv(g: BufferGeometry, r: Region, tw = W, th = H): BufferGeometry {
  const uv = g.getAttribute('uv');
  const u0 = r.x / tw;
  const u1 = (r.x + r.w) / tw;
  const v0 = 1 - (r.y + r.h) / th;
  const v1 = 1 - r.y / th;
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
  mapUv(g, r, JOG_W, JOG);
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
  /** l'affichage des formes d'onde (3BAND, RGB, MONO) */
  wave: string;
  /** un avis en orange a la place de l'artiste (REMOVE arme), ou '' */
  note: string;
  /** la touche BACK enfoncee (le doigt ou la souris dessus) */
  back: boolean;
}

export interface DjFxScreen {
  label: string;
  time: string;
  bpm: number;
  /** l'avis de la table (une machine baissee, coupee, filtree, le MASTER bas) : le texte en orange (2026-10-21) */
  warn?: boolean;
}

const deckKey = (s: DjDeckScreen): string =>
  `${s.loaded}|${s.title}|${s.artist}|${s.bpm}|${s.key}|${Math.floor(s.position * 4)}|${Math.round(s.duration)}|${s.playing}|${s.pitch.toFixed(6)}|${s.zoom}|${s.wave}|${s.note}|${s.back}`;

const clock = (s: number): string => {
  const t = Math.max(0, Math.floor(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, '0')}`;
};

export class DjScreens {
  readonly mesh: Mesh;
  readonly texture: CanvasTexture;
  /** les jogs (2026-10-22) : leur texture et leur mesh, enfant de mesh (meme repere) */
  readonly jogMesh: Mesh;
  readonly jogTexture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private jogCanvas: HTMLCanvasElement;
  private jctx: CanvasRenderingContext2D;
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
    this.texture = makeCanvasTexture(this.canvas, anisotropy);
    this.jogCanvas = document.createElement('canvas');
    this.jogCanvas.width = JOG_W;
    this.jogCanvas.height = JOG;
    const jctx = this.jogCanvas.getContext('2d');
    if (!jctx) throw new Error('dj: no 2d context');
    this.jctx = jctx;
    this.jctx.fillStyle = '#000';
    this.jctx.fillRect(0, 0, JOG_W, JOG);
    this.jogTexture = makeCanvasTexture(this.jogCanvas, anisotropy);
    const y = DJ_BEZEL.h + 0.003;
    const parts: BufferGeometry[] = [];
    const jogs: BufferGeometry[] = [];
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
      const ww = (T.wave.u1 - T.wave.u0) * S.w;
      const wd = (T.wave.v1 - T.wave.v0) * S.d;
      parts.push(flat(ww, wd, x0 + T.wave.u0 * S.w + ww / 2, y, z0 + T.wave.v0 * S.d + wd / 2, WAVE_REGION[d]));
      jogs.push(disc(DECK.jog.center, UNIT_X[d] + DECK.jog.x, DECK.jog.platterH + 0.004, DECK.jog.z, JOG_REGION[d], mobile ? 40 : 64));
    }
    parts.push(flat(MIX.screen.w, MIX.screen.d, UNIT_X.mix + MIX.screen.x, y, MIX.screen.z, REGION.fx));
    const g = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (!g) throw new Error('dj: screens merge failed');
    const mat = new MeshBasicMaterial({ map: this.texture, toneMapped: false });
    mat.name = 'djScreens';
    this.mesh = new Mesh(g, mat);
    this.mesh.name = 'djScreens';
    // Au telephone, la table seule (2026-10-10) : aucune platine, aucun jog ; un mesh vide garde la meme forme
    const jg = jogs.length > 0 ? mergeGeometries(jogs, false) : new BufferGeometry();
    for (const p of jogs) p.dispose();
    if (!jg) throw new Error('dj: jogs merge failed');
    const jmat = new MeshBasicMaterial({ map: this.jogTexture, toneMapped: false });
    jmat.name = 'djJogs';
    this.jogMesh = new Mesh(jg, jmat);
    this.jogMesh.name = 'djJogs';
    this.jogMesh.visible = jg.getAttribute('position') !== undefined;
    this.mesh.add(this.jogMesh);
  }

  /** Toutes les zones se redessinent au prochain set (les polices arrivees, 2026-10-22, audit SB-01). */
  invalidate(): void {
    this.shown = {};
  }

  /* ---------- platines ---------- */

  /** Redessine l'ecran d'une platine si son contenu a change ; true si redessine. */
  setDeck(d: DjDeck, s: DjDeckScreen): boolean {
    const k = deckKey(s);
    if (this.shown[d] === k) return false;
    this.shown[d] = k;
    this.drawDeck(REGION[d], ZOOM_REGION[d], WAVE_REGION[d], d, s);
    this.done();
    return true;
  }

  private drawDeck(r: Region, z: Region, wv: Region, d: DjDeck, s: DjDeckScreen): void {
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
    // Des textes nettement plus gros (Mika, 2026-10-04 : "on ne voit rien dans l'ecran")
    const l1 = r.y + r.h * 0.44;
    const l2 = r.y + r.h * 0.86;
    c.textBaseline = 'alphabetic';
    if (!s.loaded) {
      c.textAlign = 'left';
      c.fillStyle = BONE;
      c.font = `700 54px ${FONT_DISPLAY}`;
      c.fillText('NO TRACK', x0, l1);
      c.fillStyle = DJ_LIGHT.orange;
      c.font = `600 34px ${FONT_DISPLAY}`;
      c.fillText(`TOUCH THE SCREEN TO BROWSE  DECK ${d.toUpperCase()}`, x0, l2);
    } else {
      const colX = x1 - 360;
      // BACK a gauche (2026-10-08) : le titre et l'artiste passent a sa droite
      const tx = this.drawBack(r, s.back);
      c.textAlign = 'left';
      c.fillStyle = BONE;
      // Un titre long perd un peu de taille avant d'etre coupe (relecture du 2026-10-08 : la touche BACK lui prend la place de "(Original Mix)")
      const room = colX - tx - 20;
      for (const px of [52, 46, 41, 37]) {
        c.font = `700 ${px}px ${FONT_DISPLAY}`;
        if (c.measureText(s.title).width <= room) break;
      }
      c.fillText(this.fit(s.title, room), tx, l1);
      c.fillStyle = s.note ? DJ_LIGHT.orange : DIM;
      c.font = `${s.note ? 700 : 500} 36px ${FONT_DISPLAY}`;
      c.fillText(this.fit(s.note || s.artist, colX - tx - 20), tx, l2);
      // BPM au centieme (2026-10-05 : caler un tempo exact), le pitch au centieme de pour cent, la tonalite, le temps restant
      c.fillStyle = BONE;
      c.font = `600 64px ${FONT_DISPLAY}`;
      const bpm = s.bpm ? (s.bpm * (1 + s.pitch)).toFixed(2) : '--.--';
      this.tab(c, bpm, x1, l1, 'right');
      c.fillStyle = DIM;
      c.font = `500 30px ${FONT_DISPLAY}`;
      const pct = s.pitch * 100;
      const pitch = Math.abs(pct) < 0.005 ? '0.00%' : `${pct > 0 ? '+' : '-'}${Math.abs(pct).toFixed(2)}%`;
      this.tab(c, `${pitch}   ${s.key || '--'}`, x1, l2, 'right');
      c.fillStyle = s.playing ? DJ_LIGHT.yellow : BONE;
      c.font = `600 38px ${FONT_DISPLAY}`;
      this.tab(c, `-${clock(s.duration - s.position)}`, x1 - 230, l2, 'right');
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
    // - et + traces (2026-10-22) : le trait d'union de SF Pro est court et haut ; un trait au milieu de sa case
    c.strokeStyle = s.loaded ? BONE : DIM;
    c.lineWidth = 4;
    c.lineCap = 'round';
    const a = 9;
    c.beginPath();
    c.moveTo(z.x + z.w * 0.17 - a, zy);
    c.lineTo(z.x + z.w * 0.17 + a, zy);
    c.moveTo(z.x + z.w * 0.83 - a, zy);
    c.lineTo(z.x + z.w * 0.83 + a, zy);
    c.moveTo(z.x + z.w * 0.83, zy - a);
    c.lineTo(z.x + z.w * 0.83, zy + a);
    c.stroke();
    c.lineCap = 'butt';
    c.fillStyle = DIM;
    c.font = `600 24px ${FONT_DISPLAY}`;
    // La fenetre : au dixieme sous 10 s (2.5S), en entier au-dela ; 2.49S debordait sur - et +
    this.tab(c, `${s.zoom >= 10 ? Math.round(s.zoom) : Math.round(s.zoom * 10) / 10}s`, z.x + z.w * 0.5, zy + 1, 'center');
    c.strokeStyle = FAINT;
    c.lineWidth = 2;
    c.strokeRect(z.x + 1, z.y + 1, z.w - 2, z.h - 2);
    c.textBaseline = 'alphabetic';
    c.restore();
    // WAVE : son nom en petit, l'affichage du moment dessous ; toucher passe au suivant
    c.save();
    c.beginPath();
    c.rect(wv.x, wv.y, wv.w, wv.h);
    c.clip();
    c.fillStyle = '#000';
    c.fillRect(wv.x, wv.y, wv.w, wv.h);
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.fillStyle = DIM;
    c.font = `600 20px ${FONT_DISPLAY}`;
    c.fillText('WAVE', wv.x + wv.w / 2, wv.y + wv.h * 0.3);
    c.fillStyle = s.loaded ? DJ_LIGHT.orange : DIM;
    c.font = `700 ${s.wave.length > 4 ? 25 : 30}px ${FONT_DISPLAY}`;
    c.fillText(s.wave, wv.x + wv.w / 2, wv.y + wv.h * 0.64);
    c.strokeStyle = FAINT;
    c.lineWidth = 2;
    c.strokeRect(wv.x + 1, wv.y + 1, wv.w - 2, wv.h - 2);
    c.textBaseline = 'alphabetic';
    c.restore();
  }

  /**
   * La touche BACK (2026-10-08, Mika : "je devrais aussi avoir un bouton
   * retour arriere pour aller choisir une autre track") : en haut a gauche
   * de l'ecran, un chevron orange et TRACKS, dans un cadre fin comme les
   * touches du zoom ; enfoncee, elle s'allume en orange. Elle ouvre la liste
   * de la platine, le morceau continue de jouer (dj/gestures.ts). Rend le x
   * ou commence le texte, a sa droite.
   */
  private drawBack(r: Region, down: boolean): number {
    const c = this.ctx;
    const right = r.x + Math.round(DECK_SCREEN.back.u1 * r.w);
    const x = r.x + 14;
    const y = r.y + 16;
    const w = right - 8 - x;
    const h = r.h - 32;
    const rad = 16;
    c.beginPath();
    c.moveTo(x + rad, y);
    c.arcTo(x + w, y, x + w, y + h, rad);
    c.arcTo(x + w, y + h, x, y + h, rad);
    c.arcTo(x, y + h, x, y, rad);
    c.arcTo(x, y, x + w, y, rad);
    c.closePath();
    c.fillStyle = down ? DJ_LIGHT.orange : 'rgba(246, 241, 231, 0.07)';
    c.fill();
    c.lineWidth = 2;
    c.strokeStyle = down ? DJ_LIGHT.orange : 'rgba(246, 241, 231, 0.3)';
    c.stroke();
    // Le chevron, trait rond
    const cx = x + w / 2;
    const cy = y + h * 0.38;
    const k = h * 0.15;
    c.lineWidth = 8;
    c.lineCap = 'round';
    c.lineJoin = 'round';
    c.strokeStyle = down ? '#000' : DJ_LIGHT.orange;
    c.beginPath();
    c.moveTo(cx + k * 0.55, cy - k);
    c.lineTo(cx - k * 0.55, cy);
    c.lineTo(cx + k * 0.55, cy + k);
    c.stroke();
    c.lineCap = 'butt';
    c.lineJoin = 'miter';
    c.textAlign = 'center';
    c.fillStyle = down ? '#000' : BONE;
    c.font = `700 25px ${FONT_DISPLAY}`;
    c.fillText('TRACKS', cx, y + h * 0.83);
    return right + 14;
  }

  /**
   * Un texte aux chiffres a chasse fixe (2026-10-22, audit SB-15) : chaque chiffre au milieu d'une case de la largeur de
   * "0", le reste a sa largeur ; la valeur qui change ne fait plus danser ses voisines, en SF Pro (FONT_MONO n'est pas
   * auto-hebergee : Menlo, Consolas ou une autre selon le systeme). Rend sa largeur.
   */
  private tab(c: CanvasRenderingContext2D, text: string, x: number, y: number, align: 'left' | 'right' | 'center'): number {
    const cell = c.measureText('0').width;
    const adv = (ch: string): number => (ch >= '0' && ch <= '9' ? cell : c.measureText(ch).width);
    let w = 0;
    for (const ch of text) w += adv(ch);
    let cx = align === 'right' ? x - w : align === 'center' ? x - w / 2 : x;
    const keep = c.textAlign;
    c.textAlign = 'center';
    for (const ch of text) {
      const k = adv(ch);
      if (ch !== ' ') c.fillText(ch, cx + k / 2, y);
      cx += k;
    }
    c.textAlign = keep;
    return w;
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
    const key = `${s.label}|${s.time}|${s.bpm.toFixed(1)}|${s.warn === true}`;
    if (this.shown.fx === key) return false;
    this.shown.fx = key;
    const r = REGION.fx;
    const c = this.ctx;
    c.fillStyle = '#000';
    c.fillRect(r.x, r.y, r.w, r.h);
    c.textBaseline = 'middle';
    const cy = r.y + r.h / 2;
    // Les valeurs nommees (2026-10-22, audit SB-15 : EFFECTS 1 120.0 ne disait pas ce qu'il montrait) : TIME 1/4 en orange,
    // 130.0 BPM ; les corps a l'echelle de la zone (1024 px de large au telephone)
    const k = r.w / 640;
    const pad = 20 * k;
    let x = r.x + r.w - pad;
    c.textAlign = 'right';
    c.fillStyle = DIM;
    c.font = `600 ${Math.round(19 * k)}px ${FONT_DISPLAY}`;
    x -= c.measureText('BPM').width;
    c.fillText('BPM', x + c.measureText('BPM').width, cy + 1);
    c.fillStyle = BONE;
    c.font = `500 ${Math.round(30 * k)}px ${FONT_DISPLAY}`;
    x -= 7 * k + this.tab(c, s.bpm.toFixed(1), x - 7 * k, cy, 'right');
    x -= 24 * k;
    c.fillStyle = DJ_LIGHT.orange;
    c.font = `600 ${Math.round(30 * k)}px ${FONT_DISPLAY}`;
    x -= this.tab(c, s.time, x, cy, 'right');
    c.fillStyle = DIM;
    c.font = `600 ${Math.round(19 * k)}px ${FONT_DISPLAY}`;
    c.textAlign = 'right';
    c.fillText('TIME', x - 7 * k, cy + 1);
    x -= 7 * k + c.measureText('TIME').width;
    c.textAlign = 'left';
    c.fillStyle = s.warn ? DJ_LIGHT.orange : BONE;
    c.font = `600 ${Math.round(34 * k)}px ${FONT_DISPLAY}`;
    c.fillText(this.fit(s.label, x - r.x - pad - 16 * k), r.x + pad, cy);
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
  /**
   * phaseMs : l'ecart de phase avec la reference (ms, positif : en retard ;
   * dj/actions.ts phaseLock), ou null sans verrou (la platine n'est pas
   * calee, ou ne joue pas).
   */
  setJog(d: DjDeck, progress: number, angle: number, loaded: boolean, sync: DjSyncLight, phaseMs: number | null = null): boolean {
    const id = `jog-${d}`;
    const k = `${loaded}|${Math.round(progress * 200)}|${Math.round(angle * 40)}|${sync}|${phaseMs === null ? '-' : Math.round(phaseMs * 2)}`;
    if (this.shown[id] === k) return false;
    this.shown[id] = k;
    const r = JOG_REGION[d];
    const c = this.jctx;
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
    c.fillText('SYNC', cx, phaseMs === null ? cy + 1 : cy - 10);
    if (phaseMs !== null) this.drawPhase(cx, cy + 22, R * 0.34, phaseMs, sync === 'on');
    c.textBaseline = 'alphabetic';
    this.draws += 1;
    this.jogTexture.needsUpdate = true;
    return true;
  }

  /**
   * L'ecart de phase sous SYNC (relecture du 2026-10-08, Mika : "je pense
   * qu'il faut analyser la track pour que ca fonctionne") : voir que SYNC
   * tient. Un trait, son milieu marque, un point qui s'en ecarte avec
   * l'ecart (12 ms au bord, la fleche au-dela) ; au milieu, les temps
   * tombent ensemble. Redessine avec le jog, qui l'est deja a chaque image
   * en lecture : rien de plus a envoyer.
   */
  private drawPhase(cx: number, y: number, half: number, ms: number, on: boolean): void {
    const c = this.jctx;
    const ink = on ? '#000' : BONE;
    c.strokeStyle = on ? 'rgba(0, 0, 0, 0.55)' : DIM;
    c.lineWidth = 4;
    c.lineCap = 'round';
    c.beginPath();
    c.moveTo(cx - half, y);
    c.lineTo(cx + half, y);
    c.moveTo(cx, y - 8);
    c.lineTo(cx, y + 8);
    c.stroke();
    c.lineCap = 'butt';
    const k = Math.max(-1, Math.min(1, ms / 12));
    const x = cx + k * half;
    c.fillStyle = ink;
    c.beginPath();
    if (Math.abs(ms) > 12) {
      // Hors d'echelle : une pointe vers le cote ou elle va
      const dir = Math.sign(ms);
      c.moveTo(x + dir * 9, y);
      c.lineTo(x - dir * 5, y - 9);
      c.lineTo(x - dir * 5, y + 9);
      c.closePath();
    } else c.arc(x, y, 8, 0, Math.PI * 2);
    c.fill();
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
    this.jogMesh.geometry.dispose();
    (this.jogMesh.material as MeshBasicMaterial).dispose();
    this.jogTexture.dispose();
    this.jogCanvas.width = 0;
    this.jogCanvas.height = 0;
  }
}
