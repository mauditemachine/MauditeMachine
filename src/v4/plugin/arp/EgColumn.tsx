/**
 * v52 (2026-11-24, Mika sur la colonne FILTER EG / AMP EG de la face : "ya beaucoup d'espace ici non ? que pouvons-nous
 * rajouter qui est en rapport ?" ; il a choisi l'option C de la maquette : "LES DEUX, un ecran pour les deux courbes, les
 * reglages en bas") : la colonne remplie (les places : voyager/theme.ts VOY_EG_COL ; le site ne change pas).
 *
 * 1. L'ecran des enveloppes, entre FILTER EG et AMP EG : un verre sombre comme les ecrans de la face, une piece de la scene
 *    (sa toile : egScreen.ts drawEgGlass) qui dessine les deux enveloppes avec la loi du moteur sur un axe du temps commun,
 *    FILTER a l'accent sur un degrade, AMP en blanc casse pointille, la legende FILTER · AMP. Il ne se redessine que quand
 *    un potard d'enveloppe ou la couleur d'accent change.
 * 2. Le point qui suit la note : la vraie position des deux enveloppes de la voix la plus recente (mm_tick.e du C++,
 *    egScreen.ts arpEg), avancee par la meme loi entre deux ticks ; une couche SVG au-dessus de la scene (aucun rendu 3D
 *    de plus), a 30 images par seconde tant qu'une voix sonne (loop30) ; au repos, capot ouvert ou fenetre cachee : rien,
 *    aucune image.
 * 3. Sous AMP EG, quatre reglages du moteur qui n'etaient pas sur la face : POLARITY (fpol, POS / NEG) et VOICE
 *    (xVoiceMode, POLY / MONO / LEGATO), deux selecteurs a segments (un rail sombre, le segment choisi une touche mate a
 *    LED, la LED a l'accent, comme les touches de l'encart d'EDIT) ; KEY TRACK et ACCENT, le petit potard de Mika (k3, la
 *    famille d'OSC 1, NOISE, SUB). Comme les autres pieces de la face : glisser regle (les selecteurs passent de cran en
 *    cran), Alt / Cmd / Ctrl + clic remet la valeur de depart, MIDI LEARN les apprend, INFOS les explique (KEY TRACK,
 *    ACCENT, POLARITY), le viseur de la MOD MATRIX vise KEY TRACK et ACCENT (des cibles de modTable.ts : leur anneau, leur
 *    arc de modulation) ; un clic sur un segment le choisit (egTap, par le clic de la face : hellKnob.tsx).
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { CanvasTexture, ClampToEdgeWrapping, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, MeshStandardMaterial, Shape, SRGBColorSpace } from 'three';
import type { Stage } from '../../scene/renderer';
import type { HotspotDef } from '../../scene/hit';
import { potAngle } from '../../scene/encoders';
import { voyExplode } from '../../state/explode';
import { FONT_DISPLAY, PORTRAIT, PLUGIN_ARP, type EncId } from '../../theme';
import { voyMsg } from '../../voyager/msg';
import { voyParams, voyValueText, type VoyKnobId } from '../../voyager/params';
import { voySilkExtraKnob } from '../../voyager/silk';
import { VOY_EG_COL } from '../../voyager/theme';
import { accentGen } from './accent';
import { accent50 } from './encart50';
import { arpExtra, extraParam } from './extra';
import { faceArcPlaces, type ArcPlace } from './faceExtras';
import { arpEg, drawEgGlass, egAxis, egAxisTime, egOf, egPoint, egPredict, EG_OFF } from './egScreen';
import { look } from './look';
import { loop30 } from './loop30';
import { modAim } from './modRoutes';
import { VKnobSet } from './vknob';
import { VKNOB_LIFT } from './vknobFace';

const C = VOY_EG_COL;
const ROW = C.row;
const ON = PLUGIN_ARP && !PORTRAIT;

/** Les selecteurs : leur reglage, ses crans (les noms sur les segments), leur nom sous le rail. */
type SelId = 'fpol' | 'xVoiceMode';
const SELS: readonly { id: SelId; name: string; steps: readonly string[] }[] = [
  { id: 'fpol', name: 'POLARITY', steps: ['POS', 'NEG'] },
  { id: 'xVoiceMode', name: 'VOICE', steps: ['POLY', 'MONO', 'LEG'] },
];
/** Les potards : KEY TRACK, ACCENT (des potards du site, sous le capot jusque-la : voyager/params.ts TWEAKS). */
const KNOBS: readonly { id: VoyKnobId & ('keyTrack' | 'accent'); name: string }[] = [
  { id: 'keyTrack', name: 'KEY TRACK' },
  { id: 'accent', name: 'ACCENT' },
];

