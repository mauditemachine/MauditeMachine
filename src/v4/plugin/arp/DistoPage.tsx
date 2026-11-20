/**
 * La page DISTO du capot. v46 (2026-11-20) : la page simplifiee, l'option A des maquettes v44, validee par Mika ("Disto A
 * mais pas le bouton en rouge comme ca !"). Avant : 14 cadres, 53 reglages ; Mika : "je trouve ca vraiment trop complexe
 * le multibande bof.. peut etre mettre un EQ a la place ... je veux qu'un seul EQ ... Le bouton punish doit etre plus
 * imposant.. il doit faire mal celui la !". Au design d'OPEN : cuir, potards du MM-RYTM, touches, verre noir. Le DSP :
 * dsp/Decap.{h,cpp} ; les styles, les lois, la banque : disto.ts et distoBank.ts.
 * - rangee 1 : DRIVE en grand (le potard DISTO de la face, dist), PUNISH (le PUNISH v2, xDPunish2 ; l'ancien, xDPunish,
 *   s'allume aussi avec CLASSIC ecrit dessous, le premier appui le convertit), l'ecran TRANSFER ; STYLE en quatre lignes
 *   de familles (TAPE, TUBE, TRANSISTOR, DESTROY) et MM ENGINE a part ; OUTPUT (MIX, OUTPUT, AUTO) ; le VU ATTITUDE ;
 * - rangee 2 : un seul EQ (LOW CUT et THUMP, TONE, HIGH CUT et STEEP, PRE, POST, la caisse CAB) ; CLEAN LOW, le
 *   multibande reduit a un geste (2 bandes, la basse contournee), une zone grisee tiree depuis la gauche du graphe ;
 * - rangee 3 : MOVE (ENV -> DRIVE ; LFO RATE, SYNC, DEPTH, TARGET) ; a droite les PRESETS en liste par famille.
 * Caches, gardes et toujours actifs (les projets et les presets sonnent pareil) : MORPH, DYNAMICS, FEEDBACK, BOX SIZE et
 * MIX, ENV SPEED, LFO SHAPE, la matrice du multibande. Quand l'un d'eux agit : EXTRA ON et RESET sur l'EQ.
 * &distoDemo=<preset> charge un preset au montage, &distoSel=LC|TONE|HC|PRE|POST|CLEAN choisit le point de l'EQ (les
 * captures, Chromium muet) ; &punishVar=B|C montre une autre forme de PUNISH (les propositions a Mika, A par defaut).
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { voyParams } from '../../voyager/params';
import { DISTO_CURVES, DISTO_IDS, DISTO_PRESETS, DISTO_STYLES, distoCurrent, distoCurve, distoInert, distoInit, distoLaws, distoLoad, distoStep, type DistoPreset } from './disto';
import { DISTO_FAMILIES, familyOf, type DistoFamilyId } from './distoBank';
import { arpExtra } from './extra';
import { arpMod } from './modview';
import { PcbFrame, PcbKey, PcbKnob, PcbRotary, PcbSelect, PcbToggle, registerVirtual, say, SRC } from './pcbui';
import spec from '../../../../plugin/mm-arp/extra-params.json';
import './disto2.css';

const useExtraAll = () => useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
const useVoy = () => useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
const X = (id: string): number => arpExtra.of(id);
const NST = DISTO_STYLES.length;
const stepIdx = (id: string, n: number): number => Math.max(0, Math.min(n - 1, Math.round(X(id) * (n - 1))));
const styleNow = (): string => DISTO_STYLES[stepIdx('xDStyle', NST)];
const setStyle = (st: string): void => {
  arpExtra.set('xDStyle', DISTO_STYLES.indexOf(st) / (NST - 1));
};
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));
const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.0015;
const DEF: Readonly<Record<string, number>> = Object.fromEntries((spec.params as readonly { id: string; def: number }[]).filter((p) => DISTO_IDS.includes(p.id)).map((p) => [p.id, p.def]));

/* ---------------- PUNISH : v2 (xDPunish2) ; l'ancien (xDPunish, OLD) garde, converti au premier appui ---------------- */

const punNew = (): boolean => X('xDPunish2') >= 0.5;
const punOld = (): boolean => X('xDPunish') >= 0.5;
/** v2 engage, ou l'ancien seul (CLASSIC) */
const punishOn = (): boolean => punNew() || punOld();
function punishFlip(): void {
  if (punOld() && !punNew()) {
    // un projet d'avant : le premier appui le passe en PUNISH v2
    arpExtra.set('xDPunish2', 1);
    arpExtra.set('xDPunish', 0);
  } else if (punNew()) {
    arpExtra.set('xDPunish2', 0);
    arpExtra.set('xDPunish', 0);
  } else {
    arpExtra.set('xDPunish2', 1);
  }
}

/* ---------------- l'ecran TRANSFER : la courbe du style, du MORPH, du DRIVE et de PUNISH du moment ---------------- */

