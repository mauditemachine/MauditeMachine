/**
 * VaultPanel — playlist fullscreen overlay Pro Max.
 *
 * - Overlay fullscreen bg-glass-strong + blur-heavy + saturate 0.6
 * - Grille 1 col (mobile) / 2 col (desktop) des morceaux
 * - Chaque morceau = GlassCard miniature (cover + titre + duree)
 * - Stagger entry via CSS animation-delay
 * - Morceau actif : border-glow + indicateur animé
 * - Clic → onPlay(index) OU togglePlay si deja courant
 * - Ferme via X, ESC, ou clic sur backdrop
 * - Scroll lock body
 */

import React, { useEffect } from 'react'
import { createPortal } from 'react-dom'
import { cn } from '../../lib/cn'
import { useTranslation } from '../../lib/i18n'

type Sound = {
  id: number
  title: string
  artwork_url?: string | null
  duration?: number
  user?: { avatar_url?: string | null }
}

interface VaultPanelProps {
  isOpen: boolean
  onClose: () => void
  tracks: Sound[]
  currentIndex: number
  isPlaying: boolean
  onPlay: (index: number) => void
  onTogglePlay: () => void
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

// Indicateur "en lecture" : 3 barres animees. Label via prop pour i18n.
const PlayingIndicator = ({ label }: { label: string }) => (
  <div className="flex items-end gap-[2px] h-4" aria-label={label}>
    <span className="block w-[3px] bg-ink-95 rounded-sm animate-[vault-bar1_0.9s_ease-in-out_infinite]" style={{ height: '60%' }} />
    <span className="block w-[3px] bg-ink-95 rounded-sm animate-[vault-bar2_1.1s_ease-in-out_infinite]" style={{ height: '100%' }} />
    <span className="block w-[3px] bg-ink-95 rounded-sm animate-[vault-bar3_0.8s_ease-in-out_infinite]" style={{ height: '70%' }} />
  </div>
)

const IconClose = () => (
  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
    <path d="M6 6l12 12M18 6L6 18" />
  </svg>
)

const IconPlay = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M8 5v14l11-7z" /></svg>
)

const IconPause = () => (
  <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor"><path d="M6 5h4v14H6zM14 5h4v14h-4z" /></svg>
)

