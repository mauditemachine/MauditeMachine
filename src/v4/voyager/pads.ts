/**
 * Le plateau du MM-VOYAGER (2026-10-03) : les huit pads d'accords
 * (caoutchouc bombe retroeclaire, comme ceux de la 808) et les boutons
 * (RUN/STOP, CLEAR, RANDOM, OPEN : des touches rectangulaires
 * retroeclairees ; les pages sont sur la carte). Deux InstancedMesh et un
 * de halos additifs : trois draw calls.
 *
 * Lumieres :
 * - pad hors progression : jaune faible (on le voit, on a envie d'y
 *   toucher) ; dans la progression : orange ; l'accord qui joue : yellowHi ;
 *   chaque note de l'arpege le fait flasher ;
 * - RUN/STOP (2026-10-03, Mika : "la meme couleur que RUN/STOP de la
 *   808") : la touche rouge de la 808 (son albedo LIT.run) et son temoin,
 *   une barre en haut de la touche, jaune tant que l'arpege joue ; OPEN :
 *   orange plein qui respire, faible machine ouverte ; CLEAR et RANDOM :
 *   eteints, un eclat a l'appui.
 * Appui : la touche s'enfonce et remonte (reduced motion : la lumiere seule).
 *
 * Les boutons poussoirs (2026-10-11, SUB OCT, Mika : "ou ptete un bouton
 * poussoir je sais pas" ; 2026-10-12, CHORUS, les modes du Juno-106) : la
 * meme touche de caoutchouc en petit (VOY_PUSH), posee dans le repere de son
 * plan (rig.ts : le panneau, ou le plateau pour CHORUS au telephone), un
 * InstancedMesh par plan ; eteinte, un peu de lumiere au survol, elle
 * s'enfonce a l'appui. Ses LED (-1, -2 ; I, II) sont dessinees sur la
 * serigraphie (silk.ts).
 */

import {
  AdditiveBlending,
  Color,
  ExtrudeGeometry,
  Shape,
  Mesh,
  DynamicDrawUsage,
  Float32BufferAttribute,
  InstancedBufferAttribute,
  InstancedMesh,
  Matrix4,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  Quaternion,
  SRGBColorSpace,
  Vector3,
  CanvasTexture,
  type BufferGeometry,
  type Object3D,
} from 'three';
import { RoundedBoxGeometry } from 'three/examples/jsm/geometries/RoundedBoxGeometry.js';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';
import type { HotspotDef } from '../scene/hit';
import { albedo, withInstanceEmissive } from '../scene/materials';
import { makeHaloTexture } from '../scene/silk';
import { easeOutCubic, linear, type Tweens } from '../scene/tween';
import { BTN_LED, COLOR, LIT, MATERIAL, OPEN_BREATHE, OPEN_TINT, PAD_FX, PAD_GLOW, PAD_HALO, PAD_QUEUED, PLUGIN_ARP, PORTRAIT, gainOf } from '../theme';
import { CHORDS } from './chords';

/** v41 (maquette) : les touches de la face en pastilles unies de la page OPEN (option A de la v40) */
const PILL_KEYS = true;
import { VOY_FACE_KNOBS, voyKnob, type VoyKnobId } from './params';
import { VOY_BUTTON, VOY_BUTTONS, VOY_KNOB, VOY_PAD, VOY_PUSH, isPush, voyKnobPlace, voyPadAt, voyPushLeds, type VoyButtonId, type VoyWhere } from './theme';

const PADS = CHORDS.length;
const BTNS = VOY_BUTTONS.length;
const OPEN_I = VOY_BUTTONS.findIndex((b) => b.id === 'open');
const RUN_I = VOY_BUTTONS.findIndex((b) => b.id === 'run');
const EDIT_I = VOY_BUTTONS.findIndex((b) => b.id === 'edit');
const PRESET_I = VOY_BUTTONS.findIndex((b) => b.id === 'preset');
/** Les boutons poussoirs (SUB OCT, 2026-10-11 ; CHORUS, 2026-10-12). */
export const PUSH_KNOB_IDS: readonly VoyKnobId[] = VOY_FACE_KNOBS.filter((k) => isPush(k.id)).map((k) => k.id);
const PUSH_IDS = PUSH_KNOB_IDS;
const PUSHES = PUSH_IDS.length;
const WHERES: readonly VoyWhere[] = ['panel', 'deck'];
/** Chaque bouton : son plan, sa place dans l'InstancedMesh de ce plan. */
const PUSH_SLOT = PUSH_IDS.map((id) => {
  const where = voyKnobPlace(id).where;
  return { where, j: PUSH_IDS.filter((x) => voyKnobPlace(x).where === where).indexOf(id) };
});
const pushCount = (where: VoyWhere): number => PUSH_SLOT.filter((s) => s.where === where).length;

type Glow = 'off' | 'faint' | 'hover' | 'queued' | 'active' | 'flash' | 'orange' | 'orangeDim';
const RGB: Record<Glow, readonly number[]> = {
  off: [0, 0, 0],
  faint: PAD_GLOW.faint,
  hover: PAD_GLOW.hover,
  // v27 : la progression au jaune d'accent (le plugin)
  // v31 : la couleur d'accent du plugin, reglable (theme.ts setPluginAccent, PAD_QUEUED)
  queued: PAD_QUEUED,
  active: PAD_GLOW.active,
  flash: PAD_GLOW.flash,
  orange: PAD_GLOW.orange,
  orangeDim: PAD_GLOW.orangeDim,
};
const HALO: Record<Glow, number> = {
  off: 0,
  faint: PAD_HALO.faint,
  hover: PAD_HALO.hover,
  queued: 0.12,
  active: PAD_HALO.active,
  flash: PAD_HALO.flash,
  orange: PAD_HALO.orange,
  orangeDim: PAD_HALO.orangeDim,
};

