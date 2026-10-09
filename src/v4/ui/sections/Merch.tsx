/**
 * MERCH (revision 4) : ouverte par la puce MERCH de la vue eclatee. Les
 * produits de public/store.json (data.ts fetchMerch, regroupes par
 * produit) : la premiere vue, les autres en vignettes (face et dos, ou les
 * couleurs du sac, une couleur epuisee barree), les tailles a choisir
 * (taille epuisee barree et inactive), Sold out quand plus rien ne reste.
 * Puis les packs d'autocollants de public/stickers.json, s'il y en a :
 * aucun bloc sinon. Commande : le formulaire de CONTACT, objet et
 * commande (taille et couleur choisies) deja ecrits (data.ts orderDraft).
 * Les photos ne se chargent qu'a la premiere ouverture de la section.
 *
 * 2026-10-09 (Mika : "faut mettre ces hoodies en avant") : le hoodie WE ARE
 * MUSIC MAKERS en tete, avant la grille (ui/HoodieFeature.tsx, le meme
 * encart que dans le menu : ses deux vues, la taille a choisir, ORDER) ; il
 * n'est pas repete dans la grille. Absent de store.json : pas de tete.
 */

import React, { useEffect, useState } from 'react';
import {
  FEATURED_MERCH,
  MERCH_EMPTY,
  MERCH_NOTE,
  MERCH_TEXT,
  fetchMerch,
  fetchStickers,
  orderDraft,
  type MerchProduct,
  type StickerPack,
} from '../../data';
import { openContact } from '../../actions';
import { HoodieFeature } from '../HoodieFeature';
import { SectionFrame, tabOf, type SectionProps } from './common';

/** Commander : ouvre CONTACT, objet et commande deja ecrits. */
const OrderButton: React.FC<{ tab: number; draft: () => { subject: string; message: string } }> = ({ tab, draft }) => (
  <button
    type="button"
    className="v4-link v4-link-btn v4-merch-order"
    tabIndex={tab}
    aria-controls="v4-section-contact"
    onClick={() => {
      const d = draft();
      openContact('merch', d.subject, d.message);
    }}
  >
    <span>Order</span>
  </button>
);

interface CardProps {
  p: MerchProduct;
  seen: boolean;
  tab: number;
}

const ProductCard: React.FC<CardProps> = ({ p, seen, tab }) => {
  // Vue affichee : pour un sac, c'est aussi la couleur choisie (la premiere en stock)
  const firstIn = p.kind === 'colors' ? Math.max(0, p.views.findIndex((v) => v.inStock)) : 0;
  const [view, setView] = useState(firstIn);
  const [size, setSize] = useState<string | null>(null);
  const shown = p.views[view] ?? p.views[0];
  const colour = p.kind === 'colors' && shown.inStock ? shown.label : null;
  const canOrder = p.available && (p.kind !== 'colors' || shown.inStock);
  const groupLabel = p.kind === 'colors' ? `${p.name} colours` : `${p.name} views`;

  return (
    <li className="v4-merch-item" data-out={p.available ? '0' : '1'}>
      <div className="v4-merch-img">
        {seen && <img src={shown.src} alt={shown.alt} loading="lazy" decoding="async" />}
        {!p.available && <span className="v4-merch-sold">Sold out</span>}
        {p.available && p.kind === 'colors' && !shown.inStock && <span className="v4-merch-sold">Sold out</span>}
      </div>
      {p.views.length > 1 && (
        <div className="v4-merch-thumbs" role="group" aria-label={groupLabel}>
          {p.views.map((v, i) => (
            <button
              key={v.src}
              type="button"
              className="v4-merch-thumb"
              aria-pressed={i === view}
              aria-label={p.kind === 'colors' ? `${v.label}${v.inStock ? '' : ', sold out'}` : v.label}
              data-out={v.inStock ? '0' : '1'}
              tabIndex={tab}
              onClick={() => setView(i)}
            >
              {seen && <img src={v.src} alt="" loading="lazy" decoding="async" />}
            </button>
          ))}
        </div>
      )}
      <p className="v4-merch-head">
        <span className="v4-merch-name">{p.name}</span>
        <span className="v4-merch-price">{p.price}</span>
      </p>
      {p.kind === 'colors' && <p className="v4-row-meta">{colour ?? `${shown.label}, sold out`}</p>}
      {p.sizes && (
        <div className="v4-merch-sizes" role="group" aria-label={`${p.name} size`}>
          {p.sizes.map((z) => (
            <button
              key={z.size}
              type="button"
              className="v4-merch-size"
              data-on={z.inStock ? '1' : '0'}
              aria-pressed={size === z.size}
              aria-label={z.inStock ? `Size ${z.size}` : `Size ${z.size}, sold out`}
              disabled={!z.inStock}
              tabIndex={tab}
              onClick={() => setSize((cur) => (cur === z.size ? null : z.size))}
            >
              {z.size}
            </button>
          ))}
        </div>
      )}
      {canOrder && (
        <OrderButton tab={tab} draft={() => orderDraft({ name: p.name, price: p.price, size, colour })} />
      )}
    </li>
  );
};

