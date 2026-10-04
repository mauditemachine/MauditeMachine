/**
 * Les formes d'onde des platines du MM-DECKS (2026-10-04, Mika : "pouvoir
 * zoomer dans la waveform pour voir plus les details et placer mon cue").
 * Deux bandes par ecran : la forme d'onde fine qui defile (la tete de
 * lecture au centre, de 2 a 32 secondes a l'ecran) et la piste entiere.
 *
 * Dessinees par la carte graphique : l'energie de chaque morceau est
 * posee une fois dans une texture (une ligne pour la piste entiere, puis
 * 400 tranches par seconde), et chaque image ne change que des uniformes
 * (position, zoom, cues). Rien a redessiner ni a renvoyer au GPU pendant
 * la lecture : le defilement est fluide sur un telephone aussi.
 *
 * Couleurs : os (la partie a venir), os pale (la partie jouee), la tete de
 * lecture blanche, les hot cues en orange, le CUE en jaune. Un mesh, un
 * draw call, quatre bandes (attribut aSlot).
 */

import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  Mesh,
  NearestFilter,
  PlaneGeometry,
  RedFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector4,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DETAIL_RATE } from './engine';
import { DECK, DECK_SCREEN, DJ_BEZEL, DJ_DECKS, DJ_DECKS_ALL, UNIT_X, type DjDeck } from './theme';

const TEX_W = 4096;

const VERT = /* glsl */ `
attribute float aSlot;
varying vec2 vUv;
varying float vSlot;
void main() {
  vUv = uv;
  vSlot = aSlot;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const FRAG = /* glsl */ `
uniform sampler2D uPeaks0;
uniform sampler2D uPeaks1;
uniform sampler2D uPeaks2;
uniform sampler2D uPeaks3;
uniform float uOvLen[4];
uniform float uDetLen[4];
uniform float uPos[4];
uniform float uDur[4];
uniform float uWin[4];
uniform float uCue[4];
uniform vec4 uHot[4];
uniform float uLoaded[4];
uniform float uBeat[4];
uniform float uSpb[4];
varying vec2 vUv;
varying float vSlot;

const vec3 BONE = vec3(0.965, 0.945, 0.906);
const vec3 BONE_DIM = vec3(0.42, 0.41, 0.39);
const vec3 FAINT = vec3(0.10, 0.10, 0.10);
const vec3 ORANGE = vec3(1.0, 0.416, 0.075);
const vec3 YELLOW = vec3(1.0, 0.843, 0.369);
const vec3 HEAD = vec3(1.0);

float fetchPeak(int deck, ivec2 p) {
  if (deck == 0) return texelFetch(uPeaks0, p, 0).r;
  if (deck == 1) return texelFetch(uPeaks1, p, 0).r;
  if (deck == 2) return texelFetch(uPeaks2, p, 0).r;
  return texelFetch(uPeaks3, p, 0).r;
}

float peak(int deck, int row0, int i) {
  return fetchPeak(deck, ivec2(i % ${TEX_W}, row0 + i / ${TEX_W}));
}

float ovPeak(int deck, int i) {
  return fetchPeak(deck, ivec2(i, 0));
}

/** Un trait vertical a x0 (en fraction), large de w pixels. */
float line(float x, float x0, float px, float w) {
  return 1.0 - smoothstep(px * w * 0.5, px * (w * 0.5 + 1.0), abs(x - x0));
}

