/**
 * Le panneau du capot du plugin MM-ARP (2026-11-09, Mika : "quand je clique sur OPEN je dois voir l'interieur, le circuit
 * imprime, comme avant ! Et la doit y avoir le DRAG MIDI et la gestion MIDI") : OPEN ouvre le vrai capot du site (la carte
 * et ses TWEAKS, state/explode.ts voyExplode) ; ce panneau se pose en bande sous la carte (Stage.setInset : la carte tient
 * au-dessus, rien ne la cache), le temps que le capot est ouvert. Quatre blocs :
 * - DRAG MIDI : la poignee a glisser vers une piste d'Ableton (mm_drag_midi, une fois, des que le pointeur enfonce a bouge
 *   de 4 px : le C++ lance le glisser natif depuis l'evenement souris en cours), x1 / x2 / x4, SAVE .MID (mm_save_mid) ;
 *   le message du C++ (mm_drag_status) s'affiche un moment ;
 * - DISK : les presets sur le disque (DiskPresets.tsx) ;
 * - MIDI : MIDI LEARN (LEARN, un clic sur un potard, le prochain CC), la table des CC du plugin, une croix par ligne,
 *   CLEAR ALL ;
 * - CLOSE : referme le capot (comme OPEN, Echap ou la touche O).
 * LearnMarks (toujours monte) : le potard arme cerne d'orange sur la machine (son jumeau, ui/VoyTwins.tsx), et capot ferme,
 * une pastille MIDI LEARN (le mode survit a la fermeture : les potards de la face s'apprennent capot ferme).
 */

import React, { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { openToggle } from '../../actions';
import type { Stage } from '../../scene/renderer';
import { voyExplode } from '../../state/explode';
import { VOY_KNOBS } from '../../voyager/params';
import { arpBridge } from './bridge';
import { DiskPresets } from './DiskPresets';
import { arpMidi, type ArpMidiState } from './midimap';

/** Le glisser part apres ce deplacement (px), le bouton tenu. */
const DRAG_PX = 4;
const CYCLES: readonly ArpMidiState['cycles'][] = [1, 2, 4];

/** Les parametres du plugin qui ne sont pas des potards de la face (plugin/mm-arp/src/PluginProcessor.cpp). */
const EXTRA_LABELS: Record<string, string> = { arp: 'ARPEGGIATOR', master: 'MASTER', prio: 'CLIP PRIORITY' };

/** Le nom d'un parametre : le label du potard (voyager/params.ts), sinon son id. */
export function paramLabel(id: string): string {
  return VOY_KNOBS.find((k) => k.id === id)?.label ?? EXTRA_LABELS[id] ?? id.toUpperCase();
}

const useHood = () => useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
const useArpMidi = () => useSyncExternalStore(arpMidi.subscribe, arpMidi.get, arpMidi.get);

/** DRAG MIDI : la poignee, x1 / x2 / x4, SAVE .MID, le message du C++. */
const DragMidi: React.FC = () => {
  const st = useArpMidi();
  const press = useRef<{ id: number; x: number; y: number; sent: boolean } | null>(null);
  const off = useRef<(() => void) | null>(null);
  useEffect(() => () => off.current?.(), []);

  const onPointerDown = (e: React.PointerEvent): void => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    // Ni selection, ni glisser HTML, ni focus qui bouge : le C++ prend la main au premier deplacement
    e.preventDefault();
    off.current?.();
    press.current = { id: e.pointerId, x: e.clientX, y: e.clientY, sent: false };
    const move = (ev: PointerEvent): void => {
      const p = press.current;
      if (!p || p.sent || ev.pointerId !== p.id) return;
      if (ev.pointerType === 'mouse' && (ev.buttons & 1) === 0) return;
      if (Math.hypot(ev.clientX - p.x, ev.clientY - p.y) < DRAG_PX) return;
      p.sent = true;
      arpBridge.dragMidi(arpMidi.get().cycles);
    };
    const end = (ev: PointerEvent): void => {
      if (press.current && ev.pointerId !== press.current.id) return;
      off.current?.();
    };
    const blur = (): void => off.current?.();
    window.addEventListener('pointermove', move, true);
    window.addEventListener('pointerup', end, true);
    window.addEventListener('pointercancel', end, true);
    window.addEventListener('blur', blur);
    off.current = () => {
      press.current = null;
      off.current = null;
      window.removeEventListener('pointermove', move, true);
      window.removeEventListener('pointerup', end, true);
      window.removeEventListener('pointercancel', end, true);
      window.removeEventListener('blur', blur);
    };
  };

  return (
    <section className="mm-arp-col mm-arp-drag" aria-label="Drag MIDI">
      <p className="mm-arp-col-title">DRAG MIDI</p>
      <button
        type="button"
        className="mm-arp-drag-handle"
        draggable={false}
        title="Drag the arpeggio onto an Ableton track"
        aria-label={`Drag MIDI, ${st.cycles} times the progression, onto an Ableton track`}
        onPointerDown={onPointerDown}
        onDragStart={(e) => e.preventDefault()}
        onMouseDown={(e) => e.preventDefault()}
      >
        <svg className="mm-arp-drag-grip" viewBox="0 0 12 18" aria-hidden="true">
          {[3, 9].map((x) => [3, 9, 15].map((y) => <circle key={`${x}-${y}`} cx={x} cy={y} r="1.6" />))}
        </svg>
        <span className="mm-arp-drag-text">
          <span className="mm-arp-drag-name">DRAG MIDI</span>
          <span className="mm-arp-drag-sub">ONTO A TRACK</span>
        </span>
      </button>
      <div className="mm-arp-seg" role="radiogroup" aria-label="Times the progression">
        {CYCLES.map((c) => (
          <button key={c} type="button" role="radio" aria-checked={st.cycles === c} className="mm-arp-seg-key" data-on={st.cycles === c ? '1' : undefined} onClick={() => arpMidi.set({ cycles: c })}>
            x{c}
          </button>
        ))}
      </div>
      <button type="button" className="mm-arp-key" onClick={() => arpBridge.saveMid(arpMidi.get().cycles)}>
        SAVE .MID
      </button>
      <p className="mm-arp-status" role="status" data-ok={st.status ? (st.status.ok ? '1' : '0') : undefined}>
        {st.status?.msg ?? ''}
      </p>
    </section>
  );
};

