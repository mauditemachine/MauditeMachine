/**
 * Le menu PRESET/KIT de la face DT2 (V.6.0, lane B5, 2026-11-01, cahier dt2 1.3, 1.4, 3.10 ; inv-dt-ui.md 7.1) : la touche
 * PRESET/KIT. Sa racine : PRESET (le son d'une piste, V.6.2), KIT (la liste d'aujourd'hui, les presets de toute la machine,
 * state/presetMode.ts) et RANDOM BEAT (le beat entier au hasard, l'extra de Mika, rytm:random). Navigation DT2 : UP / DOWN
 * ou LEVEL/DATA, YES entre ou charge, NO revient d'un cran (de la racine, ferme). Dans KIT : RIGHT ouvre le panneau des
 * operations (SAVE TO HERE, RENAME, DELETE) ; LEFT le tri (V.6.2). Les questions de la liste (OVERWRITE ou AS NEW, DELETE?)
 * et l'ecran du nom passent par les memes touches : le nom, UP / DOWN la lettre, LEFT / RIGHT le curseur, YES valide.
 * Plus de touches d'ecran sur la face DT2 (rytm/presetKeys.ts realU suppose la rangee d'avant) : les fleches les remplacent.
 */

import { presetKey, randomPattern } from '../../../actions';
import { trigger } from '../../../audio/drums';
import { TRACK_NAMES, trackIndex, tracks, type KitModel, type SrcMachine, type TrackParamId } from '../../../audio/tracks';
import { lcdMessage } from '../../../state/lcdMessage';
import { PRESET_SLOTS, presetMode, type PresetSlot } from '../../../state/presetMode';
import type { Screen } from '../core';
import { BLACK, HALF, INK } from '../consts';
import { registerScreenMenu, type ScreenMenu } from './registry';
import { DIM_TEXT, acting, paintHint, paintList, paintPanel, paintPopupBox, stepCursor, type MenuRow } from './frame';
import { menuChanged, screenTrack, setOpenMenu } from './open';

const M = 'mm808' as const;
type Level = 'root' | 'kit' | 'ops' | 'sound';
let level: Level = 'root';
let cursor = 1;
let soundCursor = 0;
let opCursor = 0;
let qCursor = 0;
let body = '';

interface TrackSoundPreset {
  name: string;
  tag: string;
  mach: SrcMachine;
  model: KitModel;
  snd: string;
  params: Partial<Record<TrackParamId, number>>;
}

