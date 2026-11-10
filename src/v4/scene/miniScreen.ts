/**
 * Le mini ecran du plugin (2026-11-10, Mika : "Logo -> infos live" et "VU-metres") : un petit OLED noir et blanc a la place du
 * logo M, en haut du cadre du crossfader (rytm/faceplate.ts PLUGIN_MINI). Il montre :
 * - le pattern qui joue (A01), PLAY ou STOP, le suivant s'il y en a un (-> A02) ;
 * - les 16 pas, la tete de lecture et les pas poses (toutes pistes) ;
 * - le niveau reel de chaque piste (plugin/meters.ts, le moteur C++), un pic tenu ;
 * - ce que changent les scenes A et B (le nombre de reglages de chacune), la position du crossfader ;
 * - la sortie L et R, rouge au-dessus de -0.5 dB.
 * Repeint seulement quand ce qu'il montre change (une signature) ou que les niveaux bougent, 30 fois par seconde au plus.
 */

import { BoxGeometry, CanvasTexture, Group, LinearFilter, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, SRGBColorSpace } from 'three';
import { PLUGIN_MINI, fpU, fpX, fpZ } from '../rytm/faceplate';
import { FONT_DISPLAY } from '../theme';
import { pattern } from '../audio/pattern';
import { TRACK_KEYS } from '../audio/tracks';
import { patterns, slotName } from '../state/patterns';
import { sceneCtl } from '../state/sceneCtl';
import { extHead } from '../plugin/head';
import { meters } from '../plugin/meters';

/** px du canvas par mm de la face */
const PPMM = 16;
const BEZEL_MM = 1.0;
const SCREEN_Y = 0.0215;
const MIN_FRAME_MS = 33;

const INK = '#F4F1EA';
const DIM = 'rgba(244, 241, 234, 0.22)';
const MID = 'rgba(244, 241, 234, 0.5)';
const RED = '#FF3B30';

export class MiniScreen {
  readonly group = new Group();
  private readonly canvas: HTMLCanvasElement;
  private readonly ctx: CanvasRenderingContext2D;
  private readonly texture: CanvasTexture;
  private readonly W: number;
  private readonly H: number;
  private sig = '';
  private lastDraw = 0;
  private wasLive = false;

  constructor() {
    const R = PLUGIN_MINI ?? { x: 0, y: 0, w: 10, h: 2 };
    this.W = Math.round(R.w * PPMM);
    this.H = Math.round(R.h * PPMM);
    this.canvas = document.createElement('canvas');
    this.canvas.width = this.W;
    this.canvas.height = this.H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('miniScreen: no 2d context');
    this.ctx = ctx;
    this.texture = new CanvasTexture(this.canvas);
    this.texture.colorSpace = SRGBColorSpace;
    this.texture.generateMipmaps = false;
    this.texture.minFilter = LinearFilter;
    this.texture.magFilter = LinearFilter;
    const cx = fpX(R.x + R.w / 2);
    const cz = fpZ(R.y + R.h / 2);
    // Le cadre : le meme noir que celui de l'ecran (un pave bas, mat)
    const bezel = new Mesh(new BoxGeometry(fpU(R.w + 2 * BEZEL_MM), 0.02, fpU(R.h + 2 * BEZEL_MM)), new MeshStandardMaterial({ color: 0x050506, roughness: 0.35, metalness: 0 }));
    bezel.name = 'miniScreenBezel';
    bezel.position.set(cx, 0.01, cz);
    bezel.receiveShadow = true;
    // L'OLED : sans lumiere (il emet), au-dessus du cadre
    const geo = new PlaneGeometry(fpU(R.w), fpU(R.h));
    geo.rotateX(-Math.PI / 2);
    const glass = new Mesh(geo, new MeshBasicMaterial({ map: this.texture, toneMapped: false }));
    glass.name = 'miniScreen';
    glass.position.set(cx, SCREEN_Y, cz);
    this.group.add(bezel, glass);
    this.group.name = 'miniScreenGroup';
    this.draw(performance.now(), true);
  }

  /** Une frame : 'paint' si l'ecran a change, 'poll' tant que les niveaux descendent encore, false au repos. */
  step(now: number): 'paint' | 'poll' | false {
    const st = patterns.get();
    const head = extHead.get();
    const sc = pattern.scenes.get();
    const steps = pattern.get().steps as Record<string, string | undefined>;
    let set = '';
    for (const k of TRACK_KEYS) set += steps[k] ?? '';
    const sig = `${st.cur}|${st.next}|${head ? head.step : -1}|${Object.keys(sc.a).length}|${Object.keys(sc.b).length}|${sceneCtl.x().toFixed(3)}|${set}`;
    const mv = meters.view(now);
    const live = mv.live;
    if (sig === this.sig && !live && !this.wasLive) return false;
    if (sig === this.sig && now - this.lastDraw < MIN_FRAME_MS) return 'poll';
    this.sig = sig;
    this.wasLive = live;
    this.draw(now, false);
    return 'paint';
  }

