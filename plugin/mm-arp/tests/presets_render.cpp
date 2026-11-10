// MM-ARP : le rendu hors ligne de la banque d'usine du VST3 (plugin/mm-arp/presets/factory.json), avec le vrai moteur
// du plugin (dsp/ : Voyager, ArpFx, Arp, Params), jamais un son : tout se mesure dans des buffers (2026-11-10).
//
// Chaque preset joue comme dans le plugin (src/PluginProcessor.cpp update / processBlock) : les 62 potards arrondis
// (knobClean), engineParams + le bpm + les 6 cles du VST3 seul (xl1Dest, xl1Amt, l2Beats, l2Shape, l2Dest, l2Amt), la
// chaine (fxSettings + master + reverb SIZE / TONE / PRE), l'arpege (arpProgram : la suite EDIT ou AUTO, la progression)
// cale sur le transport depuis ppq 0, le moteur par blocs de 128. 8 mesures a son bpm, puis 3 s de queue (pour le WAV).
//
// Mesures (sur les 8 mesures) : crete (dBFS), sonie RMS (stereo, dBFS, mesures 2 a 8), sonie ponderee K (LUFS sans
// porte, pour info), centroide spectral (Hz), largeur stereo (cote / milieu, %), part des basses (< 150 Hz, %), densite
// de notes (par mesure), NaN / infini. Puis un controle de diversite : deux presets trop proches (centroide, sonie,
// profil spectral et motif de notes) sont a revoir.
//
// Construire et lancer : plugin/mm-arp/tests/presets-render.sh [dossier de build] [--os 8] [--wav <dossier>]
//   presets_render <factory.json> [--os 4|8] [--wav <dossier>] [--only <nom>] [--notes]
//   --notes : imprime les notes des deux premieres mesures (double croche:note)
//   --os : le surechantillonnage du moteur (4 : celui du site, par defaut ; 8 : QUALITY HQ du preset)
//   --wav : ecrit un WAV float 32 bits par preset (NE PAS les lire pendant les tests : c'est pour Mika)
// Code de sortie : 0 si tout passe (crete sous -1 dBFS et au-dessus de -20, sonie a +/-4 dB de la mediane des
// presets hors TEXTURE ; les TEXTURE peuvent etre plus douces, jamais plus fortes ; aucun NaN ; aucun doublon).
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
  std::vector<ParamKV> kv(kEngineParams + 8);
  int n = engineParams(p.knobs, kv.data(), kEngineParams);
  auto id = [](const char* k) { return Voyager::paramIndex(k); };
  kv[static_cast<size_t>(n++)] = {id("bpm"), p.bpm};
  kv[static_cast<size_t>(n++)] = {id("xl1Dest"), static_cast<double>(mmx::exStep(mmx::ex_xLfo1Dest2, p.extra[mmx::ex_xLfo1Dest2]))};
  kv[static_cast<size_t>(n++)] = {id("xl1Amt"), p.extra[mmx::ex_xLfo1Depth2]};
  kv[static_cast<size_t>(n++)] = {id("l2Beats"), mmx::kExBeats_xLfo2Rate[mmx::exStep(mmx::ex_xLfo2Rate, p.extra[mmx::ex_xLfo2Rate])]};
  kv[static_cast<size_t>(n++)] = {id("l2Shape"), static_cast<double>(mmx::exStep(mmx::ex_xLfo2Shape, p.extra[mmx::ex_xLfo2Shape]))};
  kv[static_cast<size_t>(n++)] = {id("l2Dest"), static_cast<double>(mmx::exStep(mmx::ex_xLfo2Dest, p.extra[mmx::ex_xLfo2Dest]))};
  kv[static_cast<size_t>(n++)] = {id("l2Amt"), p.extra[mmx::ex_xLfo2Depth]};
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
  fs.delaySeconds = std::min(2.0, dly16 * 60.0 / p.bpm / 4.0);
  ArpFx fx;
  fx.set(fs, true);  // prepare calcule la reverb des reglages en cours (SIZE, TONE, PRE)
  fx.prepare(SR, 128);
  fx.set(fs, true);

  ArpProgram ap;
  reserveArp(ap);
  arpProgram(p.knobs, p.seq, p.prog.data(), static_cast<int>(p.prog.size()), ap);
  ap.swing = 0;
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

