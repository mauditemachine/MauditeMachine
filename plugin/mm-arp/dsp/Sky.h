// MM-ARP, la reverbe facon BigSky (2026-11-16, Mika : "quand on clic sur le knob Reverb on tombe sur une page de
// configuration pour la reverb avec tous les parametres AINSI QUE la qualite de Strymon BigSky mais au design de MM-ARP").
// Le plugin seul. Port C++ de la reference JS ecrite pour le site puis abandonnee (branche claude/gallant-franklin-3hka73,
// docs/vst3/sky-reference : sky.worklet.js le moteur, sky.ts le modele) ; la liste des machines et leurs reglages
// viennent du manuel public du BigSky, les algorithmes sont les notres.
//
// Douze machines, dans l'ordre du selecteur TYPE : ROOM, HALL, PLATE, SPRING, SWELL, BLOOM, CLOUD, CHORALE, SHIMMER,
// MAGNETO, NONLINEAR, REFLECTIONS. Le coeur : un FDN de huit lignes rebouclees par une matrice de Householder, lues en
// Hermite a un retard module (deux sinus par ligne), un passe-tout par ligne, un amortissement en trois bandes cale pour
// que DECAY soit le vrai Tr60 ; avant lui le coupe-bas de LOW END, le PRE-DELAY qui glisse, quatre diffuseurs par canal,
// les premieres reflexions d'une vraie piece (sources images) ; apres lui le passe-bas de TONE. Les machines a part
// (ressorts, SWELL, BLOOM, formants, transpositeurs, bande multi-tetes, prises non lineaires, reflexions) : voir Sky.cpp.
//
// - set(type, norm) : la machine (0 a 11) et ses reglages 0..1 (SkyNorm : DECAY, PRE-DELAY, TONE, MOD, LOW END et cinq
//   reglages propres a la machine, p[0..4], dans l'ordre de la page) ; skyEngine() les traduit en grandeurs physiques
//   (les lois de sky.ts). Un changement de structure (machine, taille, ressorts, tetes, piece) passe par un fondu de
//   20 ms qui vide les lignes ; le reste glisse. Sans allocation ni verrou (thread audio).
// - process(inL, inR, outL, outR, n) : le mouille seul (l'envoi REVERB du MM-ARP entre, la reverbe sort), energie ~1
//   par canal pour une impulsion de 1 a chaque reglage de depart (SKY_GAIN), comme la reponse de la reverbe d'avant.
// - Au repos (une seconde de silence en entree et en sortie), plus rien n'est calcule ; au reveil tout repart d'un etat
//   vide : le rendu ne depend pas de la taille des blocs.
#pragma once

#include <array>
#include <cstdint>
#include <vector>

namespace mmarp {

constexpr int kSkyMachines = 12;
enum SkyMachine { SKY_ROOM = 0, SKY_HALL, SKY_PLATE, SKY_SPRING, SKY_SWELL, SKY_BLOOM, SKY_CLOUD, SKY_CHORALE, SKY_SHIMMER, SKY_MAGNETO, SKY_NONLINEAR, SKY_REFLECTIONS };

/** Les reglages d'une machine, de 0 a 1 (un reglage a crans : idx / (n - 1)). */
struct SkyNorm {
    double decay = 0.43, pre = 0.14, tone = 0.5, mod = 0.35, lowEnd = 0.5;
    std::array<double, 5> p{{0.5, 0, 0, 0, 0}};
};

/** Les grandeurs physiques d'une machine (sky.ts SkyEngineParams). */
struct SkyEngine {
    int algo = SKY_HALL;
    double t60 = 2.4, pre = 0, toneHz = 8000, hiMul = 0.7, hiHz = 4500, lowCut = 30, lowMul = 1, midMul = 1, mod = 0.3, modRate = 0.5;
    double scale = 1, apG = 0.4, diffusion = 0.75, erLevel = 0, tankLevel = 1, gain = 1;
    double roomW = 6, roomL = 5, roomH = 3, srcX = 0.5, srcY = 0.5, lstY = 0.15, beta = 0.8;
    int springs = 2;
    double drive = 1, rise = 0.5;
    bool swellDry = false;
    double bloomLen = 0.15, bloomFb = 0.5;
    int vowel = 0;
    double q = 8, shift1 = 2, shift2 = 0, shAmt = 0.5;
    int shMode = 1, heads = 4;
    bool uneven = false;
    double dTime = 0.4, fb = 0, nlTime = 0.3;
    int nlShape = 3;
    double lateLevel = 0.3;
};

/** Les reglages de depart d'une machine (sky.ts def ; les cinq propres dans l'ordre de la page). */
SkyNorm skyDefaults(int machine);
/** Le modele (sky.ts) : les reglages de la page -> les grandeurs du moteur. */
SkyEngine skyEngine(int machine, const SkyNorm& n);
/** Les gains de sortie (sky.ts SKY_GAIN) : energie ~1 par canal au reglage de depart de chaque machine. */
extern const double kSkyGain[kSkyMachines];
/** Le Tr60 (s) de DECAY a v pour une machine (REFLECTIONS : la surface en pieds carres). */
double skyDecayOf(int machine, double v);

class Sky {
public:
    void prepare(double sampleRate);
    /** Tout a zero, les reglages en cours poses d'emblee. */
    void reset();
    /** Les reglages ; now : poses d'emblee (sans fondu). */
    void set(int machine, const SkyNorm& n, bool now = false);
    void setEngine(const SkyEngine& p, bool now = false);
    void process(const float* inL, const float* inR, float* outL, float* outR, int n);
    bool idle() const { return idle_; }

