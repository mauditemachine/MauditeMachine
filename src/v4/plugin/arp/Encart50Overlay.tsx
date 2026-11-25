/**
 * v50 : ce que l'encart d'EDIT pose en HTML / SVG au-dessus de la scene (aucun rendu 3D de plus) :
 * - le point qui parcourt la forme de chaque LFO (page LFO montree seulement, loop30.ts a 30 images par seconde ; page
 *   cachee, encart baisse, capot ouvert ou fenetre cachee : la boucle s'arrete, regle CPU v49) ;
 * - le viseur : pendant une assignation, un anneau a l'accent autour de chaque potard qui peut etre une cible (la face,
 *   la page montree de l'encart ; les pages d'OPEN allument les leurs : pcbui.tsx data-aim) ;
 * - le menu deroule d'une fenetre de verre noir (SOURCE, DESTINATION groupee par famille, STEPS, RATE), facon fenetres
 *   des pages d'OPEN.
 */

import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import { pattern } from '../../audio/pattern';
import type { Stage } from '../../scene/renderer';
import { editor } from '../../state/editor';
import { voyExplode } from '../../state/explode';
import { FLUTED_DIALS } from '../../voyager/knobs';
import { VOY_FACE_KNOBS } from '../../voyager/params';
import { VOY_SEQ } from '../../voyager/seqscreen';
import { VOY_KNOB, voyKnobPlace } from '../../voyager/theme';
import { accent50, lfoWave, waveAt } from './encart50';
import { encartPage, faceArcPlaces } from './faceExtras';
import { hostBeats, hostTempo } from './hostClock';
import { loop30 } from './loop30';
import { modMenu, type MenuSpec } from './modMenu';
import { DEST_MENU, destMenuCode, destShort, LFOS, modAim, modView } from './modRoutes';
import { modDestCodeOf } from './modTable';
import './encart50.css';

const useStore = <T,>(s: { subscribe: (fn: () => void) => () => void; get: () => T }): T => useSyncExternalStore(s.subscribe, s.get, s.get);
const aimStore = { subscribe: modView.subscribe, get: modAim.key };

/** La taille de la fenetre (les points projetes changent avec elle). */
function useWinSize(): number {
  const [size, setSize] = useState(() => (typeof window === 'undefined' ? 0 : window.innerWidth * 10000 + window.innerHeight));
  useLayoutEffect(() => {
    const f = (): void => setSize(window.innerWidth * 10000 + window.innerHeight);
    window.addEventListener('resize', f);
    return () => window.removeEventListener('resize', f);
  }, []);
  return size;
}

/* ---------------- le point des LFO ---------------- */

const Y = VOY_SEQ.h + 0.004;

/** Les noires du moment : celles de l'hote, sinon une horloge au tempo de la face. */
const beatsNow = (now: number): number => hostBeats(now) ?? ((now / 60000) * (hostTempo.get() ?? pattern.get().bpm));

const LfoDots: React.FC<{ stage: Stage }> = ({ stage }) => {
  const edit = useStore(editor as unknown as { subscribe: (fn: () => void) => () => void; get: () => string | null });
  const page = useStore(encartPage);
  const hood = useStore(voyExplode as unknown as { subscribe: (fn: () => void) => () => void; get: () => string });
  const [vis, setVis] = useState(() => typeof document === 'undefined' || document.visibilityState !== 'hidden');
  const dots = useRef<(SVGGElement | null)[]>([]);
  useEffect(() => {
    const f = (): void => setVis(document.visibilityState !== 'hidden');
    document.addEventListener('visibilitychange', f);
    return () => document.removeEventListener('visibilitychange', f);
  }, []);
  const on = edit === 'voy' && page === 'lfo' && hood === 'closed' && vis;
  useEffect(() => {
    const layer = stage.voy?.seqScreen?.group;
    if (!on || !layer) return undefined;
    const out = { x: 0, y: 0 };
    const geo = LFOS.map((_, i) => lfoWave(i));
    return loop30((now) => {
      const rect = stage.renderer.domElement.getBoundingClientRect();
      const beats = beatsNow(now);
      LFOS.forEach((l, i) => {
        const el = dots.current[i];
        if (!el) return;
        const b = l.beats();
        const hz = l.hz();
        const cyc = b !== null ? beats / b : hz !== null ? (now / 1000) * hz : 0;
        // deux cycles dessines : le point les parcourt
        const p = ((cyc % 2) + 2) % 2;
        const g = geo[i];
        stage.hit.project(layer, g.x0 + ((g.x1 - g.x0) * p) / 2, Y + 0.01, g.z - g.amp * waveAt(l.shapeName(), p), out);
        el.setAttribute('transform', `translate(${(rect.left + out.x).toFixed(1)} ${(rect.top + out.y).toFixed(1)})`);
      });
    });
  }, [on, stage]);
  if (!on) return null;
  const k = window.innerWidth / 1100;
  const a = accent50();
  return (
    <svg className="mm-e50-dots" style={{ position: 'fixed', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }} aria-hidden="true">
      <defs>
        <radialGradient id="mm-e50-glow">
          <stop offset="0" stopColor={a} stopOpacity={0.7} />
          <stop offset="1" stopColor={a} stopOpacity={0} />
        </radialGradient>
      </defs>
      {LFOS.map((l, i) => (
        <g key={l.n} ref={(el) => {
            dots.current[i] = el;
          }} transform="translate(-99 -99)" data-lfo={l.n}>
          <circle r={7 * k} fill="url(#mm-e50-glow)" />
          <circle r={2.1 * k} style={{ fill: a }} />
        </g>
      ))}
    </svg>
  );
};

