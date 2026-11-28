/**
 * STUDIO (2026-11-28, Mika : "faut reunir rytm arp et deckmix dans Studio ! et on doit pouvoir telecharger les full
 * plugins quand on est dans studio et enlever le bouton jouer sur le site puisqu'on y est") : MM-RYTM, MM-ARP et
 * MM-DECKS au meme endroit, une carte chacun. Les deux plugins : DOWNLOAD VST3 (/download/?p=..., l'installeur du
 * systeme du visiteur part seul, le don Ko-fi reste facultatif), PLAY THE FULL PLUGIN (desktop, la face du VST3 en
 * WebAssembly) et DETAILS (leur page, /mm-rytm/ et /mm-arp/). Pas de bouton pour jouer la machine du site : on y est.
 * MM-DECKS n'a pas de plugin : OPEN THE DECKS cadre la machine. Dessous, l'ancien contenu (setup, cours, impression).
 * Le texte : src/data/studio.json (le prerendu, scripts/prerender-seo.mjs, lit le meme).
 */

import React, { useState } from 'react';
import { closeSection, focusMachine, openContact, openSection } from '../../actions';
import { MASSIVE_LINK, STUDIO } from '../../data';
import type { MachineId } from '../../state/focus';
import { track } from '../../state/analytics';
import { COARSE_QUERY, MOBILE_QUERY, type SectionId } from '../../theme';
import { ExternalLink } from '../ExternalLink';
import { DownloadMark, SectionFrame, tabOf, type SectionProps } from './common';
import DATA from '../../../data/studio.json';

interface StudioMachine {
  id: string;
  name: string;
  kind: string;
  text: string;
  section?: string;
  page?: string;
  download?: string;
  web?: string;
  machine?: string;
}

const MACHINES = DATA.machines as readonly StudioMachine[];

const desktop = (): boolean => {
  try {
    return !window.matchMedia(MOBILE_QUERY).matches && !window.matchMedia(COARSE_QUERY).matches;
  } catch {
    return true;
  }
};

export const Studio: React.FC<SectionProps> = ({ active, focusable }) => {
  const tab = tabOf(focusable);
  const [onDesktop] = useState(desktop);
  return (
    <SectionFrame id="studio" active={active}>
      <p className="v4-sec-text v4-plug-lead">{DATA.lead}</p>
      <ul className="v4-studio-list">
        {MACHINES.map((m) => (
          <li key={m.id} className="v4-studio-card">
            <p className="v4-plug-kicker">
              {m.kind}
              {m.download ? ' · Free VST3 · Mac · Windows' : ' · On this site'}
            </p>
            <h3 className="v4-studio-name">{m.name}</h3>
            <p className="v4-sec-text">{m.text}</p>
            <div className="v4-plug-actions">
              {m.download && (
                <a
                  className="v4-plug-btn v4-plug-btn--main"
                  href={m.download}
                  tabIndex={tab}
                  onClick={() => track('vst_studio_download', { plugin: m.id })}
                >
                  <DownloadMark />
                  <span>&nbsp;Download VST3</span>
                </a>
              )}
              {m.web && onDesktop && (
                <a className="v4-plug-btn" href={m.web} tabIndex={tab} onClick={() => track('vst_play_web', { plugin: m.id, place: 'studio' })}>
                  Play the full plugin
                </a>
              )}
              {m.section && (
                <button type="button" className="v4-plug-btn" tabIndex={tab} aria-controls={`v4-section-${m.section}`} onClick={() => openSection(m.section as SectionId)}>
                  Details
                </button>
              )}
              {m.machine && (
                <button
                  type="button"
                  className="v4-plug-btn v4-plug-btn--main"
                  tabIndex={tab}
                  onClick={() => {
                    closeSection();
                    focusMachine(m.machine as MachineId);
                  }}
                >
                  Open the decks
                </button>
              )}
            </div>
          </li>
        ))}
      </ul>
      <p className="v4-vst-note">The VST3 plugins work in any host: Ableton Live, Bitwig, Reaper, Cubase, FL Studio. macOS 11 or later, Windows 10 or 11 (64-bit). A coffee on Ko-fi is welcome, never required.</p>
      <h3 className="v4-sec-sub">The setup</h3>
      <p className="v4-sec-text">{STUDIO.setup}</p>
      <h3 className="v4-sec-sub">Lessons</h3>
      {STUDIO.lessons.map((t) => (
        <p key={t} className="v4-sec-text">
          {t}
        </p>
      ))}
      <ul className="v4-links">
        <li>
          <button type="button" className="v4-link v4-link-btn" tabIndex={tab} aria-controls="v4-section-contact" onClick={() => openContact('lesson')}>
            <span>Ask about a lesson</span>
          </button>
        </li>
      </ul>
      <h3 className="v4-sec-sub">Print and merch production</h3>
      <p className="v4-sec-text">{STUDIO.print}</p>
      <ul className="v4-links">
        <li>
          <ExternalLink className="v4-link" href={MASSIVE_LINK.href} tabIndex={tab}>
            <span>{MASSIVE_LINK.label}</span>
          </ExternalLink>
        </li>
      </ul>
    </SectionFrame>
  );
};

export default Studio;
