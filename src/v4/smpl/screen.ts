/**
 * L'ecran du MM-SMPL (2026-10-04) : une texture sur le verre, redessinee
 * seulement quand quelque chose change (le sample, la region, les slices,
 * le mode, un message), et des tetes de lecture posees par-dessus (des
 * traits fins, une instance chacun : elles bougent a chaque image sans
 * rien redessiner).
 * - En haut : le nom du sample, sa duree et celle de la region ; dessous,
 *   MODE, SLICES, PITCH, REV, LOOP (allumes en orange), ou le message du
 *   moment en jaune (REC en rouge).
 * - Dessous : le sample entier en barres fines (les barres fines du
 *   MM-DECKS), la region en or, le reste en or eteint (2026-10-05) ; les slices en traits
 *   orange numerotes (le numero de leur pad) ; en GRAIN, POSITION en cyan.
 * - La sequence (2026-10-05) : des qu'elle a un pas, ou en EDIT, une bande
 *   de seize cases sous la forme d'onde (le numero de la slice de chaque
 *   pas, en orange) ; un trait or sous la case qui joue (une piece posee
 *   par-dessus, comme les tetes : rien a redessiner a chaque pas).
 * - Vide : comment poser un sample.
 */

import { Color, DynamicDrawUsage, InstancedMesh, Matrix4, Mesh, MeshBasicMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { makeCanvasTexture } from '../scene/silk';
import { FONT_DISPLAY, FONT_MONO } from '../theme';
import { DJ_BEZEL, DJ_LIGHT } from '../dj/theme';
import { pitchSemis, type SmplValues } from './params';
import { peaksOf } from './slices';
import type { SmplSeqState } from './seq';
import type { SmplState } from './state';
import { SMPL } from './theme';

const BONE = '#F6F1E7';
const DIM = 'rgba(246, 241, 231, 0.45)';
const FAINT = 'rgba(246, 241, 231, 0.16)';
const CYAN = '#5CC8FF';
/** La forme d'onde : la region en or, le reste en or eteint (2026-10-05) */
const GOLD = '#FFA600';
const GOLD_DIM = 'rgba(255, 166, 0, 0.26)';
const RED = '#FF3B30';
/** Les barres : 3 px pleins, 1 px de jour (a l'echelle de la texture) */
const BAR = { w: 3, gap: 1.5 };
/** Au plus : douze voix, trois nuages (les pads et PLAY), une marque de plus pour POSITION. */
const HEADS = 20;

const S = SMPL.screen;
const ST = SMPL.steps;
const MAT = new Matrix4();
const YELLOW = new Color(DJ_LIGHT.yellow);
const CYAN_C = new Color(CYAN);

export interface SmplLive {
  voices: ReadonlyMap<number, number>;
  clouds: ReadonlyMap<number, number>;
}

export class SmplScreen {
  readonly mesh: Mesh;
  readonly heads: InstancedMesh;
  /** le trait sous le pas qui joue (enfant de l'ecran) */
  private mark: Mesh;
  readonly texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private W: number;
  private H: number;
  private key = '';
  private peaks: { id: number; w: number; data: Float32Array } | null = null;
  private duration = 0;
  /** le bas de la forme d'onde (la bande des pas la remonte) et la bande montree */
  private waveV1: number = S.wave.v1;
  private stepsShown = false;
  private stepAt = -1;
  draws = 0;

  constructor(anisotropy: number, mobile: boolean) {
    this.W = mobile ? 1536 : 2048;
    this.H = Math.round((this.W * S.d) / S.w);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('smpl: no 2d context');
    this.ctx = ctx;
    this.texture = makeCanvasTexture(this.canvas, anisotropy, false);
    const g = new PlaneGeometry(S.w, S.d);
    g.rotateX(-Math.PI / 2);
    const mat = new MeshBasicMaterial({ map: this.texture, toneMapped: false });
    mat.name = 'smplScreen';
    this.mesh = new Mesh(g, mat);
    this.mesh.name = 'smplScreen';
    this.mesh.position.set(S.x, DJ_BEZEL.h + 0.003, S.z);
    // Les tetes : un trait de la hauteur de la forme d'onde, couleur par instance
    const hg = new PlaneGeometry(1, 1);
    hg.rotateX(-Math.PI / 2);
    const hm = new MeshBasicMaterial({ color: 0xffffff, toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false });
    hm.name = 'smplHeads';
    this.heads = new InstancedMesh(hg, hm, HEADS);
    this.heads.name = 'smplHeads';
    this.heads.instanceMatrix.setUsage(DynamicDrawUsage);
    this.heads.count = 0;
    this.heads.renderOrder = 2;
    this.heads.frustumCulled = false;
    const mg = new PlaneGeometry(1, 1);
    mg.rotateX(-Math.PI / 2);
    const mm = new MeshBasicMaterial({ color: DJ_LIGHT.yellow, toneMapped: false, transparent: true, opacity: 0.95, depthWrite: false });
    mm.name = 'smplStepMark';
    this.mark = new Mesh(mg, mm);
    this.mark.name = 'smplStepMark';
    this.mark.renderOrder = 2;
    this.mark.visible = false;
    this.mesh.add(this.mark);
  }

  /** La case d'un pas dans la bande (u de son centre, sa largeur ; fractions de la largeur). */
  private cellOf(i: number): { u: number; w: number } {
    const w = (S.wave.u1 - S.wave.u0) / 16;
    return { u: S.wave.u0 + (i + 0.5) * w, w };
  }

  /** Le trait sous le pas qui joue (-1 : aucun) ; true s'il bouge. */
  setStep(i: number): boolean {
    const show = this.stepsShown && i >= 0;
    const was = this.mark.visible;
    const moved = i !== this.stepAt;
    this.stepAt = i;
    this.mark.visible = show;
    if (show) {
      const c = this.cellOf(i);
      this.mark.scale.set(c.w * S.w * 0.84, 1, 0.022 * S.d);
      this.mark.position.set((c.u - 0.5) * S.w, 0.003, (ST.v1 + 0.017 - 0.5) * S.d);
    }
    return show !== was || (show && moved);
  }

  /** u (0 a 1 dans la largeur de l'ecran) d'un instant du sample. */
  private uOf(t: number): number {
    const d = Math.max(1e-6, this.duration);
    return S.wave.u0 + (S.wave.u1 - S.wave.u0) * Math.min(1, Math.max(0, t / d));
  }

  /** L'instant du sample a u (0 a 1 dans la largeur de l'ecran), pour les gestes. */
  timeAt(u: number): number {
    const k = (u - S.wave.u0) / (S.wave.u1 - S.wave.u0);
    return Math.min(1, Math.max(0, k)) * this.duration;
  }

  /** La prochaine image redessine tout (les polices sont arrivees). */
  invalidate(): void {
    this.key = '';
  }

  /** Redessine si l'etat a change ; true si redessine. */
  draw(s: SmplState, v: SmplValues, mono: Float32Array | null, recSeconds: number, q: SmplSeqState | null = null): boolean {
    const showSteps = !!q && (q.edit || q.steps.some((x) => x !== null));
    const key = JSON.stringify([s.sample?.id ?? 0, s.slices, s.mode, s.slicing, s.reverse, s.loop, s.message, s.recording, s.busy, v.start, v.end, v.pitch, v.position, s.recording ? Math.floor(recSeconds * 4) : 0, showSteps ? q?.steps : 0, q?.edit]);
    if (key === this.key) return false;
    this.key = key;
    this.duration = s.sample?.duration ?? 0;
    this.stepsShown = showSteps;
    this.waveV1 = showSteps ? ST.wave1 : S.wave.v1;
    this.setStep(this.stepAt);
    const c = this.ctx;
    const W = this.W;
    const H = this.H;
    c.fillStyle = '#000';
    c.fillRect(0, 0, W, H);
    const pad = W * 0.02;
    const textH = S.text * H;
    // La bande du haut
    c.textBaseline = 'middle';
    if (s.sample) {
      c.textAlign = 'left';
      c.fillStyle = BONE;
      c.font = `700 ${Math.round(textH * 0.36)}px ${FONT_DISPLAY}`;
      const name = s.sample.name.length > 46 ? `${s.sample.name.slice(0, 45)}...` : s.sample.name;
      c.fillText(name, pad, textH * 0.3);
      const reg = (v.end - v.start) * s.sample.duration;
      c.textAlign = 'right';
      c.font = `600 ${Math.round(textH * 0.3)}px ${FONT_MONO}`;
      c.fillStyle = DIM;
      c.fillText(`${reg.toFixed(2)} / ${s.sample.duration.toFixed(2)} S`, W - pad, textH * 0.3);
    } else {
      c.textAlign = 'left';
      c.fillStyle = BONE;
      c.font = `700 ${Math.round(textH * 0.36)}px ${FONT_DISPLAY}`;
      c.fillText('MM-SMPL', pad, textH * 0.3);
    }
    // La seconde ligne : les reglages, ou le message
    const y2 = textH * 0.75;
    c.textAlign = 'left';
    c.font = `600 ${Math.round(textH * 0.24)}px ${FONT_MONO}`;
    if (s.recording) {
      c.fillStyle = RED;
      c.beginPath();
      c.arc(pad + textH * 0.1, y2, textH * 0.09, 0, Math.PI * 2);
      c.fill();
      c.fillText(`REC ${recSeconds.toFixed(1)} S  PRESS REC TO STOP`, pad + textH * 0.28, y2);
    } else if (s.message) {
      c.fillStyle = DJ_LIGHT.yellow;
      c.fillText(s.message.length > 64 ? `${s.message.slice(0, 63)}...` : s.message, pad, y2);
    } else {
      const semis = pitchSemis(v.pitch);
      const n = Math.max(0, s.slices.length - 1);
      const chips: { t: string; on: boolean; hot?: boolean }[] = [
        { t: s.mode === 'grain' ? 'GRAIN' : 'SLICE', on: true, hot: true },
        { t: s.slicing === 'auto' ? `AUTO ${n}` : `SLICES ${s.slicing}`, on: true },
        { t: `PITCH ${semis > 0 ? '+' : ''}${semis}`, on: semis !== 0 },
        { t: 'REV', on: s.reverse, hot: true },
        { t: 'LOOP', on: s.loop, hot: true },
        { t: 'EDIT', on: !!q?.edit, hot: true },
      ];
      let x = pad;
      for (const ch of chips) {
        c.fillStyle = ch.on ? (ch.hot ? DJ_LIGHT.orange : BONE) : FAINT;
        c.fillText(ch.t, x, y2);
        x += c.measureText(ch.t).width + textH * 0.42;
      }
    }
    // La forme d'onde
    const x0 = S.wave.u0 * W;
    const x1 = S.wave.u1 * W;
    const y0 = S.wave.v0 * H;
    const y1 = this.waveV1 * H;
    const cy = (y0 + y1) / 2;
    const half = (y1 - y0) / 2;
    c.strokeStyle = FAINT;
    c.lineWidth = 2;
    c.beginPath();
    c.moveTo(x0, cy);
    c.lineTo(x1, cy);
    c.stroke();
    if (!s.sample || !mono) {
      c.textAlign = 'center';
      c.fillStyle = s.busy ? DJ_LIGHT.yellow : DIM;
      c.font = `600 ${Math.round(textH * 0.26)}px ${FONT_MONO}`;
      c.fillText(s.busy ? 'LOADING...' : 'PICK A FILE, OR REC THE SITE', W / 2, cy - textH * 0.32);
      c.fillStyle = FAINT;
      c.font = `500 ${Math.round(textH * 0.2)}px ${FONT_MONO}`;
      c.fillText('OR SEND A LOOP FROM THE MIXER: LOOP > SMPL', W / 2, cy + textH * 0.3);
      if (showSteps && q) this.drawSteps(q, 0);
      this.texture.needsUpdate = true;
      this.draws += 1;
      return true;
    }
    const bars = Math.max(8, Math.floor((x1 - x0) / (BAR.w + BAR.gap)));
    if (!this.peaks || this.peaks.id !== s.sample.id || this.peaks.w !== bars) this.peaks = { id: s.sample.id, w: bars, data: peaksOf(mono, 0, mono.length, bars) };
    const pk = this.peaks.data;
    // Le niveau de la plus haute crete remplit la hauteur (un sample discret se voit)
    let top = 0.05;
    for (let i = 0; i < pk.length; i += 1) top = Math.max(top, Math.abs(pk[i]));
    const ra = this.uOf(v.start * s.sample.duration) * W;
    const rb = this.uOf(v.end * s.sample.duration) * W;
    // La region : un fond a peine dore (2026-10-05, aux couleurs de la marque, comme WARM sur les platines)
    c.fillStyle = 'rgba(255, 166, 0, 0.07)';
    c.fillRect(ra, y0, rb - ra, y1 - y0);
    const step = (x1 - x0) / bars;
    for (let i = 0; i < bars; i += 1) {
      const x = x0 + i * step;
      const h = (Math.max(Math.abs(pk[i * 2]), Math.abs(pk[i * 2 + 1])) / top) * half * 0.94;
      const inside = x + BAR.w >= ra && x <= rb;
      c.fillStyle = inside ? GOLD : GOLD_DIM;
      c.fillRect(x, cy - h, BAR.w, Math.max(1, 2 * h));
    }
    // Les bornes de la region : START et END en os (elles se lisent sur l'or)
    c.fillStyle = BONE;
    for (const x of [ra, rb]) c.fillRect(x - 2, y0, 4, y1 - y0);
    // Les slices : un trait orange, le numero de son pad en haut
    c.font = `700 ${Math.round(textH * 0.2)}px ${FONT_MONO}`;
    c.textAlign = 'center';
    const n = Math.max(0, s.slices.length - 1);
    for (let i = 0; i < n; i += 1) {
      const x = this.uOf(s.slices[i]) * W;
      c.fillStyle = DJ_LIGHT.orange;
      if (i > 0) c.fillRect(x - 1.5, y0, 3, y1 - y0);
      const lab = String(i + 1);
      const tw = c.measureText(lab).width + textH * 0.12;
      c.fillRect(x, y0, tw, textH * 0.26);
      c.fillStyle = '#000';
      c.fillText(lab, x + tw / 2, y0 + textH * 0.13);
    }
    // GRAIN : POSITION en cyan, pointille
    if (s.mode === 'grain') {
      const t = (v.start + (v.end - v.start) * v.position) * s.sample.duration;
      const x = this.uOf(t) * W;
      c.strokeStyle = CYAN;
      c.lineWidth = 6;
      c.setLineDash([16, 10]);
      c.beginPath();
      c.moveTo(x, y0);
      c.lineTo(x, y1);
      c.stroke();
      c.setLineDash([]);
    }
    if (showSteps && q) this.drawSteps(q, n);
    this.texture.needsUpdate = true;
    this.draws += 1;
    return true;
  }

  /** La bande des pas : seize cases, le numero de la slice de chaque pas plein (ramene a la decoupe : n slices). */
  private drawSteps(q: SmplSeqState, n: number): void {
    const c = this.ctx;
    const W = this.W;
    const H = this.H;
    const y0 = ST.v0 * H;
    const y1 = ST.v1 * H;
    const h = y1 - y0;
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    c.font = `700 ${Math.round(h * 0.5)}px ${FONT_MONO}`;
    for (let i = 0; i < 16; i += 1) {
      const cell = this.cellOf(i);
      const cw = cell.w * W;
      const x = cell.u * W - cw / 2 + cw * 0.06;
      const w = cw * 0.88;
      const v = q.steps[i];
      if (v === null) {
        // Vide : un cadre fin, plus marque sur les temps (1, 5, 9, 13)
        c.strokeStyle = i % 4 === 0 ? 'rgba(246, 241, 231, 0.5)' : 'rgba(246, 241, 231, 0.24)';
        c.lineWidth = 2;
        c.strokeRect(x + 1, y0 + 1, w - 2, h - 2);
        continue;
      }
      c.fillStyle = DJ_LIGHT.orange;
      c.fillRect(x, y0, w, h);
      c.fillStyle = '#000';
      const k = n > 0 ? v % n : v;
      c.fillText(String(k + 1), x + w / 2, y0 + h * 0.54);
    }
  }

  /** Les tetes de lecture : une par voix (jaune) et par nuage (cyan) ; true si elles bougent. */
  setLive(live: SmplLive): boolean {
    const m = this.heads;
    let i = 0;
    const put = (t: number, color: Color, w: number): void => {
      if (i >= HEADS) return;
      const u = this.uOf(t);
      const x = S.x - S.w / 2 + u * S.w;
      const z0 = S.z - S.d / 2 + S.wave.v0 * S.d;
      const z1 = S.z - S.d / 2 + this.waveV1 * S.d;
      MAT.makeScale(w, 1, z1 - z0);
      MAT.setPosition(x, DJ_BEZEL.h + 0.006, (z0 + z1) / 2);
      m.setMatrixAt(i, MAT);
      m.setColorAt(i, color);
      i += 1;
    };
    if (this.duration > 0) {
      for (const t of live.voices.values()) put(t, YELLOW, 0.022);
      for (const t of live.clouds.values()) put(t, CYAN_C, 0.03);
    }
    const changed = i !== m.count || i > 0;
    m.count = i;
    if (i > 0) {
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    return changed;
  }

  dispose(): void {
    this.mark.geometry.dispose();
    (this.mark.material as MeshBasicMaterial).dispose();
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.heads.geometry.dispose();
    (this.heads.material as MeshBasicMaterial).dispose();
    this.heads.dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
