/**
 * L'editeur EDIT du MM-BASS (2026-10-10, Mika : "tu vois, j'aime bien cette fenetre EDIT du RYTM, je la prefere a
 * l'autre grand ecran de BASS") : le panneau du MM-RYTM (ui/BeatEditor.tsx), pose sur la machine a la place de sa
 * rangee de pas au desktop (il la couvre et la suit, ses seize colonnes sur les seize pas), sous elle au telephone.
 * - PTN : les seize patterns (taper : le pattern ; plusieurs dans les deux secondes : la chaine ; tenir un vide : y
 *   copier la ligne courante).
 * - La grille : une rangee par note de la gamme (deux octaves, les toniques marquees), une colonne par pas. Taper une
 *   case : la note du pas a cette hauteur ; taper la note : le pas se vide ; glisser le long d'une rangee : la meme note
 *   sur les pas traverses (parti d'une note : on les vide). Une liaison prolonge la note d'avant, plus pale.
 * - ACC, SLIDE, TIE : un interrupteur par pas ; LEN : la longueur de la ligne (taper ou glisser jusqu'au pas voulu).
 * - CLEAR vide la ligne (et ses FX, comme la touche) ; DONE, EDIT, E ou Echap referment.
 * La tete de lecture suit le sequenceur (bassSeq.stepAt).
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore, type RefObject } from 'react';
import type { Stage } from '../scene/renderer';
import { editor } from '../state/editor';
import { useEditorPanel } from '../ui/editorPanel';
import { bassClear, bassEditNote, bassGridSet, bassLenSet, bassPatternHold, bassPatternTap, bassStepVel, noteName } from './actions';
import { BASS_SCALES, SCALE_TONES, bassParams, stepOf } from './params';
import { BASS_SLOTS, bassPatterns } from './patterns';
import { bassSeq, midiOf } from './seq';
import { BASS_STEPS, bassState, type BassStep } from './state';

const STEPS = Array.from({ length: BASS_STEPS }, (_, i) => i);
const HOLD_MS = 500;

/** Le nombre de notes de la gamme (7, la pentatonique 5). */
function scaleLen(): number {
  const v = bassParams.get();
  return SCALE_TONES[BASS_SCALES[stepOf('scale', v.scale)]].length;
}

/** La rangee d'une note (0 : la tonique de l'octave -1) ; une liaison : celle de la note qu'elle prolonge ; null : rien. */
function rowOf(steps: readonly BassStep[], i: number, L: number): number | null {
  for (let k = 0; k < BASS_STEPS; k += 1) {
    const s = steps[(i - k + BASS_STEPS) % BASS_STEPS];
    if (s.kind === 'off') return null;
    if (s.kind === 'note') return (s.oct + 1) * L + s.deg;
  }
  return null;
}

const PatternRow: React.FC = () => {
  const p = useSyncExternalStore(bassPatterns.subscribe, bassPatterns.get, bassPatterns.get);
  const hold = useRef<{ i: number; t: number; fired: boolean } | null>(null);
  return (
    <div className="v4-beat-ptns" role="group" aria-label="Bass patterns 1 to 16">
      {Array.from({ length: BASS_SLOTS }, (_, i) => {
        const inChain = p.chain.length > 1 ? p.chain.indexOf(i) : -1;
        const full = bassPatterns.filled(i);
        return (
          <button
            key={i}
            type="button"
            className="v4-beat-ptn"
            data-cur={i === p.cur ? '1' : '0'}
            data-next={i === p.next ? '1' : '0'}
            data-chain={inChain >= 0 ? '1' : '0'}
            data-full={full ? '1' : '0'}
            aria-pressed={i === p.cur}
            aria-label={`Pattern ${i + 1}${full ? '' : ', empty'}${inChain >= 0 ? `, chain position ${inChain + 1}` : ''}`}
            onPointerDown={() => {
              const t = window.setTimeout(() => {
                if (hold.current?.i === i) {
                  hold.current.fired = true;
                  bassPatternHold(i);
                }
              }, HOLD_MS);
              hold.current = { i, t, fired: false };
            }}
            onPointerUp={() => {
              const h = hold.current;
              hold.current = null;
              if (!h || h.i !== i) return;
              window.clearTimeout(h.t);
              if (!h.fired) bassPatternTap(i);
            }}
            onPointerCancel={() => {
              if (hold.current) window.clearTimeout(hold.current.t);
              hold.current = null;
            }}
            onKeyDown={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              bassPatternTap(i);
            }}
          >
            {String(i + 1).padStart(2, '0')}
          </button>
        );
      })}
    </div>
  );
};

