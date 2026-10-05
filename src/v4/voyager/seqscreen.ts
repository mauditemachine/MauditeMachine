/**
 * La suite de l'arpege dans la machine (2026-10-05, Mika : "pour les
 * boutons EDIT, j'aimerais que le contenu d'EDIT s'ouvre a l'interieur de
 * la machine, pas en dessous, dans la partie du bas, dans un design sur la
 * machine ou je peux mettre des notes"). Au desktop, EDIT range les huit
 * pads d'accords dans le plateau et fait monter a leur place un ecran (son
 * cadre noir, son verre), toute la largeur des pads :
 * - en haut, les huit accords (celui qu'on regarde en negatif ; celui qui
 *   joue souligne en jaune ; ceux de la progression marques d'un point
 *   orange : les toucher choisit l'accord dont on lit les notes), d'ou
 *   viennent les notes (FROM THE KNOBS, ou YOUR NOTES des qu'on dessine ;
 *   2026-10-05, Mika : plus de touches AUTO / EDIT dans la page, CLEAR sur la
 *   machine rend la suite des potards), STEPS - n + ;
 * - au milieu, une colonne par pas : une barre, sa hauteur sa note (une
 *   octave sous la racine a trois au-dessus) ; les notes de l'accord en or,
 *   les autres en os ; des filets aux notes de l'accord (plus forts a ses
 *   racines) ; la colonne qui joue eclairee ; on glisse pour dessiner (les
 *   pas traverses suivent la ligne, comme ui/SeqLane.tsx) ;
 * - en bas, le nom de chaque note : le toucher fait un silence, ou rend la
 *   note.
 * Memes stores que le panneau du telephone (voyager/seq.ts, arp.ts). Le
 * Stage passe les gestes (ui/Hotspots.tsx, zone 'vseq') en coordonnees de
 * l'ecran (u, v de 0 a 1).
 */

import { BoxGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { gesture } from '../actions';
import { context } from '../audio/drums';
import type { HotspotDef } from '../scene/hit';
import { albedo } from '../scene/materials';
import { makeCanvasTexture } from '../scene/silk';
import { FONT_DISPLAY, FONT_MONO, GAIN, HEX } from '../theme';
import { arp } from './arp';
import { CHORDS, chordTones, degreeName } from './chords';
import { chordType, voyParams } from './params';
import { SEQ_MAX, SEQ_MIN, SEQ_TOP, seq, type SeqStep } from './seq';
import { VOY_PAD } from './theme';

/** L'ecran : la largeur des pads (et un peu), du crochet de l'arpegiateur au bord du plateau. */
export const VOY_SEQ = (() => {
  const x0 = VOY_PAD.xs[0] - VOY_PAD.size / 2 - 0.12;
  const x1 = VOY_PAD.xs[VOY_PAD.xs.length - 1] + VOY_PAD.size / 2 + 0.12;
  const z0 = 1.74;
  const z1 = 4.02;
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w: x1 - x0, d: z1 - z0, bezel: 0.1, h: 0.025, rise: 0.22, tex: [2048, Math.round((2048 * (z1 - z0)) / (x1 - x0))] as const };
})();

const LEVELS = SEQ_TOP - SEQ_MIN + 1;
const mod7 = (d: number): number => ((d % 7) + 7) % 7;
const POLL_MS = 40;
const RISE_MS = 240;

const BONE = '#F6F1E7';
const DIM = 'rgba(246, 241, 231, 0.45)';
const FAINT = 'rgba(246, 241, 231, 0.14)';
const GOLD = '#FFA600';
const YELLOW = '#FFD60A';
const ORANGE = '#FF6A13';

/** Ce qu'un toucher vise sur l'ecran. */
type Hit = { kind: 'chord'; i: number } | { kind: 'minus' } | { kind: 'plus' } | { kind: 'lane' } | { kind: 'name'; i: number } | null;

