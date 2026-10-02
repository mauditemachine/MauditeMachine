/**
 * Pieces communes des sections (spec 11.1 et 20.5) : le cadre (section,
 * titre en Robot Radicals, lie par aria-labelledby), la ligne de document
 * a telecharger (LIVE) et la liste jouable de TRACKS et MIXTAPES. Le texte
 * de toutes les sections est dans le DOM des le chargement : une section
 * inactive est masquee visuellement (v4.css .v4-sec[data-active='0']), pas
 * retiree, et ses controles sortent de l'ordre de tabulation (tabIndex -1)
 * tant qu'elle n'est pas affichee. Les liens sortants : ui/ExternalLink.tsx.
 */

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import type { V2Track } from '../../../v2/context/AudioPlayerContext';
import { playItem } from '../../actions';
import { sc } from '../../audio/soundcloud';
import { fmtTime, type PlayItem } from '../../data';
import { SECTION_TITLES, type SectionId } from '../../theme';
import { ExternalLink } from '../ExternalLink';

export interface SectionProps {
  /** affichee (panneau ouvert sur elle, ou page de repli) */
  active: boolean;
  /** ses liens et boutons entrent dans l'ordre de tabulation */
  focusable: boolean;
}

export const tabOf = (focusable: boolean): number => (focusable ? 0 : -1);

export const SectionFrame: React.FC<{ id: SectionId; active: boolean; lang?: string; children: React.ReactNode }> = ({ id, active, lang, children }) => (
  <section
    className="v4-sec"
    id={`v4-section-${id}`}
    data-section={id}
    data-active={active ? '1' : '0'}
    aria-labelledby={`v4-sec-${id}-title`}
    lang={lang}
  >
    <h2 className="v4-sec-title" id={`v4-sec-${id}-title`}>
      {SECTION_TITLES[id]}
    </h2>
    {children}
  </section>
);

/** Fleche vers le bas sur sa ligne de base : un document a telecharger (12 px, couleur du lien). */
export const DownloadMark: React.FC = () => (
  <svg className="v4-dl" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
    <path d="M6 2v7M2.5 5.5L6 9l3.5-3.5M2.5 11h7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface DocLinkProps {
  href: string;
  label: string;
  /** taille du fichier, "0.9 MB" */
  size: string;
  tab: number;
}

/**
 * Un document du site a telecharger (attribut download : le fichier, pas
 * un onglet) : la fleche a gauche, le libelle, la taille a droite en petit
 * (spec 20.5). Au moins 44 px de haut, comme toute ligne du panneau.
 */
export const DocLink: React.FC<DocLinkProps> = ({ href, label, size, tab }) => (
  <a className="v4-link v4-doc" href={href} download tabIndex={tab}>
    <DownloadMark />
    <span className="v4-doc-label">{label}</span>
    {/* L'espace separe le nom et la taille dans le nom accessible ; le flex l'ignore */}{' '}
    <span className="v4-doc-size">{size}</span>
  </a>
);

interface PlayListProps {
  items: readonly PlayItem[];
  queue: V2Track[];
  tab: number;
  label: string;
  /** la section est affichee : le widget SoundCloud se prechauffe */
  active: boolean;
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
 * Barre de position de la piste courante (2026-10-01), sous sa ligne : un
 * curseur natif (souris, doigt, fleches du clavier) qui fait avancer la
 * lecture (sc.seek). Il suit l'avancement 4 fois par seconde pendant la
 * lecture ; son clic ne touche pas a la ligne (lecture, pause).
 */
const RowSeek: React.FC<{ title: string; tab: number }> = ({ title, tab }) => {
  const st = useSyncExternalStore(sc.subscribe, sc.get, sc.get);
  const [p, setP] = useState(sc.progress());
  useEffect(() => {
    setP(sc.progress());
    if (st.status !== 'playing') return undefined;
    const id = window.setInterval(() => setP(sc.progress()), 250);
    return () => window.clearInterval(id);
  }, [st.status, st.id]);
  const dur = st.duration;
  if (dur <= 0) return null;
  const stop = (e: React.SyntheticEvent): void => e.stopPropagation();
  return (
    <input
      className="v4-seek"
      type="range"
      min={0}
      max={1000}
      step={1}
      value={Math.round(p * 1000)}
      tabIndex={tab}
      aria-label={`Position in ${title}`}
      aria-valuetext={`${fmtTime(p * dur)} of ${fmtTime(dur)}`}
      onClick={stop}
      onPointerDown={stop}
      onKeyDown={stop}
      onChange={(e) => {
        const r = Number(e.target.value) / 1000;
        if (sc.seek(r)) setP(r);
      }}
    />
  );
};

/** Lien Buy d'une piste (page Bandcamp, nouvel onglet) : son clic ne lance pas la lecture de la ligne. */
const BuyLink: React.FC<{ href: string; title: string; tab: number }> = ({ href, title, tab }) => (
  <ExternalLink
    className="v4-row-link v4-row-buy"
    href={href}
    tabIndex={tab}
    aria-label={`Buy ${title} on Bandcamp`}
    onClick={(e: React.MouseEvent) => e.stopPropagation()}
  >
    Buy
  </ExternalLink>
);

/**
 * Lignes jouables : titre et meta en texte simple (selectionnables : un
 * bouton ne se selectionne pas a la souris), un bouton sans texte etendu
 * sous eux sur toute la ligne pour le clavier et les lecteurs d'ecran
 * (aria-label "Play {titre}", aria-describedby la meta). Un clic n'importe
 * ou sur la ligne lance, met en pause ou reprend la piste par le moteur
 * SoundCloud (actions.playItem). Le widget se prechauffe des que la liste
 * s'affiche (sc.warm) : le premier clic part dans le geste. La ligne
 * courante : point jaune, titre en yellowHi, aria-current sur son bouton.
 * Chaque piste porte un lien Buy vers sa page Bandcamp (2026-09-30) ; les
 * pistes absentes de SoundCloud n'ont que lui.
 */
export const PlayList: React.FC<PlayListProps> = ({ items, queue, tab, label, active }) => {
  const st = useSyncExternalStore(sc.subscribe, sc.get, sc.get);
  useEffect(() => {
    if (active) sc.warm(queue[0]);
  }, [active, queue]);
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
              <BuyLink href={it.buy ?? it.link} title={it.title} tab={tab} />
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
            data-buy={it.buy ? '1' : undefined}
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
            {current && (st.status === 'playing' || st.status === 'paused') && <RowSeek title={it.title} tab={tab} />}
            {it.buy && <BuyLink href={it.buy} title={it.title} tab={tab} />}
          </li>
        );
      })}
    </ol>
  );
};
