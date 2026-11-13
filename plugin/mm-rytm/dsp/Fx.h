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
    // HELL (2026-11-13, Mika : "un effet type Echobode, pour avoir des choses vraiment pointues", "tu peux l'appeler Hell") :
    // un decaleur de frequence (facon Bode) dans la boucle d'un delay ; chaque piste y envoie (SliceFx::hell), le retour
    // (hmix) rejoint le master comme celui du DELAY. Tout de 0 a 1, comme les FX du pattern (des crans pour les choix).
    double hmix = 0.75;   // le retour
    double hrange = 0;    // 0 FINE (+/-200 Hz), 0.5 WIDE (+/-20 kHz), 1 SYNC (un tour par division)
    double hfreq = 0.587; // 0.5 : 0 Hz ; vers 0 le decalage descend, vers 1 il monte (au depart : +6 Hz, une spirale douce)
    double hphase = 0;    // la phase du decaleur (un tour)
    double hside = 1;     // 0 la bande du bas, 1 celle du haut, entre les deux un melange
    double hanti = 0.5;   // ANTI : le passe-haut qui empeche le repliement sous 0 Hz
    double htime = 0.545; // libre : 0.02 ms a 1 s ; SYNC : un cran de HELL_DIVS (1/128 a 1/2 mesure ; au depart 1/8)
    double hsync = 1;     // 1 : TIME cale sur le tempo
    double hfb = 0.6;     // FEEDBACK
    double hfilt = 0.8;   // FILTER : le passe-bas avant le decalage, 100 Hz (0) a 20 kHz (1)
    double hcross = 0;    // CROSS : gauche et droite echangees dans la boucle
    double hsmear = 0;    // SMEAR : la phase brouillee dans la boucle (des queues de reverb)
    double hlfo = 0;      // la cible du LFO : 0 OFF, 1/3 FREQ, 2/3 PHASE, 1 DELAY
    double hrate = 0.5;   // libre : 0.02 a 20 Hz ; SYNC : 8 mesures a 1/64
    double hlsync = 1;    // 1 : le LFO cale sur le tempo
    double hamt = 0;      // la profondeur du LFO
    double hstereo = 0;   // 1 : le LFO a l'envers a droite
    // La DIST facon Decapitator (2026-11-13, Mika : "pour la disto je voudrais des sous-parametres a la Decapitator") :
    // des reglages de toute la machine, pour la DIST de chaque piste et celle du master. Au depart : la DIST d'avant.
    double xstyle = 0;    // MM (celle d'avant), TAPE, DESK, IRON, TUBE, PENT : 0, 0.2, 0.4 ... 1
    double xtilt = 0.5;   // TONE : 0 sombre ... 0.5 neutre ... 1 clair, avant la saturation
    double xlow = 0;      // LOW CUT : 0 aucun, puis 30 a 500 Hz, avant la saturation
    double xthump = 0;    // THUMP : une bosse a la frequence du LOW CUT
    double xsteep = 0;    // STEEP : le HIGH CUT (TONE de DIST, xtone) a 36 dB par octave
    double xpunish = 0;   // PUNISH : +20 dB dans la saturation
    double xauto = 0;     // AUTO : le niveau de sortie suit celui d'entree
    double xmix = 1;      // MIX : la part saturee
    double xout = 0.5;    // OUTPUT : 0 a 1, -12 a +12 dB (0.5 : 0 dB)
};

// Les sous-reglages de la DIST (GlobalFx x...), tels que chaque DIST les lit
struct DistX {
    int style = 0;
    double tilt = 0, low = 0, thump = 0, punish = 0, mix = 1, out = 0;
    bool steep = false, autoG = false;
    bool plain() const { return style == 0 && tilt == 0 && low == 0 && punish == 0 && mix >= 1 && out == 0 && !steep && !autoG; }
    bool operator==(const DistX& o) const {
        return style == o.style && tilt == o.tilt && low == o.low && thump == o.thump && punish == o.punish && mix == o.mix && out == o.out && steep == o.steep && autoG == o.autoG;
    }
    static DistX of(const GlobalFx& g);
};

