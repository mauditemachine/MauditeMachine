/** Les INFOS du MM-RYTM : l'assemblage de la table et la carte d'une commande (deplaces de rytm/infos.ts en P0, 2026-10-30, cahier dt2 5.0). */

import { type Inst } from '../../theme';
import { RYTM_INFO_PAGE_LABEL, RYTM_LETTERS, resolveRytmId, rytmAvail, rytmSlotOf, voiceGroup, type RytmInfoId } from '../diagrams';
import type { Raw, RytmInfo, RytmInfoCtx, Words } from './types';
import { PHONE, deskWords, phoneWords, fr, LOCK_LINE, ENC_LINE, ENC_IDS, FACE_LINE } from './words';
import { RAW_PAGES } from './pages';
import { RAW_VOICE } from './voice';
import { RAW_SOUND } from './sound';
import { RAW_FX } from './fx';
import { RAW_TWEAKS } from './tweaks';
import { RAW_FACE } from './face';
import { RAW_SOON } from './soon';
import { RAW_LAYERS } from './layers';
import { RAW_CONTROLS } from './controls';
import { RAW_V60 } from './v60';
import { RAW_V61 } from './v61';
import { RAW_V62 } from './v62';

export type { RytmInfo, RytmInfoCtx, RytmLockable } from './types';

/**
 * La table des cartes : un fichier par domaine (rytm/infos/*.ts), dans l'ordre d'avant (allRytmInfos le garde), puis un
 * fichier reserve par version (v60, v61, v62), vide en P0. Chaque id de rytm/diagrams.ts une fois, ni plus ni moins (le
 * type le verifie).
 */
const RAW: Record<RytmInfoId, Raw> = {
  ...RAW_PAGES,
  ...RAW_VOICE,
  ...RAW_SOUND,
  ...RAW_FX,
  ...RAW_TWEAKS,
  ...RAW_FACE,
  ...RAW_SOON,
  ...RAW_LAYERS,
  ...RAW_CONTROLS,
  ...RAW_V60,
  ...RAW_V61,
  ...RAW_V62,
};

/** Les mots de la voix choisie : la voix d'abord, puis sa famille, puis sans voix. */
function wordsFor(r: Raw, voice: Inst | null | undefined): Words {
  if (!r.voice) return {};
  if (!voice) return r.voice.none ?? {};
  return { ...(r.voice[voiceGroup(voice)] ?? {}), ...(r.voice[voice] ?? {}) };
}

/** La section d'un reglage : la plaque, sinon l'ecran et la lettre de son bloc pour cette voix (ENV C), sinon celle de la table. */
function sectionOf(id: RytmInfoId, r: Raw, c: RytmInfoCtx): string {
  if (c.plate && r.plate) return r.plate.section;
  if (r.section === 'VOICES' || r.section === 'TRANSPORT' || r.section === 'SCREEN' || r.section === 'KEYS' || r.section === 'PAGES') return r.section;
  // Un encodeur du desktop (2026-10-09) : son FX global, a poste fixe
  if (c.encoder !== undefined) return `GLOBAL FX  ENCODER ${c.encoder + 1}`;
  const at = rytmSlotOf(id, c.voice ?? null, c.page);
  if (at) return `${RYTM_INFO_PAGE_LABEL[at.page]} ${RYTM_LETTERS[at.k]}`;
  // Au desktop (V.5.0) : VOICE est SRC, VOICE SYNTH SRC SYNTH, GLOBAL FX SEND FX
  if (!PHONE) return r.section === 'VOICE' ? 'SRC' : deskWords(r.section);
  return r.section;
}

const two = (n: number): string => (n < 10 ? `0${n}` : String(n));

/**
 * La carte d'une commande du MM-RYTM, null pour un id inconnu. Un bloc de
 * l'ecran (p:0 a p:7) montre le reglage qu'il tient (ctx.page, ctx.voice,
 * ctx.target) ; une case vide, la carte des cases vides (enc).
 */
export function infoOf(id: string, ctx: RytmInfoCtx = {}): RytmInfo | null {
  const rid = resolveRytmId(id, ctx);
  if (!rid) return null;
  const r = RAW[rid];
  const w = wordsFor(r, ctx.voice);
  // Une voix sans rien a verrouiller (lock null) passe avant tout : son bloc n'a rien a choisir
  const lock = w.lock === null ? undefined : (ctx.lockable ?? w.lock ?? r.lock);
  let title = ctx.plate && r.plate ? r.plate.title : (w.title ?? r.title);
  if (ctx.step !== undefined && ctx.step >= 0 && ctx.step < 16) {
    if (rid === 'step') title = `STEP ${two(ctx.step + 1)}`;
    else if (rid === 'lock') title = `P-LOCK ${two(ctx.step + 1)}`;
  }
  // La phrase du verrou : pour un reglage des ecrans (la plaque TWEAKS n'a pas de pas) ; un FX global, son encodeur (au
  // telephone aussi depuis le 2026-10-19)
  const ph = PHONE ? r.phone : undefined;
  const base = w.text ?? ph?.text ?? r.text;
  const withLock = lock && !ctx.plate ? `${base} ${LOCK_LINE[lock]}` : base;
  // Au desktop (2026-10-27) : tout reglage des ecrans a son potard a sa place ; au telephone, les FX globaux leur encodeur
  const extra = PHONE ? (lock === 'global' && !ctx.plate && ENC_IDS.has(rid) ? ENC_LINE : '') : lock && !ctx.plate ? FACE_LINE : '';
  const text = phoneWords(extra ? `${withLock} ${extra}` : withLock);
  const tip = w.tip ?? r.tip;
  return {
    id: rid,
    section: sectionOf(rid, r, ctx),
    title,
    ...(r.steps ? { steps: (ph?.steps ?? r.steps).map((x) => fr(phoneWords(x))) } : {}),
    text: fr(text),
    ...(r.key ? { key: fr(`Au clavier : ${r.key}.`) } : {}),
    ...(tip ? { tip: fr(phoneWords(tip)) } : {}),
    avail: rytmAvail(rid),
    ...(lock ? { lock } : {}),
  };
}

/** Toutes les cartes (les tests, une page d'aide) : id, sans voix ni page. */
export function allRytmInfos(ctx: RytmInfoCtx = {}): RytmInfo[] {
  return (Object.keys(RAW) as RytmInfoId[]).map((id) => infoOf(id, ctx)).filter((x): x is RytmInfo => x !== null);
}
