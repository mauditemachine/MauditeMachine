/**
 * Le volet des machines (desktop, 2026-10-03, demande de Mika : "quand je
 * passe la souris sur le cote gauche de la fenetre, une marge en
 * transition smooth rapide avec la liste des machines"). La souris au bord
 * gauche (ou un clic sur MACHINES, en bas a gauche) fait glisser le volet en
 * 200 ms : la vue d'ensemble, puis chaque machine avec sa vignette 3D
 * (rendue par la scene, scene/renderer.ts thumbnail), son nom et son role ;
 * celle qu'on utilise est marquee. Un choix zoome dessus et referme le
 * volet ; la souris qui sort le referme aussi. Echap le referme. Les
 * vignettes se font a la premiere ouverture, et de nouveau quand la scene
 * est reconstruite (apparence).
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { focusMachine } from '../actions';
import type { Stage } from '../scene/renderer';
import { focus, type Focus, type MachineId } from '../state/focus';
import { intro } from '../state/intro';

const ITEMS: readonly { id: Focus; title: string; sub: string }[] = [
  { id: 'all', title: 'BOTH MACHINES', sub: 'OVERVIEW' },
  { id: 'mm808', title: 'MM-808', sub: 'DRUM MACHINE' },
  { id: 'voy', title: 'MM-ARP', sub: 'ARPEGGIATOR SYNTHESIZER' },
];

/** Fermeture apres que la souris est sortie (ms) : un aller-retour rapide ne le ferme pas. */
const CLOSE_MS = 260;

export const MachineDrawer: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const introState = useSyncExternalStore(intro.subscribe, intro.get, intro.get);
  const [open, setOpen] = useState(false);
  const [thumbs, setThumbs] = useState<Partial<Record<MachineId, string>>>({});
  const thumbsFor = useRef<Stage | null>(null);
  const closeTimer = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Vignettes : a la premiere ouverture pour cette scene
  useEffect(() => {
    if (!open || !stage || thumbsFor.current === stage) return;
    thumbsFor.current = stage;
    const next: Partial<Record<MachineId, string>> = {};
    for (const id of ['mm808', 'voy'] as const) {
      const url = stage.thumbnail(id);
      if (url) next[id] = url;
    }
    setThumbs(next);
  }, [open, stage]);

  // Echap ferme le volet (avant tout le reste)
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  useEffect(() => () => window.clearTimeout(closeTimer.current), []);

  const show = (): void => {
    window.clearTimeout(closeTimer.current);
    setOpen(true);
  };
  const hide = (): void => {
    window.clearTimeout(closeTimer.current);
    closeTimer.current = window.setTimeout(() => setOpen(false), CLOSE_MS);
  };

  if (introState !== 'done') return null;

  return (
    <>
      <div className="v4-mdrawer-hot" aria-hidden="true" onPointerEnter={show} onPointerLeave={hide} />
      <button
        type="button"
        className="v4-mdrawer-tab"
        data-open={open ? '1' : '0'}
        aria-expanded={open}
        aria-controls="v4-mdrawer"
        onPointerEnter={show}
        onPointerLeave={hide}
        onClick={() => setOpen((o) => !o)}
      >
        <span>MACHINES</span>
      </button>
      <div
        ref={panelRef}
        id="v4-mdrawer"
        className="v4-mdrawer"
        data-open={open ? '1' : '0'}
        role="dialog"
        aria-label="Machines"
        aria-hidden={!open}
        onPointerEnter={show}
        onPointerLeave={hide}
      >
        <p className="v4-mdrawer-title">MACHINES</p>
        <ul>
          {ITEMS.map((it) => (
            <li key={it.id}>
              <button
                type="button"
                className="v4-mdrawer-item"
                aria-current={f === it.id ? 'true' : undefined}
                tabIndex={open ? 0 : -1}
                onClick={() => {
                  focusMachine(it.id);
                  setOpen(false);
                }}
              >
                <span className="v4-mdrawer-thumb" data-kind={it.id}>
                  {it.id === 'all' ? (
                    <>
                      {thumbs.mm808 && <img src={thumbs.mm808} alt="" />}
                      {thumbs.voy && <img src={thumbs.voy} alt="" />}
                    </>
                  ) : (
                    thumbs[it.id] && <img src={thumbs[it.id]} alt="" />
                  )}
                </span>
                <span className="v4-mdrawer-name">{it.title}</span>
                <span className="v4-mdrawer-sub">{it.sub}</span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default MachineDrawer;
