/**
 * MAQUETTE v44 : la page REVERB refaite (Mika, 2026-11-20 : "La partie Reverb.. serieux ? C'est vraiment tres leger..
 * On doit peut-etre avoir un complement graphique la-dessus.. Un EQ encore ? Je sais pas, mais en tout cas quelque chose
 * qui claque !"). ?fx2=A ou ?fx2=B (fx2.ts).
 *
 * - A : la CASCADE de la queue (un waterfall 3D : la frequence en largeur, le temps en profondeur, le niveau en hauteur ;
 *   les aigus s'eteignent avant les graves selon TONE, LOW END, MID, la forme de la machine) a cote des douze machines ;
 *   dessous les reglages, l'EQ de la reverbe (trois points) et la sortie (MIX, WIDTH, DUCK, FREEZE).
 * - B : la SALLE vue de dessus (ses murs a la taille de la machine, la source, les premieres reflexions en rayons, les
 *   fronts d'onde qui s'eteignent au rythme de DECAY) au-dessus des machines ; a droite les reglages et un grand EQ.
 *
 * Les reglages existants (xSky*, reverb) sont les vrais ; l'EQ de la reverbe, WIDTH, DUCK et FREEZE n'existent pas
 * encore cote DSP : reglages de maquette (fx2.ts mockParam, aucun son), a ajouter en fin de liste si Mika valide.
 */

import React, { useSyncExternalStore } from 'react';
import { voyParams } from '../../voyager/params';
import { arpExtra } from './extra';
import { hzText, mockParam, mockStore, pct, stepIdx, stepText } from './fx2';
import { hoodLcd, PcbFrame, PcbKey, PcbKnob, PcbStep, SRC } from './pcbui';
import { cellOf, CellView, frameW, tail, type Cell } from './SkyPage';
import { skyInit, skySelect } from './sky';
import { decayOf, preOf, SKY_FACE, SKY_MACHINES, SKY_SLOTS, skyMachineOf, skyText, skyTypeIndex, stepOf, toneHzOf, type SkyMachineDef } from './skyModel';
import './fx2.css';

const X = (id: string): number => arpExtra.of(id);
const useAll = (): void => {
  useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
  useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  useSyncExternalStore(mockStore.subscribe, mockStore.get, mockStore.get);
};

/* ---------------- les reglages neufs (maquette, aucun son) ---------------- */

const SLOPES = ['12 DB', '24 DB'] as const;
const loHz = (v: number): number => 20 * Math.pow(100, v);
const hiHz = (v: number): number => 1000 * Math.pow(20, v);
const midHz = (v: number): number => 200 * Math.pow(40, v);
const midDb = (v: number): number => 24 * (v - 0.5);
const midQ = (v: number): number => 0.4 * Math.pow(10, v);
const widthPct = (v: number): number => (v <= 0.5 ? 200 * v : 100 + 100 * (v - 0.5));
const LO = mockParam('vSkyLoCut', 'REVERB LOW CUT', 0, (v) => (v <= 0.005 ? 'OFF' : hzText(loHz(v))));
const LOS = mockParam('vSkyLoSlope', 'REVERB LOW CUT SLOPE', 0, stepText(SLOPES), SLOPES);
const HI = mockParam('vSkyHiCut', 'REVERB HIGH CUT', 1, (v) => (v >= 0.995 ? 'OFF' : hzText(hiHz(v))));
const HIS = mockParam('vSkyHiSlope', 'REVERB HIGH CUT SLOPE', 0, stepText(SLOPES), SLOPES);
const MF = mockParam('vSkyMidHz', 'REVERB MID FREQ', 0.5, (v) => hzText(midHz(v)));
const MG = mockParam('vSkyMidDb', 'REVERB MID GAIN', 0.5, (v) => `${midDb(v) > 0 ? '+' : ''}${midDb(v).toFixed(1)} DB`);
const MQ = mockParam('vSkyMidQ', 'REVERB MID Q', 0.3, (v) => `Q ${midQ(v).toFixed(2)}`);
const WIDTH = mockParam('vSkyWidth', 'REVERB WIDTH', 0.5, (v) => (v <= 0 ? 'MONO' : `${Math.round(widthPct(v))} %`));
const DUCK = mockParam('vSkyDuck', 'REVERB DUCK', 0, pct);
const FREEZE = mockParam('vSkyFreeze', 'REVERB FREEZE', 0, stepText(['OFF', 'ON']), ['OFF', 'ON']);

