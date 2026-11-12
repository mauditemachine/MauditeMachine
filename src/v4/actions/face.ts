/**
 * Les actions du MM-RYTM : les touches de la face facon Digitakt (FUNC, PAGE, REC, PLAY, STOP, COPY, PASTE, SAVE, RELOAD, YES, NO, MUTE MODE). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/face.ts.
 */

import { clock } from '../audio/clock';
import { cutTails, resume } from '../audio/drums';
import { type Locks } from '../audio/locks';
import { type TrigRow, type TrigSet } from '../audio/trig';
import { INSTRUMENTS, STEP_COUNT, pattern, type Steps } from '../audio/pattern';
import { sc } from '../audio/soundcloud';
import type { Stage } from '../scene/renderer';
import { rytmInfos } from '../state/rytmInfos';
import { lcdMessage } from '../state/lcdMessage';
import { lcdSamples } from '../state/lcdSamples';
import { editor } from '../state/editor';
import { patterns, slotName } from '../state/patterns';
import { presetMode } from '../state/presetMode';
import { undo } from '../state/undo';
import { apply, capture } from '../state/presets';
import { func } from '../state/func';
import { dtFace, type MuteView } from '../state/dtFace';
import { rytmPage } from '../state/rytmPage';
import { rytmLock } from '../state/rytmLock';
import { trk } from '../state/trk';
import { fill } from '../state/fill';
import { sceneCtl } from '../state/sceneCtl';
import { type SceneSet } from '../rytm/sceneData';
import { isRytmPage, type RytmPageId } from '../rytm/pages';
import { section } from '../state/section';
import { voices } from '../state/voices';
import { DT2_FACE, DT_FACE, DT_GESTURE, LCD_NO_VOICE, PAD_DOUBLE_TAP_MS, type Inst } from '../theme';
import { IN_PLUGIN } from '../pluginMode';
import { PERF_PADS, perform } from '../state/perform';
import type { Dt2ButtonId } from '../rytm/dtFaceIds';
import { gesture as gestureLayer } from '../state/gesture';
import { activeTrack } from '../state/trk';
import type { TrackKey } from '../audio/tracks';
import { st } from './state';
import {
  clearRow60,
  copy60,
  dispatch,
  dropPrepared,
  knobClick60,
  knobNo,
  stepShiftHold as stepShiftHold60,
  trigMuteHold,
  faceMenuOf,
  menuInput,
  menuLog,
  menuOpen,
  menuSet,
  pageFillAll,
  pageFillUp,
  paste60,
  ptnPageTap,
  srcKind,
  srcSet,
  stageSet,
  stageNow as stageNowFace,
  trackMuteToggle,
  trackSelect as trackSelect60,
  trigSolo,
  hint60,
} from './internal/keys60';
import { ctlAllUndo } from './ctlall';
import { eventAt, gesture } from './shared';
import { bankViewClose } from './internal/patterns';
import { tapTempo } from './internal/transport';
import { randomPage, reloadPage } from './internal/pages';
import { funcSay, funcTake, noHolders, noUsed, PAGE_BTN } from './internal/face';
import { liveEnter, liveErase, liveExit } from './internal/live';
import { escape, hoodOf } from './nav';
import { clearPattern, randomPattern } from './patterns';
import { runToggle } from './transport';
import { trkDown, trkUp } from './tracks';
import { curScreen } from './kit';
import { lockMode, lockPages } from './locks';
import { presetKey, presetTurns } from './presets';

/* ---------------- V.5.0 : la face facon Digitakt du desktop (2026-10-29, l'etape D1) ---------------- */

/*
 * docs/v4/digitakt-d1-spec.md, section 3 (Mika : "je veux une machine qui ressemble a la Digitakt dans ses fonctions mais
 * je veux garder mon design de machine") : FUNC et sa fonction orange sous chaque touche, REC, PLAY (pause), STOP, YES et
 * NO, les pages TRIG et MOD, et les pages de FUNC (TEMPO, SEND FX, MIXER). Le desktop seulement (DT_FACE) : le telephone
 * garde sa face et ses gestes, au pixel pres. Les cibles MIDI d'avant gardent leur effet (rytm:run, rytm:clear...).
 */


const FUNC_HINT = 'FUNC: + A KEY';

/** FUNC enfoncee (src : 'ptr:<pointerId>', 'key' (Alt), 'at', 'midi', 'hw'). */
export function funcDown(src: string, t = performance.now()): void {
  if (!DT_FACE) return;
  resume();
  const was = func.engaged();
  func.down(src, t);
  if (!was && func.engaged()) funcSay(FUNC_HINT);
}
/** FUNC lachee ; t < 0 : un pointeur perdu ou Alt (lachee sans garde). */
export function funcUp(src: string, t = performance.now()): void {
  func.up(src, t);
}

/**
 * Une entree qui n'a pas de fonction FUNC (la revue de D1, G2 : une touche de KIT, SCENE A ou B, le logo M, un potard, un
 * pas, une voix au clavier, une cible MIDI) : elle fait la sienne et une FUNC gardee pour une touche s'en va (tenue : elle
 * sert, son lacher ne la garde pas ; verrouillee par deux tapes : elle reste). Sans cela, un PLAY bien plus tard faisait CLEAR.
 */
export function funcDrop(): void {
  if (DT_FACE && func.engaged() && func.get().mode !== 'locked') func.use();
}
const armedPage = (t = performance.now()): RytmPageId | null => (st.pageArm && t <= st.pageArm.until ? st.pageArm.page : null);

/**
 * Une touche de page vraiment tenue (V.5.0, le doigt ou la souris, avant son lacher) : armee tant qu'on la tient, puis
 * DT_GESTURE.pageArmMs apres le lacher (TRIG tenue + YES = RANDOM, comme la Digitakt).
 */
export function pageKeyHold(id: string, down: boolean): void {
  if (!DT_FACE || !isRytmPage(id) || !PAGE_BTN[id]) return;
  // FUNC + la touche : sa fonction orange, la page n'est pas armee ; sous KIT non plus (une touche de l'ecran, G7)
  if (down) st.pageArm = func.engaged() || presetTurns() ? null : { page: id, until: Infinity };
  else if (st.pageArm && st.pageArm.page === id && st.pageArm.until === Infinity) st.pageArm = { page: id, until: performance.now() + DT_GESTURE.pageArmMs };
  // La face DT2 (V.6.0) : la touche de page est aussi un modificateur de la couche de gestes (cahier 2.7)
  const btn = PAGE_BTN[id];
  if (DT2_FACE && btn) {
    if (down) gestureLayer.down(btn, 'page', performance.now());
    else gestureLayer.up(btn, 'page', performance.now());
  }
}

