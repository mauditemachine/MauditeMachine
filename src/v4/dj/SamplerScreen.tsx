/**
 * La page SMPL de l'ecran d'une platine (2026-10-07, Mika : "profitons
 * d'avoir un grand ecran pour voir les choses ; le design de l'interieur de
 * l'ecran [du MM-SMPL] me plait quand meme, quoiqu'un peu grossier, donc ne
 * change pas trop, mets les choses en valeur surtout ; tout doit etre
 * disponible en mobile, assez gros pour voir les choses"). Posee sur
 * l'ecran 3D comme la liste des morceaux (dj/TrackBrowser.tsx, une
 * homographie), a la place du morceau quand on appuie sur SMPL (ou REC DECK,
 * REC MIX). Les couleurs de l'ecran du MM-SMPL : l'os, la forme d'onde en
 * or (la region pleine, le reste eteint), les slices en orange numerotees,
 * POSITION en cyan, ce qui joue en jaune.
 *
 * Du haut vers le bas :
 * - l'en-tete : la platine, d'ou vient le sample (DECK, MIX, FILE), son
 *   nom, sa longueur (en temps et en secondes), TRACK (le morceau revient) ;
 * - les reglages qu'on touche en jouant : SLICE ou GRAIN, SLICES, LEN (ce que
 *   prend REC), REV, LOOP ;
 * - la forme d'onde : toucher une slice la joue, glisser choisit une region,
 *   pres d'une borne on la deplace ; en GRAIN, le doigt fait un nuage ;
 * - la page : PADS (une case par slice, en gros), SAMPLE (START, END,
 *   PITCH, LEVEL, ATTACK, RELEASE, FILTER), GRAIN (POSITION, SCAN, SIZE,
 *   DENSITY, SPRAY), SEQ (les seize pas, RANDOM, CLEAR) ; un reglage se
 *   glisse vers le haut ou la droite, deux tapes : sa valeur de depart ;
 * - les onglets, FILE et SAVE.
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { DJ_LIGHT, type DjDeck } from './theme';
import { smplKnob, smplValueText, type SmplKnobId } from '../sampler/params';
import { samplerOf, type Sampler, type SmplTab } from '../sampler/sampler';
import { SEQ_STEPS } from '../sampler/seq';
import { peaksOf } from '../sampler/slices';

const BONE = '#F6F1E7';
const DIM = 'rgba(246, 241, 231, 0.45)';
const FAINT = 'rgba(246, 241, 231, 0.16)';
const CYAN = '#5CC8FF';
const GOLD = '#FFA600';
const GOLD_DIM = 'rgba(255, 166, 0, 0.26)';
const ORANGE = DJ_LIGHT.orange;
const YELLOW = DJ_LIGHT.yellow;

/** Un reglage : 150 px la course entiere (Maj : dix fois plus fin), comme les potards. */
const KNOB_PX = 150;
const DOUBLE_TAP_MS = 320;
/** Une borne de la region se prend a moins de EDGE (part de la largeur de la forme d'onde). */
const EDGE = 0.035;
/** SEQ : les pixels par slice en glissant sur un pas, et le seuil du glisser. */
const SLICE_PX = 14;
const DRAG_PX = 6;

const TAB_LABEL: Readonly<Record<SmplTab, string>> = { pads: 'PADS', sample: 'SAMPLE', grain: 'GRAIN', seq: 'SEQ' };
const SAMPLE_KNOBS: readonly SmplKnobId[] = ['start', 'end', 'pitch', 'level', 'attack', 'release', 'filter'];
const GRAIN_KNOBS: readonly SmplKnobId[] = ['position', 'scan', 'size', 'density', 'spray'];

const useSampler = (sm: Sampler) => {
  const s = useSyncExternalStore(sm.subscribe, sm.get, sm.get);
  const v = useSyncExternalStore(sm.params.subscribe, sm.params.get, sm.params.get);
  const q = useSyncExternalStore(sm.seq.subscribe, sm.seq.get, sm.seq.get);
  return { s, v, q };
};

