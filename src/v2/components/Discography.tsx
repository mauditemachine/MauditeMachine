/**
 * Matrice discographie /v2 : table CSS Grid (Titre | Projet | Role | Annee |
 * Play | Link), filtres All / Originals / Remixes / VRSTL. Le clic play met
 * la liste FILTREE en file : next/prev suivent ce que l'utilisateur voit.
 * Donnees : src/v2/data/discography.json (placeholders en attendant les
 * credits finaux et les vrais MP3).
 */

import React, { useMemo, useState } from 'react';
import discographyData from '../data/discography.json';
import { useAudioPlayer, V2Track } from '../context/AudioPlayerContext';

type Filter = 'all' | 'originals' | 'remixes' | 'vrstl';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'originals', label: 'Originals' },
  { key: 'remixes', label: 'Remixes' },
  { key: 'vrstl', label: 'VRSTL' },
];

const TRACKS = (discographyData as { tracks: V2Track[] }).tracks;

const Discography: React.FC = () => {
  const [filter, setFilter] = useState<Filter>('all');
  const [showAll, setShowAll] = useState(false);
  const { current, playing, play } = useAudioPlayer();

  // Le filtre s'applique d'abord ; la selection featured (editable dans
  // discography.json) ne restreint que l'affichage par defaut.
  const filtered = useMemo(
    () => (filter === 'all' ? TRACKS : TRACKS.filter((t) => t.category === filter)),
    [filter]
  );
  const visible = useMemo(
    () => (showAll ? filtered : filtered.filter((t) => t.featured)),
    [filtered, showAll]
  );
  const hiddenCount = filtered.length - visible.length;

  return (
    <section className="v2-section" id="music">
      <div className="v2-section-head">
        <h2 className="v2-section-title">Music</h2>
        <span className="v2-label">
          {hiddenCount > 0 ? `${visible.length} / ${filtered.length} tracks` : `${visible.length} track${visible.length > 1 ? 's' : ''}`}
        </span>
      </div>

      <div className="v2-filters" role="group" aria-label="Filtrer la discographie">
        {FILTERS.map((f) => (
          <button
            key={f.key}
            type="button"
            className={`v2-filter${filter === f.key ? ' is-active' : ''}`}
            aria-pressed={filter === f.key}
            data-filter={f.key}
            onClick={() => setFilter(f.key)}
          >
            {f.label}
          </button>
        ))}
      </div>

      <div className="v2-matrix" role="table" aria-label="Discographie">
        <div className="v2-matrix-row v2-matrix-head" role="row">
          <span role="columnheader" className="v2-label">Title</span>
          <span role="columnheader" className="v2-label v2-matrix-project">Project</span>
          <span role="columnheader" className="v2-label v2-matrix-role">Role</span>
          <span role="columnheader" className="v2-label">Year</span>
          <span role="columnheader" className="v2-label v2-matrix-actions">Play</span>
        </div>

        {visible.map((t, i) => {
          const isCurrent = current?.id === t.id;
          // Les lignes hors selection n'existent qu'en mode deplie : elles
          // montent avec un fade-up discret (remount = l'animation rejoue)
          const isExpanded = showAll && !t.featured;
          return (
            <div
              key={t.id}
              className={`v2-matrix-row${isCurrent ? ' is-playing' : ''}${isExpanded ? ' v2-row-in' : ''}`}
              style={isExpanded ? { animationDelay: `${Math.min(i * 14, 260)}ms` } : undefined}
              role="row"
              data-category={t.category}
            >
              <span role="cell" className="v2-matrix-title">{t.title}</span>
              <span role="cell" className="v2-label v2-matrix-project">{t.project}</span>
              <span role="cell" className="v2-label v2-matrix-role">{t.role}</span>
              <span role="cell" className="v2-label">{t.year}</span>
              <span role="cell" className="v2-matrix-actions">
                <button
                  type="button"
                  className="v2-play-btn"
                  aria-label={
                    isCurrent && playing ? `Mettre en pause ${t.title}` : `Écouter ${t.title}`
                  }
                  onClick={() => play(t, visible)}
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
                  href={t.link}
                  target="_blank"
                  rel="noopener noreferrer"
                  aria-label={`Ouvrir ${t.title} sur la plateforme`}
                >
                  <svg viewBox="0 0 16 16" width="11" height="11" aria-hidden="true">
                    <path
                      d="M6 3h7v7M13 3L7 9"
                      stroke="currentColor"
                      strokeWidth="1.6"
                      fill="none"
                    />
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
          {showAll ? 'Show less' : `Show all (${filtered.length})`}
        </button>
      )}

      <p className="v2-label v2-matrix-note">
        Placeholder audio while final masters are being prepared. Full releases on{' '}
        <a
          href="https://mauditemachine.bandcamp.com"
          target="_blank"
          rel="noopener noreferrer"
          style={{ textDecoration: 'underline' }}
        >
          Bandcamp
        </a>
        .
      </p>
    </section>
  );
};

export default Discography;