/* ---------- REC, le mode ecriture ---------- */

/**
 * ● REC (la face, son jumeau, W au clavier, MIDI rytm:rec) : le mode ecriture des pas ; FUNC + REC : COPY. mouse : une tape
 * de la souris sur la face (seule a faire LIVE REC par un double appui).
 */
export function recKey(stage: Stage | null = null, mouse = false): void {
  if (!DT_FACE) return;
  // La face DT2 (V.6.0) : la table des accords (FUNC + REC COPY, TRK + REC le son, TRIG tenu en PTN le pattern, REC seule)
  if (DT2_FACE) {
    faceKeyTap('rec', stage, mouse ? 'mouse' : 'midi');
    return;
  }
  resume();
  stage?.pressFaceKey('rec');
  if (funcTake()) {
    copyKey();
    return;
  }
  recBody(stage, mouse);
}

/** Le double clic de REC dans le plugin (ms). */
const REC_DOUBLE_MS = 750;

/** ● seule (V.5.3, sans FUNC) : REC, ● deux fois a la souris LIVE REC, ● en LIVE REC le GRID REC. */
export function recBody(stage: Stage | null, mouse: boolean): void {
  resume();
  stage?.pressFaceKey('rec');
  // ● tapee deux fois vite a la souris (V.5.3, la souris ne tient pas deux touches) : LIVE REC ; seulement si la premiere
  // tape a allume REC depuis REC eteint (la revue de D3b R5 : jamais en sortant de LIVE REC, ni par W ou le MIDI)
  const t = eventAt();
  // Le plugin (2026-11-11, Mika : "en cliquant deux fois dans REC") : deux clics en REC_DOUBLE_MS, que REC soit allume ou
  // non au premier (un double clic de souris est plus lent que deux tapes, et le premier eteint un GRID REC allume)
  const dbl = IN_PLUGIN ? mouse && t - st.recTapAt < REC_DOUBLE_MS && !dtFace.live() : mouse && t - st.recTapAt < PAD_DOUBLE_TAP_MS && dtFace.rec() && !dtFace.live();
  st.recTapAt = -Infinity;
  if (dbl) {
    liveEnter();
    return;
  }
  // ● en LIVE REC : le grid rec (le manuel [M1] 10.2.3 : "If LIVE RECORDING mode is active and [RECORD] is pressed, GRID
  // RECORDING mode will be activated")
  if (dtFace.live()) {
    liveExit(true);
    lcdMessage.show('● GRID REC · LIVE REC OFF', 1400);
    return;
  }
  const on = !dtFace.rec();
  dtFace.setRec(on);
  if ((on || IN_PLUGIN) && mouse) st.recTapAt = t;
  st.recHinted = false;
  // REC eteint : plus rien ne s'ecrit, le P-LOCK en cours s'en va aussi (la revue de D1, G10)
  if (!on) rytmLock.leave();
  // La face DT2 (la relecture de la V.6.0) : les 16 TRIG jouent les 16 pistes
  // Le plugin : le message dit le double clic (l'en-tete de l'ecran montre 26 lettres)
  if (IN_PLUGIN) lcdMessage.show(on ? '● REC · 2 CLICKS: LIVE REC' : 'REC OFF', 1600);
  else lcdMessage.show(on ? '● REC: TAP STEPS TO WRITE, HOLD: P-LOCK' : DT2_FACE ? 'REC OFF: TRIG 1-16 PLAY THE TRACKS' : 'REC OFF: STEPS 1-8 PLAY THE VOICES', 1600);
}

/* ---------- PLAY, STOP ---------- */

/**
 * ▶ PLAY (la face, son jumeau, Espace, MIDI rytm:play) : a l'arret, la lecture du pas 1 ; en lecture, la pause (sa LED
 * clignote) ; en pause, la reprise au pas de la pause. Une piste SoundCloud qui joue passe en pause, comme RUN. FUNC +
 * PLAY : CLEAR. Le telephone : RUN/STOP, comme avant.
 */
export function playKey(stage: Stage | null = null): boolean {
  if (!DT_FACE) return runToggle(stage);
  // La face DT2 (V.6.0) : la table des accords (FUNC + PLAY CLEAR, TRK + PLAY le son, TRIG tenu en PTN le pattern)
  if (DT2_FACE) {
    faceKeyTap('play', stage);
    return clock.running;
  }
  gesture();
  if (funcTake()) {
    stage?.pressFaceKey('run');
    dtClear(stage);
    return clock.running;
  }
  return playBody(stage);
}

/** ▶ seule (V.5.0 a V.5.3, sans FUNC) : la lecture, la pause, la reprise ; ● tenue + ▶ LIVE REC. */
export function playBody(stage: Stage | null): boolean {
  gesture();
  stage?.pressButton('run');
  // ● tenue + ▶ (V.5.3, le manuel [M1] 10.2.3) : LIVE REC, la lecture part ; le lacher de ● ne fait pas REC
  if (DT_FACE && recHolders.size > 0) {
    for (const s of recHolders) recTaken.add(s);
    liveEnter();
    if (!clock.running) {
      sc.pauseForRun();
      return clock.paused ? clock.resume() : clock.toggle();
    }
    return true;
  }
  // ▶ en LIVE REC : en lecture, il en sort et la lecture continue (le manuel) ; arme a l'arret, la lecture part
  if (dtFace.live()) {
    if (clock.running) {
      liveExit(false);
      lcdMessage.show('LIVE REC OFF · STILL PLAYING', 1400);
      return true;
    }
    sc.pauseForRun();
    return clock.paused ? clock.resume() : clock.toggle();
  }
  if (clock.running) {
    clock.pause();
    lcdMessage.show('PAUSE · PLAY: RESUME · STOP: STEP 1', 1400);
    return false;
  }
  sc.pauseForRun();
  if (clock.paused) return clock.resume();
  return clock.toggle();
}

/* ---------- LIVE REC (V.5.3, 2026-10-30, docs/v4/digitakt-d3b-spec.md) ---------- */

/** Les mains sur ● (● tenue + ▶ : LIVE REC) et celles que ▶ a prises (leur lacher ne fait pas REC). */
const recHolders = new Set<string>();
const recTaken = new Set<string>();
/** ● enfoncee (la face au pointeur, W au clavier). */
export function recDown(src: string): void {
  recHolders.add(src);
}
/** ● lachee ; true si ▶ l'a prise pendant la tenue (son lacher ne fait pas REC). */
export function recUp(src: string): boolean {
  recHolders.delete(src);
  return recTaken.delete(src);
}
export function noDown(src: string): void {
  noHolders.add(src);
  // La face DT2 (V.6.0) : l'appui de NO dans la table des accords (le menu, FUNC + NO, une page puis NO)
  if (DT2_FACE) no60Down(src);
}
/** NO lachee ; true si elle a servi a effacer (son lacher ne fait pas NO). Plus de NO tenue : l'effacement s'arrete (la revue de D3b R8 R15). */
export function noUp(src: string): boolean {
  noHolders.delete(src);
  if (noHolders.size === 0) liveErase.clear();
  const used = noUsed.delete(src);
  if (DT2_FACE) {
    gestureLayer.up('no', src, performance.now());
    if (used) noPress = null;
  }
  return used;
}

