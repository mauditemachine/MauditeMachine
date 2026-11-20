/**
 * La page DELAY (v46, 2026-11-20 ; Mika a choisi l'option A des maquettes v44 : "la page entiere doit etre optimisee !
 * J'aime beaucoup le graphisme de Echo dans Ableton [...] peut-etre faire comme un petit ecran comme l'ecran principal
 * mais en plus petit"). Les memes reglages que la page d'avant (delay.ts, aucun parametre neuf), ranges autrement :
 *
 * - En haut, les echos en vedette (facon Echo : les impulsions gauche au-dessus, droite dessous, qui decroissent en dB
 *   sur la grille des temps, les temps L et R en grand a gauche). La tete de lecture suit la position du transport
 *   (mm_transport ppq : hostClock.ts), l'horloge de la page seulement hors du plugin ou a l'arret.
 * - Le petit ecran dans le coin en haut a droite (fx2Lcd.tsx, le style de l'ecran principal) : le temps en grand, la
 *   fiche FEEDBACK, REPEATS, MODE, STYLE, MIX ; un potard touche prend la place du temps ; PREV, NEXT, INIT dessous et la
 *   pastille PRESETS ouvre la liste.
 * - Dessous trois rangees : le temps / le retour / le mode, la couleur, la boucle. L'ancien cadre TIME / REPEATS / STYLE
 *   du milieu n'existe plus (ce qu'il disait est dans le petit ecran) ; RHYTHM n'a plus son cadre : en mode RHYTHM, la vue
 *   des echos montre les seize prises du motif et un clic passe au motif suivant.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pattern } from '../../audio/pattern';
import { voyParams } from '../../voyager/params';
import { DELAY_PRESETS, DL_LONG, DL_MODES, DL_RHYTHMS, DL_RHYTHM_LEVELS, DL_STYLES, delayCurrent, delayInit, delayLaws, delayLoad, delayStep, delayTimeText, dlIdx } from './delay';
import { arpExtra } from './extra';
import { MiniLcd } from './fx2Lcd';
import { hostBeats, hostClockStart, hostTempo } from './hostClock';
import { PcbFrame, PcbKey, PcbKnob, PcbStep, PcbToggle, say, SRC, useRaise } from './pcbui';
import './fx2.css';
import './fxPages.css';

hostClockStart();

const X = (id: string): number => arpExtra.of(id);
const useAll = (): void => {
  useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
  useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  useSyncExternalStore(hostTempo.subscribe, hostTempo.get, hostTempo.get);
};
/** Le tempo : celui de l'hote dans le plugin (mm_transport bpm), sinon celui de la face (120 sans transport). */
const bpmNow = (): number => {
  const h = hostTempo.get();
  if (h !== null) return h;
  const b = pattern.get().bpm;
  return typeof b === 'number' && b > 0 ? b : 120;
};

const Row: React.FC<{ top: number; left?: number; w: number; children: React.ReactNode }> = ({ top, left, w, children }) => (
  <div className="mm-p2-cells mm-hell-row" style={{ top, left: left ?? undefined, width: w }}>
    {children}
  </div>
);

/* ---------------- les echos : ou et combien (les memes lois que la page d'avant, Echo.cpp) ---------------- */

interface Tap {
  /** s */
  t: number;
  /** niveau lineaire */
  a: number;
  /** -1 gauche, 1 droite, 0 les deux */
  side: number;
  /** le rang de la repetition (1 : la premiere) */
  k: number;
}

const LOOP = 0.92;
const FLOOR_DB = 60;

