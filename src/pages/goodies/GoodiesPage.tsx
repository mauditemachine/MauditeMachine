/**
 * /goodies/ en page a part (2026-11-27, Mika : "Pareil pour la page Goodies je voudrais que ce soit une page
 * directement dans le site au meme titre que les events ! je veux tout separer des machines") : tout ce qui est
 * gratuit. Les machines a jouer en ligne (liens vers la machine, cadree), puis les fonds d'ecran et les pochettes en
 * grilles alignees, chacun en telechargement direct. Meme source que la section de la machine (src/data/goodies.ts).
 */

import React from 'react';
import { GOODIES, goodieFilename, type GoodieCategory, type GoodieItem } from '../../data/goodies';
import { SiteShell } from '../site/SiteShell';
import './goodies.css';


const GROUPS: readonly { category: GoodieCategory; title: string }[] = [
  { category: 'wallpaper-desktop', title: 'Desktop wallpapers' },
  { category: 'wallpaper-phone', title: 'Phone wallpapers' },
  { category: 'cover', title: 'Release covers' },
];

const fmtBytes = (b: number): string => (!Number.isFinite(b) || b <= 0 ? '' : b < 1e6 ? `${Math.max(1, Math.round(b / 1e3))} KB` : `${(b / 1e6).toFixed(1)} MB`);

const Item: React.FC<{ it: GoodieItem; eager: boolean }> = ({ it, eager }) => {
  const size = fmtBytes(it.bytes);
  return (
    <li>
      <a className="mmg-item" href={it.downloadSrc} download={goodieFilename(it)} aria-label={`Download ${it.title}, ${size}`}>
        <span className="mmg-img" data-kind={it.category}>
          <img src={it.src} alt="" loading={eager ? 'eager' : 'lazy' } decoding="async" />
        </span>
        <span className="mmg-meta">
          <span className="mmg-title">{it.title}</span>
          <span className="mmg-dl">
            <svg viewBox="0 0 12 12" width="12" height="12" aria-hidden="true" focusable="false">
              <path d="M6 2v7M2.5 5.5L6 9l3.5-3.5M2.5 11h7" fill="none" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
            {size}
          </span>
        </span>
      </a>
    </li>
  );
};

const GoodiesPage: React.FC = () => (
  <SiteShell current="/goodies/">
    <div className="mms-up-head">
      <h1 className="mms-title">Goodies</h1>
      <p className="mms-k">Free</p>
    </div>
    <p className="mmg-lead">Wallpapers and covers, free to download. The machines and the VST3 plugins are in Studio.</p>



    {GROUPS.map((g, gi) => {
      const items = GOODIES.filter((x) => x.category === g.category);
      if (!items.length) return null;
      return (
        <section className="mmg-sec" key={g.category} aria-labelledby={`mmg-${g.category}`}>
          <h2 className="mms-k" id={`mmg-${g.category}`}>
            {g.title}
          </h2>
          <ul className="mmg-grid" data-kind={g.category}>
            {items.map((it, i) => (
              <Item key={it.downloadSrc} it={it} eager={gi === 0 && i < 3} />
            ))}
          </ul>
        </section>
      );
    })}
  </SiteShell>
);

export default GoodiesPage;
