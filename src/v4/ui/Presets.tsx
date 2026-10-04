/**
 * PRESETS (2026-10-04, Mika : "quand je trouve un truc cool, je voudrais
 * que ca sauvegarde un preset, avec un nom aleatoire") : une pastille au
 * coin bas droit quand on utilise le MM-ARP ou le MM-RYTM (desktop et
 * telephone). Elle ouvre la liste de la machine : SAVE garde l'etat sous un
 * nom tire au hasard (state/presets.ts), toucher un nom le recharge, le de
 * en tire un autre, la croix l'efface (touchee deux fois). L'ecran de la
 * machine le dit. Echap ou un clic dehors referme.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { gesture } from '../actions';
import { editor } from '../state/editor';
import { explode, voyExplode } from '../state/explode';
import { focus } from '../state/focus';
import { intro } from '../state/intro';
import { lcdMessage } from '../state/lcdMessage';
import { presets, type PresetMachine } from '../state/presets';
import { section } from '../state/section';
import { voyMsg } from '../voyager/msg';

const TITLE: Record<PresetMachine, { title: string; save: string }> = {
  voy: { title: 'MM-ARP PRESETS', save: 'SAVE THIS SOUND' },
  mm808: { title: 'MM-RYTM PRESETS', save: 'SAVE THIS BEAT' },
};

const say = (m: PresetMachine, text: string): void => (m === 'voy' ? voyMsg.show(text) : lcdMessage.show(text));

export const Presets: React.FC<{ mobile: boolean }> = ({ mobile }) => {
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  const settled = useSyncExternalStore(focus.subscribe, focus.settled, focus.settled);
  const introState = useSyncExternalStore(intro.subscribe, intro.get, intro.get);
  const opened = useSyncExternalStore(section.subscribe, section.get, section.get);
  const ed = useSyncExternalStore(editor.subscribe, editor.get, editor.get);
  const hood808 = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  const hoodVoy = useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  useSyncExternalStore(presets.subscribe, presets.get, presets.get);
  const m: PresetMachine | null = f === 'voy' || f === 'mm808' ? f : null;
  const hood = m === 'voy' ? hoodVoy : hood808;
  // Au telephone, l'editeur ouvert prend le bas de l'ecran
  const shown = !!m && settled && introState === 'done' && opened === null && hood === 'closed' && !(mobile && ed !== null);
  const [open, setOpen] = useState(false);
  const [fresh, setFresh] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<string | null>(null);
  const box = useRef<HTMLDivElement>(null);

  // Une autre machine, ou cache : la liste se referme
  useEffect(() => {
    if (!shown) setOpen(false);
  }, [shown, m]);

  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(false);
    };
    const onDown = (e: PointerEvent): void => {
      if (box.current && e.target instanceof Node && !box.current.contains(e.target)) setOpen(false);
    };
    window.addEventListener('keydown', onKey, true);
    window.addEventListener('pointerdown', onDown, true);
    return () => {
      window.removeEventListener('keydown', onKey, true);
      window.removeEventListener('pointerdown', onDown, true);
    };
  }, [open]);

  // La croix revient d'elle-meme si on ne confirme pas
  useEffect(() => {
    if (!confirm) return undefined;
    const t = window.setTimeout(() => setConfirm(null), 3000);
    return () => window.clearTimeout(t);
  }, [confirm]);

  if (!m) return null;
  const list = presets.of(m);

  return (
    <div ref={box} className="v4-presets" data-shown={shown ? '1' : '0'} data-mobile={mobile ? '1' : '0'} aria-hidden={!shown}>
      {open && (
        <div className="v4-presets-pop" role="dialog" aria-label={TITLE[m].title}>
          <div className="v4-presets-head">
            <span className="v4-presets-title">{TITLE[m].title}</span>
            <button type="button" className="v4-presets-x" aria-label="Close the presets" onClick={() => setOpen(false)}>
              <i className="fa-solid fa-xmark v4-fa" aria-hidden="true" />
            </button>
          </div>
          <button
            type="button"
            className="v4-presets-save"
            onClick={() => {
              gesture();
              const p = presets.save(m);
              setFresh(p.id);
              say(m, `SAVED ${p.name.toUpperCase()}`);
            }}
          >
            <i className="fa-solid fa-star v4-fa" aria-hidden="true" />
            <span>{TITLE[m].save}</span>
          </button>
          {list.length === 0 ? (
            <p className="v4-presets-empty">Nothing saved yet. Find something cool, then save it.</p>
          ) : (
            <ul className="v4-presets-list">
              {list.map((p) => (
                <li key={p.id} className="v4-presets-row" data-fresh={fresh === p.id ? '1' : '0'}>
                  <button
                    type="button"
                    className="v4-presets-name"
                    onClick={() => {
                      gesture();
                      if (presets.load(m, p.id)) say(m, `LOADED ${p.name.toUpperCase()}`);
                    }}
                  >
                    {p.name}
                  </button>
                  <button type="button" className="v4-presets-icon" aria-label={`Another name for ${p.name}`} onClick={() => presets.rename(m, p.id)}>
                    <i className="fa-solid fa-dice v4-fa" aria-hidden="true" />
                  </button>
                  <button
                    type="button"
                    className="v4-presets-icon"
                    data-confirm={confirm === p.id ? '1' : '0'}
                    aria-label={confirm === p.id ? `Tap again to delete ${p.name}` : `Delete ${p.name}`}
                    onClick={() => {
                      if (confirm === p.id) {
                        presets.remove(m, p.id);
                        setConfirm(null);
                      } else setConfirm(p.id);
                    }}
                  >
                    {confirm === p.id ? <span>SURE?</span> : <i className="fa-solid fa-xmark v4-fa" aria-hidden="true" />}
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
      <button type="button" className="v4-presets-btn" aria-expanded={open} aria-label={`${TITLE[m].title}, ${list.length} saved`} tabIndex={shown ? 0 : -1} onClick={() => setOpen((o) => !o)}>
        <i className="fa-solid fa-star v4-fa" aria-hidden="true" />
        <span>PRESETS</span>
        {list.length > 0 && <span className="v4-presets-count">{list.length}</span>}
      </button>
    </div>
  );
};

export default Presets;
