/**
 * La page REVERB (v46, 2026-11-20 ; Mika a choisi l'option A des maquettes v44 : "La partie Reverb.. serieux ? C'est
 * vraiment tres leger.. On doit peut-etre avoir un complement graphique la-dessus.. Un EQ encore ? [...] quelque chose
 * qui claque !").
 *
 * - En haut : les douze machines (TYPE) et la CASCADE de la queue : un waterfall 3D, la frequence en largeur, le temps en
 *   profondeur, le niveau en hauteur, avec le vrai Tr60 par bande (les graves, les mediums et les aigus s'eteignent
 *   chacun a leur duree, Sky.cpp skyEngine / tankDecay), la couleur de la machine (LOW END, TONE) et l'EQ de la reverbe ;
 *   FREEZE y tient la queue. CLASSIC (la convolution d'avant) a la sienne (SIZE, TONE : la coupure qui descend).
 * - Au milieu : la machine (DECAY en grand, PRE-DELAY, TONE, MOD, LOW END) et ses reglages propres, INIT, CLASSIC.
 * - En bas : l'EQ de la reverbe, sur le mouille seul (trois points sur le graphe : L le coupe-bas, M la cloche, H le
 *   coupe-haut ; glisser un point, Maj + glisser ou la molette sur M : son Q), et la sortie : MIX (le potard REVERB de la
 *   face), WIDTH, DUCK, FREEZE.
 *
 * Les reglages sont les vrais (extra-params.json : xSky* ; v46 : xSkyLoCut ... xSkyFreeze en fin de liste, neutres par
 * defaut ; leur DSP : plugin/mm-arp/dsp/ArpFx.h, 5. et Sky.h setFreeze).
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { voyParams } from '../../voyager/params';
import { arpExtra } from './extra';
import { hoodLcd, PcbFrame, PcbKey, PcbKnob, PcbStep, say, SRC } from './pcbui';
import { cellOf, CellView, frameW, tail, type Cell } from './SkyPage';
import { skyInit, skySelect } from './sky';
import { decayOf, preOf, SKY_FACE, SKY_MACHINES, SKY_SLOTS, skyMachineOf, skyText, skyTypeIndex, toneHzOf, type SkyMachineDef } from './skyModel';
import { skyPostLaws as PL } from './skyPost';
import './fx2.css';
import './fxPages.css';

const X = (id: string): number => arpExtra.of(id);
const useAll = (): void => {
  useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
  useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
};

/* ---------------- les reponses en frequence (dB) ---------------- */

const mag = (nr: number, ni: number, dr: number, di: number): number => 10 * Math.log10((nr * nr + ni * ni) / (dr * dr + di * di));
const hp2 = (f: number, fc: number, q = 0.7071): number => {
  const r = f / fc;
  return mag(-r * r, 0, 1 - r * r, r / q);
};
const lp2 = (f: number, fc: number, q = 0.7071): number => {
  const r = f / fc;
  return mag(1, 0, 1 - r * r, r / q);
};
const bell = (f: number, fc: number, db: number, q: number): number => {
  const r = f / fc;
  const A = Math.pow(10, db / 40);
  return mag(1 - r * r, (r * A) / q, 1 - r * r, r / (A * q));
};
// les Butterworth du DSP (ParamEq) : 12 dB, une section Q 0.707 ; 24 dB, deux sections Q 0.541 et 1.307
const BW4 = [0.5411961, 1.3065630];
const hpN = (f: number, fc: number, slope: number): number => (slope ? hp2(f, fc, BW4[0]) + hp2(f, fc, BW4[1]) : hp2(f, fc));
const lpN = (f: number, fc: number, slope: number): number => (slope ? lp2(f, fc, BW4[0]) + lp2(f, fc, BW4[1]) : lp2(f, fc));

