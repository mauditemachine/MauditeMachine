/**
 * Jumeaux HTML du MM-SMPL (2026-10-04), comme ceux du MM-DECKS : un element
 * transparent par commande, pose sur sa silhouette projetee a chaque image
 * rendue, focusable, nomme. Tab passe de l'un a l'autre.
 * - Potards : role slider ; fleches 2 %, Maj ou Page 10 %, Debut et Fin aux
 *   butees, Suppr : la valeur de depart.
 * - Touches, PLAY : Entree ou Espace ; pads : tenus tant que la touche
 *   l'est (GRAIN, LOOP).
 * Inertes tant qu'on n'utilise pas le MM-SMPL.
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Stage } from '../scene/renderer';
import { focus } from '../state/focus';
import { smplDial, smplLoadFile, smplPad, smplPlayToggle } from './actions';
import { listenSmplKeys } from './keys';
import { keyAction } from './gestures';
import { SMPL_KNOBS, smplParams, smplValueText } from './params';
import { SMPL_PLAY_ID, smplKeyId, smplKnobId, smplPadId } from './rig';
import { SMPL_PADS } from './slices';
import { padSlice, smplState } from './state';
import { SMPL_KEYS } from './theme';

const r1 = (n: number): number => Math.round(n * 10) / 10;
const pct = (v: number): number => Math.round(v * 100);

function stepValue(e: React.KeyboardEvent, v: number, neutral: number): number | null {
  switch (e.key) {
    case 'ArrowUp':
    case 'ArrowRight':
      return v + (e.shiftKey ? 0.1 : 0.02);
    case 'ArrowDown':
    case 'ArrowLeft':
      return v - (e.shiftKey ? 0.1 : 0.02);
    case 'PageUp':
      return v + 0.1;
    case 'PageDown':
      return v - 0.1;
    case 'Home':
      return 0;
    case 'End':
      return 1;
    case 'Delete':
    case 'Backspace':
      return neutral;
    default:
      return null;
  }
}

export const SmplTwins: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const s = useSyncExternalStore(smplState.subscribe, smplState.get, smplState.get);
  const v = useSyncExternalStore(smplParams.subscribe, smplParams.get, smplParams.get);
  const els = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const groupRef = useRef<HTMLDivElement>(null);
  const off = f !== 'smpl';
  const [ready, setReady] = useState(!!stage?.smpl);

  useEffect(() => {
    if (!stage || ready) return undefined;
    const check = (): void => {
      if (stage.smpl) setReady(true);
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
  }, [off]);

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

  // Le clavier (smpl/keys.ts), et un fichier audio depose sur la page : le sample
  const stageRef = useRef(stage);
  stageRef.current = stage;
  useEffect(() => listenSmplKeys(() => stageRef.current, () => focus.get() === 'smpl'), []);
  useEffect(() => {
    const isAudio = (e: DragEvent): boolean => focus.get() === 'smpl' && !!e.dataTransfer && [...e.dataTransfer.items].some((it) => it.kind === 'file' && (it.type.startsWith('audio/') || it.type === ''));
    const over = (e: DragEvent): void => {
      if (!isAudio(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const drop = (e: DragEvent): void => {
      if (!isAudio(e)) return;
      e.preventDefault();
      const file = [...(e.dataTransfer?.files ?? [])].find((fl) => fl.type.startsWith('audio/') || /\.(wav|aiff?|mp3|m4a|flac|ogg)$/i.test(fl.name));
      if (file) void smplLoadFile(file);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, []);

  useLayoutEffect(() => {
    if (!stage || !ready) return undefined;
    const last = new Map<string, string>();
    const place = (): void => {
      const ids = stage.hit.ids();
      const r = stage.hit.rects();
      for (let i = 0; i < ids.length; i += 1) {
        const id = ids[i];
        if (!id.startsWith('smpl-')) continue;
        const el = els.current.get(id);
        if (!el) continue;
        const o = i * 4;
        const k = `${r1(r[o])}|${r1(r[o + 1])}|${r1(r[o + 2])}|${r1(r[o + 3])}`;
        if (last.get(id) === k) continue;
        last.set(id, k);
        el.style.transform = `translate(${r1(r[o])}px, ${r1(r[o + 1])}px)`;
        el.style.width = `${r1(r[o + 2])}px`;
        el.style.height = `${r1(r[o + 3])}px`;
      }
    };
    place();
    const a = stage.onView(place);
    const b = stage.onIdle(place);
    return () => {
      a();
      b();
    };
  }, [stage, ready]);

  if (!ready) return null;
  const press = (id: string, down: boolean): void => stage?.smpl?.pressKey(id, down);
  const dur = s.sample?.duration ?? 0;

  return (
    <div ref={groupRef} className="v4-twins" role="group" aria-label="MM-SMPL sampler, slicer and granular" aria-hidden={off || undefined}>
      {SMPL_KEYS.map((k) => {
        const id = smplKeyId(k.kind);
        const pressed = k.kind === 'rev' ? s.reverse : k.kind === 'loop' ? s.loop : k.kind === 'rec' ? s.recording : k.kind === 'mode' ? s.mode === 'grain' : undefined;
        return (
          <button
            key={id}
            ref={refFor(id)}
            type="button"
            className="v4-twin"
            data-twin="smplkey"
            data-hotspot={id}
            aria-label={k.kind === 'mode' ? `${k.aria} (now ${s.mode})` : k.kind === 'slices' ? `${k.aria} (now ${s.slicing})` : k.aria}
            aria-pressed={pressed}
            onClick={() => {
              press(id, true);
              keyAction(k.kind);
              window.setTimeout(() => press(id, false), 120);
            }}
          />
        );
      })}
      <button
        ref={refFor(SMPL_PLAY_ID)}
        type="button"
        className="v4-twin"
        data-twin="smplkey"
        data-hotspot={SMPL_PLAY_ID}
        aria-label={s.mode === 'grain' ? 'Play or stop the grain cloud at POSITION' : 'Play or stop the whole region'}
        aria-pressed={s.preview}
        onClick={() => {
          press(SMPL_PLAY_ID, true);
          smplPlayToggle();
          window.setTimeout(() => press(SMPL_PLAY_ID, false), 120);
        }}
      />
      {Array.from({ length: SMPL_PADS }, (_, i) => {
        const id = smplPadId(i);
        const sl = padSlice(i);
        return (
          <button
            key={id}
            ref={refFor(id)}
            type="button"
            className="v4-twin"
            data-twin="smplpad"
            data-hotspot={id}
            aria-label={sl ? `Pad ${i + 1}: ${s.mode === 'grain' ? 'grain cloud at' : 'slice'} ${sl.a.toFixed(2)} s${s.mode === 'grain' ? '' : ` to ${sl.b.toFixed(2)} s`}` : `Pad ${i + 1}: no slice`}
            aria-pressed={s.pads.includes(i)}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              if (e.repeat) return;
              press(id, true);
              smplPad(i, true);
            }}
            onKeyUp={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              press(id, false);
              smplPad(i, false);
            }}
            onClick={(e) => {
              // Lecteur d'ecran (clic sans pointeur) : un appui complet
              if (e.detail !== 0) return;
              smplPad(i, true);
              window.setTimeout(() => smplPad(i, false), 400);
            }}
          />
        );
      })}
      {SMPL_KNOBS.map((k) => {
        const id = smplKnobId(k.id);
        const val = v[k.id];
        return (
          <div
            key={id}
            ref={refFor(id)}
            className="v4-twin"
            data-twin="smplknob"
            data-hotspot={id}
            role="slider"
            tabIndex={0}
            aria-label={k.aria}
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={pct(val)}
            aria-valuetext={smplValueText(k.id, val, dur)}
            onKeyDown={(e) => {
              if (e.altKey || e.ctrlKey || e.metaKey) return;
              const next = stepValue(e, smplParams.of(k.id), k.def);
              if (next === null) return;
              e.preventDefault();
              e.stopPropagation();
              smplDial(k.id, Math.round(next * 1000) / 1000);
            }}
          />
        );
      })}
    </div>
  );
};

export default SmplTwins;
