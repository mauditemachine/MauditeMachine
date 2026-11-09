// GENERE par plugin/mm-arp/tests/params-gen.mjs depuis src/v4/voyager/params.ts : NE PAS EDITER A LA MAIN.
// Regenerer : node plugin/mm-arp/tests/params-gen.mjs (le CI : --check). Inclus par dsp/Params.h (MMARP_PARAMTABLE_IDS)
// et par dsp/Params.cpp (MMARP_PARAMTABLE_DEFS).

#if defined(MMARP_PARAMTABLE_IDS)
// Les potards dans l'ordre de VOY_KNOBS (l'index d'un potard dans kKnobDefs et dans les tableaux de valeurs)
enum KnobId : int {
  kn_rate = 0,
  kn_mode = 1,
  kn_range = 2,
  kn_notes = 3,
  kn_gate = 4,
  kn_wave1 = 5,
  kn_range1 = 6,
  kn_semi1 = 7,
  kn_fine1 = 8,
  kn_wave2 = 9,
  kn_range2 = 10,
  kn_semi2 = 11,
  kn_fine2 = 12,
  kn_osc1 = 13,
  kn_osc2 = 14,
  kn_sub = 15,
  kn_subOct = 16,
  kn_subWave = 17,
  kn_fm = 18,
  kn_ratio = 19,
  kn_octave = 20,
  kn_glide = 21,
  kn_cutoff = 22,
  kn_res = 23,
  kn_envAmt = 24,
  kn_noise = 25,
  kn_fmode = 26,
  kn_fA = 27,
  kn_fD = 28,
  kn_fS = 29,
  kn_fR = 30,
  kn_aA = 31,
  kn_aD = 32,
  kn_aS = 33,
  kn_aR = 34,
  kn_lfoRate = 35,
  kn_lfoShape = 36,
  kn_lfoDest = 37,
  kn_lfoAmt = 38,
  kn_dist = 39,
  kn_chorus = 40,
  kn_delay = 41,
  kn_reverb = 42,
  kn_volume = 43,
  kn_phase = 44,
  kn_drift = 45,
  kn_width = 46,
  kn_monoLow = 47,
  kn_keyTrack = 48,
  kn_accent = 49,
  kn_accFlt = 50,
  kn_sync = 51,
  kn_duck = 52,
  kn_chord = 53,
  kn_stack = 54,
  kn_wide = 55,
  kn_glue = 56,
  kn_dlyTime = 57,
  kn_tape = 58,
  kn_load = 59,
  kn_space = 60,
  kn_fpol = 61,
  kn_COUNT = 62
};
#endif

#if defined(MMARP_PARAMTABLE_DEFS)
// Les crans nommes
const char* const kSteps_rate[] = {"1/4", "1/8", "1/16", "1/32"};
const char* const kSteps_mode[] = {"UP", "DOWN", "UP/DN", "RAND"};
const char* const kSteps_range[] = {"1 OCT", "2 OCT", "3 OCT"};
const char* const kSteps_notes[] = {"ALL", "1", "2", "3", "4", "5", "6", "7", "8"};
const char* const kSteps_wave1[] = {"SINE", "TRI", "SAW", "SQUARE", "PULSE", "FM"};
const char* const kSteps_range1[] = {"LO", "32'", "16'", "8'", "4'", "2'"};
const char* const kSteps_semi1[] = {"-7", "-6", "-5", "-4", "-3", "-2", "-1", "0", "+1", "+2", "+3", "+4", "+5", "+6", "+7"};
const char* const kSteps_wave2[] = {"SINE", "TRI", "SAW", "SQUARE", "PULSE"};
const char* const kSteps_range2[] = {"LO", "32'", "16'", "8'", "4'", "2'"};
const char* const kSteps_semi2[] = {"-7", "-6", "-5", "-4", "-3", "-2", "-1", "0", "+1", "+2", "+3", "+4", "+5", "+6", "+7"};
const char* const kSteps_subOct[] = {"-1", "-2"};
const char* const kSteps_subWave[] = {"SINE", "TRI", "SQUARE"};
const char* const kSteps_ratio[] = {"1/2", "1", "3/2", "2", "3", "7/2", "4", "5", "7"};
const char* const kSteps_octave[] = {"-2", "-1", "0", "+1", "+2"};
const char* const kSteps_fmode[] = {"MOOG", "LP12", "MS-10", "BP", "HP"};
const char* const kSteps_lfoRate[] = {"1/16", "1/8", "1/4", "1/2", "1 BAR", "2 BAR", "4 BAR"};
const char* const kSteps_lfoShape[] = {"TRI", "SAW", "RND", "SQR", "S&H"};
const char* const kSteps_lfoDest[] = {"WAVE", "CUTOFF", "FM", "PITCH", "W+CUT"};
const char* const kSteps_chorus[] = {"OFF", "I", "II"};
const char* const kSteps_sync[] = {"OFF", "ON"};
const char* const kSteps_chord[] = {"BASIC", "TRIAD", "7TH", "9TH", "11TH"};
const char* const kSteps_dlyTime[] = {"1/8", "3/16", "1/4", "3/8", "1/2"};
const char* const kSteps_fpol[] = {"POS", "NEG"};

