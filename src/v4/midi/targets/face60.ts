/**
 * Cibles MIDI de V.6.0, lane B6 : la face Digitakt II (midi/targets/reserved.ts face60, cahier dt2 2.6, 3.12 et critique
 * C3.10). Le fichier reserve de P0 (2026-10-30, cahier dt2 5.5) : la lane n'ajoute qu'ici, a la suite, dans l'ordre ou
 * ses cibles sortent du CSV (npm run docs:midi : des lignes ajoutees seulement, a la fin du bloc mm808). L'ordre des
 * fichiers est fige dans midi/targets/index.ts (GROUPS).
 *
 * Les quatorze ids reserves, dans l'ordre de reserved.ts : rytm:data (LEVEL/DATA, kind relative), rytm:keyboard,
 * rytm:song, rytm:preset, rytm:settings, rytm:sounds, rytm:tap, rytm:up, rytm:down, rytm:left, rytm:right, rytm:ptnpage,
 * rytm:tempo:bpm (30 a 300 au 1/10), rytm:tempo:swing (50 a 80 %). Ils existent tout le temps (des ajouts). Chacun appelle
 * l'action la plus proche qui existe aujourd'hui ; les touches de B4 (fleches, PAGE, SETTINGS, LEVEL/DATA dans les menus)
 * et les menus de B5 les remplaceront a l'integration (une ligne par cible, ACTION60 plus bas). Une touche inerte en V.6.0
 * (KEYBOARD, SONG ; SETTINGS tant que son menu n'est pas la) porte SOON dans son libelle (C3.10), retire a l'activation
 * (le libelle peut changer, jamais l'id). Sur la face V.5.3 (DT2_FACE faux) : aucune touche ne s'anime (elles n'y sont
 * pas), les actions sont celles du site d'aujourd'hui (la liste des presets, des sons, TAP, FILL).
 *
 * Avec le drapeau (?face=dt2, theme/base.ts DT2_FACE) et seulement avec lui : rytm:enc:level s'appelle MAIN VOLUME (2.6,
 * l'id ne change pas) et rytm:fill anime la touche PAGE au lieu de YES (2.6) ; le CSV (sans drapeau) n'en voit rien.
 */

import { anyDial, fillHold, gesture, presetKey, presetTurn, soundBrowserClose, soundBrowserOpen, soundBrowserStep } from '../../actions';
import { tapTempo } from '../../actions/internal/transport';
import { BPM, pattern } from '../../audio/pattern';
import { TRACK_NAMES, trackIndex, tracks } from '../../audio/tracks';
import { DT2_ZONES } from '../../rytm/dtFaceIds';
import { lcdMessage } from '../../state/lcdMessage';
import { lcdSamples } from '../../state/lcdSamples';
import { presetMode } from '../../state/presetMode';
import { DT2_FACE } from '../../theme';
import { TEMPO_RANGE_DT2 } from './reserved';
import type { MidiTarget } from './types';
import { stageNow as getStage } from './stage';
import { faceHold, press } from './helpers';

/** L'appui d'une touche nouvelle s'anime sur la face DT2 seulement (sur la V.5.3 elle n'existe pas). */
const flash = (zone: string): void => {
  if (DT2_FACE) getStage()?.flashFaceKey(zone);
};

/** Une touche inerte en V.6.0 : l'ecran le dit (BIENTOT, cahier 5.1), rien d'autre. */
const soon = (word: string, zone: string, ver: string): void => {
  flash(zone);
  lcdMessage.show(`${word}: SOON (${ver})`, 1800);
};

/** TRK LEV : 0 a 127, un cran = 1/127 (cahier 4.1 : 0.8 = 0 dB, le depart). */
const TLEV_CRANS = 127;

/**
 * LEVEL/DATA tourne de d crans (rytm:data ; le boitier MMHW v2 : CC 38, le pont appelle turn) : une liste ouverte defile
 * (les presets du MM-RYTM, la liste des sons), sinon TRK LEV de la piste choisie (cahier 3.1 : "potard : TRK LEV ; dans un
 * menu : defiler"). A l'integration, l'action de B4 (LEVEL/DATA sur la face, les menus de B5 par onInput 'data') prend
 * sa place.
 */
