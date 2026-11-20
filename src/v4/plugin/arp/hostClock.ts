/**
 * v46 : la position du transport pour la tete de lecture de la page DELAY (Mika veut voir les echos tomber sur la mesure
 * d'Ableton, pas sur une horloge a part). Le C++ (PluginEditor.cpp) joint a chaque mm_transport la position en noires
 * (ppq, celle de l'hote ou de l'horloge interne, absente a l'arret) et le tempo (bpm) ; entre deux messages (a chaque
 * note, une fois par seconde au moins), la position avance au tempo depuis la derniere recue.
 *
 * Hors du plugin (la face dans un navigateur) : rien n'arrive, hostBeats() rend null et la page garde sa propre horloge.
 */

interface Anchor {
  ppq: number;
  bpm: number;
  t: number;
}

let anchor: Anchor | null = null;
let started = false;
// le tempo de l'hote (le dernier recu, meme a l'arret) : la page DELAY compte ses temps et ses ms avec lui
let bpmHost: number | null = null;
const listeners = new Set<() => void>();

function onTransport(o: unknown): void {
  const x = o && typeof o === 'object' ? (o as Record<string, unknown>) : {};
  const ppq = typeof x.ppq === 'number' && Number.isFinite(x.ppq) && x.ppq >= 0 ? x.ppq : null;
  const bpm = typeof x.bpm === 'number' && Number.isFinite(x.bpm) && x.bpm > 0 ? x.bpm : 120;
  anchor = ppq === null ? null : { ppq, bpm, t: performance.now() };
  const b = typeof x.bpm === 'number' && Number.isFinite(x.bpm) && x.bpm > 0 ? Math.round(x.bpm * 1000) / 1000 : null;
  if (b !== null && b !== bpmHost) {
    bpmHost = b;
    listeners.forEach((fn) => fn());
  }
}

function start(): void {
  if (started || typeof window === 'undefined') return;
  started = true;
  const be = (window as unknown as { __JUCE__?: { backend?: { addEventListener(id: string, fn: (o: unknown) => void): unknown } } }).__JUCE__?.backend;
  be?.addEventListener('mm_transport', onTransport);
}

/** La position du transport maintenant, en noires depuis le debut du morceau ; null : rien ne joue (ou pas de plugin). */
export function hostBeats(now: number = performance.now()): number | null {
  start();
  const a = anchor;
  // plus rien depuis 2.5 s (le C++ en envoie au moins un par seconde en jeu) : on ne sait plus
  if (!a || now - a.t > 2500) return null;
  return a.ppq + ((now - a.t) / 60000) * a.bpm;
}

/** A appeler au chargement de la page (l'ecoute commence avant la premiere image). */
export const hostClockStart = start;

/** Le tempo de l'hote (le dernier que le plugin a dit), null hors du plugin ; un store pour useSyncExternalStore. */
export const hostTempo = {
  get: (): number | null => bpmHost,
  subscribe(fn: () => void): () => void {
    start();
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
