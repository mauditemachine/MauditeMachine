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

/**
 * Les quatorze touches du boitier MMHW v2 d'aujourd'hui, dans leur ordre (V.6.0, cahier dt2 2.6 : "un FACE_KEYS_HW a
 * part garde l'ordre des 14 touches d'avant pour le boitier actuel") : ROW_KEYS, fige. Leurs notes et leur effet ne
 * changent pas (HW_KEY_NOTES).
 */
export const FACE_KEYS_HW: readonly RowKeyId[] = ROW_KEYS;

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
  /** LIVE REC (V.5.3) : la LED de ● clignote */
  readonly live?: boolean;
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
        return led(id, pal.red, s.rec ? 1 : 0, s.rec && !!s.live);
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

/** Les marques des trigs de la voix choisie pour le boitier (V.5.1) : ses lock trigs et ses pas a condition, leur couleur. */
export interface HwTrigLeds {
  /** les pas (0 a 15) qui sont des lock trigs : allumes en jaune, sans note */
  readonly lock: readonly number[];
  /** les pas dont le trig a une COND ou une PROB : le petit point jaune au coin */
  readonly cond: readonly number[];
  /** le jaune des verrous (#RRGGBB) */
  readonly color: string;
}

/**
 * Les marques des trigs (V.5.1, 2026-10-29) d'apres leurs masques de 16 bits (bit i : le pas i, rytm/trigMarks.ts) et le
 * jaune de la palette.
 */
export function trigLeds(ltrg: number, cond: number, yellow: string): HwTrigLeds {
  const bits = (m: number): number[] => {
    const out: number[] = [];
    for (let i = 0; i < 16; i += 1) if ((m >> i) & 1) out.push(i);
    return out;
  };
  return { lock: bits(ltrg), cond: bits(cond), color: yellow };
}

/**
 * La vue BANK (V.5.2, FUNC + PTN) sur les pas 1 a 8 : la banque du pattern qui joue rouge plein, la banque affichee (si ce
 * n'est pas elle) rouge clignotante, une banque qui a des patterns blanc faible, une vide eteinte ; 9 a 16 eteints.
 */
