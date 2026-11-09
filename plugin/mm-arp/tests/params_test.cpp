// Les potards du MM-ARP en C++ (dsp/Params.cpp) contre le vrai JS du site (tests/params-ref.mjs) :
//   node plugin/mm-arp/tests/params-ref.mjs build-dsp/ref-params && ./build-dsp/mmarp_params_test build-dsp/ref-params
// Compare la table (kKnobDefs : la sortie de params-gen.mjs, relue ici contre le module), engineParams + outLevel au bit
// pres, les reglages de la chaine, l'arpege (spn, gate, accent, drift, prog, chaque accord en midi), voyValueText et
// voyReadout (knobText, knobReadout) et clean (knobClean). Verifie aussi qu'engineParams, fxSettings et arpProgram
// n'allouent rien apres reserveArp (operator new compte). Sortie 0 : tout est identique.
#include "Params.h"

#include <atomic>
#include <cmath>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <new>
#include <sstream>
#include <string>
#include <vector>

/* ---- les allocations, comptees (le chemin temps reel n'en fait aucune) ---- */
static std::atomic<long> gAllocs{0};
void* operator new(std::size_t n) {
  gAllocs.fetch_add(1, std::memory_order_relaxed);
  if (void* p = std::malloc(n ? n : 1)) return p;
  throw std::bad_alloc();
}
void* operator new[](std::size_t n) {
  gAllocs.fetch_add(1, std::memory_order_relaxed);
  if (void* p = std::malloc(n ? n : 1)) return p;
  throw std::bad_alloc();
}
void operator delete(void* p) noexcept { std::free(p); }
void operator delete[](void* p) noexcept { std::free(p); }
void operator delete(void* p, std::size_t) noexcept { std::free(p); }
void operator delete[](void* p, std::size_t) noexcept { std::free(p); }

