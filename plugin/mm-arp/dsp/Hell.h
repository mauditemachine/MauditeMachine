// MM-ARP, HELL (2026-11-13, Mika : un effet facon Echobode, "un frequency shifter de Bode dans la boucle d'un delay").
// Le plugin seul : le site ne le connait pas. Apres toute la chaine (ArpFx), avant MASTER (le gain de l'hote).
//
//   entree -+-----------------------------------------------------------------(sec)----+--> sortie
//           |                                                                            |
//           +--> + --> ligne a retard (TIME) --> DECALEUR (Bode : UP / DOWN) --> TONE ---+--(mouille)
//                ^                                                         |
//                +---------------- x FEEDBACK <-- limiteur doux <----------+
//
// Le decaleur est DANS la boucle : chaque repetition est decalee une fois de plus (+SHIFT Hz par tour) ; en montant
// ou en descendant sans fin, on obtient les spirales et l'escalier sans fin (barber-pole) d'Echobode.
// - Decaleur : un transformateur de Hilbert IIR (deux chaines de 4 passe-tout du second ordre, 90 degres de 20 Hz a
//   20 kHz a 44.1 / 48 kHz), puis une modulation en bande laterale unique : up = I cos + Q sin, down = I cos - Q sin.
//   UP/DOWN dose les deux sorties (0 : DOWN seul, 0.5 : les deux, 1 : UP seul).
// - SHIFT : -5 a +5 kHz, en loi cubique (fin pres de 0) ; le LFO (sinus, RATE 0.02 a 10 Hz, DEPTH 0 a 400 Hz) s'y ajoute.
// - SPREAD : le canal droit decale de SHIFT x (1 - 2 SPREAD) (1 : a l'oppose) et son LFO en quadrature, et sa ligne
//   un peu plus longue (jusqu'a 23 ms).
// - TONE : 0.5 neutre ; dessous un passe-bas dans la boucle (18 kHz -> 600 Hz), dessus un passe-haut (20 Hz -> 3 kHz).
// - FEEDBACK : 0 a 1 (le limiteur doux de la boucle tient tout, meme a 1 avec le decaleur a 0 Hz).
// - MIX : 0 = contourne AU BIT PRES (process ne touche pas au signal) ; sinon sec min(1, 2 (1 - m)), mouille
//   min(1, 2 m), glissant sur 20 ms. Revenu a 0, la boucle est videe et l'effet de nouveau contourne.
// Aucune allocation hors de prepare ; independant de la taille des blocs (tout est calcule echantillon par echantillon).
#pragma once

#include <array>
#include <cstdint>
#include <vector>

namespace mmarp {

struct HellSettings {
    double mix = 0;        // 0..1 (0 : contourne)
    int sync = 0;          // 0 FREE (timeMs), sinon un indice de Hell::kSyncBeats
    double timeMs = 300;   // FREE : 5 a 2000 ms
    double feedback = 0.5; // 0..1
    double shiftHz = 0;    // -5000..5000
    double upDown = 1;     // 0 DOWN, 1 UP
    double spread = 0;     // 0..1
    double lfoHz = 0.2;    // 0.02..10
    double lfoDepthHz = 0; // 0..400
    double tone = 0.5;     // 0.5 neutre
};

class Hell {
public:
    static constexpr int kSync = 14;
    static const double kSyncBeats[kSync]; // FREE (0), 1/32 ... 1 BAR

    // les lois des reglages 0..1 de extra-params.json
    static double timeMsOf(double v);     // 5 x 400^v
    static double shiftHzOf(double v);    // 5000 x (2v - 1)^3
    static double lfoHzOf(double v);      // 0.02 x 500^v
    static double lfoDepthHzOf(double v); // 400 v^2

    void prepare(double sampleRate);
    void reset();
    void set(const HellSettings& s, double bpm);
    void process(float* L, float* R, int n);
    bool active() const { return on_; }
    double delaySeconds() const { return tgtD_[0] / sr_; } // la ligne gauche visee (tests)

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
    double sr_ = 48000;
    bool on_ = false;
    HellSettings s_;
    std::array<std::vector<float>, 2> line_;
    int mask_ = 0, w_ = 0;
    std::array<double, 2> d_{}, tgtD_{};
    std::array<Hilbert, 2> hil_;
    std::array<Biquad, 2> tone_;
    int toneMode_ = 0; // 0 aucun, 1 passe-bas, 2 passe-haut
    std::array<double, 2> ph_{};
    double lfoPh_ = 0;
    double mix_ = 0, mixTgt_ = 0, mixStep_ = 0;
    std::array<double, 2> fb_{};
};

} // namespace mmarp