/* ---------- la face DT2 (V.6.0) : NO en deux temps (l'appui, le lacher) ---------- */

/** L'appui de NO en cours : un accord l'a-t-il pris (FUNC + NO, une page puis NO), un menu etait-il ouvert. */
let noPress: { taken: boolean; menu: boolean; menuTook: boolean } | null = null;

function no60Down(src: string, stage: Stage | null = null): void {
  resume();
  stageSet(stage);
  stage?.flashFaceKey('no');
  gestureLayer.down('no', src, performance.now());
  const menu = menuOpen();
  const c = dispatch('no', 'press', srcKind(src));
  noPress = { taken: !!c && !menu, menu, menuTook: menu && !!c && menuTakenLast() };
}

/** Le dernier menu a-t-il pris sa saisie (menuInput rend true) ? */
const menuTakenLast = (): boolean => menuLog.length > 0 && menuLog[menuLog.length - 1].taken;

function noRelease60(stage: Stage | null, viaEsc: boolean): boolean {
  const r = noRelease60Body(stage, viaEsc);
  // NO ou Echap relachent les touches gardees (cahier 2.7 ; la relecture : PAGE tapee, puis Echap, puis YES verrouillait
  // FILL) ; une page tapee (page + YES : le hasard) aussi ; les tenues restent
  gestureLayer.dropArmed();
  st.pageArm = null;
  return r;
}

function noRelease60Body(stage: Stage | null, viaEsc: boolean): boolean {
  stageSet(stage);
  // Echap au clavier : un appui et un lacher d'un coup ; FUNC engagee, la chaine d'Echap la relache (comme toujours)
  if (viaEsc) {
    noPress = null;
    if (menuOpen()) {
      // Les menus de B5 agissent sur NO au lacher (frame.ts acting : l'appui est pris sans rien faire) : le lacher dit s'il
      // ferme (l'integration de la V.6.0 ; avant, l'appui pris gardait le menu ouvert)
      menuInput('no', 'down');
      if (!menuInput('no', 'up')) menuSet(null);
      return true;
    }
    if (func.engaged()) {
      // Des mutes prepares (FUNC + TRIG) : Echap les laisse tomber, FUNC se relache sans les appliquer
      dropPrepared();
      return escape();
    }
    // Un potard presse + Echap (le NO du clavier) : sa valeur de depart (cahier 2.7)
    if (knobNo()) return true;
    return noBody(stage, true);
  }
  // Un jumeau, le MIDI : l'appui n'a pas eu lieu, il part maintenant
  if (!noPress) no60Down('at', stage);
  const p = noPress;
  noPress = null;
  gestureLayer.cancel('no');
  if (!p) return false;
  if (p.menu) {
    const b = menuOpen() ? menuInput('no', 'up') : false;
    // NO que le menu ne prend pas au lacher le ferme (YES et NO agissent au lacher, le contrat de B5 : l'appui pris ne
    // retient rien)
    if (!b) menuSet(null);
    return true;
  }
  if (p.taken) return true;
  return !!dispatch('no', 'release', 'mouse');
}

let stopAt = -Infinity;
/**
 * ■ STOP (la face, son jumeau, Maj + Espace, MIDI rytm:stop) : l'arret, retour au pas 1 (la pause oubliee) ; deux fois en
 * moins de DT_GESTURE.stopDoubleMs : l'arret et les queues de la REVERB et du DELAY coupees en fondu court. FUNC + STOP :
 * PASTE.
 */
export function stopKey(stage: Stage | null = null): void {
  if (!DT_FACE) {
    if (clock.running) void runToggle(stage);
    return;
  }
  // La face DT2 (V.6.0) : la table des accords (FUNC + STOP PASTE, TRK + STOP le son, TRIG tenu en PTN le pattern)
  if (DT2_FACE) {
    faceKeyTap('stop', stage);
    return;
  }
  resume();
  stage?.flashFaceKey('stop');
  if (funcTake()) {
    pasteKey();
    return;
  }
  stopBody(stage);
}

/** ■ seule (V.5.0, sans FUNC) : l'arret, deux fois les queues coupees ; LIVE REC s'arrete. */
export function stopBody(stage: Stage | null): void {
  resume();
  stage?.flashFaceKey('stop');
  const t = eventAt();
  const dbl = t - stopAt < DT_GESTURE.stopDoubleMs;
  stopAt = dbl ? -Infinity : t;
  // LIVE REC (V.5.3, le manuel [M1] 10.2.3 : "Press [STOP] to stop both recording and playback")
  if (dtFace.live()) liveExit(false);
  clock.stop();
  // La face DT2 : un FILL d'un cycle s'arrete avec la lecture
  if (DT2_FACE) fill.cancelCycle();
  if (dbl) {
    cutTails();
    lcdMessage.show('STOP · TAILS CUT');
  } else lcdMessage.show('STOP · AGAIN: CUT THE TAILS', 900);
}

/* ---------- COPY, PASTE, CLEAR (FUNC + REC, STOP, PLAY) ---------- */

/** Le presse-papiers (une seule chose) : un pattern entier, ou la ligne d'une voix. */
type Clip =
  | { kind: 'pattern'; from: number; steps: Steps; locks: Locks; scenes: SceneSet; pmutes: readonly Inst[]; trigs: TrigSet }
  | { kind: 'row'; inst: Inst; row: string; locks: Locks[Inst]; trigs: TrigRow | undefined };
let clip: Clip | null = null;

/** FUNC + REC : COPY ; hors REC le pattern (pas, verrous, scenes, mute du pattern), REC allume la ligne de la voix. */
export function copyKey(): void {
  // La face DT2 (V.6.0) : le presse-papiers unique, la rangee de la piste active (16)
  if (DT2_FACE) {
    copy60();
    return;
  }
  const p = pattern.get();
  if (dtFace.rec()) {
    const inst = p.instrument;
    if (!inst) {
      lcdMessage.show(LCD_NO_VOICE);
      return;
    }
    clip = { kind: 'row', inst, row: p.steps[inst], locks: p.locks[inst] ? (JSON.parse(JSON.stringify(p.locks[inst])) as Locks[Inst]) : undefined, trigs: p.trigs[inst] ? { ...p.trigs[inst] } : undefined };
    lcdMessage.show(`${inst} COPIED`);
    return;
  }
  const from = patterns.get().cur;
  clip = { kind: 'pattern', from, steps: { ...p.steps }, locks: JSON.parse(JSON.stringify(p.locks)) as Locks, scenes: pattern.scenes.get(), pmutes: [...p.pmutes], trigs: JSON.parse(JSON.stringify(p.trigs)) as TrigSet };
  lcdMessage.show(`PATTERN ${slotName(from)} COPIED`);
}