const capture = (e: React.PointerEvent<HTMLElement>): void => {
  try {
    e.currentTarget.setPointerCapture(e.pointerId);
  } catch {
    /* pas de capture */
  }
};

/* ---------------- la forme d'onde ---------------- */

const Wave: React.FC<{ sm: Sampler }> = ({ sm }) => {
  const { s, v } = useSampler(sm);
  const host = useRef<HTMLDivElement>(null);
  const cv = useRef<HTMLCanvasElement>(null);
  const layer = useRef<HTMLCanvasElement | null>(null);
  const peaks = useRef<{ id: number; w: number; data: Float32Array } | null>(null);
  const size = useRef({ w: 0, h: 0, dpr: 1 });
  const raf = useRef(0);
  const grip = useRef<{ hold: 'start' | 'end' | 'select' | 'position'; u0: number; pad: number; moved: boolean; x0: number } | null>(null);

  /** La forme d'onde et ses reperes, dans une couche ; l'image = la couche + les tetes. */
  const drawLayer = (): void => {
    const c = cv.current;
    if (!c) return;
    const { w, h, dpr } = size.current;
    if (w < 4 || h < 4) return;
    const L = (layer.current ??= document.createElement('canvas'));
    if (L.width !== c.width || L.height !== c.height) {
      L.width = c.width;
      L.height = c.height;
    }
    const g = L.getContext('2d');
    if (!g) return;
    const W = L.width;
    const H = L.height;
    g.clearRect(0, 0, W, H);
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, H);
    const st = sm.get();
    const val = sm.params.get();
    const data = sm.sampleData();
    const cy = H / 2;
    const half = H / 2 - 1.5 * dpr;
    g.fillStyle = FAINT;
    g.fillRect(0, cy - dpr / 2, W, dpr);
    if (!st.sample || !data) {
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillStyle = st.busy ? YELLOW : DIM;
      g.font = `600 ${Math.round(H * 0.13)}px ui-monospace, Menlo, monospace`;
      g.fillText(st.busy ? 'SAMPLING...' : 'PRESS REC DECK OR REC MIX', W / 2, cy - H * 0.12);
      g.fillStyle = FAINT;
      g.font = `500 ${Math.round(H * 0.1)}px ui-monospace, Menlo, monospace`;
      g.fillText('THE LAST BEATS OF THIS DECK, OR OF THE MIXER  /  FILE: A SOUND', W / 2, cy + H * 0.14);
      return;
    }
    const barW = Math.max(1, Math.round(2 * dpr));
    const gap = Math.max(1, Math.round(1 * dpr));
    const bars = Math.max(8, Math.floor(W / (barW + gap)));
    if (!peaks.current || peaks.current.id !== st.sample.id || peaks.current.w !== bars) peaks.current = { id: st.sample.id, w: bars, data: peaksOf(data.mono, 0, data.mono.length, bars) };
    const pk = peaks.current.data;
    let top = 0.05;
    for (let i = 0; i < pk.length; i += 1) top = Math.max(top, Math.abs(pk[i]));
    const dur = Math.max(1e-6, st.sample.duration);
    const xOf = (t: number): number => (Math.min(1, Math.max(0, t / dur)) * W);
    const ra = val.start * W;
    const rb = val.end * W;
    // La region : un fond a peine dore, les barres pleines dedans, eteintes dehors
    g.fillStyle = 'rgba(255, 166, 0, 0.08)';
    g.fillRect(ra, 0, rb - ra, H);
    const step = W / bars;
    for (let i = 0; i < bars; i += 1) {
      const x = i * step;
      const hh = (Math.max(Math.abs(pk[i * 2]), Math.abs(pk[i * 2 + 1])) / top) * half * 0.94;
      g.fillStyle = x + barW >= ra && x <= rb ? GOLD : GOLD_DIM;
      g.fillRect(x, cy - hh, barW, Math.max(dpr, 2 * hh));
    }
    // Les bornes de la region, en os
    g.fillStyle = BONE;
    for (const x of [ra, rb]) g.fillRect(Math.min(W - 2 * dpr, Math.max(0, x - dpr)), 0, 2 * dpr, H);
    // Les slices : un trait orange, le numero de son pad dans une etiquette en haut
    const n = Math.max(0, st.slices.length - 1);
    g.font = `700 ${Math.round(Math.min(H * 0.13, 12 * dpr))}px ui-monospace, Menlo, monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    const tagH = Math.round(Math.min(H * 0.16, 14 * dpr));
    for (let i = 0; i < n; i += 1) {
      const x = xOf(st.slices[i]);
      g.fillStyle = ORANGE;
      if (i > 0) g.fillRect(x - dpr * 0.75, 0, 1.5 * dpr, H);
      const lab = String(i + 1);
      const tw = g.measureText(lab).width + 5 * dpr;
      g.fillRect(x, 0, tw, tagH);
      g.fillStyle = '#000';
      g.fillText(lab, x + tw / 2, tagH / 2 + dpr * 0.5);
    }
    // GRAIN : POSITION en cyan, en pointille ; une encoche en bas de chaque slice (son pad)
    if (st.mode === 'grain') {
      const t = (val.start + (val.end - val.start) * val.position) * dur;
      const x = xOf(t);
      g.strokeStyle = CYAN;
      g.lineWidth = 2 * dpr;
      g.setLineDash([6 * dpr, 4 * dpr]);
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x, H);
      g.stroke();
      g.setLineDash([]);
      g.fillStyle = CYAN;
      const tick = H * 0.14;
      for (let i = 0; i < n; i += 1) {
        const xs = xOf(st.slices[i] + (st.slices[i + 1] - st.slices[i]) * val.position);
        g.fillRect(xs - dpr, H - tick, 2 * dpr, tick);
      }
    }
  };

  /** L'image : la couche, puis une tete par voix (jaune) et par nuage (cyan). */
  const paint = (): boolean => {
    const c = cv.current;
    const L = layer.current;
    if (!c || !L) return false;
    const g = c.getContext('2d');
    if (!g) return false;
    g.drawImage(L, 0, 0);
    const st = sm.get();
    const live = sm.liveNow();
    const dur = st.sample?.duration ?? 0;
    if (dur <= 0) return false;
    const { dpr } = size.current;
    let any = false;
    const head = (t: number, color: string, w: number): void => {
      const x = Math.min(1, Math.max(0, t / dur)) * c.width;
      g.fillStyle = color;
      g.fillRect(x - (w * dpr) / 2, 0, w * dpr, c.height);
      any = true;
    };
    for (const t of live.voices.values()) head(t, YELLOW, 2);
    for (const t of live.clouds.values()) head(t, CYAN, 3);
    return any;
  };

  const frame = (): void => {
    raf.current = 0;
    if (paint()) raf.current = requestAnimationFrame(frame);
  };
  const kick = (): void => {
    if (!raf.current) raf.current = requestAnimationFrame(frame);
  };

  // La taille : celle de la page a l'ecran (elle suit la vue), en pixels de l'appareil
  useEffect(() => {
    const el = host.current;
    const c = cv.current;
    if (!el || !c) return undefined;
    const fit = (): void => {
      const dpr = Math.min(3, window.devicePixelRatio || 1);
      const w = el.clientWidth;
      const h = el.clientHeight;
      size.current = { w, h, dpr };
      const W = Math.max(1, Math.round(w * dpr));
      const H = Math.max(1, Math.round(h * dpr));
      if (c.width !== W || c.height !== H) {
        c.width = W;
        c.height = H;
      }
      drawLayer();
      paint();
    };
    fit();
    const ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(fit) : null;
    ro?.observe(el);
    return () => ro?.disconnect();
  }, [sm]);

  // Ce qui change le dessin : le sample, la decoupe, la region, le mode, POSITION
  useEffect(() => {
    drawLayer();
    paint();
  }, [s.sample, s.slices, s.mode, s.busy, v.start, v.end, v.position]);

  // Les tetes : a chaque rapport du worklet, une image ; tant que ca joue, chaque image
  useEffect(() => sm.subscribeLive(kick), [sm]);
  useEffect(() => () => cancelAnimationFrame(raf.current), []);

  /** u (0 a 1) sous le pointeur. */
  const uAt = (e: React.PointerEvent<HTMLElement>): number => {
    const r = e.currentTarget.getBoundingClientRect();
    // La page est en perspective : la largeur a l'ecran est celle de la boite projetee (assez juste pour un doigt)
    return Math.min(1, Math.max(0, (e.clientX - r.left) / Math.max(1, r.width)));
  };

  const setPosition = (u: number): void => {
    const val = sm.params.get();
    sm.dial('position', (u - val.start) / Math.max(1e-6, val.end - val.start));
  };

  const onDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    const st = sm.get();
    if (!st.sample) return;
    e.preventDefault();
    capture(e);
    const u = uAt(e);
    const val = sm.params.get();
    const g = { hold: 'select' as 'start' | 'end' | 'select' | 'position', u0: u, pad: -1, moved: false, x0: e.clientX };
    if (Math.abs(u - val.start) < EDGE && Math.abs(u - val.start) <= Math.abs(u - val.end)) g.hold = 'start';
    else if (Math.abs(u - val.end) < EDGE) g.hold = 'end';
    else if (st.mode === 'grain') {
      g.hold = 'position';
      setPosition(u);
      sm.touch(true);
    } else {
      // Toucher sans glisser : la slice sous le doigt sonne (comme son pad)
      const t = u * st.sample.duration;
      const sl = st.slices;
      for (let i = 0; i + 1 < sl.length; i += 1) {
        if (t >= sl[i] && t < sl[i + 1]) {
          g.pad = i;
          sm.pad(i, true);
          break;
        }
      }
    }
    grip.current = g;
  };

  const onMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const g = grip.current;
    if (!g) return;
    const u = uAt(e);
    if (!g.moved && Math.abs(e.clientX - g.x0) < 4) return;
    g.moved = true;
    if (g.hold === 'start') sm.dial('start', u);
    else if (g.hold === 'end') sm.dial('end', u);
    else if (g.hold === 'position') setPosition(u);
    else {
      // Glisser : une nouvelle region, du point de depart au doigt (la slice touchee se tait)
      if (g.pad >= 0) {
        sm.pad(g.pad, false);
        g.pad = -1;
      }
      const a = Math.min(g.u0, u);
      const b = Math.max(g.u0, u);
      if (b - a < 0.004) return;
      if (a < sm.params.of('start')) {
        sm.dial('start', a);
        sm.dial('end', b);
      } else {
        sm.dial('end', b);
        sm.dial('start', a);
      }
    }
  };

  const onUp = (): void => {
    const g = grip.current;
    grip.current = null;
    if (!g) return;
    if (g.pad >= 0) sm.pad(g.pad, false);
    if (g.hold === 'position') sm.touch(false);
  };

  return (
    <div ref={host} className="dj-smp-wave" onPointerDown={onDown} onPointerMove={onMove} onPointerUp={onUp} onPointerCancel={onUp}>
      <canvas ref={cv} aria-hidden="true" />
      {s.message && <div className="dj-smp-msg">{s.message}</div>}
    </div>
  );
};

/* ---------------- un reglage ---------------- */

const Dial: React.FC<{ sm: Sampler; id: SmplKnobId }> = ({ sm, id }) => {
  const v = useSyncExternalStore(sm.params.subscribe, () => sm.params.of(id), () => sm.params.of(id));
  const dur = useSyncExternalStore(sm.subscribe, () => sm.get().sample?.duration ?? 0, () => 0);
  const k = smplKnob(id);
  const grip = useRef<{ x: number; y: number; v0: number } | null>(null);
  const lastTap = useRef(0);
  const text = smplValueText(id, v, dur);
  const lo = k.bipolar ? Math.min(0.5, v) : 0;
  const hi = k.bipolar ? Math.max(0.5, v) : v;
  return (
    <div
      className="dj-smp-dial"
      role="slider"
      tabIndex={0}
      aria-label={k.aria}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(v * 100)}
      aria-valuetext={text}
      onPointerDown={(e) => {
        e.preventDefault();
        capture(e);
        const now = performance.now();
        if (now - lastTap.current < DOUBLE_TAP_MS) {
          sm.dial(id, sm.params.def(id));
          lastTap.current = 0;
          grip.current = null;
          return;
        }
        lastTap.current = now;
        grip.current = { x: e.clientX, y: e.clientY, v0: v };
      }}
      onPointerMove={(e) => {
        const g = grip.current;
        if (!g) return;
        const d = (e.clientX - g.x - (e.clientY - g.y)) / KNOB_PX;
        sm.dial(id, g.v0 + d * (e.shiftKey ? 0.1 : 1));
      }}
      onPointerUp={() => {
        grip.current = null;
      }}
      onPointerCancel={() => {
        grip.current = null;
      }}
      onWheel={(e) => {
        e.preventDefault();
        sm.dial(id, sm.params.of(id) + (e.deltaY < 0 ? 0.02 : -0.02));
      }}
      onKeyDown={(e) => {
        const step = e.shiftKey ? 0.1 : 0.02;
        const x = sm.params.of(id);
        let next: number | null = null;
        if (e.key === 'ArrowUp' || e.key === 'ArrowRight') next = x + step;
        else if (e.key === 'ArrowDown' || e.key === 'ArrowLeft') next = x - step;
        else if (e.key === 'Home') next = 0;
        else if (e.key === 'End') next = 1;
        else if (e.key === 'Delete' || e.key === 'Backspace') next = sm.params.def(id);
        if (next === null) return;
        e.preventDefault();
        sm.dial(id, next);
      }}
    >
      <span className="dj-smp-dial-name">{k.label}</span>
      <span className="dj-smp-dial-val">{text}</span>
      <span className="dj-smp-dial-bar" aria-hidden="true">
        <span style={{ left: `${lo * 100}%`, width: `${Math.max(0.6, (hi - lo) * 100)}%` }} />
      </span>
    </div>
  );
};

/* ---------------- les pages ---------------- */

const Pads: React.FC<{ sm: Sampler }> = ({ sm }) => {
  const { s } = useSampler(sm);
  const n = Math.max(0, s.slices.length - 1);
  const count = n > 8 ? 16 : Math.max(4, n || 8);
  return (
    <div className="dj-smp-pads" data-rows={count > 8 ? '2' : '1'} style={{ gridTemplateColumns: `repeat(${count > 8 ? 8 : count}, 1fr)` }}>
      {Array.from({ length: count }, (_, i) => {
        const has = i < n;
        const lit = s.pads.includes(i);
        return (
          <button
            key={i}
            type="button"
            className="dj-smp-pad"
            data-slice={has ? '1' : '0'}
            data-on={lit ? '1' : '0'}
            aria-label={`Pad ${i + 1}${has ? '' : ', no slice'}`}
            aria-pressed={lit}
            onPointerDown={(e) => {
              e.preventDefault();
              capture(e);
              sm.pad(i, true);
            }}
            onPointerUp={() => sm.pad(i, false)}
            onPointerCancel={() => sm.pad(i, false)}
            onKeyDown={(e) => {
              if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat) return;
              e.preventDefault();
              sm.pad(i, true);
            }}
            onKeyUp={(e) => {
              if (e.key !== 'Enter' && e.key !== ' ') return;
              e.preventDefault();
              sm.pad(i, false);
            }}
          >
            {i + 1}
          </button>
        );
      })}
    </div>
  );
};

const Step: React.FC<{ sm: Sampler; i: number; step: number | null; head: boolean }> = ({ sm, i, step, head }) => {
  const down = useRef<{ y: number; base: number; dragged: boolean } | null>(null);
  const shown = step === null ? null : (sm.seq.sliceOf(step) ?? step);
  return (
    <button
      type="button"
      className="dj-smp-step"
      data-on={step !== null ? '1' : '0'}
      data-beat={i % 4 === 0 ? '1' : '0'}
      data-head={head ? '1' : '0'}
      aria-label={step === null ? `Step ${i + 1}: empty` : `Step ${i + 1}: slice ${(shown ?? 0) + 1}`}
      aria-pressed={step !== null}
      onPointerDown={(e) => {
        e.preventDefault();
        capture(e);
        down.current = { y: e.clientY, base: step ?? -1, dragged: false };
      }}
      onPointerMove={(e) => {
        const d = down.current;
        if (!d) return;
        const dy = e.clientY - d.y;
        if (!d.dragged && Math.abs(dy) < DRAG_PX) return;
        if (!d.dragged && d.base < 0) {
          // Un pas vide qu'on glisse : il se pose d'abord (la slice de son heure)
          sm.stepTap(i);
          d.base = sm.seq.get().steps[i] ?? 0;
        }
        d.dragged = true;
        sm.stepSlice(i, d.base + Math.round(-dy / SLICE_PX));
      }}
      onPointerUp={() => {
        const d = down.current;
        down.current = null;
        if (d && !d.dragged) sm.stepTap(i);
      }}
      onPointerCancel={() => {
        down.current = null;
      }}
      onKeyDown={(e) => {
        if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault();
          sm.stepSlice(i, (step ?? 0) + (e.key === 'ArrowUp' ? 1 : -1));
          return;
        }
        if ((e.key !== 'Enter' && e.key !== ' ') || e.repeat) return;
        e.preventDefault();
        sm.stepTap(i);
      }}
    >
      {shown !== null ? shown + 1 : ''}
    </button>
  );
};

const Seq: React.FC<{ sm: Sampler }> = ({ sm }) => {
  const { q } = useSampler(sm);
  const [, tick] = React.useReducer((x: number) => x + 1, 0);
  // La tete de lecture : la case qui joue, relue a chaque image tant que la sequence tourne
  useEffect(() => {
    if (!q.running) return undefined;
    let raf = 0;
    let last = -2;
    const loop = (): void => {
      const c = sm.seq.stepAt(sm.now());
      if (c !== last) {
        last = c;
        tick();
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [q.running, sm]);
  const at = q.running ? sm.seq.stepAt(sm.now()) : -1;
  return (
    <div className="dj-smp-seq">
      <div className="dj-smp-steps">
        {Array.from({ length: SEQ_STEPS }, (_, i) => (
          <Step key={i} sm={sm} i={i} step={q.steps[i]} head={i === at} />
        ))}
      </div>
      <div className="dj-smp-seqkeys">
        <button type="button" className="dj-smp-key" onClick={() => sm.random()}>
          RANDOM
        </button>
        <button type="button" className="dj-smp-key" onClick={() => sm.clear()}>
          CLEAR
        </button>
      </div>
    </div>
  );
};

/* ---------------- la page entiere ---------------- */

const SRC_LABEL = { deck: 'DECK', mix: 'MIX', file: 'FILE' } as const;

export const DeckSampler: React.FC<{ deck: DjDeck; setRoot: (d: DjDeck, el: HTMLDivElement | null) => void }> = ({ deck, setRoot }) => {
  const sm = samplerOf(deck);
  const { s, q } = useSampler(sm);
  const sample = s.sample;
  const n = Math.max(0, s.slices.length - 1);
  const playing = q.running || s.preview;
  return (
    <div ref={(el) => setRoot(deck, el)} className="dj-scr dj-smp" data-deck={deck} role="region" aria-label={`Deck ${deck.toUpperCase()} sampler`}>
      <div className="dj-smp-head">
        <span className="dj-scr-deck">{deck.toUpperCase()}</span>
        <span className="dj-smp-tag">SMPL</span>
        {sample && <span className="dj-smp-src">{SRC_LABEL[sample.source]}</span>}
        <span className="dj-smp-name">{sample ? sample.name : 'EMPTY'}</span>
        {sample && (
          <span className="dj-smp-len">
            {sample.beats ? `${sample.beats} BEATS  ` : ''}
            {sample.duration.toFixed(2)} S
          </span>
        )}
        <button type="button" className="dj-smp-key dj-smp-back" onClick={() => sm.toggleOpen(false)} aria-label="Back to the track on the screen">
          TRACK
        </button>
      </div>
      <div className="dj-smp-chips">
        <button type="button" className="dj-smp-chip" data-hot="1" onClick={() => sm.modeToggle()} aria-label={`Mode ${s.mode}: press for ${s.mode === 'slice' ? 'grain' : 'slice'}`}>
          {s.mode === 'grain' ? 'GRAIN' : 'SLICE'}
        </button>
        <button type="button" className="dj-smp-chip" data-on="1" onClick={() => sm.slicingNext()} aria-label="Slices: 4, 8, 16 or auto">
          {s.slicing === 'auto' ? `AUTO ${n}` : `SLICES ${s.slicing}`}
        </button>
        <button type="button" className="dj-smp-chip" data-on="1" onClick={() => sm.lenNext()} aria-label="Length of REC DECK and REC MIX, in beats">
          LEN {s.len}
        </button>
        <button type="button" className="dj-smp-chip" data-hot={s.reverse ? '1' : '0'} aria-pressed={s.reverse} onClick={() => sm.reverseToggle()}>
          REV
        </button>
        <button type="button" className="dj-smp-chip" data-hot={s.loop ? '1' : '0'} aria-pressed={s.loop} onClick={() => sm.loopToggle()} aria-label="Loop the pads while held">
          LOOP
        </button>
        <button type="button" className="dj-smp-chip dj-smp-play" data-play={playing ? '1' : '0'} onClick={() => sm.playToggle()} aria-label={playing ? 'Stop the sampler' : 'Play the sequence or the region'}>
          {playing ? 'STOP' : 'PLAY'}
        </button>
      </div>
      <Wave sm={sm} />
      <div className="dj-smp-page" data-tab={s.tab}>
        {s.tab === 'pads' && <Pads sm={sm} />}
        {s.tab === 'sample' && (
          <div className="dj-smp-dials" data-n="7">
            {SAMPLE_KNOBS.map((id) => (
              <Dial key={id} sm={sm} id={id} />
            ))}
          </div>
        )}
        {s.tab === 'grain' && (
          <div className="dj-smp-dials" data-n="5">
            {GRAIN_KNOBS.map((id) => (
              <Dial key={id} sm={sm} id={id} />
            ))}
            {s.mode !== 'grain' && (
              <button type="button" className="dj-smp-key dj-smp-hint" onClick={() => sm.modeToggle()}>
                GRAIN MODE: OFF, PRESS TO TURN ON
              </button>
            )}
          </div>
        )}
        {s.tab === 'seq' && <Seq sm={sm} />}
      </div>
      <div className="dj-smp-tabs" role="tablist">
        {(['pads', 'sample', 'grain', 'seq'] as const).map((t) => (
          <button key={t} type="button" role="tab" aria-selected={s.tab === t} className="dj-smp-tab" data-dot={t === 'seq' && sm.seq.any() ? '1' : '0'} onClick={() => sm.setTab(t)}>
            {TAB_LABEL[t]}
          </button>
        ))}
        <span className="dj-smp-gap" />
        <button type="button" className="dj-smp-key" onClick={() => sm.pickFile()} aria-label="Load a sound file into the sampler">
          FILE
        </button>
        <button type="button" className="dj-smp-key" onClick={() => sm.save()} aria-label="Save the region as a WAV file">
          SAVE
        </button>
      </div>
    </div>
  );
};
