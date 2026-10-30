/**
 * Les actions du MM-RYTM : le kit (TWEAKS, couches SYNTH et SAMPLE, samples d'une voix, MIX, la velocite de la tape). Deplace tel quel de actions.ts en P0 (2026-10-30, docs/v4/dt2/dt2-master-spec.md 5.0) ;
 * actions.ts (le baril) en exporte tout. Ses aides utilisees par d'autres modules : actions/internal/kit.ts.
 */

import { resume } from '../audio/drums';
import { KIT_FAMILIES, KIT_LABEL, KIT_MODELS, KIT_MODEL_LABEL, LAYER_PARAMS, familyOf, kit, mixOf, type KitFamily, type KitId, type Plays } from '../audio/kit';
import { sampleByKey, sampleStatus, samplesOf, samplesVersion } from '../audio/samples';
import { pattern } from '../audio/pattern';
import type { Stage } from '../scene/renderer';
import { voyEcho } from '../voyager/echo';
import { lcdMessage } from '../state/lcdMessage';
import type { ShotId } from '../audio/shotsdsp';
import { rytmPage } from '../state/rytmPage';
import { pageSlots, type PageSlot, type RytmScreenId, type SlotTarget } from '../rytm/pages';
import { v127Text, type LayerDial } from '../rytm/values';
import { POT_UI, type EncId, type Inst } from '../theme';
import { stepIndex, voyKnob, voyParams, type VoyKnobId } from '../voyager/params';
import { seq } from '../voyager/seq';
import { kitReadout, touchPage } from './internal/dials';
import { FAIL_WORD, layerNotches, layerReadout, layerSpan, layerValueOf, voiceSoundCache } from './internal/kit';
import { FAM_TAG, LOCK_FAMS } from './internal/locks';
import type { SeqDial } from './mixer';

/** La famille de sons de la voix selectionnee (le potard SAMPLE) ; null sans voix, ou CY et PC (un seul son). */
export function soundFamily(): KitFamily | null {
  const inst = pattern.get().instrument;
  return inst ? familyOf(inst as ShotId) : null;
}

/**
 * Un potard du MM-VOYAGER (0 a 1) ; l'ecran dit sa valeur. Depuis le grand
 * ecran (2026-10-08) : son echo (voyager/echo.ts, le nom, la valeur de 0 a
 * 127, l'unite, le dessin) a la place du message CUTOFF 64 %.
 */
export function voyDial(id: VoyKnobId, v: number): void {
  resume();
  // MODE, RANGE et NOTES fabriquent la suite : la tourner repasse en AUTO (voyager/seq.ts)
  if (voyParams.set(id, v) && (id === 'mode' || id === 'range' || id === 'notes')) seq.auto();
  voyEcho.touch(id);
}

/**
 * Un bouton poussoir du MM-ARP (2026-10-11, SUB OCT, Mika : "le knob Oct a
 * deux positions il faut qu'on fasse un peu d'espace ya pas un endroit
 * meilleure ? ou ptete un bouton poussoir je sais pas" ; 2026-10-12, CHORUS,
 * les modes du Juno-106) : chaque appui passe au cran suivant (-1, -2, puis
 * -1 ; OFF, I, II, puis OFF) ; la touche s'enfonce, l'ecran le dit comme pour
 * un potard (l'echo : SUB -2 OCT, CHORUS II), ses LED suivent.
 */
export function voyPush(id: VoyKnobId, stage: Stage | null = null): void {
  const n = voyKnob(id).steps?.length ?? 2;
  voyDial(id, ((stepIndex(id, voyParams.of(id)) + 1) % n) / Math.max(1, n - 1));
  stage?.voy?.keys.pressPush(id);
}

/**
 * Un TWEAK du MM-RYTM (2026-10-04, sous le capot, audio/kit.ts) : le son
 * se recalcule en fond, l'ecran dit le reglage.
 */
export function kitDial(id: KitId, v: number): void {
  resume();
  kit.set(id, v);
  lcdMessage.show(kitReadout(id), POT_UI.readoutMs, true);
  // Son bloc cerne quand la page affichee le porte (rytm/pages.ts slotOf : SRC, SOUND ou SAMPLE)
  touchPage(`r:${id}`, pattern.get().instrument);
}

/**
 * Les potards des machines passent par un seul identifiant (la couche de
 * saisie, la molette) : EncId pour la 808, v:<id> pour le MM-VOYAGER,
 * r:<id> pour les TWEAKS du MM-RYTM, p:<0-7> pour les huit potards de page
 * du MM-RYTM (2026-10-08, la refonte facon Digitakt : le potard k regle le
 * bloc k de la page affichee, pour la voix choisie, rytm/pages.ts).
 */
