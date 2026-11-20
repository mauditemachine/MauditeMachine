/**
 * La page REVERB du capot (2026-11-16, Mika : "quand on clic sur le knob Reverb on tombe sur une page de configuration
 * pour la reverb avec tous les parametres AINSI QUE la qualite de Strymon BigSky mais au design de MM-ARP").
 *
 * - TYPE : douze touches, les machines dans l'ordre du selecteur du BigSky (skyModel.ts) ; chaque machine garde ses
 *   reglages (sky.ts). CLASSIC (la reverbe d'avant, celle du site) est une touche a part, comme INIT (les reglages de
 *   depart de la machine).
 * - La fenetre de verre noir : le nom de la machine en grand, l'enveloppe de sa queue dessinee (elle suit DECAY,
 *   PRE-DELAY et les reglages qui la sculptent), le reglage touche (nom, valeur).
 * - Les potards du MM-RYTM (PcbKnob) : DECAY (TIME sur NONLINEAR, SIZE sur REFLECTIONS), PRE-DELAY (FEEDBACK sur MAGNETO
 *   et NONLINEAR), TONE, MOD, LOW END ; puis les reglages propres a la machine (cadre "<MACHINE> +"), a crans quand ils en
 *   ont. REVERB : le potard de la face (l'envoi), le meme reglage.
 */

import React, { useSyncExternalStore } from 'react';
import { arpExtra } from './extra';
import { hoodLcd, PcbFrame, PcbKey, PcbKnob, PcbRotary, PcbSelect, PcbStep } from './pcbui';
import { skyInit, skySelect } from './sky';
import {
  bloomLenOf,
  decayOf,
  lateDecayOf,
  preOf,
  RISE_TIMES,
  SKY_FACE,
  SKY_MACHINES,
  SKY_SLOTS,
  skyLabel,
  skyMachineOf,
  skyText,
  skyTypeIndex,
  stepOf,
  tapeTimeOf,
  type SkyMachineDef,
} from './skyModel';

const ZONE = { x: 44, w: 1012 };
const GAP = 22;
const ROW_H = 120;
const CELL = 80;
const ROT_W = 108;

const useExtraAll = () => useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
const useLcd = () => useSyncExternalStore(hoodLcd.subscribe, hoodLcd.get, hoodLcd.get);
const X = (id: string): number => arpExtra.of(id);

/* ---------------- l'enveloppe de la queue ---------------- */

/** L'enveloppe dessinee (0..1) a l'instant t (s) ; dur : la duree montree. */
export function tail(m: SkyMachineDef): { dur: number; at: (t: number) => number; marks: number[] } {
  const p = SKY_SLOTS.map((id) => X(id));
  const fb = m.preLabel === 'FEEDBACK';
  const pre = fb ? 0 : preOf(X('xSkyPre'));
  const T = m.id === 'reflections' ? 0.06 + 0.3 * X('xSkyDecay') : decayOf(m.id, X('xSkyDecay'));
  // la queue en dB, montree sur une courbe (-60 dB en bas)
  const exp = (dt: number, t60: number): number => (dt < 0 ? 0 : Math.max(0, 1 - dt / t60) ** 1.7);
  let dur = Math.min(60, Math.max(0.25, pre + T * 1.05));
  let at: (t: number) => number;
  let marks: number[] = [];
  switch (m.id) {
    case 'swell': {
      const rise = RISE_TIMES[stepOf(p[0], RISE_TIMES.length)];
      dur = Math.max(dur, pre + rise * 2);
      at = (t) => exp(t - pre, T) * Math.min(1, Math.max(0, (t - pre) / rise)) ** 1.5;
      break;
    }
    case 'bloom': {
      const len = bloomLenOf(p[0]) * (4 + 6 * p[1]);
      at = (t) => {
        const d = t - pre;
        if (d < 0) return 0;
        const hump = 1 - Math.exp(-d / (len * 0.45));
        return exp(d, T) * (0.35 + 0.65 * hump);
      };
      break;
    }
    case 'cloud':
      at = (t) => exp(t - pre, T) * Math.min(1, Math.max(0, (t - pre) / 0.25));
      break;
    case 'spring': {
      at = (t) => {
        const d = t - pre;
        return exp(d, T) * (0.78 + 0.22 * Math.cos(2 * Math.PI * d * 9) * Math.exp(-d * 1.5));
      };
      break;
    }
    case 'magneto': {
      const tt = tapeTimeOf(p[3]);
      const g = 0.25 + 0.7 * X('xSkyPre');
      dur = Math.min(30, Math.max(dur, tt * 8));
      marks = Array.from({ length: 24 }, (_, i) => (i + 1) * tt).filter((t) => t < dur);
      at = (t) => {
        const k = t / tt;
        const n = Math.floor(k);
        const echo = n >= 1 ? g ** (n - 1) * Math.exp(-(k - n) * (6 - 4 * p[0])) : 0;
        return Math.max(exp(t, T) * 0.35 * p[0], Math.min(1, echo));
      };
      break;
    }
    case 'nonlinear': {
      const shape = stepOf(p[0], 6);
      const late = lateDecayOf(p[2]);
      const lvl = p[3];
      dur = Math.min(12, T + Math.min(late, 6) * 0.6);
      at = (t) => {
        const x = t / T;
        let e = 0;
        if (x <= 1) {
          switch (shape) {
            case 0: // SWOOSH
              e = Math.sin(Math.PI * Math.min(1, x * 1.6) * 0.5) * (1 - x) ** 0.6;
              break;
            case 1: // REVERSE
              e = x ** 1.5;
              break;
            case 2: // RAMP
              e = 1 - x;
              break;
            case 3: // GATE
              e = x < 0.95 ? 1 : (1 - x) / 0.05;
              break;
            case 4: // GAUSS
              e = Math.exp(-(((x - 0.4) / 0.2) ** 2));
              break;
            default: // BOUNCE
              e = Math.abs(Math.cos(Math.PI * x * 3.5)) * (1 - x);
          }
        }
        const l = t >= T * 0.2 ? lvl * exp(t - T * 0.2, late) : 0;
        return Math.max(e, l);
      };
      break;
    }
    case 'reflections':
      dur = 0.4;
      at = (t) => exp(t, T) * (0.55 + 0.45 * Math.abs(Math.sin(t * 610 + Math.sin(t * 173) * 3)));
      break;
    default:
      at = (t) => exp(t - pre, T);
  }
  // les premieres reflexions des pieces : des traits avant la queue
  if (m.id === 'room' || m.id === 'hall' || m.id === 'chorale') {
    const er = m.id === 'room' ? [0.007, 0.013, 0.019, 0.027, 0.035] : [0.012, 0.021, 0.033, 0.046, 0.06];
    marks = er.map((d) => pre + d);
  }
  return { dur, at, marks };
}

