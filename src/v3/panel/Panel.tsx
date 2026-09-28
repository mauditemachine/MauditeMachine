/**
 * Le panneau 303 : silkscreen, PATTERN GROUP, six boutons, display, pas,
 * transport. Un seul ordre DOM (l'ordre de tabulation) ; le placement
 * visuel change par grid-template-areas selon la largeur (v3.css).
 */

import React from 'react';
import type { Bead, GroupId } from '../data/beads';
import type { V3State } from '../state/bridge';
import { KNOB_KEYS } from '../state/knobs';
import Display from './Display';
import Knob from './Knob';
import PatternGroup from './PatternGroup';
import Steps from './Steps';
import Transport from './Transport';

export interface PanelProps {
  runRef?: React.RefObject<HTMLButtonElement>;
  bead: Bead | null;
  state: V3State;
  isCurrent: boolean;
  hasCurrent: boolean;
  playing: boolean;
  progress: number;
  duration: number;
  notice: string | null;
  noticeKey: number;
  timedOut: boolean;
  group: GroupId;
  isMobile: boolean;
  isTouch: boolean;
  reduced: boolean;
  knobsOpen: boolean;
  onKnobsToggle: () => void;
  onGroup: (g: GroupId) => void;
  onRun: () => void;
  onBack: () => void;
  onFwd: () => void;
  onClear: () => void;
  onSeek: (r: number) => void;
}

const Panel: React.FC<PanelProps> = (p) => {
  const runEnabled = !!p.bead && p.bead.playable;
  const breathing = runEnabled && !p.isCurrent;
  return (
    <section className={`v3-panel${p.knobsOpen ? ' is-knobs-open' : ''}`} aria-label="Acid Line panel">
      <div className="v3-silk" aria-hidden="true">
        <span className="v3-silk-name">MAUDITE MACHINE</span>
        <span className="v3-silk-sub">ACID LINE</span>
        <span className="v3-silk-tiny">COMPUTER CONTROLLED</span>
      </div>

      <PatternGroup value={p.group} onChange={p.onGroup} />

      <div className="v3-knobs">
        <button
          type="button"
          className="v3-knobs-toggle"
          aria-expanded={p.knobsOpen}
          aria-controls="v3-knobs-row"
          onClick={p.onKnobsToggle}
        >
          KNOBS
        </button>
        <div id="v3-knobs-row" className="v3-knobs-row">
          {KNOB_KEYS.map((k) => (
            <Knob key={k} id={k} reduced={p.reduced} isTouch={p.isTouch} />
          ))}
        </div>
      </div>

      <div className="v3-display-col">
        <Display
          bead={p.bead}
          state={p.state}
          isCurrent={p.isCurrent}
          notice={p.notice}
          progress={p.progress}
          duration={p.duration}
          timedOut={p.timedOut}
          isMobile={p.isMobile}
        />
        <Steps
          progress={p.hasCurrent ? p.progress : 0}
          hasCurrent={p.hasCurrent}
          playing={p.playing}
          loading={p.state === 'loading' && !p.timedOut}
          noticeKey={p.noticeKey}
          onSeek={p.onSeek}
        />
      </div>

      <div className="v3-transport-wrap">
        <Transport
          runRef={p.runRef}
          playing={p.playing}
          hasCurrent={p.hasCurrent}
          runEnabled={runEnabled}
          breathing={breathing}
          onRun={p.onRun}
          onBack={p.onBack}
          onFwd={p.onFwd}
        />
        <button type="button" className="v3-tbtn v3-clear" aria-label="Stop and clear" onClick={p.onClear}>
          <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden="true">
            <path d="M3 3l10 10M13 3L3 13" stroke="currentColor" strokeWidth="1.6" />
          </svg>
          <span className="v3-tbtn-label">CLEAR</span>
        </button>
      </div>
    </section>
  );
};

export default Panel;
