// MM-ARP : le rendu hors ligne de la banque d'usine du VST3 (plugin/mm-arp/presets/factory.json), avec le vrai moteur
// du plugin (dsp/ : Voyager, ArpFx, Arp, Params), jamais un son : tout se mesure dans des buffers (2026-11-10, revu le
// 2026-11-11 pour les 37 reglages du VST3 seul et le sequenceur par pas).
//
// Chaque preset joue comme dans le plugin (src/PluginProcessor.cpp update / applySteps / processBlock) :
// - les 62 potards arrondis (knobClean), engineParams + le bpm + les 13 cles du VST3 seul (xl1Dest, xl1Amt, l2Beats,
//   l2Shape, l2Dest, l2Amt, xRing, xFold, xNoiseCol, xUnison 0 / 5 / 7, xHpf = 20 x 100^v Hz ou 0, xComb,
//   xCombFb = 2 v - 1) ;
// - la chaine (fxSettings + master + reverb SIZE / TONE / PRE + le rack : phMix..shimmer, flFb = 2 v - 1, pumpRate et
//   dlyMode en crans), fx.setTransport(ppq, pps, playing) avant chaque process (PUMP suit la position) ;
// - l'arpege (arpProgram : la suite EDIT ou AUTO, la progression), puis les pistes par pas du preset (steps : acc,
//   slide, gate, rat, prob) et le swing propre (xSwing) poses sur l'ArpProgram, le sink qui surcharge noteGlide (SLIDE) ;
// - cale sur le transport depuis ppq 0, le moteur par blocs de 128. 8 mesures a son bpm, puis 3 s de queue (le WAV).
//
// Mesures (sur les 8 mesures) : crete (dBFS), sonie RMS (stereo, dBFS, mesures 2 a 8), sonie ponderee K (LUFS sans
// porte : la cible, -23, les TEXTURE -25), centroide spectral (Hz), largeur stereo (cote / milieu, %), part des basses
// (< 150 Hz, %), densite de notes (par mesure), NaN / infini.
//
// Descripteurs de caractere (le controle de diversite, 2026-11-11, Mika : "encore un peu trop similaires") :
//   ENV    l'enveloppe d'amplitude moyenne d'une note : la puissance alignee sur chaque attaque, 8 tranches (0-5, 5-10,
//          10-20, 20-40, 40-80, 80-160, 160-320, 320-640 ms), en dB sous sa plus forte (borne -30)
//   CRETE  le facteur de crete (crete - RMS, dB)
//   CLENT  la modulation lente du centroide : l'ecart type du centroide moyen de chaque temps (octaves)
//   CVITE  sa variation de note a note : l'ecart type moyen du centroide dans un temps (octaves)
//   DENS   les attaques par mesure (repetitions de RATCHET comprises)
//   IRREG  la regularite : le coefficient de variation des intervalles entre attaques (0 : une grille parfaite)
//   RYTHME l'histogramme des attaques sur les 32 triples croches de la mesure
//   REPET  la part du rythme d'une mesure reprise par la suivante (1 : la mesure se repete, moins : PROB, longueurs impaires)
//   BANDES la part d'energie de chaque octave (10 bandes de 22 Hz a 22 kHz, dB)
//   LARG   la largeur stereo (%)
//   MOTIF  le motif de notes (place x classe de hauteur)
// La distance entre deux presets : la racine de la somme des carres de chaque ecart, mesure dans son unite "nettement
// different" (kUnit) et borne a 3 ; D le tout, DS le son seul (bandes, centroide, enveloppe, crete, CLENT, CVITE,
// largeur : sans le motif ni le rythme). Aucun preset a moins de kMinD d'un autre, ni a moins de kMinDS par le son seul.
// Les 5 paires les plus proches sont imprimees.
//
// Construire et lancer : plugin/mm-arp/tests/presets-render.sh [dossier de build] [--os 8] [--wav <dossier>]
//   presets_render <factory.json> [--os 4|8] [--wav <dossier>] [--only <nom>] [--notes] [--calibrate <fichier>] [--jobs n]
//   --notes : imprime les notes des deux premieres mesures (double croche:note)
//   --os : le surechantillonnage du moteur (4 : celui du site, par defaut ; 8 : QUALITY HQ du preset)
//   --wav : ecrit un WAV float 32 bits par preset (NE PAS les lire pendant les tests : c'est pour Mika)
//   --calibrate : ecrit { "NOM": volume } , le VOLUME qui met chaque preset sur sa cible de sonie (presets/volumes.json,
//                 lu par presets/build.mjs)
// Code de sortie : 0 si tout passe (crete sous -1 dBFS et au-dessus de -20, sonie K a +/-0.7 LU de sa cible, sonie RMS
// a +/-4 dB de la mediane des presets hors TEXTURE ; les TEXTURE peuvent etre plus douces, jamais plus fortes ; aucun
// NaN ; aucune paire trop proche).
#include "Params.h"
#include "../src/ExtraParams.h"

#include <algorithm>
#include <cctype>
#include <cmath>
#include <complex>
#include <cstdio>
#include <cstdlib>
#include <cstring>
#include <fstream>
#include <map>
#include <memory>
#include <sstream>
#include <string>
#include <chrono>
#include <thread>
#include <atomic>
#include <vector>

using namespace mmarp;

/* ---------------- un petit lecteur JSON (objets, tableaux, nombres, chaines, true / false / null) ---------------- */

struct J {
  enum T { Null, Bool, Num, Str, Arr, Obj } t = Null;
  bool b = false;
  double n = 0;
  std::string s;
  std::vector<J> a;
  std::vector<std::pair<std::string, J>> o;
  const J* get(const std::string& k) const {
    for (const auto& kv : o)
      if (kv.first == k) return &kv.second;
    return nullptr;
  }
};

