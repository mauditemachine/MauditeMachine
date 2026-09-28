/**
 * Le display du panneau : titre + meta de la perle affichee (selection ou
 * piste courante), les mots d'etat (LOADING, PAUSED, Tap RUN again., Not on
 * SoundCloud.), le timecode, le notice "Skipped: ..." en rouge, la vignette
 * 48 px des mixtapes. Tout etat est dit en toutes lettres.
 */

import React, { useEffect, useRef, useState } from 'react';
import { beadMeta, fmtTime, type Bead } from '../data/beads';
import type { V3State } from '../state/bridge';

interface DisplayProps {
  bead: Bead | null;
  state: V3State;
  isCurrent: boolean;
  notice: string | null;
  progress: number;
  duration: number;
  timedOut: boolean;
  isMobile: boolean;
}

const Display: React.FC<DisplayProps> = ({ bead, state, isCurrent, notice, progress, duration, timedOut, isMobile }) => {
  const titleRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = titleRef.current;
    if (!el || !isMobile) {
      setOverflow(false);
      return;
    }
    setOverflow(el.scrollWidth > el.clientWidth + 2);
  }, [bead, isMobile]);

  let word: React.ReactNode = null;
  if (bead && !bead.playable) {
    word = (
      <>
        Not on SoundCloud.{' '}
        <a href={bead.track.link} target="_blank" rel="noopener" className="v3-display-link">
          Listen on Bandcamp
        </a>
      </>
    );
  } else if (timedOut) word = 'Tap RUN again.';
  else if (state === 'loading') word = 'LOADING';
  else if (state === 'paused' && isCurrent) word = 'PAUSED';

  return (
    <div className="v3-display" aria-live="off">
      {bead ? (
        <div key={bead.id} className="v3-display-track">
          {bead.mixtape?.artwork && (
            <img
              className="v3-display-art"
              src={bead.mixtape.artwork}
              alt=""
              width={48}
              height={48}
              loading="lazy"
              decoding="async"
            />
          )}
          <div className="v3-display-text">
            <span className={`v3-display-title${overflow ? ' is-marquee' : ''}`}>
              <span ref={titleRef} className="v3-display-title-inner">
                {bead.track.title}
              </span>
            </span>
            <span className="v3-display-meta">{beadMeta(bead)}</span>
          </div>
        </div>
      ) : (
        <p className="v3-display-idle">{isMobile ? 'Tap a bead, then RUN.' : 'Pick a track on the line, then RUN.'}</p>
      )}
      <div className="v3-display-status">
        {notice ? (
          <span className="v3-display-notice" role="status">
            Skipped: {notice}
          </span>
        ) : (
          <span className={`v3-display-word${state === 'loading' && !timedOut ? ' is-loading' : ''}`} role="status">
            {word}
          </span>
        )}
        {isCurrent && (
          <span className="v3-display-time">
            {fmtTime(progress * duration)} / {fmtTime(duration)}
          </span>
        )}
      </div>
    </div>
  );
};

export default Display;