// m:<voix> (V.5.0, 2026-10-29) : le VOL d'une voix sur le MIXER (FUNC + MOD), rytm:voice:<voix>:level
// q:<reglage> (V.5.1, 2026-10-29) : un reglage de trig (TRIG) ou d'un LFO (MOD) de la voix choisie, rytm:voice:<voix>:<reglage>
export type DialId = EncId | `v:${VoyKnobId}` | `r:${KitId}` | `p:${number}` | `l:${LayerDial}` | `m:${Inst}` | `q:${SeqDial}`;
export const kitIdOf = (id: DialId): KitId | null => (id.startsWith('r:') ? (id.slice(2) as KitId) : null);

/* ---------------- les couches SYNTH et SAMPLE du MM-RYTM (2026-10-08, l'etape R3) ---------------- */

/*
 * Mika (2026-10-08) : "une machine pour la configuration a la main du Voice
 * pour avoir des samples et aussi une configuration digitale du BD ou SD..
 * comme la ANALOG Rytm ou on peut mettre des samples mais le kick peut etre
 * parametre comme une machine". l:<reglage> : un reglage de couche de la
 * voix choisie (sa famille, audio/kit.ts) : la MACHINE de la couche SYNTH
 * (l:mach), les niveaux (l:syn, l:lev), la couche SAMPLE (l:tune, l:fine,
 * l:start, l:len, l:rev) ; les potards de la machine restent r:<potard>.
 */
const LAYER_DIALS: readonly LayerDial[] = ['mach', ...LAYER_PARAMS];
/** Le reglage de couche d'un potard (l:<reglage>), null pour un autre. */
export const layerIdOf = (id: DialId | SlotTarget): LayerDial | null =>
  id.startsWith('l:') && (LAYER_DIALS as readonly string[]).includes(id.slice(2)) ? (id.slice(2) as LayerDial) : null;

/** Les familles dont les couches ont des cibles MIDI (rytm:layer:<famille>:<reglage>) : toutes, une par voix (2026-10-18). */
export const LAYER_TARGET_FAMS: readonly KitFamily[] = KIT_FAMILIES;
/** Ce qu'une cible de couche regle : un reglage de couche, ou l'echantillon de la couche SAMPLE. */
export type LayerTarget = LayerDial | 'sample';

/** Sa course (0 a 1 pour le MIDI) : la MACHINE en trois crans, TUNE et FINE autour du centre, SAMPLE OFF puis ses samples. */
export function layerTargetSteps(f: KitFamily, p: LayerTarget): number {
  if (p === 'sample') return samplesOf(f).length + 1;
  return layerNotches(p);
}
/** La valeur 0 a 1 d'une cible de couche (le Roto la relit). */
export function layerTargetValue(f: KitFamily, p: LayerTarget): number {
  if (p === 'sample') {
    const n = samplesOf(f).length;
    const key = kit.get().sample[f];
    const j = key ? samplesOf(f).findIndex((x) => x.key === key) + 1 : 0;
    return n > 0 ? Math.max(0, j) / n : 0;
  }
  const [lo, hi] = layerSpan(p);
  return hi > lo ? (layerValueOf(f, p) - lo) / (hi - lo) : 0;
}

/**
 * Une cible MIDI de couche tourne (revue de R3, 2026-10-08) : la couche d'une
 * famille sans choisir sa voix (le Roto-Control : le TUNE du sample du kick,
 * son LEN, le niveau de la synthese...). v : 0 a 1 ; l'ecran dit le reglage,
 * la page le montre si elle est affichee.
 */
