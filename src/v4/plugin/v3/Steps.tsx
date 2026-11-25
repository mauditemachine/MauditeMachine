/**
 * La face v3 du plugin (2026-11-25) : les 16 pistes et les 16 pas, en bas, comme les touches TRIG de la face d'avant (les
 * pas rouges, choix de Mika). Les memes gestes que la face d'avant (ui/Hotspots.tsx) :
 * - une tape : le pas (la table des accords : FUNC + pas = le mute rapide, MUTE, SOLO, LIVE REC) ;
 * - une tenue (350 ms) : le P-LOCK du pas, les knobs y ecrivent ; un knob tourne pendant la tenue : un P-LOCK momentane ;
 * - un glisser vertical sur un pas joue : sa velocite ;
 * - un clic droit : le P-LOCK garde et le menu des conditions (plugin/StepMenu.tsx) ;
 * - PERFORM : les pas sont les pads de performance (Maj + clic : garde) ; MUTE et SOLO : les pas sont les pistes.
 * Une piste : un clic la choisit, un clic droit la coupe ou la rend. Les VU des pistes et la tete de lecture : la boucle
 * d'image (le moteur envoie ses niveaux et sa position).
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { muteStepHold, muteView, perfPadDown, perfPadUp, performPads, rytmLockEnter, stepLockRight, stepMuteHold, stepSoloPick, stepToggle, trackMuteFlip, trackSelect } from '../../actions';
import { trigWrite } from '../../actions/internal/keys60';
import { undo } from '../../state/undo';
import { liveOn } from '../../actions/live';
import { trackKeyOn, trackStepNow } from '../../actions/trackSpan';
import { lockOf } from '../../audio/locks';
import { VEL_MAX, pattern, velocity } from '../../audio/pattern';
import { CONDS } from '../../audio/trig';
import { TRACK_KEYS, TRACK_NAMES, type TrackKey } from '../../audio/tracks';
import { dtFace } from '../../state/dtFace';
import { func } from '../../state/func';
import { PERF_PADS, perform } from '../../state/perform';
import { playhead } from '../../state/playhead';
import { rytmLock } from '../../state/rytmLock';
import { stepMenu } from '../../state/stepMenu';
import { activeTrack } from '../../state/trk';
import { voices } from '../../state/voices';
import { DT_GESTURE } from '../../theme';
import { extHead } from '../head';
import { meters } from '../meters';
import { useTick } from './ui';

const X0 = 178;
const P = (1348 - X0) / 16;
const YC = 630;
const LOCK_HOLD_MS = 350;
const STEP_HOLD_MS = 400;
const VEL_PX = 12;
const VEL_FROM_EMPTY = 7;

/** La piste coupee (le mute global), en solo. */
export const isMuted = (k: TrackKey): boolean => {
  const v = voices.get();
  return (v.muted as readonly string[]).includes(k) || v.hiMuted.includes(k);
};
export const isSolo = (k: TrackKey): boolean => {
  const v = voices.get();
  return (v.solo as readonly string[]).includes(k) || v.hiSolo.includes(k);
};

/**
 * La face v3 ecrit toujours ses pas (les pistes ont leur rangee : pas de GRID REC a allumer, comme le Dock d'avant) : la
 * velocite d'un pas de la piste active.
 */
export function stepVel(i: number): number {
  const k = activeTrack.get();
  return k ? velocity(pattern.get().steps, k, i) : 0;
}
export function setStepVel(i: number, v: number): void {
  const k = activeTrack.get();
  if (!k || velocity(pattern.get().steps, k, i) <= 0) return;
  const n = Math.max(1, Math.min(VEL_MAX, Math.round(v)));
  if (velocity(pattern.get().steps, k, i) !== n) pattern.set(k, i, n);
}

/** Le pas que joue la piste active sous la tete (le moteur), -1 a l'arret. */
function headNow(t: TrackKey): number {
  if (extHead.active()) {
    const g = trackStepNow(t);
    return g >= 0 ? g % 16 : -1;
  }
  return playhead.get();
}

