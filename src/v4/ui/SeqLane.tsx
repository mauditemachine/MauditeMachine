/**
 * La suite de l'arpege, a dessiner (2026-10-04, Mika : "pouvoir modifier
 * les notes qui sont generees"). Une barre par pas, sa hauteur est sa
 * note : on glisse sur les barres pour les dessiner (doigt ou souris, les
 * pas traverses suivent la ligne) ; le nom de la note sous chaque barre la
 * fait taire ou la rallume. Les filets marquent les notes de l'accord qui
 * joue (plus fort a ses octaves). AUTO montre la suite des potards (MODE,
 * RANGE, NOTES) telle qu'elle joue ; la toucher la copie en EDIT. STEPS - +
 * : 1 a 16 pas. Au clavier : chaque barre est un curseur (fleches haut et
 * bas, Page pour l'octave, Suppr pour un silence ; gauche et droite d'une
 * barre a l'autre). La tete de lecture suit l'arpege a l'heure audio.
 * - SeqPanel (desktop) : un panneau sous le MM-ARP quand on l'utilise ; le
 *   cadrage de la machine remonte au-dessus (Stage.setInset('voy')).
 * - variant 'dock' : la page SEQUENCE du Dock du telephone (ui/VoyDock.tsx).
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { gesture } from '../actions';
import { context } from '../audio/drums';
import type { Stage } from '../scene/renderer';
import { voyExplode } from '../state/explode';
import { focus } from '../state/focus';
import { intro } from '../state/intro';
import { section } from '../state/section';
import { arp } from '../voyager/arp';
import { CHORDS, chordDegrees, degreeName } from '../voyager/chords';
import { stepIndex, voyParams } from '../voyager/params';
import { SEQ_MAX, SEQ_TOP, seq, type SeqStep } from '../voyager/seq';

/** Tete de lecture : relue toutes les 40 ms (et les notes tirees en RAND). */
const POLL_MS = 40;
const LEVELS = SEQ_TOP + 1;

/** Le pas qui joue et son accord, a l'heure audio. */
function usePlayhead(): { pos: number; chord: number } {
  const [ph, setPh] = useState({ pos: -1, chord: -1, tick: 0 });
  useEffect(() => {
    const t = window.setInterval(() => {
      const c = context();
      const e = c ? arp.posAt(c.currentTime) : null;
      const pos = e ? e.pos : -1;
      const chord = e ? e.chord : -1;
      // RAND : les notes tirees changent sans que la suite change ; un redessin par pas
      setPh((o) => (o.pos === pos && o.chord === chord ? o : { pos, chord, tick: o.tick + 1 }));
    }, POLL_MS);
    return () => window.clearInterval(t);
  }, []);
  return ph;
}

const yToDegree = (r: DOMRect, y: number): number => Math.max(0, Math.min(SEQ_TOP, Math.floor(((r.bottom - y) / r.height) * LEVELS)));

interface LaneProps {
  variant: 'desk' | 'dock';
}

