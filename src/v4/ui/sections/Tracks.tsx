/** TRACKS (spec 11.1) : les 37 sorties, melangees a chaque visite ; clic = lecture SoundCloud. */

import React, { useSyncExternalStore } from 'react';
import { TRACKS, TRACK_QUEUE } from '../../data';
import { missingTrack } from '../../state/sectionRoute';
import { PlayList, SectionFrame, tabOf, type SectionProps } from './common';

export const Tracks: React.FC<SectionProps> = ({ active, focusable }) => {
  // Une adresse de morceau inconnue (2026-10-21, audit, state/sectionRoute.ts) : on le dit, la liste suit
  const missing = useSyncExternalStore(missingTrack.subscribe, missingTrack.get, missingTrack.get);
  return (
    <SectionFrame id="tracks" active={active}>
      {missing && (
        <p className="v4-sec-text" role="status">
          Track not found: {missing}. Here are all the tracks.
        </p>
      )}
      <PlayList items={TRACKS} queue={TRACK_QUEUE} tab={tabOf(focusable)} label="Tracks" active={active} />
    </SectionFrame>
  );
};

export default Tracks;
