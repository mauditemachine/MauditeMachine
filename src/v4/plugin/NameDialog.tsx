/**
 * Le nom d'un preset dans le plugin (2026-11-11, Mika, devant le dialogue du site pose en bas de la fenetre : "sauvegarde de
 * preset qui n'est pas a l'ecran ? je veux pas de User quelque chose, je veux juste le nom du preset et pouvoir ecrire").
 * Un seul champ, le nom (16 lettres au plus, state/presetName.ts), pose exactement sur l'ecran de la machine
 * (Stage.screenRect) : on tape, Entree garde, Echap annule. Il ne fait que montrer et changer l'etat du mode presets
 * (state/presetMode.ts, l'etape name) : les fleches de l'ecran (UP / DOWN la lettre, LEFT / RIGHT le curseur) changent le
 * meme nom. Le site garde son dialogue (ui/PresetNameDialog.tsx : USER et NAME).
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { presetEnter } from '../actions';
import { presetMode } from '../state/presetMode';
import { NAME_MAX, USER_LEN, cleanName } from '../state/presetName';
import { FONT_DISPLAY } from '../theme';
import type { Stage } from '../scene/renderer';

const INK = '#F4F1EA';
const RED = '#F0463C';

const CSS = `
.mm-name{position:fixed;z-index:45;box-sizing:border-box;display:flex;flex-direction:column;align-items:center;justify-content:center;gap:.9em;padding:1.2em 1.6em;background:#050506;border-radius:.3em;font-family:${FONT_DISPLAY};color:${INK}}
.mm-name-title{margin:0;font-size:1.1em;font-weight:800;letter-spacing:.2em;color:rgba(244,241,234,.6)}
.mm-name-field{width:100%;display:flex;align-items:baseline;gap:.8em;border-bottom:.14em solid ${INK};padding-bottom:.25em}
.mm-name-field[data-bad='1']{border-color:${RED}}
.mm-name .mm-name-input,.mm-name .mm-name-input:focus,.mm-name .mm-name-input:focus-visible{outline:0 !important;box-shadow:none !important}
.mm-name-input{flex:1;min-width:0;background:transparent;border:0;outline:0;padding:0;font:inherit;font-size:2.7em;font-weight:700;letter-spacing:.08em;color:${INK};caret-color:${RED};text-transform:uppercase}
.mm-name-input::selection{background:${INK};color:#050506}
.mm-name-count{font-size:1em;font-weight:700;letter-spacing:.1em;color:rgba(244,241,234,.45);white-space:nowrap}
.mm-name-note{margin:0;min-height:1.3em;font-size:.95em;font-weight:700;letter-spacing:.12em;color:rgba(244,241,234,.5);text-align:center}
.mm-name-note[data-bad='1']{color:${RED}}
.mm-name-keys{display:flex;gap:.8em}
.mm-name-keys button{font:inherit;font-size:1.05em;font-weight:800;letter-spacing:.16em;padding:.55em 1.5em;border-radius:.5em;border:.1em solid rgba(244,241,234,.35);background:transparent;color:${INK};cursor:pointer}
.mm-name-keys button:hover{border-color:${INK}}
.mm-name-keys .mm-name-ok{background:${RED};border-color:${RED};color:#0b0b0c}
`;

interface Box {
  left: number;
  top: number;
  width: number;
  height: number;
}

export const NameDialog: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const st = useSyncExternalStore(presetMode.subscribe, presetMode.get, presetMode.get);
  const m = st.machine;
  const nm = st.stage === 'name' ? st.naming : null;
  const open = !!m && !!nm;
  const input = useRef<HTMLInputElement>(null);
  const [box, setBox] = useState<Box | null>(null);

  // La place de l'ecran de la machine (la vue est fixe : a l'ouverture, puis quand la fenetre change de taille)
  useEffect(() => {
    if (!open || !stage) return undefined;
    const place = (): void => setBox(stage.screenRect());
    place();
    window.addEventListener('resize', place);
    return () => window.removeEventListener('resize', place);
  }, [open, stage]);

  // A l'ouverture : le focus dans le champ, le nom propose choisi (une lettre le remplace)
  useLayoutEffect(() => {
    if (!open || !box) return;
    input.current?.focus({ preventScroll: true });
    input.current?.select();
    // Une seule fois par ouverture (la place connue)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, !!box]);

  // Une lettre tapee ailleurs (le focus parti sur la machine) revient au champ, pas aux raccourcis de la face ; Entree et
  // Echap aussi
  useEffect(() => {
    if (!open || !m) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.target === input.current) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key === 'Enter') {
        e.preventDefault();
        e.stopPropagation();
        presetEnter(m);
      } else if (e.key === 'Escape') {
        e.preventDefault();
        e.stopPropagation();
        presetMode.back();
      } else if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') input.current?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open, m]);

  if (!open || !m || !nm || !box || box.width < 40) return null;
  const { user, name } = nm.draft;
  const n = cleanName(name);
  const bad = !!nm.problem;
  const caret = (el: HTMLInputElement): number => USER_LEN + Math.min(el.selectionStart ?? el.value.length, NAME_MAX - 1);
  const onKeyDown = (e: React.KeyboardEvent<HTMLInputElement>): void => {
    // Rien ne descend aux raccourcis de la face (A S D F joueraient une voix)
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      presetEnter(m);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      presetMode.back();
    }
  };
  return (
    <div
      className="mm-name"
      role="dialog"
      aria-modal="true"
      aria-label={nm.kind === 'rename' ? 'Rename the preset' : 'Save the preset: its name'}
      style={{ left: box.left, top: box.top, width: box.width, height: box.height, fontSize: box.width / 42 }}
      onPointerDown={(e) => e.stopPropagation()}
      onContextMenu={(e) => e.preventDefault()}
    >
      <style>{CSS}</style>
      <p className="mm-name-title">{nm.kind === 'rename' ? 'RENAME PRESET' : 'SAVE PRESET'}</p>
      <label className="mm-name-field" data-bad={bad ? '1' : '0'}>
        <input
          ref={input}
          className="mm-name-input"
          value={name}
          maxLength={NAME_MAX}
          autoComplete="off"
          autoCapitalize="characters"
          autoCorrect="off"
          spellCheck={false}
          aria-label={`Preset name, 1 to ${NAME_MAX} characters`}
          aria-invalid={bad || undefined}
          onKeyDown={onKeyDown}
          onKeyUp={(e) => e.stopPropagation()}
          onChange={(e) => presetMode.setName(m, user, e.target.value, caret(e.target))}
          onSelect={(e) => presetMode.setName(m, user, name, caret(e.currentTarget))}
        />
        <span className="mm-name-count" aria-hidden="true">
          {n.length}/{NAME_MAX}
        </span>
      </label>
      <p className="mm-name-note" role="alert" data-bad={bad ? '1' : '0'}>
        {nm.problem || 'TYPE THE NAME · ENTER: SAVE · ESC: CANCEL'}
      </p>
      <div className="mm-name-keys">
        <button type="button" className="mm-name-ok" onClick={() => presetEnter(m)}>
          SAVE
        </button>
        <button type="button" onClick={() => presetMode.back()}>
          CANCEL
        </button>
      </div>
    </div>
  );
};
