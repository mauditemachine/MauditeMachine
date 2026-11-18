/**
 * v31 (Mika : "un compteur de cpu en haut a droite du plugin") : le compteur CPU de cette instance, sur la face (a gauche
 * de l'icone SETTINGS, dans l'en-tete, projete comme elle) et dans OPEN (entre les touches des pages et SETTINGS). Un
 * petit afficheur : CPU, le total en % d'un coeur et une barre avec le pic ; l'accent au-dela de 50 %, rouge au-dela de
 * 80 %. Un clic ouvre le detail : chaque etage du moteur et de la chaine, le pic, les voix, QUALITY, et le rendu de la
 * face (images par seconde, temps JS par image, DPR). Rien ne tourne fenetre fermee (l'editeur et la page n'existent
 * plus) ; le detail ne mesure le rendu que tant qu'il est ouvert.
 */
import React, { useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Stage } from '../../scene/renderer';
import { voyExplode } from '../../state/explode';
import { CPU_STAGES, CPU_TOTAL, cpuLevel, cpuStore, cpuText, type CpuFrame } from './cpu';
import { iconPoint } from './LookPanel';

const useCpu = (): CpuFrame | null => useSyncExternalStore(cpuStore.subscribe, cpuStore.get, cpuStore.get);
const useHood = () => useSyncExternalStore(voyExplode.subscribe, voyExplode.get, voyExplode.get);

/** v32 : ECO x2, STD x4, HQ x8 (au-dela de 60 kHz, la moitie) */
const qualityOf = (c: CpuFrame): string => {
  const eff = c.sr > 60000 ? c.os * 2 : c.os;
  return `${eff >= 8 ? 'HQ' : eff >= 4 ? 'STD' : 'ECO'} x${c.os}`;
};

/** une seule fenetre de detail a la fois (la face ou OPEN) */
let detailOpen: 'face' | 'hood' | null = null;
const detailL = new Set<() => void>();
const detail = {
  get: () => detailOpen,
  set(v: 'face' | 'hood' | null): void {
    detailOpen = v;
    detailL.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    detailL.add(fn);
    return () => {
      detailL.delete(fn);
    };
  },
};
const useDetail = () => useSyncExternalStore(detail.subscribe, detail.get, detail.get);

/** Le rendu de la face, mesure seconde par seconde tant que le detail est ouvert. */
function useUiRate(stage: Stage | null, on: boolean): { fps: number; ms: number; dpr: number } | null {
  const [r, setR] = useState<{ fps: number; ms: number; dpr: number } | null>(null);
  useEffect(() => {
    if (!on || !stage) return undefined;
    let f0 = stage.stats.frames;
    let m0 = stage.stats.renderMs;
    let t0 = performance.now();
    const id = window.setInterval(() => {
      const t = performance.now();
      const f = stage.stats.frames;
      const m = stage.stats.renderMs;
      const df = f - f0;
      setR({ fps: (df * 1000) / Math.max(1, t - t0), ms: df > 0 ? (m - m0) / df : 0, dpr: stage.stats.dpr });
      f0 = f;
      m0 = m;
      t0 = t;
    }, 1000);
    return () => window.clearInterval(id);
  }, [on, stage]);
  return on ? r : null;
}

/** le compteur lui-meme : CPU, le total, la barre et son pic */
const Meter: React.FC<{ where: 'face' | 'hood'; style?: React.CSSProperties; btn: React.RefObject<HTMLButtonElement | null> }> = ({ where, style, btn }) => {
  const c = useCpu();
  const open = useDetail();
  // plus rien depuis 2 s (le thread audio ne tourne plus) : --
  const [, tick] = useState(0);
  useEffect(() => {
    const id = window.setInterval(() => tick((n) => n + 1), 1000);
    return () => window.clearInterval(id);
  }, []);
  const live = !!c && performance.now() - c.at < 2000;
  const tot = live && c ? c.s[CPU_TOTAL] : 0;
  const pk = live && c ? Math.max(c.pk, tot) : 0;
  const lv = live ? cpuLevel(Math.max(tot, pk * 0.85)) : 'ok';
  return (
    <button
      ref={btn}
      type="button"
      className={`mm-cpu mm-cpu-${where}`}
      data-level={lv}
      data-on={open === where ? '1' : undefined}
      aria-label={live ? `CPU of this instance: ${cpuText(tot)} percent, peak ${cpuText(pk)}. Click for the detail.` : 'CPU of this instance'}
      aria-expanded={open === where}
      title="CPU of this instance (% of one core). Click for the detail."
      style={style}
      onClick={() => detail.set(open === where ? null : where)}
    >
      <span className="mm-cpu-k">CPU</span>
      <span className="mm-cpu-v">{live ? cpuText(tot) : '--'}</span>
      <span className="mm-cpu-u">%</span>
      <span className="mm-cpu-bar" aria-hidden="true">
        <i style={{ width: `${Math.min(100, tot)}%` }} />
        {live && <b style={{ left: `${Math.min(100, pk)}%` }} />}
      </span>
    </button>
  );
};