export class VoySeqScreen {
  readonly group = new Group();
  readonly texture: CanvasTexture;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private glass: Mesh;
  private bezel: Mesh;
  private bezelMat: MeshStandardMaterial;
  private W: number;
  private H: number;
  /** la boite du haut, les colonnes, les noms (px de la texture) */
  private L: { top: number; lane0: number; lane1: number; names0: number; x0: number; x1: number; tabs: { x: number; w: number }[]; source: { x: number; w: number }; minus: { x: number; w: number }; plus: { x: number; w: number } };
  private shown = false;
  private riseFrom = 0;
  private rise = 0;
  /** l'accord qu'on a choisi de lire (null : celui qui joue, sinon le premier de la progression) */
  private view: number | null = null;
  private key = '';
  private polledAt = 0;
  private ph = { pos: -1, chord: -1 };
  /** le geste qui dessine : son pas et sa note precedents */
  private drag: { i: number; d: number } | null = null;
  /** la note d'un pas avant son silence : la rallumer la rend */
  private before: SeqStep[] = [];
  draws = 0;

  constructor(anisotropy: number) {
    const [W, H] = VOY_SEQ.tex;
    this.W = W;
    this.H = H;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('voyager: no 2d context');
    this.ctx = ctx;
    this.texture = makeCanvasTexture(this.canvas, anisotropy);
    const gg = new PlaneGeometry(VOY_SEQ.w - 2 * VOY_SEQ.bezel, VOY_SEQ.d - 2 * VOY_SEQ.bezel);
    gg.rotateX(-Math.PI / 2);
    const gm = new MeshBasicMaterial({ map: this.texture, toneMapped: false });
    gm.name = 'voySeqScreen';
    this.glass = new Mesh(gg, gm);
    this.glass.name = 'voySeqScreen';
    this.glass.position.set(VOY_SEQ.x, VOY_SEQ.h + 0.003, VOY_SEQ.z);
    const bg = new BoxGeometry(VOY_SEQ.w, VOY_SEQ.h, VOY_SEQ.d);
    bg.translate(VOY_SEQ.x, VOY_SEQ.h / 2, VOY_SEQ.z);
    this.bezelMat = new MeshStandardMaterial({ color: albedo('oled').clone().multiplyScalar(GAIN.parts), roughness: 0.4, metalness: 0 });
    this.bezelMat.name = 'voySeqBezel';
    this.bezel = new Mesh(bg, this.bezelMat);
    this.bezel.name = 'voySeqBezel';
    this.bezel.receiveShadow = true;
    this.group.name = 'voySeq';
    this.group.add(this.bezel, this.glass);
    this.group.visible = false;
    this.group.position.y = -VOY_SEQ.rise;
    // La mise en page (px de la texture)
    const pad = Math.round(W * 0.012);
    const top = Math.round(H * 0.155);
    const tabW = Math.round(W * 0.056);
    const tabs = CHORDS.map((_, i) => ({ x: pad + i * (tabW + 8), w: tabW }));
    const after = pad + CHORDS.length * (tabW + 8) + Math.round(W * 0.02);
    const modeW = Math.round(W * 0.062);
    const nudgeW = Math.round(W * 0.034);
    this.L = {
      top,
      lane0: top + Math.round(H * 0.035),
      lane1: Math.round(H * 0.82),
      names0: Math.round(H * 0.835),
      x0: pad,
      x1: W - pad,
      tabs,
      source: { x: after, w: 2 * modeW + 6 },
      minus: { x: after + 2 * modeW + 40, w: nudgeW },
      plus: { x: after + 2 * modeW + 40 + nudgeW + Math.round(W * 0.07), w: nudgeW },
    };
  }

  /** L'accord dont on lit les notes : celui qu'on a choisi, celui qui joue, le premier de la progression, F#m. */
  chord(): number {
    if (this.view !== null) return this.view;
    if (arp.get().running && this.ph.chord >= 0) return this.ph.chord;
    return arp.get().prog[0] ?? 0;
  }

  /** EDIT ouvert (desktop) : l'ecran monte ; ferme, il redescend dans le plateau. */
  setShown(on: boolean, now: number): void {
    if (on === this.shown) return;
    this.shown = on;
    this.riseFrom = now;
    if (on) {
      this.group.visible = true;
      this.key = '';
    }
  }

  get isShown(): boolean {
    return this.shown;
  }

