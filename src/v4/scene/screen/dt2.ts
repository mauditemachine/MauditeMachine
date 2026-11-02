/**
 * L'ecran de la face DT2 (V.6.0, lane B5, 2026-11-01, docs/v4/dt2/dt2-master-spec.md 2.5 ; inv-dt-ui.md 4.1) : le gabarit de
 * la Digitakt II sur le dessin 5:3 de Mika (320 x 192 unites, noir et os, les corps d'aujourd'hui).
 * - l'en-tete (y 0..20) : la case inversee du pattern (A01, elle clignote quand un pattern attend), le nom (le titre de la
 *   page ou du menu ; un message passager a sa place ; en MUTE, l'apercu des 16 pistes), les pastilles (FILL, CTRL ALL,
 *   LIVE REC, P-LOCK, BANK), l'icone du TRIG MODE, le metronome et le tempo au dixieme ;
 * - la colonne gauche (x 0..44) : le type de son (SMP en ONESHOT, SYN une machine de synthese ; MIX, TMP, QNT... sur les
 *   pages de FUNC), le numero de la piste en grand, le nom court du son, le fader vertical LEV (TRK LEV) ;
 * - la grille des 8 parametres (x 48..302, y 24..190) : le bloc k au-dessus du potard k (les cases de consts.ts MATRIX) ;
 * - l'indicateur des sous-pages (x 306..318, y 24..170), le i en bas a droite ;
 * - un menu plein ecran (x 0..320, y 22..192, l'en-tete garde) : le registre (menus/registry.ts) ; un menu qui a des
 *   potards (TEMPO, QUANTIZE, MIXER, SCENES) se dessine comme une page, sa colonne gauche et sa grille.
 * HOME n'existe plus sur cette face (cahier 1.3) : la vue PAGE tout le temps. Des fonctions (screen en premier argument),
 * pas des methodes : ce fichier n'importe Screen que par son type (aucun cycle a l'evaluation).
 */

import { clock } from '../../audio/clock';
import { pattern } from '../../audio/pattern';
import { TRACK_KEYS, tracks, trackIndex, type TrackKey } from '../../audio/tracks';
import { sampleByKey } from '../../audio/samples';
import { curScreen, curSlots } from '../../actions';
import { ctlAllState } from '../../state/trk';
import { dtFace } from '../../state/dtFace';
import { fill } from '../../state/fill';
import { lcdMessage } from '../../state/lcdMessage';
import { lcdSamples } from '../../state/lcdSamples';
import { patterns, slotName } from '../../state/patterns';
import { presetMode } from '../../state/presetMode';
import { rytmLock } from '../../state/rytmLock';
import { rytmPage } from '../../state/rytmPage';
import { tempoSync } from '../../state/tempoSync';
import { voices } from '../../state/voices';
import { SCREEN_PAGE, SCREEN_TITLE, cellsOf, screensOf, type PageSlot } from '../../rytm/pages';
import { slotBlock, type BlockMode } from '../../rytm/pageView';
import { type LcdState } from '../../state/lcd';
import { BLACK, cellRect, FAINT, FAINT_TEXT, FRAME, HALF, INK, METER_MS, pmutesNow } from './consts';
import type { Screen } from './core';
import { openMenu, screenTrack } from './menus/open';
import { screenMenu, type ScreenMenu } from './menus/registry';
import { patternName } from './menus/names';
import { DIM_TEXT } from './menus/frame';

/** Les zones du gabarit (unites, cahier 2.5). */
export const DT2 = {
  head: { y1: 20, box: [2, 40], name: [46, 188], pills: [190, 246], mode: [250, 264], bpm: [268, 318] },
  left: { x0: 0, x1: 44, y0: 22, y1: 192 },
  grid: { x0: 48, x1: 302, y0: 24, y1: 190 },
  dots: { x: 312, y0: 24, y1: 170 },
  menu: { x0: 0, x1: 320, y0: 22, y1: 192 },
  pop: { x0: 50, x1: 270, y0: 40, y1: 160 },
} as const;