/** La tete de lecture : le pas qui joue, -1 a l'arret (relu a chaque image pendant la lecture). */
function usePlayhead(on: boolean): number {
  const [head, setHead] = useState(-1);
  useEffect(() => {
    if (!on) return undefined;
    let raf = 0;
    let last = -2;
    const tick = (): void => {
      const at = bassSeq.running ? bassSeq.stepAt(bassSeq.now()) : -1;
      if (at !== last) {
        last = at;
        setHead(at);
      }
      raf = window.requestAnimationFrame(tick);
    };
    tick();
    return () => window.cancelAnimationFrame(raf);
  }, [on]);
  return head;
}

/** Un geste dans la grille : il pose une note (et la peint le long de la rangee) ou vide les pas. */
interface Grip {
  id: number;
  row: number;
  c: number;
  last: number;
  mode: 'paint' | 'erase';
  moved: boolean;
}

/** Un geste sur la rangee LEN. */
interface LenGrip {
  id: number;
}

export const BassEditor: React.FC<{ variant: 'desk' | 'mobile'; shown: boolean }> = ({ variant, shown }) => {
  const st = useSyncExternalStore(bassState.subscribe, bassState.get, bassState.get);
  const params = useSyncExternalStore(bassParams.subscribe, bassParams.get, bassParams.get);
  const head = usePlayhead(shown);
  const L = scaleLen();
  const span = 2 * L + 1;
  const total = 3 * L + 1;
  const grid = useRef<HTMLDivElement>(null);
  const lenLane = useRef<HTMLDivElement>(null);
  const grip = useRef<Grip | null>(null);
  const lenGrip = useRef<LenGrip | null>(null);
  // La fenetre des rangees (la plus basse affichee) : posee a l'ouverture pour montrer toute la ligne
  const [start, setStart] = useState(0);
  useEffect(() => {
    if (!shown) return;
    const rows = STEPS.map((i) => (st.steps[i].kind === 'note' ? rowOf(st.steps, i, L) : null)).filter((r): r is number => r !== null);
    if (!rows.length) {
      setStart(0);
      return;
    }
    const lo = Math.min(...rows);
    const hi = Math.max(...rows);
    let s0 = hi - lo < span ? Math.max(0, Math.min(lo, hi - span + 1 + Math.floor((span - 1 - (hi - lo)) / 2))) : lo;
    s0 = Math.max(0, Math.min(total - span, s0));
    setStart(s0);
    // A l'ouverture et quand la gamme change de taille seulement
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [shown, L]);

  const rows = Array.from({ length: span }, (_, k) => start + span - 1 - k);
  const rowName = (r: number): string => {
    const o = Math.floor(r / L) - 1;
    const d = r % L;
    return noteName(midiOf({ kind: 'note', deg: d, oct: o, acc: false, slide: false }));
  };

  const cellAt = (x: number, y: number): { row: number; c: number } | null => {
    const el = grid.current;
    if (!el) return null;
    const rect = el.getBoundingClientRect();
    if (x < rect.left || x > rect.right || y < rect.top || y > rect.bottom) return null;
    const k = Math.min(span - 1, Math.max(0, Math.floor(((y - rect.top) / rect.height) * span)));
    const c = Math.min(BASS_STEPS - 1, Math.max(0, Math.floor(((x - rect.left) / rect.width) * BASS_STEPS)));
    return { row: rows[k], c };
  };
  const colAt = (x: number, el: HTMLElement | null): number => {
    if (!el) return 0;
    const rect = el.getBoundingClientRect();
    return Math.min(BASS_STEPS - 1, Math.max(0, Math.floor(((x - rect.left) / rect.width) * BASS_STEPS)));
  };
  const place = (c: number, row: number): void => {
    bassEditNote(c, row % L, Math.floor(row / L) - 1);
  };
  const noteRow = (c: number): number | null => (bassState.get().steps[c].kind === 'note' ? rowOf(bassState.get().steps, c, L) : null);

  const onGridDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (e.button !== 0) return;
    const at = cellAt(e.clientX, e.clientY);
    if (!at) return;
    e.preventDefault();
    try {
      e.currentTarget.setPointerCapture(e.pointerId);
    } catch {
      /* pointeur deja relache */
    }
    const here = noteRow(at.c) === at.row;
    if (!here) place(at.c, at.row);
    grip.current = { id: e.pointerId, row: at.row, c: at.c, last: at.c, mode: here ? 'erase' : 'paint', moved: false };
  };
  const onGridMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    const c = colAt(e.clientX, grid.current);
    if (c === g.last) return;
    g.moved = true;
    const dir = c > g.last ? 1 : -1;
    for (let j = g.last + dir; j !== c + dir; j += dir) {
      if (g.mode === 'paint') place(j, g.row);
      else if (noteRow(j) === g.row) bassGridSet(j, 'off');
    }
    // Parti d'une note : elle s'en va aussi
    if (g.mode === 'erase' && g.last === g.c && noteRow(g.c) === g.row) bassGridSet(g.c, 'off');
    g.last = c;
  };
  const onGridUp = (e: React.PointerEvent<HTMLDivElement>, cancel: boolean): void => {
    const g = grip.current;
    if (!g || g.id !== e.pointerId) return;
    grip.current = null;
    // Une tape sur la note : le pas se vide
    if (!cancel && !g.moved && g.mode === 'erase') bassGridSet(g.c, 'off');
  };

  const onLen = (x: number): void => bassLenSet(colAt(x, lenLane.current) + 1);

  // VEL (2026-10-10) : la velocite de chaque note, son verrou de VOLUME ; glisser dessine les barres (les pas traverses
  // suivent la ligne), deux clics sur une barre : celle de la ligne
  const velLane = useRef<HTMLDivElement>(null);
  const velDraw = useRef<{ id: number; i: number; v: number } | null>(null);
  const velAt = (y: number): number => {
    const el = velLane.current;
    if (!el) return 1;
    const r = el.getBoundingClientRect();
    return Math.min(1, Math.max(0.05, (r.bottom - y) / r.height));
  };
  const onVel = (x: number, y: number): void => {
    const d = velDraw.current;
    if (!d) return;
    const i = colAt(x, velLane.current);
    const v = velAt(y);
    if (d.i >= 0 && Math.abs(i - d.i) > 1) {
      const dir = i > d.i ? 1 : -1;
      for (let j = d.i + dir; j !== i; j += dir) bassStepVel(j, d.v + ((v - d.v) * (j - d.i)) / (i - d.i));
    }
    bassStepVel(i, v);
    velDraw.current = { id: d.id, i, v };
  };

  const steps = st.steps;
  const len = st.len;
  const lane = (what: 'acc' | 'slide' | 'tie', label: string): React.ReactElement => (
    <div className="v4-beat-main v4-bassed-lanerow">
      <span className="v4-beat-lanelabel">{label}</span>
      <div className="v4-bassed-lane" role="group" aria-label={label}>
        {STEPS.map((i) => {
          const s = steps[i];
          const on = what === 'tie' ? s.kind === 'tie' : s.kind === 'note' && (what === 'acc' ? s.acc : s.slide);
          const can = what === 'tie' ? s.kind === 'tie' || steps[(i + BASS_STEPS - 1) % BASS_STEPS].kind !== 'off' : s.kind === 'note';
          return (
            <button
              key={i}
              type="button"
              className="v4-bassed-sw"
              data-on={on ? '1' : '0'}
              data-can={can ? '1' : '0'}
              data-play={head === i ? '1' : '0'}
              data-out={i >= len ? '1' : '0'}
              aria-pressed={on}
              aria-label={`${label} step ${i + 1}`}
              onClick={() => bassGridSet(i, what)}
            />
          );
        })}
      </div>
    </div>
  );

  const sel = steps[st.sel];
  const selRow = sel && sel.kind !== 'off' ? rowOf(steps, st.sel, L) : null;
  const selText = sel ? `STEP ${String(st.sel + 1).padStart(2, '0')}  ${sel.kind === 'off' ? 'OFF' : sel.kind === 'tie' ? 'TIE' : selRow !== null ? rowName(selRow) : ''}` : '';

  return (
    <div className="v4-seq-body v4-beat-body v4-bassed" data-variant={variant} data-edit="1" style={{ '--rows': span } as React.CSSProperties}>
      <div className="v4-beat-main v4-beat-ptnrow">
        <span className="v4-beat-lanelabel">PTN</span>
        <PatternRow />
      </div>
      <div className="v4-seq-head">
        <span className="v4-seq-title">LINE</span>
        <span className="v4-seq-chord" aria-live="polite">
          {selText}
        </span>
        <button type="button" className="v4-seq-mode v4-beat-clear" aria-label="Octave down" disabled={start <= 0} onClick={() => setStart((s) => Math.max(0, s - L))}>
          OCT -
        </button>
        <button type="button" className="v4-seq-mode v4-beat-clear" aria-label="Octave up" disabled={start >= total - span} onClick={() => setStart((s) => Math.min(total - span, s + L))}>
          OCT +
        </button>
        <button type="button" className="v4-seq-mode v4-beat-clear" aria-label="Clear the bass line" onClick={() => bassClear()}>
          CLEAR
        </button>
        {variant === 'desk' && <span className="v4-seq-hint">Tap a cell: a note at that pitch, tap it again: off, drag along a row: the same note. ACC, SLIDE, TIE per step, VEL: draw the velocities (double click: the line's), LEN: the length. Patterns: tap to play, tap tap to chain, hold an empty one to copy.</span>}
        <button type="button" className="v4-seq-done" aria-label="Close the bass editor" onClick={() => editor.close()}>
          DONE
        </button>
      </div>
      <div className="v4-beat-main">
        <div className="v4-beat-names v4-bassed-names" aria-hidden="true">
          {rows.map((r) => (
            <span key={r} className="v4-bassed-name" data-root={r % L === 0 ? '1' : '0'}>
              {rowName(r)}
            </span>
          ))}
        </div>
        <div
          ref={grid}
          className="v4-beat-grid v4-bassed-grid"
          role="grid"
          aria-label="Bass line: notes by steps"
          onPointerDown={onGridDown}
          onPointerMove={onGridMove}
          onPointerUp={(e) => onGridUp(e, false)}
          onPointerCancel={(e) => onGridUp(e, true)}
        >
          {rows.map((r) => (
            <div key={r} className="v4-beat-row" role="row" data-root={r % L === 0 ? '1' : '0'}>
              {STEPS.map((c) => {
                const s = steps[c];
                const at = s.kind === 'off' ? null : rowOf(steps, c, L);
                const hit = at === r;
                return (
                  <div
                    key={c}
                    className="v4-beat-cell"
                    role="gridcell"
                    aria-label={`step ${c + 1} ${rowName(r)}${hit ? (s.kind === 'tie' ? ', tie' : ', note') : ''}`}
                    aria-selected={hit}
                    data-beat={c % 4 === 0 ? '1' : '0'}
                    data-on={head === c ? '1' : '0'}
                    data-out={c >= len ? '1' : '0'}
                  >
                    {hit && <span className="v4-beat-hit v4-bassed-hit" data-tie={s.kind === 'tie' ? '1' : '0'} data-acc={s.kind === 'note' && s.acc ? '1' : '0'} />}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {lane('acc', 'ACC')}
      {lane('slide', 'SLIDE')}
      {lane('tie', 'TIE')}
      <div className="v4-beat-main">
        <span className="v4-beat-lanelabel">VEL</span>
        <div
          ref={velLane}
          className="v4-seq-lane v4-beat-lane v4-bassed-vel"
          style={{ '--n': BASS_STEPS } as React.CSSProperties}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* pointeur deja relache */
            }
            velDraw.current = { id: e.pointerId, i: -1, v: -1 };
            onVel(e.clientX, e.clientY);
          }}
          onPointerMove={(e) => {
            if (velDraw.current?.id === e.pointerId) onVel(e.clientX, e.clientY);
          }}
          onPointerUp={() => {
            velDraw.current = null;
          }}
          onPointerCancel={() => {
            velDraw.current = null;
          }}
          onDoubleClick={(e) => bassStepVel(colAt(e.clientX, velLane.current), null)}
        >
          {STEPS.map((i) => {
            const s = steps[i];
            const lock = s.kind === 'note' ? s.locks?.volume : undefined;
            const v = lock ?? params.volume;
            return (
              <div
                key={i}
                className="v4-seq-col"
                role="slider"
                tabIndex={s.kind === 'note' ? 0 : -1}
                aria-label={`Velocity of step ${i + 1}`}
                aria-valuemin={0}
                aria-valuemax={127}
                aria-valuenow={Math.round(v * 127)}
                data-on={head === i ? '1' : '0'}
                data-rest={s.kind !== 'note' ? '1' : '0'}
                data-tone="1"
                data-own={lock !== undefined ? '1' : '0'}
                data-out={i >= len ? '1' : '0'}
                onKeyDown={(e) => {
                  if (s.kind !== 'note') return;
                  const step = 4 / 127;
                  if (e.key === 'ArrowUp' || e.key === 'ArrowRight') bassStepVel(i, v + step);
                  else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') bassStepVel(i, v - step);
                  else if (e.key === 'Delete' || e.key === 'Backspace') bassStepVel(i, null);
                  else return;
                  e.preventDefault();
                }}
              >
                {s.kind === 'note' && <span className="v4-seq-bar" style={{ height: `${v * 100}%` }} />}
              </div>
            );
          })}
        </div>
      </div>
      <div className="v4-beat-main v4-bassed-lanerow">
        <span className="v4-beat-lanelabel">LEN {len}</span>
        <div
          ref={lenLane}
          className="v4-bassed-lane v4-bassed-len"
          role="slider"
          tabIndex={0}
          aria-label="Line length in steps"
          aria-valuemin={1}
          aria-valuemax={BASS_STEPS}
          aria-valuenow={len}
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            try {
              e.currentTarget.setPointerCapture(e.pointerId);
            } catch {
              /* pointeur deja relache */
            }
            lenGrip.current = { id: e.pointerId };
            onLen(e.clientX);
          }}
          onPointerMove={(e) => {
            if (lenGrip.current?.id === e.pointerId) onLen(e.clientX);
          }}
          onPointerUp={() => {
            lenGrip.current = null;
          }}
          onPointerCancel={() => {
            lenGrip.current = null;
          }}
          onKeyDown={(e) => {
            if (e.key === 'ArrowRight' || e.key === 'ArrowUp') bassLenSet(len + 1);
            else if (e.key === 'ArrowLeft' || e.key === 'ArrowDown') bassLenSet(len - 1);
            else return;
            e.preventDefault();
          }}
        >
          {STEPS.map((i) => (
            <span key={i} className="v4-bassed-lencell" data-in={i < len ? '1' : '0'} data-play={head === i ? '1' : '0'} />
          ))}
        </div>
      </div>
    </div>
  );
};

/** Les mesures du panneau pose sur la machine (px) : la colonne des notes et son jour, la hauteur d'une rangee. */
const ON_MACHINE = { names: 44, rowMin: 9, rowMax: 15 } as const;

/**
 * Desktop : le panneau pose sur la machine, sa grille sur les pas 1 a 16 (la colonne des notes a gauche du pas 1) ; il
 * couvre la rangee des pas et monte autant qu'il lui faut, les rangees a la hauteur qui tient dans la fenetre. Il suit
 * chaque vue (Stage.onView).
 */
function useOnMachine(stage: Stage | null, on: boolean, ref: RefObject<HTMLElement | null>, rowCount: number): void {
  useLayoutEffect(() => {
    const el = ref.current;
    if (!el || !stage || !on) return undefined;
    let last = '';
    const place = (): void => {
      const ids = stage.hit.ids();
      const r = stage.hit.rects();
      const i0 = ids.indexOf('bass-trig-1');
      const i1 = ids.indexOf('bass-trig-16');
      if (i0 < 0 || i1 < 0) return;
      const cr = stage.renderer.domElement.getBoundingClientRect();
      const host = el.offsetParent instanceof HTMLElement ? el.offsetParent.getBoundingClientRect() : { left: 0, top: 0, bottom: window.innerHeight };
      const x0 = r[i0 * 4];
      const y0 = r[i0 * 4 + 1];
      const h0 = r[i0 * 4 + 3];
      const x1 = r[i1 * 4] + r[i1 * 4 + 2];
      const pad = 8;
      const names = ON_MACHINE.names + pad;
      const left = cr.left - host.left + x0 - names;
      const width = x1 - x0 + names + pad;
      const hostH = host.bottom - host.top;
      // Les rangees : ce qui tient entre le haut de la fenetre (60) et son bas, une fois le reste du panneau pose
      const grid = el.querySelector<HTMLElement>('.v4-bassed-grid');
      const rest = grid ? el.offsetHeight - grid.offsetHeight : 200;
      const row = Math.max(ON_MACHINE.rowMin, Math.min(ON_MACHINE.rowMax, Math.floor((hostH - 72 - rest) / rowCount) - 2));
      el.style.setProperty('--beat-row', `${row}px`);
      // Le haut : au-dessus des LED des pas, ou plus haut si le panneau ne tient pas jusqu'en bas
      const stepTop = cr.top - host.top + y0 - h0 * 1.15;
      const top = Math.max(60, Math.min(stepTop, hostH - 12 - el.offsetHeight));
      const key = `${Math.round(left)}|${Math.round(top)}|${Math.round(width)}|${row}`;
      if (key === last) return;
      last = key;
      el.style.transform = `translate(${Math.round(left)}px, ${Math.round(top)}px)`;
      el.style.width = `${Math.round(width)}px`;
    };
    place();
    const a = stage.onView(place);
    const b = stage.onIdle(place);
    window.addEventListener('resize', place);
    return () => {
      a();
      b();
      window.removeEventListener('resize', place);
    };
  }, [stage, on, ref, rowCount]);
}

/** Le panneau du MM-BASS ouvert par sa touche EDIT : sur la machine au desktop, sous elle au telephone. */
export const BassEditPanel: React.FC<{ stage: Stage | null; mobile: boolean }> = ({ stage, mobile }) => {
  const { shown, ref } = useEditorPanel('bass', stage, { inset: mobile });
  const rowCount = 2 * scaleLen() + 1;
  useOnMachine(stage, shown && !mobile, ref, rowCount);
  return (
    <section ref={ref} className="v4-seq v4-beat" data-place={mobile ? 'below' : 'machine'} data-shown={shown ? '1' : '0'} aria-label="Bass line editor" aria-hidden={!shown}>
      <BassEditor variant={mobile ? 'mobile' : 'desk'} shown={shown} />
    </section>
  );
};

export default BassEditPanel;
