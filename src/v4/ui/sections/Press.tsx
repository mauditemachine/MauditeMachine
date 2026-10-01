/**
 * PRESS (2026-10-01) : LIVE y est fondu, un seul pad. Une phrase, le setup
 * et la duree des sets, deux demandes par le formulaire de CONTACT (un
 * set, objet Booking - live set ; une interview, objet Press), puis les
 * documents : le press kit 2027, qui s'ouvre dans la visionneuse devant la
 * machine (ui/PresskitViewer.tsx, six pages, en anglais), la fiche
 * technique a telecharger (attribut download, fleche a gauche, taille a
 * droite), /press/ et /techrider en nouvel onglet (chevron sortant).
 */

import React from 'react';
import { openContact } from '../../actions';
import { LIVE_DOCS, LIVE_PAGES, PRESS_SETUP, PRESS_TEXT } from '../../data';
import { presskit } from '../../state/presskit';
import { ExternalLink } from '../ExternalLink';
import { DocLink, SectionFrame, tabOf, type SectionProps } from './common';

/** Le press kit : un vrai lien vers le PDF, que le clic ouvre en popup. */
const KitLink: React.FC<{ href: string; label: string; size: string; tab: number }> = ({ href, label, size, tab }) => (
  <a
    className="v4-link v4-doc"
    href={href}
    tabIndex={tab}
    aria-haspopup="dialog"
    onClick={(e) => {
      if (e.button !== 0 || e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
      e.preventDefault();
      presskit.open('link');
    }}
  >
    <svg className="v4-dl" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
      <path d="M1.5 1.5h6l3 3v6h-9zM7.5 1.5v3h3M3.5 7h5M3.5 9h3.5" fill="none" stroke="currentColor" strokeWidth="1.2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
    <span className="v4-doc-label">{label}</span>{' '}
    <span className="v4-doc-size">{size}</span>
  </a>
);

export const Press: React.FC<SectionProps> = ({ active, focusable }) => {
  const tab = tabOf(focusable);
  return (
    <SectionFrame id="press" active={active}>
      <p className="v4-sec-text">{PRESS_TEXT}</p>
      <h3 className="v4-sec-sub">Setup</h3>
      {PRESS_SETUP.map((t) => (
        <p key={t} className="v4-sec-text">
          {t}
        </p>
      ))}
      <ul className="v4-links">
        <li>
          <button type="button" className="v4-link v4-link-btn" tabIndex={tab} aria-controls="v4-section-contact" onClick={() => openContact('live')}>
            <span>Book a set</span>
          </button>
        </li>
        <li>
          <button type="button" className="v4-link v4-link-btn" tabIndex={tab} aria-controls="v4-section-contact" onClick={() => openContact('press')}>
            <span>Interview or press request</span>
          </button>
        </li>
      </ul>
      <h3 className="v4-sec-sub">Documents</h3>
      <ul className="v4-links">
        {LIVE_DOCS.map((d) => (
          <li key={d.href}>
            {d.viewer ? <KitLink href={d.href} label={d.label} size={d.size} tab={tab} /> : <DocLink href={d.href} label={d.label} size={d.size} tab={tab} />}
          </li>
        ))}
        <li>
          <ExternalLink className="v4-link" href={LIVE_PAGES.press} tabIndex={tab}>
            <span>Photos and logos</span>
          </ExternalLink>
        </li>
        <li>
          <ExternalLink className="v4-link" href={LIVE_PAGES.techrider} tabIndex={tab}>
            <span>Full tech rider</span>
          </ExternalLink>
        </li>
      </ul>
    </SectionFrame>
  );
};

export default Press;
