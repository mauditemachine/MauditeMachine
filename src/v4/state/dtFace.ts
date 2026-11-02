/**
 * L'etat de la face facon Digitakt (V.5.0, 2026-10-29, l'etape D1, docs/v4/digitakt-d1-spec.md section 3) qui n'a pas
 * d'autre maison :
 * - rec : le mode ecriture des pas (REC, sa LED rouge). Hors REC, au desktop, un pas 1 a 8 joue sa voix et la choisit
 *   (TRK SELECT NORMAL de la Digitakt II), rien ne s'ecrit ; REC allume, les pas se posent et se retirent. Garde pendant
 *   la visite seulement, jamais retenu : eteint au chargement ;
 * - mute : le mode MUTE de FUNC + TRK, global (les mutes de la machine, state/voices.ts) ou du pattern (les siens, gardes
 *   avec lui, audio/pattern.ts pmutes) ; les pas 1 a 8 sont les voix (vert ou magenta : joue, eteint : coupee, blanc : en
 *   solo). Encore FUNC + TRK, NO ou Echap : sortie, les mutes restent.
 * - bank : la vue BANK de FUNC + PTN (V.5.2) : les pas 1 a 8 sont les banques A a H ; PTN, NO ou Echap la ferment.
 * - live : LIVE REC (V.5.3, ● tenue + ▶, ou ● deux fois) : les pas 1 a 8 jouent les voix et s'ecrivent en lecture ; REC
 *   reste allume (sa LED clignote).
 * Pur, sans minuteur.
 */

import type { ScreenMenuId } from '../scene/screen/menus/registry';
import type { TrackKey } from '../audio/tracks';

export type MuteView = 'off' | 'global' | 'pattern';

export interface DtFaceState {
  readonly rec: boolean;
  readonly mute: MuteView;
  readonly bank: boolean;
  readonly live: boolean;
}

/**
 * La forme etendue de l'etat de la face (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0, contrat sans comportement) :
 * ce que V.6.0 (B4) et V.6.1 (C2, C4) ajoutent a DtFaceState, noms figes. Le store ci-dessous ne la porte pas encore :
 * rien ne change en P0.
 * - keyboard : le mode KEYBOARD (la touche KEYBOARD allumee, V.6.1) ;
 * - song : SONG (off, le mode SONG, SONG EDIT ; V.6.2) ;
 * - menu : le menu plein ecran ouvert (scene/screen/menus/registry.ts ScreenMenuId), null : aucun ;
 * - ptnPage : la page du pattern editee (0 a 7, les 8 LED de page ; 0 tant que le pattern fait 16 pas) ;
 * - live : LIVE REC (deja la, V.5.3).
 */
export interface DtFaceStateDt2 extends DtFaceState {
  readonly keyboard: boolean;
  readonly menu: ScreenMenuId | null;
  readonly ptnPage: number;
}

/**
 * V.6.0 (2026-11-01, la lane B4) : le store porte la forme etendue. Ses champs neufs ne bougent que sur la face DT2
 * (?face=dt2, actions/face.ts) : sans le drapeau ils restent a leur depart (false, 'off', null, 0) et la V.5.3 ne les lit
 * pas. Le dernier mode de MUTE (cahier 3.4, manuel 8.5.3 : FUNC + TRK et le QUICK MUTE le reprennent) et les reglages
 * PERSONALIZE de 6.0 que la face lit (cahier 3.1 et 3.11 : l'intensite des LED, le retroeclairage, TRK SELECT) vivent a
 * cote, hors du contrat.
 */
export type LedIntensity = 'low' | 'mid' | 'max';
/**
 * TRK SELECT (PERSONALIZE, manuel DT2 14.7.9 ; l'integration de la V.6.0 prend les quatre modes du menu de B5) : ce que fait
 * un TRIG hors REC. normal : il joue sa piste et la choisit (le comportement d'avant) ; silent : il la choisit sans la
 * jouer ; manual : il la joue sans la choisir ; inverted : il la choisit sans la jouer, et TRK + TRIG la joue sans la
 * choisir. Les reglages vivent dans le menu SETTINGS (scene/screen/menus/settings.ts personalize, garde dans le
 * navigateur), qui les pose ici ; SETTINGS tenu + TRIG les change ici, le menu les reprend.
 */