/** La couleur que la machine donne deja (LOW END : le coupe-bas d'entree ; TONE : le passe-bas de sortie). */
function machineDb(f: number, m: SkyMachineDef | null): number {
  if (!m) return 0;
  const low = 320 * Math.pow(18 / 320, X('xSkyLow'));
  const tone = toneHzOf(X('xSkyTone'));
  return hp2(f, low) + (tone >= 21000 ? 0 : lp2(f, tone));
}
/** L'EQ de la reverbe (les vrais reglages, les lois du DSP). */
function eqDb(f: number): number {
  let db = 0;
  const lo = X('xSkyLoCut');
  const hi = X('xSkyHiCut');
  const mdb = X('xSkyMidDb');
  if (PL.loOn(lo)) db += hpN(f, PL.loHz(lo), Math.round(X('xSkyLoSlope')));
  if (PL.hiOn(hi)) db += lpN(f, PL.hiHz(hi), Math.round(X('xSkyHiSlope')));
  if (PL.midOn(mdb)) db += bell(f, PL.midHz(X('xSkyMidHz')), PL.midDb(mdb), PL.midQ(X('xSkyMidQ')));
  return db;
}

/* ---------------- la duree des graves, des mediums, des aigus (Sky.cpp skyEngine, tankDecay) ---------------- */

function t60Mul(m: SkyMachineDef, f: number): number {
  const tone = X('xSkyTone');
  const low = X('xSkyLow');
  const hiMul = (m.id === 'plate' ? 0.35 : 0.22) + (m.id === 'plate' ? 0.75 : 0.78) * Math.pow(tone, 0.8);
  const hiF = 2500 + 6000 * tone;
  const lowMul = 0.55 + 0.8 * low;
  const midMul = m.id === 'hall' ? 0.55 + 0.9 * X('xSkyP1') : 1;
  const wl = 1 / (1 + Math.pow(f / 260, 2));
  const wh = 1 / (1 + Math.pow(hiF / f, 2));
  return Math.max(0.05, lowMul * wl + hiMul * wh + midMul * Math.max(0, 1 - wl - wh));
}

/** CLASSIC : la convolution d'avant (sa duree : SIZE ; sa coupure descend de 9 kHz a 3 kHz x TONE pendant la queue). */
const classicT = (): number => 2.4 * Math.pow(4, 2 * X('xRevSize') - 1);
const classicPre = (): number => X('xRevPre') / 10;
const classicHi = (): [number, number] => {
  const k = Math.pow(4, 2 * X('xRevTone') - 1);
  return [Math.min(18000, 9000 * k), Math.min(18000, 3000 * k)];
};

const fmtS = (s: number): string => (s < 1 ? `${Math.round(s * 1000)} MS` : `${s.toFixed(s < 10 ? 2 : 1)} S`);
const canFreeze = (type: number): boolean => type !== 0 && type !== 4;

/* ---------------- la cascade (waterfall) ---------------- */

