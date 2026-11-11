/**
 * Le panneau du capot du plugin MM-ARP (2026-11-09, Mika : "quand je clique sur OPEN je dois voir l'interieur, le circuit
 * imprime, comme avant ! Et la doit y avoir le DRAG MIDI et la gestion MIDI") : OPEN ouvre le vrai capot du site (la carte
 * et ses TWEAKS, state/explode.ts voyExplode) ; ce panneau se pose en bande au-dessus de la carte (2026-11-11, Mika : "je
 * veux que ca se retrouve EN HAUT" ; Stage.setHead : la carte tient dessous, rien ne la cache ; sous elle avant), le
 * temps que le capot est ouvert. Quatre blocs :
 * - DRAG MIDI : la poignee a glisser vers une piste d'Ableton (mm_drag_midi, une fois, des que le pointeur enfonce a bouge
 *   de 4 px : le C++ lance le glisser natif depuis l'evenement souris en cours), x1 / x2 / x4, SAVE .MID (mm_save_mid) ;
 *   le message du C++ (mm_drag_status) s'affiche un moment ;
 * - DISK : les presets sur le disque (DiskPresets.tsx) ;
 * - MIDI : MIDI LEARN (LEARN, un clic sur un potard, le prochain CC), la table des CC du plugin, une croix par ligne,
 *   CLEAR ALL ;
 * - CLOSE : referme le capot (comme OPEN, Echap ou la touche O).
 * Trois pages (2026-11-10, tab.ts) : SOUND+ (SoundPlus.tsx : les reglages du VST3 seul), LIBRARY (Library.tsx : la
 * banque d'usine du VST3) et TOOLS (CLIP, DISK, MIDI).
 * Le dessin (2026-11-10, Mika : "fais ces rajouts par rapport au design de la face avant, la c'est noir et orange" ; "je
 * veux que tout se retrouve dans OPEN, pas melange") : un panneau de la machine, le meme gris anthracite que la face, des
 * sections titrees et separees de filets comme OSCILLATORS / FILTER EG, des touches noires en relief avec leur legende
 * dessous (en orange pour les fonctions, comme PRESET et OPEN), les LED rouges de CHORUS et SUB OCT pour les etats, des
 * fenetres de verre noir comme l'ecran pour les listes. La colonne de droite porte l'afficheur (le reglage touche, MIDI
 * LEARN, les messages du clip), les touches de page SOUND+, LIBRARY et TOOLS, LEARN et CLOSE. Le panneau garde sa hauteur sur les
 * deux pages (face.css), la carte ne bouge pas. Plus rien sur la face fermee (Mika : "tout dans OPEN").
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
import { Library } from './Library';
import { arpExtra, extraParam } from './extra';
import { arpMidi, type ArpMidiState } from './midimap';
import { sectionPrefix, SoundPlus, xTouch } from './SoundPlus';
import { ARP_BUILD } from '../../firmware';
import { uiScale } from './scale';
import { arpSteps, STEP_TRACKS, stepName } from './steps';
import { hoodTab, type HoodTab } from './tab';

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
const useTab = () => useSyncExternalStore(hoodTab.subscribe, hoodTab.get, hoodTab.get);

const TABS: readonly { id: HoodTab; label: string }[] = [
  { id: 'sound', label: 'SOUND+' },
  { id: 'library', label: 'LIBRARY' },
  { id: 'tools', label: 'TOOLS' },
];

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
const Key: React.FC<KeyProps> = ({ legend, led, fn, size = 'm', sub, className, ...rest }) => (
  <button type="button" className={`mm-arp-kb${className ? ` ${className}` : ''}`} data-size={size} data-fn={fn ? '1' : undefined} {...rest}>
    {led !== undefined && <span className="mm-arp-led" data-on={led ? '1' : undefined} data-blink={led === 'blink' ? '1' : undefined} aria-hidden="true" />}
    <span className="mm-arp-k" aria-hidden="true" />
    <span className="mm-arp-legend">{legend}</span>
    {sub && <span className="mm-arp-legend-sub">{sub}</span>}
  </button>
);

const useTouch = () => useSyncExternalStore(xTouch.subscribe, xTouch.get, xTouch.get);
const useExtra = () => useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);

/** L'afficheur du panneau (le verre de l'ecran de la machine) : MIDI LEARN, le message du clip, le reglage touche, sinon la page. */
const Lcd: React.FC<{ tab: HoodTab }> = ({ tab }) => {
  const st = useArpMidi();
  const t = useTouch();
  const extra = useExtra();
  const steps = useSyncExternalStore(arpSteps.subscribe, arpSteps.get, arpSteps.get);
  let head: string;
  let line: string;
  let mode = 'idle';
  if (st.learning) {
    head = 'MIDI LEARN';
    line = st.armed ? `CC → ${paramLabel(st.armed)}` : 'CLICK A KNOB';
    mode = 'learn';
  } else if (st.status) {
    head = st.status.ok ? 'CLIP' : 'CLIP · ERROR';
    line = st.status.msg;
    mode = 'status';
  } else if (t && extraParam(t.id)) {
    const p = extraParam(t.id) as NonNullable<ReturnType<typeof extraParam>>;
    head = `${sectionPrefix(p)}${p.label}`;
    line = arpExtra.text(p.id, extra[p.id]);
    mode = t.active ? 'gesture' : 'touch';
  } else if (t && t.id.startsWith('step:')) {
    // Un pas du STEP SEQUENCER du module avant (FrontModule.tsx) : sa piste et son numero, son etat
    const [, track, i] = t.id.split(':');
    const spec = STEP_TRACKS.find((x) => x.id === track);
    head = `STEP ${Number(i) + 1} · ${spec?.label ?? ''}`;
    line = spec ? stepName(spec.id, steps[spec.id][Number(i)]) : '';
    mode = t.active ? 'gesture' : 'touch';
  } else if (tab === 'library') {
    head = 'LIBRARY · VST3';
    line = 'FACTORY SOUNDS';
  } else if (tab === 'sound') {
    head = 'SOUND+ · VST3';
    line = (extra.xQuality ?? 0) >= 0.5 ? 'HQ · x8' : 'STD · x4';
  } else {
    const n = st.items?.length ?? 0;
    head = 'TOOLS';
    line = `x${st.cycles} · ${n} CC MAPPED`;
  }
  return (
    <div className="mm-arp-lcd" data-mode={mode} role="status" aria-live="polite">
      <span className="mm-arp-lcd-head">{head}</span>
      <span className="mm-arp-lcd-line">{line}</span>
    </div>
  );
};

