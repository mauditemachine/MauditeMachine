// ----------------------------------------------------------------------------------------------------------------
// DISTO (2026-11-16, Mika : "quand on clic sur le knob DISTO (nouveau nom au lieu de Overdrive) on tombe sur une page
// de configuration pour la disto avec tous les parametres AINSI QUE la qualite de Soundtoys Decapitator mais au design
// de MM-ARP" ; "c'est pour le vst"). Le plugin seul. Completee le 2026-11-17 (v25, la maquette validee par Mika : "ok
// code et publie, masque la pedale avec conversion") : le coeur facon Decapitator, le multibande, la dynamique et le
// feedback facon Saturn 2, le MORPH, les filtres avant / apres et la caisse facon Trash. Nos algorithmes, nos noms.
//
// Le flux (un canal ; les deux canaux ont les memes reglages) :
//   entree -> LOW CUT (12 dB/oct, THUMP) -> TONE (bascule 700 Hz) -> PRE FILTER -> + FEEDBACK -> pre-accentuation du
//   style -> [MULTIBANDE : 1, 2 ou 3 bandes Linkwitz-Riley 24 dB/oct] -> par bande : DRIVE (+ ENV, + LFO, + la bande),
//   surechantillonnage, la courbe du style (et son MORPH vers un second style), MIX et LEVEL de la bande, decimation ->
//   somme -> bloqueur de continu -> desaccentuation -> passe-bas du style -> HIGH CUT (6 ou 30 dB/oct) -> [la prise du
//   FEEDBACK] -> BOX -> POST FILTER -> DYNAMICS -> MIX (le sec retarde, en phase) -> OUTPUT
//
// Les reglages (0..1 comme ceux de la face ; les lois sont les fonctions statiques plus bas) :
//   style   0 A : un preampli a lampes de magnetophone : doux, chaud, harmoniques paires
//           1 E : une console a transistors : un genou plus dur, impair, le haut qui croustille
//           2 N : une entree a transformateur classe A : les graves saturent avant le haut, epais
//           3 T : une triode : tres asymetrique, paires, le grain
//           4 P : une pentode : dur, bourdonnant, impair, le haut tenu
//           5 TAPE : une bande, arctangente douce, le haut pre-accentue
//           6 FUZZ : un genou tres dur et tres decale (les alternances ne se ressemblent plus), le bas creuse
//           7 DIODE : un ecretage franc symetrique (droit jusqu'a 0.9) ; c'est aussi l'ancienne pedale DISTORTION
//           8 AMP : un ampli de guitare, asymetrique, medium pousse, le haut coupe a 7 kHz
//           9 RECT : un redresseur : l'alternance negative remonte, l'octave au-dessus grandit avec le niveau
//          10 FOLD : un replieur d'onde (sinus) : la crete se replie au lieu de s'ecraser
//          11 CRUSH : une quantification grossiere (douze marches jusqu'a 1) puis un ecretage dur
//           (le style MM de la page, l'OVERDRIVE du moteur, ne passe pas par ici : PluginProcessor laisse Decap
//           contourne et rend le DRIVE au moteur)
//   drive   0..1 : 0 a +36 dB dans la saturation (36 v) ; punish : +20 dB ; 0 : contournee AU BIT PRES
//   punish  l'ancien PUNISH (OLD DISTO PUNISH, xDPunish) : +20 dB, AUTO d'apres la table ; garde au bit pres
//   punish2 v46, PUNISH v2 (DISTO PUNISH, xDPunish2 ; Mika : "il doit faire mal celui la !") : les memes +20 dB, et
//           1. le "snarl" avant la courbe, non compense : une cloche +6 dB a 1.4 kHz (Q 0.9) et -3 dB sous 120 Hz (une
//              etagere) ; sur les bandes saturees seulement (CLEAN LOW reste propre) ;
//           2. un second etage apres la courbe du style, dans le surechantillonnage et par sa primitive (ADAA) : un
//              ecretage dur asymetrique (genou 0.9, biais 0.12) attaque a +6 dB ;
//           3. une compression legere du traite (la detection de DYNAMICS, 5 ms / 150 ms : jusqu'a -6 dB sur les forts) ;
//           4. AUTO qui mesure : la sonie (ponderee K, approchee ; 300 ms) du traite contre celle du meme son sans PUNISH
//              (la courbe du style sans les +20 dB, au taux de base, sa compensation de table) ; vise +3 dB, a +/- 18 dB
//              de la table ;
//           5. un plafond doux (tangente) a -0.3 dBFS en sortie.
//           Tout entre et sort par un fondu de 15 ms ; coupe (0), le chemin est celui d'avant au bit pres. Pas de retard
//           en plus. Les deux ensemble : v2.
//   CLEAN LOW (v46 : 2 bandes, la basse contournee) : LOW CUT ne coupe que la bande saturee (le grave propre reste)
//   low, thump, tone, high, steep, mix, out, autoGain, ref : ceux du Decapitator (voir les lois)
//   morph   0..1 : la courbe glisse du style vers morphTo (et ses accentuations, et sa compensation AUTO)
//   dyn     0..1 (0.5 : rien) : sous 0.5 le mouille est comprime (les forts baissent), au-dessus il est etendu ; la
//           detection : l'entree, 5 ms / 150 ms ; +/- 12 dB au plus, autour de -24 dBFS
//   fb      0..1 : le mouille (apres HIGH CUT) revient avant la saturation, par un passe-bande accorde a fbFreq et un
//           retard qui accorde la boucle sur fbFreq ; le gain de boucle reste sous 0.9 (normalise par le gain en petit
//           signal de la saturation) et le retour passe par une tangente : stable a fond
//   bands   1, 2 ou 3 ; xLo (LOW / MID) et xHi (MID / HIGH) : les coupures ; deux bandes : xLo seule
//   band[b] style (-1 MAIN : celui de la page et son MORPH), drive (-18..+18 dB autour du DRIVE), mix, level
//           (-12..+12 dB), solo, bypass (la bande passe sans saturation)
//   envAmt  0..1 (0.5 : rien) : l'enveloppe de l'entree ajoute jusqu'a +/- 24 dB au DRIVE ; envSpeed : son attaque
//           (1 a 30 ms) et son relachement (30 ms a 0.9 s)
//   lfo     shape (SINE, TRI, SAW, SQUARE, RANDOM), lfoHz, lfoAmt (0.5 : rien), lfoTarget : DRIVE (+/- 18 dB),
//           MORPH (+/- 0.5), TONE (+/- toute la course), PRE et POST (la frequence, +/- 2 octaves), MIX (+/- 0.5)
//   pre, post : OFF, LP, BP, HP, PEAK (cloche +12 dB) ; frequence 20 Hz a 20 kHz ; RESO : Q 0.707 (Butterworth, a 0)
//           a 11.3
//   box     OFF, SMALL, COMBO, STACK, RADIO : une caisse courte (filtres et une resonance de quelques ms) ; boxSize la
//           grandit ou la rapetisse (+/- 0.6 octave) ; boxMix : sa part
//
// MM_DECAP_NO_V2 (defini a la compilation) : la DISTO d'avant la v46, sans PUNISH v2 ni le LOW CUT de CLEAN LOW ;
// tests/decap_ref.cpp la compile a part pour que decap_test verifie OFF et OLD au bit pres.
//
// La qualite : la saturation surechantillonnee (filtres polyphases a phase lineaire, sinus cardinal fenetre de Kaiser
// beta 9, 33 coefficients par phase) ET par sa primitive (ADAA d'ordre 1). Une bande : x8. Le multibande : la bande du
// haut x8, celle du milieu x4, celle du bas x2 (deux bandes : x4 et x8) : un grave n'a pas d'harmonique a replier qui
// compte, et le pire cas (trois bandes, MORPH, FEEDBACK, tout) coute ~2.7 fois une bande (decap_test le mesure : ~150 ms
// par seconde stereo a 48 kHz, contre ~55 pour une bande). Toutes les bandes ont le meme retard : kLatency = 32
// echantillons de base (le sec aussi, pour MIX). Chaque style a une
// pre-accentuation et une desaccentuation exactement inverses (la reponse lineaire reste plate). Tout lisse : gains a
// l'echantillon, coupures tous les 16 echantillons (la sortie ne depend pas de la taille des blocs), les changements de
// STYLE, de bandes, de modes par un fondu de 6 ms, mise en route et arret par un fondu de 20 ms. Contournee : l'entree
// au bit pres, sans retard. Aucune allocation dans process.
//
// v49 LATENCY ZERO (DecapSettings::zeroLatency, les instances neuves) : le meme surechantillonnage par demi-bandes RII a
// phase minimale (Halfband.h, celles des decimateurs du moteur) : plus de retard pur (32 echantillons de moins), le
// retard de groupe au grave ~5.6 echantillons aller-retour ; les bandes gardent leurs taux et la meme phase (ZChain) ; le
// sec de MIX passe par le meme aller-retour ; la boucle du FEEDBACK compte ce retard. Mesure (latency_test) : petit
// signal a 0.001 dB d'EXACT en 3 bandes, niveau sature a 0.01 dB, une bande 72 -> 40 ms par seconde, 3 bandes 161 -> 107.
// ----------------------------------------------------------------------------------------------------------------
#pragma once

