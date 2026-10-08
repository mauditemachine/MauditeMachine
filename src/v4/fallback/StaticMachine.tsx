/**
 * La MM-808 en SVG statique (spec 11.5 et 20.10), pour la page de repli :
 * la machine de la revision 2 vue comme la scene a sa vue par defaut
 * (orthographique, azimut 45, elevation 38), dessinee depuis les
 * constantes de theme.ts. Le chassis en coin (faces avant et droite, leurs
 * chanfreins), le panneau incline (tranche et dessus), la serigraphie,
 * l'ecran OLED (MM-808, le tempo, READY), les 16 LED (le motif par defaut),
 * puis les volumes du plus lointain au plus proche : MASTER, TEMPO et les huit
 * potards de page (les six touches de page dessous, 2026-10-08), les
 * 12 pads (les pages en jaune faible), RUN, CLEAR, les 16 touches trig.
 * Aucune animation ; calcule une fois au chargement du module.
 */

import React from 'react';
import { BPM, DEFAULT_STEPS, INSTRUMENTS, isOn } from '../audio/pattern';
import {
  BODY,
  ENCODER,
  FACE_KNOBS,
  HEX,
  KEYS,
  OLED,
  ORBIT,
  PAD,
  PAGE_KEYS,
  RYTM_PAGE_KEYS,
  PADS,
  PANEL,
  PANEL_D,
  PANEL_TOP_Y,
  SILK,
  SILK_LINES,
  SILK_TEXTS,
  TEMPO_UI,
  TILT,
  TRANSPORT,
  chassisTopY,
  pageKeyX,
  keyDz,
  keyX,
  type SilkText,
} from '../theme';

/* ---------- projection : la vue par defaut de l'orbite ---------- */

type V3 = [number, number, number];
type V2 = [number, number];

const DEG = Math.PI / 180;
const AZ = ORBIT.azDeg * DEG;
const EL = ORBIT.elDeg * DEG;
// Vers la camera Z, droite R = normalize(haut x Z), haut U = Z x R
const Z: V3 = [Math.cos(EL) * Math.sin(AZ), Math.sin(EL), Math.cos(EL) * Math.cos(AZ)];
const RL = Math.hypot(Z[2], Z[0]);
const R: V3 = [Z[2] / RL, 0, -Z[0] / RL];
const U: V3 = [Z[1] * R[2] - Z[2] * R[1], Z[2] * R[0] - Z[0] * R[2], Z[0] * R[1] - Z[1] * R[0]];
const dot = (a: V3, b: V3): number => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];

/** Point du monde -> ecran brut (unites, y vers le bas). */
const raw = (p: V3): V2 => [dot(R, p), -dot(U, p)];

const COS = Math.cos(TILT);
const SIN = Math.sin(TILT);
/** Point du repere panneau (x, y, z) -> monde (machine fermee). */
const panel = (x: number, y: number, z: number): V3 => [x, PANEL_TOP_Y + y * COS - z * SIN, y * SIN + z * COS];

/* ---------- cadrage dans le viewBox ---------- */

const VB_W = 800;
const VB_H = 480;
const PAD_PX = 20;
const HX = BODY.w / 2;
const HZ = BODY.d / 2;
const PZ = PANEL_D / 2;

const bounds = (() => {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  const add = (p: V3): void => {
    const [x, y] = raw(p);
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  };
  for (const x of [-HX, HX]) {
    for (const z of [-HZ, HZ]) add([x, 0, z]);
    for (const z of [-PZ, PZ]) add(panel(x, ENCODER.h, z));
  }
  return { x0, x1, y0, y1 };
})();

const S = Math.min((VB_W - 2 * PAD_PX) / (bounds.x1 - bounds.x0), (VB_H - 2 * PAD_PX) / (bounds.y1 - bounds.y0));
const OX = (VB_W - (bounds.x1 - bounds.x0) * S) / 2 - bounds.x0 * S;
const OY = (VB_H - (bounds.y1 - bounds.y0) * S) / 2 - bounds.y0 * S;

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Point du monde -> px du viewBox. */
const P = (p: V3): V2 => {
  const [a, b] = raw(p);
  return [r1(a * S + OX), r1(b * S + OY)];
};

const pathOf = (pts: V2[]): string => `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`;

/** Polyligne [x0, z0, x1, z1, ...] du plan du panneau. */
const polyline = (l: readonly number[]): string => {
  let d = '';
  for (let j = 0; j < l.length; j += 2) d += `${j === 0 ? 'M' : 'L'}${l[j]} ${l[j + 1]}`;
  return d;
};
const poly = (pts: V3[]): string => pathOf(pts.map(P));

