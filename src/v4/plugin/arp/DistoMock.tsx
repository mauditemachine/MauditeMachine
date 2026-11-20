/**
 * DISTO v44, MAQUETTES (2026-11-20, phase maquette : rien n'est publie). Mika, sur la page DISTO : "ya surement des choses
 * inutiles la dedans ... je trouve ca vraiment trop complexe le multibande bof.. peut etre mettre un EQ a la place ... je
 * veux qu'un seul EQ ... Le bouton punish doit etre plus imposant.. il doit faire mal celui la !" ; sur les touches STYLE :
 * "tout ca devrait etre mieux place ou combine par famille dans les presets de la disto !".
 *
 * Trois propositions de la meme page, sur les MEMES parametres de l'hote (aucun n'est ajoute ni retire) :
 * - A : en trois rangees, la plus proche d'aujourd'hui ; PUNISH en grosse touche carree ; STYLE en quatre lignes de
 *   familles ; les presets en liste ouverte, rangee par famille.
 * - B : PUNISH au centre, en interrupteur rouge a capot ; DRIVE en tres gros ; STYLE en onglets de familles.
 * - C : les familles SONT les presets (quatre colonnes : les styles de la famille, puis ses presets) ; PUNISH en
 *   champignon rouge.
 * Commun aux trois : un seul EQ graphique (LOW CUT, TONE, HIGH CUT, PRE, POST, la caisse) a la place des sept cadres de
 * filtres ; le multibande remplace par CLEAN LOW (le grave propre, tire sur le graphe) ; MOVE reduit ; MORPH, DYNAMICS,
 * FEEDBACK, ENV SPEED, LFO SHAPE et le multibande complet caches (gardes, les presets s'en servent ; un projet qui a
 * le multibande complet le voit ecrit, avec RESET).
 *
 * Montee seulement par ?distoMock=A|B|C dans l'URL (jamais dans le plugin) ; ?distoDemo=<preset> charge un preset de la
 * banque proposee (distoBank.ts) au montage, pour les captures (Chromium muet).
 */
import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { voyParams } from '../../voyager/params';
import { DISTO_STYLES } from './disto';
import { DISTO_BANK, DISTO_FAMILIES, familyOf, type DistoBankPreset, type DistoFamilyId } from './distoBank';
import { arpExtra } from './extra';
import { arpMod } from './modview';
import { PcbFrame, PcbKey, PcbKnob, PcbRotary, PcbSelect, PcbToggle, registerVirtual, say, SRC } from './pcbui';
import './disto2.css';

export type DistoMockId = 'A' | 'B' | 'C';

/** ?distoMock=A|B|C (les captures de la maquette) ; null partout ailleurs, et toujours dans le plugin. */
export const DISTO_MOCK: DistoMockId | null = (() => {
  if (typeof location === 'undefined') return null;
  const m = /[?&]distoMock=([ABC])\b/.exec(location.search);
  return m ? (m[1] as DistoMockId) : null;
})();

const useExtraAll = () => useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
const useVoy = () => useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
const X = (id: string): number => arpExtra.of(id);
const NST = DISTO_STYLES.length;
const styleNow = (): string => DISTO_STYLES[Math.max(0, Math.min(NST - 1, Math.round(X('xDStyle') * (NST - 1))))];
const setStyle = (st: string): void => {
  arpExtra.set('xDStyle', DISTO_STYLES.indexOf(st) / (NST - 1));
};
const clamp01 = (v: number): number => Math.min(1, Math.max(0, v));

/* ---------------- la banque proposee ---------------- */

const BANK_KEYS = Object.keys(DISTO_BANK[0].v);
const cur = (k: string): number => (k === 'dist' ? voyParams.of('dist') : X(k));
function bankCurrent(): DistoBankPreset | null {
  return DISTO_BANK.find((p) => BANK_KEYS.every((k) => Math.abs(cur(k) - (p.v[k] ?? 0)) < 0.0015)) ?? null;
}
function bankLoad(p: DistoBankPreset): void {
  for (const [k, x] of Object.entries(p.v)) {
    if (k === 'dist') voyParams.set('dist', x);
    else arpExtra.set(k, x);
  }
}
let lastBank = -1;
function bankStep(d: 1 | -1): void {
  const c = bankCurrent();
  const i = c ? DISTO_BANK.indexOf(c) : lastBank;
  const n = DISTO_BANK.length;
  const p = DISTO_BANK[i < 0 ? (d > 0 ? 0 : n - 1) : (i + d + n) % n];
  lastBank = DISTO_BANK.indexOf(p);
  bankLoad(p);
}

