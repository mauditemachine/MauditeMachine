/**
 * Les accords de la lane B4 (V.6.0, la saisie et les touches ; 2026-11-01, docs/v4/dt2/dt2-master-spec.md 1.4, 2.7, 3.1,
 * 3.3, 3.4) : chaque geste de la face DT2 (?face=dt2) en une entree (touche, geste, modificateurs, contexte, priorite,
 * action). Le repartiteur (actions/internal/keys60.ts dispatch) lit la table par priorite : le premier accord dont les
 * modificateurs sont engages dans leur ordre et le contexte vrai gagne ; une action qui rend false passe la main.
 *
 * Priorites : 100 le menu ouvert (les fleches, YES, NO, LEVEL/DATA vont a son onInput) ; 95 a 85 les accords a
 * modificateur (SETTINGS, TRK, FUNC, un TRIG tenu, PAGE, YES) ; 80 a 66 les vues (PTN, BANK, MUTE, LIVE REC, GRID REC) ;
 * 0 la touche seule. Les inertes (BIENTOT : V.6.1 ou V.6.2) donnent leur message a la place de l'action. Les fonctions
 * sont appelees au moment du geste (jamais a l'evaluation : la table et les actions s'importent l'une l'autre).
 */

import type { Dt2ButtonId } from '../../rytm/dtFaceIds';
import { func } from '../../state/func';
import { fill } from '../../state/fill';
import type { ModKey } from '../../state/gesture';
import { trk, trkFresh } from '../../state/trk';
import { st } from '../state';
import { lcdMessage } from '../../state/lcdMessage';
import {
  bankView,
  fillCycle,
  fillLatch,
  fillUnlatch,
  hint60,
  liveOpen,
  menuInput,
  menuOpen,
  menuSet,
  menuToggle,
  microTime,
  muteOpen,
  pageArmed,
  pageFillDown,
  pageRandom,
  pageReload,
  ptnBank,
  ptnBankStep,
  ptnHeldSlot,
  ptnSlotOp,
  ptnToggle,
  ptnView,
  recOpen,
  soon,
  srcNow,
  stageNow,
  subPage,
  trackSoundOp,
  trigBank,
  trigHeld,
  trigLockTrig,
  trigMute,
  trigPlay,
  trigQuickMute,
  trigSettings,
  trigTrk,
  trigWrite,
} from '../internal/keys60';
import { tapTempo } from '../internal/transport';
import { dtPageKeyFirst } from '../internal/face';
import { clearKey, copyKey, muteModeKey, noBody, pasteKey, playBody, recBody, reloadKey, saveKey, stopBody, yesTap } from '../face';
import { patternTap } from '../patterns';
import { rytmPageKey } from '../pages';
import { anyDial, anyDialValue } from '../anyDial';
import { levelDataTurn } from '../mixer';
import type { RytmPageId } from '../../rytm/pages';
import type { Chord, ChordKey } from './types';

/** REC, PLAY ou STOP seules : une TRK qui ne sert plus de modificateur (fermee, ou gardee depuis plus de 1,5 s) s'eteint. */
function trkDrop(): void {
  const m = trk.get().mode;
  if ((m === 'latched' || m === 'closing') && !trkFresh()) trk.cancel();
}

/** Une entree, ses chemins par defaut deduits de la touche (le texte pour INFOS et le test d'enumeration). */
function c(e: Omit<Chord, 'version' | 'paths'> & { paths?: Chord['paths']; version?: Chord['version'] }): Chord {
  return { version: '6.0', paths: e.paths ?? pathsOf(e.key, e.mods), ...e };
}

