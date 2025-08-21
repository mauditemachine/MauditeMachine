/**
 * Composant pour afficher le feed Instagram de Maudite Machine avec contrôle total
 */

import React from 'react';

interface InstagramFeedProps {
  isMobile?: boolean;
}

const InstagramFeed: React.FC<InstagramFeedProps> = ({ isMobile = false }) => {
  return (
    <div className="instagram-feed">
      <div className="instagram-header">
        <h2 className="instagram-title">
          Instagram
          <span className="ig-handle">@mauditemachine</span>
        </h2>
        <a 
          href="https://www.instagram.com/mauditemachine/" 
          target="_blank" 
          rel="noopener noreferrer"
          className="ig-follow-button"
        >
          FOLLOW
        </a>
      </div>

      <div className="instagram-widget-container">
        <iframe 
          src="//lightwidget.com/widgets/a1d122902fdd575d988530ac9f0afb96.html" 
          scrolling="no" 
          allowtransparency="true" 
          className="lightwidget-widget" 
          style={{
            width: '100%',
            border: '0',
            overflow: 'hidden',
            height: isMobile ? '1500px' : '2000px'
          }}
        />
      </div>
    </div>
  );
};

export default InstagramFeed;