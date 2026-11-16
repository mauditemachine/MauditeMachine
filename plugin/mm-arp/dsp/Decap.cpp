// DISTO, facon Decapitator (2026-11-16) : voir Decap.h. Le port de src/v4/audio/disto.worklet.js (le banc
// scripts/disto-bench.mjs du site l'a valide : contournement au bit pres, platitude, MIX en phase, repliement, AUTO).

#include "Decap.h"

#include <algorithm>
#include <cmath>

namespace mmarp {

namespace {

constexpr double kPi = 3.14159265358979323846;
constexpr double kLn2 = 0.69314718055994530942;

// Par style (A, E, N, T, P) : l'etagere de pre-accentuation (Hz, dB du bas et du haut), le passe-bas d'apres la
// saturation (Hz, 0 : aucun), la polarisation de la courbe, le genou (E, P)
constexpr double kPreHz[5] = {300, 2000, 180, 800, 1200};
constexpr double kPreLoDb[5] = {3, 0, 6, 0, -2};
constexpr double kPreHiDb[5] = {0, 5, 1.5, 2, 5};
constexpr double kPostLpHz[5] = {16000, 18000, 0, 14000, 11000};
constexpr double kBias[5] = {0.2, 0.04, 0.08, 0, 0.12};
constexpr double kKnee[5] = {0, 0.55, 0, 0, 0.85};

// AUTO (dB) aux DRIVE totaux kAutoAt (dB), mesures (disto-bench.mjs)
constexpr int kAutoN = 10;
constexpr double kAutoAt[kAutoN] = {0, 6, 12, 18, 24, 30, 36, 42, 48, 56};
constexpr double kAutoDb[5][kAutoN] = {
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

double dbLin(double db) { return std::pow(10.0, db / 20.0); }
double tptG(double f, double sr) { return std::tan(kPi * std::min(f, 0.49 * sr) / sr); }

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

double rawG(int s, double u) {
    switch (s) {
        case 0: return std::tanh(u);
        case 1:
        case 4: return kneeG(kKnee[s], u);
        case 2: return cubeG(u);
        case 3: return u >= 0 ? std::tanh(0.7 * u) / 0.7 : std::tanh(1.5 * u) / 1.5;
        default: return u;
    }
}
double rawF(int s, double u) {
    switch (s) {
        case 0: return lncosh(u);
        case 1:
        case 4: return kneeF(kKnee[s], u);
        case 2: return cubeF(u);
        case 3: return u >= 0 ? lncosh(0.7 * u) / 0.49 : lncosh(1.5 * u) / 2.25;
        default: return 0.5 * u * u;
    }
}

struct StyleNorm {
    double gb[5];
    double inv[5];
    StyleNorm() {
        for (int s = 0; s < 5; ++s) {
            const double b = kBias[s];
            gb[s] = rawG(s, b);
            const double h = 1e-5;
            inv[s] = 1.0 / ((rawG(s, b + h) - rawG(s, b - h)) / (2 * h));
        }
    }
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

double Decap::curve(int s, double x) {
    const StyleNorm& n = norm();
    return (rawG(s, x + kBias[s]) - n.gb[s]) * n.inv[s];
}
double Decap::curveF(int s, double x) {
    const StyleNorm& n = norm();
    return (rawF(s, x + kBias[s]) - n.gb[s] * x) * n.inv[s];
}
double Decap::autoGainOf(int s, double db) {
    const double* row = kAutoDb[std::clamp(s, 0, 4)];
    if (db <= kAutoAt[0]) return dbLin(row[0]);
    for (int i = 1; i < kAutoN; ++i) {
        if (db <= kAutoAt[i]) {
            const double t = (db - kAutoAt[i - 1]) / (kAutoAt[i] - kAutoAt[i - 1]);
            return dbLin(row[i - 1] + (row[i] - row[i - 1]) * t);
        }
    }
    return dbLin(row[kAutoN - 1]);
}

void Decap::prepare(double sampleRate) {
    sr_ = sampleRate > 0 ? sampleRate : 48000;
    norm();
    // Le filtre x kOs : N = kLatency x kOs + 1 coefficients, gain continu kOs (interpolation)
    const int n = kLatency * kOs + 1;
    std::vector<double> h(n);
    const double c = (n - 1) / 2.0;
    const double fc = kFirFc / (2.0 * kOs);
    const double i0b = besselI0(kKaiserBeta);
    double sum = 0;
    for (int i = 0; i < n; ++i) {
        const double t = i - c;
        const double sinc = t == 0 ? 2 * fc : std::sin(2 * kPi * fc * t) / (kPi * t);
        const double r = t / c;
        const double w = besselI0(kKaiserBeta * std::sqrt(std::max(0.0, 1 - r * r))) / i0b;
        h[i] = sinc * w;
        sum += h[i];
    }
    for (double& x : h) x *= kOs / sum;
    ph_.assign(kOs * kTaps, 0.0);
    for (int p = 0; p < kOs; ++p)
        for (int i = 0; i < kTaps; ++i) ph_[p * kTaps + i] = p + i * kOs < n ? h[p + i * kOs] : 0;
    nd_ = n;
    hd_.assign(n, 0.0);
    for (int i = 0; i < n; ++i) hd_[i] = h[i] / kOs;
    for (int c2 = 0; c2 < 2; ++c2) {
        upH_[c2].assign(2 * kTaps, 0.0);
        dnH_[c2].assign(2 * nd_, 0.0);
    }
    reset();
}

void Decap::clearState() {
    for (auto& v : upH_) std::fill(v.begin(), v.end(), 0.0);
    for (auto& v : dnH_) std::fill(v.begin(), v.end(), 0.0);
    upW_ = dnW_ = 0;
    ch_ = {};
    ax_ = {};
    aF_ = {};
    aS_ = {{-1, -1}};
}

void Decap::reset() {
    clearState();
    for (auto& d : dry_) d.fill(0);
    dryW_ = 0;
    e_ = 0;
    needReset_ = true;
    dir_ = s_.mm ? dbLin(outDbOf(s_.out)) : 1;
}

void Decap::set(const DecapSettings& s) {
    s_ = s;
    s_.style = std::clamp(s.style, 0, kStyles - 1);
    target_ = (!s_.mm && s_.drive > 0) ? 1 : 0;
}

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
            dry_[0][w] = L[i];
            dry_[1][w] = R[i];
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
        return;
    }
    if (needReset_) {
        clearState();
        needReset_ = false;
        style_ = s_.style;
        drive_ = driveDbOf(s_.drive, s_.punish);
        auto_ = s_.autoGain ? autoGainOf(style_, drive_) : 1;
        mix_ = s_.mix;
        out_ = dbLin(outDbOf(s_.out));
        tilt_ = tiltOf(s_.tone);
        low_ = lowHzOf(s_.low) > 0 ? lowHzOf(s_.low) : 20;
        high_ = highHzOf(s_.high) > 0 ? highHzOf(s_.high) : 20000;
        sw_ = 1;
    }

    // Les coupures au bloc, lissees en log
    const double kB = 1 - std::exp(-n / (0.03 * sr));
    const double lowHz = lowHzOf(s_.low), highHz = highHzOf(s_.high);
    const double lowT = lowHz > 0 ? lowHz : 20;
    const double highT = highHz > 0 ? highHz : 20000;
    low_ *= std::pow(lowT / low_, kB);
    high_ *= std::pow(highT / high_, kB);
    tilt_ += (tiltOf(s_.tone) - tilt_) * kB;
    const bool lowOn = lowHz > 0 || low_ > 21;
    const bool highOn = highHz > 0 || high_ < 19900;

    const int st = style_;
    const double gLo = dbLin(kPreLoDb[st]), gHi = dbLin(kPreHiDb[st]);
    const double gPre = tptG(kPreHz[st], sr);
    const double gPost = gPre * (gLo / gHi);
    const double aPre = gPre / (1 + gPre), aPost = gPost / (1 + gPost);
    const double iLo = 1 / gLo, iHi = 1 / gHi;
    const double gSlp = kPostLpHz[st] > 0 ? tptG(kPostLpHz[st], sr) : 0;
    const double aSlp = gSlp / (1 + gSlp);
    const double gT = tptG(kTiltHz, sr), aT = gT / (1 + gT);
    const double tLo = dbLin(-kTiltDb * tilt_), tHi = dbLin(kTiltDb * tilt_);
    const double gL = tptG(low_, sr);
    const double kL = s_.thump ? 1 / 2.0 : std::sqrt(2.0);
    const double a1L = 1 / (1 + gL * (gL + kL));
    const double gH = tptG(high_, sr), aH = gH / (1 + gH);
    const double kA = 1 / 0.618, kBq = 1 / 1.618;
    const double a1A = 1 / (1 + gH * (gH + kA)), a1B = 1 / (1 + gH * (gH + kBq));
    const bool steep = s_.steep;
    const double aDc = 1 - (2 * kPi * kDcHz) / sr;
    const double ref = std::max(1e-4, s_.ref);
    const double iref = 1 / ref;
    const double fade = 1 / (kFadeS * sr);
    const double swStep = 1 / (kStyleFadeS * sr);
    const double driveT = driveDbOf(s_.drive, s_.punish);
    const double outT = dbLin(outDbOf(s_.out));

    for (int i = 0; i < n; ++i) {
        e_ += target_ > e_ ? std::min(fade, target_ - e_) : -std::min(fade, e_ - target_);
        if (s_.style != style_) {
            sw_ -= swStep;
            if (sw_ <= 0) {
                sw_ = 0;
                style_ = s_.style;
            }
        } else if (sw_ < 1) {
            sw_ = std::min(1.0, sw_ + swStep);
        }
        drive_ += (driveT - drive_) * kS;
        mix_ += (s_.mix - mix_) * kS;
        out_ += (outT - out_) * kS;
        dir_ += (dirT - dir_) * kS;
        const double autoT = s_.autoGain ? autoGainOf(style_, drive_) : 1;
        auto_ += (autoT - auto_) * kS;
        const double gIn = dbLin(drive_) * ref;
        const double gOut = auto_ * sw_ * iref;
        const int w = upW_, dw = dryW_;
        const int sty = style_;
        double dec[2] = {0, 0};
        int dwi0 = dnW_;
        for (int c = 0; c < 2; ++c) {
            Ch& s = ch_[c];
            const double x = c == 0 ? L[i] : R[i];
            dry_[c][dw] = x;
            double y = x;
            if (lowOn) {
                const double hp = (y - (gL + kL) * s.lc1 - s.lc2) * a1L;
                const double v1 = gL * hp;
                const double bp = v1 + s.lc1;
                s.lc1 = bp + v1;
                const double v2 = gL * bp;
                const double lp = v2 + s.lc2;
                s.lc2 = lp + v2;
                y = hp;
            }
            {
                const double v = (y - s.tilt) * aT;
                const double lp = v + s.tilt;
                s.tilt = lp + v;
                y = tLo * lp + tHi * (y - lp);
            }
            {
                const double v = (y - s.pre) * aPre;
                const double lp = v + s.pre;
                s.pre = lp + v;
                y = gLo * lp + gHi * (y - lp);
            }
            std::vector<double>& hb = upH_[c];
            hb[w] = y * gIn;
            hb[w + kTaps] = y * gIn;
            std::vector<double>& dh = dnH_[c];
            int dwi = dwi0;
            if (aS_[c] != sty) {
                aF_[c] = curveF(sty, ax_[c]);
                aS_[c] = sty;
            }
            for (int q = 0; q < kOs; ++q) {
                double acc = 0;
                const double* pq = &ph_[q * kTaps];
                for (int k = 0; k < kTaps; ++k) acc += pq[k] * hb[w + kTaps - k];
                // ADAA du premier ordre
                const double x1 = ax_[c];
                const double Fx = curveF(sty, acc);
                const double dxa = acc - x1;
                const double z = (dxa > kAdaaEps || dxa < -kAdaaEps) ? (Fx - aF_[c]) / dxa : curve(sty, 0.5 * (acc + x1));
                ax_[c] = acc;
                aF_[c] = Fx;
                dh[dwi] = z;
                dh[dwi + nd_] = z;
                if (q == 0) {
                    // La decimation sur la phase 0 : le mouille en phase avec le sec retarde de kLatency
                    const int base = dwi + nd_;
                    double d = 0;
                    for (int k = 0; k < nd_; ++k) d += hd_[k] * dh[base - k];
                    dec[c] = d;
                }
                dwi = dwi + 1 == nd_ ? 0 : dwi + 1;
            }
            if (c == 1) dnW_ = dwi;
            y = dec[c];
            {
                const double dy = y - s.dcx + aDc * s.dcy;
                s.dcx = y;
                s.dcy = dy;
                y = dy;
            }
            {
                const double v = (y - s.post) * aPost;
                const double lp = v + s.post;
                s.post = lp + v;
                y = iHi * y + (iLo - iHi) * lp;
            }
            if (gSlp > 0) {
                const double v = (y - s.slp) * aSlp;
                const double lp = v + s.slp;
                s.slp = lp + v;
                y = lp;
            }
            if (highOn) {
                const double v = (y - s.hc0) * aH;
                const double lp = v + s.hc0;
                s.hc0 = lp + v;
                y = lp;
                if (steep) {
                    double hp = (y - (gH + kA) * s.ha1 - s.ha2) * a1A;
                    double v1 = gH * hp, bp = v1 + s.ha1;
                    s.ha1 = bp + v1;
                    double v2 = gH * bp, l2 = v2 + s.ha2;
                    s.ha2 = l2 + v2;
                    y = l2;
                    hp = (y - (gH + kBq) * s.hb1 - s.hb2) * a1B;
                    v1 = gH * hp;
                    bp = v1 + s.hb1;
                    s.hb1 = bp + v1;
                    v2 = gH * bp;
                    l2 = v2 + s.hb2;
                    s.hb2 = l2 + v2;
                    y = l2;
                }
            }
            const double wet = y * gOut;
            const double dryD = dry_[c][dw + 1 == DN ? 0 : dw + 1];
            const double proc = (dryD + (wet - dryD) * mix_) * out_;
            const double r = x * dir_ + (proc - x * dir_) * e_;
            (c == 0 ? L : R)[i] = static_cast<float>(r);
        }
        upW_ = w + 1 == kTaps ? 0 : w + 1;
        dryW_ = dw + 1 == DN ? 0 : dw + 1;
    }
    // Les queues sous le denormal
    for (Ch& s : ch_)
        for (double* p : {&s.tilt, &s.pre, &s.post, &s.lc1, &s.lc2, &s.dcx, &s.dcy, &s.slp, &s.hc0, &s.ha1, &s.ha2, &s.hb1, &s.hb2})
            if (std::fabs(*p) < 1e-20) *p = 0;
}

} // namespace mmarp