/** Le clignotement d'un pattern en attente (la case A01) : la demi-periode, en ms. */
const WAIT_BLINK_MS = 300;

/** Ce que l'ecran DT2 dessine (les sondes, le jumeau) : l'en-tete, la colonne gauche, les points, le menu. */
export interface Dt2Info {
  menu: string;
  head: string;
  left: string;
  dots: string;
  body: string;
}
export const DT2_INFO_EMPTY: Dt2Info = { menu: '', head: '', left: '', dots: '', body: '' };

/** Le type de son d'une piste (la colonne gauche) : SMP le sample seul (ONESHOT), SYN une machine de synthese. */
export function trackTag(t: TrackKey | null): string {
  if (!t) return '--';
  return tracks.of(t).mach === 'oneshot' ? 'SMP' : 'SYN';
}

/** Le nom court du son d'une piste : son sample, sinon sa machine (KICK 909), OFF pour une piste vide. */
export function trackSoundName(t: TrackKey | null): string {
  if (!t) return '';
  const tr = tracks.of(t);
  const smp = tr.snd ? sampleByKey(tr.snd)?.label ?? (tr.snd.split('/').pop() ?? '').replace(/\.[a-z0-9]+$/i, '').toUpperCase() : '';
  if (tr.mach === 'oneshot') return smp || 'OFF';
  return smp && tr.p.slev > 0 && tr.p.syn <= 0 ? smp : `${tr.mach.toUpperCase()} ${tr.model.toUpperCase()}`;
}

/** Le tag de la colonne gauche d'une page de FUNC ou d'un menu a potards. */
const PAGE_TAG: Readonly<Partial<Record<string, string>>> = { sendfx: 'FX', mixer: 'MIX', tempo: 'TMP' };
const MENU_TAG: Readonly<Partial<Record<string, string>>> = { tempo: 'TMP', quantize: 'QNT', mixer: 'MIX', scenes: 'MIX' };

/**
 * L'image entiere de la face DT2 (hors EDIT, que core.ts garde) : rend dans combien de ms il faut une autre image.
 */
export function paintDt2(screen: Screen, s: LcdState, now: number): number {
  const ptn = patterns.get();
  const rp = rytmPage.get();
  const inst = pattern.get().instrument;
  const t = screenTrack();
  const lockStep = rytmLock.get().step;
  let next = 0;
  // Le menu ouvert ; les presets et la liste des sons ouverts par un autre chemin (le MIDI, le clavier) en sont aussi
  let menu: ScreenMenu | null = openMenu();
  if (!menu && presetMode.on('mm808')) menu = screenMenu('preset') ?? null;
  if (!menu && lcdSamples.isOpen()) menu = screenMenu('sounds') ?? null;
  const sc = curScreen();
  const title = menu ? (menu.title?.() ?? menu.id.toUpperCase()) : SCREEN_TITLE[sc];
  const headMore = paintHead(screen, title, ptn.cur, ptn.next >= 0, lockStep, now);
  if (headMore > 0) next = next > 0 ? Math.min(next, headMore) : headMore;
  const info = { ...DT2_INFO_EMPTY, menu: menu ? menu.id : '' };
  const slots = menu ? (menu.slots?.() ?? null) : curSlots();
  if (slots) {
    info.left = paintLeft(screen, t, menu ? (MENU_TAG[menu.id] ?? menu.id.slice(0, 3).toUpperCase()) : (PAGE_TAG[SCREEN_PAGE[sc]] ?? trackTag(t)));
    const more = paintGrid(screen, slots, inst, t, menu ? null : lockStep, now);
    if (more > 0) next = next > 0 ? Math.min(next, more) : more;
    const pg = menu ? (menu.pages?.() ?? null) : { n: screensOf(rp.page, inst).length, cur: Math.max(0, screensOf(rp.page, inst).indexOf(sc)) };
    info.dots = pg ? paintDots(screen, pg.n, pg.cur) : '';
  }
  if (menu) {
    const m = menu.paint(screen, { state: s, now });
    if (m > 0) next = next > 0 ? Math.min(next, m) : m;
    info.body = menu.info?.() ?? '';
  }
  info.head = screen.info.head;
  screen.info.dt2 = info;
  return next;
}