/** La colonne de droite : l'afficheur, les touches de page (SOUND+, TOOLS), LEARN, CLOSE. */
const Rail: React.FC<{ tab: HoodTab; onClose: () => void }> = ({ tab, onClose }) => {
  const st = useArpMidi();
  return (
    <div className="mm-arp-rail">
      <Lcd tab={tab} />
      <div className="mm-arp-rail-keys">
        <div className="mm-arp-tabs" role="tablist" aria-label="Hood page">
          {TABS.map((t) => (
            <Key
              key={t.id}
              role="tab"
              id={`mm-arp-tab-${t.id}`}
              aria-selected={tab === t.id}
              aria-controls={`mm-arp-panel-${t.id}`}
              tabIndex={tab === t.id ? 0 : -1}
              className="mm-arp-tab"
              data-on={tab === t.id ? '1' : undefined}
              size="s"
              led={tab === t.id}
              legend={t.label}
              onClick={() => hoodTab.set(t.id)}
              onKeyDown={(e) => {
                if (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight' && e.key !== 'ArrowUp' && e.key !== 'ArrowDown') return;
                e.preventDefault();
                e.stopPropagation();
                const i = TABS.findIndex((x) => x.id === t.id);
                const next = TABS[(i + (e.key === 'ArrowLeft' || e.key === 'ArrowUp' ? TABS.length - 1 : 1)) % TABS.length].id;
                hoodTab.set(next);
                document.getElementById(`mm-arp-tab-${next}`)?.focus();
              }}
            />
          ))}
          <span className="mm-arp-bracket" aria-hidden="true">
            <span>PAGE</span>
          </span>
        </div>
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
        {/* CLOSE (2026-11-11, Mika : "je n'ai plus de bouton CLOSE") : sa LED orange, toujours allumee capot ouvert */}
        <Key className="mm-arp-close" size="s" fn led legend="CLOSE" aria-label="Close the machine" title="Close the hood (Esc)" onClick={onClose} />
      </div>
      {/* La version du build (2026-11-11) : la meme chaine que la serigraphie de la face (firmware.ts ARP_BUILD) */}
      <p className="mm-arp-rev" title={ARP_BUILD}>
        {ARP_BUILD}
      </p>
    </div>
  );
};

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
    <section className="mm-arp-col mm-arp-drag" aria-label="Clip">
      <p className="mm-arp-col-title">CLIP</p>
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
    </section>
  );
};