#include "Halfband.h"

#include <array>
#include <cstdint>
#include <vector>

namespace mmarp {

struct DecapBand {
    int style = -1;      // -1 : MAIN, sinon 0..11
    double drive = 0.5;  // -18..+18 dB (0.5 : 0 dB)
    double mix = 1;
    double level = 0.5;  // -12..+12 dB (0.5 : 0 dB)
    bool solo = false;
    bool bypass = false;
};

struct DecapSettings {
    int style = 0;         // 0 A ... 11 CRUSH
    double drive = 0;      // 0..1 (0 : contournee)
    bool punish = false;   // l'ancien PUNISH (OLD), au bit pres
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
    // v25
    double morph = 0;
    int morphTo = 0;       // 0..11
    double dyn = 0.5;
    double fb = 0;
    double fbFreq = 0.5;
    int bands = 1;         // 1..3
    double xLo = 0.4, xHi = 0.5;
    std::array<DecapBand, 3> band{};
    double envAmt = 0.5, envSpeed = 0.3;
    int lfoShape = 0;      // SINE, TRI, SAW, SQUARE, RANDOM
    double lfoHz = 1;
    double lfoAmt = 0.5;
    int lfoTarget = 0;     // DRIVE, MORPH, TONE, PRE, POST, MIX
    int preMode = 0;       // OFF, LP, BP, HP, PEAK
    double preFreq = 0.5, preReso = 0;
    int postMode = 0;
    double postFreq = 0.5, postReso = 0;
    int box = 0;           // OFF, SMALL, COMBO, STACK, RADIO
    double boxSize = 0.5, boxMix = 1;
    // v46
    bool punish2 = false;  // PUNISH v2 (l'emporte sur punish)
    // v49 LATENCY ZERO : le surechantillonnage par demi-bandes RII a phase minimale (Halfband.h) au lieu des RIF a
    // phase lineaire : aucun retard pur (latency() = 0) ; le multibande garde ses taux (x2, x4, x8) avec la meme phase
    // (ZChain) ; le sec de MIX passe par les memes demi-bandes (en phase avec le mouille). false : la DISTO d'avant, au
    // bit pres.
    bool zeroLatency = false;
};

class Decap {
public:
    static constexpr int kStyles = 12;
    static constexpr int kTaps = 33;            // par phase
    static constexpr int kLatency = kTaps - 1;  // 32 echantillons de base
    static constexpr int kOs = 8;               // une bande
    static constexpr int kTick = 16;            // les coupures, tous les 16 echantillons
    enum { STYLE_A, STYLE_E, STYLE_N, STYLE_T, STYLE_P, STYLE_TAPE, STYLE_FUZZ, STYLE_DIODE, STYLE_AMP, STYLE_RECT, STYLE_FOLD, STYLE_CRUSH };
    enum { F_OFF, F_LP, F_BP, F_HP, F_PEAK };
    enum { T_DRIVE, T_MORPH, T_TONE, T_PRE, T_POST, T_MIX };

