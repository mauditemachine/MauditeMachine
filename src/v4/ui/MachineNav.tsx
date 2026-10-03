/**
 * Deux machines sur la table (2026-10-03, demande de Mika) :
 * - desktop, vue d'ensemble : sous chaque machine, son nom (MM-808 DRUM
 *   MACHINE, MM-VOYAGEUR SYNTHESIZER) ; la machine entiere se clique
 *   (couche de saisie) et son nom aussi (un bouton, le clavier y passe) :
 *   la camera zoome dessus ;
 * - desktop, une machine utilisee : BOTH MACHINES, en bas a gauche,
 *   revient a la vue d'ensemble (Echap et le logo aussi) ;
 * - telephone : une machine a la fois ; un selecteur sous l'en-tete
 *   (MM-808 / VOYAGEUR) et une fleche au bord de l'ecran montrent l'autre,
 *   un glisser horizontal y passe aussi.
 * Les noms suivent leur machine a chaque frame rendue (boite projetee de
 * ses volumes, scene/hit.ts machineBox), sans rendu React.
 */

import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { focusMachine } from '../actions';
import type { Stage } from '../scene/renderer';
import { focus, type MachineId } from '../state/focus';
import { intro } from '../state/intro';

const NAMES: Record<MachineId, { title: string; sub: string; aria: string }> = {
  mm808: { title: 'MM-808', sub: 'DRUM MACHINE', aria: 'Play the MM-808 drum machine' },
  voy: { title: 'MM-VOYAGEUR', sub: 'SYNTHESIZER', aria: 'Play the MM-VOYAGEUR synthesizer' },
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
      // Les deux noms sur une meme ligne, sous la plus basse des deux machines
      const boxes = { mm808: stage.hit.machineBox('mm808'), voy: stage.hit.machineBox('voy') };
      const bottom = Math.max(...(['mm808', 'voy'] as const).map((id) => (boxes[id] ? boxes[id].y + boxes[id].h : -Infinity)));
      for (const id of ['mm808', 'voy'] as const) {
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
    const m = f === 'voy' ? 'voy' : 'mm808';
    return (
      <>
        <div className="v4-mswitch" role="group" aria-label="Machine">
          {(['mm808', 'voy'] as const).map((id) => (
            <button key={id} type="button" className="v4-mswitch-btn" aria-pressed={m === id} onClick={() => focusMachine(id)}>
              {id === 'mm808' ? 'MM-808' : 'VOYAGEUR'}
            </button>
          ))}
        </div>
        <button
          type="button"
          className="v4-medge"
          data-side={m === 'mm808' ? 'right' : 'left'}
          aria-label={m === 'mm808' ? 'Show the MM-VOYAGEUR synthesizer' : 'Show the MM-808 drum machine'}
          onClick={() => focusMachine(m === 'mm808' ? 'voy' : 'mm808')}
        >
          <Chevron dir={m === 'mm808' ? 'right' : 'left'} />
        </button>
      </>
    );
  }

  return (
    <>
      {(['mm808', 'voy'] as const).map((id) => (
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
      <button type="button" className="v4-both" data-visible={f !== 'all' && introState === 'done' ? '1' : '0'} onClick={() => focusMachine('all')}>
        <Chevron dir="left" />
        <span>BOTH MACHINES</span>
      </button>
    </>
  );
};

export default MachineNav;
