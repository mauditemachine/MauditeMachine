// MM-ARP : tout ce qui suit le moteur dans le graphe du site (src/v4/audio/synth.ts build, buildPingPong, applyFx,
// retime, volGain), en C++17 pur, sans JUCE. Port du 2026-11-09.
//
// Le graphe du site, tel qu'il est porte (chaque noeud du Web Audio a son equivalent ici) :
//
//   moteur -+-> HP1 -> HP2 (BASS MONO, Butterworth Q -3.0103 dB) -> CHORUS Juno-106 (insert) -> VOLUME --+--> sortie
//           |                                                                                            |
//           +-> mono (L+R)/2 -> LP1 -> LP2 -> gain du bas (= VOLUME) ------------> (mono duplique) ------+
//                                                                                                        |
//   VOLUME -> envoi DELAY -> HP 260 -> retard L <-> retard R (LP 4800 chacun, reinjection) -> merge ---+   |
//   VOLUME -> envoi TAPE -> 'mm-tape' (chorus.worklet.js) ----------------------------------------------+-> wet 0.8
//   VOLUME -> x1.25 (REVERB_BOOST) -> envoi REVERB (Send.set : min(1, max(0, v)) x 1.0) -> convolueur ---> sortie
//
// - CHORUS : chorus.ts buildJunoChorus (insert a bypass reel, sec JUNO.trim, mouille JUNO.trim x JUNO.wet ; OFF -> I/II :
//   la branche neuve se remplit 8 ms puis sec et mouille glissent en 20 ms ; I <-> II : la vitesse du triangle seule,
//   au debut du bloc de 128 suivant, sans saut ; OFF : retour en 20 ms, la branche meurt 60 ms apres (un ON avant
//   reprend la meme ligne, apres : une ligne neuve)) et chorus.worklet.js 'mm-chorus' kind 'juno', au bit pres.
// - DELAY : deux DelayNode (interpolation lineaire, delayTime a-rate), les biquads du Web Audio (Q 1 dB par defaut),
//   et le retard de 128 echantillons que Chromium ajoute dans le cycle (la reinjection gauche -> droite lit la sortie
//   du passe-bas gauche du bloc de rendu precedent : verifie dans un OfflineAudioContext, impulsion a 4800 echantillons
//   de retard -> echos a 4800, 9728 (+128), 14528...).
// - TAPE : chorus.worklet.js 'mm-tape' au bit pres (time a-rate, fb et tape k-rate lus au debut de chaque bloc de 128).
// - REVERB : la reverbe a lui du MM-ARP (drums.ts arpReverb = buildReverbBus(c, arpOut) : toujours IR_DEFAULT,
//   2.4 s, coupure 9 kHz -> 3 kHz, pre-delai 20 ms, graines 808 / 909, energie 1 par canal), fx.ts makeImpulse au bit
//   pres, ConvolverNode normalize = false (canal gauche par la reponse gauche, droit par la droite, sans latence).
//   La convolution FFT par blocs de 256 de plugin/mm-rytm/dsp/Fx.cpp, sans sa latence : les 256 premiers echantillons
//   de la reponse sont nuls (le pre-delai), ils sont retires.
// - VOLUME : volGain = volume^2 x 0.66 / (1 + 0.35 delay + 0.5 reverb), le meme sur le bas de BASS MONO.
// - AudioParam : valeurs en float, rampes lineaires (glide.ts : 20 ms depuis la valeur du dernier echantillon rendu),
//   retime (au moins 0.2 s, au plus 0.25 s de retard par seconde), coefficients des biquads recalcules a chaque
//   echantillon pendant une rampe de frequence (a-rate, comme Chromium).
// Ce qui suit la prise ARP du site (drums.ts arpOut -> analyseur -> limiteur/ecreteur du master -> MASTER) n'est pas a
// l'ARP : le seul reglage propre a l'ARP sur arpOut est le SIDECHAIN (Ducker), non porte ici.
//
// API (aucune allocation dans process ; tout est alloue dans prepare) :
//   ArpFx fx;
//   fx.prepare(sampleRate, maxBlock);           // alloue, calcule la reponse de la reverb, remet a zero
//   fx.set(settings, true);                     // comme applyFx(g, p, true) : valeurs posees (le CHORUS et l'envoi
//                                               // REVERB glissent quand meme, comme au site)
//   fx.set(settings, false);                    // comme applyFx(g, p) : glides de 20 ms, retime du DELAY
//   fx.retimeDelay(seconds);                    // un changement de tempo seul (pattern.subscribe du site)
//   fx.process(inL, inR, outL, outR, n);        // entree : la sortie du moteur ; sortie : la prise ARP (remplacee)
//   fx.reset();                                 // lignes et filtres a zero, reglages poses sans rampe
//   fx.latencySamples();                        // 0
// Comme au site, set(.., false) repart de la valeur courante a chaque appel : l'appeler quand un reglage change (le
// site l'appelle a chaque changement de voyParams), pas a chaque bloc.
#pragma once

#include <array>
#include <complex>
#include <cstdint>
#include <vector>

