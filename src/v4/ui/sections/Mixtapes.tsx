/** MIXTAPES (spec 11.1) : les 5 mixtapes avec leur duree, meme mecanique que TRACKS. */

import React from 'react';
import { MIXTAPES, MIXTAPE_QUEUE } from '../../data';
import { PlayList, SectionFrame, tabOf, type SectionProps } from './common';

export const Mixtapes: React.FC<SectionProps> = ({ active, focusable }) => (
  <SectionFrame id="mixtapes" active={active}>
    <PlayList items={MIXTAPES} queue={MIXTAPE_QUEUE} tab={tabOf(focusable)} label="Mixtapes" />
  </SectionFrame>
);

export default Mixtapes;
