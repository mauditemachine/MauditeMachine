/**
 * Le panneau MIDI (2026-10-05, Mika : "toutes les actions, tous les
 * parametres de toutes les machines assignables en MIDI ; j'ai un
 * Roto-Control") : un bouton MIDI dans l'en-tete (desktop), a gauche des
 * machines ; il ouvre un panneau :
 * - CONNECT (Web MIDI : Chrome, Edge, Opera, Firefox), les controleurs
 *   branches ;
 * - MIDI LEARN : on touche une commande sur la machine (ou on la choisit
 *   dans la liste), puis on bouge un potard ou on appuie sur un bouton du
 *   controleur. Pendant LEARN, chaque commande assignee de la vue porte
 *   son message (CC21), celle qui attend clignote ;
 * - les assignations de la machine qu'on regarde, puis celles de partout
 *   et des autres machines, chacune retirable ; EXPORT et IMPORT (un
 *   fichier JSON, pour garder ou partager ses assignations) ;
 * - SEND VALUES BACK : les potards motorises du Roto-Control suivent.
 * - ROTO-CONTROL (2026-10-05) : la carte toute faite (les setups RYTM,
 *   ARP, BASS, DECK, MIXER, LIVE, et depuis le 2026-10-09 les sequenceurs
 *   RSEQ et BSEQ, midi/roto.ts, leur mode d'emploi page par page et leurs
 *   pas en TOGGLE si besoin), allumee ou non ; ses fichiers
 *   pour ROTO-SETUP a telecharger (tous en .zip, ou un par un) et
 *   comment les importer.
 * - 2026-10-08 (Mika : "Roto control : des fois ca fonctionne, des fois ca
 *   ne fonctionne pas") : l'autorisation du navigateur, RESCAN, les sorties
 *   qui recoivent le retour, un autre onglet qui a le MIDI (USE MIDI HERE),
 *   ce qu'a fait le dernier message, les assignations apprises qui tombent
 *   sur la carte du Roto (REMOVE CONFLICTS WITH THE ROTO MAP), la version
 *   des setups ; le panneau se ferme a un clic ailleurs (il cachait la
 *   platine B), sauf pendant MIDI LEARN (on touche alors la machine).
 * Le moteur : midi/midi.ts ; les cibles : midi/targets.ts.
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { clearScope, exportMaps, feedbackToggle, followToggle, importMaps, keyOfTarget, keyText, learnPick, learnToggle, midi, midiClaim, midiDisable, midiEnable, midiRescan, removeRotoConflicts, rotoConflicts, rotoToggle, seqToggleSet, unbind, type MidiView } from '../midi/midi';
import { ROTO_SETUPS, ROTO_VERSION, rotoFileName, rotoSetupJson, rotoSetupLabel, rotoSetups, zipFiles, type RotoSetup } from '../midi/roto';
import { MACHINE_NAME, onTargetsRegistered, targetIdOfHotspot, targetOf, targetsOf, type TargetScope } from '../midi/targets';
import type { Stage } from '../scene/renderer';
import { focus, type Focus } from '../state/focus';

const useMidi = (): MidiView => useSyncExternalStore(midi.subscribe, midi.get, midi.get);
const useFocus = (): Focus => useSyncExternalStore(focus.subscribe, focus.get, focus.get);

/** Les cibles des machines chargees a part arrivent : la liste se refait. */
function useTargetsTick(): number {
  const [n, setN] = useState(0);
  useEffect(() => onTargetsRegistered(() => setN((x) => x + 1)), []);
  return n;
}

const scopeName = (s: TargetScope): string => (s === 'global' ? 'EVERYWHERE' : MACHINE_NAME[s]);

/** CC21, N36, PB ; le canal s'il n'est pas le 1 (CC21/2). */
function shortKey(key: string): string {
  const [kind, ch, num] = key.split(':');
  const base = kind === 'cc' ? `CC${num}` : kind === 'note' ? `N${num}` : 'PB';
  return ch === '1' ? base : `${base}/${ch}`;
}

const BLOCKED = 'MIDI is blocked for this site. Click the icon left of the address, then Site settings, MIDI devices: Allow. Then CONNECT.';

function statusText(m: MidiView): string {
  switch (m.status) {
    case 'unsupported':
      return 'This browser has no Web MIDI. Use Chrome, Edge, Opera or Firefox on a computer.';
    case 'asking':
      return m.permission === 'prompt' ? 'Allow MIDI in the browser prompt (next to the address bar).' : 'Asking the browser for MIDI...';
    case 'denied':
      return m.permission === 'denied' ? BLOCKED : 'MIDI was refused. Allow it in the site settings, then connect again.';
    case 'on':
      return m.inputs.length > 0 ? `Inputs: ${m.inputs.join(', ')}` : 'No MIDI input yet. Plug your controller in, then RESCAN.';
    default:
      if (m.notice) return m.notice;
      return m.permission === 'denied' ? BLOCKED : 'Plug your controller in (USB), then connect.';
  }
}