const W = 290;
const H = 104;
const fmtDur = (s: number): string => (s < 1 ? `${Math.round(s * 1000)} MS` : `${s < 10 ? s.toFixed(1) : Math.round(s)} S`);

const Tail: React.FC<{ m: SkyMachineDef }> = ({ m }) => {
  const { dur, at, marks } = tail(m);
  const N = 150;
  const pts: string[] = [];
  for (let i = 0; i <= N; i += 1) {
    const t = (i / N) * dur;
    const y = H - 6 - Math.max(0, Math.min(1, at(t))) * (H - 16);
    pts.push(`${((i / N) * W).toFixed(1)},${y.toFixed(1)}`);
  }
  const line = `M${pts.join(' L')}`;
  const area = `${line} L${W},${H - 6} L0,${H - 6} Z`;
  const shimmer = m.id === 'shimmer';
  const sh = shimmer
    ? `M${Array.from({ length: N + 1 }, (_, i) => {
        const t = (i / N) * dur;
        const y = H - 6 - Math.max(0, Math.min(1, at(t) * (1 - Math.exp(-t / (dur * 0.12))) * (0.4 + 0.6 * X('xSkyP3')))) * (H - 16);
        return `${((i / N) * W).toFixed(1)},${y.toFixed(1)}`;
      }).join(' L')}`
    : null;
  return (
    <svg className="mm-sky-tail" width={W} height={H + 12} viewBox={`0 0 ${W} ${H + 12}`} aria-hidden="true">
      <defs>
        <linearGradient id="mm-sky-fill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" style={{ stopColor: "var(--mm-accent)" }} stopOpacity="0.55" />
          <stop offset="1" style={{ stopColor: "var(--mm-accent)" }} stopOpacity="0.04" />
        </linearGradient>
      </defs>
      <g className="mm-sky-grid">
        {[0.25, 0.5, 0.75].map((f) => (
          <line key={f} x1={W * f} y1={4} x2={W * f} y2={H - 6} />
        ))}
        {[0.33, 0.66].map((f) => (
          <line key={f} x1={0} y1={4 + (H - 10) * f} x2={W} y2={4 + (H - 10) * f} />
        ))}
        <line className="mm-sky-axis" x1={0} y1={H - 6} x2={W} y2={H - 6} />
      </g>
      {marks.map((t) => (
        <line key={t} className="mm-sky-er" x1={(t / dur) * W} x2={(t / dur) * W} y1={H - 6} y2={H - 6 - (m.id === 'magneto' ? at(t + 1e-4) : 0.85 - (t * 4) / dur) * (H - 16)} />
      ))}
      <path d={area} fill="url(#mm-sky-fill)" />
      <path className="mm-sky-line" d={line} />
      {sh && <path className="mm-sky-line2" d={sh} />}
      <text className="mm-sky-t" x={0} y={H + 9} textAnchor="start">
        0
      </text>
      <text className="mm-sky-t" x={W} y={H + 9} textAnchor="end">
        {fmtDur(dur)}
      </text>
    </svg>
  );
};

