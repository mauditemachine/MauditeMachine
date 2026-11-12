/**
 * Le MIXER de la face DT2, V.6.0 (lane B5, 2026-11-01, cahier dt2 3.7 et 1.3 ; inv-dt-sound.md 7) : FUNC + MOD. Trois
 * sous-pages, comme une page (les potards A a H, l'indicateur de droite ; UP / DOWN ou FUNC + MOD encore : la suivante) :
 * - INTERNAL MIXER 1-8 : A a H = TRK LEV des pistes 1 a 8 (k:<piste>, le meme reglage que LEVEL/DATA sur une page de piste) ;
 * - INTERNAL MIXER 9-16 : les pistes 9 a 16 ;
 * - SCENES (la place de l'EXTERNAL MIXER retire, la decision Q2 de Mika) : potard A presse = arme SCENE A, B presse = arme
 *   SCENE B (une tape d'aujourd'hui : gardee jusqu'au geste suivant) ; E et F = le nombre de cles de chaque scene ; H et
 *   LEVEL/DATA = le crossfader. Une scene armee, les potards des pages ecrivent dans elle (comme aujourd'hui).
 * LEVEL/DATA sur les pages INTERNAL : le TRK LEV de la piste active (le VOL du pattern arrive en V.6.1).
 */

import { TRACK_KEYS, TRACK_NAMES, TYPED_TRACKS } from '../../../audio/tracks';
import { pattern } from '../../../audio/pattern';
import { sceneCount, type SceneId } from '../../../rytm/sceneData';
import { anyDial, anyDialValue, dialRange, sceneDown, sceneUp, xfadeSet } from '../../../actions';
import { lcdMessage } from '../../../state/lcdMessage';
import { sceneCtl } from '../../../state/sceneCtl';
import type { PageSlot, SlotTarget } from '../../../rytm/pages';
import { registerDialSpec, registerScreenMenu, type ScreenMenu } from './registry';
import { IN_PLUGIN } from '../../../pluginMode';
import { acting } from './frame';
import { menuChanged, openMenuId, screenTrack } from './open';
import { perform } from '../../../state/perform';

export const MIXER_PAGES = ['INTERNAL 1-8', 'INTERNAL 9-16', 'SCENES'] as const;
let page = 0;

// Le plugin (2026-11-08) : le niveau de chaque piste est celui de LEVEL/DATA, le VOL (m:<piste>) que les scenes A et B gardent
// et que le crossfader mene ; au site, TRK LEV (k:<piste>)
const trkSlot = (i: number): PageSlot => ({ label: TRACK_NAMES[i], target: `${TYPED_TRACKS ? 'm' : 'k'}:${TRACK_KEYS[i]}` as SlotTarget, scope: 'all', draw: 'level' });
const EMPTY: PageSlot = { label: '', target: null, scope: 'all', draw: 'bar' };
const PAGE_SLOTS: readonly (readonly PageSlot[])[] = [
  Array.from({ length: 8 }, (_, i) => trkSlot(i)),
  Array.from({ length: 8 }, (_, i) => trkSlot(i + 8)),
  [
    { label: 'SCN A', target: 'z:sca', scope: 'all', draw: 'notch' },
    { label: 'SCN B', target: 'z:scb', scope: 'all', draw: 'notch' },
    EMPTY,
    EMPTY,
    { label: 'KEYS A', target: 'z:kya', scope: 'all', draw: 'bar' },
    { label: 'KEYS B', target: 'z:kyb', scope: 'all', draw: 'bar' },
    EMPTY,
    { label: 'XFADE', target: 'z:xf', scope: 'all', draw: 'barc' },
  ],
];

/**
 * PERFORM dans le plugin (2026-11-11, Mika : "a quoi sert le bouton PERFORM ? mets par defaut PERFORM, pour pouvoir faire des
 * choses en live") ; le 2026-11-12 (Mika : "j'aimerais qu'il serve vraiment pour le live... au moins un bouton mixer") :
 * trois sous-pages (UP / DOWN) : LIVE FX (le FILTER DJ, les effets de toute la machine, MASTER), MIXER 1-8 et MIXER 9-16 ; et
 * sur toutes, les 16 touches de pas sont des pads tenus (state/perform.ts : CUT, REPEAT, LOW CUT, DELAY, REVERB, TAPE). Une
 * scene armee (SCENE A ou B, ou LEFT / RIGHT ici) garde les effets : le crossfader les mene. LEVEL/DATA : le crossfader.
 */
