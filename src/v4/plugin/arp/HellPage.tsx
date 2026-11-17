/**
 * La page HELL du capot (2026-11-17, Mika : "HELL, c'est l'effet Echobode a la sauce Maudite Machine. Dans la boite HELL,
 * il manque beaucoup de choses, et mets aussi des presets la-dedans"). Les memes reglages qu'Echobode, nos algorithmes
 * (plugin/mm-arp/dsp/Hell.cpp) et le design du MM-ARP (cuir, potards du MM-RYTM, petits knobs fins, leviers, rotatifs) :
 * - DELAY : DELAY (en ms, ou en notes quand SYNC est leve : hell.ts HELL_DELAY), FEEDBACK, les leviers SYNC et CROSS,
 *   HIGH-PASS, LOW-PASS, SMEAR, SPREAD (le canal droit) ;
 * - FREQUENCY SHIFTER : le gros potard en vedette, son echelle (celle de RANGE : FINE -200..-3 0 +3..+200 Hz, WIDE,
 *   SYNC en multiples du tempo, MIDI en part de la note jouee), RANGE (rotatif), ANTI REFL (levier), PHASE, SIDEBAND
 *   (DOWN, R.M., UP) ;
 * - MIX (le meme reglage que le potard HELL de la face : xHellMix) et les presets (une fenetre, le precedent, le suivant,
 *   INIT ; un clic sur la fenetre deroule la banque) ;
 * - LFO : SHAPE, RATE (et son levier SYNC), AMOUNT (bipolaire), STEREO, TARGET, et le VU a aiguille qui montre le LFO
 *   (la valeur vient du C++, mm_mod "hellLfo").
 * Le schema du flux n'y tient plus (il est dans Hell.h).
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { arpExtra } from './extra';
import {
  HELL_DELAY,
  HELL_PRESETS,
  HELL_SYNC_LEVER,
  SYNC_MULT,
  hellCurrent,
  hellInit,
  hellLoad,
  hellShiftV,
  hellStep,
} from './hell';
import { arpMod } from './modview';
import { PcbFrame, PcbKey, PcbKnob, PcbRotary, PcbToggle, registerVirtual } from './pcbui';

registerVirtual('vHellDelay', { ...HELL_DELAY, name: 'HELL DELAY' });
registerVirtual('vHellSync', { ...HELL_SYNC_LEVER, def: () => 0, text: (v) => (v >= 0.5 ? 'SYNC' : 'FREE'), name: 'HELL SYNC' });

const useExtraAll = () => useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
const X = (id: string): number => arpExtra.of(id);
const rangeIdx = (): number => Math.round(X('xHellRange') * 3);

/* ---------------- l'echelle du FREQUENCY SHIFTER ---------------- */

const SWEEP = 135;
const DEAD = 0.03;
/** Les reperes de l'echelle selon RANGE : la valeur 0..1 du potard et le texte. */
function scaleMarks(range: number): { v: number; t: string; major: boolean }[] {
  const both = (vals: { a: number; v: number; t: string }[]): { v: number; t: string; major: boolean }[] => [
    ...vals.map((m) => ({ v: 0.5 - (m.v - 0.5), t: m.t, major: true })),
    { v: 0.5, t: '0', major: true },
    ...vals.map((m) => ({ v: m.v, t: m.t, major: true })),
  ];
  if (range === 0) return both([10, 30, 80, 200].map((hz) => ({ a: hz, v: hellShiftV(hz, 0), t: `${hz}` })));
  if (range === 1) return both([50, 200, 1000, 5000].map((hz) => ({ a: hz, v: hellShiftV(hz, 1), t: hz >= 1000 ? `${hz / 1000}K` : `${hz}` })));
  if (range === 2)
    return both(
      [2, 4, 6, 8].map((i) => {
        const m = SYNC_MULT[i];
        const ax = DEAD + ((1 - DEAD) * (i + 0.5)) / 9;
        return { a: m, v: 0.5 + ax / 2, t: m >= 1 ? `${m}` : `1/${Math.round(1 / m)}` };
      })
    );
  return both(
    [1 / 4, 1 / 2, 1, 2].map((r) => {
      const ax = DEAD + (1 - DEAD) * ((Math.log2(r) + 4) / 5);
      return { a: r, v: 0.5 + ax / 2, t: r >= 1 ? `${r}X` : `1/${Math.round(1 / r)}` };
    })
  );
}

