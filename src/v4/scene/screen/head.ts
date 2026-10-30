/**
 * L'ecran du MM-RYTM : l'en-tete de la vue PAGE (la page, ses onglets, la voix ; en P-LOCK et en scene, en negatif) et sa colonne gauche. Methodes de Screen deplacees telles quelles de scene/screen.ts en P0 (2026-10-30,
 * docs/v4/dt2/dt2-master-spec.md 5.0), devenues des fonctions (this: Screen) posees sur Screen.prototype.
 */

import { pattern } from '../../audio/pattern';
import { type StepLock } from '../../audio/locks';
import { lockCountOf, stepPlays, voiceSoundText } from '../../actions';
import { sceneCount, type SceneId } from '../../rytm/sceneData';
import { patterns, slotName } from '../../state/patterns';
import { ctlAllState } from '../../state/trk';
import { type RytmPageState } from '../../state/rytmPage';
import { voices } from '../../state/voices';
import { dtFace } from '../../state/dtFace';
import { DT_FACE, type Inst } from '../../theme';
import { FACE_PAGES, SCREEN_LABEL, SCREEN_TITLE, fxScopeTabs, fxVoiceTabLabel, isFxDetail, pageLabel, screensOf, tabWord, type RytmPageId, type RytmScreenId } from '../../rytm/pages';
import { type BlockMode } from '../../rytm/pageView';
import { screenDials } from '../../state/screenDials';
import { fill } from '../../state/fill';
import { BLACK, FAINT, FAINT_TEXT, fit, HALF, HEAD_COL, HEAD_FIT, type HeadFit, type HeadLeft, type HeadOp, INK, MATRIX, PAGE_DOTS, PAGE_HEAD, two, UW } from './consts';
import { Screen } from './core';
import { defineMethods } from './proto';

declare module './core' {
  interface Screen {
    paintPageHead: typeof paintPageHead;
    paintLockHead: typeof paintLockHead;
    paintSceneHead: typeof paintSceneHead;
    headLeft: typeof headLeft;
    paintPageDots: typeof paintPageDots;
    drawHeadLeft: typeof drawHeadLeft;
  }
}

/**
 * L'en-tete de la vue PAGE (refait le 2026-10-09) :
 * - a gauche la lecture, la page en pastille pleine (VOICE), ses onglets
 *   s'il en a (MAIN SYNTH ; BD FX, GLOBAL : celui de l'ecran plein, l'autre en
 *   contour, une tape dessus y passe) ;
 * - a droite la voix, le pattern (il clignote quand il change), MASTER et le
 *   tempo ; M ou S quand le mode est arme, entre la voix et le pattern ;
 * - entre les deux, ce que joue la voix quand la place le permet, MUTE ou
 *   SOLO pour une voix vraiment coupee (en solo), P-LOCK un instant quand le
 *   pas qui joue a des verrous (n'importe quelle page) ;
 * - la page d'un FX global (2026-10-10) : GLOBAL > DELAY a la place de
 *   l'onglet GLOBAL, le FX cerne, une tape dessus ramene GLOBAL FX ; sous
 *   DIST CHORUS DELAY REVERB, l'onglet de la voix est la voix elle-meme ;
 * - en P-LOCK (69-common2, point 3 : "P-LOCK MUST BE OBVIOUS") : toute la
 *   bande en negatif (paintLockHead).
 * 2026-10-22 (audit SB-13 : la voix BD sautait de x 69 a 160 d'une page a
 * l'autre, A01 et le niveau en dB allaient et venaient) : des places fixes.
 * La voix a sa colonne juste a gauche du pattern, a la meme place sur toutes
 * les pages, et les cadrans gardent le meme palier sur toutes les pages
 * (headPlan) ; ce sont les onglets qui se serrent (HEAD_FIT), pas la voix qui
 * bouge. MASTER tenu dit son niveau en dB.
 */