function dataTurn(d: number): void {
  if (!Number.isFinite(d) || d === 0) return;
  const n = Math.max(-16, Math.min(16, Math.round(d)));
  if (n === 0) return;
  if (presetMode.on('mm808')) {
    if (!presetTurn(0, n)) presetMode.turn('mm808', 0, n);
    return;
  }
  if (lcdSamples.isOpen()) {
    for (let i = 0; i < Math.abs(n); i += 1) soundBrowserStep(n < 0 ? -1 : 1);
    return;
  }
  const k = pattern.get().instrument;
  if (!k) {
    lcdMessage.show('LEVEL: PICK A TRACK FIRST');
    return;
  }
  gesture();
  const now = tracks.param(k, 'tlev');
  const next = Math.max(0, Math.min(1, Math.round(now * TLEV_CRANS + n) / TLEV_CRANS));
  tracks.set(k, 'tlev', next);
  lcdMessage.show(`${TRACK_NAMES[trackIndex(k)] ?? k} TRK LEV ${Math.round(tracks.param(k, 'tlev') * TLEV_CRANS)}`, 1200, true);
}

/** Une fleche (rytm:up...) : dans la liste des presets ou des sons, comme les fleches du clavier ; ailleurs, B4 (SOON). */
function arrowKey(dir: 'up' | 'down' | 'left' | 'right'): void {
  flash(dir);
  if (presetMode.on('mm808')) {
    presetKey('mm808', dir === 'up' || dir === 'left' ? 'prev' : 'next');
    return;
  }
  if (lcdSamples.isOpen() && (dir === 'up' || dir === 'down')) {
    soundBrowserStep(dir === 'up' ? -1 : 1);
    return;
  }
  lcdMessage.show(`${dir.toUpperCase()}: IN A LIST (MORE SOON)`, 1400);
}

/** TEMPO 30 a 300 BPM au 1/10 (1.3, reserved.ts TEMPO_RANGE_DT2) ; le moteur borne aujourd'hui a BPM (100 a 150). */
const [BPM_LO, BPM_HI] = TEMPO_RANGE_DT2.bpm;
const BPM_STEPS = (BPM_HI - BPM_LO) * 10 + 1;
/** SWING 50 a 80 % (1.3) : fx.swing garde sa loi (0 = 50 %, 1 = 66,7 %), 80 % = 1.8 ; le moteur borne aujourd'hui a 1. */
const [SW_LO, SW_HI] = TEMPO_RANGE_DT2.swing;
const SWING_PER_PCT = 3 / 50;
const SWING_STEPS = SW_HI - SW_LO + 1;

/**
 * Les actions de chaque cible (a remplacer a l'integration de B4 et B5, une ligne chacune) ; ce que chacune fait
 * aujourd'hui est dans son libelle.
 */
const ACTION60 = {
  data: dataTurn,
  preset: (): void => {
    flash('preset');
    presetKey('mm808', presetMode.on('mm808') ? 'close' : 'open');
  },
  sounds: (): void => {
    flash('sounds');
    if (lcdSamples.isOpen()) soundBrowserClose();
    else soundBrowserOpen();
  },
  tap: (): void => {
    flash('tempo');
    gesture();
    tapTempo();
  },
  ptnDown: (): void => {
    fillHold(true);
    if (DT2_FACE) getStage()?.pressFaceKey('ptnpage');
  },
  ptnUp: (): void => fillHold(false),
};