  private draw(now: number, first: boolean): void {
    const g = this.ctx;
    const W = this.W;
    const H = this.H;
    this.lastDraw = now;
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    if (first) {
      this.texture.needsUpdate = true;
      return;
    }
    const st = patterns.get();
    const head = extHead.get();
    const playing = head !== null;
    const mv = meters.view(now);

    // 1) Le pattern, PLAY ou STOP, le suivant
    g.fillStyle = INK;
    g.textBaseline = 'alphabetic';
    g.font = `700 78px ${FONT_DISPLAY}`;
    g.fillText(slotName(st.cur), 14, 90);
    g.font = `600 28px ${FONT_DISPLAY}`;
    g.fillStyle = playing ? INK : MID;
    const nx = st.next >= 0 && st.next !== st.cur ? `  → ${slotName(st.next)}` : '';
    g.fillText(`${playing ? '▶ PLAY' : '■ STOP'}${nx}`, 16, 140);
    g.fillStyle = DIM;
    g.font = `600 20px ${FONT_DISPLAY}`;
    g.fillText('MM-RYTM', 16, 176);

    // 2) Les 16 pas (tete de lecture, pas poses), puis le niveau de chaque piste
    const x0 = 262;
    const x1 = 1086;
    const pitch = (x1 - x0) / 16;
    const bw = Math.round(pitch * 0.62);
    const steps = pattern.get().steps as Record<string, string | undefined>;
    for (let j = 0; j < 16; j += 1) {
      const x = Math.round(x0 + j * pitch + (pitch - bw) / 2);
      let any = false;
      for (const k of TRACK_KEYS) {
        const c = steps[k]?.charCodeAt(j) ?? 48;
        if (c > 48) {
          any = true;
          break;
        }
      }
      const isHead = head !== null && head.step % 16 === j;
      g.fillStyle = isHead ? INK : any ? MID : DIM;
      g.fillRect(x, 12, bw, isHead ? 18 : any ? 14 : 6);
      // Le temps (un pas sur quatre) : un point dessous
      if (j % 4 === 0) {
        g.fillStyle = DIM;
        g.fillRect(x + bw / 2 - 2, 38, 4, 4);
      }
    }
    const mTop = 52;
    const mBot = H - 14;
    const mH = mBot - mTop;
    for (let t = 0; t < 16; t += 1) {
      const x = Math.round(x0 + t * pitch + (pitch - bw) / 2);
      g.fillStyle = 'rgba(244, 241, 234, 0.08)';
      g.fillRect(x, mTop, bw, mH);
      const v = mv.t[t];
      if (v > 0) {
        const h = Math.round(v * mH);
        g.fillStyle = INK;
        g.fillRect(x, mBot - h, bw, h);
      }
      const p = mv.tp[t];
      if (p > 0.02) {
        g.fillStyle = p > 0.97 ? RED : MID;
        g.fillRect(x, mBot - Math.round(p * mH) - 3, bw, 3);
      }
    }

    // 3) Les scenes : A ---x--- B, le nombre de reglages de chacune
    const sc = pattern.scenes.get();
    const na = Object.keys(sc.a).length;
    const nb = Object.keys(sc.b).length;
    const sx0 = 1114;
    const sx1 = W - 16;
    g.font = `700 30px ${FONT_DISPLAY}`;
    g.fillStyle = na ? INK : MID;
    g.fillText('A', sx0, 40);
    g.fillStyle = nb ? INK : MID;
    g.textAlign = 'right';
    g.fillText('B', sx1, 40);
    g.textAlign = 'left';
    const lx0 = sx0 + 30;
    const lx1 = sx1 - 30;
    g.fillStyle = DIM;
    g.fillRect(lx0, 28, lx1 - lx0, 3);
    const xp = lx0 + (lx1 - lx0) * Math.max(0, Math.min(1, sceneCtl.x()));
    g.fillStyle = INK;
    g.fillRect(Math.round(xp) - 3, 18, 6, 22);
    g.font = `600 19px ${FONT_DISPLAY}`;
    g.fillStyle = MID;
    g.fillText(na ? `${na} SET` : 'EMPTY', sx0, 66);
    g.textAlign = 'right';
    g.fillText(nb ? `${nb} SET` : 'EMPTY', sx1, 66);
    g.textAlign = 'left';

    // 4) La sortie L et R (et le rouge du 0 dB)
    const ly = [104, 146];
    const vals = [
      [mv.l, mv.lp],
      [mv.r, mv.rp],
    ] as const;
    g.font = `700 20px ${FONT_DISPLAY}`;
    for (let c = 0; c < 2; c += 1) {
      const y = ly[c];
      g.fillStyle = MID;
      g.fillText(c === 0 ? 'L' : 'R', sx0, y + 16);
      const bx0 = sx0 + 26;
      const bwid = sx1 - bx0;
      g.fillStyle = 'rgba(244, 241, 234, 0.08)';
      g.fillRect(bx0, y, bwid, 20);
      const [v, p] = vals[c];
      if (v > 0) {
        g.fillStyle = INK;
        g.fillRect(bx0, y, Math.round(v * bwid), 20);
      }
      if (p > 0.02) {
        g.fillStyle = p > 0.97 ? RED : MID;
        g.fillRect(bx0 + Math.round(p * bwid) - 3, y, 3, 20);
      }
    }
    if (mv.clip) {
      g.fillStyle = RED;
      g.font = `700 18px ${FONT_DISPLAY}`;
      g.textAlign = 'right';
      g.fillText('CLIP', sx1, 186);
      g.textAlign = 'left';
    }
    this.texture.needsUpdate = true;
  }

  dispose(): void {
    this.texture.dispose();
    this.group.traverse((o) => {
      const m = o as Mesh;
      if (m.isMesh) {
        m.geometry.dispose();
        (m.material as MeshBasicMaterial).dispose();
      }
    });
  }
}
