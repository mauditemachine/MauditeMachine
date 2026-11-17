/**
 * La page DISTO du capot (2026-11-16, Mika : "quand on clic sur le knob DISTO on tombe sur une page de configuration pour
 * la disto avec tous les parametres AINSI QUE la qualite de Soundtoys Decapitator mais au design de MM-ARP" ; completee le
 * 2026-11-17, v25, la maquette validee : "ok code et publie, masque la pedale avec conversion"). Au design d'OPEN : cuir,
 * potards du MM-RYTM, petits knobs canneles, leviers chromes, touches au clic, verre noir. Le DSP : dsp/Decap.{h,cpp} ;
 * les styles, les presets, la conversion de la pedale et ce qui est grise : disto.ts.
 * - rangee 1, le coeur : DRIVE (le potard DISTO de la face, dist) et PUNISH, l'ecran TRANSFER (la courbe du moment) ; STYLE
 *   (treize touches : MM, l'OVERDRIVE du moteur, le depart ; A E N T P ; TAPE FUZZ DIODE AMP RECT FOLD CRUSH) et MORPH vers
 *   MORPH TO ; OUTPUT (MIX, OUTPUT, AUTO) et la lecture ; le VU ATTITUDE (mm_mod distoVu, du C++) ; les PRESETS ;
 * - rangee 2 : LOW CUT et THUMP, TONE, HIGH CUT et STEEP, DYNAMICS et FEEDBACK ;
 * - rangee 3 : PRE FILTER, BOX, POST FILTER ; a droite le MULTIBANDE (BANDS, les coupures, la bande des frequences, la
 *   matrice : STYLE, DRIVE, MIX, LEVEL, SOLO, BYP par bande) ;
 * - rangee 4, MOVE : ENVELOPE -> DRIVE (AMOUNT, SPEED) et le LFO (SHAPE, RATE, SYNC, AMOUNT, TARGET).
 * La pedale DISTORTION d'avant (xDist, xDistTone) n'est plus nulle part : un projet ou un preset qui l'avait est converti.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { voyParams } from '../../voyager/params';
import { DISTO_CURVES, DISTO_LONG, DISTO_PRESETS, DISTO_STYLES, distoCurrent, distoCurve, distoInert, distoInit, distoLaws, distoLoad, distoStep } from './disto';
import { arpExtra } from './extra';
import { arpMod } from './modview';
import { PcbFrame, PcbKey, PcbKnob, PcbRotary, PcbSelect, PcbStep, PcbToggle } from './pcbui';

const useExtraAll = () => useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
const useVoy = () => useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
const X = (id: string): number => arpExtra.of(id);
const stepIdx = (id: string, n: number): number => Math.max(0, Math.min(n - 1, Math.round(X(id) * (n - 1))));

/* ---------------- l'ecran TRANSFER : la courbe du style, du MORPH et du DRIVE du moment ---------------- */

const TransferGlass: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  useExtraAll();
  const v = useVoy();
  const st = stepIdx('xDStyle', DISTO_STYLES.length);
  const mm = st === 0;
  const drive = v.dist;
  const punish = X('xDPunish') >= 0.5;
  const db = mm ? 20 * Math.log10(1 + 40 * drive * drive) : distoLaws.driveDb(drive, punish);
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
  const main = off ? (x: number) => x : (x: number) => (1 - m) * distoCurve(a, g * x) + m * distoCurve(to, g * x);
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

