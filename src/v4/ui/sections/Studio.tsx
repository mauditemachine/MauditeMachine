/**
 * STUDIO (revision 4) : ouverte par la puce STUDIO de la vue eclatee. Le
 * setup, les cours d'Ableton Live (le bouton ouvre CONTACT) et la
 * production d'impression et de merch (Massive Medias, nouvel onglet). Le
 * texte du brief, en anglais ; aucun PDF de cours.
 */

import React from 'react';
import { openSection } from '../../actions';
import { MASSIVE_LINK, STUDIO } from '../../data';
import { ExternalLink } from '../ExternalLink';
import { SectionFrame, tabOf, type SectionProps } from './common';

export const Studio: React.FC<SectionProps> = ({ active, focusable }) => {
  const tab = tabOf(focusable);
  return (
    <SectionFrame id="studio" active={active}>
      <h3 className="v4-sec-sub">The setup</h3>
      <p className="v4-sec-text">{STUDIO.setup}</p>
      <h3 className="v4-sec-sub">Lessons</h3>
      {STUDIO.lessons.map((t) => (
        <p key={t} className="v4-sec-text">
          {t}
        </p>
      ))}
      <ul className="v4-links">
        <li>
          <button type="button" className="v4-link v4-link-btn" tabIndex={tab} aria-controls="v4-section-contact" onClick={() => openSection('contact')}>
            <span>Ask about a lesson</span>
          </button>
        </li>
      </ul>
      <h3 className="v4-sec-sub">Print and merch production</h3>
      <p className="v4-sec-text">{STUDIO.print}</p>
      <ul className="v4-links">
        <li>
          <ExternalLink className="v4-link" href={MASSIVE_LINK.href} tabIndex={tab}>
            <span>{MASSIVE_LINK.label}</span>
          </ExternalLink>
        </li>
      </ul>
    </SectionFrame>
  );
};

export default Studio;