function tapsNow(bpm: number): { taps: Tap[]; tl: number; tr: number; mode: number } {
  const t = delayLaws.seconds(bpm);
  const fb = X('xDlFb');
  const mode = dlIdx('xDlMode', X('xDlMode'));
  const g = X('xDlGroove') / 3;
  const off = (X('xDlOffset') - 0.5) * 0.5;
  const feel = 1 + (X('xDlFeel') - 0.5) * 0.12;
  const beat = 60 / bpm;
  const span = 16 * beat;
  const taps: Tap[] = [];
  const min = Math.pow(10, -FLOOR_DB / 20);
  const tl = t * (mode === 0 ? 1 : 1 + g) * feel * (mode === 3 ? 0.75 : 1);
  const tr = t * (mode === 0 ? 1 : 1 - g + off) * feel;
  if (mode === 4) {
    const lv = DL_RHYTHM_LEVELS[dlIdx('xDlRhythm', X('xDlRhythm'))];
    for (let rep = 0, a0 = 1; rep < 8 && a0 > min; rep += 1, a0 *= fb * LOOP)
      for (let k = 1; k <= 16; k += 1) {
        const at = (rep * 16 + k + (k % 2 ? g : 0)) * t * feel;
        if (at >= span) break;
        if (lv[k - 1] > 0) taps.push({ t: at, a: lv[k - 1] * a0, side: k % 2 ? -1 : 1, k: rep * 16 + k });
      }
    return { taps, tl: t, tr: t, mode };
  }
  let a = 1;
  if (mode === 2) {
    let at = 0;
    for (let k = 1; at < span && a > min && k < 64; k += 1) {
      at += k % 2 ? tl : tr;
      taps.push({ t: at, a, side: k % 2 ? -1 : 1, k });
      a *= fb * LOOP;
    }
  } else if (mode === 0) {
    for (let k = 1; k * tl < span && a > min && k < 64; k += 1, a *= fb * LOOP) taps.push({ t: k * tl, a, side: 0, k });
  } else {
    for (let k = 1; k * tl < span && a > min && k < 64; k += 1, a *= fb * LOOP) taps.push({ t: k * tl, a, side: -1, k });
    a = 1;
    for (let k = 1; k * tr < span && a > min && k < 64; k += 1, a *= fb * LOOP) taps.push({ t: k * tr, a, side: 1, k });
  }
  return { taps, tl, tr, mode };
}

/** La duree montree : assez de temps pour voir les echos s'eteindre, en temps entiers (2, 4, 8 ou 16). */
function spanBeats(taps: Tap[], bpm: number): number {
  const beat = 60 / bpm;
  const last = taps.reduce((m, x) => Math.max(m, x.t), 0);
  const need = last / beat + 0.5;
  return [2, 4, 8, 16].find((b) => b >= need) ?? 16;
}

const levelOf = (a: number): number => Math.max(0, Math.min(1, (20 * Math.log10(Math.max(1e-9, a)) + FLOOR_DB) / FLOOR_DB));
const msText = (s: number): string => (s >= 1 ? `${s.toFixed(2)} S` : `${Math.round(s * 1000)} MS`);
const sameT = (a: number, b: number): boolean => Math.abs(a - b) < 0.0005;

/** Le temps d'un cote, comme on le lit : la note (SYNC) quand c'est le temps du reglage, sinon des ms. */
function sideText(s: number, bpm: number): { big: string; small: string } {
  const main = delayLaws.seconds(bpm);
  const sync = dlIdx('xDlSync', X('xDlSync')) === 1;
  if (sync && sameT(s, main)) {
    const [note] = delayTimeText(bpm).split(' · ');
    return { big: note, small: msText(s) };
  }
  return { big: s >= 1 ? s.toFixed(2) : `${Math.round(s * 1000)}`, small: s >= 1 ? 'S' : 'MS' };
}

/**
 * La tete de lecture (une ligne deplacee sans redessiner la page) : calee sur la position du transport quand il roule
 * (hostClock.ts : la mesure d'Ableton, le debut de la vue sur un debut de mesure) ; sinon l'horloge de la page, au tempo.
 * data-host dit laquelle (la ligne est plus franche quand elle suit l'hote).
 */
