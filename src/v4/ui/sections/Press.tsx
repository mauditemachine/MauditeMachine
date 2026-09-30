/**
 * PRESS (spec 11.1) : une phrase et trois liens en nouvel onglet (chevron
 * sortant) ; puis une demande d'interview par le formulaire de CONTACT
 * (objet Press, 2026-10-01).
 */

import React from 'react';
import { openContact } from '../../actions';
import { PRESS_LINKS, PRESS_TEXT } from '../../data';
import { ExternalLink } from '../ExternalLink';
import { SectionFrame, tabOf, type SectionProps } from './common';

export const Press: React.FC<SectionProps> = ({ active, focusable }) => {
  const tab = tabOf(focusable);
  return (
    <SectionFrame id="press" active={active}>
      <p className="v4-sec-text">{PRESS_TEXT}</p>
      <ul className="v4-links">
        {PRESS_LINKS.map((l) => (
          <li key={l.href}>
            <ExternalLink className="v4-link" href={l.href} tabIndex={tab}>
              <span>{l.label}</span>
            </ExternalLink>
          </li>
        ))}
        <li>
          <button type="button" className="v4-link v4-link-btn" tabIndex={tab} aria-controls="v4-section-contact" onClick={() => openContact('press')}>
            <span>Interview or press request</span>
          </button>
        </li>
      </ul>
    </SectionFrame>
  );
};

export default Press;
