/**
 * La face DT2 du MM-RYTM, la saisie (V.6.0, 2026-11-01, la lane B4 ; docs/v4/dt2/dt2-master-spec.md 1.4, 2.6, 2.7, 3.1,
 * 3.3, 3.4, 5.1). Derriere ?face=dt2 seulement (theme.ts DT2_FACE) : sans le drapeau, rien d'ici ne s'appelle, la face,
 * le clavier, le MIDI et le telephone restent ceux de la V.5.3 et de la V.5.9.
 *
 * - Le repartiteur : une touche de la face (le pointeur, le doigt, un jumeau, le clavier, le MIDI, le boitier) devient un
 *   evenement (actions/chords/types.ts ChordEvent) ; la table des accords (actions/chords/, le fichier de la lane :
 *   chords60.ts) est lue par priorite, le premier accord dont les modificateurs sont engages (dans leur ordre) et le
 *   contexte vrai gagne ; ses modificateurs ont servi (state/gesture.ts use).
 * - Les menus plein ecran (scene/screen/menus/registry.ts) : ouvrir un menu = dtFace.menu a son id ; tant qu'il est
 *   ouvert, les fleches, YES, NO et LEVEL/DATA vont a son onInput (la lane B5) ; NO qu'il ne prend pas le ferme. Un menu
 *   pas encore inscrit s'ouvre quand meme dans l'etat (l'ecran le montrera quand B5 sera la).
 * - Les actions des touches nouvelles et des gestes qui changent de place (1.4), avec l'indice de l'ancien geste.
 * - Les TRIG sur les 16 pistes : jouer, choisir (TRK), ecrire (REC), muter (FUNC, le mode MUTE), LIVE REC.
 * Jamais exportees par le baril : actions/face.ts en exporte l'API publique.
 */

import { clock } from '../../audio/clock';
import { resume, trigger } from '../../audio/drums';
import { isLockTrig, type Locks } from '../../audio/locks';
import { STEP_COUNT, VEL_GAIN, pattern, velocity, type Steps } from '../../audio/pattern';
import { defaultKit } from '../../audio/kitlaw';
import { TRACK_KEYS, kit16FromLegacy, tracks, type Kit16, type TrackKey } from '../../audio/tracks';
import type { VoiceFx } from '../../audio/voicefx';
import type { Stage } from '../../scene/renderer';
import type { FaceMenu } from '../../scene/rytmFaceKeys';
import { screenMenu, type ScreenMenuId, type ScreenMenuInputKind } from '../../scene/screen/menus/registry';
import { clipboard } from '../../state/clipboard';
import { dtFace } from '../../state/dtFace';
import { editor } from '../../state/editor';
import { fill } from '../../state/fill';
import { func } from '../../state/func';
import { gesture } from '../../state/gesture';
import { lcdMessage } from '../../state/lcdMessage';
import { lcdSamples } from '../../state/lcdSamples';
import { BANKS, bankName, patterns, slotName } from '../../state/patterns';
import { TAP_VEL_DEFAULT, rytmPage } from '../../state/rytmPage';
import { rytmLock } from '../../state/rytmLock';
import { activeTrack, trk } from '../../state/trk';
import { undo } from '../../state/undo';
import { voices } from '../../state/voices';
import { isRytmPage, screensOf, type RytmPageId } from '../../rytm/pages';
import { CHORDS, type Chord, type ChordEvent, type ChordGesture, type ChordKey } from '../chords';
import { DT2_FACE, DT_GESTURE, LCD_NO_VOICE, PAD_DOUBLE_TAP_MS, type Inst } from '../../theme';
import { st } from '../state';
import { gesture as audioGesture, two } from '../shared';
import { ctlAllEnd } from '../ctlall';
import { heardNow, liveRunning, liveVel } from './live';
import { tapTempo } from './transport';
import { bankViewClose, bankViewToggle } from './patterns';
import { randomPage, reloadPage } from './pages';
import { rytmLockTap } from '../locks';
import { liveHit } from '../live';

/* ---------------- les mots ---------------- */

/** Le message des touches et des gestes inertes (cahier 5.1 : dessines, activation bloquee, message a l'ecran). */
export const SOON_TEXT = { '6.1': 'BIENTOT : V.6.1', '6.2': 'BIENTOT : V.6.2' } as const;
export function soon(v: '6.1' | '6.2'): void {
  lcdMessage.show(SOON_TEXT[v], 1600);
}

/** Les indices des gestes qui changent de place (cahier 1.4), affiches quand l'ancien geste est fait. */
export const HINTS_60 = {
  kit: 'KIT: PRESET KEY',
  tempo: 'TEMPO: TEMPO KEY',
  sounds: 'SOUNDS: SOUNDS KEY',
  fill: 'FILL: HOLD PAGE',
  banks: 'BANKS: TRIG 9-16',
  random: 'RANDOM BEAT: PRESET KEY',
} as const;
export type Hint60 = keyof typeof HINTS_60;
/** Les indices montres depuis le chargement (les sondes). */
export const hintLog: Hint60[] = [];
export function hint60(h: Hint60): void {
  hintLog.push(h);
  if (hintLog.length > 64) hintLog.shift();
  lcdMessage.show(HINTS_60[h], DT_GESTURE.hintMs);
}

