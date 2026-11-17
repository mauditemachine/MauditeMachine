#pragma once
// MM-ARP v27 (2026-11-17) : l'EQ parametrique 6 bandes de la page SOUND et son analyseur.
//
// Chaque bande : ON, TYPE (HP, LOW SHELF, BELL, NOTCH, HIGH SHELF, LP), FREQ (20 Hz a 20 kHz), GAIN (-18 a +18 dB),
// Q (0.3 a 18), SLOPE (HP et LP : 12, 24 ou 48 dB par octave, des Butterworth en cascade, le Q de la bande sur la
// derniere section). Les filtres : les SVF de Simper (trapezoidaux, sans zipper quand les reglages bougent), en
// double, les reglages lisses tous les 16 echantillons (comptes depuis le debut : le resultat ne depend pas de la taille
// des blocs). Une bande qui s'allume ou s'eteint passe par un fondu de 10 ms.
// Au neutre (HP et LP eteintes, les autres a 0 dB, OUTPUT 0 dB) : contourne, la sortie d'avant au bit pres.
//
// SpecAnalyzer : l'analyseur de la page (thread audio : push copie les echantillons dans un anneau, rien d'autre ;
// thread du message : frame fait la FFT de 4096 points (Hann) et rend 96 bandes en dB, de 20 Hz a 20 kHz).
#include <array>
#include <atomic>
#include <vector>

namespace mmarp {

struct EqBandSettings {
    bool on = false;
    int type = 2;        // ParamEq::Type
    double hz = 1000;
    double db = 0;
    double q = 0.71;
    int slope = 0;       // 0 : 12, 1 : 24, 2 : 48 dB par octave (HP et LP)
};

class ParamEq {
public:
    enum Type { T_HP = 0, T_LOWSHELF, T_BELL, T_NOTCH, T_HIGHSHELF, T_LP, T_COUNT };
    static constexpr int kBands = 6;
    static constexpr int kTick = 16;
    // les lois des reglages (0..1)
    static double freqOf(double v);   // 20 Hz x 1000^v
    static double gainDbOf(double v); // 36 (v - 0.5)
    static double qOf(double v);      // 0.3 x 60^v
    static double outDbOf(double v);  // 24 (v - 0.5)

    void prepare(double sr);
    void reset();
    void set(const EqBandSettings* bands, double outDb, bool now);
    void process(float* L, float* R, int n);
    bool bypassed() const;

private:
    struct Sec {
        double a1 = 1, a2 = 0, a3 = 0, m0 = 1, m1 = 0, m2 = 0;
        double ic1[2] = {0, 0}, ic2[2] = {0, 0};
    };
    struct Band {
        EqBandSettings want{};
        double hz = 1000, db = 0, q = 0.71;   // lisses
        double mix = 0, mixT = 0;              // le fondu d'allumage
        int type = T_BELL, slope = 0, nSec = 1;
        bool act = false;
        Sec sec[4];
    };
    void coefs(Band& b);
    static bool needs(const EqBandSettings& w);
    double sr_ = 48000;
    Band b_[kBands];
    double out_ = 1, outT_ = 1;
    long tick_ = 0;
    double mixStep_ = 0.002;
};

class SpecAnalyzer {
public:
    static constexpr int kN = 4096, kBins = 96, kRing = 16384;
    void prepare(double sr);
    /** Thread audio : la moyenne des deux canaux dans l'anneau (sans allocation, sans verrou). */
    void push(const float* L, const float* R, int n);
    /** Thread du message : 96 bandes en dB (-100..+12), lissees ; false : rien de neuf depuis la derniere fois. */
    bool frame(float* outDb);
    double sampleRate() const { return sr_; }

private:
    double sr_ = 48000;
    std::vector<float> ring_ = std::vector<float>(kRing, 0.f);
    std::atomic<int> w_{0};
    int lastW_ = 0;
    std::vector<double> win_, re_, im_;
    std::array<float, kBins> smooth_{};
    std::array<int, kBins + 1> edge_{};
};

} // namespace mmarp
