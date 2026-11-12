/**
 * Le panneau d'OPEN du plugin MM-ARP (2026-11-09 : un panneau au-dessus de la carte ouverte ; refait le 2026-11-11, Mika :
 * "sur ce synthe, quand on clique sur le titre on a une autre interface : moi je veux le bouton OPEN pour ca, et avoir
 * encore tout un tas d'interfaces ; pour le OPEN je veux ces knobs-la (bouton noir a index blanc, graduations
 * chiffrees)"). OPEN (la touche de la machine, celle du bandeau, la touche O) bascule TOUTE la fenetre sur ce second
 * panneau, dans le meme habillage que la face (le simili noir, les titres en petites capitales et leur filet fin : plus
 * de bandeau de metal ni de cadre depuis le 2026-11-12), sur la MEME grille (scale.ts GRID, OPEN_ROW : six rangees) ;
 * CLOSE (le bandeau), OPEN, O ou Echap reviennent a la face. Le bandeau du haut reste (Header.tsx) : son titre
 * dit OPTIONS PANEL, sa touche devient CLOSE. La scene 3D ne s'ouvre plus dans le plugin (voyager/rig.ts) : l'etat du
 * capot (state/explode.ts voyExplode) reste la source, la face 3D attend dessous.
 *
 * Trois pages (2026-11-11, Mika : "je veux toutes les fonctions possibles ... avoir encore tout un tas d'interfaces"),
 * choisies par les onglets du bandeau (Header.tsx ; openPage, la page ouverte est retenue) :
 * - OPTIONS : le son. Les TWEAKS du site (les potards de la carte, voyager/params.ts section tweak, a leurs ids du site :
 *   OSC, FILTER, DELAY, OUTPUT TWEAKS, PERFORMANCE), puis les reglages du VST3 seul (extra.ts) : ENGINE (QUALITY), VOICE
 *   (VOICE MODE, BEND RANGE), AMP (FEEDBACK, AMP MODE), DISTORTION, REVERB, EQ, MASTER ;
 * - MODULATION : la matrice (Matrix.tsx : six lignes source, quantite, destination), LFO 1 et LFO 2, le rappel des
 *   sources et de ce qu'elles modulent ;
 * - LIBRARY : CLIP (DRAG MIDI, x1 / x2 / x4, SAVE .MID) et MIDI (LEARN, la table des CC, CLEAR ALL) a gauche ; LIBRARY au
 *   milieu (Library.tsx : les 40 presets d'usine, quatre categories cote a cote) ; DISK a droite (DiskPresets.tsx).
 * Les potards : celui de la machine, noir a index blanc (SoundPlus.tsx, knob.ts), sur les colonnes de la grille.
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
import { Matrix, ModSources } from './Matrix';
import { arpMidi, type ArpMidiState } from './midimap';
import { CHEEK_W, GRID, HEAD_H, UI_H, UI_W } from './scale';
import { Sec, sectionPrefix, VKnob, VSwitch, XKnob, XSwitch } from './SoundPlus';

/* ---------------- les pages du panneau ---------------- */

export type OpenPage = 'sound' | 'mod' | 'lib';
/** Les pages, dans l'ordre des onglets du bandeau ; hint : ce que dit l'afficheur au repos. */
export const OPEN_PAGES: readonly { id: OpenPage; tab: string; hint: string }[] = [
  { id: 'sound', tab: 'OPTIONS', hint: 'TWEAKS · VOICE · AMP · EQ · MASTER' },
  { id: 'mod', tab: 'MODULATION', hint: 'MATRIX · LFO 1 · LFO 2' },
  { id: 'lib', tab: 'LIBRARY', hint: 'PRESETS · DISK · MIDI · CLIP' },
];
/** La page ouverte, retenue (une cle mm.v4.* : elle part dans l'etat du projet avec le reste). */
const PAGE_KEY = 'mm.v4.plugin.arp.page';
const readPage = (): OpenPage => {
  try {
    const v = window.localStorage.getItem(PAGE_KEY);
    return OPEN_PAGES.some((p) => p.id === v) ? (v as OpenPage) : 'sound';
  } catch {
    return 'sound';
  }
};
let pageNow: OpenPage = readPage();
const pageListeners = new Set<() => void>();
export const openPage = {
  get: (): OpenPage => pageNow,
  set(p: OpenPage): void {
    if (p === pageNow) return;
    pageNow = p;
    try {
      window.localStorage.setItem(PAGE_KEY, p);
    } catch {
      /* stockage refuse : la page n'est pas retenue */
    }
    pageListeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    pageListeners.add(fn);
    return () => {
      pageListeners.delete(fn);
    };
  },
};

