/**
 * SocialSidebar — barre laterale fixe right, vertical, desktop only.
 *
 * - hidden md:flex : invisible mobile, visible >= 768px
 * - fixed right-6 top-1/2 -translate-y-1/2 z-50
 * - Tooltip glassmorphic au hover (a gauche de l'icone, slide-in subtle)
 * - Icones blanc/50 -> blanc pur au hover, scale-110
 * - aria-label pour accessibilite (screen readers)
 *
 * Mobile equivalent : voir SocialRow component / MobileMenu (rangee horizontale).
 */

import React from 'react';
import { SOCIAL_LINKS } from './SocialIcons';

const SocialSidebar: React.FC = () => {
  return (
    <aside
      aria-label="Social links"
      // position:fixed en inline style OBLIGATOIRE : la regle legacy
      // `.page > * { position: relative }` (styles.css) ecrase la classe
      // Tailwind `fixed` — meme piege que le player et le hamburger.
      // Sans ca, la sidebar tombe dans le flux en bas de page et ses liens
      // interceptent les clics du contenu (bug "+ Goodies -> Apple Music").
      className="hidden md:flex flex-col gap-5"
      style={{
        position: 'fixed',
        right: 24,
        top: '50%',
        transform: 'translateY(-50%)',
        zIndex: 50,
      }}
    >
      {SOCIAL_LINKS.map((s) => (
        <a
          key={s.label}
          href={s.href}
          target="_blank"
          rel="noopener noreferrer"
          aria-label={s.label}
          className="group relative flex items-center text-white/50 hover:text-white transition-colors cursor-pointer no-underline"
          style={{ color: 'inherit', textDecoration: 'none' }}
        >
          {/* Icone : herite color, scale au hover */}
          <span className="flex items-center justify-center w-5 h-5 transition-all group-hover:scale-110 [&>svg]:w-5 [&>svg]:h-5">
            {s.icon}
          </span>

          {/* Tooltip glassmorphic — slide-in depuis la gauche au hover */}
          <span
            className={[
              'absolute right-full mr-4',
              'px-2 py-1 rounded',
              'bg-white/10 backdrop-blur-md border border-white/10',
              'text-[11px] font-medium uppercase tracking-wider text-white',
              'opacity-0 -translate-x-1 pointer-events-none',
              'group-hover:opacity-100 group-hover:translate-x-0',
              'transition-all duration-300 ease-out',
              'whitespace-nowrap',
            ].join(' ')}
          >
            {s.label}
          </span>
        </a>
      ))}
    </aside>
  );
};

export default SocialSidebar;
