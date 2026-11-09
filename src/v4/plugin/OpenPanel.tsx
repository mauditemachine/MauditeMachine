/**
 * OPEN dans le plugin (2026-11-09, Mika : "Je veux garder le bouton OPEN (et je veux pouvoir fermer aussi pour avoir la
 * facade avant). Dans OPEN je veux tous les settings et les choses plus pointues, le fine tuning").
 *
 * Un panneau par-dessus la face, que OPEN (la touche, le clavier) ouvre et ferme, comme CLOSE et Echap :
 * - PISTE : tous les reglages de la piste active d'un coup (SRC, FLTR, AMP, FX, TRIG, LFO 1 et 2), les potards des pages de
 *   la face sur leurs memes cibles (actions anyDial : une scene armee les enregistre, le moteur les recoit par le programme),
 *   sa voix (MONO / POLY, CHOKE, GATED, MUTE) et son sample ;
 * - GLOBAL : le niveau des 16 pistes, les FX globaux et chacun de leurs reglages, MASTER, le pattern (longueur, page) ;
 * - SAMPLES : tes samples par type (ceux du site et ceux du dossier ~/Music/MM-RYTM Samples), un clic les pose sur la piste ;
 *   importer, ouvrir le dossier dans le Finder, le relire ;
 * - AIDE : la souris dans le plugin.
 * Les potards : glisser (Maj : au dixieme, le reglage fin), deux clics : la valeur de depart, les fleches du clavier.
 */

import React, { useEffect, useMemo, useState, useSyncExternalStore } from 'react';
import { anyDial, anyDialReset, dialEdit, dialNudge, dialRange, dialReadout, dialSteps, dialUnit, dialValueText, fileImport, subscribeDials, trackSelect, type DialId } from '../actions';
import { KIT_FAMILIES } from '../audio/kitlaw';
import { samplesChanged, samplesOf, type KitSample } from '../audio/samples';
import { TRACK_KEYS, TRACK_NAMES, tracks, typedFamily, type TrackKey } from '../audio/tracks';
import { FX_DETAILS, pageSlots, type PageSlot, type RytmScreenId } from '../rytm/pages';
import { PAGESETUP_SLOTS } from '../scene/screen/menus/pagesetup';
import { lcdMessage } from '../state/lcdMessage';
import { pluginPanel } from '../state/pluginPanel';
import { activeTrack } from '../state/trk';
import { voices } from '../state/voices';
import { pattern } from '../audio/pattern';
import { FONT_DISPLAY } from '../theme';
import { KnobView, type KnobSpec } from '../ui/KnobPanel';

type Tab = 'track' | 'global' | 'samples' | 'help';
const TABS: readonly { id: Tab; label: string }[] = [
  { id: 'track', label: 'TRACK' },
  { id: 'global', label: 'GLOBAL' },
  { id: 'samples', label: 'SAMPLES' },
  { id: 'help', label: 'HELP' },
];

/** Tout ce qui change un reglage montre : les potards, le store des 16 pistes, la piste active, les samples. */
function subscribeAll(fn: () => void): () => void {
  const offs = [subscribeDials(fn), tracks.subscribe(() => fn()), activeTrack.subscribe(fn), samplesChanged.subscribe(fn), voices.subscribe(fn)];
  return () => offs.forEach((off) => off());
}
let rev = 0;
const subscribeRev = (fn: () => void): (() => void) =>
  subscribeAll(() => {
    rev += 1;
    fn();
  });
/** Un compteur qui monte a chaque changement (un rendu du panneau par changement). */
const useRev = (): number => useSyncExternalStore(subscribeRev, () => rev);

/** Un potard du panneau : un reglage par sa cible (celle d'un bloc des pages de la face, ou m:<piste>). */
const DialKnob: React.FC<{ id: DialId; label: string }> = ({ id, label }) => {
  const spec = useMemo<KnobSpec>(() => {
    const range = dialRange(id);
    return {
      label,
      get: () => dialEdit(id),
      set: (v) => anyDial(id, v),
      reset: () => anyDialReset(id),
      range,
      steps: dialSteps(id),
      bipolar: range[0] < 0,
      readout: () => dialReadout(id),
      valueText: () => dialValueText(id),
      unit: () => dialUnit(id),
      nudge: (n) => dialNudge(id, n),
      subscribe: subscribeAll,
    };
  }, [id, label]);
  return <KnobView spec={spec} compact />;
};

