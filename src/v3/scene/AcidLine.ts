/**
 * Le renderer de /v3 : cree le WebGLRenderer sur son propre canvas, monte
 * les sous-systemes (ruban, perles, anneau, monolithe, fond, grain), tient
 * la boucle, l'intro, la sonde de palier, le picking, et lit le pont
 * (state/bridge.ts) a chaque frame pour declencher ses transitions.
 * create() et dispose() sont re-executables (StrictMode).
 */

import {
  ACESFilmicToneMapping,
  AdditiveBlending,
  BufferAttribute,
  BufferGeometry,
  Mesh,
  MeshStandardMaterial,
  PMREMGenerator,
  SRGBColorSpace,
  Scene,
  ShaderMaterial,
  Vector2,
  Vector3,
  WebGLRenderer,
  type Texture,
  type WebGLRenderTarget,
} from 'three';
import { RoomEnvironment } from 'three/examples/jsm/environments/RoomEnvironment.js';
import { BEADS, BEAD_BY_ID, GROUPS, NEWEST_TRACK, type Bead } from '../data/beads';
import { bridge } from '../state/bridge';
import { knobs, knobUniforms } from '../state/knobs';
import { motion } from '../state/motion';
import { BeatClock } from './beatClock';
import { Beads } from './Beads';
import { CameraRig } from './CameraRig';
import { Monolith } from './Monolith';
import { clamp01, damp, frameAt, makeFrame, type Frame } from './path';
import { Picker, type PickHit } from './pick';
import { Ribbon } from './Ribbon';
import { Sequencer, type SeqMode } from './Sequencer';
import { BACKGROUND_FRAG, GRAIN_FRAG, SCREEN_VERT } from './shaders';
import { Tweens, easeInCubic, easeOutBack, easeOutCubic, linear } from './tween';

export type Tier = 'full' | 'low';

export interface AcidLineOpts {
  host: HTMLElement;
  root: HTMLElement | null;
  isMobile: boolean;
  isTouch: boolean;
  tier: Tier;
  dev: boolean;
  onTier: (t: Tier) => void;
  onIntroDone: () => void;
  onContextLost: () => void;
  onContextRestored: () => void;
  onError: (where: string, message: string) => void;
}

interface FocusSlot {
  id: string | null;
  t: number;
  wrap: number;
  turns: number;
  pos: Vector3;
  frame: Frame;
}

const makeSlot = (): FocusSlot => ({ id: null, t: 0.94, wrap: 0, turns: 2, pos: new Vector3(), frame: makeFrame() });

const INTRO_END = 2.4;

function screenQuad(frag: string, uniforms: Record<string, { value: unknown }>, order: number, additive: boolean): Mesh {
  const g = new BufferGeometry();
  g.setAttribute('position', new BufferAttribute(new Float32Array([-1, -1, 0, 3, -1, 0, -1, 3, 0]), 3));
  const m = new ShaderMaterial({
    vertexShader: SCREEN_VERT,
    fragmentShader: frag,
    uniforms,
    depthTest: false,
    depthWrite: false,
    transparent: additive,
    blending: additive ? AdditiveBlending : undefined,
    toneMapped: false,
  });
  const mesh = new Mesh(g, m);
  mesh.frustumCulled = false;
  mesh.renderOrder = order;
  return mesh;
}

