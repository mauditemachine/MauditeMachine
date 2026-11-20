/**
 * La page HELL v2 (v46, option A choisie par Mika : le vortex). HELL est une descente en six cercles (hell2.ts, le DSP :
 * plugin/mm-arp/dsp/Hell2.{h,cpp}) :
 * - au centre, le gros MIX (xHellMix, le potard HELL de la face) entoure de six anneaux, un par cercle (I dehors, VI au
 *   fond), qui s'allument quand MIX les fait entrer, tournent au tempo de leur cercle et prennent sa forme (spirale,
 *   onde, eclats, hachures, dents) ;
 * - les cercles I a III a gauche (ECHO, WARP, SPIN), IV a VI a droite (SHATTER, CHOP, METAL) ;
 * - sous le vortex : MIX MODE (DESCENT, ALL), HELL V2 (OFF : l'ancien HELL, celui d'un projet d'avant) et la banque
 *   (16 presets ; un preset regle tout HELL sauf MIX et met HELL V2 a ON).
 * Tous les reglages sont les vrais (extra-params.json, section hell), envoyes au C++ comme les autres.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pattern } from '../../audio/pattern';
import { arpExtra } from './extra';
import { HELL_DELAY, HELL_SYNC_LEVER } from './hell';
import { CHOP_BEATS, CIRCLES, GRAIN_BEATS, HELL2_PRESETS, RATE_BEATS, circleDepth, type Circle, type Hell2Preset } from './hell2';
import { PcbFrame, PcbKey, PcbKnob, PcbRotary, PcbSelect, PcbStep, PcbToggle, registerVirtual, useRaise } from './pcbui';
import './hell2.css';

// DELAY (le temps libre, ou la note quand SYNC est leve) et le levier SYNC, vus par la page (pcbui.tsx SRC.virtual)
registerVirtual('vHellDelay', { ...HELL_DELAY, name: 'HELL DELAY' });
registerVirtual('vHellSync', { ...HELL_SYNC_LEVER, def: () => 0, text: (v) => (v >= 0.5 ? 'SYNC' : 'FREE'), name: 'HELL SYNC' });

const useExtraAll = (): void => {
  useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
};
const V = (id: string): number => arpExtra.of(id);
const stepI = (id: string, n: number): number => Math.max(0, Math.min(n - 1, Math.round(V(id) * (n - 1))));
const isV2 = (): boolean => V('xHellV2') >= 0.5;

/** Le tempo du moment (120 sans transport). */
const bpmNow = (): number => {
  const b = pattern.get().bpm;
  return typeof b === 'number' && b > 0 ? b : 120;
};

/** Combien un cercle agit, a la position de MIX : sa part dans la descente x son reglage (l'ancien HELL : ECHO seul). */
function depthOf(c: Circle): number {
  const m = V('xHellMix');
  if (!isV2()) return c.id === 'echo' ? Math.min(1, 2 * m) * V('xHellFb') : 0;
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

/* ---------------- le vortex ---------------- */

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

/** La rotation des anneaux au tempo (une transformation par anneau, sans redessiner la page ; 30 images/s). */
function useSpin(refs: React.MutableRefObject<(SVGGElement | null)[]>, beats: number[], bpm: number): void {
  const key = beats.join(',');
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
  }, [refs, key, bpm]); // (beats : par sa cle)
}