const Waterfall: React.FC<{ w: number; h: number; type: number }> = ({ w, h, type }) => {
  useAll();
  const m = skyMachineOf(type);
  const frozen = canFreeze(type) && X('xSkyFreeze') >= 0.5;
  const pre = !m ? classicPre() : m.preLabel === 'FEEDBACK' ? 0 : preOf(X('xSkyPre'));
  const Tm = !m ? classicT() : m.id === 'reflections' ? 0.06 + 0.3 * X('xSkyDecay') : decayOf(m.id, X('xSkyDecay'));
  const at = m ? tail(m).at : null;
  const N = 26;
  const F = 72;
  // la duree montree : jusqu'a ce que les graves aussi tombent sous -60 dB
  const dur = Math.min(60, pre + Tm * (m ? Math.max(1, t60Mul(m, 60)) : 1) * 1.02);
  // la boite : la face avant (t = 0) en bas a gauche, le temps part en profondeur vers le haut a droite
  const fx0 = 170;
  const fw = w - fx0 - 132;
  const base = h - 40;
  const H = 96;
  const dx = 84 / (N - 1);
  const dy = 104 / (N - 1);
  const fOf = (j: number): number => 20 * Math.pow(1000, j / (F - 1));
  // la forme propre a la machine (SWELL qui monte, BLOOM, NONLINEAR...) : son enveloppe rapportee a une queue simple
  const plain = (t: number): number => (t < pre ? 0 : Math.max(0, 1 - (t - pre) / Tm) ** 1.7);
  const shapeDb = (t: number): number => {
    if (!at) return 0;
    const p0 = plain(t);
    const r = p0 > 1e-3 ? at(t) / p0 : at(t) > 1e-3 ? 1 : 0;
    return 20 * Math.log10(Math.max(1e-3, Math.min(1.2, r)));
  };
  // FREEZE : la queue descend un instant puis se tient
  const hold = frozen ? 0.18 * Tm : Infinity;
  const [hi0, hi1] = classicHi();
  const slices: { pts: string; area: string; k: number }[] = [];
  for (let i = N - 1; i >= 0; i -= 1) {
    const t = (i / (N - 1)) * dur * 0.96;
    const ox = fx0 + i * dx;
    const oy = base - i * dy;
    const sh = frozen ? shapeDb(Math.min(t, pre + hold)) : shapeDb(t);
    const pts: string[] = [];
    for (let j = 0; j < F; j += 1) {
      const f = fOf(j);
      const el = Math.min(Math.max(0, t - pre), hold);
      let db: number;
      if (t < pre) db = -60;
      else if (!m) db = eqDb(f) + lp2(f, hi0 * Math.pow(hi1 / hi0, Math.min(1, el / Tm))) - (60 * el) / Tm;
      // le vrai Tr60 par bande : -60 dB en T60 x (graves, mediums, aigus)
      else db = machineDb(f, m) + eqDb(f) + sh - (60 * el) / (Tm * t60Mul(m, f));
      const y = oy - Math.max(0, Math.min(1, (db + 60) / 66)) * H;
      pts.push(`${(ox + (j / (F - 1)) * fw).toFixed(1)},${y.toFixed(1)}`);
    }
    slices.push({ pts: pts.join(' '), area: `${ox.toFixed(1)},${oy} ${pts.join(' ')} ${(ox + fw).toFixed(1)},${oy}`, k: i });
  }
  const line = useSyncExternalStore(hoodLcd.subscribe, hoodLcd.get, hoodLcd.get);
  const touched = line && line.name.startsWith('REVERB') ? line : null;
  // le Tr60 de trois bandes, lu sur le modele
  const bands = m ? [125, 1000, 8000].map((f) => Tm * t60Mul(m, f)) : [Tm, Tm, Tm * 0.7];
  const chips = [
    PL.loOn(X('xSkyLoCut')) || PL.hiOn(X('xSkyHiCut')) || PL.midOn(X('xSkyMidDb')) ? 'EQ' : '',
    Math.abs(X('xSkyWidth') - 0.5) > 0.0005 ? `WIDTH ${SRC.text('xSkyWidth')}` : '',
    X('xSkyDuck') > 0.0005 ? `DUCK ${SRC.text('xSkyDuck')}` : '',
  ].filter(Boolean);
  return (
    <div className="mm-dm-glass mm-fx2-wf" data-frozen={frozen ? '1' : undefined} style={{ width: w, height: h }} role="img" aria-label="The reverb tail: frequency, time and level">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <linearGradient id="mm-fxp-wfglow" x1="0" y1="1" x2="0" y2="0">
            <stop offset="0" style={{ stopColor: 'var(--mm-accent)' }} stopOpacity="0.18" />
            <stop offset="1" style={{ stopColor: 'var(--mm-accent)' }} stopOpacity="0" />
          </linearGradient>
        </defs>
        {/* le sol de la boite */}
        <polygon className="floor" points={`${fx0},${base} ${fx0 + fw},${base} ${fx0 + fw + (N - 1) * dx},${base - (N - 1) * dy} ${fx0 + (N - 1) * dx},${base - (N - 1) * dy}`} />
        <rect x={fx0} y={base - H - 6} width={fw} height={H + 6} fill="url(#mm-fxp-wfglow)" />
        {[100, 1000, 10000].map((f) => {
          const x = fx0 + (Math.log10(f / 20) / 3) * fw;
          return (
            <g key={f}>
              <path className="g" d={`M${x.toFixed(1)} ${base}L${(x + (N - 1) * dx).toFixed(1)} ${base - (N - 1) * dy}`} />
              <text x={x} y={base + 12} textAnchor="middle" className="ax">
                {f >= 1000 ? `${f / 1000}K` : f}
              </text>
            </g>
          );
        })}
        {[0.25, 0.5, 0.75].map((q) => {
          const i = q * (N - 1);
          return <path key={q} className="g" d={`M${(fx0 + i * dx).toFixed(1)} ${(base - i * dy).toFixed(1)}H${(fx0 + fw + i * dx).toFixed(1)}`} />;
        })}
        {slices.map((s) => {
          const front = s.k === 0;
          const op = 0.22 + 0.78 * (1 - s.k / (N - 1));
          return (
            <g key={s.k}>
              <polygon className="mask" points={s.area} />
              <polygon className="fill" points={s.area} style={{ opacity: op * 0.55 }} />
              <polyline className={front ? 'line front' : 'line'} points={s.pts} style={{ opacity: op }} />
            </g>
          );
        })}
        {/* l'axe du temps, en profondeur */}
        <path className="tax" d={`M${fx0 + fw + 8} ${base}L${fx0 + fw + 8 + (N - 1) * dx} ${base - (N - 1) * dy}`} />
        <text x={fx0 + fw + 14} y={base + 3} className="ax">
          0
        </text>
        <text x={fx0 + fw + 14 + (N - 1) * dx * 0.5} y={base - (N - 1) * dy * 0.5 + 3} className="ax">
          {frozen ? 'FREEZE' : fmtS(dur * 0.48)}
        </text>
        <text x={fx0 + fw + 14 + (N - 1) * dx} y={base - (N - 1) * dy + 3} className="ax">
          {frozen ? '∞' : fmtS(dur * 0.96)}
        </text>
        {/* la machine, en grand */}
        <text x={16} y={22} className="kind">
          {m ? `TYPE ${String(type).padStart(2, '0')} / 12` : 'TYPE CLASSIC'}
        </text>
        <text x={14} y={56} className="name">
          {m ? m.name : 'CLASSIC'}
        </text>
        <text x={16} y={80} className="k">
          {touched ? touched.name.replace(/^REVERB /, '') : m ? m.decayLabel : 'SIZE'}
        </text>
        <text x={16} y={102} className="v">
          {touched ? touched.value.toUpperCase() : m?.id === 'reflections' ? skyText(type, 'xSkyDecay', X('xSkyDecay')) : fmtS(Tm)}
        </text>
        <text x={16} y={124} className="k">
          {touched ? '' : m ? `${m.preLabel === 'FEEDBACK' ? 'FEEDBACK' : 'PRE'} ${skyText(type, 'xSkyPre', X('xSkyPre'))}` : `PRE ${Math.round(classicPre() * 1000)} MS`}
        </text>
        {/* le Tr60 par bande */}
        <g className="mm-fxp-t60">
          {(['LOW', 'MID', 'HIGH'] as const).map((b, i) => (
            <g key={b}>
              <text x={16} y={146 + i * 11} className="b">
                {b}
              </text>
              <text x={44} y={146 + i * 11} className="bv">
                {fmtS(bands[i])}
              </text>
              <rect x={86} y={140 + i * 11} width={Math.max(2, Math.min(64, (64 * bands[i]) / Math.max(...bands)))} height={4} rx={1} />
            </g>
          ))}
        </g>
        <text x={16} y={h - 10} className="k">
          FREQUENCY · TIME · LEVEL
        </text>
        {chips.length > 0 && (
          <text x={fx0 + 2} y={h - 10} className="mm-fxp-chips">
            {chips.join(' · ')}
          </text>
        )}
        {frozen && (
          <text x={w - 16} y={22} textAnchor="end" className="mm-fxp-frz">
            FREEZE · THE TAIL HOLDS
          </text>
        )}
      </svg>
    </div>
  );
};