/** FUNC + STOP : PASTE ; un pattern copie remplace le pattern courant, une ligne celle de la voix choisie ; une etape d'UNDO. */
export function pasteKey(): void {
  if (DT2_FACE) {
    paste60();
    return;
  }
  if (!clip) {
    lcdMessage.show('NOTHING TO PASTE');
    return;
  }
  undo.boundary('mm808', 'step');
  const p = pattern.get();
  if (clip.kind === 'pattern') {
    pattern.replace(clip.steps, clip.locks);
    pattern.scenes.replace(clip.scenes);
    pattern.setPmutes(clip.pmutes);
    // Ses reglages de trig (V.5.1)
    pattern.setTrigs(clip.trigs);
    lcdMessage.show(`PATTERN ${slotName(clip.from)} PASTED ON ${slotName(patterns.get().cur)}`);
    return;
  }
  const inst = p.instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  pattern.replace({ ...p.steps, [inst]: clip.row }, withRowLocks(p.locks, inst, clip.locks), { keepMore: true });
  // Les reglages de trig de la voix copiee (V.5.1) vont avec sa ligne
  const tr: TrigSet = { ...p.trigs };
  if (clip.trigs) tr[inst] = { ...clip.trigs };
  else delete tr[inst];
  pattern.setTrigs(tr);
  lcdMessage.show(clip.inst === inst ? `${inst} PASTED` : `${clip.inst} PASTED ON ${inst}`);
}

/** Les verrous d'un pattern dont la ligne inst prend ceux-ci (absents : aucun). */
function withRowLocks(all: Readonly<Locks>, inst: Inst, row: Locks[Inst]): Locks {
  const out = JSON.parse(JSON.stringify(all)) as Locks;
  if (row && Object.keys(row).length > 0) out[inst] = JSON.parse(JSON.stringify(row)) as Locks[Inst];
  else delete out[inst];
  return out;
}

/**
 * FUNC + PLAY : CLEAR ; une scene armee se vide (la regle de SCENE + CLEAR) ; hors REC tout le pattern (clearPattern) ;
 * REC allume, la ligne de la voix choisie (ses pas et ses verrous). Une etape d'UNDO.
 */
function dtClear(stage: Stage | null): void {
  // Une scene armee, hors REC, ou un pas en P-LOCK (ses verrous) : la regle de CLEAR de toujours
  if (sceneCtl.get().armed || !dtFace.rec() || lockMode()) {
    clearPattern(stage);
    return;
  }
  // La face DT2 (V.6.0) : la rangee de la piste active (16)
  if (DT2_FACE) {
    clearRow60();
    return;
  }
  const p = pattern.get();
  const inst = p.instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  undo.boundary('mm808', 'step');
  pattern.replace({ ...p.steps, [inst]: '0'.repeat(STEP_COUNT) }, withRowLocks(p.locks, inst, undefined), { keepMore: true });
  // Ses reglages de trig repartent au depart (V.5.1), comme ceux du pattern a CLEAR
  pattern.clearTrigs(inst);
  lcdMessage.show(`${inst} CLEARED`);
}

/** FUNC + PLAY : CLEAR (V.5.0 ; la face DT2 y passe par la table des accords). */
export function clearKey(stage: Stage | null = null): void {
  stage?.pressFaceKey('run');
  dtClear(stage);
}

/* ---------- YES, NO, SAVE, RELOAD ---------- */



/** FUNC + YES : SAVE, le point de sauvegarde en memoire (pas retenu d'une visite a l'autre). */
export function saveKey(): void {
  st.savePoint = { data: JSON.parse(JSON.stringify(capture('mm808'))) as ReturnType<typeof capture>, slot: patterns.get().cur };
  lcdMessage.show(`SAVED ${slotName(st.savePoint.slot)}`);
}

/** FUNC + NO : RELOAD, retour au point de sauvegarde ; une etape d'UNDO. */
export function reloadKey(): void {
  if (!st.savePoint) {
    lcdMessage.show('NOTHING SAVED: FUNC + YES FIRST', 1800);
    return;
  }
  // Le point appartient a son pattern (la revue de D1, G1) : sur un autre emplacement, rien ne se pose
  if (st.savePoint.slot !== patterns.get().cur) {
    lcdMessage.show(`SAVED ON ${slotName(st.savePoint.slot)}`, 1800);
    return;
  }
  undo.boundary('mm808', 'step');
  apply('mm808', JSON.parse(JSON.stringify(st.savePoint.data)) as ReturnType<typeof capture>);
  lcdMessage.show(`RELOADED ${slotName(st.savePoint.slot)}`);
}

/**
 * YES (la face, son jumeau, Entree, MIDI rytm:yes) : dans KIT (les presets), valider (LOAD, OVERWRITE, YES, OK) ; sur la
 * page TEMPO, un TAP ; apres une touche de page (DT_GESTURE.pageArmMs) la page au hasard, TRIG le RANDOM du beat ; sinon
 * l'ecran dit comment. FUNC + YES : SAVE.
 */
export function yesKey(stage: Stage | null = null, armed?: RytmPageId | null): void {
  if (!DT_FACE) return;
  // La face DT2 (V.6.0) : un appui et un lacher de YES dans la table des accords (le menu, FUNC + YES, une page puis YES,
  // PAGE puis YES)
  if (DT2_FACE) {
    faceKeyTap('yes', stage);
    return;
  }
  gesture();
  stage?.flashFaceKey('yes');
  if (funcTake()) {
    saveKey();
    return;
  }
  if (presetMode.on('mm808')) {
    presetKey('mm808', presetMode.get().stage === 'confirm' ? 'del' : 'load');
    return;
  }
  // armed (V.5.1) : la page armee a l'appui de YES (sa tape part au lacher, l'armement a pu finir entre les deux)
  const pg = armed !== undefined ? armed : armedPage();
  if (pg) {
    st.pageArm = null;
    if (pg === 'trig') randomPattern(null);
    else randomPage(pg);
    return;
  }
  if (rytmPage.get().view === 'page' && curScreen() === 'tempo' && editor.get() !== 'mm808') {
    tapTempo();
    return;
  }
  lcdMessage.show('YES: TAP A PAGE KEY FIRST TO RANDOMIZE IT', 2000);
}

