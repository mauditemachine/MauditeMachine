/**
 * Jumeaux HTML du MM-BASS (2026-10-07), comme ceux du MM-DECKS : un element
 * transparent par commande, pose sur sa silhouette projetee a chaque image
 * rendue, focusable, nomme. Tab passe de l'une a l'autre ; les lecteurs
 * d'ecran les lisent.
 * - Potards : role slider ; fleches 2 % (un cran pour les selecteurs), Maj
 *   ou Page 10 %, Debut et Fin aux butees, Suppr : la valeur de depart.
 * - Touches et pas : Entree ou Espace.
 * Inertes tant qu'on n'utilise pas le MM-BASS. Le clavier de la machine
 * (bass/keys.ts) s'ecoute ici.
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Stage } from '../scene/renderer';
import { focus } from '../state/focus';
import { bassDial, bassStepTap, noteName } from './actions';
import { bassKeyAction } from './gestures';
import { listenBassKeys } from './keys';
import { BASS_KNOBS, bassParams, bassValueText } from './params';
import { bassKeyId, bassKnobId, bassTrigId } from './rig';
import { midiOf } from './seq';
import { BASS_STEPS, bassState } from './state';
import { BASS_KEYS } from './theme';

const r1 = (n: number): number => Math.round(n * 10) / 10;
const pct = (v: number): number => Math.round(v * 100);

function stepValue(e: React.KeyboardEvent, v: number, def: number, notch: number): number | null {
  const unit = notch || 0.02;
  const big = notch || 0.1;
  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return v + (e.shiftKey ? big : unit);
    case 'ArrowDown':
    case 'ArrowLeft':
      return v - (e.shiftKey ? big : unit);
    case 'PageUp':
      return v + big;
    case 'PageDown':
      return v - big;
    case 'Home':
      return 0;
    case 'End':
      return 1;
    case 'Delete':
    case 'Backspace':
      return def;
    default:
      return null;
  }
}

export const BassTwins: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const s = useSyncExternalStore(bassState.subscribe, bassState.get, bassState.get);
  const v = useSyncExternalStore(bassParams.subscribe, bassParams.get, bassParams.get);
  const els = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const groupRef = useRef<HTMLDivElement>(null);
  const off = f !== 'bass';
  const onRef = useRef(!off);
  onRef.current = !off;
  // Le rig arrive apres la scene (chargement a part) : on attend qu'il soit accroche
  const [ready, setReady] = useState(!!stage?.bass);

  useEffect(() => listenBassKeys(() => stageRef.current, () => onRef.current), []);

  useEffect(() => {
    if (!stage || ready) return undefined;
    const check = (): void => {
      if (stage.bass) setReady(true);
    };
    check();
    const a = stage.onView(check);
    const b = stage.onIdle(check);
    return () => {
      a();
      b();
    };
  }, [stage, ready]);

  useEffect(() => {
    const el = groupRef.current;
    if (!el) return;
    if (off) el.setAttribute('inert', '');
    else el.removeAttribute('inert');
  }, [off, ready]);

  const refFor = (id: string): ((el: HTMLElement | null) => void) => {
    let fn = refs.current.get(id);
    if (!fn) {
      fn = (el) => {
        if (el) els.current.set(id, el);
        else els.current.delete(id);
      };
      refs.current.set(id, fn);
    }
    return fn;
  };

  useLayoutEffect(() => {
    if (!stage || !ready) return undefined;
    const ids = stage.hit.ids();
    const last = new Float64Array(ids.length * 4).fill(NaN);
    const place = (force: boolean): void => {
      const r = stage.hit.rects();
      for (let i = 0; i < ids.length; i += 1) {
        const el = els.current.get(ids[i]);
        if (!el) continue;
        const o = i * 4;
        const x = r1(r[o]);
        const y = r1(r[o + 1]);
        const w = r1(r[o + 2]);
        const h = r1(r[o + 3]);
        if (force || x !== last[o] || y !== last[o + 1]) {
          el.style.transform = `translate(${x}px, ${y}px)`;
          last[o] = x;
          last[o + 1] = y;
        }
        if (force || w !== last[o + 2] || h !== last[o + 3]) {
          el.style.width = `${w}px`;
          el.style.height = `${h}px`;
          last[o + 2] = w;
          last[o + 3] = h;
        }
      }
    };
    place(true);
    const offView = stage.onView(() => place(false));
    const offIdle = stage.onIdle(() => place(false));
    return () => {
      offView();
      offIdle();
    };
  }, [stage, ready]);

  if (!ready) return null;

  const press = (id: string, fn: () => void): void => {
    stageRef.current?.bass?.pressKey(id, true);
    fn();
    window.setTimeout(() => stageRef.current?.bass?.pressKey(id, false), 120);
  };
  const sel = s.steps[s.sel];

  return (
    <div ref={groupRef} className="v4-twins" role="group" aria-label="MM-BASS bassline generator" aria-hidden={off || undefined}>
      {BASS_KNOBS.map((k) => {
        const val = v[k.id];
        const notch = k.steps && k.steps > 1 ? 1 / (k.steps - 1) : 0;
        const id = bassKnobId(k.id);
        return (
          <div
            key={id}
            ref={refFor(id)}
            className="v4-twin"
            data-twin="bassknob"
            data-hotspot={id}
            role="slider"
            tabIndex={0}
            aria-label={k.aria}
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct(val)}
            aria-valuetext={bassValueText(k.id, val)}
            onKeyDown={(e) => {
              if (e.altKey || e.ctrlKey || e.metaKey) return;
              const next = stepValue(e, bassParams.of(k.id), k.def, notch);
              if (next === null) return;
              e.preventDefault();
              e.stopPropagation();
              bassDial(k.id, Math.max(0, Math.min(1, notch ? next : Math.round(next * 100) / 100)));
            }}
          />
        );
      })}
      {BASS_KEYS.map((k) => {
        const id = bassKeyId(k.kind);
        const pressed = k.kind === 'run' ? s.running : k.kind === 'accent' ? sel.kind === 'note' && sel.acc : k.kind === 'slide' ? sel.kind !== 'off' && sel.slide : undefined;
        return (
          <button
            key={id}
            ref={refFor(id)}
            type="button"
            className="v4-twin"
            data-twin="basskey"
            data-hotspot={id}
            aria-label={k.aria}
            aria-pressed={pressed}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              if (e.repeat) return;
              press(id, () => bassKeyAction(k.kind));
            }}
            onClick={(e) => {
              // Lecteur d'ecran (clic sans pointeur) : un appui complet
              if (e.detail !== 0) return;
              press(id, () => bassKeyAction(k.kind));
            }}
          />
        );
      })}
      {Array.from({ length: BASS_STEPS }, (_, i) => {
        const id = bassTrigId(i);
        const st = s.steps[i];
        const what = st.kind === 'off' ? 'off' : st.kind === 'tie' ? 'tie' : `${noteName(midiOf(st))}${st.acc ? ', accent' : ''}${st.slide ? ', slide' : ''}`;
        return (
          <button
            key={id}
            ref={refFor(id)}
            type="button"
            className="v4-twin"
            data-twin="basstrig"
            data-hotspot={id}
            aria-label={`Step ${i + 1}: ${what}${s.sel === i ? ', chosen' : ''}`}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              e.stopPropagation();
              if (e.repeat) return;
              press(id, () => bassStepTap(i));
            }}
            onClick={(e) => {
              if (e.detail !== 0) return;
              press(id, () => bassStepTap(i));
            }}
          />
        );
      })}
    </div>
  );
};

export default BassTwins;
