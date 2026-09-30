/**
 * CONTACT (spec 11.1 et 20.4) : les deux contacts booking
 * (BOOKING_CONTACTS de la v2 : libelle, nom s'il y en a un, adresse en
 * mailto), puis les 15 reseaux de la revision 2 (data/socials.ts, dans
 * l'ordre du brief), chacun avec sa vraie icone de marque (ui/icons.tsx)
 * en grille qui se remplit toute seule : cases egales d'au moins 44 px,
 * deux rangees sur desktop (8 + 7), trois sur telephone (5 + 5 + 5), jamais
 * une icone seule sur sa rangee (v4.css). Icones bone, jaunes au survol et
 * au focus ; chaque lien porte le nom du service et s'ouvre en nouvel
 * onglet, sans opener ni referer. Revision 4 : sous les adresses de
 * booking, Massive Medias (impression et merch), nouvel onglet.
 */

import React from 'react';
import { CONTACTS, MASSIVE_LINK, SOCIALS } from '../../data';
import { ExternalLink } from '../ExternalLink';
import { SOCIAL_ICONS } from '../icons';
import { SectionFrame, tabOf, type SectionProps } from './common';

export const Contact: React.FC<SectionProps> = ({ active, focusable }) => {
  const tab = tabOf(focusable);
  return (
    <SectionFrame id="contact" active={active}>
      <ul className="v4-contacts">
        {CONTACTS.map((c) => (
          <li key={c.id} className="v4-contact">
            <span className="v4-row-meta">{c.label.en}</span>
            <span className="v4-contact-line">
              {c.name && <span className="v4-contact-name">{c.name}, </span>}
              <a className="v4-contact-mail" href={`mailto:${c.email}`} tabIndex={tab}>
                {c.email}
              </a>
            </span>
          </li>
        ))}
      </ul>
      <ul className="v4-links v4-contact-extra">
        <li>
          <ExternalLink className="v4-link" href={MASSIVE_LINK.href} tabIndex={tab}>
            <span>{MASSIVE_LINK.contactLabel}</span>
          </ExternalLink>
        </li>
      </ul>
      <ul className="v4-socials" aria-label="Social links">
        {SOCIALS.map((s) => {
          const Icon = SOCIAL_ICONS[s.id];
          return (
            <li key={s.id}>
              <ExternalLink className="v4-social" href={s.href} aria-label={s.label} tabIndex={tab} mark={false}>
                <Icon />
              </ExternalLink>
            </li>
          );
        })}
      </ul>
    </SectionFrame>
  );
};

export default Contact;
