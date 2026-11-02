/**
 * Les actions du MM-RYTM : le navigateur des sons (la liste, la pre-ecoute, le choix, les fichiers importes). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/browser.ts.
 */

import type { V2Track } from '../../v2/context/AudioPlayerContext';
import { clock } from '../audio/clock';
import { resume, shotReady, trigger } from '../audio/drums';
import { familyOf, kit, type KitFamily } from '../audio/kit';
import { lockOf } from '../audio/locks';
import { requestSample, sampleByKey, sampleLabel, samplePcm, sampleStatus, type KitSample } from '../audio/samples';
import { UserSampleError, userSamples } from '../audio/usersamples';
import { VEL_GAIN, pattern, velocity } from '../audio/pattern';
import { sc } from '../audio/soundcloud';
import { djLoad } from '../state/djload';
import { DJ, focus } from '../state/focus';
import { section } from '../state/section';
import { lcdMessage } from '../state/lcdMessage';
import { BROWSER_ARM_MS, BROWSER_ROWS, lcdSamples } from '../state/lcdSamples';
import type { ShotId } from '../audio/shotsdsp';
import { editor } from '../state/editor';
import { presetMode } from '../state/presetMode';
import { rytmPage } from '../state/rytmPage';
import { rytmLock } from '../state/rytmLock';
import { dtFace } from '../state/dtFace';
import { voices } from '../state/voices';
import { DT2_FACE, LCD_DROP_NO_VOICE, LCD_NO_VOICE, PORTRAIT, POT_UI, type Inst } from '../theme';
import { KIT_FAMILIES } from '../audio/kitlaw';
import { TRACK_NAMES, isLegacyTrack, sampleFamily, trackIndex, tracks, type TrackKey } from '../audio/tracks';
import { dialSpecOf } from '../scene/screen/menus/registry';
import { activeTrack } from '../state/trk';
import { gesture, two } from './shared';
import { selectVoice } from './internal/tracks';
import { coarsePointer } from './internal/transport';
import { touchPage } from './internal/dials';
import { FAIL_TAG, setVoiceSound, trackSampleList, voiceSoundAt } from './internal/kit';
import { soundLockWrite } from './internal/locks';
import { browserClampTop, browserReveal } from './internal/browser';
import { type VoiceSound, voiceSounds } from './kit';
import { lockMode, stepPlays } from './locks';

/** Ligne TRACKS ou MIXTAPES : joue directement dans le MIXER avec les platines (MM-DECKS, demande de Mika 2026-11-02). */
export function playItem(track: V2Track, queue: V2Track[]): void {
  if (DJ && !PORTRAIT) {
    resume();
    section.set(null);
    focus.set('dj');
    void djLoad.load();
    void import('../dj/actions').then((m) => m.djOpenCatalog(track.id.startsWith('mix-') ? 'mixtapes' : 'tracks', track));
    return;
  }
  sc.play(track, queue);
}


/* ---------------- le navigateur des sons du MM-RYTM (2026-10-18) ---------------- */

/*
 * Mika (2026-10-18) : "Je trouve ca difficile la selection des samples dans
 * RYTM, y aurait-il une autre facon ?". Une tape sur le nom du son (le bloc
 * SOUND de VOICE) ou un cran de SOUND ouvre toute la liste de la voix sur le
 * grand ecran (state/lcdSamples.ts, scene/screen.ts paintBrowser) ; une ligne
 * touchee la fait jouer (les regles du potard : setVoiceSound), la liste reste
 * ouverte et, a l'arret, le coup s'entend une fois (le chemin d'un pad :
 * trigger) ; en lecture, le motif le joue. PREV et NEXT (les fleches de
 * l'en-tete ; haut et bas sur le bloc SOUND au clavier) passent d'un son au
 * suivant de la meme facon. Un fichier glisse sur un pad, ou + LOAD A FILE...,
 * devient un sample de la voix (audio/usersamples.ts) et joue tout de suite ; un
 * sample de ce navigateur se retire en deux gestes (REMOVE? TAP AGAIN). En
 * P-LOCK, la liste est celle du sample lock (les samples des autres voix
 * aussi) et une ligne verrouille le pas, comme le bloc qu'on glisse.
 */