  /** L'animateur : la montee, la tete de lecture (40 ms), le dessin ; 'paint' s'il faut une frame. */
  step(now: number): 'paint' | 'poll' | false {
    let changed = false;
    const goal = this.shown ? 1 : 0;
    if (this.rise !== goal) {
      const t = Math.min(1, (now - this.riseFrom) / RISE_MS);
      const e = 1 - Math.pow(1 - t, 3);
      this.rise = this.shown ? e : 1 - e;
      if (t >= 1) this.rise = goal;
      this.group.position.y = -VOY_SEQ.rise * (1 - this.rise);
      if (this.rise === 0) this.group.visible = false;
      changed = true;
    }
    if (!this.group.visible) return changed ? 'paint' : false;
    if (now - this.polledAt >= POLL_MS) {
      this.polledAt = now;
      const c = context();
      const e = arp.get().running && c ? arp.posAt(c.currentTime) : null;
      this.ph = { pos: e ? e.pos : -1, chord: e ? e.chord : -1 };
    }
    if (this.draw()) changed = true;
    if (changed) return 'paint';
    return arp.get().running ? 'poll' : false;
  }

  /** Redessine si quelque chose a change ; true si redessine. */
  draw(): boolean {
    const s = seq.get();
    const p = voyParams.get();
    const a = arp.get();
    const chord = this.chord();
    const steps = seq.shown(chord);
    const key = JSON.stringify([s.edit, s.len, steps, chord, this.view, a.prog, a.running, this.ph.pos, this.ph.chord, p.chord]);
    if (key === this.key) return false;
    this.key = key;
    const c = this.ctx;
    const { W, H, L } = this;
    c.fillStyle = HEX.oled;
    c.fillRect(0, 0, W, H);
    c.textBaseline = 'middle';
    // Les accords
    const ty = L.top / 2;
    c.font = `700 ${Math.round(L.top * 0.4)}px ${FONT_DISPLAY}`;
    CHORDS.forEach((ch, i) => {
      const t = L.tabs[i];
      const picked = i === chord;
      const playing = a.running && i === this.ph.chord;
      const r = 12;
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(t.x, 12, t.w, L.top - 24, r);
      else c.rect(t.x, 12, t.w, L.top - 24);
      if (picked) {
        c.fillStyle = BONE;
        c.fill();
      } else {
        c.strokeStyle = FAINT;
        c.lineWidth = 3;
        c.stroke();
      }
      c.fillStyle = picked ? '#000' : a.prog.includes(i) ? BONE : DIM;
      c.textAlign = 'center';
      c.fillText(ch.label, t.x + t.w / 2, ty + 2);
      if (a.prog.includes(i)) {
        c.fillStyle = ORANGE;
        c.beginPath();
        c.arc(t.x + t.w - 16, 24, 6, 0, Math.PI * 2);
        c.fill();
      }
      if (playing) {
        c.fillStyle = YELLOW;
        c.fillRect(t.x + 10, L.top - 8, t.w - 20, 6);
      }
    });
    // AUTO / EDIT, STEPS
    const chip = (box: { x: number; w: number }, text: string, on: boolean, hot = false): void => {
      c.beginPath();
      if (typeof c.roundRect === 'function') c.roundRect(box.x, 12, box.w, L.top - 24, 12);
      else c.rect(box.x, 12, box.w, L.top - 24);
      if (on) {
        c.fillStyle = hot ? YELLOW : BONE;
        c.fill();
      } else {
        c.strokeStyle = DIM;
        c.lineWidth = 3;
        c.stroke();
      }
      c.fillStyle = on ? '#000' : BONE;
      c.textAlign = 'center';
      c.fillText(text, box.x + box.w / 2, ty + 2);
    };
    // D'ou viennent les notes : un mot, pas une touche
    c.font = `800 ${Math.round(L.top * 0.28)}px ${FONT_DISPLAY}`;
    c.textAlign = 'center';
    c.fillStyle = s.edit ? YELLOW : DIM;
    c.fillText(s.edit ? 'YOUR NOTES' : 'FROM THE KNOBS', L.source.x + L.source.w / 2, ty + 2);
    c.font = `800 ${Math.round(L.top * 0.32)}px ${FONT_DISPLAY}`;
    chip(L.minus, '-', false);
    chip(L.plus, '+', false);
    c.fillStyle = BONE;
    c.textAlign = 'center';
    c.font = `700 ${Math.round(L.top * 0.42)}px ${FONT_MONO}`;
    const mid = (L.minus.x + L.minus.w + L.plus.x) / 2;
    c.fillText(String(steps.length), mid - 34, ty + 2);
    c.font = `700 ${Math.round(L.top * 0.22)}px ${FONT_DISPLAY}`;
    c.fillStyle = DIM;
    c.fillText('STEPS', mid + 40, ty + 2);
    c.textAlign = 'right';
    c.font = `600 ${Math.round(L.top * 0.24)}px ${FONT_MONO}`;
    c.fillText(s.edit ? 'TAP A NOTE: REST  /  CLEAR: THE KNOBS' : 'DRAG TO DRAW YOUR NOTES', L.x1, ty + 2);
    // Les colonnes
    const n = Math.max(1, steps.length);
    const cw = (L.x1 - L.x0) / SEQ_MAX;
    const lh = L.lane1 - L.lane0;
    const yOf = (d: number): number => L.lane1 - ((d - SEQ_MIN + 0.5) / LEVELS) * lh;
    // Les filets : les notes de l'accord a toutes les octaves, plus forts a ses racines
    const tones = chordTones(chord, chordType(p.chord));
    for (let o = -1; o * 7 <= SEQ_TOP; o += 1) {
      for (const t of tones) {
        const d = o * 7 + t;
        if (d < SEQ_MIN || d > SEQ_TOP) continue;
        c.fillStyle = t === 0 ? 'rgba(255, 166, 0, 0.42)' : 'rgba(255, 166, 0, 0.16)';
        c.fillRect(L.x0, Math.round(yOf(d)) - 1, L.x1 - L.x0, t === 0 ? 3 : 2);
      }
    }
    for (let i = 0; i < SEQ_MAX; i += 1) {
      const x = L.x0 + i * cw;
      const active = i < n;
      const playing = active && a.running && this.ph.pos === i;
      if (playing) {
        c.fillStyle = 'rgba(255, 214, 10, 0.14)';
        c.fillRect(x + 3, L.lane0, cw - 6, lh);
      } else if (!active) {
        // Au-dela de la suite : hachure
        c.fillStyle = 'rgba(246, 241, 231, 0.04)';
        c.fillRect(x + 3, L.lane0, cw - 6, lh);
        continue;
      } else if (i % 4 === 0) {
        c.fillStyle = 'rgba(246, 241, 231, 0.035)';
        c.fillRect(x + 3, L.lane0, cw - 6, lh);
      }
      const d = steps[i];
      if (d === null || d === undefined) {
        c.fillStyle = DIM;
        c.fillRect(x + cw * 0.3, L.lane1 - 6, cw * 0.4, 4);
        continue;
      }
      const tone = tones.includes(mod7(d));
      const y = yOf(d);
      c.fillStyle = tone ? 'rgba(255, 166, 0, 0.55)' : 'rgba(246, 241, 231, 0.32)';
      c.fillRect(x + cw * 0.14, y, cw * 0.72, L.lane1 - y);
      c.fillStyle = playing ? YELLOW : tone ? GOLD : BONE;
      c.fillRect(x + cw * 0.14, y - 4, cw * 0.72, 9);
    }
    // Les noms des notes
    c.textAlign = 'center';
    c.font = `700 ${Math.round((H - L.names0) * 0.5)}px ${FONT_DISPLAY}`;
    for (let i = 0; i < n && i < SEQ_MAX; i += 1) {
      const d = steps[i];
      const x = L.x0 + (i + 0.5) * cw;
      const playing = a.running && this.ph.pos === i;
      c.fillStyle = playing ? YELLOW : d === null ? DIM : BONE;
      c.fillText(d === null ? '-' : degreeName(chord, d), x, (L.names0 + H) / 2);
    }
    this.texture.needsUpdate = true;
    this.draws += 1;
    return true;
  }