void main() {
  int slot = int(vSlot + 0.5);
  int deck = slot / 2;
  bool whole = slot - deck * 2 == 1;
  vec3 col = vec3(0.0);
  float pxX = fwidth(vUv.x);
  float pxY = fwidth(vUv.y);
  float y = abs(vUv.y - 0.5) * 2.0;
  float loaded = uLoaded[deck];
  float dur = max(uDur[deck], 0.001);
  float pos = uPos[deck];
  if (loaded < 0.5) {
    // Une ligne au repos
    col = FAINT * (1.0 - smoothstep(pxY, pxY * 2.0, abs(vUv.y - 0.5)));
    gl_FragColor = vec4(col, 1.0);
    return;
  }
  if (whole) {
    // La piste entiere : quelques cretes par pixel, la partie jouee plus pale
    float n = uOvLen[deck];
    float a = 0.0;
    for (int k = 0; k < 4; k++) {
      float u = vUv.x + (float(k) / 4.0 - 0.375) * pxX;
      int i = int(clamp(u, 0.0, 0.9999) * n);
      a = max(a, ovPeak(deck, i));
    }
    float on = 1.0 - smoothstep(a, a + pxY * 2.0, y);
    float head = pos / dur;
    col = mix(col, vUv.x < head ? BONE_DIM : BONE, on * 0.9);
    for (int c = 0; c < 4; c++) {
      float t = uHot[deck][c];
      if (t >= 0.0) col = mix(col, ORANGE, line(vUv.x, t / dur, pxX, 1.5));
    }
    col = mix(col, YELLOW, line(vUv.x, uCue[deck] / dur, pxX, 1.5));
    col = mix(col, HEAD, line(vUv.x, head, pxX, 2.0));
  } else {
    // La forme d'onde fine : uWin secondes, la tete au centre
    float win = uWin[deck];
    float t = pos + (vUv.x - 0.5) * win;
    float secPx = pxX * win;
    float len = uDetLen[deck];
    float a = 0.0;
    float span = max(1.0, secPx * ${DETAIL_RATE.toFixed(1)});
    float i0 = (t - secPx * 0.5) * ${DETAIL_RATE.toFixed(1)};
    for (int k = 0; k < 12; k++) {
      float fi = i0 + span * float(k) / 12.0;
      if (fi >= 0.0 && fi < len) a = max(a, peak(deck, 1, int(fi)));
    }
    float on = 1.0 - smoothstep(a, a + pxY * 2.0, y);
    col = mix(col, t < pos ? BONE_DIM : BONE, on);
    // La grille des temps (SYNC) : un tic court en haut et en bas a chaque temps
    float spb = uSpb[deck];
    if (uBeat[deck] >= 0.0 && spb > 0.0) {
      float k = (t - uBeat[deck]) / spb;
      float dist = abs(k - floor(k + 0.5)) * spb / max(secPx, 1e-6);
      float tick = (1.0 - smoothstep(0.5, 1.5, dist)) * step(0.8, y);
      col = mix(col, BONE_DIM, tick * 0.9);
    }
    // Les cues : un trait et un petit drapeau en haut
    float flag = step(0.82, vUv.y);
    for (int c = 0; c < 4; c++) {
      float h = uHot[deck][c];
      if (h < 0.0) continue;
      float x0 = 0.5 + (h - pos) / win;
      col = mix(col, ORANGE, max(line(vUv.x, x0, pxX, 1.5), flag * line(vUv.x, x0 + 3.0 * pxX, pxX, 7.0)));
    }
    float xc = 0.5 + (uCue[deck] - pos) / win;
    col = mix(col, YELLOW, max(line(vUv.x, xc, pxX, 1.5), flag * line(vUv.x, xc + 3.0 * pxX, pxX, 7.0)));
    // La tete de lecture, au centre
    col = mix(col, HEAD, line(vUv.x, 0.5, pxX, 2.0));
  }
  gl_FragColor = vec4(col, 1.0);
}
`;

/** Une bande (en fractions de l'ecran) posee sur l'ecran d'une platine, ses UV de 0 a 1. */
function band(d: DjDeck, b: { u0: number; u1: number; v0: number; v1: number }, slot: number): BufferGeometry {
  const S = DECK.screen;
  const w = (b.u1 - b.u0) * S.w;
  const h = (b.v1 - b.v0) * S.d;
  const g = new PlaneGeometry(w, h);
  g.rotateX(-Math.PI / 2);
  const x = UNIT_X[d] + S.x - S.w / 2 + ((b.u0 + b.u1) / 2) * S.w;
  const z = S.z - S.d / 2 + ((b.v0 + b.v1) / 2) * S.d;
  g.translate(x, DJ_BEZEL.h + 0.0045, z);
  const n = g.getAttribute('position').count;
  g.setAttribute('aSlot', new Float32BufferAttribute(new Float32Array(n).fill(slot), 1));
  return g;
}

function emptyTexture(): DataTexture {
  const t = new DataTexture(new Uint8Array(TEX_W * 2), TEX_W, 2, RedFormat, UnsignedByteType);
  t.minFilter = NearestFilter;
  t.magFilter = NearestFilter;
  t.generateMipmaps = false;
  t.needsUpdate = true;
  return t;
}

export interface DjWaveState {
  loaded: boolean;
  position: number;
  duration: number;
  window: number;
  cue: number;
  cues: readonly (number | null)[];
  /** le premier temps (secondes) et la duree d'un temps dans la piste, ou null sans grille */
  beat: number | null;
  spb: number;
}

export class DjWaves {
  readonly mesh: Mesh;
  private material: ShaderMaterial;
  private tex: Record<DjDeck, DataTexture> = { a: emptyTexture(), b: emptyTexture(), c: emptyTexture(), d: emptyTexture() };
  private loadIds: Record<DjDeck, number> = { a: -1, b: -1, c: -1, d: -1 };
  private hot = DJ_DECKS_ALL.map(() => new Vector4(-1, -1, -1, -1));

  constructor() {
    const parts: BufferGeometry[] = [];
    // Les bandes des platines posees ; le shader en connait quatre (slot / 2 : l'index de la platine)
    for (const d of DJ_DECKS) {
      const i = DJ_DECKS_ALL.indexOf(d);
      parts.push(band(d, DECK_SCREEN.detail, i * 2), band(d, DECK_SCREEN.overview, i * 2 + 1));
    }
    const g = mergeGeometries(parts, false);
    for (const p of parts) p.dispose();
    if (!g) throw new Error('dj: waves merge failed');
    this.material = new ShaderMaterial({
      vertexShader: VERT,
      fragmentShader: FRAG,
      uniforms: {
        uPeaks0: { value: this.tex.a },
        uPeaks1: { value: this.tex.b },
        uPeaks2: { value: this.tex.c },
        uPeaks3: { value: this.tex.d },
        uOvLen: { value: [1, 1, 1, 1] },
        uDetLen: { value: [0, 0, 0, 0] },
        uPos: { value: [0, 0, 0, 0] },
        uDur: { value: [1, 1, 1, 1] },
        uWin: { value: [8, 8, 8, 8] },
        uCue: { value: [-1, -1, -1, -1] },
        uHot: { value: this.hot },
        uLoaded: { value: [0, 0, 0, 0] },
        uBeat: { value: [-1, -1, -1, -1] },
        uSpb: { value: [0, 0, 0, 0] },
      },
    });
    this.material.name = 'djWaves';
    this.mesh = new Mesh(g, this.material);
    this.mesh.name = 'djWaves';
    this.mesh.frustumCulled = false;
  }

  /** Les cretes d'un morceau (une fois par morceau pose) ; true si la texture change. */
  setPeaks(d: DjDeck, loadId: number, overview: Float32Array, detail: Float32Array): boolean {
    if (this.loadIds[d] === loadId) return false;
    this.loadIds[d] = loadId;
    const rows = 1 + Math.max(1, Math.ceil(detail.length / TEX_W));
    const data = new Uint8Array(TEX_W * rows);
    // L'energie deja normalisee (math.ts energy), un peu de marge au bord de la bande
    const enc = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 0.92 * 255);
    for (let i = 0; i < Math.min(TEX_W, overview.length); i += 1) data[i] = enc(overview[i]);
    for (let i = 0; i < detail.length; i += 1) data[TEX_W + i] = enc(detail[i]);
    this.tex[d].dispose();
    const t = new DataTexture(data, TEX_W, rows, RedFormat, UnsignedByteType);
    t.minFilter = NearestFilter;
    t.magFilter = NearestFilter;
    t.generateMipmaps = false;
    t.needsUpdate = true;
    this.tex[d] = t;
    const u = this.material.uniforms;
    const i = DJ_DECKS_ALL.indexOf(d);
    u[`uPeaks${i}`].value = t;
    (u.uOvLen.value as number[])[i] = Math.max(1, Math.min(TEX_W, overview.length));
    (u.uDetLen.value as number[])[i] = detail.length;
    return true;
  }

  /** Position, zoom et cues d'une platine ; true si quelque chose change a l'ecran. */
  update(d: DjDeck, s: DjWaveState): boolean {
    const u = this.material.uniforms;
    const i = DJ_DECKS_ALL.indexOf(d);
    const pos = u.uPos.value as number[];
    const dur = u.uDur.value as number[];
    const win = u.uWin.value as number[];
    const cue = u.uCue.value as number[];
    const loaded = u.uLoaded.value as number[];
    const beat = u.uBeat.value as number[];
    const spb = u.uSpb.value as number[];
    const b = s.beat ?? -1;
    if (beat[i] !== b || spb[i] !== s.spb) {
      beat[i] = b;
      spb[i] = s.spb;
      return this.update(d, s) || true;
    }
    const h = this.hot[i];
    const hv = [0, 1, 2, 3].map((k) => s.cues[k] ?? -1);
    const next = [s.loaded ? 1 : 0, Math.fround(s.position), Math.max(0.001, s.duration), s.window, s.cue];
    if (loaded[i] === next[0] && pos[i] === next[1] && dur[i] === next[2] && win[i] === next[3] && cue[i] === next[4] && h.x === hv[0] && h.y === hv[1] && h.z === hv[2] && h.w === hv[3]) return false;
    loaded[i] = next[0];
    pos[i] = next[1];
    dur[i] = next[2];
    win[i] = next[3];
    cue[i] = next[4];
    h.set(hv[0], hv[1], hv[2], hv[3]);
    return true;
  }

  dispose(): void {
    this.mesh.geometry.dispose();
    this.material.dispose();
    for (const d of DJ_DECKS_ALL) this.tex[d].dispose();
  }
}
