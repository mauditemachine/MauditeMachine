/**
 * LIBRARY : la banque d'usine du VST3 (2026-11-10, Mika : "les presets pourraient etre meilleurs, plus de disco a la Donna
 * Summer et de trucs hypnotiques"), une page du panneau du capot (HoodPanel.tsx). La banque est
 * plugin/mm-arp/presets/factory.json (ecrite par presets/build.mjs) : seule la face du plugin l'importe, le site ne la
 * contient pas. Trois sections dans la langue de la face avant :
 * - CATEGORY : quatre touches et leur LED (DISCO, HYPNOTIC, DARK, TEXTURE) ;
 * - PRESETS : la liste de la categorie dans une fenetre de verre ; un clic charge le preset (arpBridge.factoryLoad : comme
 *   un preset du disque, QUALITY garde sa valeur), Haut / Bas parcourent ;
 * - le preset : son nom, sa phrase, le tempo conseille, et PREV / NEXT (qui chargent le precedent, le suivant).
 */

import React, { useSyncExternalStore } from 'react';
import bank from '../../../../plugin/mm-arp/presets/factory.json';
import { arpBridge } from './bridge';

export type LibCat = 'DISCO' | 'HYPNOTIC' | 'DARK' | 'TEXTURE';

interface FactoryPreset {
  name: string;
  cat: LibCat;
  desc: string;
  bpm: number;
  knobs: Record<string, number>;
  seq: unknown;
  prog: number[];
  extra?: Record<string, number>;
}

const PRESETS = (bank as { presets: FactoryPreset[] }).presets;
const CATS: readonly LibCat[] = ['DISCO', 'HYPNOTIC', 'DARK', 'TEXTURE'];
const ofCat = (c: LibCat): FactoryPreset[] => PRESETS.filter((p) => p.cat === c);

/** La categorie montree et le preset charge (son nom ; null : aucun depuis l'ouverture de la fenetre). */
let state: { cat: LibCat; current: string | null } = { cat: 'DISCO', current: null };
const listeners = new Set<() => void>();
const setState = (next: Partial<typeof state>): void => {
  state = { ...state, ...next };
  listeners.forEach((fn) => fn());
};
const lib = {
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

/** Le precedent (-1) ou le suivant (+1) dans la categorie montree ; sans preset charge : le premier ou le dernier. */
function step(d: 1 | -1): void {
  const list = ofCat(state.cat);
  if (list.length === 0) return;
  const i = list.findIndex((p) => p.name === state.current);
  const j = i < 0 ? (d > 0 ? 0 : list.length - 1) : (i + d + list.length) % list.length;
  load(list[j]);
  document.querySelector<HTMLElement>(`.mm-arp-lib-item[data-name="${CSS.escape(list[j].name)}"]`)?.scrollIntoView({ block: 'nearest' });
}

const useLib = () => useSyncExternalStore(lib.subscribe, lib.get, lib.get);

const Key: React.FC<{ legend: string; led?: boolean; onClick: () => void; className?: string; label?: string; role?: string; checked?: boolean; glyph?: string }> = ({ legend, led, onClick, className, label, role, checked, glyph }) => (
  <button type="button" className={`mm-arp-kb${className ? ` ${className}` : ''}`} data-size="s" role={role} aria-checked={role === 'radio' ? checked : undefined} aria-label={label} onClick={onClick}>
    {led !== undefined && <span className="mm-arp-led" data-on={led ? '1' : undefined} aria-hidden="true" />}
    <span className="mm-arp-k" aria-hidden="true">
      {glyph && <span className="mm-arp-k-glyph">{glyph}</span>}
    </span>
    <span className="mm-arp-legend">{legend}</span>
  </button>
);

export const Library: React.FC = () => {
  const st = useLib();
  const list = ofCat(st.cat);
  const cur = PRESETS.find((p) => p.name === st.current) ?? null;
  const at = cur ? ofCat(cur.cat).indexOf(cur) : -1;
  return (
    <div className="mm-arp-page mm-arp-library" role="tabpanel" id="mm-arp-panel-library" aria-labelledby="mm-arp-tab-library">
      <section className="mm-arp-col mm-arp-lib-cats" aria-label="Category">
        <p className="mm-arp-col-title">CATEGORY</p>
        <div className="mm-arp-lib-grid" role="radiogroup" aria-label="Preset category">
          {CATS.map((c) => (
            <Key key={c} role="radio" checked={st.cat === c} className="mm-arp-lib-cat" legend={c} led={st.cat === c} onClick={() => setState({ cat: c })} />
          ))}
        </div>
        <p className="mm-arp-lib-count" aria-hidden="true">
          {PRESETS.length} FACTORY SOUNDS
        </p>
      </section>
      <section className="mm-arp-col mm-arp-lib-list" aria-label="Presets">
        <p className="mm-arp-col-title">PRESETS</p>
        <div className="mm-arp-glass">
          <p className="mm-arp-glass-head" aria-hidden="true">
            {st.cat} · {list.length}
          </p>
          <ul
            className="mm-arp-list"
            aria-label={`${st.cat} presets`}
            onKeyDown={(e) => {
              if (e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
              e.preventDefault();
              e.stopPropagation();
              step(e.key === 'ArrowDown' ? 1 : -1);
              window.setTimeout(() => document.querySelector<HTMLElement>('.mm-arp-lib-item[data-on="1"]')?.focus(), 0);
            }}
          >
            {list.map((p, i) => (
              <li key={p.name}>
                <button type="button" className="mm-arp-disk-item mm-arp-lib-item" data-name={p.name} data-on={p.name === st.current ? '1' : undefined} aria-current={p.name === st.current ? 'true' : undefined} title={p.desc} onClick={() => load(p)}>
                  <span className="mm-arp-lib-n">{String(i + 1).padStart(2, '0')}</span>
                  {p.name}
                  <span className="mm-arp-lib-bpm">{p.bpm}</span>
                </button>
              </li>
            ))}
          </ul>
        </div>
      </section>
      <section className="mm-arp-col mm-arp-lib-now" aria-label="Loaded preset">
        <p className="mm-arp-col-title">LOADED</p>
        <div className="mm-arp-lib-body">
          <div className="mm-arp-glass mm-arp-lib-screen" role="status" aria-live="polite">
            {cur ? (
              <>
                <p className="mm-arp-glass-head">
                  <span>
                    {cur.cat} · {String(at + 1).padStart(2, '0')} / {String(ofCat(cur.cat).length).padStart(2, '0')}
                  </span>
                  <span className="mm-arp-lib-tempo">{cur.bpm} BPM</span>
                </p>
                <p className="mm-arp-lib-name">{cur.name}</p>
                <p className="mm-arp-lib-desc">{cur.desc}</p>
              </>
            ) : (
              <>
                <p className="mm-arp-glass-head">FACTORY LIBRARY · VST3</p>
                <p className="mm-arp-lib-name">NO PRESET LOADED</p>
                <p className="mm-arp-lib-desc">Pick a category, then a preset: it loads at once (UNDO brings back your sound). The tempo shown is the one it was made at.</p>
              </>
            )}
          </div>
          <div className="mm-arp-lib-nav">
            <Key className="mm-arp-lib-prev" legend="PREV" glyph="◀" label="Previous preset" onClick={() => step(-1)} />
            <Key className="mm-arp-lib-next" legend="NEXT" glyph="▶" label="Next preset" onClick={() => step(1)} />
          </div>
        </div>
      </section>
    </div>
  );
};