/** Le nom d'une piste a l'ecran : T1 a T16. */
export const trackName = (k: TrackKey): string => `T${TRACK_KEYS.indexOf(k) + 1}`;
const trackAt = (i: number): TrackKey | null => (Number.isInteger(i) && i >= 0 && i < TRACK_KEYS.length ? TRACK_KEYS[i] : null);
const isLegacy = (k: TrackKey): k is Inst => TRACK_KEYS.indexOf(k) < 8;

/** Le Stage du dernier geste de la face (les accords le lisent pour enfoncer une touche) ; null : aucun. */
let stageRef: Stage | null = null;
export const stageNow = (): Stage | null => stageRef;
export function stageSet(s: Stage | null): void {
  if (s) stageRef = s;
}
/** La main du geste en cours ('ptr:<id>', 'key', 'midi', 'hw', 'at') : PAGE tenue la retient pour son lacher. */
let srcRef = 'at';
export const srcNow = (): string => srcRef;
export function srcSet(src: string): void {
  srcRef = src;
}

/* ---------------- les menus ---------------- */

/** Un menu plein ecran est-il ouvert (la face DT2) ? */
export const menuOpen = (): boolean => DT2_FACE && dtFace.menu() !== null;

/** Ouvre un menu (null : le ferme). Le menu d'avant se ferme ; la grille PTN et la vue BANK restent dessous. */
export function menuSet(id: ScreenMenuId | null): void {
  dtFace.setMenu(id);
}

/** La touche d'un menu : son menu s'ouvre, ou se ferme s'il l'etait (la DT2). */
export function menuToggle(id: ScreenMenuId): void {
  menuSet(dtFace.menu() === id ? null : id);
}

/** Les saisies routees aux menus depuis le chargement (les sondes) : le genre, la phase, prise ou non. */
export const menuLog: { menu: ScreenMenuId; kind: ScreenMenuInputKind; phase: 'down' | 'up'; taken: boolean }[] = [];

/** Une saisie de navigation au menu ouvert : true si son onInput l'a prise (absent, ou pas encore inscrit : false). */
export function menuInput(kind: ScreenMenuInputKind, phase: 'down' | 'up', delta = 0): boolean {
  const id = dtFace.menu();
  if (!id) return false;
  const m = screenMenu(id);
  let taken = false;
  try {
    taken = !!m?.onInput?.({ kind, phase, func: func.engaged(), ...(kind === 'data' ? { delta } : {}) });
  } catch {
    taken = false;
  }
  menuLog.push({ menu: id, kind, phase, taken });
  if (menuLog.length > 64) menuLog.shift();
  return taken;
}

/** La touche de la face qui porte un menu (sa LED rouge, cahier 2.4). */
export function faceMenuOf(id: ScreenMenuId | null): FaceMenu | null {
  if (id === 'preset' || id === 'kit' || id === 'perform') return 'preset';
  if (id === 'settings') return 'settings';
  if (id === 'sounds' || id === 'samples') return 'sounds';
  if (id === 'tempo') return 'tempo';
  return null;
}

/* ---------------- le repartiteur ---------------- */

let sorted: readonly Chord[] | null = null;
/** La table triee par priorite (stable), lue a la premiere touche : les fichiers des lanes sont evalues. */
const table = (): readonly Chord[] => {
  if (!sorted) sorted = CHORDS.map((c, i) => ({ c, i })).sort((a, b) => b.c.prio - a.c.prio || a.i - b.i).map((x) => x.c);
  return sorted;
};

/** Ses modificateurs engages, dans leur ordre. */
function modsOn(c: Chord): boolean {
  for (const m of c.mods) if (!gesture.on(m)) return false;
  for (let k = 1; k < c.mods.length; k += 1) if (gesture.before(c.mods[k - 1], c.mods[k]) !== true) return false;
  return true;
}

/** Le dernier accord parti (les sondes) et le compte par id. */
export const chordLog: { id: string; key: ChordKey; gesture: ChordGesture; src: ChordEvent['src'] }[] = [];
export const chordCount = new Map<string, number>();

/** L'accord que ferait cet evenement maintenant (sans le jouer) : les sondes, INFOS. */
export function chordFor(key: ChordKey, g: ChordGesture): Chord | null {
  for (const c of table()) if (c.key === key && c.gesture === g && modsOn(c) && (!c.when || c.when())) return c;
  return null;
}

/**
 * Un evenement de la face : le premier accord qui le prend (ses modificateurs engages dans l'ordre, son contexte vrai, son
 * action qui ne rend pas false) part ; ses modificateurs ont servi. Rend l'accord parti, ou null.
 */
