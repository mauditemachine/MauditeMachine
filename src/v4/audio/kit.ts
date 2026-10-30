/**
 * Le kit du MM-RYTM (2026-10-04, Mika : "le kick sonne flat.. met un kick
 * de 909 s'il te plait et tweakable comme il faut dans le OPEN de la
 * machine ; sous le capot, a la place des liens, un systeme de Tweaks..
 * genre changement de samples pour les voices"). Les TWEAKS sous le capot
 * (scene/rytmTweaks.ts) reglent ce store :
 * - le son de chaque famille de voix : 909, 808 ou MM (celui d'avant), une
 *   synthese a la facon de chaque machine (audio/shotsdsp.ts), jamais un
 *   echantillon d'une autre. KICK en 909 par defaut, les autres en MM.
 *   Depuis le 2026-10-05 (Mika : "mets ces samples dans le selecteur de
 *   samples, pour BD et SD"), les echantillons de Mika poses dans
 *   audio/samples/<famille>/ suivent, un cran chacun (audio/samples.ts) ;
 * - le KICK : TUNE (sa hauteur), ATTACK (la frappe), DECAY (sa longueur),
 *   DRIVE (sa saturation), pour les trois sons ;
 * - SNAPPY : le timbre de la caisse claire (les trois sons) ;
 * - GATE (2026-10-04, Mika : "trop de gate reverb sur le snare et le clap,
 *   je veux pouvoir l'activer ou pas dans OPEN") : la reverbe a porte de
 *   la caisse claire MM et la petite piece des claps MM et 909, OFF par
 *   defaut, ON pour les retrouver. Un commutateur a deux crans.
 * Chaque coup est calcule avec le kit du moment (audio/shots.ts : sa
 * signature fait partie de la cle de l'echantillon) ; un reglage tourne
 * recalcule le son en fond. Retenu dans le navigateur.
 *
 * Les deux couches (2026-10-08, l'etape R3, Mika : "une machine pour la
 * configuration a la main du Voice pour avoir des samples et aussi une
 * configuration digitale du BD ou SD.. comme la ANALOG Rytm ou on peut
 * mettre des samples mais le kick peut etre parametre comme une machine") :
 * chaque famille a deux couches qui jouent ensemble, puis passent par la
 * meme voix (AMP, effets, le bus du kick, le kick monophonique) :
 * - SYNTH (la page SRC) : sa MACHINE (909, 808, MM : model) et ses potards
 *   (knob) : le KICK TUNE, ATTACK, SWEEP (nouveau : la profondeur de sa
 *   descente), DECAY, DRIVE ; la caisse claire TUNE, SNAPPY, TONE, DECAY
 *   (nouveaux, sauf SNAPPY), GATE ; son niveau layer.syn ;
 * - SAMPLE (la page SMPL) : son echantillon (sample, absent : OFF) et ses
 *   reglages a elle (layer : TUNE, FINE, START, LEN, REV, son niveau lev).
 * ATTACK et DRIVE du kick, SNAPPY de la caisse claire font le caractere de
 * la voix : ils reglent les deux couches (BOTH a l'ecran), comme avant R3
 * quand un echantillon jouait ; TUNE, SWEEP, DECAY, TONE ne reglent que la
 * synthese.
 * Le choix de son d'avant (SOUND : 909, 808, MM, puis les echantillons ; la
 * plaque KICK, rytm:kit:bd) reste : un raccourci vers UNE couche (un modele :
 * la synthese seule ; un echantillon : lui seul, la synthese a 0).
 * Par defaut (2026-10-08, Mika : "change les tout de suite pour BD et SD ...
 * c'est ceux la que je veux") : BD et SD jouent le premier echantillon de leur
 * famille, la synthese a 0 ; les autres familles leur synthese. OH aussi
 * depuis le 2026-10-18 (Mika : "Le OH par defaut sonne super mal !") : le
 * premier open hat de Mika (public/samples/rytm/oh), la synthese a 0 ; un kit
 * retenu dont l'OH est encore celui d'avant (MM seul, jamais regle) le prend
 * aussi (load, KIT_V 4). Un kit
 * retenu d'avant R3 se traduit au meme son (load) : un echantillon choisi
 * devient la couche SAMPLE (TUNE et DECAY du kick d'alors : son TUNE et son
 * LEN), un modele la couche SYNTH seule ; le son par defaut d'alors (BD 909,
 * SD MM, jamais choisi ni regle : ses potards a leur depart) prend le nouveau
 * defaut. Un sample emprunte a une autre famille par un verrou joue seul sur
 * son pas (revue de R3). Les potards au 127e depuis
 * R3 (au cinquantieme avant : un kit retenu garde ses valeurs exactes).
 *
 * Une famille par voix (2026-10-18, Mika : "un selecteur de sample environ
 * 20 samples dans chacun des voices qui sont en rapport avec les dossiers") :
 * bd, sd, ch, oh, cp, tom, ht, cy. Avant, CH et OH partageaient hh, TOM et
 * HT partageaient tom, CY n'avait pas de famille (un seul son), rs restait
 * d'avant les huit voix. Un kit retenu d'avant (KIT_V 2, ou d'avant R3) se
 * traduit au meme son (foldFamilies, load) : ce que hh avait (MACHINE, sample,
 * couches) va a ch et a oh, ce que tom avait a tom et a ht, rs s'en va ; un
 * sample d'un dossier parti (hh/..., tom/...) laisse la synthese jouer. Les
 * presets (state/presets.ts) et les verrous (audio/locks.ts, snd hh: -> ch:)
 * se lisent avec la meme traduction. Un sample de Mika garde dans ce
 * navigateur (audio/usersamples.ts, cle famille/u:id) se choisit comme un
 * sample du site ; retire pendant qu'une voix le joue, la couche SAMPLE
 * passe sur OFF et la synthese reprend si elle etait a 0.
 */

