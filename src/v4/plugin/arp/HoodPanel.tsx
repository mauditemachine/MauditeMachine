/**
 * Le panneau d'OPEN du plugin MM-ARP (2026-11-09 : un panneau au-dessus de la carte ouverte ; refait le 2026-11-11, Mika :
 * "sur ce synthe, quand on clique sur le titre on a une autre interface : moi je veux le bouton OPEN pour ca, et avoir
 * encore tout un tas d'interfaces ; pour le OPEN je veux ces knobs-la (bouton noir a index blanc, graduations
 * chiffrees)"). OPEN (la touche de la machine, celle du bandeau, la touche O) bascule TOUTE la fenetre sur ce second
 * panneau, dans le meme habillage que la face (le simili noir, un bandeau de metal brosse par section, des filets de
 * cadre) ; CLOSE (le bandeau), OPEN, O ou Echap reviennent a la face. Le bandeau du haut reste (Header.tsx) : son titre
 * dit OPTIONS PANEL, sa touche devient CLOSE. La scene 3D ne s'ouvre plus dans le plugin (voyager/rig.ts) : l'etat du
 * capot (state/explode.ts voyExplode) reste la source, la face 3D attend dessous.
 *
 * Une seule page, tout est visible :
 * - rangee 1, les TWEAKS du site (les potards de la carte, voyager/params.ts section tweak, a leurs ids du site) :
 *   OSC TWEAKS (PHASE, DRIFT, STACK, SYNC), OUTPUT TWEAKS (WIDTH, WIDE, BASS MONO, GLUE, SIDECHAIN), FILTER TWEAKS (LOAD,
 *   SPACE, POLARITY), DELAY TWEAKS (DLY TIME, TAPE) ;
 * - rangee 2 : PERFORMANCE (KEY TRACK, ACCENT, ACC FILTER, CHORD : des TWEAKS aussi), puis les reglages du VST3 seul
 *   (extra.ts) : ENGINE (QUALITY), LFO 1 (TARGET 2, DEPTH 2), LFO 2, REVERB ;
 * - le bas : MASTER, CLIP (DRAG MIDI, x1 / x2 / x4, SAVE .MID) et MIDI (LEARN, la table des CC, CLEAR ALL) a gauche ;
 *   LIBRARY au milieu (Library.tsx : les 40 presets d'usine, quatre categories cote a cote) ; DISK a droite
 *   (DiskPresets.tsx).
 * Les potards : le bouton noir a index blanc et ses graduations chiffrees (SoundPlus.tsx, look 'black').
 *
 * DRAG MIDI : la poignee a glisser vers une piste d'Ableton (mm_drag_midi, une fois, des que le pointeur enfonce a bouge
 * de 4 px : le C++ lance le glisser natif depuis l'evenement souris en cours).
 * LearnMarks (toujours monte) : le potard arme cerne d'orange sur la machine (son jumeau, ui/VoyTwins.tsx), et capot ferme,
 * une pastille MIDI LEARN (le mode survit a la fermeture : les potards de la face s'apprennent capot ferme).
 */

import React, { useEffect, useRef, useSyncExternalStore } from 'react';
import { voyExplode } from '../../state/explode';
import { VOY_KNOBS, type VoyKnobId } from '../../voyager/params';
import { arpBridge } from './bridge';
import { DiskPresets } from './DiskPresets';
import { LibraryBank } from './Library';
import { EXTRA_PARAMS, extraParam, type ExtraSection } from './extra';
import { arpMidi, type ArpMidiState } from './midimap';
import { CHEEK_W, HEAD_H, UI_H, UI_W } from './scale';
import { sectionPrefix, VKnob, VSwitch, XKnob, XSwitch } from './SoundPlus';

/** Le glisser part apres ce deplacement (px), le bouton tenu. */
const DRAG_PX = 4;
const CYCLES: readonly ArpMidiState['cycles'][] = [1, 2, 4];

/** Les parametres du plugin qui ne sont pas des potards de la face (plugin/mm-arp/src/PluginProcessor.cpp). */
const EXTRA_LABELS: Record<string, string> = { arp: 'ARPEGGIATOR', master: 'MASTER', prio: 'CLIP PRIORITY' };

/** Le bloc d'un reglage SOUND+ devant son label (SPEED, TARGET, DEPTH existent aussi sur la face). */
const X_PREFIX: Record<string, string> = { engine: '', lfo1: 'LFO 1 ', lfo2: 'LFO 2 ', reverb: 'REVERB ', master: 'MASTER ' };

/** Le nom d'un parametre : le label du potard (voyager/params.ts) ou du reglage SOUND+ (extra.ts), sinon son id. */
export function paramLabel(id: string): string {
  const knob = VOY_KNOBS.find((k) => k.id === id);
  if (knob) return knob.label;
  const x = extraParam(id);
  // Les reglages du module avant (FrontModule.tsx) : PHASER RATE, FLANGER DEPTH... (sectionPrefix)
  if (x) return x.section in X_PREFIX ? `${X_PREFIX[x.section]}${x.label}` : `${sectionPrefix(x)}${x.label}`;
  return EXTRA_LABELS[id] ?? id.toUpperCase();
}

