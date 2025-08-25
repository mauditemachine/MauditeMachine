/**
 * Composant principal de la discographie Maudite Machine - Bandcamp uniquement
 */

import React from 'react';
import { useBandcampTracks } from '../../hooks/useBandcampTracks';
import BandcampIframe from './BandcampIframe';
import './Discography.css';

interface DiscographyProps {
  onBackgroundChange?: (url: string) => void;
}

const Discography: React.FC<DiscographyProps> = ({ onBackgroundChange }) => {
  // Hook pour charger les tracks Bandcamp depuis le JSON
  const { tracks: bandcampTracks, loading: bandcampLoading, error: bandcampError } = useBandcampTracks();

  // Rendu du loading
  if (bandcampLoading && bandcampTracks.length === 0) {
    return (
      <div className="discography">
        <div className="loading-container">
          <div className="loading-spinner"></div>
          <p>Chargement des tracks Bandcamp...</p>
        </div>
      </div>
    );
  }

  // Rendu d'erreur
  if (bandcampError) {
    return (
      <div className="discography">
        <div className="error-container">
          <p>❌ Erreur: {bandcampError}</p>
          <button onClick={() => window.location.reload()}>
            Recharger
          </button>
        </div>
      </div>
    );
  }

  // Rendu principal
  return (
    <div className="discography">
      {/* Zone scrollable avec les iframes Bandcamp */}
      <div className="section-scroll">
        <div 
          className="bandcamp-iframe-container" 
          style={{
            height: '100%', 
            display: 'flex', 
            flexDirection: 'column', 
            gap: '20px',
            paddingBottom: '20px'
          }}
        >
          {bandcampTracks.map((track) => (
            <BandcampIframe 
              key={track.id} 
              track={track}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default Discography;