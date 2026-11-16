// MM-ARP, ce que la face montre des modulations (Voyager::modView, l'arc lumineux autour des potards, 2026-11-16) :
// un LFO sur CUTOFF fait bouger l'ecart de la coupure, profondeur 0 le ramene a 0 ; LFO 2 sur RES, une ligne de la
// matrice (MOD WHEEL -> NOISE) ; et le son ne change pas (ModView n'est qu'une lecture).
//   ./mmarp_modview_test
#include "Voyager.h"

#include <cmath>
#include <cstdio>
#include <string>
#include <utility>
#include <vector>

using namespace mmarp;
using KV = std::vector<std::pair<std::string, double>>;

static int fails = 0;
static void check(bool ok, const char* what) {
  std::printf("%s  %s\n", ok ? "ok  " : "FAIL", what);
  if (!ok) ++fails;
}

struct Run {
  double cutMin = 1e9, cutMax = -1e9, resMax = 0, noiseMax = 0;
  std::vector<float> L;
};

static Run run(const KV& patch, double seconds, double mw = 0) {
  VoyagerOptions o;
  o.sampleRate = 48000;
  o.os = 4;
  Voyager v(o, patch);
  for (int i = 0; i < 16; ++i) v.note(0.01 + i * 0.12, 45 + (i % 4) * 5, 0.1, 0.8, std::nan(""), 0, 0.8);
  v.beat(0, 0, 120, true);
  if (mw > 0) v.modWheel(mw);
  Run r;
  const int B = 128;
  const int frames = static_cast<int>(seconds * 48000) / B * B;
  r.L.assign(static_cast<size_t>(frames), 0.f);
  std::vector<float> R(static_cast<size_t>(frames));
  for (int f = 0; f < frames; f += B) {
    v.process(r.L.data() + f, R.data() + f, B);
    const ModView& m = v.modView();
    r.cutMin = std::min(r.cutMin, m.cutOct);
    r.cutMax = std::max(r.cutMax, m.cutOct);
    r.resMax = std::max(r.resMax, std::fabs(m.res));
    r.noiseMax = std::max(r.noiseMax, std::fabs(m.noise));
  }
  return r;
}

int main() {
  // LFO 1 (la face) sur CUTOFF (dest 1), vitesse 1/4 temps : l'ecart va et vient, +/- 3 x profondeur octaves
  const KV lfo = {{"lfoDest", 1}, {"lfoAmt", 0.5}, {"lfoBeats", 0.25}, {"lfoShape", 0}};
  const Run a = run(lfo, 2.0);
  char msg[200];
  std::snprintf(msg, sizeof msg, "LFO 1 -> CUTOFF a 0.5 : l'ecart de la coupure va de %.2f a %.2f octaves", a.cutMin, a.cutMax);
  check(a.cutMax > 0.5 && a.cutMin < -0.5 && a.cutMax <= 1.5 + 1e-9 && a.cutMin >= -1.5 - 1e-9, msg);
  const Run z = run({{"lfoDest", 1}, {"lfoAmt", 0}, {"lfoBeats", 0.25}}, 1.0);
  std::snprintf(msg, sizeof msg, "profondeur 0 : aucun ecart (%.3g a %.3g)", z.cutMin, z.cutMax);
  check(z.cutMin == 0 && z.cutMax == 0, msg);
  // LFO 2 sur RES (l2Dest 5 : RES), et une ligne de la matrice MOD WHEEL -> NOISE
  const Run b = run({{"l2Beats", 0.5}, {"l2Shape", 0}, {"l2Dest", 5}, {"l2Amt", 0.8}}, 1.5);
  std::snprintf(msg, sizeof msg, "LFO 2 -> RES : ecart jusqu'a %.3f (0.35 x 0.8 au plus)", b.resMax);
  check(b.resMax > 0.1 && b.resMax <= 0.28 + 1e-9, msg);
  const Run c = run({{"m1Src", 2}, {"m1Dst", 6}, {"m1Amt", 0.5}}, 1.0, 1.0);
  std::snprintf(msg, sizeof msg, "matrice MOD WHEEL -> NOISE 50 %% : ecart %.3f (0.5)", c.noiseMax);
  check(std::fabs(c.noiseMax - 0.5) < 0.02, msg);
  // Lire modView ne change rien au son : deux rendus identiques au bit pres
  const Run a2 = run(lfo, 2.0);
  bool same = a.L.size() == a2.L.size();
  for (size_t i = 0; same && i < a.L.size(); ++i) same = a.L[i] == a2.L[i];
  check(same, "le rendu est le meme au bit pres (ModView n'est qu'une lecture)");
  std::printf("%s (%d echec%s)\n", fails ? "ECHEC" : "OK", fails, fails > 1 ? "s" : "");
  return fails ? 1 : 0;
}
