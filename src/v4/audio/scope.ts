/**
 * L'oscilloscope (2026-10-04, Mika, avec une capture d'occularScope sur sa
 * piste de kick : "dans OPEN je voudrais un oscilloscope pour voir l'onde
 * comme le fait occularScope ; un peu parametrable, et de ce fait on peut
 * voir si la phase bouge ou pas ; je veux quelque chose d'ultra precis").
 *
 * Ce module prend le son a l'echantillon pres : un AudioWorklet
 * (audio/scope.worklet.js) recopie deux prises par blocs de 1024
 * echantillons, numerotes sur l'horloge du contexte, dans un tampon
 * circulaire de RING echantillons (pres de 11 s a 48 kHz). L'ecran
 * (ui/Scope.tsx) y lit la fenetre qu'il montre, calee sur la grille des
 * temps (celle du MM-RYTM, ou de l'arpege qui joue seul) : un son qui se
 * repete a chaque fenetre reste immobile, une phase qui bouge se voit.
 *
 * Les prises (audio/drums.ts scopeTaps) : la sortie du MM-RYTM, le kick
 * seul, la sortie du MM-ARP, le kick et l'arpege ensemble (deux traces),
 * ce qui sort du site. Rien n'est envoye aux enceintes : la sortie du
 * processeur passe par un gain a 0. En veille quand l'ecran est cache.
 */

import scopeUrl from './scope.worklet.js?url';
import { clock } from './clock';
import { scopeTaps } from './drums';
import { arp } from '../voyager/arp';

export type ScopeSource = 'rytm' | 'kick' | 'arp' | 'kickarp' | 'master';
export const SCOPE_SOURCES: readonly ScopeSource[] = ['rytm', 'kick', 'arp', 'kickarp', 'master'];
export const SCOPE_SOURCE_LABEL: Readonly<Record<ScopeSource, string>> = { rytm: 'RYTM', kick: 'KICK', arp: 'ARP', kickarp: 'KICK+ARP', master: 'OUT' };

/** Ce qu'on regarde : gauche et droite, le milieu (la somme), le cote (la difference), ou le goniometre (XY). */
export type ScopeView = 'lr' | 'mid' | 'side' | 'xy';
export const SCOPE_VIEWS: readonly ScopeView[] = ['lr', 'mid', 'side', 'xy'];
export const SCOPE_VIEW_LABEL: Readonly<Record<ScopeView, string>> = { lr: 'L/R', mid: 'MID', side: 'SIDE', xy: 'XY' };

/** La fenetre, en pas de seize : 1/16, 1/8, 1/4 (un temps), 1/2, une mesure. */
export const SCOPE_WINDOWS = [1, 2, 4, 8, 16] as const;
export const SCOPE_WINDOW_LABEL: Readonly<Record<number, string>> = { 1: '1/16', 2: '1/8', 4: '1/4', 8: '1/2', 16: '1 BAR' };
/** Le gain de l'affichage (x1 : 0 dBFS au bord). */
export const SCOPE_GAINS = [1, 2, 4, 8, 16] as const;
/** Les fenetres passees laissees en fantome (la persistance du phosphore). */
export const SCOPE_HOLDS = [0, 1, 3, 7] as const;

export interface ScopeSettings {
  /** null : la machine ouverte (RYTM ou ARP) */
  source: ScopeSource | null;
  view: ScopeView;
  window: number;
  gain: number;
  hold: number;
  /** BEAT : cale sur la grille des temps ; AUTO : sur un front montant (rien ne joue) */
  trig: 'beat' | 'auto';
  freeze: boolean;
  /** l'ecran ouvert (capot ouvert) ou replie en pastille */
  shown: boolean;
  /** desktop : le coin haut gauche du panneau deplace (px de la fenetre), ou null (a droite, au milieu) */
  pos: { x: number; y: number } | null;
}

const DEFAULTS: ScopeSettings = { source: null, view: 'mid', window: 4, gain: 1, hold: 3, trig: 'beat', freeze: false, shown: true, pos: null };
const KEY = 'mm.v4.scope.1';

function load(): ScopeSettings {
  const s = { ...DEFAULTS };
  try {
    const raw = window.localStorage.getItem(KEY);
    if (!raw) return s;
    const o = JSON.parse(raw) as Partial<ScopeSettings>;
    if (o.source === null || (typeof o.source === 'string' && (SCOPE_SOURCES as readonly string[]).includes(o.source))) s.source = o.source ?? null;
    if (typeof o.view === 'string' && (SCOPE_VIEWS as readonly string[]).includes(o.view)) s.view = o.view;
    if (typeof o.window === 'number' && (SCOPE_WINDOWS as readonly number[]).includes(o.window)) s.window = o.window;
    if (typeof o.gain === 'number' && (SCOPE_GAINS as readonly number[]).includes(o.gain)) s.gain = o.gain;
    if (typeof o.hold === 'number' && (SCOPE_HOLDS as readonly number[]).includes(o.hold)) s.hold = o.hold;
    if (o.trig === 'beat' || o.trig === 'auto') s.trig = o.trig;
    if (typeof o.shown === 'boolean') s.shown = o.shown;
    if (o.pos && Number.isFinite(o.pos.x) && Number.isFinite(o.pos.y)) s.pos = { x: o.pos.x, y: o.pos.y };
  } catch {
    /* rien de retenu : les reglages de depart */
  }
  return s;
}

let settings: ScopeSettings = typeof window === 'undefined' ? { ...DEFAULTS } : load();
const listeners = new Set<() => void>();

