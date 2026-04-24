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
  if (!ms && ms !== 0) return '—:—'
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
          const newIndex = i || 0
          if (newIndex !== lastIndexRef.current) {
            lastIndexRef.current = newIndex
            setCurrentIndex(newIndex)
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

  // Actions
  function togglePlay() {
    const w = widgetRef.current
    if (!w) return
    w.isPaused((paused: boolean) => {
      if (paused) w.play()
      else w.pause()
    })
  }

  function next() {
    const w = widgetRef.current
    if (!w) return
    w.next()
    setTimeout(() => w.play(), 120)
  }

  function prev() {
    const w = widgetRef.current
    if (!w) return
    w.prev()
    setTimeout(() => w.play(), 120)
  }

  function playIndex(index: number) {
    const w = widgetRef.current
    if (!w) return
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

      {/* Floating Pill — player flottant Pro Max */}
      <div
        role="region"
        aria-label="Lecteur audio"
        style={{
          position: 'fixed',
          left: '50%',
          transform: 'translateX(-50%)',
          zIndex: 50,
        }}
        className={cn(
          'bottom-4 md:bottom-6',
          'w-[95%] max-w-3xl',
          'rounded-full overflow-hidden',
          'bg-black/40 backdrop-blur-xl',
          'border border-white/10',
          'shadow-2xl shadow-black/50',
        )}
      >
        {/* Progress bar 2px en haut de la pill (suit la courbe rounded-full) */}
        <div
          className="relative h-[2px] bg-white/10 cursor-pointer group hover:h-[3px] transition-[height] duration-200"
          onClick={handleProgressClick}
          role="slider"
          aria-label="Progression du morceau"
          aria-valuemin={0}
          aria-valuemax={durationMs}
          aria-valuenow={positionMs}
        >
          <div
            className="absolute inset-y-0 left-0 bg-white/90"
            style={{ width: `${progress}%`, transition: 'width 120ms linear' }}
          />
        </div>

        {/* Controls row */}
        <div className="flex items-center gap-2 sm:gap-3 pl-2 sm:pl-3 pr-3 sm:pr-4 py-2">
          {/* Cover mini */}
          <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden flex-shrink-0 bg-black/40 border border-white/10">
            {coverUrl ? (
              <img src={coverUrl} alt="" className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5" />
            )}
          </div>

          {/* Track info : title + Maudite Machine */}
          <div className="min-w-0 flex-1">
            <div
              className="text-sm sm:text-[15px] font-semibold text-white truncate font-body [text-shadow:_0_1px_3px_rgba(0,0,0,0.4)]"
              title={displayTitle}
            >
              {displayTitle || 'Loading…'}
            </div>
            <div className="text-sm sm:text-sm text-white/60 uppercase tracking-[0.2em] font-body">
              Maudite Machine
            </div>
          </div>

          {/* Time (hidden sur petit ecran) */}
          <div className="hidden md:block text-sm text-white/70 tabular-nums font-body flex-shrink-0 [text-shadow:_0_1px_3px_rgba(0,0,0,0.4)]">
            {formatMs(positionMs)} / {formatMs(durationMs)}
          </div>

          {/* Controls : prev / play / next */}
          <div className="flex items-center gap-1 sm:gap-1.5 flex-shrink-0">
            <motion.button
              type="button"
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.92 }}
              onClick={prev}
              aria-label="Morceau precedent"
              className={cn(
                'hidden sm:flex items-center justify-center',
                'w-9 h-9 rounded-full',
                'bg-transparent text-white/80',
                'hover:text-white hover:bg-white/10',
                'transition-colors duration-200',
              )}
            >
              <IconPrev />
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.08 }}
              whileTap={{ scale: 0.94 }}
              onClick={togglePlay}
              aria-label={isPlaying ? 'Pause' : 'Lecture'}
              className={cn(
                'flex items-center justify-center',
                'w-10 h-10 sm:w-11 sm:h-11 rounded-full',
                'bg-white/15 border border-white/20 text-white',
                'hover:bg-white/25 hover:border-white/50 hover:shadow-[0_0_24px_rgba(255,255,255,0.25)]',
                'transition-all duration-250 ease-out-expo',
              )}
            >
              {isPlaying ? <IconPause /> : <IconPlay />}
            </motion.button>

            <motion.button
              type="button"
              whileHover={{ scale: 1.12 }}
              whileTap={{ scale: 0.92 }}
              onClick={next}
              aria-label="Morceau suivant"
              className={cn(
                'hidden sm:flex items-center justify-center',
                'w-9 h-9 rounded-full',
                'bg-transparent text-white/80',
                'hover:text-white hover:bg-white/10',
                'transition-colors duration-200',
              )}
            >
              <IconNext />
            </motion.button>
          </div>

          {/* Vault button */}
          <motion.button
            type="button"
            whileHover={{ scale: 1.08 }}
            whileTap={{ scale: 0.94 }}
            onClick={handleOpenVault}
            aria-label="Ouvrir la playlist"
            aria-expanded={vaultOpen}
            className={cn(
              'flex items-center justify-center flex-shrink-0',
              'w-9 h-9 rounded-full',
              'bg-white/8 border border-white/15 text-white/80',
              'hover:bg-white/15 hover:border-white/30 hover:text-white',
              'transition-all duration-250 ease-out-expo',
            )}
          >
            <IconPlaylist />
          </motion.button>
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
