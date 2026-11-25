/**
 * La touche PRESET du MM-ARP (le plugin MM-ARP seul, v53). Au site, PRESET ouvre les presets sur le grand ecran
 * (state/presetMode.ts, actions/presets.ts presetKey) : rien ne change, le crochet est vide. Le plugin inscrit ici le sien
 * (plugin/arp/presetPanel.ts) : PRESET, l'ecran touche au repos ou sa touche jumelle ouvrent le navigateur de presets de
 * la banque du VST3 (plugin/arp/PresetBrowser.tsx) au lieu de la liste du site, que le plugin ne montre plus.
 * Sans dependance, comme faceDbl.ts.
 */

import type { PresetKey } from '../state/presetMode';

let hook: ((k: PresetKey) => boolean) | null = null;

export const voyPresetHook = {
  /** Le crochet du plugin ; null le retire. */
  set(fn: ((k: PresetKey) => boolean) | null): void {
    hook = fn;
  },
  /** Une touche des presets du MM-ARP : true si le plugin l'a prise (le mode presets du site ne s'ouvre pas). */
  key(k: PresetKey): boolean {
    return hook ? hook(k) : false;
  },
};