/* ---------------- la reponse en frequence (dB) : LOW END et TONE de la machine, puis l'EQ ---------------- */

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

/** La couleur que la machine donne deja (LOW END : le coupe-bas d'entree ; TONE : le passe-bas de sortie). */
function machineDb(f: number): number {
  const low = 320 * Math.pow(18 / 320, X('xSkyLow'));
  const tone = toneHzOf(X('xSkyTone'));
  return hp2(f, low) + (tone >= 21000 ? 0 : lp2(f, tone));
}
/** L'EQ de la reverbe (maquette) : LOW CUT (12 / 24), MID (cloche), HIGH CUT (12 / 24). */
function eqDb(f: number): number {
  const v = (id: string): number => mockStore.of(id);
  let db = 0;
  if (v(LO) > 0.005) db += hp2(f, loHz(v(LO))) * (stepIdx(v(LOS), 2) + 1);
  if (v(HI) < 0.995) db += lp2(f, hiHz(v(HI))) * (stepIdx(v(HIS), 2) + 1);
  if (Math.abs(midDb(v(MG))) > 0.05) db += bell(f, midHz(v(MF)), midDb(v(MG)), midQ(v(MQ)));
  return db;
}

/* ---------------- la duree des graves, des mediums, des aigus (skyEngine, Sky.cpp) ---------------- */

function t60Mul(m: SkyMachineDef, f: number): number {
  const tone = X('xSkyTone');
  const low = X('xSkyLow');
  const hiMul = 0.22 + 0.78 * Math.pow(tone, 0.8);
  const hiF = 2500 + 6000 * tone;
  const lowMul = 0.55 + 0.8 * low;
  const midMul = m.id === 'hall' ? 0.55 + 0.9 * X('xSkyP1') : 1;
  const wl = 1 / (1 + Math.pow(f / 260, 2));
  const wh = 1 / (1 + Math.pow(hiF / f, 2));
  return Math.max(0.05, lowMul * wl + hiMul * wh + midMul * Math.max(0, 1 - wl - wh));
}

/* ---------------- A : la cascade (waterfall) ---------------- */