// Les noms sous les pieces, avant que la scene ne dessine sa serigraphie (le corps des noms des potards de la face)
if (ON) {
  for (const s of SELS) voySilkExtraKnob('panel', s.name, ROW.x[s.id], ROW.labelZ);
  for (const k of KNOBS) voySilkExtraKnob('panel', k.name, ROW.x[k.id], ROW.labelZ);
}

/* ---------------- les valeurs des selecteurs ---------------- */

const selValue = (id: SelId): number => (id === 'fpol' ? voyParams.of('fpol') : arpExtra.of(id));
const selCount = (id: SelId): number => (id === 'fpol' ? 2 : extraParam(id)?.steps?.length ?? 3);
const selIndex = (id: SelId): number => {
  const n = selCount(id);
  return Math.max(0, Math.min(n - 1, Math.round(selValue(id) * (n - 1))));
};
const selText = (id: SelId, v: number = selValue(id)): string => (id === 'fpol' ? voyValueText('fpol', v) : arpExtra.text(id, v));
function selSet(id: SelId, i: number): void {
  const v = i / Math.max(1, selCount(id) - 1);
  if (id === 'fpol') voyParams.set('fpol', v);
  else arpExtra.set(id, v);
  voyMsg.show(`${SELS.find((s) => s.id === id)?.name ?? id} ${selText(id)}`, 1800);
}

/* ---------------- le clic sur un segment (hellKnob.tsx, le clic de la face) ---------------- */

let tapStage: Stage | null = null;
const lastDown = { x: -1, y: -1 };

/**
 * Un clic sans mouvement sur un segment d'un selecteur : ce segment (la piece cliquee : la zone de prise sous le dernier
 * appui ; les touches de l'encart d'EDIT, qui reglent le meme reglage, gardent leur geste). Pendant une assignation au
 * viseur : pas une cible. true : le clic est pris.
 */
export function egTap(dial: string): boolean {
  if (!ON || !tapStage || (dial !== 'v:fpol' && dial !== 'z:ed:xVoiceMode')) return false;
  const rect = tapStage.renderer.domElement.getBoundingClientRect();
  const h = tapStage.hit.pick(lastDown.x - rect.left, lastDown.y - rect.top, false);
  const m = h ? /^veg-(fpol|xVoiceMode)-(\d)$/.exec(h.id) : null;
  if (!m) return false;
  const id = m[1] as SelId;
  if (modAim.on()) return modAim.pick(id);
  selSet(id, Number(m[2]));
  return true;
}

/* ---------------- les pieces ---------------- */

function roundRect(w: number, d: number, r: number): Shape {
  const s = new Shape();
  const x = -w / 2;
  const y = -d / 2;
  const q = Math.min(r, w / 2, d / 2);
  s.moveTo(x + q, y);
  s.lineTo(x + w - q, y);
  s.absarc(x + w - q, y + q, q, -Math.PI / 2, 0, false);
  s.lineTo(x + w, y + d - q);
  s.absarc(x + w - q, y + d - q, q, 0, Math.PI / 2, false);
  s.lineTo(x + q, y + d);
  s.absarc(x + q, y + d - q, q, Math.PI / 2, Math.PI, false);
  s.lineTo(x, y + q);
  s.absarc(x + q, y + q, q, Math.PI, Math.PI * 1.5, false);
  return s;
}

/** Une plaque (repere de son parent, posee sur y = 0) : sa forme arrondie, sa hauteur ; le dessus prend la toile entiere. */
function plate(w: number, d: number, r: number, h: number, bevel = 0): ExtrudeGeometry {
  const g = new ExtrudeGeometry(roundRect(w, d, r), { depth: h, bevelEnabled: bevel > 0, bevelThickness: bevel, bevelSize: bevel, bevelSegments: 3, curveSegments: 16 });
  g.rotateX(-Math.PI / 2);
  return g;
}

/** Une toile en texture du dessus d'une plaque de w x d (les uv du dessus : les coordonnees de la forme). */
function topTexture(c: HTMLCanvasElement, w: number, d: number): CanvasTexture {
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  t.anisotropy = 8;
  t.wrapS = t.wrapT = ClampToEdgeWrapping;
  t.repeat.set(1 / w, 1 / d);
  t.offset.set(0.5, 0.5);
  return t;
}

