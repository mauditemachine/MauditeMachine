/**
 * Actions partagees (spec 7.2 et 20.6.2) : la couche de saisie, le Dock,
 * le panneau, le clavier et les jumeaux HTML passent tous par ici, pour
 * qu'un objet se comporte pareil d'ou qu'il soit actionne. Ordre d'un coup
 * de pad : le son, puis l'etat (instrument selectionne), puis l'animation.
 * Chaque action relance le contexte audio s'il dort (regle iOS).
 */

import './actions/state';
import './actions/shared';
export * from './actions/tracks';
export * from './actions/scenes';
export * from './actions/nav';
export * from './actions/steps';
export * from './actions/patterns';
export * from './actions/transport';
export * from './actions/dials';
export * from './actions/anyDial';
export * from './actions/kit';
export * from './actions/pages';
export * from './actions/locks';
export * from './actions/browser';
export * from './actions/face';
export * from './actions/live';
export * from './actions/phone';
export * from './actions/presets';
export * from './actions/mixer';
export { gesture } from './actions/shared';
import './actions/wire';
