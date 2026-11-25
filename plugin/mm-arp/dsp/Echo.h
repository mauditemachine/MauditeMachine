#pragma once
// MM-ARP v27 (2026-11-17) : la page DELAY (Mika : facon Soundtoys EchoBoy et Waves H-Delay, leurs fonctions, nos
// algorithmes). Ce fichier : les lois de la page, la couleur de chaque style, et les pieces ajoutees aux deux coeurs
// du DELAY du site (ArpFx.cpp) : la chaine dans la boucle (saturation, diffusion, lofi, souffle, octave), les seize
// prises du mode RHYTHM, le ducking.
//
// Les deux coeurs restent ceux du site, au bit pres a leurs reglages de depart :
//   - TAPE (et SPACE, DUB, CASSETTE) : 'mm-tape' de chorus.worklet.js (ArpFx.cpp TapeDelay), WOBBLE = l'ancien TAPE ;
//   - DIGITAL (et ANALOG, LO-FI, CRYSTAL) : le ping-pong du site (deux DelayNode, LP 4800 dans la boucle, HP 260).
// Chaque piece ajoutee est contournee a son neutre (aucune operation de plus) : un projet converti de l'ancien DELAY
// sonne au bit pres (PluginProcessor::convertDelay).
#include <array>
#include <cstdint>
#include <vector>

