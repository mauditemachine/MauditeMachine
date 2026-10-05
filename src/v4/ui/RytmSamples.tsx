/**
 * Tes samples dans le MM-RYTM (2026-10-05, Mika : "je ne peux toujours pas
 * selectionner les samples que je t'ai donnes, les kicks ; ou explique-moi
 * comment aller les chercher"). Capot du MM-RYTM ouvert (la ou sont ses
 * TWEAKS) : le panneau SAMPLES, a gauche de la machine (au telephone,
 * replie en pastille en haut a gauche).
 * - Une voix (KICK, SNARE, CLAP, HATS, TOMS, RIM), puis ses sons : 909,
 *   808, MM, ceux du site, les tiens (un toucher : la voix le joue ; x : il
 *   part) ;
 * - + ADD FILES : des fichiers audio de l'appareil (WAV, AIFF, MP3...), qui
 *   y restent (audio/usersamples.ts) ; la voix prend le premier ;
 * - desktop, machine fermee ou ouverte : un fichier depose sur un pad va a
 *   sa voix (ailleurs sur la machine : a la voix choisie, sinon au kick).
 */

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { KIT_FAMILIES, KIT_LABEL, KIT_MODELS, KIT_MODEL_LABEL, familyOf, kit, type KitFamily } from '../audio/kit';
import { pattern } from '../audio/pattern';
import { samplesOf } from '../audio/samples';
import type { ShotId } from '../audio/shotsdsp';
import { AUDIO_FILE, userSamples } from '../audio/usersamples';
import type { Stage } from '../scene/renderer';
import { explode } from '../state/explode';
import { focus } from '../state/focus';
import { lcdMessage } from '../state/lcdMessage';

interface Props {
  mobile: boolean;
  getStage: () => Stage | null;
}

const isAudioFile = (f: File): boolean => f.type.startsWith('audio/') || AUDIO_FILE.test(f.name);
const hasFiles = (e: DragEvent | React.DragEvent): boolean => !!e.dataTransfer && [...e.dataTransfer.types].includes('Files');

/** Le nom d'une voix a l'ecran : KICKS, SNARES... */
const plural = (f: KitFamily, n: number): string => `${KIT_LABEL[f]}${n > 1 ? 'S' : ''}`;

/** Des fichiers pour une voix : rangés, la voix prend le premier, l'ecran le dit. */
async function addTo(f: KitFamily, files: readonly File[]): Promise<string> {
  const audio = files.filter(isAudioFile);
  const r = await userSamples.add(f, audio.length > 0 ? audio : files);
  if (r.added.length > 0) {
    const first = samplesOf(f).find((s) => s.user === r.added[0].id);
    if (first) kit.setSound(f, first.key);
  }
  const skipped = r.skipped.length + (files.length - (audio.length > 0 ? audio.length : files.length));
  const msg =
    r.added.length > 0
      ? `${r.added.length} ${plural(f, r.added.length)} ADDED${skipped > 0 ? `, ${skipped} SKIPPED` : ''}`
      : skipped > 0
        ? 'NOT AN AUDIO FILE'
        : 'NOTHING ADDED';
  lcdMessage.show(msg, 2600);
  return msg;
}

/** La voix d'un point de la scene : le pad sous le doigt, sinon la voix choisie, sinon le kick. */
function familyAt(stage: Stage | null, clientX: number, clientY: number): KitFamily {
  if (stage) {
    const rect = stage.renderer.domElement.getBoundingClientRect();
    const h = stage.hit.pick(clientX - rect.left, clientY - rect.top, false);
    const f = h?.inst ? familyOf(h.inst as ShotId) : null;
    if (f) return f;
  }
  const inst = pattern.get().instrument;
  return (inst && familyOf(inst as ShotId)) || 'bd';
}

/** Desktop : un fichier audio depose sur le MM-RYTM (la machine regardee) va a la voix du pad touche. */
function useRytmDrop(getStage: () => Stage | null, mobile: boolean): void {
  useEffect(() => {
    if (mobile) return undefined;
    const mine = (e: DragEvent): boolean => focus.get() === 'mm808' && hasFiles(e) && !(e.target as HTMLElement | null)?.closest?.('.v4-smp');
    const over = (e: DragEvent): void => {
      if (!mine(e)) return;
      e.preventDefault();
      if (e.dataTransfer) e.dataTransfer.dropEffect = 'copy';
    };
    const drop = (e: DragEvent): void => {
      if (!mine(e)) return;
      e.preventDefault();
      const files = [...(e.dataTransfer?.files ?? [])];
      if (files.length > 0) void addTo(familyAt(getStage(), e.clientX, e.clientY), files);
    };
    window.addEventListener('dragover', over);
    window.addEventListener('drop', drop);
    return () => {
      window.removeEventListener('dragover', over);
      window.removeEventListener('drop', drop);
    };
  }, [getStage, mobile]);
}

