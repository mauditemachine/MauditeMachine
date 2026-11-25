/**
 * v39 (2026-11-19, Mika : "a tres grande taille les knobs pixellisent", "qu'ils paraissent toujours les memes") : la page
 * qui rend les trois couches des potards d'OPEN (retro/knob-base.png, knob-grip.png, knob-cap.png) en 1024 px, depuis les
 * geometries et les peintures du potard de la face (voyager/rytmKnob.ts), vu exactement de dessus (camera orthographique
 * dans l'axe), fond transparent. Le cadrage de toujours : la boite = la base + 4 % (pcbui.tsx KNOB_IMG).
 * Lancee par knob-shots.mjs (npm run plugin:arp:knobs) : window.__knobShot(couche, taille) rend les pixels RGBA.
 *
 * - base : l'anneau de la base et son reflet fixe, un disque sombre dessous (la prise le couvre) ;
 * - grip : la prise a six lobes, sans repere, jupe mate (voyager/knobs.ts v37 : rugosite 0.7, ni vernis ni studio), le
 *   chanfrein des cretes peint comme le dessus (pas de liseré clair, Mika : "le relief lumineux sur le bord, j'en veux
 *   pas") ; un lobe sous le repere (en haut) ;
 * - cap : le dessus du capuchon de metal brosse (sa peinture et le studio de la face).
 */
import {
  ACESFilmicToneMapping,
  BufferGeometry,
  CircleGeometry,
  DirectionalLight,
  Float32BufferAttribute,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshPhysicalMaterial,
  MeshStandardMaterial,
  OrthographicCamera,
  Scene,
  SRGBColorSpace,
  WebGLRenderer,
} from 'three';
import { KNOB_LOOK } from '../../../src/v4/rytm/knobLook';
import { RYTM_KNOB, rytmKnobGeometry, rytmKnobTexture, rytmKnobTopGeometry, studioEnv } from '../../../src/v4/voyager/rytmKnob';

type Layer = 'base' | 'grip' | 'cap';

/** L'exposition de chaque couche, calee sur les images de 260 px d'avant (meme gris moyen, mesure a 260 px). */
const EXPOSURE: Record<Layer, number> = { base: 1.32, grip: 1.75, cap: 1.36 };

const R = RYTM_KNOB.R;
const H = RYTM_KNOB.h;
const H1 = H * 0.22;
const H2 = H * 0.6;

/** Les triangles d'une geometrie non indexee dont les trois sommets passent le test (sur y). */
function pick(g: BufferGeometry, keep: (y: number) => boolean): BufferGeometry {
  const out = new BufferGeometry();
  const names = Object.keys(g.attributes);
  const p = g.getAttribute('position');
  const tris: number[] = [];
  for (let t = 0; t < p.count; t += 3) if (keep(p.getY(t)) && keep(p.getY(t + 1)) && keep(p.getY(t + 2))) tris.push(t);
  for (const n of names) {
    const a = g.getAttribute(n);
    const d = new Float32Array(tris.length * 3 * a.itemSize);
    let o = 0;
    for (const t of tris) for (let v = 0; v < 3; v += 1) for (let c = 0; c < a.itemSize; c += 1) d[o++] = a.getComponent(t + v, c);
    out.setAttribute(n, new Float32BufferAttribute(d, a.itemSize));
  }
  return out;
}

/** Un disque sombre et mat a la hauteur y (sous la prise pour la base ; au pied du capuchon pour la prise). */
function disc(r: number, y: number, grey: number): Mesh {
  const g = new CircleGeometry(r, 256);
  g.rotateX(-Math.PI / 2);
  g.translate(0, y, 0);
  const v = grey / 255;
  return new Mesh(g, new MeshBasicMaterial({ color: (Math.round(v * 255) << 16) | (Math.round(v * 255) << 8) | Math.round(v * 255), toneMapped: false }));
}

