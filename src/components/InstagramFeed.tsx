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
        {/* LightWidget embed exact fourni */}
        <script src="https://cdn.lightwidget.com/widgets/lightwidget.js"></script>
        <iframe
          src="https://cdn.lightwidget.com/widgets/faa495d6f58f5685bc4fadceeef06a31.html"
          scrolling="no"
          allowTransparency={true as any}
          className="lightwidget-widget"
          style={{ width: '100%', border: '0', overflow: 'hidden' }}
        />
        <div style={{ textAlign: 'right', marginTop: 10 }}>
          <a
            href="https://www.instagram.com/mauditemachine/"
            target="_blank"
            rel="noreferrer"
            className="ig-follow-button"
          >
            VIEW MORE ON INSTAGRAM
          </a>
        </div>
      </div>
    </div>
  );
};

export default InstagramFeed;