namespace mmarp {

enum EchoStyle { ES_TAPE = 0, ES_ANALOG, ES_DIGITAL, ES_SPACE, ES_LOFI, ES_DUB, ES_CASSETTE, ES_CRYSTAL, ES_COUNT };
enum EchoMode { EM_SINGLE = 0, EM_DUAL, EM_PINGPONG, EM_WIDE, EM_RHYTHM, EM_COUNT };

/** Les reglages de la page DELAY (0..1 comme les potards, sauf les crans). MIX : le potard DELAY du site (l'envoi). */
struct EchoSettings {
    int style = -1;            // -1 : le DELAY du site tel quel (ArpFxSettings tape, dlyMode, reinjection liee a DELAY)
    int mode = EM_PINGPONG;    // SINGLE, DUAL, PING-PONG, WIDE, RHYTHM
    double fb = 0.4325;        // la reinjection, 0..1 (celle du site pour DELAY 0.25)
    double width = 1;          // la largeur des echos (1 : telle quelle)
    double offset = 0.5;       // la droite -25 % .. +25 % du temps (0.5 : rien)
    double sat = 0, wobble = 0.3, diff = 0;
    double low = 0.5, high = 0.5; // LOW CUT / HIGH CUT relatifs au style (0.5 : ceux du style)
    double groove = 0, feel = 0.5;
    double analog = 0, duck = 0, duckRel = 0.35;
    bool prime = false, lofi = false;
    int rhythm = 0;
};

/** Ce qu'un style ajoute a son coeur. */
struct EchoVoicing {
    bool tape;       // le coeur : la bande du site ; sinon le ping-pong numerique du site
    double lpMul;    // le passe-bas de la boucle (x celui du coeur)
    double hpMul;    // le passe-haut (x celui du coeur)
    double sat;      // saturation ajoutee
    double wobble;   // coeur numerique : modulation ajoutee ; bande : x pleurage et scintillement (wowMul)
    double diff;     // diffusion ajoutee
    double noise;    // souffle
    double shimmer;  // l'octave dans la boucle (CRYSTAL)
    int lofi;        // 0, 1 (le levier LOFI), 2 (LO-FI)
    bool heads;      // trois tetes (SPACE)
};

struct EchoLaws {
    static constexpr int kDivs = 7;
    static constexpr int kRhythms = 12;
    static constexpr int kTaps = 16;
    static constexpr double kMaxS = 2;         // le plus long echo (celui du site)
    static constexpr double kRhythmMaxS = 8;   // la ligne des seize prises
    /** SYNC : 1/32, 1/16, 1/8, 1/4, 1/2, 1 BAR, 2 BAR, en doubles croches. */
    static double divSixteenths(int i);
    /** STRAIGHT, DOTTED (x1.5), TRIPLET (x2/3). */
    static double noteMul(int note);
    /** FREE : 5 ms a 2 s. */
    static double msOf(double v);
    /** LOW CUT / HIGH CUT : x1/8 a x8 autour de celui du style (0.5 : exactement x1). */
    static double cutMul(double v);
    /** RELEASE du ducking : 30 ms a 900 ms. */
    static double duckRelS(double v);
    static const EchoVoicing& voicing(int style);
    /** Les seize niveaux d'un motif RHYTHM. */
    static const float* rhythm(int i);
    /** Le nombre premier le plus proche de ms (different de avoid), au-dessus de 2. */
    static int prime(double ms, int avoid);
    /** Les rapports des temps gauche et droite (GROOVE, FEEL, OFFSET, PRIME) pour un temps t (s) ; neutre : 1 et 1. */
    static void ratios(const EchoSettings& e, double t, double& kL, double& kR);
};

/** La chaine ajoutee dans la boucle, un canal : saturation, diffusion, lofi, souffle, octave. Contournee a zero. */
class EchoLoop {
public:
    void prepare(double sr, uint32_t seed);
    void reset();
    void set(double sat, double diff, int lofi, double noise, double shimmer);
    bool on() const { return on_; }
    /** send : l'envoi du moment (le souffle s'eteint avec MIX). */
    float run(float x, float send);

private:
    double sr_ = 48000;
    bool on_ = false;
    double k_ = 0;                      // saturation : tanh(k x) / k (0 : aucune)
    double g_ = 0;                      // diffusion : quatre passe-tout (0 : aucune)
    std::array<std::vector<float>, 4> ap_;
    std::array<int, 4> apW_{};
    int lofi_ = 0;
    double hInc_ = 1, hPh_ = 0, held_ = 0, q_ = 0, lpA_ = 1, lpY_ = 0;
    double noise_ = 0, nY_ = 0;
    uint32_t rng_ = 1, seed_ = 1;
    double shim_ = 0;                   // l'octave au-dessus (CRYSTAL)
    std::vector<float> pb_;
    int pw_ = 0, pW_ = 2048;
    double pd_ = 0, sLp_ = 0;
};

/** RHYTHM : seize prises sur une ligne mono, la reinjection depuis la seizieme. */
class EchoRhythm {
public:
    void prepare(double sr);
    void reset();
    /** levels : seize niveaux ; swing : 0..1/3 du pas sur les prises impaires ; lp / hp : les filtres de la boucle (Hz). */
    void set(const float* levels, double swing, double lpHz, double hpHz);
    /** x : l'envoi (deja passe par le passe-haut du delay) ; step : le pas (s) ; fb : la reinjection ; loop : la chaine. */
    void run(float x, float step, float fb, EchoLoop* loop, float send, float& oL, float& oR);

private:
    double sr_ = 48000;
    std::vector<float> buf_;
    int w_ = 0;
    std::array<float, 16> lv_{};
    double swing_ = 0, lpA_ = 1, hpA_ = 0, lpY_ = 0, hpY_ = 0, hpX_ = 0, oLp_[2] = {0, 0};
    float norm_ = 1;
    float read(double d) const;
};

/** DUCKING : les echos baissent pendant que le son joue (suiveur de crete du sec), remontent en RELEASE. */
class EchoDuck {
public:
    void prepare(double sr);
    void reset();
    void set(double amount, double releaseS);
    bool on() const { return amt_ > 0 || g_ < 1; }
    float gain(float dryAbs);

private:
    double sr_ = 48000, amt_ = 0, env_ = 0, g_ = 1, atk_ = 0, rel_ = 0, sm_ = 0;
};

} // namespace mmarp
