/**
 * PlayerContext — LE lecteur officiel du site, toutes pages confondues.
 *
 * Etat + <audio> natif + moteur SoundCloud (scWidget) + la barre fixe du
 * bas vivent ici, au niveau du Layout : la lecture survit a la navigation.
 * Une file, deux moteurs :
 * - soundcloudUrl -> version complete via widget SoundCloud cache,
 *   badge "Complet - SoundCloud"
 * - sinon extrait iTunes 30 s (resolution paresseuse : previewUrl direct,
 *   album deplie en ses pistes, ou recherche artiste + titre), badge
 *   "Extrait 30 s" + "Chercher en entier"
 * Fin de piste = suivante ; introuvable = sautee ; fin de file = arret
 * propre. Un seul son a la fois : chaque demarrage pause l'autre moteur.
 *
 * Piege du repo : `.page > * { position: relative }` ecrase le fixed de
 * Tailwind, la barre est donc positionnee en style inline.
 * La barre reste neutre (blanc/verre) : les accents couleur du site sont
 * confines a .radar-page et ne doivent pas voyager avec le lecteur.
 */

import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from 'react';
import { albumTracks, resolveTrackPreview } from '../utils/itunes';
import {
  setScHandlers,
  scPlay,
  scPause,
  scResume,
  scSeekRatio,
  scSetVolume,
} from '../utils/scWidget';
import { useTranslation } from '../lib/i18n';
import { cn } from '../lib/cn';

/** Une entree de la file. Resolution paresseuse : previewUrl peut manquer. */
export interface QueueTrack {
  title: string;
  artist: string;
  soundcloudUrl?: string;
  previewUrl?: string;
  collectionId?: number;
  link?: string;
}

export type PlayerStatus = 'idle' | 'loading' | 'playing' | 'paused' | 'error';

interface PlayerApi {
  queue: QueueTrack[];
  index: number;
  status: PlayerStatus;
  current: QueueTrack | undefined;
  /** true si cette piste est celle en cours (peu importe play/pause). */
  isCurrent: (artist: string, title: string) => boolean;
  playQueue: (queue: QueueTrack[], startIndex: number) => Promise<void>;
  toggle: () => void;
  close: () => void;
}

const PlayerContext = createContext<PlayerApi | null>(null);

export const usePlayer = (): PlayerApi => {
  const ctx = useContext(PlayerContext);
  if (!ctx) throw new Error('usePlayer doit etre utilise sous <PlayerProvider>');
  return ctx;
};

const normName = (s: string) =>
  s
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase();

const PlayIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
);
const PauseIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </svg>
);
const PrevIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M6 6h2v12H6zM20 6l-10 6 10 6z" />
  </svg>
);
const NextIcon: React.FC<{ className?: string }> = ({ className }) => (
  <svg className={className} viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M16 6h2v12h-2zM4 6l10 6-10 6z" />
  </svg>
);
const Spinner: React.FC<{ className?: string }> = ({ className }) => (
  <span
    className={cn('inline-block w-4 h-4 rounded-full border-2 border-white/20 border-t-white/80 animate-spin', className)}
    aria-hidden="true"
  />
);

interface PlayerState {
  queue: QueueTrack[];
  index: number;
  status: PlayerStatus;
}