    // les lois des reglages 0..1
    static double driveDbOf(double v, bool punish); // 36 v (+ 20)
    static double lowHzOf(double v);                // 0 (OFF) ou 20 x 50^u
    static double highHzOf(double v);               // 0 (OFF) ou 1000 x 20^(v / 0.98)
    static double tiltOf(double v);                 // -1..1
    static double outDbOf(double v);                // -18..18
    static double fbHzOf(double v);                 // 40 x 30^v (40 Hz a 1.2 kHz)
    static double xLoHzOf(double v);                // 40 x 25^v (40 Hz a 1 kHz)
    static double xHiHzOf(double v);                // 600 x 25^v (600 Hz a 15 kHz)
    static double filtHzOf(double v);               // 20 x 1000^v (20 Hz a 20 kHz)
    static double resoQOf(double v);                // 0.7071 x 16^v
    static double bandDbOf(double v);               // -18..18
    static double levelDbOf(double v);              // -12..12
    static double envAtkMs(double v);               // 1 x 30^v
    static double envRelMs(double v);               // 30 x 30^v
    static double boxScaleOf(double v);             // 2^((v - 0.5) x 1.2)
    // la courbe d'un style (pente 1 a l'origine, sauf CRUSH) et sa primitive ; la compensation AUTO (gain lineaire)
    static double curve(int style, double x);
    static double curveF(int style, double x);
    static double autoGainOf(int style, double driveDb);
    static double autoDbOf(int style, double driveDb);