/**
 * Transformation SVG du plan du panneau a la hauteur locale y : (x, z) du
 * panneau -> viewBox (application affine).
 */
function planeAt(y: number): string {
  const o = P(panel(0, y, 0));
  const ex = raw(panel(1, y, 0));
  const ez = raw(panel(0, y, 1));
  const e0 = raw(panel(0, y, 0));
  const a = (ex[0] - e0[0]) * S;
  const b = (ex[1] - e0[1]) * S;
  const c = (ez[0] - e0[0]) * S;
  const d = (ez[1] - e0[1]) * S;
  return `matrix(${a.toFixed(4)} ${b.toFixed(4)} ${c.toFixed(4)} ${d.toFixed(4)} ${o[0]} ${o[1]})`;
}

/* ---------- couleurs affichees (celles que la scene rend) ---------- */

const C = {
  bodyFront: '#0b0b0d',
  bodyRight: '#101013',
  bodyEdge: HEX.bodyEdge,
  panelFront: '#0e0e10',
  panelRight: '#131316',
  panelEdge: '#2c2d31',
  padSide: '#0c0c0e',
  pageTop: '#332c17',
  pageSide: '#241f12',
  keySide: '#141518',
  runSide: '#7d2a1d',
  clearSide: '#121215',
  encSide: '#0b0b0c',
  bone85: 'rgba(246, 241, 231, 0.85)',
} as const;

/* ---------- serigraphie : corps ajuste comme la texture (silk.ts) ---------- */

/** Avance moyenne d'une capitale SF Pro Display 500, en em (estimation). */
const ADVANCE_EM = 0.6;
const textW = (t: SilkText, cap: number): number => (cap / SILK.capRatio) * (t.text.length * ADVANCE_EM + (t.text.length - 1) * SILK.tracking);
const silkCaps = (() => {
  const fit = SILK_TEXTS.map((t) => (t.maxW && textW(t, t.cap) > t.maxW ? t.maxW / textW(t, t.cap) : 1));
  const group = new Map<string, number>();
  SILK_TEXTS.forEach((t, i) => {
    if (t.group) group.set(t.group, Math.min(group.get(t.group) ?? 1, fit[i]));
  });
  return SILK_TEXTS.map((t, i) => t.cap * (t.group ? group.get(t.group) ?? fit[i] : fit[i]));
})();

/** Le dessus du panneau : filets, LED, serigraphie, ecran. */
function panelTop(): React.ReactNode {
  const union = Array.from({ length: KEYS.count }, (_, i) => INSTRUMENTS.some((k) => isOn(DEFAULT_STEPS, k, i)));
  const O = OLED;
  const b = O.bezel;
  const lines = [
    ['MM-RYTM', `${BPM.initial} BPM`],
    ['READY', ''],
  ];
  const fz = (O.d * 40) / O.tex[1];
  const k = O.w / O.tex[0];
  return (
    <>
      <g transform={planeAt(0.004)}>
        {SILK_LINES.map((l, i) => (
          <path
            key={`line-${i}`}
            d={polyline(l)}
            fill="none"
            stroke={`rgba(246, 241, 231, ${SILK.lineAlpha})`}
            strokeWidth={SILK.lineWidth}
          />
        ))}
        {union.map((on, i) => (
          <rect
            key={`led-${i}`}
            x={keyX(i) - KEYS.ledW / 2}
            y={KEYS.ledZ + keyDz(i) - KEYS.ledD / 2}
            width={KEYS.ledW}
            height={KEYS.ledD}
            fill={on ? HEX.ledSet : HEX.line}
          />
        ))}
        {SILK_TEXTS.map((t, i) => {
          const cap = silkCaps[i];
          const size = cap / SILK.capRatio;
          // letter-spacing suit aussi la derniere lettre : on la compense
          const ls = SILK.tracking * size;
          const anchor = t.align === 'right' ? 'end' : t.align === 'left' ? 'start' : 'middle';
          const shift = t.align === 'right' ? ls : t.align === 'left' ? 0 : ls / 2;
          return (
            <text
              key={`silk-${i}`}
              x={t.x + shift}
              y={t.z + cap / 2}
              fontSize={size}
              fontWeight={t.weight ?? SILK.weight}
              textAnchor={anchor}
              fill={t.ink === 'orange' ? HEX.orange : t.alpha ? `rgba(246, 241, 231, ${t.alpha})` : C.bone85}
              className="v4-silk"
            >
              {t.text}
            </text>
          );
        })}
        <rect x={O.x - b.w / 2} y={O.z - b.d / 2} width={b.w} height={b.d} fill={HEX.oled} />
      </g>
      <g transform={planeAt(O.y)}>
        <rect x={O.x - O.w / 2} y={O.z - O.d / 2} width={O.w} height={O.d} fill={HEX.oled} />
        <g className="v4-lcd-text" fill={HEX.bone} fontSize={fz}>
          {lines.map(([l, r], i) => {
            const y = O.z - O.d / 2 + (O.d * [64, 136][i]) / O.tex[1];
            return (
              <React.Fragment key={`oled-${i}`}>
                <text x={O.x - O.w / 2 + 24 * k} y={y}>
                  {l}
                </text>
                {r && (
                  <text x={O.x + O.w / 2 - 24 * k} y={y} textAnchor="end">
                    {r}
                  </text>
                )}
              </React.Fragment>
            );
          })}
        </g>
      </g>
    </>
  );
}

