/**
 * L'ecran du MM-RYTM : le menu des presets (la liste, la sauvegarde, le nom). Methodes de Screen deplacees telles quelles de scene/screen.ts en P0 (2026-10-30,
 * docs/v4/dt2/dt2-master-spec.md 5.0), devenues des fonctions (this: Screen) posees sur Screen.prototype.
 */

import { type LcdState } from '../../../state/lcd';
import { PRESET_SLOTS } from '../../../state/presetMode';
import { softKeyName } from '../../../rytm/presetKeys';
import { FAINT_TEXT, fit, HALF, INK, PAGE_HEAD, PRESET_LAYOUT, presetKeySpot, UW } from '../consts';
import { Screen } from '../core';
import { defineMethods } from '../proto';

declare module '../core' {
  interface Screen {
    paintPresets: typeof paintPresets;
  }
}

/**
 * Le mode presets (2026-10-27, la V.4.2, Mika : "la gestion doit etre plus simple") sur toute la hauteur de l'ecran :
 * le titre (LOADED, EDITED, FACTORY, la note) et le rang ; la liste autour du curseur, la ligne d'avant et d'apres a
 * peine, le curseur en grand entre ses chevrons (une etoile : le preset charge a bouge) ; OVERWRITE / AS NEW et
 * DELETE? disent leur question dessous ; le nom en cours (USER/NAME, les cases vides de l'utilisateur soulignees, le
 * curseur du potard B sous sa lettre) ; les cinq touches en pastilles, au desktop juste au-dessus des touches de la
 * face qui les font (rytm/presetKeys.ts). L'aide du desktop nomme les potards (A: BROWSE ; A: LETTER  B: CURSOR).
 */
function paintPresets(this: Screen, s: LcdState): void {
  const v = s.presets;
  if (!v) return;
  const c = this.ctx;
  c.setTransform(this.scale, 0, 0, this.scale, 0, 0);
  const L = PRESET_LAYOUT;
  const desk = !this.mobile;
  this.text(fit(v.title, 24), 10, L.head, 9, v.naming?.problem && !v.title.startsWith('SAVE') ? INK : HALF, 700, 'left', 0.9);
  const right = PAGE_HEAD.right;
  const rw = v.count ? this.text(v.count, right, L.head, 9, HALF, 600, 'right') : 0;
  if (v.group) this.text(v.group, right - rw - (rw ? 6 : 0), L.head, 9, INK, 600, 'right', 0.4);
  const mid = L.rows[1];
  if (v.stage === 'name' && v.naming) {
    // Le nom en cours : l'utilisateur sur ses quatre cases (une case vide : un trait), la barre, le nom ; le curseur
    const t = v.naming.text;
    const size = 21;
    const shown = `${t.slice(0, 4).replace(/ /g, '_')}${t.slice(4)}`;
    const w = this.textWidth(shown, size, 300, 1.2);
    const x0 = UW / 2 - w / 2;
    this.text(shown, x0, mid + 7, size, INK, 300, 'left', 1.2);
    if (desk) {
      const at = Math.min(v.naming.at, shown.length);
      const cx = x0 + (at > 0 ? this.textWidth(shown.slice(0, at), size, 300, 1.2) + 1.2 : 0);
      const cw = Math.max(9, this.textWidth(shown[at] && shown[at] !== ' ' ? shown[at] : 'M', size, 300));
      this.line([cx - 0.5, mid + 11.5, cx + cw + 0.5, mid + 11.5], INK, 2.2);
    }
    const help = v.naming.problem || (desk ? 'A: LETTER   B: CURSOR' : 'TYPE THE NAME, THEN OK');
    this.text(help, UW / 2, L.hint, 7.5, v.naming.problem ? INK : FAINT_TEXT, 700, 'center', 0.8);
    this.info.presetList = `|${t}|@${v.naming.at}|${v.keys.join(',')}`;
  } else {
    // La ligne d'avant et d'apres : a peine, petites (le haut et le bas de la liste)
    if (v.prev) this.text(fit(v.prev, 30), UW / 2, L.rows[0], 9, FAINT_TEXT, 600, 'center', 0.7);
    if (v.next) this.text(fit(v.next, 30), UW / 2, L.rows[2], 9, FAINT_TEXT, 600, 'center', 0.7);
    const name = this.fitText(v.name, UW - 64, 21, 0.3, 300);
    this.text(name, UW / 2, mid + 7, 21, INK, 300, 'center', 0.3);
    if (!v.empty && v.stage === 'browse') {
      this.line([18, mid - 7, 10, mid, 18, mid + 7], INK, 2);
      this.line([UW - 18, mid - 7, UW - 10, mid, UW - 18, mid + 7], INK, 2);
    }
    const q = v.stage === 'choice' ? 'OVERWRITE IT, OR SAVE AS NEW?' : v.stage === 'confirm' ? 'DELETE FOR GOOD?' : desk && v.stage === 'browse' ? 'TURN A KNOB: BROWSE' : '';
    if (q) this.text(q, UW / 2, v.stage === 'browse' ? L.hint : L.sub, v.stage === 'browse' ? 7 : 8, v.stage === 'browse' ? FAINT_TEXT : INK, 700, 'center', 0.8);
    this.info.presetList = `${v.prev}|${v.name}|${v.next}|${v.keys.join(',')}`;
  }
  // Les cinq touches : une pastille par place, vide si la place n'a rien a faire
  v.keys.forEach((k, i) => {
    if (!k) return;
    const spot = presetKeySpot(i, this.mobile);
    const cx = spot.u * UW;
    const w = this.textWidth(k, L.keyFont, 700, 0.8) + (this.mobile ? 16 : 12);
    this.pill(cx - w / 2, L.keyY - L.keyH / 2, w, L.keyH, null, INK, 1.2);
    this.text(k, cx, L.keyY + L.keyFont * 0.36, L.keyFont, INK, 700, 'center', 0.8);
    // Au desktop (la revue de D1, K1) : le nom de la touche de la face qui la fait (SRC LOAD, FLTR SAVE, AMP NAME, FX DEL, PTN
    // EXIT) ; FLTR, AMP et FX sont sous les potards, leurs pastilles rangees a droite de l'ecran
    if (!this.mobile) this.text(softKeyName(PRESET_SLOTS[i]), cx, L.keyY - L.keyH / 2 - 3.2, 6, FAINT_TEXT, 700, 'center', 0.8);
  });
}

defineMethods(Screen, { paintPresets });