/** L'autorisation du navigateur, en clair (2026-10-08). */
const PERMISSION_TEXT: Readonly<Record<MidiView['permission'], string | null>> = { granted: 'allowed', prompt: 'the browser will ask', denied: 'blocked', unknown: null };

/** Ou part le retour des valeurs (2026-10-08 : sans sortie Roto, les potards motorises ne suivent pas). */
function outputsText(m: MidiView): string | null {
  if (m.status !== 'on' || !m.feedback) return null;
  if (m.outputs.length > 0) return `Values sent back to: ${m.outputs.join(', ')}`;
  return m.roto ? 'No Roto output found: the motor knobs and LEDs will not follow. Plug the Roto in, then RESCAN.' : 'No output receives the values.';
}

const SCOPES: readonly TargetScope[] = ['mm808', 'voy', 'bass', 'dj', 'global'];

/** Un fichier telecharge (un blob, son nom). */
function download(blob: Blob, name: string): void {
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(a.href), 4000);
}

/** Un setup tel qu'a l'instant (le choix de son du kit compte tes samples) ; stepsToggle : les pas de RSEQ et BSEQ en TOGGLE. */
const fresh = (r: RotoSetup): RotoSetup => rotoSetups().find((x) => x.name === r.name) ?? r;
const rotoFile = (r: RotoSetup, stepsToggle: boolean): void => download(new Blob([rotoSetupJson(fresh(r), { stepsToggle })], { type: 'application/json' }), rotoFileName(r));
const rotoZip = (stepsToggle: boolean): void => download(zipFiles(rotoSetups().map((r) => ({ name: rotoFileName(r), text: rotoSetupJson(r, { stepsToggle }) }))), 'Maudite Machine ROTO-CONTROL.zip');

/**
 * RSEQ et BSEQ, les sequenceurs (2026-10-09, la revue : le panneau ne disait
 * que la page 1, tout en bas) : une ligne par page, juste sous leurs
 * fichiers, le Motion Recorder, les canaux qu'ils prennent, et les pas en
 * TOGGLE si le Roto n'allume pas ses PUSH depuis le site.
 */
const SeqHow: React.FC<{ on: boolean; stepsToggle: boolean }> = ({ on, stepsToggle }) => (
  <div className="v4-midi-seq" role="group" aria-label="RSEQ and BSEQ, the step sequencers">
    <p className="v4-midi-seq-title">RSEQ (17) and BSEQ (18): step sequencers for the MM-RYTM and the MM-BASS</p>
    <ul className="v4-midi-seq-pages">
      <li>
        <b>P1</b> The 8 encoders of the page shown on the machine, and 8 steps (1-8, then 9-16).{' '}
        {stepsToggle ? 'Tap a step to add or remove it.' : 'Tap a step to add or remove it. Hold a step and turn an encoder: a lock on that step only. Hold it without turning: LOCK stays, tap it to leave.'}
      </li>
      <li>
        <b>P2</b> The same encoders, the page keys, STEPS 9-16, STEP FOLLOW (the 8 steps follow the playhead).
      </li>
      <li>
        <b>P3</b> RSEQ: the 8 voice levels over the 8 voice keys (the voice the 8 steps play). BSEQ: NOTE, OCT, TIE, ACCENT, SLIDE of the step you just tapped. To change a note already there:{' '}
        {stepsToggle ? 'LOCK (P4; in LOCK a tap moves it to that step), NOTE or OCT here, then LOCK again.' : 'hold its step (LOCK), NOTE or OCT here, then tap the step (P1) to leave.'}
      </li>
      <li>
        <b>P4</b> RUN, CLEAR, RANDOM or GEN, LOCK, EDIT (the 8 steps become the patterns), PREV and NEXT MACHINE.
      </li>
      <li>In ROTO-SETUP, keep the Motion Recorder off on these two setups. They use channels 7, 8, 15 and 16: if your own setups (1 to 10) use them, move those.</li>
    </ul>
    <label className="v4-midi-check">
      <input type="checkbox" checked={stepsToggle} disabled={!on} onChange={(e) => seqToggleSet(e.target.checked)} />
      <span>Step keys in TOGGLE mode: only if the 8 step LEDs stay dark. Download RSEQ and BSEQ again and re-import them. Tap only; LOCK with the LOCK key (P4), then tap a step.</span>
    </label>
  </div>
);