/* ---------------- le viseur : les anneaux des cibles ---------------- */

const FACE_TARGETS = (): string[] => VOY_FACE_KNOBS.map((k) => k.id as string).filter((id) => modDestCodeOf(id) !== undefined);

function ringPoints(stage: Stage, layer: Parameters<Stage['hit']['project']>[0], x: number, y: number, z: number, R: number): string {
  const rect = stage.renderer.domElement.getBoundingClientRect();
  const out = { x: 0, y: 0 };
  const pts: string[] = [];
  for (let i = 0; i <= 72; i += 1) {
    const th = (i / 72) * Math.PI * 2;
    stage.hit.project(layer, x + Math.cos(th) * R, y, z + Math.sin(th) * R, out);
    pts.push(`${(rect.left + out.x).toFixed(1)},${(rect.top + out.y).toFixed(1)}`);
  }
  return pts.join(' ');
}

const AimRings: React.FC<{ stage: Stage }> = ({ stage }) => {
  const aim = useStore(aimStore);
  const hood = useStore(voyExplode as unknown as { subscribe: (fn: () => void) => () => void; get: () => string });
  const page = useStore(encartPage);
  const edit = useStore(editor as unknown as { subscribe: (fn: () => void) => () => void; get: () => string | null });
  const size = useWinSize();
  const rig = stage.voy;
  if (aim === null || !rig || hood !== 'closed') return null;
  void size;
  void page;
  void edit;
  const rings: { id: string; pts: string }[] = [];
  for (const id of FACE_TARGETS()) {
    const pl = voyKnobPlace(id as never);
    const layer = pl.where === 'panel' ? rig.panel : rig.lid;
    const R = FLUTED_DIALS.has(id as never) ? 0.24 * 0.9 * 1.22 : VOY_KNOB.skirt.r * pl.s * 1.2;
    rings.push({ id, pts: ringPoints(stage, layer, pl.x, 0.004, pl.z, R) });
  }
  for (const [id, places] of faceArcPlaces) {
    if (modDestCodeOf(id) === undefined) continue;
    places.forEach((p, i) => {
      if (p.live()) rings.push({ id: `${id}#${i}`, pts: ringPoints(stage, p.layer, p.x, p.y, p.z, (p.R / 1.13) * 1.2) });
    });
  }
  const k = window.innerWidth / 1100;
  const a = accent50();
  return (
    <svg className="mm-e50-aim" style={{ position: 'fixed', left: 0, top: 0, width: '100%', height: '100%', pointerEvents: 'none', zIndex: 5 }} aria-hidden="true">
      <defs>
        <filter id="mm-e50-aimglow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation={2.6 * k} result="b" />
          <feMerge>
            <feMergeNode in="b" />
            <feMergeNode in="SourceGraphic" />
          </feMerge>
        </filter>
      </defs>
      {rings.map((r) => (
        <polyline key={r.id} data-id={r.id} points={r.pts} fill="none" style={{ stroke: a }} strokeOpacity={0.95} strokeWidth={2.2 * k} filter="url(#mm-e50-aimglow)" />
      ))}
    </svg>
  );
};

/* ---------------- le menu ---------------- */

/** Les largeurs du menu (px du cadre de 1100 de large, mis a l'echelle de la fenetre). */
const MENU_W = { list: 104, dest: 560 } as const;