/** Une ligne du navigateur : un son de la liste de SOUND, ou la derniere, + LOAD A FILE... */
export interface BrowserRow {
  kind: VoiceSound['kind'] | 'load';
  /** la machine (909, 808, mm) ou la cle du sample ; '' pour + LOAD A FILE... */
  key: string;
  fam: KitFamily | null;
  label: string;
  /** un sample de ce navigateur : il se retire */
  user: boolean;
  /** ce que la ligne dit a sa droite : SYNTH (une machine), USER (un sample de ce navigateur), '' */
  tag: string;
}

/** Ce que l'ecran, ses zones et ses jumeaux montrent du navigateur ouvert. */
export interface SoundBrowserView {
  inst: Inst;
  /** BD SOUND */
  title: string;
  /** le pas en P-LOCK (la liste du sample lock : une ligne le verrouille), -1 hors P-LOCK */
  lock: number;
  /** les sons de la voix, puis + LOAD A FILE... */
  rows: readonly BrowserRow[];
  /** les sons seuls */
  n: number;
  /** le son du moment (en P-LOCK : ce que le pas joue) */
  cur: number;
  /** la ligne du clavier : celle du son du moment tant qu'il n'en a pas choisi une autre */
  cursor: number;
  /** la premiere ligne montree ; combien en tiennent */
  top: number;
  visible: number;
  /** la ligne qui attend sa confirmation pour partir, -1 aucune */
  arm: number;
  /** 7 / 24 */
  rank: string;
}

/** La derniere ligne : un fichier du disque ou du telephone devient un sample de la voix. */
export const BROWSER_LOAD_LABEL = '+ LOAD A FILE...';

const browserRowsCache = new WeakMap<readonly VoiceSound[], readonly BrowserRow[]>();
/** Les lignes d'une liste de SOUND (gardees tant qu'elle ne change pas : voiceSounds la garde aussi). */
function browserRows(list: readonly VoiceSound[]): readonly BrowserRow[] {
  const hit = browserRowsCache.get(list);
  if (hit) return hit;
  const rows: BrowserRow[] = list.map((s) => {
    const user = s.kind === 'smp' && !!sampleByKey(s.key)?.user;
    return { ...s, user, tag: s.kind === 'mach' ? 'SYNTH' : user ? 'USER' : '' };
  });
  rows.push({ kind: 'load', key: '', fam: null, label: BROWSER_LOAD_LABEL, user: false, tag: '' });
  browserRowsCache.set(list, rows);
  return rows;
}

/**
 * Les lignes d'un sample qui arrive ou qui manque (2026-10-21) : a droite LOADING, OFFLINE, MISSING, ERROR a la place
 * de leur mot ; les autres telles quelles (la liste gardee, sans copie, quand tout est pret).
 */
function browserStateRows(rows: readonly BrowserRow[]): readonly BrowserRow[] {
  let out: BrowserRow[] | null = null;
  rows.forEach((r, i) => {
    if (r.kind !== 'smp') return;
    const st = sampleStatus(r.key);
    const tag = st.state === 'loading' ? 'LOADING' : st.state === 'failed' ? FAIL_TAG[st.why ?? 'bad'] : '';
    if (!tag) return;
    out ??= rows.slice();
    out[i] = { ...r, tag };
  });
  return out ?? rows;
}

/** Le pas que la liste verrouille (le P-LOCK ; des pas tenus : le premier), -1 hors P-LOCK. */
function browserLockStep(): number {
  if (!lockMode()) return -1;
  const s = rytmLock.get().step;
  return s >= 0 ? s : (rytmLock.targets()[0] ?? -1);
}

/** Le rang de ce que joue la voix (en P-LOCK : le pas) dans sa liste. */
function browserCur(inst: Inst, list: readonly VoiceSound[], lock: number): number {
  return voiceSoundAt(list, lock >= 0 ? stepPlays(inst, lockOf(pattern.get().locks, inst, lock)) : kit.playsWith(inst as ShotId, null));
}
/** La premiere ligne pour montrer i vers le haut de la liste (la troisieme ligne au desktop, la deuxieme au telephone). */
const browserCenterTop = (i: number, len: number): number => browserClampTop(i - Math.floor((BROWSER_ROWS - 1) / 2), len);

