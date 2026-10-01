/**
 * La visionneuse du press kit 2027 (2026-10-01, route /presskit) : un
 * chunk a part, charge seulement a l'ouverture (index.tsx, React.lazy),
 * avec ses styles (presskit-viewer.css) ; l'accueil n'en porte aucun
 * octet.
 *
 * Un voile sombre a 70 % sur la machine (elle se devine derriere), le
 * panneau au centre (80 % de la hauteur, 760 px de large au plus) : le
 * titre, Download PDF (le vrai fichier, ses liens cliquables), la croix.
 * Dessous, les six pages en WebP, en defilement vertical continu, posees
 * comme des feuilles (fond blanc casse, ombre douce), la premiere chargee
 * tout de suite, les autres en lazy ; sous la derniere, les liens du PDF
 * en HTML (les memes destinations : une image ne se clique pas).
 *
 * Fermeture : la croix, Echap, un clic sur le voile ; le voile se dissipe
 * (220 ms, rien en mouvement reduit). Dialogue modal : le focus part sur
 * la croix, reste dans le panneau (Tab boucle) et revient au lien qui l'a
 * ouvert, ou au bouton PRESS (arrivee par /presskit). Les raccourcis de la
 * machine sont coupes tant qu'il est ouvert.
 *
 * Mobile (moins de 768 px) : la visionneuse occupe la zone de la machine,
 * le Dock reste dessous ; pages a la largeur de l'ecran moins 12 px de
 * chaque cote ; croix de 48 px en haut a droite, sous la zone sure.
 */

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { KIT, KIT_LINKS } from '../data/presskit';
import { presskit } from '../state/presskit';
import { motion } from '../state/motion';
import { DownloadMark } from './sections/common';
import './presskit-viewer.css';

const CLOSE_MS = 220;

const CloseIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="18" height="18" aria-hidden="true" focusable="false">
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

/** Le bouton PRESS visible (en-tete sur desktop, Dock sur mobile). */
function pressButton(): HTMLElement | null {
  const all = Array.from(document.querySelectorAll<HTMLElement>('[data-press-button]'));
  return all.find((el) => el.offsetParent !== null) ?? all[0] ?? null;
}

/** Les liens externes partent dans un onglet ; mailto et tel restent ici. */
const external = (href: string): boolean => /^https?:/.test(href) || href.endsWith('.pdf');

export const PresskitViewer: React.FC = () => {
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const opener = useRef<HTMLElement | null>(null);
  const [closing, setClosing] = useState(false);
  const file = KIT.pdf.slice(KIT.pdf.lastIndexOf('/') + 1);

  const close = useCallback(() => {
    if (closing) return;
    if (motion.reduced()) {
      presskit.close();
      return;
    }
    setClosing(true);
    window.setTimeout(() => presskit.close(), CLOSE_MS);
  }, [closing]);

  useEffect(() => {
    const active = document.activeElement;
    opener.current = presskit.origin() === 'link' && active instanceof HTMLElement && active !== document.body ? active : null;
    closeRef.current?.focus({ preventScroll: true });
    /** En capture : Echap ferme, Tab boucle dans le dialogue, rien n'atteint la machine. */
    const onKey = (e: KeyboardEvent): void => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        close();
        return;
      }
      if (e.key !== 'Tab') return;
      const box = dialogRef.current;
      if (!box) return;
      const items = Array.from(box.querySelectorAll<HTMLElement>('a[href], button:not([disabled]), [tabindex="0"]'));
      if (items.length === 0) return;
      const first = items[0];
      const last = items[items.length - 1];
      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      const back = opener.current && opener.current.isConnected ? opener.current : pressButton();
      back?.focus({ preventScroll: true });
    };
  }, [close]);

  const n = KIT.pages.length;
  return (
    <div
      className="v4-kit"
      data-closing={closing ? '1' : '0'}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) close();
      }}
    >
      <div ref={dialogRef} className="v4-kit-dialog" role="dialog" aria-modal="true" aria-label={KIT.title}>
        <div className="v4-kit-bar">
          <p className="v4-kit-title">{KIT.title}</p>
          <a className="v4-kit-dl" href={KIT.pdf} download={file} aria-label={`Download PDF, ${KIT.size}, links clickable`}>
            <DownloadMark />
            <span>Download PDF</span>
          </a>
          <button ref={closeRef} type="button" className="v4-kit-close" aria-label="Close the press kit" onClick={close}>
            <CloseIcon />
          </button>
        </div>
        <div className="v4-kit-pages" tabIndex={0} aria-label="Press kit pages">
          {KIT.pages.map((p, k) => (
            <img
              key={p.src}
              className="v4-kit-page"
              src={p.src}
              width={KIT.w}
              height={KIT.h}
              loading={k === 0 ? 'eager' : 'lazy'}
              decoding="async"
              alt={`Page ${k + 1} of ${n}: ${p.section}`}
            />
          ))}
          <section className="v4-kit-links" aria-label="Links from the press kit">
            <h2 className="v4-kit-links-title">Links from the press kit</h2>
            {KIT_LINKS.map(([group, links]) => (
              <div key={group} className="v4-kit-group">
                <h3>{group}</h3>
                <ul>
                  {links.map(([label, href]) => (
                    <li key={href}>
                      <a href={href} {...(external(href) ? { target: '_blank', rel: 'noopener noreferrer' } : {})}>
                        {label}
                      </a>
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </section>
        </div>
      </div>
    </div>
  );
};

export default PresskitViewer;