const Waterfall: React.FC<{ w: number; h: number; m: SkyMachineDef; type: number }> = ({ w, h, m, type }) => {
  useAll();
  const { at } = tail(m);
  const pre = m.preLabel === 'FEEDBACK' ? 0 : preOf(X('xSkyPre'));
  const N = 26;
  const Tm = m.id === 'reflections' ? 0.06 + 0.3 * X('xSkyDecay') : decayOf(m.id, X('xSkyDecay'));
  // la duree montree : jusqu'a ce que les graves aussi tombent sous -60 dB
  const dur = Math.min(60, pre + Tm * Math.max(1, t60Mul(m, 60)) * 1.02);
  const F = 72;
  // la boite : la face avant (t = 0) en bas a gauche, le temps part en profondeur vers le haut a droite
  const fx0 = 150;
  const fw = w - fx0 - 132;
  const base = h - 40;
  const H = 92;
  const dx = 84 / (N - 1);
  const dy = 104 / (N - 1);
  const fOf = (j: number): number => 20 * Math.pow(1000, j / (F - 1));
  // la forme propre a la machine (SWELL qui monte, BLOOM, NONLINEAR...) : son enveloppe rapportee a une queue simple
  const plain = (t: number): number => (t < pre ? 0 : Math.max(0, 1 - (t - pre) / Tm) ** 1.7);
  const shapeDb = (t: number): number => {
    const p0 = plain(t);
    const r = p0 > 1e-3 ? at(t) / p0 : at(t) > 1e-3 ? 1 : 0;
    return 20 * Math.log10(Math.max(1e-3, Math.min(1.2, r)));
  };
  const slices: { pts: string; area: string; k: number }[] = [];
  for (let i = N - 1; i >= 0; i -= 1) {
    const t = (i / (N - 1)) * dur * 0.96;
    const ox = fx0 + i * dx;
    const oy = base - i * dy;
    const sh = shapeDb(t);
    const pts: string[] = [];
    for (let j = 0; j < F; j += 1) {
      const f = fOf(j);
      // le vrai Tr60 par bande : -60 dB en T60 x (graves, mediums, aigus)
      const db = t < pre ? -60 : machineDb(f) + eqDb(f) + sh - (60 * (t - pre)) / (Tm * t60Mul(m, f));
      const y = oy - Math.max(0, Math.min(1, (db + 60) / 66)) * H;
      pts.push(`${(ox + (j / (F - 1)) * fw).toFixed(1)},${y.toFixed(1)}`);
    }
    slices.push({ pts: pts.join(' '), area: `${ox.toFixed(1)},${oy} ${pts.join(' ')} ${(ox + fw).toFixed(1)},${oy}`, k: i });
  }
  const T = m.id === 'reflections' ? 0.06 + 0.3 * X('xSkyDecay') : decayOf(m.id, X('xSkyDecay'));
  const fmt = (s: number): string => (s < 1 ? `${Math.round(s * 1000)} MS` : `${s.toFixed(s < 10 ? 2 : 1)} S`);
  const line = useSyncExternalStore(hoodLcd.subscribe, hoodLcd.get, hoodLcd.get);
  const touched = line && line.name.startsWith('REVERB') ? line : null;
  return (
    <div className="mm-dm-glass mm-fx2-wf" style={{ width: w, height: h }} role="img" aria-label="The reverb tail: frequency, time and level">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* le sol de la boite */}
        <polygon className="floor" points={`${fx0},${base} ${fx0 + fw},${base} ${fx0 + fw + (N - 1) * dx},${base - (N - 1) * dy} ${fx0 + (N - 1) * dx},${base - (N - 1) * dy}`} />
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
          {fmt(dur * 0.48)}
        </text>
        <text x={fx0 + fw + 14 + (N - 1) * dx} y={base - (N - 1) * dy + 3} className="ax">
          {fmt(dur * 0.96)}
        </text>
        {/* la machine, en grand */}
        <text x={16} y={22} className="kind">
          {`TYPE ${String(type).padStart(2, '0')} / 12`}
        </text>
        <text x={14} y={56} className="name">
          {m.name}
        </text>
        <text x={16} y={80} className="k">
          {touched ? touched.name.replace(/^REVERB /, '') : 'DECAY'}
        </text>
        <text x={16} y={102} className="v">
          {touched ? touched.value.toUpperCase() : fmt(T)}
        </text>
        <text x={16} y={124} className="k">
          {touched ? '' : `PRE ${skyText(type, 'xSkyPre', X('xSkyPre'))}`}
        </text>
        <text x={16} y={h - 14} className="k">
          FREQUENCY · TIME · LEVEL
        </text>
      </svg>
    </div>
  );
};

/* ---------------- B : la salle vue de dessus ---------------- */

/** Les murs (m) : la piece de la machine (Sky.cpp skyEngine : ROOM, HALL, REFLECTIONS), sinon une salle a la mesure de DECAY. */
function roomOf(m: SkyMachineDef): { w: number; l: number; sx: number; sy: number; ly: number; label: string } {
  const p = (i: number): number => X(SKY_SLOTS[i]);
  if (m.id === 'room') {
    const club = stepOf(p(0), 2) === 1;
    return club ? { w: 13, l: 10, sx: 0.5, sy: 0.62, ly: 0.2, label: 'CLUB' } : { w: 5.5, l: 4.2, sx: 0.5, sy: 0.62, ly: 0.2, label: 'STUDIO' };
  }
  if (m.id === 'hall') {
    const arena = stepOf(p(1), 2) === 1;
    return arena ? { w: 70, l: 55, sx: 0.5, sy: 0.3, ly: 0.6, label: 'ARENA' } : { w: 32, l: 24, sx: 0.5, sy: 0.3, ly: 0.6, label: 'CONCERT HALL' };
  }
  if (m.id === 'reflections') {
    const ft2 = 100 * Math.pow(10, X('xSkyDecay'));
    const a = ft2 * 0.0929;
    const r = [1, 1.6, 2.6][stepOf(p(2), 3)];
    return { w: Math.sqrt(a * r), l: Math.sqrt(a / r), sx: p(0), sy: 1 - p(1), ly: 0.15, label: `${Math.round(ft2 / 10) * 10} SQ FT` };
  }
  const T = decayOf(m.id, X('xSkyDecay'));
  const s = 6 + 9 * Math.sqrt(T);
  return { w: s * 1.3, l: s, sx: 0.5, sy: 0.35, ly: 0.65, label: m.name };
}