struct Reader {
  const std::string& x;
  size_t i = 0;
  explicit Reader(const std::string& s) : x(s) {}
  void ws() {
    while (i < x.size() && std::isspace(static_cast<unsigned char>(x[i]))) ++i;
  }
  [[noreturn]] void fail(const char* what) {
    std::fprintf(stderr, "JSON illisible (%s) a l'octet %zu\n", what, i);
    std::exit(2);
  }
  std::string str() {
    if (x[i] != '"') fail("chaine attendue");
    ++i;
    std::string out;
    while (i < x.size() && x[i] != '"') {
      if (x[i] == '\\') {
        ++i;
        const char c = x[i];
        if (c == 'n') out += '\n';
        else if (c == 't') out += '\t';
        else if (c == 'u') {
          out += '?';
          i += 4;
        } else out += c;
        ++i;
      } else out += x[i++];
    }
    ++i;
    return out;
  }
  J val() {
    ws();
    J v;
    if (i >= x.size()) fail("fin");
    const char c = x[i];
    if (c == '{') {
      v.t = J::Obj;
      ++i;
      ws();
      if (x[i] == '}') return ++i, v;
      for (;;) {
        ws();
        std::string k = str();
        ws();
        if (x[i++] != ':') fail("':' attendu");
        v.o.emplace_back(k, val());
        ws();
        if (x[i] == ',') ++i;
        else if (x[i] == '}') return ++i, v;
        else fail("',' ou '}' attendu");
      }
    }
    if (c == '[') {
      v.t = J::Arr;
      ++i;
      ws();
      if (x[i] == ']') return ++i, v;
      for (;;) {
        v.a.push_back(val());
        ws();
        if (x[i] == ',') ++i;
        else if (x[i] == ']') return ++i, v;
        else fail("',' ou ']' attendu");
      }
    }
    if (c == '"') {
      v.t = J::Str;
      v.s = str();
      return v;
    }
    if (x.compare(i, 4, "true") == 0) return i += 4, v.t = J::Bool, v.b = true, v;
    if (x.compare(i, 5, "false") == 0) return i += 5, v.t = J::Bool, v;
    if (x.compare(i, 4, "null") == 0) return i += 4, v;
    char* end = nullptr;
    v.n = std::strtod(x.c_str() + i, &end);
    if (end == x.c_str() + i) fail("valeur attendue");
    i = static_cast<size_t>(end - x.c_str());
    v.t = J::Num;
    return v;
  }
};

/* ---------------- le preset ---------------- */

struct Preset {
  std::string name, cat;
  double bpm = 120;
  double knobs[kKnobs];
  double extra[mmx::kExtra];
  SeqStateC seq;
  std::vector<int> prog;
  // les pistes par pas (src/v4/plugin/arp/steps.ts ; les valeurs de depart de MMArpProgram)
  uint8_t stAcc[16], stSlide[16], stGate[16], stRat[16], stProb[16];
  bool hasSteps = false;
};

Preset parsePreset(const J& p) {
  Preset out;
  out.name = p.get("name") ? p.get("name")->s : "?";
  out.cat = p.get("cat") ? p.get("cat")->s : "";
  out.bpm = p.get("bpm") ? p.get("bpm")->n : 120;
  for (int i = 0; i < kKnobs; ++i) out.knobs[i] = kKnobDefs[i].def;
  int seen = 0;
  if (const J* k = p.get("knobs"))
    for (const auto& kv : k->o) {
      const int i = knobIndex(kv.first.c_str());
      if (i < 0) {
        std::fprintf(stderr, "%s : potard inconnu %s\n", out.name.c_str(), kv.first.c_str());
        std::exit(2);
      }
      out.knobs[i] = knobClean(i, kv.second.n);
      ++seen;
    }
  if (seen != kKnobs) {
    std::fprintf(stderr, "%s : %d potards sur %d\n", out.name.c_str(), seen, kKnobs);
    std::exit(2);
  }
  for (int e = 0; e < mmx::kExtra; ++e) out.extra[e] = mmx::kExtraDefs[e].def;
  if (const J* x = p.get("extra"))
    for (const auto& kv : x->o) {
      const int i = mmx::allIndex(kv.first.c_str()) - kKnobs;
      if (i < 0 || i >= mmx::kExtra) {
        std::fprintf(stderr, "%s : reglage inconnu %s\n", out.name.c_str(), kv.first.c_str());
        std::exit(2);
      }
      out.extra[i] = std::min(1.0, std::max(0.0, kv.second.n));
    }
  if (const J* s = p.get("seq")) {
    out.seq.edit = s->get("edit") && s->get("edit")->b;
    out.seq.len = s->get("len") ? std::min(16, std::max(1, static_cast<int>(s->get("len")->n))) : 8;
    if (const J* b = s->get("buf"))
      for (int i = 0; i < 16 && i < static_cast<int>(b->a.size()); ++i)
        out.seq.buf[i] = b->a[static_cast<size_t>(i)].t == J::Num ? std::min(24, std::max(-7, static_cast<int>(b->a[static_cast<size_t>(i)].n))) : kSeqRest;
  }
  for (int i = 0; i < 16; ++i) out.stAcc[i] = 1, out.stSlide[i] = 0, out.stGate[i] = 1, out.stRat[i] = 1, out.stProb[i] = 100;
  if (const J* st = p.get("steps")) {
    out.hasSteps = true;
    auto lane = [&](const char* key, uint8_t* dst, int lo, int hi) {
      if (const J* a = st->get(key))
        for (int i = 0; i < 16 && i < static_cast<int>(a->a.size()); ++i)
          if (a->a[static_cast<size_t>(i)].t == J::Num) dst[i] = static_cast<uint8_t>(std::min(hi, std::max(lo, static_cast<int>(a->a[static_cast<size_t>(i)].n))));
    };
    lane("acc", out.stAcc, 0, 2);
    lane("slide", out.stSlide, 0, 1);
    lane("gate", out.stGate, 0, 3);
    lane("rat", out.stRat, 1, 4);
    lane("prob", out.stProb, 0, 100);
  }
  if (const J* pr = p.get("prog"))
    for (const auto& c : pr->a)
      if (c.t == J::Num && c.n >= 0 && c.n < 8 && out.prog.size() < 8) out.prog.push_back(static_cast<int>(c.n));
  return out;
}

/* ---------------- le rendu ---------------- */

struct NoteEv {
  double t;
  int midi;
};

