/**
 * L'encart du hoodie WE ARE MUSIC MAKERS (2026-10-09, Mika : "faut mettre
 * ces hoodies en avant... decoupe les hoodies fond transparent en png et
 * cree un nouvel encart... toute taille et ca coute 50$ pour un"). Le
 * meme encart a deux endroits : dans le menu, sous le mot de Mika et avant
 * Under the hood (variant 'menu' : SHOP THE HOODIE ouvre MERCH), et en tete
 * de MERCH (variant 'merch' : la taille a choisir et ORDER, la commande de
 * toutes les pieces, le formulaire de CONTACT deja ecrit, data.ts
 * orderDraft).
 *
 * Le hoodie pose sur le jaune du logo, le grand "A" des machines en
 * filigrane : le dos (le grand imprime) devant, la face un peu en retrait a
 * gauche ; un toucher sur la scene (ou FRONT / BACK, pour le clavier et les
 * lecteurs d'ecran) les fait passer l'un devant l'autre avec un petit
 * ressort. Les deux restent visibles : on voit d'un coup d'oeil qu'il y a
 * un devant et un dos. Les photos (public/images/Merch_Hoodie-WAMM-*.webp,
 * detourees, fond transparent) n'arrivent qu'avec seen (menu ouvert une
 * fois, section MERCH ouverte une fois). Le produit vient de
 * public/store.json (prix, tailles, stock) : rien d'ecrit en dur ici que
 * le titre et les textes alternatifs.
 */

import React, { useEffect, useState } from 'react';
import { openContact } from '../actions';
import { FEATURED_MERCH, fetchMerch, orderDraft, type MerchProduct, type MerchView } from '../data';
import { AMark } from './AMark';
import './menu.css';

/**
 * Le produit mis en avant, lu dans public/store.json (une lecture par page,
 * data.ts fetchMerch) : undefined en attendant, null s'il n'y est pas ou
 * plus (retire ou inactif dans l'admin, lecture en echec).
 */
export function useFeaturedMerch(load: boolean): MerchProduct | null | undefined {
  const [product, setProduct] = useState<MerchProduct | null | undefined>(undefined);
  useEffect(() => {
    if (!load) return undefined;
    let alive = true;
    fetchMerch().then((list) => {
      if (alive) setProduct(list.find((p) => p.id === FEATURED_MERCH.id) ?? null);
    });
    return () => {
      alive = false;
    };
  }, [load]);
  return product;
}

type Face = 'Front' | 'Back';
const FACES: readonly Face[] = ['Front', 'Back'];

