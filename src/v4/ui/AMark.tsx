/**
 * Le "A" des machines (2026-10-09) : la marque de public/logo/
 * mauditemachine-logotype.svg (le A penche dans son carre, l'eclat en haut a
 * gauche), en SVG en ligne pour rester net a toutes les tailles. Il prend
 * la couleur du texte (currentColor). Sur le bouton Dark / Light du menu
 * (ui/AppearanceToggle.tsx) et en filigrane derriere le hoodie
 * (ui/HoodieFeature.tsx).
 */

import React from 'react';

/** Les deux formes du fichier source, viewBox 1891 x 1612. */
export const A_MARK_VIEWBOX = '0 0 1891 1612';
export const A_MARK_PATH =
  'M0 599.955V0.0163828H416.43L0 599.955ZM1891 0.0163828V1612H1153.71V1208.3L903.402 1612H0V1516.68L987.598 0L1891 0.0163828Z';

export const AMark: React.FC<{ className?: string; size?: number }> = ({ className, size }) => (
  <svg
    className={className}
    viewBox={A_MARK_VIEWBOX}
    width={size}
    height={size === undefined ? undefined : Math.round((size * 1612) / 1891)}
    aria-hidden="true"
    focusable="false"
  >
    <path d={A_MARK_PATH} fill="currentColor" />
  </svg>
);

export default AMark;
