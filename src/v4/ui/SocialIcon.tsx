/**
 * Icone reseau (spec 11.1) : SVG inline de SOCIAL_ICONS (fill currentColor,
 * 20 px), ou une pastille a l'initiale pour les marques absentes de Font
 * Awesome (Hypeddit, Songkick, Gigmit, Beatport). Couleur heritee : bone,
 * jaune au survol et au focus (v4.css).
 */

import React from 'react';
import { SOCIAL_ICONS } from '../../v2/data/socialIcons';

interface Props {
  icon: string | null;
  label: string;
}

export const SocialIcon: React.FC<Props> = ({ icon, label }) => {
  const def = icon ? SOCIAL_ICONS[icon] : undefined;
  if (!def) {
    return (
      <span className="v4-social-initial" aria-hidden="true">
        {label.charAt(0)}
      </span>
    );
  }
  return (
    <svg viewBox={def.vb} width="20" height="20" aria-hidden="true" focusable="false">
      <path d={def.d} fill="currentColor" />
    </svg>
  );
};

export default SocialIcon;
