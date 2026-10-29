/**
 * Les LEDs de la rangee de touches et de la vue PTN pour le boitier MMHW v2 (V.5.0, 2026-10-29, la face facon Digitakt du
 * desktop, docs/v4/digitakt-d1-spec.md section 5) : pur, sans dependance (node le lit tel quel pour npm run hw:test) ; les
 * couleurs viennent de l'appelant (hw/snapshot.ts, theme.ts DT_HEX). Les memes regles que scene/rytmFaceKeys.ts :
 * - FUNC : temoin blanc, plein tenue, clignotant gardee (pour une touche ou verrouillee) ; son capuchon reste orange ;
 * - TRK : rouge tenue ou gardee, clignotant gardee ; PTN : rouge tant que la grille des patterns ou KIT est ouverte ;
 * - REC : rouge en mode ecriture ; PLAY : vert en lecture, vert clignotant en pause ;
 * - STOP, YES, NO : l'eclair blanc de leur appui (flash) ;
 * - TRIG SRC FLTR AMP FX MOD : rouge sur la page affichee, rouge faible (HOME_LEVEL) en vue HOME, eteintes ailleurs ; les
 *   pages de FUNC (TEMPO, SEND FX, MIXER) n'allument aucune touche.
 */

export type RowKeyId = 'func' | 'trk' | 'ptn' | 'rec' | 'play' | 'stop' | 'trig' | 'src' | 'fltr' | 'amp' | 'fx' | 'mod' | 'yes' | 'no';

/** La rangee, de gauche a droite (rytm/faceplate.ts buttons.keys). */
export const ROW_KEYS: readonly RowKeyId[] = ['func', 'trk', 'ptn', 'rec', 'play', 'stop', 'trig', 'src', 'fltr', 'amp', 'fx', 'mod', 'yes', 'no'];

/** La page affichee de chaque touche de page (rytm/pages.ts RytmPageId : SRC ouvre voice, AMP env). */
const PAGE_OF: Readonly<Partial<Record<RowKeyId, string>>> = { trig: 'trig', src: 'voice', fltr: 'fltr', amp: 'env', fx: 'fx', mod: 'mod' };

/** Le temoin de la page affichee en vue HOME : un rouge faible. */
export const ROW_HOME_LEVEL = 0.32;

export interface RowPalette {
  readonly red: string;
  readonly green: string;
  readonly white: string;
}

export interface RowState {
  readonly func: 'off' | 'held' | 'once' | 'locked';
  readonly trk: 'off' | 'held' | 'latched' | 'closing';
  /** la grille des patterns ou KIT ouverte */
  readonly ptn: boolean;
  readonly rec: boolean;
  readonly play: 'stop' | 'run' | 'pause';
  /** la page affichee (rytm/pages.ts) et la vue HOME */
  readonly page: string;
  readonly home: boolean;
  /** l'eclair de STOP, YES ou NO en cours (0 a 1) */
  readonly flash?: Readonly<Partial<Record<'stop' | 'yes' | 'no', number>>>;
}

export interface HwRowLed {
  readonly id: RowKeyId;
  /** #RRGGBB ; '' : eteinte */
  readonly color: string;
  readonly level: number;
  readonly blink: boolean;
}

/** Les quatorze LEDs de la rangee, dans son ordre. */
export function rowLeds(s: RowState, pal: RowPalette): HwRowLed[] {
  const led = (id: RowKeyId, color: string, level: number, blink = false): HwRowLed => ({ id, color: level > 0 ? color : '', level, blink });
  return ROW_KEYS.map((id) => {
    switch (id) {
      case 'func':
        return led(id, pal.white, s.func === 'off' ? 0 : 1, s.func === 'once' || s.func === 'locked');
      case 'trk':
        return led(id, pal.red, s.trk === 'off' ? 0 : 1, s.trk === 'latched');
      case 'ptn':
        return led(id, pal.red, s.ptn ? 1 : 0);
      case 'rec':
        return led(id, pal.red, s.rec ? 1 : 0);
      case 'play':
        return led(id, pal.green, s.play === 'stop' ? 0 : 1, s.play === 'pause');
      case 'stop':
      case 'yes':
      case 'no':
        return led(id, pal.white, Math.max(0, Math.min(1, s.flash?.[id] ?? 0)));
      default: {
        const pg = PAGE_OF[id];
        if (!pg || pg !== s.page) return led(id, pal.red, 0);
        return led(id, pal.red, s.home ? ROW_HOME_LEVEL : 1);
      }
    }
  });
}

/** Un pas des vues du boitier (PTN, le mode MUTE) : son rang 0 a 15, sa couleur, son eclat, s'il clignote. */
export interface HwGridLed {
  readonly i: number;
  readonly color: string;
  readonly level: number;
  readonly blink: boolean;
}

/** Les niveaux de la vue PTN (theme.ts STEP_LIT.dtEdit) : le pattern qui joue, le suivant, la chaine, un plein. */
export interface PtnLevels {
  readonly cur: number;
  readonly next: number;
  readonly chain: number;
  readonly filled: number;
}

/**
 * La vue PTN facon Digitakt sur les seize pas : le pattern qui joue rouge plein, le suivant (a la mesure) et la chaine
 * rouges clignotants, un pattern plein blanc faible, un vide eteint.
 */
export function ptnLeds(cur: number, next: number, chain: readonly number[], filled: readonly boolean[], pal: RowPalette, lv: PtnLevels): HwGridLed[] {
  const out: HwGridLed[] = [];
  for (let i = 0; i < 16; i += 1) {
    if (i === cur) out.push({ i, color: pal.red, level: lv.cur, blink: false });
    else if (i === next) out.push({ i, color: pal.red, level: lv.next, blink: true });
    else if (chain.length > 1 && chain.includes(i)) out.push({ i, color: pal.red, level: lv.chain, blink: true });
    else if (filled[i]) out.push({ i, color: pal.white, level: lv.filled, blink: false });
    else out.push({ i, color: '', level: 0, blink: false });
  }
  return out;
}
