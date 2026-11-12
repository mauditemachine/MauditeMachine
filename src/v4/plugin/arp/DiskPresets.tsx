/**
 * Les presets sur le disque, dans le panneau du capot du plugin MM-ARP (2026-11-09, Mika : "enregistrer un preset sur mon
 * disque dur en le nommant, et le rouvrir") : la section DISK, entre CLIP et MIDI (HoodPanel.tsx) : deux touches de la
 * machine, la liste dans une fenetre de verre comme l'ecran (2026-11-10).
 * - SAVE TO DISK : le nom (DiskNameDialog, le dialogue des noms du site : la meme langue, ui/presetName.css), puis le
 *   C++ ecrit le preset dans le dossier des presets (mm_preset_save ; mm_saved : l'ecran le dit).
 * - OPEN FROM DISK : la boite de dialogue du systeme (le C++), pour un preset ailleurs que dans le dossier.
 * - La liste du dossier : un clic l'ouvre (mm_preset_load), le dernier ouvert ou garde allume.
 * Les presets de l'ecran (ceux du site, dans le navigateur de la WebView) restent ou ils sont.
 */

import { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { presets } from '../../state/presets';
import { suggestName, typeChars } from '../../state/presetName';
import { arpBridge } from './bridge';
import { Sec } from './SoundPlus';
import { arpDisk, DISK_NAME_MAX } from './disk';

/** Le nom propose : celui du preset charge (sans l'utilisateur), sinon un nom du site. */
function proposedName(): string {
  const l = presets.loaded('voy');
  const base = l ? (l.label.split('/').pop() ?? '') : '';
  return typeChars(base.trim(), DISK_NAME_MAX) || suggestName();
}

const cleanDiskName = (raw: string): string => typeChars(raw.replace(/\s+/g, ' '), 64).replace(/ {2,}/g, ' ').trim().slice(0, DISK_NAME_MAX).trimEnd();

export function DiskPresets() {
  const st = useSyncExternalStore(arpDisk.subscribe, arpDisk.get, arpDisk.get);
  // Le capot s'ouvre : la liste du dossier, a jour
  useEffect(() => {
    arpBridge.diskList();
  }, []);
  return (
    <>
      <Sec id="disk" title="DISK" className="mm-arp-disk" col={18} span={4} row={0}>
        <div className="mm-arp-cells mm-arp-disk-keys">
          <button type="button" className="mm-arp-kb mm-arp-disk-key" data-size="s" data-fn="1" onClick={() => arpDisk.set({ naming: proposedName() })}>
            <span className="mm-arp-k" aria-hidden="true" />
            <span className="mm-arp-legend">SAVE TO DISK</span>
          </button>
          <button type="button" className="mm-arp-kb mm-arp-disk-key" data-size="s" data-fn="1" onClick={() => arpBridge.diskOpen()}>
            <span className="mm-arp-k" aria-hidden="true" />
            <span className="mm-arp-legend">OPEN FROM DISK</span>
          </button>
        </div>
      </Sec>
      <Sec id="disk-list" title="MM-ARP PRESETS" className="mm-arp-disk-body" col={18} span={4} row={1} fill>
        <ul className="mm-arp-disk-list" aria-label="Presets folder">
          {st.items === null ? <li className="mm-arp-disk-none">…</li> : null}
          {st.items !== null && st.items.length === 0 ? <li className="mm-arp-disk-none">NO PRESET YET</li> : null}
          {(st.items ?? []).map((it) => (
            <li key={it.path}>
              <button type="button" className="mm-arp-disk-item" data-on={it.path === st.current ? '1' : undefined} onClick={() => arpBridge.diskLoad(it.path)}>
                {it.name}
              </button>
            </li>
          ))}
        </ul>
      </Sec>
    </>
  );
}

/** Le nom d'un SAVE TO DISK : un champ, 1 a 24 caracteres aux regles des noms du site ; Entree garde, Echap annule. */
export function DiskNameDialog() {
  const st = useSyncExternalStore(arpDisk.subscribe, arpDisk.get, arpDisk.get);
  const open = st.naming !== null;
  const [problem, setProblem] = useState('');
  const box = useRef<HTMLDivElement>(null);
  const input = useRef<HTMLInputElement>(null);

  useLayoutEffect(() => {
    if (!open) return undefined;
    setProblem('');
    const back = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    input.current?.focus({ preventScroll: true });
    input.current?.select();
    return () => {
      if (back && back.isConnected) back.focus({ preventScroll: true });
    };
  }, [open]);

  if (!open) return null;
  const value = st.naming ?? '';
  const n = cleanDiskName(value);
  const ok = (): void => {
    if (n.length < 1) {
      setProblem(`NAME: 1 TO ${DISK_NAME_MAX} CHARACTERS`);
      return;
    }
    arpDisk.set({ naming: null });
    arpBridge.diskSave(n);
  };
  const cancel = (): void => arpDisk.set({ naming: null });
  const onKeyDown = (e: React.KeyboardEvent): void => {
    // Les touches restent au dialogue (useKeys : ni RUN, ni les pads, ni l'ecran)
    e.stopPropagation();
    if (e.key === 'Enter') {
      e.preventDefault();
      ok();
    } else if (e.key === 'Escape') {
      e.preventDefault();
      cancel();
    } else if (e.key === 'Tab') {
      const items = Array.from(box.current?.querySelectorAll<HTMLElement>('input, button') ?? []);
      if (items.length === 0) return;
      const i = items.indexOf(document.activeElement as HTMLElement);
      e.preventDefault();
      items[(i + (e.shiftKey ? -1 : 1) + items.length) % items.length].focus();
    }
  };

  return (
    <div
      ref={box}
      className="v4-pn mm-arp-disk-pn"
      role="dialog"
      aria-modal="true"
      aria-labelledby="mm-arp-disk-pn-title"
      // Au milieu de la fenetre, dans la couche a l'echelle (.mm-arp-ui, 1440 x 810)
      style={{ position: 'absolute', top: 250, left: '50%', transform: 'translateX(-50%)', width: 420 }}
      onKeyDown={onKeyDown}
    >
      <p id="mm-arp-disk-pn-title" className="v4-pn-title">
        SAVE TO DISK · MM-ARP
      </p>
      <div className="v4-pn-lcd">
        <label className="v4-pn-field v4-pn-name">
          <span className="v4-pn-label">
            NAME{' '}
            <span className="v4-pn-count">
              {n.length}/{DISK_NAME_MAX}
            </span>
          </span>
          <input
            ref={input}
            className="v4-pn-input"
            value={value}
            maxLength={DISK_NAME_MAX}
            autoComplete="off"
            autoCapitalize="characters"
            autoCorrect="off"
            spellCheck={false}
            enterKeyHint="done"
            aria-label={`Preset file name, 1 to ${DISK_NAME_MAX} characters`}
            aria-invalid={problem ? true : undefined}
            onChange={(e) => {
              setProblem('');
              arpDisk.set({ naming: typeChars(e.target.value, DISK_NAME_MAX) });
            }}
          />
        </label>
      </div>
      <p className="v4-pn-rules">A-Z 0-9 SPACE HYPHEN · SAVED IN THE MM-ARP PRESETS FOLDER</p>
      <p className="v4-pn-problem" role="alert">
        {problem}
      </p>
      <div className="v4-pn-keys">
        <button type="button" className="v4-pn-key v4-pn-ok" onClick={ok}>
          SAVE
        </button>
        <button type="button" className="v4-pn-key" onClick={cancel}>
          CANCEL
        </button>
      </div>
    </div>
  );
}