/** Les reglages vivants des ecrans d'une section, sans doublon, ni bloc vide, ni dessin. */
function slotsOf(screens: readonly RytmScreenId[]): PageSlot[] {
  const inst = pattern.get().instrument;
  const seen = new Set<string>();
  const out: PageSlot[] = [];
  for (const sc of screens)
    for (const s of pageSlots(sc, inst)) {
      if (!s.label || !s.target || s.graph || seen.has(s.target)) continue;
      seen.add(s.target);
      out.push(s);
    }
  return out;
}

const Section: React.FC<{ title: string; children: React.ReactNode; wide?: boolean }> = ({ title, children, wide }) => (
  <section className={wide ? 'mm-open-card mm-open-wide' : 'mm-open-card'}>
    <h3>{title}</h3>
    <div className="mm-open-knobs">{children}</div>
  </section>
);

const SlotSection: React.FC<{ title: string; screens: readonly RytmScreenId[]; k: string; wide?: boolean }> = ({ title, screens, k, wide }) => {
  const slots = slotsOf(screens).filter((s) => dialValueText(s.target as DialId) !== '--');
  if (slots.length === 0) return null;
  return (
    <Section title={title} wide={wide}>
      {slots.map((s) => (
        <DialKnob key={`${k}:${s.target}`} id={s.target as DialId} label={s.label} />
      ))}
    </Section>
  );
};

/** Un choix en boutons (MONO / POLY, CHOKE...). */
function Choice<T extends string | number | boolean>({ label, options, value, onPick }: { label: string; options: readonly { v: T; t: string }[]; value: T; onPick: (v: T) => void }): React.ReactElement {
  return (
    <div className="mm-open-choice">
      <span>{label}</span>
      <div>
        {options.map((o) => (
          <button key={String(o.v)} type="button" aria-pressed={o.v === value} onClick={() => onPick(o.v)}>
            {o.t}
          </button>
        ))}
      </div>
    </div>
  );
}

/** Le nom d'un sample comme l'ecran le dit : BD 1 pour ceux de la banque, son nom pour les tiens. */
const smpLabel = (s: KitSample): string => (s.key.includes('/~') ? s.file.replace(/^~/, '').replace(/\.[a-z0-9]+$/i, '').toUpperCase() : `${s.family.toUpperCase()} ${s.label}`);
const sampleName = (key: string): string => {
  if (!key) return 'OFF';
  const s = samplesOf(key.split('/')[0]).find((x) => x.key === key);
  return s ? smpLabel(s) : (key.split('/').pop() ?? key);
};

const TrackTab: React.FC<{ t: TrackKey }> = ({ t }) => {
  const i = TRACK_KEYS.indexOf(t);
  const fam = typedFamily(i);
  const vo = tracks.get().voice[i];
  const snd = tracks.of(t).snd;
  const muted = voices.isMuted(t);
  return (
    <div className="mm-open-grid">
      <section className="mm-open-card mm-open-wide mm-open-sample">
        <h3>SAMPLE</h3>
        <div className="mm-open-row">
          <span className="mm-open-now">
            {TRACK_NAMES[i]} <b>{sampleName(snd).toUpperCase()}</b>
          </span>
          <button type="button" onClick={() => fileImport.plugin?.(t)}>
            IMPORT FILES…
          </button>
          <button type="button" onClick={() => fileImport.reveal?.(fam)}>
            OPEN {fam.toUpperCase()} FOLDER
          </button>
        </div>
      </section>
      <SlotSection title="SRC" screens={['voice', 'synth']} k={t} />
      <SlotSection title="FLTR" screens={['fltr']} k={t} />
      <SlotSection title="AMP" screens={['env']} k={t} />
      <SlotSection title="FX" screens={['fxv']} k={t} />
      <SlotSection title="TRIG" screens={['trig', 'trig2']} k={t} wide />
      <SlotSection title="LFO 1" screens={['mod']} k={t} />
      <SlotSection title="LFO 2" screens={['mod2']} k={t} />
      <section className="mm-open-card">
        <h3>VOICE</h3>
        <div className="mm-open-choices">
          <Choice
            label="PLAY"
            value={vo.vmode}
            options={[
              { v: 'mono', t: 'MONO' },
              { v: 'poly', t: 'POLY' },
            ]}
            onPick={(v) => tracks.voice(t, { vmode: v })}
          />
          <Choice label="CHOKE" value={vo.choke} options={[0, 1, 2, 3, 4].map((n) => ({ v: n, t: n === 0 ? 'OFF' : String(n) }))} onPick={(v) => tracks.voice(t, { choke: v as 0 | 1 | 2 | 3 | 4 })} />
          <Choice
            label="GATED"
            value={vo.gated}
            options={[
              { v: false, t: 'OFF' },
              { v: true, t: 'ON' },
            ]}
            onPick={(v) => tracks.voice(t, { gated: v })}
          />
          <Choice
            label="MUTE"
            value={muted}
            options={[
              { v: false, t: 'OFF' },
              { v: true, t: 'ON' },
            ]}
            onPick={(v) => {
              if (v !== voices.isMuted(t)) voices.toggleMute(t);
            }}
          />
        </div>
      </section>
    </div>
  );
};