const TransferGlass: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  useExtraAll();
  const v = useVoy();
  const st = stepIdx('xDStyle', NST);
  const mm = st === 0;
  const drive = v.dist;
  const p2 = punNew();
  const db = mm ? 20 * Math.log10(1 + 40 * drive * drive) : distoLaws.driveDb(drive, punishOn());
  // le niveau de la prise (un sinus de crete 0.2) multiplie par le DRIVE
  const g = 0.2 * Math.pow(10, db / 20);
  const a = mm ? 0 : st - 1;
  const to = stepIdx('xDMorphTo', DISTO_CURVES.length);
  const m = mm ? 0 : X('xDMorph');
  const off = drive <= 0;
  const path = (f: (x: number) => number): string => {
    let peak = 1e-6;
    for (let i = 0; i <= 60; i += 1) peak = Math.max(peak, Math.abs(f(-1 + i / 30)));
    const pts: string[] = [];
    for (let i = 0; i <= 60; i += 1) {
      const u = -1 + i / 30;
      pts.push(`${(w / 2 + u * (w / 2 - 8)).toFixed(1)},${(h / 2 - (f(u) / peak) * (h / 2 - 7)).toFixed(1)}`);
    }
    return pts.join(' ');
  };
  const shape = (x: number): number => (1 - m) * distoCurve(a, g * x) + m * distoCurve(to, g * x);
  const main = off ? (x: number) => x : p2 && !mm ? (x: number) => distoLaws.punish2(shape(x)) : shape;
  return (
    <div className="mm-dm-glass" style={{ width: w, height: h }} aria-hidden="true">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <path className="grid" d={`M${w / 2} 4V${h - 4}M4 ${h / 2}H${w - 4}`} />
        {m > 0 && !off && <polyline className="ghost" points={path((x) => distoCurve(to, g * x))} />}
        <polyline className={off ? 'main off' : 'main'} points={path(main)} />
        <text x="7" y="11">
          TRANSFER
        </text>
        <text x={w - 7} y={h - 6} textAnchor="end" className="hot">
          {off ? 'OFF' : mm ? 'MM · ENGINE' : m > 0 ? `${DISTO_STYLES[st]} → ${DISTO_CURVES[to]} ${Math.round(m * 100)}%` : DISTO_STYLES[st]}
        </text>
      </svg>
    </div>
  );
};

/* ---------------- le VU ATTITUDE ---------------- */

const useVu = (): number | null => useSyncExternalStore(arpMod.subscribe, () => arpMod.of('distoVu')?.v ?? null);
const VU_LO = -20;
const VU_HI = 3;
/** -20..+3 dB vers -1..1, a la loi d'un VU (lineaire en amplitude). */
const vuPos = (d: number): number => {
  const a = Math.pow(10, VU_LO / 20);
  const b = Math.pow(10, VU_HI / 20);
  return ((Math.pow(10, Math.min(VU_HI + 1, Math.max(VU_LO - 6, d)) / 20) - a) / (b - a)) * 2 - 1;
};

/** Le VU a aiguille (celui de HELL) : ce qui entre dans la saturation, -20 a +3 dB, l'aiguille avec un rien d'inertie. */
export const AttitudeVu: React.FC = () => {
  const target = useVu();
  const [x, setX] = useState(-1);
  const st = useRef({ x: -1, v: 0, goal: -1, raf: 0, t: 0 });
  st.current.goal = target === null ? -1.05 : vuPos(target * (VU_HI - VU_LO) + VU_LO);
  useEffect(() => {
    const s = st.current;
    const step = (now: number): void => {
      const dt = Math.min(0.05, s.t ? (now - s.t) / 1000 : 0.016);
      s.t = now;
      const w = 12;
      s.v += (w * w * (s.goal - s.x) - 2 * 0.75 * w * s.v) * dt;
      s.x = Math.max(-1.08, Math.min(1.08, s.x + s.v * dt));
      setX(s.x);
      s.raf = window.requestAnimationFrame(step);
    };
    s.raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(s.raf);
  }, []);
  const W = 150;
  const H = 112;
  const px = W / 2;
  const py = H - 22;
  const R = 70;
  const arc = (v: number, r: number): [number, number] => {
    const t = ((v * 42 - 90) * Math.PI) / 180;
    return [px + Math.cos(t) * r, py + Math.sin(t) * r];
  };
  const marks = [-20, -10, -7, -5, -3, -2, -1, 0, 1, 2, 3];
  const labels: [number, string][] = [
    [-20, '20'],
    [-10, '10'],
    [-5, '5'],
    [-3, '3'],
    [0, '0'],
    [3, '+3'],
  ];
  const [nx, ny] = arc(x, R - 6);
  const shown = target === null ? null : Math.round(target * (VU_HI - VU_LO) + VU_LO);
  return (
    <div className="mm-hell-vu" role="meter" aria-label="DISTO ATTITUDE" aria-valuemin={VU_LO} aria-valuemax={VU_HI} aria-valuenow={shown ?? VU_LO} data-on={target !== null ? '1' : undefined}>
      <div className="mm-hell-vu-face">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <path d={`M ${arc(-1, R)[0]} ${arc(-1, R)[1]} A ${R} ${R} 0 0 1 ${arc(1, R)[0]} ${arc(1, R)[1]}`} className="mm-hell-vu-arc" />
          <path d={`M ${arc(vuPos(0), R)[0]} ${arc(vuPos(0), R)[1]} A ${R} ${R} 0 0 1 ${arc(1, R)[0]} ${arc(1, R)[1]}`} className="mm-hell-vu-red" />
          {marks.map((d) => {
            const big = labels.some(([l]) => l === d);
            const [x1, y1] = arc(vuPos(d), R);
            const [x2, y2] = arc(vuPos(d), R + (big ? 8 : 5));
            return <line key={d} x1={x1} y1={y1} x2={x2} y2={y2} className="mm-hell-vu-tick" data-big={big ? '1' : undefined} />;
          })}
          {labels.map(([d, t]) => (
            <text key={d} x={arc(vuPos(d), R + 15)[0]} y={arc(vuPos(d), R + 15)[1] + 2.5} className="mm-hell-vu-t mm-dm-vu-t" data-red={d > 0 ? '1' : undefined}>
              {t}
            </text>
          ))}
          <text x={px} y={py - 26} className="mm-hell-vu-name">
            ATTITUDE
          </text>
          <text x={px} y={py - 15} className="mm-hell-vu-brand">
            MAUDITE MACHINE
          </text>
          <line x1={px} y1={py} x2={nx} y2={ny} className="mm-hell-vu-needle" />
          <circle cx={px} cy={py} r={7} className="mm-hell-vu-pivot" />
        </svg>
        <span className="mm-hell-vu-glass" aria-hidden="true" />
      </div>
    </div>
  );
};

