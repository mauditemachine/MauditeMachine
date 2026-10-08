/**
 * Le grand ecran du MM-ARP (2026-10-08, Mika : "je veux le meme type
 * d'ecran pour ARP aussi, plus gros, plus de detail ! fais de la place et
 * bien sur que ce soit super responsive en mobile et utilisable"). Il
 * remplace le petit ecran de deux lignes (lcd.ts, texte monospace) par
 * l'ecran de la famille MM-RYTM / MM-BASS (scene/screen.ts, bass/screen.ts) :
 * facon OP-1, noir et os en trois intensites (INK, HALF, FAINT), la police
 * d'affichage, des formes nettes, peu de mots. Mise en page en unites de
 * VOY_SCREEN_UW de large (300 au desktop, 260 au telephone : le texte y est
 * plus gros), la hauteur suit le verre (2.7 a 2.9 pour 1). Quatre pages :
 * - HOME (tous les jours) : en haut la lecture (un triangle, un carre a
 *   l'arret), MM-ARP, le preset charge, le tempo, et la touche i ; a gauche
 *   l'accord qui sonne en grand, son degre (i, VI, VII...) et sa cle
 *   Camelot, sa place dans la progression ; au milieu l'echelle des notes
 *   de l'arpege pour cet accord (voyager/preview.ts : la suite, MODE,
 *   RANGE, NOTES, OCTAVE appliques) : une colonne par note, chaque note un
 *   trait a sa hauteur et de la longueur de GATE, les notes du meme nom
 *   reliees par un filet (la racine plus marquee), GLIDE en liaisons, la
 *   tete de lecture qui avance, la note jouee en plein ; RATE en reperes
 *   dessous (un par note, un plus haut par temps) ; a droite (desktop) les
 *   sept reglages de l'arpegiateur en deux colonnes de blocs, de 0 a 127 ou
 *   leur nom ; en bas la bande des huit accords (celui qui sonne en
 *   negatif, ceux de la progression cernes et numerotes), puis le message
 *   du moment et la pastille PRESETS (tout l'ecran les ouvre) ; le nom du
 *   son en tete : voyager/patch.ts ;
 * - l'echo d'un potard (voyager/echo.ts, 1.5 s apres le dernier geste,
 *   tenu tant qu'on le tient) : sa section, son nom, sa valeur de 0 a 127
 *   en grand (-64 a +63 pour FINE, le nom du cran pour un potard a crans),
 *   son unite (1.2 KHZ, 216 MS...), une barre qui suit la valeur, et son
 *   dessin des INFOS (voyager/diagrams.ts, Path2D) avec les valeurs du
 *   moment ;
 * - EDIT (la suite ouverte) : HOME, l'accord qu'on edite, EDIT en pastille,
 *   ce qui joue (YOUR NOTES, FROM THE KNOBS), les gestes en bas ;
 * - PRESETS : le titre et le rang, le nom en grand entre deux fleches, les
 *   quatre touches en bas, dans les bandes des zones vlcd (rig.ts).
 * La touche i (contrat Elektron, point 6) : un i cerne dans le coin en haut
 * a droite, plein quand INFOS est allume (state/voyInfos.ts), sur toutes
 * les pages ; sa zone de saisie : theme.ts VOY_INFO_KEY.
 * Redessine seulement quand ce qu'il montre change, au plus toutes les
 * MIN_GAP_MS (RUN_GAP_MS pendant la lecture : la tete, une image par note
 * au plus), jamais par frame.
 */

import { BoxGeometry, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, type CanvasTexture } from 'three';
import { albedo } from '../scene/materials';
import { makeCanvasTexture } from '../scene/silk';
import { FONT_DISPLAY, GAIN, HEX, PORTRAIT } from '../theme';
import type { PresetView } from '../state/presetMode';
import { CHORDS } from './chords';
import { hzText, midiName, voyDiagram, type VoyDiagram } from './diagrams';
import { VOY_INFO_SECTION } from './infoIds';
import {
  MODES,
  NOTES,
  OCTAVES,
  RANGES,
  RATES,
  attackS,
  cutoffHz,
  decayS,
  envOctaves,
  fineCents,
  fmRatio,
  gateFrac,
  glideS,
  morphText,
  releaseS,
  stepIndex,
  stepsPerNote,
  voyKnob,
  voyValueText,
  type VoyKnobId,
  type VoyValues,
} from './params';
import { arpPreview, type ArpPreview } from './preview';
import type { SeqStep } from './seq';
import { VOY_COPY, VOY_LCD, VOY_SCREEN_UW } from './theme';

/** Ce que l'ecran montre, compose par le rig a chaque changement (rig.ts screenState). */
export interface VoyScreenState {
  running: boolean;
  bpm: number;
  /** le dernier preset charge ou garde ('' : aucun) */
  preset: string;
  /** le mode presets (l'ecran entier lui appartient) */
  presetView: PresetView | null;
  /** EDIT ouvert ; seqEdit : la suite est celle de Mika (YOUR NOTES), sinon celle des potards */
  editing: boolean;
  seqEdit: boolean;
  prog: readonly number[];
  /** l'accord montre (celui qui sonne, le dernier pad touche, le premier de la progression, F#m) */
  chord: number;
  /** l'accord qui sonne, -1 : rien */
  playing: number;
  /** son rang dans la progression (arp.posAt slot : une progression qui repete un accord), -1 : a l'arret */
  slot: number;
  /** la suite montree pour cet accord (seq.shown) */
  steps: readonly SeqStep[];
  /** le rang de la suite qui joue, -1 : a l'arret */
  pos: number;
  values: Readonly<VoyValues>;
  /** le potard de l'echo, null : pas d'echo */
  echo: VoyKnobId | null;
  message: string | null;
  infos: boolean;
}

export type VoyScreenPage = 'home' | 'echo' | 'edit' | 'presets';

