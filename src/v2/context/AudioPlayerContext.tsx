/**
 * Player audio /v2 : un seul element HTML5 Audio natif, AUCUN iframe.
 * La file de lecture est la liste filtree au moment du clic : next/prev
 * naviguent dans ce que l'utilisateur voyait. ended enchaine, error saute
 * la piste (avec garde anti-boucle si toute la file est en erreur).
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';

export interface V2Track {
  id: string;
  title: string;
  project: string;
  artist: string;
  role: string;
  year: number;
  category: 'originals' | 'remixes' | 'vrstl';
  audio: string;
  link: string;
}

interface AudioPlayerCtx {
  current: V2Track | null;
  playing: boolean;
  progress: number;
  duration: number;
  queue: V2Track[];
  play: (track: V2Track, queue?: V2Track[]) => void;
  toggle: () => void;
  next: () => void;
  prev: () => void;
  seek: (ratio: number) => void;
  close: () => void;
}

const Ctx = createContext<AudioPlayerCtx | null>(null);

export const useAudioPlayer = () => {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useAudioPlayer hors de AudioPlayerProvider');
  return ctx;
};

export const AudioPlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [current, setCurrent] = useState<V2Track | null>(null);
  const [queue, setQueue] = useState<V2Track[]>([]);
  const [playing, setPlaying] = useState(false);
  const [progress, setProgress] = useState(0);
  const [duration, setDuration] = useState(0);
  // Refs miroirs pour les listeners de l'element audio (poses une seule fois)
  const currentRef = useRef<V2Track | null>(null);
  const queueRef = useRef<V2Track[]>([]);
  const errorHopsRef = useRef(0);

  const getAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'metadata';
    }
    return audioRef.current;
  };

  const load = useCallback((track: V2Track) => {
    const el = getAudio();
    el.src = track.audio;
    currentRef.current = track;
    setCurrent(track);
    setProgress(0);
    setDuration(0);
    el.play().then(
      () => setPlaying(true),
      () => setPlaying(false) // autoplay refuse : la barre reste en pause
    );
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      const q = queueRef.current;
      const cur = currentRef.current;
      if (!q.length || !cur) return;
      const i = q.findIndex((t) => t.id === cur.id);
      const nextIndex = (i + dir + q.length) % q.length;
      load(q[nextIndex]);
    },
    [load]
  );

  // Listeners poses une fois pour la duree de vie du provider
  useEffect(() => {
    const el = getAudio();
    const onTime = () => {
      setProgress(el.duration ? el.currentTime / el.duration : 0);
    };
    const onMeta = () => setDuration(el.duration || 0);
    const onEnded = () => {
      errorHopsRef.current = 0;
      if (queueRef.current.length > 1) step(1);
      else setPlaying(false);
    };
    const onError = () => {
      // Fichier illisible : on saute, mais jamais plus d'un tour de file
      if (errorHopsRef.current < queueRef.current.length) {
        errorHopsRef.current += 1;
        step(1);
      } else {
        setPlaying(false);
      }
    };
    el.addEventListener('timeupdate', onTime);
    el.addEventListener('loadedmetadata', onMeta);
    el.addEventListener('ended', onEnded);
    el.addEventListener('error', onError);
    return () => {
      el.removeEventListener('timeupdate', onTime);
      el.removeEventListener('loadedmetadata', onMeta);
      el.removeEventListener('ended', onEnded);
      el.removeEventListener('error', onError);
      el.pause();
      el.src = '';
    };
  }, [step]);

  const play = useCallback(
    (track: V2Track, newQueue?: V2Track[]) => {
      errorHopsRef.current = 0;
      if (newQueue?.length) {
        queueRef.current = newQueue;
        setQueue(newQueue);
      } else if (!queueRef.current.length) {
        queueRef.current = [track];
        setQueue([track]);
      }
      if (currentRef.current?.id === track.id) {
        // Meme piste : simple toggle
        const el = getAudio();
        if (el.paused) el.play().then(() => setPlaying(true), () => undefined);
        else {
          el.pause();
          setPlaying(false);
        }
        return;
      }
      load(track);
    },
    [load]
  );

  const toggle = useCallback(() => {
    const el = getAudio();
    if (!currentRef.current) return;
    if (el.paused) el.play().then(() => setPlaying(true), () => undefined);
    else {
      el.pause();
      setPlaying(false);
    }
  }, []);

  const seek = useCallback((ratio: number) => {
    const el = getAudio();
    if (el.duration) {
      el.currentTime = Math.max(0, Math.min(1, ratio)) * el.duration;
      setProgress(ratio);
    }
  }, []);

  const close = useCallback(() => {
    const el = getAudio();
    el.pause();
    el.src = '';
    currentRef.current = null;
    setCurrent(null);
    setPlaying(false);
    setProgress(0);
  }, []);

  const value = useMemo(
    () => ({
      current,
      playing,
      progress,
      duration,
      queue,
      play,
      toggle,
      next: () => step(1),
      prev: () => step(-1),
      seek,
      close,
    }),
    [current, playing, progress, duration, queue, play, toggle, step, seek, close]
  );

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
};