const TRACK_SOUND_PRESETS: readonly TrackSoundPreset[] = [
  { name: '909 PUNCH KICK', tag: 'BD', mach: 'bd', model: '909', snd: 'bd/90-909-Punch.wav', params: { syn: 0.65, slev: 0.85, kdecay: 0.48, kdrive: 0.35, kattack: 0.65 } },
  { name: '808 SUB BOOM', tag: 'BD', mach: 'bd', model: '808', snd: 'bd/91-808-Sub-Boom.wav', params: { syn: 0.75, slev: 0.85, kdecay: 0.68, kdrive: 0.25, kattack: 0.45 } },
  { name: 'WAREHOUSE RUMBLE', tag: 'BD', mach: 'bd', model: '909', snd: 'bd/92-Warehouse-Rumble.wav', params: { syn: 0.5, slev: 0.95, kdecay: 0.55, kdrive: 0.45, reverb: 0.22 } },
  { name: 'HARDGROOVE KICK', tag: 'BD', mach: 'bd', model: '909', snd: 'bd/93-Hardgroove-Drive.wav', params: { syn: 0.6, slev: 0.9, kdecay: 0.42, kdrive: 0.5, kattack: 0.72 } },
  { name: 'INDUSTRIAL SLAM', tag: 'BD', mach: 'bd', model: '909', snd: 'bd/94-Industrial-Slam.wav', params: { syn: 0.55, slev: 0.95, kdecay: 0.54, kdrive: 0.72, drive: 0.35 } },
  { name: 'DEEP HOUSE THUMP', tag: 'BD', mach: 'bd', model: '808', snd: 'bd/95-Deep-House-Thump.wav', params: { syn: 0.5, slev: 0.9, kdecay: 0.44, kdrive: 0.2 } },
  { name: '909 CRISP SNARE', tag: 'SD', mach: 'sd', model: '909', snd: 'sd/90-909-Crisp-Snare.wav', params: { syn: 0.6, slev: 0.85, snappy: 0.68, sddecay: 0.52 } },
  { name: '808 TIGHT SNARE', tag: 'SD', mach: 'sd', model: '808', snd: 'sd/91-808-Tight-Snare.wav', params: { syn: 0.65, slev: 0.8, snappy: 0.55, sddecay: 0.44 } },
  { name: 'LINNDRUM GATED', tag: 'SD', mach: 'sd', model: '909', snd: 'sd/92-Linndrum-Gated.wav', params: { syn: 0.4, slev: 0.95, gate: 1, reverb: 0.3 } },
  { name: 'AMEN BREAK SNARE', tag: 'SD', mach: 'sd', model: '909', snd: 'sd/93-Amen-Break-Snare.wav', params: { syn: 0.35, slev: 0.95, snappy: 0.65, drive: 0.2 } },
  { name: 'UKG RIM SNAP', tag: 'SD', mach: 'sd', model: '808', snd: 'sd/94-UKG-Rim-Snap.wav', params: { syn: 0.3, slev: 0.95, sddecay: 0.35 } },
  { name: 'EBM METAL SNARE', tag: 'SD', mach: 'sd', model: '909', snd: 'sd/95-EBM-Metal-Snare.wav', params: { syn: 0.5, slev: 0.95, gate: 1, drive: 0.35, reverb: 0.25 } },
  { name: '909 CLOSED HAT', tag: 'CH', mach: 'ch', model: '909', snd: 'ch/01-909-Closed-Hat.wav', params: { syn: 0.55, slev: 0.85, sddecay: 0.45 } },
  { name: 'AFRO SHAKER', tag: 'CH', mach: 'ch', model: 'mm', snd: 'ch/04-Afro-Shaker.wav', params: { syn: 0.25, slev: 0.95, sddecay: 0.5 } },
  { name: '909 OPEN HAT', tag: 'OH', mach: 'oh', model: '909', snd: 'oh/90-909-Open-Hat.wav', params: { syn: 0.5, slev: 0.9, sddecay: 0.55 } },
  { name: 'RAVE RIDE BELL', tag: 'OH', mach: 'oh', model: '909', snd: 'oh/92-Rave-Ride-Bell.wav', params: { syn: 0.35, slev: 0.92, reverb: 0.2 } },
  { name: 'DARK DISCO CLAP', tag: 'CP', mach: 'cp', model: '808', snd: 'cp/03-Dark-Disco-Clap.wav', params: { syn: 0.45, slev: 0.9, gate: 1, reverb: 0.28 } },
  { name: 'ACID 303 SQUELCH', tag: 'SYN', mach: 'tom', model: '909', snd: 'tom/03-Acid-303-Squelch.wav', params: { syn: 0.4, slev: 0.95, cutoff: 0.72, res: 0.55, delay: 0.28 } },
  { name: 'REESE SUB BASS', tag: 'SYN', mach: 'tom', model: '808', snd: 'tom/04-Reese-Sub-Bass.wav', params: { syn: 0.5, slev: 0.95, cutoff: 0.48, drive: 0.25 } },
  { name: 'FM DONK BASS', tag: 'SYN', mach: 'tom', model: '808', snd: 'tom/05-Donk-FM-Bass.wav', params: { syn: 0.45, slev: 0.95, sddecay: 0.45 } },
  { name: 'EBM OCTAVE BASS', tag: 'SYN', mach: 'tom', model: '909', snd: 'tom/06-EBM-Octave-Bass.wav', params: { syn: 0.45, slev: 0.95, drive: 0.35 } },
  { name: 'DUB TECHNO CHORD', tag: 'SYN', mach: 'ht', model: 'mm', snd: 'ht/02-Dub-Techno-Chord.wav', params: { syn: 0.25, slev: 0.95, delay: 0.5, reverb: 0.42 } },
  { name: 'DETROIT STAB', tag: 'SYN', mach: 'ht', model: '909', snd: 'ht/03-Detroit-Minor-Stab.wav', params: { syn: 0.3, slev: 0.95, delay: 0.35, reverb: 0.28 } },
  { name: 'RAVE HOOVER STAB', tag: 'SYN', mach: 'ht', model: '909', snd: 'ht/04-Rave-Hoover-Stab.wav', params: { syn: 0.35, slev: 0.92, delay: 0.3, drive: 0.25 } },
  { name: 'ITALO ARP PLUCK', tag: 'SYN', mach: 'ht', model: '808', snd: 'ht/05-Italo-Arp-Pluck.wav', params: { syn: 0.35, slev: 0.92, delay: 0.28 } },
  { name: 'TRANCE SUPERSAW', tag: 'SYN', mach: 'cy', model: 'mm', snd: 'cy/05-Trance-Supersaw.wav', params: { syn: 0.2, slev: 0.95, delay: 0.38, reverb: 0.35 } },
];

