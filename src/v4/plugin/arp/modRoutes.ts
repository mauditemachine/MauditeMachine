/**
 * v50 (contrat v50, option C validee par Mika : "C et SQ ok, go") : le modele de la matrice de modulation de l'encart
 * d'EDIT et des quatre LFO generiques. Rien a dessiner ici : encart50.ts dessine, Encart50Overlay.tsx deroule les menus.
 *
 * Les routes (contrat section 1) : RIEN de l'ancien n'est converti. Les anciennes routes restent des reglages hote
 * actifs (calcules par leur code d'avant, au bit pres) ; la face les MONTRE comme des lignes de la matrice ("lignes
 * liees") des que leur quantite n'est pas neutre :
 *   lfo1  : lfoAmt > 0 (TARGET / DEPTH du site, la source LFO 1)
 *   lfo1b : xLfo1Depth2 != 0.5 et xLfo1Dest2 != OFF (LFO 1)
 *   lfo2  : xLfo2Depth != 0.5 et xLfo2Dest != OFF (LFO 2)
 *   lfo3  : xDLfoAmt != 0.5 (LFO 3 = l'ancien DISTO LFO, sa cible DRIVE ... MIX)
 *   xm    : xM{n}Amt != 0.5, source et destination non OFF (l'ancienne matrice de la page SEQ, n = 1..6)
 * puis les huit nouveaux emplacements xMx1..8 (mx). Une ligne liee garde sa source et ses destinations dans leur ancienne
 * liste ; un choix hors de cette liste deplace la route vers un emplacement xMx libre et neutralise l'ancienne.
 *
 * La destination d'un emplacement : un code (modTable.ts) ; xMx{n}Dst = code / 1023 (extra.ts : nsteps 1024).
 */

import { voyMsg } from '../../voyager/msg';
import { LFO_BEATS, LFO_SHAPES, voyKnob, voyParams, voyValueText, type VoyKnobId } from '../../voyager/params';
import spec from '../../../../plugin/mm-arp/extra-params.json';
import { arpExtra, extraParam, extraStepCount, extraStepIndex, isExtra, lfoFreeHz } from './extra';
import { LFO_BEATS as HELL_BEATS } from './hell';
import { MOD_BIPOLAR, MOD_DESTS, MOD_GROUPS, MOD_SLOTS, MOD_SOURCES, modDestByCode, modDestCodeOf, type ModDest } from './modTable';

/* ---------------- lire, ecrire un reglage (un potard du site ou un reglage du VST3 seul) ---------------- */

export const valOf = (id: string): number => (isExtra(id) ? arpExtra.of(id) : voyParams.of(id as VoyKnobId));
export const setVal = (id: string, v: number): boolean => (isExtra(id) ? arpExtra.set(id, v) : voyParams.set(id as VoyKnobId, v));
export const textOf = (id: string, v: number = valOf(id)): string => (isExtra(id) ? arpExtra.text(id, v) : voyValueText(id as VoyKnobId, v));
/** Les crans d'un reglage (0 : continu). */
export const stepsOf = (id: string): number => (isExtra(id) ? extraStepCount(id) : (voyKnob(id as VoyKnobId).steps?.length ?? 0));
const stepsList = (id: string): readonly string[] => (isExtra(id) ? (extraParam(id)?.steps ?? []) : (voyKnob(id as VoyKnobId).steps ?? []));
/** L'index du cran du moment. */
export const stepAt = (id: string, v: number = valOf(id)): number => {
  const n = stepsOf(id);
  return n < 2 ? 0 : Math.max(0, Math.min(n - 1, Math.round(v * (n - 1))));
};
const setStep = (id: string, i: number): boolean => {
  const n = stepsOf(id);
  return n < 2 ? false : setVal(id, Math.max(0, Math.min(n - 1, i)) / (n - 1));
};
const near = (a: number, b: number): boolean => Math.abs(a - b) < 1e-4;
/** Un reglage du contrat v50 encore inconnu (la face avant la fusion du moteur) : sa valeur de depart. */
const valOr = (id: string, d: number): number => (isExtra(id) ? arpExtra.of(id) : d);

