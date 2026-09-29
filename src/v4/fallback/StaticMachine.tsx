/**
 * La MM-808 en SVG statique (spec 11.5), pour la page de repli : meme
 * camera que la scene (orthographique, (12, 10, 12) vers l'origine), meme
 * formule de projection (spec 0), dessinee depuis les constantes de
 * theme.ts. Socle et plateau a chanfrein, les quatre pads, les 16 pas et
 * leurs LED (le motif par defaut), RUN, CLEAR, OPEN dans son cadre jaune,
 * les huit knobs (liseres jaunes pour la navigation), l'ecran, la
 * serigraphie en bone 70 %. Aucune animation ; calcule une fois au
 * chargement du module.
 */

import React from 'react';
import { BPM, DEFAULT_STEPS, INSTRUMENTS } from '../audio/pattern';
import {
  AUDIO_KNOBS,
  CAMERA,
  HEX,
  KNOB,
  LAYERS,
  LCD,
  LCD_BEZEL,
  NAV_KNOBS,
  NAV_ROW,
  OPEN_FRAME,
  OPEN_LABEL,
  PAD,
  PADS,
  PLATE,
  SILK,
  SILK_RULES,
  SILK_TEXTS,
  SOCLE,
  STEPS,
  TEMPO_UI,
  TRANSPORT,
  stepX,
  type BodySpec,
  type SilkText,
} from '../theme';

/* ---------- projection (spec 0) ---------- */

// Base de la camera : droite R = normalize(up x Z), haut U = Z x R
const CL = Math.hypot(CAMERA.x, CAMERA.y, CAMERA.z);
const ZX = CAMERA.x / CL;
const ZY = CAMERA.y / CL;
const ZZ = CAMERA.z / CL;
const RL = Math.hypot(ZZ, ZX);
const RX = ZZ / RL;
const RZ = -ZX / RL;
const UX = ZY * RZ;
const UY = ZZ * RX - ZX * RZ;
const UZ = -ZY * RX;

type V2 = [number, number];

/** Point du monde -> ecran brut (unites, y vers le bas). */
const raw = (x: number, y: number, z: number): V2 => [RX * x + RZ * z, -(UX * x + UY * y + UZ * z)];

/* ---------- cadrage dans le viewBox ---------- */

const VB_W = 800;
const VB_H = 480;
const PAD_PX = 20;
const TOP_Y = LAYERS.plateauY;

/** Contour d'un rectangle a coins arrondis (x, z), 6 facettes par coin. */
function outline(w: number, d: number, r: number, cx = 0, cz = 0): [number, number][] {
  const out: [number, number][] = [];
  const corners: [number, number, number][] = [
    [cx + w / 2 - r, cz + d / 2 - r, 0],
    [cx - w / 2 + r, cz + d / 2 - r, 90],
    [cx - w / 2 + r, cz - d / 2 + r, 180],
    [cx + w / 2 - r, cz - d / 2 + r, 270],
  ];
  for (const [ox, oz, a0] of corners) {
    for (let k = 0; k <= 6; k += 1) {
      const a = ((a0 + (k * 90) / 6) * Math.PI) / 180;
      out.push([ox + r * Math.cos(a), oz + r * Math.sin(a)]);
    }
  }
  return out;
}

const socleOuter = outline(SOCLE.shapeW + 2 * SOCLE.bevelSize, SOCLE.shapeD + 2 * SOCLE.bevelSize, SOCLE.radius + SOCLE.bevelSize);
const socleInner = outline(SOCLE.shapeW, SOCLE.shapeD, SOCLE.radius);
const plateOuter = outline(PLATE.shapeW + 2 * PLATE.bevelSize, PLATE.shapeD + 2 * PLATE.bevelSize, PLATE.radius + PLATE.bevelSize);
const plateInner = outline(PLATE.shapeW, PLATE.shapeD, PLATE.radius);

