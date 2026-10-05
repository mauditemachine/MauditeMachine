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
 *   un glisser horizontal y passe aussi. 2026-10-05 (Mika : "on devrait
 *   toujours voir des fleches en mobile, gauche droite" ; "une fois sur
 *   deux, pour voir le deck B, on accroche un bouton") : deux fleches,
 *   toujours ; sur le MM-DECKS elles passent d'abord d'un bloc a l'autre
 *   (DECK A, MIXER, DECK B...), puis a la machine voisine.
 * - desktop, vue tournee (2026-10-04, Mika : "meme quand on bouge en 3D une
 *   machine, on devrait pouvoir aller sur les autres a gauche ou a droite") :
 *   les voisines ne depassent plus du bord (elles passeraient devant) ; une
 *   fleche a chaque bord les remplace : la vue revient de face et la
 *   voisine arrive.
 * Les noms suivent leur machine a chaque frame rendue (boite projetee de
 * ses volumes, scene/hit.ts machineBox), sans rendu React.
 */

import React, { useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { focusMachine } from '../actions';
import type { Stage } from '../scene/renderer';
import { djView } from '../dj/view';
import { DJ_VIEW_UNITS, type DjUnit } from '../dj/theme';
import { MACHINES, focus, type MachineId } from '../state/focus';
import { intro } from '../state/intro';
import { view } from '../state/view';
import { MachineDrawer } from './MachineDrawer';

const NAMES: Record<MachineId, { title: string; sub: string; aria: string }> = {
  mm808: { title: 'MM-RYTM', sub: 'DRUM MACHINE', aria: 'Play the MM-RYTM drum machine' },
  voy: { title: 'MM-ARP', sub: 'SYNTHESIZER', aria: 'Play the MM-ARP synthesizer' },
  dj: { title: 'MM-DECKS', sub: 'DJ DECKS AND MIXER', aria: 'Play the MM-DECKS DJ decks and mixer' },
  smpl: { title: 'MM-SMPL', sub: 'SAMPLER AND GRANULAR', aria: 'Play the MM-SMPL sampler, slicer and granular machine' },
};

/** Le nom d'un bloc du MM-DECKS (les fleches le disent). */
const unitName = (u: DjUnit): string => (u === 'a' || u === 'b' || u === 'c' || u === 'd' ? `deck ${u.toUpperCase()}` : u === 'add' ? 'add deck' : 'mixer');

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
  const moved = useSyncExternalStore(view.subscribe, view.get, view.get);
  const unit = useSyncExternalStore(djView.subscribe, djView.get, djView.get);
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
    const n = MACHINES.length;
    // Deux fleches : la machine d'avant, la suivante (en boucle) ; le MM-DECKS passe d'abord ses blocs
    const prevM = MACHINES[(i - 1 + n) % n];
    const nextM = MACHINES[(i + 1) % n];
    const inDj = m === 'dj' && DJ_VIEW_UNITS.length > 1;
    const prevU = inDj ? djView.next(-1) : null;
    const nextU = inDj ? djView.next(1) : null;
    void unit;
    const go = (dir: 1 | -1): void => {
      const u = dir > 0 ? nextU : prevU;
      if (u) djView.set(u);
      else {
        // Le MM-DECKS qu'on rejoint : par son bloc le plus proche (DECK A en venant de la gauche)
        const to = dir > 0 ? nextM : prevM;
        if (to === 'dj') djView.set(dir > 0 ? DJ_VIEW_UNITS[0] : DJ_VIEW_UNITS[DJ_VIEW_UNITS.length - 1]);
        focusMachine(to);
      }
    };
    const label = (dir: 1 | -1): string => {
      const u = dir > 0 ? nextU : prevU;
      if (u) return `Show the ${unitName(u)}`;
      const to = dir > 0 ? nextM : prevM;
      return `Show the ${NAMES[to].title} ${NAMES[to].sub.toLowerCase()}`;
    };
    return (
      <>
        <div className="v4-mswitch" role="group" aria-label="Machine">
          {MACHINES.map((id) => (
            <button key={id} type="button" className="v4-mswitch-btn" aria-pressed={m === id} onClick={() => focusMachine(id)}>
              {NAMES[id].title}
            </button>
          ))}
        </div>
        <button type="button" className="v4-medge" data-side="left" aria-label={label(-1)} onClick={() => go(-1)}>
          <Chevron dir="left" />
        </button>
        <button type="button" className="v4-medge" data-side="right" aria-label={label(1)} onClick={() => go(1)}>
          <Chevron dir="right" />
        </button>
      </>
    );
  }

  // Desktop, vue tournee : une fleche vers chaque voisine
  const cur = f === 'all' ? -1 : MACHINES.indexOf(f);
  const edges = cur >= 0 && settled && introState === 'done' && moved;
  const prev = edges && cur > 0 ? MACHINES[cur - 1] : null;
  const next = edges && cur < MACHINES.length - 1 ? MACHINES[cur + 1] : null;
  const go = (id: MachineId): void => {
    stage?.orbit.reset();
    focusMachine(id);
  };

  return (
    <>
      {prev && (
        <button type="button" className="v4-medge" data-side="left" data-desk="1" aria-label={`Show the ${NAMES[prev].title} ${NAMES[prev].sub.toLowerCase()}`} onClick={() => go(prev)}>
          <Chevron dir="left" />
        </button>
      )}
      {next && (
        <button type="button" className="v4-medge" data-side="right" data-desk="1" aria-label={`Show the ${NAMES[next].title} ${NAMES[next].sub.toLowerCase()}`} onClick={() => go(next)}>
          <Chevron dir="right" />
        </button>
      )}
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
