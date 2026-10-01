/**
 * Dark / Light (2026-10-01) : deux boutons cote a cote, celui de
 * l'apparence en cours enfonce (aria-pressed). Desktop : au bout du menu de
 * l'en-tete ; mobile : au bas du menu du hamburger (ui/MobileHeader.tsx).
 */

import React, { useSyncExternalStore } from 'react';
import { appearance } from '../state/appearance';
import type { Appearance } from '../theme';

const MODES: readonly { id: Appearance; label: string; aria: string }[] = [
  { id: 'dark', label: 'Dark', aria: 'Dark mode' },
  { id: 'light', label: 'Light', aria: 'Light mode' },
];

export const AppearanceToggle: React.FC = () => {
  const look = useSyncExternalStore(appearance.subscribe, appearance.get, appearance.get);
  return (
    <div className="v4-look" role="group" aria-label="Appearance">
      {MODES.map((m) => (
        <button key={m.id} type="button" className="v4-look-btn" aria-pressed={look === m.id} aria-label={m.aria} onClick={() => appearance.set(m.id)}>
          {m.label}
        </button>
      ))}
    </div>
  );
};

export default AppearanceToggle;
