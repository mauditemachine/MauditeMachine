/**
 * La face B du plugin (2026-11-25, lot 47 ; Mika, sur les maquettes : "B, 1600 c'est bon, go code"). La face d'avant (la
 * scene 3D, ecran, potards, touches, crossfader) reste entiere dans 1600 x 975 ; ses pads 2 x 8 sont couverts par la rangee
 * de la v3 qu'il avait aimee (les 16 pistes : nom, niveau, mute, solo ; les 16 pas en ligne, BEAT 1 a 4). Au-dessus, un
 * bandeau (MAUDITE MACHINE, MM-RYTM, les onglets d'OPEN, le menu) ; dessous, la barre DRAG MIDI. La fenetre fait 1600 x 1069
 * (plugin/mm-rytm/src/PluginEditor.cpp, toujours a ce rapport) : tout se pose en unites de 1600 de large, puis se zoome.
 */

import React, { useEffect, useState, useSyncExternalStore } from 'react';
import { pluginNew } from '../../actions/patterns';
import { pattern, velocity } from '../../audio/pattern';
import { TRACK_KEYS } from '../../audio/tracks';
import { DT2_FACEPLATE } from '../../rytm/faceplate';
import { patterns, slotName } from '../../state/patterns';
import { pluginMidi } from '../../state/pluginMidi';
import { Confirm, useMidi, useMidiDrag } from './Library';
import { Steps, type RowLay } from './Steps';
import { Key, useTick } from './ui';
import { TABS, view, type Page } from './view';
import { useView } from './Chrome';

/** La fenetre de la face B, en unites (px a 1600 de large) : le bandeau, la face 3D, la barre du bas. */
export const FB = { w: 1600, head: 50, face: 975, foot: 44, h: 1069 } as const;

/** Les px d'un mm de la face (la face 3D remplit ses 1600 de large : 256 mm). */
const U = FB.w / DT2_FACEPLATE.size.w;
/** Le cadre des pas de la face (faceplate.ts, frames trigs) : la rangee se pose dedans, son fond couvre les pads 3D. */
const TRIGS = DT2_FACEPLATE.frames.find((f) => f.id === 'trigs')?.rect ?? {
  x: 34,
  y: 109.5,
  w: 216,
  h: 44.5,
};
const PLATE = {
  left: TRIGS.x * U + 2.5,
  top: TRIGS.y * U + 2,
  width: TRIGS.w * U - 5,
  height: TRIGS.h * U - 4.5,
};
const ROW_B: RowLay = {
  x0: 232,
  x1: 1552,
  chipY: 698,
  chipH: 40,
  stepY: 750,
  stepH: 124,
  brY: 884,
  noteY: 920,
  faceB: true,
};

