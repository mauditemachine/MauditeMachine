/**
 * L'ecran du MM-RYTM : le pied de la vue PAGE (les seize pas de la voix, la ligne de droite) et la bande du crossfader. Methodes de Screen deplacees telles quelles de scene/screen.ts en P0 (2026-10-30,
 * docs/v4/dt2/dt2-master-spec.md 5.0), devenues des fonctions (this: Screen) posees sur Screen.prototype.
 */

import { clock } from '../../audio/clock';
import { mix } from '../../audio/drums';
import { STEP_COUNT, VEL_BARS, pattern, velocity } from '../../audio/pattern';
import { lockMask, type StepLock } from '../../audio/locks';
import { lockList, lockPages, lockSummary } from '../../actions';
import { rytmLock } from '../../state/rytmLock';
import { sceneCtl } from '../../state/sceneCtl';
import { anyScenes } from '../../rytm/sceneData';
import { type LcdState } from '../../state/lcd';
import { playhead } from '../../state/playhead';
import { DT_FACE, SCREEN_TOUCH, type Inst } from '../../theme';
import { SCREEN_PAGE, fxScopeTabs, fxVoiceTabLabel, isFxDetail, screensOf, tabWord, type RytmScreenId } from '../../rytm/pages';
import { BLACK, FAINT, fit, HALF, INK, PAGE_FOOT, PAGE_STRIP, pageKeyWord, plockHints, TALL, TEX_K, TIP_MS, TURN, two } from './consts';
import { Screen } from './core';
import { defineMethods } from './proto';

declare module './core' {
  interface Screen {
    paintStrip: typeof paintStrip;
    paintFoot: typeof paintFoot;
    paintXStrip: typeof paintXStrip;
  }
}

/**
 * Les seize pas de la voix choisie, en bas a gauche (sans voix : le plus
 * fort des voix, en demi-teinte) : plein et blanc fort, demi-teinte doux,
 * vide un cadre a peine ; le pas choisi : un point au-dessus. En lecture, la
 * tete : le pas qui joue s'allume en negatif ; un pas qui a des verrous : un
 * trait dessous ; le pas qui joue avec ses verrous (2026-10-09) : son trait
 * plein et plus epais, en meme temps que P-LOCK dans l'en-tete.
 */
function paintStrip(this: Screen, inst: Inst | null, sel: number, lockStep = -1, flashStep = -1): void {
  const S = PAGE_STRIP;
  const steps = pattern.get().steps;
  const head = clock.running ? playhead.get() : -1;
  const mask = lockMask(pattern.get().locks, inst);
  let strip = '';
  for (let i = 0; i < STEP_COUNT; i += 1) {
    const x = S.x0 + i * S.pitch;
    const v = inst ? velocity(steps, inst, i) : this.maxVel(steps, i);
    const bars = VEL_BARS[v];
    const locked = ((mask >> i) & 1) === 1;
    strip += i === lockStep ? '*' : locked ? (bars > 0 ? 'L' : 'l') : bars > 0 ? 'o' : '.';
    if (i === lockStep) this.roundRect(x - 1.7, S.y - 1.7, S.size + 3.4, S.size + 3.4, 1.4, null, INK, 1.1);
    if (locked && i !== head) {
      const ly = S.y + S.size + 2.4;
      this.line([x + 0.9, ly, x + S.size - 0.9, ly], bars > 0 ? INK : HALF, this.mobile ? 1.5 : 1.2);
    }
    if (i === head) {
      this.ctx.fillStyle = INK;
      this.ctx.fillRect(x - 0.9, S.y - 0.9, S.size + 1.8, S.size + 1.8);
      if (bars > 0) this.circle(x + S.size / 2, S.y + S.size / 2, 1.3, BLACK);
      this.line([x - 0.9, S.y + S.size + 2.6, x + S.size + 0.9, S.y + S.size + 2.6], INK, i === flashStep ? 2.6 : 1.6);
    } else if (bars > 0) {
      this.ctx.fillStyle = !inst ? HALF : bars >= 3 ? INK : bars === 2 ? 'rgba(246, 241, 231, 0.75)' : HALF;
      this.ctx.fillRect(x, S.y, S.size, S.size);
    } else this.roundRect(x + 0.4, S.y + 0.4, S.size - 0.8, S.size - 0.8, 0.6, null, i % 4 === 0 ? HALF : FAINT, 0.7);
    if (i === sel && inst && i !== lockStep) this.circle(x + S.size / 2, S.y - 2.6, this.bt.selR, INK);
  }
  this.info.strip = strip;
}

