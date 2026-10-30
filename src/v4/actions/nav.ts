/**
 * Les actions du MM-RYTM : la navigation (pages, resetView, sections, OPEN, le capot, les puces, Echap, la machine voisine). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/nav.ts.
 */

import { resume } from '../audio/drums';
import { INSTRUMENTS, pattern } from '../audio/pattern';
import type { Stage } from '../scene/renderer';
import { bassExplode, chipsLive, explode, voyExplode, type ExplodeStore } from '../state/explode';
import { bassInfos } from '../state/bassInfos';
import { voyInfos } from '../state/voyInfos';
import { rytmInfos } from '../state/rytmInfos';
import { focus, MACHINES, VOYAGER, type Focus, type MachineId } from '../state/focus';
import { lcdMessage } from '../state/lcdMessage';
import { lcdSamples } from '../state/lcdSamples';
import { contactDraft, type ContactTopic } from '../state/contactDraft';
import { editor } from '../state/editor';
import { presetMode } from '../state/presetMode';
import { func } from '../state/func';
import { dtFace } from '../state/dtFace';
import { presskit } from '../state/presskit';
import { rytmPage } from '../state/rytmPage';
import { rytmLock } from '../state/rytmLock';
import { trk } from '../state/trk';
import { sceneCtl } from '../state/sceneCtl';
import { isRytmPage } from '../rytm/pages';
import { section } from '../state/section';
import { voices } from '../state/voices';
import { BOARD_CHIPS, DT_FACE, MOBILE_QUERY, isPage, type ChipId, type Inst, type PageId, type SectionId } from '../theme';
import { ctlAllUndo } from './ctlall';
import { muteVoice, selectVoice, soloVoice } from './internal/tracks';
import { bankViewClose } from './internal/patterns';
import { rytmFxClose } from './pages';
import { funcDrop } from './face';

/**
 * Pad de page (spec 20.6.2 PAGE) : tape, touches 1 a 7, jumeau, onglet.
 * Ouvre sa section, ou la ferme si elle l'est deja ; le pad s'enfonce.
 */
export function page(id: PageId, stage: Stage | null): void {
  resume();
  // CONTACT ouvert directement : l'objet propose est Booking
  if (id === 'contact' && section.get() !== 'contact') contactDraft.set('booking');
  // Arrive par /presskit (2026-10-01) : PRESS rouvre la visionneuse, sur sa section
  if (id === 'press' && presskit.fromRoute()) {
    section.set('press');
    presskit.open('press');
    pressPage(id, stage);
    return;
  }
  section.toggle(id);
  pressPage(id, stage);
}

/** Le pad de page de la 808 s'enfonce (le MM-VOYAGER a ses pages sur la carte, pas de touche). */
function pressPage(id: PageId, stage: Stage | null): void {
  if (focus.get() === 'voy' || focus.get() === 'dj' || focus.get() === 'bass') return;
  stage?.pressRytmPad(id);
}

/** RESET VIEW, touche R, double tape du fond : retour a la vue par defaut (500 ms). */
export function resetView(stage: Stage | null): void {
  stage?.orbit.reset();
}

/** Choix de l'instrument sans le jouer (rangee du Dock) ; le meme une seconde fois : plus de selection (tout le pattern). */
export function selectInstrument(inst: Inst): void {
  resume();
  if (voices.get().soloMode) {
    soloVoice(inst);
    return;
  }
  if (voices.get().muteMode) {
    muteVoice(inst);
    return;
  }
  selectVoice(pattern.get().instrument === inst ? null : inst);
}

/**
 * La voix a regler (KNOBS du telephone, rangee VOICES) : la choisir, hors
 * des modes MUTE et SOLO (elle ne se coupe pas en passant).
 */
export function tuneVoice(inst: Inst): void {
  resume();
  selectVoice(pattern.get().instrument === inst ? null : inst);
}

/**
 * INFOS du MM-RYTM allume (R4), une commande touchee au doigt (la face, la
 * feuille de sa carte, le Dock : dock) : sa carte, et la commande n'agit pas ;
 * sauf pour naviguer, sans un son : une touche de page (sur la face, au pied
 * de l'ecran, dans le Dock) tourne quand meme la page, un pad choisit sa voix
 * (jamais deselectionnee, ni MUTE ni SOLO). Au doigt, c'est le seul moyen de
 * lire les reglages des autres pages et des autres voix ; la revue de R4 :
 * une tape a travers la feuille sautait cette navigation, les cartes
 * suivantes parlaient d'une autre page. true : INFOS l'a prise ; eteint,
 * false (la commande agit).
 */