    void prepare(double sampleRate);
    void reset();
    void set(const DecapSettings& s);
    void process(float* L, float* R, int n);
    bool active() const { return e_ > 0 || target_ > 0; }
    int latency() const { return active() && !cur_.zl ? kLatency : 0; }
    // ATTITUDE (le VU de la page) : le niveau qui entre dans la saturation, en dB (0 : la courbe commence a mordre)
    double attitudeDb() const { return vuDb_; }
    // le nombre de bandes en service et le surechantillonnage de chacune (le cout)
    int bandsActive() const { return nb_; }
    int bandOs(int b) const { return b >= 0 && b < nb_ ? path_[static_cast<size_t>(b)].os : 0; }

private:
    struct Bank {
        int os = 0, nd = 0;
        std::vector<double> ph; // os x kTaps
        std::vector<double> hd; // kLatency x os + 1 (decimation, gain 1)
    };
    // v49 LATENCY ZERO : x1 -> x8 puis x8 -> x1 par trois demi-bandes RII de chaque cote. Une bande a x2 ou x4 (le
    // multibande, comme EXACT) sature a son taux puis repasse par les etages qui lui manquent (lu4, lu8 : lineaires) :
    // toutes les bandes ont alors exactement la meme reponse lineaire (la meme phase aux coupures), pour le cout de la
    // saturation a x2 / x4.
    struct ZChain {
        IirUp2 u2, u4, u8, lu4, lu8;
        IirDown2 d8, d4, d2;
        void clear() {
            u2.clear();
            u4.clear();
            u8.clear();
            lu4.clear();
            lu8.clear();
            d8.clear();
            d4.clear();
            d2.clear();
        }
        // x1 -> os (2, 4 ou 8 echantillons dans o)
        void up(double x, double* o, int os) {
            double a[2], b[4];
            u2.run(x, a[0], a[1]);
            if (os == 2) {
                o[0] = a[0];
                o[1] = a[1];
                return;
            }
            u4.run(a[0], b[0], b[1]);
            u4.run(a[1], b[2], b[3]);
            if (os == 4) {
                for (int k = 0; k < 4; ++k) o[k] = b[k];
                return;
            }
            for (int k = 0; k < 4; ++k) u8.run(b[k], o[2 * k], o[2 * k + 1]);
        }
        // os -> x8 (les etages lineaires qui manquent) -> x1
        // (des declarations successives : l'ordre des arguments d'une fonction n'est pas garanti en C++)
        double down(const double* in, int os) {
            double b[4], c[8];
            const double* i8 = in;
            if (os < 8) {
                if (os == 2) {
                    lu4.run(in[0], b[0], b[1]);
                    lu4.run(in[1], b[2], b[3]);
                } else {
                    for (int k = 0; k < 4; ++k) b[k] = in[k];
                }
                for (int k = 0; k < 4; ++k) lu8.run(b[k], c[2 * k], c[2 * k + 1]);
                i8 = c;
            }
            const double e0 = d8.run(i8[0], i8[1]);
            const double e1 = d8.run(i8[2], i8[3]);
            const double e2 = d8.run(i8[4], i8[5]);
            const double e3 = d8.run(i8[6], i8[7]);
            const double f0 = d4.run(e0, e1);
            const double f1 = d4.run(e2, e3);
            return d2.run(f0, f1);
        }
        void flush() {
            u2.flush();
            u4.flush();
            u8.flush();
            lu4.flush();
            lu8.flush();
            d8.flush();
            d4.flush();
            d2.flush();
        }
    };
    static void zDesign(ZChain& z);
    struct Path {
        int os = 8;
        const Bank* bank = nullptr;
        std::array<std::vector<double>, 2> up, dn;
        int upW = 0, dnW = 0;
        std::array<double, 2> ax{}, fa{}, fb{};
        std::array<int, 2> sa{{-1, -1}}, sb{{-1, -1}};
        // v46 PUNISH v2 : le second etage (ADAA : l'entree et la primitive d'avant ; ok : a jour)
        std::array<double, 2> s2x{}, s2f{};
        std::array<bool, 2> s2ok{};
        // les gains lisses de la bande
        double gB = 1, mix = 1, level = 1, solo = 1;
        // v49 LATENCY ZERO : les demi-bandes RII de la bande (un canal chacune)
        std::array<ZChain, 2> z{};
    };
    struct Svf {
        double s1 = 0, s2 = 0;
    };
    struct Coef {
        double g = 0, k = 1.41421356237, a1 = 0;
        int mode = 0;
        double peak = 0; // PEAK : le gain lineaire - 1
    };
    static void svfSet(Coef& c, double hz, double q, double sr);
    static double svfRun(Svf& s, const Coef& c, double x, double& lp, double& bp, double& hp);
    static double filt(Svf& s, const Coef& c, double x);