function usePlayhead(ref: React.RefObject<SVGLineElement | null>, x0: number, x1: number, beats: number, bpm: number): void {
  useEffect(() => {
    let raf = 0;
    let last = 0;
    const step = (now: number): void => {
      raf = window.requestAnimationFrame(step);
      if (now - last < 33) return;
      last = now;
      const el = ref.current;
      if (!el) return;
      const host = hostBeats(now);
      const f = host !== null ? (((host % beats) + beats) % beats) / beats : (now % ((beats * 60000) / bpm)) / ((beats * 60000) / bpm);
      const x = (x0 + f * (x1 - x0)).toFixed(1);
      el.setAttribute('x1', x);
      el.setAttribute('x2', x);
      if (host !== null) el.setAttribute('data-host', '1');
      else el.removeAttribute('data-host');
    };
    raf = window.requestAnimationFrame(step);
    return () => window.cancelAnimationFrame(raf);
  }, [ref, x0, x1, beats, bpm]);
}

const nextRhythm = (d: number): void => {
  const n = DL_RHYTHMS.length;
  const i = dlIdx('xDlRhythm', X('xDlRhythm'));
  SRC.set('xDlRhythm', ((i + d + n) % n) / (n - 1));
  say('xDlRhythm');
};

/* ---------------- A : la vue facon Echo (gauche au-dessus, droite dessous) ---------------- */

