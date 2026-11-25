/**
 * v52 (2026-11-24, Mika : "pourquoi on a pas toutes les notes ?", choix 2A) : la tonalite du plugin. Elle vit dans deux
 * reglages de l'hote, en fin de liste (plugin/mm-arp/extra-params.json) : xKey (12 crans, C a B, depart F#) et xScale
 * (MINOR, MAJOR, DORIAN, PHRYGIAN, depart MINOR). Ce module les suit (le selecteur KeySelect.tsx, l'automation et le
 * projet par mm_knobs) et rebat la banque des pads (voyager/chords.ts arpKey : les accords, la tonique, la gamme) : la
 * serigraphie, l'ecran, la page SEQ et la page SQ suivent ; le C++ fait les memes notes avec les memes reglages
 * (dsp/Params.cpp keyOf).
 *
 * Des reglages de l'instance (le morceau), comme LATENCY : aucun preset ne les porte ni ne les change (bridge.ts
 * applyExtra et factoryLoad, presets/build.mjs, RANDOM ne touche que les effets) ; un projet d'avant s'ouvre en F# MINOR
 * (PluginProcessor.cpp : un reglage absent du projet reprend son depart).
 *
 * Importe tot (ArpFace.tsx) : il s'abonne aux reglages avant les vues, la banque est a jour quand elles redessinent.
 */

import { arpKey, KEY_NAMES, MODE_NAMES } from '../../voyager/chords';
import { arpExtra, extraStepCount, extraStepIndex } from './extra';

/** Les crans de xKey, xScale dans le moment. */
export const keyOfExtra = (): { key: number; mode: number } => ({
  key: extraStepIndex('xKey', arpExtra.of('xKey')),
  mode: extraStepIndex('xScale', arpExtra.of('xScale')),
});

function sync(): void {
  const { key, mode } = keyOfExtra();
  arpKey.set(key, mode);
}

sync();
arpExtra.subscribe(sync);

/** Une tonalite choisie a la face : les deux reglages (mm_param vers le C++ : bridge.ts, comme un potard). */
export function chooseKey(key: number, mode: number): void {
  const nk = Math.max(2, extraStepCount('xKey'));
  const nm = Math.max(2, extraStepCount('xScale'));
  arpExtra.set('xKey', Math.max(0, Math.min(nk - 1, key)) / (nk - 1));
  arpExtra.set('xScale', Math.max(0, Math.min(nm - 1, mode)) / (nm - 1));
}

/** Le nom de la tonalite : "F# MINOR". */
export const keyText = (key: number, mode: number): string => `${KEY_NAMES[key] ?? ''} ${MODE_NAMES[mode] ?? ''}`.trim();
