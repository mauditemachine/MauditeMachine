/**
 * Le plugin MM-RYTM en entier dans le navigateur (2026-11-25, /mm-rytm/play/, desktop) : la face du VST3 (PluginFace,
 * comme plugin/mm-rytm/web/index.html la monte, avec son pont plugin/bridge.ts) et le son du VST3, son processeur C++
 * compile en WebAssembly dans un AudioWorklet et son fil du calcul dans un Worker (plugin/rytm/web : webBackend.ts joue
 * JUCE, l'editeur et le processeur). La meme page que /mm-arp/play/ (WebPlugin.tsx WebPluginShell) : la bande du haut,
 * un mot au telephone. Avant (le meme jour) : la face sans le pont, avec le son du site.
 *
 * L'ordre compte : window.__JUCE__ et le stockage de l'instance (arp/web/storage.ts, espace mm.web.rytm.ls: : l'etat de
 * la face a part de celui du site) sont poses avant le premier module de la face (les stores lisent le localStorage), puis
 * le pont demarre (comme plugin/boot.tsx), puis la face se monte. Le contexte audio nait au premier geste.
 */

import React, { Suspense, useSyncExternalStore } from 'react';
import { installRytmWebBackend, rytmWebStatus } from './rytm/web/webBackend';
import { WebPluginShell } from './WebPlugin';

const RytmFace = React.lazy(async () => {
  installRytmWebBackend();
  const [{ bridge }, face] = await Promise.all([import('./bridge'), import('./PluginFace')]);
  bridge.start();
  return face;
});

/** Ce que la page dit du son : cliquer pour le lancer, ou le moteur pas encore en ligne. */
const Notice: React.FC = () => {
  const st = useSyncExternalStore(rytmWebStatus.subscribe, rytmWebStatus.get);
  if (st === 'idle')
    return (
      <p className="mm-webplugin-notice" role="status">
        Click the machine to start the sound
      </p>
    );
  if (st === 'unavailable')
    return (
      <p className="mm-webplugin-notice" data-warn="1" role="status">
        The MM-RYTM sound engine is not available yet. The face works; for the sound, <a href="/mm-rytm/">get the VST3, free</a>.
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

const WebRytmPlugin: React.FC = () => (
  <WebPluginShell kind="rytm" notice={<Notice />}>
    <Suspense fallback={null}>
      <RytmFace />
    </Suspense>
  </WebPluginShell>
);

export default WebRytmPlugin;
