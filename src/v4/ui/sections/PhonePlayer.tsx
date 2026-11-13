/**
 * Le lecteur du telephone (2026-11-13, Mika : "supprime le deck, ne mets rien d'autre en mobile ! et si les gens
 * cliquent sur Tracks dans le menu alors tu as un lecteur simple pour ecouter les tracks de maudite machine et mets
 * les covers") : TRACKS et MIXTAPES au telephone (theme.ts PORTRAIT), a la place des listes de texte.
 *
 * En tete, collee en haut quand la liste defile : le morceau en cours (ou le premier de la liste, pret a partir), sa
 * pochette, son titre, PRECEDENT, LECTURE / PAUSE, SUIVANT, la position (un curseur natif : doigt, clavier) et le lien
 * Buy de sa page Bandcamp. Dessous, la liste avec les pochettes : une tape joue le morceau, une autre le met en pause.
 * Le moteur est celui des listes du desktop (actions.playItem, audio/soundcloud.ts, le widget SoundCloud) ; la file
 * est la liste affichee, dans son ordre. Un morceau absent de SoundCloud mene a Bandcamp.
 */

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import type { V2Track } from '../../../v2/context/AudioPlayerContext';
import { playItem } from '../../actions';
import { sc } from '../../audio/soundcloud';
import { fmtTime, type PlayItem } from '../../data';
import { ExternalLink } from '../ExternalLink';
import './player.css';

interface Props {
  items: readonly PlayItem[];
  queue: V2Track[];
  tab: number;
  label: string;
  /** la section est affichee : le widget SoundCloud se prechauffe */
  active: boolean;
}

const PlayIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
    <path d="M8 5.5v13l10.5-6.5z" fill="currentColor" />
  </svg>
);

const PauseIcon: React.FC = () => (
  <svg viewBox="0 0 24 24" width="26" height="26" aria-hidden="true" focusable="false">
    <path d="M7 5.5h3.6v13H7zM13.4 5.5H17v13h-3.6z" fill="currentColor" />
  </svg>
);

const SkipIcon: React.FC<{ back?: boolean }> = ({ back }) => (
  <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true" focusable="false" style={back ? { transform: 'scaleX(-1)' } : undefined}>
    <path d="M6 6.5v11l8.5-5.5zM16.5 6.5h2.2v11h-2.2z" fill="currentColor" />
  </svg>
);

/** Une pochette (carre), ou un aplat sans image. */
const Cover: React.FC<{ src: string | null; size: number; className: string; alt?: string; eager?: boolean }> = ({ src, size, className, alt = '', eager }) =>
  src ? (
    <img className={className} src={src} width={size} height={size} alt={alt} loading={eager ? 'eager' : 'lazy'} decoding="async" draggable={false} />
  ) : (
    <span className={`${className} v4-tp-blank`} aria-hidden="true" />
  );

/** La position du morceau en cours : un curseur et les deux temps ; eteinte sans morceau de cette liste. */
const Position: React.FC<{ on: boolean; title: string; tab: number }> = ({ on, title, tab }) => {
  const st = useSyncExternalStore(sc.subscribe, sc.get, sc.get);
  const [p, setP] = useState(on ? sc.progress() : 0);
  useEffect(() => {
    setP(on ? sc.progress() : 0);
    if (!on || st.status !== 'playing') return undefined;
    const id = window.setInterval(() => setP(sc.progress()), 250);
    return () => window.clearInterval(id);
  }, [on, st.status, st.id]);
  const dur = on ? st.duration : 0;
  return (
    <div className="v4-tp-pos">
      <input
        className="v4-tp-seek"
        type="range"
        min={0}
        max={1000}
        step={1}
        value={Math.round(p * 1000)}
        disabled={dur <= 0}
        tabIndex={tab}
        aria-label={`Position in ${title}`}
        aria-valuetext={`${fmtTime(p * dur)} of ${fmtTime(dur)}`}
        style={{ '--p': `${(p * 100).toFixed(2)}%` } as React.CSSProperties}
        onChange={(e) => {
          const r = Number(e.target.value) / 1000;
          if (sc.seek(r)) setP(r);
        }}
      />
      <span className="v4-tp-time" aria-hidden="true">
        <span>{fmtTime(p * dur)}</span>
        <span>{dur > 0 ? fmtTime(dur) : '-:--'}</span>
      </span>
    </div>
  );
};

