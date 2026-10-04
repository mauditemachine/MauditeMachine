/**
 * Jumeaux HTML du MM-VOYAGER (2026-10-03), comme ceux de la 808
 * (ui/Hotspots.tsx, Twins) : un element transparent par objet, pose sur sa
 * silhouette projetee dans la passe de rendu, focusable, nomme ; le clavier
 * et les lecteurs d'ecran passent par eux. Ordre : les huit pads
 * d'accords (aria-pressed : dans la progression), RUN/STOP, CLEAR, RANDOM,
 * OPEN, les puces (capot ouvert : celles de la 808 et les pages), les 25 potards (role slider : fleches,
 * Maj ou Page pour 10 %, Debut et Fin). Inertes tant qu'on n'utilise pas
 * le Voyager.
 */

import React, { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { chipAction, editToggle, openToggle, voyClear, voyDial, voyPad, voyRandom, voyRun } from '../actions';
import type { Stage } from '../scene/renderer';
import { editor } from '../state/editor';
import { chipsLive, voyExplode } from '../state/explode';
import { focus } from '../state/focus';
import { section } from '../state/section';
import { BOARD_CHIPS, DIAL_KEYS, OPEN_ARIA } from '../theme';
import { arp } from '../voyager/arp';
import { CHORDS } from '../voyager/chords';
import { VOY_KNOBS, voyParams, voyValueText, type VoyKnobId } from '../voyager/params';
import { VOY_BUTTONS, VOY_COPY } from '../voyager/theme';
import { registerTwin } from './Hotspots';

const r1 = (n: number): number => Math.round(n * 10) / 10;

const noRepeat = (e: React.KeyboardEvent): void => {
  if (e.repeat && (e.key === 'Enter' || e.key === ' ')) e.preventDefault();
};

const title = (label: string): string => label.charAt(0) + label.slice(1).toLowerCase();

/** Un potard au clavier : fleches 2 %, Maj ou Page 10 %, Debut et Fin aux butees ; un cran pour les potards a crans. */
const onKnobKey =
  (id: VoyKnobId, steps: number) =>
  (e: React.KeyboardEvent<HTMLElement>): void => {
    if (e.altKey || e.ctrlKey || e.metaKey) return;
    const unit = steps > 0 ? 1 / steps : DIAL_KEYS.pot.step;
    const big = steps > 0 ? 1 / steps : DIAL_KEYS.pot.big;
    let v = voyParams.of(id);
    switch (e.key) {
      case 'ArrowUp':
      case 'ArrowRight':
        v += e.shiftKey ? big : unit;
        break;
      case 'ArrowDown':
      case 'ArrowLeft':
        v -= e.shiftKey ? big : unit;
        break;
      case 'PageUp':
        v += big;
        break;
      case 'PageDown':
        v -= big;
        break;
      case 'Home':
        v = 0;
        break;
      case 'End':
        v = 1;
        break;
      default:
        return;
    }
    e.preventDefault();
    voyDial(id, Math.round(v * 100) / 100);
  };

export const VoyTwins: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const s = useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  const a = useSyncExternalStore(arp.subscribe, arp.get, arp.get);
  const ed = useSyncExternalStore(editor.subscribe, editor.get, editor.get);
  const params = useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  const open = useSyncExternalStore(section.subscribe, section.get, section.get);
  const els = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const groupRef = useRef<HTMLDivElement>(null);
  const off = f !== 'voy';
  const showChips = s !== 'closed';
  const live = chipsLive(s);

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
        if (id.startsWith('vchip-')) registerTwin(id, el);
      };
      refs.current.set(id, fn);
    }
    return fn;
  };

  useLayoutEffect(() => {
    if (!stage) return undefined;
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
  }, [stage, showChips]);

  return (
    <div ref={groupRef} className="v4-twins" role="group" aria-label={VOY_COPY.group} aria-hidden={off || undefined}>
      {CHORDS.map((c, i) => (
        <button
          key={`vpad-${i}`}
          ref={refFor(`vpad-${i}`)}
          type="button"
          className="v4-twin"
          data-twin="vpad"
          data-hotspot={`vpad-${i}`}
          aria-label={`${c.aria} chord`}
          aria-pressed={a.prog.includes(i)}
          onKeyDown={noRepeat}
          onClick={() => voyPad(i, stageRef.current)}
        />
      ))}
      {VOY_BUTTONS.map((b) => {
        const id = `vbtn-${b.id}`;
        if (b.id === 'open') {
          return (
            <button
              key={id}
              ref={refFor(id)}
              type="button"
              className="v4-twin"
              data-twin="vopen"
              data-hotspot={id}
              aria-label={OPEN_ARIA}
              aria-pressed={s === 'opening' || s === 'open'}
              onKeyDown={noRepeat}
              onClick={() => openToggle(stageRef.current, 'voy')}
            />
          );
        }
        const label =
          b.id === 'run'
            ? a.running
              ? 'Stop the arpeggiator'
              : 'Run the arpeggiator'
            : b.id === 'clear'
              ? 'Clear the chords'
              : b.id === 'edit'
                ? 'Edit the arpeggio sequence'
                : 'Random chord progression';
        const act = (): void =>
          b.id === 'run'
            ? void voyRun(stageRef.current)
            : b.id === 'clear'
              ? voyClear(stageRef.current)
              : b.id === 'edit'
                ? editToggle('voy', stageRef.current)
                : voyRandom(stageRef.current);
        return (
          <button
            key={id}
            ref={refFor(id)}
            type="button"
            className="v4-twin"
            data-twin="vbtn"
            data-hotspot={id}
            aria-label={label}
            aria-pressed={b.id === 'run' ? a.running : b.id === 'edit' ? ed === 'voy' : undefined}
            onKeyDown={noRepeat}
            onClick={act}
          />
        );
      })}
      {showChips &&
        BOARD_CHIPS.map((c) => {
          const id = `vchip-${c.id}`;
          return (
            <button
              key={id}
              ref={refFor(id)}
              type="button"
              className="v4-twin"
              data-twin="vchip"
              data-hotspot={id}
              aria-label={c.aria}
              aria-expanded={c.section !== null && open === c.section}
              aria-controls={c.section ? `v4-section-${c.section}` : undefined}
              tabIndex={live ? 0 : -1}
              onKeyDown={noRepeat}
              onFocus={(e) => {
                if (e.currentTarget.matches(':focus-visible') && stageRef.current?.voy?.setChipFocus(c.id)) stageRef.current.repaint();
              }}
              onBlur={() => {
                if (stageRef.current?.voy?.setChipFocus(null)) stageRef.current.repaint();
              }}
              onClick={() => chipAction(c.id, 'voy')}
            />
          );
        })}
      {VOY_KNOBS.map((k) => {
        const id = `vk-${k.id}`;
        const v = params[k.id];
        const steps = k.steps ? k.steps.length - 1 : 0;
        return (
          <div
            key={id}
            ref={refFor(id)}
            className="v4-twin"
            data-twin="vknob"
            data-hotspot={id}
            role="slider"
            tabIndex={0}
            aria-label={k.aria}
            aria-orientation="vertical"
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(v * 100)}
            aria-valuetext={voyValueText(k.id, v)}
            onKeyDown={onKnobKey(k.id, steps)}
          />
        );
      })}
    </div>
  );
};

export default VoyTwins;