/** YES seule sur la face DT2 (V.6.0, au lacher, sans menu ni accord) : les presets d'avant (KIT) la prennent, sinon l'aide. */
export function yesTap(stage: Stage | null = null): void {
  gesture();
  stage?.flashFaceKey('yes');
  if (presetMode.on('mm808')) {
    presetKey('mm808', presetMode.get().stage === 'confirm' ? 'del' : 'load');
    return;
  }
  lcdMessage.show('YES: TAP A PAGE KEY FIRST TO RANDOMIZE IT', 2000);
}

/**
 * FILL en tenant YES (V.5.1, 2026-10-29, docs/v4/digitakt-d2-spec.md section 3) : YES enfonce (la souris, le doigt, Entree)
 * sans menu ouvert (ni KIT, ni la page TEMPO ou YES tape le tempo, ni PTN, ni la liste des sons) et sans FUNC : la touche
 * attend. Lachee avant FILL_HOLD_MS, c'est une tape, YES de D1 (la page armee au hasard, ou l'aide) ; tenue plus longtemps,
 * c'est FILL tant qu'on la tient, jamais le hasard (l'armement de la page s'en va). Avec un menu ou FUNC : YES agit tout de
 * suite, comme en D1. Le MIDI rytm:yes reste la tape de D1 ; rytm:fill tient FILL.
 */
export const FILL_HOLD_MS = 250;
const yesHolds = new Map<string, { timer: number; fill: boolean; done: boolean; now: boolean; pg: RytmPageId | null }>();

/** YES ouvre-t-il quelque chose (KIT, TEMPO, PTN, la liste des sons) : il agit a l'appui, pas de FILL. */
function yesActsNow(): boolean {
  if (func.get().mode !== 'off' || presetMode.on('mm808') || editor.get() === 'mm808' || lcdSamples.isOpen()) return true;
  return rytmPage.get().view === 'page' && curScreen() === 'tempo';
}

/**
 * YES enfonce (src : qui le tient, 'ptr:<id>', 'key'). Un menu ouvert ou FUNC : pas de FILL ; au clavier YES agit a
 * l'appui, au pointeur au lacher sur la touche (la revue de D2, U1 : comme en D1, un glisser hors d'elle annule).
 */
export function yesDown(src: string, stage: Stage | null = null): void {
  if (!DT_FACE || yesHolds.has(src)) return;
  if (DT2_FACE) {
    faceKeyDown('yes', src, stage);
    return;
  }
  if (yesActsNow()) {
    const ptr = src.startsWith('ptr:');
    yesHolds.set(src, { timer: 0, fill: false, done: !ptr, now: ptr, pg: null });
    if (!ptr) yesKey(stage);
    return;
  }
  gesture();
  const h = { timer: 0, fill: false, done: false, now: false, pg: armedPage() };
  h.timer = window.setTimeout(() => {
    h.timer = 0;
    h.fill = true;
    // Jamais le hasard apres une tenue : l'armement de la page s'en va
    st.pageArm = null;
    fill.hold(`yes:${src}`, true);
    lcdMessage.show('FILL: THE FILL TRIGS PLAY WHILE YOU HOLD YES', 1600, true);
  }, FILL_HOLD_MS);
  yesHolds.set(src, h);
  stage?.pressFaceKey('yes');
}

/** YES lache ; tap : un vrai lacher (false : le pointeur perdu, la fenetre sans clavier : rien ne part). */
export function yesUp(src: string, stage: Stage | null = null, tap = true): void {
  if (DT2_FACE) {
    faceKeyUp('yes', src, stage, tap ? performance.now() : -1, tap);
    return;
  }
  const h = yesHolds.get(src);
  if (!h) return;
  yesHolds.delete(src);
  if (h.done) return;
  if (h.now) {
    if (tap) yesKey(stage);
    return;
  }
  if (h.timer) {
    window.clearTimeout(h.timer);
    if (tap) yesKey(stage, h.pg);
    return;
  }
  if (h.fill) fill.hold(`yes:${src}`, false);
}

/** FILL au MIDI (rytm:fill, une cible tenue) : tenu tant que la note l'est. */
export function fillHold(down: boolean, src = 'midi'): void {
  fill.hold(src, down);
}

/**
 * NO (la face, son jumeau, Echap, MIDI rytm:no) : le retour, la chaine d'Echap ; une FUNC verrouillee se relache ; apres une
 * touche de page, cette page rechargee du point de sauvegarde. FUNC + NO (tenue ou gardee pour une touche) : RELOAD.
 */
export function noKey(stage: Stage | null = null, viaEsc = false): boolean {
  if (!DT_FACE) return escape();
  // La face DT2 (V.6.0) : le lacher de NO (le menu ouvert, puis la table des accords)
  if (DT2_FACE) return noRelease60(stage, viaEsc);
  resume();
  stage?.flashFaceKey('no');
  const fm = func.get().mode;
  // Echap au clavier relache FUNC (tenue ou gardee), et revient a la vue d'ensemble au bout de sa chaine, comme toujours
  if (viaEsc && fm !== 'off') return escape();
  if (fm === 'locked') {
    func.cancel();
    lcdMessage.show('FUNC OFF', 700);
    return true;
  }
  if (fm !== 'off') {
    func.use();
    reloadKey();
    return true;
  }
  return noBody(stage, viaEsc);
}

/** NO seule (V.5.0 a V.5.3, sans FUNC) : CONTROL ALL annule, la vue BANK fermee, une page rechargee, la chaine d'Echap. */
export function noBody(stage: Stage | null, viaEsc = false): boolean {
  resume();
  stage?.flashFaceKey('no');
  // NO ou Echap tant que TRK est allumee (V.5.2, CONTROL ALL de la Digitakt ; la revue de D3a, R4) : chaque voix retrouve sa
  // valeur d'avant
  if (ctlAllUndo()) return true;
  // La vue BANK (V.5.2) : NO la ferme
  if (dtFace.bank()) {
    bankViewClose();
    return true;
  }
  // Une page puis NO (la revue de D1, G4) : rechargee seulement par la touche NO (ou rytm:no), avec un point de sauvegarde et
  // rien d'ouvert par-dessus ; un point d'un autre pattern ne s'y pose pas (G1 : reloadPage dit SAVED ON A01) ; sinon, et
  // toujours pour Echap au clavier, la chaine d'Echap
  const pg = viaEsc ? null : armedPage();
  if (pg && st.savePoint && !overlayOpen()) {
    st.pageArm = null;
    reloadPage(pg);
    return true;
  }
  return escape(!viaEsc);
}

