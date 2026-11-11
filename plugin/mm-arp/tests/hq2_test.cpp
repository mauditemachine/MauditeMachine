// Le banc des trois ensembles du 2026-11-11 du plugin MM-ARP (le VST3 seul) : le sequenceur par pas (dsp/Arp), le
// moteur (dsp/Voyager : glissement par note, RING, FOLD, NOISE COLOR, UNISON, HIGH PASS, COMB) et le rack d'effets
// (dsp/ArpFx : CRUSH, PHASER, FLANGER, PUMP, modes du DELAY, SHIMMER). Sans reference JS (le site ne connait pas ces
// reglages), sans aucun son : des tableaux. La regle verifiee partout : chaque reglage neuf a son neutre rend la
// sortie d'avant AU BIT PRES (les empreintes du moteur ci-dessous ont ete prises sur le code d'avant ces ensembles).
//   g++ -O2 -std=c++17 -Wall -Wextra -Wfloat-equal -ffp-contract=off -I plugin/mm-arp/dsp plugin/mm-arp/tests/hq2_test.cpp
//       plugin/mm-arp/dsp/Voyager.cpp plugin/mm-arp/dsp/ArpFx.cpp plugin/mm-arp/dsp/Arp.cpp -o hq2_test   (une seule ligne)
//   ./hq2_test           tous les controles ; code de sortie 1 au premier echec
//   ./hq2_test --cpu     le cout de chaque fonction (moteur : 12 voix, x4 et x8 ; chaque effet du rack)
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
#ifndef HQ2_GOLDEN_ONLY
#include "../dsp/Arp.h"
#endif

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

/* ---------------- les empreintes du moteur d'avant (seulement l'API d'avant : compile aussi contre l'ancien code) ---- */
KV goldenPatch(int k) {
  switch (k) {
    case 0: return {};
    case 1: return {{"stack", 12}, {"wide", 0.6}, {"glue", 0.5}, {"noise", 0.4}, {"sub", 0.5}};
    case 2: return {{"fmode", 4}, {"res", 0.9}, {"drive", 0.7}, {"space", 0.5}, {"load", 0.5}, {"glide", 0.2}, {"noise", 0.2}};
    default: return {{"fm", 0.6}, {"sync", 1}, {"wave1", 3.4}, {"lfoAmt", 0.5}, {"lfoDest", 1}, {"l2Dest", 7}, {"l2Amt", 0.7}, {"xl1Dest", 2}, {"xl1Amt", 0.5}, {"wide", 0.3}, {"fmode", 2}, {"stack", 20}};
  }
}
uint64_t goldenRender(int k, int os) {
  VoyagerOptions o;
  o.os = os;
  Voyager v(o, goldenPatch(k));
  const int midi[8] = {45, 57, 60, 64, 52, 69, 40, 72};
  for (int i = 0; i < 20; ++i) v.note(0.01 + i * 0.11, midi[i % 8], 0.09 + 0.05 * (i % 3), 0.7 + 0.2 * (i % 4), i ? midi[(i - 1) % 8] : QNAN);
  v.beat(0, 0, 120, true);
  Buf L(static_cast<size_t>(SR * 2.5)), R(L.size());
  const int sizes[5] = {128, 64, 256, 31, 512};
  size_t at = 0;
  int blk = 0;
  while (at < L.size()) {
    const int n = static_cast<int>(std::min<size_t>(static_cast<size_t>(sizes[blk++ % 5]), L.size() - at));
    if (at > 48000 && at < 48600) v.params({{"cutoff", 800.0 + static_cast<double>(at - 48000)}});
    v.process(&L[at], &R[at], n);
    at += static_cast<size_t>(n);
  }
  return fnv(R, fnv(L));
}
// goldenRender(k, os) sur le moteur d'avant le 2026-11-11 (HEAD 5c251d6) : k 0..3, os 4 puis 8
const uint64_t kGolden[4][2] = {
    {0x8caa51804a76d32aull, 0x2490a4e64d70415dull},
    {0x633688e8ca708b36ull, 0xbc6ba2b9fc68d852ull},
    {0x3c9ed8d9e9bb22a7ull, 0x56eb611ba4199cb2ull},
    {0x225a83375f1f10e5ull, 0x740d2047d9e6419full},
};

}  // namespace

#ifdef HQ2_GOLDEN_ONLY
int main() {
  for (int k = 0; k < 4; ++k) std::printf("    {0x%016llxull, 0x%016llxull},\n", static_cast<unsigned long long>(goldenRender(k, 4)), static_cast<unsigned long long>(goldenRender(k, 8)));
  return 0;
}
#else

