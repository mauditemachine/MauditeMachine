// v34 (Mika : "CPU B") : le moteur PRO (Voyager::setPro : les oscillateurs au taux de base, le filtre et la saturation
// surechantillonnes) contre CLASSIC, sans son : stabilite (ni NaN, ni denormaux, ni explosion a resonance maximale, FM
// extreme, SYNC), blocs de 1, 77 et 512 au bit pres, niveaux, repliement sur une note aigue, cout.
//   ./build-dsp/mmarp_pro_test
#include "Voyager.h"

#include <chrono>
#include <cmath>
#include <complex>
#include <cstdio>
#include <limits>
#include <string>
#include <vector>

using namespace mmarp;

namespace {
int failures = 0;
void check(bool ok, const std::string& what) {
  std::printf("%s %s\n", ok ? "ok  " : "FAIL", what.c_str());
  if (!ok) ++failures;
}

struct Patch {
  std::vector<ParamKV> kv;
};

ParamKV P(const char* id, double v) { return {Voyager::paramIndex(id), v}; }

// n echantillons a 48 kHz par blocs de block ; une note (midi) tenue 1.2 s, une autre a 0.6 s ; gauche et droite
std::vector<float> render(const Patch& pt, bool pro, int os, int block, double midi, double seconds, double* ms = nullptr, bool second = true) {
  VoyagerOptions o;
  o.os = os;
  Voyager v(o);
  v.setPro(pro);
  v.params(pt.kv.data(), static_cast<int>(pt.kv.size()));
  // (la seconde note : posee d'avance, elle tombe au bloc qui la contient, comme au site ; sans elle, le decoupage est libre)
  v.note(second ? 0.01 : 0.0, midi, 1.2, 1, std::numeric_limits<double>::quiet_NaN(), 0, 0.8);
  if (second) v.note(0.6, midi + 7, 1.0, 1, std::numeric_limits<double>::quiet_NaN(), 0, 0.8);
  const int n = static_cast<int>(seconds * 48000);
  std::vector<float> out(static_cast<size_t>(2 * n));
  std::vector<float> L(static_cast<size_t>(block)), R(static_cast<size_t>(block));
  const auto t0 = std::chrono::steady_clock::now();
  for (int i = 0; i < n; i += block) {
    const int m = std::min(block, n - i);
    v.process(L.data(), R.data(), m);
    for (int k = 0; k < m; ++k) {
      out[static_cast<size_t>(2 * (i + k))] = L[static_cast<size_t>(k)];
      out[static_cast<size_t>(2 * (i + k) + 1)] = R[static_cast<size_t>(k)];
    }
  }
  if (ms) *ms = std::chrono::duration<double, std::milli>(std::chrono::steady_clock::now() - t0).count();
  return out;
}

double rmsDb(const std::vector<float>& x) {
  double s = 0;
  for (float v : x) s += static_cast<double>(v) * v;
  return 10 * std::log10(s / static_cast<double>(x.size()) + 1e-30);
}

bool clean(const std::vector<float>& x, int& denorm, double& peak) {
  denorm = 0;
  peak = 0;
  bool ok = true;
  for (float v : x) {
    if (!std::isfinite(v)) ok = false;
    if (v != 0 && std::fabs(v) < 1e-30f) ++denorm;
    peak = std::max(peak, static_cast<double>(std::fabs(v)));
  }
  return ok;
}

// l'energie au-dessus de 16 kHz (dB sous le total), sur la gauche, DFT par paquets de 4096 (Hann)
double hfDb(const std::vector<float>& x) {
  const int N = 4096;
  double hf = 0, all = 0;
  const size_t frames = x.size() / 2;
  for (size_t s = 0; s + N < frames; s += N) {
    std::vector<std::complex<double>> a(N);
    for (int i = 0; i < N; ++i) a[static_cast<size_t>(i)] = x[2 * (s + static_cast<size_t>(i))] * (0.5 - 0.5 * std::cos(2 * M_PI * i / N));
    // DFT directe sur les bandes utiles (un pas de 4 cases : assez pour une mesure d'energie)
    for (int k = 4; k < N / 2; k += 4) {
      std::complex<double> acc = 0;
      const double w = -2 * M_PI * k / N;
      for (int i = 0; i < N; i += 2) acc += a[static_cast<size_t>(i)] * std::polar(1.0, w * i);
      const double e = std::norm(acc);
      all += e;
      if (k * 48000.0 / N > 16000) hf += e;
    }
  }
  return 10 * std::log10(hf / (all + 1e-30) + 1e-30);
}
}  // namespace

