/**
 * SoundCloudPlayer — lecteur "headless" Pro Max.
 *
 * - Iframe SoundCloud cache (widget API backend)
 * - UI 100% custom Tailwind + Framer Motion
 * - Footer bar fixed bottom, liquid-glass
 * - Progress bar 2px (hover → 4px), seek via clic
 * - Boutons prev/play/next avec whileHover scale + shadow-glow-white
 * - Marquee auto-scroll si titre trop long
 * - Cover mini SoundCloud (artwork hi-res -t500x500)
 * - Callback onBackgroundChange pour synchroniser le fond video
 *
 * Vault panel (playlist fullscreen) : voir Commit 2.
 */

import React, { useEffect, useRef, useState } from 'react'
import { motion } from 'framer-motion'
import { cn } from '../lib/cn'
import { useTranslation } from '../lib/i18n'
import VaultPanel from './ui/VaultPanel'

type Sound = {
  id: number
  title: string
  permalink_url: string
  artwork_url?: string | null
  duration?: number
  description?: string | null
  user?: { username?: string; avatar_url?: string | null }
}

declare global {
  interface Window { SC?: any }
}

const SC_API_URL = 'https://w.soundcloud.com/player/api.js'
const PLAYLIST_URL = 'https://soundcloud.com/mauditemachine/sets/tracks-1'

function loadScriptOnce(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window === 'undefined') return resolve()
    const existing = document.querySelector(`script[src="${src}"]`) as HTMLScriptElement | null
    if (existing) {
      existing.addEventListener('load', () => resolve())
      if ((existing as any).readyState === 'complete') resolve()
      return
    }
    const script = document.createElement('script')
    script.src = src
    script.async = true
    script.onload = () => resolve()
    script.onerror = () => reject(new Error('Failed to load SoundCloud API'))
    document.head.appendChild(script)
  })
}

function formatMs(ms?: number): string {
  if (!ms && ms !== 0) return '0:00'
  const total = Math.floor(ms / 1000)
  const m = Math.floor(total / 60)
  const s = (total % 60).toString().padStart(2, '0')
  return `${m}:${s}`
}

function getHiRes(url?: string | null): string | null {
  if (!url) return null
  return url.replace('-large', '-t500x500')
}

function getCover(sound?: Sound | null): string | null {
  if (!sound) return null
  return getHiRes(sound.artwork_url) || getHiRes(sound.user?.avatar_url || null)
}

function formatTrackDisplay(title: string): string {
  if (!title) return ''
  return title.replace(/^Maudite Machine\s*[-–—]\s*/i, '').replace(/\s*\([^)]*\)\s*$/g, '').trim()
}

// Icon components
const IconPrev = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 5h2v14H6zM20 5v14l-11-7z" />
  </svg>
)
const IconNext = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
    <path d="M16 5h2v14h-2zM4 5v14l11-7z" />
  </svg>
)
const IconPlay = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M8 5v14l11-7z" />
  </svg>
)
const IconPause = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
    <path d="M6 5h4v14H6zM14 5h4v14h-4z" />
  </svg>
)
const IconPlaylist = () => (
  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
    <line x1="3" y1="6" x2="14" y2="6" />
    <line x1="3" y1="12" x2="14" y2="12" />
    <line x1="3" y1="18" x2="10" y2="18" />
    <circle cx="19" cy="18" r="3" fill="currentColor" />
  </svg>
)

interface SoundCloudPlayerProps {
  onBackgroundChange?: (url: string) => void
}