export class AcidLine {
  readonly renderer: WebGLRenderer;
  readonly scene = new Scene();
  readonly rig: CameraRig;
  readonly ribbon: Ribbon;
  readonly beads: Beads;
  readonly seq: Sequencer;
  readonly monolith: Monolith;
  readonly stats = { frames: 0, calls: 0, triangles: 0, tier: 'full' as Tier, avgMs: 0 };
  tier: Tier;
  private canvas: HTMLCanvasElement;
  private opts: AcidLineOpts;
  private env: Texture;
  private envRT: WebGLRenderTarget;
  private room: RoomEnvironment;
  private bg: Mesh;
  private grain: Mesh;
  private picker = new Picker();
  private tweens = new Tweens();
  private clock = new BeatClock();
  private raf = 0;
  private running = false;
  private disposed = false;
  private dirty = true;
  private time = 0;
  private lastNow = -1;
  private bootStart: number;
  private introDone = false;
  private reveal = 0;
  private lampI = 0;
  private flow = 0;
  private dim = 1;
  private idleSince = -1;
  private focusId: string | null = null;
  private slotA = makeSlot();
  private slotB = makeSlot();
  private prevSelected: string | null = null;
  private prevCurrent: string | null = null;
  private prevPlaying = false;
  private prevGroup = bridge.group;
  private prevDrawer = bridge.drawer;
  private prevStep = -1;
  private ku = { tuning: 1, cutoff: 0.5, resonance: 0.25, envmod: 0.5, decay: 0.066, accent: 1 };
  private knobsMoving = false;
  private probeFrames = -1;
  private probeSum = 0;
  private probeCount = 0;
  private lastCallsWrite = 0;
  private width = 1;
  private height = 1;
  private unsubMotion: () => void;
  private onVis: () => void;
  private onLost: (e: Event) => void;
  private onRestored: () => void;

  static create(opts: AcidLineOpts): AcidLine | null {
    try {
      return new AcidLine(opts);
    } catch (e) {
      opts.onError('create', e instanceof Error ? e.message : String(e));
      opts.host.querySelector('canvas.v3-canvas')?.remove();
      return null;
    }
  }

