/**
 * Icone reseau : SVG inline depuis SOCIAL_ICONS (fill currentColor), ou
 * la pastille initiale (1 px cream) pour les marques hors Font Awesome,
 * comme sur la one-page v2.
 */

import React from 'react';
import { SOCIAL_ICONS } from '../../v2/data/socialIcons';

interface SocialIconProps {
  icon: string | null;
  label: string;
}

const SocialIcon: React.FC<SocialIconProps> = ({ icon, label }) => {
  const def = icon ? SOCIAL_ICONS[icon] : undefined;
  if (!def) {
    return (
      <span className="v3-social-initial" aria-hidden="true">
        {label.charAt(0)}
      </span>
    );
  }
  return (
    <svg viewBox={def.vb} width="18" height="18" aria-hidden="true" focusable="false">
      <path d={def.d} fill="currentColor" />
    </svg>
  );
};

export default SocialIcon;