export function dispatch(key: ChordKey, g: ChordGesture, src: ChordEvent['src'] = 'mouse', delta = 0, t = performance.now()): Chord | null {
  if (!DT2_FACE) return null;
  const e: ChordEvent = { key, gesture: g, mods: gesture.get(), delta, t, src };
  for (const c of table()) {
    if (c.key !== key || c.gesture !== g) continue;
    if (!modsOn(c)) continue;
    if (c.when && !c.when()) continue;
    if (c.run(e) === false) continue;
    for (const m of c.mods) gesture.use(m);
    // Une FUNC gardee pour une touche s'en va avec la touche suivante, meme si elle n'a pas servi (la regle de la V.5.0, la
    // revue de D1 G2 : sinon un PLAY bien plus tard ferait CLEAR) ; un menu l'a recue (func : true) ; verrouillee, elle reste
    if (!c.mods.includes('func') && func.get().mode === 'once') func.use();
    chordLog.push({ id: c.id, key, gesture: g, src });
    if (chordLog.length > 128) chordLog.shift();
    chordCount.set(c.id, (chordCount.get(c.id) ?? 0) + 1);
    return c;
  }
  return null;
}

/** La source d'un geste vue par la table : 'ptr:<id>' (la souris ; touch : le doigt), 'key', 'midi', 'hw', 'at' (un jumeau). */
export function srcKind(src: string, touch = false): ChordEvent['src'] {
  if (src.startsWith('ptr:')) return touch ? 'touch' : 'mouse';
  if (src === 'key') return 'key';
  if (src === 'midi') return 'midi';
  if (src === 'hw') return 'hw';
  return 'mouse';
}

/* ---------------- les contextes (cahier [MEN 2.5] : le menu, la vue PTN, BANK, MUTE, LIVE, REC) ---------------- */

export const ptnView = (): boolean => DT2_FACE && editor.get() === 'mm808' && !dtFace.bank();
export const bankView = (): boolean => DT2_FACE && dtFace.bank();
export const muteOpen = (): boolean => DT2_FACE && dtFace.mute() !== 'off';
export const liveOpen = (): boolean => DT2_FACE && dtFace.live();
export const recOpen = (): boolean => DT2_FACE && dtFace.rec();
/** Un TRIG tenu (le P-LOCK de toujours : un pas tenu, ou en LOCK) : son index, -1 aucun. */
export const trigHeld = (): number => (DT2_FACE ? rytmLock.get().step : -1);

/* ---------------- les TRIG sur 16 pistes ---------------- */

/** TRK + TRIG 1 a 16 (cahier 3.2) : la piste choisie, sans un son ; deux tapes sur le meme : elle se coupe ou revient. */
export function trigTrk(i: number, stage: Stage | null, t = performance.now()): boolean {
  if (!trk.engaged()) return false;
  // TRK gardee qui se ferme : seule la deuxieme tape sur le meme TRIG reste a TRK (la regle de la V.5.3)
  if (trk.get().mode === 'closing' && !(st.trkLast && st.trkLast.i === i && t - st.trkLast.t <= PAD_DOUBLE_TAP_MS)) {
    trk.cancel();
    return false;
  }
  const k = trackAt(i);
  if (!k) return true;
  stage?.pressStep(i);
  const v = voices.get();
  if (!v.soloMode && !v.muteMode && st.trkLast && st.trkLast.i === i && t - st.trkLast.t <= PAD_DOUBLE_TAP_MS) {
    st.trkLast = null;
    ctlAllEnd();
    trackMuteToggle(k);
    trk.use(t);
    return true;
  }
  st.trkLast = { i, t };
  ctlAllEnd();
  resume();
  trackSelect(k);
  trk.use(t);
  if (lcdSamples.isOpen()) lcdSamples.touch();
  else lcdMessage.show(`TRK ${trackName(k)}`, trk.get().mode === 'held' ? 60000 : undefined);
  return true;
}

/** La piste active devient k (1 a 8 : la voix du motif aussi). */
export function trackSelect(k: TrackKey): void {
  activeTrack.set(k);
}

/** Une piste coupee ou rendue (le mute global, les 16 pistes) ; l'ecran le dit. */
export function trackMuteToggle(k: TrackKey): void {
  voices.toggleMute(k);
  lcdMessage.show(`${trackName(k)} ${voices.isMuted(k) ? 'MUTED' : 'BACK'}`);
}

/**
 * FUNC + TRIG hors GRID REC (le QUICK MUTE, cahier 3.1 et 3.4) : la piste n se coupe ou revient, dans le dernier mode de MUTE
 * (global, ou celui du pattern ; le mute du pattern reste aux pistes 1 a 8 en 6.0 : 9 a 16 passent au global).
 */
