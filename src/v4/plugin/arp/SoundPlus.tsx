/**
 * SOUND+ : les reglages du VST3 seul (2026-11-10, Mika : "j'ai de la place pour le plugin en VST3"), la page SOUND+ du
 * panneau du capot (HoodPanel.tsx). Cinq sections : ENGINE (QUALITY, une touche et ses deux LED STD / HQ), LFO 1 (la
 * seconde destination du LFO MOD de la face), LFO 2, REVERB, MASTER. Les valeurs vivent dans plugin/arp/extra.ts ; le pont
 * (bridge.ts) les envoie au C++ comme les potards (mm_param, mm_gesture) et applique celles d'Ableton (mm_knobs).
 *
 * Le dessin (2026-11-10, Mika : "fais ces rajouts par rapport au design de la face avant, la c'est noir et orange") : la
 * langue de la face avant, sans orange. Un potard : le capuchon noir cannele et son index blanc, ses graduations fines,
 * les legendes de ses butees (OFF / FULL, -6 / +6...), son nom dessous en petites capitales, la valeur en gris clair
 * (plus claire au survol et pendant le geste, et dans l'afficheur du panneau : xTouch).
 *
 * Un potard : glisser vertical (Maj : fin), molette, double-clic = la valeur de depart, fleches (Maj : x10), Debut et
 * Fin. Un potard a crans montre le nom de son cran. En MIDI LEARN, un clic l'arme (il ne bouge pas : sa LED clignote).
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { arpBridge } from './bridge';
import { arpExtra, EXTRA_PARAMS, EXTRA_SECTIONS, extraStepIndex, type ExtraParam } from './extra';
import { arpMidi } from './midimap';

/** La course d'un glisser (px) pour tout le potard. */
const DRAG_PX = 170;
/** Le cran du centre des potards a zero au centre, pendant le glisser. */
const CENTER_DETENT = 0.02;
/** La molette : ce deltaY fait un pas. */
const WHEEL_STEP = 40;

/** Les potards dont le centre est le son du site : l'arc part du milieu. */
const BIPOLAR: ReadonlySet<string> = new Set(['xRevSize', 'xRevTone', 'xBass', 'xAir', 'xWidth']);
/** Sous l'interrupteur QUALITY : le surechantillonnage de chaque position. */
const QUALITY_SUB = ['x4 OVERSAMPLING', 'x8 OVERSAMPLING'];


/** Les legendes des butees, comme sur la carte (STABLE / LOOSE, OFF / FULL) ; un reglage a crans : son premier et son dernier. */
const ENDS: Record<string, readonly [string, string]> = {
  xLfo1Depth2: ['0', 'FULL'],
  xLfo2Depth: ['0', 'FULL'],
  xRevSize: ['0.6 S', '9.6 S'],
  xRevTone: ['DARK', 'BRIGHT'],
  xRevPre: ['0', '100 MS'],
  xWarmth: ['OFF', 'FULL'],
  xBass: ['-6', '+6'],
  xAir: ['-6', '+6'],
  xWidth: ['MONO', 'WIDE'],
  xLfo1Dest2: ['OFF', 'ENV'],
  xLfo2Dest: ['OFF', 'ENV'],
  xLfo2Rate: ['1/32', '8 BAR'],
  xLfo2Shape: ['SINE', 'RND'],
};

/* Le potard dessine : la boite SVG, le centre, le capuchon (VOY_KNOB : capuchon cannele noir, index blanc) */
const VW = 58;
const VH = 66;
const CX = VW / 2;
const CY = 29;
const A0 = -135;
const SWEEP = 270;
const R_SKIRT = 18.5;
const R_CAP = 14.4;
const R_TICK = [22.6, 25.8] as const;
const FLUTES = 24;

const pt = (deg: number, r: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [CX + r * Math.cos(a), CY + r * Math.sin(a)];
};

const useValue = (id: string): number =>
  useSyncExternalStore(
    arpExtra.subscribe,
    () => arpExtra.of(id),
    () => arpExtra.of(id)
  );
const useArpMidi = () => useSyncExternalStore(arpMidi.subscribe, arpMidi.get, arpMidi.get);

const SECTION_NAME: Record<string, string> = { engine: 'Engine', lfo1: 'LFO 1', lfo2: 'LFO 2', reverb: 'Reverb', master: 'Master' };
const ariaName = (p: ExtraParam): string => `${SECTION_NAME[p.section]} ${p.label.toLowerCase()}`;

