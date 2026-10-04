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
 * Chaque texel : l'energie (r) et les trois bandes (g basses, b mediums,
 * a aigus : math.ts bandEnergy, arrivees un peu apres le morceau). Trois
 * affichages (dj/state.ts DJ_WAVES, Mika : "on a du mal a voir les
 * choses") : 3BAND (basses bleues, mediums ambre, aigus blancs, l'une sur
 * l'autre), RGB (leur silhouette teintee par leur melange) et MONO (l'os
 * d'avant ; aussi tant que les bandes se calculent). La partie jouee est
 * plus sombre, la tete de lecture blanche, les hot cues en orange, le CUE
 * en jaune, chacun cerne de noir pour se lire sur toutes les couleurs. Un
 * mesh, un draw call, quatre bandes (attribut aSlot).
 *
 * En barres fines (2026-10-04, Mika : "c'est pas beau, peut-etre juste
 * mettre des barres fines") : 150 par fenetre, calees sur le temps (elles
 * defilent avec la musique, sans scintiller), 200 sur la piste entiere ;
 * chaque barre prend la crete de son pas, ce qui lisse le grain d'une
 * tranche a l'autre. Trop loin pour des barres (moins d'un pixel), le
 * trait continu revient.
 */

import {
  BufferGeometry,
  DataTexture,
  Float32BufferAttribute,
  Mesh,
  NearestFilter,
  PlaneGeometry,
  RGBAFormat,
  ShaderMaterial,
  UnsignedByteType,
  Vector2,
  Vector4,
} from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import { DETAIL_RATE } from './engine';
import { DJ_WAVES, type DjWaveMode } from './state';
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
uniform vec2 uLoop[4];
uniform float uBands[4];
uniform float uMode;
varying vec2 vUv;
varying float vSlot;

const vec3 BONE = vec3(0.965, 0.945, 0.906);
const vec3 BONE_DIM = vec3(0.42, 0.41, 0.39);
const vec3 FAINT = vec3(0.10, 0.10, 0.10);
const vec3 ORANGE = vec3(1.0, 0.416, 0.075);
const vec3 YELLOW = vec3(1.0, 0.843, 0.369);
const vec3 HEAD = vec3(1.0);
const vec3 LOOP = vec3(1.0, 0.416, 0.075);
const vec3 INK = vec3(0.0);
// 3BAND : les basses en bleu, les mediums en ambre (plus jaune que l'orange des cues), les aigus en blanc
const vec3 LOW = vec3(0.13, 0.40, 1.0);
const vec3 MID = vec3(0.93, 0.66, 0.30);
const vec3 HIGH = vec3(0.98, 0.97, 0.94);
// La hauteur de chaque bande a son maximum : les aigus restent fins, au coeur des autres
const vec3 BAND_H = vec3(0.92, 0.72, 0.48);
// La partie deja jouee
const float PLAYED = 0.42;
// Les barres fines (2026-10-04, Mika : "c'est pas beau, peut-etre juste mettre des barres fines") :
// combien par fenetre (la forme d'onde fine) et sur la piste entiere, la part pleine de chaque pas,
// et sous quelle taille (en pas par pixel) on revient a un trait continu
const float BARS = 150.0;
const float BARS_OV = 200.0;
const float BAR_FILL = 0.6;
const float BAR_MIN = 0.55;

vec4 fetchPeak(int deck, ivec2 p) {
  if (deck == 0) return texelFetch(uPeaks0, p, 0);
  if (deck == 1) return texelFetch(uPeaks1, p, 0);
  if (deck == 2) return texelFetch(uPeaks2, p, 0);
  return texelFetch(uPeaks3, p, 0);
}

vec4 peak(int deck, int row0, int i) {
  return fetchPeak(deck, ivec2(i % ${TEX_W}, row0 + i / ${TEX_W}));
}

vec4 ovPeak(int deck, int i) {
  return fetchPeak(deck, ivec2(i, 0));
}

/** Un trait vertical a x0 (en fraction), large de w pixels. */
float line(float x, float x0, float px, float w) {
  return 1.0 - smoothstep(px * w * 0.5, px * (w * 0.5 + 1.0), abs(x - x0));
}

/** Un repere (cue, tete de lecture) cerne de noir : il se lit sur toutes les couleurs de l'onde. */
vec3 mark(vec3 col, vec3 ink, float x, float x0, float px, float w) {
  col = mix(col, INK, line(x, x0, px, w + 2.5) * 0.85);
  return mix(col, ink, line(x, x0, px, w));
}

/**
 * La colonne de forme d'onde : e (r l'energie, g b a les bandes), y de 0
 * (centre) a 1 (bord) ; cov : la part du pixel couverte par la barre.
 */
