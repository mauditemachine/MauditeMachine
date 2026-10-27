/**
 * Le tempo des machines suit les platines (2026-10-27, Mika : "je voudrais un bouton sync qui fait que c'est sync avec
 * le bpm des cdj quand ces derniers sont sync aussi") : le SYNC du MIXER (dj/actions.ts) pose ici le BPM qu'il fait
 * suivre au MM-RYTM (et donc au MM-ARP), ou null quand il ne suit rien. Hors du code du MM-DECKS, charge a part :
 * l'ecran du MM-RYTM le lit (TEMPO 124.0 SYNC, scene/screen.ts) sans le charger.
 */

let bpm: number | null = null;
const listeners = new Set<() => void>();

export const tempoSync = {
  /** Le BPM suivi (celui de la platine MASTER, au double ou a la moitie s'il le faut), ou null. */
  get: (): number | null => bpm,
  set(b: number | null): void {
    const next = b !== null && Number.isFinite(b) ? b : null;
    if (next === bpm) return;
    bpm = next;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Le nombre du TEMPO a l'ecran : au BPM entier, au dixieme quand il suit les platines (124.0). */
  text: (b: number): string => (bpm !== null ? b.toFixed(1) : String(Math.round(b))),
  /** L'unite a cote : BPM, ou SYNC quand il suit les platines. */
  unit: (): string => (bpm !== null ? 'SYNC' : 'BPM'),
  /**
   * Le TEMPO tel qu'il se lit partout ailleurs (2026-10-27, revue UI-5 : la lecture du potard, son jumeau, la ligne de
   * l'ecran au telephone disaient 124.37 BPM pendant que l'en-tete disait 124.4 SYNC) : 124.4 SYNC, ou 124 BPM.
   */
  label: (b: number): string => `${tempoSync.text(b)} ${tempoSync.unit()}`,
};
