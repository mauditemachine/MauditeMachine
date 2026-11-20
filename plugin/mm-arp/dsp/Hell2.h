// MM-ARP, HELL v2 (2026-11-20, Mika : "la botte secrete de tout le plugin", "comme si la personne, quand elle tourne MIX,
// faisait un malaise de LSD croise a trop d'alcool", "chaque preset doit etre different des autres", "en sync tres
// souvent"). Option A choisie (le vortex). Le plugin seul : le site ne le connait pas. Meme place que HELL (Hell.h) :
// apres toute la chaine (ArpFx), avant l'EQ et MASTER ; il remplace HELL quand xHellV2 est a ON (les instances neuves),
// un projet d'avant (sans xHellV2) garde l'ancien moteur au bit pres.
//
// Une DESCENTE en six cercles, dans cet ordre de chaine :
//   entree -> V CHOP -> I ECHO -> II WARP -> IV SHATTER -> VI METAL -> III SPIN -> niveau -> MIX -> plafond -> sortie
// - I ECHO : Hell.cpp tel quel (delay + decaleur de Bode dans la boucle, ses 21 reglages), sec et mouille pleins ;
//   sa reinjection monte de 60 % a 100 % avec MIX.
// - II WARP : la hauteur plie en mesure, par une ligne a retard variable : WOBBLE (sinus, exact a +/- la profondeur),
//   BEND (triangle), DROP (la hauteur tombe puis revient au debut du cycle), STOP (arret de bande sur le dernier quart du
//   cycle), RANDOM (une hauteur tiree a chaque cycle, glissee). 0 a 12 demi-tons (12 v^2), 1/16 a 4 mesures.
// - III SPIN : le panoramique qui tournoie (milieu / cote), le chorus ivre (trois voix dont le retard titube : une
//   marche aleatoire lissee, un pas par double-croche), le passe-bas resonant qui balaie au rythme de SPIN RATE.
// - IV SHATTER : granulaire ; des grains de 1/64 a 1/4 (12 ms a 0.6 s), un tous les demi-grains sur la grille du tempo ;
//   SPRAY tire des octaves, des quintes, des grains a l'envers et les jette a gauche et a droite.
// - V CHOP : le stutter ; la grille (1/64 a 1/4) suit la position de l'hote, chaque case a une chance CHOP d'etre la
//   repetition de la case d'avant ; chaque repetition monte ou descend de CHOP PITCH (+/- 12 demi-tons, +/- 24 au total) ;
//   GATE coupe la repetition avant la fin de la case. Les tirages dependent du numero de la case (8 mesures puis ca
//   recommence) : le meme passage rejoue pareil, a l'export comme en direct.
// - VI METAL : la modulation en anneau (sur la note jouee x1, x1.5, x2, /2, ou au tempo x8, x32) et le peigne resonant
//   accorde sur la note, qui change de hauteur a chaque noire (OCTAVES, FIFTHS, MINOR, CHROMATIC, RANDOM).
// - MIX (xHellMix, le potard HELL de la face) est la descente : la part du chemin HELL est min(1, 2 MIX) (le sec s'efface
//   jusqu'a 50 %) ; en DESCENT les cercles entrent l'un apres l'autre (WARP a 10 %, SPIN 22 %, SHATTER 36 %, CHOP 50 %,
//   METAL 64 %, une courbe en S jusqu'a 100 %), en ALL ensemble (la part = MIX). MIX glisse sur 20 ms. A MIX 0 : contourne
//   AU BIT PRES (process ne touche pas au signal) ; revenu a 0, tout est vide et de nouveau contourne.
// - Le niveau : le chemin HELL suit l'entree (sa RMS 300 ms jamais plus de +2 dB au-dessus de celle de l'entree, ses
//   cretes +3 dB au plus, un gain qui descend en 30 ms et remonte en 500 ms) ; la reference de l'entree garde 3 s de
//   memoire (une queue d'echos n'est pas coupee quand les notes s'arretent). Puis un plafond doux : rien au-dessus de
//   -1 dBFS (lineaire jusqu'a -2 dBFS).
// - Le tempo : tout est en notes, cale sur la position de l'hote quand il joue (ppq), sinon sur une horloge propre qui
//   continue au meme tempo.
// Aucune allocation hors de prepare ; independant de la taille des blocs (tranches de 64 echantillons sur un compteur
// global, tout le reste echantillon par echantillon).
#pragma once