export const RytmSamples: React.FC<Props> = ({ mobile, getStage }) => {
  const hood = useSyncExternalStore(explode.subscribe, explode.get, explode.get);
  const f = useSyncExternalStore(focus.subscribe, focus.get, focus.get);
  useSyncExternalStore(userSamples.subscribe, userSamples.list, userSamples.list);
  useSyncExternalStore(
    (fn) => kit.subscribe(() => fn()),
    () => kit.get(),
    () => kit.get()
  );
  const inst = useSyncExternalStore(pattern.subscribe, () => pattern.get().instrument, () => pattern.get().instrument);
  const [fam, setFam] = useState<KitFamily>(() => (inst && familyOf(inst as ShotId)) || 'bd');
  const [unfolded, setUnfolded] = useState(!mobile);
  const [note, setNote] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const input = useRef<HTMLInputElement>(null);
  useRytmDrop(getStage, mobile);

  // La voix choisie sur la machine : le panneau la suit
  useEffect(() => {
    const g = inst ? familyOf(inst as ShotId) : null;
    if (g) setFam(g);
  }, [inst]);

  const open = f === 'mm808' && hood === 'open';
  if (!open) return null;

  if (!unfolded) {
    return (
      <button type="button" className="v4-smp-pill" aria-label="Your samples" onClick={() => setUnfolded(true)}>
        <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden="true">
          <path d="M8 2v8M4.5 6.5 8 10l3.5-3.5M2.5 13.5h11" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        SAMPLES
      </button>
    );
  }

  const current = kit.sound(fam);
  const sounds = [
    ...KIT_MODELS.map((m) => ({ key: m as string, label: KIT_MODEL_LABEL[m], user: undefined as string | undefined, n: 0 })),
    ...samplesOf(fam).map((s, i) => ({ key: s.key, label: s.label, user: s.user, n: i + 1 })),
  ];
  const pick = (key: string): void => {
    if (kit.setSound(fam, key)) lcdMessage.show(kit.readout(fam), 1600);
  };
  const files = (list: FileList | null): void => {
    const arr = list ? [...list] : [];
    if (arr.length === 0) return;
    void addTo(fam, arr).then(setNote);
  };
  const stop = (e: React.SyntheticEvent): void => e.stopPropagation();

  return (
    <section
      className="v4-smp"
      data-mobile={mobile ? '1' : '0'}
      data-drag={dragging ? '1' : '0'}
      aria-label="Your samples"
      onPointerDown={stop}
      onWheel={stop}
      onTouchStart={stop}
      onDragOver={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(true);
      }}
      onDragLeave={() => setDragging(false)}
      onDrop={(e) => {
        if (!hasFiles(e)) return;
        e.preventDefault();
        setDragging(false);
        files(e.dataTransfer.files);
      }}
    >
      <header className="v4-smp-bar">
        <span className="v4-smp-title">SAMPLES</span>
        <span className="v4-smp-sub">ON THIS DEVICE</span>
        {mobile && (
          <button type="button" className="v4-smp-x" aria-label="Hide your samples" onClick={() => setUnfolded(false)}>
            ×
          </button>
        )}
      </header>
      <div className="v4-smp-fams" role="radiogroup" aria-label="Voice">
        {KIT_FAMILIES.map((k) => (
          <button key={k} type="button" role="radio" aria-checked={fam === k} className="v4-smp-fam" onClick={() => setFam(k)}>
            {KIT_LABEL[k]}
          </button>
        ))}
      </div>
      <ul className="v4-smp-list" role="radiogroup" aria-label={`${KIT_LABEL[fam]} sound`}>
        {sounds.map((s) => (
          <li key={s.key} className="v4-smp-row" data-on={current === s.key ? '1' : '0'}>
            <button type="button" role="radio" aria-checked={current === s.key} className="v4-smp-snd" onClick={() => pick(s.key)}>
              <span className="v4-smp-n">{s.n > 0 ? String(s.n).padStart(2, '0') : ''}</span>
              <span className="v4-smp-name">{s.label}</span>
              {s.user && <span className="v4-smp-mine">YOURS</span>}
            </button>
            {s.user && (
              <button type="button" className="v4-smp-del" aria-label={`Remove ${s.label}`} onClick={() => void userSamples.remove(s.user as string)}>
                ×
              </button>
            )}
          </li>
        ))}
      </ul>
      <button type="button" className="v4-smp-add" onClick={() => input.current?.click()}>
        + ADD {KIT_LABEL[fam]} FILES
      </button>
      <input
        ref={input}
        type="file"
        multiple
        accept="audio/*,.wav,.aif,.aiff,.mp3,.m4a,.flac,.ogg,.caf"
        hidden
        onChange={(e) => {
          files(e.target.files);
          e.target.value = '';
        }}
      />
      <p className="v4-smp-note" aria-live="polite">
        {note ?? (mobile ? 'WAV, AIFF, MP3... They stay on this device.' : 'Or drop audio files here, or on a pad. They stay on this device.')}
      </p>
    </section>
  );
};

export default RytmSamples;
