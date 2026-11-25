/**
 * La face v3 du plugin (2026-11-25) : le menu (le hamburger, comme le MM-ARP). Le pattern (STEPS, BPM, SWING), le dossier
 * des samples, l'aide de la souris et du clavier, la version. Echap ou un clic ailleurs le referme.
 */

import React from 'react';
import { fileImport } from '../../actions';
import { fwVersion } from '../../firmware';
import { dialCtl } from './ctl';
import { Knob } from './ui';
import { useView } from './Chrome';
import { view } from './view';

const MENU_C = { steps: dialCtl('z:pg:len'), bpm: dialCtl('z:bpm'), swing: dialCtl('z:swing') };

/** La souris et le clavier sur la face v3. */
const HELP: readonly [string, string][] = [
  ['A knob', 'drag up or down ; Shift : fine ; the wheel ; double click : its start value'],
  ['A step', 'click : on / off ; hold : P-LOCK (the knobs write on that step) ; drag : its velocity'],
  ['Right click a step', 'P-LOCK kept, and its conditions (1:2, 1:4, 1ST, 50 %...)'],
  ['A track', 'click : pick it ; right click : mute'],
  ['FUNC or Shift', 'held : a step mutes its track ; the keys do their function'],
  ['MUTE · SOLO', 'the steps are the tracks'],
  ['PERFORM', 'the steps are live pads : cuts, repeats, low cut, throws, tape stop ; Shift + click keeps one'],
  ['Scenes A / B', 'hold A or B and turn knobs ; the crossfader goes from A to B'],
  ['REC twice', 'LIVE REC : while it plays, the knobs you turn are recorded on the steps'],
  ['OPEN', 'the tabs at the top ; O opens the last page ; Esc closes'],
  ['Keys', 'Space : play ; Shift + Space : stop ; Cmd+Z : undo ; Cmd+Shift+Z : redo'],
  ['Window', 'drag its corner : the machine grows with your screen'],
];

export const Menu: React.FC = () => {
  const v = useView();
  return (
    <div className="mm3-menu" style={{ left: v.page ? 1040 : 1072, top: 52, width: v.help ? 420 : 296 }} onPointerDown={(e) => e.stopPropagation()}>
      <h4>
        {v.help ? 'MOUSE AND KEYS' : 'SETTINGS'}
        <span style={{ color: '#8d8d90', fontSize: 8.5, cursor: 'pointer' }} onPointerDown={() => (v.help ? view.help(false) : view.menu(false))}>
          {v.help ? '‹ BACK' : 'CLOSE'}
        </span>
      </h4>
      {v.help ? (
        <div className="mm3-help">
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
            <Knob x={44} y={34} d={38} ctl={MENU_C.steps} label="STEPS" />
            <Knob x={132} y={34} d={38} ctl={MENU_C.bpm} label="BPM" />
            <Knob x={220} y={34} d={38} ctl={MENU_C.swing} label="SWING" />
          </div>
          <div className="row" style={{ color: '#7d7d7d', fontSize: 7.5, letterSpacing: '.1em' }}>
            <span>BPM : THE CLOCK OF THE MACHINE ; ABLETON PLAYING, ITS TEMPO LEADS</span>
          </div>
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
