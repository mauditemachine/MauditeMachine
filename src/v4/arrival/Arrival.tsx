/**
 * L'arrivee du site (2026-11-11, Mika : "Quand on arrive sur le site je veux mon logo qui arrive en 3d MAUDITE MACHINE puis
 * se transforme en 2d, ca doit venir en animation de gros a centre, on continue a scroll et on arrive dans le menu et
 * ensuite quand on continue a scroller ya RYTM qui arrive de super zoome a directement la fenetre, que ce soit en mobile
 * ou en desktop ; absolument eblouissant, garde les couleurs du site, la 3d doit etre parfaite").
 *
 * Une couche au-dessus de tout, dans la couleur de la page. Trois tableaux, trois arrets (state/arrival.ts) :
 *
 *   0  LOGO     le logo en relief (arrival/logo3d.ts, son propre canevas) arrive enorme, se pose au centre et devient
 *               plat ; l'entree se joue seule (ENTRANCE_MS), des que la scene de la machine a sa premiere image (la
 *               coquille de demarrage s'efface alors, state/boot.ts). A plat, le DOM prend le relais (deux SVG).
 *   1  MENU     le logo file a sa place dans l'en-tete (ses rectangles, mesures), le fond se leve sur le menu deploye.
 *   2  MACHINE  le fond retombe un instant (le menu se ferme dessous), puis se leve sur le MM-RYTM vu de tres pres, qui
 *               recule jusqu'a son cadrage (scene/renderer.ts arrivalCamera). Au bout, l'arrivee est finie.
 *
 * Le defilement (la molette, le pave tactile, le doigt, les fleches, Espace) mene une position de 0 a 2 : elle suit le
 * geste, puis rejoint l'arret d'apres (ou revient) des qu'il cesse, jamais plus d'un arret a la fois (on ne saute pas le
 * menu). Au menu, s'il defile (le telephone), le geste le fait d'abord defiler ; arrive au bout, il mene a la machine.
 * Une touche du menu, MENU / CLOSE, SKIP ou Echap finissent l'arrivee tout de suite. Sans WebGL pour le logo : le logo
 * plat arrive seul (le meme trajet, en CSS).
 */

import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, useSyncExternalStore } from 'react';
import type { Stage } from '../scene/renderer';
import { appearance } from '../state/appearance';
import { arrival } from '../state/arrival';
import { boot } from '../state/boot';
import { LOGO_TINT, Logo3D, type Rect } from './logo3d';
import { MARK_PATHS, MARK_VIEW, WORD_PATHS, WORD_VIEW } from './logoPaths';
import './arrival.css';

/**
 * L'entree du logo (ms) ; une image lente ne l'avance pas de plus de MAX_STEP_MS (elle ralentit, sans saut), mais elle
 * ne dure jamais plus de ENTRANCE_MAX_MS au mur (un appareil tres lent la voit finir quand meme).
 */
const ENTRANCE_MS = 3600;
const MAX_STEP_MS = 50;
const ENTRANCE_MAX_MS = 9000;
/**
 * Le depart de l'entree : apres la premiere image de la scene (la coquille de demarrage s'efface, READY_MS), des que la
 * page est fluide (CALM images de suite sous CALM_MS : la machine finit de se construire, ses shaders de se compiler,
 * l'entree ne doit pas saccader), au plus tard CALM_MAX_MS apres ; sans premiere image du tout, LATEST_MS.
 */
const START = { READY_MS: 260, CALM: 5, CALM_MS: 34, CALM_MAX_MS: 2200, LATEST_MS: 5000 } as const;
/** Le geste : ce qu'un cran de molette fait avancer (une position de 1 : un tableau), le seuil qui decide de l'arret d'apres. */
const WHEEL_K = 1 / 520;
const SNAP = 0.1;
const IDLE_MS = 170;
/** Le suivi de la position (s) : vers le menu, vers la machine (un recul plus ample). */
const SMOOTH = { menu: 0.3, machine: 0.5 } as const;
/** Le fond qui retombe entre le menu et la machine : opaque de DIP.full a DIP.hold, leve a DIP.clear (parts du trajet). */
const DIP = { full: 0.1, hold: 0.16, clear: 0.44 } as const;