const EchoMirror: React.FC<{ w: number; h: number }> = ({ w, h }) => {
  useAll();
  const bpm = bpmNow();
  const { taps, tl, tr, mode } = tapsNow(bpm);
  const mix = voyParams.of('delay');
  const beats = spanBeats(taps, bpm);
  const beat = 60 / bpm;
  const RW = 112;
  const x0 = RW + 18;
  const x1 = w - 16;
  const top = 26;
  const bot = h - 22;
  const mid = (top + bot) / 2;
  const half = (bot - top) / 2 - 4;
  const xs = (s: number): number => x0 + (s / (beats * beat)) * (x1 - x0);
  const head = useRef<SVGLineElement>(null);
  usePlayhead(head, x0, x1, beats, bpm);
  const L = sideText(mode === 2 ? tl : tl, bpm);
  const R = sideText(mode === 2 ? tr : tr, bpm);
  const both = mode === 0;
  const fb = X('xDlFb');
  const n = taps.filter((x) => x.side <= 0).length;
  // la courbe de decroissance (le niveau des echos d'un cote dans le temps)
  const env = (side: number): string => {
    const per = side < 0 ? (mode === 2 ? tl + tr : tl) : mode === 2 ? tl + tr : tr;
    const t0 = side < 0 ? tl : mode === 2 ? tl + tr : tr;
    const pts: string[] = [];
    for (let i = 0; i <= 80; i += 1) {
      const s = t0 + (i / 80) * (beats * beat - t0);
      const a = Math.pow(fb * LOOP, (s - t0) / per);
      const y = mid + (side < 0 ? -1 : 1) * levelOf(a) * half;
      pts.push(`${xs(s).toFixed(1)},${y.toFixed(1)}`);
    }
    return pts.join(' ');
  };
  return (
    <div className="mm-dm-glass mm-fx2-echo" style={{ width: w, height: h }} role="img" aria-label="Echoes in time, left above, right below" onClick={() => mode === 4 && nextRhythm(1)}>
      <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}>
        {/* les temps L et R, en grand */}
        <g className="mm-fx2-lr">
          <text x={14} y={30} className="lr-k">
            {both ? 'L + R' : 'L'}
          </text>
          <text x={14} y={58} className="lr-big">
            {L.big}
          </text>
          <text x={14} y={72} className="lr-small">
            {L.small}
          </text>
          {!both && (
            <>
              <text x={14} y={h / 2 + 22} className="lr-k">
                R
              </text>
              <text x={14} y={h / 2 + 50} className="lr-big">
                {R.big}
              </text>
              <text x={14} y={h / 2 + 64} className="lr-small">
                {R.small}
              </text>
            </>
          )}
          {both && (
            <text x={14} y={h / 2 + 50} className="lr-small">
              {`${DL_MODES[mode]}`}
            </text>
          )}
          <path className="lr-sep" d={`M${RW} 12V${h - 12}`} />
        </g>
        {/* la grille des temps */}
        {Array.from({ length: beats * 4 + 1 }, (_, i) => {
          const x = xs((i * beat) / 4);
          const isBeat = i % 4 === 0;
          const isBar = i % 16 === 0;
          return <path key={i} className={isBar ? 'g-bar' : isBeat ? 'g-beat' : 'g-six'} d={`M${x.toFixed(1)} ${top}V${bot}`} />;
        })}
        {Array.from({ length: beats + 1 }, (_, i) => {
          const bar = Math.floor(i / 4) + 1;
          const b = (i % 4) + 1;
          return (
            <text key={i} x={xs(i * beat)} y={h - 8} textAnchor="middle" className={b === 1 ? 'g-lab bar' : 'g-lab'}>
              {b === 1 ? `${bar}` : `${bar}.${b}`}
            </text>
          );
        })}
        <path className="g-mid" d={`M${x0} ${mid}H${x1}`} />
        {/* RHYTHM : les seize prises du motif (le premier tour), allumees selon leur niveau, numerotees */}
        {mode === 4 &&
          (() => {
            const t = delayLaws.seconds(bpm);
            const g = X('xDlGroove') / 3;
            const feel = 1 + (X('xDlFeel') - 0.5) * 0.12;
            const lv = DL_RHYTHM_LEVELS[dlIdx('xDlRhythm', X('xDlRhythm'))];
            return Array.from({ length: 16 }, (_, i) => {
              const k = i + 1;
              const x = xs((k + (k % 2 ? g : 0)) * t * feel);
              if (x > x1) return null;
              const on = lv[i] > 0;
              return (
                <g key={k} className="mm-fxp-step" data-on={on ? '1' : undefined}>
                  <rect x={x - 4} y={mid - 4} width={8} height={8} rx={1.5} style={{ opacity: on ? 0.35 + 0.65 * lv[i] : 1 }} />
                  <text x={x} y={k % 2 ? mid - 8 : mid + 15} textAnchor="middle">
                    {k}
                  </text>
                </g>
              );
            });
          })()}
        {/* -12, -24, -36 dB */}
        {[15, 30, 45].map((db) => (
          <g key={db}>
            <path className="g-db" d={`M${x0} ${(mid - (1 - db / FLOOR_DB) * half).toFixed(1)}H${x1}`} />
            <path className="g-db" d={`M${x0} ${(mid + (1 - db / FLOOR_DB) * half).toFixed(1)}H${x1}`} />
          </g>
        ))}
        {mix > 0 && !both && mode !== 4 && <polyline className="env" points={env(-1)} />}
        {mix > 0 && !both && mode !== 4 && <polyline className="env" points={env(1)} />}
        {/* le son sec */}
        <path className="dry" d={`M${x0} ${mid - half}V${mid + half}`} />
        {mix > 0 &&
          taps.map((p, i) => {
            const lv = levelOf(p.a);
            const hh = Math.max(2, lv * half);
            const x = xs(p.t);
            const op = 0.3 + 0.7 * lv;
            const up = p.side <= 0;
            const dn = p.side >= 0;
            return (
              <g key={i} className="tap" style={{ opacity: op }}>
                {up && <path d={`M${x.toFixed(1)} ${mid}V${(mid - hh).toFixed(1)}`} />}
                {up && <circle cx={x} cy={mid - hh} r={2.6} />}
                {dn && <path d={`M${x.toFixed(1)} ${mid}V${(mid + hh).toFixed(1)}`} />}
                {dn && <circle cx={x} cy={mid + hh} r={2.6} />}
              </g>
            );
          })}
        <line ref={head} className="head" x1={x0} x2={x0} y1={top - 4} y2={bot + 2} />
        <text x={x0} y={16} className="t-k">
          {mode === 4 ? `RHYTHM · ${DL_RHYTHMS[dlIdx('xDlRhythm', X('xDlRhythm'))]} · CLICK FOR THE NEXT` : 'ECHOES'}
        </text>
        <text x={x1} y={16} textAnchor="end" className="t-hot">
          {mix > 0 ? `${Number.isFinite(n) ? n : ''} REPEATS · ${beats >= 4 ? `${beats / 4} BAR${beats > 4 ? 'S' : ''}` : `${beats} BEATS`}` : 'MIX 0 · NO ECHO'}
        </text>
      </svg>
    </div>
  );
};

