/**
 * MAQUETTE v44 : la page HELL refaite, "la botte secrete" (hell2.ts : les six cercles, la descente, la banque).
 * ?fx2=A ou ?fx2=B (fx2.ts). Les reglages d'aujourd'hui (xHell*, Hell.cpp) sont les vrais ; ceux des cercles II a VI
 * n'existent pas encore cote DSP : reglages de maquette (aucun son).
 *
 * - A, LE VORTEX : le gros MIX au centre, entoure de six anneaux (un par cercle, I dehors, VI au fond) qui s'allument quand
 *   MIX les fait entrer, tournent au tempo de leur cercle et prennent sa forme (spirale, onde, eclats, hachures, dents) ;
 *   les cercles I a III a gauche, IV a VI a droite ; la banque sous le vortex.
 * - B, L'ESCALIER : MIX en haut a gauche avec l'escalier des six marches qui s'allument, le tunnel a droite (les anneaux
 *   qui fuient vers le fond, un par temps), puis les six cercles en colonnes, dans l'ordre de la descente.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { arpExtra } from './extra';
import { bpmNow, mockParam, mockStore } from './fx2';
import { CHOP_BEATS, CIRCLES, GRAIN_BEATS, HELL2_PARAMS, HELL2_PRESETS, RATE_BEATS, circleDepth, type Circle, type Hell2Preset } from './hell2';
import { PcbFrame, PcbKey, PcbKnob, PcbRotary, PcbSelect, PcbStep, PcbToggle, SRC, useRaise } from './pcbui';
import './fx2.css';

for (const p of HELL2_PARAMS) mockParam(p.id, p.label, p.def, p.text, p.steps);

const useAll = (): void => {
  useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
  useSyncExternalStore(mockStore.subscribe, mockStore.get, mockStore.get);
};
const V = (id: string): number => SRC.of(id);
const stepI = (id: string, n: number): number => Math.max(0, Math.min(n - 1, Math.round(V(id) * (n - 1))));

/** Combien un cercle agit, a la position de MIX : sa part dans la descente x son reglage. */
function depthOf(c: Circle): number {
  const m = V('xHellMix');
  const mode = stepI('xHellDescent', 2);
  const amt =
    c.id === 'echo'
      ? V('xHellFb')
      : c.id === 'spin'
        ? Math.max(V('xHellSpin'), V('xHellDrunk'), V('xHellSweep'))
        : c.id === 'metal'
          ? Math.max(V('xHellRing'), V('xHellComb'))
          : c.id === 'warp'
            ? Math.min(1, V('xHellWarp') * 1.6)
            : V(c.amount);
  return circleDepth(m, c.entry, mode) * amt;
}

/** Les temps par cycle d'un cercle (sa vitesse en sync). */
function beatsOf(c: Circle): number {
  switch (c.id) {
    case 'warp':
      return RATE_BEATS[stepI('xHellWarpRate', 7)];
    case 'spin':
      return RATE_BEATS[stepI('xHellSpinRate', 7)];
    case 'shatter':
      return GRAIN_BEATS[stepI('xHellShatterSize', 5)] * 8;
    case 'chop':
      return CHOP_BEATS[stepI('xHellChopGrid', 7)] * 16;
    case 'metal':
      return 4;
    default:
      return 8;
  }
}

/* ---------------- les anneaux (A) ---------------- */

