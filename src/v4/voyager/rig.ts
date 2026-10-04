/**
 * Le MM-VOYAGER assemble (2026-10-03) : ses groupes, ses objets
 * interactifs (pour le picking du Stage, scene/hit.ts), ses occulteurs,
 * son ouverture et ses animateurs. Le Stage (scene/renderer.ts) le pose a
 * droite de la 808, l'ajoute a la scene, appelle ses animateurs et lui
 * passe le survol ; le rig suit seul ses stores : potards (params), arpege
 * (arp), tempo (pattern), capot (voyExplode), ecran (msg).
 *
 * Groupes :
 * - root : toute la machine (la vue d'ensemble la cache ou la montre) ;
 * - socle : joues, bac ; ne bouge jamais ;
 * - pcb : la carte (celle de la 808, MM-VOYAGER en serigraphie), a plat
 *   dans le bac, cachee capot ferme ; sans les puces des pages depuis le
 *   2026-10-04 : la plaque des TWEAKS a leur place (tweaks.ts) ;
 * - lid : le capot (plateau, son ecran, ses pads et boutons, les potards
 *   des deux plans) ; OPEN le souleve (scene/explode.ts, VOY_EXPLODE) ;
 * - panel : enfant du capot, incline : sa serigraphie.
 */

import { Group, type Object3D } from 'three';
import { context } from '../audio/drums';
import { pattern } from '../audio/pattern';
import type { HotspotDef, Occluder } from '../scene/hit';
import { Explode, type ExplodeCfg } from '../scene/explode';
import { Pcb } from '../scene/pcb';
import type { Tweens } from '../scene/tween';
import { voyExplode } from '../state/explode';
import { EXPLODE, PCB, PCB_TURN, type SectionId } from '../theme';
import { arp } from './arp';
import { VoyBackPlate } from './backplate';
import { VoyBody } from './body';
import { CHORDS } from './chords';
import { VoyKnobs } from './knobs';
import { VoyLcd } from './lcd';
import { voyMsg } from './msg';
import { VoyKeys } from './pads';
import { MODES, NOTES, RANGES, RATES, VOY_FACE_KNOBS, VOY_TWEAKS, morphPos, notesCount, stepIndex, voyParams } from './params';
import { editor } from '../state/editor';
import { presetMode, type PresetKey } from '../state/presetMode';
import { presets } from '../state/presets';
import { seq } from './seq';
import { VoySilk } from './silk';
import { VoyTweaks } from './tweaks';
import { VOY_BODY, VOY_COPY, VOY_EXPLODE, VOY_LCD, VOY_LID_W, VOY_PANEL, VOY_PCB_Y, VOY_X } from './theme';

export interface VoyRigOpts {
  mobile: boolean;
  anisotropy: number;
  /** tweens qui refont la carte d'ombre (pads et boutons qui s'enfoncent) */
  tweens: Tweens;
  /** tweens sans ombre (puces soulevees) */
  paintTweens: Tweens;
  reduced: () => boolean;
  repaint: () => void;
  invalidate: () => void;
}


/** Prisme convexe : un polygone (z, y) etire sur x0..x1, en demi-espaces et coins. */
function prism(layer: Object3D, poly: [number, number][], x0: number, x1: number): Occluder {
  const planes: number[] = [-1, 0, 0, x0, 1, 0, 0, -x1];
  const n = poly.length;
  let area = 0;
  for (let i = 0; i < n; i += 1) {
    const a = poly[i];
    const b = poly[(i + 1) % n];
    area += a[0] * b[1] - b[0] * a[1];
  }
  const sgn = area > 0 ? 1 : -1;
  for (let i = 0; i < n; i += 1) {
    const [z0, y0] = poly[i];
    const [z1, y1] = poly[(i + 1) % n];
    // Normale exterieure dans (z, y) : a droite d'un polygone direct
    let nz = (y1 - y0) * sgn;
    let ny = -(z1 - z0) * sgn;
    const l = Math.hypot(nz, ny) || 1;
    nz /= l;
    ny /= l;
    planes.push(0, ny, nz, -(ny * y0 + nz * z0));
  }
  const corners: number[] = [];
  for (const x of [x0, x1]) for (const [z, y] of poly) corners.push(x, y, z);
  return { layer, planes, corners, tag: 'voy' };
}

