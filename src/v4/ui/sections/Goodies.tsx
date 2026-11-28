/**
 * GOODIES (revision 4) : ouverte par la puce GOODIES de la vue eclatee. Le
 * contenu de la page /goodies, depuis la meme source (src/data/goodies.ts) :
 * fonds d'ecran bureau, fonds d'ecran telephone, pochettes de sorties.
 * Chaque element est un telechargement direct (attribut download, nom de
 * fichier propre), avec son poids. Les apercus ne se chargent qu'a la
 * premiere ouverture de la section.
 *
 * 2026-11-24 au 2026-11-25 : les plugins VST3 gratuits y etaient (VstDownload.tsx, docs/vst-download.md).
 * 2026-11-25 (Mika : "mettre justement le MM-RYTM et ARP du site en goodies ... DECK et MIX aussi") : tout ce qui est
 * gratuit. Play online : les machines du site (un clic les cadre, le panneau se ferme) ; puis les fonds d'ecran et les
 * pochettes. Les plugins n'y sont plus (2026-11-25, Mika : "les goodies ce sont les goodies.. les plugins ne sont pas
 * des goodies !") : ils ont leurs pages, /mm-rytm/ et /mm-arp/ (PluginPage.tsx).
 * 2026-11-28 (Mika : oui, retirer "Play online") : les machines sont dans STUDIO (Studio.tsx).
 */

import React, { useState } from 'react';
import { GOODIE_GROUPS, fmtBytes, goodieFilename } from '../../data';
import { DownloadMark, SectionFrame, tabOf, type SectionProps } from './common';



export const Goodies: React.FC<SectionProps> = ({ active, focusable }) => {
  const [seen, setSeen] = useState(active);
  if (active && !seen) setSeen(true);
  const tab = tabOf(focusable);
  return (
    <SectionFrame id="goodies" active={active}>
      <p className="v4-sec-text">Free: take the wallpapers and the covers. The machines are in STUDIO.</p>
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