const useHood = () => useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
const useArpMidi = () => useSyncExternalStore(arpMidi.subscribe, arpMidi.get, arpMidi.get);
/**
 * Une touche de la machine (CLEAR, RANDOM, EDIT) : le carre noir mat en relief, une LED au-dessus si elle a un etat, la
 * legende serigraphiee dessous (orange : une fonction, comme PRESET et OPEN). Le bouton entier (LED, touche, legende)
 * se clique.
 */
type KeyProps = Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & {
  legend: React.ReactNode;
  led?: boolean | 'blink';
  fn?: boolean;
  size?: 's' | 'm' | 'w';
  sub?: string;
};
export const Key: React.FC<KeyProps> = ({ legend, led, fn, size = 'm', sub, className, ...rest }) => (
  <button type="button" className={`mm-arp-kb${className ? ` ${className}` : ''}`} data-size={size} data-fn={fn ? '1' : undefined} {...rest}>
    {led !== undefined && <span className="mm-arp-led" data-on={led ? '1' : undefined} data-blink={led === 'blink' ? '1' : undefined} aria-hidden="true" />}
    <span className="mm-arp-k" aria-hidden="true" />
    <span className="mm-arp-legend">{legend}</span>
    {sub && <span className="mm-arp-legend-sub">{sub}</span>}
  </button>
);

/** Une section du panneau : son bandeau de metal brosse (une LED dedans si elle a un etat), son contenu dessous. */
const Sec: React.FC<{ id: string; title: string; className?: string; grow?: number; led?: boolean | 'blink'; children: React.ReactNode }> = ({ id, title, className, grow, led, children }) => (
  <section className={`mm-arp-sec${className ? ` ${className}` : ''}`} data-sec={id} style={grow ? { flex: `${grow} 1 0` } : undefined} aria-label={title}>
    <p className="mm-arp-band">
      {led !== undefined && <span className="mm-arp-led mm-arp-band-led" data-on={led ? '1' : undefined} data-blink={led === 'blink' ? '1' : undefined} aria-hidden="true" />}
      <span>{title}</span>
    </p>
    {children}
  </section>
);

/** CLIP : DRAG MIDI (la poignee), x1 / x2 / x4, SAVE .MID. */
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
    <Sec id="clip" title="CLIP" className="mm-arp-drag">
      <div className="mm-arp-clip">
        <button
          type="button"
          className="mm-arp-kb mm-arp-drag-handle"
          data-fn="1"
          draggable={false}
          title="Drag the arpeggio onto an Ableton track"
          aria-label={`Drag MIDI, ${st.cycles} times the progression, onto an Ableton track`}
          onPointerDown={onPointerDown}
          onDragStart={(e) => e.preventDefault()}
          onMouseDown={(e) => e.preventDefault()}
        >
          <span className="mm-arp-k mm-arp-drag-k" aria-hidden="true">
            <svg className="mm-arp-drag-grip" viewBox="0 0 40 14" aria-hidden="true">
              {[0, 1, 2, 3, 4, 5, 6].map((i) => (
                <line key={i} x1={5 + i * 5} y1="2" x2={5 + i * 5} y2="12" />
              ))}
            </svg>
          </span>
          <span className="mm-arp-legend">DRAG MIDI</span>
          <span className="mm-arp-legend-sub">ONTO A TRACK</span>
        </button>
        <div className="mm-arp-clip-side">
          <div className="mm-arp-seg" role="radiogroup" aria-label="Times the progression">
            {CYCLES.map((c) => (
              <Key
                key={c}
                role="radio"
                aria-checked={st.cycles === c}
                className="mm-arp-seg-key"
                data-on={st.cycles === c ? '1' : undefined}
                size="s"
                led={st.cycles === c}
                legend={`x${c}`}
                onClick={() => arpMidi.set({ cycles: c })}
              />
            ))}
            <span className="mm-arp-bracket" aria-hidden="true">
              <span>LENGTH</span>
            </span>
          </div>
          <Key className="mm-arp-key mm-arp-savemid" size="s" legend="SAVE .MID" onClick={() => arpBridge.saveMid(arpMidi.get().cycles)} />
        </div>
      </div>
    </Sec>
  );
};

/** MIDI : LEARN, la table des CC, CLEAR ALL. */
const MidiMap: React.FC = () => {
  const st = useArpMidi();
  const items = st.items ?? [];
  const line = st.learning ? (st.armed ? `WAITING CC FOR ${paramLabel(st.armed)}` : 'CLICK A KNOB') : st.items === null ? '…' : items.length === 0 ? 'NO CC MAPPED' : `${items.length} CC MAPPED`;
  return (
    <Sec id="midi" title="MIDI" className="mm-arp-midi" led={st.learning ? 'blink' : false}>
      <div className="mm-arp-midi-body">
        <div className="mm-arp-glass">
          <p className="mm-arp-glass-head mm-arp-midi-line" data-on={st.learning ? '1' : undefined} role="status">
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
        </div>
        <div className="mm-arp-midi-side">
          <Key
            className="mm-arp-learn mm-arp-rail-learn"
            size="s"
            aria-pressed={st.learning}
            data-on={st.learning ? '1' : undefined}
            led={st.learning ? 'blink' : false}
            legend="LEARN"
            title={st.learning ? (st.armed ? `Waiting CC for ${paramLabel(st.armed)}` : 'Click a knob') : 'MIDI learn'}
            onClick={() => arpBridge.learnMode(!st.learning)}
          />
          <Key className="mm-arp-key mm-arp-clearall" size="s" legend="CLEAR ALL" disabled={items.length === 0} onClick={() => arpBridge.unmapAll()} />
          <p className="mm-arp-help">
            ALSO IN ABLETON
            <br />
            CMD + M
          </p>
        </div>
      </div>
    </Sec>
  );
};

