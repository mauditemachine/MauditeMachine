// Compare le moteur C++ (dsp/Voyager.cpp) au vrai worklet du site, rendu par tests/voyager-ref.mjs.
//   voyager_compare <dossier-ref>          tous les cas : une ligne par cas, code de sortie 1 si un cas depasse -100 dB
//   voyager_compare <dossier-ref> --cpu    le cout CPU (1, 4, 12 voix tenues, x4, STACK 3 + WIDE + GLUE, 48 kHz)
//   voyager_compare <dossier-ref> --blocks des blocs de 1 a 4096 (le plugin) et une note a gate infini
// Rendu par blocs de 128, les messages de la timeline livres a la frontiere de bloc comme le fait le worklet
// (process : "while (tl[0].at * sampleRate <= currentFrame) onMsg", avant le calcul du bloc). Aucun son : des tableaux.
#include <chrono>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <sstream>
#include <string>
#include <vector>

#include "../dsp/Voyager.h"

namespace mmarp {
namespace detail {
const double* voyagerTable(int which, int* n);
}
}  // namespace mmarp

namespace {

constexpr double SR = 48000;
constexpr int BLOCK = 128;

struct Msg {
  double at;
  std::string type;
  std::vector<std::pair<std::string, double>> params;
  double a = NAN, b = NAN, c = NAN, d = NAN, e = NAN;
};
struct Case {
  int n = 0;
  std::string name;
  int os = 4, voices = 12, stack = 3, wide = 8;
  uint32_t seed = 808;
  long frames = 0;
  std::vector<std::pair<std::string, double>> params;
  std::vector<std::vector<double>> notes, beats;
  std::vector<Msg> msgs;
};

double num(const std::string& s) { return std::strtod(s.c_str(), nullptr); }

std::vector<Case> readCases(const std::string& path) {
  std::ifstream f(path);
  if (!f) {
    std::fprintf(stderr, "introuvable : %s\n", path.c_str());
    std::exit(2);
  }
  std::vector<Case> out;
  std::string line;
  Case cur;
  while (std::getline(f, line)) {
    std::istringstream is(line);
    std::string tag;
    is >> tag;
    if (tag == "case") {
      cur = Case();
      is >> cur.n >> cur.name;
    } else if (tag == "opt") {
      std::string s[6];
      for (auto& x : s) is >> x;
      cur.os = std::atoi(s[0].c_str());
      cur.voices = std::atoi(s[1].c_str());
      cur.stack = std::atoi(s[2].c_str());
      cur.wide = std::atoi(s[3].c_str());
      cur.seed = static_cast<uint32_t>(std::strtoul(s[4].c_str(), nullptr, 10));
      cur.frames = std::atol(s[5].c_str());
    } else if (tag == "param") {
      std::string k, v;
      is >> k >> v;
      cur.params.push_back({k, num(v)});
    } else if (tag == "note" || tag == "beat") {
      std::vector<double> v;
      std::string x;
      while (is >> x) v.push_back(num(x));
      (tag == "note" ? cur.notes : cur.beats).push_back(v);
    } else if (tag == "msg") {
      Msg m;
      std::string at;
      is >> at >> m.type;
      m.at = num(at);
      if (m.type == "params") {
        int cnt = 0;
        is >> cnt;
        for (int i = 0; i < cnt; i += 1) {
          std::string k, v;
          is >> k >> v;
          m.params.push_back({k, num(v)});
        }
      } else {
        std::string x;
        double* slot[5] = {&m.a, &m.b, &m.c, &m.d, &m.e};
        int i = 0;
        while (i < 5 && is >> x) *slot[i++] = num(x);
      }
      cur.msgs.push_back(m);
    } else if (tag == "end") {
      out.push_back(cur);
    }
  }
  return out;
}

void apply(mmarp::Voyager& v, const Msg& m) {
  if (m.type == "params")
    v.params(m.params);
  else if (m.type == "note")
    v.note(m.a, m.b, m.c, m.d, m.e);
  else if (m.type == "beat")
    v.beat(m.a, m.b, m.c, m.d == 1);
  else if (m.type == "noteOff")
    v.noteOff(m.a, m.b);
  else if (m.type == "stop")
    v.stop(m.a);
  else if (m.type == "cancel")
    v.cancel(m.a);
}

void render(const Case& c, std::vector<float>& L, std::vector<float>& R, int* heals, int* maxV) {
  mmarp::VoyagerOptions o;
  o.sampleRate = SR;
  o.os = c.os;
  o.maxVoices = c.voices;
  o.maxStack = c.stack;
  o.wideVoices = c.wide;
  o.seed = c.seed;
  mmarp::Voyager v(o, c.params);
  for (const auto& n : c.notes) v.note(n[0], n[1], n[2], n[3], n[4]);
  for (const auto& b : c.beats) v.beat(b[0], b[1], b[2], b[3] == 1);
  L.assign(c.frames, 0.0f);
  R.assign(c.frames, 0.0f);
  size_t mi = 0;
  *maxV = 0;
  for (long f = 0; f < c.frames; f += BLOCK) {
    while (mi < c.msgs.size() && c.msgs[mi].at * SR <= static_cast<double>(f)) apply(v, c.msgs[mi++]);
    v.process(L.data() + f, R.data() + f, BLOCK);
    if (v.activeVoices() > *maxV) *maxV = v.activeVoices();
  }
  *heals = v.heals();
}

bool readF32(const std::string& path, std::vector<float>& buf) {
  std::ifstream f(path, std::ios::binary | std::ios::ate);
  if (!f) return false;
  const auto sz = f.tellg();
  buf.resize(static_cast<size_t>(sz) / 4);
  f.seekg(0);
  f.read(reinterpret_cast<char*>(buf.data()), sz);
  return true;
}

/** Les tables du module : identiques au bit pres a celles du JS ? */
void checkTables(const std::string& dir) {
  std::ifstream f(dir + "/tables.f64", std::ios::binary | std::ios::ate);
  if (!f) return;
  const auto sz = f.tellg();
  std::vector<double> js(static_cast<size_t>(sz) / 8);
  f.seekg(0);
  f.read(reinterpret_cast<char*>(js.data()), sz);
  const char* names[6] = {"LNC", "K35_T", "K35_S", "demi-bande 31", "demi-bande 63", "MS_SO/OD_TANH_BIAS"};
  size_t o = 0;
  for (int w = 0; w < 6; w += 1) {
    int n = 0;
    const double* t = mmarp::detail::voyagerTable(w, &n);
    int diff = 0;
    double worst = 0;
    for (int i = 0; i < n && o + i < js.size(); i += 1)
      if (t[i] != js[o + i]) {
        diff += 1;
        const double r = std::fabs(t[i] - js[o + i]) / std::fmax(1e-300, std::fabs(js[o + i]));
        if (r > worst) worst = r;
      }
    std::printf("table %-20s %6d valeurs, %s", names[w], n, diff ? "" : "identiques au bit pres\n");
    if (diff) std::printf("%d differentes (ecart relatif max %.3g)\n", diff, worst);
    o += n;
  }
}

/** La libm du C++ contre celle de V8 (Math.*) sur les entrees de voyager-ref.mjs. */
void checkMath(const std::string& dir) {
  std::ifstream f(dir + "/mathprobe.f64", std::ios::binary | std::ios::ate);
  if (!f) return;
  const auto sz = f.tellg();
  std::vector<double> r(static_cast<size_t>(sz) / 8);
  f.seekg(0);
  f.read(reinterpret_cast<char*>(r.data()), sz);
  const char* names[7] = {"sin", "cos", "tan", "exp", "log", "pow", "tanh"};
  int tot[7] = {0}, bad[7] = {0};
  for (size_t i = 0; i + 3 < r.size(); i += 4) {
    const int fn = static_cast<int>(r[i]);
    const double x = r[i + 1], y = r[i + 2], js = r[i + 3];
    double c = 0;
    switch (fn) {
      case 0: c = std::sin(x); break;
      case 1: c = std::cos(x); break;
      case 2: c = std::tan(x); break;
      case 3: c = std::exp(x); break;
      case 4: c = std::log(x); break;
      case 5: c = std::pow(x, y); break;
      default: c = std::tanh(x); break;
    }
    tot[fn] += 1;
    if (c != js) bad[fn] += 1;
  }
  std::printf("libm du systeme contre V8 (pour info, le moteur utilise le fdlibm de V8) :");
  for (int k = 0; k < 7; k += 1) std::printf(" %s %d/%d", names[k], bad[k], tot[k]);
  std::printf(" (resultats differents d'1 ulp)\n");
}

int cpu(const std::vector<Case>& cases) {
  const Case* base = nullptr;
  for (const auto& c : cases)
    if (c.name == "CPU_STACK_WIDE_GLUE") base = &c;
  if (!base) {
    std::fprintf(stderr, "cas CPU_STACK_WIDE_GLUE absent de cases.txt\n");
    return 2;
  }
  std::printf("calcul C++, x4, 48 kHz, 12 voix au plus, STACK 3 + WIDE + GLUE (stack 0.5, wide 0.6, glue 0.5), notes tenues, blocs de 128\n");
  for (int nv : {1, 4, 12}) {
    double best = 1e30;
    for (int rep = 0; rep < 3; rep += 1) {
      mmarp::VoyagerOptions o;
      o.os = 4;
      o.maxVoices = 12;
      o.maxStack = 3;
      o.wideVoices = 12;
      mmarp::Voyager v(o, base->params);
      v.params({{"aS", 1}});
      for (int i = 0; i < nv; i += 1) v.note(0, 54 + 3 * i, 100, 1, NAN);
      const int blocks = static_cast<int>(10 * SR / BLOCK);
      float L[BLOCK], R[BLOCK];
      const auto t0 = std::chrono::steady_clock::now();
      for (int b = 0; b < blocks; b += 1) v.process(L, R, BLOCK);
      const double s = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
      if (s < best) best = s;
      if (v.activeVoices() != nv) std::printf("  (attention : %d voix allumees)\n", v.activeVoices());
    }
    const double us = best / (10 * SR / BLOCK) * 1e6;
    std::printf("  %2d voix : %7.1f us par bloc de 128 (temps reel 2666.7 us) : %5.2f %% d'un coeur, %6.1fx plus vite que le temps reel\n", nv, us, 100 * us / 2666.6667, 2666.6667 / us);
  }
  return 0;
}

/**
 * --blocks : le plugin appelle process avec n de 1 a 4096 (le dernier morceau d'un bloc d'hote). Le son n'y est pas
 * identique au bit pres a celui des blocs de 128 (DRIFT, le silence et les messages vivent au rythme des blocs, comme
 * dans le JS), mais il doit rester fini, sans garde declenchee, a la meme sonie ; et une note a gate infini tient
 * jusqu'a son noteOff.
 */
int blocks(const std::vector<Case>& cases) {
  int bad = 0;
  uint32_t s = 1;
  auto rnd = [&s]() { s = s * 1664525u + 1013904223u; return s >> 8; };
  for (const auto& c : cases) {
    if (c.name != "INIT" && c.name != "STACK_WIDE_GLUE" && c.name != "HELD_NOTE_OFF" && c.name != "OS2_MS10_SCREAM" && c.name != "LIVE_NOTES") continue;
    std::vector<float> L0, R0;
    int h0 = 0, m0 = 0;
    render(c, L0, R0, &h0, &m0);
    mmarp::VoyagerOptions o;
    o.os = c.os;
    o.maxVoices = c.voices;
    o.maxStack = c.stack;
    o.wideVoices = c.wide;
    o.seed = c.seed;
    mmarp::Voyager v(o, c.params);
    for (const auto& n : c.notes) v.note(n[0], n[1], n[2], n[3], n[4]);
    for (const auto& b : c.beats) v.beat(b[0], b[1], b[2], b[3] == 1);
    std::vector<float> L(c.frames), R(c.frames);
    size_t mi = 0;
    long f = 0;
    int nb = 0;
    while (f < c.frames) {
      const unsigned r = rnd() % 10;
      int n = r < 3 ? 1 + static_cast<int>(rnd() % 127) : r < 6 ? 128 : r < 8 ? 1 + static_cast<int>(rnd() % 16) : 1 + static_cast<int>(rnd() % 4096);
      if (f + n > c.frames) n = static_cast<int>(c.frames - f);
      while (mi < c.msgs.size() && c.msgs[mi].at * SR <= static_cast<double>(f)) apply(v, c.msgs[mi++]);
      v.process(L.data() + f, R.data() + f, n);
      f += n;
      nb += 1;
    }
    double e0 = 0, e1 = 0;
    bool fin = true;
    for (long i = 0; i < c.frames; i += 1) {
      e0 += static_cast<double>(L0[i]) * L0[i] + static_cast<double>(R0[i]) * R0[i];
      e1 += static_cast<double>(L[i]) * L[i] + static_cast<double>(R[i]) * R[i];
      if (!std::isfinite(L[i]) || !std::isfinite(R[i])) fin = false;
    }
    const double dDb = 10 * std::log10(e1 / e0);
    const bool ok = fin && v.heals() == 0 && std::fabs(dDb) < 0.5 && v.currentFrame() == c.frames;
    if (!ok) bad += 1;
    std::printf("%-20s %6d blocs de 1 a 4096 : %s, heals %d, sonie %+.3f dB contre les blocs de 128 %s\n", c.name.c_str(), nb, fin ? "fini" : "NON FINI", v.heals(), dDb, ok ? "ok" : "** ECHEC **");
  }
  // Une note sans fin (gate +inf) : elle tient, puis s'eteint apres son noteOff (aucun entier qui deborde)
  {
    mmarp::VoyagerOptions o;
    mmarp::Voyager v(o, cases.front().params);
    v.note(0.01, 57, INFINITY, 1, NAN);
    float L[4096], R[4096];
    for (int i = 0; i < 300; i += 1) v.process(L, R, 37);           // 0.23 s
    const int on1 = v.activeVoices();
    for (int i = 0; i < 2000; i += 1) v.process(L, R, 4096);          // 170 s de plus : elle tient
    const int on2 = v.activeVoices();
    v.noteOff(57, NAN);
    for (int i = 0; i < 20; i += 1) v.process(L, R, 4096);            // le relachement
    const int on3 = v.activeVoices();
    const bool ok = on1 == 1 && on2 == 1 && on3 == 0 && v.heals() == 0;
    if (!ok) bad += 1;
    std::printf("gate infini : allumee a 0.2 s %d, a 171 s %d, apres noteOff %d %s\n", on1, on2, on3, ok ? "ok" : "** ECHEC **");
  }
  return bad ? 1 : 0;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage : %s <dossier-ref> [--cpu]\n", argv[0]);
    return 2;
  }
  const std::string dir = argv[1];
  const auto cases = readCases(dir + "/cases.txt");
  if (argc > 2 && std::strcmp(argv[2], "--cpu") == 0) return cpu(cases);
  if (argc > 2 && std::strcmp(argv[2], "--blocks") == 0) return blocks(cases);
  checkTables(dir);
  checkMath(dir);
  int fails = 0, exact = 0;
  double worstDb = -400;
  std::printf("%-3s %-22s %8s %9s %12s %9s %s\n", "n", "cas", "frames", "crete", "identiques", "ecart", "");
  for (const auto& c : cases) {
    std::vector<float> ref;
    if (!readF32(dir + "/" + std::to_string(c.n) + ".f32", ref) || static_cast<long>(ref.size()) != 2 * c.frames) {
      std::printf("%-3d %-22s rendu de reference absent ou de mauvaise taille\n", c.n, c.name.c_str());
      fails += 1;
      continue;
    }
    std::vector<float> L, R;
    int heals = 0, maxV = 0;
    render(c, L, R, &heals, &maxV);
    double peak = 0, maxd = 0;
    long same = 0, firstDiff = -1;
    for (long i = 0; i < c.frames; i += 1) {
      const float a[2] = {L[i], R[i]};
      const float b[2] = {ref[i], ref[c.frames + i]};
      for (int ch = 0; ch < 2; ch += 1) {
        peak = std::fmax(peak, std::fabs(static_cast<double>(b[ch])));
        const double d = std::fabs(static_cast<double>(a[ch]) - b[ch]);
        if (std::memcmp(&a[ch], &b[ch], 4) == 0)
          same += 1;
        else if (firstDiff < 0)
          firstDiff = i;
        if (!(d <= maxd)) maxd = d;  // un NaN compte comme le pire
      }
    }
    const double rel = maxd > 0 ? 20 * std::log10(maxd / std::fmax(peak, 1e-30)) : -INFINITY;
    const bool bitexact = same == 2 * c.frames;
    if (bitexact) exact += 1;
    const bool fail = !(maxd == 0 || rel <= -100);
    if (fail) fails += 1;
    if (maxd > 0 && rel > worstDb) worstDb = rel;
    char ecart[64];
    if (bitexact)
      std::snprintf(ecart, sizeof ecart, "bit a bit");
    else
      std::snprintf(ecart, sizeof ecart, "%.1f dB (1er ecart frame %ld)", rel, firstDiff);
    std::printf("%-3d %-22s %8ld %6.2f dB %11.4f%% %s%s  voix %d heals %d\n", c.n, c.name.c_str(), c.frames, 20 * std::log10(std::fmax(peak, 1e-12)),
                100.0 * same / (2.0 * c.frames), ecart, fail ? "  ** AU-DESSUS DE -100 dB **" : "", maxV, heals);
  }
  std::printf("\n%zu cas : %d identiques au bit pres, %d au-dessus de -100 dB", cases.size(), exact, fails);
  if (worstDb > -400) std::printf(", pire ecart %.1f dB sous la crete", -worstDb);
  std::printf("\n");
  return fails ? 1 : 0;
}