export function rytmInfoTap(hotspot: string, dock = false): boolean {
  if (!rytmInfos.isOn()) return false;
  if (dock) rytmInfos.dock(hotspot);
  else rytmInfos.show(hotspot);
  const pk = /^(?:pkey|lcd-tab)-([a-z]+)$/.exec(hotspot);
  if (pk && isRytmPage(pk[1])) rytmPage.setPage(pk[1]);
  const pad = /^pad-([A-Z]+)$/.exec(hotspot);
  const inst = pad && (INSTRUMENTS as readonly string[]).includes(pad[1]) ? (pad[1] as Inst) : null;
  if (inst && pattern.get().instrument !== inst) tuneVoice(inst);
  return true;
}

/** Onglet de la feuille, raccourci : ouvre une section (sans bascule). */
export function openSection(s: SectionId): void {
  section.set(s);
}

/**
 * Ouvre CONTACT avec l'objet (et le message) propose selon d'ou vient le
 * visiteur : booking, live, merch, lesson, press (2026-10-01).
 */
export function openContact(topic: ContactTopic, subject?: string, message?: string): void {
  contactDraft.set(topic, subject, message, true);
  section.set('contact');
}

/** Bouton x, Echap, glisser de la feuille. */
export function closeSection(): void {
  section.set(null);
}

/**
 * OPEN / CLOSE (spec 7.2 OPEN_TOGGLE) : la vue eclatee, depuis un etat pose
 * seulement ; la musique continue ; le pad OPEN s'enfonce. true si la
 * demande est prise.
 */
export function openToggle(stage: Stage | null = null, which: MachineId = hoodMachine()): boolean {
  // Le MM-DECKS n'a pas de capot ; le MM-BASS a le sien depuis le 2026-10-08 (sa touche OPEN est sur sa face)
  if (which === 'dj') return false;
  resume();
  // Le logo M (V.5.0) : FUNC s'en va (la revue de D1, G2)
  if (which === 'mm808') funcDrop();
  const ok = hoodOf(which).toggle();
  if (ok) {
    if (which === 'voy') stage?.voy?.keys.pressButton('open');
    else if (which === 'mm808') stage?.pressRytmPad('open');
  }
  return ok;
}

/** La machine dont OPEN, GOODIES, MERCH, STUDIO et CLOSE ouvrent le capot : celle qu'on utilise (vue d'ensemble : la 808). */
export function hoodMachine(): MachineId {
  return focus.machine() ?? 'mm808';
}

/** Le capot d'une machine (le MM-DECKS n'en a pas : celui de la 808). */
export function hoodOf(m: MachineId): ExplodeStore {
  return m === 'voy' ? voyExplode : m === 'bass' ? bassExplode : explode;
}

/**
 * Puce de la vue eclatee (spec 20.6.2 CHIP, revision 4) : GOODIES, MERCH
 * et STUDIO ouvrent leur section ou la referment (bascule, comme un pad de
 * page)
 * (inchange) ; LABEL, un lien, ouvre sa page Bandcamp dans un onglet sans
 * opener ni referer, seulement quand son jumeau manque (sinon le jumeau,
 * un vrai lien, fait le travail).
 */
export function chipAction(id: ChipId, which: MachineId = 'mm808'): void {
  if (!chipsLive(hoodOf(which).get())) return;
  const c = BOARD_CHIPS.find((k) => k.id === id);
  if (!c) return;
  // Les pages sur la carte (les deux machines) : CONTACT propose Booking, PRESS rouvre la visionneuse
  if (c.section && isPage(c.section)) page(c.section, null);
  else if (c.section) section.toggle(c.section);
  else if (c.href) window.open(c.href, '_blank', 'noopener,noreferrer');
}

/**
 * Echap (spec 7.2) : ferme la section ouverte, sinon referme la vue
 * eclatee, sinon deselectionne l'instrument ; true si quelque chose a
 * change.
 */
