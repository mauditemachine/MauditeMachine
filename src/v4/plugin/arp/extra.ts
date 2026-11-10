/**
 * Les reglages du VST3 seul (2026-11-10, Mika : "une qualite eblouissante, seulement le VST3, le site on n'y touche
 * pas") : le mode HQ, la seconde destination du LFO de la face, un second LFO, la reverb reglable, la section master.
 * La source unique est plugin/mm-arp/extra-params.json (le C++ lit le meme fichier) : ils ne sont PAS dans
 * voyager/params.ts, le site ne les connait pas. Seule la face du plugin importe ce module.
 *
 * Comme voyParams : des valeurs de 0 a 1, rondes sur leur cran pour un reglage a crans (i / (n - 1)), au millieme
 * sinon. Gardees dans le localStorage sous mm.v4.plugin.arp.extra : une cle mm.v4.*, elle part donc dans l'etat du
 * projet avec le reste (plugin/restore.ts, bridge.ts snapshotLs).
 */

import spec from '../../../../plugin/mm-arp/extra-params.json';

export type ExtraSection = 'engine' | 'lfo1' | 'lfo2' | 'reverb' | 'master';

export interface ExtraParam {
  id: string;
  label: string;
  section: ExtraSection;
  def: number;
  steps?: readonly string[];
  help?: string;
}

export const EXTRA_STORAGE_KEY = 'mm.v4.plugin.arp.extra';

export const EXTRA_PARAMS: readonly ExtraParam[] = (spec.params as readonly ExtraParam[]).map((p) => ({ id: p.id, label: p.label, section: p.section, def: p.def, steps: p.steps, help: p.help }));
export const EXTRA_IDS: readonly string[] = EXTRA_PARAMS.map((p) => p.id);

/** Les blocs, dans l'ordre de l'ecran. */
export const EXTRA_SECTIONS: readonly { id: ExtraSection; title: string }[] = [
  { id: 'engine', title: 'ENGINE' },
  { id: 'lfo1', title: 'LFO 1' },
  { id: 'lfo2', title: 'LFO 2' },
  { id: 'reverb', title: 'REVERB' },
  { id: 'master', title: 'MASTER' },
];

const BY_ID = new Map(EXTRA_PARAMS.map((p) => [p.id, p]));

export const isExtra = (id: string): boolean => BY_ID.has(id);
export const extraParam = (id: string): ExtraParam | undefined => BY_ID.get(id);

export type ExtraValues = Readonly<Record<string, number>>;

/** L'index du cran d'un reglage a crans (0 sinon). */
export function extraStepIndex(id: string, v: number): number {
  const s = BY_ID.get(id)?.steps;
  if (!s) return 0;
  return Math.max(0, Math.min(s.length - 1, Math.round(v * (s.length - 1))));
}

/** Une valeur posee : bornee, ronde sur son cran, au millieme sinon. */
function clean(p: ExtraParam, v: number): number {
  const t = Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : p.def;
  return p.steps ? extraStepIndex(p.id, t) / (p.steps.length - 1) : Math.round(t * 1000) / 1000;
}

const DEFAULTS: ExtraValues = Object.fromEntries(EXTRA_PARAMS.map((p) => [p.id, clean(p, p.def)]));

function load(): Record<string, number> {
  const out: Record<string, number> = { ...DEFAULTS };
  try {
    const raw = JSON.parse(window.localStorage.getItem(EXTRA_STORAGE_KEY) ?? 'null') as { values?: unknown } | null;
    const vals = raw && typeof raw === 'object' && raw.values && typeof raw.values === 'object' ? (raw.values as Record<string, unknown>) : null;
    if (vals) for (const p of EXTRA_PARAMS) if (typeof vals[p.id] === 'number') out[p.id] = clean(p, vals[p.id] as number);
  } catch {
    /* illisible ou stockage refuse : les valeurs de depart */
  }
  return out;
}

let values: ExtraValues = load();
const listeners = new Set<() => void>();

function save(): void {
  try {
    window.localStorage.setItem(EXTRA_STORAGE_KEY, JSON.stringify({ v: 1, values }));
  } catch {
    /* stockage refuse : rien */
  }
}

/* ---------------- le texte d'une valeur ---------------- */

const signed = (x: number, digits: number): string => {
  const r = Number(x.toFixed(digits));
  return r === 0 ? '0' : `${r > 0 ? '+' : ''}${r.toFixed(digits)}`;
};

/** La duree de la reverb (le help du JSON) : 0.6 s a 9.6 s, 2.4 s au centre. */
export const revSizeS = (v: number): number => 2.4 * Math.pow(4, 2 * v - 1);
/** Le pre-delay : 0 a 100 ms. */
export const revPreMs = (v: number): number => 100 * v;
/** BASS, AIR : -6 a +6 dB. */
export const shelfDb = (v: number): number => (v - 0.5) * 12;
/** WIDTH : 0 mono, 100 % celle du site, 200 % le double du cote. */
export const widthPct = (v: number): number => 200 * v;

function text(id: string, v: number): string {
  const p = BY_ID.get(id);
  if (!p) return '';
  if (p.steps) return p.steps[extraStepIndex(id, v)];
  switch (id) {
    case 'xRevSize': {
      const s = revSizeS(v);
      return `${s < 1 ? s.toFixed(2) : s.toFixed(1)} s`;
    }
    case 'xRevPre':
      return `${Math.round(revPreMs(v))} ms`;
    case 'xBass':
    case 'xAir':
      return `${signed(shelfDb(v), 1)} dB`;
    case 'xWidth':
      return v <= 0 ? 'MONO' : `${Math.round(widthPct(v))} %`;
    default:
      return `${Math.round(v * 100)} %`;
  }
}

export const arpExtra = {
  get: (): ExtraValues => values,
  of: (id: string): number => values[id] ?? 0,
  def: (id: string): number => DEFAULTS[id] ?? 0,
  defaults: (): ExtraValues => DEFAULTS,
  /** true si la valeur a change. */
  set(id: string, v: number): boolean {
    const p = BY_ID.get(id);
    if (!p) return false;
    const t = clean(p, v);
    if (t === values[id]) return false;
    values = { ...values, [id]: t };
    save();
    listeners.forEach((fn) => fn());
    return true;
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
  /** Le texte d'une valeur (celle du moment par defaut) : le nom du cran, ou des secondes, ms, dB, %. */
  text: (id: string, v: number = values[id] ?? 0): string => text(id, v),
  /** La cle ecrite meme si rien n'a bouge (l'etat du projet la porte toujours). */
  flush: save,
};