/** La lecture : le style, le DRIVE, le niveau. */
const ReadGlass: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  useExtraAll();
  const v = useVoy();
  const st = stepIdx('xDStyle', DISTO_STYLES.length);
  const s = DISTO_STYLES[st];
  const m = X('xDMorph');
  const punish = X('xDPunish') >= 0.5 && st > 0;
  const out = distoLaws.outDb(X('xDOut'));
  const outT = Math.abs(out) < 0.05 ? '0.0' : `${out > 0 ? '+' : ''}${out.toFixed(1)}`;
  const rows: [string, string][] = [
    ['STYLE', `${s} · ${DISTO_LONG[s] ?? s}${st > 0 && m > 0 ? ` → ${DISTO_CURVES[stepIdx('xDMorphTo', DISTO_CURVES.length)]} ${Math.round(m * 100)} %` : ''}`],
    ['DRIVE', v.dist <= 0 ? 'OFF' : st === 0 ? `${Math.round(v.dist * 100)} % · ENGINE` : `${Math.round(v.dist * 100)} % · +${Math.round(distoLaws.driveDb(v.dist, punish))} DB${punish ? ' PUNISH' : ''}`],
    ['LEVEL', `${st > 0 && X('xDAuto') >= 0.5 ? 'AUTO' : 'MANUAL'} · ${outT} DB`],
  ];
  return (
    <div className="mm-dm-glass mm-dm-read" style={{ width: w, height: h }} aria-hidden="true">
      {rows.map(([k, val]) => (
        <React.Fragment key={k}>
          <span className="k">{k}</span>
          <span className="v">{val}</span>
        </React.Fragment>
      ))}
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

/* ---------------- les presets ---------------- */

const PresetBox: React.FC = () => {
  useExtraAll();
  useVoy();
  const cur = distoCurrent();
  const [list, setList] = useState(false);
  const n = cur ? DISTO_PRESETS.indexOf(cur) + 1 : 0;
  return (
    <div className="mm-hell-presets mm-dm-presets">
      <button type="button" className="mm-hell-pwin mm-dm-pwin" aria-haspopup="listbox" aria-expanded={list} onClick={() => setList((o) => !o)} title="The DISTO bank">
        <span className="mm-hell-pnum">{cur ? `${String(n).padStart(2, '0')} / ${DISTO_PRESETS.length}` : `-- / ${DISTO_PRESETS.length}`}</span>
        <b>{cur ? cur.name : 'YOUR SETTING'}</b>
        <span className="mm-hell-pdesc">{cur ? cur.desc : 'A preset sets the whole DISTO, DRIVE included.'}</span>
      </button>
      <div className="mm-hell-pkeys">
        <PcbKey name="PREV" w={34} h={16} onClick={() => distoStep(-1)} aria-label="Previous DISTO preset" />
        <PcbKey name="NEXT" w={34} h={16} onClick={() => distoStep(1)} aria-label="Next DISTO preset" />
        <PcbKey name="INIT" w={34} h={16} onClick={() => distoInit()} aria-label="DISTO INIT" />
      </div>
      {list && (
        <ul className="mm-hell-plist mm-dm-plist" role="listbox" aria-label="DISTO presets">
          {DISTO_PRESETS.map((p, i) => (
            <li key={p.name}>
              <button
                type="button"
                role="option"
                aria-selected={cur?.name === p.name}
                data-on={cur?.name === p.name ? '1' : undefined}
                title={p.desc}
                onClick={() => {
                  distoLoad(p);
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

/* ---------------- STYLE : la banque de touches ---------------- */

const StyleBank: React.FC = () => {
  useExtraAll();
  const cur = stepIdx('xDStyle', DISTO_STYLES.length);
  const last = DISTO_STYLES.length - 1;
  const key = (s: string, i: number) => (
    <PcbKey
      key={s}
      name={s}
      w={s.length > 2 ? 34 : 26}
      h={15}
      on={i === cur}
      onClick={() => arpExtra.set('xDStyle', i / last)}
      aria-label={`DISTO STYLE ${DISTO_LONG[s] ?? s}`}
      aria-pressed={i === cur}
      title={DISTO_LONG[s]}
    />
  );
  return (
    <div className="mm-dm-bank" data-x="xDStyle">
      <span className="mm-dm-sub">CLASSIC</span>
      <div className="mm-dm-keys">{DISTO_STYLES.slice(0, 6).map((s, i) => key(s, i))}</div>
      <span className="mm-dm-sub">EXTENDED</span>
      <div className="mm-dm-keys">{DISTO_STYLES.slice(6).map((s, i) => key(s, i + 6))}</div>
    </div>
  );
};

/* ---------------- MULTIBANDE ---------------- */

const BandStrip: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  useExtraAll();
  const nb = 1 + stepIdx('xDBands', 3);
  const fx = (f: number): number => 6 + (Math.log10(f / 20) / 3) * (w - 12);
  const lo = distoLaws.xLoHz(X('xDXLo'));
  const hi = Math.max(distoLaws.xHiHz(X('xDXHi')), 1.5 * lo);
  const edges = nb === 1 ? [20, 20000] : nb === 2 ? [20, lo, 20000] : [20, lo, hi, 20000];
  const names = nb === 1 ? ['FULL BAND'] : nb === 2 ? ['LOW', 'MID'] : ['LOW', 'MID', 'HIGH'];
  // la hauteur : le DRIVE de la bande (autour du DRIVE de la page), 0 si contournee
  const height = (b: number): number => {
    if (nb === 1) return 0.5;
    if (X(`xDB${b + 1}Byp`) >= 0.5) return 0.05;
    return Math.max(0.05, Math.min(1, 0.5 + (X(`xDB${b + 1}Drive`) - 0.5)));
  };
  const fmt = (f: number): string => (f >= 1000 ? `${(f / 1000).toFixed(1)}K` : `${Math.round(f)}`);
  return (
    <div className="mm-dm-glass mm-dm-bands" style={{ width: w, height: h }} aria-hidden="true">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {names.map((n, b) => {
          const x0 = fx(edges[b]);
          const x1 = fx(edges[b + 1]);
          const hb = height(b) * (h - 12);
          return (
            <g key={n}>
              <rect x={x0} y={h - 4 - hb} width={x1 - x0} height={hb} className="fill" />
              <text x={(x0 + x1) / 2} y={11} textAnchor="middle">
                {n}
              </text>
            </g>
          );
        })}
        {edges.slice(1, -1).map((f) => (
          <g key={f}>
            <path className="xo" d={`M${fx(f).toFixed(1)} 3V${h - 3}`} />
            <text x={fx(f) + 3} y={h - 5} className="hot">
              {fmt(f)}
            </text>
          </g>
        ))}
      </svg>
    </div>
  );
};

const BandKey: React.FC<{ id: string; label: string }> = ({ id, label }) => {
  useExtraAll();
  const on = X(id) >= 0.5;
  return <PcbKey name="" w={20} h={12} on={on} onClick={() => arpExtra.set(id, on ? 0 : 1)} aria-label={label} aria-pressed={on} />;
};

const BANDS = [
  { n: 'LOW', b: 1 },
  { n: 'MID', b: 2 },
  { n: 'HIGH', b: 3 },
];

const Multiband: React.FC<{ w: number }> = ({ w }) => {
  useExtraAll();
  return (
    <>
      <div className="mm-p2-cells mm-hell-row" style={{ top: 16, width: w }}>
        <PcbStep id="xDBands" name="BANDS" ref_="" w={104} />
        <PcbKnob id="xDXLo" name="LOW / MID" ref_="" lo="" hi="" fine />
        <PcbKnob id="xDXHi" name="MID / HIGH" ref_="" lo="" hi="" fine />
      </div>
      <div className="mm-dm-place" style={{ top: 98, left: 14 }}>
        <BandStrip w={w - 28} h={30} />
      </div>
      <div className="mm-dm-mx" style={{ top: 134, left: 10, width: w - 20 }}>
        <span className="mm-dm-mx-h" />
        <span className="mm-dm-mx-h">STYLE</span>
        <span className="mm-dm-mx-h">DRIVE</span>
        <span className="mm-dm-mx-h">MIX</span>
        <span className="mm-dm-mx-h">LEVEL</span>
        <span className="mm-dm-mx-h">SOLO</span>
        <span className="mm-dm-mx-h">BYP</span>
        {BANDS.map(({ n, b }) => {
          const k = `xDB${b}`;
          const dim = distoInert(`${k}Style`);
          return (
            <React.Fragment key={n}>
              <span className="mm-dm-mx-n" data-inert={dim ? '1' : undefined}>
                {n}
              </span>
              <span className="mm-dm-mx-c" data-x={`${k}Style`} data-inert={dim ? '1' : undefined}>
                <PcbSelect id={`${k}Style`} name="" ref_="" w={62} bare cols={2} up />
              </span>
              {(['Drive', 'Mix', 'Level'] as const).map((p) => (
                <span key={p} className="mm-dm-mx-c mm-dm-mk">
                  <PcbKnob id={`${k}${p}`} name="" ref_="" lo="" hi="" small />
                </span>
              ))}
              <span className="mm-dm-mx-c" data-x={`${k}Solo`} data-inert={dim ? '1' : undefined}>
                <BandKey id={`${k}Solo`} label={`DISTO ${n} SOLO`} />
              </span>
              <span className="mm-dm-mx-c" data-x={`${k}Byp`} data-inert={dim ? '1' : undefined}>
                <BandKey id={`${k}Byp`} label={`DISTO ${n} BYPASS`} />
              </span>
            </React.Fragment>
          );
        })}
      </div>
    </>
  );
};

/* ---------------- la page ---------------- */

const Row: React.FC<{ top: number; left?: number; w: number; children: React.ReactNode }> = ({ top, left, w, children }) => (
  <div className="mm-p2-cells mm-hell-row" style={{ top, left: left ?? undefined, width: w }}>
    {children}
  </div>
);

export const DistoPage: React.FC<{ flash: (title: string) => boolean }> = ({ flash }) => {
  useExtraAll();
  const v = useVoy();
  const mm = stepIdx('xDStyle', DISTO_STYLES.length) === 0;
  const lfoSync = X('xDLfoSync') >= 0.5;
  const X0 = 44;
  const L = 790;
  const RX = X0 + L + 22;
  const RW = 1056 - RX;
  const DR = { x: X0, w: 210 };
  const ST = { x: DR.x + DR.w + 22, w: 316 };
  const OU = { x: ST.x + ST.w + 22, w: 220 };
  const LC = { x: X0, w: 176 };
  const TO = { x: LC.x + LC.w + 22, w: 92 };
  const HC = { x: TO.x + TO.w + 22, w: 176 };
  const DY = { x: HC.x + HC.w + 22, w: X0 + L - (HC.x + HC.w + 22) };
  const PR = { x: X0, w: 206 };
  const BX = { x: PR.x + PR.w + 22, w: 204 };
  const PO = { x: BX.x + BX.w + 22, w: 206 };
  const MB = { x: PO.x + PO.w + 22, w: 1056 - (PO.x + PO.w + 22) };
  const MV = { x: X0, w: PO.x + PO.w - X0 };
  return (
    <>
      {/* rangee 1 : le coeur */}
      <PcbFrame title="DRIVE" x={DR.x} y={60} w={DR.w} h={186} led={v.dist > 0} flash={flash('DRIVE')} sep className="mm-hell-frame">
        <Row top={16} w={DR.w}>
          <PcbKnob id="dist" name="DRIVE" ref_="" lo="OFF" hi={mm ? 'ENGINE' : '+36 DB'} big />
          <PcbToggle id="xDPunish" name="PUNISH" ref_="" />
        </Row>
        <div className="mm-dm-place" style={{ left: 12, top: 122 }}>
          <TransferGlass w={DR.w - 24} h={56} />
        </div>
      </PcbFrame>
      <PcbFrame title="STYLE" x={ST.x} y={60} w={ST.w} h={186} sep className="mm-hell-frame">
        <StyleBank />
        <Row top={118} left={40} w={ST.w - 80}>
          <PcbKnob id="xDMorph" name="MORPH" ref_="" lo="" hi="" fine />
          <PcbSelect id="xDMorphTo" name="MORPH TO" ref_="" w={76} cols={3} />
        </Row>
      </PcbFrame>
      <PcbFrame title="OUTPUT" x={OU.x} y={60} w={OU.w} h={186} sep className="mm-hell-frame">
        <Row top={16} w={OU.w}>
          <PcbKnob id="xDMix" name="MIX" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDOut" name="OUTPUT" ref_="" lo="-18" hi="+18" />
          <PcbToggle id="xDAuto" name="AUTO" ref_="" />
        </Row>
        <div className="mm-dm-place" style={{ left: 12, top: 122 }}>
          <ReadGlass w={OU.w - 24} h={56} />
        </div>
      </PcbFrame>
      <PcbFrame title="ATTITUDE" x={RX} y={60} w={RW} h={158} className="mm-hell-frame">
        <div className="mm-dm-place" style={{ left: (RW - 172) / 2, top: 24 }}>
          <AttitudeVu />
        </div>
      </PcbFrame>
      <PcbFrame title="PRESETS" x={RX} y={232} w={RW} h={136} className="mm-hell-frame">
        <PresetBox />
      </PcbFrame>

      {/* rangee 2 : le ton et la dynamique */}
      <PcbFrame title="LOW CUT" x={LC.x} y={262} w={LC.w} h={106} sep className="mm-hell-frame">
        <Row top={14} w={LC.w}>
          <PcbKnob id="xDLow" name="LOW CUT" ref_="" lo="OFF" hi="1 KHZ" />
          <PcbToggle id="xDThump" name="THUMP" ref_="" />
        </Row>
      </PcbFrame>
      <PcbFrame title="TONE" x={TO.x} y={262} w={TO.w} h={106} sep className="mm-hell-frame">
        <Row top={14} w={TO.w}>
          <PcbKnob id="xDTone" name="TONE" ref_="" lo="DARK" hi="BRIGHT" />
        </Row>
      </PcbFrame>
      <PcbFrame title="HIGH CUT" x={HC.x} y={262} w={HC.w} h={106} sep className="mm-hell-frame">
        <Row top={14} w={HC.w}>
          <PcbKnob id="xDHigh" name="HIGH CUT" ref_="" lo="1 KHZ" hi="OFF" />
          <PcbToggle id="xDSteep" name="STEEP" ref_="" />
        </Row>
      </PcbFrame>
      <PcbFrame title="DYNAMICS · FEEDBACK" x={DY.x} y={262} w={DY.w} h={106} sep className="mm-hell-frame">
        <Row top={14} w={DY.w}>
          <PcbKnob id="xDDyn" name="DYNAMICS" ref_="" lo="COMP" hi="EXPAND" />
          <PcbKnob id="xDFb" name="FEEDBACK" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDFbFreq" name="FB FREQ" ref_="" lo="" hi="" fine />
        </Row>
      </PcbFrame>

      {/* rangee 3 : avant, la caisse, apres ; le multibande */}
      <PcbFrame title="PRE FILTER" x={PR.x} y={384} w={PR.w} h={108} sep className="mm-hell-frame">
        <Row top={14} w={PR.w}>
          <PcbRotary id="xDPreMode" name="MODE" ref_="" w={96} />
          <PcbKnob id="xDPreFreq" name="FREQ" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDPreReso" name="RESO" ref_="" lo="" hi="" fine />
        </Row>
      </PcbFrame>
      <PcbFrame title="BOX" x={BX.x} y={384} w={BX.w} h={108} sep className="mm-hell-frame">
        <Row top={14} w={BX.w}>
          <PcbRotary id="xDBox" name="CABINET" ref_="" w={96} />
          <PcbKnob id="xDBoxSize" name="SIZE" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDBoxMix" name="MIX" ref_="" lo="" hi="" fine />
        </Row>
      </PcbFrame>
      <PcbFrame title="POST FILTER" x={PO.x} y={384} w={PO.w} h={108} sep className="mm-hell-frame">
        <Row top={14} w={PO.w}>
          <PcbRotary id="xDPostMode" name="MODE" ref_="" w={96} />
          <PcbKnob id="xDPostFreq" name="FREQ" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDPostReso" name="RESO" ref_="" lo="" hi="" fine />
        </Row>
      </PcbFrame>
      <PcbFrame title="MULTIBAND" x={MB.x} y={384} w={MB.w} h={252} className="mm-hell-frame">
        <Multiband w={MB.w} />
      </PcbFrame>

      {/* rangee 4 : le mouvement */}
      <PcbFrame title="MOVE" x={MV.x} y={506} w={MV.w} h={130} sep className="mm-hell-frame">
        <span className="mm-dm-group" style={{ left: 18, width: 132, top: 16 }}>
          ENVELOPE → DRIVE
        </span>
        <span className="mm-dm-group" style={{ left: 172, width: 470, top: 16 }}>
          LFO
        </span>
        <Row top={30} left={18} w={640}>
          <PcbKnob id="xDEnvAmt" name="AMOUNT" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDEnvSpd" name="SPEED" ref_="" lo="" hi="" fine />
          <span className="mm-dm-vsep" />
          <PcbRotary id="xDLfoShape" name="SHAPE" ref_="" w={110} />
          <PcbKnob id="xDLfoRate" name={lfoSync ? 'RATE (NOTE)' : 'RATE'} ref_="" lo="" hi="" fine />
          <PcbToggle id="xDLfoSync" name="SYNC" ref_="" />
          <PcbKnob id="xDLfoAmt" name="AMOUNT" ref_="" lo="" hi="" fine />
          <PcbRotary id="xDLfoTarget" name="TARGET" ref_="" w={124} />
        </Row>
      </PcbFrame>
    </>
  );
};