const HERO_K = 2.3;
const ShiftScale: React.FC<{ size: number }> = ({ size }) => {
  useExtraAll();
  const range = rangeIdx();
  const marks = scaleMarks(range);
  const c = size / 2;
  const r0 = 70;
  const r1 = 78;
  const rt = 92;
  const minor = Array.from({ length: 41 }, (_, i) => i / 40);
  const pos = (v: number, r: number): [number, number] => {
    const a = ((-SWEEP + 2 * SWEEP * v) * Math.PI) / 180;
    return [c + Math.sin(a) * r, c - Math.cos(a) * r];
  };
  return (
    <svg className="mm-hell-scale" width={size} height={size} viewBox={`0 0 ${size} ${size}`} aria-hidden="true">
      <circle cx={c} cy={c} r={r1 + 2} className="mm-hell-scale-ring" />
      {minor.map((v) => {
        const [x1, y1] = pos(v, r0 + 3);
        const [x2, y2] = pos(v, r1 - 1);
        return <line key={`m${v}`} x1={x1} y1={y1} x2={x2} y2={y2} className="mm-hell-scale-minor" />;
      })}
      {marks.map((m) => {
        const [x1, y1] = pos(m.v, r0);
        const [x2, y2] = pos(m.v, r1 + 2);
        const [tx, ty] = pos(m.v, rt);
        return (
          <g key={`${m.v}-${m.t}`}>
            <line x1={x1} y1={y1} x2={x2} y2={y2} className="mm-hell-scale-major" />
            <text x={tx} y={ty + 3.5} className="mm-hell-scale-t" data-zero={m.t === '0' ? '1' : undefined}>
              {m.t}
            </text>
          </g>
        );
      })}
      <text x={c - 28} y={c - rt - 8} className="mm-hell-scale-sign">
        −
      </text>
      <text x={c + 28} y={c - rt - 8} className="mm-hell-scale-sign">
        +
      </text>
    </svg>
  );
};

/* ---------------- le VU du LFO ---------------- */

const useHellLfo = (): number | null => useSyncExternalStore(arpMod.subscribe, () => arpMod.of('hellLfo')?.v ?? null);