/* ---------------- la fenetre ---------------- */

const Window: React.FC<{ type: number; x: number; y: number; w: number; h: number }> = ({ type, x, y, w, h }) => {
  const line = useLcd();
  const m = skyMachineOf(type);
  const touched = line && line.name.startsWith('REVERB') ? line : null;
  const summary = m
    ? [`${m.decayLabel} · ${m.preLabel}`, `${skyText(type, 'xSkyDecay', X('xSkyDecay'))} · ${skyText(type, 'xSkyPre', X('xSkyPre'))}`]
    : ['THE REVERB OF THE SITE', 'CONVOLUTION'];
  return (
    <div className="mm-sky-win" style={{ left: x, top: y, width: w, height: h }} role="status" aria-live="polite" data-machine={m ? m.id : 'classic'}>
      <span className="mm-sky-type">{m ? `TYPE ${String(type).padStart(2, '0')} / 12` : 'TYPE CLASSIC'}</span>
      <span className="mm-sky-name">{m ? m.name : 'CLASSIC'}</span>
      <span className="mm-sky-blurb">{m ? m.blurb : 'The convolution reverb of the MM-ARP before the twelve machines, note for note the one of the site.'}</span>
      <span className="mm-sky-touch" data-on={touched ? '1' : undefined}>
        <b>{touched ? touched.name.replace(/^REVERB /, '') : summary[0]}</b>
        <span>{touched ? touched.value : summary[1]}</span>
      </span>
      {m && <Tail m={m} />}
    </div>
  );
};

/* ---------------- les reglages ---------------- */

export type Cell = { k: 'knob' | 'step' | 'rot' | 'sel'; id: string; name: string; lo: string; hi: string; w: number };

/** Les bouts de course d'un potard, courts (ils tiennent sous le potard). */
function endsOf(type: number, id: string): [string, string] {
  const m = skyMachineOf(type);
  const short = (t: string): string => t.replace(/\.0 S$/, ' S').replace(/^(\d+)\.\d+ S$/, '$1 S');
  switch (id) {
    case 'xSkyDecay':
      return m?.id === 'reflections' ? ['SMALL', 'LARGE'] : [short(skyText(type, id, 0)), short(skyText(type, id, 1))];
    case 'xSkyPre':
      return m?.preLabel === 'FEEDBACK' ? ['0', 'MAX'] : ['0', '1 S'];
    case 'xSkyTone':
      return ['DARK', 'FULL'];
    default:
      return [short(skyText(type, id, 0)), short(skyText(type, id, 1))];
  }
}

export const cellOf = (type: number, id: string, n?: number): Cell => {
  const name = skyLabel(type, id) ?? id;
  const [lo, hi] = endsOf(type, id);
  if (!n) return { k: 'knob', id, name, lo, hi, w: CELL };
  // deux crans : le levier (PcbStep -> PcbToggle) ; trois ou quatre : la touche au clic
  if (n === 2) return { k: 'step', id, name, lo, hi, w: 84 };
  if (n <= 4) return { k: 'step', id, name, lo, hi, w: Math.max(CELL, n * 34 + 12) };
  if (n <= 7) return { k: 'rot', id, name, lo, hi, w: ROT_W };
  return { k: 'sel', id, name, lo, hi, w: 92 + 28 };
};

export const CellView: React.FC<{ c: Cell; refN: number }> = ({ c, refN }) => {
  const r = `RV${refN}`;
  switch (c.k) {
    case 'knob':
      return <PcbKnob id={c.id} name={c.name} ref_={r} lo={c.lo} hi={c.hi} />;
    case 'step':
      return <PcbStep id={c.id} name={c.name} ref_={`SW${refN}`} w={c.w} />;
    case 'rot':
      return <PcbRotary id={c.id} name={c.name} ref_={`SW${refN}`} w={ROT_W} />;
    default:
      return <PcbSelect id={c.id} name={c.name} ref_={`SW${refN}`} w={92} cols={3} />;
  }
};

