/**
 * Le menu (2026-10-04 : le meme sur desktop et au telephone, Mika : "le
 * menu desktop aussi plus beau comme le mobile"). Plein ecran sous
 * l'en-tete, dans la couleur de la page : les cinq pages en grands titres
 * numerotes, separes d'un filet, chacun sa fleche ; GOODIES, MERCH et
 * STUDIO en pastilles sous "Under the hood" ; six reseaux sous "Follow",
 * chacun son icone et son nom (2026-10-04, Mika : "je veux les noms des
 * liens et aussi leurs icones"), puis sonaa.ca et massivemedias.com avec
 * leurs logos ; au pied, recentrer la vue.
 *
 * 2026-10-09 (Mika : "je veux le selecteur darkmode et light mode au dessus
 * de tout, en haut a gauche dans le menu" ; "au dessus de Under The Hood ma
 * description de Maudite Machine et un petit texte disant que je suis
 * l'auteur de ce site web et de ces machines... la boutique ou mon
 * bandcamp" ; "faut mettre ces hoodies en avant") : l'interrupteur Dark /
 * Light (ui/AppearanceToggle.tsx) en haut a gauche, au-dessus des pages ;
 * sous les pages, "Behind the machines" (la bio du press kit, le mot signe
 * de Mika, SHOP et BANDCAMP), puis l'encart du hoodie (ui/HoodieFeature.tsx),
 * puis Under the hood, Follow et le pied. Desktop (variant 'desk') : les
 * pages a gauche en tres grand ; a droite le mot de Mika en haut, sur toute
 * la largeur, au-dessus du hoodie et de Under the hood (trois colonnes des
 * 1200 px, deux en dessous). Les lignes arrivent l'une apres l'autre. Un
 * choix ferme le menu puis agit (l'interrupteur, non : on voit le
 * changement) ; Echap le ferme (le focus revient au bouton qui l'a ouvert).
 * Ouvert depuis ui/MobileHeader.tsx et ui/Header.tsx.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { openSection, page, resetView } from '../actions';
import { MENU_ABOUT, SOCIALS, type SocialId } from '../data';
import type { Stage } from '../scene/renderer';
import { section } from '../state/section';
import { AMark } from './AMark';
import { AppearanceToggle } from './AppearanceToggle';
import { ExternalLink } from './ExternalLink';
import { HOOD_LINKS, PAGE_LINKS, openHood } from './Header';
import { HoodieFeature, useFeaturedMerch } from './HoodieFeature';
import { BandcampIcon, SOCIAL_ICONS } from './icons';
import './menu.css';

const ICONS: Readonly<Record<string, string>> = {
  goodies: 'fa-solid fa-gift',
  merch: 'fa-solid fa-shirt',
  studio: 'fa-solid fa-microchip',
};

/** Les reseaux du menu (les quinze sont dans CONTACT). */
const MENU_SOCIALS: readonly SocialId[] = ['instagram', 'soundcloud', 'spotify', 'applemusic', 'youtube', 'bandcamp'];

/** Les sites amis (2026-10-04, Mika) : leur nom tel quel, leur logo. */
const SITES: readonly { id: string; label: string; href: string; icon: string; color: string }[] = [
  { id: 'sonaa', label: 'sonaa.ca', href: 'https://sonaa.ca', icon: '/logo/sonaa-icon.png', color: '#ff6a13' },
  { id: 'massive', label: 'massivemedias.com', href: 'https://massivemedias.com', icon: '/logo/massive-icon.png', color: '#ff9b3d' },
];

const BANDCAMP = SOCIALS.find((x) => x.id === 'bandcamp');

/** Le store.json du hoodie se lit quand la page respire, pour que l'encart soit la a la premiere ouverture. */
const PREFETCH_MS = 2500;

const Icon: React.FC<{ name: string }> = ({ name }) => <i className={`${name} v4-fa`} aria-hidden="true" />;

interface Props {
  getStage: () => Stage | null;
  open: boolean;
  /** refocus : rendre le focus au bouton du menu (Echap) */
  onClose: (refocus: boolean) => void;
  variant: 'mobile' | 'desk';
}