/* ---------------- les quatre LFO ---------------- */

export interface LfoDef {
  n: 1 | 2 | 3 | 4;
  /** le levier FREE / SYNC */
  syncId: string;
  sync: () => boolean;
  /** le reglage que tourne SPEED (selon FREE / SYNC) */
  speedId: () => string;
  shapeId: string;
  shapeName: () => string;
  /** SYNC : les noires par cycle ; FREE : null */
  beats: () => number | null;
  /** FREE : les Hz ; SYNC : null */
  hz: () => number | null;
  rateText: () => string;
}

const LFO2_BEATS: readonly number[] = ((spec.params as readonly { id: string; beats?: number[] }[]).find((p) => p.id === 'xLfo2Rate')?.beats ?? []) as number[];
const LFO2_SHAPES = ['SINE', 'TRI', 'SAW', 'RAMP', 'SQR', 'S&H', 'RND'] as const;
const shapeOf = (id: string, list: readonly string[], d = 0): string => {
  const n = list.length;
  const v = valOr(id, d);
  return list[Math.max(0, Math.min(n - 1, Math.round(v * (n - 1))))];
};
const hellBeat = (v: number): number => HELL_BEATS[Math.max(0, Math.min(HELL_BEATS.length - 1, Math.round(v * (HELL_BEATS.length - 1))))];

export const LFOS: readonly LfoDef[] = [
  {
    // LFO 1 : l'ancien MOD de la face (SYNC : lfoRate, ses divisions ; FREE : xLfo1Hz)
    n: 1,
    syncId: 'xLfo1Sync',
    sync: () => valOr('xLfo1Sync', 1) >= 0.5,
    speedId: () => (valOr('xLfo1Sync', 1) >= 0.5 ? 'lfoRate' : 'xLfo1Hz'),
    shapeId: 'lfoShape',
    shapeName: () => LFO_SHAPES[stepAt('lfoShape')],
    beats: () => (valOr('xLfo1Sync', 1) >= 0.5 ? LFO_BEATS[stepAt('lfoRate')] : null),
    hz: () => (valOr('xLfo1Sync', 1) >= 0.5 ? null : lfoFreeHz(valOr('xLfo1Hz', 0.4))),
    rateText: () => textOf(valOr('xLfo1Sync', 1) >= 0.5 || !isExtra('xLfo1Hz') ? 'lfoRate' : 'xLfo1Hz'),
  },
  {
    n: 2,
    syncId: 'xLfo2Sync',
    sync: () => valOr('xLfo2Sync', 1) >= 0.5,
    speedId: () => (valOr('xLfo2Sync', 1) >= 0.5 ? 'xLfo2Rate' : 'xLfo2Hz'),
    shapeId: 'xLfo2Shape',
    shapeName: () => shapeOf('xLfo2Shape', LFO2_SHAPES),
    beats: () => (valOr('xLfo2Sync', 1) >= 0.5 ? (LFO2_BEATS[stepAt('xLfo2Rate')] ?? 1) : null),
    hz: () => (valOr('xLfo2Sync', 1) >= 0.5 ? null : lfoFreeHz(valOr('xLfo2Hz', 0.4))),
    rateText: () => textOf(valOr('xLfo2Sync', 1) >= 0.5 || !isExtra('xLfo2Hz') ? 'xLfo2Rate' : 'xLfo2Hz'),
  },
  {
    // LFO 3 : l'ancien DISTO LFO (la meme vitesse dans les deux modes)
    n: 3,
    syncId: 'xDLfoSync',
    sync: () => valOf('xDLfoSync') >= 0.5,
    speedId: () => 'xDLfoRate',
    shapeId: 'xDLfoShape',
    shapeName: () => shapeOf('xDLfoShape', ['SINE', 'TRI', 'SAW', 'SQUARE', 'RANDOM']),
    beats: () => (valOf('xDLfoSync') >= 0.5 ? hellBeat(valOf('xDLfoRate')) : null),
    hz: () => (valOf('xDLfoSync') >= 0.5 ? null : lfoFreeHz(valOf('xDLfoRate'))),
    rateText: () => textOf('xDLfoRate'),
  },
  {
    n: 4,
    syncId: 'xLfo4Sync',
    sync: () => valOr('xLfo4Sync', 1) >= 0.5,
    speedId: () => 'xLfo4Rate',
    shapeId: 'xLfo4Shape',
    shapeName: () => shapeOf('xLfo4Shape', LFO2_SHAPES),
    beats: () => (valOr('xLfo4Sync', 1) >= 0.5 ? hellBeat(valOr('xLfo4Rate', 0.4)) : null),
    hz: () => (valOr('xLfo4Sync', 1) >= 0.5 ? null : lfoFreeHz(valOr('xLfo4Rate', 0.4))),
    rateText: () => (isExtra('xLfo4Rate') ? textOf('xLfo4Rate') : '1/4'),
  },
];

