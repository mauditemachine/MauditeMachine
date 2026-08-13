/**
 * Player audio /v2 : une seule barre, DEUX moteurs, un seul joue a la fois
 * (meme architecture que le player v1) :
 *
 * - soundcloudUrl -> moteur SoundCloud : l'iframe cachee + Widget API
 *   officielle de src/utils/scWidget.ts (module v1 reutilise tel quel).
 *   Full tracks, zero cle, les ecoutes comptent sur le profil. Decision
 *   validee avec Mika : l'iframe de pilotage est invisible, la regle
 *   zero-iframe etait esthetique.
 * - audio (URL directe, ex. previews iTunes du Radar) -> element HTML5
 *   Audio natif.
 *
 * La file est la liste filtree au moment du clic ; next/prev/ended sautent
 * les pistes injouables (sans soundcloudUrl ni audio) avec garde
 * anti-boucle. L'UI sticky ne change pas.
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
import {
  scPause,
  scPlay,
  scResume,
  scSeekRatio,
  setScHandlers,
} from '../../utils/scWidget';

export interface V2Track {
  id: string;
  title: string;
  project: string;
  artist: string;
  role: string;
  year: number;
  category: 'originals' | 'remixes' | 'vrstl';
  /** Version complete lue via le widget SoundCloud (permalink public). */
  soundcloudUrl?: string;
  /** URL audio directe (extraits iTunes du Radar) pour le moteur HTML5. */
  audio?: string;
  link: string;
  /** true = dans la selection courte affichee par defaut (editable en JSON) */
  featured?: boolean;
}

export const isPlayable = (t: V2Track) => !!(t.soundcloudUrl || t.audio);

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
  // Refs miroirs pour les listeners (poses une seule fois)
  const currentRef = useRef<V2Track | null>(null);
  const queueRef = useRef<V2Track[]>([]);
  const errorHopsRef = useRef(0);
  /** Moteur de la piste courante. */
  const engineRef = useRef<'sc' | 'audio' | null>(null);

  const getAudio = () => {
    if (!audioRef.current) {
      audioRef.current = new Audio();
      audioRef.current.preload = 'metadata';
    }
    return audioRef.current;
  };

  const load = useCallback((track: V2Track) => {
    const el = getAudio();
    setCurrent(track);
    currentRef.current = track;
    setProgress(0);
    setDuration(0);
    if (track.soundcloudUrl) {
      // Moteur SoundCloud : l'<audio> se tait, le widget prend la main
      el.pause();
      el.removeAttribute('src');
      engineRef.current = 'sc';
      scPlay(track.soundcloudUrl).catch(() => setPlaying(false));
      // setPlaying(true) arrive par l'event PLAY du widget
      return;
    }
    if (track.audio) {
      scPause();
      engineRef.current = 'audio';
      el.src = track.audio;
      el.play().then(
        () => setPlaying(true),
        () => setPlaying(false) // autoplay refuse : la barre reste en pause
      );
      return;
    }
    // Piste injouable chargee directement : etat arrete propre
    engineRef.current = null;
    setPlaying(false);
  }, []);

  const step = useCallback(
    (dir: 1 | -1) => {
      const q = queueRef.current;
      const cur = currentRef.current;
      if (!q.length || !cur) return;
      const start = q.findIndex((t) => t.id === cur.id);
      // Prochaine piste JOUABLE dans la direction demandee (saute les
      // entrees sans source, garde anti-boucle sur un tour complet)
      for (let hop = 1; hop <= q.length; hop += 1) {
        const candidate = q[(start + dir * hop + q.length * hop) % q.length];
        if (isPlayable(candidate)) {
          load(candidate);
          return;
        }
      }
      setPlaying(false);
    },
    [load]
  );

  // Listeners de l'element audio, poses une fois
  useEffect(() => {
    const el = getAudio();
    const onTime = () => {
      if (engineRef.current !== 'audio') return;
      setProgress(el.duration ? el.currentTime / el.duration : 0);
    };
    const onMeta = () => {
      if (engineRef.current === 'audio') setDuration(el.duration || 0);
    };
    const onEnded = () => {
      if (engineRef.current !== 'audio') return;
      errorHopsRef.current = 0;
      if (queueRef.current.length > 1) step(1);
      else setPlaying(false);
    };
    const onError = () => {
      if (engineRef.current !== 'audio' || !el.src) return;
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
      el.removeAttribute('src');
    };
  }, [step]);

  // Handlers du moteur SoundCloud, poses pour la duree de vie du provider.
  // L'iframe (singleton module) survit a la navigation : on la met en pause
  // et on detache les handlers au unmount.
  useEffect(() => {
    setScHandlers({
      onPlay: () => {
        if (engineRef.current === 'sc') setPlaying(true);
      },
      onPause: () => {
        if (engineRef.current === 'sc') setPlaying(false);
      },
      onFinish: () => {
        if (engineRef.current !== 'sc') return;
        errorHopsRef.current = 0;
        if (queueRef.current.length > 1) step(1);
        else setPlaying(false);
      },
      onProgress: (positionMs, durationMs) => {
        if (engineRef.current !== 'sc' || durationMs <= 0) return;
        setDuration(durationMs / 1000);
        setProgress(positionMs / durationMs);
      },
      onError: () => {
        if (engineRef.current !== 'sc') return;
        if (errorHopsRef.current < queueRef.current.length) {
          errorHopsRef.current += 1;
          step(1);
        } else {
          setPlaying(false);
        }
      },
    });
    return () => {
      setScHandlers(null);
      scPause();
    };
  }, [step]);

  const play = useCallback(
    (track: V2Track, newQueue?: V2Track[]) => {
      if (!isPlayable(track)) return;
      errorHopsRef.current = 0;
      if (newQueue?.length) {
        queueRef.current = newQueue;
        setQueue(newQueue);
      } else if (!queueRef.current.length) {
        queueRef.current = [track];
        setQueue([track]);
      }
      if (currentRef.current?.id === track.id) {
        // Meme piste : simple toggle selon le moteur
        if (engineRef.current === 'sc') {
          if (playing) scPause();
          else scResume();
          return;
        }
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
    [load, playing]
  );

  const toggle = useCallback(() => {
    if (!currentRef.current) return;
    if (engineRef.current === 'sc') {
      if (playing) scPause();
      else scResume();
      return;
    }
    const el = getAudio();
    if (el.paused) el.play().then(() => setPlaying(true), () => undefined);
    else {
      el.pause();
      setPlaying(false);
    }
  }, [playing]);

  const seek = useCallback((ratio: number) => {
    const r = Math.max(0, Math.min(1, ratio));
    if (engineRef.current === 'sc') {
      scSeekRatio(r);
      setProgress(r);
      return;
    }
    const el = getAudio();
    if (el.duration) {
      el.currentTime = r * el.duration;
      setProgress(r);
    }
  }, []);

  const close = useCallback(() => {
    const el = getAudio();
    el.pause();
    el.removeAttribute('src');
    scPause();
    engineRef.current = null;
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