struct Sink final : ArpSink {
  Voyager& v;
  std::vector<NoteEv>* notes;
  Sink(Voyager& voy, std::vector<NoteEv>* n) : v(voy), notes(n) {}
  void note(double t, int midi, double gate, double acc, double from) override {
    v.note(t, static_cast<double>(midi), gate, acc, from);
    notes->push_back({t, midi});
  }
  // SLIDE du sequenceur : comme VoySink du plugin
  void noteGlide(double t, int midi, double gate, double acc, double from, double glideSec) override {
    v.note(t, static_cast<double>(midi), gate, acc, from, glideSec);
    notes->push_back({t, midi});
  }
  void beat(double t, double b, double bpm, bool run) override { v.beat(t, b, bpm, run); }
  void cancel(double t) override { v.cancel(t); }
};

struct Render {
  std::vector<float> L, R;
  std::vector<NoteEv> notes;
  int64_t barsFrames = 0;
  double barFrames = 0;
};

constexpr double SR = 48000;
constexpr int kBars = 8;
constexpr double kTail = 3.0;

Render render(const Preset& p, int osWanted) {
  Render r;
  VoyagerOptions o;
  o.sampleRate = SR;
  o.os = osWanted == 8 ? (mmx::exStep(mmx::ex_xQuality, p.extra[mmx::ex_xQuality]) == 1 ? 8 : 4) : osWanted;
  o.seed = 808;
  Voyager v(o);
  // update() du plugin : les reglages du moteur, le tempo, le VST3 seul
  std::vector<ParamKV> kv(kEngineParams + 16);
  int n = engineParams(p.knobs, kv.data(), kEngineParams);
  auto id = [](const char* k) { return Voyager::paramIndex(k); };
  kv[static_cast<size_t>(n++)] = {id("bpm"), p.bpm};
  kv[static_cast<size_t>(n++)] = {id("xl1Dest"), static_cast<double>(mmx::exStep(mmx::ex_xLfo1Dest2, p.extra[mmx::ex_xLfo1Dest2]))};
  kv[static_cast<size_t>(n++)] = {id("xl1Amt"), p.extra[mmx::ex_xLfo1Depth2]};
  kv[static_cast<size_t>(n++)] = {id("l2Beats"), mmx::kExBeats_xLfo2Rate[mmx::exStep(mmx::ex_xLfo2Rate, p.extra[mmx::ex_xLfo2Rate])]};
  kv[static_cast<size_t>(n++)] = {id("l2Shape"), static_cast<double>(mmx::exStep(mmx::ex_xLfo2Shape, p.extra[mmx::ex_xLfo2Shape]))};
  kv[static_cast<size_t>(n++)] = {id("l2Dest"), static_cast<double>(mmx::exStep(mmx::ex_xLfo2Dest, p.extra[mmx::ex_xLfo2Dest]))};
  kv[static_cast<size_t>(n++)] = {id("l2Amt"), p.extra[mmx::ex_xLfo2Depth]};
  // OSC / FILTER + du module avant
  {
    const double hp = p.extra[mmx::ex_xHpf];
    static const double kUni[3] = {0, 5, 7};
    kv[static_cast<size_t>(n++)] = {id("xRing"), p.extra[mmx::ex_xRing]};
    kv[static_cast<size_t>(n++)] = {id("xFold"), p.extra[mmx::ex_xFold]};
    kv[static_cast<size_t>(n++)] = {id("xNoiseCol"), p.extra[mmx::ex_xNoiseColor]};
    kv[static_cast<size_t>(n++)] = {id("xUnison"), kUni[mmx::exStep(mmx::ex_xUnison, p.extra[mmx::ex_xUnison])]};
    kv[static_cast<size_t>(n++)] = {id("xHpf"), hp > 0 ? 20.0 * std::pow(100.0, hp) : 0.0};
    kv[static_cast<size_t>(n++)] = {id("xComb"), p.extra[mmx::ex_xComb]};
    kv[static_cast<size_t>(n++)] = {id("xCombFb"), 2 * p.extra[mmx::ex_xCombFb] - 1};
  }
  v.params(kv.data(), n);

  ArpFxSettings fs;
  double dly16 = 3;
  fxSettings(p.knobs, fs, dly16);
  fs.warmth = p.extra[mmx::ex_xWarmth];
  fs.bass = p.extra[mmx::ex_xBass];
  fs.air = p.extra[mmx::ex_xAir];
  fs.width = p.extra[mmx::ex_xWidth];
  fs.revSize = p.extra[mmx::ex_xRevSize];
  fs.revTone = p.extra[mmx::ex_xRevTone];
  fs.revPre = p.extra[mmx::ex_xRevPre];
  // FX RACK du module avant
  fs.phMix = p.extra[mmx::ex_xPhMix];
  fs.phRate = p.extra[mmx::ex_xPhRate];
  fs.phDepth = p.extra[mmx::ex_xPhDepth];
  fs.phFb = p.extra[mmx::ex_xPhFb];
  fs.flMix = p.extra[mmx::ex_xFlMix];
  fs.flRate = p.extra[mmx::ex_xFlRate];
  fs.flDepth = p.extra[mmx::ex_xFlDepth];
  fs.flFb = 2 * p.extra[mmx::ex_xFlFb] - 1;
  fs.pumpDepth = p.extra[mmx::ex_xPumpDepth];
  fs.pumpRate = mmx::exStep(mmx::ex_xPumpRate, p.extra[mmx::ex_xPumpRate]);
  fs.pumpShape = p.extra[mmx::ex_xPumpShape];
  fs.crushBits = p.extra[mmx::ex_xCrushBits];
  fs.crushRate = p.extra[mmx::ex_xCrushRate];
  fs.dlyMode = mmx::exStep(mmx::ex_xDlyMode, p.extra[mmx::ex_xDlyMode]);
  fs.shimmer = p.extra[mmx::ex_xShimmer];
  fs.delaySeconds = std::min(2.0, dly16 * 60.0 / p.bpm / 4.0);
  ArpFx fx;
  fx.set(fs, true);  // prepare calcule la reverb des reglages en cours (SIZE, TONE, PRE)
  fx.prepare(SR, 128);
  fx.set(fs, true);

  ArpProgram ap;
  reserveArp(ap);
  arpProgram(p.knobs, p.seq, p.prog.data(), static_cast<int>(p.prog.size()), ap);
  ap.swing = 0;
  // applySteps du plugin : les pistes par pas et le swing propre
  for (int i = 0; i < 16; ++i) {
    ap.stepAcc[i] = p.stAcc[i];
    ap.stepSlide[i] = p.stSlide[i];
    ap.stepGate[i] = p.stGate[i];
    ap.stepRat[i] = p.stRat[i];
    ap.stepProb[i] = p.stProb[i];
  }
  ap.swingOwn = p.extra[mmx::ex_xSwing];
  Arp arp;
  arp.prepare(SR);
  arp.setProgram(&ap);

  const double pps = p.bpm / 60.0 / SR;  // ppq par echantillon
  r.barFrames = 4.0 / pps;
  r.barsFrames = static_cast<int64_t>(std::llround(kBars * r.barFrames));
  const int64_t total = r.barsFrames + static_cast<int64_t>(kTail * SR);
  Sink sink(v, &r.notes);
  float bl[128], br[128], ol[128], orr[128];
  for (int64_t f0 = 0; f0 < total; f0 += 128) {
    const bool playing = f0 < r.barsFrames;
    const int len = playing ? static_cast<int>(std::min<int64_t>(128, r.barsFrames - f0)) : 128;
    arp.process(sink, f0, len, playing, static_cast<double>(f0) * pps, pps, 808u);
    v.process(bl, br, 128);
    fx.setTransport(static_cast<double>(f0) * pps, pps, playing);
    fx.process(bl, br, ol, orr, 128);
    r.L.insert(r.L.end(), ol, ol + 128);
    r.R.insert(r.R.end(), orr, orr + 128);
  }
  // les notes des 8 mesures seulement
  r.notes.erase(std::remove_if(r.notes.begin(), r.notes.end(), [&](const NoteEv& e) { return e.t * SR >= static_cast<double>(r.barsFrames); }), r.notes.end());
  return r;
}

