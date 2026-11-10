// MM-ARP : port C++17 ligne a ligne de src/v4/audio/moog.worklet.js (voir Voyager.h). Les commentaires du JS
// (en francais, les dates, les mesures) sont la reference ; ici seulement ce qui change de forme en C++.
#include "Voyager.h"

#include <cmath>
#include <cstring>
#include <limits>
#include <random>

// Pas de contraction en FMA (le JS n'en fait pas ; mesure : avec, un cas sur 85 tombe a -6 dB, la resonance diverge)
#if defined(__clang__)
#pragma clang fp contract(off)
#elif defined(__GNUC__)
#pragma GCC optimize("fp-contract=off")
#endif
#if defined(_MSC_VER)
#pragma fp_contract(off)
#endif

#include "Voyager.fdlibm.inc"

namespace mmarp {
namespace {

// ---------------------------------------------------------------------------------------------------------------
// Les fonctions de Math du JS. Toutes passent par ici : le fdlibm de V8 (Voyager.fdlibm.inc), celui de Math.* dans
// Node 22 et Chromium (la libm du systeme differe d'un ulp sur 1 a 10 % des valeurs : mesure, tests/voyager_compare).
// sqrt, floor et fabs sont exacts partout (IEEE 754), ceux de <cmath>.
// MMARP_VOYAGER_SYSTEM_LIBM : la libm du systeme a la place (mesure, diagnostic ; plus identique au bit pres au JS).
#if defined(MMARP_VOYAGER_SYSTEM_LIBM)
namespace fdlibm_or_std = std;
#else
namespace fdlibm_or_std = fdlibm;
#endif
namespace jsm {
inline double sin(double x) { return fdlibm_or_std::sin(x); }
inline double cos(double x) { return fdlibm_or_std::cos(x); }
inline double tan(double x) { return fdlibm_or_std::tan(x); }
inline double exp(double x) { return fdlibm_or_std::exp(x); }
inline double log(double x) { return fdlibm_or_std::log(x); }
inline double pow(double x, double y) { return fdlibm_or_std::pow(x, y); }
inline double tanh(double x) { return fdlibm_or_std::tanh(x); }
inline double sinh(double x) { return fdlibm_or_std::sinh(x); }
inline double cosh(double x) { return fdlibm_or_std::cosh(x); }
inline double asinh(double x) { return fdlibm_or_std::asinh(x); }
inline double log1p(double x) { return fdlibm_or_std::log1p(x); }
inline double sqrt(double x) { return std::sqrt(x); }
inline double floor(double x) { return std::floor(x); }
inline double abs(double x) { return std::fabs(x); }
/** Math.round : l'entier le plus proche, les moities vers +inf (inf et NaN passent). */
inline double round(double x) {
  const double r = std::floor(x);
  return (x - r >= 0.5) ? r + 1 : r;
}
/** Math.min / Math.max a deux arguments : NaN gagne, -0 < +0. */
inline double min(double a, double b) {
  if (a != a || b != b) return std::numeric_limits<double>::quiet_NaN();
  if (a == b) return std::signbit(a) ? a : b;
  return a < b ? a : b;
}
inline double max(double a, double b) {
  if (a != a || b != b) return std::numeric_limits<double>::quiet_NaN();
  if (a == b) return std::signbit(a) ? b : a;
  return a > b ? a : b;
}
inline bool isFinite(double x) { return std::isfinite(x); }
}  // namespace jsm

constexpr double JS_PI = 3.141592653589793;
constexpr double JS_SQRT2 = 1.4142135623730951;
constexpr double JS_LN2 = 0.6931471805599453;
constexpr double INF = std::numeric_limits<double>::infinity();
constexpr double QNAN = std::numeric_limits<double>::quiet_NaN();

constexpr int MAX_VOICES = 12;
constexpr double VOICE_OFF = 0.0005;
constexpr double OD_DC_HZ = 20;
constexpr double OUT_DC_HZ = 8;
constexpr double CLIP_KNEE = 0.5;
constexpr double CLIP_CEIL = 0.71;
constexpr double CLIP_POST = 0.66;
constexpr double PAN_S = 0.004;
constexpr int OS_DEFAULT = 4;
// La demi-bande x8 -> x4 (plugin, 2026-11-10) : la meme famille Kaiser que les deux autres (31 / beta 9 et 63 / beta 8),
// 23 coefficients, beta 10 : -100 dB des 0.395 x le taux x8 (151 kHz a 48 kHz : rien ne se replie sous 41 kHz).
constexpr int D8_TAPS = 23;
constexpr double D8_BETA = 10;
constexpr int MAX_STACK = 3;
const double STACK_OFF[3][3] = {{0, 0, 0}, {-0.7, 0.7, 0}, {-1, 0, 1}};
const double STACK_PAN[3][3] = {{0, 0, 0}, {-1, 1, 0}, {-1, 0, 1}};
const double STACK_PAN1[2] = {-0.8, 0.8};
const double STACK_PAN2[3] = {0.64, 1, 2.0 / 3};
const double WAVE_POW[6] = {0.5, 1.0 / 3, 1.0 / 3, 1, 4 * 0.14 * 0.86, 0.5};
constexpr double STACK_S = 0.005;
constexpr double STACK_D_S = 0.03;
constexpr double GLUE_THR0 = -6;
constexpr double GLUE_THR_SPAN = 8;
constexpr double GLUE_SLOPE = 0.5;
constexpr double GLUE_KNEE = 8;
constexpr double GLUE_ATK_S = 0.008;
constexpr double GLUE_REL_S = 0.15;
constexpr double GLUE_AVG_S = 2;
constexpr double GLUE_DRIVE = 0.8;
constexpr double GLUE_KNEE_AT = 0.5;
constexpr double GLUE_S = 0.02;
constexpr double DB_LN = 0.11512925464970229;
constexpr double LN_DB = 4.342944819032518;

/** mulberry32 (Math.imul -> multiplication uint32) ; unseeded : la graine tiree une fois au hasard. */
struct Rnd {
  uint32_t st = 0;
  inline double next() {
    const uint32_t a = st + 0x6d2b79f5u;
    st = a;
    uint32_t t = a;
    t = (t ^ (t >> 15)) * (t | 1u);
    t ^= t + (t ^ (t >> 7)) * (t | 61u);
    return static_cast<double>(t ^ (t >> 14)) / 4294967296.0;
  }
  inline void fill(double* buf, int n) {
    for (int i = 0; i < n; i += 1) buf[i] = next();
  }
};

double glueClipF(double x, double k, double w) {
  const double a = x < 0 ? -x : x;
  if (a <= k) return 0.5 * x * x;
  const double u = a - k;
  if (u < 2 * w) return 0.5 * k * k + k * u + 0.5 * u * u - (u * u * u) / (12 * w);
  return 0.5 * k * k + 2 * k * w + (4.0 / 3) * w * w + (k + w) * (u - 2 * w);
}

double besselI0(double x) {
  double sum = 1;
  double term = 1;
  for (int k = 1; k < 40; k += 1) {
    term *= (x / (2 * k)) * (x / (2 * k));
    sum += term;
    if (term < 1e-12 * sum) break;
  }
  return sum;
}

constexpr double TAU = JS_PI * 2;
constexpr double FM_INDEX = 1.6;
constexpr double FM_MAX = 6;
constexpr double LFO_MIN_JUMP = 0.5;
inline double nextRandom(double a, Rnd& rnd) {
  const double lo = jsm::max(0, a - LFO_MIN_JUMP + 1);
  const double hi = jsm::max(0, 1 - a - LFO_MIN_JUMP);
  const double r = rnd.next() * (lo + hi);
  return r < lo ? -1 + r : a + LFO_MIN_JUMP + (r - lo);
}
constexpr double NOISE_MAX = 1;
constexpr double SLOPE12_RES = 0.12;
constexpr double BP_GAIN = 1.3;
constexpr double BP_RES = 0.12;
constexpr double HP_GAIN = 2.1;
constexpr double HP_RES = 0.1;
constexpr double NL_A = 0.6;
constexpr double NL_K = (NL_A * NL_A) / 3;
constexpr double BASS_KEEP = 0.45;
constexpr double RES_KNEE = 0.7;
constexpr double RES_SING = 0.9;
inline double resK(double r) { return r <= RES_KNEE ? 4.1 * r : r <= RES_SING ? 2.87 + (r - RES_KNEE) * 5.65 : 4 + (r - RES_SING) * 1; }
constexpr double K_COMP = 105;
constexpr double LC_G0 = 0.08;
constexpr double LC_GW = 0.1;
constexpr double LC_K0 = 3.8;
constexpr double LC_KW = 0.15;
constexpr double K35_K1 = 58.4;
constexpr int K35_N = 8192;
constexpr double K35_XMAX = 256;
constexpr double K35_INV = K35_N / K35_XMAX;
constexpr double K35_KNEE = 6;
constexpr double K35_LAM = K35_KNEE / 11.1;
constexpr double K35_ALPHA = 0.035;
constexpr double K35_AF0 = 9000;
constexpr double K35_AFW = 4000;
constexpr double MS_X2_K = 0.97;
const double MS_RES_AT[8] = {0, 0.3, 0.5, 0.7, 0.8, 0.85, 0.9, 1.0};
const double MS_KAPPA[8] = {0, 0.6, 0.8, 0.92, 0.96, 0.98, 1.0, 1.06};
constexpr double C35 = 630;
constexpr double MS_GAIN = 0.7;
constexpr double MS_SO_TAU = 0.03;
constexpr double MS_FC_MAX4 = 16000;
constexpr double MS_FC_MAX2 = 13000;
constexpr double LD_S = 1.6;
constexpr double LD_S2 = LD_S * LD_S;
constexpr double LD_IS = 1 / LD_S;
constexpr double LD_REL0 = 0.3;
constexpr double LD_REL1 = 0.6;
constexpr double LD_BIAS = 0.16;
constexpr double LD_DC_HZ = 7;
constexpr double LD_MK = 0.5;
constexpr double PHASE_QUIET = 0.02;
constexpr double OUT_GAIN = 1.25;
constexpr double OD_HP_HZ = 720;
constexpr double OD_TONE_HZ = 4200;
constexpr double OD_GAIN = 40;
constexpr double OD_BIAS = 0.22;
constexpr double OD_MIX = 0.42;
constexpr double OD_TRIM = 0.85;
const double OD_COMP_AT[6] = {0, 0.1, 0.25, 0.5, 0.75, 1};
const double OD_COMP[6] = {1, 0.85, 0.65, 0.54, 0.57, 0.64};
constexpr double OD_ADAA_EPS = 1e-6;
constexpr double OD_LIN_U = 1e-5;
constexpr double LN2 = JS_LN2;
constexpr int LNC_INV = 128;
constexpr int LNC_MAX = 18;
const double DRIFT_WALKS[3][2] = {{3, 1}, {0.5, 0.5}, {0.03, 0.2}};
constexpr double DRIFT_MAX = 4;
constexpr double DRIFT_CAL_TUNE = 1;
constexpr double DRIFT_CAL_CUT = 0.03;
constexpr double ACC_ENV = 1.5;
constexpr double ACC_CUT = 0.6;
inline double midiHz(double m) { return 440 * jsm::pow(2, (m - 69) / 12); }
inline double coef(double seconds, double sr) { return 1 - jsm::exp(-1 / jsm::max(1, seconds * sr)); }
constexpr double FM_B_PHONE = 0.25;
constexpr double PULSE_W = 0.14;
inline double pwOf(int w, double f) { return w == 3 ? 0.5 - (0.5 - PULSE_W) * f : w == 4 ? PULSE_W : 0.5; }
constexpr double VOICE_GUARD = 64;
constexpr double TINY = 1e-20;
constexpr double PRE_HZ = 20000;
const double PRE_Q[2] = {0.5411961, 1.306563};
constexpr double PRE_OD0 = 0.45;
constexpr double PRE_OD1 = 0.65;
constexpr double PRE_OD_HZ = 14000;
constexpr double TRACK_ROOT = 54;

// ---------------------------------------------------------------------------------------------------------------
// Les extensions du plugin (2026-11-10, hors du site : QUALITY x8, LFO 1 seconde destination, LFO 2). Voir Voyager.h.
// Les destinations etendues (xl1Dest 1..10 ; l2Dest 5..14) et leur profondeur a amt = 1 :
enum { E_OFF = 0, E_RES, E_AMP, E_PAN, E_O2PITCH, E_OSCMIX, E_NOISE, E_SUB, E_DRIVE, E_STACK, E_ENV, E_COUNT };
constexpr double X_RES = 0.35;        // RES +/-0.35, bornee a 0..1 (la course du potard du site)
constexpr double X_O2_CENTS = 1200;   // OSC 2 PITCH +/-12 demi-tons
constexpr double X_NOISE = 1;         // NOISE +/-1 autour du potard, borne a 0..1
constexpr double X_SUB = 0.88;        // SUB +/-0.88 (le plein niveau du site), borne a 0..0.88
constexpr double X_DRIVE = 0.5;       // DRIVE +/-0.5, borne a 0..1
constexpr double X_STACK = 15;        // STACK +/-15 cents, borne a 0..30 (la course du site)
constexpr double X_ENV = 3;           // ENV AMT +/-3 octaves, borne a 0..6
constexpr double X_STACK_MAX = 30;
constexpr double X_ENV_MAX = 6;
constexpr int X_ANCHOR = 64;          // le hasard du LFO 2 : une chaine de 64 cycles a partir d'une ancre tiree par position
/** Le hasard du LFO 2 : une valeur 0..1 par (graine, cycle), sans etat (splitmix64) : jamais le generateur du moteur. */
inline double hashU(uint32_t seed, int64_t c) {
  uint64_t z = static_cast<uint64_t>(c) * 0x9E3779B97F4A7C15ull + (static_cast<uint64_t>(seed) << 1 | 1u);
  z ^= z >> 30;
  z *= 0xBF58476D1CE4E5B9ull;
  z ^= z >> 27;
  z *= 0x94D049BB133111EBull;
  z ^= z >> 31;
  return static_cast<double>(z >> 11) * (1.0 / 9007199254740992.0);
}
/** nextRandom du LFO 1 (un saut d'au moins LFO_MIN_JUMP), le tirage u donne. */
inline double nextRandomU(double a, double u) {
  const double lo = jsm::max(0, a - LFO_MIN_JUMP + 1);
  const double hi = jsm::max(0, 1 - a - LFO_MIN_JUMP);
  const double r = u * (lo + hi);
  return r < lo ? -1 + r : a + LFO_MIN_JUMP + (r - lo);
}
/** exp(x) pour |x| < 0.05 (le desaccord de STACK module, par echantillon) : Taylor d'ordre 5, erreur < 1e-11. */
inline double expSmall(double x) { return 1 + x * (1 + (x / 2) * (1 + (x / 3) * (1 + (x / 4) * (1 + x / 5)))); }

enum {
  KS_ODGAIN = 0, KS_ODMIX, KS_ODTRIM, KS_CLIPT, KS_CLIPW, KS_VSC, KS_GLUE, KS_SIZE
};
enum { KI_NEWNOISE = 0, KI_GLUEON, KI_SIZE };
enum {
  VX_P1A = 0, VX_P1B = 1, VX_P2A = 2, VX_P2B = 3, VX_Q1A = 4, VX_Q1B = 5, VX_Q2A = 6, VX_Q2B = 7,
  VX_TZL = 8, VX_TFL = 9, VX_TVL = 10, VX_TZR = 11, VX_TFR = 12, VX_TVR = 13,
  VX_KCL = 16, VX_KBL = 17, VX_KPL = 18, VX_KQL = 19, VX_KYL = 20, VX_KCR = 21, VX_KBR = 22, VX_KPR = 23, VX_KQR = 24,
  VX_KYR = 25, VX_KON = 26, VX_G35 = 27,
  VX_LZL = 28, VX_LFL = 29, VX_LXL = 30, VX_LHL = 31, VX_LZR = 32, VX_LFR = 33, VX_LXR = 34, VX_LHR = 35, VX_LON = 36,
  VX_G35R = 37, VX_KXL = 38, VX_KXR = 39, VX_KAL = 40, VX_G35H = 41, VX_G35RH = 42, VX_LPL = 44, VX_LPR = 48,
  VX_SIZE = 52
};
constexpr double SP_XF = 0.2;
constexpr double RAMP_MIN = 0.002;
constexpr double RAMP_MAX = 0.05;
constexpr double RAMP_PRED = 0.5;
constexpr double RAMP_SM_S = 0.01;
constexpr double FADE_HZ = 18000;
constexpr double FADE_W = 4000;
constexpr double VS_EPS = 1e-6;
constexpr double VS_COMP = 1.0 / 8;
enum {
  OD_HPL = 0, OD_XL, OD_LPL, OD_HPR, OD_XR, OD_LPR, OD_DL, OD_DXL, OD_DR, OD_DXR, OD_UL, OD_FIL, OD_UR, OD_FIR,
  OD_FVL, OD_FVR, OD_ON, OD_PL, OD_PR, OD_SIZE
};
enum { GL_G = 0, GL_ENV, GL_AVG, GL_GAIN, GL_MIX, GL_K, GL_W, GL_MI, GL_MO, GL_GC, GL_THR, GL_MK, GL_SIZE };

// ---------------------------------------------------------------------------------------------------------------
// Les tables du module JS (lncosh en Hermite, les diodes du Korg35), calculees une fois comme au chargement du JS.
struct Tables {
  double LNC[4 * LNC_MAX * LNC_INV];
  double K35_T[K35_N + 1];
  double K35_S[K35_N + 1];
  double K35_TEND, K35_SLOPE, OD_TANH_BIAS, OD_SECH2, MS_SO;
  Tables() {
    const double f0 = (K35_K1 + 0.03) / (1.03 * K35_K1);
    for (int i = 0; i <= K35_N; i += 1) {
      const double xx = i / K35_INV;
      const double r = (xx * (K35_K1 - 1)) / K35_K1;
      double z = r < 1 ? r / 1.03 : jsm::asinh(r / 0.03);
      for (int it = 0; it < 60; it += 1) z -= (z + 0.03 * jsm::sinh(z) - r) / (1 + 0.03 * jsm::cosh(z));
      K35_T[i] = (xx / K35_K1 + z) / f0;
    }
    K35_TEND = K35_T[K35_N];
    K35_SLOPE = (K35_T[K35_N] - K35_T[K35_N - 1]) * K35_INV;
    K35_S[0] = 1;
    for (int i = 1; i <= K35_N; i += 1) K35_S[i] = (K35_T[i] * K35_INV) / i;
    MS_SO = jsm::pow(10, -9.0 / 20) - 1;
    OD_TANH_BIAS = jsm::tanh(OD_BIAS);
    OD_SECH2 = 1 - OD_TANH_BIAS * OD_TANH_BIAS;
    for (int i = 0; i < LNC_MAX * LNC_INV; i += 1) {
      const double h = 1.0 / LNC_INV;
      const double x0 = i * h;
      const double x1 = x0 + h;
      const double y0 = x0 + jsm::log1p(jsm::exp(-2 * x0)) - LN2;
      const double y1 = x1 + jsm::log1p(jsm::exp(-2 * x1)) - LN2;
      const double d0 = jsm::tanh(x0);
      const double d1 = jsm::tanh(x1);
      LNC[4 * i] = y0;
      LNC[4 * i + 1] = h * d0;
      LNC[4 * i + 2] = 3 * (y1 - y0) - h * (2 * d0 + d1);
      LNC[4 * i + 3] = 2 * (y0 - y1) + h * (d0 + d1);
    }
  }
};
const Tables& tables() {
  static const Tables t;
  return t;
}

// ---------------------------------------------------------------------------------------------------------------
// Les reglages (P_RANGE puis P_INT du JS), dans l'ordre des defauts de this.p.
enum PId {
  P_wave1, P_wave2, P_tune1, P_tune2, P_fine1, P_fine2, P_osc1, P_osc2, P_fm, P_ratio, P_glide, P_noise, P_fmode,
  P_lfoBeats, P_lfoShape, P_lfoDest, P_lfoAmt, P_bpm, P_cutoff, P_res, P_envOct, P_fA, P_fD, P_fS, P_fR, P_aA, P_aD,
  P_aS, P_aR, P_drive, P_phase, P_drift, P_width, P_keyTrack, P_sync, P_sub, P_subOct, P_subWave, P_accFlt, P_outLevel,
  P_stack, P_wide, P_load, P_space, P_fpol, P_glue,
  // les extensions du plugin (jamais envoyees par le site ; leurs defauts : rien ne change, au bit pres)
  P_xl1Dest, P_xl1Amt, P_l2Beats, P_l2Shape, P_l2Dest, P_l2Amt, P_COUNT
};
struct PDef {
  const char* name;
  double lo, hi;
  bool isInt;
  double def;
};
const PDef PDEFS[P_COUNT] = {
    {"wave1", 0, 5, false, 2},       {"wave2", 0, 4, false, 2},       {"tune1", -64, 48, false, 0},
    {"tune2", -64, 48, false, -12},  {"fine1", -75, 75, false, -8},   {"fine2", -75, 75, false, 8},
    {"osc1", 0, 1.32, false, 0.62},  {"osc2", 0, 1.32, false, 0.62},  {"fm", 0, 1.5, false, 0},
    {"ratio", 0.25, 10.5, false, 1}, {"glide", 0, 0.93, false, 0},    {"noise", 0, 1.5, false, 0},
    {"fmode", 0, 4, true, 0},        {"lfoBeats", 0.0625, 24, false, 4}, {"lfoShape", 0, 4, true, 0},
    {"lfoDest", 0, 4, true, 0},      {"lfoAmt", 0, 1.5, false, 0},    {"bpm", 10, 600, false, 130},
    {"cutoff", 20, 28500, false, 800}, {"res", 0, 1.5, false, 0.3},   {"envOct", 0, 9, false, 3},
    {"fA", 0, 3, false, 0.001},      {"fD", 0, 3, false, 0.3},        {"fS", 0, 1.5, false, 0.2},
    {"fR", 0, 4.5, false, 0.3},      {"aA", 0, 3, false, 0.002},      {"aD", 0, 3, false, 0.35},
    {"aS", 0, 1.5, false, 0.6},      {"aR", 0, 4.5, false, 0.3},      {"drive", 0, 1.5, false, 0},
    {"phase", -1, 1, false, -1},     {"drift", 0, 3, false, 1},       {"width", 0, 0.66, false, 0.22},
    {"keyTrack", 0, 1.5, false, 0.5}, {"sync", 0, 1, true, 0},        {"sub", 0, 1.32, false, 0},
    {"subOct", 1, 2, true, 1},       {"subWave", 0, 3, true, 0},      {"accFlt", 0, 1.5, false, 0},
    {"outLevel", 0, 1.5, false, 0},  {"stack", 0, 45, false, 0},      {"wide", 0, 1.5, false, 0},
    {"load", 0, 1, false, 0},        {"space", 0, 1, false, 0},       {"fpol", 0, 1, true, 0},
    {"glue", 0, 1.5, false, 0},
    {"xl1Dest", 0, 10, true, 0},     {"xl1Amt", 0, 1, false, 0},      {"l2Beats", 0.125, 32, false, 4},
    {"l2Shape", 0, 6, true, 0},      {"l2Dest", 0, 14, true, 0},      {"l2Amt", 0, 1, false, 0},
};

// ---------------------------------------------------------------------------------------------------------------
/** Un etage de decimation par 2 (Decimator du JS) ; son historique en float (Float32Array). */
struct Decimator {
  double h[63];
  int idx[63];
  int nIdx = 0;
  int T = 0;
  std::vector<float> buf;
  void init(int taps, double beta, int maxIn = 4 * Voyager::kMaxBlock) {
    const double c = (taps - 1) / 2.0;
    const double i0b = besselI0(beta);
    double sum = 0;
    for (int k = 0; k < taps; k += 1) {
      const double n = k - c;
      const double ideal = n == 0 ? 0.5 : jsm::sin((JS_PI * n) / 2) / (JS_PI * n);
      const double r = n / c;
      const double w = besselI0(beta * jsm::sqrt(jsm::max(0, 1 - r * r))) / i0b;
      h[k] = ideal * w;
      sum += h[k];
    }
    for (int k = 0; k < taps; k += 1) h[k] /= sum;
    nIdx = 0;
    for (int k = 0; k < taps; k += 1)
      if (jsm::abs(h[k]) > 1e-12) idx[nIdx++] = k;
    T = taps - 1;
    buf.assign(static_cast<size_t>(T + maxIn), 0.0f);
  }
  void run(const float* input, int n2, float* out) {
    float* b = buf.data();
    for (int i = 0; i < n2; i += 1) b[T + i] = input[i];
    const int n = n2 >> 1;
    for (int i = 0; i < n; i += 1) {
      const int base = T + 2 * i + 1;
      double y = 0;
      for (int j = 0; j < nIdx; j += 1) {
        const int k = idx[j];
        y += h[k] * b[base - k];
      }
      out[i] = static_cast<float>(y);
    }
    std::memmove(b, b + n2, sizeof(float) * T);
  }
  void clear() { std::fill(buf.begin(), buf.begin() + T, 0.0f); }
};

struct StackPair {
  double a, b, m, q1, q2, sb, sf, g, gt, off, r, pan1, pan2;
  bool live;
  void init(double a0, double b0, double m0, bool lv) {
    a = a0; b = b0; m = m0; q1 = QNAN; q2 = QNAN; sb = 0; sf = 0; g = lv ? 1 : 0; gt = lv ? 1 : 0; off = 0; r = 1;
    pan1 = STACK_PAN1[0]; pan2 = STACK_PAN1[1]; live = lv;
  }
};
struct LadderR {
  double pu = 0, s1 = 0, s2 = 0, s3 = 0, s4 = 0, u = 0, y1 = 0, y2 = 0, x = 0, g = 0, k = 0, y = 0;
};

struct Voice {
  bool on = false;
  double midi = 60;
  double logf = 0, logT = 0;
  StackPair pr[MAX_STACK];
  double subPh = 0;
  int n = 1, nLoop = 1;
  LadderR fr;
  bool wl = false, wideOK = true;
  double x[VX_SIZE];
  int32_t seed = 1;
  double nz = 0;
  double drift[2] = {0, 0};
  double walk[3][2] = {{0, 0}, {0, 0}, {0, 0}};
  double calT[2] = {0, 0};
  double calC = 0;
  int aStage = 0;
  double aV = 0;
  int fStage = 0;
  double fV = 0;
  double s1 = 0, s2 = 0, s3 = 0, s4 = 0;
  double off = 0, start = 0, accent = 1;
  int64_t age = 0;
  bool quick = false;
  double vCut = 1, vCutE = 0, accN = 1, kLam = K35_LAM, kIlam = 1 / K35_LAM, vEnv = 1, vTune = 0;
  double gL = 1, gR = 1, tL = 1, tR = 1;
  double envAcc = 1, cutAcc = 0, fdm = 1, ampAcc = 1;
  double pu = 0, d1 = 0, d2 = 0, d3 = 0, g = 0, gS = 0;

