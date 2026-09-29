/** STUDIO (spec 11.1) : le setup live, ouvert par la puce STUDIO de la vue eclatee. */

import React from 'react';
import { STUDIO_GEAR } from '../../data';
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
        <a className="v4-link" href="/techrider" tabIndex={tabOf(focusable)}>
          <span>Tech rider</span>
        </a>
      </li>
    </ul>
  </SectionFrame>
);

export default Studio;
