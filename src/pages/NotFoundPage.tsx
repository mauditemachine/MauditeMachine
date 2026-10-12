/**
 * La page 404 (2026-10-11, referencement) : une adresse inconnue du routeur
 * (GitHub Pages sert 404.html, statut 404, noindex pose par
 * scripts/prerender-seo.mjs) montrait une page vide. Ici : "404", une
 * phrase et les liens vers les pages principales. Styles en ligne (les
 * classes globales n'ont rien pour elle ; Preflight coupe : la couleur des
 * liens est forcee). Les liens sont de vrais chargements : chaque adresse
 * arrive avec sa page statique.
 *
 * Une page statique qui charge l'application sans route (son #seo-static
 * present, 404.html n'en a pas) garde le comportement d'avant : rien par
 * dessus son contenu.
 */

import React, { useLayoutEffect, useState } from 'react';

const LINKS: readonly { label: string; href: string }[] = [
  { label: 'Home', href: '/' },
  { label: 'MM-STUDIO', href: '/mm-studio/' },
  { label: 'Tracks', href: '/tracks/' },
  { label: 'Shows', href: '/shows/' },
  { label: 'Contact', href: '/contact/' },
];

const TITLE = 'Page not found | Maudite Machine';

const NotFoundPage: React.FC = () => {
  const [staticPage] = useState(() => typeof document !== 'undefined' && document.getElementById('seo-static') !== null);

  useLayoutEffect(() => {
    if (staticPage) return undefined;
    const prev = document.title;
    document.title = TITLE;
    return () => {
      document.title = prev;
    };
  }, [staticPage]);

  if (staticPage) return null;

  return (
    <main
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 20,
        padding: '24px 16px',
        overflowY: 'auto',
        background: '#0c0b09',
        color: '#F6F1E7',
        fontFamily: "'SF Pro Display', system-ui, -apple-system, sans-serif",
        textAlign: 'center',
      }}
    >
      <h1 style={{ margin: 0, fontSize: 'clamp(64px, 18vw, 160px)', fontWeight: 700, lineHeight: 1, letterSpacing: '-0.02em' }}>404</h1>
      <p style={{ margin: 0, fontSize: 18, lineHeight: 1.5 }}>This page does not exist.</p>
      <nav aria-label="Main pages">
        <ul style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '8px 24px', margin: 0, padding: 0, listStyle: 'none' }}>
          {LINKS.map((l) => (
            <li key={l.href}>
              <a
                href={l.href}
                style={{
                  display: 'inline-block',
                  padding: '10px 4px',
                  color: '#FF6A13',
                  fontSize: 14,
                  fontWeight: 700,
                  letterSpacing: '0.12em',
                  textTransform: 'uppercase',
                  textDecoration: 'underline',
                  textUnderlineOffset: 4,
                }}
              >
                {l.label}
              </a>
            </li>
          ))}
        </ul>
      </nav>
    </main>
  );
};

export default NotFoundPage;