/* ---------------- l'EQ de la reverbe : trois points (LOW CUT, MID, HIGH CUT) ---------------- */

type Node = 'L' | 'M' | 'H';

const SkyEq: React.FC<{ w: number; h: number; type: number }> = ({ w, h, type }) => {
  useAll();
  const m = skyMachineOf(type);
  const fx = (f: number): number => 14 + (Math.log10(f / 20) / 3) * (w - 28);
  const fOfX = (x: number): number => 20 * Math.pow(1000, Math.min(1, Math.max(0, (x - 14) / (w - 28))));
  const fy = (db: number): number => h / 2 + 4 - (db / 18) * (h / 2 - 14);
  const pts: string[] = [];
  const ghost: string[] = [];
  for (let i = 0; i <= 200; i += 1) {
    const f = 20 * Math.pow(1000, i / 200);
    pts.push(`${fx(f).toFixed(1)},${fy(Math.max(-18, Math.min(18, eqDb(f) + machineDb(f, m)))).toFixed(1)}`);
    ghost.push(`${fx(f).toFixed(1)},${fy(Math.max(-18, Math.min(18, machineDb(f, m)))).toFixed(1)}`);
  }
  const lo = X('xSkyLoCut');
  const hi = X('xSkyHiCut');
  const mdb = X('xSkyMidDb');
  const nodes: { n: Node; f: number; g: number; on: boolean }[] = [
    { n: 'L', f: PL.loOn(lo) ? PL.loHz(lo) : 20, g: 0, on: PL.loOn(lo) },
    { n: 'M', f: PL.midHz(X('xSkyMidHz')), g: PL.midDb(mdb), on: PL.midOn(mdb) },
    { n: 'H', f: PL.hiOn(hi) ? PL.hiHz(hi) : 20000, g: 0, on: PL.hiOn(hi) },
  ];
  const svg = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<Node>('M');
  const [qShow, setQShow] = useState(false);
  const qTimer = useRef(0);
  useEffect(() => () => window.clearTimeout(qTimer.current), []);
  const drag = useRef<{ n: Node; y: number; q: number; g: number; mode: 'fg' | 'q' } | null>(null);
  const local = (e: { clientX: number; clientY: number }): { x: number; y: number } => {
    const r = svg.current?.getBoundingClientRect();
    if (!r) return { x: 0, y: 0 };
    const k = r.width / w || 1;
    return { x: (e.clientX - r.left) / k, y: (e.clientY - r.top) / k };
  };
  const scale = (): number => (svg.current ? svg.current.getBoundingClientRect().width / w || 1 : 1);
  const set = (id: string, v: number): void => {
    SRC.set(id, v);
    say(id);
  };
  const anchor = (d: NonNullable<typeof drag.current>, e: { clientY: number }, mode: 'fg' | 'q'): void => {
    d.mode = mode;
    d.y = e.clientY;
    d.q = X('xSkyMidQ');
    d.g = X('xSkyMidDb');
  };
  const onNode = (n: Node) => (e: React.PointerEvent<SVGGElement>): void => {
    e.preventDefault();
    e.stopPropagation();
    setSel(n);
    // Alt (ou Cmd) + clic : le point a son neutre (comme les potards)
    if (e.altKey || e.metaKey) {
      if (n === 'L') set('xSkyLoCut', 0);
      else if (n === 'H') set('xSkyHiCut', 1);
      else set('xSkyMidDb', 0.5);
      return;
    }
    const d = { n, y: 0, q: 0, g: 0, mode: 'fg' as 'fg' | 'q' };
    anchor(d, e, n === 'M' && e.shiftKey ? 'q' : 'fg');
    drag.current = d;
    if (d.mode === 'q') {
      window.clearTimeout(qTimer.current);
      setQShow(true);
      say('xSkyMidQ');
    }
    try {
      (e.currentTarget as Element).setPointerCapture(e.pointerId);
    } catch {
      /* rien */
    }
  };
  const onMove = (e: React.PointerEvent<SVGGElement>): void => {
    const d = drag.current;
    if (!d) return;
    if (d.n === 'M' && e.shiftKey !== (d.mode === 'q')) anchor(d, e, e.shiftKey ? 'q' : 'fg');
    if (d.mode === 'q') {
      // 160 px pour toute la course ; vers le haut : plus de Q (plus etroit)
      set('xSkyMidQ', d.q - (e.clientY - d.y) / scale() / 160);
      window.clearTimeout(qTimer.current);
      setQShow(true);
      return;
    }
    const p = local(e);
    const f = fOfX(p.x);
    if (d.n === 'L') set('xSkyLoCut', f <= 20.5 ? 0 : Math.max(0.001, PL.loV(f)));
    else if (d.n === 'H') set('xSkyHiCut', f >= 19500 ? 1 : Math.min(0.999, PL.hiV(f)));
    else {
      SRC.set('xSkyMidHz', PL.midV(f));
      const db = ((h / 2 + 4 - p.y) / (h / 2 - 14)) * 18;
      set('xSkyMidDb', 0.5 + Math.max(-12, Math.min(12, db)) / 24);
    }
  };
  const onUp = (): void => {
    const d = drag.current;
    drag.current = null;
    if (d?.mode === 'q') qTimer.current = window.setTimeout(() => setQShow(false), 900);
  };
  // la molette sur M (avec ou sans Maj) : son Q ; Maj + molette donne deltaX sur macOS
  useEffect(() => {
    const el = svg.current;
    if (!el) return undefined;
    let acc = 0;
    const onWheel = (e: WheelEvent): void => {
      const node = (e.target as Element | null)?.closest?.('[data-n="M"]');
      if (!node) return;
      e.preventDefault();
      acc += e.deltaY || e.deltaX;
      const t = Math.trunc(acc / 40);
      if (t === 0) return;
      acc -= t * 40;
      setSel('M');
      SRC.set('xSkyMidQ', X('xSkyMidQ') - t * 0.02);
      say('xSkyMidQ');
      window.clearTimeout(qTimer.current);
      setQShow(true);
      qTimer.current = window.setTimeout(() => setQShow(false), 900);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, []);
  // le Q montre : la cloche seule, sa largeur, une bulle
  const mq = PL.midQ(X('xSkyMidQ'));
  const mf = nodes[1].f;
  const qOverlay = (() => {
    if (!qShow) return null;
    const own: string[] = [];
    const g = PL.midOn(mdb) ? PL.midDb(mdb) : 6;
    for (let i = 0; i <= 160; i += 1) {
      const f = 20 * Math.pow(1000, i / 160);
      own.push(`${fx(f).toFixed(1)},${fy(Math.max(-18, Math.min(18, bell(f, mf, g, mq)))).toFixed(1)}`);
    }
    const bw = (2 * Math.asinh(1 / (2 * mq))) / Math.LN2;
    const x = fx(mf);
    const y = fy(nodes[1].g);
    const x1 = Math.max(14, fx(mf / Math.pow(2, bw / 2)));
    const x2 = Math.min(w - 14, fx(mf * Math.pow(2, bw / 2)));
    const by = y > h - 40 ? y - 18 : y + 16;
    const bx = Math.max(40, Math.min(w - 40, x));
    const top = y < 40 ? y + 12 : y - 38;
    return (
      <g className="eq-q" pointerEvents="none">
        <polyline className="eq-q-own" points={own.join(' ')} />
        <path className="eq-q-bw" d={`M${x1.toFixed(1)} ${by - 4}v8M${x1.toFixed(1)} ${by}H${x2.toFixed(1)}M${x2.toFixed(1)} ${by - 4}v8`} />
        <rect className="eq-q-tip" x={bx - 34} y={top} width={68} height={26} rx={3} />
        <text className="eq-q-val" x={bx} y={top + 12} textAnchor="middle">
          {`Q ${mq.toFixed(2)}`}
        </text>
        <text className="eq-q-sub" x={bx} y={top + 21} textAnchor="middle">
          {`${bw.toFixed(2)} OCT`}
        </text>
      </g>
    );
  })();
  return (
    <div className="mm-dm-glass mm-eq-screen mm-fx2-skyeq" style={{ width: w, height: h, position: 'relative' }}>
      <svg ref={svg} width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {[50, 100, 200, 500, 1000, 2000, 5000, 10000].map((f) => (
          <g key={f}>
            <path className="grid" d={`M${fx(f).toFixed(1)} 20V${h - 14}`} />
            <text x={fx(f)} y={h - 4} textAnchor="middle">
              {f >= 1000 ? `${f / 1000}K` : f}
            </text>
          </g>
        ))}
        {[-12, -6, 0, 6, 12].map((d) => (
          <g key={d}>
            <path className={d === 0 ? 'grid zero' : 'grid'} d={`M14 ${fy(d).toFixed(1)}H${w - 14}`} />
            {d !== 0 && (
              <text x={w - 4} y={fy(d) + 3} textAnchor="end">
                {d > 0 ? `+${d}` : d}
              </text>
            )}
          </g>
        ))}
        {m && <polyline className="ghost" points={ghost.join(' ')} />}
        <polyline className="eq-fill" points={`14,${fy(0)} ${pts.join(' ')} ${w - 14},${fy(0)}`} />
        <polyline className="main" points={pts.join(' ')} />
        {qOverlay}
        {nodes.map((b) => (
          <g
            key={b.n}
            className="eq-node"
            data-n={b.n}
            data-on={b.on ? '1' : undefined}
            data-sel={b.n === sel ? '1' : undefined}
            onPointerDown={onNode(b.n)}
            onPointerMove={onMove}
            onPointerUp={onUp}
            onPointerCancel={onUp}
            style={{ cursor: 'grab' }}
            aria-label={b.n === 'L' ? 'Reverb low cut' : b.n === 'H' ? 'Reverb high cut' : 'Reverb mid band'}
          >
            <circle cx={fx(b.f)} cy={fy(b.g)} r={b.n === sel ? 8.5 : 7.5} />
            <text x={fx(b.f)} y={fy(b.g) + 3.2} textAnchor="middle">
              {b.n}
            </text>
          </g>
        ))}
        <text x="16" y="13">
          REVERB EQ · WET ONLY
        </text>
        {m && (
          <text x={w * 0.42} y="13" textAnchor="middle" className="dim">
            DASHED: TONE + LOW END
          </text>
        )}
        <text x={w - 16} y="13" textAnchor="end" className="hot">
          {`LOW CUT ${SRC.text('xSkyLoCut')} · MID ${SRC.text('xSkyMidDb')} · HIGH CUT ${SRC.text('xSkyHiCut')}`}
        </text>
      </svg>
    </div>
  );
};

/* ---------------- les touches TYPE, la machine ---------------- */

/** INIT (les reglages de depart de la machine), CLASSIC (la reverbe d'avant). */
const MachineKeys: React.FC<{ type: number }> = ({ type }) => {
  const m = skyMachineOf(type);
  return (
    <span className="mm-fx2-skymk mm-fx2-skymk-col">
      <PcbKey name="INIT" w={40} h={16} disabled={!m} title="Back to this machine's starting settings" onClick={() => skyInit()} />
      <PcbKey name="CLASSIC" w={40} h={16} on={!m} title="The reverb of the site (before the twelve machines)" onClick={() => skySelect(0)} />
    </span>
  );
};

const TypeKeys: React.FC<{ type: number }> = ({ type }) => {
  const m = skyMachineOf(type);
  return (
    <div className="mm-fx2-skykeys" style={{ gridTemplateColumns: 'repeat(4, 1fr)' }} role="radiogroup" aria-label="Reverb type">
      {SKY_MACHINES.map((mm, i) => (
        <PcbKey key={mm.id} name={mm.name} w={52} h={16} on={type === i + 1} role="radio" aria-checked={type === i + 1} title={mm.blurb} onClick={() => skySelect(i + 1)} />
      ))}
      <span className="mm-fx2-skyblurb" style={{ gridColumn: '1 / 5' }}>
        {m ? m.blurb : 'CLASSIC: the convolution reverb of the MM-ARP before the twelve machines.'}
      </span>
    </div>
  );
};

const Row: React.FC<{ top: number; left?: number; w: number; children: React.ReactNode }> = ({ top, left, w, children }) => (
  <div className="mm-p2-cells mm-hell-row" style={{ top, left: left ?? undefined, width: w }}>
    {children}
  </div>
);

const FR = 118;
const CLASSIC_CELLS: Cell[] = [
  { k: 'knob', id: 'xRevSize', name: 'SIZE', lo: '0.6 S', hi: '9.6 S', w: 80 },
  { k: 'knob', id: 'xRevTone', name: 'TONE', lo: 'DARK', hi: 'BRIGHT', w: 80 },
  { k: 'knob', id: 'xRevPre', name: 'PRE DELAY', lo: '0', hi: '100 MS', w: 80 },
  { k: 'knob', id: 'xShimmer', name: 'SHIMMER', lo: 'OFF', hi: 'FULL', w: 80 },
];

/** Les cinq reglages de la machine (DECAY en grand) ; CLASSIC : ceux de la reverbe d'avant. */
const faceCells = (type: number): Cell[] => (skyMachineOf(type) ? SKY_FACE.map((id) => cellOf(type, id)) : CLASSIC_CELLS);
const ownCells = (type: number): Cell[] => {
  const m = skyMachineOf(type);
  return m ? m.slots.map((s, i) => cellOf(type, SKY_SLOTS[i], s.options?.length)) : [];
};
const faceW = (type: number): number => frameW(faceCells(type)) + (skyMachineOf(type) ? 12 : 0);
const ownW = (type: number): number => Math.max(150, frameW(ownCells(type)) + 70);

const FaceFrame: React.FC<{ x: number; y: number; type: number }> = ({ x, y, type }) => {
  const m = skyMachineOf(type);
  const cells = faceCells(type);
  const w = faceW(type);
  return (
    <PcbFrame title={m ? `${m.name} · THE TAIL` : 'CLASSIC · THE CONVOLUTION'} x={x} y={y} w={w} h={FR} sep className="mm-hell-frame">
      <Row top={22} w={w}>
        {m ? (
          <>
            <PcbKnob id="xSkyDecay" name={m.decayLabel} ref_="" lo={skyText(type, 'xSkyDecay', 0).replace(/\.0+ S$/, ' S')} hi={skyText(type, 'xSkyDecay', 1).replace(/\.\d+ S$/, ' S')} big />
            {cells.slice(1).map((c, i) => (
              <CellView key={`${type}-${c.id}`} c={c} refN={61 + i} />
            ))}
          </>
        ) : (
          cells.map((c, i) => <CellView key={`c-${c.id}`} c={c} refN={61 + i} />)
        )}
      </Row>
    </PcbFrame>
  );
};

const OwnFrame: React.FC<{ x: number; y: number; type: number }> = ({ x, y, type }) => {
  const m = skyMachineOf(type);
  const w = ownW(type);
  return (
    <PcbFrame title={m ? `${m.name} +` : 'MACHINE'} x={x} y={y} w={w} h={FR} className="mm-hell-frame">
      <Row top={22} w={w}>
        {ownCells(type).map((c, i) => (
          <CellView key={`${type}-${c.id}`} c={c} refN={70 + i} />
        ))}
        <MachineKeys type={type} />
      </Row>
    </PcbFrame>
  );
};

/* ---------------- la page ---------------- */

const Z = { x: 44, w: 1012 };
const G = 22;

export const SkyPageA: React.FC<{ flash: (title: string) => boolean }> = ({ flash }) => {
  useAll();
  const type = skyTypeIndex(X('xSkyType'));
  const TW = 360;
  const WX = Z.x + TW + G;
  const fw = faceW(type);
  const ow = ownW(type);
  const tot = fw + G + ow;
  const rx = Z.x + Math.round((Z.w - tot) / 2);
  const EQW = 640;
  const OW = Z.w - EQW - G;
  return (
    <>
      <PcbFrame title="TYPE" x={Z.x} y={60} w={TW} h={206} flash={flash('TYPE')} className="mm-hell-frame">
        <TypeKeys type={type} />
      </PcbFrame>
      <div className="mm-dm-place" style={{ left: WX, top: 66 }}>
        <Waterfall w={Z.x + Z.w - WX} h={200} type={type} />
      </div>
      <FaceFrame x={rx} y={282} type={type} />
      <OwnFrame x={rx + fw + G} y={282} type={type} />
      <PcbFrame title="REVERB EQ" x={Z.x} y={414} w={EQW} h={226} sep className="mm-hell-frame" led={PL.loOn(X('xSkyLoCut')) || PL.hiOn(X('xSkyHiCut')) || PL.midOn(X('xSkyMidDb'))}>
        <div className="mm-dm-place" style={{ left: 12, top: 20 }}>
          <SkyEq w={EQW - 24} h={104} type={type} />
        </div>
        <Row top={132} w={EQW}>
          <PcbKnob id="xSkyLoCut" name="LOW CUT" ref_="" lo="" hi="" fine />
          <PcbStep id="xSkyLoSlope" name="SLOPE" ref_="" w={70} />
          <PcbKnob id="xSkyMidHz" name="MID" ref_="" lo="" hi="" fine />
          <PcbKnob id="xSkyMidDb" name="GAIN" ref_="" lo="" hi="" fine />
          <PcbKnob id="xSkyMidQ" name="Q" ref_="" lo="" hi="" fine />
          <PcbKnob id="xSkyHiCut" name="HIGH CUT" ref_="" lo="" hi="" fine />
          <PcbStep id="xSkyHiSlope" name="SLOPE" ref_="" w={70} />
        </Row>
      </PcbFrame>
      <PcbFrame title="OUTPUT" x={Z.x + EQW + G} y={414} w={OW} h={226} flash={flash('REVERB')} className="mm-hell-frame" led={voyParams.of('reverb') > 0}>
        <Row top={22} w={OW}>
          <PcbKnob id="reverb" name="MIX" ref_="" lo="DRY" hi="WET" big />
          <PcbKnob id="xSkyWidth" name="WIDTH" ref_="" lo="MONO" hi="150 %" />
        </Row>
        <Row top={132} w={OW}>
          <PcbKnob id="xSkyDuck" name="DUCK" ref_="" lo="" hi="" fine />
          <PcbStep id="xSkyFreeze" name="FREEZE" ref_="" w={84} />
        </Row>
      </PcbFrame>
    </>
  );
};
