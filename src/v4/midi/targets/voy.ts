/** Les cibles MIDI du MM-ARP (le corps de coreTargets, deplace tel quel en P0). */

import { editToggle, openToggle, voyClear, voyDial, voyPad, voyRandom, voyRun } from '../../actions';
import { arp } from '../../voyager/arp';
import { voyInfos } from '../../state/voyInfos';
import { VOYAGER } from '../../state/focus';
import { CHORDS } from '../../voyager/chords';
import { SUB_WAVES, VOY_KNOBS, voyParams } from '../../voyager/params';
import type { MidiTarget } from './types';
import { stageNow as getStage } from './stage';
import { press } from './helpers';

export function voyTargets(out: MidiTarget[]): void {
  // MM-ARP
  if (VOYAGER) {
    // Les noms dits par sa section (2026-10-21, audit F11 : MODE, ATTACK, DECAY, SUSTAIN et RELEASE sortaient deux fois
    // dans la liste du MIDI LEARN et la reference) ; les ids ne changent pas, les mappings gardes restent
    const voyTargetLabel = (k: (typeof VOY_KNOBS)[number]): string =>
      k.section === 'tweak' ? `TWEAK ${k.label}` : k.id === 'mode' ? 'ARP MODE' : k.id === 'fmode' ? 'FILTER MODE' : k.section === 'feg' ? `FLT ${k.label}` : k.section === 'aeg' ? `AMP ${k.label}` : k.label;
    for (const k of VOY_KNOBS) {
      const n = k.steps && !k.morph ? k.steps.length : 0;
      out.push({
        id: `voy:knob:${k.id}`,
        scope: 'voy',
        label: voyTargetLabel(k),
        kind: 'value',
        steps: n,
        get: () => voyParams.of(k.id),
        set: (v) => voyDial(k.id, v),
      });
    }
    CHORDS.forEach((c, i) => out.push(press(`voy:pad:${i}`, 'voy', `CHORD ${c.label}`, () => voyPad(i, getStage()))));
    // SUB WAVE en touches (2026-10-10, le Roto) : une forme par touche
    SUB_WAVES.forEach((w, i) => out.push(press(`voy:subwave:${i}`, 'voy', `SUB WAVE ${w}`, () => voyDial('subWave', i / (SUB_WAVES.length - 1)))));
    out.push(press('voy:run', 'voy', 'RUN/STOP', () => void voyRun(getStage())));
    out.push({
      id: 'voy:running',
      scope: 'voy',
      label: 'RUN (ON / OFF)',
      kind: 'value',
      steps: 2,
      get: () => (arp.get().running ? 1 : 0),
      set: (v) => {
        if (v >= 0.5 !== arp.get().running) void voyRun(getStage());
      },
    });
    out.push(press('voy:clear', 'voy', 'CLEAR', () => voyClear(getStage())));
    out.push(press('voy:random', 'voy', 'RANDOM', () => voyRandom(getStage())));
    out.push(press('voy:edit', 'voy', 'EDIT', () => editToggle('voy', getStage())));
    out.push(press('voy:open', 'voy', 'OPEN', () => void openToggle(getStage(), 'voy')));
    // La touche i du grand ecran (2026-10-08) : INFOS, l'aide au survol
    out.push(press('voy:infos', 'voy', 'INFOS (HELP ON HOVER)', () => void voyInfos.toggle()));
  }
}
