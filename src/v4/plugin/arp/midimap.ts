/**
 * Le capot du plugin MM-ARP (2026-11-09, Mika : "quand je clique sur OPEN je dois voir l'interieur ... et la doit y avoir le
 * DRAG MIDI et la gestion MIDI") : l'etat de la face pour DRAG MIDI et MIDI LEARN. Le pont (plugin/arp/bridge.ts) parle au
 * C++ ; le panneau du capot (HoodPanel.tsx) montre et demande. Sans dependance, comme disk.ts.
 *
 * MIDI LEARN : LEARN allume le mode ; un clic sur un potard (de la face ou de la carte) l'arme (mm_learn { id }) ; le C++
 * assigne le prochain CC recu et renvoie la table (mm_midimap { items, learn }). LEARN ou Echap eteint le mode
 * (mm_learn { id: '' }).
 */

export interface MidiMapItem {
  cc: number;
  /** le canal, de 1 a 16 (tel que le C++ l'envoie) */
  ch: number;
  /** l'id du parametre (un potard de voyager/params.ts, ou arp, master, prio) */
  id: string;
}

export interface ArpMidiState {
  /** la table des CC (mm_midimap) ; null tant qu'elle n'est pas arrivee */
  items: readonly MidiMapItem[] | null;
  /** le mode LEARN est allume (la face) */
  learning: boolean;
  /** le potard arme, qui attend son CC ('' : aucun) ; le C++ fait foi (mm_midimap learn) */
  armed: string;
  /** DRAG MIDI : le nombre de passages de la progression (x1, x2, x4) */
  cycles: 1 | 2 | 4;
  /** le dernier message de DRAG MIDI ou SAVE .MID (mm_drag_status), le temps de le lire */
  status: { ok: boolean; msg: string } | null;
}

let state: ArpMidiState = { items: null, learning: false, armed: '', cycles: 1, status: null };
const listeners = new Set<() => void>();

export const arpMidi = {
  get: (): ArpMidiState => state,
  set(next: Partial<ArpMidiState>): void {
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
