/**
 * Le press kit en popup devant la machine (2026-09-30) : les dix pages en
 * image (WebP, chargees a la demande) dans une colonne qui defile, la
 * langue (EN, FR, ES ; celle du navigateur a l'ouverture), le PDF de la
 * langue en telechargement, la fermeture (bouton x, Echap, clic sur le
 * fond). Dialogue modal : le focus y entre et y reste (Tab boucle), il
 * revient a l'element qui l'a ouvert ; les raccourcis de la machine sont
 * coupes tant qu'il est ouvert.
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { PRESSKIT } from '../data';
import { KIT_LANGS, presskit, type KitLang } from '../state/presskit';
import { DownloadMark } from './sections/common';

const LANG_NAMES: Readonly<Record<KitLang, string>> = { en: 'English', fr: 'French', es: 'Spanish' };

const CloseIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const PresskitViewer: React.FC = () => {
  const s = useSyncExternalStore(presskit.subscribe, presskit.get, presskit.get);
  const dialogRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const returnTo = useRef<HTMLElement | null>(null);

  // Ouverture : le focus entre (bouton x), il reviendra a l'element d'avant
  useEffect(() => {
    if (!s.open) return undefined;
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
  }, [s.open]);

  // Nouvelle langue : retour en haut des pages
  useEffect(() => {
    if (bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [s.lang]);

  if (!s.open) return null;
  const pdf = PRESSKIT.pdf[s.lang];
  const file = pdf.slice(pdf.lastIndexOf('/') + 1);
  const pages = Array.from({ length: PRESSKIT.pages }, (_, k) => k + 1);

  return (
    <div
      className="v4-kit"
      style={{ position: 'absolute', inset: 0 }}
      onPointerDown={(e) => {
        if (e.target === e.currentTarget) presskit.close();
      }}
    >
      <div ref={dialogRef} className="v4-kit-dialog" role="dialog" aria-modal="true" aria-label="Press kit 2027" lang={s.lang}>
        <div className="v4-kit-bar">
          <p className="v4-kit-title">
            Press kit <span>2027</span>
          </p>
          <div className="v4-kit-langs" role="group" aria-label="Language">
            {KIT_LANGS.map((l) => (
              <button key={l} type="button" className="v4-kit-lang" aria-pressed={s.lang === l} aria-label={LANG_NAMES[l]} onClick={() => presskit.setLang(l)}>
                {l.toUpperCase()}
              </button>
            ))}
          </div>
          <a className="v4-kit-dl" href={pdf} download={file} aria-label={`Download the press kit, PDF, ${LANG_NAMES[s.lang]}`}>
            <DownloadMark />
            <span>Download</span>
            <span className="v4-kit-size">PDF {PRESSKIT.size}</span>
          </a>
          <button ref={closeRef} type="button" className="v4-kit-close" aria-label="Close the press kit" onClick={() => presskit.close()}>
            <CloseIcon />
          </button>
        </div>
        <div ref={bodyRef} className="v4-kit-pages">
          {pages.map((n) => (
            <img
              key={`${s.lang}-${n}`}
              className="v4-kit-page"
              src={PRESSKIT.page(s.lang, n)}
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
