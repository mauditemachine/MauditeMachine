// Le banc des fonctions du 2026-11-11 (suite) du plugin MM-ARP (le VST3 seul) : dans le moteur (dsp/Voyager) les
// controleurs (bend, molette, aftertouch, velocite), la matrice de modulation (6 lignes, 11 sources, 19 destinations),
// VOICE MODE (MONO, LEGATO), FEEDBACK et AMP MODE ; dans la chaine (dsp/ArpFx) la DISTORTION et l'EQ 4 bandes. Sans
// reference JS (le site ne connait pas ces reglages), sans aucun son : des tableaux. La regle verifiee partout :
// chaque reglage neuf a son neutre rend la sortie d'avant AU BIT PRES (les empreintes sont celles de hq2_test, prises
// sur le moteur d'avant le 2026-11-11), sans un tirage de hasard de plus.
//   g++ -O2 -std=c++17 -Wall -Wextra -ffp-contract=off -I plugin/mm-arp/dsp plugin/mm-arp/tests/hq3_test.cpp
//       plugin/mm-arp/dsp/Voyager.cpp plugin/mm-arp/dsp/ArpFx.cpp -o hq3_test                  (une seule ligne)
//   ./hq3_test           tous les controles ; code de sortie 1 au premier echec
//   ./hq3_test --cpu     le cout de la matrice (6 lignes, 12 voix, x4 et x8), de FEEDBACK, d'AMP MODE, de la DISTORTION, de l'EQ
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <complex>
#include <cstdarg>
#include <cstdint>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <functional>
#include <new>
#include <string>
#include <vector>

#include "../dsp/ArpFx.h"
#include "../dsp/Voyager.h"

/* ---- les allocations ET les liberations, comptees ensemble (le chemin temps reel n'en fait aucune), comme hq_test ---- */
static std::atomic<long> gAllocs{0};
#define HQ_NOINLINE __attribute__((noinline))
HQ_NOINLINE void* operator new(std::size_t n) {
  gAllocs.fetch_add(1, std::memory_order_relaxed);
  if (void* p = std::malloc(n ? n : 1)) return p;
  throw std::bad_alloc();
}
HQ_NOINLINE void* operator new[](std::size_t n) {
  gAllocs.fetch_add(1, std::memory_order_relaxed);
  if (void* p = std::malloc(n ? n : 1)) return p;
  throw std::bad_alloc();
}
HQ_NOINLINE void operator delete(void* p) noexcept {
  if (p) gAllocs.fetch_add(1, std::memory_order_relaxed);
  std::free(p);
}
HQ_NOINLINE void operator delete[](void* p) noexcept {
  if (p) gAllocs.fetch_add(1, std::memory_order_relaxed);
  std::free(p);
}
HQ_NOINLINE void operator delete(void* p, std::size_t) noexcept {
  if (p) gAllocs.fetch_add(1, std::memory_order_relaxed);
  std::free(p);
}
HQ_NOINLINE void operator delete[](void* p, std::size_t) noexcept {
  if (p) gAllocs.fetch_add(1, std::memory_order_relaxed);
  std::free(p);
}

namespace {

using mmarp::ArpFx;
using mmarp::ArpFxSettings;
using mmarp::Voyager;
using mmarp::VoyagerOptions;
using KV = std::vector<std::pair<std::string, double>>;
using Buf = std::vector<float>;

constexpr double SR = 48000;
constexpr double PI = 3.14159265358979323846;
const double QNAN = std::nan("");
const double INF = HUGE_VAL;

// les sources et les destinations de la matrice, dans l'ordre d'extra-params.json
enum { S_OFF = 0, S_VEL, S_MW, S_AT, S_PB, S_KEY, S_LFO1, S_LFO2, S_FENV, S_AENV, S_SH, S_RND };
enum { D_OFF = 0, D_PITCH, D_O2PITCH, D_WAVE, D_FM, D_OSCMIX, D_NOISE, D_SUB, D_RING, D_FOLD, D_CUTOFF, D_RES, D_ENV, D_DRIVE, D_AMP, D_PAN, D_STACK, D_LFO1D, D_LFO2D, D_COMB };

int gFails = 0, gChecks = 0;

void check(bool ok, const char* fmt, ...) __attribute__((format(printf, 2, 3)));
void check(bool ok, const char* fmt, ...) {
  char msg[900];
  va_list ap;
  va_start(ap, fmt);
  std::vsnprintf(msg, sizeof msg, fmt, ap);
  va_end(ap);
  gChecks += 1;
  if (!ok) gFails += 1;
  std::printf("  %s %s\n", ok ? "ok   " : "ECHEC", msg);
}

uint64_t fnv(const Buf& a, uint64_t h = 1469598103934665603ull) {
  for (float f : a) {
    uint32_t u;
    std::memcpy(&u, &f, 4);
    for (int i = 0; i < 4; ++i) {
      h ^= (u >> (8 * i)) & 255u;
      h *= 1099511628211ull;
    }
  }
  return h;
}
double db(double x) { return 20 * std::log10(std::max(x, 1e-300)); }
bool same(const Buf& a, const Buf& b) { return a.size() == b.size() && std::memcmp(a.data(), b.data(), a.size() * 4) == 0; }
bool sameFrom(const Buf& a, const Buf& b, size_t from) { return a.size() == b.size() && from <= a.size() && std::memcmp(a.data() + from, b.data() + from, (a.size() - from) * 4) == 0; }
bool finite(const Buf& a) {
  for (float x : a)
    if (!std::isfinite(x)) return false;
  return true;
}
size_t at(double seconds) { return static_cast<size_t>(seconds * SR + 0.5); }
double peak(const Buf& a, double t0 = 0, double t1 = 1e9) {
  double p = 0;
  for (size_t i = at(t0); i < std::min(a.size(), t1 > 1e8 ? a.size() : at(t1)); ++i) p = std::max(p, std::fabs(static_cast<double>(a[i])));
  return p;
}
double rms(const Buf& a, double t0 = 0, double t1 = 1e9) {
  const size_t from = at(t0), to = std::min(a.size(), t1 > 1e8 ? a.size() : at(t1));
  double e = 0;
  for (size_t i = from; i < to; ++i) e += static_cast<double>(a[i]) * a[i];
  return std::sqrt(e / static_cast<double>(std::max<size_t>(1, to - from)));
}
/** La plus grande derivee seconde (un saut ou un coude la font bondir). */
double d2max(const Buf& a, double t0, double t1) {
  double m = 0;
  for (size_t i = std::max<size_t>(at(t0), 1); i + 1 < std::min(at(t1), a.size()); ++i) m = std::max(m, std::fabs(static_cast<double>(a[i + 1]) - 2.0 * a[i] + a[i - 1]));
  return m;
}
/** L'ecart entre deux rendus, en dB sous le premier, entre t0 et t1. */
double diffDb(const Buf& a, const Buf& b, double t0, double t1) {
  double e = 0, s = 0;
  for (size_t i = at(t0); i < std::min({a.size(), b.size(), at(t1)}); ++i) {
    const double d = static_cast<double>(a[i]) - b[i];
    e += d * d;
    s += static_cast<double>(a[i]) * a[i];
  }
  return s > 0 ? 10 * std::log10(std::max(e, 1e-300) / s) : 0;
}
/** La frequence moyenne entre t0 et t1 : les passages par zero montants (un son a une seule composante forte). */
double hzIn(const Buf& x, double t0, double t1) {
  double first = -1, last = -1;
  int n = 0;
  for (size_t i = at(t0) + 1; i < std::min(x.size(), at(t1)); ++i)
    if (x[i - 1] < 0 && x[i] >= 0) {
      const double z = static_cast<double>(i - 1) + static_cast<double>(-x[i - 1]) / (static_cast<double>(x[i]) - x[i - 1]);
      if (first < 0) first = z;
      last = z;
      n += 1;
    }
  return n > 1 ? SR * (n - 1) / (last - first) : 0;
}
double midiHz(double m) { return 440 * std::pow(2.0, (m - 69) / 12); }
double noteOf(double hz) { return hz > 0 ? 69 + 12 * std::log2(hz / 440) : -999; }
/** La note a l'instant t : la periode (entre deux passages par zero montants) qui le contient. */
double noteAt(const Buf& x, double t) {
  const double c = t * SR;
  double prev = -1;
  for (size_t i = at(t) > 2400 ? at(t) - 2400 : 1; i < std::min(x.size(), at(t) + 2400); ++i)
    if (x[i - 1] < 0 && x[i] >= 0) {
      const double z = static_cast<double>(i - 1) + static_cast<double>(-x[i - 1]) / (static_cast<double>(x[i]) - x[i - 1]);
      if (prev >= 0 && z >= c) return noteOf(SR / (z - prev));
      prev = z;
    }
  return -999;
}
/** La note (midi, fractionnaire) entre t0 et t1. */
double noteIn(const Buf& x, double t0, double t1) { return noteOf(hzIn(x, t0, t1)); }

/* ---------------- FFT et spectres (hq2_test) ---------------- */
void fft(std::vector<std::complex<double>>& a) {
  const size_t n = a.size();
  for (size_t i = 1, j = 0; i < n; ++i) {
    size_t bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) std::swap(a[i], a[j]);
  }
  for (size_t len = 2; len <= n; len <<= 1) {
    const std::complex<double> wl = std::polar(1.0, -2 * PI / static_cast<double>(len));
    for (size_t i = 0; i < n; i += len) {
      std::complex<double> w(1, 0);
      for (size_t j = 0; j < len / 2; ++j) {
        const std::complex<double> u = a[i + j], v = a[i + j + len / 2] * w;
        a[i + j] = u + v;
        a[i + j + len / 2] = u - v;
        w *= wl;
      }
    }
  }
}
double besselI0(double x) {
  double sum = 1, term = 1;
  for (int k = 1; k < 200; ++k) {
    term *= (x / (2 * k)) * (x / (2 * k));
    sum += term;
    if (term < 1e-17 * sum) break;
  }
  return sum;
}
/** Le spectre d'amplitude de n = 2^k echantillons (fenetre de Kaiser ; beta 30 : lobe principal +/-10 cases, rien dessous). */
std::vector<double> spectrum(const float* x, size_t n, double beta = 30) {
  std::vector<std::complex<double>> a(n);
  const double i0b = besselI0(beta);
  double wsum = 0;
  for (size_t i = 0; i < n; ++i) {
    const double r = (2.0 * static_cast<double>(i) - static_cast<double>(n - 1)) / static_cast<double>(n - 1);
    const double w = besselI0(beta * std::sqrt(std::max(0.0, 1 - r * r))) / i0b;
    a[i] = x[i] * w;
    wsum += w;
  }
  fft(a);
  std::vector<double> m(n / 2);
  for (size_t i = 0; i < n / 2; ++i) m[i] = 2 * std::abs(a[i]) / wsum;
  return m;
}
/** La raie la plus forte autour de hz (+/- cases). */
double lineAt(const std::vector<double>& m, size_t n, double hz, int around = 12) {
  const long c = std::lround(hz * static_cast<double>(n) / SR);
  double v = 0;
  for (long b = c - around; b <= c + around; ++b)
    if (b >= 0 && b < static_cast<long>(m.size())) v = std::max(v, m[static_cast<size_t>(b)]);
  return v;
}
/** L'amplitude de la raie a hz dans 32768 echantillons a partir de t0. */
double lineIn(const Buf& x, double t0, double hz, int around = 12) {
  const size_t n = 32768;
  if (at(t0) + n > x.size()) return 0;
  return lineAt(spectrum(x.data() + at(t0), n), n, hz, around);
}
/** Un signal periodique de fondamentale f0 : la raie la plus forte hors harmoniques entre lo et hi, en dBc. */
double aliasDbc(const float* x, size_t n, double f0, double lo, double hi, double* atHz = nullptr) {
  const std::vector<double> m = spectrum(x, n);
  const double binHz = SR / static_cast<double>(n);
  std::vector<char> harm(m.size(), 0);
  double fund = 0;
  for (int k = 1; k * f0 < SR / 2 + f0; ++k) {
    const long c = std::lround(k * f0 / binHz);
    for (long b = c - 14; b <= c + 14; ++b)
      if (b >= 0 && b < static_cast<long>(m.size())) {
        harm[static_cast<size_t>(b)] = 1;
        if (k == 1) fund = std::max(fund, m[static_cast<size_t>(b)]);
      }
  }
  double worst = 0;
  for (size_t b = static_cast<size_t>(lo / binHz); b < m.size() && static_cast<double>(b) * binHz <= hi; ++b)
    if (!harm[b] && m[b] > worst) {
      worst = m[b];
      if (atHz) *atHz = static_cast<double>(b) * binHz;
    }
  return db(worst / fund);
}
/** L'amplitude de la composante a hz entre t0 et t1 (fenetre de Hann). */
double toneIn(const Buf& x, double t0, double t1, double hz) {
  const size_t f = at(t0), n = std::min(x.size(), at(t1)) - f;
  double re = 0, im = 0, ws = 0;
  for (size_t i = 0; i < n; ++i) {
    const double w = 0.5 - 0.5 * std::cos(2 * PI * static_cast<double>(i) / static_cast<double>(n));
    re += w * x[f + i] * std::cos(2 * PI * hz * static_cast<double>(i) / SR);
    im -= w * x[f + i] * std::sin(2 * PI * hz * static_cast<double>(i) / SR);
    ws += w;
  }
  return 2 * std::sqrt(re * re + im * im) / ws;
}
struct Lcg {
  uint32_t s;
  float next() {
    s = s * 1664525u + 1013904223u;
    return static_cast<float>(static_cast<double>(s >> 8) / 8388608.0 - 1.0);
  }
};

