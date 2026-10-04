/**
 * L'oscilloscope dans OPEN (2026-10-04, Mika, avec une capture
 * d'occularScope : "je voudrais qu'un ecran oscilloscope s'affiche dans
 * OPEN et un peu parametrable, et de ce fait on peut voir si la phase bouge
 * ou pas ; je veux quelque chose d'ultra precis"). Capot du MM-RYTM ou du
 * MM-ARP ouvert : un ecran sombre a sa grille, la trace en vert phosphore,
 * a l'echantillon pres (audio/scope.ts).
 *
 * - SOURCE : la machine ouverte (RYTM ou ARP), le KICK seul, KICK+ARP (le
 *   kick en orange, l'arpege en vert : leur phase l'un contre l'autre),
 *   OUT (ce qui sort du site).
 * - Fenetre (1/16 a 1 BAR) calee sur la grille des temps (TRIG BEAT) : la
 *   fenetre en cours se remplit sur la meme place des mesures precedentes,
 *   laissees en fantomes (GHOSTS) ; un groove qui revient a sa place ne
 *   bouge pas, une phase qui glisse se voit. Rien ne joue (ou TRIG AUTO) :
 *   un front montant, et les fenetres d'avant.
 * - VIEW : L/R (gauche vert, droite bleu), MID, SIDE, XY (le goniometre :
 *   vertical en phase, horizontal en opposition).
 * - GAIN x1 a x16, lignes a -3, -6 et -12 dBFS ; FREEZE fige l'ecran.
 * - Les mesures : la crete de la fenetre (dBFS), la correlation (L contre
 *   R ; KICK contre ARP), et DRIFT : de combien la fenetre a glisse depuis
 *   la meme place une mesure plus tot (correlation croisee sur ses 4096
 *   premiers echantillons, affinee a la parabole), en millisecondes.
 * Desktop : un panneau a droite de la machine ouverte, qu'on deplace par sa
 * barre du haut (retenu ; double clic : sa place) ; telephone : replie en
 * pastille SCOPE en haut, deplie sur le haut de l'ecran.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { hoodMachine, hoodOf } from '../actions';
import { clock } from '../audio/clock';
import { pattern } from '../audio/pattern';
import {
  SCOPE_GAINS,
  SCOPE_HOLDS,
  SCOPE_SOURCES,
  SCOPE_SOURCE_LABEL,
  SCOPE_VIEWS,
  SCOPE_VIEW_LABEL,
  SCOPE_WINDOWS,
  SCOPE_WINDOW_LABEL,
  scopeEngine,
  scopeSettings,
  RING,
  type ScopeSettings,
  type ScopeSource,
} from '../audio/scope';
import { explode, voyExplode } from '../state/explode';
import { focus } from '../state/focus';

const GREEN = '#62f28c';
const CYAN = '#5cc8ff';
const ORANGE = '#ff6a13';
const BONE = 'rgba(246, 241, 231, ';
const BG = '#0a0b0c';
/** Fantomes : l'alpha de la fenetre d'il y a k fenetres. */
const ghostAlpha = (k: number): number => 0.42 * Math.pow(0.62, k - 1);

interface Measure {
  peakDb: number;
  corr: number | null;
  drift: number | null;
  windowMs: number;
  mode: 'beat' | 'auto';
}

/**
 * La fenetre a montrer : son premier echantillon, sa longueur, si elle se
 * remplit encore, et sa periode (l'ecart avec la fenetre qui lui ressemble :
 * calee sur la grille, la meme place une mesure plus tot, le motif s'y
 * repete ; en AUTO, la fenetre d'avant).
 */