export const SeqLane: React.FC<LaneProps> = ({ variant }) => {
  const s = useSyncExternalStore(seq.subscribe, seq.get, seq.get);
  const p = useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  const a = useSyncExternalStore(arp.subscribe, arp.get, arp.get);
  const ph = usePlayhead();
  const lane = useRef<HTMLDivElement>(null);
  const drag = useRef<{ id: number; i: number; d: number } | null>(null);
  /** la note d'un pas avant son silence : la rallumer la rend */
  const before = useRef<SeqStep[]>([]);
  const [focusIdx, setFocusIdx] = useState(0);

  // L'accord montre : celui qui joue, sinon le premier de la progression, sinon F#m
  const chord = ph.chord >= 0 ? ph.chord : (a.prog[0] ?? 0);
  const steps = seq.shown(chord);
  const n = steps.length;
  const rand = !s.edit && stepIndex('mode', p.mode) === 3;
  const tones = chordDegrees(chord);
  const guides: number[] = [];
  for (let o = 0; o * 7 <= SEQ_TOP; o += 1) for (const t of tones) if (o * 7 + t <= SEQ_TOP) guides.push(o * 7 + t);
  const isTone = (d: number): boolean => tones.includes(d % 7);

  const set = (i: number, d: SeqStep): void => {
    gesture();
    seq.setStep(chord, i, d);
  };

  /** Un point du geste : le pas sous le doigt, et ceux traverses depuis le dernier (en ligne droite). */
  const paint = (x: number, y: number): void => {
    const el = lane.current;
    const g = drag.current;
    if (!el || !g) return;
    const r = el.getBoundingClientRect();
    const cols = seq.shown(chord).length;
    if (cols === 0) return;
    const i = Math.max(0, Math.min(cols - 1, Math.floor(((x - r.left) / r.width) * cols)));
    const d = yToDegree(r, y);
    if (g.i >= 0 && Math.abs(i - g.i) > 1) {
      const dir = i > g.i ? 1 : -1;
      for (let j = g.i + dir; j !== i; j += dir) set(j, Math.round(g.d + ((d - g.d) * (j - g.i)) / (i - g.i)));
    }
    if (g.i !== i || g.d !== d) set(i, d);
    drag.current = { id: g.id, i, d };
    setFocusIdx(i);
  };

  /** STEPS - et + : depuis la suite telle qu'elle est (deux clics rapproches comptent deux fois). */
  const nudge = (by: number): void => {
    gesture();
    seq.setLen(chord, Math.min(seq.shown(chord).length, SEQ_MAX) + by);
  };

  const toggleRest = (i: number): void => {
    const cur = steps[i];
    if (cur === null) {
      set(i, before.current[i] ?? 0);
    } else {
      before.current[i] = cur;
      set(i, null);
    }
  };

  const onKey = (e: React.KeyboardEvent, i: number): void => {
    const cur = steps[i];
    const v = cur ?? before.current[i] ?? 0;
    let next: SeqStep | undefined;
    if (e.key === 'ArrowUp') next = Math.min(SEQ_TOP, v + 1);
    else if (e.key === 'ArrowDown') next = Math.max(0, v - 1);
    else if (e.key === 'PageUp') next = Math.min(SEQ_TOP, v + 7);
    else if (e.key === 'PageDown') next = Math.max(0, v - 7);
    else if (e.key === 'Home') next = 0;
    else if (e.key === 'End') next = SEQ_TOP;
    else if (e.key === 'Delete' || e.key === 'Backspace') next = null;
    else if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      toggleRest(i);
      return;
    } else if (e.key === 'ArrowLeft' || e.key === 'ArrowRight') {
      e.preventDefault();
      const j = Math.max(0, Math.min(n - 1, i + (e.key === 'ArrowLeft' ? -1 : 1)));
      setFocusIdx(j);
      lane.current?.querySelectorAll<HTMLElement>('.v4-seq-col')[j]?.focus();
      return;
    }
    if (next === undefined) return;
    e.preventDefault();
    if (next === null && cur !== null) before.current[i] = cur;
    set(i, next);
  };

  const label = CHORDS[chord]?.label ?? '';
  const fi = Math.min(focusIdx, Math.max(0, n - 1));

  return (
    <div className="v4-seq-body" data-variant={variant} data-edit={s.edit ? '1' : '0'}>
      <div className="v4-seq-head">
        {variant === 'desk' && <span className="v4-seq-title">SEQUENCE</span>}
        <span className="v4-seq-chord" aria-live="polite" aria-label={`Notes shown on ${CHORDS[chord]?.aria ?? ''}`}>
          {label}
        </span>
        <span className="v4-seq-modes" role="group" aria-label="Sequence source">
          <button type="button" className="v4-seq-mode" aria-pressed={!s.edit} onClick={() => seq.auto()}>
            AUTO
          </button>
          <button type="button" className="v4-seq-mode" aria-pressed={s.edit} onClick={() => seq.edit(chord)}>
            EDIT
          </button>
        </span>
        {rand && <span className="v4-seq-tag">RAND</span>}
        <span className="v4-seq-len" role="group" aria-label="Steps">
          <button type="button" className="v4-seq-nudge" aria-label="One step less" disabled={n <= 1} onClick={() => nudge(-1)}>
            -
          </button>
          <span className="v4-seq-n">
            {n}
            <span className="v4-seq-unit"> STEPS</span>
          </span>
          <button type="button" className="v4-seq-nudge" aria-label="One step more" disabled={s.edit && n >= SEQ_MAX} onClick={() => nudge(1)}>
            +
          </button>
        </span>
        {variant === 'desk' && <span className="v4-seq-hint">Drag to draw the notes. Tap a note name for a rest.</span>}
      </div>
      <div
        ref={lane}
        className="v4-seq-lane"
        style={{ '--n': n } as React.CSSProperties}
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            /* pointeur deja relache : le geste continue sans capture */
          }
          drag.current = { id: e.pointerId, i: -1, d: -1 };
          paint(e.clientX, e.clientY);
        }}
        onPointerMove={(e) => {
          if (drag.current?.id === e.pointerId) paint(e.clientX, e.clientY);
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      >
        <div className="v4-seq-guides" aria-hidden="true">
          {guides.map((d) => (
            <span key={d} className="v4-seq-guide" data-root={d % 7 === 0 ? '1' : '0'} style={{ bottom: `${((d + 0.5) / LEVELS) * 100}%` }} />
          ))}
        </div>
        {steps.map((d, i) => {
          const name = d === null ? 'rest' : degreeName(chord, d);
          return (
            <div
              key={i}
              className="v4-seq-col"
              role="slider"
              tabIndex={i === fi ? 0 : -1}
              aria-label={`Step ${i + 1}`}
              aria-valuemin={0}
              aria-valuemax={SEQ_TOP}
              aria-valuenow={d ?? 0}
              aria-valuetext={d === null ? 'rest' : `${name}, ${d} scale steps above the root`}
              data-on={ph.pos === i && a.running ? '1' : '0'}
              data-rest={d === null ? '1' : '0'}
              data-tone={d !== null && isTone(d) ? '1' : '0'}
              onFocus={() => setFocusIdx(i)}
              onKeyDown={(e) => onKey(e, i)}
            >
              {d !== null && <span className="v4-seq-bar" style={{ height: `${((d + 1) / LEVELS) * 100}%` }} />}
            </div>
          );
        })}
      </div>
      <div className="v4-seq-names" style={{ '--n': n } as React.CSSProperties}>
        {steps.map((d, i) => (
          <button
            key={i}
            type="button"
            className="v4-seq-name"
            data-rest={d === null ? '1' : '0'}
            data-on={ph.pos === i && a.running ? '1' : '0'}
            aria-label={d === null ? `Step ${i + 1}, rest: tap to play it` : `Step ${i + 1}, ${degreeName(chord, d)}: tap for a rest`}
            onClick={() => toggleRest(i)}
          >
            {d === null ? '-' : degreeName(chord, d)}
          </button>
        ))}
      </div>
    </div>
  );
};