// Boite englobante : le socle au sol, le dessus des knobs
const bounds = (() => {
  let x0 = Infinity;
  let x1 = -Infinity;
  let y0 = Infinity;
  let y1 = -Infinity;
  const add = ([x, y]: V2): void => {
    x0 = Math.min(x0, x);
    x1 = Math.max(x1, x);
    y0 = Math.min(y0, y);
    y1 = Math.max(y1, y);
  };
  for (const [x, z] of socleOuter) add(raw(x, 0, z));
  for (const [x, z] of plateOuter) add(raw(x, TOP_Y + KNOB.h + KNOB.capH, z));
  return { x0, x1, y0, y1 };
})();

const S = Math.min((VB_W - 2 * PAD_PX) / (bounds.x1 - bounds.x0), (VB_H - 2 * PAD_PX) / (bounds.y1 - bounds.y0));
const OX = (VB_W - (bounds.x1 - bounds.x0) * S) / 2 - bounds.x0 * S;
const OY = (VB_H - (bounds.y1 - bounds.y0) * S) / 2 - bounds.y0 * S;

const r1 = (n: number): number => Math.round(n * 10) / 10;

/** Point du monde -> px du viewBox. */
const P = (x: number, y: number, z: number): V2 => {
  const [a, b] = raw(x, y, z);
  return [r1(a * S + OX), r1(b * S + OY)];
};

/** Transformation SVG d'un plan horizontal a la hauteur y : (x, z) du plan -> viewBox. */
const plane = (y: number): string =>
  `matrix(${(RX * S).toFixed(4)} ${(-UX * S).toFixed(4)} ${(RZ * S).toFixed(4)} ${(-UZ * S).toFixed(4)} ${OX.toFixed(2)} ${(OY - UY * y * S).toFixed(2)})`;

/* ---------- formes ---------- */

/** Enveloppe convexe (chaine monotone d'Andrew). */
function hull(pts: V2[]): V2[] {
  const p = [...pts].sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  const cross = (o: V2, a: V2, b: V2): number => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
  const lower: V2[] = [];
  for (const q of p) {
    while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], q) <= 0) lower.pop();
    lower.push(q);
  }
  const upper: V2[] = [];
  for (let i = p.length - 1; i >= 0; i -= 1) {
    const q = p[i];
    while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], q) <= 0) upper.pop();
    upper.push(q);
  }
  lower.pop();
  upper.pop();
  return lower.concat(upper);
}

const pathOf = (pts: V2[]): string => `M${pts.map(([x, y]) => `${x} ${y}`).join('L')}Z`;

/** Contour (x, z) projete a la hauteur y. */
const at = (o: [number, number][], y: number): V2[] => o.map(([x, z]) => P(x, y, z));

/** Prisme d'un contour entre plusieurs hauteurs : sa silhouette. */
const prism = (layers: [[number, number][], number][]): string => pathOf(hull(layers.flatMap(([o, y]) => at(o, y))));

/** Cylindre vertical : flanc (silhouette) et dessus (ellipse). */
function cylinder(key: string, x: number, z: number, r: number, y0: number, h: number, side: string, top: string): React.ReactNode[] {
  const [bx, by] = P(x, y0, z);
  const [tx, ty] = P(x, y0 + h, z);
  const rx = r1(r * S);
  const ry = r1(r * Math.hypot(UX, UZ) * S);
  return [
    <path key={`${key}-s`} d={`M${bx - rx} ${ty}L${bx - rx} ${by}A${rx} ${ry} 0 0 0 ${bx + rx} ${by}L${bx + rx} ${ty}Z`} fill={side} />,
    <ellipse key={`${key}-t`} cx={tx} cy={ty} rx={rx} ry={ry} fill={top} />,
  ];
}

/* ---------- couleurs affichees (celles que la scene rend) ---------- */

const C = {
  socleSide: '#060607',
  plateSide: '#0e0e10',
  padSideX: '#19191c',
  padSideZ: '#121215',
  stepSide: '#2a2928',
  runSide: '#7d2a1d',
  darkSide: '#111113',
  darkTop: '#1d1c1d',
  knobSide: '#151518',
  cap: '#918e8a',
  bone70: 'rgba(246, 241, 231, 0.7)',
} as const;