export function trigQuickMute(i: number, stage: Stage | null): void {
  resume();
  stage?.pressStep(i);
  const k = trackAt(i);
  if (!k) return;
  if (dtFace.lastMute() === 'pattern' && isLegacy(k)) {
    undo.boundary('mm808', 'step');
    pattern.togglePmute(k);
    lcdMessage.show(`${trackName(k)} ${pattern.pmuted(k) ? 'MUTED IN THE PATTERN' : 'BACK IN THE PATTERN'}`);
    return;
  }
  trackMuteToggle(k);
}

/** Le mode MUTE (FUNC + TRK) : TRIG 1 a 16 coupent leur piste ou la rendent (global, ou le pattern pour 1 a 8). */
export function trigMute(i: number, stage: Stage | null): void {
  resume();
  stage?.pressStep(i);
  const k = trackAt(i);
  if (!k) return;
  if (dtFace.mute() === 'pattern') {
    if (!isLegacy(k)) {
      lcdMessage.show('PATTERN MUTE: TRACKS 1-8', 1400);
      return;
    }
    undo.boundary('mm808', 'step');
    pattern.togglePmute(k);
    lcdMessage.show(`${trackName(k)} ${pattern.pmuted(k) ? 'MUTED IN THE PATTERN' : 'BACK IN THE PATTERN'}`);
    return;
  }
  trackMuteToggle(k);
}

/** Un TRIG tenu en mode MUTE : le SOLO de sa piste (16). */
export function trigSolo(i: number, stage: Stage | null): void {
  const k = trackAt(i);
  if (!k || dtFace.mute() === 'off') return;
  stage?.pressStep(i);
  voices.toggleSolo(k);
  lcdMessage.show(voices.isSolo(k) ? `SOLO ${trackName(k)}` : `${trackName(k)} SOLO OFF`);
}

/** La piste a-t-elle un son qui sort (ni coupee ni dans le mute du pattern) ? */
const audible = (k: TrackKey): boolean => !voices.isMuted(k) && !(isLegacy(k) && pattern.pmuted(k));

/**
 * Un TRIG hors REC (cahier 5.1 : TRIG 1-16 jouent les pistes) : la piste n sonne (meme en lecture) et devient la piste active
 * (TRK SELECT auto, le comportement d'avant ; manual : elle sonne seulement). LIVE REC : la frappe s'ecrit aussi (16 pistes).
 */
export function trigPlay(i: number, stage: Stage | null, ts = -1): void {
  audioGesture();
  stage?.pressStep(i);
  const k = trackAt(i);
  if (!k) return;
  // Les modes MUTE et SOLO d'avant (M et Maj + M au clavier, MIDI rytm:mute) : la piste touchee y bascule
  const v = voices.get();
  if (v.soloMode || v.muteMode) {
    if (v.soloMode) voices.toggleSolo(k);
    else voices.toggleMute(k);
    if (!(v.soloMode ? v.soloMulti : v.muteMulti)) voices.disarm(v.soloMode ? 'solo' : 'mute');
    lcdMessage.show(v.soloMode ? (voices.isSolo(k) ? `SOLO ${trackName(k)}` : `${trackName(k)} SOLO OFF`) : `${trackName(k)} ${voices.isMuted(k) ? 'MUTED' : 'ON'}`);
    return;
  }
  const live = liveRunning();
  const n = live ? liveVel() : isLegacy(k) ? rytmPage.tapVel(k) : TAP_VEL_DEFAULT;
  const r = live ? liveHit(k, n, ts >= 0 ? (heardNow(ts) ?? undefined) : undefined) : null;
  if (r !== 'quiet' && audible(k)) trigger(k, undefined, false, undefined, VEL_GAIN[n] ?? 1);
  if (r || dtFace.personal().trkSelect === 'auto') {
    if (activeTrack.get() !== k) {
      trackSelect(k);
      if (!r) lcdMessage.show(`${trackName(k)}${dtFace.live() ? ' · PLAY: LIVE REC' : ''}`, 900);
    }
  }
}

/** GRID REC (REC allume) : TRIG n pose ou retire le pas n de la piste active (16 pistes) ; en LOCK, la tape deplace le LOCK. */
export function trigWrite(i: number, stage: Stage | null): boolean {
  resume();
  stage?.pressStep(i);
  const k = activeTrack.get();
  if (!k) {
    lcdMessage.show(LCD_NO_VOICE);
    return false;
  }
  if (rytmLock.get().step >= 0) {
    rytmLockTap(i);
    return true;
  }
  const p = pattern.get();
  if (velocity(p.steps, k, i) === 0 && isLockTrig(p.locks, k, i)) {
    pattern.clearLock(k, [i]);
    rytmPage.select(i);
    lcdMessage.show(`STEP ${two(i + 1)} ${trackName(k)} LOCK TRIG OFF`);
    return true;
  }
  if (velocity(p.steps, k, i) === 0) pattern.set(k, i, isLegacy(k) ? rytmPage.tapVel(k) : TAP_VEL_DEFAULT);
  else pattern.clearStep(k, i);
  rytmPage.select(i);
  lcdMessage.show(`STEP ${two(i + 1)} ${trackName(k)} ${velocity(pattern.get().steps, k, i) > 0 ? 'ON' : 'OFF'}`);
  return true;
}