    void clearState();
    void configure(); // la configuration voulue devient la courante (apres le fondu)
    void coefs(int mode); // 0 : une tranche (les glissements avancent) ; 1 : poses ; 2 : recalcules sans avancer
    double sr_ = 48000;
    DecapSettings s_;
    int target_ = 0;     // 1 : engagee
    double e_ = 0;       // le fondu de mise en route
    bool needReset_ = true;
    // la configuration (ce qui change par un fondu) : style, morphTo, bandes, styles des bandes, modes, caisse
    struct Config {
        int style = 0, morphTo = 0, bands = 1, preMode = 0, postMode = 0, box = 0;
        std::array<int, 3> bandStyle{{-1, -1, -1}};
        bool zl = false; // v49 LATENCY ZERO
        bool operator==(const Config& o) const {
            return style == o.style && morphTo == o.morphTo && bands == o.bands && preMode == o.preMode && postMode == o.postMode && box == o.box && bandStyle == o.bandStyle &&
                   zl == o.zl;
        }
    };
    Config cur_, want_;
    int nb_ = 1;
    // lissages
    double dir_ = 1;     // le gain du chemin direct (MM : OUTPUT)
    double sw_ = 1, drive_ = 0, mix_ = 1, out_ = 1, morph_ = 0, dynG_ = 1, fbG_ = 0;
    double tilt_ = 0, low_ = 20, high_ = 20000, preHz_ = 632, postHz_ = 632, fbHz_ = 219, xLo_ = 145, xHi_ = 3000, box_ = 1;
    double modNow_ = 0;  // le LFO (deja multiplie par AMOUNT)
    // le surechantillonnage
    std::array<Bank, 3> banks_; // x2, x4, x8
    std::array<Path, 3> path_;
    std::array<std::array<double, kLatency + 1>, 2> dry_{};
    int dryW_ = 0;
    // v49 LATENCY ZERO : le sec de MIX par les memes demi-bandes (en phase avec le mouille), le retard de groupe des
    // demi-bandes au grave (echantillons de base, la boucle du FEEDBACK en tient compte)
    std::array<ZChain, 2> zDry_{};
    int zGd_ = 0;
    // le LFO, les enveloppes, le VU
    double lfoPh_ = 0, lfoSm_ = 0, lfoRnd_ = 0;
    uint32_t rng_ = 22222u;
    double envE_ = 0, envD_ = 0, envV_ = 0, vuDb_ = -120;
    int tick_ = 0;
    // les coefficients de la tranche de 16
    struct Tick {
        double gLo = 1, gHi = 1, aPre = 0, aPost = 0, iLo = 1, iHi = 1, aSlp = 0, aT = 0, tLo = 1, tHi = 1;
        double gL = 0, kL = 1.41421356237, a1L = 1, gH = 0, aH = 0, a1A = 1, a1B = 1, aDc = 1;
        bool slp = false, lowOn = false, highOn = false, steep = false, morphOn = false;
        Coef pre, post, x1, x2, fbBp, boxHp, boxLp, boxPk1, boxPk2;
        int fbD = 0, boxD = 1;
        double boxFb = 0, boxNorm = 1;
        double eA = 0, eR = 0, dA = 0, dR = 0, vA = 0, vR = 0;
        double fbT = 0, dynT = 1, autoA = 1, autoB = 1;
        std::array<double, 3> gBT{{1, 1, 1}}, mixT{{1, 1, 1}}, levelT{{1, 1, 1}}, soloT{{1, 1, 1}};
        std::array<double, 3> bandDb{{0, 0, 0}};
    } t_;
    // les etats des filtres (par canal)
    struct Ch {
        double tilt = 0, pre = 0, post = 0, lc1 = 0, lc2 = 0, dcx = 0, dcy = 0, slp = 0, hc0 = 0, ha1 = 0, ha2 = 0, hb1 = 0, hb2 = 0;
        Svf preF, postF, a1, a2, a3, b1, b2, b3, ap, fbBp, boxHp, boxLp, boxPk1, boxPk2;
        double fbLast = 0;
        // v46 PUNISH v2 : le snarl de chaque bande (la cloche, l'etagere) ; la ponderation K approchee du traite et de
        // l'estimation sans PUNISH (passe-haut 60 Hz, etagere +4 dB au-dessus de 1.5 kHz)
        std::array<Svf, 3> snPk{};
        std::array<double, 3> snLs{};
        double kpH = 0, kpS = 0, keH = 0, keS = 0;
    };
    std::array<Ch, 2> ch_{};
    std::array<std::vector<double>, 2> fbBuf_, boxBuf_;
    int fbW_ = 0, boxW_ = 0;
    // v46 PUNISH v2 : le fondu (0..1), les sonies (300 ms) du traite et de l'estimation, le gain AUTO mesure (dB)
    double pun_ = 0, punMsP_ = 0, punMsE_ = 0, punGm_ = 0;
    bool punWas_ = false;
    Coef snPk_{};
    double aSnLo_ = 0, aKh_ = 0, aKs_ = 0, aMs_ = 0, snLoG_ = 0, kShG_ = 0;
    void punClear();
};

} // namespace mmarp