  void init(Rnd& rnd) {
    logf = jsm::log(261.6);
    logT = logf;
    const double a0 = rnd.next();
    const double b0 = rnd.next();
    const double m0 = rnd.next();
    pr[0].init(a0, b0, m0, true);
    for (int j = 1; j < MAX_STACK; j += 1) pr[j].init(0, 0, 0, false);
    subPh = rnd.next();
    for (int j = 0; j < VX_SIZE; j += 1) x[j] = 0;
    seed = static_cast<int32_t>(rnd.next() * 0x7fffffff) | 1;
    for (int j = 0; j < 3; j += 1)
      for (int k = 0; k < 2; k += 1) walk[j][k] = j == 0 ? (rnd.next() - 0.5) * 3.4641 * DRIFT_WALKS[j][1] : 0;
    const double t0 = (rnd.next() - 0.5) * 2 * DRIFT_CAL_TUNE;
    const double t1 = (rnd.next() - 0.5) * 2 * DRIFT_CAL_TUNE;
    calT[0] = t0;
    calT[1] = t1;
    calC = (rnd.next() - 0.5) * 2 * DRIFT_CAL_CUT;
  }
};

/** L'echelle de droite (ladderR du JS). */
inline void ladderR(LadderR& st) {
  const double x = st.x;
  const double g = st.g;
  const double k = st.k;
  const double x0 = st.pu;
  const double x1 = st.s1;
  const double x2 = st.s2;
  const double x3 = st.s3;
  const double x4 = st.s4;
  const double ga = g / (1 + NL_K * (x0 * x0 + x0 * x1 + x1 * x1));
  const double gb = g / (1 + NL_K * (x1 * x1 + x1 * x2 + x2 * x2));
  const double gc = g / (1 + NL_K * (x2 * x2 + x2 * x3 + x3 * x3));
  const double gd = g / (1 + NL_K * (x3 * x3 + x3 * x4 + x4 * x4));
  double Ga = ga / (1 + ga);
  double Gb = gb / (1 + gb);
  double Gc = gc / (1 + gc);
  double Gd = gd / (1 + gd);
  double S = Gd * Gc * Gb * (1 - Ga) * x1 + Gd * Gc * (1 - Gb) * x2 + Gd * (1 - Gc) * x3 + (1 - Gd) * x4;
  double u = (x - k * S) / (1 + k * Ga * Gb * Gc * Gd);
  if (k > LC_K0 && g > LC_G0) {
    double ta = (g - LC_G0) / LC_GW;
    ta = ta >= 1 ? 1 : ta * ta * (3 - 2 * ta);
    double tb = (k - LC_K0) / LC_KW;
    tb = tb >= 1 ? 1 : tb * tb * (3 - 2 * tb);
    const double om = ta * tb;
    const double p1 = x1 + (u - x1) * Ga;
    const double p2 = x2 + (p1 - x2) * Gb;
    const double p3 = x3 + (p2 - x3) * Gc;
    const double p4 = x4 + (p3 - x4) * Gd;
    const double ha = g / (1 + NL_K * (u * u + u * p1 + p1 * p1));
    const double hb = g / (1 + NL_K * (p1 * p1 + p1 * p2 + p2 * p2));
    const double hc = g / (1 + NL_K * (p2 * p2 + p2 * p3 + p3 * p3));
    const double hd = g / (1 + NL_K * (p3 * p3 + p3 * p4 + p4 * p4));
    Ga += om * (ha / (1 + ha) - Ga);
    Gb += om * (hb / (1 + hb) - Gb);
    Gc += om * (hc / (1 + hc) - Gc);
    Gd += om * (hd / (1 + hd) - Gd);
    S = Gd * Gc * Gb * (1 - Ga) * x1 + Gd * Gc * (1 - Gb) * x2 + Gd * (1 - Gc) * x3 + (1 - Gd) * x4;
    u = (x - k * S) / (1 + k * Ga * Gb * Gc * Gd);
  }
  st.pu = u;
  st.u = u;
  double w = (u - x1) * Ga;
  double y = w + x1;
  st.s1 = y + w;
  st.y1 = y;
  w = (y - x2) * Gb;
  y = w + x2;
  st.s2 = y + w;
  st.y2 = y;
  w = (y - x3) * Gc;
  y = w + x3;
  st.s3 = y + w;
  w = (y - x4) * Gd;
  y = w + x4;
  st.s4 = y + w;
  st.y = y;
}

/** lncosh par la table (Hermite), |x| < LNC_MAX suppose ; le chemin "a - LN2" a part, comme le JS. */
inline double lncTab(const double* LNC, double a) {
  const double q = a * LNC_INV;
  const int i = static_cast<int>(q);
  const double t = q - i;
  const int k = 4 * i;
  return LNC[k] + t * (LNC[k + 1] + t * (LNC[k + 2] + t * LNC[k + 3]));
}
/** tanh par la pente de la table (|x| < LNC_MAX). */
inline double lncSlope(const double* LNC, double am) {
  const double qm = am * LNC_INV;
  const int im = static_cast<int>(qm);
  const double tm = qm - im;
  const int km = 4 * im;
  return (LNC[km + 1] + tm * (2 * LNC[km + 2] + 3 * tm * LNC[km + 3])) * LNC_INV;
}

struct NoteEv {
  double frame, midi, gate, accent, from;
  bool hasFrom;
};
struct BeatEv {
  double f, b, k;
  bool run;
};

/** Une file triee a capacite fixe (les tableaux du JS : splice a sa place, shift en tete, filter). */
template <typename T, int CAP>
struct Fifo {
  T buf[CAP];
  int head = 0, cnt = 0;
  int size() const { return cnt; }
  T& at(int i) { return buf[head + i]; }
  const T& at(int i) const { return buf[head + i]; }
  bool insertAt(int i, const T& e) {
    if (head + cnt >= CAP) {
      if (cnt >= CAP) return false;
      std::memmove(static_cast<void*>(buf), static_cast<const void*>(buf + head), sizeof(T) * cnt);
      head = 0;
    }
    T* b = buf + head;
    std::memmove(static_cast<void*>(b + i + 1), static_cast<const void*>(b + i), sizeof(T) * (cnt - i));
    b[i] = e;
    cnt += 1;
    return true;
  }
  T shift() {
    T e = buf[head];
    head += 1;
    cnt -= 1;
    if (cnt == 0) head = 0;
    return e;
  }
  template <typename F>
  void keepIf(F f) {
    int w = 0;
    for (int i = 0; i < cnt; i += 1)
      if (f(buf[head + i])) buf[head + w++] = buf[head + i];
    cnt = w;
    if (cnt == 0) head = 0;
  }
  void clear() { head = cnt = 0; }
};

}  // namespace

// =================================================================================================================
struct Voyager::Impl {
  double sampleRate;
  int64_t cf = 0;  // currentFrame
  Rnd rnd;
  double rndBuf[6 * MAX_VOICES];
  Voice voices[MAX_VOICES];
  int nv = MAX_VOICES;
  int maxStack = MAX_STACK;
  int wideVoices = MAX_VOICES;
  double stD = 0, stDK = 0;
  double gl[GL_SIZE];
  double ks[KS_SIZE];
  int32_t ki[KI_SIZE];
  double acc[2];
  double glX[4];
  double glK, glA, glR, glAvg;
  double glc[4];
  Fifo<NoteEv, Voyager::kQueueCap> queue;
  int64_t age = 0;
  int os = 4;
  double sr2;
  std::vector<float> raw, rawR, mid, midR, mid8, mid8R;
  Decimator d8, d4, d2, d8R, d4R, d2R;
  bool hasD8 = false, hasD4 = false, hasD2 = false;
  // QUALITY (setOs) : le taux demande (0 : rien en attente), les echantillons sans voix et ceux depuis la demande
  int osWant = 0;
  int64_t osQuiet = 0, osWait = 0;
  // LFO 1 seconde destination et LFO 2 : les destinations en cours, les quantites lissees, le LFO 2 et son hasard
  struct Ext {
    int d1 = 0, d2 = 0;
    double a1 = 0, a2 = 0;
    double lfo2 = 0, raw2 = 0, idx2 = QNAN, rA2 = 0, rB2 = 0;
    double drv = 0, panL = 1, panR = 1;
    bool panOn = false, stackDirty = false;
    uint32_t seed = 0;
  } xs;
  double od[OD_SIZE];
  double odHp, odLp, odDc;
  double dc[4];
  double vsc[4];
  double dcK, ldDc, ldLast, ldMk, ldYb, spLast, spF, spI, panK;
  double preG, preA1, preH1, preA2, preH2, preFc;
  double stK;
  double outDrive, outNorm;
  bool flip = false;
  double wm[5];
  double lfoOut, lfoK;
  double p[P_COUNT];
  struct Sm {
    double w1, w2, o1, o2, fm, noise, sub, lfoAmt, f1, f2, cutoff, res, envOct, drive, wide, load, space;
  } sm;
  double smK;
  struct Coefs {
    double aAtk, fAtk, aDec, fDec, aRel, fRel, quick, glide;
  } c;
  int heals = 0;
  double rT[3], rS[3], rF[3], rI[3], rOld[3];
  int32_t rN[3], rM[3], rP[3];
  double smKr;
  BeatEv tp;
  bool tpLocked = false;
  Fifo<BeatEv, Voyager::kBeatCap> beats;
  double rIdx = -1, rA = 0, rB = 0;
  double walkDt = QNAN;
  double walkC[3][2];

