// MM-ARP : le moteur du synthe (port C++17 de src/v4/audio/moog.worklet.js, l'AudioWorklet 'mm-voyager' du site).
//
// Port ligne a ligne, meme ordre d'operations, calcul en double comme le JS ; les tableaux Float32Array du JS
// (le bloc surechantillonne, l'etage intermediaire et l'historique des decimateurs, la sortie) sont des float ici
// aussi : l'arrondi en float se fait aux memes endroits. Le hasard : mulberry32 a graine, la meme suite que le JS.
// Verifie contre le vrai worklet par plugin/mm-arp/tests/voyager-ref.mjs + tests/voyager_compare.cpp.
//
// Les fonctions de Math sont celles de V8 (son fdlibm, Voyager.fdlibm.inc) : la libm du systeme differe d'un ulp sur
// 1 a 10 % des valeurs. IMPORTANT (identite au bit pres) : pas de contraction FMA ni de fast-math. Voyager.cpp coupe
// la contraction par pragma (clang : fp contract(off), GCC : optimize("fp-contract=off"), verifie avec -march=native
// et -ffp-contract=fast/on) ; garder quand meme -ffp-contract=off dans le CMake, et jamais -ffast-math / -Ofast.
//
// ----------------------------------------------------------------------------------------------------------------
// API (tout est en "temps du contexte" : secondes depuis la frame 0 du moteur ; frame = round(t * sampleRate),
// arrondi JS Math.round). Les messages s'appliquent tout de suite, c'est-a-dire "entre deux blocs" comme le port du
// worklet : appeler note/beat/params/... entre deux process(). currentFrame() avance de n a chaque process(n).
//
//   mmarp::VoyagerOptions o;            // sampleRate, os (1, 2 ou 4), maxVoices (1..12), maxStack (1..3),
//                                       // wideVoices (>= 0), seed (mulberry32), seeded (false : graine tiree au hasard)
//   mmarp::Voyager v(o, {{"cutoff", 800}, {"res", 0.3}});   // params initiaux = processorOptions.params
//   v.params({{"cutoff", 1200}});       // message 'params' partiel (cles inconnues ou non finies ignorees, bornees)
//   v.params(kv, n);                    // la meme chose sans chaine (ids : Voyager::paramIndex("cutoff")), temps reel
//   v.note(t, midi, gate, accent, from) // gate en s (+inf : jusqu'au noteOff), accent 0/NaN -> 1, from NaN = null
//   v.beat(t, beat, bpm, run)           // ancre du transport (LFO MOD cale) ; bpm NaN ou <= 0 -> le bpm des params
//   v.noteOff(midi, t)                  // t NaN = maintenant
//   v.cancel(t); v.stop(t);             // t NaN = 0 (comme "m.time || 0" du JS)
//   v.process(L, R, n);                 // n de 1 a 4096 (le JS : 128), sortie stereo float, aucune allocation
//   v.latencySamples();                 // retard fixe des decimateurs, arrondi (x4 : 19, x2 : 16, x1 : 0)
//
// Capacites fixes (aucune allocation apres le constructeur) : 1024 notes en attente, 512 ancres ; au-dela, le
// nouvel element est ignore (le JS n'a pas de limite). Le mode 'probe' (tests du site) n'est pas porte.
// ----------------------------------------------------------------------------------------------------------------
#pragma once

#include <cstdint>
#include <memory>
#include <string>
#include <utility>
#include <vector>

namespace mmarp {

struct VoyagerOptions {
  double sampleRate = 48000;
  int os = 4;          // 1, 2 ou 4 (autre valeur : 4, comme le JS)
  int maxVoices = 12;  // 1..12 (autre valeur : 12)
  int maxStack = 3;    // 1..3 (autre valeur : 3)
  int wideVoices = 8;  // >= 0 (negatif : 12) ; le site sur ordinateur : 8
  uint32_t seed = 808;
  bool seeded = true;  // false : comme unseeded() du JS (graine tiree de std::random_device, non reproductible)
};

/** Un reglage par son id (Voyager::paramIndex) : le chemin temps reel des messages 'params'. */
struct ParamKV {
  int id;
  double value;
};

class Voyager {
 public:
  static constexpr int kMaxBlock = 4096;
  static constexpr int kQueueCap = 1024;
  static constexpr int kBeatCap = 512;

  explicit Voyager(const VoyagerOptions& opts, const std::vector<std::pair<std::string, double>>& initialParams = {});
  ~Voyager();
  Voyager(const Voyager&) = delete;
  Voyager& operator=(const Voyager&) = delete;

  /** L'id d'une cle du moteur ("cutoff", "res"...), -1 si inconnue ; paramCount() cles, paramName(id). */
  static int paramIndex(const std::string& key);
  static int paramCount();
  static const char* paramName(int id);

  void params(const std::vector<std::pair<std::string, double>>& kv);
  void params(const ParamKV* kv, int n);
  void note(double timeSec, double midi, double gateSec, double accent, double fromMidi);
  void beat(double timeSec, double beat, double bpm, bool run);
  void noteOff(double midi, double timeSec);
  void cancel(double timeSec);
  void stop(double timeSec);

  void process(float* L, float* R, int n);

  int64_t currentFrame() const;
  int latencySamples() const;
  /** Diagnostics : la valeur courante d'un reglage, les voix allumees, les remises au repos des gardes (heals). */
  double param(int id) const;
  int activeVoices() const;
  int heals() const;

 private:
  struct Impl;
  std::unique_ptr<Impl> m_;
};

}  // namespace mmarp
