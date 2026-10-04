/**
 * Les dessins des formes d'onde du MM-ARP (2026-10-03) : une polyligne dans
 * une boite [-1, 1] x [-1, 1] (y vers le bas). Les memes sur la machine
 * (silk.ts, autour des selecteurs WAVE 1 et WAVE 2) et dans le Dock du
 * telephone (ui/VoyDock.tsx). FM n'a pas de dessin : il s'ecrit.
 */

export type WavePoints = readonly (readonly [number, number])[];

const SINE: WavePoints = Array.from({ length: 25 }, (_, i) => {
  const u = -1 + i / 12;
  return [u, -Math.sin(Math.PI * u)] as const;
});

const POINTS: Readonly<Record<string, WavePoints>> = {
  SINE,
  TRI: [[-1, 1], [-0.5, -1], [0, 1], [0.5, -1], [1, 1]],
  SAW: [[-1, 1], [0, -1], [0, 1], [1, -1], [1, 1]],
  SQUARE: [[-1, 1], [-1, -1], [0, -1], [0, 1], [1, 1], [1, -1]],
  PULSE: [[-1, 1], [-0.6, 1], [-0.6, -1], [-0.35, -1], [-0.35, 1], [0.4, 1], [0.4, -1], [0.65, -1], [0.65, 1], [1, 1]],
};

/** Les points d'une forme, ou null (FM : un texte). */
export const wavePoints = (name: string): WavePoints | null => POINTS[name] ?? null;