/** FUNC + TRIG en GRID REC (le lock trig, V.5.1) : sur la piste active (16). */
export function trigLockTrig(i: number, stage: Stage | null): void {
  resume();
  stage?.pressStep(i);
  const k = activeTrack.get();
  if (!k) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const p = pattern.get();
  const vel = velocity(p.steps, k, i);
  if (vel === 0 && isLockTrig(p.locks, k, i)) {
    pattern.clearLock(k, [i]);
    lcdMessage.show(`STEP ${two(i + 1)} ${trackName(k)} LOCK TRIG OFF`);
    return;
  }
  if (vel > 0) pattern.set(k, i, 0);
  pattern.setLock(k, [i], 'ltrg', 1);
  rytmPage.select(i);
  lcdMessage.show(vel > 0 ? `STEP ${two(i + 1)} ${trackName(k)} NOW A LOCK TRIG` : `STEP ${two(i + 1)} ${trackName(k)} LOCK TRIG: HOLD + KNOB`, 1800);
}

/* ---------------- SETTINGS tenu + TRIG (cahier 3.1 : l'intensite des LED, le retroeclairage) ---------------- */

export function trigSettings(i: number, stage: Stage | null): boolean {
  if (i >= 0 && i <= 2) {
    stage?.pressStep(i);
    const led = (['low', 'mid', 'max'] as const)[i];
    dtFace.setPersonal({ led });
    lcdMessage.show(`LED INTENSITY ${led.toUpperCase()}`, 1400);
    return true;
  }
  if (i === 8) {
    stage?.pressStep(i);
    dtFace.setPersonal({ backlight: !dtFace.personal().backlight });
    lcdMessage.show(`LED BACKLIGHT ${dtFace.personal().backlight ? 'ON' : 'OFF'}`, 1400);
    return true;
  }
  return false;
}

/* ---------------- PTN sur les TRIG (cahier 3.3) ---------------- */

/** La derniere tape de PTN qui a ouvert la vue (deux fois vite : l'indice KIT: PRESET KEY). */
let ptnOpenedAt = -Infinity;
const PTN_AGAIN_MS = 1600;

/** PTN : la vue PTN (les TRIG sont les patterns de la banque affichee) s'ouvre ou se ferme ; la vue BANK, elle se ferme. */
export function ptnToggle(stage: Stage | null, t = performance.now()): void {
  audioGesture();
  stage?.pressRytmPad('edit');
  if (dtFace.bank()) {
    bankViewClose();
    return;
  }
  if (dtFace.mute() !== 'off') dtFace.setMute('off');
  if (editor.get() === 'mm808') {
    editor.close();
    // L'ancien geste (PTN deux fois = KIT) : l'indice
    if (t - ptnOpenedAt < PTN_AGAIN_MS) hint60('kit');
    else lcdMessage.show('PTN CLOSED', 900);
    ptnOpenedAt = -Infinity;
    return;
  }
  editor.setGrid(false);
  editor.toggle('mm808');
  ptnOpenedAt = t;
  lcdMessage.show(`PATTERNS ${bankName(patterns.shown())}: TRIG 1-16 · LEFT RIGHT: BANK`, 2000);
}

/** FUNC + PTN : la vue BANK (TRIG 9 a 16 = banques A a H). */
export function ptnBank(stage: Stage | null): void {
  audioGesture();
  bankViewToggle(stage);
  if (dtFace.bank()) lcdMessage.show(`BANK ${bankName(patterns.get().bank)} · TRIG 9-16: BANKS A-H`, 2400);
}

/** La vue BANK, TRIG k : 9 a 16 choisissent la banque A a H (sa grille PTN s'ouvre) ; 1 a 8, l'indice. */
export function trigBank(i: number, stage: Stage | null): void {
  resume();
  stage?.pressStep(i);
  if (i < 8) {
    hint60('banks');
    return;
  }
  const b = i - 8;
  if (b >= BANKS) return;
  patterns.setBank(b);
  dtFace.setBank(false);
  st.bankOverGrid = false;
  if (editor.get() !== 'mm808') editor.toggle('mm808');
  lcdMessage.show(`BANK ${bankName(b)}: PICK A PATTERN`, 2000);
}

/** PTN + LEFT / RIGHT (la vue PTN ou BANK) : la banque d'avant ou d'apres. */
export function ptnBankStep(dir: -1 | 1): void {
  const b = Math.max(0, Math.min(BANKS - 1, patterns.get().bank + dir));
  patterns.setBank(b);
  lcdMessage.show(`BANK ${bankName(b)}`, 1200);
}