const StickerCard: React.FC<{ pack: StickerPack; seen: boolean; tab: number }> = ({ pack, seen, tab }) => (
  <li className="v4-stickers-pack" data-out={pack.soldOut ? '1' : '0'}>
    <div className="v4-stickers-top">
      <span className="v4-stickers-cover">{seen && <img src={pack.cover} alt="" loading="lazy" decoding="async" />}</span>
      <span className="v4-stickers-info">
        <span className="v4-merch-name">{pack.name}</span>
        <span className="v4-merch-price">{pack.price}</span>
        <span className="v4-row-meta">{pack.count} stickers</span>
      </span>
    </div>
    <ul className="v4-stickers-grid" aria-label={`${pack.name}, stickers included`}>
      {pack.items.map((it) => (
        <li key={it.src}>{seen && <img src={it.src} alt={it.alt} loading="lazy" decoding="async" />}</li>
      ))}
    </ul>
    {pack.soldOut ? (
      <p className="v4-merch-sold-line">Sold out</p>
    ) : (
      <OrderButton tab={tab} draft={() => orderDraft({ name: pack.name, price: pack.price })} />
    )}
  </li>
);

export const Merch: React.FC<SectionProps> = ({ active, focusable }) => {
  const [items, setItems] = useState<MerchProduct[] | null>(null);
  const [packs, setPacks] = useState<StickerPack[]>([]);
  // Les photos (100 a 200 Ko chacune) attendent la premiere ouverture
  const [seen, setSeen] = useState(active);
  if (active && !seen) setSeen(true);
  const tab = tabOf(focusable);
  // Le hoodie mis en avant a sa tete ; la grille garde les autres pieces
  const featured = items?.find((p) => p.id === FEATURED_MERCH.id) ?? null;
  const grid = items ? items.filter((p) => p !== featured) : [];

  useEffect(() => {
    let alive = true;
    fetchMerch().then((list) => {
      if (alive) setItems(list);
    });
    fetchStickers().then((list) => {
      if (alive) setPacks(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SectionFrame id="merch" active={active}>
      <p className="v4-sec-text">{MERCH_TEXT}</p>
      {featured && (
        <div className="v4-merch-hero">
          <HoodieFeature product={featured} seen={seen} variant="merch" tab={tab} />
        </div>
      )}
      {items !== null && items.length === 0 && <p className="v4-sec-text">{MERCH_EMPTY}</p>}
      {grid.length > 0 && (
        <ul className="v4-merch">
          {grid.map((p) => (
            <ProductCard key={p.id} p={p} seen={seen} tab={tab} />
          ))}
        </ul>
      )}
      {packs.length > 0 && (
        <>
          <h3 className="v4-sec-sub">Sticker packs</h3>
          <ul className="v4-stickers">
            {packs.map((k) => (
              <StickerCard key={k.id} pack={k} seen={seen} tab={tab} />
            ))}
          </ul>
        </>
      )}
      <p className="v4-row-meta v4-merch-note">{MERCH_NOTE}</p>
    </SectionFrame>
  );
};

export default Merch;