  private constructor(opts: AcidLineOpts) {
    this.opts = opts;
    this.tier = opts.tier;
    this.stats.tier = opts.tier;
    const reduced = motion.get();
    const low = opts.tier === 'low';
    const mobile = opts.isMobile;

    this.canvas = document.createElement('canvas');
    this.canvas.className = 'v3-canvas';
    this.canvas.setAttribute('aria-hidden', 'true');
    opts.host.appendChild(this.canvas);
    this.width = Math.max(1, opts.host.clientWidth);
    this.height = Math.max(1, opts.host.clientHeight);

    this.renderer = new WebGLRenderer({
      canvas: this.canvas,
      antialias: !mobile,
      alpha: false,
      powerPreference: 'high-performance',
    });
    this.renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(this.width, this.height, false);
    this.renderer.setClearColor(0x0c0c0c, 1);
    this.renderer.toneMapping = ACESFilmicToneMapping;
    this.renderer.toneMappingExposure = 1.0;
    this.renderer.outputColorSpace = SRGBColorSpace;

    this.onLost = (e: Event) => {
      e.preventDefault();
      this.stopLoop();
      opts.onContextLost();
    };
    this.onRestored = () => {
      opts.onContextRestored();
      this.dirty = true;
      this.startLoop();
    };
    this.canvas.addEventListener('webglcontextlost', this.onLost, false);
    this.canvas.addEventListener('webglcontextrestored', this.onRestored, false);

    // Environnement : la piece de RoomEnvironment, sans fichier
    const pmrem = new PMREMGenerator(this.renderer);
    this.room = new RoomEnvironment();
    this.envRT = pmrem.fromScene(this.room, 0.04);
    this.env = this.envRT.texture;
    pmrem.dispose();
    this.scene.environment = this.env;

    const metal = new MeshStandardMaterial({ color: 0xffffff, metalness: 1, roughness: 0.32, envMapIntensity: 0.55 });

    const segments = low ? 512 : mobile ? 1024 : 2048;
    this.ribbon = new Ribbon(segments, !mobile);
    this.ribbon.setHaloVisible(!low);
    this.scene.add(this.ribbon.group);

    this.beads = new Beads(metal, mobile ? 1 : 2);
    this.scene.add(this.beads.mesh, this.beads.gates);

    this.seq = new Sequencer(NEWEST_TRACK.t, mobile, !low);
    this.scene.add(this.seq.group);

    this.monolith = new Monolith(metal.clone(), mobile || low ? 1500 : 3000, mobile || low ? 3 : 2);
    this.scene.add(this.monolith.mesh, this.monolith.lamp);

    this.bg = screenQuad(BACKGROUND_FRAG, {}, -10, false);
    this.grain = screenQuad(
      GRAIN_FRAG,
      { uRes: { value: new Vector2(this.width, this.height) }, uTime: { value: 0 } },
      100,
      true
    );
    this.grain.visible = !low;
    this.scene.add(this.bg, this.grain);

    this.rig = new CameraRig(this.width / this.height);
    this.rig.touch = opts.isTouch;
    this.rig.reduced = reduced;
    this.monolith.layout(this.rig.portrait, low);
    this.monolith.raster(() => this.requestRender());

    const now = performance.now() / 1000;
    this.bootStart = now;
    this.rig.intro(now);
    if (reduced) {
      this.finishIntro();
    } else {
      this.tweens.run((v) => (this.reveal = v), 0, 1, 1.4, linear, now, { delay: 0.9, tag: 'reveal' });
      this.tweens.run((v) => (this.lampI = v), 0, 40, 0.6, easeOutCubic, now, { delay: 0.5, tag: 'lamp' });
      this.tweens.run(() => undefined, 0, 1, INTRO_END, linear, now, { tag: 'intro', onDone: () => this.finishIntro() });
    }
    this.syncKnobs(true);
    this.slotA.t = NEWEST_TRACK.t;
    this.slotB.t = NEWEST_TRACK.t;

    // Compilation des shaders pendant la frame noire : aucun a-coup a la revelation
    try {
      this.renderer.compile(this.scene, this.rig.camera);
    } catch (e) {
      opts.onError('compile', e instanceof Error ? e.message : String(e));
    }

    this.unsubMotion = motion.subscribe(() => {
      const r = motion.get();
      this.rig.reduced = r;
      if (r) {
        this.tweens.finishAll();
        this.rig.finishAll();
        this.seq.finish();
        this.beads.popAll();
        if (!this.introDone) this.finishIntro();
      }
      this.requestRender();
    });
    this.onVis = () => {
      if (document.visibilityState === 'hidden') this.stopLoop();
      else {
        this.lastNow = -1;
        this.startLoop();
      }
    };
    document.addEventListener('visibilitychange', this.onVis);

    if (opts.dev) {
      (window as unknown as { __v3: unknown }).__v3 = {
        renderer: this.renderer,
        scene: this.scene,
        state: { bridge, engine: null as unknown },
        stats: this.stats,
        line: this,
      };
    }
    this.startLoop();
  }

  /* ---------------- API appelee par React ---------------- */

  requestRender(): void {
    this.dirty = true;
    this.startLoop();
  }

  resize(w: number, h: number): void {
    if (w < 1 || h < 1) return;
    const wasPortrait = this.rig.portrait;
    this.width = w;
    this.height = h;
    this.renderer.setSize(w, h, false);
    this.rig.setViewport(w / h);
    (this.grain.material as ShaderMaterial).uniforms.uRes.value.set(w, h);
    if (wasPortrait !== this.rig.portrait) this.monolith.layout(this.rig.portrait, this.tier === 'low');
    this.requestRender();
  }

  /** Clic, tap ou touche pendant l'intro : tout saute a sa fin. */
  skipIntro(): void {
    if (this.introDone) return;
    this.tweens.finishAll();
    this.rig.finishAll();
    this.seq.finish();
    this.beads.popAll();
    this.finishIntro();
  }

