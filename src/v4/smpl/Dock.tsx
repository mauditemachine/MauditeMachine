/**
 * Le Dock du MM-SMPL au telephone (2026-10-04, Mika : "en mobile tout doit
 * etre disponible avec des knobs plus gros ! la plupart des gens viendront
 * en mobile"). Sous la machine, repliable (sa languette, retenu sous
 * mm.v4.sdock). Refait le 2026-10-05 (Mika : "attention au mobile, je veux
 * que ce soit parfait ; pour la navigation nous n'avons pas grand place") :
 * une seule rangee d'onglets, retenue (mm.v4.sdock.page) :
 * - PADS : les douze touches (deux rangees de six, l'ordre de la machine),
 *   la forme d'onde en petit (la region, les slices, ce qui joue : l'ecran
 *   de la machine est trop petit au telephone), la ligne d'etat, puis les
 *   seize trigs en gros, de 1 a 16 dans l'ordre de lecture. En EDIT, ce
 *   sont les pas de la sequence : taper pose ou enleve, glisser vers le
 *   haut ou le bas change la slice (son numero en gros) ;
 * - SAMPLE : LEVEL, PITCH, START, END, ATTACK, RELEASE, FILTER ;
 * - GRAIN : POSITION, SCAN, SIZE, DENSITY, SPRAY (2026-10-05 : SCAN remplace SPREAD).
 * Memes actions et memes stores que la machine.
 */

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import type { Stage } from '../scene/renderer';
import { KnobView, useDockInset, type KnobSpec } from '../ui/KnobPanel';
import { smplDial, smplPad, smplStepSlice, smplStepTap } from './actions';
import { smplEngine } from './engine';
import { keyAction } from './gestures';
import { SMPL_KNOBS, smplParams, smplReadout, smplValueText, type SmplKnobId } from './params';
import { smplSeq } from './seq';
import { peaksOf } from './slices';
import { padCount, smplState } from './state';
import { SMPL_KEYS, SMPL_KNOB_ROWS, SMPL_ROW_NAMES } from './theme';

const OPEN_KEY = 'mm.v4.sdock';
const PAGE_KEY = 'mm.v4.sdock.page';
/** EDIT : les pixels par slice en glissant sur un pas, et le seuil du glisser */
const SLICE_PX = 16;
const DRAG_PX = 6;

type Page = 'pads' | 'sample' | 'grain';
const PAGES: readonly { id: Page; label: string }[] = [
  { id: 'pads', label: 'PADS' },
  { id: 'sample', label: SMPL_ROW_NAMES[0] },
  { id: 'grain', label: SMPL_ROW_NAMES[1] },
];

/** Replie par defaut, comme les Docks du MM-RYTM et du MM-ARP (2026-10-05 : la machine en hauteur se joue elle-meme). */
function readOpen(): boolean {
  try {
    return window.localStorage.getItem(OPEN_KEY) === 'open';
  } catch {
    return false;
  }
}

