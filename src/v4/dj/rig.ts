/**
 * Le MM-DECKS assemble (2026-10-04) : ses groupes, ses objets interactifs
 * (picking du Stage, scene/hit.ts), ses occulteurs et ses animateurs. Le
 * Stage (scene/renderer.ts) le pose a droite du MM-ARP, l'ajoute a la
 * scene, appelle ses animateurs et lui passe le survol ; le rig suit seul
 * son store (dj/state.ts).
 *
 * Groupes :
 * - root : toute la machine (la vue d'ensemble la cache ou la montre) ;
 * - socle : les trois corps, leurs pieds, cadres et fentes (repere du rig) ;
 * - top : le dessus incline commun aux trois blocs (commandes, ecrans,
 *   serigraphie).
 */

import { Group } from 'three';
import type { HotspotDef, Occluder } from '../scene/hit';
import { whenFonts } from '../scene/silk';
import { DjBody } from './body';
import { DJ_GLOW, DjControls } from './controls';
import { djBrowser } from './browser';
import { heardBpm } from './actions';
import { djEngineIfAny } from './engine';
import { DJ_FADERS, DJ_KNOBS, DJ_RECT_KEYS, DJ_ROUND_KEYS } from './layout';
import { vuLeds } from './math';
import { DjScreens } from './screens';
import { DjWaves } from './waveform';
import { DjSilk } from './silk';
import { djState, type DjState } from './state';
import { DECK, DJ_BEZEL, DJ_BODY, DJ_FX, DJ_FX_LABEL, DJ_TILT, DJ_TOP_Y, DJ_UNIT, DJ_W, DJ_X, UNIT_X, timeLabel, unitW, type DjFxId } from './theme';

export interface DjRigOpts {
  mobile: boolean;
  anisotropy: number;
  reduced: () => boolean;
  repaint: () => void;
  invalidate: () => void;
}

export class DjRig {
  readonly root = new Group();
  readonly socle = new Group();
  readonly top = new Group();
  readonly body: DjBody;
  readonly controls: DjControls;
  readonly screens: DjScreens;
  readonly waves: DjWaves;
  readonly silks: DjSilk[];
  private defs: HotspotDef[];
  private unsubs: (() => void)[] = [];
  private lastFx: DjFxId | null = null;
  private prevFx: DjState['fx'] | null = null;
  /** touches tenues (pointeur, clavier) */
  private held = new Set<string>();
  /** VU affiches (decroissance douce) : 4 voies (2 jouent), master gauche et droite */
  private vu = new Float32Array(4);
  private screenAt = 0;

  constructor(private opts: DjRigOpts) {
    this.root.name = 'djRoot';
    this.root.position.x = DJ_X;
    this.socle.name = 'djSocle';
    this.top.name = 'djTop';
    this.top.position.set(0, DJ_TOP_Y, 0);
    this.top.rotation.x = DJ_TILT;
    this.root.add(this.socle, this.top);

    this.body = new DjBody(opts.mobile);
    this.socle.add(this.body.mesh);
    this.controls = new DjControls({ mobile: opts.mobile, castShadow: !opts.mobile });
    this.top.add(...this.controls.objects);
    this.screens = new DjScreens(opts.anisotropy, opts.mobile);
    this.top.add(this.screens.mesh);
    this.waves = new DjWaves();
    this.top.add(this.waves.mesh);
    this.silks = (['a', 'mix', 'b'] as const).map((u) => new DjSilk(u, opts.anisotropy, opts.mobile));
    for (const s of this.silks) this.top.add(s.mesh);

    // Les ecrans des platines se touchent aussi : zoom, recherche dans la piste, scrub (dj/gestures.ts)
    const screenDefs: HotspotDef[] = (['a', 'b'] as const).map((d) => ({
      id: `dj-${d}-screen`,
      kind: 'djscreen' as const,
      layer: this.top,
      shape: 'box' as const,
      x: UNIT_X[d] + DECK.screen.x,
      z: DECK.screen.z,
      hx: DECK.screen.w / 2,
      hz: DECK.screen.d / 2,
      y0: 0,
      y1: DJ_BEZEL.h + 0.01,
      enabled: true,
      dj: `dj-${d}-screen`,
    }));
    this.defs = [...this.controls.hotspots(this.top), ...screenDefs].map((d) => ({ ...d, machine: 'dj' as const }));
    this.syncState(false);
    this.syncScreens();
  }

  get hotspots(): readonly HotspotDef[] {
    return this.defs;
  }

  /** Les volumes pleins : un pave par bloc, sous le dessus incline (repere top). */
  occluders(): Occluder[] {
    const out: Occluder[] = [];
    const hd = DJ_UNIT.d / 2;
    const depth = DJ_BODY.front + DJ_BODY.feet;
    for (const u of ['a', 'mix', 'b'] as const) {
      const hw = unitW(u) / 2;
      out.push({ layer: this.top, min: [UNIT_X[u] - hw, -depth, -hd], max: [UNIT_X[u] + hw, 0, hd], tag: 'dj' });
    }
    return out;
  }

