/**
 * Pieces communes des sections (spec 11.1) : le cadre (section, titre en
 * Robot Radicals, lie par aria-labelledby) et la liste jouable de TRACKS et
 * MIXTAPES. Le texte de toutes les sections est dans le DOM des le
 * chargement : une section inactive est masquee visuellement (v4.css
 * .v4-sec[data-active='0']), pas retiree, et ses controles sortent de
 * l'ordre de tabulation (tabIndex -1) tant qu'elle n'est pas affichee.
 */

import React, { useSyncExternalStore } from 'react';
import type { V2Track } from '../../../v2/context/AudioPlayerContext';
import { playItem } from '../../actions';
import { sc } from '../../audio/soundcloud';
import type { PlayItem } from '../../data';
import { SECTION_TITLES, type SectionId } from '../../theme';

export interface SectionProps {
  /** affichee (panneau ouvert sur elle, ou page de repli) */
  active: boolean;
  /** ses liens et boutons entrent dans l'ordre de tabulation */
  focusable: boolean;
}

export const tabOf = (focusable: boolean): number => (focusable ? 0 : -1);

export const SectionFrame: React.FC<{ id: SectionId; active: boolean; children: React.ReactNode }> = ({ id, active, children }) => (
  <section className="v4-sec" id={`v4-section-${id}`} data-section={id} data-active={active ? '1' : '0'} aria-labelledby={`v4-sec-${id}-title`}>
    <h2 className="v4-sec-title" id={`v4-sec-${id}-title`}>
      {SECTION_TITLES[id]}
    </h2>
    {children}
  </section>
);

/** Fleche discrete des liens qui ouvrent un nouvel onglet. */
export const ExternalMark: React.FC = () => (
  <svg className="v4-ext" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
    <path d="M3.5 2.5h6v6M9.5 2.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface PlayListProps {
  items: readonly PlayItem[];
  queue: V2Track[];
  tab: number;
  label: string;
}

/**
 * Clic sur une ligne jouable : lecture, pause ou reprise. Le texte reste
 * selectionnable et copiable (brief) : un clic qui termine une selection
 * dans la ligne (glisser) ou le second d'un double clic ne joue rien. Le
 * clavier et les lecteurs d'ecran passent par le bouton de la ligne, dont
 * le clic remonte ici (detail 0 : jamais filtre).
 */
function rowClick(e: React.MouseEvent<HTMLLIElement>, track: V2Track, queue: V2Track[]): void {
  if (e.detail > 1) return;
  if (e.detail === 1) {
    const sel = window.getSelection();
    if (sel && !sel.isCollapsed && sel.toString().trim() !== '' && e.currentTarget.contains(sel.anchorNode)) return;
  }
  playItem(track, queue);
}

/**
 * Lignes jouables : titre et meta en texte simple (selectionnables : un
 * bouton ne se selectionne pas a la souris), un bouton sans texte etendu
 * sous eux sur toute la ligne pour le clavier et les lecteurs d'ecran
 * (aria-label "Play {titre}", aria-describedby la meta). Un clic n'importe
 * ou sur la ligne lance, met en pause ou reprend la piste par le moteur
 * SoundCloud (actions.playItem ; l'iframe du widget ne nait qu'a ce premier
 * clic). La ligne courante : point jaune, titre en yellowHi, aria-current
 * sur son bouton. Les pistes absentes de SoundCloud renvoient a Bandcamp.
 */
export const PlayList: React.FC<PlayListProps> = ({ items, queue, tab, label }) => {
  const st = useSyncExternalStore(sc.subscribe, sc.get, sc.get);
  return (
    <ol className="v4-list" aria-label={label}>
      {items.map((it) => {
        const metaId = `v4-meta-${it.id}`;
        if (!it.playable) {
          return (
            <li key={it.id} className="v4-row v4-row-off">
              <span className="v4-row-body">
                <span className="v4-row-title">{it.title}</span>
                <span className="v4-row-meta">not on SoundCloud</span>
              </span>
              <a className="v4-row-link" href={it.link} target="_blank" rel="noopener" tabIndex={tab}>
                Bandcamp
                <ExternalMark />
              </a>
            </li>
          );
        }
        const current = st.id === it.id;
        const busy = current && (st.status === 'playing' || st.status === 'loading');
        return (
          <li
            key={it.id}
            className="v4-row v4-row-play"
            data-current={current ? '1' : undefined}
            data-state={current ? st.status : undefined}
            onClick={(e) => rowClick(e, it.track, queue)}
          >
            <button
              type="button"
              className="v4-row-btn"
              tabIndex={tab}
              aria-current={current ? 'true' : undefined}
              aria-label={`${busy ? 'Pause' : 'Play'} ${it.title}`}
              aria-describedby={metaId}
            />
            <span className="v4-row-title">{it.title}</span>
            <span className="v4-row-meta" id={metaId}>
              {it.meta}
            </span>
          </li>
        );
      })}
    </ol>
  );
};