/* ---------------- les noms des cibles ---------------- */

/** L'ordre des familles dans le menu (la table : MOD_GROUPS) ; une famille inconnue vient a la fin. */
export const DEST_GROUPS: readonly string[] = MOD_GROUPS;
/**
 * Les destinations synthe (1..19, calculees par voix) qui ont leur potard : le C++ dirige le potard vers le meme chemin
 * (contrat section 4) ; le menu montre le potard seul, une ligne liee les tient pour la meme cible.
 */
const EQUIV: Readonly<Record<string, string>> = {
  'm:cutoff': 'cutoff',
  'm:res': 'res',
  'm:envamt': 'envAmt',
  'm:fm': 'fm',
  'm:noise': 'noise',
  'm:sub': 'sub',
  'm:ring': 'xRing',
  'm:fold': 'xFold',
  'm:comb': 'xComb',
  'm:stack': 'stack',
  'm:lfo1depth': 'lfoAmt',
  'm:lfo2depth': 'xLfo2Depth',
};
/** Le code du potard equivalent d'une destination synthe (ou le code lui-meme). */
const canon = (code: number): number => {
  const d = modDestByCode(code);
  const eq = d ? EQUIV[d.id] : undefined;
  return (eq !== undefined ? modDestCodeOf(eq) : undefined) ?? code;
};

/** Le nom d'une cible (la fenetre DESTINATION, le message de l'ecran). */
export const destName = (code: number): string => (code === 0 ? 'OFF' : (modDestByCode(code)?.label ?? '- - -'));
/** Le nom d'une cible dans sa famille (le menu : DISTO LFO RATE sous DISTO s'ecrit LFO RATE). */
export const destShort = (d: ModDest): string => {
  const n = destName(d.code);
  const rest = n.slice(d.group.length + 1);
  return n.startsWith(`${d.group} `) && rest.length > 0 && !/^\d/.test(rest) ? rest : n;
};

/** Le menu DESTINATION : les familles et leurs cibles (une destination synthe qui a son potard : le potard seul). */
export const DEST_MENU: readonly { group: string; items: readonly ModDest[] }[] = (() => {
  const hidden = new Set<number>();
  for (const d of MOD_DESTS) if (d.code < 32 && canon(d.code) !== d.code) hidden.add(d.code);
  const groups = new Map<string, ModDest[]>();
  for (const d of MOD_DESTS) {
    if (hidden.has(d.code)) continue;
    if (!groups.has(d.group)) groups.set(d.group, []);
    groups.get(d.group)!.push(d);
  }
  const order = [...DEST_GROUPS.filter((g) => groups.has(g)), ...[...groups.keys()].filter((g) => !DEST_GROUPS.includes(g))];
  return order.map((group) => ({ group, items: groups.get(group)! }));
})();
/** La cible que le menu allume pour ce code (une destination synthe : son potard). */
export const destMenuCode = (code: number): number => canon(code);

/* ---------------- les routes ---------------- */