/* ---------------- l'en-tete ---------------- */

/** L'en-tete DT2 : la case du pattern, le nom ou le message, les pastilles, le TRIG MODE, le tempo ; rend l'image suivante. */
function paintHead(screen: Screen, title: string, cur: number, waiting: boolean, lockStep: number, now: number): number {
  const H = DT2.head;
  const blinkOff = waiting && Math.floor(now / WAIT_BLINK_MS) % 2 === 1;
  // La case inversee A01 (pleine ; en attente d'un autre pattern, elle clignote entre plein et contour)
  const slot = slotName(cur);
  const bw = H.box[1] - H.box[0];
  screen.roundRect(H.box[0], 3, bw, 14, 2.5, blinkOff ? null : INK, blinkOff ? INK : null, 0.9);
  screen.text(slot, H.box[0] + bw / 2, 14, 10.5, blinkOff ? INK : BLACK, 700, 'center', 0.4);
  // Le nom : un message passager (2 s, l'indice d'un geste) a la place du nom ; en MUTE, l'apercu des 16 pistes
  const msg = lcdMessage.get(now);
  const nw = H.name[1] - H.name[0];
  let name = '';
  const mute = dtFace.mute();
  // Des mutes prepares (FUNC tenue ou verrouillee + TRIG, cahier 3.4) : l'apercu des 16 pistes passe avant le message, le +
  // et le X disent ce qui partira au relacher de FUNC (le QUICK MUTE hors du mode MUTE compris)
  const prep = dtFace.prepared();
  if (prep.size > 0) {
    name = paintMutePreview(screen, H.name[0], mute !== 'off' ? mute : ([...prep.values()][0] ?? 'global'), prep);
  } else if (msg && msg.text) {
    name = screen.fitText(msg.text, nw, 8.6, 0.3, 600);
    screen.text(name, H.name[0], 13.5, 8.6, INK, 600, 'left', 0.3);
  } else if (mute !== 'off') {
    name = paintMutePreview(screen, H.name[0], mute);
  } else {
    const own = patternName(cur);
    name = screen.fitText(own ? `${own}  ${title}` : title, nw, 10, 0.4, 600);
    screen.text(name, H.name[0], 14, 10, own ? INK : HALF, 600, 'left', 0.4);
  }
  // Les pastilles : ce qui est engage, dans l'ordre de la DT2, autant qu'il en tient
  const pills: string[] = [];
  if (fill.on) pills.push('FILL');
  if (ctlAllState.get()) pills.push('CTRL');
  if (dtFace.live()) pills.push('LIVE');
  if (lockStep >= 0) pills.push('LOCK');
  if (dtFace.bank()) pills.push('BANK');
  let px = H.pills[0];
  const drawn: string[] = [];
  for (const p of pills) {
    const w = screen.textWidth(p, 6, 700, 0.5) + 6;
    if (px + w > H.pills[1]) break;
    screen.pill(px, 5, w, 10, INK);
    screen.text(p, px + w / 2, 12.5, 6, BLACK, 700, 'center', 0.5);
    px += w + 2;
    drawn.push(p);
  }
  // Le TRIG MODE : TRACKS (trois traits, la DT2) ; les autres modes arrivent en V.6.1
  for (let i = 0; i < 3; i += 1) screen.line([H.mode[0] + 1, 6.5 + i * 3.5, H.mode[1] - 1, 6.5 + i * 3.5], HALF, 1.1);
  // Le metronome et le tempo au dixieme (SYNC quand il suit les platines)
  const bpm = pattern.get().bpm;
  const raw = tempoSync.text(bpm);
  const bt = raw.includes('.') ? raw : `${raw}.0`;
  screen.line([H.bpm[0] + 1, 16, H.bpm[0] + 4.5, 4.5, H.bpm[0] + 8, 16, H.bpm[0] + 1, 16], clock.running ? INK : HALF, 1);
  screen.line([H.bpm[0] + 4.5, 13.5, H.bpm[0] + 7.5, 7], clock.running ? INK : HALF, 1);
  screen.text(bt, H.bpm[1], 14, 10.5, INK, 400, 'right');
  screen.line([0, 20.5, 320, 20.5], FAINT, 0.6);
  screen.info.head = `${blinkOff ? '[A]' : ''}${slot}|${name}|${drawn.join(' ')}|TRACKS|${bt}`;
  return waiting ? WAIT_BLINK_MS - (now % WAIT_BLINK_MS) + 1 : msg ? Math.max(60, msg.until - now + 1) : 0;
}

