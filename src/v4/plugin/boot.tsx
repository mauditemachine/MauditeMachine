/** La face montee, le pont branche (plugin/main.tsx l'importe apres la restauration de l'etat). */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { bridge } from './bridge';
import PluginFace from './PluginFace';
import { V3Root } from './v3/Root';

/**
 * La face v3 (2026-11-25, Mika : "redesign MM-RYTM [...] go code") est la face du plugin ; la face d'avant (la scene 3D de la
 * DT2) reste derriere ?face=old, pour comparer.
 */
const OLD_FACE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('face') === 'old';

export function boot(): void {
  const el = document.getElementById('root');
  if (!el) return;
  bridge.start();
  createRoot(el).render(<React.StrictMode>{OLD_FACE ? <PluginFace /> : <V3Root />}</React.StrictMode>);
}
