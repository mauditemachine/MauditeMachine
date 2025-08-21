/**
 * Composant pour la page Store
 */

import React from 'react';

const Store: React.FC = () => {
  return (
    <div className="store-container">
      <div className="store-message">
        <div className="store-icon">
          <img 
            src={import.meta.env.BASE_URL + 'logo/mauditemachine-logo.png'} 
            alt="Maudite Machine Logo"
            className="store-logo"
          />
        </div>
        <h2 className="store-title">New merch dropping soon!</h2>
        <p className="store-description">
          Get ready for fresh t-shirts, hoodies, stickers, and bags in multiple sizes.
        </p>
        <div className="store-timeline">
          <span className="timeline-label">Currently in production</span>
          <span className="timeline-date">August 2025</span>
        </div>
      </div>
    </div>
  );
};

export default Store;
