/**
 * Le plugin MM-RYTM en entier dans le navigateur (2026-11-25, Mika : "pourquoi tu mettrais pas les plugins en version
 * web aussi ... le plugin en entier, et uniquement en desktop" ; "des dernieres versions des VST") : /mm-rytm/play/.
 *
 * La face est celle du VST3 (PluginFace, mode PLUGIN : la machine seule, vue de dessus, l'ecran a la souris, clic droit
 * = FUNC), mais sans le pont vers le C++ (plugin/bridge.ts n'est jamais demarre) : le son est celui du site (Web Audio),
 * le meme que le plugin au bit pres (plugin/mm-rytm/tests/compare.cpp). Desktop seulement : au telephone (ou sans
 * souris), un mot et les liens vers la page du plugin.
 *
 * Une bande fine en haut : le nom, "Get the VST3, free" (la page /mm-rytm/) et le retour au site. On y arrive par un
 * chargement complet (theme/base.ts PLUGIN_WEB lit l'adresse a l'evaluation des modules).
 */

import React, { Suspense, useLayoutEffect, useState } from 'react';
import { COARSE_QUERY, MOBILE_QUERY } from '../theme';
import './webplugin.css';

const PluginFace = React.lazy(() => import('./PluginFace'));

const desktop = (): boolean => {
  try {
    return !window.matchMedia(MOBILE_QUERY).matches && !window.matchMedia(COARSE_QUERY).matches;
  } catch {
    return true;
  }
};

const Bar: React.FC = () => (
  <header className="mm-webplugin-bar">
    <a className="mm-webplugin-home" href="/">
      Maudite Machine
    </a>
    <span className="mm-webplugin-name">MM-RYTM · the VST3 plugin, in your browser</span>
    <nav className="mm-webplugin-links" aria-label="MM-RYTM">
      <a className="mm-webplugin-get" href="/mm-rytm/">
        Get the VST3, free
      </a>
      <a href="/">Back to the site</a>
    </nav>
  </header>
);

const WebPlugin: React.FC = () => {
  const [ok] = useState(desktop);

  useLayoutEffect(() => {
    const prev = document.title;
    document.title = 'MM-RYTM, play the plugin in your browser | Maudite Machine';
    document.documentElement.classList.add('mm-webplugin-page');
    return () => {
      document.title = prev;
      document.documentElement.classList.remove('mm-webplugin-page');
    };
  }, []);

  if (!ok) {
    return (
      <main className="mm-webplugin-phone">
        <p className="mm-webplugin-kicker">Maudite Machine · MM-RYTM</p>
        <h1>Desktop only</h1>
        <p>The full plugin runs on a computer, with a mouse. Open this page on your Mac or PC.</p>
        <p>
          <a className="mm-webplugin-get" href="/mm-rytm/">
            Get the VST3, free
          </a>
        </p>
        <p>
          <a href="/?m=mm-rytm">Play MM-RYTM on this phone</a>
        </p>
      </main>
    );
  }

  return (
    <>
      <Suspense fallback={null}>
        <PluginFace />
      </Suspense>
      <Bar />
    </>
  );
};

export default WebPlugin;
