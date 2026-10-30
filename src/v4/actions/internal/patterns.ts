/**
 * Les actions du MM-RYTM, patterns : ses aides que d'autres modules d'actions/ utilisent (P0, 2026-10-30, deplacees telles
 * quelles de actions.ts). Jamais exportees par le baril : elles ne sortent pas d'actions/.
 */

import { familyOf, kit, type KitFamily, type KitModel } from '../../audio/kit';
import { INSTRUMENTS } from '../../audio/pattern';
import type { Stage } from '../../scene/renderer';
import { lcdMessage } from '../../state/lcdMessage';
import type { ShotId } from '../../audio/shotsdsp';
import { editor } from '../../state/editor';
import { bankName, patterns } from '../../state/patterns';
import { dtFace } from '../../state/dtFace';
import { type Inst } from '../../theme';
import { st } from '../state';
import { layerTop } from './kit';
import { voiceSounds } from '../kit';

/* ---------------- les banques A a H (V.5.2, 2026-10-30, docs/v4/digitakt-d3a-spec.md section 1) ---------------- */



/** FUNC + PTN : la vue BANK, les pas 1 a 8 sont les banques A a H ; encore une fois, elle se ferme. */
export function bankViewToggle(stage: Stage | null): void {
  stage?.pressRytmPad('edit');
  if (dtFace.bank()) {
    bankViewClose();
    return;
  }
  // La grille gagne sur le mode MUTE, comme PTN (la revue de D3a, R2 et R10)
  if (dtFace.mute() !== 'off') dtFace.setMute('off');
  st.bankOverGrid = editor.get() === 'mm808';
  if (!st.bankOverGrid) editor.toggle('mm808');
  dtFace.setBank(true);
  lcdMessage.show(`BANK ${bankName(patterns.get().bank)} · STEPS 1-8: BANKS A-H`, 2400);
}

/** PTN, NO ou Echap dans la vue BANK : elle se ferme (la grille PTN reste si elle etait la avant). */
export function bankViewClose(): void {
  dtFace.setBank(false);
  if (!st.bankOverGrid && editor.get() === 'mm808') editor.toggle('mm808');
  st.bankOverGrid = false;
  lcdMessage.show('BANK CLOSED', 900);
}

/** La part des samples dans le tirage d'une voix qui en a (le kick plus encore : ses samples sont ceux de Mika). */
const RANDOM_SAMPLE_ODDS: Readonly<Partial<Record<KitFamily, number>>> = { bd: 0.85 };

/**
 * RANDOM tire aussi le son de chaque voix (2026-10-18, Mika : "au Random les sons sont replaces dans le sequenceur mais
 * je n'ai pas l'impression que les voices et les samples changent") : dans sa liste de SOUND, jamais OFF ni le son
 * qu'elle jouait ; une voix qui a des samples en prend un le plus souvent (75 %, le kick 85 %), seul a son niveau ;
 * sinon une machine (909, 808, MM). Le kick compris. Meme etape UNDO que le motif (le kit est suivi par UNDO).
 */
export function randomVoiceSounds(list: readonly Inst[] = INSTRUMENTS): void {
  const k = kit.get();
  for (const inst of list) {
    const f = familyOf(inst as ShotId);
    if (!f) continue;
    const l = k.layer[f];
    const now = k.sample[f] && l.lev > 0 ? k.sample[f] : l.syn > 0 ? k.model[f] : null;
    const list = voiceSounds(inst).filter((s) => (s.kind === 'smp' || s.kind === 'mach') && s.key !== now);
    const smps = list.filter((s) => s.kind === 'smp');
    const machs = list.filter((s) => s.kind === 'mach');
    const pool = smps.length > 0 && (machs.length === 0 || Math.random() < (RANDOM_SAMPLE_ODDS[f] ?? 0.75)) ? smps : machs;
    const s = pool[Math.floor(Math.random() * pool.length)];
    if (!s) continue;
    const top = layerTop(l.syn, l.lev);
    if (s.kind === 'smp') kit.setVoice(f, { sample: s.key, syn: 0, lev: top });
    else kit.setVoice(f, { model: s.key as KitModel, syn: top, lev: 0 });
  }
}