/** La touche SOUNDS de la face DT2 (V.6.0) : la liste reste ouverte meme si PTN est allume ou si le focus suit le clic. */
const inSoundsMenu = (): boolean => DT2_FACE && dtFace.menu() === 'sounds';

/** La voix du navigateur : celle du motif, sinon sur la face DT2 la piste 1 a 8 active, sinon BD. */
function browserVoice(): Inst | null {
  const p = pattern.get().instrument;
  if (p) return p;
  if (DT2_FACE) {
    const t = activeTrack.get();
    if (t && isLegacyTrack(t)) return t;
    return 'BD';
  }
  return null;
}

/** Le navigateur ouvert, tel que l'ecran le dessine ; null ferme (ou EDIT, les presets, pas de voix : ils ont l'ecran). */
export function soundBrowserView(): SoundBrowserView | null {
  const st = lcdSamples.get();
  if (!st.open) return null;
  const inst = browserVoice();
  if (!inst || (!inSoundsMenu() && (editor.get() === 'mm808' || presetMode.on('mm808')))) return null;
  const lock = browserLockStep();
  const list = voiceSounds(inst, lock >= 0);
  const rows = browserStateRows(browserRows(list));
  const cur = browserCur(inst, list, lock);
  const cursor = st.cursor >= 0 && st.cursor < rows.length ? st.cursor : cur;
  return {
    inst,
    title: `${inst} SOUND`,
    lock,
    rows,
    n: list.length,
    cur,
    cursor,
    top: browserClampTop(st.top, rows.length),
    visible: BROWSER_ROWS,
    arm: st.arm >= 0 && st.arm < rows.length && rows[st.arm].user ? st.arm : -1,
    rank: `${cur + 1} / ${list.length}`,
  };
}

/** Ce qui ferme la liste quand il change : la page et son onglet (une touche de page, [ ], H), le P-LOCK, la machine qu'on utilise. */
const browserCloseKey = (): string => {
  const s = rytmPage.get();
  return `${s.page}|${s.tabs[s.page] ?? 0}|${s.view}|${s.detail ?? ''}|${rytmLock.get().step}|${focus.get()}`;
};
let browserWatched = false;
let browserKeyAt = '';
let browserInst: Inst | null = null;

/**
 * Les regles de fermeture, posees au premier navigateur ouvert (pas au chargement du module : ses stores sont alors
 * tous la) : une touche de page, le P-LOCK qui change, une autre machine, EDIT, les presets, plus de voix choisie la
 * ferment ; une autre voix (un pad, le Dock, le MIDI) : la liste la suit, sur son son du moment.
 */
function watchBrowser(): void {
  browserKeyAt = browserCloseKey();
  browserInst = browserVoice();
  if (browserWatched) return;
  browserWatched = true;
  const check = (): void => {
    if (!lcdSamples.isOpen()) return;
    const inst = browserVoice();
    if (inSoundsMenu() && inst) {
      browserKeyAt = browserCloseKey();
    } else if (browserCloseKey() !== browserKeyAt || !inst || editor.get() === 'mm808' || presetMode.on('mm808')) {
      lcdSamples.close();
      return;
    }
    if (inst === browserInst) return;
    browserInst = inst;
    const v = soundBrowserView();
    if (v) lcdSamples.update({ top: browserCenterTop(v.cur, v.rows.length), cursor: -1, arm: -1 });
  };
  rytmPage.subscribe(check);
  rytmLock.subscribe(check);
  focus.subscribe(check);
  editor.subscribe(check);
  presetMode.subscribe(check);
  pattern.subscribe(check);
}

/**
 * Le navigateur s'ouvre sur la voix choisie (une tape sur SOUND, un cran de SOUND, PREV et NEXT) ; deja ouvert, son
 * repos repart. focusList : le clavier le prend (Entree sur le bloc SOUND). false : pas de voix, EDIT ou les presets.
 */