export interface VoyScreenInfo {
  draws: number;
  page: VoyScreenPage;
  size: [number, number];
  /** l'accord montre, son nom, sa cle */
  chord: string;
  camelot: string;
  /** sa place dans la progression telle qu'ecrite (CHORD 2/4, NO CHORD, VIEW ONLY) */
  where: string;
  /** l'echelle des notes dessinee (F#3 A3 C#4..., '-' : silence) et le rang en plein (-1 : aucun) */
  ladder: string[];
  pos: number;
  gate: number;
  spn: number;
  /** l'echo : le potard, la valeur ecrite en grand, son unite */
  echo: VoyKnobId | null;
  value: string;
  unit: string;
  infos: boolean;
  /** les huit cases de la bande des accords : '*' sonne, '+' dans la progression, '.' ailleurs */
  strip: string;
  /** le texte en clair (rig.info().lcd) */
  text: string;
}

const INK: string = HEX.bone;
const HALF = 'rgba(246, 241, 231, 0.5)';
const FAINT = 'rgba(246, 241, 231, 0.18)';
const BAND = 'rgba(246, 241, 231, 0.09)';
const BLACK = '#050506';

/**
 * Au plus un redessin toutes les 40 ms (un potard tourne a la cadence du
 * pointeur), 60 pendant la lecture (la tete avance d'une note : le meme pas
 * que l'ecran du MM-RYTM, scene/screen.ts ; revue du 2026-10-08, chaque
 * dessin renvoie 1280 x 498 au GPU, au plus 16 par seconde en 1/32 rapide).
 */
const MIN_GAP_MS = 40;
const RUN_GAP_MS = 60;

const DESK = !PORTRAIT;
const UW = VOY_SCREEN_UW;
const UH = (UW * VOY_LCD.d) / VOY_LCD.w;

/** La mise en page (unites) : en-tete, zone du milieu, bande des accords, ligne du bas. */
const HY = DESK ? 17 : 14.5;
const MAIN0 = DESK ? 26 : 22;
const LINE_Y = UH - (DESK ? 5 : 4.5);
const STRIP_H = DESK ? 14.5 : 12;
const STRIP_Y0 = LINE_Y - (DESK ? 10.5 : 9) - STRIP_H;
const MAIN1 = STRIP_Y0 - (DESK ? 5.5 : 4.5);
/**
 * Les colonnes du milieu : l'accord, l'echelle, les reglages (desktop). Les
 * reglages en deux colonnes de quatre blocs, le nom au-dessus de la valeur
 * (revue du 2026-10-08 : une colonne de sept rangees, 8 px de texte a
 * 1440 x 900) : RATE MODE RANGE NOTES puis GATE OCTAVE GLIDE, les deux
 * rangees de potards de l'arpegiateur sur le plateau. L'echelle cede 12
 * unites (224 et 234 avant).
 */
const CHORD_X1 = DESK ? 68 : 60;
const LAD_X0 = DESK ? 78 : 66;
const LAD_X1 = DESK ? 212 : UW - 10;
const PAR_X0 = DESK ? 222 : 0;
const PAR_GAP = 4;
/** La touche i : son centre et son rayon (theme.ts VOY_INFO_KEY pose sa zone au meme endroit) */
export const INFO_I = { x: UW - 11, y: 10.5, r: DESK ? 5.4 : 6.4 } as const;
/** Les corps (unites) */
const FS = DESK
  ? { head: 11.5, small: 8.4, tiny: 6.8, chord: 30, strip: 8.8, line: 8.2, par: 6.4, parV: 9.6, rung: 6.2 }
  : { head: 10.5, small: 8, tiny: 6.6, chord: 21, strip: 8, line: 8, par: 0, parV: 0, rung: 6.2 };

const font = (weight: number, size: number): string => `${weight} ${size}px ${FONT_DISPLAY}`;

/** Les degres des huit accords en fa diese mineur, et leur cle Camelot (le cercle des DJ). */
const ROMAN = ['i', 'VI', 'VII', 'v', 'iv', 'III', 'i7', 'VImaj7'] as const;
const CAMELOT = ['11A', '10B', '12B', '12A', '10A', '11B', '11A', '10B'] as const;
export const chordCamelot = (i: number): string => CAMELOT[i] ?? '';

/** Les roles d'un dessin des INFOS a l'ecran : tout en os, la hierarchie par l'epaisseur et l'intensite (comme bass/screen.ts). */
const DIAGRAM_INK: Readonly<Record<VoyDiagram['paths'][number]['role'], { stroke: string; fill: string; lw: number }>> = {
  main: { stroke: INK, fill: HALF, lw: 1.1 },
  hot: { stroke: INK, fill: INK, lw: 1.8 },
  ghost: { stroke: HALF, fill: FAINT, lw: 0.8 },
  grid: { stroke: FAINT, fill: FAINT, lw: 0.7 },
  dash: { stroke: HALF, fill: HALF, lw: 0.9 },
};

/** Les sections des potards (l'en-tete de l'echo) : celles des INFOS (voyager/infoIds.ts, sans leurs textes). */
const sectionOf = (id: VoyKnobId): string => VOY_INFO_SECTION[id] ?? '';

/** Un libelle de dessin qui redit l'unite ecrite sous la valeur (32 NOTES / BAR, 4.2 KHZ, F#3 de ROOT F#3) : l'echo ne l'ecrit qu'une fois. */
const squash = (t: string): string => t.toUpperCase().replace(/\s+/g, '');
function repeats(label: string, unit: string): boolean {
  const a = squash(label);
  const b = squash(unit);
  if (!a || !b) return false;
  // Une valeur d'au moins trois signes au bout de l'unite (F#3, +1.5 OCT) ; jamais un repere court (les temps 1 2 3 4, 1K)
  return a === b || (a.length >= 3 && /\d/.test(a) && (b.endsWith(a) || b.startsWith(a) || a.startsWith(b)));
}

