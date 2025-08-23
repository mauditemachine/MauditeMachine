/**
 * Composant principal de la discographie Maudite Machine
 */

import React, { useState } from 'react';
import { useDiscogs } from '../../hooks/useDiscogs';
import ReleaseCard from './ReleaseCard';
import DiscographyPlayer from './DiscographyPlayer';
import { soundcloudTracks } from '../../data/soundcloudTracks';
import './Discography.css';

const categoryFilters: Array<{ key: string; label: string;  }> = [
  { key: 'all', label: 'TOUT' },
  { key: 'album', label: 'ALBUMS' },
  { key: 'ep', label: 'EPS' },
  { key: 'single', label: 'SINGLES' },
  { key: 'remix', label: 'REMIXES' },
  { key: 'compilation', label: 'COMPILS' },
];

interface DiscographyProps {
  onBackgroundChange?: (url: string) => void;
}

const Discography: React.FC<DiscographyProps> = ({ onBackgroundChange }) => {
  const {
    releases,
    filteredReleases,
    stats,
    loading,
    error,
    currentFilter,
    setFilter,
    refetch,
    searchReleases,
  } = useDiscogs();

  const [viewMode] = useState<'grid' | 'list'>('list');

  const handleCategoryFilter = (category: string) => {
    setFilter(category);
  };

  // Utiliser directement les releases filtrées (pas de tri complexe)
  const displayedReleases = filteredReleases;

  // Rendu du loading (sans titre/icone)
  if (loading && releases.length === 0) {
    return (
      <div className="discography">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">Chargement…</p>
        </div>
      </div>
    );
  }

  // Rendu de l'erreur
  if (error) {
    return (
      <div className="discography">
        <div className="discography-header">
          <h2 className="discography-title">
            <span className="title-emoji">💿</span>
            Discographie
          </h2>
        </div>
        
        <div className="error-container">
          <div className="error-icon">⚠️</div>
          <h3>Erreur de chargement</h3>
          <p className="error-message">{error}</p>
          <button onClick={refetch} className="retry-button">
            �� Réessayer
          </button>
        </div>
      </div>
    );
  }

  // Rendu principal
  return (
    <div className="discography">

      {/* Filtres par catégorie */}
      <div className="nav-btns">
        {categoryFilters.map(({ key, label }) => {
          const count = key === 'all' 
            ? releases.length 
            : releases.filter(r => r.category.toLowerCase() === key).length;
          
          return count > 0 ? (
            <button
              key={key}
              className={`nav-btn ${currentFilter === key ? 'active' : ''}`}
              onClick={() => handleCategoryFilter(key)}
            >
              <span className="filter-label">{label}</span>
              <span className="filter-count">({count})</span>
            </button>
          ) : null;
        })}
      </div>

      {/* Zone scrollable interne */}
      <div className="section-scroll">
        {/* Lecteur de discographie - utilise la playlist SoundCloud */}
        <DiscographyPlayer
          onBackgroundChange={onBackgroundChange}
        />
      </div>

    </div>
  );
};

export default Discography;