/* ---------------- les sections de potards ---------------- */

/** Les TWEAKS du site, par bloc (ceux de la carte : voyager/theme.ts VT.groups) ; sw : un commutateur a deux positions. */
const TWEAKS: readonly { id: string; title: string; ids: readonly VoyKnobId[] }[] = [
  { id: 'tw-osc', title: 'OSC TWEAKS', ids: ['phase', 'drift', 'stack', 'sync'] },
  { id: 'tw-out', title: 'OUTPUT TWEAKS', ids: ['width', 'wide', 'monoLow', 'glue', 'duck'] },
  { id: 'tw-filter', title: 'FILTER TWEAKS', ids: ['load', 'space', 'fpol'] },
  { id: 'tw-delay', title: 'DELAY TWEAKS', ids: ['dlyTime', 'tape'] },
];
const PERFORMANCE: readonly VoyKnobId[] = ['keyTrack', 'accent', 'accFlt', 'chord'];
const V_SWITCH: ReadonlySet<VoyKnobId> = new Set<VoyKnobId>(['sync', 'fpol']);

const Tweaks: React.FC<{ id: string; title: string; ids: readonly VoyKnobId[] }> = ({ id, title, ids }) => (
  <Sec id={id} title={title} grow={ids.length}>
    <div className="mm-arp-xrow">{ids.map((k) => (V_SWITCH.has(k) ? <VSwitch key={k} id={k} /> : <VKnob key={k} id={k} />))}</div>
  </Sec>
);

/** Une section des reglages du VST3 seul (extra.ts) : ENGINE, LFO 1, LFO 2, REVERB, MASTER. */
const Extra: React.FC<{ id: ExtraSection; title: string; fixed?: boolean }> = ({ id, title, fixed }) => {
  const list = EXTRA_PARAMS.filter((p) => p.section === id);
  return (
    <Sec id={id} title={title} grow={fixed ? undefined : list.length}>
      <div className="mm-arp-xrow">{list.map((p) => (p.id === 'xQuality' ? <XSwitch key={p.id} p={p} /> : <XKnob key={p.id} p={p} look="black" />))}</div>
    </Sec>
  );
};

/** Le panneau, capot ouvert (ou qui s'ouvre) : il prend toute la fenetre sous le bandeau. */
export const HoodPanel: React.FC = () => {
  const hood = useHood();
  const open = hood === 'opening' || hood === 'open';
  // Le capot s'ouvre : la table des CC a jour (la liste des presets : DiskPresets)
  useEffect(() => {
    if (open) arpBridge.midimapGet();
  }, [open]);
  if (!open) return null;
  return (
    <section className="mm-arp-open" style={{ position: 'absolute', left: CHEEK_W, top: HEAD_H, width: UI_W - 2 * CHEEK_W, height: UI_H - HEAD_H }} aria-label="MM-ARP options panel">
      <div className="mm-arp-open-row" data-row="tweaks">
        {TWEAKS.map((t) => (
          <Tweaks key={t.id} {...t} />
        ))}
      </div>
      <div className="mm-arp-open-row" data-row="sound">
        <Tweaks id="tw-perf" title="PERFORMANCE" ids={PERFORMANCE} />
        <Extra id="engine" title="ENGINE" />
        <Extra id="lfo1" title="LFO 1" />
        <Extra id="lfo2" title="LFO 2" />
        <Extra id="reverb" title="REVERB" />
      </div>
      <div className="mm-arp-open-row" data-row="tools">
        <div className="mm-arp-open-col" data-col="left">
          <Extra id="master" title="MASTER" fixed />
          <DragMidi />
          <MidiMap />
        </div>
        <Sec id="library" title="LIBRARY" className="mm-arp-open-lib">
          <LibraryBank />
        </Sec>
        <DiskPresets />
      </div>
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
  // Capot ouvert : la section MIDI du panneau dit le mode (sa LED, sa ligne) ; capot ferme : la pastille
  if (!st.learning || hood === 'open' || hood === 'opening') return null;
  return (
    <button type="button" className="mm-arp-learn-pill" style={{ position: 'absolute' }} onClick={() => arpBridge.learnMode(false)} aria-label="Stop MIDI learn">
      <span className="mm-arp-led" aria-hidden="true" />
      MIDI LEARN · {st.armed ? `WAITING CC FOR ${paramLabel(st.armed)}` : 'CLICK A KNOB'} · ESC
    </button>
  );
};