export class VoyagerRig {
  readonly root = new Group();
  readonly socle = new Group();
  readonly lid = new Group();
  readonly panel = new Group();
  readonly pcbGroup = new Group();
  readonly body: VoyBody;
  /** la serigraphie de la face arriere */
  readonly back: VoyBackPlate;
  readonly keys: VoyKeys;
  readonly knobs: VoyKnobs;
  readonly deckSilk: VoySilk;
  readonly panelSilk: VoySilk;
  readonly lcd: VoyLcd;
  readonly pcb: Pcb;
  /** sous le capot, sur la carte : les TWEAKS (2026-10-04) */
  readonly tweaks: VoyTweaks;
  readonly explode: Explode;
  /** ancres de la trace : plus de puces sur la carte du MM-ARP (2026-10-04), les sections s'ouvrent sans trace depuis elle */
  readonly anchors = new Map<SectionId, HotspotDef>();
  private defs: HotspotDef[] = [];
  /** les TWEAKS ne repondent que capot ouvert */
  private tweakDefs: HotspotDef[] = [];
  private unsubs: (() => void)[] = [];
  private detach: () => void = () => undefined;
  private explodeGoal = false;
  private lastSeq = -1;
  private playing = -1;
  private bpm = 0;
  readonly cfg: ExplodeCfg;

  constructor(private opts: VoyRigOpts) {
    const B = VOY_BODY;
    this.root.name = 'voyagerRoot';
    this.root.position.x = VOY_X;
    this.socle.name = 'voySocle';
    this.lid.name = 'voyLidGroup';
    this.panel.name = 'voyPanelGroup';
    this.pcbGroup.name = 'voyPcbGroup';
    this.lid.position.set(0, B.deckY, 0);
    this.panel.position.set(0, VOY_PANEL.cy, VOY_PANEL.cz);
    this.panel.rotation.x = VOY_PANEL.angle;
    this.pcbGroup.position.set(0, VOY_PCB_Y, 0);
    this.pcbGroup.rotation.y = PCB_TURN;
    this.pcbGroup.visible = false;
    this.root.add(this.socle, this.pcbGroup, this.lid);
    this.lid.add(this.panel);

    this.body = new VoyBody(opts.mobile);
    this.back = new VoyBackPlate(opts.mobile, opts.anisotropy);
    this.socle.add(this.body.cheeks, this.body.tray, this.back.mesh);
    this.lid.add(this.body.lid);

    this.deckSilk = new VoySilk('deck', opts.anisotropy);
    this.panelSilk = new VoySilk('panel', opts.anisotropy);
    this.lid.add(this.deckSilk.mesh);
    this.panel.add(this.panelSilk.mesh);

    this.keys = new VoyKeys({ tweens: opts.tweens, reduced: opts.reduced, repaint: opts.repaint, mobile: opts.mobile });
    this.lid.add(this.keys.pads, this.keys.buttons, this.keys.halos, this.keys.runLed);
    this.knobs = new VoyKnobs({ mobile: opts.mobile, castShadow: !opts.mobile });
    this.lid.add(this.knobs.mesh);
    this.lcd = new VoyLcd(opts.anisotropy);
    this.lid.add(this.lcd.bezel, this.lcd.glass);

    this.pcb = new Pcb(opts.mobile, opts.anisotropy, { model: `${VOY_COPY.model} R1.0`, variant: 'voy', chips: false });
    this.pcbGroup.add(this.pcb.board, this.pcb.parts);
    // La plaque des TWEAKS pousse avec les composants de la carte (pcb.parts) a l'ouverture
    this.tweaks = new VoyTweaks({ mobile: opts.mobile, anisotropy: opts.anisotropy });
    this.pcb.parts.add(this.tweaks.group);

    this.cfg = {
      lift: VOY_EXPLODE.lift,
      slideZ: VOY_EXPLODE.slideZ,
      tiltOpenDeg: VOY_EXPLODE.tiltOpenDeg,
      pcbRise: VOY_EXPLODE.pcbRise,
      plateauY: B.deckY,
      pcbY: VOY_PCB_Y,
      tilt: 0,
    };
    this.explode = new Explode({ plateau: this.lid, pcb: this.pcbGroup, parts: this.pcb.parts }, (open) => voyExplode.settle(open), this.cfg);

    // Objets interactifs, dans l'ordre de tabulation des jumeaux : pads, boutons, potards, TWEAKS
    const keyDefs = this.keys.hotspots(this.lid);
    // Les presets sur l'ecran (2026-10-04) : le haut l'ouvre ; en mode presets, gauche et droite, et quatre touches en bas
    const L = VOY_LCD;
    const lcdBox = (key: PresetKey, u0: number, u1: number, v0: number, v1: number): HotspotDef => ({
      id: `vlcd-${key}`,
      kind: 'vlcd',
      lcd: key,
      layer: this.lid,
      shape: 'box',
      x: L.x - L.w / 2 + ((u0 + u1) / 2) * L.w,
      z: L.z - L.d / 2 + ((v0 + v1) / 2) * L.d,
      hx: ((u1 - u0) / 2) * L.w,
      hz: ((v1 - v0) / 2) * L.d,
      y0: L.bezel.h - 0.005,
      y1: L.bezel.h + 0.03,
      enabled: key === 'open',
    });
    const band = 0.72;
    const lcdDefs = [
      lcdBox('open', 0, 1, 0, 1),
      lcdBox('prev', 0, 0.5, 0, band),
      lcdBox('next', 0.5, 1, 0, band),
      ...(['save', 'name', 'del', 'exit'] as const).map((k, i) => lcdBox(k, i / 4, (i + 1) / 4, band, 1)),
    ];
    this.defs = [...keyDefs, ...lcdDefs, ...this.knobs.hotspots(this.panel, this.lid), ...this.tweaks.hotspots()].map((d) => ({ ...d, machine: 'voy' as const }));
    // Les copies portent l'etat : retrouver les TWEAKS dans la liste finale
    this.tweakDefs = this.defs.filter((d) => d.layer === this.tweaks.top);

    this.syncKnobs();
    this.syncArp();
    this.keys.setEditing(editor.get() === 'voy');
  }