export function kitLayerDial(f: KitFamily, p: LayerTarget, v: number): void {
  resume();
  const who = KIT_LABEL[f];
  const c = Math.max(0, Math.min(1, v));
  if (p === 'sample') {
    const list = samplesOf(f);
    if (list.length === 0) {
      lcdMessage.show(`${who}: NO SAMPLES`);
      return;
    }
    const j = Math.round(c * list.length);
    kit.setSample(f, j === 0 ? null : list[j - 1].key);
    // La couche SAMPLE muette (2026-10-21, audit RS-13 : une machine choisie dans SOUND la met a 0) : l'ecran le dit, le
    // sample choisi ne s'entend pas tant que SMP LEVEL reste a 0 (cette cible regle la couche, comme une Elektron)
    const mute = j > 0 && kit.layerOf(f).lev <= 0 ? '  SMP LEVEL 0' : '';
    lcdMessage.show(`${who} SAMPLE ${j === 0 ? 'OFF' : kit.sampleLabel(f)}${j === 0 ? '' : `  ${j} OF ${list.length}`}${mute}`, POT_UI.readoutMs, true);
  } else {
    const [lo, hi] = layerSpan(p);
    const x = lo + c * (hi - lo);
    if (p === 'mach') kit.setMachine(f, KIT_MODELS[Math.max(0, Math.min(KIT_MODELS.length - 1, Math.round(x)))]);
    else kit.setLayer(f, p, x);
    lcdMessage.show(layerReadout(p, who, f), POT_UI.readoutMs, true);
  }
  const inst = pattern.get().instrument;
  if (inst && familyOf(inst as ShotId) === f) touchPage(p === 'sample' ? 'smpl:sample' : `l:${p}`, inst);
}

/* ---------------- les potards de page du MM-RYTM (2026-10-08) ---------------- */

/** Le rang (0 a 7) d'un potard de page, -1 pour un autre potard. */
export const pageKnobOf = (id: DialId): number => (id.startsWith('p:') ? Number(id.slice(2)) : -1);

/** L'ecran affiche (2026-10-09 : la page et son onglet) pour la voix choisie. */
export function curScreen(): RytmScreenId {
  return rytmPage.screen(pattern.get().instrument);
}

/** Ce que porte le potard de page k sur l'ecran affiche, pour la voix choisie. */
export function pageSlotOf(k: number): PageSlot | null {
  return pageSlots(curScreen(), pattern.get().instrument)[k] ?? null;
}

/** La cible du potard de page k (un DialId, la velocite, le son ou le melange de VOICE), null : vide ou un dessin. */
export function pageTarget(k: number): SlotTarget | null {
  const s = pageSlotOf(k);
  return s && !s.graph ? s.target : null;
}

/* ---------------- VOICE : le son, son melange, la velocite des nouveaux pas (2026-10-09) ---------------- */

/*
 * Mika (2026-10-09) : "Je ne comprends pas TRIG ca doit etre le parametre de
 * la Voice ici.. donc on doit voir c'est quoi le sample.. je veux merge SRC
 * SMPL et TRIG !". SOUND : une seule liste, OFF, 909, 808, MM, puis les
 * samples de la famille ; ce que la voix joue, en grand (BLUEPRINT, 909,
 * BLUEPRINT + 909 quand les deux couches jouent). Le choisir garde ce qui a un
 * sens : un autre sample garde la synthese posee dessous (MIX) ; une machine
 * joue seule (le sample reste en memoire, MIX le ramene) ; OFF fait taire la
 * voix. MIX (VOICE SYNTH) : la part des deux couches, la plus forte reste a son
 * niveau (audio/kit.ts mixOf, mixLevels) ; un vieux kit aux deux LEVEL sonne
 * pareil (MIX lu de ses deux niveaux).
 */

/** Un son de la liste de SOUND : OFF, une machine, un sample (de la famille ; en P-LOCK aussi des autres), le son propre de CY. */
export interface VoiceSound {
  kind: 'off' | 'mach' | 'smp' | 'own';
  /** la machine (909, 808, mm) ou la cle du sample */
  key: string;
  /** la famille du sample (une autre que celle de la voix : un sample lock) */
  fam: KitFamily | null;
  label: string;
}

/**
 * La liste de SOUND d'une voix : OFF, 909, 808, MM, ses samples ; lock (le
 * P-LOCK) : puis les samples des autres familles, leur famille devant (SD PSY
 * 02, le sample lock). CY (sans famille) : son propre son, puis en P-LOCK les
 * samples de toutes.
 */
export function voiceSounds(inst: Inst, lock = false): readonly VoiceSound[] {
  // La liste des samples bouge (un sample de Mika ajoute ou retire de ce navigateur, audio/samples.ts) : la liste se refait
  const sig = `${inst}|${lock ? 1 : 0}|${samplesVersion()}`;
  let out = voiceSoundCache.get(sig);
  if (out) return out;
  const own = familyOf(inst as ShotId);
  const list: VoiceSound[] = [];
  if (own) {
    list.push({ kind: 'off', key: 'off', fam: own, label: 'OFF' });
    for (const m of KIT_MODELS) list.push({ kind: 'mach', key: m, fam: own, label: KIT_MODEL_LABEL[m] });
    for (const x of samplesOf(own)) list.push({ kind: 'smp', key: x.key, fam: own, label: x.label });
  } else list.push({ kind: 'own', key: '', fam: null, label: inst });
  if (lock) for (const f of LOCK_FAMS) if (f !== own) for (const x of samplesOf(f)) list.push({ kind: 'smp', key: x.key, fam: f, label: `${FAM_TAG[f]} ${x.label}` });
  out = list;
  voiceSoundCache.set(sig, out);
  return out;
}