/** Le glisser part apres ce deplacement (px), le bouton tenu. */
const DRAG_PX = 4;
const CYCLES: readonly ArpMidiState['cycles'][] = [1, 2, 4];

/** Les parametres du plugin qui ne sont pas des potards de la face (plugin/mm-arp/src/PluginProcessor.cpp). */
const EXTRA_LABELS: Record<string, string> = { arp: 'ARPEGGIATOR', master: 'MASTER', prio: 'CLIP PRIORITY' };

/** Le bloc d'un reglage SOUND+ devant son label (SPEED, TARGET, DEPTH existent aussi sur la face). */
const X_PREFIX: Record<string, string> = { engine: '', lfo1: 'LFO 1 ', lfo2: 'LFO 2 ', reverb: 'REVERB ', master: 'MASTER ' };
/** Les reglages affiches par un commutateur (les autres : un potard). */
const X_SWITCH: ReadonlySet<string> = new Set(['xQuality', 'xVoiceMode', 'xAmpMode']);
/** Le nom d'un potard quand le bandeau de sa section le dit deja (DISTORTION : sa dose). */
const X_LABEL: Record<string, string> = { xDist: 'AMOUNT' };

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
    <Sec id="clip" title="CLIP" className="mm-arp-drag" col={0} span={6} row={0}>
      <div className="mm-arp-cells">
        <button
          type="button"
          className="mm-arp-kb mm-arp-drag-handle"
          data-fn="1"
          draggable={false}
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
        </button>
        <div className="mm-arp-seg mm-arp-cells" role="radiogroup" aria-label="Times the progression">
          {CYCLES.map((c) => (
            <Key key={c} role="radio" aria-checked={st.cycles === c} className="mm-arp-seg-key" data-on={st.cycles === c ? '1' : undefined} size="s" led={st.cycles === c} legend={`x${c}`} onClick={() => arpMidi.set({ cycles: c })} />
          ))}
        </div>
        <Key className="mm-arp-key mm-arp-savemid" size="s" legend="SAVE .MID" onClick={() => arpBridge.saveMid(arpMidi.get().cycles)} />
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
    <Sec id="midi" title="MIDI" className="mm-arp-midi" col={0} span={6} row={1} fill led={st.learning ? 'blink' : false} side={<span className="mm-arp-midi-line" role="status">{line}</span>} sideOn={st.learning}>
      <div className="mm-arp-cells">
        <Key
          className="mm-arp-learn mm-arp-rail-learn"
          size="s"
          aria-pressed={st.learning}
          data-on={st.learning ? '1' : undefined}
          led={st.learning ? 'blink' : false}
          legend="LEARN"
          aria-label={st.learning ? (st.armed ? `MIDI learn: waiting CC for ${paramLabel(st.armed)}` : 'MIDI learn: click a knob') : 'MIDI learn'}
          onClick={() => arpBridge.learnMode(!st.learning)}
        />
        <Key className="mm-arp-key mm-arp-clearall" size="s" legend="CLEAR ALL" disabled={items.length === 0} onClick={() => arpBridge.unmapAll()} />
      </div>
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
    </Sec>
  );
};

/* ---------------- les sections de potards ---------------- */

/** Les TWEAKS du site, par bloc (ceux de la carte : voyager/theme.ts VT.groups) ; sw : un commutateur a deux positions. */
const TW_OSC = { id: 'tw-osc', title: 'OSC TWEAKS', ids: ['phase', 'drift', 'stack', 'sync'] } as const;
const TW_OUT = { id: 'tw-out', title: 'OUTPUT TWEAKS', ids: ['width', 'wide', 'monoLow', 'glue', 'duck'] } as const;
const TW_FILTER = { id: 'tw-filter', title: 'FILTER TWEAKS', ids: ['load', 'space', 'fpol'] } as const;
const TW_DELAY = { id: 'tw-delay', title: 'DELAY TWEAKS', ids: ['dlyTime', 'tape'] } as const;
const TW_PERF = { id: 'tw-perf', title: 'PERFORMANCE', ids: ['keyTrack', 'accent', 'accFlt', 'chord'] } as const;
const V_SWITCH: ReadonlySet<VoyKnobId> = new Set<VoyKnobId>(['sync', 'fpol']);

/** Ou se pose une section de potards : sa premiere colonne, sa rangee, le pas de ses potards (en colonnes). */
interface At {
  col: number;
  row: number;
  step: number;
}

const Tweaks: React.FC<{ id: string; title: string; ids: readonly VoyKnobId[]; at: At }> = ({ id, title, ids, at }) => (
  <Sec id={id} title={title} col={at.col} span={at.step * ids.length} row={at.row} pitch={GRID.col * at.step}>
    <div className="mm-arp-cells">{ids.map((k) => (V_SWITCH.has(k) ? <VSwitch key={k} id={k} /> : <VKnob key={k} id={k} />))}</div>
  </Sec>
);

