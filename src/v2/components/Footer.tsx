/**
 * Footer /v2 : contacts booking (international / Canada-USA), liens
 * VRSTL / Massive Medias, retour v1.
 */

import React from 'react';
import { BOOKING_CONTACTS } from '../data/contacts';
import SocialLinks from './SocialLinks';

const Footer: React.FC = () => (
  <footer className="v2-section" id="contact">
    <div className="v2-section-head">
      <h2 className="v2-section-title"><span className="v2-section-num">07</span>Contact</h2>
      <span className="v2-label">Booking &amp; press</span>
    </div>

    <div className="v2-contacts">
      {BOOKING_CONTACTS.map((c) => (
        <div key={c.id} className="v2-contact-block">
          <span className="v2-label">{c.label.en}</span>
          {c.name && <span className="v2-contact-name">{c.name}</span>}
          <a className="v2-contact-mail" href={`mailto:${c.email}`}>
            {c.email}
          </a>
        </div>
      ))}
    </div>

    {/* Tous les reseaux : la liste canonique complete (14 liens) */}
    <div className="v2-follow">
      <span className="v2-label">Follow</span>
      <SocialLinks />
    </div>

    <div className="v2-footer-bottom">
      <span className="v2-label">© {new Date().getFullYear()} Maudite Machine</span>
      <div className="v2-footer-links">
        <a href="https://vrstlrecords.com" target="_blank" rel="noopener noreferrer" className="v2-label">
          VRSTL Records
        </a>
        <a href="https://massivemedias.com" target="_blank" rel="noopener noreferrer" className="v2-label">
          Massive Medias
        </a>
        <a href="/v1" className="v2-label">
          Archive v1
        </a>
      </div>
    </div>
  </footer>
);

export default Footer;