    // ---- les pieces (publiques pour Sky.cpp ; rien a regler de dehors) ----
    struct Line {
        std::vector<float> b;
        int m = 0, w = 0;
        void alloc(int n);
        void clear();
        void write(double x);
        float read(int d) const { return b[static_cast<size_t>((w - d) & m)]; }
        double readF(double d) const;
    };
    struct Allpass {
        Line l;
        int d = 1;
        double g = 0;
        double run(double x);
    };
    struct Biquad {
        double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, z1 = 0, z2 = 0;
        bool on = true;
        void lowpass(double f, double sr);
        void highpass(double f, double sr);
        void clear() { z1 = z2 = 0; }
        double run(double x);
    };
    struct Tap {
        double d, gl, gr;
    };

private:
    void apply(const SkyEngine& p, bool now);
    void clearAll();
    void wake();
    void vowelCoefs();
    double tank(double inL, double inR, double& oR);
    void tankConfigure(double scale, double apG, double depth, double rate);
    void tankDecay(double t60, double low, double mid, double hi, double fLow, double fHi);
    double shiftRun(int c, int v);
    uint32_t rnd();

    double sr_ = 48000, k_ = 1;
    bool ready_ = false;
    SkyEngine p_{}, pending_{};
    bool havePending_ = false, have_ = false;
    int algo_ = SKY_HALL;
    // le reseau
    std::array<Line, 8> lines_;
    std::array<Allpass, 8> aps_;
    std::array<double, 8> len_{}, apLen_{}, gL_{}, gM_{}, gH_{}, sL_{}, sM_{}, ph1_{}, ph2_{}, dp1_{}, dp2_{}, y_{};
    double depth_ = 0, tApG_ = 0, aLow_ = 0, aHi_ = 0;
    // l'entree
    std::array<Line, 2> pre_;
    std::array<std::array<Allpass, 4>, 2> dif_;
    std::array<Biquad, 2> hp_, lp_;
    double preT_ = 0, preCur_ = 0;
    std::array<Tap, 16> er_{};
    int nEr_ = 0;
    double erPh_ = 0, erGain_ = 0, tankGain_ = 1, outGain_ = 1;
    // SPRING
    struct Spring {
        Line line;
        std::array<double, 40> ap{};
        double fb = 0, lp = 0, D = 0, g = 0, ph = 0;
        Biquad hp;
        bool on = false;
    };
    std::array<Spring, 3> springs_;
    double springLp_ = 0.5, drive_ = 1;
    // SWELL
    double env_ = 0, swell_ = 1, rise_ = 0.5;
    long quiet_ = 1;
    bool swArmed_ = true, swellDry_ = false;
    // BLOOM
    std::array<Allpass, 4> bloom_;
    double bloomFb_ = 0, bloomLp_ = 0, bloomGain_ = 0.5;
    // SHIMMER
    std::array<Line, 2> shLine_;
    struct Shifter {
        double win = 4000, ph = 0, ratio = 1;
    };
    std::array<std::array<Shifter, 2>, 2> shift_;
    std::array<Biquad, 2> shHp_, shLp_;
    double shFbL_ = 0, shFbR_ = 0, shAmt_ = 0.5;
    int shMode_ = 1;
    bool shTwo_ = false;
    // CHORALE
    std::array<std::array<double, 6>, 2> svf_{};
    std::array<double, 3> svfG_{}, svfLvl_{};
    double vPh_ = 0, vQ_ = 8;
    int vSet_ = 0, vRand_[2] = {0, 0};
    // MAGNETO
    Line tape_;
    std::array<double, 6> heads_{};
    std::array<std::array<Allpass, 2>, 6> headAp_;
    double tapeFb_ = 0, tapeLp_ = 0, tapeGain_ = 0.4, tapeLpA_ = 0.5, tapePh_ = 0, tapePh2_ = 0;
    Biquad tapeHp_;
    int nHeads_ = 4;
    // NONLINEAR
    Line nlLine_;
    std::array<double, 32> nlG_{}, nlD_{};
    double nlFb_ = 0, nlLp_ = 0, nlPh_ = 0, nlGain_ = 0, lateLevel_ = 0.3, nlRate_ = 0.6;
    // l'etat
    uint64_t structKey_ = 0;
    double fade_ = 1;
    int fadeDir_ = 0;
    long silent_ = 0;
    bool idle_ = false;
    long count_ = 0;
    uint32_t seed_ = 0x5a17u;
};

} // namespace mmarp