/* ---------------- le moteur ---------------- */
void put(KV& kv, const std::string& k, double v) {
  for (auto& e : kv)
    if (e.first == k) {
      e.second = v;
      return;
    }
  kv.push_back({k, v});
}
KV with(KV kv, const KV& more) {
  for (const auto& e : more) put(kv, e.first, e.second);
  return kv;
}
/** Une ligne de la matrice (n = 1..6). */
KV row(int n, int src, int dst, double amt) {
  const std::string m = "m" + std::to_string(n);
  return {{m + "Src", static_cast<double>(src)}, {m + "Dst", static_cast<double>(dst)}, {m + "Amt", amt}};
}
/** Un patch de mesure : OSC 1 en sinus seul, filtre grand ouvert, aucune derive, aucun traitement de sortie. */
KV probe() {
  return {{"wave1", 0}, {"wave2", 0}, {"tune1", 0}, {"tune2", 0}, {"fine1", 0}, {"fine2", 0}, {"osc1", 0.3}, {"osc2", 0}, {"sub", 0}, {"fm", 0},
          {"glide", 0}, {"cutoff", 28000}, {"res", 0}, {"envOct", 0}, {"noise", 0}, {"fmode", 0}, {"fA", 0.001}, {"fD", 0.3}, {"fS", 1}, {"fR", 0.05},
          {"aA", 0.001}, {"aD", 0.3}, {"aS", 1}, {"aR", 0.005}, {"drive", 0}, {"lfoAmt", 0}, {"phase", 0}, {"drift", 0}, {"width", 0}, {"keyTrack", 0},
          {"accFlt", 0}, {"stack", 0}, {"wide", 0}, {"glue", 0}, {"load", 0}, {"space", 0}, {"outLevel", 0}, {"bpm", 120}};
}
/** Le patch de la face a l'ouverture (hq_test initPatch). */
KV initPatch() {
  return {{"wave1", 2}, {"wave2", 2}, {"tune1", 0}, {"tune2", -12}, {"fine1", -8}, {"fine2", 8}, {"osc1", 0.62}, {"osc2", 0.62},
          {"sub", 0}, {"fm", 0}, {"ratio", 1}, {"glide", 0}, {"cutoff", 753.2}, {"res", 0.35}, {"envOct", 3}, {"noise", 0},
          {"fmode", 0}, {"fA", 0.001}, {"fD", 0.3}, {"fS", 0.2}, {"fR", 0.2}, {"aA", 0.001}, {"aD", 0.3}, {"aS", 0.6},
          {"aR", 0.2}, {"drive", 0}, {"lfoBeats", 4}, {"lfoShape", 0}, {"lfoDest", 0}, {"lfoAmt", 0}, {"phase", -1},
          {"drift", 1}, {"width", 0.22}, {"keyTrack", 0.5}, {"sync", 0}, {"accFlt", 0.5}, {"stack", 0}, {"wide", 0},
          {"glue", 0.35}, {"load", 0}, {"space", 0}, {"fpol", 0}, {"bpm", 130}, {"outLevel", 0.306}};
}
struct Note {
  double t, midi, gate;
  double accent = 1, from = QNAN, glide = 0, vel = -1;
};
/** Un geste a l'instant t (au debut du premier bloc qui le suit) : des reglages, un controleur, un noteOff... */
struct Ev {
  double t;
  std::function<void(Voyager&)> f;
};
Ev setAt(double t, const KV& kv) {
  return {t, [kv](Voyager& v) {
            mmarp::ParamKV ids[64];
            int n = 0;
            for (const auto& e : kv) ids[n++] = {Voyager::paramIndex(e.first), e.second};
            v.params(ids, n);
          }};
}
struct Render {
  Buf L, R;
  int heals = 0, maxAct = 0;
  long allocs = 0;
  std::vector<int> act;  // les voix allumees a la fin de chaque bloc
};
Render render(int os, const KV& patch, const std::vector<Note>& notes, double seconds, const std::vector<Ev>& evs = {}, int block = 128, int voices = 12, double sr = SR) {
  VoyagerOptions o;
  o.sampleRate = sr;
  o.os = os;
  o.maxVoices = voices;
  o.wideVoices = 12;
  Voyager v(o, patch);
  for (const auto& n : notes) v.note(n.t, n.midi, n.gate, n.accent, n.from, n.glide, n.vel);
  v.beat(0, 0, 120, true);
  const long frames = static_cast<long>(seconds * sr) / block * block;
  Render r;
  r.L.assign(static_cast<size_t>(frames), 0.f);
  r.R.assign(static_cast<size_t>(frames), 0.f);
  r.act.reserve(static_cast<size_t>(frames / block + 1));
  size_t ei = 0;
  const long a0 = gAllocs.load();
  for (long f = 0; f < frames; f += block) {
    while (ei < evs.size() && evs[ei].t * sr <= static_cast<double>(f)) {
      evs[ei].f(v);
      ei += 1;
    }
    v.process(r.L.data() + f, r.R.data() + f, block);
    const int a = v.activeVoices();
    r.act.push_back(a);
    r.maxAct = std::max(r.maxAct, a);
  }
  r.allocs = gAllocs.load() - a0;
  r.heals = v.heals();
  return r;
}
/** Les voix allumees entre t0 et t1 : le plus et le moins. */
int actMax(const Render& r, double t0, double t1, int block = 128) {
  int m = 0;
  for (size_t b = at(t0) / static_cast<size_t>(block); b < std::min(r.act.size(), at(t1) / static_cast<size_t>(block)); ++b) m = std::max(m, r.act[b]);
  return m;
}
std::vector<Note> arpNotes(double seconds, double gateK = 0.54) {
  std::vector<Note> n;
  const int m[8] = {54, 57, 61, 64, 66, 69, 73, 76};
  const double step = 60.0 / 130 / 4;
  int i = 0;
  for (double t = 0.05; t < seconds; t += step, ++i) n.push_back({t, static_cast<double>(m[i % 8]), step * gateK, 0.8 + 0.05 * (i % 7), i ? static_cast<double>(m[(i - 1) % 8]) : QNAN, 0, 0.3 + 0.1 * (i % 8)});
  return n;
}
/** Tous les reglages neufs a leur neutre, les lignes de la matrice "a moitie remplies" (rien ne doit tourner). */
const KV kNeutral = {{"m1Src", S_AT},   {"m1Dst", D_CUTOFF}, {"m1Amt", 0},    {"m2Src", S_OFF}, {"m2Dst", D_PITCH}, {"m2Amt", 0.7},
                     {"m3Src", S_PB},   {"m3Dst", D_OFF},    {"m3Amt", -0.5}, {"m4Src", S_OFF}, {"m4Dst", D_OFF},   {"m4Amt", 1},
                     {"m5Src", S_LFO2}, {"m5Dst", D_PAN},    {"m5Amt", 0},    {"m6Src", S_RND}, {"m6Dst", D_AMP},   {"m6Amt", 0},
                     {"pbRange", 12},   {"voiceMode", 0},    {"xFeedback", 0}, {"ampMode", 0}};

/* ---------------- 1. le moteur au neutre ---------------- */
// les patchs et le rendu de hq2_test (goldenRender), tels quels, plus : les reglages neufs au neutre, la molette et
// l'aftertouch tournes (aucune ligne ne les lit), le bend a 0, la velocite donnee a chaque note
KV goldenPatch(int k) {
  switch (k) {
    case 0: return {};
    case 1: return {{"stack", 12}, {"wide", 0.6}, {"glue", 0.5}, {"noise", 0.4}, {"sub", 0.5}};
    case 2: return {{"fmode", 4}, {"res", 0.9}, {"drive", 0.7}, {"space", 0.5}, {"load", 0.5}, {"glide", 0.2}, {"noise", 0.2}};
    default: return {{"fm", 0.6}, {"sync", 1}, {"wave1", 3.4}, {"lfoAmt", 0.5}, {"lfoDest", 1}, {"l2Dest", 7}, {"l2Amt", 0.7}, {"xl1Dest", 2}, {"xl1Amt", 0.5}, {"wide", 0.3}, {"fmode", 2}, {"stack", 20}};
  }
}
uint64_t goldenRender(int k, int os, bool neutral) {
  VoyagerOptions o;
  o.os = os;
  Voyager v(o, neutral ? with(goldenPatch(k), kNeutral) : goldenPatch(k));
  const int midi[8] = {45, 57, 60, 64, 52, 69, 40, 72};
  for (int i = 0; i < 20; ++i) {
    if (neutral)
      v.note(0.01 + i * 0.11, midi[i % 8], 0.09 + 0.05 * (i % 3), 0.7 + 0.2 * (i % 4), i ? midi[(i - 1) % 8] : QNAN, 0, 0.05 * i);
    else
      v.note(0.01 + i * 0.11, midi[i % 8], 0.09 + 0.05 * (i % 3), 0.7 + 0.2 * (i % 4), i ? midi[(i - 1) % 8] : QNAN);
  }
  v.beat(0, 0, 120, true);
  if (neutral) {
    v.pitchBend(0);
    v.modWheel(0.8);
    v.aftertouch(0.3);
  }
  Buf L(static_cast<size_t>(SR * 2.5)), R(L.size());
  const int sizes[5] = {128, 64, 256, 31, 512};
  size_t pos = 0;
  int blk = 0;
  while (pos < L.size()) {
    const int n = static_cast<int>(std::min<size_t>(static_cast<size_t>(sizes[blk++ % 5]), L.size() - pos));
    if (pos > 48000 && pos < 48600) v.params({{"cutoff", 800.0 + static_cast<double>(pos - 48000)}});
    if (neutral && blk % 7 == 3) {
      v.modWheel(0.1 * (blk % 11));
      v.aftertouch(0.09 * (blk % 10));
      v.params({{"pbRange", 1.0 + blk % 24}});
    }
    v.process(&L[pos], &R[pos], n);
    pos += static_cast<size_t>(n);
  }
  return fnv(R, fnv(L));
}
// goldenRender(k, os) de hq2_test sur le moteur d'avant le 2026-11-11 (HEAD 5c251d6) : k 0..3, os 4 puis 8
const uint64_t kGolden[4][2] = {
    {0x8caa51804a76d32aull, 0x2490a4e64d70415dull},
    {0x633688e8ca708b36ull, 0xbc6ba2b9fc68d852ull},
    {0x3c9ed8d9e9bb22a7ull, 0x56eb611ba4199cb2ull},
    {0x225a83375f1f10e5ull, 0x740d2047d9e6419full},
};

void testNeutral() {
  std::printf("\n1. Le moteur au neutre : la sortie d'avant, au bit pres\n");
  int bad = 0;
  for (int k = 0; k < 4; ++k)
    for (int q = 0; q < 2; ++q) {
      const uint64_t h = goldenRender(k, q == 0 ? 4 : 8, true), h0 = goldenRender(k, q == 0 ? 4 : 8, false);
      if (h != kGolden[k][q] || h0 != kGolden[k][q]) {
        bad += 1;
        std::printf("        patch %d x%d : %016llx (sans : %016llx) contre %016llx\n", k, q == 0 ? 4 : 8, static_cast<unsigned long long>(h), static_cast<unsigned long long>(h0), static_cast<unsigned long long>(kGolden[k][q]));
      }
    }
  check(bad == 0, "4 patchs x4 et x8, les 22 cles neuves a leur neutre (lignes a moitie remplies, pbRange quelconque), molette et aftertouch tournes, bend 0, velocite donnee : les empreintes du moteur d'avant (%d en defaut)", bad);
  check(Voyager::paramIndex("m1Src") >= 0 && Voyager::paramIndex("m6Amt") == Voyager::paramIndex("m1Src") + 17 && Voyager::paramIndex("pbRange") >= 0 && Voyager::paramIndex("voiceMode") >= 0 && Voyager::paramIndex("xFeedback") >= 0 && Voyager::paramIndex("ampMode") >= 0 && Voyager::paramIndex("xCombFb") == Voyager::paramIndex("m1Src") - 1,
        "les cles m1Src .. m6Amt, pbRange, voiceMode, xFeedback, ampMode existent, a la suite des cles d'avant (%d cles)", Voyager::paramCount());
  {
    // Engage puis remis au neutre : apres un silence, les notes suivantes sont celles du moteur jamais touche, au bit
    // pres (les oscillateurs repartent a phase 0 ; la suite du hasard, DRIFT compris, n'a pas bouge : S&H et RANDOM
    // ne tirent rien du generateur du moteur)
    const KV base = with(initPatch(), {{"glue", 0}, {"phase", 0}, {"aR", 0.05}, {"fR", 0.05}, {"stack", 9}, {"wide", 0.4}, {"l2Shape", 4}, {"l2Beats", 1}});
    std::vector<Note> notes;
    const int m[6] = {45, 57, 60, 64, 52, 69};
    for (int i = 0; i < 10; ++i) notes.push_back({0.02 + 0.09 * i, static_cast<double>(m[i % 6]), 0.12, 0.8 + 0.1 * (i % 3), QNAN, 0, 0.1 * i});
    for (int i = 0; i < 10; ++i) notes.push_back({2.0 + 0.09 * i, static_cast<double>(m[(i + 2) % 6]), 0.12, 0.8 + 0.1 * (i % 3), QNAN, 0, 0.1 * i});
    KV on;
    for (const KV& r : {row(1, S_VEL, D_CUTOFF, 0.5), row(2, S_SH, D_PITCH, 0.3), row(3, S_RND, D_PAN, 1), row(4, S_MW, D_LFO1D, 1), row(5, S_AENV, D_WAVE, -0.5), row(6, S_LFO2, D_STACK, 0.8)}) on = with(on, r);
    on = with(on, {{"xFeedback", 0.6}, {"ampMode", 2}, {"pbRange", 7}});
    KV off;
    for (int n = 1; n <= 6; ++n) off = with(off, row(n, S_OFF, D_OFF, 0));
    off = with(off, {{"xFeedback", 0}, {"ampMode", 0}, {"pbRange", 2}});
    int badQ = 0;
    for (int os : {4, 8}) {
      const Render ref = render(os, base, notes, 3.2);
      const Render r = render(os, base, notes, 3.2, {setAt(0, on), {0, [](Voyager& v) { v.pitchBend(0.4); v.modWheel(0.6); v.aftertouch(1); }}, {0.5, [](Voyager& v) { v.pitchBend(-1); }}, setAt(1.2, off), {1.2, [](Voyager& v) { v.pitchBend(0); v.modWheel(0); v.aftertouch(0); }}});
      const bool acted = diffDb(ref.L, r.L, 0.02, 1.0) > -30;
      if (!(acted && sameFrom(ref.L, r.L, at(1.95)) && sameFrom(ref.R, r.R, at(1.95)) && rms(ref.L, 2.0, 3.0) > 0.01 && r.heals == 0 && r.allocs == 0)) {
        badQ += 1;
        std::printf("        x%d : agit %d (%.1f dB), apres %d / %d, allocations %ld\n", os, acted, diffDb(ref.L, r.L, 0.02, 1.0), sameFrom(ref.L, r.L, at(1.95)), sameFrom(ref.R, r.R, at(1.95)), r.allocs);
      }
    }
    check(badQ == 0, "6 lignes (VELOCITY, S&H, RANDOM, MOD WHEEL, AMP ENV, LFO 2), bend, FEEDBACK, AMP MODE engages 1.2 s puis remis au neutre : apres un silence, les notes suivantes au bit pres (x4, x8), DRIFT compris (%d en defaut)", badQ);
  }
}

