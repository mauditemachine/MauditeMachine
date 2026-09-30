/**
 * PRESS (2026-10-01) : LIVE y est fondu, un seul pad. Une phrase, le setup
 * et la duree des sets, deux demandes par le formulaire de CONTACT (un
 * set, objet Booking - live set ; une interview, objet Press), puis les
 * documents : les deux PDF a telecharger (attribut download, fleche a
 * gauche, taille a droite), /press/ et /techrider en nouvel onglet
 * (chevron sortant).
 */

import React from 'react';
import { openContact } from '../../actions';
import { LIVE_DOCS, LIVE_PAGES, PRESS_SETUP, PRESS_TEXT } from '../../data';
import { ExternalLink } from '../ExternalLink';
import { DocLink, SectionFrame, tabOf, type SectionProps } from './common';

export const Press: React.FC<SectionProps> = ({ active, focusable }) => {
  const tab = tabOf(focusable);
  return (
    <SectionFrame id="press" active={active}>
      <p className="v4-sec-text">{PRESS_TEXT}</p>
      <h3 className="v4-sec-sub">Setup</h3>
      {PRESS_SETUP.map((t) => (
        <p key={t} className="v4-sec-text">
          {t}
        </p>
      ))}
      <ul className="v4-links">
        <li>
          <button type="button" className="v4-link v4-link-btn" tabIndex={tab} aria-controls="v4-section-contact" onClick={() => openContact('live')}>
            <span>Book a set</span>
          </button>
        </li>
        <li>
          <button type="button" className="v4-link v4-link-btn" tabIndex={tab} aria-controls="v4-section-contact" onClick={() => openContact('press')}>
            <span>Interview or press request</span>
          </button>
        </li>
      </ul>
      <h3 className="v4-sec-sub">Documents</h3>
      <ul className="v4-links">
        {LIVE_DOCS.map((d) => (
          <li key={d.href}>
            <DocLink href={d.href} label={d.label} size={d.size} tab={tab} />
          </li>
        ))}
        <li>
          <ExternalLink className="v4-link" href={LIVE_PAGES.press} tabIndex={tab}>
            <span>Photos and logos</span>
          </ExternalLink>
        </li>
        <li>
          <ExternalLink className="v4-link" href={LIVE_PAGES.techrider} tabIndex={tab}>
            <span>Full tech rider</span>
          </ExternalLink>
        </li>
      </ul>
    </SectionFrame>
  );
};

export default Press;
