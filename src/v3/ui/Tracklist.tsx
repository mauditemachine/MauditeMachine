/**
 * La tracklist : sections I a IV avec compte, un vrai bouton par piste
 * jouable et par mixtape (une ligne JOUE), une ancre Bandcamp pour les
 * injouables. La ligne courante porte un point rouge et aria-current.
 * Aussi rendue inline (page sans WebGL).
 */

import React from 'react';
import { GROUPS, GROUP_IDS, GROUP_LABELS, GROUP_ROMAN, type Bead, type GroupId } from '../data/beads';

interface TracklistProps {
  currentId: string | null;
  playing: boolean;
  onPlay: (b: Bead) => void;
  inline?: boolean;
}

const Row: React.FC<{ bead: Bead; n: number; current: boolean; playing: boolean; onPlay: (b: Bead) => void }> = ({
  bead,
  n,
  current,
  playing,
  onPlay,
}) => {
  const nn = String(n).padStart(2, '0');
  const right = bead.mixtape ? bead.mixtape.duration : String(bead.year);
  if (!bead.playable) {
    return (
      <li className="v3-row is-unplayable">
        <span className="v3-row-num">{nn}</span>
        <span className="v3-row-title">{bead.track.title}</span>
        <span className="v3-row-meta">not on SoundCloud</span>
        <a className="v3-row-link" href={bead.track.link} target="_blank" rel="noopener">
          Bandcamp
        </a>
      </li>
    );
  }
  return (
    <li className={`v3-row${current ? ' is-current' : ''}`}>
      <button
        type="button"
        className="v3-row-btn"
        aria-label={`${current && playing ? 'Pause' : 'Play'} ${bead.track.title}, ${bead.year}, ${bead.categoryLabel}`}
        aria-current={current ? 'true' : undefined}
        onClick={() => onPlay(bead)}
      >
        {bead.mixtape?.artwork ? (
          <img className="v3-row-art" src={bead.mixtape.artwork} alt="" width={40} height={40} loading="lazy" decoding="async" />
        ) : (
          <span className="v3-row-num">{nn}</span>
        )}
        <span className="v3-row-title">
          <i className="v3-row-dot" aria-hidden="true" />
          {bead.track.title}
        </span>
        <span className="v3-row-year">{right}</span>
      </button>
    </li>
  );
};

const Tracklist: React.FC<TracklistProps> = ({ currentId, playing, onPlay, inline = false }) => (
  <div className={`v3-tracklist${inline ? ' is-inline' : ''}`}>
    {inline && <h2 className="v3-drawer-title">TRACKLIST</h2>}
    {GROUP_IDS.map((g: GroupId) => (
      <section key={g} className="v3-tl-section" aria-label={`${GROUP_ROMAN[g]} ${GROUP_LABELS[g]}`}>
        <h3 className="v3-tl-head">
          <span className="v3-tl-roman">{GROUP_ROMAN[g]}</span>
          <span>{GROUP_LABELS[g]}</span>
          <span className="v3-tl-count">{GROUPS[g].length}</span>
        </h3>
        <ul className="v3-tl-list">
          {GROUPS[g].map((b, i) => (
            <Row key={b.id} bead={b} n={i + 1} current={currentId === b.id} playing={playing} onPlay={onPlay} />
          ))}
        </ul>
      </section>
    ))}
  </div>
);

export default Tracklist;