/* ---------------- CLEAN LOW : le multibande reduit a un geste (2 bandes, la basse contournee) ---------------- */

const BAND_DEF: Readonly<Record<string, number>> = { Style: 0, Drive: 0.5, Mix: 1, Level: 0.5, Solo: 0, Byp: 0 };
const cleanOn = (): boolean => near(X('xDBands'), 0.5) && X('xDB1Byp') >= 0.5;
/** Le multibande complet d'un projet d'avant (plus que CLEAN LOW) : il compte dans EXTRA. */
const multiOld = (): boolean => {
  const bands = Math.round(X('xDBands') * 2) + 1;
  if (bands === 1) return false;
  if (bands === 3) return true;
  for (const b of [1, 2])
    for (const [k, d] of Object.entries(BAND_DEF)) {
      if (b === 1 && k === 'Byp') continue;
      if (!near(X(`xDB${b}${k}`), d)) return true;
    }
  return !cleanOn();
};
registerVirtual('vDClean', {
  of: () => (cleanOn() ? 1 : 0),
  def: () => 0,
  set: (v) => {
    const on = v >= 0.5;
    arpExtra.set('xDBands', on ? 0.5 : 0);
    arpExtra.set('xDB1Byp', on ? 1 : 0);
  },
  text: (v) => (v >= 0.5 ? 'ON' : 'OFF'),
  steps: ['OFF', 'ON'],
  name: 'CLEAN LOW',
});

/* ---------------- EXTRA : les reglages caches qui agissent encore ---------------- */

const HIDDEN: readonly [string, string][] = [
  ['xDMorph', 'MORPH'],
  ['xDMorphTo', 'MORPH TO'],
  ['xDDyn', 'DYNAMICS'],
  ['xDFb', 'FEEDBACK'],
  ['xDFbFreq', 'FB FREQ'],
  ['xDBoxSize', 'BOX SIZE'],
  ['xDBoxMix', 'BOX MIX'],
  ['xDEnvSpd', 'ENV SPEED'],
  ['xDLfoShape', 'LFO SHAPE'],
];
/** Les noms des reglages caches qui ne sont pas au neutre ET qui agissent (le multibande d'avant : MULTIBAND). */
function extraOn(): string[] {
  const on = HIDDEN.filter(([id]) => !distoInert(id) && !near(X(id), DEF[id] ?? 0)).map(([, n]) => n);
  if (multiOld()) on.push('MULTIBAND');
  return on;
}
/** RESET : tous les reglages caches au neutre ; le multibande revient a une bande, ou a CLEAN LOW s'il y etait. */
function extraReset(): void {
  for (const [id] of HIDDEN) arpExtra.set(id, DEF[id] ?? 0);
  const keepClean = cleanOn();
  arpExtra.set('xDBands', keepClean ? 0.5 : 0);
  for (const b of [1, 2, 3]) for (const [k, d] of Object.entries(BAND_DEF)) arpExtra.set(`xDB${b}${k}`, b === 1 && k === 'Byp' && keepClean ? 1 : d);
  arpExtra.set('xDXHi', DEF.xDXHi ?? 0.5);
}

/* ---------------- les lois (Decap.cpp) et la reponse de chaque point de l'EQ ---------------- */

const { lowHz, highHz, filtHz, xLoHz } = distoLaws;
const resoQ = (v: number): number => 0.7071 * Math.pow(16, clamp01(v));
const FILT_MODES = ['OFF', 'LP', 'BP', 'HP', 'PEAK'] as const;
const modeOf = (id: string): (typeof FILT_MODES)[number] => FILT_MODES[Math.round(X(id) * 4)] ?? 'OFF';
const mag2 = (nr: number, ni: number, dr: number, di: number): number => 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
function filtDb(mode: string, fc: number, q: number, f: number, peakDb = 12): number {
  const r = f / fc;
  const r2 = r * r;
  switch (mode) {
    case 'LP':
      return mag2(1, 0, 1 - r2, r / q);
    case 'HP':
      return mag2(-r2, 0, 1 - r2, r / q);
    case 'BP':
      return mag2(0, r / q, 1 - r2, r / q);
    case 'PEAK':
      return mag2(1 - r2, (Math.pow(10, peakDb / 20) * r) / q, 1 - r2, r / q);
    default:
      return 0;
  }
}
// BOX (Decap.cpp kBox) : passe-haut, passe-bas, deux cloches ; la resonance courte n'est pas dessinee
const BOXES = [null, [160, 4200, 1800, 5, 1.2, 0, 0, 1], [90, 5200, 1200, 4, 0.9, 2600, -3, 2], [70, 4600, 110, 4, 1.0, 2200, 3, 1.2], [420, 3000, 1500, 6, 1.5, 0, 0, 1]] as const;
const BOX_NAMES = ['OFF', 'SMALL', 'COMBO', 'STACK', 'RADIO'] as const;

type NodeId = 'LC' | 'TONE' | 'HC' | 'PRE' | 'POST';
const NODE_NAME: Record<NodeId, string> = { LC: 'LOW CUT', TONE: 'TONE', HC: 'HIGH CUT', PRE: 'PRE', POST: 'POST' };
/** avant (true) ou apres (false) la saturation */
const NODE_PRE: Record<NodeId, boolean> = { LC: true, TONE: true, HC: false, PRE: true, POST: false };

