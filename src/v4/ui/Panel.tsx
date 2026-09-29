/**
 * Panneau des sections (spec 11.2 et 11.3), un seul composant pour les
 * deux mises en page, le CSS fait le reste :
 * - desktop : panneau flottant a droite de la machine (la camera la decale,
 *   renderer.ts), graphite 92 % et flou 12 px, 460 px au plus, 70 vh au
 *   plus, defilement interne ; entree 220 ms apres le depart de la trace,
 *   sortie en fondu 150 ms ;
 * - mobile : feuille du bas (45 % de la hauteur) qui monte en 280 ms, avec
 *   une poignee, les onglets des cinq sections et le bouton de fermeture ;
 *   glisser vers le bas (80 px ou geste vif) la ferme. La machine au-dessus
 *   reste visible et jouable.
 * Les six sections sont toujours rendues (texte dans le DOM des le
 * chargement, pour le referencement et les lecteurs d'ecran) : seule la
 * section ouverte est affichee, les autres sont masquees visuellement et
 * sortent de l'ordre de tabulation. Fermer : bouton x, Echap (useKeys),
 * le knob actif, le glisser de la feuille.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { closeSection, openSection } from '../actions';
import { motion } from '../state/motion';
import { section } from '../state/section';
import { NAV_KNOBS, SHEET, type SectionId } from '../theme';
import { Contact } from './sections/Contact';
import { Mixtapes } from './sections/Mixtapes';
import { Press } from './sections/Press';
import { Shows } from './sections/Shows';
import { Studio } from './sections/Studio';
import { Tracks } from './sections/Tracks';

interface Props {
  mobile: boolean;
  panelRef: React.RefObject<HTMLElement | null>;
}

interface SheetDrag {
  id: number;
  y0: number;
  y: number;
  t: number;
  /** vitesse du dernier mouvement, px/ms (positive vers le bas) */
  v: number;
  on: boolean;
}

const CloseIcon: React.FC = () => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <path d="M3.5 3.5l9 9M12.5 3.5l-9 9" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
  </svg>
);