vec3 wave(vec3 col, vec4 e, float y, float aa, bool bands, bool played, float cov) {
  if (!bands || uMode > 1.5) {
    float on = 1.0 - smoothstep(e.r, e.r + aa, y);
    return mix(col, played ? BONE_DIM : BONE, on * cov);
  }
  float dim = played ? PLAYED : 1.0;
  vec3 h = e.gba * BAND_H;
  if (uMode < 0.5) {
    col = mix(col, LOW * dim, (1.0 - smoothstep(h.x, h.x + aa, y)) * cov);
    col = mix(col, MID * dim, (1.0 - smoothstep(h.y, h.y + aa, y)) * cov);
    return mix(col, HIGH * dim, (1.0 - smoothstep(h.z, h.z + aa, y)) * cov);
  }
  // RGB : rouge les basses, vert les mediums, bleu les aigus ; plus clair au coeur
  float top = max(h.x, max(h.y, h.z));
  vec3 tint = e.gba / max(max(e.g, max(e.b, e.a)), 0.004);
  vec3 c = mix(tint, vec3(1.0), 0.16) * (0.78 + 0.22 * (1.0 - y / max(top, 0.004)));
  return mix(col, c * dim, (1.0 - smoothstep(top, top + aa, y)) * cov);
}

/** La part d'un pixel (centre f, large w, en pas de barre) que couvre le corps de la barre qui part de b. */
float cover(float f, float w, float b) {
  return clamp((min(f + w * 0.5, b + BAR_FILL) - max(f - w * 0.5, b)) / max(w, 1e-6), 0.0, 1.0);
}

/** La crete d'une barre de la forme d'onde fine : les tranches de [i0, i0 + span). */
vec4 detailBar(int deck, float i0, float span, float len) {
  vec4 a = vec4(0.0);
  for (int k = 0; k < 16; k++) {
    float fi = i0 + span * (float(k) + 0.5) / 16.0;
    if (fi >= 0.0 && fi < len) a = max(a, peak(deck, 1, int(fi)));
  }
  return a;
}

/** La crete d'une barre de la piste entiere : les cretes de [i0, i0 + span). */
vec4 overviewBar(int deck, float i0, float span, float n) {
  vec4 a = vec4(0.0);
  for (int k = 0; k < 16; k++) {
    float fi = i0 + span * (float(k) + 0.5) / 16.0;
    if (fi >= 0.0 && fi < n) a = max(a, ovPeak(deck, int(fi)));
  }
  return a;
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
  bool bands = uBands[deck] > 0.5;
  if (loaded < 0.5) {
    // Une ligne au repos
    col = FAINT * (1.0 - smoothstep(pxY, pxY * 2.0, abs(vUv.y - 0.5)));
    gl_FragColor = vec4(col, 1.0);
    return;
  }
  if (whole) {
    // La piste entiere en BARS_OV barres fines, la partie jouee plus pale
    float n = uOvLen[deck];
    float head = pos / dur;
    // LOOP : la boucle en orange pale sous la piste
    vec2 lp = uLoop[deck];
    if (lp.y > lp.x && vUv.x >= lp.x / dur && vUv.x <= lp.y / dur) col = mix(col, LOOP, 0.35);
    float f = vUv.x * BARS_OV;
    float w = pxX * BARS_OV;
    float span = n / BARS_OV;
    bool played = vUv.x < head;
    if (w > BAR_MIN) {
      // Trop loin pour des barres : la crete sous le pixel
      col = wave(col, overviewBar(deck, (vUv.x - pxX * 0.5) * n, max(1.0, pxX * n), n), y, pxY * 2.0, bands, played, 1.0);
    } else {
      float bi = floor(f);
      float fr = f - bi;
      col = wave(col, overviewBar(deck, bi * span, span, n), y, pxY * 2.0, bands, played, cover(fr, w, 0.0));
      if (fr + w * 0.5 > 1.0) col = wave(col, overviewBar(deck, (bi + 1.0) * span, span, n), y, pxY * 2.0, bands, played, cover(fr, w, 1.0));
    }
    for (int c = 0; c < 4; c++) {
      float t = uHot[deck][c];
      if (t >= 0.0) col = mark(col, ORANGE, vUv.x, t / dur, pxX, 1.5);
    }
    col = mark(col, YELLOW, vUv.x, uCue[deck] / dur, pxX, 1.5);
    col = mark(col, HEAD, vUv.x, head, pxX, 2.0);
  } else {
    // La forme d'onde fine : uWin secondes, la tete au centre
    float win = uWin[deck];
    float t = pos + (vUv.x - 0.5) * win;
    float secPx = pxX * win;
    float len = uDetLen[deck];
    // LOOP : le fond de la boucle en orange sombre, ses bornes en trait orange
    vec2 lp = uLoop[deck];
    if (lp.y > lp.x && t >= lp.x && t < lp.y) col = LOOP * 0.22;
    // BARS barres fines par fenetre, calees sur le temps : elles defilent avec la musique
    float barDur = win / BARS;
    float f = t / barDur;
    float w = secPx / barDur;
    float span = barDur * ${DETAIL_RATE.toFixed(1)};
    bool played = t < pos;
    if (w > BAR_MIN) {
      col = wave(col, detailBar(deck, (t - secPx * 0.5) * ${DETAIL_RATE.toFixed(1)}, max(1.0, secPx * ${DETAIL_RATE.toFixed(1)}), len), y, pxY * 2.0, bands, played, 1.0);
    } else {
      float bi = floor(f);
      float fr = f - bi;
      col = wave(col, detailBar(deck, bi * span, span, len), y, pxY * 2.0, bands, played, cover(fr, w, 0.0));
      if (fr + w * 0.5 > 1.0) col = wave(col, detailBar(deck, (bi + 1.0) * span, span, len), y, pxY * 2.0, bands, played, cover(fr, w, 1.0));
    }
    if (lp.y > lp.x) {
      col = mark(col, LOOP, vUv.x, 0.5 + (lp.x - pos) / win, pxX, 2.0);
      col = mark(col, LOOP, vUv.x, 0.5 + (lp.y - pos) / win, pxX, 2.0);
    }
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
      col = mark(col, ORANGE, vUv.x, x0, pxX, 1.5);
      col = mix(col, ORANGE, flag * line(vUv.x, x0 + 3.0 * pxX, pxX, 7.0));
    }
    float xc = 0.5 + (uCue[deck] - pos) / win;
    col = mark(col, YELLOW, vUv.x, xc, pxX, 1.5);
    col = mix(col, YELLOW, flag * line(vUv.x, xc + 3.0 * pxX, pxX, 7.0));
    // La tete de lecture, au centre
    col = mark(col, HEAD, vUv.x, 0.5, pxX, 2.0);
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
  const t = new DataTexture(new Uint8Array(TEX_W * 2 * 4), TEX_W, 2, RGBAFormat, UnsignedByteType);
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
  /** la boucle (secondes de la piste), ou null */
  loop: { a: number; b: number } | null;
}

