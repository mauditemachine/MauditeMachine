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
import { DT_FACE, DT_GESTURE, LCD_NO_VOICE, PAD_DOUBLE_TAP_MS, type Inst } from '../theme';
import { st } from './state';
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
import { curScreen } from './kit';
import { lockMode } from './locks';
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
}

/* ---------- REC, le mode ecriture ---------- */

/**
 * ● REC (la face, son jumeau, W au clavier, MIDI rytm:rec) : le mode ecriture des pas ; FUNC + REC : COPY. mouse : une tape
 * de la souris sur la face (seule a faire LIVE REC par un double appui).
 */
export function recKey(stage: Stage | null = null, mouse = false): void {
  if (!DT_FACE) return;
  resume();
  stage?.pressFaceKey('rec');
  if (funcTake()) {
    copyKey();
    return;
  }
  // ● tapee deux fois vite a la souris (V.5.3, la souris ne tient pas deux touches) : LIVE REC ; seulement si la premiere
  // tape a allume REC depuis REC eteint (la revue de D3b R5 : jamais en sortant de LIVE REC, ni par W ou le MIDI)
  const t = eventAt();
  const dbl = mouse && t - st.recTapAt < PAD_DOUBLE_TAP_MS && dtFace.rec() && !dtFace.live();
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
  if (on && mouse) st.recTapAt = t;
  st.recHinted = false;
  // REC eteint : plus rien ne s'ecrit, le P-LOCK en cours s'en va aussi (la revue de D1, G10)
  if (!on) rytmLock.leave();
  lcdMessage.show(on ? '● REC: TAP STEPS TO WRITE, HOLD: P-LOCK' : 'REC OFF: STEPS 1-8 PLAY THE VOICES', 1600);
}

/* ---------- PLAY, STOP ---------- */

/**
 * ▶ PLAY (la face, son jumeau, Espace, MIDI rytm:play) : a l'arret, la lecture du pas 1 ; en lecture, la pause (sa LED
 * clignote) ; en pause, la reprise au pas de la pause. Une piste SoundCloud qui joue passe en pause, comme RUN. FUNC +
 * PLAY : CLEAR. Le telephone : RUN/STOP, comme avant.
 */
export function playKey(stage: Stage | null = null): boolean {
  if (!DT_FACE) return runToggle(stage);
  gesture();
  if (funcTake()) {
    stage?.pressFaceKey('run');
    dtClear(stage);
    return clock.running;
  }
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
}
/** NO lachee ; true si elle a servi a effacer (son lacher ne fait pas NO). Plus de NO tenue : l'effacement s'arrete (la revue de D3b R8 R15). */
export function noUp(src: string): boolean {
  noHolders.delete(src);
  if (noHolders.size === 0) liveErase.clear();
  return noUsed.delete(src);
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
  resume();
  stage?.flashFaceKey('stop');
  if (funcTake()) {
    pasteKey();
    return;
  }
  const t = eventAt();
  const dbl = t - stopAt < DT_GESTURE.stopDoubleMs;
  stopAt = dbl ? -Infinity : t;
  // LIVE REC (V.5.3, le manuel [M1] 10.2.3 : "Press [STOP] to stop both recording and playback")
  if (dtFace.live()) liveExit(false);
  clock.stop();
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
  pattern.replace({ ...p.steps, [inst]: clip.row }, withRowLocks(p.locks, inst, clip.locks));
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
  const p = pattern.get();
  const inst = p.instrument;
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  undo.boundary('mm808', 'step');
  pattern.replace({ ...p.steps, [inst]: '0'.repeat(STEP_COUNT) }, withRowLocks(p.locks, inst, undefined));
  // Ses reglages de trig repartent au depart (V.5.1), comme ceux du pattern a CLEAR
  pattern.clearTrigs(inst);
  lcdMessage.show(`${inst} CLEARED`);
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
  const next: MuteView = m === 'off' ? 'global' : m === 'global' ? 'pattern' : 'off';
  if (next !== 'off') {
    // Les vues gagnent sur les pas une a la fois : TRK et la grille PTN se ferment
    trk.cancel();
    if (editor.get() === 'mm808') editor.close();
  }
  dtFace.setMute(next);
  lcdMessage.show(next === 'global' ? 'GLOBAL MUTE · FUNC + TRK: PATTERN MUTE' : next === 'pattern' ? 'PATTERN MUTE · FUNC + TRK: EXIT' : 'MUTE MODE OFF', 1600);
}

/** Un pas tenu en mode MUTE (DT_GESTURE.muteHoldMs) : le SOLO de sa voix (blanc), tenu encore la fin du SOLO. */
export function muteStepHold(i: number, stage: Stage | null = null): void {
  const inst = i >= 0 && i < INSTRUMENTS.length ? INSTRUMENTS[i] : null;
  if (!inst || !DT_FACE || dtFace.mute() === 'off') return;
  stage?.pressStep(i);
  voices.toggleSolo(inst);
  lcdMessage.show(voices.get().solo.includes(inst) ? `SOLO ${inst}` : `${inst} SOLO OFF`);
}

/** Le mode MUTE est-il ouvert (les pas sont les voix, la tenue d'un pas est le SOLO) ? */
export const muteView = (): boolean => DT_FACE && dtFace.mute() !== 'off';