/** Le zoom de la face B a la fenetre (centree si le rapport n'est pas exactement le sien). */
export function useFaceZoom(): { k: number; x: number; y: number } {
  const calc = (): { k: number; x: number; y: number } => {
    const k = Math.min(window.innerWidth / FB.w, window.innerHeight / FB.h);
    return {
      k,
      x: Math.max(0, (window.innerWidth - FB.w * k) / 2),
      y: Math.max(0, (window.innerHeight - FB.h * k) / 2),
    };
  };
  const [z, setZ] = useState(calc);
  useEffect(() => {
    const on = (): void => setZ(calc());
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  return z;
}

/** La rangee sur la face 3D (dans la racine de la face, a son zoom) : le fond du cadre des pas, les pistes, les pas. */
export const FaceRow: React.FC<{ k: number }> = ({ k }) => (
  <div className="mm3-row" style={{ transform: `scale(${k})` }} onContextMenu={(e) => e.preventDefault()}>
    <div className="mm3-rowplate" style={PLATE} />
    <Steps lay={ROW_B} />
  </div>
);

const FACE_TABS: readonly Page[] = [...TABS, 'LIBRARY', 'MIDI'];

/** Le nombre de notes de la pattern (ce que DRAG MIDI emporte). */
function noteCount(): number {
  const p = pattern.get();
  const len = pattern.stepCount();
  let n = 0;
  for (const k of TRACK_KEYS) for (let i = 0; i < len; i += 1) if (velocity(p.steps, k, i) > 0) n += 1;
  return n;
}

/** Le bandeau du haut et la barre du bas, autour de la face 3D (sous elle dans l'ordre d'affichage : la face les recouvre). */
export const FaceChrome: React.FC<{
  z: { k: number; x: number; y: number };
}> = ({ z }) => {
  const v = useView();
  useTick();
  const cur = useSyncExternalStore(patterns.subscribe, () => patterns.get().cur);
  const { status } = useMidi();
  const onDrag = useMidiDrag();
  const len = pattern.stepCount();
  const notes = noteCount();
  const fresh = !!status && Date.now() - status.at < 5000;
  return (
    <div className="mm3-root mm3-faceb" onContextMenu={(e) => e.preventDefault()}>
      <div
        className="mm3-stage"
        style={{
          width: FB.w,
          height: FB.h,
          transform: `translate(${z.x}px, ${z.y}px) scale(${z.k})`,
        }}
      >
        <div className="mm3-fbbar" style={{ left: 0, top: 0, width: FB.w, height: FB.head }} />
        <div className="mm3-wordmark" style={{ left: 26, top: 13, fontSize: 23 }}>
          MAUDITE MACHINE
        </div>
        <div className="mm3-model" style={{ left: 300, top: 15, fontSize: 19 }}>
          MM-RYTM
        </div>
        <div
          className="mm3-note"
          style={{
            left: 452,
            top: 20,
            fontSize: 9,
            color: 'var(--acc)',
            letterSpacing: '.2em',
          }}
        >
          OPEN ›
        </div>
        <div className="mm3-tabs mm3-fbtabs" style={{ left: 508, top: 12 }} role="tablist" aria-label="OPEN pages">
          {FACE_TABS.map((t) => (
            <div
              key={t}
              className={`mm3-tab${v.page === t ? ' on' : ''}`}
              role="tab"
              aria-selected={v.page === t}
              title={`OPEN: ${t}`}
              onPointerDown={(e) => {
                if (e.button !== 0) return;
                e.preventDefault();
                view.open(t);
              }}
            >
              {t}
            </div>
          ))}
        </div>
        <div
          className={`mm3-btn${v.menu ? ' on' : ''}`}
          style={{ left: 1536, top: 10, width: 40, height: 30 }}
          role="button"
          aria-label="Menu: settings, mouse and keys"
          onPointerDown={(e) => {
            if (e.button !== 0) return;
            e.preventDefault();
            e.stopPropagation();
            view.menu();
          }}
        >
          <i />
          <i />
          <i />
        </div>
        <div
          className="mm3-fbbar foot"
          style={{
            left: 0,
            top: FB.head + FB.face,
            width: FB.w,
            height: FB.foot,
          }}
        />
        <div
          className="mm3-fbdrag"
          style={{
            left: 20,
            top: FB.head + FB.face + 8,
            width: 170,
            height: 28,
            opacity: notes > 0 ? 1 : 0.55,
          }}
          role="button"
          aria-label="DRAG MIDI: drag the playing pattern into Ableton; a click saves the .mid"
          title="Drag into Ableton (a MIDI track or a Drum Rack, C1 to D#2); a click saves the .mid"
          onPointerDown={onDrag}
        >
          <em>⠿</em> DRAG MIDI
        </div>
        <div className="mm3-note mm3-fbinfo" style={{ left: 210, top: FB.head + FB.face + 16 }}>
          {slotName(cur)} <span>/</span> {len} STEPS <span>/</span> {notes} NOTES
          {fresh && status ? (
            <i style={{ color: status.ok ? 'var(--acc)' : 'var(--red)' }}> &nbsp;·&nbsp; {status.msg.toUpperCase()}</i>
          ) : (
            <span> &nbsp;·&nbsp; DROP IT ON A MIDI TRACK OR A DRUM RACK · A CLICK SAVES THE .MID</span>
          )}
        </div>
        <Confirm x={1340} y={FB.head + FB.face + 8} w={100} h={28} word="NEW…" title="An empty pattern, the sounds at their start (Cmd+Z: back)" run={pluginNew} />
        <Key x={1456} y={FB.head + FB.face + 8} w={124} h={28} r={7} inner="SAVE .MID" onTap={() => pluginMidi.save?.()} title="Save the .mid in Music / MM-RYTM MIDI and show it in the Finder" />
      </div>
    </div>
  );
};
