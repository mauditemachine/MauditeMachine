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
 * coup par coup (audio/drums.ts hitParams) ; seuls DELAY et REVERB passent
 * par la tranche de la voix (ses envois, a l'instant du coup) :
 * - level : VOL (le gain du coup, rapporte a celui de la voix) ;
 * - decay : AMP DEC (l'enveloppe du coup) ;
 * - tune : SRC TUNE (la hauteur du coup, calcule a sa hauteur, audio/shots.ts) ;
 * - pan : AMP PAN (un StereoPannerNode pour ce coup) ;
 * - start : SMPL START (le debut du coup dans son echantillon) ;
 * - snd : le son du coup, un "sample lock" facon Digitakt ('<famille>:<son>',
 *   un son de sa famille ou d'une autre : bd:909, cp:mm, sd:sd/01 Psy 02.wav) ;
 * - ktune, kattack, kdecay, kdrive (le KICK), snappy (la caisse claire), gate
 *   (elle et le clap) : les potards de la machine de SRC (revue de R2, Mika :
 *   "le kick peut etre parametre comme une machine"), le coup calcule avec ces
 *   reglages (audio/shots.ts, un ShotOverride prepare a l'avance), au
 *   cinquantieme comme le kit (audio/kit.ts) ;
 * - delay, reverb : les envois de la voix (FX), poses sur sa tranche a
 *   l'instant du coup, jusqu'au coup suivant de la voix (audio/sends.ts hit),
 *   comme un verrou d'envoi d'une Elektron : la queue deja envoyee reste.
 * Les deux couches (2026-10-08, l'etape R3, audio/kit.ts) : le coup se
 * calcule avec ce que le pas change de sa voix (audio/shots.ts, un
 * ShotOverride prepare a l'avance) :
 * - mach : la MACHINE de la couche SYNTH ('909', '808', 'mm') ;
 * - ksweep, sdtune, sddecay, sdtone : les potards de machine de R3 (SWEEP du
 *   kick ; TUNE, DECAY, TONE de la caisse claire) ;
 * - syn : le niveau de la couche SYNTH ; slev : celui de la couche SAMPLE ;
 * - stune, sfine, sstart, slen, srev : TUNE, FINE, START, LEN, REV de la
 *   couche SAMPLE (la page SMPL) ;
 * - snd : depuis R3 l'echantillon de la couche SAMPLE, le "sample lock" de
 *   l'Analog Rytm ('<famille>:<cle>', un echantillon de n'importe quelle
 *   famille ; '<famille>:off' : la couche SAMPLE muette sur ce pas). Un snd
 *   de R2 sur un modele de la famille (bd:808) se lit comme sa MACHINE
 *   (fromR2) ; sur un modele d'une autre famille, il n'est plus lu.
 * start reste le debut du coup dans tout son tampon (la voix, R2) : depuis la
 * revue de R3 le bloc START de AMP (les deux couches) ; START de SMPL est
 * celui de la couche SAMPLE (sstart). De meme tune, la hauteur de toute la
 * voix : TUNE de SRC (B) pour les voix de synthese, PITCH (G) pour BD et SD,
 * ou B est le TUNE de leur machine.
 * La velocite (TRIG VEL) n'est pas un verrou : c'est le chiffre du pas
 * lui-meme (audio/pattern.ts), comme sur une Elektron.
 *
 * Forme : par voix, par pas ('0' a '15'), seulement ce qui est verrouille
 * (un motif sans verrou : {}). Les valeurs sont celles du domaine du reglage
 * (0 a 1, -1 a 1 pour TUNE et PAN), arrondies au millieme ; TUNE au demi-ton.
 * v : la forme des verrous (LOCKS_V depuis la revue de R3, 2026-10-08) ; sans
 * elle, des verrous de R2 (en ligne avant R3), traduits au meme son a la
 * lecture (fromR2) : un snd sur un modele de la famille de la voix devient sa
 * MACHINE seule (mach, syn 1, sample OFF), un sample de sa famille joue seul
 * (syn 0 ; ceux d'une autre famille jouent seuls d'eux-memes, audio/kit.ts),
 * K.TUNE et DECAY du kick reglent aussi la couche SAMPLE (stune, slen),
 * comme ils reglaient le sample du kick en R2. Une valeur lue garde la sienne
 * (le cinquantieme de R2 reste exact) ; seule une valeur ecrite prend son cran.
 * Un pas vide garde ses verrous (ils ne jouent pas, comme sur le MM-BASS) ;
 * CLEAR les efface avec les pas. Pur : aucun store ici (audio/pattern.ts les
 * garde, state/patterns.ts et state/presets.ts les transportent).
 */

import type { Inst } from '../theme';

/**
 * Les reglages verrouillables (R2, R3) : tous coup par coup. L'etape 2 de la
 * refonte (2026-10-09, VOICE FLTR ENV FX) en ajoute (VoiceLockId) : FINE de
 * VOICE, ATK et HOLD de ENV, le filtre de FLTR (TYPE FREQ RESO ENV, ses ATK et
 * DEC), TONE (FLTR), DIST et CHORUS de la voix (FX, ils disaient NO LOCK) :
 * - atk, hold, fine, f* : coup par coup (l'enveloppe, la hauteur, le filtre
 *   du coup, audio/drums.ts voice) ;
 * - tone : le coup prend le TONE du pas (sa hauteur, et son filtre au lieu de
 *   celui de la tranche) ;
 * - dist, chorus : les inserts de la tranche de la voix prennent la valeur du
 *   pas a l'instant du coup, jusqu'au coup suivant de la voix (comme DELAY et
 *   REVERB, l'overdrive d'une piste Elektron).
 */
export type VoiceLockId = 'atk' | 'hold' | 'fine' | 'ftype' | 'fcut' | 'freso' | 'fenv' | 'fatk' | 'fdec' | 'tone' | 'dist' | 'chorus';
export const VOICE_LOCK_IDS: readonly VoiceLockId[] = ['atk', 'hold', 'fine', 'ftype', 'fcut', 'freso', 'fenv', 'fatk', 'fdec', 'tone', 'dist', 'chorus'];
export type LockId = 'level' | 'decay' | 'tune' | 'pan' | 'start' | KitLockId | LayerLockId | 'delay' | 'reverb' | VoiceLockId;
/** Les potards de la machine (SRC) : le coup se calcule avec eux (revue de R2 ; SWEEP et la caisse claire depuis R3). */
export type KitLockId = 'ktune' | 'kattack' | 'kdecay' | 'kdrive' | 'snappy' | 'gate' | 'ksweep' | 'sdtune' | 'sddecay' | 'sdtone';
export const KIT_LOCK_IDS: readonly KitLockId[] = ['ktune', 'kattack', 'kdecay', 'kdrive', 'snappy', 'gate', 'ksweep', 'sdtune', 'sddecay', 'sdtone'];
/** Les reglages des couches (R3) : les deux niveaux, la couche SAMPLE. */
export type LayerLockId = 'syn' | 'slev' | 'stune' | 'sfine' | 'sstart' | 'slen' | 'srev';
export const LAYER_LOCK_IDS: readonly LayerLockId[] = ['syn', 'slev', 'stune', 'sfine', 'sstart', 'slen', 'srev'];
export const LOCK_IDS: readonly LockId[] = ['level', 'decay', 'tune', 'pan', 'start', ...KIT_LOCK_IDS, ...LAYER_LOCK_IDS, 'delay', 'reverb', ...VOICE_LOCK_IDS];
export const isLockId = (v: unknown): v is LockId => typeof v === 'string' && (LOCK_IDS as readonly string[]).includes(v);
export const isKitLock = (v: unknown): v is KitLockId => typeof v === 'string' && (KIT_LOCK_IDS as readonly string[]).includes(v);
export const isLayerLock = (v: unknown): v is LayerLockId => typeof v === 'string' && (LAYER_LOCK_IDS as readonly string[]).includes(v);

/** Un verrou de pas, l'echantillon (snd) ou la MACHINE (mach). */
export type LockKey = LockId | 'snd' | 'mach';

/** Les verrous d'un pas : des valeurs (le domaine du reglage), l'echantillon et la MACHINE. */
export type StepLock = Partial<Record<LockId, number>> & { snd?: string; mach?: string };

/** Les verrous du motif : par voix, par pas ('0' a '15') ; v, leur forme (LOCKS_V, absente : R2). */
export type Locks = Partial<Record<Inst, Readonly<Record<string, Readonly<StepLock>>>>> & { v?: number };

/** La forme des verrous depuis R3 (les couches) ; un jeu sans elle vient de R2. */
export const LOCKS_V = 3;

/** Les voix (l'ordre des pads) : une copie locale, pas d'import circulaire avec audio/pattern.ts. */
const INSTS: readonly Inst[] = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'];
const STEPS = 16;
/** Le son verrouille : famille, deux-points, son (la cle d'un echantillon, ou off ; 909, 808, mm avant R3). */
const SND_RE = /^(bd|sd|hh|cp|tom|rs):[^\s:][^:]{0,120}$/;
/** Les MACHINES de la couche SYNTH. */
const MACHS: readonly string[] = ['909', '808', 'mm'];
/** Un snd de R2 qui verrouillait un modele : plus lu depuis R3. */
const oldModelSnd = (snd: string): boolean => /:(909|808|mm)$/.test(snd);

export const NO_LOCKS: Readonly<Locks> = Object.freeze({});

const r3 = (v: number): number => Math.round(v * 1000) / 1000;

/**
 * Une valeur dans le domaine de son reglage (TUNE au demi-ton, PAN a -1..1,
 * les autres a 0..1). exact : une valeur lue (un motif retenu, un preset)
 * garde la sienne dans son domaine (revue de R3 : un verrou de R2 au
 * cinquantieme ne bouge pas a la lecture).
 */
export function clampLock(id: LockId, v: number, exact = false): number {
  if (!Number.isFinite(v)) return id === 'decay' ? 1 : id === 'level' ? 0.8 : 0;
  if (id === 'tune' || id === 'stune') return Math.max(-24, Math.min(24, Math.round(v * 24))) / 24;
  if (id === 'sfine' || id === 'fine') return Math.max(-64, Math.min(64, Math.round(v * 64))) / 64;
  if (id === 'pan' || id === 'fenv') return r3(Math.max(-1, Math.min(1, v)));
  // TONE (2026-10-09) : -1 a 1, accroche au centre comme celui de la voix (audio/tone.ts snapTone)
  if (id === 'tone') return Math.abs(v) < 0.04 ? 0 : r3(Math.max(-1, Math.min(1, v)));
  // TYPE du filtre : LP, HP, BP (0, 0.5, 1)
  if (id === 'ftype') return Math.max(0, Math.min(2, Math.round(v * 2))) / 2;
  // Les potards de la machine et des couches : au 127e comme le kit depuis R3 (un calcul de coup par cran, pas par
  // pixel ; au cinquantieme en R2) ; GATE et REV 0 ou 1
  if (id === 'gate' || id === 'srev') return v >= 0.5 ? 1 : 0;
  if (isKitLock(id) || isLayerLock(id)) return exact ? Math.max(0, Math.min(1, v)) : Math.round(Math.max(0, Math.min(1, v)) * 127) / 127;
  return r3(Math.max(0, Math.min(1, v)));
}

/** La famille du kit de chaque voix (une copie de audio/kit.ts familyOf : ce module reste pur) ; CY n'en a pas. */
const FAMILY: Readonly<Record<Inst, string | null>> = { BD: 'bd', SD: 'sd', CH: 'hh', OH: 'hh', CP: 'cp', TOM: 'tom', HT: 'tom', CY: null };

/** TUNE d'un sample de R2 (le K.TUNE du kick : -12 a +12 demi-tons), en TUNE de couche (-1 a 1 pour +/-24). */
const r2SampleTune = (v: number): number => Math.round((Math.min(1, Math.max(0, v)) - 0.5) * 24) / 24;
/** LEN d'apres le K.DECAY de R2 sur un sample (audio/sampledsp.ts lenOfDecay, ici sans import). */
const r2SampleLen = (v: number): number => (v >= 0.45 ? 1 : Math.max(0, v) / 0.45);

/**
 * Un pas de R2 traduit au meme son (revue de R3, 2026-10-08) : x est le pas
 * lu tel quel, out ce qui en est deja garde (snd sur un modele mis a part).
 */
function fromR2(inst: Inst, x: Record<string, unknown>, out: StepLock): number {
  let n = 0;
  const fam = FAMILY[inst];
  const snd = typeof x.snd === 'string' && SND_RE.test(x.snd) ? x.snd : '';
  const m = snd ? /^([a-z]+):(909|808|mm)$/.exec(snd) : null;
  if (m && fam && m[1] === fam && out.mach === undefined) {
    // SOUND sur un modele de sa famille (bd:808) : cette MACHINE seule sur ce pas
    out.mach = m[2];
    out.snd = `${fam}:off`;
    n += 2;
    if (out.syn === undefined) {
      out.syn = 1;
      n += 1;
    }
  } else if (snd && !m && fam && snd.startsWith(`${fam}:`) && out.syn === undefined) {
    // Un sample de sa famille remplacait le son de la voix : il joue seul
    out.syn = 0;
    n += 1;
  }
  if (inst === 'BD') {
    // K.TUNE et K.DECAY reglaient aussi le sample du kick (sampleTuneSt, sampleDecayPart)
    if (typeof out.ktune === 'number' && out.stune === undefined) {
      out.stune = r2SampleTune(out.ktune);
      n += 1;
    }
    if (typeof out.kdecay === 'number' && out.slen === undefined) {
      out.slen = r2SampleLen(out.kdecay);
      n += 1;
    }
  }
  return n;
}

/** Les verrous d'un pas, nettoyes (r2 : un pas de R2, traduit) ; null s'il n'en reste aucun. */
function cleanStep(o: unknown, inst: Inst, r2: boolean): StepLock | null {
  if (!o || typeof o !== 'object') return null;
  const x = o as Record<string, unknown>;
  const out: StepLock = {};
  let n = 0;
  for (const id of LOCK_IDS) {
    const v = x[id];
    if (typeof v === 'number' && Number.isFinite(v)) {
      out[id] = clampLock(id, v, true);
      n += 1;
    }
  }
  if (typeof x.snd === 'string' && SND_RE.test(x.snd) && !oldModelSnd(x.snd)) {
    out.snd = x.snd;
    n += 1;
  }
  if (typeof x.mach === 'string' && MACHS.includes(x.mach)) {
    out.mach = x.mach;
    n += 1;
  }
  if (r2) {
    n += fromR2(inst, x, out);
    // Dans l'ordre d'une lecture de R3 (LOCK_IDS, snd, mach) : relu, le pas est le meme objet (les patterns comparent)
    const o: StepLock = {};
    for (const id of LOCK_IDS) if (out[id] !== undefined) o[id] = out[id];
    if (out.snd !== undefined) o.snd = out.snd;
    if (out.mach !== undefined) o.mach = out.mach;
    return n > 0 ? o : null;
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
  const r2 = x.v !== LOCKS_V;
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
      const l = cleanStep(v, inst, r2);
      if (!l) continue;
      row[k] = l;
      n += 1;
    }
    if (n > 0) {
      out[inst] = row;
      any = true;
    }
  }
  return any ? ({ ...out, v: LOCKS_V } as Locks) : null;
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
  if (key === 'snd' && typeof v === 'string' && oldModelSnd(v)) return l as Locks;
  const row: Record<string, StepLock> = { ...(l[inst] ?? {}) };
  for (const i of steps) {
    if (!Number.isInteger(i) || i < 0 || i >= STEPS) continue;
    const k = String(i);
    const cur: StepLock = { ...(row[k] ?? {}) };
    if (key === 'snd') {
      if (typeof v !== 'string' || !SND_RE.test(v)) continue;
      cur.snd = v;
    } else if (key === 'mach') {
      if (typeof v !== 'string' || !MACHS.includes(v)) continue;
      cur.mach = v;
    } else {
      if (typeof v !== 'number') continue;
      cur[key] = clampLock(key, v);
    }
    row[k] = cur;
  }
  return { ...l, [inst]: row, v: LOCKS_V };
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
  // Leur forme (v) ne compte pas : un jeu vide reste vide
  const body = (x: Readonly<Locks> | null | undefined): string => (anyLocks(x) ? JSON.stringify(INSTS.map((i) => x?.[i] ?? null)) : '');
  return body(a) === body(b);
}

/** Un son verrouille lu : sa famille et son son (909, mm, une cle d'echantillon). */
export function parseSnd(snd: string): { family: string; sound: string } | null {
  const i = snd.indexOf(':');
  if (i <= 0) return null;
  return { family: snd.slice(0, i), sound: snd.slice(i + 1) };
}
