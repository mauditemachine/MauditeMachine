/**
 * Les plugins en entier dans le navigateur (2026-11-25, Mika : "pourquoi tu mettrais pas les plugins en version web aussi
 * ... le plugin en entier, et uniquement en desktop" ; "des dernieres versions des VST") : /mm-rytm/play/
 * (WebRytmPlugin.tsx) et /mm-arp/play/ (WebArpPlugin.tsx), la face du VST3 et le son du VST3 (son moteur C++ en
 * WebAssembly). Desktop seulement : au telephone (ou sans souris), un mot et les liens vers la page du plugin.
 *
 * Une bande fine en haut : le nom, "Get the VST3, free" (la page /mm-rytm/ ou /mm-arp/) et le retour au site. On y arrive
 * par un chargement complet (theme/base.ts PLUGIN_WEB lit l'adresse a l'evaluation des modules).
 *
 * WebPluginShell : la page commune aux deux. Avant le moteur (2026-11-25), /mm-rytm/play/ montait ici la face sans le
 * pont, avec le son du site.
 */

import React, { useLayoutEffect, useState } from 'react';
import { COARSE_QUERY, MOBILE_QUERY } from '../theme';
import './webplugin.css';

export type WebPluginKind = 'rytm' | 'arp';

const INFO: Record<WebPluginKind, { name: string; title: string; vst: string; phone: string }> = {
  rytm: { name: 'MM-RYTM', title: 'MM-RYTM, play the plugin in your browser | Maudite Machine', vst: '/mm-rytm/', phone: '/?m=mm-rytm' },
  arp: { name: 'MM-ARP', title: 'MM-ARP, play the plugin in your browser | Maudite Machine', vst: '/mm-arp/', phone: '/?m=mm-arp' },
};

const desktop = (): boolean => {
  try {
    return !window.matchMedia(MOBILE_QUERY).matches && !window.matchMedia(COARSE_QUERY).matches;
  } catch {
    return true;
  }
};

const Bar: React.FC<{ kind: WebPluginKind }> = ({ kind }) => {
  const p = INFO[kind];
  return (
    <header className="mm-webplugin-bar">
      <a className="mm-webplugin-home" href="/">
        Maudite Machine
      </a>
      <span className="mm-webplugin-name">{p.name} · the VST3 plugin, in your browser</span>
      <nav className="mm-webplugin-links" aria-label={p.name}>
        <a className="mm-webplugin-get" href={p.vst}>
          Get the VST3, free
        </a>
        <a href="/">Back to the site</a>
      </nav>
    </header>
  );
};

/** La page d'un plugin dans le navigateur : le titre, la bande du haut, la face (children) au desktop, un mot au telephone. */
export const WebPluginShell: React.FC<{ kind: WebPluginKind; children: React.ReactNode; notice?: React.ReactNode }> = ({ kind, children, notice }) => {
  const [ok] = useState(desktop);
  const p = INFO[kind];

  useLayoutEffect(() => {
    const prev = document.title;
    document.title = p.title;
    const root = document.documentElement.classList;
    root.add('mm-webplugin-page', `mm-webplugin-${kind}`);
    return () => {
      document.title = prev;
      root.remove('mm-webplugin-page', `mm-webplugin-${kind}`);
    };
  }, [kind, p.title]);

  if (!ok) {
    return (
      <main className="mm-webplugin-phone">
        <p className="mm-webplugin-kicker">Maudite Machine · {p.name}</p>
        <h1>Desktop only</h1>
        <p>The full plugin runs on a computer, with a mouse. Open this page on your Mac or PC.</p>
        <p>
          <a className="mm-webplugin-get" href={p.vst}>
            Get the VST3, free
          </a>
        </p>
        <p>
          <a href={p.phone}>Play {p.name} on this phone</a>
        </p>
      </main>
    );
  }

  return (
    <>
      {children}
      <Bar kind={kind} />
      {notice}
    </>
  );
};
