/**
 * Footer /v2 : contact booking, liens VRSTL / Massive Medias, retour v1.
 */

import React from 'react';

const Footer: React.FC = () => (
  <footer className="v2-section" id="contact">
    <div className="v2-section-head">
      <h2 className="v2-section-title">Contact</h2>
      <span className="v2-label">Booking &amp; press</span>
    </div>

    <a
      className="v2-footer-mail v2-display"
      href="mailto:booking@mauditemachine.com"
    >
      booking@mauditemachine.com
    </a>

    <div className="v2-footer-bottom">
      <span className="v2-label">© {new Date().getFullYear()} Maudite Machine</span>
      <div className="v2-footer-links">
        <a href="https://vrstlrecords.com" target="_blank" rel="noopener noreferrer" className="v2-label">
          VRSTL Records
        </a>
        <a href="https://massivemedias.com" target="_blank" rel="noopener noreferrer" className="v2-label">
          Massive Medias
        </a>
        <a href="/" className="v2-label">
          ← Site actuel
        </a>
      </div>
    </div>
  </footer>
);

export default Footer;
