/**
 * Coquille de dialog : scrim (clic = ferme), piege de focus, Echap, retour
 * du focus a l'ouvreur, feuille basse avec poignee (swipe vers le bas =
 * ferme) sous 768 px. Rendu des le premier paint, cache tant que ferme.
 */

import React, { useEffect, useRef } from 'react';

interface DrawerProps {
  open: boolean;
  kind: 'tracklist' | 'info';
  label: string;
  onClose: () => void;
  returnTo: React.RefObject<HTMLElement | null>;
  children: React.ReactNode;
}

const FOCUSABLE = 'a[href], button:not([disabled]), input:not([disabled]), [tabindex]:not([tabindex="-1"])';

const Drawer: React.FC<DrawerProps> = ({ open, kind, label, onClose, returnTo, children }) => {
  const ref = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const wasOpen = useRef(false);

  useEffect(() => {
    if (open) {
      wasOpen.current = true;
      const t = window.setTimeout(() => closeRef.current?.focus(), 30);
      return () => window.clearTimeout(t);
    }
    if (wasOpen.current) {
      wasOpen.current = false;
      returnTo.current?.focus();
    }
    return undefined;
  }, [open, returnTo]);

  const onKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.stopPropagation();
      onClose();
      return;
    }
    if (e.key !== 'Tab' || !ref.current) return;
    const items = Array.from(ref.current.querySelectorAll<HTMLElement>(FOCUSABLE)).filter(
      (el) => el.offsetParent !== null
    );
    if (!items.length) return;
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

  // Poignee de la feuille basse : un glisser vers le bas de 60 px ferme
  const dragY = useRef<number | null>(null);
  const onHandleDown = (e: React.PointerEvent) => {
    dragY.current = e.clientY;
  };
  const onHandleMove = (e: React.PointerEvent) => {
    if (dragY.current === null) return;
    if (e.clientY - dragY.current > 60) {
      dragY.current = null;
      onClose();
    }
  };
  const onHandleUp = () => {
    dragY.current = null;
  };

  return (
    <>
      <div className={`v3-scrim${open ? ' is-open' : ''}`} aria-hidden="true" onClick={onClose} />
      <div
        ref={ref}
        className={`v3-drawer is-${kind}${open ? ' is-open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={label}
        onKeyDown={onKeyDown}
      >
        <div
          className="v3-drawer-handle"
          aria-hidden="true"
          onPointerDown={onHandleDown}
          onPointerMove={onHandleMove}
          onPointerUp={onHandleUp}
          onPointerCancel={onHandleUp}
        >
          <i />
        </div>
        <div className="v3-drawer-head">
          <h2 className="v3-drawer-title">{label.toUpperCase()}</h2>
          <button ref={closeRef} type="button" className="v3-drawer-close" aria-label="Close" onClick={onClose}>
            <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
              <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" />
            </svg>
          </button>
        </div>
        <div className="v3-drawer-body">{children}</div>
      </div>
    </>
  );
};

export default React.memo(Drawer);
