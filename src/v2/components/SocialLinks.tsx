/**
 * Rangee d'icones des reseaux (liste canonique de socials.ts), partagee
 * entre le menu overlay et le footer. SVG inline fill currentColor ;
 * les marques absentes de Font Awesome (Beatport, Songkick, Hypeddit)
 * ont une pastille initiale dans le meme rond borde.
 */

import React from 'react';
import { SOCIALS } from '../data/socials';
import { SOCIAL_ICONS } from '../data/socialIcons';

const SocialLinks: React.FC<{ className?: string }> = ({ className }) => (
  <div className={`v2-social-icons${className ? ` ${className}` : ''}`}>
    {SOCIALS.map((s) => {
      const icon = s.icon ? SOCIAL_ICONS[s.icon] : null;
      return (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.label}
          title={s.label}
        >
          {icon ? (
            <svg viewBox={icon.vb} width="18" height="18" aria-hidden="true">
              <path d={icon.d} fill="currentColor" />
            </svg>
          ) : (
            <span className="v2-social-initial" aria-hidden="true">
              {s.label[0]}
            </span>
          )}
        </a>
      );
    })}
  </div>
);

export default SocialLinks;