/**
 * Un pattern tenu dans la vue PTN (un TRIG tenu, cahier 3.3 : TRIG + REC / STOP / PLAY = copier, coller, effacer un pattern
 * qui n'est pas forcement le courant) : son emplacement et la fin de sa garde.
 */
let ptnHeld: { slot: number; until: number } | null = null;
export function ptnHold(k: number): void {
  const slot = patterns.slotAt(k);
  ptnHeld = { slot, until: performance.now() + DT_GESTURE.pageArmMs * 2 };
  lcdMessage.show(`${slotName(slot)}: REC COPY · STOP PASTE · PLAY CLEAR`, 2400);
}
export const ptnHeldSlot = (): number => (ptnView() && ptnHeld && performance.now() <= ptnHeld.until ? ptnHeld.slot : -1);

/** Un emplacement tel que le presse-papiers le garde (le courant : le motif ; un autre : ses donnees retenues). */
function slotData(slot: number): { steps: Steps; locks: unknown; scenes: unknown; pmutes: unknown; trigs: unknown } {
  if (slot === patterns.get().cur) {
    const p = pattern.get();
    return JSON.parse(JSON.stringify({ steps: p.steps, locks: p.locks, scenes: pattern.scenes.get(), pmutes: p.pmutes, trigs: p.trigs })) as { steps: Steps; locks: unknown; scenes: unknown; pmutes: unknown; trigs: unknown };
  }
  const s = patterns.get();
  return JSON.parse(JSON.stringify({ steps: patterns.stepsOf(slot), locks: patterns.locksOf(slot), scenes: s.scenes[slot] ?? null, pmutes: s.pmutes[slot] ?? null, trigs: s.trigs[slot] ?? null })) as { steps: Steps; locks: unknown; scenes: unknown; pmutes: unknown; trigs: unknown };
}

/** TRIG tenu (PTN) + REC / STOP / PLAY : copier, coller, effacer ce pattern ; une etape d'UNDO. */
export function ptnSlotOp(op: 'copy' | 'paste' | 'clear'): boolean {
  const slot = ptnHeldSlot();
  if (slot < 0) return false;
  ptnHeld = null;
  if (op === 'copy') {
    clipboard.put('pattern', { slot, data: slotData(slot) });
    lcdMessage.show(`PATTERN ${slotName(slot)} COPIED`);
    return true;
  }
  const cur = slot === patterns.get().cur;
  let part: { steps?: unknown; locks?: unknown; scenes?: unknown; pmutes?: unknown; trigs?: unknown } = {};
  if (op === 'paste') {
    const c = clipboard.take('pattern');
    if (!c) {
      lcdMessage.show('NOTHING TO PASTE');
      return true;
    }
    part = JSON.parse(JSON.stringify(c.data)) as typeof part;
  }
  undo.boundary('mm808', 'step');
  if (cur) {
    const steps = (part.steps ?? emptySteps()) as Steps;
    pattern.replace(steps, (part.locks ?? {}) as never);
    pattern.setTrigs((part.trigs ?? null) as never);
  } else patterns.restoreSlot(slot, part);
  lcdMessage.show(op === 'paste' ? `PATTERN PASTED ON ${slotName(slot)}` : `PATTERN ${slotName(slot)} CLEARED`);
  return true;
}
const emptySteps = (): Steps => Object.fromEntries(TRACK_KEYS.slice(0, 8).map((k) => [k, '0'.repeat(STEP_COUNT)])) as Steps;

/* ---------------- COPY, PASTE, CLEAR (FUNC + REC, STOP, PLAY) : le presse-papiers unique, 16 pistes ---------------- */

/** Les verrous d'un pattern dont la rangee k prend ceux-ci (absents : aucun). */
function withRow(all: Readonly<Locks>, k: TrackKey, row: unknown): Locks {
  const out = JSON.parse(JSON.stringify(all)) as Locks;
  if (row && typeof row === 'object' && Object.keys(row).length > 0) (out as Record<string, unknown>)[k] = JSON.parse(JSON.stringify(row));
  else delete (out as Record<string, unknown>)[k];
  return out;
}

/** FUNC + REC (la face DT2) : hors REC le pattern, REC allume la rangee de la piste active ; une copie remplace la precedente. */
export function copy60(): void {
  const p = pattern.get();
  if (dtFace.rec()) {
    const k = activeTrack.get();
    if (!k) {
      lcdMessage.show(LCD_NO_VOICE);
      return;
    }
    clipboard.put('track', { track: k, steps: p.steps[k] ?? '0'.repeat(STEP_COUNT), locks: p.locks[k] ? JSON.parse(JSON.stringify(p.locks[k])) : undefined, trigs: p.trigs[k] ? { ...p.trigs[k] } : undefined });
    lcdMessage.show(`${trackName(k)} COPIED`);
    return;
  }
  const from = patterns.get().cur;
  clipboard.put('pattern', { slot: from, data: slotData(from) });
  lcdMessage.show(`PATTERN ${slotName(from)} COPIED`);
}