/* ---------- serigraphie : corps ajuste comme la texture (silk.ts) ---------- */

/** Avance moyenne d'une capitale SF Pro Display 700, en em (estimation). */
const ADVANCE_EM = 0.62;
const textW = (t: SilkText, cap: number): number => (cap / SILK.capRatio) * (t.text.length * ADVANCE_EM + (t.text.length - 1) * SILK.tracking);

const OPEN_TEXT: SilkText = { ...OPEN_LABEL, text: 'OPEN' };
const SILK_ALL: SilkText[] = [...SILK_TEXTS, OPEN_TEXT];
const silkCaps = (() => {
  const fit = SILK_ALL.map((t) => (t.maxW && textW(t, t.cap) > t.maxW ? t.maxW / textW(t, t.cap) : 1));
  const group = new Map<string, number>();
  SILK_ALL.forEach((t, i) => {
    if (t.group) group.set(t.group, Math.min(group.get(t.group) ?? 1, fit[i]));
  });
  return SILK_ALL.map((t, i) => t.cap * (t.group ? group.get(t.group) ?? fit[i] : fit[i]));
})();

/* ---------- la machine ---------- */

const DEG = Math.PI / 180;
const potDeg = (t: number): number => TEMPO_UI.sweepDeg / 2 - TEMPO_UI.sweepDeg * t;

interface KnobDraw {
  id: string;
  x: number;
  z: number;
  sr: number;
  sh: number;
  capY: number;
  ring: string;
  angleDeg: number;
}

const KNOBS: KnobDraw[] = [
  ...NAV_KNOBS.map((k) => ({ id: k.id, x: k.x, z: NAV_ROW.z, sr: 1, sh: 1, capY: NAV_ROW.capY, ring: HEX.yellow, angleDeg: 0 })),
  {
    id: 'tempo',
    x: AUDIO_KNOBS.tempo.x,
    z: AUDIO_KNOBS.tempo.z,
    sr: AUDIO_KNOBS.tempo.scale[0],
    sh: AUDIO_KNOBS.tempo.scale[1],
    capY: AUDIO_KNOBS.tempo.capY,
    ring: HEX.line,
    angleDeg: potDeg((BPM.initial - BPM.min) / (BPM.max - BPM.min)),
  },
  {
    id: 'tone',
    x: AUDIO_KNOBS.tone.x,
    z: AUDIO_KNOBS.tone.z,
    sr: AUDIO_KNOBS.tone.scale[0],
    sh: AUDIO_KNOBS.tone.scale[1],
    capY: AUDIO_KNOBS.tone.capY,
    ring: HEX.line,
    angleDeg: potDeg(1),
  },
  {
    id: 'level',
    x: AUDIO_KNOBS.level.x,
    z: AUDIO_KNOBS.level.z,
    sr: AUDIO_KNOBS.level.scale[0],
    sh: AUDIO_KNOBS.level.scale[1],
    capY: AUDIO_KNOBS.level.capY,
    ring: HEX.line,
    angleDeg: potDeg(0.8),
  },
];