/** MIDI : la table des CC (LEARN est dans la colonne de droite), CLEAR ALL. */
const MidiMap: React.FC = () => {
  const st = useArpMidi();
  const items = st.items ?? [];
  const line = st.learning ? (st.armed ? `WAITING CC FOR ${paramLabel(st.armed)}` : 'CLICK A KNOB') : st.items === null ? '…' : items.length === 0 ? 'NO CC MAPPED' : `${items.length} CC MAPPED`;
  return (
    <section className="mm-arp-col mm-arp-midi" aria-label="MIDI mapping">
      <p className="mm-arp-col-title">MIDI</p>
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
          <Key className="mm-arp-key mm-arp-clearall" size="s" legend="CLEAR ALL" disabled={items.length === 0} onClick={() => arpBridge.unmapAll()} />
          <p className="mm-arp-help">
            ALSO IN ABLETON
            <br />
            CMD + M
          </p>
        </div>
      </div>
    </section>
  );
};

/** Le panneau, capot ouvert (ou qui s'ouvre) : la carte remonte au-dessus de lui. */
export const HoodPanel: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const hood = useHood();
  const open = hood === 'opening' || hood === 'open';
  const tab = useTab();
  const ref = useRef<HTMLDivElement>(null);
  // Le panneau est en haut (2026-11-11) : la carte se cadre dessous (Stage.setHead). Sa hauteur a l'ecran : celle de son
  // repere (offsetHeight, 172 px) fois l'echelle de la couche (scale.ts) ; la fenetre redimensionnee : sans transition
  useLayoutEffect(() => {
    const el = ref.current;
    if (!stage || !el || !open) return undefined;
    let first = true;
    const apply = (): void => {
      stage.setHead('voy', el.offsetHeight * uiScale.get(), !first);
      first = false;
    };
    apply();
    const ro = typeof ResizeObserver === 'undefined' ? null : new ResizeObserver(apply);
    ro?.observe(el);
    const off = uiScale.subscribe(apply);
    return () => {
      ro?.disconnect();
      off();
      stage.setHead('voy', 0);
    };
  }, [stage, open]);
  // Le capot s'ouvre : la table des CC a jour (la liste des presets : DiskPresets)
  useEffect(() => {
    if (open) arpBridge.midimapGet();
  }, [open]);
  if (!open) return null;
  return (
    <section ref={ref} className="mm-arp-hood" style={{ position: 'absolute' }} data-tab={tab} aria-label="MM-ARP hood">
      {tab === 'sound' ? (
        <SoundPlus />
      ) : tab === 'library' ? (
        <Library />
      ) : (
        <div className="mm-arp-page mm-arp-tools" role="tabpanel" id="mm-arp-panel-tools" aria-labelledby="mm-arp-tab-tools">
          <DragMidi />
          <DiskPresets />
          <MidiMap />
        </div>
      )}
      <Rail tab={tab} onClose={() => openToggle(stage, 'voy')} />
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
    <button type="button" className="mm-arp-learn-pill" style={{ position: 'absolute' }} onClick={() => arpBridge.learnMode(false)} aria-label="Stop MIDI learn">
      <span className="mm-arp-led" aria-hidden="true" />
      MIDI LEARN · {st.armed ? `WAITING CC FOR ${paramLabel(st.armed)}` : 'CLICK A KNOB'} · ESC
    </button>
  );
};
