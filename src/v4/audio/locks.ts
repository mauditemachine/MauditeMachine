/**
 * Les parameter locks du MM-RYTM (2026-10-08, l'etape R2, Mika : "il
 * faudrait vraiment faire comme un principe de machine Elektron ; quand on
 * clic sur un step on selectionne la partie qu'on veut modifier ... et
 * ensuite on tourne un encoder sur ce step et donc ce step a une valeur
 * differente, et on voit a l'ecran que quand le sequenceur passe sur ce step
 * alors le changement est fait ... MEME CHOSE DANS RYTM").
 *
 * Un verrou : la valeur d'un reglage de voix pour UN pas d'UNE voix ; quand
 * ce pas joue, le coup prend cette valeur au lieu de celle de la voix (sa
 * valeur de base, audio/voicefx.ts), le pas d'apres revient a la base. Tous
 * coup par coup (audio/drums.ts hitParams), aucun ne touche la tranche de la
 * voix :
 * - level : VOL (le gain du coup, rapporte a celui de la voix) ;
 * - decay : AMP DEC (l'enveloppe du coup) ;
 * - tune : SRC TUNE (la hauteur du coup, calcule a sa hauteur, audio/shots.ts) ;
 * - pan : AMP PAN (un StereoPannerNode pour ce coup) ;
 * - start : SMPL START (le debut du coup dans son echantillon) ;
 * - snd : le son du coup, un "sample lock" facon Digitakt ('<famille>:<son>',
 *   un son de sa famille ou d'une autre : bd:909, cp:mm, sd:sd/01 Psy 02.wav).
 * La velocite (TRIG VEL) n'est pas un verrou : c'est le chiffre du pas
 * lui-meme (audio/pattern.ts), comme sur une Elektron.
 *
 * Forme : par voix, par pas ('0' a '15'), seulement ce qui est verrouille
 * (un motif sans verrou : {}). Les valeurs sont celles du domaine du reglage
 * (0 a 1, -1 a 1 pour TUNE et PAN), arrondies au millieme ; TUNE au demi-ton.
 * Un pas vide garde ses verrous (ils ne jouent pas, comme sur le MM-BASS) ;
 * CLEAR les efface avec les pas. Pur : aucun store ici (audio/pattern.ts les
 * garde, state/patterns.ts et state/presets.ts les transportent).
 */

import type { Inst } from '../theme';

/** Les reglages verrouillables a cette etape (R2) : tous coup par coup. */
export type LockId = 'level' | 'decay' | 'tune' | 'pan' | 'start';
export const LOCK_IDS: readonly LockId[] = ['level', 'decay', 'tune', 'pan', 'start'];
export const isLockId = (v: unknown): v is LockId => typeof v === 'string' && (LOCK_IDS as readonly string[]).includes(v);

/** Un verrou de pas ou le son (snd). */
export type LockKey = LockId | 'snd';

/** Les verrous d'un pas : des valeurs (le domaine du reglage) et le son. */
export type StepLock = Partial<Record<LockId, number>> & { snd?: string };

/** Les verrous du motif : par voix, par pas ('0' a '15'). */
export type Locks = Partial<Record<Inst, Readonly<Record<string, Readonly<StepLock>>>>>;

/** Les voix (l'ordre des pads) : une copie locale, pas d'import circulaire avec audio/pattern.ts. */
const INSTS: readonly Inst[] = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'];
const STEPS = 16;
/** Le son verrouille : famille, deux-points, son (909, 808, mm ou la cle d'un echantillon). */
const SND_RE = /^(bd|sd|hh|cp|tom|rs):[^\s:][^:]{0,120}$/;

export const NO_LOCKS: Readonly<Locks> = Object.freeze({});

const r3 = (v: number): number => Math.round(v * 1000) / 1000;

/** Une valeur dans le domaine de son reglage (TUNE au demi-ton, PAN a -1..1, les autres a 0..1). */
export function clampLock(id: LockId, v: number): number {
  if (!Number.isFinite(v)) return id === 'decay' ? 1 : id === 'level' ? 0.8 : 0;
  if (id === 'tune') return Math.max(-24, Math.min(24, Math.round(v * 24))) / 24;
  if (id === 'pan') return r3(Math.max(-1, Math.min(1, v)));
  return r3(Math.max(0, Math.min(1, v)));
}

/** Les verrous d'un pas, nettoyes ; null s'il n'en reste aucun. */
function cleanStep(o: unknown): StepLock | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  const out: StepLock = {};
  let n = 0;
  for (const id of LOCK_IDS) {
    const v = x[id];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[id] = clampLock(id, v);
      n += 1;
    }
  }
  if (typeof x.snd === 'string' && SND_RE.test(x.snd)) {
    out.snd = x.snd;
    n += 1;
  }
  return n > 0 ? out : null;
}