/** Objets en relief, du plus lointain au plus proche (x + z croissant). */
function solids(): React.ReactNode[] {
  const items: { depth: number; nodes: React.ReactNode[] }[] = [];
  const y0 = TOP_Y;
  // Pads : dessus, face avant (+z), face droite (+x)
  for (const p of PADS) {
    const h = PAD.size / 2;
    const y1 = y0 + PAD.height;
    const q = (pts: [number, number, number][]): string => pathOf(pts.map(([x, y, z]) => P(x, y, z)));
    items.push({
      depth: p.x + p.z,
      nodes: [
        <path key={`pad-${p.id}-x`} d={q([[p.x + h, y0, p.z - h], [p.x + h, y0, p.z + h], [p.x + h, y1, p.z + h], [p.x + h, y1, p.z - h]])} fill={C.padSideX} />,
        <path key={`pad-${p.id}-z`} d={q([[p.x - h, y0, p.z + h], [p.x + h, y0, p.z + h], [p.x + h, y1, p.z + h], [p.x - h, y1, p.z + h]])} fill={C.padSideZ} />,
        <path key={`pad-${p.id}-t`} d={q([[p.x - h, y1, p.z - h], [p.x + h, y1, p.z - h], [p.x + h, y1, p.z + h], [p.x - h, y1, p.z + h]])} fill={HEX.padTop} />,
      ],
    });
  }
  // Pas, RUN, CLEAR, OPEN : cylindres plats
  for (let i = 0; i < STEPS.count; i += 1) {
    const x = stepX(i);
    items.push({ depth: x + STEPS.z, nodes: cylinder(`step-${i}`, x, STEPS.z, STEPS.r, y0, STEPS.h, C.stepSide, HEX.stepBtn) });
  }
  const T = TRANSPORT;
  items.push({ depth: T.run.x + T.run.z, nodes: cylinder('run', T.run.x, T.run.z, T.run.r, y0, T.run.h, C.runSide, HEX.red) });
  items.push({ depth: T.clear.x + T.clear.z, nodes: cylinder('clear', T.clear.x, T.clear.z, T.clear.r, y0, T.clear.h, C.darkSide, C.darkTop) });
  items.push({ depth: T.open.x + T.open.z, nodes: cylinder('open', T.open.x, T.open.z, T.open.r, y0, T.open.h, C.darkSide, C.darkTop) });
  // Knobs : lisere a plat, corps, repere bone, capuchon metal
  for (const k of KNOBS) {
    const r = KNOB.r * k.sr;
    const h = KNOB.h * k.sh;
    const [rx0, ry0] = P(k.x, y0 + KNOB.ringTube, k.z);
    const a = k.angleDeg * DEG;
    const dx = -Math.sin(a);
    const dz = -Math.cos(a);
    const m0 = P(k.x + dx * 0.09 * k.sr, y0 + h, k.z + dz * 0.09 * k.sr);
    const m1 = P(k.x + dx * 0.35 * k.sr, y0 + h, k.z + dz * 0.35 * k.sr);
    items.push({
      depth: k.x + k.z,
      nodes: [
        <ellipse
          key={`${k.id}-ring`}
          cx={rx0}
          cy={ry0}
          rx={r1(r * S)}
          ry={r1(r * Math.hypot(UX, UZ) * S)}
          fill="none"
          stroke={k.ring}
          strokeWidth={r1(KNOB.ringTube * 2 * S)}
        />,
        ...cylinder(`${k.id}-body`, k.x, k.z, r, y0, h, C.knobSide, C.darkTop),
        <line key={`${k.id}-mark`} x1={m0[0]} y1={m0[1]} x2={m1[0]} y2={m1[1]} stroke={HEX.bone} strokeWidth={r1(0.05 * S)} strokeLinecap="round" />,
        ...cylinder(`${k.id}-cap`, k.x, k.z, KNOB.capR, y0 + k.capY, KNOB.capH, C.darkSide, C.cap),
      ],
    });
  }
  return items.sort((a, b) => a.depth - b.depth).flatMap((it) => it.nodes);
}

/** Le dessus du plateau : filets, cadre OPEN, LED, serigraphie (plan y = dessus). */
function silkPlane(): React.ReactNode {
  const union = Array.from({ length: STEPS.count }, (_, i) => INSTRUMENTS.some((k) => DEFAULT_STEPS[k][i] === '1'));
  const F = OPEN_FRAME;
  return (
    <g transform={plane(TOP_Y + 0.004)}>
      {SILK_RULES.map((r, i) => (
        <line key={`rule-${i}`} x1={r.x0} y1={r.z0} x2={r.x1} y2={r.z1} stroke={HEX.line} strokeWidth={SILK.ruleWidth} />
      ))}
      <rect x={F.x0} y={F.z0} width={F.x1 - F.x0} height={F.z1 - F.z0} rx={F.radius} fill="none" stroke={HEX.yellow} strokeWidth={F.stroke} />
      {union.map((on, i) => (
        <circle key={`led-${i}`} cx={stepX(i)} cy={STEPS.ledZ} r={STEPS.ledR} fill={on ? HEX.ledSet : HEX.line} />
      ))}
      {NAV_KNOBS.map((k) => (
        <circle key={`kled-${k.id}`} cx={k.x} cy={NAV_ROW.ledZ} r={STEPS.ledR} fill={HEX.line} />
      ))}
      {SILK_ALL.map((t, i) => {
        const size = silkCaps[i] / SILK.capRatio;
        // letter-spacing suit aussi la derniere lettre : on la compense
        const shift = t.align === 'right' ? SILK.tracking * size : (SILK.tracking * size) / 2;
        return (
          <text
            key={`silk-${i}`}
            x={t.x + shift}
            y={t.z + silkCaps[i] / 2}
            fontSize={size}
            textAnchor={t.align === 'right' ? 'end' : 'middle'}
            fill={t.alpha ? `rgba(246, 241, 231, ${t.alpha})` : C.bone70}
            className="v4-silk"
          >
            {t.text}
          </text>
        );
      })}
    </g>
  );
}