function sceneOf(layer: Layer): Scene {
  const scene = new Scene();
  // La lumiere de la face vue du potard : la cle en haut a gauche (le reflet fixe de la base y est peint), un ciel doux
  const key = new DirectionalLight(0xfff6e8, 2.2);
  key.position.set(-0.55, 1.4, -0.45);
  const hemi = new HemisphereLight(0xefe9dd, 0x111111, 0.35);
  scene.add(key, hemi);
  const env = studioEnv();
  if (layer === 'grip') {
    // la jupe de la face (voyager/knobs.ts, v37) ; le chanfrein peint comme le dessus de la prise : pas de liseré clair
    const g = rytmKnobGeometry(false, false);
    const col = g.getAttribute('color');
    const p = g.getAttribute('position');
    const n = g.getAttribute('normal');
    // le dessus de la prise (normale verticale) : sa couleur sert de reference au chanfrein
    let ref = [0, 0, 0];
    for (let i = 0; i < p.count; i += 1) {
      if (Math.abs(p.getY(i) - H2) < 1e-5 && n.getY(i) > 0.999) {
        ref = [col.getX(i), col.getY(i), col.getZ(i)];
        break;
      }
    }
    for (let i = 0; i < p.count; i += 1) {
      const y = p.getY(i);
      if (y > H2 - R * 0.04 - 1e-5 && y < H2 - 1e-6) col.setXYZ(i, ref[0], ref[1], ref[2]);
    }
    const mat = new MeshPhysicalMaterial({ vertexColors: true, roughness: 0.7, metalness: 0, clearcoat: 0, envMap: env, envMapIntensity: 0 });
    scene.add(new Mesh(g, mat));
    // au pied du capuchon : le flanc du capuchon, sombre (le capuchon fixe le couvre ; rien de transparent sous lui)
    scene.add(disc(R * KNOB_LOOK.cap * 1.001, H2 + 1e-4, 14));
  } else {
    const top = rytmKnobTopGeometry(false);
    const mat = new MeshStandardMaterial({ vertexColors: true, roughness: 0.28, metalness: 0.5, map: rytmKnobTexture(), envMap: env, envMapIntensity: 1.4 });
    if (layer === 'cap') scene.add(new Mesh(pick(top, (y) => Math.abs(y - H) < 1e-5), mat));
    else {
      scene.add(new Mesh(pick(top, (y) => Math.abs(y - H) > 1e-5), mat));
      // sous la prise : le fond sombre de la base (16, comme l'image d'avant)
      scene.add(disc(R * (KNOB_LOOK.notch - 0.035), H1 - 1e-4, 16));
    }
  }
  return scene;
}

/** Les pixels RGBA (non premultiplies, sRGB) de la couche, size x size, rendus a ss fois puis reduits. */
function shot(layer: Layer, size: number, exposure = EXPOSURE[layer], ss = 4): Uint8ClampedArray {
  const big = size * ss;
  const renderer = new WebGLRenderer({ antialias: false, alpha: true, premultipliedAlpha: false, preserveDrawingBuffer: true });
  renderer.setPixelRatio(1);
  renderer.setSize(big, big, false);
  renderer.toneMapping = ACESFilmicToneMapping;
  renderer.toneMappingExposure = exposure;
  renderer.outputColorSpace = SRGBColorSpace;
  renderer.setClearColor(0x000000, 0);
  const e = R * 1.04;
  const cam = new OrthographicCamera(-e, e, e, -e, 0.01, 10);
  cam.position.set(0, 3, 0);
  cam.up.set(0, 0, -1);
  cam.lookAt(0, 0, 0);
  const scene = sceneOf(layer);
  // rendu dans le canevas (ton ACES et sortie sRGB de la face), sans MSAA : chaque echantillon est plein ou vide, la
  // reduction fait l'antialiasing (alpha droit)
  renderer.render(scene, cam);
  const gl = renderer.getContext();
  const px = new Uint8Array(big * big * 4);
  gl.readPixels(0, 0, big, big, gl.RGBA, gl.UNSIGNED_BYTE, px);
  renderer.dispose();
  // reduction ss x ss : moyenne en lumiere lineaire, ponderee par l'alpha ; les lignes de la cible sont a l'envers
  const toLin = new Float32Array(256);
  for (let i = 0; i < 256; i += 1) {
    const c = i / 255;
    toLin[i] = c <= 0.04045 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
  }
  const enc = (l: number): number => {
    const v = Math.max(0, Math.min(1, l));
    return Math.round(255 * (v <= 0.0031308 ? 12.92 * v : 1.055 * Math.pow(v, 1 / 2.4) - 0.055));
  };
  const out = new Uint8ClampedArray(size * size * 4);
  for (let y = 0; y < size; y += 1) {
    for (let x = 0; x < size; x += 1) {
      let r = 0;
      let g = 0;
      let b = 0;
      let a = 0;
      for (let j = 0; j < ss; j += 1) {
        const sy = big - 1 - (y * ss + j);
        for (let i = 0; i < ss; i += 1) {
          const o = (sy * big + x * ss + i) * 4;
          const al = px[o + 3] / 255;
          r += toLin[px[o]] * al;
          g += toLin[px[o + 1]] * al;
          b += toLin[px[o + 2]] * al;
          a += al;
        }
      }
      const q = (y * size + x) * 4;
      if (a > 0) {
        out[q] = enc(r / a);
        out[q + 1] = enc(g / a);
        out[q + 2] = enc(b / a);
      }
      out[q + 3] = Math.round((255 * a) / (ss * ss));
    }
  }
  return out;
}

(window as unknown as { __knobShot: (layer: Layer, size: number, exposure?: number) => string }).__knobShot = (layer, size, exposure) => {
  const d = shot(layer, size, exposure ?? EXPOSURE[layer]);
  let s = '';
  for (let i = 0; i < d.length; i += 0x8000) s += String.fromCharCode(...d.subarray(i, i + 0x8000));
  return btoa(s);
};
