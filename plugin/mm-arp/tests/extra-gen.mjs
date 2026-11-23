// Genere, depuis plugin/mm-arp/extra-params.json (les reglages du VST3 seul) et dsp/ParamTable.inc (les potards du site,
// lui-meme genere depuis params.ts par params-gen.mjs) :
//   - plugin/mm-arp/src/ExtraTable.inc     les reglages du VST3 seul (C++)
//   - plugin/mm-arp/src/ModTable.inc       v50 : la table de la matrice de modulation (sources, cibles), C++
//   - src/v4/plugin/arp/modTable.ts        v50 : la meme table pour la face (une seule source : ce script)
//   node plugin/mm-arp/tests/extra-gen.mjs            ecrit les trois fichiers
//   node plugin/mm-arp/tests/extra-gen.mjs --check    code 1 si l'un d'eux n'est pas a jour (CI)
//
// Un reglage a crans porte "steps" (les noms des crans) ; v50 : "nsteps" (un nombre de crans sans noms : xMx{n}Dst,
// 1024 crans, valeur = cran / (nsteps - 1), le texte vient de la table de modulation).
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
const here = dirname(fileURLToPath(import.meta.url));
const { params } = JSON.parse(readFileSync(join(here, '../extra-params.json'), 'utf8'));
const outExtra = join(here, '../src/ExtraTable.inc');
const outModC = join(here, '../src/ModTable.inc');
const outModTs = join(here, '../../../src/v4/plugin/arp/modTable.ts');
const q = (s) => JSON.stringify(String(s));
const nStepsOf = (p) => (p.steps ? p.steps.length : p.nsteps ? p.nsteps : 0);

/* ---------------- ExtraTable.inc ---------------- */
let s = '// GENERE par tests/extra-gen.mjs depuis extra-params.json : ne pas editer.\n';
s += `enum ExtraId { ${params.map((p) => `ex_${p.id}`).join(', ')}, ex_COUNT };\n`;
for (const p of params) {
  if (p.steps && p.nsteps) throw new Error(`${p.id} : steps ou nsteps, pas les deux`);
  if (p.nsteps && !(Number.isInteger(p.nsteps) && p.nsteps > 1)) throw new Error(`${p.id} : nsteps invalide`);
  if (p.steps) s += `static const char* const kExSteps_${p.id}[] = { ${p.steps.map(q).join(', ')} };\n`;
  if (p.beats) s += `static const double kExBeats_${p.id}[] = { ${p.beats.join(', ')} };\n`;
}
s += 'static const ExtraDef kExtraDefs[ex_COUNT] = {\n';
for (const p of params) s += `  { ${q(p.id)}, ${q(p.label)}, ${q(p.section)}, ${p.def}, ${nStepsOf(p)}, ${p.steps ? `kExSteps_${p.id}` : 'nullptr'} },\n`;
s += '};\n';

