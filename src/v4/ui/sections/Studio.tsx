/**
 * STUDIO : ouverte par la puce STUDIO de la vue eclatee. Mika y mettra
 * plus tard ses cours de musique en PDF ; en attendant, "Coming soon."
 * (2026-09-30).
 */

import React from 'react';
import { STUDIO_TEXT } from '../../data';
import { SectionFrame, type SectionProps } from './common';

export const Studio: React.FC<SectionProps> = ({ active }) => (
  <SectionFrame id="studio" active={active}>
    <p className="v4-sec-text">{STUDIO_TEXT}</p>
  </SectionFrame>
);

export default Studio;
