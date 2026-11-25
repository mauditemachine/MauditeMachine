/**
 * La face v3 du plugin (2026-11-25) : les pieces de la face, en pixels de la fenetre de depart (1400 x 896 ; la fenetre
 * agrandie zoome le tout). Les knobs sont les PNG de Mika (ceux du MM-ARP, plugin/v3/img : k1, k3, le selecteur, tiny ;
 * jamais redessines) : le corps tourne, le capuchon reste fixe ; dessous une ombre douce, autour les graduations.
 */

import React, { useRef, useSyncExternalStore, type CSSProperties, type ReactNode } from 'react';
import { course, setCourse, shown, subscribeCtl, type Ctl } from './ctl';
import k1Url from './img/k1.png';
import k3Url from './img/k3.png';
import k3CapUrl from './img/k3cap.png';
import selUrl from './img/sel.png';
import selCapUrl from './img/selcap.png';
import tinyUrl from './img/tiny.png';

/* ---------------- un seul abonnement pour toute la face ---------------- */

let tick = 0;
const subs = new Set<() => void>();
let off: (() => void) | null = null;
function subscribeTick(fn: () => void): () => void {
  subs.add(fn);
  if (!off)
    off = subscribeCtl(() => {
      tick += 1;
      subs.forEach((f) => f());
    });
  return () => {
    subs.delete(fn);
    if (subs.size === 0 && off) {
      off();
      off = null;
    }
  };
}
/** Le numero du dernier changement (un composant qui le lit se redessine a chaque reglage). */
export const useTick = (): number => useSyncExternalStore(subscribeTick, () => tick);

/* ---------------- les knobs ---------------- */

export type KnobKind = 'k1' | 'k3' | 'sel' | 'tiny';
/** Les mesures des PNG (le MM-ARP, vknob-cut.py) : taille, axe, rayon du disque, angle du repere d'origine. */
const SPEC: Record<KnobKind, { w: number; h: number; ax: number; ay: number; R: number; ref: number; url: string; cap?: string; cx?: number; cy?: number }> = {
  k1: { w: 288, h: 288, ax: 142.1, ay: 143.5, R: 120, ref: 30.3, url: k1Url },
  k3: { w: 256, h: 256, ax: 129.83, ay: 128.52, R: 110, ref: 0, url: k3Url, cap: k3CapUrl, cx: 128, cy: 128 },
  sel: { w: 384, h: 384, ax: 190.36, ay: 190.16, R: 172.83, ref: 59.65, url: selUrl, cap: selCapUrl, cx: 190.34, cy: 190.01 },
  tiny: { w: 320, h: 256, ax: 161.5, ay: 120, R: 52.5, ref: 282.7, url: tinyUrl },
};

/** Les pixels de glisser pour toute la course (Maj : dix fois plus fin). */
const DRAG_PX = 220;
const FINE = 10;

export interface KnobProps {
  x: number;
  y: number;
  d: number;
  kind?: KnobKind;
  ctl: Ctl;
  label?: string;
  big?: boolean;
  /** la valeur sous le nom (false : rien) */
  value?: boolean;
  /** les mots aux bouts (DRY, WET) */
  min?: string;
  max?: string;
  /** des reperes autour (un selecteur : LP BP HP) ; a : angle en degres, 0 en haut */
  marks?: readonly { t: string; a: number }[];
  ticks?: number;
  /** le nom en jaune */
  acc?: boolean;
  title?: string;
}