const DestBody: React.FC<{ m: Extract<MenuSpec, { kind: 'dest' }> }> = ({ m }) => {
  const cur = m.current > 0 ? destMenuCode(m.current) : m.current;
  const home = DEST_MENU.find((g) => g.items.some((d) => d.code === cur))?.group ?? DEST_MENU[0]?.group ?? '';
  const [grp, setGrp] = useState(home);
  const items = DEST_MENU.find((g) => g.group === grp)?.items ?? [];
  return (
    <div className="mm-e50-dest">
      <div className="mm-e50-groups" role="tablist" aria-label="Families">
        {DEST_MENU.map((g) => (
          <button
            key={g.group}
            type="button"
            role="tab"
            aria-selected={g.group === grp}
            data-on={g.group === grp ? '1' : undefined}
            data-cur={g.group === home && m.current > 0 ? '1' : undefined}
            onPointerEnter={() => setGrp(g.group)}
            onClick={() => setGrp(g.group)}
          >
            {g.group}
            <i>{g.items.length}</i>
          </button>
        ))}
        <button
          type="button"
          className="mm-e50-off"
          data-on={m.current === 0 ? '1' : undefined}
          onClick={() => {
            m.pick(0);
            modMenu.close();
          }}
        >
          OFF
        </button>
      </div>
      <ul className="mm-e50-items" role="listbox" aria-label={grp}>
        {items.map((d) => (
          <li key={d.code} role="presentation">
            <button
              type="button"
              role="option"
              aria-selected={d.code === cur}
              data-on={d.code === cur ? '1' : undefined}
              data-code={d.code}
              title={destShort(d)}
              onClick={() => {
                m.pick(d.code);
                modMenu.close();
              }}
            >
              {destShort(d)}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

const ModMenu: React.FC<{ stage: Stage }> = ({ stage }) => {
  const m = useStore(modMenu);
  const page = useStore(encartPage);
  const edit = useStore(editor as unknown as { subscribe: (fn: () => void) => () => void; get: () => string | null });
  const hood = useStore(voyExplode as unknown as { subscribe: (fn: () => void) => () => void; get: () => string });
  const box = useRef<HTMLDivElement>(null);
  useWinSize();
  // l'encart qui change de page, qui baisse, le capot qui s'ouvre : le menu se ferme
  useEffect(() => modMenu.close(), [page, edit, hood]);
  useEffect(() => {
    if (!m) return undefined;
    const away = (e: PointerEvent): void => {
      if (!box.current?.contains(e.target as Node)) modMenu.close();
    };
    const esc = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.preventDefault();
      e.stopImmediatePropagation();
      modMenu.close();
    };
    window.addEventListener('pointerdown', away, true);
    window.addEventListener('keydown', esc, true);
    return () => {
      window.removeEventListener('pointerdown', away, true);
      window.removeEventListener('keydown', esc, true);
    };
  }, [m]);
  if (!m) return null;
  const v = stage.hit.list().find((h) => h.id === m.anchor);
  if (!v) return null;
  const rect = stage.renderer.domElement.getBoundingClientRect();
  const k = window.innerWidth / 1100;
  const w = (m.kind === 'dest' ? MENU_W.dest : MENU_W.list * (m.kind === 'list' ? m.cols : 1)) * k;
  const cx = rect.left + v.bx + v.bw / 2;
  const left = Math.max(8, Math.min(window.innerWidth - w - 8, cx - w / 2));
  // l'encart est en bas de la fenetre : le menu s'ouvre au-dessus de sa fenetre
  const bottom = window.innerHeight - (rect.top + v.by) + 6 * k;
  return (
    <div
      ref={box}
      className="mm-e50-menu"
      data-kind={m.kind}
      role="dialog"
      aria-label={m.title}
      style={{ position: 'fixed', left, bottom, width: w / k, transform: `scale(${k})`, transformOrigin: '0 100%', zIndex: 30 }}
    >
      <div className="mm-e50-title">{m.title}</div>
      {m.kind === 'dest' ? (
        <DestBody m={m} />
      ) : (
        <ul className="mm-e50-list" role="listbox" aria-label={m.title} style={{ gridTemplateColumns: `repeat(${m.cols}, 1fr)` }}>
          {m.items.map((it) => (
            <li key={it.label} role="presentation">
              <button
                type="button"
                role="option"
                aria-selected={it.on}
                data-on={it.on ? '1' : undefined}
                onClick={() => {
                  it.pick();
                  modMenu.close();
                }}
              >
                {it.label}
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};

/** Tout ce que l'encart v50 pose au-dessus de la scene. */
export const Encart50Overlay: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  if (!stage || !stage.voy) return null;
  return (
    <>
      <LfoDots stage={stage} />
      <AimRings stage={stage} />
      <ModMenu stage={stage} />
    </>
  );
};
