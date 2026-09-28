/**
 * Page sans WebGL (ou contexte perdu) : la meme ligne, dessinee en SVG
 * depuis path.ts avec une camera fixe (le plan des portes), 512 points,
 * 37 perles argent, 5 anneaux. Halo par flou CSS. Suffit a lire la page.
 */

import React, { useMemo } from 'react';
import { PerspectiveCamera, Vector3 } from 'three';
import { BEADS, GROUPS } from '../data/beads';
import { fullPos, smoothPos } from '../scene/path';
import { KNOB_DEFAULTS, knobUniforms } from '../state/knobs';

const W = 1000;
const H = 600;

function project(cam: PerspectiveCamera, v: Vector3): [number, number, number] | null {
  const p = v.clone().project(cam);
  if (p.z > 1 || p.z < -1) return null;
  return [((p.x + 1) / 2) * W, ((1 - p.y) / 2) * H, p.z];
}

const StaticLine: React.FC = () => {
  const model = useMemo(() => {
    const k = knobUniforms(KNOB_DEFAULTS);
    const cam = new PerspectiveCamera(38, W / H, 0.1, 200);
    const pos = smoothPos(1.14, k.tuning, new Vector3()).add(new Vector3(5.5, 2.2, 0));
    const look = smoothPos(1.14 - 0.114, k.tuning, new Vector3());
    look.y -= 0.35;
    cam.position.copy(pos);
    cam.lookAt(look);
    cam.updateMatrixWorld();
    const pts: string[] = [];
    const v = new Vector3();
    for (let i = 0; i <= 512; i += 1) {
      fullPos(i / 512, k, 0, v);
      const p = project(cam, v);
      if (p) pts.push(`${p[0].toFixed(1)},${p[1].toFixed(1)}`);
    }
    const beads = BEADS.map((b) => {
      fullPos(b.t, k, 0, v);
      const p = project(cam, v);
      if (!p) return null;
      const dist = cam.position.distanceTo(v);
      return { id: b.id, x: p[0], y: p[1], r: Math.max(1.5, (b.radius * 520) / dist), hub: b.kind === 'mixtape' };
    });
    const gates = GROUPS[4].map((b) => {
      fullPos(b.t, k, 0, v);
      const p = project(cam, v);
      if (!p) return null;
      const dist = cam.position.distanceTo(v);
      const minutes = b.mixtape ? b.mixtape.durationMinutes : 90;
      const r = 0.95 + 0.55 * Math.min(1, minutes / 121);
      return { id: b.id, x: p[0], y: p[1], r: (r * 520) / dist };
    });
    return { line: pts.join(' '), beads, gates };
  }, []);

  return (
    <svg className="v3-static" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid slice" aria-hidden="true">
      <polyline className="v3-static-halo" points={model.line} />
      <polyline className="v3-static-line" points={model.line} />
      {model.gates.map((g) => g && <circle key={g.id} className="v3-static-gate" cx={g.x} cy={g.y} r={g.r} />)}
      {model.beads.map((b) => b && <circle key={b.id} className="v3-static-bead" cx={b.x} cy={b.y} r={b.r} />)}
    </svg>
  );
};

export default StaticLine;