namespace {

using namespace mmarp;

int fails = 0;
int shown = 0;
void fail(int cas, const std::string& what) {
  ++fails;
  if (shown < 40) {
    ++shown;
    std::fprintf(stderr, "cas %d : %s\n", cas, what.c_str());
  }
}

std::vector<std::string> split(const std::string& s, char sep) {
  std::vector<std::string> out;
  size_t a = 0;
  for (;;) {
    const size_t b = s.find(sep, a);
    out.push_back(s.substr(a, b == std::string::npos ? std::string::npos : b - a));
    if (b == std::string::npos) break;
    a = b + 1;
  }
  return out;
}

double num(const std::string& s) { return s == "null" ? std::nan("") : std::strtod(s.c_str(), nullptr); }

bool same(double a, double b) { return (a != a && b != b) || std::memcmp(&a, &b, sizeof a) == 0; }

std::string g17(double x) {
  char b[64];
  std::snprintf(b, sizeof b, "%.17g", x);
  return b;
}

}  // namespace

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage : %s <dossier de params-ref.mjs>\n", argv[0]);
    return 2;
  }
  std::ifstream in(std::string(argv[1]) + "/params-cases.txt");
  if (!in) {
    std::fprintf(stderr, "params-cases.txt introuvable dans %s\n", argv[1]);
    return 2;
  }
  std::string line;

  /* ---- la table ---- */
  std::getline(in, line);
  const int nk = std::atoi(line.c_str() + 2);
  if (nk != kKnobs) fail(-1, "le site a " + std::to_string(nk) + " potards, le C++ " + std::to_string(kKnobs) + " (relancer params-gen.mjs)");
  for (int i = 0; i < nk; ++i) {
    std::getline(in, line);
    const auto f = split(line, '\t');
    if (i >= kKnobs || f.size() < 8) continue;
    const KnobDef& d = kKnobDefs[i];
    std::string steps;
    for (int j = 0; j < d.nSteps; ++j) steps += (j ? "|" : "") + std::string(d.steps[j]);
    if (f[1] != d.id || f[2] != d.label || f[3] != d.section || !same(num(f[4]), d.def) || !same(num(f[5]), d.legacy) ||
        (f[6] == "1") != d.morph || f[7] != steps)
      fail(-1, "kKnobDefs[" + std::to_string(i) + "] (" + f[1] + ") differe du site (relancer params-gen.mjs)");
    if (knobIndex(f[1].c_str()) != i) fail(-1, "knobIndex(" + f[1] + ")");
  }
  if (knobIndex("nope") != -1 || knobIndex(nullptr) != -1) fail(-1, "knobIndex d'un id inconnu");
  std::getline(in, line);
  const int nCases = std::atoi(line.c_str() + 2);

  ArpProgram prog;
  reserveArp(prog);
  ParamKV kv[64];
  long allocs = 0, clamped = 0, engineVals = 0, notes = 0, texts = 0, randChords = 0, editChords = 0;
  int cases = 0;
  for (int cas = 0; cas < nCases; ++cas) {
    double knobs[kKnobs];
    double clean[kKnobs];
    SeqStateC seq;
    int pr[16];
    int npr = 0;
    std::vector<std::pair<std::string, double>> eng;
    double fx[7] = {0};
    double ar[4] = {0};
    int nch = 0;
    struct JC {
      int c, rand;
      std::vector<int> midi;  // kRest : silence
    };
    std::vector<JC> jch;
    std::vector<std::pair<std::string, std::string>> tx;
    // K Q S P E F A C* X*
    while (std::getline(in, line)) {
      if (line.empty()) continue;
      const char tag = line[0];
      if (tag == 'X') {
        const auto f = split(line, '\t');
        tx.emplace_back(f.size() > 1 ? f[1] : "", f.size() > 2 ? f[2] : "");
        if (static_cast<int>(tx.size()) == nk) break;
        continue;
      }
      std::istringstream ss(line.substr(2));
      if (tag == 'K' || tag == 'Q') {
        double* dst = tag == 'K' ? knobs : clean;
        for (int i = 0; i < kKnobs; ++i) {
          std::string t;
          ss >> t;
          dst[i] = num(t);
        }
      } else if (tag == 'S') {
        int e = 0;
        ss >> e >> seq.len;
        seq.edit = e != 0;
        for (int i = 0; i < 16; ++i) {
          std::string t;
          ss >> t;
          seq.buf[i] = t == "R" ? kSeqRest : std::atoi(t.c_str());
        }
      } else if (tag == 'P') {
        ss >> npr;
        for (int i = 0; i < npr; ++i) ss >> pr[i];
      } else if (tag == 'E') {
        int n = 0;
        ss >> n;
        for (int i = 0; i < n; ++i) {
          std::string k, v;
          ss >> k >> v;
          eng.emplace_back(k, num(v));
        }
      } else if (tag == 'F') {
        for (double& x : fx) {
          std::string t;
          ss >> t;
          x = num(t);
        }
      } else if (tag == 'A') {
        for (double& x : ar) {
          std::string t;
          ss >> t;
          x = num(t);
        }
        ss >> nch;
      } else if (tag == 'C') {
        JC c;
        int n = 0;
        ss >> c.c >> c.rand >> n;
        for (int i = 0; i < n; ++i) {
          std::string t;
          ss >> t;
          if (t == "R") c.midi.push_back(kRest);
          else {
            const int m = std::atoi(t.c_str());
            const int mc = m < 0 ? 0 : m > 127 ? 127 : m;  // parseProgram bornait deja a 0..127
            if (mc != m) ++clamped;
            c.midi.push_back(mc);
          }
        }
        jch.push_back(std::move(c));
      }
    }
    if (static_cast<int>(tx.size()) != nk) {
      fail(cas, "fichier tronque");
      break;
    }
    ++cases;

    /* ---- le chemin temps reel, sans allocation ---- */
    const long a0 = gAllocs.load();
    const int n = engineParams(knobs, kv, 64);
    ArpFxSettings fs;
    double dly16 = -1;
    fxSettings(knobs, fs, dly16);
    arpProgram(knobs, seq, pr, npr, prog);
    allocs += gAllocs.load() - a0;

    // engineParams + outLevel
    if (n != static_cast<int>(eng.size())) fail(cas, "engineParams : " + std::to_string(n) + " cles, le site " + std::to_string(eng.size()));
    for (int j = 0; j < n && j < static_cast<int>(eng.size()); ++j) {
      const char* name = Voyager::paramName(kv[j].id);
      if (eng[static_cast<size_t>(j)].first != name) fail(cas, std::string("engineParams : cle ") + name + " au lieu de " + eng[static_cast<size_t>(j)].first);
      else if (!same(kv[j].value, eng[static_cast<size_t>(j)].second))
        fail(cas, std::string("engineParams ") + name + " = " + g17(kv[j].value) + ", le site " + g17(eng[static_cast<size_t>(j)].second));
      ++engineVals;
    }
    // la chaine
    const double cfx[7] = {static_cast<double>(fs.chorus), fs.delay, fs.reverb, fs.tape, fs.monoLowHz, fs.volume, dly16};
    static const char* const fxn[7] = {"chorus", "delay", "reverb", "tape", "monoLowHz", "volume", "dly16"};
    for (int j = 0; j < 7; ++j)
      if (!same(cfx[j], fx[j])) fail(cas, std::string("fxSettings ") + fxn[j] + " = " + g17(cfx[j]) + ", le site " + g17(fx[j]));
    // l'arpege
    const double car[4] = {prog.spn, prog.gate, prog.accent, prog.drift};
    static const char* const arn[4] = {"spn", "gate", "accent", "drift"};
    for (int j = 0; j < 4; ++j)
      if (!same(car[j], ar[j])) fail(cas, std::string("arpProgram ") + arn[j] + " = " + g17(car[j]) + ", le site " + g17(ar[j]));
    if (static_cast<int>(prog.prog.size()) != npr) fail(cas, "arpProgram : prog");
    else
      for (int j = 0; j < npr; ++j)
        if (prog.prog[static_cast<size_t>(j)] != pr[j]) fail(cas, "arpProgram : prog");
    if (prog.chords.size() != static_cast<size_t>(kArpChords)) fail(cas, "arpProgram : chords.size() != 8");
    for (int j = 0; j < static_cast<int>(prog.chords.size()); ++j) {
      const ArpChord& c = prog.chords[static_cast<size_t>(j)];
      if (j >= nch) {
        if (c.c != -1 || !c.midi.empty()) fail(cas, "arpProgram : accord inutilise " + std::to_string(j) + " pas vide");
        continue;
      }
      const JC& w = jch[static_cast<size_t>(j)];
      if (w.rand) ++randChords;
      else if (seq.edit) ++editChords;
      if (c.c != w.c || c.rand != (w.rand != 0) || c.midi != w.midi) {
        std::string a, b;
        for (int m : c.midi) a += " " + std::to_string(m);
        for (int m : w.midi) b += " " + std::to_string(m);
        fail(cas, "arpProgram : accord " + std::to_string(w.c) + " (rand " + std::to_string(w.rand) + ") :" + a + " / le site :" + b);
      }
      notes += static_cast<long>(w.midi.size());
      if (prog.chord(w.c) != &c) fail(cas, "ArpProgram::chord");
    }
    // les textes et clean
    for (int i = 0; i < kKnobs; ++i) {
      char t[96], r[96];
      knobText(i, knobs[i], t, sizeof t);
      knobReadout(i, knobs[i], r, sizeof r);
      if (tx[static_cast<size_t>(i)].first != t) fail(cas, std::string(kKnobDefs[i].id) + " " + g17(knobs[i]) + " : knobText \"" + t + "\", le site \"" + tx[static_cast<size_t>(i)].first + "\"");
      if (tx[static_cast<size_t>(i)].second != r) fail(cas, std::string(kKnobDefs[i].id) + " " + g17(knobs[i]) + " : knobReadout \"" + r + "\", le site \"" + tx[static_cast<size_t>(i)].second + "\"");
      texts += 2;
      const double q = knobClean(i, knobs[i]);
      if (!same(q, clean[i])) fail(cas, std::string(kKnobDefs[i].id) + " " + g17(knobs[i]) + " : knobClean " + g17(q) + ", le site " + g17(clean[i]));
    }
  }
  if (allocs != 0) fail(-1, "le chemin temps reel a alloue " + std::to_string(allocs) + " fois");
  // texte tronque proprement
  {
    char t[4];
    knobReadout(kn_cutoff, 0.5, t, sizeof t);
    if (std::strcmp(t, "CUT") != 0) fail(-1, std::string("troncature : \"") + t + "\"");
  }
  std::printf("params_test : %d cas (%d potards), %ld valeurs du moteur au bit pres, %ld notes midi (%ld accords RAND, %ld EDIT ; %ld bornees a 0..127), %ld textes ; %ld allocations temps reel ; %d ecarts\n",
              cases, kKnobs, engineVals, notes, randChords, editChords, clamped, texts, allocs, fails);
  return fails == 0 && cases == nCases ? 0 : 1;
}
