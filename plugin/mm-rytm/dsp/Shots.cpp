// Portage de src/v4/audio/shotsdsp.ts, sampledsp.ts et stretch.ts. Voir Shots.h.
#include "Shots.h"

#include <algorithm>
#include <array>
#include <cmath>
#include <cstring>
#include <limits>

namespace mm {

namespace {

constexpr int OS = 4;
constexpr double PI = 3.14159265358979323846;
constexpr double TAU = PI * 2.0;

// Math.round de JS : arrondi vers +infini a la demi-unite (std::round arrondit loin de zero).
inline double jsRound(double x) { return std::floor(x + 0.5); }
inline long jsRoundL(double x) { return static_cast<long>(std::floor(x + 0.5)); }
inline double clampd(double v, double lo, double hi) { return std::max(lo, std::min(hi, v)); }

using Buf = std::vector<double>;
using FBuf = std::vector<float>;

/* ---------------- les lois du kit ---------------- */

double sweepDepth(double v) { return 2.0 * clampd(v, 0.0, 1.0); }
double sdTuneFactor(double v) { return v == 0.5 ? 1.0 : std::pow(2.0, (v - 0.5) * 2.0); }
double sdDecayFactor(double v) { return v == 0.5 ? 1.0 : std::pow(2.0, (v - 0.5) * 2.5); }
double sdToneFactor(double v) { return v == 0.5 ? 1.0 : std::pow(2.0, (v - 0.5) * 2.0); }

double kickHz(KitModel m, double tune) {
    const double base = m == KitModel::K808 ? 49.0 : 52.0;
    return base * std::pow(2.0, tune - 0.5);
}

double kickDecayS(KitModel m, double decay) {
    if (m == KitModel::K808) return 0.16 * std::pow(8.0, decay);
    if (m == KitModel::K909) return 0.09 * std::pow(7.0, decay);
    return 0.06 * std::pow(4.0, decay);
}

/* ---------------- la sonie ---------------- */

constexpr double SHOT_KICK_PEAK = -2.5;
constexpr double OH_SOFT_LOUD = -14.0;
constexpr double LOUD_WIN_S = 0.1;

double shotLoud(ShotId id) {
    switch (id) {
        case ShotId::BD: return -7.5;
        case ShotId::SD: case ShotId::TOM: case ShotId::HT: case ShotId::CP: return -9.6;
        case ShotId::CH: case ShotId::CHopen: return -10.5;
        case ShotId::OH: return -11.0;
        case ShotId::CY: return -12.0;
    }
    return -10.0;
}

double shotBelow(ShotId id) {
    switch (id) {
        case ShotId::BD: return 1.5;
        case ShotId::SD: case ShotId::TOM: case ShotId::HT: case ShotId::CP: return 2.0;
        case ShotId::CH: case ShotId::CHopen: case ShotId::OH: return 2.5;
        case ShotId::CY: return 3.5;
    }
    return 2.0;
}

// La sonie cible : SHOT_LOUD, sauf l'open hat MM et les samples d'open hat. synth : nul pour un sample.
double loudOf(ShotId id, const KitModel* synth) {
    if (id == ShotId::OH && !(synth && (*synth == KitModel::K909 || *synth == KitModel::K808))) return OH_SOFT_LOUD;
    return shotLoud(id);
}

// biquad forme directe I : sortie stockee en float (Float32Array), etat en double.
FBuf biquadDF1(const FBuf& x, double b0, double b1, double b2, double a1, double a2) {
    FBuf y(x.size());
    double x1 = 0, x2 = 0, y1 = 0, y2 = 0;
    for (size_t i = 0; i < x.size(); ++i) {
        const double v = b0 * x[i] + b1 * x1 + b2 * x2 - a1 * y1 - a2 * y2;
        x2 = x1;
        x1 = x[i];
        y2 = y1;
        y1 = v;
        y[i] = static_cast<float>(v);
    }
    return y;
}

FBuf kWeight(const FBuf& x, double sr) {
    double K = std::tan((PI * 1681.974450955533) / sr);
    const double Q = 0.7071752369554196;
    const double Vh = std::pow(10.0, 3.999843853973347 / 20.0);
    const double Vb = std::pow(Vh, 0.4996667741545416);
    double a0 = 1 + K / Q + K * K;
    FBuf pre = biquadDF1(x, (Vh + (Vb * K) / Q + K * K) / a0, (2 * (K * K - Vh)) / a0, (Vh - (Vb * K) / Q + K * K) / a0,
                         (2 * (K * K - 1)) / a0, (1 - K / Q + K * K) / a0);
    K = std::tan((PI * 38.13547087602444) / sr);
    const double Q2 = 0.5003270373238773;
    a0 = 1 + K / Q2 + K * K;
    return biquadDF1(pre, 1, -2, 1, (2 * (K * K - 1)) / a0, (1 - K / Q2 + K * K) / a0);
}

double peakOf(const Shot& s) {
    double p = 0;
    auto scan = [&p](const FBuf& c) {
        for (float v : c) {
            const double a = std::fabs(static_cast<double>(v));
            if (a > p && a < std::numeric_limits<double>::infinity()) p = a;
        }
    };
    scan(s.L);
    if (!s.mono) scan(s.R);
    return p;
}

double loudGain(ShotId id, const Shot& s, double sr, double loud) {
    const double p = peakOf(s);
    const double cap = std::pow(10.0, (SHOT_KICK_PEAK - shotBelow(id)) / 20.0) / p;
    if (id == ShotId::BD) return cap;
    return std::min(cap, std::pow(10.0, (loud - shotLoudness(s, sr)) / 20.0));
}

void applyGain(Shot& s, double k) {
    if (!std::isfinite(k) || k <= 0) return;
    for (auto& v : s.L) v = static_cast<float>(v * k);
    if (!s.mono) for (auto& v : s.R) v = static_cast<float>(v * k);
}

void setLoudness(ShotId id, Shot& s, double sr, double loud) { applyGain(s, loudGain(id, s, sr, loud)); }

double shotCeiling(ShotId id) { return std::pow(10.0, (SHOT_KICK_PEAK - shotBelow(id)) / 20.0); }

/* ---------------- outils ---------------- */

// mulberry32, identique bit a bit a celui du site.
struct Rng {
    uint32_t a;
    explicit Rng(uint32_t seed) : a(seed) {}
    double operator()() {
        a = a + 0x6d2b79f5u;
        uint32_t t = a;
        t = (t ^ (t >> 15)) * (t | 1u);
        t ^= t + (t ^ (t >> 7)) * (t | 61u);
        return static_cast<double>(t ^ (t >> 14)) / 4294967296.0;
    }
};

enum class BqType { LP, HP, BP, PEAK, HSHELF, LSHELF };

// Biquad RBJ, forme directe transposee.
struct Bq {
    double b0 = 1, b1 = 0, b2 = 0, a1 = 0, a2 = 0, z1 = 0, z2 = 0;
    Bq(BqType type, double f, double q, double fs, double db = 0) {
        const double w = (TAU * std::min(f, fs * 0.49)) / fs;
        const double cw = std::cos(w);
        const double sw = std::sin(w);
        const double al = sw / (2 * q);
        const double A = std::pow(10.0, db / 40.0);
        double B0, B1, B2, A0, A1, A2;
        if (type == BqType::LP) {
            B0 = (1 - cw) / 2; B1 = 1 - cw; B2 = B0; A0 = 1 + al; A1 = -2 * cw; A2 = 1 - al;
        } else if (type == BqType::HP) {
            B0 = (1 + cw) / 2; B1 = -(1 + cw); B2 = B0; A0 = 1 + al; A1 = -2 * cw; A2 = 1 - al;
        } else if (type == BqType::BP) {
            B0 = al; B1 = 0; B2 = -al; A0 = 1 + al; A1 = -2 * cw; A2 = 1 - al;
        } else if (type == BqType::PEAK) {
            B0 = 1 + al * A; B1 = -2 * cw; B2 = 1 - al * A; A0 = 1 + al / A; A1 = -2 * cw; A2 = 1 - al / A;
        } else {
            const double s = 2 * std::sqrt(A) * al;
            const double sg = type == BqType::HSHELF ? 1.0 : -1.0;
            B0 = A * (A + 1 + sg * (A - 1) * cw + s);
            B1 = -2 * sg * A * (A - 1 + sg * (A + 1) * cw);
            B2 = A * (A + 1 + sg * (A - 1) * cw - s);
            A0 = A + 1 - sg * (A - 1) * cw + s;
            A1 = 2 * sg * (A - 1 - sg * (A + 1) * cw);
            A2 = A + 1 - sg * (A - 1) * cw - s;
        }
        b0 = B0 / A0; b1 = B1 / A0; b2 = B2 / A0; a1 = A1 / A0; a2 = A2 / A0;
    }
    double run(double x) {
        const double y = b0 * x + z1;
        z1 = b1 * x - a1 * y + z2;
        z2 = b2 * x - a2 * y;
        return y;
    }
};

double besselI0(double x) {
    double s = 1, t = 1;
    for (int k = 1; k < 32; ++k) {
        t *= (x / (2 * k)) * (x / (2 * k));
        s += t;
        if (t < 1e-12 * s) break;
    }
    return s;
}

const std::array<double, 127>& decFilter() {
    static const std::array<double, 127> h = [] {
        std::array<double, 127> out{};
        const int N = 127;
        const double M = (N - 1) / 2.0;
        const double fc = 0.5 / OS;
        const double beta = 8;
        double sum = 0;
        for (int n = 0; n < N; ++n) {
            const double k = n - M;
            const double sinc = k == 0 ? 2 * fc : std::sin(TAU * fc * k) / (PI * k);
            const double r = k / M;
            const double w = besselI0(beta * std::sqrt(std::max(0.0, 1 - r * r))) / besselI0(beta);
            out[n] = sinc * w;
            sum += out[n];
        }
        for (int n = 0; n < N; ++n) out[n] /= sum;
        return out;
    }();
    return h;
}

FBuf decimate(const Buf& x) {
    const auto& DEC = decFilter();
    const long N = 127;
    const long M = (N - 1) / 2;
    const long len = static_cast<long>(x.size());
    const long n = len / OS;
    FBuf y(static_cast<size_t>(n));
    for (long j = 0; j < n; ++j) {
        const long c = j * OS + M;
        double acc = 0;
        const long k0 = std::max(0L, c - (len - 1));
        const long k1 = std::min(N - 1, c);
        for (long k = k0; k <= k1; ++k) acc += DEC[k] * x[c - k];
        y[j] = static_cast<float>(acc);
    }
    return y;
}

template <typename V>
void fadeOut(V& x, double fs, double sec) {
    const long len = static_cast<long>(x.size());
    const long n = std::min(len, jsRoundL(sec * fs));
    for (long i = 0; i < n; ++i) {
        const long k = len - n + i;
        x[k] = static_cast<typename V::value_type>(x[k] * (0.5 + 0.5 * std::cos((PI * (i + 1)) / n)));
    }
}

void dcBlock(FBuf& x, double fs, double hz) {
    const double R = std::exp((-TAU * hz) / fs);
    double px = 0, py = 0;
    for (auto& xi : x) {
        const double y = xi - px + R * py;
        px = xi;
        py = y;
        xi = static_cast<float>(y);
    }
}

inline double sat(double x, double k) { return std::tanh(k * x) / k; }
inline double sq(double ph) { return ph - std::floor(ph) < 0.5 ? 1.0 : -1.0; }
inline double tri(double ph) {
    const double p = ph - std::floor(ph);
    return p < 0.5 ? 4 * p - 1 : 3 - 4 * p;
}

// Reverbe FDN 8 lignes (Hadamard), a la frequence du contexte.
void fdn(const FBuf& input, double fs, long len, double rt60, double dampHz, double preMs, double size, FBuf& L, FBuf& R) {
    L.assign(static_cast<size_t>(len), 0.f);
    R.assign(static_cast<size_t>(len), 0.f);
    const double base[8] = {29.7, 37.1, 41.1, 43.7, 53.5, 59.9, 67.3, 73.1};
    long lines[8];
    std::vector<float> bufs[8];
    long idx[8] = {0};
    double g[8];
    for (int k = 0; k < 8; ++k) {
        lines[k] = std::max(8L, jsRoundL((base[k] * size * fs) / 1000.0));
        bufs[k].assign(static_cast<size_t>(lines[k]), 0.f);
        g[k] = std::pow(10.0, (-3.0 * lines[k]) / (rt60 * fs));
    }
    const double dk = std::exp((-TAU * dampHz) / fs);
    double lp[8] = {0};
    const long apN[2] = {jsRoundL(0.0053 * fs), jsRoundL(0.0079 * fs)};
    std::vector<float> ap[2] = {std::vector<float>(static_cast<size_t>(apN[0]), 0.f), std::vector<float>(static_cast<size_t>(apN[1]), 0.f)};
    long apI[2] = {0, 0};
    const long pre = jsRoundL((preMs / 1000.0) * fs);
    const long inLen = static_cast<long>(input.size());
    double v[8];
    const double s = 1.0 / std::sqrt(8.0);
    for (long i = 0; i < len; ++i) {
        double x = i - pre >= 0 && i - pre < inLen ? input[i - pre] : 0.0;
        for (int a = 0; a < 2; ++a) {
            auto& b = ap[a];
            const double d = b[apI[a]];
            const double y = -0.6 * x + d;
            b[apI[a]] = static_cast<float>(x + 0.6 * y);
            apI[a] = (apI[a] + 1) % static_cast<long>(b.size());
            x = y;
        }
        for (int k = 0; k < 8; ++k) v[k] = bufs[k][idx[k]];
        const double a0 = v[0] + v[1], a1 = v[0] - v[1], a2 = v[2] + v[3], a3 = v[2] - v[3];
        const double a4 = v[4] + v[5], a5 = v[4] - v[5], a6 = v[6] + v[7], a7 = v[6] - v[7];
        const double b0 = a0 + a2, b1 = a1 + a3, b2 = a0 - a2, b3 = a1 - a3;
        const double b4 = a4 + a6, b5 = a5 + a7, b6 = a4 - a6, b7 = a5 - a7;
        const double m[8] = {(b0 + b4) * s, (b1 + b5) * s, (b2 + b6) * s, (b3 + b7) * s,
                             (b0 - b4) * s, (b1 - b5) * s, (b2 - b6) * s, (b3 - b7) * s};
        double l = 0, r = 0;
        for (int k = 0; k < 8; ++k) {
            lp[k] = m[k] * (1 - dk) + lp[k] * dk;
            bufs[k][idx[k]] = static_cast<float>(x + lp[k] * g[k]);
            idx[k] = (idx[k] + 1) % lines[k];
            if (k % 2 == 0) l += v[k];
            else r += v[k];
        }
        L[i] = static_cast<float>(l * 0.35);
        R[i] = static_cast<float>(r * 0.35);
    }
}

Shot monoShot(FBuf y) {
    Shot s;
    s.L = std::move(y);
    s.mono = true;
    return s;
}

Shot stereoShot(FBuf l, FBuf r) {
    Shot s;
    s.L = std::move(l);
    s.R = std::move(r);
    s.mono = false;
    return s;
}

/* ---------------- les sons ---------------- */

Shot bd(double sr, double ts, Rng& r, const ShotTweak& tw) {
    const double fs = sr * OS;
    const KitModel m = tw.model;
    const double kf = kickHz(m, tw.tune) / (m == KitModel::K808 ? 49.0 : 52.0);
    const double tauA = kickDecayS(m, tw.decay) * ts;
    const long len = jsRoundL(fs * std::max(0.16, std::min(2.0, 3.5 * tauA)));
    Buf x(static_cast<size_t>(len));
    Bq bp(BqType::BP, 1600, 0.8, fs);
    const double k = 1.5 * (0.4 + 2.4 * tw.drive);
    const double drive = std::tanh(k);
    const double clickAmt = 0.42 * tw.attack;
    const double sw = sweepDepth(tw.sweep);
    double ph = 0;
    for (long i = 0; i < len; ++i) {
        const double t = i / fs;
        const double f = (52 + 130 * sw * std::exp(-t / 0.008) + 24 * sw * std::exp(-t / 0.04)) * kf;
        ph += f / fs;
        const double amp = (1 - std::exp(-t / 0.0006)) * std::exp(-t / tauA) * (1 + 0.25 * std::exp(-t / 0.02));
        const double b = std::sin(TAU * ph) * amp;
        const double body = std::tanh(k * b) / drive;
        const double click = clickAmt * bp.run(r() * 2 - 1) * std::exp(-t / 0.002);
        x[i] = body + click;
    }
    fadeOut(x, fs, std::min(0.04, len / fs / 4));
    FBuf y = decimate(x);
    dcBlock(y, sr, 20);
    return monoShot(std::move(y));
}

Shot gatedVerb(const FBuf& dl, const FBuf* dr, double sr, double ts) {
    const double hold = 0.13 * std::min(1.6, std::max(0.7, ts));
    const double close = 0.04;
    const long n = static_cast<long>(dl.size());
    const long total = std::max(n, jsRoundL((hold + close + 0.01) * sr));
    FBuf mixed;
    const FBuf* input = &dl;
    if (dr) {
        mixed.resize(static_cast<size_t>(n));
        for (long i = 0; i < n; ++i) mixed[i] = static_cast<float>(0.5 * (static_cast<double>(dl[i]) + (*dr)[i]));
        input = &mixed;
    }
    FBuf wl, wr;
    fdn(*input, sr, total, 1.1, 7500, 6, 0.8, wl, wr);
    FBuf L(static_cast<size_t>(total)), R(static_cast<size_t>(total));
    const double wet = 0.32;
    const FBuf& rr = dr ? *dr : dl;
    for (long i = 0; i < total; ++i) {
        const double t = i / sr;
        const double gate = t < hold ? 1 : t < hold + close ? 0.5 + 0.5 * std::cos((PI * (t - hold)) / close) : 0;
        L[i] = static_cast<float>((i < n ? dl[i] : 0.0) + wet * gate * wl[i]);
        R[i] = static_cast<float>((i < n ? rr[i] : 0.0) + wet * gate * wr[i]);
    }
    return stereoShot(std::move(L), std::move(R));
}

Shot sd(double sr, double ts, Rng& r, const ShotTweak& tw) {
    const double fs = sr * OS;
    const double wiresK = 2 * tw.snappy;
    const double ft = sdTuneFactor(tw.sdTune);
    const double fd = sdDecayFactor(tw.sdDecay);
    const double fc = sdToneFactor(tw.sdTone);
    const double td = ts * fd;
    const double dryS = std::max(0.12, 0.3 * td);
    const long len = jsRoundL(fs * dryS);
    Buf x(static_cast<size_t>(len));
    Bq hp1(BqType::HP, 1200 * fc, 0.7, fs);
    Bq pkF(BqType::PEAK, 4500 * fc, 0.9, fs, 4);
    Bq air(BqType::HSHELF, 10000, 0.7, fs, 1.5);
    Bq top(BqType::LP, 15000, 0.7, fs);
    Bq crackBp(BqType::BP, 2500, 1, fs);
    double p1 = 0, p2 = 0, p3 = 0;
    for (long i = 0; i < len; ++i) {
        const double t = i / fs;
        p1 += ((185 + 30 * std::exp(-t / 0.01)) * ft) / fs;
        p2 += (330 * ft) / fs;
        p3 += (540 * ft) / fs;
        const double body = std::sin(TAU * p1) * std::exp(-t / (0.045 * td)) + 0.45 * std::sin(TAU * p2) * std::exp(-t / (0.025 * fd)) +
                            0.35 * std::sin(TAU * p3) * std::exp(-t / (0.012 * fd));
        const double n = r() * 2 - 1;
        const double wiresEnv = (1 - std::exp(-t / 0.0005)) * (0.85 * std::exp(-t / (0.05 * td)) + 0.15 * std::exp(-t / (0.13 * td)));
        const double wires = top.run(air.run(pkF.run(hp1.run(n)))) * wiresEnv;
        const double crack = crackBp.run(r() * 2 - 1) * std::exp(-t / 0.002);
        x[i] = sat(0.8 * body + 1.5 * wiresK * wires + 2 * crack, 1.3);
    }
    fadeOut(x, fs, 0.03);
    FBuf dry = decimate(x);
    dcBlock(dry, sr, 60);
    if (!tw.gate) return monoShot(std::move(dry));
    return gatedVerb(dry, nullptr, sr, ts);
}

Shot cp(double sr, double ts, Rng& r, bool gate, const ShotTweak& tw) {
    const double fs = sr * OS;
    const double td = ts * sdDecayFactor(tw.sdDecay);
    const double fc = std::max(0.5, std::min(1.6, sdToneFactor(tw.sdTone)));
    const double base[4] = {0, 0.0095, 0.019, 0.031};
    double offs[4];
    for (int k = 0; k < 4; ++k) offs[k] = k == 0 ? 0 : base[k] + (r() - 0.5) * 0.003;
    const double lastT = offs[3];
    const long len = jsRoundL(fs * (lastT + std::max(0.1, 0.3 * td)));
    struct F { Bq bp, hp, pkF; };
    auto mk = [&]() { return F{Bq(BqType::BP, 1250 * fc, 1.6, fs), Bq(BqType::HP, 600 * fc, 0.7, fs), Bq(BqType::PEAK, 2600 * fc, 1, fs, 1.5)}; };
    F fl = mk();
    F fr = mk();
    Buf xl(static_cast<size_t>(len)), xr(static_cast<size_t>(len));
    const double skew = 0.0003;
    auto env = [&](double t) {
        double e = 0;
        for (int k = 0; k < 4; ++k) {
            const double u = t - offs[k];
            if (u < 0) continue;
            const double a = 1 - std::exp(-u / 0.0003);
            e += k < 3 ? a * std::exp(-u / 0.0045) : a * std::exp(-u / (0.075 * td));
        }
        return e;
    };
    for (long i = 0; i < len; ++i) {
        const double t = i / fs;
        const double nl = fl.pkF.run(fl.hp.run(fl.bp.run(r() * 2 - 1)));
        const double nr = fr.pkF.run(fr.hp.run(fr.bp.run(r() * 2 - 1)));
        xl[i] = sat(nl * env(t) * 2, 1.2);
        xr[i] = sat(nr * env(t - skew) * 2, 1.2);
    }
    fadeOut(xl, fs, 0.03);
    fadeOut(xr, fs, 0.03);
    FBuf dl = decimate(xl);
    FBuf dr = decimate(xr);
    if (!gate) return stereoShot(std::move(dl), std::move(dr));
    FBuf mono(dl.size());
    for (size_t i = 0; i < mono.size(); ++i) mono[i] = static_cast<float>(0.5 * (static_cast<double>(dl[i]) + dr[i]));
    const long total = static_cast<long>(dl.size()) + jsRoundL(0.12 * sr);
    FBuf wl, wr;
    fdn(mono, sr, total, 0.45, 6000, 4, 0.55, wl, wr);
    FBuf L(static_cast<size_t>(total)), R(static_cast<size_t>(total));
    const long dn = static_cast<long>(dl.size());
    for (long i = 0; i < total; ++i) {
        const double fade = i > total - 0.08 * sr ? 0.5 + 0.5 * std::cos((PI * (i - (total - 0.08 * sr))) / (0.08 * sr)) : 1;
        L[i] = static_cast<float>((i < dn ? dl[i] : 0.0) + 0.16 * wl[i] * fade);
        R[i] = static_cast<float>((i < dn ? dr[i] : 0.0) + 0.16 * wr[i] * fade);
    }
    return stereoShot(std::move(L), std::move(R));
}

const double METAL_HZ[6] = {205.3, 304.4, 369.6, 522.7, 540, 800};

Shot hat(double sr, double ts, Rng& r, double decay, const double tail[2], double lenS, double bpHz, const ShotTweak& tw) {
    const double fs = sr * OS;
    const double td = ts * sdDecayFactor(tw.sdDecay);
    const double ft = sdTuneFactor(tw.sdTune);
    const double fc = std::max(0.6, std::min(1.35, sdToneFactor(tw.sdTone)));
    const long len = jsRoundL(fs * std::max(0.05, lenS * td));
    Buf x(static_cast<size_t>(len));
    double ph[6];
    for (double& p : ph) p = r();
    Bq bp1(BqType::BP, bpHz * fc, 1, fs);
    Bq bp2(BqType::BP, bpHz * 1.18 * fc, 1.2, fs);
    Bq hp1(BqType::HP, 7000 * fc, 0.7, fs);
    Bq hp2(BqType::HP, 7000 * fc, 0.7, fs);
    Bq nhp(BqType::HP, 8000 * fc, 0.7, fs);
    Bq air(BqType::HSHELF, 12000, 0.7, fs, 1.5);
    Bq top(BqType::LP, 16000, 0.7, fs);
    const double d = decay * td * (0.95 + 0.1 * r());
    for (long i = 0; i < len; ++i) {
        const double t = i / fs;
        double m = 0;
        for (int k = 0; k < 6; ++k) m += sq(ph[k] + (METAL_HZ[k] * ft * t));
        m /= 6;
        const double metal = hp2.run(hp1.run(0.6 * bp1.run(m) + 0.5 * bp2.run(m)));
        const double noise = nhp.run(r() * 2 - 1);
        const double env = (1 - std::exp(-t / 0.0002)) * ((1 - tail[0]) * std::exp(-t / d) + tail[0] * std::exp(-t / (tail[1] * td)));
        x[i] = top.run(air.run(1.6 * metal + 0.3 * noise)) * env;
    }
    fadeOut(x, fs, std::min(0.03, len / fs / 3));
    return monoShot(decimate(x));
}

double blep(double t, double dt) {
    if (t < dt) {
        const double u = t / dt;
        return u + u - u * u - 1;
    }
    if (t > 1 - dt) {
        const double u = (t - 1) / dt;
        return u * u + u + u + 1;
    }
    return 0;
}

double sqBl(double ph, double dt) {
    const double p = ph - std::floor(ph);
    const double h = p + 0.5 - std::floor(p + 0.5);
    return (p < 0.5 ? 1.0 : -1.0) + blep(p, dt) - blep(h, dt);
}

Shot openHat(double sr, double ts, Rng& r, const ShotTweak& tw) {
    const double fs = sr * OS;
    const double td = ts * sdDecayFactor(tw.sdDecay);
    const double ft = sdTuneFactor(tw.sdTune);
    const double fc = std::max(0.6, std::min(1.35, sdToneFactor(tw.sdTone)));
    const double lenS = std::max(0.3, 1.1 * td);
    const long len = jsRoundL(fs * lenS);
    Buf x(static_cast<size_t>(len));
    double ph[6], dts[6];
    for (double& p : ph) p = r();
    for (int k = 0; k < 6; ++k) dts[k] = (METAL_HZ[k] * ft) / fs;
    Bq bpLo(BqType::BP, 7800 * fc, 0.8, fs);
    Bq bpHi(BqType::BP, 10500 * fc, 1, fs);
    Bq mhp(BqType::HP, 5200 * fc, 0.7, fs);
    Bq nbp(BqType::BP, 8500 * fc, 0.6, fs);
    Bq nhp(BqType::HP, 6000 * fc, 0.7, fs);
    Bq top1(BqType::LP, 15000, 0.7, fs);
    Bq top2(BqType::LP, 15000, 0.7, fs);
    const double d = (0.95 + 0.1 * r()) * td;
    double dark = 0;
    for (long i = 0; i < len; ++i) {
        const double t = i / fs;
        double m = 0;
        for (int k = 0; k < 6; ++k) m += sqBl(ph[k] + METAL_HZ[k] * ft * t, dts[k]);
        m /= 6;
        const double metal = mhp.run(0.7 * bpLo.run(m) + 0.6 * bpHi.run(m));
        const double noise = nhp.run(nbp.run(r() * 2 - 1));
        const double env = (1 - std::exp(-t / 0.00025)) * (0.55 * std::exp(-t / (0.045 * d)) + 0.45 * std::exp(-t / (0.24 * d)));
        const double a = std::exp((-TAU * (7000 + 9000 * std::exp(-t / (0.2 * td)))) / fs);
        dark = (1 - a) * (metal + 0.55 * noise) + a * dark;
        x[i] = top2.run(top1.run(dark)) * env;
    }
    fadeOut(x, fs, std::min(0.15, lenS / 4));
    return monoShot(decimate(x));
}

Shot cy(double sr, double ts, Rng& r, const ShotTweak& tw) {
    const double fs = sr * OS;
    const double td = ts * sdDecayFactor(tw.sdDecay);
    const double ft = sdTuneFactor(tw.sdTune);
    const double fc = std::max(0.6, std::min(1.4, sdToneFactor(tw.sdTone)));
    const double lenS = std::min(6.0, std::max(0.3, 1.6 * td));
    const long len = jsRoundL(fs * lenS);
    double freqs[12];
    for (int k = 0; k < 6; ++k) {
        freqs[k] = METAL_HZ[k] * 2 * ft;
        freqs[k + 6] = METAL_HZ[k] * 2.73 * ft;
    }
    auto side = [&]() {
        Buf x(static_cast<size_t>(len));
        double ph[12];
        for (double& p : ph) p = r();
        Bq bp(BqType::BP, 6500 * fc, 0.7, fs);
        Bq hp1(BqType::HP, 4200 * fc, 0.7, fs);
        Bq hp2(BqType::HP, 4200 * fc, 0.7, fs);
        Bq nhp(BqType::HP, 6000 * fc, 0.7, fs);
        Bq air(BqType::HSHELF, 11000, 0.7, fs, 3);
        for (long i = 0; i < len; ++i) {
            const double t = i / fs;
            double m = 0;
            for (int k = 0; k < 12; ++k) m += sq(ph[k] + freqs[k] * t);
            m /= 12;
            const double env = (1 - std::exp(-t / 0.001)) * (0.55 * std::exp(-t / 0.05) + 0.45 * std::exp(-t / (0.55 * td)));
            x[i] = air.run(hp2.run(hp1.run(bp.run(m))) * 2 + 0.35 * nhp.run(r() * 2 - 1)) * env;
        }
        fadeOut(x, fs, std::min(0.15, lenS / 4));
        return x;
    };
    // L puis R, dans cet ordre (le generateur avance)
    Buf l = side();
    Buf rr = side();
    return stereoShot(decimate(l), decimate(rr));
}

Shot tom(double sr, double ts, Rng& r, double to0, double from0, double tau0, const ShotTweak& tw) {
    const double fs = sr * OS;
    const double ft = sdTuneFactor(tw.sdTune);
    const double td = ts * sdDecayFactor(tw.sdDecay);
    const double sw = sweepDepth(tw.sweep);
    const double fc = std::max(0.5, std::min(1.6, sdToneFactor(tw.sdTone)));
    const double to = to0 * ft;
    const double from = to + (from0 * ft - to) * sw;
    const double tau = tau0 * td;
    const long len = jsRoundL(fs * std::max(0.12, 0.45 * td * (tau0 / 0.17)));
    Buf x(static_cast<size_t>(len));
    Bq bp(BqType::BP, 1100 * fc, 1, fs);
    double p1 = 0, p2 = 0;
    for (long i = 0; i < len; ++i) {
        const double t = i / fs;
        const double f = to + (from - to) * std::exp(-t / 0.035);
        p1 += f / fs;
        p2 += (f * 1.59) / fs;
        const double a = (1 - std::exp(-t / 0.0004)) * std::exp(-t / tau);
        const double v = std::sin(TAU * p1) * a + 0.2 * std::sin(TAU * p2) * std::exp(-t / 0.03) + 0.3 * bp.run(r() * 2 - 1) * std::exp(-t / 0.004);
        x[i] = sat(v, 1.5);
    }
    fadeOut(x, fs, 0.03);
    FBuf y = decimate(x);
    dcBlock(y, sr, 30);
    return monoShot(std::move(y));
}

double trigClick(Bq& bp, double t) { return bp.run(t < 0.0015 ? 1 : 0); }

Shot bd909(double sr, double ts, Rng& r, const ShotTweak& tw) {
    const double fs = sr * OS;
    const double f0 = kickHz(KitModel::K909, tw.tune);
    const double tau = kickDecayS(KitModel::K909, tw.decay) * ts;
    const long len = jsRoundL(fs * std::max(0.25, std::min(2.5, 6 * tau + 0.05)));
    Buf x(static_cast<size_t>(len));
    Bq clickBp(BqType::BP, 3200, 0.7, fs);
    Bq noiseLp(BqType::LP, 5000, 0.7, fs);
    const double k = 1.2 + 4 * tw.drive;
    const double amt = 2.1 * tw.attack;
    const double sw = sweepDepth(tw.sweep);
    double ph = 0;
    for (long i = 0; i < len; ++i) {
        const double t = i / fs;
        const double f = f0 * (1 + 3.6 * sw * std::exp(-t / 0.0042) + 0.5 * sw * std::exp(-t / 0.028));
        ph += f / fs;
        const double osc = 0.88 * std::sin(TAU * ph) + 0.12 * tri(ph + 0.25);
        const double amp = (1 - std::exp(-t / 0.0004)) * std::exp(-t / tau);
        const double click = amt * (0.95 * trigClick(clickBp, t) + 0.3 * noiseLp.run(r() * 2 - 1) * std::exp(-t / 0.003));
        x[i] = sat(osc * amp + click, k);
    }
    fadeOut(x, fs, std::min(0.05, len / fs / 4));
    FBuf y = decimate(x);
    dcBlock(y, sr, 18);
    return monoShot(std::move(y));
}

Shot bd808(double sr, double ts, Rng& r, const ShotTweak& tw) {
    const double fs = sr * OS;
    const double f0 = kickHz(KitModel::K808, tw.tune);
    const double tau = kickDecayS(KitModel::K808, tw.decay) * ts;
    const long len = jsRoundL(fs * std::max(0.3, std::min(3.0, 5.5 * tau + 0.05)));
    Buf x(static_cast<size_t>(len));
    Bq clickBp(BqType::BP, 1100, 0.9, fs);
    const double k = 0.6 + 3 * tw.drive;
    const double amt = 0.75 * tw.attack;
    const double sw = sweepDepth(tw.sweep);
    double ph = 0;
    for (long i = 0; i < len; ++i) {
        const double t = i / fs;
        ph += (f0 * (1 + 0.34 * sw * std::exp(-t / 0.009))) / fs;
        const double amp = (1 - std::exp(-t / 0.0004)) * std::exp(-t / tau);
        const double sWave = std::sin(TAU * ph);
        const double warm = 0.93 * sWave + 0.07 * std::sin(2 * TAU * ph);
        x[i] = sat(warm * amp + amt * trigClick(clickBp, t) + 0.05 * amt * (r() * 2 - 1) * std::exp(-t / 0.001), k);
    }
    fadeOut(x, fs, std::min(0.08, len / fs / 4));
    FBuf y = decimate(x);
    dcBlock(y, sr, 16);
    return monoShot(std::move(y));
}

Shot sd909(double sr, double ts, Rng& r, const ShotTweak& tw) {
    const double fs = sr * OS;
    const double ft = sdTuneFactor(tw.sdTune);
    const double fc = sdToneFactor(tw.sdTone);
    const double td = ts * sdDecayFactor(tw.sdDecay);
    const long len = jsRoundL(fs * std::max(0.15, 0.36 * td));
    Buf x(static_cast<size_t>(len));
    Bq lp(BqType::LP, 7000 * fc, 0.7, fs);
    Bq hp(BqType::HP, 600 * fc, 0.7, fs);
    const double snap = 0.35 + 3.6 * tw.snappy * 0.5;
    double p1 = 0, p2 = 0;
    for (long i = 0; i < len; ++i) {
        const double t = i / fs;
        p1 += (180 * ft * (1 + 0.65 * std::exp(-t / 0.007))) / fs;
        p2 += (335 * ft * (1 + 0.32 * std::exp(-t / 0.005))) / fs;
        const double tone = std::sin(TAU * p1) * std::exp(-t / (0.058 * td)) + 0.62 * std::sin(TAU * p2) * std::exp(-t / (0.038 * td));
        const double nEnv = (1 - std::exp(-t / 0.0004)) * std::exp(-t / (0.11 * td));
        x[i] = sat(0.92 * tone + snap * hp.run(lp.run(r() * 2 - 1)) * nEnv, 1.4);
    }
    fadeOut(x, fs, 0.03);
    FBuf y = decimate(x);
    dcBlock(y, sr, 50);
    return monoShot(std::move(y));
}

Shot sd808(double sr, double ts, Rng& r, const ShotTweak& tw) {
    const double fs = sr * OS;
    const double ft = sdTuneFactor(tw.sdTune);
    const double fc = sdToneFactor(tw.sdTone);
    const double td = ts * sdDecayFactor(tw.sdDecay);
    const long len = jsRoundL(fs * std::max(0.12, 0.3 * td));
    Buf x(static_cast<size_t>(len));
    Bq hp(BqType::HP, 1800 * fc, 0.7, fs);
    const double snap = 0.2 + 2.8 * tw.snappy * 0.5;
    double p1 = 0, p2 = 0;
    for (long i = 0; i < len; ++i) {
        const double t = i / fs;
        p1 += (238 * ft * (1 + 0.08 * std::exp(-t / 0.004))) / fs;
        p2 += (476 * ft) / fs;
        const double tone = std::sin(TAU * p1) * std::exp(-t / (0.05 * td)) + 0.65 * std::sin(TAU * p2) * std::exp(-t / (0.035 * td));
        const double nEnv = (1 - std::exp(-t / 0.0005)) * std::exp(-t / (0.1 * td));
        x[i] = sat(0.85 * tone + snap * hp.run(r() * 2 - 1) * nEnv, 1.2);
    }
    fadeOut(x, fs, 0.03);
    FBuf y = decimate(x);
    dcBlock(y, sr, 60);
    return monoShot(std::move(y));
}

int hatKind(ShotId id) { return id == ShotId::CH ? 0 : id == ShotId::CHopen ? 1 : 2; }

Shot hat909(double sr, double ts, Rng& r, ShotId id, const ShotTweak& tw) {
    const double fs = sr * OS;
    const int kind = hatKind(id);
    const double td = ts * sdDecayFactor(tw.sdDecay);
    const double ft = sdTuneFactor(tw.sdTune);
    const double fc = std::max(0.6, std::min(1.35, sdToneFactor(tw.sdTone)));
    const double ds[3] = {0.035, 0.12, 0.32};
    const double d = ds[kind] * td * (0.95 + 0.1 * r());
    const long len = jsRoundL(fs * std::max(0.05, std::min(1.5, 5 * d + 0.02)));
    Buf x(static_cast<size_t>(len));
    double ph[6];
    for (double& p : ph) p = r();
    Bq bp(BqType::BP, 11000 * fc, 0.8, fs);
    Bq hp1(BqType::HP, 8000 * fc, 0.7, fs);
    Bq hp2(BqType::HP, 8000 * fc, 0.7, fs);
    Bq nhp(BqType::HP, 9000 * fc, 0.7, fs);
    Bq top(BqType::LP, 15000, 0.7, fs);
    for (long i = 0; i < len; ++i) {
        const double t = i / fs;
        double m = 0;
        for (int k = 0; k < 6; ++k) m += sq(ph[k] + METAL_HZ[k] * 1.47 * ft * t);
        m /= 6;
        const double env = (1 - std::exp(-t / 0.0002)) * std::exp(-t / d);
        const double v = (0.8 * hp2.run(hp1.run(bp.run(m))) + 0.7 * nhp.run(r() * 2 - 1)) * env;
        x[i] = top.run(jsRound(v * 64) / 64);
    }
    fadeOut(x, fs, std::min(0.03, len / fs / 3));
    return monoShot(decimate(x));
}

Shot hat808(double sr, double ts, Rng& r, ShotId id, const ShotTweak& tw) {
    const double fs = sr * OS;
    const int kind = hatKind(id);
    const double td = ts * sdDecayFactor(tw.sdDecay);
    const double ft = sdTuneFactor(tw.sdTune);
    const double fc = std::max(0.6, std::min(1.35, sdToneFactor(tw.sdTone)));
    const double ds[3] = {0.045, 0.18, 0.4};
    const double d = ds[kind] * td * (0.95 + 0.1 * r());
    const long len = jsRoundL(fs * std::max(0.05, std::min(1.8, 5 * d + 0.02)));
    Buf x(static_cast<size_t>(len));
    double ph[6];
    for (double& p : ph) p = r();
    Bq bp1(BqType::BP, 3440 * fc, 3, fs);
    Bq bp2(BqType::BP, 7100 * fc, 3, fs);
    Bq hp1(BqType::HP, 6600 * fc, 0.7, fs);
    Bq hp2(BqType::HP, 6600 * fc, 0.7, fs);
    for (long i = 0; i < len; ++i) {
        const double t = i / fs;
        double m = 0;
        for (int k = 0; k < 6; ++k) m += sq(ph[k] + METAL_HZ[k] * ft * t);
        m /= 6;
        const double env = (1 - std::exp(-t / 0.0002)) * std::exp(-t / d);
        // ordre d'evaluation de JS : bp1, bp2, puis le generateur
        const double a = bp1.run(m);
        const double b = bp2.run(m);
        const double n = r() * 2 - 1;
        x[i] = hp2.run(hp1.run(a + 1.2 * b + 0.05 * n)) * env * 2.2;
    }
    fadeOut(x, fs, std::min(0.03, len / fs / 3));
    return monoShot(decimate(x));
}

Shot cpModel(double sr, double ts, Rng& r, bool is909, bool gate, const ShotTweak& tw) {
    const double fs = sr * OS;
    const double td = ts * sdDecayFactor(tw.sdDecay);
    const double fc = std::max(0.5, std::min(1.6, sdToneFactor(tw.sdTone)));
    const int n = is909 ? 3 : 4;
    const double gap = is909 ? 0.008 : 0.011;
    double offs[4];
    for (int k = 0; k < n; ++k) offs[k] = k == 0 ? 0 : k * gap + (r() - 0.5) * 0.0015;
    const double tailT = offs[n - 1];
    const double tailTau = (is909 ? 0.11 : 0.18) * td;
    const long len = jsRoundL(fs * (tailT + std::max(0.12, 5 * tailTau)));
    Bq bp(BqType::BP, (is909 ? 1150 : 1000) * fc, is909 ? 2.2 : 1.8, fs);
    Bq hp(BqType::HP, (is909 ? 700 : 500) * fc, 0.7, fs);
    Buf x(static_cast<size_t>(len));
    for (long i = 0; i < len; ++i) {
        const double t = i / fs;
        double e = 0;
        for (int k = 0; k < n; ++k) {
            const double u = t - offs[k];
            if (u < 0) continue;
            const double a = 1 - std::exp(-u / 0.0003);
            e += k < n - 1 ? a * std::exp(-u / 0.004) : a * std::exp(-u / tailTau);
        }
        x[i] = sat(hp.run(bp.run(r() * 2 - 1)) * e * 2.2, 1.3);
    }
    fadeOut(x, fs, 0.03);
    FBuf dry = decimate(x);
    if (!is909 || !gate) return monoShot(std::move(dry));
    const long dn = static_cast<long>(dry.size());
    const long total = dn + jsRoundL(0.1 * sr);
    FBuf wl, wr;
    fdn(dry, sr, total, 0.35, 6500, 3, 0.5, wl, wr);
    FBuf L(static_cast<size_t>(total)), R(static_cast<size_t>(total));
    for (long i = 0; i < total; ++i) {
        const double fade = i > total - 0.06 * sr ? 0.5 + 0.5 * std::cos((PI * (i - (total - 0.06 * sr))) / (0.06 * sr)) : 1;
        const double d = i < dn ? dry[i] : 0.0;
        L[i] = static_cast<float>(d + 0.12 * wl[i] * fade);
        R[i] = static_cast<float>(d + 0.12 * wr[i] * fade);
    }
    return stereoShot(std::move(L), std::move(R));
}

Shot tomModel(double sr, double ts, Rng& r, bool is909, bool high, const ShotTweak& tw) {
    const double fs = sr * OS;
    const double ft = sdTuneFactor(tw.sdTune);
    const double td = ts * sdDecayFactor(tw.sdDecay);
    const double sw = sweepDepth(tw.sweep);
    const double fc = std::max(0.5, std::min(1.6, sdToneFactor(tw.sdTone)));
    const double to = (is909 ? (high ? 175 : 105) : high ? 160 : 90) * ft;
    const double from = to * (1 + ((is909 ? 1.5 : 1.2) - 1) * sw);
    const double tau = (is909 ? (high ? 0.17 : 0.22) : high ? 0.25 : 0.35) * td;
    const long len = jsRoundL(fs * std::max(0.12, std::min(2.0, 5 * tau)));
    Buf x(static_cast<size_t>(len));
    Bq bp(BqType::BP, 1500 * fc, 0.9, fs);
    double ph = 0;
    for (long i = 0; i < len; ++i) {
        const double t = i / fs;
        ph += (to + (from - to) * std::exp(-t / (is909 ? 0.05 : 0.02))) / fs;
        const double osc = is909 ? 0.85 * std::sin(TAU * ph) + 0.15 * tri(ph + 0.25) : std::sin(TAU * ph);
        const double a = (1 - std::exp(-t / 0.0004)) * std::exp(-t / tau);
        const double noise = (is909 ? 0.35 : 0.08) * bp.run(r() * 2 - 1) * std::exp(-t / (is909 ? 0.02 : 0.004));
        x[i] = sat(osc * a + noise, is909 ? 1.6 : 1.1);
    }
    fadeOut(x, fs, 0.03);
    FBuf y = decimate(x);
    dcBlock(y, sr, 30);
    return monoShot(std::move(y));
}

Shot stretched(Shot s, double stretch, double sr) {
    if (std::fabs(stretch - 1) > 1e-3) {
        if (s.mono) s.L = timeStretch(s.L, stretch, sr);
        else {
            s.L = timeStretch(s.L, stretch, sr);
            s.R = timeStretch(s.R, stretch, sr);
        }
    }
    return s;
}

uint32_t seedOf(ShotId id, int variant) {
    const std::string name = shotName(id);
    const uint64_t c0 = static_cast<unsigned char>(name[0]);
    const uint64_t c1 = static_cast<unsigned char>(name[1]);
    const uint64_t sum = c0 * 7919ull + c1 * 104729ull + name.size() * 131ull + static_cast<uint64_t>(variant) * 2654435761ull;
    return 0x9e3779b1u ^ static_cast<uint32_t>(sum & 0xffffffffull);
}

/* ---------------- les echantillons (sampledsp.ts) ---------------- */

constexpr double SAMPLE_MAX_OUT_S = 16;
constexpr double SAMPLE_CAP_FADE_S = 0.25;
constexpr double SAMPLE_START_MAX = 0.9;

double sampleLenPart(double len) { return len >= 1 ? 1 : 0.12 + 0.88 * std::max(0.0, len); }
double sampleLenFadeS(double keptS) { return std::min(keptS * 0.5, std::max(0.006, std::min(0.025, keptS * 0.12))); }

double hermite(const FBuf& x, double pos) {
    const double fi = std::floor(pos);
    const long i = static_cast<long>(fi);
    const double f = pos - fi;
    const long n = static_cast<long>(x.size());
    const double xm1 = i - 1 >= 0 && i - 1 < n ? x[i - 1] : 0.0;
    const double x0 = i >= 0 && i < n ? x[i] : 0.0;
    const double x1 = i + 1 >= 0 && i + 1 < n ? x[i + 1] : 0.0;
    const double x2 = i + 2 >= 0 && i + 2 < n ? x[i + 2] : 0.0;
    const double c1 = 0.5 * (x1 - xm1);
    const double c2 = xm1 - 2.5 * x0 + 2 * x1 - 0.5 * x2;
    const double c3 = 0.5 * (x2 - xm1) + 1.5 * (x0 - x1);
    return ((c3 * f + c2) * f + c1) * f + x0;
}

FBuf readChannel(const FBuf& x, double srIn, double srOut, double ratio, long nOut, long off) {
    FBuf out(static_cast<size_t>(nOut));
    const double step = (ratio * srIn) / srOut;
    for (long i = 0; i < nOut; ++i) out[i] = static_cast<float>(hermite(x, off + i * step));
    return out;
}

struct SampleTweak {
    std::string family;
    double attack, drive, snappy, st, start, len;
    bool rev;
    double maxS; // <= 0 : sans limite
};

Shot playSample(const SamplePcm& p, double srOut, const SampleTweak& tw) {
    const bool kick = tw.family == "bd";
    const bool snare = tw.family == "sd";
    const double ratio = tw.st == 0 ? 1 : std::pow(2.0, tw.st / 12);
    std::vector<FBuf> chans;
    chans.push_back(p.L);
    if (!p.R.empty()) chans.push_back(p.R);
    if (tw.rev) for (auto& c : chans) std::reverse(c.begin(), c.end());
    const long pl = static_cast<long>(p.L.size());
    const long off = tw.start > 0 ? jsRoundL(std::min(1.0, tw.start) * SAMPLE_START_MAX * pl) : 0;
    const double durIn = (pl - off) / p.sr;
    long nOut = std::max(1L, static_cast<long>(std::ceil((durIn / ratio) * srOut)));
    const double part = sampleLenPart(tw.len);
    long end = std::max(1L, jsRoundL(nOut * part));
    nOut = std::min(nOut, end + 1);
    const long cap = tw.maxS > 0 ? std::max(2L, jsRoundL(tw.maxS * srOut)) : 0;
    const bool capped = cap > 0 && nOut > cap;
    if (capped) {
        nOut = cap;
        end = cap - 1;
    }
    std::vector<FBuf> outs;
    for (auto& c : chans) outs.push_back(readChannel(c, p.sr, srOut, ratio, nOut, off));
    const long fade0 = capped ? end - std::max(1L, jsRoundL(std::min(SAMPLE_CAP_FADE_S, (0.25 * end) / srOut) * srOut))
                       : part < 1 ? end - std::max(1L, jsRoundL(sampleLenFadeS(end / srOut) * srOut))
                                  : nOut;
    const double a = kick ? tw.attack - 0.5 : 0;
    const double boost = a > 0 ? 2 * a : 0;
    const long riseN = a < 0 ? jsRoundL(-a * 2 * 0.006 * srOut) : 0;
    const double tauN = 0.004 * srOut;
    const double amt = kick ? std::max(0.0, tw.drive - 0.25) / 0.75 : 0;
    const double k = 1 + 8 * amt;
    const double norm = amt > 0 ? 1 / std::tanh(k) : 1;
    const double s = snare ? tw.snappy - 0.5 : 0;
    const double tilt = s > 0 ? 2 * s : 1.6 * s;
    const double lpA = std::exp((-2 * PI * 2000) / srOut);
    double peak = 0;
    for (auto& y : outs)
        for (float v : y) {
            const double av = std::fabs(static_cast<double>(v));
            if (av > peak && av < std::numeric_limits<double>::infinity()) peak = av;
        }
    const double inv = peak > 0 ? 1 / peak : 1;
    for (auto& y : outs) {
        double lp = 0;
        const long yn = static_cast<long>(y.size());
        for (long i = 0; i < yn; ++i) {
            double v = y[i];
            if (tilt != 0) {
                lp = lp * lpA + v * (1 - lpA);
                v += tilt * (v - lp);
            }
            if (boost > 0) v *= 1 + boost * std::exp(-i / tauN);
            if (riseN > 0 && i < riseN) v *= static_cast<double>(i) / riseN;
            if (amt > 0) v = (std::tanh(k * v * inv) * norm) / inv;
            if (i >= fade0) {
                const double t = std::min(1.0, static_cast<double>(i - fade0) / std::max(1L, end - fade0));
                v *= 0.5 + 0.5 * std::cos(PI * t);
            }
            y[i] = static_cast<float>(v);
        }
    }
    if (outs.size() > 1) return stereoShot(std::move(outs[0]), std::move(outs[1]));
    return monoShot(std::move(outs[0]));
}

std::string familyOfShot(ShotId id) {
    switch (id) {
        case ShotId::BD: return "bd";
        case ShotId::SD: return "sd";
        case ShotId::CH: case ShotId::CHopen: return "ch";
        case ShotId::OH: return "oh";
        case ShotId::CP: return "cp";
        case ShotId::TOM: return "tom";
        case ShotId::HT: return "ht";
        case ShotId::CY: return "cy";
    }
    return "bd";
}

bool atRest(const SampleLayer& l) { return l.st == 0 && l.start <= 0 && l.len >= 1 && !l.rev; }

Shot sampleBody(const SamplePcm& pcm, double sr, double stretch, const std::string& family, ShotId cal, const ShotTweak& tw, const SampleLayer& l) {
    const double maxS = SAMPLE_MAX_OUT_S / std::max(1e-3, stretch);
    Shot s = playSample(pcm, sr, SampleTweak{family, tw.attack, tw.drive, tw.snappy, l.st, l.start, l.len, l.rev, maxS});
    if (family == "sd" && tw.gate) s = gatedVerb(s.L, s.mono ? nullptr : &s.R, sr, 1);
    if (cal == ShotId::BD && !s.mono) {
        FBuf m(s.L.size());
        for (size_t i = 0; i < m.size(); ++i) m[i] = static_cast<float>(0.5 * (static_cast<double>(s.L[i]) + s.R[i]));
        s = monoShot(std::move(m));
    }
    return stretched(std::move(s), stretch, sr);
}

double layerGain(double v) {
    const double c = clampd(v, 0, 1);
    return c * c;
}

constexpr double LAYER_HEADROOM_DB = 2;

double layerCap(ShotId id) {
    const double up = shotCeiling(id) * std::pow(10.0, LAYER_HEADROOM_DB / 20.0);
    return id == ShotId::BD ? up : std::min(up, std::pow(10.0, (SHOT_KICK_PEAK - shotBelow(ShotId::BD) - 0.5) / 20.0));
}

Shot scaled(const Shot& s, double g) {
    Shot o = s;
    for (auto& v : o.L) v = static_cast<float>(v * g);
    if (!o.mono) for (auto& v : o.R) v = static_cast<float>(v * g);
    return o;
}

Shot silent() { return monoShot(FBuf(480, 0.f)); }

} // namespace

/* ---------------- l'API ---------------- */

const char* shotName(ShotId id) {
    switch (id) {
        case ShotId::BD: return "BD";
        case ShotId::SD: return "SD";
        case ShotId::CH: return "CH";
        case ShotId::CHopen: return "CHopen";
        case ShotId::OH: return "OH";
        case ShotId::CP: return "CP";
        case ShotId::TOM: return "TOM";
        case ShotId::HT: return "HT";
        case ShotId::CY: return "CY";
    }
    return "BD";
}

bool shotFromName(const std::string& s, ShotId& out) {
    for (int i = 0; i < kNumShotIds; ++i) {
        const auto id = static_cast<ShotId>(i);
        if (s == shotName(id)) {
            out = id;
            return true;
        }
    }
    return false;
}

int variantsOf(ShotId id) {
    switch (id) {
        case ShotId::BD: return 1;
        case ShotId::SD: return 3;
        case ShotId::TOM: return 1;
        case ShotId::CH: return 4;
        case ShotId::CHopen: return 2;
        case ShotId::OH: return 3;
        case ShotId::CP: return 3;
        case ShotId::HT: return 1;
        case ShotId::CY: return 2;
    }
    return 1;
}

double shotLoudness(const Shot& s, double sr) {
    const FBuf kl = kWeight(s.L, sr);
    const FBuf kr = s.mono ? kl : kWeight(s.R, sr);
    const long n = static_cast<long>(kl.size());
    const long w = std::max(1L, jsRoundL(LOUD_WIN_S * sr));
    double acc = 0, best = 0;
    for (long i = 0; i < n + w; ++i) {
        if (i < n) acc += (static_cast<double>(kl[i]) * kl[i] + static_cast<double>(kr[i]) * kr[i]) / 2;
        if (i >= w && i - w < n) acc -= (static_cast<double>(kl[i - w]) * kl[i - w] + static_cast<double>(kr[i - w]) * kr[i - w]) / 2;
        if (acc / w > best) best = acc / w;
    }
    return 10 * std::log10(best + 1e-12) + 2.32;
}

std::vector<float> timeStretch(const std::vector<float>& x, double f, double sr) {
    if (!(f > 0) || std::fabs(f - 1) < 1e-3 || x.empty()) return x;
    const long n = std::max(64L, jsRoundL(0.04 * sr));
    const long hs = n >> 2;
    const double ha = hs / f;
    const long xn = static_cast<long>(x.size());
    const long outLen = std::max(1L, jsRoundL(xn * f));
    std::vector<float> y(static_cast<size_t>(outLen), 0.f), ws(static_cast<size_t>(outLen), 0.f);
    std::vector<float> w(static_cast<size_t>(n));
    for (long i = 0; i < n; ++i) w[i] = static_cast<float>(0.5 - 0.5 * std::cos((2 * PI * (i + 0.5)) / n));
    for (long k = -3;; ++k) {
        const long os = k * hs;
        if (os >= outLen) break;
        const long is = jsRoundL(k * ha);
        for (long i = 0; i < n; ++i) {
            const long o = os + i;
            if (o < 0) continue;
            if (o >= outLen) break;
            const long j = is + i;
            if (j < 0 || j >= xn) continue;
            y[o] = static_cast<float>(y[o] + static_cast<double>(w[i]) * x[j]);
            ws[o] = static_cast<float>(ws[o] + static_cast<double>(w[i]));
        }
    }
    for (long i = 0; i < outLen; ++i)
        if (ws[i] > 1e-3) y[i] = static_cast<float>(static_cast<double>(y[i]) / ws[i]);
    const long keep = std::min({outLen, xn, jsRoundL(0.006 * sr)});
    const long fade = std::min({outLen - keep, xn - keep, jsRoundL(0.006 * sr)});
    for (long i = 0; i < keep; ++i) y[i] = x[i];
    for (long i = 0; i < fade; ++i) {
        const double a = static_cast<double>(i + 1) / (fade + 1);
        y[keep + i] = static_cast<float>(x[keep + i] * (1 - a) + y[keep + i] * a);
    }
    const long tail = std::min(outLen, jsRoundL(0.002 * sr));
    for (long i = 0; i < tail; ++i) y[outLen - 1 - i] = static_cast<float>(y[outLen - 1 - i] * (static_cast<double>(i) / tail));
    return y;
}

Shot renderShot(ShotId id, double sr, double stretch, int variant, const ShotTweak& tw) {
    const double ts = 1;
    Rng r(seedOf(id, variant));
    const KitModel m = tw.model;
    Shot s;
    switch (id) {
        case ShotId::BD:
            s = m == KitModel::K909 ? bd909(sr, ts, r, tw) : m == KitModel::K808 ? bd808(sr, ts, r, tw) : bd(sr, ts, r, tw);
            break;
        case ShotId::SD:
            s = m == KitModel::K909 ? sd909(sr, ts, r, tw) : m == KitModel::K808 ? sd808(sr, ts, r, tw) : sd(sr, ts, r, tw);
            break;
        case ShotId::TOM:
            s = m == KitModel::MM ? tom(sr, ts, r, 98, 168, 0.17, tw) : tomModel(sr, ts, r, m == KitModel::K909, false, tw);
            break;
        case ShotId::HT:
            s = m == KitModel::MM ? tom(sr, ts, r, 165, 260, 0.13, tw) : tomModel(sr, ts, r, m == KitModel::K909, true, tw);
            break;
        case ShotId::CH: {
            const double tail[2] = {0.08, 0.05};
            s = m == KitModel::K909 ? hat909(sr, ts, r, id, tw) : m == KitModel::K808 ? hat808(sr, ts, r, id, tw) : hat(sr, ts, r, 0.016, tail, 0.09, 9500, tw);
            break;
        }
        case ShotId::CHopen: {
            const double tail[2] = {0.25, 0.16};
            s = m == KitModel::K909 ? hat909(sr, ts, r, id, tw) : m == KitModel::K808 ? hat808(sr, ts, r, id, tw) : hat(sr, ts, r, 0.06, tail, 0.32, 9200, tw);
            break;
        }
        case ShotId::OH:
            s = m == KitModel::K909 ? hat909(sr, ts, r, id, tw) : m == KitModel::K808 ? hat808(sr, ts, r, id, tw) : openHat(sr, ts, r, tw);
            break;
        case ShotId::CP:
            s = m == KitModel::MM ? cp(sr, ts, r, tw.gate, tw) : cpModel(sr, ts, r, m == KitModel::K909, tw.gate, tw);
            break;
        case ShotId::CY:
            s = cy(sr, ts, r, tw);
            break;
    }
    s = stretched(std::move(s), stretch, sr);
    setLoudness(id, s, sr, loudOf(id, &m));
    return s;
}

Shot renderSampleShot(ShotId id, double sr, double stretch, const SamplePcm& pcm, const ShotTweak& tw) {
    const SampleLayer& l = tw.smp;
    const std::string family = familyOfShot(id);
    const ShotId cal = id;
    Shot s = sampleBody(pcm, sr, stretch, family, cal, tw, l);
    if (atRest(l)) {
        setLoudness(cal, s, sr, loudOf(cal, nullptr));
        return s;
    }
    const double p = peakOf(s);
    const double k = loudGain(cal, sampleBody(pcm, sr, stretch, family, cal, tw, SampleLayer{}), sr, loudOf(cal, nullptr));
    applyGain(s, p > 0 ? std::min(k, shotCeiling(cal) / p) : k);
    return s;
}

Shot renderLayers(ShotId id, double sr, double stretch, int variant, const ShotTweak& tw, const SamplePcm* pcm) {
    const double syn = tw.syn;
    const double lev = tw.smp.lev;
    const bool withSample = tw.hasSample && pcm && !pcm->L.empty() && lev > 0;
    if (!withSample) {
        if (syn <= 0) return silent();
        Shot a = renderShot(id, sr, stretch, variant, tw);
        return syn >= 1 ? a : scaled(a, layerGain(syn));
    }
    Shot b = renderSampleShot(id, sr, stretch, *pcm, tw);
    if (syn <= 0) return lev >= 1 ? b : scaled(b, layerGain(lev));
    Shot a = renderShot(id, sr, stretch, variant, tw);
    const double ga = layerGain(syn);
    const double gb = layerGain(lev);
    const size_t n = std::max(a.L.size(), b.L.size());
    const bool mono = a.mono && b.mono;
    auto mix = [&](const FBuf& x, const FBuf& y) {
        FBuf out(n, 0.f);
        for (size_t i = 0; i < x.size(); ++i) out[i] = static_cast<float>(ga * x[i]);
        for (size_t i = 0; i < y.size(); ++i) out[i] = static_cast<float>(out[i] + gb * y[i]);
        return out;
    };
    Shot sum;
    sum.L = mix(a.L, b.L);
    sum.mono = mono;
    if (!mono) sum.R = mix(a.right(), b.right());
    const double target = std::max(shotLoudness(a, sr) + 20 * std::log10(ga), shotLoudness(b, sr) + 20 * std::log10(gb));
    const double p = peakOf(sum);
    double k = std::pow(10.0, (target - shotLoudness(sum, sr)) / 20.0);
    const double cap = layerCap(id);
    if (p > 0) k = std::min(k, cap / p);
    if (std::isfinite(k) && k > 0 && k != 1) applyGain(sum, k);
    return sum;
}

/* ---------------- WAV ---------------- */

bool decodeWav(const void* data, size_t size, SamplePcm& out) {
    const auto* b = static_cast<const uint8_t*>(data);
    auto u16 = [&](size_t o) { return static_cast<uint32_t>(b[o] | (b[o + 1] << 8)); };
    auto u32 = [&](size_t o) { return static_cast<uint32_t>(b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (static_cast<uint32_t>(b[o + 3]) << 24)); };
    if (size < 12 || std::memcmp(b, "RIFF", 4) != 0 || std::memcmp(b + 8, "WAVE", 4) != 0) return false;
    size_t pos = 12;
    uint32_t fmt = 0, ch = 0, rate = 0, bits = 0;
    const uint8_t* pcm = nullptr;
    size_t pcmLen = 0;
    while (pos + 8 <= size) {
        const uint32_t len = u32(pos + 4);
        const uint8_t* body = b + pos + 8;
        const size_t avail = std::min<size_t>(len, size - pos - 8);
        if (std::memcmp(b + pos, "fmt ", 4) == 0 && avail >= 16) {
            fmt = u16(pos + 8);
            ch = u16(pos + 10);
            rate = u32(pos + 12);
            bits = u16(pos + 22);
            if (fmt == 0xFFFE && avail >= 26) fmt = u16(pos + 32); // WAVE_FORMAT_EXTENSIBLE : le sous-format
        } else if (std::memcmp(b + pos, "data", 4) == 0) {
            pcm = body;
            pcmLen = avail;
        }
        pos += 8 + len + (len & 1);
    }
    if (!pcm || ch < 1 || rate == 0) return false;
    const uint32_t bytes = bits / 8;
    if (!((fmt == 1 && (bits == 16 || bits == 24 || bits == 32)) || (fmt == 3 && bits == 32))) return false;
    const size_t frames = pcmLen / (bytes * ch);
    out.sr = rate;
    out.L.assign(frames, 0.f);
    if (ch >= 2) out.R.assign(frames, 0.f);
    else out.R.clear();
    for (size_t i = 0; i < frames; ++i) {
        for (uint32_t c = 0; c < std::min<uint32_t>(ch, 2); ++c) {
            const uint8_t* s = pcm + (i * ch + c) * bytes;
            float v = 0;
            if (fmt == 3) {
                std::memcpy(&v, s, 4);
            } else if (bits == 16) {
                v = static_cast<int16_t>(s[0] | (s[1] << 8)) / 32768.f;
            } else if (bits == 24) {
                int32_t x = s[0] | (s[1] << 8) | (s[2] << 16);
                if (x & 0x800000) x |= ~0xFFFFFF;
                v = x / 8388608.f;
            } else {
                int32_t x;
                std::memcpy(&x, s, 4);
                v = static_cast<float>(x / 2147483648.0);
            }
            (c == 0 ? out.L : out.R)[i] = v;
        }
    }
    return true;
}

} // namespace mm