/** Trois barres qui dansent sur la ligne en cours (immobiles en pause, et sous la reduction des animations). */
const Bars: React.FC<{ on: boolean }> = ({ on }) => (
  <span className="v4-tp-bars" data-on={on ? '1' : '0'} aria-hidden="true">
    <i />
    <i />
    <i />
  </span>
);

export const PhonePlayer: React.FC<Props> = ({ items, queue, tab, label, active }) => {
  const st = useSyncExternalStore(sc.subscribe, sc.get, sc.get);
  useEffect(() => {
    if (active) sc.warm(queue[0]);
  }, [active, queue]);

  // Le morceau en tete : celui qui joue (s'il est de cette liste), sinon le premier jouable, pret a partir
  const cur = items.find((it) => it.id === st.id) ?? null;
  const shown = cur ?? items.find((it) => it.playable) ?? null;
  const status = cur ? st.status : 'idle';
  const playing = status === 'playing';
  const at = shown ? queue.findIndex((t) => t.id === shown.id) : -1;
  /** Le morceau d'avant ou d'apres dans la file (elle boucle). */
  const skip = (d: number): void => {
    if (queue.length === 0) return;
    const i = at < 0 ? 0 : (at + d + queue.length) % queue.length;
    playItem(queue[i], queue);
  };

  return (
    <div className="v4-tp">
      {shown && (
        <div className="v4-tp-now" data-state={status}>
          <Cover className="v4-tp-art" src={shown.cover} size={112} alt={`${shown.title}, cover`} eager />
          <div className="v4-tp-side">
            <p className="v4-tp-title">{shown.title}</p>
            <p className="v4-tp-sub">{shown.meta}</p>
            <div className="v4-tp-ctl">
              <button type="button" className="v4-tp-skip" tabIndex={tab} aria-label="Previous" onClick={() => skip(-1)}>
                <SkipIcon back />
              </button>
              <button
                type="button"
                className="v4-tp-play"
                tabIndex={tab}
                aria-label={`${playing || status === 'loading' ? 'Pause' : 'Play'} ${shown.title}`}
                onClick={() => playItem(shown.track, queue)}
              >
                {playing || status === 'loading' ? <PauseIcon /> : <PlayIcon />}
              </button>
              <button type="button" className="v4-tp-skip" tabIndex={tab} aria-label="Next" onClick={() => skip(1)}>
                <SkipIcon />
              </button>
              {shown.buy && (
                <ExternalLink className="v4-tp-buy" href={shown.buy} tabIndex={tab} aria-label={`Buy ${shown.title} on Bandcamp`}>
                  Buy
                </ExternalLink>
              )}
            </div>
          </div>
          <Position on={cur !== null} title={shown.title} tab={tab} />
          {cur && st.notice && (
            <p className="v4-tp-notice" role="status">
              {st.notice}
            </p>
          )}
        </div>
      )}
      <ol className="v4-tp-list" aria-label={label}>
        {items.map((it) => {
          if (!it.playable) {
            return (
              <li key={it.id} className="v4-tp-row" data-off="1">
                <ExternalLink className="v4-tp-hit" href={it.buy ?? it.link} tabIndex={tab} mark={false} aria-label={`${it.title}, on Bandcamp`}>
                  <Cover className="v4-tp-thumb" src={it.cover} size={52} />
                  <span className="v4-tp-body">
                    <span className="v4-tp-name">{it.title}</span>
                    <span className="v4-tp-meta">Bandcamp only</span>
                  </span>
                </ExternalLink>
              </li>
            );
          }
          const current = st.id === it.id;
          const busy = current && (st.status === 'playing' || st.status === 'loading');
          return (
            <li key={it.id} className="v4-tp-row" data-current={current ? '1' : undefined} data-state={current ? st.status : undefined}>
              <button
                type="button"
                className="v4-tp-hit"
                tabIndex={tab}
                aria-current={current ? 'true' : undefined}
                aria-label={`${busy ? 'Pause' : 'Play'} ${it.title}`}
                onClick={() => playItem(it.track, queue)}
              >
                <Cover className="v4-tp-thumb" src={it.cover} size={52} />
                <span className="v4-tp-body">
                  <span className="v4-tp-name">{it.title}</span>
                  <span className="v4-tp-meta">{it.meta}</span>
                </span>
                {current && <Bars on={st.status === 'playing'} />}
              </button>
            </li>
          );
        })}
      </ol>
    </div>
  );
};

export default PhonePlayer;