function readPage(): Page {
  try {
    const v = window.localStorage.getItem(PAGE_KEY);
    // Les pages d'avant (PADS, KNOBS) : KNOBS devient SAMPLE
    if (v === 'sample' || v === 'grain') return v;
    if (v === 'knobs') return 'sample';
  } catch {
    /* stockage indisponible */
  }
  return 'pads';
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

/**
 * La forme d'onde en petit : le sample entier en barres, la region en or,
 * le reste eteint, les slices en orange, START et END en os, ce qui joue
 * (jaune : une slice, cyan : un nuage). Redessinee quand l'etat change et
 * tant que quelque chose joue.
 */
const Wave: React.FC = () => {
  const ref = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const cv = ref.current;
    if (!cv) return undefined;
    let peaks: { id: number; w: number; data: Float32Array } | null = null;
    let raf = 0;
    const draw = (): void => {
      raf = 0;
      const ctx = cv.getContext('2d');
      if (!ctx) return;
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const W = Math.max(1, Math.round(cv.clientWidth * dpr));
      const H = Math.max(1, Math.round(cv.clientHeight * dpr));
      if (cv.width !== W || cv.height !== H) {
        cv.width = W;
        cv.height = H;
      }
      ctx.clearRect(0, 0, W, H);
      const s = smplState.get();
      const d = smplEngine.data();
      const cy = H / 2;
      ctx.fillStyle = 'rgba(246, 241, 231, 0.12)';
      ctx.fillRect(0, cy - dpr * 0.5, W, dpr);
      if (!s.sample || !d) return;
      const bar = 2 * dpr;
      const gap = 1 * dpr;
      const n = Math.max(8, Math.floor(W / (bar + gap)));
      if (!peaks || peaks.id !== s.sample.id || peaks.w !== n) peaks = { id: s.sample.id, w: n, data: peaksOf(d.mono, 0, d.mono.length, n) };
      const pk = peaks.data;
      let top = 0.05;
      for (let i = 0; i < pk.length; i += 1) top = Math.max(top, Math.abs(pk[i]));
      const v = smplParams.get();
      const dur = s.sample.duration;
      const ra = v.start * W;
      const rb = v.end * W;
      const step = W / n;
      for (let i = 0; i < n; i += 1) {
        const x = i * step;
        const h = (Math.max(Math.abs(pk[i * 2]), Math.abs(pk[i * 2 + 1])) / top) * (H / 2) * 0.9;
        ctx.fillStyle = x + bar >= ra && x <= rb ? '#FFA600' : 'rgba(255, 166, 0, 0.26)';
        ctx.fillRect(x, cy - h, bar, Math.max(dpr, 2 * h));
      }
      ctx.fillStyle = '#FF6A13';
      const sl = s.slices;
      for (let i = 1; i + 1 < sl.length; i += 1) ctx.fillRect((sl[i] / dur) * W - dpr * 0.5, 0, dpr, H);
      ctx.fillStyle = '#F6F1E7';
      ctx.fillRect(ra - dpr, 0, 2 * dpr, H);
      ctx.fillRect(rb - dpr, 0, 2 * dpr, H);
      const live = smplEngine.live();
      ctx.fillStyle = '#FFD60A';
      for (const t of live.voices.values()) ctx.fillRect((t / dur) * W - dpr, 0, 2 * dpr, H);
      ctx.fillStyle = '#5CC8FF';
      for (const t of live.clouds.values()) ctx.fillRect((t / dur) * W - dpr, 0, 2 * dpr, H);
    };
    const ask = (): void => {
      if (!raf) raf = requestAnimationFrame(draw);
    };
    ask();
    const offs = [smplState.subscribe(ask), smplParams.subscribe(ask), smplEngine.subscribeLive(ask)];
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(ask);
    ro?.observe(cv);
    return () => {
      if (raf) cancelAnimationFrame(raf);
      for (const off of offs) off();
      ro?.disconnect();
    };
  }, []);
  return <canvas ref={ref} className="v4-sdock-wave" aria-hidden="true" />;
};

/** Un trig : son pad, ou en EDIT un pas de la sequence (taper : pose ou enleve ; glisser : sa slice). */
const Pad: React.FC<{ i: number; lit: boolean; slice: boolean; edit: boolean; step: number | null; playing: boolean }> = ({ i, lit, slice, edit, step, playing }) => {
  const down = useRef<{ y: number; base: number; dragged: boolean } | null>(null);
  const up = (tap: boolean): void => {
    const d = down.current;
    if (!d) return;
    down.current = null;
    if (edit) {
      if (tap && !d.dragged) smplStepTap(i);
      return;
    }
    smplPad(i, false);
  };
  const label = edit ? (step === null ? `Step ${i + 1}: empty` : `Step ${i + 1}: slice ${step + 1}`) : `Pad ${i + 1}${slice ? '' : ', no slice'}`;
  return (
    <button
      type="button"
      className="v4-sdock-pad"
      data-on={lit ? '1' : '0'}
      data-slice={slice ? '1' : '0'}
      data-edit={edit ? '1' : '0'}
      data-step={step !== null ? '1' : '0'}
      data-play={playing ? '1' : '0'}
      aria-label={label}
      aria-pressed={edit ? step !== null : lit}
      onPointerDown={(e) => {
        e.preventDefault();
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          /* pas de capture */
        }
        down.current = { y: e.clientY, base: step ?? (padCount() > 0 ? i % padCount() : i), dragged: false };
        if (!edit) smplPad(i, true);
      }}
      onPointerMove={(e) => {
        const d = down.current;
        if (!d || !edit) return;
        const dy = e.clientY - d.y;
        if (!d.dragged && Math.abs(dy) < DRAG_PX) return;
        d.dragged = true;
        smplStepSlice(i, d.base + Math.round(-dy / SLICE_PX));
      }}
      onPointerUp={() => up(true)}
      onPointerCancel={() => up(false)}
      onKeyDown={(e) => {
        if (edit && (e.key === 'ArrowUp' || e.key === 'ArrowDown')) {
          e.preventDefault();
          smplStepSlice(i, (step ?? i - (e.key === 'ArrowUp' ? 1 : -1)) + (e.key === 'ArrowUp' ? 1 : -1));
          return;
        }
        if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat) return;
        e.preventDefault();
        down.current = { y: 0, base: step ?? i, dragged: false };
        if (!edit) smplPad(i, true);
      }}
      onKeyUp={(e) => {
        if (e.key !== 'Enter' && e.key !== ' ') return;
        e.preventDefault();
        up(true);
      }}
    >
      <span className="v4-sdock-num" aria-hidden="true">
        {i + 1}
      </span>
      {edit && step !== null && (
        <span className="v4-sdock-sl" aria-hidden="true">
          {step + 1}
        </span>
      )}
    </button>
  );
};

