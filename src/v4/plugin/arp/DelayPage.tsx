/**
 * La page DELAY (v27, 2026-11-17 ; la maquette v26 validee par Mika : "ok code et publie"). Facon Soundtoys EchoBoy et
 * Waves H-Delay : leurs fonctions, nos algorithmes, ni leur look ni leurs noms. Le DSP : plugin/mm-arp/dsp/Echo.h autour
 * des deux coeurs du DELAY du site ; les reglages : delay.ts, extra-params.json section delay ; MIX est le potard DELAY de
 * la face (son clic ouvre cette page).
 *
 * Rangee 1 : ECHO TIME (TIME : une note en SYNC, des ms en FREE ; NOTE ; TAP), FEEDBACK et MIX (et ce qu'ils donnent),
 * MODE (SINGLE, DUAL, PING-PONG, WIDE, RHYTHM ; WIDTH, OFFSET), les PRESETS. Rangee 2 : STYLE, CHARACTER (SATURATION,
 * WOBBLE, DIFFUSION), VINTAGE (LOFI, ANALOG), DUCKING. Rangee 3 : IN THE LOOP (LOW CUT, HIGH CUT), GROOVE (GROOVE, FEEL),
 * PRIME, RHYTHM (le motif des seize prises : un clic, le suivant ; Maj, le precedent). Rangee 4 : ECHOES, les echos dans
 * le temps.
 */

import React, { useRef, useState, useSyncExternalStore } from 'react';
import { pattern } from '../../audio/pattern';
import { voyParams } from '../../voyager/params';
import { DELAY_PRESETS, DL_LONG, DL_MODES, DL_RHYTHMS, DL_RHYTHM_LEVELS, DL_STYLES, delayCurrent, delayInit, delayLaws, delayLoad, delayStep, delayTimeText, dlIdx } from './delay';
import { arpExtra } from './extra';
import { PcbFrame, PcbKey, PcbKnob, PcbStep, PcbToggle, say, SRC, useRaise } from './pcbui';

const Row: React.FC<{ top: number; left?: number; w: number; children: React.ReactNode }> = ({ top, left, w, children }) => (
  <div className="mm-p2-cells mm-hell-row" style={{ top, left: left ?? undefined, width: w }}>
    {children}
  </div>
);

const X = (id: string): number => arpExtra.of(id);
const useAll = (): void => {
  useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
  useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
};
const bpmNow = (): number => {
  const b = pattern.get().bpm;
  return typeof b === 'number' && b > 0 ? b : 120;
};

/** Ce que la reinjection donne : le nombre d'echos au-dessus de -60 dB (la perte de la boucle comprise). */
function repeats(): number {
  const fb = X('xDlFb');
  if (fb >= 0.995) return Infinity;
  const loop = fb * 0.92;
  return Math.max(1, Math.min(99, Math.ceil(Math.log(0.001) / Math.log(Math.max(1e-6, loop)))));
}

