/**
 * La memoire des machines de la reverbe facon BigSky (2026-11-16, Mika : "chaque machine garde ses valeurs") : le VST3
 * n'a qu'un jeu de reglages (xSkyDecay... xSkyP5, ceux que l'hote automatise) ; la face garde ici ceux de chaque
 * machine. Choisir une machine (skySelect) range les reglages de celle qu'on quitte et pose ceux de la nouvelle (ses
 * valeurs de depart la premiere fois) ; INIT (skyInit) remet ceux de depart de la machine du moment.
 *
 * Gardee dans le localStorage sous mm.v4.plugin.arp.sky (une cle mm.v4.* : elle part dans l'etat du projet, comme
 * extra.ts). Un changement de machine venu de l'hote (automation, preset) ne recharge rien : les reglages poses restent
 * et se lisent pour la nouvelle machine (le moteur, plugin/mm-arp/dsp/Sky.cpp, fait pareil sans fenetre).
 */

import { arpExtra } from './extra';
import { SKY_FACE, SKY_MACHINES, SKY_SLOTS, skyMachineOf, skyTypeIndex, type SkyMachineDef, type SkyMachineId } from './skyModel';

export const SKY_STORAGE_KEY = 'mm.v4.plugin.arp.sky';
const IDS = [...SKY_FACE, ...SKY_SLOTS] as const;

type Mem = Partial<Record<SkyMachineId, number[]>>;

const defaultsOf = (m: SkyMachineDef): number[] => {
  const d = m.def;
  return [d.decay, d.pre, d.tone, d.mod, d.low, ...Array.from({ length: 5 }, (_, i) => d.p[i] ?? 0)];
};

function load(): Mem {
  const out: Mem = {};
  try {
    const raw = JSON.parse(window.localStorage.getItem(SKY_STORAGE_KEY) ?? 'null') as { mem?: unknown } | null;
    const mem = raw && typeof raw.mem === 'object' && raw.mem ? (raw.mem as Record<string, unknown>) : {};
    for (const m of SKY_MACHINES) {
      const a = mem[m.id];
      if (Array.isArray(a) && a.length === IDS.length && a.every((x) => typeof x === 'number' && Number.isFinite(x))) out[m.id] = (a as number[]).map((x) => Math.min(1, Math.max(0, x)));
    }
  } catch {
    /* illisible ou refuse : les valeurs de depart */
  }
  return out;
}

let mem: Mem = load();
let busy = false;

function save(): void {
  try {
    window.localStorage.setItem(SKY_STORAGE_KEY, JSON.stringify({ v: 1, mem }));
  } catch {
    /* stockage refuse : la memoire dure le temps de la fenetre */
  }
}

const typeNow = (): number => skyTypeIndex(arpExtra.of('xSkyType'));
const now = (): number[] => IDS.map((id) => arpExtra.of(id));

/** Les reglages poses sont ceux de la machine du moment : on les range a chaque geste. */
function capture(): void {
  if (busy) return;
  const m = skyMachineOf(typeNow());
  if (!m) return;
  const v = now();
  const old = mem[m.id];
  if (old && old.every((x, i) => Math.abs(x - v[i]) < 1e-6)) return;
  mem = { ...mem, [m.id]: v };
  save();
}
arpExtra.subscribe(capture);

function write(type: number, vals: readonly number[] | null): void {
  busy = true;
  try {
    arpExtra.set('xSkyType', type / 12);
    if (vals) IDS.forEach((id, i) => arpExtra.set(id, vals[i]));
  } finally {
    busy = false;
  }
  capture();
}

/** Choisir une machine (1 a 12 ; 0 : CLASSIC, la reverbe d'avant) : ses reglages gardes, sinon ceux de depart. */
export function skySelect(type: number): void {
  if (type === typeNow()) return;
  capture();
  const m = skyMachineOf(type);
  write(type, m ? (mem[m.id] ?? defaultsOf(m)) : null);
}

/** INIT : les reglages de depart de la machine du moment. */
export function skyInit(): void {
  const m = skyMachineOf(typeNow());
  if (m) write(typeNow(), defaultsOf(m));
}

/** Les reglages de depart d'une machine (dans l'ordre : DECAY, PRE-DELAY, TONE, MOD, LOW END, P1 a P5). */
export const skyDefaultValues = (m: SkyMachineDef): number[] => defaultsOf(m);
