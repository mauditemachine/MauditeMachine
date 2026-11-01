/**
 * Les actions du MM-RYTM : les machines du telephone et du MM-ARP (voyPad, voyClear, voyRandom, voyRun, machinesToggle). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/phone.ts.
 * V.6.0 (lane B6) : les pistes 9 a 16 (jouer, couper : trackPlay, trackMute) et la bascule 1-8 / 9-16 du telephone
 * (phoneBank), en fin de fichier.
 */

import { clock } from '../audio/clock';
import { resume, trigger } from '../audio/drums';
import { VEL_GAIN, VEL_NAMES, pattern, velocity } from '../audio/pattern';
import { tracks, type TrackKey } from '../audio/tracks';
import { lcdMessage } from '../state/lcdMessage';
import { TAP_VEL_DEFAULT } from '../state/rytmPage';
import { voices } from '../state/voices';
import { HI_TRACKS, asVoiceKey, isLegacyTrack, padTrack, trackName, uses916 } from './internal/phone';
import { funcDrop } from './face';
import { padHit, padMute, voiceMute } from './tracks';
import { muteVoice, soloVoice } from './internal/tracks';
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

/* ---------------- V.6.0 (lane B6) : les pistes 9 a 16, la bascule 1-8 / 9-16 du telephone ---------------- */

/** Les pads du telephone (scene/pads.ts) : leurs ids sont ceux des voix 1 a 8 ; en 9-16, le pad i joue la piste 9 + i. */
const TRACK_PADS = ['BD', 'SD', 'CH', 'OH', 'CP', 'TOM', 'HT', 'CY'] as const;

/**
 * Une piste 9 a 16 coupee ou rendue (rytm:voice:T9:mute, la double tape du telephone en 9-16), sans le mode MUTE ; 1 a 8 :
 * voiceMute d'aujourd'hui. La liste des voix coupees reste celle de state/voices.ts (le sequenceur la lit pour 16).
 */
export function trackMute(k: TrackKey, on: boolean): void {
  if (isLegacyTrack(k)) {
    voiceMute(k, on);
    return;
  }
  if (voices.isMuted(k) === on) return;
  voices.toggleMute(asVoiceKey(k));
  lcdMessage.show(`${trackName(k)} ${on ? 'MUTED' : 'ON'}`);
}

/**
 * Une piste frappee (rytm:pad:<piste>, un pad du telephone en 9-16) : 1 a 8, padHit d'aujourd'hui ; 9 a 16 : les memes
 * regles a l'arret (le son, a la velocite des nouveaux pas, sauf coupee ou vide), en mode SOLO ou MUTE la piste passe en
 * solo ou se coupe, en lecture rien ne sonne (la regle de Mika du 2026-10-05). Une piste 9 a 16 n'est pas encore choisie
 * sur la machine (pattern.instrument reste une des 8 voix tant que B4 n'a pas elargi le choix) : elle devient la piste du
 * telephone (phoneBank.track). Le LIVE REC des pistes 9 a 16 attend B4 (actions/live.ts).
 */
export function trackPlay(k: TrackKey, stage: Stage | null = null): void {
  if (isLegacyTrack(k)) {
    padHit(k, stage);
    return;
  }
  gesture();
  const v = voices.get();
  // Les memes aides que les pads 1 a 8 (actions/internal/tracks.ts) : la cle T9 n'y sert qu'a des includes et a l'ecran
  if (v.soloMode) soloVoice(asVoiceKey(k));
  else if (v.muteMode) muteVoice(asVoiceKey(k));
  else if (!clock.running && !voices.isMuted(k) && tracks.sounds(k)) {
    trigger(k, undefined, false, undefined, VEL_GAIN[TAP_VEL_DEFAULT] ?? 1);
  }
  phonePick(k);
  const i = HI_TRACKS.indexOf(k);
  if (i >= 0 && bank.hi) stage?.pressRytmPad(TRACK_PADS[i]);
  funcDrop();
}

/** L'etat de la bascule 1-8 / 9-16 du telephone (cahier dt2 1.3). */
export interface PhoneBankState {
  /** la bascule se montre : le pattern ou le kit se servent d'une piste 9 a 16 (actions/internal/phone.ts uses916) */
  readonly shown: boolean;
  /** la rangee 9-16 est affichee (pads, Dock, BeatEditor, KnobPanel) */
  readonly hi: boolean;
  /** la piste 9 a 16 choisie au telephone ; null : aucune encore */
  readonly track: TrackKey | null;
}

let bank: PhoneBankState = { shown: false, hi: false, track: null };
const bankSubs = new Set<() => void>();
let bankWired = false;

function bankSet(next: PhoneBankState): void {
  if (next.shown === bank.shown && next.hi === bank.hi && next.track === bank.track) return;
  bank = next;
  bankSubs.forEach((fn) => fn());
}