/** La fleche des boutons : 14 px, couleur du texte. */
const Arrow: React.FC = () => (
  <svg className="v4-hoodie-arrow" viewBox="0 0 16 16" width="14" height="14" aria-hidden="true" focusable="false">
    <path d="M2 8h11M9 3.5L13.5 8 9 12.5" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface Props {
  product: MerchProduct;
  /** les photos peuvent se charger */
  seen: boolean;
  variant: 'menu' | 'merch';
  /** tabIndex des controles (MERCH : -1 tant que la section est masquee) */
  tab?: number;
  /** variant 'menu' : ouvrir MERCH (le menu se ferme d'abord) */
  onShop?: () => void;
}

export const HoodieFeature: React.FC<Props> = ({ product, seen, variant, tab = 0, onShop }) => {
  const front: MerchView = product.views.find((v) => v.label === 'Front') ?? product.views[0];
  const back: MerchView = product.views.find((v) => v.label === 'Back') ?? product.views[1] ?? front;
  // Le dos devant d'abord : c'est lui qui porte WE ARE MUSIC MAKERS
  const [face, setFace] = useState<Face>('Back');
  const [size, setSize] = useState<string | null>(null);
  // ORDER sans taille : les tailles le demandent (une fois choisie, la commande part)
  const [ask, setAsk] = useState(false);

  const sizes = product.sizes ?? [];
  const inStock = sizes.filter((z) => z.inStock);
  const allSizes = sizes.length > 0 && inStock.length === sizes.length;
  const titleId = `v4-hoodie-${variant}-title`;
  const Title = variant === 'merch' ? 'h3' : 'p';
  const turn = (): void => setFace((f) => (f === 'Back' ? 'Front' : 'Back'));

  const order = (): void => {
    if (sizes.length > 0 && size === null) {
      setAsk(true);
      return;
    }
    const d = orderDraft({ name: product.name, price: product.price, size, colour: null });
    openContact('merch', d.subject, d.message);
  };

  const pic = (v: MerchView, f: Face): React.ReactNode => (
    <img
      key={f}
      className="v4-hoodie-pic"
      data-slot={face === f ? 'main' : 'side'}
      src={v.src}
      alt={FEATURED_MERCH.alt[f] ?? v.alt}
      width={FEATURED_MERCH.w}
      height={FEATURED_MERCH.h}
      loading="lazy"
      decoding="async"
      draggable={false}
    />
  );

  return (
    <article className="v4-hoodie" data-variant={variant} data-out={product.available ? '0' : '1'} aria-labelledby={titleId}>
      {/* La scene : un toucher retourne le hoodie (FRONT / BACK font de meme au clavier) */}
      <div className="v4-hoodie-stage" data-face={face} onClick={turn}>
        <AMark className="v4-hoodie-mark" />
        <p className="v4-hoodie-kicker">
          <i className="v4-hoodie-led" aria-hidden="true" />
          {FEATURED_MERCH.kicker}
        </p>
        <p className="v4-hoodie-price">{product.available ? product.price : 'Sold out'}</p>
        {seen && (
          <>
            {pic(front, 'Front')}
            {pic(back, 'Back')}
          </>
        )}
      </div>

      <div className="v4-hoodie-body">
        {/* HOODIE et FRONT / BACK sur la meme ligne : WE ARE MUSIC MAKERS a toute la largeur dessous */}
        <div className="v4-hoodie-head">
          <span className="v4-hoodie-name" aria-hidden="true">
            {FEATURED_MERCH.name}
          </span>
          <div className="v4-hoodie-faces" role="group" aria-label="Hoodie views">
            {FACES.map((f) => (
              <button key={f} type="button" className="v4-hoodie-face" aria-pressed={face === f} tabIndex={tab} onClick={() => setFace(f)}>
                {f}
              </button>
            ))}
          </div>
        </div>
        <Title className="v4-hoodie-title" id={titleId}>
          <span className="v4-sr">{FEATURED_MERCH.name} </span>
          <span className="v4-hoodie-line">{FEATURED_MERCH.line}</span>
        </Title>

        {variant === 'menu' && inStock.length > 0 && (
          <p className="v4-hoodie-sizes">
            <span className="v4-hoodie-sizes-label">{allSizes ? 'All sizes' : 'Sizes'}</span>
            <span className="v4-hoodie-chips">
              {inStock.map((z) => (
                <span key={z.size} className="v4-hoodie-chip">
                  {z.size}
                </span>
              ))}
            </span>
          </p>
        )}

        {variant === 'merch' && sizes.length > 0 && product.available && (
          <div className="v4-hoodie-pick" data-ask={ask && size === null ? '1' : '0'}>
            <p className="v4-hoodie-sizes-label" id="v4-hoodie-size-label">
              {allSizes ? 'All sizes' : 'Size'}
            </p>
            <div className="v4-hoodie-chips" role="group" aria-labelledby="v4-hoodie-size-label">
              {sizes.map((z) => (
                <button
                  key={z.size}
                  type="button"
                  className="v4-hoodie-chip"
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
            <p className="v4-hoodie-hint" aria-live="polite">
              {ask && size === null ? 'Pick your size first.' : ''}
            </p>
          </div>
        )}

        {variant === 'menu' && (
          <button type="button" className="v4-hoodie-cta" aria-controls="v4-section-merch" onClick={onShop}>
            <span>Shop the hoodie</span>
            <Arrow />
          </button>
        )}
        {variant === 'merch' &&
          (product.available ? (
            <button type="button" className="v4-hoodie-cta" aria-controls="v4-section-contact" tabIndex={tab} onClick={order}>
              <span>{size ? `Order, size ${size}` : 'Order'}</span>
              <Arrow />
            </button>
          ) : (
            <p className="v4-merch-sold-line">Sold out</p>
          ))}
      </div>
    </article>
  );
};

export default HoodieFeature;
