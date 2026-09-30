/**
 * SHOWS (spec 11.1) : les dates a venir de public/events.json (lu une fois
 * par page, au montage, pour que le texte soit dans le DOM des le
 * chargement), de la plus proche a la plus lointaine. Aucune date ou
 * lecture en echec (5 s au plus) : "No upcoming dates." et le lien vers
 * /shows. Pendant la lecture, le lien vers /shows est deja la : la section
 * n'est jamais vide. Revision 2 : tous ses liens s'ouvrent en nouvel
 * onglet (chevron sortant), /shows compris : le visiteur ne quitte jamais
 * /v4 (brief, point 5).
 */

import React, { useEffect, useState } from 'react';
import { SHOWS_EMPTY, SHOWS_LINK, fetchShows, fmtShowDate, type Show } from '../../data';
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

  const allShows = (
    <ul className="v4-links">
      <li>
        <ExternalLink className="v4-link" href={SHOWS_LINK.href} tabIndex={tab}>
          <span>{SHOWS_LINK.label}</span>
        </ExternalLink>
      </li>
    </ul>
  );

  return (
    <SectionFrame id="shows" active={active}>
      {shows === null && allShows}
      {shows !== null && shows.length === 0 && (
        <>
          <p className="v4-sec-text">{SHOWS_EMPTY}</p>
          {allShows}
        </>
      )}
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