/**
 * La valeur ecrite en grand (contrat Elektron : 0 a 127, round(v x 127) ;
 * FINE de -64 a +63 ; un potard a crans, le nom de son cran) et son unite.
 */
export function echoValue(id: VoyKnobId, v: number, bpm: number): { value: string; unit: string } {
  const k = voyKnob(id);
  const n127 = Math.round(v * 127);
  const pct = (x: number): string => `${Math.round(x * 100)} %`;
  if (id === 'fine1' || id === 'fine2') {
    const b = n127 - 64;
    const c = Math.round(fineCents(v));
    return { value: `${b > 0 ? '+' : ''}${b}`, unit: `${c > 0 ? '+' : ''}${c} CENTS` };
  }
  if (k.morph) return { value: String(n127), unit: morphText(id, v) };
  if (k.steps) {
    const name = k.steps[stepIndex(id, v)];
    let unit = '';
    if (id === 'rate') unit = `${16 / stepsPerNote(v)} NOTES / BAR`;
    else if (id === 'mode') unit = ['LOW TO HIGH', 'HIGH TO LOW', 'UP THEN DOWN', 'A NEW NOTE EACH STEP'][stepIndex('mode', v)];
    else if (id === 'range') unit = `${stepIndex('range', v) + 1} OCTAVE${stepIndex('range', v) ? 'S' : ''}`;
    else if (id === 'notes') unit = stepIndex('notes', v) === 0 ? 'THE WHOLE PATTERN' : `LOOP OF ${stepIndex('notes', v)}`;
    else if (id === 'octave') unit = `ROOT ${midiName(54 + 12 * (stepIndex('octave', v) - 2))}`;
    else if (id === 'range1' || id === 'range2') {
      const st = [-36, -24, -12, 0, 12, 24][stepIndex(id, v)];
      unit = `${st > 0 ? '+' : ''}${st} SEMITONES`;
    }
    else if (id === 'semi1' || id === 'semi2') unit = 'SEMITONES';
    else if (id === 'ratio') unit = `OPERATOR x ${fmRatio(v)}`;
    else if (id === 'fmode') unit = ['24 DB LOW PASS', '12 DB LOW PASS', 'BAND PASS', 'HIGH PASS'][stepIndex('fmode', v)];
    else if (id === 'lfoRate') unit = 'ONE CYCLE';
    else if (id === 'lfoShape') unit = ['TRIANGLE', 'RAMP DOWN', 'SQUARE', 'RANDOM STEPS'][stepIndex('lfoShape', v)];
    else if (id === 'lfoDest') unit = 'MOD TARGET';
    else if (id === 'on1' || id === 'on2') unit = id === 'on1' ? 'OSCILLATOR 1' : 'OSCILLATOR 2';
    else if (id === 'sync') unit = stepIndex('sync', v) === 1 ? 'OSC 2 HARD SYNCED' : 'OSC 2 RUNS FREE';
    else if (id === 'chord') unit = 'CHORD NOTES';
    return { value: name, unit };
  }
  let unit = pct(v);
  const step = 60 / Math.max(40, bpm || 120) / 4;
  if (id === 'gate') unit = `${Math.round(gateFrac(v) * 100)} % OF THE STEP`;
  else if (id === 'glide') unit = v <= 0 ? 'OFF' : `${Math.round(glideS(v) * 1000)} MS`;
  else if (id === 'cutoff') unit = hzText(cutoffHz(v));
  else if (id === 'res') unit = `${pct(v)} RESONANCE`;
  else if (id === 'envAmt') unit = `+${envOctaves(v).toFixed(1)} OCTAVES`;
  else if (id === 'fA' || id === 'aA') unit = timeText(attackS(v));
  else if (id === 'fD' || id === 'aD') unit = timeText(decayS(v));
  else if (id === 'fR' || id === 'aR') unit = timeText(releaseS(v));
  else if (id === 'fS' || id === 'aS') unit = `${pct(v)} LEVEL`;
  else if (id === 'osc1' || id === 'osc2' || id === 'volume') unit = v <= 0 ? '-INF DB' : `${(20 * Math.log10((id === 'volume' ? 1 : 0.88) * v * v)).toFixed(1)} DB`;
  else if (id === 'fm') unit = `INDEX ${(6 * v * v).toFixed(1)}`;
  else if (id === 'delay') unit = `FEEDBACK ${Math.round((0.35 + 0.33 * v) * 100)} %  ${Math.round(step * 3 * 1000)} MS`;
  else if (id === 'reverb' || id === 'chorus') unit = `${pct(v)} SEND`;
  else if (id === 'dist') unit = `${pct(v)} DRIVE`;
  else if (id === 'phase' || id === 'monoLow' || id === 'duck') unit = voyValueText(id, v);
  return { value: String(n127), unit };
}

const timeText = (s: number): string => (s >= 1 ? `${s.toFixed(2)} S` : `${Math.round(s * 1000)} MS`);

/** Les sept reglages de l'arpegiateur (a droite, desktop ; les quatre de la rangee du haut, puis les trois du bas) : nom court, valeur lue. */
function arpParams(v: Readonly<VoyValues>): [string, string][] {
  return [
    ['RATE', RATES[stepIndex('rate', v.rate)]],
    ['MODE', MODES[stepIndex('mode', v.mode)]],
    ['RANGE', RANGES[stepIndex('range', v.range)]],
    ['NOTES', NOTES[stepIndex('notes', v.notes)]],
    ['GATE', String(Math.round(v.gate * 127))],
    ['OCTAVE', OCTAVES[stepIndex('octave', v.octave)]],
    ['GLIDE', String(Math.round(v.glide * 127))],
  ];
}

