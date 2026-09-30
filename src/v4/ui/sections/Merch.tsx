/**
 * MERCH (2026-09-30) : ouverte par la puce MERCH de la vue eclatee. Les
 * produits de public/store.json (data.ts fetchMerch, lu une fois au
 * montage : les noms et les prix sont dans le DOM des le chargement), le
 * stock par taille (taille epuisee barree), les couleurs en stock des
 * sacs, Sold out quand plus rien ne reste. Les photos ne se chargent qu'a
 * la premiere ouverture de la section. Commande : courriel prerempli.
 */

import React, { useEffect, useState } from 'react';
import { MERCH_EMPTY, MERCH_TEXT, fetchMerch, type MerchProduct } from '../../data';
import { SectionFrame, tabOf, type SectionProps } from './common';

export const Merch: React.FC<SectionProps> = ({ active, focusable }) => {
  const [items, setItems] = useState<MerchProduct[] | null>(null);
  // Les photos (100 a 200 Ko chacune) attendent la premiere ouverture
  const [seen, setSeen] = useState(active);
  if (active && !seen) setSeen(true);
  const tab = tabOf(focusable);

  useEffect(() => {
    let alive = true;
    fetchMerch().then((list) => {
      if (alive) setItems(list);
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <SectionFrame id="merch" active={active}>
      <p className="v4-sec-text">{MERCH_TEXT}</p>
      {items !== null && items.length === 0 && <p className="v4-sec-text">{MERCH_EMPTY}</p>}
      {items !== null && items.length > 0 && (
        <ul className="v4-merch">
          {items.map((p) => (
            <li key={p.id} className="v4-merch-item" data-out={p.available ? '0' : '1'}>
              <div className="v4-merch-img">
                {seen && <img src={p.image.src} alt={p.image.alt} loading="lazy" decoding="async" />}
                {!p.available && <span className="v4-merch-sold">Sold out</span>}
              </div>
              <p className="v4-merch-head">
                <span className="v4-merch-name">{p.name}</span>
                <span className="v4-merch-price">{p.price}</span>
              </p>
              {p.sizes && (
                <p className="v4-merch-sizes">
                  <span className="v4-sr">In stock: {p.sizes.filter((z) => z.inStock).map((z) => z.size).join(', ') || 'none'}</span>
                  {p.sizes.map((z) => (
                    <span key={z.size} className="v4-merch-size" data-on={z.inStock ? '1' : '0'} aria-hidden="true">
                      {z.size}
                    </span>
                  ))}
                </p>
              )}
              {p.colors && (
                <p className="v4-row-meta">
                  {p.colors.inStock} of {p.colors.total} colors in stock
                </p>
              )}
              {p.available && (
                <a className="v4-link v4-merch-order" href={p.orderHref} tabIndex={tab}>
                  <span>Order by email</span>
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </SectionFrame>
  );
};

export default Merch;
