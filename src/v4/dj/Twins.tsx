/**
 * Jumeaux HTML du MM-DECKS (2026-10-04), comme ceux de la 808 et du MM-ARP :
 * un element transparent par commande, pose sur sa silhouette projetee a
 * chaque image rendue, focusable, nomme. Tab passe de l'une a l'autre ; les
 * lecteurs d'ecran les lisent.
 * - Potards et faders : role slider ; fleches 2 %, Maj ou Page 10 %, Debut
 *   et Fin aux butees, Suppr : la valeur neutre.
 * - Touches : Entree ou Espace ; CUE et BEND agissent tant qu'on les tient.
 * Inertes tant qu'on n'utilise pas le MM-DECKS.
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Stage } from '../scene/renderer';
import { focus } from '../state/focus';
import { faderMin, faderNeutral, faderValue, keyDown, keyUp, knobMin, knobNeutral, knobValue, setFader, setKnob } from './gestures';
import { DJ_FADERS, DJ_KEYS, DJ_KNOBS, type DjFaderSpec, type DjKeySpec, type DjKnobSpec } from './layout';
import { djAddDeck, djTempoStep } from './actions';
import { djState } from './state';
import { DJ_DECKS_MAX, DJ_FX_LABEL, DJ_UNIT, DJ_W, UNIT_X, djDecks } from './theme';
import './dj.css';

const r1 = (n: number): number => Math.round(n * 10) / 10;
const pct = (v: number): number => Math.round(v * 100);

/** Ce qui entre sur chaque voie de la table. */
const CH = ['MM-RYTM', 'MM-ARP', 'deck A', 'deck B', 'deck C', 'deck D'] as const;

function knobName(k: DjKnobSpec): string {
  const t = k.target;
  if (t.kind === 'eq') return `Channel ${t.ch + 1} (${CH[t.ch]}) ${k.label === 'HI' || k.label === 'MID' || k.label === 'LOW' ? `EQ ${k.label}` : k.label}`;
  if (t.kind === 'fx') return `Effect ${DJ_FX_LABEL[t.fx]}`;
  return 'Master volume';
}

function faderName(f: DjFaderSpec): string {
  const t = f.target;
  if (t.kind === 'channel') return `Channel ${t.ch + 1} (${CH[t.ch]}) fader`;
  if (t.kind === 'pitch') return `Deck ${t.deck.toUpperCase()} tempo`;
  return 'Crossfader, deck A to deck B';
}

function keyName(k: DjKeySpec): string {
  const t = k.target;
  switch (t.kind) {
    case 'hotcue':
      return `Deck ${t.deck.toUpperCase()} hot cue ${t.n + 1}`;
    case 'bend':
      return `Deck ${t.deck.toUpperCase()} bend ${t.dir < 0 ? 'slower' : 'faster'} (hold)`;
    case 'cue':
      return `Deck ${t.deck.toUpperCase()} cue (hold to preview)`;
    case 'play':
      return `Deck ${t.deck.toUpperCase()} play or pause`;
    case 'time':
      return `Effects time ${k.label} beat${t.d === 1 ? '' : 's'}`;
    case 'playlist':
      return 'Show or hide the playlist';
    case 'tempo':
      return `Deck ${t.deck.toUpperCase()} pitch ${t.dir < 0 ? 'down' : 'up'} 0.1 BPM (hold to repeat)`;
    case 'sync':
      return `Deck ${t.deck.toUpperCase()} sync: match the tempo you hear`;
    case 'removedeck':
      return `Remove deck ${t.deck.toUpperCase()}`;
  }
}

/** Une valeur au clavier : fleches, Maj ou Page, Debut, Fin, Suppr. Null : la touche ne la change pas. */
function stepValue(e: React.KeyboardEvent, v: number, lo: number, neutral: number): number | null {
  const range = 1 - lo;
  const unit = 0.02 * range;
  const big = 0.1 * range;
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
      return lo;
    case 'End':
      return 1;
    case 'Delete':
    case 'Backspace':
      return neutral;
    default:
      return null;
  }
}

