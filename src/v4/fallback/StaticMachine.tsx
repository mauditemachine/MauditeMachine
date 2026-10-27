/**
 * La MM-808 en SVG statique (spec 11.5 et 20.10), pour la page de repli :
 * la machine de la revision 2 vue comme la scene a sa vue par defaut
 * (orthographique, azimut 45, elevation 38), dessinee depuis les
 * constantes de theme.ts. Le chassis en coin (faces avant et droite, leurs
 * chanfreins), le panneau incline (tranche et dessus), la serigraphie,
 * l'ecran OLED (MM-808, le tempo, READY), puis les volumes du plus lointain au
 * plus proche : les touches de page sous l'ecran et les huit encodeurs dessous
 * (au telephone aussi depuis le 2026-10-19 ; MASTER et TEMPO sont dans l'ecran),
 * les pads, RUN, CLEAR, les 16 touches trig, celles du motif par defaut
 * allumees (2026-10-19 : plus de LED au-dessus, la touche s'allume).
 * Aucune animation ; calcule une fois au chargement du module.
 *
 * La face V.4.0 du desktop (2026-10-27, Mika : "faceplate Octatrack x
 * Digitakt") : dessinee depuis rytm/faceplate.ts par theme.ts (KEY_LABELS,
 * FACE_KEY, XFADE, KNOB_RING) : l'ecran 4.3 pouces, les huit potards en 2 x 4
 * et leur anneau de valeur (la meme loi que la scene, theme.ts ringLit), la
 * rangee des douze touches a pictogramme (rytm/icons.ts, traces tels quels),
 * SCENE A et B et la fente du crossfader avec son capuchon, les seize pas en
 * deux rangees et leurs legendes (le numero, BD a CY sur 1 a 8), allumes comme
 * a l'arrivee (BD choisi). Le telephone garde son dessin (phase 5).
 */