/** La carte du Roto-Control : allumee ou non, ses setups a telecharger, comment les importer, FOLLOW. */
const RotoSection: React.FC<{ on: boolean; follow: boolean; stepsToggle: boolean }> = ({ on, follow, stepsToggle }) => (
  <section className="v4-midi-roto" aria-label="Roto-Control">
    <p className="v4-midi-last v4-midi-version">Roto setups version {ROTO_VERSION}: if your Roto shows another version, re-import the setups.</p>
    <label className="v4-midi-check">
      <input type="checkbox" checked={on} onChange={(e) => rotoToggle(e.target.checked)} />
      <span>ROTO-CONTROL map: {ROTO_SETUPS.length} ready setups, no MIDI LEARN needed</span>
    </label>
    <label className="v4-midi-check">
      <input type="checkbox" checked={follow} disabled={!on} onChange={(e) => followToggle(e.target.checked)} />
      <span>FOLLOW: the site shows the machine of the setup you play (not LIVE)</span>
    </label>
    <div className="v4-midi-row">
      <button type="button" className="v4-midi-key v4-midi-key-main" onClick={() => rotoZip(stepsToggle)}>
        DOWNLOAD THE {ROTO_SETUPS.length} SETUPS
      </button>
    </div>
    <div className="v4-midi-row v4-midi-roto-files" role="group" aria-label="One setup file">
      {[...ROTO_SETUPS].sort((a, b) => a.slot - b.slot).map((r) => (
        <button key={r.name} type="button" className="v4-midi-key" aria-label={`Download the ${r.name} setup (setup ${r.slot})`} onClick={() => rotoFile(r, stepsToggle)}>
          {r.name} <span className="v4-midi-slot">{r.slot}</span>
        </button>
      ))}
    </div>
    <SeqHow on={on} stepsToggle={stepsToggle} />
    <ol className="v4-midi-roto-how">
      <li>In ROTO-SETUP 3.3.0, accept the firmware update it asks for, then back up with File &gt; Export All.</li>
      <li>Put the Roto in MIDI mode. Press SEL and pick SETUP 11, then File &gt; Import (Cmd+I): MM RYTM (SETUP 11).json. The Roto then shows {rotoSetupLabel(ROTO_SETUPS[0])}.</li>
      <li>Same for ARP on 12, DECK on 13, MIXER on 14, BASS on 15, LIVE on 16, RSEQ on 17, BSEQ on 18 (your setups 1 to 10 stay as they are).</li>
      <li>Here: CONNECT. Every knob goes from 0 to 127, the motor knobs and the LEDs follow the site. LIVE plays all the machines without changing setup.</li>
    </ol>
  </section>
);