export function bankLeds(playing: number, shown: number, filled: readonly boolean[], pal: RowPalette, lv: PtnLevels): HwGridLed[] {
  return ptnLeds(playing, shown !== playing ? shown : -1, [], Array.from({ length: 16 }, (_, i) => i < 8 && !!filled[i]), pal, lv);
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

/* ---------------- V.6.0 (lane B6) : la face Digitakt II, ses notes, les 16 pistes ---------------- */

/** Les touches de la face DT2 pour le boitier (rytm/dtFaceIds.ts DT2_BUTTONS, le meme ordre : celui de lecture de la face). */
export type Dt2KeyHw = 'func' | 'kbd' | 'trk' | 'ptn' | 'mute' | 'solo' | 'preset' | 'settings' | 'sounds' | 'tempo' | 'rec' | 'play' | 'stop' | 'trig' | 'src' | 'fltr' | 'amp' | 'fx' | 'mod' | 'yes' | 'up' | 'open' | 'no' | 'left' | 'down' | 'right' | 'ptnpage';

/** Les 27 touches de la face DT2 (cahier dt2 2.2), dans l'ordre de DT2_BUTTONS (hw:test le verifie). */
export const DT2_KEYS_HW: readonly Dt2KeyHw[] = ['func', 'kbd', 'trk', 'ptn', 'mute', 'solo', 'preset', 'settings', 'sounds', 'tempo', 'rec', 'play', 'stop', 'trig', 'src', 'fltr', 'amp', 'fx', 'mod', 'yes', 'up', 'open', 'no', 'left', 'down', 'right', 'ptnpage'];

/**
 * La note de chaque touche du boitier et la cible MIDI qu'elle pilote (cahier dt2 2.6). Les quatorze d'aujourd'hui gardent
 * leur note et leur effet (TRK 60 donne par Mika ; 61 a 73 proposees en V.5.0) ; les onze touches nouvelles ont une note
 * PROPOSEE (74 a 78, 81 a 86 ; 79 et 80 restent SCENE A et B) : toutes "a confirmer avec protocol.js" (confirmed faux),
 * sauf TRK. alt : la cible de FUNC + la touche quand le site en a une directe.
 */
export interface HwKeyNote {
  readonly note: number;
  readonly target: string;
  readonly alt?: string;
  readonly confirmed: boolean;
  /** la touche existe sur le boitier d'aujourd'hui (les quatorze) */
  readonly today: boolean;
}

export const HW_KEY_NOTES: Readonly<Record<Dt2KeyHw, HwKeyNote>> = {
  trk: { note: 60, target: 'rytm:trk', confirmed: true, today: true },
  func: { note: 61, target: 'rytm:func', confirmed: false, today: true },
  ptn: { note: 62, target: 'rytm:edit', confirmed: false, today: true },
  rec: { note: 63, target: 'rytm:rec', confirmed: false, today: true },
  play: { note: 64, target: 'rytm:play', confirmed: false, today: true },
  stop: { note: 65, target: 'rytm:stop', confirmed: false, today: true },
  trig: { note: 66, target: 'rytm:page:trig', confirmed: false, today: true },
  src: { note: 67, target: 'rytm:page:voice', confirmed: false, today: true },
  fltr: { note: 68, target: 'rytm:page:fltr', confirmed: false, today: true },
  amp: { note: 69, target: 'rytm:page:env', confirmed: false, today: true },
  fx: { note: 70, target: 'rytm:page:fx', confirmed: false, today: true },
  mod: { note: 71, target: 'rytm:page:mod', confirmed: false, today: true },
  yes: { note: 72, target: 'rytm:yes', confirmed: false, today: true },
  no: { note: 73, target: 'rytm:no', confirmed: false, today: true },
  kbd: { note: 74, target: 'rytm:keyboard', confirmed: false, today: false },
  preset: { note: 76, target: 'rytm:preset', confirmed: false, today: false },
  settings: { note: 77, target: 'rytm:settings', confirmed: false, today: false },
  sounds: { note: 78, target: 'rytm:sounds', confirmed: false, today: false },
  tempo: { note: 81, target: 'rytm:screen:tempo', alt: 'rytm:tap', confirmed: false, today: false },
  up: { note: 82, target: 'rytm:up', confirmed: false, today: false },
  down: { note: 83, target: 'rytm:down', confirmed: false, today: false },
  left: { note: 84, target: 'rytm:left', confirmed: false, today: false },
  right: { note: 85, target: 'rytm:right', confirmed: false, today: false },
  ptnpage: { note: 86, target: 'rytm:ptnpage', alt: 'rytm:fill', confirmed: false, today: false },
  mute: { note: 87, target: 'rytm:mute', confirmed: false, today: false },
  solo: { note: 88, target: 'rytm:solo', confirmed: false, today: false },
  open: { note: 89, target: 'rytm:open', confirmed: false, today: false },
};

/** Les deux potards de gauche de la face DT2 : leur CC propose (a confirmer avec protocol.js), leur cible. data : relatif. */
export const HW_SIDE_CCS = {
  mvol: { cc: 29, target: 'rytm:enc:level', relative: false },
  data: { cc: 38, target: 'rytm:data', relative: true },
} as const;

/** Les couleurs de la face DT2 en plus de la rangee : l'orange de PERFORM KIT, le bleu de l'euclidien. */
export interface FacePalette extends RowPalette {
  readonly orange: string;
  readonly blue: string;
}

/** Ce que montre la face DT2 (scene/rytmFaceKeys.ts info(), et les stores tant que B4 et B5 ne l'ont pas branchee). */
export interface FaceState {
  readonly func: RowState['func'];
  readonly trk: RowState['trk'];
  /** la grille des patterns (PTN) ou KIT ouverte ; bank : la vue BANK (FUNC + PTN) */
  readonly ptn: boolean;
  readonly bank: boolean;
  readonly keyboard: boolean;
  /** le menu ouvert de PRESET/KIT, SETTINGS, SOUNDS, TEMPO ; null aucun */
  readonly menu: 'preset' | 'settings' | 'sounds' | 'tempo' | null;
  readonly perform: boolean;
  /** FILL sur PAGE : tenu ou verrouille (on), en attente d'un cycle (armed) */
  readonly fill: 'off' | 'on' | 'armed';
  readonly rec: 'off' | 'grid' | 'live' | 'step' | 'euclid';
  readonly play: RowState['play'];
  readonly page: string;
  readonly home: boolean;
  /** un trig tenu : les pages qui portent ses verrous (leurs touches en rouge, les autres eteintes) */
  readonly pageLocks?: readonly string[];
  /** l'eclair blanc d'un appui (0 a 1), toute touche */
  readonly flash?: Readonly<Partial<Record<Dt2KeyHw, number>>>;
}

/** Une LED de la face DT2 : blink, le clignotement ; double, le double clignotement de STEP REC (cahier 2.4). */
export interface HwFaceLed {
  readonly id: Dt2KeyHw;
  readonly color: string;
  readonly level: number;
  readonly blink: boolean;
  readonly double: boolean;
}

/** Les pages de la rangee de la face DT2 : TRIG..MOD et leur page (SRC ouvre voice, AMP env, comme la rangee). */
const DT2_PAGE_OF: Readonly<Partial<Record<Dt2KeyHw, string>>> = { trig: 'trig', src: 'voice', fltr: 'fltr', amp: 'env', fx: 'fx', mod: 'mod' };

/**
 * Les 25 LED de la face DT2 (cahier dt2 2.4), les memes regles que scene/rytmFaceKeys.ts look() : FUNC blanc (plein tenue,
 * clignotant gardee) ; TRK rouge (clignotante gardee) ; PTN rouge (vue BANK : clignotante) ; KEYBOARD rouge en mode
 * clavier ; SONG rouge (SONG EDIT : clignotante) ; PRESET/KIT, SETTINGS, SOUNDS, TEMPO rouges leur menu ouvert
 * (PRESET/KIT orange en PERFORM KIT) ; REC GRID rouge, LIVE clignotant, STEP double clignotement, euclidien bleu ; PLAY
 * vert (pause : clignotant) ; PAGE rouge en FILL (en attente : clignotante) ; TRIG..MOD la page affichee rouge (HOME :
 * faible), un trig tenu : les pages qui portent ses verrous ; STOP, YES, NO, les fleches : l'eclair blanc de l'appui (et
 * toute touche par-dessus son etat).
 */
export function faceLeds(s: FaceState, pal: FacePalette): HwFaceLed[] {
  const led = (id: Dt2KeyHw, color: string, level: number, blink = false, double = false): HwFaceLed => ({ id, color: level > 0 ? color : '', level, blink, double });
  return DT2_KEYS_HW.map((id) => {
    const fl = Math.max(0, Math.min(1, s.flash?.[id] ?? 0));
    if (id === 'func') return led(id, pal.white, s.func === 'off' ? 0 : 1, s.func === 'once' || s.func === 'locked');
    if (id === 'trk') return led(id, pal.red, s.trk === 'off' ? 0 : 1, s.trk === 'latched');
    if (id === 'ptn') return s.bank ? led(id, pal.red, 1, true) : led(id, pal.red, s.ptn ? 1 : 0);
    if (id === 'rec') {
      if (s.rec === 'euclid') return led(id, pal.blue, 1);
      return led(id, pal.red, s.rec === 'off' ? 0 : 1, s.rec === 'live', s.rec === 'step');
    }
    if (id === 'play') return led(id, pal.green, s.play === 'stop' ? 0 : 1, s.play === 'pause');
    if (fl > 0 || id === 'stop' || id === 'yes' || id === 'no' || id === 'up' || id === 'down' || id === 'left' || id === 'right') return led(id, pal.white, fl);
    const pg = DT2_PAGE_OF[id];
    if (pg) {
      if (s.pageLocks && s.pageLocks.length > 0) return led(id, pal.red, s.pageLocks.includes(pg) ? 1 : 0);
      if (pg !== s.page) return led(id, pal.red, 0);
      return led(id, pal.red, s.home ? ROW_HOME_LEVEL : 1);
    }
    if (id === 'kbd') return led(id, pal.red, s.keyboard ? 1 : 0);
    if (id === 'preset' && s.perform) return led(id, pal.orange, 1);
    if (id === 'preset' || id === 'settings' || id === 'sounds' || id === 'tempo') return led(id, pal.red, s.menu === id ? 1 : 0);
    if (id === 'ptnpage') return led(id, pal.red, s.fill === 'off' ? 0 : 1, s.fill === 'armed');
    return led(id, pal.red, 0);
  });
}

/** Une piste sur les seize pas en vue TRK : son rang, sa couleur, son eclat, la barre (mute : joue quand d'autres sont coupees). */
export interface HwTrackLed {
  readonly i: number;
  /** T1 a T16 */
  readonly name: string;
  readonly color: string;
  readonly level: number;
  readonly bar: 'mute' | 'solo' | null;
}

/** Les seize pistes : la choisie (-1 : aucune), les coupees, celles du pattern, celles en solo, chacune par son rang. */
export interface TracksState {
  readonly cur: number;
  readonly muted: readonly boolean[];
  readonly pmuted: readonly boolean[];
  readonly solo: readonly boolean[];
  /** combien de pistes la face montre : 8 (la V.5.3, 9 a 16 eteints) ou 16 (la face DT2) */
  readonly count: number;
}

/**
 * La vue TRK sur seize pistes (V.6.0, cahier dt2 4.5 : "16 LED de pas en TRK et MUTE") : la regle de rytm/stepLeds.ts
 * trkLeds (la face facon Digitakt) etendue a 16 : la piste choisie pleine, les autres lv.other, une coupee lv.muted ; la
 * barre verte des pistes qui jouent quand d'autres sont coupees ou en solo, blanche en solo.
 */
export function trackLeds16(s: TracksState, pal: RowPalette, lv: { readonly cur: number; readonly other: number; readonly muted: number }): HwTrackLed[] {
  const anyCut = s.muted.some(Boolean) || s.pmuted.some(Boolean) || s.solo.some(Boolean);
  const anySolo = s.solo.some(Boolean);
  const out: HwTrackLed[] = [];
  for (let i = 0; i < 16; i += 1) {
    const name = `T${i + 1}`;
    if (i >= s.count) {
      out.push({ i, name, color: '', level: 0, bar: null });
      continue;
    }
    const m = !!s.muted[i] || !!s.pmuted[i];
    const level = i === s.cur ? lv.cur : m ? lv.muted : lv.other;
    const plays = anySolo ? !!s.solo[i] : !m;
    const bar = s.solo[i] ? 'solo' : anyCut && plays ? 'mute' : null;
    out.push({ i, name, color: level > 0 ? pal.red : '', level, bar });
  }
  return out;
}

/**
 * Le mode MUTE sur seize pistes (V.6.0) : la regle de rytm/stepLeds.ts muteLeds etendue a 16 : global, une piste qui joue
 * en vert, coupee eteinte ; pattern, en magenta ; une piste en solo en blanc, pleine.
 */
export function muteLeds16(kind: 'global' | 'pattern', s: TracksState, pal: RowPalette & { readonly magenta: string }): HwGridLed[] {
  const out: HwGridLed[] = [];
  for (let i = 0; i < 16; i += 1) {
    if (i >= s.count) out.push({ i, color: '', level: 0, blink: false });
    else if (s.solo[i]) out.push({ i, color: pal.white, level: 1, blink: false });
    else {
      const cut = kind === 'global' ? !!s.muted[i] : !!s.pmuted[i];
      out.push({ i, color: cut ? '' : kind === 'global' ? pal.green : pal.magenta, level: cut ? 0 : 1, blink: false });
    }
  }
  return out;
}