/** Ce que joue p, en grand : BLUEPRINT, 909, BLUEPRINT + 909, OFF ; CY : son nom. */
export function voiceSoundText(inst: Inst, p: Readonly<Plays>): string {
  const own = familyOf(inst as ShotId);
  if (!own && !p.from) return inst;
  if (!p.synth && !p.smp) return 'OFF';
  const smp = p.sample ? (sampleByKey(p.sample)?.label ?? 'SAMPLE') : '';
  const tag = p.from ? `${FAM_TAG[p.from as KitFamily] ?? p.from.toUpperCase()} ` : '';
  if (p.smp && p.synth) return own ? `${tag}${smp} + ${KIT_MODEL_LABEL[p.model]}` : `${tag}${smp} + ${inst}`;
  if (p.smp) return `${tag}${smp}`;
  return own ? KIT_MODEL_LABEL[p.model] : inst;
}

/**
 * Ou en est le sample que joue p (2026-10-21, audit RS-1, Mika : "je ne veux plus que ca plante") : '' s'il est pret
 * (ou pas encore demande) ; LOADING... tant qu'il arrive (la voix garde son son d'avant) ; OFFLINE: 909 PLAYS quand il
 * n'a pas pu venir (le repli, la couche SYNTH de la voix seule, audio/shots.ts) : l'ecran et le son disent la meme chose.
 */
export function sampleStateText(p: Readonly<Plays>): string {
  if (!p.smp || !p.sample) return '';
  const st = sampleStatus(p.sample);
  if (st.state === 'loading') return 'LOADING...';
  if (st.state !== 'failed') return '';
  return `${FAIL_WORD[st.why ?? 'bad']}: ${KIT_MODEL_LABEL[p.model]} PLAYS`;
}

/** Sa ligne d'unite : SAMPLE 1 OF 6, SAMPLE + SYNTH, SYNTH, VOICE SILENT ; CY : ONE SOUND ; un sample qui arrive ou manque : LOADING..., OFFLINE: 909 PLAYS. */
export function voiceSoundUnit(inst: Inst, p: Readonly<Plays>): string {
  const own = familyOf(inst as ShotId);
  if (!own && !p.from) return 'ONE SOUND';
  if (!p.synth && !p.smp) return 'VOICE SILENT';
  const state = sampleStateText(p);
  if (state) return state;
  if (p.smp && p.synth) return 'SAMPLE + SYNTH';
  if (p.smp) {
    if (p.from) return `FROM ${FAM_TAG[p.from as KitFamily] ?? p.from.toUpperCase()}`;
    const list = own ? samplesOf(own) : [];
    const j = list.findIndex((x) => x.key === p.sample);
    return j >= 0 ? `SAMPLE ${j + 1} OF ${list.length}` : 'SAMPLE';
  }
  return 'SYNTH';
}

/** MIX de ce que joue p : 0 la synthese seule, 1 le sample seul (sans sample du tout : 0). */
export function mixValueOf(p: Readonly<Plays>): number {
  return p.sample ? mixOf(p.syn, p.lev) : 0;
}

/**
 * MIX ecrit (revue du 2026-10-09 : SYN, +43 et BOTH, trois facons pour un
 * meme reglage) : toujours le penchant, de -64 (la synthese seule) a +63 (le
 * sample seul), 0 les deux pleins, comme les autres reglages bipolaires ;
 * OFF quand la voix se tait (les deux couches a 0).
 */
export function mixText(p: Readonly<Plays>): string {
  if (!p.synth && !p.smp) return 'OFF';
  return v127Text(mixValueOf(p), true);
}
/** Sa ligne d'unite : les deux niveaux, 0 a 127 ; la voix muette le dit. */
export const mixUnit = (p: Readonly<Plays>): string =>
  !p.synth && !p.smp ? 'VOICE SILENT' : p.sample ? `SYN ${v127Text(p.syn)} SMP ${v127Text(p.lev)}` : 'NO SAMPLE: SMP ADDS ONE';