/** L'ecran et son cadre : MM-808, le tempo, READY. */
function screen(): React.ReactNode {
  const y = TOP_Y + LCD.y;
  const x0 = LCD.x - LCD.w / 2;
  const z0 = LCD.z - LCD.d / 2;
  const [tw, th] = LCD.tex;
  const px = (v: number): number => (v / tw) * LCD.w;
  const pz = (v: number): number => (v / th) * LCD.d;
  const size = pz(34);
  const bez = outline(LCD_BEZEL.w, LCD_BEZEL.d, 0.001, LCD_BEZEL.x, LCD_BEZEL.z);
  return (
    <>
      <path d={prism([
        [bez, TOP_Y],
        [bez, TOP_Y + LCD_BEZEL.h],
      ])} fill={HEX.graphiteLo} />
      <g transform={plane(y)}>
        <rect x={x0} y={z0} width={LCD.w} height={LCD.d} fill={HEX.lcdGlass} />
        <g className="v4-lcd-text" fill={HEX.lcdInk} fontSize={size}>
          <text x={x0 + px(24)} y={z0 + pz(76)}>
            MM-808
          </text>
          <text x={x0 + LCD.w - px(24)} y={z0 + pz(76)} textAnchor="end">
            {`${BPM.initial} BPM`}
          </text>
          <text x={x0 + px(24)} y={z0 + pz(150)}>
            READY
          </text>
        </g>
      </g>
    </>
  );
}

const plateY0 = TOP_Y - PLATE.thickness;

function body(spec: BodySpec, outer: [number, number][], inner: [number, number][], y0: number): { side: string; band: string; top: string } {
  const t = spec.thickness;
  const b = spec.bevelThickness;
  return {
    side: prism([
      [inner, y0],
      [outer, y0 + b],
      [outer, y0 + t - b],
    ]),
    band: prism([
      [outer, y0 + t - b],
      [inner, y0 + t],
    ]),
    top: pathOf(at(inner, y0 + t)),
  };
}

const SOCLE_D = body(SOCLE, socleOuter, socleInner, LAYERS.socleY);
const PLATE_D = body(PLATE, plateOuter, plateInner, plateY0);

const DRAWING = (
  <>
    <path d={SOCLE_D.side} fill={C.socleSide} />
    <path d={SOCLE_D.band} fill={HEX.graphite} />
    <path d={SOCLE_D.top} fill={HEX.graphiteLo} />
    <path d={PLATE_D.side} fill={C.plateSide} />
    <path d={PLATE_D.band} fill={HEX.graphiteHi} />
    <path d={PLATE_D.top} fill={HEX.graphite} />
    {silkPlane()}
    {screen()}
    {solids()}
  </>
);

export const StaticMachine: React.FC = () => (
  <svg className="v4-fallback-machine" viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-labelledby="v4-machine-title v4-machine-desc">
    <title id="v4-machine-title">MM-808 drum machine</title>
    <desc id="v4-machine-desc">Four pads, sixteen steps with a red RUN button, five knobs for the sections and a small screen.</desc>
    {DRAWING}
  </svg>
);

export default StaticMachine;
