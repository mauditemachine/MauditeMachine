// Le banc des extensions du plugin MM-ARP (2026-11-10 : QUALITY x8, LFO 1 seconde destination, LFO 2, REVERB SIZE /
// TONE / PRE DELAY, section master). Sans reference JS (le site ne connait pas ces reglages), sans aucun son : des
// tableaux. La regle verifiee partout : chaque reglage neuf a son neutre rend la sortie d'avant AU BIT PRES.
//   g++ -O2 -std=c++17 -Wall -Wextra -ffp-contract=off -I plugin/mm-arp/dsp plugin/mm-arp/tests/hq_test.cpp
//       plugin/mm-arp/dsp/Voyager.cpp plugin/mm-arp/dsp/ArpFx.cpp -o hq_test      (une seule ligne)
//   ./hq_test            tous les controles et les mesures de repliement ; code de sortie 1 au premier echec
//   ./hq_test --cpu      le cout : le moteur x4 / x8 (1, 4, 12 voix), la reverb (2.4 s, 9.6 s), la section master
#include <algorithm>
#include <atomic>
#include <chrono>
#include <cmath>
#include <complex>
#include <cstdarg>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <memory>
#include <new>
#include <string>
#include <vector>

#include "../dsp/ArpFx.h"
#include "../dsp/Voyager.h"

/* ---- les allocations ET les liberations, comptees ensemble (le chemin temps reel n'en fait aucune), comme
 *      params_test ; noinline : sinon GCC, qui voit malloc et free a travers, croit a une paire depareillee ---- */
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

namespace mmarp {
namespace detail {
const double* voyagerTable(int which, int* n);
}
}  // namespace mmarp

