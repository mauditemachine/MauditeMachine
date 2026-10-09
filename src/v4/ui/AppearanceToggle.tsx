/**
 * Dark / Light (2026-10-09, Mika : "je veux le selecteur darkmode et light
 * mode au dessus de tout, en haut a gauche dans le menu, dans un bouton
 * poussoir style image 4, mais au lieu du soleil et de la lune quelque
 * chose de plus proche de mon design"). Un seul interrupteur : une piste
 * en pilule et un bouton rond qui glisse (petit ressort), le "A" des
 * machines grave dessus (ui/AMark.tsx) a la place du soleil et de la lune,
 * le nom de l'apparence en Robot Radicals (la police du logo) et une petite
 * LED comme sur les touches des machines. Sombre : piste noire, bouton
 * jaune du logo a gauche, LED jaune ; clair : piste creme, bouton noir a
 * droite, LED orange (comme l'image de Mika : le jour a droite).
 *
 * Un clic, Espace ou Entree basculent (bouton natif), role="switch" et
 * aria-checked (coche = clair). Le bouton glisse tout de suite ; l'apparence
 * change 280 ms plus tard, une fois le ressort joue : la scene 3D se
 * reconstruit au changement (plusieurs secondes de fil principal au
 * telephone) et figerait sinon le bouton au depart. Mouvement reduit :
 * sans ressort, le changement est immediat. Le meme magasin qu'avant
 * (state/appearance.ts : garde dans le localStorage, applique a la scene et
 * au DOM par index.tsx). En haut a gauche du menu (ui/MenuSheet.tsx), sur
 * desktop comme au telephone ; il ne ferme pas le menu, on voit le
 * changement.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { appearance } from '../state/appearance';
import { useReducedMotion } from '../state/motion';
import type { Appearance } from '../theme';
import { AMark } from './AMark';

/** Le temps du ressort avant de changer l'apparence (ms). */
const SETTLE_MS = 280;

export const AppearanceToggle: React.FC = () => {
  const look = useSyncExternalStore(appearance.subscribe, appearance.get, appearance.get);
  const reduced = useReducedMotion();
  // La position du bouton : en avance sur l'apparence pendant le ressort
  const [shown, setShown] = useState<Appearance>(look);
  const timer = useRef<number | null>(null);
  /** l'apparence promise par le ressort en cours */
  const pending = useRef<Appearance | null>(null);

  // L'apparence changee ailleurs (ou celle du ressort, arrivee) : le bouton la suit
  useEffect(() => {
    if (timer.current === null) setShown(look);
  }, [look]);

  // Demonte pendant le ressort (le menu passe de Header a MobileHeader, telephone tourne) : le
  // changement part tout de suite au lieu de se perdre (revue du 2026-10-09)
  useEffect(
    () => () => {
      if (timer.current === null) return;
      window.clearTimeout(timer.current);
      timer.current = null;
      if (pending.current) appearance.set(pending.current);
      pending.current = null;
    },
    []
  );

  const flip = (): void => {
    const next: Appearance = shown === 'dark' ? 'light' : 'dark';
    setShown(next);
    if (timer.current !== null) window.clearTimeout(timer.current);
    timer.current = null;
    pending.current = null;
    if (reduced) {
      appearance.set(next);
      return;
    }
    pending.current = next;
    timer.current = window.setTimeout(() => {
      timer.current = null;
      pending.current = null;
      appearance.set(next);
    }, SETTLE_MS);
  };

  const light = shown === 'light';
  return (
    <button
      type="button"
      role="switch"
      className="v4-look"
      data-look={shown}
      aria-checked={light}
      aria-label="Appearance: light mode"
      title={light ? 'Switch to dark' : 'Switch to light'}
      onClick={flip}
    >
      <span className="v4-look-track" aria-hidden="true">
        <span className="v4-look-word" data-word="dark">
          <i className="v4-look-led" />
          Dark
        </span>
        <span className="v4-look-word" data-word="light">
          Light
          <i className="v4-look-led" />
        </span>
        <span className="v4-look-knob">
          <AMark className="v4-look-a" />
        </span>
      </span>
    </button>
  );
};

export default AppearanceToggle;
