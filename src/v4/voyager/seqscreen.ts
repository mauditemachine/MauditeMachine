/**
 * La suite de l'arpege dans la machine (2026-10-05, Mika : "pour les
 * boutons EDIT, j'aimerais que le contenu d'EDIT s'ouvre a l'interieur de
 * la machine, pas en dessous, dans la partie du bas, dans un design sur la
 * machine ou je peux mettre des notes"). Au desktop, EDIT range les huit
 * pads d'accords dans le plateau et fait monter a leur place un ecran (son
 * cadre noir, son verre).
 *
 * Refait le 2026-10-08 avec le grand ecran (voyager/screen.ts) : la meme
 * langue, facon OP-1, noir et os en trois intensites (plus d'or, de jaune
 * ni d'orange), et toute la largeur du plateau sous l'ecran et ses deux
 * blocs (les pads, plus minces, laissent une bande plus basse : les
 * accords passent dans une colonne a gauche pour garder la hauteur des
 * notes) :
 * - a gauche, les huit accords en deux rangees (celui qu'on regarde en
 *   negatif ; celui qui joue souligne ; ceux de la progression marques d'un
 *   point : les toucher choisit l'accord dont on lit les notes), d'ou
 *   viennent les notes (FROM THE KNOBS, ou YOUR NOTES des qu'on dessine ;
 *   2026-10-05, Mika : CLEAR sur la machine rend la suite des potards),
 *   STEPS - n + ;
 * - a droite, une colonne par pas : une barre, sa hauteur sa note (une
 *   octave sous la racine a trois au-dessus) ; les notes de l'accord en os
 *   plein, les autres en demi-teinte ; des filets aux notes de l'accord
 *   (plus forts a ses racines) ; la colonne qui joue eclairee ; on glisse
 *   pour dessiner (les pas traverses suivent la ligne, comme ui/SeqLane.tsx) ;
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
import { FONT_DISPLAY, GAIN, HEX } from '../theme';
import { arp } from './arp';
import { CHORDS, chordTones, degreeName } from './chords';
import { chordType, voyParams } from './params';
import { SEQ_MAX, SEQ_MIN, SEQ_TOP, seq, type SeqStep } from './seq';
import { VOY_BODY, VOY_LCD, VOY_LID_W } from './theme';

/**
 * L'ecran : toute la largeur du plateau (le capot, moins un jour), du bas du
 * cadre du grand ecran (un jour de 0.06) au bord avant (de meme). 2026-10-05
 * a 2026-10-08 : la largeur des pads, z 1.74 a 4.02 ; avec le grand ecran,
 * z 2.67 a 4.21, puis (revue du 2026-10-08 : les notes se visaient moins
 * bien, 0.031 de hauteur par degre contre 0.041 avant) au plus haut et au
 * plus bas que le plateau permet, z 2.64 a 4.24.
 */
export const VOY_SEQ = (() => {
  const x1 = VOY_LID_W / 2 - 0.16;
  const x0 = -x1;
  const z0 = VOY_LCD.z + VOY_LCD.bezel.d / 2 + 0.06;
  const z1 = VOY_BODY.d / 2 - 0.06;
  const w = x1 - x0;
  const d = z1 - z0;
  return { x: (x0 + x1) / 2, z: (z0 + z1) / 2, w, d, bezel: 0.09, h: 0.025, rise: 0.22, tex: [2048, Math.round((2048 * (d - 0.18)) / (w - 0.18))] as const };
})();

const LEVELS = SEQ_TOP - SEQ_MIN + 1;
const mod7 = (d: number): number => ((d % 7) + 7) % 7;
const POLL_MS = 40;
const RISE_MS = 240;
/**
 * Un dessin garde sa note tant que le pointeur reste a moins de HYST degre
 * au-dela de ses bords (revue du 2026-10-08) : a la frontiere de deux notes,
 * le doigt ou la souris qui tremble ne fait plus sauter la note.
 */
const HYST = 0.3;

const INK: string = HEX.bone;
const HALF = 'rgba(246, 241, 231, 0.5)';
const FAINT = 'rgba(246, 241, 231, 0.16)';
const BLACK = '#050506';

/** Ce qu'un toucher vise sur l'ecran. */
type Hit = { kind: 'chord'; i: number } | { kind: 'minus' } | { kind: 'plus' } | { kind: 'lane' } | { kind: 'name'; i: number } | null;

