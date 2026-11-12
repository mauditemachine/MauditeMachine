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
const double STACK_PAN2[7] = {0.64, 1, 2.0 / 3, 0, 0.5, 0, 3.089 / 7};  // (5 et 7 : UNISON, le plugin seul)
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

// ---------------------------------------------------------------------------------------------------------------
// Les extensions du 2026-11-11 (le plugin seul : RING, FOLD, NOISE COLOR, UNISON, HIGH PASS, COMB, le glissement par
// note). Voir Voyager.h. Chaque cle a son neutre : aucun de ces chemins ne tourne, le moteur du site au bit pres.
constexpr int MAX_UNI = 7;  // les exemplaires par oscillateur (STACK : 3 au plus ; UNISON : 5 ou 7)
// UNISON : les ecarts (x le reglage STACK, en cents) et les places stereo (x WIDE). Ecarts inegaux (pas de
// battement regulier), les places alternent autour du centre ; la moyenne des carres des places : STACK_PAN2.
const double UNI5_OFF[MAX_UNI] = {-1, -0.42, 0, 0.44, 0.97, 0, 0};
const double UNI5_PAN[MAX_UNI] = {-1, 0.5, 0, -0.5, 1, 0, 0};
const double UNI7_OFF[MAX_UNI] = {-1, -0.5716, -0.1775, 0, 0.181, 0.5651, 0.9768};
const double UNI7_PAN[MAX_UNI] = {-1, 0.66, -0.33, 0, 0.33, -0.66, 1};
constexpr double X_HPF_MIN = 20, X_HPF_MAX = 2000;
constexpr double X_HPF_K = JS_SQRT2;        // 1 / Q : Butterworth, 12 dB par octave
constexpr double X_COMB_FB = 0.97;          // la reinjection a xCombFb = +/-1
constexpr double X_COMB_DAMP_HZ = 10000;    // l'amortissement de la boucle (un pole)
constexpr double X_COMB_MIN_HZ = 27.5;      // la ligne est allouee pour cette note (au-dessous : une octave plus haut)
constexpr double X_COMB_S = 0.002;          // le retard glisse (GLIDE, SLIDE) : 2 ms
constexpr double X_FOLD_A = 8;              // la phase du repliement a FOLD = 1, pour une entree de 1 (2.5 plis)
constexpr int X_SIN_N = 4096;               // la table du sinus du repliement (Hermite : erreur < 2e-14)
constexpr double X_RED_HZ = 100;            // NOISE COLOR, le bruit rouge : -6 dB par octave au-dessus
// NOISE COLOR : les couleurs ramenees a la sonie du blanc a la sortie d'une voix (mesure a 48 kHz, tests/hq2_test)
constexpr double NC_PINK = 0.245, NC_RED = 0.67, NC_BLUE = 1.1;
/** a != b sans -Wfloat-equal (les comparaisons exactes des chemins neufs). */
inline bool differs(double a, double b) { return a < b || a > b; }
struct SinTab {
  double s[X_SIN_N + 1], c[X_SIN_N + 1];
  SinTab() {
    for (int i = 0; i <= X_SIN_N; i += 1) {
      s[i] = jsm::sin((TAU * i) / X_SIN_N);
      c[i] = jsm::cos((TAU * i) / X_SIN_N) * (TAU / X_SIN_N);
    }
    s[0] = 0;
    s[X_SIN_N] = 0;
    s[X_SIN_N / 2] = 0;
  }
};
const SinTab& sinTab() {
  static const SinTab t;
  return t;
}
/** sin(x) par la table (x en radians, quelconque). */
inline double sinT(const SinTab& T, double x) {
  // (|x| reste petit devant 2^31 pas de table : la phase du repliement, bornee par le niveau des oscillateurs)
  const double q = x * (X_SIN_N / TAU);
  int k = static_cast<int>(q);
  double t = q - k;
  if (t < 0) {
    t += 1;
    k -= 1;
  }
  const int i = k & (X_SIN_N - 1);
  const double y0 = T.s[i], y1 = T.s[i + 1], d0 = T.c[i], d1 = T.c[i + 1];
  return y0 + t * (d0 + t * ((3 * (y1 - y0) - 2 * d0 - d1) + t * (2 * (y0 - y1) + d0 + d1)));
}
/**
 * FOLD : y = s sin(a x), antirepliement par les primitives (ADAA d'ordre 2, Parker / Zavalishin / Le Bivic 2016), en
 * phase t = a x. Avec F1 = -cos, F2 = -sin, la difference divisee de F2 a une forme exacte, sans difference de grands
 * nombres : D(u, v) = (F2(u) - F2(v)) / (u - v) = -cos((u + v) / 2) sinc((u - v) / 2).
 *   y = 2 (D(t0, t1) - D(t1, t2)) / (t0 - t2)
 * et, quand t0 et t2 se confondent (un sommet de l'onde, un signal tres faible) : tm = (t0 + t2) / 2, d = tm - t1,
 *   y = 2 (F1(tm) - D(tm, t1)) / d        ou sin((tm + t1) / 2) si d est petit lui aussi.
 */
inline double foldD(const SinTab& T, double u, double v) {
  const double h = 0.5 * (u - v);
  const double sc = h < 1e-3 && h > -1e-3 ? 1 - (h * h) / 6 : sinT(T, h) / h;
  return -sinT(T, 0.5 * (u + v) + JS_PI / 2) * sc;
}
/** st : {x1, x2, D(t1, t2)} ; fresh : D est a recalculer (a a change, la voix repart). */
inline double foldAdaa2(const SinTab& T, double x0, double* st, double a, bool fresh) {
  const double t0 = a * x0, t1 = a * st[0], t2 = a * st[1];
  const double d12 = fresh ? foldD(T, t1, t2) : st[2];
  const double d01 = foldD(T, t0, t1);
  const double dt = t0 - t2;
  double y;
  if (dt > 1e-3 || dt < -1e-3)
    y = (2 * (d01 - d12)) / dt;
  else {
    const double tm = 0.5 * (t0 + t2);
    const double d = tm - t1;
    if (d > 1e-3 || d < -1e-3)
      y = (2 * (-sinT(T, tm + JS_PI / 2) - foldD(T, tm, t1))) / d;
    else
      y = sinT(T, 0.5 * (tm + t1));
  }
  st[1] = st[0];
  st[0] = x0;
  st[2] = d01;
  return y;
}

// ---------------------------------------------------------------------------------------------------------------
// Les extensions du 2026-11-11, suite (le plugin seul : les controleurs, la matrice de modulation, VOICE MODE,
// FEEDBACK, AMP MODE). Voir Voyager.h. Chaque cle a son neutre : aucun de ces chemins ne tourne.
constexpr int MX_ROWS = 6;
enum { MS_OFF = 0, MS_VEL, MS_MW, MS_AT, MS_PB, MS_KEY, MS_LFO1, MS_LFO2, MS_FENV, MS_AENV, MS_SH, MS_RND, MS_COUNT };
enum {
  MD_OFF = 0, MD_PITCH, MD_O2PITCH, MD_WAVE, MD_FM, MD_OSCMIX, MD_NOISE, MD_SUB, MD_RING, MD_FOLD, MD_CUTOFF, MD_RES,
  MD_ENV, MD_DRIVE, MD_AMP, MD_PAN, MD_STACK, MD_LFO1D, MD_LFO2D, MD_COMB, MD_COUNT
};
/** Une source par voix (les autres sont communes a toutes les voix). */
inline bool mxVoiceSrc(int s) { return s == MS_VEL || s == MS_KEY || s == MS_FENV || s == MS_AENV || s == MS_SH || s == MS_RND; }
/** Une source a deux signes (-1..1) ; les autres vont de 0 a 1. */
inline bool mxBipolar(int s) { return s == MS_PB || s == MS_KEY || s == MS_LFO1 || s == MS_LFO2 || s == MS_SH || s == MS_RND; }
constexpr double MX_PITCH = 1200;     // PITCH et OSC 2 PITCH : +/-12 demi-tons a amt 1
constexpr double MX_WAVE = 2;         // WAVE : 2 formes d'onde (la loi du LFO 1)
constexpr double MX_FM = 0.6;         // FM : +/-0.6 (la loi du LFO 1)
constexpr double MX_CUT = 4;          // CUTOFF : +/-4 octaves
constexpr double MX_KEY_MAX = 2.5;    // KEY : +/-1 a +/-2 octaves du do central, borne a +/-5 octaves
/** KEY : la hauteur de la note (son glissement compris), 0 au do central, +/-1 a +/-2 octaves. */
const double LOG_C4 = jsm::log(midiHz(60));
inline double keyOf(double logf) {
  const double k = (logf - LOG_C4) * (1 / (2 * JS_LN2));
  return k < -MX_KEY_MAX ? -MX_KEY_MAX : k > MX_KEY_MAX ? MX_KEY_MAX : k;
}
constexpr double CTL_S = 0.005;       // les controleurs (bend, molette, aftertouch), la velocite et S&H : 5 ms
constexpr double LEGATO_MIN_S = 0.06; // LEGATO : le glissement, GLIDE ou 60 ms au moins
constexpr int MONO_CAP = 24;          // MONO / LEGATO : les notes tenues retenues (au-dela : la plus ancienne sort)
constexpr double FB_GAIN = 1.0;       // FEEDBACK : le gain de la boucle a fond (le VCA et la saturation la bornent)
constexpr double FB_DC_HZ = 25;       // la boucle ne passe pas le continu (elle ne se verrouille jamais sur un rail)
// AMP MODE : l'etage de sortie du bus (u : le bus) ; chaque courbe a un gain unite aux petits signaux
constexpr double AMP_TRI_G = 0.5, AMP_TRI_B = 0.35;   // TRIODE : tanh decalee (harmoniques paires)
constexpr double AMP_PEN_G = 1.5;                     // PENTODE : cubique ecretee (impaires, genou plus dur)
constexpr double AMP_SAT_G = 5.0;                     // SATURATED : tanh a fort gain
constexpr double AMP_GC_MIN = 0.25, AMP_GC_MAX = 6;   // la compensation de niveau (suivie), bornee
constexpr double AMP_AVG_S = 0.35;                    // le temps de ses moyennes d'energie
constexpr double AMP_BAND_HZ = 10000;                 // ... mesurees sous 10 kHz (un pole) : ce qui sortira du decimateur
const double AMP_GC0[4] = {1, 1.03, 1.3, 2.1};        // sa valeur de depart (mesuree sur l'arpege du patch par defaut)

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
  P_xl1Dest, P_xl1Amt, P_l2Beats, P_l2Shape, P_l2Dest, P_l2Amt,
  // 2026-11-11
  P_xRing, P_xFold, P_xNoiseCol, P_xUnison, P_xHpf, P_xComb, P_xCombFb,
  // 2026-11-11, suite : la matrice (6 lignes : source, destination, quantite), le bend, VOICE MODE, FEEDBACK, AMP MODE
  P_m1Src, P_m1Dst, P_m1Amt, P_m2Src, P_m2Dst, P_m2Amt, P_m3Src, P_m3Dst, P_m3Amt, P_m4Src, P_m4Dst, P_m4Amt,
  P_m5Src, P_m5Dst, P_m5Amt, P_m6Src, P_m6Dst, P_m6Amt, P_pbRange, P_voiceMode, P_xFeedback, P_ampMode, P_COUNT
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
    {"xRing", 0, 1, false, 0},       {"xFold", 0, 1, false, 0},       {"xNoiseCol", 0, 1, false, 0.5},
    {"xUnison", 0, 7, true, 0},      {"xHpf", 0, X_HPF_MAX, false, 0}, {"xComb", 0, 1, false, 0},
    {"xCombFb", -1, 1, false, 0},
    {"m1Src", 0, MS_COUNT - 1, true, 0}, {"m1Dst", 0, MD_COUNT - 1, true, 0}, {"m1Amt", -1, 1, false, 0},
    {"m2Src", 0, MS_COUNT - 1, true, 0}, {"m2Dst", 0, MD_COUNT - 1, true, 0}, {"m2Amt", -1, 1, false, 0},
    {"m3Src", 0, MS_COUNT - 1, true, 0}, {"m3Dst", 0, MD_COUNT - 1, true, 0}, {"m3Amt", -1, 1, false, 0},
    {"m4Src", 0, MS_COUNT - 1, true, 0}, {"m4Dst", 0, MD_COUNT - 1, true, 0}, {"m4Amt", -1, 1, false, 0},
    {"m5Src", 0, MS_COUNT - 1, true, 0}, {"m5Dst", 0, MD_COUNT - 1, true, 0}, {"m5Amt", -1, 1, false, 0},
    {"m6Src", 0, MS_COUNT - 1, true, 0}, {"m6Dst", 0, MD_COUNT - 1, true, 0}, {"m6Amt", -1, 1, false, 0},
    {"pbRange", 1, 24, false, 2},    {"voiceMode", 0, 2, true, 0},    {"xFeedback", 0, 1, false, 0},
    {"ampMode", 0, 3, true, 0},
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

