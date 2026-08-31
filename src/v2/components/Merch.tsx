/**
 * Merch /v2 : grille de produits depuis public/store.json (la MEME source
 * que la boutique v1 et l'admin — un edit dans l'admin met a jour les
 * deux sites sans rebuild).
 *
 * store.json liste des VUES (front/back, couleurs) : on les regroupe par
 * category en 4 produits, comme le Store v1. La v1 vend par formulaire de
 * contact prerempli ; /v2 n'a pas de formulaire, l'achat passe par un
 * mailto de commande prerempli (meme canal : la commande par email).
 * Epuise = marque SOLD OUT, jamais masque.
 */

import React, { useEffect, useMemo, useState } from 'react';
import { BOOKING_CONTACTS } from '../data/contacts';

interface StoreItem {
  id: number;
  src: string;
  alt: string;
  caption: string;
  price: string;
  category: string;
  active: boolean;
  sizes?: Record<string, boolean>;
  soldOut: boolean;
}

interface Product {
  category: string;
  name: string;
  price: string;
  images: { src: string; alt: string }[];
  sizes: Record<string, boolean> | null;
  /** au moins une vue/couleur disponible */
  available: boolean;
  /** pour les produits multi-couleurs : x dispo / y total */
  variants: { available: number; total: number } | null;
}

const ORDER_EMAIL =
  BOOKING_CONTACTS.find((c) => c.id === 'na')?.email || 'mauditemachine@gmail.com';

const SIZE_ORDER = ['S', 'M', 'L', 'XL'];

function groupProducts(items: StoreItem[]): Product[] {
  const byCat = new Map<string, StoreItem[]>();
  for (const it of items) {
    if (!it.active) continue;
    const list = byCat.get(it.category) || [];
    list.push(it);
    byCat.set(it.category, list);
  }
  return [...byCat.entries()].map(([category, rawViews]) => {
    // store.json liste parfois Back avant Front : la carte doit ouvrir
    // sur la face avant, le survol revele le dos.
    const views = [...rawViews].sort(
      (a, b) => Number(/front/i.test(b.alt)) - Number(/front/i.test(a.alt))
    );
    // Les sacs : chaque vue est une couleur avec son propre stock ;
    // les textiles : front/back du meme produit.
    const isColorVariants = !views[0].sizes;
    const available = views.some((v) => !v.soldOut);
    return {
      category,
      name: views[0].caption,
      price: views[0].price,
      images: views
        .filter((v) => (isColorVariants ? !v.soldOut : true) || views.every((x) => x.soldOut))
        .map((v) => ({ src: `/${v.src.replace(/^\//, '')}`, alt: v.alt })),
      sizes: views[0].sizes || null,
      available,
      variants: isColorVariants
        ? { available: views.filter((v) => !v.soldOut).length, total: views.length }
        : null,
    };
  });
}

const orderHref = (p: Product) =>
  `mailto:${ORDER_EMAIL}?subject=${encodeURIComponent(`Order: ${p.name}`)}&body=${encodeURIComponent(
    `Hi,\n\nI'd like to order: ${p.name} (${p.price})\n${p.sizes ? 'Size: \n' : ''}${p.variants ? 'Color: \n' : ''}Shipping address: \n\nThanks!`
  )}`;

const Merch: React.FC = () => {
  const [items, setItems] = useState<StoreItem[] | null>(null);

  useEffect(() => {
    let alive = true;
    fetch('/store.json')
      .then((r) => r.json())
      .then((data) => alive && setItems(Array.isArray(data) ? data : []))
      .catch(() => alive && setItems([]));
    return () => {
      alive = false;
    };
  }, []);

  const products = useMemo(() => (items ? groupProducts(items) : []), [items]);

  return (
    <section className="v2-section" id="merch">
      <div className="v2-section-head">
        <h2 className="v2-section-title"><span className="v2-section-num">05</span>Merch</h2>
        <span className="v2-label">
          {products.length ? `${products.length} items · ships from Montréal` : 'Store'}
        </span>
      </div>

      <p className="v2-section-intro">
        Small runs, printed in Montréal, ordered by email — sizes and colors
        below, first come first served.
      </p>

      {items === null && <p className="v2-label">Loading…</p>}

      <div className="v2-merch">
        {products.map((p) => {
          const front = p.images[0];
          const back = p.images[1];
          return (
            <div key={p.category} className={`v2-merch-card${p.available ? '' : ' is-out'}`}>
              <a
                className="v2-merch-visual"
                href={p.available ? orderHref(p) : undefined}
                aria-label={
                  p.available ? `Commander ${p.name} par email` : `${p.name} : épuisé`
                }
                onClick={p.available ? undefined : (e) => e.preventDefault()}
              >
                <img src={front.src} alt={front.alt} loading="lazy" decoding="async" />
                {back && (
                  <img
                    className="v2-merch-back"
                    src={back.src}
                    alt=""
                    loading="lazy"
                    decoding="async"
                    aria-hidden="true"
                  />
                )}
                {!p.available && <span className="v2-merch-soldout">Sold out</span>}
                {p.available && (
                  <span className="v2-gallery-cap v2-merch-cap">Order by email →</span>
                )}
              </a>

              <div className="v2-merch-meta">
                <span className="v2-merch-name">{p.name}</span>
                <span className="v2-merch-price">{p.price}</span>
              </div>

              <div className="v2-label v2-merch-sub">
                {p.sizes && (
                  <span className="v2-merch-sizes">
                    {SIZE_ORDER.filter((s) => p.sizes && s in p.sizes).map((s) => (
                      <span key={s} className={p.sizes![s] ? '' : 'is-off'}>
                        {s}
                      </span>
                    ))}
                  </span>
                )}
                {p.variants && (
                  <span>
                    {p.variants.available} of {p.variants.total} colors available
                  </span>
                )}
              </div>
            </div>
          );
        })}
      </div>

      {items !== null && products.length === 0 && (
        <p className="v2-label">Store is being restocked — check back soon.</p>
      )}
    </section>
  );
};

export default Merch;