export const MenuSheet: React.FC<Props> = ({ getStage, open, onClose, variant }) => {
  const opened = useSyncExternalStore(section.subscribe, section.get, section.get);
  // Plus de OPEN THE MACHINE (2026-10-05, Mika : "enleve OPEN THE MACHINE dans le menu, ca sert a rien") : OPEN est sur la machine
  const ref = useRef<HTMLElement>(null);
  // Les photos du hoodie n'arrivent qu'a la premiere ouverture ; sa fiche (store.json, 3 Ko) un peu avant
  const [seen, setSeen] = useState(open);
  if (open && !seen) setSeen(true);
  const [load, setLoad] = useState(false);
  const featured = useFeaturedMerch(load || seen);

  useEffect(() => {
    const ric = (window as Window & { requestIdleCallback?: (cb: () => void, o?: { timeout: number }) => number }).requestIdleCallback;
    const t = window.setTimeout(() => (ric ? ric(() => setLoad(true), { timeout: 4000 }) : setLoad(true)), PREFETCH_MS);
    return () => window.clearTimeout(t);
  }, []);

  // Ouvert : le focus sur la premiere page (l'interrupteur est juste avant, Maj+Tab), Echap le ferme
  useEffect(() => {
    if (!open) return undefined;
    ref.current?.querySelector<HTMLElement>('.v4-mm-page')?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      onClose(true);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, onClose]);

  /** Un choix du menu : il se ferme, puis l'action part. */
  const pick = (fn: () => void) => (): void => {
    onClose(false);
    fn();
  };

  /** SHOP et l'encart : MERCH, ouverte (jamais refermee comme le fait sa pastille deja allumee). */
  const shop = pick(() => openSection('merch'));
  const n = PAGE_LINKS.length;

  return (
    <nav ref={ref} id="v4-mmenu" className="v4-mmenu" data-variant={variant} aria-label="Main" hidden={!open}>
      <div className="v4-mm-look">
        <AppearanceToggle />
      </div>
      <ol className="v4-mm-pages">
        {PAGE_LINKS.map((l, i) => (
          <li key={l.id} style={{ '--i': i + 1 } as React.CSSProperties}>
            <button
              type="button"
              className="v4-mm-page"
              data-active={opened === l.id ? '1' : '0'}
              aria-expanded={opened === l.id}
              aria-controls={`v4-section-${l.id}`}
              onClick={pick(() => page(l.id, getStage()))}
            >
              <span className="v4-mm-num" aria-hidden="true">
                {String(i + 1).padStart(2, '0')}
              </span>
              <span className="v4-mm-label">{l.label}</span>
              <i className="fa-solid fa-arrow-right v4-mm-go" aria-hidden="true" />
            </button>
          </li>
        ))}
      </ol>
      <div className="v4-mm-about" style={{ '--i': n + 1 } as React.CSSProperties}>
        <p className="v4-mm-kicker">{MENU_ABOUT.kicker}</p>
        <p className="v4-mm-bio">{MENU_ABOUT.bio}</p>
        <div className="v4-mm-word">
          <p className="v4-mm-note">{MENU_ABOUT.note}</p>
          <p className="v4-mm-sign">
            <AMark className="v4-mm-sign-a" />
            <span>{MENU_ABOUT.sign}</span>
          </p>
          <div className="v4-mm-cta">
            <button type="button" className="v4-mm-shop" aria-controls="v4-section-merch" onClick={shop}>
              <Icon name={ICONS.merch} />
              <span>Shop</span>
            </button>
            {BANDCAMP && (
              <ExternalLink className="v4-mm-bandcamp" href={BANDCAMP.href} style={{ '--brand': BANDCAMP.color } as React.CSSProperties}>
                <BandcampIcon />
                <span>Bandcamp</span>
              </ExternalLink>
            )}
          </div>
        </div>
      </div>
      {featured && (
        <div className="v4-mm-feature" style={{ '--i': n + 2 } as React.CSSProperties}>
          <HoodieFeature product={featured} seen={seen} variant="menu" onShop={shop} />
        </div>
      )}
      <div className="v4-mm-side">
        <div className="v4-mm-hood" style={{ '--i': n + 2 } as React.CSSProperties}>
          <p className="v4-mm-kicker">Under the hood</p>
          <ul className="v4-mm-pills">
            {HOOD_LINKS.map((l) => (
              <li key={l.id}>
                <button
                  type="button"
                  className="v4-mm-pill"
                  data-active={opened === l.id ? '1' : '0'}
                  aria-expanded={opened === l.id}
                  aria-controls={`v4-section-${l.id}`}
                  onClick={pick(() => openHood(l.id, getStage()))}
                >
                  <Icon name={ICONS[l.id]} />
                  <span>{l.label}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div className="v4-mm-follow" style={{ '--i': n + 3 } as React.CSSProperties}>
          <p className="v4-mm-kicker">Follow</p>
          <ul className="v4-mm-socials" aria-label="Social links">
            {MENU_SOCIALS.map((id) => {
              const so = SOCIALS.find((x) => x.id === id);
              if (!so) return null;
              const SoIcon = SOCIAL_ICONS[id];
              return (
                <li key={id}>
                  <ExternalLink className="v4-mm-social" href={so.href} mark={false} style={{ '--brand': so.color } as React.CSSProperties}>
                    <SoIcon />
                    <span className="v4-mm-social-name">{so.label}</span>
                  </ExternalLink>
                </li>
              );
            })}
            {SITES.map((site) => (
              <li key={site.id} className="v4-mm-site-row">
                <ExternalLink className="v4-mm-social v4-mm-site" href={site.href} mark={false} style={{ '--brand': site.color } as React.CSSProperties}>
                  <img className="v4-mm-site-icon" src={site.icon} alt="" width={22} height={22} loading="lazy" decoding="async" />
                  <span className="v4-mm-social-name">{site.label}</span>
                </ExternalLink>
              </li>
            ))}
          </ul>
        </div>
        <div className="v4-mm-foot" style={{ '--i': n + 4 } as React.CSSProperties}>
          <div className="v4-mm-tools">
            <button type="button" className="v4-mmenu-reset" onClick={pick(() => resetView(getStage()))}>
              <Icon name="fa-solid fa-arrows-rotate" />
              <span>Reset view</span>
            </button>
          </div>
        </div>
      </div>
    </nav>
  );
};

export default MenuSheet;
