// MM-ARP : les potards du site en C++17, sans JUCE (2026-11-09). Port exact des fonctions de src/v4/voyager/params.ts
// (engineParams, les lois des potards, voyValueText, voyReadout, clean), de audio/synth.ts (volGain, engineState, les
// reglages de la chaine), de voyager/chords.ts (degreeMidi, arpDegrees, voicedDegrees) et de voyager/seq.ts (poolSteps,
// seq.steps), et de plugin/arp/bridge.ts compile() pour l'arpege. Le plugin en tire lui-meme le moteur, la chaine et
// l'arpege a partir des valeurs brutes des potards (0..1, celles de l'hote : automation, MIDI, fenetre fermee).
//
// La table des potards (dsp/ParamTable.inc) est GENEREE depuis params.ts par tests/params-gen.mjs (le CI : --check).
// Verifie contre le vrai JS par tests/params-ref.mjs + tests/params_test.cpp : moteur au bit pres (pow : le fdlibm de
// V8, celui de dsp/Voyager.cpp, lie depuis mmarp_dsp), notes midi et textes identiques.
//
// Temps reel : engineParams, fxSettings et arpProgram n'allouent rien (arpProgram : si out a ete prepare par
// reserveArp) et ne prennent aucun verrou. knobText, knobReadout utilisent snprintf (hors thread audio de preference).
// Valeurs : NaN est lu comme 0 ; hors de 0..1, les formules continues suivent le JS, les crans sont bornes.
// Pour retrouver exactement le son d'un reglage du site, passer par knobClean (le site arrondit chaque potard au
// millieme et chaque potard a crans sur son cran : voyParams.set) ; les valeurs float de l'hote (0.667f) donnent sinon
// des ecarts infimes sur les potards continus.
#pragma once

#include "Arp.h"
#include "ArpFx.h"
#include "Voyager.h"

namespace mmarp {

#define MMARP_PARAMTABLE_IDS
#include "ParamTable.inc"
#undef MMARP_PARAMTABLE_IDS

/** Le nombre de potards (VOY_KNOBS de params.ts, TWEAKS compris). */
constexpr int kKnobs = kn_COUNT;

struct KnobDef {
  const char* id;            // l'id du site ('cutoff', 'fA'...) : aussi l'id du parametre de l'hote
  const char* label;         // le nom a l'ecran (RATE, WAVE 1, ATTACK...)
  const char* section;       // arp, osc, filter, feg, aeg, mod, fx, out, tweak
  double def;                // la valeur de depart (0..1)
  double legacy;             // la valeur d'un son garde d'avant ce potard ; NaN : sans (def)
  int nSteps;                // 0 : continu
  const char* const* steps;  // les noms des crans (nSteps), nullptr si continu
  bool morph;                // WAVE 1 et 2 : continus, leurs crans ne sont que des reperes
};
extern const KnobDef kKnobDefs[kKnobs];

/** L'index d'un potard par son id, -1 si inconnu. */
int knobIndex(const char* id);

/** params.ts stepIndex : le cran d'un potard (0 s'il est continu). */
int knobStep(int i, double v);

/** params.ts clean (voyParams.set) : bornee a 0..1 (NaN : def), sur son cran (sauf morph), sinon au millieme. */
double knobClean(int i, double v);

/** Le texte du site sans le nom (voyValueText : "1/16", "753 HZ", "-12 CT", "SAW>SQUARE 40%", "64 %"). */
void knobText(int i, double v, char* out, int max);
/** Le texte de l'ecran du site avec le nom (voyReadout : "RATE 1/16", "CUTOFF 64%", "F ATTACK 0%", "FINE 1 -8 CT"). */
void knobReadout(int i, double v, char* out, int max);

/** La suite (voyager/seq.ts SeqState) : EDIT, ses 16 degres (SEQ_MIN -7 a SEQ_TOP 24, ou kSeqRest), sa longueur. */
constexpr int kSeqRest = -10000;
struct SeqStateC {
  bool edit = false;
  int len = 8;  // 1..16 (borne)
  int buf[16] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
};

/**
 * audio/synth.ts engineState(v) sans bpm : engineParams(v) de params.ts + outLevel (volGain). Remplit out (ids de
 * Voyager::paramIndex) dans l'ordre des cles du JS, rend le nombre ecrit (kEngineParams si max le permet, sinon max).
 */
constexpr int kEngineParams = 45;
int engineParams(const double* knobs, ParamKV* out, int max);

/** La chaine (audio/synth.ts applyFx) : chorus, delay, reverb, tape, monoLowHz, volume ; delaySeconds non rempli. */
void fxSettings(const double* knobs, ArpFxSettings& out, double& dly16);

/** Les capacites que reserveArp prepare : 8 accords (MAX_CHORDS de voyager/arp.ts) de 64 notes, 8 mesures. */
constexpr int kArpChords = 8;
constexpr int kArpNotes = 64;
/** Prepare out pour que arpProgram n'alloue jamais : prog.reserve(8), 8 accords (c = -1) de midi.reserve(64). */
void reserveArp(ArpProgram& out);

/**
 * L'arpege (bridge.ts compile, partie arp) : spn (stepsPerNote(RATE)), gate (gateFrac(GATE)), accent, drift, la
 * progression (prog, 8 accords au plus, indices hors 0..7 ignores, comme parseProgram) et chaque accord distinct
 * resolu en midi, OCTAVE comprise : la suite EDIT (silences : kRest) ou AUTO (seq.steps : MODE, RANGE, NOTES, CHORD),
 * en RAND AUTO le reservoir (poolSteps(c, p, 0), rand = true). Les notes sont bornees a 0..127 comme le faisait
 * parseProgram (le site peut monter a 129 : degre 24 sur E, OCTAVE +2). swing n'est pas touche.
 * Sans allocation apres reserveArp(out) : out.chords garde ses kArpChords entrees, les accords distincts d'abord (dans
 * l'ordre de prog), les autres a c = -1 et vides (ArpProgram::chord ne les trouve jamais). Sans reserveArp, out.chords
 * grandit au besoin (allocation) et n'est jamais raccourci.
 */
void arpProgram(const double* knobs, const SeqStateC& seq, const int* prog, int nProg, ArpProgram& out);

/* ---- les fonctions du site, pour les tests et l'interface ---- */

/** chords.ts degreeMidi : la note midi du degre d au-dessus de la racine de l'accord i (0..7). */
int degreeMidi(int chord, int d);
/** seq.ts poolSteps(chord, p, mode) : les degres de la suite AUTO ; rend le nombre (au plus max, 32 suffisent). */
int poolSteps(const double* knobs, int chord, int mode, int* out, int max);

}  // namespace mmarp