const RoomView: React.FC<{ w: number; h: number; m: SkyMachineDef; type: number }> = ({ w, h, m, type }) => {
  useAll();
  const r = roomOf(m);
  const T = m.id === 'reflections' ? 0.06 + 0.3 * X('xSkyDecay') : decayOf(m.id, X('xSkyDecay'));
  const pre = m.preLabel === 'FEEDBACK' ? 0 : preOf(X('xSkyPre'));
  const padL = 150;
  const boxW = w - padL - 24;
  const boxH = h - 56;
  const k = Math.min(boxW / r.w, boxH / r.l);
  const rw = r.w * k;
  const rl = r.l * k;
  const ox = padL + (boxW - rw) / 2;
  const oy = 34 + (boxH - rl) / 2;
  const S = { x: ox + r.sx * rw, y: oy + r.sy * rl };
  const Lx = { x: ox + rw * 0.5, y: oy + r.ly * rl };
  // les sources images (premier ordre) : chaque mur renvoie la source ; le rayon source -> mur -> auditeur
  const walls = [
    { img: { x: 2 * ox - S.x, y: S.y }, hit: (q: { x: number; y: number }) => ({ x: ox, y: S.y + (q.y - S.y) * ((ox - S.x) / (q.x - S.x || 1)) }) },
    { img: { x: 2 * (ox + rw) - S.x, y: S.y }, hit: (q: { x: number; y: number }) => ({ x: ox + rw, y: S.y + (q.y - S.y) * ((ox + rw - S.x) / (q.x - S.x || 1)) }) },
    { img: { x: S.x, y: 2 * oy - S.y }, hit: (q: { x: number; y: number }) => ({ x: S.x + (q.x - S.x) * ((oy - S.y) / (q.y - S.y || 1)), y: oy }) },
    { img: { x: S.x, y: 2 * (oy + rl) - S.y }, hit: (q: { x: number; y: number }) => ({ x: S.x + (q.x - S.x) * ((oy + rl - S.y) / (q.y - S.y || 1)), y: oy + rl }) },
  ];
  const rays = walls.map((wl) => {
    // le point du mur sur la droite image -> auditeur
    const t = wl.img.x === S.x ? (wl.img.y < S.y ? (oy - wl.img.y) / (Lx.y - wl.img.y) : (oy + rl - wl.img.y) / (Lx.y - wl.img.y)) : wl.img.x < S.x ? (ox - wl.img.x) / (Lx.x - wl.img.x) : (ox + rw - wl.img.x) / (Lx.x - wl.img.x);
    const p = { x: wl.img.x + (Lx.x - wl.img.x) * t, y: wl.img.y + (Lx.y - wl.img.y) * t };
    const dist = (Math.hypot(p.x - S.x, p.y - S.y) + Math.hypot(Lx.x - p.x, Lx.y - p.y)) / k;
    return { p, ms: Math.round(pre * 1000 + (dist / 343) * 1000) };
  });
  // les fronts d'onde : des anneaux autour de la source et de ses quatre images (les murs les renvoient), de plus en plus
  // pales ; la piece se remplit, son interieur s'allume selon DECAY
  const diag = Math.hypot(rw, rl);
  const NR = 12;
  const rings = Array.from({ length: NR }, (_, i) => ({ rad: ((i + 1) / NR) * diag * 0.9, op: 0.75 * (1 - i / NR) ** 1.4 }));
  const srcs = [{ x: S.x, y: S.y, k: 1 }, ...walls.map((wl) => ({ x: wl.img.x, y: wl.img.y, k: 0.45 }))];
  const fmt = (s: number): string => (s < 1 ? `${Math.round(s * 1000)} MS` : `${s.toFixed(s < 10 ? 2 : 1)} S`);
  return (
    <div className="mm-dm-glass mm-fx2-room" style={{ width: w, height: h }} role="img" aria-label="The reverb space seen from above">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <defs>
          <clipPath id="mm-fx2-roomclip">
            <rect x={ox} y={oy} width={rw} height={rl} />
          </clipPath>
          <radialGradient id="mm-fx2-glow">
            <stop offset="0" style={{ stopColor: 'var(--mm-accent)' }} stopOpacity="0.35" />
            <stop offset="1" style={{ stopColor: 'var(--mm-accent)' }} stopOpacity="0" />
          </radialGradient>
        </defs>
        {Array.from({ length: 9 }, (_, i) => (
          <path key={`v${i}`} className="g" d={`M${padL + (i * boxW) / 8} 30V${h - 22}`} />
        ))}
        <g clipPath="url(#mm-fx2-roomclip)">
          <rect x={ox} y={oy} width={rw} height={rl} className="air" />
          <circle cx={S.x} cy={S.y} r={Math.max(rw, rl)} fill="url(#mm-fx2-glow)" style={{ opacity: Math.min(0.55, T / 8) }} />
          {srcs.map((q, j) => rings.map((g, i) => <circle key={`${j}-${i}`} cx={q.x} cy={q.y} r={g.rad} className="ring" style={{ opacity: g.op * q.k }} />))}
          {rays.map((ry, i) => (
            <path key={i} className="ray" d={`M${S.x} ${S.y}L${ry.p.x.toFixed(1)} ${ry.p.y.toFixed(1)}L${Lx.x} ${Lx.y}`} />
          ))}
        </g>
        <rect x={ox} y={oy} width={rw} height={rl} className="wall" />
        {rays.map((ry, i) => (
          <g key={i}>
            <circle cx={ry.p.x} cy={ry.p.y} r={3} className="hit" />
            <text x={ry.p.x + (ry.p.x <= ox + 1 ? -6 : ry.p.x >= ox + rw - 1 ? 6 : 0)} y={ry.p.y + (ry.p.y <= oy + 1 ? -6 : ry.p.y >= oy + rl - 1 ? 12 : 3)} textAnchor={ry.p.x <= ox + 1 ? 'end' : ry.p.x >= ox + rw - 1 ? 'start' : 'middle'} className="ms">
              {`${ry.ms}`}
            </text>
          </g>
        ))}
        <circle cx={S.x} cy={S.y} r={5} className="src" />
        <text x={S.x} y={S.y - 9} textAnchor="middle" className="lab">
          MM-ARP
        </text>
        <g className="ears">
          <circle cx={Lx.x - 6} cy={Lx.y} r={3.2} />
          <circle cx={Lx.x + 6} cy={Lx.y} r={3.2} />
        </g>
        <text x={Lx.x} y={Lx.y + 14} textAnchor="middle" className="lab">
          YOU
        </text>
        <text x={16} y={22} className="kind">
          {`TYPE ${String(type).padStart(2, '0')} / 12`}
        </text>
        <text x={14} y={54} className="name">
          {m.name}
        </text>
        <text x={16} y={76} className="k">
          {r.label}
        </text>
        <text x={16} y={92} className="v2">
          {`${r.w.toFixed(r.w < 10 ? 1 : 0)} × ${r.l.toFixed(r.l < 10 ? 1 : 0)} M`}
        </text>
        <text x={16} y={116} className="k">
          DECAY
        </text>
        <text x={16} y={138} className="v">
          {fmt(T)}
        </text>
        <text x={16} y={160} className="k">
          {`1ST REFLECTION ${Math.min(...rays.map((x) => x.ms))} MS`}
        </text>
        <text x={16} y={h - 14} className="k">
          SEEN FROM ABOVE · MS TO YOUR EARS
        </text>
      </svg>
    </div>
  );
};

