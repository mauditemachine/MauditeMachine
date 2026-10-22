/**
 * Le reflet du verre des ecrans (2026-10-22, audit, amelioration 20 : les
 * ecrans etaient des MeshBasicMaterial plats, "en clair, on dirait un
 * rectangle noir colle"). Un plan juste au-dessus du verre, en additif : une
 * lueur diagonale depuis le coin haut gauche (SHEEN.corner au plus), un filet
 * de lumiere le long du bord haut (SHEEN.edge), rien sur le reste du verre. Le
 * texte garde son contraste : mesure sur l'ecran du RYTM (1440 x 900, sur 255),
 * le noir du verre passe de 5 a 13 dans le coin, a 19 sur le filet du haut, a 8
 * au milieu du bord haut, ne bouge pas dans la moitie basse. Une seule texture pour tous les ecrans
 * (RYTM, ARP et sa sequence, BASS, DECKS) ; le plan ne prend aucun clic (la
 * saisie passe par scene/hit.ts, le raycast de l'ecran du RYTM n'est pas
 * recursif).
 */
import { AdditiveBlending, BufferGeometry, CanvasTexture, LinearFilter, Mesh, MeshBasicMaterial, PlaneGeometry } from 'three';
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js';

/** Les intensites du reflet (alpha d'un blanc chaud ajoute au verre). */
const SHEEN = { corner: 0.045, mid: 0.012, edge: 0.055, edgeH: 0.035 } as const;

let shared: CanvasTexture | null = null;
let users = 0;

function sheenTexture(): CanvasTexture {
  if (shared) return shared;
  const W = 256;
  const H = 160;
  const canvas = document.createElement('canvas');
  canvas.width = W;
  canvas.height = H;
  const ctx = canvas.getContext('2d');
  if (ctx) {
    ctx.clearRect(0, 0, W, H);
    // La lueur : du coin haut gauche vers le milieu du verre, eteinte avant le coin bas droit
    const g = ctx.createLinearGradient(0, 0, W * 0.62, H);
    g.addColorStop(0, `rgba(255, 250, 240, ${SHEEN.corner})`);
    g.addColorStop(0.38, `rgba(255, 250, 240, ${SHEEN.mid})`);
    g.addColorStop(0.62, 'rgba(255, 250, 240, 0)');
    ctx.fillStyle = g;
    ctx.fillRect(0, 0, W, H);
    // Le filet du bord haut : la lumiere du plafond accroche l'arete du verre
    const e = ctx.createLinearGradient(0, 0, 0, H * SHEEN.edgeH);
    e.addColorStop(0, `rgba(255, 250, 240, ${SHEEN.edge})`);
    e.addColorStop(1, 'rgba(255, 250, 240, 0)');
    ctx.fillStyle = e;
    ctx.fillRect(0, 0, W, H * SHEEN.edgeH);
  }
  shared = new CanvasTexture(canvas);
  // Un degrade lisse : ni mipmaps ni anisotropie a payer
  shared.generateMipmaps = false;
  shared.minFilter = LinearFilter;
  shared.magFilter = LinearFilter;
  return shared;
}

function sheenMaterial(): MeshBasicMaterial {
  const m = new MeshBasicMaterial({ map: sheenTexture(), transparent: true, blending: AdditiveBlending, depthWrite: false, toneMapped: false });
  m.name = 'glassSheen';
  return m;
}

/** Un plan de verre couche (comme les ecrans : rangee 0 de la texture vers l'arriere), w x d, a (x, y, z). */
function plane(w: number, d: number, x: number, y: number, z: number): BufferGeometry {
  const g = new PlaneGeometry(w, d);
  g.rotateX(-Math.PI / 2);
  g.translate(x, y, z);
  return g;
}

/**
 * Le reflet d'un ecran couche de w x d, a poser en enfant de son mesh (centre
 * sur lui, lift au-dessus) ; rects : plusieurs verres d'un meme mesh (DECKS),
 * dans le repere du mesh.
 */
export function glassSheen(w: number, d: number, lift = 0.0008, rects?: readonly { w: number; d: number; x: number; y: number; z: number }[]): Mesh {
  users += 1;
  const parts = rects ? rects.map((r) => plane(r.w, r.d, r.x, r.y + lift, r.z)) : [plane(w, d, 0, lift, 0)];
  const g = parts.length === 1 ? parts[0] : mergeGeometries(parts, false);
  if (parts.length > 1) for (const p of parts) p.dispose();
  const mesh = new Mesh(g ?? new BufferGeometry(), sheenMaterial());
  mesh.name = 'glassSheen';
  // Apres le verre : l'additif se pose sur le texte deja dessine
  mesh.renderOrder = 2;
  return mesh;
}

/** Rend la memoire d'un reflet ; la texture partagee part avec le dernier. */
export function disposeSheen(mesh: Mesh): void {
  mesh.removeFromParent();
  mesh.geometry.dispose();
  (mesh.material as MeshBasicMaterial).dispose();
  users = Math.max(0, users - 1);
  if (users === 0 && shared) {
    shared.dispose();
    shared = null;
  }
}