/** La lettre de chaque touche au clavier (cahier 2.7) ; les touches de page n'en ont pas : leur jumeau (Tab, Entree). */
const KEY_OF: Readonly<Partial<Record<ChordKey, string>>> = {
  func: 'Alt',
  trk: 'T',
  ptn: 'E',
  rec: 'W',
  play: 'Space',
  stop: 'Shift + Space',
  yes: 'Enter',
  no: 'Escape',
  preset: 'P',
  settings: 'comma',
  sounds: 'U',
  tempo: 'Y',
  kbd: 'K',
  song: 'N',
  ptnpage: 'G',
  up: 'Shift + Up',
  down: 'Shift + Down',
  left: 'Shift + Left',
  right: 'Shift + Right',
  data: 'its twin: arrows',
  mvol: 'its twin: arrows',
};
const STEP_LETTERS = ['A', 'S', 'D', 'F', 'Z', 'X', 'C', 'V'];
function keyName(k: ChordKey | ModKey): string {
  const s = /^step:([0-9]+)$/.exec(k);
  if (s) {
    const n = Number(s[1]);
    return n <= 8 ? STEP_LETTERS[n - 1] : `Shift + ${STEP_LETTERS[n - 9]}`;
  }
  return KEY_OF[k as ChordKey] ?? `the ${k} key twin (Tab, Enter)`;
}
const label = (k: ChordKey | ModKey): string => (String(k).startsWith('step:') ? `TRIG ${String(k).slice(5)}` : String(k).toUpperCase());
function pathsOf(key: ChordKey, mods: readonly ModKey[]): Chord['paths'] {
  const m = mods.map(label);
  return {
    mouse: [...m.map((x) => `tap ${x}`), `click ${label(key)}`].join(', then '),
    touch: mods.length ? `hold ${m.join(' + ')}, tap ${label(key)}` : `tap ${label(key)}`,
    key: [...mods.map(keyName), keyName(key)].join(' + '),
  };
}

const PAGE_OF: Readonly<Record<'trig' | 'src' | 'fltr' | 'amp' | 'fx' | 'mod', RytmPageId>> = { trig: 'trig', src: 'voice', fltr: 'fltr', amp: 'env', fx: 'fx', mod: 'mod' };
const PAGE_KEYS = Object.keys(PAGE_OF) as (keyof typeof PAGE_OF)[];
const step = (n: number): ChordKey => `step:${n}` as ChordKey;
const STEPS = Array.from({ length: 16 }, (_, i) => i);

/** Les TRIG 1 a 16 : dix accords chacun, dans l'ordre des contextes. */
function trigChords(i: number): Chord[] {
  const k = step(i + 1);
  const info = `step-${i + 1}`;
  return [
    c({ id: `trig${i + 1}.settings`, key: k, gesture: 'press', mods: ['settings'], prio: 95, info, run: () => trigSettings(i, stageNow()) }),
    c({ id: `trig${i + 1}.trk`, key: k, gesture: 'press', mods: ['trk'], prio: 92, info, run: (e) => trigTrk(i, stageNow(), e.t) }),
    c({ id: `trig${i + 1}.func.rec`, key: k, gesture: 'press', mods: ['func'], prio: 90, info, when: () => recOpen() && !ptnView() && !bankView() && !muteOpen(), run: () => trigLockTrig(i, stageNow()) }),
    c({ id: `trig${i + 1}.func`, key: k, gesture: 'press', mods: ['func'], prio: 89, info, run: () => trigQuickMute(i, stageNow()) }),
    c({ id: `trig${i + 1}.bank`, key: k, gesture: 'press', mods: [], prio: 70, info, when: () => bankView(), run: () => trigBank(i, stageNow()) }),
    c({ id: `trig${i + 1}.ptn`, key: k, gesture: 'press', mods: [], prio: 69, info, when: () => ptnView(), run: () => patternTap(i, stageNow()) }),
    c({ id: `trig${i + 1}.mute`, key: k, gesture: 'press', mods: [], prio: 68, info, when: () => muteOpen(), run: () => trigMute(i, stageNow()) }),
    c({ id: `trig${i + 1}.live`, key: k, gesture: 'press', mods: [], prio: 67, info, when: () => liveOpen() && trigHeld() < 0, run: (e) => trigPlay(i, stageNow(), e.t) }),
    c({ id: `trig${i + 1}.rec`, key: k, gesture: 'press', mods: [], prio: 66, info, when: () => recOpen(), run: () => trigWrite(i, stageNow()) }),
    c({ id: `trig${i + 1}`, key: k, gesture: 'press', mods: [], prio: 0, info, run: () => trigPlay(i, stageNow()) }),
  ];
}

