// MM-ARP, ce que la face montre des modulations (Voyager::modView, l'arc lumineux autour des potards, 2026-11-16) :
// un LFO sur CUTOFF fait bouger l'ecart de la coupure, profondeur 0 le ramene a 0 ; LFO 2 sur RES, une ligne de la
// matrice (MOD WHEEL -> NOISE) ; et le son ne change pas (ModView n'est qu'une lecture). v52 : l'ecran des enveloppes
// (Voyager::egView).
//   ./mmarp_modview_test
#include "Voyager.h"

#include <algorithm>
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

// v52 : l'ecran des enveloppes de la face (Voyager::egView) : la voix la plus recente, ses deux enveloppes a la fin de
// chaque bloc, comparees aux lois que la face dessine (plugin/arp/egScreen.ts : attaque vers 1.3 en A / 1.466,
// decroissance en D / 4.6, relachement en R / 4.6) ; une note plus recente prend l'ecran ; la voix tue, plus rien ; lire
// egView ne change rien au son.
static double egLaw(double t, double A, double D, double S, double R, double g) {
  const double ta = A / 1.466, td = D / 4.6, tr = R / 4.6;
  const double t1 = ta * std::log(1.3 / 0.3);  // le haut de l'attaque (1)
  const auto held = [&](double x) { return x < t1 ? 1.3 * (1 - std::exp(-x / ta)) : S + (1 - S) * std::exp(-(x - t1) / td); };
  return t < g ? held(t) : held(g) * std::exp(-(t - g) / tr);
}

static std::vector<float> egRun(bool look, double* worst, int* bad, bool* sawNew, bool* sawOff) {
  VoyagerOptions o;
  o.sampleRate = 48000;
  o.os = 4;
  // drift 0 : la vitesse des enveloppes de chaque voix est exacte (vEnv = 1) ; accFlt 0 : l'accent ne touche pas au filtre
  const double fA = 0.02, fD = 0.1, fS = 0.3, fR = 0.15, aA = 0.005, aD = 0.2, aS = 0.6, aR = 0.25;
  Voyager v(o, {{"fA", fA}, {"fD", fD}, {"fS", fS}, {"fR", fR}, {"aA", aA}, {"aD", aD}, {"aS", aS}, {"aR", aR}, {"drift", 0}, {"accFlt", 0}});
  const double t0 = 480.0 / 48000, gate = 0.3, t1 = t0 + 1.5;
  v.note(t0, 57, gate, 1, std::nan(""));
  v.note(t1, 60, gate, 1, std::nan(""));
  const int B = 128, frames = 48000 * 3;
  std::vector<float> L(static_cast<size_t>(frames)), R(static_cast<size_t>(frames));
  *worst = 0;
  *bad = 0;
  *sawNew = *sawOff = false;
  bool off = false;
  for (int f = 0; f < frames; f += B) {
    v.process(L.data() + f, R.data() + f, B);
    if (!look) continue;
    const EgView e = v.egView();
    const double now = (f + B) / 48000.0;
    const bool second = now >= t1;
    const double t = now - (second ? t1 : t0);
    if (!e.on) {
      if (now > t0 + 0.05 && !second) off = true;
      continue;
    }
    if (second && std::fabs(e.tOn - t) < 1e-9) *sawNew = true;
    if (std::fabs(e.tOn - t) > 1e-9 || std::fabs(e.tOff - gate) > 1e-9) ++*bad;
    // l'etape : la decroissance des que l'attaque touche 1, le relachement au bout du gate (les deux ensemble)
    if ((t >= gate) != (e.aStage == 3) || (t >= gate) != (e.fStage == 3)) ++*bad;
    const double ef = std::fabs(e.fV - egLaw(t, fA, fD, fS, fR, gate));
    const double ea = std::fabs(e.aV - egLaw(t, aA, aD, aS, aR, gate));
    *worst = std::max(*worst, std::max(ef, ea));
  }
  *sawOff = off;
  return L;
}

static void egTest() {
  double worst = 0;
  int bad = 0;
  bool sawNew = false, sawOff = false;
  const std::vector<float> a = egRun(true, &worst, &bad, &sawNew, &sawOff);
  char msg[240];
  std::snprintf(msg, sizeof msg, "egView : niveaux = les lois de la face a %.2g pres (< 0.002), %d ecart(s) de temps ou d'etape", worst, bad);
  check(worst < 0.002 && bad == 0, msg);
  check(sawOff, "egView : la voix tue (relachement fini), plus rien a montrer (on = false)");
  check(sawNew, "egView : une note plus recente prend l'ecran (son temps repart de 0)");
  double w2 = 0;
  int b2 = 0;
  bool n2 = false, o2 = false;
  const std::vector<float> b = egRun(false, &w2, &b2, &n2, &o2);
  bool same = a.size() == b.size();
  for (size_t i = 0; same && i < a.size(); ++i) same = a[i] == b[i];
  check(same, "le rendu est le meme au bit pres (egView n'est qu'une lecture)");
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
  egTest();
  std::printf("%s (%d echec%s)\n", fails ? "ECHEC" : "OK", fails, fails > 1 ? "s" : "");
  return fails ? 1 : 0;
}
