/**
 * STRETCH (revision 5) : etirement temporel du bus de batterie par
 * granulation, de 0 a 1. Un AudioWorklet enregistre la sortie du bus dans
 * un tampon circulaire de 2 s et la relit par grains (60 ms au plus bas,
 * 120 ms a fond), fenetre de Hann, recouvrement de 50 % ; la tete de
 * lecture avance `ratio` fois moins vite que la tete d'ecriture (1 a 4) :
 * le son s'etire sans changer de hauteur (chaque grain se lit a vitesse 1).
 * Quand le retard depasse le tampon, la lecture revient au present (le
 * fondu des grains fait la jonction). Le sequenceur ne ralentit pas.
 *
 * Melange : sec 1 - v, etire v. A 0 : bypass reel (audio/insert.ts), le
 * worklet est debranche et s'arrete (process rend false) ; aucun
 * traitement au repos. Le module se charge au premier reglage au-dessus
 * de 0, depuis une URL blob (aucun fichier de plus).
 */

import { glide } from './fx';
import { Insert, type InsertInfo } from './insert';

export const STRETCH = { maxRatio: 4, bufferS: 2, grainMinS: 0.06, grainMaxS: 0.12 } as const;

export const clampStretch = (v: number): number => (Number.isFinite(v) ? (v < 0 ? 0 : v > 1 ? 1 : v) : 0);
export const stretchRatio = (v: number): number => 1 + (STRETCH.maxRatio - 1) * clampStretch(v);

const PROCESSOR = 'mm-stretch';

/** Le processeur, en JS simple (il tourne dans le fil audio, hors du bundle). */
const WORKLET_SOURCE = `
class MmStretch extends AudioWorkletProcessor {
  static get parameterDescriptors() {
    return [{ name: 'ratio', defaultValue: 1, minValue: 1, maxValue: ${STRETCH.maxRatio}, automationRate: 'k-rate' }];
  }
  constructor() {
    super();
    this.size = Math.round(${STRETCH.bufferS} * sampleRate);
    this.buf = new Float32Array(this.size);
    this.w = 0;
    this.read = 0;
    this.next = 0;
    this.grains = [];
    this.alive = true;
    this.grainsMade = 0;
    this.jumps = 0;
    this.port.onmessage = (e) => {
      if (e.data === 'stop') this.alive = false;
      else if (e.data === 'stats') this.port.postMessage({ grains: this.grainsMade, jumps: this.jumps, lag: (this.w - this.read) / sampleRate });
    };
  }
  grainLen(ratio) {
    const t = (ratio - 1) / ${STRETCH.maxRatio - 1};
    const s = ${STRETCH.grainMinS} + (${STRETCH.grainMaxS - STRETCH.grainMinS}) * t;
    return Math.max(64, Math.round(s * sampleRate)) & ~1;
  }
  process(inputs, outputs, params) {
    if (!this.alive) return false;
    const input = inputs[0] && inputs[0][0];
    const out = outputs[0][0];
    if (!out) return true;
    const ratio = params.ratio[0];
    const size = this.size;
    const buf = this.buf;
    for (let i = 0; i < out.length; i += 1) {
      buf[this.w % size] = input ? input[i] : 0;
      this.w += 1;
      if (this.next <= 0) {
        const len = this.grainLen(ratio);
        // Retour au present quand le retard sort du tampon
        if (this.read > this.w - len || this.read < this.w - size + 2 * len) {
          if (this.grainsMade > 0) this.jumps += 1;
          this.read = this.w - len;
        }
        const start = Math.floor(this.read);
        this.grains.push({ start, pos: 0, len });
        this.grainsMade += 1;
        this.read += len / 2 / ratio;
        this.next += len / 2;
      }
      this.next -= 1;
      let y = 0;
      for (let g = this.grains.length - 1; g >= 0; g -= 1) {
        const gr = this.grains[g];
        const idx = gr.start + gr.pos;
        const s = idx >= 0 ? buf[idx % size] : 0;
        // Hann periodique : deux grains a 50 % somment a 1
        y += s * (0.5 - 0.5 * Math.cos((2 * Math.PI * gr.pos) / gr.len));
        gr.pos += 1;
        if (gr.pos >= gr.len) this.grains.splice(g, 1);
      }
      out[i] = y;
    }
    return true;
  }
}
registerProcessor('${PROCESSOR}', MmStretch);
`;