/**
 * Le pied de la vue PAGE, a droite des seize pas, le premier qui vaut :
 * en P-LOCK ses deux lignes (ce qui vient de se passer ou les verrous du
 * pas, puis le geste) ; sinon le message du moment, la piste qui joue (sa
 * barre cliquable), MUTE et SOLO, le pas verrouille qui joue, et sinon
 * l'aide : DRAG A VALUE (au desktop aussi : l'ecran est l'editeur, les
 * encodeurs sont les FX globaux).
 */
function paintFoot(this: Screen, s: LcdState, screen: RytmScreenId, lockStep: number, now: number, flash: { step: number; lock: Readonly<StepLock> | null } | null): number {
  const F = PAGE_FOOT;
  const x0 = F.x0;
  const x1 = F.x1;
  const y = F.y;
  const fs = this.bt.foot;
  if (lockStep >= 0) {
    const lk = rytmLock.get();
    const held = !lk.latched;
    const used = held && lk.writes > lk.since;
    const names = lockSummary(lockStep);
    const s1 = TALL ? 10 : this.mobile ? 10 : fs - 1.2;
    // La seconde ligne a 10 au telephone (revue du 2026-10-09 : 9.2 faisait moins de 9 px)
    const s2 = TALL ? 10 : this.mobile ? 8.6 : 5.8;
    const full = `STEP ${two(lockStep + 1)}: ${names.join(' ')}`;
    const list = this.textWidth(full, s1, 600, 0.5) <= x1 - x0 ? full : `STEP ${two(lockStep + 1)}: ${names.length} P-LOCKS ON ${lockPages(lockStep).join(' ')}`;
    const top = s.l3 && !s.mix ? s.l3 : names.length > 0 ? list : `${TURN}: STEP ${two(lockStep + 1)} ONLY`;
    // 2026-10-22 (audit SB-08) : au desktop aussi, l'aide alterne si elle ne tient pas en entier (STEP: E. avant)
    // V.5.0 au desktop : CLEAR est FUNC + PLAY
    const both = DT_FACE ? '2X: UNLOCK  FUNC+PLAY: ALL  STEP: EXIT' : '2X: UNLOCK  CLEAR: ALL  STEP: EXIT';
    const alt = !held && (this.mobile || this.textWidth(both, s2, 700, 0.6) > x1 - x0);
    const phase = alt ? Math.floor(now / TIP_MS) % 2 : 0;
    const tip = used
      ? 'RELEASE: P-LOCK DONE'
      : held
        ? 'RELEASE: STAY IN P-LOCK'
        : !alt
          ? both
          : phase === 0
            ? DT_FACE
              ? '2X: UNLOCK  FUNC+PLAY: ALL'
              : '2X: UNLOCK  CLEAR: ALL'
            : `${this.mobile ? 'TAP' : 'CLICK'} STEP ${two(lockStep + 1)} AGAIN: EXIT`;
    const y1 = TALL || !this.mobile ? F.y1 : 108.7;
    const y2 = TALL || !this.mobile ? F.y2 : 118;
    const t1 = this.fitText(top, x1 - x0, s1, 0.5, 600);
    const t2 = this.fitText(tip, x1 - x0, s2, 0.6, 700);
    this.text(t1, x0, y1, s1, INK, 600, 'left', 0.5);
    this.text(t2, x0, y2, s2, HALF, 700, 'left', 0.6);
    this.info.foot = [t1, t2];
    return alt ? TIP_MS - (now % TIP_MS) + 1 : 0;
  }
  if (s.bar !== null) {
    const ts = fs - 1.5;
    const tw = this.text(fit(s.l2.trim(), this.mobile ? 10 : 14), x0, y, ts, HALF, 600, 'left', 0.5);
    const lw = this.text(s.l3, x0 + tw + 6, y, ts, INK, 600);
    const rw = this.text(s.r3, x1, y, ts, INK, 600, 'right');
    const a = x0 + tw + 6 + lw + 5;
    const b = x1 - rw - 5;
    if (b - a > 10) {
      const yb = y - 2.3;
      const v = Math.max(0, Math.min(1, s.bar));
      this.line([a, yb, b, yb], FAINT, 1.4);
      this.line([a, yb, a + (b - a) * v, yb], INK, 1.8);
      this.circle(a + (b - a) * v, yb, 2.4, INK);
      this.bar = { x0: a * TEX_K, x1: b * TEX_K, y0: (y - 12) * TEX_K, y1: (y + 6) * TEX_K };
    }
    return 0;
  }
  if (s.l3 && !s.mix) {
    const t = this.fitText(s.l3, x1 - x0, fs, 0.5, 600);
    this.text(t, x0, y, fs, INK, 600, 'left', 0.5);
    this.info.footText = t;
    return 0;
  }
  // MUTE et SOLO : sur deux lignes, le desktop aussi (revue du 2026-10-09 : sur une, MULTI MUTE n'avait pas la place de
  // dire MUTE: DONE)
  if (this.paintMode2(x0, x1)) return 0;
  const fl = flash ? lockList(flash.step, flash.lock) : [];
  if (flash && fl.length > 0) {
    const t = this.flashLine(flash.step, fl, x1 - x0, fs);
    this.text(t, x0, y, fs, INK, 600, 'left', 0.4);
    this.info.footText = t;
    return 0;
  }
  // L'aide (2026-10-09) : au telephone le geste des blocs et celui des verrous, sur deux lignes ; au desktop sur une
  // Le crossfader (2026-10-27, P2-20) : au desktop, des scenes dans le motif (ou le crossfader qui bouge), la seconde ligne
  // devient sa bande A [----|----] B
  if (TALL && !this.mobile && (anyScenes(pattern.scenes.get()) || sceneCtl.moving())) {
    const fitsA = (t: string): boolean => this.textWidth(t, fs - 1, 700, 0.5) <= x1 - x0;
    const aText = plockHints().find(fitsA) ?? plockHints()[2];
    const a = this.fitText(aText, x1 - x0, fs - 1, 0.5, 700);
    this.text(a, x0, F.y1, fs - 1, HALF, 700, 'left', 0.5);
    const b = this.paintXStrip(x0, x1, F.y2, fs - 0.5);
    this.info.footText = `${a} / ${b}`;
    return 0;
  }
  if (TALL) {
    // La premiere forme qui tient en entier (le telephone : la place d'une ligne)
    const fits = (s: string, size: number, sp: number): boolean => this.textWidth(s, size, 700, sp) <= x1 - x0;
    const aText = plockHints().find((s) => fits(s, fs - 1, 0.5)) ?? plockHints()[2];
    const a = this.fitText(aText, x1 - x0, fs - 1, 0.5, 700);
    // La touche de la page allumee encore : l'onglet suivant, nomme ; une page sans onglet : HOME (revue du 2026-10-09)
    const inst = pattern.get().instrument;
    const page = SCREEN_PAGE[screen];
    const tabs = screensOf(page, inst);
    const next = tabs.length > 1 ? tabWord(tabs[(tabs.indexOf(screen) + 1) % tabs.length], inst) : 'HOME';
    // GLOBAL FX et les pages de ses FX (2026-10-10) : une tape sur un FX ouvre sa page ; sur elle, le chemin du retour
    const pick = (...l: string[]): string => l.find((s) => fits(s, fs - 0.5, 0.6)) ?? l[l.length - 1];
    // La page d'un FX a deux onglets (2026-10-10) : GLOBAL ou la voix en haut, FX revient a l'onglet du mode
    const vt = fxVoiceTabLabel(inst);
    // L'ecran haut du desktop (2026-10-18) : le clic et Echap, comme le pied d'une ligne d'avant
    const tap = this.mobile ? 'TAP' : 'CLICK';
    const back = this.mobile ? 'FX: BACK' : 'FX OR ESC: BACK';
    // L'ecran intouchable du desktop (V.4.2) : ses onglets ne se cliquent plus (FX ramene GLOBAL FX, puis VOICE FX), la page
    // d'un FX s'ouvre a la tape de son potard
    const bText = !SCREEN_TOUCH && (fxScopeTabs(screen) || isFxDetail(screen))
      ? DT_FACE
        ? pick(screen.startsWith('fxv') ? 'FX OR NO: BACK TO VOICE FX' : 'NO: BACK TO SEND FX', 'NO: BACK')
        : pick(`FX: BACK TO ${screen.startsWith('fxv') ? 'VOICE' : 'GLOBAL'} FX · ESC`, back)
      : !SCREEN_TOUCH && screen === 'fxg'
        ? pick('CLICK A KNOB: ITS FX SETTINGS', 'CLICK A KNOB: SETTINGS')
        : fxScopeTabs(screen)
          ? pick(`${tap} GLOBAL OR ${vt} · ${back}`, `GLOBAL OR ${vt} · ${back}`, back)
          : isFxDetail(screen)
            ? // Des formes plus courtes (2026-10-22, audit SB-08 : ESC: BA. au desktop)
              pick(`${tap} GLOBAL OR FX: BACK TO GLOBAL FX`, `${tap} GLOBAL OR ${back}`, `GLOBAL OR ${back}`, back)
            : screen === 'fxg'
              ? pick(`${tap} A FX: ITS SETTINGS · NEVER P-LOCKED`, `${tap} A FX: ITS SETTINGS`)
              : `${pageKeyWord(page)} AGAIN: ${next}`;
    const b = this.fitText(bText, x1 - x0, fs - 0.5, 0.6, 700);
    this.text(a, x0, F.y1, fs - 1, HALF, 700, 'left', 0.5);
    this.text(b, x0, F.y2, fs - 0.5, HALF, 700, 'left', 0.6);
    this.info.footText = `${a} / ${b}`;
    return 0;
  }
  // GLOBAL FX et les pages de ses FX (2026-10-10) : au desktop, le clic qui ouvre une page, et le retour
  // La page d'un FX a deux onglets (2026-10-10) : ses onglets sont en haut, FX ou Echap ramenent l'onglet du mode
  const desk = fxScopeTabs(screen)
    ? `${TURN}  /  FX OR ESC: BACK`
    : isFxDetail(screen)
      ? `${TURN}  /  GLOBAL, FX OR ESC: BACK`
      : screen === 'fxg'
        ? SCREEN_TOUCH
          ? `${TURN}  /  CLICK A FX: ITS SETTINGS`
          : `${TURN}  /  CLICK IT: ITS SETTINGS`
        : `${TURN}  /  TURN A KNOB = GLOBAL FX`;
  const t = this.fitText(this.mobile ? `HOLD A STEP + ${TURN}: P-LOCK` : desk, x1 - x0, fs - 0.5, 0.5, 700);
  this.text(t, x0, y, fs - 0.5, HALF, 700, 'left', 0.5);
  this.info.footText = t;
  return 0;
}

