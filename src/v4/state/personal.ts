/**
 * PERSONALIZE de la face DT2 (V.6.0, cahier dt2 3.11 ; le store de la lane B5, sorti de scene/screen/menus/settings.ts a
 * la relecture de la V.6.0 pour que la saisie des pages et la face le lisent sans importer l'ecran) : LED INTENSITY (LOW,
 * MID, MAX), LED BACKLIGHT, REMEMBER SUBPAGE, TRK SELECT (NORMAL, SILENT, MANUAL, INVERTED). Garde dans ce navigateur
 * (mm.v4.rytm.personalize.1) ; la saisie lit sa vue dans dtFace.personal (state/dtFace.ts), posee d'ici.
 * - LED INTENSITY et LED BACKLIGHT : la lueur des touches de la face 3D (scene/rytmFaceKeys.ts setPersonal) ;
 * - REMEMBER SUBPAGE : une touche de page rouvre la sous-page ou on l'a laissee (OFF : sa premiere sous-page,
 *   actions/internal/pages.ts) ;
 * - TRK SELECT : TRK + TRIG (la saisie, actions/internal/keys60.ts).
 */

import { dtFace, type LedIntensity, type TrkSelect } from './dtFace';

export const PERSONALIZE_KEY = 'mm.v4.rytm.personalize.1';
export type { LedIntensity, TrkSelect } from './dtFace';
export interface Personalize {
  led: LedIntensity;
  backlight: boolean;
  /** une touche de page rouvre la sous-page ou on l'a laissee (sinon la premiere) */
  subpage: boolean;
  /** TRK + TRIG (manuel DT2 14.7) : NORMAL choisit et joue, SILENT choisit sans jouer, MANUAL, INVERTED */
  trkSelect: TrkSelect;
}
/** Le depart : la machine d'aujourd'hui (TRK SELECT NORMAL est le comportement de la V.5.x, cahier 3.2). */
export const PERSONALIZE_DEFAULT: Readonly<Personalize> = { led: 'max', backlight: true, subpage: true, trkSelect: 'normal' };
export const LEDS: readonly LedIntensity[] = ['low', 'mid', 'max'];
export const TRKS: readonly TrkSelect[] = ['normal', 'silent', 'manual', 'inverted'];

let pers: Personalize | null = null;
const persListeners = new Set<() => void>();
function persLoad(): Personalize {
  if (pers) return pers;
  pers = { ...PERSONALIZE_DEFAULT };
  try {
    const o = JSON.parse(window.localStorage.getItem(PERSONALIZE_KEY) ?? 'null') as Partial<Personalize> | null;
    if (o && typeof o === 'object') {
      if (LEDS.includes(o.led as LedIntensity)) pers.led = o.led as LedIntensity;
      if (typeof o.backlight === 'boolean') pers.backlight = o.backlight;
      if (typeof o.subpage === 'boolean') pers.subpage = o.subpage;
      if (TRKS.includes(o.trkSelect as TrkSelect)) pers.trkSelect = o.trkSelect as TrkSelect;
    }
  } catch {
    // illisible : le depart
  }
  return pers;
}
/** La saisie (state/dtFace.ts personal, B4) prend LED INTENSITY, LED BACKLIGHT et TRK SELECT (l'integration de la V.6.0). */
const toFace = (p: Readonly<Personalize>): void => dtFace.setPersonal({ led: p.led, backlight: p.backlight, trkSelect: p.trkSelect });

/** Les reglages PERSONALIZE (gardes dans ce navigateur) ; la saisie les lit dans dtFace.personal, posee d'ici. */
export const personalize = {
  get: (): Readonly<Personalize> => persLoad(),
  set(patch: Partial<Personalize>): void {
    pers = { ...persLoad(), ...patch };
    try {
      window.localStorage.setItem(PERSONALIZE_KEY, JSON.stringify(pers));
    } catch {
      // pour la visite
    }
    toFace(pers);
    persListeners.forEach((fn) => fn());
  },
  subscribe(fn: () => void): () => void {
    persListeners.add(fn);
    return () => {
      persListeners.delete(fn);
    };
  },
};

// Au chargement, la saisie part des reglages gardes ; SETTINGS tenu + TRIG 1-3 ou 9 (la saisie, B4) les change dans dtFace :
// ils sont gardes ici aussi (le menu les montre, la visite suivante les retrouve)
if (typeof window !== 'undefined') {
  toFace(persLoad());
  dtFace.subscribe(() => {
    const d = dtFace.personal();
    const p = persLoad();
    if (d.led !== p.led || d.backlight !== p.backlight || d.trkSelect !== p.trkSelect) personalize.set({ led: d.led, backlight: d.backlight, trkSelect: d.trkSelect });
  });
}