/* ---------------- l'EQ de la reverbe : trois points (LOW CUT, MID, HIGH CUT), le graphe de SOUND ---------------- */

const SkyEq: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  useAll();
  const fx = (f: number): number => 14 + (Math.log10(f / 20) / 3) * (w - 28);
  const fy = (db: number): number => h / 2 + 2 - (db / 18) * (h / 2 - 16);
  const pts: string[] = [];
  const ghost: string[] = [];
  for (let i = 0; i <= 200; i += 1) {
    const f = 20 * Math.pow(1000, i / 200);
    pts.push(`${fx(f).toFixed(1)},${fy(Math.max(-18, Math.min(18, eqDb(f) + machineDb(f)))).toFixed(1)}`);
    ghost.push(`${fx(f).toFixed(1)},${fy(Math.max(-18, Math.min(18, machineDb(f)))).toFixed(1)}`);
  }
  const v = (id: string): number => mockStore.of(id);
  const nodes = [
    { n: 1, f: loHz(v(LO)), g: 0, on: v(LO) > 0.005, id: LO },
    { n: 2, f: midHz(v(MF)), g: midDb(v(MG)), on: Math.abs(midDb(v(MG))) > 0.05, id: MF },
    { n: 3, f: hiHz(v(HI)), g: 0, on: v(HI) < 0.995, id: HI },
  ];
  return (
    <div className="mm-dm-glass mm-eq-screen mm-fx2-skyeq" style={{ width: w, height: h, position: 'relative' }}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {[50, 100, 200, 500, 1000, 2000, 5000, 10000].map((f) => (
          <g key={f}>
            <path className="grid" d={`M${fx(f).toFixed(1)} 20V${h - 14}`} />
            <text x={fx(f)} y={h - 4} textAnchor="middle">
              {f >= 1000 ? `${f / 1000}K` : f}
            </text>
          </g>
        ))}
        {[-12, -6, 0, 6, 12].map((d) => (
          <path key={d} className={d === 0 ? 'grid zero' : 'grid'} d={`M14 ${fy(d).toFixed(1)}H${w - 14}`} />
        ))}
        <polyline className="ghost" points={ghost.join(' ')} />
        <polyline className="eq-fill" points={`14,${fy(0)} ${pts.join(' ')} ${w - 14},${fy(0)}`} />
        <polyline className="main" points={pts.join(' ')} />
        {nodes.map((b) => (
          <g key={b.n} className="eq-node" data-on={b.on ? '1' : undefined} data-sel={b.n === 2 ? '1' : undefined}>
            <circle cx={fx(b.f)} cy={fy(b.g)} r={b.n === 2 ? 8.5 : 7.5} />
            <text x={fx(b.f)} y={fy(b.g) + 3.2} textAnchor="middle">
              {b.n === 1 ? 'L' : b.n === 2 ? 'M' : 'H'}
            </text>
          </g>
        ))}
        <text x="16" y="14">
          REVERB EQ · WET ONLY
        </text>
        <text x={w - 16} y="14" textAnchor="end" className="hot">
          {`LOW CUT ${SRC.text(LO)} · MID ${SRC.text(MG)} · HIGH CUT ${SRC.text(HI)}`}
        </text>
        <text x={w / 2 - 40} y="14" textAnchor="middle" className="dim">
          DASHED: TONE + LOW END
        </text>
      </svg>
    </div>
  );
};