  get hotspots(): readonly HotspotDef[] {
    return this.defs;
  }

  /** Les volumes pleins : bac, joues, capot (plateau et panneau), carte. */
  occluders(): Occluder[] {
    const B = VOY_BODY;
    const hw = B.w / 2;
    const iw = VOY_LID_W / 2;
    const top = B.deckY - B.lidT;
    const out: Occluder[] = [];
    // Le bac sous le capot
    out.push({ layer: this.socle, min: [-hw + B.cheek, B.feet, -B.d / 2], max: [hw - B.cheek, top, B.d / 2], tag: 'voy' });
    // Les joues : l'avant (sous le nez) et l'arriere (le long de la pente), deux prismes convexes chacune
    const yF = B.deckY + 0.16;
    const yB = B.topY + 0.16;
    for (const [x0, x1] of [
      [-hw, -hw + B.cheek],
      [hw - B.cheek, hw],
    ]) {
      out.push(prism(this.socle, [[B.d / 2, B.feet], [B.d / 2, yF], [B.bendZ, yF], [B.bendZ, B.feet]], x0, x1));
      out.push(prism(this.socle, [[B.bendZ, B.feet], [B.bendZ, yF], [B.backZ, yB], [-B.d / 2, yB], [-B.d / 2, B.feet]], x0, x1));
    }
    // Le capot : le plateau (repere du capot), le panneau (le sien), le rebord arriere
    out.push({ layer: this.lid, min: [-iw, -B.lidT, B.bendZ], max: [iw, 0, B.d / 2], tag: 'voy' });
    out.push({ layer: this.panel, min: [-iw, -B.lidT, -VOY_PANEL.len / 2], max: [iw, 0, VOY_PANEL.len / 2], tag: 'voy' });
    // La carte (repere de la carte, tournee en portrait)
    out.push({ layer: this.pcbGroup, min: [-PCB.w / 2, 0, -PCB.d / 2], max: [PCB.w / 2, PCB.h, PCB.d / 2], tag: 'voy' });
    return out;
  }

  /** Abonnements, poses par le Stage une fois tout le GL construit. */
  listen(): void {
    this.unsubs.push(voyParams.subscribe(this.syncKnobs));
    this.unsubs.push(arp.subscribe(this.syncArp));
    this.unsubs.push(voyMsg.subscribe(this.syncLcd));
    this.unsubs.push(seq.subscribe(this.syncLcd));
    this.unsubs.push(editor.subscribe(this.syncEditor));
    this.unsubs.push(presetMode.subscribe(this.syncLcd));
    this.unsubs.push(presets.subscribe(this.syncLcd));
    this.unsubs.push(pattern.subscribe(this.syncTempo));
    this.unsubs.push(voyExplode.subscribe(this.syncExplode));
    this.applyExplode(true);
    this.detach = voyExplode.attach();
  }

