/**
 * La face v3 du plugin (2026-11-25) : ce que la face, l'ecran et les pages d'OPEN partagent : la piste active, les
 * controles de la face (un par knob), la petite forme d'onde d'un sample, le dessin d'un LFO.
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { requestSample, samplePcm } from '../../audio/samples';
import type { TrackKey } from '../../audio/tracks';
import { activeTrack } from '../../state/trk';
import { course, setCourse, slotCtl, type Ctl } from './ctl';
import { useTick } from './ui';

/** La piste active (la face DT2 : 1 a 16 ; au depart BD). */
export const useTrack = (): TrackKey => useSyncExternalStore(activeTrack.subscribe, () => activeTrack.get() ?? 'BD');

/** Les controles de la face, faits une fois (ils lisent la piste active a chaque lecture). */
export const C = {
  snd: slotCtl('voice', 't:snd'),
  tune: slotCtl('voice', 't:tune', true),
  fine: slotCtl('voice', 't:fine', true),
  start: slotCtl('voice', 't:sstart'),
  len: slotCtl('voice', 't:slen'),
  lev: slotCtl('voice', 't:vol'),
  rev: slotCtl('voice', 't:srev'),
  fcut: slotCtl('fltr', 'vfcut'),
  freso: slotCtl('fltr', 'vfreso'),
  ftype: slotCtl('fltr', 'vftype'),
  fenv: slotCtl('fltr', 'vfenv', true),
  fatk: slotCtl('fltr', 'vfatk'),
  fdec: slotCtl('fltr', 'vfdec'),
  tone: slotCtl('fltr', 'tone', true),
  atk: slotCtl('env', 'vatk'),
  hold: slotCtl('env', 'vhold'),
  dec: slotCtl('env', 'vdecay'),
  vstart: slotCtl('env', 'vstart'),
  pan: slotCtl('env', 'vpan', true),
  l1rate: slotCtl('mod', 'z:l1rate'),
  l1dep: slotCtl('mod', 'q:l1dep', true),
  l1wav: slotCtl('mod', 'q:l1wav'),
  l1dst: slotCtl('mod', 'q:l1dst'),
  l2rate: slotCtl('mod', 'z:l2rate'),
  l2dep: slotCtl('mod', 'q:l2dep', true),
  l2wav: slotCtl('mod', 'q:l2wav'),
  l2dst: slotCtl('mod', 'q:l2dst'),
  sdist: slotCtl('fxv', 'vdist'),
  schorus: slotCtl('fxv', 'vchorus'),
  sdelay: slotCtl('fxv', 'vdelay'),
  sreverb: slotCtl('fxv', 'vreverb'),
  shell: slotCtl('fxv', 'vhell'),
  note: slotCtl('trig', 'vtune', true),
  vel: slotCtl('trig', 'step:vel'),
  qlen: slotCtl('trig', 'q:len'),
  prob: slotCtl('trig', 'q:prob'),
  cond: slotCtl('trig', 'q:cond'),
  utime: slotCtl('trig', 'q:utime', true),
  rtrg: slotCtl('trig2', 'q:rtrg'),
  rate: slotCtl('trig2', 'q:rate'),
  master: slotCtl('fxm', 'level'),
  swing: slotCtl('tempo', 'swing'),
  comp: slotCtl('fxg', 'comp'),
} as const;

/** Le pas d'un controle a crans, d'un cran (le sample d'avant, d'apres). */
export function nudge(c: Ctl, d: number): void {
  const n = c.steps();
  c.begin?.();
  setCourse(c, course(c) + d / Math.max(1, n > 1 ? n - 1 : 127));
}

/* ---------------- la forme d'onde du sample de la piste (petite) ---------------- */

export const MiniWave: React.FC<{ skey: string; w: number; h: number; color?: string }> = ({ skey, w, h, color = '#d9d9d9' }) => {
  const cv = useRef<HTMLCanvasElement>(null);
  const pcm = skey ? samplePcm(skey) : undefined;
  useTick();
  useEffect(() => {
    if (skey && !pcm) void requestSample(skey);
  }, [skey, pcm]);
  useEffect(() => {
    const c = cv.current;
    if (!c) return;
    const dpr = Math.min(3, window.devicePixelRatio || 1) * 2;
    c.width = Math.round(w * dpr);
    c.height = Math.round(h * dpr);
    const g = c.getContext('2d');
    if (!g) return;
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    g.clearRect(0, 0, w, h);
    if (!pcm) return;
    const L = pcm.L;
    const n = L.length;
    let peak = 1e-6;
    for (let i = 0; i < n; i += 1) peak = Math.max(peak, Math.abs(L[i]));
    g.fillStyle = color;
    const mid = h / 2;
    for (let x = 0; x < w; x += 1) {
      const a = Math.floor((x / w) * n);
      const b = Math.max(a + 1, Math.floor(((x + 1) / w) * n));
      let lo = 0;
      let hi = 0;
      for (let i = a; i < b; i += 1) {
        const v = L[i] / peak;
        if (v < lo) lo = v;
        if (v > hi) hi = v;
      }
      g.fillRect(x, mid - hi * mid * 0.95, 1, Math.max(1, (hi - lo) * mid * 0.95));
    }
  }, [pcm, w, h, color]);
  return <canvas ref={cv} style={{ width: w, height: h, display: 'block' }} />;
};

/** Les deux LFO dans leur petit ecran : leur forme, le premier en jaune. */
export const WAVE_FN: ((t: number) => number)[] = [
  (t) => 1 - 4 * Math.abs(((t + 0.25) % 1) - 0.5),
  (t) => Math.sin(t * Math.PI * 2),
  (t) => (t % 1 < 0.5 ? 1 : -1),
  (t) => 1 - 2 * (t % 1),
  (t) => Math.exp(-4 * (t % 1)) * 2 - 1,
  (t) => 2 * (t % 1) - 1,
  (t) => Math.sin(Math.floor(t * 4) * 12.9898) * 0.9,
];
export const lfoPath = (wav: number, depth: number, w: number, h: number, cycles: number): string => {
  const f = WAVE_FN[Math.max(0, Math.min(WAVE_FN.length - 1, Math.round(wav)))];
  const amp = (h / 2 - 2) * Math.max(0.15, Math.min(1, Math.abs(depth)));
  let p = '';
  for (let i = 0; i <= 120; i += 1) {
    const t = (i / 120) * cycles;
    p += `${i ? 'L' : 'M'}${((i / 120) * w).toFixed(1)} ${(h / 2 - f(t) * amp * Math.sign(depth || 1)).toFixed(1)}`;
  }
  return p;
};
