/**
 * Carte d'affichage d'une release
 */

import React, { useState } from 'react';
import type { DiscogsRelease } from '../../types/discogs';

interface ReleaseCardProps {
  release: DiscogsRelease;
  viewMode: 'grid' | 'list';
}

const ReleaseCard: React.FC<ReleaseCardProps> = ({ release, viewMode }) => {
  const [imageLoaded, setImageLoaded] = useState(false);
  const [imageError, setImageError] = useState(false);

  const handleImageLoad = () => {
    setImageLoaded(true);
  };

  const handleImageError = () => {
    setImageError(true);
    setImageLoaded(true);
  };

  const getCategoryEmoji = (category: string) => {
    switch (category) {
      case 'Album': return '💿';
      case 'EP': return '';
      case 'Single': return '';
      case 'Remix': return '';
      case 'Compilation': return '📚';
      default: return '🎧';
    }
  };

  const getCategoryColor = (category: string) => {
    switch (category) {
      case 'Album': return '#00ff88';
      case 'EP': return '#ffffff';
      case 'Single': return '#ffffff';
      case 'Remix': return '#ffffff';
      case 'Compilation': return '#ff8800';
      default: return '#ffffff';
    }
  };

  if (viewMode === 'list') {
    return (
      <div className="release-card list-mode">
        <div className="release-cover-small">
          {!imageError && release.coverImage ? (
            <img
              src={release.coverImage}
              alt={release.cleanTitle}
              onLoad={handleImageLoad}
              onError={handleImageError}
              className={`cover-image ${imageLoaded ? 'loaded' : ''}`}
            />
          ) : (
            <div className="cover-placeholder">
              {getCategoryEmoji(release.category)}
            </div>
          )}
        </div>
        
        <div className="release-info-list">
          <div className="release-main-info">
            <h3 className="release-title">{release.cleanTitle}</h3>
            <div className="release-meta">
              <span 
                className="release-category"
                style={{ color: getCategoryColor(release.category) }}
              >
                {getCategoryEmoji(release.category)}{getCategoryEmoji(release.category) && ' '}{release.category}
              </span>
              <div className="release-year-duration">
                {release.year && (
                  <span className="release-year">{release.year}</span>
                )}
                {release.duration && (
                  <span className="release-duration">{release.duration}</span>
                )}
              </div>
              {release.format && release.format !== 'release' && (
                <span className="release-format">{release.format.replace(/release/gi, '').trim()}</span>
              )}
            </div>
          </div>
          
          <div className="release-labels">
            {release.labels.slice(0, 2).map((label, index) => (
              <span key={index} className="label-tag">
                {label.name}
                {label.catno && <span className="catno">#{label.catno}</span>}
              </span>
            ))}
          </div>
          
          <div className="release-actions">
            <a
              href={release.discogsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="discogs-link"
              title="Voir sur Discogs"
            >
              DISCOGS
            </a>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="release-card grid-mode">
      <div className="release-cover">
        {!imageError && release.coverImage ? (
          <img
            src={release.coverImage}
            alt={release.cleanTitle}
            onLoad={handleImageLoad}
            onError={handleImageError}
            className={`cover-image ${imageLoaded ? 'loaded' : ''}`}
            loading="lazy"
          />
        ) : (
          <div className="cover-placeholder">
            <span className="placeholder-emoji">
              {getCategoryEmoji(release.category)}
            </span>
            <span className="placeholder-text">
              {release.cleanTitle}
            </span>
          </div>
        )}
        
        {/* Overlay avec informations au hover */}
        <div className="release-overlay">
          <div className="overlay-content">
            <h3 className="overlay-title">{release.cleanTitle}</h3>
            
            <div className="overlay-meta">
              <span 
                className="overlay-category"
                style={{ color: getCategoryColor(release.category) }}
              >
                {getCategoryEmoji(release.category)}{getCategoryEmoji(release.category) && ' '}{release.category}
              </span>
              <div className="release-year-duration">
                {release.year && (
                  <span className="overlay-year">{release.year}</span>
                )}
                {release.duration && (
                  <span className="overlay-duration">{release.duration}</span>
                )}
              </div>
            </div>
            
            {release.labels.length > 0 && (
              <div className="overlay-labels">
                {release.labels.slice(0, 2).map((label, index) => (
                  <span key={index} className="overlay-label">
                    {label.name}
                  </span>
                ))}
              </div>
            )}
            
            {release.genres.length > 0 && (
              <div className="overlay-genres">
                {release.genres.slice(0, 3).map((genre, index) => (
                  <span key={index} className="genre-tag">
                    {genre}
                  </span>
                ))}
              </div>
            )}
            
            <a
              href={release.discogsUrl}
              target="_blank"
              rel="noopener noreferrer"
              className="overlay-link"
              onClick={(e) => e.stopPropagation()}
            >
              Voir sur Discogs →
            </a>
          </div>
        </div>
      </div>
      
      {/* Informations en bas de la carte */}
      <div className="release-info">
        <h3 className="release-title" title={release.cleanTitle}>
          {release.cleanTitle}
        </h3>
        <div className="release-meta">
          <span 
            className="release-category"
            style={{ color: getCategoryColor(release.category) }}
          >
            {getCategoryEmoji(release.category)}{getCategoryEmoji(release.category) && ' '}{release.category}
          </span>
          <div className="release-year-duration">
            {release.year && (
              <span className="release-year">{release.year}</span>
            )}
            {release.duration && (
              <span className="release-duration">{release.duration}</span>
            )}
          </div>
        </div>
        {release.format && release.format !== 'release' && (
          <div className="release-format">{release.format.replace(/release/gi, '').trim()}</div>
        )}
      </div>
    </div>
  );
};

export default React.memo(ReleaseCard);
