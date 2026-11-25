/**
 * Le logo en relief de l'arrivee (2026-11-11, Mika : "mon logo qui arrive en 3d MAUDITE MACHINE puis se transforme en 2d,
 * ca doit venir en animation de gros a centre ; garde les couleurs du site, la 3d doit etre parfaite").
 *
 * Le vrai trace du logo (arrival/logoPaths.ts) extrude avec un chanfrein : le mot en or (#FFA600) et le logotype en jaune
 * (#F2C230), leurs flancs dans l'orange du site (#FF6A13) ; en clair, les gris du logo. Un materiau de metal eclaire par
 * une salle (RoomEnvironment), une lumiere cle et un eclat qui balaie les lettres.
 *
 * La camera est en perspective, posee pour qu'une unite du plan z = 0 vaille un pixel CSS : le logo pose a plat tombe
 * exactement dans les rectangles qu'on lui donne (ceux du logo 2D de l'arrivee, arrival/Arrival.tsx), au pixel pres.
 *
 * frame(a) dessine l'entree, a de 0 a 1 :
 *   0 a FLY      le logo arrive enorme (S0 fois sa taille), tourne et couche, et se redresse en reculant vers le centre ;
 *   FLY a FLAT   il tient en relief, un eclat le traverse ;
 *   FLAT a 1     le relief s'ecrase (la profondeur a 0), le metal devient l'aplat exact du logo 2D : a 1, l'image est
 *                celle du logo plat, le DOM prend le relais sans saut.
 * Rien d'autre que three (deja dans la machine) ; le canevas a son propre contexte, rendu puis jete a la fin de l'entree.
 */