/** le detail : les etages, le pic, les voix, QUALITY, le rendu de la face */
const Detail: React.FC<{ stage: Stage | null; style: React.CSSProperties; anchor: React.RefObject<HTMLButtonElement | null> }> = ({ stage, style, anchor }) => {
  const c = useCpu();
  const ui = useUiRate(stage, true);
  const box = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const down = (e: PointerEvent): void => {
      const t = e.target as Node | null;
      if (box.current?.contains(t) || anchor.current?.contains(t)) return;
      detail.set(null);
    };
    // Echap ferme le detail seulement (pas OPEN) : avant les autres ecouteurs
    const key = (e: KeyboardEvent): void => {
      if (e.key !== 'Escape') return;
      e.stopPropagation();
      e.preventDefault();
      detail.set(null);
    };
    window.addEventListener('pointerdown', down, true);
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('pointerdown', down, true);
      window.removeEventListener('keydown', key, true);
    };
  }, [anchor]);
  const live = !!c && performance.now() - c.at < 2000;
  const tot = live && c ? c.s[CPU_TOTAL] : 0;
  return (
    <div ref={box} className="mm-cpu-detail" style={style} role="dialog" aria-label="CPU detail">
      <p className="mm-cpu-title">CPU · THIS INSTANCE</p>
      <ul>
        {CPU_STAGES.map((n, i) => {
          const v = live && c ? c.s[i] : 0;
          return (
            <li key={n}>
              <span>{n}</span>
              <span className="mm-cpu-row-bar" aria-hidden="true">
                <i style={{ width: `${tot > 0 ? Math.min(100, (v / tot) * 100) : 0}%` }} />
              </span>
              <b>{live ? `${v.toFixed(1)} %` : '--'}</b>
            </li>
          );
        })}
        <li className="mm-cpu-tot" data-level={cpuLevel(tot)}>
          <span>TOTAL</span>
          <span />
          <b>{live ? `${tot.toFixed(1)} %` : '--'}</b>
        </li>
      </ul>
      <p className="mm-cpu-line">
        {live && c ? `PEAK ${c.pk.toFixed(1)} % · ${c.voices} VOICE${c.voices === 1 ? '' : 'S'} · ${qualityOf(c)} · ${Math.round(c.sr / 100) / 10} KHZ / ${c.block}` : 'NO AUDIO FROM THE HOST'}
      </p>
      <p className="mm-cpu-line">
        {!ui ? 'FACE ...' : ui.fps < 0.5 ? `FACE IDLE (DRAWN ON DEMAND) · DPR ${ui.dpr}` : `FACE ${ui.fps.toFixed(0)} FPS · ${ui.ms.toFixed(1)} MS / FRAME · DPR ${ui.dpr}`}
      </p>
      <p className="mm-cpu-note">
        % of one core, in real time: 100 % is the whole buffer for this track alone. QUALITY (SOUND, ENGINE) : ECO x2 is about half of STD x4, HQ x8 about twice.
      </p>
    </div>
  );
};

/** Sur la face : a gauche de l'icone SETTINGS (meme projection), capot ferme. */
export const FaceCpuMeter: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const hood = useHood();
  const open = useDetail();
  const btn = useRef<HTMLButtonElement>(null);
  const [pt, setPt] = useState<[number, number] | null>(null);
  useLayoutEffect(() => {
    if (!stage) return undefined;
    const on = (): void => setPt(iconPoint(stage));
    on();
    const t = window.setTimeout(on, 300);
    window.addEventListener('resize', on);
    return () => {
      window.clearTimeout(t);
      window.removeEventListener('resize', on);
    };
  }, [stage]);
  useEffect(() => {
    if (hood !== 'closed' && open === 'face') detail.set(null);
  }, [hood, open]);
  if (!stage || !pt || hood !== 'closed') return null;
  const k = window.innerWidth / 1100;
  return (
    <>
      <Meter
        where="face"
        btn={btn}
        style={{ position: 'fixed', left: pt[0] - 20 * k, top: pt[1], transform: `translate(-100%, -50%) scale(${k})`, transformOrigin: 'right center' }}
      />
      {open === 'face' && (
        <Detail
          stage={stage}
          anchor={btn}
          style={{ position: 'fixed', left: pt[0] - 20 * k, top: pt[1] + 14 * k, transform: `translateX(-100%) scale(${k})`, transformOrigin: 'top right' }}
        />
      )}
    </>
  );
};

/** Dans OPEN : dans l'en-tete, juste avant SETTINGS et la croix. */
export const HoodCpuMeter: React.FC<{ stage: Stage | null }> = ({ stage }) => {
  const open = useDetail();
  const hood = useHood();
  const btn = useRef<HTMLButtonElement>(null);
  useEffect(() => {
    if (hood === 'closed' && open === 'hood') detail.set(null);
  }, [hood, open]);
  return (
    <span className="mm-cpu-hood-wrap">
      <Meter where="hood" btn={btn} />
      {open === 'hood' && <Detail stage={stage} anchor={btn} style={{ position: 'absolute', right: 0, top: 26 }} />}
    </span>
  );
};