/* ---------------- 2. les controleurs : le bend, la molette, l'aftertouch, la velocite ---------------- */
void testControllers() {
  std::printf("\n2. Les controleurs : PITCH BEND (pbRange), lissage, velocite\n");
  const std::vector<Note> one = {{0.01, 69, 10}};
  {
    int bad = 0;
    double worst = 0;
    const struct {
      double range, bend;
    } cs[] = {{2, 1}, {2, -1}, {12, 1}, {12, -1}, {24, 1}, {24, -0.5}, {1, 1}, {7, 0.5}, {5, -1}, {3, 1}};
    for (const auto& c : cs)
      for (int os : {4, 8}) {
        const double bend = c.bend;
        const Render r = render(os, with(probe(), {{"pbRange", c.range}}), one, 0.8, {{0, [bend](Voyager& v) { v.pitchBend(bend); }}});
        const double n = noteIn(r.L, 0.2, 0.75), want = 69 + c.range * c.bend;
        worst = std::max(worst, std::fabs(n - want));
        if (std::fabs(n - want) > 0.01) {
          bad += 1;
          std::printf("        pbRange %.0f, bend %+.1f, x%d : note %.3f, voulue %.3f\n", c.range, c.bend, os, n, want);
        }
      }
    check(bad == 0, "bend a +/-1 (et a mi-course), pbRange 1, 2, 3, 5, 7, 12, 24, x4 et x8 : la hauteur a pbRange x bend demi-tons (ecart au plus %.4f demi-ton, %d en defaut)", worst, bad);
  }
  {
    // toutes les voix : un accord, chaque note monte de 2 demi-tons ; le SUB et OSC 2 suivent
    const Render r = render(4, with(probe(), {{"osc2", 0.3}, {"tune2", 7}, {"sub", 0.3}}), {{0.01, 57, 10}, {0.01, 64, 10}}, 1.2, {{0, [](Voyager& v) { v.pitchBend(1); }}});
    const double up = std::pow(2.0, 2.0 / 12);
    const double a1 = lineIn(r.L, 0.3, midiHz(57) * up), a2 = lineIn(r.L, 0.3, midiHz(64) * up), a3 = lineIn(r.L, 0.3, midiHz(57 + 7) * up), s1 = lineIn(r.L, 0.3, midiHz(57 - 12) * up), o1 = lineIn(r.L, 0.3, midiHz(57), 3);
    check(a1 > 0.1 && a2 > 0.1 && a3 > 0.1 && s1 > 0.1 && o1 < 0.01 * a1, "un accord, bend +1 (pbRange 2) : les deux notes, OSC 2 (+7) et le SUB a +2 demi-tons (raies %.2f, %.2f, %.2f, %.2f), plus rien a la hauteur d'avant (%.1f dBc)", a1, a2, a3, s1, db(o1 / a1));
  }
  {
    // sans clic : un saut du bend, de la molette (vers AMP), de l'aftertouch (vers CUTOFF) glisse en 5 ms
    const Render steady = render(4, with(probe(), {{"pbRange", 12}}), one, 1.0, {{0, [](Voyager& v) { v.pitchBend(1); }}});
    const Render r = render(4, with(probe(), {{"pbRange", 12}}), one, 1.0, {{0.4, [](Voyager& v) { v.pitchBend(1); }}, {0.7, [](Voyager& v) { v.pitchBend(0); }}});
    const double dS = d2max(steady.L, 0.3, 0.9), dJ = std::max(d2max(r.L, 0.39, 0.45), d2max(r.L, 0.69, 0.75));
    // (le temps du glissement : la note est a mi-chemin, en demi-tons, 3.5 ms apres le saut : 1 - exp(-0.7) = 0.5)
    const double mid = noteAt(r.L, 0.4 + 0.0039);
    const Render amp = render(4, with(probe(), row(1, S_MW, D_AMP, -1)), one, 1.0, {{0.4, [](Voyager& v) { v.modWheel(1); }}, {0.7, [](Voyager& v) { v.modWheel(0); }}});
    const double dA = std::max(d2max(amp.L, 0.39, 0.45), d2max(amp.L, 0.69, 0.75)), dA0 = d2max(amp.L, 0.2, 0.38);
    check(dJ < 1.05 * dS && mid > 69 + 3 && mid < 69 + 9 && std::fabs(noteIn(r.L, 0.5, 0.68) - 81) < 0.01 && std::fabs(noteIn(r.L, 0.8, 0.98) - 69) < 0.01 && dA < 1.3 * dA0 && rms(amp.L, 0.5, 0.68) < 1e-4,
          "un saut du bend (+12 demi-tons) puis son retour : aucun clic (derivee seconde %.4f, celle du son tenu en haut %.4f), a mi-chemin apres 3.5 ms (note %.1f) ; la molette vers AMP -1 : le son s'eteint et revient sans clic (%.4f contre %.4f)", dJ, dS, mid, dA, dA0);
  }
}

/* ---------------- 3. la matrice : les sources ---------------- */
// La sonde : la ligne 1 vers PITCH (12 demi-tons x quantite x source), sur un sinus ; la hauteur mesuree dit la source.
void testSources() {
  std::printf("\n3. La matrice : chaque source (mesuree par la hauteur : PITCH = 12 demi-tons x quantite x source)\n");
  const double A = 0.5;  // la quantite : +/-6 demi-tons pour une source a +/-1
  auto src = [&](int s, const KV& more = {}) { return with(with(probe(), row(1, s, D_PITCH, A)), more); };
  {
    // VELOCITY, par voix : deux notes ensemble, deux velocites
    const Render r = render(4, src(S_VEL), {{0.01, 57, 10, 1, QNAN, 0, 1.0}, {0.01, 69.5, 10, 1, QNAN, 0, 0.25}}, 1.2);
    const double a = lineIn(r.L, 0.3, midiHz(57 + 6), 3), b = lineIn(r.L, 0.3, midiHz(69.5 + 1.5), 3), a0 = lineIn(r.L, 0.3, midiHz(57), 3), b0 = lineIn(r.L, 0.3, midiHz(69.5), 3);
    // sans velocite : celle de l'accent (accent 1 = 100 / 127 ; accent 0.635 = 0.5)
    const Render d = render(4, src(S_VEL), {{0.01, 69, 10}}, 0.8), e = render(4, src(S_VEL), {{0.01, 69, 10, 0.635}}, 0.8);
    check(a > 0.2 && b > 0.2 && a0 < 0.01 * a && b0 < 0.01 * b && std::fabs(noteIn(d.L, 0.2, 0.75) - (69 + 6 * 100.0 / 127)) < 0.01 && std::fabs(noteIn(e.L, 0.2, 0.75) - (69 + 3)) < 0.01,
          "VELOCITY, par voix : deux notes ensemble, velocites 1 et 0.25, montent de 6 et de 1.5 demi-tons (raies %.2f et %.2f, rien aux hauteurs d'avant) ; sans velocite, celle de l'accent : %+.3f (accent 1) et %+.3f (accent 0.635)", a, b, noteIn(d.L, 0.2, 0.75) - 69, noteIn(e.L, 0.2, 0.75) - 69);
  }
  {
    const Render mw = render(4, src(S_MW), {{0.01, 69, 10}}, 0.8, {{0, [](Voyager& v) { v.modWheel(0.5); }}});
    const Render at2 = render(4, src(S_AT), {{0.01, 69, 10}}, 0.8, {{0, [](Voyager& v) { v.aftertouch(1); }}});
    const Render pb = render(4, src(S_PB, {{"pbRange", 1}}), {{0.01, 69, 10}}, 0.8, {{0, [](Voyager& v) { v.pitchBend(-1); }}});
    const double n1 = noteIn(mw.L, 0.2, 0.75) - 69, n2 = noteIn(at2.L, 0.2, 0.75) - 69, n3 = noteIn(pb.L, 0.2, 0.75) - 69;
    check(std::fabs(n1 - 3) < 0.01 && std::fabs(n2 - 6) < 0.01 && std::fabs(n3 + 7) < 0.01, "MOD WHEEL a 0.5 : %+.3f demi-tons (3) ; AFTERTOUCH a 1 : %+.3f (6) ; PITCH BEND a -1 : %+.3f (-6 de la matrice, -1 de pbRange)", n1, n2, n3);
  }
  {
    // KEY : 0 au do central, +1 deux octaves au-dessus, -1 deux octaves au-dessous ; par voix
    const Render r = render(4, src(S_KEY), {{0.01, 60, 0.5}, {0.6, 84, 0.5}, {1.2, 36, 0.5}, {1.8, 72, 0.5}}, 2.4);
    const double k0 = noteIn(r.L, 0.1, 0.5) - 60, k1 = noteIn(r.L, 0.7, 1.1) - 84, k2 = noteIn(r.L, 1.3, 1.7) - 36, k3 = noteIn(r.L, 1.9, 2.3) - 72;
    check(std::fabs(k0) < 0.01 && std::fabs(k1 - 6) < 0.02 && std::fabs(k2 + 6) < 0.02 && std::fabs(k3 - 3) < 0.02, "KEY : do 3 %+.3f (0), do 5 %+.3f (+6 : la source a +1), do 1 %+.3f (-6), do 4 %+.3f (+3)", k0, k1, k2, k3);
  }
  {
    // LFO 1 et LFO 2 en carre, un cycle de 4 temps (2 s a 120) : +1 la premiere seconde, -1 la suivante. La
    // profondeur propre du LFO 1 (lfoAmt) est a 0 et la destination du LFO 2 a OFF : la matrice lit la forme seule.
    const Render l1 = render(4, src(S_LFO1, {{"lfoShape", 2}, {"lfoBeats", 4}, {"lfoAmt", 0}}), {{0.01, 69, 10}}, 2.0);
    const Render l2 = render(4, src(S_LFO2, {{"l2Shape", 4}, {"l2Beats", 4}, {"l2Dest", 0}, {"l2Amt", 0}}), {{0.01, 69, 10}}, 2.0);
    const double a1 = noteIn(l1.L, 0.2, 0.9) - 69, b1 = noteIn(l1.L, 1.2, 1.9) - 69, a2 = noteIn(l2.L, 0.2, 0.9) - 69, b2 = noteIn(l2.L, 1.2, 1.9) - 69;
    check(std::fabs(a1 - 6) < 0.01 && std::fabs(b1 + 6) < 0.01 && std::fabs(a2 - 6) < 0.01 && std::fabs(b2 + 6) < 0.01, "LFO 1 (carre, sa profondeur a 0) : %+.3f puis %+.3f ; LFO 2 (carre, sa destination a OFF) : %+.3f puis %+.3f (+6, -6)", a1, b1, a2, b2);
  }
  {
    // FILTER ENV et AMP ENV, par voix : au palier (SUSTAIN 0.5), la moitie de la course ; a l'attaque, la course entiere
    const Render fe = render(4, src(S_FENV, {{"fA", 0.05}, {"fD", 0.1}, {"fS", 0.5}}), {{0.01, 69, 10}}, 1.2);
    const Render ae = render(4, src(S_AENV, {{"aA", 0.05}, {"aD", 0.1}, {"aS", 0.5}}), {{0.01, 69, 10}}, 1.2);
    const double f1 = noteIn(fe.L, 0.8, 1.15) - 69, a1 = noteIn(ae.L, 0.8, 1.15) - 69;
    double fMax = 0, aMax = 0;
    for (double t = 0.02; t < 0.3; t += 0.004) {
      fMax = std::max(fMax, noteIn(fe.L, t, t + 0.012) - 69);
      aMax = std::max(aMax, noteIn(ae.L, t, t + 0.012) - 69);
    }
    check(std::fabs(f1 - 3) < 0.02 && std::fabs(a1 - 3) < 0.02 && fMax > 5.2 && fMax < 6.05 && aMax > 5.2 && aMax < 6.05, "FILTER ENV : au palier %+.3f (3), au sommet de l'attaque %+.2f (6) ; AMP ENV : %+.3f, %+.2f", f1, fMax, a1, aMax);
  }
  {
    // S&H : un tirage par note, tenu ; par position (la meme note au meme endroit du morceau rejoue le meme tirage,
    // quoi qu'il se soit passe avant) ; d'une note a l'autre il change
    std::vector<Note> ns;
    for (int i = 0; i < 12; ++i) ns.push_back({0.02 + 0.25 * i, 69, 0.2});
    const Render r = render(4, src(S_SH), ns, 3.1), r8 = render(8, src(S_SH), ns, 3.1);
    const Render late = render(4, src(S_SH), {ns[7], ns[9]}, 3.1);
    std::vector<double> v;
    double hold = 0, lo = 1e9, hi = -1e9, dOs = 0;
    for (int i = 0; i < 12; ++i) {
      const double t = 0.02 + 0.25 * i;
      const double n = noteIn(r.L, t + 0.02, t + 0.19) - 69;
      hold = std::max(hold, std::fabs((noteIn(r.L, t + 0.02, t + 0.1) - 69) - (noteIn(r.L, t + 0.1, t + 0.19) - 69)));
      dOs = std::max(dOs, std::fabs(n - (noteIn(r8.L, t + 0.02, t + 0.19) - 69)));
      v.push_back(n);
      lo = std::min(lo, n);
      hi = std::max(hi, n);
    }
    int distinct = 0;
    for (int i = 1; i < 12; ++i)
      if (std::fabs(v[static_cast<size_t>(i)] - v[static_cast<size_t>(i - 1)]) > 0.05) distinct += 1;
    const double p7 = noteIn(late.L, 0.02 + 0.25 * 7 + 0.02, 0.02 + 0.25 * 7 + 0.19) - 69, p9 = noteIn(late.L, 0.02 + 0.25 * 9 + 0.02, 0.02 + 0.25 * 9 + 0.19) - 69;
    // la meme hauteur a deux notes differentes au meme instant : deux tirages
    const Render two = render(4, src(S_SH), {{0.02, 57, 1}, {0.02, 69.5, 1}}, 1.1);
    const Render solo = render(4, src(S_SH), {{0.02, 57, 1}}, 1.1), solo2 = render(4, src(S_SH), {{0.02, 69.5, 1}}, 1.1);
    const double sA = noteIn(solo.L, 0.1, 1.0) - 57, sB = noteIn(solo2.L, 0.1, 1.0) - 69.5;
    const double bothA = lineIn(two.L, 0.2, midiHz(57 + sA), 3), bothB = lineIn(two.L, 0.2, midiHz(69.5 + sB), 3);
    check(hold < 0.01 && lo >= -6.01 && hi <= 6.01 && hi - lo > 4 && distinct >= 10 && dOs < 0.01 && std::fabs(p7 - v[7]) < 0.01 && std::fabs(p9 - v[9]) < 0.01 && std::fabs(sA - sB) > 0.05 && bothA > 0.2 && bothB > 0.2,
          "S&H : 12 notes, 12 tirages tenus (ecart dans la note %.4f), de %+.2f a %+.2f demi-tons, %d changements sur 11 ; les memes en x8 ; par position (les notes 8 et 10 jouees seules : %+.2f et %+.2f, les memes) ; par voix (deux notes ensemble : %+.2f et %+.2f)", hold, lo, hi, distinct, p7, p9, sA, sB);
  }
  {
    // RANDOM : un bruit lisse lent (un segment par temps), par voix, par position
    const Render r = render(4, src(S_RND), {{0.01, 69, 10}}, 6.0), again = render(4, src(S_RND), {{0.01, 69, 10}}, 6.0), r8 = render(8, src(S_RND), {{0.01, 69, 10}}, 6.0);
    std::vector<double> tr;
    for (double t = 0.1; t < 5.9; t += 0.02) tr.push_back(noteIn(r.L, t, t + 0.03) - 69);
    double lo = 1e9, hi = -1e9, step = 0, dOs = 0;
    for (size_t i = 0; i < tr.size(); ++i) {
      lo = std::min(lo, tr[i]);
      hi = std::max(hi, tr[i]);
      if (i) step = std::max(step, std::fabs(tr[i] - tr[i - 1]));
    }
    for (double t = 0.1; t < 5.9; t += 0.25) dOs = std::max(dOs, std::fabs((noteIn(r.L, t, t + 0.03) - 69) - (noteIn(r8.L, t, t + 0.03) - 69)));
    check(same(r.L, again.L) && lo >= -6.01 && hi <= 6.01 && hi - lo > 3 && step < 0.75 && dOs < 0.05, "RANDOM : en 6 s la hauteur erre de %+.2f a %+.2f demi-tons, sans marche (%.2f demi-ton au plus entre deux mesures a 20 ms ; la pente la plus raide possible : 0.72), le meme d'un rendu a l'autre et en x8 (%.3f pres)", lo, hi, step, dOs);
    // par voix : deux notes ensemble (RANDOM -> AMP : le niveau de chaque note suit son bruit), deux bruits ; celui
    // de la premiere voix est le meme, la note jouee seule
    const KV pa = with(probe(), row(1, S_RND, D_AMP, 1));
    const Render two = render(4, pa, {{0.01, 57, 10}, {0.01, 69.5, 10}}, 4.0), solo = render(4, pa, {{0.01, 57, 10}}, 4.0);
    double dTwo = 0, dSame = 0, full = 0;
    for (double t = 0.2; t < 3.85; t += 0.1) {
      const double a = toneIn(two.L, t, t + 0.1, 220), b = toneIn(two.L, t, t + 0.1, midiHz(69.5)), c = toneIn(solo.L, t, t + 0.1, 220);
      full = std::max({full, a, b});
      dTwo = std::max(dTwo, std::fabs(a - b));
      dSame = std::max(dSame, std::fabs(a - c));
    }
    check(dTwo > 0.3 * full && dSame < 0.02 * full, "RANDOM par voix : deux notes ensemble, deux bruits (leurs niveaux s'ecartent jusqu'a %.0f %% du plein niveau) ; la premiere voix garde le sien, jouee seule ou non (%.1f %%)", 100 * dTwo / full, 100 * dSame / full);
  }
  {
    // plusieurs lignes vers la meme destination s'additionnent, avec les LFO
    KV p = with(probe(), row(1, S_MW, D_PITCH, 0.25));
    p = with(p, row(2, S_AT, D_PITCH, 0.25));
    p = with(p, row(3, S_LFO2, D_PITCH, -0.125));
    p = with(p, {{"l2Shape", 4}, {"l2Beats", 4}, {"lfoShape", 2}, {"lfoBeats", 4}, {"lfoDest", 3}, {"lfoAmt", 1}});
    const Render r = render(4, p, {{0.01, 69, 10}}, 1.0, {{0, [](Voyager& v) { v.modWheel(1); v.aftertouch(1); }}});
    const double n = noteIn(r.L, 0.2, 0.9) - 69;
    check(std::fabs(n - (3 + 3 - 1.5 + 1)) < 0.01, "MOD WHEEL (+3) + AFTERTOUCH (+3) + LFO 2 (-1.5) vers PITCH, et le LFO 1 de la face vers PITCH (+1) : %+.3f demi-tons (5.5)", n);
  }
}