const VaultPanel: React.FC<VaultPanelProps> = ({
  isOpen,
  onClose,
  tracks,
  currentIndex,
  isPlaying,
  onPlay,
  onTogglePlay,
}) => {
  const { t } = useTranslation()
  const a = t.a11y
  // Scroll lock
  useEffect(() => {
    if (!isOpen) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [isOpen])

  // ESC ferme
  useEffect(() => {
    if (!isOpen) return
    const handle = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', handle)
    return () => window.removeEventListener('keydown', handle)
  }, [isOpen, onClose])

  if (!isOpen) return null

  const handleCardClick = (i: number) => {
    if (i === currentIndex) {
      onTogglePlay()
    } else {
      onPlay(i)
    }
  }

  return createPortal(
    <div
      role="dialog"
      aria-modal="true"
      aria-label={a.playlist}
      onClick={(e) => { if (e.target === e.currentTarget) onClose() }}
      style={{ position: 'fixed', inset: 0, zIndex: 1200 }}
      className={cn(
        'bg-glass-strong backdrop-blur-heavy backdrop-saturate-glass',
        'overflow-y-auto',
        'animate-[vault-fade_0.35s_cubic-bezier(0.19,1,0.22,1)_both]',
      )}
    >
      {/* Close button */}
      <button
        type="button"
        onClick={onClose}
        aria-label={a.closePlaylist}
        className={cn(
          'fixed top-4 right-4 z-[1201]',
          'w-11 h-11 rounded-full',
          'flex items-center justify-center',
          'bg-glass backdrop-blur-glass backdrop-saturate-glass',
          'border border-ink-15 shadow-glass',
          'text-ink-95 hover:text-ink-95 hover:bg-ink-15',
          'transition-all duration-250 ease-out-expo active:scale-95',
        )}
      >
        <IconClose />
      </button>

      {/* Content */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 md:px-8 py-14 md:py-20 pb-32">
        {/* Header */}
        <div className="mb-10 md:mb-14 text-center animate-[vault-fade-up_0.55s_cubic-bezier(0.19,1,0.22,1)_both]">
          <div className="text-sm md:text-sm uppercase tracking-[0.4em] text-ink-50 mb-3 font-body">
            Playlist · {tracks.length} tracks
          </div>
          <h2 className="text-4xl md:text-6xl font-black uppercase tracking-tight text-ink-95 font-body leading-none">
            The Vault
          </h2>
        </div>

        {/* Grille 1 / 2 cols */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3 md:gap-4">
          {tracks.map((t, i) => {
            const cover = getCover(t)
            const active = i === currentIndex
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => handleCardClick(i)}
                style={{
                  animationDelay: `${180 + i * 35}ms`,
                  animationFillMode: 'both',
                }}
                className={cn(
                  'group relative flex items-center gap-3 md:gap-4',
                  'w-full text-left rounded-2xl',
                  'p-2.5 md:p-3',
                  'bg-glass backdrop-blur-glass backdrop-saturate-glass',
                  'border transition-all duration-300 ease-out-expo',
                  'animate-[vault-fade-up_0.5s_cubic-bezier(0.19,1,0.22,1)_both]',
                  active
                    ? 'border-ink-30 shadow-glow-white-soft bg-ink-5'
                    : 'border-ink-8 hover:border-ink-20 hover:shadow-glow-white-soft',
                )}
                aria-label={`Lire ${formatTrackDisplay(t.title)}`}
                aria-current={active ? 'true' : undefined}
              >
                {/* Cover */}
                <div className="relative w-14 h-14 md:w-16 md:h-16 rounded-lg overflow-hidden flex-shrink-0 bg-black/40">
                  {cover ? (
                    <img
                      src={cover}
                      alt=""
                      loading="lazy"
                      className={cn(
                        'w-full h-full object-cover',
                        'transition-transform duration-500 ease-out-expo',
                        !active && 'group-hover:scale-110',
                      )}
                    />
                  ) : (
                    <div className="w-full h-full bg-gradient-to-br from-ink-15 to-ink-5" />
                  )}
                  {/* Play overlay au hover (si pas actif) */}
                  {!active && (
                    <div className={cn(
                      'absolute inset-0 flex items-center justify-center',
                      'bg-black/40 opacity-0 group-hover:opacity-100',
                      'transition-opacity duration-200',
                    )}>
                      <IconPlay />
                    </div>
                  )}
                  {/* Indicateur playing si actif + en lecture */}
                  {active && isPlaying && (
                    <div className="absolute inset-0 flex items-center justify-center bg-black/50">
                      <PlayingIndicator label={a.nowPlaying} />
                    </div>
                  )}
                  {/* Icon pause au hover si actif et en lecture */}
                  {active && (
                    <div className={cn(
                      'absolute inset-0 flex items-center justify-center',
                      'bg-black/60 opacity-0 group-hover:opacity-100',
                      'transition-opacity duration-200',
                    )}>
                      {isPlaying ? <IconPause /> : <IconPlay />}
                    </div>
                  )}
                </div>

                {/* Track info */}
                <div className="flex-1 min-w-0">
                  <div
                    className={cn(
                      'font-body text-sm md:text-base font-semibold truncate',
                      active ? 'text-ink-95' : 'text-ink-85',
                    )}
                    title={formatTrackDisplay(t.title)}
                  >
                    {formatTrackDisplay(t.title)}
                  </div>
                  <div className="text-sm md:text-sm text-ink-50 uppercase tracking-[0.2em] font-body mt-0.5">
                    Maudite Machine
                  </div>
                </div>

                {/* Duree */}
                <div className="text-sm md:text-sm text-ink-70 tabular-nums font-body flex-shrink-0 pr-1">
                  {formatMs(t.duration)}
                </div>
              </button>
            )
          })}
        </div>

        {/* Empty state */}
        {tracks.length === 0 && (
          <div className="text-center text-ink-50 font-body py-16">
            Chargement des morceaux…
          </div>
        )}
      </div>

      {/* Keyframes locales (Tailwind ne peut pas les nommer dynamically) */}
      <style>{`
        @keyframes vault-fade {
          from { opacity: 0; }
          to { opacity: 1; }
        }
        @keyframes vault-fade-up {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes vault-bar1 {
          0%, 100% { height: 30%; }
          50% { height: 90%; }
        }
        @keyframes vault-bar2 {
          0%, 100% { height: 90%; }
          50% { height: 40%; }
        }
        @keyframes vault-bar3 {
          0%, 100% { height: 50%; }
          50% { height: 100%; }
        }
      `}</style>
    </div>,
    document.body,
  )
}

export default VaultPanel