const ROOT: readonly MenuRow[] = [
  { label: 'PRESET', sub: true, value: `${TRACK_SOUND_PRESETS.length} SOUNDS` },
  { label: 'KIT', sub: true, value: '24 STYLES' },
  { label: 'RANDOM BEAT', value: 'YES' },
];
/** Le panneau d'operations (RIGHT) : sa ligne et la touche du mode presets qu'elle presse. */
const OPS: readonly { label: string; key: PresetSlot }[] = [
  { label: 'SAVE TO HERE', key: 'save' },
  { label: 'RENAME', key: 'name' },
  { label: 'DELETE', key: 'del' },
];

function enterKit(): void {
  if (!presetMode.on(M)) presetKey(M, 'open');
  level = 'kit';
}

/** Les touches d'une question (OVERWRITE, AS NEW, YES...) : leur place dans PRESET_SLOTS et leur nom. */
function questionKeys(): { slot: PresetSlot; label: string }[] {
  const v = presetMode.view(M);
  if (!v) return [];
  return v.keys.map((label, i) => ({ slot: PRESET_SLOTS[i], label })).filter((k) => k.label && k.slot !== 'exit');
}

function applyTrackPreset(idx: number): void {
  const p = TRACK_SOUND_PRESETS[idx];
  if (!p) return;
  const tk = screenTrack() ?? 'BD';
  const tName = TRACK_NAMES[trackIndex(tk)] ?? tk;
  tracks.machine(tk, p.mach, p.model);
  tracks.sample(tk, p.snd);
  tracks.setMany(tk, p.params);
  trigger(tk, undefined, false, undefined, 0.85);
  lcdMessage.show(`${tName}: ${p.name} (${p.model.toUpperCase()} + SMP)`, 1500);
}