/* ---------------- CLEAN LOW : le multibande reduit a un geste (2 bandes, la basse contournee) ---------------- */

const near = (a: number, b: number): boolean => Math.abs(a - b) < 0.0015;
const BAND_DEF: Readonly<Record<string, number>> = { Style: 0, Drive: 0.5, Mix: 1, Level: 0.5, Solo: 0, Byp: 0 };
const cleanOn = (): boolean => near(X('xDBands'), 0.5) && X('xDB1Byp') >= 0.5;
/** Le multibande complet d'un projet d'avant (plus que CLEAN LOW) : ecrit sur l'EQ, avec RESET. */
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
const multiReset = (): void => {
  arpExtra.set('xDBands', 0);
  for (const b of [1, 2, 3]) for (const [k, d] of Object.entries(BAND_DEF)) arpExtra.set(`xDB${b}${k}`, d);
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

/* ---------------- les lois (Decap.cpp) et la reponse de chaque point ---------------- */

const lowHz = (v: number): number => (v < 0.02 ? 0 : 20 * Math.pow(50, (v - 0.02) / 0.98));
const highHz = (v: number): number => (v > 0.98 ? 0 : 1000 * Math.pow(20, v / 0.98));
const filtHz = (v: number): number => 20 * Math.pow(1000, clamp01(v));
const resoQ = (v: number): number => 0.7071 * Math.pow(16, clamp01(v));
const xLoHz = (v: number): number => 40 * Math.pow(25, clamp01(v));
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
 * zone CLEAN LOW a gauche, sa poignee se tire.
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
  const old = multiOld();
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
        return lc > 0 ? `LOW CUT · ${fmt(lc)} · 12 DB/OCT${X('xDThump') >= 0.5 ? ' · THUMP' : ''}` : 'LOW CUT · OFF';
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
      {old && (
        <div className="mm-eq-old mm-d2-old">
          <span className="mm-eq-old-t">MULTIBAND ON</span>
          <button type="button" className="mm-eq-old-k" onClick={multiReset} title="This project still uses the old 3 band DISTO">
            RESET
          </button>
        </div>
      )}
    </div>
  );
};