/** FUNC + STOP (la face DT2) : un pattern copie remplace le courant ; une rangee va a la piste active ; une etape d'UNDO. */
export function paste60(): void {
  const it = clipboard.get();
  const pat = clipboard.take('pattern');
  const row = clipboard.take('track');
  if (!it || (!pat && !row)) {
    lcdMessage.show('NOTHING TO PASTE');
    return;
  }
  const p = pattern.get();
  if (pat) {
    const d = pat.data as { steps?: Steps; locks?: Locks; scenes?: unknown; pmutes?: unknown; trigs?: unknown };
    undo.boundary('mm808', 'step');
    pattern.replace((d.steps ?? emptySteps()) as Steps, (d.locks ?? {}) as Locks);
    if (d.scenes) pattern.scenes.replace(d.scenes as never);
    pattern.setPmutes((Array.isArray(d.pmutes) ? d.pmutes : []) as never);
    pattern.setTrigs((d.trigs ?? null) as never);
    lcdMessage.show(`PATTERN ${slotName(pat.slot)} PASTED ON ${slotName(patterns.get().cur)}`);
    return;
  }
  const k = activeTrack.get();
  if (!row || !k) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  undo.boundary('mm808', 'step');
  pattern.replace({ ...p.steps, [k]: row.steps } as Steps, withRow(p.locks, k, row.locks));
  const tr = { ...p.trigs } as Record<string, unknown>;
  if (row.trigs) tr[k] = { ...(row.trigs as object) };
  else delete tr[k];
  pattern.setTrigs(tr as never);
  lcdMessage.show(row.track === k ? `${trackName(k)} PASTED` : `${trackName(row.track as TrackKey)} PASTED ON ${trackName(k)}`);
}

/** FUNC + PLAY en GRID REC (la face DT2) : la rangee de la piste active se vide (ses pas, ses verrous, ses reglages de trig). */
export function clearRow60(): boolean {
  const k = activeTrack.get();
  if (!k) {
    lcdMessage.show(LCD_NO_VOICE);
    return true;
  }
  const p = pattern.get();
  undo.boundary('mm808', 'step');
  pattern.replace({ ...p.steps, [k]: '0'.repeat(STEP_COUNT) } as Steps, withRow(p.locks, k, undefined));
  pattern.clearTrigs(k);
  lcdMessage.show(`${trackName(k)} CLEARED`);
  return true;
}

/* ---------------- TRK + REC / STOP / PLAY : le son de la piste (cahier 3.2) ---------------- */

/** Le son d'une piste copie, colle, efface (son depart) ; une etape d'UNDO pour coller et effacer. */
export function trackSoundOp(op: 'copy' | 'paste' | 'clear'): void {
  const k = activeTrack.get();
  if (!k) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const i = TRACK_KEYS.indexOf(k);
  const K = tracks.get();
  if (op === 'copy') {
    clipboard.put('sound', { track: k, data: JSON.parse(JSON.stringify({ sound: K.tracks[i], voice: K.voice[i] })) as unknown });
    lcdMessage.show(`${trackName(k)} SOUND COPIED`);
    return;
  }
  let from: { sound: Kit16['tracks'][number]; voice: Kit16['voice'][number] } | null = null;
  if (op === 'paste') {
    const c = clipboard.take('sound');
    if (!c) {
      lcdMessage.show('NOTHING TO PASTE');
      return;
    }
    from = c.data as { sound: Kit16['tracks'][number]; voice: Kit16['voice'][number] };
  } else {
    const d = kit16FromLegacy(defaultKit(), {} as Readonly<Record<Inst, Readonly<VoiceFx>>>);
    from = { sound: d.tracks[i], voice: d.voice[i] };
  }
  undo.boundary('mm808', 'step');
  const next: Kit16 = { ...K, tracks: K.tracks.map((t, j) => (j === i ? JSON.parse(JSON.stringify(from.sound)) : t)), voice: K.voice.map((v, j) => (j === i ? { ...from.voice } : v)) };
  tracks.replace(next);
  lcdMessage.show(op === 'paste' ? `SOUND PASTED ON ${trackName(k)}` : `${trackName(k)} SOUND CLEARED`);
}

/* ---------------- les fleches ---------------- */

/** UP / DOWN sur l'ecran principal (cahier 3.1) : la sous-page d'avant ou d'apres de la page affichee. */
export function subPage(dir: -1 | 1): void {
  const rp = rytmPage.get();
  const inst = pattern.get().instrument;
  const page = rp.page;
  if (!isRytmPage(page)) return;
  const tabs = screensOf(page, inst);
  if (tabs.length < 2) {
    lcdMessage.show('NO SUB PAGE', 700);
    return;
  }
  const cur = Math.max(0, tabs.indexOf(rytmPage.screen(inst)));
  const next = Math.max(0, Math.min(tabs.length - 1, cur + dir));
  if (next !== cur) rytmPage.setTab(page, next, inst);
  lcdMessage.show(`${tabs[next].toUpperCase()} ${next + 1}/${tabs.length}`, 900);
}