/* ---------------- le petit ecran (coin), les presets ---------------- */

function repeats(): number {
  const fb = X('xDlFb');
  if (fb >= 0.995) return Infinity;
  const loop = fb * LOOP;
  return Math.max(1, Math.min(99, Math.ceil(Math.log(0.001) / Math.log(Math.max(1e-6, loop)))));
}

const DelayLcd: React.FC<{ w: number; h: number; onPill: () => void }> = ({ w, h, onPill }) => {
  useAll();
  const bpm = bpmNow();
  const cur = delayCurrent();
  const i = cur ? DELAY_PRESETS.indexOf(cur) : -1;
  const [note, ms] = delayTimeText(bpm).split(' · ');
  const n = repeats();
  const style = DL_STYLES[dlIdx('xDlStyle', X('xDlStyle'))];
  return (
    <MiniLcd
      w={w}
      h={h}
      title="DELAY"
      sub={cur ? cur.name : 'YOUR DELAY'}
      bpm={bpm}
      bigLabel="TIME"
      big={note}
      bigUnit={ms ?? ''}
      bar={X('xDlFb')}
      rows={[
        ['FEEDBACK', `${Math.round(X('xDlFb') * 100)} %`],
        ['REPEATS', Number.isFinite(n) ? `${n}` : 'ENDLESS'],
        ['MODE', DL_MODES[dlIdx('xDlMode', X('xDlMode'))]],
        ['STYLE', style],
        ['MIX', `${Math.round(voyParams.of('delay') * 100)} %`],
      ]}
      msg={i >= 0 ? `PRESET ${String(i + 1).padStart(2, '0')} / ${DELAY_PRESETS.length}` : DL_LONG[style]}
      pill="PRESETS"
      onPill={onPill}
      echoOf={(nm) => nm.startsWith('DELAY') || nm === 'DELAY' || nm.startsWith('MIX')}
    />
  );
};

/** La liste des presets (la pastille PRESETS du petit ecran), sous lui. */
const PresetList: React.FC<{ close: () => void }> = ({ close }) => {
  useAll();
  const cur = delayCurrent();
  const i = cur ? DELAY_PRESETS.indexOf(cur) : -1;
  return (
    <ul className="mm-hell-plist mm-fxp-plist" role="listbox" aria-label="DELAY presets">
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
              close();
            }}
          >
            <span>{String(k + 1).padStart(2, '0')}</span>
            {q.name}
          </button>
        </li>
      ))}
    </ul>
  );
};

/** Le coin : le petit ecran, PREV / NEXT / INIT, la liste. */
const Corner: React.FC<{ x: number; y: number; w: number; h: number }> = ({ x, y, w, h }) => {
  const [list, setList] = useState(false);
  const box = useRef<HTMLDivElement>(null);
  useRaise(list, box);
  return (
    <div ref={box} className="mm-dm-place mm-fx2-corner" style={{ left: x, top: y, width: w }}>
      <DelayLcd w={w} h={h} onPill={() => setList((o) => !o)} />
      <PresetKeys />
      {list && <PresetList close={() => setList(false)} />}
    </div>
  );
};