export class DjWaves {
  readonly mesh: Mesh;
  private material: ShaderMaterial;
  private tex: Record<DjDeck, DataTexture> = { a: emptyTexture(), b: emptyTexture(), c: emptyTexture(), d: emptyTexture() };
  /** le morceau pose dans chaque texture, et s'il a ses bandes */
  private shown: Record<DjDeck, string> = { a: '', b: '', c: '', d: '' };
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
        uLoop: { value: [new Vector2(), new Vector2(), new Vector2(), new Vector2()] },
        uBands: { value: [0, 0, 0, 0] },
        uMode: { value: 0 },
      },
    });
    this.material.name = 'djWaves';
    this.mesh = new Mesh(g, this.material);
    this.mesh.name = 'djWaves';
    this.mesh.frustumCulled = false;
  }

  /**
   * L'energie d'un morceau (une fois par morceau pose), puis ses trois
   * bandes quand elles arrivent ; true si la texture change.
   */
  setPeaks(d: DjDeck, loadId: number, overview: Float32Array, detail: Float32Array, bands: { overview: Float32Array; detail: Float32Array } | null): boolean {
    const key = `${loadId}|${bands ? 1 : 0}`;
    if (this.shown[d] === key) return false;
    this.shown[d] = key;
    const rows = 1 + Math.max(1, Math.ceil(detail.length / TEX_W));
    const data = new Uint8Array(TEX_W * rows * 4);
    // L'energie deja normalisee (math.ts energy), un peu de marge au bord de la bande
    const enc = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 0.92 * 255);
    // Les bandes : leur hauteur se regle dans le shader (BAND_H)
    const encB = (v: number): number => Math.round(Math.min(1, Math.max(0, v)) * 255);
    const ov = Math.min(TEX_W, overview.length);
    for (let i = 0; i < ov; i += 1) data[i * 4] = enc(overview[i]);
    for (let i = 0; i < detail.length; i += 1) data[(TEX_W + i) * 4] = enc(detail[i]);
    if (bands) {
      const ob = Math.min(TEX_W, Math.floor(bands.overview.length / 3));
      for (let i = 0; i < ob; i += 1) for (let c = 0; c < 3; c += 1) data[i * 4 + 1 + c] = encB(bands.overview[i * 3 + c]);
      const db = Math.min(detail.length, Math.floor(bands.detail.length / 3));
      for (let i = 0; i < db; i += 1) for (let c = 0; c < 3; c += 1) data[(TEX_W + i) * 4 + 1 + c] = encB(bands.detail[i * 3 + c]);
    }
    this.tex[d].dispose();
    const t = new DataTexture(data, TEX_W, rows, RGBAFormat, UnsignedByteType);
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
    (u.uBands.value as number[])[i] = bands ? 1 : 0;
    return true;
  }

  /** L'affichage (3BAND, RGB, MONO) ; true s'il change. */
  setMode(m: DjWaveMode): boolean {
    const u = this.material.uniforms.uMode;
    const v = Math.max(0, DJ_WAVES.indexOf(m));
    if (u.value === v) return false;
    u.value = v;
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
    const lp = (u.uLoop.value as Vector2[])[i];
    const la = s.loop ? s.loop.a : 0;
    const lb = s.loop ? s.loop.b : 0;
    if (lp.x !== la || lp.y !== lb) {
      lp.set(la, lb);
      this.update(d, { ...s });
      return true;
    }
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