function paintPageHead(this: Screen, rp: RytmPageState, screen: RytmScreenId, inst: Inst | null, cur: number, now: number, lockStep: number, lock: Readonly<StepLock> | null, mode: BlockMode | null): void {
  const H = PAGE_HEAD;
  const T = this.bt.head;
  const y = H.y;
  this.tabSpots = [];
  if (lockStep >= 0) {
    this.paintLockHead(screen, inst, lockStep);
    return;
  }
  if (mode && mode.kind === 'scene') {
    this.paintSceneHead(screen, inst, mode.which);
    return;
  }
  const ty = H.pillY + T.pillH / 2 + T.pill * 0.36;
  const v = voices.get();
  const badge = v.muteMode ? 'M' : v.soloMode ? 'S' : '';
  const plan = this.headPlan(!!badge);
  const scope = fxScopeTabs(screen);
  const vx = plan.voiceX;
  // La gauche : la page et ses onglets, au premier palier qui laisse la colonne de la voix (BD FX cede d'abord sa place)
  const limit = vx - (scope ? HEAD_COL.tabAir : HEAD_COL.air);
  let left: HeadLeft | null = null;
  let fitAt = -1;
  for (let l = 0; l < HEAD_FIT.length && !left; l += 1) {
    for (const optional of [true, false]) {
      const h = this.headLeft(rp.page, screen, inst, HEAD_FIT[l], optional);
      if (h.end <= limit) {
        left = h;
        fitAt = l;
        break;
      }
    }
  }
  // Rien ne tient (une police de repli tres large) : les onglets au plus serre, la voix se tait plutot que d'etre ecrasee
  const crowded = !left;
  const shown: HeadLeft = left ?? this.headLeft(rp.page, screen, inst, HEAD_FIT[HEAD_FIT.length - 1], false);
  // MASTER tenu : son niveau en dB a la place du pattern et de la voix, le temps du geste (paintDials)
  const readout = !plan.tier.full && screenDials.get().held === 'level';
  // La zone de MASTER au telephone, sans A01 : l'air libre a sa gauche, apres la voix (ou apres son onglet, une commande)
  const vw = this.textWidth(inst ?? 'ALL', T.voice, 600);
  const zoneLeft = (scope ? vx + plan.colW + 3.5 : vx + vw) + 3;
  this.paintDials(y, 0, H.rule, now, cur, 0, { tier: plan.tier, zoneLeft, readout });
  this.runIcon(H.iconX, y);
  this.drawHeadLeft(shown, ty);
  this.paintPageDots(rp, shown.pw, inst);
  let heads = shown.heads;
  // MUTE et SOLO armes (2026-10-09) : M ou S, plein en MULTI, en contour pour une voix, entre la voix et le pattern
  if (badge) {
    const multi = v.muteMode ? v.muteMulti : v.soloMulti;
    if (!readout) {
      const bw = T.pillH;
      const bx = vx + plan.colW + HEAD_COL.badgeAir;
      if (multi) this.roundRect(bx, H.pillY, bw, T.pillH, 2.5, INK);
      else this.roundRect(bx + 0.5, H.pillY + 0.5, bw - 1, T.pillH - 1, 2.5, null, INK, 1);
      this.text(badge, bx + bw / 2, ty, T.pill, multi ? BLACK : INK, 700, 'center');
    }
    this.info.badge = `${badge}${multi ? '+' : ''}`;
  } else this.info.badge = '';
  // La colonne de la voix ; sous DIST CHORUS DELAY REVERB (2026-10-10, Mika : "Quand je suis la page delay je veux avoir le
  // choix entre GLOBAL ou VOICE"), elle est l'onglet de la voix : cernee sous la voix, a peine sous GLOBAL, une tape y passe
  if (scope) {
    const on = screen === scope.voice;
    const name = fxVoiceTabLabel(inst);
    if (!readout && !crowded) {
      // Le cadre de l'onglet : HEAD_COL.tabPad de part et d'autre (relecture : a 3.5, TOM cerne touchait presque A01)
      const tp = HEAD_COL.tabPad;
      if (inst) {
        if (on) this.roundRect(vx - tp, H.pillY + 0.6, vw + 2 * tp, T.pillH - 1.2, 2.2, null, INK, 1.1);
        this.text(inst, vx, y, T.voice, on ? INK : FAINT_TEXT, 600);
      } else {
        // Sans voix : VOICE en onglet, du corps des onglets, dans la largeur de la colonne
        const ts0 = T.pill * 0.92;
        const ts = ts0 * Math.min(1, (plan.colW - 1) / Math.max(1, this.textWidth(name, ts0, 700, 0.7)));
        const nw = this.textWidth(name, ts, 700, 0.7);
        if (on) this.roundRect(vx - tp, H.pillY + 0.6, nw + 2 * tp, T.pillH - 1.2, 2.2, null, INK, 1.1);
        this.text(name, vx, ty, ts, on ? INK : FAINT_TEXT, 700, 'left', 0.7);
      }
    }
    // Sa zone : la colonne et un peu d'air, jamais sur celle de MASTER (le telephone sans A01 : 0.3 unite communes)
    const tx1 = Math.min(vx + plan.colW + 3.5, plan.groupLeft - 3.5);
    this.tabSpots.push({ screen: scope.voice, ...this.spot({ x: vx - 4, y: -this.headUp, w: tx1 - vx + 4, h: H.rule + this.headUp }) });
    heads += `|${on ? '[' : ''}${name}${on ? ']' : ''}`;
  } else if (!readout && !crowded) this.text(inst ?? 'ALL', vx, y, T.voice, inst ? INK : HALF, 600);
  this.info.head = heads;
  this.info.headFit = `${plan.tier.a01 ? 'A01' : '-'}${plan.tier.full ? '+DB' : ''}|voice@${vx.toFixed(1)}|fit${fitAt}${crowded ? '!' : ''}${readout ? '|DB' : ''}`;
  if (readout || crowded) {
    this.line([MATRIX.x0, H.rule, UW - MATRIX.x0, H.rule], FAINT, 0.6);
    return;
  }
  // Entre les onglets et la voix, de droite a gauche : MUTE ou SOLO de la voix, P-LOCK, ce que joue la voix
  const mid0 = shown.end + 5;
  let x1 = vx - (scope ? HEAD_COL.tabPad + 4 : 5);
  const fits = (w: number): boolean => x1 - w >= mid0;
  if (inst) {
    // Une voix vraiment coupee (en solo) : sa pastille ; une voix hors d'un solo n'en a pas (2026-10-09 : MUTE se lisait a tort)
    const solo = voices.isSolo(inst);
    const muted = voices.isMuted(inst) && v.solo.length === 0;
    if (solo || muted) {
      // Le mot entier s'il tient, sinon sa lettre (le telephone : MUTE couvrait A01)
      const full = solo ? 'SOLO' : 'MUTE';
      const fw = this.textWidth(full, T.sound, 700, 0.8) + 8;
      const word = fits(fw) ? full : solo ? 'S' : 'M';
      const w = word === full ? fw : this.textWidth(word, T.sound, 700, 0.8) + 8;
      if (fits(w)) {
        x1 -= w;
        this.pill(x1, H.pillY, w, T.pillH, INK);
        this.text(word, x1 + w / 2, H.pillY + T.pillH / 2 + T.sound * 0.36, T.sound, BLACK, 700, 'center', 0.8);
        x1 -= 5;
      }
    }
    // LIVE REC (V.5.3) : sa pastille pleine, la premiere du milieu
    if (DT_FACE && dtFace.live()) {
      const w = this.textWidth('LIVE REC', T.sound, 800, 0.6) + 8;
      if (fits(w)) {
        x1 -= w;
        this.roundRect(x1, H.pillY, w, T.pillH, 2.2, INK);
        this.text('LIVE REC', x1 + w / 2, H.pillY + T.pillH / 2 + T.sound * 0.36, T.sound, BLACK, 800, 'center', 0.6);
        x1 -= 5;
      }
      this.info.head += '|LIVE REC';
    }
    // FILL tenu (V.5.1, tenir YES) : sa pastille pleine, avant tout le reste du milieu
    if (DT_FACE && fill.on) {
      const w = this.textWidth('FILL', T.sound, 800, 0.6) + 8;
      if (fits(w)) {
        x1 -= w;
        this.roundRect(x1, H.pillY, w, T.pillH, 2.2, INK);
        this.text('FILL', x1 + w / 2, H.pillY + T.pillH / 2 + T.sound * 0.36, T.sound, BLACK, 800, 'center', 0.6);
        this.info.head += '|FILL';
        x1 -= 5;
      }
    }
    // CONTROL ALL (V.5.2, TRK + un potard d'une page de voix) : sa pastille pleine tant que NO peut l'annuler (la revue de
    // D3a, R4) ; le mot le plus long qui tient
    if (DT_FACE && ctlAllState.get()) {
      const word = ['CONTROL ALL · NO: UNDO', 'CONTROL ALL', 'ALL'].find((t) => fits(this.textWidth(t, T.sound, 800, 0.6) + 8));
      if (word) {
        const w = this.textWidth(word, T.sound, 800, 0.6) + 8;
        x1 -= w;
        this.roundRect(x1, H.pillY, w, T.pillH, 2.2, INK);
        this.text(word, x1 + w / 2, H.pillY + T.pillH / 2 + T.sound * 0.36, T.sound, BLACK, 800, 'center', 0.6);
        x1 -= 5;
      }
      this.info.head += '|CONTROL ALL · NO: UNDO';
    }
    // Le pas qui joue a des verrous (n'importe quelle page) : P-LOCK un instant, plein (69-common2, point 3)
    if (mode && mode.kind === 'flash') {
      const word = 'P-LOCK';
      const w = this.textWidth(word, T.sound, 800, 0.6) + 8;
      if (fits(w)) {
        x1 -= w;
        this.roundRect(x1, H.pillY, w, T.pillH, 2.2, INK);
        this.text(word, x1 + w / 2, H.pillY + T.pillH / 2 + T.sound * 0.36, T.sound, BLACK, 800, 'center', 0.6);
        this.info.head += '|P-LOCK!';
        x1 -= 5;
      }
    }
    // Ce que joue la voix, a la place qui reste (VOICE le montre en grand dans SOUND : rien ici) ; ecrit comme SOUND
    // (revue du 2026-10-09 : 909+BLUEPRINT ici, BLUEPRINT + 909 dans SOUND), jamais coupe au milieu d'un nom (BLUEP.) :
    // le sample seul s'il n'y a pas la place des deux, sinon rien. La page d'un FX sous GLOBAL (2026-10-10) : la quantite
    // de la machine, ce que joue la voix n'y a rien a faire
    const room = x1 - mid0;
    if (rp.page !== 'voice' && room > 18 && !(scope && screen === scope.global)) {
      const plays = voiceSoundText(inst, stepPlays(inst, lock));
      const txt = plays === inst ? '' : ([plays, plays.split(' + ')[0]].find((t) => this.textWidth(t, T.sound, 600, 0.6) <= room) ?? '');
      if (txt) this.text(txt, x1, y, T.sound, HALF, 600, 'right', 0.6);
    }
  } else if (DT_FACE && fill.on && fits(this.textWidth('FILL', T.sound, 800, 0.6) + 8)) {
    // FILL tenu sans voix choisie (V.5.1) : sa pastille a la place de PICK A VOICE
    const w = this.textWidth('FILL', T.sound, 800, 0.6) + 8;
    x1 -= w;
    this.roundRect(x1, H.pillY, w, T.pillH, 2.2, INK);
    this.text('FILL', x1 + w / 2, H.pillY + T.pillH / 2 + T.sound * 0.36, T.sound, BLACK, 800, 'center', 0.6);
    this.info.head += '|FILL';
  } else if (fits(this.textWidth('PICK A VOICE', T.sound * 0.85, 600, 0.5))) {
    // Sans voix : PICK A VOICE devant ALL (ou devant l'onglet VOICE d'une page de FX) s'il tient
    this.text('PICK A VOICE', x1, y, T.sound * 0.85, FAINT_TEXT, 600, 'right', 0.5);
  }
  this.line([MATRIX.x0, H.rule, UW - MATRIX.x0, H.rule], FAINT, 0.6);
}