/* ---------------- 4. la matrice : les destinations ---------------- */
// Chaque destination, la molette a 1 puis la velocite a 1 (le chemin commun puis le chemin par voix) : le son est
// celui du reglage lui-meme deplace d'autant (la loi et la borne des destinations de LFO).
void testDests() {
  std::printf("\n4. La matrice : chaque destination (le son du reglage deplace d'autant, par la molette puis par la velocite)\n");
  const KV base = with(initPatch(), {{"glue", 0}, {"outLevel", 0}});
  const std::vector<Note> notes = {{0.01, 57, 0.4, 1, QNAN, 0, 1}, {0.5, 64, 0.3, 1.3, QNAN, 0, 1}, {0.9, 45, 0.3, 0.8, QNAN, 0, 1}};
  const struct {
    const char* name;
    int dst;
    double amt;
    KV patch, equiv;
  } cs[] = {
      {"PITCH +3 demi-tons", D_PITCH, 0.25, {}, {{"tune1", 3}, {"tune2", -9}}},
      {"PITCH -12", D_PITCH, -1, {}, {{"tune1", -12}, {"tune2", -24}}},
      {"OSC 2 PITCH +12", D_O2PITCH, 1, {}, {{"tune2", 0}}},
      {"WAVE +0.8 forme", D_WAVE, 0.4, {}, {{"wave1", 2.8}, {"wave2", 2.64}}},
      {"FM +0.3", D_FM, 0.5, {}, {{"fm", 0.3}}},
      {"OSC MIX +0.5 (OSC 1 a moitie)", D_OSCMIX, 0.5, {}, {{"osc1", 0.31}}},
      {"OSC MIX -1 (OSC 1 seul)", D_OSCMIX, -1, {}, {{"osc2", 0}}},
      {"NOISE +0.3", D_NOISE, 0.3, {}, {{"noise", 0.3}}},
      {"SUB +0.44", D_SUB, 0.5, {}, {{"sub", 0.44}}},
      {"RING +0.6", D_RING, 0.6, {}, {{"xRing", 0.6}}},
      {"FOLD +0.5", D_FOLD, 0.5, {}, {{"xFold", 0.5}}},
      {"FOLD 0.3 -> 0.8", D_FOLD, 0.5, {{"xFold", 0.3}}, {{"xFold", 0.8}}},
      {"CUTOFF +1 octave", D_CUTOFF, 0.25, {}, {{"cutoff", 1506.4}}},
      {"CUTOFF -4 octaves", D_CUTOFF, -1, {{"cutoff", 12000}}, {{"cutoff", 750}}},
      {"RES +0.14", D_RES, 0.4, {}, {{"res", 0.49}}},
      {"RES (MS-10) +0.35", D_RES, 1, {{"fmode", 4}, {"res", 0.5}}, {{"fmode", 4}, {"res", 0.85}}},
      {"ENV AMT +1.5 octave", D_ENV, 0.5, {}, {{"envOct", 4.5}}},
      {"STACK 10 -> 17.5 cents", D_STACK, 0.5, {{"stack", 10}}, {{"stack", 17.5}}},
      {"COMB +0.5", D_COMB, 0.5, {{"xCombFb", 0.4}}, {{"xCombFb", 0.4}, {"xComb", 0.5}}},
      {"COMB 0.2 -> 0.9", D_COMB, 0.7, {{"xCombFb", -0.5}, {"xComb", 0.2}}, {{"xCombFb", -0.5}, {"xComb", 0.9}}},
  };
  int bad[2] = {0, 0};
  double worst[2] = {-999, -999};
  for (const auto& c : cs)
    for (int os : {4, 8}) {
      const Render plain = render(os, with(base, c.patch), notes, 1.4);
      const Render want = render(os, with(base, c.equiv), notes, 1.4);
      for (int pass = 0; pass < 2; ++pass) {
        const Render got = render(os, with(with(base, c.patch), row(3, pass == 0 ? S_MW : S_VEL, c.dst, c.amt)), notes, 1.4, {{0, [](Voyager& v) { v.modWheel(1); }}});
        const double d = diffDb(want.L, got.L, 0.0, 1.4), dR = diffDb(want.R, got.R, 0.0, 1.4), acts = diffDb(plain.L, got.L, 0.0, 1.4);
        worst[pass] = std::max({worst[pass], d, dR});
        if (!(d < -80 && dR < -80 && acts > -40 && got.heals == 0 && got.allocs == 0)) {
          bad[pass] += 1;
          std::printf("        %s, %s, x%d : a %.1f / %.1f dB du reglage deplace ; a %.1f dB du son sans la ligne\n", c.name, pass == 0 ? "MOD WHEEL" : "VELOCITY", os, d, dR, acts);
        }
      }
    }
  for (int pass = 0; pass < 2; ++pass)
    check(bad[pass] == 0, "%s : PITCH, OSC 2 PITCH, WAVE, FM, OSC MIX, NOISE, SUB, RING, FOLD, CUTOFF, RES, ENV AMT, STACK, COMB (20 cas, x4 et x8) : le son du reglage deplace d'autant, a %.0f dB pres (%d en defaut)", pass == 0 ? "MOD WHEEL a 1" : "VELOCITY a 1 (par voix)", worst[pass], bad[pass]);
  {
    // DRIVE : d'une source commune, OVERDRIVE entier (le bus compris) ; d'une source par voix, l'entree du filtre
    // et le VCA de la voix (l'OVERDRIVE du bus reste celui du potard)
    const Render want = render(4, with(base, {{"drive", 0.3}}), notes, 1.4);
    const Render got = render(4, with(base, row(2, S_AT, D_DRIVE, 0.6)), notes, 1.4, {{0, [](Voyager& v) { v.aftertouch(1); }}});
    const Render plain = render(4, base, notes, 1.4);
    const Render vel = render(4, with(base, row(2, S_VEL, D_DRIVE, 0.6)), notes, 1.4);
    const double d = diffDb(want.L, got.L, 0, 1.4);
    check(d < -80 && diffDb(plain.L, vel.L, 0, 1.4) > -30 && diffDb(want.L, vel.L, 0, 1.4) > -30 && finite(vel.L) && vel.heals == 0, "DRIVE +0.3 par l'aftertouch : le son de DRIVE 0.3 (a %.0f dB pres) ; par la velocite : la voix seule est poussee (a %.1f dB du son sans la ligne, %.1f dB de DRIVE 0.3)", d, diffDb(plain.L, vel.L, 0, 1.4), diffDb(want.L, vel.L, 0, 1.4));
  }
  {
    // AMP : un VCA. Quantite positive : plein niveau source en haut ; negative : la source en haut, moins fort
    const std::vector<Note> one = {{0.01, 69, 10, 1, QNAN, 0, 0.5}};
    const KV p = with(probe(), {{"osc1", 0.1}});
    const double ref = rms(render(4, p, one, 0.8).L, 0.3, 0.75);
    auto lvl = [&](int s, double amt, double mw) { return db(rms(render(4, with(p, row(1, s, D_AMP, amt)), one, 0.8, {{0, [mw](Voyager& v) { v.modWheel(mw); }}}).L, 0.3, 0.75) / ref); };
    const double a = lvl(S_MW, 1, 0.25), b = lvl(S_MW, -1, 0.5), c = lvl(S_MW, 1, 1), d = lvl(S_VEL, 1, 0), e = lvl(S_MW, 0.5, 0), f = lvl(S_VEL, -1, 0);
    check(std::fabs(a + 12.04) < 0.2 && std::fabs(b + 6.02) < 0.2 && std::fabs(c) < 0.01 && std::fabs(d + 6.02) < 0.2 && std::fabs(e + 6.02) < 0.2 && std::fabs(f + 6.02) < 0.2,
          "AMP : molette 0.25, quantite +1 : %.2f dB (-12.04) ; molette 0.5, -1 : %.2f (-6.02) ; molette 1, +1 : %.2f (0) ; velocite 0.5, +1 : %.2f (-6.02) ; molette 0, +0.5 : %.2f (-6.02) ; velocite 0.5, -1 : %.2f (-6.02)", a, b, c, d, e, f);
    // par voix : deux notes, la velocite 0 se tait, l'autre reste
    const Render two = render(4, with(p, row(1, S_VEL, D_AMP, 1)), {{0.01, 57, 10, 1, QNAN, 0, 0}, {0.01, 69.5, 10, 1, QNAN, 0, 1}}, 1.2);
    const double q = lineIn(two.L, 0.3, midiHz(57), 3), k = lineIn(two.L, 0.3, midiHz(69.5), 3);
    check(k > 0.05 && q < 1e-4 * k, "AMP par voix : deux notes, velocites 0 et 1 : la premiere se tait (%.0f dBc), la seconde reste (%.3f)", db(q / k), k);
  }
  {
    // PAN : par voix, autour de la place de la note (WIDTH 0 : le centre), a puissance constante
    const std::vector<Note> one = {{0.01, 69, 10, 1, QNAN, 0, 1}};
    const Render c = render(4, probe(), one, 0.8);
    const Render r = render(4, with(probe(), row(1, S_MW, D_PAN, 1)), one, 0.8, {{0, [](Voyager& v) { v.modWheel(1); }}});
    const Render l = render(4, with(probe(), row(1, S_MW, D_PAN, -1)), one, 0.8, {{0, [](Voyager& v) { v.modWheel(1); }}});
    const Render h = render(4, with(probe(), row(1, S_VEL, D_PAN, 0.5)), one, 0.8);
    const double c0 = rms(c.L, 0.3, 0.75);
    const double rr = db(rms(r.R, 0.3, 0.75) / c0), rl = db(rms(r.L, 0.3, 0.75) / c0), ll = db(rms(l.L, 0.3, 0.75) / c0), lr = db(rms(l.R, 0.3, 0.75) / c0);
    const double hl = rms(h.L, 0.3, 0.75) / c0, hr = rms(h.R, 0.3, 0.75) / c0;
    // (une source tenue des la premiere note : la place est posee, pas glissee ; le debut de la note est deja a droite)
    const double early = rms(r.L, 0.011, 0.016) / std::max(1e-12, rms(r.R, 0.011, 0.016));
    // deux voix, deux places (KEY : la note grave a gauche, l'aigue a droite)
    const Render two = render(4, with(probe(), row(1, S_KEY, D_PAN, 1)), {{0.01, 36, 10}, {0.01, 84.5, 10}}, 1.2);
    const double loL = lineIn(two.L, 0.3, midiHz(36), 3), loR = lineIn(two.R, 0.3, midiHz(36), 3), hiL = lineIn(two.L, 0.3, midiHz(84.5), 3), hiR = lineIn(two.R, 0.3, midiHz(84.5), 3);
    check(std::fabs(rr - 3.01) < 0.05 && rl < -100 && std::fabs(ll - 3.01) < 0.05 && lr < -100 && std::fabs(hl * hl + hr * hr - 2) < 0.01 && hr > hl && early < 1e-3 && loR < 1e-4 * loL && hiL < 1e-4 * hiR,
          "PAN : molette 1, +1 : tout a droite (%+.2f dB, gauche %.0f dB) des le debut de la note ; -1 : tout a gauche (%+.2f dB) ; velocite 1, +0.5 : a mi-chemin, puissance constante (%.3f) ; par voix (KEY) : la note grave a gauche, l'aigue a droite", rr, rl, ll, hl * hl + hr * hr);
  }
  {
    // LFO 1 DEPTH, LFO 2 DEPTH : la molette (l'aftertouch) dose le vibrato. Les deux LFO en carre vers PITCH (100 cents).
    const std::vector<Note> one = {{0.01, 69, 10, 1, QNAN, 0, 0.5}};
    const KV p1 = with(probe(), {{"lfoShape", 2}, {"lfoBeats", 4}, {"lfoDest", 3}, {"lfoAmt", 1}});
    const KV p2 = with(probe(), {{"l2Shape", 4}, {"l2Beats", 4}, {"l2Dest", 4}, {"l2Amt", 1}});
    auto cents = [&](const KV& p, double mw, double at2) { return 100 * (noteIn(render(4, p, one, 1.0, {{0, [mw, at2](Voyager& v) { v.modWheel(mw); v.aftertouch(at2); }}}).L, 0.2, 0.9) - 69); };
    const double f0 = cents(p1, 0, 0), a0 = cents(with(p1, row(1, S_MW, D_LFO1D, 1)), 0, 0), a5 = cents(with(p1, row(1, S_MW, D_LFO1D, 1)), 0.5, 0), a1 = cents(with(p1, row(1, S_MW, D_LFO1D, 1)), 1, 0);
    const double h = cents(with(p1, row(1, S_MW, D_LFO1D, 0.5)), 0, 0), n = cents(with(p1, row(1, S_MW, D_LFO1D, -1)), 0.75, 0), vv = cents(with(p1, row(1, S_VEL, D_LFO1D, 1)), 0, 0);
    const double g0 = cents(p2, 0, 0), b0 = cents(with(p2, row(1, S_AT, D_LFO2D, 1)), 0, 0), b5 = cents(with(p2, row(1, S_AT, D_LFO2D, 1)), 0, 0.5), b1 = cents(with(p2, row(1, S_AT, D_LFO2D, 1)), 0, 1);
    // la seconde destination du LFO 1 (xl1Dest OSC 2 PITCH) suit la meme profondeur ; le LFO 2 n'est pas touche par LFO 1 DEPTH
    const double x = cents(with(p2, row(1, S_MW, D_LFO1D, 1)), 0, 0);
    check(std::fabs(f0 - 100) < 0.5 && std::fabs(a0) < 0.5 && std::fabs(a5 - 50) < 0.5 && std::fabs(a1 - 100) < 0.5 && std::fabs(h - 50) < 0.5 && std::fabs(n - 25) < 0.5 && std::fabs(vv - 50) < 0.5,
          "LFO 1 DEPTH : le vibrato du LFO 1 (%.1f cents sans la ligne) a la molette 0 : %.1f, 0.5 : %.1f, 1 : %.1f ; quantite +0.5, molette 0 : %.1f ; -1, molette 0.75 : %.1f ; par la velocite 0.5 (la voix la plus recente) : %.1f", f0, a0, a5, a1, h, n, vv);
    check(std::fabs(g0 - 100) < 0.5 && std::fabs(b0) < 0.5 && std::fabs(b5 - 50) < 0.5 && std::fabs(b1 - 100) < 0.5 && std::fabs(x - 100) < 0.5, "LFO 2 DEPTH : le vibrato du LFO 2 (%.1f cents) a l'aftertouch 0 : %.1f, 0.5 : %.1f, 1 : %.1f ; LFO 1 DEPTH ne le touche pas (%.1f)", g0, b0, b5, b1, x);
  }
  {
    // en plein son : une ligne change de source, de destination, de quantite ; rien ne saute
    const KV p = with(probe(), {{"osc1", 0.3}});
    std::vector<Ev> evs = {{0, [](Voyager& v) { v.modWheel(1); v.aftertouch(1); }}};
    const int dsts[8] = {D_AMP, D_PAN, D_CUTOFF, D_OSCMIX, D_RES, D_SUB, D_AMP, D_OFF};
    const int srcs[8] = {S_MW, S_AT, S_KEY, S_MW, S_VEL, S_AENV, S_AT, S_MW};
    for (int i = 0; i < 8; ++i) evs.push_back(setAt(0.3 + 0.2 * i, row(1, srcs[i], dsts[i], i % 2 ? 0.8 : -0.8)));
    const Render r = render(4, p, {{0.01, 69, 10, 1, QNAN, 0, 1}}, 2.2, evs, 96);
    const Render ref = render(4, p, {{0.01, 69, 10, 1, QNAN, 0, 1}}, 2.2, {}, 96);
    // (un sinus de 440 Hz : sa derivee seconde, a pleine amplitude et a +3 dB de PAN)
    const double dRef = d2max(ref.L, 0.1, 2.1);
    check(finite(r.L) && finite(r.R) && d2max(r.L, 0.1, 2.1) < 1.6 * dRef && d2max(r.R, 0.1, 2.1) < 1.6 * dRef && r.allocs == 0 && r.heals == 0 && sameFrom(r.L, ref.L, at(1.9)) == false,
          "une ligne qui change 8 fois de source, de destination et de signe en plein son : la quantite redescend, la ligne change, elle remonte ; aucun saut (derivee seconde %.4f / %.4f, le sinus seul %.4f), %ld allocation", d2max(r.L, 0.1, 2.1), d2max(r.R, 0.1, 2.1), dRef, r.allocs);
  }
}

