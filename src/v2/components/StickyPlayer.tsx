/**
 * Player sticky /v2 : barre fixe en bas, verre depoli blur(12px), z-9999.
 * HTML5 natif via AudioPlayerContext, zero iframe. Cachee tant qu'aucune
 * piste n'est chargee. fixed pose en style inline (piege .page > * du CSS
 * v1 : hors de .page ici, mais on ne prend aucun risque).
 */

import React, { useRef } from 'react';
import { useAudioPlayer } from '../context/AudioPlayerContext';

const fmt = (s: number) => {
  if (!Number.isFinite(s) || s <= 0) return '0:00';
  const m = Math.floor(s / 60);
  const r = Math.floor(s % 60);
  return `${m}:${r.toString().padStart(2, '0')}`;
};

const StickyPlayer: React.FC = () => {
  const { current, playing, progress, duration, queue, notice, toggle, next, prev, seek, close } =
    useAudioPlayer();
  const barRef = useRef<HTMLDivElement>(null);

  if (!current) return null;

  const onSeek = (e: React.MouseEvent<HTMLDivElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    seek((e.clientX - rect.left) / rect.width);
  };

  const onSeekKey = (e: React.KeyboardEvent) => {
    if (e.key === 'ArrowRight') seek(Math.min(1, progress + 0.05));
    if (e.key === 'ArrowLeft') seek(Math.max(0, progress - 0.05));
  };

  const idx = queue.findIndex((t) => t.id === current.id);

  return (
    <div
      ref={barRef}
      className="v2-player"
      style={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: 9999 }}
      role="region"
      aria-label="Lecteur audio"
    >
      <div
        className="v2-player-progress"
        role="slider"
        aria-label="Position de lecture"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={Math.round(progress * 100)}
        tabIndex={0}
        onClick={onSeek}
        onKeyDown={onSeekKey}
      >
        <div className="v2-player-progress-fill" style={{ width: `${progress * 100}%` }} />
      </div>

      <div className="v2-player-inner">
        {/* VU-metre : respire en lecture, gele en pause (CSS pur) */}
        <span className={`v2-vu${playing ? ' is-on' : ''}`} aria-hidden="true">
          <i /><i /><i /><i />
        </span>
        <div className="v2-player-meta">
          <span className="v2-player-title">{current.title}</span>
          <span className="v2-label v2-player-sub" role="status">
            {notice
              ? `« ${notice} » unavailable — skipped`
              : `${current.project} · ${current.year}`}
          </span>
        </div>

        <div className="v2-player-controls">
          <button type="button" className="v2-player-btn" aria-label="Piste précédente" onClick={prev}>
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M13 2v12L5 8zM3 2h2v12H3z" fill="currentColor" />
            </svg>
          </button>
          <button
            type="button"
            className="v2-player-btn v2-player-btn-main"
            aria-label={playing ? 'Pause' : 'Lecture'}
            onClick={toggle}
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
          </button>
          <button type="button" className="v2-player-btn" aria-label="Piste suivante" onClick={next}>
            <svg viewBox="0 0 16 16" width="13" height="13" aria-hidden="true">
              <path d="M3 2v12l8-6zM11 2h2v12h-2z" fill="currentColor" />
            </svg>
          </button>
        </div>

        <div className="v2-player-right">
          <span className="v2-label v2-player-time">
            {fmt(progress * duration)} / {fmt(duration)}
          </span>
          {queue.length > 1 && idx >= 0 && (
            <span className="v2-label v2-player-count">
              {idx + 1}/{queue.length}
            </span>
          )}
          <button type="button" className="v2-player-btn" aria-label="Fermer le lecteur" onClick={close}>
            <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </div>
      </div>
    </div>
  );
};

export default StickyPlayer;
