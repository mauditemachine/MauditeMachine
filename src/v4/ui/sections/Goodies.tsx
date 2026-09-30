/**
 * GOODIES (revision 4) : ouverte par la puce GOODIES de la vue eclatee. Le
 * contenu de la page /goodies, depuis la meme source (src/data/goodies.ts) :
 * fonds d'ecran bureau, fonds d'ecran telephone, pochettes de sorties.
 * Chaque element est un telechargement direct (attribut download, nom de
 * fichier propre), avec son poids. Les apercus ne se chargent qu'a la
 * premiere ouverture de la section.
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
      <p className="v4-sec-text">Free downloads, full resolution.</p>
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