export function soundBrowserOpen(focusList = false): boolean {
  const inst = browserVoice();
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return false;
  }
  if (!pattern.get().instrument && DT2_FACE && !activeHi()) pattern.select(inst);
  if (!inSoundsMenu() && (editor.get() === 'mm808' || presetMode.on('mm808'))) return false;
  watchBrowser();
  if (lcdSamples.isOpen()) {
    lcdSamples.open(0, focusList);
    return true;
  }
  const lock = browserLockStep();
  const list = voiceSounds(inst, lock >= 0);
  lcdSamples.open(browserCenterTop(browserCur(inst, list, lock), list.length + 1), focusList);
  return true;
}

/** Fermee (Echap, une tape hors d'elle : ui/Hotspots.tsx). */
export function soundBrowserClose(): void {
  lcdSamples.close();
}

/** Les tests (window.__v4 n'en a pas besoin : ils importent ce module) : combien d'ecoutes, la derniere ; silent les fait taire. */
export const soundPreview = { count: 0, last: '', silent: false };
let previewSeq = 0;
/** L'ecoute attend son coup exact au plus PREVIEW_WAIT_MS une fois le fichier la (2026-10-21) : plus tard, elle se tait. */
const PREVIEW_WAIT_MS = 1500;

/**
 * L'ecoute d'un son choisi (2026-10-18) : a l'arret seulement (en lecture, le motif le joue), une fois, par le chemin
 * d'un pad (trigger, a la velocite des nouveaux pas de la voix) ; une voix coupee (MUTE) ne sonne pas. Un sample pas
 * encore decode s'attend (sinon la synthese jouerait a sa place) ; un autre choix entre-temps l'emporte.
 * lockStep : en P-LOCK, le pas tel qu'il joue (ses verrous).
 */
function previewSound(inst: Inst, lockStep = -1): void {
  if (clock.running || voices.isMuted(inst)) return;
  const n = (previewSeq += 1);
  const lock = lockStep >= 0 ? lockOf(pattern.get().locks, inst, lockStep) : null;
  const p = lock ? stepPlays(inst, lock) : kit.playsWith(inst as ShotId, null);
  const key = p.smp ? p.sample : undefined;
  // Le contexte audio dans le geste lui-meme (iOS), meme si le coup attend son fichier
  if (!soundPreview.silent) gesture();
  const live = (): boolean => n === previewSeq && !clock.running && !voices.isMuted(inst);
  const go = (): void => {
    if (!live()) return;
    soundPreview.count += 1;
    soundPreview.last = key ? `${inst} ${key}` : inst;
    if (soundPreview.silent) return;
    trigger(inst, undefined, false, undefined, VEL_GAIN[rytmPage.tapVel(inst)] ?? 1, lock);
  };
  // Le coup exact d'abord (2026-10-21, audit RS-2 : l'ecoute partait avant lui et jouait le plus ancien coup de la
  // voix, le kick par defaut, 14 fois sur 15) : son fichier (FETCH_TIMEOUT_MS au plus), puis son calcul en tete de file.
  // Un fichier qui n'a pas pu venir : le repli que la voix joue (OFFLINE: 909 PLAYS), comme le dit l'ecran
  const exact = (): void => {
    if (!live()) return;
    void shotReady(inst, lock, PREVIEW_WAIT_MS).then((ok) => {
      if (ok || soundPreview.silent) go();
    });
  };
  if (key && !samplePcm(key)) void requestSample(key).then(exact);
  else exact();
}

/**
 * Le son i du navigateur pour ce qu'il regarde : la voix (les regles du potard), ou en P-LOCK le pas (le sample lock,
 * comme le bloc glisse : un pas vide recoit un coup) ; l'ecran le dit (msg : un autre mot), la ligne reste en vue, et
 * a l'arret il s'entend.
 */