/**
 * L'en-tete en P-LOCK (69-common2, point 3 : "P-LOCK MUST BE OBVIOUS") : toute
 * la bande en negatif, P-LOCK STEP 05, la page et P-LOCKS (ENV · P-LOCKS), la
 * voix, le compte des verrous du pas (3 P-LOCKS) sur toutes les pages ; M ou
 * S quand le mode est arme. Le dessin d'avant le 2026-10-22, sorti tel quel
 * de paintPageHead.
 */
function paintLockHead(this: Screen, screen: RytmScreenId, inst: Inst | null, lockStep: number): void {
  const H = PAGE_HEAD;
  const T = this.bt.head;
  const y = H.y;
  this.ctx.fillStyle = INK;
  this.ctx.fillRect(0, 0, UW, H.rule + 0.6);
  const ink = BLACK;
  const ty = H.pillY + T.pillH / 2 + T.pill * 0.36;
  // A droite d'abord : le compte des verrous
  const n = lockCountOf(lockStep);
  const word = n === 1 ? '1 P-LOCK' : `${n} P-LOCKS`;
  const cw = this.text(word, H.right, y, T.bpm * 1.12, ink, 700, 'right', 0.7);
  let rightX = H.right - cw - 6;
  this.info.lockCount = n;
  // MUTE et SOLO armes (2026-10-09) : M ou S, plein en MULTI, en contour pour une voix (meme en P-LOCK)
  const v = voices.get();
  const badge = v.muteMode ? 'M' : v.soloMode ? 'S' : '';
  if (badge) {
    const multi = v.muteMode ? v.muteMulti : v.soloMulti;
    const bw = T.pillH;
    const bx = rightX - bw;
    if (multi) this.roundRect(bx, H.pillY, bw, T.pillH, 2.5, ink);
    else this.roundRect(bx + 0.5, H.pillY + 0.5, bw - 1, T.pillH - 1, 2.5, null, ink, 1);
    this.text(badge, bx + bw / 2, ty, T.pill, multi ? INK : ink, 700, 'center');
    rightX = bx - 5;
    this.info.badge = `${badge}${multi ? '+' : ''}`;
  } else this.info.badge = '';
  // FILL tenu (V.5.1, la revue de D2, U6) : sa pastille aussi en P-LOCK, en negatif comme la bande
  rightX = this.negFill(rightX);
  this.info.headFit = '';
  // P-LOCK STEP 05 : le cadenas, le pas ; puis la page et P-LOCKS en contour
  const gs = T.pill * 0.82;
  this.padlock(H.iconX - 1, ty, gs, BLACK);
  const lk = `P-LOCK STEP ${two(lockStep + 1)}`;
  const lw = this.text(lk, H.iconX - 1 + gs + 3.5, ty, T.pill, BLACK, 800, 'left', 0.8);
  let x = H.iconX - 1 + gs + 3.5 + lw + 6;
  const room = rightX - x - (inst ? this.textWidth(inst, T.voice, 700) + 8 : 0);
  // ENV · P-LOCKS ; trop long (VOICE SYNTH au telephone) : le nom de l'ecran seul, la bande dit deja P-LOCK
  const full = `${SCREEN_TITLE[screen]} · P-LOCKS`;
  const max = Math.max(20, room - 10);
  // La page d'un FX global (2026-10-10, le telephone : GLOBAL FX · . ) : GLOBAL REVERB, puis REVERB, avant de couper
  const label = [full, SCREEN_TITLE[screen], tabWord(screen, inst), SCREEN_LABEL[screen]].find((t) => this.textWidth(t, T.pill, 700, 0.7) <= max) ?? SCREEN_TITLE[screen];
  const fitted = this.fitText(label, max, T.pill, 0.7, 700);
  const pw = this.textWidth(fitted, T.pill, 700, 0.7) + 10;
  this.roundRect(x, H.pillY + 0.5, pw, T.pillH - 1, 2.5, null, BLACK, 0.9);
  this.text(fitted, x + pw / 2, ty, T.pill, BLACK, 700, 'center', 0.7);
  this.info.head = `${lk} | ${fitted}${DT_FACE && fill.on ? '|FILL' : ''}`;
  x += pw + 7;
  if (inst && x + 10 < rightX) this.text(inst, x, y, T.voice, BLACK, 700);
}