// PERFORM (2026-11-12, Mika : "le bouton PERFORM, j'aimerais qu'il serve vraiment pour le live, des cuts...") : ce que les
// pads de performance et le FILTER demandent au master, a chaque bloc. Des gestes tenus : relaches, tout revient.
struct PerfState {
    uint32_t cut = 0;          // les pistes coupees (bit t), en 4 ms
    int repeat = 0;            // le beat repeat : 0 aucun ; 1 a 4 : 1/4, 1/8, 1/16, 1/32 de mesure... de noire (voir REPEAT_PPQ)
    bool lowCut = false;       // les basses tuees (sous ~200 Hz)
    bool throwDelay = false;   // tout le mix part dans le DELAY
    bool throwReverb = false;  // tout le mix part dans la REVERB
    bool tape = false;         // le tape stop (la bande ralentit jusqu'a l'arret)
    double filter = 0;         // le filtre DJ : -1 passe-bas ferme ... 0 ouvert ... 1 passe-haut ferme
    double side = 0;           // le SIDECHAIN : 0 a 1, le mix (sauf la voie du kick) pompe a chaque temps
    bool throwHell = false;    // HELL THROW (2026-11-13) : tout le mix part dans HELL
    double hellMix = -1;       // le MIX de HELL (le parametre Hell Mix) ; negatif : celui du programme (hmix)
};

