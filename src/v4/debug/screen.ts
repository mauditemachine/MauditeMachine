/**
 * window.__v4 (?debug=1), la part de la lane B5 ECRAN ET MENUS en V.6.0 (gabarit DT2 de l'ecran, menus, pages SRC). Vide en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) :
 * la lane ajoute ici ses champs (l'interface et leurs valeurs, des accesseurs au besoin), jamais dans debug/index.ts ;
 * installDebug les copie sur window.__v4.
 *
 * V.6.0 (lane B5, 2026-11-01) : __v4.screen60, la sonde des menus de la face DT2 (?face=dt2) tant que la saisie (B4) n'est
 * pas fusionnee : ouvrir un menu (comme dtFace.menu), lui donner une saisie (le contrat onInput), tourner LEVEL/DATA, presser
 * un potard, lire ce que l'ecran dessine. Muette : rien ne joue (les sons choisis passent par la pre-ecoute, que la sonde
 * fait taire avec quiet()).
 */

import type { DebugSource } from './index';
import { anyDial, curSlots, dialValueText, levelDataTurn, levelDataView, rytmHome, rytmPageKey, screenKnobPress, soundPreview, type DialId } from '../actions';
import type { RytmPageId } from '../rytm/pages';
import { openMenuId, menuInput, setOpenMenu, screenTrack } from '../scene/screen/menus/open';
import { dialSpecOf, screenMenu, screenMenus, type ScreenMenuId, type ScreenMenuInputKind } from '../scene/screen/menus/registry';
import { dt2SrcPage } from '../rytm/pages';
import { personalize } from '../scene/screen/menus/settings';
import { patternName, setPatternName } from '../scene/screen/menus/names';
import { DT2_FACE } from '../theme';
import { rytmInfos } from '../state/rytmInfos';
import { BLACK, HALF, INK } from '../scene/screen/consts';
import { DIM_TEXT } from '../scene/screen/menus/frame';

export interface ScreenLaneDebug {
  readonly screen60: {
    /** la face DT2 est-elle la (?face=dt2) */
    readonly on: boolean;
    /** les menus inscrits : id, proprietaire, potards, saisie */
    menus(): { id: string; owner: string; knobs: boolean; input: boolean }[];
    /** le menu ouvert (null : aucun) */
    open(): ScreenMenuId | null;
    /** ouvre un menu (null : ferme), comme dtFace.menu (B4) */
    show(id: ScreenMenuId | null): void;
    /** une saisie au menu ouvert : l'appui puis le relacher (YES et NO agissent au relacher) ; rend true s'il l'a prise */
    input(kind: ScreenMenuInputKind, o?: { delta?: number; func?: boolean }): boolean;
    /** ce que le menu ouvert montre, en une ligne */
    info(): string;
    /** LEVEL/DATA tourne de delta crans */
    data(delta: number, func?: boolean): boolean;
    /** la vue de LEVEL/DATA (sa course, s'il a une piste) */
    dataView(): { t: number; live: boolean };
    /** un potard presse */
    press(k: number): boolean;
    /** les blocs des potards A a H (le menu ou la page), NOM=VALEUR */
    slots(): string[];
    /** un potard A a H a la valeur v (ses unites) */
    knob(k: number, v: number): void;
    /** une fiche V.6.0 (t:, k:, z:) : sa valeur, son texte */
    spec(id: string): { value: number; text: string; unit: string } | null;
    /** la piste active (TrackKey) */
    track(): string | null;
    /** les deux sous-pages SRC d'une machine (leurs noms) */
    src(mach: string): [string[], string[]];
    /** PERSONALIZE, le nom du pattern */
    personalize(): unknown;
    patternName(slot: number): string;
    /** nomme un emplacement ('' : retire le nom ; la sonde ne laisse rien) */
    rename(slot: number, name: string): void;
    /** fait taire la pre-ecoute des sons (la sonde choisit des sons) */
    quiet(): void;
    /** une touche de page (la navigation DT2 : jamais HOME, la sous-page suivante) ; rytm:home */
    pageKey(id: RytmPageId): void;
    home(): void;
    /** l'image de l'ecran, en PNG (data URL) : les captures de la sonde */
    png(): string;
    /** les teintes du texte de l'ecran DT2 et son fond (la verification du contraste, en noir et en creme) */
    palette(): { bg: string; ink: string; half: string; dim: string };
    /** INFOS allume et la carte d'une zone montree (null : eteint) */
    infos(id: string | null): void;
  };
}

export function screenLane(_src: DebugSource): ScreenLaneDebug {
  return {
    screen60: {
      on: DT2_FACE,
      menus: () => screenMenus().map((m) => ({ id: m.id, owner: m.owner, knobs: !!m.slots, input: !!m.onInput })),
      open: () => openMenuId(),
      show: (id) => setOpenMenu(id),
      input(kind, o = {}) {
        const base = { kind, func: !!o.func, ...(kind === 'data' ? { delta: o.delta ?? 1 } : {}) };
        const a = menuInput({ ...base, phase: 'down' });
        if (kind === 'data') return a;
        const b = menuInput({ ...base, phase: 'up' });
        return a && b;
      },
      info() {
        const id = openMenuId();
        return id ? (screenMenu(id)?.info?.() ?? '') : '';
      },
      data: (delta, func = false) => levelDataTurn(delta, func),
      dataView: () => levelDataView(),
      press: (k) => screenKnobPress(k),
      slots: () => curSlots().map((s, k) => `${s.label}=${s.label ? dialValueText(`p:${k}` as DialId) : ''}`),
      knob: (k, v) => anyDial(`p:${k}` as DialId, v),
      spec(id) {
        const s = dialSpecOf(id);
        if (!s) return null;
        const v = s.value();
        return { value: v, text: s.text(v), unit: s.unit(v) };
      },
      track: () => screenTrack(),
      src: (mach) => [dt2SrcPage(mach, 0).map((s) => s.label || '-'), dt2SrcPage(mach, 1).map((s) => s.label || '-')],
      personalize: () => personalize.get(),
      patternName: (slot) => patternName(slot),
      rename: (slot, name) => setPatternName(slot, name),
      quiet() {
        soundPreview.silent = true;
      },
      pageKey: (id) => rytmPageKey(id, _src.stage()),
      home: () => rytmHome(),
      palette: () => ({ bg: BLACK, ink: INK, half: HALF, dim: DIM_TEXT }),
      infos(id) {
        if (id === null) {
          rytmInfos.set(false);
          return;
        }
        rytmInfos.set(true);
        rytmInfos.show(id);
      },
      png() {
        const st = _src.stage();
        return st ? st.screen.canvas.toDataURL('image/png') : '';
      },
    },
  };
}

