/**
 * Le Dock du MM-SMPL au telephone (2026-10-04, Mika : "en mobile tout doit
 * etre disponible avec des knobs plus gros ! la plupart des gens viendront
 * en mobile"). Sous la machine, repliable (sa languette, retenu sous
 * mm.v4.sdock), deux pages (retenues sous mm.v4.sdock.page) :
 * - PADS : les seize trigs en gros (de 1 a 16 dans l'ordre de lecture depuis
 *   le 2026-10-05, comme la rangee de la machine ; avant : le 1 en bas a gauche, comme sur la
 *   machine), allumes quand ils ont une slice et quand ils sonnent, et
 *   toutes les touches : GRAB A, GRAB B, FILE, REC, SLICES, MODE, REV,
 *   LOOP, SAVE, PLAY ;
 * - KNOBS : les douze potards en gros (ui/KnobPanel.tsx KnobView), par
 *   rangee : SAMPLE, SHAPE, GRAIN.
 * Memes actions et memes stores que la machine.
 */

import React, { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Stage } from '../scene/renderer';
import { KnobView, useDockInset, useDockPage, DockPages, type KnobSpec } from '../ui/KnobPanel';
import { smplDial, smplPad } from './actions';
import { keyAction } from './gestures';
import { SMPL_KNOBS, smplParams, smplReadout, smplValueText, type SmplKnobId } from './params';
import { padCount, smplState } from './state';
import { SMPL_KEYS, SMPL_KNOB_ROWS, SMPL_ROW_NAMES } from './theme';

const OPEN_KEY = 'mm.v4.sdock';
const PAGE_KEY = 'mm.v4.sdock.page';
const TAB_KEY = 'mm.v4.knobtab.smpl';

function readOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) !== 'closed';
  } catch {
    return true;
  }
}

function knobSpec(id: SmplKnobId): KnobSpec {
  const k = SMPL_KNOBS.find((x) => x.id === id) ?? SMPL_KNOBS[0];
  const dur = (): number => smplState.get().sample?.duration ?? 0;
  return {
    label: k.label,
    get: () => smplParams.of(id),
    set: (v) => smplDial(id, v),
    reset: () => k.def,
    range: [0, 1],
    steps: k.steps ?? 0,
    bipolar: !!k.bipolar,
    readout: () => smplReadout(id, smplParams.of(id), dur()),
    valueText: () => smplValueText(id, smplParams.of(id), dur()),
    subscribe: (fn) => {
      const a = smplParams.subscribe(fn);
      const b = smplState.subscribe(fn);
      return () => {
        a();
        b();
      };
    },
  };
}

/** Les trigs dans l'ordre de lecture (2026-10-05, comme la machine, de 1 a 16) : 1 a 4 en haut, 13 a 16 en bas. */
const PAD_ORDER = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15];

const Pad: React.FC<{ i: number; lit: boolean; slice: boolean }> = ({ i, lit, slice }) => {
  const down = useRef(false);
  const up = (): void => {
    if (!down.current) return;
    down.current = false;
    smplPad(i, false);
  };
  return (
    <button
      type="button"
      className="v4-sdock-pad"
      data-on={lit ? '1' : '0'}
      data-slice={slice ? '1' : '0'}
      aria-label={`Pad ${i + 1}${slice ? '' : ', no slice'}`}
      aria-pressed={lit}
      onPointerDown={(e) => {
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* pas de capture */
        }
        down.current = true;
        smplPad(i, true);
      }}
      onPointerUp={up}
      onPointerCancel={up}
      onKeyDown={(e) => {
        if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat) return;
        e.preventDefault();
        down.current = true;
        smplPad(i, true);
      }}
      onKeyUp={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        up();
      }}
    >
      <span className="v4-sdock-num" aria-hidden="true">
        {i + 1}
      </span>
    </button>
  );
};