const PERFORM_SLOTS: readonly PageSlot[] = [
  { label: 'FILTER', target: 'z:pfilt' as SlotTarget, scope: 'all', draw: 'barc' },
  { label: 'DIST', target: 'dist', scope: 'all', draw: 'bar' },
  { label: 'BIT', target: 'bits', scope: 'all', draw: 'bar' },
  { label: 'CHORUS', target: 'chorus', scope: 'all', draw: 'bar', noBd: true },
  { label: 'DELAY', target: 'delay', scope: 'all', draw: 'bar', noBd: true },
  { label: 'REVERB', target: 'reverb', scope: 'all', draw: 'bar', noBd: true },
  { label: 'COMP', target: 'comp', scope: 'all', draw: 'bar' },
  { label: 'MASTER', target: 'level', scope: 'all', draw: 'level' },
];
const LIVE_PERFORM = (id: string): boolean => IN_PLUGIN && id === 'perform';
/** Les sous-pages de PERFORM (le plugin) et celle affichee. */
export const PERFORM_PAGES = ['LIVE FX', 'MIXER 1-8', 'MIXER 9-16'] as const;
let perfPage = 0;
const perfSlots = (): readonly PageSlot[] => (perfPage === 0 ? PERFORM_SLOTS : PAGE_SLOTS[perfPage === 1 ? 0 : 1]);
export const performPageNow = (): number => perfPage;

/** Le FILTER (un filtre DJ sur tout le mix, le parametre FILTER) : ce qu'il ecrit, en Hz. */
const filterHz = (v: number): number => (v < 0 ? 20000 * Math.pow(80 / 20000, -v) : 20 * Math.pow(8000 / 20, v));
const hzText = (f: number): string => (f >= 1000 ? `${(f / 1000).toFixed(f >= 10000 ? 0 : 1)}K` : String(Math.round(f)));
registerDialSpec('z:pfilt', {
  value: () => perform.filter(),
  set: (v) => perform.setFilter(v),
  range: () => [-1, 1],
  steps: () => 0,
  text: (v) => (Math.abs(v) < 0.02 ? 'OFF' : `${v < 0 ? 'LP' : 'HP'} ${hzText(filterHz(v))}`),
  unit: (v) => (Math.abs(v) < 0.02 ? 'OPEN' : v < 0 ? 'LOW PASS' : 'HIGH PASS'),
  reset: () => 0,
});
// Le FILTER mene par Ableton : les potards et l'ecran de PERFORM le suivent
perform.subscribe(() => {
  if (openMenuId() === 'perform') menuChanged();
});

/** Une scene armee ou desarmee par une tape (le potard presse, YES) : comme SCENE A ou B tapee aujourd'hui. */
function tapScene(w: SceneId): void {
  const t = performance.now();
  sceneDown(w, 'screen', t);
  sceneUp(w, 'screen', t + 1);
  menuChanged();
}
const armed = (w: SceneId): boolean => sceneCtl.get().armed === w;
const keysOf = (w: SceneId): number => sceneCount(pattern.scenes.get(), w);

for (const w of ['a', 'b'] as const) {
  registerDialSpec(`z:sc${w}`, {
    value: () => (armed(w) ? 1 : 0),
    set(v) {
      if (v >= 0.5 !== armed(w)) tapScene(w);
    },
    range: () => [0, 1],
    steps: () => 2,
    text: (v) => (v >= 0.5 ? 'ARMED' : 'OFF'),
    unit: () => `PRESS ${w.toUpperCase()}`,
  });
  registerDialSpec(`z:ky${w}`, {
    value: () => keysOf(w),
    set() {
      lcdMessage.show(`SCENE ${w.toUpperCase()}: ${keysOf(w)} KEYS (ARM IT, TURN A KNOB)`, 1400);
    },
    range: () => [0, 64],
    steps: () => 0,
    text: (v) => String(Math.round(v)),
    unit: (v) => (v === 1 ? 'KEY' : 'KEYS'),
  });
}
registerDialSpec('z:xf', {
  value: () => sceneCtl.x(),
  set: (v) => xfadeSet(v, 'ui'),
  range: () => [0, 1],
  steps: () => 0,
  text: (v) => `${Math.round(v * 100)}`,
  unit: (v) => (v <= 0.001 ? 'A' : v >= 0.999 ? 'B' : `A ${Math.round((1 - v) * 100)} B ${Math.round(v * 100)}`),
});