const FrameOf: React.FC<{ title: string; cells: Cell[]; x: number; y: number; sep?: boolean; flash?: boolean; mkey: string }> = ({ title, cells, x, y, sep, flash, mkey }) => (
  <PcbFrame title={title} x={x} y={y} w={cells.reduce((s, c) => s + c.w, 0) + 20} h={ROW_H} sep={sep} flash={flash}>
    <div className="mm-p2-cells">
      {cells.map((c, i) => (
        <CellView key={`${mkey}-${c.id}`} c={c} refN={60 + i} />
      ))}
    </div>
  </PcbFrame>
);

export const frameW = (cells: Cell[]): number => cells.reduce((s, c) => s + c.w, 0) + 20;

/** La page. flash : le cadre a faire clignoter (le clic du potard REVERB de la face). */
export const SkyPage: React.FC<{ flash: (title: string) => boolean }> = ({ flash }) => {
  useExtraAll();
  const type = skyTypeIndex(X('xSkyType'));
  const m = skyMachineOf(type);

  // la rangee du haut : TYPE, la fenetre
  const typeW = 452;
  const winX = ZONE.x + typeW + GAP;
  const winW = ZONE.x + ZONE.w - winX;

  // la rangee du milieu : la machine, ses reglages propres (CLASSIC : ceux de la reverbe d'avant)
  let rowB: { title: string; cells: Cell[] }[];
  if (m) {
    const face = SKY_FACE.map((id) => cellOf(type, id));
    const own = m.slots.map((s, i) => cellOf(type, SKY_SLOTS[i], s.options?.length));
    rowB = [
      { title: m.name, cells: face },
      { title: `${m.name} +`, cells: own },
    ];
  } else {
    rowB = [
      {
        title: 'CLASSIC',
        cells: [
          { k: 'knob', id: 'xRevSize', name: 'SIZE', lo: '0.6 S', hi: '9.6 S', w: CELL },
          { k: 'knob', id: 'xRevTone', name: 'TONE', lo: 'DARK', hi: 'BRIGHT', w: CELL },
          { k: 'knob', id: 'xRevPre', name: 'PRE DELAY', lo: '0', hi: '100 MS', w: CELL },
          { k: 'knob', id: 'xShimmer', name: 'SHIMMER', lo: 'OFF', hi: 'FULL', w: CELL },
        ],
      },
    ];
  }
  const totalB = rowB.reduce((s, f) => s + frameW(f.cells), 0) + GAP * (rowB.length - 1);
  let xb = ZONE.x + Math.round((ZONE.w - totalB) / 2);

  // la rangee du bas : REVERB (l'envoi, le potard de la face), MACHINE (INIT, CLASSIC)
  const mixCells: Cell[] = [{ k: 'knob', id: 'reverb', name: 'MIX', lo: 'DRY', hi: 'WET', w: 104 }];
  const machW = 236;
  const totalC = frameW(mixCells) + GAP + machW;
  const xc = ZONE.x + Math.round((ZONE.w - totalC) / 2);

  return (
    <>
      <PcbFrame title="TYPE" x={ZONE.x} y={66} w={typeW} h={176} flash={flash('TYPE')} className="mm-sky-typef">
        <div className="mm-sky-keys" role="radiogroup" aria-label="Reverb type">
          {SKY_MACHINES.map((mm, i) => (
            <PcbKey key={mm.id} name={mm.name} w={52} h={16} on={type === i + 1} role="radio" aria-checked={type === i + 1} title={mm.blurb} onClick={() => skySelect(i + 1)} />
          ))}
        </div>
      </PcbFrame>
      <Window type={type} x={winX} y={74} w={winW} h={168} />
      {rowB.map((f, i) => {
        const x = xb;
        xb += frameW(f.cells) + GAP;
        return <FrameOf key={`${type}-${f.title}`} mkey={String(type)} title={f.title} cells={f.cells} x={x} y={272} sep={i < rowB.length - 1} />;
      })}
      <PcbFrame title="REVERB" x={xc} y={428} w={frameW(mixCells)} h={ROW_H} flash={flash('REVERB')} sep>
        <div className="mm-p2-cells">
          <PcbKnob id="reverb" name="MIX" ref_="RV4" lo="DRY" hi="WET" big />
        </div>
      </PcbFrame>
      <PcbFrame title="MACHINE" x={xc + frameW(mixCells) + GAP} y={428} w={machW} h={ROW_H}>
        <div className="mm-sky-mkeys">
          <PcbKey name="INIT" w={44} h={22} disabled={!m} title="Back to this machine's starting settings" onClick={() => skyInit()} />
          <PcbKey name="CLASSIC" w={44} h={22} on={!m} title="The reverb of the site (before the twelve machines)" onClick={() => skySelect(0)} />
        </div>
      </PcbFrame>
    </>
  );
};