// (toujours en ligne : au neutre, le compilateur garde ces valeurs dans des registres, comme avant)
#if defined(__GNUC__) || defined(__clang__)
#define MMARP_INLINE __attribute__((always_inline)) inline
#elif defined(_MSC_VER)
#define MMARP_INLINE __forceinline
#else
#define MMARP_INLINE inline
#endif
/** Ce que le filtre tire de RES (resK, les poids des modes, le MS-10) : commun, ou par voix quand la matrice module RES. */
struct FiltG {
  double k = 0, kTune = 0, w0 = 0, w1 = 0, w2 = 0, w3 = 0, w4 = 0, c35o = 0, sB7 = 1, KK = 0, omK = 0;
  bool ladOn = false, k35x2 = false;
};

/** Ce que les oscillateurs tirent de WAVE et des niveaux OSC 1 / OSC 2 : commun, ou par voix (matrice : WAVE, OSC MIX). */
struct WaveG {
  int i1 = 0, i2w = 0;
  double f1m = 0, f2m = 0, pwd1 = 0.5, pwd2 = 0.5, g1 = 0, g2 = 0, pn1 = 0, pn2 = 0, pn2w = 0;
  bool pwm1 = false, pwm2 = false;
};
/** Les formes d'onde (les lignes du JS, telles quelles). */
MMARP_INLINE void waveShape(WaveG& W, double w1, double w2, double waveMod) {
  const double pw1 = jsm::min(5, jsm::max(0, w1 + waveMod));
  const double pw2 = jsm::min(4, jsm::max(0, w2 + 0.8 * waveMod));
  const int i1 = static_cast<int>(jsm::min(4, jsm::floor(pw1)));
  const double f1m = pw1 - i1;
  const int i2w = static_cast<int>(jsm::min(3, jsm::floor(pw2)));
  const double f2m = pw2 - i2w;
  const bool pwm1 = i1 == 3 && f1m > 1e-4;
  const bool pwm2 = i2w == 3 && f2m > 1e-4;
  W.i1 = i1;
  W.f1m = f1m;
  W.i2w = i2w;
  W.f2m = f2m;
  W.pwm1 = pwm1;
  W.pwm2 = pwm2;
  W.pwd1 = pwm1 ? pwOf(3, f1m) : 0.5;
  W.pwd2 = pwm2 ? pwOf(3, f2m) : 0.5;
}
/** Les places de WIDE a un exemplaire (les lignes du JS, telles quelles) ; g1, g2 : les niveaux des oscillateurs. */
MMARP_INLINE void wavePan(WaveG& W, bool wideOn) {
  const double g1 = W.g1, g2 = W.g2, f1m = W.f1m, f2m = W.f2m, pwd1 = W.pwd1, pwd2 = W.pwd2;
  const int i1 = W.i1, i2w = W.i2w;
  const bool pwm1 = W.pwm1, pwm2 = W.pwm2;
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
  W.pn1 = pn1;
  W.pn2 = pn2;
  W.pn2w = pn2w;
}
/** RES -> le filtre (les lignes du JS, telles quelles) ; wm : les poids des cinq modes. */
MMARP_INLINE void filtCalc(FiltG& F, double resV, const double* wm, int OS, double MS_SO) {
  const double k = resK(resV);
  F.k = k;
  F.kTune = k > 4 ? (K_COMP * (k - 4)) / 1200 : 0;
  const double keep = 1 + k * BASS_KEEP;
  F.w0 = wm[0] > 1e-4 ? wm[0] * keep : 0;
  F.w1 = wm[1] > 1e-4 ? (wm[1] * keep) / (1 + k * SLOPE12_RES) : 0;
  F.w2 = wm[2] > 1e-4 ? (wm[2] * 2 * BP_GAIN) / (1 + k * BP_RES) : 0;
  F.w3 = wm[3] > 1e-4 ? (wm[3] * HP_GAIN) / (1 + k * HP_RES) : 0;
  double w4 = wm[4] > 1e-4 ? wm[4] * MS_GAIN : 0;
  F.ladOn = F.w0 != 0 || F.w1 != 0 || F.w2 != 0 || F.w3 != 0;
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
  F.w4 = w4;
  F.c35o = c35o;
  F.sB7 = sB7;
  F.KK = (7.0 / 3) * kap;
  double omK = (kap - 0.93) / 0.04;
  omK = omK <= 0 ? 0 : omK >= 1 ? 1 : omK * omK * (3 - 2 * omK);
  F.omK = omK;
  F.k35x2 = OS == 2 && kap > MS_X2_K;
}

struct Voice {
  bool on = false;
  double midi = 60;
  double logf = 0, logT = 0;
  StackPair pr[MAX_UNI];
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
  // 2026-11-11 (le plugin seul). gK : le glissement propre de la note (0 : le GLIDE du patch) ; fx : l'entree
  // precedente du repliement (G, D) ; nc : NOISE COLOR (rose x3, rouge, le blanc d'avant), nzc le bruit colore ;
  // hp : HIGH PASS (ic1, ic2 x G, D) ; le peigne : ses lignes (G, D), leur place d'ecriture, ce qu'elles ont recu
  // depuis le repos, le retard en cours et sa cible, l'amortissement de la boucle (G, D)
  double gK = 0;
  double fx[2][3] = {{0, 0, 0}, {0, 0, 0}};
  double fxA = -1;
  double nc[5] = {0, 0, 0, 0, 0};
  double nzc = 0;
  double hp[4] = {0, 0, 0, 0};
  float* cb[2] = {nullptr, nullptr};
  int cw = 0, cVal = 0;
  double cD = 0, cDt = 0;
  double cLp[2] = {0, 0};
  // 2026-11-11, suite. La matrice : la velocite brute et le tirage S&H de la note (et lisses), le bruit lent (son
  // segment, ses deux valeurs, sa valeur lissee), la place stereo de la note ; ce que la matrice a deplace (PAN,
  // STACK) ; ses valeurs tenues au rythme du contexte (RES, DRIVE, FOLD). FEEDBACK : le bloqueur de continu (G, D).
  double vel = 100.0 / 127, velS = 100.0 / 127, sh = 0, shS = 0;
  double rSeg = QNAN, rA = 0, rB = 0, rOff = 0, rRaw = 0, rS = 0;
  double pan = 0;
  bool mPan = false, panSnap = false, stMod = false, mxOk = false;
  FiltG mF;
  WaveG mW;
  double mDrv = -1, mON = 1, mFa = 0, mFs = 1;
  double fbX[2] = {0, 0}, fbY[2] = {0, 0};