const clamp = (v: number, a: number, b: number): number => (v < a ? a : v > b ? b : v);
const smooth = (a: number, b: number, v: number): number => {
  const t = clamp((v - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};
const easeInOutCubic = (t: number): number => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
const mix = (a: Rect, b: Rect, t: number): Rect => ({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t, w: a.w + (b.w - a.w) * t, h: a.h + (b.h - a.h) * t });

/** Un suivi amorti (la position rejoint sa cible sans a-coup, depart et arrivee doux). */
function damp(cur: number, goal: number, vel: number, time: number, dt: number): [number, number] {
  const omega = 2 / time;
  const x = omega * dt;
  const k = 1 / (1 + x + 0.48 * x * x + 0.235 * x * x * x);
  const change = cur - goal;
  const temp = (vel + omega * change) * dt;
  return [goal + (change + temp) * k, (vel - omega * temp) * k];
}

interface Layout {
  /** le logo pose au centre : le logotype, le mot */
  heroMark: Rect;
  heroWord: Rect;
  /** sa place dans l'en-tete */
  headMark: Rect;
  headWord: Rect;
}

/**
 * Les rectangles du logo (px CSS, dans la couche) : au centre (cote a cote sur un ecran large, le logotype au-dessus du
 * mot au telephone) et dans l'en-tete (mesures sur le vrai logo, etire comme lui).
 */
function layoutOf(root: HTMLElement, W: number, H: number): Layout {
  const box = root.getBoundingClientRect();
  const rectOf = (sel: string, fb: Rect): Rect => {
    const el = root.parentElement?.querySelector(sel);
    const r = el?.getBoundingClientRect();
    return r && r.width > 0 && r.height > 0 ? { x: r.left - box.left, y: r.top - box.top, w: r.width, h: r.height } : fb;
  };
  const headMark = rectOf('.v4-logo .v4-logotype', { x: 28, y: 10.5, w: 30.5, h: 31 });
  const headWord = rectOf('.v4-logo img', { x: 68.5, y: 10.5, w: 118.3, h: 31 });
  const wordAspect = headWord.w / headWord.h;
  const markAspect = headMark.w / headMark.h;
  if (W >= 768) {
    // Cote a cote, comme dans l'en-tete, en grand
    const total = Math.min(W * 0.62, 920, H * 2.6);
    const k = total / (headWord.x + headWord.w - headMark.x);
    const h = headWord.h * k;
    const x0 = (W - total) / 2;
    const y0 = H * 0.47 - h / 2;
    return { heroMark: { x: x0, y: y0, w: headMark.w * k, h }, heroWord: { x: x0 + (headWord.x - headMark.x) * k, y: y0, w: headWord.w * k, h }, headMark, headWord };
  }
  // Au telephone : le logotype au-dessus du mot, le mot sur presque toute la largeur
  const ww = Math.min(W * 0.82, 440);
  const wh = ww / wordAspect;
  const mh = wh * 1.05;
  const mw = mh * markAspect;
  const gap = wh * 0.34;
  const y0 = H * 0.44 - (mh + gap + wh) / 2;
  return { heroMark: { x: (W - mw) / 2, y: y0, w: mw, h: mh }, heroWord: { x: (W - ww) / 2, y: y0 + mh + gap, w: ww, h: wh }, headMark, headWord };
}

interface Props {
  stage: Stage | null;
  getStage: () => Stage | null;
  /** la scene de la machine est la (WebGL) ; sinon l'arrivee s'efface tout de suite */
  ok: boolean;
}

export const Arrival: React.FC<Props> = ({ stage, getStage, ok }) => {
  const phase = useSyncExternalStore(arrival.subscribe, arrival.get, arrival.get);
  const look = useSyncExternalStore(appearance.subscribe, appearance.get, appearance.get);
  const rootRef = useRef<HTMLDivElement>(null);
  const bgRef = useRef<HTMLDivElement>(null);
  const dipRef = useRef<HTMLDivElement>(null);
  const topRef = useRef<HTMLDivElement>(null);
  const glRef = useRef<HTMLDivElement>(null);
  const markRef = useRef<SVGSVGElement>(null);
  const wordRef = useRef<SVGSVGElement>(null);
  const hintRef = useRef<HTMLDivElement>(null);
  const nextRef = useRef<HTMLButtonElement>(null);
  const fadeRef = useRef<HTMLDivElement>(null);
  const skipRef = useRef<HTMLButtonElement>(null);
  /** L'etat de l'animation, hors de React (une image, pas un rendu) */
  const st = useRef({ pos: 0, vel: 0, goal: 0, stop: 0, a: 0, t0: -1, hold: null as number | null, started: false, landed: false, lastInput: 0, speed: 1, cam: -1, camStage: null as Stage | null });
  const [gone, setGone] = useState(false);
  const stageRef = useRef(stage);
  stageRef.current = stage;

  // Sans scene (pas de WebGL) : rien a amener, le site s'affiche
  useEffect(() => {
    if (!ok) arrival.set('done');
  }, [ok]);

  // La fin, d'ou qu'elle vienne (le bout du trajet, SKIP, une touche du menu) : la camera rendue, la couche partie
  useEffect(() => {
    if (phase !== 'done') return;
    getStage()?.finishArrival();
    const root = rootRef.current?.parentElement;
    if (root) delete root.dataset.v4Arrival;
    setGone(true);
  }, [phase, getStage]);

  /** Vers un arret (0 le logo, 1 le menu, 2 la machine). */
  const go = useCallback((stop: number): void => {
    const s = st.current;
    s.goal = clamp(stop, 0, 2);
    s.lastInput = 0;
  }, []);

  useLayoutEffect(() => {
    const root = rootRef.current;
    const host = root?.parentElement;
    if (!root || !host || phase === 'off' || phase === 'done') return undefined;
    const s = st.current;
    let W = root.clientWidth;
    let H = root.clientHeight;
    let L = layoutOf(root, W, H);
    let logo: Logo3D | null = null;
    if (!s.landed) {
      try {
        logo = new Logo3D(look);
        logo.canvas.className = 'v4-arr-canvas';
        glRef.current?.appendChild(logo.canvas);
        logo.resize(W, H, window.devicePixelRatio || 1);
        // La premiere image tout de suite : les shaders se compilent avant le depart de l'entree
        logo.frame(s.a, L.heroWord, L.heroMark);
      } catch {
        // Sans WebGL pour le logo : le logo plat arrive seul (arrival.css, data-flat)
        logo = null;
        s.landed = true;
        s.a = 1;
        root.dataset.flat = '1';
      }
    }
    root.dataset.landed = s.landed ? '1' : '0';
    const dropLogo = (): void => {
      if (!logo) return;
      logo.canvas.remove();
      logo.dispose();
      logo = null;
    };

    const onResize = (): void => {
      W = root.clientWidth;
      H = root.clientHeight;
      L = layoutOf(root, W, H);
      logo?.resize(W, H, window.devicePixelRatio || 1);
      s.cam = -1;
    };
    window.addEventListener('resize', onResize);

    // Le depart de l'entree : la premiere image de la scene (la coquille de demarrage s'efface), au plus tard START_LATEST_MS
    let startTimer = 0;
    let readyAt = -1;
    let calm = 0;
    const offReady = boot.onReady(() => {
      window.clearTimeout(startTimer);
      startTimer = window.setTimeout(() => {
        readyAt = performance.now();
      }, START.READY_MS);
    });
    const latest = window.setTimeout(() => {
      s.started = true;
    }, START.LATEST_MS);

    // Les sondes (?arrival=1 seulement) : figer l'entree a un instant, la finir d'un coup (land), aller a un arret (go),
    // poser la position entre deux arrets (pos, les transitions image par image), lire l'etat
    const probe = new URLSearchParams(window.location.search).get('arrival') === '1';
    if (probe) {
      (window as unknown as { __mmArrival?: unknown }).__mmArrival = {
        hold: (a: number | null): void => {
          s.hold = a;
          if (a !== null) s.started = true;
        },
        go: (stop: number): void => go(stop),
        pos: (v: number): void => {
          s.goal = v;
          s.pos = v;
          s.vel = 0;
          s.lastInput = 0;
        },
        land: (): void => {
          s.hold = null;
          s.started = true;
          s.speed = 50;
        },
        state: () => ({ a: s.a, pos: s.pos, goal: s.goal, stop: s.stop, landed: s.landed, started: s.started }),
      };
    }

    const place = (el: SVGSVGElement | null, r: Rect): void => {
      if (!el) return;
      el.style.transform = `translate3d(${r.x}px, ${r.y}px, 0)`;
      el.style.width = `${r.w}px`;
      el.style.height = `${r.h}px`;
    };

    /** Un bouton de la couche : son opacite ; eteint, il ne prend plus les gestes. */
    const show = (el: HTMLElement | null, o: number): void => {
      if (!el) return;
      el.style.opacity = o.toFixed(3);
      el.style.pointerEvents = o > 0.5 ? 'auto' : 'none';
      el.tabIndex = o > 0.5 ? 0 : -1;
    };

    let raf = 0;
    let last = -1;
    const tick = (now: number): void => {
      raf = requestAnimationFrame(tick);
      const dt = last < 0 ? 0 : Math.min(MAX_STEP_MS, Math.max(0, now - last));
      last = now;
      // 1. L'entree du logo : elle part quand la page est fluide
      if (!s.started && readyAt >= 0) {
        calm = last >= 0 && dt < START.CALM_MS ? calm + 1 : 0;
        if (calm >= START.CALM || now - readyAt > START.CALM_MAX_MS) s.started = true;
      }
      if (s.started && !s.landed) {
        if (s.t0 < 0) s.t0 = now;
        s.a = s.hold !== null ? clamp(s.hold, 0, 0.999) : now - s.t0 > ENTRANCE_MAX_MS ? 1 : Math.min(1, s.a + (dt * s.speed) / ENTRANCE_MS);
        if (s.hold !== null) s.t0 = now;
        if (logo) logo.frame(s.a, L.heroWord, L.heroMark);
        if (s.a >= 1) {
          s.landed = true;
          root.dataset.landed = '1';
          // Le DOM prend le relais a l'image d'apres (le canevas montre la meme image a plat)
          window.setTimeout(dropLogo, 120);
        }
      }
      // 2. La position suit sa cible ; le geste fini, elle rejoint un arret
      if (s.lastInput > 0 && now - s.lastInput > IDLE_MS) {
        const d = s.goal - s.stop;
        s.goal = d > SNAP ? Math.min(2, s.stop + 1) : d < -SNAP ? Math.max(0, s.stop - 1) : s.stop;
        s.lastInput = 0;
      }
      const time = s.goal > 1 || s.pos > 1.001 ? SMOOTH.machine : SMOOTH.menu;
      [s.pos, s.vel] = damp(s.pos, s.goal, s.vel, time, dt / 1000);
      if (Math.abs(s.pos - s.goal) < 0.0015 && Math.abs(s.vel) < 0.01) {
        s.pos = s.goal;
        s.vel = 0;
        if (s.lastInput === 0 && Number.isInteger(s.goal)) s.stop = s.goal;
      }
      // Le logo quitte le centre : la place de l'en-tete est relue (une barre de defilement, une police arrivee entre-temps)
      if (s.pos === 0 && s.goal > 0) L = layoutOf(root, W, H);
      const p1 = clamp(s.pos, 0, 1);
      const p2 = clamp(s.pos - 1, 0, 1);
      // 3. Le tableau (les en-tetes ouvrent et ferment le menu avec lui)
      const want = s.pos >= 1 + DIP.full ? 'machine' : s.pos >= 0.03 ? 'menu' : 'logo';
      if (arrival.get() !== want && arrival.active()) arrival.set(want);
      // 4. Le logo plat : du centre a l'en-tete
      const fly = easeInOutCubic(p1);
      place(markRef.current, mix(L.heroMark, L.headMark, fly));
      place(wordRef.current, mix(L.heroWord, L.headWord, fly));
      const flying = p1 < 0.999;
      const state = flying ? 'fly' : 'rest';
      if (host.dataset.v4Arrival !== state) host.dataset.v4Arrival = state;
      root.dataset.flying = flying ? '1' : '0';
      // 5. Le fond se leve sur le menu ; entre le menu et la machine, un second fond (sous l'en-tete, qui reste la)
      // retombe le temps que le menu se ferme dessous, puis se leve sur la machine
      if (bgRef.current) bgRef.current.style.opacity = (1 - smooth(0.22, 0.9, p1)).toFixed(3);
      const dip = (p2 <= 0 ? 0 : p2 < DIP.hold ? smooth(0, DIP.full, p2) : 1 - smooth(DIP.hold, DIP.clear, p2)).toFixed(3);
      if (dipRef.current) dipRef.current.style.opacity = dip;
      if (topRef.current) topRef.current.style.opacity = dip;
      // Au menu, a l'arret : la couche laisse passer les gestes (le menu se joue) ; ailleurs elle les garde
      const rest = s.pos === 1 && s.goal === 1;
      root.dataset.rest = rest ? '1' : '0';
      if (hintRef.current) hintRef.current.style.opacity = (s.landed ? 1 - smooth(0, 0.12, p1) : 0).toFixed(3);
      const nextO = smooth(0.9, 1, p1) * (1 - smooth(0, 0.06, p2));
      show(nextRef.current, nextO);
      if (fadeRef.current) fadeRef.current.style.opacity = nextO.toFixed(3);
      show(skipRef.current, 1 - smooth(0.1, 0.5, p1));
      // 6. La camera du MM-RYTM : de tres pres a son cadrage
      const u = smooth(DIP.hold, 1, p2);
      const sg = stageRef.current;
      if (sg && (u !== s.cam || sg !== s.camStage)) {
        s.cam = u;
        s.camStage = sg;
        sg.arrivalCamera(u);
      }
      // 7. Le bout du trajet
      if (s.pos >= 2 && s.goal >= 2) arrival.set('done');
    };
    raf = requestAnimationFrame(tick);

    /* ---------------- le geste ---------------- */

    const menuEl = (): HTMLElement | null => host.querySelector<HTMLElement>('.v4-mmenu:not([hidden])');
    /** Le menu, a l'arret, peut-il encore defiler dans ce sens (dy > 0 : vers le bas) ? Le geste est alors pour lui. */
    const menuTakes = (target: EventTarget | null, dy: number): boolean => {
      if (!(s.pos === 1 && s.goal === 1)) return false;
      const m = menuEl();
      if (!m || !(target instanceof Node) || !m.contains(target)) return false;
      if (dy > 0) return m.scrollTop + m.clientHeight < m.scrollHeight - 1;
      return m.scrollTop > 0;
    };
    const push = (d: number, now: number): void => {
      // Pendant l'entree : le geste la presse, il ne la saute pas
      if (!s.landed) {
        s.speed = 3.2;
        return;
      }
      s.goal = clamp(s.goal + d, Math.max(0, s.stop - 1), Math.min(2, s.stop + 1));
      s.lastInput = now;
    };
    const onWheel = (e: WheelEvent): void => {
      if (!arrival.active()) return;
      if (e.ctrlKey) return;
      const unit = e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? H : 1;
      const dy = e.deltaY * unit;
      if (menuTakes(e.target, dy)) return;
      e.preventDefault();
      push(dy * WHEEL_K, performance.now());
    };
    let touch: { id: number; y: number; goal: number; ours: boolean | null } | null = null;
    const onTouchStart = (e: TouchEvent): void => {
      if (!arrival.active() || e.touches.length !== 1) {
        touch = null;
        return;
      }
      touch = { id: e.touches[0].identifier, y: e.touches[0].clientY, goal: s.goal, ours: null };
    };
    const onTouchMove = (e: TouchEvent): void => {
      if (!touch || !arrival.active()) return;
      const t = Array.from(e.touches).find((x) => x.identifier === touch?.id);
      if (!t) return;
      const dy = touch.y - t.clientY;
      // Le sens du geste decide une fois : le menu qui peut defiler le garde, sinon il est pour l'arrivee
      if (touch.ours === null) {
        if (Math.abs(dy) < 6) return;
        touch.ours = !menuTakes(e.target, dy);
        touch.y = t.clientY;
        return;
      }
      if (!touch.ours) return;
      if (e.cancelable) e.preventDefault();
      if (!s.landed) {
        s.speed = 3.2;
        return;
      }
      s.goal = clamp(touch.goal + (touch.y - t.clientY) / (H * 0.5), Math.max(0, s.stop - 1), Math.min(2, s.stop + 1));
      s.lastInput = performance.now();
    };
    const onTouchEnd = (): void => {
      if (touch?.ours && s.lastInput > 0) s.lastInput = 1;
      touch = null;
    };
    const onKey = (e: KeyboardEvent): void => {
      if (!arrival.active() || e.metaKey || e.ctrlKey || e.altKey) return;
      const t = e.target as HTMLElement | null;
      if (t && (t.tagName === 'INPUT' || t.tagName === 'TEXTAREA' || t.isContentEditable)) return;
      const down = e.key === 'ArrowDown' || e.key === 'PageDown' || (e.key === ' ' && !(t && (t.tagName === 'BUTTON' || t.tagName === 'A')));
      const up = e.key === 'ArrowUp' || e.key === 'PageUp';
      if (e.key === 'Escape' || e.key === 'End') {
        e.preventDefault();
        e.stopPropagation();
        arrival.set('done');
      } else if (down || up) {
        e.preventDefault();
        e.stopPropagation();
        if (!s.landed) s.speed = 3.2;
        else go(Math.round(s.goal) + (down ? 1 : -1));
      }
    };
    window.addEventListener('wheel', onWheel, { passive: false, capture: true });
    window.addEventListener('touchstart', onTouchStart, { passive: true, capture: true });
    window.addEventListener('touchmove', onTouchMove, { passive: false, capture: true });
    window.addEventListener('touchend', onTouchEnd, { capture: true });
    window.addEventListener('touchcancel', onTouchEnd, { capture: true });
    window.addEventListener('keydown', onKey, true);

    return () => {
      cancelAnimationFrame(raf);
      window.clearTimeout(startTimer);
      window.clearTimeout(latest);
      offReady();
      window.removeEventListener('resize', onResize);
      window.removeEventListener('wheel', onWheel, { capture: true });
      window.removeEventListener('touchstart', onTouchStart, { capture: true });
      window.removeEventListener('touchmove', onTouchMove, { capture: true });
      window.removeEventListener('touchend', onTouchEnd, { capture: true });
      window.removeEventListener('touchcancel', onTouchEnd, { capture: true });
      window.removeEventListener('keydown', onKey, true);
      dropLogo();
    };
    // L'apparence change (depuis le menu) : la couche se refait dans ses teintes, la position gardee (st)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [look, phase === 'off' || phase === 'done']);

  if (gone || phase === 'off') return null;
  const tint = LOGO_TINT[look];

  return (
    <>
      {/* Le fond d'entre le menu et la machine, sa bande d'en-tete : SOUS l'en-tete (qui garde son logo et ses touches) */}
      <div ref={topRef} className="v4-arr-top" aria-hidden="true" />
      <div
        ref={rootRef}
        className="v4-arr"
        data-landed="0"
        data-flying="1"
        data-rest="0"
        role="region"
        aria-label="Maudite Machine, intro"
        onClick={(e) => {
          // Un clic sur la couche (pas sur ses boutons) : le tableau d'apres
          if ((e.target as HTMLElement).closest('button')) return;
          const s = st.current;
          if (!s.landed) s.speed = 3.2;
          else if (s.stop === 0) go(1);
        }}
      >
        <div ref={bgRef} className="v4-arr-bg" />
        <div ref={dipRef} className="v4-arr-dip" />
        <div ref={glRef} className="v4-arr-gl" aria-hidden="true" />
        <svg ref={markRef} className="v4-arr-logo" viewBox={`0 0 ${MARK_VIEW.w} ${MARK_VIEW.h}`} preserveAspectRatio="none" aria-hidden="true" focusable="false">
          {MARK_PATHS.map((d) => (
            <path key={d.slice(0, 24)} d={d} fill={tint.mark} />
          ))}
        </svg>
        <svg ref={wordRef} className="v4-arr-logo" viewBox={`0 0 ${WORD_VIEW.w} ${WORD_VIEW.h}`} preserveAspectRatio="none" role="img" aria-label="Maudite Machine" focusable="false">
          {WORD_PATHS.map((d) => (
            <path key={d.slice(0, 24)} d={d} fill={tint.word} />
          ))}
        </svg>
        <div ref={hintRef} className="v4-arr-hint" aria-hidden="true">
          <span>Scroll</span>
          <i />
        </div>
        <div ref={fadeRef} className="v4-arr-fade" aria-hidden="true" />
        <button ref={nextRef} type="button" className="v4-arr-next" aria-label="Continue to the MM-RYTM drum machine" onClick={() => go(2)}>
          <span>MM-RYTM</span>
          <i aria-hidden="true" />
        </button>
        <button ref={skipRef} type="button" className="v4-arr-skip" onClick={() => arrival.set('done')}>
          Skip
        </button>
      </div>
    </>
  );
};

export default Arrival;