/** Quelque chose est-il ouvert que la chaine d'Echap fermerait avant tout (KIT, PTN, la liste des sons, un mode, une page de FX) ? */
function overlayOpen(): boolean {
  const tk = trk.get().mode;
  return (
    section.get() !== null ||
    presetMode.on('mm808') ||
    editor.get() === 'mm808' ||
    lcdSamples.isOpen() ||
    tk === 'latched' ||
    tk === 'closing' ||
    sceneCtl.get().how === 'latched' ||
    rytmLock.active() ||
    dtFace.mute() !== 'off' ||
    dtFace.bank() ||
    voices.get().muteMode ||
    voices.get().soloMode ||
    rytmInfos.isOn() ||
    !!rytmPage.get().detail ||
    hoodOf('mm808').get() === 'open'
  );
}

/* ---------- le mode MUTE (FUNC + TRK) ---------- */

/**
 * FUNC + TRK (V.5.0, la face, MIDI rytm:mutemode) : le mode MUTE global (les pas 1 a 8 sont les voix : vert joue, eteint
 * coupee) ; encore, le mute du pattern (magenta, garde avec le pattern) ; encore, la sortie (les mutes restent).
 */
export function muteModeKey(): void {
  if (!DT_FACE) return;
  resume();
  const m = dtFace.mute();
  // La face DT2 (V.6.0, cahier 3.4, manuel 8.5.3) : FUNC + TRK reprend le dernier mode retenu, encore l'autre, encore la sortie
  const other = (v: Exclude<MuteView, 'off'>): Exclude<MuteView, 'off'> => (v === 'global' ? 'pattern' : 'global');
  let next: MuteView;
  if (DT2_FACE) {
    if (m === 'off') muteEntry = dtFace.lastMute();
    next = m === 'off' ? muteEntry : m === muteEntry ? other(muteEntry) : 'off';
  } else next = m === 'off' ? 'global' : m === 'global' ? 'pattern' : 'off';
  if (next !== 'off') {
    // Les vues gagnent sur les pas une a la fois : TRK et la grille PTN se ferment
    trk.cancel();
    if (editor.get() === 'mm808') editor.close();
  }
  dtFace.setMute(next);
  if (DT2_FACE) {
    const again = next === 'off' ? '' : ` · FUNC + TRK: ${next === muteEntry ? `${other(next).toUpperCase()} MUTE` : 'EXIT'}`;
    lcdMessage.show(next === 'off' ? 'MUTE MODE OFF' : `${next.toUpperCase()} MUTE: TRIG 1-16${again}`, 1600);
    return;
  }
  lcdMessage.show(next === 'global' ? 'GLOBAL MUTE · FUNC + TRK: PATTERN MUTE' : next === 'pattern' ? 'PATTERN MUTE · FUNC + TRK: EXIT' : 'MUTE MODE OFF', 1600);
}
/** Le mode de MUTE ouvert par le premier FUNC + TRK (la face DT2 : le dernier retenu). */
let muteEntry: Exclude<MuteView, 'off'> = 'global';

/** Un pas tenu en mode MUTE (DT_GESTURE.muteHoldMs) : le SOLO de sa voix (blanc), tenu encore la fin du SOLO. */
export function muteStepHold(i: number, stage: Stage | null = null): void {
  // La face DT2 (V.6.0) : les 16 pistes
  if (DT2_FACE) {
    trigSolo(i, stage);
    return;
  }
  const inst = i >= 0 && i < INSTRUMENTS.length ? INSTRUMENTS[i] : null;
  if (!inst || !DT_FACE || dtFace.mute() === 'off') return;
  stage?.pressStep(i);
  voices.toggleSolo(inst);
  lcdMessage.show(voices.get().solo.includes(inst) ? `SOLO ${inst}` : `${inst} SOLO OFF`);
}

/** Le mode MUTE est-il ouvert (les pas sont les voix, la tenue d'un pas est le SOLO) ? */
export const muteView = (): boolean => DT_FACE && dtFace.mute() !== 'off';

/* ---------------- V.6.0 : la face DT2 (?face=dt2), la saisie (lane B4, 2026-11-01) ---------------- */

/*
 * docs/v4/dt2/dt2-master-spec.md 2.7 et 3.1 : une seule entree pour les 25 touches de la face DT2, quelle que soit la main
 * (le pointeur, le doigt, un jumeau, le clavier, le MIDI, le boitier) : faceKeyDown a l'appui, faceKeyUp au lacher (tap :
 * un vrai lacher sur la touche), faceKeyTap pour un appui et un lacher d'un coup. Les modificateurs passent par la couche de
 * gestes (state/gesture.ts), le reste par la table des accords (actions/chords/chords60.ts). Sans le drapeau : rien.
 */

/** Les touches de page de la face DT2 et leur page. */
const PAGE_OF_KEY: Readonly<Partial<Record<Dt2ButtonId, RytmPageId>>> = { trig: 'trig', src: 'voice', fltr: 'fltr', amp: 'env', fx: 'fx', mod: 'mod' };
/** La zone (l'animation de la touche) d'une touche de la face DT2. */
const HOTSPOT_OF_KEY: Readonly<Partial<Record<Dt2ButtonId, string>>> = { ptn: 'pad-edit', play: 'run', open: 'pad-open', trig: 'pkey-trig', src: 'pkey-voice', fltr: 'pkey-fltr', amp: 'pkey-env', fx: 'pkey-fx', mod: 'pkey-mod' };
export const faceKeyHotspot = (id: Dt2ButtonId): string => HOTSPOT_OF_KEY[id] ?? id;

/** YES tenue plus longtemps sans servir (l'ancien FILL) : l'indice FILL: HOLD PAGE. */
const YES_HINT_MS = 500;
const yes60 = new Map<string, { taken: boolean; menu: boolean; timer: number }>();
const settings60 = new Map<string, { taken: boolean; timer: number }>();

function yes60Down(src: string, stage: Stage | null, t: number, touch: boolean): void {
  if (yes60.has(src)) return;
  gesture();
  stage?.pressFaceKey('yes');
  gestureLayer.down('yes', src, t);
  const menu = menuOpen();
  const c = dispatch('yes', 'press', srcKind(src, touch), 0, t);
  const h = { taken: !!c && !menu, menu, timer: 0 };
  if (!c && !menu)
    h.timer = window.setTimeout(() => {
      h.timer = 0;
      if (yes60.get(src) === h && gestureLayer.held('yes') && !gestureLayer.state('yes').used) hint60('fill');
    }, YES_HINT_MS);
  yes60.set(src, h);
}

