/**
 * v52 (2026-11-24, Mika : "pourquoi on a pas toutes les notes ?", choix 2A, maquette mq52/2A.png) : la ligne CHORDS sous
 * les 8 pads devient un selecteur de tonalite. Une pastille posee dans le trait de la serigraphie (CHORDS, la tonique en
 * accent, le mode, une fleche) ; un clic ouvre un petit menu : rangee 1 les 12 notes (C a B, en dieses), rangee 2 les
 * modes (MINOR, MAJOR, DORIAN, PHRYGIAN). Le choix part dans xKey et xScale (key.ts), les pads, l'ecran, les pages SEQ et
 * SQ et le C++ suivent. Ferme au second clic, au clic dehors (avale) et a Echap.
 *
 * Le dessin est celui de la maquette a la fenetre de 1496 px de large (les pads 121.35 px l'un de l'autre), mis a
 * l'echelle des pads projetes : il reste colle au trait a toutes les tailles de fenetre. Capot ferme et hors EDIT
 * seulement (l'encart d'EDIT prend la place des pads).
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Vector3 } from 'three';
import type { Stage } from '../../scene/renderer';
import { editor } from '../../state/editor';
import { voyExplode } from '../../state/explode';
import { arpKey, KEY_NAMES, MODE_NAMES } from '../../voyager/chords';
import { voyMsg } from '../../voyager/msg';
import { VOY_GROUPS, VOY_PAD } from '../../voyager/theme';
import { chooseKey, keyText } from './key';
import './keySelect.css';

/** L'ecart des pads (px) a la fenetre de la maquette : l'echelle 1. */
const PAD_PITCH_REF = 121.35;
/** La hauteur du menu a l'echelle 1 (deux rangees de 16 px, 3 d'ecart, 5 de marge) et son ecart a la pastille. */
const MENU_H = 45;
const MENU_GAP = 3;
const PILL_H = 22;

interface Anchor {
  x: number;
  y: number;
  k: number;
}

/** Le milieu du trait CHORDS a l'ecran (la serigraphie du plateau, projetee par la camera) et l'echelle des pads. */
function anchorOf(stage: Stage): Anchor | null {
  const rig = stage.voy;
  const g = VOY_GROUPS.find((x) => x.silent);
  if (!rig || !g) return null;
  const mesh = rig.deckSilk.mesh;
  mesh.updateWorldMatrix(true, false);
  const rect = stage.renderer.domElement.getBoundingClientRect();
  const v = new Vector3();
  const at = (x: number, z: number): [number, number] => {
    v.set(x, 0, z);
    mesh.localToWorld(v);
    v.project(stage.camera);
    return [rect.left + ((v.x + 1) / 2) * rect.width, rect.top + ((1 - v.y) / 2) * rect.height];
  };
  const [x, y] = at((g.x0 + g.x1) / 2, g.z);
  const n = VOY_PAD.xs.length;
  const [xa] = at(VOY_PAD.xs[0], g.z);
  const [xb] = at(VOY_PAD.xs[n - 1], g.z);
  const k = Math.abs(xb - xa) / Math.max(1, n - 1) / PAD_PITCH_REF;
  if (!Number.isFinite(x) || !Number.isFinite(y) || !(k > 0.05)) return null;
  return { x, y, k };
}