function responseDb(f: number): number {
  let db = 0;
  const lc = lowHz(X('xDLow'));
  if (lc > 0) {
    const r = f / lc;
    db += mag2(-r * r, 0, 1 - r * r, r / (X('xDThump') >= 0.5 ? 2 : 0.7071));
  }
  const t = (X('xDTone') - 0.5) * 2;
  const lo = Math.pow(10, (-6 * t) / 20);
  const hi = Math.pow(10, (6 * t) / 20);
  const s = f / 700;
  db += 10 * Math.log10((lo * lo + hi * hi * s * s) / (1 + s * s));
  const hc = highHz(X('xDHigh'));
  if (hc > 0) {
    const r = f / hc;
    db += -10 * Math.log10(1 + r * r);
    if (X('xDSteep') >= 0.5) db += mag2(1, 0, 1 - r * r, r / 0.618) + mag2(1, 0, 1 - r * r, r / 1.618);
  }
  db += filtDb(modeOf('xDPreMode'), filtHz(X('xDPreFreq')), resoQ(X('xDPreReso')), f);
  db += filtDb(modeOf('xDPostMode'), filtHz(X('xDPostFreq')), resoQ(X('xDPostReso')), f);
  const bx = BOXES[Math.round(X('xDBox') * 4)];
  if (bx) {
    const sc = Math.pow(2, (clamp01(X('xDBoxSize')) - 0.5) * 1.2);
    let b = filtDb('HP', bx[0] / sc, 0.7071, f) + filtDb('LP', bx[1] / sc, 0.7071, f);
    if (bx[2] > 0) b += filtDb('PEAK', bx[2] / sc, bx[4], f, bx[3]);
    if (bx[5] > 0) b += filtDb('PEAK', bx[5] / sc, bx[7], f, bx[6]);
    const m = clamp01(X('xDBoxMix'));
    db += 20 * Math.log10(Math.max(1e-4, 1 - m + m * Math.pow(10, b / 20)));
  }
  return db;
}

/* ---------------- l'EQ : un seul graphe ---------------- */

const selStore = (() => {
  let v: NodeId | 'CLEAN' = 'LC';
  const l = new Set<() => void>();
  return {
    get: () => v,
    set(n: NodeId | 'CLEAN') {
      v = n;
      l.forEach((fn) => fn());
    },
    subscribe(fn: () => void) {
      l.add(fn);
      return () => {
        l.delete(fn);
      };
    },
  };
})();
const useSel = () => useSyncExternalStore(selStore.subscribe, selStore.get, selStore.get);

/**
 * Le graphe : la courbe du chemin sature (LOW CUT, TONE, PRE avant la saturation ; HIGH CUT, POST, la caisse apres), les
 * points ronds avant le DRIVE, en losange apres ; un point se tire (FREQ de gauche a droite, TONE de haut en bas) ; la
 * zone CLEAN LOW a gauche, sa poignee se tire. EXTRA ON et RESET quand un reglage cache agit.
 */