/**
 * L'en-tete d'une scene armee (2026-10-27, P2-19) : toute la bande en negatif comme le P-LOCK, SCENE A · 3 PARAMS · A01
 * (la scene, ce qu'elle garde, le pattern ou elle vit), la voix a droite.
 */
function paintSceneHead(this: Screen, screen: RytmScreenId, inst: Inst | null, w: SceneId): void {
  const H = PAGE_HEAD;
  const T = this.bt.head;
  const y = H.y;
  this.ctx.fillStyle = INK;
  this.ctx.fillRect(0, 0, UW, H.rule + 0.6);
  const ty = H.pillY + T.pillH / 2 + T.pill * 0.36;
  let rightX = H.right;
  if (inst) rightX -= this.text(inst, H.right, y, T.voice, BLACK, 700, 'right') + 6;
  // FILL tenu (U6) : sa pastille aussi quand une scene est armee
  rightX = this.negFill(rightX);
  const n = sceneCount(pattern.scenes.get(), w);
  const head = `SCENE ${w === 'a' ? 'A' : 'B'} · ${n} PARAM${n === 1 ? '' : 'S'} · ${slotName(patterns.get().cur)}`;
  const fitted = this.fitText(head, Math.max(20, rightX - H.iconX - 4), T.pill, 0.8, 800);
  this.text(fitted, H.iconX - 1, ty, T.pill, BLACK, 800, 'left', 0.8);
  this.info.head = `${head}${DT_FACE && fill.on ? '|FILL' : ''}`;
  this.info.lockCount = 0;
  this.info.badge = '';
  this.info.headFit = '';
  void screen;
}

