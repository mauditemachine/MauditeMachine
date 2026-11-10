/**
 * L'onglet du panneau du capot du plugin MM-ARP (2026-11-10) : TOOLS (DRAG MIDI, DISK, MIDI) ou SOUND+ (les reglages
 * du VST3 seul, SoundPlus.tsx). Garde le temps de la fenetre : OPEN rouvre le dernier onglet, le bouton SOUND+ de la
 * face ouvre le capot sur le sien. Sans dependance, comme disk.ts et midimap.ts.
 */

export type HoodTab = 'tools' | 'sound';

let tab: HoodTab = 'tools';
const listeners = new Set<() => void>();

export const hoodTab = {
  get: (): HoodTab => tab,
  set(next: HoodTab): void {
    if (next === tab) return;
    tab = next;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