export const scopeSettings = {
  get: (): ScopeSettings => settings,
  set(patch: Partial<ScopeSettings>): void {
    settings = { ...settings, ...patch };
    try {
      // FREEZE ne se retient pas : une visite repart en direct
      const { freeze: _f, ...keep } = settings;
      window.localStorage.setItem(KEY, JSON.stringify(keep));
    } catch {
      /* stockage plein ou refuse : les reglages vivent pour la visite */
    }
    listeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

/* ---------------- la prise ---------------- */

/** Le tampon circulaire : 2^19 echantillons par canal (A gauche, A droite, B). */
export const RING = 1 << 19;
const ring = { aL: new Float32Array(RING), aR: new Float32Array(RING), b: new Float32Array(RING) };
export type ScopeChannel = keyof typeof ring;

let node: AudioWorkletNode | null = null;
let sink: GainNode | null = null;
let loading: Promise<boolean> | null = null;
let wired: { a: AudioNode | null; b: AudioNode | null } = { a: null, b: null };
/** le numero de l'echantillon qui suit le dernier recu, et le premier valable depuis la sortie de veille */
let end = 0;
let first = 0;
let rate = 48000;
let active = false;

function onChunk(e: MessageEvent<{ at: number; aL: Float32Array; aR: Float32Array; b: Float32Array }>): void {
  const d = e.data;
  const n = d.aL.length;
  const i0 = d.at % RING;
  const head = Math.min(n, RING - i0);
  for (const k of ['aL', 'aR', 'b'] as const) {
    const src = d[k];
    const dst = ring[k];
    dst.set(src.subarray(0, head), i0);
    if (head < n) dst.set(src.subarray(head), 0);
  }
  if (end === 0 || d.at > end + RING) first = d.at;
  end = d.at + n;
}

async function ensureNode(): Promise<boolean> {
  if (node) return true;
  const taps = scopeTaps();
  if (!taps) return false;
  if (!loading) {
    loading = (async () => {
      try {
        await taps.ctx.audioWorklet.addModule(scopeUrl);
        const n = new AudioWorkletNode(taps.ctx, 'mm-scope', { numberOfInputs: 2, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 2, channelCountMode: 'explicit' });
        n.port.onmessage = onChunk;
        // Le processeur doit etre tire par le graphe : sa sortie (silencieuse) passe par un gain a 0
        const g = taps.ctx.createGain();
        g.gain.value = 0;
        n.connect(g);
        g.connect(taps.ctx.destination);
        node = n;
        sink = g;
        rate = taps.ctx.sampleRate;
        return true;
      } catch {
        loading = null;
        return false;
      }
    })();
  }
  return loading;
}

function unwire(): void {
  if (!node) return;
  for (const src of [wired.a, wired.b]) {
    if (!src) continue;
    try {
      src.disconnect(node);
    } catch {
      /* deja debranchee */
    }
  }
  wired = { a: null, b: null };
}

/** Les prises d'une source : A (stereo) et B (la seconde trace, KICK+ARP). */
function tapsOf(s: ScopeSource): { a: AudioNode | null; b: AudioNode | null } {
  const t = scopeTaps();
  if (!t) return { a: null, b: null };
  if (s === 'rytm') return { a: t.rytm, b: null };
  if (s === 'kick') return { a: t.kick, b: null };
  if (s === 'arp') return { a: t.arp, b: null };
  if (s === 'kickarp') return { a: t.kick, b: t.arp };
  return { a: t.master, b: null };
}

export const scopeEngine = {
  /** Ecouter une source ; false si le son n'est pas encore la (aucun geste). */
  async start(s: ScopeSource): Promise<boolean> {
    if (!(await ensureNode()) || !node) return false;
    unwire();
    const w = tapsOf(s);
    if (w.a) w.a.connect(node, 0, 0);
    if (w.b) w.b.connect(node, 0, 1);
    wired = w;
    if (!active) {
      active = true;
      end = 0;
      node.port.postMessage({ on: true });
    }
    return true;
  },
  /** Veille : plus de prise, plus d'envoi. */
  stop(): void {
    unwire();
    if (node && active) node.port.postMessage({ on: false });
    active = false;
  },
  get ready(): boolean {
    return node !== null && active;
  },
  /** L'echantillon qui suit le dernier recu (horloge du contexte). */
  get end(): number {
    return end;
  },
  /** Le premier echantillon encore valable dans le tampon. */
  get first(): number {
    return Math.max(first, end - RING);
  },
  get sampleRate(): number {
    return rate;
  },
  /** Un echantillon d'un canal (0 hors de la bande valable). */
  at(ch: ScopeChannel, f: number): number {
    if (f < this.first || f >= end) return 0;
    return ring[ch][f % RING];
  },
  /** Le canal brut (lecture directe, f % RING ; f dans [first, end)). */
  raw(ch: ScopeChannel): Float32Array {
    return ring[ch];
  },
  /**
   * La grille des temps a t (temps du contexte) : la premiere frontiere de
   * pas a t ou apres, son numero (0 a 15), sa duree ; celle du MM-RYTM, ou
   * de l'arpege qui joue seul ; null si rien ne joue.
   */
  grid(t: number): { time: number; step: number; dur: number } | null {
    return clock.gridAfter(t) ?? arp.grid(t);
  },
  info: () => ({ ready: node !== null, active, end, first: Math.max(first, end - RING), rate, sink: sink !== null }),
};