function paint(screen: Screen): number {
  if (level === 'sound') {
    const tk = screenTrack() ?? 'BD';
    const tName = TRACK_NAMES[trackIndex(tk)] ?? tk;
    const rows: MenuRow[] = TRACK_SOUND_PRESETS.map((p) => ({
      label: p.name,
      value: `${tName} ${p.tag}`,
    }));
    const sc = Math.max(0, Math.min(Math.max(0, rows.length - 5), soundCursor - 2));
    body = paintList(screen, rows, soundCursor, sc);
    paintHint(screen, 'UP/DOWN: SOUND   YES: LOAD ON TRK   NO: BACK');
    return 0;
  }
  // Demande de Mika (2026-11-02) : quand on clic sur preset on arrive directement sur la liste de tous les presets
  if (!presetMode.on(M) || level === 'root') enterKit();
  const v = presetMode.view(M);
  if (!v) return 0;
  // La liste : la ligne d'avant, le curseur en grand, celle d'apres ; le rang et le titre
  screen.text(v.title, 8, 36, 8, HALF, 700, 'left', 0.6);
  screen.text(`${v.group ? `${v.group}  ` : ''}${v.count}`, 312, 36, 8, HALF, 700, 'right', 0.5);
  if (v.prev) screen.text(screen.fitText(v.prev, 296, 10, 0.4, 600), 12, 62, 10, DIM_TEXT, 600, 'left', 0.4);
  screen.roundRect(4, 72, 306, 30, 4, INK);
  const mark = v.mark === 'edited' ? ' *' : v.mark === 'loaded' ? '  (LOADED)' : '';
  screen.text(screen.fitText(`${v.empty ? 'NO PRESETS' : v.name}${mark}`, 290, 15, 0.4, 600), 12, 92.5, 15, BLACK, 600, 'left', 0.4);
  if (v.next) screen.text(screen.fitText(v.next, 296, 10, 0.4, 600), 12, 122, 10, DIM_TEXT, 600, 'left', 0.4);
  body = `${v.stage}|${v.prev}|>${v.name}${mark}|${v.next}|${v.count}`;
  if (v.stage === 'name' && v.naming) {
    const n = v.naming;
    body += `|NAME ${n.text}@${n.at}`;
    paintPopupBox(screen, [n.kind === 'new' ? 'SAVE AS' : 'RENAME', ' ', n.problem || ' '], 'UP/DOWN: LETTER  L/R: MOVE  YES: SAVE  NO: BACK');
    body += `|CURSOR ${paintName(screen, n.text, n.at)}`;
  } else if (v.stage !== 'browse') {
    const ks = questionKeys();
    qCursor = Math.min(qCursor, Math.max(0, ks.length - 1));
    body += `|Q ${paintPanel(screen, 'right', 'CONFIRM', ks.map((k) => ({ label: k.label })), qCursor)}`;
  } else if (level === 'ops') {
    body += `|${paintPanel(screen, 'right', 'OPERATIONS', OPS.map((o) => ({ label: o.label })), opCursor)}`;
  }
  paintHint(screen, level === 'ops' ? 'UP/DOWN: CHOOSE   YES: DO IT   NO: BACK' : 'UP/DOWN: PRESET   YES: LOAD   RIGHT: OPERATIONS   NO: BACK');
  return 0;
}

/**
 * Le nom en cours dans la fenetre SAVE AS ou RENAME (la deuxieme ligne du cadre des pop-ups, frame.ts paintPopupBox) : le
 * caractere du curseur en negatif (relecture de la V.6.0 : on ne voyait pas quelle lettre UP / DOWN change ; comme les cases
 * du RENAME de SETTINGS). Rend le nom avec le curseur entre crochets (les sondes).
 */
const NAME_Y = 62 + 18 + 15;
const NAME_SIZE = 11;
function paintName(screen: Screen, text: string, at: number): string {
  const chars = [...text];
  const a = Math.max(0, Math.min(Math.max(0, chars.length - 1), at));
  // Une case par caractere, de la largeur du plus large (le curseur ne fait rien bouger) ; les cases vides de l'utilisateur
  // (avant la barre) soulignees, comme le nom de la liste (____/DEEP KICK)
  const cell = screen.textWidth('W', NAME_SIZE, 600) + 0.6;
  const user = Math.max(0, text.indexOf('/'));
  let cx = 160 - (cell * chars.length) / 2;
  chars.forEach((ch, i) => {
    if (i === a) screen.roundRect(cx, NAME_Y - NAME_SIZE + 1, cell, NAME_SIZE + 3.2, 1.6, INK);
    if (ch !== ' ') screen.text(ch, cx + cell / 2, NAME_Y, NAME_SIZE, i === a ? BLACK : INK, 600, 'center');
    else if (i !== a && i < user) screen.line([cx + 1.5, NAME_Y + 1, cx + cell - 1.5, NAME_Y + 1], HALF, 0.8);
    cx += cell;
  });
  return `${chars.slice(0, a).join('')}[${chars[a] ?? ' '}]${chars.slice(a + 1).join('')}`;
}