/** Une section des reglages du VST3 seul (extra.ts) : ENGINE, VOICE, AMP, DISTORTION, REVERB, EQ, MASTER, LFO 1, LFO 2. */
const Extra: React.FC<{ id: ExtraSection; title: string; at: At }> = ({ id, title, at }) => {
  const list = EXTRA_PARAMS.filter((p) => p.section === id);
  return (
    <Sec id={id} title={title} col={at.col} span={at.step * list.length} row={at.row} pitch={GRID.col * at.step}>
      <div className="mm-arp-cells">{list.map((p) => (X_SWITCH.has(p.id) ? <XSwitch key={p.id} p={p} /> : <XKnob key={p.id} p={p} label={X_LABEL[p.id]} />))}</div>
    </Sec>
  );
};

/**
 * OPTIONS : six rangees de six reglages, un toutes les trois colonnes (les colonnes 3, 6, 9, 12, 15 et 18 de la grille),
 * chaque rangee pleine : une grande section a gauche, une petite a droite.
 */
const L = (row: number): At => ({ col: 2, row, step: 3 });
const R = (row: number, n: number): At => ({ col: 2 + 3 * (6 - n), row, step: 3 });
const SoundPage: React.FC = () => (
  <>
    <Tweaks {...TW_OSC} at={L(0)} />
    <Tweaks {...TW_DELAY} at={R(0, 2)} />
    <Tweaks {...TW_FILTER} at={L(1)} />
    <Extra id="reverb" title="REVERB" at={R(1, 3)} />
    <Tweaks {...TW_OUT} at={L(2)} />
    <Extra id="engine" title="ENGINE" at={R(2, 1)} />
    <Tweaks {...TW_PERF} at={L(3)} />
    <Extra id="voice" title="VOICE" at={R(3, 2)} />
    <Extra id="eq" title="EQ" at={L(4)} />
    <Extra id="amp" title="AMP" at={R(4, 2)} />
    <Extra id="master" title="MASTER" at={L(5)} />
    <Extra id="dist" title="DISTORTION" at={R(5, 2)} />
  </>
);

/**
 * MODULATION : la matrice sur les colonnes 0 a 9 (une ligne par rangee de la grille) ; a droite LFO 1 (colonnes 11, 12),
 * LFO 2 (14 a 17) et CLEAR MATRIX (20) sur la premiere rangee, puis le rappel des sources.
 */
const ModPage: React.FC = () => (
  <>
    <Sec id="matrix-src" title="SOURCE" col={1} span={4} row={0} />
    <Sec id="matrix-amt" title="AMOUNT" col={5} span={1} row={0} />
    <Sec id="matrix-dst" title="DESTINATION" col={6} span={4} row={0} />
    <Matrix />
    <Extra id="lfo1" title="LFO 1" at={{ col: 11, row: 0, step: 1 }} />
    <Extra id="lfo2" title="LFO 2" at={{ col: 14, row: 0, step: 1 }} />
    <ModSources />
  </>
);

/** LIBRARY : CLIP et MIDI a gauche (colonnes 0 a 5), la banque d'usine au milieu (7 a 16), les presets du disque a droite (18 a 21). */
const LibPage: React.FC = () => (
  <>
    <DragMidi />
    <MidiMap />
    <LibraryBank />
    <DiskPresets />
  </>
);

/** Le panneau, capot ouvert (ou qui s'ouvre) : il prend toute la fenetre sous le bandeau ; une page a la fois. */
export const HoodPanel: React.FC = () => {
  const hood = useHood();
  const page = useSyncExternalStore(openPage.subscribe, openPage.get, openPage.get);
  const open = hood === 'opening' || hood === 'open';
  // Le capot s'ouvre : la table des CC a jour (la liste des presets : DiskPresets)
  useEffect(() => {
    if (open) arpBridge.midimapGet();
  }, [open]);
  if (!open) return null;
  const tab = OPEN_PAGES.find((p) => p.id === page) ?? OPEN_PAGES[0];
  return (
    <section
      className="mm-arp-open"
      id="mm-arp-open-page"
      role="tabpanel"
      data-page={page}
      style={{ position: 'absolute', left: CHEEK_W, top: HEAD_H, width: UI_W - 2 * CHEEK_W, height: UI_H - HEAD_H }}
      aria-label={`MM-ARP options panel, ${tab.tab.toLowerCase()} page`}
    >
      {page === 'sound' ? <SoundPage /> : page === 'mod' ? <ModPage /> : <LibPage />}
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