const m4 = new Matrix4();
const col = new Color();
const q0 = new Quaternion();
const v3 = new Vector3();
const s3 = new Vector3();
const YELLOW = new Color(COLOR.yellow);
const YELLOW_HI = new Color(COLOR.yellowHi);
const ORANGE = new Color(COLOR.orange);

const smoothstep = (a: number, b: number, x: number): number => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Couleur caoutchouc et masque emissif (1 dessus, 0.55 sur les flancs). */
function paintRubber(g: BufferGeometry): void {
  const rubber = albedo('pad', new Color(), gainOf('pad'));
  const n = g.getAttribute('normal');
  const c = new Float32Array(n.count * 3);
  const m = new Float32Array(n.count);
  for (let i = 0; i < n.count; i += 1) {
    c[i * 3] = rubber.r;
    c[i * 3 + 1] = rubber.g;
    c[i * 3 + 2] = rubber.b;
    m[i] = 0.55 + 0.45 * smoothstep(0.55, 0.95, n.getY(i));
  }
  g.setAttribute('color', new Float32BufferAttribute(c, 3));
  g.setAttribute('emissiveMask', new Float32BufferAttribute(m, 1));
}

/** Pad bombe (la geometrie des pads de la 808, a la taille de VOY_PAD). */
function padGeometry(mobile: boolean): BufferGeometry {
  const P = VOY_PAD;
  // Plus minces depuis le grand ecran (2026-10-08) : la profondeur (depth) plus courte que la largeur
  const box = new RoundedBoxGeometry(P.size, P.height, P.depth, mobile ? 2 : 3, P.radius);
  box.translate(0, P.height / 2, 0);
  const flat = P.size - 2 * P.radius;
  const flatD = P.depth - 2 * P.radius;
  const plane = new PlaneGeometry(flat, flatD, 6, 6);
  plane.rotateX(-Math.PI / 2);
  const pos = plane.getAttribute('position');
  const h = flat / 2;
  const hd = flatD / 2;
  for (let i = 0; i < pos.count; i += 1) {
    const x = pos.getX(i) / h;
    const z = pos.getZ(i) / hd;
    pos.setY(i, P.height + 0.002 + P.dome * (1 - x * x) * (1 - z * z));
  }
  plane.computeVertexNormals();
  const dome = plane.toNonIndexed();
  plane.dispose();
  const parts = [box, dome];
  for (const g of parts) {
    g.deleteAttribute('uv');
    paintRubber(g);
  }
  const merged = mergeGeometries(parts, false);
  box.dispose();
  dome.dispose();
  if (!merged) throw new Error('voyager: pads merge failed');
  return merged;
}

/** Un bouton poussoir du panneau (2026-10-11) : la touche du plateau a sa taille (des coins a sa mesure, pas ceux d'une touche reduite). */
/**
 * 2026-11-16 (Mika : "le design des boutons") : une vraie touche de caoutchouc, le corps a l'arete marquee et le dessus
 * en leger plateau, un rien plus clair (son arete accroche la lumiere).
 */
/**
 * v41 (maquette, Mika : "je veux ce style de bouton meme dans la face avant partout") : la touche des pages OPEN (option
 * A de la v40) : une pastille unie et mate aux coins tres arrondis (rayon 45 % du petit cote), un leger chanfrein ; allumee,
 * son dessus prend l'accent (emissive par instance, ACCENT COLOR de SETTINGS).
 */
