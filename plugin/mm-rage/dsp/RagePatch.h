// MM-RAGE (2026-11-18, Mika : "l'equivalent de DISTO que j'ai mis dans ARP VST3, en VST3 aussi seul, avec une interface
// optimisee epuree de la taille de MM-HELL") : la DISTO du MM-ARP (facon Decapitator) en effet audio seul. Ici, sans JUCE
// (teste sur Linux par tests/presets_test.cpp) :
// - RagePatch : tous les reglages de la DISTO dans les unites des parametres du plugin (les memes lois 0..1 que le MM-ARP,
//   extra-params.json section disto, et le potard DISTO de la face pour DRIVE ; le LFO SYNC et sa note separes pour
//   l'automation, comme MM-HELL) ;
// - settingsOf : un patch et le tempo -> DecapSettings (comme PluginProcessor.cpp du MM-ARP) ;
// - la banque d'usine : INIT, les 20 presets de la DISTO du MM-ARP (src/v4/plugin/arp/disto.ts DISTO_PRESETS, memes noms,
//   memes valeurs), puis des familles propres au MM-RAGE ; un preset regle toute la DISTO, DRIVE et MIX compris (comme au
//   MM-ARP) ;
// - les textes des reglages (l'hote, l'interface).
#pragma once

#include "Decap.h"

#include <array>
#include <cmath>
#include <string>
#include <vector>

namespace mmrage {

constexpr int kStyles = mmarp::Decap::kStyles; // 12 : A ... CRUSH
constexpr int kLfoNotes = 9;                    // 8 BAR ... 1/32 (Hell::kLfoBeats du MM-ARP)
extern const char* const kStyleNames[kStyles];     // A, E, N, T, P, TAPE, FUZZ, DIODE, AMP, RECT, FOLD, CRUSH
extern const char* const kStyleLong[kStyles];      // TUBE PREAMP, TRANSISTOR...
extern const char* const kBandStyleNames[kStyles + 1]; // MAIN, puis les 12
extern const char* const kBandsNames[3];           // 1, 2, 3
extern const char* const kFilterNames[5];          // OFF, LP, BP, HP, PEAK
extern const char* const kBoxNames[5];             // OFF, SMALL, COMBO, STACK, RADIO
extern const char* const kShapeNames[5];           // SINE, TRI, SAW, SQUARE, RANDOM
extern const char* const kTargetNames[6];          // DRIVE, MORPH, TONE, PRE, POST, MIX
extern const char* const kLfoNoteNames[kLfoNotes]; // 8 BAR ... 1/32
extern const double kLfoBeats[kLfoNotes];          // temps par cycle

/**
 * Le niveau de la prise : la DISTO du MM-ARP sature le synthe multiplie par le gain de VOLUME du site (audio/synth.ts
 * volGain, 0.75^2 x 0.66 = 0.371 au depart, sans DELAY ni REVERB). MM-RAGE prend la meme reference : une piste qui crete
 * a -6 dBFS entre dans les courbes la ou le synthe du MM-ARP y entrait.
 */
constexpr double kRef = 0.75 * 0.75 * 0.66;

struct BandPatch {
    int style = -1;      // -1 : MAIN (le style de la page et son MORPH), sinon 0..11
    double drive = 0.5;  // -18..+18 dB autour du DRIVE (0.5 : 0 dB)
    double mix = 1;
    double level = 0.5;  // -12..+12 dB (0.5 : 0 dB)
    bool solo = false;
    bool bypass = false;
};

struct RagePatch {
    int style = 0;         // 0 A ... 11 CRUSH
    double drive = 0.25;   // 0..1 : 0 a +36 dB (PUNISH : +20 dB)
    bool punish = false;
    double low = 0;        // 0 : OFF, sinon 20 a 1000 Hz
    bool thump = false;
    double tone = 0.5;     // 0 DARK, 0.5 neutre, 1 BRIGHT
    double high = 1;       // 1 : OFF, sinon 1 a 20 kHz
    bool steep = false;
    double mix = 1;
    double out = 0.5;      // -18..+18 dB
    bool autoGain = true;
    double morph = 0;
    int morphTo = 0;
    double dyn = 0.5;      // 0 COMP, 0.5 rien, 1 EXPAND
    double fb = 0;
    double fbFreq = 0.5;   // 40 Hz a 1.2 kHz
    int bands = 1;         // 1..3
    double xLo = 0.4;      // 40 Hz a 1 kHz
    double xHi = 0.5;      // 600 Hz a 15 kHz
    std::array<BandPatch, 3> band{};
    double envAmt = 0.5;   // 0.5 : rien
    double envSpeed = 0.3;
    int lfoShape = 0;
    bool lfoSync = false;
    double lfoRate = 0.4;  // FREE : 0.02 x 500^v Hz
    int lfoNote = 5;       // SYNC : 1/4
    double lfoAmt = 0.5;   // 0.5 : rien
    int lfoTarget = 0;
    int preMode = 0;       // OFF, LP, BP, HP, PEAK
    double preFreq = 0.5, preReso = 0;
    int postMode = 0;
    double postFreq = 0.5, postReso = 0;
    int box = 0;           // OFF, SMALL, COMBO, STACK, RADIO
    double boxSize = 0.5, boxMix = 1;
};

struct RagePreset {
    std::string name, desc;
    RagePatch p;
    std::string bank; // la famille : THE CLASSICS, BUS & GLUE, DRUMS...
};

/** La banque d'usine : INIT, les 20 du MM-ARP (dans son ordre), puis les familles du MM-RAGE. */
const std::vector<RagePreset>& factory();
/** Les familles, dans l'ordre de la banque. */
const std::vector<std::string>& families();
/** L'indice de INIT dans factory(). */
int initIndex();
/** Les reglages egaux (au millieme). */
bool same(const RagePatch& a, const RagePatch& b);
/** Le preset d'usine egal au patch, sinon -1. */
int match(const RagePatch& p);

/** La vitesse du LFO en Hz (bpm : le tempo de l'hote). */
double lfoHz(const RagePatch& p, double bpm);
/** Le patch vers le DSP. DRIVE 0 reste en circuit (0 dB) : le retard du plugin ne change jamais. */
mmarp::DecapSettings settingsOf(const RagePatch& p, double bpm);
/** Les reglages sans effet tels que le patch est regle (grises dans la fenetre). */
bool inert(const RagePatch& p, const std::string& id);

namespace text {
std::string percent(double v);
std::string drive(double v, bool punish);
std::string low(double v);
std::string high(double v);
std::string tone(double v);
std::string outDb(double v);
std::string dyn(double v);
std::string bipolar(double v);  // 0..1, 0.5 : 0 -> "-35 %"
std::string fbFreq(double v);
std::string xLo(double v);
std::string xHi(double v);
std::string filtFreq(double v);
std::string reso(double v);
std::string bandDrive(double v);
std::string level(double v);
std::string envSpeed(double v);
std::string lfoRate(double v);
std::string boxSize(double v);
std::string hz(double f);       // "440 HZ", "1.20 KHZ"
std::string db(double d, int decimals = 1); // "+3.0 DB"
} // namespace text

} // namespace mmrage