/** Le trace d'un anneau selon son cercle : la spirale, l'onde, les eclats, les hachures, les dents. */
function ringPath(c: Circle, r: number, d: number, seed: number): { d: string; dots?: { x: number; y: number; r: number }[] } {
  const N = 180;
  const pts: string[] = [];
  const rnd = (i: number): number => {
    const x = Math.sin((i + 1) * 12.9898 + seed * 78.233) * 43758.5453;
    return x - Math.floor(x);
  };
  if (c.id === 'shatter') {
    const dots = Array.from({ length: 64 }, (_, i) => {
      const a = (i / 64) * Math.PI * 2 + rnd(i) * 0.08;
      const rr = r + (rnd(i + 99) - 0.5) * 10 * (0.3 + d);
      return { x: Math.cos(a) * rr, y: Math.sin(a) * rr, r: 0.8 + rnd(i + 7) * 1.8 * (0.4 + d) };
    });
    return { d: '', dots };
  }
  for (let i = 0; i <= N; i += 1) {
    const a = (i / N) * Math.PI * 2;
    let rr = r;
    if (c.id === 'echo') rr = r - 7 + (14 * i) / N; // une spire de spirale
    if (c.id === 'warp') rr = r + Math.sin(a * 6) * (1.5 + 5 * d);
    if (c.id === 'metal') rr = r + (Math.floor((i / N) * 48) % 2 ? 3.5 * (0.3 + d) : -1);
    pts.push(`${(Math.cos(a) * rr).toFixed(2)},${(Math.sin(a) * rr).toFixed(2)}`);
  }
  return { d: `M${pts.join(' L')}${c.id === 'echo' ? '' : ' Z'}` };
}

/** La rotation des anneaux au tempo (une transformation par anneau, sans redessiner la page). */
function useSpin(refs: React.MutableRefObject<(SVGGElement | null)[]>, beats: number[], bpm: number): void {
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const step = (now: number): void => {
      raf = window.requestAnimationFrame(step);
      if (now - last < 33) return;
      last = now;
      const b = (now / 60000) * bpm;
      refs.current.forEach((g, i) => {
        if (!g) return;
        const dir = i % 2 ? -1 : 1;
        g.setAttribute('transform', `rotate(${((dir * (b / beats[i]) * 360) % 360).toFixed(2)})`);
      });
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [refs, beats, bpm]);
}