function windowOf(s: ScopeSettings, sig: (f: number) => number): { start: number; len: number; period: number; filling: boolean; mode: 'beat' | 'auto' } | null {
  const e = scopeEngine;
  const sr = e.sampleRate;
  const end = e.end;
  if (end <= 0) return null;
  const t = end / sr;
  const g = s.trig === 'beat' ? e.grid(t) : null;
  if (g) {
    // La frontiere de pas a t ou avant, puis le debut de la fenetre (un multiple de W pas dans la mesure)
    const atOrBefore = g.time <= t + 1e-9;
    const b0 = atOrBefore ? g.time : g.time - g.dur;
    const s0 = atOrBefore ? g.step : (g.step + 15) % 16;
    const start = b0 - (s0 % s.window) * g.dur;
    return { start: Math.round(start * sr), len: Math.max(16, Math.round(s.window * g.dur * sr)), period: Math.round(16 * g.dur * sr), filling: true, mode: 'beat' };
  }
  // AUTO : le dernier front montant qui laisse une fenetre entiere derriere lui
  const len = Math.max(16, Math.round(((s.window * 60) / (clock.bpm || pattern.get().bpm || 120) / 4) * sr));
  const lo = Math.max(e.first + 1, end - 2 * len);
  const hi = end - len;
  if (hi <= lo) return { start: Math.max(e.first, end - len), len, period: len, filling: false, mode: 'auto' };
  let peak = 0;
  for (let f = lo; f < end; f += 4) peak = Math.max(peak, Math.abs(sig(f)));
  const th = Math.max(0.01, peak * 0.25);
  for (let f = hi; f > lo; f -= 1) if (sig(f - 1) < th && sig(f) >= th) return { start: f, len, period: len, filling: false, mode: 'auto' };
  return { start: hi, len, period: len, filling: false, mode: 'auto' };
}

/**
 * DRIFT : le decalage (en echantillons, au centieme) qui aligne le mieux
 * la fenetre sur celle d'une mesure plus tot (correlation croisee, +/-
 * maxLag, sur ses n premiers echantillons), affine par une parabole ; null
 * sans signal, ou si les deux ne se ressemblent pas (correlation sous 0.6 :
 * un autre accord, un autre coup, le decalage ne voudrait rien dire).
 */
function driftOf(sig: (f: number) => number, a: number, b: number, n: number, maxLag: number): number | null {
  let ea = 0;
  let eb = 0;
  for (let i = 0; i < n; i += 2) {
    ea += sig(a + i) * sig(a + i);
    eb += sig(b + i) * sig(b + i);
  }
  if (ea < 1e-6 || eb < 1e-6) return null;
  let best = -Infinity;
  let bestLag = 0;
  const score = new Float64Array(2 * maxLag + 1);
  for (let lag = -maxLag; lag <= maxLag; lag += 1) {
    let c = 0;
    for (let i = 0; i < n; i += 2) c += sig(a + i) * sig(b + i + lag);
    score[lag + maxLag] = c;
    if (c > best) {
      best = c;
      bestLag = lag;
    }
  }
  if (best / Math.sqrt(ea * eb) < 0.6) return null;
  const k = bestLag + maxLag;
  if (k > 0 && k < score.length - 1) {
    const y0 = score[k - 1];
    const y1 = score[k];
    const y2 = score[k + 1];
    const den = y0 - 2 * y1 + y2;
    if (Math.abs(den) > 1e-12) return bestLag + (0.5 * (y0 - y2)) / den;
  }
  return bestLag;
}