/* ---------------- les mesures ---------------- */

void fft(std::vector<std::complex<double>>& a) {
  const size_t n = a.size();
  for (size_t i = 1, j = 0; i < n; ++i) {
    size_t bit = n >> 1;
    for (; j & bit; bit >>= 1) j ^= bit;
    j ^= bit;
    if (i < j) std::swap(a[i], a[j]);
  }
  for (size_t len = 2; len <= n; len <<= 1) {
    const double ang = -2 * M_PI / static_cast<double>(len);
    const std::complex<double> wl(std::cos(ang), std::sin(ang));
    for (size_t i = 0; i < n; i += len) {
      std::complex<double> w(1);
      for (size_t k = 0; k < len / 2; ++k) {
        const auto u = a[i + k], t = w * a[i + k + len / 2];
        a[i + k] = u + t;
        a[i + k + len / 2] = u - t;
        w *= wl;
      }
    }
  }
}

// Un biquad (forme directe I) pour la ponderation K (BS.1770, coefficients a 48 kHz)
struct Bq {
  double b0, b1, b2, a1, a2, x1 = 0, x2 = 0, y1 = 0, y2 = 0;
  double run(double x) {
    const double y = b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
    x2 = x1, x1 = x, y2 = y1, y1 = y;
    return y;
  }
};

constexpr int kBands = 10;  // octaves de 22 Hz a 22 kHz
constexpr int kEnv = 8;     // les tranches de l'enveloppe moyenne d'une note
constexpr int kRh = 32;     // les triples croches de la mesure
struct Stats {
  double peakDb = -200, rmsDb = -200, lufs = -200, centroid = 0, width = 0, bass = 0, notesPerBar = 0;
  bool nan = false;
  double band[kBands] = {};
  std::vector<int> motif;  // (position en triples croches) x 12 + classe de hauteur, sur les 8 mesures
  // les descripteurs de caractere (voir en tete)
  double env[kEnv] = {};
  double crest = 0, cSlow = 0, cFast = 0, ioiCv = 0, barRepeat = 1;
  double cpu = 0;  // le temps de rendu / la duree rendue (%, un coeur ; les rendus en parallele se genent un peu)
  double rhythm[kRh] = {};
};