/**
 * Le reglage touche en dernier (survol, geste, molette, clavier) : l'afficheur du panneau (HoodPanel.tsx) montre son nom
 * et sa valeur. active : le geste en cours ; null : rien depuis un moment.
 */
let touch: { id: string; active: boolean } | null = null;
let touchTimer = 0;
const touchListeners = new Set<() => void>();
const emitTouch = (): void => touchListeners.forEach((fn) => fn());
export const xTouch = {
  get: (): { id: string; active: boolean } | null => touch,
  /** hold : le geste continue (le nom reste tant qu'il dure) ; sinon le nom s'efface 1.6 s plus tard */
  set(id: string, hold: boolean): void {
    window.clearTimeout(touchTimer);
    if (!touch || touch.id !== id || touch.active !== hold) {
      touch = { id, active: hold };
      emitTouch();
    }
    if (!hold) touchTimer = window.setTimeout(() => xTouch.clear(id), 1600);
  },
  clear(id?: string): void {
    if (!touch || (id && touch.id !== id)) return;
    window.clearTimeout(touchTimer);
    touch = null;
    emitTouch();
  },
  subscribe(fn: () => void): () => void {
    touchListeners.add(fn);
    return () => {
      touchListeners.delete(fn);
    };
  },
};
export const sectionPrefix = (p: ExtraParam): string => (p.section === 'engine' ? '' : `${SECTION_NAME[p.section].toUpperCase()} `);

/** Les degrades du capuchon, une fois pour tout le panneau (references par id dans chaque potard). */
const KnobDefs: React.FC = () => (
  <svg className="mm-arp-x-defs" width="0" height="0" aria-hidden="true" focusable="false">
    <defs>
      <radialGradient id="mmx-skirt" cx="50%" cy="38%" r="62%">
        <stop offset="0" stopColor="#34312f" />
        <stop offset="0.62" stopColor="#141312" />
        <stop offset="1" stopColor="#050505" />
      </radialGradient>
      <radialGradient id="mmx-cap" cx="44%" cy="30%" r="75%">
        <stop offset="0" stopColor="#2f2c2a" />
        <stop offset="0.55" stopColor="#151413" />
        <stop offset="1" stopColor="#080808" />
      </radialGradient>
      <radialGradient id="mmx-shadow">
        <stop offset="0.7" stopColor="#000" stopOpacity="0.7" />
        <stop offset="1" stopColor="#000" stopOpacity="0" />
      </radialGradient>
    </defs>
  </svg>
);

/** Le capuchon : l'ombre portee, la jupe cannelee, le dessus bombe, l'index blanc. */
const Cap: React.FC<{ deg: number }> = ({ deg }) => {
  const [mx0, my0] = pt(deg, 4.8);
  const [mx1, my1] = pt(deg, R_CAP - 1.2);
  const flute = (2 * Math.PI * (R_SKIRT - 0.7)) / FLUTES;
  return (
    <g className="mm-arp-x-cap">
      <circle cx={CX} cy={CY + 2.6} r={R_SKIRT + 3.5} fill="url(#mmx-shadow)" />
      <circle cx={CX} cy={CY} r={R_SKIRT} fill="url(#mmx-skirt)" />
      <circle cx={CX} cy={CY} r={R_SKIRT - 0.7} fill="none" stroke="#000" strokeOpacity="0.75" strokeWidth="1.5" strokeDasharray={`${(flute * 0.45).toFixed(3)} ${(flute * 0.55).toFixed(3)}`} />
      <circle cx={CX} cy={CY} r={R_SKIRT - 0.2} fill="none" stroke="#5a5652" strokeOpacity="0.35" strokeWidth="0.6" />
      <circle cx={CX} cy={CY} r={R_CAP} fill="url(#mmx-cap)" />
      <circle className="mm-arp-x-top" cx={CX} cy={CY} r={R_CAP} fill="#fff" />
      <line x1={mx0} y1={my0} x2={mx1} y2={my1} stroke="#f1efeb" strokeWidth="2.3" strokeLinecap="round" />
    </g>
  );
};

/** Les graduations : une par cran (au plus 15), sinon onze (0 a 10, comme autour de CUTOFF) ; le centre plus long. */
const Scale: React.FC<{ n: number; bipolar: boolean }> = ({ n, bipolar }) => {
  const count = n > 1 ? n : 11;
  const ticks: React.ReactNode[] = [];
  for (let i = 0; i < count; i += 1) {
    const deg = A0 + (SWEEP * i) / (count - 1);
    const mid = bipolar && i === (count - 1) / 2;
    const [x0, y0] = pt(deg, mid ? R_TICK[0] - 1.6 : R_TICK[0]);
    const [x1, y1] = pt(deg, R_TICK[1]);
    ticks.push(<line key={i} className={mid ? 'mm-arp-x-tick mm-arp-x-tick-mid' : 'mm-arp-x-tick'} x1={x0.toFixed(2)} y1={y0.toFixed(2)} x2={x1.toFixed(2)} y2={y1.toFixed(2)} />);
  }
  return <g>{ticks}</g>;
};