  Impl(const VoyagerOptions& o, const std::vector<std::pair<std::string, double>>& init) {
    sampleRate = o.sampleRate;
    if (o.seeded)
      rnd.st = o.seed;
    else {
      std::random_device rd;
      rnd.st = static_cast<uint32_t>(rd());
    }
    for (double& x : rndBuf) x = 0;
    nv = o.maxVoices >= 1 && o.maxVoices <= MAX_VOICES ? o.maxVoices : MAX_VOICES;
    for (int i = 0; i < nv; i += 1) voices[i].init(rnd);
    maxStack = o.maxStack >= 1 && o.maxStack <= MAX_STACK ? o.maxStack : MAX_STACK;
    wideVoices = o.wideVoices >= 0 ? o.wideVoices : MAX_VOICES;
    stD = 0;
    stDK = 1 - jsm::exp(-128 / (STACK_D_S * sampleRate));
    for (double& x : gl) x = 0;
    gl[GL_GAIN] = 1;
    gl[GL_K] = 1;
    gl[GL_W] = 1;
    gl[GL_GC] = 1;
    gl[GL_THR] = GLUE_THR0;
    for (double& x : ks) x = 0;
    ki[0] = ki[1] = 0;
    acc[0] = acc[1] = 0;
    for (double& x : glX) x = 0;
    glK = coef(GLUE_S, sampleRate);
    glA = coef(GLUE_ATK_S, sampleRate);
    glR = coef(GLUE_REL_S, sampleRate);
    glAvg = coef(GLUE_AVG_S, sampleRate);
    glc[0] = glK;
    glc[1] = glA;
    glc[2] = glR;
    glc[3] = glAvg;
    age = 0;
    os = o.os == 1 || o.os == 2 || o.os == 4 || o.os == 8 ? o.os : OS_DEFAULT;
    // Tout est alloue pour x8 (setOs change de taux sur le thread audio, sans allocation) ; les trois demi-bandes
    // existent toujours, celles que le taux n'utilise pas dorment.
    raw.assign(8 * Voyager::kMaxBlock, 0.0f);
    rawR.assign(8 * Voyager::kMaxBlock, 0.0f);
    mid8.assign(4 * Voyager::kMaxBlock, 0.0f);
    mid8R.assign(4 * Voyager::kMaxBlock, 0.0f);
    mid.assign(2 * Voyager::kMaxBlock, 0.0f);
    midR.assign(2 * Voyager::kMaxBlock, 0.0f);
    d8.init(D8_TAPS, D8_BETA, 8 * Voyager::kMaxBlock);
    d8R.init(D8_TAPS, D8_BETA, 8 * Voyager::kMaxBlock);
    d4.init(31, 9);
    d4R.init(31, 9);
    d2.init(63, 8);
    d2R.init(63, 8);
    for (double& x : od) x = 0;
    for (double& x : dc) x = 0;
    for (double& x : vsc) x = 0;
    ldLast = -1;
    ldMk = 1;
    ldYb = 0;
    spLast = -1;
    spF = 1;
    spI = 1;
    setRates();
    outDrive = -1;
    outNorm = 1;
    flip = false;
    wm[0] = 1;
    wm[1] = wm[2] = wm[3] = wm[4] = 0;
    lfoOut = 0;
    for (int i = 0; i < P_COUNT; i += 1) p[i] = PDEFS[i].def;
    sm = {2, 2, 0.62, 0.62, 0, 0, 0, 0, -8, 8, 800, 0.3, 3, 0, 0, 0, 0};
    std::vector<ParamKV> kv;
    for (const auto& e : init) {
      const int id = Voyager::paramIndex(e.first);
      if (id >= 0) kv.push_back({id, e.second});
    }
    if (!kv.empty()) setParams(kv.data(), static_cast<int>(kv.size()));
    for (int m = 0; m < 5; m += 1) wm[m] = m == static_cast<int>(p[P_fmode]) ? 1 : 0;
    heals = 0;
    sm = {p[P_wave1], p[P_wave2], p[P_osc1], p[P_osc2], p[P_fm], p[P_noise], p[P_sub], p[P_lfoAmt], p[P_fine1], p[P_fine2],
          p[P_cutoff], p[P_res], p[P_envOct], p[P_drive], p[P_wide], p[P_load], p[P_space]};
    rT[0] = p[P_cutoff];
    rT[1] = p[P_res];
    rT[2] = p[P_envOct];
    for (int i = 0; i < 3; i += 1) {
      rS[i] = 0;
      rN[i] = 0;
      rF[i] = -1e9;
      rI[i] = 0;
      rM[i] = 0;
      rP[i] = 0;
      rOld[i] = 0;
    }
    stD = p[P_stack];
    gl[GL_G] = p[P_glue];
    coefs();
    tp = {static_cast<double>(cf), 0, p[P_bpm] / 60 / sampleRate, false};
    tpLocked = false;
    rIdx = -1;
    rA = rnd.next() * 2 - 1;
    rB = nextRandom(rA, rnd);
    for (int j = 0; j < 3; j += 1) walkC[j][0] = walkC[j][1] = 0;
    // Les extensions : posees a leurs valeurs (comme sm), le hasard du LFO 2 d'une graine derivee (aucun tirage de rnd)
    xs.seed = (o.seed ^ 0x4C464F32u) * 0x9E3779B1u + rnd.st;
    xs.d1 = static_cast<int>(p[P_xl1Dest]);
    xs.d2 = static_cast<int>(p[P_l2Dest]);
    xs.a1 = xs.d1 != 0 ? p[P_xl1Amt] : 0;
    xs.a2 = xs.d2 != 0 ? p[P_l2Amt] : 0;
  }

  /** Tout ce qui depend du taux interne (sampleRate x os) : le constructeur et setOs. coefs() a part (les reglages). */
  void setRates() {
    sr2 = sampleRate * os;
    hasD8 = os == 8;
    hasD4 = os >= 4;
    hasD2 = os >= 2;
    odHp = jsm::exp((-2 * JS_PI * OD_HP_HZ) / sr2);
    odLp = 1 - jsm::exp((-2 * JS_PI * OD_TONE_HZ) / sr2);
    odDc = jsm::exp((-2 * JS_PI * OD_DC_HZ) / sr2);
    dcK = jsm::exp((-2 * JS_PI * OUT_DC_HZ) / sr2);
    ldDc = jsm::exp((-2 * JS_PI * LD_DC_HZ) / sr2);
    panK = coef(PAN_S, sr2);
    const double pg = jsm::tan((JS_PI * PRE_HZ) / sr2);
    preG = pg;
    preA1 = 1 / PRE_Q[0] + pg;
    preH1 = 1 / (1 + pg / PRE_Q[0] + pg * pg);
    preA2 = 1 / PRE_Q[1] + pg;
    preH2 = 1 / (1 + pg / PRE_Q[1] + pg * pg);
    preFc = PRE_HZ;
    stK = coef(STACK_S, sr2);
    lfoK = coef(0.002, sr2);
    smK = coef(0.015, sr2);
    smKr = coef(RAMP_SM_S, sr2);
  }

  // ------------------------------------------------------------------ QUALITY : le changement de taux (setOs)
  void requestOs(int want) {
    if (!(want == 1 || want == 2 || want == 4 || want == 8)) return;
    if (want == os) {
      osWant = 0;
      return;
    }
    if (osWant == 0) {
      osQuiet = 0;
      osWait = 0;
    }
    osWant = want;
    // Les voix se taisent comme sur un stop (12 ms) ; le taux change quand elles sont eteintes
    for (int i = 0; i < nv; i += 1) {
      Voice& v = voices[i];
      if (!v.on) continue;
      v.aStage = 3;
      v.fStage = 3;
      v.quick = true;
    }
  }
  /** Au debut d'un bloc de N : le taux change si les voix sont eteintes depuis 64 echantillons (ou 0.3 s passees). */
  void osTick(int N) {
    bool any = false;
    for (int i = 0; i < nv; i += 1)
      if (voices[i].on) any = true;
    const bool dcSmall = jsm::abs(dc[0]) + jsm::abs(dc[1]) + jsm::abs(dc[2]) + jsm::abs(dc[3]) <= 1e-4;
    if ((!any && dcSmall && osQuiet >= 64) || osWait >= 0.3 * sampleRate) {
      applyOs();
      return;
    }
    osQuiet = any ? 0 : osQuiet + N;
    osWait += N;
  }
  void applyOs() {
    os = osWant;
    osWant = 0;
    for (int i = 0; i < nv; i += 1) {
      Voice& v = voices[i];
      v.on = false;
      v.aV = 0;
      v.fV = 0;
      rest(v);
    }
    setRates();
    coefs();
    restBus();
    acc[0] = acc[1] = 0;
    d8.clear();
    d8R.clear();
    d4.clear();
    d4R.clear();
    d2.clear();
    d2R.clear();
    static const int RK[3] = {P_cutoff, P_res, P_envOct};
    for (int i = 0; i < 3; i += 1) {
      rT[i] = p[RK[i]];
      rS[i] = 0;
      rN[i] = 0;
      rF[i] = -1e9;
      rI[i] = 0;
      rM[i] = 0;
      rP[i] = 0;
    }
    outDrive = -1;
    xs.panL = xs.panR = 1;
    // La file : les notes a venir restent ; celles dont l'heure est passee pendant le silence partent maintenant
    // si leur gate court encore (raccourci d'autant), sinon elles sont retirees
    const double now = static_cast<double>(cf);
    const double sr = sampleRate;
    queue.keepIf([now, sr](NoteEv& e) {
      if (e.frame >= now) return true;
      const double end = e.frame + jsm::max(64, jsm::round(e.gate * sr));
      if (!(end > now + 64)) return false;
      e.gate = (end - now) / sr;
      e.frame = now;
      return true;
    });
  }
  /** Le LFO 2 entre dans le cycle c : ses deux valeurs au hasard (S&H, RND), par position. */
  void l2Cycle(double c2) {
    xs.idx2 = c2;
    const int64_t c = c2 > -9e15 && c2 < 9e15 ? static_cast<int64_t>(c2) : 0;
    int64_t a = c / X_ANCHOR * X_ANCHOR;
    if (a > c) a -= X_ANCHOR;
    double v = hashU(xs.seed, a) * 2 - 1;
    for (int64_t i = a + 1; i <= c; i += 1) v = nextRandomU(v, hashU(xs.seed, i));
    xs.rA2 = v;
    xs.rB2 = c + 1 == a + X_ANCHOR ? hashU(xs.seed, c + 1) * 2 - 1 : nextRandomU(v, hashU(xs.seed, c + 1));
  }
  static inline double lfo2Raw(double ph, int shape, double rA, double rB) {
    switch (shape) {
      case 1:
        return 1 - 4 * jsm::abs(ph - 0.5);
      case 2:
        return 1 - 2 * ph;
      case 3:
        return 2 * ph - 1;
      case 4:
        return ph < 0.5 ? 1 : -1;
      case 5:
        return rA;
      case 6:
        return rA + (rB - rA) * ph * ph * (3 - 2 * ph);
      default:
        return -jsm::cos(TAU * ph);
    }
  }

  // ------------------------------------------------------------------ messages
  void addBeat(double time, double beat, double bpmIn, bool run) {
    if (!jsm::isFinite(time) || !jsm::isFinite(beat)) return;
    const double bpm = jsm::isFinite(bpmIn) && bpmIn > 0 ? bpmIn : p[P_bpm];
    const double OS = os;
    const BeatEv a = {jsm::round(time * sampleRate * OS) / OS, beat, bpm / 60 / sampleRate, run};
    int i = beats.size();
    while (i > 0 && beats.at(i - 1).f > a.f) i -= 1;
    beats.insertAt(i, a);
  }
  void dueBeats(double x) {
    while (beats.size() > 0 && beats.at(0).f <= x) {
      const BeatEv a = beats.shift();
      tp = a;
      tpLocked = true;
      if (a.run) rIdx = -1;
    }
  }
  double beatAt(double x) const { return tp.b + (x - tp.f) * tp.k; }
  void freeRun(double x) {
    tp = {x, beatAt(x), p[P_bpm] / 60 / sampleRate, false};
    tpLocked = false;
  }
  double lfoRaw(double cyc, int shape) {
    const double cc = jsm::floor(cyc);
    if (cc != rIdx) {
      rIdx = cc;
      rA = rB;
      rB = nextRandom(rA, rnd);
    }
    const double ph = cyc - cc;
    switch (shape) {
      case 1:
        return 1 - 2 * ph;
      case 2:
        return ph < 0.5 ? 1 : -1;
      case 3:
        return rA;
      case 4:
        return rA + (rB - rA) * ph * ph * (3 - 2 * ph);
      default:
        return 1 - 4 * jsm::abs(ph - 0.5);
    }
  }
  void coefs() {
    const double sr = sr2;
    c.aAtk = coef(p[P_aA] / 1.466, sr);
    c.fAtk = coef(p[P_fA] / 1.466, sr);
    c.aDec = coef(p[P_aD] / 4.6, sr);
    c.fDec = coef(p[P_fD] / 4.6, sr);
    c.aRel = coef(p[P_aR] / 4.6, sr);
    c.fRel = coef(p[P_fR] / 4.6, sr);
    c.quick = coef(0.012, sr);
    c.glide = p[P_glide] > 0 ? coef(p[P_glide] / 3, sr) : 1;
  }
  void add(double time, double midi, double gate, double accent, double from) {
    if (!jsm::isFinite(midi) || !jsm::isFinite(time) || !(gate > 0)) return;
    const double ac = (accent == 0 || accent != accent) ? 1 : accent;  // n.accent || 1
    if (!jsm::isFinite(ac)) return;
    const double frame = jsm::round(time * sampleRate);
    int i = queue.size();
    while (i > 0 && queue.at(i - 1).frame > frame) i -= 1;
    const bool hf = jsm::isFinite(from);
    queue.insertAt(i, {frame, midi, gate, ac < 0 ? 0 : ac > 2 ? 2 : ac, hf ? from : 0, hf});
  }
  bool setParams(const ParamKV* src, int n) {
    bool bpm = false;
    for (int e = 0; e < n; e += 1) {
      const int key = src[e].id;
      const double v = src[e].value;
      if (key < 0 || key >= P_COUNT || !jsm::isFinite(v)) continue;
      const PDef& d = PDEFS[key];
      if (!d.isInt) {
        p[key] = v < d.lo ? d.lo : v > d.hi ? d.hi : v;
        if (key == P_bpm) bpm = true;
      } else {
        const double r = jsm::round(v);
        p[key] = r < d.lo ? d.lo : r > d.hi ? d.hi : r;
      }
    }
    return bpm;
  }
  void ramps(const double* old) {
    static const int RK[3] = {P_cutoff, P_res, P_envOct};
    const double fr = static_cast<double>(cf);
    for (int i = 0; i < 3; i += 1) {
      const double v = p[RK[i]];
      if (v == old[i]) continue;
      const double dt = fr - rF[i];
      rF[i] = fr;
      if (dt >= RAMP_MIN * sampleRate && dt <= RAMP_MAX * sampleRate) {
        const double ri = rI[i] > 0 ? rI[i] + 0.5 * (dt - rI[i]) : dt;
        rI[i] = ri;
        const int nn = static_cast<int>(jsm::max(1, jsm::round(ri * os)));
        const double pred = v + (RAMP_PRED * (v - old[i]) * ri) / dt;
        rS[i] = (pred - rT[i]) / nn;
        rN[i] = nn;
        rM[i] = nn;
        rP[i] = 1;
      } else {
        rT[i] = v;
        rN[i] = 0;
        rI[i] = 0;
        rP[i] = 0;
      }
    }
  }
  void msgParams(const ParamKV* kv, int n) {
    rOld[0] = p[P_cutoff];
    rOld[1] = p[P_res];
    rOld[2] = p[P_envOct];
    const bool bpm = setParams(kv, n);
    ramps(rOld);
    coefs();
    const bool stale = beats.size() == 0 && static_cast<double>(cf) - tp.f > sampleRate;
    if (bpm && (!tpLocked || stale)) freeRun(static_cast<double>(cf));
  }
  void msgCancel(double time) {
    const double t = (time == 0 || time != time) ? 0 : time;
    const double f = jsm::round(t * sampleRate);
    queue.keepIf([f](const NoteEv& e) { return e.frame < f; });
    beats.keepIf([f](const BeatEv& a) { return a.f < f - 0.5; });
  }
  void msgNoteOff(double midi, double time) {
    const double f = jsm::isFinite(time) ? jsm::round(time * sampleRate) : static_cast<double>(cf);
    for (int i = 0; i < nv; i += 1) {
      Voice& v = voices[i];
      if (v.on && v.midi == midi && v.aStage < 3) v.off = jsm::min(v.off, jsm::max(f, v.start + 64));
    }
    for (int i = 0; i < queue.size(); i += 1) {
      NoteEv& e = queue.at(i);
      if (e.midi == midi && e.frame <= f) e.gate = jsm::min(e.gate, jsm::max(64, f - e.frame) / sampleRate);
    }
  }
  void msgStop(double time) {
    const double t = (time == 0 || time != time) ? 0 : time;
    const double f = jsm::round(t * sampleRate);
    queue.keepIf([f](const NoteEv& e) { return e.frame < f; });
    dueBeats(static_cast<double>(cf));
    beats.clear();
    freeRun(static_cast<double>(cf));
    for (int i = 0; i < nv; i += 1) {
      Voice& v = voices[i];
      if (!v.on) continue;
      v.aStage = 3;
      v.fStage = 3;
      v.quick = true;
    }
  }