const PresetKeys: React.FC = () => (
  <div className="mm-fx2-pkeys">
    <PcbKey name="PREV" w={34} h={16} onClick={() => delayStep(-1)} aria-label="Previous DELAY preset" />
    <PcbKey name="NEXT" w={34} h={16} onClick={() => delayStep(1)} aria-label="Next DELAY preset" />
    <PcbKey name="INIT" w={34} h={16} onClick={() => delayInit()} aria-label="DELAY INIT" />
  </div>
);

const StyleKeys: React.FC = () => {
  useAll();
  const cur = dlIdx('xDlStyle', X('xDlStyle'));
  return (
    <div className="mm-fx2-stylekeys">
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
  );
};

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

/* ---------------- les cadres des reglages (les memes dans A et B) ---------------- */

const FR = 118;
const TimeFrame: React.FC<{ x: number; y: number; w: number }> = ({ x, y, w }) => {
  useAll();
  const sync = dlIdx('xDlSync', X('xDlSync')) === 1;
  return (
    <PcbFrame title="TIME" x={x} y={y} w={w} h={FR} led sep className="mm-hell-frame">
      <Row top={22} w={w}>
        {sync ? <PcbKnob id="xDlDiv" name="TIME (NOTE)" ref_="" lo="1/32" hi="2 BAR" big /> : <PcbKnob id="xDlMs" name="TIME (MS)" ref_="" lo="5 MS" hi="2 S" big />}
        <PcbToggle id="xDlSync" name="SYNC" ref_="" w={78} />
        <PcbStep id="xDlNote" name="NOTE" ref_="" w={150} />
        <TapKey />
      </Row>
    </PcbFrame>
  );
};

const FbMixFrame: React.FC<{ x: number; y: number; w: number }> = ({ x, y, w }) => (
  <PcbFrame title="FEEDBACK · MIX" x={x} y={y} w={w} h={FR} sep className="mm-hell-frame">
    <Row top={22} w={w}>
      <PcbKnob id="xDlFb" name="FEEDBACK" ref_="" lo="0" hi="FULL" big />
      <PcbKnob id="delay" name="MIX" ref_="" lo="DRY" hi="WET" big />
    </Row>
  </PcbFrame>
);

const ModeFrame: React.FC<{ x: number; y: number; w: number }> = ({ x, y, w }) => (
  <PcbFrame title="MODE" x={x} y={y} w={w} h={FR} className="mm-hell-frame">
    <Row top={22} w={w}>
      <PcbStep id="xDlMode" name="MODE" ref_="" w={176} />
      <PcbKnob id="xDlWidth" name="WIDTH" ref_="" lo="" hi="" fine />
      <PcbKnob id="xDlOffset" name="OFFSET" ref_="" lo="" hi="" fine />
    </Row>
  </PcbFrame>
);

const ColourFrame: React.FC<{ x: number; y: number; w: number }> = ({ x, y, w }) => {
  useAll();
  const st = DL_STYLES[dlIdx('xDlStyle', X('xDlStyle'))];
  return (
    <PcbFrame title="STYLE" x={x} y={y} w={w} h={FR} sep className="mm-hell-frame">
      <div className="mm-dm-place" style={{ left: 0, right: 0, top: 30 }}>
        <StyleKeys />
        <span className="mm-dl-stylename" style={{ marginTop: 6 }}>
          {DL_LONG[st]}
        </span>
      </div>
    </PcbFrame>
  );
};

const CharFrame: React.FC<{ x: number; y: number; w: number }> = ({ x, y, w }) => (
  <PcbFrame title="CHARACTER" x={x} y={y} w={w} h={FR} className="mm-hell-frame">
    <Row top={22} w={w}>
      <PcbKnob id="xDlSat" name="SATURATION" ref_="" lo="" hi="" fine />
      <PcbKnob id="xDlWobble" name="WOBBLE" ref_="" lo="" hi="" fine />
      <PcbKnob id="xDlDiff" name="DIFFUSION" ref_="" lo="" hi="" fine />
      <PcbToggle id="xDlLofi" name="LOFI" ref_="" w={78} />
      <PcbKnob id="xDlAnalog" name="ANALOG" ref_="" lo="" hi="" fine />
    </Row>
  </PcbFrame>
);