/** Les touches des points (comme BAND 1 a 6 de SOUND) et les reglages du point choisi ; la caisse au bout. */
const EqControls: React.FC<{ w: number; compact?: boolean }> = ({ w, compact }) => {
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
    <div className="mm-d2-eqctl" style={{ width: w }} data-compact={compact ? '1' : undefined}>
      <div className="mm-d2-eqkeys">
        {keys.map(([id, on]) => (
          <PcbKey key={id} name={id === 'CLEAN' ? 'CLEAN LOW' : NODE_NAME[id]} w={compact ? 34 : 40} h={14} on={sel === id} className={on ? 'mm-d2-lit' : undefined} onClick={() => selStore.set(id)} aria-label={`DISTO EQ ${id}`} />
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

/* ---------------- PUNISH : trois formes ---------------- */

const useAtt = (): number => useSyncExternalStore(arpMod.subscribe, () => arpMod.of('distoVu')?.v ?? 0);

/** key : la grosse touche carree ; switch : l'interrupteur a capot rouge ; dome : le champignon rouge. */
const Punish: React.FC<{ kind: 'key' | 'switch' | 'dome'; w: number; h: number }> = ({ kind, w, h }) => {
  useExtraAll();
  const on = X('xDPunish') >= 0.5;
  const att = useAtt();
  const flip = (): void => {
    arpExtra.set('xDPunish', on ? 0 : 1);
  };
  return (
    <button
      type="button"
      className="mm-d2-pun"
      data-kind={kind}
      data-on={on ? '1' : undefined}
      role="switch"
      aria-checked={on}
      aria-label="DISTO PUNISH"
      onClick={flip}
      style={{ width: w, height: h, ['--att' as string]: on ? 0.55 + 0.45 * att : 0 }}
    >
      <span className="mm-d2-pun-halo" aria-hidden="true" />
      {kind === 'key' && (
        <>
          <i className="mm-d2-pun-led" aria-hidden="true" />
          <span className="mm-d2-pun-cap" aria-hidden="true">
            <b>PUNISH</b>
          </span>
          <span className="mm-d2-pun-sub" aria-hidden="true">
            +20 DB · HURTS
          </span>
        </>
      )}
      {kind === 'switch' && (
        <>
          <span className="mm-d2-sw-plate" aria-hidden="true">
            <i className="s1" />
            <i className="s2" />
            <i className="s3" />
            <i className="s4" />
            <span className="mm-d2-sw-slot" />
            <span className="mm-d2-sw-bat" />
            <span className="mm-d2-sw-cover" />
          </span>
          <span className="mm-d2-pun-sub" aria-hidden="true">
            <i className="mm-d2-pun-led" />
            PUNISH
          </span>
        </>
      )}
      {kind === 'dome' && (
        <>
          <span className="mm-d2-dome-bezel" aria-hidden="true">
            <svg viewBox="0 0 100 100">
              <defs>
                <path id="mm-d2-ring" d="M50 50 m-41 0 a41 41 0 1 1 82 0 a41 41 0 1 1 -82 0" />
              </defs>
              <text>
                <textPath href="#mm-d2-ring" startOffset="0">
                  PUNISH · +20 DB · PUNISH · +20 DB ·
                </textPath>
              </text>
            </svg>
            <span className="mm-d2-dome" />
          </span>
        </>
      )}
    </button>
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
const MmKey: React.FC<{ w: number; h: number; label?: string }> = ({ w, h, label = 'ENGINE' }) => {
  const on = styleNow() === 'MM';
  return (
    <PcbKey
      name={label}
      cap={
        <span className="mm-d2-capt">
          <b className="mm-d2-letter">MM</b>
          {label}
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

/** A : quatre lignes, une par famille (son nom, ce qu'elle fait), ses trois styles. */
const FamilyRows: React.FC = () => {
  useExtraAll();
  const fam = familyOf(styleNow());
  return (
    <div className="mm-d2-famrows">
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

/** B : quatre onglets de familles, puis les trois styles de celle du moment, en grand. */
const FamilyTabs: React.FC<{ w: number }> = ({ w }) => {
  useExtraAll();
  const st = styleNow();
  const fam = familyOf(st);
  const [shown, setShown] = useState<DistoFamilyId>(fam ?? 'TUBE');
  useEffect(() => {
    if (fam) setShown(fam);
  }, [fam]);
  const f = DISTO_FAMILIES.find((x) => x.id === shown) ?? DISTO_FAMILIES[0];
  const long = f.styles.find((s) => s.st === st)?.long ?? (st === 'MM' ? 'MM: the engine overdrive, the sound of the site (the default)' : '');
  return (
    <div className="mm-d2-famtabs" style={{ width: w }}>
      <div className="mm-d2-tabs">
        {DISTO_FAMILIES.map((x) => (
          <button key={x.id} type="button" className="mm-d2-tab" data-on={shown === x.id ? '1' : undefined} data-has={fam === x.id ? '1' : undefined} onClick={() => setShown(x.id)}>
            <b>{FAM_NAME[x.id]}</b>
            <i>{x.feel}</i>
          </button>
        ))}
      </div>
      <div className="mm-d2-tabkeys">
        {f.styles.map((s) => (
          <StyleKey key={s.st} {...s} w={76} h={30} />
        ))}
      </div>
      <p className="mm-d2-long">{long}</p>
      <div className="mm-d2-tabmm">
        <MmKey w={118} h={20} label="ENGINE (OFF)" />
      </div>
    </div>
  );
};

/* ---------------- PRESETS ---------------- */

/** A : la liste ouverte, rangee par famille ; PREV, NEXT, INIT. */
const PresetList: React.FC<{ h: number }> = ({ h }) => {
  useExtraAll();
  useVoy();
  const c = bankCurrent();
  return (
    <div className="mm-d2-plist" style={{ height: h }}>
      <div className="mm-d2-pscroll">
        {DISTO_FAMILIES.map((f) => (
          <div key={f.id} className="mm-d2-pgroup">
            <span className="mm-d2-pfam">{FAM_NAME[f.id]}</span>
            {DISTO_BANK.filter((p) => p.family === f.id).map((p) => (
              <button key={p.name} type="button" className="mm-d2-pitem" data-on={c?.name === p.name ? '1' : undefined} onClick={() => bankLoad(p)} title={`${p.recipe}\n${p.desc}`}>
                <span>{String(DISTO_BANK.indexOf(p) + 1).padStart(2, '0')}</span>
                {p.name}
                {p.u.punish && <i className="mm-d2-pdot" title="PUNISH" />}
              </button>
            ))}
          </div>
        ))}
      </div>
      <div className="mm-d2-pkeys">
        <PcbKey name="PREV" w={34} h={15} onClick={() => bankStep(-1)} />
        <PcbKey name="NEXT" w={34} h={15} onClick={() => bankStep(1)} />
        <PcbKey name="INIT" w={34} h={15} onClick={() => bankLoad(DISTO_BANK[0])} />
      </div>
    </div>
  );
};

/** B : la fenetre (le preset du moment, sa recette), PREV / NEXT dans la famille. */
const PresetWindow: React.FC<{ w: number }> = ({ w }) => {
  useExtraAll();
  useVoy();
  const c = bankCurrent();
  const fam = c?.family ?? familyOf(styleNow());
  const inFam = DISTO_BANK.filter((p) => p.family === fam);
  const step = (d: 1 | -1): void => {
    if (!inFam.length) return bankStep(d);
    const i = c ? inFam.indexOf(c) : -1;
    bankLoad(inFam[(i + d + inFam.length) % inFam.length]);
  };
  return (
    <div className="mm-d2-pwin" style={{ width: w }}>
      <div className="mm-d2-pglass">
        <span className="mm-d2-pnum">{c ? `${fam} · ${inFam.indexOf(c) + 1} / ${inFam.length}` : `${fam ?? '--'} · YOUR SETTING`}</span>
        <b>{c ? c.name : 'YOUR SETTING'}</b>
        <span className="mm-d2-precipe">{c ? c.recipe : 'A preset sets the whole DISTO, DRIVE included.'}</span>
      </div>
      <div className="mm-d2-pkeys">
        <PcbKey name="PREV" w={34} h={15} onClick={() => step(-1)} />
        <PcbKey name="NEXT" w={34} h={15} onClick={() => step(1)} />
        <PcbKey name="ALL" w={34} h={15} onClick={() => bankStep(1)} />
      </div>
    </div>
  );
};

/** C : une colonne par famille : ses trois styles, puis ses presets. */
const FamilyColumn: React.FC<{ f: (typeof DISTO_FAMILIES)[number] }> = ({ f }) => {
  useExtraAll();
  useVoy();
  const c = bankCurrent();
  const fam = familyOf(styleNow());
  return (
    <div className="mm-d2-famcol" data-on={fam === f.id ? '1' : undefined}>
      <span className="mm-d2-feel">{f.feel}</span>
      <div className="mm-d2-colkeys">
        {f.styles.map((s) => (
          <StyleKey key={s.st} {...s} w={64} h={22} />
        ))}
      </div>
      <div className="mm-d2-colpre">
        {DISTO_BANK.filter((p) => p.family === f.id).map((p) => (
          <button key={p.name} type="button" className="mm-d2-pitem" data-on={c?.name === p.name ? '1' : undefined} onClick={() => bankLoad(p)} title={`${p.recipe}\n${p.desc}`}>
            {p.name}
            {p.u.punish && <i className="mm-d2-pdot" title="PUNISH" />}
          </button>
        ))}
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

/** DRIVE en grand : le potard de la face (dist), sa graduation OFF / +36 DB. */
const DriveHero: React.FC<{ k: number; left: number; top: number }> = ({ k, left, top }) => {
  const v = useVoy();
  const box = Math.round(52 * k);
  const mm = styleNow() === 'MM';
  const punish = X('xDPunish') >= 0.5 && !mm;
  const db = 36 * v.dist + (punish ? 20 : 0);
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

const OutputCells: React.FC = () => (
  <>
    <PcbKnob id="xDMix" name="MIX" ref_="" lo="" hi="" fine />
    <PcbKnob id="xDOut" name="OUTPUT" ref_="" lo="-18" hi="+18" />
  </>
);

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

/* ---------------- les trois pages ---------------- */

export interface DistoMockParts {
  Vu: React.FC;
  Transfer: React.FC<{ w: number; h: number }>;
}

/** Au montage : le preset de ?distoDemo= (les captures). */
function useDemo(): void {
  useEffect(() => {
    const m = /[?&]distoDemo=([^&]+)/.exec(location.search);
    if (!m) return;
    const name = decodeURIComponent(m[1]).replace(/\+/g, ' ');
    const p = DISTO_BANK.find((x) => x.name === name);
    if (p) bankLoad(p);
    const sel = /[?&]distoSel=(LC|TONE|HC|PRE|POST|CLEAN)\b/.exec(location.search);
    if (sel) selStore.set(sel[1] as NodeId | 'CLEAN');
  }, []);
}

const PageA: React.FC<{ parts: DistoMockParts }> = ({ parts }) => {
  const { Vu, Transfer } = parts;
  const DR = { x: 44, w: 270 };
  const ST = { x: DR.x + DR.w + 22, w: 320 };
  const OU = { x: ST.x + ST.w + 22, w: 156 };
  const RX = 856;
  const RW = 200;
  const EQ = { x: 44, w: 790 };
  return (
    <>
      <PcbFrame title="DRIVE" x={DR.x} y={60} w={DR.w} h={196} sep className="mm-hell-frame">
        <DriveHero k={1.75} left={0} top={14} />
        <div className="mm-d2-place" style={{ left: 146, top: 26 }}>
          <Punish kind="key" w={108} h={92} />
        </div>
        <div className="mm-dm-place" style={{ left: 12, top: 140 }}>
          <Transfer w={DR.w - 24} h={48} />
        </div>
      </PcbFrame>
      <PcbFrame title="STYLE" x={ST.x} y={60} w={ST.w} h={196} sep className="mm-hell-frame">
        <FamilyRows />
      </PcbFrame>
      <PcbFrame title="OUTPUT" x={OU.x} y={60} w={OU.w} h={196} sep className="mm-hell-frame">
        <Row top={16} w={OU.w}>
          <OutputCells />
        </Row>
        <Row top={104} w={OU.w}>
          <PcbToggle id="xDAuto" name="AUTO" ref_="" />
        </Row>
      </PcbFrame>
      <PcbFrame title="ATTITUDE" x={RX} y={60} w={RW} h={158} className="mm-hell-frame">
        <div className="mm-dm-place" style={{ left: (RW - 172) / 2, top: 24 }}>
          <Vu />
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

const PageB: React.FC<{ parts: DistoMockParts }> = ({ parts }) => {
  const { Vu, Transfer } = parts;
  const ST = { x: 44, w: 300 };
  const DR = { x: ST.x + ST.w + 22, w: 368 };
  const RX = DR.x + DR.w + 22;
  const RW = 1056 - RX;
  const EQ = { x: 44, w: RX - 22 - 44 };
  return (
    <>
      <PcbFrame title="STYLE" x={ST.x} y={60} w={ST.w} h={300} sep className="mm-hell-frame">
        <FamilyTabs w={ST.w} />
      </PcbFrame>
      <PcbFrame title="DRIVE" x={DR.x} y={60} w={DR.w} h={300} sep className="mm-hell-frame mm-d2-hot">
        <DriveHero k={2.5} left={4} top={16} />
        <div className="mm-d2-place" style={{ left: 222, top: 22 }}>
          <Punish kind="switch" w={132} h={190} />
        </div>
        <div className="mm-dm-place" style={{ left: 12, top: 236 }}>
          <Transfer w={DR.w - 24} h={52} />
        </div>
      </PcbFrame>
      <PcbFrame title="ATTITUDE" x={RX} y={60} w={RW} h={170} className="mm-hell-frame">
        <div className="mm-dm-place mm-d2-bigvu" style={{ left: (RW - 172) / 2, top: 22 }}>
          <Vu />
        </div>
      </PcbFrame>
      <PcbFrame title="OUTPUT" x={RX} y={244} w={RW} h={116} className="mm-hell-frame">
        <Row top={14} w={RW}>
          <OutputCells />
          <PcbToggle id="xDAuto" name="AUTO" ref_="" />
        </Row>
      </PcbFrame>
      <PcbFrame title="EQ" x={EQ.x} y={376} w={EQ.w} h={260} sep className="mm-hell-frame">
        <div className="mm-dm-place" style={{ left: 12, top: 20 }}>
          <DistoEq w={EQ.w - 24} h={146} />
        </div>
        <div className="mm-d2-place" style={{ left: 12, top: 172 }}>
          <EqControls w={EQ.w - 24} compact />
        </div>
      </PcbFrame>
      <PcbFrame title="PRESETS" x={RX} y={376} w={RW} h={112} className="mm-hell-frame">
        <PresetWindow w={RW - 24} />
      </PcbFrame>
      <PcbFrame title="MOVE" x={RX} y={502} w={RW} h={134} className="mm-hell-frame mm-d2-move2">
        <Row top={14} w={RW}>
          <PcbKnob id="xDEnvAmt" name="ENV" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDLfoRate" name="LFO" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDLfoAmt" name="DEPTH" ref_="" lo="" hi="" fine />
          <PcbSelect id="xDLfoTarget" name="TARGET" ref_="" w={66} cols={2} up />
        </Row>
      </PcbFrame>
    </>
  );
};

const PageC: React.FC<{ parts: DistoMockParts }> = ({ parts }) => {
  const { Vu, Transfer } = parts;
  const colW = 236;
  const DR = { x: 44, w: 330 };
  const EQ = { x: DR.x + DR.w + 22, w: 460 };
  const RX = EQ.x + EQ.w + 22;
  const RW = 1056 - RX;
  return (
    <>
      {DISTO_FAMILIES.map((f, i) => (
        <PcbFrame key={f.id} title={FAM_NAME[f.id]} x={44 + i * (colW + 22)} y={60} w={colW} h={202} sep={i < 3} className="mm-hell-frame mm-d2-colframe">
          <FamilyColumn f={f} />
        </PcbFrame>
      ))}
      <PcbFrame title="DRIVE" x={DR.x} y={280} w={DR.w} h={356} sep className="mm-hell-frame mm-d2-hot">
        <DriveHero k={2.1} left={2} top={16} />
        <div className="mm-d2-place" style={{ left: 176, top: 30 }}>
          <Punish kind="dome" w={140} h={150} />
        </div>
        <div className="mm-d2-place" style={{ left: 187, top: 198 }}>
          <MmKey w={118} h={20} label="ENGINE (OFF)" />
        </div>
        <div className="mm-dm-place" style={{ left: 12, top: 268 }}>
          <Transfer w={DR.w - 24} h={70} />
        </div>
      </PcbFrame>
      <PcbFrame title="EQ" x={EQ.x} y={280} w={EQ.w} h={240} sep className="mm-hell-frame">
        <div className="mm-dm-place" style={{ left: 12, top: 20 }}>
          <DistoEq w={EQ.w - 24} h={124} />
        </div>
        <div className="mm-d2-place" style={{ left: 12, top: 150 }}>
          <EqControls w={EQ.w - 24} compact />
        </div>
      </PcbFrame>
      <PcbFrame title="MOVE" x={EQ.x} y={536} w={EQ.w} h={100} sep className="mm-hell-frame">
        <Row top={12} w={EQ.w}>
          <PcbKnob id="xDEnvAmt" name="ENV" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDLfoRate" name="LFO" ref_="" lo="" hi="" fine />
          <PcbToggle id="xDLfoSync" name="SYNC" ref_="" w={72} />
          <PcbKnob id="xDLfoAmt" name="DEPTH" ref_="" lo="" hi="" fine />
          <PcbRotary id="xDLfoTarget" name="TARGET" ref_="" w={110} />
        </Row>
      </PcbFrame>
      <PcbFrame title="ATTITUDE" x={RX} y={280} w={RW} h={162} className="mm-hell-frame">
        <div className="mm-dm-place" style={{ left: (RW - 172) / 2, top: 24 }}>
          <Vu />
        </div>
      </PcbFrame>
      <PcbFrame title="OUTPUT" x={RX} y={456} w={RW} h={180} className="mm-hell-frame">
        <Row top={14} w={RW}>
          <OutputCells />
        </Row>
        <Row top={98} w={RW}>
          <PcbToggle id="xDAuto" name="AUTO" ref_="" />
        </Row>
      </PcbFrame>
    </>
  );
};

export const DistoMock: React.FC<{ which: DistoMockId; parts: DistoMockParts }> = ({ which, parts }) => {
  useDemo();
  useExtraAll();
  return which === 'A' ? <PageA parts={parts} /> : which === 'B' ? <PageB parts={parts} /> : <PageC parts={parts} />;
};