  /* ---------- les gestes (u, v de 0 a 1 sur le verre) ---------- */

  private hit(u: number, v: number): Hit {
    const x = u * this.W;
    const y = v * this.H;
    const L = this.L;
    const inside = (b: { x: number; w: number }): boolean => x >= b.x - 6 && x <= b.x + b.w + 6;
    if (y < L.top) {
      for (let i = 0; i < L.tabs.length; i += 1) if (inside(L.tabs[i])) return { kind: 'chord', i };
      if (inside(L.minus)) return { kind: 'minus' };
      if (inside(L.plus)) return { kind: 'plus' };
      return null;
    }
    if (y >= L.names0) {
      const i = Math.floor(((x - L.x0) / (L.x1 - L.x0)) * SEQ_MAX);
      return i >= 0 && i < seq.shown(this.chord()).length ? { kind: 'name', i } : null;
    }
    return { kind: 'lane' };
  }

  /** Le pas et la note sous (u, v), dans la suite. */
  private laneAt(u: number, v: number): { i: number; d: number } {
    const L = this.L;
    const cols = Math.max(1, seq.shown(this.chord()).length);
    const x = u * this.W;
    const y = v * this.H;
    const i = Math.max(0, Math.min(cols - 1, Math.floor(((x - L.x0) / (L.x1 - L.x0)) * SEQ_MAX)));
    const d = Math.max(SEQ_MIN, Math.min(SEQ_TOP, SEQ_MIN + Math.floor(((L.lane1 - y) / (L.lane1 - L.lane0)) * LEVELS)));
    return { i, d };
  }

