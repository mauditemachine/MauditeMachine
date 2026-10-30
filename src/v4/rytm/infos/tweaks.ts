/** Les cartes INFOS du MM-RYTM : la plaque TWEAKS et un potard sans bloc (deplacees telles quelles de la table RAW de rytm/infos.ts en P0, 2026-10-30). */

import { type RytmInfoId } from '../diagrams';
import type { Raw } from './types';

export const RAW_TWEAKS = {
  /* ---------- la plaque TWEAKS (OPEN) : les choix de son ---------- */
  'r:bd': {
    section: 'VOICE',
    title: 'KICK',
    text: "Le son du kick : 909, 808 ou MM (la synthèse seule, remise à fond, le sample coupé), puis les samples de Mika, chacun à son nom (le sample seul, la synthèse à 0). Il se choisit à l'écran : touche le nom du son (SOUND, sur VOICE quand BD est choisi), toute la liste s'ouvre ; au MIDI, rytm:kit:bd. Pour un sample et une machine ensemble : MIX (VOICE SYNTH). Tous sortent à la même crête : changer de kick ne change pas le niveau.",
    tip: '909 pour une techno qui claque, 808 pour un minimal rond et long, un sample de Mika pour l’indie dance.',
  },
  'r:sd': {
    section: 'VOICE',
    title: 'SNARE',
    text: "Le son de la caisse claire : 909, 808 ou MM (la synthèse seule, à fond), puis les samples de Mika (le sample seul). À l'écran (SOUND, sur VOICE quand SD est choisi) et au MIDI (rytm:kit:sd). SNAPPY, sous le capot (OPEN), règle son timbre, synthèse et sample ; pour les deux couches ensemble, MIX (VOICE SYNTH).",
    tip: 'MM avec GATE sur ON pour la dark disco des années 80.',
  },
  'r:cp': {
    section: 'VOICE',
    title: 'CLAP',
    text: "Le son du clap : 909, 808 ou MM, sa machine, remise à fond, puis ses samples (le sample seul). À l'écran (SOUND, sur VOICE quand CP est choisi) et au MIDI (rytm:kit:cp). GATE (OPEN) lui donne sa petite pièce en MM et en 909.",
    tip: '909 avec GATE sur ON : le clap large de la dark disco ; 808, sec et court, pour un minimal.',
  },
  'r:ch': {
    section: 'VOICE',
    title: 'CL HAT',
    text: "Le son du charley fermé, CH : 909, 808 ou MM, sa machine, remise à fond, puis ses samples (le sample seul). À l'écran (SOUND, sur VOICE quand CH est choisi) et au MIDI (rytm:kit:ch) ; OH a son propre choix.",
    tip: '808 pour un minimal métallique, 909 pour une house qui respire.',
  },
  'r:oh': {
    section: 'VOICE',
    title: 'OP HAT',
    text: "Le son du charley ouvert, OH : 909, 808 ou MM, sa machine, remise à fond, puis ses samples (le sample seul). Au départ, OH joue le premier sample de Mika, un vrai open hat de ses projets, la synthèse à 0 ; il sort un peu au-dessus du charley fermé et bien sous le kick. Le MM, refait le 2026-10-18, souffle comme une vraie cymbale et s'éteint tout seul. À l'écran (SOUND, sur VOICE quand OH est choisi) et au MIDI (rytm:kit:oh).",
    tip: 'Un 909 ouvert sur les contretemps au-dessus d’un CH 808 : la house qui respire ; le sample de Mika, plus court, pour une techno serrée.',
  },
  'r:tom': {
    section: 'VOICE',
    title: 'TOM',
    text: "Le son du tom grave, TOM : 909, 808 ou MM, sa machine, remise à fond, puis ses samples (le sample seul). À l'écran (SOUND, sur VOICE quand TOM est choisi) et au MIDI (rytm:kit:tom) ; HT a son propre choix.",
    tip: '808 pour des toms ronds de dark disco ; MM, plus courts, pour une ligne de percussions minimal accordée en P-LOCK.',
  },
  'r:ht': {
    section: 'VOICE',
    title: 'HI TOM',
    text: "Le son du tom aigu, HT : 909, 808 ou MM, sa machine, remise à fond, puis ses samples (toms aigus, percussions, congas, rims ; le sample seul). À l'écran (SOUND, sur VOICE quand HT est choisi) et au MIDI (rytm:kit:ht).",
    tip: 'HT en 909 au-dessus d’un TOM 808 : deux timbres pour une relance de toms.',
  },
  'r:cy': {
    section: 'VOICE',
    title: 'CYMBAL',
    text: "Le son de la cymbale, CY : sa synthèse (909, 808 et MM donnent aujourd'hui le même son calculé), puis ses samples (cymbales, crashs, rides ; le sample seul). À l'écran (SOUND, sur VOICE quand CY est choisi) et au MIDI (rytm:kit:cy).",
    tip: 'Un crash de Mika sur le premier pas, verrouillé plus doux en P-LOCK sur le neuvième : la mesure respire.',
  },

  /* ---------- un potard de la face sans bloc sur sa case (2026-10-27, les potards suivent la page) ---------- */
  'knob:empty': {
    section: 'KEYS',
    title: 'KNOB',
    text: "Rien sur cette page sous ce potard. Chaque potard à droite de l'écran tourne la valeur posée à la même place sur l'écran (A en haut à gauche, E en bas à gauche) : une case vide à l'écran, un potard qui ne fait rien. Change de page (TRIG, SRC, FLTR, AMP, FX ; FUNC + TRIG, FX ou MOD pour TEMPO, SEND FX et le MIXER) : les huit potards suivent. ● REC allumé, un pas tenu : ils posent son P-LOCK ; une scène armée (SCENE A ou B) : ils écrivent dans la scène ; le crossfader : leurs anneaux montrent ce qu'on entend, en lueur la bande entre A et B.",
    phone: { text: "Rien sur cette page sous ce potard. Chaque potard à droite de l'écran tourne la valeur posée à la même place sur l'écran (A en haut à gauche, E en bas à gauche) : une case vide à l'écran, un potard qui ne fait rien. Change de page (VOICE, FLTR, ENV, FX) : les huit potards suivent. Un pas tenu : ils posent son P-LOCK ; une scène armée (SCENE A ou B) : ils écrivent dans la scène ; le crossfader : leurs anneaux montrent ce qu'on entend, en lueur la bande entre A et B." },
  },
} satisfies Partial<Record<RytmInfoId, Raw>>;
