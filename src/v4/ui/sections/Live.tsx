/**
 * LIVE (revision 2, spec 20.5) : ouverte par la puce LIVE de la vue
 * eclatee, un vrai bouton (elle ne navigue plus vers /techrider : le
 * visiteur reste sur /v4). Le texte du brief, en francais exactement
 * (lang="fr") ; les accents passent par les entites nommees du JSX, les
 * fichiers restent en ASCII. Documents : les deux PDF a telecharger
 * (attribut download, fleche a gauche, taille a droite), puis /press/ et
 * /techrider en nouvel onglet (chevron sortant).
 */

import React from 'react';
import { LIVE_DOCS, LIVE_PAGES } from '../../data';
import { ExternalLink } from '../ExternalLink';
import { DocLink, SectionFrame, tabOf, type SectionProps } from './common';

export const Live: React.FC<SectionProps> = ({ active, focusable }) => {
  const tab = tabOf(focusable);
  return (
    <SectionFrame id="live" active={active} lang="fr">
      <h3 className="v4-sec-sub">Setup</h3>
      <p className="v4-sec-text">DJ set sur CDJ, ou live hybride Ableton Live, Push 3, Dreadbox Typhon, APC40.</p>
      <p className="v4-sec-text">Dur&eacute;e : 90 minutes &agrave; 4 heures en DJ, 60 &agrave; 75 minutes en live.</p>
      <h3 className="v4-sec-sub">Documents</h3>
      <ul className="v4-links">
        {LIVE_DOCS.map((d) => (
          <li key={d.href}>
            <DocLink href={d.href} label={d.label} size={d.size} tab={tab} />
          </li>
        ))}
        <li>
          <ExternalLink className="v4-link" href={LIVE_PAGES.press} tabIndex={tab}>
            <span>Photos et logos</span>
          </ExternalLink>
        </li>
        <li>
          <ExternalLink className="v4-link" href={LIVE_PAGES.techrider} tabIndex={tab}>
            <span>Fiche technique compl&egrave;te</span>
          </ExternalLink>
        </li>
      </ul>
    </SectionFrame>
  );
};

export default Live;
