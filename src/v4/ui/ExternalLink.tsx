/**
 * Liens qui quittent le site, ou /v4 (revision 2, spec 20.4, 20.5 et
 * R2-19) : nouvel onglet, sans opener ni referer, et le chevron sortant
 * apres le texte (les icones des reseaux s'en passent : mark false). Tous
 * les liens sortants de /v4 passent par ici : target et rel n'ont qu'une
 * source. La puce LABEL du PCB dessine le meme chevron dans sa texture
 * (scene/pcb.ts).
 */

import React from 'react';
import { EXTERNAL_MARK } from '../theme';

/** Nouvel onglet sans opener ni referer (brief). */
export const EXTERNAL_REL = 'noopener noreferrer';

/** Chevron sortant, 12 px, couleur du lien (jaune au survol avec lui). */
export const ExternalMark: React.FC = () => (
  <svg className="v4-ext" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
    <path d={EXTERNAL_MARK.d} fill="none" stroke="currentColor" strokeWidth={EXTERNAL_MARK.stroke} strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

type AnchorProps = Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, 'target' | 'rel' | 'href'>;

interface Props extends AnchorProps {
  href: string;
  /** false : pas de chevron (lien icone seule) */
  mark?: boolean;
}

/** Un lien sortant : ses enfants, puis le chevron. */
export const ExternalLink: React.FC<Props> = ({ href, mark = true, children, ...rest }) => (
  <a {...rest} href={href} target="_blank" rel={EXTERNAL_REL}>
    {children}
    {mark && <ExternalMark />}
  </a>
);

export default ExternalLink;