/*
 * V.5.9 (2026-10-30, le moteur a 16 pistes, docs/v4/dt2/dt2-master-spec.md 4.1) : ce module est la FACADE du kit sur
 * le store des 16 pistes (audio/tracks.ts). Toute son API d'aujourd'hui reste (environ 125 appels kit.* dans le code) :
 * elle lit et ecrit les pistes 1 a 8 (une famille = la piste fixe de son rang : bd T1 ... cy T8), ses potards restent
 * globaux (un potard tourne ecrit les 8 pistes, la loi d'avant), et kit.subscribe annonce les memes familles qu'avant.
 * Les lois pures (types, labels, couches, la lecture d'un kit retenu, la vue d'un son, son calcul) sont dans
 * audio/kitlaw.ts, re-exporte ici tel quel.
 */

import { sampleByKey, samplesOf } from './samples';
import { KICK_SWEEP, SD_BODY_HZ, SD_DECAY_S, SD_TONE_HZ, kickDecayS, kickHz, sdDecayFactor, sdToneFactor, sdTuneFactor, sweepDepth, type ShotId } from './shotsdsp';
import {
  GATE_LABELS,
  KIT_DEFAULT,
  KIT_FAMILIES,
  KIT_LABEL,
  KIT_MODELS,
  KIT_MODEL_LABEL,
  KNOB_DEFAULT,
  LAYER_DEFAULT,
  MODEL_DEFAULT,
  clampLayer,
  defaultKit,
  familiesOf,
  familyOf,
  hzText,
  isFamily,
  isModel,
  kickOf,
  kitSteps,
  playsOf,
  q,
  resolveSample,
  sampleLabelOf,
  sigOf,
  soundIndex,
  soundValue,
  tweakOf,
  viewWith,
  voiceSoundIndexOf,
  type Kit,
  type KitFamily,
  type KitId,
  type KitKnob,
  type KitModel,
  type KitOverride,
  type KitSound,
  type KitView,
  type Layer,
  type LayerParam,
  type Plays,
  type ShotTweak,
} from './kitlaw';
import { LEGACY_KEYS, tracks, tracksLegacy } from './tracks';

export * from './kitlaw';

const clamp01 = (v: number): number => (Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0);

/** Le cran du son d'une famille, pour l'ecran (le choix du moment). */
export const kitSoundIndex = (f: KitFamily): number => soundIndex(tracksLegacy.kit(), f);

/** Ce que joue une famille (null : une voix sans famille, sa synthese MM seule), un verrou compris : la vue d'avant, sur la piste de la famille. */
function viewOf(f: KitFamily | null, ov?: KitOverride | null): KitView {
  const st = tracksLegacy.kit();
  return viewWith({ model: f ? st.model[f] : 'mm', knob: st.knob, sample: f ? st.sample[f] : undefined, layer: f ? st.layer[f] : LAYER_DEFAULT }, f, ov);
}

const listeners = new Set<(changed: readonly KitFamily[]) => void>();
// Les familles annoncees comme avant (celles du geste de la facade, ou celles des pistes 1 a 8 dont le son change)
tracksLegacy.onChange((c) => {
  if (c.kit.length === 0) return;
  listeners.forEach((fn) => fn(c.kit));
});