function yes60Up(src: string, stage: Stage | null, t: number, tap: boolean, touch: boolean): void {
  const h = yes60.get(src);
  if (!h) return;
  yes60.delete(src);
  if (h.timer) window.clearTimeout(h.timer);
  const used = gestureLayer.state('yes').used;
  gestureLayer.up('yes', src, tap ? t : -1);
  stage?.flashFaceKey('yes');
  // Le menu a eu l'appui : il a aussi le lacher ; YES ne reste pas gardee
  if (h.menu) {
    if (menuOpen()) menuInput('yes', 'up');
    gestureLayer.cancel('yes');
    return;
  }
  if (h.taken || used || !tap) return;
  dispatch('yes', 'release', srcKind(src, touch), 0, t);
}

/** Une touche de la face DT2 enfoncee (src : 'ptr:<id>', 'key', 'midi', 'hw', 'at' ; touch : un doigt). */
export function faceKeyDown(id: Dt2ButtonId, src = 'at', stage: Stage | null = null, t = performance.now(), touch = false): void {
  if (!DT2_FACE) return;
  stageSet(stage);
  srcSet(src);
  const sk = srcKind(src, touch);
  const page = PAGE_OF_KEY[id];
  if (page) {
    pageKeyHold(page, true);
    return;
  }
  switch (id) {
    case 'func':
      funcDown(src, t);
      stage?.pressFaceKey('func');
      return;
    case 'trk':
      trkDown(src, t);
      stage?.pressFaceKey('trk');
      return;
    case 'rec':
      recDown(src);
      return;
    case 'yes':
      yes60Down(src, stage, t, touch);
      return;
    case 'no':
      noDown(src);
      return;
    case 'settings': {
      if (settings60.has(src)) return;
      stage?.pressFaceKey('settings');
      const taken = func.engaged() && !!dispatch('settings', 'press', sk, 0, t);
      if (!taken) gestureLayer.down('settings', src, t);
      const h = { taken, timer: 0 };
      if (!taken)
        h.timer = window.setTimeout(() => {
          h.timer = 0;
          if (settings60.get(src) === h && gestureLayer.held('settings')) lcdMessage.show('SETTINGS HELD: TRIG 1-3 LED, TRIG 9 BACKLIGHT', 2000);
        }, 1000);
      settings60.set(src, h);
      return;
    }
    case 'tempo':
    case 'preset':
    case 'random':
    case 'kbd':
    case 'mute':
    case 'solo':
    case 'open':
      gestureLayer.down(id, src, t);
      stage?.pressFaceKey(faceKeyHotspot(id));
      dispatch(id, 'press', sk, 0, t);
      return;
    case 'sounds':
      stage?.pressFaceKey('sounds');
      dispatch('sounds', 'press', sk, 0, t);
      return;
    case 'up':
    case 'down':
    case 'left':
    case 'right':
      stage?.flashFaceKey(id);
      dispatch(id, 'press', sk, 0, t);
      return;
    case 'ptnpage':
      gestureLayer.down('ptnpage', src, t);
      stage?.pressFaceKey('ptnpage');
      dispatch('ptnpage', 'press', sk, 0, t);
      return;
    default:
      // PTN, PLAY, STOP : au lacher (une tape), comme avant
      return;
  }
}

/** Une touche de la face DT2 lachee ; tap : un vrai lacher sur elle (false : un pointeur perdu, glisse ailleurs). */
export function faceKeyUp(id: Dt2ButtonId, src = 'at', stage: Stage | null = null, t = performance.now(), tap = true, touch = false): void {
  if (!DT2_FACE) return;
  stageSet(stage);
  srcSet(src);
  const sk = srcKind(src, touch);
  const page = PAGE_OF_KEY[id];
  if (page) {
    pageKeyHold(page, false);
    if (tap) dispatch(id, 'press', sk, 0, t);
    return;
  }
  switch (id) {
    case 'func':
      funcUp(src, tap ? t : -1);
      return;
    case 'trk':
      trkUp(src, tap ? t : -1);
      return;
    case 'ptn':
    case 'play':
    case 'stop':
      if (tap) dispatch(id, 'press', sk, 0, t);
      return;
    case 'rec': {
      const taken = recUp(src);
      if (tap && !taken) dispatch('rec', 'press', sk, 0, t);
      return;
    }
    case 'yes':
      yes60Up(src, stage, t, tap, touch);
      return;
    case 'no': {
      const used = noUp(src);
      if (tap && !used) noKey(stage);
      return;
    }
    case 'settings': {
      const h = settings60.get(src);
      settings60.delete(src);
      if (!h) return;
      if (h.timer) window.clearTimeout(h.timer);
      if (h.taken) return;
      const s = gestureLayer.state('settings');
      const short = s.mode === 'held' && t - s.since < 1000;
      gestureLayer.up('settings', src, tap ? t : -1);
      if (tap && short && !s.used) dispatch('settings', 'release', sk, 0, t);
      return;
    }
    case 'tempo':
    case 'preset':
    case 'random':
    case 'kbd':
    case 'mute':
    case 'solo':
    case 'open':
      gestureLayer.up(id, src, tap ? t : -1);
      return;
    case 'up':
    case 'down':
    case 'left':
    case 'right':
      dispatch(id, 'release', sk, 0, t);
      return;
    case 'ptnpage': {
      const s = gestureLayer.state('ptnpage');
      const used = s.used;
      gestureLayer.up('ptnpage', src, tap ? t : -1);
      const heldFill = pageFillUp(src);
      if (tap && !heldFill && !used) ptnPageTap();
      return;
    }
    default:
      return;
  }
}

/** Un appui et un lacher d'un coup (un jumeau, une cible MIDI a une note, une touche du clavier sans tenue). */
export function faceKeyTap(id: Dt2ButtonId, stage: Stage | null = null, kind: 'mouse' | 'midi' | 'key' = 'mouse'): void {
  if (!DT2_FACE) return;
  const src = kind === 'mouse' ? 'at' : kind;
  const t = performance.now();
  faceKeyDown(id, src, stage, t);
  faceKeyUp(id, src, stage, t, true);
}

/** LEVEL/DATA tourne de delta crans (vers la droite, vers le bas d'une liste : plus) : le menu ouvert, sinon TRK LEV. */
export function dataTurn(delta: number, src = 'at', stage: Stage | null = null): void {
  if (!DT2_FACE || !Number.isFinite(delta) || delta === 0) return;
  stageSet(stage);
  srcSet(src);
  dispatch('data', 'turn', srcKind(src), Math.round(delta));
  // Le capuchon de LEVEL/DATA tourne avec ses crans (un encodeur sans butee : un tour pour DATA_TURN crans) ; son anneau dit
  // la valeur reglee (la lane B5)
  dataCap = (((dataCap + Math.round(delta) / DATA_TURN) % 1) + 1) % 1;
  const s = stage ?? stageNowFace();
  if (s?.sideKnobs?.setCap('data', dataCap)) s.invalidate();
}
/** Les crans d'un tour du capuchon de LEVEL/DATA, et sa course du moment (0 a 1). */
const DATA_TURN = 48;
let dataCap = 0.5;

