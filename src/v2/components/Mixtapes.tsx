/**
 * Mixtapes /v2 : sets SoundCloud en liste compacte coherente avec la
 * matrice discographie. La ligne se joue SUR LE SITE dans le player
 * sticky (moteur widget SoundCloud, comme la discographie) ; l icone a
 * droite reste le lien vers SoundCloud. 6 affichees par defaut
 * (featured dans mixtapes.json, editable), Show all pour le reste.
 */

import React, { useMemo, useState } from 'react';
import { useAudioPlayer, type V2Track } from '../context/AudioPlayerContext';
import mixtapesData from '../data/mixtapes.json';

interface Mixtape {
  title: string;
  number: number;
  year: number;
  duration: string;
  soundcloudUrl: string;
  artwork: string | null;
  featured: boolean;
}

const DATA = mixtapesData as { profileUrl: string; mixtapes: Mixtape[] };
const ALL = [...DATA.mixtapes].sort((a, b) => b.number - a.number);

/** Une mixtape est une piste comme une autre pour le player sticky. */
const toTrack = (m: Mixtape): V2Track => ({
  id: `mix-${m.number}`,
  title: `Mixtape ${m.number}`,
  project: m.title,
  artist: 'Maudite Machine',
  role: 'DJ set',
  year: m.year,
  category: 'originals',
  soundcloudUrl: m.soundcloudUrl,
  link: m.soundcloudUrl,
});

const Mixtapes: React.FC = () => {
  const [showAll, setShowAll] = useState(false);
  const { current, playing, play } = useAudioPlayer();

  const visible = useMemo(() => (showAll ? ALL : ALL.filter((m) => m.featured)), [showAll]);
  const hiddenCount = ALL.length - visible.length;
  // La file suit ce que voit le visiteur : enchainement mixtape apres mixtape
  const queue = useMemo(() => visible.map(toTrack), [visible]);

  return (
    <section className="v2-section" id="mixtapes">
      <div className="v2-section-head">
        <h2 className="v2-section-title"><span className="v2-section-num">02</span>Mixtapes</h2>
        <a
          className="v2-label v2-mix-profile"
          href={DATA.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Full sets on SoundCloud ↗
        </a>
      </div>

      <p className="v2-section-intro">
        Long-form sets recorded through the years. Deep, patient selections
        that go where a club night goes, two hours at a time.
      </p>

      <div className="v2-mixes" role="list">
        {visible.map((m, i) => {
          const isExpanded = showAll && !m.featured;
          const track = toTrack(m);
          const isCurrent = current?.id === track.id;
          return (
            <div
              key={m.number}
              className={`v2-mix-row is-clickable${isCurrent ? ' is-playing' : ''}${isExpanded ? ' v2-row-in' : ''}`}
              style={isExpanded ? { animationDelay: `${Math.min(i * 14, 260)}ms` } : undefined}
              role="listitem"
              onClick={() => play(track, queue)}
            >
              {m.artwork ? (
                <img
                  className="v2-mix-art"
                  src={m.artwork}
                  alt=""
                  loading="lazy"
                  decoding="async"
                  width={56}
                  height={56}
                />
              ) : (
                <span className="v2-mix-art v2-mix-art-empty" aria-hidden="true">
                  {m.number}
                </span>
              )}
              <span className="v2-mix-number v2-label">MX {m.number}</span>
              <span className="v2-mix-title">{m.title}</span>
              <span className="v2-label v2-mix-year">{m.year}</span>
              <span className="v2-label v2-mix-duration">{m.duration}</span>
              <span className="v2-mix-actions">
                <button
                  type="button"
                  className="v2-play-btn"
                  aria-label={
                    isCurrent && playing
                      ? `Mettre en pause la mixtape ${m.number}`
                      : `Ecouter la mixtape ${m.number}`
                  }
                  onClick={(e) => {
                    e.stopPropagation();
                    play(track, queue);
                  }}
                >
                  {isCurrent && playing ? (
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                      <rect x="2" y="2" width="4" height="12" fill="currentColor" />
                      <rect x="10" y="2" width="4" height="12" fill="currentColor" />
                    </svg>
                  ) : (
                    <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
                      <path d="M3 2l11 6-11 6z" fill="currentColor" />
                    </svg>
                  )}
                </button>
                <a
                  className="v2-link-btn"
                  href={m.soundcloudUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ouvrir la mixtape ${m.number} sur SoundCloud`}
                  onClick={(e) => e.stopPropagation()}
                >
                  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                    <path d="M6 3h7v7M13 3L7 9" stroke="currentColor" strokeWidth="1.6" fill="none" />
                    <path d="M11 9v4H3V5h4" stroke="currentColor" strokeWidth="1.4" fill="none" />
                  </svg>
                </a>
              </span>
            </div>
          );
        })}
      </div>

      {(hiddenCount > 0 || showAll) && (
        <button
          type="button"
          className="v2-showall"
          aria-expanded={showAll}
          onClick={() => setShowAll((s) => !s)}
        >
          {showAll ? 'Show less' : `Show all (${ALL.length})`}
        </button>
      )}
    </section>
  );
};

export default Mixtapes;
