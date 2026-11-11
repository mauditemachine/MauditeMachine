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
//   mmarp::VoyagerOptions o;            // sampleRate, os (1, 2, 4 ou 8), maxVoices (1..12), maxStack (1..3),
//                                       // wideVoices (>= 0), seed (mulberry32), seeded (false : graine tiree au hasard)
//   mmarp::Voyager v(o, {{"cutoff", 800}, {"res", 0.3}});   // params initiaux = processorOptions.params
//   v.params({{"cutoff", 1200}});       // message 'params' partiel (cles inconnues ou non finies ignorees, bornees)
//   v.params(kv, n);                    // la meme chose sans chaine (ids : Voyager::paramIndex("cutoff")), temps reel
//   v.note(t, midi, gate, accent, from) // gate en s (+inf : jusqu'au noteOff), accent 0/NaN -> 1, from NaN = null
//   v.beat(t, beat, bpm, run)           // ancre du transport (LFO MOD cale) ; bpm NaN ou <= 0 -> le bpm des params
//   v.noteOff(midi, t)                  // t NaN = maintenant
//   v.cancel(t); v.stop(t);             // t NaN = 0 (comme "m.time || 0" du JS)
//   v.process(L, R, n);                 // n de 1 a 4096 (le JS : 128), sortie stereo float, aucune allocation
//   v.latencySamples();                 // retard fixe des decimateurs, arrondi (x8 : 21, x4 : 19, x2 : 16, x1 : 0)
//
// Capacites fixes (aucune allocation apres le constructeur) : 1024 notes en attente, 512 ancres ; au-dela, le
// nouvel element est ignore (le JS n'a pas de limite). Le mode 'probe' (tests du site) n'est pas porte.
//
// ----------------------------------------------------------------------------------------------------------------
// LES EXTENSIONS DU PLUGIN (2026-11-10, Mika : "une qualite absolument eblouissante, quitte a prendre plus de
// processeur" ; le site ne les connait pas, moog.worklet.js ne change pas). Regle : chaque cle a son defaut rend le
// moteur du site AU BIT PRES (les 85 cas de voyager_compare), sans un tirage de hasard de plus ; verifie par
// tests/hq_test.cpp.
//
// 1. QUALITY HQ : os = 8 (surechantillonnage x8). Une demi-bande de plus x8 -> x4 (Kaiser, 23 coefficients, beta 10 :
//    -100 dB), puis les deux du site. Tout le moteur suit le taux interne (coefficients, lissages, rampes, ADAA) ; le
//    rythme du contexte reste le meme (bruit, coupure, hauteur, GLUE : une valeur par echantillon du contexte) ; le
//    MS-10 garde son plafond de 16 kHz et ne double ses pas qu'en x2, comme au site ; la FM garde la largeur de
//    bande du x4 (76.8 kHz a 48 kHz) : le meme son, sans le repliement. latencySamples() : 21 en x8.
//      v.setOs(8);      // thread audio, AUCUNE allocation (tout est alloue pour x8 au constructeur)
//      v.os();          // le taux en cours ; v.osPending() : un changement attend
//    setOs ne coupe rien net : les voix qui sonnent partent en 12 ms (comme stop) et le taux change au debut du
//    premier process() ou plus aucune voix ne sonne depuis 64 echantillons (au plus 0.3 s apres la demande ; ~0.1 s
//    en pratique). Pendant ce silence aucune note ne part. LA FILE EST GARDEE : les notes a venir jouent a leur
//    heure au nouveau taux ; une note dont l'heure est tombee pendant le silence part au changement si son gate court
//    encore (raccourci d'autant ; une note tenue repart donc), sinon elle est retiree. Les notes qui sonnaient au
//    moment de la demande sont perdues (a l'appelant de les rejouer s'il les tient). Les ancres, les reglages et la
//    suite du hasard restent. latencySamples() change avec le taux : le relire quand osPending() retombe.
//
// 2. LFO 1, SECONDE DESTINATION : le LFO MOD du site (meme phase, meme forme, memes ancres, meme lissage de 2 ms)
//    module AUSSI une destination de la liste ci-dessous. Cles : xl1Dest (0 OFF, 1..10), xl1Amt (0..1).
//
// 3. LFO 2, independant, cale sur les memes ancres 'beat' que le LFO 1. Cles :
//      l2Beats  la duree du cycle en temps, 0.125 a 32 (defaut 4)
//      l2Shape  0 SINE (-cos : part du bas comme le triangle), 1 TRI, 2 SAW descendante, 3 RAMP montante, 4 SQR,
//               5 S&H, 6 RND lisse
//      l2Dest   0 OFF, 1 WAVE, 2 CUTOFF, 3 FM, 4 PITCH (les lois du LFO 1 du site : WAVE 2 formes d'onde, CUTOFF
//               3 octaves, FM +/-0.6, PITCH +/-100 cents), puis 5..14 : la liste ci-dessous dans le meme ordre
//      l2Amt    0..1
//    Son hasard (S&H, RND) : une valeur par cycle tiree de (graine derivee de options.seed, numero du cycle), jamais du
//    generateur du moteur ; il ne depend donc que de la position du transport (une boucle ou un export le rejouent).
//    Un saut d'au moins 0.5 d'un cycle au suivant comme le LFO 1 (sauf un cycle sur 64, l'ancre de la chaine).
//
// Les destinations etendues (xl1Dest / l2Dest - 4) et leur profondeur a amt = 1, le LFO allant de -1 a +1 :
//    1 RES          +/-0.35 autour du potard, borne a 0..1
//    2 AMP          tremolo : plein niveau LFO en haut, -100 % (silence) LFO en bas ; sur le VCA de chaque voix,
//                   avant la saturation et le bus
//    3 PAN          plein gauche (LFO en bas) a plein droite, a puissance constante (1 au centre, racine de 2 au bord),
//                   sur la sortie du bus
//    4 OSC 2 PITCH  +/-12 demi-tons sur OSC 2 seul (avec SYNC : le balayage de sync)
//    5 OSC MIX      la balance : LFO en haut OSC 2 seul, en bas OSC 1 seul (aucun des deux ne depasse son niveau)
//    6 NOISE        +/-1 autour du potard, borne a 0..1 (potard a 0 : de 0 au plein niveau sur la moitie haute)
//    7 SUB          +/-0.88 (le plein niveau du site) autour du potard, borne a 0..0.88
//    8 DRIVE        +/-0.5 autour d'OVERDRIVE, borne a 0..1
//    9 STACK        +/-15 cents autour de l'ecart, borne a 0..30 ; n'agit que si STACK est engage (stack > 0 a la note)
//   10 ENV AMT      +/-3 octaves autour d'ENV AMT, borne a 0..6
//    Deux LFO sur la meme destination s'additionnent avant la borne. Rien ne clique : la quantite glisse (15 ms), une
//    destination ne change que quand sa quantite est revenue a 0, et la modulation se calcule la ou le moteur calcule
//    deja la sienne (LFO et quantite a chaque echantillon interne ; hauteur, coupure, PAN, DRIVE, STACK a chaque
//    echantillon du contexte).
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
  int os = 4;          // 1, 2, 4 ou 8 (autre valeur : 4, comme le JS ; 8 : QUALITY HQ, le plugin seul)
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
  /** glideSec (le plugin seul) : le glissement propre de la note depuis fromMidi (0 : le GLIDE du patch). */
  void note(double timeSec, double midi, double gateSec, double accent, double fromMidi, double glideSec = 0);
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

  /** QUALITY : change le surechantillonnage (1, 2, 4, 8) depuis le thread audio, sans allocation (voir en tete). */
  void setOs(int os);
  int os() const;
  bool osPending() const;

 private:
  struct Impl;
  std::unique_ptr<Impl> m_;
};

}  // namespace mmarp