/** La tete de lecture et les VU : la boucle d'image ; un rendu seulement quand le pas change. */
function useHead(t: TrackKey, vuRefs: React.MutableRefObject<(HTMLElement | null)[]>): number {
  const [h, setH] = useState(-1);
  useEffect(() => {
    let raf = 0;
    let last = -2;
    const loop = (): void => {
      const now = headNow(t);
      if (now !== last) {
        last = now;
        setH(now);
      }
      if (meters.seen()) {
        const m = meters.view();
        for (let i = 0; i < 16; i += 1) {
          const el = vuRefs.current[i];
          if (el) el.style.width = `${Math.round(m.t[i] * 100)}%`;
        }
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [t, vuRefs]);
  return h;
}

interface Down {
  id: number;
  i: number;
  t0: number;
  y0: number;
  vel0: number;
  taken: boolean;
  perf: number;
  modeTap: boolean;
  holdFired: boolean;
  held: boolean;
  lockHold: boolean;
  velDrag: boolean;
  prevLock: number;
  writes0: number;
  timer: number;
}

/** Ce que dit le pas sous sa note : sa COND (1:2, 1ST), sa PROB (50 %), rien. */
function condWord(l: ReturnType<typeof lockOf>): string {
  if (!l) return '';
  const c = typeof l.cond === 'number' ? CONDS[l.cond] : undefined;
  if (c && l.cond !== 0) return c.label;
  if (typeof l.prob === 'number' && l.prob < 100) return `${Math.round(l.prob)}%`;
  return '';
}
/** Le pas a-t-il d'autres verrous que sa COND et sa PROB (un P-LOCK) ? */
const hasLocks = (l: ReturnType<typeof lockOf>): boolean => !!l && Object.keys(l).some((k) => k !== 'cond' && k !== 'prob');

export const Steps: React.FC = () => {
  useTick();
  const t = useSyncExternalStore(activeTrack.subscribe, () => activeTrack.get() ?? 'BD');
  useSyncExternalStore(voices.subscribe, () => voices.get());
  useSyncExternalStore(dtFace.subscribe, () => `${dtFace.mute()}|${dtFace.solo()}|${dtFace.menu()}`);
  useSyncExternalStore(func.subscribe, () => func.engaged());
  const vuRefs = useRef<(HTMLElement | null)[]>([]);
  const head = useHead(t, vuRefs);
  const downs = useRef(new Map<number, Down>());
  const p = pattern.get();
  const perf = performPads();
  const mute = muteView();
  const solo = dtFace.solo();
  const lk = rytmLock.get();

  const onDown = (e: React.PointerEvent, i: number): void => {
    if (e.button !== 0) return;
    e.preventDefault();
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
    const ts = e.timeStamp || performance.now();
    const d: Down = { id: e.pointerId, i, t0: ts, y0: e.clientY, vel0: stepVel(i), taken: false, perf: -1, modeTap: false, holdFired: false, held: false, lockHold: false, velDrag: false, prevLock: -1, writes0: rytmLock.get().writes, timer: 0 };
    downs.current.set(e.pointerId, d);
    // PERFORM : le pas est un pad tenu (Maj + clic : garde) ; ni tape ni tenue au lacher
    if (perfPadDown(i, null, e.shiftKey)) {
      d.taken = true;
      if (!e.shiftKey) d.perf = i;
      return;
    }
    // SOLO : le pas choisit sa piste a l'appui (Maj : en plus)
    if (stepSoloPick(i, null, e.shiftKey)) {
      d.taken = true;
      return;
    }
    // MUTE + Maj : sa piste basculee tant que Maj reste tenue
    if (e.shiftKey && muteView() && stepMuteHold(i, null)) {
      d.taken = true;
      return;
    }
    // FUNC (ou Maj), MUTE, SOLO : la tape fait la chose ; en MUTE, une tenue met la piste en SOLO
    if (func.engaged() || muteView() || dtFace.solo()) {
      d.modeTap = true;
      if (!func.engaged())
        d.timer = window.setTimeout(() => {
          if (downs.current.get(d.id) !== d || !muteView()) return;
          d.holdFired = true;
          muteStepHold(i, null);
        }, DT_GESTURE.muteHoldMs);
      return;
    }
    // LIVE REC : le pas est un pad, il part a l'appui
    if (liveOn() && rytmLock.get().step < 0) {
      d.taken = true;
      stepToggle(i, null, false, ts);
      return;
    }
    if (activeTrack.get() !== null && !liveOn()) {
      d.held = true;
      const s = rytmLock.get();
      d.prevLock = s.latched ? s.step : -1;
      rytmLock.hold(i);
      d.timer = window.setTimeout(() => {
        if (downs.current.get(d.id) !== d || d.velDrag) return;
        // Deja en P-LOCK par un knob tourne pendant la tenue : il y reste jusqu'au lacher
        if (rytmLock.get().writes > d.writes0) {
          d.lockHold = true;
          return;
        }
        if (rytmLockEnter(i, false, true)) d.lockHold = true;
      }, LOCK_HOLD_MS);
    }
  };

  const onMove = (e: React.PointerEvent): void => {
    const d = downs.current.get(e.pointerId);
    if (!d || d.taken || d.modeTap || d.lockHold) return;
    const dy = e.clientY - d.y0;
    if (!d.velDrag && (Math.abs(dy) < 6 || d.vel0 <= 0)) return;
    if (!d.velDrag) undo.boundary('mm808', 'step');
    d.velDrag = true;
    const zoom = (e.currentTarget as HTMLElement).getBoundingClientRect().height / 84 || 1;
    const base = d.vel0 > 0 ? d.vel0 : VEL_FROM_EMPTY;
    setStepVel(d.i, base + Math.round(-dy / zoom / VEL_PX));
  };

  const onUp = (e: React.PointerEvent, cancel = false): void => {
    const d = downs.current.get(e.pointerId);
    if (!d) return;
    downs.current.delete(e.pointerId);
    if (d.timer) window.clearTimeout(d.timer);
    if (d.perf >= 0) perfPadUp(d.perf);
    if (d.taken) return;
    const ts = e.timeStamp || performance.now();
    if (d.held) {
      rytmLock.release(d.i);
      const turned = rytmLock.get().writes > d.writes0;
      if (!cancel && !d.lockHold && !turned && !d.velDrag && ts - d.t0 >= LOCK_HOLD_MS && rytmLockEnter(d.i, true, true)) return;
      if (d.lockHold || turned) {
        if (turned || d.velDrag) {
          // Momentane : le P-LOCK garde d'avant revient, ou plus de P-LOCK
          const s = rytmLock.get();
          if (s.held.length === 0 && s.step >= 0 && !s.latched) {
            if (d.prevLock >= 0) rytmLock.enter(d.prevLock, true);
            else rytmLock.leave();
          }
        } else rytmLock.latch();
        return;
      }
    }
    if (cancel || d.velDrag || d.holdFired) return;
    const rc = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const inside = e.clientX >= rc.left && e.clientX <= rc.right && e.clientY >= rc.top && e.clientY <= rc.bottom;
    if (!inside) return;
    if (d.modeTap) stepToggle(d.i, null, false, ts);
    // La tape : le pas pose ou retire (en P-LOCK : le P-LOCK passe sur lui), sans REC
    else if (ts - d.t0 < STEP_HOLD_MS) {
      undo.boundary('mm808', 'step');
      trigWrite(d.i, null);
    }
  };

  const onContext = (e: React.MouseEvent, i: number): void => {
    e.preventDefault();
    if (performPads() || muteView() || dtFace.solo()) return;
    stepLockRight(i);
    if (rytmLock.get().step === i) stepMenu.open(i, e.clientX, e.clientY);
    else stepMenu.close();
  };

  const keys: React.ReactNode[] = [];
  for (let i = 0; i < 16; i += 1) {
    const x = X0 + i * P;
    const k = TRACK_KEYS[i];
    let cls = 'mm3-step';
    let body: React.ReactNode;
    if (perf) {
      const pad = PERF_PADS[i];
      cls += ` perf${perform.isOn(i) ? ' down' : ''}`;
      body = (
        <>
          <div className="win" />
          <div className="plab">{pad?.label ?? ''}</div>
          <div className="num">{perform.isLatched(i) ? '●' : i + 1}</div>
        </>
      );
    } else if (mute || solo) {
      // Les pas sont les pistes : allumee, elle joue (MUTE) ou elle est en solo (SOLO)
      const on = solo ? isSolo(k) : !isMuted(k);
      cls += on ? ' on' : '';
      body = (
        <>
          <div className="win" />
          <div className="plab" style={{ color: on ? '#fff3f1' : '#9a9a9a' }}>
            {TRACK_NAMES[i]}
          </div>
          <div className="num">{i + 1}</div>
        </>
      );
    } else {
      const v = velocity(p.steps, t, i);
      const l = lockOf(p.locks, t, i);
      const on = v > 0;
      cls += on ? ' on' : ' off';
      if (head === i) cls += ' ph';
      if (lk.step === i || lk.held.includes(i)) cls += ' lock';
      if (!trackKeyOn(t, i)) cls += ' out';
      const cw = condWord(l);
      body = (
        <>
          <div className="win" />
          {cw && <div className="cond">{cw}</div>}
          {hasLocks(l) && <div className="lockdot" />}
          {on && (
            <div className="vel">
              <b style={{ width: `${Math.round((v / 9) * 100)}%` }} />
            </div>
          )}
          <div className="num">{i + 1}</div>
        </>
      );
    }
    keys.push(
      <div
        key={i}
        className={cls}
        data-mm3-step={i}
        style={{ left: x, top: YC + 54, width: P - 8, height: 84 }}
        role="button"
        aria-label={`Step ${i + 1}`}
        onPointerDown={(e) => onDown(e, i)}
        onPointerMove={onMove}
        onPointerUp={(e) => onUp(e)}
        onPointerCancel={(e) => onUp(e, true)}
        onContextMenu={(e) => onContext(e, i)}
      >
        {body}
      </div>
    );
  }

  return (
    <>
      {TRACK_KEYS.map((k, i) => {
        const muted = isMuted(k);
        const sol = isSolo(k);
        return (
          <div
            key={k}
            className={`mm3-trk${k === t ? ' sel' : ''}${muted ? ' mute' : ''}`}
            style={{ left: X0 + i * P, top: YC + 2, width: P - 8, height: 32 }}
            role="button"
            aria-label={`Track ${i + 1} ${TRACK_NAMES[i]}${muted ? ', muted' : ''}`}
            title="Click: this track · right click: mute"
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              trackSelect(k);
            }}
            onContextMenu={(e) => {
              e.preventDefault();
              trackMuteFlip(k);
            }}
          >
            <div className="no">{String(i + 1).padStart(2, '0')}</div>
            <div className="n">{TRACK_NAMES[i]}</div>
            <div className={`m${muted ? ' on' : sol ? ' solo' : ''}`} />
            <div className="vu">
              <b
                ref={(el) => {
                  vuRefs.current[i] = el;
                }}
                style={{ width: 0 }}
              />
            </div>
          </div>
        );
      })}
      {keys}
      {[0, 1, 2, 3].map((g) => (
        <div key={g} className="mm3-bracket" style={{ left: X0 + g * 4 * P + 4, top: YC + 146, width: 4 * P - 16 }}>
          <span>{perf ? ['CUTS', 'CUTS', 'REPEAT · LOW CUT', 'THROWS · TAPE'][g] : mute ? 'MUTE' : solo ? 'SOLO' : `BEAT ${g + 1}`}</span>
        </div>
      ))}
      <StepFoot t={t} />
    </>
  );
};

/** La ligne sous les pas : la longueur du pattern et de la piste, la legende. */
const StepFoot: React.FC<{ t: TrackKey }> = ({ t }) => {
  const len = pattern.stepCount();
  const tlen = Math.round(pattern.get().trigs?.[t]?.tlen ?? 0);
  return (
    <>
      <div className="mm3-note" style={{ left: X0, top: YC + 190 }}>
        PATTERN <b>{len}</b> STEPS · TRACK <b>{tlen > 0 && tlen < len ? tlen : len}</b> · HOLD A STEP : <i>P-LOCK</i> · RIGHT CLICK : <i>CONDITIONS</i> · DRAG : <i>VELOCITY</i>
      </div>
      <div className="mm3-note" style={{ left: 1348, top: YC + 190, transform: 'translateX(-100%)' }}>
        <i>●</i> P-LOCK &nbsp; <i>1:2</i> CONDITION &nbsp; <b>▬</b> VELOCITY
      </div>
      <div className="mm3-note" style={{ left: 1348, top: YC + 216, transform: 'translateX(-100%)', color: '#6a6a6a', fontSize: 7 }}>
        MM-RYTM V3 · 2026
      </div>
    </>
  );
};