  private finishIntro(): void {
    if (this.introDone) return;
    this.introDone = true;
    this.reveal = 1;
    this.lampI = 40;
    this.tweens.cancel('reveal');
    this.tweens.cancel('lamp');
    this.tweens.cancel('intro');
    this.beads.popAll();
    if (this.tier === 'full' && !motion.get()) this.probeFrames = 0;
    this.idleSince = performance.now() / 1000;
    this.opts.onIntroDone();
    this.requestRender();
  }

  pick(x: number, y: number, radius: number): PickHit | null {
    this.picker.refresh(this.rig.camera, this.beads.positions, this.width, this.height, performance.now(), true);
    return this.picker.nearest(x, y, radius);
  }

  screenOf(id: string): { x: number; y: number } | null {
    const b = BEAD_BY_ID[id];
    if (!b) return null;
    this.picker.refresh(this.rig.camera, this.beads.positions, this.width, this.height, performance.now());
    return this.picker.screenOf(b.index);
  }

  dragStart(): void {
    this.rig.dragging = true;
    this.rig.fling(0);
  }

  drag(ds: number): void {
    this.rig.dolly(ds, performance.now() / 1000);
    this.requestRender();
  }

  dragEnd(v: number): void {
    this.rig.dragging = false;
    this.rig.fling(v);
    this.requestRender();
  }

  wheel(ds: number): void {
    this.rig.dolly(ds, performance.now() / 1000);
    this.rig.fling(0);
    this.requestRender();
  }

  jumpToT(t: number): void {
    this.rig.jumpTo(t + this.rig.lookAhead, performance.now() / 1000);
    this.requestRender();
  }

  setPointer(nx: number, ny: number): void {
    this.rig.setPointer(nx, ny);
  }

  setTier(t: Tier): void {
    if (t === this.tier) return;
    this.tier = t;
    this.stats.tier = t;
    const low = t === 'low';
    this.renderer.setPixelRatio(low ? 1 : Math.min(window.devicePixelRatio || 1, 1.5));
    this.renderer.setSize(this.width, this.height, false);
    this.ribbon.rebuild(low ? 512 : this.opts.isMobile ? 1024 : 2048);
    this.ribbon.setHaloVisible(!low);
    this.seq.setHalosVisible(!low);
    this.monolith.layout(this.rig.portrait, low);
    this.grain.visible = !low;
    try {
      sessionStorage.setItem('mm_v3_tier', t);
    } catch {
      /* sans persistance */
    }
    this.opts.onTier(t);
    this.requestRender();
  }

  /* ---------------- boucle ---------------- */

  private startLoop(): void {
    if (this.running || this.disposed) return;
    this.running = true;
    this.raf = requestAnimationFrame(this.tick);
  }

  private stopLoop(): void {
    this.running = false;
    cancelAnimationFrame(this.raf);
  }

  private tick = (): void => {
    if (!this.running || this.disposed) return;
    const nowMs = performance.now();
    const dt = this.lastNow < 0 ? 1 / 60 : Math.min(0.05, (nowMs - this.lastNow) / 1000);
    this.lastNow = nowMs;
    try {
      this.frame(dt, nowMs);
    } catch (e) {
      this.opts.onError('frame', e instanceof Error ? e.message : String(e));
      this.stopLoop();
      return;
    }
    const reduced = motion.get();
    if (reduced && !this.hasWork()) {
      this.running = false;
      this.lastNow = -1;
      return;
    }
    this.raf = requestAnimationFrame(this.tick);
  };

  private hasWork(): boolean {
    return this.dirty || this.tweens.alive > 0 || this.rig.busy || this.knobsMoving;
  }