export class VoyScreen {
  readonly glass: Mesh;
  readonly bezel: Mesh;
  readonly texture: CanvasTexture;
  readonly info: VoyScreenInfo;
  private canvas: HTMLCanvasElement;
  private ctx: CanvasRenderingContext2D;
  private bezelMat: MeshStandardMaterial;
  private scale: number;
  private key = '';
  private drawnAt = -Infinity;
  private gap = MIN_GAP_MS;
  /** les noms des racines poses a gauche de l'echelle (la ligne CHORD n/total s'arrete avant eux) */
  private rootTags: { x0: number; y0: number; y1: number }[] = [];

  constructor(anisotropy: number) {
    const W = VOY_LCD.tex;
    const H = Math.round((W * VOY_LCD.d) / VOY_LCD.w);
    this.scale = W / UW;
    this.canvas = document.createElement('canvas');
    this.canvas.width = W;
    this.canvas.height = H;
    const ctx = this.canvas.getContext('2d');
    if (!ctx) throw new Error('voyager: no 2d context');
    this.ctx = ctx;
    // Les mipmaps restent (revue du 2026-10-08) : au desktop les 1280 px du verre tombent sur ~450 px CSS a 1440 x 900,
    // sans eux le texte fin scintille a DPR 1 ; le MM-BASS fait de meme. La charge se tient par RUN_GAP_MS et la cle.
    this.texture = makeCanvasTexture(this.canvas, anisotropy);
    const geo = new PlaneGeometry(VOY_LCD.w, VOY_LCD.d);
    geo.rotateX(-Math.PI / 2);
    const mat = new MeshBasicMaterial({ map: this.texture, toneMapped: false });
    mat.name = 'voyLcd';
    this.glass = new Mesh(geo, mat);
    this.glass.name = 'voyLcd';
    this.glass.position.set(VOY_LCD.x, VOY_LCD.bezel.h + 0.004, VOY_LCD.z);
    const b = VOY_LCD.bezel;
    const bg = new BoxGeometry(b.w, b.h, b.d);
    bg.translate(VOY_LCD.x, b.h / 2, VOY_LCD.z);
    this.bezelMat = new MeshStandardMaterial({ color: albedo('oled').clone().multiplyScalar(GAIN.parts), roughness: 0.4, metalness: 0 });
    this.bezelMat.name = 'voyLcdBezel';
    this.bezel = new Mesh(bg, this.bezelMat);
    this.bezel.name = 'voyLcdBezel';
    this.bezel.receiveShadow = true;
    this.info = { draws: 0, page: 'home', size: [W, H], chord: '', camelot: '', where: '', ladder: [], pos: -1, gate: 0, spn: 1, echo: null, value: '', unit: '', infos: false, strip: '', text: '' };
  }

  get text(): string {
    return this.info.text;
  }

  /** Dans combien de ms un dessin refuse ('wait') passera (le minuteur du rig). */
  waitLeft(now = performance.now()): number {
    return Math.max(0, Math.ceil(this.drawnAt + this.gap - now));
  }

  /** La page que montre cet etat. */
  static pageOf(s: VoyScreenState): VoyScreenPage {
    if (s.presetView) return 'presets';
    if (s.echo) return 'echo';
    if (s.editing) return 'edit';
    return 'home';
  }

  /**
   * Redessine si ce qu'il montre a change : 'drawn' (il faut une image),
   * 'same' (rien a faire), 'wait' (change, mais trop tot : a redemander).
   */
  draw(s: VoyScreenState, now = performance.now()): 'drawn' | 'same' | 'wait' {
    const page = VoyScreen.pageOf(s);
    const v = s.values;
    // La cle : ce que la page dessine (l'echo lit toutes les valeurs, ses dessins en croisent plusieurs) ;
    // l'echo et PRESETS ne montrent ni la tete ni la note qui joue : pas un dessin par note sous eux
    const arpV = [v.rate, v.mode, v.range, v.notes, v.gate, v.octave, v.glide, v.chord];
    const live = page === 'home' || page === 'edit' ? [s.playing, s.slot, s.steps, s.pos] : 0;
    const key = JSON.stringify([page, s.running, Math.round(s.bpm), s.preset, s.infos, s.presetView, s.editing && s.seqEdit, s.prog, s.chord, live, s.message, page === 'echo' ? [s.echo, v] : arpV]);
    if (key === this.key) return 'same';
    this.gap = s.running ? RUN_GAP_MS : MIN_GAP_MS;
    if (now - this.drawnAt < this.gap) return 'wait';
    this.key = key;
    this.drawnAt = now;
    const c = this.ctx;
    c.setTransform(1, 0, 0, 1, 0, 0);
    c.fillStyle = BLACK;
    c.fillRect(0, 0, this.canvas.width, this.canvas.height);
    c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
    this.info.page = page;
    this.info.infos = s.infos;
    this.info.echo = page === 'echo' ? s.echo : null;
    if (page === 'presets' && s.presetView) this.drawPresets(s.presetView);
    else if (page === 'echo' && s.echo) this.drawEcho(s, s.echo);
    else this.drawHome(s, page === 'edit');
    this.drawInfoKey(s.infos);
    this.info.text = this.summary(s, page);
    this.texture.needsUpdate = true;
    this.info.draws += 1;
    return 'drawn';
  }

  /** Le texte en clair de ce qui est dessine (les tests, rig.info().lcd). */
  private summary(s: VoyScreenState, page: VoyScreenPage): string {
    if (page === 'presets' && s.presetView) return `${s.presetView.title} ${s.presetView.count} ${s.presetView.name}`;
    if (page === 'echo') return `${s.echo ? voyKnob(s.echo).label : ''} ${this.info.value} ${this.info.unit}`;
    return `${s.running ? 'RUN' : 'STOP'} ${VOY_COPY.lcdIdle} ${this.info.chord} ${this.info.camelot} ${Math.round(s.bpm)} BPM | ${this.info.ladder.join(' ')}${s.message ? ` | ${s.message}` : ''}`;
  }

  /* ---------- outils de dessin ---------- */