#include "Hell.h"

#include <array>
#include <cstdint>
#include <vector>

namespace mmarp {

struct Hell2Settings {
    HellSettings echo;     // I ECHO (son mix est ignore : sec et mouille pleins)
    double mix = 0;        // xHellMix, 0..1 (0 : contourne)
    int descent = 0;       // 0 DESCENT, 1 ALL
    double warp = 0;       // 0..1 (12 v^2 demi-tons)
    int warpRate = 2;      // Hell2::kRateBeats
    int warpShape = 0;     // 0 WOBBLE, 1 BEND, 2 DROP, 3 STOP, 4 RANDOM
    double spin = 0;       // 0..1
    int spinRate = 4;      // Hell2::kRateBeats
    double drunk = 0;      // 0..1
    double sweep = 0;      // 0..1
    double shatter = 0;    // 0..1
    int shatterSize = 2;   // Hell2::kGrainBeats
    double spray = 0.3;    // 0..1
    double chop = 0;       // 0..1
    int chopGrid = 3;      // Hell2::kChopBeats
    int chopSemis = 0;     // -12..12
    double chopGate = 1;   // 0..1
    double ring = 0;       // 0..1
    int ringTune = 0;      // 0 NOTE, 1 x1.5, 2 x2, 3 /2, 4 TEMPO x8, 5 TEMPO x32
    double comb = 0;       // 0..1
    int combSeq = 0;       // 0 OCTAVES, 1 FIFTHS, 2 MINOR, 3 CHROMATIC, 4 RANDOM
};

class Hell2 {
public:
    // Les reglages 0..1 de extra-params.json lus par HELL v2 (sans MIX ni xHellV2), dans cet ordre
    enum Key {
        kSync, kTime, kFb, kCross, kRange, kShift, kUpDown, kSpread, kPhase, kAntiRefl, kSmear, kHp, kLp, kLfoShape, kLfoSync,
        kLfoRate, kLfoAmt, kLfoStereo, kLfoTarget, kLfoDepth, kTone,
        kWarp, kWarpRate, kWarpShape, kSpin, kSpinRate, kDrunk, kSweep, kShatter, kShatterSize, kShatterSpray, kChop,
        kChopGrid, kChopPitch, kChopGate, kRing, kRingTune, kComb, kCombSeq, kDescent,
        kKeys
    };
    static const char* const kKeyIds[kKeys];
    static const int kKeySteps[kKeys]; // le nombre de crans (0 : continu), comme extra-params.json

    static const double kRateBeats[7];  // 1/16 ... 4 BAR (temps par cycle)
    static const double kChopBeats[7];  // 1/64 ... 1/4 (temps par case)
    static const double kGrainBeats[5]; // 1/64 ... 1/4
    // ou chaque cercle entre sur la course de MIX (DESCENT) : ECHO, WARP, SPIN, SHATTER, CHOP, METAL
    enum Circle { kEcho, kWarpC, kSpinC, kShatterC, kChopC, kMetalC, kCircles };
    static const double kEntry[kCircles];
    static double depth(int circle, double m, int mode);

    // Les valeurs 0..1 (v[kKeys]) vers les reglages, avec les lois de Hell.cpp pour I ECHO
    static Hell2Settings settingsOf(const double* v, double mix, double bpm, double noteHz);

