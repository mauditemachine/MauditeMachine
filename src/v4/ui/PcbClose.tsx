/**
 * Fermer la machine ouverte, au telephone (2026-10-02, demande de Mika) :
 * machine ouverte, le pad CLOSE est sur le capot releve, loin et de biais ;
 * un bouton CLOSE orange, facon pad, se pose en bas de l'ecran sur l'avant
 * de la carte, au-dessus de la languette du Dock. Mise en page mobile
 * seulement (index.tsx) ; il apparait une fois la machine ouverte, part des
 * que la fermeture commence.
 *
 * Dock deplie (2026-10-03, Mika : CLOSE chevauchait le Dock) : CLOSE monte
 * au-dessus de lui et de sa languette, quelle que soit sa hauteur (celui de
 * la 808 ou celui du MM-VOYAGER), et redescend quand on le replie.
 */

import React, { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { hoodMachine, hoodOf, openToggle } from '../actions';
import type { Stage } from '../scene/renderer';
import { explode, voyExplode } from '../state/explode';
import { focus } from '../state/focus';

interface Props {
  getStage: () => Stage | null;
}

/** Au-dessus du Dock deplie : la languette (30 px, posee sur son bord) et 6 px d'air. */
const ABOVE_DOCK_PX = 36;

/** Hauteur du Dock deplie (0 : aucun), lue sur le DOM. */
function openDockHeight(): number {
  let h = 0;
  document.querySelectorAll<HTMLElement>('.v4-dock[data-open="1"]').forEach((el) => {
    h = Math.max(h, el.getBoundingClientRect().height);
  });
  return Math.round(h);
}

export const PcbClose: React.FC<Props> = ({ getStage }) => {
  // Le capot de la machine qu'on utilise (deux machines, 2026-10-03)
  useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const m = hoodMachine();
  const open = hoodOf(m).get() === 'open';
  const [dockH, setDockH] = useState(0);

  // Le Dock qui se deplie, se replie ou change de taille (le Dock monte selon la machine)
  useLayoutEffect(() => {
    if (!open) return undefined;
    const measure = (): void => setDockH(openDockHeight());
    measure();
    const docks = document.querySelectorAll<HTMLElement>('.v4-dock');
    const mo = new MutationObserver(measure);
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(measure);
    docks.forEach((el) => {
      mo.observe(el, { attributes: true, attributeFilter: ['data-open'] });
      ro?.observe(el);
    });
    return () => {
      mo.disconnect();
      ro?.disconnect();
    };
  }, [open, f]);

  if (!open) return null;
  return (
    <button
      type="button"
      className="v4-pcb-close"
      data-lifted={dockH > 0 ? '1' : '0'}
      style={dockH > 0 ? { bottom: `${dockH + ABOVE_DOCK_PX}px` } : undefined}
      aria-label="Close the machine"
      onClick={() => openToggle(getStage(), m)}
    >
      CLOSE
    </button>
  );
};

export default PcbClose;
