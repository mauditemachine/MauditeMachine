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
          <h2 className="presskit-title">Press Kit</h2>
          <p className="presskit-subtitle">
            Download official press materials, bio, photos, and technical requirements for Maudite Machine
          </p>
        </div>

        <div className="presskit-section">
          <div className="download-card">
            <div className="download-icon">
              <svg 
                viewBox="0 0 24 24" 
                width="48" 
                height="48" 
                fill="currentColor"
                className="download-svg"
              >
                <path d="M14,2H6A2,2 0 0,0 4,4V20A2,2 0 0,0 6,22H18A2,2 0 0,0 20,20V8L14,2M18,20H6V4H13V9H18V20Z" />
                <path d="M12,19L8,15H10.5V12H13.5V15H16L12,19Z" />
              </svg>
            </div>
            
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
                href="https://drive.google.com/file/d/1BqKq0UD0yAKS8Cu38pfUIwBz0qV0ufqe/view?usp=drive_link"
                target="_blank"
                rel="noopener noreferrer"
                className="download-button"
                aria-label="Download press kit"
              >
                <i className="fa-solid fa-download" />
                <span>DOWNLOAD</span>
              </a>
            </div>
          </div>

          <div className="contact-info">
            <h4 className="contact-title">Media Contact</h4>
            <p className="contact-text">
              For interviews, bookings, and media inquiries, please contact us at{' '}
              <span className="contact-email">vrstlrecords@gmail.com</span>{' '}
              or{' '}
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