  // ------------------------------------------------------------------ notes
  void noteOn(const NoteEv& n, double frame) {
    Voice* v = nullptr;
    for (int i = 0; i < nv; i += 1) {
      Voice* x = &voices[i];
      if (!x->on) v = v && v->age < x->age ? v : x;
    }
    const bool fresh = v != nullptr;
    if (!v) {
      for (int i = 0; i < nv; i += 1)
        if (voices[i].aStage == 3 && (!v || voices[i].aV < v->aV)) v = &voices[i];
      if (!v)
        for (int i = 0; i < nv; i += 1)
          if (!v || voices[i].age < v->age) v = &voices[i];
    }
    if (fresh) {
      v->s1 = v->s2 = v->s3 = v->s4 = 0;
      v->pu = 0;
      v->aV = 0;
      v->fV = 0;
      LadderR& fr = v->fr;
      fr.pu = fr.s1 = fr.s2 = fr.s3 = fr.s4 = 0;
      for (int j = 0; j < MAX_STACK; j += 1) v->pr[j].sb = v->pr[j].sf = 0;
      for (int j = 0; j < VX_SIZE; j += 1) v->x[j] = 0;
    }
    v->g = 0;
    for (int j = 0; j < MAX_STACK; j += 1) {
      v->pr[j].q1 = QNAN;
      v->pr[j].q2 = QNAN;
    }
    const double target = jsm::log(midiHz(n.midi));
    v->logT = target;
    v->logf = p[P_glide] > 0 && n.hasFrom ? jsm::log(midiHz(n.from)) : target;
    v->midi = n.midi;
    v->d1 = 0;
    v->on = true;
    v->quick = false;
    v->aStage = 1;
    v->fStage = 1;
    v->off = frame + jsm::max(64, jsm::round(n.gate * sampleRate));
    v->start = frame;
    v->accent = n.accent;
    const double af = p[P_accFlt] > 0 ? jsm::min(1, p[P_accFlt]) : 0;
    const double acc = n.accent - 1;
    v->envAcc = jsm::max(0, 1 + ACC_ENV * af * acc);
    v->cutAcc = ACC_CUT * af * acc;
    v->fdm = 1 / jsm::max(0.5, 1 - (0.5 * af * jsm::max(0, acc)) / 0.24);
    v->ampAcc = af > 0 ? jsm::pow(jsm::max(1e-3, n.accent), 1 - 0.4 * af) : n.accent;
    const double an = jsm::max(1e-3, n.accent);
    v->accN = af > 0 && p[P_load] > 0 ? jsm::pow(an, 0.6 * af) : 1;
    const double lamN = af > 0 ? K35_LAM / jsm::pow(an, 0.3 * af) : K35_LAM;
    v->kLam = lamN;
    v->kIlam = 1 / lamN;
    const bool quiet = v->aV < PHASE_QUIET;
    const double phase = p[P_phase];
    if (phase >= 0 && quiet) {
      StackPair& P = v->pr[0];
      P.a = phase;
      P.b = phase;
      P.m = phase;
      v->subPh = phase;
    }
    const double dr = p[P_drift];
    const double vce = (rnd.next() - 0.5) * 0.08 * dr;
    v->vCutE = vce;
    v->vCut = jsm::pow(2, vce);
    v->vEnv = 1 + (rnd.next() - 0.5) * 0.1 * dr;
    v->vTune = (rnd.next() - 0.5) * 3 * dr;
    flip = !flip;
    const double pan = (flip ? 1 : -1) * p[P_width] * (0.7 + 0.3 * rnd.next());
    v->tL = jsm::cos(((pan + 1) * JS_PI) / 4) * JS_SQRT2;
    v->tR = jsm::sin(((pan + 1) * JS_PI) / 4) * JS_SQRT2;
    if (quiet) {
      v->gL = v->tL;
      v->gR = v->tR;
    }
    stackOn(*v, p[P_stack] > 0 ? maxStack : 1, quiet, phase);
    if (quiet) {
      if (sm.wide == 0 && sm.space == 0) v->wl = false;
      int busy = 0;
      for (int i = 0; i < nv; i += 1)
        if (voices[i].on && &voices[i] != v && voices[i].wideOK) busy += 1;
      v->wideOK = busy < wideVoices;
    }
    age += 1;
    v->age = age;
  }

  void stackOn(Voice& v, int n, bool quiet, double phase) {
    v.n = n;
    const double gt = n == 1 ? 1 : 1 / jsm::sqrt(n);
    const double* offs = STACK_OFF[n - 1];
    const double* pans = STACK_PAN[n - 1];
    int loop = 1;
    for (int j = 0; j < MAX_STACK; j += 1) {
      StackPair& P = v.pr[j];
      if (j < n) {
        if (!P.live) {
          P.a = rnd.next();
          P.b = rnd.next();
          P.m = rnd.next();
          P.live = true;
          P.g = 0;
        }
        if (j > 0 && phase >= 0 && quiet) {
          const double ph = phase + 0.37 * j;
          P.a = ph - jsm::floor(ph);
          P.b = P.a;
          P.m = P.a;
        }
        P.gt = gt;
        P.off = offs[j];
        P.r = P.off == 0 ? 1 : jsm::pow(2, (P.off * stD) / 1200);
        P.pan1 = n == 1 ? STACK_PAN1[0] : pans[j];
        P.pan2 = n == 1 ? STACK_PAN1[1] : pans[j];
      } else
        P.gt = 0;
      if (quiet) P.g = P.gt;
      if (P.gt > 0 || P.g > 1e-5) loop = j + 1;
    }
    v.nLoop = loop;
  }

  // ------------------------------------------------------------------ bus
  void busTick(int i2) {
    const double* LNC = tables().LNC;
    const double OD_TANH_BIAS = tables().OD_TANH_BIAS;
    const double OD_SECH2 = tables().OD_SECH2;
    double sum = acc[0];
    double sumR = acc[1];
    const double odGain = ks[KS_ODGAIN];
    const double odMix = ks[KS_ODMIX];
    const double odTrim = ks[KS_ODTRIM];
    const double clipT = ks[KS_CLIPT];
    const double clipW = ks[KS_CLIPW];
    const bool newNoise = ki[KI_NEWNOISE] == 1;
    const bool glueOn = ki[KI_GLUEON] == 1;
    const double vc = ks[KS_VSC];
    const double cl = (1 + 2 * vc) * vsc[0] - vc * (sum + vsc[1]);
    vsc[1] = vsc[0];
    vsc[0] = sum;
    const double cr = (1 + 2 * vc) * vsc[2] - vc * (sumR + vsc[3]);
    vsc[3] = vsc[2];
    vsc[2] = sumR;
    if (odMix > 1e-4) {
      const double hpA = odHp;
      const double lpA = odLp;
      const double dA = odDc;
      od[OD_HPL] = hpA * (od[OD_HPL] + sum - od[OD_XL]);
      od[OD_XL] = sum;
      const double hinL = 0.5 * (od[OD_HPL] + od[OD_PL]);
      od[OD_PL] = od[OD_HPL];
      const double uL = hinL * odGain;
      const bool fresh = od[OD_ON] == 0;
      if (fresh) {
        od[OD_UL] = uL;
        od[OD_FVL] = 0;
        od[OD_ON] = 1;
      }
      const double duL = uL - od[OD_UL];
      double yL;
      if (duL > OD_ADAA_EPS || duL < -OD_ADAA_EPS) {
        if (od[OD_FVL] == 0) {
          const double z1 = od[OD_UL] + OD_BIAS;
          const double a1 = z1 < 0 ? -z1 : z1;
          double F1 = a1 - LN2;
          if (a1 < LNC_MAX) F1 = lncTab(LNC, a1);
          od[OD_FIL] = F1 - od[OD_UL] * OD_TANH_BIAS;
        }
        const double zL = uL + OD_BIAS;
        const double aL = zL < 0 ? -zL : zL;
        double GL = aL - LN2;
        if (aL < LNC_MAX) GL = lncTab(LNC, aL);
        const double FL = GL - uL * OD_TANH_BIAS;
        yL = (FL - od[OD_FIL]) / duL;
        od[OD_FIL] = FL;
        od[OD_FVL] = 1;
      } else {
        const double mL = 0.5 * (uL + od[OD_UL]);
        yL = mL < OD_LIN_U && mL > -OD_LIN_U ? mL * OD_SECH2 * (1 - mL * OD_TANH_BIAS) : jsm::tanh(mL + OD_BIAS) - OD_TANH_BIAS;
        od[OD_FVL] = 0;
      }
      od[OD_UL] = uL;
      od[OD_LPL] += (yL - od[OD_LPL]) * lpA;
      od[OD_DL] = dA * (od[OD_DL] + od[OD_LPL] - od[OD_DXL]);
      od[OD_DXL] = od[OD_LPL];
      sum = (cl + od[OD_DL] * odMix) * odTrim;
      od[OD_HPR] = hpA * (od[OD_HPR] + sumR - od[OD_XR]);
      od[OD_XR] = sumR;
      const double hinR = 0.5 * (od[OD_HPR] + od[OD_PR]);
      od[OD_PR] = od[OD_HPR];
      const double uR = hinR * odGain;
      if (fresh) {
        od[OD_UR] = uR;
        od[OD_FVR] = 0;
      }
      const double duR = uR - od[OD_UR];
      double yR;
      if (duR > OD_ADAA_EPS || duR < -OD_ADAA_EPS) {
        if (od[OD_FVR] == 0) {
          const double z1 = od[OD_UR] + OD_BIAS;
          const double a1 = z1 < 0 ? -z1 : z1;
          double F1 = a1 - LN2;
          if (a1 < LNC_MAX) F1 = lncTab(LNC, a1);
          od[OD_FIR] = F1 - od[OD_UR] * OD_TANH_BIAS;
        }
        const double zR = uR + OD_BIAS;
        const double aR = zR < 0 ? -zR : zR;
        double GR = aR - LN2;
        if (aR < LNC_MAX) GR = lncTab(LNC, aR);
        const double FR = GR - uR * OD_TANH_BIAS;
        yR = (FR - od[OD_FIR]) / duR;
        od[OD_FIR] = FR;
        od[OD_FVR] = 1;
      } else {
        const double mR = 0.5 * (uR + od[OD_UR]);
        yR = mR < OD_LIN_U && mR > -OD_LIN_U ? mR * OD_SECH2 * (1 - mR * OD_TANH_BIAS) : jsm::tanh(mR + OD_BIAS) - OD_TANH_BIAS;
        od[OD_FVR] = 0;
      }
      od[OD_UR] = uR;
      od[OD_LPR] += (yR - od[OD_LPR]) * lpA;
      od[OD_DR] = dA * (od[OD_DR] + od[OD_LPR] - od[OD_DXR]);
      od[OD_DXR] = od[OD_LPR];
      sumR = (cr + od[OD_DR] * odMix) * odTrim;
    } else {
      od[OD_ON] = 0;
      sum = cl;
      sumR = cr;
    }
    double yl = sum * OUT_GAIN;
    double yr = sumR * OUT_GAIN;
    dc[0] = dcK * (dc[0] + yl - dc[1]);
    dc[1] = yl;
    yl = dc[0];
    dc[2] = dcK * (dc[2] + yr - dc[3]);
    dc[3] = yr;
    yr = dc[2];
    if (glueOn) {
      if (newNoise) {
        const double pg = ks[KS_GLUE];
        gl[GL_G] += (pg - gl[GL_G]) * glc[0];
        if (pg == 0 && gl[GL_G] < 1e-5) gl[GL_G] = 0;
        const double ms = 0.5 * (yl * yl + yr * yr);
        gl[GL_ENV] += (ms - gl[GL_ENV]) * (ms > gl[GL_ENV] ? glc[1] : glc[2]);
        if (gl[GL_ENV] > 1e-9) gl[GL_AVG] = gl[GL_AVG] <= 0 ? gl[GL_ENV] : gl[GL_AVG] + (gl[GL_ENV] - gl[GL_AVG]) * glc[3];
        const double over = LN_DB * jsm::log(gl[GL_ENV] + 1e-12) - gl[GL_THR];
        double gr = 0;
        if (over <= -GLUE_KNEE / 2)
          gr = 0;
        else if (over >= GLUE_KNEE / 2)
          gr = GLUE_SLOPE * over;
        else {
          const double t = over + GLUE_KNEE / 2;
          gr = (GLUE_SLOPE * t * t) / (2 * GLUE_KNEE);
        }
        gl[GL_GAIN] = jsm::exp((gl[GL_MK] - gr) * DB_LN);
        gl[GL_MIX] = gl[GL_G] >= 0.25 ? 1 : 4 * gl[GL_G];
      }
      const double zl = yl * gl[GL_GAIN];
      const double zr = yr * gl[GL_GAIN];
      double cl2 = 0;
      double cr2 = 0;
      const double gk = gl[GL_K];
      const double gw = gl[GL_W];
      for (int ch = 0; ch < 2; ch += 1) {
        double* gx = glX;
        const int io = ch == 0 ? 0 : 2;
        const double xg = ch == 0 ? zl : zr;
        const double x1 = gx[io];
        const double ax = xg < 0 ? -xg : xg;
        const double a1 = x1 < 0 ? -x1 : x1;
        double y;
        double F;
        if (ax <= gk && a1 <= gk) {
          y = 0.5 * (xg + x1);
          F = 0.5 * xg * xg;
        } else {
          if (ax <= gk)
            F = 0.5 * xg * xg;
          else {
            const double u = ax - gk;
            const double Fa = 0.5 * gk * gk + gk * u + 0.5 * u * u - (u * u * u) / (12 * gw);
            const double Fb = 0.5 * gk * gk + 2 * gk * gw + (4.0 / 3) * gw * gw + (gk + gw) * (u - 2 * gw);
            F = u < 2 * gw ? Fa : Fb;
          }
          const double d = xg - x1;
          if (d < 1e-7 && d > -1e-7) {
            const double xm = 0.5 * (xg + x1);
            const double am = xm < 0 ? -xm : xm;
            if (am <= gk)
              y = xm;
            else {
              const double u = am - gk;
              const double ya = gk + gw;
              const double yb = gk + u - (u * u) / (4 * gw);
              const double yy = u >= 2 * gw ? ya : yb;
              y = xm < 0 ? -yy : yy;
            }
          } else
            y = (F - gx[io + 1]) / d;
        }
        gx[io] = xg;
        gx[io + 1] = F;
        if (ch == 0)
          cl2 = y;
        else
          cr2 = y;
      }
      if (newNoise) {
        const double ga = glc[3];
        gl[GL_MI] += (zl * zl + zr * zr - gl[GL_MI]) * ga;
        gl[GL_MO] += (cl2 * cl2 + cr2 * cr2 - gl[GL_MO]) * ga;
      }
      cl2 *= gl[GL_GC];
      cr2 *= gl[GL_GC];
      yl += (cl2 - yl) * gl[GL_MIX];
      yr += (cr2 - yr) * gl[GL_MIX];
    }
    if (yl > clipT)
      yl = clipT + clipW * jsm::tanh((yl - clipT) / clipW);
    else if (yl < -clipT)
      yl = -clipT - clipW * jsm::tanh((-yl - clipT) / clipW);
    if (yr > clipT)
      yr = clipT + clipW * jsm::tanh((yr - clipT) / clipW);
    else if (yr < -clipT)
      yr = -clipT - clipW * jsm::tanh((-yr - clipT) / clipW);
    if (xs.panOn) {
      yl *= xs.panL;
      yr *= xs.panR;
    }
    if (!(yl - yl == 0 && yr - yr == 0)) {
      restBus();
      heals += 1;
      yl = 0;
      yr = 0;
    }
    raw[i2] = static_cast<float>(yl);
    rawR[i2] = static_cast<float>(yr);
  }

  void rest(Voice& v) {
    v.pu = v.s1 = v.s2 = v.s3 = v.s4 = 0;
    LadderR& fr = v.fr;
    fr.pu = fr.s1 = fr.s2 = fr.s3 = fr.s4 = fr.u = fr.y1 = fr.y2 = fr.y = 0;
    for (int j = 0; j < MAX_STACK; j += 1) v.pr[j].sb = v.pr[j].sf = 0;
    for (int j = 0; j < VX_SIZE; j += 1) v.x[j] = 0;
  }
  void restBus() {
    od[OD_HPL] = od[OD_XL] = od[OD_LPL] = od[OD_HPR] = od[OD_XR] = od[OD_LPR] = od[OD_DL] = od[OD_DXL] = od[OD_DR] = od[OD_DXR] = 0;
    od[OD_UL] = od[OD_FIL] = od[OD_UR] = od[OD_FIR] = od[OD_FVL] = od[OD_FVR] = od[OD_ON] = od[OD_PL] = od[OD_PR] = 0;
    dc[0] = dc[1] = dc[2] = dc[3] = 0;
    for (double& x : vsc) x = 0;
    gl[GL_ENV] = gl[GL_MI] = gl[GL_MO] = 0;
    gl[GL_GAIN] = 1;
    for (double& x : glX) x = 0;
  }
  static inline void tiny(double& x) {
    if (x < TINY && x > -TINY) x = 0;
  }
  void flushTiny() {
    tiny(sm.o1);
    tiny(sm.o2);
    tiny(sm.fm);
    tiny(sm.noise);
    tiny(sm.sub);
    tiny(sm.lfoAmt);
    tiny(sm.drive);
    tiny(sm.wide);
    tiny(sm.w1);
    tiny(sm.w2);
    tiny(sm.f1);
    tiny(sm.f2);
    tiny(sm.res);
    tiny(sm.envOct);
    for (int m = 0; m < 5; m += 1) tiny(wm[m]);
    tiny(lfoOut);
    tiny(xs.lfo2);
    for (int i = 0; i < nv; i += 1) {
      Voice& v = voices[i];
      if (!v.on) continue;
      if (v.aV < TINY) v.aV = 0;
      tiny(v.fV);
      tiny(v.s1);
      tiny(v.s2);
      tiny(v.s3);
      tiny(v.s4);
      tiny(v.pu);
      LadderR& fr = v.fr;
      tiny(fr.s1);
      tiny(fr.s2);
      tiny(fr.s3);
      tiny(fr.s4);
      tiny(fr.pu);
      tiny(fr.u);
      tiny(fr.y1);
      tiny(fr.y2);
      for (int j = 0; j < VX_SIZE; j += 1) tiny(v.x[j]);
    }
    tiny(od[OD_HPL]);
    tiny(od[OD_XL]);
    tiny(od[OD_LPL]);
    tiny(od[OD_DL]);
    tiny(od[OD_DXL]);
    tiny(od[OD_HPR]);
    tiny(od[OD_XR]);
    tiny(od[OD_LPR]);
    tiny(od[OD_DR]);
    tiny(od[OD_DXR]);
    tiny(od[OD_UL]);
    tiny(od[OD_UR]);
    tiny(od[OD_PL]);
    tiny(od[OD_PR]);
    for (int i = 0; i < 4; i += 1) tiny(dc[i]);
    for (int i = 0; i < 4; i += 1) tiny(vsc[i]);
    if (gl[GL_ENV] < TINY) gl[GL_ENV] = 0;
    if (gl[GL_MI] < TINY) gl[GL_MI] = 0;
    if (gl[GL_MO] < TINY) gl[GL_MO] = 0;
    for (int i = 0; i < 4; i += 1) tiny(glX[i]);
  }