/**
 * L'apercu des 16 pistes en MUTE (cahier 2.5) : un carre = joue, un trait = coupee ; rend son texte (o, -). Les mutes
 * prepares (cahier 3.4, la relecture de la V.6.0 : dtFace.prepared, la saisie les prepare) : un X sur une piste qui se coupera
 * au relacher de FUNC, un + sur une piste qui reviendra (x, +), chacune dans son mode (global, ou le pattern pour 1 a 8).
 */
function paintMutePreview(screen: Screen, x0: number, mute: 'global' | 'pattern', prep: ReadonlyMap<TrackKey, 'global' | 'pattern'> = NO_PREP): string {
  const pm = pmutesNow();
  let out = mute === 'global' ? 'G ' : 'P ';
  screen.text(mute === 'global' ? 'GLB' : 'PTN', x0, 13.5, 7, HALF, 700, 'left', 0.4);
  for (let i = 0; i < 16; i += 1) {
    const x = x0 + 22 + i * 7.6;
    // Les 16 pistes (l'integration de la V.6.0) : le mute global sur 16 (state/voices.ts hiMuted), celui du pattern sur 1 a 8
    const key = TRACK_KEYS[i];
    const pmode = prep.get(key);
    const off = (pmode ?? mute) === 'global' ? voices.isMuted(key) : (pm as readonly string[]).includes(key);
    if (pmode) {
      // Preparee : X (elle se coupera) ou + (elle reviendra), un peu plus grands que le carre
      if (off) {
        screen.line([x + 2.5, 6.6, x + 2.5, 13.4], INK, 1.3);
        screen.line([x - 0.9, 10, x + 5.9, 10], INK, 1.3);
      } else {
        screen.line([x - 0.3, 7.2, x + 5.3, 12.8], INK, 1.3);
        screen.line([x - 0.3, 12.8, x + 5.3, 7.2], INK, 1.3);
      }
      out += off ? '+' : 'x';
      continue;
    }
    if (off) screen.line([x, 10, x + 5, 10], INK, 1.2);
    else screen.roundRect(x, 7.5, 5, 5, 0.8, INK);
    out += off ? '-' : 'o';
  }
  return out;
}

const NO_PREP: ReadonlyMap<TrackKey, 'global' | 'pattern'> = new Map();

/* ---------------- la colonne gauche ---------------- */

/** La colonne gauche : le type, le numero de la piste, le nom de son son, son fader LEV (TRK LEV) ; rend son texte. */
function paintLeft(screen: Screen, t: TrackKey | null, tag: string): string {
  const cx = 22;
  screen.roundRect(3.5, 24.5, 37, 34, 3, null, FRAME, 0.8);
  screen.text(tag, cx, 33.5, 7, HALF, 700, 'center', 0.6);
  const num = t ? String(trackIndex(t) + 1) : '--';
  screen.text(num, cx, 54, 19, t ? INK : DIM_TEXT, 300, 'center');
  const name = screen.fitText(trackSoundName(t), 40, 6.2, 0.2, 600);
  screen.text(name, cx, 69, 6.2, HALF, 600, 'center', 0.2);
  // Le fader LEV : son echelle pointillee, sa course pleine, son repere
  const y0 = 78;
  const y1 = 172;
  const lev = t ? tracks.param(t, 'tlev') : 0;
  for (let y = y0; y <= y1; y += 7.8) screen.line([cx - 9, y, cx - 6, y], FAINT, 0.7);
  screen.roundRect(cx - 3, y0, 6, y1 - y0, 2, null, FRAME, 0.8);
  const top = y1 - (y1 - y0) * Math.max(0, Math.min(1, lev));
  if (t) {
    screen.roundRect(cx - 3, top, 6, y1 - top, 2, HALF);
    screen.line([cx - 6, top, cx + 6, top], INK, 1.4);
  }
  screen.text('LEV', cx, 184, 6.5, HALF, 700, 'center', 0.6);
  return `${tag}|${num}|${name}|LEV ${t ? Math.round(lev * 127) : '--'}`;
}

