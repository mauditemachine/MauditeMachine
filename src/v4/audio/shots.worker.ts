/**
 * Le calcul des one-shots hors du fil principal (2026-10-03) : la cymbale
 * prend 55 ms sur un ordinateur, bien plus sur un telephone ; ici, la scene
 * 3D ne saute aucune image. Recoit une commande, renvoie les canaux
 * (transferes, sans copie) ; audio/shots.ts en fait des AudioBuffer.
 * Les deux couches (2026-10-08, l'etape R3) : un coup peut jouer la couche
 * SYNTH et la couche SAMPLE ensemble (renderLayers) ; l'echantillon decode
 * arrive avec la premiere commande qui en a besoin (pcm), une fois, et reste
 * ici pour les suivantes (dans un budget d'octets depuis le 2026-10-21).
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
  /** un echantillon que le fil principal a libere (2026-10-21) : la copie d'ici part aussi */
  drop?: string;
}

const scope = self as unknown as {
  onmessage: ((e: MessageEvent<Job>) => void) | null;
  postMessage(m: unknown, transfer: Transferable[]): void;
};

/**
 * Les echantillons recus (cle : celle du kit). Un budget d'octets (2026-10-21, audit RS-5 : la copie de chaque PCM
 * restait ici pour la visite) : le moins recemment servi part d'abord ; s'il resert, ce worker le dit (missing) et
 * le fil principal le renvoie.
 */
const store = new Map<string, SamplePcm>();
const STORE_BYTES = 128 * 1024 * 1024;
let storeBytes = 0;
const sizeOf = (p: SamplePcm): number => (p.L.length + (p.R && p.R !== p.L ? p.R.length : 0)) * 4;

function keep(key: string, p: SamplePcm): void {
  const old = store.get(key);
  if (old) storeBytes -= sizeOf(old);
  store.delete(key);
  store.set(key, p);
  storeBytes += sizeOf(p);
  for (const [k, q] of store) {
    if (storeBytes <= STORE_BYTES || k === key) break;
    store.delete(k);
    storeBytes -= sizeOf(q);
  }
}

function drop(key: string): void {
  const p = store.get(key);
  if (!p) return;
  store.delete(key);
  storeBytes -= sizeOf(p);
}

scope.onmessage = (e) => {
  const j = e.data;
  if (typeof j.drop === 'string') {
    drop(j.drop);
    return;
  }
  // Une exception (un calcul faux, une memoire refusee) ne tue plus le worker (2026-10-21, audit RS-9) : elle est dite,
  // le fil principal retente une fois puis joue le repli
  try {
    if (j.pcm) keep(j.pcm.key, { L: j.pcm.L, R: j.pcm.R, sr: j.pcm.sr });
    const t0 = performance.now();
    // Seulement un echantillon qui s'entend (une couche SAMPLE a 0 ne le lit pas, son coup n'en a pas besoin)
    const want = j.tw?.sample && (j.tw.smp?.lev ?? 1) > 0 ? j.tw.sample : '';
    const pcm = want ? store.get(want) : undefined;
    // Un echantillon qui manque (le budget l'a libere) : le dire, rien n'est garde ; le fil principal le renvoie
    if (want && !pcm) {
      scope.postMessage({ key: j.key, missing: true }, []);
      return;
    }
    if (pcm) keep(want, pcm);
    const s = renderLayers(j.id, j.sr, j.ts, j.v, j.tw ?? { model: 'mm', tune: 0.5, attack: 0.5, decay: 0.45, drive: 0.25, snappy: 0.5 }, pcm);
    const mono = s.L === s.R;
    const ms = performance.now() - t0;
    scope.postMessage({ key: j.key, L: s.L, R: mono ? null : s.R, ms }, mono ? [s.L.buffer] : [s.L.buffer, s.R.buffer]);
  } catch (err) {
    scope.postMessage({ key: j.key, error: String(err) }, []);
  }
};
