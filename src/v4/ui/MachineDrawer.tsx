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
 * est reconstruite (apparence) ou qu'un capot a change (2026-10-04, Mika :
 * "j'ai ouvert et ensuite ferme une machine mais dans la colonne de gauche
 * ca affiche comme si c'etait ouvert") : elles montrent l'etat pose, et
 * une animation en cours se refait a sa fin.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { focusMachine } from '../actions';
import type { Stage } from '../scene/renderer';
import { BASS, DJ, MACHINES, focus, type Focus, type MachineId } from '../state/focus';
import { explode, voyExplode, type ExplodeState } from '../state/explode';
import { intro } from '../state/intro';

const ITEMS: readonly { id: Focus; title: string; sub: string }[] = [
  // L'ensemble a un nom (2026-10-05, Mika : "MM-STUDIO pour Maudite Machine Studio, juste pour donner un nom a tout ca")
  { id: 'all', title: 'MM-STUDIO', sub: 'ALL THE MACHINES' },
  { id: 'mm808', title: 'MM-RYTM', sub: 'DRUM MACHINE' },
  ...(BASS ? [{ id: 'bass' as const, title: 'MM-BASS', sub: 'BASSLINE GENERATOR' }] : []),
  { id: 'voy', title: 'MM-ARP', sub: 'ARPEGGIATOR SYNTHESIZER' },
  ...(DJ ? [{ id: 'dj' as const, title: 'MM-DECKS', sub: 'DJ DECKS AND MIXER' }] : []),
];

/** Fermeture apres que la souris est sortie (ms) : un aller-retour rapide ne le ferme pas. */
const CLOSE_MS = 260;

export const MachineDrawer: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const introState = useSyncExternalStore(intro.subscribe, intro.get, intro.get);
  const hood808 = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  const hoodVoy = useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  const [open, setOpen] = useState(false);
  const [thumbs, setThumbs] = useState<Partial<Record<MachineId, string>>>({});
  const thumbsFor = useRef<{ stage: Stage; hoods: string } | null>(null);
  const closeTimer = useRef(0);
  const panelRef = useRef<HTMLDivElement>(null);

  // Vignettes : a la premiere ouverture pour cette scene et ces capots
  useEffect(() => {
    if (!open || !stage) return;
    const moving = (h: ExplodeState): boolean => h === 'opening' || h === 'closing';
    if (moving(hood808) || moving(hoodVoy)) return;
    const hoods = `${hood808}/${hoodVoy}`;
    const was = thumbsFor.current;
    if (was && was.stage === stage && was.hoods === hoods) return;
    thumbsFor.current = { stage, hoods };
    const next: Partial<Record<MachineId, string>> = {};
    for (const id of MACHINES) {
      const url = stage.thumbnail(id);
      if (url) next[id] = url;
    }
    setThumbs(next);
  }, [open, stage, hood808, hoodVoy]);

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
                      {MACHINES.map((id) => thumbs[id] && <img key={id} src={thumbs[id]} alt="" />)}
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
