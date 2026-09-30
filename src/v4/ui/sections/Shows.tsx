/**
 * SHOWS (spec 11.1) : les dates a venir de public/events.json (lu une fois
 * par page, au montage, pour que le texte soit dans le DOM des le
 * chargement), de la plus proche a la plus lointaine. Aucune date ou
 * lecture en echec (5 s au plus) : "No upcoming dates.". Le lien "All
 * shows" vers /shows est retire (2026-09-30) : /v4 est devenue la page
 * d'accueil et /shows y renvoyait. Les pages des dates s'ouvrent en nouvel
 * onglet (chevron sortant).
 */

import React, { useEffect, useState } from 'react';
import { SHOWS_EMPTY, fetchShows, fmtShowDate, type Show } from '../../data';
import { ExternalLink } from '../ExternalLink';
import { SectionFrame, tabOf, type SectionProps } from './common';

export const Shows: React.FC<SectionProps> = ({ active, focusable }) => {
  const [shows, setShows] = useState<Show[] | null>(null);
  const tab = tabOf(focusable);

  useEffect(() => {
    let alive = true;
    fetchShows().then((s) => {
      if (alive) setShows(s);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SectionFrame id="shows" active={active}>
      {shows !== null && shows.length === 0 && <p className="v4-sec-text">{SHOWS_EMPTY}</p>}
      {shows !== null && shows.length > 0 && (
        <ol className="v4-list" aria-label="Upcoming shows">
          {shows.map((s) => {
            const body = (
              <>
                <time className="v4-show-date" dateTime={s.date}>
                  {fmtShowDate(s.date)}
                </time>
                <span className="v4-row-title">{s.title}</span>
                {s.location && <span className="v4-row-meta">{s.location}</span>}
              </>
            );
            return (
              <li key={`${s.date}-${s.title}`} className="v4-row">
                {s.url ? (
                  <ExternalLink className="v4-show" href={s.url} tabIndex={tab}>
                    {body}
                  </ExternalLink>
                ) : (
                  <span className="v4-show">{body}</span>
                )}
              </li>
            );
          })}
        </ol>
      )}
    </SectionFrame>
  );
};

export default Shows;
