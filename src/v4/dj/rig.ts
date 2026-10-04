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
import { clock } from '../audio/clock';
import type { HotspotDef, Occluder } from '../scene/hit';
import { whenFonts } from '../scene/silk';
import { DjBody } from './body';
import { DJ_GLOW, DjControls } from './controls';
import { djBrowser } from './browser';
import { djSynced, heardBpm, syncBpm } from './actions';
import { djEngineIfAny } from './engine';
import { DJ_FADERS, DJ_KNOBS, DJ_RECT_KEYS, DJ_ROUND_KEYS } from './layout';
import { toDbfs, vuLit, VU_DB } from './math';
import { DjScreens } from './screens';
import { DjWaves } from './waveform';
import { DjSilk } from './silk';
import { LICENSE_LABEL } from './soundcloud';
import { djState, type DjState, type DjTrack } from './state';
import { DECK, DJ_BEZEL, DJ_BODY, DJ_CHANNELS, DJ_CHANNELS_MAX, DJ_DECKS, DJ_FX, DJ_FX_LABEL, DJ_TILT, DJ_TOP_Y, DJ_UNIT, DJ_UNITS_ON, DJ_W, DJ_X, UNIT_X, timeLabel, unitW, type DjFxId } from './theme';
import type { DjSyncLight } from './screens';

export interface DjRigOpts {
  mobile: boolean;
  anisotropy: number;
  reduced: () => boolean;
  repaint: () => void;
  invalidate: () => void;
}

/** L'artiste, et pour SoundCloud la source et la licence (credit exige par l'API et par la licence). */
const credit = (t: DjTrack): string => (t.source === 'soundcloud' ? `${t.artist} / SOUNDCLOUD ${LICENSE_LABEL[t.license ?? ''] ?? ''}`.trim() : t.artist);

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
  /**
   * Les vumetres (2026-10-04, Mika : "precis par rapport au volume de
   * chacun") : le niveau affiche (dBFS), la crete maintenue et son instant ;
   * les voies, puis master gauche et droite.
   */
  private vu = Array.from({ length: DJ_CHANNELS_MAX + 2 }, () => ({ db: -Infinity, hold: -Infinity, at: 0 }));
  private vuAt = 0;
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
    this.controls = new DjControls({ mobile: opts.mobile, castShadow: !opts.mobile, anisotropy: opts.anisotropy });
    this.top.add(...this.controls.objects);
    this.screens = new DjScreens(opts.anisotropy, opts.mobile);
    this.top.add(this.screens.mesh);
    this.waves = new DjWaves();
    this.top.add(this.waves.mesh);
    this.silks = DJ_UNITS_ON.map((u) => new DjSilk(u, opts.anisotropy, opts.mobile));
    for (const s of this.silks) this.top.add(s.mesh);

    // Les ecrans des platines se touchent aussi : zoom, recherche dans la piste, scrub (dj/gestures.ts)
    const screenDefs: HotspotDef[] = DJ_DECKS.map((d) => ({
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
    for (const u of DJ_UNITS_ON) {
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
    // RUN et STOP des machines : SYNC peut s'y caler (l'ecran rond du jog le montre)
    this.unsubs.push(clock.subscribe(() => {
      if (this.syncScreens()) this.opts.repaint();
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
      const v = t.kind === 'channel' ? s.ch[t.ch].fader : s.deck[t.deck].pitch;
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
    let changed = false;
    const paleYellow = [DJ_GLOW.yellow[0] * 0.18, DJ_GLOW.yellow[1] * 0.18, DJ_GLOW.yellow[2] * 0.18];
    DJ_RECT_KEYS.forEach((k, i) => {
      const t = k.target;
      let on = this.held.has(k.id);
      if (t.kind === 'hotcue') on = on || s.deck[t.deck].cues[t.n] !== null;
      else if (t.kind === 'time') on = on || s.time === t.d;
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
    for (const d of DJ_DECKS) {
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
    // Cache (une autre machine utilisee) : rien a dessiner, meme si la batterie passe par la table
    if (!e || !this.root.visible) return false;
    let busy = false;
    let changed = false;
    const st = djState.get();
    for (const d of DJ_DECKS) {
      const p = e.decks[d];
      if (p.playing) busy = true;
      const pos = p.position();
      const ds = st.deck[d];
      if (this.waves.setPeaks(d, p.loadId, p.overview, p.detail)) changed = true;
      const spb = ds.track?.bpm ? 60 / ds.track.bpm : 0;
      if (this.waves.update(d, { loaded: p.loaded && ds.loaded, position: pos, duration: p.duration, window: ds.zoom, cue: ds.cue, cues: ds.cues, beat: ds.beat, spb })) changed = true;
      // 33 tours un tiers : 0.5556 tour par seconde de musique
      const angle = pos * 2 * Math.PI * (100 / 3 / 60);
      if (this.controls.setJog(d, angle)) changed = true;
    }
    /*
     * VU, la balistique d'un crete-metre : attaque instantanee (la crete
     * mesuree s'affiche telle quelle), retour de 20 dB par seconde, et la
     * crete la plus haute maintenue une seconde sur son segment avant de
     * redescendre au meme pas. Aucune compensation : ils disent ce qui sort
     * de chaque voie apres son fader, et du master.
     */
    const dt = this.vuAt > 0 ? Math.min(0.1, (now - this.vuAt) / 1000) : 0;
    this.vuAt = now;
    const floor = VU_DB[0] - 6;
    const levels = [...e.mixer.ch.slice(0, DJ_CHANNELS).map((c) => c.level()), ...e.mixer.masterLevels()];
    const meters = [...this.controls.ledMap.vu.map((col, i) => ({ col, m: this.vu[i] })), ...this.controls.ledMap.master.map((col, i) => ({ col, m: this.vu[DJ_CHANNELS_MAX + i] }))];
    meters.forEach(({ col, m }, i) => {
      const peak = toDbfs(levels[i] ?? 0);
      m.db = Math.max(peak, m.db - 20 * dt);
      if (m.db < floor) m.db = -Infinity;
      if (peak >= m.hold) {
        m.hold = peak;
        m.at = now;
      } else if (now - m.at > 1000) {
        m.hold = Math.max(m.db, m.hold - 20 * dt);
      }
      if (m.hold < floor) m.hold = -Infinity;
      if (m.db > -Infinity || m.hold > -Infinity) busy = true;
      const lit = vuLit(m.db);
      const held = vuLit(m.hold) - 1;
      col.forEach((led, k) => {
        if (this.controls.setLed(led, k < lit || k === held ? 1 : 0)) changed = true;
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
    for (const d of DJ_DECKS) {
      const ds = s.deck[d];
      const p = e?.decks[d];
      const t = ds.track;
      const pos = p ? p.position() : 0;
      const dur = p?.duration ?? 0;
      const loading = ds.loading !== null;
      const screen = {
        loaded: ds.loaded || loading || ds.error !== null,
        title: t ? t.title : '',
        artist: ds.error ? `ERROR: ${ds.error}` : loading ? `LOADING ${Math.round((ds.loading ?? 0) * 100)}%` : t ? credit(t) : '',
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
      // SYNC : cale (orange), calable (os), ou rien a suivre (pale)
      const sync: DjSyncLight = !ds.loaded || !t?.bpm || syncBpm(d, s) === null ? 'off' : djSynced(d, s) ? 'on' : 'ready';
      if (this.screens.setJog(d, dur > 0 ? pos / dur : 0, angle, ds.loaded, sync)) changed = true;
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
