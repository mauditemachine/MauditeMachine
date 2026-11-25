/**
 * GOODIES (revision 4) : ouverte par la puce GOODIES de la vue eclatee. Le
 * contenu de la page /goodies, depuis la meme source (src/data/goodies.ts) :
 * fonds d'ecran bureau, fonds d'ecran telephone, pochettes de sorties.
 * Chaque element est un telechargement direct (attribut download, nom de
 * fichier propre), avec son poids. Les apercus ne se chargent qu'a la
 * premiere ouverture de la section.
 *
 * 2026-11-24 : en tete, les plugins VST3 gratuits contre un courriel (VstDownload.tsx, docs/vst-download.md).
 * 2026-11-25 (Mika : "mettre justement le MM-RYTM et ARP du site en goodies ... DECK et MIX aussi") : tout ce qui est
 * gratuit. Play online : les machines du site (un clic les cadre, le panneau se ferme) ; Free VST3 : les cartes des
 * deux plugins (leur page, PluginPage.tsx) et le formulaire pour les deux ; puis les fonds d'ecran et les pochettes.
 */

import React, { useState } from 'react';
import { closeSection, focusMachine, openSection } from '../../actions';
import { GOODIE_GROUPS, fmtBytes, goodieFilename } from '../../data';
import { track } from '../../state/analytics';
import { MACHINES, type MachineId } from '../../state/focus';
import { DownloadMark, SectionFrame, tabOf, type SectionProps } from './common';
import { VST_PAGES } from './PluginPage';
import { VstDownload } from './VstDownload';

/** Les machines du site, jouables tout de suite (celles que ce site a : MACHINES, state/focus.ts) */
const PLAY: readonly { id: MachineId; name: string; kind: string }[] = [
  { id: 'mm808', name: 'MM-RYTM', kind: 'Drum machine' },
  { id: 'voy', name: 'MM-ARP', kind: 'Synthesizer' },
  { id: 'dj', name: 'MM-DECKS', kind: 'DJ decks and mixer' },
];

const VST: readonly { id: 'mmrytm' | 'mmarp'; name: string }[] = [
  { id: 'mmrytm', name: 'MM-RYTM' },
  { id: 'mmarp', name: 'MM-ARP' },
];

export const Goodies: React.FC<SectionProps> = ({ active, focusable }) => {
  const [seen, setSeen] = useState(active);
  if (active && !seen) setSeen(true);
  const tab = tabOf(focusable);
  return (
    <SectionFrame id="goodies" active={active}>
      <p className="v4-sec-text">Everything here is free: play the machines, get the plugins, take the wallpapers.</p>
      <h3 className="v4-sec-sub">Play online</h3>
      <ul className="v4-gd-play">
        {PLAY.filter((m) => (MACHINES as readonly string[]).includes(m.id)).map((m) => (
          <li key={m.id}>
            <button
              type="button"
              className="v4-gd-tile"
              tabIndex={tab}
              onClick={() => {
                track('goodies_play', { machine: m.id });
                closeSection();
                focusMachine(m.id);
              }}
            >
              <span className="v4-gd-tile-name">{m.name}</span>
              <span className="v4-gd-tile-kind">{m.kind}</span>
              <span className="v4-gd-tile-go">Play</span>
            </button>
          </li>
        ))}
      </ul>
      <h3 className="v4-sec-sub">Free VST3 plugins</h3>
      <ul className="v4-gd-vst">
        {VST.map((v) => (
          <li key={v.id}>
            <button type="button" className="v4-gd-card" tabIndex={tab} onClick={() => openSection(v.id)}>
              <span className="v4-gd-card-img">{seen && <img src={VST_PAGES[v.id].image} alt="" loading="lazy" decoding="async" />}</span>
              <span className="v4-gd-card-name">{v.name}</span>
              <span className="v4-gd-card-go">See the plugin</span>
            </button>
          </li>
        ))}
      </ul>
      <VstDownload seen={seen} tab={tab} only="both" />
      {GOODIE_GROUPS.map((g) => (
        <React.Fragment key={g.category}>
          <h3 className="v4-sec-sub">{g.title}</h3>
          <ul className="v4-goodies" data-kind={g.category}>
            {g.items.map((it) => {
              const size = fmtBytes(it.bytes);
              return (
                <li key={it.downloadSrc}>
                  <a
                    className="v4-goodie"
                    href={it.downloadSrc}
                    download={goodieFilename(it)}
                    tabIndex={tab}
                    aria-label={`Download ${it.title}, ${size}`}
                  >
                    <span className="v4-goodie-img">{seen && <img src={it.src} alt="" loading="lazy" decoding="async" />}</span>
                    <span className="v4-goodie-meta">
                      <DownloadMark />
                      <span className="v4-goodie-title">{it.title}</span>
                      <span className="v4-goodie-size">{size}</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </React.Fragment>
      ))}
    </SectionFrame>
  );
};

export default Goodies;
