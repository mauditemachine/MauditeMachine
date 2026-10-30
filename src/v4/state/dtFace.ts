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

export type MuteView = 'off' | 'global' | 'pattern';

export interface DtFaceState {
  readonly rec: boolean;
  readonly mute: MuteView;
  readonly bank: boolean;
  readonly live: boolean;
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
