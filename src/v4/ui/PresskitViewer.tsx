/**
 * Le press kit en popup devant la machine (2026-09-30, version 4 pages,
 * anglais seulement) : les quatre pages en image (WebP) dans une colonne
 * qui defile, le PDF unique a ouvrir dans un onglet (ses liens y sont
 * cliquables) ou a telecharger, la fermeture (bouton x, Echap, clic sur le
 * fond). Dialogue modal : le focus y entre et y reste (Tab boucle), il
 * revient a l'element qui l'a ouvert ; les raccourcis de la machine sont
 * coupes tant qu'il est ouvert.
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { PRESSKIT } from '../data';
import { presskit } from '../state/presskit';
import { DownloadMark } from './sections/common';

const CloseIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

const OpenMark: React.FC = () => (
  <svg className="v4-dl" viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
    <path d="M3.5 2.5h6v6M9.5 2.5l-7 7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

export const PresskitViewer: React.FC = () => {
  const open = useSyncExternalStore(presskit.subscribe, presskit.get, presskit.get);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  // Ouverture : le focus entre (bouton x), il reviendra a l'element d'avant
  useEffect(() => {
    if (!open) return undefined;
    returnTo.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    closeRef.current?.focus({ preventScroll: true });
    /**
     * En capture sur la fenetre : Echap ferme, Tab boucle dans le dialogue,
     * et aucune touche n'atteint les raccourcis de la machine.
     */
    const onKey = (e: KeyboardEvent): void => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        e.preventDefault();
        presskit.close();
        return;
      }
      if (e.key !== 'Tab') return;
      const box = dialogRef.current;
      if (!box) return;
      const items = Array.from(box.querySelectorAll<HTMLElement>('a[href], button:not([disabled])'));
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
      returnTo.current?.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  const file = PRESSKIT.pdf.slice(PRESSKIT.pdf.lastIndexOf('/') + 1);
  const pages = Array.from({ length: PRESSKIT.pages }, (_, k) => k + 1);

  return (
    <div
      className="v4-kit"
      style={{ position: 'absolute', inset: 0 }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) presskit.close();
      }}
    >
      <div ref={dialogRef} className="v4-kit-dialog" role="dialog" aria-modal="true" aria-label="Press kit 2027">
        <div className="v4-kit-bar">
          <p className="v4-kit-title">
            Press kit <span>2027</span>
          </p>
          <a className="v4-kit-open" href={PRESSKIT.pdf} target="_blank" rel="noopener noreferrer" aria-label="Open the press kit PDF in a new tab, its links are clickable">
            <OpenMark />
            <span>Open PDF</span>
          </a>
          <a className="v4-kit-dl" href={PRESSKIT.pdf} download={file} aria-label={`Download the press kit, PDF, ${PRESSKIT.size}`}>
            <DownloadMark />
            <span>Download</span>
            <span className="v4-kit-size">PDF {PRESSKIT.size}</span>
          </a>
          <button ref={closeRef} type="button" className="v4-kit-close" aria-label="Close the press kit" onClick={() => presskit.close()}>
            <CloseIcon />
          </button>
        </div>
        <div className="v4-kit-pages">
          {pages.map((n) => (
            <img
              key={n}
              className="v4-kit-page"
              src={PRESSKIT.page(n)}
              width={PRESSKIT.w}
              height={PRESSKIT.h}
              loading={n <= 2 ? 'eager' : 'lazy'}
              decoding="async"
              alt={`Press kit 2027, page ${n} of ${PRESSKIT.pages}`}
            />
          ))}
        </div>
      </div>
    </div>
  );
};

export default PresskitViewer;