export type RouteKind = 'lfo1' | 'lfo1b' | 'lfo2' | 'lfo3' | 'xm' | 'mx';
export interface Route {
  kind: RouteKind;
  /** xm : 1..6 ; mx : 1..8 ; sinon 0 */
  n: number;
  key: string;
}
const route = (kind: RouteKind, n = 0): Route => ({ kind, n, key: `${kind}${n || ''}` });
export const XM_ROWS = 6;
const LINKABLE: readonly Route[] = [route('lfo1'), route('lfo1b'), route('lfo2'), route('lfo3'), ...Array.from({ length: XM_ROWS }, (_, i) => route('xm', i + 1))];
const SLOTS: readonly Route[] = Array.from({ length: MOD_SLOTS }, (_, i) => route('mx', i + 1));

/** Le reglage de la quantite d'une route (le potard AMT). */
export const amtIdOf = (r: Route): string =>
  r.kind === 'lfo1' ? 'lfoAmt' : r.kind === 'lfo1b' ? 'xLfo1Depth2' : r.kind === 'lfo2' ? 'xLfo2Depth' : r.kind === 'lfo3' ? 'xDLfoAmt' : r.kind === 'xm' ? `xM${r.n}Amt` : `xMx${r.n}Amt`;
/** Le reglage de la destination d'une route. */
const dstIdOf = (r: Route): string =>
  r.kind === 'lfo1' ? 'lfoDest' : r.kind === 'lfo1b' ? 'xLfo1Dest2' : r.kind === 'lfo2' ? 'xLfo2Dest' : r.kind === 'lfo3' ? 'xDLfoTarget' : r.kind === 'xm' ? `xM${r.n}Dst` : `xMx${r.n}Dst`;
/** La quantite neutre (rien) : 0 pour DEPTH du site (unipolaire), 0.5 pour les autres (bipolaires). */
const neutralOf = (r: Route): number => (r.kind === 'lfo1' ? 0 : 0.5);
/** La source fixe d'une ancienne route d'un LFO (index de MOD_SOURCES). */
const FIXED_SRC: Partial<Record<RouteKind, number>> = { lfo1: 6, lfo1b: 6, lfo2: 7, lfo3: 12 };

/** La source d'une route (index de MOD_SOURCES ; 0 : OFF). */
export function srcOf(r: Route): number {
  const f = FIXED_SRC[r.kind];
  if (f !== undefined) return f;
  return r.kind === 'xm' ? stepAt(`xM${r.n}Src`) : isExtra(`xMx${r.n}Src`) ? extraStepIndex(`xMx${r.n}Src`, arpExtra.of(`xMx${r.n}Src`)) : 0;
}

/** Les cibles de l'ancienne liste d'une route (par cran ; null : sans equivalent, W+CUT ; undefined : inconnue). */
const LFO1_CODES: readonly (number | null)[] = [3, 10, 4, 1, null]; // WAVE, CUTOFF, FM, PITCH, W+CUT
const SYNTH_LABEL = new Map(MOD_DESTS.filter((d) => d.code < 32).map((d) => [d.label, d.code]));
const DISTO_IDS: Readonly<Record<string, string>> = { DRIVE: 'dist', MORPH: 'xDMorph', TONE: 'xDTone', PRE: 'xDPreFreq', POST: 'xDPostFreq', MIX: 'xDMix' };
function oldCodes(r: Route): readonly (number | null | undefined)[] {
  switch (r.kind) {
    case 'lfo1':
      return LFO1_CODES;
    case 'lfo3':
      return stepsList('xDLfoTarget').map((s) => modDestCodeOf(DISTO_IDS[s] ?? ''));
    case 'xm':
      return stepsList(`xM${r.n}Dst`).map((_, i) => i);
    case 'lfo1b':
    case 'lfo2':
      return stepsList(dstIdOf(r)).map((s) => (s === 'OFF' ? 0 : SYNTH_LABEL.get(s)));
    default:
      return [];
  }
}