/** TRIG tenu + LEFT / RIGHT (cahier 3.3, uTIME) : le pas tenu (ses voisins tenus aussi) recule ou avance d'un cran (1/384). */
export function microTime(dir: -1 | 1): boolean {
  const steps = rytmLock.targets();
  const k = pattern.get().instrument;
  if (steps.length === 0 || !k) return false;
  const p = pattern.get();
  const base = p.trigs[k]?.utime ?? 0;
  let last = 0;
  for (const s of steps) {
    const cur = (p.locks[k]?.[String(s)] as { utime?: number } | undefined)?.utime ?? base;
    last = Math.max(-23, Math.min(23, Math.round(cur + dir)));
    pattern.setLock(k, [s], 'utime', last);
  }
  rytmLock.wrote();
  lcdMessage.show(`MICRO TIMING ${last > 0 ? '+' : ''}${last}/384`, 1200);
  return true;
}

/* ---------------- LEVEL/DATA (TRK LEV de la piste active) ---------------- */

/** LEVEL/DATA tourne de delta crans hors menu : le TRK LEV de la piste active (127 crans pour toute la course). */
export function trackLevelTurn(delta: number): void {
  const k = activeTrack.get();
  if (!k) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  const v0 = tracks.param(k, 'tlev');
  const v = Math.max(0, Math.min(1, Math.round((v0 + delta / 127) * 1000) / 1000));
  if (v !== v0) tracks.set(k, 'tlev', v);
  lcdMessage.show(`${trackName(k)} TRK LEV ${Math.round(v * 127)}`, 900, true);
}

/* ---------------- PAGE et FILL (cahier 1.4 et 3.1) ---------------- */

/** FILL tenu plus de ce temps au pointeur et au clavier (une tape de PAGE ne fait pas d'eclair de FILL). */
export const PAGE_FILL_MS = 250;
const pageHolds = new Map<string, { timer: number; on: boolean }>();
let barOff: (() => void) | null = null;

/** PAGE enfoncee (src) : FILL tant qu'on la tient (apres PAGE_FILL_MS, tout de suite au MIDI). */
export function pageFillDown(src: string): void {
  if (pageHolds.has(src)) return;
  const h = { timer: 0, on: false };
  const start = (): void => {
    h.timer = 0;
    h.on = true;
    fill.hold(`page:${src}`, true);
  };
  if (src === 'midi' || src === 'hw') start();
  else h.timer = window.setTimeout(start, PAGE_FILL_MS);
  pageHolds.set(src, h);
}
/** PAGE lachee : la tenue de FILL s'arrete (le verrou et un cycle restent). */
export function pageFillUp(src: string): void {
  const h = pageHolds.get(src);
  if (!h) return;
  pageHolds.delete(src);
  if (h.timer) window.clearTimeout(h.timer);
  if (h.on) fill.hold(`page:${src}`, false);
}
/** Toutes les tenues de PAGE s'arretent (la fenetre perd le focus). */
export function pageFillAll(): void {
  for (const src of [...pageHolds.keys()]) pageFillUp(src);
}
/** PAGE puis YES : FILL verrouille ; les tenues en cours le gardent allume. */
export function fillLatch(): void {
  fill.latch(true);
  lcdMessage.show('FILL LATCHED · PAGE: OFF', 1600);
}
/** PAGE encore (FILL verrouille) : il se leve. */
export function fillUnlatch(): void {
  fill.latch(false);
  lcdMessage.show('FILL OFF', 900);
}
/** YES puis PAGE : FILL un cycle, au debut de la mesure suivante. */
export function fillCycle(): void {
  if (!barOff) barOff = clock.onBar(() => fill.cycleBar());
  fill.armCycle();
  lcdMessage.show('FILL: ONE CYCLE, FROM THE NEXT BAR', 1600);
}

/* ---------------- la page + YES / NO (V.5.0, inchange) ---------------- */

const armedPage = (t = performance.now()): RytmPageId | null => (st.pageArm && t <= st.pageArm.until ? st.pageArm.page : null);
export const pageArmed = (): boolean => DT2_FACE && armedPage() !== null;

/** Une page tapee puis YES : la page au hasard (TRIG : la page TRIG, plus le beat entier ; l'indice RANDOM BEAT). */
export function pageRandom(): boolean {
  const pg = armedPage();
  if (!pg) return false;
  st.pageArm = null;
  randomPage(pg);
  if (pg === 'trig') hint60('random');
  return true;
}
/** Une page tapee puis NO : rechargee du point de sauvegarde (FUNC + YES). */
export function pageReload(): boolean {
  const pg = armedPage();
  if (!pg || !st.savePoint) return false;
  st.pageArm = null;
  reloadPage(pg);
  return true;
}