export type TrkSelect = 'normal' | 'silent' | 'manual' | 'inverted';
export interface DtPersonal {
  readonly led: LedIntensity;
  readonly backlight: boolean;
  readonly trkSelect: TrkSelect;
}

const INIT: DtFaceStateDt2 = { rec: false, mute: 'off', bank: false, live: false, keyboard: false, menu: null, ptnPage: 0 };
let state: DtFaceStateDt2 = INIT;
let lastMute: Exclude<MuteView, 'off'> = 'global';
let prepared: ReadonlyMap<TrackKey, Exclude<MuteView, 'off'>> = new Map();
let personal: DtPersonal = { led: 'max', backlight: true, trkSelect: 'normal' };
const listeners = new Set<() => void>();

function set(next: Partial<DtFaceStateDt2>): void {
  const n = { ...state, ...next };
  if (
    n.rec === state.rec &&
    n.mute === state.mute &&
    n.bank === state.bank &&
    n.live === state.live &&
    n.keyboard === state.keyboard &&
    n.menu === state.menu &&
    n.ptnPage === state.ptnPage
  )
    return;
  if (n.mute !== 'off') lastMute = n.mute;
  state = n;
  listeners.forEach((fn) => fn());
}

export const dtFace = {
  get: (): DtFaceStateDt2 => state,
  rec: (): boolean => state.rec,
  setRec(on: boolean): void {
    set({ rec: on });
  },
  mute: (): MuteView => state.mute,
  setMute(m: MuteView): void {
    set({ mute: m });
  },
  bank: (): boolean => state.bank,
  live: (): boolean => state.live,
  setLive(on: boolean): void {
    set({ live: on });
  },
  setBank(on: boolean): void {
    set({ bank: on });
  },
  /* ---------- V.6.0, la face DT2 ---------- */
  /** le menu plein ecran ouvert (scene/screen/menus/registry.ts), null : aucun */
  menu: (): ScreenMenuId | null => state.menu,
  setMenu(m: ScreenMenuId | null): void {
    set({ menu: m });
  },
  keyboard: (): boolean => state.keyboard,
  setKeyboard(on: boolean): void {
    set({ keyboard: on });
  },
  ptnPage: (): number => state.ptnPage,
  setPtnPage(p: number): void {
    set({ ptnPage: Math.max(0, Math.min(7, Math.round(p))) });
  },
  /** le dernier mode de MUTE montre (global au depart) : FUNC + TRK et le QUICK MUTE le reprennent */
  lastMute: (): Exclude<MuteView, 'off'> => lastMute,
  /**
   * Les mutes prepares (V.6.0, la relecture ; cahier 3.4 : FUNC tenue + TRIG, appliques au relacher de FUNC) : chaque piste
   * et le mode ou sa bascule partira (global, ou le pattern pour 1 a 8). L'ecran peut les montrer (+ et X de l'apercu).
   */
  prepared: (): ReadonlyMap<TrackKey, Exclude<MuteView, 'off'>> => prepared,
  /** Une piste preparee, ou retiree de la preparation si elle y etait (rend true si elle y est maintenant). */
  prepareToggle(k: TrackKey, mode: Exclude<MuteView, 'off'>): boolean {
    const next = new Map(prepared);
    const on = !next.has(k);
    if (on) next.set(k, mode);
    else next.delete(k);
    prepared = next;
    listeners.forEach((fn) => fn());
    return on;
  },
  /** La preparation prise (pour l'appliquer) et videe. */
  takePrepared(): ReadonlyMap<TrackKey, Exclude<MuteView, 'off'>> {
    const out = prepared;
    if (out.size === 0) return out;
    prepared = new Map();
    listeners.forEach((fn) => fn());
    return out;
  },
  /** PERSONALIZE (6.0) : l'intensite des LED, le retroeclairage, TRK SELECT */
  personal: (): DtPersonal => personal,
  setPersonal(patch: Partial<DtPersonal>): void {
    const n = { ...personal, ...patch };
    if (n.led === personal.led && n.backlight === personal.backlight && n.trkSelect === personal.trkSelect) return;
    personal = n;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