/** Le VU a aiguille : sa face ivoire, son echelle -/0/+, la vitre, l'aiguille avec un rien d'inertie (comme un vrai). */
export const HellVu: React.FC = () => {
  const target = useHellLfo();
  const [a, setA] = useState(0);
  const st = useRef({ x: 0, v: 0, goal: 0, raf: 0, t: 0 });
  st.current.goal = target === null ? 0 : (target - 0.5) * 2;
  useEffect(() => {
    const s = st.current;
    const step = (now: number): void => {
      const dt = Math.min(0.05, s.t ? (now - s.t) / 1000 : 0.016);
      s.t = now;
      // un second ordre un peu amorti (~0.3 s), l'aiguille bute aux extremes
      const w = 14;
      s.v += (w * w * (s.goal - s.x) - 2 * 0.72 * w * s.v) * dt;
      s.x = Math.max(-1.08, Math.min(1.08, s.x + s.v * dt));
      setA(s.x);
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
  const ticks = Array.from({ length: 21 }, (_, i) => -1 + i / 10);
  const [nx, ny] = arc(a, R - 6);
  return (
    <div className="mm-hell-vu" role="meter" aria-label="HELL LFO" aria-valuemin={-100} aria-valuemax={100} aria-valuenow={Math.round(a * 100)} data-on={target !== null ? '1' : undefined}>
      <div className="mm-hell-vu-face">
        <svg width={W} height={H} viewBox={`0 0 ${W} ${H}`} aria-hidden="true">
          <path d={`M ${arc(-1, R)[0]} ${arc(-1, R)[1]} A ${R} ${R} 0 0 1 ${arc(1, R)[0]} ${arc(1, R)[1]}`} className="mm-hell-vu-arc" />
          <path d={`M ${arc(0.55, R)[0]} ${arc(0.55, R)[1]} A ${R} ${R} 0 0 1 ${arc(1, R)[0]} ${arc(1, R)[1]}`} className="mm-hell-vu-red" />
          {ticks.map((v) => {
            const big = Math.abs(v * 10) % 5 < 0.01;
            const [x1, y1] = arc(v, R);
            const [x2, y2] = arc(v, R + (big ? 8 : 5));
            return <line key={v} x1={x1} y1={y1} x2={x2} y2={y2} className="mm-hell-vu-tick" data-big={big ? '1' : undefined} />;
          })}
          <text x={arc(-1, R + 16)[0]} y={arc(-1, R + 16)[1] + 3} className="mm-hell-vu-t">
            −
          </text>
          <text x={arc(0, R + 16)[0]} y={arc(0, R + 16)[1] + 3} className="mm-hell-vu-t">
            0
          </text>
          <text x={arc(1, R + 16)[0]} y={arc(1, R + 16)[1] + 3} className="mm-hell-vu-t">
            +
          </text>
          <text x={px} y={py - 26} className="mm-hell-vu-name">
            LFO
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

const HellPresetBox: React.FC = () => {
  useExtraAll();
  const cur = hellCurrent();
  const [list, setList] = useState(false);
  const n = cur ? HELL_PRESETS.indexOf(cur) + 1 : 0;
  return (
    <div className="mm-hell-presets">
      <button type="button" className="mm-hell-pwin" aria-haspopup="listbox" aria-expanded={list} onClick={() => setList((o) => !o)} title="The HELL bank">
        <span className="mm-hell-pnum">{cur ? `${String(n).padStart(2, '0')} / ${HELL_PRESETS.length}` : `-- / ${HELL_PRESETS.length}`}</span>
        <b>{cur ? cur.name : 'YOUR SETTING'}</b>
        <span className="mm-hell-pdesc">{cur ? cur.desc : 'A preset sets every HELL control except MIX.'}</span>
      </button>
      <div className="mm-hell-pkeys">
        <PcbKey name="PREV" w={34} h={16} onClick={() => hellStep(-1)} aria-label="Previous HELL preset" />
        <PcbKey name="NEXT" w={34} h={16} onClick={() => hellStep(1)} aria-label="Next HELL preset" />
        <PcbKey name="INIT" w={34} h={16} onClick={() => hellInit()} aria-label="HELL INIT" />
      </div>
      {list && (
        <ul className="mm-hell-plist" role="listbox" aria-label="HELL presets">
          {HELL_PRESETS.map((p, i) => (
            <li key={p.name}>
              <button
                type="button"
                role="option"
                aria-selected={cur?.name === p.name}
                data-on={cur?.name === p.name ? '1' : undefined}
                title={p.desc}
                onClick={() => {
                  hellLoad(p);
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

/* ---------------- la page ---------------- */

const ZONE = { x: 44, w: 1012 };

/** Une rangee de pieces dans un cadre, centree (left : depuis le bord du cadre). */
const Row: React.FC<{ top: number; left?: number; w: number; children: React.ReactNode }> = ({ top, left, w, children }) => (
  <div className="mm-p2-cells mm-hell-row" style={{ top, left: left ?? undefined, width: w }}>
    {children}
  </div>
);

export const HellPage: React.FC<{ flash: (title: string) => boolean }> = ({ flash }) => {
  useExtraAll();
  const sync = X('xHellSync') > 0;
  const lfoSync = X('xHellLfoSync') >= 0.5;
  const hero = Math.round(52 * HERO_K);
  const A = { x: ZONE.x, w: 252 };
  const B = { x: ZONE.x + 252 + 18, w: 482 };
  const C = { x: B.x + B.w + 18, w: ZONE.x + ZONE.w - (B.x + B.w + 18) };
  return (
    <>
      <PcbFrame title="DELAY" x={A.x} y={60} w={A.w} h={400} flash={flash('HELL DELAY')} className="mm-hell-frame">
        <Row top={18} w={A.w}>
          <PcbKnob id="vHellDelay" name={sync ? 'DELAY (NOTE)' : 'DELAY'} ref_="" lo={sync ? '1/32' : '5 MS'} hi={sync ? '1 BAR' : '2 S'} />
          <PcbKnob id="xHellFb" name="FEEDBACK" ref_="" lo="0" hi="FULL" />
        </Row>
        <Row top={118} w={A.w}>
          <PcbToggle id="vHellSync" name="SYNC" ref_="" />
          <PcbToggle id="xHellCross" name="CROSS" ref_="" />
        </Row>
        <span className="mm-hell-sub" style={{ top: 214 }}>
          IN THE LOOP
        </span>
        <Row top={232} w={A.w}>
          <PcbKnob id="xHellHp" name="HIGH-PASS" ref_="" lo="" hi="" fine />
          <PcbKnob id="xHellLp" name="LOW-PASS" ref_="" lo="" hi="" fine />
          <PcbKnob id="xHellSmear" name="SMEAR" ref_="" lo="" hi="" fine />
          <PcbKnob id="xHellSpread" name="SPREAD" ref_="" lo="" hi="" fine />
        </Row>
      </PcbFrame>
      <PcbFrame title="FREQUENCY SHIFTER" x={B.x} y={60} w={B.w} h={400} flash={flash('FREQUENCY SHIFTER')} className="mm-hell-frame mm-hell-shifter">
        <div className="mm-hell-hero" style={{ left: B.w / 2 - 110, top: 46, width: 220, height: 220 }}>
          <ShiftScale size={220} />
          <div className="mm-hell-hero-knob" style={{ left: 110 - hero / 2, top: 110 - hero / 2 - 4 }}>
            <PcbKnob id="xHellShift" name="" ref_="" lo="" hi="" hero={HERO_K} />
          </div>
        </div>
        <Row top={18} left={10} w={140}>
          <PcbRotary id="xHellRange" name="RANGE" ref_="" w={132} />
        </Row>
        <Row top={18} left={B.w - 104} w={94}>
          <PcbToggle id="xHellAntiRefl" name="ANTI REFL" ref_="" />
        </Row>
        <Row top={296} left={20} w={100}>
          <PcbKnob id="xHellUpDown" name="SIDEBAND" ref_="" lo="DOWN" hi="UP" />
        </Row>
        <span className="mm-hell-rm" style={{ left: 20 + 50, top: 292 }}>
          R.M.
        </span>
        <Row top={300} left={B.w - 92} w={76}>
          <PcbKnob id="xHellPhase" name="PHASE" ref_="" lo="" hi="" fine />
        </Row>
        <div className="mm-hell-value" style={{ top: 282 }} aria-hidden="true">
          <b>{arpExtra.text('xHellShift')}</b>
          <span>{['FINE · +/- 3 TO 200 HZ', 'WIDE · +/- 10 HZ TO 5 KHZ', 'SYNC · CYCLES PER BEAT', 'MIDI · PART OF THE PLAYED NOTE'][rangeIdx()]}</span>
        </div>
      </PcbFrame>
      <PcbFrame title="HELL" x={C.x} y={60} w={C.w} h={400} led={X('xHellMix') > 0} flash={flash('HELL')} className="mm-hell-frame">
        <Row top={18} w={C.w}>
          <PcbKnob id="xHellMix" name="MIX" ref_="" lo="OFF" hi="FULL" big />
        </Row>
        <span className="mm-hell-psub">PRESETS</span>
        <HellPresetBox />
      </PcbFrame>
      <PcbFrame title="LFO" x={ZONE.x} y={474} w={ZONE.w} h={156} flash={flash('HELL LFO')} className="mm-hell-frame">
        <Row top={18} left={18} w={760}>
          <PcbRotary id="xHellLfoShape" name="SHAPE" ref_="" w={132} />
          <PcbKnob id="xHellLfoRate" name={lfoSync ? 'RATE (NOTE)' : 'RATE'} ref_="" lo={lfoSync ? '8 BAR' : '.02'} hi={lfoSync ? '1/32' : '10 HZ'} />
          <PcbToggle id="xHellLfoSync" name="SYNC" ref_="" />
          <PcbKnob id="xHellLfoAmt" name="AMOUNT" ref_="" lo="−" hi="+" />
          <PcbToggle id="xHellLfoStereo" name="STEREO" ref_="" />
          <PcbRotary id="xHellLfoTarget" name="TARGET" ref_="" w={140} />
        </Row>
        <div className="mm-hell-vu-place" style={{ left: ZONE.w - 196, top: 22 }}>
          <HellVu />
        </div>
      </PcbFrame>
    </>
  );
};