const FX_TITLES: Readonly<Record<string, string>> = { fxdist: 'DIST', fxchorus: 'CHORUS', fxdelay: 'DELAY', fxreverb: 'REVERB', fxbit: 'BIT', fxcomp: 'COMP' };

const GlobalTab: React.FC = () => {
  const setup = PAGESETUP_SLOTS.filter((s) => s.label && s.target && s.label !== 'COPY');
  return (
    <div className="mm-open-grid">
      <Section title="LEVELS (THE CROSSFADER MOVES THEM WITH THE SCENES)" wide>
        {TRACK_KEYS.map((k, i) => (
          <DialKnob key={`m:${k}`} id={`m:${k}` as DialId} label={TRACK_NAMES[i]} />
        ))}
      </Section>
      <SlotSection title="SEND FX" screens={['fxg']} k="g" wide />
      {FX_DETAILS.map((d) => (
        <SlotSection key={d} title={FX_TITLES[d] ?? d.toUpperCase()} screens={[d]} k="g" />
      ))}
      <SlotSection title="MASTER" screens={['fxm']} k="g" />
      <Section title="PATTERN">
        {setup.map((s) => (
          <DialKnob key={`p:${s.target}`} id={s.target as DialId} label={s.label} />
        ))}
      </Section>
    </div>
  );
};

/** Pose un sample : sur la piste active si elle est de son type, sinon sur la premiere piste de son type (choisie). */
function loadSample(s: KitSample): void {
  const cur = activeTrack.get();
  const ci = cur ? TRACK_KEYS.indexOf(cur) : -1;
  const t = ci >= 0 && typedFamily(ci) === s.family ? (cur as TrackKey) : TRACK_KEYS[KIT_FAMILIES.indexOf(s.family as (typeof KIT_FAMILIES)[number])];
  if (!t) return;
  if (t !== cur) trackSelect(t);
  tracks.sample(t, s.key);
  lcdMessage.show(`${TRACK_NAMES[TRACK_KEYS.indexOf(t)]} SAMPLE ${smpLabel(s)}`, 1400);
}