/* ---------------- 5. VOICE MODE : MONO, LEGATO ---------------- */
/** Le niveau (RMS) par tranches de 5 ms entre t0 et t1 : le plus et le moins. */
void levels(const Buf& x, double t0, double t1, double& lo, double& hi) {
  lo = 1e9;
  hi = 0;
  for (double t = t0; t + 0.005 <= t1 + 1e-9; t += 0.005) {
    const double r = rms(x, t, t + 0.005);
    lo = std::min(lo, r);
    hi = std::max(hi, r);
  }
}
void testVoiceMode() {
  std::printf("\n5. VOICE MODE : MONO, LEGATO\n");
  // un sinus a decroissance : apres 0.25 s le niveau est au palier (0.3) ; un redeclenchement le remonte a 1
  const KV p = with(probe(), {{"aA", 0.002}, {"aD", 0.05}, {"aS", 0.3}, {"aR", 0.03}});
  const std::vector<Note> seq = {{0.05, 57, 1.0}, {0.4, 64, 0.2}};  // la seconde pendant la premiere, finie avant elle
  for (int os : {4, 8}) {
    const Render poly = render(os, p, seq, 1.4), mono = render(os, with(p, {{"voiceMode", 1}}), seq, 1.4), leg = render(os, with(p, {{"voiceMode", 2}}), seq, 1.4);
    double lo, hi, lo2, hi2;
    levels(mono.L, 0.4, 0.46, lo, hi);
    levels(leg.L, 0.4, 0.46, lo2, hi2);
    const double sus = rms(mono.L, 0.3, 0.39), susL = rms(leg.L, 0.3, 0.39);
    check(poly.maxAct == 2 && mono.maxAct == 1 && actMax(mono, 0.06, 1.0) == 1 && std::fabs(noteIn(mono.L, 0.2, 0.39) - 57) < 0.01 && std::fabs(noteIn(mono.L, 0.45, 0.59) - 64) < 0.01 && std::fabs(noteIn(mono.L, 0.65, 1.0) - 57) < 0.01 && hi > 2.5 * sus && rms(mono.L, 1.2, 1.39) < 1e-4 && mono.heals == 0,
          "x%d MONO : une seule voix (POLY : %d) ; la note neuve coupe l'autre et redeclenche (le niveau remonte a %.1f fois le palier) : la 3 -> mi 4 (%.2f) -> retour au la 3 encore tenu (%.2f), puis silence", os, poly.maxAct, hi / sus, noteIn(mono.L, 0.45, 0.59), noteIn(mono.L, 0.65, 1.0));
    // LEGATO : pas de redeclenchement (le niveau reste au palier), la hauteur glisse (60 ms : 37 % du chemin restant
    // apres 20 ms, plus rien apres 0.15 s), le retour glisse aussi
    const double g20 = noteAt(leg.L, 0.4 + 0.02), back = noteAt(leg.L, 0.6 + 0.02);
    // (le retour sans redeclenchement, en MONO comme en LEGATO : le niveau reste au palier)
    double lo3, hi3;
    levels(mono.L, 0.6, 0.7, lo3, hi3);
    check(leg.maxAct == 1 && hi2 < 1.15 * susL && lo2 > 0.85 * susL && g20 > 57 + 3 && g20 < 57 + 6 && std::fabs(noteIn(leg.L, 0.52, 0.59) - 64) < 0.03 && back < 64 - 3 && back > 64 - 6 && std::fabs(noteIn(leg.L, 0.75, 1.0) - 57) < 0.01 && hi3 < 1.15 * sus && lo3 > 0.85 * sus && rms(leg.L, 1.2, 1.39) < 1e-4 && leg.heals == 0,
          "x%d LEGATO : une seule voix, l'enveloppe ne repart pas (le niveau reste entre %.2f et %.2f fois le palier), la hauteur glisse (20 ms apres : %.2f, puis mi 4), le retour glisse aussi (%.2f) et ne redeclenche pas, en MONO non plus (%.2f a %.2f)", os, lo2 / susL, hi2 / susL, g20, back, lo3 / sus, hi3 / sus);
  }
  {
    // LEGATO : GLIDE plus long que 60 ms : c'est lui ; le glissement propre d'une note (SLIDE) aussi ; une note qui
    // ne chevauche pas redeclenche
    const Render g = render(4, with(p, {{"voiceMode", 2}, {"glide", 0.3}}), seq, 1.4);
    const double g100 = noteAt(g.L, 0.4 + 0.1);  // exp(-1) du chemin restant : 57 + 7 x 0.63
    const Render sl = render(4, with(p, {{"voiceMode", 2}}), {{0.05, 57, 1.0}, {0.4, 64, 0.5, 1, 57, 0.3}}, 1.4);
    const double s100 = noteAt(sl.L, 0.4 + 0.1);
    const Render apart = render(4, with(p, {{"voiceMode", 2}}), {{0.05, 57, 0.2}, {0.4, 64, 0.2}}, 1.0);
    double lo, hi;
    levels(apart.L, 0.4, 0.46, lo, hi);
    const double ref = rms(apart.L, 0.06, 0.07);
    check(std::fabs(g100 - (57 + 7 * 0.632)) < 0.25 && std::fabs(s100 - (57 + 7 * 0.632)) < 0.25 && hi > 0.5 * ref && std::fabs(noteIn(apart.L, 0.45, 0.59) - 64) < 0.01,
          "LEGATO : GLIDE 0.3 s : a 100 ms la note est a %.2f (61.42) ; une note a son propre glissement de 0.3 s (SLIDE) : %.2f ; deux notes qui ne se chevauchent pas : la seconde redeclenche, sans glisser", g100, s100);
  }
  {
    // les notes du clavier (duree infinie, noteOff) : la pile, priorite a la derniere encore tenue
    for (int mode = 1; mode <= 2; ++mode) {
      const Render r = render(4, with(p, {{"voiceMode", static_cast<double>(mode)}}), {{0.05, 57, INF}, {0.3, 60, INF}, {0.5, 64, INF}}, 1.6,
                              {{0.7, [](Voyager& v) { v.noteOff(64, QNAN); }}, {0.9, [](Voyager& v) { v.noteOff(57, QNAN); }}, {1.1, [](Voyager& v) { v.noteOff(60, QNAN); }}});
      const double n1 = noteIn(r.L, 0.6, 0.69), n2 = noteIn(r.L, 0.8, 0.89), n3 = noteIn(r.L, 0.98, 1.09);
      check(r.maxAct == 1 && std::fabs(n1 - 64) < 0.02 && std::fabs(n2 - 60) < 0.02 && std::fabs(n3 - 60) < 0.02 && rms(r.L, 1.3, 1.59) < 1e-4 && rms(r.L, 0.95, 1.09) > 0.01,
            "%s, trois touches tenues (la, do, mi) : mi (%.2f) ; mi relache : retour au do (%.2f), la derniere encore tenue ; la relache : rien ne change (%.2f) ; do relache : silence", mode == 1 ? "MONO" : "LEGATO", n1, n2, n3);
    }
  }
  {
    // l'arpege : des notes a duree connue. GATE court : chaque note redeclenche ; GATE long (les notes se chevauchent) :
    // en LEGATO elles se lient (aucun redeclenchement), en MONO chacune coupe la precedente
    std::vector<Note> shortG, longG;
    const int m[4] = {57, 60, 64, 69};
    for (int i = 0; i < 8; ++i) {
      shortG.push_back({0.05 + 0.15 * i, static_cast<double>(m[i % 4]), 0.08});
      longG.push_back({0.05 + 0.15 * i, static_cast<double>(m[i % 4]), 0.2});
    }
    auto attacks = [&](const Render& r) {
      // les redeclenchements : le niveau remonte au-dessus de deux fois le palier dans les 30 ms qui suivent un pas
      int n = 0;
      const double sus = 0.3 * rms(r.L, 0.052, 0.06) / 0.95;
      for (int i = 1; i < 8; ++i) {
        double lo, hi;
        levels(r.L, 0.05 + 0.15 * i, 0.05 + 0.15 * i + 0.03, lo, hi);
        if (hi > 2 * sus) n += 1;
      }
      return n;
    };
    const Render a = render(4, with(p, {{"voiceMode", 2}}), shortG, 1.4), b = render(4, with(p, {{"voiceMode", 2}}), longG, 1.4), c = render(4, with(p, {{"voiceMode", 1}}), longG, 1.4), d = render(4, p, longG, 1.4);
    check(attacks(a) == 7 && attacks(b) == 0 && attacks(c) == 7 && a.maxAct == 1 && b.maxAct == 1 && c.maxAct == 1 && d.maxAct >= 2 && std::fabs(noteIn(b.L, 0.05 + 0.15 * 3 + 0.1, 0.05 + 0.15 * 4) - 69) < 0.05,
          "8 pas d'arpege : LEGATO, GATE court : %d redeclenchements sur 7 ; GATE long (les notes se chevauchent) : %d, elles se lient ; MONO, GATE long : %d ; une seule voix partout (POLY : %d)", attacks(a), attacks(b), attacks(c), d.maxAct);
  }
  {
    // de POLY a MONO en plein accord : la note suivante fait taire les autres voix (12 ms) ; retour a POLY
    const KV pp = with(probe(), {{"aR", 0.5}});
    const Render r = render(4, pp, {{0.05, 48, 0.6}, {0.05, 55, 0.6}, {0.05, 60, 0.6}, {0.05, 64, 0.6}, {0.5, 72, 0.3}, {1.2, 60, 0.2}, {1.2, 67, 0.2}}, 1.8, {setAt(0.3, {{"voiceMode", 1}}), setAt(1.0, {{"voiceMode", 0}})});
    check(actMax(r, 0.1, 0.45) == 4 && actMax(r, 0.6, 0.75) == 1 && std::fabs(noteIn(r.L, 0.6, 0.75) - 72) < 0.01 && actMax(r, 1.25, 1.35) >= 2 && r.heals == 0 && d2max(r.L, 0.49, 0.56) < 0.2,
          "POLY -> MONO sur un accord de 4 voix : a la note suivante il n'en reste qu'une (%d), les autres s'eteignent en 12 ms ; retour a POLY : %d voix (deux notes et la queue de la precedente)", actMax(r, 0.6, 0.75), actMax(r, 1.25, 1.35));
  }
  {
    // stop, setOs : la pile est videe (aucune note fantome ne revient)
    // (stop retire aussi les notes en attente : la note suivante est envoyee apres lui)
    const Render r = render(4, with(p, {{"voiceMode", 1}}), {{0.05, 57, INF}, {0.2, 64, INF}}, 1.4, {{0.4, [](Voyager& v) { v.stop(QNAN); }}, {0.7, [](Voyager& v) { v.note(0.8, 72, 0.1, 1, QNAN); }}});
    check(rms(r.L, 0.5, 0.79) < 1e-5 && std::fabs(noteIn(r.L, 0.81, 0.89) - 72) < 0.05 && rms(r.L, 1.1, 1.39) < 1e-4, "MONO, stop : les notes tenues sont oubliees (silence, puis la note suivante seule, puis silence)");
  }
}

/* ---------------- 6. FEEDBACK ---------------- */
void testFeedback() {
  std::printf("\n6. FEEDBACK\n");
  {
    // il agit : le grave et le niveau montent, des harmoniques arrivent ; sans son continu
    const KV p = with(initPatch(), {{"glue", 0}, {"outLevel", 0}, {"cutoff", 1200}, {"envOct", 1}, {"aS", 0.8}, {"drift", 0}});
    const std::vector<Note> one = {{0.01, 45, 10}};
    double lv[5], dcv = 0;
    for (int i = 0; i < 5; ++i) {
      const Render r = render(4, with(p, {{"xFeedback", 0.25 * i}}), one, 1.5);
      lv[i] = db(rms(r.L, 0.5, 1.45));
      double m = 0;
      for (size_t k = at(0.5); k < at(1.45); ++k) m += r.L[k];
      dcv = std::max(dcv, std::fabs(m / static_cast<double>(at(1.45) - at(0.5))));
    }
    check(lv[1] > lv[0] + 0.2 && lv[2] > lv[1] && lv[3] > lv[2] && lv[4] > lv[3] && lv[4] < lv[0] + 12 && dcv < 2e-3, "une note tenue, FEEDBACK 0, 0.25, 0.5, 0.75, 1 : le niveau monte, %.1f, %.1f, %.1f, %.1f, %.1f dB, sans son continu (%.5f)", lv[0], lv[1], lv[2], lv[3], lv[4], dcv);
  }
  {
    // stable a fond : 12 voix, RES a fond, x4 et x8, les cinq filtres, DRIVE, LOAD, WIDE : fini, borne, aucune garde
    int bad = 0;
    double worst = 0, worstRatio = 0;
    std::vector<Note> notes;
    for (int i = 0; i < 12; ++i) notes.push_back({0.01, 33.0 + 5 * i, 0.9, 2});
    for (int i = 0; i < 16; ++i) notes.push_back({1.0 + 0.04 * i, 36.0 + (i * 7) % 48, 0.3, 2});
    for (int os : {4, 8})
      for (int fm = 0; fm < 5; ++fm)
        for (int var = 0; var < 3; ++var) {
          KV p = with(initPatch(), {{"glue", 0}, {"outLevel", 0}, {"fmode", static_cast<double>(fm)}, {"res", 1.5}, {"cutoff", var == 0 ? 400.0 : var == 1 ? 2500.0 : 12000.0}, {"aS", 1}, {"envOct", var == 2 ? 0.0 : 4.0}});
          if (var == 1) p = with(p, {{"drive", 1}, {"load", 1}, {"wide", 1}, {"stack", 30}, {"space", 0.8}, {"noise", 0.5}});
          if (var == 2) p = with(p, {{"xComb", 1}, {"xCombFb", 0.9}, {"xFold", 0.7}, {"sub", 1}});
          const Render off = render(os, p, notes, 1.8);
          const Render r = render(os, with(p, {{"xFeedback", 1}}), notes, 1.8);
          const double pk = std::max(peak(r.L), peak(r.R)), pk0 = std::max(peak(off.L), peak(off.R));
          worst = std::max(worst, pk);
          worstRatio = std::max(worstRatio, pk / pk0);
          // (la borne : chaque voix sort de son VCA, une tanh ; 12 voix x racine de 2 (PAN) x 1.25 (le bus) = 21.2)
          if (!(finite(r.L) && finite(r.R) && r.heals == 0 && pk < 21.3 && pk < 4 * pk0 && r.maxAct == 12)) {
            bad += 1;
            std::printf("        x%d, filtre %d, cas %d : crete %.2f (sans : %.2f), gardes %d\n", os, fm, var, pk, pk0, r.heals);
          }
        }
    check(bad == 0, "FEEDBACK a fond, 12 voix (accent 2), RES a fond (1.5), les 5 filtres, x4 et x8, trois patchs (dont DRIVE + LOAD + WIDE + STACK et COMB + FOLD) : fini, aucune garde, crete au plus %.2f (la borne des 12 VCA : 21.2), au plus %.2f fois celle du patch sans lui (%d en defaut)", worst, worstRatio, bad);
  }
  {
    // la boucle ne survit pas a la note ; engage et coupe en plein son : aucun saut
    const KV p = with(probe(), {{"xFeedback", 1}, {"res", 1.2}, {"cutoff", 2000}, {"aR", 0.05}});
    const Render r = render(4, p, {{0.01, 57, 0.3}}, 1.2);
    const KV q = with(probe(), {{"cutoff", 3000}});
    const Render sw = render(4, q, {{0.01, 57, 10}}, 1.4, {setAt(0.4, {{"xFeedback", 1}}), setAt(0.9, {{"xFeedback", 0}})});
    const Render st = render(4, with(q, {{"xFeedback", 1}}), {{0.01, 57, 10}}, 1.4);
    check(rms(r.L, 0.8, 1.19) < 1e-6 && r.maxAct == 1 && d2max(sw.L, 0.39, 0.5) < 1.1 * d2max(st.L, 0.6, 0.8) && d2max(sw.L, 0.89, 1.0) < 1.1 * d2max(st.L, 0.6, 0.8) && diffDb(sw.L, st.L, 0.6, 0.85) < -60,
          "la note finie, la boucle se tait (%.0f dB) ; FEEDBACK engage puis coupe en plein son : il glisse (15 ms), aucun saut (derivee seconde %.4f, le son tenu %.4f)", db(rms(r.L, 0.8, 1.19)), std::max(d2max(sw.L, 0.39, 0.5), d2max(sw.L, 0.89, 1.0)), d2max(st.L, 0.6, 0.8));
  }
}

