/**
 * Transport : BACK (prev), RUN/STOP (play ou toggle, aria-pressed = playing),
 * FWD (next). Le contour rouge de RUN respire quand une selection attend.
 */

import React from 'react';

interface TransportProps {
  runRef?: React.RefObject<HTMLButtonElement>;
  playing: boolean;
  hasCurrent: boolean;
  runEnabled: boolean;
  breathing: boolean;
  onRun: () => void;
  onBack: () => void;
  onFwd: () => void;
}

const Transport: React.FC<TransportProps> = ({ runRef, playing, hasCurrent, runEnabled, breathing, onRun, onBack, onFwd }) => (
  <div className="v3-transport" role="group" aria-label="Transport">
    <button
      type="button"
      className="v3-tbtn v3-tbtn-back"
      aria-label="Previous track"
      aria-disabled={!hasCurrent}
      onClick={onBack}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M13 2v12L5 8zM3 2h2v12H3z" fill="currentColor" />
      </svg>
      <span className="v3-tbtn-label">BACK</span>
    </button>
    <button
      ref={runRef}
      type="button"
      className={`v3-tbtn v3-tbtn-run${breathing ? ' is-breathing' : ''}${playing ? ' is-on' : ''}`}
      aria-label={playing ? 'Pause' : 'Play'}
      aria-pressed={playing}
      aria-disabled={!runEnabled}
      onClick={onRun}
    >
      {playing ? (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <rect x="2.5" y="2" width="4" height="12" fill="currentColor" />
          <rect x="9.5" y="2" width="4" height="12" fill="currentColor" />
        </svg>
      ) : (
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M3 2l11 6-11 6z" fill="currentColor" />
        </svg>
      )}
      <span className="v3-tbtn-label">RUN/STOP</span>
    </button>
    <button
      type="button"
      className="v3-tbtn v3-tbtn-fwd"
      aria-label="Next track"
      aria-disabled={!hasCurrent}
      onClick={onFwd}
    >
      <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
        <path d="M3 2v12l8-6zM11 2h2v12h-2z" fill="currentColor" />
      </svg>
      <span className="v3-tbtn-label">FWD</span>
    </button>
  </div>
);

export default Transport;