/* ---------------- les touches TYPE, la machine, la sortie ---------------- */

/** INIT (les reglages de depart de la machine), CLASSIC (la reverbe d'avant). */
const MachineKeys: React.FC<{ type: number; col?: boolean }> = ({ type, col }) => {
  const m = skyMachineOf(type);
  return (
    <span className={col ? 'mm-fx2-skymk mm-fx2-skymk-col' : undefined} style={col ? undefined : { display: 'contents' }}>
      <PcbKey name="INIT" w={40} h={16} disabled={!m} onClick={() => skyInit()} />
      <PcbKey name="CLASSIC" w={40} h={16} on={!m} onClick={() => skySelect(0)} />
    </span>
  );
};

const TypeKeys: React.FC<{ cols: number; kw: number; type: number; mk?: boolean }> = ({ cols, kw, type, mk = true }) => {
  const m = skyMachineOf(type);
  return (
    <div className="mm-fx2-skykeys" style={{ gridTemplateColumns: `repeat(${cols}, 1fr)` }} role="radiogroup" aria-label="Reverb type">
      {SKY_MACHINES.map((mm, i) => (
        <PcbKey key={mm.id} name={mm.name} w={kw} h={16} on={type === i + 1} role="radio" aria-checked={type === i + 1} title={mm.blurb} onClick={() => skySelect(i + 1)} />
      ))}
      <span className="mm-fx2-skyblurb" style={{ gridColumn: `1 / ${cols + 1}` }}>
        {m ? m.blurb : 'The convolution reverb of the MM-ARP before the twelve machines.'}
      </span>
      {mk && (
        <span className="mm-fx2-skymk" style={{ gridColumn: `1 / ${cols + 1}` }}>
          <MachineKeys type={type} />
        </span>
      )}
    </div>
  );
};