export const Knob: React.FC<KnobProps> = ({ x, y, d, kind = 'k3', ctl, label, big, value = true, min, max, marks, ticks = 11, acc, title }) => {
  useTick();
  const S = SPEC[kind];
  const s = d / (2 * S.R);
  const drag = useRef<{ id: number; y0: number; c0: number; fine: boolean } | null>(null);
  const lastDown = useRef(0);
  const dead = ctl.dead();
  const c = dead ? 0 : course(ctl);
  const rot = -135 + 270 * c - S.ref;
  const locked = !dead && ctl.locked();
  const n = ctl.steps();
  const r0 = d / 2 + 5;
  const r1 = r0 + 4;
  const text = dead ? '--' : shown(ctl);
  const full = dead ? '--' : `${ctl.text()}${ctl.unit() ? ` ${ctl.unit()}` : ''}`;

  const down = (e: React.PointerEvent): void => {
    if (e.button !== 0 || dead) return;
    e.preventDefault();
    e.stopPropagation();
    const now = performance.now();
    if (now - lastDown.current < 320) {
      lastDown.current = 0;
      ctl.reset();
      drag.current = null;
      return;
    }
    lastDown.current = now;
    ctl.begin?.();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    drag.current = { id: e.pointerId, y0: e.clientY, c0: course(ctl), fine: e.shiftKey };
  };
  const move = (e: React.PointerEvent): void => {
    const g = drag.current;
    if (!g || g.id !== e.pointerId) return;
    // Maj pris ou lache en route : la course repart d'ici
    if (e.shiftKey !== g.fine) {
      g.c0 = course(ctl);
      g.y0 = e.clientY;
      g.fine = e.shiftKey;
    }
    const zoom = (e.currentTarget as HTMLElement).getBoundingClientRect().width / d || 1;
    const dy = (g.y0 - e.clientY) / zoom;
    const want = g.c0 + dy / (DRAG_PX * (g.fine ? FINE : 1));
    if (n > 1) {
      const cur = course(ctl);
      if (Math.abs(want - cur) >= 0.5 / (n - 1)) setCourse(ctl, want);
    } else setCourse(ctl, want);
  };
  const up = (e: React.PointerEvent): void => {
    if (drag.current?.id === e.pointerId) drag.current = null;
  };
  const wheel = (e: React.WheelEvent): void => {
    if (dead) return;
    ctl.begin?.();
    const dir = e.deltaY < 0 ? 1 : -1;
    const step = n > 1 ? 1 / (n - 1) : e.shiftKey ? 1 / 1270 : 1 / 127;
    setCourse(ctl, course(ctl) + dir * step);
  };

  let svg = '';
  for (let i = 0; i < ticks; i += 1) {
    const a = ((-135 + (270 * i) / (ticks - 1)) * Math.PI) / 180;
    const bigT = i === 0 || i === ticks - 1 || i === (ticks - 1) / 2;
    const rr = r1 + (bigT ? 1.5 : 0);
    svg += `<line x1="${(Math.sin(a) * r0).toFixed(2)}" y1="${(-Math.cos(a) * r0).toFixed(2)}" x2="${(Math.sin(a) * rr).toFixed(2)}" y2="${(-Math.cos(a) * rr).toFixed(2)}" stroke="rgba(235,235,235,${bigT ? 0.7 : 0.42})" stroke-width="${bigT ? 1.3 : 1}" stroke-linecap="round"/>`;
  }
  if (locked) {
    // Le P-LOCK : l'anneau jaune entier (le reglage de ce pas n'est plus celui de la piste)
    svg += `<circle r="${r0 - 2.5}" fill="none" stroke="#ffd900" stroke-width="2" style="filter:drop-shadow(0 0 3px rgba(255,217,0,.8))"/>`;
  }
  const ly = d / 2 + 14;
  return (
    <div className={`mm3-knob${dead ? ' is-dead' : ''}`} style={{ left: x, top: y }} title={title ? `${title} · ${full}` : `${label ?? ''} ${full}`.trim()}>
      <div className="mm3-kshadow" style={{ left: -d * 0.61 + d * 0.05, top: -d * 0.61 + d * 0.1, width: d * 1.22, height: d * 1.22 }} />
      <svg className="mm3-ticks" width={0} height={0} dangerouslySetInnerHTML={{ __html: svg }} />
      <div
        className="mm3-kgrab"
        style={{ left: -d / 2 - 4, top: -d / 2 - 4, width: d + 8, height: d + 8 }}
        onPointerDown={down}
        onPointerMove={move}
        onPointerUp={up}
        onPointerCancel={up}
        onWheel={wheel}
        role="slider"
        aria-label={label ?? title}
        aria-valuetext={full}
      >
        <div
          className="mm3-krot"
          style={{ left: d / 2 + 4 - S.ax * s, top: d / 2 + 4 - S.ay * s, width: S.w * s, height: S.h * s, backgroundImage: `url(${S.url})`, transformOrigin: `${S.ax * s}px ${S.ay * s}px`, transform: `rotate(${rot}deg)` }}
        />
        {S.cap && <div className="mm3-krot" style={{ left: d / 2 + 4 - (S.cx ?? 0) * s, top: d / 2 + 4 - (S.cy ?? 0) * s, width: S.w * s, height: S.h * s, backgroundImage: `url(${S.cap})` }} />}
      </div>
      {label && (
        <div className={`mm3-klab${big ? ' big' : ''}${acc || locked ? ' acc' : ''}`} style={{ top: ly }}>
          {label}
        </div>
      )}
      {value && <div className="mm3-kval" style={{ top: ly + (big ? 14 : 13) }}>{text}</div>}
      {min && (
        <div className="mm3-kmm" style={{ right: d * 0.36 + 4, top: d * 0.36 + 2, textAlign: 'right' }}>
          {min}
        </div>
      )}
      {max && (
        <div className="mm3-kmm" style={{ left: d * 0.36 + 4, top: d * 0.36 + 2 }}>
          {max}
        </div>
      )}
      {marks?.map((m, i) => {
        const r = d / 2 + 15;
        const rad = (m.a * Math.PI) / 180;
        const near = Math.abs(-135 + 270 * c - m.a) < 1 + 135 / Math.max(1, marks.length);
        return (
          <div key={i} className={`mm3-kmm${near ? ' on' : ''}`} style={{ left: Math.sin(rad) * r, top: -Math.cos(rad) * r - 4, transform: 'translateX(-50%)' }}>
            {m.t}
          </div>
        );
      })}
    </div>
  );
};

