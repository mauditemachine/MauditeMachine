/**
 * Barre de recherche pour la discographie
 */

import React from 'react';

interface SearchBarProps {
  searchQuery: string;
  onSearchChange: (query: string) => void;
  viewMode: 'grid' | 'list';
  onViewModeChange: (mode: 'grid' | 'list') => void;
  sortBy: 'year' | 'title' | 'format';
  sortOrder: 'asc' | 'desc';
  onSortChange: (sortBy: 'year' | 'title' | 'format', sortOrder: 'asc' | 'desc') => void;
  totalResults: number;
}

const SearchBar: React.FC<SearchBarProps> = ({
  searchQuery,
  onSearchChange,
  viewMode,
  onViewModeChange,
  sortBy,
  sortOrder,
  onSortChange,
  totalResults,
}) => {
  const handleSearchChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    onSearchChange(e.target.value);
  };

  const handleSortChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const [newSortBy, newSortOrder] = e.target.value.split('-');
    onSortChange(
      newSortBy as 'year' | 'title' | 'format',
      newSortOrder as 'asc' | 'desc'
    );
  };

  const clearSearch = () => {
    onSearchChange('');
  };

  return (
    <div className="discography-search">
      {/* Barre de recherche principale */}
      <div className="search-input-container">
        <div className="search-input-wrapper">
          <span className="search-icon">🔍</span>
          <input
            type="text"
            placeholder="Rechercher dans la discographie..."
            value={searchQuery}
            onChange={handleSearchChange}
            className="search-input"
          />
          {searchQuery && (
            <button
              onClick={clearSearch}
              className="search-clear"
              title="Effacer la recherche"
            >
              ✕
            </button>
          )}
        </div>
        <div className="search-results-count">
          {totalResults} release{totalResults !== 1 ? 's' : ''}
        </div>
      </div>

      {/* Contrôles de tri et vue */}
      <div className="search-controls">
        <div className="sort-controls">
          <label htmlFor="sort-select">Trier par:</label>
          <select
            id="sort-select"
            value={`${sortBy}-${sortOrder}`}
            onChange={handleSortChange}
            className="sort-select"
          >
            <option value="year-desc">Année (récent)</option>
            <option value="year-asc">Année (ancien)</option>
            <option value="title-asc">Titre (A-Z)</option>
            <option value="title-desc">Titre (Z-A)</option>
            <option value="format-asc">Format (A-Z)</option>
            <option value="format-desc">Format (Z-A)</option>
          </select>
        </div>

        <div className="view-controls">
          <button
            className={`view-btn ${viewMode === 'grid' ? 'active' : ''}`}
            onClick={() => onViewModeChange('grid')}
            title="Vue grille"
          >
            ⊞
          </button>
          <button
            className={`view-btn ${viewMode === 'list' ? 'active' : ''}`}
            onClick={() => onViewModeChange('list')}
            title="Vue liste"
          >
            ☰
          </button>
        </div>
      </div>
    </div>
  );
};

export default SearchBar;
