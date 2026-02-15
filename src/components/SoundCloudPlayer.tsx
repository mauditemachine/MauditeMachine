import React, { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

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

export default function SoundCloudPlayer({ onBackgroundChange }: { onBackgroundChange?: (url: string) => void }): JSX.Element {
  const iframeRef = useRef<HTMLIFrameElement | null>(null)
  const widgetRef = useRef<any>(null)
  const [tracks, setTracks] = useState<Sound[]>([])
  const [originalTracks, setOriginalTracks] = useState<Sound[]>([]) // Garder l'ordre original de SoundCloud
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [currentTitle, setCurrentTitle] = useState<string>('') // Titre direct depuis le widget
  const [positionMs, setPositionMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  // Affiche toutes les pistes sur desktop, limité sur mobile
  const [showAll, setShowAll] = useState(window.innerWidth > 768)
  const titleRef = useRef<HTMLDivElement | null>(null)
  const lastIndexRef = useRef<number>(-1)
  const [detached, setDetached] = useState(false)
  const panelRef = useRef<HTMLDivElement | null>(null)

  // Gérer le redimensionnement de la fenêtre pour l'affichage des pistes
  useEffect(() => {
    const handleResize = () => {
      setShowAll(window.innerWidth > 768)
    }

    window.addEventListener('resize', handleResize)
    return () => window.removeEventListener('resize', handleResize)
  }, [])

  // Supprimer les erreurs SoundCloud de la console
  useEffect(() => {
    const originalError = console.error
    console.error = (...args) => {
      const message = args[0]?.toString() || ''
      // Filtrer les erreurs SoundCloud connues
      if (
        message.includes('createPattern') ||
        message.includes('canvas element with a width or height of 0') ||
        message.includes('widget-') ||
        message.includes('AbortError') ||
        message.includes('Script error')
      ) {
        return // Ignorer ces erreurs
      }
      originalError.apply(console, args)
    }

    return () => {
      console.error = originalError
    }
  }, [])

  // Utilise l'URL publique du set pour laisser SoundCloud résoudre le contenu complet
  const playlistUrl = 'https://soundcloud.com/mauditemachine/sets/tracks-1'

  useEffect(() => {
    let cancelled = false
    async function init() {
      await loadScriptOnce(SC_API_URL)
      if (cancelled || !iframeRef.current || !window.SC) return
      widgetRef.current = window.SC.Widget(iframeRef.current)

      const widget = widgetRef.current
      // Assure le chargement de la playlist dans le widget, même si l'iframe l'a déjà
      widget.load(playlistUrl, {
        auto_play: false,
        hide_related: true,
        show_comments: false,
        show_user: false,
        show_reposts: false,
        show_teaser: false,
        buying: false,
        liking: false,
        download: false,
        color: '#102b47'
      })

      const tryFetchAll = () => {
        // Récupère toutes les pistes; poll jusqu'à stabilisation du nombre
        let tries = 0
        let lastCount = -1
        let stable = 0
        let maxTracks = 0
        
        const poll = () => {
          widget.getSounds((sounds: Sound[]) => {
            if (cancelled) return
            const list = sounds || []
            const count = list.length
            
            // Mise à jour immédiate des tracks
            if (count > 0) {
              setOriginalTracks(list) // Garder l'ordre original pour SoundCloud
              setTracks(list) // Garder l'ordre normal de la playlist
              maxTracks = Math.max(maxTracks, count)
            }
            
            tries += 1
            // console.log(`🎵 Polling tracks: ${count} tracks loaded (attempt ${tries})`)
            
            if (count > lastCount) {
              lastCount = count
              stable = 0
            } else {
              stable += 1
            }
            
            // Conditions d'arrêt plus agressives :
            // - Plus de 100 tentatives OU
            // - 5 tentatives stables OU  
            // - On a au moins 10 tracks et c'est stable depuis 2 tentatives
            const shouldStop = tries >= 100 || 
                              stable >= 5 || 
                              (count >= 10 && stable >= 2)
            
            if (!shouldStop) {
              // Intervalle plus court pour un chargement plus rapide
              setTimeout(poll, 150)
            } else {
              // console.log(`✅ Finished loading ${count} tracks after ${tries} attempts`)
            }
          })
        }
        
        // Démarrer immédiatement
        poll()
      }

      // Fonction pour vérifier et mettre à jour l'index + titre courant
      const checkCurrentTrack = () => {
        if (cancelled) return
        widget.getCurrentSoundIndex((i: number) => {
          const newCurrentIndex = i || 0
          
          if (newCurrentIndex !== lastIndexRef.current) {
            lastIndexRef.current = newCurrentIndex
            setCurrentIndex(newCurrentIndex)
            maybeSwapBackground(newCurrentIndex)
          }
          
          // Toujours mettre à jour le titre depuis le widget (source de vérité)
          widget.getCurrentSound((sound: Sound) => {
            if (sound?.title) {
              setCurrentTitle(sound.title)
            }
          })
        })
      }

      widget.bind(window.SC.Widget.Events.READY, () => {
        // console.log('🎵 SoundCloud widget ready, starting track loading...')
        tryFetchAll()
      })
      
      widget.bind(window.SC.Widget.Events.PLAY, () => {
        setIsPlaying(true)
        if (tracks.length === 0) {
          tryFetchAll()
        }
        checkCurrentTrack()
        // FORCER LE BACKGROUND + TITRE QUAND ON JOUE
        widget.getCurrentSound((sound: Sound) => {
          if (sound) {
            if (sound.title) setCurrentTitle(sound.title)
            if (onBackgroundChange) {
              const cover = getHiRes(sound.artwork_url) || getHiRes(sound.user?.avatar_url || null)
              if (cover) onBackgroundChange(cover)
            }
          }
        })
      })
      
      // Fallback: essayer de charger après un délai même si READY ne se déclenche pas
      setTimeout(() => {
        if (!cancelled && tracks.length === 0) {
          // console.log('🎵 Fallback loading after 2 seconds...')
          tryFetchAll()
        }
      }, 2000)
      widget.bind(window.SC.Widget.Events.PAUSE, () => setIsPlaying(false))
      widget.bind(window.SC.Widget.Events.PLAY_PROGRESS, (e: any) => {
        setPositionMs(Math.floor(e?.currentPosition || 0))
        widget.getCurrentSound((sound: Sound) => setDurationMs(sound?.duration || 0))
        checkCurrentTrack()
        // FORCER LE BACKGROUND À CHAQUE PROGRESS
        widget.getCurrentSoundIndex((i: number) => {
          maybeSwapBackground(i || 0)
        })
      })
      
      // Événements pour changements de track automatiques
      widget.bind(window.SC.Widget.Events.LOAD_PROGRESS, checkCurrentTrack)
      widget.bind(window.SC.Widget.Events.SEEK, checkCurrentTrack)
      widget.bind(window.SC.Widget.Events.FINISH, () => {
        setIsPlaying(false)
        // Petit délai pour laisser SoundCloud passer à la track suivante
        setTimeout(checkCurrentTrack, 100)
      })

      // Polling agressif pour détecter les changements automatiques
      const pollInterval = setInterval(() => {
        if (!cancelled) {
          checkCurrentTrack()
          // Re-essayer de charger les tracks si on en a moins de 5
          if (tracks.length < 5) {
            tryFetchAll()
          }
        }
      }, 300) // Vérifier toutes les 300ms (encore plus agressif)

      return () => {
        cancelled = true
        clearInterval(pollInterval)
      }
    }
    init()
  }, [isPlaying])

  function formatMs(ms?: number): string {
    if (!ms && ms !== 0) return ''
    const total = Math.floor(ms / 1000)
    const m = Math.floor(total / 60)
    const s = (total % 60).toString().padStart(2, '0')
    return `${m}:${s}`
  }

  function getHiRes(url?: string | null): string | null {
    if (!url) return null
    // SoundCloud provides variants like -large, -t500x500
    return url.replace('-large', '-t500x500')
  }

  function getCover(sound: Sound): string | null {
    return (
      getHiRes(sound.artwork_url) ||
      getHiRes(sound.user?.avatar_url || null)
    )
  }

  function maybeSwapBackground(index: number) {
    const t = tracks[index]
    if (!t || !onBackgroundChange) return
    
    // Utiliser le cover art de la track directement depuis SoundCloud
    const cover = getCover(t)
    if (cover) {
      onBackgroundChange(cover)
      return
    }
    
    // Fallback: chercher par nom dans les images locales
    const title = (t.title || '').toLowerCase()
    let url = import.meta.env.BASE_URL + 'images/mixtape37.webp'
    if (title.includes('autopsynth')) url = import.meta.env.BASE_URL + 'images/Autopsynth.webp'
    else if (title.includes('coagule')) url = import.meta.env.BASE_URL + 'images/Coagule.webp'
    else if (title.includes('where is the sync button')) url = import.meta.env.BASE_URL + 'images/Where.webp'
    else if (title.includes('kouklikou')) url = import.meta.env.BASE_URL + 'images/Kouklikou.webp'
    else if (title.includes('discowriders')) url = import.meta.env.BASE_URL + 'images/Discowriders.webp'
    else if (title.includes('drama queen')) url = import.meta.env.BASE_URL + 'images/Drama Queen 1.webp'
    else if (title.includes('crush on you') || title.includes('tati cardi')) url = import.meta.env.BASE_URL + 'images/Tati Cardi.webp'
    else if (title.includes('nocturne')) url = import.meta.env.BASE_URL + 'images/Nocturne.webp'
    else if (title.includes('back on track')) url = import.meta.env.BASE_URL + 'images/BackOnTrack.webp'
    else if (title.includes('richie')) url = import.meta.env.BASE_URL + 'images/Richie.webp'
    else if (title.includes('anarchic')) url = import.meta.env.BASE_URL + 'images/Anarchic.webp'
    else if (title.includes('mixtape') || title.includes('37')) url = import.meta.env.BASE_URL + 'images/mixtape37.webp'
    
    onBackgroundChange(encodeURI(url))
  }

  function playIndex(index: number) {
    const widget = widgetRef.current
    if (!widget || !originalTracks.length) return
    
    // L'index affiché correspond maintenant directement à l'index réel
    const realIndex = index
    
    console.log(`🎵 Playing track: index ${index}`)
    console.log(`🎵 Track: ${tracks[index]?.title}`)
    
    // Mettre à jour immédiatement l'index courant pour le cover
    setCurrentIndex(index)
    setIsPlaying(true)
    
    // Passer directement à l'index puis jouer
    try {
      widget.skip(realIndex)
      widget.play()
      maybeSwapBackground(index) // Utiliser l'index pour le background
    } catch {
      console.log(`🎵 Skip failed, using load with playlistIndex: ${realIndex}`)
      // Fallback: si skip n'est pas dispo (ancien widget), on recharge et on joue
      widget.load(playlistUrl, {
        auto_play: true,
        hide_related: true,
        show_comments: false,
        show_user: false,
        show_reposts: false,
        show_teaser: false,
        buying: false,
        liking: false,
        download: false,
        color: '#102b47',
        playlistIndex: realIndex
      })
      maybeSwapBackground(index)
    }
  }

  function togglePlay() {
    if (!widgetRef.current) return
    widgetRef.current.isPaused((paused: boolean) => {
      if (paused) widgetRef.current.play()
      else widgetRef.current.pause()
    })
  }

  function next() {
    if (!widgetRef.current) return
    widgetRef.current.next()
    setTimeout(() => {
      widgetRef.current?.getCurrentSoundIndex((i: number) => {
        setCurrentIndex(i || 0)
        maybeSwapBackground(i || 0)
      })
      widgetRef.current?.getCurrentSound((sound: Sound) => {
        if (sound?.title) setCurrentTitle(sound.title)
      })
      widgetRef.current?.play()
    }, 200)
  }

  function prev() {
    if (!widgetRef.current) return
    widgetRef.current.prev()
    setTimeout(() => {
      widgetRef.current?.getCurrentSoundIndex((i: number) => {
        setCurrentIndex(i || 0)
        maybeSwapBackground(i || 0)
      })
      widgetRef.current?.getCurrentSound((sound: Sound) => {
        if (sound?.title) setCurrentTitle(sound.title)
      })
      widgetRef.current?.play()
    }, 200)
  }

  function playOrToggle(index: number) {
    if (!widgetRef.current) return
    widgetRef.current.getCurrentSoundIndex((i: number) => {
      if (i === index) {
        togglePlay()
      } else {
        playIndex(index)
      }
    })
  }

  function formatTrackDisplay(title: string): string {
    if (!title) return ''
    const clean = title.replace(/^Maudite Machine\s*[-–—]\s*/i, '').replace(/\s*\([^)]*\)\s*$/g, '').trim()
    return clean ? `Maudite Machine - ${clean} (Original Mix)` : ''
  }

  // Fermer le panneau si clic en dehors
  useEffect(() => {
    if (!detached) return
    const handleClickOutside = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        setDetached(false)
      }
    }
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [detached])

  // Utiliser le titre direct du widget (currentTitle) en priorité, fallback sur tracks[]
  const displayTitle = formatTrackDisplay(currentTitle || tracks[currentIndex]?.title || '')

  const coverUrl = getCover(tracks[currentIndex] || ({} as any))

  return (
    <div className="sc-player">
      <div className="sc-now">
        <div className="now-controls">
          <button className="now-nav" onClick={prev} aria-label="Précédent">⏮</button>
          <button className="now-toggle" onClick={togglePlay} aria-label="Lecture/Pause">{isPlaying ? '⏸' : '▶'}</button>
          <button className="now-nav" onClick={next} aria-label="Suivant">⏭</button>
          <input
            className="now-range"
            type="range"
            min={0}
            max={Math.max(1, durationMs)}
            value={Math.min(positionMs, durationMs)}
            onChange={(e) => widgetRef.current?.seekTo(Number(e.target.value))}
          />
          <span className="now-time">{formatMs(positionMs)} / {formatMs(durationMs)}</span>
          <button className="now-detach" onClick={() => setDetached(!detached)} aria-label="Playlist">
            {detached ? '✕' : '☰'}
          </button>
        </div>
        <div className="now-track-info">
          <div ref={titleRef} className="now-title" title={displayTitle}>
            <div className="now-title-marquee">
              <span>{displayTitle}</span>
              <span aria-hidden="true">{displayTitle}</span>
            </div>
          </div>
          {coverUrl && (
            <img className="now-cover" src={coverUrl} alt="cover" />
          )}
        </div>
      </div>

      {/* Panneau détaché — rendu via portal au root pour que backdrop-filter fonctionne */}
      {detached && createPortal(
        <div className="sc-detached-panel" ref={panelRef}>
          <button className="detached-close" onClick={() => setDetached(false)} aria-label="Fermer">✕</button>
          <div className="detached-now">
            {coverUrl && (
              <img className="detached-cover" src={coverUrl} alt="cover" />
            )}
            <div className="detached-info">
              <div className="detached-title">
                <div className="detached-title-marquee">
                  <span>{displayTitle}</span>
                  <span aria-hidden="true">{displayTitle}</span>
                </div>
              </div>
              <div className="detached-controls">
                <button className="detached-nav" onClick={prev}>⏮</button>
                <button className="detached-toggle" onClick={togglePlay}>{isPlaying ? '⏸' : '▶'}</button>
                <button className="detached-nav" onClick={next}>⏭</button>
              </div>
              <div className="detached-progress">
                <input
                  className="detached-range"
                  type="range"
                  min={0}
                  max={Math.max(1, durationMs)}
                  value={Math.min(positionMs, durationMs)}
                  onChange={(e) => widgetRef.current?.seekTo(Number(e.target.value))}
                />
                <span className="detached-time">{formatMs(positionMs)} / {formatMs(durationMs)}</span>
              </div>
            </div>
          </div>
          <ul className="detached-list">
            {tracks.map((t, i) => (
              <li
                key={t.id}
                className={`detached-row ${i === currentIndex ? 'active' : ''}`}
                onClick={() => playOrToggle(i)}
              >
                <span className="row-title">{formatTrackDisplay(t.title)}</span>
                <span className="row-time">{formatMs(t.duration)}</span>
              </li>
            ))}
          </ul>
        </div>,
        document.body
      )}

      <ul className="sc-list">
        {tracks.slice(0, 5).map((t, i) => (
          <li
            key={t.id}
            className={`sc-row ${i === currentIndex ? 'active' : ''}`}
            onClick={() => playOrToggle(i)}
          >
            <span className="row-title">{formatTrackDisplay(t.title)}</span>
            <span className="row-time">{formatMs(t.duration)}</span>
          </li>
        ))}
      </ul>

      {/* Iframe SoundCloud caché, sert uniquement au playback via l'API */}
      <iframe
        ref={iframeRef}
        title="SC Widget"
        style={{ position: 'absolute', width: '300px', height: '166px', opacity: 0, pointerEvents: 'none', left: '-9999px', top: '-9999px' }}
        allow="autoplay"
        src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(playlistUrl)}&color=%23102b47&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false&visual=false`}
      />
    </div>
  )
}