  private txt(s: string, x: number, y: number, size: number, color = INK, weight = 500, align: CanvasTextAlign = 'left'): number {
    const c = this.ctx;
    c.font = font(weight, size);
    c.fillStyle = color;
    c.textAlign = align;
    c.textBaseline = 'alphabetic';
    c.fillText(s, x, y);
    return c.measureText(s).width;
  }

  private width(s: string, size: number, weight: number): number {
    this.ctx.font = font(weight, size);
    return this.ctx.measureText(s).width;
  }

  /** La plus grande taille (jusqu'a size) ou le texte tient dans maxW. */
  private fit(s: string, weight: number, size: number, maxW: number, min = 5): number {
    let z = size;
    while (z > min && this.width(s, z, weight) > maxW) z -= 0.5;
    return z;
  }

  /** Coupe le texte (un point au bout) pour qu'il tienne dans maxW. */
  private clip(s: string, size: number, weight: number, maxW: number): string {
    if (this.width(s, size, weight) <= maxW) return s;
    let t = s;
    while (t.length > 1 && this.width(`${t}.`, size, weight) > maxW) t = t.slice(0, -1);
    return `${t.trimEnd()}.`;
  }

  private box(x: number, y: number, w: number, h: number, fill: string | null, stroke: string | null, lw = 1, r = 3): void {
    const c = this.ctx;
    const k = Math.min(r, w / 2, h / 2);
    c.beginPath();
    c.moveTo(x + k, y);
    c.arcTo(x + w, y, x + w, y + h, k);
    c.arcTo(x + w, y + h, x, y + h, k);
    c.arcTo(x, y + h, x, y, k);
    c.arcTo(x, y, x + w, y, k);
    c.closePath();
    if (fill) {
      c.fillStyle = fill;
      c.fill();
    }
    if (stroke) {
      c.strokeStyle = stroke;
      c.lineWidth = lw;
      c.stroke();
    }
  }

  /** Une pastille : pleine (texte noir) ou cernee. */
  private pill(text: string, x: number, y: number, size: number, full: boolean, align: 'left' | 'center' | 'right' = 'left'): number {
    const tw = this.width(text, size, 700);
    const w = tw + size * 1.3;
    const h = size * 1.5;
    const x0 = align === 'left' ? x : align === 'right' ? x - w : x - w / 2;
    this.box(x0, y - h + size * 0.36, w, h, full ? INK : null, full ? null : HALF, 0.9, h / 2);
    this.txt(text, x0 + w / 2, y, size, full ? BLACK : INK, 700, 'center');
    return w;
  }

  /** La lecture : un triangle (elle joue), un carre (a l'arret). */
  private transport(running: boolean): void {
    const c = this.ctx;
    const s = DESK ? 8.5 : 9;
    c.fillStyle = INK;
    if (running) {
      c.beginPath();
      c.moveTo(10, HY - s);
      c.lineTo(10 + s * 0.88, HY - s / 2);
      c.lineTo(10, HY);
      c.closePath();
      c.fill();
    } else c.fillRect(10, HY - s * 0.92, s * 0.85, s * 0.85);
  }

  /** Le tempo, a gauche de la touche i ; renvoie le bord gauche. */
  private tempo(bpm: number): number {
    const right = INFO_I.x - INFO_I.r - 6;
    const bw = this.txt('BPM', right, HY, FS.tiny, HALF, 700, 'right');
    const nw = this.txt(String(Math.round(bpm)), right - bw - 3, HY, FS.head + 1, INK, 400, 'right');
    return right - bw - 3 - nw;
  }

  /** La touche i : un cercle, le i dedans ; INFOS allume, le disque plein et le i en noir. */
  private drawInfoKey(on: boolean): void {
    const c = this.ctx;
    const { x, y, r } = INFO_I;
    c.beginPath();
    c.arc(x, y, r, 0, Math.PI * 2);
    if (on) {
      c.fillStyle = INK;
      c.fill();
    } else {
      c.strokeStyle = INK;
      c.lineWidth = 0.95;
      c.stroke();
    }
    c.fillStyle = on ? BLACK : INK;
    c.beginPath();
    c.arc(x, y - r * 0.46, r * 0.15, 0, Math.PI * 2);
    c.fill();
    const w = r * 0.26;
    c.fillRect(x - w / 2, y - r * 0.16, w, r * 0.68);
  }

  /** Un dessin des INFOS dans la boite donnee, a l'echelle, centre (comme bass/screen.ts drawDiagram) ; unit : la ligne d'unite deja ecrite (ses libelles en double sautent). */
  private drawDiagram(d: VoyDiagram, x: number, y: number, w: number, h: number, unit = ''): void {
    const c = this.ctx;
    const k = Math.min(w / d.w, h / d.h);
    c.save();
    c.translate(x + (w - d.w * k) / 2, y + (h - d.h * k) / 2);
    c.scale(k, k);
    c.lineCap = 'round';
    c.lineJoin = 'round';
    for (const p of d.paths) {
      const path = new Path2D(p.d);
      const ink = DIAGRAM_INK[p.role];
      if (p.fill) {
        c.fillStyle = ink.fill;
        c.fill(path);
        continue;
      }
      c.strokeStyle = ink.stroke;
      c.lineWidth = ink.lw / k;
      c.setLineDash(p.role === 'dash' ? [3 / k, 2.4 / k] : []);
      c.stroke(path);
    }
    c.setLineDash([]);
    c.font = font(600, (DESK ? 7.2 : 7.6) / k);
    c.fillStyle = HALF;
    c.textBaseline = 'alphabetic';
    for (const t of d.texts) {
      if (t.role !== 'label' || repeats(t.text, unit)) continue;
      c.textAlign = t.anchor === 'middle' ? 'center' : t.anchor === 'end' ? 'right' : 'left';
      c.fillText(t.text, t.x, t.y);
    }
    c.restore();
  }

  /* ---------- HOME et EDIT ---------- */

