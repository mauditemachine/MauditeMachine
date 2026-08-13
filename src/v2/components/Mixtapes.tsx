/**
 * Mixtapes /v2 : sets SoundCloud en liste compacte coherente avec la
 * matrice discographie. Chaque ligne est un lien direct vers SoundCloud
 * (nouvel onglet), AUCUN iframe (regle du site). 6 affichees par defaut
 * (featured dans mixtapes.json, editable), Show all pour le reste.
 */

import React, { useMemo, useState } from 'react';
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

const Mixtapes: React.FC = () => {
  const [showAll, setShowAll] = useState(false);

  const visible = useMemo(() => (showAll ? ALL : ALL.filter((m) => m.featured)), [showAll]);
  const hiddenCount = ALL.length - visible.length;

  return (
    <section className="v2-section" id="mixtapes">
      <div className="v2-section-head">
        <h2 className="v2-section-title">Mixtapes</h2>
        <a
          className="v2-label v2-mix-profile"
          href={DATA.profileUrl}
          target="_blank"
          rel="noopener noreferrer"
        >
          Full sets on SoundCloud ↗
        </a>
      </div>

      <div className="v2-mixes" role="list">
        {visible.map((m, i) => {
          const isExpanded = showAll && !m.featured;
          return (
            <a
              key={m.number}
              className={`v2-mix-row${isExpanded ? ' v2-row-in' : ''}`}
              style={isExpanded ? { animationDelay: `${Math.min(i * 14, 260)}ms` } : undefined}
              href={m.soundcloudUrl}
              target="_blank"
              rel="noopener noreferrer"
              role="listitem"
              aria-label={`Mixtape ${m.number} : ${m.title}, ouvrir sur SoundCloud`}
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
              <span className="v2-link-btn v2-mix-ext" aria-hidden="true">
                <svg viewBox="0 0 16 16" width="11" height="11">
                  <path d="M6 3h7v7M13 3L7 9" stroke="currentColor" strokeWidth="1.6" fill="none" />
                  <path d="M11 9v4H3V5h4" stroke="currentColor" strokeWidth="1.4" fill="none" />
                </svg>
              </span>
            </a>
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
