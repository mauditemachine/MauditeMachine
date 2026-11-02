/**
 * Cibles MIDI de V.6.0, lane B6 : la face Digitakt II (midi/targets/reserved.ts face60, cahier dt2 2.6, 3.12 et critique
 * C3.10). Le fichier reserve de P0 (2026-10-30, cahier dt2 5.5) : la lane n'ajoute qu'ici, a la suite, dans l'ordre ou
 * ses cibles sortent du CSV (npm run docs:midi : des lignes ajoutees seulement, a la fin du bloc mm808). L'ordre des
 * fichiers est fige dans midi/targets/index.ts (GROUPS).
 *
 * Les quatorze ids reserves, dans l'ordre de reserved.ts : rytm:data (LEVEL/DATA, kind relative), rytm:keyboard,
 * rytm:song, rytm:preset, rytm:settings, rytm:sounds, rytm:tap, rytm:up, rytm:down, rytm:left, rytm:right, rytm:ptnpage,
 * rytm:tempo:bpm (30 a 300 au 1/10), rytm:tempo:swing (50 a 80 %). Ils existent tout le temps (des ajouts). Une touche
 * inerte en V.6.0 (KEYBOARD, SONG) porte SOON dans son libelle (C3.10), retire a l'activation (le libelle peut changer,
 * jamais l'id).
 *
 * L'integration de la V.6.0 (2026-11-01) : sur la face DT2 (theme/base.ts DT2_FACE, la face par defaut au desktop), chaque
 * cible passe par la saisie de la lane B4 (actions/face.ts faceKeyDown, faceKeyUp, faceKeyTap(id, 'midi'), dataTurn),
 * comme la touche de la face : la table des accords, les menus de B5, FUNC. Sur la face V.5.3 (?face=v5, DT2_FACE faux) :
 * l'action la plus proche du site d'avant (la liste des presets, des sons, TAP, FILL), comme la lane B6 l'avait posee.
 * Avec la face DT2 seulement : rytm:enc:level s'appelle MAIN VOLUME (2.6, l'id ne change pas) et rytm:fill anime la touche
 * PAGE au lieu de YES (2.6).
 */

import { dataTurn as faceDataTurn, faceKeyDown, faceKeyTap, faceKeyUp, fillHold, gesture, presetKey, presetTurn, soundBrowserClose, soundBrowserOpen, soundBrowserStep } from '../../actions';
import type { Dt2ButtonId } from '../../rytm/dtFaceIds';
import { tapTempo } from '../../actions/internal/transport';
import { BPM_RANGE, clampSwing, pattern } from '../../audio/pattern';
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

/** Les crans d'un message relatif, bornes (un codage mal devine ne fait pas un saut de toute la course). */
const crans = (d: number): number => (Number.isFinite(d) ? Math.max(-16, Math.min(16, Math.round(d))) : 0);

/**
 * LEVEL/DATA tourne de d crans (rytm:data ; le boitier MMHW v2 : CC 38, le pont appelle turn). La face DT2 : la saisie de
 * B4 (dataTurn : le menu ouvert le prend, sinon le TRK LEV de la piste active, levelDataTurn de B5). La face V.5.3 : une
 * liste ouverte defile (les presets du MM-RYTM, la liste des sons), sinon TRK LEV de la voix choisie.
 */
