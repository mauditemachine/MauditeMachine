/**
 * Infobulle de perle (souris uniquement) : "{titre}, {annee}", positionnee
 * au point projete, pointer-events none, fondu 120 ms.
 */

import React from 'react';

interface TooltipProps {
  x: number;
  y: number;
  text: string | null;
}

const Tooltip: React.FC<TooltipProps> = ({ x, y, text }) => (
  <div
    className={`v3-tooltip${text ? ' is-on' : ''}`}
    role="tooltip"
    aria-hidden={!text}
    style={{ transform: `translate(${Math.round(x) + 14}px, ${Math.round(y) - 10}px)` }}
  >
    {text}
  </div>
);

export default Tooltip;