namespace mmarp {

struct ArpFxSettings {
    int chorus = 0;             // chorusMode(p.chorus) : 0 OFF, 1 I, 2 II
    double delay = 0;           // p.delay (0..1) : envoi et reinjection
    double reverb = 0;          // p.reverb (0..1) : la loi de Send.set appliquee dans le C++
    double tape = 0;            // fxAmount(p.tape)
    double delaySeconds = 0.375; // min(2, delaySixteenths(p.dlyTime) * 60 / bpm / 4) (le C++ appelant le calcule)
    double monoLowHz = 0;       // monoLowHz(p.monoLow) (0 : OFF -> 10 Hz)
    double volume = 0.8;        // p.volume brut ; volGain calcule dans ArpFx
};

// Les lois du site (src/v4/voyager/params.ts) pour l'appelant, a partir des valeurs brutes 0..1 des potards.
struct ArpFxLaws {
    static int chorusMode(double v);          // stepIndex('chorus') : round(v * 2)
    static double fxAmount(double v);         // v < 0.02 : 0
    static double monoLowHz(double v);        // v < 0.04 : 0, sinon 40 x 7.5^((v - 0.04) / 0.96)
    static int delaySixteenths(double v);     // [2, 3, 4, 6, 8][round(v * 4)]
    static double delaySeconds(double dlyTime, double bpm); // min(2, seiziemes x 60 / bpm / 4)
    static double volGain(double volume, double delay, double reverb);
};

namespace detail {

// Un AudioParam : valeur en float, une rampe lineaire au plus (toutes celles du site partent de "maintenant" apres
// cancelScheduledValues) : v0 tenu jusqu'a t1, puis droite jusqu'a v1 en t2 (secondes du contexte). Les valeurs de la
// rampe sont calculees comme Chromium (audio_param_timeline.cc ProcessLinearRamp, x86) : en float, par paquets de 4
// avec increment, le calcul repartant au debut de chaque bloc de rendu ; a k-rate, la formule serie.
struct Param {
    float v0 = 0, v1 = 0, last = 0;
    double t1 = 0, t2 = 0, sr = 48000;
    long sF = 0, eF = 0;
    bool ramp = false;
    void setNow(float v) {
        ramp = false;
        v0 = v1 = last = v;
        cq = -1;
    }
    // setValueAtTime(p.value, now) [setValueAtTime(p.value, t1)] linearRampToValueAtTime(to, t2)
    void rampTo(double t1s, double t2s, float to, double rate);
    float value() const { return last; }
    // les valeurs a-rate de n echantillons a partir de k0 (dans un meme bloc de rendu)
    void fill(long k0, int n, float* out);
    // la valeur k-rate du bloc qui commence en k
    float at(long k);
    bool moving() const { return ramp; }

private:
    void compute(long k0, int n, float* out);
    void run(long cf, int len, float* out) const;
    float serial(long cf) const;
    // les valeurs du bloc de rendu en cours (calculees d'un coup, quelle que soit la taille des blocs de l'hote)
    std::array<float, 128> cache{};
    long cq = -1;
};

// Le BiquadFilterNode de Chromium (Linux) : coefficients de l'Audio EQ Cookbook, Q en dB pour lowpass / highpass,
// forme directe I en double, sortie arrondie en float (et gardee telle dans l'etat).
struct WebBiquad {
    double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
    double x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    void set(bool lowpass, float hz, float qDb, double sr);
    float run(float x) {
        const float y = static_cast<float>(b0 * x + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2);
        x2 = x1;
        x1 = x;
        y2 = y1;
        y1 = y;
        return y;
    }
    void endQuantum(); // le rinçage des sous-normaux de Blink en fin de bloc
    void clear() { x1 = x2 = y1 = y2 = 0; }
};

// chorus.worklet.js 'mm-chorus' kind 'juno' (le mouille seul, deux sorties), au bit pres.
class JunoChorus {
public:
    void prepare(double sr);
    void start(double dmin, double dmax, double rate); // un noeud neuf (processorOptions)
    void setRate(double rate) { rate_ = rate; }        // un message { rate }
    // n echantillons d'un bloc de 128 ; endOfQuantum : le bloc finit ici (rinçage des etats)
    void process(const float* inL, const float* inR, float* oL, float* oR, int n, bool endOfQuantum);

private:
    double sr_ = 48000;
    std::vector<float> buf_;
    int w_ = 0;
    double c0_ = 0, c1_ = 0, pb_ = 0, pa_ = 0, px_ = 0, py_ = 0, ph_ = 0, rate_ = 0.513;
    std::array<double, 12> bq_{};
    std::array<double, 8> bz_{};
};

// chorus.worklet.js 'mm-tape', au bit pres.
class TapeDelay {
public:
    void prepare(double sr, double maxS);
    void reset();
    // n echantillons d'un bloc de 128 ; times : le temps (s) par echantillon (float, a-rate) ; fb et tape : les valeurs
    // k-rate du bloc ; inL null : pas d'entree
    void process(const float* inL, const float* inR, const float* times, float fb, float tape, float* oL, float* oR, int n);

private:
    struct Bq {
        double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, z1 = 0, z2 = 0;
        void make(bool lp, double hz, double sr, double q);
        double run(double x) {
            const double y = b0 * x + z1;
            z1 = b1 * x - a1 * y + z2;
            z2 = b2 * x - a2 * y;
            return y;
        }
    };
    double sr_ = 48000;
    std::vector<float> bL_, bR_;
    int w_ = 0;
    Bq hpIn_, hpL_, hpR_, lpL_, lpR_;
    double lpTape_ = -1, phW_ = 0, phF_ = 0.25;
    long quiet_ = 0;
    bool asleep_ = false;
};

// Le DelayNode : ligne en float, lecture en interpolation lineaire a delayTime x sr echantillons.
struct WebDelay {
    std::vector<float> buf;
    int w = 0;
    void prepare(double maxS, double sr) {
        buf.assign(static_cast<size_t>(maxS * sr) + 512, 0.f);
        w = 0;
    }
    float run(float x, float delayS, double sr) {
        const int N = static_cast<int>(buf.size());
        buf[static_cast<size_t>(w)] = x;
        double pos = static_cast<double>(w) + N - static_cast<double>(delayS) * sr;
        if (pos >= N) pos -= N;
        int i1 = static_cast<int>(pos);
        if (i1 >= N) i1 -= N;
        const int i2 = (i1 + 1) % N;
        const double f = pos - i1;
        if (++w == N) w = 0;
        return static_cast<float>((1.0 - f) * buf[static_cast<size_t>(i1)] + f * buf[static_cast<size_t>(i2)]);
    }
};

// La reverb : fx.ts makeImpulse (au bit pres) et une convolution FFT par blocs de 256 (plugin/mm-rytm/dsp/Fx.cpp),
// compensee : la reponse commence 256 echantillons plus tot (ils sont nuls, le pre-delai de 20 ms).
class Convolver {
public:
    static constexpr int B = 256, N = 2 * B, K = N / 2 + 1;
    static void impulse(double seconds, double hiEnd, double preDelay, double sr, std::vector<float>& L, std::vector<float>& R);
    void prepare(double sr);
    void reset();
    void process(const float* inL, const float* inR, float* outL, float* outR, int n);
    int latency() const { return latency_; }

private:
    void block();
    int parts_ = 0, latency_ = 0;
    std::array<std::vector<std::complex<float>>, 2> H_, fdl_;
    std::array<std::vector<float>, 2> in_, out_;
    std::vector<std::complex<float>> tmp_, acc_;
    int fill_ = 0, head_ = 0, idle_ = 0;
};

} // namespace detail

class ArpFx {
public:
    void prepare(double sampleRate, int maxBlock);
    void set(const ArpFxSettings& s, bool now);
    void retimeDelay(double seconds);
    void process(const float* inL, const float* inR, float* outL, float* outR, int n);
    void reset();
    int latencySamples() const { return 0; }

