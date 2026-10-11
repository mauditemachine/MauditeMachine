/**
 * En-tete fin (2026-10-01, desktop seulement) : le logo Maudite Machine a
 * gauche (retour a la vue d'arrivee : sections et capot fermes, vue
 * recentree), le bouton MENU a droite (2026-10-04, Mika : "le menu desktop
 * aussi plus beau comme le mobile") : il ouvre le menu plein ecran,
 * ui/MenuSheet.tsx, le meme qu'au telephone, a l'echelle d'un ecran. Chaque
 * page actionne le bouton de la machine (actions.page, comme le pad, avec
 * la trace) ; GOODIES, MERCH et STUDIO ouvrent leur section (le capot,
 * avant le 2026-10-04). 52 px, transparent sur un degrade : la machine
 * reste le sujet. UNDO (2026-10-11, Mika : "un bouton UNDO juste a gauche de
 * MIDI") : la derniere etape de toutes les machines (state/undo.ts), Maj+clic
 * la refait ; au telephone, a cote du menu (ui/MobileHeader.tsx).
 */

import React, { useCallback, useRef, useState, useSyncExternalStore } from 'react';
import { closeSection, focusMachine, openSection, openToggle, resetView } from '../actions';
import type { Stage } from '../scene/renderer';
import { appearance } from '../state/appearance';
import { bassExplode, explode, voyExplode } from '../state/explode';
import { MACHINES, focus, VOYAGER, type Focus, type MachineId } from '../state/focus';
import { section } from '../state/section';
import { UNDO_MACHINE_NAME, undo } from '../state/undo';
import { MOBILE_QUERY, type PageId } from '../theme';
import { MenuSheet } from './MenuSheet';
import { MidiButton } from './MidiPanel';

export type HoodId = 'goodies' | 'merch' | 'studio';

/** Les liens du menu, partages avec l'en-tete mobile (ui/MobileHeader.tsx). */
export const PAGE_LINKS: readonly { id: PageId; label: string }[] = [
  { id: 'tracks', label: 'Tracks' },
  { id: 'mixtapes', label: 'Mixtapes' },
  { id: 'shows', label: 'Shows' },
  { id: 'press', label: 'Press' },
  { id: 'contact', label: 'Contact' },
];

export const HOOD_LINKS: readonly { id: HoodId; label: string }[] = [
  { id: 'goodies', label: 'Goodies' },
  { id: 'merch', label: 'Merch' },
  { id: 'studio', label: 'Studio' },
];

/**
 * Le logo : retour a la vue d'arrivee (sections et capots fermes, vue
 * recentree) ; deux machines : la vue d'ensemble sur desktop, la 808 au
 * telephone.
 */
export function goHome(stage: Stage | null): void {
  closeSection();
  if (explode.get() === 'open') openToggle(stage, 'mm808');
  if (voyExplode.get() === 'open') openToggle(stage, 'voy');
  if (bassExplode.get() === 'open') openToggle(stage, 'bass');
  resetView(stage);
  if (VOYAGER) focus.set(window.matchMedia(MOBILE_QUERY).matches ? 'mm808' : 'all');
}

/**
 * GOODIES, MERCH, STUDIO : leur section, comme les autres pages. Leurs puces
 * ont quitte les cartes le 2026-10-04 (Mika : "a la place des liens de
 * mauditemachine qui sont deja dans le header, un systeme de Tweaks") :
 * plus de capot a ouvrir d'abord.
 */
export function openHood(id: HoodId, _stage: Stage | null): void {
  if (section.get() === id) closeSection();
  else openSection(id);
}

interface Props {
  getStage: () => Stage | null;
}

/** Cmd sur un Mac (et l'iPad au clavier), Ctrl ailleurs : le titre du bouton UNDO. */
const MOD = typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/i.test(navigator.platform || navigator.userAgent) ? 'Cmd' : 'Ctrl';

/**
 * UNDO (2026-10-11) : la fleche qui revient et le mot (seule la fleche au telephone, compact). Rien a defaire : le
 * bouton s'eteint (aria-disabled, il reste au clavier) ; Maj+clic : REDO.
 */