const SamplesTab: React.FC<{ t: TrackKey }> = ({ t }) => {
  const cur = tracks.of(t).snd;
  return (
    <div className="mm-open-samples">
      <div className="mm-open-row">
        <span className="mm-open-note">
          Your folder on the Mac: <b>Music / MM-RYTM Samples / bd, sd, ch...</b> (WAV, AIFF, FLAC, MP3). A click puts a sample on its track.
        </span>
        <button type="button" onClick={() => fileImport.reveal?.(null)}>
          OPEN FOLDER
        </button>
        <button type="button" onClick={() => fileImport.rescan?.()}>
          RESCAN
        </button>
      </div>
      {KIT_FAMILIES.map((f, fi) => {
        const list = samplesOf(f);
        return (
          <section key={f} className="mm-open-card mm-open-wide">
            <h3>
              {f.toUpperCase()} <small>{list.length} SAMPLES</small>
              <span className="mm-open-h-actions">
                <button type="button" onClick={() => fileImport.plugin?.(TRACK_KEYS[fi])}>
                  IMPORT…
                </button>
                <button type="button" onClick={() => fileImport.reveal?.(f)}>
                  FOLDER
                </button>
              </span>
            </h3>
            <div className="mm-open-chips">
              {list.map((s) => (
                <button key={s.key} type="button" className={s.key.includes('/~') ? 'is-user' : undefined} aria-pressed={s.key === cur} onClick={() => loadSample(s)} title={s.key.includes('/~') ? 'Your sample (folder)' : 'Bank sample'}>
                  {smpLabel(s)}
                </button>
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
};

const HELP: readonly [string, string][] = [
  ['OPEN', 'opens and closes this panel (or CLOSE, or Esc)'],
  ['Right click on a key', 'FUNC + that key: its orange function printed under it'],
  ['Arrows under the screen', 'what the arrows do: sub-page, list up / down, KEYBOARD octave'],
  ['Click in the screen', 'a menu line: pick it; again: YES. Right click: NO. Wheel: LEVEL/DATA'],
  ['Knobs', 'drag; Shift + drag: fine; double click: back to the start value'],
  ['Scenes A / B', 'tap A or B, turn knobs, tap again: the crossfader goes from A to B'],
  ['Crossfader in Ableton', 'the Crossfader parameter: map it to a controller or automate it'],
  ['Patterns in Ableton', 'a clip with a program change (Pgm) picks A01 to H16'],
  ['Track length', 'TRIG page 2/2, TLEN: a track loops on its own length'],
  ['Samples', 'Music / MM-RYTM Samples / <type>: each type plays its own samples'],
];

const HelpTab: React.FC = () => (
  <div className="mm-open-help">
    {HELP.map(([k, v]) => (
      <p key={k}>
        <b>{k}</b>
        <span>{v}</span>
      </p>
    ))}
  </div>
);

const CSS = `
.mm-open{position:fixed;inset:10px;z-index:40;display:flex;flex-direction:column;background:#141518;border:1px solid rgba(246,241,231,.14);border-radius:16px;box-shadow:0 24px 80px rgba(0,0,0,.7);color:#f6f1e7;font-family:${FONT_DISPLAY};overflow:hidden}
.mm-open button{font:inherit;color:inherit;cursor:pointer}
.mm-open-head{display:flex;align-items:center;gap:14px;padding:12px 16px;border-bottom:1px solid rgba(246,241,231,.1);background:linear-gradient(#1b1c20,#16171a)}
.mm-open-title{font-weight:800;letter-spacing:.14em;font-size:13px;white-space:nowrap}
.mm-open-title i{font-style:normal;color:#ff781f}
.mm-open-tabs{display:flex;gap:4px}
.mm-open-tabs button,.mm-open-close,.mm-open-tracks button,.mm-open-row button,.mm-open-h-actions button,.mm-open-choice button{background:rgba(246,241,231,.06);border:1px solid rgba(246,241,231,.16);border-radius:7px;padding:6px 10px;font-size:11px;font-weight:700;letter-spacing:.1em}
.mm-open-tabs button[aria-pressed=true],.mm-open-tracks button[aria-pressed=true],.mm-open-choice button[aria-pressed=true]{background:#ff781f;border-color:#ff781f;color:#141518}
.mm-open-close{margin-left:auto;padding:7px 14px;font-size:12px}
.mm-open-close:hover,.mm-open-tabs button:hover,.mm-open-row button:hover,.mm-open-h-actions button:hover{border-color:#ff781f}
.mm-open-tracks{display:grid;grid-template-columns:repeat(16,1fr);gap:4px;padding:10px 16px;border-bottom:1px solid rgba(246,241,231,.08)}
.mm-open-tracks button{padding:6px 0}
.mm-open-body{flex:1;overflow:auto;padding:12px 16px 18px}
.mm-open-grid{display:grid;grid-template-columns:1fr 1fr;gap:10px}
.mm-open-card{background:rgba(246,241,231,.035);border:1px solid rgba(246,241,231,.09);border-radius:12px;padding:8px 10px 10px}
.mm-open-wide{grid-column:1 / -1}
.mm-open-card h3{margin:0 0 6px;font-size:11px;font-weight:800;letter-spacing:.16em;color:#ff781f;display:flex;align-items:center;gap:10px}
.mm-open-card h3 small{color:rgba(246,241,231,.5);font-size:10px;letter-spacing:.1em}
.mm-open-h-actions{margin-left:auto;display:flex;gap:6px}
.mm-open-knobs{display:flex;flex-wrap:wrap;gap:4px}
.mm-open-knobs .v4-knob{width:78px;padding:4px 2px}
.mm-open-knobs .v4-knob-dial{width:46px;height:46px}
.mm-open-knobs .v4-knob-unit{font-size:9px;color:rgba(246,241,231,.55);white-space:nowrap;overflow:hidden;text-overflow:ellipsis;max-width:100%}
.mm-open-row{display:flex;align-items:center;gap:8px;flex-wrap:wrap;margin-bottom:10px}
.mm-open-sample .mm-open-row{margin:0}
.mm-open-now{font-size:12px;letter-spacing:.08em;margin-right:auto}
.mm-open-now b{color:#ff781f;margin-left:8px}
.mm-open-note{font-size:12px;color:rgba(246,241,231,.75);margin-right:auto}
.mm-open-choices{display:flex;flex-direction:column;gap:8px}
.mm-open-choice{display:flex;align-items:center;gap:10px}
.mm-open-choice>span{width:56px;font-size:10px;font-weight:800;letter-spacing:.14em;color:rgba(246,241,231,.7)}
.mm-open-choice>div{display:flex;gap:4px}
.mm-open-samples{display:flex;flex-direction:column;gap:10px}
.mm-open-chips{display:flex;flex-wrap:wrap;gap:4px}
.mm-open-chips button{background:rgba(246,241,231,.05);border:1px solid rgba(246,241,231,.12);border-radius:6px;padding:4px 8px;font-size:11px}
.mm-open-chips button.is-user{border-color:rgba(255,120,31,.6)}
.mm-open-chips button[aria-pressed=true]{background:#ff781f;color:#141518;border-color:#ff781f}
.mm-open-help{display:grid;grid-template-columns:1fr 1fr;gap:8px 18px}
.mm-open-help p{margin:0;display:flex;flex-direction:column;gap:2px;padding:8px 10px;background:rgba(246,241,231,.035);border-radius:10px}
.mm-open-help b{font-size:11px;letter-spacing:.12em;color:#ff781f}
.mm-open-help span{font-size:13px;color:rgba(246,241,231,.85)}
`;

export const OpenPanel: React.FC = () => {
  const open = useSyncExternalStore(pluginPanel.subscribe, pluginPanel.get, pluginPanel.get);
  const [tab, setTab] = useState<Tab>('track');
  useRev();
  const t = activeTrack.get() ?? 'BD';

  // Echap ferme le panneau (avant les raccourcis de la face)
  useEffect(() => {
    if (!open) return undefined;
    const onKey = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopPropagation();
      pluginPanel.set(false);
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  if (!open) return null;
  return (
    <div className="mm-open" role="dialog" aria-label="MM-RYTM open: fine tuning and settings" onPointerDown={(e) => e.stopPropagation()} onContextMenu={(e) => e.preventDefault()}>
      <style>{CSS}</style>
      <div className="mm-open-head">
        <span className="mm-open-title">
          MM-RYTM <i>OPEN</i>
        </span>
        <div className="mm-open-tabs" role="tablist">
          {TABS.map((x) => (
            <button key={x.id} type="button" role="tab" aria-pressed={tab === x.id} aria-selected={tab === x.id} onClick={() => setTab(x.id)}>
              {x.label}
            </button>
          ))}
        </div>
        <button type="button" className="mm-open-close" onClick={() => pluginPanel.set(false)} title="Close (OPEN, Esc): back to the front panel">
          CLOSE ✕
        </button>
      </div>
      {(tab === 'track' || tab === 'samples') && (
        <div className="mm-open-tracks" role="group" aria-label="Track">
          {TRACK_KEYS.map((k, i) => (
            <button key={k} type="button" aria-pressed={k === t} onClick={() => trackSelect(k)}>
              {TRACK_NAMES[i]}
            </button>
          ))}
        </div>
      )}
      <div className="mm-open-body">
        {tab === 'track' && <TrackTab t={t} />}
        {tab === 'global' && <GlobalTab />}
        {tab === 'samples' && <SamplesTab t={t} />}
        {tab === 'help' && <HelpTab />}
      </div>
    </div>
  );
};
