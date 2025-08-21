/**
 * Composant d'affichage des statistiques de la discographie
 */

import React from 'react';
import type { DiscographyStats } from '../../hooks/useDiscogs';

interface DiscographyStatsProps {
  stats: DiscographyStats;
  isVisible: boolean;
  onToggle: () => void;
}

const DiscographyStats: React.FC<DiscographyStatsProps> = ({
  stats,
  isVisible,
  onToggle,
}) => {
  const currentYear = new Date().getFullYear();
  const yearsActive = stats.years.length > 0 
    ? currentYear - Math.min(...stats.years) + 1 
    : 0;

  return (
    <div className="discography-stats">
      <button 
        className="stats-toggle"
        onClick={onToggle}
        title={isVisible ? 'Masquer les statistiques' : 'Afficher les statistiques'}
      >
        📊 Statistiques {isVisible ? '▼' : '▶'}
      </button>
      
      {isVisible && (
        <div className="stats-content">
          {/* Statistiques générales */}
          <div className="stats-section">
            <h4>📈 Vue d'ensemble</h4>
            <div className="stats-grid">
              <div className="stat-item">
                <span className="stat-value">{stats.total}</span>
                <span className="stat-label">Releases totales</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{yearsActive}</span>
                <span className="stat-label">Années d'activité</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.years.length > 0 ? Math.min(...stats.years) : '-'}</span>
                <span className="stat-label">Première release</span>
              </div>
              <div className="stat-item">
                <span className="stat-value">{stats.years.length > 0 ? Math.max(...stats.years) : '-'}</span>
                <span className="stat-label">Dernière release</span>
              </div>
            </div>
          </div>

          {/* Statistiques par catégorie */}
          <div className="stats-section">
            <h4>📀 Par catégorie</h4>
            <div className="category-stats">
              {stats.albums > 0 && (
                <div className="category-item">
                  <span className="category-emoji">💿</span>
                  <span className="category-name">Albums</span>
                  <span className="category-count">{stats.albums}</span>
                </div>
              )}
              {stats.eps > 0 && (
                <div className="category-item">
                  <span className="category-emoji">🎵</span>
                  <span className="category-name">EPs</span>
                  <span className="category-count">{stats.eps}</span>
                </div>
              )}
              {stats.singles > 0 && (
                <div className="category-item">
                  <span className="category-emoji">💽</span>
                  <span className="category-name">Singles</span>
                  <span className="category-count">{stats.singles}</span>
                </div>
              )}
              {stats.remixes > 0 && (
                <div className="category-item">
                  <span className="category-emoji">🔄</span>
                  <span className="category-name">Remixes</span>
                  <span className="category-count">{stats.remixes}</span>
                </div>
              )}
              {stats.compilations > 0 && (
                <div className="category-item">
                  <span className="category-emoji">📚</span>
                  <span className="category-name">Compilations</span>
                  <span className="category-count">{stats.compilations}</span>
                </div>
              )}
              {stats.other > 0 && (
                <div className="category-item">
                  <span className="category-emoji">❓</span>
                  <span className="category-name">Autres</span>
                  <span className="category-count">{stats.other}</span>
                </div>
              )}
            </div>
          </div>

          {/* Top genres */}
          {stats.topGenres.length > 0 && (
            <div className="stats-section">
              <h4>🎶 Genres principaux</h4>
              <div className="top-list">
                {stats.topGenres.map(({ genre, count }) => (
                  <div key={genre} className="top-item">
                    <span className="top-name">{genre}</span>
                    <span className="top-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Top labels */}
          {stats.topLabels.length > 0 && (
            <div className="stats-section">
              <h4>🏷️ Labels principaux</h4>
              <div className="top-list">
                {stats.topLabels.map(({ label, count }) => (
                  <div key={label} className="top-item">
                    <span className="top-name">{label}</span>
                    <span className="top-count">{count}</span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default DiscographyStats;