export const kit = {
  get: (): Readonly<Kit> => tracksLegacy.kit(),
  /** Un TWEAK de 0 a 1 (un choix de son : son cran sur la course). */
  value(id: KitId): number {
    const state = tracksLegacy.kit();
    return isFamily(id) ? soundValue(state, id) : state.knob[id];
  },
  def(id: KitId): number {
    return isFamily(id) ? soundValue(KIT_DEFAULT, id) : KIT_DEFAULT.knob[id];
  },
  /** Le son d'une famille (le raccourci SOUND) : son echantillon s'il joue, sinon sa machine. */
  sound(f: KitFamily): KitSound {
    const state = tracksLegacy.kit();
    return state.sample[f] ?? state.model[f];
  },
  /** Les deux couches jouent-elles (la synthese au-dessus de 0 et un echantillon) ? */
  layered(f: KitFamily): boolean {
    const state = tracksLegacy.kit();
    return !!state.sample[f] && state.layer[f].syn > 0 && state.layer[f].lev > 0;
  },
  /** Choisit le son d'une famille (un modele ou la cle d'un echantillon), le raccourci vers une couche ; true s'il change. */
  setSound(f: KitFamily, snd: KitSound): boolean {
    const n = kitSteps(f);
    const i = isModel(snd) ? KIT_MODELS.indexOf(snd) : KIT_MODELS.length + samplesOf(f).findIndex((x) => x.key === snd);
    if (i < 0 || i >= n) return false;
    return kit.set(f, n > 1 ? i / (n - 1) : 0);
  },
  /**
   * Regle un TWEAK ; true s'il change. Un choix de son (SOUND, la plaque,
   * rytm:kit:<famille>) : le raccourci vers UNE couche, a son plein niveau,
   * comme avant R3 : un modele joue seul (la couche SYNTH a 127, plus
   * d'echantillon), un echantillon joue seul (lui a 127, la synthese a 0).
   * Deja ce son, seul : rien ne change.
   */
  set(id: KitId, v: number): boolean {
    const state = tracksLegacy.kit();
    if (isFamily(id)) {
      const n = kitSteps(id);
      const i = Math.max(0, Math.min(n - 1, Math.round(clamp01(v) * (n - 1))));
      const l = state.layer[id];
      const alone = i < KIT_MODELS.length ? !state.sample[id] && l.syn === 1 : l.syn === 0 && l.lev === 1;
      if (i === soundIndex(state, id) && alone) return false;
      if (i < KIT_MODELS.length) {
        const sample = { ...state.sample };
        delete sample[id];
        return tracksLegacy.writeKit({ ...state, model: { ...state.model, [id]: KIT_MODELS[i] }, sample, layer: { ...state.layer, [id]: { ...l, syn: 1 } } }, [id], false);
      } else {
        const key = samplesOf(id)[i - KIT_MODELS.length].key;
        return tracksLegacy.writeKit({ ...state, sample: { ...state.sample, [id]: key }, layer: { ...state.layer, [id]: { ...l, syn: 0, lev: 1 } } }, [id], false);
      }
    } else {
      const n = q(v, id);
      if (state.knob[id] === n) return false;
      return tracksLegacy.writeKit({ ...state, knob: { ...state.knob, [id]: n } }, familiesOf(id), true);
    }
  },
  /** La MACHINE de la couche SYNTH (909, 808, MM) ; true si elle change. La couche SAMPLE et les niveaux restent. */
  setMachine(f: KitFamily, m: KitModel): boolean {
    const state = tracksLegacy.kit();
    if (!isModel(m) || state.model[f] === m) return false;
    return tracksLegacy.writeKit({ ...state, model: { ...state.model, [f]: m } }, [f], false);
  },
  /** L'echantillon de la couche SAMPLE (null : OFF) ; true s'il change. La couche SYNTH reste. */
  setSample(f: KitFamily, key: string | null): boolean {
    const k = key ? resolveSample(f, key) : undefined;
    if (key && !k) return false;
    const state = tracksLegacy.kit();
    if ((state.sample[f] ?? null) === (k ?? null)) return false;
    const sample = { ...state.sample };
    if (k) sample[f] = k;
    else delete sample[f];
    return tracksLegacy.writeKit({ ...state, sample }, [f], false);
  },
  /**
   * Le son de VOICE et son melange (2026-10-09, la liste unique SOUND et MIX,
   * rytm/pages.ts) : la MACHINE, l'echantillon (null : OFF ; absent : le meme)
   * et les deux niveaux d'un coup, une seule annonce ; true si rien que ca a
   * change quelque chose.
   */
  setVoice(f: KitFamily, patch: { model?: KitModel; sample?: string | null; syn?: number; lev?: number }): boolean {
    const state = tracksLegacy.kit();
    let next = state;
    if (patch.model !== undefined && isModel(patch.model) && next.model[f] !== patch.model) next = { ...next, model: { ...next.model, [f]: patch.model } };
    if (patch.sample !== undefined) {
      const k = patch.sample ? resolveSample(f, patch.sample) : undefined;
      if ((next.sample[f] ?? null) !== (k ?? null) && !(patch.sample && !k)) {
        const sample = { ...next.sample };
        if (k) sample[f] = k;
        else delete sample[f];
        next = { ...next, sample };
      }
    }
    const l = next.layer[f];
    const syn = patch.syn === undefined ? l.syn : clampLayer('syn', patch.syn);
    const lev = patch.lev === undefined ? l.lev : clampLayer('lev', patch.lev);
    if (syn !== l.syn || lev !== l.lev) next = { ...next, layer: { ...next.layer, [f]: { ...l, syn, lev } } };
    if (next === state) return false;
    return tracksLegacy.writeKit(next, [f], false);
  },
  /** Les reglages de couche d'une famille. */
  layerOf(f: KitFamily): Readonly<Layer> {
    return tracksLegacy.kit().layer[f];
  },
  /** Leur depart (le kit de depart : BD, SD et OH a SYNTH 0). */
  layerDef(f: KitFamily, p: LayerParam): number {
    return KIT_DEFAULT.layer[f][p];
  },
  /** Un reglage de couche ; true s'il change. */
  setLayer(f: KitFamily, p: LayerParam, v: number): boolean {
    const n = clampLayer(p, v);
    const state = tracksLegacy.kit();
    if (state.layer[f][p] === n) return false;
    return tracksLegacy.writeKit({ ...state, layer: { ...state.layer, [f]: { ...state.layer[f], [p]: n } } }, [f], false);
  },
  /** Ce que le calcul d'un son doit savoir (sa famille ; une voix sans famille : MM et reglages neutres). */
  tweak(id: ShotId): ShotTweak {
    return tweakOf(viewOf(familyOf(id)));
  },
  /** La signature d'un son dans la cle de son echantillon : seulement ce qui le change. */
  sig(id: ShotId): string {
    const f = familyOf(id);
    return sigOf(f, viewOf(f));
  },
  /**
   * Un coup verrouille (2026-10-08, les parameter locks, audio/locks.ts) : ce
   * que le calcul du son id doit savoir avec ce que le pas change (la
   * MACHINE, des potards, l'echantillon, des reglages de couche).
   */
  tweakWith(id: ShotId, ov: KitOverride | null): ShotTweak {
    return tweakOf(viewOf(familyOf(id), ov));
  },
  /** Sa signature (la cle de l'echantillon verrouille). */
  sigWith(id: ShotId, ov: KitOverride | null): string {
    const f = familyOf(id);
    return sigOf(f, viewOf(f, ov));
  },
  /**
   * Ce que joue la voix id (revue de R3, 2026-10-08) : ses deux couches, un
   * verrou de pas compris (kitOverride du pas, audio/drums.ts ; null : le
   * kit du moment). L'en-tete de l'ecran, le pied des couches et les blocs en
   * retrait le lisent : ce qu'ils montrent pendant un LOCK ou un flash est ce
   * que le pas joue.
   */
  playsWith(id: ShotId, ov: KitOverride | null): Plays {
    return playsOf(viewOf(familyOf(id), ov));
  },
  /** Le rang du son de la famille dans la liste de SOUND de VOICE (2026-10-09, actions.ts voiceSounds). */
  voiceIndex(f: KitFamily): number {
    return voiceSoundIndexOf(playsOf(viewOf(f)), f);
  },
  /** Ce qui joue en un mot : BLUEPRINT, 909, 909+BLUEPRINT, SILENT (l'en-tete). */
  playsText(p: Readonly<Plays>): string {
    if (!p.synth && !p.smp) return 'SILENT';
    if (!p.smp) return KIT_MODEL_LABEL[p.model];
    const name = sampleLabelOf(p.sample);
    return p.synth ? `${KIT_MODEL_LABEL[p.model]}+${name}` : name;
  },
  /** Le coup d'une famille avec ce verrou joue-t-il un kick (la synthese, ou un echantillon de kick) ? Le SIDECHAIN du MM-ARP s'y cale. */
  kickWith(ov: KitOverride | null): boolean {
    return kickOf(viewOf('bd', ov));
  },
  /** Le nom d'un son d'une famille (909, 808, MM, BLUEPRINT), pour l'ecran d'un verrou. */
  soundName(_f: KitFamily, sound: KitSound): string {
    if (isModel(sound)) return KIT_MODEL_LABEL[sound];
    if (sound === 'off') return 'OFF';
    return sampleByKey(sound)?.label ?? String(sound).toUpperCase();
  },
  /** Le numero du choix de son d'une famille (2026-10-21) : il monte a chaque nouveau choix (choiceGen). */
  choice(f: KitFamily): number {
    return tracks.choice(LEGACY_KEYS[KIT_FAMILIES.indexOf(f)]);
  },
  /** Le nom de l'echantillon de la couche SAMPLE (OFF sans lui). */
  sampleLabel(f: KitFamily): string {
    return sampleLabelOf(tracksLegacy.kit().sample[f]);
  },
  /**
   * La valeur seule d'un TWEAK (sous un potard du telephone) : 909, 52 HZ,
   * 216 MS, 50 ; un choix de son, ce qui joue (909+BLUEPRINT : les deux couches).
   */
  valueText(id: KitId): string {
    // Les deux couches muettes (SYNTH a 0, SAMPLE sur OFF ou a 0) : la voix se tait, l'ecran le dit
    if (isFamily(id)) return kit.playsText(playsOf(viewOf(id)));
    return kit.knobText(id, tracksLegacy.kit().knob[id]);
  },
  /**
   * La valeur d'un potard de la machine a v (un verrou de pas, revue de R2) :
   * 52 HZ, 216 MS, ON, 50 ; ceux de la couche SYNTH lus a sa MACHINE (model :
   * celle d'un verrou).
   */
  knobText(id: KitKnob, v: number, model?: KitModel): string {
    const state = tracksLegacy.kit();
    if (id === 'gate') return GATE_LABELS[v >= 0.5 ? 1 : 0];
    if (id === 'tune') return `${Math.round(kickHz(model ?? state.model.bd, v))} HZ`;
    if (id === 'decay') return `${Math.round(kickDecayS(model ?? state.model.bd, v) * 1000)} MS`;
    if (id === 'sweep') return `${Math.log2(1 + KICK_SWEEP[model ?? state.model.bd] * sweepDepth(v)).toFixed(1)} OCT`;
    const sm = model ?? state.model.sd;
    if (id === 'sdtune') return hzText(SD_BODY_HZ[sm] * sdTuneFactor(v));
    if (id === 'sddecay') return `${Math.round(3 * SD_DECAY_S[sm] * sdDecayFactor(v) * 1000)} MS`;
    if (id === 'sdtone') return `HP ${hzText(SD_TONE_HZ[sm] * sdToneFactor(v))}`;
    return `${Math.round(v * 100)}`;
  },
  /** La valeur lisible d'un TWEAK (l'ecran du MM-RYTM). */
  readout(id: KitId): string {
    if (isFamily(id)) return `${KIT_LABEL[id]} ${kit.valueText(id)}`;
    const v = tracksLegacy.kit().knob[id];
    if (id === 'gate') return `SNARE + CLAP GATE ${GATE_LABELS[v >= 0.5 ? 1 : 0]}`;
    if (id === 'tune' || id === 'decay' || id === 'sweep') return `KICK ${KIT_LABEL[id]} ${kit.valueText(id)}`;
    if (id === 'sdtune' || id === 'sddecay' || id === 'sdtone') return `SNARE ${KIT_LABEL[id]} ${kit.valueText(id)}`;
    const label = id === 'snappy' ? 'SNARE SNAPPY' : `KICK ${KIT_LABEL[id]}`;
    return `${label} ${Math.round(v * 100)}`;
  },
  /** Le kit de depart (tests ; un CLEAR du kit) : tout revient, les echantillons de Mika sur BD, SD et OH. */
  reset(): void {
    tracksLegacy.writeKit(defaultKit(), KIT_FAMILIES, true);
  },
  /** Un kit entier (un preset) : un seul changement annonce. Une famille absente garde son depart (jamais une couche sans reglage). */
  replace(next: Kit): void {
    const state: Kit = {
      model: { ...MODEL_DEFAULT, ...next.model },
      knob: { ...KNOB_DEFAULT, ...next.knob },
      sample: { ...next.sample },
      layer: Object.fromEntries(KIT_FAMILIES.map((f) => [f, { ...LAYER_DEFAULT, ...(next.layer[f] ?? {}) }])) as Record<KitFamily, Layer>,
    };
    tracksLegacy.writeKit(state, KIT_FAMILIES, true);
  },
  subscribe(fn: (changed: readonly KitFamily[]) => void): () => void {
    listeners.add(fn);
    return () => {
      listeners.delete(fn);
    };
  },
};
