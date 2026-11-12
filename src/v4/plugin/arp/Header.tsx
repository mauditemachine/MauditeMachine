/**
 * Le bandeau du haut de la fenetre du plugin MM-ARP (2026-11-11, le format large), sur toute la largeur entre les joues,
 * sur la face comme sur le panneau d'OPEN : l'identite de la machine et le passage d'un panneau a l'autre.
 * - a gauche : le logotype Maudite Machine, MM-ARP, puis, en petites capitales : FRONT PANEL sur la face ; panneau
 *   d'OPEN ouvert, un onglet par page (OPTIONS, MODULATION, LIBRARY : HoodPanel.tsx openPage), celui de la page montree
 *   en clair et souligne (plus de plaque de metal depuis le 2026-11-12) ;
 * - au milieu : l'afficheur (le verre de l'ecran de la machine). Au repos : le preset d'usine charge (LIBRARY, Library.tsx)
 *   entre deux fleches qui chargent le precedent et le suivant ; sinon, dans l'ordre : MIDI LEARN, le message du clip
 *   (DRAG MIDI, SAVE .MID), le reglage touche (son nom et sa valeur, SoundPlus.tsx xTouch) ou le pas touche du STEP
 *   SEQUENCER ;
 * - a droite : la version du build (firmware.ts ARP_BUILD, celle que la machine serigraphiait dans son en-tete) et la
 *   touche OPEN, sa legende orange comme PRESET et OPEN sur la machine ; panneau ouvert elle dit CLOSE, sa LED allumee.
 */

import React, { useEffect, useSyncExternalStore } from 'react';
import { openToggle } from '../../actions';
import { ARP_BUILD } from '../../firmware';
import type { Stage } from '../../scene/renderer';
import { voyExplode } from '../../state/explode';
import { VOY_KNOB_IDS, voyKnob, voyParams, voyValueText, type VoyKnobId } from '../../voyager/params';
import { arpExtra, extraParam } from './extra';
import { Key, OPEN_PAGES, openPage, paramLabel } from './HoodPanel';
import { libCurrent, libStep, libStore, LIB_PRESETS } from './Library';
import { arpMidi } from './midimap';
import { CHEEK_W, HEAD_H, UI_W } from './scale';
import { sectionPrefix, xTouch } from './SoundPlus';
import { arpSteps, STEP_TRACKS, stepName } from './steps';

const isKnob = (id: string): id is VoyKnobId => (VOY_KNOB_IDS as readonly string[]).includes(id);

/**
 * Les potards de la machine 3D dans l'afficheur (2026-11-12 : ils n'ont plus de chiffres autour d'eux, leur valeur se lit
 * ici) : le potard survole ou tourne devient le reglage touche (xTouch), comme ceux du rack. Les jumeaux de la scene
 * (ui/VoyTwins.tsx, data-hotspot="vk-<id>") disent ou est chaque potard ; ils ne prennent pas la souris : on compare la
 * place du pointeur a leurs boites. Rien n'est envoye au plugin : l'afficheur seul.
 */
function useMachineTouch(): void {
  useEffect(() => {
    let held: string | null = null;
    let over: string | null = null;
    const at = (e: PointerEvent): string | null => {
      if (!(e.target instanceof Element) || !e.target.closest('.mm-arp-stagebox')) return null;
      for (const el of document.querySelectorAll<HTMLElement>('[data-twin="vknob"], [data-twin="vpush"]')) {
        const r = el.getBoundingClientRect();
        if (e.clientX >= r.left && e.clientX <= r.right && e.clientY >= r.top && e.clientY <= r.bottom) return (el.dataset.hotspot ?? '').replace(/^vk-/, '') || null;
      }
      return null;
    };
    const onMove = (e: PointerEvent): void => {
      if (held) return;
      const id = at(e);
      if (id === over) return;
      over = id;
      if (id) xTouch.set(id, false);
    };
    const onDown = (e: PointerEvent): void => {
      held = at(e);
      if (held) xTouch.set(held, true);
    };
    const onUp = (): void => {
      if (!held) return;
      xTouch.set(held, false);
      held = null;
    };
    const opts = { capture: true, passive: true } as const;
    window.addEventListener('pointermove', onMove, opts);
    window.addEventListener('pointerdown', onDown, opts);
    window.addEventListener('pointerup', onUp, opts);
    window.addEventListener('pointercancel', onUp, opts);
    return () => {
      window.removeEventListener('pointermove', onMove, opts);
      window.removeEventListener('pointerdown', onDown, opts);
      window.removeEventListener('pointerup', onUp, opts);
      window.removeEventListener('pointercancel', onUp, opts);
    };
  }, []);
}

