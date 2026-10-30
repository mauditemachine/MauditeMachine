/** Les INFOS du MM-RYTM : les mots partages par les cartes (desktop et telephone, phrases de verrou, espaces du francais). Deplaces de rytm/infos.ts en P0. */

import { BLOCKS_ARE_KNOBS, GLOBAL_ENCODERS } from '../../theme';
import type { RytmLockable } from './types';

/** Le telephone : pas d'encodeurs sur la face, les blocs de l'ecran se glissent au doigt. */
export const PHONE = BLOCKS_ARE_KNOBS;
/** La tape qui ouvre la page d'un FX (V.4.2, 2026-10-27) : au desktop l'ecran ne se touche plus, c'est celle de son potard. */
export const TAP_KNOB = PHONE ? '' : ' ; au desktop, sur son potard';

/**
 * Les mots d'une carte au desktop depuis V.5.0 (la revue de D1, T1) : les noms de la face facon Digitakt (SRC, SRC SYNTH,
 * AMP, SEND FX, PTN, FUNC + le triangle de PLAY pour CLEAR, le potard A pour la liste des sons : l'ecran ne se touche pas) ;
 * le telephone garde les mots d'avant. Ce que nomme l'ancien nom ("l'ancien GLOBAL FX", "l'ancienne page VOICE") reste ;
 * VOICE FX aussi (l'onglet de la voix de la page FX). Dans l'ordre : la tape d'un FX avant GLOBAL FX. Sans lookbehind (Safari
 * avant 16.4 refuse le module entier) : l'ancien nom se capture et se rend tel quel.
 */
export const keepOld =
  (to: string) =>
  (m: string, old?: string): string =>
    old ? m : to;
export const DESK_WORDS: readonly (readonly [RegExp, string | ((m: string, old?: string) => string)])[] = [
  [/une tape sur son bloc de GLOBAL FX ; au desktop, sur son potard/g, 'une tape sur son potard, page SEND FX'],
  [/une tape sur son bloc ; au desktop, sur son potard/g, 'une tape sur son potard'],
  [/VOICE SYNTH/g, 'SRC SYNTH'],
  [/\(VOICE\)/g, '(SRC)'],
  // DEC et START de la page AMP (le ENV de FLTR, l'enveloppe du filtre, reste ENV)
  [/\b(DEC|START) \(ENV\)/g, '$1 (AMP)'],
  [/\(VOICE, FLTR, ENV, FX\)/g, '(TRIG, SRC, FLTR, AMP, FX)'],
  [/\(FLTR, ENV, FX\)/g, '(FLTR, AMP, FX)'],
  [/(ancienne )?page VOICE\b(?! FX)/g, keepOld('page SRC')],
  [/(ancienne )?page ENV\b/g, keepOld('page AMP')],
  [/\b(touche|sur|de) VOICE\b(?! FX)/g, '$1 SRC'],
  [/(ancien )?GLOBAL FX/g, keepOld('SEND FX')],
  [/touche le nom du son/g, 'clique le potard A'],
  [/rangée VEL de EDIT/g, 'rangée VEL de PTN'],
  [/CLEAR remet tout à 0/g, 'FUNC + ▶ (CLEAR, REC éteint) remet tout à 0'],
  [/, CLEAR tous ceux du pas/g, ', FUNC + ▶ (CLEAR) tous ceux du pas'],
];
export const deskWords = (x: string): string => DESK_WORDS.reduce((s, [re, to]) => (typeof to === 'string' ? s.replace(re, to) : s.replace(re, to)), x);

/** Les mots d'une carte au telephone : un bloc se touche et se glisse, il ne se clique pas ; au desktop, ses noms (deskWords). */
export const phoneWords = (x: string): string => (!PHONE ? deskWords(x) : x.replace(/deux clics/g, 'deux tapes').replace(/ ou sa molette/g, ''));

/**
 * Une voix a choisir d'abord (2026-10-27) : au telephone, un pad ; la face V.4.0 du desktop n'a plus de pads, une voix se
 * choisit avec TRK et un pas de 1 a 8 (la phase 2), au clavier (A S D F, Z X C V) ou au MIDI.
 */
export const PICK = PHONE ? "Touche d'abord un pad." : "Choisis d'abord une voix : TRK et un pas de 1 à 8, ou le clavier (A S D F, Z X C V).";

/** Les espaces insecables du francais (Quebec) et l'apostrophe typographique (comme bass/infos.ts). */
export const fr = (x: string): string =>
  x
    .replace(/([A-Za-zÀ-ÿ])'([A-Za-zÀ-ÿ])/g, '$1’$2')
    .replace(/ :/g, ' :')
    .replace(/(\d) (ms|s|Hz|kHz|dB|dBFS|%|demi-tons?|pas|mesures?|BPM|px|octaves?|cents)(?![A-Za-zÀ-ÿ])/g, '$1 $2');

/** La phrase du verrou, ajoutee au texte d'un reglage des ecrans. */
export const LOCK_LINE: Readonly<Record<RytmLockable, string>> = {
  yes: 'Se verrouille pas par pas (P-LOCK) : un pas peut garder sa propre valeur.',
  no: "Pas verrouillable : en P-LOCK, son bloc affiche NO LOCK à la place de son unité, et l'écran le dit si tu le glisses.",
  global: "Global : tout le MM-RYTM, jamais verrouillé sur un pas ; en P-LOCK, son bloc dit GLOBAL à la place de son unité, et l'écran le rappelle si tu le glisses (IS GLOBAL: NO P-LOCK).",
  vel: "En P-LOCK, c'est la vélocité du pas lui-même, comme sur une Elektron.",
};

export const NO_BD = "BD est choisi : ce réglage ne touche pas le kick (NO BD à l'écran) ; pour lui, VOICE FX.";

/**
 * Un FX global a aussi son encodeur (2026-10-09 au desktop, au telephone aussi depuis le 2026-10-19) : la phrase ajoutee
 * a sa carte ; seulement les huit des encodeurs (2026-10-10 : les reglages de leurs pages, TIME et FEEDBACK compris,
 * n'en ont pas).
 */
export const ENC_LINE = PHONE
  ? "C'est aussi l'un des huit encodeurs sous l'écran, toujours le même : glisse-le de haut en bas, l'écran passe sur sa page (GLOBAL FX pour STRETCH et SWING), son bloc cerné."
  : "C'est aussi l'un des huit encodeurs à droite de l'écran, toujours le même : tourne-le, son anneau suit la valeur, l'écran passe sur sa page (GLOBAL FX pour STRETCH et SWING), son bloc cerné.";
export const ENC_IDS: ReadonlySet<string> = new Set(GLOBAL_ENCODERS);
/**
 * Au desktop depuis le 2026-10-27 (les potards suivent la page) : chaque bloc a son potard a droite de l'ecran, a sa
 * place ; la phrase ajoutee a la carte d'un reglage des ecrans (le telephone garde ENC_LINE sur ses FX globaux).
 */
export const FACE_LINE = "Il a aussi son potard à droite de l'écran, à la même place que son bloc (A en haut à gauche, E en bas à gauche) : tourne-le, son anneau suit la valeur.";