function pillGeometry(w: number, h: number, d: number, mobile: boolean): BufferGeometry {
  // v43 (Mika, 73.webp : la rangee STYLE des pages d'OPEN) : une vraie pilule, ses bouts en demi-cercles
  const r = Math.min(w, d) * 0.5;
  const bev = Math.min(h * 0.35, r * 0.25);
  const s = new Shape();
  const rr = Math.max(0.001, r - bev);
  const xl = -w / 2 + r;
  const xr = w / 2 - r;
  s.moveTo(xl, -rr);
  s.lineTo(xr, -rr);
  s.absarc(xr, 0, rr, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(xl, rr);
  s.absarc(xl, 0, rr, Math.PI / 2, (3 * Math.PI) / 2, false);
  const g0 = new ExtrudeGeometry(s, { depth: Math.max(0.001, h - 2 * bev), bevelEnabled: true, bevelThickness: bev, bevelSize: bev, bevelSegments: mobile ? 2 : 4, curveSegments: mobile ? 8 : 16 });
  // l'extrusion suit z : on la couche (le dessus vers +y), posee sur y = 0
  g0.rotateX(-Math.PI / 2);
  g0.computeBoundingBox();
  g0.translate(0, -(g0.boundingBox?.min.y ?? 0), 0);
  const o = g0.index ? g0.toNonIndexed() : g0;
  o.deleteAttribute('uv');
  o.computeVertexNormals();
  paintRubber(o);
  return o;
}

function keyGeometry(w: number, h: number, d: number, r: number, mobile: boolean): BufferGeometry {
  if (PLUGIN_ARP && PILL_KEYS) return pillGeometry(w, h * 0.82, d, mobile);
  const body = new RoundedBoxGeometry(w, h * 0.82, d, mobile ? 2 : 4, Math.min(r, (h * 0.82) / 2 - 0.004));
  body.translate(0, (h * 0.82) / 2, 0);
  const ix = Math.min(w, d) * 0.09;
  const top = new RoundedBoxGeometry(w - 2 * ix, h * 0.3, d - 2 * ix, mobile ? 2 : 4, Math.min(r * 0.8, h * 0.14));
  top.translate(0, h * 0.7 + h * 0.15, 0);
  const parts = [body, top].map((g) => {
    const o = g.index ? g.toNonIndexed() : g;
    o.deleteAttribute('uv');
    paintRubber(o);
    return o;
  });
  const c = parts[1].getAttribute('color');
  for (let i = 0; i < c.count; i += 1) c.setXYZ(i, c.getX(i) * 1.35, c.getY(i) * 1.35, c.getZ(i) * 1.35);
  const g = mergeGeometries(parts, false);
  if (!g) throw new Error('voyager: key merge failed');
  return g;
}

function pushGeometry(mobile: boolean): BufferGeometry {
  const P = VOY_PUSH;
  if (PLUGIN_ARP) return keyGeometry(P.w, P.h, P.d, 0.035, mobile);
  const g = new RoundedBoxGeometry(P.w, P.h, P.d, mobile ? 2 : 3, Math.min(0.04, P.h / 2 - 0.005));
  g.translate(0, P.h / 2, 0);
  g.deleteAttribute('uv');
  paintRubber(g);
  return g;
}

/** Touche unite (1 x h x 1), mise a l'echelle par instance. */
function buttonGeometry(mobile: boolean): BufferGeometry {
  // v43 (le plugin) : a sa vraie taille (toutes les touches du plateau ont la meme) : les bouts restent des demi-cercles
  if (PLUGIN_ARP) return keyGeometry(VOY_BUTTONS[0].w, VOY_BUTTON.h, VOY_BUTTONS[0].d, VOY_BUTTON.radius, mobile);
  const g = new RoundedBoxGeometry(1, VOY_BUTTON.h, 1, mobile ? 2 : 3, VOY_BUTTON.radius);
  g.translate(0, VOY_BUTTON.h / 2, 0);
  g.deleteAttribute('uv');
  paintRubber(g);
  return g;
}

/** v43 (le plugin, 73.webp) : la lumiere d'une pilule allumee (part de celle d'un pad), son halo (marge, force). */
const HALO_PILL = { fill: 0.42, margin: 0.16, gain: 0.85 } as const;

/** v43 : le halo d'une pilule (w x d) : sa forme floutee, dans une marge m ; blanc (la couleur vient de l'instance). */
function pillHaloTexture(w: number, d: number, m: number): CanvasTexture {
  const W = 256;
  const H = Math.round((W * (d + 2 * m)) / (w + 2 * m));
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d')!;
  const k = W / (w + 2 * m);
  const r = (d / 2) * k;
  const x0 = m * k + r;
  const x1 = W - m * k - r;
  g.filter = `blur(${(m * k * 0.42).toFixed(1)}px)`;
  g.fillStyle = '#fff';
  g.beginPath();
  g.arc(x0, H / 2, r, Math.PI / 2, (3 * Math.PI) / 2);
  g.lineTo(x1, H / 2 - r);
  g.arc(x1, H / 2, r, -Math.PI / 2, Math.PI / 2);
  g.closePath();
  g.fill();
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

export interface VoyKeysOpts {
  tweens: Tweens;
  reduced: () => boolean;
  repaint: () => void;
  mobile: boolean;
}

export class VoyKeys {
  readonly pads: InstancedMesh;
  readonly buttons: InstancedMesh;
  readonly halos: InstancedMesh;
  /** v43 (le plugin) : le halo des touches du plateau, a la forme de la pilule (73.webp) ; null au site */
  readonly btnHalos: InstancedMesh | null = null;
  /** les boutons poussoirs, un InstancedMesh par plan : rig.ts pose chacun dans le repere de son plan */
  readonly pushes: Record<VoyWhere, InstancedMesh>;
  private pushEm: Record<VoyWhere, InstancedBufferAttribute>;
  private pushY = new Float32Array(PUSHES);
  /** le bouton poussoir survole (-1 : aucun) */
  private pushHover = -1;
  /** le temoin de RUN/STOP (une barre sur la touche, comme sur la 808) */
  readonly runLed: Mesh;
  private ledMat: MeshBasicMaterial;
  private ledOff = new Color(COLOR.line);
  private ledOn = new Color(COLOR.yellowHi);
  private padMat: MeshStandardMaterial;
  private btnMat: MeshStandardMaterial;
  private haloMat: MeshBasicMaterial;
  private haloTex: CanvasTexture;
  private padEm: InstancedBufferAttribute;
  private btnEm: InstancedBufferAttribute;
  private padY = new Float32Array(PADS);
  private btnY = new Float32Array(BTNS);
  private padGlow: Glow[] = Array<Glow>(PADS).fill('faint');
  private btnGlow: Glow[] = Array<Glow>(BTNS).fill('off');
  private flashUntil = new Float64Array(PADS + BTNS);
  private flashing = new Uint8Array(PADS + BTNS);
  /** progression et accord qui joue */
  private queued = new Set<number>();
  private playing = -1;
  private running = false;
  /** la suite de l'arpege ouverte (EDIT allume) */
  private editing = false;
  private preset = false;
  private open = false;
  private hover = -1;
  private breath = 1;
  readonly flashes = new Uint32Array(PADS);

  constructor(private opts: VoyKeysOpts) {
    const pg = padGeometry(opts.mobile);
    this.padEm = new InstancedBufferAttribute(new Float32Array(PADS * 3), 3);
    this.padEm.setUsage(DynamicDrawUsage);
    pg.setAttribute('instanceEmissive', this.padEm);
    this.padMat = withInstanceEmissive(new MeshStandardMaterial({ vertexColors: true, ...MATERIAL.pad }), true);
    this.padMat.name = 'voyPad';
    this.pads = new InstancedMesh(pg, this.padMat, PADS);
    this.pads.name = 'voyPads';
    this.pads.castShadow = true;
    this.pads.receiveShadow = true;
    this.pads.instanceMatrix.setUsage(DynamicDrawUsage);

    const bg = buttonGeometry(opts.mobile);
    this.btnEm = new InstancedBufferAttribute(new Float32Array(BTNS * 3), 3);
    this.btnEm.setUsage(DynamicDrawUsage);
    bg.setAttribute('instanceEmissive', this.btnEm);
    this.btnMat = withInstanceEmissive(new MeshStandardMaterial({ vertexColors: true, ...MATERIAL.pad, ...(PLUGIN_ARP ? { roughness: PILL_KEYS ? 0.85 : 0.5 } : {}) }), true);
    this.btnMat.name = 'voyButton';
    this.buttons = new InstancedMesh(bg, this.btnMat, BTNS);
    this.buttons.name = 'voyButtons';
    this.buttons.castShadow = !opts.mobile;
    this.buttons.receiveShadow = true;
    this.buttons.instanceMatrix.setUsage(DynamicDrawUsage);
    // v43 (le plugin, 73.webp) : la pilule d'un noir un peu plus clair que le cuir (27 / 255 a l'ecran, mesure)
    const KEY_K = PLUGIN_ARP ? 2.3 : 1;
    for (let i = 0; i < BTNS; i += 1) this.buttons.setColorAt(i, col.setRGB(KEY_K, KEY_K, KEY_K));
    if (!PLUGIN_ARP) this.buttons.setColorAt(OPEN_I, col.setRGB(OPEN_TINT[0], OPEN_TINT[1], OPEN_TINT[2]));
    // RUN/STOP : l'albedo de la touche RUN de la 808, divise par celui du caoutchouc
    const rubber = albedo('pad', new Color(), gainOf('pad'));
    // v43 (le plugin, Mika : "RUN/STOP n'est plus rouge") : une touche noire comme les autres, en accent quand l'arpege joue
    if (PLUGIN_ARP) this.buttons.setColorAt(RUN_I, col.setRGB(KEY_K, KEY_K, KEY_K));
    else this.buttons.setColorAt(RUN_I, col.setRGB(LIT.run[0] / rubber.r, LIT.run[1] / rubber.g, LIT.run[2] / rubber.b));
    this.buttons.instanceColor?.setUsage(DynamicDrawUsage);
    // Les boutons poussoirs : la matiere des touches (le caoutchouc, sa lumiere par instance), eteints ; un jeu par plan
    const mk = (where: VoyWhere): [InstancedMesh, InstancedBufferAttribute] => {
      const n = pushCount(where);
      const ug = pushGeometry(opts.mobile);
      const em = new InstancedBufferAttribute(new Float32Array(Math.max(1, n) * 3), 3);
      em.setUsage(DynamicDrawUsage);
      ug.setAttribute('instanceEmissive', em);
      const m = new InstancedMesh(ug, this.btnMat, n);
      m.name = where === 'panel' ? 'voyPushes' : 'voyDeckPushes';
      m.castShadow = !opts.mobile;
      m.receiveShadow = true;
      m.visible = n > 0;
      m.instanceMatrix.setUsage(DynamicDrawUsage);
      return [m, em];
    };
    const [pp, pe] = mk('panel');
    const [dp, de] = mk('deck');
    this.pushes = { panel: pp, deck: dp };
    this.pushEm = { panel: pe, deck: de };
    for (let i = 0; i < PUSHES; i += 1) {
      const s = PUSH_SLOT[i];
      this.pushes[s.where].setColorAt(s.j, col.setRGB(KEY_K, KEY_K, KEY_K));
      this.placePush(i);
    }
    // Son temoin : eteint, une fente (line) ; allume, jaune
    const lg = new PlaneGeometry(Math.min(BTN_LED.w, VOY_BUTTONS[RUN_I].w * 0.6), BTN_LED.d);
    lg.rotateX(-Math.PI / 2);
    this.ledMat = new MeshBasicMaterial({ color: this.ledOff, toneMapped: false });
    this.ledMat.name = 'voyRunLed';
    this.runLed = new Mesh(lg, this.ledMat);
    this.runLed.name = 'voyRunLed';
    // v43 (le plugin) : plus de barre sur RUN/STOP : sa LED ronde au-dessus, comme les autres touches (voyager/silk.ts)
    if (PLUGIN_ARP) this.runLed.visible = false;

    this.haloTex = makeHaloTexture();
    this.haloMat = new MeshBasicMaterial({ map: this.haloTex, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
    this.haloMat.name = 'voyHalo';
    const hg = new PlaneGeometry(1, 1);
    hg.rotateX(-Math.PI / 2);
    this.halos = new InstancedMesh(hg, this.haloMat, PADS + BTNS);
    this.halos.name = 'voyHalos';
    for (let i = 0; i < PADS; i += 1) {
      const p = voyPadAt(i);
      this.halos.setMatrixAt(i, m4.compose(v3.set(p.x, 0.003, p.z), q0, s3.set(VOY_PAD.size * 1.16, 1, VOY_PAD.depth * 1.22)));
      this.placePad(i);
    }
    VOY_BUTTONS.forEach((b, i) => {
      this.halos.setMatrixAt(PADS + i, m4.compose(v3.set(b.x, 0.003, b.z), q0, s3.set(b.w * 1.25, 1, b.d * 1.4)));
      this.placeButton(i);
    });
    if (PLUGIN_ARP) {
      // v43 : le halo d'une touche allumee epouse sa pilule (un flou de sa forme), les halos carres des pads n'y vont plus
      const b0 = VOY_BUTTONS[0];
      const m = HALO_PILL.margin;
      const tex = pillHaloTexture(b0.w, b0.d, m);
      const mat = new MeshBasicMaterial({ map: tex, transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
      mat.name = 'voyBtnHalo';
      const g = new PlaneGeometry(b0.w + 2 * m, b0.d + 2 * m);
      g.rotateX(-Math.PI / 2);
      const bh = new InstancedMesh(g, mat, BTNS);
      bh.name = 'voyBtnHalos';
      VOY_BUTTONS.forEach((b, i) => {
        bh.setMatrixAt(i, m4.compose(v3.set(b.x, 0.003, b.z), q0, s3.set(1, 1, 1)));
        bh.setColorAt(i, col.setRGB(0, 0, 0));
        this.halos.setMatrixAt(PADS + i, m4.makeScale(0, 0, 0));
      });
      bh.instanceMatrix.needsUpdate = true;
      bh.instanceColor?.setUsage(DynamicDrawUsage);
      this.btnHalos = bh;
    }
    this.halos.instanceMatrix.needsUpdate = true;
    this.halos.instanceColor?.setUsage(DynamicDrawUsage);
    for (let i = 0; i < PADS; i += 1) this.setPadGlow(i, this.padRest(i));
    for (let i = 0; i < BTNS; i += 1) this.setBtnGlow(i, this.btnRest(i));
  }

  private placePad(i: number): void {
    const p = voyPadAt(i);
    this.pads.setMatrixAt(i, m4.makeTranslation(p.x, this.padY[i], p.z));
    this.pads.instanceMatrix.needsUpdate = true;
  }

  private placeButton(i: number): void {
    const b = VOY_BUTTONS[i];
    this.buttons.setMatrixAt(i, m4.compose(v3.set(b.x, this.btnY[i], b.z), q0, PLUGIN_ARP ? s3.set(1, 1, 1) : s3.set(b.w, 1, b.d)));
    this.buttons.instanceMatrix.needsUpdate = true;
    // Le temoin suit sa touche quand elle s'enfonce
    if (i === RUN_I && this.runLed) this.runLed.position.set(b.x, this.btnY[i] + VOY_BUTTON.h + BTN_LED.y, b.z - b.d / 2 + BTN_LED.back);
  }

  private placePush(i: number): void {
    const p = voyKnobPlace(PUSH_IDS[i]);
    const { where, j } = PUSH_SLOT[i];
    // v27 (le plugin) : SUB OCT devient un levier 3D (plugin/arp/faceExtras.tsx) : sa touche cachee, sa zone de prise reste
    // v43 (Mika : "tous les boutons, meme CHORUS ... SUB OCT") : la touche-pilule revient, plus de levier
    this.pushes[where].setMatrixAt(j, m4.makeTranslation(p.x, this.pushY[i], p.z));
    this.pushes[where].instanceMatrix.needsUpdate = true;
  }

  private setPushGlow(i: number, g: Glow): void {
    const { where, j } = PUSH_SLOT[i];
    const em = this.pushEm[where];
    const a = em.array as Float32Array;
    const c = RGB[g];
    const lk = PLUGIN_ARP && g !== 'hover' ? HALO_PILL.fill : 1;
    a[j * 3] = c[0] * lk;
    a[j * 3 + 1] = c[1] * lk;
    a[j * 3 + 2] = c[2] * lk;
    em.needsUpdate = true;
  }

  /** Survol d'un bouton poussoir (son id de saisie, vk-subOct, vk-chorus ; null : aucun) ; true s'il faut une frame. */
  setPushHover(hotspot: string | null): boolean {
    const i = hotspot && hotspot.startsWith('vk-') ? PUSH_IDS.indexOf(hotspot.slice(3) as VoyKnobId) : -1;
    if (i === this.pushHover) return false;
    const prev = this.pushHover;
    this.pushHover = i;
    if (prev >= 0) this.setPushGlow(prev, this.pushRest(prev));
    if (i >= 0) this.setPushGlow(i, this.pushRest(i));
    return true;
  }

  /** v43 (le plugin) : un bouton poussoir allume (CHORUS en marche) : la pilule en accent. */
  private pushLit = new Uint8Array(PUSHES);
  private pushRest(i: number): Glow {
    if (this.pushLit[i]) return 'orange';
    return i === this.pushHover ? 'hover' : 'off';
  }
  setPushLit(id: VoyKnobId, on: boolean): boolean {
    const i = PUSH_IDS.indexOf(id);
    if (i < 0 || this.pushLit[i] === (on ? 1 : 0)) return false;
    this.pushLit[i] = on ? 1 : 0;
    this.setPushGlow(i, this.pushRest(i));
    return true;
  }

  /** Appui sur un bouton poussoir : il s'enfonce et remonte. */
  pressPush(id: VoyKnobId, now = performance.now()): void {
    const i = PUSH_IDS.indexOf(id);
    if (i < 0) return;
    this.tweenY(`vpush.${i}`, this.pushY[i], (v) => {
      this.pushY[i] = v;
      this.placePush(i);
    }, VOY_PUSH.press, now);
    this.opts.repaint();
  }

  private haloColor(i: number, g: Glow, k = 1): void {
    // le plugin (v31) : tous les halos a la couleur d'accent (ORANGE, reglable : refreshAccent)
    const tint = PLUGIN_ARP ? ORANGE : g === 'active' ? YELLOW_HI : g === 'queued' || g === 'orange' || g === 'orangeDim' ? ORANGE : YELLOW;
    if (this.btnHalos && i >= PADS) {
      // v43 : le halo de la pilule, un peu plus doux que celui d'un pad
      this.btnHalos.setColorAt(i - PADS, col.copy(tint).multiplyScalar(HALO[g] * k * HALO_PILL.gain));
      if (this.btnHalos.instanceColor) this.btnHalos.instanceColor.needsUpdate = true;
      return;
    }
    this.halos.setColorAt(i, col.copy(tint).multiplyScalar(HALO[g] * k));
    if (this.halos.instanceColor) this.halos.instanceColor.needsUpdate = true;
  }

  private setPadGlow(i: number, g: Glow): void {
    this.padGlow[i] = g;
    const a = this.padEm.array as Float32Array;
    const c = RGB[g];
    a[i * 3] = c[0];
    a[i * 3 + 1] = c[1];
    a[i * 3 + 2] = c[2];
    this.padEm.needsUpdate = true;
    this.haloColor(i, g);
  }

  /**
   * v43 (le plugin) : une touche s'allume ou s'eteint (accent, flash, EDIT ouvert...) : sa LED et son nom suivent
   * (rig.ts -> voyager/silk.ts setButtonLit) ; null au site.
   */
  onLit: ((id: VoyButtonId, on: boolean) => void) | null = null;
  private litNow = new Uint8Array(BTNS);

  private setBtnGlow(i: number, g: Glow): void {
    this.btnGlow[i] = g;
    // v43 (le plugin, 73.webp) : la pilule allumee d'un accent plein, pas blanchi (sa lumiere moins forte qu'un pad)
    const lk = PLUGIN_ARP && g !== 'hover' ? HALO_PILL.fill : 1;
    const on = g === 'orange' || g === 'active' || g === 'flash' ? 1 : 0;
    if (on !== this.litNow[i]) {
      this.litNow[i] = on;
      this.onLit?.(VOY_BUTTONS[i].id, on === 1);
    }
    const k = i === OPEN_I && g === 'orange' ? this.breath : 1;
    const a = this.btnEm.array as Float32Array;
    const c = RGB[g];
    a[i * 3] = c[0] * k * lk;
    a[i * 3 + 1] = c[1] * k * lk;
    a[i * 3 + 2] = c[2] * k * lk;
    this.btnEm.needsUpdate = true;
    this.haloColor(PADS + i, g, k);
  }

  private padRest(i: number): Glow {
    if (i === this.playing) return 'active';
    if (this.queued.has(i)) return 'queued';
    return i === this.hover ? 'hover' : 'faint';
  }

  private btnRest(i: number): Glow {
    const b = VOY_BUTTONS[i];
    // Le plugin MM-ARP (2026-11-09) : allume tant que le capot est ouvert, eteint sinon (jamais la respiration du site)
    if (b.id === 'open') return PLUGIN_ARP ? (this.open ? 'orange' : 'off') : this.open ? 'orangeDim' : 'orange';
    if (b.id === 'preset') return this.preset ? 'orange' : PADS + i === this.hover ? 'hover' : 'off';
    if (b.id === 'edit' && this.editing) return 'active';
    // v43 (le plugin) : RUN/STOP allume tant que l'arpege joue
    if (PLUGIN_ARP && b.id === 'run' && this.running) return 'orange';
    return PADS + i === this.hover ? 'hover' : 'off';
  }

  private refreshPad(i: number): void {
    if (i < 0 || i >= PADS || this.flashing[i]) return;
    const g = this.padRest(i);
    if (g !== this.padGlow[i]) this.setPadGlow(i, g);
  }

  private refreshBtn(i: number): void {
    if (i < 0 || i >= BTNS || this.flashing[PADS + i]) return;
    const g = this.btnRest(i);
    if (g !== this.btnGlow[i]) this.setBtnGlow(i, g);
  }

  buttonIndex(id: VoyButtonId): number {
    return VOY_BUTTONS.findIndex((b) => b.id === id);
  }

  /** La progression (pads en orange) et l'accord qui joue (yellowHi) ; true s'il faut une frame. */
  setChords(prog: readonly number[], playing: number): boolean {
    const next = new Set(prog);
    let changed = playing !== this.playing;
    for (let i = 0; i < PADS; i += 1) if (next.has(i) !== this.queued.has(i)) changed = true;
    if (!changed) return false;
    this.queued = next;
    this.playing = playing;
    for (let i = 0; i < PADS; i += 1) this.refreshPad(i);
    return true;
  }

  /** RUN/STOP allume tant que l'arpege joue ; true s'il faut une frame. */
  setRunning(on: boolean): boolean {
    if (on === this.running) return false;
    this.running = on;
    this.ledMat.color.copy(on ? this.ledOn : this.ledOff);
    if (PLUGIN_ARP) this.refreshBtn(RUN_I);
    return true;
  }

  /** PRESET allume tant que le mode presets est ouvert ; true s'il faut une frame. */
  setPreset(on: boolean): boolean {
    if (on === this.preset) return false;
    this.preset = on;
    if (PRESET_I >= 0) this.refreshBtn(PRESET_I);
    return true;
  }

  /**
   * EDIT au desktop (2026-10-05) : les pads se rangent dans le plateau,
   * l'ecran de la suite monte a leur place (voyager/seqscreen.ts) ; leurs
   * halos s'eteignent avec eux.
   */
  setPadsHidden(on: boolean): void {
    this.pads.visible = !on;
    for (let i = 0; i < PADS; i += 1) {
      const p = voyPadAt(i);
      const k = on ? 0 : 1;
      this.halos.setMatrixAt(i, m4.compose(v3.set(p.x, 0.003, p.z), q0, s3.set(k * VOY_PAD.size * 1.16, 1, k * VOY_PAD.depth * 1.22)));
    }
    this.halos.instanceMatrix.needsUpdate = true;
  }

  /** EDIT allume tant que la suite est ouverte (state/editor.ts) ; true s'il faut une frame. */
  setEditing(on: boolean): boolean {
    if (on === this.editing) return false;
    this.editing = on;
    this.refreshBtn(EDIT_I);
    return true;
  }

  setOpen(on: boolean): boolean {
    if (on === this.open) return false;
    this.open = on;
    this.refreshBtn(OPEN_I);
    return true;
  }

  /** Survol a la souris : un pad (0 a 7) ou un bouton (8 et plus) ; -1 : aucun. */
  setHover(slot: number): boolean {
    if (slot === this.hover) return false;
    const prev = this.hover;
    this.hover = slot;
    for (const s of [prev, slot]) {
      if (s < 0) continue;
      if (s < PADS) this.refreshPad(s);
      else this.refreshBtn(s - PADS);
    }
    return true;
  }

  /** Flash d'un pad (une note de l'arpege) : sa fin est une echeance relue par update(). */
  flashPad(i: number, ms: number, now: number): void {
    if (i < 0 || i >= PADS) return;
    this.flashUntil[i] = this.flashing[i] ? Math.max(this.flashUntil[i], now + ms) : now + ms;
    this.flashing[i] = 1;
    this.flashes[i] += 1;
    if (this.padGlow[i] !== 'flash') this.setPadGlow(i, 'flash');
    this.opts.repaint();
  }

  private flashBtn(i: number, now: number): void {
    const s = PADS + i;
    this.flashUntil[s] = now + PAD_FX.flashMs * 2;
    this.flashing[s] = 1;
    if (this.btnGlow[i] !== 'flash') this.setBtnGlow(i, 'flash');
  }

  private tweenY(key: string, from: number, set: (v: number) => void, depth: number, now: number): void {
    if (this.opts.reduced()) return;
    const tw = this.opts.tweens;
    tw.run(key, set, from, -depth, PAD_FX.downMs, linear, now, (end) => tw.run(key, set, -depth, 0, PAD_FX.upMs, easeOutCubic, end));
  }

  /** Appui sur un pad : il s'enfonce (la lumiere suit l'arpege). */
  pressPad(i: number, now = performance.now()): void {
    if (i < 0 || i >= PADS) return;
    this.tweenY(`vpad.${i}`, this.padY[i], (v) => {
      this.padY[i] = v;
      this.placePad(i);
    }, 0.06, now);
    this.flashPad(i, PAD_FX.flashMs, now);
  }

  /** Appui sur un bouton : il s'enfonce ; CLEAR, RANDOM et PRESET eclairent. */
  pressButton(id: VoyButtonId, now = performance.now()): void {
    const i = this.buttonIndex(id);
    if (i < 0) return;
    this.tweenY(`vbtn.${i}`, this.btnY[i], (v) => {
      this.btnY[i] = v;
      this.placeButton(i);
    }, VOY_BUTTON.press, now);
    if (id === 'clear' || id === 'random' || id === 'preset') this.flashBtn(i, now);
    this.opts.repaint();
  }

  /** Animateur : eteint les flashs echus ('paint') ; 'poll' tant qu'un flash attend. */
  update(now: number): 'paint' | 'poll' | false {
    let changed = false;
    let pending = false;
    for (let s = 0; s < PADS + BTNS; s += 1) {
      if (!this.flashing[s]) continue;
      if (now >= this.flashUntil[s]) {
        this.flashing[s] = 0;
        if (s < PADS) this.setPadGlow(s, this.padRest(s));
        else this.setBtnGlow(s - PADS, this.btnRest(s - PADS));
        changed = true;
      } else pending = true;
    }
    return changed ? 'paint' : pending ? 'poll' : false;
  }

  /**
   * v31 : la couleur d'accent du plugin a change (theme.ts setPluginAccent, deja pose) : les halos et les lueurs des pads,
   * des boutons et des poussoirs reprennent leurs teintes. Le rendu suit (repaint).
   */
  refreshAccent(): void {
    ORANGE.setHex(COLOR.orange);
    for (let i = 0; i < PADS; i += 1) this.setPadGlow(i, this.padGlow[i]);
    for (let i = 0; i < BTNS; i += 1) this.setBtnGlow(i, this.btnGlow[i]);
    for (let i = 0; i < PUSHES; i += 1) this.setPushGlow(i, this.pushRest(i));
    this.opts.repaint();
  }

  /** OPEN respire, comme celui de la 808 ; true si sa lumiere a change. */
  breathe(now: number): boolean {
    if (this.btnGlow[OPEN_I] !== 'orange') return false;
    const B = OPEN_BREATHE;
    const phase = Math.round((0.5 + 0.5 * Math.cos((2 * Math.PI * now) / B.periodMs)) * 100) / 100;
    const k = B.min + (1 - B.min) * phase;
    if (k === this.breath) return false;
    this.breath = k;
    this.setBtnGlow(OPEN_I, 'orange');
    const f = B.tintMin + (1 - B.tintMin) * phase;
    // v43 (le plugin) : la pilule d'OPEN reste noire, seule sa lumiere respire
    if (!PLUGIN_ARP) this.buttons.setColorAt(OPEN_I, col.setRGB(OPEN_TINT[0] * f, OPEN_TINT[1] * f, OPEN_TINT[2] * f));
    if (this.buttons.instanceColor) this.buttons.instanceColor.needsUpdate = true;
    return true;
  }

  stopBreath(): boolean {
    if (this.breath === 1) return false;
    this.breath = 1;
    this.setBtnGlow(OPEN_I, this.btnGlow[OPEN_I]);
    if (!PLUGIN_ARP) this.buttons.setColorAt(OPEN_I, col.setRGB(OPEN_TINT[0], OPEN_TINT[1], OPEN_TINT[2]));
    if (this.buttons.instanceColor) this.buttons.instanceColor.needsUpdate = true;
    return true;
  }

  get breathing(): boolean {
    return this.btnGlow[OPEN_I] === 'orange';
  }

  hotspots(layer: Object3D): HotspotDef[] {
    const out: HotspotDef[] = [];
    // Au telephone (2026-10-22, audit SB-03 : 36 x 29 px, Mika les voulait plus petits le 2026-10-05) : le pad garde sa
    // taille, sa zone descend jusque sous le nom de l'accord
    const below = PORTRAIT ? VOY_PAD.labelDz + 0.12 : VOY_PAD.depth / 2;
    for (let i = 0; i < PADS; i += 1) {
      const p = voyPadAt(i);
      out.push({
        id: `vpad-${i}`,
        kind: 'vpad',
        layer,
        shape: 'box',
        x: p.x,
        z: p.z + (below - VOY_PAD.depth / 2) / 2,
        hx: VOY_PAD.size / 2,
        hz: (below + VOY_PAD.depth / 2) / 2,
        y0: 0,
        y1: VOY_PAD.height + VOY_PAD.dome,
        enabled: true,
        vpad: i,
      });
    }
    for (const b of VOY_BUTTONS) {
      const base = { layer, shape: 'box' as const, x: b.x, z: b.z, hx: b.w / 2, hz: b.d / 2, y0: 0, y1: VOY_BUTTON.h, enabled: true };
      if (b.id === 'open') out.push({ ...base, id: 'vbtn-open', kind: 'vopen' });
      else out.push({ ...base, id: `vbtn-${b.id}`, kind: 'vbtn', vbtn: b.id });
    }
    return out;
  }

  /**
   * Les boutons poussoirs pour le picking (vk-<id>, comme un potard : INFOS, MIDI LEARN, le jumeau) ; chacun dans le
   * repere de son plan (layers : le panneau, le plateau). La zone prend les LED et leurs noms ; au telephone aussi le
   * nom dessous, et au moins la demi-colonne d'un potard en largeur (touchR).
   */
  pushHotspots(layers: Record<VoyWhere, Object3D>): HotspotDef[] {
    return PUSH_IDS.map((id, i) => {
      const layer = layers[PUSH_SLOT[i].where];
      const p = voyKnobPlace(id);
      const top = Math.min(p.z - VOY_PUSH.d / 2, ...voyPushLeds(id, voyKnob(id).steps ?? []).map((l) => l.tz)) - 0.05;
      const bottom = PORTRAIT ? p.labelZ + 0.06 : p.z + VOY_PUSH.d / 2 + 0.03;
      const hx = Math.max(VOY_KNOB.touchR, VOY_PUSH.w / 2 + 0.04);
      return {
        id: `vk-${id}`,
        kind: 'vpush' as const,
        layer,
        shape: 'box' as const,
        x: p.x,
        z: (top + bottom) / 2,
        hx,
        hz: (bottom - top) / 2,
        y0: 0,
        y1: VOY_PUSH.h,
        enabled: true,
        vknob: id,
      };
    });
  }

  info(): { padGlow: Glow[]; btnGlow: Glow[]; flashes: number[]; playing: number; queued: number[]; pushes: { id: VoyKnobId; y: number; hover: boolean }[] } {
    return {
      padGlow: [...this.padGlow],
      btnGlow: [...this.btnGlow],
      flashes: Array.from(this.flashes),
      playing: this.playing,
      queued: [...this.queued],
      pushes: PUSH_IDS.map((id, i) => ({ id, y: +this.pushY[i].toFixed(4), hover: i === this.pushHover })),
    };
  }

  dispose(): void {
    for (const m of [this.pads, this.buttons, this.halos, ...WHERES.map((w) => this.pushes[w])]) {
      m.geometry.dispose();
      m.dispose();
    }
    this.runLed.geometry.dispose();
    this.ledMat.dispose();
    this.padMat.dispose();
    this.btnMat.dispose();
    this.haloMat.dispose();
    this.haloTex.dispose();
    if (this.btnHalos) {
      this.btnHalos.geometry.dispose();
      const bm = this.btnHalos.material as MeshBasicMaterial;
      bm.map?.dispose();
      bm.dispose();
      this.btnHalos.dispose();
    }
  }
}