/**
 * La gauche de l'en-tete de la vue PAGE au palier fit (2026-10-22, audit
 * SB-13), sans rien dessiner : la pastille de la page, puis ses onglets
 * (VOICE : MAIN SYNTH ; FX : BD FX GLOBAL ; la page d'un FX global : GLOBAL >
 * BIT ; sous DIST CHORUS DELAY REVERB : DELAY > GLOBAL, l'onglet de la voix
 * etant la colonne de la voix). optional false : sans BD FX sur la page d'un
 * FX global (il cede sa place le premier). end : le bord droit du dernier
 * onglet. paintPageHead la dessine (drawHeadLeft), headPlan la mesure.
 */
function headLeft(this: Screen, page: RytmPageId, screen: RytmScreenId, inst: Inst | null, fit: HeadFit, optional: boolean): HeadLeft {
  const H = PAGE_HEAD;
  const T = this.bt.head;
  const label = pageLabel(page);
  const pw = this.textWidth(label, T.pill, 700, 0.9) + 12;
  const ts = T.pill * 0.92 * fit.s;
  const tabW = (name: string): number => this.textWidth(name, ts, 700, 0.7) + fit.pad;
  const chev = ts * 0.62;
  const chevStep = 1 + chev * 0.5 + fit.chev;
  const out: HeadLeft = { label, pw, ts, chev, ops: [], end: H.pillX + pw, heads: label };
  let x = H.pillX + pw + 5;
  const add = (op: HeadOp): void => {
    out.ops.push(op);
    out.end = op.kind === 'chev' ? x + 1 + chev * 0.5 : op.x + op.w;
  };
  const scope = fxScopeTabs(screen);
  const detail = isFxDetail(screen) ? screen : null;
  if (scope) {
    // Le FX en titre, un chevron, GLOBAL (la voix : sa colonne)
    const dn = SCREEN_LABEL[screen];
    const dw = this.textWidth(dn, ts, 700, 0.7) + fit.tpad;
    add({ kind: 'text', text: dn, x, w: dw, color: INK, align: 'left' });
    x += dw;
    add({ kind: 'chev', x, w: chev });
    x += chevStep;
    const gn = SCREEN_LABEL.fxg;
    const gw = tabW(gn);
    const on = screen === scope.global;
    add({ kind: 'tab', text: gn, x, w: gw, on, zone: { screen: scope.global, x0: x - 0.5, x1: x + gw + 0.5 } });
    out.heads += `|${dn}>|${on ? '[' : ''}${gn}${on ? ']' : ''}`;
    return out;
  }
  const tabs = screensOf(page, inst);
  // V.5.0 au desktop : SEND FX n'a qu'un onglet, la page de son FX garde GLOBAL > BIT
  if (tabs.length < 2 && !detail) return out;
  for (const t of tabs) {
    const name = t === 'fxv' ? (inst ? `${inst} FX` : 'VOICE FX') : SCREEN_LABEL[t];
    if (detail && t === 'fxv' && !optional) continue;
    if (detail && t === 'fxg') {
      // GLOBAL en retrait (une tape y revient), le chevron, le FX de la page cerne ; le tout est la zone de GLOBAL
      const x0 = x;
      const gw = tabW(name);
      add({ kind: 'text', text: name, x, w: gw, color: FAINT_TEXT, align: 'center' });
      x += gw;
      add({ kind: 'chev', x, w: chev });
      x += chevStep;
      const dn = SCREEN_LABEL[detail];
      const dw = tabW(dn);
      add({ kind: 'tab', text: dn, x, w: dw, on: true, zone: { screen: 'fxg', x0: x0 - 0.5, x1: x + dw + 0.5 } });
      out.heads += `|${name}>[${dn}]`;
      x += dw + fit.gap;
      continue;
    }
    const on = t === screen;
    const tw = tabW(name);
    // La zone de l'onglet : toute la hauteur de l'en-tete (la touche de la page la double, 44 px au doigt)
    add({ kind: 'tab', text: name, x, w: tw, on, zone: { screen: t, x0: x - 0.5, x1: x + tw + 0.5 } });
    out.heads += `|${on ? '[' : ''}${name}${on ? ']' : ''}`;
    x += tw + fit.gap;
  }
  return out;
}

