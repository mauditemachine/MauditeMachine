/**
 * DEV uniquement (?v3mock=1) : un moteur factice avec la meme forme que
 * AudioPlayerContext, pour revoir les visuels de lecture sans jamais
 * toucher au widget SoundCloud. Latence widget simulee 1500 ms, duree
 * factice 300 s. ?v3mock=fail : le deuxieme play() echoue (piste sautee,
 * notice 4 s), pour revoir le chemin "Skipped".
 */

import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { isPlayable, type V2Track } from '../../v2/context/AudioPlayerContext';

export interface EngineCtx {
  current: V2Track | null;
  playing: boolean;
  progress: number;
  duration: number;
  queue: V2Track[];
  notice: string | null;
  play: (track: V2Track, queue?: V2Track[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (ratio: number) => void;
  close: () => void;
}

const Ctx = createContext<EngineCtx | null>(null);

export const useMockEngine = (): EngineCtx => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useMockEngine hors de MockEngineProvider');
  return ctx;
};

const LATENCY = 1500;
const FAKE_DURATION = 300;
const TICK = 250;

export const MockEngineProvider: React.FC<{ children: React.ReactNode; failSecond?: boolean }> = ({
  children,
  failSecond = false,
}) => {
  const [current, setCurrent] = useState<V2Track | null>(null);
  const [queue, setQueue] = useState<V2Track[]>([]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  const [notice, setNotice] = useState<string | null>(null);
  const currentRef = useRef<V2Track | null>(null);
  const queueRef = useRef<V2Track[]>([]);
  const playingRef = useRef(false);
  const progressRef = useRef(0);
  const loads = useRef(0);
  const latencyTimer = useRef<number | undefined>(undefined);
  const noticeTimer = useRef<number | undefined>(undefined);
  const ticker = useRef<number | undefined>(undefined);

  const setPlay = (v: boolean) => {
    playingRef.current = v;
    setPlaying(v);
  };

  const stopTicker = () => {
    window.clearInterval(ticker.current);
    ticker.current = undefined;
  };

  const flagSkipped = useCallback((title: string) => {
    window.clearTimeout(noticeTimer.current);
    setNotice(title);
    noticeTimer.current = window.setTimeout(() => setNotice(null), 4000);
  }, []);

  const step = useRef<(dir: 1 | -1) => void>(() => undefined);

  const startTicker = useCallback(() => {
    stopTicker();
    ticker.current = window.setInterval(() => {
      if (!playingRef.current) return;
      const p = progressRef.current + TICK / 1000 / FAKE_DURATION;
      if (p >= 1) {
        progressRef.current = 0;
        setProgress(0);
        setPlay(false);
        stopTicker();
        if (queueRef.current.length > 1) window.setTimeout(() => step.current(1), 300);
        return;
      }
      progressRef.current = p;
      setProgress(p);
    }, TICK);
  }, []);

  const load = useCallback(
    (track: V2Track) => {
      window.clearTimeout(latencyTimer.current);
      stopTicker();
      currentRef.current = track;
      setCurrent(track);
      progressRef.current = 0;
      setProgress(0);
      setDuration(0);
      setPlay(false);
      loads.current += 1;
      const n = loads.current;
      latencyTimer.current = window.setTimeout(() => {
        if (currentRef.current?.id !== track.id) return;
        if (failSecond && n === 2) {
          flagSkipped(track.title);
          step.current(1);
          return;
        }
        setDuration(FAKE_DURATION);
        setPlay(true);
        startTicker();
      }, LATENCY);
    },
    [failSecond, flagSkipped, startTicker]
  );

  step.current = (dir) => {
    const q = queueRef.current;
    const cur = currentRef.current;
    if (!q.length || !cur) return;
    const start = q.findIndex((t) => t.id === cur.id);
    for (let hop = 1; hop <= q.length; hop += 1) {
      const cand = q[(start + dir * hop + q.length * hop) % q.length];
      if (isPlayable(cand)) {
        load(cand);
        return;
      }
    }
    setPlay(false);
  };

  useEffect(
    () => () => {
      window.clearTimeout(latencyTimer.current);
      window.clearTimeout(noticeTimer.current);
      stopTicker();
    },
    []
  );

  const play = useCallback(
    (track: V2Track, newQueue?: V2Track[]) => {
      if (!isPlayable(track)) return;
      if (newQueue?.length) {
        queueRef.current = newQueue;
        setQueue(newQueue);
      } else if (!queueRef.current.length) {
        queueRef.current = [track];
        setQueue([track]);
      }
      if (currentRef.current?.id === track.id) {
        setPlay(!playingRef.current);
        return;
      }
      load(track);
    },
    [load]
  );

  const toggle = useCallback(() => {
    if (!currentRef.current) return;
    setPlay(!playingRef.current);
  }, []);

  const seek = useCallback((ratio: number) => {
    const r = Math.max(0, Math.min(1, ratio));
    progressRef.current = r;
    setProgress(r);
  }, []);

  const close = useCallback(() => {
    window.clearTimeout(latencyTimer.current);
    stopTicker();
    currentRef.current = null;
    setCurrent(null);
    setPlay(false);
    progressRef.current = 0;
    setProgress(0);
  }, []);

  const value = useMemo<EngineCtx>(
    () => ({
      current,
      playing,
      progress,
      duration,
      queue,
      notice,
      play,
      toggle,
      next: () => step.current(1),
      prev: () => step.current(-1),
      seek,
      close,
    }),
    [current, playing, progress, duration, queue, notice, play, toggle, seek, close]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
