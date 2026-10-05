/**
 * Les noms des commandes du MM-DECKS (2026-10-05, sortis de dj/Twins.tsx) :
 * ceux que lisent les lecteurs d'ecran, et ceux du panneau MIDI.
 */

import { DJ_FX_LABEL } from './theme';
import type { DjFaderSpec, DjKeySpec, DjKnobSpec } from './layout';

/** Ce qui entre sur chaque voie de la table. */
const CH = ['MM-RYTM', 'MM-ARP', 'deck A', 'deck B', 'deck C', 'deck D'] as const;

export function knobName(k: DjKnobSpec): string {
  const t = k.target;
  if (t.kind === 'eq') return `Channel ${t.ch + 1} (${CH[t.ch]}) ${k.label === 'HI' || k.label === 'MID' || k.label === 'LOW' ? `EQ ${k.label}` : k.label}`;
  if (t.kind === 'vol') return `Channel ${t.ch + 1} (${CH[t.ch]}) volume`;
  if (t.kind === 'fx') return `Effect ${DJ_FX_LABEL[t.fx]}`;
  if (t.kind === 'fxto') return 'Effects to: all channels, or one channel';
  return 'Master volume';
}

export function faderName(f: DjFaderSpec): string {
  const t = f.target;
  if (t.kind === 'channel') return `Channel ${t.ch + 1} (${CH[t.ch]}) fader`;
  return `Deck ${t.deck.toUpperCase()} pitch`;
}

export function keyName(k: DjKeySpec): string {
  const t = k.target;
  switch (t.kind) {
    case 'hotcue':
      return `Deck ${t.deck.toUpperCase()} hot cue ${t.n + 1}`;
    case 'bend':
      return `Deck ${t.deck.toUpperCase()} bend ${t.dir < 0 ? 'slower' : 'faster'} (hold)`;
    case 'cue':
      return `Deck ${t.deck.toUpperCase()} cue (hold to preview)`;
    case 'play':
      return `Deck ${t.deck.toUpperCase()} play or pause`;
    case 'time':
      return `Effects time ${k.label} beat${t.d === 1 ? '' : 's'}`;
    case 'tempo':
      return `Deck ${t.deck.toUpperCase()} pitch ${t.dir < 0 ? 'down' : 'up'} 0.1 BPM (hold to repeat)`;
    case 'sync':
      return `Deck ${t.deck.toUpperCase()} sync: match the tempo you hear`;
    case 'loop':
      return `Deck ${t.deck.toUpperCase()} loop ${t.beats} beat${t.beats === 1 ? '' : 's'} (press again to exit)`;
    case 'removedeck':
      return `Remove deck ${t.deck.toUpperCase()} (while it plays: press twice)`;
    case 'machines':
      return 'Play or stop the MM-RYTM and the MM-ARP together, key G';
    case 'export':
      return 'Export the loop to the MM-SMPL and edit it there, key T';
    case 'adddeck':
      return 'Add a deck, with its channel on the mixer';
  }
}