  /** Abonnements, poses par le Stage une fois tout le GL construit. */
  listen(): void {
    this.unsubs.push(djState.subscribe(() => this.syncState(true)));
    this.unsubs.push(djBrowser.subscribe(() => {
      if (this.syncLights()) this.opts.repaint();
    }));
    void whenFonts().then(() => this.redrawText());
  }

  /* ---------- etats ---------- */

  private syncState(paint: boolean): void {
    const s = djState.get();
    let moved = false;
    // L'effet qu'on vient de tourner s'affiche a l'ecran de la table
    if (this.prevFx) for (const f of DJ_FX) if (s.fx[f] !== this.prevFx[f]) this.lastFx = f;
    this.prevFx = s.fx;
    DJ_KNOBS.forEach((k, i) => {
      const t = k.target;
      const v = t.kind === 'eq' ? s.ch[t.ch][t.eq] : t.kind === 'fx' ? s.fx[t.fx] : s.master;
      if (this.controls.setKnob(i, v)) moved = true;
    });
    DJ_FADERS.forEach((f, i) => {
      const t = f.target;
      const v = t.kind === 'channel' ? s.ch[t.ch].fader : t.kind === 'pitch' ? s.deck[t.deck].pitch : s.xfader;
      if (this.controls.setFader(i, v)) moved = true;
    });
    const screens = this.syncScreens();
    const lights = this.syncLights();
    if (!paint) return;
    if (moved && this.controls.knobs.castShadow) this.opts.invalidate();
    // Le moteur la : une image, l'animateur y pose position, zoom et cues des formes d'onde
    else if (moved || screens || lights || djEngineIfAny()) this.opts.repaint();
  }

  /**
   * Les touches allumees : PLAY en jaune quand la platine joue (fixe, Mika
   * n'aimait pas le clignotement), pale chargee en pause ; CUE en orange en
   * pause ; les hot cues poses, le temps choisi, LOAD dont la liste est
   * ouverte, une touche tenue : orange ; les autres a peine.
   */
  private syncLights(): boolean {
    const s = djState.get();
    const b = djBrowser.get();
    let changed = false;
    const paleYellow = [DJ_GLOW.yellow[0] * 0.18, DJ_GLOW.yellow[1] * 0.18, DJ_GLOW.yellow[2] * 0.18];
    DJ_RECT_KEYS.forEach((k, i) => {
      const t = k.target;
      let on = this.held.has(k.id);
      if (t.kind === 'hotcue') on = on || s.deck[t.deck].cues[t.n] !== null;
      else if (t.kind === 'time') on = on || s.time === t.d;
      else if (t.kind === 'load') on = on || (b.open && b.deck === t.deck) || s.deck[t.deck].loading !== null;
      if (this.controls.setKeyGlow(i, on ? DJ_GLOW.orange : DJ_GLOW.dim)) changed = true;
    });
    DJ_ROUND_KEYS.forEach((k, i) => {
      const t = k.target;
      if (t.kind !== 'cue' && t.kind !== 'play') return;
      const ds = s.deck[t.deck];
      const glow =
        t.kind === 'play'
          ? ds.playing
            ? DJ_GLOW.yellow
            : ds.loaded
              ? paleYellow
              : DJ_GLOW.off
          : ds.loaded && !ds.playing
            ? DJ_GLOW.orange
            : this.held.has(k.id)
              ? DJ_GLOW.orange
              : DJ_GLOW.off;
      if (this.controls.setKeyGlow(i, glow, true)) changed = true;
    });
    // Le zero des pitchs
    for (const d of ['a', 'b'] as const) {
      if (this.controls.setLed(this.controls.ledMap.zero[d], s.deck[d].pitch === 0 ? 1 : 0.0)) changed = true;
    }
    return changed;
  }

  /** Une touche s'enfonce ou remonte (pointeur, jumeau, clavier). */
  pressKey(id: string, down: boolean): void {
    if (down) this.held.add(id);
    else this.held.delete(id);
    let moved = false;
    const r = DJ_RECT_KEYS.findIndex((k) => k.id === id);
    if (r >= 0) moved = this.controls.setKeyPress(r, down ? 1 : 0);
    const o = DJ_ROUND_KEYS.findIndex((k) => k.id === id);
    if (o >= 0) moved = this.controls.setKeyPress(o, down ? 1 : 0, true) || moved;
    const lit = this.syncLights();
    if (moved && this.controls.keys.castShadow) this.opts.invalidate();
    else if (moved || lit) this.opts.repaint();
  }

