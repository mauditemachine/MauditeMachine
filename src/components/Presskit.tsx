/**
 * Composant pour la page Presskit
 */

import React from 'react';

interface PresskitProps {
  onNavigateToMessage?: () => void;
}

const Presskit: React.FC<PresskitProps> = ({ onNavigateToMessage }) => {
  return (
    <div className="presskit-container">
      <div className="presskit-content">
        <div className="presskit-header">
        </div>

        <div className="presskit-section">
          <div className="download-card">
            <div className="download-content">
              <h3 className="download-title">Official Press Kit & Tech Rider</h3>
              <p className="download-description">
                Complete press materials including high-resolution photos, artist bio, 
                logos, and technical requirements for bookings and media coverage.
              </p>
              
              <div className="download-items">
                <div className="download-item">
                  <span>High-resolution photos</span>
                </div>
                <div className="download-item">
                  <span>Artist biography</span>
                </div>
                <div className="download-item">
                  <span>Official logos & artwork</span>
                </div>
                <div className="download-item">
                  <span>Technical rider</span>
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
                DOWNLOAD
              </a>
            </div>
          </div>

          <div className="contact-info">
            <h4 className="contact-title">Media Contact</h4>
            <p className="contact-text">
              For interviews, bookings, and media inquiries, please{' '}
              <button 
                onClick={onNavigateToMessage}
                className="contact-message-link"
              >
                write a message here
              </button>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Presskit;