constexpr int kBands = 10;  // octaves de 31 Hz a 16 kHz
struct Stats {
  double peakDb = -200, rmsDb = -200, lufs = -200, centroid = 0, width = 0, bass = 0, notesPerBar = 0;
  bool nan = false;
  double band[kBands] = {};
  std::vector<int> motif;  // (position en triples croches) x 12 + classe de hauteur, sur les 8 mesures
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
  for (size_t i = 0; i < N; ++i) {
    const double l = r.L[i], rr = r.R[i];
    const double kL = kl[0].run(kh[0].run(l)), kR = kl[1].run(kh[1].run(rr));
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
    std::fprintf(stderr, "usage : presets_render <factory.json> [--os 4|8] [--wav <dossier>] [--only <nom>]\n");
    return 2;
  }
  int os = 4;
  std::string wav, only;
  bool showNotes = false;
  for (int i = 2; i < argc; ++i) {
    if (!std::strcmp(argv[i], "--notes")) showNotes = true;
    if (!std::strcmp(argv[i], "--os") && i + 1 < argc) os = std::atoi(argv[++i]) == 8 ? 8 : 4;
    else if (!std::strcmp(argv[i], "--wav") && i + 1 < argc) wav = argv[++i];
    else if (!std::strcmp(argv[i], "--only") && i + 1 < argc) only = argv[++i];
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

  std::printf("Rendu hors ligne, moteur x%d, 48 kHz, 8 mesures au bpm du preset (aucun son joue)\n\n", os);
  std::printf("%-3s %-20s %-8s %4s %7s %7s %7s %7s %6s %6s %6s %3s  %s\n", "#", "NOM", "CAT", "BPM", "CRETE", "RMS", "LUFS", "CENTR", "LARG", "BAS", "NOTES", "NaN", "VOL / ECART");
  for (size_t i = 0; i < ps.size(); ++i) {
    if (!only.empty() && ps[i].name != only) continue;
    const Render r = render(ps[i], os);
    st[i] = measure(r, ps[i].bpm);
    done[i] = true;
    if (showNotes) {
      // les notes des deux premieres mesures : la double croche de la note, son nom et son octave
      static const char* nm[12] = {"C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"};
      std::printf("%-20s", ps[i].name.c_str());
      for (const auto& e : r.notes) {
        const double pos = e.t * ps[i].bpm / 60.0 * 4.0;
        if (pos >= 32) break;
        std::printf(" %g:%s%d", std::round(pos * 2) / 2, nm[e.midi % 12], e.midi / 12 - 1);
      }
      std::printf("\n");
    }
    if (!wav.empty()) {
      char fn[512];
      std::snprintf(fn, sizeof fn, "%s/%02zu %s.wav", wav.c_str(), i + 1, ps[i].name.c_str());
      writeWav(fn, r);
    }
  }
  // la reference de sonie : la mediane des presets hors TEXTURE
  std::vector<double> ref;
  for (size_t i = 0; i < ps.size(); ++i)
    if (done[i] && ps[i].cat != "TEXTURE") ref.push_back(st[i].rmsDb);
  std::sort(ref.begin(), ref.end());
  const double med = ref.empty() ? 0 : ref[ref.size() / 2];
  int bad = 0;
  for (size_t i = 0; i < ps.size(); ++i) {
    if (!done[i]) continue;
    const Stats& s = st[i];
    const double dev = s.rmsDb - med;
    const bool tex = ps[i].cat == "TEXTURE";
    std::string why;
    if (s.peakDb >= -1) why += " CRETE>-1";
    if (s.peakDb < -20) why += " CRETE<-20";
    if (dev > 4) why += " TROP FORT";
    if (dev < -4 && !tex) why += " TROP DOUX";
    if (s.nan) why += " NaN";
    if (!why.empty()) ++bad;
    // le VOLUME qui mettrait ce preset sur la mediane (le gain suit VOLUME au carre)
    const double vol = ps[i].knobs[kn_volume];
    const double volFix = std::min(1.0, vol * std::pow(10.0, -dev / 40.0));
    std::printf("%-3zu %-20s %-8s %4.0f %7.1f %7.1f %7.1f %7.0f %5.0f%% %5.1f%% %6.2f %3s  %.3f (%+.1f dB -> %.3f)%s\n", i + 1, ps[i].name.c_str(), ps[i].cat.c_str(), ps[i].bpm, s.peakDb,
                s.rmsDb, s.lufs, s.centroid, s.width, s.bass, s.notesPerBar, s.nan ? "OUI" : "non", vol, dev, volFix, why.c_str());
  }
  std::printf("\nSonie de reference (mediane hors TEXTURE) : %.1f dBFS RMS\n", med);

  // Diversite : le voisin le plus proche de chaque preset, et les paires trop proches
  std::printf("\nDiversite (voisin le plus proche : ecart de centroide, de sonie, de profil spectral, ressemblance du motif)\n");
  int close = 0;
  for (size_t i = 0; i < ps.size(); ++i) {
    if (!done[i]) continue;
    double best = 1e9;
    size_t bj = i;
    for (size_t j = 0; j < ps.size(); ++j) {
      if (j == i || !done[j]) continue;
      const double dc = std::fabs(std::log2(std::max(st[i].centroid, 1.0) / std::max(st[j].centroid, 1.0)));
      const double d = dc / 0.25 + std::fabs(st[i].rmsDb - st[j].rmsDb) / 1.5 + profileDist(st[i], st[j]) / 3.0 + (1 - motifSim(st[i].motif, st[j].motif)) * 2;
      if (d < best) best = d, bj = j;
    }
    if (bj == i) continue;
    const double dc = 100 * std::fabs(st[i].centroid - st[bj].centroid) / std::max(st[i].centroid, st[bj].centroid);
    const double dl = std::fabs(st[i].rmsDb - st[bj].rmsDb);
    const double pd = profileDist(st[i], st[bj]);
    const double ms = motifSim(st[i].motif, st[bj].motif);
    const bool tooClose = dc < 12 && dl < 1.5 && pd < 2.5 && ms > 0.5;
    if (tooClose && i < bj) ++close;
    std::printf("  %-20s ~ %-20s centroide %4.0f %%, sonie %4.1f dB, profil %4.1f dB, motif %3.0f %%%s\n", ps[i].name.c_str(), ps[bj].name.c_str(), dc, dl, pd, 100 * ms,
                tooClose ? "   A REVOIR" : "");
  }
  std::printf("\n%s : %d preset(s) hors des bornes, %d paire(s) trop proches\n", bad || close ? "A REVOIR" : "OK", bad, close);
  return bad || close ? 1 : 0;
}