namespace {

using mmarp::Arp;
using mmarp::ArpProgram;
using mmarp::ArpSink;

int gFails = 0, gChecks = 0;

void check(bool ok, const char* fmt, ...) __attribute__((format(printf, 2, 3)));
void check(bool ok, const char* fmt, ...) {
  char msg[640];
  va_list ap;
  va_start(ap, fmt);
  std::vsnprintf(msg, sizeof msg, fmt, ap);
  va_end(ap);
  gChecks += 1;
  if (!ok) gFails += 1;
  std::printf("  %s %s\n", ok ? "ok   " : "ECHEC", msg);
}

double db(double x) { return 20 * std::log10(std::max(x, 1e-300)); }
bool same(const Buf& a, const Buf& b) { return a.size() == b.size() && std::memcmp(a.data(), b.data(), a.size() * 4) == 0; }
bool sameFrom(const Buf& a, const Buf& b, size_t from) { return a.size() == b.size() && from <= a.size() && std::memcmp(a.data() + from, b.data() + from, (a.size() - from) * 4) == 0; }
bool finite(const Buf& a) {
  for (float x : a)
    if (!std::isfinite(x)) return false;
  return true;
}
double peak(const Buf& a, size_t from = 0, size_t to = 0) {
  if (to == 0 || to > a.size()) to = a.size();
  double p = 0;
  for (size_t i = from; i < to; ++i) p = std::max(p, std::fabs(static_cast<double>(a[i])));
  return p;
}
double rms(const Buf& a, size_t from = 0, size_t to = 0) {
  if (to == 0 || to > a.size()) to = a.size();
  double e = 0;
  for (size_t i = from; i < to; ++i) e += static_cast<double>(a[i]) * a[i];
  return std::sqrt(e / static_cast<double>(std::max<size_t>(1, to - from)));
}
/** La plus grande derivee seconde (un saut ou un coude la font bondir). */
double d2max(const Buf& a, size_t from, size_t to) {
  double m = 0;
  for (size_t i = std::max<size_t>(from, 1); i + 1 < std::min(to, a.size()); ++i) m = std::max(m, std::fabs(static_cast<double>(a[i + 1]) - 2.0 * a[i] + a[i - 1]));
  return m;
}
size_t at(double seconds) { return static_cast<size_t>(seconds * SR); }

/* ---------------- FFT et spectres ---------------- */
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
/** L'energie entre deux frequences. */
double band(const std::vector<double>& m, size_t n, double lo, double hi) {
  double e = 0;
  for (size_t b = static_cast<size_t>(lo * static_cast<double>(n) / SR); b < m.size() && static_cast<double>(b) * SR / static_cast<double>(n) <= hi; ++b) e += m[b] * m[b];
  return e;
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
        fund = std::max(fund, m[static_cast<size_t>(b)]);
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
/** La frequence a l'instant t : la periode entre les passages par zero montants autour de t. */
double freqAt(const Buf& x, double t) {
  const size_t c = at(t);
  double prev = -1;
  std::vector<double> zc;
  for (size_t i = c > 2400 ? c - 2400 : 1; i < std::min(x.size(), c + 2400); ++i)
    if (x[i - 1] < 0 && x[i] >= 0) zc.push_back(static_cast<double>(i - 1) + static_cast<double>(-x[i - 1]) / (static_cast<double>(x[i]) - x[i - 1]));
  for (double z : zc) {
    if (prev >= 0 && z >= static_cast<double>(c)) return SR / (z - prev);
    prev = z;
  }
  return 0;
}
double midiHz(double m) { return 440 * std::pow(2.0, (m - 69) / 12); }

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
/** Un patch de mesure : OSC 1 en sinus seul, filtre grand ouvert, aucune derive, aucun traitement de sortie. */
KV probe() {
  return {{"wave1", 0}, {"wave2", 0}, {"tune1", 0}, {"tune2", 0}, {"fine1", 0}, {"fine2", 0}, {"osc1", 0.6}, {"osc2", 0}, {"sub", 0}, {"fm", 0},
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
  double t, midi, gate, accent, from, glide;
};
struct Ev {
  double t;
  KV params;
};
struct Render {
  Buf L, R;
  int heals = 0;
  long allocs = 0;
};
Render render(int os, const KV& patch, const std::vector<Note>& notes, double seconds, const std::vector<Ev>& evs = {}, int block = 128, int voices = 12) {
  VoyagerOptions o;
  o.sampleRate = SR;
  o.os = os;
  o.maxVoices = voices;
  o.wideVoices = 12;
  Voyager v(o, patch);
  for (const auto& n : notes) v.note(n.t, n.midi, n.gate, n.accent, n.from, n.glide);
  v.beat(0, 0, 120, true);
  const long frames = static_cast<long>(seconds * SR) / block * block;
  Render r;
  r.L.assign(static_cast<size_t>(frames), 0.f);
  r.R.assign(static_cast<size_t>(frames), 0.f);
  std::vector<std::vector<mmarp::ParamKV>> ids(evs.size());
  for (size_t e = 0; e < evs.size(); ++e)
    for (const auto& kv : evs[e].params) ids[e].push_back({Voyager::paramIndex(kv.first), kv.second});
  size_t ei = 0;
  const long a0 = gAllocs.load();
  for (long f = 0; f < frames; f += block) {
    while (ei < evs.size() && evs[ei].t * SR <= static_cast<double>(f)) {
      if (!ids[ei].empty()) v.params(ids[ei].data(), static_cast<int>(ids[ei].size()));
      ei += 1;
    }
    v.process(r.L.data() + f, r.R.data() + f, block);
  }
  r.allocs = gAllocs.load() - a0;
  r.heals = v.heals();
  return r;
}
std::vector<Note> held(double midi, double seconds) { return {{0.02, midi, seconds, 1, QNAN, 0}}; }
std::vector<Note> arpNotes(double seconds) {
  std::vector<Note> n;
  const int m[8] = {54, 57, 61, 64, 66, 69, 73, 76};
  const double step = 60.0 / 130 / 4;
  int i = 0;
  for (double t = 0.05; t < seconds; t += step, ++i) n.push_back({t, static_cast<double>(m[i % 8]), step * 0.54, 0.8 + 0.05 * (i % 7), i ? static_cast<double>(m[(i - 1) % 8]) : QNAN, 0});
  return n;
}
const KV kNeutral = {{"xRing", 0}, {"xFold", 0}, {"xNoiseCol", 0.5}, {"xUnison", 0}, {"xHpf", 0}, {"xComb", 0}, {"xCombFb", 0}};

/* ---------------- 1. le moteur au neutre ---------------- */
void testEngineNeutral() {
  std::printf("\n1. Le moteur : chaque cle neuve a son neutre = le moteur d'avant, au bit pres\n");
  {
    int bad = 0;
    for (int k = 0; k < 4; ++k)
      for (int q = 0; q < 2; ++q) {
        const uint64_t h = goldenRender(k, q == 0 ? 4 : 8);
        if (h != kGolden[k][q]) {
          bad += 1;
          std::printf("        patch %d x%d : %016llx, attendu %016llx\n", k, q == 0 ? 4 : 8, static_cast<unsigned long long>(h), static_cast<unsigned long long>(kGolden[k][q]));
        }
      }
    check(bad == 0, "8 rendus (4 patchs, x4 et x8, blocs de 31 a 512) : les empreintes du moteur d'avant le 2026-11-11 (%d differentes)", bad);
  }
  const struct {
    const char* name;
    KV patch;
  } scenes[] = {
      {"patch d'ouverture", initPatch()},
      {"STACK + WIDE + bruit + SUB + GLIDE", with(initPatch(), {{"stack", 14}, {"wide", 0.6}, {"noise", 0.5}, {"sub", 0.6}, {"glide", 0.15}})},
      {"MS-10 + OVERDRIVE + SPACE + LOAD", with(initPatch(), {{"fmode", 4}, {"res", 0.9}, {"drive", 0.7}, {"space", 0.5}, {"load", 0.5}, {"noise", 0.2}})},
  };
  for (const auto& sc : scenes)
    for (int os : {4, 8}) {
      const auto notes = arpNotes(2.0);
      const Render ref = render(os, sc.patch, notes, 2.0);
      // les cles posees a leur neutre, d'emblee puis en cours de jeu ; la reinjection du peigne sans dose n'est rien
      const Render a = render(os, with(sc.patch, kNeutral), notes, 2.0, {{0.5, kNeutral}, {0.9, {{"xCombFb", 0.8}}}, {1.3, {{"xCombFb", -1}}}});
      check(same(ref.L, a.L) && same(ref.R, a.R) && ref.allocs == 0 && a.allocs == 0 && ref.heals == 0, "%-36s x%d : cles au neutre (et xCombFb seul) bit a bit, %ld allocation", sc.name, os, ref.allocs + a.allocs);
    }
  {
    bool known = true;
    for (const auto& kv : kNeutral) known = known && Voyager::paramIndex(kv.first) >= 0;
    VoyagerOptions o;
    Voyager v(o);
    bool def = true;
    for (const auto& kv : kNeutral) def = def && std::fabs(v.param(Voyager::paramIndex(kv.first)) - kv.second) < 1e-300;
    v.params({{"xUnison", 9}, {"xHpf", 5000}, {"xCombFb", -3}, {"xNoiseCol", 2}});
    const bool clampOk = std::fabs(v.param(Voyager::paramIndex("xUnison")) - 7) < 1e-12 && std::fabs(v.param(Voyager::paramIndex("xHpf")) - 2000) < 1e-9 && std::fabs(v.param(Voyager::paramIndex("xCombFb")) + 1) < 1e-12 && std::fabs(v.param(Voyager::paramIndex("xNoiseCol")) - 1) < 1e-12;
    check(known && def && clampOk, "Voyager::paramIndex connait xRing, xFold, xNoiseCol, xUnison, xHpf, xComb, xCombFb (%d cles en tout) ; defauts neutres, valeurs bornees", Voyager::paramCount());
  }
}

/* ---------------- 2. le glissement par note ---------------- */
void testSlide() {
  std::printf("\n2. Le glissement par note (SLIDE de l'arpegiateur)\n");
  const KV p = probe();
  const double f48 = midiHz(48), f60 = midiHz(60);
  // une note de do 3 depuis do 2 : sans glissement, avec 60 ms (GLIDE du patch a 0), avec le GLIDE du patch seul
  const Render none = render(4, p, {{0.1, 60, 1, 1, 48, 0}}, 0.6);
  const Render sl = render(4, p, {{0.1, 60, 1, 1, 48, 0.06}}, 0.6);
  const Render pg = render(4, with(p, {{"glide", 0.06}}), {{0.1, 60, 1, 1, 48, 0}}, 0.6);
  const Render both = render(4, with(p, {{"glide", 0.6}}), {{0.1, 60, 1, 1, 48, 0.06}}, 0.6);
  const Render nofrom = render(4, p, {{0.1, 60, 1, 1, QNAN, 0.06}}, 0.6);
  const double lat = 19 / SR;
  const double a5 = freqAt(sl.L, 0.1 + lat + 0.006), a20 = freqAt(sl.L, 0.1 + lat + 0.02), a60 = freqAt(sl.L, 0.1 + lat + 0.06), a200 = freqAt(sl.L, 0.3);
  // la loi : l'ecart en demi-tons decroit en exp(-t / (glide / 3))
  const double st20 = 12 * std::log2(f60 / a20), st60 = 12 * std::log2(f60 / a60);
  check(std::fabs(freqAt(none.L, 0.1 + lat + 0.006) / f60 - 1) < 0.01, "sans glissement : la note est a sa hauteur d'emblee (%.1f Hz a 6 ms, do 3 = %.1f)", freqAt(none.L, 0.1 + lat + 0.006), f60);
  check(a5 > f48 && a5 < 0.75 * f60 && std::fabs(st20 - 12 * std::exp(-1.0)) < 0.7 && std::fabs(st60 - 12 * std::exp(-3.0)) < 0.25 && std::fabs(a200 / f60 - 1) < 0.002,
        "glideSec 0.06 depuis do 2 (GLIDE a 0) : %.1f Hz a 6 ms, %.2f demi-tons dessous a 20 ms (loi : %.2f), %.2f a 60 ms (%.2f), %.2f Hz a 200 ms", a5, st20, 12 * std::exp(-1.0), st60, 12 * std::exp(-3.0), a200);
  check(same(sl.L, pg.L) && same(sl.L, both.L), "le meme glissement que GLIDE = 0.06 ; il l'emporte sur le GLIDE du patch (0.6) pour cette note");
  check(same(nofrom.L, none.L), "sans note d'origine : pas de glissement");
}

/* ---------------- 3. RING, FOLD, NOISE COLOR, UNISON, HIGH PASS, COMB ---------------- */
void testOsc() {
  std::printf("\n3. Les oscillateurs : RING, FOLD, NOISE COLOR, UNISON\n");
  const size_t N = 65536;
  {
    // RING : sinus x sinus (la 2 et sa quinte) = la somme et la difference des frequences, rien d'autre
    const KV p = with(probe(), {{"osc1", 0}, {"osc2", 0}, {"tune2", 7}, {"xRing", 0.1}});
    const Render r = render(4, p, held(57, 3), 2.0);
    const std::vector<double> m = spectrum(r.L.data() + at(0.4), N);
    const double f1 = midiHz(57), f2 = midiHz(64);
    const double sum = lineAt(m, N, f1 + f2), dif = lineAt(m, N, f2 - f1), l1 = lineAt(m, N, f1), l2 = lineAt(m, N, f2);
    const Render half = render(4, with(p, {{"xRing", 0.05}}), held(57, 3), 2.0);
    const Render full = render(4, with(p, {{"xRing", 1}}), held(57, 3), 2.0);
    const Render mix = render(4, with(p, {{"osc1", 0.1}}), held(57, 3), 2.0);
    const std::vector<double> mm = spectrum(mix.L.data() + at(0.4), N);
    check(db(sum) > -30 && std::fabs(db(sum / dif)) < 0.5 && db(l1 / sum) < -70 && db(l2 / sum) < -50, "RING seul a 0.1 (220 x 329.6 Hz) : raies a %.1f et %.1f Hz (%.1f / %.1f dB), les deux oscillateurs a %.0f / %.0f dB dessous", f2 - f1, f1 + f2, db(dif), db(sum), db(l1 / sum), db(l2 / sum));
    check(std::fabs(db(rms(half.L, at(0.5)) / rms(r.L, at(0.5))) + 6.02) < 0.3 && rms(full.L, at(0.5)) > 2.5 * rms(r.L, at(0.5)) && std::fabs(db(lineAt(mm, N, f1) / (2 * sum))) < 1.5 && std::fabs(db(lineAt(mm, N, f1 + f2) / sum)) < 1 && finite(full.L),
          "RING a 0.05 : -6 dB ; a 1 : %+.1f dB ; ajoute au melange (OSC 1 au meme reglage : sa raie a %.1f dB, la somme a %.1f dB)", db(rms(full.L, at(0.5)) / rms(r.L, at(0.5))), db(lineAt(mm, N, f1)), db(lineAt(mm, N, f1 + f2)));
  }
  {
    // FOLD : un sinus se replie (harmoniques impairs), niveau tenu ; le repliement spectral reste bas
    const KV p = with(probe(), {{"osc1", 0.62}});
    const double f0 = midiHz(57);
    double h3[4], lvl[4], thd[4];
    int q = 0;
    for (double fold : {0.0, 0.25, 0.6, 1.0}) {
      const Render r = render(4, with(p, {{"xFold", fold}}), held(57, 3), 2.0);
      const std::vector<double> m = spectrum(r.L.data() + at(0.4), N);
      const double h1 = lineAt(m, N, f0);
      double e = 0;
      for (int k = 2; k <= 40; ++k) e += std::pow(lineAt(m, N, k * f0), 2);
      h3[q] = db(lineAt(m, N, 3 * f0) / std::sqrt(h1 * h1 + e));
      thd[q] = 100 * std::sqrt(e / (h1 * h1 + e));
      lvl[q] = db(rms(r.L, at(0.4)));
      q += 1;
    }
    check(thd[0] < 4 && thd[1] > thd[0] + 1 && thd[1] < thd[2] && thd[2] > 20 && thd[3] > 60 && std::fabs(lvl[1] - lvl[0]) < 1.5 && std::fabs(lvl[2] - lvl[0]) < 6 && std::fabs(lvl[3] - lvl[0]) < 6,
          "FOLD 0 / 0.25 / 0.6 / 1 sur un sinus : part des harmoniques %.1f / %.1f / %.0f / %.0f %%, harmonique 3 a %.0f / %.0f / %.0f / %.0f dB, niveau %+.1f / %+.1f / %+.1f dB", thd[0], thd[1], thd[2], thd[3], h3[0], h3[1], h3[2], h3[3], lvl[1] - lvl[0], lvl[2] - lvl[0], lvl[3] - lvl[0]);
    // le repliement : un sinus de do 6 (2093 Hz) et une scie de do 5 replies a fond, la plus forte raie hors harmoniques
    double worst4 = -999, worst8 = -999, saw4 = -999, saw8 = -999;
    for (double fold : {0.3, 0.6, 1.0}) {
      const Render r4 = render(4, with(p, {{"xFold", fold}}), held(96, 3), 2.0);
      const Render r8 = render(8, with(p, {{"xFold", fold}}), held(96, 3), 2.0);
      worst4 = std::max(worst4, aliasDbc(r4.L.data() + at(0.4), N, midiHz(96), 20, 20000));
      worst8 = std::max(worst8, aliasDbc(r8.L.data() + at(0.4), N, midiHz(96), 20, 20000));
      const KV ps = with(p, {{"wave1", 2}, {"xFold", fold}});
      const Render s4 = render(4, ps, held(84, 3), 2.0);
      const Render s8 = render(8, ps, held(84, 3), 2.0);
      saw4 = std::max(saw4, aliasDbc(s4.L.data() + at(0.4), N, midiHz(84), 20, 20000));
      saw8 = std::max(saw8, aliasDbc(s8.L.data() + at(0.4), N, midiHz(84), 20, 20000));
    }
    const double sawRef = aliasDbc(render(4, with(p, {{"wave1", 2}}), held(84, 3), 2.0).L.data() + at(0.4), N, midiHz(84), 20, 20000);
    check(worst4 < -70 && worst8 < -85 && saw4 < -50 && saw8 < -60, "FOLD 0.3 / 0.6 / 1, repliement sous 20 kHz (pire des trois) : sinus do 6 %.1f dBc en x4, %.1f en x8 ; scie do 5 %.1f dBc en x4, %.1f en x8 (scie seule : %.1f)", worst4, worst8, saw4, saw8, sawRef);
  }
  {
    // NOISE COLOR : du rouge au bleu, a sonie proche ; 0.5 : le blanc du site
    const KV p = with(probe(), {{"osc1", 0}, {"noise", 0.5}});
    double tilt[5], lv[5];
    int q = 0;
    for (double c : {0.0, 0.25, 0.5, 0.75, 1.0}) {
      const Render r = render(4, with(p, {{"xNoiseCol", c}}), held(57, 4), 3.0);
      const std::vector<double> m = spectrum(r.L.data() + at(0.3), 131072, 8);
      tilt[q] = 10 * std::log10(band(m, 131072, 4000, 12000) / band(m, 131072, 100, 300));
      lv[q] = db(rms(r.L, at(0.3)));
      q += 1;
    }
    bool mono = true, level = true;
    for (int i = 1; i < 5; ++i) mono = mono && tilt[i] > tilt[i - 1] + 2;
    for (int i = 0; i < 5; ++i) level = level && std::fabs(lv[i] - lv[2]) < 2.5;
    check(mono && level && tilt[0] < -15 && tilt[4] > tilt[2] + 6, "NOISE COLOR 0 / 0.25 / 0.5 / 0.75 / 1 : aigu (4-12 kHz) contre grave (100-300 Hz) %.0f / %.0f / %.0f / %.0f / %.0f dB ; niveau %+.1f / %+.1f / 0 / %+.1f / %+.1f dB", tilt[0], tilt[1], tilt[2], tilt[3], tilt[4], lv[0] - lv[2], lv[1] - lv[2], lv[3] - lv[2], lv[4] - lv[2]);
  }
  {
    // UNISON : 5 ou 7 raies autour de la note (ecart : STACK), a puissance egale, reparties par WIDE
    const size_t NN = 262144;
    const KV p = with(probe(), {{"stack", 24}, {"phase", -1}});
    const double f0 = midiHz(81);
    int lines[3];
    double lv[3], spread[3];
    int q = 0;
    for (double u : {0.0, 5.0, 7.0}) {
      const Render r = render(4, with(p, {{"xUnison", u}}), held(81, 8), 6.5);
      const std::vector<double> m = spectrum(r.L.data() + at(0.5), NN, 12);
      const double binHz = SR / static_cast<double>(NN);
      const long c = std::lround(f0 / binHz);
      double top = 0;
      for (long b = c - 200; b <= c + 200; ++b) top = std::max(top, m[static_cast<size_t>(b)]);
      int n = 0;
      double lo = 0, hi = 0;
      for (long b = c - 200; b <= c + 200; ++b) {
        const size_t i = static_cast<size_t>(b);
        if (m[i] > 0.25 * top && m[i] > m[i - 1] && m[i] >= m[i + 1]) {
          n += 1;
          if (n == 1) lo = static_cast<double>(b) * binHz;
          hi = static_cast<double>(b) * binHz;
        }
      }
      lines[q] = n;
      spread[q] = n > 1 ? 1200 * std::log2(hi / lo) : 0;
      lv[q] = db(rms(r.L, at(0.5)));
      q += 1;
    }
    check(lines[0] == 3 && lines[1] == 5 && lines[2] == 7 && std::fabs(spread[1] - 2 * 24 * 0.985) < 2 && std::fabs(spread[2] - 2 * 24 * 0.9884) < 2 && std::fabs(lv[1] - lv[0]) < 1.5 && std::fabs(lv[2] - lv[0]) < 1.5,
          "UNISON OFF / 5 / 7 (STACK 24 cents) : %d / %d / %d raies, etalees sur %.1f / %.1f / %.1f cents, niveau %+.2f / %+.2f dB", lines[0], lines[1], lines[2], spread[0], spread[1], spread[2], lv[1] - lv[0], lv[2] - lv[0]);
    // sans STACK : UNISON s'engage quand meme (les exemplaires a l'unisson) ; WIDE : les exemplaires se repartissent
    const Render mono = render(4, with(p, {{"xUnison", 7}}), held(69, 3), 2.0);
    const Render wide = render(4, with(p, {{"xUnison", 7}, {"wide", 0.8}}), held(69, 3), 2.0);
    double c = 0, el = 0, er = 0;
    for (size_t i = at(0.3); i < wide.L.size(); ++i) {
      c += static_cast<double>(wide.L[i]) * wide.R[i];
      el += static_cast<double>(wide.L[i]) * wide.L[i];
      er += static_cast<double>(wide.R[i]) * wide.R[i];
    }
    const double corr = c / std::sqrt(el * er);
    const Render back = render(4, p, {{0.02, 69, 0.3, 1, QNAN, 0}, {1.0, 69, 0.8, 1, QNAN, 0}}, 2.0, {{0.5, {{"xUnison", 7}}}, {0.6, {{"xUnison", 0}}}});
    const Render plain = render(4, p, {{0.02, 69, 0.3, 1, QNAN, 0}, {1.0, 69, 0.8, 1, QNAN, 0}}, 2.0);
    double cm = 0, eml = 0, emr = 0;
    for (size_t i = at(0.3); i < mono.L.size(); ++i) {
      cm += static_cast<double>(mono.L[i]) * mono.R[i];
      eml += static_cast<double>(mono.L[i]) * mono.L[i];
      emr += static_cast<double>(mono.R[i]) * mono.R[i];
    }
    check(cm / std::sqrt(eml * emr) > 0.999999 && corr < 0.9 && corr > 0.2 && std::fabs(db(rms(wide.L, at(0.3)) / rms(mono.L, at(0.3)))) < 2.5 && same(back.L, plain.L) && mono.heals == 0,
          "UNISON 7 : mono sans WIDE, correlation G / D %.2f avec WIDE 0.8 ; pris a la note suivante (engage puis coupe entre deux notes : rien ne change)", corr);
  }
}

void testFilter() {
  std::printf("\n4. Le filtre : HIGH PASS, COMB\n");
  {
    // HIGH PASS : 12 dB par octave par voix, absent a 0
    const KV p = probe();
    double att[4];
    int q = 0;
    const struct {
      double midi, hz;
    } cs[4] = {{45, 880}, {57, 880}, {69, 880}, {93, 880}};
    for (const auto& c : cs) {
      const Render a = render(4, p, held(c.midi, 2), 1.0), b = render(4, with(p, {{"xHpf", c.hz}}), held(c.midi, 2), 1.0);
      att[q++] = db(rms(b.L, at(0.5)) / rms(a.L, at(0.5)));
    }
    auto bw = [](double hz) { return -10 * std::log10(1 + std::pow(880.0 / hz, 4)); };
    check(std::fabs(att[0] - bw(110)) < 1 && std::fabs(att[1] - bw(220)) < 1 && std::fabs(att[2] - bw(440)) < 1 && std::fabs(att[3] - bw(1760)) < 0.2,
          "HIGH PASS a 880 Hz : %.1f dB a 110 Hz (Butterworth 12 dB / octave : %.1f), %.1f a 220 (%.1f), %.1f a 440 (%.1f), %.2f a 1760 (%.2f)", att[0], bw(110), att[1], bw(220), att[2], bw(440), att[3], bw(1760));
    const Render lo = render(4, with(p, {{"xHpf", 5}}), held(33, 2), 1.0), lo20 = render(4, with(p, {{"xHpf", 20}}), held(33, 2), 1.0);
    const Render wide = render(4, with(p, {{"xHpf", 880}, {"wide", 0.7}, {"osc2", 0.6}, {"tune2", 7}}), held(45, 2), 1.0), wide0 = render(4, with(p, {{"wide", 0.7}, {"osc2", 0.6}, {"tune2", 7}}), held(45, 2), 1.0);
    check(same(lo.L, lo20.L) && db(rms(wide.R, at(0.5)) / rms(wide0.R, at(0.5))) < -15 && db(rms(wide.L, at(0.5)) / rms(wide0.L, at(0.5))) < -15, "sous 20 Hz : 20 Hz ; avec WIDE les deux canaux sont filtres (%.1f / %.1f dB)", db(rms(wide.L, at(0.5)) / rms(wide0.L, at(0.5))), db(rms(wide.R, at(0.5)) / rms(wide0.R, at(0.5))));
  }
  {
    // COMB : du bruit devient la note jouee (reinjection positive : ses harmoniques ; negative : entre eux)
    const KV p = with(probe(), {{"osc1", 0}, {"noise", 0.4}});
    const size_t NN = 131072;
    auto contrast = [&](double midi, double comb, double fb, int os) {
      const Render r = render(os, with(p, {{"xComb", comb}, {"xCombFb", fb}}), held(midi, 4), 3.2);
      const std::vector<double> m = spectrum(r.L.data() + at(0.4), NN, 8);
      const double f0 = midiHz(midi);
      double on = 0, off = 0;
      for (int k = 2; k <= 9; ++k) {
        on += band(m, NN, k * f0 - 0.06 * f0, k * f0 + 0.06 * f0);
        off += band(m, NN, (k + 0.5) * f0 - 0.06 * f0, (k + 0.5) * f0 + 0.06 * f0);
      }
      return 10 * std::log10(on / off);
    };
    const double none = contrast(57, 0, 0.9, 4), ff = contrast(57, 1, 0, 4), pos = contrast(57, 1, 0.9, 4), neg = contrast(57, 1, -0.9, 4), other = contrast(64, 1, 0.9, 4), hq = contrast(57, 1, 0.9, 8), low = contrast(33, 1, 0.9, 8);
    check(std::fabs(none) < 1.5 && ff > 8 && pos > 15 && neg < -15 && other > 15 && std::fabs(hq - pos) < 2 && low > 12,
          "COMB sur du bruit, harmoniques de la note contre l'entre-deux : sans %.1f dB ; dose 1 %.1f ; reinjection +0.9 %.1f (mi : %.1f ; x8 : %.1f ; la 0 : %.1f) ; -0.9 %.1f", none, ff, pos, other, hq, low, neg);
    // l'accord suit la note : la raie la plus forte d'un bruit peigne est a la fondamentale ou un de ses multiples
    const Render r = render(4, with(p, {{"xComb", 1}, {"xCombFb", 1}}), held(57, 4), 3.2);
    const std::vector<double> m = spectrum(r.L.data() + at(0.4), NN, 8);
    // le centre de gravite des quatre premieres bosses, en cents de l'harmonique
    double cents = 0;
    for (int k = 1; k <= 4; ++k) {
      const double f0 = k * midiHz(57);
      double e = 0, ef = 0;
      for (size_t b = static_cast<size_t>(0.97 * f0 * NN / SR); static_cast<double>(b) * SR / NN <= 1.03 * f0; ++b) {
        e += m[b] * m[b];
        ef += m[b] * m[b] * static_cast<double>(b) * SR / NN;
      }
      const double c = 1200 * std::log2(ef / e / f0);
      if (std::fabs(c) > std::fabs(cents)) cents = c;
    }
    // avec un oscillateur : la sortie reste bornee et proche du niveau d'origine
    const KV po = with(probe(), {{"wave1", 2}});
    const double l0 = rms(render(4, po, held(57, 2), 1.5).L, at(0.5));
    double lmin = 99, lmax = -99;
    for (double fb : {-1.0, -0.5, 0.0, 0.5, 1.0}) {
      const Render c = render(4, with(po, {{"xComb", 1}, {"xCombFb", fb}}), held(57, 2), 1.5);
      const double d = db(rms(c.L, at(0.5)) / l0);
      lmin = std::min(lmin, d);
      lmax = std::max(lmax, d);
    }
    check(std::fabs(cents) < 5 && lmax < 9 && lmin > -20 && r.heals == 0, "COMB accorde sur la note : les quatre premieres bosses a %+.1f cents au plus des harmoniques du la 2 ; une scie peignee, reinjection -1 .. +1 : %+.1f a %+.1f dB", cents, lmin, lmax);
    // le peigne suit un glissement, et la droite a sa ligne avec WIDE
    const Render gl = render(4, with(p, {{"xComb", 1}, {"xCombFb", 0.9}, {"glide", 0.3}, {"wide", 0.6}}), {{0.02, 45, 0.6, 1, QNAN, 0}, {0.6, 69, 1.2, 1, 45, 0}}, 1.8);
    check(finite(gl.L) && finite(gl.R) && gl.heals == 0 && !same(gl.L, gl.R) && peak(gl.L) < 1.5 && gl.allocs == 0, "COMB + GLIDE + WIDE : fini, crete %.2f, 0 remise au repos, %ld allocation", peak(gl.L), gl.allocs);
  }
}

/* ---------------- 5. rien ne clique, rien ne diverge, rien n'alloue ---------------- */
void testEngineSafe() {
  std::printf("\n5. Le moteur : reglages changes en plein son, extremes, allocations\n");
  {
    // un sinus tenu : chaque reglage engage a 0.6 s puis remis au neutre a 1.2 s ; la derivee seconde pendant les
    // passages ne depasse pas celle du son etabli (avant, engage, apres)
    const KV p = with(probe(), {{"osc2", 0.4}, {"tune2", 12}});
    const struct {
      const char* name;
      KV on, off;
    } cs[] = {
        {"RING", {{"xRing", 1}}, {{"xRing", 0}}},
        {"FOLD", {{"xFold", 0.7}}, {{"xFold", 0}}},
        {"HIGH PASS", {{"xHpf", 1500}}, {{"xHpf", 0}}},
        {"HIGH PASS 60 -> 2000 Hz", {{"xHpf", 2000}}, {{"xHpf", 60}}},
        {"COMB", {{"xComb", 1}, {"xCombFb", 0.8}}, {{"xComb", 0}}},
        {"COMB reinjection +0.9 -> -0.9", {{"xComb", 1}, {"xCombFb", -0.9}}, {{"xCombFb", 0.9}}},
    };
    double worst = 0;
    const char* worstName = "";
    for (const auto& c : cs) {
      const bool second = std::strstr(c.name, "->") != nullptr;
      const Render r = render(4, second ? with(p, c.off) : p, held(57, 3), 2.0, {{0.6, c.on}, {1.2, c.off}});
      const double steady = std::max({d2max(r.L, at(0.3), at(0.6)), d2max(r.L, at(0.9), at(1.2)), d2max(r.L, at(1.6), at(1.9))});
      const double moving = std::max(d2max(r.L, at(0.6), at(0.9)), d2max(r.L, at(1.2), at(1.6)));
      if (moving / steady > worst) {
        worst = moving / steady;
        worstName = c.name;
      }
      if (!finite(r.L) || r.heals != 0) worst = 1e9;
    }
    check(worst < 1.5, "RING, FOLD, HIGH PASS, COMB engages, regles et coupes en plein son : derivee seconde au plus x%.2f celle du son etabli (%s ; un saut de 1 %% : x12)", worst, worstName);
    // NOISE COLOR change en plein bruit : le niveau glisse sans trou
    const Render n = render(4, with(probe(), {{"osc1", 0}, {"noise", 0.5}}), held(57, 3), 2.0, {{0.6, {{"xNoiseCol", 0}}}, {1.2, {{"xNoiseCol", 1}}}});
    double lo = 99, hi = -99;
    for (double t = 0.3; t < 1.9; t += 0.05) {
      const double l = db(rms(n.L, at(t), at(t + 0.05)));
      lo = std::min(lo, l);
      hi = std::max(hi, l);
    }
    check(hi - lo < 9 && finite(n.L), "NOISE COLOR change en plein bruit (0.5 -> 0 -> 1) : le niveau par tranches de 50 ms tient dans %.1f dB", hi - lo);
  }
  {
    // tout a fond en meme temps, 12 voix, x8 (et x4), des notes qui se chevauchent et glissent, les reglages qui bougent
    int bad = 0;
    double pk = 0;
    long allocs = 0;
    int heals = 0;
    for (int os : {4, 8})
      for (int variant = 0; variant < 3; ++variant) {
        KV p = with(initPatch(), {{"xRing", 1}, {"xFold", 1}, {"xNoiseCol", variant == 1 ? 1.0 : 0.0}, {"xUnison", 7}, {"xHpf", variant == 2 ? 20.0 : 2000.0}, {"xComb", 1}, {"xCombFb", variant == 1 ? -1.0 : 1.0},
                                 {"stack", 30}, {"wide", 1}, {"space", 1}, {"load", 1}, {"noise", 1.5}, {"sub", 1.32}, {"osc1", 1.32}, {"osc2", 1.32}, {"drive", 1}, {"res", 1}, {"fm", 1}, {"sync", variant == 2 ? 1.0 : 0.0},
                                 {"glue", 1}, {"lfoAmt", 1}, {"lfoDest", 3}, {"l2Dest", 13}, {"l2Amt", 1}, {"xl1Dest", 1}, {"xl1Amt", 1}, {"glide", 0.2}, {"cutoff", 20000}, {"envOct", 6}, {"accFlt", 1}, {"fmode", variant == 0 ? 0.0 : 4.0}});
        std::vector<Note> notes;
        const int m[12] = {24, 36, 43, 48, 55, 60, 64, 67, 72, 79, 96, 120};
        for (int i = 0; i < 60; ++i) notes.push_back({0.01 + 0.025 * i, static_cast<double>(m[(i * 5) % 12]), 0.4, 0.3 + 0.17 * (i % 11), static_cast<double>(m[(i * 7) % 12]), i % 3 == 0 ? 0.06 : 0.0});
        std::vector<Ev> evs;
        for (int i = 0; i < 20; ++i) evs.push_back({0.2 + 0.07 * i, {{"xFold", i % 2 ? 1.0 : 0.0}, {"xComb", i % 3 ? 1.0 : 0.0}, {"xCombFb", i % 2 ? -1.0 : 1.0}, {"xHpf", i % 4 ? 2000.0 : 0.0}, {"xRing", i % 2 ? 0.0 : 1.0}, {"xNoiseCol", (i % 5) / 4.0}, {"xUnison", i % 2 ? 5.0 : 7.0}, {"cutoff", i % 2 ? 200.0 : 20000.0}}});
        const Render r = render(os, p, notes, 2.0, evs);
        if (!finite(r.L) || !finite(r.R)) bad += 1;
        pk = std::max({pk, peak(r.L), peak(r.R)});
        allocs += r.allocs;
        heals += r.heals;
      }
    check(bad == 0 && pk < 4 && allocs == 0 && heals == 0, "tout a fond (RING, FOLD, UNISON 7, HIGH PASS, COMB +/-1, 12 voix, x4 et x8, 3 variantes, reglages secoues) : fini, crete %.2f, %d remise au repos, %ld allocation", pk, heals, allocs);
  }
}

/* ---------------- 6. le sequenceur par pas, jusqu'au moteur ---------------- */
struct VoySink final : ArpSink {
  Voyager& v;
  int notes = 0, glides = 0;
  explicit VoySink(Voyager& voy) : v(voy) {}
  void note(double, int, double, double, double) override {}
  void noteGlide(double t, int midi, double gate, double acc, double from, double glide) override {
    notes += 1;
    if (glide > 0) glides += 1;
    v.note(t, static_cast<double>(midi), gate, acc, from, glide);
  }
  void beat(double t, double b, double bpm, bool run) override { v.beat(t, b, bpm, run); }
  void cancel(double t) override { v.cancel(t); }
};
struct SeqRun {
  Buf L;
  int notes = 0, glides = 0;
  long allocs = 0;
};
SeqRun playSeq(const ArpProgram& prog, double steps, uint32_t seed = 3) {
  VoyagerOptions o;
  Voyager v(o, with(probe(), {{"aR", 0.003}}));
  VoySink sink(v);
  Arp a;
  a.prepare(SR);
  a.setProgram(&prog);
  const double pps = 120.0 / 60 / SR;
  const long frames = static_cast<long>(steps * 6000) / 128 * 128;
  SeqRun r;
  r.L.assign(static_cast<size_t>(frames), 0.f);
  Buf R(r.L.size());
  const long a0 = gAllocs.load();
  for (long f = 0; f < frames; f += 128) {
    a.process(sink, f, 128, true, static_cast<double>(f) * pps, pps, seed);
    v.process(r.L.data() + f, R.data() + f, 128);
  }
  r.allocs = gAllocs.load() - a0;
  r.notes = sink.notes;
  r.glides = sink.glides;
  return r;
}
void testSeq() {
  std::printf("\n6. Le sequenceur par pas, de l'arpegiateur au son (120 a la noire, un pas = 125 ms)\n");
  ArpProgram base;
  base.spn = 4;
  base.gate = 0.5;
  base.prog = {0};
  base.chords = {{0, false, {48, 60}}};
  {
    // SLIDE sur la seconde note (do 2 -> do 3, une note par temps) : la hauteur mesuree glisse, la premiere est tenue
    ArpProgram p = base;
    const SeqRun plain = playSeq(p, 8);
    p.stepSlide[1] = 1;
    const SeqRun sl = playSeq(p, 8);
    const double t1 = 0.5 + 19 / SR; // la seconde note, a la sortie du moteur
    const double f60 = midiHz(60), f48 = midiHz(48);
    const double p5 = freqAt(plain.L, t1 + 0.008), s5 = freqAt(sl.L, t1 + 0.008), s20 = freqAt(sl.L, t1 + 0.02), s200 = freqAt(sl.L, t1 + 0.2);
    const double held1 = rms(sl.L, at(0.40), at(0.49)), cut1 = rms(plain.L, at(0.40), at(0.49));
    check(std::fabs(p5 / f60 - 1) < 0.01 && s5 > f48 && s5 < 0.8 * f60 && s20 > s5 && s20 < 0.9 * f60 && std::fabs(s200 / f60 - 1) < 0.002 && sl.glides == 1 && plain.glides == 0,
          "SLIDE : la note glisse (%.1f Hz a 8 ms, %.1f a 20 ms, %.1f a 200 ms ; sans SLIDE %.1f Hz a 8 ms)", s5, s20, s200, p5);
    check(held1 > 0.05 && cut1 < 1e-4 && sl.allocs == 0, "SLIDE : la note d'avant est tenue jusqu'a elle (niveau juste avant : %.3f ; sans SLIDE : %.6f)", held1, cut1);
  }
  {
    // RATCHET : le nombre de notes ; PROB : la part des notes jouees
    ArpProgram p = base;
    p.spn = 1;
    p.chords = {{0, false, {48, 55, 60, 67}}};
    const int n1 = playSeq(p, 64).notes;
    int got[3];
    for (int r = 2; r <= 4; ++r) {
      for (int i = 0; i < 16; ++i) p.stepRat[i] = static_cast<uint8_t>(i % 4 == 1 ? r : 1);
      got[r - 2] = playSeq(p, 64).notes;
    }
    // les attaques dans le son : RATCHET x4 partout, 16 pas, une attaque tous les quarts de pas
    for (int i = 0; i < 16; ++i) p.stepRat[i] = 4;
    p.gate = 0.3;
    p.chords = {{0, false, {84, 91, 96, 103}}};
    const SeqRun rr = playSeq(p, 16);
    int onsets = 0;
    bool armed = true;
    for (size_t i = 0; i + 96 <= rr.L.size(); i += 96) {
      const double e = rms(rr.L, i, i + 96);
      if (e < 0.003) armed = true;
      else if (e > 0.02 && armed) {
        onsets += 1;
        armed = false;
      }
    }
    check(n1 == 64 && got[0] == 64 + 16 && got[1] == 64 + 32 && got[2] == 64 + 48 && rr.notes == 64 && onsets == 64, "RATCHET x2 / x3 / x4 sur un pas sur quatre : %d / %d / %d notes pour 64 pas (sans : %d) ; x4 partout : %d notes, %d attaques dans le son", got[0], got[1], got[2], n1, rr.notes, onsets);
    ArpProgram q = base;
    q.spn = 1;
    q.chords = {{0, false, {48, 55, 60, 67}}};
    double part[4];
    int k = 0;
    for (int pr : {0, 30, 70, 100}) {
      for (int i = 0; i < 16; ++i) q.stepProb[i] = static_cast<uint8_t>(pr);
      part[k++] = playSeq(q, 2048).notes / 2048.0;
    }
    for (int i = 0; i < 16; ++i) q.stepProb[i] = 50;
    const int a = playSeq(q, 512, 11).notes, b = playSeq(q, 512, 11).notes, c = playSeq(q, 512, 12).notes;
    check(part[0] < 1e-9 && std::fabs(part[1] - 0.3) < 0.03 && std::fabs(part[2] - 0.7) < 0.03 && part[3] > 1 - 1e-9 && a == b && a != c, "PROB 0 / 30 / 70 / 100 %% : %.1f / %.1f / %.1f / %.1f %% des notes jouent ; meme graine : %d et %d notes, autre graine : %d", 100 * part[0], 100 * part[1], 100 * part[2], 100 * part[3], a, b, c);
  }
}

/* ---------------- 7. le rack d'effets ---------------- */
struct FxRun {
  Buf L, R;
  long allocs = 0;
  int flLat = 0, mode = 0;
};
using FxEv = std::pair<double, ArpFxSettings>;
/** La chaine complete ; transport : 120 a la noire depuis ppq 0 (playing), blocs de taille block. */
FxRun chain(const Buf& inL, const Buf& inR, const ArpFxSettings& s0, const std::vector<FxEv>& evs = {}, int block = 128, bool playing = true, bool now = true, double ppq0 = 0) {
  ArpFx fx;
  fx.prepare(SR, 2048);
  fx.set(s0, now);
  FxRun r;
  r.L.assign(inL.size(), 0.f);
  r.R.assign(inL.size(), 0.f);
  const double pps = 120.0 / 60 / SR;
  size_t ei = 0;
  const long a0 = gAllocs.load();
  for (size_t f = 0; f < inL.size();) {
    // (un changement de reglages tombe a son echantillon, quelle que soit la taille des blocs)
    while (ei < evs.size() && at(evs[ei].first) <= f) fx.set(evs[ei++].second, false);
    size_t end = std::min(f + static_cast<size_t>(block), inL.size());
    if (ei < evs.size()) end = std::min(end, at(evs[ei].first));
    const int n = static_cast<int>(end - f);
    fx.setTransport(ppq0 + static_cast<double>(f) * pps, pps, playing);
    fx.process(inL.data() + f, inR.data() + f, r.L.data() + f, r.R.data() + f, n);
    f += static_cast<size_t>(n);
  }
  r.allocs = gAllocs.load() - a0;
  r.flLat = fx.flangerLatencySamples();
  r.mode = fx.delayMode();
  return r;
}
Buf sine(double hz, double amp, size_t n, double phase = 0) {
  Buf x(n);
  for (size_t i = 0; i < n; ++i) x[i] = static_cast<float>(amp * std::sin(2 * PI * hz * static_cast<double>(i) / SR + phase));
  return x;
}
Buf noise(double amp, size_t n, uint32_t seed) {
  Lcg g{seed};
  Buf x(n);
  for (auto& v : x) v = static_cast<float>(amp) * g.next();
  return x;
}
/** Des notes : un sinus qui change de hauteur, sous une enveloppe a attaques nettes (ce qu'un arpege envoie aux effets). */
Buf plucks(double amp, size_t n, double hz0, double phase = 0) {
  Buf x(n);
  double ph = phase;
  for (size_t i = 0; i < n; ++i) {
    const size_t k = i / 6000;
    const double hz = hz0 * std::pow(2.0, static_cast<double>((k * 7) % 12) / 12);
    ph += 2 * PI * hz / SR;
    const double t = static_cast<double>(i % 6000) / SR;
    x[i] = static_cast<float>(amp * std::sin(ph) * std::min(1.0, t / 0.002) * std::exp(-t * 14));
  }
  return x;
}
ArpFxSettings dry() {
  ArpFxSettings s;
  s.volume = 1;
  return s;
}
/** L'enveloppe (valeur efficace par tranches de win echantillons). */
std::vector<double> envelope(const Buf& x, size_t win) {
  std::vector<double> e;
  for (size_t i = 0; i + win <= x.size(); i += win) e.push_back(rms(x, i, i + win));
  return e;
}
/** La correlation de l'enveloppe avec elle-meme decalee de lag tranches. */
double selfCorr(const std::vector<double>& e, size_t from, double lag) {
  double m = 0;
  size_t n = 0;
  for (size_t i = from; i < e.size(); ++i, ++n) m += e[i];
  m /= static_cast<double>(std::max<size_t>(1, n));
  const size_t l = static_cast<size_t>(std::lround(lag));
  double c = 0, a = 0, b = 0;
  for (size_t i = from; i + l < e.size(); ++i) {
    c += (e[i] - m) * (e[i + l] - m);
    a += (e[i] - m) * (e[i] - m);
    b += (e[i + l] - m) * (e[i + l] - m);
  }
  return c / std::sqrt(std::max(1e-300, a * b));
}

void testRackNeutral() {
  std::printf("\n7. Le rack : au neutre, contourne au bit pres ; revenu au neutre, de nouveau contourne\n");
  const size_t N = at(4);
  const Buf inL = plucks(0.5, N, 220), inR = plucks(0.5, N, 220, 0.3);
  ArpFxSettings site = dry();
  site.chorus = 1;
  site.delay = 0.5;
  site.reverb = 0.5;
  site.monoLowHz = 120;
  site.volume = 0.8;
  const FxRun ref = chain(inL, inR, site, {}, 128, false);
  {
    // les champs neufs a leur neutre, des valeurs quelconques pour ceux qui ne dosent pas, le transport qui tourne
    ArpFxSettings s = site;
    s.phRate = 0.9;
    s.phDepth = 1;
    s.phFb = 1;
    s.flRate = 0.8;
    s.flDepth = 1;
    s.flFb = -1;
    s.pumpRate = 2;
    s.pumpShape = 1;
    const FxRun a = chain(inL, inR, s, {{1.0, s}, {2.0, s}}, 480, true);
    const FxRun b = chain(inL, inR, s, {}, 1, true, false);
    const FxRun c = chain(inL, inR, site, {}, 128, false, false);
    check(same(ref.L, a.L) && same(ref.R, a.R) && same(c.L, b.L) && same(c.R, b.R) && a.allocs == 0 && b.allocs == 0, "doses a 0 (PHASER, FLANGER, PUMP, CRUSH, SHIMMER, mode PING PONG), les autres reglages quelconques, transport en marche : la chaine du site bit a bit (blocs de 128, 480 et 1), %ld allocation", a.allocs + b.allocs);
  }
  {
    // chaque module engage 0.5 s puis remis au neutre : il agit, puis il est de nouveau transparent au bit pres
    const struct {
      const char* name;
      std::function<void(ArpFxSettings&)> on;
    } cs[] = {
        {"CRUSH", [](ArpFxSettings& s) { s.crushBits = 0.8; }},
        {"DOWNSAMPLE", [](ArpFxSettings& s) { s.crushRate = 0.7; }},
        {"PHASER", [](ArpFxSettings& s) { s.phMix = 1; }},
        {"FLANGER", [](ArpFxSettings& s) { s.flMix = 1; s.flFb = 0.7; }},
        {"PUMP", [](ArpFxSettings& s) { s.pumpDepth = 1; }},
    };
    // (sans la chaine du site : ses lignes gardent la memoire de ce qui est passe ; PUMP, lui, est apres elle)
    const ArpFxSettings off = dry();
    const FxRun plain = chain(inL, inR, off);
    int bad = 0;
    for (const auto& c : cs) {
      ArpFxSettings on = off;
      c.on(on);
      const FxRun r = chain(inL, inR, off, {{1.0, on}, {1.5, off}}, 128, true, true);
      const bool acted = !sameFrom(r.L, plain.L, at(1.0)) && rms(r.L, at(1.1), at(1.5)) > 0;
      // (a travers la chaine du site : les filtres a 10 Hz de BASS MONO, des biquads en float aux poles tout pres de 1,
      // ont une zone morte : deux passes differents laissent un ecart qui ne s'eteint pas, ici 4e-5 ; les modules
      // seuls reviennent au bit pres, controle suivant ; PUMP, apres la chaine, aussi)
      double dmax = 0;
      for (size_t i = at(3.0); i < N; ++i) dmax = std::max({dmax, std::fabs(static_cast<double>(r.L[i]) - plain.L[i]), std::fabs(static_cast<double>(r.R[i]) - plain.R[i])});
      const bool back = std::strcmp(c.name, "PUMP") == 0 ? sameFrom(r.L, plain.L, at(1.6)) && sameFrom(r.R, plain.R, at(1.6)) : dmax < 2e-4;
      const bool before = std::memcmp(r.L.data(), plain.L.data(), at(1.0) * 4) == 0;
      if (!(acted && back && before && r.allocs == 0 && r.flLat == 0)) {
        bad += 1;
        std::printf("        %s : agit %d, avant %d, apres %d, allocations %ld\n", c.name, acted, before, back, r.allocs);
      }
    }
    check(bad == 0, "CRUSH, DOWNSAMPLE, PHASER, FLANGER, PUMP engages en cours de jeu puis remis a 0 : agissent, puis la sortie d'avant (PUMP : bit a bit ; les autres, a travers BASS MONO et sa zone morte : a 2e-4 pres) (%d en defaut)", bad);
    // les modules seuls : contournes des la fin de la rampe de 20 ms (et le SHIMMER se tait)
    mmarp::detail::PreFx pre;
    pre.prepare(SR);
    ArpFxSettings on = off;
    on.crushBits = 1;
    on.crushRate = 1;
    on.phMix = 1;
    on.flMix = 1;
    pre.set(on, false);
    Buf l = inL, r = inR;
    pre.process(l.data(), r.data(), 24000);
    pre.set(off, false);
    pre.process(l.data() + 24000, r.data() + 24000, 960);
    const bool byp = pre.bypassed();
    pre.process(l.data() + 24960, r.data() + 24960, 24000);
    check(byp && std::memcmp(l.data() + 24960, inL.data() + 24960, 24000 * 4) == 0 && std::memcmp(l.data() + 1000, inL.data() + 1000, 20000 * 4) != 0 && pre.latency() == 0, "CRUSH + PHASER + FLANGER seuls : contournes 960 echantillons (20 ms) apres le retour au neutre, l'entree bit a bit");
  }
}

void testCrush() {
  std::printf("\n8. CRUSH\n");
  const size_t N = at(2);
  {
    // les bits : une rampe lente prend 2^bits niveaux
    Buf ramp(N);
    for (size_t i = 0; i < N; ++i) ramp[i] = static_cast<float>(-0.999 + 1.998 * static_cast<double>(i) / static_cast<double>(N));
    int levels[4];
    int q = 0;
    for (double v : {1.0, 0.75, 0.5, 0.25}) {
      ArpFxSettings s = dry();
      s.crushBits = v;
      mmarp::detail::PreFx pre;
      pre.prepare(SR);
      pre.set(s, true);
      Buf l = ramp, r = ramp;
      pre.process(l.data(), r.data(), static_cast<int>(N));
      std::vector<float> u(l.begin(), l.end());
      std::sort(u.begin(), u.end());
      levels[q++] = static_cast<int>(std::unique(u.begin(), u.end()) - u.begin());
    }
    // (une rampe de -0.999 a 0.999 : 2 x arrondi(0.999 x 2^(bits - 1)) + 1 niveaux)
    check(levels[0] == 17 && levels[1] == 129 && levels[2] == 1023 && levels[3] == 8185, "CRUSH 1 / 0.75 / 0.5 / 0.25 (4, 7, 10, 13 bits) : %d / %d / %d / %d niveaux pour une rampe pleine echelle (2^bits, a un pres)", levels[0], levels[1], levels[2], levels[3]);
  }
  {
    // l'echantillonnage : a 1, 2000 prises par seconde ; un aigu au-dela de la moitie du taux ne se replie presque pas
    const Buf x = sine(300, 0.5, N);
    double steps[3];
    int q = 0;
    for (double v : {1.0, 0.5, 0.25}) {
      ArpFxSettings s = dry();
      s.crushRate = v;
      mmarp::detail::PreFx pre;
      pre.prepare(SR);
      pre.set(s, true);
      Buf l = x, r = x;
      pre.process(l.data(), r.data(), static_cast<int>(N));
      int ch = 0;
      for (size_t i = at(1) + 1; i < N; ++i)
        if (std::memcmp(&l[i], &l[i - 1], 4) != 0) ch += 1;
      steps[q++] = ch;
    }
    const double w0 = 2000, w1 = SR * std::pow(2000 / SR, 0.5), w2 = SR * std::pow(2000 / SR, 0.25);
    ArpFxSettings s = dry();
    s.crushRate = 1;
    mmarp::detail::PreFx pre;
    pre.prepare(SR);
    pre.set(s, true);
    Buf hi = sine(7300, 0.5, N), hiR = hi;
    pre.process(hi.data(), hiR.data(), static_cast<int>(N));
    Buf lo = sine(300, 0.5, N), loR = lo;
    pre.reset();
    pre.process(lo.data(), loR.data(), static_cast<int>(N));
    check(std::fabs(steps[0] / w0 - 1) < 0.02 && std::fabs(steps[1] / w1 - 1) < 0.02 && std::fabs(steps[2] / w2 - 1) < 0.02 && db(rms(hi, at(1)) / 0.3536) < -40 && std::fabs(db(rms(lo, at(1)) / 0.3536)) < 1,
          "DOWNSAMPLE 1 / 0.5 / 0.25 : %.0f / %.0f / %.0f prises par seconde (loi : %.0f / %.0f / %.0f) ; a 2 kHz, un sinus de 7.3 kHz ressort a %.0f dB (sans passe-bas : 0 dB, replie a 700 Hz), 300 Hz a %+.2f dB", steps[0], steps[1], steps[2], w0, w1, w2, db(rms(hi, at(1)) / 0.3536), db(rms(lo, at(1)) / 0.3536));
  }
}

void testPhaserFlanger() {
  std::printf("\n9. PHASER, FLANGER\n");
  const size_t N = at(6);
  {
    // PHASER : le niveau d'un sinus bat a la vitesse dite ; trois encoches dans un bruit ; la droite decalee
    double corr[2], off[2], swing[2];
    int q = 0;
    for (double v : {1.0, 0.7}) {
      ArpFxSettings s = dry();
      s.phMix = 1;
      s.phRate = v;
      s.phDepth = 1;
      s.phFb = 0;
      const Buf x = sine(300, 0.5, N);
      const FxRun r = chain(x, x, s);
      const std::vector<double> e = envelope(r.L, 150);
      const double per = SR / mmarp::ArpFxLaws::phaserHz(v) / 150;
      corr[q] = selfCorr(e, 300, per);
      off[q] = selfCorr(e, 300, per * 0.31);
      double lo = 1e9, hi = 0;
      for (size_t i = 300; i < e.size(); ++i) {
        lo = std::min(lo, e[i]);
        hi = std::max(hi, e[i]);
      }
      swing[q] = db(hi / lo);
      q += 1;
    }
    ArpFxSettings s = dry();
    s.phMix = 1;
    s.phRate = 0;
    s.phDepth = 0;
    s.phFb = 0;
    const Buf nz = noise(0.3, at(8), 5);
    const FxRun st = chain(nz, nz, s), st0 = chain(nz, nz, dry());
    // profondeur 0 : les passe-tout restent a 800 Hz ; six etages : trois encoches (tan(pi / 12), 1, tan(5 pi / 12) x 800 Hz)
    const size_t NN = 262144;
    const std::vector<double> m = spectrum(st.L.data() + at(1), NN, 8), mi = spectrum(st0.L.data() + at(1), NN, 8);
    auto gain = [&](double hz) { return 10 * std::log10(band(m, NN, hz * 0.97, hz * 1.03) / band(mi, NN, hz * 0.97, hz * 1.03)); };
    const double n1 = gain(800 * std::tan(PI / 12)), n2 = gain(800), n3 = gain(800 * std::tan(5 * PI / 12)), p1 = gain(800 * std::tan(PI / 6)), p2 = gain(800 * std::tan(PI / 3)), p0 = gain(40);
    s.phFb = 1;
    const FxRun fbk = chain(nz, nz, s);
    const std::vector<double> mf = spectrum(fbk.L.data() + at(1), NN, 8);
    const double q1 = 10 * std::log10(band(mf, NN, 800 * std::tan(PI / 6) * 0.97, 800 * std::tan(PI / 6) * 1.03) / band(mi, NN, 800 * std::tan(PI / 6) * 0.97, 800 * std::tan(PI / 6) * 1.03));
    s.phFb = 0.4;
    s.phDepth = 1;
    s.phRate = 0.8;
    const FxRun sw = chain(nz, nz, s);
    check(corr[0] > 0.9 && corr[1] > 0.9 && off[0] < 0.6 && off[1] < 0.6 && swing[0] > 12 && swing[1] > 12, "PHASER, RATE 1 / 0.7 (8.00 / %.2f Hz) : l'enveloppe d'un sinus de 300 Hz se repete a cette periode (correlation %.3f / %.3f ; a 0.31 periode : %.2f / %.2f), course %.0f / %.0f dB", mmarp::ArpFxLaws::phaserHz(0.7), corr[0], corr[1], off[0], off[1], swing[0], swing[1]);
    check(n1 < -15 && n2 < -15 && n3 < -15 && std::fabs(p1) < 0.5 && std::fabs(p2) < 0.5 && std::fabs(p0) < 0.5 && q1 > p1 + 6 && !same(sw.L, sw.R) && finite(fbk.L),
          "PHASER 6 etages (profondeur 0) : trois encoches a 214 / 800 / 2986 Hz (%.0f / %.0f / %.0f dB), 0 dB entre elles (%+.2f / %+.2f) ; FEEDBACK 1 : les bosses a %+.1f dB ; gauche et droite decalees", n1, n2, n3, p1, p2, q1);
  }
  {
    // FLANGER : le niveau d'un sinus bat a la vitesse dite ; le passage par zero ; le retard du sec
    ArpFxSettings s = dry();
    s.flMix = 1;
    s.flRate = 1;
    s.flDepth = 1;
    s.flFb = 0;
    const Buf x = sine(1500, 0.5, N);
    const FxRun r = chain(x, x, s);
    const std::vector<double> e = envelope(r.L, 160);
    const double per = SR / 5.0 / 160;
    const double corr = selfCorr(e, 300, per), off = selfCorr(e, 300, per * 0.31);
    // une impulsion : le sec sort 120 echantillons apres (2.5 ms), le mouille autour
    Buf imp(at(1), 0.f);
    imp[1000] = 1;
    s.flDepth = 0;
    const FxRun ir = chain(imp, imp, s);
    size_t first = 0, second = 0;
    for (size_t i = 0; i < ir.L.size() && second == 0; ++i)
      if (std::fabs(ir.L[i]) > 0.2) (first == 0 ? first : second) = i;
    // le passage par zero : a profondeur 1, par instants le mouille rejoint le sec (un bruit double : +6 dB), et, la
    // reinjection et la dose inversees n'existant pas ici, par instants il s'en eloigne (peigne : 0 dB en moyenne)
    s.flDepth = 1;
    s.flRate = 0.5;
    const Buf nz = noise(0.3, N, 9);
    const FxRun tz = chain(nz, nz, s);
    const std::vector<double> en = envelope(tz.L, 48);
    double top = 0, mean = 0;
    for (size_t i = 1000; i < en.size(); ++i) {
      top = std::max(top, en[i]);
      mean += en[i];
    }
    mean /= static_cast<double>(en.size() - 1000);
    s.flFb = 1;
    const FxRun fp = chain(nz, nz, s);
    s.flFb = -1;
    const FxRun fn = chain(nz, nz, s);
    check(corr > 0.9 && off < 0.6 && r.flLat == 120 && first == 1000 + 120 && second == 1000 + 180, "FLANGER, RATE 1 (5 Hz) : enveloppe d'un sinus de 1.5 kHz periodique (correlation %.3f ; a 0.31 periode : %.2f) ; le sec a +%zu echantillons (flangerLatencySamples %d), le mouille a +%zu a profondeur 0", corr, off, first - 1000, r.flLat, second - 1000);
    check(db(top / mean) > 2.0 && finite(fp.L) && finite(fn.L) && peak(fp.L) < 3 && peak(fn.L) < 3 && !same(fp.L, fn.L) && !same(tz.L, tz.R), "FLANGER a travers zero (profondeur 1, bruit) : le niveau monte de %.1f dB au passage ; FEEDBACK +1 / -1 : finis, cretes %.2f / %.2f", db(top / mean), peak(fp.L), peak(fn.L));
  }
}

void testPump() {
  std::printf("\n10. PUMP (120 a la noire : un temps = 24000 echantillons)\n");
  const size_t N = at(4);
  const Buf x = sine(1000, 0.5, N);
  const ArpFxSettings off = dry();
  const FxRun ref = chain(x, x, off);
  auto gainAt = [&](const FxRun& r, double sample) {
    const size_t i = static_cast<size_t>(sample);
    return db(rms(r.L, i, i + 96) / rms(ref.L, i, i + 96));
  };
  {
    ArpFxSettings s = off;
    s.pumpDepth = 1;
    s.pumpRate = 1;
    s.pumpShape = 0.5;
    const FxRun r = chain(x, x, s);
    // au temps : en bas ; la remontee dure 55 % de la periode ; avant le temps suivant : plein niveau
    const double atBeat = gainAt(r, 48000 + 60), half = gainAt(r, 48000 + 0.275 * 24000), late = gainAt(r, 48000 + 0.8 * 24000), pre = gainAt(r, 72000 - 400), next = gainAt(r, 72000 + 60);
    s.pumpDepth = 0.5;
    const FxRun h = chain(x, x, s);
    check(std::fabs(atBeat + 24) < 1.5 && half < -5 && half > -18 && std::fabs(late) < 0.05 && std::fabs(pre) < 0.05 && std::fabs(next - atBeat) < 0.1 && std::fabs(gainAt(h, 48000 + 60) + 12) < 1,
          "PUMP 1, noire : %.1f dB au temps, %.1f dB a mi-remontee, %.2f dB aux 4/5 du temps, %.2f dB 8 ms avant le temps suivant, %.1f dB au temps suivant ; PUMP 0.5 : %.1f dB", atBeat, half, late, pre, next, gainAt(h, 48000 + 60));
    // la plongee : dans les 2 ms d'avant le temps, sans saut (la derivee seconde reste celle du sinus)
    const double g2ms = gainAt(r, 72000 - 96 - 96), d2 = d2max(r.L, 72000 - 400, 72000 + 400) / d2max(ref.L, 72000 - 400, 72000 + 400);
    check(g2ms > -3 && d2 < 1.5, "la plongee tient dans les 2 ms d'avant le temps (%.1f dB 3 ms avant), derivee seconde x%.2f celle du sinus", g2ms, d2);
  }
  {
    // la vitesse : croche, noire, blanche ; la forme : remontee courte ou longue
    int dips[3];
    for (int rate = 0; rate < 3; ++rate) {
      ArpFxSettings s = off;
      s.pumpDepth = 1;
      s.pumpRate = rate;
      const FxRun r = chain(x, x, s);
      int n = 0;
      bool low = false;
      for (size_t i = 0; i + 96 <= N; i += 96) {
        const bool l = rms(r.L, i, i + 96) < 0.1 * rms(ref.L, i, i + 96);
        if (l && !low) n += 1;
        low = l;
      }
      dips[rate] = n;
    }
    ArpFxSettings s = off;
    s.pumpDepth = 1;
    s.pumpShape = 0;
    const FxRun sh = chain(x, x, s);
    s.pumpShape = 1;
    const FxRun lg = chain(x, x, s);
    const double a = gainAt(sh, 48000 + 0.3 * 24000), b = gainAt(lg, 48000 + 0.3 * 24000), c = gainAt(lg, 48000 + 0.9 * 24000);
    check(dips[0] == 16 && dips[1] == 8 && dips[2] == 4 && std::fabs(a) < 0.05 && b < -12 && c < -0.05 && c > -3, "RATE croche / noire / blanche : %d / %d / %d plongees en 8 temps ; RELEASE 0 : %.2f dB a 30 %% du temps ; RELEASE 1 : %.1f dB a 30 %%, %.2f dB a 90 %%", dips[0], dips[1], dips[2], a, b, c);
  }
  {
    // a l'arret : pas de pompage (la sortie d'avant, au bit pres) ; la taille des blocs ne change rien ; un saut de
    // l'hote ne clique pas
    ArpFxSettings s = off;
    s.pumpDepth = 1;
    const FxRun stopped = chain(x, x, s, {}, 128, false);
    const FxRun b1 = chain(x, x, s, {}, 128), b2 = chain(x, x, s, {}, 37), b3 = chain(x, x, s, {}, 1024);
    ArpFx fx;
    fx.prepare(SR, 512);
    fx.set(s, true);
    Buf oL(N), oR(N);
    const double pps = 120.0 / 60 / SR;
    for (size_t f = 0; f < N; f += 128) {
      // la boucle de l'hote : a 1.3 s, retour 0.8 temps plus tot (en pleine remontee -> au pied d'un temps)
      const double ppq = static_cast<double>(f) * pps - (f >= at(1.3) ? 0.8 : 0.0);
      fx.setTransport(ppq, pps, true);
      fx.process(x.data() + f, x.data() + f, oL.data() + f, oR.data() + f, 128);
    }
    const double jump = d2max(oL, at(1.3) - 200, at(1.3) + 600) / d2max(ref.L, at(1.3) - 200, at(1.3) + 600);
    // sans setTransport : la position continue d'elle-meme
    ArpFx fy;
    fy.prepare(SR, 512);
    fy.set(s, true);
    Buf yL(N), yR(N);
    fy.setTransport(0, pps, true);
    for (size_t f = 0; f < N; f += 128) fy.process(x.data() + f, x.data() + f, yL.data() + f, yR.data() + f, 128);
    // (la position est celle que l'hote donne a chaque bloc : d'une taille de bloc a l'autre elle differe au dernier bit)
    double dblk = 0;
    for (size_t i = 0; i < N; ++i) dblk = std::max({dblk, std::fabs(static_cast<double>(b1.L[i]) - b2.L[i]), std::fabs(static_cast<double>(b1.L[i]) - b3.L[i]), std::fabs(static_cast<double>(b1.L[i]) - yL[i])});
    check(same(stopped.L, ref.L) && same(stopped.R, ref.R) && dblk < 1e-6 && jump < 3 && b1.allocs == 0, "a l'arret : la sortie sans PUMP, bit a bit ; blocs de 128, 37, 1024, ou sans setTransport a chaque bloc : %.1e d'ecart au plus ; un saut de l'hote en pleine remontee : derivee seconde x%.2f celle du sinus ; %ld allocation", dblk, jump, b1.allocs);
  }
}

void testDelayModes() {
  std::printf("\n11. Les modes du DELAY (temps : 250 ms = 12000 echantillons)\n");
  const size_t N = at(2);
  Buf impL(N, 0.f), zero(N, 0.f);
  impL[1000] = 1;
  ArpFxSettings s = dry();
  s.delay = 0.6;
  s.delaySeconds = 0.25;
  auto energy = [&](const Buf& x, size_t c) {
    double e = 0;
    for (size_t i = c - 60; i < c + 600 && i < x.size(); ++i) e += static_cast<double>(x[i]) * x[i];
    return 10 * std::log10(std::max(e, 1e-30));
  };
  {
    // une impulsion a gauche seule
    FxRun r[3];
    for (int m = 0; m < 3; ++m) {
      s.dlyMode = m;
      r[m] = chain(impL, zero, s);
    }
    const size_t t = 12000;
    // PING PONG : gauche a t, droite a 2t (+128), gauche a 3t ; STEREO : gauche a t, 2t, 3t, la droite muette
    const bool pp = energy(r[0].L, 1000 + t) > -40 && energy(r[0].R, 1000 + 2 * t + 128) > -45 && energy(r[0].R, 1000 + t) < -80 && energy(r[0].L, 1000 + 2 * t) < -80;
    const bool st = energy(r[1].L, 1000 + t) > -40 && energy(r[1].L, 1000 + 2 * t) > -45 && energy(r[1].L, 1000 + 3 * t) > -50 && energy(r[1].R, 1000 + t) < -80 && energy(r[1].R, 1000 + 2 * t) < -80;
    const bool wd = energy(r[2].L, 1000 + 9000) > -40 && energy(r[2].L, 1000 + 18000) > -45 && energy(r[2].L, 1000 + t) < -80 && energy(r[2].R, 1000 + t) < -80 && energy(r[2].R, 1000 + 9000) < -80;
    s.dlyMode = 2;
    const FxRun both = chain(impL, impL, s);
    const bool wd2 = energy(both.L, 1000 + 9000) > -40 && energy(both.R, 1000 + t) > -40 && energy(both.R, 1000 + 9000) < -80 && energy(both.L, 1000 + t) < -80;
    s.dlyMode = 0;
    ArpFxSettings site = s;
    const FxRun def = chain(impL, zero, site);
    check(pp && same(def.L, r[0].L), "PING PONG : gauche a t (%.0f dB), droite a 2t + 128 (%.0f dB), le delay du site", energy(r[0].L, 1000 + t), energy(r[0].R, 1000 + 2 * t + 128));
    check(st, "STEREO : une impulsion a gauche revient a gauche a t, 2t, 3t (%.0f / %.0f / %.0f dB), la droite reste muette", energy(r[1].L, 1000 + t), energy(r[1].L, 1000 + 2 * t), energy(r[1].L, 1000 + 3 * t));
    check(wd && wd2, "WIDE : la gauche a 3/4 du temps (9000 echantillons : %.0f dB, puis 18000 : %.0f dB), la droite au temps (%.0f dB)", energy(both.L, 1000 + 9000), energy(both.L, 1000 + 18000), energy(both.R, 1000 + t));
  }
  {
    // un changement de mode en plein son : pas de clic, puis le mode neuf (les lignes repartent vides)
    const size_t M = at(4);
    const Buf x = sine(330, 0.4, M);
    s.dlyMode = 0;
    ArpFxSettings s1 = s, s2 = s;
    s1.dlyMode = 1;
    s2.dlyMode = 2;
    const FxRun r = chain(x, x, s, {{1.0, s1}, {2.0, s2}, {3.0, s}});
    const double steady = d2max(r.L, at(0.5), at(1.0));
    const double moving = std::max({d2max(r.L, at(1.0), at(1.1)), d2max(r.L, at(2.0), at(2.1)), d2max(r.L, at(3.0), at(3.1))});
    const FxRun b = chain(x, x, s, {{1.0, s1}, {2.0, s2}, {3.0, s}}, 53);
    check(moving / steady < 1.5 && r.mode == 0 && same(r.L, b.L) && same(r.R, b.R) && r.allocs == 0 && finite(r.L), "mode change en plein son (PING PONG -> STEREO -> WIDE -> PING PONG) : derivee seconde x%.2f celle du son etabli, %ld allocation, blocs sans effet", moving / steady, r.allocs);
  }
}

void testShimmer() {
  std::printf("\n12. SHIMMER\n");
  const size_t N = at(5);
  ArpFxSettings s = dry();
  s.reverb = 1;
  {
    // un la 3 (440 Hz) dans la reverb : l'octave (880), puis la suivante (1760), apparaissent
    const Buf x = sine(440, 0.3, N);
    const FxRun off = chain(x, x, s);
    s.shimmer = 1;
    const FxRun on = chain(x, x, s);
    s.shimmer = 0.5;
    const FxRun half = chain(x, x, s);
    const size_t NN = 131072;
    const std::vector<double> m0 = spectrum(off.L.data() + at(2), NN), m1 = spectrum(on.L.data() + at(2), NN), mh = spectrum(half.L.data() + at(2), NN);
    const double f1 = db(lineAt(m1, NN, 440, 40)), o1 = db(lineAt(m1, NN, 880, 60)), o2 = db(lineAt(m1, NN, 1760, 120)), o0 = db(lineAt(m0, NN, 880, 60)), oh = db(lineAt(mh, NN, 880, 60));
    check(o1 > o0 + 40 && o1 > f1 - 30 && o2 > o0 + 20 && oh < o1 - 3 && oh > o0 + 30 && on.allocs == 0, "un la 440 dans la reverb : sans SHIMMER 880 Hz a %.0f dB ; SHIMMER 1 : 880 Hz a %.0f dB, 1760 Hz a %.0f dB (440 : %.0f dB) ; SHIMMER 0.5 : 880 Hz a %.0f dB", o0, o1, o2, f1, oh);
  }
  {
    // la boucle ne s'emballe pas : 12 s de bruit fort, reverb et shimmer a fond
    const size_t M = at(12);
    const Buf nz = noise(0.5, M, 21), nz2 = noise(0.5, M, 22);
    s.shimmer = 1;
    const FxRun on = chain(nz, nz2, s);
    s.shimmer = 0;
    const FxRun off = chain(nz, nz2, s);
    const double grow = db(rms(on.L, at(8), at(12)) / rms(on.L, at(3), at(7))), add = db(rms(on.L, at(3)) / rms(off.L, at(3)));
    // coupe en cours de jeu : il se tait en 20 ms, la reverb retrouve son entree d'avant
    s.shimmer = 1;
    ArpFxSettings s0 = s;
    s0.shimmer = 0;
    const Buf x = sine(440, 0.3, at(4));
    const FxRun cut = chain(x, x, s, {{1.5, s0}});
    const double steady = d2max(cut.L, at(1.2), at(1.5)), moving = d2max(cut.L, at(1.5), at(1.6));
    const FxRun b = chain(x, x, s, {{1.5, s0}}, 61);
    check(std::fabs(grow) < 1 && add > 0 && add < 6 && finite(on.L) && peak(on.L) < 4 && moving / steady < 1.5 && same(cut.L, b.L), "bruit fort, REVERB et SHIMMER a fond, 12 s : le niveau ne monte pas (%+.2f dB entre 3-7 s et 8-12 s), %+.1f dB de plus que sans ; coupe en plein son : derivee seconde x%.2f ; blocs sans effet", grow, add, moving / steady);
  }
}

void testRackSafe() {
  std::printf("\n13. Le rack : reglages changes en plein son, extremes, blocs, allocations\n");
  {
    // un sinus : chaque reglage engage a 1 s puis coupe a 2 s ; la derivee seconde pendant les passages ne depasse
    // pas celle du son etabli (avant, engage, apres)
    const size_t N = at(3);
    const Buf x = sine(220, 0.5, N);
    const struct {
      const char* name;
      std::function<void(ArpFxSettings&)> on;
      double tol;
    } cs[] = {
        {"PHASER", [](ArpFxSettings& s) { s.phMix = 1; s.phRate = 0.8; }, 1.5},
        {"PHASER + FEEDBACK", [](ArpFxSettings& s) { s.phMix = 0.7; s.phFb = 1; s.phDepth = 1; }, 1.5},
        {"FLANGER", [](ArpFxSettings& s) { s.flMix = 1; s.flRate = 0.8; }, 1.5},
        {"FLANGER + FEEDBACK", [](ArpFxSettings& s) { s.flMix = 0.6; s.flFb = -0.9; s.flDepth = 1; s.flRate = 0.9; }, 1.5},
        {"PUMP", [](ArpFxSettings& s) { s.pumpDepth = 1; s.pumpRate = 0; }, 1.5},
        {"SHIMMER", [](ArpFxSettings& s) { s.shimmer = 1; }, 1.5},
    };
    double worst = 0;
    const char* worstName = "";
    for (const auto& c : cs) {
      ArpFxSettings off = dry();
      off.reverb = 0.5;
      ArpFxSettings on = off;
      c.on(on);
      const FxRun r = chain(x, x, off, {{1.0, on}, {2.0, off}});
      const double steady = std::max({d2max(r.L, at(0.5), at(1.0)), d2max(r.L, at(1.05), at(2.0)), d2max(r.L, at(2.05), at(3.0))});
      const double moving = std::max(d2max(r.L, at(1.0), at(1.05)), d2max(r.L, at(2.0), at(2.05)));
      if (moving / steady / c.tol > worst) {
        worst = moving / steady / c.tol;
        worstName = c.name;
      }
      if (!finite(r.L) || r.allocs != 0) worst = 1e9;
    }
    check(worst < 1, "PHASER, FLANGER, PUMP, SHIMMER engages puis coupes en plein son : derivee seconde au plus x%.2f celle du son etabli (%s ; un saut de 1 %% : x12)", worst * 1.5, worstName);
    // CRUSH est fait de marches : ses doses entrent par une rampe (l'ecart a l'entree grandit sans saut)
    ArpFxSettings off = dry(), on = off;
    on.crushBits = 1;
    on.crushRate = 1;
    const FxRun plain = chain(x, x, off), r = chain(x, x, off, {{1.0, on}, {2.0, off}});
    auto dev = [&](double t0, double t1) {
      double d = 0;
      for (size_t i = at(t0); i < at(t1); ++i) d = std::max(d, std::fabs(static_cast<double>(r.L[i]) - plain.L[i]));
      return d;
    };
    check(dev(1.0, 1.0005) < 0.002 && dev(1.0, 1.002) < 0.02 && dev(1.0, 1.02) > 0.05 && dev(2.019, 2.02) < 0.02 && dev(2.3, 2.5) < 1e-4, "CRUSH + DOWNSAMPLE engages a fond : l'ecart a l'entree vaut %.4f apres 0.5 ms, %.4f apres 2 ms, %.2f apres 20 ms ; coupes : %.4f a la fin de la rampe", dev(1.0, 1.0005), dev(1.0, 1.002), dev(1.0, 1.02), dev(2.019, 2.02));
  }
  {
    // tout a fond en meme temps, des reglages secoues, par blocs de 1 a 1024 : fini, borne, memes echantillons
    const size_t N = at(6);
    const Buf inL = plucks(0.9, N, 110), inR = noise(0.9, N, 77);
    ArpFxSettings s;
    s.chorus = 2;
    s.delay = 1;
    s.reverb = 1;
    s.tape = 0;
    s.delaySeconds = 0.2;
    s.monoLowHz = 150;
    s.volume = 1;
    s.warmth = 1;
    s.bass = 1;
    s.air = 1;
    s.width = 1;
    s.phMix = 1;
    s.phRate = 1;
    s.phDepth = 1;
    s.phFb = 1;
    s.flMix = 1;
    s.flRate = 1;
    s.flDepth = 1;
    s.flFb = 1;
    s.pumpDepth = 1;
    s.pumpRate = 0;
    s.pumpShape = 1;
    s.crushBits = 1;
    s.crushRate = 1;
    s.dlyMode = 2;
    s.shimmer = 1;
    std::vector<FxEv> evs;
    for (int i = 0; i < 40; ++i) {
      ArpFxSettings e = s;
      e.dlyMode = i % 3;
      e.flFb = i % 2 ? -1 : 1;
      e.crushBits = (i % 4) / 3.0;
      e.crushRate = ((i + 2) % 5) / 4.0;
      e.phMix = i % 3 ? 1 : 0;
      e.flMix = i % 4 ? 1 : 0;
      e.shimmer = i % 5 ? 1 : 0;
      e.pumpDepth = i % 2 ? 1 : 0;
      e.pumpRate = i % 3;
      e.tape = i % 7 == 3 ? 0.8 : 0;
      e.phRate = (i % 6) / 5.0;
      e.flRate = ((i + 3) % 6) / 5.0;
      evs.push_back({0.3 + 0.13 * i, e});
    }
    const FxRun a = chain(inL, inR, s, evs, 128), b = chain(inL, inR, s, evs, 1), c = chain(inL, inR, s, evs, 1024), d = chain(inL, inR, s, evs, 331, true, false);
    // Le rack et la chaine du site, au bit pres d'une taille de bloc a l'autre : a l'arret (en marche, PUMP suit la
    // position que l'hote donne a chaque bloc, au dernier bit pres) et sans la section master d'avant (elle rince ses
    // etats sous 1e-20 a la fin de chaque bloc de l'hote : un ecart de cet ordre dans les silences)
    std::vector<FxEv> evs0 = evs;
    ArpFxSettings s0 = s;
    for (ArpFxSettings* e : {&s0}) e->warmth = 0, e->bass = e->air = e->width = 0.5;
    for (auto& e : evs0) e.second.warmth = 0, e.second.bass = e.second.air = e.second.width = 0.5;
    const FxRun a0 = chain(inL, inR, s0, evs0, 128, false), b0 = chain(inL, inR, s0, evs0, 1, false), c0 = chain(inL, inR, s0, evs0, 1024, false);
    double dblk = 0;
    for (size_t i = 0; i < N; ++i) dblk = std::max({dblk, std::fabs(static_cast<double>(a.L[i]) - b.L[i]), std::fabs(static_cast<double>(a.R[i]) - c.R[i])});
    check(finite(a.L) && finite(a.R) && finite(d.L) && peak(a.L) < 8 && peak(a.R) < 8 && same(a0.L, b0.L) && same(a0.R, b0.R) && same(a0.L, c0.L) && same(a0.R, c0.R) && dblk < 1e-5 && a.allocs == 0 && b.allocs == 0 && c.allocs == 0 && d.allocs == 0,
          "tout a fond (rack, chaine du site, master), 40 changements de reglages en 6 s : fini, cretes %.2f / %.2f, blocs de 1, 128, 1024 : memes echantillons (PUMP en marche : %.0e pres), %ld allocation (process, set, setTransport)", peak(a.L), peak(a.R), dblk, a.allocs + b.allocs + c.allocs + d.allocs);
    // d'autres frequences d'echantillonnage : prepare, tout a fond, fini
    int bad = 0;
    for (double sr : {44100.0, 96000.0, 192000.0}) {
      ArpFx fx;
      fx.prepare(sr, 512);
      fx.set(s, true);
      Buf oL(48000), oR(48000);
      const long a0 = gAllocs.load();
      for (size_t f = 0; f + 480 <= oL.size(); f += 480) {
        fx.setTransport(static_cast<double>(f) * 2 / sr, 2 / sr, true);
        fx.process(inL.data() + f, inR.data() + f, oL.data() + f, oR.data() + f, 480);
      }
      if (!finite(oL) || !finite(oR) || peak(oL) > 8 || gAllocs.load() != a0 || fx.flangerLatencySamples() != static_cast<int>(std::lround(0.0025 * sr))) bad += 1;
    }
    check(bad == 0, "a 44.1, 96 et 192 kHz : tout a fond, fini, aucune allocation, le retard du FLANGER a 2.5 ms (%d en defaut)", bad);
  }
}

/* ---------------- le cout ---------------- */
int cpu() {
  std::printf("Le cout (un coeur de cette machine ; blocs de 128 a 48 kHz : temps reel 2666.7 us)\n");
  std::printf("\nMoteur, 12 voix tenues, patch d'ouverture (deux scies, MOOG), une fonction a la fois : microsecondes par bloc et part d'un coeur\n");
  const KV base = with(initPatch(), {{"aS", 1}, {"noise", 0.2}});
  const struct {
    const char* name;
    KV more;
  } rows[] = {
      {"sans (le moteur du site)", {}},
      {"RING 1", {{"xRing", 1}}},
      {"FOLD 1", {{"xFold", 1}}},
      {"NOISE COLOR 0 (rouge)", {{"xNoiseCol", 0}}},
      {"HIGH PASS 500 Hz", {{"xHpf", 500}}},
      {"COMB 1, reinjection 0.8", {{"xComb", 1}, {"xCombFb", 0.8}}},
      {"STACK 3 (le site, pour comparer)", {{"stack", 16}}},
      {"UNISON 5", {{"stack", 16}, {"xUnison", 5}}},
      {"UNISON 7", {{"stack", 16}, {"xUnison", 7}}},
      {"UNISON 7 + WIDE 0.6", {{"stack", 16}, {"xUnison", 7}, {"wide", 0.6}}},
      {"tout : RING, FOLD, COLOR, HPF, COMB, UNISON 7, WIDE", {{"xRing", 1}, {"xFold", 1}, {"xNoiseCol", 0}, {"xHpf", 500}, {"xComb", 1}, {"xCombFb", 0.8}, {"stack", 16}, {"xUnison", 7}, {"wide", 0.6}}},
  };
  double ref[2] = {0, 0};
  for (const auto& row : rows) {
    double us[2] = {0, 0};
    for (int q = 0; q < 2; ++q) {
      double best = 1e30;
      for (int rep = 0; rep < 5; ++rep) {
        VoyagerOptions o;
        o.os = q == 0 ? 4 : 8;
        o.wideVoices = 12;
        Voyager v(o, with(base, row.more));
        for (int i = 0; i < 12; ++i) v.note(0, 42 + 3 * i, 100, 1, QNAN);
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
    std::printf("  %-52s x4 %7.1f us (%5.1f %%, %+6.1f)   x8 %7.1f us (%5.1f %%, %+6.1f)\n", row.name, us[0], us[0] / 26.667, (us[0] - ref[0]) / 26.667, us[1], us[1] / 26.667, (us[1] - ref[1]) / 26.667);
  }
  std::printf("\nRack (ArpFx), du bruit en entree, la chaine du site coupee (REVERB 0 sauf SHIMMER) ; pire bloc : le 99.9e centile\n");
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
        fx.setTransport(b * 128 * 2.0 / SR, 2.0 / SR, true);
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
  a.crushBits = 0.7;
  run("CRUSH (bits)", a);
  a = s;
  a.crushRate = 0.7;
  run("DOWNSAMPLE", a);
  a = s;
  a.phMix = 1;
  run("PHASER", a);
  a = s;
  a.flMix = 1;
  a.flFb = 0.6;
  run("FLANGER", a);
  a = s;
  a.pumpDepth = 1;
  run("PUMP", a);
  a = s;
  a.delay = 0.5;
  run("DELAY PING PONG (le site, pour comparer)", a);
  a.dlyMode = 1;
  run("DELAY STEREO", a);
  a.dlyMode = 2;
  run("DELAY WIDE", a);
  a = s;
  a.reverb = 1;
  run("REVERB 1 (le site, pour comparer)", a);
  a.shimmer = 1;
  run("REVERB 1 + SHIMMER 1", a);
  a = s;
  a.crushBits = 0.7;
  a.crushRate = 0.7;
  a.phMix = 1;
  a.flMix = 1;
  a.pumpDepth = 1;
  a.delay = 0.5;
  a.dlyMode = 2;
  a.reverb = 1;
  a.shimmer = 1;
  run("tout le rack + DELAY WIDE + REVERB", a);
  return 0;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc > 1 && std::strcmp(argv[1], "--cpu") == 0) return cpu();
  testEngineNeutral();
  testSlide();
  testOsc();
  testFilter();
  testEngineSafe();
  testSeq();
  testRackNeutral();
  testCrush();
  testPhaserFlanger();
  testPump();
  testDelayModes();
  testShimmer();
  testRackSafe();
  std::printf("\nhq2_test : %d controles, %d echecs\n", gChecks, gFails);
  return gFails ? 1 : 0;
}
#endif
