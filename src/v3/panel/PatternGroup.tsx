/**
 * PATTERN GROUP : le rotary I a IV du 303 (radios natives, un seul arret
 * de tabulation, fleches a l'interieur). Le pointeur tourne en 260 ms
 * easeOutBack. Sous 768 px il devient un segmented control I II III IV.
 * Le groupe actif est ecrit en toutes lettres sous le titre (FEATURED,
 * ORIGINALS...) : lisible partout, tactile compris, sans survol.
 */

import React from 'react';
import { GROUP_IDS, GROUP_LABELS, GROUP_ROMAN, type GroupId } from '../data/beads';

interface PatternGroupProps {
  value: GroupId;
  onChange: (g: GroupId) => void;
}

const ANGLES: Record<GroupId, number> = { 1: -54, 2: -18, 3: 18, 4: 54 };

const PatternGroup: React.FC<PatternGroupProps> = ({ value, onChange }) => (
  <fieldset className="v3-rotary" role="radiogroup" aria-label="Pattern group" aria-describedby="v3-rotary-legend">
    <legend className="v3-label v3-rotary-title">
      PATTERN GROUP
      <span className="v3-rotary-current" aria-hidden="true">
        {GROUP_LABELS[value]}
      </span>
    </legend>
    <div className="v3-rotary-dial" aria-hidden="true">
      <svg viewBox="0 0 64 64" focusable="false">
        {GROUP_IDS.map((g) => (
          <line
            key={g}
            x1="32"
            y1="4"
            x2="32"
            y2="9"
            className="v3-knob-tick"
            transform={`rotate(${ANGLES[g]} 32 32)`}
          />
        ))}
        <circle cx="32" cy="32" r="19" className="v3-knob-cap" />
        <circle cx="32" cy="32" r="15" className="v3-knob-cap-inner" />
        <line
          x1="32"
          y1="16"
          x2="32"
          y2="25"
          className="v3-knob-index v3-rotary-pointer"
          style={{ transform: `rotate(${ANGLES[value]}deg)` }}
        />
      </svg>
    </div>
    <div className="v3-rotary-ticks">
      {GROUP_IDS.map((g) => (
        <label key={g} className={`v3-rotary-tick${value === g ? ' is-active' : ''}`}>
          <input
            type="radio"
            name="v3-group"
            value={g}
            checked={value === g}
            onChange={() => onChange(g)}
            aria-label={`Pattern group ${GROUP_ROMAN[g]}, ${GROUP_LABELS[g].toLowerCase()}`}
          />
          <span>{GROUP_ROMAN[g]}</span>
        </label>
      ))}
    </div>
    <span id="v3-rotary-legend" className="v3-sr">
      I featured, II originals, III remixes, IV mixtapes.
    </span>
  </fieldset>
);

export default React.memo(PatternGroup);