/**
 * Des verrous lus (stockage, preset, pattern) : les voix et pas inconnus, les
 * reglages inconnus et les valeurs hors domaine s'en vont ; null s'il ne
 * reste rien (un vieux motif, un preset d'avant les verrous).
 */
export function cleanLocks(o: unknown): Locks | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  const out: Record<string, Record<string, StepLock>> = {};
  let any = false;
  for (const inst of INSTS) {
    const per = x[inst];
    if (!per || typeof per !== 'object') continue;
    const row: Record<string, StepLock> = {};
    let n = 0;
    for (const [k, v] of Object.entries(per as Record<string, unknown>)) {
      const i = Number(k);
      if (!Number.isInteger(i) || i < 0 || i >= STEPS || String(i) !== k) continue;
      const l = cleanStep(v);
      if (!l) continue;
      row[k] = l;
      n += 1;
    }
    if (n > 0) {
      out[inst] = row;
      any = true;
    }
  }
  return any ? (out as Locks) : null;
}

/** Les verrous du pas `step` de `inst`, null sans verrou. */
export function lockOf(l: Readonly<Locks> | null | undefined, inst: Inst, step: number): Readonly<StepLock> | null {
  return l?.[inst]?.[String(step)] ?? null;
}

/** Le pas porte-t-il au moins un verrou ? */
export const hasLock = (l: Readonly<Locks> | null | undefined, inst: Inst, step: number): boolean => lockOf(l, inst, step) !== null;

/** Combien de verrous sur ce pas. */
export function lockCount(l: Readonly<Locks> | null | undefined, inst: Inst, step: number): number {
  const s = lockOf(l, inst, step);
  return s ? Object.keys(s).length : 0;
}

/** Les pas d'une voix qui portent des verrous : un masque de 16 bits (bit i : le pas i). */
export function lockMask(l: Readonly<Locks> | null | undefined, inst: Inst | null): number {
  if (!inst) return 0;
  const row = l?.[inst];
  if (!row) return 0;
  let m = 0;
  for (const k of Object.keys(row)) m |= 1 << Number(k);
  return m;
}

/** Le motif a-t-il au moins un verrou ? */
export const anyLocks = (l: Readonly<Locks> | null | undefined): boolean => !!l && INSTS.some((i) => !!l[i] && Object.keys(l[i] as object).length > 0);

/** Un verrou pose (ou remplace) sur des pas d'une voix : de nouveaux verrous (mise a jour immuable). */
export function withLock(l: Readonly<Locks>, inst: Inst, steps: readonly number[], key: LockKey, v: number | string): Locks {
  const row: Record<string, StepLock> = { ...(l[inst] ?? {}) };
  for (const i of steps) {
    if (!Number.isInteger(i) || i < 0 || i >= STEPS) continue;
    const k = String(i);
    const cur: StepLock = { ...(row[k] ?? {}) };
    if (key === 'snd') {
      if (typeof v !== 'string' || !SND_RE.test(v)) continue;
      cur.snd = v;
    } else {
      if (typeof v !== 'number') continue;
      cur[key] = clampLock(key, v);
    }
    row[k] = cur;
  }
  return { ...l, [inst]: row };
}

/** Un verrou retire (key absent : tous ceux du pas) ; les memes verrous s'il n'y avait rien. */
export function withoutLock(l: Readonly<Locks>, inst: Inst, steps: readonly number[], key?: LockKey): Locks {
  const was = l[inst];
  if (!was) return l as Locks;
  const row: Record<string, StepLock> = { ...was };
  let changed = false;
  for (const i of steps) {
    const k = String(i);
    const cur = row[k];
    if (!cur) continue;
    if (key === undefined) {
      delete row[k];
      changed = true;
      continue;
    }
    if (!(key in cur)) continue;
    const next: StepLock = { ...cur };
    delete next[key];
    if (Object.keys(next).length === 0) delete row[k];
    else row[k] = next;
    changed = true;
  }
  if (!changed) return l as Locks;
  const out: Locks = { ...l };
  if (Object.keys(row).length === 0) delete out[inst];
  else out[inst] = row;
  return out;
}

/** Deux jeux de verrous egaux (le miroir des patterns n'ecrit pas pour rien). */
export function sameLocks(a: Readonly<Locks> | null | undefined, b: Readonly<Locks> | null | undefined): boolean {
  return JSON.stringify(a ?? {}) === JSON.stringify(b ?? {});
}

/** Un son verrouille lu : sa famille et son son (909, mm, une cle d'echantillon). */
export function parseSnd(snd: string): { family: string; sound: string } | null {
  const i = snd.indexOf(':');
  if (i <= 0) return null;
  return { family: snd.slice(0, i), sound: snd.slice(i + 1) };
}
