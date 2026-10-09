/**
 * Le calcul des one-shots hors du fil principal (2026-10-03) : la cymbale
 * prend 55 ms sur un ordinateur, bien plus sur un telephone ; ici, la scene
 * 3D ne saute aucune image. Recoit une commande, renvoie les canaux
 * (transferes, sans copie) ; audio/shots.ts en fait des AudioBuffer.
 * Les deux couches (2026-10-08, l'etape R3) : un coup peut jouer la couche
 * SYNTH et la couche SAMPLE ensemble (renderLayers) ; l'echantillon decode
 * arrive avec la premiere commande qui en a besoin (pcm), une fois, et reste
 * ici pour les suivantes.
 */

import type { SamplePcm } from './sampledsp';
import { renderLayers, type ShotId, type ShotTweak } from './shotsdsp';

interface Job {
  key: string;
  id: ShotId;
  sr: number;
  ts: number;
  v: number;
  /** le kit du MM-RYTM pour ce son (audio/kit.ts) */
  tw?: ShotTweak;
  /** l'echantillon de la couche SAMPLE, la premiere fois qu'il sert (sa cle, ses canaux) */
  pcm?: { key: string } & SamplePcm;
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Job>) => void) | null;
  postMessage(m: unknown, transfer: Transferable[]): void;
};

/** Les echantillons recus (cle : celle du kit). */
const store = new Map<string, SamplePcm>();

scope.onmessage = (e) => {
  const j = e.data;
  if (j.pcm) store.set(j.pcm.key, { L: j.pcm.L, R: j.pcm.R, sr: j.pcm.sr });
  const t0 = performance.now();
  const pcm = j.tw?.sample ? store.get(j.tw.sample) : undefined;
  // Un echantillon qui manquerait (jamais : shots.ts l'envoie avant) : le dire, rien n'est garde
  if (j.tw?.sample && !pcm) {
    scope.postMessage({ key: j.key, missing: true }, []);
    return;
  }
  const s = renderLayers(j.id, j.sr, j.ts, j.v, j.tw ?? { model: 'mm', tune: 0.5, attack: 0.5, decay: 0.45, drive: 0.25, snappy: 0.5 }, pcm);
  const mono = s.L === s.R;
  const ms = performance.now() - t0;
  scope.postMessage({ key: j.key, L: s.L, R: mono ? null : s.R, ms }, mono ? [s.L.buffer] : [s.L.buffer, s.R.buffer]);
};