const Vortex: React.FC<{ size: number }> = ({ size }) => {
  useAll();
  const bpm = bpmNow();
  const c0 = size / 2;
  const R0 = size / 2 - 14;
  const gap = 16;
  const refs = useRef<(SVGGElement | null)[]>([]);
  const beats = CIRCLES.map(beatsOf);
  useSpin(refs, beats, bpm);
  const m = V('xHellMix');
  return (
    <svg className="mm-fx2-vortex" width={size} height={size} viewBox={`${-c0} ${-c0} ${size} ${size}`} aria-hidden="true">
      <defs>
        <radialGradient id="mm-fx2-pit">
          <stop offset="0" stopColor="#000" stopOpacity="0.95" />
          <stop offset="0.55" style={{ stopColor: 'var(--mm-accent)' }} stopOpacity={0.05 + 0.3 * m} />
          <stop offset="1" style={{ stopColor: 'var(--mm-accent)' }} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r={R0 + 10} fill="url(#mm-fx2-pit)" />
      {CIRCLES.map((c, i) => {
        const r = R0 - i * gap;
        const d = depthOf(c);
        const p = ringPath(c, r, d, i);
        const dash = c.id === 'chop' ? `${(2 * Math.PI * r) / 32 - 3} 3` : c.id === 'spin' ? `${(2 * Math.PI * r) / 8 - 10} 10` : undefined;
        return (
          <g key={c.id} className="ring" data-on={d > 0.02 ? '1' : undefined} style={{ opacity: 0.16 + 0.84 * Math.min(1, d * 1.3) }}>
            <circle r={r} className="track" />
            <g
              ref={(el) => {
                refs.current[i] = el;
              }}
            >
              {p.dots ? p.dots.map((q, k) => <circle key={k} cx={q.x} cy={q.y} r={q.r} className="dot" />) : <path d={p.d} className="line" strokeDasharray={dash} style={{ strokeWidth: 1.2 + 2.2 * d }} />}
            </g>
            <text x={0} y={-r + 3} textAnchor="middle" className="num">
              {c.n}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

/* ---------------- le tunnel (B) ---------------- */

const Tunnel: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  useAll();
  const bpm = bpmNow();
  const m = V('xHellMix');
  const ds = CIRCLES.map(depthOf);
  const [warp, spin, shatter, chop, metal] = [ds[1], ds[2], ds[3], ds[4], ds[5]];
  const N = 22;
  const cx = w / 2;
  const cy = h / 2 + 6;
  const ref = useRef<SVGGElement>(null);
  const [ph, setPh] = useState(0);
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const step = (now: number): void => {
      raf = window.requestAnimationFrame(step);
      if (now - last < 40) return;
      last = now;
      setPh(((now / 60000) * bpm) % 1);
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [bpm]);
  const rings = Array.from({ length: N }, (_, i) => {
    const z = (i + 1 - ph) / N; // 0 : tout pres, 1 : au fond
    const s = 1 / (0.3 + 1.6 * z);
    const bx = Math.sin(z * 7 + ph * 2 * Math.PI) * 60 * warp * z;
    const by = Math.cos(z * 5) * 22 * warp * z;
    const rot = z * 220 * spin + ph * 90 * spin;
    return { z, s, bx, by, rot, i };
  }).reverse();
  return (
    <div className="mm-dm-glass mm-fx2-tunnel" style={{ width: w, height: h }} aria-hidden="true">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <g ref={ref}>
          {rings.map((r) => {
            const rw = Math.min(w * 0.86, 230 * r.s);
            const rh = Math.min(h * 0.86, 130 * r.s);
            const op = Math.max(0, 1 - r.z) * (0.25 + 0.75 * m);
            const dash = chop > 0.05 ? `${(12 * (1.1 - chop)).toFixed(1)} ${(6 * chop + 1).toFixed(1)}` : undefined;
            return (
              <g key={r.i} transform={`translate(${(cx + r.bx).toFixed(1)} ${(cy + r.by).toFixed(1)}) rotate(${r.rot.toFixed(1)})`} style={{ opacity: op }}>
                <rect x={-rw / 2} y={-rh / 2} width={rw} height={rh} rx={rh * (0.18 + 0.32 * metal)} className="t-ring" strokeDasharray={dash} style={{ strokeWidth: (0.6 + 2.4 * (1 - r.z)).toFixed(2) }} />
                {shatter > 0.05 &&
                  Array.from({ length: 10 }, (_, k) => {
                    const a = (k / 10) * Math.PI * 2 + r.i;
                    return <circle key={k} cx={(Math.cos(a) * rw) / 2} cy={(Math.sin(a) * rh) / 2} r={(0.6 + 2.2 * shatter) * (1 - r.z)} className="t-dot" />;
                  })}
              </g>
            );
          })}
        </g>
        <text x={14} y={16} className="t-k">
          THE PIT · ONE RING PER BEAT
        </text>
        <text x={w - 14} y={16} textAnchor="end" className="t-hot">
          {`${Math.round(bpm)} BPM · MIX ${Math.round(m * 100)} %`}
        </text>
      </svg>
    </div>
  );
};

/* ---------------- les presets (la banque proposee) ---------------- */

const KEYS = Object.keys(HELL2_PRESETS[0].v);
function current(): Hell2Preset | null {
  return HELL2_PRESETS.find((p) => KEYS.every((k) => Math.abs(V(k) - p.v[k]) < 0.0015)) ?? null;
}
let lastIdx = -1;
export function hell2Load(p: Hell2Preset): void {
  for (const [k, x] of Object.entries(p.v)) {
    if (arpExtra.get()[k] !== undefined) arpExtra.set(k, x);
    else mockStore.set(k, x);
  }
  if (arpExtra.of('xHellMix') <= 0) arpExtra.set('xHellMix', 0.5);
  lastIdx = HELL2_PRESETS.indexOf(p);
}
function step(d: number): void {
  const c = current();
  const i = c ? HELL2_PRESETS.indexOf(c) : lastIdx;
  const n = HELL2_PRESETS.length;
  hell2Load(HELL2_PRESETS[i < 0 ? (d > 0 ? 0 : n - 1) : (i + d + n) % n]);
}

const PresetBox: React.FC<{ className?: string; style?: React.CSSProperties }> = ({ className, style }) => {
  useAll();
  const cur = current();
  const [list, setList] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useRaise(list, box);
  const n = cur ? HELL2_PRESETS.indexOf(cur) + 1 : 0;
  return (
    <div ref={box} className={`mm-hell-presets mm-fx2-hpresets${className ? ` ${className}` : ''}`} style={style}>
      <button type="button" className="mm-hell-pwin mm-fx2-hpwin" aria-haspopup="listbox" aria-expanded={list} onClick={() => setList((o) => !o)}>
        <span className="mm-hell-pnum">{cur ? `${String(n).padStart(2, '0')} / ${HELL2_PRESETS.length} · ${cur.lead.map((id) => CIRCLES.find((c) => c.id === id)?.n).join(' ')}` : `-- / ${HELL2_PRESETS.length}`}</span>
        <b>{cur ? cur.name : 'YOUR HELL'}</b>
        <span className="mm-hell-pdesc">{cur ? cur.desc : 'A preset sets the six circles, not MIX.'}</span>
      </button>
      <div className="mm-hell-pkeys">
        <PcbKey name="PREV" w={34} h={16} onClick={() => step(-1)} aria-label="Previous HELL preset" />
        <PcbKey name="NEXT" w={34} h={16} onClick={() => step(1)} aria-label="Next HELL preset" />
        <PcbKey name="INIT" w={34} h={16} onClick={() => hell2Load(HELL2_PRESETS[0])} aria-label="HELL INIT" />
      </div>
      {list && (
        <ul className="mm-hell-plist" role="listbox" aria-label="HELL presets">
          {HELL2_PRESETS.map((p, i) => (
            <li key={p.name}>
              <button
                type="button"
                role="option"
                aria-selected={cur?.name === p.name}
                data-on={cur?.name === p.name ? '1' : undefined}
                title={p.desc}
                onClick={() => {
                  hell2Load(p);
                  setList(false);
                }}
              >
                <span>{String(i + 1).padStart(2, '0')}</span>
                {p.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/* ---------------- les cercles ---------------- */

const Row: React.FC<{ top: number; left?: number; w: number; children: React.ReactNode }> = ({ top, left, w, children }) => (
  <div className="mm-p2-cells mm-hell-row" style={{ top, left: left ?? undefined, width: w }}>
    {children}
  </div>
);

const C = (id: Circle['id']): Circle => CIRCLES.find((c) => c.id === id) as Circle;

/** Le cadre d'un cercle : son numero, son nom, sa LED (allumee quand MIX le fait entrer). */
const CircleFrame: React.FC<{ c: Circle; x: number; y: number; w: number; h: number; children: React.ReactNode; sep?: boolean; flash?: boolean }> = ({ c, x, y, w, h, children, sep, flash }) => {
  useAll();
  const d = depthOf(c);
  return (
    <PcbFrame title={`${c.n} · ${c.name}`} x={x} y={y} w={w} h={h} led={d > 0.02} sep={sep} flash={flash} className="mm-hell-frame mm-fx2-circle">
      {children}
      <span className="mm-fx2-verb">{c.verb}</span>
    </PcbFrame>
  );
};

/** Les pieces de chaque cercle (les memes dans A et B ; B les range en colonnes). */
const Pieces: Record<Circle['id'], (narrow: boolean) => React.ReactNode[][]> = {
  echo: (nw) => {
    const sync = V('xHellSync') > 0;
    return [
      [
        <PcbKnob key="t" id="vHellDelay" name={sync ? 'TIME (NOTE)' : 'TIME'} ref_="" lo="" hi="" fine={nw} />,
        <PcbKnob key="f" id="xHellFb" name="FEEDBACK" ref_="" lo="" hi="" fine={nw} />,
        ...(nw ? [] : [<PcbKnob key="s" id="xHellShift" name="SHIFT" ref_="" lo="−" hi="+" />]),
      ],
      nw
        ? [<PcbKnob key="s" id="xHellShift" name="SHIFT" ref_="" lo="" hi="" fine />, <PcbToggle key="y" id="vHellSync" name="SYNC" ref_="" w={70} />]
        : [<PcbToggle key="y" id="vHellSync" name="SYNC" ref_="" w={76} />, <PcbRotary key="r" id="xHellRange" name="RANGE" ref_="" w={104} />, <PcbToggle key="c" id="xHellCross" name="CROSS" ref_="" w={76} />],
    ];
  },
  warp: (nw) => [
    nw
      ? [<PcbKnob key="d" id="xHellWarp" name="DEPTH" ref_="" lo="" hi="" fine />, <PcbSelect key="r" id="xHellWarpRate" name="RATE" ref_="" w={70} cols={2} />]
      : [<PcbKnob key="d" id="xHellWarp" name="DEPTH" ref_="" lo="0" hi="12 ST" />, <PcbRotary key="r" id="xHellWarpRate" name="RATE" ref_="" w={120} />, <PcbRotary key="s" id="xHellWarpShape" name="SHAPE" ref_="" w={126} />],
    ...(nw ? [[<PcbSelect key="s" id="xHellWarpShape" name="SHAPE" ref_="" w={120} cols={2} />]] : []),
  ],
  spin: (nw) => [
    nw
      ? [<PcbKnob key="a" id="xHellSpin" name="SPIN" ref_="" lo="" hi="" fine />, <PcbSelect key="r" id="xHellSpinRate" name="RATE" ref_="" w={70} cols={2} />]
      : [<PcbKnob key="a" id="xHellSpin" name="SPIN" ref_="" lo="" hi="" />, <PcbRotary key="r" id="xHellSpinRate" name="RATE" ref_="" w={112} />, <PcbKnob key="d" id="xHellDrunk" name="DRUNK" ref_="" lo="" hi="" fine />],
    nw ? [<PcbKnob key="d" id="xHellDrunk" name="DRUNK" ref_="" lo="" hi="" fine />, <PcbKnob key="w" id="xHellSweep" name="SWEEP" ref_="" lo="" hi="" fine />] : [<PcbKnob key="w" id="xHellSweep" name="SWEEP" ref_="" lo="" hi="" fine />],
  ],
  shatter: (nw) => [
    nw
      ? [<PcbKnob key="a" id="xHellShatter" name="GRAINS" ref_="" lo="" hi="" fine />, <PcbSelect key="s" id="xHellShatterSize" name="SIZE" ref_="" w={70} cols={2} />]
      : [<PcbKnob key="a" id="xHellShatter" name="GRAINS" ref_="" lo="" hi="" />, <PcbRotary key="s" id="xHellShatterSize" name="SIZE" ref_="" w={112} />, <PcbKnob key="p" id="xHellShatterSpray" name="SPRAY" ref_="" lo="" hi="" fine />],
    ...(nw ? [[<PcbKnob key="p" id="xHellShatterSpray" name="SPRAY" ref_="" lo="" hi="" fine />]] : []),
  ],
  chop: (nw) => [
    nw
      ? [<PcbKnob key="a" id="xHellChop" name="CHOP" ref_="" lo="" hi="" fine />, <PcbSelect key="g" id="xHellChopGrid" name="GRID" ref_="" w={70} cols={2} />]
      : [<PcbKnob key="a" id="xHellChop" name="CHOP" ref_="" lo="" hi="" />, <PcbRotary key="g" id="xHellChopGrid" name="GRID" ref_="" w={120} />],
    [<PcbKnob key="p" id="xHellChopPitch" name="PITCH" ref_="" lo="" hi="" fine />, <PcbKnob key="t" id="xHellChopGate" name="GATE" ref_="" lo="" hi="" fine />],
  ],
  metal: (nw) => [
    nw
      ? [<PcbKnob key="r" id="xHellRing" name="RING" ref_="" lo="" hi="" fine />, <PcbSelect key="t" id="xHellRingTune" name="TUNE" ref_="" w={70} cols={2} />]
      : [<PcbKnob key="r" id="xHellRing" name="RING" ref_="" lo="" hi="" />, <PcbSelect key="t" id="xHellRingTune" name="TUNE" ref_="" w={104} cols={2} />],
    nw
      ? [<PcbKnob key="c" id="xHellComb" name="COMB" ref_="" lo="" hi="" fine />, <PcbSelect key="s" id="xHellCombSeq" name="SEQ" ref_="" w={70} cols={2} />]
      : [<PcbKnob key="c" id="xHellComb" name="COMB" ref_="" lo="" hi="" />, <PcbSelect key="s" id="xHellCombSeq" name="SEQ" ref_="" w={104} cols={2} />],
  ],
};

const RH = 88;
const RHN = 98;
const CircleBlock: React.FC<{ id: Circle['id']; x: number; y: number; w: number; narrow?: boolean; sep?: boolean; flash?: boolean }> = ({ id, x, y, w, narrow = false, sep, flash }) => {
  useAll();
  const rows = Pieces[id](narrow);
  const rh = narrow ? RHN : RH;
  const h = 22 + rows.length * rh + (narrow ? 64 : 14);
  const d = depthOf(C(id));
  return (
    <CircleFrame c={C(id)} x={x} y={y} w={w} h={h} sep={sep} flash={flash}>
      {rows.map((r, i) => (
        <Row key={i} top={22 + i * rh} w={w}>
          {r}
        </Row>
      ))}
      {narrow && (
        <div className="mm-fx2-inmeter" style={{ top: 22 + rows.length * rh + 6 }} aria-label={`${C(id).name} in the mix: ${Math.round(d * 100)} %`}>
          <span>{`IN THE MIX · ${Math.round(d * 100)} %`}</span>
          <i>
            <b style={{ width: `${Math.round(d * 100)}%` }} />
          </i>
          <em>{`ENTERS AT MIX ${Math.round(C(id).entry * 100)} %`}</em>
        </div>
      )}
    </CircleFrame>
  );
};
const blockH = (id: Circle['id'], narrow = false): number => 22 + Pieces[id](narrow).length * (narrow ? RHN : RH) + (narrow ? 64 : 14);

/* ---------------- les deux pages ---------------- */

const Z = { x: 44, w: 1012 };
const G = 12;

export const HellPageA: React.FC<{ flash: (title: string) => boolean }> = ({ flash }) => {
  useAll();
  const SW = 344;
  const CX = Z.x + SW + 16;
  const CW = Z.w - 2 * SW - 32;
  const VS = CW;
  const hero = Math.round(52 * 1.7);
  const left: Circle['id'][] = ['echo', 'warp', 'spin'];
  const right: Circle['id'][] = ['shatter', 'chop', 'metal'];
  const col = (ids: Circle['id'][], x: number) => {
    let y = 60;
    return ids.map((id) => {
      const at = y;
      y += blockH(id) + G;
      return <CircleBlock key={id} id={id} x={x} y={at} w={SW} flash={id === 'echo' ? flash('HELL DELAY') : undefined} />;
    });
  };
  return (
    <>
      {col(left, Z.x)}
      {col(right, Z.x + Z.w - SW)}
      <div className="mm-dm-place mm-fx2-vplace" style={{ left: CX, top: 62, width: VS, height: VS }}>
        <Vortex size={VS} />
        <div className="mm-fx2-mixhero" style={{ left: VS / 2 - 60, top: VS / 2 - hero / 2 }}>
          <PcbKnob id="xHellMix" name="" ref_="" lo="" hi="" hero={1.7} />
        </div>
      </div>
      <div className="mm-fx2-mixlab" style={{ left: CX, top: 62 + VS + 2, width: CW }}>
        <b>MIX</b>
        <span>{`DESCENT ${Math.round(V('xHellMix') * 100)} % · ${CIRCLES.filter((c) => depthOf(c) > 0.02).length} OF 6 CIRCLES`}</span>
      </div>
      <PcbFrame title="HELL" x={CX} y={62 + VS + 40} w={CW} h={640 - (62 + VS + 40)} flash={flash('HELL')} led={V('xHellMix') > 0} className="mm-hell-frame">
        <Row top={18} w={CW}>
          <PcbStep id="xHellDescent" name="MIX MODE" ref_="" w={84} />
        </Row>
        <PresetBox style={{ top: 112 }} />
      </PcbFrame>
    </>
  );
};

/** L'escalier : six marches, une par cercle, allumees par MIX. */
const Stairs: React.FC<{ w: number }> = ({ w }) => {
  useAll();
  const sw = w / 6;
  return (
    <svg className="mm-fx2-stairs" width={w} height={74} viewBox={`0 0 ${w} 74`} aria-hidden="true">
      {CIRCLES.map((c, i) => {
        const d = depthOf(c);
        const y = 6 + i * 9;
        return (
          <g key={c.id} data-on={d > 0.02 ? '1' : undefined}>
            <rect x={i * sw + 1} y={y} width={sw - 2} height={74 - y - 14} className="step" style={{ opacity: 0.18 + 0.82 * Math.min(1, d * 1.3) }} />
            <text x={i * sw + sw / 2} y={72} textAnchor="middle" className="sn">
              {c.n}
            </text>
          </g>
        );
      })}
    </svg>
  );
};

export const HellPageB: React.FC<{ flash: (title: string) => boolean }> = ({ flash }) => {
  useAll();
  const MW = 268;
  const TX = Z.x + MW + 16;
  const PW = 236;
  const TW = Z.w - MW - PW - 32;
  const cw = (Z.w - 5 * 10) / 6;
  const cy = 340;
  const ids: Circle['id'][] = ['echo', 'warp', 'spin', 'shatter', 'chop', 'metal'];
  return (
    <>
      <PcbFrame title="HELL · MIX" x={Z.x} y={60} w={MW} h={262} flash={flash('HELL')} led={V('xHellMix') > 0} className="mm-hell-frame">
        <div className="mm-fx2-mixhero" style={{ left: MW / 2 - 60, top: 28 }}>
          <PcbKnob id="xHellMix" name="" ref_="" lo="" hi="" hero={2.4} />
        </div>
        <div className="mm-dm-place" style={{ left: 16, top: 156 }}>
          <Stairs w={MW - 32} />
        </div>
        <span className="mm-fx2-mixline" style={{ top: 238 }}>
          {`DESCENT ${Math.round(V('xHellMix') * 100)} %`}
        </span>
      </PcbFrame>
      <div className="mm-dm-place" style={{ left: TX, top: 64 }}>
        <Tunnel w={TW} h={256} />
      </div>
      <PcbFrame title="PRESETS" x={Z.x + Z.w - PW} y={60} w={PW} h={262} className="mm-hell-frame">
        <PresetBox style={{ top: 26 }} />
        <Row top={150} w={PW}>
          <PcbStep id="xHellDescent" name="MIX MODE" ref_="" w={84} />
        </Row>
      </PcbFrame>
      {ids.map((id, i) => (
        <CircleBlock key={id} id={id} x={Z.x + i * (cw + 10)} y={cy} w={cw} narrow flash={id === 'echo' ? flash('HELL DELAY') : undefined} />
      ))}
    </>
  );
};