/* ---------------- 7. AMP MODE ---------------- */
void testAmp() {
  std::printf("\n7. AMP MODE : CLEAN, TRIODE, PENTODE, SATURATED\n");
  const char* names[4] = {"CLEAN", "TRIODE", "PENTODE", "SATURATED"};
  {
    // le spectre : un sinus (220 Hz) a deux niveaux (cretes 0.36 et 0.69). TRIODE : harmoniques paires (H2 domine) ;
    // PENTODE et SATURATED : impaires (H2 absente), de plus en plus fortes. (CLEAN a deja un peu de H3 : le VCA.)
    double h2[2][4], h3[2][4], h5[2][4], thd[2][4];
    for (int lv = 0; lv < 2; ++lv)
      for (int mode = 0; mode < 4; ++mode) {
        const Render r = render(4, with(probe(), {{"osc1", lv == 0 ? 0.3 : 0.62}, {"ampMode", static_cast<double>(mode)}}), {{0.01, 57, 10}}, 1.6);
        const std::vector<double> m = spectrum(r.L.data() + at(0.8), 32768);
        const double h1 = lineAt(m, 32768, 220);
        h2[lv][mode] = db(lineAt(m, 32768, 440) / h1);
        h3[lv][mode] = db(lineAt(m, 32768, 660) / h1);
        h5[lv][mode] = db(lineAt(m, 32768, 1100) / h1);
        double e = 0;
        for (int k = 2; k <= 20; ++k) e += std::pow(lineAt(m, 32768, 220.0 * k), 2);
        thd[lv][mode] = 100 * std::sqrt(e) / h1;
      }
    bool ok = true;
    for (int lv = 0; lv < 2; ++lv)
      ok = ok && h2[lv][0] < -100 && h2[lv][1] > -40 && h2[lv][1] < -15 && h2[lv][1] > h3[lv][1] + 3 && h3[lv][1] < h3[lv][0] + 3 && h2[lv][2] < -100 && h2[lv][3] < -100 && h3[lv][2] > h3[lv][0] + 6 && h3[lv][3] > h3[lv][2] + 3 &&
           h5[lv][3] > h5[lv][2] + 6 && thd[lv][1] > 1.5 && thd[lv][1] < 12 && thd[lv][2] > 2 * thd[lv][0] && thd[lv][3] > 1.5 * thd[lv][2];
    ok = ok && h2[0][1] > h3[0][1] + 6 && thd[1][3] > 20;
    check(ok, "un sinus, cretes 0.36 / 0.69 : TRIODE H2 %.1f / %.1f dBc, H3 %.1f / %.1f (paires : distorsion %.1f / %.1f %%) ; PENTODE H2 %.0f, H3 %.1f / %.1f, H5 %.1f / %.1f (impaires : %.1f / %.1f %%) ; SATURATED H3 %.1f / %.1f, H5 %.1f / %.1f (%.1f / %.1f %%) ; CLEAN H3 %.1f / %.1f (%.1f / %.1f %%)",
          h2[0][1], h2[1][1], h3[0][1], h3[1][1], thd[0][1], thd[1][1], h2[1][2], h3[0][2], h3[1][2], h5[0][2], h5[1][2], thd[0][2], thd[1][2], h3[0][3], h3[1][3], h5[0][3], h5[1][3], thd[0][3], thd[1][3], h3[0][0], h3[1][0], thd[0][0], thd[1][0]);
  }
  {
    // le niveau : compense a 0.5 dB pres sur un son moyen (l'arpege du patch d'ouverture, un patch gras, un accord),
    // des la premiere seconde et une fois la compensation posee
    const std::vector<Note> chord = {{0.05, 48, 3.8}, {0.05, 55, 3.8}, {0.05, 60, 3.8}, {0.05, 64, 3.8}};
    const struct {
      const char* name;
      KV patch;
      std::vector<Note> notes;
    } cs[] = {
        {"l'arpege du patch d'ouverture", with(initPatch(), {{"outLevel", 0}}), arpNotes(3.9)},
        {"un patch gras (STACK, WIDE, SUB)", with(initPatch(), {{"outLevel", 0}, {"cutoff", 3000}, {"stack", 12}, {"wide", 0.5}, {"sub", 0.5}}), arpNotes(3.9)},
        {"un accord de 4 voix", with(initPatch(), {{"outLevel", 0}, {"cutoff", 2000}, {"aS", 0.9}}), chord},
        {"un son faible (une voix, filtre ferme)", with(initPatch(), {{"outLevel", 0}, {"cutoff", 300}, {"envOct", 1}, {"osc2", 0}}), arpNotes(3.9)},
    };
    int bad = 0;
    double worst = 0, worstEarly = 0;
    for (const auto& c : cs)
      for (int os : {4, 8}) {
        // (le niveau : les deux canaux ensemble ; la compensation est commune aux deux)
        auto both = [](const Render& x, double t0, double t1) { return std::sqrt(std::pow(rms(x.L, t0, t1), 2) + std::pow(rms(x.R, t0, t1), 2)); };
        const Render ref = render(os, c.patch, c.notes, 4.0);
        const double r0 = both(ref, 2.0, 4.0), e0 = both(ref, 0.05, 1.0);
        for (int mode = 1; mode < 4; ++mode) {
          const Render r = render(os, with(c.patch, {{"ampMode", static_cast<double>(mode)}}), c.notes, 4.0);
          const double d = db(both(r, 2.0, 4.0) / r0), e = db(both(r, 0.05, 1.0) / e0);
          worst = std::max(worst, std::fabs(d));
          worstEarly = std::max(worstEarly, std::fabs(e));
          if (!(std::fabs(d) < 0.5 && std::fabs(e) < 1.0 && finite(r.L) && r.heals == 0 && diffDb(ref.L, r.L, 2.0, 4.0) > -50)) {
            bad += 1;
            std::printf("        %s, x%d, %s : %+.2f dB (premiere seconde %+.2f)\n", c.name, os, names[mode], d, e);
          }
        }
      }
    check(bad == 0, "le niveau contre CLEAN, 4 sons (arpege, patch gras, accord, son faible), 3 modes, x4 et x8 : a %.2f dB pres une fois pose, %.2f dB pres des la premiere seconde (%d en defaut)", worst, worstEarly, bad);
  }
  {
    // sans son continu (TRIODE est asymetrique) ; change en plein son : la dose descend, le mode change, elle remonte
    const KV p = with(probe(), {{"osc1", 0.62}});
    const Render tri = render(4, with(p, {{"ampMode", 1}}), {{0.01, 57, 10}}, 2.0);
    double m = 0;
    for (size_t k = at(1.0); k < at(1.0) + 48000 / 220 * 200; ++k) m += tri.L[k];
    m /= 48000 / 220 * 200;
    std::vector<Ev> evs;
    const int seq[6] = {1, 3, 2, 0, 3, 0};
    for (int i = 0; i < 6; ++i) evs.push_back(setAt(0.3 + 0.25 * i, {{"ampMode", static_cast<double>(seq[i])}}));
    const Render sw = render(4, p, {{0.01, 57, 10}}, 2.2, evs);
    const Render clean = render(4, p, {{0.01, 57, 10}}, 2.2);
    const Render sat = render(4, with(p, {{"ampMode", 3}}), {{0.01, 57, 10}}, 2.2);
    // (revenu a CLEAN : l'etage est contourne, la sortie d'avant au bit pres, des que sa dose est retombee)
    check(std::fabs(m) < 2e-3 && d2max(sw.L, 0.25, 2.1) < 1.5 * std::max(d2max(sat.L, 0.5, 2.0), d2max(clean.L, 0.5, 2.0)) && sameFrom(sw.L, clean.L, at(2.0)) && !sameFrom(sw.L, clean.L, at(1.2)) == true && sw.allocs == 0,
          "TRIODE : pas de son continu (%.5f) ; 6 changements de mode en plein son : aucun saut (derivee seconde %.4f ; SATURATED tenu %.4f) ; revenu a CLEAN : la sortie d'avant au bit pres", m, d2max(sw.L, 0.25, 2.1), d2max(sat.L, 0.5, 2.0));
  }
  {
    // le repliement : une scie aigue (do 7) dans SATURATED, x4 et x8 (l'etage est dans le domaine surechantillonne)
    const KV p = with(probe(), {{"wave1", 2}, {"osc1", 0.62}});
    double al[2][2];
    for (int q = 0; q < 2; ++q)
      for (int mode = 0; mode < 2; ++mode) {
        const Render r = render(q == 0 ? 4 : 8, with(p, {{"ampMode", mode == 0 ? 0.0 : 3.0}}), {{0.01, 96, 10}}, 1.6);
        al[q][mode] = aliasDbc(r.L.data() + at(0.8), 32768, midiHz(96), 100, 20000);
      }
    check(al[0][1] < -60 && al[1][1] < -70, "une scie do 7 dans SATURATED : la plus forte raie repliee sous 20 kHz a %.1f dBc en x4, %.1f en x8 (CLEAN : %.1f, %.1f)", al[0][1], al[1][1], al[0][0], al[1][0]);
  }
}

/* ---------------- la chaine (ArpFx) ---------------- */
struct FxRun {
  Buf L, R;
  long allocs = 0;
  int distLat = 0;
};
using FxEv = std::pair<double, ArpFxSettings>;
FxRun chain(const Buf& inL, const Buf& inR, const ArpFxSettings& s0, const std::vector<FxEv>& evs = {}, int block = 128, double sr = SR) {
  ArpFx fx;
  fx.prepare(sr, 1024);
  fx.set(s0, true);
  FxRun r;
  r.L.assign(inL.size(), 0.f);
  r.R.assign(inL.size(), 0.f);
  size_t ei = 0;
  const long a0 = gAllocs.load();
  for (size_t f = 0; f < inL.size();) {
    // (un changement de reglages tombe a son echantillon, quelle que soit la taille des blocs)
    while (ei < evs.size() && static_cast<size_t>(evs[ei].first * sr + 0.5) <= f) fx.set(evs[ei++].second, false);
    size_t end = std::min(f + static_cast<size_t>(block), inL.size());
    if (ei < evs.size()) end = std::min(end, static_cast<size_t>(evs[ei].first * sr + 0.5));
    const int n = static_cast<int>(end - f);
    fx.process(inL.data() + f, inR.data() + f, r.L.data() + f, r.R.data() + f, n);
    f += static_cast<size_t>(n);
  }
  r.allocs = gAllocs.load() - a0;
  r.distLat = fx.distLatencySamples();
  return r;
}
Buf sine(double hz, double amp, size_t n, double phase = 0) {
  Buf x(n);
  for (size_t i = 0; i < n; ++i) x[i] = static_cast<float>(amp * std::sin(2 * PI * hz * static_cast<double>(i) / SR + phase));
  return x;
}
/** Un arpege de sons pinces (des scies amorties) : un son de synthe sans le moteur. */
Buf plucks(double amp, size_t n, double hz, double detune = 0) {
  Buf x(n);
  const double notes[4] = {1, 1.5, 2, 1.26};
  for (size_t i = 0; i < n; ++i) {
    const double t = static_cast<double>(i) / SR;
    const int k = static_cast<int>(t / 0.125);
    const double tt = t - k * 0.125, f = hz * notes[k % 4] * (1 + 0.001 * detune);
    double ph = f * tt;
    ph -= std::floor(ph);
    x[i] = static_cast<float>(amp * (2 * ph - 1) * std::exp(-tt * 14) * std::min(1.0, tt * 2000));
  }
  return x;
}
/** La chaine du site coupee : le moteur sort tel quel au VOLUME pres (aucun envoi, CHORUS OFF, BASS MONO OFF). */
ArpFxSettings dry() {
  ArpFxSettings s;
  s.volume = 1;
  return s;
}

