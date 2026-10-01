/**
 * Barre haute : marque + tagline a gauche, TRACKLIST et INFO a droite.
 */

import React, { forwardRef } from 'react';
import { Link } from 'react-router-dom';

interface TopBarProps {
  drawer: 'none' | 'tracklist' | 'info';
  onTracklist: () => void;
  onInfo: () => void;
  tracklistRef: React.RefObject<HTMLButtonElement | null>;
  infoRef: React.RefObject<HTMLButtonElement | null>;
}

const TopBarInner = forwardRef<HTMLElement, TopBarProps>(({ drawer, onTracklist, onInfo, tracklistRef, infoRef }, ref) => (
  <header className="v3-top" ref={ref}>
    <div className="v3-brand">
      <Link to="/" className="v3-wordmark" aria-label="Maudite Machine, main site">
        MAUDITE MACHINE
      </Link>
      <span className="v3-tagline">deep machine grooves with a human pulse</span>
    </div>
    <nav className="v3-top-nav" aria-label="Menu">
      <button
        ref={tracklistRef}
        type="button"
        className={`v3-top-btn${drawer === 'tracklist' ? ' is-active' : ''}`}
        aria-expanded={drawer === 'tracklist'}
        onClick={onTracklist}
      >
        TRACKLIST
      </button>
      <button
        ref={infoRef}
        type="button"
        className={`v3-top-btn${drawer === 'info' ? ' is-active' : ''}`}
        aria-expanded={drawer === 'info'}
        onClick={onInfo}
      >
        INFO
      </button>
    </nav>
  </header>
));
TopBarInner.displayName = 'TopBar';

const TopBar = React.memo(TopBarInner);

export default TopBar;
