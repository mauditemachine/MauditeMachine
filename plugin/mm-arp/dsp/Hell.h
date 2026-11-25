// MM-ARP, HELL (2026-11-13, Mika : un effet facon Echobode, "un frequency shifter de Bode dans la boucle d'un delay" ;
// complete le 2026-11-17 : "HELL, c'est l'effet Echobode a la sauce Maudite Machine, il manque beaucoup de choses").
// Le plugin seul : le site ne le connait pas. Apres toute la chaine (ArpFx), avant MASTER (le gain de l'hote).
//
//   entree -+------------------------------------------------------------------------------------(sec)----+--> sortie
//           |                                                                                              |
//           +--> + --> retard (DELAY) --> SMEAR --> ANTI REFL --> DECALEUR (Bode) --> HP / LP / TONE ------+--(mouille)
//                ^                                                                          |
//                +------------- x FEEDBACK <-- limiteur doux <-- (CROSS : l'autre canal) ---+
//
// Le decaleur est DANS la boucle : chaque repetition est decalee une fois de plus ; en montant ou en descendant sans fin,
// les spirales et l'escalier sans fin (barber-pole) d'Echobode. Nos algorithmes, nos lois :
// - DELAY : FREE (timeMs, 5 ms a 2 s) ou SYNC (une valeur de note, calee au tempo de l'hote, 4 s au plus).
// - FEEDBACK 0..1 (un limiteur doux tient la boucle, meme a 1) ; CROSS : chaque canal se reinjecte dans l'autre.
// - SMEAR : quatre passe-tout de Schroeder dans la boucle (3 a 11 ms) : les repetitions se diffusent et s'adoucissent.
// - ANTI REFL : un passe-haut du 4e ordre a 1.2 x |decalage| avant le decaleur quand une bande descend : rien ne se replie
//   sous 0 Hz.
// - Decaleur : transformateur de Hilbert IIR (deux chaines de 4 passe-tout du second ordre), puis bande laterale unique :
//   up = I cos + Q sin, down = I cos - Q sin. SIDEBAND (upDown) : 0 DOWN, 0.5 les deux (modulation en anneau), 1 UP.
//   PHASE : un dephasage fixe de l'oscillateur du decaleur (0 a 360 degres ; a 0 Hz, une rotation de phase pure).
// - RANGE (le decalage, calcule par shiftHzFor) : FINE +/-3..200 Hz, WIDE +/-10..5000 Hz (log, 0 au centre), SYNC (des
//   multiples du tempo : 1/16 a 16 cycles par temps), MIDI (une fraction de la note jouee : 1/16 a 2 fois sa frequence).
// - HIGH-PASS (20 Hz a 4 kHz) et LOW-PASS (300 Hz a 20 kHz) dans la boucle, 12 dB/oct ; TONE (l'ancien reglage) reste.
// - LFO : SHAPE sinus / dent de scie / carre / aleatoire (echantillonne-bloque), RATE (Hz ou en notes, SYNC), AMOUNT
//   bipolaire, STEREO (le canal droit decale d'un quart de cycle), TARGET : FREQ (+/-400 Hz), PHASE (+/-180 degres),
//   LOW-PASS (+/-3 octaves), DELAY (+/-25 %). Sa sortie (lfoValue) va au VU de la face.
// - MIX : 0 = contourne AU BIT PRES (process ne touche pas au signal) ; sinon sec min(1, 2 (1 - m)), mouille min(1, 2 m),
//   glissant sur 20 ms. Revenu a 0, la boucle est videe et l'effet de nouveau contourne.
// Aucune allocation hors de prepare ; independant de la taille des blocs (tout est echantillon par echantillon, les
// filtres modules recalcules tous les 16 echantillons d'un compteur global).
#pragma once

#include <array>
#include <cmath>
#include <cstdint>
#include <vector>