/** Les echos dans le temps : gauche au-dessus, droite dessous, leur niveau (la reinjection, le mode, GROOVE, OFFSET). */
const Echoes: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  useAll();
  const t = delayLaws.seconds(bpmNow());
  const fb = X('xDlFb');
  const mode = dlIdx('xDlMode', X('xDlMode'));
  const g = X('xDlGroove') / 3;
  const off = (X('xDlOffset') - 0.5) * 0.5;
  const feel = 1 + (X('xDlFeel') - 0.5) * 0.12;
  const span = 4;
  const bars: { x: number; a: number; side: number }[] = [];
  const mix = voyParams.of('delay');
  if (mix > 0) {
    if (mode === 4) {
      // RHYTHM : seize prises au pas du temps, le motif ; la reinjection le repete tous les seize pas
      const lv = DL_RHYTHM_LEVELS[dlIdx('xDlRhythm', X('xDlRhythm'))];
      for (let rep = 0, a0 = 1; rep < 8 && a0 > 0.02; rep += 1, a0 *= fb * 0.92)
        for (let k = 1; k <= 16; k += 1) {
          const at = (rep * 16 + k + (k % 2 ? g : 0)) * t * feel;
          if (at >= span) break;
          if (lv[k - 1] > 0) bars.push({ x: at, a: lv[k - 1] * a0, side: k % 2 ? -1 : 1 });
        }
    } else {
      const tl = t * (mode === 0 ? 1 : 1 + (mode === 2 ? g : g)) * feel * (mode === 3 ? 0.75 : 1);
      const tr = t * (mode === 0 ? 1 : 1 - g + off) * feel;
      let a = 1;
      if (mode === 2) {
        // PING-PONG : gauche, droite, gauche...
        let at = 0;
        for (let k = 1; at < span && a > 0.02; k += 1) {
          at += k % 2 ? tl : tr;
          if (at < span) bars.push({ x: at, a, side: k % 2 ? -1 : 1 });
          a *= fb * 0.92;
        }
      } else if (mode === 0) {
        for (let k = 1; k * tl < span && a > 0.02; k += 1, a *= fb * 0.92) bars.push({ x: k * tl, a, side: 0 });
      } else {
        for (let k = 1; k * tl < span && a > 0.02; k += 1, a *= fb * 0.92) bars.push({ x: k * tl, a, side: -1 });
        a = 1;
        for (let k = 1; k * tr < span && a > 0.02; k += 1, a *= fb * 0.92) bars.push({ x: k * tr, a, side: 1 });
      }
    }
  }
  const mid = h / 2;
  const X0 = 10;
  const xs = (s: number): number => X0 + (s / span) * (w - 20);
  return (
    <div className="mm-dm-glass" style={{ width: w, height: h }} aria-label="Echoes in time" role="img">
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        <path className="grid" d={`M8 ${mid}H${w - 8}`} />
        {Array.from({ length: 9 }, (_, i) => (
          <path key={i} className="grid" d={`M${xs((i * span) / 8)} 4V${h - 4}`} />
        ))}
        <rect x={8} y={mid - (h / 2 - 10)} width={3} height={h - 20} className="dl-dry" />
        {bars.map((b, i) => {
          const hh = Math.min(1, b.a) * (h / 2 - 12);
          return b.side === 0 ? (
            <rect key={i} x={xs(b.x) - 3} y={mid - hh / 2} width={6} height={Math.max(2, hh)} className="dl-echo" />
          ) : (
            <rect key={i} x={xs(b.x) - 3} y={b.side < 0 ? mid - hh : mid} width={6} height={Math.max(2, hh)} className="dl-echo" />
          );
        })}
        <text x="16" y="12">
          ECHOES
        </text>
        <text x="16" y={h - 5}>
          {mode === 0 ? 'CENTER · 4 S' : 'L ABOVE · R BELOW · 4 S'}
        </text>
        <text x={w - 10} y="12" textAnchor="end" className="hot">
          {mix > 0 ? `${delayTimeText(bpmNow())} · ${DL_MODES[mode]}` : 'MIX 0 · NO ECHO'}
        </text>
      </svg>
    </div>
  );
};