const Row: React.FC<{ top: number; left?: number; w: number; children: React.ReactNode }> = ({ top, left, w, children }) => (
  <div className="mm-p2-cells mm-hell-row" style={{ top, left: left ?? undefined, width: w }}>
    {children}
  </div>
);

const FR = 118;

/** Les cinq reglages de la machine (DECAY en grand) et ses places propres, en deux cadres. */
function machineCells(type: number, m: SkyMachineDef): { face: Cell[]; own: Cell[] } {
  const face = SKY_FACE.map((id) => cellOf(type, id));
  const own = m.slots.map((s, i) => cellOf(type, SKY_SLOTS[i], s.options?.length));
  return { face, own };
}

const FaceFrame: React.FC<{ x: number; y: number; type: number; m: SkyMachineDef; sep?: boolean }> = ({ x, y, type, m, sep }) => {
  const { face } = machineCells(type, m);
  const w = frameW(face) + 12;
  return (
    <PcbFrame title={`${m.name} · THE TAIL`} x={x} y={y} w={w} h={FR} sep={sep} className="mm-hell-frame">
      <Row top={22} w={w}>
        <PcbKnob id="xSkyDecay" name={m.decayLabel} ref_="" lo={skyText(type, 'xSkyDecay', 0).replace(/\.0+ S$/, ' S')} hi={skyText(type, 'xSkyDecay', 1).replace(/\.\d+ S$/, ' S')} big />
        {face.slice(1).map((c, i) => (
          <CellView key={`${type}-${c.id}`} c={c} refN={61 + i} />
        ))}
      </Row>
    </PcbFrame>
  );
};

const OwnFrame: React.FC<{ x: number; y: number; type: number; m: SkyMachineDef; sep?: boolean; mk?: boolean }> = ({ x, y, type, m, sep, mk }) => {
  const { own } = machineCells(type, m);
  const w = ownW(type, m, mk);
  return (
    <PcbFrame title={`${m.name} +`} x={x} y={y} w={w} h={FR} sep={sep} className="mm-hell-frame">
      <Row top={22} w={w}>
        {own.map((c, i) => (
          <CellView key={`${type}-${c.id}`} c={c} refN={70 + i} />
        ))}
        {mk && <MachineKeys type={type} col />}
      </Row>
    </PcbFrame>
  );
};

const ownW = (type: number, m: SkyMachineDef, mk = false): number => Math.max(150, frameW(machineCells(type, m).own) + (mk ? 70 : 0));
const faceW = (type: number, m: SkyMachineDef): number => frameW(machineCells(type, m).face) + 12;

const EqKnobs: React.FC = () => (
  <>
    <PcbKnob id={LO} name="LOW CUT" ref_="" lo="" hi="" fine />
    <PcbStep id={LOS} name="SLOPE" ref_="" w={70} />
    <PcbKnob id={MF} name="MID" ref_="" lo="" hi="" fine />
    <PcbKnob id={MG} name="GAIN" ref_="" lo="" hi="" fine />
    <PcbKnob id={MQ} name="Q" ref_="" lo="" hi="" fine />
    <PcbKnob id={HI} name="HIGH CUT" ref_="" lo="" hi="" fine />
    <PcbStep id={HIS} name="SLOPE" ref_="" w={70} />
  </>
);

/* ---------------- les deux pages ---------------- */

const Z = { x: 44, w: 1012 };
const G = 22;