function browserChoose(v: SoundBrowserView, i: number, msg?: string): void {
  const row = v.rows[i];
  if (!row || row.kind === 'load') return;
  const inst = v.inst;
  if (v.lock >= 0) {
    const steps = rytmLock.targets();
    if (steps.length === 0) return;
    for (const s of steps) if (velocity(pattern.get().steps, inst, s) === 0) pattern.set(inst, s, rytmPage.tapVel(inst));
    soundLockWrite(inst, steps, v.lock, i);
    rytmLock.wrote();
    const who = steps.length > 1 ? `${steps.length} STEPS` : `STEP ${two(v.lock + 1)}`;
    lcdMessage.show(msg ?? `${who} SOUND ${row.label}`, POT_UI.readoutMs, true);
  } else {
    const f = familyOf(inst as ShotId);
    if (!f || row.kind === 'own') return;
    setVoiceSound(f, row as VoiceSound);
    lcdMessage.show(msg ?? `${inst} SOUND ${row.label}  ${i + 1} OF ${v.n}`, POT_UI.readoutMs, true);
    touchPage('voice:sound', inst);
  }
  lcdSamples.update({ cursor: -1, arm: -1 });
  browserReveal(i);
  previewSound(inst, v.lock);
}

/**
 * Une ligne touchee (une tape, Entree) : son son ; + LOAD A FILE... : le choix des fichiers ; la ligne armee (REMOVE?) :
 * elle part.
 */
export function soundBrowserPick(i: number): void {
  const v = soundBrowserView();
  if (!v) return;
  const row = v.rows[i];
  if (!row) return;
  if (v.arm === i) {
    soundBrowserRemove(i);
    return;
  }
  if (row.kind === 'load') {
    lcdSamples.update({ cursor: i, arm: -1 });
    soundFilesPick(v.inst, true);
    return;
  }
  browserChoose(v, i);
}

/** PREV et NEXT (les fleches de l'en-tete ; haut et bas sur le bloc SOUND au clavier) : le son d'avant ou d'apres, la liste ouverte. */
export function soundBrowserStep(dir: -1 | 1): void {
  resume();
  if (!soundBrowserOpen()) return;
  const v = soundBrowserView();
  if (!v) return;
  const i = Math.max(0, Math.min(v.n - 1, v.cur + dir));
  if (i === v.cur) {
    lcdMessage.show(`${v.inst} SOUND: ${dir < 0 ? 'FIRST' : 'LAST'} OF ${v.n}`);
    return;
  }
  browserChoose(v, i);
}

/** La molette, un glisser, Page haut et bas : n lignes plus loin (vers le bas : n > 0). */
export function soundBrowserScroll(n: number): void {
  const v = soundBrowserView();
  if (!v || n === 0) return;
  soundBrowserScrollTo(v.top + n);
}

/** La premiere ligne montree (un doigt qui glisse la liste part de celle du toucher). */
export function soundBrowserScrollTo(top: number): void {
  const v = soundBrowserView();
  if (!v) return;
  const t = browserClampTop(top, v.rows.length);
  if (t !== v.top) lcdSamples.update({ top: t });
  else lcdSamples.touch();
}

/** Le curseur du clavier (haut, bas, Page, Debut, Fin) : n lignes plus loin, ou au bout ; la liste le suit. */
export function soundBrowserCursor(n: number, to?: 'home' | 'end'): void {
  const v = soundBrowserView();
  if (!v) return;
  const last = v.rows.length - 1;
  const i = to === 'home' ? 0 : to === 'end' ? last : Math.max(0, Math.min(last, v.cursor + n));
  lcdSamples.update({ cursor: i, arm: v.arm === i ? i : -1 });
  browserReveal(i);
}

/**
 * Un sample de ce navigateur retire (le x de sa ligne au desktop, Suppr sur elle au clavier, un appui long au
 * telephone) : le premier geste l'arme (REMOVE? TAP AGAIN, BROWSER_ARM_MS), le second le retire de la liste et de ce
 * navigateur ; la voix qui le jouait revient a sa synthese (audio/kit.ts). Un son du site ne part pas. how : le mot du
 * second geste.
 */
