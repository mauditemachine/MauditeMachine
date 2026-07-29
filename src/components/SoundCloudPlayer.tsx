/**
 * SoundCloudPlayer — pilule "mes tracks", devenue un simple RACCOURCI vers
 * le lecteur global (PlayerContext).
 *
 * Avant : lecteur complet autonome (widget dedie, seekbar, popover).
 * Maintenant : la pilule affiche la playlist du site et son bouton play
 * envoie les tracks (URLs SoundCloud -> versions completes, badge
 * "Complet - SoundCloud") dans la file du lecteur global. Elle disparait
 * tant que la barre est visible et revient quand on la ferme.
 *
 * Elle garde deux responsabilites historiques :
 * - lire la playlist via le widget partage (scGetSetTracks, aucune cle)
 * - synchroniser le fond video du site avec la pochette de la track en
 *   cours (onBackgroundChange), comme avant.
 *
 * Piege du repo : position fixed en style inline (.page > * l'ecrase).
 */

import { useEffect, useMemo, useState } from 'react'
import { scGetSetTracks, type ScSetTrack } from '../utils/scWidget'
import { usePlayer } from '../context/PlayerContext'
import { useTranslation } from '../lib/i18n'

const PLAYLIST_URL = 'https://soundcloud.com/mauditemachine/sets/tracks-1'

function getHiRes(url?: string | null): string | null {
  if (!url) return null
  return url.replace('-large', '-t500x500')
}

function formatTrackDisplay(title: string): string {
  if (!title) return ''
  return title.replace(/^Maudite Machine\s*[-–—]\s*/i, '').replace(/\s*\([^)]*\)\s*$/g, '').trim()
}

const IconPlay = () => (
  <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
    <path d="M8 5v14l11-7z" />
  </svg>
)

interface SoundCloudPlayerProps {
  onBackgroundChange?: (url: string) => void
}

export default function SoundCloudPlayer({ onBackgroundChange }: SoundCloudPlayerProps): JSX.Element | null {
  const { t } = useTranslation()
  const player = usePlayer()
  const [tracks, setTracks] = useState<ScSetTrack[] | null>(null)
  const [starting, setStarting] = useState(false)

  // Metadonnees de la playlist (titres + covers), sans lancer la lecture
  useEffect(() => {
    let cancelled = false
    scGetSetTracks(PLAYLIST_URL)
      .then((list) => {
        if (!cancelled) setTracks(list)
      })
      .catch(() => {
        if (!cancelled) setTracks([])
      })
    return () => {
      cancelled = true
    }
  }, [])

  // Fond video synchronise avec la track du lecteur global quand c'est une
  // des miennes (comportement historique de la pilule, conserve).
  useEffect(() => {
    if (!player.current || !tracks || !onBackgroundChange) return
    const mine = tracks.find((tr) => tr.title === player.current!.title)
    const cover = mine ? getHiRes(mine.artworkUrl) : null
    if (cover) onBackgroundChange(cover)
  }, [player.current, tracks, onBackgroundChange])

  const coverUrl = useMemo(() => (tracks && tracks[0] ? getHiRes(tracks[0].artworkUrl) : null), [tracks])

  // La barre globale est ouverte : la pilule s'efface (un seul lecteur visible)
  if (player.current) return null

  const startMyTracks = async () => {
    if (starting) return
    setStarting(true)
    try {
      const list = tracks && tracks.length > 0 ? tracks : await scGetSetTracks(PLAYLIST_URL)
      if (!list.length) {
        window.open(PLAYLIST_URL, '_blank', 'noopener')
        return
      }
      await player.playQueue(
        list.map((tr) => ({
          title: tr.title,
          artist: tr.artist,
          soundcloudUrl: tr.permalinkUrl,
          link: tr.permalinkUrl,
        })),
        0,
      )
    } finally {
      setStarting(false)
    }
  }

  const displayTitle = formatTrackDisplay(tracks?.[0]?.title || '') || 'Maudite Machine'

  return (
    <div
      role="region"
      aria-label="Maudite Machine"
      style={{
        position: 'fixed',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 50,
      }}
      className="bottom-4 md:bottom-6 rounded-full bg-black/20 backdrop-blur-2xl border border-white/10 shadow-[0_10px_40px_rgba(0,0,0,0.5)]"
    >
      <div className="flex flex-row items-center gap-2 sm:gap-3 pl-2 sm:pl-3 pr-2 py-2">
        <div className="w-10 h-10 sm:w-11 sm:h-11 rounded-full overflow-hidden flex-shrink-0 bg-black/40 border border-white/10">
          {coverUrl ? (
            <img src={coverUrl} alt="" className="w-full h-full object-cover" />
          ) : (
            <div className="w-full h-full bg-gradient-to-br from-white/10 to-white/5" />
          )}
        </div>

        <div className="min-w-0 max-w-[160px] sm:max-w-[240px]">
          <div className="font-rounded text-[14px] font-extrabold uppercase text-white truncate leading-tight [text-shadow:_0_1px_3px_rgba(0,0,0,0.4)]">
            {displayTitle}
          </div>
          <div className="font-rounded text-[14px] font-extrabold uppercase text-white/65 truncate leading-tight mt-0.5">
            Maudite Machine
          </div>
        </div>

        <button
          type="button"
          onClick={startMyTracks}
          aria-label={t.radar.listen}
          className="flex-shrink-0 w-11 h-11 rounded-full bg-white text-black border-0 cursor-pointer flex items-center justify-center hover:scale-105 transition-transform"
        >
          {starting ? (
            <span className="inline-block w-4 h-4 rounded-full border-2 border-black/20 border-t-black animate-spin" aria-hidden="true" />
          ) : (
            <IconPlay />
          )}
        </button>
      </div>
    </div>
  )
}