function input(i: Parameters<NonNullable<ScreenMenu['onInput']>>[0]): boolean {
  if (!acting(i)) return true;
  const dir = i.kind === 'up' ? -1 : i.kind === 'down' ? 1 : i.kind === 'data' ? Math.sign(i.delta ?? 0) : 0;
  if (level === 'sound') {
    if (dir) soundCursor = stepCursor(soundCursor, TRACK_SOUND_PRESETS.length, dir, false);
    else if (i.kind === 'yes') applyTrackPreset(soundCursor);
    else if (i.kind === 'no' || i.kind === 'left') level = 'root';
    menuChanged();
    return true;
  }
  // La racine
  if (level === 'root' || !presetMode.on(M)) {
    level = 'root';
    if (dir) cursor = stepCursor(cursor, ROOT.length, dir, false);
    else if (i.kind === 'yes' || i.kind === 'right') {
      if (cursor === 0) level = 'sound';
      else if (cursor === 1) enterKit();
      else if (i.kind === 'yes') randomPattern(null);
    } else if (i.kind === 'no') return false;
    menuChanged();
    return true;
  }
  const v = presetMode.view(M);
  if (!v) return true;
  // L'ecran du nom : UP / DOWN la lettre (le potard A d'avant), LEFT / RIGHT le curseur (B), YES valide, NO revient
  if (v.stage === 'name') {
    if (i.kind === 'up' || i.kind === 'down') presetMode.turn(M, 0, i.kind === 'up' ? 1 : -1);
    else if (i.kind === 'data') presetMode.turn(M, 0, Math.round(i.delta ?? 0));
    else if (i.kind === 'left' || i.kind === 'right') presetMode.turn(M, 1, i.kind === 'right' ? 1 : -1);
    else if (i.kind === 'yes') presetMode.nameOk(M);
    else if (i.kind === 'no') presetMode.back();
    menuChanged();
    return true;
  }
  // Une question (OVERWRITE ou AS NEW, DELETE?) : ses touches en panneau
  if (v.stage !== 'browse') {
    const ks = questionKeys();
    if (dir) qCursor = stepCursor(qCursor, ks.length, dir, false);
    else if (i.kind === 'yes' && ks[qCursor]) presetKey(M, ks[qCursor].slot);
    else if (i.kind === 'no') presetMode.back();
    menuChanged();
    return true;
  }
  if (level === 'ops') {
    if (dir) opCursor = stepCursor(opCursor, OPS.length, dir, false);
    else if (i.kind === 'yes') {
      level = 'kit';
      qCursor = 0;
      presetKey(M, OPS[opCursor].key);
    } else if (i.kind === 'no' || i.kind === 'left') level = 'kit';
    menuChanged();
    return true;
  }
  // La liste
  if (i.kind === 'up' || i.kind === 'down') {
    const n = i.func ? 8 : 1;
    for (let k = 0; k < n; k += 1) presetKey(M, i.kind === 'up' ? 'prev' : 'next');
  } else if (i.kind === 'data') presetMode.step(M, Math.round(i.delta ?? 0), true);
  else if (i.kind === 'yes') presetKey(M, 'load');
  else if (i.kind === 'right') {
    level = 'ops';
    opCursor = 0;
  } else if (i.kind === 'left') lcdMessage.show('SORT, FILTER, SEARCH: BIENTOT V.6.2', 1400);
  else if (i.kind === 'no') {
    presetMode.close();
    setOpenMenu(null);
  }
  menuChanged();
  return true;
}

function menu(id: 'preset' | 'kit'): ScreenMenu {
  return {
    id,
    owner: 'B5',
    title: () => (level === 'sound' ? 'TRACK PRESET' : 'PRESETS'),
    paint: (screen) => paint(screen),
    onOpen() {
      opCursor = 0;
      qCursor = 0;
      enterKit();
    },
    onClose() {
      if (presetMode.on(M)) presetMode.close();
      level = 'kit';
    },
    info: () => `${level}|${body}`,
    onInput: input,
  };
}

registerScreenMenu(menu('preset'));
registerScreenMenu(menu('kit'));