Stats measure(const Render& r, double bpm) {
  Stats s;
  const size_t N = static_cast<size_t>(r.barsFrames);
  for (size_t i = 0; i < r.L.size(); ++i)
    if (!std::isfinite(r.L[i]) || !std::isfinite(r.R[i])) s.nan = true;
  double peak = 0;
  for (size_t i = 0; i < N; ++i) peak = std::max({peak, static_cast<double>(std::fabs(r.L[i])), static_cast<double>(std::fabs(r.R[i]))});
  s.peakDb = 20 * std::log10(std::max(peak, 1e-10));
  const size_t a = static_cast<size_t>(r.barFrames);  // mesures 2 a 8
  double pw = 0, mid = 0, side = 0;
  Bq kh[2] = {{1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585},
              {1.53512485958697, -2.69169618940638, 1.19839281085285, -1.69065929318241, 0.73248077421585}};
  Bq kl[2] = {{1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621}, {1.0, -2.0, 1.0, -1.99004745483398, 0.99007225036621}};
  double kp = 0;
  std::vector<double> cum(N + 1, 0.0);  // la puissance cumulee (pour l'enveloppe moyenne d'une note)
  for (size_t i = 0; i < N; ++i) {
    const double l = r.L[i], rr = r.R[i];
    const double kL = kl[0].run(kh[0].run(l)), kR = kl[1].run(kh[1].run(rr));
    cum[i + 1] = cum[i] + 0.5 * (l * l + rr * rr);
    if (i < a) continue;
    pw += 0.5 * (l * l + rr * rr);
    mid += 0.25 * (l + rr) * (l + rr);
    side += 0.25 * (l - rr) * (l - rr);
    kp += kL * kL + kR * kR;
  }
  const double cnt = static_cast<double>(N - a);
  s.rmsDb = 10 * std::log10(std::max(pw / cnt, 1e-20));
  s.lufs = -0.691 + 10 * std::log10(std::max(kp / cnt, 1e-20));
  s.width = 100 * std::sqrt(side / std::max(mid, 1e-20));
  s.crest = s.peakDb - s.rmsDb;
  // le spectre moyen du milieu (Hann, 8192 points, moitie de recouvrement)
  const size_t F = 8192;
  std::vector<double> spec(F / 2 + 1, 0.0);
  std::vector<std::complex<double>> buf(F);
  for (size_t at = 0; at + F <= N; at += F / 2) {
    for (size_t k = 0; k < F; ++k) {
      const double w = 0.5 - 0.5 * std::cos(2 * M_PI * static_cast<double>(k) / static_cast<double>(F));
      buf[k] = 0.5 * (r.L[at + k] + r.R[at + k]) * w;
    }
    fft(buf);
    for (size_t k = 0; k <= F / 2; ++k) spec[k] += std::norm(buf[k]);
  }
  double tot = 0, cw = 0, low = 0;
  for (size_t k = 1; k <= F / 2; ++k) {
    const double hz = static_cast<double>(k) * SR / static_cast<double>(F);
    tot += spec[k];
    cw += spec[k] * hz;
    if (hz < 150) low += spec[k];
    const int b = static_cast<int>(std::floor(std::log2(hz / 22.0)));
    if (b >= 0 && b < kBands) s.band[b] += spec[k];
  }
  s.centroid = tot > 0 ? cw / tot : 0;
  s.bass = tot > 0 ? 100 * low / tot : 0;
  for (double& b : s.band) b = 10 * std::log10(std::max(b / std::max(tot, 1e-30), 1e-12));
  s.notesPerBar = static_cast<double>(r.notes.size()) / kBars;
  const double spb = 60.0 / bpm / 8.0;  // une triple croche
  for (const auto& e : r.notes) s.motif.push_back(static_cast<int>(std::lround(e.t / spb)) * 12 + ((e.midi % 12) + 12) % 12);
  std::sort(s.motif.begin(), s.motif.end());
  s.motif.erase(std::unique(s.motif.begin(), s.motif.end()), s.motif.end());

  // ENV : la puissance alignee sur chaque attaque, 8 tranches de plus en plus longues
  {
    static const double edge[kEnv + 1] = {0, 0.005, 0.010, 0.020, 0.040, 0.080, 0.160, 0.320, 0.640};
    double acc[kEnv] = {};
    int used = 0;
    for (const auto& e : r.notes) {
      const double f = e.t * SR;
      if (f < 0 || f + edge[kEnv] * SR >= static_cast<double>(N)) continue;
      for (int k = 0; k < kEnv; ++k) {
        const size_t i0 = static_cast<size_t>(f + edge[k] * SR), i1 = static_cast<size_t>(f + edge[k + 1] * SR);
        acc[k] += (cum[i1] - cum[i0]) / static_cast<double>(i1 - i0);
      }
      ++used;
    }
    double top = 1e-30;
    for (int k = 0; k < kEnv; ++k) top = std::max(top, acc[k]);
    for (int k = 0; k < kEnv; ++k) s.env[k] = used ? std::max(-30.0, 10 * std::log10(std::max(acc[k] / top, 1e-12))) : -30;
  }

  // CLENT / CVITE : le centroide de trames de 2048 points (pas de 1024), en octaves ; par temps : sa moyenne (ponderee
  // par l'energie) et son ecart type ; CLENT l'ecart type des moyennes, CVITE la moyenne des ecarts types
  {
    const size_t G = 2048, H = 1024;
    std::vector<std::complex<double>> b2(G);
    const double beatFrames = r.barFrames / 4.0;
    const int nBeats = kBars * 4;
    std::vector<double> sw(static_cast<size_t>(nBeats), 0.0), sc(static_cast<size_t>(nBeats), 0.0), sc2(static_cast<size_t>(nBeats), 0.0);
    for (size_t at = 0; at + G <= N; at += H) {
      for (size_t k = 0; k < G; ++k) {
        const double w = 0.5 - 0.5 * std::cos(2 * M_PI * static_cast<double>(k) / static_cast<double>(G));
        b2[k] = 0.5 * (r.L[at + k] + r.R[at + k]) * w;
      }
      fft(b2);
      double e = 0, ce = 0;
      for (size_t k = 1; k <= G / 2; ++k) {
        const double m = std::norm(b2[k]);
        e += m;
        ce += m * static_cast<double>(k) * SR / static_cast<double>(G);
      }
      if (e < 1e-7) continue;  // une trame presque muette ne compte pas
      const double lc = std::log2(std::max(ce / e, 20.0));
      const int bt = std::min(nBeats - 1, static_cast<int>((static_cast<double>(at) + G / 2.0) / beatFrames));
      sw[static_cast<size_t>(bt)] += e;
      sc[static_cast<size_t>(bt)] += e * lc;
      sc2[static_cast<size_t>(bt)] += e * lc * lc;
    }
    double m1 = 0, m2 = 0, fast = 0;
    int nb = 0;
    for (int bt = 4; bt < nBeats; ++bt) {  // mesures 2 a 8
      const size_t i = static_cast<size_t>(bt);
      if (sw[i] <= 0) continue;
      const double mu = sc[i] / sw[i];
      fast += std::sqrt(std::max(0.0, sc2[i] / sw[i] - mu * mu));
      m1 += mu;
      m2 += mu * mu;
      ++nb;
    }
    if (nb > 0) {
      s.cFast = fast / nb;
      s.cSlow = std::sqrt(std::max(0.0, m2 / nb - (m1 / nb) * (m1 / nb)));
    }
  }

  // RYTHME, IRREG, REPET : les attaques (une par place de triple croche et par mesure)
  {
    std::vector<int> pos;
    for (const auto& e : r.notes) pos.push_back(static_cast<int>(std::lround(e.t / spb)));
    std::sort(pos.begin(), pos.end());
    pos.erase(std::unique(pos.begin(), pos.end()), pos.end());
    std::vector<std::vector<int>> bars(static_cast<size_t>(kBars));
    for (int q : pos) {
      const int bar = q / kRh;
      if (bar < 0 || bar >= kBars) continue;
      s.rhythm[q % kRh] += 1.0 / kBars;
      bars[static_cast<size_t>(bar)].push_back(q % kRh);
    }
    // les intervalles entre attaques, a l'heure vraie (SWING et RATCHET compris)
    std::vector<double> ts;
    for (const auto& e : r.notes) ts.push_back(e.t);
    std::sort(ts.begin(), ts.end());
    double m = 0, m2 = 0;
    int n = 0;
    for (size_t i = 1; i < ts.size(); ++i) {
      const double d = (ts[i] - ts[i - 1]) / (spb * 2);  // en doubles croches
      if (d < 1e-4) continue;
      m += d;
      m2 += d * d;
      ++n;
    }
    if (n > 1) {
      m /= n;
      s.ioiCv = std::sqrt(std::max(0.0, m2 / n - m * m)) / std::max(m, 1e-9);
    }
    double rep = 0;
    int nr = 0;
    for (int b = 1; b + 1 < kBars; ++b) {
      const auto& x = bars[static_cast<size_t>(b)];
      const auto& y = bars[static_cast<size_t>(b + 1)];
      if (x.empty() && y.empty()) continue;
      size_t both = 0;
      for (int q : x)
        if (std::find(y.begin(), y.end(), q) != y.end()) ++both;
      rep += static_cast<double>(both) / static_cast<double>(x.size() + y.size() - both);
      ++nr;
    }
    s.barRepeat = nr ? rep / nr : 1;
  }
  return s;
}

