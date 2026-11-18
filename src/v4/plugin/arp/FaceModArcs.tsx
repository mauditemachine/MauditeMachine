/**
 * L'arc lumineux autour des potards modules de la FACE (2026-11-16, la maquette A validee par Mika ; modview.ts) : un
 * arc fin juste dehors de la jupe, sur les 270 degres du potard ; la plage balayee en orange pale, une comete orange
 * qui s'estompe et sa tete claire sur la valeur reelle. Une couche SVG au-dessus de la scene (aucun clic), qui ne dessine
 * rien tant que rien n'est module : la face reste alors la meme au pixel. Les points de chaque arc viennent de la scene
 * elle-meme : le cercle du potard, dans le plan de son panneau, projete par la camera (refaits a chaque taille de
 * fenetre). Cachee capot ouvert (OPEN montre les siens).
 */

import React, { useLayoutEffect, useState, useSyncExternalStore } from 'react';
import { Vector3 } from 'three';
import type { Stage } from '../../scene/renderer';
import { voyExplode } from '../../state/explode';
import { VOY_FACE_KNOBS, type VoyKnobId } from '../../voyager/params';
import { VOY_KNOB, voyKnobPlace } from '../../voyager/theme';
import { arpMod, MOD_HEAD, MOD_ORANGE, modArcPaths } from './modview';
import { editor } from '../../state/editor';
import { faceArcPlaces, FLUTED } from './faceExtras';
import { FLUTED_DIALS } from '../../voyager/knobs';

const FACE_IDS: ReadonlySet<string> = new Set(VOY_FACE_KNOBS.map((k) => k.id));
const SWEEP = 135;
const N = 120;

/**
 * Les points de l'arc d'un potard a l'ecran (px CSS de la fenetre), pour v = i / N. v27 : un petit knob cannele a son
 * rayon a lui (faceExtras.tsx FLUTED) ; DETUNE et les pieces de l'encart d'EDIT, leur place (faceArcPlaces).
 */
function arcPoints(stage: Stage, id: VoyKnobId): [number, number][] | null {
  const rig = stage.voy;
  if (!rig) return null;
  const extra = faceArcPlaces.get(id);
  const pl = extra ? { x: extra.x, z: extra.z, s: 1, where: 'panel' as const } : voyKnobPlace(id);
  const layer = extra ? extra.layer : pl.where === 'panel' ? rig.panel : rig.lid;
  layer.updateWorldMatrix(true, false);
  const R = extra ? extra.R : FLUTED_DIALS.has(id) ? FLUTED.r * FLUTED.scale * 1.13 : VOY_KNOB.skirt.r * pl.s * 1.13;
  const y0 = extra ? extra.y : 0.004;
  const rect = stage.renderer.domElement.getBoundingClientRect();
  const out: [number, number][] = [];
  const p = new Vector3();
  for (let i = 0; i <= N; i += 1) {
    const th = ((SWEEP - 2 * SWEEP * (i / N)) * Math.PI) / 180;
    p.set(pl.x - Math.sin(th) * R, y0, pl.z - Math.cos(th) * R);
    layer.localToWorld(p);
    p.project(stage.camera);
    out.push([rect.left + ((p.x + 1) / 2) * rect.width, rect.top + ((1 - p.y) / 2) * rect.height]);
  }
  return out;
}

const useHood = () => useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);
const useMods = () => useSyncExternalStore(arpMod.subscribe, arpMod.get, arpMod.get);
const useEdit = () => useSyncExternalStore(editor.subscribe, editor.get, editor.get);

export const FaceModArcs: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const hood = useHood();
  const mods = useMods();
  const [size, setSize] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth * 10000 + window.innerHeight));
  const [cache] = useState(() => new Map<string, [number, number][]>());
  useLayoutEffect(() => {
    const on = (): void => setSize(window.innerWidth * 10000 + window.innerHeight);
    window.addEventListener('resize', on);
    return () => window.removeEventListener('resize', on);
  }, []);
  const edit = useEdit();
  // les potards de la face ; DETUNE ; les pieces de l'encart tant qu'il est monte (EDIT)
  const ids = [...mods.keys()].filter((id) => FACE_IDS.has(id) || (faceArcPlaces.get(id)?.live() ?? false));
  if (!stage || hood !== 'closed' || ids.length === 0) return null;
  const key = (id: string): string => `${id}|${size}|${edit === 'voy' ? 'e' : ''}`;
  const k = window.innerWidth / 1100;
  const w = 3 * k;
  return (
    <svg className="mm-mod-face" style={{ position: 'fixed', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }} aria-hidden="true">
      <defs>
        <filter id="mm-mod-glow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={2.2 * k} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {ids.map((id) => {
        let pts = cache.get(key(id));
        if (!pts) {
          pts = arcPoints(stage, id as VoyKnobId) ?? [];
          cache.set(key(id), pts);
        }
        const P = pts;
        if (P.length === 0) return null;
        const at = (v: number): readonly [number, number] => {
          const f = Math.min(1, Math.max(0, v)) * N;
          const i = Math.min(N - 1, Math.floor(f));
          const t = f - i;
          return [P[i][0] + (P[i + 1][0] - P[i][0]) * t, P[i][1] + (P[i + 1][1] - P[i][1]) * t];
        };
        const m = mods.get(id);
        if (!m) return null;
        const a = modArcPaths(m, at, w);
        return (
          <g key={id} className="mm-mod-arc" data-id={id}>
            <path d={a.range} style={{ stroke: MOD_ORANGE }} strokeOpacity={0.22} strokeWidth={w} fill="none" strokeLinecap="round" />
            {a.trail.map((s, i) => (
              <path key={i} d={s.d} style={{ stroke: MOD_ORANGE }} strokeOpacity={s.o} strokeWidth={w * 1.07} fill="none" strokeLinecap="round" filter="url(#mm-mod-glow)" />
            ))}
            <circle cx={a.head[0]} cy={a.head[1]} r={2.2 * k} style={{ fill: MOD_HEAD }} filter="url(#mm-mod-glow)" />
          </g>
        );
      })}
    </svg>
  );
};