/* ---------------- 8. l'EQ 4 bandes ---------------- */
void testEq() {
  std::printf("\n8. EQ 4 bandes : LOW, MID, HIGH, AIR\n");
  const size_t N = at(1.0);
  const double freqs[] = {30, 100, 300, 900, 2500, 5000, 10000, 15000, 20000};
  constexpr int NF = 9;
  auto gains = [&](const ArpFxSettings& s, double* g) {
    for (int i = 0; i < NF; ++i) {
      const Buf x = sine(freqs[i], 0.1, N);
      const FxRun a = chain(x, x, dry()), b = chain(x, x, s);
      g[i] = db(rms(b.L, 0.5, 1.0) / rms(a.L, 0.5, 1.0));
    }
  };
  {
    double lo[NF], lc[NF], mi[NF], mc[NF], hi[NF], hc[NF], ai[NF], ac[NF], hf[NF];
    ArpFxSettings s = dry();
    s.eqLow = 1;
    gains(s, lo);
    s.eqLow = 0;
    gains(s, lc);
    s = dry();
    s.eqMid = 1;
    gains(s, mi);
    s.eqMid = 0;
    gains(s, mc);
    s = dry();
    s.eqHigh = 1;
    gains(s, hi);
    s.eqHigh = 0;
    gains(s, hc);
    s = dry();
    s.eqAir = 1;
    gains(s, ai);
    s.eqAir = 0;
    gains(s, ac);
    s = dry();
    s.eqLow = 0.75;
    s.eqMid = 0.25;
    s.eqHigh = 0.75;
    gains(s, hf);
    check(std::fabs(lo[0] - 12) < 0.3 && std::fabs(lo[1] - 6) < 0.3 && std::fabs(lo[3]) < 0.3 && std::fabs(lo[5]) < 0.05 && std::fabs(lc[0] + 12) < 0.3 && std::fabs(lc[1] + 6) < 0.3 && std::fabs(lc[3]) < 0.3,
          "LOW a fond : %+.2f dB a 30 Hz, %+.2f a 100 Hz (le milieu du plateau), %+.2f a 900 Hz ; a 0 : %+.2f, %+.2f, %+.2f", lo[0], lo[1], lo[3], lc[0], lc[1], lc[3]);
    check(std::fabs(mi[3] - 12) < 0.1 && mi[2] > 1 && mi[2] < 6 && mi[4] > 1 && mi[4] < 6 && std::fabs(mi[0]) < 0.1 && std::fabs(mi[7]) < 0.3 && std::fabs(mc[3] + 12) < 0.1 && std::fabs(mc[0]) < 0.1 && std::fabs(mc[7]) < 0.3,
          "MID a fond : %+.2f dB a 900 Hz, %+.2f a 300 Hz, %+.2f a 2.5 kHz, %+.2f a 30 Hz, %+.2f a 15 kHz ; a 0 : %+.2f a 900 Hz", mi[3], mi[2], mi[4], mi[0], mi[7], mc[3]);
    check(std::fabs(hi[5] - 6) < 0.3 && std::fabs(hi[7] - 12) < 0.5 && std::fabs(hi[3]) < 0.5 && std::fabs(hi[0]) < 0.05 && std::fabs(hc[5] + 6) < 0.3 && std::fabs(hc[7] + 12) < 0.5,
          "HIGH a fond : %+.2f dB a 5 kHz (le milieu du plateau), %+.2f a 15 kHz, %+.2f a 900 Hz ; a 0 : %+.2f, %+.2f", hi[5], hi[7], hi[3], hc[5], hc[7]);
    check(ai[8] > 7 && ai[8] < 10.01 && ai[6] > 1.5 && ai[6] < 3.5 && ai[7] > ai[6] && ai[8] > ai[7] && ai[5] < 1 && std::fabs(ai[3]) < 0.1 && std::fabs(ai[8] + ac[8]) < 0.01 && std::fabs(ai[6] + ac[6]) < 0.01,
          "AIR a fond : %+.2f dB a 5 kHz, %+.2f a 10 kHz, %+.2f a 15 kHz, %+.2f a 20 kHz (vers +10 a Nyquist), %+.2f a 900 Hz ; a 0 : le miroir (%+.2f a 10 kHz, %+.2f a 20 kHz)", ai[5], ai[6], ai[7], ai[8], ai[3], ac[6], ac[8]);
    check(std::fabs(hf[0] - 6) < 0.3 && std::fabs(hf[3] + 6) < 0.3 && std::fabs(hf[7] - 6) < 0.4, "LOW 0.75, MID 0.25, HIGH 0.75 : %+.2f dB a 30 Hz, %+.2f a 900 Hz, %+.2f a 15 kHz (+6, -6, +6)", hf[0], hf[3], hf[7]);
  }
  {
    // au neutre : contourne au bit pres ; engage puis remis au neutre : la sortie d'avant des la fin de la rampe ;
    // un saut de reglage glisse en 20 ms
    const size_t M = at(3);
    const Buf inL = plucks(0.5, M, 220), inR = plucks(0.5, M, 220, 0.3);
    ArpFxSettings site = dry();
    site.chorus = 1;
    site.delay = 0.5;
    site.reverb = 0.5;
    site.monoLowHz = 120;
    const FxRun ref = chain(inL, inR, site);
    ArpFxSettings on = site;
    on.eqLow = 1;
    on.eqMid = 0;
    on.eqHigh = 0.8;
    on.eqAir = 1;
    const FxRun r = chain(inL, inR, site, {{1.0, on}, {1.5, site}}, 96);
    const bool before = std::memcmp(r.L.data(), ref.L.data(), at(1.0) * 4) == 0;
    mmarp::detail::Eq eq;
    eq.prepare(SR);
    eq.set(0.5, 0.5, 0.5, 0.5, true);
    const bool byp = eq.bypassed();
    const Buf s = sine(1000, 0.3, at(1.0));
    FxRun jump = chain(s, s, dry(), {{0.5, [] { ArpFxSettings e = dry(); e.eqMid = 1; e.eqLow = 0; return e; }()}});
    check(before && byp && sameFrom(r.L, ref.L, at(1.53)) && sameFrom(r.R, ref.R, at(1.53)) && diffDb(ref.L, r.L, 1.1, 1.5) > -20 && r.allocs == 0 && d2max(jump.L, 0.49, 0.56) < 1.02 * d2max(jump.L, 0.7, 0.9),
          "les 4 bandes a 0.5 : la chaine d'avant bit a bit ; engagees 0.5 s puis remises a 0.5 : elles agissent, puis la sortie d'avant au bit pres 30 ms apres ; un saut de reglage glisse (derivee seconde %.4f, le son tenu %.4f) ; %ld allocation", d2max(jump.L, 0.49, 0.56), d2max(jump.L, 0.7, 0.9), r.allocs);
  }
}

/* ---------------- 9. la DISTORTION ---------------- */
void testDist() {
  std::printf("\n9. DISTORTION\n");
  const size_t N = at(1.5);
  {
    // la distorsion (un sinus de 220 Hz, crete 0.5 : le niveau de reference) monte avec la dose ; le niveau est tenu
    const Buf x = sine(220, 0.5, N);
    const FxRun ref = chain(x, x, dry());
    double thd[5], lvl[5], lvlT[5], h3 = 0, h2 = 0;
    for (int i = 0; i < 5; ++i) {
      ArpFxSettings s = dry();
      s.dist = i == 0 ? 0.05 : 0.25 * i;
      s.distTone = 1;
      const FxRun r = chain(x, x, s);
      const std::vector<double> m = spectrum(r.L.data() + at(0.6), 32768);
      const double h1 = lineAt(m, 32768, 220);
      double e = 0;
      for (int k = 2; k <= 60; ++k) e += std::pow(lineAt(m, 32768, 220.0 * k), 2);
      thd[i] = 100 * std::sqrt(e) / h1;
      lvl[i] = db(rms(r.L, 0.6, 1.4) / rms(ref.L, 0.6, 1.4));
      if (i == 4) {
        h3 = db(lineAt(m, 32768, 660) / h1);
        h2 = db(lineAt(m, 32768, 440) / h1);
      }
      s.distTone = 0.5;
      lvlT[i] = db(rms(chain(x, x, s).L, 0.6, 1.4) / rms(ref.L, 0.6, 1.4));
    }
    double worst = 0, worstT = 0;
    for (int i = 0; i < 5; ++i) {
      worst = std::max(worst, std::fabs(lvl[i]));
      worstT = std::max(worstT, std::fabs(lvlT[i]));
    }
    check(thd[0] < 1 && thd[1] > 3 && thd[2] > thd[1] && thd[3] > thd[2] && thd[4] > thd[3] && thd[4] > 35 && h3 > -12 && h2 < -80 && worst < 0.5 && worstT < 1.5,
          "un sinus (220 Hz, crete 0.5), doses 0.05, 0.25, 0.5, 0.75, 1 (+1.8 a +36 dB) : distorsion %.2f, %.1f, %.1f, %.1f, %.1f %% (a fond H3 %.1f dBc, H2 %.0f : impaires) ; le niveau tenu a %.2f dB pres (TONE ouvert), %.2f (TONE 0.5)", thd[0], thd[1], thd[2], thd[3], thd[4], h3, h2, worst, worstT);
  }
  {
    // un son de synthe, a tous les niveaux d'entree : le niveau de sortie reste dans une fourchette (la compensation est
    // calee sur une crete de 0.5 ; plus faible, la distorsion remonte le son ; plus fort, elle le tient)
    double lo = 1e9, hi = -1e9;
    for (double amp : {0.25, 0.5, 1.0})
      for (double d : {0.25, 0.5, 1.0}) {
        const Buf x = plucks(amp, N, 110), y = plucks(amp, N, 110, 2);
        ArpFxSettings s = dry();
        s.dist = d;
        const double g = db(rms(chain(x, y, s).L, 0.3, 1.4) / rms(chain(x, y, dry()).L, 0.3, 1.4));
        lo = std::min(lo, g);
        hi = std::max(hi, g);
      }
    check(lo > -6 && hi < 16, "un arpege pince (cretes 0.25, 0.5, 1 ; doses 0.25, 0.5, 1) : le niveau RMS bouge de %+.1f a %+.1f dB (les notes qui s'eteignent sont remontees : c'est la distorsion)", lo, hi);
  }
  {
    // le repliement : un sinus aigu a fond de dose (+36 dB : presque un carre), TONE ouvert
    double al[3], where[3];
    const double fs[3] = {1245.3, 3520.7, 5065.1};
    for (int i = 0; i < 3; ++i) {
      const Buf x = sine(fs[i], 0.5, N);
      ArpFxSettings s = dry();
      s.dist = 1;
      s.distTone = 1;
      const FxRun r = chain(x, x, s);
      al[i] = aliasDbc(r.L.data() + at(0.6), 32768, fs[i], 30, 20000, &where[i]);
    }
    check(al[0] < -60 && al[1] < -50 && al[2] < -45, "un sinus a +36 dB (un carre), TONE ouvert : la plus forte raie repliee sous 20 kHz a %.1f dBc (1245 Hz), %.1f (3521 Hz), %.1f (5065 Hz)", al[0], al[1], al[2]);
  }
  {
    // TONE : sombre a brillante
    const Buf x = sine(220, 0.5, N);
    double hfE[3];
    int i = 0;
    for (double t : {0.0, 0.5, 1.0}) {
      ArpFxSettings s = dry();
      s.dist = 0.8;
      s.distTone = t;
      const FxRun r = chain(x, x, s);
      const std::vector<double> m = spectrum(r.L.data() + at(0.6), 32768);
      double e = 0;
      for (int k = 9; k <= 80; k += 2) e += std::pow(lineAt(m, 32768, 220.0 * k), 2);
      hfE[i++] = db(std::sqrt(e) / lineAt(m, 32768, 220));
    }
    check(hfE[0] < hfE[1] - 6 && hfE[1] < hfE[2] - 3, "TONE 0, 0.5, 1 : les harmoniques au-dessus de 2 kHz a %.1f, %.1f, %.1f dB du fondamental", hfE[0], hfE[1], hfE[2]);
  }
  {
    // la place : apres CRUSH, avant PHASER ; au neutre contournee au bit pres ; engagee puis coupee : l'entree au
    // bit pres des la fin du fondu ; son retard (39 echantillons, le x4 local) ; aucun saut
    const size_t M = at(3);
    const Buf inL = plucks(0.5, M, 220), inR = plucks(0.5, M, 220, 0.3);
    ArpFxSettings site = dry();
    site.chorus = 2;
    site.delay = 0.4;
    site.reverb = 0.4;
    ArpFxSettings neutral = site;
    neutral.distTone = 0.9;
    const FxRun ref = chain(inL, inR, site), nt = chain(inL, inR, neutral, {{0.5, neutral}}, 480);
    mmarp::detail::PreFx pre;
    pre.prepare(SR);
    ArpFxSettings off = dry(), on = dry();
    on.dist = 0.7;
    pre.set(off, true);
    Buf l = inL, r = inR;
    const bool byp0 = pre.bypassed();
    pre.process(l.data(), r.data(), 24000);
    const bool exact0 = std::memcmp(l.data(), inL.data(), 24000 * 4) == 0;
    pre.set(on, false);
    const int lat = pre.distLatency();
    pre.process(l.data() + 24000, r.data() + 24000, 24000);
    pre.set(off, false);
    pre.process(l.data() + 48000, r.data() + 48000, 960);
    const bool byp = pre.bypassed();
    pre.process(l.data() + 48960, r.data() + 48960, 24000);
    const bool exact = std::memcmp(l.data() + 48960, inL.data() + 48960, 24000 * 4) == 0 && std::memcmp(r.data() + 48960, inR.data() + 48960, 24000 * 4) == 0;
    const bool acted = std::memcmp(l.data() + 30000, inL.data() + 30000, 10000 * 4) != 0;
    // le retard mesure : une bouffee de 300 Hz faible (la zone droite de l'ecreteur), dose 0.06, TONE ouvert ; le
    // retard de son enveloppe (le centre de gravite de l'energie) : les 39 du x4 local, et 0.75 de plus (l'ADAA 0.125,
    // le passe-bas de TONE a 18 kHz 0.6) ; la cloche de presence, a +6 dB, n'ajoute presque rien a 300 Hz
    Buf s1(at(0.5), 0.f);
    for (size_t i2 = at(0.2); i2 < at(0.3); ++i2) {
      const double t = static_cast<double>(i2 - at(0.2)) / static_cast<double>(at(0.3) - at(0.2));
      s1[i2] = static_cast<float>(0.1 * std::pow(std::sin(PI * t), 2) * std::sin(2 * PI * 300 * static_cast<double>(i2) / SR));
    }
    ArpFxSettings d = dry();
    d.dist = 0.06;
    d.distTone = 1;
    const FxRun a = chain(s1, s1, dry()), b = chain(s1, s1, d);
    auto centre = [&](const Buf& x) {
      double e = 0, m = 0;
      for (size_t i2 = at(0.15); i2 < at(0.4); ++i2) {
        e += static_cast<double>(x[i2]) * x[i2];
        m += static_cast<double>(x[i2]) * x[i2] * static_cast<double>(i2);
      }
      return m / e;
    };
    const double dl = centre(b.L) - centre(a.L);
    // l'ordre : CRUSH puis DISTORTION (les marches du CRUSH sont ecretees : le spectre n'est pas celui de l'ordre inverse)
    const Buf sw = sine(220, 0.5, at(1.0));
    ArpFxSettings eng = dry();
    const FxRun sws = chain(sw, sw, eng, {{0.4, [] { ArpFxSettings e = dry(); e.dist = 0.6; return e; }()}, {0.7, dry()}});
    ArpFxSettings held = dry();
    held.dist = 0.6;
    const FxRun hs = chain(sw, sw, held);
    check(same(ref.L, nt.L) && same(ref.R, nt.R) && byp0 && exact0 && lat == 39 && byp && exact && acted && pre.distLatency() == 0 && b.distLat == 39 && a.distLat == 0 && dl > 39.2 && dl < 40.4 && nt.allocs == 0,
          "dose 0 (TONE quelconque) : la chaine d'avant bit a bit ; engagee puis coupee : elle agit, puis l'entree au bit pres 20 ms apres ; son retard : 39 echantillons annonces, %.2f mesures sur une enveloppe (avec l'ADAA et les filtres de TONE) ; %ld allocation", dl, nt.allocs);
    check(d2max(sws.L, 0.39, 0.5) < 1.2 * d2max(hs.L, 0.5, 0.9) && d2max(sws.L, 0.69, 0.8) < 1.2 * d2max(hs.L, 0.5, 0.9) && finite(sws.L), "engagee et coupee en plein son : un fondu de 20 ms, aucun saut (derivee seconde %.4f et %.4f ; le son distordu tenu %.4f)", d2max(sws.L, 0.39, 0.5), d2max(sws.L, 0.69, 0.8), d2max(hs.L, 0.5, 0.9));
  }
}