  private drawHome(s: VoyScreenState, edit: boolean): void {
    const UWr = UW;
    // L'en-tete : la lecture, MM-ARP (ou EDIT), le preset, le tempo
    this.transport(s.running);
    let x = 24;
    if (edit) x += this.pill('EDIT', x, HY, FS.small, true) + 5;
    else x += this.txt(VOY_COPY.lcdIdle, x, HY, FS.head, INK, 700) + 6;
    const left = this.tempo(s.bpm) - 8;
    const sub = edit ? (s.seqEdit ? 'YOUR NOTES' : 'FROM THE KNOBS') : s.preset;
    if (sub) this.txt(this.clip(sub, FS.small, 600, left - x), x, HY, FS.small, HALF, 600);

    // A gauche : l'accord
    const chord = s.chord >= 0 && s.chord < CHORDS.length ? s.chord : 0;
    const name = CHORDS[chord].label;
    const cam = chordCamelot(chord);
    const has = s.prog.length > 0;
    const cs = this.fit(name, 300, FS.chord, CHORD_X1 - 10);
    const cy = MAIN0 + cs * 0.82;
    this.txt(name, 9, cy, cs, has ? INK : HALF, 300);
    const ry = cy + (DESK ? 11 : 10);
    const rw = this.txt(ROMAN[chord], 10, ry, FS.small, INK, 700);
    this.pill(cam, 10 + rw + 5, ry, FS.tiny, false);
    // Le rang qui joue s'il s'agit de cet accord (F#m F#m D E : le second F#m dit 2/4), sinon sa premiere place
    const at = s.slot >= 0 && s.prog[s.slot] === chord ? s.slot : s.prog.indexOf(chord);
    const where = !has ? 'NO CHORD' : at >= 0 ? `CHORD ${at + 1}/${s.prog.length}` : 'VIEW ONLY';

    // Au milieu : l'echelle des notes (avant la ligne du dessus : elle s'arrete devant les noms des racines)
    const pv = arpPreview(chord, s.values, s.steps);
    this.drawLadder(pv, s, has, cy + 3);
    if (MAIN1 - ry > FS.tiny + 3) {
      const wy = Math.min(MAIN1, ry + FS.tiny + 5);
      // Le bord gauche du nom de racine le plus proche sur cette hauteur (revue du 2026-10-08 : NO CHORD touchait F#3)
      let wx = LAD_X0 - 6;
      for (const t of this.rootTags) if (t.y0 < wy + 1.5 && t.y1 > wy - FS.tiny - 1.5) wx = Math.min(wx, t.x0 - 4);
      this.txt(this.clip(where, FS.tiny, 700, wx - 10), 10, wy, FS.tiny, HALF, 700);
    }

    // A droite (desktop) : les sept reglages de l'arpegiateur, deux colonnes de blocs (le nom, la valeur dessous)
    if (DESK) {
      const rows = arpParams(s.values);
      const y0 = MAIN0 + 1;
      const dy = (MAIN1 - y0) / 4;
      const colW = (UWr - 10 - PAR_X0 - PAR_GAP) / 2;
      // Les corps suivent la hauteur d'un bloc : jamais deux valeurs qui se touchent
      const pl = Math.min(FS.par, dy * 0.42);
      const pv2 = Math.min(FS.parV, dy * 0.64);
      rows.forEach(([k, val], i) => {
        const x = PAR_X0 + (i < 4 ? 0 : colW + PAR_GAP);
        const top = y0 + dy * (i % 4);
        const ly = top + pl * 0.8;
        this.txt(k, x, ly, pl, HALF, 700);
        this.txt(val, x, ly + 1.2 + pv2 * 0.74, this.fit(val, 600, pv2, colW), INK, 600);
      });
      this.ctx.fillStyle = FAINT;
      this.ctx.fillRect(PAR_X0 - 5, MAIN0, 0.6, MAIN1 - MAIN0);
    }

    // La bande des accords
    this.drawStrip(s, chord);

    // La ligne du bas : le message, sinon ce qu'il faut faire
    const v = s.values;
    const settings = `${RATES[stepIndex('rate', v.rate)]}  ${MODES[stepIndex('mode', v.mode)]}  ${RANGES[stepIndex('range', v.range)]}`;
    const hint = edit
      ? DESK
        ? 'DRAG ON THE STEPS BELOW  /  TAP A NOTE: REST  /  CLEAR: THE KNOBS'
        : 'DRAW IN THE PANEL BELOW'
      : !has
        ? 'TAP A CHORD PAD'
        : !s.running
          ? DESK
            ? 'RUN/STOP TO PLAY'
            : `RUN/STOP TO PLAY  ${settings}`
          : DESK
            ? `F# MINOR  11A  ${s.prog.length} CHORD${s.prog.length > 1 ? 'S' : ''}`
            : settings;
    const msg = s.message ?? hint;
    // PRESETS : une pastille cernee, lisible (revue du 2026-10-08 : TOUCH: PRESETS en FAINT a 18 % se lisait a peine, et
    // la bande des accords a l'air de touches ; tout l'ecran ouvre les presets, la pastille le dit)
    const rw2 = edit ? 0 : this.pill('PRESETS', UWr - 10, LINE_Y, FS.tiny, false, 'right');
    this.txt(this.clip(msg, FS.line, 600, UWr - 26 - rw2), 10, LINE_Y, FS.line, s.message ? INK : HALF, 600);

    this.info.chord = name;
    this.info.camelot = cam;
    this.info.where = where;
  }