  /* ---------- etats ---------- */

  private syncKnobs = (): void => {
    const v = voyParams.get();
    let changed = false;
    for (const k of VOY_FACE_KNOBS) if (this.knobs.setValue(k.id, v[k.id])) changed = true;
    // Les TWEAKS : sous le capot, pas d'ombre a refaire
    let under = false;
    for (const k of VOY_TWEAKS) if (this.tweaks.setValue(k.id, v[k.id])) under = true;
    if (under && !changed) this.opts.repaint();
    // Les couronnes des selecteurs de forme : la forme (ou les deux du morphing) s'allume ; un dessin par vingtieme de cran
    const w1 = Math.round(morphPos('wave1', v.wave1) * 20) / 20;
    const w2 = Math.round(morphPos('wave2', v.wave2) * 20) / 20;
    if (this.panelSilk.setSelectors(w1, w2)) changed = true;
    if (this.deckSilk.setSelectors(w1, w2)) changed = true;
    if (this.syncLcd(false)) changed = true;
    if (changed) {
      if (this.knobs.mesh.castShadow) this.opts.invalidate();
      else this.opts.repaint();
    }
  };

  /** EDIT allume tant que la suite de l'arpege est ouverte. */
  private syncEditor = (): void => {
    if (this.keys.setEditing(editor.get() === 'voy')) this.opts.repaint();
  };

  private syncArp = (): void => {
    const s = arp.get();
    if (!s.running) this.playing = -1;
    let changed = this.keys.setChords(s.prog, this.playing);
    if (this.keys.setRunning(s.running)) changed = true;
    if (this.syncLcd(false)) changed = true;
    if (changed) this.opts.repaint();
  };



  /** Le tempo (celui de la 808, partage) : l'ecran le montre. */
  private syncTempo = (): void => {
    if (pattern.get().bpm !== this.bpm) this.syncLcd();
  };

  /** Le texte de l'ecran ; true s'il a ete redessine. Appele seul, il demande la frame. */
  private syncLcd = (paint: boolean | unknown = true): boolean => {
    const p = voyParams.get();
    const s = arp.get();
    this.bpm = pattern.get().bpm;
    const notes = notesCount(p.notes) > 0 ? ` ${NOTES[stepIndex('notes', p.notes)]}N` : '';
    // La suite modifiee a la main (voyager/seq.ts) : SEQ et son nombre de pas, a la place de MODE et RANGE
    const sq = seq.get();
    const how = sq.edit ? `SEQ ${sq.len} STEPS` : `${MODES[stepIndex('mode', p.mode)]} ${RANGES[stepIndex('range', p.range)]}${notes}`;
    const line1 = s.running ? `${RATES[stepIndex('rate', p.rate)]} ${how}` : VOY_COPY.lcdIdle;
    const chords = s.prog.map((i) => CHORDS[i].label);
    const playing = this.playing >= 0 ? s.prog.indexOf(this.playing) : -1;
    const line3 = voyMsg.get() ?? (s.prog.length === 0 ? 'TAP A CHORD PAD' : s.running ? 'F# MINOR' : 'RUN/STOP TO PLAY');
    const changed = this.lcd.set({ line1, chords, playing, line3, bpm: Math.round(this.bpm), running: s.running, preset: presetMode.view('voy'), tag: true });
    if (changed && paint !== false) this.opts.repaint();
    return changed;
  };

  private syncExplode = (): void => {
    this.applyExplode(false);
  };

  private applyExplode(instant: boolean): void {
    const s = voyExplode.get();
    const goal = s === 'opening' || s === 'open';
    let changed = false;
    if (instant) {
      this.explodeGoal = goal;
      if (goal) this.pcb.prepare();
      this.explode.snap(goal);
      if (s === 'opening' || s === 'closing') voyExplode.settle(goal);
      changed = true;
    } else if (goal !== this.explodeGoal) {
      this.explodeGoal = goal;
      if (goal) this.pcb.prepare();
      if (s === 'opening' || s === 'closing') this.explode.start(goal, performance.now(), this.opts.reduced());
      else this.explode.snap(goal);
      changed = true;
    }
    if (this.keys.setOpen(goal)) changed = true;
    if (this.deckSilk.setOpen(goal)) changed = true;
    if (this.syncTweaks()) changed = true;
    if (changed) this.opts.invalidate();
  }