export function soundBrowserRemove(i: number, how: 'TAP' | 'CLICK' | 'DELETE' = coarsePointer() ? 'TAP' : 'CLICK'): void {
  const v = soundBrowserView();
  if (!v) return;
  const row = v.rows[i];
  if (!row || row.kind === 'load') return;
  if (!row.user) {
    lcdMessage.show(`${row.label}: BUILT IN, STAYS`);
    lcdSamples.touch();
    return;
  }
  if (v.arm !== i) {
    lcdSamples.update({ arm: i });
    browserReveal(i);
    lcdMessage.show(`REMOVE ${row.label}? ${how} AGAIN`, BROWSER_ARM_MS);
    return;
  }
  lcdSamples.update({ arm: -1 });
  const label = row.label;
  void userSamples.remove(row.key).then((ok) => lcdMessage.show(ok ? `${label} REMOVED` : 'STORAGE OFF', 1600));
}

/* ---------------- SOUNDS sur les pistes 9 a 16 (la face DT2, relecture de la V.6.0) ---------------- */

/*
 * Le navigateur d'avant est celui des 8 voix (leurs familles, leurs machines 909, 808, MM) : une piste 9 a 16 n'a pas de
 * voix du motif. Sa liste SOUNDS est celle de son potard D (SAMP, t:snd ; cahier 3.2 : "liste des samples, D SAMP") :
 * OFF, puis toute la banque (les 8 dossiers du site et tes fichiers), puis + LOAD A FILE... ; la TRIG de la piste est sa
 * pre-ecoute. Les fichiers importes pour elle vont dans la categorie de son sample (sinon de sa machine).
 */

/** Une ligne de la liste SOUNDS d'une piste 9 a 16 : son sample (cle ; '' : OFF ; null : + LOAD A FILE...), nom, categorie. */
export interface TrackSoundRow {
  key: string | null;
  label: string;
  family: string;
}

/** La liste SOUNDS de la piste active quand c'est une piste 9 a 16 ; null : une voix 1 a 8 (le navigateur d'avant) ou aucune. */
export function trackSoundList(): { track: TrackKey; name: string; rows: readonly TrackSoundRow[]; cur: number } | null {
  const t = activeHi();
  if (!t) return null;
  const list = trackSampleList();
  const snd = tracks.of(t).snd;
  const rows: TrackSoundRow[] = list.map((x) => ({ key: x.key, label: x.label, family: x.family }));
  rows.push({ key: null, label: BROWSER_LOAD_LABEL, family: '' });
  return { track: t, name: TRACK_NAMES[trackIndex(t)] ?? t, rows, cur: Math.max(0, list.findIndex((x) => x.key === snd)) };
}

/** Le sample i de la liste pour la piste active 9 a 16 (par le potard D, sa fiche t:snd) ; + LOAD A FILE... : tes fichiers. */
export function trackSoundPick(i: number): void {
  const v = trackSoundList();
  const row = v?.rows[i];
  if (!v || !row) return;
  if (row.key === null) {
    soundFilesPick(v.track, true);
    return;
  }
  dialSpecOf('t:snd')?.set(i);
}

/** La piste active quand c'est une piste 9 a 16 (la face DT2 ; sans elle, la piste active est la voix du motif) ; null sinon. */
function activeHi(): TrackKey | null {
  const t = activeTrack.get();
  return t && !isLegacyTrack(t) ? t : null;
}

/** La categorie des fichiers importes pour une piste 9 a 16 : celle de son sample, sinon de sa machine, sinon BD. */
function trackFamily(t: TrackKey): KitFamily {
  const tr = tracks.of(t);
  const f = sampleFamily(tr.snd);
  if (f) return f;
  return (KIT_FAMILIES as readonly string[]).includes(tr.mach) ? (tr.mach as KitFamily) : 'bd';
}