/** RHYTHM : les seize prises du motif ; un clic, le suivant ; Maj ou clic droit, le precedent. */
const RhythmTaps: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  useAll();
  const i = dlIdx('xDlRhythm', X('xDlRhythm'));
  const lv = DL_RHYTHM_LEVELS[i];
  const live = dlIdx('xDlMode', X('xDlMode')) === 4;
  const cw = (w - 20) / 16;
  const step = (d: number): void => {
    const n = DL_RHYTHMS.length;
    SRC.set('xDlRhythm', ((i + d + n) % n) / (n - 1));
    say('xDlRhythm');
  };
  return (
    <button
      type="button"
      className="mm-dm-glass mm-dl-rhythm"
      style={{ width: w, height: h, opacity: live ? 1 : 0.55 }}
      onClick={(e) => step(e.shiftKey ? -1 : 1)}
      onContextMenu={(e) => {
        e.preventDefault();
        step(-1);
      }}
      aria-label={`RHYTHM pattern ${DL_RHYTHMS[i]}; click for the next one`}
    >
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {lv.map((v, k) => (
          <g key={k}>
            <rect x={10 + k * cw + 2} y={h - 8 - 4} width={cw - 4} height={3} className="dl-tap-base" />
            {v > 0 && <rect x={10 + k * cw + 3} y={h - 12 - v * (h - 28)} width={cw - 6} height={v * (h - 28)} className="dl-echo" />}
          </g>
        ))}
        <text x="10" y="12">
          RHYTHM · 16 TAPS
        </text>
        <text x={w - 10} y="12" textAnchor="end" className="hot">
          {DL_RHYTHMS[i]}
        </text>
      </svg>
    </button>
  );
};