/** Les fleches : le menu (appui et lacher), puis leur geste sur l'ecran principal. */
function arrowChords(d: 'up' | 'down' | 'left' | 'right'): Chord[] {
  const lr = d === 'left' || d === 'right';
  const dir = d === 'up' || d === 'left' ? -1 : 1;
  const out: Chord[] = [
    c({ id: `${d}.menu`, key: d, gesture: 'press', mods: [], prio: 100, info: d, when: () => menuOpen(), run: () => void menuInput(d, 'down') }),
    c({ id: `${d}.menu.up`, key: d, gesture: 'release', mods: [], prio: 100, info: d, when: () => menuOpen(), run: () => void menuInput(d, 'up') }),
  ];
  if (lr) {
    out.push(
      // TRIG tenu + LEFT / RIGHT : uTIME (cahier 3.3 ; FUNC tenue aussi : la DT2 les fait tous, en 6.1)
      c({ id: `${d}.trig`, key: d, gesture: 'press', mods: [], prio: 95, info: d, when: () => trigHeld() >= 0, run: () => microTime(dir as -1 | 1) }),
      // FUNC + LEFT / RIGHT : decaler tous les trigs (6.1)
      c({ id: `${d}.func`, key: d, gesture: 'press', mods: ['func'], prio: 90, info: d, version: '6.1', run: () => soon('6.1') }),
      // PTN + LEFT / RIGHT : la banque (cahier 1.4)
      c({ id: `${d}.ptn`, key: d, gesture: 'press', mods: [], prio: 80, info: d, when: () => ptnView() || bankView(), run: () => ptnBankStep(dir as -1 | 1) }),
      c({ id: d, key: d, gesture: 'press', mods: [], prio: 0, info: d, run: () => void 0 }),
    );
  } else {
    out.push(
      // FUNC + UP / DOWN : TRIG MODE (6.1) ; dans un menu, une page de liste (le menu le prend, func: true)
      c({ id: `${d}.func`, key: d, gesture: 'press', mods: ['func'], prio: 90, info: d, version: '6.1', run: () => soon('6.1') }),
      // UP / DOWN : la sous-page d'avant ou d'apres (cahier 3.1)
      c({ id: d, key: d, gesture: 'press', mods: [], prio: 0, info: d, run: () => subPage(dir as -1 | 1) }),
    );
  }
  return out;
}

/** Les touches de page : FUNC + la touche (sa fonction orange), puis la page (le chemin de toujours, sans HOME : B5). */
function pageChords(p: keyof typeof PAGE_OF): Chord[] {
  const pg = PAGE_OF[p];
  const info = `pkey-${pg}`;
  return [
    c({ id: `${p}.func`, key: p, gesture: 'press', mods: ['func'], prio: 90, info, version: p === 'fltr' || p === 'amp' ? '6.1' : '6.0', run: () => dtPageKeyFirst(pg, stageNow()) }),
    c({
      id: p,
      key: p,
      gesture: 'press',
      mods: [],
      prio: 0,
      info,
      run: () => {
        // Une touche de page ferme le menu ouvert et montre sa page (la DT2)
        if (menuOpen()) menuSet(null);
        rytmPageKey(pg, stageNow());
      },
    }),
  ];
}

/** Une touche nouvelle : FUNC + la touche, puis la touche seule. */
function keyChords(k: Dt2ButtonId, info: string, funcRun: () => void, run: () => void, funcV: Chord['version'] = '6.0', v: Chord['version'] = '6.0', g: Chord['gesture'] = 'press'): Chord[] {
  return [
    c({ id: `${k}.func`, key: k, gesture: 'press', mods: ['func'], prio: 90, info, version: funcV, run: funcRun }),
    c({ id: k, key: k, gesture: g, mods: [], prio: 0, info, version: v, run }),
  ];
}