  void driftStep(int N) {
    const double dtB = N / sampleRate;
    if (walkDt != dtB) {
      walkDt = dtB;
      for (int j = 0; j < 3; j += 1) {
        const double a = jsm::exp(-dtB / DRIFT_WALKS[j][0]);
        walkC[j][0] = a;
        walkC[j][1] = DRIFT_WALKS[j][1] * jsm::sqrt(1 - a * a) * 3.4641;
      }
    }
    int need = 0;
    for (int vi = 0; vi < nv; vi += 1)
      if (voices[vi].on) need += 2 * 3;
    rnd.fill(rndBuf, need);
    int ri = 0;
    for (int vi = 0; vi < nv; vi += 1) {
      Voice& v = voices[vi];
      if (!v.on) continue;
      for (int k = 0; k < 2; k += 1) {
        double d = 0;
        for (int j = 0; j < 3; j += 1) {
          double* w = v.walk[j];
          w[k] = w[k] * walkC[j][0] + (rndBuf[ri] - 0.5) * walkC[j][1];
          ri += 1;
          d += w[k];
        }
        v.drift[k] = d > DRIFT_MAX ? DRIFT_MAX : d < -DRIFT_MAX ? -DRIFT_MAX : d;
      }
    }
  }

  // ------------------------------------------------------------------ process (un bloc de N, N <= kMaxBlock)
  void processBlock(float* L, float* R, int N);
};

void Voyager::Impl::processBlock(float* L, float* R, int N) {
  const Tables& TB = tables();
  const double* LNC = TB.LNC;
  const double* K35_T = TB.K35_T;
  const double* K35_S = TB.K35_S;
  const double K35_TEND = TB.K35_TEND;
  const double K35_SLOPE = TB.K35_SLOPE;
  const double MS_SO = TB.MS_SO;
  const double sr = sr2;
  const double fadeA = FADE_HZ / sr;
  const double fadeK = sr / FADE_W;
  const double t0 = static_cast<double>(cf);
  auto& q = queue;
  const double lfoBeats = jsm::max(0.0625, p[P_lfoBeats]);
  if (osWant != 0) osTick(N);
  const bool osHold = osWant != 0;
  // Les extensions (LFO 1 seconde destination, LFO 2) : rien de tout cela ne tourne tant qu'elles sont a 0
  const int x1Want = static_cast<int>(p[P_xl1Dest]);
  const int l2Want = static_cast<int>(p[P_l2Dest]);
  const bool ext = x1Want != 0 || l2Want != 0 || xs.d1 != 0 || xs.d2 != 0 || xs.a1 != 0 || xs.a2 != 0;
  const double l2Beats = jsm::max(0.125, p[P_l2Beats]);
  const int l2Shape = static_cast<int>(p[P_l2Shape]);
  if (xs.stackDirty && xs.d1 != E_STACK && xs.d2 - 4 != E_STACK) {
    // STACK n'est plus module : les rapports exacts du moteur (la meme formule que stackOn)
    xs.stackDirty = false;
    for (int vi = 0; vi < nv; vi += 1) {
      Voice& v = voices[vi];
      for (int j = 0; j < MAX_STACK; j += 1) {
        StackPair& P = v.pr[j];
        P.r = P.off == 0 ? 1 : jsm::pow(2, (P.off * stD) / 1200);
      }
    }
  }
  if (!ext && xs.panOn) {
    xs.panOn = false;
    xs.panL = xs.panR = 1;
  }
  bool active = false;
  for (int i = 0; i < nv; i += 1)
    if (voices[i].on) active = true;
  const bool dcBusy = jsm::abs(dc[0]) + jsm::abs(dc[1]) + jsm::abs(dc[2]) + jsm::abs(dc[3]) > 1e-7;
  if (!active && !dcBusy && (q.size() == 0 || q.at(0).frame >= t0 + N)) {
    for (int i = 0; i < N; i += 1) L[i] = 0;
    if (R)
      for (int i = 0; i < N; i += 1) R[i] = 0;
    dc[0] = dc[1] = dc[2] = dc[3] = 0;
    if (gl[GL_ENV] > 0) gl[GL_ENV] = gl[GL_ENV] < 1e-15 ? 0 : gl[GL_ENV] * jsm::pow(1 - glR, N);
    for (double& x : glX) x = 0;
    flushTiny();
    if (hasD8) {
      d8.clear();
      d8R.clear();
    }
    if (hasD4) {
      d4.clear();
      d4R.clear();
    }
    if (hasD2) {
      d2.clear();
      d2R.clear();
    }
    const double x = t0 + N - 1;
    dueBeats(x);
    lfoOut = lfoRaw(beatAt(x) / lfoBeats, static_cast<int>(p[P_lfoShape]));
    if (ext) {
      // En silence : les destinations et les quantites posees, le LFO 2 a sa valeur de fin de bloc (comme le LFO 1)
      xs.d1 = x1Want;
      xs.d2 = l2Want;
      xs.a1 = x1Want != 0 ? p[P_xl1Amt] : 0;
      xs.a2 = l2Want != 0 ? p[P_l2Amt] : 0;
      if (l2Want != 0) {
        const double cyc2 = beatAt(x) / l2Beats;
        const double c2 = jsm::floor(cyc2);
        if (c2 != xs.idx2) l2Cycle(c2);
        xs.raw2 = lfo2Raw(cyc2 - c2, l2Shape, xs.rA2, xs.rB2);
        xs.lfo2 = xs.raw2;
      } else
        xs.lfo2 = 0;
    }
    return;
  }
  driftStep(N);
  const Coefs& cc = c;
  const double K = smK;
  const double nyq = sampleRate * 0.45;
  const double fcMax35 = jsm::min(nyq, os >= 4 ? MS_FC_MAX4 : MS_FC_MAX2);
  const int OS = os;
  float* rawL = raw.data();
  float* rawRp = rawR.data();
  if (os == 2) {
    double td = (sm.drive - PRE_OD0) / (PRE_OD1 - PRE_OD0);
    td = td <= 0 ? 0 : td >= 1 ? 1 : td * td * (3 - 2 * td);
    const double fcp = PRE_HZ - (PRE_HZ - PRE_OD_HZ) * td;
    if (fcp != preFc) {
      preFc = fcp;
      const double pg = jsm::tan((JS_PI * fcp) / sr2);
      preG = pg;
      preA1 = 1 / PRE_Q[0] + pg;
      preH1 = 1 / (1 + pg / PRE_Q[0] + pg * pg);
      preA2 = 1 / PRE_Q[1] + pg;
      preH2 = 1 / (1 + pg / PRE_Q[1] + pg * pg);
    }
  }
  const double preGv = preG;
  const double preA1v = preA1;
  const double preH1v = preH1;
  const double preA2v = preA2;
  const double preH2v = preH2;
  if (stD != p[P_stack]) {
    const double dd = p[P_stack] - stD;
    stD = dd < 1e-3 && dd > -1e-3 ? p[P_stack] : stD + dd * stDK;
    for (int vi = 0; vi < nv; vi += 1) {
      Voice& v = voices[vi];
      if (!v.on) continue;
      for (int j = 0; j < v.nLoop; j += 1) {
        StackPair& P = v.pr[j];
        P.r = P.off == 0 ? 1 : jsm::pow(2, (P.off * stD) / 1200);
      }
    }
  }
  const bool glueOn = p[P_glue] > 0 || gl[GL_G] > 0;
  if (glueOn) {
    gl[GL_THR] = GLUE_THR0 - GLUE_THR_SPAN * gl[GL_G];
    double mk = 0;
    if (gl[GL_AVG] > 0) {
      const double over = LN_DB * jsm::log(gl[GL_AVG]) - gl[GL_THR];
      if (over <= -GLUE_KNEE / 2)
        mk = 0;
      else if (over >= GLUE_KNEE / 2)
        mk = GLUE_SLOPE * over;
      else {
        const double t = over + GLUE_KNEE / 2;
        mk = (GLUE_SLOPE * t * t) / (2 * GLUE_KNEE);
      }
    }
    gl[GL_MK] = mk;
    const double r = gl[GL_MO] > 1e-12 ? jsm::sqrt(gl[GL_MI] / gl[GL_MO]) : 1;
    gl[GL_GC] = r < 1 ? 1 : r > 2 ? 2 : r;
    const double ceil = 1 / (1 + GLUE_DRIVE * gl[GL_G]);
    const double kk = GLUE_KNEE_AT * ceil;
    if (kk != gl[GL_K]) {
      gl[GL_K] = kk;
      gl[GL_W] = ceil - kk;
      glX[1] = glueClipF(glX[0], gl[GL_K], gl[GL_W]);
      glX[3] = glueClipF(glX[2], gl[GL_K], gl[GL_W]);
    }
  }
  const double lvl = p[P_outLevel] > 1e-6 ? p[P_outLevel] : 0;
  const double clipT = lvl > 0 ? CLIP_KNEE / lvl : INF;
  const double clipW = lvl > 0 ? (CLIP_CEIL - CLIP_KNEE) / lvl : 1;
  const int dest = static_cast<int>(p[P_lfoDest]);
  const int lfoShape = static_cast<int>(p[P_lfoShape]);
  const int fmode = static_cast<int>(p[P_fmode]);
  const double subDiv = p[P_subOct] == 2 ? 0.25 : 0.5;
  const int subW = p[P_subWave] == 1 ? 1 : p[P_subWave] == 3 ? 3 : 0;
  const double ratio1 = jsm::pow(2, p[P_tune1] / 12);
  const double ratio2 = jsm::pow(2, p[P_tune2] / 12);
  const double drift = p[P_drift];
  const bool sync = p[P_sync] == 1;
  const double fmB = os == 2 ? FM_B_PHONE : 0.4;
  const double pRatio = p[P_ratio];
  const double pAS = p[P_aS];
  const double pFS = p[P_fS];
  const double keyTrack = p[P_keyTrack];
  const bool fpolNeg = p[P_fpol] == 1;
  ks[KS_CLIPT] = clipT;
  ks[KS_CLIPW] = clipW;
  ki[KI_GLUEON] = glueOn ? 1 : 0;
  ks[KS_GLUE] = p[P_glue];
  for (int i2 = 0; i2 < OS * N; i2 += 1) {
    const int i = i2 / OS;
    const double fr = t0 + i;
    if (i2 % OS == 0 && !osHold)
      while (q.size() > 0 && q.at(0).frame <= fr) {
        const NoteEv ne = q.shift();
        noteOn(ne, fr);
      }
    const double x = fr + static_cast<double>(i2 - i * OS) / OS;
    if (beats.size() > 0 && beats.at(0).f <= x) dueBeats(x);
    const double pos = tp.b + (x - tp.f) * tp.k;
    const double cyc = pos / lfoBeats;
    const double cI = jsm::floor(cyc);
    if (cI != rIdx) {
      rIdx = cI;
      rA = rB;
      rB = nextRandom(rA, rnd);
    }
    const double lph = cyc - cI;
    double lraw;
    if (lfoShape == 1)
      lraw = 1 - 2 * lph;
    else if (lfoShape == 2)
      lraw = lph < 0.5 ? 1 : -1;
    else if (lfoShape == 3)
      lraw = rA;
    else if (lfoShape == 4)
      lraw = rA + (rB - rA) * lph * lph * (3 - 2 * lph);
    else
      lraw = 1 - 4 * jsm::abs(lph - 0.5);
    lfoOut += (lraw - lfoOut) * lfoK;
    sm.lfoAmt += (p[P_lfoAmt] - sm.lfoAmt) * K;
    const double lfo = lfoOut * sm.lfoAmt;
    double waveMod = dest == 0 ? 2 * lfo : dest == 4 ? lfo : 0;
    double cutMod = dest == 1 ? 3 * lfo : dest == 4 ? 1.5 * lfo : 0;
    double pitchMod = dest == 3 ? 100 * lfo : 0;
    const bool newNoise = i2 % OS == 0;
    // Les extensions : xmask, les destinations etendues modulees a cet echantillon (bit E_*), xm leur somme (les deux
    // LFO s'additionnent), en unites de LFO x quantite ; ampG le gain du tremolo. A 0 : rien de ce bloc ne tourne.
    int xmask = 0;
    double xm[E_COUNT];
    double ampG = 1;
    double fm2 = 0;
    bool fm2On = false;
    if (ext) {
      {
        const double tgt = xs.d1 == x1Want && x1Want != 0 ? p[P_xl1Amt] : 0;
        xs.a1 += (tgt - xs.a1) * K;
        if (tgt == 0 && xs.a1 < 1e-5) {
          // une destination ne change que quand sa quantite est revenue a 0 (aucun saut), au rythme du contexte
          xs.a1 = 0;
          if (newNoise) xs.d1 = x1Want;
        }
      }
      {
        const double tgt = xs.d2 == l2Want && l2Want != 0 ? p[P_l2Amt] : 0;
        xs.a2 += (tgt - xs.a2) * K;
        if (tgt == 0 && xs.a2 < 1e-5) {
          xs.a2 = 0;
          if (newNoise) xs.d2 = l2Want;
        }
      }
      for (int e = 0; e < E_COUNT; e += 1) xm[e] = 0;
      const int e1 = xs.d1;
      const int e2 = xs.d2 >= 5 ? xs.d2 - 4 : 0;
      xm[e1] += lfoOut * xs.a1;
      double depthAmp = e1 == E_AMP ? xs.a1 : 0;
      if (xs.d2 != 0) {
        // Le LFO 2 : sa forme au rythme du contexte (tenue), lissee 2 ms au taux interne comme le LFO 1
        if (newNoise) {
          const double cyc2 = pos / l2Beats;
          const double c2 = jsm::floor(cyc2);
          if (c2 != xs.idx2) l2Cycle(c2);
          xs.raw2 = lfo2Raw(cyc2 - c2, l2Shape, xs.rA2, xs.rB2);
        }
        xs.lfo2 += (xs.raw2 - xs.lfo2) * lfoK;
        const double l2 = xs.lfo2 * xs.a2;
        switch (xs.d2) {
          case 1:
            waveMod += 2 * l2;
            break;
          case 2:
            cutMod += 3 * l2;
            break;
          case 3:
            fm2 = 0.6 * l2;
            fm2On = true;
            break;
          case 4:
            pitchMod += 100 * l2;
            break;
          default:
            xm[e2] += l2;
            if (e2 == E_AMP) depthAmp += xs.a2;
            break;
        }
      }
      xmask = ((1 << e1) | (1 << e2)) & ~1;
      if (xmask & (1 << E_AMP)) {
        // AMP : un tremolo, du plein niveau (LFO en haut) jusqu'a -100 % (LFO en bas, quantite 1)
        const double gA = 1 - 0.5 * depthAmp + 0.5 * xm[E_AMP];
        ampG = gA < 0 ? 0 : gA > 1 ? 1 : gA;
      }
      if (newNoise) {
        if (xmask & (1 << E_PAN)) {
          // PAN : a puissance constante (la loi des voix : 1 au centre, 0 et racine de 2 aux bords)
          const double pv = xm[E_PAN] < -1 ? -1 : xm[E_PAN] > 1 ? 1 : xm[E_PAN];
          xs.panL = jsm::cos(((pv + 1) * JS_PI) / 4) * JS_SQRT2;
          xs.panR = jsm::sin(((pv + 1) * JS_PI) / 4) * JS_SQRT2;
          xs.panOn = true;
        } else if (xs.panOn) {
          xs.panOn = false;
          xs.panL = xs.panR = 1;
        }
      }
    }
    const bool xAmp = (xmask & (1 << E_AMP)) != 0;
    const bool xStack = (xmask & (1 << E_STACK)) != 0;
    const double pitchMod2 = (xmask & (1 << E_O2PITCH)) != 0 ? pitchMod + X_O2_CENTS * xm[E_O2PITCH] : pitchMod;
    double stackX = 0;
    if (xStack && newNoise) {
      const double sv = stD + X_STACK * xm[E_STACK];
      const double hi = stD > X_STACK_MAX ? stD : X_STACK_MAX;
      stackX = ((sv < 0 ? 0 : sv > hi ? hi : sv) * JS_LN2) / 1200;
      xs.stackDirty = true;
    }
    sm.fm += (p[P_fm] - sm.fm) * K;
    double fmEff = dest == 2 ? jsm::min(1, jsm::max(0, sm.fm + 0.6 * lfo)) : sm.fm;
    if (fm2On) fmEff = jsm::min(1, jsm::max(0, (dest == 2 ? sm.fm + 0.6 * lfo : sm.fm) + fm2));
    const double fmDepth = fmEff * fmEff * FM_MAX;
    sm.noise += (p[P_noise] - sm.noise) * K;
    double nGain = sm.noise * sm.noise * NOISE_MAX;
    if (xmask & (1 << E_NOISE)) {
      const double nv2 = sm.noise + X_NOISE * xm[E_NOISE];
      const double hi = sm.noise > 1 ? sm.noise : 1;
      const double nc = nv2 < 0 ? 0 : nv2 > hi ? hi : nv2;
      nGain = nc * nc * NOISE_MAX;
    }
    sm.sub += (p[P_sub] - sm.sub) * K;
    double g3 = sm.sub;
    if (xmask & (1 << E_SUB)) {
      const double sv = sm.sub + X_SUB * xm[E_SUB];
      const double hi = sm.sub > X_SUB ? sm.sub : X_SUB;
      g3 = sv < 0 ? 0 : sv > hi ? hi : sv;
    }
    for (int m = 0; m < 5; m += 1) wm[m] += ((m == fmode ? 1 : 0) - wm[m]) * K;
    sm.w1 += (p[P_wave1] - sm.w1) * K;
    sm.w2 += (p[P_wave2] - sm.w2) * K;
    const double pw1 = jsm::min(5, jsm::max(0, sm.w1 + waveMod));
    const double pw2 = jsm::min(4, jsm::max(0, sm.w2 + 0.8 * waveMod));
    const int i1 = static_cast<int>(jsm::min(4, jsm::floor(pw1)));
    const double f1m = pw1 - i1;
    const int i2w = static_cast<int>(jsm::min(3, jsm::floor(pw2)));
    const double f2m = pw2 - i2w;
    const bool pwm1 = i1 == 3 && f1m > 1e-4;
    const bool pwm2 = i2w == 3 && f2m > 1e-4;
    const double pwd1 = pwm1 ? pwOf(3, f1m) : 0.5;
    const double pwd2 = pwm2 ? pwOf(3, f2m) : 0.5;
    sm.o1 += (p[P_osc1] - sm.o1) * K;
    sm.o2 += (p[P_osc2] - sm.o2) * K;
    double g1 = sm.o1;
    double g2 = sm.o2;
    if (xmask & (1 << E_OSCMIX)) {
      // OSC MIX : la balance (LFO en haut : OSC 2 seul ; en bas : OSC 1 seul ; aucun des deux ne monte)
      const double b = xm[E_OSCMIX] < -1 ? -1 : xm[E_OSCMIX] > 1 ? 1 : xm[E_OSCMIX];
      if (b > 0)
        g1 *= 1 - b;
      else
        g2 *= 1 + b;
    }
    sm.f1 += (p[P_fine1] - sm.f1) * K;
    sm.f2 += (p[P_fine2] - sm.f2) * K;
    const double fine1 = sm.f1;
    const double fine2 = sm.f2;
    {
      static const int RK[3] = {P_cutoff, P_res, P_envOct};
      for (int r = 0; r < 3; r += 1) {
        if (rN[r] > 0) {
          rN[r] -= 1;
          if (rN[r] == 0) {
            if (rP[r] == 1) {
              rP[r] = 2;
              rN[r] = rM[r];
              rS[r] = (p[RK[r]] - rT[r]) / rM[r];
              rT[r] += rS[r];
            } else {
              rP[r] = 0;
              rT[r] = p[RK[r]];
            }
          } else
            rT[r] += rS[r];
        }
      }
    }
    const double Kr = smKr;
    sm.cutoff += (rT[0] - sm.cutoff) * (rP[0] != 0 ? Kr : K);
    sm.res += (rT[1] - sm.res) * (rP[1] != 0 ? Kr : K);
    sm.envOct += (rT[2] - sm.envOct) * (rP[2] != 0 ? Kr : K);
    sm.drive += (p[P_drive] - sm.drive) * K;
    double resV = sm.res;
    if (xmask & (1 << E_RES)) {
      const double rv = sm.res + X_RES * xm[E_RES];
      const double hi = sm.res > 1 ? sm.res : 1;
      resV = rv < 0 ? 0 : rv > hi ? hi : rv;
    }
    double envV = sm.envOct;
    if (xmask & (1 << E_ENV)) {
      const double ev = sm.envOct + X_ENV * xm[E_ENV];
      const double hi = sm.envOct > X_ENV_MAX ? sm.envOct : X_ENV_MAX;
      envV = ev < 0 ? 0 : ev > hi ? hi : ev;
    }
    double drv = sm.drive;
    if (xmask & (1 << E_DRIVE)) {
      // DRIVE : au rythme du contexte (une puissance par valeur)
      if (newNoise) {
        const double dv2 = sm.drive + X_DRIVE * xm[E_DRIVE];
        const double hi = sm.drive > 1 ? sm.drive : 1;
        xs.drv = dv2 < 0 ? 0 : dv2 > hi ? hi : dv2;
      }
      drv = xs.drv;
    }
    if (sm.wide != p[P_wide]) {
      sm.wide += (p[P_wide] - sm.wide) * K;
      if (p[P_wide] == 0 && sm.wide < 1e-4) sm.wide = 0;
    }
    const bool wideOn = sm.wide > 0;
    if (sm.space != p[P_space]) {
      sm.space += (p[P_space] - sm.space) * K;
      if (p[P_space] == 0 && sm.space < 1e-4) sm.space = 0;
    }
    const bool spOn = sm.space > 0;
    if (spOn && sm.space != spLast) {
      spLast = sm.space;
      spF = jsm::pow(2, sm.space * (1.25 - 0.25 * sm.space));
      spI = 1 / spF;
    }
    const double spFv = spF;
    const double spIv = spI;
    const double spXf = spOn ? SP_XF * (sm.space >= 0.1 ? 1 : sm.space / 0.1) : 0;
    if (sm.load != p[P_load]) {
      sm.load += (p[P_load] - sm.load) * K;
      if (p[P_load] == 0 && sm.load < 1e-4) sm.load = 0;
    }
    const double ldL = sm.load;
    const bool ldOn = ldL > 0;
    double ldG = 1;
    double ldB = 0;
    double ldWet = 0;
    double ldMkv = 1;
    double ldYbv = 0;
    double ldRel = 1;
    if (ldOn) {
      ldG = 1 + 4 * ldL * ldL;
      ldB = LD_BIAS * ldL;
      ldWet = ldL >= 0.05 ? 1 : ldL / 0.05;
      if (ldL != ldLast) {
        ldLast = ldL;
        ldMk = jsm::pow(ldG, -LD_MK);
        ldYb = LD_S * jsm::tanh(ldB * LD_IS);
      }
      ldMkv = ldMk;
      ldYbv = ldYb;
      double tRel = (ldL - LD_REL0) / (LD_REL1 - LD_REL0);
      tRel = tRel <= 0 ? 0 : tRel >= 1 ? 1 : tRel * tRel * (3 - 2 * tRel);
      ldRel = 1 - 0.7 * tRel;
    }
    double pn1 = STACK_PAN1[0];
    double pn2 = STACK_PAN1[1];
    double pn2w = STACK_PAN2[0];
    const double a1 = wideOn ? g1 * g1 * (pwm1 ? 4 * pwd1 * (1 - pwd1) : f1m > 1e-4 ? WAVE_POW[i1] + (WAVE_POW[i1 + 1] - WAVE_POW[i1]) * f1m : WAVE_POW[i1]) : 0;
    const double a2 = wideOn ? g2 * g2 * (pwm2 ? 4 * pwd2 * (1 - pwd2) : f2m > 1e-4 ? WAVE_POW[i2w] + (WAVE_POW[i2w + 1] - WAVE_POW[i2w]) * f2m : WAVE_POW[i2w]) : 0;
    if (a1 != a2) {
      const double am = a1 > a2 ? a1 : a2;
      if (am > 1e-12) {
        pn1 = (STACK_PAN1[0] * a2) / am;
        pn2 = (STACK_PAN1[1] * a1) / am;
        pn2w = (a1 * pn1 * pn1 + a2 * pn2 * pn2) / (a1 + a2);
      } else
        pn1 = pn2 = pn2w = 0;
    }
    const double k = resK(resV);
    const double kTune = k > 4 ? (K_COMP * (k - 4)) / 1200 : 0;
    const double driveIn = 1 + 2.5 * drv;
    const double driveOut = 1 + 1.5 * drv;
    if (drv != outDrive) {
      outDrive = drv;
      outNorm = 1 / jsm::pow(driveOut, 0.82);
    }
    const double outNormv = outNorm;
    const double dO = ldOn ? driveOut * ldRel : driveOut;
    const double oN = ldOn ? outNormv / ldRel : outNormv;
    const double odGain = 1 + OD_GAIN * drv * drv;
    const double odMix = OD_MIX * jsm::min(1, drv * 4);
    double odTrim = 1;
    if (odMix > 1e-4) {
      const double dv = drv;
      double oc = 1;
      if (dv > 0) {
        oc = OD_COMP[5];
        for (int ci = 1; ci < 6; ci += 1) {
          if (dv <= OD_COMP_AT[ci]) {
            const double t = (dv - OD_COMP_AT[ci - 1]) / (OD_COMP_AT[ci] - OD_COMP_AT[ci - 1]);
            oc = OD_COMP[ci - 1] + (OD_COMP[ci] - OD_COMP[ci - 1]) * t;
            break;
          }
        }
      }
      odTrim = oc / (1 + OD_TRIM * drv);
    }
    const double keep = 1 + k * BASS_KEEP;
    const double w0 = wm[0] > 1e-4 ? wm[0] * keep : 0;
    const double w1 = wm[1] > 1e-4 ? (wm[1] * keep) / (1 + k * SLOPE12_RES) : 0;
    const double w2 = wm[2] > 1e-4 ? (wm[2] * 2 * BP_GAIN) / (1 + k * BP_RES) : 0;
    const double w3 = wm[3] > 1e-4 ? (wm[3] * HP_GAIN) / (1 + k * HP_RES) : 0;
    double w4 = wm[4] > 1e-4 ? wm[4] * MS_GAIN : 0;
    const bool ladOn = w0 != 0 || w1 != 0 || w2 != 0 || w3 != 0;
    double kap = 0;
    double c35o = 0;
    double sB7 = 1;
    if (w4 != 0) {
      const double rr = resV;
      if (rr >= 1)
        kap = MS_KAPPA[7];
      else if (rr > 0) {
        int mi = 1;
        while (mi < 7 && rr > MS_RES_AT[mi]) mi += 1;
        kap = MS_KAPPA[mi - 1] + ((MS_KAPPA[mi] - MS_KAPPA[mi - 1]) * (rr - MS_RES_AT[mi - 1])) / (MS_RES_AT[mi] - MS_RES_AT[mi - 1]);
      }
      if (kap > 1) c35o = (C35 * (kap - 1) * (kap - 1)) / 1200;
      double tb7 = (kap - 0.7) / 0.3;
      tb7 = tb7 <= 0 ? 0 : tb7 >= 1 ? 1 : tb7 * tb7 * (3 - 2 * tb7);
      sB7 = 1 - 0.75 * tb7;
      if (kap > 1) w4 *= 1 + MS_SO * (1 - jsm::exp((1 - kap) / MS_SO_TAU));
    }
    const double KK = (7.0 / 3) * kap;
    double omK = (kap - 0.93) / 0.04;
    omK = omK <= 0 ? 0 : omK >= 1 ? 1 : omK * omK * (3 - 2 * omK);
    const bool k35x2 = OS == 2 && kap > MS_X2_K;
    ks[KS_ODGAIN] = odGain;
    ks[KS_ODMIX] = odMix;
    ks[KS_ODTRIM] = odTrim;
    ks[KS_VSC] = ldOn ? VS_COMP * (1 + ldWet) : VS_COMP;
    ki[KI_NEWNOISE] = newNoise ? 1 : 0;
    double sum = 0;
    double sumR = 0;
    for (int vi = 0; vi < nv; vi += 1) {
      Voice& v = voices[vi];
      if (!v.on) continue;
      if (v.aStage < 3 && fr >= v.off) {
        v.aStage = 3;
        v.fStage = 3;
      }
      const double ve = v.vEnv;
      if (v.aStage == 1) {
        v.aV += (1.3 - v.aV) * cc.aAtk * ve;
        if (v.aV >= 1) {
          v.aV = 1;
          v.aStage = 2;
        }
      } else if (v.aStage == 2)
        v.aV += (pAS - v.aV) * cc.aDec * ve;
      else {
        v.aV -= v.aV * (v.quick ? cc.quick : cc.aRel * ve);
        if (v.aV < VOICE_OFF) {
          v.on = false;
          rest(v);
          continue;
        }
      }
      if (v.fStage == 1) {
        v.fV += (1.3 - v.fV) * cc.fAtk * ve;
        if (v.fV >= 1) {
          v.fV = 1;
          v.fStage = 2;
        }
      } else if (v.fStage == 2)
        v.fV += (pFS - v.fV) * jsm::min(1, cc.fDec * ve * v.fdm);
      else
        v.fV -= v.fV * cc.fRel * ve;
      v.logf += (v.logT - v.logf) * cc.glide;
      if (newNoise || v.d1 == 0) {
        const double f = jsm::exp(v.logf);
        v.d1 = (f * ratio1 * jsm::pow(2, ((v.drift[0] + v.calT[0]) * drift + fine1 + v.vTune + pitchMod) / 1200)) / sr;
        v.d2 = (f * ratio2 * jsm::pow(2, ((v.drift[1] + v.calT[1]) * drift + fine2 + v.vTune + pitchMod2) / 1200)) / sr;
        v.d3 = (v.d1 * subDiv) / ratio1;
      }
      if (xStack && newNoise)
        for (int j = 0; j < v.nLoop; j += 1) {
          StackPair& P = v.pr[j];
          P.r = P.off == 0 ? 1 : expSmall(P.off * stackX);
        }
      const double d1v = v.d1;
      const double d2v = v.d2;
      const int nl = v.nLoop;
      StackPair* pr = v.pr;
      const bool wideV = v.wideOK && (wideOn || spOn || v.wl);
      const double wide = wideV ? sm.wide : 0;
      const bool spW = spOn && wideV;
      const bool one = v.n == 1;
      const double wn = wideV ? 1 / jsm::sqrt(1 + wide * wide * (one ? pn2w : STACK_PAN2[v.n - 1])) : 1;
      double o = 0;
      double oR = 0;
      for (int j = 0; j < nl; j += 1) {
        StackPair& P = pr[j];
        const double d1 = d1v * P.r;
        const double d2 = d2v * P.r;
        const double dm = d1 * pRatio;
        const double idx = fmDepth > 0 ? jsm::min(fmDepth * (0.35 + 0.65 * jsm::min(1, v.fV)), jsm::max(0, fmB / dm - 1)) : 0;
        const double pm = idx > 0 ? (idx * jsm::sin(TAU * P.m)) / TAU : 0;
        double q2 = P.b + pm;
        q2 -= jsm::floor(q2);
        double p1 = P.a + pm;
        p1 -= jsm::floor(p1);
        const bool fmOn = pm != 0 && P.q1 == P.q1;
        double dt1 = d1;
        double dt2 = d2;
        if (fmOn) {
          double dd = p1 - P.q1;
          if (dd < -0.5)
            dd += 1;
          else if (dd > 0.5)
            dd -= 1;
          if (dd < 0) dd = -dd;
          dt1 = dd < 1e-5 ? 1e-5 : dd > 0.5 ? 0.5 : dd;
          if (!sync) {
            dd = q2 - P.q2;
            if (dd < -0.5)
              dd += 1;
            else if (dd > 0.5)
              dd -= 1;
            if (dd < 0) dd = -dd;
            dt2 = dd < 1e-5 ? 1e-5 : dd > 0.5 ? 0.5 : dd;
          }
        }
        P.q1 = p1;
        P.q2 = q2;
        double o2 = 0;
        const bool rs = P.sf == 1;
        P.sf = 0;
        for (int s = 0; s < 2; s += 1) {
          if (s == 1 && !(f2m > 1e-4 && !pwm2)) break;
          const int w = i2w + s;
          double y;
          if (!pwm2 && w == 0)
            y = jsm::sin(TAU * q2);
          else if (!pwm2 && w == 1) {
            double qq = q2 + 0.25;
            if (qq >= 1) qq -= 1;
            y = 1 - 4 * jsm::abs(qq - 0.5);
            const double kb = (8 * dt2) / 6;
            double xb = qq / dt2;
            if (xb < 1) {
              const double ub = 1 - xb;
              y += kb * ub * ub * ub;
            }
            xb = (1 - qq) / dt2;
            if (xb < 1) {
              const double ub = 1 - xb;
              y += kb * ub * ub * ub;
            }
            xb = (qq - 0.5) / dt2;
            if (xb > -1 && xb < 1) {
              const double ub = 1 - (xb < 0 ? -xb : xb);
              y -= kb * ub * ub * ub;
            }
          } else if (!pwm2 && w == 2) {
            double pb = 0;
            if (q2 < dt2) {
              if (!rs) {
                const double xx = q2 / dt2;
                pb = xx + xx - xx * xx - 1;
              }
            } else if (q2 > 1 - dt2) {
              const double xx = (q2 - 1) / dt2;
              pb = xx * xx + xx + xx + 1;
            }
            y = 1 - 2 * q2 + pb;
          } else {
            const double d = pwm2 ? pwd2 : w == 3 ? 0.5 : PULSE_W;
            y = q2 < d ? 1 : -1;
            if (q2 < dt2) {
              if (!rs) {
                const double xx = q2 / dt2;
                y += xx + xx - xx * xx - 1;
              }
            } else if (q2 > 1 - dt2) {
              const double xx = (q2 - 1) / dt2;
              y += xx * xx + xx + xx + 1;
            }
            double t2 = q2 - d;
            if (t2 < 0) t2 += 1;
            if (t2 < dt2) {
              const double xx = t2 / dt2;
              y -= xx + xx - xx * xx - 1;
            } else if (t2 > 1 - dt2) {
              const double xx = (t2 - 1) / dt2;
              y -= xx * xx + xx + xx + 1;
            }
            y -= 2 * d - 1;
          }
          if (s == 0)
            o2 = y;
          else
            o2 += (y - o2) * f2m;
        }
        if (P.sb != 0) {
          o2 += P.sb;
          P.sb = 0;
        }
        if (sync && P.a + d1 >= 1 && pm == 0) {
          const double frac = (P.a + d1 - 1) / d1;
          const double tm = 1 - frac;
          double e = q2 + d2 * tm;
          e -= jsm::floor(e);
          double cNow = 0;
          double cNext = 0;
          const int passes = (pwm2 || !(f2m > 1e-4)) ? 1 : 2;
          for (int pass = 0; pass < passes; pass += 1) {
            const int w = pwm2 ? 3 : i2w + pass;
            const double d = pwm2 ? pwd2 : w == 4 ? PULSE_W : 0.5;
            double r1;
            double r0 = 0;
            double cn = 0;
            double cx = 0;
            if (w == 0)
              r1 = jsm::sin(TAU * e);
            else if (w == 1) {
              double qb = e + 0.25;
              if (qb >= 1) qb -= 1;
              r1 = 1 - 4 * jsm::abs(qb - 0.5);
            } else {
              r0 = 1;
              r1 = w == 2 ? 1 - 2 * e : e < d ? 1 : -1;
              if (q2 > 1 - d2) {
                const double t = (1 - q2) / d2;
                if (t < tm)
                  cx -= t * t;
                else {
                  const double u = 1 - t;
                  cn -= u * u;
                }
              }
              if (w >= 3) {
                double t2 = q2 - d;
                if (t2 < 0) t2 += 1;
                if (t2 > 1 - d2) {
                  const double t = (1 - t2) / d2;
                  if (t < tm)
                    cx += t * t;
                  else {
                    const double u = 1 - t;
                    cn += u * u;
                  }
                }
              }
            }
            const double h = r0 - r1;
            cn += 0.5 * h * frac * frac;
            cx -= 0.5 * h * tm * tm;
            if (pass == 0) {
              cNow = cn;
              cNext = cx;
            } else {
              cNow += (cn - cNow) * f2m;
              cNext += (cx - cNext) * f2m;
            }
          }
          o2 += cNow;
          P.sb = cNext;
          P.sf = 1;
        } else if (sync && P.a + d1 >= 1) {
          const double frac = (P.a + d1 - 1) / d1;
          double e = P.b + d2 * (1 - frac);
          e -= jsm::floor(e);
          const double e0 = pm - jsm::floor(pm);
          double e1 = e + pm;
          e1 -= jsm::floor(e1);
          double h = 0;
          double nat = 0;
          const int passes = (pwm2 || !(f2m > 1e-4)) ? 1 : 2;
          for (int pass = 0; pass < passes; pass += 1) {
            const int w = pwm2 ? 3 : i2w + pass;
            const double d = pwm2 ? pwd2 : w == 4 ? PULSE_W : 0.5;
            double r0;
            double r1;
            if (w == 0) {
              r0 = jsm::sin(TAU * e0);
              r1 = jsm::sin(TAU * e1);
            } else if (w == 1) {
              double qa = e0 + 0.25;
              if (qa >= 1) qa -= 1;
              r0 = 1 - 4 * jsm::abs(qa - 0.5);
              double qb = e1 + 0.25;
              if (qb >= 1) qb -= 1;
              r1 = 1 - 4 * jsm::abs(qb - 0.5);
            } else if (w == 2) {
              r0 = 1 - 2 * e0;
              r1 = 1 - 2 * e1;
            } else {
              r0 = e0 < d ? 1 : -1;
              r1 = e1 < d ? 1 : -1;
            }
            const double ns = pwm2 || w >= 2 ? 2 : 0;
            if (pass == 0) {
              h = r0 - r1;
              nat = ns;
            } else {
              h += (r0 - r1 - h) * f2m;
              nat += (ns - nat) * f2m;
            }
          }
          if (pm != 0) nat = 0;
          o2 += 0.5 * h * frac * frac;
          const double r = 1 - frac;
          P.sb = -0.5 * (h - nat) * r * r;
        }
        double o1 = 0;
        for (int s = 0; s < 2; s += 1) {
          if (s == 1 && !(f1m > 1e-4 && !pwm1)) break;
          const int w = i1 + s;
          double y;
          if (!pwm1 && w == 0)
            y = jsm::sin(TAU * p1);
          else if (!pwm1 && w == 1) {
            double qq = p1 + 0.25;
            if (qq >= 1) qq -= 1;
            y = 1 - 4 * jsm::abs(qq - 0.5);
            const double kb = (8 * dt1) / 6;
            double xb = qq / dt1;
            if (xb < 1) {
              const double ub = 1 - xb;
              y += kb * ub * ub * ub;
            }
            xb = (1 - qq) / dt1;
            if (xb < 1) {
              const double ub = 1 - xb;
              y += kb * ub * ub * ub;
            }
            xb = (qq - 0.5) / dt1;
            if (xb > -1 && xb < 1) {
              const double ub = 1 - (xb < 0 ? -xb : xb);
              y -= kb * ub * ub * ub;
            }
          } else if (!pwm1 && w == 2) {
            double pb = 0;
            if (p1 < dt1) {
              const double xx = p1 / dt1;
              pb = xx + xx - xx * xx - 1;
            } else if (p1 > 1 - dt1) {
              const double xx = (p1 - 1) / dt1;
              pb = xx * xx + xx + xx + 1;
            }
            y = 1 - 2 * p1 + pb;
          } else if (!pwm1 && w == 5)
            y = jsm::sin(TAU * (P.a + FM_INDEX * o2 * 0.16 + pm));
          else {
            const double d = pwm1 ? pwd1 : w == 3 ? 0.5 : PULSE_W;
            y = p1 < d ? 1 : -1;
            if (p1 < dt1) {
              const double xx = p1 / dt1;
              y += xx + xx - xx * xx - 1;
            } else if (p1 > 1 - dt1) {
              const double xx = (p1 - 1) / dt1;
              y += xx * xx + xx + xx + 1;
            }
            double t2 = p1 - d;
            if (t2 < 0) t2 += 1;
            if (t2 < dt1) {
              const double xx = t2 / dt1;
              y -= xx + xx - xx * xx - 1;
            } else if (t2 > 1 - dt1) {
              const double xx = (t2 - 1) / dt1;
              y -= xx * xx + xx + xx + 1;
            }
            y -= 2 * d - 1;
          }
          if (s == 0)
            o1 = y;
          else
            o1 += (y - o1) * f1m;
        }
        P.a += d1;
        P.b += d2;
        if (P.a >= 1) {
          P.a -= 1;
          if (sync) P.b = (P.a / d1) * d2;
        }
        if (P.b >= 1) P.b -= jsm::floor(P.b);
        P.m += dm;
        P.m -= jsm::floor(P.m);
        if (d1 > fadeA) {
          double tf = (d1 - fadeA) * fadeK;
          tf = tf >= 1 ? 1 : tf;
          o1 *= 1 - tf * tf * (3 - 2 * tf);
        }
        if (d2 > fadeA) {
          double tf = (d2 - fadeA) * fadeK;
          tf = tf >= 1 ? 1 : tf;
          o2 *= 1 - tf * tf * (3 - 2 * tf);
        }
        double gj = 1;
        if (P.g != P.gt) {
          P.g += (P.gt - P.g) * stK;
          if (P.g - P.gt < 1e-5 && P.gt - P.g < 1e-5) P.g = P.gt;
        }
        if (nl != 1 || P.g != 1) gj = P.g;
        if (wide != 0) {
          const double s1 = g1 * o1 * gj * wn;
          const double s2 = g2 * o2 * gj * wn;
          const double c1 = one && j == 0 ? pn1 : P.pan1;
          const double c2 = one && j == 0 ? pn2 : P.pan2;
          o += s1 * (1 - wide * c1) + s2 * (1 - wide * c2);
          oR += s1 * (1 + wide * c1) + s2 * (1 + wide * c2);
        } else if (j == 0)
          o = gj == 1 ? g1 * o1 + g2 * o2 : gj * (g1 * o1 + g2 * o2);
        else
          o += gj * (g1 * o1 + g2 * o2);
      }
      if (nl > 1 && pr[nl - 1].gt == 0 && pr[nl - 1].g == 0) v.nLoop = nl - 1;
      if (g3 > 1e-6) {
        const double sph = v.subPh;
        const double sdt = v.d3;
        double sy;
        if (subW == 0)
          sy = jsm::sin(TAU * sph);
        else if (subW == 1) {
          double qq = sph + 0.25;
          if (qq >= 1) qq -= 1;
          sy = 1 - 4 * jsm::abs(qq - 0.5);
          const double kb = (8 * sdt) / 6;
          double xb = qq / sdt;
          if (xb < 1) {
            const double ub = 1 - xb;
            sy += kb * ub * ub * ub;
          }
          xb = (1 - qq) / sdt;
          if (xb < 1) {
            const double ub = 1 - xb;
            sy += kb * ub * ub * ub;
          }
          xb = (qq - 0.5) / sdt;
          if (xb > -1 && xb < 1) {
            const double ub = 1 - (xb < 0 ? -xb : xb);
            sy -= kb * ub * ub * ub;
          }
        } else if (subW == 2) {
          double pb = 0;
          if (sph < sdt) {
            const double xx = sph / sdt;
            pb = xx + xx - xx * xx - 1;
          } else if (sph > 1 - sdt) {
            const double xx = (sph - 1) / sdt;
            pb = xx * xx + xx + xx + 1;
          }
          sy = 1 - 2 * sph + pb;
        } else {
          const double d = subW == 3 ? 0.5 : PULSE_W;
          sy = sph < d ? 1 : -1;
          if (sph < sdt) {
            const double xx = sph / sdt;
            sy += xx + xx - xx * xx - 1;
          } else if (sph > 1 - sdt) {
            const double xx = (sph - 1) / sdt;
            sy += xx * xx + xx + xx + 1;
          }
          double t2 = sph - d;
          if (t2 < 0) t2 += 1;
          if (t2 < sdt) {
            const double xx = t2 / sdt;
            sy -= xx + xx - xx * xx - 1;
          } else if (t2 > 1 - sdt) {
            const double xx = (t2 - 1) / sdt;
            sy -= xx * xx + xx + xx + 1;
          }
          sy -= 2 * d - 1;
        }
        const double sb = g3 * sy;
        o += sb;
        oR += sb;
        v.subPh += v.d3;
        if (v.subPh >= 1) v.subPh -= jsm::floor(v.subPh);
      }
      if (nGain > 1e-6) {
        if (newNoise) {
          uint32_t xr = static_cast<uint32_t>(v.seed);
          xr ^= xr << 13;
          xr ^= xr >> 17;
          xr ^= xr << 5;
          v.seed = static_cast<int32_t>(xr);
          v.nz = static_cast<double>(v.seed) / 2147483648.0;
        }
        o += nGain * v.nz;
        oR += nGain * v.nz;
      }
      double* X = v.x;
      double hp = (o - preA1v * X[VX_P1A] - X[VX_P1B]) * preH1v;
      double bp = preGv * hp + X[VX_P1A];
      X[VX_P1A] = preGv * hp + bp;
      double lp = preGv * bp + X[VX_P1B];
      X[VX_P1B] = preGv * bp + lp;
      hp = (lp - preA2v * X[VX_P2A] - X[VX_P2B]) * preH2v;
      bp = preGv * hp + X[VX_P2A];
      X[VX_P2A] = preGv * hp + bp;
      const double xin = preGv * bp + X[VX_P2B];
      X[VX_P2B] = preGv * bp + xin;
      double xinR = xin;
      if (wideV) {
        if (!v.wl) {
          X[VX_Q1A] = X[VX_P1A];
          X[VX_Q1B] = X[VX_P1B];
          X[VX_Q2A] = X[VX_P2A];
          X[VX_Q2B] = X[VX_P2B];
        } else if (wide != 0) {
          hp = (oR - preA1v * X[VX_Q1A] - X[VX_Q1B]) * preH1v;
          bp = preGv * hp + X[VX_Q1A];
          X[VX_Q1A] = preGv * hp + bp;
          lp = preGv * bp + X[VX_Q1B];
          X[VX_Q1B] = preGv * bp + lp;
          hp = (lp - preA2v * X[VX_Q2A] - X[VX_Q2B]) * preH2v;
          bp = preGv * hp + X[VX_Q2A];
          X[VX_Q2A] = preGv * hp + bp;
          xinR = preGv * bp + X[VX_Q2B];
          X[VX_Q2B] = preGv * bp + xinR;
        } else {
          X[VX_Q1A] = X[VX_P1A];
          X[VX_Q1B] = X[VX_P1B];
          X[VX_Q2A] = X[VX_P2A];
          X[VX_Q2B] = X[VX_P2B];
        }
      }
      double xd = xin;
      double xdR = xinR;
      if (ldOn) {
        const double zl = xin * ldG * v.accN + ldB;
        if (X[VX_LON] == 0) {
          const double a0 = (zl < 0 ? -zl : zl) * LD_IS;
          double F0;
          if (a0 >= LNC_MAX)
            F0 = a0 - LN2;
          else
            F0 = lncTab(LNC, a0);
          X[VX_LZL] = zl;
          X[VX_LFL] = LD_S2 * F0;
          X[VX_LXL] = 0;
          X[VX_LHL] = 0;
          for (int j = VX_LPL; j < VX_LPL + 8; j += 1) X[j] = 0;
          X[VX_LON] = 1;
        }
        if (wideV && !v.wl) {
          X[VX_LZR] = X[VX_LZL];
          X[VX_LFR] = X[VX_LFL];
          X[VX_LXR] = X[VX_LXL];
          X[VX_LHR] = X[VX_LHL];
          for (int j = 0; j < 4; j += 1) X[VX_LPR + j] = X[VX_LPL + j];
        }
        const bool ldSame = wideV && wide == 0 && X[VX_LZR] == X[VX_LZL] && X[VX_LFR] == X[VX_LFL] && X[VX_LXR] == X[VX_LXL] && X[VX_LHR] == X[VX_LHL] && X[VX_LPR] == X[VX_LPL] && X[VX_LPR + 1] == X[VX_LPL + 1] && X[VX_LPR + 2] == X[VX_LPL + 2] && X[VX_LPR + 3] == X[VX_LPL + 3];
        for (int sd = 0; sd < 2; sd += 1) {
          if (sd == 1 && !wideV) break;
          if (sd == 1 && ldSame) {
            xdR = xd;
            X[VX_LZR] = X[VX_LZL];
            X[VX_LFR] = X[VX_LFL];
            X[VX_LXR] = X[VX_LXL];
            X[VX_LHR] = X[VX_LHL];
            for (int j = 0; j < 4; j += 1) X[VX_LPR + j] = X[VX_LPL + j];
            break;
          }
          const double zi = sd == 0 ? zl : xinR * ldG * v.accN + ldB;
          const int iz = sd == 0 ? VX_LZL : VX_LZR;
          const double z1 = X[iz];
          const double az = (zi < 0 ? -zi : zi) * LD_IS;
          double Gz;
          if (az >= LNC_MAX)
            Gz = az - LN2;
          else
            Gz = lncTab(LNC, az);
          const double Fz = LD_S2 * Gz;
          const double dz = zi - z1;
          double yc;
          if (dz > 1e-7 || dz < -1e-7)
            yc = (Fz - X[iz + 1]) / dz;
          else {
            const double zm = 0.5 * (zi + z1) * LD_IS;
            const double am = zm < 0 ? -zm : zm;
            double ym = 1;
            if (am < LNC_MAX) ym = lncSlope(LNC, am);
            yc = zm < 0 ? -LD_S * ym : LD_S * ym;
          }
          X[iz] = zi;
          X[iz + 1] = Fz;
          const double mm = yc - ldYbv;
          const double hh = ldDc * (X[iz + 3] + mm - X[iz + 2]);
          X[iz + 2] = mm;
          X[iz + 3] = hh;
          const int ip = sd == 0 ? VX_LPL : VX_LPR;
          double hq = (hh - preA1v * X[ip] - X[ip + 1]) * preH1v;
          double bq = preGv * hq + X[ip];
          X[ip] = preGv * hq + bq;
          const double lq = preGv * bq + X[ip + 1];
          X[ip + 1] = preGv * bq + lq;
          hq = (lq - preA2v * X[ip + 2] - X[ip + 3]) * preH2v;
          bq = preGv * hq + X[ip + 2];
          X[ip + 2] = preGv * hq + bq;
          const double hf = preGv * bq + X[ip + 3];
          X[ip + 3] = preGv * bq + hf;
          if (sd == 0)
            xd = xin + ldWet * (hf - xin);
          else
            xdR = xinR + ldWet * (hf - xinR);
        }
        if (!wideV) xdR = xd;
      } else if (X[VX_LON] != 0)
        X[VX_LON] = 0;
      if (newNoise || (ladOn ? v.g == 0 || (spW && v.gS == 0) : X[VX_G35] == 0 || (spW && X[VX_G35R] == 0))) {
        double env = envV * v.fV * (0.8 + 0.2 * v.accent) * v.envAcc;
        if (fpolNeg) env = -env;
        if (ladOn) {
          double fc = sm.cutoff * v.vCut * jsm::pow(2, cutMod + env + v.cutAcc + v.calC * drift + (keyTrack * (v.midi - TRACK_ROOT)) / 12 + kTune);
          if (spW) {
            double frr = fc * spFv;
            fc *= spIv;
            if (frr > nyq)
              frr = nyq;
            else if (frr < 20)
              frr = 20;
            const double xr = (JS_PI * frr) / sr;
            const double x2r = xr * xr;
            v.gS = (xr * (945 - 105 * x2r + x2r * x2r)) / (945 - 420 * x2r + 15 * x2r * x2r);
          }
          if (fc > nyq)
            fc = nyq;
          else if (fc < 20)
            fc = 20;
          v.g = jsm::tan((JS_PI * fc) / sr);
        }
        if (w4 != 0) {
          double f35 = sm.cutoff * jsm::pow(2, sB7 * v.vCutE + cutMod + env + v.cutAcc + sB7 * v.calC * drift + (keyTrack * (v.midi - TRACK_ROOT)) / 12 + c35o);
          if (spW) {
            double frr = f35 * spFv;
            f35 *= spIv;
            if (frr > fcMax35)
              frr = fcMax35;
            else if (frr < 20)
              frr = 20;
            const double xr = (JS_PI * frr) / sr;
            const double x2r = xr * xr;
            const double gR = (xr * (945 - 105 * x2r + x2r * x2r)) / (945 - 420 * x2r + 15 * x2r * x2r);
            X[VX_G35R] = gR;
            X[VX_G35RH] = gR / (1 + jsm::sqrt(1 + gR * gR));
          }
          if (f35 > fcMax35)
            f35 = fcMax35;
          else if (f35 < 20)
            f35 = 20;
          const double g35n = jsm::tan((JS_PI * f35) / sr);
          X[VX_G35] = g35n;
          X[VX_G35H] = g35n / (1 + jsm::sqrt(1 + g35n * g35n));
          double tAl = (f35 - K35_AF0) / K35_AFW;
          tAl = tAl <= 0 ? 0 : tAl >= 1 ? 1 : tAl * tAl * (3 - 2 * tAl);
          X[VX_KAL] = K35_ALPHA * (1 - tAl);
        }
      }
      const double g = v.g;
      const double x0 = v.pu;
      const double x1 = v.s1;
      const double x2 = v.s2;
      const double x3 = v.s3;
      const double x4 = v.s4;
      double yo = 0;
      if (ladOn) {
        const double ga = g / (1 + NL_K * (x0 * x0 + x0 * x1 + x1 * x1));
        const double gb = g / (1 + NL_K * (x1 * x1 + x1 * x2 + x2 * x2));
        const double gc = g / (1 + NL_K * (x2 * x2 + x2 * x3 + x3 * x3));
        const double gd = g / (1 + NL_K * (x3 * x3 + x3 * x4 + x4 * x4));
        double Ga = ga / (1 + ga);
        double Gb = gb / (1 + gb);
        double Gc = gc / (1 + gc);
        double Gd = gd / (1 + gd);
        double S = Gd * Gc * Gb * (1 - Ga) * x1 + Gd * Gc * (1 - Gb) * x2 + Gd * (1 - Gc) * x3 + (1 - Gd) * x4;
        double u = (xd * driveIn - k * S) / (1 + k * Ga * Gb * Gc * Gd);
        if (k > LC_K0 && g > LC_G0) {
          double ta = (g - LC_G0) / LC_GW;
          ta = ta >= 1 ? 1 : ta * ta * (3 - 2 * ta);
          double tb = (k - LC_K0) / LC_KW;
          tb = tb >= 1 ? 1 : tb * tb * (3 - 2 * tb);
          const double om = ta * tb;
          const double pp1 = x1 + (u - x1) * Ga;
          const double pp2 = x2 + (pp1 - x2) * Gb;
          const double pp3 = x3 + (pp2 - x3) * Gc;
          const double pp4 = x4 + (pp3 - x4) * Gd;
          const double ha = g / (1 + NL_K * (u * u + u * pp1 + pp1 * pp1));
          const double hb = g / (1 + NL_K * (pp1 * pp1 + pp1 * pp2 + pp2 * pp2));
          const double hc = g / (1 + NL_K * (pp2 * pp2 + pp2 * pp3 + pp3 * pp3));
          const double hd = g / (1 + NL_K * (pp3 * pp3 + pp3 * pp4 + pp4 * pp4));
          Ga += om * (ha / (1 + ha) - Ga);
          Gb += om * (hb / (1 + hb) - Gb);
          Gc += om * (hc / (1 + hc) - Gc);
          Gd += om * (hd / (1 + hd) - Gd);
          S = Gd * Gc * Gb * (1 - Ga) * x1 + Gd * Gc * (1 - Gb) * x2 + Gd * (1 - Gc) * x3 + (1 - Gd) * x4;
          u = (xd * driveIn - k * S) / (1 + k * Ga * Gb * Gc * Gd);
        }
        v.pu = u;
        double w = (u - x1) * Ga;
        double y = w + x1;
        v.s1 = y + w;
        const double y1 = y;
        w = (y - x2) * Gb;
        y = w + x2;
        v.s2 = y + w;
        const double y2 = y;
        w = (y - x3) * Gc;
        y = w + x3;
        v.s3 = y + w;
        w = (y - x4) * Gd;
        y = w + x4;
        v.s4 = y + w;
        if (w0 != 0) yo += w0 * y;
        if (w1 != 0) yo += w1 * y2;
        if (w2 != 0) yo += w2 * (y1 - y2);
        if (w3 != 0) yo += w3 * (u - 2 * y1 + y2);
      } else if (x0 != 0 || x1 != 0 || x2 != 0 || x3 != 0 || x4 != 0) {
        v.pu = v.s1 = v.s2 = v.s3 = v.s4 = 0;
      }
      const double kL = v.kLam;
      const double kIl = v.kIlam;
      // Le Korg35 d'un cote (gauche : base VX_KCL, droite : VX_KCR), le meme code que les deux copies du JS
      auto k35 = [&](int base, int ixk, double g35, double xk1) {
        const double kAl = X[VX_KAL];
        const double xk0 = X[ixk];
        X[ixk] = xk1;
        for (int ss = k35x2 ? 0 : 1; ss < 2; ss += 1) {
          const double xk = ss == 0 ? 0.5 * (xk0 + xk1) : xk1;
          const double kc = X[base];
          const double kb = X[base + 1];
          const double kp = X[base + 2];
          const double kq = X[base + 3];
          const double ky = X[base + 4];
          const double be = 2 * kp - kq;
          const double xe = (be < 0 ? -be : be) * kIl;
          double sig;
          if (xe >= K35_XMAX)
            sig = (K35_TEND + (xe - K35_XMAX) * K35_SLOPE) / xe;
          else {
            const double qe = xe * K35_INV;
            const int ie = static_cast<int>(qe);
            sig = K35_S[ie] + (qe - ie) * (K35_S[ie + 1] - K35_S[ie]);
          }
          const double gk = g35 * (1 - (kAl * ky) / jsm::sqrt(kL * kL + ky * ky));
          double Kd = KK * sig;
          double iD1 = 1 / (1 + gk * (1 - Kd));
          double mk = (gk * (4 * Kd - 1) * iD1) / 3;
          double cq = (kc - gk * xk + mk * kb) / (1 + (4 * gk) / 3 + mk * gk);
          double b = (kb - gk * cq) * iD1;
          if (omK > 0 && g35 > LC_G0 && !k35x2) {
            double tg = (g35 - LC_G0) / LC_GW;
            tg = tg >= 1 ? 1 : tg * tg * (3 - 2 * tg);
            const double om = tg * omK;
            const double xb = (b < 0 ? -b : b) * kIl;
            double s2;
            if (xb >= K35_XMAX)
              s2 = (K35_TEND + (xb - K35_XMAX) * K35_SLOPE) / xb;
            else {
              const double qb = xb * K35_INV;
              const int ib = static_cast<int>(qb);
              s2 = K35_S[ib] + (qb - ib) * (K35_S[ib + 1] - K35_S[ib]);
            }
            Kd = KK * (sig + om * (s2 - sig));
            iD1 = 1 / (1 + gk * (1 - Kd));
            mk = (gk * (4 * Kd - 1) * iD1) / 3;
            cq = (kc - gk * xk + mk * kb) / (1 + (4 * gk) / 3 + mk * gk);
            b = (kb - gk * cq) * iD1;
          }
          X[base] = 2 * cq - kc;
          X[base + 1] = 2 * b - kb;
          X[base + 3] = kp;
          X[base + 2] = b;
          const double xo = (b < 0 ? -b : b) * kIl;
          double fo;
          if (xo >= K35_XMAX)
            fo = K35_TEND + (xo - K35_XMAX) * K35_SLOPE;
          else {
            const double qo = xo * K35_INV;
            const int io = static_cast<int>(qo);
            fo = K35_T[io] + (qo - io) * (K35_T[io + 1] - K35_T[io]);
          }
          X[base + 4] = b < 0 ? -kL * fo : kL * fo;
        }
      };
      if (w4 != 0) {
        if (wideV && !v.wl) {
          X[VX_KCR] = X[VX_KCL];
          X[VX_KBR] = X[VX_KBL];
          X[VX_KPR] = X[VX_KPL];
          X[VX_KQR] = X[VX_KQL];
          X[VX_KYR] = X[VX_KYL];
          X[VX_KXR] = X[VX_KXL];
        }
        const double g35 = k35x2 ? X[VX_G35H] : X[VX_G35];
        k35(VX_KCL, VX_KXL, g35, xd * driveIn);
        X[VX_KON] = 1;
        yo += w4 * X[VX_KYL];
      } else if (X[VX_KON] != 0) {
        for (int j = VX_KCL; j <= VX_KYR; j += 1) X[j] = 0;
        X[VX_KXL] = 0;
        X[VX_KXR] = 0;
        X[VX_KON] = 0;
      }
      if (!(yo > -VOICE_GUARD && yo < VOICE_GUARD)) {
        rest(v);
        heals += 1;
        yo = 0;
      }
      double a = yo * v.aV * v.ampAcc;
      if (xAmp) a *= ampG;
      if (ldOn) a *= ldMkv;
      const double zs = a * dO;
      const double zp = X[VX_TZL];
      const double dzs = zs - zp;
      if (dzs > VS_EPS || dzs < -VS_EPS) {
        if (X[VX_TVL] == 0) {
          const double aa1 = zp < 0 ? -zp : zp;
          if (aa1 >= LNC_MAX)
            X[VX_TFL] = aa1 - LN2;
          else
            X[VX_TFL] = lncTab(LNC, aa1);
        }
        const double a0 = zs < 0 ? -zs : zs;
        double F0;
        if (a0 >= LNC_MAX)
          F0 = a0 - LN2;
        else
          F0 = lncTab(LNC, a0);
        a = ((F0 - X[VX_TFL]) / dzs) * oN;
        X[VX_TFL] = F0;
        X[VX_TVL] = 1;
      } else {
        const double ms = 0.5 * (zs + zp);
        const double am = ms < 0 ? -ms : ms;
        double ym = 1;
        if (am < LNC_MAX) ym = lncSlope(LNC, am);
        a = (ms < 0 ? -ym : ym) * oN;
        X[VX_TVL] = 0;
      }
      X[VX_TZL] = zs;
      v.gL += (v.tL - v.gL) * panK;
      v.gR += (v.tR - v.gR) * panK;
      if (!wideV) {
        sum += a * v.gL;
        v.wl = false;
        sumR += a * v.gR;
        continue;
      }
      LadderR& fq = v.fr;
      const bool startR = !v.wl;
      if (startR) {
        v.wl = true;
        fq.pu = x0;
        fq.s1 = x1;
        fq.s2 = x2;
        fq.s3 = x3;
        fq.s4 = x4;
      }
      double yoR = 0;
      if (ladOn) {
        fq.x = xdR * driveIn;
        fq.g = spW && v.gS > 0 ? v.gS : g;
        fq.k = k;
        ladderR(fq);
        const double yr = fq.y;
        if (w0 != 0) yoR += w0 * yr;
        if (w1 != 0) yoR += w1 * fq.y2;
        if (w2 != 0) yoR += w2 * (fq.y1 - fq.y2);
        if (w3 != 0) yoR += w3 * (fq.u - 2 * fq.y1 + fq.y2);
      } else if (fq.pu != 0 || fq.s1 != 0 || fq.s2 != 0 || fq.s3 != 0 || fq.s4 != 0) {
        fq.pu = fq.s1 = fq.s2 = fq.s3 = fq.s4 = 0;
      }
      if (w4 != 0) {
        const double g35R1 = spW && X[VX_G35R] > 0 ? X[VX_G35R] : X[VX_G35];
        const double g35R2 = spW && X[VX_G35R] > 0 ? X[VX_G35RH] : X[VX_G35H];
        const double g35 = k35x2 ? g35R2 : g35R1;
        k35(VX_KCR, VX_KXR, g35, xdR * driveIn);
        yoR += w4 * X[VX_KYR];
      }
      if (!(yoR > -VOICE_GUARD && yoR < VOICE_GUARD)) {
        rest(v);
        heals += 1;
        yoR = 0;
      }
      double aR = yoR * v.aV * v.ampAcc;
      if (xAmp) aR *= ampG;
      if (ldOn) aR *= ldMkv;
      const double zsR = aR * dO;
      if (startR) {
        X[VX_TZR] = zsR;
        X[VX_TVR] = 0;
      }
      const double zpR = X[VX_TZR];
      const double dzR = zsR - zpR;
      if (dzR > VS_EPS || dzR < -VS_EPS) {
        if (X[VX_TVR] == 0) {
          const double aa1 = zpR < 0 ? -zpR : zpR;
          if (aa1 >= LNC_MAX)
            X[VX_TFR] = aa1 - LN2;
          else
            X[VX_TFR] = lncTab(LNC, aa1);
        }
        const double a0 = zsR < 0 ? -zsR : zsR;
        double F0;
        if (a0 >= LNC_MAX)
          F0 = a0 - LN2;
        else
          F0 = lncTab(LNC, a0);
        aR = ((F0 - X[VX_TFR]) / dzR) * oN;
        X[VX_TFR] = F0;
        X[VX_TVR] = 1;
      } else {
        const double ms = 0.5 * (zsR + zpR);
        const double am = ms < 0 ? -ms : ms;
        double ym = 1;
        if (am < LNC_MAX) ym = lncSlope(LNC, am);
        aR = (ms < 0 ? -ym : ym) * oN;
        X[VX_TVR] = 0;
      }
      X[VX_TZR] = zsR;
      if (spXf != 0) {
        const double t = spXf * (aR - a);
        sum += (a + t) * v.gL;
        sumR += (aR - t) * v.gR;
      } else {
        sum += a * v.gL;
        sumR += aR * v.gR;
      }
    }
    acc[0] = sum;
    acc[1] = sumR;
    busTick(i2);
  }
  flushTiny();
  // Retour a la frequence du contexte : les demi-bandes en cascade, un canal chacune
  if (OS == 8) {
    d8.run(rawL, 8 * N, mid8.data());
    d4.run(mid8.data(), 4 * N, mid.data());
    d2.run(mid.data(), 2 * N, L);
    if (R) {
      d8R.run(rawRp, 8 * N, mid8R.data());
      d4R.run(mid8R.data(), 4 * N, midR.data());
      d2R.run(midR.data(), 2 * N, R);
    }
  } else if (OS == 4) {
    d4.run(rawL, 4 * N, mid.data());
    d2.run(mid.data(), 2 * N, L);
    if (R) {
      d4R.run(rawRp, 4 * N, midR.data());
      d2R.run(midR.data(), 2 * N, R);
    }
  } else if (OS == 2) {
    d2.run(rawL, 2 * N, L);
    if (R) d2R.run(rawRp, 2 * N, R);
  } else {
    for (int i = 0; i < N; i += 1) L[i] = rawL[i];
    if (R)
      for (int i = 0; i < N; i += 1) R[i] = rawRp[i];
  }
  if (lvl > 0) {
    const double pt = CLIP_POST / lvl;
    const double pw = (CLIP_CEIL - CLIP_POST) / lvl;
    for (int i = 0; i < N; i += 1) {
      const double y = L[i];
      if (y > pt)
        L[i] = static_cast<float>(pt + pw * jsm::tanh((y - pt) / pw));
      else if (y < -pt)
        L[i] = static_cast<float>(-pt - pw * jsm::tanh((-y - pt) / pw));
    }
    if (R) {
      for (int i = 0; i < N; i += 1) {
        const double y = R[i];
        if (y > pt)
          R[i] = static_cast<float>(pt + pw * jsm::tanh((y - pt) / pw));
        else if (y < -pt)
          R[i] = static_cast<float>(-pt - pw * jsm::tanh((-y - pt) / pw));
      }
    }
  }
}

// =================================================================================================================
Voyager::Voyager(const VoyagerOptions& opts, const std::vector<std::pair<std::string, double>>& initialParams)
    : m_(new Impl(opts, initialParams)) {}
Voyager::~Voyager() = default;

int Voyager::paramIndex(const std::string& key) {
  for (int i = 0; i < P_COUNT; i += 1)
    if (key == PDEFS[i].name) return i;
  return -1;
}
int Voyager::paramCount() { return P_COUNT; }
const char* Voyager::paramName(int id) { return id >= 0 && id < P_COUNT ? PDEFS[id].name : ""; }

void Voyager::params(const std::vector<std::pair<std::string, double>>& kv) {
  ParamKV tmp[P_COUNT * 2];
  int n = 0;
  for (const auto& e : kv) {
    const int id = paramIndex(e.first);
    if (id < 0) continue;
    if (n == P_COUNT * 2) {
      m_->msgParams(tmp, n);  // (jamais en pratique) un tres long message : par morceaux
      n = 0;
    }
    tmp[n++] = {id, e.second};
  }
  m_->msgParams(tmp, n);
}
void Voyager::params(const ParamKV* kv, int n) { m_->msgParams(kv, n); }
void Voyager::note(double timeSec, double midi, double gateSec, double accent, double fromMidi) {
  m_->add(timeSec, midi, gateSec, accent, fromMidi);
}
void Voyager::beat(double timeSec, double b, double bpm, bool run) { m_->addBeat(timeSec, b, bpm, run); }
void Voyager::noteOff(double midi, double timeSec) { m_->msgNoteOff(midi, timeSec); }
void Voyager::cancel(double timeSec) { m_->msgCancel(timeSec); }
void Voyager::stop(double timeSec) { m_->msgStop(timeSec); }

void Voyager::process(float* L, float* R, int n) {
  // Un bloc de plus de kMaxBlock est decoupe (le JS n'en recoit jamais : 128)
  while (n > 0) {
    const int N = n > kMaxBlock ? kMaxBlock : n;
    m_->processBlock(L, R, N);
    m_->cf += N;
    L += N;
    if (R) R += N;
    n -= N;
  }
}

int64_t Voyager::currentFrame() const { return m_->cf; }
int Voyager::latencySamples() const {
  // Les demi-bandes (31 coefficients au rythme x4 : 15 / 4 ; 63 au rythme x2 : 31 / 2), en echantillons du contexte
  // (x8 : 23 coefficients de plus au rythme x8, 11 / 8 : 20.625 -> 21)
  const int os = m_->os;
  const double d = os == 8 ? 11.0 / 8 + 15.0 / 4 + 31.0 / 2 : os == 4 ? 15.0 / 4 + 31.0 / 2 : os == 2 ? 31.0 / 2 : 0;
  return static_cast<int>(jsm::round(d));
}
double Voyager::param(int id) const { return id >= 0 && id < P_COUNT ? m_->p[id] : QNAN; }
int Voyager::activeVoices() const {
  int a = 0;
  for (int i = 0; i < m_->nv; i += 1)
    if (m_->voices[i].on) a += 1;
  return a;
}
int Voyager::heals() const { return m_->heals; }
void Voyager::setOs(int os) { m_->requestOs(os); }
int Voyager::os() const { return m_->os; }
bool Voyager::osPending() const { return m_->osWant != 0; }

// Diagnostic (tests/voyager_compare.cpp seulement, pas dans Voyager.h) : les tables du module, pour les comparer a
// celles du JS. which : 0 LNC, 1 K35_T, 2 K35_S, 3 demi-bande 31, 4 demi-bande 63, 5 {MS_SO, OD_TANH_BIAS},
// 6 la demi-bande x8 du plugin (tests/hq_test.cpp).
namespace detail {
const double* voyagerTable(int which, int* n) {
  static Decimator h31, h63, h8;
  static double consts[2];
  static bool init = false;
  if (!init) {
    h31.init(31, 9);
    h63.init(63, 8);
    h8.init(D8_TAPS, D8_BETA);
    consts[0] = tables().MS_SO;
    consts[1] = tables().OD_TANH_BIAS;
    init = true;
  }
  switch (which) {
    case 0: *n = 4 * LNC_MAX * LNC_INV; return tables().LNC;
    case 1: *n = K35_N + 1; return tables().K35_T;
    case 2: *n = K35_N + 1; return tables().K35_S;
    case 3: *n = 31; return h31.h;
    case 4: *n = 63; return h63.h;
    case 6: *n = D8_TAPS; return h8.h;
    default: *n = 2; return consts;
  }
}
}  // namespace detail

}  // namespace mmarp
