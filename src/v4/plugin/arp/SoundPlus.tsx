/**
 * SOUND+ : les reglages du VST3 seul (2026-11-10, Mika : "j'ai de la place pour le plugin en VST3"), le second onglet du
 * panneau du capot (HoodPanel.tsx). Cinq blocs : ENGINE (QUALITY, un interrupteur STD / HQ), LFO 1 (la seconde
 * destination du LFO MOD de la face), LFO 2, REVERB, MASTER. Les valeurs vivent dans plugin/arp/extra.ts ; le pont
 * (bridge.ts) les envoie au C++ comme les potards (mm_param, mm_gesture) et applique celles d'Ableton (mm_knobs).
 *
 * Un potard : glisser vertical (Maj : fin), molette, double-clic = la valeur de depart, fleches (Maj : x10), Debut et
 * Fin. Un potard a crans montre le nom de son cran. En MIDI LEARN, un clic l'arme (il ne bouge pas).
 * SoundPlusButton : capot ferme, la petite serigraphie SOUND+ de la face ouvre le capot sur cet onglet.
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { openToggle } from '../../actions';
import type { Stage } from '../../scene/renderer';
import { voyExplode } from '../../state/explode';
import { arpBridge } from './bridge';
import { arpExtra, EXTRA_PARAMS, EXTRA_SECTIONS, extraStepIndex, type ExtraParam } from './extra';
import { arpMidi } from './midimap';
import { hoodTab } from './tab';

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

const SIZE = 48;
const C = SIZE / 2;
const A0 = -135;
const SWEEP = 270;
const R_ARC = 21.5;

const pt = (deg: number, r: number): [number, number] => {
  const a = ((deg - 90) * Math.PI) / 180;
  return [C + r * Math.cos(a), C + r * Math.sin(a)];
};

function arc(from: number, to: number, r: number): string {
  const [x0, y0] = pt(from, r);
  const [x1, y1] = pt(to, r);
  return `M ${x0.toFixed(2)} ${y0.toFixed(2)} A ${r} ${r} 0 ${to - from > 180 ? 1 : 0} 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`;
}

const useValue = (id: string): number =>
  useSyncExternalStore(
    arpExtra.subscribe,
    () => arpExtra.of(id),
    () => arpExtra.of(id)
  );
const useArpMidi = () => useSyncExternalStore(arpMidi.subscribe, arpMidi.get, arpMidi.get);

const SECTION_NAME: Record<string, string> = { engine: 'Engine', lfo1: 'LFO 1', lfo2: 'LFO 2', reverb: 'Reverb', master: 'Master' };
const ariaName = (p: ExtraParam): string => `${SECTION_NAME[p.section]} ${p.label.toLowerCase()}`;

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
    drag.current = null;
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
  };

  const at = A0 + v * SWEEP;
  const from = bipolar ? A0 + SWEEP / 2 : A0;
  const [mx0, my0] = pt(at, 6);
  const [mx1, my1] = pt(at, 14);
  const text = arpExtra.text(p.id, v);
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
      onDoubleClick={() => {
        if (!arpMidi.get().learning) arpExtra.set(p.id, arpExtra.def(p.id));
      }}
      onKeyDown={onKey}
    >
      <span className="mm-arp-x-label">{p.label}</span>
      <svg className="mm-arp-x-dial" viewBox={`0 0 ${SIZE} ${SIZE}`} width={SIZE} height={SIZE} aria-hidden="true">
        <path className="mm-arp-x-track" d={arc(A0, A0 + SWEEP, R_ARC)} />
        {Math.abs(at - from) > 0.5 && <path className="mm-arp-x-arc" d={from < at ? arc(from, at, R_ARC) : arc(at, from, R_ARC)} />}
        {bipolar && <circle className="mm-arp-x-center" cx={pt(0, R_ARC)[0]} cy={pt(0, R_ARC)[1]} r="1.3" />}
        <circle className="mm-arp-x-skirt" cx={C} cy={C} r="16.5" />
        <circle className="mm-arp-x-cap" cx={C} cy={C} r="14" />
        <line className="mm-arp-x-mark" x1={mx0} y1={my0} x2={mx1} y2={my1} />
      </svg>
      <span className="mm-arp-x-value">{text}</span>
    </div>
  );
};

/** QUALITY : un interrupteur a deux positions (HQ en haut). */
const XSwitch: React.FC<{ p: ExtraParam }> = ({ p }) => {
  const v = useValue(p.id);
  const midi = useArpMidi();
  const steps = p.steps ?? [];
  const idx = extraStepIndex(p.id, v);
  const armed = midi.learning && midi.armed === p.id;
  const pick = (i: number): void => {
    if (arpBridge.learnArm(p.id)) return;
    arpExtra.set(p.id, i / Math.max(1, steps.length - 1));
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
  };
  return (
    <div className="mm-arp-x mm-arp-x-switch" data-x={p.id} data-mm-learn={armed ? 'armed' : undefined} data-learning={midi.learning ? '1' : undefined} title={p.help}>
      <span className="mm-arp-x-label">{p.label}</span>
      <div className="mm-arp-x-sw" role="radiogroup" aria-label={ariaName(p)} onKeyDown={onKey}>
        {steps
          .map((s, i) => ({ s, i }))
          .reverse()
          .map(({ s, i }) => (
            <button key={s} type="button" role="radio" aria-checked={i === idx} tabIndex={i === idx ? 0 : -1} className="mm-arp-x-sw-key" data-on={i === idx ? '1' : undefined} onClick={() => pick(i)}>
              <span className="mm-arp-led" aria-hidden="true" />
              {s}
            </button>
          ))}
      </div>
      <span className="mm-arp-x-value">{QUALITY_SUB[idx] ?? ''}</span>
    </div>
  );
};

/** L'onglet SOUND+ : les cinq blocs. */
export const SoundPlus: React.FC = () => (
  <div className="mm-arp-sound" role="tabpanel" id="mm-arp-panel-sound" aria-label="Sound plus, the VST3 only settings">
    {EXTRA_SECTIONS.map((sec) => {
      const list = EXTRA_PARAMS.filter((p) => p.section === sec.id);
      return (
        <section key={sec.id} className="mm-arp-col mm-arp-xgroup" style={{ flexGrow: list.length }} aria-label={sec.title}>
          <p className="mm-arp-col-title">{sec.title}</p>
          <div className="mm-arp-xrow">{list.map((p) => (p.id === 'xQuality' ? <XSwitch key={p.id} p={p} /> : <XKnob key={p.id} p={p} />))}</div>
        </section>
      );
    })}
  </div>
);

/** Capot ferme : la serigraphie SOUND+ de la face, qui ouvre le capot sur son onglet. */
export const SoundPlusButton: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const hood = useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  const quality = useValue('xQuality');
  if (hood !== 'closed') return null;
  return (
    <button
      type="button"
      className="mm-arp-soundplus"
      style={{ position: 'fixed' }}
      title="The VST3 only settings: HQ engine, LFO 2, reverb, master"
      aria-label="Open the sound plus settings"
      onClick={() => {
        hoodTab.set('sound');
        openToggle(stage, 'voy');
      }}
    >
      <span className="mm-arp-led" data-on={quality >= 0.5 ? '1' : undefined} aria-hidden="true" />
      SOUND+
    </button>
  );
};
