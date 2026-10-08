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
 *
 * Le grand ecran (2026-10-08, voyager/screen.ts, a la place du petit ecran
 * de lcd.ts) : le rig compose ce qu'il montre (screenState : l'accord qui
 * sonne, la suite, la tete de lecture, l'echo d'un potard, le preset, INFOS)
 * a chaque changement d'un store et, pendant la lecture, a chaque note ; la
 * touche i dessinee dans son coin a sa zone de saisie (vinfo).
 */

import { Group, type Object3D } from 'three';
import { context } from '../audio/drums';
import { pattern } from '../audio/pattern';
import type { HotspotDef, Occluder } from '../scene/hit';
import { Explode, type ExplodeCfg } from '../scene/explode';
import { Pcb } from '../scene/pcb';
import type { Tweens } from '../scene/tween';
import { voyExplode } from '../state/explode';
import { EXPLODE, PCB, PCB_TURN, PORTRAIT, type SectionId } from '../theme';
import { VoySeqScreen } from './seqscreen';
import { arp } from './arp';
import { VoyBackPlate } from './backplate';
import { VoyBody } from './body';
import { CHORDS } from './chords';
import { VoyKnobs } from './knobs';
import { VoyScreen, type VoyScreenState } from './screen';
import { voyEcho } from './echo';
import { voyPatch } from './patch';
import { voyInfoIdOf } from './infoIds';
import { voyMsg } from './msg';
import { VoyKeys } from './pads';
import { VOY_FACE_KNOBS, VOY_TWEAKS, morphPos, stepIndex, voyParams } from './params';
import { editor } from '../state/editor';
import { presetMode, type PresetKey } from '../state/presetMode';
import { presets } from '../state/presets';
import { voyInfos } from '../state/voyInfos';
import { seq } from './seq';
import { VoySilk } from './silk';
import { VoyTweaks } from './tweaks';
import { VOY_BODY, VOY_COPY, VOY_EXPLODE, VOY_INFO_KEY, VOY_LCD, VOY_LID_W, VOY_PANEL, VOY_PCB_Y, VOY_X, voyTweakClear } from './theme';
import { reserve } from '../audio/sched';

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
  /** le grand ecran (2026-10-08) */
  readonly lcd: VoyScreen;
  readonly pcb: Pcb;
  /** sous le capot, sur la carte : les TWEAKS (2026-10-04) */
  readonly tweaks: VoyTweaks;
  readonly explode: Explode;
  /** au desktop : l'ecran de la suite que EDIT fait monter a la place des pads (2026-10-05) ; null au telephone */
  readonly seqScreen: VoySeqScreen | null;
  private seqDef: HotspotDef | null = null;
  private padDefs: HotspotDef[] = [];
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
  /** le rang de la suite qui joue, son accord et son rang dans la progression (arp.posAt), -1 : a l'arret */
  private pos = -1;
  private posChord = -1;
  private posSlot = -1;
  /** le dernier accord ajoute a la progression (un pad, le Dock, le clavier, le MIDI) : l'ecran le montre a l'arret */
  private lastPad = -1;
  private prog: readonly number[] = [];
  /** un dessin de l'ecran venu trop tot (screen.ts MIN_GAP_MS apres le precedent) : l'animateur le refait */
  private screenWait = false;
  private waitTimer = 0;
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
    this.lcd = new VoyScreen(opts.anisotropy);
    this.lid.add(this.lcd.bezel, this.lcd.glass);
    this.seqScreen = !PORTRAIT && !opts.mobile ? new VoySeqScreen(opts.anisotropy) : null;
    if (this.seqScreen) {
      this.lid.add(this.seqScreen.group);
      // Un onglet d'accord touche sur l'ecran de la suite : le grand ecran montre le meme accord, lecture arretee comprise (revue du 2026-10-08)
      this.seqScreen.onView = () => this.syncLcd();
    }

    // Les TWEAKS soudes sur la carte (2026-10-08) : leur zone sans composant de decor ni piste
    this.pcb = new Pcb(opts.mobile, opts.anisotropy, { model: `${VOY_COPY.model} R1.0`, variant: 'voy', chips: false, clear: voyTweakClear() });
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
    // La touche i du grand ecran (2026-10-08) : un disque sur son coin, un peu plus haut que l'ecran (il passe devant vlcd-open)
    const infoDef: HotspotDef = {
      id: 'vinfo',
      kind: 'vinfo',
      layer: this.lid,
      shape: 'disc',
      x: VOY_INFO_KEY.x,
      z: VOY_INFO_KEY.z,
      hx: VOY_INFO_KEY.r,
      hz: VOY_INFO_KEY.r,
      y0: L.bezel.h - 0.005,
      y1: L.bezel.h + 0.045,
      enabled: true,
    };
    const seqDefs = this.seqScreen ? [this.seqScreen.hotspot(this.lid)] : [];
    this.defs = [...keyDefs, ...seqDefs, ...lcdDefs, infoDef, ...this.knobs.hotspots(this.panel, this.lid), ...this.tweaks.hotspots()].map((d) => ({ ...d, machine: 'voy' as const }));
    this.seqDef = this.defs.find((d) => d.kind === 'vseq') ?? null;
    this.padDefs = this.defs.filter((d) => d.kind === 'vpad');
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
    this.unsubs.push(voyEcho.subscribe(this.syncLcd));
    this.unsubs.push(voyInfos.subscribe(this.syncLcd));
    this.unsubs.push(voyPatch.subscribe(this.syncLcd));
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
    // Les LED de ON des deux oscillateurs (facon Mini V)
    const on1 = stepIndex('on1', v.on1) === 1;
    const on2 = stepIndex('on2', v.on2) === 1;
    if (this.panelSilk.setLeds(on1, on2)) changed = true;
    if (this.deckSilk.setLeds(on1, on2)) changed = true;
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

  /**
   * EDIT au desktop (2026-10-05) : l'ecran de la suite monte, les pads se
   * rangent (et ne se touchent plus) ; true si les zones de saisie changent
   * (le Stage refait son picking).
   */
  setSeqOpen(on: boolean): boolean {
    const sc = this.seqScreen;
    const def = this.seqDef;
    if (!sc || !def || def.enabled === on) return false;
    sc.setShown(on, performance.now());
    this.keys.setPadsHidden(on);
    def.enabled = on;
    for (const d of this.padDefs) d.enabled = !on;
    this.opts.invalidate();
    return true;
  }

  /** L'ecran de la suite : sa montee, sa tete de lecture, son dessin. */
  stepSeq = (now: number): 'paint' | 'poll' | false => (this.seqScreen ? this.seqScreen.step(now) : false);

  private syncArp = (): void => {
    const s = arp.get();
    // L'accord ajoute (un seul) : l'ecran le montre a l'arret ; plusieurs (RANDOM, un preset) : le premier de la progression
    const added = s.prog.filter((i) => !this.prog.includes(i));
    if (added.length === 1) this.lastPad = added[0];
    else if (added.length > 1) this.lastPad = -1;
    this.prog = s.prog;
    if (!s.running) {
      this.playing = -1;
      this.pos = -1;
      this.posChord = -1;
      this.posSlot = -1;
    }
    let changed = this.keys.setChords(s.prog, this.playing);
    if (this.keys.setRunning(s.running)) changed = true;
    if (this.syncLcd(false)) changed = true;
    if (changed) this.opts.repaint();
  };



  /** Le tempo (celui de la 808, partage) : l'ecran le montre. */
  private syncTempo = (): void => {
    if (pattern.get().bpm !== this.bpm) this.syncLcd();
  };

  /** L'accord que l'ecran montre : celui qui sonne ; a l'arret, le dernier pad touche, le premier de la progression, F#m ; EDIT : celui qu'on edite. */
  private shownChord(): number {
    const s = arp.get();
    // EDIT : l'accord de l'ecran de la suite (desktop), ou celui du panneau du telephone (ui/SeqLane.tsx : qui joue, sinon le premier)
    if (editor.get() === 'voy') {
      if (this.seqScreen) return this.seqScreen.chord();
      return s.running && this.posChord >= 0 ? this.posChord : s.prog[0] ?? 0;
    }
    if (s.running) {
      if (this.posChord >= 0) return this.posChord;
      if (this.playing >= 0) return this.playing;
    }
    if (this.lastPad >= 0 && (s.prog.length === 0 || s.prog.includes(this.lastPad))) return this.lastPad;
    return s.prog[0] ?? 0;
  }

  /** Ce que le grand ecran montre (voyager/screen.ts). */
  private screenState(): VoyScreenState {
    const s = arp.get();
    const chord = this.shownChord();
    return {
      running: s.running,
      bpm: this.bpm,
      // Le nom du son : le preset charge (une etoile s'il a bouge), RANDOM et son style, INIT (voyager/patch.ts)
      preset: voyPatch.label(),
      presetView: presetMode.view('voy'),
      editing: editor.get() === 'voy',
      seqEdit: seq.get().edit,
      prog: s.prog,
      chord,
      playing: s.running ? (this.posChord >= 0 ? this.posChord : this.playing) : -1,
      slot: s.running && this.posChord >= 0 ? this.posSlot : -1,
      steps: seq.shown(chord),
      pos: s.running ? this.pos : -1,
      values: voyParams.get(),
      echo: voyEcho.get(),
      message: voyMsg.get(),
      infos: voyInfos.isOn(),
    };
  }

  /** Le grand ecran ; true s'il a ete redessine. Appele seul (un store), il demande la frame ; trop tot, l'animateur le refera. */
  private syncLcd = (paint: boolean | unknown = true): boolean => {
    this.bpm = pattern.get().bpm;
    const r = this.lcd.draw(this.screenState());
    if (r === 'wait') {
      // Trop tot : l'animateur le refera a la prochaine image, ou ce minuteur si aucune image ne vient
      this.screenWait = true;
      if (!this.waitTimer) {
        this.waitTimer = window.setTimeout(() => {
          this.waitTimer = 0;
          if (this.screenWait) this.syncLcd();
        }, this.lcd.waitLeft() + 5);
      }
      if (paint !== false) this.opts.repaint();
      return false;
    }
    this.screenWait = false;
    if (r === 'drawn' && paint !== false) this.opts.repaint();
    return r === 'drawn';
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
      // Le capot s'ouvre : la musique est programmee d'avance (2026-10-05, audio/sched.ts)
      if (goal) reserve(1.2);
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
   * en negatif a l'ecran ; le grand ecran (2026-10-08) suit la tete de
   * lecture note par note. 'poll' pendant la lecture, et tant qu'un dessin
   * de l'ecran attend son tour.
   */
  stepArp = (_now: number): 'paint' | 'poll' | false => {
    const s = arp.get();
    let res: 'paint' | 'poll' | false = false;
    if (!s.running) {
      if (this.playing !== -1 || this.pos !== -1) {
        this.playing = -1;
        this.pos = -1;
        this.posChord = -1;
        this.posSlot = -1;
        this.keys.setChords(s.prog, -1);
        res = 'paint';
      }
    } else {
      res = 'poll';
      const c = context();
      const n = c ? arp.noteAt(c.currentTime) : null;
      if (n && n.seq !== this.lastSeq) {
        this.lastSeq = n.seq;
        if (n.chord !== this.playing) {
          this.playing = n.chord;
          this.keys.setChords(s.prog, this.playing);
          res = 'paint';
        }
      }
      const p = c ? arp.posAt(c.currentTime) : null;
      this.pos = p ? p.pos : -1;
      this.posChord = p ? p.chord : -1;
      this.posSlot = p ? p.slot : -1;
    }
    // L'ecran : un dessin si la tete (ou quoi que ce soit) a change, au plus toutes les 40 ms (60 pendant la lecture)
    const wait = this.screenWait;
    this.screenWait = false;
    if (s.running || wait || res === 'paint') {
      this.bpm = pattern.get().bpm;
      const r = this.lcd.draw(this.screenState());
      if (r === 'drawn') return 'paint';
      if (r === 'wait') {
        this.screenWait = true;
        return res === 'paint' ? 'paint' : 'poll';
      }
    }
    return res;
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
    // INFOS (2026-10-08) : la carte de la commande survolee
    voyInfos.hover(id && voyInfoIdOf(id) ? id : null);
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
      screen: { ...this.lcd.info, size: [...this.lcd.info.size], ladder: [...this.lcd.info.ladder] },
      lastPad: this.lastPad,
      silkDraws: [this.deckSilk.draws, this.panelSilk.draws],
      pcb: { prepared: this.pcb.info().prepared },
    };
  }

  dispose(): void {
    window.clearTimeout(this.waitTimer);
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
    this.seqScreen?.dispose();
    this.tweaks.dispose();
    this.pcb.dispose();
  }
}
