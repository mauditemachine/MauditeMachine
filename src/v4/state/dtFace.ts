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
  readonly song: 'off' | 'mode' | 'edit';
  readonly menu: ScreenMenuId | null;
  readonly ptnPage: number;
}

let state: DtFaceState = { rec: false, mute: 'off', bank: false, live: false };
const listeners = new Set<() => void>();

function set(next: Partial<DtFaceState>): void {
  const n = { ...state, ...next };
  if (n.rec === state.rec && n.mute === state.mute && n.bank === state.bank && n.live === state.live) return;
  state = n;
  listeners.forEach((fn) => fn());
}

export const dtFace = {
  get: (): DtFaceState => state,
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
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
