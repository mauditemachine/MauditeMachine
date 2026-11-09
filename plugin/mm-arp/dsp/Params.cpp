// MM-ARP : port C++17 des potards du site (voir Params.h). Meme ordre d'operations que le JS, en double : les
// resultats sont ceux de params.ts au bit pres (verifie : tests/params-ref.mjs + tests/params_test.cpp).
#include "Params.h"

#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <limits>

// Pas de contraction en FMA (le JS n'en fait pas), comme dsp/Voyager.cpp ; garder -ffp-contract=off dans le CMake
#if defined(__clang__)
#pragma clang fp contract(off)
#elif defined(__GNUC__)
#pragma GCC optimize("fp-contract=off")
#endif
#if defined(_MSC_VER)
#pragma fp_contract(off)
#endif

namespace mmarp {

// Math.pow de V8 : le fdlibm de dsp/Voyager.fdlibm.inc, defini une fois dans dsp/Voyager.cpp (meme bibliotheque
// mmarp_dsp). La libm du systeme differe d'un ulp sur une part des valeurs.
namespace fdlibm {
double pow(double x, double y);
}

namespace {
constexpr double kNaN = std::numeric_limits<double>::quiet_NaN();
}  // namespace

#define MMARP_PARAMTABLE_DEFS
#include "ParamTable.inc"
#undef MMARP_PARAMTABLE_DEFS

namespace {

/* ---------------- le JS ---------------- */

// Math.round : le plus proche, les moities vers +infini (floor(x + 0.5) se trompe sur 0.49999999999999994)
double jsRound(double x) {
  if (!std::isfinite(x)) return x;
  double r = std::floor(x);
  if (x - r >= 0.5) r += 1;
  return r;
}

// Un nombre de Math.round ecrit par JS (String : "-0" s'ecrit "0")
long long jsInt(double x) { return std::isfinite(x) ? static_cast<long long>(x) : 0; }

// Une valeur de potard : NaN lu comme 0
double val(const double* k, int i) {
  const double v = k[i];
  return v == v ? v : 0.0;
}

/* ---------------- params.ts ---------------- */

int stepIdx(int i, double v) {
  const int n = kKnobDefs[i].nSteps;
  if (n <= 0) return 0;
  if (v != v) v = 0;
  const double r = jsRound(v * (n - 1));
  if (r < 0) return 0;
  if (r > n - 1) return n - 1;
  return static_cast<int>(r);
}
int step(const double* k, int i) { return stepIdx(i, val(k, i)); }

double morphPos(int i, double v) { return v * ((kKnobDefs[i].nSteps > 0 ? kKnobDefs[i].nSteps : 1) - 1); }
double phaseStart(double v) { return v < kPhaseFree ? -1 : (v - kPhaseFree) / (1 - kPhaseFree); }
double duckDepthDb(double v) { return v < kDuckOff ? 0 : 24 * v; }
double stackCents(double v) { return v < kStackMin ? 0 : 3 + (27 * (v - kStackMin)) / (1 - kStackMin); }
double fxAmount(double v) { return v < kFxOff ? 0 : v; }
double monoLowHz(double v) { return v < 0.04 ? 0 : 40 * fdlibm::pow(7.5, (v - 0.04) / 0.96); }
double attackS(double v) { return 0.001 * fdlibm::pow(2000, v); }
double decayS(double v) { return 0.005 * fdlibm::pow(400, v); }
double releaseS(double v) { return 0.005 * fdlibm::pow(600, v); }
double cutoffHz(double v) { return 30 * fdlibm::pow(2, v * 9.3); }
double envOctaves(double v) { return v * 6; }
double glideS(double v) { return v <= 0 ? 0 : 0.015 + v * v * 0.6; }
double fineCents(double v) { return (v - 0.5) * 100; }
double gateFrac(double v) { return 0.08 + 0.92 * v; }
// oscSemis(range, semi) : OSC_RANGE_SEMI[stepIndex('range1', range)] + stepIndex('semi1', semi) - 7
double oscSemis(double range, double semi) { return kOscRangeSemi[stepIdx(kn_range1, range)] + stepIdx(kn_semi1, semi) - 7; }

/* ---------------- chords.ts ---------------- */

constexpr int FS3 = 54;
constexpr int SCALE[7] = {0, 2, 3, 5, 7, 8, 10};
struct ChordC {
  int root;
  int nTones;
  int tones[4];
};
// CHORDS : F#m, D, E, C#m, Bm, A, F#m7, Dmaj7
constexpr ChordC CHORDS[8] = {
    {0, 3, {0, 3, 7, 0}}, {8, 3, {0, 4, 7, 0}}, {10, 3, {0, 4, 7, 0}}, {7, 3, {0, 3, 7, 0}},
    {5, 3, {0, 3, 7, 0}}, {3, 3, {0, 4, 7, 0}}, {0, 4, {0, 3, 7, 10}}, {8, 4, {0, 4, 7, 11}},
};
constexpr int kChordCount = 8;
constexpr int SEQ_TOP = 24;

int mod7(int k) { return ((k % 7) + 7) % 7; }
// floor(k / 7) en entiers
int floorDiv7(int k) { return k >= 0 ? k / 7 : -((-k + 6) / 7); }

int rootDegree(int i) {
  const int r = i >= 0 && i < kChordCount ? CHORDS[i].root : 0;
  for (int j = 0; j < 7; ++j)
    if (SCALE[j] == r) return j;
  return 0;
}

int interval(int i, int c) {
  const int r = rootDegree(i);
  return (SCALE[mod7(r + c)] - SCALE[r] + 12) % 12;
}

int inWindow(int i, int c, int o) {
  const int r = rootDegree(i);
  return mod7(r + c) - r + 7 * o;
}

// chordClasses : base (au plus 4) et ext (au plus 2)
void chordClasses(int i, int type, int* base, int& nb, int* ext, int& ne) {
  const int n = i >= 0 && i < kChordCount ? CHORDS[i].nTones : 3;
  nb = 0;
  ne = 0;
  if (type <= 0) {
    for (int j = 0; j < n; ++j) base[nb++] = 2 * j;
    return;
  }
  if (type == 1 && n < 4) {
    base[0] = 0, base[1] = 2, base[2] = 4;
    nb = 3;
  } else {
    base[0] = 0, base[1] = 2, base[2] = 4, base[3] = 6;
    nb = 4;
  }
  if (type >= 3) {
    bool major = false;
    if (i >= 0 && i < kChordCount)
      for (int j = 0; j < CHORDS[i].nTones; ++j)
        if (CHORDS[i].tones[j] == 4) major = true;
    const bool nine = interval(i, 1) != 1;
    const int eleven = major && interval(i, 3) == 5 ? (interval(i, 5) != 8 ? 5 : -1) : 3;
    if (nine) ext[ne++] = 1;
    if (type >= 4 || !nine) {
      if (eleven >= 0) ext[ne++] = eleven;
    }
  }
}

// voicedDegrees : au plus 3 x 4 + 2 notes (RANGE : 1 a 3 octaves)
constexpr int kMaxSeq = 32;
int voicedDegrees(int i, int oct, int type, int* out) {
  int base[4], ext[2], nb = 0, ne = 0;
  chordClasses(i, type, base, nb, ext, ne);
  int n = 0;
  if (type <= 0) {
    for (int o = 0; o < oct; ++o)
      for (int j = 0; j < nb; ++j) out[n++] = 7 * o + base[j];
    return n;
  }
  int low[4];
  for (int j = 0; j < nb; ++j) low[j] = inWindow(i, base[j], 0);
  // tri montant (insertion : 4 valeurs au plus)
  for (int a = 1; a < nb; ++a)
    for (int b = a; b > 0 && low[b - 1] > low[b]; --b) {
      const int t = low[b];
      low[b] = low[b - 1];
      low[b - 1] = t;
    }
  for (int o = 0; o < oct; ++o)
    for (int j = 0; j < nb; ++j) out[n++] = low[j] + 7 * o;
  int top = n > 0 ? out[n - 1] : 0;
  for (int j = 0; j < ne; ++j) {
    int d = inWindow(i, ext[j], 0);
    while (d <= top) d += 7;
    out[n++] = d;
    top = d;
  }
  return n;
}

// arpDegrees : au plus 2 x 14 - 2 notes (UP/DN)
int arpDegrees(int i, int oct, int mode, int type, int* out) {
  if (i < 0 || i >= kChordCount) return 0;
  int up[kMaxSeq];
  const int n = voicedDegrees(i, oct, type, up);
  int m = 0;
  if (mode == 1) {
    for (int j = n - 1; j >= 0; --j) out[m++] = up[j];
    return m;
  }
  for (int j = 0; j < n; ++j) out[m++] = up[j];
  if (mode == 2 && n > 2)
    for (int j = n - 2; j >= 1; --j) out[m++] = up[j];
  return m;
}

int clampMidi(int m) { return m < 0 ? 0 : m > 127 ? 127 : m; }

/* ---------------- les textes ---------------- */

struct Out {
  char* p;
  int max;
  int n = 0;
  Out(char* o, int m) : p(o), max(m) {
    if (p && max > 0) p[0] = 0;
  }
  void put(const char* s) {
    if (!p || max <= 0) return;
    while (*s && n < max - 1) p[n++] = *s++;
    p[n] = 0;
  }
  void putInt(long long v) {
    char b[32];
    std::snprintf(b, sizeof(b), "%lld", v);
    put(b);
  }
  // String(x) de JS pour un nombre court (0.02 a 1 : SPACE) : le plus court qui relit le meme double
  void putNum(double x) {
    char b[40];
    if (x == std::floor(x) && std::fabs(x) < 1e15) {
      putInt(jsInt(x));
      return;
    }
    for (int prec = 1; prec <= 17; ++prec) {
      std::snprintf(b, sizeof(b), "%.*g", prec, x);
      if (std::strtod(b, nullptr) == x) break;
    }
    put(b);
  }
};

void morphText(int i, double v, Out& o) {
  const KnobDef& k = kKnobDefs[i];
  const int n = k.nSteps;
  const double pos = morphPos(i, v);
  const double r = jsRound(pos);
  if (std::fabs(pos - r) < 0.04) {
    const long long ri = jsInt(r);
    if (ri >= 0 && ri < n) o.put(k.steps[ri]);
    return;
  }
  const double af = std::floor(pos);
  const long long a = jsInt(af);
  o.put(a >= 0 && a < n ? k.steps[a] : "undefined");
  o.put(">");
  o.put(a + 1 >= 0 && a + 1 < n ? k.steps[a + 1] : "undefined");
  o.put(" ");
  o.putInt(jsInt(jsRound((pos - af) * 100)));
  o.put("%");
}

bool isFx4(int i) { return i == kn_wide || i == kn_glue || i == kn_tape || i == kn_load; }

void valueText(int i, double v, Out& o) {
  const KnobDef& k = kKnobDefs[i];
  if (i == kn_phase) {
    if (v < kPhaseFree) return o.put("FREE");
    o.putInt(jsInt(jsRound(phaseStart(v) * 360)));
    return o.put(" DEG");
  }
  if (i == kn_monoLow) {
    if (v < 0.04) return o.put("OFF");
    o.putInt(jsInt(jsRound(monoLowHz(v))));
    return o.put(" HZ");
  }
  if (i == kn_duck) {
    if (v < kDuckOff) return o.put("OFF");
    o.put("-");
    o.putInt(jsInt(jsRound(duckDepthDb(v))));
    return o.put(" DB");
  }
  if (i == kn_stack) {
    if (v < kStackMin) return o.put("OFF");
    o.putInt(jsInt(jsRound(stackCents(v))));
    return o.put(" CT");
  }
  if (i == kn_space) {
    if (v < kFxOff) return o.put("OFF");
    o.putNum(jsRound(v * 100) / 100);
    return o.put(" OCT");
  }
  if (isFx4(i)) {
    if (v < kFxOff) return o.put("OFF");
    o.putInt(jsInt(jsRound(v * 100)));
    return o.put(" %");
  }
  if (i == kn_subOct) {
    o.put(k.steps[stepIdx(i, v)]);
    return o.put(" OCT");
  }
  if (i == kn_fine1 || i == kn_fine2) {
    const long long c = jsInt(jsRound(fineCents(v)));
    if (c > 0) o.put("+");
    o.putInt(c);
    return o.put(" CT");
  }
  if (k.morph) return morphText(i, v, o);
  if (k.nSteps > 0) return o.put(k.steps[stepIdx(i, v)]);
  o.putInt(jsInt(jsRound(v * 100)));
  o.put(" %");
}

void readout(int i, double v, Out& o) {
  const KnobDef& k = kKnobDefs[i];
  if (i == kn_subOct) {
    o.put("SUB ");
    return valueText(i, v, o);
  }
  if (i == kn_phase || i == kn_monoLow || i == kn_fine1 || i == kn_fine2 || i == kn_duck || i == kn_stack || i == kn_space) {
    o.put(k.label);
    o.put(" ");
    return valueText(i, v, o);
  }
  if (isFx4(i)) {
    o.put(k.label);
    if (v < kFxOff) return o.put(" OFF");
    o.put(" ");
    o.putInt(jsInt(jsRound(v * 100)));
    return o.put("%");
  }
  if (k.morph) {
    o.put(k.label);
    o.put(" ");
    return morphText(i, v, o);
  }
  if (k.nSteps > 0) {
    o.put(k.label);
    o.put(" ");
    return o.put(k.steps[stepIdx(i, v)]);
  }
  if (std::strcmp(k.section, "feg") == 0) o.put("F ");
  else if (std::strcmp(k.section, "aeg") == 0) o.put("A ");
  o.put(k.label);
  o.put(" ");
  o.putInt(jsInt(jsRound(v * 100)));
  o.put("%");
}

/* ---------------- les ids du moteur ---------------- */

// Les cles de engineState dans l'ordre du JS (engineParams puis outLevel)
const char* const kEngineKeys[kEngineParams] = {
    "wave1", "wave2", "tune1", "tune2", "fine1", "fine2", "osc1", "osc2", "sub", "subOct", "subWave", "fm",
    "ratio", "glide", "cutoff", "res", "envOct", "noise", "fmode", "fA", "fD", "fS", "fR", "aA", "aD", "aS",
    "aR", "drive", "lfoBeats", "lfoShape", "lfoDest", "lfoAmt", "phase", "drift", "width", "keyTrack", "sync", "accFlt",
    "stack", "wide", "glue", "load", "space", "fpol", "outLevel",
};

// Resolus une fois, au chargement (Voyager::paramIndex lit une table constante : aucun ordre d'initialisation en jeu)
struct EngineIds {
  int id[kEngineParams];
  EngineIds() {
    for (int j = 0; j < kEngineParams; ++j) id[j] = Voyager::paramIndex(kEngineKeys[j]);
  }
};
const EngineIds kIds;

}  // namespace

/* ---------------- l'API ---------------- */

static_assert(sizeof(kKnobDefs) / sizeof(kKnobDefs[0]) == kKnobs, "ParamTable.inc : kKnobDefs incomplet");

int knobIndex(const char* id) {
  if (!id) return -1;
  for (int i = 0; i < kKnobs; ++i)
    if (std::strcmp(kKnobDefs[i].id, id) == 0) return i;
  return -1;
}

int knobStep(int i, double v) { return i >= 0 && i < kKnobs ? stepIdx(i, v) : 0; }

double knobClean(int i, double v) {
  if (i < 0 || i >= kKnobs) return v;
  const KnobDef& k = kKnobDefs[i];
  const double t = std::isfinite(v) ? std::fmin(1.0, std::fmax(0.0, v)) : k.def;
  if (k.nSteps > 0 && !k.morph) return static_cast<double>(stepIdx(i, t)) / (k.nSteps - 1);
  return jsRound(t * 1000) / 1000;
}

void knobText(int i, double v, char* out, int max) {
  Out o(out, max);
  if (i < 0 || i >= kKnobs) return;
  valueText(i, v != v ? 0.0 : v, o);
}

void knobReadout(int i, double v, char* out, int max) {
  Out o(out, max);
  if (i < 0 || i >= kKnobs) return;
  readout(i, v != v ? 0.0 : v, o);
}

int degreeMidi(int chord, int d) {
  const int k = rootDegree(chord) + d;
  return FS3 + 12 * floorDiv7(k) + SCALE[mod7(k)];
}

int poolSteps(const double* knobs, int chord, int mode, int* out, int max) {
  int full[kMaxSeq];
  int raw[kMaxSeq];
  const int oct = step(knobs, kn_range) + 1;
  const int nr = arpDegrees(chord, oct, mode, step(knobs, kn_chord), raw);
  // Les extensions au sommet de trois octaves (A, Bm) passent SEQ_TOP : elles se taisent
  int nf = 0;
  for (int j = 0; j < nr; ++j)
    if (raw[j] <= SEQ_TOP) full[nf++] = raw[j];
  const int k = step(knobs, kn_notes);
  int n = 0;
  if (k > 0 && nf > 0)
    for (int j = 0; j < k && n < max; ++j) out[n++] = full[j % nf];
  else
    for (int j = 0; j < nf && n < max; ++j) out[n++] = full[j];
  return n;
}

int engineParams(const double* k, ParamKV* out, int max) {
  const double v[kEngineParams] = {
      morphPos(kn_wave1, val(k, kn_wave1)),
      morphPos(kn_wave2, val(k, kn_wave2)),
      oscSemis(val(k, kn_range1), val(k, kn_semi1)),
      oscSemis(val(k, kn_range2), val(k, kn_semi2)),
      fineCents(val(k, kn_fine1)),
      fineCents(val(k, kn_fine2)),
      0.88 * val(k, kn_osc1) * val(k, kn_osc1),
      0.88 * val(k, kn_osc2) * val(k, kn_osc2),
      0.88 * val(k, kn_sub) * val(k, kn_sub),
      static_cast<double>(step(k, kn_subOct) + 1),
      kSubShape[step(k, kn_subWave)],
      val(k, kn_fm),
      kRatioX[step(k, kn_ratio)],
      glideS(val(k, kn_glide)),
      cutoffHz(val(k, kn_cutoff)),
      val(k, kn_res),
      envOctaves(val(k, kn_envAmt)),
      val(k, kn_noise),
      kFmodeCode[step(k, kn_fmode)],
      attackS(val(k, kn_fA)),
      decayS(val(k, kn_fD)),
      val(k, kn_fS),
      releaseS(val(k, kn_fR)),
      attackS(val(k, kn_aA)),
      decayS(val(k, kn_aD)),
      val(k, kn_aS),
      releaseS(val(k, kn_aR)),
      val(k, kn_dist),
      kLfoBeats[step(k, kn_lfoRate)],
      kLfoShapeCode[step(k, kn_lfoShape)],
      static_cast<double>(step(k, kn_lfoDest)),
      val(k, kn_lfoAmt),
      phaseStart(val(k, kn_phase)),
      2 * val(k, kn_drift),
      0.44 * val(k, kn_width),
      val(k, kn_keyTrack),
      static_cast<double>(step(k, kn_sync)),
      val(k, kn_accFlt),
      stackCents(val(k, kn_stack)),
      fxAmount(val(k, kn_wide)),
      fxAmount(val(k, kn_glue)),
      fxAmount(val(k, kn_load)),
      fxAmount(val(k, kn_space)),
      static_cast<double>(step(k, kn_fpol)),
      // audio/synth.ts volGain : volume^2 x VOLUME_K / (1 + 0.35 delay + 0.5 reverb), celui de ArpFx
      ArpFxLaws::volGain(val(k, kn_volume), val(k, kn_delay), val(k, kn_reverb)),
  };
  int n = 0;
  for (int j = 0; j < kEngineParams && n < max; ++j)
    if (kIds.id[j] >= 0) out[n++] = {kIds.id[j], v[j]};
  return n;
}

void fxSettings(const double* k, ArpFxSettings& out, double& dly16) {
  out.chorus = step(k, kn_chorus);
  out.delay = val(k, kn_delay);
  out.reverb = val(k, kn_reverb);
  out.tape = fxAmount(val(k, kn_tape));
  out.monoLowHz = monoLowHz(val(k, kn_monoLow));
  out.volume = val(k, kn_volume);
  dly16 = kDlySixteenths[step(k, kn_dlyTime)];
}

void reserveArp(ArpProgram& out) {
  out.prog.reserve(kArpChords);
  if (out.chords.size() < static_cast<size_t>(kArpChords)) out.chords.resize(kArpChords);
  for (auto& ch : out.chords) {
    ch.c = -1;
    ch.rand = false;
    ch.midi.clear();
    ch.midi.reserve(kArpNotes);
  }
}

void arpProgram(const double* knobs, const SeqStateC& seq, const int* prog, int nProg, ArpProgram& out) {
  out.spn = kStepsPerNote[step(knobs, kn_rate)];
  out.gate = gateFrac(val(knobs, kn_gate));
  out.accent = val(knobs, kn_accent);
  out.drift = val(knobs, kn_drift);
  out.prog.clear();
  for (int j = 0; prog && j < nProg && static_cast<int>(out.prog.size()) < kArpChords; ++j)
    if (prog[j] >= 0 && prog[j] < kChordCount) out.prog.push_back(prog[j]);

  const int shift = 12 * (step(knobs, kn_octave) - 2);
  const int mode = step(knobs, kn_mode);
  const int len = seq.len < 1 ? 1 : seq.len > 16 ? 16 : seq.len;
  size_t used = 0;
  for (size_t j = 0; j < out.prog.size(); ++j) {
    const int c = out.prog[j];
    bool seen = false;
    for (size_t q = 0; q < j; ++q)
      if (out.prog[q] == c) seen = true;
    if (seen) continue;
    if (out.chords.size() <= used) out.chords.emplace_back();
    ArpChord& ch = out.chords[used++];
    ch.c = c;
    ch.midi.clear();
    if (seq.edit) {
      // EDIT : la suite de Mika, ses silences
      ch.rand = false;
      for (int s = 0; s < len; ++s) ch.midi.push_back(seq.buf[s] == kSeqRest ? kRest : clampMidi(degreeMidi(c, seq.buf[s]) + shift));
      continue;
    }
    int d[kMaxSeq];
    // AUTO : la suite des potards ; RAND : le reservoir (poolSteps(c, p, 0))
    ch.rand = mode == 3;
    const int n = poolSteps(knobs, c, ch.rand ? 0 : mode, d, kMaxSeq);
    for (int s = 0; s < n; ++s) ch.midi.push_back(clampMidi(degreeMidi(c, d[s]) + shift));
  }
  for (size_t j = used; j < out.chords.size(); ++j) {
    out.chords[j].c = -1;
    out.chords[j].rand = false;
    out.chords[j].midi.clear();
  }
}

}  // namespace mmarp