export const DjTwins: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const s = useSyncExternalStore(djState.subscribe, djState.get, djState.get);
  const els = useRef(new Map<string, HTMLElement>());
  const refs = useRef(new Map<string, (el: HTMLElement | null) => void>());
  const stageRef = useRef(stage);
  stageRef.current = stage;
  const groupRef = useRef<HTMLDivElement>(null);
  const addRef = useRef<HTMLButtonElement>(null);
  const decks = useSyncExternalStore(djDecks.subscribe, djDecks.get, djDecks.get);
  const off = f !== 'dj';
  // Le rig arrive apres la scene (chargement a part) : on attend qu'il soit accroche
  const [ready, setReady] = useState(!!stage?.dj);

  useEffect(() => {
    if (!stage || ready) return undefined;
    const check = (): void => {
      if (stage.dj) setReady(true);
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
    /*
     * Le + d'ADD DECK (Mika, 2026-10-04 : "quand on survole la partie
     * droite, un + s'affiche, sinon rien") : une zone juste a droite de la
     * derniere platine, toute la profondeur ; le + n'y parait qu'au survol.
     * Au telephone (sans survol), toute la place du bloc 'add', en bout de
     * defilement, et un + fin toujours visible.
     */
    const touch = window.matchMedia('(hover: none)').matches;
    const out = { x: 0, y: 0 };
    let lastAdd = '';
    const placeAdd = (): void => {
      const el = addRef.current;
      const layer = stage.dj?.top;
      if (!el || !layer) return;
      // Desktop : la marge du cadrage est etroite, le + se tient contre la derniere platine
      const x0 = touch ? UNIT_X.add - DJ_UNIT.addW / 2 : DJ_W / 2 + 0.04;
      const x1 = touch ? UNIT_X.add + DJ_UNIT.addW / 2 : DJ_W / 2 + 1.2;
      const hd = DJ_UNIT.d / 2;
      let minX = Infinity;
      let minY = Infinity;
      let maxX = -Infinity;
      let maxY = -Infinity;
      for (const [x, z] of [
        [x0, -hd],
        [x1, -hd],
        [x1, hd],
        [x0, hd],
      ]) {
        const p = stage.hit.project(layer, x, 0, z, out);
        minX = Math.min(minX, p.x);
        minY = Math.min(minY, p.y);
        maxX = Math.max(maxX, p.x);
        maxY = Math.max(maxY, p.y);
      }
      const k = `${r1(minX)}|${r1(minY)}|${r1(maxX)}|${r1(maxY)}`;
      if (k === lastAdd) return;
      lastAdd = k;
      el.style.transform = `translate(${r1(minX)}px, ${r1(minY)}px)`;
      el.style.width = `${r1(maxX - minX)}px`;
      el.style.height = `${r1(maxY - minY)}px`;
    };
    place(true);
    placeAdd();
    const offView = stage.onView(() => {
      place(false);
      placeAdd();
    });
    const offIdle = stage.onIdle(() => {
      place(false);
      placeAdd();
    });
    return () => {
      offView();
      offIdle();
    };
  }, [stage, ready]);

  if (!ready) return null;

  const held = (k: DjKeySpec): boolean => k.target.kind === 'cue' || k.target.kind === 'bend' || k.target.kind === 'tempo';

  return (
    <div ref={groupRef} className="v4-twins" role="group" aria-label="MM-DECKS DJ decks and mixer" aria-hidden={off || undefined}>
      {decks < DJ_DECKS_MAX && (
        <button
          ref={addRef}
          type="button"
          className="dj-add"
          data-off={off ? '1' : '0'}
          aria-label="Add a deck, with its channel on the mixer"
          title="Add a deck"
          onClick={() => djAddDeck()}
        >
          <span className="dj-add-plus" aria-hidden="true" />
          <span className="dj-add-label" aria-hidden="true">
            ADD DECK
          </span>
        </button>
      )}
      {DJ_KEYS.map((k) => {
        const t = k.target;
        const pressed =
          t.kind === 'play' ? s.deck[t.deck].playing : t.kind === 'hotcue' ? s.deck[t.deck].cues[t.n] !== null : t.kind === 'time' ? s.time === t.d : undefined;
        return (
          <button
            key={k.id}
            ref={refFor(k.id)}
            type="button"
            className="v4-twin"
            data-twin="djkey"
            data-hotspot={k.id}
            aria-label={keyName(k)}
            aria-pressed={pressed}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              if (e.repeat) return;
              keyDown(k, stageRef.current);
              if (!held(k)) keyUp(k, stageRef.current, true);
            }}
            onKeyUp={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              if (held(k)) keyUp(k, stageRef.current, true);
            }}
            onClick={(e) => {
              // Lecteur d'ecran (clic sans pointeur) : un appui complet
              if (e.detail !== 0) return;
              keyDown(k, stageRef.current);
              keyUp(k, stageRef.current, true);
            }}
          />
        );
      })}
      {DJ_KNOBS.map((k) => {
        const v = knobValue(k);
        const lo = knobMin(k);
        return (
          <div
            key={k.id}
            ref={refFor(k.id)}
            className="v4-twin"
            data-twin="djknob"
            data-hotspot={k.id}
            role="slider"
            tabIndex={0}
            aria-label={knobName(k)}
            aria-orientation="vertical"
            aria-valuemin={pct(lo)}
            aria-valuemax={100}
            aria-valuenow={pct(v)}
            aria-valuetext={k.bipolar ? `${pct(v) > 0 ? '+' : ''}${pct(v)}%` : `${pct(v)}%`}
            onKeyDown={(e) => {
              if (e.altKey || e.ctrlKey || e.metaKey) return;
              // La valeur du moment, pas celle du dernier rendu (deux touches rapides)
              const next = stepValue(e, knobValue(k), lo, knobNeutral(k));
              if (next === null) return;
              e.preventDefault();
              e.stopPropagation();
              setKnob(k, Math.max(lo, Math.min(1, Math.round(next * 100) / 100)));
            }}
          />
        );
      })}
      {DJ_FADERS.map((fd) => {
        const v = faderValue(fd);
        const lo = faderMin(fd);
        return (
          <div
            key={fd.id}
            ref={refFor(fd.id)}
            className="v4-twin"
            data-twin="djfader"
            data-hotspot={fd.id}
            role="slider"
            tabIndex={0}
            aria-label={faderName(fd)}
            aria-orientation={fd.across ? 'horizontal' : 'vertical'}
            aria-valuemin={pct(lo)}
            aria-valuemax={100}
            aria-valuenow={pct(v)}
            aria-valuetext={`${pct(v)}%`}
            onKeyDown={(e) => {
              if (e.altKey || e.ctrlKey || e.metaKey) return;
              // Le pitch aux fleches : un dixieme de BPM (Maj : un BPM)
              const tg = fd.target;
              if (tg.kind === 'pitch' && /^Arrow/.test(e.key)) {
                e.preventDefault();
                e.stopPropagation();
                djTempoStep(tg.deck, e.key === 'ArrowUp' || e.key === 'ArrowRight' ? 1 : -1, e.shiftKey ? 1 : 0.1);
                return;
              }
              const next = stepValue(e, faderValue(fd), lo, faderNeutral(fd));
              if (next === null) return;
              e.preventDefault();
              e.stopPropagation();
              setFader(fd, Math.max(lo, Math.min(1, Math.round(next * 100) / 100)));
            }}
          />
        );
      })}
    </div>
  );
};

export default DjTwins;
