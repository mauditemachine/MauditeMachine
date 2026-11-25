/**
 * Les presets sur le disque du plugin MM-ARP (2026-11-09, Mika : "enregistrer un preset sur mon disque dur en le nommant,
 * et le rouvrir") : l'etat de la face seulement (la liste du dossier, le nom en cours, le dernier SAVE). Le pont
 * (plugin/arp/bridge.ts) parle au C++ ; le panneau du capot (HoodPanel.tsx, DiskPresets.tsx) montre et demande. Sans
 * dependance, comme midimap.ts.
 *
 * Un preset sur le disque : le format du site (state/presets.ts capture('voy') : knobs, seq, prog), marque
 *   { format: 'mm-arp-preset', v: 1, name, user?, at, knobs, seq, prog }
 */

export const DISK_FORMAT = 'mm-arp-preset';
/** Le nom d'un preset sur le disque : 1 a 24 caracteres, aux regles des noms du site (state/presetName.ts typeChars). */
export const DISK_NAME_MAX = 24;

export interface DiskItem {
  name: string;
  path: string;
}

export interface DiskState {
  /** la liste du dossier de presets (mm_presets) ; null tant qu'elle n'est pas arrivee */
  items: readonly DiskItem[] | null;
  /** le nom en cours (le dialogue de SAVE TO DISK) ; null : ferme */
  naming: string | null;
  /** le chemin du dernier preset ouvert ou garde (la ligne allumee de la liste) */
  current: string | null;
}

let state: DiskState = { items: null, naming: null, current: null };
const listeners = new Set<() => void>();

export const arpDisk = {
  get: (): DiskState => state,
  set(next: Partial<DiskState>): void {
    state = { ...state, ...next };
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