namespace mmarp {

struct HellSettings {
    double mix = 0;        // 0..1 (0 : contourne)
    int sync = 0;          // 0 FREE (timeMs), sinon un indice de Hell::kSyncBeats
    double timeMs = 300;   // FREE : 5 a 2000 ms
    double feedback = 0.5; // 0..1
    bool cross = false;    // la reinjection croisee L <-> R
    double shiftHz = 0;    // le decalage (Hell::shiftHzFor)
    double upDown = 1;     // SIDEBAND : 0 DOWN, 0.5 les deux, 1 UP
    double spread = 0;     // 0..1
    double phase = 0;      // 0..1 (x 360 degres)
    bool antiRefl = false;
    double smear = 0;      // 0..1
    double hpHz = 0;       // 0 : coupe
    double lpHz = 0;       // 0 : coupe
    double lfoHz = 0.2;    // la vitesse du LFO (deja calee au tempo en SYNC)
    double lfoDepthHz = 0; // l'ancien LFO DEPTH (Hz ajoutes au decalage, toujours vers FREQ)
    int lfoShape = 0;      // 0 sinus, 1 dent de scie, 2 carre, 3 aleatoire
    double lfoAmt = 0;     // -1..1
    bool lfoStereo = false;
    int lfoTarget = 0;     // 0 FREQ, 1 PHASE, 2 LOW-PASS, 3 DELAY
    double tone = 0.5;     // 0.5 neutre (l'ancien reglage, toujours lu)
};

class Hell {
public:
    static constexpr int kSync = 14;
    static const double kSyncBeats[kSync]; // FREE (0), 1/32 ... 1 BAR
    static constexpr int kLfoSync = 9;
    static const double kLfoBeats[kLfoSync]; // 8 BAR ... 1/32 (temps par cycle)

    enum Range { FINE = 0, WIDE = 1, SYNC = 2, MIDI = 3 };

    // les lois des reglages 0..1 de extra-params.json
    static double timeMsOf(double v);     // 5 x 400^v
    static double shiftHzOf(double v);    // l'ancienne loi (avant RANGE) : 5000 x (2v - 1)^3
    static double shiftHzFor(double v, int range, double bpm, double noteHz);
    static double shiftVFor(double hz, int range); // l'inverse (FINE, WIDE) : la migration des anciens projets
    static double lfoHzOf(double v);      // 0.02 x 500^v
    static double lfoDepthHzOf(double v); // 400 v^2
    static double hpHzOf(double v);       // 0 : coupe ; 20 x 200^v
    static double lpHzOf(double v);       // 1 : coupe ; 300 x (20000 / 300)^v
    static double lfoSyncHz(double v, double bpm);

    void prepare(double sampleRate);
    void reset();
    void set(const HellSettings& s, double bpm);
    void process(float* L, float* R, int n);
    bool active() const { return on_; }
    double delaySeconds() const { return tgtD_[0] / sr_; } // la ligne gauche visee (tests)
    double lfoValue() const { return lfoOut_[0]; }          // -1..1, la sortie du LFO (le VU)

private:
    struct Hilbert {
        std::array<double, 4> a{}, b{};            // les coefficients (a^2) des deux chaines
        std::array<double, 8> xa{}, ya{}, xb{}, yb{}; // x[n-1], x[n-2], y[n-1], y[n-2] par etage
        double bPrev = 0;
        void clear();
        void run(double x, double& i, double& q);
    };
    struct Biquad {
        double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, z1 = 0, z2 = 0;
        double run(double x) {
            const double y = b0 * x + z1;
            z1 = b1 * x - a1 * y + z2;
            z2 = b2 * x - a2 * y;
            return y;
        }
        void clear() { z1 = z2 = 0; }
        void set(bool lowpass, double hz, double sr);
    };
    struct Allpass {
        std::vector<float> buf;
        int len = 1, pos = 0;
        double run(double x, double g) {
            const double d = buf[static_cast<size_t>(pos)];
            const double v = x + g * d;
            buf[static_cast<size_t>(pos)] = std::fabs(v) < 1e-25 ? 0.f : static_cast<float>(v);
            if (++pos >= len) pos = 0;
            return d - g * v;
        }
    };
    double lfoShape(double ph, int c);

    double sr_ = 48000;
    bool on_ = false;
    HellSettings s_;
    std::array<std::vector<float>, 2> line_;
    int mask_ = 0, w_ = 0;
    std::array<double, 2> d_{}, tgtD_{};
    std::array<Hilbert, 2> hil_;
    std::array<Biquad, 2> tone_;
    int toneMode_ = 0; // 0 aucun, 1 passe-bas, 2 passe-haut
    std::array<Biquad, 2> hp_, lp_;
    std::array<std::array<Biquad, 2>, 2> ar_; // l'anti-repliement : deux passe-haut par canal
    std::array<bool, 2> arAct_{};
    std::array<std::array<Allpass, 4>, 2> smear_;
    std::array<double, 2> ph_{};
    double lfoPh_ = 0;
    std::array<double, 2> lfoOut_{}, rnd_{}, lastFrac_{};
    uint32_t seed_ = 0x4e11u;
    uint64_t tick_ = 0;
    double mix_ = 0, mixTgt_ = 0, mixStep_ = 0;
    std::array<double, 2> fb_{};
};

} // namespace mmarp