/** Un potard SOUND+. */
const XKnob: React.FC<{ p: ExtraParam }> = ({ p }) => {
  const v = useValue(p.id);
  const midi = useArpMidi();
  const ref = useRef<HTMLDivElement>(null);
  const drag = useRef<{ y: number; raw: number; moved: boolean } | null>(null);
  const n = p.steps?.length ?? 0;
  const bipolar = BIPOLAR.has(p.id);
  const armed = midi.learning && midi.armed === p.id;

  // La molette (non passive : la page ne defile pas) : un cran, ou 1 % (Maj : 0.1 %)
  useEffect(() => {
    const el = ref.current;
    if (!el) return undefined;
    let acc = 0;
    const onWheel = (e: WheelEvent): void => {
      e.preventDefault();
      if (arpMidi.get().learning) return;
      acc += e.deltaY;
      const ticks = Math.trunc(acc / WHEEL_STEP);
      if (ticks === 0) return;
      acc -= ticks * WHEEL_STEP;
      const step = n > 1 ? 1 / (n - 1) : e.shiftKey ? 0.001 : 0.01;
      arpExtra.set(p.id, arpExtra.of(p.id) - ticks * step);
      xTouch.set(p.id, false);
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [p.id, n]);

  const onDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.currentTarget.focus({ preventScroll: true });
    // MIDI LEARN : le clic arme le reglage, il ne bouge pas
    if (arpBridge.learnArm(p.id)) return;
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pas de capture : le geste reste sur le potard tant qu'on y est */
    }
    drag.current = { y: e.clientY, raw: v, moved: false };
    xTouch.set(p.id, true);
  };
  const onMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    if (!d) return;
    const dy = d.y - e.clientY;
    if (!d.moved && Math.abs(dy) < 3) return;
    d.moved = true;
    // Par increments : Maj en cours de geste affine sans saut
    d.raw = Math.min(1, Math.max(0, d.raw + (dy / DRAG_PX) * (e.shiftKey ? 0.25 : 1)));
    d.y = e.clientY;
    let t = d.raw;
    if (bipolar && !e.shiftKey && Math.abs(t - 0.5) < CENTER_DETENT) t = 0.5;
    arpExtra.set(p.id, t);
  };
  const onEnd = (): void => {
    if (!drag.current) return;
    drag.current = null;
    xTouch.set(p.id, false);
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const step = n > 1 ? 1 / (n - 1) : e.shiftKey ? 0.1 : 0.01;
    let t = v;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') t += step;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') t -= step;
    else if (e.key === 'Home') t = 0;
    else if (e.key === 'End') t = 1;
    else if (e.key === 'Delete' || e.key === 'Backspace') t = arpExtra.def(p.id);
    else return;
    e.preventDefault();
    e.stopPropagation();
    arpExtra.set(p.id, t);
    xTouch.set(p.id, false);
  };

  const text = arpExtra.text(p.id, v);
  const ends = ENDS[p.id];
  const [lx, ly] = pt(A0, R_TICK[1] + 1);
  const [rx] = pt(A0 + SWEEP, R_TICK[1] + 1);
  return (
    <div
      ref={ref}
      className="mm-arp-x"
      data-x={p.id}
      data-steps={n > 1 ? '1' : undefined}
      data-mm-learn={armed ? 'armed' : undefined}
      data-learning={midi.learning ? '1' : undefined}
      role="slider"
      tabIndex={0}
      title={p.help}
      aria-label={ariaName(p)}
      aria-valuemin={0}
      aria-valuemax={n > 1 ? n - 1 : 100}
      aria-valuenow={n > 1 ? extraStepIndex(p.id, v) : Math.round(v * 100)}
      aria-valuetext={text}
      onPointerDown={onDown}
      onPointerMove={onMove}
      onPointerUp={onEnd}
      onPointerCancel={onEnd}
      onLostPointerCapture={onEnd}
      onPointerEnter={() => xTouch.set(p.id, false)}
      onDoubleClick={() => {
        if (arpMidi.get().learning) return;
        arpExtra.set(p.id, arpExtra.def(p.id));
        xTouch.set(p.id, false);
      }}
      onKeyDown={onKey}
    >
      <svg className="mm-arp-x-dial" viewBox={`0 0 ${VW} ${VH}`} width={VW} height={VH} aria-hidden="true">
        <Scale n={n} bipolar={bipolar} />
        {ends && (
          <>
            <text className="mm-arp-x-end" x={lx + 2.5} y={ly + 8} textAnchor="middle">
              {ends[0]}
            </text>
            <text className="mm-arp-x-end" x={rx - 2.5} y={ly + 8} textAnchor="middle">
              {ends[1]}
            </text>
          </>
        )}
        <Cap deg={A0 + v * SWEEP} />
      </svg>
      <span className="mm-arp-x-label">
        {armed && <span className="mm-arp-led" data-on="1" data-blink="1" aria-hidden="true" />}
        {p.label}
      </span>
      <span className="mm-arp-x-value">{text}</span>
    </div>
  );
};