/** Peint l'ecran ; renvoie les mesures (ou null s'il n'y a rien a peindre). */
function paint(cv: HTMLCanvasElement, s: ScopeSettings, source: ScopeSource, last: { drift: number | null; at: number }): Measure | null {
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  const W = Math.max(1, Math.round(cv.clientWidth * dpr));
  const H = Math.max(1, Math.round(cv.clientHeight * dpr));
  if (cv.width !== W || cv.height !== H) {
    cv.width = W;
    cv.height = H;
  }
  const c = cv.getContext('2d');
  if (!c) return null;
  const e = scopeEngine;
  const aL = e.raw('aL');
  const aR = e.raw('aR');
  const bb = e.raw('b');
  const first = e.first;
  const end = e.end;
  const ok = (f: number): boolean => f >= first && f < end;
  // Les signaux selon la vue (A en stereo, B en mono)
  const L = (f: number): number => (ok(f) ? aL[f % RING] : 0);
  const R = (f: number): number => (ok(f) ? aR[f % RING] : 0);
  const B = (f: number): number => (ok(f) ? bb[f % RING] : 0);
  const mid = (f: number): number => 0.5 * (L(f) + R(f));
  const side = (f: number): number => 0.5 * (L(f) - R(f));
  const dual = source === 'kickarp';
  const view = dual && s.view !== 'xy' ? 'mid' : s.view;
  const main = view === 'side' ? side : mid;

  c.fillStyle = BG;
  c.fillRect(0, 0, W, H);
  const pad = Math.round(8 * dpr);
  const x0 = pad;
  const x1 = W - pad;
  const cy = H / 2;
  const hh = H / 2 - pad;
  const win = windowOf(s, main);

  // La grille : une ligne par pas de seize (les temps plus marques), le zero, -3 -6 -12 dBFS
  c.lineWidth = 1;
  const steps = s.window;
  const sub = steps === 1 ? 4 : steps;
  for (let k = 0; k <= sub; k += 1) {
    const x = Math.round(x0 + ((x1 - x0) * k) / sub) + 0.5;
    const beat = steps >= 4 ? k % 4 === 0 : k === 0 || k === sub;
    c.strokeStyle = `${BONE}${beat ? 0.16 : 0.07})`;
    c.beginPath();
    c.moveTo(x, pad);
    c.lineTo(x, H - pad);
    c.stroke();
  }
  c.strokeStyle = `${BONE}0.2)`;
  c.beginPath();
  c.moveTo(x0, Math.round(cy) + 0.5);
  c.lineTo(x1, Math.round(cy) + 0.5);
  c.stroke();
  c.font = `${Math.round(9 * dpr)}px 'SF Pro Display', system-ui, sans-serif`;
  c.textBaseline = 'middle';
  for (const db of [0, -3, -6, -12]) {
    const a = Math.pow(10, db / 20) * s.gain;
    if (a * 0.92 > 1) continue;
    for (const sg of [-1, 1]) {
      const y = Math.round(cy - sg * a * hh * 0.92) + 0.5;
      c.strokeStyle = `${BONE}${db === 0 ? 0.14 : 0.08})`;
      c.setLineDash(db === 0 ? [] : [3 * dpr, 4 * dpr]);
      c.beginPath();
      c.moveTo(x0, y);
      c.lineTo(x1, y);
      c.stroke();
      c.setLineDash([]);
      if (sg === 1) {
        c.fillStyle = `${BONE}0.38)`;
        c.fillText(`${db} dB`, x0 + 4 * dpr, y - 6 * dpr);
      }
    }
  }
  if (!win) return null;
  const sr = e.sampleRate;
  const yOf = (v: number): number => cy - Math.max(-1.08, Math.min(1.08, v * s.gain * 0.92)) * hh;

  if (view === 'xy') {
    // Le goniometre : la fenetre entiere la plus recente, au plus 12000 points
    const r = Math.min(x1 - x0, H - 2 * pad) / 2;
    const cx = W / 2;
    c.strokeStyle = `${BONE}0.12)`;
    c.beginPath();
    c.arc(cx, cy, r * 0.92, 0, Math.PI * 2);
    c.moveTo(cx - r, cy);
    c.lineTo(cx + r, cy);
    c.moveTo(cx, cy - r);
    c.lineTo(cx, cy + r);
    c.stroke();
    c.fillStyle = `${BONE}0.38)`;
    c.fillText('L', cx - r * 0.72, cy - r * 0.72);
    c.fillText('R', cx + r * 0.66, cy - r * 0.72);
    const startXY = win.filling ? Math.max(first, end - win.len) : win.start;
    const n = win.len;
    const stride = Math.max(1, Math.floor(n / 12000));
    c.fillStyle = GREEN;
    c.globalAlpha = 0.55;
    const k = (r * 0.92 * s.gain) / Math.SQRT2;
    for (let f = startXY; f < startXY + n; f += stride) {
      const l = L(f);
      const rr = R(f);
      c.fillRect(cx + (l - rr) * k, cy - (l + rr) * k, dpr, dpr);
    }
    c.globalAlpha = 1;
  } else {
    // Une trace : enveloppe min / max par colonne, ou les echantillons eux-memes de pres
    const trace = (sig: (f: number) => number, start: number, upto: number, color: string, alpha: number): void => {
      const n = win.len;
      const cols = x1 - x0;
      const spp = n / cols;
      c.globalAlpha = alpha;
      c.fillStyle = color;
      c.strokeStyle = color;
      if (spp <= 1.5) {
        c.lineWidth = 1.25 * dpr;
        c.beginPath();
        let moved = false;
        for (let i = 0; i < n && start + i < upto; i += 1) {
          const x = x0 + (i / n) * cols;
          const y = yOf(sig(start + i));
          if (!moved) {
            c.moveTo(x, y);
            moved = true;
          } else c.lineTo(x, y);
        }
        c.stroke();
      } else {
        for (let col = 0; col < cols; col += 1) {
          const f0 = start + Math.floor(col * spp);
          const f1 = Math.min(start + Math.floor((col + 1) * spp), upto);
          if (f0 >= upto) break;
          let lo = Infinity;
          let hi = -Infinity;
          const step = spp > 64 ? 2 : 1;
          for (let f = f0; f < f1; f += step) {
            const v = sig(f);
            if (v < lo) lo = v;
            if (v > hi) hi = v;
          }
          if (lo === Infinity) continue;
          const ya = yOf(hi);
          const yb = yOf(lo);
          c.fillRect(x0 + col, ya, 1, Math.max(dpr, yb - ya));
        }
      }
      c.globalAlpha = 1;
    };
    const traces: { sig: (f: number) => number; color: string }[] = dual
      ? [
          { sig: mid, color: ORANGE },
          { sig: B, color: GREEN },
        ]
      : view === 'lr'
        ? [
            { sig: L, color: GREEN },
            { sig: R, color: CYAN },
          ]
        : [{ sig: main, color: GREEN }];
    // Les fantomes : la meme place dans les mesures precedentes (en AUTO, les fenetres d'avant), de la plus ancienne a la plus recente
    const ghosts = win.filling ? s.hold : Math.min(s.hold, 3);
    for (let k = ghosts; k >= 1; k -= 1) {
      const st = win.start - k * win.period;
      if (st < first) continue;
      for (const t of traces) trace(t.sig, st, st + win.len, t.color, ghostAlpha(k) * (traces.length > 1 ? 0.8 : 1));
    }
    const upto = win.filling ? Math.min(end, win.start + win.len) : win.start + win.len;
    for (const t of traces) trace(t.sig, win.start, upto, t.color, traces.length > 1 ? 0.85 : 1);
    // La tete : ou en est la fenetre qui se remplit
    if (win.filling && end < win.start + win.len) {
      const x = x0 + ((end - win.start) / win.len) * (x1 - x0);
      c.fillStyle = `${BONE}0.35)`;
      c.fillRect(Math.round(x), pad, Math.max(1, Math.round(dpr)), H - 2 * pad);
    }
  }

  // Les mesures : sur la derniere fenetre entiere (en se remplissant, la meme place une mesure plus tot)
  const full = win.filling ? win.start - win.period : win.start;
  let peak = 0;
  let sab = 0;
  let saa = 0;
  let sbb = 0;
  const stride = Math.max(1, Math.floor(win.len / 24000));
  const pa = dual ? mid : L;
  const pb = dual ? B : R;
  for (let f = full; f < full + win.len; f += stride) {
    const a = pa(f);
    const b = pb(f);
    peak = Math.max(peak, Math.abs(L(f)), Math.abs(R(f)), dual ? Math.abs(b) : 0);
    sab += a * b;
    saa += a * a;
    sbb += b * b;
  }
  const corr = saa > 1e-9 && sbb > 1e-9 ? sab / Math.sqrt(saa * sbb) : null;
  // DRIFT : cinq fois par seconde, la fenetre entiere contre celle d'avant
  const now = performance.now();
  if (now - last.at > 200) {
    last.at = now;
    const n = Math.min(4096, win.len);
    const maxLag = Math.min(Math.round(0.005 * sr), Math.floor(win.len / 4));
    const sig = dual ? B : main;
    const d = full - win.period >= first ? driftOf(sig, full - win.period, full, n, maxLag) : null;
    last.drift = d === null ? null : (d / sr) * 1000;
  }
  return { peakDb: peak > 0 ? 20 * Math.log10(peak) : -Infinity, corr, drift: last.drift, windowMs: (win.len / sr) * 1000, mode: win.mode };
}