const GAP = 12;
const HEAD_PX = 56;

/**
 * Le panneau du desktop, sous le MM-ARP quand on l'utilise (machine fermee,
 * aucune page ouverte). stage : la scene courante (elle est recreee au
 * changement d'apparence ; la nouvelle recoit la hauteur du panneau).
 */
export const SeqPanel: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const introState = useSyncExternalStore(intro.subscribe, intro.get, intro.get);
  const opened = useSyncExternalStore(section.subscribe, section.get, section.get);
  const hood = useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  const shown = f === 'voy' && introState === 'done' && opened === null && hood === 'closed';
  const panel = useRef<HTMLElement>(null);

  // Cachee : hors du clavier et des lecteurs d'ecran (inert n'est pas type par React 18)
  useEffect(() => {
    const el = panel.current;
    if (!el) return;
    if (shown) el.removeAttribute('inert');
    else el.setAttribute('inert', '');
  }, [shown]);

  // Sa hauteur remonte le cadrage du MM-ARP
  useLayoutEffect(() => {
    const el = panel.current;
    if (!el || !stage) return undefined;
    if (!shown) {
      stage.setInset('voy', 0);
      return undefined;
    }
    const apply = (): void => {
      const r = el.getBoundingClientRect();
      const host = el.offsetParent instanceof HTMLElement ? el.offsetParent.getBoundingClientRect() : { bottom: window.innerHeight };
      stage.setInset('voy', host.bottom - r.top + GAP, HEAD_PX);
    };
    apply();
    const ro = new ResizeObserver(apply);
    ro.observe(el);
    return () => ro.disconnect();
  }, [shown, stage]);

  return (
    <section ref={panel} className="v4-seq" data-shown={shown ? '1' : '0'} aria-label="Arpeggiator sequence" aria-hidden={!shown}>
      <SeqLane variant="desk" />
    </section>
  );
};

export default SeqPanel;
