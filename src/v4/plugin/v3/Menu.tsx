/**
 * Les sous-pages d'OPEN (2026-11-25) : le menu (le hamburger, comme le MM-ARP). Le pattern (STEPS, BPM, SWING), PERSONALIZE
 * (TRK SELECT, LED, BACKLIGHT, SUBPAGE : la face DT2), le dossier des samples, l'aide de la souris et du clavier (celle de
 * la machine), la version. Echap ou un clic ailleurs le referme.
 */

import React, { useSyncExternalStore } from 'react';
import { fileImport } from '../../actions';
import { fwVersion } from '../../firmware';
import { LEDS, TRKS, personalize } from '../../state/personal';
import { HELP } from '../OpenPanel';
import { dialCtl } from './ctl';
import { Knob } from './ui';
import { useView } from './Chrome';
import { view } from './view';

const MENU_C = { steps: dialCtl('z:pg:len'), bpm: dialCtl('z:bpm'), swing: dialCtl('z:swing') };

/** Un choix a pilules (PERSONALIZE). */
const Pick = <T,>({ label, value, options, onPick }: { label: string; value: T; options: readonly { v: T; t: string }[]; onPick: (v: T) => void }): React.ReactElement => (
  <div className="row">
    <span>{label}</span>
    {options.map((o) => (
      <span key={o.t} className={`mm3-chip${o.v === value ? ' fill' : ''}`} style={{ position: 'static' }} onPointerDown={() => onPick(o.v)}>
        {o.t}
      </span>
    ))}
  </div>
);

export const Menu: React.FC = () => {
  const v = useView();
  const p = useSyncExternalStore(personalize.subscribe, personalize.get);
  return (
    <div className="mm3-menu" style={{ left: v.page ? (v.help ? 870 : 1000) : 1040, top: 52, width: v.help ? 460 : 330 }} onPointerDown={(e) => e.stopPropagation()}>
      <h4>
        {v.help ? 'MOUSE AND KEYS' : 'SETTINGS'}
        <span style={{ color: '#8d8d90', fontSize: 8.5, cursor: 'pointer' }} onPointerDown={() => (v.help ? view.help(false) : view.menu(false))}>
          {v.help ? '‹ BACK' : 'CLOSE'}
        </span>
      </h4>
      {v.help ? (
        <div className="mm3-help" style={{ maxHeight: 560, overflowY: 'auto' }}>
          {HELP.map(([k, d]) => (
            <p key={k} style={{ margin: '0 0 6px' }}>
              <b>{k}</b> · {d}
            </p>
          ))}
        </div>
      ) : (
        <>
          <div className="row">
            <span>PATTERN</span>
          </div>
          <div style={{ position: 'relative', height: 92 }}>
            <Knob x={44} y={34} d={38} kind="tiny" ctl={MENU_C.steps} label="STEPS" />
            <Knob x={132} y={34} d={38} kind="tiny" ctl={MENU_C.bpm} label="BPM" />
            <Knob x={220} y={34} d={38} kind="tiny" ctl={MENU_C.swing} label="SWING" />
          </div>
          <div className="row" style={{ color: '#7d7d7d', fontSize: 7.5, letterSpacing: '.1em' }}>
            <span>BPM : THE CLOCK OF THE MACHINE ; ABLETON PLAYING, ITS TEMPO LEADS</span>
          </div>
          <div className="div" />
          <div className="row">
            <span>PERSONALIZE</span>
          </div>
          <Pick label="TRK SELECT" value={p.trkSelect} options={TRKS.map((x) => ({ v: x, t: x.toUpperCase() }))} onPick={(x) => personalize.set({ trkSelect: x })} />
          <Pick label="LED" value={p.led} options={LEDS.map((x) => ({ v: x, t: x.toUpperCase() }))} onPick={(x) => personalize.set({ led: x })} />
          <Pick label="BACKLIGHT" value={p.backlight} options={[{ v: false, t: 'OFF' }, { v: true, t: 'ON' }]} onPick={(x) => personalize.set({ backlight: x })} />
          <Pick label="SUBPAGE" value={p.subpage} options={[{ v: false, t: 'FIRST' }, { v: true, t: 'REMEMBER' }]} onPick={(x) => personalize.set({ subpage: x })} />
          <div className="div" />
          <div className="item" onPointerDown={() => fileImport.reveal?.(null)}>
            SAMPLES FOLDER <em>OPEN</em>
          </div>
          <div className="item" onPointerDown={() => fileImport.rescan?.()}>
            SAMPLES FOLDER <em>RESCAN</em>
          </div>
          <div className="row" style={{ color: '#7d7d7d', fontSize: 7.5, letterSpacing: '.08em', marginTop: 4 }}>
            <span>MUSIC / MM-RYTM SAMPLES / BD, SD, CH, OH, CP, TOM, HT, CY : WAV, AIFF, FLAC, MP3</span>
          </div>
          <div className="div" />
          <div className="item" onPointerDown={() => view.help(true)}>
            MOUSE AND KEYS <em>HELP</em>
          </div>
          <div className="item" onPointerDown={() => view.open('LIBRARY')}>
            PRESETS <em>LIBRARY</em>
          </div>
          <div className="item" onPointerDown={() => view.open('MIDI')}>
            DRAG MIDI <em>MIDI</em>
          </div>
          <div className="div" />
          <div className="item" style={{ color: '#8a8a8a', cursor: 'default' }}>
            MM-RYTM VST3 · V.{fwVersion('mm808')} <em>MAUDITE MACHINE</em>
          </div>
        </>
      )}
    </div>
  );
};
