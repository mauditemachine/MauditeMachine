/**
 * Le MIDI de la pattern qui joue, dans OPEN (2026-11-10, Mika : "j'aime pas trop en dessous DRAG MIDI etc., la barre, je
 * prefere que ce soit dans OPEN ce genre d'information") : ce que le C++ dit du clip (mm_midi_info : le pattern, ses mesures,
 * ses notes) et son dernier message (mm_midi_status), et les gestes que le pont envoie (plugin/bridge.ts les branche).
 * Sans le plugin (le site, un essai dans un navigateur) : rien, les gestes ne font rien.
 */

export interface MidiInfo {
  ok: boolean;
  slot: string;
  bars: number;
  notes: number;
  capped: boolean;
}
export interface MidiStatus {
  ok: boolean;
  msg: string;
  at: number;
}

let info: MidiInfo | null = null;
let status: MidiStatus | null = null;
let snap: { info: MidiInfo | null; status: MidiStatus | null } = { info, status };
const listeners = new Set<() => void>();
const emit = (): void => {
  snap = { info, status };
  listeners.forEach((fn) => fn());
};

export const pluginMidi = {
  get: (): { info: MidiInfo | null; status: MidiStatus | null } => snap,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  setInfo(x: MidiInfo): void {
    info = x;
    emit();
  },
  setStatus(ok: boolean, msg: string): void {
    status = { ok, msg, at: Date.now() };
    emit();
  },
  /** Les gestes, branches par le pont du plugin (null sans lui). */
  drag: null as null | (() => void),
  save: null as null | (() => void),
  request: null as null | (() => void),
};