/** La regle relue (un pas pose ou efface, un son donne ou retire) : sans piste 9 a 16, la bascule disparait et 1-8 revient. */
function bankSync(): void {
  const shown = uses916();
  bankSet(shown ? { ...bank, shown } : { shown: false, hi: false, track: null });
}

/** Branche la regle sur le motif et le kit, au premier lecteur (rien a l'evaluation du module). */
function bankWire(): void {
  if (bankWired) return;
  bankWired = true;
  pattern.subscribe(bankSync);
  tracks.subscribe(bankSync);
  bankSync();
}

/**
 * La bascule 1-8 / 9-16 du telephone (V.6.0, cahier dt2 1.3) : elle ne se montre que si le pattern ou le kit se servent
 * d'une piste 9 a 16 (sans cela le telephone reste celui de la V.5.3 au pixel pres) ; le drapeau ?face=dt2 est toujours
 * faux au telephone (theme/base.ts DT2_FACE), il n'entre donc pas dans la regle.
 */
export const phoneBank = {
  get(): PhoneBankState {
    bankWire();
    return bank;
  },
  subscribe(fn: () => void): () => void {
    bankWire();
    bankSubs.add(fn);
    return () => {
      bankSubs.delete(fn);
    };
  },
  /** La piste d'un pad ou d'une case du telephone (0 a 7) dans la rangee affichee. */
  trackAt: (i: number): TrackKey | null => padTrack(i, phoneBank.get().hi),
};

/** La bascule touchee : 1-8 ou 9-16 (rien si elle n'est pas montree) ; en 9-16, une piste est choisie (celle d'avant, sinon T9). */
export function phoneBankToggle(): void {
  bankWire();
  if (!bank.shown) return;
  const hi = !bank.hi;
  bankSet({ ...bank, hi, track: hi ? (bank.track ?? HI_TRACKS[0]) : bank.track });
  lcdMessage.show(hi ? 'TRACKS 9-16' : 'TRACKS 1-8');
}

/** Une piste 9 a 16 choisie au telephone (la voix des pas du Dock en 9-16, celle du KnobPanel) ; 1 a 8 : rien ici. */
export function phonePick(k: TrackKey): void {
  bankWire();
  if (isLegacyTrack(k) || bank.track === k) return;
  bankSet({ ...bank, track: k });
}

/** Le Dock en 9-16 : le pas i de la piste du telephone pose (VEL des nouveaux pas) ou passe au cran d'en dessous. */
export function phoneStepToggle(i: number, stage: Stage | null = null): boolean {
  bankWire();
  const k = bank.hi ? bank.track : null;
  if (!k || i < 0 || i > 15) return false;
  resume();
  stage?.pressStep(i);
  if (velocity(pattern.get().steps, k, i) === 0) pattern.set(k, i, TAP_VEL_DEFAULT);
  else pattern.toggle(k, i);
  const n = i + 1;
  lcdMessage.show(`STEP ${n < 10 ? `0${n}` : n} ${trackName(k)} ${VEL_NAMES[velocity(pattern.get().steps, k, i)] ?? ''}`);
  return true;
}

/**
 * Un pad 3D du telephone tape (ui/Hotspots.tsx) : en 9-16, il joue la piste 9 + i (double : la coupe ou la rend) et rend
 * true ; en 1-8, false (le chemin de toujours, padHit et padMute).
 */
export function phonePadTap(inst: string, stage: Stage | null, double = false): boolean {
  if (!bankWired || !bank.hi) return false;
  const i = (TRACK_PADS as readonly string[]).indexOf(inst);
  const k = padTrack(i, true);
  if (!k) return false;
  if (double) {
    gesture();
    trackMute(k, !voices.isMuted(k));
    stage?.pressRytmPad(TRACK_PADS[i]);
  } else trackPlay(k, stage);
  return true;
}

/**
 * Une piste 9 a 16 touchee dans le Dock ou le KnobPanel du telephone en 9-16 (selectInstrument d'aujourd'hui pour 1 a 8) :
 * en mode SOLO ou MUTE, elle passe en solo ou se coupe ; sinon elle devient la piste du telephone, sans un son.
 */
export function phoneTrackSelect(k: TrackKey): void {
  gesture();
  const v = voices.get();
  if (v.soloMode) soloVoice(asVoiceKey(k));
  else if (v.muteMode) muteVoice(asVoiceKey(k));
  else {
    phonePick(k);
    lcdMessage.show(`KNOBS > ${trackName(k)}`);
  }
}

/** Une double tape sur une voix du Dock ou du KnobPanel : 1 a 8, padMute d'aujourd'hui ; 9 a 16, trackMute. */
export function trackMuteToggle(k: TrackKey, stage: Stage | null = null): void {
  if (isLegacyTrack(k)) padMute(k, stage);
  else {
    gesture();
    trackMute(k, !voices.isMuted(k));
  }
}
