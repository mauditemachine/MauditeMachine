/**
 * Les actions du MM-RYTM : les machines du telephone et du MM-ARP (voyPad, voyClear, voyRandom, voyRun, machinesToggle). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/phone.ts.
 */

import { clock } from '../audio/clock';
import { resume } from '../audio/drums';
import { sc } from '../audio/soundcloud';
import type { Stage } from '../scene/renderer';
import { voyPatch } from '../voyager/patch';
import { editor } from '../state/editor';
import { undo } from '../state/undo';
import { bassLoad } from '../state/bassload';
import { arp } from '../voyager/arp';
import { CHORDS, PROGRESSIONS } from '../voyager/chords';
import { voyMsg } from '../voyager/msg';
import { voyParams, type VoyKnobId } from '../voyager/params';
import { randomVoyStyle, type VoyStyle } from '../voyager/random';
import { SEQ_MAX, seq } from '../voyager/seq';
import { gesture } from './shared';

/**
 * Pad d'accord : l'accord entre dans la progression (ou en sort) ; le
 * premier lance l'arpege, une piste SoundCloud qui joue passe en pause
 * (une seule source a la fois, comme RUN).
 */
export function voyPad(i: number, stage: Stage | null = null): void {
  gesture();
  if (!arp.get().running) sc.pauseForRun();
  arp.toggle(i);
  stage?.voy?.keys.pressPad(i);
  const prog = arp.get().prog;
  voyMsg.show(prog.includes(i) ? `+ ${CHORDS[i].label}` : `- ${CHORDS[i].label}`);
}

/** CLEAR : plus d'accord, l'arpege s'arrete, les effets a sec. */
export function voyClear(stage: Stage | null = null): void {
  undo.boundary('voy', 'step');
  resume();
  stage?.voy?.keys.pressButton('clear');
  // EDIT ouvert (2026-10-05, plus de touches AUTO / EDIT dans la page) : CLEAR rend la suite des potards
  if (editor.get() === 'voy') {
    seq.auto();
    voyMsg.show('NOTES FROM THE KNOBS');
    return;
  }
  arp.clear();
  // Les effets a sec (2026-10-10, Mika : "quand j'appuie sur CLEAR je veux tout a 0 et la je vois qu'il y a des FX qui
  // restent") : OVERDRIVE, CHORUS, DELAY, REVERB a 0 ; VOLUME, les oscillateurs et le filtre restent
  for (const id of ['dist', 'chorus', 'delay', 'reverb'] as const) voyParams.set(id, 0);
  voyMsg.show('CLEARED · FX OFF');
}

/**
 * RANDOM : un style (2026-10-04 : BASSLINE, ACID, PLUCK, LEAD, DARK, ARP ;
 * jamais le meme deux fois de suite) et tout le patch qui lui ressemble
 * (VOLUME garde), voyager/random.ts. Les basses et l'acid ecrivent leur
 * ligne dans la suite (EDIT) et prennent une progression courte ; les
 * autres repassent en AUTO, sur une progression toute faite (jamais celle
 * qui joue). L'ecran dit le style.
 */
let lastVoyStyle: VoyStyle | null = null;

export function voyRandom(stage: Stage | null = null): void {
  undo.boundary('voy', 'step');
  gesture();
  if (!arp.get().running) sc.pauseForRun();
  const r = randomVoyStyle(lastVoyStyle);
  lastVoyStyle = r.style;
  for (const [id, v] of Object.entries(r.patch) as [VoyKnobId, number][]) voyParams.set(id, v);
  if (r.seq) {
    const buf = Array.from({ length: SEQ_MAX }, (_, i) => r.seq?.[i % (r.seq?.length || 1)] ?? null);
    seq.restore({ edit: true, buf, len: Math.min(SEQ_MAX, r.seq.length), has: true });
  } else seq.auto();
  // L'en-tete du grand ecran (2026-10-08) : RANDOM et son style, a la place du nom d'un preset
  voyPatch.random(r.style);
  const cur = arp.get().prog.join(',');
  const pool = PROGRESSIONS.filter((p) => p.join(',') !== cur);
  const pick = r.prog ?? pool[Math.floor(Math.random() * pool.length)] ?? PROGRESSIONS[0];
  arp.set([...pick]);
  stage?.voy?.keys.pressButton('random');
  voyMsg.show(`RANDOM ${r.style}`);
}

/**
 * RUN/STOP du MM-VOYAGER (2026-10-03) : l'arpege s'arrete ou repart (sans
 * progression : F#m), sur la grille de la boite a rythmes si elle joue ;
 * sinon c'est elle qui rejoindra la sienne (clock.follow). Une piste
 * SoundCloud passe en pause, comme RUN.
 */
export function voyRun(stage: Stage | null = null): boolean {
  gesture();
  if (!arp.get().running) sc.pauseForRun();
  const on = arp.toggleRun();
  stage?.voy?.keys.pressButton('run');
  voyMsg.show(on ? 'RUN' : 'STOP');
  return on;
}

/** Une machine du site joue-t-elle (le MM-RYTM, le MM-BASS, le MM-ARP) ? */
export function machinesRunning(): boolean {
  return clock.running || arp.get().running || !!bassLoad.get()?.bassSeq.running;
}

/**
 * PLAY/STOP du mixer du MM-DECKS (2026-10-04, Mika : "un bouton playstop
 * dans le mixer, bien place, pas trop imposant, et que ca se voie au
 * telephone") : les machines de ses voies ensemble, le MM-BASS avec elles
 * depuis le 2026-10-07 (ses voies 1 a 3). L'une joue : toutes s'arretent.
 * Rien ne joue : le MM-RYTM part, l'arpege et la basse le rejoignent sur sa
 * grille. Les platines continuent : c'est fait pour mixer par-dessus (et
 * elles suivent le tempo des machines, dj/actions.ts). Renvoie l'etat.
 */
/** Le numero du dernier PLAY/STOP des machines : un depart de la basse qui attend le son ne survit pas a un STOP. */
let machinesGen = 0;

export function machinesToggle(): boolean {
  gesture();
  const gen = ++machinesGen;
  if (machinesRunning()) {
    if (clock.running) clock.stop();
    // Un RUN qui attend encore le son : STOP l'annule (toggle, clock.ts)
    else if (clock.waiting) clock.toggle();
    if (arp.get().running) arp.stop();
    bassLoad.get()?.bassSeq.stop();
    return false;
  }
  sc.pauseForRun();
  clock.toggle();
  arp.toggleRun();
  void bassLoad.load()?.then((m) => m.bassEngine.ensure().then(() => {
    // Toujours voulu : rien ne l'a arretee entre-temps
    if (clock.running) {
      if (!m.bassSeq.running) m.bassSeq.start();
      return;
    }
    // Le son se reveille encore (2026-10-08 : l'horloge attend que le contexte joue) : la basse part avec elle
    if (!clock.waiting) return;
    const t0 = performance.now();
    const off = clock.subscribe(() => {
      if (gen !== machinesGen) off();
      else if (clock.running) {
        off();
        if (!m.bassSeq.running) m.bassSeq.start();
      } else if (performance.now() - t0 > 20000) off();
    });
  }));
  return true;
}
