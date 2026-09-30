/**
 * SONAA (revision 2, spec 20.5) : ouverte par le pad SONAA. Le texte du
 * brief, en francais exactement (lang="fr") ; les accents passent par les
 * entites nommees du JSX, les fichiers restent en ASCII. Puis le lien
 * sonaa.ca en nouvel onglet (chevron sortant, sans opener ni referer).
 */

import React from 'react';
import { SONAA_LINK } from '../../data';
import { ExternalLink } from '../ExternalLink';
import { SectionFrame, tabOf, type SectionProps } from './common';

export const Sonaa: React.FC<SectionProps> = ({ active, focusable }) => (
  <SectionFrame id="sonaa" active={active} lang="fr">
    <p className="v4-sec-text">L&apos;atlas et le calendrier des musiques &eacute;lectroniques.</p>
    <p className="v4-sec-text">Genres, sc&egrave;nes, &eacute;v&eacute;nements.</p>
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