export function face60Targets(out: MidiTarget[]): void {
  // La face DT2 seulement (2.6) : les libelles et les touches animees qui changent, sans changer un id ni une place
  if (DT2_FACE) {
    const level = out.find((t) => t.id === 'rytm:enc:level');
    if (level) level.label = 'MAIN VOLUME';
    const fill = out.find((t) => t.id === 'rytm:fill');
    if (fill) fill.down = ACTION60.ptnDown;
  }
  out.push({ id: 'rytm:data', scope: 'mm808', label: 'LEVEL/DATA (RELATIVE: THE OPEN LIST, ELSE TRK LEV OF THE TRACK)', kind: 'relative', turn: ACTION60.data });
  out.push(press('rytm:keyboard', 'mm808', 'KEYBOARD (SOON)', () => soon('KEYBOARD', 'kbd', 'V.6.1')));
  out.push(press('rytm:song', 'mm808', 'SONG (SOON)', () => soon('SONG', 'song', 'V.6.2')));
  out.push(press('rytm:preset', 'mm808', 'PRESET/KIT (THE KIT LIST, AGAIN: CLOSE)', ACTION60.preset));
  out.push(press('rytm:settings', 'mm808', 'SETTINGS (SOON)', () => soon('SETTINGS', 'settings', 'V.6.0')));
  out.push(press('rytm:sounds', 'mm808', 'SOUNDS (THE SOUND LIST OF THE TRACK, AGAIN: CLOSE)', ACTION60.sounds));
  out.push(press('rytm:tap', 'mm808', 'TAP TEMPO', ACTION60.tap));
  out.push(press('rytm:up', 'mm808', 'UP (IN A LIST)', () => arrowKey('up')));
  out.push(press('rytm:down', 'mm808', 'DOWN (IN A LIST)', () => arrowKey('down')));
  out.push(press('rytm:left', 'mm808', 'LEFT (IN A LIST)', () => arrowKey('left')));
  out.push(press('rytm:right', 'mm808', 'RIGHT (IN A LIST)', () => arrowKey('right')));
  out.push(faceHold('rytm:ptnpage', 'PAGE (HOLD: FILL)', DT2_FACE ? 'ptnpage' : '', () => fillHold(true), ACTION60.ptnUp));
  out.push({
    id: 'rytm:tempo:bpm',
    scope: 'mm808',
    label: 'TEMPO 30-300 BPM (FINE 1/10)',
    kind: 'value',
    steps: BPM_STEPS,
    get: () => Math.max(0, Math.min(1, (pattern.get().bpm - BPM_LO) / (BPM_HI - BPM_LO))),
    set: (v) => {
      const bpm = Math.round((BPM_LO + Math.max(0, Math.min(1, v)) * (BPM_HI - BPM_LO)) * 10) / 10;
      // Le moteur borne a BPM (100 a 150, entier) tant que B1 et B5 n'ont pas ouvert 30-300 : le tempo y reste
      anyDial('tempo', Math.max(BPM.min, Math.min(BPM.max, Math.round(bpm))));
    },
  });
  out.push({
    id: 'rytm:tempo:swing',
    scope: 'mm808',
    label: 'SWING 50-80 %',
    kind: 'value',
    steps: SWING_STEPS,
    get: () => Math.max(0, Math.min(1, (pattern.fx.get().swing / SWING_PER_PCT) / (SW_HI - SW_LO))),
    set: (v) => {
      const pct = Math.round(SW_LO + Math.max(0, Math.min(1, v)) * (SW_HI - SW_LO));
      anyDial('swing', (pct - SW_LO) * SWING_PER_PCT);
    },
  });
}

/**
 * MIDI LEARN d'une zone nouvelle de la face DT2 (midi/targets/index.ts targetIdOfHotspot, ses kinds Dt2ZoneKind) : sa
 * premiere cible du contrat P0 (rytm/dtFaceIds.ts DT2_ZONES) ; MAIN VOLUME (kind encoder, param level) passe deja par
 * rytm:enc:level. null : une autre zone.
 */
export function face60TargetOfHotspot(h: { id?: string; kind: string }): string | null {
  if (!h.id || h.kind === 'encoder') return null;
  const z = DT2_ZONES.find((x) => x.id === h.id && x.kind === h.kind);
  return z ? z.midi[0] : null;
}
