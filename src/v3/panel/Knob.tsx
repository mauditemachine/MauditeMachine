/**
 * Un bouton du 303 : SVG (anneau de 11 graduations sur 270 degres, capuchon
 * encre, index cream), role slider, drag vertical (1 px = 0.6 %), molette
 * (1 % par cran), fleches, double-clic = defaut, infobulle apres 250 ms.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KNOB_DEFAULTS, KNOB_LABELS, KNOB_TIPS, knobs, useKnobs, type KnobKey } from '../state/knobs';

interface KnobProps {
  id: KnobKey;
  reduced: boolean;
  isTouch: boolean;
}

const TICKS = Array.from({ length: 11 }, (_, i) => -135 + (270 * i) / 10);

const Knob: React.FC<KnobProps> = ({ id, reduced, isTouch }) => {
  const values = useKnobs();
  const value = values[id];
  const [tip, setTip] = useState(false);
  const tipTimer = useRef<number | undefined>(undefined);
  const drag = useRef<{ y0: number; v0: number } | null>(null);
  const lastTap = useRef(0);
  const dialRef = useRef<HTMLDivElement>(null);

  const label = KNOB_LABELS[id];
  const inert = reduced && (id === 'envmod' || id === 'decay');
  const tipText = KNOB_TIPS[id] + (inert ? ' (inert in calm mode)' : '');
  const pct = Math.round(value * 100);

  const set = useCallback((v: number) => knobs.set(id, v), [id]);

  // Molette : listener natif non passif (React ne laisse pas preventDefault ici)
  useEffect(() => {
    const el = dialRef.current;
    if (!el) return;
    const onWheel = (e: WheelEvent) => {
      e.preventDefault();
      e.stopPropagation();
      knobs.set(id, knobs.get()[id] + (e.deltaY < 0 ? 0.01 : -0.01));
    };
    el.addEventListener('wheel', onWheel, { passive: false });
    return () => el.removeEventListener('wheel', onWheel);
  }, [id]);

  useEffect(() => () => window.clearTimeout(tipTimer.current), []);

  const showTip = (delay: number) => {
    window.clearTimeout(tipTimer.current);
    tipTimer.current = window.setTimeout(() => setTip(true), delay);
  };
  const hideTip = (delay = 0) => {
    window.clearTimeout(tipTimer.current);
    if (delay) tipTimer.current = window.setTimeout(() => setTip(false), delay);
    else setTip(false);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.currentTarget.setPointerCapture(e.pointerId);
    drag.current = { y0: e.clientY, v0: value };
    if (e.pointerType !== 'mouse') {
      // Double tap = defaut
      const now = e.timeStamp;
      if (now - lastTap.current < 300) knobs.reset(id);
      lastTap.current = now;
    }
    showTip(0);
  };
  const onPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    set(drag.current.v0 + (drag.current.y0 - e.clientY) * 0.006);
  };
  const onPointerUp = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!drag.current) return;
    drag.current = null;
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* rien */
    }
    if (e.pointerType === 'mouse') hideTip(250);
    else hideTip(600);
  };

  const onKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const big = e.shiftKey ? 0.1 : 0.01;
    let handled = true;
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        set(value + big);
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        set(value - big);
        break;
      case 'Home':
        set(0);
        break;
      case 'End':
        set(1);
        break;
      case 'PageUp':
        set(value + 0.1);
        break;
      case 'PageDown':
        set(value - 0.1);
        break;
      default:
        handled = false;
    }
    if (handled) {
      e.preventDefault();
      e.stopPropagation();
    }
  };

  const angle = -135 + 270 * value;

  return (
    <div className="v3-knob" data-knob={id}>
      <div
        ref={dialRef}
        className="v3-knob-dial"
        role="slider"
        tabIndex={0}
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={pct}
        aria-valuetext={`${pct} percent`}
        aria-describedby={`v3-knob-tip-${id}`}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onPointerCancel={onPointerUp}
        onDoubleClick={() => knobs.reset(id)}
        onKeyDown={onKeyDown}
        onMouseEnter={() => !isTouch && showTip(250)}
        onMouseLeave={() => !drag.current && hideTip()}
        onFocus={() => showTip(250)}
        onBlur={() => hideTip()}
      >
        <svg viewBox="0 0 64 64" aria-hidden="true" focusable="false">
          {TICKS.map((a) => (
            <line
              key={a}
              x1="32"
              y1="2.5"
              x2="32"
              y2={a === -135 || a === 135 ? '6.5' : '5'}
              transform={`rotate(${a} 32 32)`}
              className="v3-knob-tick"
            />
          ))}
          <circle cx="32" cy="32" r="22" className="v3-knob-cap" />
          <circle cx="32" cy="32" r="18" className="v3-knob-cap-inner" />
          <line x1="32" y1="13" x2="32" y2="22" className="v3-knob-index" transform={`rotate(${angle} 32 32)`} />
        </svg>
      </div>
      <span className="v3-label v3-knob-label">{label}</span>
      <span
        id={`v3-knob-tip-${id}`}
        className={`v3-knob-tip${tip ? ' is-on' : ''}`}
        role="tooltip"
      >
        {tipText}
        <em>{value === KNOB_DEFAULTS[id] ? ' (default)' : ''}</em>
      </span>
    </div>
  );
};

export default Knob;
