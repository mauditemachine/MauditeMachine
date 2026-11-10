/**
 * La page du panneau du capot du plugin MM-ARP (2026-11-10) : SOUND+ (les reglages du VST3 seul, SoundPlus.tsx),
 * LIBRARY (la banque d'usine du VST3, Library.tsx) ou TOOLS (CLIP, DISK, MIDI). Garde le temps de la fenetre : OPEN
 * rouvre la derniere page. Sans dependance, comme disk.ts et midimap.ts.
 */

export type HoodTab = 'tools' | 'sound' | 'library';

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
