// DISTO, facon Decapitator (2026-11-16 ; completee le 2026-11-17, v25) : voir Decap.h. Le coeur est le port de
// src/v4/audio/disto.worklet.js (le banc scripts/disto-bench.mjs du site l'a valide : contournement au bit pres,
// platitude, MIX en phase, repliement, AUTO) ; le reste (styles etendus, MORPH, multibande, dynamique, feedback,
// enveloppe, LFO, filtres, caisse) est a nous. tests/decap_test.cpp le controle. v46 : PUNISH v2 et le LOW CUT de CLEAN LOW
// (Decap.h) ; MM_DECAP_NO_V2 les retire (la DISTO d'avant, pour le controle au bit pres de decap_test).

#include "Decap.h"

#include <algorithm>
#include <cmath>

namespace mmarp {

namespace {

constexpr double kPi = 3.14159265358979323846;
constexpr double kLn2 = 0.69314718055994530942;
constexpr int NS = Decap::kStyles;

// Par style (A, E, N, T, P, TAPE, FUZZ, DIODE, AMP, RECT, FOLD, CRUSH) : l'etagere de pre-accentuation (Hz, dB du bas et
// du haut), le passe-bas d'apres la saturation (Hz, 0 : aucun), la polarisation de la courbe, le genou
constexpr double kPreHz[NS] = {300, 2000, 180, 800, 1200, 3000, 900, 1000, 700, 1000, 1000, 1000};
constexpr double kPreLoDb[NS] = {3, 0, 6, 0, -2, 0, -3, 0, -4, 0, 0, 0};
constexpr double kPreHiDb[NS] = {0, 5, 1.5, 2, 5, 4, 3, 0, 4, 0, 0, 0};
constexpr double kPostLpHz[NS] = {16000, 18000, 0, 14000, 11000, 15000, 9000, 0, 7000, 0, 0, 0};
constexpr double kBias[NS] = {0.2, 0.04, 0.08, 0, 0.12, 0.05, 0.35, 0, 0.15, 0, 0, 0};
constexpr double kKnee[NS] = {0, 0.55, 0, 0, 0.85, 0, 0.25, 0.9, 0, 0, 0, 0};
constexpr double kTapeA = kPi / 2;
constexpr double kRect = 0.9;
constexpr double kCrushQ = 1.0 / 12;
constexpr int kCrushK = 12;

// AUTO (dB) aux DRIVE totaux kAutoAt (dB) : A a P mesures (disto-bench.mjs) ; les autres : le modele d'un sinus de
// crete 0.2 (le niveau de la prise), cale sur A (StyleNorm)
constexpr int kAutoN = 10;
constexpr double kAutoAt[kAutoN] = {0, 6, 12, 18, 24, 30, 36, 42, 48, 56};
constexpr double kAutoMeas[5][kAutoN] = {
    {0.1, -5.6, -10.8, -14.7, -17, -18.2, -18.9, -19.3, -19.7, -20},
    {0, -6, -11.7, -16, -18.2, -19.1, -19.6, -20, -20.2, -20.6},
    {0.1, -5.7, -10.8, -14.2, -15.8, -16.7, -17.2, -17.6, -17.9, -18.2},
    {0.1, -5.6, -10.9, -15, -17.6, -19.1, -19.9, -20.3, -20.6, -21},
    {0, -6, -11.7, -16.5, -19.1, -20.1, -20.6, -21, -21.2, -21.6},
};

constexpr double kFirFc = 0.95; // la coupure, en part de la moitie de la frequence de base
constexpr double kKaiserBeta = 9;
constexpr double kFadeS = 0.02;
constexpr double kStyleFadeS = 0.006;
constexpr double kDcHz = 8;
constexpr double kTiltHz = 700;
constexpr double kTiltDb = 6;
constexpr double kAdaaEps = 1e-6;
constexpr double kOff = 0.02;
constexpr double kHighOff = 0.98;
constexpr double kSqrt2 = 1.4142135623730951;

// v46 : PUNISH v2 et le LOW CUT de CLEAN LOW (MM_DECAP_NO_V2 : la DISTO d'avant, au bit pres)
#ifdef MM_DECAP_NO_V2
constexpr bool kV2 = false;
#else
constexpr bool kV2 = true;
#endif
// le snarl : une cloche a 1.4 kHz (Q 0.9, +6 dB), une etagere -3 dB sous 120 Hz
constexpr double kSnHz = 1400, kSnQ = 0.9, kSnDb = 6, kSnLoHz = 120, kSnLoDb = -3;
// le second etage : un ecretage dur asymetrique (genou 0.9, biais 0.12) attaque a +6 dB, ramene a pente 1
constexpr double kP2Knee = 0.9, kP2Bias = 0.12, kP2Gain = 2;
// la compression : la detection de DYNAMICS ; au-dessus de -24 dBFS, -0.25 dB par dB, -6 dB au plus
constexpr double kPunCmpFrom = -24, kPunCmpSlope = 0.25, kPunCmpMax = 6;
// AUTO qui mesure : +3 dB au-dessus du son sans PUNISH, borne a +/- 18 dB de la table (la table, mesuree sur un sinus a
// -14 dBFS, laisse une basse chaude ~11 dB trop bas une fois comprimee et passee au second etage) ; la sonie sur 300 ms, ponderee K
// (approchee : passe-haut 60 Hz, etagere +4 dB au-dessus de 1.5 kHz)
constexpr double kPunLift = 3, kPunRange = 18, kPunMsS = 0.3, kKHpHz = 60, kKShHz = 1500, kKShDb = 4;
// le plafond doux : lineaire jusqu'a 70 %, puis une tangente vers -0.32 dBFS
constexpr double kCeil = 0.96383, kCeilKnee = 0.7 * 0.96383;

// BOX : passe-haut, passe-bas, deux cloches (Hz, dB, Q), la resonance (ms, retour)
struct BoxDef {
    double hp, lp, p1, p1Db, p1Q, p2, p2Db, p2Q, ms, fb;
};
constexpr BoxDef kBox[5] = {
    {0, 0, 0, 0, 1, 0, 0, 1, 1, 0},
    {160, 4200, 1800, 5, 1.2, 0, 0, 1, 1.1, 0.35},       // SMALL
    {90, 5200, 1200, 4, 0.9, 2600, -3, 2, 1.7, 0.3},     // COMBO
    {70, 4600, 110, 4, 1.0, 2200, 3, 1.2, 2.6, 0.3},     // STACK
    {420, 3000, 1500, 6, 1.5, 0, 0, 1, 0.7, 0.45},       // RADIO
};

double dbLin(double db) { return std::pow(10.0, db / 20.0); }
double linDb(double x) { return 20 * std::log10(std::max(1e-12, x)); }
double tptG(double f, double sr) { return std::tan(kPi * std::min(f, 0.49 * sr) / sr); }
double lerp(double a, double b, double t) { return a + (b - a) * t; }

double besselI0(double x) {
    double s = 1, t = 1;
    for (int k = 1; k < 40; ++k) {
        t *= (x / (2 * k)) * (x / (2 * k));
        s += t;
        if (t < 1e-14 * s) break;
    }
    return s;
}

double lncosh(double x) {
    const double a = std::fabs(x);
    return a + std::log1p(std::exp(-2 * a)) - kLn2;
}

double kneeG(double a, double u) {
    const double v = std::fabs(u);
    if (v <= a) return u;
    if (v >= 2 - a) return u < 0 ? -1 : 1;
    const double d = v - a;
    const double y = v - (d * d) / (4 * (1 - a));
    return u < 0 ? -y : y;
}
double kneeF(double a, double u) {
    const double v = std::fabs(u);
    if (v <= a) return 0.5 * v * v;
    const double e = 2 - a;
    if (v < e) {
        const double d = v - a;
        return 0.5 * v * v - (d * d * d) / (12 * (1 - a));
    }
    const double d = e - a;
    return 0.5 * e * e - (d * d * d) / (12 * (1 - a)) + (v - e);
}
double cubeG(double u) { return u > 1.5 ? 1 : u < -1.5 ? -1 : u - (4.0 / 27.0) * u * u * u; }
double cubeF(double u) {
    const double v = std::fabs(u);
    return v <= 1.5 ? 0.5 * v * v - (v * v * v * v) / 27 : v - 0.5625;
}
// CRUSH : des marches de kCrushQ (arrondi), kCrushK marches au plus ; la primitive par morceaux, paire
int crushK(double v) { return std::min(kCrushK, static_cast<int>(std::floor(v / kCrushQ + 0.5))); }
double crushG(double u) {
    const int k = crushK(std::fabs(u));
    return (u < 0 ? -1 : 1) * kCrushQ * k;
}
double crushF(double u) {
    const double v = std::fabs(u);
    const int k = crushK(v);
    if (k <= 0) return 0;
    return kCrushQ * kCrushQ * k * (k - 1) * 0.5 + kCrushQ * k * (v - kCrushQ * (k - 0.5));
}

// v46 PUNISH v2 : le second etage et sa primitive (ADAA) ; le plafond doux
double p2G(double u) { return (kneeG(kP2Knee, kP2Gain * u + kP2Bias) - kneeG(kP2Knee, kP2Bias)) / kP2Gain; }
double p2F(double u) { return kneeF(kP2Knee, kP2Gain * u + kP2Bias) / (kP2Gain * kP2Gain) - kneeG(kP2Knee, kP2Bias) * u / kP2Gain; }
double ceilG(double x) {
    const double v = std::fabs(x);
    if (v <= kCeilKnee) return x;
    const double y = kCeilKnee + (kCeil - kCeilKnee) * std::tanh((v - kCeilKnee) / (kCeil - kCeilKnee));
    return x < 0 ? -y : y;
}

double rawG(int s, double u) {
    switch (s) {
        case Decap::STYLE_A: return std::tanh(u);
        case Decap::STYLE_E:
        case Decap::STYLE_P:
        case Decap::STYLE_FUZZ:
        case Decap::STYLE_DIODE: return kneeG(kKnee[s], u);
        case Decap::STYLE_N: return cubeG(u);
        case Decap::STYLE_T: return u >= 0 ? std::tanh(0.7 * u) / 0.7 : std::tanh(1.5 * u) / 1.5;
        case Decap::STYLE_TAPE: return (2 / kPi) * std::atan(kTapeA * u);
        case Decap::STYLE_AMP: return u >= 0 ? std::tanh(1.2 * u) / 1.2 : std::tanh(2.4 * u) / 2.4;
        case Decap::STYLE_RECT: {
            const double t = std::tanh(u);
            return t + kRect * t * t;
        }
        case Decap::STYLE_FOLD: return std::sin(u);
        case Decap::STYLE_CRUSH: return crushG(u);
        default: return u;
    }
}
double rawF(int s, double u) {
    switch (s) {
        case Decap::STYLE_A: return lncosh(u);
        case Decap::STYLE_E:
        case Decap::STYLE_P:
        case Decap::STYLE_FUZZ:
        case Decap::STYLE_DIODE: return kneeF(kKnee[s], u);
        case Decap::STYLE_N: return cubeF(u);
        case Decap::STYLE_T: return u >= 0 ? lncosh(0.7 * u) / 0.49 : lncosh(1.5 * u) / 2.25;
        case Decap::STYLE_TAPE: return (2 / kPi) * (u * std::atan(kTapeA * u) - std::log1p(kTapeA * kTapeA * u * u) / (2 * kTapeA));
        case Decap::STYLE_AMP: return u >= 0 ? lncosh(1.2 * u) / 1.44 : lncosh(2.4 * u) / 5.76;
        case Decap::STYLE_RECT: return lncosh(u) + kRect * (u - std::tanh(u));
        case Decap::STYLE_FOLD: return -std::cos(u);
        case Decap::STYLE_CRUSH: return crushF(u);
        default: return 0.5 * u * u;
    }
}

struct StyleNorm {
    double gb[NS];
    double inv[NS];
    double autoDb[NS][kAutoN];
    StyleNorm() {
        for (int s = 0; s < NS; ++s) {
            const double b = kBias[s];
            gb[s] = rawG(s, b);
            const double h = 1e-5;
            // CRUSH n'a pas de pente a l'origine (une marche) : sa pente moyenne est 1
            inv[s] = s == Decap::STYLE_CRUSH ? 1.0 : 1.0 / ((rawG(s, b + h) - rawG(s, b - h)) / (2 * h));
        }
        // AUTO : A a P mesures ; les autres d'apres le modele, cale sur A
        double model[NS][kAutoN];
        for (int s = 0; s < NS; ++s)
            for (int i = 0; i < kAutoN; ++i) {
                const double g = dbLin(kAutoAt[i]);
                const int n = 512;
                double m = 0, e = 0, ein = 0;
                for (int k = 0; k < n; ++k) {
                    const double x = 0.2 * std::sin(2 * kPi * (k + 0.5) / n);
                    m += (rawG(s, g * x + b(s)) - gb[s]) * inv[s];
                }
                m /= n;
                for (int k = 0; k < n; ++k) {
                    const double x = 0.2 * std::sin(2 * kPi * (k + 0.5) / n);
                    const double y = (rawG(s, g * x + b(s)) - gb[s]) * inv[s] - m;
                    e += y * y;
                    ein += x * x;
                }
                model[s][i] = 10 * std::log10(std::max(1e-30, ein) / std::max(1e-30, e));
            }
        // (le modele sinus laisse les styles etendus plus forts qu'A sur un arpege percussif une fois ecrases : une
        // correction mesuree par decap_test, proportionnelle au DRIVE)
        constexpr double kTrim[NS] = {0, 0, 0, 0, 0, 0.5, 1.8, 1.9, 2.0, 1.75, 3.9, 1.9};
        for (int s = 0; s < NS; ++s)
            for (int i = 0; i < kAutoN; ++i)
                autoDb[s][i] = s < 5 ? kAutoMeas[s][i]
                                     : kAutoMeas[0][i] + std::clamp(model[s][i] - model[0][i], -12.0, 12.0) - kTrim[s] * std::min(1.3, kAutoAt[i] / 30);
    }
    static double b(int s) { return kBias[s]; }
};
const StyleNorm& norm() {
    static const StyleNorm n;
    return n;
}

} // namespace

double Decap::driveDbOf(double v, bool punish) { return 36 * v + (punish ? 20 : 0); }
double Decap::lowHzOf(double v) { return v < kOff ? 0 : 20 * std::pow(50.0, (v - kOff) / (1 - kOff)); }
double Decap::highHzOf(double v) { return v > kHighOff ? 0 : 1000 * std::pow(20.0, v / kHighOff); }
double Decap::tiltOf(double v) { return (v - 0.5) * 2; }
double Decap::outDbOf(double v) { return -18 + 36 * v; }
double Decap::fbHzOf(double v) { return 40 * std::pow(30.0, std::clamp(v, 0.0, 1.0)); }
double Decap::xLoHzOf(double v) { return 40 * std::pow(25.0, std::clamp(v, 0.0, 1.0)); }
double Decap::xHiHzOf(double v) { return 600 * std::pow(25.0, std::clamp(v, 0.0, 1.0)); }
double Decap::filtHzOf(double v) { return 20 * std::pow(1000.0, std::clamp(v, 0.0, 1.0)); }
double Decap::resoQOf(double v) { return 0.70710678118654752 * std::pow(16.0, std::clamp(v, 0.0, 1.0)); }
double Decap::bandDbOf(double v) { return -18 + 36 * std::clamp(v, 0.0, 1.0); }
double Decap::levelDbOf(double v) { return -12 + 24 * std::clamp(v, 0.0, 1.0); }
double Decap::envAtkMs(double v) { return std::pow(30.0, std::clamp(v, 0.0, 1.0)); }
double Decap::envRelMs(double v) { return 30 * std::pow(30.0, std::clamp(v, 0.0, 1.0)); }
double Decap::boxScaleOf(double v) { return std::pow(2.0, (std::clamp(v, 0.0, 1.0) - 0.5) * 1.2); }

double Decap::curve(int s, double x) {
    const StyleNorm& n = norm();
    s = std::clamp(s, 0, NS - 1);
    return (rawG(s, x + kBias[s]) - n.gb[s]) * n.inv[s];
}
double Decap::curveF(int s, double x) {
    const StyleNorm& n = norm();
    s = std::clamp(s, 0, NS - 1);
    return (rawF(s, x + kBias[s]) - n.gb[s] * x) * n.inv[s];
}
double Decap::autoDbOf(int s, double db) {
    const double* row = norm().autoDb[std::clamp(s, 0, NS - 1)];
    if (db <= kAutoAt[0]) return row[0];
    for (int i = 1; i < kAutoN; ++i) {
        if (db <= kAutoAt[i]) {
            const double t = (db - kAutoAt[i - 1]) / (kAutoAt[i] - kAutoAt[i - 1]);
            return row[i - 1] + (row[i] - row[i - 1]) * t;
        }
    }
    return row[kAutoN - 1];
}
double Decap::autoGainOf(int s, double db) { return dbLin(autoDbOf(s, db)); }

/* ---------------- le filtre a variables d'etat (TPT) ---------------- */

void Decap::svfSet(Coef& c, double hz, double q, double sr) {
    c.g = tptG(std::max(10.0, hz), sr);
    c.k = 1 / std::max(0.05, q);
    c.a1 = 1 / (1 + c.g * (c.g + c.k));
}
double Decap::svfRun(Svf& s, const Coef& c, double x, double& lp, double& bp, double& hp) {
    hp = (x - (c.g + c.k) * s.s1 - s.s2) * c.a1;
    const double v1 = c.g * hp;
    bp = v1 + s.s1;
    s.s1 = bp + v1;
    const double v2 = c.g * bp;
    lp = v2 + s.s2;
    s.s2 = lp + v2;
    return lp;
}
double Decap::filt(Svf& s, const Coef& c, double x) {
    double lp, bp, hp;
    svfRun(s, c, x, lp, bp, hp);
    switch (c.mode) {
        case F_LP: return lp;
        case F_BP: return c.k * bp;
        case F_HP: return hp;
        case F_PEAK: return x + c.peak * c.k * bp;
        default: return x;
    }
}

/* ---------------- preparation ---------------- */

void Decap::prepare(double sampleRate) {
    sr_ = sampleRate > 0 ? sampleRate : 48000;
    norm();
    // Les filtres x2, x4, x8 : N = kLatency x os + 1 coefficients, gain continu os (interpolation) ; le meme retard
    for (int bi = 0; bi < 3; ++bi) {
        Bank& b = banks_[static_cast<size_t>(bi)];
        const int os = 2 << bi;
        const int n = kLatency * os + 1;
        std::vector<double> h(static_cast<size_t>(n));
        const double c = (n - 1) / 2.0;
        const double fc = kFirFc / (2.0 * os);
        const double i0b = besselI0(kKaiserBeta);
        double sum = 0;
        for (int i = 0; i < n; ++i) {
            const double t = i - c;
            const double sinc = t == 0 ? 2 * fc : std::sin(2 * kPi * fc * t) / (kPi * t);
            const double r = t / c;
            const double w = besselI0(kKaiserBeta * std::sqrt(std::max(0.0, 1 - r * r))) / i0b;
            h[static_cast<size_t>(i)] = sinc * w;
            sum += h[static_cast<size_t>(i)];
        }
        for (double& x : h) x *= os / sum;
        b.os = os;
        b.nd = n;
        b.ph.assign(static_cast<size_t>(os * kTaps), 0.0);
        for (int p = 0; p < os; ++p)
            for (int i = 0; i < kTaps; ++i) b.ph[static_cast<size_t>(p * kTaps + i)] = p + i * os < n ? h[static_cast<size_t>(p + i * os)] : 0;
        b.hd.assign(static_cast<size_t>(n), 0.0);
        for (int i = 0; i < n; ++i) b.hd[static_cast<size_t>(i)] = h[static_cast<size_t>(i)] / os;
    }
    for (Path& p : path_)
        for (int c = 0; c < 2; ++c) {
            p.up[static_cast<size_t>(c)].assign(2 * kTaps, 0.0);
            p.dn[static_cast<size_t>(c)].assign(static_cast<size_t>(2 * banks_[2].nd), 0.0);
            zDesign(p.z[static_cast<size_t>(c)]);
        }
    // v49 LATENCY ZERO : le sec, et le retard de groupe au grave des demi-bandes (aller et retour), arrondi
    for (ZChain& z : zDry_) zDesign(z);
    {
        // le retard de groupe d'un passe-tout du premier ordre (c + z^-1) / (1 + c z^-1) au continu : (1 - c) / (1 + c)
        // echantillons de son taux ; une demi-bande : la moyenne de ses deux chaines (la seconde : un echantillon haut de
        // plus), au taux haut
        const auto gdHalf = [](const IirDown2& d) {
            double g0 = 0, g1 = 1;
            for (int i = 0; i < d.n; ++i) (i % 2 == 0 ? g0 : g1) += 2 * (1 - d.c[i]) / (1 + d.c[i]);
            return 0.5 * (g0 + g1);
        };
        const ZChain& z = zDry_[0];
        const double gd = 2 * (gdHalf(z.d2) / 2 + gdHalf(z.d4) / 4 + gdHalf(z.d8) / 8);
        zGd_ = static_cast<int>(std::lround(gd));
    }
    for (int c = 0; c < 2; ++c) {
        fbBuf_[static_cast<size_t>(c)].assign(static_cast<size_t>(sr_ / 40) + 2 * kLatency + 8, 0.0);
        boxBuf_[static_cast<size_t>(c)].assign(static_cast<size_t>(sr_ * 0.012) + 8, 0.0);
    }
    // v46 PUNISH v2 : le snarl, la ponderation K, la sonie
    svfSet(snPk_, kSnHz, kSnQ, sr_);
    snPk_.mode = F_PEAK;
    snPk_.peak = dbLin(kSnDb) - 1;
    const auto onePole = [&](double hz) {
        const double g = tptG(hz, sr_);
        return g / (1 + g);
    };
    aSnLo_ = onePole(kSnLoHz);
    aKh_ = onePole(kKHpHz);
    aKs_ = onePole(kKShHz);
    aMs_ = 1 - std::exp(-1 / (kPunMsS * sr_));
    snLoG_ = dbLin(kSnLoDb) - 1;
    kShG_ = dbLin(kKShDb) - 1;
    cur_ = want_;
    configure();
    reset();
}

void Decap::punClear() {
    for (Ch& c : ch_) {
        c.snPk = {};
        c.snLs = {};
        c.kpH = c.kpS = c.keH = c.keS = 0;
    }
    for (Path& p : path_) {
        p.s2x = {};
        p.s2f = {};
        p.s2ok = {};
    }
    punMsP_ = punMsE_ = 0;
    punGm_ = 0;
}

void Decap::zDesign(ZChain& z) {
    // les memes demi-bandes que les decimateurs du moteur (Voyager.cpp, LATENCY ZERO), dans les deux sens
    double c[IirHalfband::kMaxCoefs];
    IirHalfband::designN(8, 0.035, c);
    z.u2.set(c, 8);
    z.d2.set(c, 8);
    IirHalfband::designN(4, 0.2, c);
    z.u4.set(c, 4);
    z.lu4.set(c, 4);
    z.d4.set(c, 4);
    IirHalfband::designN(5, 0.2, c);
    z.u8.set(c, 5);
    z.lu8.set(c, 5);
    z.d8.set(c, 5);
}

void Decap::clearState() {
    for (Path& p : path_) {
        for (ZChain& z : p.z) z.clear();
        for (auto& v : p.up) std::fill(v.begin(), v.end(), 0.0);
        for (auto& v : p.dn) std::fill(v.begin(), v.end(), 0.0);
        p.upW = p.dnW = 0;
        p.ax = {};
        p.fa = {};
        p.fb = {};
        p.sa = {{-1, -1}};
        p.sb = {{-1, -1}};
        p.s2ok = {};
    }
    ch_ = {};
    for (ZChain& z : zDry_) z.clear();
    for (auto& v : fbBuf_) std::fill(v.begin(), v.end(), 0.0);
    for (auto& v : boxBuf_) std::fill(v.begin(), v.end(), 0.0);
    fbW_ = boxW_ = 0;
    lfoPh_ = 0;
    lfoSm_ = 0;
    lfoRnd_ = 0;
    rng_ = 22222u;
    envE_ = envD_ = envV_ = 0;
    tick_ = 0;
}

void Decap::configure() {
    const bool bandsChanged = nb_ != std::clamp(want_.bands, 1, 3);
    const bool zlChanged = cur_.zl != want_.zl;
    cur_ = want_;
    nb_ = std::clamp(cur_.bands, 1, 3);
    // une bande : x8 ; deux : x4 et x8 ; trois : x2, x4 et x8 (v49 LATENCY ZERO : les memes, la meme phase par ZChain)
    static const int kOsOf[3][3] = {{2, 0, 0}, {1, 2, 0}, {0, 1, 2}};
    if (zlChanged)
        for (ZChain& z : zDry_) z.clear();
    for (int b = 0; b < 3; ++b) {
        Path& p = path_[static_cast<size_t>(b)];
        const int bi = b < nb_ ? kOsOf[nb_ - 1][b] : 2;
        if (p.bank != &banks_[static_cast<size_t>(bi)] || bandsChanged || zlChanged) {
            for (ZChain& z : p.z) z.clear();
            p.bank = &banks_[static_cast<size_t>(bi)];
            p.os = p.bank->os;
            for (auto& v : p.up) std::fill(v.begin(), v.end(), 0.0);
            for (auto& v : p.dn) std::fill(v.begin(), v.end(), 0.0);
            p.upW = p.dnW = 0;
            p.ax = {};
            p.sa = {{-1, -1}};
            p.sb = {{-1, -1}};
            p.s2ok = {};
        }
    }
    if (bandsChanged)
        for (Ch& c : ch_) c.a1 = c.a2 = c.a3 = c.b1 = c.b2 = c.b3 = c.ap = Svf();
}

void Decap::reset() {
    clearState();
    for (auto& d : dry_) d.fill(0);
    dryW_ = 0;
    e_ = 0;
    needReset_ = true;
    dir_ = s_.mm ? dbLin(outDbOf(s_.out)) : 1;
    vuDb_ = -120;
}

void Decap::set(const DecapSettings& s) {
    s_ = s;
    s_.style = std::clamp(s.style, 0, kStyles - 1);
    s_.morphTo = std::clamp(s.morphTo, 0, kStyles - 1);
    s_.bands = std::clamp(s.bands, 1, 3);
    for (auto& b : s_.band) b.style = std::clamp(b.style, -1, kStyles - 1);
    target_ = (!s_.mm && s_.drive > 0) ? 1 : 0;
    want_.style = s_.style;
    want_.morphTo = s_.morphTo;
    want_.bands = s_.bands;
    want_.preMode = std::clamp(s_.preMode, 0, 4);
    want_.postMode = std::clamp(s_.postMode, 0, 4);
    want_.box = std::clamp(s_.box, 0, 4);
    want_.zl = s_.zeroLatency;
    for (int b = 0; b < 3; ++b) want_.bandStyle[static_cast<size_t>(b)] = s_.band[static_cast<size_t>(b)].style;
    // ce qui ne s'entend pas change sans fondu : la cible du MORPH a 0, le style d'une bande hors service
    const bool morphOn = s_.morph > 0 || (s_.lfoTarget == T_MORPH && s_.lfoAmt != 0.5);
    if (!morphOn) cur_.morphTo = want_.morphTo;
    if (want_.bands == cur_.bands)
        for (int b = cur_.bands; b < 3; ++b) cur_.bandStyle[static_cast<size_t>(b)] = want_.bandStyle[static_cast<size_t>(b)];
    if (cur_.bands == 1) cur_.bandStyle = want_.bandStyle;
}

/* ---------------- les coefficients, tous les kTick echantillons ---------------- */

void Decap::coefs(int mode) {
    const double sr = sr_;
    const double kT = mode == 1 ? 1.0 : mode == 2 ? 0.0 : 1 - std::exp(-kTick / (0.03 * sr));
    const double mod = modNow_;
    const int tgt = s_.lfoTarget;
    const auto glide = [&](double& v, double to) { v *= std::pow(to / v, kT); };
    // les coupures, lissees en log
    const double lowHz = lowHzOf(s_.low), highHz = highHzOf(s_.high);
    glide(low_, lowHz > 0 ? lowHz : 20);
    glide(high_, highHz > 0 ? highHz : 20000);
    tilt_ += (tiltOf(s_.tone) - tilt_) * kT;
    glide(preHz_, filtHzOf(s_.preFreq));
    glide(postHz_, filtHzOf(s_.postFreq));
    glide(fbHz_, fbHzOf(s_.fbFreq));
    glide(xLo_, xLoHzOf(s_.xLo));
    glide(xHi_, xHiHzOf(s_.xHi));
    Tick& t = t_;
    t.lowOn = lowHz > 0 || low_ > 21;
    t.highOn = highHz > 0 || high_ < 19900;
    t.steep = s_.steep;
    // l'accentuation du style, glissee vers celle de morphTo par le MORPH
    const double m = std::clamp(s_.morph + (tgt == T_MORPH ? 0.5 * mod : 0), 0.0, 1.0);
    t.morphOn = s_.morph > 0 || (tgt == T_MORPH && s_.lfoAmt != 0.5);
    const int sa = cur_.style, sb = cur_.morphTo;
    const double mm = t.morphOn ? m : 0;
    const double preHz = std::exp(lerp(std::log(kPreHz[sa]), std::log(kPreHz[sb]), mm));
    const double loDb = lerp(kPreLoDb[sa], kPreLoDb[sb], mm), hiDb = lerp(kPreHiDb[sa], kPreHiDb[sb], mm);
    const double lpA = kPostLpHz[sa] > 0 ? kPostLpHz[sa] : 24000, lpB = kPostLpHz[sb] > 0 ? kPostLpHz[sb] : 24000;
    const double slpHz = std::exp(lerp(std::log(lpA), std::log(lpB), mm));
    t.gLo = dbLin(loDb);
    t.gHi = dbLin(hiDb);
    const double gPre = tptG(preHz, sr);
    const double gPost = gPre * (t.gLo / t.gHi);
    t.aPre = gPre / (1 + gPre);
    t.aPost = gPost / (1 + gPost);
    t.iLo = 1 / t.gLo;
    t.iHi = 1 / t.gHi;
    t.slp = slpHz < 20000;
    const double gSlp = t.slp ? tptG(slpHz, sr) : 0;
    t.aSlp = gSlp / (1 + gSlp);
    const double gT = tptG(kTiltHz, sr);
    t.aT = gT / (1 + gT);
    const double tilt = std::clamp(tilt_ + (tgt == T_TONE ? mod : 0), -1.0, 1.0);
    t.tLo = dbLin(-kTiltDb * tilt);
    t.tHi = dbLin(kTiltDb * tilt);
    t.gL = tptG(low_, sr);
    t.kL = s_.thump ? 1 / 2.0 : kSqrt2;
    t.a1L = 1 / (1 + t.gL * (t.gL + t.kL));
    t.gH = tptG(high_, sr);
    t.aH = t.gH / (1 + t.gH);
    const double kA = 1 / 0.618, kBq = 1 / 1.618;
    t.a1A = 1 / (1 + t.gH * (t.gH + kA));
    t.a1B = 1 / (1 + t.gH * (t.gH + kBq));
    t.aDc = 1 - (2 * kPi * kDcHz) / sr;
    // PRE et POST FILTER
    const double nyq = 0.45 * sr;
    svfSet(t.pre, std::min(nyq, preHz_ * (tgt == T_PRE ? std::pow(2.0, 2 * mod) : 1)), resoQOf(s_.preReso), sr);
    t.pre.mode = cur_.preMode;
    t.pre.peak = dbLin(12) - 1;
    svfSet(t.post, std::min(nyq, postHz_ * (tgt == T_POST ? std::pow(2.0, 2 * mod) : 1)), resoQOf(s_.postReso), sr);
    t.post.mode = cur_.postMode;
    t.post.peak = dbLin(12) - 1;
    // les coupures du multibande (Butterworth : leur carre est un Linkwitz-Riley)
    svfSet(t.x1, xLo_, 0.70710678118654752, sr);
    svfSet(t.x2, std::max(xHi_, 1.5 * xLo_), 0.70710678118654752, sr);
    // les bandes
    bool anySolo = false;
    for (int b = 0; b < nb_; ++b) anySolo = anySolo || s_.band[static_cast<size_t>(b)].solo;
    for (int b = 0; b < 3; ++b) {
        const DecapBand& bd = s_.band[static_cast<size_t>(b)];
        const bool multi = nb_ > 1;
        t.bandDb[static_cast<size_t>(b)] = multi ? bandDbOf(bd.drive) : 0;
        t.gBT[static_cast<size_t>(b)] = dbLin(t.bandDb[static_cast<size_t>(b)]);
        t.mixT[static_cast<size_t>(b)] = !multi ? 1 : bd.bypass ? 0 : std::clamp(bd.mix, 0.0, 1.0);
        t.levelT[static_cast<size_t>(b)] = !multi || bd.bypass ? 1 : dbLin(levelDbOf(bd.level));
        t.soloT[static_cast<size_t>(b)] = !multi || !anySolo || bd.solo ? 1 : 0;
    }
    // l'enveloppe (ENV), la dynamique, le VU
    t.eA = 1 - std::exp(-1 / (envAtkMs(s_.envSpeed) * 1e-3 * sr));
    t.eR = 1 - std::exp(-1 / (envRelMs(s_.envSpeed) * 1e-3 * sr));
    t.dA = 1 - std::exp(-1 / (0.005 * sr));
    t.dR = 1 - std::exp(-1 / (0.15 * sr));
    t.vA = 1 - std::exp(-1 / (0.01 * sr));
    t.vR = 1 - std::exp(-1 / (0.3 * sr));
    vuDb_ = linDb(envV_);
    // le FEEDBACK : la boucle accordee sur fbHz (le retard des filtres compris), un passe-bande Q 2 ; le gain de boucle
    // normalise par le gain en petit signal de la saturation (la plus forte des bandes) : sous 0.9
    svfSet(t.fbBp, fbHz_, 2, sr);
    t.fbBp.mode = F_BP;
    const int maxD = static_cast<int>(fbBuf_[0].size()) - 2;
    t.fbD = std::clamp(static_cast<int>(std::lround(sr / fbHz_)) - ((cur_.zl ? zGd_ : kLatency) + 1), 0, maxD);
    {
        const double d0 = drive_;
        double G = 1;
        for (int b = 0; b < nb_; ++b) {
            const int st = cur_.bandStyle[static_cast<size_t>(b)] < 0 || nb_ == 1 ? sa : cur_.bandStyle[static_cast<size_t>(b)];
            const double db = d0 + t.bandDb[static_cast<size_t>(b)] + 24 + 18; // le pire : ENV et LFO a fond
            const double a = s_.autoGain ? autoGainOf(st, d0 + t.bandDb[static_cast<size_t>(b)]) : 1;
            G = std::max(G, t.levelT[static_cast<size_t>(b)] * std::max(1.0, dbLin(db) * a));
        }
        t.fbT = s_.fb > 0 ? s_.fb * 0.9 / G : 0;
    }
    // BOX
    {
        const BoxDef& bx = kBox[cur_.box];
        const double sc = boxScaleOf(s_.boxSize);
        svfSet(t.boxHp, bx.hp / sc, 0.70710678118654752, sr);
        t.boxHp.mode = F_HP;
        svfSet(t.boxLp, bx.lp / sc, 0.70710678118654752, sr);
        t.boxLp.mode = F_LP;
        svfSet(t.boxPk1, bx.p1 > 0 ? bx.p1 / sc : 1000, bx.p1Q, sr);
        t.boxPk1.mode = bx.p1 > 0 ? F_PEAK : F_OFF;
        t.boxPk1.peak = dbLin(bx.p1Db) - 1;
        svfSet(t.boxPk2, bx.p2 > 0 ? bx.p2 / sc : 1000, bx.p2Q, sr);
        t.boxPk2.mode = bx.p2 > 0 ? F_PEAK : F_OFF;
        t.boxPk2.peak = dbLin(bx.p2Db) - 1;
        t.boxD = std::clamp(static_cast<int>(std::lround(bx.ms * sc * 1e-3 * sr)), 1, static_cast<int>(boxBuf_[0].size()) - 2);
        t.boxFb = bx.fb;
        t.boxNorm = 1 - bx.fb;
    }
}

/* ---------------- le traitement ---------------- */

void Decap::process(float* L, float* R, int n) {
    if (n <= 0) return;
    const double sr = sr_;
    const double kS = 1 - std::exp(-1 / (0.015 * sr));
    const double dirT = (s_.mm && s_.drive > 0) ? dbLin(outDbOf(s_.out)) : 1.0;
    constexpr int DN = kLatency + 1;

    // Contournee : l'entree (au bit pres quand le chemin direct est a 1), la ligne du sec toujours tenue
    if (target_ == 0 && e_ == 0) {
        int w = dryW_;
        const bool unity = dirT == 1.0 && dir_ == 1.0;
        for (int i = 0; i < n; ++i) {
            dry_[0][static_cast<size_t>(w)] = L[i];
            dry_[1][static_cast<size_t>(w)] = R[i];
            w = w + 1 == DN ? 0 : w + 1;
            if (!unity) {
                dir_ += (dirT - dir_) * kS;
                if (std::fabs(dir_ - dirT) < 1e-6) dir_ = dirT;
                L[i] = static_cast<float>(L[i] * dir_);
                R[i] = static_cast<float>(R[i] * dir_);
            }
        }
        dryW_ = w;
        needReset_ = true;
        vuDb_ = -120;
        return;
    }
    if (needReset_) {
        clearState();
        needReset_ = false;
        cur_ = want_;
        nb_ = -1;
        configure();
        drive_ = driveDbOf(s_.drive, s_.punish || (kV2 && s_.punish2));
        mix_ = s_.mix;
        out_ = dbLin(outDbOf(s_.out));
        morph_ = s_.morph;
        tilt_ = tiltOf(s_.tone);
        low_ = lowHzOf(s_.low) > 0 ? lowHzOf(s_.low) : 20;
        high_ = highHzOf(s_.high) > 0 ? highHzOf(s_.high) : 20000;
        preHz_ = filtHzOf(s_.preFreq);
        postHz_ = filtHzOf(s_.postFreq);
        fbHz_ = fbHzOf(s_.fbFreq);
        xLo_ = xLoHzOf(s_.xLo);
        xHi_ = xHiHzOf(s_.xHi);
        box_ = std::clamp(s_.boxMix, 0.0, 1.0);
        sw_ = 1;
        dynG_ = 1;
        modNow_ = 0;
        pun_ = kV2 && s_.punish2 ? 1 : 0;
        punWas_ = false;
        coefs(1);
        fbG_ = t_.fbT;
        for (int b = 0; b < 3; ++b) {
            Path& p = path_[static_cast<size_t>(b)];
            p.gB = t_.gBT[static_cast<size_t>(b)];
            p.mix = t_.mixT[static_cast<size_t>(b)];
            p.level = t_.levelT[static_cast<size_t>(b)];
            p.solo = t_.soloT[static_cast<size_t>(b)];
        }
    }

    const double fade = 1 / (kFadeS * sr);
    const double swStep = 1 / (kStyleFadeS * sr);
    const double driveT = driveDbOf(s_.drive, s_.punish || (kV2 && s_.punish2));
    const double punT = kV2 && s_.punish2 ? 1.0 : 0.0;
    const double outT = dbLin(outDbOf(s_.out));
    const double ref = std::max(1e-4, s_.ref);
    const double iref = 1 / ref;
    const double lfoInc = std::clamp(s_.lfoHz, 0.0, 50.0) / sr;
    const double lfoAmt = 2 * std::clamp(s_.lfoAmt, 0.0, 1.0) - 1;
    const int lfoShape = std::clamp(s_.lfoShape, 0, 4);
    const double kLfo = 1 - std::exp(-1 / ((lfoShape == 4 ? 0.015 : 0.0015) * sr));
    const int tgt = s_.lfoTarget;
    const double envAmt = 2 * std::clamp(s_.envAmt, 0.0, 1.0) - 1;
    const double dynK = std::clamp(s_.dyn, 0.0, 1.0) - 0.5;
    const bool autoS = s_.autoGain;
    const int fbN = static_cast<int>(fbBuf_[0].size());
    const int boxN = static_cast<int>(boxBuf_[0].size());

    for (int i = 0; i < n; ++i) {
        // le LFO (a l'echantillon) puis, tous les kTick echantillons, les coefficients
        {
            lfoPh_ += lfoInc;
            if (lfoPh_ >= 1) {
                lfoPh_ -= std::floor(lfoPh_);
                rng_ = rng_ * 1664525u + 1013904223u;
                lfoRnd_ = (rng_ >> 8) * (2.0 / 16777216.0) - 1;
            }
            double raw;
            switch (lfoShape) {
                case 1: raw = 4 * std::fabs(lfoPh_ - 0.5) - 1; break;
                case 2: raw = 2 * lfoPh_ - 1; break;
                case 3: raw = lfoPh_ < 0.5 ? 1 : -1; break;
                case 4: raw = lfoRnd_; break;
                default: raw = std::sin(2 * kPi * lfoPh_); break;
            }
            lfoSm_ += (raw - lfoSm_) * kLfo;
            modNow_ = lfoSm_ * lfoAmt;
        }
        if (tick_ == 0) coefs(0);
        tick_ = tick_ + 1 == kTick ? 0 : tick_ + 1;
        const Tick& t = t_;
        e_ += target_ > e_ ? std::min(fade, target_ - e_) : -std::min(fade, e_ - target_);
        // un changement de STYLE, de bandes, de mode : le mouille s'eteint, change, se rallume (6 ms)
        if (!(want_ == cur_)) {
            sw_ -= swStep;
            if (sw_ <= 0) {
                sw_ = 0;
                configure();
                coefs(2);
            }
        } else if (sw_ < 1) {
            sw_ = std::min(1.0, sw_ + swStep);
        }
        // les enveloppes (les deux canaux ensemble, au niveau de la prise)
        const double xl = L[i], xr = R[i];
        const double a = std::max(std::fabs(xl), std::fabs(xr)) * ref;
        envE_ += (a > envE_ ? t.eA : t.eR) * (a - envE_);
        envD_ += (a > envD_ ? t.dA : t.dR) * (a - envD_);
        // les lissages
        drive_ += (driveT - drive_) * kS;
        mix_ += (s_.mix - mix_) * kS;
        out_ += (outT - out_) * kS;
        dir_ += (dirT - dir_) * kS;
        box_ += (std::clamp(s_.boxMix, 0.0, 1.0) - box_) * kS;
        fbG_ += (t.fbT - fbG_) * kS;
        double dTot = drive_;
        if (envAmt != 0) dTot += envAmt * 24 * std::clamp((linDb(envE_) + 48) / 48, 0.0, 1.0);
        if (tgt == T_DRIVE) dTot += 18 * modNow_;
        const double mixEff = tgt == T_MIX ? std::clamp(mix_ + 0.5 * modNow_, 0.0, 1.0) : mix_;
        const double mEff = std::clamp(s_.morph + (tgt == T_MORPH ? 0.5 * modNow_ : 0), 0.0, 1.0);
        morph_ = mEff;
        if (dynK != 0) {
            const double dynDb = std::clamp(dynK * (linDb(envD_) + 24), -12.0, 12.0);
            dynG_ += (dbLin(dynDb) - dynG_) * kS;
        } else {
            dynG_ += (1 - dynG_) * kS;
        }
        const double gIn = dbLin(dTot) * ref;
        // v46 PUNISH v2 : son fondu ; le DRIVE sans PUNISH (l'estimation), la compression, le gain AUTO mesure
        if (kV2 && (punT > 0 || pun_ > 0)) {
            pun_ += (punT - pun_) * kS;
            if (punT == 0 && pun_ < 1e-6) pun_ = 0;
            if (punT == 1 && pun_ > 1 - 1e-9) pun_ = 1;
        }
        const bool punAct = kV2 && pun_ > 0;
        if (kV2 && punAct != punWas_) {
            if (punAct) punClear();
            punWas_ = punAct;
        }
        double gIn0 = 0, punPre = 1, punPost = 1;
        if (punAct) {
            gIn0 = dbLin(dTot - 20 * pun_) * ref;
            punPre = dbLin(-pun_ * std::clamp(kPunCmpSlope * (linDb(envD_) - kPunCmpFrom), 0.0, kPunCmpMax));
            punPost = dbLin(pun_ * punGm_);
        }
        // les bandes : leurs gains lisses, leur courbe, leur compensation
        struct Shape {
            int sa, sb;
            double m, autoScale, invG, mix, auto0;
            bool morph, skip;
        } shp[3];
        for (int b = 0; b < nb_; ++b) {
            Path& p = path_[static_cast<size_t>(b)];
            p.gB += (t.gBT[static_cast<size_t>(b)] - p.gB) * kS;
            p.mix += (t.mixT[static_cast<size_t>(b)] - p.mix) * kS;
            if (std::fabs(p.mix - t.mixT[static_cast<size_t>(b)]) < 1e-7) p.mix = t.mixT[static_cast<size_t>(b)];
            p.level += (t.levelT[static_cast<size_t>(b)] - p.level) * kS;
            p.solo += (t.soloT[static_cast<size_t>(b)] - p.solo) * kS;
            Shape& sh = shp[b];
            const int own = nb_ > 1 ? cur_.bandStyle[static_cast<size_t>(b)] : -1;
            sh.sa = own < 0 ? cur_.style : own;
            sh.sb = cur_.morphTo;
            sh.morph = own < 0 && t.morphOn;
            sh.m = mEff;
            const double db = dTot + t.bandDb[static_cast<size_t>(b)];
            double aDb = 0;
            if (autoS) aDb = sh.morph ? lerp(autoDbOf(sh.sa, db), autoDbOf(sh.sb, db), mEff) : autoDbOf(sh.sa, db);
            sh.autoScale = (autoS ? dbLin(aDb) : 1) * iref;
            sh.invG = 1 / (gIn * (nb_ > 1 ? p.gB : 1));
            sh.mix = p.mix;
            sh.skip = p.mix == 0;
            sh.auto0 = 1;
            if (punAct) {
                // l'estimation sans PUNISH : la compensation de la table sans les +20 dB
                const double db0 = db - 20 * pun_;
                double a0 = 0;
                if (autoS) a0 = sh.morph ? lerp(autoDbOf(sh.sa, db0), autoDbOf(sh.sb, db0), mEff) : autoDbOf(sh.sa, db0);
                sh.auto0 = (autoS ? dbLin(a0) : 1) * iref;
            }
        }
        const int dw = dryW_;
        double vu = 0;
        double sqP = 0, sqE = 0;
        // v46 CLEAN LOW (2 bandes, la basse contournee) : LOW CUT ne coupe que la bande saturee
        const bool lcBand = kV2 && nb_ == 2 && s_.band[0].bypass;
        for (int c = 0; c < 2; ++c) {
            Ch& s = ch_[static_cast<size_t>(c)];
            const double x = c == 0 ? xl : xr;
            dry_[static_cast<size_t>(c)][static_cast<size_t>(dw)] = x;
            double y = x;
            const auto lowCut = [&](double in) {
                const double hp = (in - (t.gL + t.kL) * s.lc1 - s.lc2) * t.a1L;
                const double v1 = t.gL * hp;
                const double bp = v1 + s.lc1;
                s.lc1 = bp + v1;
                const double v2 = t.gL * bp;
                const double lp = v2 + s.lc2;
                s.lc2 = lp + v2;
                return hp;
            };
            if (t.lowOn && !lcBand) y = lowCut(y);
            {
                const double v = (y - s.tilt) * t.aT;
                const double lp = v + s.tilt;
                s.tilt = lp + v;
                y = t.tLo * lp + t.tHi * (y - lp);
            }
            if (t.pre.mode != F_OFF) y = filt(s.preF, t.pre, y);
            y += s.fbLast;
            {
                const double v = (y - s.pre) * t.aPre;
                const double lp = v + s.pre;
                s.pre = lp + v;
                y = t.gLo * lp + t.gHi * (y - lp);
            }
            vu = std::max(vu, std::fabs(y * gIn));
            // le multibande (Linkwitz-Riley 24 dB/oct ; trois bandes : le bas passe par le passe-tout de la seconde
            // coupure, la somme reste plate)
            double yb[3] = {y, 0, 0};
            if (nb_ >= 2) {
                double lp1, bp1, hp1, l2, b2, h2;
                svfRun(s.a1, t.x1, y, lp1, bp1, hp1);
                double lo, hi;
                svfRun(s.a2, t.x1, lp1, lo, b2, h2);
                svfRun(s.a3, t.x1, hp1, l2, b2, hi);
                yb[0] = lo;
                yb[1] = hi;
                if (nb_ == 3) {
                    double lp3, bp3, hp3, mid, high;
                    svfRun(s.b1, t.x2, hi, lp3, bp3, hp3);
                    svfRun(s.b2, t.x2, lp3, mid, b2, h2);
                    svfRun(s.b3, t.x2, hp3, l2, b2, high);
                    double la, ba, ha;
                    svfRun(s.ap, t.x2, lo, la, ba, ha);
                    yb[0] = lo - 2 * t.x2.k * ba;
                    yb[1] = mid;
                    yb[2] = high;
                }
            }
            if (t.lowOn && lcBand) yb[1] = lowCut(yb[1]);
            double sum = 0, est = 0;
            for (int b = 0; b < nb_; ++b) {
                Path& p = path_[static_cast<size_t>(b)];
                const Shape& sh = shp[b];
                const Bank& bk = *p.bank;
                const int os = bk.os, nd = bk.nd;
                double ybs = yb[b];
                if (punAct) {
                    // PUNISH v2 : le snarl (les bandes saturees seulement) ; l'estimation du son sans PUNISH, au taux de base
                    const double x0 = yb[b];
                    if (!sh.skip) {
                        const double pk = filt(s.snPk[static_cast<size_t>(b)], snPk_, x0);
                        double& ls = s.snLs[static_cast<size_t>(b)];
                        const double v = (pk - ls) * aSnLo_;
                        const double lp = v + ls;
                        ls = lp + v;
                        const double sn = pk + snLoG_ * lp;
                        ybs = x0 + (sn - x0) * pun_;
                    }
                    const double u0 = x0 * gIn0 * (nb_ > 1 ? p.gB : 1);
                    double c0 = curve(sh.sa, u0);
                    if (sh.morph) c0 += (curve(sh.sb, u0) - c0) * sh.m;
                    const double w0 = c0 * sh.auto0;
                    const double e0 = sh.skip ? x0 : sh.mix >= 1 ? w0 : x0 + (w0 - x0) * sh.mix;
                    est += nb_ > 1 ? e0 * p.level * p.solo : e0;
                }
                const double u = ybs * gIn * (nb_ > 1 ? p.gB : 1);
                std::vector<double>& hb = p.up[static_cast<size_t>(c)];
                const int w = p.upW;
                hb[static_cast<size_t>(w)] = u;
                hb[static_cast<size_t>(w + kTaps)] = u;
                std::vector<double>& dh = p.dn[static_cast<size_t>(c)];
                int dwi = p.dnW;
                double dec = 0;
                // v49 LATENCY ZERO : les huit echantillons hauts par les demi-bandes RII (zv : le mouille a decimer)
                const bool zlOn = cur_.zl;
                double zu[8], zv[8];
                if (zlOn) p.z[static_cast<size_t>(c)].up(u, zu, os);
                for (int q = 0; q < os; ++q) {
                    double acc = 0;
                    if (zlOn) {
                        acc = zu[q];
                    } else {
                        const double* pq = &bk.ph[static_cast<size_t>(q * kTaps)];
                        const double* hq = &hb[static_cast<size_t>(w + kTaps)];
                        for (int k = 0; k < kTaps; ++k) acc += pq[k] * hq[-k];
                    }
                    double z;
                    if (sh.skip) {
                        // la bande contournee : le sec seul, l'ADAA suit sans calculer
                        p.ax[static_cast<size_t>(c)] = acc;
                        p.sa[static_cast<size_t>(c)] = p.sb[static_cast<size_t>(c)] = -1;
                        z = acc * sh.invG;
                    } else {
                        // ADAA du premier ordre (et celle de la cible du MORPH)
                        const double x1 = p.ax[static_cast<size_t>(c)];
                        if (p.sa[static_cast<size_t>(c)] != sh.sa) {
                            p.fa[static_cast<size_t>(c)] = curveF(sh.sa, x1);
                            p.sa[static_cast<size_t>(c)] = sh.sa;
                        }
                        const double dxa = acc - x1;
                        const bool big = dxa > kAdaaEps || dxa < -kAdaaEps;
                        const double Fa = curveF(sh.sa, acc);
                        double yv = big ? (Fa - p.fa[static_cast<size_t>(c)]) / dxa : curve(sh.sa, 0.5 * (acc + x1));
                        p.fa[static_cast<size_t>(c)] = Fa;
                        if (sh.morph) {
                            if (p.sb[static_cast<size_t>(c)] != sh.sb) {
                                p.fb[static_cast<size_t>(c)] = curveF(sh.sb, x1);
                                p.sb[static_cast<size_t>(c)] = sh.sb;
                            }
                            const double Fb = curveF(sh.sb, acc);
                            const double yB = big ? (Fb - p.fb[static_cast<size_t>(c)]) / dxa : curve(sh.sb, 0.5 * (acc + x1));
                            p.fb[static_cast<size_t>(c)] = Fb;
                            yv += (yB - yv) * sh.m;
                        } else {
                            p.sb[static_cast<size_t>(c)] = -1;
                        }
                        if (punAct) {
                            // PUNISH v2 : le second etage, par sa primitive
                            const size_t ci = static_cast<size_t>(c);
                            if (!p.s2ok[ci]) {
                                p.s2f[ci] = p2F(p.s2x[ci]);
                                p.s2ok[ci] = true;
                            }
                            const double d2 = yv - p.s2x[ci];
                            const double F2 = p2F(yv);
                            const double y2 = d2 > kAdaaEps || d2 < -kAdaaEps ? (F2 - p.s2f[ci]) / d2 : p2G(0.5 * (yv + p.s2x[ci]));
                            p.s2x[ci] = yv;
                            p.s2f[ci] = F2;
                            yv += (y2 - yv) * pun_;
                        }
                        p.ax[static_cast<size_t>(c)] = acc;
                        const double wet = yv * sh.autoScale;
                        z = sh.mix >= 1 ? wet : acc * sh.invG + (wet - acc * sh.invG) * sh.mix;
                    }
                    if (z < 1e-25 && z > -1e-25) z = 0;
                    if (zlOn) {
                        zv[q] = z;
                        continue;
                    }
                    dh[static_cast<size_t>(dwi)] = z;
                    dh[static_cast<size_t>(dwi + nd)] = z;
                    if (q == 0) {
                        // la decimation sur la phase 0 : le mouille en phase avec le sec retarde de kLatency
                        const double* hd = bk.hd.data();
                        const double* d = &dh[static_cast<size_t>(dwi + nd)];
                        double sd = 0;
                        for (int k = 0; k < nd; ++k) sd += hd[k] * d[-k];
                        dec = sd;
                    }
                    dwi = dwi + 1 == nd ? 0 : dwi + 1;
                }
                if (zlOn) dec = p.z[static_cast<size_t>(c)].down(zv, os);
                sum += nb_ > 1 ? dec * p.level * p.solo : dec;
            }
            if (punAct) {
                // PUNISH v2 : la compression, la sonie (ponderee K) du traite et de l'estimation, le gain AUTO mesure
                sum *= punPre;
                const auto kw = [&](double in, double& h, double& sh) {
                    double v = (in - h) * aKh_;
                    double lp = v + h;
                    h = lp + v;
                    const double hp = in - lp;
                    v = (hp - sh) * aKs_;
                    lp = v + sh;
                    sh = lp + v;
                    const double k = hp + kShG_ * (hp - lp);
                    return k * k;
                };
                sqP += kw(sum, s.kpH, s.kpS);
                sqE += kw(est, s.keH, s.keS);
                sum *= punPost;
            }
            y = sum;
            {
                const double dy = y - s.dcx + t.aDc * s.dcy;
                s.dcx = y;
                s.dcy = dy;
                y = dy;
            }
            {
                const double v = (y - s.post) * t.aPost;
                const double lp = v + s.post;
                s.post = lp + v;
                y = t.iHi * y + (t.iLo - t.iHi) * lp;
            }
            if (t.slp) {
                const double v = (y - s.slp) * t.aSlp;
                const double lp = v + s.slp;
                s.slp = lp + v;
                y = lp;
            }
            if (t.highOn) {
                const double v = (y - s.hc0) * t.aH;
                const double lp = v + s.hc0;
                s.hc0 = lp + v;
                y = lp;
                if (t.steep) {
                    const double kA = 1 / 0.618, kBq = 1 / 1.618;
                    double hp = (y - (t.gH + kA) * s.ha1 - s.ha2) * t.a1A;
                    double v1 = t.gH * hp, bp = v1 + s.ha1;
                    s.ha1 = bp + v1;
                    double v2 = t.gH * bp, l2 = v2 + s.ha2;
                    s.ha2 = l2 + v2;
                    y = l2;
                    hp = (y - (t.gH + kBq) * s.hb1 - s.hb2) * t.a1B;
                    v1 = t.gH * hp;
                    bp = v1 + s.hb1;
                    s.hb1 = bp + v1;
                    v2 = t.gH * bp;
                    l2 = v2 + s.hb2;
                    s.hb2 = l2 + v2;
                    y = l2;
                }
            }
            // la prise du FEEDBACK : le retour du prochain echantillon (accorde, borne par une tangente)
            {
                std::vector<double>& fb = fbBuf_[static_cast<size_t>(c)];
                fb[static_cast<size_t>(fbW_)] = y < 1e-25 && y > -1e-25 ? 0 : y;
                if (fbG_ > 1e-9) {
                    int r = fbW_ - t.fbD;
                    if (r < 0) r += fbN;
                    s.fbLast = std::tanh(fbG_ * filt(s.fbBp, t.fbBp, fb[static_cast<size_t>(r)]));
                } else {
                    s.fbLast = 0;
                }
            }
            // BOX : filtres et une resonance courte
            if (cur_.box != 0) {
                double b = filt(s.boxHp, t.boxHp, y);
                b = filt(s.boxLp, t.boxLp, b);
                if (t.boxPk1.mode != F_OFF) b = filt(s.boxPk1, t.boxPk1, b);
                if (t.boxPk2.mode != F_OFF) b = filt(s.boxPk2, t.boxPk2, b);
                std::vector<double>& bb = boxBuf_[static_cast<size_t>(c)];
                int r = boxW_ - t.boxD;
                if (r < 0) r += boxN;
                double cmb = b + t.boxFb * bb[static_cast<size_t>(r)];
                if (cmb < 1e-25 && cmb > -1e-25) cmb = 0;
                bb[static_cast<size_t>(boxW_)] = cmb;
                y += (cmb * t.boxNorm - y) * box_;
            }
            if (t.post.mode != F_OFF) y = filt(s.postF, t.post, y);
            double wet = y * dynG_ * sw_;
            if (wet < 1e-25 && wet > -1e-25) wet = 0;
            double dryD = dry_[static_cast<size_t>(c)][static_cast<size_t>(dw + 1 == DN ? 0 : dw + 1)];
            if (cur_.zl) {
                // v49 LATENCY ZERO : le sec par les memes demi-bandes que le mouille (aller et retour, sans saturation)
                double d8[8];
                ZChain& zc = zDry_[static_cast<size_t>(c)];
                zc.up(x, d8, 8);
                dryD = zc.down(d8, 8);
            }
            double proc = (dryD + (wet - dryD) * mixEff) * out_;
            if (punAct) proc += (ceilG(proc) - proc) * pun_;
            const double r = e_ >= 1 ? proc : x * dir_ + (proc - x * dir_) * e_;
            (c == 0 ? L : R)[i] = static_cast<float>(r);
        }
        envV_ += (vu > envV_ ? t.vA : t.vR) * (vu - envV_);
        if (punAct) {
            punMsP_ += (0.5 * sqP - punMsP_) * aMs_;
            punMsE_ += (0.5 * sqE - punMsE_) * aMs_;
            double gT = 0;
            if (autoS && punMsP_ > 1e-14 && punMsE_ > 1e-14) gT = std::clamp(10 * std::log10(punMsE_ / punMsP_) + kPunLift, -kPunRange, kPunRange);
            punGm_ += (gT - punGm_) * kS;
        }
        for (int b = 0; b < nb_; ++b) {
            Path& p = path_[static_cast<size_t>(b)];
            p.upW = p.upW + 1 == kTaps ? 0 : p.upW + 1;
            p.dnW = (p.dnW + p.bank->os) % p.bank->nd;
        }
        dryW_ = dw + 1 == DN ? 0 : dw + 1;
        fbW_ = fbW_ + 1 == fbN ? 0 : fbW_ + 1;
        boxW_ = boxW_ + 1 == boxN ? 0 : boxW_ + 1;
    }
    // Les queues sous le denormal
    if (cur_.zl) {
        for (ZChain& z : zDry_) z.flush();
        for (int b = 0; b < nb_; ++b)
            for (ZChain& z : path_[static_cast<size_t>(b)].z) z.flush();
    }
    for (Ch& s : ch_) {
        for (double* p : {&s.tilt, &s.pre, &s.post, &s.lc1, &s.lc2, &s.dcx, &s.dcy, &s.slp, &s.hc0, &s.ha1, &s.ha2, &s.hb1, &s.hb2, &s.fbLast})
            if (std::fabs(*p) < 1e-20) *p = 0;
        for (Svf* f : {&s.preF, &s.postF, &s.a1, &s.a2, &s.a3, &s.b1, &s.b2, &s.b3, &s.ap, &s.fbBp, &s.boxHp, &s.boxLp, &s.boxPk1, &s.boxPk2}) {
            if (std::fabs(f->s1) < 1e-20) f->s1 = 0;
            if (std::fabs(f->s2) < 1e-20) f->s2 = 0;
        }
    }
    if (kV2)
        for (Ch& s : ch_) {
            for (double* p : {&s.snLs[0], &s.snLs[1], &s.snLs[2], &s.kpH, &s.kpS, &s.keH, &s.keS})
                if (std::fabs(*p) < 1e-20) *p = 0;
            for (Svf& f : s.snPk) {
                if (std::fabs(f.s1) < 1e-20) f.s1 = 0;
                if (std::fabs(f.s2) < 1e-20) f.s2 = 0;
            }
        }
    if (std::fabs(envE_) < 1e-20) envE_ = 0;
    if (std::fabs(envD_) < 1e-20) envD_ = 0;
    if (std::fabs(envV_) < 1e-20) envV_ = 0;
}

} // namespace mmarp