  /**
   * L'animateur : les platines qui tournent, les VU, les anneaux des jogs et
   * les ecrans (dix fois par seconde au plus). 'paint' tant que quelque
   * chose bouge (les platines ne projettent pas d'ombre), false au repos.
   */
  step = (now: number): 'paint' | false => {
    const e = djEngineIfAny();
    if (!e) return false;
    let busy = false;
    let changed = false;
    const st = djState.get();
    for (const d of ['a', 'b'] as const) {
      const p = e.decks[d];
      if (p.playing) busy = true;
      const pos = p.position();
      const ds = st.deck[d];
      if (this.waves.setPeaks(d, p.loadId, p.overview, p.detail)) changed = true;
      if (this.waves.update(d, { loaded: p.loaded && ds.loaded, position: pos, duration: p.duration, window: ds.zoom, cue: ds.cue, cues: ds.cues })) changed = true;
      // 33 tours un tiers : 0.5556 tour par seconde de musique
      const angle = pos * 2 * Math.PI * (100 / 3 / 60);
      if (this.controls.setJog(d, angle)) changed = true;
      // L'anneau : le segment du repere, et une trainee
      const ring = this.controls.ledMap.jog[d];
      const n = ring.length;
      const head = p.loaded ? (((Math.floor((angle / (2 * Math.PI)) * n) % n) + n) % n) : -1;
      for (let k = 0; k < n; k += 1) {
        const back = head < 0 ? n : (head - k + n) % n;
        const v = back === 0 ? 1 : back < 4 ? 0.45 - back * 0.1 : 0;
        if (this.controls.setLed(ring[k], v)) changed = true;
      }
    }
    // VU : la crete, puis une decroissance douce
    const levels = [e.mixer.ch[0].level(), e.mixer.ch[1].level(), ...e.mixer.masterLevels()];
    levels.forEach((lv, i) => {
      const v = Math.max(lv, this.vu[i] * 0.86);
      this.vu[i] = v < 0.002 ? 0 : v;
      if (this.vu[i] > 0) busy = true;
    });
    const cols = [this.controls.ledMap.vu[0], this.controls.ledMap.vu[1], this.controls.ledMap.master[0], this.controls.ledMap.master[1]];
    cols.forEach((col, i) => {
      const lit = vuLeds(this.vu[i], col.length);
      col.forEach((led, k) => {
        if (this.controls.setLed(led, k < lit ? 1 : 0)) changed = true;
      });
    });
    if (now - this.screenAt >= 100 || !busy) {
      this.screenAt = now;
      if (this.syncScreens()) changed = true;
    }
    return busy || changed ? 'paint' : false;
  };

  private syncScreens(): boolean {
    const s = djState.get();
    const e = djEngineIfAny();
    let changed = false;
    for (const d of ['a', 'b'] as const) {
      const ds = s.deck[d];
      const p = e?.decks[d];
      const t = ds.track;
      const pos = p ? p.position() : 0;
      const dur = p?.duration ?? 0;
      const loading = ds.loading !== null;
      const screen = {
        loaded: ds.loaded || loading || ds.error !== null,
        title: t ? t.title : '',
        artist: ds.error ? `ERROR: ${ds.error}` : loading ? `LOADING ${Math.round((ds.loading ?? 0) * 100)}%` : t ? t.artist : '',
        bpm: t?.bpm ?? null,
        key: t?.key ?? '',
        position: pos,
        duration: dur,
        playing: ds.playing,
        pitch: (ds.pitch * ds.range) / 100,
        zoom: ds.zoom,
      };
      if (this.screens.setDeck(d, screen)) changed = true;
      const angle = pos * 2 * Math.PI * (100 / 3 / 60);
      if (this.screens.setJog(d, dur > 0 ? pos / dur : 0, angle, ds.loaded)) changed = true;
    }
    const fx = this.lastFx;
    const label = fx ? `${DJ_FX_LABEL[fx]} ${Math.round(s.fx[fx] * 100)}%` : 'EFFECTS';
    if (this.screens.setFx({ label, time: timeLabel(s.time), bpm: heardBpm(s) })) changed = true;
    return changed;
  }

  /* ---------- survol ---------- */

  /** Survol a la souris (ids du rig) ; true s'il faut une frame. */
  setHover(_id: string | null): boolean {
    return false;
  }

  /** Polices ou logos arrives : la serigraphie se redessine. */
  redrawText(): void {
    for (const s of this.silks) s.draw();
    this.opts.repaint();
  }

  info() {
    return {
      x: this.root.position.x,
      visible: this.root.visible,
      width: DJ_W,
      controls: this.controls.info(),
      silkDraws: this.silks.map((s) => s.draws),
      screenDraws: this.screens.draws,
    };
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
    this.body.dispose();
    this.controls.dispose();
    this.screens.dispose();
    this.waves.dispose();
    for (const s of this.silks) s.dispose();
  }
}
