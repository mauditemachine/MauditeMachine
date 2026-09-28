/**
 * Ruler des annees (bureau, bord droit) : un clic dolly la camera en 1.1 s.
 * L'annee active suit la perle affichee.
 */

import React from 'react';
import { RULER } from '../data/beads';

interface RulerProps {
  activeT: number | null;
  onJump: (t: number) => void;
}

const Ruler: React.FC<RulerProps> = ({ activeT, onJump }) => {
  let active = -1;
  if (activeT !== null) {
    for (let i = 0; i < RULER.length; i += 1) if (RULER[i].t <= activeT + 1e-6) active = i;
  }
  return (
    <nav className="v3-ruler" aria-label="Years">
      {RULER.map((y, i) => (
        <button
          key={y.label}
          type="button"
          className={`v3-ruler-btn${i === active ? ' is-active' : ''}`}
          aria-current={i === active ? 'true' : undefined}
          onClick={() => onJump(y.t)}
        >
          {y.label}
        </button>
      ))}
    </nav>
  );
};

export default Ruler;