const Vortex: React.FC<{ size: number }> = ({ size }) => {
  useExtraAll();
  const bpm = bpmNow();
  const c0 = size / 2;
  const R0 = size / 2 - 14;
  const gap = 16;
  const refs = useRef<(SVGGElement | null)[]>([]);
  const beats = CIRCLES.map(beatsOf);
  useSpin(refs, beats, bpm);
  const m = V('xHellMix');
  return (
    <svg className="mm-h2-vortex" width={size} height={size} viewBox={`${-c0} ${-c0} ${size} ${size}`} aria-hidden="true">
      <defs>
        <radialGradient id="mm-h2-pit">
          <stop offset="0" stopColor="#000" stopOpacity="0.95" />
          <stop offset="0.55" style={{ stopColor: 'var(--mm-accent)' }} stopOpacity={0.05 + 0.3 * m} />
          <stop offset="1" style={{ stopColor: 'var(--mm-accent)' }} stopOpacity="0" />
        </radialGradient>
      </defs>
      <circle r={R0 + 10} fill="url(#mm-h2-pit)" />
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

/* ---------------- les presets ---------------- */

const KEYS = Object.keys(HELL2_PRESETS[0].v);
/** Le preset dont les reglages sont ceux du moment (au millieme, comme la face les garde), sinon null. */
function current(): Hell2Preset | null {
  return HELL2_PRESETS.find((p) => KEYS.every((k) => Math.abs(V(k) - p.v[k]) < 0.0015)) ?? null;
}
let lastIdx = -1;
/** Un preset : tout HELL sauf MIX (HELL V2 a ON) ; si HELL est coupe, MIX a 50 % pour qu'on l'entende tout de suite. */
export function hell2Load(p: Hell2Preset): void {
  for (const [k, x] of Object.entries(p.v)) arpExtra.set(k, x);
  if (arpExtra.of('xHellMix') <= 0) arpExtra.set('xHellMix', 0.5);
  lastIdx = HELL2_PRESETS.indexOf(p);
}
function step(d: number): void {
  const c = current();
  const i = c ? HELL2_PRESETS.indexOf(c) : lastIdx;
  const n = HELL2_PRESETS.length;
  hell2Load(HELL2_PRESETS[i < 0 ? (d > 0 ? 0 : n - 1) : (i + d + n) % n]);
}

const PresetBox: React.FC<{ style?: React.CSSProperties }> = ({ style }) => {
  useExtraAll();
  const cur = current();
  const [list, setList] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useRaise(list, box);
  const n = cur ? HELL2_PRESETS.indexOf(cur) + 1 : 0;
  return (
    <div ref={box} className="mm-hell-presets mm-h2-presets" style={style}>
      <button type="button" className="mm-hell-pwin mm-h2-pwin" aria-haspopup="listbox" aria-expanded={list} onClick={() => setList((o) => !o)} title="The HELL bank">
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

/** Les pieces de chaque cercle, en rangees. */
const Pieces: Record<Circle['id'], () => React.ReactNode[][]> = {
  echo: () => [
    [
      <PcbKnob key="t" id="vHellDelay" name={V('xHellSync') > 0 ? 'TIME (NOTE)' : 'TIME'} ref_="" lo="" hi="" />,
      <PcbKnob key="f" id="xHellFb" name="FEEDBACK" ref_="" lo="" hi="" />,
      <PcbKnob key="s" id="xHellShift" name="SHIFT" ref_="" lo="−" hi="+" />,
    ],
    [<PcbToggle key="y" id="vHellSync" name="SYNC" ref_="" w={76} />, <PcbRotary key="r" id="xHellRange" name="RANGE" ref_="" w={104} />, <PcbToggle key="c" id="xHellCross" name="CROSS" ref_="" w={76} />],
  ],
  warp: () => [[<PcbKnob key="d" id="xHellWarp" name="DEPTH" ref_="" lo="0" hi="12 ST" />, <PcbRotary key="r" id="xHellWarpRate" name="RATE" ref_="" w={120} />, <PcbRotary key="s" id="xHellWarpShape" name="SHAPE" ref_="" w={126} />]],
  spin: () => [
    [<PcbKnob key="a" id="xHellSpin" name="SPIN" ref_="" lo="" hi="" />, <PcbRotary key="r" id="xHellSpinRate" name="RATE" ref_="" w={112} />, <PcbKnob key="d" id="xHellDrunk" name="DRUNK" ref_="" lo="" hi="" fine />],
    [<PcbKnob key="w" id="xHellSweep" name="SWEEP" ref_="" lo="" hi="" fine />],
  ],
  shatter: () => [[<PcbKnob key="a" id="xHellShatter" name="GRAINS" ref_="" lo="" hi="" />, <PcbRotary key="s" id="xHellShatterSize" name="SIZE" ref_="" w={112} />, <PcbKnob key="p" id="xHellShatterSpray" name="SPRAY" ref_="" lo="" hi="" fine />]],
  chop: () => [
    [<PcbKnob key="a" id="xHellChop" name="CHOP" ref_="" lo="" hi="" />, <PcbRotary key="g" id="xHellChopGrid" name="GRID" ref_="" w={120} />],
    [<PcbKnob key="p" id="xHellChopPitch" name="PITCH" ref_="" lo="" hi="" fine />, <PcbKnob key="t" id="xHellChopGate" name="GATE" ref_="" lo="" hi="" fine />],
  ],
  metal: () => [
    [<PcbKnob key="r" id="xHellRing" name="RING" ref_="" lo="" hi="" />, <PcbSelect key="t" id="xHellRingTune" name="TUNE" ref_="" w={104} cols={2} />],
    [<PcbKnob key="c" id="xHellComb" name="COMB" ref_="" lo="" hi="" />, <PcbSelect key="s" id="xHellCombSeq" name="SEQ" ref_="" w={104} cols={2} />],
  ],
};

const RH = 88;
const blockH = (id: Circle['id']): number => 22 + Pieces[id]().length * RH + 14;

/** Le cadre d'un cercle : son numero, son nom, sa LED (allumee quand MIX le fait entrer), ce qu'il fait. */
const CircleBlock: React.FC<{ id: Circle['id']; x: number; y: number; w: number; flash?: boolean }> = ({ id, x, y, w, flash }) => {
  useExtraAll();
  const c = C(id);
  const rows = Pieces[id]();
  const d = depthOf(c);
  return (
    <PcbFrame title={`${c.n} · ${c.name}`} x={x} y={y} w={w} h={blockH(id)} led={d > 0.02} flash={flash} className="mm-hell-frame mm-h2-circle">
      {rows.map((r, i) => (
        <Row key={i} top={22 + i * RH} w={w}>
          {r}
        </Row>
      ))}
      <span className="mm-h2-verb">{c.verb}</span>
    </PcbFrame>
  );
};

/* ---------------- la page ---------------- */

const Z = { x: 44, w: 1012 };
const G = 12;

export const HellPage2: React.FC<{ flash: (title: string) => boolean }> = ({ flash }) => {
  useExtraAll();
  const SW = 344;
  const CX = Z.x + SW + 16;
  const CW = Z.w - 2 * SW - 32;
  const VS = CW;
  const hero = Math.round(52 * 1.7);
  const left: Circle['id'][] = ['echo', 'warp', 'spin'];
  const right: Circle['id'][] = ['shatter', 'chop', 'metal'];
  const col = (ids: Circle['id'][], x: number): React.ReactNode[] => {
    let y = 60;
    return ids.map((id) => {
      const at = y;
      y += blockH(id) + G;
      return <CircleBlock key={id} id={id} x={x} y={at} w={SW} flash={id === 'echo' ? flash('HELL DELAY') : undefined} />;
    });
  };
  const v2 = isV2();
  const lit = CIRCLES.filter((c) => depthOf(c) > 0.02).length;
  return (
    <>
      {col(left, Z.x)}
      {col(right, Z.x + Z.w - SW)}
      <div className="mm-h2-vplace" style={{ left: CX, top: 62, width: VS, height: VS }}>
        <Vortex size={VS} />
        <div className="mm-h2-mixhero" style={{ left: VS / 2 - 60, top: VS / 2 - hero / 2 }}>
          <PcbKnob id="xHellMix" name="" ref_="" lo="" hi="" hero={1.7} />
        </div>
      </div>
      <div className="mm-h2-mixlab" style={{ left: CX, top: 62 + VS + 2, width: CW }}>
        <b>MIX</b>
        <span>{v2 ? `DESCENT ${Math.round(V('xHellMix') * 100)} % · ${lit} OF 6 CIRCLES` : 'V2 OFF · THE OLD HELL OF THIS PROJECT'}</span>
      </div>
      <PcbFrame title="HELL" x={CX} y={62 + VS + 40} w={CW} h={640 - (62 + VS + 40)} flash={flash('HELL')} led={V('xHellMix') > 0} className="mm-hell-frame">
        <Row top={18} w={CW}>
          <PcbStep id="xHellDescent" name="MIX MODE" ref_="" w={84} />
          <PcbStep id="xHellV2" name="V2" ref_="" w={84} />
        </Row>
        <PresetBox style={{ top: 112 }} />
      </PcbFrame>
    </>
  );
};