  private syncKnobs(snap: boolean, dt = 1 / 60): void {
    const k = knobUniforms(knobs.get());
    let moving = false;
    for (const key of Object.keys(this.ku) as (keyof typeof k)[]) {
      const target = k[key];
      const cur = this.ku[key];
      const next = snap ? target : damp(cur, target, 12, dt);
      if (Math.abs(target - next) > 1e-4) moving = true;
      this.ku[key] = Math.abs(target - next) <= 1e-4 ? target : next;
    }
    this.knobsMoving = moving;
    const u = this.ribbon.u;
    u.uTuning.value = this.ku.tuning;
    u.uCutoff.value = this.ku.cutoff;
    u.uResonance.value = this.ku.resonance;
    u.uEnvMod.value = this.ku.envmod;
    u.uDecay.value = this.ku.decay;
    u.uAccent.value = this.ku.accent;
    this.ribbon.haloMat.uniforms.uWidthMul.value = 2.5 + 2.5 * this.ku.cutoff;
    this.ribbon.haloMat.uniforms.uAlpha.value = 0.08 + 0.12 * this.ku.cutoff;
    this.ribbon.bodyMat.uniforms.uBright.value = 0.7 + 0.5 * this.ku.cutoff;
  }

  private setSlot(slot: FocusSlot, bead: Bead | null): void {
    slot.id = bead ? bead.id : null;
    slot.t = bead ? bead.t : NEWEST_TRACK.t;
  }

  private writeSlot(slot: FocusSlot, suffix: 'A' | 'B'): void {
    const u = this.ribbon.u;
    const b = slot.id ? BEAD_BY_ID[slot.id] : null;
    if (b) this.beads.positionOf(b.index, slot.pos);
    frameAt(slot.t, this.ku.tuning, slot.frame);
    u[`uWrap${suffix}`].value = slot.wrap;
    u[`uTurns${suffix}`].value = slot.turns;
    u[`uFocusT${suffix}`].value = slot.t;
    (u[`uFocusPos${suffix}`].value as Vector3).copy(slot.pos);
    (u[`uFocusN1${suffix}`].value as Vector3).copy(slot.frame.n1);
    (u[`uFocusN2${suffix}`].value as Vector3).copy(slot.frame.n2);
    (u[`uFocusTan${suffix}`].value as Vector3).copy(slot.frame.T);
  }

  /** Diffe le pont : selection, courant, lecture, groupe, drawer. */
  private diffBridge(now: number, reduced: boolean): void {
    const focusId = bridge.currentId ?? bridge.selectedId;
    if (focusId !== this.focusId) {
      const bead = focusId ? BEAD_BY_ID[focusId] : null;
      // L'ancien enroulement se defait (slot B) pendant que le nouveau se fait (slot A)
      this.slotB.id = this.slotA.id;
      this.slotB.t = this.slotA.t;
      this.slotB.turns = this.slotA.turns;
      this.slotB.wrap = this.slotA.wrap;
      this.slotB.pos.copy(this.slotA.pos);
      if (this.slotB.wrap > 0) {
        this.tweens.run((v) => (this.slotB.wrap = v), this.slotB.wrap, 0, reduced ? 0 : 0.4, easeInCubic, now, { tag: 'wrapB' });
      }
      this.tweens.cancel('wrapA');
      this.setSlot(this.slotA, bead);
      this.slotA.wrap = 0;
      if (bead && bead.playable) {
        this.tweens.run((v) => (this.slotA.wrap = v), 0, 1, reduced ? 0 : 0.7, easeOutBack(1.2), now, {
          delay: reduced ? 0 : 0.15,
          tag: 'wrapA',
        });
      }
      this.seq.travelTo(bead ? bead.t : NEWEST_TRACK.t, now, reduced);
      this.focusId = focusId;
    }

    if (bridge.selectedId !== this.prevSelected) {
      if (bridge.selectedId) this.rig.focusOn(now);
      else this.rig.hold();
      this.prevSelected = bridge.selectedId;
    }

    if (bridge.currentId !== this.prevCurrent) {
      this.prevCurrent = bridge.currentId;
      if (!bridge.currentId) {
        this.clock.stop();
        this.tweens.run((v) => (this.flow = v), this.flow, 0, reduced ? 0 : 0.4, easeOutCubic, now, { tag: 'flow' });
      }
    }
    if (bridge.playing !== this.prevPlaying) {
      this.prevPlaying = bridge.playing;
      if (bridge.playing) this.clock.start(performance.now());
      else this.clock.stop();
      this.tweens.run((v) => (this.flow = v), this.flow, bridge.playing ? 1 : 0, reduced ? 0 : 0.4, easeOutCubic, now, {
        tag: 'flow',
      });
    }

    if (bridge.group !== this.prevGroup) {
      this.prevGroup = bridge.group;
      const sel = bridge.selectedId ? BEAD_BY_ID[bridge.selectedId] : null;
      if (bridge.group === 4 && (!sel || sel.kind !== 'mixtape')) {
        const hub = GROUPS[4].find((b) => b.mixtape?.number === 37) || GROUPS[4][0];
        this.beads.positionOf(hub.index, this.rig.codaLook);
        this.rig.coda(now);
      }
    }

    if (bridge.drawer !== this.prevDrawer) {
      const info = bridge.drawer === 'info';
      const open = bridge.drawer !== 'none';
      this.tweens.run((v) => (this.rig.pull = v), this.rig.pull, info && !this.opts.isMobile ? 1 : 0, reduced ? 0 : 0.6, easeOutCubic, now, {
        tag: 'pull',
      });
      this.tweens.run((v) => (this.dim = v), this.dim, open ? 0.6 : 1, reduced ? 0.15 : 0.35, easeOutCubic, now, { tag: 'dim' });
      this.prevDrawer = bridge.drawer;
    }
  }

