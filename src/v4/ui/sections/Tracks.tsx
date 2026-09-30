/** TRACKS (spec 11.1) : les 37 sorties, la plus recente d'abord ; clic = lecture SoundCloud. */

import React from 'react';
import { TRACKS, TRACK_QUEUE } from '../../data';
import { PlayList, SectionFrame, tabOf, type SectionProps } from './common';

export const Tracks: React.FC<SectionProps> = ({ active, focusable }) => (
  <SectionFrame id="tracks" active={active}>
    <PlayList items={TRACKS} queue={TRACK_QUEUE} tab={tabOf(focusable)} label="Tracks" active={active} />
  </SectionFrame>
);

export default Tracks;