  /**
   * L'echelle des notes : une colonne par note de la suite, chaque note un
   * trait a sa hauteur, de la longueur de GATE ; les notes du meme nom
   * reliees par un filet (la racine de l'accord plus marquee, son nom a
   * gauche) ; la tete de lecture ; RATE en reperes dessous.
   */
  private drawLadder(pv: ArpPreview, s: VoyScreenState, has: boolean, freeY: number): void {
    const c = this.ctx;
    const x0 = LAD_X0;
    const x1 = LAD_X1;
    const y0 = MAIN0 + 1;
    const y1 = MAIN1 - (DESK ? 6 : 5);
    const n = Math.min(32, pv.notes.length);
    const cw = (x1 - x0) / Math.max(1, n);
    let lo = pv.lo;
    let hi = pv.hi;
    if (n === 0 || hi === 0) {
      lo = 54;
      hi = 66;
    }
    if (hi - lo < 12) {
      const mid = (hi + lo) / 2;
      lo = Math.floor(mid - 6);
      hi = Math.ceil(mid + 6);
    }
    const bh = Math.max(2.4, Math.min(DESK ? 4.6 : 4.2, ((y1 - y0) / Math.max(1, hi - lo)) * 1.8));
    const yOf = (m: number): number => y1 - bh / 2 - ((m - lo) / Math.max(1, hi - lo)) * (y1 - y0 - bh);
    // Le fond : un trait fin tous les quatre rangs (le pas des temps en 1/16)
    const ink = has ? 1 : 0.55;
    c.globalAlpha = ink;
    // Les filets des notes jouees, la racine plus marquee et nommee
    const root = ((54 + (CHORDS[pv.chord]?.root ?? 0)) % 12 + 12) % 12;
    const seen = new Set<number>();
    for (const nt of pv.notes) {
      if (nt.midi === null || seen.has(nt.midi)) continue;
      seen.add(nt.midi);
      const isRoot = ((nt.midi % 12) + 12) % 12 === root;
      c.fillStyle = isRoot ? 'rgba(246, 241, 231, 0.3)' : 'rgba(246, 241, 231, 0.1)';
      c.fillRect(x0, yOf(nt.midi) - 0.3, x1 - x0, 0.6);
    }
    // Les noms des racines, a gauche de l'echelle, sous le nom de l'accord (freeY) ; au telephone la plus basse seulement
    const roots = [...seen].filter((m) => ((m % 12) + 12) % 12 === root && yOf(m) - FS.rung > freeY).sort((a, b) => a - b);
    this.rootTags = [];
    for (const m of DESK ? roots : roots.slice(0, 1)) {
      const by = yOf(m) + FS.rung * 0.36;
      const w = this.txt(midiName(m), x0 - 2, by, FS.rung, HALF, 600, 'right');
      this.rootTags.push({ x0: x0 - 2 - w, y0: by - FS.rung * 0.74, y1: by });
    }
    // La tete de lecture : la colonne qui joue dans une bande claire
    const playing = s.running && s.pos >= 0 && s.playing === pv.chord ? s.pos % Math.max(1, pv.notes.length) : -1;
    if (playing >= 0 && playing < n) {
      c.fillStyle = BAND;
      c.fillRect(x0 + playing * cw, y0 - 2, cw, y1 - y0 + 4);
    }
    // Les notes : la longueur de GATE, les liaisons de GLIDE
    const glide = s.values.glide > 0.02;
    for (let i = 0; i < n; i += 1) {
      const nt = pv.notes[i];
      const xc = x0 + i * cw;
      if (nt.midi === null) {
        c.fillStyle = FAINT;
        c.beginPath();
        c.arc(xc + cw / 2, y1 - 1, 0.9, 0, Math.PI * 2);
        c.fill();
        continue;
      }
      const y = yOf(nt.midi);
      const w = Math.max(1.4, cw * pv.gate - 1.2);
      this.box(xc + 0.6, y - bh / 2, w, bh, i === playing ? INK : HALF, null, 1, bh / 2);
      if (i === playing) {
        c.strokeStyle = INK;
        c.lineWidth = 0.9;
        c.beginPath();
        c.arc(xc + 0.6 + w / 2, y, bh * 0.95, 0, Math.PI * 2);
        c.stroke();
      }
      if (glide && i + 1 < n) {
        const nx = pv.notes[i + 1];
        if (nx.midi !== null && nx.midi !== nt.midi) {
          c.strokeStyle = HALF;
          c.lineWidth = 0.8;
          c.lineCap = 'round';
          c.beginPath();
          c.moveTo(xc + 0.6 + w, y);
          c.lineTo(xc + cw + 0.6, yOf(nx.midi));
          c.stroke();
        }
      }
    }
    // RATE : un repere par note, un plus haut a chaque temps (4 / pas par note : les notes d'un temps)
    const perBeat = 4 / pv.spn;
    const ty = MAIN1 - 1;
    for (let i = 0; i < n; i += 1) {
      const beat = perBeat >= 1 ? i % Math.round(perBeat) === 0 : true;
      c.fillStyle = beat ? HALF : FAINT;
      c.fillRect(x0 + i * cw + 0.3, ty - (beat ? 3.2 : 1.6), Math.max(0.6, Math.min(1.1, cw * 0.18)), beat ? 3.2 : 1.6);
    }
    if (playing >= 0) {
      c.fillStyle = INK;
      c.fillRect(x0 + playing * cw + 0.3, ty + 1, cw - 0.6, 1.2);
    }
    c.globalAlpha = 1;
    // Les marques de la suite : RAND (une note tiree par pas), YOUR NOTES (la suite d'EDIT)
    // (en EDIT, l'en-tete le dit deja)
    const tag = pv.random ? 'RAND' : s.seqEdit && !s.editing ? 'YOUR NOTES' : '';
    if (tag) this.pill(tag, x1, y0 + FS.tiny + 1, FS.tiny, false, 'right');
    this.info.ladder = pv.notes.slice(0, n).map((nt) => (nt.midi === null ? '-' : midiName(nt.midi)));
    this.info.pos = playing;
    this.info.gate = pv.gate;
    this.info.spn = pv.spn;
  }

