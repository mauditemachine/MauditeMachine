/** La face du MM-ARP montee, le pont branche (plugin/arp/main.tsx l'importe apres la restauration de l'etat). */

import React from 'react';
import { createRoot } from 'react-dom/client';
import { arpBridge } from './bridge';
import ArpFace from './ArpFace';

export function boot(): void {
  const el = document.getElementById('root');
  if (!el) return;
  arpBridge.start();
  createRoot(el).render(
    <React.StrictMode>
      <ArpFace />
    </React.StrictMode>
  );
}