/** Des fichiers pour une piste 9 a 16 : ils entrent dans sa categorie, le premier devient son sample (D SAMP). */
async function trackFilesAdd(files: readonly File[], t: TrackKey): Promise<number> {
  const f = trackFamily(t);
  const name = TRACK_NAMES[trackIndex(t)] ?? t;
  const snd0 = tracks.of(t).snd;
  lcdMessage.show(`${name} ADDING ${files.length > 1 ? `${files.length} FILES` : sampleLabel(files[0].name)}...`, 8000);
  const added: KitSample[] = [];
  const refused: string[] = [];
  for (const file of files) {
    try {
      added.push(await userSamples.add(f, file));
    } catch (e) {
      refused.push(e instanceof UserSampleError ? e.text : 'NOT AUDIO');
    }
  }
  const why = refused.length === 0 ? '' : files.length === 1 ? refused[0] : `${refused.length} REFUSED: ${refused[0]}`;
  if (added.length === 0) {
    lcdMessage.show(why || 'NOT AUDIO', 2400);
    return 0;
  }
  const s = added[0];
  // Un autre sample choisi pendant l'ajout : le fichier entre dans la liste sans etre pris
  const chosen = tracks.of(t).snd === snd0;
  for (const a of chosen ? added.slice(1) : added) userSamples.release(a.key);
  const more = `${added.length > 1 ? `  +${added.length - 1}` : ''}${why ? `  ${why}` : ''}`;
  if (!chosen) {
    lcdMessage.show(`${name}: ADDED ${s.label}${more}`, 2400);
    return added.length;
  }
  resume();
  tracks.sample(t, s.key);
  lcdMessage.show(`${name} SAMPLE ${s.label}${more}`, 2400);
  return added.length;
}

/** Le champ de fichiers cache (cree au premier + LOAD A FILE...). */
let fileInput: HTMLInputElement | null = null;

/**
 * + LOAD A FILE... (2026-10-18) : le choix de fichiers du systeme (au telephone et dans Safari aussi : un vrai champ,
 * hors de la vue mais pas display none, clique dans le geste), plusieurs a la fois ; ils entrent dans la famille de la
 * voix. fromList : choisi depuis le navigateur (en P-LOCK, le premier verrouille le pas). Une piste 9 a 16 (la face DT2,
 * relecture de la V.6.0) : ils entrent dans sa categorie, le premier devient son sample.
 */
export function soundFilesPick(inst: TrackKey | null = pattern.get().instrument ?? (DT2_FACE ? (activeTrack.get() ?? 'BD') : null), fromList = false): void {
  if (!inst) {
    lcdMessage.show(LCD_NO_VOICE);
    return;
  }
  if (typeof document === 'undefined') return;
  let el = fileInput;
  if (!el) {
    el = document.createElement('input');
    el.type = 'file';
    el.accept = 'audio/*,.wav,.aif,.aiff,.mp3,.flac,.m4a';
    el.multiple = true;
    el.tabIndex = -1;
    el.setAttribute('aria-hidden', 'true');
    el.dataset.v4 = 'sample-file';
    el.style.cssText = 'position:fixed;left:-10000px;top:0;width:1px;height:1px;opacity:0;pointer-events:none';
    document.body.appendChild(el);
    fileInput = el;
  }
  const input = el;
  // La liste ne se ferme pas d'elle-meme pendant le choix (le repos repart a son retour : un fichier, Annuler, la fenetre
  // qui reprend la main ; une minute au plus si rien ne le dit)
  const release = lcdSamples.hold();
  const stop = window.setTimeout(() => done(), 60000);
  const onFocus = (): void => {
    window.setTimeout(() => done(), 1500);
  };
  const done = (): void => {
    window.clearTimeout(stop);
    window.removeEventListener('focus', onFocus);
    release();
  };
  window.addEventListener('focus', onFocus);
  input.oncancel = done;
  input.onchange = () => {
    const files = input.files ? Array.from(input.files) : [];
    input.value = '';
    if (files.length > 0) void (isLegacyTrack(inst) ? soundFilesAdd(files, inst, fromList) : trackFilesAdd(files, inst)).finally(done);
    else done();
  };
  input.value = '';
  input.click();
}

/** Le dernier ajout de fichiers parti pour chaque famille (2026-10-21) : seul lui choisit son fichier a la fin. */
let addSeq = 0;
const addLast: Partial<Record<KitFamily, number>> = {};

/**
 * Des fichiers pour une voix (glisses sur un pad, choisis par + LOAD A FILE...) : tous entrent dans sa famille
 * (audio/usersamples.ts : 10 Mo, 12 s, 60 par famille au plus), le premier joue tout de suite (les regles du potard ;
 * depuis la liste ouverte en P-LOCK, il verrouille le pas), l'ecran dit BD SAMPLE <NOM> et ce qui a ete refuse
 * (TOO BIG: 10 MB MAX...), a l'arret il s'entend. Rend le nombre de samples ajoutes.
 */