/** MAIN VOLUME tourne de delta crans (le jumeau, un MIDI relatif) ; le glisser et la molette passent par l'encodeur level. */
export function mainVolumeTurn(delta: number, src = 'at'): void {
  if (!DT2_FACE || !Number.isFinite(delta) || delta === 0) return;
  srcSet(src);
  dispatch('mvol', 'turn', srcKind(src), delta);
}

/** EDIT GRID (SETTINGS > PATTERN > EDIT GRID, Maj + E) : la grille HTML posee sur les pas, ouverte ou fermee. */
export function editGridToggle(stage: Stage | null = null): void {
  if (!DT2_FACE) return;
  gesture();
  const on = !editor.grid();
  if (on && dtFace.bank()) bankViewClose();
  editor.setGrid(on);
  stage?.pressFaceKey('pad-edit');
  lcdMessage.show(on ? 'EDIT GRID · SHIFT + E: CLOSE' : 'EDIT GRID CLOSED', 1400);
}

/** La piste active (1 a 16) : le MIDI, le boitier, le telephone (la bascule 1-8 / 9-16) la choisissent sans TRK. */
export function trackSelect(k: TrackKey): void {
  if (!DT2_FACE) return;
  resume();
  trackSelect60(k);
}
/** Une piste coupee ou rendue (1 a 16, le mute global) ; trackMuteFlip, pas trackMute : celui de actions/phone.ts (B6) pose un etat. */
export function trackMuteFlip(k: TrackKey): void {
  if (!DT2_FACE) return;
  trackMuteToggle(k);
}
/** La piste active (1 a 16), null : aucune (la face DT2 ; sinon la voix du motif). */
export const activeTrackKey = (): TrackKey | null => activeTrack.get();

/**
 * Un potard A a H clique sans glisser au pointeur (la face DT2, cahier 2.7 ; la relecture de la V.6.0) : un TRIG tenu (le
 * P-LOCK), le verrou de ce reglage s'en va et le clic est pris (true) ; sinon le potard reste presse 1,5 s pour NO (sa
 * valeur de depart) et le clic suit son chemin (la double tape remet aussi a zero).
 */
export function faceKnobPress(k: number): boolean {
  if (!DT2_FACE) return false;
  return knobClick60(k);
}

/** Maj + clic sur un TRIG en mode MUTE (le plugin) : sa piste basculee tant que Maj reste tenue ; true si pris. */
export function stepMuteHold(i: number, stage: Stage | null): boolean {
  if (!DT2_FACE) return false;
  return trigMuteHold(i, stage);
}

/** PERFORM est-il ouvert dans le plugin (les 16 touches de pas sont des pads tenus, state/perform.ts) ? */
export const performPads = (): boolean => IN_PLUGIN && DT2_FACE && dtFace.menu() === 'perform';

/**
 * Un pad de PERFORM (le plugin, 2026-11-12) appuye : l'effet part ; latch (Maj + clic) : il se garde, ou se rend. true si
 * pris (PERFORM ouvert).
 */
export function perfPadDown(i: number, stage: Stage | null, latch = false): boolean {
  if (!performPads() || i < 0 || i >= PERF_PADS.length) return false;
  stage?.pressStep(i);
  const p = PERF_PADS[i];
  if (latch) {
    const kept = perform.latch(i);
    lcdMessage.show(kept ? `● ${p.say} (LOCKED)` : `${p.say}: OFF`, 1400);
    return true;
  }
  perform.down(i);
  lcdMessage.show(`● ${p.say}`, 1200);
  return true;
}

/** Le pad relache : l'effet s'arrete (un pad garde reste). */
export function perfPadUp(i: number): void {
  perform.up(i);
}

/** Maj + clic sur un TRIG (la face DT2, GRID REC, cahier 2.7) : un TRIG tenu de plus (ou de moins) ; true si pris. */
export function stepShiftHold(i: number): boolean {
  if (!DT2_FACE) return false;
  return stepShiftHold60(i);
}

/**
 * Les LED des touches de la face DT2 que la saisie pose (cahier 2.4) : le menu ouvert (PRESET/KIT, SETTINGS, SOUNDS,
 * TEMPO), PERFORM (6.2, eteinte), PAGE et FILL, PTN en vue BANK, KEYBOARD et SONG (eteintes en 6.0) ; l'integration de la
 * V.6.0 y ajoute les 8 LED de page (le pattern fait 16 pas en 6.0 : une page, la page editee pleine) et, un trig tenu en
 * GRID REC, les touches de page qui portent ses verrous (rouges, les autres eteintes ; cahier 3.1). Rend de quoi se
 * desabonner.
 */
export function dt2FaceSync(stage: Stage): () => void {
  const fk = stage.faceKeys;
  if (!DT2_FACE || !fk) return () => undefined;
  const sync = (): void => {
    let ch = fk.setMenu(faceMenuOf(dtFace.menu()));
    if (fk.setPerform(dtFace.menu() === 'perform')) ch = true;
    if (fk.setFill(fill.mode)) ch = true;
    if (fk.setBank(dtFace.bank())) ch = true;
    if (fk.setKeyboard(dtFace.keyboard())) ch = true;
    if (fk.setMuteMode(dtFace.mute() !== 'off')) ch = true;
    if (fk.setSoloMode(dtFace.solo() || voices.soloAll().length > 0)) ch = true;
    if (fk.setPatternPages(pattern.pageCount(), pattern.editPage(), clock.running ? clock.playingPage() : -1)) ch = true;
    const lk = rytmLock.get();
    if (fk.setPageLocks(dtFace.rec() && lk.step >= 0 ? lockPages(lk.step).map((pg) => pg.toLowerCase()) : [])) ch = true;
    // PERSONALIZE (relecture de la V.6.0, la lane ecran) : LED INTENSITY et LED BACKLIGHT sur la lueur de la face
    if (fk.setPersonal(dtFace.personal())) ch = true;
    if (ch) stage.repaint();
  };
  const offs = [dtFace.subscribe(sync), voices.subscribe(sync), fill.subscribe(sync), rytmLock.subscribe(sync), pattern.subscribe(sync), clock.subscribe(sync), clock.onBar(() => sync())];
  sync();
  return () => {
    offs.forEach((o) => o());
    pageFillAll();
  };
}
