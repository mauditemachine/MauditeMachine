/**
 * LABEL (revision 2, spec 20.5) : ouverte par le pad LABEL. Une ligne, le
 * label, puis sa page Bandcamp en nouvel onglet (chevron sortant, sans
 * opener ni referer). La puce LABEL du PCB, elle, est un lien direct vers
 * la meme page.
 */

import React from 'react';
import { LABEL_LINK, LABEL_NAME } from '../../data';
import { ExternalLink } from '../ExternalLink';
import { SectionFrame, tabOf, type SectionProps } from './common';

export const Label: React.FC<SectionProps> = ({ active, focusable }) => (
  <SectionFrame id="label" active={active}>
    <p className="v4-sec-text">{LABEL_NAME}</p>
    <ul className="v4-links">
      <li>
        <ExternalLink className="v4-link" href={LABEL_LINK.href} tabIndex={tabOf(focusable)}>
          <span>{LABEL_LINK.label}</span>
        </ExternalLink>
      </li>
    </ul>
  </SectionFrame>
);

export default Label;