import React from 'react';
import { BPM, DEFAULT_STEPS, INSTRUMENTS, velocity } from '../audio/pattern';
import { ICON_STROKE, ICON_VIEWBOX, RYTM_ICONS } from '../rytm/icons';
import { faceKnobs } from '../rytm/faceKnobs';
import {
  BODY,
  ENCODER,
  FACE_KEY,
  FACE_KNOBS,
  HEX,
  KEYS,
  KEY_ICON,
  KEY_LABEL,
  KEY_LABELS,
  KEY_LIT,
  KNOB_RING,
  PORTRAIT,
  RING_TONE,
  XFADE,
  ringLit,
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
  STEP_LIT,
  TEMPO_UI,
  TILT,
  TRANSPORT,
  chassisTopY,
  pageKeyX,
  keyDz,
  keyX,
  type KeyLabelSpec,
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
  /** MASTER et TEMPO (2026-10-09) : l'aluminium du flanc, du dessus, le trait grave */
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
      {!PORTRAIT && faceFlat()}
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

/** Un melange de deux teintes #rrggbb (t de 0 a 1). */
function mixHex(a: string, b: string, t: number): string {
  const pa = [1, 3, 5].map((k) => parseInt(a.slice(k, k + 2), 16));
  const pb = [1, 3, 5].map((k) => parseInt(b.slice(k, k + 2), 16));
  return `#${pa.map((x, k) => Math.round(x + (pb[k] - x) * Math.max(0, Math.min(1, t))).toString(16).padStart(2, '0')).join('')}`;
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

/**
 * Le nom imprime sur une touche (2026-10-18, theme.ts KEY_LABELS) : pose sur
 * son dessus, a la hauteur h, apres la touche (meme profondeur de tri) ; le
 * corps reduit pour tenir, comme la texture (scene/keyLabels.ts).
 */
function keyLabel(s: Solid, id: string, h: number): Solid {
  const l = KEY_LABELS.find((k) => k.id === id);
  if (!l) return s;
  const room = l.w - 2 * KEY_LABEL.margin;
  const probe: SilkText = { text: l.text, x: 0, z: 0, cap: KEY_LABEL.cap };
  const cap = KEY_LABEL.cap * Math.min(1, room / textW(probe, KEY_LABEL.cap));
  const size = cap / SILK.capRatio;
  const ls = SILK.tracking * size;
  s.nodes.push(
    <g key={`klabel-${id}`} transform={planeAt(h + 0.003)}>
      <text x={l.x + ls / 2} y={l.z + KEY_LABEL.dz + cap / 2} fontSize={size} fontWeight={KEY_LABEL.weight} textAnchor="middle" fill={C.bone85} className="v4-silk">
        {l.text}
      </text>
    </g>
  );
  return s;
}

/** Encodeur : flanc (enveloppe des deux cercles), dessus, repere bone. */
function encoder(i: number, angleDeg: number): Solid {
  const { x, z, s } = FACE_KNOBS[i];
  const E = { r: ENCODER.r, rTop: ENCODER.rTop, h: ENCODER.h, markD: ENCODER.mark.d, markW: ENCODER.mark.w };
  const ring = (r: number, y: number): V2[] =>
    Array.from({ length: 24 }, (_, k) => {
      const a = (k / 24) * Math.PI * 2;
      return P(panel(x + Math.cos(a) * r, y, z + Math.sin(a) * r));
    });
  // A son echelle (les potards du telephone sont plus gros)
  const topY = E.h * s;
  const bottom = ring(E.r * s, 0);
  const top = ring(E.rTop * s, topY);
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
  const m1 = P(panel(x - Math.sin(a) * E.markD * s, topY, z - Math.cos(a) * E.markD * s));
  return {
    depth: dot(Z, panel(x, topY / 2, z)),
    nodes: [
      <path key={`enc-${i}-s`} d={pathOf(hull)} fill={C.encSide} />,
      <path key={`enc-${i}-t`} d={pathOf(top)} fill={HEX.encoder} />,
      <line key={`enc-${i}-m`} x1={m0[0]} y1={m0[1]} x2={m1[0]} y2={m1[1]} stroke={HEX.bone} strokeWidth={r1(E.markW * S)} strokeLinecap="round" />,
    ],
  };
}

const potDeg = (t: number): number => TEMPO_UI.sweepDeg / 2 - TEMPO_UI.sweepDeg * t;

/* ---------- la face V.4.0 du desktop (2026-10-27) ---------- */

/** Les encres des touches (scene/keyLabels.ts) : au repos sur la machine noire, l'os de RUN, le noir sur un pas allume. */
const INK_REST = KEY_LABEL.inkRest.dark;
const INK_BONE = 'rgba(246, 241, 231, 0.92)';
const INK_DARK = 'rgba(14, 14, 16, 0.92)';
const r4 = (n: number): number => Math.round(n * 10000) / 10000;

/** Un point de l'anneau : l'angle (deg, 0 a midi, positif vers la gauche comme potDeg) au rayon r autour de (x, z). */
const ringPt = (x: number, z: number, a: number, r: number): string => `${r4(x - Math.sin(a * DEG) * r)} ${r4(z - Math.cos(a * DEG) * r)}`;

/**
 * A plat sur le panneau, sous les volumes : les anneaux de valeur des huit potards (27 segments sur les 270 deg de la
 * course, l'orange des pas mis, le dernier en partie ; STRETCH du centre a sa valeur) et la fente du crossfader.
 */
function faceFlat(): React.ReactNode {
  const R = KNOB_RING;
  const half = (TEMPO_UI.sweepDeg / R.segments - R.airDeg) / 2;
  const segs: React.ReactNode[] = [];
  // Les potards suivent la page (2026-10-27) : les anneaux de la page de l'arrivee, lus dans rytm/faceKnobs.ts (la meme loi)
  const views = faceKnobs.get();
  FACE_KNOBS.forEach((k, i) => {
    const v = views[i];
    const t = v && v.state === 'live' ? v.pos : 0;
    const bip = !!v && v.bipolar;
    const tone = RING_TONE[v ? v.tone : 'off'];
    for (let j = 0; j < R.segments; j += 1) {
      const a = potDeg((j + 0.5) / R.segments);
      const steps = [-half, -half / 2, 0, half / 2, half];
      const outer = steps.map((d) => ringPt(k.x, k.z, a + d, R.r1));
      const inner = steps.reverse().map((d) => ringPt(k.x, k.z, a + d, R.r0));
      segs.push(<path key={`ring-${i}-${j}`} d={`M${[...outer, ...inner].join('L')}Z`} fill={mixHex(HEX.line, tone.on, ringLit(j, t, bip) * tone.k)} />);
    }
  });
  const X = XFADE;
  return (
    <>
      <g transform={planeAt(R.y)}>{segs}</g>
      <g transform={planeAt(X.slot.h)}>
        <rect x={r4(X.x - X.slot.w / 2)} y={r4(X.z - X.slot.d / 2)} width={r4(X.slot.w)} height={r4(X.slot.d)} rx={r4(X.slot.d / 2)} fill={HEX.oled} />
      </g>
    </>
  );
}

/**
 * Ce qui est imprime sur une touche de la face V.4.0 (theme.ts KEY_LABELS) : son pictogramme (rytm/icons.ts, les traces
 * de Tabler a l'echelle de KEY_ICON.size, trait de ICON_STROKE), ou son texte (la lettre d'une scene, le numero et la voix
 * d'un pas), a la hauteur h ; lit : un pas allume, l'encre passe au noir.
 */
function faceLabel(s: Solid, l: KeyLabelSpec, h: number, lit = false): Solid {
  const ink = lit ? INK_DARK : l.rest === 'bone' ? INK_BONE : INK_REST;
  if (l.icon) {
    const icon = RYTM_ICONS[l.icon];
    const q = KEY_ICON.size;
    const cz = l.z + (l.dz ?? KEY_ICON.dz);
    s.nodes.push(
      <g
        key={`kicon-${l.id}`}
        transform={`${planeAt(h + 0.003)} translate(${r4(l.x - q / 2)} ${r4(cz - q / 2)}) scale(${r4(q / ICON_VIEWBOX)})`}
        fill="none"
        stroke={ink}
        strokeWidth={ICON_STROKE}
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        {icon.paths.map((d, i) => (
          <path key={`p${i}`} d={d} />
        ))}
        {(icon.fills ?? []).map((d, i) => (
          <path key={`f${i}`} d={d} fill={ink} />
        ))}
      </g>
    );
    return s;
  }
  const cap0 = l.cap ?? KEY_LABEL.cap;
  const room = l.qw ?? l.w - 2 * KEY_LABEL.margin;
  const cap = cap0 * Math.min(1, room / textW({ text: l.text, x: 0, z: 0, cap: cap0 }, cap0));
  const size = cap / SILK.capRatio;
  const ls = SILK.tracking * size;
  const left = l.align === 'left';
  s.nodes.push(
    <g key={`klabel-${l.id}`} transform={planeAt(h + 0.003)}>
      <text x={r4(left ? l.x - room / 2 : l.x + ls / 2)} y={r4(l.z + (l.dz ?? KEY_LABEL.dz) + cap / 2)} fontSize={r4(size)} fontWeight={KEY_LABEL.weight} textAnchor={left ? 'start' : 'middle'} fill={ink} className="v4-silk">
        {l.text}
      </text>
    </g>
  );
  return s;
}

/** Les volumes de la face V.4.0 : les potards, la rangee des douze touches et les scenes, le capuchon du crossfader, les pas. */
function faceSolids(items: Solid[]): void {
  // Les capuchons a la course de leur fonction (2026-10-27) ; une case vide ou un dessin : en bas
  const views = faceKnobs.get();
  FACE_KNOBS.forEach((_, i) => {
    const v = views[i];
    items.push(encoder(i, potDeg(v && (v.state === 'live' || v.state === 'off') ? v.pos : 0)));
  });
  // La rangee (TRK VOICE FLTR ENV FX EDIT OPEN RUN/STOP CLEAR RANDOM MUTE SOLO), SCENE A et B : la forme des touches de
  // page, RUN sur son rouge ; leur pictogramme ou leur lettre dessus
  for (const l of KEY_LABELS) {
    if (l.group === 'stepn' || l.group === 'stepv') continue;
    const red = l.id === 'run';
    items.push(faceLabel(box(`fkey-${l.id}`, l.x, l.z, l.w / 2, l.d / 2, FACE_KEY.h, red ? HEX.red : HEX.graphiteHi, red ? C.runSide : C.clearSide, red ? C.runSide : C.clearSide), l, FACE_KEY.h));
  }
  // Le capuchon du crossfader, au milieu de sa course (phase 1), son trait d'os sur le dessus
  const X = XFADE;
  const cap = box('xfade', X.x, X.z, X.cap.w / 2, X.cap.d / 2, X.cap.h, HEX.encoder, C.encSide, C.encSide);
  const m0 = P(panel(X.x, X.cap.h, X.z - X.cap.mark.d / 2));
  const m1 = P(panel(X.x, X.cap.h, X.z + X.cap.mark.d / 2));
  cap.nodes.push(<line key="xfade-m" x1={m0[0]} y1={m0[1]} x2={m1[0]} y2={m1[1]} stroke={HEX.bone} strokeWidth={r1(X.cap.mark.w * S)} strokeLinecap="round" />);
  items.push(cap);
  // Les seize pas en deux rangees : ceux de BD (la voix choisie a l'arrivee) allumes selon leur velocite, leurs legendes
  // au noir sur un pas allume
  const inst = INSTRUMENTS[0];
  for (let i = 0; i < KEYS.count; i += 1) {
    const v = velocity(DEFAULT_STEPS, inst, i);
    const f = v > 0 ? (STEP_LIT.ramp[v] ?? 0) : 0;
    const top = v > 0 ? mixHex(HEX.key, HEX.ledSet, f) : HEX.key;
    const key = box(`key-${i}`, keyX(i), KEYS.z + keyDz(i), KEYS.w / 2, KEYS.d / 2, KEYS.h, top, C.keySide, C.keySide);
    const ids = i < INSTRUMENTS.length ? [`stepn-${i + 1}`, `stepv-${INSTRUMENTS[i]}`] : [`stepn-${i + 1}`];
    for (const id of ids) {
      const l = KEY_LABELS.find((k) => k.id === id);
      if (l) faceLabel(key, l, KEYS.h, f > KEY_LIT.dark);
    }
    items.push(key);
  }
}
/**
 * Les encodeurs a l'arrivee : leurs FX globaux de depart (DIST, CHORUS, DELAY,
 * REVERB, BIT et COMP a 0, STRETCH a midi, SWING a 55 %).
 */
const START: Record<string, number> = { p4: 0.5, p5: 0.3 };

function solids(): React.ReactNode[] {
  const items: Solid[] = [];
  if (!PORTRAIT) {
    faceSolids(items);
    return items.sort((a, b) => a.depth - b.depth).flatMap((it) => it.nodes);
  }
  FACE_KNOBS.forEach((e, i) => items.push(encoder(i, potDeg(START[e.id] ?? 0))));
  // Les touches de page (2026-10-08), juste sous l'ecran depuis le 2026-10-09 ; leur nom dessus depuis le 2026-10-18
  RYTM_PAGE_KEYS.forEach((p, i) =>
    items.push(keyLabel(box(`pkey-${p.id}`, pageKeyX(i), PAGE_KEYS.z, PAGE_KEYS.w / 2, PAGE_KEYS.d / 2, PAGE_KEYS.h, HEX.graphiteHi, C.clearSide, C.clearSide), p.id, PAGE_KEYS.h))
  );
  const ph = PAD.height + PAD.dome;
  for (const p of PADS) {
    const page = p.kind !== 'voice';
    items.push(box(`pad-${p.id}`, p.x, p.z, PAD.size / 2, PAD.size / 2, ph, page ? C.pageTop : HEX.pad, page ? C.pageSide : C.padSide, page ? C.pageSide : C.padSide));
  }
  // Le transport : la forme des touches de page et son nom dessus (2026-10-18)
  const t = TRANSPORT;
  const hx = t.w / 2;
  const hz = t.d / 2;
  for (const id of ['run', 'clear', 'random', 'mute', 'solo'] as const) {
    const red = id === 'run';
    items.push(keyLabel(box(id, t[id].x, t.z, hx, hz, t.h, red ? HEX.red : HEX.graphiteHi, red ? C.runSide : C.clearSide, red ? C.runSide : C.clearSide), id, t.h));
  }
  // Les pas du motif par defaut allumes (2026-10-19) : l'orange des touches allumees, plus ou moins selon leur velocite
  for (let i = 0; i < KEYS.count; i += 1) {
    const v = Math.max(...INSTRUMENTS.map((k) => velocity(DEFAULT_STEPS, k, i)));
    const top = v > 0 ? mixHex(HEX.key, HEX.ledSet, STEP_LIT.ramp[v] ?? 0) : HEX.key;
    items.push(box(`key-${i}`, keyX(i), KEYS.z + keyDz(i), KEYS.w / 2, KEYS.d / 2, KEYS.h, top, C.keySide, C.keySide));
  }
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

/** Le dessin, fait une fois au premier rendu (2026-10-27 : les potards lisent les stores, prets a ce moment-la). */
let drawing: React.ReactNode = null;
const DRAWING = (): React.ReactNode =>
  (drawing ??= (
    <>
      {body()}
      {panelTop()}
      {solids()}
    </>
  ));

export const StaticMachine: React.FC = () => (
  <svg className="v4-fallback-machine" viewBox={`0 0 ${VB_W} ${VB_H}`} role="img" aria-labelledby="v4-machine-title v4-machine-desc">
    <title id="v4-machine-title">MM-RYTM drum machine</title>
    <desc id="v4-machine-desc">
      {PORTRAIT
        ? 'A black drum machine: a screen with six page keys under it and eight page encoders, aluminium master and tempo knobs above the ten pads, sixteen trig keys with a red RUN button.'
        : 'A black drum machine: a 4.3 inch screen, eight knobs A to H with value rings mirroring the eight screen values, a row of twelve pictogram keys, scenes A and B with a crossfader, sixteen step keys in two rows.'}
    </desc>
    {DRAWING()}
  </svg>
);

export default StaticMachine;