/* ---------------- la table de modulation (v50) ---------------- */
// Les potards du site, dans l'ordre de l'hote (ParamTable.inc, kKnobDefs : id, label, section, def, legacy, crans, steps, morph)
const ptab = readFileSync(join(here, '../dsp/ParamTable.inc'), 'utf8');
const body = ptab.slice(ptab.indexOf('const KnobDef kKnobDefs[kKnobs] = {'));
const knobs = [];
for (const m of body.matchAll(/\{"(\w+)", "([^"]*)", "(\w+)", [^,]+, [^,]+, (\d+), [^,]+, (true|false)\},/g)) knobs.push({ id: m[1], label: m[2], section: m[3], nSteps: Number(m[4]), morph: m[5] === 'true' });
if (knobs.length < 60 || knobs[0].id !== 'rate') throw new Error('ParamTable.inc : les potards sont illisibles');

// Les sources (xMx{n}Src), ordre fige : on n'ajoute qu'a la fin. Les 12 premieres : celles de xM{n}Src.
const SOURCES = params.find((p) => p.id === 'xMx1Src').steps;
const xmSrc = params.find((p) => p.id === 'xM1Src').steps;
if (SOURCES.length !== 14 || xmSrc.some((n, i) => SOURCES[i] !== n)) throw new Error('xMx1Src : les 12 premieres sources sont celles de xM1Src');
// Deux signes (-1..1) : PITCH BEND, KEY (la hauteur autour du do central, Voyager.cpp keyOf), les LFO, S&H, RANDOM
const BIPOLAR = new Set(['PITCH BEND', 'KEY', 'LFO 1', 'LFO 2', 'LFO 3', 'LFO 4', 'S&H', 'RANDOM']);

// 1..19 : les destinations synthe de xM{n}Dst (par voix, le code de la matrice du moteur)
const xmDst = params.find((p) => p.id === 'xM1Dst').steps;
const SYNTH = [
  ['m:pitch', 'OSC'], ['m:osc2pitch', 'OSC'], ['m:wave', 'OSC'], ['m:fm', 'OSC'], ['m:oscmix', 'OSC'], ['m:noise', 'FILTER'],
  ['m:sub', 'OSC'], ['m:ring', 'OSC'], ['m:fold', 'OSC'], ['m:cutoff', 'FILTER'], ['m:res', 'FILTER'], ['m:envamt', 'FILTER'],
  ['m:drive', 'FILTER'], ['m:amp', 'ENV'], ['m:pan', 'OSC'], ['m:stack', 'OSC'], ['m:lfo1depth', 'LFO'], ['m:lfo2depth', 'LFO'],
  ['m:comb', 'FILTER'],
];
if (xmDst.length !== 20 || xmDst[0] !== 'OFF') throw new Error('xM1Dst : 20 crans attendus');

// 32 + k : les reglages hote continus (k : l'indice mmx, potards puis reglages du VST3 seul). Pas les crans ni les leviers,
// pas la matrice (xM*, xMx*). Exclus aussi, faute d'effet modulable :
//   tape (OLD TAPE), duck (SIDECHAIN : sans effet dans le plugin), xDist / xDistTone (OLD PEDAL, masquee, sans effet),
//   section old (OLD EQ), xRevSize / xRevTone / xRevPre (la reponse de la reverbe CLASSIC se calcule hors du thread audio,
//   6 a 40 ms par calcul : impossible a moduler en temps reel).
const KNOB_EXCLUDE = new Set(['tape', 'duck']);
const EXTRA_EXCLUDE = new Set(['xRevSize', 'xRevTone', 'xRevPre', 'xDist', 'xDistTone']);
// Le nom et le groupe de chaque potard cible (des noms uniques dans toute la table : le texte de l'hote doit dire la cible)
const KNOB_DEST = {
  gate: ['ARP GATE', 'ARP'], accent: ['ARP ACCENT', 'ARP'],
  wave1: ['OSC 1 WAVE', 'OSC'], fine1: ['OSC 1 FINE', 'OSC'], wave2: ['OSC 2 WAVE', 'OSC'], fine2: ['OSC 2 FINE', 'OSC'],
  osc1: ['OSC 1 LEVEL', 'OSC'], osc2: ['OSC 2 LEVEL', 'OSC'], sub: ['SUB LEVEL', 'OSC'], fm: ['FM AMOUNT', 'OSC'], glide: ['GLIDE', 'OSC'],
  phase: ['OSC PHASE', 'OSC'], drift: ['DRIFT', 'OSC'], stack: ['STACK SPREAD', 'OSC'], wide: ['WIDE', 'OSC'], width: ['VOICE WIDTH', 'OSC'],
  cutoff: ['FILTER CUTOFF', 'FILTER'], res: ['FILTER RES', 'FILTER'], envAmt: ['FILTER ENV AMT', 'FILTER'], noise: ['NOISE LEVEL', 'FILTER'],
  keyTrack: ['KEY TRACK', 'FILTER'], accFlt: ['ACC FILTER', 'FILTER'], load: ['LOAD', 'FILTER'],
  fA: ['F ENV ATTACK', 'ENV'], fD: ['F ENV DECAY', 'ENV'], fS: ['F ENV SUSTAIN', 'ENV'], fR: ['F ENV RELEASE', 'ENV'],
  aA: ['A ENV ATTACK', 'ENV'], aD: ['A ENV DECAY', 'ENV'], aS: ['A ENV SUSTAIN', 'ENV'], aR: ['A ENV RELEASE', 'ENV'],
  lfoAmt: ['LFO 1 AMOUNT', 'LFO'],
  dist: ['DISTO DRIVE', 'DISTO'], delay: ['DELAY MIX', 'DELAY'], reverb: ['REVERB MIX', 'REVERB'],
  volume: ['MASTER VOLUME', 'MASTER'], monoLow: ['BASS MONO', 'MASTER'], glue: ['GLUE', 'MASTER'], space: ['SPACE', 'MASTER'],
};
// Les reglages du VST3 seul : le groupe par section, le nom de l'hote (section devant) sauf ceux-ci
const SECTION_GROUP = {
  lfo1: 'LFO', lfo2: 'LFO', lfo: 'LFO', master: 'MASTER', seq: 'ARP', osc: 'OSC', filter: 'FILTER', phaser: 'SOUND', flanger: 'SOUND',
  pump: 'SOUND', crush: 'SOUND', chorus: 'SOUND', eq: 'SOUND', space: 'REVERB', amp: 'FILTER', hell: 'HELL', sky: 'REVERB',
  disto: 'DISTO', delay: 'DELAY',
};
const EXTRA_DEST = {
  xLfo1Depth2: ['LFO 1 AMOUNT 2', 'LFO'], xLfo2Depth: ['LFO 2 AMOUNT', 'LFO'], xDLfoRate: ['LFO 3 RATE', 'LFO'],
  xWarmth: ['MASTER WARMTH'], xBass: ['MASTER BASS'], xAir: ['MASTER AIR'], xWidth: ['MASTER WIDTH'], xSwing: ['ARP SWING'],
  xRing: ['OSC RING MOD'], xFold: ['OSC FOLD'], xNoiseColor: ['NOISE COLOR', 'FILTER'], xHpf: ['FILTER HIGH PASS'], xComb: ['FILTER COMB'],
  xCombFb: ['FILTER COMB FB'], xPhMix: ['PHASER MIX'], xPhRate: ['PHASER RATE'], xPhDepth: ['PHASER DEPTH'], xPhFb: ['PHASER FEEDBACK'],
  xFlMix: ['FLANGER MIX'], xFlRate: ['FLANGER RATE'], xFlDepth: ['FLANGER DEPTH'], xFlFb: ['FLANGER FEEDBACK'], xPumpDepth: ['PUMP DEPTH'],
  xPumpShape: ['PUMP RELEASE'], xCrushBits: ['CRUSH BITS'], xCrushRate: ['CRUSH DOWNSAMPLE'], xShimmer: ['REVERB SHIMMER'],
  xFeedback: ['VOICE FEEDBACK'], xHellMix: ['HELL MIX'],
};
const DESTS = [];
SYNTH.forEach(([id, group], i) => DESTS.push({ code: i + 1, k: -1, id, label: xmDst[i + 1], group }));
const all = [...knobs.map((k) => ({ ...k, knob: true })), ...params.map((p) => ({ ...p, knob: false }))];
all.forEach((p, k) => {
  if (p.knob) {
    if (p.nSteps > 0 && !p.morph) return;
    if (KNOB_EXCLUDE.has(p.id)) return;
    const d = KNOB_DEST[p.id];
    if (!d) throw new Error(`potard ${p.id} : continu, sans nom de cible (KNOB_DEST) ni exclusion (KNOB_EXCLUDE)`);
    DESTS.push({ code: 32 + k, k, id: p.id, label: d[0], group: d[1] });
    return;
  }
  if (p.steps || p.nsteps || /^xMx?\d/.test(p.id) || p.section === 'old' || EXTRA_EXCLUDE.has(p.id)) return;
  const o = EXTRA_DEST[p.id];
  const group = (o && o[1]) || SECTION_GROUP[p.section];
  if (!group) throw new Error(`${p.id} : section ${p.section} sans groupe (SECTION_GROUP)`);
  const sec = p.section.toUpperCase();
  const label = (o && o[0]) || (p.label.startsWith(`${sec} `) || p.label === sec || p.label.startsWith(`${group} `) ? p.label : `${sec} ${p.label}`);
  DESTS.push({ code: 32 + k, k, id: p.id, label, group });
});
const DST_N = params.find((p) => p.id === 'xMx1Dst').nsteps;
const GROUPS = ['OSC', 'FILTER', 'ENV', 'ARP', 'LFO', 'SOUND', 'DISTO', 'DELAY', 'HELL', 'REVERB', 'MASTER'];
{
  const seenL = new Set(), seenId = new Set();
  for (const d of DESTS) {
    if (d.code >= DST_N) throw new Error(`${d.id} : code ${d.code} hors des ${DST_N} crans`);
    if (seenL.has(d.label)) throw new Error(`nom de cible en double : ${d.label}`);
    if (seenId.has(d.id)) throw new Error(`id de cible en double : ${d.id}`);
    if (!GROUPS.includes(d.group)) throw new Error(`${d.id} : groupe ${d.group} inconnu`);
    seenL.add(d.label);
    seenId.add(d.id);
  }
}
const index = new Array(DST_N).fill(-1);
DESTS.forEach((d, i) => (index[d.code] = i));

let c = '// GENERE par tests/extra-gen.mjs depuis extra-params.json et dsp/ParamTable.inc : ne pas editer.\n';
c += '// v50 : la matrice de modulation (xMx{n}Src / Dst / Amt). Inclus par src/ExtraParams.h (namespace mmx).\n';
c += `constexpr int kModSources = ${SOURCES.length};\n`;
c += `static const char* const kModSourceNames[kModSources] = { ${SOURCES.map(q).join(', ')} };\n`;
c += `static const bool kModBipolar[kModSources] = { ${SOURCES.map((n) => (BIPOLAR.has(n) ? 'true' : 'false')).join(', ')} };\n`;
c += `constexpr int kModDstN = ${DST_N};\n`;
c += 'constexpr int kModSlots = 8;\n';
c += 'constexpr int kModSynthN = 20; // 1..19 : les destinations synthe (xM{n}Dst)\n';
c += 'constexpr int kModDstBase = 32; // 32 + k : le reglage hote d\'indice k (allIndex)\n';
c += `constexpr int kModDestCount = ${DESTS.length};\n`;
c += '// code, k (indice du reglage hote, -1 pour 1..19), id, nom, groupe\n';
c += 'static const ModDestDef kModDests[kModDestCount] = {\n';
for (const d of DESTS) c += `  { ${d.code}, ${d.k}, ${q(d.id)}, ${q(d.label)}, ${q(d.group)} },\n`;
c += '};\n';
c += '// le code (0..kModDstN - 1) -> l\'indice dans kModDests, -1 : sans cible ("---", 0 : OFF)\n';
c += 'static const short kModDstIndex[kModDstN] = {\n';
for (let i = 0; i < DST_N; i += 32) c += `  ${index.slice(i, i + 32).join(', ')},\n`;
c += '};\n';

const tq = (x) => `'${String(x).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
let t = '// GENERE par plugin/mm-arp/tests/extra-gen.mjs depuis plugin/mm-arp/extra-params.json et plugin/mm-arp/dsp/ParamTable.inc :\n';
t += '// ne pas editer (node plugin/mm-arp/tests/extra-gen.mjs). La meme table cote C++ : plugin/mm-arp/src/ModTable.inc.\n';
t += '//\n';
t += '// v50, la matrice de modulation : 8 emplacements xMx{n}Src / xMx{n}Dst / xMx{n}Amt (n = 1..8).\n';
t += '// - Src : un cran de MOD_SOURCES (index = cran) ; MOD_BIPOLAR : la source va de -1 a 1 (sinon de 0 a 1).\n';
t += '// - Dst : un reglage a MOD_DST_N crans, valeur normalisee = code / (MOD_DST_N - 1). 0 : OFF ; 1..19 : les destinations\n';
t += '//   synthe de xM{n}Dst (par voix, ids m:*) ; 32 + k : le reglage hote d\'indice k (potards du site puis reglages du VST3\n';
t += '//   seul, l\'ordre de l\'hote) ; un code absent de MOD_DESTS : "---", sans effet.\n';
t += '// - Amt : -100 a +100 % (0.5 : rien). Cible 32 + k : valeur effective = clamp(valeur + somme(source x (2 Amt - 1)), 0, 1).\n\n';
t += `export const MOD_SOURCES: readonly string[] = [${SOURCES.map(tq).join(', ')}];\n`;
t += `export const MOD_BIPOLAR: readonly boolean[] = [${SOURCES.map((n) => String(BIPOLAR.has(n))).join(', ')}];\n`;
t += `export const MOD_DST_N = ${DST_N};\n`;
t += 'export interface ModDest {\n  code: number;\n  id: string;\n  label: string;\n  group: string;\n}\n';
t += '/** Toutes les cibles valides (code 0 exclu), par code croissant. */\n';
t += 'export const MOD_DESTS: readonly ModDest[] = [\n';
for (const d of DESTS) t += `  { code: ${d.code}, id: ${tq(d.id)}, label: ${tq(d.label)}, group: ${tq(d.group)} },\n`;
t += '];\n';
t += `export const MOD_GROUPS: readonly string[] = [${GROUPS.map(tq).join(', ')}];\n`;
t += 'const BY_CODE = new Map<number, ModDest>(MOD_DESTS.map((d): [number, ModDest] => [d.code, d]));\n';
t += 'const CODE_OF = new Map<string, number>(MOD_DESTS.filter((d) => d.code >= 32).map((d): [string, number] => [d.id, d.code]));\n';
t += 'export function modDestByCode(code: number): ModDest | undefined {\n  return BY_CODE.get(code);\n}\n';
t += '/** L\'id d\'un potard (cutoff, xDDrive...) -> son code 32 + k ; undefined s\'il n\'est pas une cible. */\n';
t += 'export function modDestCodeOf(id: string): number | undefined {\n  return CODE_OF.get(id);\n}\n';
t += 'export const MOD_SLOTS = 8;\n';

const files = [
  [outExtra, s, 'src/ExtraTable.inc'],
  [outModC, c, 'src/ModTable.inc'],
  [outModTs, t, 'src/v4/plugin/arp/modTable.ts'],
];
if (process.argv.includes('--check')) {
  let bad = false;
  for (const [f, txt, name] of files)
    if (!existsSync(f) || readFileSync(f, 'utf8') !== txt) {
      console.error(`extra-gen : ${name} n'est pas a jour`);
      bad = true;
    }
  if (bad) process.exit(1);
  console.log(`extra-gen : a jour (${params.length} reglages, ${DESTS.length} cibles de modulation)`);
} else {
  for (const [f, txt] of files) writeFileSync(f, txt);
  console.log(`extra-gen : ${params.length} reglages, ${DESTS.length} cibles de modulation ecrits`);
}