const LoopFrame: React.FC<{ x: number; y: number; w: number; sep?: boolean }> = ({ x, y, w, sep }) => (
  <PcbFrame title="IN THE LOOP" x={x} y={y} w={w} h={FR} sep={sep} className="mm-hell-frame">
    <Row top={22} w={w}>
      <PcbKnob id="xDlLow" name="LOW CUT" ref_="" lo="" hi="" fine />
      <PcbKnob id="xDlHigh" name="HIGH CUT" ref_="" lo="" hi="" fine />
    </Row>
  </PcbFrame>
);

const GrooveFrame: React.FC<{ x: number; y: number; w: number; sep?: boolean }> = ({ x, y, w, sep }) => (
  <PcbFrame title="GROOVE" x={x} y={y} w={w} h={FR} sep={sep} className="mm-hell-frame" led={X('xDlPrime') >= 0.5}>
    <Row top={22} w={w}>
      <PcbKnob id="xDlGroove" name="GROOVE" ref_="" lo="" hi="" fine />
      <PcbKnob id="xDlFeel" name="FEEL" ref_="" lo="" hi="" fine />
      <PcbToggle id="xDlPrime" name="PRIME" ref_="" w={78} />
    </Row>
  </PcbFrame>
);

const DuckFrame: React.FC<{ x: number; y: number; w: number }> = ({ x, y, w }) => (
  <PcbFrame title="DUCKING" x={x} y={y} w={w} h={FR} className="mm-hell-frame" led={X('xDlDuck') > 0}>
    <Row top={22} w={w}>
      <PcbKnob id="xDlDuck" name="DUCKING" ref_="" lo="" hi="" fine />
      <PcbKnob id="xDlDuckRel" name="RELEASE" ref_="" lo="" hi="" fine />
    </Row>
  </PcbFrame>
);

/* ---------------- la page ---------------- */

const Z = { x: 44, w: 1012 };
const G = 22;

/** Une rangee de cadres centree : leurs largeurs, leurs x. */
function rowX(ws: number[]): number[] {
  const tot = ws.reduce((t, x) => t + x, 0) + G * (ws.length - 1);
  let x = Z.x + Math.round((Z.w - tot) / 2);
  return ws.map((w) => {
    const at = x;
    x += w + G;
    return at;
  });
}

/** La page : les echos en haut (facon Echo), le petit ecran dans le coin en haut a droite, trois rangees dessous. */
export const DelayPageA: React.FC = () => {
  useAll();
  const LW = 244;
  const EW = Z.w - LW - G;
  const r1 = [374, 196, 356];
  const r2 = [356, 418];
  const r3 = [196, 268, 196];
  const x1 = rowX(r1);
  const x2 = rowX(r2);
  const x3 = rowX(r3);
  return (
    <>
      <div className="mm-dm-place" style={{ left: Z.x, top: 64 }}>
        <EchoMirror w={EW} h={186} />
      </div>
      <Corner x={Z.x + EW + G} y={64} w={LW} h={150} />
      <TimeFrame x={x1[0]} y={266} w={r1[0]} />
      <FbMixFrame x={x1[1]} y={266} w={r1[1]} />
      <ModeFrame x={x1[2]} y={266} w={r1[2]} />
      <ColourFrame x={x2[0]} y={394} w={r2[0]} />
      <CharFrame x={x2[1]} y={394} w={r2[1]} />
      <LoopFrame x={x3[0]} y={522} w={r3[0]} sep />
      <GrooveFrame x={x3[1]} y={522} w={r3[1]} sep />
      <DuckFrame x={x3[2]} y={522} w={r3[2]} />
    </>
  );
};