namespace {

using mmarp::ArpFx;
using mmarp::ArpFxSettings;
using mmarp::ReverbIR;
using mmarp::Voyager;
using mmarp::VoyagerOptions;
using KV = std::vector<std::pair<std::string, double>>;
using Buf = std::vector<float>;

constexpr double SR = 48000;
constexpr double PI = 3.14159265358979323846;
int gFails = 0, gChecks = 0;

void check(bool ok, const char* fmt, ...) __attribute__((format(printf, 2, 3)));
void check(bool ok, const char* fmt, ...) {
  char msg[512];
  va_list ap;
  va_start(ap, fmt);
  std::vsnprintf(msg, sizeof msg, fmt, ap);
  va_end(ap);
  gChecks += 1;
  if (!ok) gFails += 1;
  std::printf("  %s %s\n", ok ? "ok   " : "ECHEC", msg);
}

double db(double x) { return 20 * std::log10(std::max(x, 1e-300)); }

/* ---------------- FFT et fenetre (double) ---------------- */
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
/** Le spectre d'amplitude (fenetre de Kaiser beta 30 : lobes secondaires sous -250 dB, lobe principal +/-10 cases). */
std::vector<double> spectrum(const float* x, size_t n) {
  std::vector<std::complex<double>> a(n);
  const double i0b = besselI0(30);
  double wsum = 0;
  for (size_t i = 0; i < n; ++i) {
    const double r = (2.0 * static_cast<double>(i) - static_cast<double>(n - 1)) / static_cast<double>(n - 1);
    const double w = besselI0(30 * std::sqrt(std::max(0.0, 1 - r * r))) / i0b;
    a[i] = x[i] * w;
    wsum += w;
  }
  fft(a);
  std::vector<double> m(n / 2);
  for (size_t i = 0; i < n / 2; ++i) m[i] = 2 * std::abs(a[i]) / wsum;
  return m;
}

/**
 * Un signal periodique de fondamentale f0 : tout ce qui n'est pas sur un harmonique est du repliement. Rend la raie
 * la plus forte hors harmoniques entre lo et hi (en dBc : sous l'harmonique le plus fort) et sa frequence.
 */
struct Alias {
  double dbc, hz, fundDb;
};
Alias aliasOf(const float* x, size_t n, double f0, double sr, double lo, double hi) {
  const std::vector<double> m = spectrum(x, n);
  const double binHz = sr / static_cast<double>(n);
  const int guard = 14;
  std::vector<char> harm(m.size(), 0);
  double fund = 0;
  for (int k = 1; k * f0 < sr / 2 + f0; ++k) {
    const long c = std::lround(k * f0 / binHz);
    for (long b = c - guard; b <= c + guard; ++b)
      if (b >= 0 && b < static_cast<long>(m.size())) {
        harm[static_cast<size_t>(b)] = 1;
        fund = std::max(fund, m[static_cast<size_t>(b)]);
      }
  }
  double worst = 0, at = 0;
  for (size_t b = static_cast<size_t>(lo / binHz); b < m.size() && b * binHz <= hi; ++b)
    if (!harm[b] && m[b] > worst) {
      worst = m[b];
      at = static_cast<double>(b) * binHz;
    }
  return {db(worst / fund), at, db(fund)};
}

/* ---------------- le moteur ---------------- */
KV initPatch() {
  return {{"wave1", 2}, {"wave2", 2}, {"tune1", 0}, {"tune2", -12}, {"fine1", -8}, {"fine2", 8}, {"osc1", 0.62}, {"osc2", 0.62},
          {"sub", 0}, {"fm", 0}, {"ratio", 1}, {"glide", 0}, {"cutoff", 753.2}, {"res", 0.35}, {"envOct", 3}, {"noise", 0},
          {"fmode", 0}, {"fA", 0.001}, {"fD", 0.3}, {"fS", 0.2}, {"fR", 0.2}, {"aA", 0.001}, {"aD", 0.3}, {"aS", 0.6},
          {"aR", 0.2}, {"drive", 0}, {"lfoBeats", 4}, {"lfoShape", 0}, {"lfoDest", 0}, {"lfoAmt", 0}, {"phase", -1},
          {"drift", 1}, {"width", 0.22}, {"keyTrack", 0.5}, {"sync", 0}, {"accFlt", 0.5}, {"stack", 0}, {"wide", 0},
          {"glue", 0.35}, {"load", 0}, {"space", 0}, {"fpol", 0}, {"bpm", 130}, {"outLevel", 0.306}};
}
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
struct Ev {
  double t;
  KV params;
  int setOs;
};
struct Note {
  double t, midi, gate, accent;
};
/** Une suite d'arpege (16 notes par 2 temps a 130), comme les cas de voyager_cases.json. */
std::vector<Note> arpNotes(double seconds) {
  std::vector<Note> n;
  const int m[8] = {54, 57, 61, 64, 66, 69, 73, 76};
  const double step = 60.0 / 130 / 4;
  int i = 0;
  for (double t = 0.05; t < seconds; t += step, ++i) n.push_back({t, static_cast<double>(m[i % 8]), step * 0.54, 0.8 + 0.05 * (i % 7)});
  return n;
}
struct Render {
  Buf L, R;
  int heals = 0;
  long allocs = 0;
};
Render render(int os, const KV& patch, const std::vector<Note>& notes, const std::vector<Ev>& evs, double seconds, int block = 128, uint32_t seed = 808) {
  VoyagerOptions o;
  o.sampleRate = SR;
  o.os = os;
  o.seed = seed;
  Voyager v(o, patch);
  for (const auto& n : notes) v.note(n.t, n.midi, n.gate, n.accent, NAN);
  v.beat(0, 0, 130, true);
  const long frames = static_cast<long>(seconds * SR) / block * block;
  Render r;
  r.L.assign(static_cast<size_t>(frames), 0.f);
  r.R.assign(static_cast<size_t>(frames), 0.f);
  // les messages 'params' par ids, prepares d'avance (le chemin temps reel du plugin)
  std::vector<std::vector<mmarp::ParamKV>> ids(evs.size());
  for (size_t e = 0; e < evs.size(); ++e)
    for (const auto& kv : evs[e].params) ids[e].push_back({Voyager::paramIndex(kv.first), kv.second});
  size_t ei = 0;
  const long a0 = gAllocs.load();
  for (long f = 0; f < frames; f += block) {
    while (ei < evs.size() && evs[ei].t * SR <= static_cast<double>(f)) {
      if (!ids[ei].empty()) v.params(ids[ei].data(), static_cast<int>(ids[ei].size()));
      if (evs[ei].setOs) v.setOs(evs[ei].setOs);
      ei += 1;
    }
    v.process(r.L.data() + f, r.R.data() + f, block);
  }
  r.allocs = gAllocs.load() - a0;
  r.heals = v.heals();
  return r;
}
bool same(const Buf& a, const Buf& b) { return a.size() == b.size() && std::memcmp(a.data(), b.data(), a.size() * 4) == 0; }
bool finite(const Buf& a) {
  for (float x : a)
    if (!std::isfinite(x)) return false;
  return true;
}
double rmsDb(const Buf& a, size_t from = 0, size_t to = 0) {
  if (to == 0 || to > a.size()) to = a.size();
  double e = 0;
  for (size_t i = from; i < to; ++i) e += static_cast<double>(a[i]) * a[i];
  return 10 * std::log10(std::max(1e-300, e / static_cast<double>(std::max<size_t>(1, to - from))));
}
double diffDb(const Buf& a, const Buf& b) {
  double d = 0, p = 0;
  for (size_t i = 0; i < a.size() && i < b.size(); ++i) {
    d = std::max(d, std::fabs(static_cast<double>(a[i]) - b[i]));
    p = std::max(p, std::fabs(static_cast<double>(a[i])));
  }
  return d == 0 ? -999 : db(d / std::max(p, 1e-30));
}

/* ---------------- 1. neutralite du moteur ---------------- */
void testEngineNeutral() {
  std::printf("\n1. Moteur : chaque cle neuve a son neutre = le moteur du site, au bit pres\n");
  const std::vector<Note> notes = arpNotes(3.0);
  struct Sc {
    const char* name;
    int os;
    KV patch;
  };
  const std::vector<Sc> scs = {
      {"INIT x4", 4, initPatch()},
      {"S&H CUTOFF + STACK + WIDE + GLUE x4", 4, with(initPatch(), {{"lfoShape", 3}, {"lfoDest", 1}, {"lfoAmt", 0.7}, {"lfoBeats", 0.5}, {"stack", 16}, {"wide", 0.6}, {"glue", 0.5}})},
      {"RND FM + OVERDRIVE + MS-10 x2", 2, with(initPatch(), {{"lfoShape", 4}, {"lfoDest", 2}, {"lfoAmt", 0.5}, {"fm", 0.4}, {"drive", 0.6}, {"fmode", 4}, {"res", 0.8}})},
      {"NOISE + SUB + LOAD + SPACE x1", 1, with(initPatch(), {{"noise", 0.4}, {"sub", 0.5}, {"load", 0.6}, {"space", 0.5}, {"wide", 0.3}})},
  };
  for (const auto& sc : scs) {
    const Render ref = render(sc.os, sc.patch, notes, {{1.0, {{"cutoff", 1500}, {"res", 0.5}}, 0}}, 3.0);
    // a. les cles neuves a leur neutre explicitement (des le constructeur), et les quantites non nulles tant que la
    //    destination est OFF ; des messages en cours de route
    const KV off = {{"xl1Dest", 0}, {"xl1Amt", 0.8}, {"l2Beats", 0.5}, {"l2Shape", 5}, {"l2Dest", 0}, {"l2Amt", 0.9}};
    const Render a = render(sc.os, with(sc.patch, off), notes,
                            {{0.5, {{"xl1Amt", 0.3}, {"l2Shape", 6}, {"l2Amt", 0.2}}, 0}, {1.0, {{"cutoff", 1500}, {"res", 0.5}}, 0}, {1.5, {{"l2Beats", 2}, {"xl1Dest", 0}, {"l2Dest", 0}}, 0}}, 3.0);
    check(same(ref.L, a.L) && same(ref.R, a.R), "%-38s destinations OFF (quantites non nulles, S&H) : %s", sc.name, same(ref.L, a.L) && same(ref.R, a.R) ? "bit a bit" : "DIFFERENT");
    // b. chaque destination, quantite 0 : le son d'origine
    int bad = 0;
    for (int d = 1; d <= 10; ++d) {
      const Render b = render(sc.os, with(sc.patch, {{"xl1Dest", static_cast<double>(d)}, {"xl1Amt", 0}}), notes, {{1.0, {{"cutoff", 1500}, {"res", 0.5}}, 0}}, 3.0);
      if (!(same(ref.L, b.L) && same(ref.R, b.R))) {
        bad += 1;
        std::printf("        LFO 1 destination %d a quantite 0 : %.1f dB d'ecart\n", d, diffDb(ref.L, b.L));
      }
    }
    for (int d = 1; d <= 14; ++d) {
      const Render b = render(sc.os, with(sc.patch, {{"l2Dest", static_cast<double>(d)}, {"l2Amt", 0}, {"l2Shape", static_cast<double>(d % 7)}, {"l2Beats", 0.25}}), notes, {{1.0, {{"cutoff", 1500}, {"res", 0.5}}, 0}}, 3.0);
      if (!(same(ref.L, b.L) && same(ref.R, b.R))) {
        bad += 1;
        std::printf("        LFO 2 destination %d a quantite 0 : %.1f dB d'ecart\n", d, diffDb(ref.L, b.L));
      }
    }
    check(bad == 0, "%-38s 10 + 14 destinations a quantite 0 : %d differentes du son d'origine", sc.name, bad);
    check(ref.allocs == 0 && a.allocs == 0, "%-38s aucune allocation (process, params par ids) : %ld", sc.name, ref.allocs + a.allocs);
  }
  // c. les cles sont connues, leurs defauts sont neutres
  const char* keys[6] = {"xl1Dest", "xl1Amt", "l2Beats", "l2Shape", "l2Dest", "l2Amt"};
  bool known = true;
  VoyagerOptions o;
  Voyager v(o);
  for (const char* k : keys) known = known && Voyager::paramIndex(k) >= 0;
  check(known, "Voyager::paramIndex connait xl1Dest, xl1Amt, l2Beats, l2Shape, l2Dest, l2Amt (%d cles en tout)", Voyager::paramCount());
  check(v.param(Voyager::paramIndex("xl1Dest")) == 0 && v.param(Voyager::paramIndex("l2Dest")) == 0 && v.param(Voyager::paramIndex("xl1Amt")) == 0 && v.param(Voyager::paramIndex("l2Amt")) == 0,
        "defauts : destinations OFF, quantites 0 (l2Beats %.3g, l2Shape %.0f)", v.param(Voyager::paramIndex("l2Beats")), v.param(Voyager::paramIndex("l2Shape")));
}

/* ---------------- 2. QUALITY x8 ---------------- */
/** Une note tenue, stable (DRIFT 0, phase fixe), analysee sur 2^17 echantillons apres 1.5 s. */
Alias heldAlias(int os, const KV& patch, double midi, double lo, double hi, double* levelDb = nullptr) {
  const size_t N = 1 << 17;
  const double secs = 1.5 + static_cast<double>(N) / SR + 0.1;
  const Render r = render(os, patch, {{0.01, midi, 100, 1}}, {}, secs);
  const size_t from = static_cast<size_t>(1.5 * SR);
  if (levelDb) *levelDb = rmsDb(r.L, from, from + N);
  const double f0 = 440 * std::pow(2.0, (midi - 69) / 12);
  return aliasOf(r.L.data() + from, N, f0, SR, lo, hi);
}
void testHq() {
  std::printf("\n2. QUALITY HQ : x8\n");
  // la demi-bande x8 -> x4 : son attenuation (la table du moteur), contre celles du site
  for (int which : {4, 3, 6}) {
    int n = 0;
    const double* h = mmarp::detail::voyagerTable(which, &n);
    // la reponse sur une grille fine : le pire de la bande d'arret, le debut de la bande d'arret a -90 dB
    double worst = 0, edge = 0.5, pass = 0;
    const int G = 8192;
    std::vector<double> mag(G + 1);
    for (int g = 0; g <= G; ++g) {
      const double w = PI * g / G;  // 0 .. le Nyquist du taux d'entree
      std::complex<double> s(0, 0);
      for (int k = 0; k < n; ++k) s += h[k] * std::polar(1.0, -w * k);
      mag[static_cast<size_t>(g)] = std::abs(s);
    }
    // la bande d'arret utile : ce qui se replie sur 0 .. 24 kHz ; l'entree est a 96 (63), 192 (31), 384 kHz (23)
    const double fsIn = which == 4 ? 96000 : which == 3 ? 192000 : 384000;
    const double stopFrom = (fsIn / 2 - 24000) / (fsIn / 2);
    for (int g = 0; g <= G; ++g) {
      const double x = static_cast<double>(g) / G;
      if (x >= stopFrom) worst = std::max(worst, mag[static_cast<size_t>(g)]);
      if (x <= 20000 / (fsIn / 2)) pass = std::max(pass, std::fabs(db(mag[static_cast<size_t>(g)])));
    }
    for (int g = G; g >= 0; --g)
      if (mag[static_cast<size_t>(g)] > std::pow(10.0, -90.0 / 20)) {
        edge = static_cast<double>(g) / G;
        break;
      }
    const bool mine = which == 6;
    const char* name = which == 4 ? "x2 -> x1 (site, 63 / beta 8)" : which == 3 ? "x4 -> x2 (site, 31 / beta 9)" : "x8 -> x4 (plugin, 23 / beta 10)";
    if (mine) check(db(worst) <= -95 && pass < 0.01, "demi-bande %-32s arret (ce qui se replie sous 24 kHz) %.1f dB, -90 dB des %.0f kHz, ondulation 0-20 kHz %.5f dB", name, db(worst), edge * fsIn / 2000, pass);
    else std::printf("        demi-bande %-32s arret (ce qui se replie sous 24 kHz) %.1f dB, ondulation 0-20 kHz %.4f dB\n", name, db(worst), pass);
  }
  // fini, meme sonie que x4, sans garde
  const std::vector<Note> notes = arpNotes(4.0);
  for (const auto& sc : std::vector<std::pair<const char*, KV>>{
           {"INIT", initPatch()},
           {"STACK + WIDE + GLUE", with(initPatch(), {{"stack", 16}, {"wide", 0.6}, {"glue", 0.5}})},
           {"MS-10 + RES 0.9 + OVERDRIVE", with(initPatch(), {{"fmode", 4}, {"res", 0.9}, {"drive", 0.5}})},
           {"LP12 + LOAD + SPACE + FM", with(initPatch(), {{"fmode", 1}, {"load", 0.6}, {"space", 0.5}, {"wide", 0.3}, {"fm", 0.4}})}}) {
    const Render r4 = render(4, sc.second, notes, {}, 4.0);
    const Render r8 = render(8, sc.second, notes, {}, 4.0);
    const double d = 10 * std::log10((std::pow(10, rmsDb(r8.L) / 10) + std::pow(10, rmsDb(r8.R) / 10)) / (std::pow(10, rmsDb(r4.L) / 10) + std::pow(10, rmsDb(r4.R) / 10)));
    check(finite(r8.L) && finite(r8.R) && r8.heals == 0 && std::fabs(d) <= 0.2 && r8.allocs == 0, "%-30s x8 : fini, heals %d, sonie %+.3f dB contre x4, %ld allocation", sc.first, r8.heals, d, r8.allocs);
  }
  {
    VoyagerOptions o;
    o.os = 8;
    Voyager v(o);
    check(v.latencySamples() == 21 && v.os() == 8, "latencySamples() en x8 : %d (x4 : 19)", v.latencySamples());
  }
  // le repliement : la raie la plus forte hors harmoniques (dBc), x4 contre x8
  std::printf("   repliement : la plus forte raie hors harmoniques, 20 Hz - 20 kHz (et 20 Hz - 16 kHz), en dBc\n");
  const KV clean = with(initPatch(), {{"osc2", 0}, {"fine1", 0}, {"drift", 0}, {"phase", 0}, {"width", 0}, {"glue", 0}, {"aS", 1}, {"fS", 1}, {"envOct", 0}, {"keyTrack", 0}, {"accFlt", 0}, {"outLevel", 0}, {"cutoff", 28000}, {"res", 0}});
  struct Case {
    const char* name;
    KV patch;
    double midi;
    double needGain;  // x8 doit etre plus bas d'au moins tant de dB (20 Hz - 16 kHz)
  };
  const std::vector<Case> cases = {
      {"scie C7 (2093 Hz), filtre ouvert", clean, 96, 0},
      {"scie C7, OVERDRIVE 1", with(clean, {{"drive", 1}}), 96, 3},
      {"scie C5 (523 Hz), OVERDRIVE 1", with(clean, {{"drive", 1}}), 72, 3},
      {"scie A2 (110 Hz), RES 0.88 a 5 kHz", with(clean, {{"cutoff", 5000}, {"res", 0.88}}), 45, 0},
      {"scie A3, MS-10 RES 0.95 a 4 kHz + OVERDRIVE 0.6", with(clean, {{"fmode", 4}, {"cutoff", 4000}, {"res", 0.95}, {"drive", 0.6}}), 57, 3},
      {"carre C6 + SYNC (OSC 2 +19) + LOAD 0.8", with(clean, {{"wave1", 3}, {"wave2", 2}, {"osc2", 0.62}, {"tune2", 19}, {"fine2", 0}, {"sync", 1}, {"load", 0.8}}), 84, 0},
  };
  for (const auto& c : cases) {
    double l4 = 0, l8 = 0;
    const Alias a4 = heldAlias(4, c.patch, c.midi, 20, 20000, &l4), a8 = heldAlias(8, c.patch, c.midi, 20, 20000, &l8);
    const Alias b4 = heldAlias(4, c.patch, c.midi, 20, 16000), b8 = heldAlias(8, c.patch, c.midi, 20, 16000);
    check(b8.dbc <= b4.dbc - c.needGain + 0.5 && a8.dbc <= a4.dbc + 0.5 && std::fabs(l8 - l4) < 0.3,
          "%-46s x4 %7.1f (%5.0f Hz) x8 %7.1f (%5.0f Hz) | <16k : x4 %7.1f x8 %7.1f | niveau %+.2f dB", c.name, a4.dbc, a4.hz, a8.dbc, a8.hz, b4.dbc, b8.dbc, l8 - l4);
  }
}

/* ---------------- 3. les destinations des LFO ---------------- */
struct Track {
  std::vector<double> level, centroid, balance, pitch;
};
/** Par fenetre de 1024 : le niveau (dB), le centroide (Hz), la balance (-1 gauche .. +1 droite), la hauteur (Hz). */
Track track(const Render& r, double fromS, double toS) {
  Track t;
  const size_t W = 1024;
  for (size_t s = static_cast<size_t>(fromS * SR); s + W <= static_cast<size_t>(toS * SR) && s + W <= r.L.size(); s += W) {
    double eL = 0, eR = 0;
    std::vector<std::complex<double>> a(W);
    int zc = 0;
    double firstZ = -1, lastZ = -1;
    for (size_t i = 0; i < W; ++i) {
      const double l = r.L[s + i], rr = r.R[s + i], m = 0.5 * (l + rr);
      eL += l * l;
      eR += rr * rr;
      a[i] = m * (0.5 - 0.5 * std::cos(2 * PI * static_cast<double>(i) / W));
      if (i > 0) {
        const double p = 0.5 * (static_cast<double>(r.L[s + i - 1]) + r.R[s + i - 1]);
        if (p < 0 && m >= 0) {
          const double z = static_cast<double>(i) - m / (m - p);
          if (firstZ < 0) firstZ = z;
          else zc += 1;
          lastZ = z;
        }
      }
    }
    fft(a);
    double num = 0, den = 0;
    for (size_t k = 1; k < W / 2; ++k) {
      const double p = std::norm(a[k]);
      num += p * static_cast<double>(k) * SR / W;
      den += p;
    }
    t.level.push_back(10 * std::log10(std::max(1e-20, (eL + eR) / (2.0 * W))));
    t.centroid.push_back(den > 0 ? num / den : 0);
    t.balance.push_back(eL + eR > 1e-12 ? (eR - eL) / (eL + eR) : 0);
    t.pitch.push_back(zc > 0 ? zc * SR / (lastZ - firstZ) : 0);
  }
  return t;
}
double swing(const std::vector<double>& v) {
  if (v.empty()) return 0;
  return *std::max_element(v.begin(), v.end()) - *std::min_element(v.begin(), v.end());
}
double ratio(const std::vector<double>& v) {
  double lo = 1e30, hi = 0;
  for (double x : v)
    if (x > 0) {
      lo = std::min(lo, x);
      hi = std::max(hi, x);
    }
  return hi > 0 ? hi / lo : 1;
}
/** La profondeur du battement (dB) de l'enveloppe sur une plage : STACK. */
double beat(const Render& r, double fromS, double toS) {
  std::vector<double> e;
  for (size_t s = static_cast<size_t>(fromS * SR); s + 256 <= static_cast<size_t>(toS * SR); s += 256) e.push_back(rmsDb(r.L, s, s + 256));
  return swing(e);
}
void testLfo() {
  std::printf("\n3. Les destinations des LFO : chacune module ce qu'elle dit (note tenue, 3 s ; quantite 1 contre quantite 0)\n");
  // une note tenue stable : sinus, filtre ouvert, ni DRIFT ni GLUE ; le cycle dure 1 temps a 130 (0.46 s)
  const KV base = with(initPatch(), {{"wave1", 0}, {"wave2", 0}, {"osc2", 0}, {"fine1", 0}, {"fine2", 0}, {"drift", 0}, {"phase", 0}, {"width", 0}, {"glue", 0}, {"aS", 1}, {"fS", 0.5}, {"envOct", 0},
                                      {"keyTrack", 0}, {"accFlt", 0}, {"outLevel", 0}, {"cutoff", 20000}, {"res", 0}});
  enum M { LEVEL, CENTROID, BALANCE, PITCH, BEAT };
  struct Row {
    const char* name;
    int ext;  // la destination etendue 1..10 (essayee par le LFO 1 et par le LFO 2), ou 0 : l2Dest seul
    int l2;   // l2Dest quand ext = 0
    KV patch;
    M metric;
    double need;  // l'excursion minimale a quantite 1
    double quiet; // l'excursion maximale a quantite 0
    const char* unit;
  };
  const KV saw = {{"wave1", 2}, {"cutoff", 1200}};
  const std::vector<Row> rows = {
      {"RES (scie, coupure 1.2 kHz, RES 0.6 : +/-0.35)", 1, 0, with(saw, {{"res", 0.6}}), CENTROID, 150, 5, "Hz de centroide"},
      {"AMP (tremolo jusqu'a -100 %)", 2, 0, {}, LEVEL, 30, 0.1, "dB de niveau"},
      {"PAN (plein gauche / plein droite)", 3, 0, {}, BALANCE, 1.9, 0.001, "de balance (2 = tout)"},
      {"OSC 2 PITCH (+/-12 demi-tons)", 4, 0, {{"osc1", 0}, {"osc2", 0.62}, {"tune2", 0}}, PITCH, 3.2, 1.001, "x en hauteur (4 = 2 octaves)"},
      {"OSC MIX (OSC 1 la note, OSC 2 une octave au-dessus)", 5, 0, {{"osc2", 0.62}, {"tune2", 12}}, PITCH, 1.9, 1.05, "x en hauteur (2 = d'un oscillateur a l'autre)"},
      {"NOISE (potard a 0)", 6, 0, {}, CENTROID, 2000, 5, "Hz de centroide"},
      {"SUB (potard a 0, oscillateurs coupes)", 7, 0, {{"osc1", 0}}, LEVEL, 40, 0.1, "dB de niveau"},
      {"DRIVE (scie, OVERDRIVE 0.5 : +/-0.5)", 8, 0, with(saw, {{"drive", 0.5}, {"cutoff", 6000}}), CENTROID, 150, 5, "Hz de centroide"},
      {"STACK (15 cents : 0 a 30), carre du LFO", 9, 0, {{"stack", 15}}, BEAT, 3, 0.5, "dB de battement (LFO haut - LFO bas)"},
      {"ENV AMT (scie, coupure 300 Hz, ENV 3 : +/-3 octaves)", 10, 0, with(saw, {{"cutoff", 300}, {"envOct", 3}, {"fS", 0.5}}), CENTROID, 300, 5, "Hz de centroide"},
      {"LFO 2 WAVE", 0, 1, {{"wave1", 2}}, CENTROID, 300, 5, "Hz de centroide"},
      {"LFO 2 CUTOFF (scie, 1.2 kHz : +/-3 octaves)", 0, 2, saw, CENTROID, 1000, 5, "Hz de centroide"},
      {"LFO 2 FM (FM 0.4 : +/-0.6)", 0, 3, {{"fm", 0.4}, {"ratio", 2}}, CENTROID, 150, 5, "Hz de centroide"},
      {"LFO 2 PITCH (+/-100 cents)", 0, 4, {}, PITCH, 1.1, 1.001, "x en hauteur (1.12 = 2 demi-tons)"},
  };
  const std::vector<Note> held = {{0.01, 69, 100, 1}};
  auto measure = [&](const Render& r, M m) {
    if (m == BEAT) {
      // carre : la moitie haute du cycle (LFO a +1 : 30 cents) contre la moitie basse (0 cent : plus de battement).
      // Le cycle de 4 temps a 130 dure 1.846 s : haut de 0 a 0.923 s, bas de 0.923 a 1.846 s, haut ensuite.
      return beat(r, 2.0, 2.7) - beat(r, 1.1, 1.75);
    }
    const Track t = track(r, 0.6, 2.9);
    return m == LEVEL ? swing(t.level) : m == CENTROID ? swing(t.centroid) : m == BALANCE ? swing(t.balance) : ratio(t.pitch);
  };
  for (const auto& row : rows) {
    const KV patch = with(base, row.patch);
    const bool isBeat = row.metric == BEAT;
    const Render ref = render(4, patch, held, {}, 3.0);
    const double v0 = measure(ref, row.metric);
    // le LFO 2 (sinus, ou carre pour STACK)
    const double d2 = row.ext ? row.ext + 4 : row.l2;
    const KV l2 = {{"l2Dest", d2}, {"l2Shape", isBeat ? 4.0 : 0.0}, {"l2Beats", isBeat ? 4.0 : 1.0}};
    const Render r2 = render(4, with(patch, with(l2, {{"l2Amt", 1}})), held, {}, 3.0);
    const Render z2 = render(4, with(patch, with(l2, {{"l2Amt", 0}})), held, {}, 3.0);
    const double v2 = measure(r2, row.metric);
    const bool ok2 = v2 >= row.need && v0 <= row.quiet && same(ref.L, z2.L) && same(ref.R, z2.R) && finite(r2.L) && r2.heals == 0;
    check(ok2, "LFO 2 -> %-52s %8.3f %s (quantite 0 : %.3f, bit a bit %s)", row.name, v2, row.unit, v0, same(ref.L, z2.L) ? "oui" : "NON");
    if (row.ext == 0) continue;
    // le LFO 1, seconde destination (son triangle, ou son carre pour STACK ; sa destination du site sans effet : DEPTH 0)
    const KV l1 = {{"xl1Dest", static_cast<double>(row.ext)}, {"lfoShape", isBeat ? 2.0 : 0.0}, {"lfoBeats", isBeat ? 4.0 : 1.0}, {"lfoAmt", 0}};
    const Render refL = render(4, with(patch, {{"lfoShape", isBeat ? 2.0 : 0.0}, {"lfoBeats", isBeat ? 4.0 : 1.0}}), held, {}, 3.0);
    const Render r1 = render(4, with(patch, with(l1, {{"xl1Amt", 1}})), held, {}, 3.0);
    const Render z1 = render(4, with(patch, with(l1, {{"xl1Amt", 0}})), held, {}, 3.0);
    const double v1 = measure(r1, row.metric);
    const bool ok1 = v1 >= row.need && same(refL.L, z1.L) && same(refL.R, z1.R) && finite(r1.L) && r1.heals == 0;
    check(ok1, "LFO 1 -> %-52s %8.3f %s (quantite 0 : bit a bit %s)", row.name, v1, row.unit, same(refL.L, z1.L) ? "oui" : "NON");
  }
  // les deux LFO sur la meme destination s'additionnent : AMP a 0.5 + 0.5 (meme forme, meme duree) = un seul a 1
  {
    const Render one = render(4, with(base, {{"l2Dest", 6}, {"l2Shape", 1}, {"l2Beats", 1}, {"l2Amt", 1}}), held, {}, 3.0);
    const Render two = render(4, with(base, {{"l2Dest", 6}, {"l2Shape", 1}, {"l2Beats", 1}, {"l2Amt", 0.5}, {"xl1Dest", 2}, {"xl1Amt", 0.5}, {"lfoShape", 0}, {"lfoBeats", 1}}), held, {}, 3.0);
    const Track a = track(one, 0.6, 2.9), b = track(two, 0.6, 2.9);
    double worst = 0;
    for (size_t i = 0; i < a.level.size(); ++i)
      if (a.level[i] > -40) worst = std::max(worst, std::fabs(a.level[i] - b.level[i]));
    check(worst < 0.5 && swing(b.level) > 30, "LFO 1 (0.5) + LFO 2 (0.5) sur AMP = un seul a 1 : %.3f dB d'ecart d'enveloppe au plus", worst);
  }
  // le LFO 2 : ses 7 formes, calees sur la position (la meme sortie quel que soit le decoupage en blocs), finies,
  // son hasard sans effet sur celui du moteur (S&H du LFO 1 + DRIFT : le reste du son ne bouge pas)
  {
    const KV p = with(base, {{"l2Dest", 7}, {"l2Amt", 1}, {"l2Beats", 0.5}});
    int bad = 0;
    for (int sh = 0; sh < 7; ++sh) {
      const Render a = render(4, with(p, {{"l2Shape", static_cast<double>(sh)}}), held, {}, 2.0, 128);
      const Render b = render(4, with(p, {{"l2Shape", static_cast<double>(sh)}}), held, {}, 2.0, 32);
      const Track t = track(a, 0.6, 1.9);
      if (!finite(a.L) || swing(t.balance) < 0.5 || diffDb(a.L, b.L) > -100) bad += 1;
    }
    check(bad == 0, "LFO 2 : SINE, TRI, SAW, RAMP, SQR, S&H, RND modulent (PAN), finis, les memes par blocs de 32 ou de 128 : %d en defaut", bad);
    // la panoramique du LFO 2 en S&H ne change que la balance : la somme des puissances G + D reste celle du son seul
    // quand le hasard du moteur (DRIFT, S&H du LFO 1 sur la coupure) est le meme
    const KV q = with(initPatch(), {{"lfoShape", 3}, {"lfoDest", 1}, {"lfoAmt", 0.6}, {"lfoBeats", 0.5}, {"width", 0}, {"glue", 0}, {"outLevel", 0}});
    const std::vector<Note> notes = arpNotes(3.0);
    const Render a = render(4, q, notes, {}, 3.0);
    const Render b = render(4, with(q, {{"l2Dest", 7}, {"l2Shape", 5}, {"l2Amt", 1}, {"l2Beats", 0.25}}), notes, {}, 3.0);
    double worst = 0;
    for (size_t s = 4800; s + 4800 <= a.L.size(); s += 4800) {
      const double pa = std::pow(10, rmsDb(a.L, s, s + 4800) / 10) + std::pow(10, rmsDb(a.R, s, s + 4800) / 10);
      const double pb = std::pow(10, rmsDb(b.L, s, s + 4800) / 10) + std::pow(10, rmsDb(b.R, s, s + 4800) / 10);
      if (pa > 1e-8) worst = std::max(worst, std::fabs(10 * std::log10(pb / pa)));
    }
    check(worst < 0.05 && !same(a.L, b.L), "le hasard du LFO 2 (S&H sur PAN) ne consomme pas celui du moteur : puissance G + D a %.4f dB de celle du son seul", worst);
  }
  // une destination changee en cours de note : aucun saut (la quantite repasse par 0)
  {
    const KV p = with(base, {{"l2Dest", 6}, {"l2Amt", 1}, {"l2Shape", 4}, {"l2Beats", 8}});  // AMP, carre lent : LFO haut pendant 1.8 s
    const Render a = render(4, p, held, {{1.0, {{"l2Dest", 7}}, 0}, {1.5, {{"l2Dest", 0}}, 0}, {2.0, {{"xl1Dest", 3}, {"xl1Amt", 1}, {"lfoShape", 2}}, 0}}, 3.0);
    double jump = 0, norm = 0;
    for (size_t i = static_cast<size_t>(0.5 * SR); i + 1 < a.L.size(); ++i) {
      const double d = std::fabs(static_cast<double>(a.L[i + 1]) - a.L[i]);
      if (i < static_cast<size_t>(0.9 * SR)) norm = std::max(norm, d);
      else jump = std::max(jump, d);
    }
    check(jump <= norm * 1.6 && finite(a.L), "destination changee en cours de note (AMP -> PAN -> OFF, LFO 1 -> PAN) : pas le plus grand %.5f contre %.5f avant", jump, norm);
  }
}

/* ---------------- 4. setOs en cours de jeu ---------------- */
void testSetOs() {
  std::printf("\n4. setOs en cours de jeu (thread audio)\n");
  const KV patch = with(initPatch(), {{"stack", 12}, {"wide", 0.5}});
  const std::vector<Note> notes = arpNotes(4.0);
  const Render ref = render(4, patch, notes, {}, 4.0);
  for (int block : {128, 32, 1024}) {
    const Render r = render(4, patch, notes, {{1.0, {}, 8}, {2.5, {}, 4}, {3.0, {}, 8}, {3.02, {}, 4}}, 4.0, block);
    // le plus grand pas d'un echantillon au suivant, contre celui du jeu normal
    double jump = 0, norm = 0;
    for (size_t i = 0; i + 1 < r.L.size(); ++i) {
      jump = std::max(jump, std::fabs(static_cast<double>(r.L[i + 1]) - r.L[i]));
      norm = std::max(norm, std::fabs(static_cast<double>(ref.L[i + 1]) - ref.L[i]));
    }
    // le son reprend : la sonie de 1.5 a 2.4 s (en x8) contre le jeu en x4
    const double d = rmsDb(r.L, static_cast<size_t>(1.5 * SR), static_cast<size_t>(2.4 * SR)) - rmsDb(ref.L, static_cast<size_t>(1.5 * SR), static_cast<size_t>(2.4 * SR));
    check(finite(r.L) && finite(r.R) && r.heals == 0 && r.allocs == 0 && jump <= 1.25 * norm && std::fabs(d) < 1.0,
          "blocs de %4d : fini, heals %d, %ld allocation, pas le plus grand %.4f (jeu normal %.4f), sonie en x8 %+.2f dB", block, r.heals, r.allocs, jump, norm, d);
  }
  // le deroule : le silence, le changement, la latence, une note tenue qui repart, la file gardee
  {
    VoyagerOptions o;
    Voyager v(o, patch);
    v.note(0.01, 57, INFINITY, 1, NAN);  // une note tenue (le clavier)
    v.note(0.52, 64, 0.02, 1, NAN);      // une note courte dont l'heure tombe pendant le silence : retiree
    v.note(0.53, 69, 5.0, 1, NAN);       // une note longue dont l'heure tombe pendant le silence : elle part au changement
    v.note(1.5, 61, 0.2, 1, NAN);        // une note a venir : a son heure
    float L[128], R[128];
    long a0 = gAllocs.load();
    for (int b = 0; b < 187; ++b) v.process(L, R, 128);  // 0.4987 s
    const int before = v.activeVoices();
    v.setOs(8);
    const bool pend = v.osPending();
    int blocks = 0;
    while (v.osPending() && blocks < 400) {
      v.process(L, R, 128);
      blocks += 1;
    }
    const double gap = blocks * 128 / SR;
    const int os = v.os(), lat = v.latencySamples();
    v.process(L, R, 128);
    v.process(L, R, 128);
    const int after = v.activeVoices();
    while (v.currentFrame() < 1.6 * SR) v.process(L, R, 128);
    const int later = v.activeVoices();
    v.setOs(8);  // le meme taux : rien
    const bool noop = !v.osPending();
    v.setOs(3);  // un taux inconnu : rien
    const long allocs = gAllocs.load() - a0;
    check(before == 1 && pend && os == 8 && lat == 21 && gap < 0.3 && after == 1 && later == 2 && noop && !v.osPending() && allocs == 0,
          "note tenue : %d voix avant, changement apres %.0f ms de silence (os %d, latence %d), %d voix apres (la longue, la courte retiree), %d a 1.6 s (la note a venir), %ld allocation", before, gap * 1000, os, lat, after, later, allocs);
  }
}

/* ---------------- 5. la reverb ---------------- */
/** La convolution directe (double) de quelques echantillons non nuls avec la reponse : la reference. */
std::vector<double> direct(const Buf& x, const std::vector<float>& h, size_t n) {
  std::vector<double> y(n, 0.0);
  for (size_t i = 0; i < x.size(); ++i) {
    if (x[i] == 0) continue;
    const double xi = x[i];
    const size_t m = std::min(h.size(), n - std::min(n, i));
    for (size_t k = 0; k < m; ++k) y[i + k] += xi * h[k];
  }
  return y;
}
struct Lcg {
  uint32_t s;
  float next() {
    s = s * 1664525u + 1013904223u;
    return static_cast<float>(static_cast<int32_t>(s)) / 2147483648.0f;
  }
};
/** Schroeder : le temps de -5 a -35 dB de l'energie restante, x2 (RT60). */
double rt60(const std::vector<float>& h, int pre) {
  std::vector<double> e(h.size() + 1, 0.0);
  for (size_t i = h.size(); i-- > 0;) e[i] = e[i + 1] + static_cast<double>(h[i]) * h[i];
  double t5 = -1, t35 = -1;
  for (size_t i = static_cast<size_t>(pre); i < h.size(); ++i) {
    const double d = 10 * std::log10(e[i] / e[0]);
    if (t5 < 0 && d <= -5) t5 = static_cast<double>(i);
    if (t35 < 0 && d <= -35) {
      t35 = static_cast<double>(i);
      break;
    }
  }
  return 2 * (t35 - t5) / SR;
}
double irCentroid(const std::vector<float>& h, int pre) {
  const size_t N = 1 << 15;
  std::vector<std::complex<double>> a(N);
  for (size_t i = 0; i < N; ++i) a[i] = pre + i < h.size() ? h[static_cast<size_t>(pre) + i] : 0.f;
  fft(a);
  double num = 0, den = 0;
  for (size_t k = 1; k < N / 2; ++k) {
    num += std::norm(a[k]) * static_cast<double>(k) * SR / N;
    den += std::norm(a[k]);
  }
  return num / den;
}
void testReverb() {
  std::printf("\n5. REVERB : SIZE, TONE, PRE DELAY\n");
  // a. aux defauts : la reponse du site, au bit pres, a toute frequence d'echantillonnage
  for (double sr : {44100.0, 48000.0, 88200.0, 96000.0}) {
    std::vector<float> L, R;
    mmarp::detail::Convolver::impulse(2.4, 3000, 0.02, sr, L, R);
    const auto ir = ArpFx::makeReverb(sr, 0.5, 0.5, 0.2);
    const bool eq = ir->ir[0].size() == L.size() && std::memcmp(ir->ir[0].data(), L.data(), L.size() * 4) == 0 && std::memcmp(ir->ir[1].data(), R.data(), R.size() * 4) == 0;
    check(eq && ir->seconds == 2.4 && ir->hiStart == 9000 && ir->hiEnd == 3000 && ir->preSeconds == 0.02, "defauts a %.0f Hz : la reponse du site (makeImpulse 2.4 s, 9 -> 3 kHz, 20 ms), %zu echantillons, %s", sr, L.size(), eq ? "bit a bit" : "DIFFERENTE");
  }
  // b. la convolution contre la convolution directe (quelques impulsions et une salve), blocs de tailles quelconques
  struct Rv {
    const char* name;
    double size, tone, pre;
  };
  const std::vector<Rv> rvs = {{"defauts (2.4 s)", 0.5, 0.5, 0.2}, {"SIZE 0 (0.6 s), PRE 0 (la tete directe)", 0, 0.5, 0}, {"SIZE 1 (9.6 s), TONE 1, PRE 1", 1, 1, 1}, {"SIZE 0.75, TONE 0, PRE 0.03 (tete en partie)", 0.75, 0, 0.03}};
  for (const auto& rv : rvs) {
    const auto ir = ArpFx::makeReverb(SR, rv.size, rv.tone, rv.pre);
    mmarp::detail::Convolver cv;
    cv.prepare(SR, ir);
    const size_t n = static_cast<size_t>(ir->length) + 60000;
    Buf xL(n, 0.f), xR(n, 0.f), yL(n), yR(n);
    Lcg g{77};
    for (int k = 0; k < 14; ++k) {
      const size_t at = static_cast<size_t>((g.next() * 0.5 + 0.5) * 40000);
      xL[at] = g.next();
      xR[(at * 7 + 13) % 40000] = g.next();
    }
    for (int i = 0; i < 48; ++i) xL[20000 + static_cast<size_t>(i)] = 0.5f * g.next();
    size_t pos = 0;
    const long a0 = gAllocs.load();
    while (pos < n) {
      const size_t len = std::min(n - pos, static_cast<size_t>(1 + (static_cast<uint32_t>(g.next() * 1e6f) % 700)));
      cv.process(&xL[pos], &xR[pos], &yL[pos], &yR[pos], static_cast<int>(len));
      pos += len;
    }
    const long allocs = gAllocs.load() - a0;
    const std::vector<double> dL = direct(xL, ir->ir[0], n), dR = direct(xR, ir->ir[1], n);
    double err = 0, peak = 0;
    for (size_t i = 0; i < n; ++i) {
      err = std::max({err, std::fabs(yL[i] - dL[i]), std::fabs(yR[i] - dR[i])});
      peak = std::max({peak, std::fabs(dL[i]), std::fabs(dR[i])});
    }
    check(db(err / peak) < -120 && allocs == 0, "%-44s contre la convolution directe : %.1f dB sous la crete (%d + %d + %d blocs, tete %d points), %ld allocation", rv.name, db(err / peak), ir->parts[0], ir->parts[1], ir->parts[2],
          256 - ir->headFrom, allocs);
  }
  // c. SIZE allonge la queue, TONE change le centroide, PRE decale le debut
  {
    double rt[3], cen[3];
    int first[3];
    const double v[3] = {0, 0.5, 1};
    for (int i = 0; i < 3; ++i) {
      const auto a = ArpFx::makeReverb(SR, v[i], 0.5, 0.2);
      rt[i] = rt60(a->ir[0], 960);
      const auto b = ArpFx::makeReverb(SR, 0.5, v[i], 0.2);
      cen[i] = irCentroid(b->ir[0], 960);
      const auto c = ArpFx::makeReverb(SR, 0.5, 0.5, v[i]);
      first[i] = 0;
      while (first[i] < c->length && c->ir[0][static_cast<size_t>(first[i])] == 0) first[i] += 1;
    }
    check(rt[0] > 0.5 && rt[0] < 0.7 && rt[1] > 2.0 && rt[1] < 2.8 && rt[2] > 8.0 && rt[2] < 11.2, "SIZE 0 / 0.5 / 1 : RT60 %.2f / %.2f / %.2f s (loi : 0.6 / 2.4 / 9.6 s)", rt[0], rt[1], rt[2]);
    check(cen[0] < 0.6 * cen[1] && cen[2] > 1.5 * cen[1], "TONE 0 / 0.5 / 1 : centroide de la reponse %.0f / %.0f / %.0f Hz", cen[0], cen[1], cen[2]);
    check(first[0] <= 1 && first[1] == 2401 && first[2] == 4801, "PRE DELAY 0 / 0.5 / 1 : premier echantillon non nul a %d / %d / %d (0, 50, 100 ms ; +1 : le fondu d'entree)", first[0], first[1], first[2]);
  }
  // d. l'echange en cours de jeu : aucune allocation, aucune liberation, aucun clic, puis exactement la reponse neuve
  {
    ArpFx fx, ref;
    fx.prepare(SR, 512);
    ref.prepare(SR, 512);
    ArpFxSettings s;
    s.reverb = 1;
    s.volume = 0.8;
    fx.set(s, true);
    ref.set(s, true);
    auto big = ArpFx::makeReverb(SR, 0.9, 0.7, 0.0);
    std::weak_ptr<const ReverbIR> wbig = big;
    const ReverbIR* was = fx.reverb();
    // la reference : la meme chaine, la reponse neuve depuis toujours
    {
      auto same2 = ArpFx::makeReverb(SR, 0.9, 0.7, 0.0);
      ref.setReverb(same2);
    }
    const size_t n = static_cast<size_t>(6 * SR);
    Buf xL(n), xR(n), yL(n), yR(n), zL(n), zR(n);
    for (size_t i = 0; i < n; ++i) {
      // un son continu et lisse (un accord de sinus) : le moindre saut de la reverb se voit
      const double t = static_cast<double>(i) / SR;
      xL[i] = static_cast<float>(0.2 * std::sin(2 * PI * 220 * t) + 0.1 * std::sin(2 * PI * 331 * t));
      xR[i] = static_cast<float>(0.2 * std::sin(2 * PI * 277 * t) + 0.1 * std::sin(2 * PI * 415 * t));
    }
    // la reference laisse d'abord finir son propre fondu (2 s a vide), puis rejoue depuis des lignes vides
    {
      Buf q(48000, 0.f), o1(48000), o2(48000);
      for (int k = 0; k < 2; ++k) ref.process(q.data(), q.data(), o1.data(), o2.data(), 48000 / 2);
      for (int k = 0; k < 4; ++k) ref.process(q.data(), q.data(), o1.data(), o2.data(), 512);
    }
    const bool refReady = !ref.reverbBusy();
    while (ref.takeRetiredReverb()) {}
    ref.reset();
    ref.set(s, true);
    const size_t swapAt = static_cast<size_t>(2.0 * SR) + 77;
    long allocs = 0;
    bool accepted = false;
    size_t pos = 0;
    long busyUntil = -1;
    while (pos < n) {
      const size_t len = std::min<size_t>(128, n - pos);
      const long a0 = gAllocs.load();
      if (pos <= swapAt && swapAt < pos + len) accepted = fx.setReverb(std::move(big));
      fx.process(&xL[pos], &xR[pos], &yL[pos], &yR[pos], static_cast<int>(len));
      allocs += gAllocs.load() - a0;
      ref.process(&xL[pos], &xR[pos], &zL[pos], &zR[pos], static_cast<int>(len));
      pos += len;
      if (pos > swapAt && busyUntil < 0 && !fx.reverbBusy()) busyUntil = static_cast<long>(pos);
    }
    // le clic : la derivee seconde (un sinus de 415 Hz en a tres peu, un saut beaucoup), autour de l'echange
    auto d2max = [&](const Buf& y, size_t a, size_t b) {
      double m = 0;
      for (size_t i = a + 2; i < b; ++i) m = std::max(m, std::fabs(static_cast<double>(y[i]) - 2.0 * y[i - 1] + y[i - 2]));
      return m;
    };
    const double before = std::max(d2max(yL, static_cast<size_t>(1.0 * SR), swapAt - 256), d2max(yR, static_cast<size_t>(1.0 * SR), swapAt - 256));
    const double during = std::max(d2max(yL, swapAt - 256, swapAt + static_cast<size_t>(1.2 * SR)), d2max(yR, swapAt - 256, swapAt + static_cast<size_t>(1.2 * SR)));
    // apres le fondu : la chaine qui a eu la reponse neuve depuis toujours
    double err = 0, peak = 0;
    for (size_t i = swapAt + static_cast<size_t>(1.0 * SR); i < n; ++i) {
      err = std::max({err, std::fabs(static_cast<double>(yL[i]) - zL[i]), std::fabs(static_cast<double>(yR[i]) - zR[i])});
      peak = std::max(peak, std::fabs(static_cast<double>(zL[i])));
    }
    // l'ancienne n'est liberee que par takeRetiredReverb (ici), jamais par process
    const auto old = fx.takeRetiredReverb();
    const bool gotOld = old && old.get() == was && old.use_count() == 1 && !fx.takeRetiredReverb();
    check(accepted && refReady && allocs == 0 && during <= 1.5 * before + 1e-7, "echange en cours de jeu (2.4 s -> 7 s, sans pre-delai) : %ld allocation, derivee seconde %.2e pendant contre %.2e avant (aucun clic)", allocs, during, before);
    check(busyUntil > 0 && (busyUntil - static_cast<long>(swapAt)) / SR < 0.8 && db(err / peak) < -110 && gotOld && !wbig.expired(),
          "fondu fini en %.0f ms ; ensuite = la reponse neuve depuis toujours a %.1f dB ; l'ancienne rendue par takeRetiredReverb (%s)", 1000.0 * (busyUntil - static_cast<double>(swapAt)) / SR, db(err / peak), gotOld ? "seule reference" : "NON");
  }
  // e. des echanges en rafale, sans vider la file : rien n'est libere sur le thread audio, la derniere acceptee gagne
  {
    ArpFx fx;
    fx.prepare(SR, 128);
    ArpFxSettings s;
    s.reverb = 0.8;
    fx.set(s, true);
    std::vector<std::shared_ptr<const ReverbIR>> made;
    for (int k = 0; k < 24; ++k) made.push_back(ArpFx::makeReverb(SR, 0.05 * (k % 9), 0.1 * (k % 7), 0.03 * (k % 5)));
    Buf x(128), yL(128), yR(128);
    Lcg g{5};
    int ok = 0, refused = 0;
    const ReverbIR* last = nullptr;
    const long a0 = gAllocs.load();
    bool fin = true;
    for (int b = 0; b < 3000; ++b) {
      for (auto& v : x) v = 0.2f * g.next();
      if (b < 24 * 20 && b % 20 == 0) {
        // l'appelant garde sa reference (made) : une demande refusee ne libere donc rien
        if (fx.setReverb(made[static_cast<size_t>(b / 20)])) {
          ok += 1;
          last = made[static_cast<size_t>(b / 20)].get();
        } else
          refused += 1;
      }
      fx.process(x.data(), x.data(), yL.data(), yR.data(), 128);
      for (float v : yL) fin = fin && std::isfinite(v);
      if (b == 1500)
        while (fx.takeRetiredReverb()) {}
    }
    const long allocs = gAllocs.load() - a0;
    int back = 0;
    while (fx.takeRetiredReverb()) back += 1;
    check(allocs == 0 && fin && ok >= 8 && fx.reverb() == last && !fx.reverbBusy(), "24 echanges en rafale (un tous les 53 ms, file videe une seule fois) : %d acceptes, %d refuses (file pleine), %ld allocation, la derniere acceptee en place", ok, refused, allocs);
    // une reponse d'une autre frequence d'echantillonnage est refusee
    check(!fx.setReverb(ArpFx::makeReverb(44100, 0.5, 0.5, 0.2)) && !fx.setReverb(nullptr), "une reponse d'une autre frequence (ou nulle) est refusee (%d rendues ensuite)", back);
  }
}

/* ---------------- 6. la section master ---------------- */
Buf sine(double hz, double amp, size_t n, double phase = 0) {
  Buf x(n);
  for (size_t i = 0; i < n; ++i) x[i] = static_cast<float>(amp * std::sin(2 * PI * hz * static_cast<double>(i) / SR + phase));
  return x;
}
/** L'amplitude d'une raie (projection sur sinus / cosinus) entre a et b. */
double tone(const Buf& x, double hz, size_t a, size_t b) {
  double s = 0, c = 0;
  for (size_t i = a; i < b; ++i) {
    const double w = 0.5 - 0.5 * std::cos(2 * PI * static_cast<double>(i - a) / static_cast<double>(b - a));
    s += w * x[i] * std::sin(2 * PI * hz * static_cast<double>(i) / SR);
    c += w * x[i] * std::cos(2 * PI * hz * static_cast<double>(i) / SR);
  }
  return 4 * std::sqrt(s * s + c * c) / static_cast<double>(b - a);
}
struct MasterRun {
  Buf L, R;
  long allocs;
};
MasterRun master(const Buf& inL, const Buf& inR, double warmth, double bass, double air, double width, bool now = true, size_t changeAt = 0) {
  mmarp::detail::Master m;
  m.prepare(SR);
  if (now) m.set(warmth, bass, air, width, true);
  MasterRun r{inL, inR, 0};
  const long a0 = gAllocs.load();
  for (size_t pos = 0; pos < inL.size(); pos += 100) {
    if (!now && pos <= changeAt && changeAt < pos + 100) m.set(warmth, bass, air, width, false);
    m.process(&r.L[pos], &r.R[pos], static_cast<int>(std::min<size_t>(100, inL.size() - pos)));
  }
  r.allocs = gAllocs.load() - a0;
  return r;
}
void testMaster() {
  std::printf("\n6. MASTER : WARMTH, BASS, AIR, WIDTH\n");
  const size_t n = 1 << 16;
  Lcg g{9};
  Buf nL(n), nR(n);
  for (size_t i = 0; i < n; ++i) {
    nL[i] = 0.3f * g.next();
    nR[i] = 0.3f * g.next();
  }
  nL[100] = -0.0f;  // un zero negatif : le contournement ne le touche pas
  // a. neutre : au bit pres ; apres un detour par chaque reglage et retour au neutre : de nouveau au bit pres
  {
    const MasterRun r = master(nL, nR, 0, 0.5, 0.5, 0.5);
    check(same(r.L, nL) && same(r.R, nR) && r.allocs == 0, "neutre (warmth 0, bass 0.5, air 0.5, width 0.5) : la sortie est l'entree, bit a bit");
    const char* names[4] = {"WARMTH", "BASS", "AIR", "WIDTH"};
    for (int k = 0; k < 4; ++k) {
      mmarp::detail::Master m;
      m.prepare(SR);
      Buf L = nL, R = nR;
      const long a0 = gAllocs.load();
      for (size_t pos = 0; pos < n; pos += 128) {
        if (pos == 128 * 40) m.set(k == 0 ? 0.8 : 0, k == 1 ? 0.9 : 0.5, k == 2 ? 0.1 : 0.5, k == 3 ? 0.9 : 0.5, false);
        if (pos == 128 * 140) m.set(0, 0.5, 0.5, 0.5, false);
        m.process(&L[pos], &R[pos], 128);
      }
      const long allocs = gAllocs.load() - a0;
      // de retour : 20 ms de rampe apres le bloc 140 (960 echantillons)
      const size_t back = 128 * 140 + 960 + 1;
      const bool changed = std::memcmp(&L[128 * 60], &nL[128 * 60], 4 * 128 * 60) != 0;
      const bool exact = std::memcmp(&L[back], &nL[back], 4 * (n - back)) == 0 && std::memcmp(&R[back], &nR[back], 4 * (n - back)) == 0;
      const bool pre = std::memcmp(&L[0], &nL[0], 4 * 128 * 40) == 0;
      check(changed && exact && pre && allocs == 0 && m.bypassed(), "%-6s engage puis remis au neutre : agit, puis de nouveau bit a bit 20 ms apres (%s), %ld allocation", names[k], exact ? "oui" : "NON", allocs);
    }
  }
  // b. BASS : le plateau grave (gain a 60 Hz, 120 Hz, 1 kHz) ; AIR : le plateau aigu (1 kHz, 12 kHz, 18 kHz)
  {
    auto gain = [&](double hz, double bass, double air) {
      const Buf x = sine(hz, 0.25, n);
      const MasterRun r = master(x, x, 0, bass, air, 0.5);
      return db(tone(r.L, hz, n / 4, n) / tone(x, hz, n / 4, n));
    };
    const double b60 = gain(60, 1, 0.5), b120 = gain(120, 1, 0.5), b1k = gain(1000, 1, 0.5), c60 = gain(60, 0, 0.5), c1k = gain(1000, 0, 0.5), h60 = gain(60, 0.75, 0.5);
    check(b60 > 5.0 && b60 < 6.1 && std::fabs(b120 - 3) < 0.6 && std::fabs(b1k) < 0.3 && c60 < -5.0 && c60 > -6.1 && std::fabs(c1k) < 0.3 && std::fabs(h60 - 0.5 * b60) < 0.4,
          "BASS 1 : %+.2f dB a 60 Hz, %+.2f a 120 Hz, %+.2f a 1 kHz ; BASS 0 : %+.2f a 60 Hz, %+.2f a 1 kHz ; BASS 0.75 : %+.2f a 60 Hz", b60, b120, b1k, c60, c1k, h60);
    const double a1k = gain(1000, 0.5, 1), a10 = gain(10000, 0.5, 1), a12 = gain(12000, 0.5, 1), a18 = gain(18000, 0.5, 1), d12 = gain(12000, 0.5, 0), d18 = gain(18000, 0.5, 0), d1k = gain(1000, 0.5, 0);
    check(std::fabs(a1k) < 0.3 && std::fabs(a10 - 3) < 0.6 && a12 > 3.5 && a18 > 5.2 && a18 < 6.1 && d12 < -3.5 && d18 < -5.2 && d18 > -6.1 && std::fabs(d1k) < 0.3,
          "AIR 1 : %+.2f dB a 1 kHz, %+.2f a 10 kHz, %+.2f a 12 kHz, %+.2f a 18 kHz ; AIR 0 : %+.2f a 12 kHz, %+.2f a 18 kHz", a1k, a10, a12, a18, d12, d18);
  }
  // c. WIDTH : la correlation G / D d'un bruit independant a gauche et a droite ; les graves restent ou ils sont
  {
    auto corr = [&](const Buf& a, const Buf& b) {
      double ab = 0, aa = 0, bb = 0;
      for (size_t i = n / 4; i < n; ++i) {
        ab += static_cast<double>(a[i]) * b[i];
        aa += static_cast<double>(a[i]) * a[i];
        bb += static_cast<double>(b[i]) * b[i];
      }
      return ab / std::sqrt(aa * bb);
    };
    const MasterRun w0 = master(nL, nR, 0, 0.5, 0.5, 0), w25 = master(nL, nR, 0, 0.5, 0.5, 0.25), w1 = master(nL, nR, 0, 0.5, 0.5, 1);
    const double c0 = corr(w0.L, w0.R), c25 = corr(w25.L, w25.R), c5 = corr(nL, nR), c1 = corr(w1.L, w1.R);
    check(same(w0.L, w0.R) && c0 > 0.999999 && c25 > 0.5 && c25 < 0.7 && std::fabs(c5) < 0.02 && c1 < -0.5 && c1 > -0.65, "WIDTH 0 / 0.25 / 0.5 / 1 : correlation G / D %.4f / %.3f / %.3f / %.3f (bruits independants ; 0 : mono exact)", c0, c25, c5, c1);
    // un son tout a gauche : son cote (G - D) a 60 Hz, 150 Hz, 1 kHz quand WIDTH = 1
    auto side = [&](double hz) {
      const Buf x = sine(hz, 0.25, n), z(n, 0.f);
      const MasterRun r = master(x, z, 0, 0.5, 0.5, 1);
      Buf s(n), m(n);
      for (size_t i = 0; i < n; ++i) {
        s[i] = 0.5f * (r.L[i] - r.R[i]);
        m[i] = 0.5f * (r.L[i] + r.R[i]);
      }
      return std::make_pair(db(tone(s, hz, n / 4, n) / (0.5 * tone(x, hz, n / 4, n))), db(tone(m, hz, n / 4, n) / (0.5 * tone(x, hz, n / 4, n))));
    };
    const auto s40 = side(40), s75 = side(75), s150 = side(150), s1k = side(1000), s8k = side(8000);
    check(std::fabs(s40.first) < 0.6 && s75.first < 0.5 && s75.first > -2.0 && s1k.first > 5.8 && s1k.first < 6.1 && s8k.first > 5.9 && std::fabs(s1k.second) < 0.01 && std::fabs(s40.second) < 0.01,
          "WIDTH 1, le cote : %+.2f dB a 40 Hz, %+.2f a 75 Hz, %+.2f a 150 Hz, %+.2f a 1 kHz, %+.2f a 8 kHz (les graves restent ; le milieu %+.3f dB)", s40.first, s75.first, s150.first, s1k.first, s8k.first, s1k.second);
  }
  // d. WARMTH : les harmoniques (THD), la compensation de niveau, le retard, le repliement
  {
    const size_t N = 1 << 16, skip = 8192;
    auto thd = [&](double warmth, double amp, double* h2, double* h3, double* lvl) {
      const double hz = 1000.0 * 1.00013;
      const Buf x = sine(hz, amp, N + skip);
      const MasterRun r = master(x, x, warmth, 0.5, 0.5, 0.5);
      const std::vector<double> m = spectrum(r.L.data() + skip, N);
      const double binHz = SR / N;
      auto line = [&](int k) {
        const long c = std::lround(k * hz / binHz);
        double v = 0;
        for (long b = c - 12; b <= c + 12; ++b) v = std::max(v, m[static_cast<size_t>(b)]);
        return v;
      };
      double e = 0;
      for (int k = 2; k * hz < 20000; ++k) e += line(k) * line(k);
      *h2 = db(line(2) / line(1));
      *h3 = db(line(3) / line(1));
      *lvl = rmsDb(r.L, skip) - rmsDb(x, skip);
      return 100 * std::sqrt(e) / line(1);
    };
    double h2, h3, lv;
    const double t100 = thd(1, 0.5, &h2, &h3, &lv);
    double h2b, h3b, lvb;
    const double t50 = thd(0.5, 0.5, &h2b, &h3b, &lvb);
    double h2c, h3c, lvc;
    const double t25 = thd(0.25, 0.3, &h2c, &h3c, &lvc);
    double h2d, h3d, lvd;
    thd(1, 0.3, &h2d, &h3d, &lvd);
    check(t100 > 2 && t100 < 9 && t50 > 0.5 && t50 < t100 && t25 > 0.05 && t25 < t50 && h2 > -50 && h3 > -35 && h3 < -20 && std::fabs(lvd) < 0.1 && std::fabs(lv) < 1.2,
          "WARMTH 1 (sinus 1 kHz de 0.5) : THD %.2f %% (H2 %.1f dBc, H3 %.1f dBc), niveau %+.2f dB ; 0.5 : %.2f %% ; 0.25 (0.3) : %.3f %% ; sinus de 0.3 : niveau %+.3f dB", t100, h2, h3, lv, t50, t25, lvd);
    // le repliement : un sinus aigu fort, tout ce qui n'est pas un harmonique
    double worst = -999, worstHz = 0, wf = 0;
    for (double hz : {5003.7, 7919.3, 11003.1, 14501.9}) {
      const Buf x = sine(hz, 0.7, (1 << 17) + skip);
      const MasterRun r = master(x, x, 1, 0.5, 0.5, 0.5);
      const Alias a = aliasOf(r.L.data() + skip, 1 << 17, hz, SR, 20, 20000);
      if (a.dbc > worst) {
        worst = a.dbc;
        worstHz = a.hz;
        wf = hz;
      }
    }
    check(worst < -90, "WARMTH 1, sinus de 0.7 a 5, 7.9, 11 et 14.5 kHz : la plus forte raie repliee sous 20 kHz %.1f dBc (%.0f Hz, pour %.0f Hz)", worst, worstHz, wf);
    // le retard : 39 echantillons (un tres petit signal : la courbe est une droite), et le continu bloque
    {
      const Buf x = sine(997, 1e-4, 8192);
      const MasterRun r = master(x, x, 1, 0.5, 0.5, 0.5);
      double best = 1e9;
      int at = -1;
      for (int d = 30; d < 50; ++d) {
        double e = 0;
        for (size_t i = 2000; i < 8000; ++i) e += std::fabs(static_cast<double>(r.L[i]) - x[i - static_cast<size_t>(d)]);
        if (e < best) {
          best = e;
          at = d;
        }
      }
      mmarp::detail::Master m;
      m.prepare(SR);
      const int l0 = m.latency();
      m.set(1, 0.5, 0.5, 0.5, false);
      const Buf big = sine(220, 0.6, 1 << 16);
      const MasterRun rb = master(big, big, 1, 0.5, 0.5, 0.5);
      double mean = 0;
      for (size_t i = 1 << 15; i < (1 << 16); ++i) mean += rb.L[i];
      mean /= (1 << 15);
      check(at == 39 && l0 == 0 && m.latency() == 39 && std::fabs(mean) < 1e-4, "WARMTH engagee : retard %d echantillons (latency() %d, 0 au neutre), continu %.1e sur un sinus de 0.6", at, m.latency(), mean);
    }
  }
  // e. aucun clic : chaque reglage change en plein son (un sinus grave : le moindre saut se voit)
  {
    const Buf x = sine(110, 0.5, 48000), y = sine(110, 0.3, 48000, 1.0);
    auto d2 = [&](const Buf& v, size_t a, size_t b) {
      double m = 0;
      for (size_t i = a + 2; i < b; ++i) m = std::max(m, std::fabs(static_cast<double>(v[i]) - 2.0 * v[i - 1] + v[i - 2]));
      return m;
    };
    const double base = d2(x, 0, 48000);
    const double sets[8][4] = {{1, 0.5, 0.5, 0.5}, {0, 1, 0.5, 0.5}, {0, 0, 0.5, 0.5}, {0, 0.5, 1, 0.5}, {0, 0.5, 0, 0.5}, {0, 0.5, 0.5, 0}, {0, 0.5, 0.5, 1}, {1, 1, 1, 1}};
    double worst = 0;
    for (const auto& st : sets) {
      const MasterRun r = master(x, y, st[0], st[1], st[2], st[3], false, 20000);
      worst = std::max(worst, std::max(d2(r.L, 100, 48000), d2(r.R, 100, 48000)) / base);
    }
    check(worst < 3.0, "chaque reglage change en plein son (rampe de 20 ms) : derivee seconde au plus x%.2f celle du sinus d'entree (un saut de 1 %% : x40)", worst);
  }
  // f. dans la chaine : ArpFx aux defauts = ArpFx avec les champs neufs poses a leur neutre ; et le master agit
  {
    ArpFx a, b, c;
    for (ArpFx* f : {&a, &b, &c}) f->prepare(SR, 256);
    ArpFxSettings s;
    s.chorus = 1;
    s.delay = 0.3;
    s.reverb = 0.5;
    s.monoLowHz = 90;
    ArpFxSettings t = s;
    t.revSize = 0.5;
    t.revTone = 0.5;
    t.revPre = 0.2;
    t.warmth = 0;
    t.bass = 0.5;
    t.air = 0.5;
    t.width = 0.5;
    ArpFxSettings u = s;
    u.bass = 0.8;
    u.width = 0.7;
    u.warmth = 0.4;
    a.set(s, true);
    b.set(t, true);
    c.set(u, true);
    Buf oa(n), ob(n), oc(n), ra(n), rb(n), rc(n);
    const long a0 = gAllocs.load();
    for (size_t pos = 0; pos + 256 <= n; pos += 256) {
      a.process(&nL[pos], &nR[pos], &oa[pos], &ra[pos], 256);
      b.process(&nL[pos], &nR[pos], &ob[pos], &rb[pos], 256);
      if (pos == 256 * 100) b.set(t, false);
      c.process(&nL[pos], &nR[pos], &oc[pos], &rc[pos], 256);
      if (pos == 256 * 100) {
        u.air = 0.9;
        c.set(u, false);
      }
    }
    const long allocs = gAllocs.load() - a0;
    check(same(oa, ob) && same(ra, rb) && !same(oa, oc) && finite(oc) && allocs == 0 && a.masterLatencySamples() == 0 && c.masterLatencySamples() == 39 && a.latencySamples() == 0,
          "ArpFx : les champs neufs a leur neutre = la chaine sans eux, bit a bit ; master engage : agit, fini ; %ld allocation (process, set)", allocs);
  }
}

/* ---------------- --cpu ---------------- */
int cpu() {
  std::printf("Le cout (un coeur de cette machine ; blocs de 128 a 48 kHz : temps reel 2666.7 us)\n");
  std::printf("\nMoteur, 12 voix au plus, STACK 3 + WIDE + GLUE (stack 16 cents, wide 0.6, glue 0.5), notes tenues\n");
  const KV patch = with(initPatch(), {{"stack", 16.2}, {"wide", 0.6}, {"glue", 0.5}, {"aS", 1}});
  for (int nv : {1, 4, 12}) {
    double us[2] = {0, 0};
    for (int q = 0; q < 2; ++q) {
      double best = 1e30;
      for (int rep = 0; rep < 3; ++rep) {
        VoyagerOptions o;
        o.os = q == 0 ? 4 : 8;
        o.wideVoices = 12;
        Voyager v(o, patch);
        for (int i = 0; i < nv; ++i) v.note(0, 54 + 3 * i, 100, 1, NAN);
        const int blocks = static_cast<int>(5 * SR / 128);
        float L[128], R[128];
        const auto t0 = std::chrono::steady_clock::now();
        for (int b = 0; b < blocks; ++b) v.process(L, R, 128);
        best = std::min(best, std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count());
      }
      us[q] = best / (5 * SR / 128) * 1e6;
    }
    std::printf("  %2d voix : x4 %7.1f us (%5.1f %%)   x8 %7.1f us (%5.1f %%)   x%.2f\n", nv, us[0], us[0] / 26.667, us[1], us[1] / 26.667, us[1] / us[0]);
  }
  {
    // les LFO : le surcout des destinations etendues (12 voix, x8)
    double us[3] = {0, 0, 0};
    const KV mods[3] = {{}, {{"l2Dest", 2}, {"l2Amt", 0.5}}, {{"l2Dest", 13}, {"l2Amt", 0.5}, {"xl1Dest", 3}, {"xl1Amt", 0.5}}};
    for (int q = 0; q < 3; ++q) {
      double best = 1e30;
      for (int rep = 0; rep < 2; ++rep) {
        VoyagerOptions o;
        o.os = 8;
        o.wideVoices = 12;
        Voyager v(o, with(patch, mods[q]));
        for (int i = 0; i < 12; ++i) v.note(0, 54 + 3 * i, 100, 1, NAN);
        const int blocks = static_cast<int>(3 * SR / 128);
        float L[128], R[128];
        const auto t0 = std::chrono::steady_clock::now();
        for (int b = 0; b < blocks; ++b) v.process(L, R, 128);
        best = std::min(best, std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count());
      }
      us[q] = best / (3 * SR / 128) * 1e6;
    }
    std::printf("  12 voix x8 : sans LFO neuf %.1f us ; LFO 2 -> CUTOFF %.1f us ; LFO 2 -> STACK + LFO 1 -> PAN %.1f us\n", us[0], us[1], us[2]);
  }
  std::printf("\nChaine (ArpFx), bruit continu, REVERB a 1 seule ; pire bloc : le 99.9e centile des blocs de 128\n");
  auto chain = [&](const char* name, const ArpFxSettings& s, double size, bool swap) {
    ArpFx fx;
    fx.prepare(SR, 128);
    fx.set(s, true);
    if (swap) {
      fx.setReverb(ArpFx::makeReverb(SR, size, 0.5, 0.2));
      Buf z(128, 0.f), o(128);
      for (int b = 0; b < 600; ++b) fx.process(z.data(), z.data(), o.data(), o.data(), 128);
    }
    Lcg g{3};
    Buf x(128), y(128), oL(128), oR(128);
    const int blocks = static_cast<int>(15 * SR / 128);
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
    std::printf("  %-44s %5.2f %% d'un coeur, bloc median %5.1f us, pire %6.1f us\n", name, 100 * total / 15, 1e6 * ts[ts.size() / 2], 1e6 * ts[static_cast<size_t>(0.999 * static_cast<double>(ts.size()))]);
  };
  ArpFxSettings s;
  s.reverb = 0;
  chain("tout coupe (REVERB 0)", s, 0.5, false);
  s.reverb = 1;
  chain("REVERB 2.4 s (SIZE 0.5)", s, 0.5, false);
  chain("REVERB 9.6 s (SIZE 1)", s, 1, true);
  chain("REVERB 0.6 s (SIZE 0)", s, 0, true);
  ArpFxSettings m = s;
  m.reverb = 0;
  m.warmth = 0.6;
  chain("WARMTH seule", m, 0.5, false);
  m.warmth = 0;
  m.bass = 0.8;
  m.air = 0.8;
  m.width = 0.8;
  chain("BASS + AIR + WIDTH", m, 0.5, false);
  {
    const auto t0 = std::chrono::steady_clock::now();
    const auto a = ArpFx::makeReverb(SR, 0.5, 0.5, 0.2);
    const auto t1 = std::chrono::steady_clock::now();
    const auto b = ArpFx::makeReverb(SR, 1, 0.5, 0.2);
    const auto t2 = std::chrono::steady_clock::now();
    std::printf("  makeReverb (thread du message) : 2.4 s en %.0f ms, 9.6 s en %.0f ms (%d et %d echantillons)\n", 1e3 * std::chrono::duration<double>(t1 - t0).count(), 1e3 * std::chrono::duration<double>(t2 - t1).count(), a->length, b->length);
  }
  return 0;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc > 1 && std::strcmp(argv[1], "--cpu") == 0) return cpu();
  testEngineNeutral();
  testHq();
  testLfo();
  testSetOs();
  testReverb();
  testMaster();
  std::printf("\nhq_test : %d controles, %d echecs\n", gChecks, gFails);
  return gFails ? 1 : 0;
}