/* ---------------- la grille ---------------- */

/** Les 8 blocs (une page ou un menu a potards) dans les cases de la grille DT2 ; rend l'image suivante (echo, aiguille). */
function paintGrid(screen: Screen, slots: readonly PageSlot[], inst: ReturnType<typeof pattern.get>['instrument'], track: TrackKey | null, lockStep: number | null, now: number): number {
  let next = 0;
  screen.meterLive = false;
  const rp = rytmPage.get();
  const sc = curScreen();
  // Les verrous (P-LOCK, le flash du pas qui joue) : ceux de la piste active, T9 a T16 compris (relecture de la V.6.0 ;
  // inst, la voix du motif, est nulle sur ces pistes)
  const mode: BlockMode | null = lockStep === null ? null : screen.blockMode(track, lockStep, now);
  const echoK = rp.echo && rp.echo.page === sc && now < rp.echo.until ? rp.echo.k : -1;
  const cells = cellsOf(slots);
  const blocks = slots.map((slot, k) => slotBlock(slot, k, inst, k === echoK || k === rp.held, mode, cells[k], k === rp.hover));
  screen.paintMatrix(blocks, inst, mode);
  screen.blockRects = [];
  for (const b of blocks) if (b.state !== 'empty' && !b.graph) screen.blockRects.push({ k: b.k, ...screen.spot(cellRect(b.cell)) });
  const ik = screen.infoKnob();
  if (ik >= 0 && blocks[ik] && blocks[ik].state !== 'empty') screen.infoMarks(blocks[ik].cell, ik);
  const panel = mode && mode.kind !== 'scene' ? screen.paintLockPanel(slots, mode.step, mode.kind === 'flash' ? mode.lock : undefined) : null;
  screen.paintGhosts(slots, panel);
  screen.info.blocks = blocks.map((b) => `${b.label}=${b.text}:${b.state}${b.lock !== 'none' ? `/${b.lock}` : ''}${b.flash ? '!' : ''}${b.quiet ? '~' : ''}`);
  screen.info.flash = blocks.filter((b) => b.flash).map((b) => b.k);
  screen.info.cells = blocks.map((b) => `${b.cell.c},${b.cell.r},${b.cell.w},${b.cell.h}`);
  screen.info.screen = sc;
  const echo = blocks.find((b) => b.echo);
  if (echo) screen.info.echo = echo.k;
  screen.info.hover = rp.hover;
  if (echo && rp.echo && rp.echo.page === sc && now < rp.echo.until) next = Math.max(1, rp.echo.until - now + 1);
  if (screen.meterLive) next = next > 0 ? Math.min(next, METER_MS) : METER_MS;
  // La lecture qui montre les verrous du pas (le flash) : la tete de lecture redessine
  if (mode && mode.kind === 'flash' && clock.running) next = next > 0 ? Math.min(next, 60) : 60;
  return next;
}

/* ---------------- l'indicateur des sous-pages ---------------- */

/** Un point par sous-page, plein celle affichee (x 306..318) ; rend 1/2, 2/2... ('' une seule). */
function paintDots(screen: Screen, n: number, cur: number): string {
  if (n <= 1) return '';
  const D = DT2.dots;
  for (let i = 0; i < n; i += 1) {
    const y = D.y0 + 6 + i * 9;
    if (y > D.y1) break;
    if (i === cur) screen.circle(D.x, y, 2.2, INK);
    else screen.circle(D.x, y, 2, null, FAINT_TEXT, 0.8);
  }
  return `${cur + 1}/${n}`;
}
