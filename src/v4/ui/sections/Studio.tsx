/**
 * STUDIO (spec 11.1) : le setup live, ouvert par la puce STUDIO de la vue
 * eclatee. Revision 2 : la fiche technique s'ouvre en nouvel onglet
 * (chevron sortant), comme depuis LIVE : le visiteur ne quitte plus /v4.
 */

import React from 'react';
import { LIVE_PAGES, STUDIO_GEAR } from '../../data';
import { ExternalLink } from '../ExternalLink';
import { SectionFrame, tabOf, type SectionProps } from './common';

export const Studio: React.FC<SectionProps> = ({ active, focusable }) => (
  <SectionFrame id="studio" active={active}>
    <p className="v4-row-meta v4-sec-lead">Live setup</p>
    <ul className="v4-gear">
      {STUDIO_GEAR.map((g) => (
        <li key={g}>{g}</li>
      ))}
    </ul>
    <ul className="v4-links">
      <li>
        <ExternalLink className="v4-link" href={LIVE_PAGES.techrider} tabIndex={tabOf(focusable)}>
          <span>Tech rider</span>
        </ExternalLink>
      </li>
    </ul>
  </SectionFrame>
);

export default Studio;