/** La sous-page suivante (UP / DOWN, FUNC + MOD encore : B4 l'appelle par actions mixerNextPage). */
export function mixerPage(dir: 1 | -1): void {
  page = (page + dir + MIXER_PAGES.length) % MIXER_PAGES.length;
  lcdMessage.show(`MIXER ${page + 1}/${MIXER_PAGES.length}  ${MIXER_PAGES[page]}`, 1200);
  menuChanged();
}
export const mixerPageNow = (): number => page;

/** LEVEL/DATA sur le MIXER : le TRK LEV de la piste active (INTERNAL), le crossfader (SCENES). */
function data(delta: number, func: boolean): void {
  const n = delta * (func ? 8 : 1);
  if (page === 2) {
    xfadeSet(Math.max(0, Math.min(1, sceneCtl.x() + n / 127)), 'ui');
    return;
  }
  const t = screenTrack();
  if (!t) {
    lcdMessage.show('PICK A TRACK: TRK + TRIG', 1200);
    return;
  }
  const id = `k:${t}` as const;
  const [lo, hi] = dialRange(id);
  anyDial(id, Math.max(lo, Math.min(hi, anyDialValue(id) + n / 127)));
}

function menu(id: 'mixer' | 'scenes' | 'perform'): ScreenMenu {
  return {
    id,
    owner: 'B5',
    title: () => (LIVE_PERFORM(id) ? `PERFORM · ${PERFORM_PAGES[perfPage]}` : id === 'perform' ? 'PERFORM · SCENES A / B' : `MIXER  ${MIXER_PAGES[page]}`),
    slots: () => (LIVE_PERFORM(id) ? perfSlots() : PAGE_SLOTS[page]),
    pages: () => (LIVE_PERFORM(id) ? { n: PERFORM_PAGES.length, cur: perfPage } : { n: MIXER_PAGES.length, cur: page }),
    paint: () => 0,
    onOpen() {
      if (id === 'scenes' || id === 'perform') page = 2;
      else if (page === 2) page = 0;
      // Le plugin : les touches de pas deviennent les pads de PERFORM ; l'ecran le dit
      if (LIVE_PERFORM(id)) lcdMessage.show('TRIGS = PADS: HOLD THEM', 1800);
    },
    onClose() {
      // PERFORM se ferme : aucun pad ne reste tenu ni garde
      if (LIVE_PERFORM(id)) perform.releaseAll();
    },
    knobPress(k) {
      if (LIVE_PERFORM(id)) return false;
      if (page !== 2 || (k !== 0 && k !== 1)) return false;
      tapScene(k === 0 ? 'a' : 'b');
      return true;
    },
    info: () => `${page + 1}/${MIXER_PAGES.length} ${MIXER_PAGES[page]}|A ${armed('a') ? 'ARMED' : 'off'} ${keysOf('a')}|B ${armed('b') ? 'ARMED' : 'off'} ${keysOf('b')}|X ${sceneCtl.x().toFixed(2)}`,
    onInput(i) {
      if (!acting(i)) return true;
      // PERFORM du plugin : UP / DOWN les sous-pages ; LEVEL/DATA le crossfader, LEFT / RIGHT arment SCENE A / B
      if (LIVE_PERFORM(id)) {
        if (i.kind === 'up' || i.kind === 'down') {
          perfPage = (perfPage + (i.kind === 'up' ? -1 : 1) + PERFORM_PAGES.length) % PERFORM_PAGES.length;
          lcdMessage.show(`PERFORM ${perfPage + 1}/${PERFORM_PAGES.length}  ${PERFORM_PAGES[perfPage]}`, 1200);
          menuChanged();
        } else if (i.kind === 'data') xfadeSet(Math.max(0, Math.min(1, sceneCtl.x() + ((i.delta ?? 0) * (i.func ? 8 : 1)) / 127)), 'ui');
        else if (i.kind === 'left' || i.kind === 'right') tapScene(i.kind === 'left' ? 'a' : 'b');
        else return i.kind !== 'no';
        return true;
      }
      if (i.kind === 'up' || i.kind === 'down') mixerPage(i.kind === 'up' ? -1 : 1);
      else if (i.kind === 'data') data(i.delta ?? 0, i.func);
      else if (page === 2 && (i.kind === 'left' || i.kind === 'right')) tapScene(i.kind === 'left' ? 'a' : 'b');
      else return i.kind !== 'no';
      return true;
    },
  };
}

registerScreenMenu(menu('mixer'));
registerScreenMenu(menu('scenes'));
registerScreenMenu(menu('perform'));