export const PlayerProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { t } = useTranslation();
  const r = t.radar;

  const [player, setPlayer] = useState<PlayerState>({ queue: [], index: -1, status: 'idle' });
  const [progress, setProgress] = useState(0);
  const [volume, setVolume] = useState(0.9);

  const audioRef = useRef<HTMLAudioElement | null>(null);
  /** Moteur en cours : garde les handlers des deux moteurs etanches. */
  const engineRef = useRef<'audio' | 'sc' | null>(null);
  const playerRef = useRef(player);
  playerRef.current = player;
  const volumeRef = useRef(volume);
  volumeRef.current = volume;
  /** Sequence de lecture : invalide les resolutions async depassees. */
  const seqRef = useRef(0);

  // Signale au reste du site (pilule raccourci, padding des pages) que la
  // barre est visible.
  useEffect(() => {
    if (player.queue.length > 0) document.body.classList.add('radar-audio-open');
    else document.body.classList.remove('radar-audio-open');
    return () => document.body.classList.remove('radar-audio-open');
  }, [player.queue.length]);

  const stopEngines = () => {
    const audio = audioRef.current;
    if (audio) {
      audio.pause();
      audio.removeAttribute('src');
    }
    scPause();
  };

  /** Fin de file : arret propre, la barre reste affichee. */
  const endOfQueue = () => {
    stopEngines();
    setProgress(0);
    setPlayer((p) => ({ ...p, status: 'paused' }));
  };

  const playAt = async (queue: QueueTrack[], index: number, manual: boolean): Promise<void> => {
    const track = queue[index];
    if (!track) return endOfQueue();

    const seq = ++seqRef.current;
    window.dispatchEvent(new CustomEvent('mm:radar-play'));
    setPlayer({ queue, index, status: 'loading' });
    setProgress(0);

    // --- Moteur SoundCloud : version complete ---
    if (track.soundcloudUrl) {
      const audio = audioRef.current;
      if (audio) {
        audio.pause();
        audio.removeAttribute('src');
      }
      engineRef.current = 'sc';
      try {
        scSetVolume(volumeRef.current);
        await scPlay(track.soundcloudUrl);
      } catch {
        if (seq === seqRef.current) setPlayer({ queue, index, status: 'error' });
      }
      return;
    }

    // --- Moteur iTunes : resolution paresseuse puis extrait 30 s ---
    scPause();
    engineRef.current = 'audio';

    // Un album atteint dans la file se deplie en ses pistes : l'entree est
    // remplacee par les morceaux du disque et la lecture part du premier.
    if (!track.previewUrl && track.collectionId) {
      const tracks = await albumTracks(track.collectionId);
      if (seq !== seqRef.current) return;
      if (tracks.length > 0) {
        const expanded = [
          ...queue.slice(0, index),
          ...tracks.map((tr) => ({ title: tr.title, artist: tr.artist, previewUrl: tr.previewUrl, link: track.link })),
          ...queue.slice(index + 1),
        ];
        return playAt(expanded, index, manual);
      }
    }

    let url = track.previewUrl || null;
    if (!url) url = await resolveTrackPreview(track.artist, track.title);
    if (seq !== seqRef.current) return; // une autre lecture a pris la main

    if (!url) {
      if (manual) {
        // Premier clic direct : fallback honnete vers la page de la release
        if (track.link) window.open(track.link, '_blank', 'noopener');
        setPlayer({ queue: [], index: -1, status: 'idle' });
      } else if (index + 1 < queue.length) {
        playAt(queue, index + 1, false); // la file saute les introuvables
      } else {
        endOfQueue();
      }
      return;
    }

    // Memorise l'URL resolue dans la file (replay et prev instantanes)
    const resolved = queue.map((q, i) => (i === index ? { ...q, previewUrl: url! } : q));
    setPlayer({ queue: resolved, index, status: 'loading' });
    const audio = audioRef.current;
    if (!audio) return;
    audio.src = url;
    audio.volume = volumeRef.current;
    audio.play().catch(() => {
      if (seq === seqRef.current) setPlayer({ queue: resolved, index, status: 'error' });
    });
  };

  const advance = (direction: 1 | -1) => {
    const p = playerRef.current;
    if (p.queue.length === 0) return;
    const next = p.index + direction;
    if (next < 0) {
      // Precedent en tete de file : retour au debut de la piste
      if (engineRef.current === 'sc') scSeekRatio(0);
      else if (audioRef.current) audioRef.current.currentTime = 0;
      return;
    }
    if (next >= p.queue.length) return endOfQueue();
    playAt(p.queue, next, false);
  };

  // Handlers SoundCloud lies une fois, appuyes sur les refs
  useEffect(() => {
    setScHandlers({
      onPlay: () => {
        if (engineRef.current === 'sc') setPlayer((p) => ({ ...p, status: 'playing' }));
      },
      onPause: () => {
        if (engineRef.current === 'sc')
          setPlayer((p) => (p.status === 'playing' || p.status === 'loading' ? { ...p, status: 'paused' } : p));
      },
      onFinish: () => {
        if (engineRef.current === 'sc') advance(1);
      },
      onProgress: (pos, dur) => {
        if (engineRef.current === 'sc' && dur > 0) setProgress(pos / dur);
      },
      onError: () => {
        if (engineRef.current === 'sc') setPlayer((p) => ({ ...p, status: 'error' }));
      },
    });
    return () => setScHandlers(null);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const currentTrack = player.queue[player.index];
  const currentIsFull = !!currentTrack?.soundcloudUrl;

  const toggle = useCallback(() => {
    const p = playerRef.current;
    const track = p.queue[p.index];
    if (!track) return;
    if (engineRef.current === 'sc') {
      if (p.status === 'playing') scPause();
      else {
        window.dispatchEvent(new CustomEvent('mm:radar-play'));
        scResume();
      }
      return;
    }
    const audio = audioRef.current;
    if (!audio) return;
    if (p.status === 'playing') audio.pause();
    else if (p.status === 'paused') {
      window.dispatchEvent(new CustomEvent('mm:radar-play'));
      audio.play().catch(() => setPlayer((s) => ({ ...s, status: 'error' })));
    } else if (p.status === 'error') {
      playAt(p.queue, p.index, true);
    }
  }, []);

  const close = useCallback(() => {
    seqRef.current++;
    stopEngines();
    engineRef.current = null;
    setPlayer({ queue: [], index: -1, status: 'idle' });
    setProgress(0);
  }, []);

  const playQueue = useCallback((queue: QueueTrack[], startIndex: number) => {
    return playAt(queue, startIndex, true);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const isCurrent = useCallback((artist: string, title: string) => {
    const cur = playerRef.current.queue[playerRef.current.index];
    return !!cur && normName(cur.artist) === normName(artist) && normName(cur.title) === normName(title);
  }, []);

  const seekTo = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = (e.clientX - rect.left) / rect.width;
    if (engineRef.current === 'sc') {
      scSeekRatio(ratio);
    } else {
      const audio = audioRef.current;
      if (audio && audio.duration) audio.currentTime = ratio * audio.duration;
    }
  };

  const changeVolume = (v: number) => {
    setVolume(v);
    if (audioRef.current) audioRef.current.volume = v;
    scSetVolume(v);
  };

  const scSearchUrl = currentTrack
    ? `https://soundcloud.com/search?q=${encodeURIComponent(`${currentTrack.artist} ${currentTrack.title}`)}`
    : '#';

  const api: PlayerApi = {
    queue: player.queue,
    index: player.index,
    status: player.status,
    current: currentTrack,
    isCurrent,
    playQueue,
    toggle,
    close,
  };

  return (
    <PlayerContext.Provider value={api}>
      {children}

      <audio
        ref={audioRef}
        preload="none"
        onPlaying={() => {
          if (engineRef.current === 'audio') setPlayer((p) => ({ ...p, status: 'playing' }));
        }}
        onPause={() => {
          if (engineRef.current === 'audio')
            setPlayer((p) => (p.status === 'playing' ? { ...p, status: 'paused' } : p));
        }}
        onEnded={() => {
          if (engineRef.current === 'audio') advance(1);
        }}
        onError={() => {
          if (engineRef.current === 'audio')
            setPlayer((p) => (p.queue.length ? { ...p, status: 'error' } : p));
        }}
        onTimeUpdate={() => {
          const a = audioRef.current;
          if (engineRef.current === 'audio' && a && a.duration) setProgress(a.currentTime / a.duration);
        }}
      />

      {currentTrack && (
        <div
          style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 80 }}
          className="bg-[#0b0b0d]/90 backdrop-blur-2xl border-t border-white/15 shadow-[0_-8px_30px_rgba(0,0,0,0.5)]"
        >
          <div className="max-w-7xl mx-auto px-3 md:px-10 h-[64px] flex items-center gap-2 md:gap-4">
            <div className="shrink-0 flex items-center gap-1">
              <button
                type="button"
                onClick={() => advance(-1)}
                aria-label={r.prevTrack}
                className="w-8 h-8 rounded-full bg-transparent border-0 text-white/70 hover:text-white cursor-pointer flex items-center justify-center"
              >
                <PrevIcon className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={toggle}
                aria-label={player.status === 'playing' ? r.pause : r.listen}
                className="w-10 h-10 rounded-full bg-white text-black border-0 cursor-pointer flex items-center justify-center"
              >
                {player.status === 'loading' ? (
                  <Spinner className="border-black/20 border-t-black" />
                ) : player.status === 'playing' ? (
                  <PauseIcon className="w-4 h-4" />
                ) : (
                  <PlayIcon className="w-4 h-4 ml-0.5" />
                )}
              </button>
              <button
                type="button"
                onClick={() => advance(1)}
                aria-label={r.nextTrack}
                className="w-8 h-8 rounded-full bg-transparent border-0 text-white/70 hover:text-white cursor-pointer flex items-center justify-center"
              >
                <NextIcon className="w-4 h-4" />
              </button>
            </div>

            <span className="shrink-0 font-body text-[11px] text-white/70 tabular-nums">
              {player.index + 1}/{player.queue.length}
            </span>

            <div className="min-w-0 w-36 md:w-64">
              <div className="font-body font-semibold text-white text-xs md:text-sm truncate leading-tight">
                {currentTrack.title}
              </div>
              <div className="font-body text-[11px] text-white/70 truncate leading-tight mt-0.5">
                {player.status === 'error' ? r.playerError : currentTrack.artist}
              </div>
            </div>

            <span
              className={cn(
                'shrink-0 font-body font-semibold text-[10px] md:text-[11px] rounded-full px-2 py-0.5 whitespace-nowrap',
                currentIsFull ? 'bg-white/15 text-white' : 'bg-white/10 text-white/80',
              )}
            >
              {currentIsFull ? r.fullBadge : r.playerPreview}
            </span>
            {!currentIsFull && (
              <a
                href={scSearchUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="shrink-0 hidden md:inline font-body text-[11px] text-white/70 hover:text-white underline underline-offset-2 whitespace-nowrap"
              >
                {r.findFull} ↗
              </a>
            )}

            <div
              className="flex-1 h-1.5 bg-white/20 rounded-full cursor-pointer overflow-hidden"
              onClick={seekTo}
              role="progressbar"
              aria-valuenow={Math.round(progress * 100)}
              aria-valuemin={0}
              aria-valuemax={100}
            >
              <div className="h-full bg-white rounded-full" style={{ width: `${progress * 100}%` }} />
            </div>

            <input
              type="range"
              min={0}
              max={1}
              step={0.05}
              value={volume}
              onChange={(e) => changeVolume(Number(e.target.value))}
              aria-label="Volume"
              style={{ accentColor: '#ffffff' }}
              className="hidden md:block w-20 cursor-pointer"
            />

            <button
              type="button"
              onClick={close}
              aria-label={r.close}
              className="shrink-0 w-8 h-8 rounded-full bg-white/10 border border-white/15 text-white/80 hover:text-white cursor-pointer text-base leading-none"
            >
              ×
            </button>
          </div>
        </div>
      )}
    </PlayerContext.Provider>
  );
};