  void init(Rnd& rnd) {
    logf = jsm::log(261.6);
    logT = logf;
    const double a0 = rnd.next();
    const double b0 = rnd.next();
    const double m0 = rnd.next();
    pr[0].init(a0, b0, m0, true);
    for (int j = 1; j < MAX_UNI; j += 1) pr[j].init(0, 0, 0, false);
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

/**
 * COMB : un echantillon d'une ligne (ch 0 gauche, 1 droite). Lecture avant ecriture : quatre points de Lagrange aux
 * retards cdi - 1 .. cdi + 2 (ce que la ligne n'a pas encore recu depuis le repos vaut 0), l'amortissement, la
 * reinjection ; rend la sortie de la ligne (la sortie du peigne : entree + ligne, x le niveau).
 */
inline double combTick(Voice& v, int ch, double x, int cwi, int cdi, int mask, double l0, double l1, double l2, double l3, double damp, double fb) {
  float* b = v.cb[ch];
  double y;
  if (v.cVal >= cdi + 2)
    y = l0 * b[(cwi - cdi + 1) & mask] + l1 * b[(cwi - cdi) & mask] + l2 * b[(cwi - cdi - 1) & mask] + l3 * b[(cwi - cdi - 2) & mask];
  else {
    y = 0;
    if (v.cVal >= cdi - 1) y += l0 * b[(cwi - cdi + 1) & mask];
    if (v.cVal >= cdi) y += l1 * b[(cwi - cdi) & mask];
    if (v.cVal >= cdi + 1) y += l2 * b[(cwi - cdi - 1) & mask];
  }
  double lp = v.cLp[ch];
  lp += (y - lp) * damp;
  v.cLp[ch] = lp;
  double w = x + fb * lp;
  if (w < 1e-18 && w > -1e-18) w = 0;
  b[cwi] = static_cast<float>(w);
  return lp;
}

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
  double glide;  // le glissement propre de la note, en s (0 : le GLIDE du patch)
  double vel;    // la velocite brute 0..1 (la source VELOCITY de la matrice)
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
  // 2026-11-11 : les quantites lissees (15 ms) et ce qui en decoule, une valeur par echantillon du contexte
  struct Ext2 {
    double ring = 0, fold = 0, ncol = 0.5, comb = 0, combFb = 0, hpMix = 0, hpHz = X_HPF_MIN;
    double fa = 0, fs = 1;                    // FOLD : la phase et le niveau
    double hpAt = -1, h1 = 0, h2 = 0, h3 = 0; // HIGH PASS : les coefficients (et la frequence ou ils sont calcules)
    double fbI = 0, fbAt = 2, norm = 0.5, sign = 1; // COMB : la reinjection, le niveau du peigne, le signe de la ligne
    double damp = 1, dampD = 0, combK = 1;    // (taux interne) l'amortissement, son retard, le glissement du retard
    double cw[5] = {1, 0, 0, 0, 0};           // NOISE COLOR : blanc, rose, rouge, bleu
    double redR = 0, redN = 1;
    int cbMask = 0;
    std::vector<float> cbuf;
  } xq;
  // 2026-11-11, suite. Les controleurs : les cibles (posees entre deux blocs) et les valeurs lissees (5 ms) ; pbC :
  // le bend en cents (x pbRange), lisse de meme
  struct Ctl {
    double pbT = 0, mwT = 0, atT = 0, pb = 0, mw = 0, at = 0, pbC = 0, k = 1;
  } xc;
  // La matrice : les lignes en cours (source, destination, quantite lissee), les destinations par voix modulees a
  // l'echantillon precedent, les graines de S&H et de RANDOM, la voix la plus recente
  struct MxRow {
    int src = 0, dst = 0;
    double a = 0;
  };
  struct Mx {
    MxRow rows[MX_ROWS];
    int lastMask = 0, lastV = 0;
    uint32_t seedSH = 0, seedRnd = 0;
  } xmx;
  // MONO / LEGATO : la voix, les notes tenues (dans l'ordre ou elles sont parties)
  struct MonoE {
    double midi, off, start, vel;
  };
  struct Mono {
    int n = 0, voice = -1;
    MonoE e[MONO_CAP];
  } mono;
  // FEEDBACK : la quantite lissee, le pole du bloqueur de continu ; AMP MODE : le mode en cours, sa dose (fondu),
  // la compensation suivie (energies d'entree et de sortie), les etats de l'ADAA et du bloqueur de continu (G, D)
  struct Fb {
    double g = 0, r = 0;
    bool dirty = false;
  } xfb;
  struct Amp {
    int mode = 0, want = 0;
    bool blk = false;
    double mix = 0, gc = 1, mi = 0, mo = 0, k = 1, lpK = 1;
    double lp[4] = {0, 0, 0, 0};
    double st[2][2] = {{0, 0}, {0, 0}};
    double dc[4] = {0, 0, 0, 0};
  } xa;
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
    {
      // COMB : deux lignes par voix (G, D), pour la note la plus grave au taux x8 (une puissance de 2 : un masque)
      int len = 64;
      while (len < (8 * sampleRate) / X_COMB_MIN_HZ + 8) len *= 2;
      xq.cbMask = len - 1;
      xq.cbuf.assign(static_cast<size_t>(len) * 2 * static_cast<size_t>(nv), 0.0f);
      for (int i = 0; i < nv; i += 1)
        for (int ch = 0; ch < 2; ch += 1) voices[i].cb[ch] = xq.cbuf.data() + static_cast<size_t>(len) * static_cast<size_t>(2 * i + ch);
      xq.redR = jsm::exp((-2 * JS_PI * X_RED_HZ) / sampleRate);
      xq.redN = jsm::sqrt(1 - xq.redR * xq.redR);
    }
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
    xq.ring = p[P_xRing];
    xq.fold = p[P_xFold];
    xq.ncol = p[P_xNoiseCol];
    xq.comb = p[P_xComb];
    xq.combFb = p[P_xCombFb];
    xq.hpMix = p[P_xHpf] > 0 ? 1 : 0;
    xq.hpHz = p[P_xHpf] > X_HPF_MIN ? p[P_xHpf] : X_HPF_MIN;
    // 2026-11-11, suite : les graines derivees (aucun tirage de rnd), tout pose a ses valeurs
    xmx.seedSH = xs.seed ^ 0x53264821u;
    xmx.seedRnd = xs.seed ^ 0x524E4421u;
    for (int i = 0; i < nv; i += 1) voices[i].rOff = hashU(xmx.seedRnd, -1 - i);
    for (int r = 0; r < MX_ROWS; r += 1) {
      MxRow& R = xmx.rows[r];
      R.src = static_cast<int>(p[P_m1Src + 3 * r]);
      R.dst = static_cast<int>(p[P_m1Dst + 3 * r]);
      R.a = R.src != 0 && R.dst != 0 ? p[P_m1Amt + 3 * r] : 0;
    }
    xfb.g = p[P_xFeedback];
    xa.k = coef(AMP_AVG_S, sampleRate);
    ampPose();
  }
  /** AMP MODE pose (le constructeur, le silence) : le mode voulu, etats a zero ; la compensation repart de son a priori. */
  void ampPose() {
    const int want = static_cast<int>(p[P_ampMode]);
    if (want != xa.mode || !(xa.mix > 0)) ampPrior(want);
    xa.mode = want;
    xa.mix = want != 0 ? 1 : 0;
    xa.st[0][0] = xa.st[0][1] = xa.st[1][0] = xa.st[1][1] = 0;
    xa.dc[0] = xa.dc[1] = xa.dc[2] = xa.dc[3] = 0;
    xa.lp[0] = xa.lp[1] = xa.lp[2] = xa.lp[3] = 0;
  }
  void ampPrior(int mode) {
    xa.gc = AMP_GC0[mode];
    xa.mo = 1e-4;
    xa.mi = xa.mo * xa.gc * xa.gc;
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
    xq.damp = 1 - jsm::exp((-2 * JS_PI * X_COMB_DAMP_HZ) / sr2);
    xq.dampD = (1 - xq.damp) / xq.damp;
    xq.combK = coef(X_COMB_S, sr2);
    xq.hpAt = -1;
    xc.k = coef(CTL_S, sr2);
    xfb.r = jsm::exp((-2 * JS_PI * FB_DC_HZ) / sr2);
    xa.lpK = 1 - jsm::exp((-2 * JS_PI * AMP_BAND_HZ) / sr2);
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
    mono.n = 0;
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
    mono.n = 0;
    mono.voice = -1;
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
  void add(double time, double midi, double gate, double accent, double from, double glide, double velocity) {
    if (!jsm::isFinite(midi) || !jsm::isFinite(time) || !(gate > 0)) return;
    const double ac = (accent == 0 || accent != accent) ? 1 : accent;  // n.accent || 1
    if (!jsm::isFinite(ac)) return;
    const double frame = jsm::round(time * sampleRate);
    int i = queue.size();
    while (i > 0 && queue.at(i - 1).frame > frame) i -= 1;
    const bool hf = jsm::isFinite(from);
    const double acc = ac < 0 ? 0 : ac > 2 ? 2 : ac;
    // la velocite brute (la source VELOCITY) ; sans elle : celle que dit l'accent (1 = velocite 100)
    const double vl = velocity >= 0 && jsm::isFinite(velocity) ? (velocity > 1 ? 1 : velocity) : (acc * 100 > 127 ? 1 : (acc * 100) / 127);
    queue.insertAt(i, {frame, midi, gate, acc, hf ? from : 0, hf, hf && glide > 0 && jsm::isFinite(glide) ? glide : 0, vl});
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
    // MONO / LEGATO : la note n'est plus tenue (la voix y reviendrait)
    for (int i = 0; i < mono.n; i += 1) {
      MonoE& e = mono.e[i];
      if (e.midi == midi) e.off = jsm::min(e.off, jsm::max(f, e.start + 64));
    }
  }
  void msgStop(double time) {
    const double t = (time == 0 || time != time) ? 0 : time;
    const double f = jsm::round(t * sampleRate);
    queue.keepIf([f](const NoteEv& e) { return e.frame < f; });
    dueBeats(static_cast<double>(cf));
    beats.clear();
    freeRun(static_cast<double>(cf));
    mono.n = 0;
    for (int i = 0; i < nv; i += 1) {
      Voice& v = voices[i];
      if (!v.on) continue;
      v.aStage = 3;
      v.fStage = 3;
      v.quick = true;
    }
  }

  // ------------------------------------------------------------------ MONO / LEGATO, S&H (2026-11-11, suite)
  /** Les notes tenues dont la duree est passee sortent de la pile. */
  void monoPurge(double frame) {
    int w = 0;
    for (int i = 0; i < mono.n; i += 1)
      if (mono.e[i].off > frame) mono.e[w++] = mono.e[i];
    mono.n = w;
  }
  void monoPush(double midi, double off, double start, double vel) {
    if (mono.n == MONO_CAP) {
      for (int i = 1; i < mono.n; i += 1) mono.e[i - 1] = mono.e[i];
      mono.n -= 1;
    }
    mono.e[mono.n++] = {midi, off, start, vel};
  }
  /** La note de la voix finit : retour a la derniere note encore tenue (sans redeclencher), ou false : elle relache. */
  bool monoReturn(Voice& v, double frame) {
    const int vmode = static_cast<int>(p[P_voiceMode]);
    monoPurge(frame);
    if (vmode == 0) mono.n = 0;
    if (mono.n == 0) return false;
    const MonoE& e = mono.e[mono.n - 1];
    v.midi = e.midi;
    v.logT = jsm::log(midiHz(e.midi));
    v.off = e.off;
    v.vel = e.vel;
    if (vmode == 2)
      v.gK = coef(jsm::max(LEGATO_MIN_S, p[P_glide]) / 3, sr2);
    else {
      // MONO : le GLIDE du patch (a 0 : la hauteur saute, la phase continue)
      v.gK = 0;
      if (!(p[P_glide] > 0)) v.logf = v.logT;
    }
    return true;
  }
  /**
   * S&H : le tirage d'une note, -1..1, de (graine derivee, position de la note en 1/96 de temps, note) : jamais le
   * generateur du moteur ; une boucle ou un export le rejouent. La position : l'ancre deja due a cette frame.
   */
  double shDraw(double midi, double frame) const {
    double f = tp.f, b = tp.b, k = tp.k;
    for (int i = 0; i < beats.size() && beats.at(i).f <= frame; i += 1) {
      f = beats.at(i).f;
      b = beats.at(i).b;
      k = beats.at(i).k;
    }
    const double q = jsm::round((b + (frame - f) * k) * 96);
    const int64_t c = q > -1e15 && q < 1e15 ? static_cast<int64_t>(q) : 0;
    return hashU(xmx.seedSH, c * 128 + static_cast<int64_t>(jsm::round(midi))) * 2 - 1;
  }

  // ------------------------------------------------------------------ notes
  void noteOn(const NoteEv& n, double frame) {
    const int vmode = static_cast<int>(p[P_voiceMode]);
    Voice* v = nullptr;
    if (vmode != 0) {
      // MONO / LEGATO : une seule voix, la pile des notes tenues
      monoPurge(frame);
      Voice* m = mono.voice >= 0 && mono.voice < nv && voices[mono.voice].on ? &voices[mono.voice] : nullptr;
      const double off = frame + jsm::max(64, jsm::round(n.gate * sampleRate));
      const bool tie = vmode == 2 && m && m->aStage < 3 && frame < m->off;
      monoPush(n.midi, off, frame, n.vel);
      if (tie) {
        // LEGATO, une note encore tenue : la voix glisse vers la note neuve, les enveloppes continuent (aucun
        // tirage du hasard, ni phase, ni place : rien ne repart)
        m->midi = n.midi;
        m->logT = jsm::log(midiHz(n.midi));
        m->off = off;
        m->gK = coef(jsm::max(LEGATO_MIN_S, n.glide > 0 ? n.glide : p[P_glide]) / 3, sr2);
        m->vel = n.vel;
        m->sh = shDraw(n.midi, frame);
        xmx.lastV = mono.voice;
        age += 1;
        m->age = age;
        return;
      }
      v = m;
    } else if (mono.n != 0 || mono.voice >= 0) {
      mono.n = 0;
      mono.voice = -1;
    }
    const bool held = v != nullptr;  // (MONO : la voix sonne encore, elle est reprise telle quelle)
    if (!held)
      for (int i = 0; i < nv; i += 1) {
        Voice* x = &voices[i];
        if (!x->on) v = v && v->age < x->age ? v : x;
      }
    const bool fresh = !held && v != nullptr;
    if (!v) {
      for (int i = 0; i < nv; i += 1)
        if (voices[i].aStage == 3 && (!v || voices[i].aV < v->aV)) v = &voices[i];
      if (!v)
        for (int i = 0; i < nv; i += 1)
          if (!v || voices[i].age < v->age) v = &voices[i];
    }
    if (vmode != 0) {
      // les autres voix (un reste de POLY) se taisent en 12 ms
      mono.voice = static_cast<int>(v - voices);
      for (int i = 0; i < nv; i += 1) {
        Voice& x = voices[i];
        if (&x == v || !x.on) continue;
        x.aStage = 3;
        x.fStage = 3;
        x.quick = true;
      }
    }
    if (fresh) {
      v->s1 = v->s2 = v->s3 = v->s4 = 0;
      v->pu = 0;
      v->aV = 0;
      v->fV = 0;
      LadderR& fr = v->fr;
      fr.pu = fr.s1 = fr.s2 = fr.s3 = fr.s4 = 0;
      for (int j = 0; j < MAX_UNI; j += 1) v->pr[j].sb = v->pr[j].sf = 0;
      for (int j = 0; j < VX_SIZE; j += 1) v->x[j] = 0;
    }
    v->g = 0;
    for (int j = 0; j < MAX_UNI; j += 1) {
      v->pr[j].q1 = QNAN;
      v->pr[j].q2 = QNAN;
    }
    const double target = jsm::log(midiHz(n.midi));
    v->logT = target;
    // (MONO, la voix reprise en plein son et un glissement : il part de la hauteur ou elle est, pas de n.from)
    if (!(held && (p[P_glide] > 0 || n.glide > 0))) v->logf = (p[P_glide] > 0 || n.glide > 0) && n.hasFrom ? jsm::log(midiHz(n.from)) : target;
    // le glissement propre de la note (SLIDE de l'arpegiateur) : son temps a la place de GLIDE, pour cette voix
    v->gK = n.glide > 0 ? coef(n.glide / 3, sr2) : 0;
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
    // la matrice : la velocite et le tirage S&H de la note (poses : elle repart), sa place, son bruit lent a reprendre
    v->vel = n.vel;
    v->velS = n.vel;
    v->sh = shDraw(n.midi, frame);
    v->shS = v->sh;
    v->rSeg = QNAN;
    v->pan = pan;
    v->panSnap = quiet;
    v->mxOk = false;
    xmx.lastV = static_cast<int>(v - voices);
    const double uni = p[P_xUnison];
    stackOn(*v, uni >= 6 ? 7 : uni >= 3 ? 5 : p[P_stack] > 0 ? maxStack : 1, quiet, phase);
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
    const double* offs = n == 7 ? UNI7_OFF : n == 5 ? UNI5_OFF : STACK_OFF[n - 1];
    const double* pans = n == 7 ? UNI7_PAN : n == 5 ? UNI5_PAN : STACK_PAN[n - 1];
    int loop = 1;
    for (int j = 0; j < MAX_UNI; j += 1) {
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
    if (xa.blk) ampTick(yl, yr, newNoise);
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

  // ------------------------------------------------------------------ AMP MODE (2026-11-11, suite)
  /** La primitive de la courbe d'un mode (u : le bus), pour l'ADAA ; la courbe elle-meme : ampY. Gain unite a l'origine. */
  static inline double ampF(int mode, double u, const double* LNC, double tb) {
    if (mode == 1) {
      // TRIODE : (tanh(g u + b) - tanh(b)) / (g sech2(b))
      const double z = AMP_TRI_G * u + AMP_TRI_B;
      const double az = z < 0 ? -z : z;
      const double lc = az < LNC_MAX ? lncTab(LNC, az) : az - LN2;
      return (lc / AMP_TRI_G - u * tb) / (AMP_TRI_G * (1 - tb * tb));
    }
    if (mode == 2) {
      // PENTODE : z - z^3 / 3 jusqu'a |z| = 1, puis 2 / 3 (z = g u), / g
      const double z = AMP_PEN_G * u;
      const double az = z < 0 ? -z : z;
      const double Fz = az < 1 ? 0.5 * z * z - (z * z * z * z) / 12 : (2.0 / 3) * az - 0.25;
      return Fz / (AMP_PEN_G * AMP_PEN_G);
    }
    // SATURATED : tanh(g u) / g
    const double z = AMP_SAT_G * u;
    const double az = z < 0 ? -z : z;
    const double lc = az < LNC_MAX ? lncTab(LNC, az) : az - LN2;
    return lc / (AMP_SAT_G * AMP_SAT_G);
  }
  static inline double ampY(int mode, double u, double tb) {
    if (mode == 1) return (jsm::tanh(AMP_TRI_G * u + AMP_TRI_B) - tb) / (AMP_TRI_G * (1 - tb * tb));
    if (mode == 2) {
      const double z = AMP_PEN_G * u;
      return (z >= 1 ? 2.0 / 3 : z <= -1 ? -2.0 / 3 : z - (z * z * z) / 3) / AMP_PEN_G;
    }
    return jsm::tanh(AMP_SAT_G * u) / AMP_SAT_G;
  }
  /**
   * L'etage de sortie du bus, au taux interne : la courbe du mode par sa primitive (ADAA d'ordre 1), un bloqueur de
   * continu (8 Hz, comme celui du bus), la compensation de niveau (le rapport des energies d'entree et de sortie
   * suivies sur 0.35 s, parti d'un a priori par mode), puis le fondu avec le bus (15 ms : engager, couper, changer de
   * mode : la dose descend, le mode change, elle remonte).
   */
  void ampTick(double& yl, double& yr, bool newNoise) {
    static const double TB = jsm::tanh(AMP_TRI_B);
    const double* LNC = tables().LNC;
    const double tgt = xa.mode == xa.want && xa.want != 0 ? 1 : 0;
    xa.mix += (tgt - xa.mix) * smK;
    if (tgt == 0 && xa.mix < 1e-4) {
      xa.mix = 0;
      if (xa.mode != xa.want) {
        xa.mode = xa.want;
        ampPrior(xa.mode);
        xa.st[0][0] = xa.st[0][1] = xa.st[1][0] = xa.st[1][1] = 0;
        xa.dc[0] = xa.dc[1] = xa.dc[2] = xa.dc[3] = 0;
        xa.lp[0] = xa.lp[1] = xa.lp[2] = xa.lp[3] = 0;
      }
    } else if (tgt == 1 && xa.mix > 1 - 1e-6)
      xa.mix = 1;
    const int mode = xa.mode;
    if (mode == 0) return;
    double in[2] = {yl, yr};
    double out[2];
    for (int ch = 0; ch < 2; ch += 1) {
      const double u = in[ch];
      double* st = xa.st[ch];
      const double F = ampF(mode, u, LNC, TB);
      const double du = u - st[0];
      const double y = du > 1e-6 || du < -1e-6 ? (F - st[1]) / du : ampY(mode, 0.5 * (u + st[0]), TB);
      st[0] = u;
      st[1] = F;
      double* d = xa.dc + 2 * ch;
      d[0] = dcK * (d[0] + y - d[1]);
      d[1] = y;
      out[ch] = d[0];
    }
    // (les energies sous 10 kHz : l'ecretage cree des harmoniques au-dessus de la bande, que le decimateur retirera)
    double* lp = xa.lp;
    lp[0] += (in[0] - lp[0]) * xa.lpK;
    lp[1] += (in[1] - lp[1]) * xa.lpK;
    lp[2] += (out[0] - lp[2]) * xa.lpK;
    lp[3] += (out[1] - lp[3]) * xa.lpK;
    if (newNoise) {
      const double ga = xa.k;
      xa.mi += (lp[0] * lp[0] + lp[1] * lp[1] - xa.mi) * ga;
      xa.mo += (lp[2] * lp[2] + lp[3] * lp[3] - xa.mo) * ga;
      if (xa.mo > 1e-12) {
        const double r = jsm::sqrt(xa.mi / xa.mo);
        xa.gc = r < AMP_GC_MIN ? AMP_GC_MIN : r > AMP_GC_MAX ? AMP_GC_MAX : r;
      }
    }
    yl += (out[0] * xa.gc - yl) * xa.mix;
    yr += (out[1] * xa.gc - yr) * xa.mix;
  }

  void rest(Voice& v) {
    v.pu = v.s1 = v.s2 = v.s3 = v.s4 = 0;
    LadderR& fr = v.fr;
    fr.pu = fr.s1 = fr.s2 = fr.s3 = fr.s4 = fr.u = fr.y1 = fr.y2 = fr.y = 0;
    for (int j = 0; j < MAX_UNI; j += 1) v.pr[j].sb = v.pr[j].sf = 0;
    for (int j = 0; j < VX_SIZE; j += 1) v.x[j] = 0;
    for (int j = 0; j < 3; j += 1) v.fx[0][j] = v.fx[1][j] = 0;
    v.fxA = -1;
    v.hp[0] = v.hp[1] = v.hp[2] = v.hp[3] = 0;
    v.cVal = 0;
    v.cD = 0;
    v.cLp[0] = v.cLp[1] = 0;
    v.fbX[0] = v.fbX[1] = v.fbY[0] = v.fbY[1] = 0;
  }
  void restBus() {
    xa.st[0][0] = xa.st[0][1] = xa.st[1][0] = xa.st[1][1] = 0;
    xa.dc[0] = xa.dc[1] = xa.dc[2] = xa.dc[3] = 0;
    xa.lp[0] = xa.lp[1] = xa.lp[2] = xa.lp[3] = 0;
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
      for (int j = 0; j < 4; j += 1) tiny(v.hp[j]);
      tiny(v.cLp[0]);
      tiny(v.cLp[1]);
      tiny(v.fbX[0]);
      tiny(v.fbX[1]);
      tiny(v.fbY[0]);
      tiny(v.fbY[1]);
    }
    for (int i = 0; i < 4; i += 1) tiny(xa.dc[i]);
    for (int i = 0; i < 4; i += 1) tiny(xa.lp[i]);
    if (xa.mi < TINY) xa.mi = 0;
    if (xa.mo < TINY) xa.mo = 0;
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
  // Deux exemplaires du meme code (2026-11-11, suite). MX = false : aucun controleur, aucune ligne de la matrice,
  // pas de FEEDBACK : ces chemins sont retires a la compilation, le moteur d'avant tel quel (au bit pres, et au meme
  // cout). MX = true : le meme code avec eux. Le choix se fait par bloc (processBlock), sur les memes conditions.
  template <bool MX>
  void processBlockT(float* L, float* R, int N);
  void processBlock(float* L, float* R, int N) {
    bool x = differs(xc.pbT, 0) || differs(xc.mwT, 0) || differs(xc.atT, 0) || differs(xc.pb, 0) || differs(xc.mw, 0) || differs(xc.at, 0) || differs(xc.pbC, 0);
    x = x || p[P_xFeedback] > 0 || xfb.g > 0;
    for (int r = 0; r < MX_ROWS && !x; r += 1) x = (p[P_m1Src + 3 * r] != 0 && p[P_m1Dst + 3 * r] != 0 && differs(p[P_m1Amt + 3 * r], 0)) || differs(xmx.rows[r].a, 0);
    if (x)
      processBlockT<true>(L, R, N);
    else
      processBlockT<false>(L, R, N);
  }
};

template <bool MX>
void Voyager::Impl::processBlockT(float* L, float* R, int N) {
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
  // 2026-11-11, suite : ce qui tourne dans ce bloc. La matrice : une ligne voulue (source, destination, quantite) ou
  // encore en route ; les controleurs : une cible ou une valeur lissee non nulle. A 0 : rien de tout cela ne tourne.
  int mWs[MX_ROWS], mWd[MX_ROWS];
  double mWa[MX_ROWS];
  bool mxBlk0 = false, mxComb0 = false, mxL20 = false;
  for (int r = 0; r < MX_ROWS; r += 1) {
    mWs[r] = static_cast<int>(p[P_m1Src + 3 * r]);
    mWd[r] = static_cast<int>(p[P_m1Dst + 3 * r]);
    mWa[r] = mWs[r] != 0 && mWd[r] != 0 ? p[P_m1Amt + 3 * r] : 0;
    const MxRow& R = xmx.rows[r];
    if (differs(mWa[r], 0) || differs(R.a, 0)) {
      mxBlk0 = true;
      if (mWd[r] == MD_COMB || R.dst == MD_COMB) mxComb0 = true;
      if (mWs[r] == MS_LFO2 || R.src == MS_LFO2) mxL20 = true;
    }
  }
  // (MX = false : tout ceci est faux a la compilation)
  const bool mxBlk = MX && mxBlk0, mxCombBlk = MX && mxComb0, mxL2Blk = MX && mxL20;
  const double pbCT = 100 * p[P_pbRange] * xc.pbT;
  const bool ctlBlk = MX && (differs(xc.pbT, 0) || differs(xc.mwT, 0) || differs(xc.atT, 0) || differs(xc.pb, 0) || differs(xc.mw, 0) || differs(xc.at, 0) || differs(xc.pbC, 0));
  const double pFb = p[P_xFeedback];
  const bool fbBlk = MX && (pFb > 0 || xfb.g > 0);
  if (!fbBlk && xfb.dirty) {
    // FEEDBACK au repos : ses boucles repartiront vides
    xfb.dirty = false;
    for (int vi = 0; vi < nv; vi += 1) voices[vi].fbX[0] = voices[vi].fbX[1] = voices[vi].fbY[0] = voices[vi].fbY[1] = 0;
  }
  xa.want = static_cast<int>(p[P_ampMode]);
  xa.blk = xa.want != 0 || xa.mix > 0;
  if (xs.stackDirty && xs.d1 != E_STACK && xs.d2 - 4 != E_STACK && !(xmx.lastMask & (1 << MD_STACK))) {
    // STACK n'est plus module : les rapports exacts du moteur (la meme formule que stackOn)
    xs.stackDirty = false;
    for (int vi = 0; vi < nv; vi += 1) {
      Voice& v = voices[vi];
      v.stMod = false;
      for (int j = 0; j < MAX_UNI; j += 1) {
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
  bool dcBusy = jsm::abs(dc[0]) + jsm::abs(dc[1]) + jsm::abs(dc[2]) + jsm::abs(dc[3]) > 1e-7;
  if (xa.blk && jsm::abs(xa.dc[0]) + jsm::abs(xa.dc[1]) + jsm::abs(xa.dc[2]) + jsm::abs(xa.dc[3]) > 1e-7) dcBusy = true;
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
    // En silence : les quantites du 2026-11-11 posees (comme celles des LFO)
    xq.ring = p[P_xRing];
    xq.fold = p[P_xFold];
    xq.ncol = p[P_xNoiseCol];
    xq.comb = p[P_xComb];
    xq.combFb = p[P_xCombFb];
    xq.hpMix = p[P_xHpf] > 0 ? 1 : 0;
    if (p[P_xHpf] > 0) xq.hpHz = p[P_xHpf] > X_HPF_MIN ? p[P_xHpf] : X_HPF_MIN;
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
    // 2026-11-11, suite : en silence, tout est pose (les controleurs, les lignes de la matrice, FEEDBACK, AMP MODE)
    if (ctlBlk) {
      xc.pb = xc.pbT;
      xc.mw = xc.mwT;
      xc.at = xc.atT;
      xc.pbC = pbCT;
    }
    if (mxBlk) {
      for (int r = 0; r < MX_ROWS; r += 1) {
        xmx.rows[r].src = mWs[r];
        xmx.rows[r].dst = mWd[r];
        xmx.rows[r].a = mWa[r];
      }
      if (mxL2Blk && l2Want == 0) {
        // le LFO 2 source de la matrice, sa destination propre a OFF : sa valeur de fin de bloc
        const double cyc2 = beatAt(x) / l2Beats;
        const double c2 = jsm::floor(cyc2);
        if (c2 != xs.idx2) l2Cycle(c2);
        xs.raw2 = lfo2Raw(cyc2 - c2, l2Shape, xs.rA2, xs.rB2);
        xs.lfo2 = xs.raw2;
      }
    }
    if (fbBlk) xfb.g = pFb;
    if (xa.blk) ampPose();
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
  // (x8 : la meme largeur de bande absolue qu'en x4, 0.4 x 192 kHz : la FM garde le son du site, sans indice de plus)
  const double fmB = os == 2 ? FM_B_PHONE : os == 8 ? 0.2 : 0.4;
  const double pRatio = p[P_ratio];
  const double pAS = p[P_aS];
  const double pFS = p[P_fS];
  const double keyTrack = p[P_keyTrack];
  const bool fpolNeg = p[P_fpol] == 1;
  ks[KS_CLIPT] = clipT;
  ks[KS_CLIPW] = clipW;
  ki[KI_GLUEON] = glueOn ? 1 : 0;
  ks[KS_GLUE] = p[P_glue];
  // 2026-11-11 : ce qui tourne dans ce bloc (une quantite a son neutre et arrivee : son chemin ne tourne pas)
  const SinTab& ST = sinTab();
  const double pRing = p[P_xRing];
  const double pFold = p[P_xFold];
  const double pNcol = p[P_xNoiseCol];
  const double pComb = p[P_xComb];
  const double pCombFb = p[P_xCombFb];
  const double pHpf = p[P_xHpf] > 0 ? (p[P_xHpf] > X_HPF_MIN ? p[P_xHpf] : X_HPF_MIN) : 0;
  const bool ringBlk = pRing > 0 || xq.ring > 0;
  const bool foldBlk = pFold > 0 || xq.fold > 0;
  const bool ncolBlk = differs(pNcol, 0.5) || differs(xq.ncol, 0.5);
  const bool combBlk = pComb > 0 || xq.comb > 0 || mxCombBlk;
  const bool hpBlk = pHpf > 0 || xq.hpMix > 0;
  const int cbMask = xq.cbMask;
  const double combMaxD = cbMask - 4;
  if (!combBlk) {
    // le peigne au repos : ses lignes repartiront vides
    xq.combFb = pCombFb;
    for (int vi = 0; vi < nv; vi += 1) {
      Voice& v = voices[vi];
      v.cVal = 0;
      v.cD = 0;
      v.cLp[0] = v.cLp[1] = 0;
    }
  }
  if (hpBlk && !(xq.hpMix > 0)) xq.hpHz = pHpf;  // il s'engage : a sa frequence d'emblee (la dose part de 0)
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
    // 2026-11-11, suite. Les controleurs (5 ms) ; le bend deplace toutes les voix (pbRange)
    bool pbOn = false;
    double pbCents = 0;
    if (ctlBlk) {
      xc.pb += (xc.pbT - xc.pb) * xc.k;
      xc.mw += (xc.mwT - xc.mw) * xc.k;
      xc.at += (xc.atT - xc.at) * xc.k;
      xc.pbC += (pbCT - xc.pbC) * xc.k;
      if (xc.pb - xc.pbT < 1e-9 && xc.pbT - xc.pb < 1e-9) xc.pb = xc.pbT;
      if (xc.mw - xc.mwT < 1e-9 && xc.mwT - xc.mw < 1e-9) xc.mw = xc.mwT;
      if (xc.at - xc.atT < 1e-9 && xc.atT - xc.at < 1e-9) xc.at = xc.atT;
      if (xc.pbC - pbCT < 1e-7 && pbCT - xc.pbC < 1e-7) xc.pbC = pbCT;
      pbCents = xc.pbC;
      pbOn = differs(pbCents, 0);
    }
    // (le peigne suit le bend : son rapport, au rythme du contexte)
    const double pbRatio = pbOn && combBlk && i2 % OS == 0 ? jsm::pow(2, pbCents / 1200) : 1;
    // FEEDBACK : la quantite glisse (15 ms)
    double fbG = 0;
    if (fbBlk) {
      xfb.g += (pFb - xfb.g) * K;
      if (!(pFb > 0) && xfb.g < 1e-4) xfb.g = 0;
      fbG = FB_GAIN * xfb.g;
      xfb.dirty = true;
    }
    const bool fbOn = fbG > 0;
    // La matrice. Les quantites glissent (15 ms) ; une ligne ne change de source ou de destination que quand sa
    // quantite est revenue a 0, au rythme du contexte. Les lignes communes (LFO 1 / 2 DEPTH ; DRIVE d'une source
    // commune : l'OVERDRIVE du bus) se calculent ici, les autres par voix (vr, dans la boucle des voix).
    struct {
      int src, dst;
      double a;
      bool bip;
    } vr[MX_ROWS];
    int nVR = 0, vdm = 0, srcM = 0;
    double mxF1 = 1, mxF2 = 1, mxDrvG = 0;
    bool mxLfoD = false, mxDrvOn = false;
    double gMw = 0, gAt = 0, gPb = 0, gL1 = 0, gL2 = 0;  // les sources communes de cet echantillon
    if (mxBlk) {
      const bool nn = i2 % OS == 0;
      bool l2Src = false;
      for (int r = 0; r < MX_ROWS; r += 1) {
        MxRow& R = xmx.rows[r];
        const double tgt = R.src == mWs[r] && R.dst == mWd[r] ? mWa[r] : 0;
        R.a += (tgt - R.a) * K;
        if (!differs(tgt, 0) && R.a < 1e-5 && R.a > -1e-5) {
          R.a = 0;
          if (nn) {
            R.src = mWs[r];
            R.dst = mWd[r];
          }
        }
        if (differs(R.a, 0) && R.src == MS_LFO2) l2Src = true;
      }
      if (l2Src && xs.d2 == 0) {
        // le LFO 2 source de la matrice, sa destination propre a OFF : il tourne ici (comme plus bas)
        if (nn) {
          const double cyc2 = pos / l2Beats;
          const double c2 = jsm::floor(cyc2);
          if (c2 != xs.idx2) l2Cycle(c2);
          xs.raw2 = lfo2Raw(cyc2 - c2, l2Shape, xs.rA2, xs.rB2);
        }
        xs.lfo2 += (xs.raw2 - xs.lfo2) * lfoK;
      }
      gMw = xc.mw;
      gAt = xc.at;
      gPb = xc.pb;
      gL1 = lfoOut;
      gL2 = xs.lfo2;
      double dd1 = 0, dd2 = 0;
      for (int r = 0; r < MX_ROWS; r += 1) {
        const MxRow& R = xmx.rows[r];
        if (!differs(R.a, 0) || R.src == MS_OFF || R.dst == MD_OFF) continue;
        const bool vs = mxVoiceSrc(R.src);
        srcM |= 1 << R.src;
        if (R.dst == MD_LFO1D || R.dst == MD_LFO2D || (R.dst == MD_DRIVE && !vs)) {
          double sv = R.src == MS_MW ? gMw : R.src == MS_AT ? gAt : R.src == MS_PB ? gPb : R.src == MS_LFO1 ? gL1 : gL2;
          if (vs) {
            // (les LFO sont communs : une source par voix y prend la valeur de la voix la plus recente)
            const Voice& lv = voices[xmx.lastV];
            sv = R.src == MS_VEL ? lv.velS : R.src == MS_KEY ? keyOf(lv.logf) : R.src == MS_FENV ? (lv.on ? lv.fV : 0) : R.src == MS_AENV ? (lv.on ? lv.aV : 0) : R.src == MS_SH ? lv.shS : lv.rS;
          }
          if (R.dst == MD_DRIVE) {
            mxDrvG += R.a * sv;
            mxDrvOn = true;
          } else {
            const double u = mxBipolar(R.src) ? 0.5 * (sv + 1) : sv;
            (R.dst == MD_LFO1D ? dd1 : dd2) += R.a > 0 ? R.a * (u - 1) : R.a * u;
            mxLfoD = true;
          }
        } else {
          vr[nVR].src = R.src;
          vr[nVR].dst = R.dst;
          vr[nVR].a = R.a;
          vr[nVR].bip = mxBipolar(R.src);
          nVR += 1;
          vdm |= 1 << R.dst;
        }
      }
      if (mxLfoD) {
        mxF1 = 1 + dd1 < 0 ? 0 : 1 + dd1 > 1 ? 1 : 1 + dd1;
        mxF2 = 1 + dd2 < 0 ? 0 : 1 + dd2 > 1 ? 1 : 1 + dd2;
      }
    }
    const bool mxV = nVR > 0;
    if (vdm != xmx.lastMask) {
      // les destinations par voix changent : les valeurs tenues sont a refaire ; PAN quitte : les places des notes
      const bool panOff = (xmx.lastMask & (1 << MD_PAN)) != 0 && (vdm & (1 << MD_PAN)) == 0;
      for (int vi = 0; vi < nv; vi += 1) {
        Voice& v = voices[vi];
        v.mxOk = false;
        if (panOff && v.mPan) {
          v.mPan = false;
          v.tL = jsm::cos(((v.pan + 1) * JS_PI) / 4) * JS_SQRT2;
          v.tR = jsm::sin(((v.pan + 1) * JS_PI) / 4) * JS_SQRT2;
        }
      }
      xmx.lastMask = vdm;
    }
    sm.lfoAmt += (p[P_lfoAmt] - sm.lfoAmt) * K;
    const double lfo = mxLfoD ? lfoOut * sm.lfoAmt * mxF1 : lfoOut * sm.lfoAmt;
    double waveMod = dest == 0 ? 2 * lfo : dest == 4 ? lfo : 0;
    double cutMod = dest == 1 ? 3 * lfo : dest == 4 ? 1.5 * lfo : 0;
    double pitchMod = dest == 3 ? 100 * lfo : 0;
    const bool newNoise = i2 % OS == 0;
    // Les extensions : xmask, les destinations etendues modulees a cet echantillon (bit E_*), xm leur somme (les deux
    // LFO s'additionnent), en unites de LFO x quantite ; ampG le gain du tremolo. A 0 : rien de ce bloc ne tourne.
    int xmask = 0;
    double xm[E_COUNT] = {0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0};
    double ampG = 1;
    double ampLfoG = 0;
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
      const int e1 = xs.d1;
      const int e2 = xs.d2 >= 5 ? xs.d2 - 4 : 0;
      // (LFO 1 DEPTH / LFO 2 DEPTH de la matrice : les profondeurs x mxF1 / mxF2)
      const double a1e = mxLfoD ? xs.a1 * mxF1 : xs.a1;
      const double a2e = mxLfoD ? xs.a2 * mxF2 : xs.a2;
      xm[e1] += lfoOut * a1e;
      double depthAmp = e1 == E_AMP ? a1e : 0;
      if (xs.d2 != 0) {
        // Le LFO 2 : sa forme au rythme du contexte (tenue), lissee 2 ms au taux interne comme le LFO 1
        if (newNoise) {
          const double cyc2 = pos / l2Beats;
          const double c2 = jsm::floor(cyc2);
          if (c2 != xs.idx2) l2Cycle(c2);
          xs.raw2 = lfo2Raw(cyc2 - c2, l2Shape, xs.rA2, xs.rB2);
        }
        xs.lfo2 += (xs.raw2 - xs.lfo2) * lfoK;
        const double l2 = xs.lfo2 * a2e;
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
            if (e2 == E_AMP) depthAmp += a2e;
            break;
        }
      }
      xmask = ((1 << e1) | (1 << e2)) & ~1;
      if (xmask & (1 << E_AMP)) {
        // AMP : un tremolo, du plein niveau (LFO en haut) jusqu'a -100 % (LFO en bas, quantite 1)
        const double gA = 1 - 0.5 * depthAmp + 0.5 * xm[E_AMP];
        ampG = gA < 0 ? 0 : gA > 1 ? 1 : gA;
        ampLfoG = 0.5 * xm[E_AMP] - 0.5 * depthAmp;
      }
      if (newNoise) {
        if (xmask & (1 << E_PAN)) {
          // PAN : a puissance constante (la loi des voix : 1 au centre, 0 et racine de 2 aux bords)
          const double pv = xm[E_PAN] < -1 ? -1 : xm[E_PAN] > 1 ? 1 : xm[E_PAN];
          xs.panL = pv == 0 ? 1 : jsm::cos(((pv + 1) * JS_PI) / 4) * JS_SQRT2;
          xs.panR = pv == 0 ? 1 : jsm::sin(((pv + 1) * JS_PI) / 4) * JS_SQRT2;
          xs.panOn = pv != 0;
        } else if (xs.panOn) {
          xs.panOn = false;
          xs.panL = xs.panR = 1;
        }
      }
    }
    if (mxDrvOn) {
      // DRIVE d'une source commune : avec les LFO (meme loi, meme borne), OVERDRIVE du bus compris
      xm[E_DRIVE] += mxDrvG;
      xmask |= 1 << E_DRIVE;
    }
    bool xAmp = (xmask & (1 << E_AMP)) != 0;
    const bool xStack = (xmask & (1 << E_STACK)) != 0;
    const double pitchMod2 = (xmask & (1 << E_O2PITCH)) != 0 ? pitchMod + X_O2_CENTS * xm[E_O2PITCH] : pitchMod;
    // STACK : 1 les rapports modules (exp rapide), 2 retour aux rapports exacts (la modulation passe par 0)
    int stackMode = 0;
    double stackX = 0;
    if (xStack && newNoise) {
      if (xm[E_STACK] != 0) {
        const double sv = stD + X_STACK * xm[E_STACK];
        const double hi = stD > X_STACK_MAX ? stD : X_STACK_MAX;
        stackX = ((sv < 0 ? 0 : sv > hi ? hi : sv) * JS_LN2) / 1200;
        stackMode = 1;
        xs.stackDirty = true;
      } else if (xs.stackDirty) {
        stackMode = 2;
        xs.stackDirty = false;
      }
    }
    // 2026-11-11 : les quantites glissent (15 ms) ; le reste a chaque echantillon du contexte
    double gRing = 0;
    if (ringBlk) {
      xq.ring += (pRing - xq.ring) * K;
      if (!(pRing > 0) && xq.ring < 1e-4) xq.ring = 0;
      gRing = xq.ring;
    }
    bool foldOn = false;
    if (foldBlk) {
      xq.fold += (pFold - xq.fold) * K;
      if (!(pFold > 0) && xq.fold < 1e-3) xq.fold = 0;
      foldOn = xq.fold > 0;
      if (newNoise && foldOn) {
        const double a = X_FOLD_A * xq.fold * jsm::sqrt(xq.fold);
        xq.fa = a;
        xq.fs = a <= 1 ? 1 / a : jsm::pow(a, -0.3);
      }
    }
    double foldA = xq.fa;
    double foldS = xq.fs;
    bool ncolOn = false;
    if (ncolBlk) {
      xq.ncol += (pNcol - xq.ncol) * K;
      const double dn = xq.ncol - 0.5;
      if (!differs(pNcol, 0.5) && dn < 1e-4 && dn > -1e-4) xq.ncol = 0.5;
      ncolOn = differs(xq.ncol, 0.5);
      if (newNoise && ncolOn) {
        // sombre : blanc -> rose (a 0.25) -> rouge (a 0) ; brillant : blanc -> bleu (a 1) ; a sonie egale
        const double t = 2 * dn;
        double* w = xq.cw;
        w[0] = w[1] = w[2] = w[3] = 0;
        if (t >= 0) {
          w[0] = 1 - t;
          w[3] = t * NC_BLUE;
        } else if (t > -0.5) {
          w[0] = 1 + 2 * t;
          w[1] = -2 * t * NC_PINK;
        } else {
          w[1] = (2 + 2 * t) * NC_PINK;
          w[2] = (-1 - 2 * t) * xq.redN * NC_RED;
        }
      }
    }
    double gComb = 0;
    if (combBlk) {
      xq.comb += (pComb - xq.comb) * K;
      if (!(pComb > 0) && xq.comb < 1e-4) xq.comb = 0;
      xq.combFb += (pCombFb - xq.combFb) * K;
      gComb = xq.comb;
      if (newNoise && differs(xq.combFb, xq.fbAt)) {
        xq.fbAt = xq.combFb;
        xq.fbI = X_COMB_FB * xq.combFb;
        const double af = xq.fbI < 0 ? -xq.fbI : xq.fbI;
        // Le peigne : entree + ligne (reinjection positive : les bosses sur les harmoniques de la note) ou entree -
        // ligne (negative : entre eux) ; le signe glisse de +1 a -1 entre 0 et -0.2 (aucun saut quand la
        // reinjection traverse 0). Le niveau : la crete 1 + |signe| / (1 - |g|), ramenee a crete^0.7 (positive : les
        // harmoniques de la note sont sur les bosses) ou crete^0.35 (negative : ils sont dans les creux)
        const double sg = xq.fbI >= 0 ? 1 : xq.fbI <= -0.2 ? -1 : 1 + 10 * xq.fbI;
        const double asg = sg < 0 ? -sg : sg;
        xq.sign = sg;
        xq.norm = jsm::pow(1 + asg / (1 - af), sg >= 0 ? -0.7 : -0.7 + 0.35 * asg);
      }
    }
    bool combOn = gComb > 0;
    const double combFb = xq.fbI;
    double combDry = 1 - gComb + gComb * xq.norm;
    double combWet = gComb * xq.norm * xq.sign;
    double hpMix = 0;
    if (hpBlk) {
      xq.hpMix += ((pHpf > 0 ? 1 : 0) - xq.hpMix) * K;
      if (!(pHpf > 0) && xq.hpMix < 1e-4) xq.hpMix = 0;
      if (pHpf > 0) xq.hpHz += (pHpf - xq.hpHz) * K;
      hpMix = xq.hpMix;
      if (newNoise && differs(xq.hpHz, xq.hpAt)) {
        xq.hpAt = xq.hpHz;
        const double hg = jsm::tan((JS_PI * (xq.hpHz < nyq ? xq.hpHz : nyq)) / sr);
        xq.h1 = 1 / (1 + hg * (hg + X_HPF_K));
        xq.h2 = hg * xq.h1;
        xq.h3 = hg * xq.h2;
      }
    }
    const bool hpOn = hpMix > 0;
    const double hpA1 = xq.h1;
    const double hpA2 = xq.h2;
    const double hpA3 = xq.h3;
    sm.fm += (p[P_fm] - sm.fm) * K;
    double fmEff = dest == 2 ? jsm::min(1, jsm::max(0, sm.fm + 0.6 * lfo)) : sm.fm;
    if (fm2On && fm2 != 0) fmEff = jsm::min(1, jsm::max(0, (dest == 2 ? sm.fm + 0.6 * lfo : sm.fm) + fm2));
    double fmDepth = fmEff * fmEff * FM_MAX;
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
    WaveG WG;
    waveShape(WG, sm.w1, sm.w2, waveMod);
    sm.o1 += (p[P_osc1] - sm.o1) * K;
    sm.o2 += (p[P_osc2] - sm.o2) * K;
    double g1G = sm.o1;
    double g2G = sm.o2;
    if (xmask & (1 << E_OSCMIX)) {
      // OSC MIX : la balance (LFO en haut : OSC 2 seul ; en bas : OSC 1 seul ; aucun des deux ne monte)
      const double b = xm[E_OSCMIX] < -1 ? -1 : xm[E_OSCMIX] > 1 ? 1 : xm[E_OSCMIX];
      if (b > 0)
        g1G *= 1 - b;
      else
        g2G *= 1 + b;
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
      // DRIVE : l'ecart au rythme du contexte (tenu : une puissance par valeur, pas par echantillon interne)
      if (newNoise) xs.drv = X_DRIVE * xm[E_DRIVE];
      if (xs.drv != 0) {
        const double dv2 = sm.drive + xs.drv;
        const double hi = sm.drive > 1 ? sm.drive : 1;
        drv = dv2 < 0 ? 0 : dv2 > hi ? hi : dv2;
      }
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
    WG.g1 = g1G;
    WG.g2 = g2G;
    wavePan(WG, wideOn);
    FiltG FG;
    filtCalc(FG, resV, wm, OS, MS_SO);
    double driveIn = 1 + 2.5 * drv;
    const double driveOut = 1 + 1.5 * drv;
    if (drv != outDrive) {
      outDrive = drv;
      outNorm = 1 / jsm::pow(driveOut, 0.82);
    }
    const double outNormv = outNorm;
    double dO = ldOn ? driveOut * ldRel : driveOut;
    double oN = ldOn ? outNormv / ldRel : outNormv;
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
    ks[KS_ODGAIN] = odGain;
    ks[KS_ODMIX] = odMix;
    ks[KS_ODTRIM] = odTrim;
    ks[KS_VSC] = ldOn ? VS_COMP * (1 + ldWet) : VS_COMP;
    ki[KI_NEWNOISE] = newNoise ? 1 : 0;
    // 2026-11-11, suite : ce que la boucle des voix lit des reglages communs (des valeurs de travail). Sans matrice :
    // telles quelles pour toutes les voix (le moteur d'avant, au bit pres, sans une copie de plus). Avec : chaque voix
    // recalcule pour elle celles que les lignes visent (toutes les voix ont les memes destinations : ce qu'une voix a
    // ecrit, la suivante le recrit ; les quatre qui s'ajoutent a la valeur commune repartent d'elle : pmG, pm2G, cutG,
    // ringG). Le bend deplace la hauteur de toutes les voix.
    int i1 = WG.i1, i2w = WG.i2w;
    double f1m = WG.f1m, f2m = WG.f2m, pwd1 = WG.pwd1, pwd2 = WG.pwd2, g1 = WG.g1, g2 = WG.g2, pn1 = WG.pn1, pn2 = WG.pn2, pn2w = WG.pn2w;
    bool pwm1 = WG.pwm1, pwm2 = WG.pwm2;
    double k = FG.k, kTune = FG.kTune, w0 = FG.w0, w1 = FG.w1, w2 = FG.w2, w3 = FG.w3, w4 = FG.w4, c35o = FG.c35o, sB7 = FG.sB7, KK = FG.KK, omK = FG.omK;
    bool ladOn = FG.ladOn, k35x2 = FG.k35x2;
    double pmV = pbOn ? pitchMod + pbCents : pitchMod;
    double pm2V = pbOn ? pitchMod2 + pbCents : pitchMod2;
    double cutV = cutMod, envVv = envV;
    const double pmG = pmV, pm2G = pm2V, cutG = cutV, ringG = gRing;
    double sum = 0;
    double sumR = 0;
    for (int vi = 0; vi < nv; vi += 1) {
      Voice& v = voices[vi];
      if (!v.on) continue;
      if (v.aStage < 3 && fr >= v.off) {
        // (MONO / LEGATO : retour a la derniere note encore tenue, sans redeclencher)
        if (!(mono.n > 0 && vi == mono.voice && monoReturn(v, fr))) {
          v.aStage = 3;
          v.fStage = 3;
        }
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
      v.logf += (v.logT - v.logf) * (v.gK > 0 ? v.gK : cc.glide);
      if (mxV) {
        // 2026-11-11, suite : la matrice, par voix
        // les sources de la voix (la velocite et S&H lisses 5 ms, le bruit lent : un segment par temps, par position)
        if (srcM & (1 << MS_VEL)) v.velS += (v.vel - v.velS) * xc.k;
        if (srcM & (1 << MS_SH)) v.shS += (v.sh - v.shS) * xc.k;
        if (srcM & (1 << MS_RND)) {
          if (newNoise) {
            const bool snap = v.rSeg != v.rSeg;
            const double rp = pos + v.rOff;
            const double rc = jsm::floor(rp);
            if (rc != v.rSeg) {
              v.rSeg = rc;
              const int64_t c = rc > -1e15 && rc < 1e15 ? static_cast<int64_t>(rc) : 0;
              v.rA = hashU(xmx.seedRnd, c * MAX_VOICES + vi) * 2 - 1;
              v.rB = hashU(xmx.seedRnd, (c + 1) * MAX_VOICES + vi) * 2 - 1;
            }
            const double ph = rp - rc;
            v.rRaw = v.rA + (v.rB - v.rA) * ph * ph * (3 - 2 * ph);
            if (snap) v.rS = v.rRaw;
          }
          v.rS += (v.rRaw - v.rS) * lfoK;
        }
        const double S[MS_COUNT] = {0, v.velS, gMw, gAt, gPb, (srcM & (1 << MS_KEY)) != 0 ? keyOf(v.logf) : 0, gL1, gL2, v.fV, v.aV, v.shS, v.rS};
        // les sommes par destination (seules les destinations visees sont remises a 0 puis lues)
        double mv[MD_COUNT];
        for (int r = 0; r < nVR; r += 1) mv[vr[r].dst] = 0;
        for (int r = 0; r < nVR; r += 1) {
          const double sv = S[vr[r].src];
          if (vr[r].dst == MD_AMP) {
            // AMP : un VCA (quantite positive : plein niveau source en haut ; negative : source en haut, moins fort)
            const double u = vr[r].bip ? 0.5 * (sv + 1) : sv;
            mv[MD_AMP] += vr[r].a > 0 ? vr[r].a * (u - 1) : vr[r].a * u;
          } else
            mv[vr[r].dst] += vr[r].a * sv;
        }
        const auto mxSum = [&](int d) { return (vdm & (1 << d)) != 0 ? mv[d] : 0.0; };
        // (vRe : les valeurs cheres sont tenues au rythme du contexte, comme la coupure et la hauteur)
        const bool vRe = newNoise || !v.mxOk;
        v.mxOk = true;
        if (vdm & ((1 << MD_PITCH) | (1 << MD_O2PITCH))) {
          const double mp = mxSum(MD_PITCH);
          pmV = pmG + MX_PITCH * mp;
          pm2V = pm2G + MX_PITCH * (mp + mxSum(MD_O2PITCH));
        }
        if (vdm & (1 << MD_CUTOFF)) cutV = cutG + MX_CUT * mxSum(MD_CUTOFF);
        if (vdm & (1 << MD_ENV)) {
          const double ev = sm.envOct + X_ENV * (xm[E_ENV] + mxSum(MD_ENV));
          const double hi = sm.envOct > X_ENV_MAX ? sm.envOct : X_ENV_MAX;
          envVv = ev < 0 ? 0 : ev > hi ? hi : ev;
        }
        if (vdm & (1 << MD_FM)) {
          const double fe = (dest == 2 ? sm.fm + 0.6 * lfo : sm.fm) + (fm2On ? fm2 : 0) + MX_FM * mxSum(MD_FM);
          const double hi = sm.fm > 1 ? sm.fm : 1;
          const double fc2 = fe < 0 ? 0 : fe > hi ? hi : fe;
          fmDepth = fc2 * fc2 * FM_MAX;
        }
        if (vdm & (1 << MD_NOISE)) {
          const double nv2 = sm.noise + X_NOISE * (xm[E_NOISE] + mxSum(MD_NOISE));
          const double hi = sm.noise > 1 ? sm.noise : 1;
          const double nc = nv2 < 0 ? 0 : nv2 > hi ? hi : nv2;
          nGain = nc * nc * NOISE_MAX;
        }
        if (vdm & (1 << MD_SUB)) {
          const double sv = sm.sub + X_SUB * (xm[E_SUB] + mxSum(MD_SUB));
          const double hi = sm.sub > X_SUB ? sm.sub : X_SUB;
          g3 = sv < 0 ? 0 : sv > hi ? hi : sv;
        }
        if (vdm & (1 << MD_RING)) {
          const double rv = ringG + mxSum(MD_RING);
          gRing = rv < 0 ? 0 : rv > 1 ? 1 : rv;
        }
        if (vdm & (1 << MD_FOLD)) {
          if (vRe) {
            const double fv = (foldBlk ? xq.fold : 0) + mxSum(MD_FOLD);
            const double fo = fv < 0 ? 0 : fv > 1 ? 1 : fv;
            if (fo > 1e-4) {
              const double a = X_FOLD_A * fo * jsm::sqrt(fo);
              v.mFa = a;
              v.mFs = a <= 1 ? 1 / a : jsm::pow(a, -0.3);
            } else
              v.mFa = 0;
          }
          foldOn = v.mFa > 0;
          foldA = v.mFa;
          foldS = v.mFs;
        }
        if (vdm & ((1 << MD_WAVE) | (1 << MD_OSCMIX))) {
          WaveG& W = v.mW;
          W.i1 = i1, W.i2w = i2w, W.f1m = f1m, W.f2m = f2m, W.pwd1 = pwd1, W.pwd2 = pwd2, W.pwm1 = pwm1, W.pwm2 = pwm2;
          if (vdm & (1 << MD_WAVE)) waveShape(W, sm.w1, sm.w2, waveMod + MX_WAVE * mxSum(MD_WAVE));
          const double bx = xm[E_OSCMIX] + ((vdm & (1 << MD_OSCMIX)) != 0 ? mxSum(MD_OSCMIX) : 0);
          const double b = bx < -1 ? -1 : bx > 1 ? 1 : bx;
          W.g1 = b > 0 ? sm.o1 * (1 - b) : sm.o1;
          W.g2 = b > 0 ? sm.o2 : sm.o2 * (1 + b);
          wavePan(W, wideOn);
          i1 = W.i1, i2w = W.i2w, f1m = W.f1m, f2m = W.f2m, pwd1 = W.pwd1, pwd2 = W.pwd2, g1 = W.g1, g2 = W.g2;
          pn1 = W.pn1, pn2 = W.pn2, pn2w = W.pn2w, pwm1 = W.pwm1, pwm2 = W.pwm2;
        }
        if (vdm & (1 << MD_RES)) {
          if (vRe) {
            const double rv = sm.res + X_RES * (xm[E_RES] + mxSum(MD_RES));
            const double hi = sm.res > 1 ? sm.res : 1;
            filtCalc(v.mF, rv < 0 ? 0 : rv > hi ? hi : rv, wm, OS, MS_SO);
          }
          const FiltG& F = v.mF;
          k = F.k, kTune = F.kTune, w0 = F.w0, w1 = F.w1, w2 = F.w2, w3 = F.w3, w4 = F.w4, c35o = F.c35o, sB7 = F.sB7;
          KK = F.KK, omK = F.omK, ladOn = F.ladOn, k35x2 = F.k35x2;
        }
        if (vdm & (1 << MD_DRIVE)) {
          // DRIVE d'une source par voix : l'entree du filtre et le VCA de la voix (l'OVERDRIVE du bus reste commun)
          if (vRe) {
            const double dv2 = sm.drive + ((xmask & (1 << E_DRIVE)) != 0 ? xs.drv : 0) + X_DRIVE * mxSum(MD_DRIVE);
            const double hi = sm.drive > 1 ? sm.drive : 1;
            const double dc2 = dv2 < 0 ? 0 : dv2 > hi ? hi : dv2;
            if (differs(dc2, v.mDrv)) {
              v.mDrv = dc2;
              v.mON = 1 / jsm::pow(1 + 1.5 * dc2, 0.82);
            }
          }
          driveIn = 1 + 2.5 * v.mDrv;
          dO = ldOn ? (1 + 1.5 * v.mDrv) * ldRel : 1 + 1.5 * v.mDrv;
          oN = ldOn ? v.mON / ldRel : v.mON;
        }
        if (vdm & (1 << MD_AMP)) {
          const double gA = 1 + ampLfoG + mv[MD_AMP];
          ampG = gA < 0 ? 0 : gA > 1 ? 1 : gA;
          xAmp = true;
        }
        if (vdm & (1 << MD_COMB)) {
          // (le peigne tourne tant que la matrice le vise, meme a dose nulle : sa ligne reste pleine)
          const double cg = gComb + mxSum(MD_COMB);
          const double gc2 = cg < 0 ? 0 : cg > 1 ? 1 : cg;
          combOn = true;
          combDry = 1 - gc2 + gc2 * xq.norm;
          combWet = gc2 * xq.norm * xq.sign;
        }
        if ((vdm & (1 << MD_PAN)) && vRe) {
          // PAN : la place de la voix, autour de celle de la note (a puissance constante, lissee 4 ms comme elle)
          const double px = v.pan + mxSum(MD_PAN);
          const double pv = px < -1 ? -1 : px > 1 ? 1 : px;
          v.tL = jsm::cos(((pv + 1) * JS_PI) / 4) * JS_SQRT2;
          v.tR = jsm::sin(((pv + 1) * JS_PI) / 4) * JS_SQRT2;
          v.mPan = true;
          if (v.panSnap && fr == v.start) {
            v.gL = v.tL;
            v.gR = v.tR;
          }
          v.panSnap = false;
        }
        if ((vdm & (1 << MD_STACK)) && newNoise) {
          // STACK : l'ecart de la voix (avec les LFO), ou le retour aux rapports exacts quand la somme repasse par 0
          const double tot = xm[E_STACK] + mxSum(MD_STACK);
          if (tot != 0) {
            const double sv = stD + X_STACK * tot;
            const double hi = stD > X_STACK_MAX ? stD : X_STACK_MAX;
            const double sx = ((sv < 0 ? 0 : sv > hi ? hi : sv) * JS_LN2) / 1200;
            for (int j = 0; j < v.nLoop; j += 1) {
              StackPair& P = v.pr[j];
              P.r = P.off == 0 ? 1 : expSmall(P.off * sx);
            }
            v.stMod = true;
            xs.stackDirty = true;
          } else if (v.stMod) {
            v.stMod = false;
            for (int j = 0; j < v.nLoop; j += 1) {
              StackPair& P = v.pr[j];
              P.r = P.off == 0 ? 1 : jsm::pow(2, (P.off * stD) / 1200);
            }
          }
        }
      }
      if (newNoise || v.d1 == 0) {
        const double f = jsm::exp(v.logf);
        if (combOn) {
          // COMB : une periode de la note jouee (son glissement et le bend compris), moins le retard de l'amortissement
          double cd = sr / (pbOn ? f * pbRatio : f) - xq.dampD;
          while (cd > combMaxD) cd *= 0.5;
          v.cDt = cd < 2 ? 2 : cd;
        }
        v.d1 = (f * ratio1 * jsm::pow(2, ((v.drift[0] + v.calT[0]) * drift + fine1 + v.vTune + pmV) / 1200)) / sr;
        v.d2 = (f * ratio2 * jsm::pow(2, ((v.drift[1] + v.calT[1]) * drift + fine2 + v.vTune + pm2V) / 1200)) / sr;
        v.d3 = (v.d1 * subDiv) / ratio1;
      }
      if (stackMode != 0 && !(vdm & (1 << MD_STACK)))
        for (int j = 0; j < v.nLoop; j += 1) {
          StackPair& P = v.pr[j];
          P.r = P.off == 0 ? 1 : stackMode == 1 ? expSmall(P.off * stackX) : jsm::pow(2, (P.off * stD) / 1200);
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
        if (gRing > 0) {
          // RING : OSC 1 x OSC 2 de cet exemplaire, au centre
          const double rg = gRing * (o1 * o2) * gj;
          if (differs(wide, 0)) {
            o += rg * wn;
            oR += rg * wn;
          } else
            o += rg;
        }
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
          if (ncolOn) {
            // NOISE COLOR, au rythme du bruit : rose (Kellett, trois poles), rouge (un pole), bleu (la difference)
            const double wn0 = v.nz;
            double* c = v.nc;
            c[0] = 0.99765 * c[0] + wn0 * 0.099046;
            c[1] = 0.963 * c[1] + wn0 * 0.2965164;
            c[2] = 0.57 * c[2] + wn0 * 1.0526913;
            c[3] = xq.redR * c[3] + wn0;
            const double* w = xq.cw;
            v.nzc = w[0] * wn0 + w[1] * (c[0] + c[1] + c[2] + wn0 * 0.1848) + w[2] * c[3] + w[3] * (wn0 - c[4]);
            c[4] = wn0;
          }
        }
        const double nzv = ncolOn ? v.nzc : v.nz;
        o += nGain * nzv;
        oR += nGain * nzv;
      }
      if (foldOn) {
        // FOLD : le melange (oscillateurs, RING, SUB, bruit) replie avant le filtre
        const bool fresh = differs(v.fxA, foldA);
        v.fxA = foldA;
        const bool wasMono = !differs(v.fx[1][0], v.fx[0][0]) && !differs(v.fx[1][1], v.fx[0][1]);
        const double xl = o;
        o = foldAdaa2(ST, xl, v.fx[0], foldA, fresh) * foldS;
        if (differs(wide, 0))
          oR = foldAdaa2(ST, oR, v.fx[1], foldA, fresh || wasMono) * foldS;
        else {
          // (la droite suit la gauche tant que WIDE ne l'en separe pas)
          v.fx[1][0] = v.fx[0][0];
          v.fx[1][1] = v.fx[0][1];
        }
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
      if (fbOn) {
        // FEEDBACK : la sortie de la voix (apres le VCA, un echantillon interne plus tot, sans son continu) revient a
        // l'entree du filtre a travers une tanh : la boucle est bornee par elle et par le VCA
        const double u = v.fbY[0];
        const double au = u < 0 ? -u : u;
        const double th = au < LNC_MAX ? lncSlope(LNC, au) : 1;
        xd += fbG * (u < 0 ? -th : th);
        if (wideV) {
          if (!v.wl) {
            v.fbX[1] = v.fbX[0];
            v.fbY[1] = v.fbY[0];
          }
          const double uR = v.fbY[1];
          const double auR = uR < 0 ? -uR : uR;
          const double thR = auR < LNC_MAX ? lncSlope(LNC, auR) : 1;
          xdR += fbG * (uR < 0 ? -thR : thR);
        }
      }
      if (newNoise || (ladOn ? v.g == 0 || (spW && v.gS == 0) : X[VX_G35] == 0 || (spW && X[VX_G35R] == 0))) {
        double env = envVv * v.fV * (0.8 + 0.2 * v.accent) * v.envAcc;
        if (fpolNeg) env = -env;
        if (ladOn) {
          double fc = sm.cutoff * v.vCut * jsm::pow(2, cutV + env + v.cutAcc + v.calC * drift + (keyTrack * (v.midi - TRACK_ROOT)) / 12 + kTune);
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
          double f35 = sm.cutoff * jsm::pow(2, sB7 * v.vCutE + cutV + env + v.cutAcc + sB7 * v.calC * drift + (keyTrack * (v.midi - TRACK_ROOT)) / 12 + c35o);
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
      // 2026-11-11 : COMB puis HIGH PASS, apres le filtre de la voix
      int cwi = 0;
      int cdi = 2;
      double cl0 = 0, cl1 = 0, cl2 = 0, cl3 = 0;
      if (combOn) {
        const double cdt = v.cDt < 2 ? 2 : v.cDt;
        if (!(v.cD > 0)) v.cD = cdt;
        v.cD += (cdt - v.cD) * xq.combK;
        cwi = v.cw;
        v.cw = (cwi + 1) & cbMask;
        cdi = static_cast<int>(v.cD);
        const double d = v.cD - cdi + 1;
        // Lagrange d'ordre 3 sur quatre points (retards cdi - 1 .. cdi + 2)
        cl0 = -((d - 1) * (d - 2) * (d - 3)) / 6;
        cl1 = (d * (d - 2) * (d - 3)) / 2;
        cl2 = -(d * (d - 1) * (d - 3)) / 2;
        cl3 = (d * (d - 1) * (d - 2)) / 6;
        yo = combDry * yo + combWet * combTick(v, 0, yo, cwi, cdi, cbMask, cl0, cl1, cl2, cl3, xq.damp, combFb);
        if (v.cVal <= cbMask) v.cVal += 1;
      }
      if (hpOn) {
        const double v3 = yo - v.hp[1];
        const double v1 = hpA1 * v.hp[0] + hpA2 * v3;
        const double v2 = v.hp[1] + hpA2 * v.hp[0] + hpA3 * v3;
        v.hp[0] = 2 * v1 - v.hp[0];
        v.hp[1] = 2 * v2 - v.hp[1];
        yo -= hpMix * (X_HPF_K * v1 + v2);
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
      if (fbOn) {
        v.fbY[0] = xfb.r * (v.fbY[0] + a - v.fbX[0]);
        v.fbX[0] = a;
      }
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
      if (startR && (combOn || hpOn)) yoR = yo;  // la droite part de la gauche, etats et sortie
      if (combOn) {
        if (startR) {
          std::memcpy(v.cb[1], v.cb[0], sizeof(float) * (static_cast<size_t>(cbMask) + 1));
          v.cLp[1] = v.cLp[0];
        } else if (v.cVal > 0) {
          v.cVal -= 1;  // (la gauche vient de compter cet echantillon : les deux lignes ont le meme age)
          yoR = combDry * yoR + combWet * combTick(v, 1, yoR, cwi, cdi, cbMask, cl0, cl1, cl2, cl3, xq.damp, combFb);
          v.cVal += 1;
        }
      }
      if (hpOn) {
        if (startR) {
          v.hp[2] = v.hp[0];
          v.hp[3] = v.hp[1];
        } else {
          const double v3 = yoR - v.hp[3];
          const double v1 = hpA1 * v.hp[2] + hpA2 * v3;
          const double v2 = v.hp[3] + hpA2 * v.hp[2] + hpA3 * v3;
          v.hp[2] = 2 * v1 - v.hp[2];
          v.hp[3] = 2 * v2 - v.hp[3];
          yoR -= hpMix * (X_HPF_K * v1 + v2);
        }
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
      if (fbOn) {
        v.fbY[1] = xfb.r * (v.fbY[1] + aR - v.fbX[1]);
        v.fbX[1] = aR;
      }
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
void Voyager::note(double timeSec, double midi, double gateSec, double accent, double fromMidi, double glideSec, double velocity) {
  m_->add(timeSec, midi, gateSec, accent, fromMidi, glideSec, velocity);
}
void Voyager::pitchBend(double v) { m_->xc.pbT = v != v ? 0 : v < -1 ? -1 : v > 1 ? 1 : v; }
void Voyager::modWheel(double v) { m_->xc.mwT = v != v ? 0 : v < 0 ? 0 : v > 1 ? 1 : v; }
void Voyager::aftertouch(double v) { m_->xc.atT = v != v ? 0 : v < 0 ? 0 : v > 1 ? 1 : v; }
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
