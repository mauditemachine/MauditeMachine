/**
 * Le display du panneau : titre + meta de la perle affichee (selection ou
 * piste courante), les mots d'etat (LOADING, PAUSED, Press RUN again., Not
 * on SoundCloud.), le timecode, le notice "Skipped: ..." en rouge, la
 * vignette 48 px des mixtapes. Tout etat est dit en toutes lettres ; la
 * region live globale (V3App) les annonce, ici rien n'est role=status.
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
  reduced: boolean;
}

const Display: React.FC<DisplayProps> = ({ bead, state, isCurrent, notice, progress, duration, timedOut, isMobile, reduced }) => {
  const titleRef = useRef<HTMLSpanElement>(null);
  const [overflow, setOverflow] = useState(false);

  useEffect(() => {
    const el = titleRef.current;
    // Reduced motion : pas de defilement, le titre long garde son ellipse
    if (!el || !isMobile || reduced) {
      setOverflow(false);
      return;
    }
    setOverflow(el.scrollWidth > el.clientWidth + 2);
  }, [bead, isMobile, reduced]);

  const unplayable = !!bead && !bead.playable;
  let word: string | null = null;
  if (timedOut) word = isMobile ? 'Tap RUN again.' : 'Press RUN again.';
  else if (state === 'loading') word = 'LOADING';
  else if (state === 'paused' && isCurrent) word = 'PAUSED';
  const loading = state === 'loading' && !timedOut;

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
          <span className="v3-display-notice">Skipped: {notice}</span>
        ) : unplayable && bead ? (
          // Sa propre ligne, qui replie : le lien Bandcamp reste atteignable
          // dans les colonnes etroites (mobile, tablette)
          <span className="v3-display-word v3-display-word--wrap">
            Not on SoundCloud.{' '}
            <a href={bead.track.link} target="_blank" rel="noopener" className="v3-display-link">
              Bandcamp
            </a>
          </span>
        ) : (
          <span className={`v3-display-word${loading ? ' is-loading' : ''}`}>{word}</span>
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
