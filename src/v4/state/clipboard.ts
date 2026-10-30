/**
 * Le presse-papiers UNIQUE du MM-RYTM (P0, 2026-10-30, docs/v4/dt2/dt2-master-spec.md, critique C1.2 : manuel DT2 6.4) :
 * un objet type a la fois, quel qu'il soit (un pattern, une piste, des trigs, une page, une page de reglages, un son, un
 * kit, une ligne de song) ; copier remplace ce qu'il y avait, coller ne prend que son genre. Le CONTRAT et son store,
 * sans utilisateur en P0 (le COPY / PASTE d'aujourd'hui, actions/face.ts clip, reste tel quel jusqu'a V.6.1) : chaque
 * lane y passe au lieu d'avoir le sien.
 */

/** Ce qu'un copier porte, par genre ; une lane qui en ajoute un l'ajoute a la fin. */
export interface ClipData {
  /** un pattern entier (son emplacement d'origine et son etat stocke) */
  pattern: { slot: number; data: unknown };
  /** une piste du pattern : ses pas, ses verrous, ses reglages de trig */
  track: { track: string; steps: string; locks?: unknown; trigs?: unknown };
  /** des trigs (un ou plusieurs pas d'une piste, avec leurs verrous) */
  trigs: { track: string; steps: readonly number[]; data: unknown };
  /** une page de 16 pas (V.6.1) */
  page: { track: string; page: number; data: unknown };
  /** une page de reglages (TRIG, SRC, FLTR, AMP, FX, MOD) */
  params: { track: string; page: string; values: Readonly<Record<string, number>> };
  /** le son d'une piste (TRK + REC) */
  sound: { track: string; data: unknown };
  /** un kit (V.6.2) */
  kit: { data: unknown };
  /** une ligne de song (V.6.2) */
  songRow: { song: number; row: number; data: unknown };
}
export type ClipKind = keyof ClipData;

export interface ClipItem<K extends ClipKind = ClipKind> {
  readonly kind: K;
  readonly data: Readonly<ClipData[K]>;
  /** l'heure de la copie (performance.now) */
  readonly at: number;
}

let item: ClipItem | null = null;
const listeners = new Set<() => void>();

export const clipboard = {
  get: (): ClipItem | null => item,
  /** ce que le presse-papiers porte, s'il est de ce genre ; sinon null (coller ne prend que son genre) */
  take<K extends ClipKind>(kind: K): Readonly<ClipData[K]> | null {
    return item && item.kind === kind ? (item.data as Readonly<ClipData[K]>) : null;
  },
  put<K extends ClipKind>(kind: K, data: ClipData[K], at: number = performance.now()): void {
    item = { kind, data, at } as ClipItem;
    listeners.forEach((fn) => fn());
  },
  clear(): void {
    if (!item) return;
    item = null;
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
