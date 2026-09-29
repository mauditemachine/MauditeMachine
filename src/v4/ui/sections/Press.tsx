/** PRESS (spec 11.1) : une phrase et trois liens, rien d'autre. */

import React from 'react';
import { PRESS_LINKS, PRESS_TEXT } from '../../data';
import { ExternalMark, SectionFrame, tabOf, type SectionProps } from './common';

export const Press: React.FC<SectionProps> = ({ active, focusable }) => {
  const tab = tabOf(focusable);
  return (
    <SectionFrame id="press" active={active}>
      <p className="v4-sec-text">{PRESS_TEXT}</p>
      <ul className="v4-links">
        {PRESS_LINKS.map((l) => (
          <li key={l.href}>
            <a className="v4-link" href={l.href} target="_blank" rel="noopener" tabIndex={tab}>
              <span>{l.label}</span>
              <ExternalMark />
            </a>
          </li>
        ))}
      </ul>
    </SectionFrame>
  );
};

export default Press;
