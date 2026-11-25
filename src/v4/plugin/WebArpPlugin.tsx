/**
 * Le plugin MM-ARP en entier dans le navigateur (2026-11-25, /mm-arp/play/, desktop) : la face du VST3 (plugin/arp,
 * comme plugin/mm-arp/web/index.html la monte) et le son du VST3 au bit pres, son moteur C++ compile en WebAssembly
 * dans un AudioWorklet (plugin/arp/web : webBackend.ts joue JUCE, l'editeur et le processeur). La meme page que
 * /mm-rytm/play/ (WebPlugin.tsx WebPluginShell) : la bande du haut, un mot au telephone.
 *
 * L'ordre compte : window.__JUCE__ et le stockage de l'instance (arp/web/storage.ts : l'etat de la face a part de celui
 * du site) sont poses avant le premier module de la face (DelayPage2.tsx ecoute mm_transport a son evaluation, les stores
 * lisent le localStorage), puis le pont demarre (arp/boot.tsx), puis la face se monte. Le contexte audio nait au premier
 * geste.
 */

import React, { Suspense, useSyncExternalStore } from 'react';
import { arpWebStatus, installArpWebBackend } from './arp/web/webBackend';
import { WebPluginShell } from './WebPlugin';
import './arp/web/webarp.css';

const ArpFace = React.lazy(async () => {
  installArpWebBackend();
  const [{ arpBridge }, face] = await Promise.all([import('./arp/bridge'), import('./arp/ArpFace')]);
  arpBridge.start();
  return face;
});

/** Ce que la page dit du son : cliquer pour le lancer, ou le moteur pas encore en ligne. */
const Notice: React.FC = () => {
  const st = useSyncExternalStore(arpWebStatus.subscribe, arpWebStatus.get);
  if (st === 'idle')
    return (
      <p className="mm-webplugin-notice" role="status">
        Click the machine to start the sound
      </p>
    );
  if (st === 'unavailable')
    return (
      <p className="mm-webplugin-notice" data-warn="1" role="status">
        The MM-ARP sound engine is not available yet. The face works; for the sound, <a href="/mm-arp/">get the VST3, free</a>.
      </p>
    );
  if (st === 'error')
    return (
      <p className="mm-webplugin-notice" data-warn="1" role="alert">
        The sound engine stopped. Reload the page to start it again.
      </p>
    );
  return null;
};

const WebArpPlugin: React.FC = () => (
  <WebPluginShell kind="arp" notice={<Notice />}>
    <Suspense fallback={null}>
      <ArpFace />
    </Suspense>
  </WebPluginShell>
);

export default WebArpPlugin;