export const KeySelect: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const hood = useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
  // EDIT : l'encart d'EDIT prend la place des pads (et de leur trait) : la pastille se cache
  const edit = useSyncExternalStore(editor.subscribe, editor.get, editor.get) === 'voy';
  const cur = useSyncExternalStore(arpKey.subscribe, arpKey.get, arpKey.get);
  const [pt, setPt] = useState<Anchor | null>(null);
  const [open, setOpen] = useState(false);
  const pill = useRef<HTMLButtonElement>(null);
  const menu = useRef<HTMLDivElement>(null);

  // La place : au chargement, a chaque taille de fenetre, quand la scene s'arrete (le capot se referme)
  useLayoutEffect(() => {
    if (!stage) return undefined;
    let last = '';
    const on = (): void => {
      const a = anchorOf(stage);
      const sig = a ? `${a.x.toFixed(1)} ${a.y.toFixed(1)} ${a.k.toFixed(4)}` : '';
      if (sig === last) return;
      last = sig;
      setPt(a);
    };
    on();
    const t = window.setTimeout(on, 300);
    window.addEventListener('resize', on);
    const offIdle = stage.onIdle(on);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', on);
      offIdle();
    };
  }, [stage]);

  // Le capot s'ouvre, EDIT monte : le menu se ferme
  useEffect(() => {
    if (hood !== 'closed' || edit) setOpen(false);
  }, [hood, edit]);

  // Ouvert : clic dehors (avale : ni pad, ni potard) et Echap le ferment
  useEffect(() => {
    if (!open) return undefined;
    let swallow = false;
    let closed = false;
    const inside = (t: EventTarget | null): boolean => {
      const n = t instanceof Node ? t : null;
      return !!n && (!!menu.current?.contains(n) || !!pill.current?.contains(n));
    };
    const onDown = (e: PointerEvent): void => {
      if (inside(e.target)) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      swallow = true;
      setOpen(false);
    };
    const onClick = (e: MouseEvent): void => {
      if (!swallow) return;
      swallow = false;
      e.preventDefault();
      e.stopImmediatePropagation();
      if (closed) window.removeEventListener('click', onClick, true);
    };
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      setOpen(false);
      pill.current?.focus({ preventScroll: true });
    };
    window.addEventListener('pointerdown', onDown, true);
    window.addEventListener('click', onClick, true);
    window.addEventListener('keydown', onKey, true);
    return () => {
      window.removeEventListener('pointerdown', onDown, true);
      window.removeEventListener('keydown', onKey, true);
      closed = true;
      if (!swallow) window.removeEventListener('click', onClick, true);
    };
  }, [open]);

  if (!stage || !pt || hood !== 'closed' || edit) return null;
  const pick = (key: number, mode: number): void => {
    if (key === cur.key && mode === cur.mode) return;
    chooseKey(key, mode);
    voyMsg.show(`CHORDS ${keyText(key, mode)}`, 1600);
  };
  // Le menu sous la pastille (la maquette) ; s'il sortait de la fenetre, au-dessus
  const below = pt.y + (PILL_H / 2 + MENU_GAP + MENU_H) * pt.k <= window.innerHeight - 1;
  const name = keyText(cur.key, cur.mode);
  return (
    <div
      className="mm-keysel"
      data-open={open ? '1' : undefined}
      style={{ position: 'fixed', left: pt.x, top: pt.y, transform: `translate(-50%, -50%) scale(${pt.k})` }}
    >
      <button
        ref={pill}
        type="button"
        className="mm-keysel-pill"
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label={`Chords key ${name}`}
        title="Key of the chord pads"
        onClick={() => setOpen((o) => !o)}
      >
        <span className="mm-keysel-lab">CHORDS</span>
        <span className="mm-keysel-key">{KEY_NAMES[cur.key]}</span>
        <span className="mm-keysel-mode">{MODE_NAMES[cur.mode]}</span>
        <span className="mm-keysel-arr" aria-hidden="true">
          ▾
        </span>
      </button>
      {open && (
        <div ref={menu} className="mm-keysel-menu" role="menu" aria-label="Key of the chord pads" data-up={below ? undefined : '1'}>
          <div className="mm-keysel-row" role="group" aria-label="Root note">
            {KEY_NAMES.map((n, i) => (
              <button key={n} type="button" role="menuitemradio" aria-checked={i === cur.key} className="mm-keysel-chip" data-on={i === cur.key ? '1' : undefined} onClick={() => pick(i, cur.mode)}>
                {n}
              </button>
            ))}
          </div>
          <div className="mm-keysel-row" role="group" aria-label="Mode">
            {MODE_NAMES.map((n, i) => (
              <button key={n} type="button" role="menuitemradio" aria-checked={i === cur.mode} className="mm-keysel-chip mm-keysel-wide" data-on={i === cur.mode ? '1' : undefined} onClick={() => pick(cur.key, i)}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