const MidiPanel: React.FC<{ onClose: () => void }> = ({ onClose }) => {
  const m = useMidi();
  const f = useFocus();
  useTargetsTick();
  const fileRef = useRef<HTMLInputElement>(null);
  const [note, setNote] = useState<string | null>(null);
  const here: TargetScope | null = f === 'all' ? null : f;
  const choices = [...(here ? targetsOf(here) : []), ...targetsOf('global')];
  const picked = m.pick ? targetOf(m.pick) : undefined;
  // Les assignations apprises sur une cle de la carte du Roto (2026-10-08)
  const conflicts = m.roto ? rotoConflicts(m.maps) : [];
  // La machine regardee d'abord, puis partout, puis les autres
  const order = [...(here ? [here] : []), 'global' as const, ...SCOPES.filter((s) => s !== here && s !== 'global')];

  const doExport = (): void => {
    const blob = new Blob([exportMaps()], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'mauditemachine-midi.json';
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(a.href), 2000);
  };
  const doImport = (file: File): void => {
    void file.text().then((t) => setNote(importMaps(t) ? 'Assignments imported.' : 'This file has no MIDI assignments.'));
  };

  return (
    <div
      id="v4-midi-panel"
      className="v4-midi-panel"
      role="dialog"
      aria-label="MIDI"
      style={{ position: 'fixed', top: 64, right: 24 }}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          e.stopPropagation();
          learnToggle(false);
          onClose();
        }
      }}
    >
      <div className="v4-midi-head">
        <span className="v4-midi-title">MIDI</span>
        <button type="button" className="v4-midi-x" aria-label="Close the MIDI panel" onClick={onClose}>
          <i className="fa-solid fa-xmark v4-fa" aria-hidden="true" />
        </button>
      </div>
      <p className="v4-midi-status">{statusText(m)}</p>
      {PERMISSION_TEXT[m.permission] && m.status !== 'unsupported' && <p className="v4-midi-last">Browser permission: {PERMISSION_TEXT[m.permission]}</p>}
      {!m.leader && (
        <div className="v4-midi-alert" role="status">
          <p>MIDI IS USED BY ANOTHER TAB of this site: this tab ignores the controller and sends nothing back.</p>
          <button type="button" className="v4-midi-key v4-midi-key-main" onClick={() => midiClaim()}>
            USE MIDI HERE
          </button>
        </div>
      )}
      {m.hint && (
        <p className="v4-midi-alert" role="status">
          {m.hint}
        </p>
      )}
      {m.status !== 'unsupported' && (
        <div className="v4-midi-row">
          {m.status === 'on' ? (
            <>
              <button type="button" className="v4-midi-key" onClick={() => midiDisable()}>
                DISCONNECT
              </button>
              <button type="button" className="v4-midi-key" onClick={() => midiRescan()}>
                RESCAN
              </button>
            </>
          ) : (
            <button type="button" className="v4-midi-key v4-midi-key-main" disabled={m.status === 'asking'} onClick={() => void midiEnable()}>
              CONNECT
            </button>
          )}
          <button type="button" className="v4-midi-key" data-on={m.learn ? '1' : '0'} aria-pressed={m.learn} onClick={() => learnToggle()}>
            MIDI LEARN
          </button>
        </div>
      )}
      {outputsText(m) && <p className="v4-midi-last">{outputsText(m)}</p>}
      {m.learn && (
        <div className="v4-midi-learn">
          <p>Touch a control on the machine (or pick it below), then move a knob or press a button on your controller.</p>
          <select
            className="v4-midi-select"
            aria-label="Control to assign"
            value={m.pick ?? ''}
            onChange={(e) => learnPick(e.target.value || null)}
          >
            <option value="">{here ? `Pick a control of the ${MACHINE_NAME[here]}...` : 'Pick a machine first, or a global action...'}</option>
            {choices.map((t) => (
              <option key={t.id} value={t.id}>
                {t.scope === 'global' ? `${t.label} (everywhere)` : t.label}
              </option>
            ))}
          </select>
          <p className="v4-midi-wait" aria-live="polite">
            {picked ? `${scopeName(picked.scope)} ${picked.label}: waiting for MIDI...` : m.pick ? 'Waiting for MIDI...' : 'Nothing picked yet.'}
          </p>
        </div>
      )}
      {m.last && <p className="v4-midi-last">Last message: {m.last}</p>}
      {conflicts.length > 0 && (
        <section className="v4-midi-scope v4-midi-conflicts" aria-label="Learned keys on the Roto map">
          <div className="v4-midi-scope-head">
            <span>LEARNED ON THE ROTO MAP</span>
          </div>
          <ul>
            {conflicts.map((c) => (
              <li key={`${c.scope}:${c.key}`}>
                <span className="v4-midi-k">{keyText(c.key)}</span>
                <span className="v4-midi-t">
                  {targetOf(c.id)?.label ?? c.id} ({scopeName(c.scope)}), Roto map: {targetOf(c.roto)?.label ?? c.roto}
                </span>
              </li>
            ))}
          </ul>
          <div className="v4-midi-row">
            <button type="button" className="v4-midi-key" onClick={() => setNote(`${removeRotoConflicts()} assignment(s) removed: the Roto map has its keys back.`)}>
              REMOVE CONFLICTS WITH THE ROTO MAP
            </button>
          </div>
        </section>
      )}
      <div className="v4-midi-maps">
        {order.map((s) => {
          const entries = Object.entries(m.maps[s] ?? {});
          if (entries.length === 0) return null;
          return (
            <section key={s} className="v4-midi-scope" data-here={s === here ? '1' : '0'}>
              <div className="v4-midi-scope-head">
                <span>{scopeName(s)}</span>
                <button type="button" className="v4-midi-clear" onClick={() => clearScope(s)}>
                  CLEAR
                </button>
              </div>
              <ul>
                {entries.map(([key, id]) => (
                  <li key={key}>
                    <span className="v4-midi-k">{keyText(key)}</span>
                    <span className="v4-midi-t">{targetOf(id)?.label ?? id}</span>
                    <button type="button" className="v4-midi-del" aria-label={`Remove ${keyText(key)}`} onClick={() => unbind(s, key)}>
                      <i className="fa-solid fa-xmark v4-fa" aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          );
        })}
        {SCOPES.every((s) => Object.keys(m.maps[s] ?? {}).length === 0) && <p className="v4-midi-empty">No assignment yet. Turn on MIDI LEARN.</p>}
      </div>
      <label className="v4-midi-check">
        <input type="checkbox" checked={m.feedback} onChange={(e) => feedbackToggle(e.target.checked)} />
        <span>Send values back (motorised knobs follow the machine)</span>
      </label>
      <RotoSection on={m.roto} follow={m.follow} stepsToggle={m.seqToggle} />
      <div className="v4-midi-row">
        <button type="button" className="v4-midi-key" onClick={doExport}>
          EXPORT
        </button>
        <button type="button" className="v4-midi-key" onClick={() => fileRef.current?.click()}>
          IMPORT
        </button>
        <input
          ref={fileRef}
          type="file"
          accept="application/json,.json"
          hidden
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) doImport(file);
            e.target.value = '';
          }}
        />
      </div>
      {note && <p className="v4-midi-last">{note}</p>}
    </div>
  );
};