export const SmplDock: React.FC<{ getStage: () => Stage | null }> = ({ getStage }) => {
  const [shown, setShown] = useState(readOpen);
  const [page, setPage] = useState<Page>(readPage);
  const s = useSyncExternalStore(smplState.subscribe, smplState.get, smplState.get);
  const q = useSyncExternalStore(smplSeq.subscribe, smplSeq.get, smplSeq.get);
  const ref = useRef<HTMLDivElement>(null);
  useDockInset(getStage(), 'smpl', shown, ref);
  const rows = useMemo(() => SMPL_KNOB_ROWS.map((row) => row.map(knobSpec)), []);
  // La tete de lecture de la sequence (les pas en EDIT, la slice qui joue sinon)
  const [at, setAt] = useState(-1);
  useEffect(() => {
    if (!q.running) {
      setAt(-1);
      return undefined;
    }
    let raf = 0;
    const loop = (): void => {
      setAt(smplSeq.stepAt(smplSeq.now()));
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [q.running]);
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
  const pick = (p: Page): void => {
    setPage(p);
    try {
      window.localStorage.setItem(PAGE_KEY, p);
    } catch {
      /* stockage indisponible */
    }
  };
  const on = (k: (typeof SMPL_KEYS)[number]['kind']): boolean =>
    k === 'play' ? s.preview || q.running : k === 'rev' ? s.reverse : k === 'loop' ? s.loop : k === 'rec' ? s.recording : k === 'mode' ? s.mode === 'grain' : k === 'edit' ? q.edit : false;
  const line = s.message ?? (s.sample ? `${s.sample.name.toUpperCase()}  ${s.sample.duration.toFixed(2)} S` : 'PICK A FILE, REC, OR LOOP > SMPL ON THE MIXER');
  const playingSlice = at >= 0 ? smplSeq.sliceOf(q.steps[at]) : null;
  const tab = page === 'grain' ? 1 : 0;

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
        <div className="v4-dock-pages" role="tablist" aria-label="Sampler page">
          {PAGES.map((p) => (
            <button key={p.id} type="button" role="tab" aria-selected={page === p.id} className="v4-dock-page" onClick={() => pick(p.id)}>
              {p.label}
            </button>
          ))}
        </div>
        {page === 'pads' ? (
          <>
            <div className="v4-sdock-keys" role="group" aria-label="Sampler keys">
              {SMPL_KEYS.map((k) => (
                <button key={k.kind} type="button" className={k.kind === 'play' ? 'v4-sdock-key v4-sdock-play' : 'v4-sdock-key'} data-on={on(k.kind) ? '1' : '0'} aria-label={k.aria} aria-pressed={on(k.kind) || undefined} onClick={() => keyAction(k.kind)}>
                  {k.kind === 'mode' ? (s.mode === 'grain' ? 'GRAIN' : 'SLICE') : k.kind === 'slices' ? (s.slicing === 'auto' ? 'AUTO' : `${s.slicing} SL`) : k.label}
                </button>
              ))}
            </div>
            <Wave />
            <p className="v4-sdock-line" aria-live="polite">
              {line}
            </p>
            <div className="v4-sdock-pads" role="group" aria-label={q.edit ? 'Sequence steps 1 to 16' : 'Trigs 1 to 16, reading order'} data-edit={q.edit ? '1' : '0'}>
              {Array.from({ length: 16 }, (_, i) => {
                const st = q.steps[i];
                const k = st === null ? null : (smplSeq.sliceOf(st) ?? st);
                return <Pad key={i} i={i} edit={q.edit} step={k} lit={q.edit ? at === i && st !== null : s.pads.includes(i) || playingSlice === i} playing={at === i} slice={i < n} />;
              })}
            </div>
          </>
        ) : (
          <div className="v4-knobs">
            <Wave />
            <div className="v4-knobs-grid" role="tabpanel" aria-label={SMPL_ROW_NAMES[tab]}>
              {rows[tab].map((spec) => (
                <KnobView key={spec.label} spec={spec} />
              ))}
            </div>
            <p className="v4-sdock-line" aria-live="polite">
              {line}
            </p>
          </div>
        )}
      </div>
    </>
  );
};

export default SmplDock;
