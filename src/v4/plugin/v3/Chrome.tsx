/**
 * La face v3 du plugin (2026-11-25) : le chassis (l'alu brosse noir, ses joues et leurs vis), l'en-tete (le nom, les
 * onglets d'OPEN : sur la face ils ouvrent leur page, dans l'OPEN celui de la page est allume ; le menu) et la bande du bas
 * de l'OPEN (LIBRARY, MIDI, LEARN, le petit ecran, CLOSE), comme le MM-ARP.
 */

import React, { useSyncExternalStore } from 'react';
import { patterns, slotName } from '../../state/patterns';
import aluUrl from './img/alu.jpg';
import aluDarkUrl from './img/alu-dark.jpg';
import { Key, Lcd } from './ui';
import { TABS, view, type Page } from './view';

export const useView = (): ReturnType<typeof view.get> => useSyncExternalStore(view.subscribe, view.get);

export const Chassis: React.FC = () => (
  <>
    <div style={{ inset: 0, background: '#0c0c0d' }} />
    <div className="mm3-panel" style={{ backgroundImage: `url(${aluUrl})` }} />
    {(['l', 'r'] as const).map((side) => (
      <div key={side} className={`mm3-cheek ${side}`} style={{ backgroundImage: `url(${aluDarkUrl})` }}>
        {[16, 300, 586, 870].map((y) => (
          <i key={y} className="mm3-screw" style={{ top: y - 5 }} />
        ))}
      </div>
    ))}
  </>
);

export const Header: React.FC = () => {
  const v = useView();
  const open = v.page !== null;
  return (
    <>
      <div className="mm3-wordmark" style={{ left: 58, top: 24 }}>
        MAUDITE MACHINE
      </div>
      <div className="mm3-model" style={{ left: 322, top: 26 }}>
        MM-RYTM
      </div>
      {!open && (
        <div className="mm3-note" style={{ left: 458, top: 30, fontSize: 8.5, color: '#bdbdbd', letterSpacing: '.2em' }}>
          OPEN <span style={{ color: 'var(--acc)' }}>›</span>
        </div>
      )}
      <div className="mm3-tabs" style={{ left: open ? 470 : 504, top: 21 }} role="tablist" aria-label="OPEN pages">
        {TABS.map((t) => (
          <div
            key={t}
            className={`mm3-tab${v.page === t ? ' on' : ''}`}
            role="tab"
            aria-selected={v.page === t}
            onPointerDown={(e) => {
              if (e.button !== 0) return;
              e.preventDefault();
              if (v.page === t) view.close();
              else view.open(t);
            }}
          >
            {t}
          </div>
        ))}
      </div>
      <div
        className={`mm3-btn${v.menu ? ' on' : ''}`}
        style={{ left: open ? 1268 : 1300, top: 21 }}
        role="button"
        aria-label="Menu: settings, mouse and keys"
        onPointerDown={(e) => {
          if (e.button !== 0) return;
          e.preventDefault();
          e.stopPropagation();
          view.menu();
        }}
      >
        <i />
        <i />
        <i />
      </div>
      {open && (
        <div
          className="mm3-btn"
          style={{ left: 1308, top: 21 }}
          role="button"
          aria-label="Close (Esc)"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            view.close();
          }}
        >
          ×
        </div>
      )}
    </>
  );
};

/** La bande du bas de l'OPEN : LIBRARY, MIDI, LEARN, ce que dit la page, le petit ecran, CLOSE. */
export const Foot: React.FC<{ page: Page; hint: string; lcd: string }> = ({ page, hint, lcd }) => {
  const v = useView();
  const cur = useSyncExternalStore(patterns.subscribe, () => patterns.get().cur);
  const foot = (id: 'LIBRARY' | 'MIDI', x: number) => (
    <Key x={x} y={846} w={50} h={22} label={id} led={page === id ? 'on' : 'off'} lit={page === id ? 'lit' : null} onDown={() => (page === id ? view.open(v.last === id ? 'SAMPLE' : v.last) : view.open(id))} />
  );
  return (
    <>
      <div className="mm3-foot" />
      {foot('LIBRARY', 70)}
      {foot('MIDI', 142)}
      <Key x={214} y={846} w={50} h={22} label="LEARN" led={v.learn ? 'on' : 'off'} lit={v.learn ? 'lit' : null} onDown={() => view.learn()} title="MIDI LEARN: in Ableton, map a knob of the plugin (its parameters are the knobs of the machine)" />
      <div className="mm3-note" style={{ left: 300, top: 852, fontSize: 7.5, color: '#7a7a7a' }}>
        {v.learn ? 'LEARN: IN ABLETON, CLICK CONFIGURE ON THE PLUGIN, THEN TURN A KNOB HERE' : hint}
      </div>
      <Lcd x={1020} y={840} w={224} h={42}>
        <div className="mm3-t8" style={{ left: 10, top: 6, fontSize: 7 }}>
          MM-RYTM · {slotName(cur)}
        </div>
        <div className="mm3-dots mm3-w" style={{ left: 10, top: 18, fontSize: 17 }}>
          {lcd}
        </div>
      </Lcd>
      <Key x={1268} y={846} w={50} h={22} label="CLOSE" labAcc led="off" onDown={() => view.close()} title="Back to the machine (Esc)" />
    </>
  );
};
