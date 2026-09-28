/**
 * Les 16 pas du 303 : remplissage de progression (LED au-dessus de chaque
 * case), pas courant qui clignote a 1 Hz en lecture, chasse a 300 ms en
 * chargement, double flash au notice. Un seul element focusable : la ligne
 * est un role slider 0..16 (fleches = un seizieme) ; les cases sont des
 * cibles pointeur, sur mobile toute la ligne est une cible de 44 px.
 */

import React, { useRef } from 'react';

interface StepsProps {
  progress: number;
  hasCurrent: boolean;
  playing: boolean;
  loading: boolean;
  noticeKey: number;
  onSeek: (ratio: number) => void;
}

const CELLS = Array.from({ length: 16 }, (_, i) => i);

const Steps: React.FC<StepsProps> = ({ progress, hasCurrent, playing, loading, noticeKey, onSeek }) => {
  const rowRef = useRef<HTMLDivElement>(null);
  const filled = Math.floor(progress * 16 + 1e-6);

  const seekAt = (clientX: number) => {
    const el = rowRef.current;
    if (!el || !hasCurrent) return;
    const r = el.getBoundingClientRect();
    const k = Math.max(0, Math.min(15, Math.floor(((clientX - r.left) / r.width) * 16)));
    onSeek(k / 16);
  };

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (!hasCurrent) return;
    let k: number | null = null;
    const cur = Math.round(progress * 16);
    switch (e.key) {
      case 'ArrowRight':
      case 'ArrowUp':
        k = Math.min(16, cur + 1);
        break;
      case 'ArrowLeft':
      case 'ArrowDown':
        k = Math.max(0, cur - 1);
        break;
      case 'Home':
        k = 0;
        break;
      case 'End':
        k = 15;
        break;
      default:
    }
    if (k !== null) {
      e.preventDefault();
      e.stopPropagation();
      onSeek(k / 16);
    }
  };

  return (
    <div
      ref={rowRef}
      className={`v3-steps${loading ? ' is-loading' : ''}${playing ? ' is-playing' : ''}`}
      role="slider"
      tabIndex={0}
      aria-label="Position"
      aria-valuemin={0}
      aria-valuemax={16}
      aria-valuenow={Math.round(progress * 16)}
      aria-valuetext={`${Math.round(progress * 100)} percent`}
      aria-disabled={!hasCurrent}
      data-notice={noticeKey}
      onPointerDown={(e) => seekAt(e.clientX)}
      onKeyDown={onKeyDown}
    >
      {CELLS.map((k) => (
        <span
          key={k}
          className={`v3-step${k < filled ? ' is-lit' : ''}${hasCurrent && k === filled && k < 16 ? ' is-current' : ''}`}
          style={{ animationDelay: loading ? `${k * 300}ms` : undefined }}
          aria-hidden="true"
        >
          <i className="v3-led" />
          <b className="v3-step-cell" />
        </span>
      ))}
    </div>
  );
};

export default Steps;
