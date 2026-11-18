// MM-HELL (2026-11-18, Mika : "l'equivalent de Echobod que j'ai mis dans ARP VST3, en VST3 aussi seul, avec une interface
// optimisee") : le HELL du MM-ARP en effet audio seul. Ici, sans JUCE (teste sur Linux par tests/presets_test.cpp) :
// - HellPatch : tous les reglages du HELL dans les unites des parametres du plugin (les memes lois 0..1 que le MM-ARP,
//   extra-params.json section hell ; SYNC et la note, le LFO SYNC et sa note, separes pour l'automation) ;
// - settingsOf : un patch, MIX, le tempo et la note jouee -> HellSettings (comme PluginProcessor.cpp du MM-ARP) ;
// - la banque d'usine : les 24 presets du HELL du MM-ARP (src/v4/plugin/arp/hell.ts HELL_PRESETS), memes noms, memes
//   valeurs (cinq corriges pour descendre vraiment), puis 48 presets propres au MM-HELL (v1.1, 2026-11-18, Mika : "vraiment
//   plus de presets completement differents"), en six categories ; un preset regle tout sauf MIX (la dose reste la tienne),
//   et met MIX a 35 % s'il etait a 0 ;
// - les textes des reglages (l'hote, l'interface) : les memes que la face du MM-ARP.
#pragma once

#include "Hell.h"

#include <cmath>
#include <string>
#include <vector>

namespace mmhell {

constexpr int kNotes = 13;    // DELAY en SYNC : 1/32 ... 1 BAR (Hell::kSyncBeats sans FREE)
constexpr int kLfoNotes = 9;  // LFO en SYNC : 8 BAR ... 1/32 (Hell::kLfoBeats)
extern const char* const kNoteNames[kNotes];
extern const char* const kLfoNoteNames[kLfoNotes];
extern const char* const kRangeNames[4];  // FINE, WIDE, SYNC, MIDI
extern const char* const kShapeNames[4];  // SINE, SAW, SQUARE, RANDOM
extern const char* const kTargetNames[4]; // FREQ, PHASE, LOW-PASS, DELAY
extern const double kSyncMult[9];         // RANGE SYNC : 1/16 ... 16 cycles par temps

struct HellPatch {
    bool sync = true;        // DELAY cale au tempo
    int note = 6;            // 1/8.
    double time = 0.5;       // FREE : 5 x 400^v ms (0.5 : 100 ms)
    double feedback = 0.5;   // 0..1
    bool cross = false;
    int range = 0;           // Hell::Range
    double shift = 0.5;      // 0..1, 0.5 : 0 Hz (la loi selon RANGE, Hell::shiftHzFor)
    double sideband = 1;     // 0 DOWN, 0.5 R.M., 1 UP
    double spread = 0;       // 0..1
    double phase = 0;        // 0..1 (x 360 degres)
    bool antiRefl = false;
    double smear = 0;        // 0..1
    double hp = 0;           // 0 : coupe, sinon 20 x 200^v Hz
    double lp = 1;           // 1 : coupe, sinon 300 x 66.7^v Hz
    int lfoShape = 0;
    bool lfoSync = false;
    double lfoRate = std::log(20.0) / std::log(500.0); // 0.02 x 500^v Hz (0.4 Hz)
    int lfoNote = 5;         // 1/4
    double lfoAmt = 0;       // -1..1
    bool lfoStereo = false;
    int lfoTarget = 0;
};

struct HellPreset {
    std::string name, desc;
    HellPatch p;
    std::string bank; // la categorie (le menu de la banque) : THE CLASSICS, MORE HELL, SPACE & DUB...
};

/** La banque d'usine : les 24 du MM-ARP (dans son ordre ; INIT est le 12e), puis les 48 du MM-HELL. */
const std::vector<HellPreset>& factory();
/** L'indice de INIT dans factory(). */
int initIndex();
/** Les reglages egaux (au millieme, MIX exclu). */
bool same(const HellPatch& a, const HellPatch& b);
/** Le preset d'usine egal au patch, sinon -1. */
int match(const HellPatch& p);

/** Le decalage du moment en Hz (bpm : le tempo de l'hote ; noteHz : la derniere note recue, 0 sans note). */
double shiftHz(const HellPatch& p, double bpm, double noteHz);
/** Le patch vers le DSP. */
mmarp::HellSettings settingsOf(const HellPatch& p, double mix, double bpm, double noteHz);
/** Le temps de la ligne en secondes (borne a 4 s comme le DSP). */
double delaySeconds(const HellPatch& p, double bpm);
/** La vitesse du LFO en Hz. */
double lfoHz(const HellPatch& p, double bpm);

namespace text {
std::string mix(double v);
std::string time(double v);
std::string percent(double v);
std::string shift(double v, int range);
/** Le decalage en clair quand RANGE est SYNC ou MIDI (le tempo, la note) : "+2.00 HZ" ; vide en FINE / WIDE. */
std::string shiftHzNow(double v, int range, double bpm, double noteHz);
std::string sideband(double v);
std::string phase(double v);
std::string hp(double v);
std::string lp(double v);
std::string lfoRate(double v);
std::string bipolar(double v); // -1..1 -> "-35 %"
std::string hz(double f);      // "440 HZ", "1.20 KHZ"
std::string noteName(double hz); // "A3" (0 : "")
} // namespace text

} // namespace mmhell
