// MM-RYTM : les effets du site apres la voix (audio/drums.ts build, fx.ts, sends.ts, tone.ts, chorus.ts et ses worklets
// glue et limiter), en C++ pur. La tranche de chaque piste (TONE, DIST, CHORUS, envois), le bus des pads et celui du kick,
// le DELAY et la REVERB partages, puis le master : GLUE (BIT, COMP), la garniture 0.84, le LIMITEUR.
// Rien n'alloue dans process() : tout est pose dans prepare() ou calcule hors du thread audio (la reponse de la reverb).
#pragma once

#include <array>
#include <complex>
#include <cstdint>
#include <memory>
#include <string>
#include <vector>

namespace mm {

// Les effets globaux du pattern (pattern.fx, les FX_SETTINGS) et du mix (TONE, LEVEL), tels que la face les envoie.
struct GlobalFx {
    double drive = 0, reverb = 0, delay = 0, chorus = 0;
    double dtime = 0.4, dfb = 2.0 / 3, bits = 0, comp = 0;
    double dtone = 0.638, rsize = 0.566, rtone = 0.442, rpre = 0.167, xtone = 1, crate = 0.624, cdepth = 0.5, brate = 0;
    double catk = 0.742, crel = 1, cthr = 0.45, cratio = 0.571, cknee = 0.5, cmake = 0, chpf = 0.5;
    double tone = 0;   // TONE global (-1 a 1)
    double level = 0.8; // LEVEL (gain au carre)
};

// La tranche d'une piste (audio/voicelaw.ts VoiceFx) : TONE -1 a 1, DIST, CHORUS, envois DELAY et REVERB 0 a 1.
struct SliceFx {
    double tone = 0, dist = 0, chorus = 0, delay = 0, reverb = 0;
};

// Les lois du site (pattern.ts fxLaw, drums.ts fxValue : la valeur de depart garde la constante d'avant).
struct FxLaws {
    static double dtoneHz(double v);
    static double reverbSeconds(double v);
    static double reverbHiEnd(double v);
    static double reverbPre(double v);
    static double xtoneHz(double v); // >= 16000 : ouvert
    static double chorusMul(double v);
    static double chorusDepth(double v);
    static int bitRate(double v);
    static double delaySeconds(double dtime, double bpm);
    static double delayFeedback(double dfb);
};

// La reponse de la reverb (sends.ts makeImpulse, a l'identique) decoupee pour la convolution, calculee hors du thread audio.
struct ReverbIR {
    static constexpr int B = 256;      // taille d'un bloc (la latence du retour)
    static constexpr int N = 2 * B;    // taille de la FFT
    int parts = 0;
    std::array<std::vector<std::complex<float>>, 2> H; // parts x (N/2 + 1) par canal
    std::string key;
    static std::shared_ptr<ReverbIR> make(double seconds, double hiEnd, double preDelay, double sr);
    // La reponse brute (pour les tests)
    static void impulse(double seconds, double hiEnd, double preDelay, double sr, std::vector<float>& L, std::vector<float>& R);
};

class FxChain {
public:
    static constexpr int kTracks = 16;
    static constexpr int kMaxBlock = 512;

    void prepare(double sr);
    // La reponse de la reverb a jouer (thread du calcul -> audio : un pointeur, lu au debut du bloc)
    void setReverbIR(const ReverbIR* ir) { nextIR_ = ir; }
    const ReverbIR* reverbIR() const { return nextIR_; }
    // La latence de la chaine : l'avance du LIMITEUR (Lw - 1 echantillons), a declarer a l'hote
    int latency() const { return limiter_.Lw - 1; }
    // Les reglages (thread audio, au debut du bloc)
    void setGlobal(const GlobalFx& g, double bpm);
    void setSlice(int track, const SliceFx& s, bool kickLane);

    // Les tranches : la sortie des voix de chaque piste (kTracks x 2 x n), puis le master dans outL/outR (ajoute).
    float* trackL(int t) { return tl_[static_cast<size_t>(t)].data(); }
    float* trackR(int t) { return tr_[static_cast<size_t>(t)].data(); }
    void clearTracks(int n);
    void markActive(int t) { active_[static_cast<size_t>(t)] = true; }
    // Les VU-metres (2026-11-10) : la crete de chaque tranche depuis la derniere lecture (apres TONE, DIST, CHORUS, a LEVEL)
    float takePeak(int t) {
        const float p = peak_[static_cast<size_t>(t)];
        peak_[static_cast<size_t>(t)] = 0.f;
        return p;
    }
    void process(float* outL, float* outR, int n);
    void reset();