/** La destination d'une route : son code (0 : OFF ; null : W+CUT), son nom. */
export function dstOf(r: Route): { code: number | null; name: string } {
  if (r.kind === 'mx') {
    const id = `xMx${r.n}Dst`;
    const code = isExtra(id) ? extraStepIndex(id, arpExtra.of(id)) : 0;
    return { code, name: destName(code) };
  }
  const i = stepAt(dstIdOf(r));
  const label = stepsList(dstIdOf(r))[i] ?? '- - -';
  const c = oldCodes(r)[i];
  return { code: c === undefined ? null : c, name: r.kind === 'lfo3' ? `DISTO ${label}` : label };
}

/** Une ancienne route est-elle une ligne liee (sa quantite n'est pas neutre) ? */
export function isLinked(r: Route): boolean {
  const amt = valOf(amtIdOf(r));
  switch (r.kind) {
    case 'lfo1':
      return amt > 0;
    case 'lfo3':
      return !near(amt, 0.5);
    case 'lfo1b':
    case 'lfo2':
      return !near(amt, 0.5) && stepAt(dstIdOf(r)) !== 0;
    case 'xm':
      return !near(amt, 0.5) && stepAt(`xM${r.n}Src`) !== 0 && stepAt(`xM${r.n}Dst`) !== 0;
    default:
      return false;
  }
}

/**
 * Les lignes tenues pendant un geste (une ligne liee ramenee au neutre ne disparait qu'au relachement : le potard AMT
 * ne saute pas sur la ligne suivante en plein glisser).
 */
const held = new Set<string>();
let heldArmed = false;
const releaseHeld = (): void => {
  if (held.size === 0) return;
  held.clear();
  emit();
};
function hold(r: Route): void {
  if (typeof window === 'undefined') return;
  held.add(r.key);
  if (!heldArmed) {
    heldArmed = true;
    window.addEventListener('pointerup', () => window.setTimeout(releaseHeld, 0), true);
    window.addEventListener('pointercancel', () => window.setTimeout(releaseHeld, 0), true);
  }
}

export const ROWS_PER_PAGE = 8;
/** Un emplacement servi (une source, une cible ou une quantite). */
const slotUsed = (s: Route): boolean => isExtra(`xMx${s.n}Src`) && (stepAt(`xMx${s.n}Src`) !== 0 || stepAt(`xMx${s.n}Dst`) !== 0 || !near(valOf(`xMx${s.n}Amt`), 0.5));

/**
 * Les lignes de la matrice : les lignes liees, puis les emplacements : ceux qui servent, et assez d'emplacements vides
 * pour remplir les huit places (un au moins) ; les autres vides attendent (ils viennent des qu'une place se libere). Une
 * page de plus seulement au-dela de huit routes. Un emplacement garde sa place quand il se remplit (l'ordre xMx1..8).
 */
export function modRows(): Route[] {
  const linked = LINKABLE.filter((r) => isLinked(r) || held.has(r.key));
  const used = SLOTS.filter((s) => slotUsed(s) || held.has(s.key) || s.key === aimKey).length;
  let empty = Math.max(1, ROWS_PER_PAGE - linked.length - used);
  const slots = SLOTS.filter((s) => slotUsed(s) || held.has(s.key) || s.key === aimKey || empty-- > 0);
  return [...linked, ...slots];
}

/* ---------------- le store (la page de la matrice, l'assignation au viseur) ---------------- */

let page = 0;
let aimKey: string | null = null;
const listeners = new Set<() => void>();
const emit = (): void => listeners.forEach((fn) => fn());

export const modView = {
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  pages: (): number => Math.max(1, Math.ceil(modRows().length / ROWS_PER_PAGE)),
  page: (): number => Math.min(page, modView.pages() - 1),
  setPage(p: number): void {
    const n = Math.max(0, Math.min(modView.pages() - 1, p));
    if (n === page) return;
    page = n;
    emit();
  },
  /** La ligne a cette place de la page montree (0..7), null si la page n'en a pas. */
  rowAt(p: number): Route | null {
    const rows = modRows();
    return rows[modView.page() * ROWS_PER_PAGE + p] ?? null;
  },
  /** Quelque chose que montre l'encart a change (la rangee de valeurs de SQ) : il se redessine. */
  touch: (): void => emit(),
  /** Le numero affiche d'une place (#1...). */
  numberAt: (p: number): number => modView.page() * ROWS_PER_PAGE + p + 1,
};