/** Le bouton MIDI de l'en-tete et son panneau. */
export const MidiButton: React.FC = () => {
  const m = useMidi();
  const [open, setOpen] = useState(false);
  const btnRef = useRef<HTMLButtonElement>(null);
  const learn = m.learn;
  // 2026-10-08 : un clic ailleurs ferme le panneau (il cachait l'ecran, CUE, SYNC et PLAY de la platine B),
  // sauf pendant MIDI LEARN (on touche alors les commandes de la machine) ; le bouton MIDI l'ouvre et le ferme
  useEffect(() => {
    if (!open || learn) return undefined;
    const onDown = (e: PointerEvent): void => {
      const t = e.target as Node | null;
      if (!t || btnRef.current?.contains(t) || document.getElementById('v4-midi-panel')?.contains(t)) return;
      setOpen(false);
    };
    window.addEventListener('pointerdown', onDown, true);
    return () => window.removeEventListener('pointerdown', onDown, true);
  }, [open, learn]);
  return (
    <>
      <button
        ref={btnRef}
        type="button"
        className="v4-midi-btn"
        data-on={m.status === 'on' && m.leader ? '1' : '0'}
        data-learn={m.learn ? '1' : '0'}
        data-hint={m.hint ? '1' : '0'}
        aria-expanded={open}
        aria-controls="v4-midi-panel"
        aria-label={m.hint ? `MIDI controller: ${m.hint}` : 'MIDI controller'}
        title={m.hint ?? (m.status === 'on' && !m.leader ? 'MIDI is used by another tab' : undefined)}
        onClick={() => setOpen((o) => !o)}
      >
        <span className="v4-midi-dot" aria-hidden="true" />
        MIDI
      </button>
      {m.hint && !open && (
        <span className="v4-midi-hint" role="status" style={{ position: 'fixed', top: 64, right: 24 }}>
          {m.hint}
        </span>
      )}
      {open && <MidiPanel onClose={() => setOpen(false)} />}
    </>
  );
};

/**
 * Pendant MIDI LEARN : sur la machine, l'etiquette de chaque commande
 * assignee (CC21) et un cadre qui clignote autour de celle qui attend son
 * message. Pose sur la couche de saisie (memes coordonnees).
 */
export const MidiLearnLayer: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const m = useMidi();
  useFocus();
  const [, setTick] = useState(0);
  useEffect(() => {
    if (!stage || !m.learn) return undefined;
    const bump = (): void => setTick((t) => t + 1);
    const a = stage.onView(bump);
    const b = stage.onIdle(bump);
    return () => {
      a();
      b();
    };
  }, [stage, m.learn]);
  if (!stage || !m.learn) return null;
  const marks = stage.hit
    .list()
    .filter((v) => v.enabled)
    .map((v) => {
      const id = targetIdOfHotspot(v);
      if (!id) return null;
      const key = keyOfTarget(id);
      const picked = id === m.pick;
      return key || picked ? { v, key, picked } : null;
    })
    .filter((x): x is NonNullable<typeof x> => x !== null);
  return (
    <div className="v4-midi-layer" aria-hidden="true">
      {marks.map(({ v, key, picked }) => (
        <React.Fragment key={v.id}>
          {picked && <span className="v4-midi-ring" style={{ left: v.bx - 4, top: v.by - 4, width: v.bw + 8, height: v.bh + 8 }} />}
          {key && (
            <span className="v4-midi-badge" data-picked={picked ? '1' : '0'} style={{ left: v.cx, top: v.by - 2 }}>
              {shortKey(key)}
            </span>
          )}
        </React.Fragment>
      ))}
    </div>
  );
};

export default MidiButton;
