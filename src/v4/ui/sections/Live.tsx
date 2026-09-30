/**
 * LIVE (revision 2, spec 20.5) : ouverte par la puce LIVE de la vue
 * eclatee, un vrai bouton (le visiteur reste sur la page). Tout le site
 * est en anglais (2026-09-30) : le texte du brief, traduit. Documents :
 * les deux PDF a telecharger (attribut download, fleche a gauche, taille a
 * droite), puis /press/ et /techrider en nouvel onglet (chevron sortant).
 */

import React from 'react';
import { LIVE_DOCS, LIVE_PAGES } from '../../data';
import { ExternalLink } from '../ExternalLink';
import { DocLink, SectionFrame, tabOf, type SectionProps } from './common';

export const Live: React.FC<SectionProps> = ({ active, focusable }) => {
  const tab = tabOf(focusable);
  return (
    <SectionFrame id="live" active={active}>
      <h3 className="v4-sec-sub">Setup</h3>
      <p className="v4-sec-text">DJ set on CDJs, or hybrid live set: Ableton Live, Push 3, Dreadbox Typhon, APC40.</p>
      <p className="v4-sec-text">Length: 90 minutes to 4 hours as a DJ, 60 to 75 minutes live.</p>
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

export default Live;