const rgba = (hex: string, a: number): string => {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255}, ${(n >> 8) & 255}, ${n & 255}, ${a})`;
};

/** Pixels de toile par unite du panneau (les selecteurs). */
const SEL_PX = 1600;
/** Le corps des noms des segments (hauteur de capitale, unites), la LED. */
const SEG = { cap: 0.042, led: 0.017, gap: 0.014, keyInsetX: 0.014, keyInsetZ: 0.03, track: 0.008, key: 0.016 } as const;

const setFont = (g: CanvasRenderingContext2D, weight: number, cap: number, spacing: number): void => {
  g.font = `${weight} ${Math.round(cap * 1.38)}px ${FONT_DISPLAY}`;
  (g as unknown as { letterSpacing: string }).letterSpacing = `${(cap * spacing).toFixed(1)}px`;
};

/** Le rail d'un selecteur : sombre, creuse (ombre en haut, un filet clair en bas), les noms de ses crans a l'encre pale. */
function trackCanvas(w: number, d: number, steps: readonly string[], segW: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(w * SEL_PX);
  c.height = Math.round(d * SEL_PX);
  const g = c.getContext('2d')!;
  const bg = g.createLinearGradient(0, 0, 0, c.height);
  bg.addColorStop(0, '#0b0a0a');
  bg.addColorStop(1, '#151413');
  g.fillStyle = bg;
  g.fillRect(0, 0, c.width, c.height);
  const sh = g.createLinearGradient(0, 0, 0, c.height * 0.45);
  sh.addColorStop(0, 'rgba(0, 0, 0, 0.7)');
  sh.addColorStop(1, 'rgba(0, 0, 0, 0)');
  g.fillStyle = sh;
  g.fillRect(0, 0, c.width, c.height * 0.45);
  g.fillStyle = 'rgba(255, 250, 240, 0.06)';
  g.fillRect(0, c.height - 4, c.width, 4);
  setFont(g, 600, SEG.cap * SEL_PX, 0.12);
  g.fillStyle = 'rgba(240, 234, 224, 0.42)';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  const x0 = (w - segW * steps.length) / 2;
  steps.forEach((s, i) => g.fillText(s, (x0 + segW * (i + 0.5)) * SEL_PX, c.height / 2 + 1));
  return c;
}

/** Le dessus de la touche du segment choisi : le caoutchouc mat un peu plus clair, la LED a l'accent, le nom en clair. */
function keyCanvas(w: number, d: number, label: string, accent: string): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = Math.round(w * SEL_PX);
  c.height = Math.round(d * SEL_PX);
  const g = c.getContext('2d')!;
  const gr = g.createLinearGradient(0, 0, 0, c.height);
  gr.addColorStop(0, '#2c2a28');
  gr.addColorStop(1, '#1f1d1c');
  g.fillStyle = gr;
  g.fillRect(0, 0, c.width, c.height);
  g.fillStyle = 'rgba(255, 250, 240, 0.08)';
  g.fillRect(0, 0, c.width, 3);
  setFont(g, 700, SEG.cap * SEL_PX, 0.12);
  const tw = g.measureText(label).width;
  const R = SEG.led * SEL_PX;
  const gap = SEG.gap * SEL_PX;
  const x0 = (c.width - (2 * R + gap + tw)) / 2;
  const lx = x0 + R;
  const ly = c.height / 2;
  const glow = g.createRadialGradient(lx, ly, 0, lx, ly, R * 3.2);
  glow.addColorStop(0, rgba(accent, 0.55));
  glow.addColorStop(1, rgba(accent, 0));
  g.fillStyle = glow;
  g.fillRect(lx - R * 3.2, ly - R * 3.2, R * 6.4, R * 6.4);
  const l = g.createRadialGradient(lx - R * 0.3, ly - R * 0.35, 0, lx, ly, R);
  l.addColorStop(0, '#ffffff');
  l.addColorStop(0.32, rgba(accent, 0.75));
  l.addColorStop(1, accent);
  g.fillStyle = l;
  g.beginPath();
  g.arc(lx, ly, R, 0, Math.PI * 2);
  g.fill();
  g.strokeStyle = '#070505';
  g.lineWidth = 3;
  g.stroke();
  g.fillStyle = '#fff8ee';
  g.textAlign = 'left';
  g.textBaseline = 'middle';
  g.fillText(label, x0 + 2 * R + gap, ly + 1);
  return c;
}

/** Pixels de toile par unite du verre des enveloppes. */
const GLASS_PX = 620;

/* ---------------- dans la scene ---------------- */

export const EgColumn: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  useEffect(() => {
    const rig = stage?.voy;
    if (!ON || !stage || !rig) return undefined;
    const panel = rig.panel;
    const root = new Group();
    root.name = 'eg-column';
    panel.add(root);
    const disposers: (() => void)[] = [];
    const sideMat = new MeshStandardMaterial({ color: '#0d0c0c', roughness: 0.7, metalness: 0.05 });
    const keySide = new MeshStandardMaterial({ color: '#151413', roughness: 0.6, metalness: 0.05 });
    disposers.push(() => {
      sideMat.dispose();
      keySide.dispose();
    });

    // 1. le verre des enveloppes
    const S = C.screen;
    const gw = S.x1 - S.x0;
    const gd = S.z1 - S.z0;
    const gc = document.createElement('canvas');
    gc.width = Math.round(gw * GLASS_PX);
    gc.height = Math.round(gd * GLASS_PX);
    const g2 = gc.getContext('2d')!;
    const glassTex = topTexture(gc, gw, gd);
    const glassMat = new MeshBasicMaterial({ map: glassTex, toneMapped: false });
    const glassGeo = plate(gw, gd, 0.045, 0.006);
    const glass = new Mesh(glassGeo, [glassMat, sideMat]);
    glass.position.set((S.x0 + S.x1) / 2, 0.001, (S.z0 + S.z1) / 2);
    root.add(glass);
    disposers.push(() => {
      glassGeo.dispose();
      glassTex.dispose();
      glassMat.dispose();
    });
    let drawnKey = '';
    const drawGlass = (): boolean => {
      const v = voyParams.get();
      const key = `${v.fA},${v.fD},${v.fS},${v.fR},${v.aA},${v.aD},${v.aS},${v.aR},${accentGen()}`;
      if (key === drawnKey) return false;
      drawnKey = key;
      drawEgGlass(g2, gc.width, gc.height, gw, gd, v, accent50(), FONT_DISPLAY);
      glassTex.needsUpdate = true;
      return true;
    };
    drawGlass();

    // 2. KEY TRACK et ACCENT : le petit potard de Mika (k3)
    const knobs = new VKnobSet('k3', KNOBS.length);
    KNOBS.forEach((k, i) => {
      knobs.place(i, ROW.x[k.id], VKNOB_LIFT, ROW.knobZ, ROW.knobR);
      knobs.setAngle(i, potAngle(voyParams.of(k.id)));
    });
    panel.add(...knobs.meshes);
    disposers.push(() => {
      panel.remove(...knobs.meshes);
      knobs.dispose();
    });

    // 3. POLARITY et VOICE : le rail, la touche du segment choisi (une toile par cran)
    const sels = SELS.map((s) => {
      const n = s.steps.length;
      const segW = ROW.segW[s.id];
      const w = segW * n + 0.02;
      const d = ROW.selD;
      const x = ROW.x[s.id];
      const tc = trackCanvas(w, d, s.steps, segW);
      const trackTex = topTexture(tc, w, d);
      const trackMat = new MeshBasicMaterial({ map: trackTex, toneMapped: false });
      const trackGeo = plate(w, d, d / 2, SEG.track);
      const track = new Mesh(trackGeo, [trackMat, sideMat]);
      track.position.set(x, 0.001, ROW.selZ);
      root.add(track);
      const kw = segW - SEG.keyInsetX;
      const kd = d - SEG.keyInsetZ;
      const keyGeo = plate(kw, kd, kd * 0.42, SEG.key, 0.004);
      let acc = '';
      let keyTexs: CanvasTexture[] = [];
      const keyMat = new MeshBasicMaterial({ toneMapped: false });
      const key = new Mesh(keyGeo, [keyMat, keySide]);
      key.castShadow = true;
      root.add(key);
      const at = (i: number): number => x + (i - (n - 1) / 2) * segW;
      let shownI = -1;
      const show = (): boolean => {
        let ch = false;
        if (accent50() !== acc) {
          acc = accent50();
          keyTexs.forEach((t) => t.dispose());
          keyTexs = s.steps.map((label) => topTexture(keyCanvas(kw, kd, label, acc), kw, kd));
          shownI = -1;
          ch = true;
        }
        const i = selIndex(s.id);
        if (i !== shownI) {
          shownI = i;
          keyMat.map = keyTexs[i];
          keyMat.needsUpdate = true;
          key.position.set(at(i), 0.001 + SEG.track, ROW.selZ);
          ch = true;
        }
        return ch;
      };
      show();
      disposers.push(() => {
        trackGeo.dispose();
        trackTex.dispose();
        trackMat.dispose();
        keyGeo.dispose();
        keyTexs.forEach((t) => t.dispose());
        keyMat.dispose();
      });
      return { s, n, segW, x, d, at, show };
    });

    // les zones de prise : les potards (kind vknob, comme DETUNE), un segment par cran (POLARITY : v:fpol ; VOICE : la
    // fiche z:ed:xVoiceMode de l'encart d'EDIT, la meme que sa touche MODE : MIDI LEARN, la remise, le glisser)
    const defs: HotspotDef[] = [];
    for (const k of KNOBS) {
      const r = ROW.knobR * 1.06;
      defs.push({ id: `veg-${k.id}`, kind: 'vknob', vknob: k.id, layer: panel, shape: 'disc', x: ROW.x[k.id], z: ROW.knobZ, hx: r, hz: r, y0: 0, y1: 0.12, enabled: true, machine: 'voy' });
    }
    for (const sel of sels) {
      for (let i = 0; i < sel.n; i += 1) {
        const base = { id: `veg-${sel.s.id}-${i}`, layer: panel, shape: 'box' as const, x: sel.at(i), z: ROW.selZ, hx: sel.segW / 2 - 0.004, hz: sel.d / 2 + 0.05, y0: 0, y1: 0.06, enabled: true, machine: 'voy' as const };
        defs.push(sel.s.id === 'fpol' ? { ...base, kind: 'vknob', vknob: 'fpol' } : { ...base, kind: 'encoder', param: `z:ed:${sel.s.id}` as EncId });
      }
    }
    stage.hit.add(defs);
    disposers.push(() => {
      for (const d of defs) d.enabled = false;
      stage.hit.invalidate();
    });

    // l'arc de modulation (FaceModArcs.tsx) et l'anneau du viseur (Encart50Overlay.tsx) de KEY TRACK et ACCENT : leur place
    const places: [string, ArcPlace][] = KNOBS.map((k) => [k.id, { layer: panel, x: ROW.x[k.id], z: ROW.knobZ, y: 0.004, R: ROW.knobR * 1.13, live: () => true }]);
    for (const [id, p] of places) {
      const l = faceArcPlaces.get(id);
      if (l) l.push(p);
      else faceArcPlaces.set(id, [p]);
    }
    disposers.push(() => {
      for (const [id, p] of places) {
        const l = faceArcPlaces.get(id);
        if (!l) continue;
        const i = l.indexOf(p);
        if (i >= 0) l.splice(i, 1);
        if (l.length === 0) faceArcPlaces.delete(id);
      }
    });

    // le clic sur un segment : la piece sous le dernier appui
    tapStage = stage;
    const onDown = (e: PointerEvent): void => {
      lastDown.x = e.clientX;
      lastDown.y = e.clientY;
    };
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('pointerdown', onDown, opts);
    disposers.push(() => {
      window.removeEventListener('pointerdown', onDown, opts);
      if (tapStage === stage) tapStage = null;
    });

    // tout suit les reglages (un changement d'un autre potard ne redessine rien)
    const angles = KNOBS.map(() => NaN);
    const turn = (): void => {
      let ch = drawGlass();
      KNOBS.forEach((k, i) => {
        const v = voyParams.of(k.id);
        if (v === angles[i]) return;
        angles[i] = v;
        knobs.setAngle(i, potAngle(v));
        ch = true;
      });
      for (const s of sels) if (s.show()) ch = true;
      if (ch) stage.invalidate();
    };
    turn();
    const offs = [voyParams.subscribe(turn), arpExtra.subscribe(turn), look.subscribe(turn)];
    disposers.push(() => offs.forEach((f) => f()));
    stage.invalidate();
    return () => {
      for (const d of disposers.splice(0).reverse()) d();
      panel.remove(root);
      stage.invalidate();
    };
  }, [stage]);
  if (!ON || !stage) return null;
  return <EgDots stage={stage} />;
};

/* ---------------- le point qui suit la note ---------------- */

const useStore = <T,>(s: { subscribe: (fn: () => void) => () => void; get: () => T }): T => useSyncExternalStore(s.subscribe, s.get, s.get);
const liveStore = { subscribe: arpEg.subscribe, get: arpEg.live };

/** La taille de la fenetre (les points projetes changent avec elle). */
function useWinSize(): number {
  const [size, setSize] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth * 10000 + window.innerHeight));
  useLayoutEffect(() => {
    const f = (): void => setSize(window.innerWidth * 10000 + window.innerHeight);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return size;
}

const EgDots: React.FC<{ stage: Stage }> = ({ stage }) => {
  const live = useStore(liveStore);
  const hood = useStore(voyExplode as unknown as { subscribe: (fn: () => void) => () => void; get: () => string });
  const [vis, setVis] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const size = useWinSize();
  const fDot = useRef<SVGGElement | null>(null);
  const aDot = useRef<SVGGElement | null>(null);
  useEffect(() => {
    const f = (): void => setVis(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);
  const on = live && hood === 'closed' && vis;
  useEffect(() => {
    const layer = stage.voy?.panel;
    if (!on || !layer) return undefined;
    const S = C.screen;
    const gw = S.x1 - S.x0;
    const gd = S.z1 - S.z0;
    const y = 0.001 + 0.006 + 0.002;
    const out = { x: 0, y: 0 };
    const last = { f: '', a: '' };
    const put = (el: SVGGElement | null, key: 'f' | 'a', u: number, v: number, o: number, rect: DOMRect): void => {
      if (!el) return;
      stage.hit.project(layer, S.x0 + u, y, S.z0 + v, out);
      const tr = `translate(${(rect.left + out.x).toFixed(1)} ${(rect.top + out.y).toFixed(1)})`;
      const op = o.toFixed(2);
      const k = `${tr}|${op}`;
      if (k === last[key]) return;
      last[key] = k;
      el.setAttribute('transform', tr);
      el.setAttribute('opacity', op);
    };
    let stop: (() => void) | null = null;
    const step = (now: number): void => {
      const s = arpEg.get();
      if (!s) return;
      const { f, a } = egOf(voyParams.get());
      const ax = egAxis(f, a);
      const n = egPredict(s, now, f, a, ax);
      const t = egAxisTime(n, ax);
      const rect = stage.renderer.domElement.getBoundingClientRect();
      // la voix s'eteint : le point s'efface avec elle (au relachement, sur le dernier dixieme de sa course)
      const fade = n.aV <= EG_OFF ? 0 : Math.min(1, n.aV / 0.02);
      const pf = egPoint(gw, gd, ax, t, n.fV);
      const pa = egPoint(gw, gd, ax, t, n.aV);
      put(fDot.current, 'f', pf.u, pf.v, fade, rect);
      put(aDot.current, 'a', pa.u, pa.v, fade * 0.8, rect);
      // une note tenue au maintien, la voix tue, ou plus de tick depuis une seconde (l'hote ne joue plus de bloc : la
      // prediction s'arrete la) : plus rien ne bouge d'ici le prochain tick
      if ((n.still || fade === 0 || now - s.at > 1000) && stop) {
        stop();
        stop = null;
      }
    };
    const run = (): void => {
      if (!stop) stop = loop30(step);
    };
    run();
    const off = arpEg.onTick(run);
    return () => {
      off();
      if (stop) stop();
      stop = null;
    };
  }, [on, stage, size]);
  if (!on) return null;
  const k = window.innerWidth / 1100;
  const acc = accent50();
  return (
    <svg className="mm-eg-dots" style={{ position: 'fixed', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }} aria-hidden="true">
      <defs>
        <radialGradient id="mm-eg-glow">
          <stop offset="0" stopColor={acc} stopOpacity={0.75} />
          <stop offset="1" stopColor={acc} stopOpacity={0} />
        </radialGradient>
        <radialGradient id="mm-eg-glow-a">
          <stop offset="0" stopColor="#f6f1e7" stopOpacity={0.4} />
          <stop offset="1" stopColor="#f6f1e7" stopOpacity={0} />
        </radialGradient>
      </defs>
      <g ref={aDot} data-eg="amp" transform="translate(-99 -99)">
        <circle r={4.2 * k} fill="url(#mm-eg-glow-a)" />
        <circle r={1.45 * k} style={{ fill: '#f6f1e7' }} fillOpacity={0.85} />
      </g>
      <g ref={fDot} data-eg="filter" transform="translate(-99 -99)">
        <circle r={7.5 * k} fill="url(#mm-eg-glow)" />
        <circle r={2.4 * k} style={{ fill: '#ffffff' }} />
      </g>
    </svg>
  );
};