// La tranche d'une piste (audio/voicelaw.ts VoiceFx) : TONE -1 a 1, DIST, CHORUS, envois DELAY et REVERB 0 a 1.
struct SliceFx {
    double tone = 0, dist = 0, chorus = 0, delay = 0, reverb = 0;
    double hell = 0; // l'envoi vers HELL (2026-11-13)
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
    // HELL : le decalage (Hz), le temps (s), le passe-bas, la vitesse du LFO (Hz)
    static double hellShiftHz(double range, double freq, double bpm);
    static double hellSeconds(double time, bool sync, double bpm);
    static double hellFilterHz(double v);
    static double hellRateHz(double rate, bool sync, double bpm);
    // DIST : le LOW CUT (Hz, 0 : aucun)
    static double distLowHz(double v);
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
    // PERFORM (thread audio, au debut du bloc) : ce que les pads tiennent ; ppq et ppqPerSample : la grille du beat repeat
    // (playing faux : pas de grille, le repeat attend)
    void setPerf(const PerfState& p, double ppq, double ppqPerSample, bool playing);

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
    // Pour les tests : HELL seul (son entree, son retour sans hmix), une DIST seule (amount, sur place)
    void hellOnly(const float* inL, const float* inR, float* outL, float* outR, int n);
    void distOnly(double amount, float* L, float* R, int n);

private:
    struct Bq {
        double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0;
        double z1[2] = {0, 0}, z2[2] = {0, 0};
        void lowpass(double f, double sr);
        void highpass(double f, double sr);
        // Avec une resonance (le filtre DJ de PERFORM)
        void lowpassQ(double f, double q, double sr);
        void highpassQ(double f, double q, double sr);
        // Les etageres (le TONE de la DIST facon Decapitator)
        void lowShelf(double f, double db, double sr);
        void highShelf(double f, double db, double sr);
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
        // Les sous-reglages (DistX) : au depart (plain), le chemin d'avant, a l'identique
        DistX X;
        bool plain = true;
        double xFor = -1;           // le xtone pour lequel les filtres sont poses
        Bq lowSh, highSh, lowCut, lp2, lp3, dc;
        bool tiltOn = false, lowOn = false;
        double outG = 1, envIn = 0, envOut = 0, autoK = 1, ke = 0.00007;
        void set(double drive, double xtoneHz, double sr);
        void setX(const DistX& x, double sr);
        void process(float* L, float* R, int n);
        float shape(float u) const;
    };
    // HELL : un decaleur de frequence (deux chaines de passe-tout a 90 degres, un oscillateur en quadrature) dans la boucle
    // d'un delay (lecture Hermite, temps lisse comme un delay analogique), son passe-bas, ANTI, SMEAR, CROSS, un LFO sinus
    struct Hell {
        struct Hilbert {
            double xs[2][4][2] = {}, ys[2][4][2] = {};
            double qd = 0;
            void run(double x, double& i, double& q);
            void clear();
        };
        struct Ap {
            std::vector<float> b;
            int w = 0;
            float run(float x, float g) {
                const float d = b[static_cast<size_t>(w)];
                const float y = -g * x + d;
                b[static_cast<size_t>(w)] = x + g * y;
                if (++w >= static_cast<int>(b.size())) w = 0;
                return y;
            }
        };
        std::array<std::vector<float>, 2> buf;
        int w = 0, len = 0;
        std::array<Hilbert, 2> hil;
        std::array<Bq, 1> lp, anti; // un biquad garde les deux cotes
        std::array<std::array<Ap, 4>, 2> ap;
        double z[2] = {0, 0}, dcx[2] = {0, 0}, dcy[2] = {0, 0}, th[2] = {0, 0};
        double lfoPh = 0;
        double fNow = 0, dNow = -1, fbNow = 0, filtFor = -1, antiFor = -1;
        // Les reglages du bloc
        double fTo = 0, dTo = 0.1, fbTo = 0, side = 1, phase = 0, antiK = 0.5, filtHz = 20000, smear = 0;
        double lfoHz = 0, lfoAmt = 0, lfoMax = 200;
        int lfoTarget = 0;
        bool cross = false, stereo = false, lfoSync = false, shiftSync = false;
        double syncCycleQ = 0, lfoCycleQ = 0; // SYNC : un tour du decaleur, du LFO, en noires
        long quiet = 0;
        bool idle = true;
        void prepare(double sr);
        void set(const GlobalFx& g, double bpm, double sr);
        void process(const float* inL, const float* inR, float* outL, float* outR, int n, double sr, double ppq, double pps, bool playing);
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
    // Le master de PERFORM : beat repeat et tape stop (un tampon de 4 s du mix), low cut, filtre DJ
    struct Perf {
        std::vector<float> rl, rr; // le tampon circulaire du mix
        int w = 0;                 // la tete d'ecriture
        // Le beat repeat : la boucle [start, start + len) ; k les echantillons depuis son debut ; mix vers la boucle (0 a 1)
        int rDiv = 0;
        long rStart = 0;
        double rLen = 0, rK = 0;
        double rMix = 0;
        // La boucle d'avant (un autre repeat pendant qu'on tient) : elle s'efface pendant que la nouvelle entre
        long oStart = 0;
        double oLen = 0, oK = 0, oMix = 0;
        // Le tape stop : la lecture (double), sa vitesse ; tMix vers la bande (0 a 1)
        bool tOn = false;
        double tPos = 0, tRate = 1, tMix = 0;
        // Le low cut : deux passe-haut (24 dB) ; gLow la part du direct gardee (1 : rien ne change)
        Bq lo1, lo2;
        double gLow = 1;
        // Le filtre DJ : la valeur lissee, son cote (-1, 0, 1), le biquad (2 etages)
        double fNow = 0;
        int fSide = 0;
        double fWet = 0;
        Bq f1, f2;
        int fTick = 0;
        void prepare(double sr);
        void process(float* L, float* R, int n, const PerfState& p, double ppq, double pps, bool playing, double sr);
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
    Hell hell_;
    DistX distX_;
    Convolver reverb_;
    const ReverbIR* nextIR_ = nullptr;
    Glue glue_;
    Limiter limiter_;
    // PERFORM : l'etat du bloc, la grille, le master ; les coupes de chaque piste (gain lisse) et les envois jetes (lisses)
    PerfState perf_;
    double perfPpq_ = 0, perfPps_ = 0;
    bool perfPlaying_ = false;
    Perf perfFx_;
    std::array<float, kTracks> cutG_{};
    double throwD_ = 0, throwR_ = 0, throwH_ = 0;
    // Le retour de HELL garde pendant et apres un HELL THROW (il redescend doucement) : les spirales s'entendent meme a MIX 0
    double hellRet_ = 0;
    // Le SIDECHAIN : sa profondeur lissee, le gain de chaque echantillon du bloc
    double sideNow_ = 0;
    std::vector<float> duck_;
    std::vector<float> padsL_, padsR_, kickL_, kickR_, revL_, revR_, delL_, delR_, wetL_, wetR_, mL_, mR_, hellL_, hellR_;
    double bpm_ = 120;
};

} // namespace mm
