/**
 * Composant Instagram Feed propre et responsive
 */

import React, { useEffect } from 'react';

const InstagramFeed: React.FC = () => {
  useEffect(() => {
    // Charger le script LightWidget une seule fois
    if (!document.querySelector('script[src*="lightwidget.js"]')) {
      const script = document.createElement('script');
      script.src = 'https://cdn.lightwidget.com/widgets/lightwidget.js';
      script.async = true;
      document.head.appendChild(script);
    }
  }, []);

  return (
    <div className="instagram-feed">
      {/* Widget Instagram responsive */}
      <div className="instagram-widget-container">
        <iframe
          src="https://cdn.lightwidget.com/widgets/faa495d6f58f5685bc4fadceeef06a31.html"
          scrolling="no"
          allowTransparency={true as any}
          className="lightwidget-widget"
          style={{ 
            width: '100%', 
            border: '0', 
            overflow: 'hidden',
            height: 'auto',
            minHeight: '400px'
          }}
        />
        
        {/* Bouton VIEW MORE */}
        <div className="instagram-footer">
          <a
            href="https://www.instagram.com/mauditemachine/"
            target="_blank"
            rel="noreferrer"
            className="ig-view-more-btn"
          >
            VIEW MORE ON INSTAGRAM
          </a>
        </div>
      </div>
    </div>
  );
};

export default InstagramFeed;