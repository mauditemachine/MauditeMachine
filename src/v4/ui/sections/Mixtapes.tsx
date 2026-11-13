/** MIXTAPES (spec 11.1) : les 5 mixtapes avec leur duree, meme mecanique que TRACKS (au telephone : le lecteur, 2026-11-13). */

import React from 'react';
import { MIXTAPES, MIXTAPE_QUEUE } from '../../data';
import { PORTRAIT } from '../../theme';
import { PlayList, SectionFrame, tabOf, type SectionProps } from './common';
import { PhonePlayer } from './PhonePlayer';

export const Mixtapes: React.FC<SectionProps> = ({ active, focusable }) => (
  <SectionFrame id="mixtapes" active={active}>
    {PORTRAIT ? (
      <PhonePlayer items={MIXTAPES} queue={MIXTAPE_QUEUE} tab={tabOf(focusable)} label="Mixtapes" active={active} />
    ) : (
      <PlayList items={MIXTAPES} queue={MIXTAPE_QUEUE} tab={tabOf(focusable)} label="Mixtapes" active={active} />
    )}
  </SectionFrame>
);

export default Mixtapes;