/* ---------- volumes poses sur le panneau ---------- */

interface Solid {
  depth: number;
  nodes: React.ReactNode[];
}

/** Pave du repere panneau : ses faces vues (dessus, avant, droite). */
function box(key: string, x: number, z: number, hx: number, hz: number, h: number, top: string, front: string, right: string): Solid {
  const c = (sx: number, y: number, sz: number): V3 => panel(x + sx * hx, y, z + sz * hz);
  return {
    depth: dot(Z, panel(x, h / 2, z)),
    nodes: [
      <path key={`${key}-r`} d={poly([c(1, 0, -1), c(1, 0, 1), c(1, h, 1), c(1, h, -1)])} fill={right} />,
      <path key={`${key}-f`} d={poly([c(-1, 0, 1), c(1, 0, 1), c(1, h, 1), c(-1, h, 1)])} fill={front} />,
      <path key={`${key}-t`} d={poly([c(-1, h, -1), c(1, h, -1), c(1, h, 1), c(-1, h, 1)])} fill={top} />,
    ],
  };
}

/** Encodeur : flanc (enveloppe des deux cercles), dessus, repere bone. */
function encoder(i: number, angleDeg: number): Solid {
  const { x, z, s } = FACE_KNOBS[i];
  const ring = (r: number, y: number): V2[] =>
    Array.from({ length: 24 }, (_, k) => {
      const a = (k / 24) * Math.PI * 2;
      return P(panel(x + Math.cos(a) * r, y, z + Math.sin(a) * r));
    });
  // A son echelle (les potards du telephone sont plus gros)
  const topY = ENCODER.h * s;
  const bottom = ring(ENCODER.r * s, 0);
  const top = ring(ENCODER.rTop * s, topY);
  const all = [...bottom, ...top].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  // Enveloppe convexe (chaine monotone) du flanc
  const cross = (o: V2, a: V2, b: V2): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const half = (pts: V2[]): V2[] => {
    const h: V2[] = [];
    for (const q of pts) {
      while (h.length >= 2 && cross(h[h.length - 2], h[h.length - 1], q) <= 0) h.pop();
      h.push(q);
    }
    h.pop();
    return h;
  };
  const hull = [...half(all), ...half([...all].reverse())];
  const a = angleDeg * DEG;
  const m0 = P(panel(x, topY, z));
  const m1 = P(panel(x - Math.sin(a) * ENCODER.mark.d * s, topY, z - Math.cos(a) * ENCODER.mark.d * s));
  return {
    depth: dot(Z, panel(x, topY / 2, z)),
    nodes: [
      <path key={`enc-${i}-s`} d={pathOf(hull)} fill={C.encSide} />,
      <path key={`enc-${i}-t`} d={pathOf(top)} fill={HEX.encoder} />,
      <line key={`enc-${i}-m`} x1={m0[0]} y1={m0[1]} x2={m1[0]} y2={m1[1]} stroke={HEX.bone} strokeWidth={r1(ENCODER.mark.w * S)} strokeLinecap="round" />,
    ],
  };
}

const potDeg = (t: number): number => TEMPO_UI.sweepDeg / 2 - TEMPO_UI.sweepDeg * t;
/** Les potards a l'arrivee : MASTER 80 %, TEMPO 130, les potards de page sur SRC du KICK (909, TUNE, ATTACK, DECAY, DRIVE). */
const START: Record<string, number> = { tempo: (BPM.initial - BPM.min) / (BPM.max - BPM.min), level: 0.8, p2: 0.5, p3: 0.5, p4: 0.45, p5: 0.25, p7: 0.5 };