import {
  AmbientLight,
  Color,
  DirectionalLight,
  DoubleSide,
  ExtrudeGeometry,
  Group,
  Mesh,
  MeshStandardMaterial,
  NoToneMapping,
  PMREMGenerator,
  PerspectiveCamera,
  PointLight,
  Scene,
  WebGLRenderer,
  type Shape,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { SVGLoader } from 'three/examples/jsm/loaders/SVGLoader.js';
import { MARK_PATHS, MARK_VIEW, WORD_PATHS, WORD_VIEW } from './logoPaths';

export interface Rect {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** Les teintes du logo en relief : la face et le flanc du mot et du logotype, par apparence (celles du site). */
export const LOGO_TINT = {
  dark: { word: '#ffa600', wordSide: '#ff6a13', mark: '#f2c230', markSide: '#ff6a13' },
  light: { word: '#434343', wordSide: '#191919', mark: '#737373', markSide: '#434343' },
} as const;

/** Les temps de l'entree (parts de a) et sa forme. */
const FLY = 0.7;
const FLAT = 0.81;
/** La taille de depart (fois la taille posee), la profondeur du relief (part de la hauteur du mot), le champ (deg). */
const S0 = 7.5;
const DEPTH = 0.5;
const FOV = 26;
/** La lumiere : la cle, l'ambiance, les reflets de la salle (la face, le flanc), l'emission de depart (la teinte dans l'ombre). */
const KEY = 1.7;
const FILL = 0.22;
const ENV = { face: 0.26, side: 0.3 } as const;
const GLOW = { face: 0.18, side: 0.16 } as const;
/** L'eclat qui traverse les lettres : son eclairement au plus pres. */
const GLINT = 0.8;

const clamp01 = (v: number): number => (v < 0 ? 0 : v > 1 ? 1 : v);
const easeOutCubic = (t: number): number => 1 - Math.pow(1 - t, 3);
const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);

/** Les formes d'un trace SVG (ses sous-chemins, ses trous). */
function shapesOf(paths: readonly string[], view: { w: number; h: number }): Shape[] {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${view.w} ${view.h}">${paths.map((d) => `<path d="${d}"/>`).join('')}</svg>`;
  const data = new SVGLoader().parse(svg);
  return data.paths.flatMap((p) => SVGLoader.createShapes(p));
}

/**
 * La piece extrudee d'un trace : son origine au centre de son viewBox, y vers le haut, une unite de large et de haut (le
 * viewBox ramene a 1 x 1 : scale.x et scale.y sont alors ses dimensions en pixels), la profondeur de 0 (la face avant) a
 * -1 (le fond) : scale.z est sa profondeur en pixels. Le chanfrein rentre dans la forme (bevelOffset) : la silhouette de
 * face reste celle du trace, au pixel pres.
 */
function piece(paths: readonly string[], view: { w: number; h: number }): ExtrudeGeometry {
  const unit = view.h;
  const bevel = unit * 0.018;
  const depth = unit * 0.5;
  const g = new ExtrudeGeometry(shapesOf(paths, view), { depth, bevelEnabled: true, bevelThickness: bevel, bevelSize: bevel, bevelOffset: -bevel, bevelSegments: 4, curveSegments: 6, steps: 1 });
  // Le trace : y vers le bas, de 0 a view ; la face avant en z = depth + bevel. Recentre, retourne, la face avant a z = 0
  g.translate(-view.w / 2, -view.h / 2, -(depth + bevel));
  g.scale(1 / view.w, -1 / view.h, 1 / (depth + 2 * bevel));
  g.computeVertexNormals();
  return g;
}

export class Logo3D {
  readonly canvas: HTMLCanvasElement;
  private renderer: WebGLRenderer;
  private scene = new Scene();
  private camera = new PerspectiveCamera(FOV, 1, 1, 100000);
  private group = new Group();
  private word: Mesh;
  private mark: Mesh;
  private faces: MeshStandardMaterial[] = [];
  private sides: MeshStandardMaterial[] = [];
  private faceTint: Color[] = [];
  private sideTint: Color[] = [];
  private glint = new PointLight(0xffffff, 0, 0, 2);
  private key = new DirectionalLight(0xffffff, KEY);
  private fill = new AmbientLight(0xffffff, FILL);
  private w = 1;
  private h = 1;
  private disposed = false;

  constructor(look: 'dark' | 'light') {
    const canvas = document.createElement('canvas');
    this.canvas = canvas;
    this.renderer = new WebGLRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
    this.renderer.setClearColor(0x000000, 0);
    // Pas de courbe de tons : a plat, la teinte emise est celle du logo 2D, exacte, sans saut a la derniere image
    this.renderer.toneMapping = NoToneMapping;
    // La salle : les reflets du metal (un environnement neutre, flou)
    const pm = new PMREMGenerator(this.renderer);
    this.scene.environment = pm.fromScene(new RoomEnvironment(), 0.04).texture;
    pm.dispose();
    // La salle tournee d'un quart de tour : sa grande lumiere n'est plus dans le dos de la camera (de face, le logo la
    // renvoyait en plein, l'or virait au jaune vif), les faces gardent leur teinte tout le vol, les flancs la prennent
    this.scene.environmentRotation.set(0, Math.PI / 2, 0);
    const t = LOGO_TINT[look];
    const mat = (hex: string, side: boolean): MeshStandardMaterial => {
      // Un metal satine : assez mat pour que la face garde sa teinte (l'or ne vire pas au jaune sous la lumiere), assez
      // lisse pour que l'eclat y passe ; les flancs un peu plus mats
      const m = new MeshStandardMaterial({ color: new Color(hex), metalness: side ? 0.3 : 0.38, roughness: side ? 0.5 : 0.4, envMapIntensity: side ? ENV.side : ENV.face, emissive: new Color(hex), emissiveIntensity: 0, side: DoubleSide });
      (side ? this.sides : this.faces).push(m);
      (side ? this.sideTint : this.faceTint).push(new Color(hex));
      return m;
    };
    this.word = new Mesh(piece(WORD_PATHS, WORD_VIEW), [mat(t.word, false), mat(t.wordSide, true)]);
    this.mark = new Mesh(piece(MARK_PATHS, MARK_VIEW), [mat(t.mark, false), mat(t.markSide, true)]);
    this.group.add(this.word, this.mark);
    this.scene.add(this.group, this.key, this.fill, this.glint);
    this.key.position.set(-0.35, 0.8, 1);
  }

  /** La taille du canevas (px CSS) et sa densite ; la camera : une unite du plan z = 0 vaut un pixel. */
  resize(w: number, h: number, dpr: number): void {
    this.w = Math.max(1, w);
    this.h = Math.max(1, h);
    this.renderer.setPixelRatio(Math.min(2, Math.max(1, dpr)));
    this.renderer.setSize(this.w, this.h, false);
    this.camera.aspect = this.w / this.h;
    this.camera.position.set(0, 0, this.h / 2 / Math.tan((FOV * Math.PI) / 360));
    this.camera.lookAt(0, 0, 0);
    this.camera.updateProjectionMatrix();
  }

  /**
   * Une image de l'entree : a de 0 a 1 ; word et mark, les rectangles (px CSS, origine en haut a gauche du canevas) ou
   * le mot et le logotype se posent a plat.
   */
  frame(a: number, word: Rect, mark: Rect): void {
    if (this.disposed) return;
    const t = clamp01(a);
    const W = this.w;
    const H = this.h;
    // Le centre de l'ensemble (le pivot du vol), en unites de scene (x a droite, y en haut, origine au centre du canevas)
    const x0 = Math.min(word.x, mark.x);
    const x1 = Math.max(word.x + word.w, mark.x + mark.w);
    const y0 = Math.min(word.y, mark.y);
    const y1 = Math.max(word.y + word.h, mark.y + mark.h);
    const cx = (x0 + x1) / 2 - W / 2;
    const cy = H / 2 - (y0 + y1) / 2;
    // Le relief : la profondeur (px), ecrasee de FLAT a 1
    const flat = easeInOutCubic(clamp01((t - FLAT) / (1 - FLAT)));
    const depth = Math.max(0.001, word.h * DEPTH * (1 - flat));
    const place = (m: Mesh, r: Rect): void => {
      m.position.set(r.x + r.w / 2 - W / 2 - cx, H / 2 - (r.y + r.h / 2) - cy, 0);
      m.scale.set(r.w, r.h, depth);
    };
    place(this.word, word);
    place(this.mark, mark);

    // Le vol : d'enorme a pose, il se redresse en arrivant (un leger depassement de la rotation, puis le calme)
    // La taille tombe vite puis se pose doucement ; la rotation suit une courbe en S (il reste tourne tant qu'il est
    // gros, se redresse en arrivant), avec un rien de depassement a la fin
    const f = clamp01(t / FLY);
    const s = 1 + (S0 - 1) * (1 - easeOutCubic(f));
    const c = Math.cos((f * Math.PI) / 2);
    const turn = c * c - 0.045 * Math.sin(Math.PI * clamp01((f - 0.72) / 0.28));
    const hold = clamp01((t - FLY) / (FLAT - FLY));
    // En relief, il flotte un rien (il respire avant de se poser a plat) ; a plat, plus rien ne tourne
    const sway = Math.sin(hold * Math.PI) * (1 - flat) * 0.05;
    this.group.rotation.set(0.42 * turn + 0.02 * Math.sin(hold * Math.PI), -1.12 * turn + sway, -0.1 * turn);
    this.group.scale.setScalar(s);
    // Il arrive d'en bas a gauche et de pres (vers la camera), en arc
    const away = 1 - easeOutCubic(f);
    this.group.position.set(cx - W * 0.16 * away, cy - H * 0.1 * away, 0);

    // Le metal devient l'aplat : l'emission prend la teinte exacte, la couleur eclairee s'eteint
    const lit = 1 - flat;
    for (let i = 0; i < this.faces.length; i += 1) {
      this.faces[i].color.copy(this.faceTint[i]).multiplyScalar(lit);
      this.faces[i].emissiveIntensity = GLOW.face + (1 - GLOW.face) * flat;
      this.faces[i].envMapIntensity = ENV.face * lit;
      this.sides[i].color.copy(this.sideTint[i]).multiplyScalar(lit);
      this.sides[i].emissive.copy(this.sideTint[i]).lerp(this.faceTint[i], flat);
      this.sides[i].emissiveIntensity = GLOW.side + (1 - GLOW.side) * flat;
      this.sides[i].envMapIntensity = ENV.side * lit;
    }
    this.key.intensity = KEY * lit;
    this.fill.intensity = FILL * lit;
    // L'eclat : une lumiere qui traverse les lettres de gauche a droite pendant l'arrivee et la tenue
    const g = clamp01((t - 0.28) / (FLAT - 0.28));
    const span = (x1 - x0) * 0.75 + 200;
    const gz = word.h * 1.6;
    this.glint.position.set(cx - span + 2 * span * g, cy + word.h * 0.7, gz);
    // Une lumiere ponctuelle s'eteint au carre de la distance : son intensite suit le carre de sa hauteur (px)
    this.glint.intensity = Math.sin(g * Math.PI) * lit * gz * gz * GLINT;
    this.renderer.render(this.scene, this.camera);
  }

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.word.geometry.dispose();
    this.mark.geometry.dispose();
    for (const m of [...this.faces, ...this.sides]) m.dispose();
    this.scene.environment?.dispose();
    this.renderer.dispose();
    this.renderer.forceContextLoss();
  }
}
