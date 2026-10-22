/**
 * Les icones de l'interface du MM-STUDIO en SVG inline (2026-10-22, audit
 * SB-11) : avant, des glyphes Font Awesome charges depuis cdnjs ; un
 * bloqueur de pubs, la PWA hors ligne ou un proxy d'entreprise laissaient
 * RANDOM, la languette du Dock, PLAY/STOP et CLEAR vides. Le lien Font
 * Awesome d'index.html reste pour les autres pages du site, le MM-STUDIO
 * n'en depend plus.
 *
 * FaIcon garde le nom des classes d'avant ('fa-solid fa-dice') : les appels
 * ne changent pas, la classe v4-fa non plus (le CSS en tire la taille, par
 * font-size : le SVG fait 1em). Une grille de 24, au trait de 2 a bouts
 * ronds (le Glyph du Dock, les fleches de la page), les formes pleines
 * (lecture, arret, de) en currentColor. Un nom inconnu retombe sur la
 * police d'icones, comme avant.
 */

import React from 'react';

interface Shape {
  /** traits (stroke 2, bouts ronds) */
  line?: string;
  /** formes pleines */
  fill?: string;
  /** cercles pleins [cx, cy, r] */
  dots?: readonly (readonly [number, number, number])[];
}

const SHAPES: Readonly<Record<string, Shape>> = {
  'fa-dice': { line: 'M7 3.5h10a3.5 3.5 0 0 1 3.5 3.5v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5Z', dots: [[8.4, 8.4, 1.55], [15.6, 8.4, 1.55], [12, 12, 1.55], [8.4, 15.6, 1.55], [15.6, 15.6, 1.55]] },
  'fa-chevron-down': { line: 'M6 9.5l6 6 6-6' },
  'fa-chevron-up': { line: 'M6 14.5l6-6 6 6' },
  'fa-stop': { fill: 'M7.5 5.5h9a2 2 0 0 1 2 2v9a2 2 0 0 1-2 2h-9a2 2 0 0 1-2-2v-9a2 2 0 0 1 2-2Z' },
  'fa-play': { fill: 'M8.2 4.6l10.6 6.3a1.3 1.3 0 0 1 0 2.2L8.2 19.4A1.3 1.3 0 0 1 6.2 18.3V5.7a1.3 1.3 0 0 1 2-1.1Z' },
  'fa-eraser': { line: 'M9 20.5h11M14.2 4.3l5.5 5.5a1.5 1.5 0 0 1 0 2.1l-8.6 8.6H7.2l-3-3a1.5 1.5 0 0 1 0-2.1l7.9-8.1a1.5 1.5 0 0 1 2.1 0ZM9.6 8.4l6 6' },
  'fa-volume-xmark': { line: 'M16 9.5l5 5M21 9.5l-5 5', fill: 'M3.5 9.2h3.3L11 5.6a.8.8 0 0 1 1.3.6v11.6a.8.8 0 0 1-1.3.6l-4.2-3.6H3.5a1 1 0 0 1-1-1V10.2a1 1 0 0 1 1-1Z' },
  'fa-headphones': { line: 'M4.5 15.5V12a7.5 7.5 0 0 1 15 0v3.5', fill: 'M3.5 14h2.5a1.5 1.5 0 0 1 1.5 1.5v4A1.5 1.5 0 0 1 6 21H4.5A1.5 1.5 0 0 1 3 19.5v-5a.5.5 0 0 1 .5-.5ZM18 14h2.5a.5.5 0 0 1 .5.5v5a1.5 1.5 0 0 1-1.5 1.5H18a1.5 1.5 0 0 1-1.5-1.5v-4A1.5 1.5 0 0 1 18 14Z' },
  'fa-gift': { line: 'M4.5 11v8a1.5 1.5 0 0 0 1.5 1.5h12a1.5 1.5 0 0 0 1.5-1.5v-8M3.5 7.5h17v3.5h-17ZM12 7.5v13M12 7.5C10.5 3.8 7 4 7.5 6.2 7.8 7.3 9.8 7.5 12 7.5Zm0 0c1.5-3.7 5-3.5 4.5-1.3-.3 1.1-2.3 1.3-4.5 1.3Z' },
  'fa-shirt': { line: 'M8.5 3.5 3 6.6l2 4.1 2.5-1.1v10.9h9V9.6l2.5 1.1 2-4.1-5.5-3.1c-.5 1.5-1.9 2.5-3.5 2.5S9 5 8.5 3.5Z' },
  'fa-microchip': { line: 'M8 6h8a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2ZM10 10h4v4h-4ZM9.5 3v3M14.5 3v3M9.5 18v3M14.5 18v3M3 9.5h3M3 14.5h3M18 9.5h3M18 14.5h3' },
  'fa-arrow-right': { line: 'M4 12h15.5M13.5 6l6 6-6 6' },
  'fa-arrows-rotate': { line: 'M19.5 10.5A7.6 7.6 0 0 0 6 7.2L4.5 8.8M4.5 4.5v4.3h4.3M4.5 13.5A7.6 7.6 0 0 0 18 16.8l1.5-1.6M19.5 19.5v-4.3h-4.3' },
  'fa-circle-info': { line: 'M12 3a9 9 0 1 1 0 18 9 9 0 0 1 0-18ZM12 11v6', dots: [[12, 7.6, 1.3]] },
  'fa-xmark': { line: 'M6.5 6.5l11 11M17.5 6.5l-11 11' },
};

/** Le dessin d'une classe Font Awesome ('fa-solid fa-dice'), ou null s'il n'existe pas ici. */
const shapeOf = (name: string): Shape | null => {
  for (const c of name.split(/\s+/)) if (c !== 'fa-solid' && SHAPES[c]) return SHAPES[c];
  return null;
};

export const FaIcon: React.FC<{ name: string; className?: string }> = ({ name, className = 'v4-fa' }) => {
  const s = shapeOf(name);
  if (!s) return <i className={`${name} ${className}`} aria-hidden="true" />;
  return (
    <svg className={`v4-svg-icon ${className}`} viewBox="0 0 24 24" width="1em" height="1em" aria-hidden="true" focusable="false">
      {s.fill && <path d={s.fill} fill="currentColor" />}
      {s.line && <path d={s.line} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />}
      {s.dots?.map(([cx, cy, r]) => <circle key={`${cx},${cy}`} cx={cx} cy={cy} r={r} fill="currentColor" />)}
    </svg>
  );
};