    // Pour les tests : le master seul (GLUE puis LIMITEUR) sur un signal
    void masterOnly(float* L, float* R, int n);

private:
    struct Bq {
        double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
        double z1[2] = {0, 0}, z2[2] = {0, 0};
        void lowpass(double f, double sr);
        void highpass(double f, double sr);
        float run(int c, float x) {
            const double y = b0 * x + z1[c];
            z1[c] = b1 * x - a1 * y + z2[c];
            z2[c] = b2 * x - a2 * y;
            return static_cast<float>(y);
        }
        void clear() { z1[0] = z1[1] = z2[0] = z2[1] = 0; }
    };
    struct Tone {
        double v = 0;
        Bq hp, lp;
        void set(double tone, double sr);
        void process(float* L, float* R, int n);
    };
    struct Dist {
        double d = 0, x = 16000;
        double dry = 1, wet = 0, pre = 0.125;
        bool lpOn = false;
        Bq lp;
        void set(double drive, double xtoneHz, double sr);
        void process(float* L, float* R, int n);
    };
    struct Chorus {
        std::vector<float> bl, br;
        int w = 0;
        double ph[2] = {0, 0};
        double smDepth = 0.007, smMul = 1, ks = 0;
        double t = 0, depth = 0.007, mul = 1;
        double dry = 1, wet = 0;
        void prepare(double sr);
        void set(double amount, double mulV, double depthS);
        void process(float* L, float* R, int n, double sr);
    };
    struct DelayUnit {
        std::vector<float> bl, br;
        int w = 0;
        double time = 0.3, fb = 0.58;
        Bq lp, hp;
        void prepare(double sr);
        void process(const float* inL, const float* inR, float* outL, float* outR, int n, double sr);
    };
    struct Convolver {
        const ReverbIR* ir = nullptr;
        std::array<std::vector<float>, 2> inBuf;  // les 2B derniers echantillons d'entree
        std::array<std::vector<std::complex<float>>, 2> fdl; // parts x (N/2+1)
        std::array<std::vector<float>, 2> outBlock;
        int fill = 0;  // echantillons recus dans le bloc en cours
        int head = 0;  // la tete de la ligne de spectres
        int idle = 0;  // blocs sans entree (au-dela de la longueur : rien a calculer)
        std::vector<std::complex<float>> tmp, acc;
        void prepare(double sr);
        void attach(const ReverbIR* r);
        void process(const float* inL, const float* inR, float* outL, float* outR, int n);
        void block();
    };
    struct Glue {
        double mixB = 0, mixC = 0, thrS = 0, slopeS = 0, kneeS = 0, makeS = 0;
        bool first = true;
        double ms = 0, pk = 0, gr = 0, slow = 0;
        int ph = 0;
        double hold[2] = {0, 0};
        double hx1[2] = {0, 0}, hx2[2] = {0, 0}, hy1[2] = {0, 0}, hy2[2] = {0, 0};
        void process(float* L, float* R, int n, const GlobalFx& g, double sr);
    };
    struct Limiter {
        int Lw = 2;
        double rel = 0;
        std::vector<float> ringL, ringR;
        std::vector<double> reqs, box;
        int idx = 0, boxIdx = 0;
        double g = 1, boxSum = 0;
        std::vector<int> dq; // file monotone (indices)
        std::vector<double> dqv;
        int dqHead = 0, dqTail = 0;
        long counter = 0;
        void prepare(double sr);
        void process(float* L, float* R, int n);
    };

    double sr_ = 48000;
    GlobalFx g_;
    std::array<std::vector<float>, kTracks> tl_, tr_;
    std::array<bool, kTracks> active_{};
    std::array<float, kTracks> peak_{};
    std::array<SliceFx, kTracks> slice_{};
    std::array<bool, kTracks> kick_{};
    std::array<Tone, kTracks> sTone_;
    std::array<Dist, kTracks> sDist_;
    std::array<Chorus, kTracks> sChorus_;
    std::array<int, kTracks> tail_{}; // blocs de queue a calculer encore (chorus)
    Tone padsTone_, kickTone_;
    Dist padsDist_, kickDist_;
    Chorus padsChorus_;
    DelayUnit delay_;
    Convolver reverb_;
    const ReverbIR* nextIR_ = nullptr;
    Glue glue_;
    Limiter limiter_;
    std::vector<float> padsL_, padsR_, kickL_, kickR_, revL_, revR_, delL_, delR_, wetL_, wetR_, mL_, mR_;
};

} // namespace mm
