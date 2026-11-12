/**
 * LIBRARY : la banque d'usine du VST3 (2026-11-10, Mika : "les presets pourraient etre meilleurs, plus de disco a la Donna
 * Summer et de trucs hypnotiques"). La banque est plugin/mm-arp/presets/factory.json (ecrite par presets/build.mjs) :
 * seule la face du plugin l'importe, le site ne la contient pas. Depuis le format large (2026-11-11) :
 * - LibraryBank, une section du panneau d'OPEN (HoodPanel.tsx) : les QUATRE categories cote a cote (DISCO, HYPNOTIC, DARK,
 *   TEXTURE), les 40 presets visibles d'un coup dans une fenetre de verre ; un clic charge le preset
 *   (arpBridge.factoryLoad : comme un preset du disque, QUALITY garde sa valeur), Haut / Bas parcourent ; dessous, le
 *   preset charge : son nom, sa phrase, le tempo conseille, PREV et NEXT ;
 * - libStore et libStep : l'afficheur du bandeau (Header.tsx) montre le preset charge et ses fleches chargent le
 *   precedent ou le suivant, capot ferme compris.
 */

import React, { useSyncExternalStore } from 'react';
import bank from '../../../../plugin/mm-arp/presets/factory.json';
import { arpBridge } from './bridge';
import { Sec } from './SoundPlus';

export type LibCat = 'DISCO' | 'HYPNOTIC' | 'DARK' | 'TEXTURE';

export interface FactoryPreset {
  name: string;
  cat: LibCat;
  desc: string;
  bpm: number;
  knobs: Record<string, number>;
  seq: unknown;
  prog: number[];
  extra?: Record<string, number>;
  /** les pistes du STEP SEQUENCER du module avant (steps.ts), si le preset en porte */
  steps?: unknown;
}

export const LIB_PRESETS = (bank as { presets: FactoryPreset[] }).presets;
export const LIB_CATS: readonly LibCat[] = ['DISCO', 'HYPNOTIC', 'DARK', 'TEXTURE'];
const PRESETS = LIB_PRESETS;
const CATS = LIB_CATS;
const ofCat = (c: LibCat): FactoryPreset[] => PRESETS.filter((p) => p.cat === c);

/** La categorie montree et le preset charge (son nom ; null : aucun depuis l'ouverture de la fenetre). */
let state: { cat: LibCat; current: string | null } = { cat: 'DISCO', current: null };
const listeners = new Set<() => void>();
const setState = (next: Partial<typeof state>): void => {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
};
export const libStore = {
  get: () => state,
  subscribe(fn: () => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};

function load(p: FactoryPreset): void {
  if (arpBridge.factoryLoad(p)) setState({ cat: p.cat, current: p.name });
}

/** Le preset charge (null : aucun depuis l'ouverture de la fenetre), sa place dans sa categorie. */
export function libCurrent(): { preset: FactoryPreset; at: number; of: number } | null {
  const cur = PRESETS.find((p) => p.name === state.current);
  if (!cur) return null;
  const list = ofCat(cur.cat);
  return { preset: cur, at: list.indexOf(cur), of: list.length };
}

/**
 * Le precedent (-1) ou le suivant (+1) : dans toute la banque, d'une categorie a la suivante ; sans preset charge : le
 * premier ou le dernier.
 */
export function libStep(d: 1 | -1): void {
  const all = CATS.flatMap(ofCat);
  if (all.length === 0) return;
  const i = all.findIndex((p) => p.name === state.current);
  const j = i < 0 ? (d > 0 ? 0 : all.length - 1) : (i + d + all.length) % all.length;
  load(all[j]);
  document.querySelector<HTMLElement>(`.mm-arp-lib-item[data-name="${CSS.escape(all[j].name)}"]`)?.scrollIntoView({ block: 'nearest' });
}

const useLib = () => useSyncExternalStore(libStore.subscribe, libStore.get, libStore.get);

const Key: React.FC<{ legend: string; onClick: () => void; className?: string; label?: string; glyph?: string }> = ({ legend, onClick, className, label, glyph }) => (
  <button type="button" className={`mm-arp-kb${className ? ` ${className}` : ''}`} data-size="s" aria-label={label} onClick={onClick}>
    <span className="mm-arp-k" aria-hidden="true">
      {glyph && <span className="mm-arp-k-glyph">{glyph}</span>}
    </span>
    <span className="mm-arp-legend">{legend}</span>
  </button>
);

/** La section LIBRARY du panneau d'OPEN : la banque entiere, puis le preset charge. */
export const LibraryBank: React.FC = () => {
  const st = useLib();
  const cur = libCurrent();
  return (
    <>
      <Sec id="library" title="LIBRARY" className="mm-arp-lib" col={7} span={10} row={0} side={`${PRESETS.length} SOUNDS`}>
        <div
          className="mm-arp-lib-bank"
          onKeyDown={(e) => {
            if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
            e.preventDefault();
            e.stopPropagation();
            libStep(e.key === 'ArrowDown' ? 1 : -1);
            window.setTimeout(() => document.querySelector<HTMLElement>('.mm-arp-lib-item[data-on="1"]')?.focus(), 0);
          }}
        >
          {CATS.map((c) => {
            const list = ofCat(c);
            return (
              <div key={c} className="mm-arp-lib-col" data-cat={c}>
                <p className="mm-arp-lib-cat" aria-hidden="true">
                  <span>{c}</span>
                  <span>{list.length}</span>
                </p>
                <ul className="mm-arp-list" aria-label={`${c} presets`}>
                  {list.map((p) => (
                    <li key={p.name}>
                      <button type="button" className="mm-arp-disk-item mm-arp-lib-item" data-name={p.name} data-on={p.name === st.current ? '1' : undefined} aria-current={p.name === st.current ? 'true' : undefined} onClick={() => load(p)}>
                        <span className="mm-arp-lib-t">{p.name}</span>
                        <span className="mm-arp-lib-bpm">{p.bpm}</span>
                      </button>
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        </div>
      </Sec>
      {/* Le preset charge, sur la quatrieme rangee : son nom, ce qu'il est ; PREV et NEXT au bout, sur la ligne */}
      <Sec
        id="library-now"
        title={cur ? `${cur.preset.cat} · ${String(cur.at + 1).padStart(2, '0')} / ${String(cur.of).padStart(2, '0')}` : 'NO PRESET LOADED'}
        className="mm-arp-lib-now"
        col={7}
        span={10}
        row={3}
        fill
        side={cur ? <span className="mm-arp-lib-tempo">{cur.preset.bpm} BPM</span> : undefined}
      >
        <div className="mm-arp-lib-screen" role="status" aria-live="polite">
          <p className="mm-arp-lib-name">{cur ? cur.preset.name : 'PICK A PRESET'}</p>
          <p className="mm-arp-lib-desc">{cur ? cur.preset.desc : 'It loads at once (UNDO brings back your sound). The tempo shown is the one it was made at.'}</p>
        </div>
        <div className="mm-arp-cells mm-arp-lib-nav" style={{ position: 'absolute', right: 0, top: 0 }}>
          <Key className="mm-arp-lib-prev" legend="PREV" glyph="◀" label="Previous preset" onClick={() => libStep(-1)} />
          <Key className="mm-arp-lib-next" legend="NEXT" glyph="▶" label="Next preset" onClick={() => libStep(1)} />
        </div>
      </Sec>
    </>
  );
};
