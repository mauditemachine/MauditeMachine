/**
 * CONTACT (spec 11.1 et 20.4 ; 2026-10-01 : les liens en tete). Dans
 * l'ordre : les 15 reseaux (data/socials.ts), chacun avec sa vraie icone
 * de marque (ui/icons.tsx), bone au repos, la couleur de la marque au
 * survol et au focus ; puis les liens (le label VRSTL Records, SONAA,
 * Massive Medias : data.ts CONTACT_LINKS), tous en nouvel onglet, sans
 * opener ni referer ; puis les deux contacts booking (BOOKING_CONTACTS de
 * la v2, adresse en mailto) ; enfin le formulaire (ContactForm.tsx), un
 * vrai courriel a Mika, objet pre-rempli selon d'ou arrive le visiteur.
 * Les liens sont visibles a l'ouverture, sans defiler.
 */

import React from 'react';
import { CONTACTS, CONTACT_LINKS, SOCIALS } from '../../data';
import { ExternalLink } from '../ExternalLink';
import { SOCIAL_ICONS } from '../icons';
import { SectionFrame, tabOf, type SectionProps } from './common';
import { ContactForm } from './ContactForm';

export const Contact: React.FC<SectionProps> = ({ active, focusable }) => {
  const tab = tabOf(focusable);
  return (
    <SectionFrame id="contact" active={active}>
      <ul className="v4-socials" aria-label="Social links">
        {SOCIALS.map((s) => {
          const Icon = SOCIAL_ICONS[s.id];
          return (
            <li key={s.id}>
              <ExternalLink
                className="v4-social"
                href={s.href}
                aria-label={s.label}
                tabIndex={tab}
                mark={false}
                style={{ '--brand': s.color } as React.CSSProperties}
              >
                <Icon />
              </ExternalLink>
            </li>
          );
        })}
      </ul>
      <ul className="v4-links v4-contact-extra">
        {CONTACT_LINKS.map((l) => (
          <li key={l.href}>
            <ExternalLink className="v4-link" href={l.href} tabIndex={tab}>
              <span>{l.label}</span>
            </ExternalLink>
          </li>
        ))}
      </ul>
      <h3 className="v4-sec-sub">Booking</h3>
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
      <h3 className="v4-sec-sub">Write to me</h3>
      <ContactForm tab={tab} />
    </SectionFrame>
  );
};

export default Contact;