function dataTurn(d: number): void {
  const n = crans(d);
  if (n === 0) return;
  if (DT2_FACE) {
    faceDataTurn(n, 'midi', getStage());
    return;
  }
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

/** Une touche de la face DT2 tapee au MIDI (un appui et un lacher d'un coup), par la saisie de B4. */
const tap60 = (id: Dt2ButtonId): void => faceKeyTap(id, getStage(), 'midi');

/**
 * Une fleche (rytm:up...) : la face DT2, la fleche de la face (le menu ouvert, PTN + LEFT / RIGHT la banque, un TRIG tenu +
 * LEFT / RIGHT le uTIME, UP / DOWN la sous-page) ; la face V.5.3, la liste des presets ou des sons.
 */
function arrowKey(dir: 'up' | 'down' | 'left' | 'right'): void {
  if (DT2_FACE) {
    tap60(dir);
    return;
  }
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

/** TEMPO 30 a 300 BPM au 1/10 (1.3, reserved.ts TEMPO_RANGE_DT2) ; le moteur y va depuis V.5.9 (audio/pattern.ts BPM_RANGE). */
const [BPM_LO, BPM_HI] = TEMPO_RANGE_DT2.bpm;
const BPM_STEPS = (BPM_HI - BPM_LO) * 10 + 1;
/** SWING 50 a 80 % (1.3) : fx.swing garde sa loi (0 = 50 %, 1 = 66,7 %), 80 % = 1.8 (audio/pattern.ts SWING_MAX). */
const [SW_LO, SW_HI] = TEMPO_RANGE_DT2.swing;
const SWING_PER_PCT = 3 / 50;
const SWING_STEPS = SW_HI - SW_LO + 1;

/**
 * Les actions de chaque cible : la face DT2 par la saisie de B4 (la touche de la face), la face V.5.3 par l'action la plus
 * proche d'avant ; ce que chacune fait est dans son libelle (LABEL60).
 */
const ACTION60 = {
  data: dataTurn,
  preset: (): void => {
    if (DT2_FACE) {
      tap60('preset');
      return;
    }
    flash('preset');
    presetKey('mm808', presetMode.on('mm808') ? 'close' : 'open');
  },
  settings: (): void => {
    if (DT2_FACE) tap60('settings');
    else soon('SETTINGS', 'settings', 'V.6.0');
  },
  sounds: (): void => {
    if (DT2_FACE) {
      tap60('sounds');
      return;
    }
    flash('sounds');
    if (lcdSamples.isOpen()) soundBrowserClose();
    else soundBrowserOpen();
  },
  keyboard: (): void => {
    if (DT2_FACE) tap60('kbd');
    else soon('KEYBOARD', 'kbd', 'V.6.1');
  },
  // FUNC + TEMPO sur la face (l'eclair blanc a chaque tape) : le TAP, sans engager FUNC
  tap: (): void => {
    flash('tempo');
    gesture();
    tapTempo();
  },
  // rytm:fill (la face DT2) : FILL tenu, la touche PAGE s'anime
  fillDown: (): void => {
    fillHold(true);
    if (DT2_FACE) getStage()?.pressFaceKey('ptnpage');
  },
  // rytm:ptnpage : la touche PAGE elle-meme (la face DT2 : tenue = FILL, YES puis PAGE = un cycle, PAGE puis YES = verrou)
  ptnDown: (): void => {
    if (DT2_FACE) faceKeyDown('ptnpage', 'midi', getStage());
    else fillHold(true);
  },
  ptnUp: (): void => {
    if (DT2_FACE) faceKeyUp('ptnpage', 'midi', getStage());
    else fillHold(false);
  },
};

/** Les libelles (la face DT2 dans le CSV : docs:midi lit le site a sa face par defaut ; la face V.5.3 garde les siens). */
const LABEL60 = DT2_FACE
  ? {
      data: 'LEVEL/DATA (RELATIVE: THE OPEN MENU, ELSE TRK LEV OF THE ACTIVE TRACK)',
      preset: 'PRESET/KIT (THE PRESET/KIT MENU, AGAIN: CLOSE)',
      settings: 'SETTINGS (THE MENU, AGAIN: CLOSE)',
      sounds: 'SOUNDS (THE SOUND LIST OF THE ACTIVE TRACK, AGAIN: CLOSE)',
      arrow: (d: string): string => `${d} (THE MENU, ELSE ${d === 'UP' || d === 'DOWN' ? 'THE SUB PAGE' : 'PTN: THE BANK, TRIG HELD: MICRO TIMING'})`,
      ptnpage: 'PAGE (HOLD: FILL; YES THEN PAGE: ONE CYCLE; PAGE THEN YES: LATCH)',
    }
  : {
      data: 'LEVEL/DATA (RELATIVE: THE OPEN LIST, ELSE TRK LEV OF THE TRACK)',
      preset: 'PRESET/KIT (THE KIT LIST, AGAIN: CLOSE)',
      settings: 'SETTINGS (SOON)',
      sounds: 'SOUNDS (THE SOUND LIST OF THE TRACK, AGAIN: CLOSE)',
      arrow: (d: string): string => `${d} (IN A LIST)`,
      ptnpage: 'PAGE (HOLD: FILL)',
    };

export function face60Targets(out: MidiTarget[]): void {
  // La face DT2 seulement (2.6) : les libelles et les touches animees qui changent, sans changer un id ni une place
  if (DT2_FACE) {
    const level = out.find((t) => t.id === 'rytm:enc:level');
    if (level) level.label = 'MAIN VOLUME';
    const fill = out.find((t) => t.id === 'rytm:fill');
    if (fill) fill.down = ACTION60.fillDown;
  }
  out.push({ id: 'rytm:data', scope: 'mm808', label: LABEL60.data, kind: 'relative', turn: ACTION60.data });
  out.push(press('rytm:keyboard', 'mm808', 'KEYBOARD', ACTION60.keyboard));
  out.push(press('rytm:preset', 'mm808', LABEL60.preset, ACTION60.preset));
  out.push(press('rytm:settings', 'mm808', LABEL60.settings, ACTION60.settings));
  out.push(press('rytm:sounds', 'mm808', LABEL60.sounds, ACTION60.sounds));
  out.push(press('rytm:tap', 'mm808', 'TAP TEMPO', ACTION60.tap));
  out.push(press('rytm:up', 'mm808', LABEL60.arrow('UP'), () => arrowKey('up')));
  out.push(press('rytm:down', 'mm808', LABEL60.arrow('DOWN'), () => arrowKey('down')));
  out.push(press('rytm:left', 'mm808', LABEL60.arrow('LEFT'), () => arrowKey('left')));
  out.push(press('rytm:right', 'mm808', LABEL60.arrow('RIGHT'), () => arrowKey('right')));
  // La face DT2 : faceKeyDown anime la touche PAGE elle-meme (la zone de faceHold reste vide)
  out.push(faceHold('rytm:ptnpage', LABEL60.ptnpage, '', ACTION60.ptnDown, ACTION60.ptnUp));
  out.push({
    id: 'rytm:tempo:bpm',
    scope: 'mm808',
    label: 'TEMPO 30-300 BPM (FINE 1/10)',
    kind: 'value',
    steps: BPM_STEPS,
    get: () => Math.max(0, Math.min(1, (pattern.get().bpm - BPM_LO) / (BPM_HI - BPM_LO))),
    set: (v) => {
      const bpm = Math.round((BPM_LO + Math.max(0, Math.min(1, v)) * (BPM_HI - BPM_LO)) * 10) / 10;
      // Le moteur va de 30 a 300 au dixieme depuis V.5.9 (l'integration de la V.6.0 : plus de borne a 100-150 ici)
      gesture();
      pattern.setBpmFine(Math.max(BPM_RANGE.min, Math.min(BPM_RANGE.max, bpm)));
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
      // Jusqu'a 80 % (SWING_MAX, V.5.9) : le potard SWING d'avant (rytm:enc:swing) garde 50 a 67 %
      gesture();
      pattern.fx.set({ swing: clampSwing((pct - SW_LO) * SWING_PER_PCT) });
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