function solids(): React.ReactNode[] {
  const items: Solid[] = [];
  FACE_KNOBS.forEach((e, i) => items.push(encoder(i, potDeg(START[e.id] ?? 0))));
  // Les touches de page (2026-10-08), sous les potards de page
  RYTM_PAGE_KEYS.forEach((p, i) =>
    items.push(box(`pkey-${p.id}`, pageKeyX(i), PAGE_KEYS.z, PAGE_KEYS.w / 2, PAGE_KEYS.d / 2, PAGE_KEYS.h, HEX.graphiteHi, C.clearSide, C.clearSide))
  );
  const ph = PAD.height + PAD.dome;
  for (const p of PADS) {
    const page = p.kind !== 'voice';
    items.push(box(`pad-${p.id}`, p.x, p.z, PAD.size / 2, PAD.size / 2, ph, page ? C.pageTop : HEX.pad, page ? C.pageSide : C.padSide, page ? C.pageSide : C.padSide));
  }
  const t = TRANSPORT;
  const h = t.size / 2;
  items.push(box('run', t.run.x, t.z, h, h, t.h, HEX.red, C.runSide, C.runSide));
  items.push(box('clear', t.clear.x, t.z, h, h, t.h, HEX.graphiteHi, C.clearSide, C.clearSide));
  items.push(box('random', t.random.x, t.z, h, h, t.h, HEX.graphiteHi, C.clearSide, C.clearSide));
  items.push(box('mute', t.mute.x, t.z, h, h, t.h, HEX.graphiteHi, C.clearSide, C.clearSide));
  items.push(box('solo', t.solo.x, t.z, h, h, t.h, HEX.graphiteHi, C.clearSide, C.clearSide));
  for (let i = 0; i < KEYS.count; i += 1) items.push(box(`key-${i}`, keyX(i), KEYS.z + keyDz(i), KEYS.w / 2, KEYS.d / 2, KEYS.h, HEX.key, C.keySide, C.keySide));
  return items.sort((a, b) => a.depth - b.depth).flatMap((it) => it.nodes);
}

/* ---------- corps : chassis en coin et panneau ---------- */

function body(): React.ReactNode {
  const yb = BODY.feet;
  const front: V3[] = [
    [-HX, yb, HZ],
    [HX, yb, HZ],
    [HX, chassisTopY(HZ), HZ],
    [-HX, chassisTopY(HZ), HZ],
  ];
  const right: V3[] = [
    [HX, yb, -HZ],
    [HX, yb, HZ],
    [HX, chassisTopY(HZ), HZ],
    [HX, chassisTopY(-HZ), -HZ],
  ];
  const t = PANEL.t;
  const pf: V3[] = [panel(-HX, -t, PZ), panel(HX, -t, PZ), panel(HX, 0, PZ), panel(-HX, 0, PZ)];
  const pr: V3[] = [panel(HX, -t, -PZ), panel(HX, -t, PZ), panel(HX, 0, PZ), panel(HX, 0, -PZ)];
  const top: V3[] = [panel(-HX, 0, -PZ), panel(HX, 0, -PZ), panel(HX, 0, PZ), panel(-HX, 0, PZ)];
  const bw = PANEL.bevelSize;
  const inner: V3[] = [panel(-HX + bw, 0, -PZ + bw), panel(HX - bw, 0, -PZ + bw), panel(HX - bw, 0, PZ - bw), panel(-HX + bw, 0, PZ - bw)];
  return (
    <>
      <path d={poly(front)} fill={C.bodyFront} />
      <path d={poly(right)} fill={C.bodyRight} />
      <path d={poly(pf)} fill={C.panelFront} />
      <path d={poly(pr)} fill={C.panelRight} />
      <path d={poly(top)} fill={C.panelEdge} />
      <path d={poly(inner)} fill={HEX.panel} />
    </>
  );
}

const DRAWING = (
  <>
    {body()}
    {panelTop()}
    {solids()}
  </>
);

export const StaticMachine: React.FC = () => (
  <svg className="v4-fallback-machine" viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-labelledby="v4-machine-title v4-machine-desc">
    <title id="v4-machine-title">MM-RYTM drum machine</title>
    <desc id="v4-machine-desc">A black drum machine: a screen, eight page encoders with six page keys, master and tempo, ten pads, sixteen trig keys with a red RUN button.</desc>
    {DRAWING}
  </svg>
);

export default StaticMachine;