/** MIDI : LEARN, la table des CC, CLEAR ALL. */
const MidiMap: React.FC = () => {
  const st = useArpMidi();
  const items = st.items ?? [];
  const line = st.learning ? (st.armed ? `WAITING CC FOR ${paramLabel(st.armed)}` : 'CLICK A KNOB') : st.items === null ? '…' : items.length === 0 ? 'NO CC MAPPED' : `${items.length} CC MAPPED`;
  return (
    <section className="mm-arp-col mm-arp-midi" aria-label="MIDI mapping">
      <div className="mm-arp-col-head">
        <p className="mm-arp-col-title">MIDI</p>
        <button type="button" className="mm-arp-learn" aria-pressed={st.learning} data-on={st.learning ? '1' : undefined} onClick={() => arpBridge.learnMode(!st.learning)}>
          <span className="mm-arp-led" aria-hidden="true" />
          LEARN
        </button>
      </div>
      <p className="mm-arp-midi-line" data-on={st.learning ? '1' : undefined} role="status">
        {line}
      </p>
      <ul className="mm-arp-list mm-arp-map" aria-label="MIDI CC map">
        {items.map((it) => (
          <li key={`${it.ch}-${it.cc}`} className="mm-arp-map-row" data-armed={it.id === st.armed ? '1' : undefined}>
            <span className="mm-arp-map-name">{paramLabel(it.id)}</span>
            <span className="mm-arp-map-cc">
              CC {it.cc} · CH {it.ch}
            </span>
            <button type="button" className="mm-arp-map-x" aria-label={`Unmap ${paramLabel(it.id)}, CC ${it.cc} channel ${it.ch}`} onClick={() => arpBridge.unmap(it.cc, it.ch)}>
              ×
            </button>
          </li>
        ))}
      </ul>
      <div className="mm-arp-midi-foot">
        <button type="button" className="mm-arp-key mm-arp-key-small" disabled={items.length === 0} onClick={() => arpBridge.unmapAll()}>
          CLEAR ALL
        </button>
        <p className="mm-arp-help">Ableton : Cmd + M marche aussi</p>
      </div>
    </section>
  );
};

/** Le panneau, capot ouvert (ou qui s'ouvre) : la carte remonte au-dessus de lui. */
export const HoodPanel: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const hood = useHood();
  const open = hood === 'opening' || hood === 'open';
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const el = ref.current;
    if (!stage || !el || !open) return undefined;
    const apply = (): void => stage.setInset('voy', el.offsetHeight, 0);
    apply();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    ro?.observe(el);
    return () => {
      ro?.disconnect();
      stage.setInset('voy', 0);
    };
  }, [stage, open]);
  // Le capot s'ouvre : la table des CC a jour (la liste des presets : DiskPresets)
  useEffect(() => {
    if (open) arpBridge.midimapGet();
  }, [open]);
  if (!open) return null;
  return (
    <section ref={ref} className="mm-arp-hood" style={{ position: 'fixed' }} aria-label="MM-ARP hood">
      <DragMidi />
      <DiskPresets />
      <MidiMap />
      <button type="button" className="mm-arp-close" aria-label="Close the machine" onClick={() => openToggle(stage, 'voy')}>
        <span className="mm-arp-led" aria-hidden="true" />
        CLOSE
      </button>
    </section>
  );
};

/** Le potard arme cerne d'orange (son jumeau) ; capot ferme, la pastille du mode LEARN. */
export const LearnMarks: React.FC = () => {
  const st = useArpMidi();
  const hood = useHood();
  useEffect(() => {
    if (!st.learning || !st.armed) return undefined;
    const sel = `[data-hotspot="vk-${st.armed}"]`;
    // Le jumeau peut naitre apres (les TWEAKS a l'ouverture) : on le cherche tant que le potard est arme
    let el: Element | null = null;
    const find = (): void => {
      const next = document.querySelector(sel);
      if (next === el) return;
      el?.removeAttribute('data-mm-learn');
      el = next;
      el?.setAttribute('data-mm-learn', 'armed');
    };
    find();
    const t = window.setInterval(find, 250);
    return () => {
      window.clearInterval(t);
      el?.removeAttribute('data-mm-learn');
    };
  }, [st.learning, st.armed]);
  if (!st.learning || hood === 'open' || hood === 'opening') return null;
  return (
    <button type="button" className="mm-arp-learn-pill" style={{ position: 'fixed' }} onClick={() => arpBridge.learnMode(false)} aria-label="Stop MIDI learn">
      <span className="mm-arp-led" aria-hidden="true" />
      MIDI LEARN · {st.armed ? `WAITING CC FOR ${paramLabel(st.armed)}` : 'CLICK A KNOB'} · ESC
    </button>
  );
};