/** Les angles de n reperes repartis sur la course (-135 a 135). */
export const marksOf = (words: readonly string[]): { t: string; a: number }[] => words.map((t, i) => ({ t, a: words.length > 1 ? -135 + (270 * i) / (words.length - 1) : 0 }));

/* ---------------- les touches ---------------- */

export type Led = 'off' | 'on' | 'red' | null;

export interface KeyProps {
  x: number;
  y: number;
  w: number;
  h: number;
  label?: ReactNode;
  /** dans la touche (un mot, une icone) */
  inner?: ReactNode;
  led?: Led;
  /** la LED dans la touche, a gauche du mot */
  ledIn?: boolean;
  lit?: 'lit' | 'red' | null;
  r?: number;
  labAcc?: boolean;
  onDown?: (e: React.PointerEvent) => void;
  onUp?: (e: React.PointerEvent, tap: boolean) => void;
  onTap?: (e: React.PointerEvent) => void;
  onContext?: (e: React.MouseEvent) => void;
  title?: string;
  style?: CSSProperties;
  innerStyle?: CSSProperties;
  className?: string;
  data?: Record<string, string>;
}

export const Key: React.FC<KeyProps> = ({ x, y, w, h, label, inner, led = null, ledIn, lit, r, labAcc, onDown, onUp, onTap, onContext, title, style, innerStyle, className, data }) => {
  const held = useRef<number | null>(null);
  return (
    <div
      className={`mm3-key${className ? ` ${className}` : ''}`}
      style={{ left: x, top: y, width: w, height: h, ...style }}
      title={title}
      role="button"
      aria-label={typeof label === 'string' ? label : title}
      {...Object.fromEntries(Object.entries(data ?? {}).map(([k, v]) => [`data-${k}`, v]))}
      onPointerDown={(e) => {
        if (e.button !== 0) return;
        e.preventDefault();
        e.stopPropagation();
        (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
        held.current = e.pointerId;
        onDown?.(e);
      }}
      onPointerUp={(e) => {
        if (held.current !== e.pointerId) return;
        held.current = null;
        const rc = (e.currentTarget as HTMLElement).getBoundingClientRect();
        const tap = e.clientX >= rc.left && e.clientX <= rc.right && e.clientY >= rc.top && e.clientY <= rc.bottom;
        onUp?.(e, tap);
        if (tap) onTap?.(e);
      }}
      onPointerCancel={(e) => {
        if (held.current !== e.pointerId) return;
        held.current = null;
        onUp?.(e, false);
      }}
      onContextMenu={(e) => {
        e.preventDefault();
        onContext?.(e);
      }}
    >
      <div className={`mm3-cap${lit ? ` ${lit}` : ''}`} style={{ borderRadius: r ?? Math.min(11, h / 2) }} />
      {led !== null && !ledIn && <i className={`mm3-led${led === 'on' ? ' on' : led === 'red' ? ' red' : ''}`} style={{ top: -10 }} />}
      {(inner !== undefined || ledIn) && (
        <div className={`mm3-in${lit ? ' dark' : ''}`} style={innerStyle}>
          {ledIn && <i className={`mm3-led in${led === 'on' ? ' on' : led === 'red' ? ' red' : ''}`} />}
          {inner}
        </div>
      )}
      {label !== undefined && <div className={`mm3-klab key${labAcc ? ' acc' : ''}`}>{label}</div>}
    </div>
  );
};

/* ---------------- la bascule (comme l'ARP) ---------------- */

export const Toggle: React.FC<{ x: number; y: number; a: string; b: string; on: boolean; label?: string; onFlip: () => void; title?: string }> = ({ x, y, a, b, on, label, onFlip, title }) => (
  <div
    className="mm3-tog"
    style={{ left: x, top: y }}
    title={title}
    role="switch"
    aria-checked={on}
    aria-label={label ?? title}
    onPointerDown={(e) => {
      if (e.button !== 0) return;
      e.preventDefault();
      e.stopPropagation();
      onFlip();
    }}
  >
    <div className="mm3-togbody" />
    <div className="mm3-lever" style={{ left: on ? 22 : 3 }} />
    <i className={`mm3-led${on ? ' on' : ''}`} style={{ left: 52, top: 6.5 }} />
    <div className={`mm3-togo${on ? '' : ' on'}`} style={{ left: 6 }}>
      {a}
    </div>
    <div className={`mm3-togo${on ? ' on' : ''}`} style={{ left: 38 }}>
      {b}
    </div>
    {label && (
      <div className="mm3-togo on lab" style={{ left: 22, top: 40 }}>
        {label}
      </div>
    )}
  </div>
);

/* ---------------- titres, filets, ecrans ---------------- */

export const Title: React.FC<{ x: number; y: number; w: number; t: ReactNode; small?: ReactNode }> = ({ x, y, w, t, small }) => (
  <div className="mm3-title" style={{ left: x, top: y, width: w }}>
    {t}
    {small && <small>{small}</small>}
  </div>
);
export const VRule: React.FC<{ x: number; y: number; h: number }> = ({ x, y, h }) => <div className="mm3-vrule" style={{ left: x, top: y, height: h }} />;
export const HRule: React.FC<{ x: number; y: number; w: number }> = ({ x, y, w }) => <div className="mm3-hrule" style={{ left: x, top: y, width: w }} />;
export const Note: React.FC<{ x: number; y: number; children: ReactNode; style?: CSSProperties; center?: boolean; right?: boolean }> = ({ x, y, children, style, center, right }) => (
  <div className="mm3-note" style={{ left: x, top: y, ...(center ? { transform: 'translateX(-50%)' } : right ? { transform: 'translateX(-100%)' } : {}), ...style }}>
    {children}
  </div>
);
export const Lcd: React.FC<{ x: number; y: number; w: number; h: number; children?: ReactNode; style?: CSSProperties; className?: string; onPointerDown?: (e: React.PointerEvent) => void; onPointerMove?: (e: React.PointerEvent) => void; onPointerUp?: (e: React.PointerEvent) => void }> = ({ x, y, w, h, children, style, className, onPointerDown, onPointerMove, onPointerUp }) => (
  <div className={`mm3-lcd${className ? ` ${className}` : ''}`} style={{ left: x, top: y, width: w, height: h, ...style }} onPointerDown={onPointerDown} onPointerMove={onPointerMove} onPointerUp={onPointerUp} onPointerCancel={onPointerUp}>
    {children}
  </div>
);

/** Un choix a pilules (WAVE : TRI SINE SQR...) sur un controle a crans : la pilule allumee est le cran choisi. */
export const Choice: React.FC<{ x: number; y: number; ctl: Ctl; words: readonly string[]; w: number; h?: number; gap?: number; cols?: number; title?: string }> = ({ x, y, ctl, words, w, h = 22, gap = 6, cols, title }) => {
  useTick();
  const n = words.length;
  const c = course(ctl);
  const cur = Math.round(c * (n - 1));
  const per = cols ?? n;
  return (
    <>
      {words.map((t, i) => (
        <Key
          key={t}
          x={x + (i % per) * (w + gap)}
          y={y + Math.floor(i / per) * (h + 6)}
          w={w}
          h={h}
          r={6}
          inner={t}
          lit={i === cur ? 'lit' : null}
          innerStyle={{ fontSize: 8 }}
          title={title}
          onDown={() => {
            ctl.begin?.();
            setCourse(ctl, n > 1 ? i / (n - 1) : 0);
          }}
        />
      ))}
    </>
  );
};