const modules = new WeakMap<BaseAudioContext, Promise<boolean>>();

/** Charge le processeur une fois par contexte ; false si l'AudioWorklet manque ou echoue. */
function loadModule(c: BaseAudioContext): Promise<boolean> {
  let p = modules.get(c);
  if (p) return p;
  const wl = (c as BaseAudioContext & { audioWorklet?: AudioWorklet }).audioWorklet;
  if (!wl || typeof AudioWorkletNode === 'undefined') {
    p = Promise.resolve(false);
  } else {
    const url = URL.createObjectURL(new Blob([WORKLET_SOURCE], { type: 'application/javascript' }));
    p = wl.addModule(url).then(
      () => {
        URL.revokeObjectURL(url);
        return true;
      },
      () => {
        URL.revokeObjectURL(url);
        return false;
      }
    );
  }
  modules.set(c, p);
  return p;
}

export interface StretchInfo {
  value: number;
  ratio: number;
  /** worklet vivant (branche ou en fondu de sortie) */
  worklet: boolean;
  /** worklets crees depuis le chargement */
  created: number;
  /** module charge (null : pas encore demande) */
  module: boolean | null;
  insert: InsertInfo;
}

export interface StretchStage {
  input: AudioNode;
  set(v: number): void;
  reset(): void;
  info(): StretchInfo;
  /** charge le processeur (une fois par contexte) ; false s'il manque */
  ready(): Promise<boolean>;
  /** debug : compteurs du processeur (grains, sauts, retard) */
  stats(): Promise<unknown>;
}

export function buildStretch(c: BaseAudioContext, out: AudioNode, v0: number): StretchStage {
  const input = c.createGain();
  input.gain.value = 1;
  const insert = new Insert(c, input, out);
  let value = 0;
  let node: AudioWorkletNode | null = null;
  let created = 0;
  let module: boolean | null = null;

  // Repos atteint : le worklet s'arrete et sort du graphe
  insert.onIdle = () => {
    if (!node) return;
    node.port.postMessage('stop');
    node.disconnect();
    node = null;
  };

  const apply = (): void => {
    if (value === 0) {
      insert.release();
      return;
    }
    if (!node) {
      node = new AudioWorkletNode(c, PROCESSOR, { numberOfInputs: 1, numberOfOutputs: 1, outputChannelCount: [1], channelCount: 1, channelCountMode: 'explicit' });
      created += 1;
      insert.setBranch(node, node);
    }
    const ratio = node.parameters.get('ratio');
    if (ratio) glide(ratio, stretchRatio(value), c);
    insert.engage(1 - value, value);
  };

  const ready = (): Promise<boolean> =>
    loadModule(c).then((ok) => {
      module = ok;
      return ok;
    });

  const set = (v: number): void => {
    const t = clampStretch(v);
    if (t === value) return;
    value = t;
    if (t === 0 || module === true) {
      apply();
      return;
    }
    void ready().then((ok) => {
      if (ok) apply();
    });
  };

  set(v0);

  return {
    input,
    set,
    reset: () => {
      value = 0;
      insert.reset();
    },
    ready,
    info: () => ({ value, ratio: stretchRatio(value), worklet: node !== null, created, module, insert: insert.info() }),
    stats: () =>
      new Promise((resolve) => {
        const n = node;
        if (!n) {
          resolve(null);
          return;
        }
        const on = (e: MessageEvent): void => {
          n.port.removeEventListener('message', on);
          resolve(e.data);
        };
        n.port.addEventListener('message', on);
        n.port.start();
        n.port.postMessage('stats');
        setTimeout(() => resolve(null), 500);
      }),
  };
}