double motifSim(const std::vector<int>& a, const std::vector<int>& b) {
  if (a.empty() && b.empty()) return 1;
  size_t i = 0, j = 0, both = 0;
  while (i < a.size() && j < b.size()) {
    if (a[i] == b[j]) ++both, ++i, ++j;
    else if (a[i] < b[j]) ++i;
    else ++j;
  }
  return static_cast<double>(both) / static_cast<double>(a.size() + b.size() - both);
}

double profileDist(const Stats& a, const Stats& b) {
  double d = 0;
  for (int k = 0; k < kBands; ++k) d += std::fabs(std::max(a.band[k], -60.0) - std::max(b.band[k], -60.0));
  return d / kBands;
}

/* ---------------- la distance entre deux presets ---------------- */

// Chaque ecart dans son unite "nettement different" (1 = on l'entend sans hesiter), borne a 3 pour qu'aucun ne decide seul
enum Term { T_CENTR, T_BANDS, T_ENV, T_CREST, T_CSLOW, T_CFAST, T_WIDTH, kSoundTerms, T_DENS = kSoundTerms, T_IRREG, T_RHYTHM, T_REPEAT, T_MOTIF, kTerms };
const char* const kTermName[kTerms] = {"centroide", "bandes", "enveloppe", "crete", "c.lent", "c.vite", "largeur", "densite", "irregularite", "rythme", "repetition", "motif"};
constexpr double kUnit[kTerms] = {
    0.30,  // centroide : un tiers d'octave
    3.0,   // bandes : 3 dB d'ecart moyen par octave
    3.0,   // enveloppe : 3 dB d'ecart moyen par tranche
    3.0,   // facteur de crete : 3 dB
    0.12,  // modulation lente du centroide : 0.12 octave d'ecart type
    0.12,  // variation de note a note : 0.12 octave
    15.0,  // largeur : 15 points
    0.5,   // densite : un facteur racine de 2
    0.25,  // irregularite : 0.25 de coefficient de variation
    0.30,  // rythme : 1 - cosinus des histogrammes
    0.30,  // repetition d'une mesure a l'autre
    1.00,  // motif : 1 - part commune (deux presets n'ont presque jamais les memes notes : le terme pese 1 au plus)
};
// Les seuils : aucun preset a moins de kMinD d'un autre (le tout), ni a moins de kMinDS par le son seul
constexpr double kMinD = 2.7, kMinDS = 2.0;

struct Dist {
  double t[kTerms] = {};
  double d = 0, ds = 0;
};

Dist distance(const Stats& a, const Stats& b) {
  Dist o;
  double raw[kTerms];
  raw[T_CENTR] = std::fabs(std::log2(std::max(a.centroid, 1.0) / std::max(b.centroid, 1.0)));
  raw[T_BANDS] = profileDist(a, b);
  double e = 0;
  for (int k = 0; k < kEnv; ++k) e += std::fabs(a.env[k] - b.env[k]);
  raw[T_ENV] = e / kEnv;
  raw[T_CREST] = std::fabs(a.crest - b.crest);
  raw[T_CSLOW] = std::fabs(a.cSlow - b.cSlow);
  raw[T_CFAST] = std::fabs(a.cFast - b.cFast);
  raw[T_WIDTH] = std::fabs(a.width - b.width);
  raw[T_DENS] = std::fabs(std::log2(std::max(a.notesPerBar, 0.25) / std::max(b.notesPerBar, 0.25)));
  raw[T_IRREG] = std::fabs(a.ioiCv - b.ioiCv);
  double ab = 0, aa = 0, bb = 0;
  for (int k = 0; k < kRh; ++k) ab += a.rhythm[k] * b.rhythm[k], aa += a.rhythm[k] * a.rhythm[k], bb += b.rhythm[k] * b.rhythm[k];
  raw[T_RHYTHM] = 1 - (aa > 0 && bb > 0 ? ab / std::sqrt(aa * bb) : 0);
  raw[T_REPEAT] = std::fabs(a.barRepeat - b.barRepeat);
  raw[T_MOTIF] = 1 - motifSim(a.motif, b.motif);
  double s = 0, ss = 0;
  for (int k = 0; k < kTerms; ++k) {
    o.t[k] = std::min(3.0, raw[k] / kUnit[k]);
    s += o.t[k] * o.t[k];
    if (k < kSoundTerms) ss += o.t[k] * o.t[k];
  }
  o.d = std::sqrt(s);
  o.ds = std::sqrt(ss);
  return o;
}

/* ---------------- le WAV (float 32 bits) ---------------- */