  private set(i: number, d: SeqStep): void {
    gesture();
    seq.setStep(this.chord(), i, d);
  }

  /** Un appui sur le verre ; true s'il commence un dessin (le Stage suit le pointeur). */
  down(u: number, v: number): boolean {
    const h = this.hit(u, v);
    if (!h) return false;
    const chord = this.chord();
    if (h.kind === 'chord') {
      this.view = this.view === h.i ? null : h.i;
      this.key = '';
    } else if (h.kind === 'minus' || h.kind === 'plus') {
      gesture();
      seq.setLen(chord, Math.min(seq.shown(chord).length, SEQ_MAX) + (h.kind === 'plus' ? 1 : -1));
    } else if (h.kind === 'name') {
      const cur = seq.shown(chord)[h.i];
      if (cur === null) this.set(h.i, this.before[h.i] ?? 0);
      else {
        this.before[h.i] = cur;
        this.set(h.i, null);
      }
    } else {
      this.drag = { i: -1, d: -1 };
      this.move(u, v);
      return true;
    }
    return false;
  }

  /** Le dessin suit le pointeur : le pas sous lui, et ceux traverses depuis le dernier (en ligne droite). */
  move(u: number, v: number): void {
    const g = this.drag;
    if (!g) return;
    const { i, d } = this.laneAt(u, v);
    if (g.i >= 0 && Math.abs(i - g.i) > 1) {
      const dir = i > g.i ? 1 : -1;
      for (let j = g.i + dir; j !== i; j += dir) this.set(j, Math.round(g.d + ((d - g.d) * (j - g.i)) / (i - g.i)));
    }
    if (g.i !== i || g.d !== d) this.set(i, d);
    this.drag = { i, d };
  }

  up(): void {
    this.drag = null;
  }

  /** Les coins du verre (repere du plateau), pour projeter un pointeur. */
  corners(): number[][] {
    const w = VOY_SEQ.w - 2 * VOY_SEQ.bezel;
    const d = VOY_SEQ.d - 2 * VOY_SEQ.bezel;
    const x0 = VOY_SEQ.x - w / 2;
    const z0 = VOY_SEQ.z - d / 2;
    const y = VOY_SEQ.h;
    return [
      [x0, y, z0],
      [x0 + w, y, z0],
      [x0 + w, y, z0 + d],
      [x0, y, z0 + d],
    ];
  }

  /** La zone de saisie (repere du plateau) : tout le cadre, active quand l'ecran est monte. */
  hotspot(layer: Group): HotspotDef {
    return { id: 'vseq', kind: 'vseq', layer, shape: 'box', x: VOY_SEQ.x, z: VOY_SEQ.z, hx: VOY_SEQ.w / 2, hz: VOY_SEQ.d / 2, y0: 0, y1: VOY_SEQ.h + 0.02, enabled: false, machine: 'voy' };
  }

  dispose(): void {
    this.glass.geometry.dispose();
    (this.glass.material as MeshBasicMaterial).dispose();
    this.bezel.geometry.dispose();
    this.bezelMat.dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