/* ---------------- les textes ---------------- */

export const srcName = (r: Route): string => MOD_SOURCES[srcOf(r)] ?? 'OFF';
/** La quantite d'une route, en clair (+40 %, 30 % pour DEPTH du site). */
export const amtText = (r: Route, v: number = valOf(amtIdOf(r))): string => (r.kind === 'lfo1' ? textOf('lfoAmt', v) : `${v >= 0.5 ? '+' : ''}${Math.round((v - 0.5) * 200)} %`.replace('+0 %', '0 %'));
export const routeSay = (r: Route, num: number): string => `#${num} ${srcName(r)} > ${dstOf(r).name} ${amtText(r)}`;

/* ---------------- les gestes ---------------- */

/** Un emplacement libre (source et destination OFF), sauf ceux deja pris dans ce geste. */
function freeSlots(n: number): Route[] {
  const out: Route[] = [];
  for (const s of SLOTS) {
    if (out.length === n) break;
    if (!isExtra(`xMx${s.n}Src`)) continue;
    if (stepAt(`xMx${s.n}Src`) === 0 && stepAt(`xMx${s.n}Dst`) === 0) out.push(s);
  }
  return out.length === n ? out : [];
}

/** La quantite d'une ancienne route en bipolaire (DEPTH du site : 0..1 -> 0.5..1). */
const amtBipolar = (r: Route): number => (r.kind === 'lfo1' ? 0.5 + 0.5 * valOf('lfoAmt') : valOf(amtIdOf(r)));

/** Un emplacement ecrit (source, cible, quantite). */
function writeSlot(s: Route, src: number, code: number, amt: number): void {
  setVal(`xMx${s.n}Src`, src / (MOD_SOURCES.length - 1));
  setVal(`xMx${s.n}Dst`, code / 1023);
  setVal(`xMx${s.n}Amt`, amt);
}

/**
 * Une ancienne route modifiee hors de sa liste : elle part dans un (ou deux : W+CUT) emplacement libre, avec sa source,
 * ses cibles et sa quantite (le changement applique), et l'ancienne est neutralisee. false : plus de place.
 */
function moveOut(r: Route, change: { src?: number; code?: number }): boolean {
  const src = change.src ?? srcOf(r);
  let codes: number[];
  if (change.code !== undefined) codes = [change.code];
  else {
    const d = dstOf(r);
    // W+CUT : la forme d'onde et la coupure, deux emplacements
    codes = d.code === null ? (r.kind === 'lfo1' && stepAt('lfoDest') === 4 ? [3, 10] : []) : [d.code];
  }
  if (codes.length === 0 || codes.some((c) => !modDestByCode(c))) {
    voyMsg.show('NO EQUIVALENT TARGET', 1800);
    return false;
  }
  const free = freeSlots(codes.length);
  if (free.length === 0) {
    voyMsg.show('MOD MATRIX FULL', 1800);
    return false;
  }
  const amt = amtBipolar(r);
  free.forEach((s, i) => writeSlot(s, src, codes[i], amt));
  setVal(amtIdOf(r), neutralOf(r));
  emit();
  return true;
}

/** La source d'une route. */
export function setSource(r: Route, s: number): void {
  if (r.kind === 'mx') {
    setVal(`xMx${r.n}Src`, s / (MOD_SOURCES.length - 1));
    return;
  }
  if (r.kind === 'xm' && s < stepsOf(`xM${r.n}Src`)) {
    setStep(`xM${r.n}Src`, s);
    return;
  }
  if (s === srcOf(r)) return;
  // OFF : la route s'arrete (l'ancienne est neutralisee)
  if (s === 0) {
    setVal(amtIdOf(r), neutralOf(r));
    return;
  }
  moveOut(r, { src: s });
}