/** QUALITY : la touche de CHORUS et de SUB OCT, ses deux LED (STD, HQ) au-dessus ; chaque appui passe a l'autre. */
const XSwitch: React.FC<{ p: ExtraParam }> = ({ p }) => {
  const v = useValue(p.id);
  const midi = useArpMidi();
  const steps = p.steps ?? [];
  const idx = extraStepIndex(p.id, v);
  const armed = midi.learning && midi.armed === p.id;
  const pick = (i: number): void => {
    if (arpBridge.learnArm(p.id)) return;
    arpExtra.set(p.id, i / Math.max(1, steps.length - 1));
    xTouch.set(p.id, false);
  };
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    let i = idx;
    if (e.key === 'ArrowUp' || e.key === 'ArrowRight') i += 1;
    else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') i -= 1;
    else if (e.key === 'Home') i = 0;
    else if (e.key === 'End') i = steps.length - 1;
    else return;
    e.preventDefault();
    e.stopPropagation();
    if (arpMidi.get().learning) return;
    arpExtra.set(p.id, Math.min(steps.length - 1, Math.max(0, i)) / Math.max(1, steps.length - 1));
    xTouch.set(p.id, false);
  };
  return (
    <div className="mm-arp-x mm-arp-x-switch" data-x={p.id} data-mm-learn={armed ? 'armed' : undefined} data-learning={midi.learning ? '1' : undefined} title={p.help} onPointerEnter={() => xTouch.set(p.id, false)}>
      <div className="mm-arp-x-sw" role="radiogroup" aria-label={ariaName(p)} onKeyDown={onKey}>
        {steps.map((s, i) => (
          <button key={s} type="button" role="radio" aria-checked={i === idx} tabIndex={i === idx ? 0 : -1} className="mm-arp-x-sw-led" data-on={i === idx ? '1' : undefined} onClick={() => pick(i)}>
            <span className="mm-arp-led" data-on={i === idx ? '1' : undefined} aria-hidden="true" />
            {s}
          </button>
        ))}
      </div>
      <button type="button" className="mm-arp-k mm-arp-x-sw-key" tabIndex={-1} aria-hidden="true" onClick={() => pick(idx >= steps.length - 1 ? 0 : idx + 1)} />
      <span className="mm-arp-x-label">
        {armed && <span className="mm-arp-led" data-on="1" data-blink="1" aria-hidden="true" />}
        {p.label}
      </span>
      <span className="mm-arp-x-value">{QUALITY_SUB[idx] ?? ''}</span>
    </div>
  );
};

/** La page SOUND+ : les cinq sections, titrees et separees par un filet comme celles de la face. */
export const SoundPlus: React.FC = () => (
  <div className="mm-arp-page mm-arp-sound" role="tabpanel" id="mm-arp-panel-sound" aria-labelledby="mm-arp-tab-sound">
    <KnobDefs />
    {EXTRA_SECTIONS.map((sec) => {
      const list = EXTRA_PARAMS.filter((p) => p.section === sec.id);
      return (
        <section key={sec.id} className="mm-arp-col mm-arp-xgroup" data-sec={sec.id} style={{ flexGrow: sec.id === 'engine' ? 1.35 : list.length }} aria-label={sec.title}>
          <p className="mm-arp-col-title">{sec.title}</p>
          <div className="mm-arp-xrow">{list.map((p) => (p.id === 'xQuality' ? <XSwitch key={p.id} p={p} /> : <XKnob key={p.id} p={p} />))}</div>
        </section>
      );
    })}
  </div>
);
