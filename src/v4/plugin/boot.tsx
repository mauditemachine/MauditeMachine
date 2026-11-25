/** La face montee, le pont branche (plugin/main.tsx l'importe apres la restauration de l'etat). */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { bridge } from './bridge';
import PluginFace from './PluginFace';
import { V3Root } from './v3/Root';

/**
 * La face du plugin : la machine DT2 (la scene 3D), ses sous-pages d'OPEN par-dessus (plugin/v3/Overlay.tsx). Mika
 * (2026-11-25) : "reprend l'interface d'avant et complete la". La face a plat du lot 45 reste derriere ?face=v3 (la comparer).
 */
const V3_FACE = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('face') === 'v3';

export function boot(): void {
  const el = document.getElementById('root');
  if (!el) return;
  bridge.start();
  createRoot(el).render(<React.StrictMode>{V3_FACE ? <V3Root /> : <PluginFace />}</React.StrictMode>);
}