export const UndoButton: React.FC<{ compact?: boolean }> = ({ compact = false }) => {
  const v = useSyncExternalStore(undo.subscribe, undo.get, undo.get);
  const can = v.undo > 0;
  const who = v.next ? UNDO_MACHINE_NAME[v.next] : null;
  return (
    <button
      type="button"
      className="v4-undo-btn"
      data-compact={compact ? '1' : '0'}
      data-can={can ? '1' : '0'}
      aria-disabled={!can}
      aria-label={who ? `Undo the last change on the ${who}` : 'Undo: nothing to undo yet'}
      title={`Undo (${MOD}+Z)\nRedo: Shift+${MOD}+Z`}
      onClick={(e) => {
        if (e.shiftKey) undo.redo();
        else if (can) undo.undo();
      }}
    >
      <svg className="v4-undo-icon" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
        <path d="M5.5 3.5L2.5 6.5l3 3" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M2.8 6.5H10a3.5 3.5 0 0 1 0 7H7" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
      </svg>
      {!compact && <span aria-hidden="true">UNDO</span>}
    </button>
  );
};

/**
 * Les machines en haut a droite (2026-10-05, Mika : "voir les machines en
 * haut a droite pour les selectionner rapidement") : ALL (la vue d'ensemble)
 * puis chaque machine, dans l'ordre de la scene ; celle qu'on utilise est
 * allumee. Un clic y va (le voyage dure 450 ms).
 */
const SHORT: Record<MachineId, { label: string; aria: string }> = {
  mm808: { label: 'RYTM', aria: 'MM-RYTM drum machine' },
  voy: { label: 'ARP', aria: 'MM-ARP synthesizer' },
  bass: { label: 'BASS', aria: 'MM-BASS bassline generator' },
  dj: { label: 'DECKS', aria: 'MM-DECKS DJ decks and mixer' },
};

const HeaderMachines: React.FC = () => {
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const items: readonly { id: Focus; label: string; aria: string }[] = [{ id: 'all', label: 'STUDIO', aria: 'MM-STUDIO, all the machines' }, ...MACHINES.map((id) => ({ id, ...SHORT[id] }))];
  return (
    <nav className="v4-hmachines" aria-label="Machines">
      {items.map((it) => (
        <button key={it.id} type="button" className="v4-hmachines-btn" data-all={it.id === 'all' ? '1' : '0'} aria-pressed={f === it.id} aria-label={it.aria} onClick={() => focusMachine(it.id)}>
          {it.label}
        </button>
      ))}
    </nav>
  );
};

export const Header: React.FC<Props> = ({ getStage }) => {
  const [menu, setMenu] = useState(false);
  const look = useSyncExternalStore(appearance.subscribe, appearance.get, appearance.get);
  const btnRef = useRef<HTMLButtonElement>(null);

  const close = useCallback((refocus: boolean): void => {
    setMenu(false);
    if (refocus) btnRef.current?.focus({ preventScroll: true });
  }, []);

  const onHome = (e: React.MouseEvent): void => {
    e.preventDefault();
    setMenu(false);
    goHome(getStage());
  };

  return (
    <>
      <header className="v4-header" data-menu={menu ? '1' : '0'}>
        <a className="v4-logo" href="/" aria-label="Maudite Machine, back to the machine" onClick={onHome}>
          <span className="v4-logotype" aria-hidden="true" />
          <img src={look === 'light' ? '/logo/mauditemachine-logo-ink.svg' : '/logo/mauditemachine-logo-gold.svg'} alt="Maudite Machine" width={118} height={26} />
        </a>
        <div className="v4-header-end">
        <UndoButton />
        <MidiButton />
        {VOYAGER && <HeaderMachines />}
        <button
          ref={btnRef}
          type="button"
          className="v4-menu-btn"
          data-open={menu ? '1' : '0'}
          aria-expanded={menu}
          aria-controls="v4-mmenu"
          aria-label={menu ? 'Close the menu' : 'Open the menu'}
          data-press-button=""
          onClick={() => setMenu((m) => !m)}
        >
          <span className="v4-menu-word" aria-hidden="true">
            {menu ? 'Close' : 'Menu'}
          </span>
          <span className="v4-burger-bars" aria-hidden="true">
            <i />
            <i />
            <i />
          </span>
        </button>
        </div>
      </header>
      <MenuSheet getStage={getStage} open={menu} onClose={close} variant="desk" />
    </>
  );
};

export default Header;