const fmtDb = (v: number): string => (v === -Infinity ? '-INF' : `${v > 0 ? '+' : ''}${v.toFixed(1)}`);
const fmtSigned = (v: number, d: number): string => `${v >= 0 ? '+' : ''}${v.toFixed(d)}`;

/** Une valeur suivante (ou precedente) dans une liste, sans boucler. */
const stepIn = <T,>(list: readonly T[], v: T, dir: 1 | -1): T => list[Math.max(0, Math.min(list.length - 1, list.indexOf(v) + dir))];

interface Props {
  mobile: boolean;
}

export const Scope: React.FC<Props> = ({ mobile }) => {
  useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const s = useSyncExternalStore(scopeSettings.subscribe, scopeSettings.get, scopeSettings.get);
  const m = hoodMachine();
  const open = m !== 'dj' && hoodOf(m).get() === 'open';
  const source: ScopeSource = s.source ?? (m === 'voy' ? 'arp' : 'rytm');
  // Au telephone, replie au depart : la carte et ses TWEAKS d'abord
  const [unfolded, setUnfolded] = useState(!mobile && s.shown);
  const live = open && unfolded;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [meas, setMeas] = useState<Measure | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (!live) {
      scopeEngine.stop();
      return undefined;
    }
    let gone = false;
    const tryStart = (): void => {
      void scopeEngine.start(source).then((ok) => {
        if (!gone) setReady(ok);
      });
    };
    tryStart();
    // Le son nait au premier geste : on reessaie tant qu'il n'est pas la
    const t = window.setInterval(() => {
      if (!scopeEngine.ready) tryStart();
    }, 700);
    return () => {
      gone = true;
      window.clearInterval(t);
      scopeEngine.stop();
    };
  }, [live, source]);

  useEffect(() => {
    if (!live) return undefined;
    let raf = 0;
    let shownAt = 0;
    const last = { drift: null as number | null, at: 0 };
    // Telephone : 30 images par seconde suffisent a l'oeil, la batterie dit merci ;
    // desktop : 60 au plus (un ecran a 120 Hz en peignait deux fois plus)
    const minMs = mobile ? 30 : 12;
    let prev = 0;
    const frame = (now: number): void => {
      raf = requestAnimationFrame(frame);
      const cv = canvasRef.current;
      const cur = scopeSettings.get();
      if (!cv || cur.freeze || now - prev < minMs) return;
      prev = now;
      const r = paint(cv, cur, source, last);
      // Les chiffres, quatre fois par seconde
      if (r && now - shownAt > 250) {
        shownAt = now;
        setMeas(r);
      }
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [live, source, mobile]);

  if (!open) return null;

  const set = (patch: Partial<ScopeSettings>): void => scopeSettings.set(patch);
  const stop = (e: React.SyntheticEvent): void => e.stopPropagation();

  /** Desktop : la barre du haut deplace le panneau (hors de ses touches), dans la fenetre ; double clic : sa place d'origine. */
  const drag = (e: React.PointerEvent<HTMLElement>): void => {
    if (mobile || (e.target as HTMLElement).closest('button')) return;
    const panel = (e.currentTarget as HTMLElement).closest('.v4-scope') as HTMLElement | null;
    if (!panel) return;
    e.preventDefault();
    const r = panel.getBoundingClientRect();
    const dx = e.clientX - r.left;
    const dy = e.clientY - r.top;
    const move = (ev: PointerEvent): void => {
      const x = Math.max(8, Math.min(window.innerWidth - r.width - 8, ev.clientX - dx));
      const y = Math.max(8, Math.min(window.innerHeight - r.height - 8, ev.clientY - dy));
      set({ pos: { x: Math.round(x), y: Math.round(y) } });
    };
    const up = (): void => {
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
    };
    window.addEventListener('pointermove', move);
    window.addEventListener('pointerup', up);
  };
  // Deplace sur desktop : sa place, ramenee dans la fenetre si elle a retreci
  const placed: React.CSSProperties | undefined =
    !mobile && s.pos ? { left: `${Math.min(s.pos.x, Math.max(8, window.innerWidth - 300))}px`, top: `${Math.min(s.pos.y, Math.max(8, window.innerHeight - 200))}px`, right: 'auto', transform: 'none' } : undefined;

  if (!unfolded) {
    return (
      <button
        type="button"
        className="v4-scope-pill"
        data-mobile={mobile ? '1' : '0'}
        aria-label="Show the oscilloscope"
        onClick={() => {
          setUnfolded(true);
          set({ shown: true });
        }}
      >
        <svg viewBox="0 0 24 12" width="22" height="11" aria-hidden="true">
          <path d="M1 6h4l2-5 3 10 3-10 3 10 2-5h5" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinejoin="round" strokeLinecap="round" />
        </svg>
        SCOPE
      </button>
    );
  }

  return (
    <section className="v4-scope" data-mobile={mobile ? '1' : '0'} style={placed} aria-label="Oscilloscope" onPointerDown={stop} onWheel={stop} onTouchStart={stop}>
      <header className="v4-scope-bar" data-drag={mobile ? '0' : '1'} onPointerDown={drag} onDoubleClick={() => set({ pos: null })}>
        <span className="v4-scope-title">SCOPE</span>
        <div className="v4-scope-group" role="radiogroup" aria-label="Source">
          {SCOPE_SOURCES.map((k) => (
            <button key={k} type="button" role="radio" aria-checked={source === k} className="v4-scope-btn" onClick={() => set({ source: k })}>
              {SCOPE_SOURCE_LABEL[k]}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="v4-scope-btn v4-scope-icon"
          aria-label="Hide the oscilloscope"
          onClick={() => {
            setUnfolded(false);
            set({ shown: false });
          }}
        >
          <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true">
            <path d="M2 2l8 8M10 2l-8 8" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
          </svg>
        </button>
      </header>
      <div className="v4-scope-screen">
        <canvas ref={canvasRef} className="v4-scope-canvas" aria-hidden="true" />
        <div className="v4-scope-read" aria-live="off">
          <span>
            {SCOPE_WINDOW_LABEL[s.window]} {meas ? `${meas.windowMs.toFixed(1)} MS` : ''} {meas?.mode === 'auto' ? 'AUTO' : 'BEAT'}
          </span>
          <span>
            PEAK {meas ? fmtDb(meas.peakDb) : '--'} DB
            {meas && meas.corr !== null ? `  CORR ${fmtSigned(meas.corr, 2)}` : ''}
            {meas && meas.drift !== null ? `  DRIFT ${fmtSigned(meas.drift, 3)} MS` : ''}
          </span>
        </div>
        {!ready && <p className="v4-scope-wait">Tap anywhere once to wake the sound, then play a machine.</p>}
        {s.freeze && <span className="v4-scope-frozen">FROZEN</span>}
      </div>
      <footer className="v4-scope-bar v4-scope-tools">
        <div className="v4-scope-group" aria-label="Window">
          <button type="button" className="v4-scope-btn v4-scope-icon" aria-label="Shorter window" onClick={() => set({ window: stepIn(SCOPE_WINDOWS, s.window as (typeof SCOPE_WINDOWS)[number], -1) })}>
            -
          </button>
          <span className="v4-scope-val">{SCOPE_WINDOW_LABEL[s.window]}</span>
          <button type="button" className="v4-scope-btn v4-scope-icon" aria-label="Longer window" onClick={() => set({ window: stepIn(SCOPE_WINDOWS, s.window as (typeof SCOPE_WINDOWS)[number], 1) })}>
            +
          </button>
        </div>
        <button type="button" className="v4-scope-btn" aria-pressed={s.trig === 'beat'} aria-label="Trigger on the beat grid" onClick={() => set({ trig: s.trig === 'beat' ? 'auto' : 'beat' })}>
          {s.trig === 'beat' ? 'BEAT' : 'AUTO'}
        </button>
        <div className="v4-scope-group" role="radiogroup" aria-label="View">
          {SCOPE_VIEWS.map((v) => (
            <button key={v} type="button" role="radio" aria-checked={s.view === v} className="v4-scope-btn" onClick={() => set({ view: v })}>
              {SCOPE_VIEW_LABEL[v]}
            </button>
          ))}
        </div>
        <div className="v4-scope-group" aria-label="Gain">
          <button type="button" className="v4-scope-btn v4-scope-icon" aria-label="Less gain" onClick={() => set({ gain: stepIn(SCOPE_GAINS, s.gain as (typeof SCOPE_GAINS)[number], -1) })}>
            -
          </button>
          <span className="v4-scope-val">X{s.gain}</span>
          <button type="button" className="v4-scope-btn v4-scope-icon" aria-label="More gain" onClick={() => set({ gain: stepIn(SCOPE_GAINS, s.gain as (typeof SCOPE_GAINS)[number], 1) })}>
            +
          </button>
        </div>
        <button
          type="button"
          className="v4-scope-btn"
          aria-label={`Ghost windows: ${s.hold}`}
          onClick={() => set({ hold: SCOPE_HOLDS[(SCOPE_HOLDS.indexOf(s.hold as (typeof SCOPE_HOLDS)[number]) + 1) % SCOPE_HOLDS.length] })}
        >
          GHOSTS {s.hold}
        </button>
        <button type="button" className="v4-scope-btn" aria-pressed={s.freeze} onClick={() => set({ freeze: !s.freeze })}>
          FREEZE
        </button>
      </footer>
    </section>
  );
};

export default Scope;
