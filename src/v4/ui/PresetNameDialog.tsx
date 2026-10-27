/**
 * Le nom d'un preset (2026-10-27, la V.4.2, Mika : "qu'on puisse nommer ses presets ! un nom d'utilisateur 4 lettres et
 * le nom du preset jusqu'a 10 lettres, en mobile et en desktop") : un petit dialogue, le meme pour les trois machines
 * (MM-RYTM, MM-ARP, MM-BASS), ouvert par l'etape name du mode presets (state/presetMode.ts : SAVE d'un nouveau preset,
 * AS NEW, NAME). Il ne fait que montrer et changer l'etat du mode : l'ecran de la machine dit la meme chose, et au
 * desktop du MM-RYTM ses potards A (la lettre) et B (le curseur) changent les memes champs (le repli materiel).
 * - Deux champs : USER (4 caracteres, demande au premier SAVE, retenu par ce navigateur, a changer ici) et NAME (1 a
 *   10) ; en majuscules a la frappe, accents retires, le reste refuse (state/presetName.ts) ; le compte des lettres.
 * - Entree dans USER passe a NAME, Entree dans NAME garde (OK), Echap annule (retour a la liste) ; Tab tourne dans le dialogue (le focus y reste), il revient la
 *   ou il etait a la fermeture ; une lettre tapee hors du dialogue (apres un clic sur la machine) y revient.
 * - role dialog, aria-modal, le titre et les regles lus par le lecteur d'ecran, aria-invalid sur le champ fautif.
 * - Il ne couvre pas la face : au desktop en bas (sur les pas, qui ne servent pas pendant le nom), l'ecran et les
 *   potards restent visibles ; au telephone en haut (le clavier du systeme prend le bas).
 */

import { useEffect, useLayoutEffect, useRef, useSyncExternalStore } from 'react';
import { presetEnter } from '../actions';
import { presetMode } from '../state/presetMode';
import { NAME_MAX, USER_LEN, cleanName, cleanUser, nameOk, userOk } from '../state/presetName';
import type { PresetMachine } from '../state/presets';
import './presetName.css';

const MACHINE_NAME: Readonly<Record<PresetMachine, string>> = { mm808: 'MM-RYTM', voy: 'MM-ARP', bass: 'MM-BASS' };

