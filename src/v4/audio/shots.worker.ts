/**
 * Le calcul des one-shots hors du fil principal (2026-10-03) : la cymbale
 * prend 55 ms sur un ordinateur, bien plus sur un telephone ; ici, la scene
 * 3D ne saute aucune image. Recoit une commande, renvoie les canaux
 * (transferes, sans copie) ; audio/shots.ts en fait des AudioBuffer.
 */

import { renderShot, type ShotId } from './shotsdsp';

interface Job {
  key: string;
  id: ShotId;
  sr: number;
  ts: number;
  v: number;
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Job>) => void) | null;
  postMessage(m: unknown, transfer: Transferable[]): void;
};

scope.onmessage = (e) => {
  const j = e.data;
  const t0 = performance.now();
  const s = renderShot(j.id, j.sr, j.ts, j.v);
  const mono = s.L === s.R;
  const ms = performance.now() - t0;
  scope.postMessage({ key: j.key, L: s.L, R: mono ? null : s.R, ms }, mono ? [s.L.buffer] : [s.L.buffer, s.R.buffer]);
};