interface Box {
  x: number;
  y: number;
  w: number;
  h: number;
}

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
  /** la colonne de gauche (accords, STEPS) et la zone des pas (px de la texture) */
  private L: { panel: number; tabs: Box[]; source: { x: number; y: number }; minus: Box; plus: Box; count: { x: number; y: number }; x0: number; x1: number; lane0: number; lane1: number; names0: number };
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
  /** l'accord lu change (un onglet touche) : le rig redessine le grand ecran (rig.ts) */
  onView: (() => void) | null = null;
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
    // La mise en page (px de la texture) : la colonne de gauche (un sixieme), les pas a droite
    // La colonne : les accords en haut (deux rangees), d'ou viennent les notes au milieu, STEPS - n + en bas
    // Les pas (revue du 2026-10-08) : de 3.5 % a 83.5 % de la hauteur (7 % a 80 % avant), les noms sur les 15 % du bas
    const pad = Math.round(H * 0.07);
    const panel = Math.round(W * 0.17);
    const tw = Math.floor((panel - 2 * pad - 3 * 8) / 4);
    const th = Math.round(H * 0.21);
    const tabs = CHORDS.map((_, i) => ({ x: pad + (i % 4) * (tw + 8), y: pad + Math.floor(i / 4) * (th + 8), w: tw, h: th }));
    const kh = Math.round(H * 0.2);
    const ky = H - pad - kh;
    const kw = Math.round(kh * 1.25);
    this.L = {
      panel,
      tabs,
      source: { x: panel / 2, y: Math.round((pad + 2 * (th + 8) + ky) / 2 + H * 0.03) },
      minus: { x: pad, y: ky, w: kw, h: kh },
      plus: { x: panel - pad - kw, y: ky, w: kw, h: kh },
      count: { x: panel / 2, y: ky + kh / 2 },
      x0: panel + pad,
      x1: W - pad,
      lane0: Math.round(H * 0.035),
      lane1: Math.round(H * 0.835),
      names0: Math.round(H * 0.85),
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

  private box(b: Box, fill: string | null, stroke: string | null, lw = 3, r = 12): void {
    const c = this.ctx;
    c.beginPath();
    if (typeof c.roundRect === 'function') c.roundRect(b.x, b.y, b.w, b.h, r);
    else c.rect(b.x, b.y, b.w, b.h);
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
    c.fillStyle = BLACK;
    c.fillRect(0, 0, W, H);
    c.textBaseline = 'middle';
    // La colonne de gauche : les accords
    CHORDS.forEach((ch, i) => {
      const t = L.tabs[i];
      const picked = i === chord;
      const inProg = a.prog.includes(i);
      const playing = a.running && i === this.ph.chord;
      if (picked) this.box(t, INK, null);
      else this.box(t, null, inProg ? HALF : FAINT, 2.5);
      c.font = `700 ${Math.round(t.h * 0.42)}px ${FONT_DISPLAY}`;
      c.textAlign = 'center';
      c.fillStyle = picked ? BLACK : inProg ? INK : HALF;
      c.fillText(ch.label, t.x + t.w / 2, t.y + t.h / 2 + 1);
      if (inProg) {
        c.fillStyle = picked ? BLACK : INK;
        c.beginPath();
        c.arc(t.x + t.w - 11, t.y + 11, 4.5, 0, Math.PI * 2);
        c.fill();
      }
      if (playing) {
        c.fillStyle = picked ? BLACK : INK;
        c.fillRect(t.x + 10, t.y + t.h - 9, t.w - 20, 4);
      }
    });
    // STEPS - n +
    c.font = `800 ${Math.round(L.minus.h * 0.55)}px ${FONT_DISPLAY}`;
    for (const [b, t] of [
      [L.minus, '-'],
      [L.plus, '+'],
    ] as const) {
      this.box(b, null, HALF, 2.5, b.h / 2);
      c.fillStyle = INK;
      c.textAlign = 'center';
      c.fillText(t, b.x + b.w / 2, b.y + b.h / 2 + 1);
    }
    c.fillStyle = INK;
    c.textAlign = 'center';
    c.font = `300 ${Math.round(L.minus.h * 0.72)}px ${FONT_DISPLAY}`;
    c.fillText(String(steps.length), L.count.x, L.count.y - L.minus.h * 0.08);
    c.font = `700 ${Math.round(L.minus.h * 0.22)}px ${FONT_DISPLAY}`;
    c.fillStyle = HALF;
    c.fillText('STEPS', L.count.x, L.count.y + L.minus.h * 0.38);
    // D'ou viennent les notes : un mot, pas une touche
    c.textAlign = 'center';
    c.textBaseline = 'alphabetic';
    c.font = `800 ${Math.round(H * 0.075)}px ${FONT_DISPLAY}`;
    c.fillStyle = s.edit ? INK : HALF;
    c.fillText(s.edit ? 'YOUR NOTES' : 'FROM THE KNOBS', L.source.x, L.source.y);
    c.textBaseline = 'middle';
    // Le filet entre la colonne et les pas
    c.fillStyle = FAINT;
    c.fillRect(L.panel, 10, 2, H - 20);
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
        c.fillStyle = t === 0 ? 'rgba(246, 241, 231, 0.3)' : 'rgba(246, 241, 231, 0.1)';
        c.fillRect(L.x0, Math.round(yOf(d)) - 1, L.x1 - L.x0, t === 0 ? 3 : 2);
      }
    }
    for (let i = 0; i < SEQ_MAX; i += 1) {
      const x = L.x0 + i * cw;
      const active = i < n;
      const playing = active && a.running && this.ph.pos === i;
      if (playing) {
        c.fillStyle = 'rgba(246, 241, 231, 0.13)';
        c.fillRect(x + 3, L.lane0, cw - 6, lh);
      } else if (!active) {
        // Au-dela de la suite : a peine
        c.fillStyle = 'rgba(246, 241, 231, 0.035)';
        c.fillRect(x + 3, L.lane0, cw - 6, lh);
        continue;
      } else if (i % 4 === 0) {
        c.fillStyle = 'rgba(246, 241, 231, 0.03)';
        c.fillRect(x + 3, L.lane0, cw - 6, lh);
      }
      const d = steps[i];
      if (d === null || d === undefined) {
        c.fillStyle = HALF;
        c.fillRect(x + cw * 0.36, L.lane1 - 6, cw * 0.28, 4);
        continue;
      }
      const tone = tones.includes(mod7(d));
      const y = yOf(d);
      c.fillStyle = tone ? 'rgba(246, 241, 231, 0.26)' : 'rgba(246, 241, 231, 0.1)';
      c.fillRect(x + cw * 0.16, y, cw * 0.68, L.lane1 - y);
      c.fillStyle = playing || tone ? INK : HALF;
      c.fillRect(x + cw * 0.16, y - 4, cw * 0.68, 9);
    }
    // Les noms des notes
    c.textAlign = 'center';
    c.font = `700 ${Math.round((H - L.names0) * 0.6)}px ${FONT_DISPLAY}`;
    for (let i = 0; i < n && i < SEQ_MAX; i += 1) {
      const d = steps[i];
      const x = L.x0 + (i + 0.5) * cw;
      const playing = a.running && this.ph.pos === i;
      c.fillStyle = playing ? INK : d === null ? FAINT : HALF;
      c.fillText(d === null ? '-' : degreeName(chord, d), x, (L.names0 + H) / 2);
      if (playing) c.fillRect(x - cw * 0.25, H - 7, cw * 0.5, 3);
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
    const inside = (b: Box): boolean => x >= b.x - 6 && x <= b.x + b.w + 6 && y >= b.y - 6 && y <= b.y + b.h + 6;
    if (x < L.panel) {
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

  /** Le pas et la note sous (u, v), dans la suite ; lv : la hauteur continue, en degres (le bas de SEQ_MIN a SEQ_MIN). */
  private laneAt(u: number, v: number): { i: number; d: number; lv: number } {
    const L = this.L;
    const cols = Math.max(1, seq.shown(this.chord()).length);
    const x = u * this.W;
    const y = v * this.H;
    const i = Math.max(0, Math.min(cols - 1, Math.floor(((x - L.x0) / (L.x1 - L.x0)) * SEQ_MAX)));
    const lv = SEQ_MIN + ((L.lane1 - y) / (L.lane1 - L.lane0)) * LEVELS;
    const d = Math.max(SEQ_MIN, Math.min(SEQ_TOP, Math.floor(lv)));
    return { i, d, lv };
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
      this.onView?.();
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
    const at = this.laneAt(u, v);
    const i = at.i;
    // Sur le meme pas, la note tenue reste tant qu'on ne passe pas franchement dans la voisine
    const d = g.i === i && g.d >= SEQ_MIN && at.lv >= g.d - HYST && at.lv < g.d + 1 + HYST ? g.d : at.d;
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