const PresetBox: React.FC = () => {
  useAll();
  const [list, setList] = useState(false);
  const cur = delayCurrent();
  const pbox = useRef<HTMLDivElement>(null);
  useRaise(list, pbox);
  const i = cur ? DELAY_PRESETS.indexOf(cur) : -1;
  return (
    <div ref={pbox} className="mm-hell-presets mm-dm-presets">
      <button type="button" className="mm-hell-pwin mm-dm-pwin" aria-haspopup="listbox" aria-expanded={list} onClick={() => setList((o) => !o)}>
        <span className="mm-hell-pnum">{i >= 0 ? `${String(i + 1).padStart(2, '0')} / ${DELAY_PRESETS.length}` : `-- / ${DELAY_PRESETS.length}`}</span>
        <b>{cur ? cur.name : 'YOUR DELAY'}</b>
        <span className="mm-hell-pdesc">{cur ? cur.desc : 'Edited: PREV, NEXT or the list for a preset'}</span>
      </button>
      <div className="mm-hell-pkeys">
        <PcbKey name="PREV" w={34} h={16} onClick={() => delayStep(-1)} aria-label="Previous DELAY preset" />
        <PcbKey name="NEXT" w={34} h={16} onClick={() => delayStep(1)} aria-label="Next DELAY preset" />
        <PcbKey name="INIT" w={34} h={16} onClick={() => delayInit()} aria-label="DELAY INIT: the delay of the site" />
      </div>
      {list && (
        <ul className="mm-hell-plist mm-dm-plist" role="listbox" aria-label="DELAY presets">
          {DELAY_PRESETS.map((q, k) => (
            <li key={q.name}>
              <button
                type="button"
                role="option"
                aria-selected={k === i}
                data-on={k === i ? '1' : undefined}
                title={q.desc}
                onClick={() => {
                  delayLoad(q);
                  setList(false);
                }}
              >
                <span>{String(k + 1).padStart(2, '0')}</span>
                {q.name}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

const StyleBank: React.FC = () => {
  useAll();
  const cur = dlIdx('xDlStyle', X('xDlStyle'));
  return (
    <div className="mm-dm-bank" style={{ top: 22 }}>
      <div className="mm-dm-keys">
        {DL_STYLES.map((s, i) => (
          <PcbKey
            key={s}
            name={s}
            w={34}
            h={15}
            on={i === cur}
            onClick={() => {
              SRC.set('xDlStyle', i / (DL_STYLES.length - 1));
              say('xDlStyle');
            }}
            aria-label={`DELAY STYLE ${DL_LONG[s]}`}
          />
        ))}
      </div>
      <span className="mm-dl-stylename">{DL_LONG[DL_STYLES[cur]]}</span>
    </div>
  );
};

/** TAP : le temps des deux derniers appuis (FREE, en ms) ; plus de 2 s entre deux : on repart. */
const TapKey: React.FC = () => {
  const taps = useRef<number[]>([]);
  return (
    <div className="mm-dl-tap">
      <PcbKey
        name="TAP"
        w={40}
        h={18}
        onClick={() => {
          const now = performance.now();
          const t = taps.current.filter((x) => now - x < 2000);
          t.push(now);
          taps.current = t.slice(-4);
          if (t.length < 2) return;
          const gaps = t.slice(1).map((x, k) => x - t[k]);
          const ms = gaps.reduce((s, x) => s + x, 0) / gaps.length;
          SRC.set('xDlSync', 0);
          SRC.set('xDlMs', delayLaws.msV(Math.max(5, Math.min(2000, ms))));
          say('xDlMs');
        }}
        aria-label="Tap the delay time"
      />
    </div>
  );
};

export const DelayPage: React.FC = () => {
  useAll();
  const sync = dlIdx('xDlSync', X('xDlSync')) === 1;
  const X0 = 44;
  const L = 790;
  const RX = X0 + L + 22;
  const RW = 1056 - RX;
  const TI = { x: X0, w: 300 };
  const FB = { x: TI.x + TI.w + 22, w: 196 };
  const MO = { x: FB.x + FB.w + 22, w: X0 + L - (FB.x + FB.w + 22) };
  const SY = { x: X0, w: 404 };
  const CH = { x: SY.x + SY.w + 22, w: 196 };
  const VI = { x: CH.x + CH.w + 22, w: X0 + L - (CH.x + CH.w + 22) };
  const LO = { x: X0, w: 150 };
  const GR = { x: LO.x + LO.w + 22, w: 150 };
  const PN = { x: GR.x + GR.w + 22, w: 108 };
  const RH = { x: PN.x + PN.w + 22, w: 1056 - (PN.x + PN.w + 22) };
  const n = repeats();
  const style = DL_STYLES[dlIdx('xDlStyle', X('xDlStyle'))];
  return (
    <>
      {/* rangee 1 : le temps, le retour et le melange, le mode ; les presets */}
      <PcbFrame title="ECHO TIME" x={TI.x} y={60} w={TI.w} h={186} led sep className="mm-hell-frame">
        <Row top={16} w={TI.w}>
          {sync ? <PcbKnob id="xDlDiv" name="TIME (NOTE)" ref_="" lo="1/32" hi="2 BAR" big /> : <PcbKnob id="xDlMs" name="TIME (MS)" ref_="" lo="5 MS" hi="2 S" big />}
          <PcbToggle id="xDlSync" name="SYNC" ref_="" />
        </Row>
        <Row top={112} left={8} w={TI.w - 16}>
          <PcbStep id="xDlNote" name="NOTE" ref_="" w={168} />
          <TapKey />
        </Row>
      </PcbFrame>
      <PcbFrame title="FEEDBACK · MIX" x={FB.x} y={60} w={FB.w} h={186} sep className="mm-hell-frame">
        <Row top={16} w={FB.w}>
          <PcbKnob id="xDlFb" name="FEEDBACK" ref_="" lo="0" hi="FULL" />
          <PcbKnob id="delay" name="MIX" ref_="" lo="DRY" hi="WET" />
        </Row>
        <div className="mm-dm-place mm-dl-read" style={{ left: 12, top: 122, width: FB.w - 24 }}>
          <div className="mm-dm-glass mm-dm-read" style={{ width: FB.w - 24, height: 56 }}>
            <span className="k">TIME</span>
            <span className="v">{delayTimeText(bpmNow())}</span>
            <span className="k">REPEATS</span>
            <span className="v">{`${Math.round(X('xDlFb') * 100)} % · ${Number.isFinite(n) ? `${n} ECHOES` : 'ENDLESS'}`}</span>
            <span className="k">STYLE</span>
            <span className="v">{DL_LONG[style]}</span>
          </div>
        </div>
      </PcbFrame>
      <PcbFrame title="MODE" x={MO.x} y={60} w={MO.w} h={186} sep className="mm-hell-frame">
        <Row top={16} w={MO.w}>
          <PcbStep id="xDlMode" name="MODE" ref_="" w={MO.w - 20} />
        </Row>
        <Row top={100} w={MO.w}>
          <PcbKnob id="xDlWidth" name="WIDTH" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDlOffset" name="OFFSET" ref_="" lo="" hi="" fine />
        </Row>
      </PcbFrame>
      <PcbFrame title="PRESETS" x={RX} y={60} w={RW} h={186} className="mm-hell-frame">
        <PresetBox />
      </PcbFrame>

      {/* rangee 2 : la couleur */}
      <PcbFrame title="STYLE" x={SY.x} y={262} w={SY.w} h={110} sep className="mm-hell-frame">
        <StyleBank />
      </PcbFrame>
      <PcbFrame title="CHARACTER" x={CH.x} y={262} w={CH.w} h={110} sep className="mm-hell-frame">
        <Row top={14} w={CH.w}>
          <PcbKnob id="xDlSat" name="SATURATION" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDlWobble" name="WOBBLE" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDlDiff" name="DIFFUSION" ref_="" lo="" hi="" fine />
        </Row>
      </PcbFrame>
      <PcbFrame title="VINTAGE" x={VI.x} y={262} w={VI.w} h={110} sep className="mm-hell-frame">
        <Row top={14} w={VI.w}>
          <PcbToggle id="xDlLofi" name="LOFI" ref_="" />
          <PcbKnob id="xDlAnalog" name="ANALOG" ref_="" lo="CLEAN" hi="NOISY" />
        </Row>
      </PcbFrame>
      <PcbFrame title="DUCKING" x={RX} y={262} w={RW} h={110} className="mm-hell-frame" led={X('xDlDuck') > 0}>
        <Row top={14} w={RW}>
          <PcbKnob id="xDlDuck" name="DUCKING" ref_="" lo="OFF" hi="FULL" />
          <PcbKnob id="xDlDuckRel" name="RELEASE" ref_="" lo="" hi="" fine />
        </Row>
      </PcbFrame>

      {/* rangee 3 : dans la boucle, le groove, PRIME, RHYTHM */}
      <PcbFrame title="IN THE LOOP" x={LO.x} y={388} w={LO.w} h={112} sep className="mm-hell-frame">
        <Row top={14} w={LO.w}>
          <PcbKnob id="xDlLow" name="LOW CUT" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDlHigh" name="HIGH CUT" ref_="" lo="" hi="" fine />
        </Row>
      </PcbFrame>
      <PcbFrame title="GROOVE" x={GR.x} y={388} w={GR.w} h={112} sep className="mm-hell-frame">
        <Row top={14} w={GR.w}>
          <PcbKnob id="xDlGroove" name="GROOVE" ref_="" lo="" hi="" fine />
          <PcbKnob id="xDlFeel" name="FEEL" ref_="" lo="" hi="" fine />
        </Row>
      </PcbFrame>
      <PcbFrame title="PRIME" x={PN.x} y={388} w={PN.w} h={112} sep className="mm-hell-frame" led={X('xDlPrime') >= 0.5}>
        <Row top={14} w={PN.w}>
          <PcbToggle id="xDlPrime" name="NUMBERS" ref_="" />
        </Row>
      </PcbFrame>
      <PcbFrame title="RHYTHM" x={RH.x} y={388} w={RH.w} h={112} className="mm-hell-frame" led={dlIdx('xDlMode', X('xDlMode')) === 4}>
        <div className="mm-dm-place" style={{ left: 14, top: 22 }}>
          <RhythmTaps w={RH.w - 28} h={78} />
        </div>
      </PcbFrame>

      {/* rangee 4 : les echos */}
      <div className="mm-dm-place" style={{ left: X0, top: 516 }}>
        <Echoes w={1012} h={118} />
      </div>
    </>
  );
};