/* ---------------- 10. tout a fond, en plein son : fini, aucune allocation ---------------- */
void testSafe() {
  std::printf("\n10. Tout a fond, reglages changes en plein son : fini, aucune allocation, toutes tailles de blocs\n");
  {
    // le moteur : 6 lignes, les controleurs, MONO / LEGATO / POLY, FEEDBACK, AMP MODE, tout change toutes les 50 ms
    int bad = 0;
    long allocs = 0;
    double worst = 0;
    for (int os : {4, 8})
      for (int block : {1, 64, 128, 333, 1024}) {
        if (block == 1 && os == 8) continue;
        Lcg g{static_cast<uint32_t>(os * 100 + block)};
        std::vector<Ev> evs;
        for (int i = 0; i < 60; ++i) {
          KV kv;
          for (int n = 1; n <= 6; ++n) kv = with(kv, row(n, static_cast<int>((g.next() * 0.5 + 0.5) * 11.99), static_cast<int>((g.next() * 0.5 + 0.5) * 19.99), g.next()));
          kv = with(kv, {{"xFeedback", std::max(0.f, g.next())}, {"ampMode", std::floor((g.next() * 0.5 + 0.5) * 3.99)}, {"voiceMode", std::floor((g.next() * 0.5 + 0.5) * 2.99)}, {"pbRange", 1 + std::floor((g.next() * 0.5 + 0.5) * 23)},
                         {"xUnison", i % 3 == 0 ? 7.0 : 0.0}, {"stack", 20}, {"wide", i % 2 ? 0.8 : 0.0}, {"fmode", static_cast<double>(i % 5)}, {"xComb", i % 4 == 1 ? 0.7 : 0.0}, {"res", 0.3 + 0.1 * (i % 10)}});
          evs.push_back(setAt(0.05 * i, kv));
          const double pb = g.next(), mw = g.next() * 0.5 + 0.5, at2 = g.next() * 0.5 + 0.5;
          evs.push_back({0.05 * i, [pb, mw, at2](Voyager& v) {
                           v.pitchBend(pb);
                           v.modWheel(mw);
                           v.aftertouch(at2);
                         }});
          if (i % 9 == 4) evs.push_back({0.05 * i, [](Voyager& v) { v.noteOff(57, QNAN); }});
        }
        std::vector<Note> notes = arpNotes(3.0, 1.4);
        for (int i = 0; i < 6; ++i) notes.push_back({0.5 * i, 57, INF, 1, QNAN, 0, 0.9});
        const Render r = render(os, with(initPatch(), {{"noise", 0.3}, {"sub", 0.4}, {"l2Dest", 2}, {"l2Amt", 0.5}, {"lfoAmt", 0.6}, {"lfoDest", 3}}), notes, 3.2, evs, block);
        allocs += r.allocs;
        worst = std::max({worst, peak(r.L), peak(r.R)});
        if (!(finite(r.L) && finite(r.R) && r.allocs == 0 && r.heals == 0 && peak(r.L) < 4 && peak(r.R) < 4 && rms(r.L) > 1e-3)) {
          bad += 1;
          std::printf("        x%d, blocs de %d : fini %d, crete %.2f, gardes %d, allocations %ld\n", os, block, finite(r.L) && finite(r.R), std::max(peak(r.L), peak(r.R)), r.heals, r.allocs);
        }
      }
    check(bad == 0, "le moteur : 6 lignes tirees au hasard, bend, molette, aftertouch, VOICE MODE, FEEDBACK, AMP MODE, 60 changements en 3 s, x4 et x8, blocs de 1 a 1024 : fini, crete %.2f, aucune garde, %ld allocation (process, params, note, noteOff, controleurs) (%d en defaut)", worst, allocs, bad);
  }
  {
    // d'autres frequences d'echantillonnage : le bend a la bonne hauteur, tout a fond, fini
    int bad = 0;
    for (double sr : {44100.0, 96000.0}) {
      KV p = with(probe(), {{"pbRange", 12}, {"xFeedback", 1}, {"ampMode", 3}});
      p = with(p, row(1, S_RND, D_CUTOFF, 1));
      p = with(p, row(2, S_SH, D_PAN, 1));
      const Render r = render(4, p, {{0.01, 57, 10}}, 0.6, {{0, [](Voyager& v) { v.pitchBend(1); }}}, 128, 12, sr);
      double first = -1, last = -1;
      int n = 0;
      for (size_t i = static_cast<size_t>(0.2 * sr); i < static_cast<size_t>(0.55 * sr); ++i)
        if (r.L[i - 1] < 0 && r.L[i] >= 0) {
          const double z = static_cast<double>(i - 1) + static_cast<double>(-r.L[i - 1]) / (static_cast<double>(r.L[i]) - r.L[i - 1]);
          if (first < 0) first = z;
          last = z;
          n += 1;
        }
      const double hz = sr * (n - 1) / (last - first);
      if (!(finite(r.L) && std::fabs(noteOf(hz) - 69) < 0.05 && r.allocs == 0 && r.heals == 0)) {
        bad += 1;
        std::printf("        %.0f Hz : note %.3f\n", sr, noteOf(hz));
      }
    }
    check(bad == 0, "le moteur a 44.1 et 96 kHz : bend +12, FEEDBACK, SATURATED, RANDOM, S&H : fini, la bonne hauteur (%d en defaut)", bad);
  }
  {
    // la chaine : DISTORTION et EQ avec tout le reste, 40 changements, blocs de 1 a 1024 : les memes echantillons
    const size_t N = at(4);
    const Buf inL = plucks(0.6, N, 110), inR = plucks(0.6, N, 110, 0.5);
    ArpFxSettings s = dry();
    s.chorus = 1;
    s.delay = 0.4;
    s.reverb = 0.4;
    s.dist = 1;
    s.distTone = 1;
    s.eqLow = 1;
    s.eqMid = 0;
    s.eqHigh = 1;
    s.eqAir = 1;
    s.crushBits = 0.5;
    s.phMix = 0.7;
    std::vector<FxEv> evs;
    for (int i = 0; i < 40; ++i) {
      ArpFxSettings e = s;
      e.dist = i % 4 == 3 ? 0 : (i % 5) / 4.0;
      e.distTone = (i % 7) / 6.0;
      e.eqLow = (i % 3) / 2.0;
      e.eqMid = ((i + 1) % 5) / 4.0;
      e.eqHigh = i % 6 == 2 ? 0.5 : ((i + 2) % 4) / 3.0;
      e.eqAir = (i % 2) * 1.0;
      e.crushBits = i % 2 ? 0.5 : 0;
      e.flMix = i % 3 == 1 ? 1 : 0;
      evs.push_back({0.2 + 0.09 * i, e});
    }
    const FxRun a = chain(inL, inR, s, evs, 128), b = chain(inL, inR, s, evs, 1), c = chain(inL, inR, s, evs, 1024);
    double dblk = 0;
    for (size_t i = 0; i < N; ++i) dblk = std::max({dblk, std::fabs(static_cast<double>(a.L[i]) - b.L[i]), std::fabs(static_cast<double>(a.R[i]) - c.R[i])});
    int bad = 0;
    for (double sr : {44100.0, 96000.0, 192000.0}) {
      ArpFx fx;
      fx.prepare(sr, 512);
      fx.set(s, true);
      Buf oL(48000), oR(48000);
      const long a0 = gAllocs.load();
      for (size_t f = 0; f + 480 <= oL.size(); f += 480) fx.process(inL.data() + f, inR.data() + f, oL.data() + f, oR.data() + f, 480);
      if (!finite(oL) || !finite(oR) || peak(oL) > 16 || gAllocs.load() != a0 || fx.distLatencySamples() != 39) bad += 1;
    }
    check(finite(a.L) && finite(a.R) && peak(a.L) < 16 && peak(a.R) < 16 && dblk < 1e-6 && a.allocs == 0 && b.allocs == 0 && c.allocs == 0 && bad == 0,
          "la chaine : DISTORTION et EQ a fond avec CRUSH, PHASER, FLANGER, CHORUS, DELAY, REVERB, 40 changements en 4 s : fini, cretes %.2f / %.2f, blocs de 1, 128, 1024 : memes echantillons (%.0e pres), %ld allocation (process, set) ; a 44.1, 96, 192 kHz : fini (%d en defaut)", peak(a.L), peak(a.R), dblk, a.allocs + b.allocs + c.allocs, bad);
  }
}

/* ---------------- le cout ---------------- */
int cpu() {
  std::printf("Le cout (un coeur de cette machine ; blocs de 128 a 48 kHz : temps reel 2666.7 us)\n");
  std::printf("\nMoteur, 12 voix tenues, patch d'ouverture (deux scies, MOOG) : microsecondes par bloc et part d'un coeur\n");
  const KV base = with(initPatch(), {{"aS", 1}, {"noise", 0.2}});
  auto rows6 = [](std::initializer_list<std::pair<int, int>> sd) {
    KV kv;
    int n = 1;
    for (const auto& e : sd) {
      kv = with(kv, row(n, e.first, e.second, n % 2 ? 0.4 : -0.4));
      n += 1;
    }
    return kv;
  };
  const struct {
    const char* name;
    KV more;
  } rows[] = {
      {"sans (le moteur d'avant)", {}},
      {"bend, molette, aftertouch tenus (aucune ligne)", {{"pbRange", 12}}},
      {"1 ligne : MOD WHEEL -> LFO 1 DEPTH (commune)", rows6({{S_MW, D_LFO1D}})},
      {"1 ligne : VELOCITY -> CUTOFF", rows6({{S_VEL, D_CUTOFF}})},
      {"6 lignes legeres (VEL>CUTOFF, KEY>PAN, AENV>AMP, MW>PITCH, FENV>ENV, LFO2>OSC MIX)", rows6({{S_VEL, D_CUTOFF}, {S_KEY, D_PAN}, {S_AENV, D_AMP}, {S_MW, D_PITCH}, {S_FENV, D_ENV}, {S_LFO2, D_OSCMIX}})},
      {"6 lignes par voix (VEL>CUTOFF, KEY>PAN, FENV>WAVE, AENV>RES, S&H>PITCH, RND>AMP)", rows6({{S_VEL, D_CUTOFF}, {S_KEY, D_PAN}, {S_FENV, D_WAVE}, {S_AENV, D_RES}, {S_SH, D_PITCH}, {S_RND, D_AMP}})},
      {"6 lignes lourdes (RND>FOLD, S&H>COMB, AENV>RES, FENV>DRIVE, KEY>STACK, VEL>RING)", with(rows6({{S_RND, D_FOLD}, {S_SH, D_COMB}, {S_AENV, D_RES}, {S_FENV, D_DRIVE}, {S_KEY, D_STACK}, {S_VEL, D_RING}}), {{"stack", 12}})},
      {"  (pour comparer : FOLD 0.5 + COMB 0.5 + STACK 12 + RING 0.5, sans matrice)", {{"xFold", 0.5}, {"xComb", 0.5}, {"stack", 12}, {"xRing", 0.5}}},
      {"FEEDBACK 1", {{"xFeedback", 1}}},
      {"AMP MODE TRIODE", {{"ampMode", 1}}},
      {"AMP MODE PENTODE", {{"ampMode", 2}}},
      {"AMP MODE SATURATED", {{"ampMode", 3}}},
      {"MONO (une voix au lieu de 12)", {{"voiceMode", 1}}},
  };
  {
    // (la machine se met en route : un tour pour rien)
    VoyagerOptions o;
    Voyager v(o, base);
    for (int i = 0; i < 12; ++i) v.note(0, 42 + 3 * i, 100, 1, QNAN);
    float L[128], R[128];
    for (int b = 0; b < 1500; ++b) v.process(L, R, 128);
  }
  double ref[2] = {0, 0};
  int ri = 0;
  for (const auto& rw : rows) {
    double us[2] = {0, 0};
    for (int q = 0; q < 2; ++q) {
      double best = 1e30;
      for (int rep = 0; rep < 5; ++rep) {
        VoyagerOptions o;
        o.os = q == 0 ? 4 : 8;
        o.wideVoices = 12;
        Voyager v(o, with(base, rw.more));
        for (int i = 0; i < 12; ++i) v.note(0, 42 + 3 * i, 100, 1, QNAN, 0, 0.1 + 0.07 * i);
        if (ri >= 1) {
          v.pitchBend(0.5);
          v.modWheel(0.7);
          v.aftertouch(0.4);
        }
        const int blocks = static_cast<int>(2 * SR / 128);
        float L[128], R[128];
        for (int b = 0; b < 40; ++b) v.process(L, R, 128);
        const auto t0 = std::chrono::steady_clock::now();
        for (int b = 0; b < blocks; ++b) v.process(L, R, 128);
        best = std::min(best, std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count());
      }
      us[q] = best / (2 * SR / 128) * 1e6;
    }
    if (ref[0] <= 0) {
      ref[0] = us[0];
      ref[1] = us[1];
    }
    ri += 1;
    std::printf("  %-84s x4 %7.1f us (%5.1f %%, %+6.1f)   x8 %7.1f us (%5.1f %%, %+6.1f)\n", rw.name, us[0], us[0] / 26.667, (us[0] - ref[0]) / 26.667, us[1], us[1] / 26.667, (us[1] - ref[1]) / 26.667);
  }
  std::printf("\nChaine (ArpFx), du bruit en entree, la chaine du site coupee ; pire bloc : le 99.9e centile\n");
  auto run = [&](const char* name, const ArpFxSettings& s) {
    double bestTotal = 1e30, bestMed = 0, bestWorst = 0;
    for (int rep = 0; rep < 3; ++rep) {
      ArpFx fx;
      fx.prepare(SR, 128);
      fx.set(s, true);
      Lcg g{3};
      Buf x(128), y(128), oL(128), oR(128);
      const int blocks = static_cast<int>(10 * SR / 128);
      std::vector<double> ts;
      ts.reserve(static_cast<size_t>(blocks));
      double total = 0;
      for (int b = 0; b < blocks; ++b) {
        for (int i = 0; i < 128; ++i) {
          x[static_cast<size_t>(i)] = 0.3f * g.next();
          y[static_cast<size_t>(i)] = 0.3f * g.next();
        }
        const auto t0 = std::chrono::steady_clock::now();
        fx.process(x.data(), y.data(), oL.data(), oR.data(), 128);
        const double t = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
        ts.push_back(t);
        total += t;
      }
      std::sort(ts.begin(), ts.end());
      if (total < bestTotal) {
        bestTotal = total;
        bestMed = 1e6 * ts[ts.size() / 2];
        bestWorst = 1e6 * ts[static_cast<size_t>(0.999 * static_cast<double>(ts.size()))];
      }
    }
    std::printf("  %-44s %5.2f %% d'un coeur, bloc median %5.1f us, pire %6.1f us\n", name, 100 * bestTotal / 10, bestMed, bestWorst);
  };
  ArpFxSettings s;
  run("la chaine du site seule (tout coupe)", s);
  ArpFxSettings a = s;
  a.dist = 0.7;
  run("DISTORTION", a);
  a = s;
  a.eqLow = 1;
  a.eqMid = 0;
  a.eqHigh = 1;
  a.eqAir = 1;
  run("EQ, les 4 bandes", a);
  a.dist = 0.7;
  run("DISTORTION + EQ", a);
  return 0;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc > 1 && std::strcmp(argv[1], "--cpu") == 0) return cpu();
  testNeutral();
  testControllers();
  testSources();
  testDests();
  testVoiceMode();
  testFeedback();
  testAmp();
  testEq();
  testDist();
  testSafe();
  std::printf("\nhq3_test : %d controles, %d echecs\n", gChecks, gFails);
  return gFails ? 1 : 0;
}