export const CHORDS_60: readonly Chord[] = [
  /* ---------- YES (l'appui, puis le lacher) ---------- */
  c({ id: 'yes.menu', key: 'yes', gesture: 'press', mods: [], prio: 100, info: 'yes', when: () => menuOpen(), run: () => void menuInput('yes', 'down') }),
  c({ id: 'yes.func', key: 'yes', gesture: 'press', mods: ['func'], prio: 90, info: 'yes', run: () => saveKey() }),
  // PAGE puis YES : FILL verrouille (cahier 1.4)
  c({ id: 'yes.ptnpage', key: 'yes', gesture: 'press', mods: ['ptnpage'], prio: 85, info: 'ptnpage', run: () => fillLatch() }),
  // Une touche de page puis YES : la page au hasard (TRIG : l'indice RANDOM BEAT)
  c({ id: 'yes.page', key: 'yes', gesture: 'press', mods: [], prio: 80, info: 'yes', when: () => pageArmed(), run: () => pageRandom() }),
  c({ id: 'yes.menu.up', key: 'yes', gesture: 'release', mods: [], prio: 100, info: 'yes', when: () => menuOpen(), run: () => void menuInput('yes', 'up') }),
  c({ id: 'yes', key: 'yes', gesture: 'release', mods: [], prio: 0, info: 'yes', run: () => yesTap(stageNow()) }),

  /* ---------- NO ---------- */
  c({ id: 'no.menu', key: 'no', gesture: 'press', mods: [], prio: 100, info: 'no', when: () => menuOpen(), run: () => void menuInput('no', 'down') }),
  // FUNC verrouillee (deux tapes) : NO la relache (cahier 2.7) ; tenue ou gardee : RELOAD
  c({
    id: 'no.funcoff',
    key: 'no',
    gesture: 'press',
    mods: ['func'],
    prio: 91,
    info: 'no',
    when: () => func.get().mode === 'locked',
    run: () => {
      func.cancel();
      lcdMessage.show('FUNC OFF', 700);
      return true;
    },
  }),
  c({ id: 'no.func', key: 'no', gesture: 'press', mods: ['func'], prio: 90, info: 'no', run: () => reloadKey() }),
  c({ id: 'no.page', key: 'no', gesture: 'press', mods: [], prio: 80, info: 'no', when: () => pageArmed() && !!st.savePoint, run: () => pageReload() }),
  c({ id: 'no', key: 'no', gesture: 'release', mods: [], prio: 0, info: 'no', run: () => void noBody(stageNow()) }),

  /* ---------- REC, PLAY, STOP ---------- */
  c({ id: 'rec.func', key: 'rec', gesture: 'press', mods: ['func'], prio: 90, info: 'rec', run: () => copyKey() }),
  c({ id: 'play.func', key: 'play', gesture: 'press', mods: ['func'], prio: 90, info: 'run', run: () => clearKey(stageNow()) }),
  c({ id: 'stop.func', key: 'stop', gesture: 'press', mods: ['func'], prio: 90, info: 'stop', run: () => pasteKey() }),
  // TRK + REC / PLAY / STOP : le son de la piste active (cahier 3.2) ; TRK tenue, ou tapee il y a moins de 1,5 s (2.7, la
  // relecture : gardee sans fin, elle prenait PLAY et STOP longtemps apres) ; sinon REC, PLAY et STOP font les leurs
  c({ id: 'rec.trk', key: 'rec', gesture: 'press', mods: ['trk'], prio: 85, info: 'rec', when: () => trkFresh(), run: () => trackSoundOp('copy') }),
  c({ id: 'play.trk', key: 'play', gesture: 'press', mods: ['trk'], prio: 85, info: 'run', when: () => trkFresh(), run: () => trackSoundOp('clear') }),
  c({ id: 'stop.trk', key: 'stop', gesture: 'press', mods: ['trk'], prio: 85, info: 'stop', when: () => trkFresh(), run: () => trackSoundOp('paste') }),
  // Un pattern tenu dans la vue PTN + REC / PLAY / STOP : copier, effacer, coller (cahier 3.3)
  c({ id: 'rec.ptn', key: 'rec', gesture: 'press', mods: [], prio: 80, info: 'rec', when: () => ptnHeldSlot() >= 0, run: () => ptnSlotOp('copy') }),
  c({ id: 'play.ptn', key: 'play', gesture: 'press', mods: [], prio: 80, info: 'run', when: () => ptnHeldSlot() >= 0, run: () => ptnSlotOp('clear') }),
  c({ id: 'stop.ptn', key: 'stop', gesture: 'press', mods: [], prio: 80, info: 'stop', when: () => ptnHeldSlot() >= 0, run: () => ptnSlotOp('paste') }),
  // Seules : une TRK qui ne sert plus (fermee, ou gardee trop tot) s'eteint avec elles
  c({ id: 'rec', key: 'rec', gesture: 'press', mods: [], prio: 0, info: 'rec', run: (e) => (trkDrop(), recBody(stageNow(), e.src === 'mouse')) }),
  c({ id: 'play', key: 'play', gesture: 'press', mods: [], prio: 0, info: 'run', run: () => void (trkDrop(), playBody(stageNow())) }),
  c({ id: 'stop', key: 'stop', gesture: 'press', mods: [], prio: 0, info: 'stop', run: () => (trkDrop(), stopBody(stageNow())) }),

  /* ---------- TRK, PTN ---------- */
  // FUNC + TRK : le mode MUTE (le dernier retenu, cahier 3.4)
  c({ id: 'trk.func', key: 'trk', gesture: 'press', mods: ['func'], prio: 90, info: 'trk', run: () => muteModeKey() }),
  c({ id: 'ptn.func', key: 'ptn', gesture: 'press', mods: ['func'], prio: 90, info: 'pad-edit', run: () => ptnBank(stageNow()) }),
  c({ id: 'ptn', key: 'ptn', gesture: 'press', mods: [], prio: 0, info: 'pad-edit', run: (e) => ptnToggle(stageNow(), e.t) }),

  /* ---------- PAGE et FILL ---------- */
  c({ id: 'ptnpage.func', key: 'ptnpage', gesture: 'press', mods: ['func'], prio: 90, info: 'ptnpage', version: '6.1', run: () => soon('6.1') }),
  // PAGE encore, FILL verrouille : il se leve
  c({ id: 'ptnpage.unlatch', key: 'ptnpage', gesture: 'press', mods: [], prio: 86, info: 'ptnpage', when: () => fill.latched, run: () => fillUnlatch() }),
  // YES puis PAGE : un cycle
  c({ id: 'ptnpage.yes', key: 'ptnpage', gesture: 'press', mods: ['yes'], prio: 85, info: 'ptnpage', run: () => fillCycle() }),
  // PAGE tenue : FILL tant qu'on la tient
  c({ id: 'ptnpage', key: 'ptnpage', gesture: 'press', mods: [], prio: 0, info: 'ptnpage', run: () => pageFillDown(srcNow()) }),

  /* ---------- les touches de menu ---------- */
  ...keyChords(
    'tempo',
    'tempo',
    () => {
      // FUNC + TEMPO : TAP (l'eclair blanc a chaque tape)
      stageNow()?.flashFaceKey('tempo');
      tapTempo();
    },
    () => menuToggle('tempo'),
  ),
  ...keyChords('preset', 'preset', () => soon('6.2'), () => menuToggle('preset'), '6.2'),
  ...keyChords('sounds', 'sounds', () => menuToggle('samples'), () => menuToggle('sounds')),
  // SETTINGS : sa tape (au lacher) ouvre le menu ; tenue 1 s, elle garde pour un TRIG (trig.settings)
  ...keyChords('settings', 'settings', () => soon('6.2'), () => menuToggle('settings'), '6.2', '6.0', 'release'),
  // KEYBOARD et SONG : dessinees, inertes (cahier 5.1)
  ...keyChords('kbd', 'kbd', () => soon('6.1'), () => soon('6.1'), '6.1', '6.1'),
  ...keyChords('song', 'song', () => soon('6.2'), () => soon('6.2'), '6.2', '6.2'),

  /* ---------- les touches de page ---------- */
  ...PAGE_KEYS.flatMap(pageChords),

  /* ---------- les fleches ---------- */
  ...arrowChords('up'),
  ...arrowChords('down'),
  ...arrowChords('left'),
  ...arrowChords('right'),

  /* ---------- LEVEL/DATA et MAIN VOLUME ---------- */
  c({ id: 'data.menu', key: 'data', gesture: 'turn', mods: [], prio: 100, info: 'data', when: () => menuOpen(), run: (e) => void menuInput('data', 'down', e.delta) }),
  c({ id: 'data.func', key: 'data', gesture: 'turn', mods: ['func'], prio: 90, info: 'data', version: '6.2', run: () => soon('6.2') }),
  // LEVEL/DATA hors menu : le TRK LEV de la piste active, par la fiche de B5 (actions/mixer.ts levelDataTurn ; l'integration)
  c({ id: 'data', key: 'data', gesture: 'turn', mods: [], prio: 0, info: 'data', run: (e) => void levelDataTurn(e.delta, false) }),
  c({ id: 'mvol', key: 'mvol', gesture: 'turn', mods: [], prio: 0, info: 'mvol', run: (e) => anyDial('level', Math.max(0, Math.min(1, anyDialValue('level') + e.delta / 127))) }),

  /* ---------- les TRIG 1 a 16 ---------- */
  ...STEPS.flatMap(trigChords),
];

/** Les indices de 1.4 (lus par la sonde) : l'ancien geste, l'indice. */
export const HINT_GESTURES: readonly { old: string; hint: Parameters<typeof hint60>[0] }[] = [
  { old: 'PTN twice', hint: 'kit' },
  { old: 'FUNC + TRIG', hint: 'tempo' },
  { old: 'FUNC + SRC', hint: 'sounds' },
  { old: 'YES held', hint: 'fill' },
  { old: 'FUNC + PTN, then TRIG 1-8', hint: 'banks' },
  { old: 'TRIG, then YES', hint: 'random' },
];
