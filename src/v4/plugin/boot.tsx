/** La face montee, le pont branche (plugin/main.tsx l'importe apres la restauration de l'etat). */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { bridge } from './bridge';
import PluginFace from './PluginFace';

export function boot(): void {
  const el = document.getElementById('root');
  if (!el) return;
  bridge.start();
  createRoot(el).render(
    <React.StrictMode>
      <PluginFace />
    </React.StrictMode>
  );
}