export default function SoundCloudPlayer({
  onBackgroundChange,
}: SoundCloudPlayerProps): JSX.Element {
  const { t } = useTranslation()
  const a = t.a11y
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const widgetRef = useRef<any>(null)
  const [tracks, setTracks] = useState<Sound[]>([])
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [currentTitle, setCurrentTitle] = useState<string>('')
  const [positionMs, setPositionMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  const [vaultOpen, setVaultOpen] = useState(false)
  const lastIndexRef = useRef<number>(-1)
  // Flag : passe a true des que l'utilisateur a interagi (play / next / prev /
  // skip via Vault). Avant ca, on ignore les reports du widget qui indique
  // parfois un index > 0 a tort pendant le chargement de la playlist.
  const userPlayedRef = useRef<boolean>(false)

  // Supprimer les erreurs SoundCloud bruyantes de la console
  useEffect(() => {
    const originalError = console.error
    console.error = (...args) => {
      const message = args[0]?.toString() || ''
      if (
        message.includes('createPattern') ||
        message.includes('canvas element with a width or height of 0') ||
        message.includes('widget-') ||
        message.includes('AbortError') ||
        message.includes('Script error')
      ) return
      originalError.apply(console, args)
    }
    return () => { console.error = originalError }
  }, [])

  // Init widget + bind events
  useEffect(() => {
    let cancelled = false
    let pollInterval: ReturnType<typeof setInterval> | null = null

    async function init() {
      await loadScriptOnce(SC_API_URL)
      if (cancelled || !iframeRef.current || !window.SC) return
      widgetRef.current = window.SC.Widget(iframeRef.current)
      const widget = widgetRef.current

      widget.load(PLAYLIST_URL, {
        auto_play: false,
        hide_related: true,
        show_comments: false,
        show_user: false,
        show_reposts: false,
        show_teaser: false,
        buying: false,
        liking: false,
        download: false,
        color: '#ffffff',
      })

      // Fetch all tracks (poll until stable)
      const tryFetchAll = () => {
        let tries = 0
        let lastCount = -1
        let stable = 0
        const poll = () => {
          widget.getSounds((sounds: Sound[]) => {
            if (cancelled) return
            const list = sounds || []
            if (list.length > 0) setTracks(list)
            tries += 1
            if (list.length > lastCount) {
              lastCount = list.length
              stable = 0
            } else {
              stable += 1
            }
            const shouldStop = tries >= 100 || stable >= 5 || (list.length >= 10 && stable >= 2)
            if (!shouldStop) setTimeout(poll, 150)
          })
        }
        poll()
      }

      const checkCurrentTrack = () => {
        if (cancelled) return
        widget.getCurrentSoundIndex((i: number) => {
          const reported = typeof i === 'number' && i >= 0 ? i : 0
          // BUG FIX : si l'utilisateur n'a JAMAIS lance la musique et que
          // le widget reporte un index > 0, on ignore (quirk SoundCloud
          // pendant le chargement de la playlist). Le track par defaut
          // doit rester index 0.
          if (!userPlayedRef.current && reported > 0) {
            return
          }
          if (reported !== lastIndexRef.current) {
            lastIndexRef.current = reported
            setCurrentIndex(reported)
          }
          widget.getCurrentSound((sound: Sound) => {
            if (sound?.title) setCurrentTitle(sound.title)
            const cover = getCover(sound)
            if (cover && onBackgroundChange) onBackgroundChange(cover)
          })
        })
      }

      widget.bind(window.SC.Widget.Events.READY, () => {
        tryFetchAll()
        // ATTENTION : ne JAMAIS appeler widget.skip() ici. skip() DEMARRE la
        // lecture chez SoundCloud -> c'etait la cause de l'autoplay au load.
        // On se contente d'afficher le track 0 (Voodoo) ; le forcage reel se
        // fait au premier clic play (voir togglePlay).
        setCurrentIndex(0)
        lastIndexRef.current = 0
      })

      widget.bind(window.SC.Widget.Events.PLAY, () => {
        setIsPlaying(true)
        if (tracks.length === 0) tryFetchAll()
        checkCurrentTrack()
      })

      widget.bind(window.SC.Widget.Events.PAUSE, () => setIsPlaying(false))

      widget.bind(window.SC.Widget.Events.PLAY_PROGRESS, (e: any) => {
        setPositionMs(Math.floor(e?.currentPosition || 0))
        widget.getCurrentSound((sound: Sound) => setDurationMs(sound?.duration || 0))
        checkCurrentTrack()
      })

      widget.bind(window.SC.Widget.Events.LOAD_PROGRESS, checkCurrentTrack)
      widget.bind(window.SC.Widget.Events.SEEK, checkCurrentTrack)
      widget.bind(window.SC.Widget.Events.FINISH, () => {
        setIsPlaying(false)
        setTimeout(checkCurrentTrack, 100)
      })

      // Fallback si READY ne se declenche pas
      setTimeout(() => {
        if (!cancelled && tracks.length === 0) tryFetchAll()
      }, 2000)

      // Polling pour detecter changements auto de track
      pollInterval = setInterval(() => {
        if (!cancelled) {
          checkCurrentTrack()
          if (tracks.length < 5) tryFetchAll()
        }
      }, 500)
    }

    init()

    return () => {
      cancelled = true
      if (pollInterval) clearInterval(pollInterval)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Le lecteur Radar demarre un extrait -> on se met en pause, sinon les
  // deux sources jouent en meme temps.
  useEffect(() => {
    const onRadarPlay = () => {
      const w = widgetRef.current
      if (!w) return
      w.isPaused((paused: boolean) => {
        if (!paused) w.pause()
      })
    }
    window.addEventListener('mm:radar-play', onRadarPlay)
    return () => window.removeEventListener('mm:radar-play', onRadarPlay)
  }, [])

  // Actions
  function togglePlay() {
    const w = widgetRef.current
    if (!w) return
    const firstPlay = !userPlayedRef.current
    userPlayedRef.current = true
    w.isPaused((paused: boolean) => {
      if (!paused) {
        w.pause()
        return
      }
      if (firstPlay) {
        // Premier play : garantit que la lecture demarre sur le track 0
        // (Voodoo), meme si le widget a auto-avance pendant le chargement.
        // skip(0) lance la lecture — c'est voulu ici (l'utilisateur vient
        // de cliquer play), jamais au mount.
        w.getCurrentSoundIndex((i: number) => {
          if (typeof i === 'number' && i > 0) {
            try { w.skip(0) } catch { w.play() }
          } else {
            w.play()
          }
        })
      } else {
        w.play()
      }
    })
  }

  function next() {
    const w = widgetRef.current
    if (!w) return
    userPlayedRef.current = true
    w.next()
    setTimeout(() => w.play(), 120)
  }

  function prev() {
    const w = widgetRef.current
    if (!w) return
    userPlayedRef.current = true
    w.prev()
    setTimeout(() => w.play(), 120)
  }

  function playIndex(index: number) {
    const w = widgetRef.current
    if (!w) return
    userPlayedRef.current = true
    setCurrentIndex(index)
    setIsPlaying(true)
    try {
      w.skip(index)
      w.play()
    } catch {
      // Fallback ancien widget
      w.load(PLAYLIST_URL, {
        auto_play: true,
        hide_related: true,
        show_comments: false,
        show_user: false,
        show_reposts: false,
        show_teaser: false,
        playlistIndex: index,
      })
    }
  }

  function handleProgressClick(e: React.MouseEvent<HTMLDivElement>) {
    const w = widgetRef.current
    if (!w || !durationMs) return
    const rect = e.currentTarget.getBoundingClientRect()
    const pct = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
    w.seekTo(pct * durationMs)
  }

  function handleOpenVault() {
    setVaultOpen(true)
  }

  const displayTitle = formatTrackDisplay(currentTitle || tracks[currentIndex]?.title || '')
  const coverUrl = getCover(tracks[currentIndex])
  const progress = durationMs > 0 ? (positionMs / durationMs) * 100 : 0

  return (
    <>
      {/* Iframe SoundCloud cache — pilote l'audio via Widget API */}
      <iframe
        ref={iframeRef}
        title="SoundCloud Widget (hidden)"
        aria-hidden="true"
        style={{
          position: 'absolute',
          width: 300,
          height: 166,
          opacity: 0,
          pointerEvents: 'none',
          left: -9999,
          top: -9999,
        }}
        allow="autoplay"
        src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(PLAYLIST_URL)}&color=%23ffffff&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false`}
      />

      {/* Floating Pill — Liquid Glass premium 2026, seekbar inline flex-1 au centre */}
      <div
        role="region"
        aria-label={a.audioPlayer}
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
        }}
        className={cn(
          'bottom-4 md:bottom-6',
          // Le lecteur Radar (extraits iTunes) occupe le bas de l'ecran quand
          // il est ouvert : la pilule remonte pour ne pas etre recouverte.
          '[.radar-audio-open_&]:bottom-[76px] md:[.radar-audio-open_&]:bottom-[84px]',
          'w-[95%] max-w-3xl',
          'rounded-full',
          'bg-black/20 backdrop-blur-2xl',
          'border border-white/10',
          'shadow-[0_10px_40px_rgba(0,0,0,0.5)]',
        )}
      >
        {/* Single row : [Cover + Title] | seekbar flex-1 | [Time + Controls] */}
        <div className="flex flex-row items-center pl-2 sm:pl-3 pr-2 sm:pr-3 py-2">
          {/* === LEFT BLOCK : Cover + Track Info === */}
          <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-shrink">
            {/* Cover mini */}
            <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden flex-shrink-0 bg-black/40 border border-white/10">
              {coverUrl ? (
                <img src={coverUrl} alt="" className="w-full h-full object-cover" />
              ) : (
                <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5" />
              )}
            </div>

            {/* Track title + artist — SF Pro Rounded, font-extrabold, uppercase, text-sm */}
            <div className="min-w-0 max-w-[140px] sm:max-w-[200px] md:max-w-[240px]">
              <div
                className="font-rounded text-[14px] font-extrabold uppercase text-white truncate leading-tight [text-shadow:_0_1px_3px_rgba(0,0,0,0.4)]"
                title={displayTitle}
              >
                {displayTitle || a.loading}
              </div>
              <div className="font-rounded text-[14px] font-extrabold uppercase text-white/65 truncate leading-tight mt-0.5">
                Maudite Machine
              </div>
            </div>
          </div>

          {/* === MIDDLE : Seekbar flex-1, toujours visible === */}
          <div
            className="flex-1 mx-4 md:mx-6 h-1.5 bg-white/20 rounded-full relative overflow-hidden cursor-pointer hover:h-2 transition-all duration-200"
            onClick={handleProgressClick}
            role="slider"
            aria-label={a.trackProgress}
            aria-valuemin={0}
            aria-valuemax={durationMs || 100}
            aria-valuenow={positionMs}
          >
            <div
              className="absolute top-0 left-0 h-full bg-white rounded-full transition-all duration-100 ease-linear"
              style={{
                width: `${durationMs > 0 ? (positionMs / durationMs) * 100 : 0}%`,
              }}
            />
          </div>

          {/* === RIGHT BLOCK : Chrono + Controls === */}
          <div className="flex items-center gap-1.5 sm:gap-2 flex-shrink-0">
            {/* Time (desktop only) */}
            <div className="hidden md:block text-xs text-white/70 tabular-nums font-body mr-1 [text-shadow:_0_1px_3px_rgba(0,0,0,0.4)]">
              {formatMs(positionMs)} / {formatMs(durationMs)}
            </div>

            {/* Prev — desktop only */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={prev}
              aria-label={a.previousTrack}
              className={cn(
                'hidden sm:flex items-center justify-center',
                'w-10 h-10 rounded-full',
                'bg-white/5 border border-white/10 text-white',
                'hover:bg-white/15',
                'transition-all duration-300',
              )}
            >
              <IconPrev />
            </motion.button>

            {/* Play / Pause central plus gros */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Play'}
              className={cn(
                'flex items-center justify-center',
                'w-12 h-12 rounded-full',
                'bg-white/5 border border-white/10 text-white',
                'hover:bg-white/15',
                'transition-all duration-300',
              )}
            >
              {isPlaying ? <IconPause /> : <IconPlay />}
            </motion.button>

            {/* Next — desktop only */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={next}
              aria-label={a.nextTrack}
              className={cn(
                'hidden sm:flex items-center justify-center',
                'w-10 h-10 rounded-full',
                'bg-white/5 border border-white/10 text-white',
                'hover:bg-white/15',
                'transition-all duration-300',
              )}
            >
              <IconNext />
            </motion.button>

            {/* Vault / Playlist */}
            <motion.button
              type="button"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
              onClick={handleOpenVault}
              aria-label={a.openPlaylist}
              aria-expanded={vaultOpen}
              className={cn(
                'flex items-center justify-center',
                'w-10 h-10 rounded-full',
                'bg-white/5 border border-white/10 text-white',
                'hover:bg-white/15',
                'transition-all duration-300',
              )}
            >
              <IconPlaylist />
            </motion.button>
          </div>
        </div>
      </div>

      {/* VaultPanel — playlist fullscreen (portal) */}
      <VaultPanel
        isOpen={vaultOpen}
        onClose={() => setVaultOpen(false)}
        tracks={tracks}
        currentIndex={currentIndex}
        isPlaying={isPlaying}
        onPlay={playIndex}
        onTogglePlay={togglePlay}
      />
    </>
  )
}