export function escape(fromNo = false): boolean {
  // Echap annule toujours la reprise des presets fermes par l'attente (2026-10-22, la revue) : la fleche suivante
  // change de machine, comme promis
  presetMode.forget();
  // FUNC gardee (V.5.0) : Echap la relache d'abord
  if (DT_FACE && func.engaged()) {
    func.cancel();
    return true;
  }
  if (section.get() !== null) {
    section.set(null);
    return true;
  }
  // Le mode presets d'abord (2026-10-27 : un cran en arriere, le nom, OVERWRITE / AS NEW et DELETE? reviennent a la
  // liste, la liste se ferme), puis un editeur ouvert (EDIT)
  if (presetMode.get().machine) return presetMode.back();
  // Le navigateur des sons (2026-10-18) : par-dessus l'ecran (le P-LOCK compris), Echap le ferme d'abord
  if (lcdSamples.isOpen()) {
    lcdSamples.close();
    return true;
  }
  // Un CONTROL ALL en cours (V.5.2, la revue de D3a, R4) : Echap l'annule, puis eteint TRK gardee
  if (ctlAllUndo()) return true;
  // TRK gardee ou en fermeture (2026-10-27) : Echap l'eteint, avant le P-LOCK ; tenue, la main la lachera
  const tk = trk.get().mode;
  if (tk === 'latched' || tk === 'closing') {
    trk.cancel();
    return true;
  }
  // La vue BANK (V.5.2) : Echap la ferme
  if (DT_FACE && dtFace.bank()) {
    bankViewClose();
    return true;
  }
  // Le mode MUTE (V.5.0, FUNC + TRK) : Echap en sort, les mutes restent
  if (DT_FACE && dtFace.mute() !== 'off' && focus.get() === 'mm808') {
    dtFace.setMute('off');
    lcdMessage.show('MUTE MODE OFF');
    return true;
  }
  // Une scene gardee (2026-10-27) : Echap la desarme, avant le P-LOCK ; tenue, la main la lachera
  if (sceneCtl.get().how === 'latched') {
    sceneCtl.cancel();
    lcdMessage.show('SCENE OFF');
    return true;
  }
  // Le LOCK du MM-RYTM (2026-10-08) : Echap en sort, avant de fermer EDIT
  if (rytmLock.leave()) {
    lcdMessage.show('P-LOCK OFF');
    return true;
  }
  // MUTE et SOLO (2026-10-09) : Echap sort du mode, les voix coupees (en solo) le restent ; seulement devant le MM-RYTM
  // (revue : depuis le MM-BASS, la premiere Echap desarmait le RYTM au lieu d'eteindre BASS INFOS)
  const vm = voices.get();
  if ((vm.muteMode || vm.soloMode) && focus.get() === 'mm808') {
    const k = vm.muteMode ? 'mute' : 'solo';
    voices.disarm(k);
    lcdMessage.show(`${k === 'mute' ? 'MUTE' : 'SOLO'} OFF`);
    return true;
  }
  if (editor.get() !== null) {
    editor.close();
    return true;
  }
  // INFOS du MM-BASS (2026-10-08) : Echap l'eteint avant de refermer le capot
  // INFOS du MM-BASS : seulement quand on le voit (ailleurs, Echap ferme le capot de la machine a l'ecran)
  if (bassInfos.isOn() && focus.get() === 'bass') {
    bassInfos.set(false);
    return true;
  }
  // INFOS du MM-ARP (2026-10-08, la touche i du grand ecran) : de meme, quand on le voit
  if (voyInfos.isOn() && focus.get() === 'voy') {
    voyInfos.set(false);
    return true;
  }
  // INFOS du MM-RYTM (R4, la touche i de son ecran) : de meme, apres le LOCK et EDIT, avant le capot
  if (rytmInfos.isOn() && focus.get() === 'mm808') {
    rytmInfos.set(false);
    return true;
  }
  // La page d'un FX global (2026-10-10) : Echap revient a GLOBAL FX, quand on la voit (devant le MM-RYTM, vue PAGE)
  if (focus.get() === 'mm808' && rytmFxClose()) return true;
  const hood = hoodOf(hoodMachine());
  if (hood.get() === 'open') return hood.toggle();
  if (pattern.get().instrument !== null && focus.get() !== 'voy' && focus.get() !== 'dj' && focus.get() !== 'bass') {
    selectVoice(null);
    return true;
  }
  // Deux machines, desktop : Echap revient a la vue d'ensemble (pas NO, la touche de la machine : V.5.0)
  if (!fromNo && VOYAGER && focus.get() !== 'all' && !window.matchMedia(MOBILE_QUERY).matches) {
    focus.set('all');
    return true;
  }
  return false;
}

/* ---------------- deux machines, MM-VOYAGER (2026-10-03) ---------------- */

/** Zoom sur une machine (clic sur elle, glisser au telephone), ou la vue d'ensemble. */
export function focusMachine(f: Focus): void {
  focus.set(f);
}

/**
 * Fleches gauche et droite (2026-10-05, Mika : "naviguer entre les machines
 * avec les fleches gauche droite") : la machine d'a cote, dans l'ordre de la
 * scene et du selecteur de l'en-tete (ALL, RYTM, BASS, ARP, DECKS ; ALL
 * seulement sur desktop) ; aux bouts, rien. true si la vue a change.
 */
export function stepMachine(dir: -1 | 1): boolean {
  if (!VOYAGER) return false;
  const order: readonly Focus[] = window.matchMedia(MOBILE_QUERY).matches ? MACHINES : ['all', ...MACHINES];
  const i = order.indexOf(focus.get());
  const next = order[Math.max(0, Math.min(order.length - 1, (i < 0 ? 0 : i) + dir))];
  if (next === undefined || next === focus.get()) return false;
  focus.set(next);
  return true;
}
