/**
 * Composant pour la page Presskit
 */

import React from 'react';
import { useApp } from '../context/AppContext';

interface PresskitProps {
  onNavigateToMessage?: () => void;
}

const Presskit: React.FC<PresskitProps> = ({ onNavigateToMessage }) => {
  const { t } = useApp();
  return (
    <div className="presskit-container">
      <div className="presskit-content">
        <div className="presskit-header">
        </div>

        <div className="presskit-section">
          <div className="download-card">
            <div className="download-content">
              <h3 className="download-title">{t.presskit.title}</h3>
              <p className="download-description">
                {t.presskit.description}
              </p>
              
              <div className="download-items">
                <div className="download-item">
                  <span>{t.presskit.photos}</span>
                </div>
                <div className="download-item">
                  <span>{t.presskit.biography}</span>
                </div>
                <div className="download-item">
                  <span>{t.presskit.logos}</span>
                </div>
                <div className="download-item">
                  <span>{t.presskit.techrider}</span>
                </div>
              </div>
              
              <a 
                href={`${import.meta.env.BASE_URL}Maudite Machine PressKit & Techrider.zip`}
                download="Maudite Machine PressKit & Techrider.zip"
                className="download-button"
                aria-label="Download press kit"
                onClick={() => {
                  // Tracking Facebook Pixel pour le téléchargement
                  if (typeof window !== 'undefined' && (window as any).fbq) {
                    (window as any).fbq('track', 'Lead', {
                      content_name: 'Press Kit Download',
                      content_category: 'Download'
                    });
                  }
                }}
              >
                {t.presskit.download}
              </a>
            </div>
          </div>

          <div className="contact-info">
            <h4 className="contact-title">{t.presskit.mediaContact}</h4>
            <p className="contact-text">
              {t.presskit.mediaText}{' '}
              <button 
                onClick={onNavigateToMessage}
                className="contact-message-link"
              >
                {t.presskit.mediaLink}
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Presskit;