  private seqMode(): SeqMode {
    if (!this.introDone) return 'boot';
    switch (bridge.state) {
      case 'loading':
        return 'loading';
      case 'playing':
        return 'playing';
      case 'paused':
        return 'paused';
      default:
        return 'idle';
    }
  }

  private frame(dt: number, nowMs: number): void {
    const reduced = motion.get();
    const now = nowMs / 1000;
    if (!reduced) this.time += dt;
    this.tweens.update(now);
    this.syncKnobs(false, dt);
    this.diffBridge(now, reduced);

    const bootT = now - this.bootStart;
    const reveal = this.introDone ? 1 : this.reveal;

    // Perles et portes
    this.beads.update(dt, this.time, nowMs, this.ku, {
      hoverId: bridge.hoverId,
      selectedId: bridge.selectedId,
      currentId: bridge.currentId,
      playing: bridge.playing,
      group: bridge.group,
      noticeAt: bridge.noticeAt,
      noticeId: bridge.noticeId,
      reveal,
      reduced,
      camPos: this.rig.camera.position,
    });

    // Slots d'enroulement (suivent TUNING et le tremblement)
    const focusBead = this.slotA.id ? BEAD_BY_ID[this.slotA.id] : null;
    this.slotA.turns = focusBead && bridge.currentId === focusBead.id ? 2 + 6 * bridge.progress : 2;
    this.writeSlot(this.slotA, 'A');
    this.writeSlot(this.slotB, 'B');

    // Anneau
    const step = this.clock.step(nowMs);
    const mode = this.seqMode();
    this.seq.update(dt, this.time, now, this.ku, {
      mode,
      progress: bridge.currentId ? bridge.progress : 0,
      step,
      reduced,
      bootT,
      ledsOff: !!focusBead && !focusBead.playable,
    });
    const shownStep = mode === 'playing' ? step : -1;
    if (shownStep !== this.prevStep) {
      this.prevStep = shownStep;
      if (this.opts.root) this.opts.root.dataset.v3Step = String(shownStep);
    }

    // Camera : le plan Focus suit la perle SELECTIONNEE (pas forcement celle qui joue)
    const sel = bridge.selectedId ? BEAD_BY_ID[bridge.selectedId] : null;
    if (sel) this.beads.positionOf(sel.index, this.rig.focusPos);
    this.rig.update(dt, now, this.time, this.ku.tuning);

    // Lampe du nom (fondu a l'ouverture)
    this.monolith.lamp.intensity = this.introDone ? 40 : this.lampI;

    // Ghost : 12 s sans lecture, un courant fantome du nom vers maintenant en 6 s
    let ghostOn = 0;
    let ghostT = 0;
    if (bridge.currentId || !this.introDone) this.idleSince = -1;
    else if (this.idleSince < 0) this.idleSince = now;
    if (this.idleSince >= 0 && !reduced) {
      const idle = now - this.idleSince;
      if (idle > 12) {
        ghostOn = 1;
        ghostT = ((idle - 12) % 6) / 6;
      }
    }

    // Uniforms du ruban
    const u = this.ribbon.u;
    u.uTime.value = this.time;
    u.uFlow.value = this.flow;
    u.uReveal.value = reveal;
    u.uDim.value = this.dim;
    u.uGhostOn.value = ghostOn;
    u.uGhostT.value = ghostT;
    u.uWrapGlow.value = reduced && bridge.playing ? 1 : 0;
    (this.grain.material as ShaderMaterial).uniforms.uTime.value = reduced ? 0 : this.time;

    this.renderer.render(this.scene, this.rig.camera);
    this.dirty = false;
    this.stats.frames += 1;
    this.stats.calls = this.renderer.info.render.calls;
    this.stats.triangles = this.renderer.info.render.triangles;
    if (this.opts.dev && this.opts.root && nowMs - this.lastCallsWrite > 1000) {
      this.lastCallsWrite = nowMs;
      this.opts.root.dataset.v3Calls = String(this.stats.calls);
    }

    // Sonde de palier : moyenne des frames 30..90 apres l'intro
    if (this.probeFrames >= 0) {
      this.probeFrames += 1;
      if (this.probeFrames >= 30 && this.probeFrames < 90) {
        this.probeSum += dt * 1000;
        this.probeCount += 1;
      } else if (this.probeFrames >= 90) {
        const avg = this.probeCount ? this.probeSum / this.probeCount : 0;
        this.stats.avgMs = avg;
        this.probeFrames = -1;
        if (avg > 24) this.setTier('low');
      }
    }
  }

