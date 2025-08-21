/**
 * Composant principal de la discographie Maudite Machine
 */

import React, { useState } from 'react';
import { useDiscogs } from '../../hooks/useDiscogs';
import ReleaseCard from './ReleaseCard';
import './Discography.css';

const categoryFilters: Array<{ key: string; label: string;  }> = [
  { key: 'all', label: 'TOUT' },
  { key: 'album', label: 'ALBUMS' },
  { key: 'ep', label: 'EPS' },
  { key: 'single', label: 'SINGLES' },
  { key: 'remix', label: 'REMIXES' },
  { key: 'compilation', label: 'COMPILS' },
];

const Discography: React.FC = () => {
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

  // Rendu du loading
  if (loading && releases.length === 0) {
    return (
      <div className="discography">
        <div className="discography-header">
          <h2 className="discography-title">
            <span className="title-emoji">💿</span>
            Discographie
          </h2>
        </div>
        
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p className="loading-text">
            Récupération de la discographie depuis Discogs...
          </p>
          <div className="loading-progress">
            <div className="progress-bar"></div>
          </div>
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



      {/* Grille des releases */}
      {displayedReleases.length > 0 ? (
        <div className={`releases-container ${viewMode}-view`}>
          <div className={`releases-grid ${viewMode}`}>
            {displayedReleases.map((release) => (
              <ReleaseCard
                key={release.id}
                release={release}
                viewMode={viewMode}
              />
            ))}
          </div>
        </div>
      ) : (
        <div className="no-results">
          <div className="no-results-icon">🔍</div>
          <h3>Aucun résultat</h3>
          <p>Aucune release dans la catégorie "{currentFilter}"</p>
          {currentFilter !== 'all' && (
            <button
              onClick={() => setFilter('all')}
              className="clear-filters-button"
            >
              Afficher toutes les releases
            </button>
          )}
        </div>
      )}


    </div>
  );
};

export default Discography;
