import React, { useEffect, useRef, useState } from 'react'

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
  const [isPlaying, setIsPlaying] = useState(false)
  const [currentIndex, setCurrentIndex] = useState<number>(0)
  const [positionMs, setPositionMs] = useState(0)
  const [durationMs, setDurationMs] = useState(0)
  // Affiche 5 pistes par défaut, puis "Load more" pour le reste
  const [showAll, setShowAll] = useState(false)
  const titleRef = useRef<HTMLDivElement | null>(null)
  const lastIndexRef = useRef<number>(-1)

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
        const poll = () => {
          widget.getSounds((sounds: Sound[]) => {
            if (cancelled) return
            const list = sounds || []
            const count = list.length
            setTracks(list)
            tries += 1
            if (count > lastCount) {
              lastCount = count
              stable = 0
            } else {
              stable += 1
            }
            if (tries < 60 && stable < 3) {
              setTimeout(poll, 250)
            }
          })
        }
        poll()
      }

      // Fonction pour vérifier et mettre à jour l'index current
      const checkCurrentTrack = () => {
        if (cancelled) return
        widget.getCurrentSoundIndex((i: number) => {
          const safeIndex = i || 0
          if (safeIndex !== lastIndexRef.current) {
            console.log(`Track changed: ${lastIndexRef.current} → ${safeIndex}`)
            lastIndexRef.current = safeIndex
            setCurrentIndex(safeIndex)
            maybeSwapBackground(safeIndex)
          }
        })
      }

      widget.bind(window.SC.Widget.Events.READY, tryFetchAll)
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
        }
      }, 500) // Vérifier toutes les 500ms (plus agressif)

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
    const title = (t.title || '').toLowerCase()
    let url = '/images/Simetra.webp'
    if (title.includes('autopsynth')) url = '/images/Autopsynth.webp'
    else if (title.includes('coagule')) url = '/images/Coagule.webp'
    else if (title.includes('where is the sync button')) url = '/images/Where.webp'
    else if (title.includes('kouklikou')) url = '/images/Kouklikou.webp'
    else if (title.includes('discowriders')) url = '/images/Discowriders.webp'
    else if (title.includes('drama queen')) url = '/images/Drama Queen 1.webp'
    else if (title.includes('crush on you') || title.includes('tati cardi')) url = '/images/Tati Cardi.webp'
    else if (title.includes('nocturne')) url = '/images/Nocturne.webp'
    else if (title.includes('back on track')) url = '/images/BackOnTrack.webp'
    else if (title.includes('richie')) url = '/images/Richie.webp'
    else if (title.includes('anarchic') || title.includes('anarchic')) url = '/images/Anarchic.webp'
    onBackgroundChange(encodeURI(url))
  }

  function playIndex(index: number) {
    const widget = widgetRef.current
    if (!widget) return
    // Passer directement à l'index demandé puis jouer
    try {
      widget.skip(index)
      widget.play()
      maybeSwapBackground(index)
    } catch {
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
        playlistIndex: index
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

  function next() { widgetRef.current?.next() }
  function prev() { widgetRef.current?.prev() }

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

  // Ajuste dynamiquement la taille du titre pour tenir sur une ligne (desktop)
  useEffect(() => {
    const el = titleRef.current
    if (!el) return
    const base = 22
    const min = 12
    function fit() {
      if (!el) return
      el.style.fontSize = base + 'px'
      // force mesure après reflow
      // eslint-disable-next-line @typescript-eslint/no-unused-expressions
      el.offsetWidth
      let size = base
      while (el.scrollWidth > el.clientWidth && size > min) {
        size -= 1
        el.style.fontSize = size + 'px'
      }
    }
    const ro = new ResizeObserver(fit)
    ro.observe(el)
    fit()
    window.addEventListener('resize', fit)
    return () => { ro.disconnect(); window.removeEventListener('resize', fit) }
  }, [currentIndex, tracks])

  return (
    <div className="sc-player">
      <div className="sc-now">
        {getCover(tracks[currentIndex] || ({} as any)) && (
          <img className="now-cover" src={getCover(tracks[currentIndex] as any) as any} alt="cover" />
        )}
        <div className="now-right">
          <div ref={titleRef} className="now-title">{tracks[currentIndex]?.title || ''}</div>
          <div className="now-row">
            <input
              className="now-range"
              type="range"
              min={0}
              max={Math.max(1, durationMs)}
              value={Math.min(positionMs, durationMs)}
              onChange={(e) => widgetRef.current?.seekTo(Number(e.target.value))}
            />
            <button className="now-toggle" onClick={togglePlay} aria-label="Lecture/Pause">{isPlaying ? '⏸' : '▶'}</button>
          </div>
          <div className="now-desc">{tracks[currentIndex]?.description || tracks[currentIndex]?.user?.username || ''}</div>
        </div>
      </div>

      <ul className="sc-list">
        {(
          showAll || tracks.length <= 12
            ? tracks
            : tracks.slice(0, 12)
        ).map((t, i) => (
          <li
            key={t.id}
            className={`sc-row ${i === currentIndex ? 'active' : ''}`}
            onClick={() => playOrToggle(i)}
          >
            <span className="row-title">{t.title}</span>
            <span className="row-time">{formatMs(t.duration)}</span>
          </li>
        ))}
      </ul>
      {tracks.length > 12 && !showAll && (
        <button className="sc-loadmore" onClick={() => setShowAll(true)}>Load more…</button>
      )}

      {/* Iframe SoundCloud caché, sert uniquement au playback via l'API */}
      <iframe
        ref={iframeRef}
        title="SC Widget"
        style={{ position: 'absolute', width: 0, height: 0, opacity: 0, pointerEvents: 'none' }}
        allow="autoplay"
        src={`https://w.soundcloud.com/player/?url=${encodeURIComponent(playlistUrl)}&color=%23102b47&auto_play=false&hide_related=true&show_comments=false&show_user=false&show_reposts=false&show_teaser=false`}
      />
    </div>
  )
}