/**
 * La bande du crossfader (2026-10-27, P2-20) : A a gauche, B a droite (REC A ou REC B, la scene armee, en plein), le
 * milieu marque, le curseur a x ; rend sa forme texte (A [----|----] B).
 */
function paintXStrip(this: Screen, x0: number, x1: number, y: number, size: number): string {
  const w = sceneCtl.get().armed;
  const x = sceneCtl.x();
  const la = w === 'a' ? 'REC A' : 'A';
  const lb = w === 'b' ? 'REC B' : 'B';
  const wa = this.text(la, x0, y, size, w === 'a' ? INK : HALF, 700, 'left', 0.6);
  const wb = this.text(lb, x1, y, size, w === 'b' ? INK : HALF, 700, 'right', 0.6);
  const a = x0 + wa + 5;
  const b = x1 - wb - 5;
  if (b - a > 10) {
    const yb = y - size * 0.36;
    this.line([a, yb, b, yb], FAINT, 1.2);
    const m = (a + b) / 2;
    this.line([m, yb - 2.2, m, yb + 2.2], HALF, 1);
    const px = a + (b - a) * x;
    this.line([px, yb - 3.4, px, yb + 3.4], INK, 2.2);
  }
  this.xLive = true;
  this.info.xfade = `${la} ${x.toFixed(2)} ${lb}`;
  const n = 9;
  const at = Math.round(x * (n - 1));
  return `${la} [${Array.from({ length: n }, (_, i) => (i === at ? '|' : '-')).join('')}] ${lb}`;
}

defineMethods(Screen, { paintStrip, paintFoot, paintXStrip });