/** La cible d'une route (un code de modTable.ts ; 0 : OFF). */
export function setDest(r: Route, code: number): void {
  if (r.kind === 'mx') {
    setVal(`xMx${r.n}Dst`, code / 1023);
    return;
  }
  const codes = oldCodes(r);
  if (code === 0) {
    // OFF : la route s'arrete (la cible OFF quand la liste l'a, sinon la quantite neutre)
    if (codes[0] === 0) setStep(dstIdOf(r), 0);
    else setVal(amtIdOf(r), neutralOf(r));
    return;
  }
  const want = canon(code);
  const i = codes.findIndex((c) => typeof c === 'number' && c !== 0 && canon(c) === want);
  if (i >= 0) {
    setStep(dstIdOf(r), i);
    return;
  }
  moveOut(r, { code });
}

/** La quantite d'une route (le potard AMT, un glisser). */
export function setAmt(r: Route, v: number): void {
  hold(r);
  setVal(amtIdOf(r), Math.min(1, Math.max(0, v)));
}

/* ---------------- le viseur ---------------- */

/** La source montree pendant l'assignation (OFF : LFO 1, ce que l'assignation posera). */
export const aimSourceName = (r: Route): string => (srcOf(r) === 0 ? MOD_SOURCES[6] : srcName(r));

let escOn = false;
const onEsc = (e: KeyboardEvent): void => {
  if (e.key !== 'Escape' || aimKey === null) return;
  e.preventDefault();
  e.stopImmediatePropagation();
  modAim.cancel();
};

export const modAim = {
  /** La route qui attend sa cible (sa cle), null : pas d'assignation. */
  key: (): string | null => aimKey,
  on: (): boolean => aimKey !== null,
  route: (): Route | null => (aimKey === null ? null : ([...LINKABLE, ...SLOTS].find((r) => r.key === aimKey) ?? null)),
  start(r: Route): void {
    aimKey = r.key;
    if (!escOn && typeof window !== 'undefined') {
      escOn = true;
      window.addEventListener('keydown', onEsc, true);
    }
    voyMsg.show(`CLICK A KNOB > ${aimSourceName(r)}`, 3_600_000);
    emit();
  },
  cancel(): void {
    if (aimKey === null) return;
    aimKey = null;
    if (escOn) {
      escOn = false;
      window.removeEventListener('keydown', onEsc, true);
    }
    voyMsg.show('', 1);
    emit();
  },
  /** Le viseur d'une route : l'assignation commence, ou s'annule (second clic). */
  toggle(r: Route): void {
    if (aimKey === r.key) modAim.cancel();
    else modAim.start(r);
  },
  /**
   * Un potard clique pendant l'assignation (son reglage) : la cible de la route (code modDestCodeOf). Un reglage qui n'est
   * pas une cible (un cran, un levier) ne fait rien. true : le clic est pris.
   */
  pick(id: string): boolean {
    const r = modAim.route();
    if (!r) return false;
    const code = modDestCodeOf(id);
    if (code === undefined) {
      voyMsg.show('NOT A TARGET', 900);
      window.setTimeout(() => modAim.route() && voyMsg.show(`CLICK A KNOB > ${aimSourceName(modAim.route()!)}`, 3_600_000), 950);
      return true;
    }
    aimKey = null;
    if (escOn) {
      escOn = false;
      window.removeEventListener('keydown', onEsc, true);
    }
    if (r.kind === 'mx') {
      // un emplacement neuf : LFO 1 et +50 %, pour que l'assignation s'entende tout de suite
      if (srcOf(r) === 0) setVal(`xMx${r.n}Src`, 6 / (MOD_SOURCES.length - 1));
      if (near(valOf(`xMx${r.n}Amt`), 0.5)) setVal(`xMx${r.n}Amt`, 0.75);
    }
    setDest(r, code);
    const rows = modRows();
    const at = rows.findIndex((x) => x.key === r.key);
    voyMsg.show(at >= 0 ? routeSay(r, at + 1) : `${destName(code)}`, 2200);
    emit();
    return true;
  },
};

/** Une source bipolaire (LFO, PITCH BEND, S&H, RANDOM) ? */
export const srcBipolar = (s: number): boolean => MOD_BIPOLAR[s] ?? false;