export function PresetNameDialog({ mobile }: { mobile: boolean }) {
  const st = useSyncExternalStore(presetMode.subscribe, presetMode.get, presetMode.get);
  const m = st.machine;
  const nm = st.stage === 'name' ? st.naming : null;
  const open = !!m && !!nm;
  const box = useRef<HTMLDivElement>(null);
  const userRef = useRef<HTMLInputElement>(null);
  const nameRef = useRef<HTMLInputElement>(null);
  const back = useRef<HTMLElement | null>(null);

  // A l'ouverture : le focus sur USER s'il manque, sinon sur NAME, son texte choisi (une lettre le remplace) ; a la
  // fermeture, il revient ou il etait
  useLayoutEffect(() => {
    if (!open) return;
    back.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const askUser = !!nm && (nm.askUser || !userOk(cleanUser(nm.draft.user)));
    const el = askUser ? userRef.current : nameRef.current;
    el?.focus({ preventScroll: true });
    el?.select();
    return () => {
      const b = back.current;
      back.current = null;
      if (b && b.isConnected) b.focus({ preventScroll: true });
    };
    // Une seule fois par ouverture
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);

  // Une lettre tapee hors du dialogue (le focus parti sur la machine, apres un potard tourne) : elle revient au champ
  // NAME, pas aux raccourcis de la machine (A S D F joueraient une voix)
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent): void => {
      const b = box.current;
      if (!b || (e.target instanceof Node && b.contains(e.target))) return;
      if (e.metaKey || e.ctrlKey || e.altKey) return;
      if (e.key.length === 1 || e.key === 'Backspace' || e.key === 'Delete') nameRef.current?.focus({ preventScroll: true });
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!open || !m || !nm) return null;
  const { user, name } = nm.draft;
  const u = cleanUser(user);
  const n = cleanName(name);
  const userBad = nm.problem.startsWith('USER') && !userOk(u);
  const nameBad = nm.problem.startsWith('NAME') && !nameOk(n);
  const title = `${nm.kind === 'rename' ? 'RENAME' : 'SAVE'} PRESET · ${MACHINE_NAME[m]}`;

  const caret = (el: HTMLInputElement, base: number): number => base + Math.min(el.selectionStart ?? el.value.length, base === 0 ? USER_LEN - 1 : NAME_MAX - 1);
  const onKeyDown = (e: React.KeyboardEvent): void => {
    if (e.key === 'Enter') {
      e.preventDefault();
      e.stopPropagation();
      // Entree dans USER passe a NAME, son texte choisi (le telephone dit Suivant) ; seule Entree dans NAME, ou OK, garde
      // (2026-10-27, la revue : au premier SAVE, Entree apres l'utilisateur gardait le nom propose sans le montrer)
      if (e.target === userRef.current && nameRef.current) {
        nameRef.current.focus({ preventScroll: true });
        nameRef.current.select();
        return;
      }
      presetEnter(m);
      return;
    }
    if (e.key === 'Escape') {
      e.preventDefault();
      e.stopPropagation();
      presetMode.back();
      return;
    }
    // Le focus reste dans le dialogue : Tab et Maj + Tab tournent sur ses quatre commandes
    if (e.key === 'Tab') {
      const items = Array.from(box.current?.querySelectorAll<HTMLElement>('input, button') ?? []);
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      const next = items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length];
      e.preventDefault();
      next.focus();
    }
  };

  // Au desktop, en bas sur les pas ; au telephone, en haut (style en ligne : .page > * ecrase le fixed des classes)
  const place: React.CSSProperties = mobile ? { position: 'fixed', top: 10, left: 10, right: 10 } : { position: 'fixed', bottom: 24, left: '50%', transform: 'translateX(-50%)', width: 420 };

  return (
    <div ref={box} className="v4-pn" role="dialog" aria-modal="true" aria-labelledby="v4-pn-title" aria-describedby="v4-pn-rules" style={place} onKeyDown={onKeyDown}>
      <p id="v4-pn-title" className="v4-pn-title">
        {title}
      </p>
      <div className="v4-pn-lcd">
        <label className="v4-pn-field v4-pn-user">
          <span className="v4-pn-label">
            USER <span className="v4-pn-count">{u.length}/{USER_LEN}</span>
          </span>
          <input
            ref={userRef}
            className="v4-pn-input"
            value={user}
            maxLength={USER_LEN}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="next"
            aria-label="User, exactly 4 characters"
            aria-invalid={userBad || undefined}
            onChange={(e) => presetMode.setName(m, e.target.value, name, caret(e.target, 0))}
            onSelect={(e) => presetMode.setName(m, user, name, caret(e.currentTarget, 0))}
          />
        </label>
        <span className="v4-pn-slash" aria-hidden="true">
          /
        </span>
        <label className="v4-pn-field v4-pn-name">
          <span className="v4-pn-label">
            NAME <span className="v4-pn-count">{n.length}/{NAME_MAX}</span>
          </span>
          <input
            ref={nameRef}
            className="v4-pn-input"
            value={name}
            maxLength={NAME_MAX}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-label="Preset name, 1 to 10 characters"
            aria-invalid={nameBad || undefined}
            onChange={(e) => presetMode.setName(m, user, e.target.value, caret(e.target, USER_LEN))}
            onSelect={(e) => presetMode.setName(m, user, name, caret(e.currentTarget, USER_LEN))}
          />
        </label>
      </div>
      <p id="v4-pn-rules" className="v4-pn-rules">
        A-Z 0-9 SPACE -{mobile || m !== 'mm808' ? '' : '   ·   KNOBS A: LETTER  B: CURSOR'}
      </p>
      <p className="v4-pn-problem" role="alert">
        {nm.problem}
      </p>
      <div className="v4-pn-keys">
        <button type="button" className="v4-pn-key v4-pn-ok" onClick={() => presetEnter(m)}>
          OK
        </button>
        <button type="button" className="v4-pn-key" onClick={() => presetMode.back()}>
          CANCEL
        </button>
      </div>
    </div>
  );
}