    void prepare(double sampleRate);
    void reset();
    void set(const Hell2Settings& s, double bpm);
    // ppq : la position (en temps) du premier echantillon, quand l'hote joue (playing) ; sinon l'horloge propre
    void process(float* L, float* R, int n, double ppq, bool playing, double noteHz);
    bool active() const { return on_; }
    void stop(); // coupe sans rien vider (le moteur passe a l'ancien HELL) ; la prochaine entree repart de zero
    double lfoValue() const { return echo_.lfoValue(); }
    double beatNow() const; // la position (temps) du prochain echantillon (tests)

private:
    static constexpr int kChunk = 64;
    static constexpr int kGrains = 16;
    struct Line {
        std::vector<float> b;
        int m = 0, w = 0;
        void alloc(double samples);
        void clear();
        void push(double x) {
            b[static_cast<size_t>(w)] = static_cast<float>(x);
            w = (w + 1) & m;
        }
        double read(double d) const; // d echantillons en arriere (2 au moins), Hermite
    };
    struct Grain {
        double pos = 0, len = 0, rate = 1, t = 0, gl = 0, gr = 0;
        bool rev = false, on = false;
    };
    void activate();
    void runChop(int n, uint64_t t0, double bps);
    void runWarp(int n, uint64_t t0, double bps, double dWarp);
    void runShatter(int n, uint64_t t0, double bps, double dSh);
    void runMetal(int n, uint64_t t0, double bps, double dMetal, double noteHz);
    void runSpin(int n, uint64_t t0, double bps, double dSpin);

    double sr_ = 48000;
    bool on_ = false;
    Hell2Settings s_;
    double bpm_ = 120;
    Hell echo_;
    // l'horloge : beat = beatBase_ + (tick_ - tickBase_) x bps_
    uint64_t tick_ = 0, tickBase_ = 0;
    double beatBase_ = 0, bps_ = 0;
    bool anchored_ = false;
    double beatAt(uint64_t t) const { return beatBase_ + static_cast<double>(t - tickBase_) * bps_; }
    // MIX
    double m_ = 0, mTgt_ = 0, mStep_ = 0;
    double chopNow_ = 0; // CHOP x sa part dans la descente (la tranche en cours)
    double chunkM_ = 0;  // MIX au debut de la tranche de 64
    bool latched_ = false;
    // les tranches
    std::array<std::array<float, kChunk>, 2> y_{};
    // V CHOP
    std::array<std::vector<float>, 2> rec_, cap_;
    int capN_ = 0;
    long recLen_ = 0, capLen_ = 0;
    int64_t chopSlot_ = INT64_MIN;
    bool chopRep_ = false, chopFresh_ = false; // chopFresh_ : la case ou CHOP est entre (entamee, jamais rejouee)
    int chopCount_ = 0;
    double chopPos_ = 0, chopRatio_ = 1, chopGain_ = 1;   // la voix en cours
    double oldPos_ = 0, oldRatio_ = 1, oldGain_ = 0;      // la voix d'avant (le fondu de 3 ms)
    bool oldRep_ = false;
    double chopXf_ = 1;
    // II WARP
    std::array<Line, 2> wl_;
    double wd_ = 0, wdOld_ = 0, wXf_ = 1;
    int64_t wCycle_ = INT64_MIN;
    double wRandFrom_ = 0, wRandTo_ = 0;
    // IV SHATTER
    std::array<Line, 2> gl_;
    std::array<Grain, kGrains> grains_{};
    int64_t gHop_ = INT64_MIN;
    // VI METAL
    std::array<Line, 2> comb_;
    double combP_ = 100, combPT_ = 100, combNh_ = 0;
    int64_t combBeat_ = INT64_MIN;
    double ringPh_ = 0;
    // III SPIN
    std::array<Line, 2> ch_;
    double walk_[2][3] = {{0}}, walkV_[2][3] = {{0}};
    double sv1_[2] = {0, 0}, sv2_[2] = {0, 0};
    // le niveau
    double eIn_ = 0, pIn_ = 0, eRef_ = 0, pRef_ = 0, eY_ = 0, pY_ = 0, gain_ = 1;
    double dc_[2] = {0, 0}, dcX_[2] = {0, 0};
    // les constantes du taux
    double kComb_ = 0, kW1_ = 0, kW2_ = 0, kPull_ = 0, aRms_ = 0, rel_ = 0, hold_ = 0, gDown_ = 0, gUp_ = 0, dcR_ = 0;
};

} // namespace mmarp