export async function soundFilesAdd(files: readonly File[], inst: Inst, fromList = false): Promise<number> {
  const f = familyOf(inst as ShotId);
  if (!f || files.length === 0) return 0;
  // Le dernier geste gagne (2026-10-21, audit RS-3) : ce qui est la au depart de l'ajout
  const token = (addSeq += 1);
  addLast[f] = token;
  const gen0 = kit.choice(f);
  const lock0 = browserLockStep();
  lcdMessage.show(`${inst} ADDING ${files.length > 1 ? `${files.length} FILES` : sampleLabel(files[0].name)}...`, 8000);
  const added: KitSample[] = [];
  const refused: string[] = [];
  // Le navigateur ouvert ne se ferme pas pendant que les fichiers entrent (un gros fichier se decode)
  const release = lcdSamples.hold();
  try {
    for (const file of files) {
      try {
        added.push(await userSamples.add(f, file));
      } catch (e) {
        refused.push(e instanceof UserSampleError ? e.text : 'NOT AUDIO');
      }
    }
  } finally {
    release();
  }
  const why = refused.length === 0 ? '' : files.length === 1 ? refused[0] : `${refused.length} REFUSED: ${refused[0]}`;
  if (added.length === 0) {
    lcdMessage.show(why || 'NOT AUDIO', 2400);
    return 0;
  }
  const s = added[0];
  // Un autre son choisi pendant l'ajout, une autre voix, un autre pas en P-LOCK, ou un ajout parti apres celui-ci : le
  // fichier entre dans la liste, sans etre choisi ni joue (avant, il ecrasait le choix fait apres lui)
  const chosen = !(addLast[f] !== token || kit.choice(f) !== gen0 || pattern.get().instrument !== inst || browserLockStep() !== lock0);
  // Seul le fichier qui va jouer garde le son decode a l'ajout (2026-10-22, revue RA1-4) : les autres le gardaient pour
  // la visite, hors du budget des samples ; ils se decodent a leur premier choix
  for (const a of chosen ? added.slice(1) : added) userSamples.release(a.key);
  if (!chosen) {
    lcdMessage.show(`${inst}: ADDED ${s.label}${added.length > 1 ? `  +${added.length - 1}` : ''}${why ? `  ${why}` : ''}`, 2400);
    return added.length;
  }
  const msg = `${inst} SAMPLE ${s.label}${added.length > 1 ? `  +${added.length - 1}` : ''}${why ? `  ${why}` : ''}`;
  const v = soundBrowserView();
  const i = v && v.inst === inst ? v.rows.findIndex((r) => r.kind === 'smp' && r.key === s.key) : -1;
  if (v && i >= 0 && (fromList || v.lock < 0)) {
    browserChoose(v, i, msg);
    return added.length;
  }
  setVoiceSound(f, { kind: 'smp', key: s.key });
  touchPage('voice:sound', inst);
  lcdMessage.show(msg, 2400);
  previewSound(inst);
  return added.length;
}

/**
 * Un fichier lache sur le MM-RYTM (2026-10-18, desktop ; ui/Hotspots.tsx) : sur un pad, sa voix (choisie, sans un
 * son) ; ailleurs sur la machine, la voix choisie ; sans voix, l'ecran demande un pad (au desktop, sans pads depuis
 * le 2026-10-27, une voix : theme.ts LCD_DROP_NO_VOICE).
 */
export function soundDrop(files: readonly File[], inst: Inst | null): void {
  lcdSamples.dragOver(null);
  const target = inst ?? pattern.get().instrument;
  if (!target) {
    lcdMessage.show(LCD_DROP_NO_VOICE);
    return;
  }
  if (files.length === 0) {
    lcdMessage.show('NOT AUDIO');
    return;
  }
  if (pattern.get().instrument !== target) selectVoice(target);
  void soundFilesAdd(files, target);
}