export const Panel: React.FC<Props> = ({ mobile, panelRef }) => {
  const s = useSyncExternalStore(section.subscribe, section.get, section.get);
  // La derniere section ouverte reste affichee pendant le fondu de sortie
  const [shown, setShown] = useState<SectionId | null>(s);
  if (s !== null && s !== shown) setShown(s);
  const open = s !== null;
  const active = s ?? shown;

  const headRef = useRef<HTMLDivElement>(null);
  const tabsRef = useRef<HTMLDivElement>(null);
  const bodyRef = useRef<HTMLDivElement>(null);
  const closeRef = useRef<HTMLButtonElement>(null);
  const returnFocus = useRef<HTMLElement | null>(null);
  const wasOpen = useRef(open);
  const drag = useRef<SheetDrag | null>(null);
  const settle = useRef(0);

  /* ---------- focus : la feuille le prend, la fermeture le rend ---------- */
  useEffect(() => {
    const el = panelRef.current;
    if (open && !wasOpen.current) {
      const a = document.activeElement;
      returnFocus.current = a instanceof HTMLElement && a !== document.body && !el?.contains(a) ? a : null;
      // Mobile (spec 13) : le focus va au bouton de fermeture ; desktop : rien n'est pris
      if (mobile) closeRef.current?.focus({ preventScroll: true });
    } else if (!open && wasOpen.current) {
      const a = document.activeElement;
      // Le focus ne reste jamais sur un element devenu invisible
      if (el && a instanceof HTMLElement && el.contains(a)) {
        const r = returnFocus.current;
        if (r && r.isConnected) r.focus({ preventScroll: true });
        else a.blur();
      }
      returnFocus.current = null;
    }
    wasOpen.current = open;
  }, [open, mobile, panelRef]);

  /* ---------- une autre section : on repart du haut ---------- */
  useEffect(() => {
    if (s !== null && bodyRef.current) bodyRef.current.scrollTop = 0;
  }, [s]);

  /* ---------- onglets (mobile) : l'onglet actif toujours visible ---------- */
  useEffect(() => {
    const strip = tabsRef.current;
    if (!mobile || !strip) return;
    const b = strip.querySelector<HTMLElement>('[aria-pressed="true"]');
    if (b) {
      const sr = strip.getBoundingClientRect();
      const br = b.getBoundingClientRect();
      const dx = br.left < sr.left ? br.left - sr.left - 8 : br.right > sr.right ? br.right - sr.right + 8 : 0;
      if (dx !== 0) strip.scrollTo({ left: strip.scrollLeft + dx, behavior: motion.reduced() ? 'auto' : 'smooth' });
    }
  }, [s, mobile]);

  /* ---------- une ouverture efface la fin d'un glisser de fermeture ---------- */
  useEffect(() => {
    if (!open) return;
    window.clearTimeout(settle.current);
    const el = panelRef.current;
    if (el) {
      el.style.transition = '';
      el.style.transform = '';
    }
  }, [open, panelRef]);
  useEffect(() => () => window.clearTimeout(settle.current), []);

  /* ---------- glisser de la feuille (mobile) ---------- */
  const onHeadDown = (e: React.PointerEvent<HTMLDivElement>): void => {
    if (!mobile || !open) return;
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    drag.current = { id: e.pointerId, y0: e.clientY, y: e.clientY, t: e.timeStamp, v: 0, on: false };
  };

  const onHeadMove = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    const el = panelRef.current;
    if (!d || d.id !== e.pointerId || !el) return;
    const dy = e.clientY - d.y0;
    if (!d.on) {
      // Une tape sur un onglet ou sur x reste une tape ; vers le haut, rien
      if (dy < SHEET.dragSlopPx) return;
      d.on = true;
      try {
        headRef.current?.setPointerCapture(e.pointerId);
      } catch {
        /* evenement synthetique */
      }
      el.style.transition = 'none';
    }
    const dt = e.timeStamp - d.t;
    if (dt > 0) d.v = (e.clientY - d.y) / dt;
    d.y = e.clientY;
    d.t = e.timeStamp;
    el.style.transform = `translateY(${Math.max(0, dy)}px)`;
  };

  const onHeadUp = (e: React.PointerEvent<HTMLDivElement>): void => {
    const d = drag.current;
    const el = panelRef.current;
    if (!d || d.id !== e.pointerId) return;
    drag.current = null;
    if (!d.on || !el) return;
    const dy = e.clientY - d.y0;
    const close = e.type === 'pointerup' && (dy > SHEET.closeDragPx || d.v > SHEET.flickPxPerMs);
    el.style.transition = '';
    if (close) {
      // La feuille finit sa course depuis le doigt, puis le CSS reprend la main
      el.style.transform = 'translateY(100%)';
      closeSection();
      window.clearTimeout(settle.current);
      settle.current = window.setTimeout(() => {
        el.style.transform = '';
      }, 320);
    } else {
      el.style.transform = '';
    }
  };

  const tabs = open ? 0 : -1;

  return (
    <aside
      ref={panelRef}
      className="v4-panel"
      data-open={open ? '1' : '0'}
      data-section={active ?? ''}
      aria-label="Sections"
    >
      <div
        ref={headRef}
        className="v4-panel-head"
        onPointerDown={onHeadDown}
        onPointerMove={onHeadMove}
        onPointerUp={onHeadUp}
        onPointerCancel={onHeadUp}
      >
        <span className="v4-sheet-handle" aria-hidden="true" />
        <div className="v4-panel-bar">
          {/* Pas de fondu aux bords (degrade sur du texte, brief) : l'onglet coupe suffit */}
          <div ref={tabsRef} className="v4-tabs" role="group" aria-label="Choose a section">
            {NAV_KNOBS.map((k) => (
              <button
                key={k.id}
                type="button"
                className="v4-tab"
                aria-pressed={s === k.id}
                tabIndex={tabs}
                onClick={() => openSection(k.id)}
              >
                {k.label}
              </button>
            ))}
          </div>
          <button
            ref={closeRef}
            type="button"
            className="v4-panel-close"
            aria-label="Close"
            tabIndex={tabs}
            onClick={closeSection}
          >
            <CloseIcon />
          </button>
        </div>
      </div>
      <div ref={bodyRef} className="v4-panel-body">
        <Tracks active={active === 'tracks'} focusable={s === 'tracks'} />
        <Mixtapes active={active === 'mixtapes'} focusable={s === 'mixtapes'} />
        <Press active={active === 'press'} focusable={s === 'press'} />
        <Shows active={active === 'shows'} focusable={s === 'shows'} />
        <Contact active={active === 'contact'} focusable={s === 'contact'} />
        <Studio active={active === 'studio'} focusable={s === 'studio'} />
      </div>
    </aside>
  );
};

export default Panel;
