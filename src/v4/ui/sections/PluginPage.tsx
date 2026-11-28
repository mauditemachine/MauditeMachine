/**
 * Les pages des plugins (2026-11-25, Mika : "laisse MM-RYTM et MM-ARP dans le menu mais cette fois pour les
 * telechargements et les presentations" ; "le plugin en entier [dans le navigateur], et uniquement en desktop") :
 * /mm-rytm/ et /mm-arp/, des sections du panneau comme SHOWS.
 *
 * Une image de la machine, ce qu'elle fait, ses systemes (public/data/vst.json, platforms), puis :
 * - (plus de "Play it on the site" depuis le 2026-11-28, Mika : "enlever le bouton jouer sur le site puisqu'on y est")
 * - Play the full plugin (desktop) : /mm-rytm/play/ et /mm-arp/play/, la face du VST3 et son moteur en WebAssembly
 *   (plugin/WebRytmPlugin.tsx, plugin/WebArpPlugin.tsx) ;
 * - le VST3 gratuit : le formulaire courriel (VstDownload, only) et le don.
 * Le texte lisible sans JavaScript (et par Google) : scripts/prerender-seo.mjs, les memes listes (VST_PAGES).
 */

import React, { useEffect, useState } from 'react';
import type { MachineId } from '../../state/focus';
import { track } from '../../state/analytics';
import { COARSE_QUERY, MOBILE_QUERY, type SectionId } from '../../theme';
import { SectionFrame, tabOf, type SectionProps } from './common';
import { VstDownload, loadConfig, type VstPlugin } from './VstDownload';
import PAGES from '../../../data/vstPages.json';

export interface VstPage {
  section: SectionId;
  plugin: string;
  machine: MachineId;
  image: string;
  alt: string;
  lead: string;
  features: readonly string[];
  /** La face du VST3 jouable dans le navigateur (desktop) */
  web?: string;
}

/** Les deux pages ; scripts/prerender-seo.mjs les lit aussi. */
export const VST_PAGES = PAGES as unknown as Record<'mmrytm' | 'mmarp', VstPage>;

const desktop = (): boolean => {
  try {
    return !window.matchMedia(MOBILE_QUERY).matches && !window.matchMedia(COARSE_QUERY).matches;
  } catch {
    return true;
  }
};

export const PluginPage: React.FC<SectionProps & { id: 'mmrytm' | 'mmarp' }> = ({ id, active, focusable }) => {
  const page = VST_PAGES[id];
  const [seen, setSeen] = useState(active);
  if (active && !seen) setSeen(true);
  const tab = tabOf(focusable);
  const [info, setInfo] = useState<VstPlugin | null>(null);
  const [onDesktop] = useState(desktop);

  useEffect(() => {
    if (!seen) return;
    let alive = true;
    void loadConfig().then((c) => {
      if (alive) setInfo(c?.plugins.find((p) => p.id === page.plugin) ?? null);
    });
    return () => {
      alive = false;
    };
  }, [seen, page.plugin]);

  const platforms = info?.platforms ?? ['macOS'];
  const os = platforms.some((p) => p.startsWith('Windows')) ? platforms : [...platforms, 'Windows soon'];

  return (
    <SectionFrame id={id} active={active}>
      <p className="v4-plug-kicker">
        Free VST3 plugin · {os.join(' · ')}
      </p>
      <span className="v4-plug-shot">{seen && <img src={page.image} alt={page.alt} width={1200} height={750} loading="lazy" decoding="async" />}</span>
      <p className="v4-sec-text v4-plug-lead">{page.lead}</p>
      <div className="v4-plug-actions">
        {page.web && onDesktop && (
          <a className="v4-plug-btn v4-plug-btn--main" href={page.web} tabIndex={tab} onClick={() => track('vst_play_web', { plugin: page.plugin })}>
            Play the full plugin
          </a>
        )}
      </div>
      {page.web && onDesktop && <p className="v4-vst-note">Play the full plugin: the same face and the same sound as the VST3, right in your browser. Desktop only.</p>}
      <h3 className="v4-sec-sub">What it does</h3>
      <ul className="v4-plug-features">
        {page.features.map((f) => (
          <li key={f}>{f}</li>
        ))}
      </ul>
      <h3 className="v4-sec-sub">Get the VST3, free</h3>
      <VstDownload seen={seen} tab={tab} only={page.plugin} />
    </SectionFrame>
  );
};

export default PluginPage;