  /** Les TWEAKS repondent capot ouvert (et pendant l'ouverture, une fois decouverts, comme les puces avant eux). */
  syncTweaks(): boolean {
    const s = voyExplode.get();
    const live = s === 'open' || (s === 'opening' && this.explode.p.plateau >= EXPLODE.chipsFrom);
    let changed = false;
    for (const d of this.tweakDefs) {
      if (d.enabled === live) continue;
      d.enabled = live;
      changed = true;
    }
    return changed;
  }

  /* ---------- animateurs ---------- */

  /** Le capot qui s'ouvre ou se ferme ; true tant qu'il bouge. */
  stepExplode = (now: number): boolean => {
    if (!this.explode.update(now)) return false;
    this.syncTweaks();
    return true;
  };

  /** Flashs echus des pads et des boutons. */
  stepKeys = (now: number): 'paint' | 'poll' | false => this.keys.update(now);

  /**
   * L'arpege a l'heure audio : l'accord qui joue passe en yellowHi, fixe
   * (2026-10-03, Mika : le flash a chaque note faisait clignoter le pad), et
   * en negatif a l'ecran. 'poll' pendant la lecture.
   */
  stepArp = (_now: number): 'paint' | 'poll' | false => {
    const s = arp.get();
    if (!s.running) {
      if (this.playing === -1) return false;
      this.playing = -1;
      this.keys.setChords(s.prog, -1);
      this.syncLcd(false);
      return 'paint';
    }
    const c = context();
    const n = c ? arp.noteAt(c.currentTime) : null;
    if (!n || n.seq === this.lastSeq) return 'poll';
    this.lastSeq = n.seq;
    if (n.chord !== this.playing) {
      this.playing = n.chord;
      this.keys.setChords(s.prog, this.playing);
      this.syncLcd(false);
    }
    return 'paint';
  };

  /** OPEN respire (desktop, mouvement complet, capot ferme). */
  breathe(now: number): boolean {
    return this.keys.breathe(now);
  }

  stopBreath(): boolean {
    return this.keys.stopBreath();
  }

  get breathing(): boolean {
    return this.keys.breathing;
  }

  /* ---------- intro ---------- */

  /** L'intro : le capot ouvert se referme avec celui de la 808 (meme minutage). */
  assemble(t: number): void {
    this.pcb.prepare();
    this.explode.assemble(t);
  }

  finishIntro(): void {
    this.explode.snap(voyExplode.get() === 'open');
  }

  /* ---------- survol ---------- */

  /** Survol a la souris (ids du rig) ; true s'il faut une frame. */
  setHover(id: string | null): boolean {
    let slot = -1;
    if (id?.startsWith('vpad-')) slot = Number(id.slice(5));
    else if (id?.startsWith('vbtn-')) {
      const i = this.keys.buttonIndex(id.slice(5) as never);
      slot = i >= 0 ? CHORDS.length + i : -1;
    }
    return this.keys.setHover(slot);
  }

  /** Polices ou logos arrives : la serigraphie se redessine. */
  redrawText(): void {
    this.deckSilk.draw();
    this.panelSilk.draw();
    this.back.draw();
    this.pcb.redraw();
    this.tweaks.draw();
  }

  info() {
    return {
      x: this.root.position.x,
      visible: this.root.visible,
      explode: this.explode.info(),
      keys: this.keys.info(),
      knobs: this.knobs.info(),
      tweaks: this.tweaks.info(),
      tweaksLive: this.tweakDefs.filter((d) => d.enabled).length,
      lcd: this.lcd.text,
      silkDraws: [this.deckSilk.draws, this.panelSilk.draws],
      pcb: { prepared: this.pcb.info().prepared },
    };
  }

  dispose(): void {
    for (const u of this.unsubs) u();
    this.unsubs.length = 0;
    this.detach();
    this.body.dispose();
    this.back.dispose();
    this.keys.dispose();
    this.knobs.dispose();
    this.deckSilk.dispose();
    this.panelSilk.dispose();
    this.lcd.dispose();
    this.tweaks.dispose();
    this.pcb.dispose();
  }
}