const DistoEq: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  useExtraAll();
  const sel = useSel();
  const L = 14;
  const fx = (f: number): number => L + (Math.log10(f / 20) / 3) * (w - 2 * L);
  const hzOf = (x: number): number => 20 * Math.pow(1000, (x - L) / (w - 2 * L));
  const fy = (db: number): number => h / 2 + 4 - (db / 18) * (h / 2 - 18);
  const pts: string[] = [];
  for (let i = 0; i <= 220; i += 1) {
    const f = 20 * Math.pow(1000, i / 220);
    pts.push(`${fx(f).toFixed(1)},${fy(Math.max(-18, Math.min(18, responseDb(f)))).toFixed(1)}`);
  }
  const lc = lowHz(X('xDLow'));
  const hc = highHz(X('xDHigh'));
  const tone = (X('xDTone') - 0.5) * 2;
  const preM = modeOf('xDPreMode');
  const postM = modeOf('xDPostMode');
  const nodes: { id: NodeId; x: number; y: number; on: boolean }[] = [
    { id: 'LC', x: fx(lc > 0 ? lc : 20), y: fy(0), on: lc > 0 },
    { id: 'TONE', x: fx(700), y: fy(6 * tone), on: Math.abs(tone) > 0.01 },
    { id: 'PRE', x: fx(filtHz(X('xDPreFreq'))), y: fy(preM === 'PEAK' ? 12 : 0), on: preM !== 'OFF' },
    { id: 'POST', x: fx(filtHz(X('xDPostFreq'))), y: fy(postM === 'PEAK' ? 12 : 0), on: postM !== 'OFF' },
    { id: 'HC', x: fx(hc > 0 ? hc : 20000), y: fy(0), on: hc > 0 },
  ];
  const clean = cleanOn();
  const xc = fx(xLoHz(X('xDXLo')));
  const extra = extraOn();
  const drag = useRef<{ id: NodeId | 'CLEAN'; x0: number; y0: number; px: number; py: number } | null>(null);
  const svg = useRef<SVGSVGElement>(null);
  const k = (): number => (svg.current ? svg.current.getBoundingClientRect().width / w || 1 : 1);
  const down = (id: NodeId | 'CLEAN', x: number, y: number) => (e: React.PointerEvent<SVGGElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    selStore.set(id);
    drag.current = { id, x0: x, y0: y, px: e.clientX, py: e.clientY };
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* rien */
    }
  };
  const move = (e: React.PointerEvent<SVGGElement>): void => {
    const d = drag.current;
    if (!d) return;
    const s = k() * (e.shiftKey ? 6 : 1);
    const x = d.x0 + (e.clientX - d.px) / s;
    const y = d.y0 + (e.clientY - d.py) / s;
    const hz = hzOf(x);
    const set = (id: string, v: number): void => {
      SRC.set(id, clamp01(v));
      say(id);
    };
    switch (d.id) {
      case 'LC':
        set('xDLow', hz < 21 ? 0 : 0.02 + (0.98 * Math.log(Math.min(1000, hz) / 20)) / Math.log(50));
        break;
      case 'HC':
        set('xDHigh', hz > 19500 ? 1 : (0.98 * Math.log(Math.max(1000, hz) / 1000)) / Math.log(20));
        break;
      case 'TONE':
        set('xDTone', 0.5 + ((h / 2 + 4 - y) / (h / 2 - 18)) * 1.5);
        break;
      case 'PRE':
        set('xDPreFreq', Math.log(hz / 20) / Math.log(1000));
        break;
      case 'POST':
        set('xDPostFreq', Math.log(hz / 20) / Math.log(1000));
        break;
      case 'CLEAN':
        set('xDXLo', Math.log(Math.max(40, Math.min(1000, hz)) / 40) / Math.log(25));
        break;
      default:
    }
  };
  const up = (): void => {
    drag.current = null;
  };
  const fmt = (f: number): string => (f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)} KHZ` : `${Math.round(f)} HZ`);
  const head = ((): string => {
    switch (sel) {
      case 'LC':
        return lc > 0 ? `LOW CUT · ${fmt(lc)} · 12 DB/OCT${X('xDThump') >= 0.5 ? ' · THUMP' : ''}${clean ? ' · DRIVEN BAND ONLY' : ''}` : 'LOW CUT · OFF';
      case 'HC':
        return hc > 0 ? `HIGH CUT · ${fmt(hc)} · ${X('xDSteep') >= 0.5 ? '30' : '6'} DB/OCT` : 'HIGH CUT · OFF';
      case 'TONE':
        return `TONE · ${tone > 0.01 ? 'BRIGHT' : tone < -0.01 ? 'DARK' : 'FLAT'} ${(6 * tone).toFixed(1)} DB`;
      case 'PRE':
        return `PRE · ${preM}${preM !== 'OFF' ? ` · ${fmt(filtHz(X('xDPreFreq')))}` : ''}`;
      case 'POST':
        return `POST · ${postM}${postM !== 'OFF' ? ` · ${fmt(filtHz(X('xDPostFreq')))}` : ''}`;
      default:
        return clean ? `CLEAN LOW · ${fmt(xLoHz(X('xDXLo')))} · THE SUB STAYS CLEAN` : 'CLEAN LOW · OFF';
    }
  })();
  return (
    <div className="mm-dm-glass mm-eq-screen mm-d2-eq" style={{ width: w, height: h }}>
      <svg ref={svg} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {[50, 100, 200, 500, 1000, 2000, 5000, 10000].map((f) => (
          <g key={f}>
            <path className="grid" d={`M${fx(f).toFixed(1)} 22V${h - 14}`} />
            <text x={fx(f)} y={h - 4} textAnchor="middle">
              {f >= 1000 ? `${f / 1000}K` : f}
            </text>
          </g>
        ))}
        {[-12, -6, 0, 6, 12].map((d) => (
          <g key={d}>
            <path className={d === 0 ? 'grid zero' : 'grid'} d={`M${L} ${fy(d).toFixed(1)}H${w - L}`} />
            <text x={w - 6} y={fy(d) + 3} textAnchor="end">
              {d > 0 ? `+${d}` : d}
            </text>
          </g>
        ))}
        {clean && (
          <g className="mm-d2-clean" data-sel={sel === 'CLEAN' ? '1' : undefined} onPointerDown={down('CLEAN', xc, 0)} onPointerMove={move} onPointerUp={up} onPointerCancel={up}>
            <rect x={L} y={22} width={Math.max(0, xc - L)} height={h - 36} />
            <path d={`M${xc.toFixed(1)} 22V${h - 14}`} />
            <text x={(L + xc) / 2} y={h - 20} textAnchor="middle">
              CLEAN
            </text>
          </g>
        )}
        <polyline className="eq-fill" points={`${L},${fy(0)} ${pts.join(' ')} ${w - L},${fy(0)}`} />
        <polyline className="main" points={pts.join(' ')} />
        {nodes
          .filter((n) => n.on || sel === n.id || n.id === 'LC' || n.id === 'HC' || n.id === 'TONE')
          .map((n) => (
            <g
              key={n.id}
              className="eq-node mm-d2-node"
              data-on={n.on ? '1' : undefined}
              data-sel={sel === n.id ? '1' : undefined}
              data-pre={NODE_PRE[n.id] ? '1' : undefined}
              onPointerDown={down(n.id, n.x, n.y)}
              onPointerMove={move}
              onPointerUp={up}
              onPointerCancel={up}
              style={{ cursor: 'grab' }}
            >
              {NODE_PRE[n.id] ? <circle cx={n.x} cy={n.y} r={sel === n.id ? 7.5 : 6.5} /> : <rect x={n.x - 6} y={n.y - 6} width={12} height={12} rx={1.5} transform={`rotate(45 ${n.x} ${n.y})`} />}
              <text x={n.x} y={n.y - 11} textAnchor="middle" className="lab">
                {NODE_NAME[n.id]}
              </text>
            </g>
          ))}
        <text x={L + 2} y="14" className="dim">
          ● BEFORE THE DRIVE · ◆ AFTER · DRAG A POINT
        </text>
        <text x={w - 16} y="14" textAnchor="end" className="hot">
          {head}
        </text>
      </svg>
      {extra.length > 0 && (
        <div className="mm-eq-old mm-d2-old">
          <span className="mm-eq-old-t" title={`Hidden DISTO settings in use: ${extra.join(', ')}`}>
            EXTRA ON
          </span>
          <button type="button" className="mm-eq-old-k" onClick={extraReset} title={`Set back to neutral: ${extra.join(', ')}`} aria-label={`DISTO EXTRA RESET (${extra.join(', ')})`}>
            RESET
          </button>
        </div>
      )}
    </div>
  );
};

/** Les touches des points (comme BAND 1 a 6 de SOUND) et les reglages du point choisi ; la caisse au bout. */
const EqControls: React.FC<{ w: number }> = ({ w }) => {
  useExtraAll();
  const sel = useSel();
  const keys: [NodeId | 'CLEAN', boolean][] = [
    ['LC', lowHz(X('xDLow')) > 0],
    ['TONE', Math.abs(X('xDTone') - 0.5) > 0.005],
    ['HC', highHz(X('xDHigh')) > 0],
    ['PRE', modeOf('xDPreMode') !== 'OFF'],
    ['POST', modeOf('xDPostMode') !== 'OFF'],
    ['CLEAN', cleanOn()],
  ];
  const cells = ((): React.ReactNode => {
    switch (sel) {
      case 'LC':
        return (
          <>
            <PcbKnob id="xDLow" name="FREQ" ref_="" lo="" hi="" fine />
            <PcbToggle id="xDThump" name="THUMP" ref_="" />
          </>
        );
      case 'HC':
        return (
          <>
            <PcbKnob id="xDHigh" name="FREQ" ref_="" lo="" hi="" fine />
            <PcbToggle id="xDSteep" name="STEEP" ref_="" />
          </>
        );
      case 'TONE':
        return <PcbKnob id="xDTone" name="TONE" ref_="" lo="" hi="" fine />;
      case 'PRE':
        return (
          <>
            <PcbRotary id="xDPreMode" name="TYPE" ref_="" w={96} />
            <PcbKnob id="xDPreFreq" name="FREQ" ref_="" lo="" hi="" fine />
            <PcbKnob id="xDPreReso" name="RESO" ref_="" lo="" hi="" fine />
          </>
        );
      case 'POST':
        return (
          <>
            <PcbRotary id="xDPostMode" name="TYPE" ref_="" w={96} />
            <PcbKnob id="xDPostFreq" name="FREQ" ref_="" lo="" hi="" fine />
            <PcbKnob id="xDPostReso" name="RESO" ref_="" lo="" hi="" fine />
          </>
        );
      default:
        return (
          <>
            <PcbToggle id="vDClean" name="CLEAN LOW" ref_="" />
            <PcbKnob id="xDXLo" name="UNDER" ref_="" lo="" hi="" fine />
          </>
        );
    }
  })();
  return (
    <div className="mm-d2-eqctl" style={{ width: w }}>
      <div className="mm-d2-eqkeys">
        {keys.map(([id, on]) => (
          <PcbKey key={id} name={id === 'CLEAN' ? 'CLEAN LOW' : NODE_NAME[id]} w={40} h={14} on={sel === id} className={on ? 'mm-d2-lit' : undefined} onClick={() => selStore.set(id)} aria-label={`DISTO EQ ${id === 'CLEAN' ? 'CLEAN LOW' : NODE_NAME[id]}`} />
        ))}
      </div>
      <div className="mm-d2-eqcells">{cells}</div>
      <div className="mm-d2-cab">
        <CabKey />
      </div>
    </div>
  );
};

/** CAB : la caisse (BOX) en une touche a crans ; SIZE et MIX caches. */
const CabKey: React.FC = () => {
  useExtraAll();
  const i = Math.round(X('xDBox') * 4);
  return (
    <div className="mm-d2-cabkey">
      <PcbKey name="CAB" cap={<span>{BOX_NAMES[i]}</span>} w={50} h={18} on={i > 0} onClick={() => arpExtra.set('xDBox', ((i + 1) % 5) / 4)} aria-label={`DISTO CABINET ${BOX_NAMES[i]}`} />
    </div>
  );
};

/* ---------------- PUNISH : la touche ---------------- */

type PunishKind = 'A' | 'B' | 'C';
/**
 * v46, Mika : "pas le bouton en rouge comme ca !" ; ce qu'il aime : les touches de STYLE, une LED, allumees a l'accent
 * (SETTINGS). Trois formes proposees, A par defaut (&punishVar=B|C pour les captures) :
 * - A : une grande touche de STYLE, la LED au-dessus, PUNISH grave dessous ;
 * - B : une touche mate large, la LED dans la touche, PUNISH grave dessus ;
 * - C : le levier OFF / ON en grand, la LED a cote, PUNISH en grosses lettres.
 */
const PUNISH_KIND: PunishKind = (() => {
  if (typeof location === 'undefined') return 'A';
  const m = /[?&]punishVar=([ABC])\b/.exec(location.search);
  return m ? (m[1] as PunishKind) : 'A';
})();

const Punish: React.FC<{ kind?: PunishKind }> = ({ kind = PUNISH_KIND }) => {
  useExtraAll();
  const on = punishOn();
  const classic = punOld() && !punNew();
  const dim = distoInert('xDPunish2');
  const label = classic ? 'DISTO PUNISH, CLASSIC (an older project): click to switch to the new PUNISH' : 'DISTO PUNISH';
  const sub = classic ? <span className="mm-d2-pun-sub">CLASSIC</span> : null;
  if (kind === 'A')
    return (
      <div className="mm-d2-pun" data-kind="A" data-on={on ? '1' : undefined} data-inert={dim ? '1' : undefined} data-x="xDPunish2">
        <PcbKey name="PUNISH" on={on} w={104} h={38} className="mm-d2-punkey" onClick={punishFlip} role="switch" aria-checked={on} aria-label={label} />
        {sub}
      </div>
    );
  if (kind === 'B')
    return (
      <div className="mm-d2-pun" data-kind="B" data-on={on ? '1' : undefined} data-inert={dim ? '1' : undefined} data-x="xDPunish2">
        <button type="button" className="mm-d2-punB" role="switch" aria-checked={on} aria-label={label} data-on={on ? '1' : undefined} onClick={punishFlip}>
          <i className="mm-d2-pun-led" aria-hidden="true" />
          <b aria-hidden="true">PUNISH</b>
        </button>
        {sub}
      </div>
    );
  return (
    <div className="mm-d2-pun" data-kind="C" data-on={on ? '1' : undefined} data-inert={dim ? '1' : undefined} data-x="xDPunish2">
      <button type="button" className="mm-p2-tog-sw mm-d2-punC" role="switch" aria-checked={on} aria-label={label} data-on={on ? '1' : undefined} onClick={punishFlip}>
        <span className="mm-p2-tog-body" aria-hidden="true" />
        <span className="mm-p2-tog-lever" aria-hidden="true" />
      </button>
      <i className="mm-d2-pun-led" aria-hidden="true" />
      <span className="mm-d2-punC-names" aria-hidden="true">
        <b data-on={!on ? '1' : undefined}>OFF</b>
        <b data-on={on ? '1' : undefined}>ON</b>
      </span>
      <b className="mm-d2-punC-name" aria-hidden="true">
        PUNISH
      </b>
      {sub}
    </div>
  );
};

/* ---------------- STYLE par familles ---------------- */

const FAM_NAME: Record<DistoFamilyId, string> = { TAPE: 'TAPE', TUBE: 'TUBE', TRANSISTOR: 'TRANSISTOR', DESTROY: 'DESTROY' };

const StyleKey: React.FC<{ st: string; cap: string; name: string; long: string; w: number; h: number }> = ({ st, cap, name, long, w, h }) => {
  const on = styleNow() === st;
  return (
    <PcbKey
      name={name}
      cap={
        <span className="mm-d2-capt">
          {cap && <b className="mm-d2-letter">{cap}</b>}
          {name}
        </span>
      }
      w={w}
      h={h}
      on={on}
      className="mm-d2-stkey"
      onClick={() => setStyle(st)}
      aria-label={`DISTO STYLE ${name}`}
      aria-pressed={on}
      title={long}
    />
  );
};

/** MM : l'OVERDRIVE du moteur, le depart (la banque d'usine), a part. */
const MmKey: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  const on = styleNow() === 'MM';
  return (
    <PcbKey
      name="ENGINE"
      cap={
        <span className="mm-d2-capt">
          <b className="mm-d2-letter">MM</b>
          ENGINE
        </span>
      }
      w={w}
      h={h}
      on={on}
      className="mm-d2-stkey"
      onClick={() => setStyle('MM')}
      aria-label="DISTO STYLE MM, the engine overdrive"
      aria-pressed={on}
    />
  );
};

/** Quatre lignes, une par famille (son nom, ce qu'elle fait), ses trois styles ; MM au-dessus. */
const FamilyRows: React.FC = () => {
  useExtraAll();
  const fam = familyOf(styleNow());
  return (
    <div className="mm-d2-famrows" data-x="xDStyle">
      <div className="mm-d2-famrow mm-d2-mmrow">
        <span className="mm-d2-famname">
          OFF<i>THE ENGINE ALONE</i>
        </span>
        <MmKey w={62} h={20} />
      </div>
      {DISTO_FAMILIES.map((f) => (
        <div key={f.id} className="mm-d2-famrow" data-on={fam === f.id ? '1' : undefined}>
          <span className="mm-d2-famname">
            {FAM_NAME[f.id]}
            <i>{f.feel}</i>
          </span>
          {f.styles.map((s) => (
            <StyleKey key={s.st} {...s} w={62} h={20} />
          ))}
        </div>
      ))}
    </div>
  );
};

/* ---------------- PRESETS : la liste ouverte, rangee par famille ---------------- */

const PresetList: React.FC<{ h: number }> = ({ h }) => {
  useExtraAll();
  useVoy();
  const c = distoCurrent();
  return (
    <div className="mm-d2-plist" style={{ height: h }}>
      <div className="mm-d2-pscroll" role="listbox" aria-label="DISTO presets">
        {DISTO_FAMILIES.map((f) => (
          <div key={f.id} className="mm-d2-pgroup">
            <span className="mm-d2-pfam">{FAM_NAME[f.id]}</span>
            {DISTO_PRESETS.filter((p) => p.family === f.id).map((p: DistoPreset) => (
              <button
                key={p.name}
                type="button"
                role="option"
                aria-selected={c?.name === p.name}
                className="mm-d2-pitem"
                data-on={c?.name === p.name ? '1' : undefined}
                onClick={() => distoLoad(p)}
                title={`${p.recipe}\n${p.desc}`}
              >
                <span>{String(DISTO_PRESETS.indexOf(p) + 1).padStart(2, '0')}</span>
                {p.name}
                {p.u.punish && <i className="mm-d2-pdot" title="PUNISH" />}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="mm-d2-pkeys">
        <PcbKey name="PREV" w={34} h={15} onClick={() => distoStep(-1)} aria-label="Previous DISTO preset" />
        <PcbKey name="NEXT" w={34} h={15} onClick={() => distoStep(1)} aria-label="Next DISTO preset" />
        <PcbKey name="INIT" w={34} h={15} onClick={() => distoInit()} aria-label="DISTO INIT" />
      </div>
    </div>
  );
};

/* ---------------- les autres pieces ---------------- */

const Row: React.FC<{ top: number; left?: number; w: number; children: React.ReactNode }> = ({ top, left, w, children }) => (
  <div className="mm-p2-cells mm-hell-row" style={{ top, left: left ?? undefined, width: w }}>
    {children}
  </div>
);

/** DRIVE en grand : le potard de la face (dist), sa graduation OFF / +36 DB, la valeur en dB dessous. */
const DriveHero: React.FC<{ k: number; left: number; top: number }> = ({ k, left, top }) => {
  useExtraAll();
  const v = useVoy();
  const box = Math.round(52 * k);
  const mm = styleNow() === 'MM';
  const punish = punishOn() && !mm;
  const db = distoLaws.driveDb(v.dist, punish);
  return (
    <div className="mm-d2-drive" style={{ left, top, width: box + 40, height: box + 40 }}>
      <div className="mm-hell-hero-knob" style={{ left: 20 + box / 2 - 60, top: 6 }}>
        <PcbKnob id="dist" name="" ref_="" lo="" hi="" hero={k} />
      </div>
      <span className="mm-d2-drive-lo" style={{ top: box + 2 }}>
        OFF
      </span>
      <span className="mm-d2-drive-hi" style={{ top: box + 2 }}>
        {mm ? 'ENGINE' : '+36 DB'}
      </span>
      <span className="mm-d2-drive-name" style={{ top: box + 14 }}>
        <em>{v.dist <= 0 ? 'OFF' : mm ? `${Math.round(v.dist * 100)} % · ENGINE` : `+${Math.round(db)} DB${punish ? ' · PUNISHED' : ''}`}</em>
      </span>
    </div>
  );
};

/** MOVE reduit : ENV -> DRIVE ; le LFO : RATE, SYNC, DEPTH, TARGET (SHAPE et ENV SPEED caches). */
const MoveCells: React.FC = () => {
  useExtraAll();
  const sync = X('xDLfoSync') >= 0.5;
  return (
    <>
      <PcbKnob id="xDEnvAmt" name="ENV → DRIVE" ref_="" lo="" hi="" fine />
      <span className="mm-dm-vsep" />
      <PcbKnob id="xDLfoRate" name={sync ? 'LFO (NOTE)' : 'LFO RATE'} ref_="" lo="" hi="" fine />
      <PcbToggle id="xDLfoSync" name="SYNC" ref_="" w={72} />
      <PcbKnob id="xDLfoAmt" name="DEPTH" ref_="" lo="" hi="" fine />
      <PcbRotary id="xDLfoTarget" name="TARGET" ref_="" w={118} />
    </>
  );
};

/** Au montage : le preset de &distoDemo= et le point de &distoSel= (les captures). */
function useDemo(): void {
  useEffect(() => {
    if (typeof location === 'undefined') return;
    const m = /[?&]distoDemo=([^&]+)/.exec(location.search);
    if (m) {
      const name = decodeURIComponent(m[1]).replace(/\+/g, ' ');
      const p = DISTO_PRESETS.find((x) => x.name === name);
      if (p) distoLoad(p);
    }
    const sel = /[?&]distoSel=(LC|TONE|HC|PRE|POST|CLEAN)\b/.exec(location.search);
    if (sel) selStore.set(sel[1] as NodeId | 'CLEAN');
  }, []);
}

/* ---------------- la page ---------------- */

export const DistoPage: React.FC<{ flash: (title: string) => boolean }> = ({ flash }) => {
  useDemo();
  useExtraAll();
  const v = useVoy();
  const DR = { x: 44, w: 270 };
  const ST = { x: DR.x + DR.w + 22, w: 320 };
  const OU = { x: ST.x + ST.w + 22, w: 156 };
  const RX = 856;
  const RW = 200;
  const EQ = { x: 44, w: 790 };
  return (
    <>
      <PcbFrame title="DRIVE" x={DR.x} y={60} w={DR.w} h={196} led={v.dist > 0} flash={flash('DRIVE')} sep className="mm-hell-frame">
        <DriveHero k={1.75} left={0} top={14} />
        <div className="mm-d2-place mm-d2-punplace" style={{ left: 144, top: 18 }}>
          <Punish />
        </div>
        <div className="mm-dm-place" style={{ left: 12, top: 140 }}>
          <TransferGlass w={DR.w - 24} h={48} />
        </div>
      </PcbFrame>
      <PcbFrame title="STYLE" x={ST.x} y={60} w={ST.w} h={196} sep className="mm-hell-frame">
        <FamilyRows />
      </PcbFrame>
      <PcbFrame title="OUTPUT" x={OU.x} y={60} w={OU.w} h={196} sep className="mm-hell-frame">
        <Row top={16} w={OU.w}>
          <PcbKnob id="xDMix" name="MIX" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDOut" name="OUTPUT" ref_="" lo="-18" hi="+18" />
        </Row>
        <Row top={104} w={OU.w}>
          <PcbToggle id="xDAuto" name="AUTO" ref_="" />
        </Row>
      </PcbFrame>
      <PcbFrame title="ATTITUDE" x={RX} y={60} w={RW} h={158} className="mm-hell-frame">
        <div className="mm-dm-place" style={{ left: (RW - 172) / 2, top: 24 }}>
          <AttitudeVu />
        </div>
      </PcbFrame>
      <PcbFrame title="PRESETS" x={RX} y={232} w={RW} h={404} className="mm-hell-frame">
        <PresetList h={384} />
      </PcbFrame>
      <PcbFrame title="EQ" x={EQ.x} y={272} w={EQ.w} h={248} sep className="mm-hell-frame">
        <div className="mm-dm-place" style={{ left: 12, top: 20 }}>
          <DistoEq w={EQ.w - 24} h={136} />
        </div>
        <div className="mm-d2-place" style={{ left: 12, top: 160 }}>
          <EqControls w={EQ.w - 24} />
        </div>
      </PcbFrame>
      <PcbFrame title="MOVE" x={EQ.x} y={536} w={EQ.w} h={100} sep className="mm-hell-frame">
        <Row top={12} w={EQ.w}>
          <MoveCells />
        </Row>
      </PcbFrame>
    </>
  );
};