  /** La bande des huit accords : celui qui sonne en negatif, ceux de la progression cernes et numerotes, celui qu'on regarde souligne. */
  private drawStrip(s: VoyScreenState, shown: number): void {
    const gap = DESK ? 2.6 : 2.2;
    const x0 = 10;
    const w = (UW - 20 - gap * (CHORDS.length - 1)) / CHORDS.length;
    const y = STRIP_Y0;
    let strip = '';
    CHORDS.forEach((ch, i) => {
      const x = x0 + i * (w + gap);
      const at = s.prog.indexOf(i);
      const sounding = s.running && i === s.playing;
      if (sounding) this.box(x, y, w, STRIP_H, INK, null);
      else if (at >= 0) this.box(x, y, w, STRIP_H, null, i === shown ? INK : HALF, i === shown ? 1.2 : 0.8);
      else this.box(x, y, w, STRIP_H, null, FAINT, 0.6);
      const size = this.fit(ch.label, 600, FS.strip, w - 5);
      this.txt(ch.label, x + w / 2, y + STRIP_H / 2 + size * 0.36, size, sounding ? BLACK : at >= 0 ? INK : HALF, sounding ? 700 : 600, 'center');
      // Ses places dans la progression, toutes (F#m F#m D E : 1,2 sur F#m)
      if (at >= 0 && s.prog.length > 1) {
        const order = s.prog.flatMap((c, k) => (c === i ? [String(k + 1)] : [])).join(',');
        this.txt(order, x + w - 2, y + 4.6, 4.4, sounding ? BLACK : HALF, 700, 'right');
      }
      strip += sounding ? '*' : at >= 0 ? '+' : '.';
    });
    this.info.strip = strip;
  }

  /* ---------- l'echo d'un potard ---------- */

  private drawEcho(s: VoyScreenState, id: VoyKnobId): void {
    const k = voyKnob(id);
    const v = s.values[id];
    this.transport(s.running);
    this.txt(sectionOf(id), 24, HY, FS.small, HALF, 700);
    this.tempo(s.bpm);
    const { value, unit } = echoValue(id, v, s.bpm);
    const colW = UW * 0.4 - 10;
    const top = MAIN0 - 2;
    const bot = UH - 10;
    const label = k.section === 'feg' ? `F.EG ${k.label}` : k.section === 'aeg' ? `A.EG ${k.label}` : k.label;
    const ls = this.fit(label, 700, DESK ? 12 : 12.5, colW);
    const stepped = !!k.steps && !k.morph;
    const us = this.fit(unit, 600, FS.small, colW, 5);
    // Le nom, la valeur, l'unite, la barre : la valeur prend la hauteur qui reste (jamais par-dessus l'unite)
    const room = (bot - top - ls - 3 - us - 3 - 7) / 0.92;
    const vs = this.fit(value, 300, Math.min(room, stepped ? (DESK ? 26 : 24) : DESK ? 36 : 32), colW, 9);
    this.txt(label, 10, top + ls, ls, INK, 700);
    const vy = top + ls + 3 + vs * 0.92;
    this.txt(value, 8.5, vy, vs, INK, 300);
    this.txt(unit, 10, vy + us + 3, us, HALF, 600);
    // La barre de la valeur : la course entiere, le point de la valeur (le centre marque pour FINE)
    const by = Math.min(bot - 1, vy + us + 9);
    const bw = colW - 2;
    this.box(10, by - 1.1, bw, 2.2, FAINT, null, 1, 1.1);
    if (id === 'fine1' || id === 'fine2') {
      const cx = 10 + bw / 2;
      const px = 10 + bw * v;
      this.box(Math.min(cx, px), by - 1.1, Math.abs(px - cx), 2.2, INK, null, 1, 1.1);
      this.ctx.fillStyle = HALF;
      this.ctx.fillRect(cx - 0.4, by - 3, 0.8, 6);
    } else this.box(10, by - 1.1, Math.max(2.2, bw * v), 2.2, INK, null, 1, 1.1);
    // Le dessin, a droite, avec les valeurs du moment
    const d = voyDiagram(id, { v, values: s.values, bpm: s.bpm, chord: s.chord });
    if (d) this.drawDiagram(d, UW * 0.42, MAIN0 - 4, UW * 0.58 - 10, UH - MAIN0 - 2, unit);
    this.info.value = value;
    this.info.unit = unit;
  }

  /* ---------- PRESETS ---------- */

  /**
   * PRESETS, dans les bandes des zones de l'ecran (rig.ts : le haut, 72 %,
   * gauche le precedent et droite le suivant ; le bas, quatre touches).
   */
  private drawPresets(p: PresetView): void {
    const c = this.ctx;
    this.txt(p.title, 10, HY, FS.small + 1, INK, 700);
    if (p.count) this.txt(p.count, INFO_I.x - INFO_I.r - 6, HY, FS.small, HALF, 600, 'right');
    const band = UH * 0.72;
    const my = (HY + band) / 2 + 4;
    if (!p.empty) {
      c.fillStyle = INK;
      for (const [x, d] of [
        [14, -1],
        [UW - 14, 1],
      ] as const) {
        c.beginPath();
        c.moveTo(x - d * 3.5, my - 7);
        c.lineTo(x + d * 4.5, my - 1.5);
        c.lineTo(x - d * 3.5, my + 4);
        c.closePath();
        c.fill();
      }
    }
    const size = this.fit(p.name, 400, DESK ? 22 : 20, UW - 64, 9);
    this.txt(p.name, UW / 2, my + size * 0.35, size, INK, 400, 'center');
    const kw = UW / 4;
    const ky = band + (UH - band) / 2 + 3;
    p.keys.forEach((k, i) => {
      if (!k) return;
      this.pill(k, i * kw + kw / 2, ky, FS.small, k === 'EXIT', 'center');
    });
  }

  dispose(): void {
    this.glass.geometry.dispose();
    (this.glass.material as MeshBasicMaterial).dispose();
    this.bezel.geometry.dispose();
    this.bezelMat.dispose();
    this.texture.dispose();
    this.canvas.width = 0;
    this.canvas.height = 0;
  }
}