/**
 * Les points de page (2026-10-27, desktop : la deuxieme page des huit potards, comme une Digitakt) : sous la pastille de
 * la page, deux points, celui de l'onglet montre plein ; seulement pour une page a deux onglets (VOICE avec SYNTH, FX).
 * Sous la pastille, dans l'air de l'en-tete : rien d'autre ne bouge (FLTR et ENV restent identiques).
 */
function paintPageDots(this: Screen, rp: RytmPageState, pw: number, inst: Inst | null): void {
  if (!FACE_PAGES) return;
  const tabs = screensOf(rp.page, inst);
  if (tabs.length !== 2) return;
  const H = PAGE_HEAD;
  const T = this.bt.head;
  const cur = Math.max(0, Math.min(1, rp.tabs[rp.page] ?? 0));
  const r = PAGE_DOTS.r;
  const cy = (H.pillY + T.pillH + H.rule) / 2;
  const cx = H.pillX + pw / 2;
  for (let i = 0; i < 2; i += 1) this.circle(cx + (i - 0.5) * PAGE_DOTS.gap, cy, r, i === cur ? INK : FAINT_TEXT);
  this.info.pageDots = `${cur + 1}/2`;
}

/** Dessine la gauche de l'en-tete (headLeft) et pose les zones de ses onglets (lcd-tab-<ecran>). */
function drawHeadLeft(this: Screen, h: HeadLeft, ty: number): void {
  const H = PAGE_HEAD;
  const T = this.bt.head;
  this.roundRect(H.pillX, H.pillY, h.pw, T.pillH, 2.5, INK);
  this.text(h.label, H.pillX + h.pw / 2, ty, T.pill, BLACK, 700, 'center', 0.9);
  for (const op of h.ops) {
    if (op.kind === 'chev') {
      const cy = H.pillY + T.pillH / 2;
      const ch = h.chev * 0.55;
      this.line([op.x + 1, cy - ch, op.x + 1 + h.chev * 0.5, cy, op.x + 1, cy + ch], HALF, 1);
      continue;
    }
    if (op.kind === 'text') {
      if (op.align === 'center') this.text(op.text, op.x + op.w / 2, ty, h.ts, op.color, 700, 'center', 0.7);
      else this.text(op.text, op.x, ty, h.ts, op.color, 700, 'left', 0.7);
      continue;
    }
    if (op.on) this.roundRect(op.x, H.pillY + 0.6, op.w, T.pillH - 1.2, 2.2, null, INK, 1.1);
    this.text(op.text, op.x + op.w / 2, ty, h.ts, op.on ? INK : FAINT_TEXT, 700, 'center', 0.7);
    this.tabSpots.push({ screen: op.zone.screen, ...this.spot({ x: op.zone.x0, y: -this.headUp, w: op.zone.x1 - op.zone.x0, h: H.rule + this.headUp }) });
  }
}

defineMethods(Screen, { paintPageHead, paintLockHead, paintSceneHead, headLeft, paintPageDots, drawHeadLeft });
