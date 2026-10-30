/** Les cibles MIDI de partout : la navigation, PLAY/STOP des deux machines (le corps de coreTargets, deplace tel quel en P0). */

import { focusMachine, machinesToggle, stepMachine } from '../../actions';
import { MACHINES } from '../../state/focus';
import type { MidiTarget } from './types';
import { press } from './helpers';
import { MACHINE_NAME } from './index';

export function navTargets(out: MidiTarget[]): void {
  // Partout : la navigation, PLAY/STOP des deux machines
  out.push(press('nav:all', 'global', 'MM-STUDIO (ALL THE MACHINES)', () => focusMachine('all')));
  for (const m of MACHINES) out.push(press(`nav:${m}`, 'global', `GO TO ${MACHINE_NAME[m]}`, () => focusMachine(m)));
  out.push(press('nav:prev', 'global', 'PREVIOUS MACHINE', () => void stepMachine(-1)));
  out.push(press('nav:next', 'global', 'NEXT MACHINE', () => void stepMachine(1)));
  out.push(press('nav:machines', 'global', 'PLAY/STOP MACHINES', () => void machinesToggle()));
}