void writeWav(const std::string& path, const Render& r) {
  std::ofstream f(path, std::ios::binary);
  const uint32_t n = static_cast<uint32_t>(r.L.size()), bytes = n * 8;
  auto u32 = [&](uint32_t v) { f.write(reinterpret_cast<const char*>(&v), 4); };
  auto u16 = [&](uint16_t v) { f.write(reinterpret_cast<const char*>(&v), 2); };
  f.write("RIFF", 4);
  u32(36 + bytes);
  f.write("WAVEfmt ", 8);
  u32(16);
  u16(3);
  u16(2);
  u32(static_cast<uint32_t>(SR));
  u32(static_cast<uint32_t>(SR) * 8);
  u16(8);
  u16(32);
  f.write("data", 4);
  u32(bytes);
  for (uint32_t i = 0; i < n; ++i) {
    f.write(reinterpret_cast<const char*>(&r.L[i]), 4);
    f.write(reinterpret_cast<const char*>(&r.R[i]), 4);
  }
}

int main(int argc, char** argv) {
  if (argc < 2) {
    std::fprintf(stderr, "usage : presets_render <factory.json> [--os 4|8] [--wav <dossier>] [--only <nom>] [--notes] [--calibrate <fichier>] [--jobs n]\n");
    return 2;
  }
  int os = 4;
  int jobs = static_cast<int>(std::max(1u, std::thread::hardware_concurrency()));
  std::string wav, only, calib;
  bool showNotes = false;
  for (int i = 2; i < argc; ++i) {
    if (!std::strcmp(argv[i], "--notes")) showNotes = true;
    if (!std::strcmp(argv[i], "--os") && i + 1 < argc) os = std::atoi(argv[++i]) == 8 ? 8 : 4;
    else if (!std::strcmp(argv[i], "--wav") && i + 1 < argc) wav = argv[++i];
    else if (!std::strcmp(argv[i], "--only") && i + 1 < argc) only = argv[++i];
    else if (!std::strcmp(argv[i], "--calibrate") && i + 1 < argc) calib = argv[++i];
    else if (!std::strcmp(argv[i], "--jobs") && i + 1 < argc) jobs = std::max(1, std::atoi(argv[++i]));
  }
  std::ifstream in(argv[1]);
  if (!in) {
    std::fprintf(stderr, "introuvable : %s\n", argv[1]);
    return 2;
  }
  std::stringstream ss;
  ss << in.rdbuf();
  const std::string text = ss.str();
  Reader rd(text);
  const J root = rd.val();
  const J* list = root.get("presets");
  if (!list || list->t != J::Arr) {
    std::fprintf(stderr, "pas de tableau presets\n");
    return 2;
  }
  std::vector<Preset> ps;
  for (const auto& p : list->a) ps.push_back(parsePreset(p));
  std::vector<Stats> st(ps.size());
  std::vector<bool> done(ps.size(), false);
  std::vector<std::string> noteLine(ps.size());

  std::printf("Rendu hors ligne, moteur x%d, 48 kHz, 8 mesures au bpm du preset (aucun son joue)\n\n", os);
  // Les rendus, en parallele (chaque preset a son moteur, sa chaine, son arpege : rien de partage)
  {
    std::vector<size_t> todo;
    for (size_t i = 0; i < ps.size(); ++i)
      if (only.empty() || ps[i].name == only) todo.push_back(i), done[i] = true;
    std::atomic<size_t> next{0};
    auto work = [&]() {
      for (;;) {
        const size_t q = next.fetch_add(1);
        if (q >= todo.size()) return;
        const size_t i = todo[q];
        const auto t0 = std::chrono::steady_clock::now();
        const Render r = render(ps[i], os);
        const double took = std::chrono::duration<double>(std::chrono::steady_clock::now() - t0).count();
        st[i] = measure(r, ps[i].bpm);
        st[i].cpu = 100 * took / (static_cast<double>(r.L.size()) / SR);
        if (showNotes) {
          // les notes des deux premieres mesures : la double croche de la note, son nom et son octave
          static const char* nm[12] = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};
          char b[64];
          for (const auto& e : r.notes) {
            const double pos = e.t * ps[i].bpm / 60.0 * 4.0;
            if (pos >= 32) break;
            std::snprintf(b, sizeof b, " %g:%s%d", std::round(pos * 4) / 4, nm[e.midi % 12], e.midi / 12 - 1);
            noteLine[i] += b;
          }
        }
        if (!wav.empty()) {
          char fn[512];
          std::snprintf(fn, sizeof fn, "%s/%02zu %s.wav", wav.c_str(), i + 1, ps[i].name.c_str());
          writeWav(fn, r);
        }
      }
    };
    std::vector<std::thread> th;
    for (int t = 0; t < std::min<int>(jobs, static_cast<int>(todo.size())); ++t) th.emplace_back(work);
    for (auto& t : th) t.join();
  }
  if (showNotes)
    for (size_t i = 0; i < ps.size(); ++i)
      if (done[i]) std::printf("%-24s%s\n", ps[i].name.c_str(), noteLine[i].c_str());

  std::printf("%-3s %-24s %-8s %4s %7s %7s %7s %7s %6s %6s %6s %3s  %s\n", "#", "NOM", "CAT", "BPM", "CRETE", "RMS", "LUFS", "CENTR", "LARG", "BAS", "NOTES", "NaN", "VOL / ECART A LA CIBLE");
  // la reference de sonie RMS : la mediane des presets hors TEXTURE
  std::vector<double> ref;
  for (size_t i = 0; i < ps.size(); ++i)
    if (done[i] && ps[i].cat != "TEXTURE") ref.push_back(st[i].rmsDb);
  std::sort(ref.begin(), ref.end());
  const double med = ref.empty() ? 0 : ref[ref.size() / 2];
  int bad = 0;
  std::string calibJson = "{\n";
  for (size_t i = 0; i < ps.size(); ++i) {
    if (!done[i]) continue;
    const Stats& s = st[i];
    const double dev = s.rmsDb - med;
    const bool tex = ps[i].cat == "TEXTURE";
    const double target = tex ? -25.0 : -23.0;  // la sonie K visee
    const double off = s.lufs - target;
    std::string why;
    if (s.peakDb >= -1) why += " CRETE>-1";
    if (s.peakDb < -20) why += " CRETE<-20";
    if (off > 0.7) why += " SONIE>CIBLE";
    if (off < -0.7) why += " SONIE<CIBLE";
    if (dev > 4) why += " TROP FORT";
    if (dev < -4 && !tex) why += " TROP DOUX";
    if (s.nan) why += " NaN";
    if (!why.empty()) ++bad;
    // le VOLUME qui mettrait ce preset sur sa cible (le gain suit VOLUME au carre)
    const double vol = ps[i].knobs[kn_volume];
    const double volFix = std::min(1.0, vol * std::pow(10.0, -off / 40.0));
    char line[96];
    std::snprintf(line, sizeof line, "  \"%s\": %.3f,\n", ps[i].name.c_str(), volFix);
    calibJson += line;
    std::printf("%-3zu %-24s %-8s %4.0f %7.1f %7.1f %7.1f %7.0f %5.0f%% %5.1f%% %6.2f %3s  %.3f (%+.1f LU -> %.3f)%s\n", i + 1, ps[i].name.c_str(), ps[i].cat.c_str(), ps[i].bpm, s.peakDb,
                s.rmsDb, s.lufs, s.centroid, s.width, s.bass, s.notesPerBar, s.nan ? "OUI" : "non", vol, off, volFix, why.c_str());
  }
  std::printf("\nSonie visee : -23 LUFS (TEXTURE : -25) ; sonie RMS de reference (mediane hors TEXTURE) : %.1f dBFS\n", med);
  if (!calib.empty()) {
    if (calibJson.size() > 2) calibJson.erase(calibJson.size() - 2, 1);  // la derniere virgule
    calibJson += "}\n";
    std::ofstream(calib) << calibJson;
    std::printf("VOLUME de calage ecrit dans %s\n", calib.c_str());
  }

  // Les descripteurs de caractere
  std::printf("\nDescripteurs (CPU : temps de rendu / duree, un coeur de cette machine ; ENV : dB sous la plus forte tranche, 0-5 / 5-10 / 10-20 / 20-40 / 40-80 / 80-160 / 160-320 / 320-640 ms ; BANDES : dB, octaves de 22 Hz a 22 kHz)\n");
  std::printf("%-3s %-24s %5s %5s %5s %5s %5s %5s  %-39s  %s\n", "#", "NOM", "CPU", "CRETE", "CLENT", "CVITE", "IRREG", "REPET", "ENV", "BANDES");
  for (size_t i = 0; i < ps.size(); ++i) {
    if (!done[i]) continue;
    const Stats& s = st[i];
    std::printf("%-3zu %-24s %4.0f%% %5.1f %5.2f %5.2f %5.2f %5.2f ", i + 1, ps[i].name.c_str(), s.cpu, s.crest, s.cSlow, s.cFast, s.ioiCv, s.barRepeat);
    for (int k = 0; k < kEnv; ++k) std::printf(" %4.0f", s.env[k]);
    std::printf("  ");
    for (int k = 0; k < kBands; ++k) std::printf(" %4.0f", std::max(s.band[k], -99.0));
    std::printf("\n");
  }

  // Diversite : toutes les paires, la distance D (le tout) et DS (le son seul)
  struct Pair {
    size_t i, j;
    Dist d;
  };
  std::vector<Pair> pairs;
  for (size_t i = 0; i < ps.size(); ++i)
    for (size_t j = i + 1; j < ps.size(); ++j)
      if (done[i] && done[j]) pairs.push_back({i, j, distance(st[i], st[j])});
  int close = 0;
  if (!pairs.empty()) {
    std::printf("\nDiversite : distance D (tous les descripteurs) et DS (le son seul), seuils D >= %.1f et DS >= %.1f\n", kMinD, kMinDS);
    std::printf("Voisin le plus proche de chaque preset :\n");
    for (size_t i = 0; i < ps.size(); ++i) {
      if (!done[i]) continue;
      const Pair* best = nullptr;
      const Pair* bestS = nullptr;
      for (const auto& p : pairs) {
        if (p.i != i && p.j != i) continue;
        if (!best || p.d.d < best->d.d) best = &p;
        if (!bestS || p.d.ds < bestS->d.ds) bestS = &p;
      }
      if (!best) continue;
      const size_t o = best->i == i ? best->j : best->i, os2 = bestS->i == i ? bestS->j : bestS->i;
      std::printf("  %-24s D %4.1f ~ %-24s DS %4.1f ~ %-24s%s\n", ps[i].name.c_str(), best->d.d, ps[o].name.c_str(), bestS->d.ds, ps[os2].name.c_str(),
                  best->d.d < kMinD || bestS->d.ds < kMinDS ? "   A REVOIR" : "");
    }
    auto show = [&](const Pair& p) {
      std::printf("  %-24s ~ %-24s D %4.1f  DS %4.1f  |", ps[p.i].name.c_str(), ps[p.j].name.c_str(), p.d.d, p.d.ds);
      for (int k = 0; k < kTerms; ++k) std::printf(" %s %.1f", kTermName[k], p.d.t[k]);
      std::printf("\n");
    };
    std::sort(pairs.begin(), pairs.end(), [](const Pair& a, const Pair& b) { return a.d.d < b.d.d; });
    std::printf("\nLes 5 paires les plus proches (D, chaque ecart dans son unite) :\n");
    for (size_t k = 0; k < std::min<size_t>(5, pairs.size()); ++k) show(pairs[k]);
    std::vector<Pair> bySound = pairs;
    std::sort(bySound.begin(), bySound.end(), [](const Pair& a, const Pair& b) { return a.d.ds < b.d.ds; });
    std::printf("\nLes 5 paires les plus proches par le son seul (DS) :\n");
    for (size_t k = 0; k < std::min<size_t>(5, bySound.size()); ++k) show(bySound[k]);
    std::vector<double> all;
    for (const auto& p : pairs) {
      all.push_back(p.d.d);
      if (p.d.d < kMinD || p.d.ds < kMinDS) {
        if (!close) std::printf("\nPaires trop proches :\n");
        ++close;
        show(p);
      }
    }
    std::printf("\nDistance D : minimum %.2f, mediane %.2f ; DS : minimum %.2f\n", all.front(), all[all.size() / 2], bySound.front().d.ds);
  }
  std::printf("\n%s : %d preset(s) hors des bornes, %d paire(s) trop proches\n", bad || close ? "A REVOIR" : "OK", bad, close);
  return bad || close ? 1 : 0;
}