export const SmplDock: React.FC<{ getStage: () => Stage | null }> = ({ getStage }) => {
  const [shown, setShown] = useState(readOpen);
  const [page, setPage] = useDockPage(PAGE_KEY);
  const s = useSyncExternalStore(smplState.subscribe, smplState.get, smplState.get);
  const ref = useRef<HTMLDivElement>(null);
  useDockInset(getStage(), 'smpl', shown, ref);
  const rows = useMemo(() => SMPL_KNOB_ROWS.map((row) => row.map(knobSpec)), []);
  const [tab, setTab] = useState(() => {
    try {
      const t = Number(window.localStorage.getItem(TAB_KEY));
      return Number.isInteger(t) && t >= 0 && t < rows.length ? t : 0;
    } catch {
      return 0;
    }
  });
  const n = padCount();
  const toggle = (): void => {
    const next = !shown;
    setShown(next);
    try {
      window.localStorage.setItem(OPEN_KEY, next ? 'open' : 'closed');
    } catch {
      /* stockage indisponible : le choix vaut pour la visite */
    }
  };
  const pick = (t: number): void => {
    setTab(t);
    try {
      window.localStorage.setItem(TAB_KEY, String(t));
    } catch {
      /* stockage indisponible */
    }
  };
  const on = (k: (typeof SMPL_KEYS)[number]['kind']): boolean =>
    k === 'play' ? s.preview : k === 'rev' ? s.reverse : k === 'loop' ? s.loop : k === 'rec' ? s.recording : k === 'mode' ? s.mode === 'grain' : false;

  return (
    <>
      <button
        type="button"
        className="v4-dock-tab v4-djdock-tab"
        data-open={shown ? '1' : '0'}
        data-page="knobs"
        aria-expanded={shown}
        aria-controls="v4-sdock"
        aria-label={shown ? 'Hide the sampler pads and knobs' : 'Show the sampler pads and knobs'}
        onClick={toggle}
      >
        <span aria-hidden="true">SMPL</span>
        <i className={`fa-solid ${shown ? 'fa-chevron-down' : 'fa-chevron-up'} v4-fa`} aria-hidden="true" />
      </button>
      <div ref={ref} id="v4-sdock" className="v4-dock v4-sdock" data-open={shown ? '1' : '0'} data-page="knobs" aria-hidden={!shown || undefined}>
        <DockPages page={page} onPage={setPage} first="PADS" />
        {page === 'knobs' ? (
          <div className="v4-knobs">
            <div className="v4-knobs-tabs" role="tablist" aria-label="Sampler sections">
              {SMPL_ROW_NAMES.map((name, t) => (
                <button key={name} type="button" role="tab" aria-selected={t === tab} className="v4-knobs-tab" onClick={() => pick(t)}>
                  {name}
                </button>
              ))}
            </div>
            <div className="v4-knobs-grid" role="tabpanel" aria-label={SMPL_ROW_NAMES[tab]}>
              {rows[tab].map((spec) => (
                <KnobView key={spec.label} spec={spec} />
              ))}
            </div>
            <p className="v4-sdock-line" aria-live="polite">
              {s.message ?? (s.sample ? `${s.sample.name.toUpperCase()}  ${s.sample.duration.toFixed(2)} S` : 'NO SAMPLE YET')}
            </p>
          </div>
        ) : (
          <>
            <div className="v4-sdock-keys" role="group" aria-label="Sampler keys">
              {SMPL_KEYS.map((k) => (
                <button key={k.kind} type="button" className={k.kind === 'play' ? 'v4-sdock-key v4-sdock-play' : 'v4-sdock-key'} data-on={on(k.kind) ? '1' : '0'} aria-label={k.aria} aria-pressed={on(k.kind) || undefined} onClick={() => keyAction(k.kind)}>
                  {k.kind === 'mode' ? (s.mode === 'grain' ? 'GRAIN' : 'SLICE') : k.kind === 'slices' ? (s.slicing === 'auto' ? 'AUTO' : `${s.slicing} SL`) : k.label}
                </button>
              ))}
            </div>
            <p className="v4-sdock-line" aria-live="polite">
              {s.message ?? (s.sample ? `${s.sample.name.toUpperCase()}  ${s.sample.duration.toFixed(2)} S` : 'GRAB A DECK, PICK A FILE OR REC')}
            </p>
            <div className="v4-sdock-pads" role="group" aria-label="Trigs 1 to 16, reading order">
              {PAD_ORDER.map((i) => (
                <Pad key={i} i={i} lit={s.pads.includes(i)} slice={i < n} />
              ))}
            </div>
          </>
        )}
      </div>
    </>
  );
};

export default SmplDock;
