/**
 * Deux machines sur la table (2026-10-03, demande de Mika) :
 * - desktop, vue d'ensemble : sous chaque machine, son nom (MM-808 DRUM
 *   MACHINE, MM-VOYAGER SYNTHESIZER) ; la machine entiere se clique
 *   (couche de saisie) et son nom aussi (un bouton, le clavier y passe) :
 *   la camera zoome dessus ;
 * - desktop : le volet des machines au bord gauche (ui/MachineDrawer.tsx)
 *   passe de l'une a l'autre ou a la vue d'ensemble (Echap et le logo
 *   reviennent aussi a la vue d'ensemble) ;
 * - telephone : une machine a la fois ; un selecteur sous l'en-tete
 *   (MM-808 / VOYAGER) et une fleche au bord de l'ecran montrent l'autre,
 *   un glisser horizontal y passe aussi.
 * Les noms suivent leur machine a chaque frame rendue (boite projetee de
 * ses volumes, scene/hit.ts machineBox), sans rendu React.
 */

import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { focusMachine } from '../actions';
import type { Stage } from '../scene/renderer';
import { MACHINES, focus, type MachineId } from '../state/focus';
import { intro } from '../state/intro';
import { MachineDrawer } from './MachineDrawer';

const NAMES: Record<MachineId, { title: string; sub: string; aria: string }> = {
  mm808: { title: 'MM-RYTM', sub: 'DRUM MACHINE', aria: 'Play the MM-RYTM drum machine' },
  voy: { title: 'MM-ARP', sub: 'SYNTHESIZER', aria: 'Play the MM-ARP synthesizer' },
  dj: { title: 'MM-DECKS', sub: 'DJ DECKS AND MIXER', aria: 'Play the MM-DECKS DJ decks and mixer' },
};

const Chevron: React.FC<{ dir: 'left' | 'right' }> = ({ dir }) => (
  <svg viewBox="0 0 16 16" width="16" height="16" aria-hidden="true" focusable="false">
    <path d={dir === 'left' ? 'M10 3 5 8l5 5' : 'M6 3l5 5-5 5'} fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
  </svg>
);

interface Props {
  stage: Stage | null;
  mobile: boolean;
}

export const MachineNav: React.FC<Props> = ({ stage, mobile }) => {
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const settled = useSyncExternalStore(focus.subscribe, focus.settled, focus.settled);
  const introState = useSyncExternalStore(intro.subscribe, intro.get, intro.get);
  const refs = useRef(new Map<MachineId, HTMLButtonElement>());
  const overview = !mobile && f === 'all' && settled && introState === 'done';

  // Les noms suivent leur machine (vue d'ensemble seulement)
  useLayoutEffect(() => {
    if (!stage || !overview) return undefined;
    const last = new Map<MachineId, string>();
    const place = (): void => {
      // Les noms sur une meme ligne, sous la plus basse des machines
      const boxes = Object.fromEntries(MACHINES.map((id) => [id, stage.hit.machineBox(id)])) as Partial<Record<MachineId, ReturnType<typeof stage.hit.machineBox>>>;
      const bottom = Math.max(...MACHINES.map((id) => {
        const b = boxes[id];
        return b ? b.y + b.h : -Infinity;
      }));
      for (const id of MACHINES) {
        const el = refs.current.get(id);
        const b = boxes[id];
        if (!el || !b) continue;
        const key = `${Math.round(b.x + b.w / 2)},${Math.round(bottom)}`;
        if (last.get(id) === key) continue;
        last.set(id, key);
        el.style.transform = `translate(${Math.round(b.x + b.w / 2)}px, ${Math.round(bottom + 14)}px) translateX(-50%)`;
      }
    };
    place();
    const offView = stage.onView(place);
    const offIdle = stage.onIdle(place);
    return () => {
      offView();
      offIdle();
    };
  }, [stage, overview]);

  if (mobile) {
    const m: MachineId = f === 'all' ? 'mm808' : f;
    const i = MACHINES.indexOf(m);
    // La fleche montre la machine suivante (la derniere : la premiere)
    const next = MACHINES[(i + 1) % MACHINES.length];
    const back = next === MACHINES[0] && MACHINES.length > 1;
    return (
      <>
        <div className="v4-mswitch" role="group" aria-label="Machine">
          {MACHINES.map((id) => (
            <button key={id} type="button" className="v4-mswitch-btn" aria-pressed={m === id} onClick={() => focusMachine(id)}>
              {NAMES[id].title}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="v4-medge"
          data-side={back ? 'left' : 'right'}
          aria-label={`Show the ${NAMES[next].title} ${NAMES[next].sub.toLowerCase()}`}
          onClick={() => focusMachine(next)}
        >
          <Chevron dir={back ? 'left' : 'right'} />
        </button>
      </>
    );
  }

  return (
    <>
      {MACHINES.map((id) => (
        <button
          key={id}
          ref={(el) => {
            if (el) refs.current.set(id, el);
            else refs.current.delete(id);
          }}
          type="button"
          className="v4-mname"
          data-visible={overview ? '1' : '0'}
          aria-label={NAMES[id].aria}
          tabIndex={overview ? 0 : -1}
          onClick={() => focusMachine(id)}
        >
          <span className="v4-mname-title">{NAMES[id].title}</span>
          <span className="v4-mname-sub">{NAMES[id].sub}</span>
        </button>
      ))}
      <MachineDrawer stage={stage} />
    </>
  );
};

export default MachineNav;