// { id, label, section, def, legacy (kNaN : sans), nSteps, steps, morph }
const KnobDef kKnobDefs[kKnobs] = {
    {"rate", "RATE", "arp", 0.6666666666666666, kNaN, 4, kSteps_rate, false},
    {"mode", "MODE", "arp", 0.0, kNaN, 4, kSteps_mode, false},
    {"range", "RANGE", "arp", 0.5, kNaN, 3, kSteps_range, false},
    {"notes", "NOTES", "arp", 0.0, kNaN, 9, kSteps_notes, false},
    {"gate", "GATE", "arp", 0.5, kNaN, 0, nullptr, false},
    {"wave1", "WAVE 1", "osc", 0.4, kNaN, 6, kSteps_wave1, true},
    {"range1", "RANGE 1", "osc", 0.6, kNaN, 6, kSteps_range1, false},
    {"semi1", "SEMI 1", "osc", 0.5, kNaN, 15, kSteps_semi1, false},
    {"fine1", "FINE 1", "osc", 0.42, kNaN, 0, nullptr, false},
    {"wave2", "WAVE 2", "osc", 0.5, kNaN, 5, kSteps_wave2, true},
    {"range2", "RANGE 2", "osc", 0.4, kNaN, 6, kSteps_range2, false},
    {"semi2", "SEMI 2", "osc", 0.5, kNaN, 15, kSteps_semi2, false},
    {"fine2", "FINE 2", "osc", 0.58, kNaN, 0, nullptr, false},
    {"osc1", "OSC 1", "osc", 0.84, kNaN, 0, nullptr, false},
    {"osc2", "OSC 2", "osc", 0.84, kNaN, 0, nullptr, false},
    {"sub", "SUB", "osc", 0.0, kNaN, 0, nullptr, false},
    {"subOct", "SUB OCT", "osc", 0.0, kNaN, 2, kSteps_subOct, false},
    {"subWave", "SUB WAVE", "osc", 0.0, kNaN, 3, kSteps_subWave, false},
    {"fm", "FM", "osc", 0.0, kNaN, 0, nullptr, false},
    {"ratio", "RATIO", "osc", 0.125, kNaN, 9, kSteps_ratio, false},
    {"octave", "OCTAVE", "osc", 0.5, kNaN, 5, kSteps_octave, false},
    {"glide", "GLIDE", "osc", 0.0, kNaN, 0, nullptr, false},
    {"cutoff", "CUTOFF", "filter", 0.5, kNaN, 0, nullptr, false},
    {"res", "RES", "filter", 0.35, kNaN, 0, nullptr, false},
    {"envAmt", "ENV AMT", "filter", 0.5, kNaN, 0, nullptr, false},
    {"noise", "NOISE", "filter", 0.0, kNaN, 0, nullptr, false},
    {"fmode", "MODE", "filter", 0.0, kNaN, 5, kSteps_fmode, false},
    {"fA", "ATTACK", "feg", 0.0, kNaN, 0, nullptr, false},
    {"fD", "DECAY", "feg", 0.3, kNaN, 0, nullptr, false},
    {"fS", "SUSTAIN", "feg", 0.2, kNaN, 0, nullptr, false},
    {"fR", "RELEASE", "feg", 0.3, kNaN, 0, nullptr, false},
    {"aA", "ATTACK", "aeg", 0.0, kNaN, 0, nullptr, false},
    {"aD", "DECAY", "aeg", 0.35, kNaN, 0, nullptr, false},
    {"aS", "SUSTAIN", "aeg", 0.6, kNaN, 0, nullptr, false},
    {"aR", "RELEASE", "aeg", 0.3, kNaN, 0, nullptr, false},
    {"lfoRate", "SPEED", "mod", 0.6666666666666666, kNaN, 7, kSteps_lfoRate, false},
    {"lfoShape", "SHAPE", "mod", 0.0, kNaN, 5, kSteps_lfoShape, false},
    {"lfoDest", "TARGET", "mod", 0.0, kNaN, 5, kSteps_lfoDest, false},
    {"lfoAmt", "DEPTH", "mod", 0.0, kNaN, 0, nullptr, false},
    {"dist", "OVERDRIVE", "fx", 0.0, kNaN, 0, nullptr, false},
    {"chorus", "CHORUS", "fx", 0.5, kNaN, 3, kSteps_chorus, false},
    {"delay", "DELAY", "fx", 0.25, kNaN, 0, nullptr, false},
    {"reverb", "REVERB", "fx", 0.25, kNaN, 0, nullptr, false},
    {"volume", "VOLUME", "out", 0.75, kNaN, 0, nullptr, false},
    {"phase", "PHASE", "tweak", 0.0, kNaN, 0, nullptr, false},
    {"drift", "DRIFT", "tweak", 0.5, kNaN, 0, nullptr, false},
    {"width", "WIDTH", "tweak", 0.5, kNaN, 0, nullptr, false},
    {"monoLow", "BASS MONO", "tweak", 0.0, kNaN, 0, nullptr, false},
    {"keyTrack", "KEY TRACK", "tweak", 0.5, kNaN, 0, nullptr, false},
    {"accent", "ACCENT", "tweak", 0.5, kNaN, 0, nullptr, false},
    {"accFlt", "ACC FILTER", "tweak", 0.5, 0.0, 0, nullptr, false},
    {"sync", "SYNC", "tweak", 0.0, kNaN, 2, kSteps_sync, false},
    {"duck", "SIDECHAIN", "tweak", 0.0, kNaN, 0, nullptr, false},
    {"chord", "CHORD", "tweak", 0.5, kNaN, 5, kSteps_chord, false},
    {"stack", "STACK", "tweak", 0.0, 0.0, 0, nullptr, false},
    {"wide", "WIDE", "tweak", 0.0, 0.0, 0, nullptr, false},
    {"glue", "GLUE", "tweak", 0.35, 0.0, 0, nullptr, false},
    {"dlyTime", "DLY TIME", "tweak", 0.25, 0.25, 5, kSteps_dlyTime, false},
    {"tape", "TAPE", "tweak", 0.3, 0.0, 0, nullptr, false},
    {"load", "LOAD", "tweak", 0.0, 0.0, 0, nullptr, false},
    {"space", "SPACE", "tweak", 0.0, 0.0, 0, nullptr, false},
    {"fpol", "POLARITY", "tweak", 0.0, 0.0, 2, kSteps_fpol, false},
};

// Les valeurs des crans (params.ts), indexees par stepIndex du potard indique
const double kOscRangeSemi[6] = {-36.0, -24.0, -12.0, 0.0, 12.0, 24.0}; // range1
const double kRatioX[9] = {0.5, 1.0, 1.5, 2.0, 3.0, 3.5, 4.0, 5.0, 7.0}; // ratio
const double kSubShape[3] = {0.0, 1.0, 3.0}; // subWave
const double kLfoShapeCode[5] = {0.0, 1.0, 4.0, 2.0, 3.0}; // lfoShape
const double kDlySixteenths[5] = {2.0, 3.0, 4.0, 6.0, 8.0}; // dlyTime
const double kFmodeCode[5] = {0.0, 1.0, 4.0, 2.0, 3.0}; // fmode
const double kLfoBeats[7] = {0.25, 0.5, 1.0, 2.0, 4.0, 8.0, 16.0}; // lfoRate
const double kStepsPerNote[4] = {4.0, 2.0, 1.0, 0.5}; // rate

// Les seuils (params.ts)
constexpr double kPhaseFree = 0.04;
constexpr double kDuckOff = 0.02;
constexpr double kStackMin = 0.02;
constexpr double kFxOff = 0.02;
#endif