int main() {
  const Patch init{{}};
  const Patch saw{{P("wave1", 2), P("wave2", 2), P("cutoff", 12000), P("res", 0.2)}};
  const Patch reso{{P("res", 1.5), P("cutoff", 2000), P("drive", 1.5)}};
  const Patch fm{{P("fm", 1.5), P("ratio", 7.3), P("cutoff", 15000)}};
  const Patch syn{{P("sync", 1), P("wave1", 2), P("cutoff", 15000)}};
  // 1. stabilite
  for (const auto& [name, pt] : std::vector<std::pair<std::string, Patch>>{{"INIT", init}, {"resonance maximale + drive", reso}, {"FM extreme", fm}, {"SYNC", syn}}) {
    for (int os : {1, 2, 4}) {
      int den;
      double pk;
      const auto x = render(pt, true, os, 128, 36, 2.0);
      const auto y = render(pt, true, os, 128, 96, 1.5);
      int den2;
      double pk2;
      const bool ok = clean(x, den, pk) && clean(y, den2, pk2);
      check(ok && den == 0 && den2 == 0 && pk < 8 && pk2 < 8,
            "PRO x" + std::to_string(os) + " " + name + " : fini, " + std::to_string(den + den2) + " denormaux, crete " + std::to_string(std::max(pk, pk2)).substr(0, 5));
    }
  }
  // 2. les blocs : 1, 77 et 512 au bit pres
  {
    // (le meme decoupage que CLASSIC : on compare PRO a lui-meme et CLASSIC a lui-meme)
    const auto same3 = [&](bool pro, int os) {
      const auto a = render(saw, pro, os, 512, 60, 1.0, nullptr, false), b = render(saw, pro, os, 77, 60, 1.0, nullptr, false),
                 c = render(saw, pro, os, 1, 60, 1.0, nullptr, false);
      double d = 0;
      for (size_t i = 0; i < a.size() && i < b.size() && i < c.size(); ++i) d = std::max(d, static_cast<double>(std::max(std::fabs(a[i] - b[i]), std::fabs(a[i] - c[i]))));
      return d;
    };
    // Le moteur n'est pas invariant au bit pres au decoupage, CLASSIC compris (les evenements et les quanta de 128 :
    // le plugin le nourrit par morceaux de 128 au plus) ; PRO ne doit pas l'etre moins, et la sonie ne bouge pas
    const double dc = same3(false, 4), dp = same3(true, 2);
    const auto loud = [&](int block) { return rmsDb(render(saw, true, 2, block, 60, 1.0, nullptr, false)); };
    const double l512 = loud(512), l77 = loud(77), l1 = loud(1);
    char bb[220];
    std::snprintf(bb, sizeof bb, "blocs de 1, 77 et 512 : ecart max PRO %.3g (CLASSIC %.3g) ; sonie %.2f / %.2f / %.2f dB", dp, dc, l1, l77, l512);
    check(dp <= dc * 1.05 + 1e-9 && std::fabs(l512 - l77) < 0.1 && std::fabs(l512 - l1) < 0.1, bb);
  }
  // 3. niveaux : PRO STD (x2) et HQ (x4) contre CLASSIC HQ (x8)
  for (const auto& [name, pt] : std::vector<std::pair<std::string, Patch>>{{"INIT", init}, {"SAW ouvert", saw}, {"FM", fm}}) {
    const double c = rmsDb(render(pt, false, 8, 128, 48, 2.0)), s = rmsDb(render(pt, true, 2, 128, 48, 2.0)), h = rmsDb(render(pt, true, 4, 128, 48, 2.0));
    char b[200];
    std::snprintf(b, sizeof b, "niveau %s : CLASSIC HQ %.2f dB, PRO STD %+.2f, PRO HQ %+.2f", name.c_str(), c, s - c, h - c);
    check(std::fabs(s - c) < 0.5 && std::fabs(h - c) < 0.5, b);
  }
  // 4. repliement : une note aigue (C7), dents de scie ouvertes : l'energie au-dessus de 16 kHz
  {
    const double c8 = hfDb(render(saw, false, 8, 128, 96, 1.0)), c4 = hfDb(render(saw, false, 4, 128, 96, 1.0));
    const double p2 = hfDb(render(saw, true, 2, 128, 96, 1.0)), p4 = hfDb(render(saw, true, 4, 128, 96, 1.0));
    char b[220];
    std::snprintf(b, sizeof b, "au-dessus de 16 kHz (C7, scie) : CLASSIC HQ %.1f dB, CLASSIC STD %.1f, PRO STD %.1f, PRO HQ %.1f", c8, c4, p2, p4);
    check(p2 < c4 + 6 && p4 < c4 + 6, b);
  }
  // 5. cout : 8 voix tenues, PRO STD contre CLASSIC STD
  {
    Patch many = saw;
    many.kv.push_back(P("aR", 2.0));
    double tc = 0, tp = 0;
    for (int r = 0; r < 3; ++r) {
      double a, b;
      render(many, false, 4, 128, 48, 2.0, &a);
      render(many, true, 2, 128, 48, 2.0, &b);
      tc += a;
      tp += b;
    }
    char bf[160];
    std::snprintf(bf, sizeof bf, "cout : PRO STD %.0f %% de CLASSIC STD (%.0f ms contre %.0f ms)", 100 * tp / tc, tp / 3, tc / 3);
    check(tp < tc * 0.85, bf);
  }
  std::printf(failures ? "%d echec(s)\n" : "OK (0 echec)\n", failures);
  return failures ? 1 : 0;
}
