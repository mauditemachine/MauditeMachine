// ----------------------------------------------------------------------------------------------------------------
// DISTO (2026-11-16, Mika : "quand on clic sur le knob DISTO (nouveau nom au lieu de Overdrive) on tombe sur une page
// de configuration pour la disto avec tous les parametres AINSI QUE la qualite de Soundtoys Decapitator mais au design
// de MM-ARP" ; "c'est pour le vst"). Le plugin seul. Elle remplace la DISTORTION d'avant (xDist, xDistTone).
//
// Les reglages, ceux d'un Decapitator (d'apres son manuel public ; le binaire n'a pas ete ouvert) :
//   style   0 A : un preampli a lampes de magnetophone (facon Ampex 350) : doux, chaud, harmoniques paires
//           1 E : une console a transistors (facon EMI TG) : un genou plus dur, impair, le haut qui croustille
//           2 N : une entree a transformateur classe A (facon Neve 1057) : les graves saturent avant le haut, epais
//           3 T : une triode (facon Culture Vulture T) : tres asymetrique, paires, le grain
//           4 P : une pentode (facon Culture Vulture P) : dur, bourdonnant, impair, le haut tenu
//           (le style MM de la page, l'OVERDRIVE du moteur, ne passe pas par ici : PluginProcessor laisse Decap
//           contourne et rend le DRIVE au moteur)
//   drive   0..1 : 0 a +36 dB dans la saturation (36 v) ; punish : +20 dB ; 0 : contournee AU BIT PRES
//   low     0..1 : LOW CUT avant la saturation, 12 dB/oct ; OFF sous 0.02, puis 20 Hz a 1 kHz (20 x 50^u) ;
//           thump : une bosse resonante (Q 2) sur sa coupure
//   tone    0..1 : avant la saturation, une bascule sombre / brillant de +/- 6 dB autour de 700 Hz (0.5 : FLAT)
//   high    0..1 : HIGH CUT apres la saturation, 6 dB/oct, 1 kHz a 20 kHz (1000 x 20^(v / 0.98)), OFF au-dessus de
//           0.98 ; steep : 30 dB/oct (Butterworth d'ordre 5)
//   mix     0..1 : le sec (retarde de la latence, en phase) contre le mouille
//   out     0..1 : OUTPUT, -18 a +18 dB (0.5 : 0 dB)
//   autoGain: le niveau compense selon le style et le DRIVE (une table mesuree sur les arpeges INIT et ACID,
//           scripts/disto-bench.mjs du site : la meme valeur efficace a 1.2 dB pres de 0 a +56 dB)
//   ref     le gain de VOLUME de la chaine (la saturation travaille au niveau de la prise, quel que soit VOLUME)
//
// La qualite : la saturation surechantillonnee x8 (filtres polyphases a phase lineaire, sinus cardinal fenetre de
// Kaiser beta 9, 32 coefficients par phase) ET par sa primitive (ADAA d'ordre 1) : un sinus de 7.3 kHz ecrete a fond
// (+56 dB, P) laisse -64 dBc de repliement sous 20 kHz. Chaque style a une pre-accentuation et une desaccentuation
// exactement inverses (etageres du premier ordre en TPT : la reponse lineaire reste plate). Un bloqueur de continu
// (8 Hz) apres la saturation. Tout lisse : gains a l'echantillon, coupures au bloc, STYLE par un fondu de 6 ms, mise en
// route et arret par un fondu de 20 ms. Engagee, la sortie est retardee de kLatency = 32 echantillons (le sec aussi,
// pour MIX) ; contournee : l'entree au bit pres, sans retard. Aucune allocation dans process.
// ----------------------------------------------------------------------------------------------------------------
#pragma once

#include <array>
#include <vector>

namespace mmarp {

struct DecapSettings {
    int style = 0;         // 0 A, 1 E, 2 N, 3 T, 4 P
    double drive = 0;      // 0..1 (0 : contournee)
    bool punish = false;
    double low = 0;        // 0..1
    bool thump = false;
    double tone = 0.5;     // 0..1
    double high = 1;       // 0..1
    bool steep = false;
    double mix = 1;        // 0..1
    double out = 0.5;      // 0..1
    bool autoGain = true;
    double ref = 1;        // le gain de VOLUME
    bool mm = false;       // MM : la saturation du moteur ; ici contournee, OUTPUT seul (sans retard, 1 au bit pres)
};

class Decap {
public:
    static constexpr int kStyles = 5;
    static constexpr int kTaps = 33;            // par phase
    static constexpr int kLatency = kTaps - 1;  // 32 echantillons de base
    static constexpr int kOs = 8;

    // les lois des reglages 0..1
    static double driveDbOf(double v, bool punish); // 36 v (+ 20)
    static double lowHzOf(double v);                // 0 (OFF) ou 20 x 50^u
    static double highHzOf(double v);               // 0 (OFF) ou 1000 x 20^(v / 0.98)
    static double tiltOf(double v);                 // -1..1
    static double outDbOf(double v);                // -18..18
    // la courbe d'un style (pente 1 a l'origine) et sa primitive ; la compensation AUTO (gain lineaire)
    static double curve(int style, double x);
    static double curveF(int style, double x);
    static double autoGainOf(int style, double driveDb);

    void prepare(double sampleRate);
    void reset();
    void set(const DecapSettings& s);
    void process(float* L, float* R, int n);
    bool active() const { return e_ > 0 || target_ > 0; }
    int latency() const { return active() ? kLatency : 0; }

private:
    void clearState();
    double sr_ = 48000;
    DecapSettings s_;
    int target_ = 0;     // 1 : engagee
    double e_ = 0;       // le fondu de mise en route
    bool needReset_ = true;
    // lissages
    int style_ = 0;
    double dir_ = 1;     // le gain du chemin direct (MM : OUTPUT)
    double sw_ = 1, drive_ = 0, mix_ = 1, out_ = 1, auto_ = 1, tilt_ = 0, low_ = 20, high_ = 20000;
    // le surechantillonnage
    std::vector<double> ph_;  // kOs x kTaps
    std::vector<double> hd_;  // kOs x kTaps + 1 (decimation, gain 1)
    int nd_ = 0;
    std::array<std::vector<double>, 2> upH_, dnH_; // historiques en double (lecture sans modulo)
    int upW_ = 0, dnW_ = 0;
    std::array<std::array<double, kLatency + 1>, 2> dry_{};
    int dryW_ = 0;
    // ADAA
    std::array<double, 2> ax_{}, aF_{};
    std::array<int, 2> aS_{{-1, -1}};
    // les filtres (par canal)
    struct Ch {
        double tilt = 0, pre = 0, post = 0, lc1 = 0, lc2 = 0, dcx = 0, dcy = 0, slp = 0, hc0 = 0, ha1 = 0, ha2 = 0, hb1 = 0, hb2 = 0;
    };
    std::array<Ch, 2> ch_{};
};

} // namespace mmarp