  /* ---------------- fin de vie ---------------- */

  dispose(): void {
    if (this.disposed) return;
    this.disposed = true;
    this.stopLoop();
    this.tweens.clear();
    this.unsubMotion();
    document.removeEventListener('visibilitychange', this.onVis);
    this.canvas.removeEventListener('webglcontextlost', this.onLost);
    this.canvas.removeEventListener('webglcontextrestored', this.onRestored);
    this.scene.environment = null;
    this.ribbon.dispose();
    this.beads.dispose();
    this.seq.dispose();
    this.monolith.dispose();
    for (const q of [this.bg, this.grain]) {
      q.geometry.dispose();
      (q.material as ShaderMaterial).dispose();
    }
    // Le render target libere sa texture (un env.dispose() separe la
    // detacherait avant, et la texture GPU fuirait) ; la piece de
    // RoomEnvironment a sa propre geometrie a liberer
    this.envRT.dispose();
    this.room.dispose();
    this.scene.clear();
    if (this.opts.dev) {
      // Revue : la memoire GPU doit lire 0 / 0 ici, avant la perte de contexte
      (window as unknown as { __v3LastDispose: unknown }).__v3LastDispose = this.memory();
      delete (window as unknown as { __v3?: unknown }).__v3;
    }
    this.renderer.dispose();
    this.renderer.forceContextLoss();
    this.canvas.remove();
  }

  /** DEV : memoire GPU encore allouee (doit lire 0 geometries / 0 textures avant la perte de contexte). */
  memory(): { geometries: number; textures: number } {
    return { geometries: this.renderer.info.memory.geometries, textures: this.renderer.info.memory.textures };
  }

  get beadList(): Bead[] {
    return BEADS;
  }
}