    // Pour les tests et l'interface
    int chorusMode() const { return mode_; }
    bool chorusLive() const { return branch_; }

private:
    static constexpr int Q = 128; // le bloc de rendu du Web Audio
    void processPiece(const float* inL, const float* inR, float* outL, float* outR, int n);
    void chorusSet(int m);
    void insertEngage(float dry, float wet);
    void insertRamp(detail::Param& p, float v);
    void insertRelease();
    void glide(detail::Param& p, double target);
    void retime(detail::Param& p, double t);
    void splitCoefs(float hz);

    double sr_ = 48000;
    int maxBlock_ = 0;
    long frame_ = 0;
    ArpFxSettings cur_{};
    bool have_ = false;

    // BASS MONO
    detail::Param splitHz_, low_;
    // les valeurs a-rate du morceau en cours
    std::array<float, Q> aSplit_{}, aLow_{}, aDry_{}, aWet_{}, aVol_{}, aDs_{}, aFb_{}, aDt_{}, aTs_{}, aTt_{}, aRs_{};
    detail::WebBiquad hp1_[2], hp2_[2], lp1_, lp2_;
    float splitAt_ = -1;
    // CHORUS (insert)
    int mode_ = 0;
    bool direct_ = true, branch_ = false;
    double notBefore_ = 0, teardownAt_ = -1;
    detail::Param dry_, wet_;
    detail::JunoChorus juno_;
    double pendingRate_ = 0;
    // VOLUME
    detail::Param vol_;
    // DELAY ping-pong
    detail::Param dSend_, fb_, dTime_;
    detail::WebBiquad dHp_, lpL_, lpR_;
    detail::WebDelay dl_, dr_;
    std::array<float, Q> lpHist_{};
    int lpHistI_ = 0;
    double delayAt_ = 0;
    // TAPE
    detail::Param tSend_, tFb_, tAmt_, tTime_;
    detail::TapeDelay tape_;
    float qFb_ = 0, qTape_ = 0;
    // REVERB
    detail::Param rSend_;
    detail::Convolver conv_;

    // tampons (prepare)
    std::vector<float> bHiL_, bHiR_, bJL_, bJR_, bTL_, bTR_, bTo_L_, bTo_R_, bTime_, bRL_, bRR_, bRoL_, bRoR_;
};

} // namespace mmarp
