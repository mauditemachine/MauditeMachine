/**
 * SONAA (revision 2, spec 20.5) : ouverte par le pad SONAA. Tout le site
 * est en anglais (2026-09-30) : le texte du brief, traduit. Puis le lien
 * sonaa.ca en nouvel onglet (chevron sortant, sans opener ni referer).
 */

import React from 'react';
import { SONAA_LINK } from '../../data';
import { ExternalLink } from '../ExternalLink';
import { SectionFrame, tabOf, type SectionProps } from './common';

export const Sonaa: React.FC<SectionProps> = ({ active, focusable }) => (
  <SectionFrame id="sonaa" active={active}>
    <p className="v4-sec-text">The atlas and calendar of electronic music.</p>
    <p className="v4-sec-text">Genres, scenes, events.</p>
    <ul className="v4-links">
      <li>
        <ExternalLink className="v4-link" href={SONAA_LINK.href} tabIndex={tabOf(focusable)}>
          <span>{SONAA_LINK.label}</span>
        </ExternalLink>
      </li>
    </ul>
  </SectionFrame>
);

export default Sonaa;
