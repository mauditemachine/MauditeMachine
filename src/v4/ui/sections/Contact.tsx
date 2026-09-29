/**
 * CONTACT (spec 11.1) : les deux contacts booking (BOOKING_CONTACTS de la
 * v2 : libelle, nom s'il y en a un, adresse en mailto), puis tous les
 * reseaux (SOCIALS) en grille compacte d'icones monochromes bone, jaunes au
 * survol et au focus.
 */

import React from 'react';
import { CONTACTS, SOCIALS } from '../../data';
import { SocialIcon } from '../SocialIcon';
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
      <ul className="v4-socials" aria-label="Social links">
        {SOCIALS.map((s) => (
          <li key={s.label}>
            <a className="v4-social" href={s.href} target="_blank" rel="noopener" aria-label={s.label} tabIndex={tab}>
              <SocialIcon icon={s.icon} label={s.label} />
            </a>
          </li>
        ))}
      </ul>
    </SectionFrame>
  );
};

export default Contact;
