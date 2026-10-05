/**
 * Le Dock du MM-DECKS au telephone (2026-10-04, Mika : "en mobile tout doit
 * etre disponible avec des knobs plus gros ! la plupart des gens qui vont
 * utiliser mauditemachine.com ce sera en mobile"). Sur la table 3D, un
 * potard fait une trentaine de pixels a l'ecran d'un telephone : la
 * languette MIXER, en bas, ouvre tous ses reglages en gros (les potards de
 * ui/KnobPanel.tsx), un onglet par voie (GAIN, HI, MID, LOW, FILTER et le
 * FADER), FX (les sept effets et TIME), MASTER (le volume et le
 * PLAY/STOP des machines). Ouvert, la table remonte au-dessus (setInset) :
 * on voit ses potards tourner. Memes actions et memes stores que la table
 * (dj/gestures.ts). Retenus : ouvert ou replie (mm.v4.djdock), l'onglet
 * (mm.v4.knobtab.dj).
 */

import React, { useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { machinesToggle } from '../actions';
import { clock } from '../audio/clock';
import type { Stage } from '../scene/renderer';
import { KnobView, useDockInset, type KnobSpec } from '../ui/KnobPanel';
import { arp } from '../voyager/arp';
import { djSetFxTo, djSetTime, fxTarget, fxToText } from './actions';
import { faderMin, faderNeutral, faderValue, knobMin, knobNeutral, knobValue, setFader, setKnob } from './gestures';
import { DJ_FADERS, DJ_KNOBS, type DjFaderSpec, type DjKnobSpec } from './layout';
import { djState } from './state';
import { DJ_CHANNELS, DJ_TIMES, DJ_VIEW_UNITS, djDecks, timeLabel, type DjUnit } from './theme';
import { djView } from './view';
import './dj.css';

const OPEN_KEY = 'mm.v4.djdock';
const TAB_KEY = 'mm.v4.knobtab.dj';
/** Ce qui entre sur chaque voie de la table. */
const CH_NAMES = ['RYTM', 'ARP', 'A', 'B', 'C', 'D'] as const;

const pct = (v: number, signed: boolean): string => {
  const n = Math.round(v * 100);
  return signed && n > 0 ? `+${n}` : `${n}`;
};

function knobSpec(k: DjKnobSpec, where: string): KnobSpec {
  return {
    label: k.label,
    get: () => knobValue(k),
    set: (v) => setKnob(k, v),
    reset: () => knobNeutral(k),
    range: [knobMin(k), 1],
    steps: 0,
    bipolar: k.bipolar,
    readout: () => `${where} ${k.label} ${pct(knobValue(k), k.bipolar)}%`,
    valueText: () => `${pct(knobValue(k), k.bipolar)}${k.bipolar ? '' : '%'}`,
    subscribe: djState.subscribe,
  };
}

function faderSpec(f: DjFaderSpec, where: string): KnobSpec {
  return {
    label: 'FADER',
    get: () => faderValue(f),
    set: (v) => setFader(f, v),
    reset: () => faderNeutral(f),
    range: [faderMin(f), 1],
    steps: 0,
    bipolar: false,
    readout: () => `${where} fader ${pct(faderValue(f), false)}%`,
    valueText: () => `${pct(faderValue(f), false)}%`,
    subscribe: djState.subscribe,
  };
}

/** TIME : les six temps des effets, cran par cran. */
const timeIndex = (): number => Math.max(0, DJ_TIMES.indexOf(djState.get().time as (typeof DJ_TIMES)[number]));
const TIME_SPEC: KnobSpec = {
  label: 'TIME',
  get: timeIndex,
  set: (v) => djSetTime(DJ_TIMES[Math.max(0, Math.min(DJ_TIMES.length - 1, Math.round(v)))]),
  reset: () => DJ_TIMES.indexOf(1),
  range: [0, DJ_TIMES.length - 1],
  steps: DJ_TIMES.length,
  bipolar: false,
  readout: () => `Effects time ${timeLabel(DJ_TIMES[timeIndex()])} beat`,
  valueText: () => timeLabel(DJ_TIMES[timeIndex()]),
  subscribe: djState.subscribe,
  whole: true,
};

/** FX TO (2026-10-04) : ALL puis chaque voie posee, cran par cran. */
function fxToSpec(): KnobSpec {
  return {
    label: 'FX TO',
    get: () => fxTarget() + 1,
    set: (v) => djSetFxTo(Math.round(v) - 1),
    reset: () => 0,
    range: [0, DJ_CHANNELS],
    steps: DJ_CHANNELS + 1,
    bipolar: false,
    readout: () => `Effects on ${fxTarget() < 0 ? 'all channels' : `channel ${fxToText()}`}`,
    valueText: () => fxToText(),
    subscribe: djState.subscribe,
    whole: true,
  };
}

interface Group {
  id: string;
  label: string;
  specs: KnobSpec[];
  /** MASTER : le PLAY/STOP des machines sous ses potards */
  transport?: boolean;
}

/** Les onglets pour les voies posees (elles changent avec le nombre de platines). */
function buildGroups(): Group[] {
  const groups: Group[] = [];
  for (let ch = 0; ch < DJ_CHANNELS; ch += 1) {
    const where = `Channel ${ch + 1} (${CH_NAMES[ch]})`;
    const knobs = DJ_KNOBS.filter((k) => k.target.kind === 'eq' && k.target.ch === ch).map((k) => knobSpec(k, where));
    const fader = DJ_FADERS.find((f) => f.target.kind === 'channel' && f.target.ch === ch);
    groups.push({ id: `ch${ch + 1}`, label: `${ch + 1} ${CH_NAMES[ch]}`, specs: fader ? [...knobs, faderSpec(fader, where)] : knobs });
  }
  groups.push({ id: 'fx', label: 'FX', specs: [...DJ_KNOBS.filter((k) => k.target.kind === 'fx').map((k) => knobSpec(k, 'Effect')), TIME_SPEC, fxToSpec()] });
  const master = DJ_KNOBS.find((k) => k.target.kind === 'master');
  groups.push({ id: 'master', label: 'MASTER', specs: master ? [knobSpec(master, 'Master')] : [], transport: true });
  return groups;
}

/**
 * La vue de la table qui montre un onglet (le telephone cadre un bloc a la
 * fois) : les voies 1 et 2 et les effets a gauche, les autres voies et
 * MASTER a droite.
 */
function showTab(id: string): void {
  const views = DJ_VIEW_UNITS.filter((u): u is DjUnit => u === 'mix1' || u === 'mix2' || u === 'mix3');
  if (views.length === 0) return;
  const ch = id.startsWith('ch') ? Number(id.slice(2)) : 0;
  const left = id === 'fx' || ch === 1 || ch === 2;
  djView.set(left ? views[0] : views[views.length - 1]);
}

function readBool(key: string): boolean {
  try {
    return window.localStorage.getItem(key) === 'open';
  } catch {
    return false;
  }
}

function readTab(): string | null {
  try {
    return window.localStorage.getItem(TAB_KEY);
  } catch {
    return null;
  }
}

/** Le MM-RYTM ou le MM-ARP joue. */
const subscribeMachines = (fn: () => void): (() => void) => {
  const a = clock.subscribe(fn);
  const b = arp.subscribe(fn);
  return () => {
    a();
    b();
  };
};
const machinesOn = (): boolean => clock.running || arp.get().running;

export const DjMixDock: React.FC<{ getStage: () => Stage | null }> = ({ getStage }) => {
  const [shown, setShown] = useState(() => readBool(OPEN_KEY));
  const decks = useSyncExternalStore(djDecks.subscribe, djDecks.get, djDecks.get);
  const groups = useMemo(() => buildGroups(), [decks]);
  const [tab, setTab] = useState(readTab);
  const playing = useSyncExternalStore(subscribeMachines, machinesOn, machinesOn);
  const ref = useRef<HTMLDivElement>(null);
  useDockInset(getStage(), 'dj', shown, ref);
  const g = groups.find((x) => x.id === tab) ?? groups[0];

  const toggle = (): void => {
    const next = !shown;
    setShown(next);
    // Ouvert : la table vient a l'ecran, a la place qui montre l'onglet
    if (next) showTab(g.id);
    try {
      window.localStorage.setItem(OPEN_KEY, next ? 'open' : 'closed');
    } catch {
      /* stockage indisponible : le choix vaut pour la visite */
    }
  };
  const pick = (id: string): void => {
    setTab(id);
    showTab(id);
    try {
      window.localStorage.setItem(TAB_KEY, id);
    } catch {
      /* stockage indisponible : l'onglet vaut pour la visite */
    }
  };

  return (
    <>
      <button
        type="button"
        className="v4-dock-tab v4-djdock-tab"
        data-open={shown ? '1' : '0'}
        data-page="knobs"
        aria-expanded={shown}
        aria-controls="v4-djdock"
        aria-label={shown ? 'Hide the mixer knobs' : 'Show the mixer knobs'}
        onClick={toggle}
      >
        <span aria-hidden="true">MIXER</span>
        <i className={`fa-solid ${shown ? 'fa-chevron-down' : 'fa-chevron-up'} v4-fa`} aria-hidden="true" />
      </button>
      <div ref={ref} id="v4-djdock" className="v4-dock v4-djdock" data-open={shown ? '1' : '0'} data-page="knobs" aria-hidden={!shown || undefined}>
        <div className="v4-knobs">
          <div className="v4-knobs-tabs" role="tablist" aria-label="Mixer sections">
            {groups.map((x) => (
              <button key={x.id} type="button" role="tab" aria-selected={x.id === g.id} className="v4-knobs-tab" onClick={() => pick(x.id)}>
                {x.label}
              </button>
            ))}
          </div>
          <div className="v4-knobs-grid" role="tabpanel" aria-label={g.label}>
            {g.specs.map((spec) => (
              <KnobView key={`${g.id}-${spec.label}`} spec={spec} />
            ))}
          </div>
          {g.transport && (
            <button type="button" className="v4-djdock-play" data-on={playing ? '1' : '0'} aria-pressed={playing} aria-label="Play or stop the MM-RYTM and the MM-ARP together" onClick={() => machinesToggle()}>
              <i className={`fa-solid ${playing ? 'fa-stop' : 'fa-play'} v4-fa`} aria-hidden="true" />
              <span>{playing ? 'STOP' : 'PLAY'} RYTM + ARP</span>
            </button>
          )}
        </div>
      </div>
    </>
  );
};

export default DjMixDock;