/** L'afficheur : deux lignes, un titre et une valeur ; mode : la couleur du titre (face.css). */
const Lcd: React.FC<{ open: boolean }> = ({ open }) => {
  const page = useSyncExternalStore(openPage.subscribe, openPage.get, openPage.get);
  const st = useSyncExternalStore(arpMidi.subscribe, arpMidi.get, arpMidi.get);
  const t = useSyncExternalStore(xTouch.subscribe, xTouch.get, xTouch.get);
  const extra = useSyncExternalStore(arpExtra.subscribe, arpExtra.get, arpExtra.get);
  const knobs = useSyncExternalStore(voyParams.subscribe, voyParams.get, voyParams.get);
  const steps = useSyncExternalStore(arpSteps.subscribe, arpSteps.get, arpSteps.get);
  useSyncExternalStore(libStore.subscribe, libStore.get, libStore.get);
  const cur = libCurrent();
  let head: string;
  let line: string;
  let side = '';
  let mode = 'idle';
  const x = t ? extraParam(t.id) : undefined;
  if (st.learning) {
    head = 'MIDI LEARN';
    line = st.armed ? `CC → ${paramLabel(st.armed)}` : 'CLICK A KNOB';
    side = 'ESC';
    mode = 'learn';
  } else if (st.status) {
    head = st.status.ok ? 'CLIP' : 'CLIP · ERROR';
    line = st.status.msg;
    mode = 'status';
  } else if (t && x) {
    head = `${sectionPrefix(x)}${x.label}`;
    line = arpExtra.text(x.id, extra[x.id]);
    mode = t.active ? 'gesture' : 'touch';
  } else if (t && isKnob(t.id)) {
    head = voyKnob(t.id).label;
    line = voyValueText(t.id, knobs[t.id]);
    mode = t.active ? 'gesture' : 'touch';
  } else if (t && t.id.startsWith('step:')) {
    // Un pas du STEP SEQUENCER : sa piste et son numero, son etat
    const [, track, i] = t.id.split(':');
    const spec = STEP_TRACKS.find((s) => s.id === track);
    head = `STEP ${Number(i) + 1} · ${spec?.label ?? ''}`;
    line = spec ? stepName(spec.id, steps[spec.id][Number(i)]) : '';
    mode = t.active ? 'gesture' : 'touch';
  } else if (cur) {
    head = `LIBRARY · ${cur.preset.cat} ${String(cur.at + 1).padStart(2, '0')} / ${String(cur.of).padStart(2, '0')}`;
    line = cur.preset.name;
    side = `${cur.preset.bpm} BPM`;
  } else {
    const tab = OPEN_PAGES.find((p) => p.id === page) ?? OPEN_PAGES[0];
    head = open ? `OPTIONS PANEL · PAGE ${OPEN_PAGES.indexOf(tab) + 1} / ${OPEN_PAGES.length}` : 'FACTORY LIBRARY';
    line = open ? tab.hint : `${LIB_PRESETS.length} SOUNDS · PRESS ▶`;
  }
  return (
    <div className="mm-arp-lcd" data-mode={mode} role="status" aria-live="polite">
      <span className="mm-arp-lcd-head">{head}</span>
      <span className="mm-arp-lcd-line">{line}</span>
      {side && <span className="mm-arp-lcd-side">{side}</span>}
    </div>
  );
};

/**
 * Les onglets du panneau d'OPEN : un nom par page, celui de la page montree en clair et souligne, les autres gris. Fleches gauche et droite, Debut, Fin : la page d'a cote, la premiere, la derniere.
 */
const Tabs: React.FC = () => {
  const page = useSyncExternalStore(openPage.subscribe, openPage.get, openPage.get);
  const onKey = (e: React.KeyboardEvent<HTMLDivElement>): void => {
    const i = OPEN_PAGES.findIndex((p) => p.id === page);
    let j = i;
    if (e.key === 'ArrowRight') j = (i + 1) % OPEN_PAGES.length;
    else if (e.key === 'ArrowLeft') j = (i + OPEN_PAGES.length - 1) % OPEN_PAGES.length;
    else if (e.key === 'Home') j = 0;
    else if (e.key === 'End') j = OPEN_PAGES.length - 1;
    else return;
    e.preventDefault();
    e.stopPropagation();
    openPage.set(OPEN_PAGES[j].id);
    window.setTimeout(() => document.querySelector<HTMLElement>(`.mm-arp-tab[data-tab="${OPEN_PAGES[j].id}"]`)?.focus(), 0);
  };
  return (
    <div className="mm-arp-tabs" role="tablist" aria-label="Options panel pages" onKeyDown={onKey}>
      {OPEN_PAGES.map((p) => (
        <button key={p.id} type="button" role="tab" className="mm-arp-plate mm-arp-tab" data-tab={p.id} data-on={p.id === page ? '1' : undefined} aria-selected={p.id === page} aria-controls="mm-arp-open-page" tabIndex={p.id === page ? 0 : -1} onClick={() => openPage.set(p.id)}>
          {p.tab}
        </button>
      ))}
    </div>
  );
};

export const Header: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const hood = useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  const open = hood === 'opening' || hood === 'open';
  useMachineTouch();
  return (
    <header className="mm-arp-head" style={{ position: 'absolute', left: CHEEK_W, top: 0, width: UI_W - 2 * CHEEK_W, height: HEAD_H }} data-open={open ? '1' : undefined}>
      <div className="mm-arp-head-brand">
        <img className="mm-arp-head-logo" src="/logo/mauditemachine-logo-aligned.svg" alt="Maudite Machine" draggable={false} />
        <span className="mm-arp-head-model">MM-ARP</span>
        {open ? <Tabs /> : <span className="mm-arp-plate">FRONT PANEL</span>}
      </div>
      <div className="mm-arp-head-mid">
        <button type="button" className="mm-arp-head-arrow" aria-label="Previous factory preset" onClick={() => libStep(-1)}>
          <span className="mm-arp-k" aria-hidden="true">
            <span className="mm-arp-k-glyph">◀</span>
          </span>
        </button>
        <Lcd open={open} />
        <button type="button" className="mm-arp-head-arrow" aria-label="Next factory preset" onClick={() => libStep(1)}>
          <span className="mm-arp-k" aria-hidden="true">
            <span className="mm-arp-k-glyph">▶</span>
          </span>
        </button>
      </div>
      <div className="mm-arp-head-right">
        <span className="mm-arp-rev">
          {ARP_BUILD}
        </span>
        <Key
          className="mm-arp-openkey"
          size="s"
          fn
          led={open}
          legend={open ? 'CLOSE' : 'OPEN'}
          aria-label={open ? 'Close the options panel' : 'Open the options panel'}
          aria-pressed={open}
          onClick={() => openToggle(stage, 'voy')}
        />
      </div>
    </header>
  );
};