export const SkyPageA: React.FC<{ flash: (title: string) => boolean }> = ({ flash }) => {
  useAll();
  const type = skyTypeIndex(X('xSkyType'));
  const m = skyMachineOf(type) ?? SKY_MACHINES[1];
  const TW = 360;
  const WX = Z.x + TW + G;
  const fw = faceW(type, m);
  const ow = ownW(type, m, true);
  const tot = fw + G + ow;
  const rx = Z.x + Math.round((Z.w - tot) / 2);
  const EQW = 640;
  const OW = Z.w - EQW - G;
  return (
    <>
      <PcbFrame title="TYPE" x={Z.x} y={60} w={TW} h={206} flash={flash('TYPE')} className="mm-hell-frame">
        <TypeKeys cols={4} kw={52} type={type} mk={false} />
      </PcbFrame>
      <div className="mm-dm-place" style={{ left: WX, top: 66 }}>
        <Waterfall w={Z.x + Z.w - WX} h={200} m={m} type={type} />
      </div>
      <FaceFrame x={rx} y={282} type={type} m={m} sep />
      <OwnFrame x={rx + fw + G} y={282} type={type} m={m} mk />
      <PcbFrame title="REVERB EQ" x={Z.x} y={414} w={EQW} h={226} sep className="mm-hell-frame">
        <div className="mm-dm-place" style={{ left: 12, top: 20 }}>
          <SkyEq w={EQW - 24} h={104} />
        </div>
        <Row top={132} w={EQW}>
          <EqKnobs />
        </Row>
      </PcbFrame>
      <PcbFrame title="OUTPUT" x={Z.x + EQW + G} y={414} w={OW} h={226} flash={flash('REVERB')} className="mm-hell-frame" led={voyParams.of('reverb') > 0}>
        <Row top={22} w={OW}>
          <PcbKnob id="reverb" name="MIX" ref_="" lo="DRY" hi="WET" big />
          <PcbKnob id={WIDTH} name="WIDTH" ref_="" lo="MONO" hi="150 %" />
        </Row>
        <Row top={132} w={OW}>
          <PcbKnob id={DUCK} name="DUCK" ref_="" lo="" hi="" fine />
          <PcbStep id={FREEZE} name="FREEZE" ref_="" w={84} />
        </Row>
      </PcbFrame>
    </>
  );
};

export const SkyPageB: React.FC<{ flash: (title: string) => boolean }> = ({ flash }) => {
  useAll();
  const type = skyTypeIndex(X('xSkyType'));
  const m = skyMachineOf(type) ?? SKY_MACHINES[1];
  const LW = 432;
  const RX = Z.x + LW + G;
  const RW = Z.x + Z.w - RX;
  const ow = ownW(type, m);
  const OUTW = RW - ow - G;
  return (
    <>
      <div className="mm-dm-place" style={{ left: Z.x, top: 66 }}>
        <RoomView w={LW} h={300} m={m} type={type} />
      </div>
      <PcbFrame title="TYPE" x={Z.x} y={384} w={LW} h={256} flash={flash('TYPE')} className="mm-hell-frame">
        <TypeKeys cols={4} kw={60} type={type} />
      </PcbFrame>
      <FaceFrame x={RX + Math.round((RW - faceW(type, m)) / 2)} y={60} type={type} m={m} />
      <OwnFrame x={RX} y={190} type={type} m={m} sep />
      <PcbFrame title="OUTPUT" x={RX + ow + G} y={190} w={OUTW} h={FR} flash={flash('REVERB')} className="mm-hell-frame" led={voyParams.of('reverb') > 0}>
        <Row top={22} w={OUTW}>
          <PcbKnob id="reverb" name="MIX" ref_="" lo="DRY" hi="WET" big />
          <PcbKnob id={WIDTH} name="WIDTH" ref_="" lo="" hi="" fine />
          <PcbKnob id={DUCK} name="DUCK" ref_="" lo="" hi="" fine />
          <PcbStep id={FREEZE} name="FREEZE" ref_="" w={78} />
        </Row>
      </PcbFrame>
      <PcbFrame title="REVERB EQ" x={RX} y={320} w={RW} h={320} className="mm-hell-frame">
        <div className="mm-dm-place" style={{ left: 12, top: 20 }}>
          <SkyEq w={RW - 24} h={188} />
        </div>
        <Row top={218} w={RW}>
          <EqKnobs />
        </Row>
      </PcbFrame>
    </>
  );
};
