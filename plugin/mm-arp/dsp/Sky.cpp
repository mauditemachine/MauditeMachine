// MM-ARP, la reverbe facon BigSky : voir Sky.h. Port de sky.worklet.js et de skyEngine (sky.ts) de la reference.
#include "Sky.h"

#include <algorithm>
#include <cmath>
#include <cstring>

namespace mmarp {

namespace {
constexpr int N = 8;
constexpr double PI = 3.14159265358979323846;
constexpr double TWO_PI = 6.283185307179586;
/** Les longueurs de base des lignes du reseau (echantillons a 48 kHz, premiers entre eux, 23 a 47 ms). */
constexpr int BASE[N] = {1129, 1291, 1453, 1601, 1777, 1913, 2083, 2267};
/** Les passe-tout dans la boucle, un par ligne. */
constexpr int AP_IN[N] = {139, 173, 211, 251, 293, 331, 379, 419};
constexpr double OUT_L[N] = {1, -1, 1, -1, 1, -1, 1, -1};
constexpr double OUT_R[N] = {1, 1, -1, -1, 1, 1, -1, -1};
constexpr double INJ[N] = {1, 1, -1, 1, -1, -1, 1, -1};
constexpr int DIFF_L[4] = {229, 173, 611, 447};
constexpr int DIFF_R[4] = {241, 163, 593, 461};
constexpr double MAX_SCALE = 3.2;
constexpr int FADE_N = 960;
constexpr double IDLE_S = 1;
constexpr int NL_TAPS = 32;
constexpr double RISE_TIMES[23] = {0.08, 0.1, 0.12, 0.14, 0.17, 0.2, 0.25, 0.3, 0.35, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9, 1, 1.2, 1.4, 1.7, 2, 2.5, 3, 4};
constexpr double SHIFT_SEMIS[11] = {-12, -7, -5, 0.12, 4, 5, 7, 9, 12, 19, 24};
constexpr double DECAY_RANGE[kSkyMachines][2] = {{0.2, 10}, {0.5, 20}, {0.5, 20}, {0.5, 8}, {0.5, 20}, {1, 50}, {1, 50}, {0.5, 20}, {0.5, 20}, {0.2, 8}, {0.1, 1.5}, {100, 1000}};
/** Les voyelles de CHORALE : F1 F2 F3 (Hz) et leurs niveaux (a, o, u). */
constexpr double VOWELS[3][6] = {{730, 1090, 2440, 1, 0.55, 0.3}, {570, 840, 2410, 1, 0.45, 0.22}, {300, 870, 2240, 1, 0.3, 0.14}};
/** VOWEL : les paires (a 0, o 1, u 2) ; -1 : RANDOM. */
constexpr int VOWEL_SETS[7][2] = {{0, 2}, {0, 0}, {0, 1}, {1, 1}, {2, 1}, {2, 2}, {-1, -1}};
constexpr double UNEVEN[6] = {0.23, 0.41, 0.58, 0.72, 0.87, 1};

inline double clampN(double v, double lo, double hi, double d) { return std::isfinite(v) ? (v < lo ? lo : v > hi ? hi : v) : d; }
inline double flush(double x) { return (x < 1e-20 && x > -1e-20) ? 0.0 : x; }
inline int pow2(int n) {
    int s = 16;
    while (s < n) s <<= 1;
    return s;
}
inline int stepOf(double v, int n) {
    const int i = static_cast<int>(std::lround(clampN(v, 0, 1, 0) * (n - 1)));
    return i < 0 ? 0 : i > n - 1 ? n - 1 : i;
}
inline double expo(double lo, double hi, double v) { return lo * std::pow(hi / lo, v); }

/** SHAPE de NONLINEAR (t de 0 a 1 sur TIME) : SWOOSH, REVERSE, RAMP, GATE, GAUSS, BOUNCE. */
double nlShape(int s, double t) {
    switch (s) {
        case 0:
            return std::pow(std::sin(PI * std::min(1.0, t * 1.08)), 0.6) * (0.3 + 0.7 * t);
        case 1:
            return t * t;
        case 2:
            return 0.15 + 0.85 * t;
        case 4:
            return std::exp(-std::pow((t - 0.42) / 0.2, 2));
        case 5:
            return 0.12 + 0.88 * (1 - std::exp(-std::pow((t - 0.5) / 0.22, 2)));
        default:
            return 1;
    }
}

uint64_t mix(uint64_t h, double v) {
    uint64_t b;
    std::memcpy(&b, &v, sizeof b);
    return (h ^ b) * 0x100000001b3ull + 0x9e3779b97f4a7c15ull;
}
} // namespace

/* ---------------- le modele (sky.ts) ---------------- */

SkyNorm skyDefaults(int m) {
    // DECAY, PRE-DELAY, TONE, MOD, LOW END, puis les reglages de la machine dans l'ordre de la page (sky.ts def)
    static const double D[kSkyMachines][10] = {
        {0.4, 0.06, 0.55, 0.3, 0.5, 0, 0.6, 0, 0, 0},
        {0.43, 0.14, 0.5, 0.35, 0.5, 0.5, 0, 0, 0, 0},
        {0.45, 0.08, 0.65, 0.3, 0.45, 1, 0, 0, 0, 0},
        {0.45, 0, 0.5, 0.15, 0.4, 1.0 / 3, 0.5, 0, 0, 0},
        {0.55, 0.1, 0.5, 0.4, 0.5, 10.0 / 22, 0, 0, 0, 0},
        {0.5, 0.1, 0.5, 0.4, 0.5, 0.5, 0.5, 0, 0, 0},
        {0.5, 0.15, 0.45, 0.45, 0.5, 0.7, 0, 0, 0, 0},
        {0.5, 0.1, 0.5, 0.4, 0.5, 0, 0.5, 0, 0, 0},
        {0.55, 0.1, 0.55, 0.4, 0.4, 0.8, 0, 0.5, 0.5, 0},
        {0.4, 0.35, 0.45, 0.35, 0.45, 0.5, 0.5, 0, 0.45, 0},
        {0.45, 0, 0.55, 0.2, 0.5, 0.6, 0.6, 0.4, 0.3, 0.3},
        {0.4, 0, 0.5, 0.15, 0.5, 0.5, 0.5, 0, 0, 0},
    };
    const double* d = D[m < 0 || m >= kSkyMachines ? SKY_HALL : m];
    SkyNorm n;
    n.decay = d[0];
    n.pre = d[1];
    n.tone = d[2];
    n.mod = d[3];
    n.lowEnd = d[4];
    for (int i = 0; i < 5; ++i) n.p[static_cast<size_t>(i)] = d[5 + i];
    return n;
}

const double kSkyGain[kSkyMachines] = {1.73, 1.91, 0.73, 2.59, 1.29, 1.01, 1.31, 1.66, 1.07, 2.83, 2.29, 2.41};

double skyDecayOf(int m, double v) {
    const int i = m < 0 || m >= kSkyMachines ? SKY_HALL : m;
    return expo(DECAY_RANGE[i][0], DECAY_RANGE[i][1], clampN(v, 0, 1, 0.5));
}

SkyEngine skyEngine(int machine, const SkyNorm& n) {
    const int m = machine < 0 || machine >= kSkyMachines ? SKY_HALL : machine;
    const double tone = clampN(n.tone, 0, 1, 0.5), low = clampN(n.lowEnd, 0, 1, 0.5), pre = clampN(n.pre, 0, 1, 0);
    const auto P = [&](int i) { return clampN(n.p[static_cast<size_t>(i)], 0, 1, 0); };
    SkyEngine e;
    e.algo = m;
    e.t60 = skyDecayOf(m, n.decay);
    e.pre = pre * pre;
    e.toneHz = tone >= 0.97 ? 22000 : expo(900, 20000, tone);
    e.hiMul = 0.22 + 0.78 * std::pow(tone, 0.8);
    e.hiHz = 2500 + 6000 * tone;
    e.lowCut = expo(320, 18, low);
    e.lowMul = 0.55 + 0.8 * low;
    e.midMul = 1;
    e.mod = clampN(n.mod, 0, 1, 0.3);
    e.modRate = 0.5;
    e.scale = 1;
    e.apG = 0.4;
    e.diffusion = 0.75;
    e.erLevel = 0;
    e.tankLevel = 1;
    e.gain = kSkyGain[m];
    switch (m) {
        case SKY_ROOM: {
            const bool club = stepOf(P(0), 2) == 1;
            e.scale = club ? 0.75 : 0.42;
            e.apG = 0.3;
            e.diffusion = P(1);
            e.modRate = 0.55;
            e.roomW = club ? 13 : 5.5;
            e.roomL = club ? 10 : 4.2;
            e.roomH = club ? 4.5 : 3;
            e.srcX = 0.5;
            e.srcY = 0.62;
            e.lstY = 0.2;
            e.beta = 0.82;
            e.erLevel = 0.8;
            e.tankLevel = 0.85;
            break;
        }
        case SKY_HALL: {
            const bool arena = stepOf(P(1), 2) == 1;
            e.scale = arena ? 2.1 : 1.25;
            e.apG = 0.45;
            e.diffusion = 0.75;
            e.midMul = 0.55 + 0.9 * P(0);
            e.modRate = 0.45;
            e.roomW = arena ? 70 : 32;
            e.roomL = arena ? 55 : 24;
            e.roomH = arena ? 25 : 14;
            e.srcX = 0.5;
            e.srcY = 0.3;
            e.lstY = 0.6;
            e.beta = 0.85;
            e.erLevel = 0.45;
            break;
        }
        case SKY_PLATE:
            e.scale = stepOf(P(0), 2) == 1 ? 0.62 : 0.38;
            e.apG = 0.55;
            e.diffusion = 0.85;
            e.hiMul = 0.35 + 0.75 * std::pow(tone, 0.8);
            e.modRate = 0.8;
            break;
        case SKY_SPRING: {
            static const double drives[4] = {1, 2.5, 5, 11};
            e.drive = drives[stepOf(P(0), 4)];
            e.springs = stepOf(P(1), 3) + 1;
            break;
        }
        case SKY_SWELL:
            e.scale = 1.3;
            e.apG = 0.45;
            e.rise = RISE_TIMES[stepOf(P(0), 23)];
            e.swellDry = stepOf(P(1), 2) == 1;
            break;
        case SKY_BLOOM:
            e.scale = 1.7;
            e.apG = 0.5;
            e.diffusion = 0.8;
            e.bloomLen = 0.03 + 0.32 * P(0);
            e.bloomFb = 0.85 * P(1);
            e.modRate = 0.35;
            break;
        case SKY_CLOUD: {
            const double d = P(0);
            e.scale = 3;
            e.apG = 0.7 * d;
            e.diffusion = d;
            e.modRate = 0.25;
            break;
        }
        case SKY_CHORALE: {
            static const double qs[3] = {4, 8, 15};
            e.scale = 1.4;
            e.apG = 0.45;
            e.vowel = stepOf(P(0), 7);
            e.q = qs[stepOf(P(1), 3)];
            break;
        }
        case SKY_SHIMMER: {
            const int s2 = stepOf(P(1), 12);
            e.scale = 1.45;
            e.apG = 0.5;
            e.diffusion = 0.8;
            e.shift1 = std::pow(2.0, SHIFT_SEMIS[stepOf(P(0), 11)] / 12);
            e.shift2 = s2 == 0 ? 0 : std::pow(2.0, SHIFT_SEMIS[s2 - 1] / 12);
            e.shAmt = P(2);
            e.shMode = stepOf(P(3), 3);
            break;
        }
        case SKY_MAGNETO: {
            static const int hs[3] = {3, 4, 6};
            e.scale = 0.75;
            e.apG = 0.4;
            e.diffusion = P(0);
            e.heads = hs[stepOf(P(1), 3)];
            e.uneven = stepOf(P(2), 2) == 1;
            e.dTime = 0.05 + 1.35 * std::pow(P(3), 1.5);
            e.fb = 0.9 * pre;
            e.pre = 0;
            e.tankLevel = 0.6;
            break;
        }
        case SKY_NONLINEAR:
            e.scale = 1.1;
            e.t60 = expo(0.3, 10, P(2));
            e.nlTime = skyDecayOf(m, n.decay);
            e.nlShape = stepOf(P(0), 6);
            e.diffusion = P(1);
            e.fb = 0.85 * pre;
            e.pre = 0;
            e.lateLevel = P(3);
            e.modRate = expo(0.1, 6, P(4));
            break;
        case SKY_REFLECTIONS: {
            const double sq = skyDecayOf(m, n.decay);
            const double area = sq * 0.0929;
            const int sh = stepOf(P(2), 3);
            const double w = sh == 1 ? std::sqrt(area * 1.618) : sh == 2 ? std::sqrt(area / 1.618) : std::sqrt(area);
            const double size = clampN(n.decay, 0, 1, 0.4);
            e.t60 = 0.25 + 0.6 * size;
            e.scale = 0.3 + 0.25 * size;
            e.apG = 0.5;
            e.diffusion = 0.8;
            e.roomW = w;
            e.roomL = area / w;
            e.roomH = 2.8;
            e.srcX = 0.1 + 0.8 * P(0);
            e.srcY = 0.3 + 0.62 * P(1);
            e.lstY = 0.12;
            e.beta = 0.6 + 0.3 * tone;
            e.erLevel = 1;
            e.tankLevel = 0.3;
            break;
        }
        default:
            break;
    }
    return e;
}

/* ---------------- les pieces ---------------- */

void Sky::Line::alloc(int n) {
    const int size = pow2(n + 8);
    b.assign(static_cast<size_t>(size), 0.f);
    m = size - 1;
    w = 0;
}
void Sky::Line::clear() {
    std::fill(b.begin(), b.end(), 0.f);
}
void Sky::Line::write(double x) {
    b[static_cast<size_t>(w)] = static_cast<float>(flush(x));
    w = (w + 1) & m;
}
double Sky::Line::readF(double d) const {
    const int i = static_cast<int>(d);
    const double f = d - i;
    const double x0 = b[static_cast<size_t>((w - i + 1) & m)], x1 = b[static_cast<size_t>((w - i) & m)], x2 = b[static_cast<size_t>((w - i - 1) & m)],
                 x3 = b[static_cast<size_t>((w - i - 2) & m)];
    const double c1 = 0.5 * (x2 - x0), c2 = x0 - 2.5 * x1 + 2 * x2 - 0.5 * x3, c3 = 0.5 * (x3 - x0) + 1.5 * (x1 - x2);
    return ((c3 * f + c2) * f + c1) * f + x1;
}
double Sky::Allpass::run(double x) {
    const double z = l.read(d);
    const double v = x + g * z;
    l.write(v);
    return z - g * v;
}
void Sky::Biquad::lowpass(double f, double sr) {
    on = f < 0.45 * sr && f < 19500;
    if (!on) return;
    const double w = 2 * PI * f / sr, cs = std::cos(w), al = std::sin(w) / (2 * 0.7071067811865476), a0 = 1 + al;
    b0 = (1 - cs) / 2 / a0;
    b1 = (1 - cs) / a0;
    b2 = b0;
    a1 = -2 * cs / a0;
    a2 = (1 - al) / a0;
}
void Sky::Biquad::highpass(double f, double sr) {
    on = true;
    const double w = 2 * PI * std::max(5.0, f) / sr, cs = std::cos(w), al = std::sin(w) / (2 * 0.7071067811865476), a0 = 1 + al;
    b0 = (1 + cs) / 2 / a0;
    b1 = -(1 + cs) / a0;
    b2 = b0;
    a1 = -2 * cs / a0;
    a2 = (1 - al) / a0;
}
double Sky::Biquad::run(double x) {
    if (!on) return x;
    const double y = b0 * x + z1;
    z1 = flush(b1 * x - a1 * y + z2);
    z2 = flush(b2 * x - a2 * y);
    return y;
}

uint32_t Sky::rnd() {
    seed_ = seed_ * 1664525u + 1013904223u;
    return seed_;
}

/* ---------------- le reseau ---------------- */

void Sky::tankConfigure(double scale, double apG, double depth, double rate) {
    const double s = std::max(0.12, std::min(MAX_SCALE, scale));
    for (int i = 0; i < N; ++i) {
        len_[static_cast<size_t>(i)] = BASE[i] * k_ * s;
        apLen_[static_cast<size_t>(i)] = std::max(2.0, std::round(AP_IN[i] * k_ * std::min(1.6, std::max(0.3, s))));
        aps_[static_cast<size_t>(i)].d = static_cast<int>(apLen_[static_cast<size_t>(i)]);
        aps_[static_cast<size_t>(i)].g = apG;
    }
    tApG_ = apG;
    depth_ = std::max(0.0, std::min(60 * k_, depth));
    for (int i = 0; i < N; ++i) {
        const double r1 = rate * (0.62 + 0.11 * i), r2 = rate * (1.37 + 0.083 * ((i * 5) % 8));
        dp1_[static_cast<size_t>(i)] = r1 / sr_;
        dp2_[static_cast<size_t>(i)] = r2 / sr_;
    }
}

void Sky::tankDecay(double t60, double low, double mid, double hi, double fLow, double fHi) {
    aLow_ = std::exp(-2 * PI * fLow / sr_);
    aHi_ = std::exp(-2 * PI * std::min(0.4 * sr_, fHi) / sr_);
    const double t = std::max(0.05, t60);
    for (int i = 0; i < N; ++i) {
        const double d = (len_[static_cast<size_t>(i)] + apLen_[static_cast<size_t>(i)] * (tApG_ > 0 ? 1 : 0)) / sr_;
        const auto g = [&](double m) { return std::min(0.99995, std::pow(10.0, (-3 * d) / (t * std::max(0.05, m)))); };
        gL_[static_cast<size_t>(i)] = g(low);
        gM_[static_cast<size_t>(i)] = g(mid);
        gH_[static_cast<size_t>(i)] = g(hi);
    }
}

double Sky::tank(double inL, double inR, double& oR) {
    const double aL = 1 - aLow_, aH = 1 - aHi_, dep = depth_;
    double sum = 0, oL = 0, oRr = 0;
    for (int i = 0; i < N; ++i) {
        const size_t u = static_cast<size_t>(i);
        double p1 = ph1_[u] + dp1_[u];
        if (p1 >= 1) p1 -= 1;
        double p2 = ph2_[u] + dp2_[u];
        if (p2 >= 1) p2 -= 1;
        ph1_[u] = p1;
        ph2_[u] = p2;
        const double mod = dep > 0 ? dep * (0.62 * std::sin(TWO_PI * p1) + 0.38 * std::sin(TWO_PI * p2)) : 0;
        double r = lines_[u].readF(len_[u] + dep + mod + 2);
        if (tApG_ > 0) r = aps_[u].run(r);
        const double lo = (sL_[u] = flush(sL_[u] + aL * (r - sL_[u])));
        const double rest = r - lo;
        const double md = (sM_[u] = flush(sM_[u] + aH * (rest - sM_[u])));
        double v;
        if (frz_ > 0) {
            // FREEZE : les gains montent a 1 (l'amortissement leve) avec le fondu
            const double f = frz_;
            v = (gL_[u] + f * (1 - gL_[u])) * lo + (gM_[u] + f * (1 - gM_[u])) * md + (gH_[u] + f * (1 - gH_[u])) * (rest - md);
        } else
            v = gL_[u] * lo + gM_[u] * md + gH_[u] * (rest - md);
        y_[u] = v;
        sum += v;
        oL += v * OUT_L[i];
        oRr += v * OUT_R[i];
    }
    const double h = sum * (2.0 / N);
    if (frz_ > 0) {
        // FREEZE : ce qui entre dans le reseau descend a zero avec le fondu
        inL *= 1 - frz_;
        inR *= 1 - frz_;
    }
    for (int i = 0; i < N; ++i) {
        double x = y_[static_cast<size_t>(i)] - h + ((i & 1) ? inR : inL) * INJ[i];
        if (x > 4 || x < -4) x = 4 * std::tanh(x * 0.25);
        lines_[static_cast<size_t>(i)].write(x);
    }
    oR = oRr * 0.35355;
    return oL * 0.35355;
}

/* ---------------- preparation, etat ---------------- */

void Sky::prepare(double sampleRate) {
    sr_ = sampleRate > 0 ? sampleRate : 48000;
    k_ = sr_ / 48000;
    for (int i = 0; i < N; ++i) {
        lines_[static_cast<size_t>(i)].alloc(static_cast<int>(std::ceil(BASE[i] * k_ * MAX_SCALE + 64 * k_ * MAX_SCALE + 8)));
        aps_[static_cast<size_t>(i)].l.alloc(static_cast<int>(std::ceil(AP_IN[i] * k_ * 1.6 + 32)));
        ph1_[static_cast<size_t>(i)] = std::fmod(i * 0.37, 1.0);
        ph2_[static_cast<size_t>(i)] = std::fmod(i * 0.61 + 0.2, 1.0);
    }
    for (auto& l : pre_) l.alloc(static_cast<int>(std::ceil(1.35 * sr_)));
    for (int c = 0; c < 2; ++c)
        for (int i = 0; i < 4; ++i) {
            const int d = c == 0 ? DIFF_L[i] : DIFF_R[i];
            auto& a = dif_[static_cast<size_t>(c)][static_cast<size_t>(i)];
            a.l.alloc(static_cast<int>(std::ceil(d * k_ * 1.3 + 8)));
            a.d = static_cast<int>(std::lround(d * k_));
        }
    static const double SD[3] = {0.0331, 0.0387, 0.0423};
    for (int i = 0; i < 3; ++i) {
        springs_[static_cast<size_t>(i)].line.alloc(static_cast<int>(std::ceil(0.06 * sr_)));
        springs_[static_cast<size_t>(i)].D = SD[i] * sr_;
    }
    for (auto& a : bloom_) a.l.alloc(static_cast<int>(std::ceil(0.45 * sr_)));
    for (auto& l : shLine_) l.alloc(static_cast<int>(std::ceil(0.2 * sr_)));
    const double W = std::round(0.085 * sr_);
    shift_[0][0].win = W;
    shift_[0][1].win = W * 0.83;
    shift_[1][0].win = W * 0.91;
    shift_[1][1].win = W * 0.77;
    for (auto& f : shHp_) f.highpass(180, sr_);
    for (auto& f : shLp_) f.lowpass(9000, sr_);
    tape_.alloc(static_cast<int>(std::ceil(1.6 * sr_)));
    for (auto& h : headAp_)
        for (auto& a : h) a.l.alloc(static_cast<int>(std::ceil(0.02 * sr_)));
    tapeHp_.highpass(110, sr_);
    nlLine_.alloc(static_cast<int>(std::ceil(1.7 * sr_)));
    ready_ = true;
    const SkyEngine p = have_ ? p_ : skyEngine(SKY_HALL, skyDefaults(SKY_HALL));
    structKey_ = 0;
    have_ = false;
    havePending_ = false;
    apply(p, true);
    reset();
}

void Sky::clearAll() {
    for (auto& l : lines_) l.clear();
    for (auto& a : aps_) a.l.clear();
    sL_.fill(0);
    sM_.fill(0);
    y_.fill(0);
    for (auto& l : pre_) l.clear();
    for (auto& c : dif_)
        for (auto& a : c) a.l.clear();
    for (auto& f : hp_) f.clear();
    for (auto& f : lp_) f.clear();
    for (auto& s : springs_) {
        s.line.clear();
        s.ap.fill(0);
        s.fb = s.lp = 0;
        s.hp.clear();
    }
    for (auto& a : bloom_) a.l.clear();
    bloomFb_ = bloomLp_ = 0;
    for (auto& l : shLine_) l.clear();
    shFbL_ = shFbR_ = 0;
    for (auto& f : shHp_) f.clear();
    for (auto& f : shLp_) f.clear();
    for (auto& s : svf_) s.fill(0);
    tape_.clear();
    for (auto& h : headAp_)
        for (auto& a : h) a.l.clear();
    tapeFb_ = tapeLp_ = 0;
    tapeHp_.clear();
    nlLine_.clear();
    nlFb_ = nlLp_ = 0;
    env_ = 0;
    swell_ = 1;
    swArmed_ = true;
}

/** Le reveil (et reset) : tout vide, les phases et les glissements a leur depart (le rendu ne depend pas des blocs). */
void Sky::wake() {
    clearAll();
    for (int i = 0; i < N; ++i) {
        ph1_[static_cast<size_t>(i)] = std::fmod(i * 0.37, 1.0);
        ph2_[static_cast<size_t>(i)] = std::fmod(i * 0.61 + 0.2, 1.0);
    }
    for (int i = 0; i < 3; ++i) springs_[static_cast<size_t>(i)].ph = i * 0.3;
    for (auto& c : shift_)
        for (auto& s : c) s.ph = 0;
    erPh_ = tapePh_ = tapePh2_ = nlPh_ = vPh_ = 0;
    vRand_[0] = vRand_[1] = 0;
    seed_ = 0x5a17u;
    quiet_ = 1;
    preCur_ = preT_;
    silent_ = 0;
    count_ = 0;
    idle_ = false;
    if (algo_ == SKY_CHORALE) vowelCoefs();
}

void Sky::reset() {
    if (havePending_) {
        havePending_ = false;
        structKey_ = 0;
        apply(pending_, true);
    }
    fade_ = 1;
    fadeDir_ = 0;
    frz_ = frzOn_ && algo_ != SKY_SPRING ? 1 : 0;
    wake();
}

void Sky::set(int machine, const SkyNorm& n, bool now) { setEngine(skyEngine(machine, n), now); }

void Sky::setFreeze(bool on, bool now) {
    frzOn_ = on;
    if (now) frz_ = on && algo_ != SKY_SPRING ? 1 : 0;
}

void Sky::setEngine(const SkyEngine& p, bool now) {
    if (!ready_) {
        p_ = p;
        have_ = true;
        return;
    }
    apply(p, now);
}

void Sky::apply(const SkyEngine& p, bool now) {
    uint64_t key = 0xcbf29ce484222325ull;
    key = mix(key, p.algo);
    key = mix(key, p.scale);
    key = mix(key, p.springs);
    key = mix(key, p.heads);
    key = mix(key, p.uneven ? 1 : 0);
    key = mix(key, p.roomW);
    key = mix(key, p.roomL);
    key = mix(key, p.srcX);
    key = mix(key, p.srcY);
    if (!now && have_ && structKey_ != 0 && key != structKey_) {
        // la structure change : le fondu descend, la suite viendra au bout
        pending_ = p;
        havePending_ = true;
        fadeDir_ = -1;
        return;
    }
    const bool restruct = key != structKey_;
    structKey_ = key;
    p_ = p;
    have_ = true;
    const double sr = sr_;
    const int algo = std::max(0, std::min(kSkyMachines - 1, p.algo));
    const double scale = clampN(p.scale, 0.12, MAX_SCALE, 1);
    const double mod = clampN(p.mod, 0, 1, 0.3);
    const double depth = (mod <= 0.5 ? mod * 2 : 1 + (mod - 0.5) * 3) * (3 + 9 * std::min(scale, 1.5)) * k_;
    const double rate = clampN(p.modRate, 0.05, 8, 0.6) * (mod > 0.5 ? 1 + (mod - 0.5) * 1.2 : 1);
    tankConfigure(scale, clampN(p.apG, 0, 0.75, 0), depth, rate);
    const double t60 = clampN(p.t60, 0.05, 60, 2);
    tankDecay(t60, clampN(p.lowMul, 0.2, 2, 1), clampN(p.midMul, 0.2, 2, 1), clampN(p.hiMul, 0.05, 1.2, 0.7), 260, clampN(p.hiHz, 600, 16000, 4500));
    for (auto& f : hp_) f.highpass(clampN(p.lowCut, 10, 600, 30), sr);
    for (auto& f : lp_) f.lowpass(clampN(p.toneHz, 300, 22000, 8000), sr);
    preT_ = clampN(p.pre, 0, 1, 0) * sr;
    if (now || restruct) preCur_ = preT_;
    const double dg = clampN(p.diffusion, 0, 1, 0.7);
    const double gIn[4] = {0.75 * dg, 0.75 * dg, 0.625 * dg, 0.625 * dg};
    for (auto& c : dif_)
        for (int i = 0; i < 4; ++i) c[static_cast<size_t>(i)].g = gIn[i];
    if (algo == SKY_SPRING) {
        const int n = static_cast<int>(clampN(p.springs, 1, 3, 2));
        for (int i = 0; i < 3; ++i) {
            auto& sp = springs_[static_cast<size_t>(i)];
            sp.on = i < n;
            sp.g = std::pow(10.0, (-3 * (sp.D / sr)) / std::max(0.1, t60));
            sp.hp.highpass(clampN(p.lowCut, 10, 600, 60) * 1.4, sr);
        }
        springLp_ = 1 - std::exp(-2 * PI * std::min(5200.0, clampN(p.toneHz, 300, 22000, 5000) * 0.9) / sr);
        drive_ = clampN(p.drive, 1, 20, 1);
    }
    if (algo == SKY_BLOOM) {
        const double L = clampN(p.bloomLen, 0.02, 0.4, 0.15) * sr;
        static const double F[4] = {0.37, 0.53, 0.71, 1};
        for (int i = 0; i < 4; ++i) {
            bloom_[static_cast<size_t>(i)].d = std::max(2, static_cast<int>(std::lround(L * F[i])));
            bloom_[static_cast<size_t>(i)].g = 0.62;
        }
        bloomGain_ = clampN(p.bloomFb, 0, 0.92, 0.5);
    }
    if (algo == SKY_SHIMMER) {
        const double r1 = clampN(p.shift1, 0.25, 4, 2), r2 = clampN(p.shift2, 0, 4, 0);
        shift_[0][0].ratio = shift_[1][0].ratio = r1;
        shift_[0][1].ratio = shift_[1][1].ratio = r2 > 0 ? r2 : 1;
        shAmt_ = clampN(p.shAmt, 0, 1, 0.5);
        shMode_ = std::max(0, std::min(2, p.shMode));
        shTwo_ = r2 > 0;
    }
    if (algo == SKY_CHORALE) {
        vSet_ = std::max(0, std::min(6, p.vowel));
        vQ_ = clampN(p.q, 1, 30, 8);
    }
    if (algo == SKY_MAGNETO) {
        const int n = p.heads == 3 || p.heads == 4 || p.heads == 6 ? p.heads : 4;
        const double T = clampN(p.dTime, 0.04, 1.5, 0.4) * sr;
        for (int i = 0; i < 6; ++i) {
            const double pos = p.uneven ? (6 - n + i < 6 ? UNEVEN[6 - n + i] : 1) : (i + 1.0) / n;
            heads_[static_cast<size_t>(i)] = i < n ? std::max(3.0, pos * T) : 0;
            for (int j = 0; j < 2; ++j) {
                auto& a = headAp_[static_cast<size_t>(i)][static_cast<size_t>(j)];
                a.d = std::max(2, static_cast<int>(std::lround((j == 0 ? 0.0071 : 0.0113) * sr * (0.8 + 0.08 * i))));
                a.g = 0.68 * clampN(p.diffusion, 0, 1, 0.5);
            }
        }
        nHeads_ = n;
        tapeGain_ = clampN(p.fb, 0, 0.95, 0.4);
        tapeLpA_ = 1 - std::exp(-2 * PI * std::min(6500.0, clampN(p.toneHz, 300, 22000, 5000)) / sr);
    }
    if (algo == SKY_NONLINEAR) {
        const double T = clampN(p.nlTime, 0.05, 1.5, 0.3) * sr;
        const int shape = std::max(0, std::min(5, p.nlShape));
        double e = 0;
        for (int i = 0; i < NL_TAPS; ++i) {
            const double t = (i + 0.5) / NL_TAPS;
            nlD_[static_cast<size_t>(i)] = std::max(3.0, t * T * (1 + (i % 2 ? 0.013 : -0.011)));
            nlG_[static_cast<size_t>(i)] = nlShape(shape, t);
            e += nlG_[static_cast<size_t>(i)] * nlG_[static_cast<size_t>(i)];
        }
        const double norm = 1.25 / std::sqrt(std::max(1e-6, e));
        double sum = 0;
        for (auto& g : nlG_) {
            g *= norm;
            sum += g;
        }
        // la reinjection ramenee a la somme des prises : la boucle reste sous FEEDBACK, jamais au-dessus de 1
        nlGain_ = clampN(p.fb, 0, 0.9, 0) / std::max(1.0, 0.675 * sum);
        lateLevel_ = clampN(p.lateLevel, 0, 1, 0.3);
        nlRate_ = clampN(p.modRate, 0.05, 8, 0.6);
    }
    if (restruct || now) {
        nEr_ = 0;
        if (algo == SKY_ROOM || algo == SKY_HALL || algo == SKY_REFLECTIONS) {
            // les sources images (ordres 1 et 2 sur les murs, sol et plafond a l'ordre 1), dans un tableau fixe
            const double w = clampN(p.roomW, 2, 80, 6), l = clampN(p.roomL, 2, 80, 5), h = clampN(p.roomH, 2, 25, 3);
            const double src[2] = {w * clampN(p.srcX, 0, 1, 0.5), l * clampN(p.srcY, 0, 1, 0.5)};
            const double lst[2] = {w * 0.5, l * clampN(p.lstY, 0, 1, 0.15)};
            const double beta = clampN(p.beta, 0.2, 0.98, 0.8), mx = algo == SKY_REFLECTIONS ? 0.22 : 0.16;
            const double ears[2][2] = {{lst[0] - 0.09, lst[1]}, {lst[0] + 0.09, lst[1]}};
            const double zS = 1.1, zL = 1.2;
            const double d0 = std::sqrt((src[0] - lst[0]) * (src[0] - lst[0]) + (src[1] - lst[1]) * (src[1] - lst[1]) + (zS - zL) * (zS - zL));
            const auto add = [&](double ix, double iy, double iz, int order) {
                double g[2] = {0, 0}, dm = 0;
                for (int e = 0; e < 2; ++e) {
                    const double dx = ix - ears[e][0], dy = iy - ears[e][1];
                    const double d = std::sqrt(dx * dx + dy * dy + (iz - zL) * (iz - zL));
                    const double side = e == 0 ? -dx / d : dx / d;
                    g[e] = (d0 / d) * std::pow(beta, order) * (0.72 + 0.28 * side);
                    dm += d / 2;
                }
                const double t = (dm - d0) / 343;
                if (t > 0.0005 && t < mx && nEr_ < 16) er_[static_cast<size_t>(nEr_++)] = {t * sr, g[0], g[1]};
            };
            const auto img = [](int n, double s, double L) { return n % 2 == 0 ? n * L + s : (n + 1) * L - s; };
            for (int ix = -2; ix <= 2; ++ix)
                for (int iy = -2; iy <= 2; ++iy) {
                    const int o = std::abs(ix) + std::abs(iy);
                    if (o == 0 || o > 2) continue;
                    add(img(ix, src[0], w), img(iy, src[1], l), zS, o);
                }
            add(src[0], src[1], -zS, 1);
            add(src[0], src[1], 2 * h - zS, 1);
            std::sort(er_.begin(), er_.begin() + nEr_, [](const Tap& a, const Tap& b) { return a.d < b.d; });
        }
    }
    erGain_ = clampN(p.erLevel, 0, 2, 0);
    tankGain_ = clampN(p.tankLevel, 0, 4, 1);
    outGain_ = clampN(p.gain, 0, 8, 1);
    rise_ = clampN(p.rise, 0.05, 5, 0.5);
    swellDry_ = p.swellDry;
    algo_ = algo;
    if (algo == SKY_CHORALE) vowelCoefs();
}

/** CHORALE : les trois formants du moment (glisse toutes les 32 echantillons : le rendu ne depend pas des blocs). */
void Sky::vowelCoefs() {
    const double dt = 32.0 / sr_;
    const int* set = VOWEL_SETS[vSet_];
    const double* A;
    const double* B;
    double x;
    if (set[0] >= 0) {
        A = VOWELS[set[0]];
        B = VOWELS[set[1]];
        vPh_ += dt * (0.07 + 0.33 * clampN(p_.mod, 0, 1, 0.3));
        if (vPh_ >= 1) vPh_ -= 1;
        x = 0.5 - 0.5 * std::cos(2 * PI * vPh_);
    } else {
        vPh_ += dt / 1.5;
        if (vPh_ >= 1) {
            vPh_ -= 1;
            vRand_[0] = vRand_[1];
            vRand_[1] = static_cast<int>((rnd() >> 8) % 3);
        }
        A = VOWELS[vRand_[0]];
        B = VOWELS[vRand_[1]];
        x = std::min(1.0, vPh_ * 2.5);
        x = x * x * (3 - 2 * x);
    }
    for (int j = 0; j < 3; ++j) {
        const double f = A[j] + (B[j] - A[j]) * x;
        svfG_[static_cast<size_t>(j)] = std::tan(PI * std::min(f, 0.45 * sr_) / sr_);
        svfLvl_[static_cast<size_t>(j)] = A[j + 3] + (B[j + 3] - A[j + 3]) * x;
    }
}

double Sky::shiftRun(int c, int v) {
    Shifter& s = shift_[static_cast<size_t>(c)][static_cast<size_t>(v)];
    if (s.ratio == 1) return 0;
    const double W = s.win;
    double ph = s.ph + (1 - s.ratio) / W;
    ph -= std::floor(ph);
    s.ph = ph;
    double ph2 = ph + 0.5;
    if (ph2 >= 1) ph2 -= 1;
    const double a = std::sin(PI * ph), b = std::sin(PI * ph2);
    const Line& l = shLine_[static_cast<size_t>(c)];
    return a * a * l.readF(3 + ph * W) + b * b * l.readF(3 + ph2 * W);
}

/* ---------------- le rendu ---------------- */

void Sky::process(const float* inL, const float* inR, float* outL, float* outR, int n) {
    int s0 = 0;
    // Au repos : rien en entree, rien a calculer, jusqu'au premier echantillon non nul (le reveil, d'un etat vide)
    if (idle_) {
        while (s0 < n && inL[s0] == 0.f && inR[s0] == 0.f) {
            outL[s0] = outR[s0] = 0.f;
            ++s0;
        }
        if (s0 == n) return;
        wake();
    }
    const double sr = sr_;
    const int algo = algo_;
    const double preA = 1 - std::exp(-1 / (0.06 * sr));
    const double fadeStep = 1.0 / FADE_N;
    const long idleN = static_cast<long>(IDLE_S * sr);
    // FREEZE (v46) : sa cible (SPRING n'a pas de reseau) et son pas (50 ms)
    const double frzT = frzOn_ && algo != SKY_SPRING ? 1 : 0;
    const double frzStep = 1 / (0.05 * sr);
    for (int s = s0; s < n; ++s) {
        if (idle_) {
            // tombe au repos en cours de bloc : la suite est nulle tant que rien n'entre
            if (inL[s] == 0.f && inR[s] == 0.f) {
                outL[s] = outR[s] = 0.f;
                continue;
            }
            wake();
        }
        if (algo == SKY_CHORALE && (count_ & 31) == 0) vowelCoefs();
        ++count_;
        double xL = hp_[0].run(inL[s]);
        double xR = hp_[1].run(inR[s]);
        if (frz_ != frzT) frz_ = frz_ < frzT ? std::min(frzT, frz_ + frzStep) : std::max(frzT, frz_ - frzStep);
        if (frz_ > 0) {
            // FREEZE : l'entree coupee (les premieres reflexions, la bande, les prises s'eteignent ; le reseau tient)
            xL *= 1 - frz_;
            xR *= 1 - frz_;
        }
        if (algo == SKY_SWELL) {
            const double a = std::fabs(xL) + std::fabs(xR);
            env_ = flush(env_ + (a > env_ ? 0.02 : 0.0004) * (a - env_));
            if (env_ < 0.001) {
                quiet_ += 1;
                if (quiet_ > 0.08 * sr) swArmed_ = true;
            } else
                quiet_ = 0;
            if (swArmed_ && env_ > 0.003) {
                swArmed_ = false;
                swell_ = 0;
            }
            if (swell_ < 1) swell_ = std::min(1.0, swell_ + 1 / (rise_ * sr));
        }
        const double swS = algo == SKY_SWELL ? std::sin(0.5 * PI * swell_) : 1;
        const double sw = swS * swS;
        pre_[0].write(xL);
        pre_[1].write(xR);
        preCur_ += preA * (preT_ - preCur_);
        double pd = preCur_ + 3;
        if (algo == SKY_REFLECTIONS && p_.mod > 0) {
            erPh_ += 0.37 / sr;
            if (erPh_ >= 1) erPh_ -= 1;
            pd += p_.mod * 0.0015 * sr * (0.5 + 0.5 * std::sin(2 * PI * erPh_) * std::sin(2 * PI * erPh_ * 2.31));
        }
        double pL = pre_[0].readF(pd), pR = pre_[1].readF(pd);
        double wL = 0, wR = 0;
        if (nEr_ > 0) {
            double eL = 0, eR = 0;
            for (int j = 0; j < nEr_; ++j) {
                const Tap& t = er_[static_cast<size_t>(j)];
                const double m = 0.5 * (pre_[0].readF(pd + t.d) + pre_[1].readF(pd + t.d));
                eL += m * t.gl;
                eR += m * t.gr;
            }
            wL += eL * erGain_;
            wR += eR * erGain_;
            pL = 0.6 * pL + 0.5 * eL;
            pR = 0.6 * pR + 0.5 * eR;
        }
        if (algo == SKY_SPRING) {
            static const double pans[3][2] = {{1, 0.25}, {0.25, 1}, {0.7, 0.7}};
            const double dr = drive_;
            const double x = std::tanh((0.5 * (pL + pR)) * dr) / std::pow(dr, 0.72);
            double sL = 0, sR = 0;
            for (int i = 0; i < 3; ++i) {
                Spring& sp = springs_[static_cast<size_t>(i)];
                if (!sp.on) continue;
                double v = x + sp.fb;
                for (int j = 0; j < 40; j += 2) {
                    const double y1 = -0.72 * v + sp.ap[static_cast<size_t>(j)];
                    sp.ap[static_cast<size_t>(j)] = flush(v + 0.72 * y1);
                    const double y2 = -0.72 * y1 + sp.ap[static_cast<size_t>(j + 1)];
                    sp.ap[static_cast<size_t>(j + 1)] = flush(y1 + 0.72 * y2);
                    v = y2;
                }
                sp.line.write(v);
                sp.ph += (0.9 + 0.2 * i) / sr;
                if (sp.ph >= 1) sp.ph -= 1;
                const double y = sp.line.readF(sp.D + p_.mod * 6 * std::sin(2 * PI * sp.ph) + 4);
                sp.lp = flush(sp.lp + springLp_ * (y - sp.lp));
                sp.fb = sp.g * sp.hp.run(sp.lp);
                sL += y * pans[i][0];
                sR += y * pans[i][1];
            }
            wL += sL * tankGain_;
            wR += sR * tankGain_;
        } else if (algo == SKY_MAGNETO) {
            tapePh_ += 0.63 / sr;
            if (tapePh_ >= 1) tapePh_ -= 1;
            tapePh2_ += 5.7 / sr;
            if (tapePh2_ >= 1) tapePh2_ -= 1;
            const double wow = 1 + p_.mod * (0.0035 * std::sin(2 * PI * tapePh_) + 0.0007 * std::sin(2 * PI * tapePh2_));
            const double inT = 0.5 * (pL + pR) + tapeFb_;
            tape_.write(std::tanh(inT * 0.9) / 0.9);
            double hL = 0, hR = 0, last = 0, last2 = 0;
            const int nh = nHeads_;
            for (int i = 0; i < nh; ++i) {
                double y = tape_.readF(heads_[static_cast<size_t>(i)] * wow + 2);
                if (i == nh - 1) last = y;
                if (i == nh - 2) last2 = y;
                y = headAp_[static_cast<size_t>(i)][1].run(headAp_[static_cast<size_t>(i)][0].run(y));
                if (i % 2)
                    hR += y;
                else
                    hL += y;
            }
            const double fbSrc = p_.uneven ? 0.5 * (last + last2) : last;
            tapeLp_ = flush(tapeLp_ + tapeLpA_ * (fbSrc - tapeLp_));
            tapeFb_ = tapeGain_ * tapeHp_.run(tapeLp_);
            const double hs = 1.4 / std::sqrt(static_cast<double>(nh));
            hL *= hs;
            hR *= hs;
            double tR = 0;
            const double tL = tank(hL * 0.5, hR * 0.5, tR);
            wL += hL + tL * tankGain_;
            wR += hR + tR * tankGain_;
        } else if (algo == SKY_NONLINEAR) {
            double m = 0.5 * (pL + pR);
            m = dif_[0][1].run(dif_[0][0].run(m));
            m = dif_[1][3].run(dif_[1][2].run(m));
            nlLine_.write(m + nlFb_);
            nlPh_ += nlRate_ / sr;
            if (nlPh_ >= 1) nlPh_ -= 1;
            const double jit = p_.mod * 18 * k_;
            double nL = 0, nR = 0;
            for (int i = 0; i < NL_TAPS; ++i) {
                const double d = nlD_[static_cast<size_t>(i)] + 3 + (jit > 0 ? jit * (1 + std::sin(2 * PI * (nlPh_ + i * 0.137))) : 0);
                const double y = nlLine_.readF(d) * nlG_[static_cast<size_t>(i)];
                if (i & 1) {
                    nR += y;
                    nL += 0.35 * y;
                } else {
                    nL += y;
                    nR += 0.35 * y;
                }
            }
            nlLp_ = flush(nlLp_ + 0.35 * (0.5 * (nL + nR) - nlLp_));
            nlFb_ = nlGain_ * nlLp_;
            if (nlFb_ > 2 || nlFb_ < -2) nlFb_ = 2 * std::tanh(nlFb_ / 2);
            double tR = 0;
            const double tL = tank(nL * 0.4, nR * 0.4, tR);
            wL += nL + tL * lateLevel_ * tankGain_;
            wR += nR + tR * lateLevel_ * tankGain_;
        } else {
            double dL = pL * sw, dR = pR * sw;
            for (int j = 0; j < 4; ++j) {
                dL = dif_[0][static_cast<size_t>(j)].run(dL);
                dR = dif_[1][static_cast<size_t>(j)].run(dR);
            }
            if (algo == SKY_BLOOM) {
                double b = 0.5 * (dL + dR) + bloomFb_;
                for (auto& a : bloom_) b = a.run(b);
                bloomLp_ = flush(bloomLp_ + 0.25 * (b - bloomLp_));
                bloomFb_ = bloomGain_ * bloomLp_;
                if (bloomFb_ > 3 || bloomFb_ < -3) bloomFb_ = 3 * std::tanh(bloomFb_ / 3);
                dL = 0.35 * dL + b;
                dR = 0.35 * dR + b;
            }
            if (algo == SKY_SHIMMER) {
                const int md = shMode_;
                shLine_[0].write((md != 1 ? dL : 0) + (md != 0 ? shFbL_ : 0));
                shLine_[1].write((md != 1 ? dR : 0) + (md != 0 ? shFbR_ : 0));
                double zL = shiftRun(0, 0), zR = shiftRun(1, 0);
                if (shTwo_) {
                    zL = 0.7 * (zL + shiftRun(0, 1));
                    zR = 0.7 * (zR + shiftRun(1, 1));
                }
                zL = shLp_[0].run(shHp_[0].run(zL)) * shAmt_;
                zR = shLp_[1].run(shHp_[1].run(zR)) * shAmt_;
                dL += zL;
                dR += zR;
            }
            double tR = 0;
            double tL = tank(dL, dR, tR);
            if (algo == SKY_SHIMMER) {
                // REGEN : la queue renvoyee aux transpositeurs (0.35 : chaque octave s'eteint apres l'autre)
                shFbL_ = flush(std::tanh(tL * 0.35));
                shFbR_ = flush(std::tanh(tR * 0.35));
            }
            if (algo == SKY_CHORALE) {
                const double K = 1 / vQ_;
                double cL = 0, cR = 0;
                for (int c = 0; c < 2; ++c) {
                    auto& st = svf_[static_cast<size_t>(c)];
                    const double x = c == 0 ? tL : tR;
                    double acc = 0;
                    for (int j = 0; j < 3; ++j) {
                        const double g = svfG_[static_cast<size_t>(j)];
                        const double a1 = 1 / (1 + g * (g + K));
                        const double v3 = x - st[static_cast<size_t>(2 * j + 1)];
                        const double v1 = a1 * st[static_cast<size_t>(2 * j)] + g * a1 * v3;
                        const double v2 = st[static_cast<size_t>(2 * j + 1)] + g * v1;
                        st[static_cast<size_t>(2 * j)] = flush(2 * v1 - st[static_cast<size_t>(2 * j)]);
                        st[static_cast<size_t>(2 * j + 1)] = flush(2 * v2 - st[static_cast<size_t>(2 * j + 1)]);
                        acc += v1 * K * svfLvl_[static_cast<size_t>(j)];
                    }
                    (c == 0 ? cL : cR) = acc;
                }
                const double vq = std::sqrt(vQ_) * 0.9;
                tL = 0.3 * tL + cL * vq;
                tR = 0.3 * tR + cR * vq;
            }
            wL += tL * tankGain_;
            wR += tR * tankGain_;
            if (algo == SKY_SWELL && swellDry_) {
                const double s2 = std::sin(0.5 * PI * swell_);
                wL += xL * s2 * s2 * 0.8;
                wR += xR * s2 * s2 * 0.8;
            }
        }
        wL = lp_[0].run(wL) * outGain_;
        wR = lp_[1].run(wR) * outGain_;
        if (fadeDir_ != 0) {
            fade_ += fadeDir_ * fadeStep;
            if (fade_ <= 0) {
                fade_ = 0;
                clearAll();
                if (havePending_) {
                    havePending_ = false;
                    structKey_ = 0;
                    apply(pending_, true);
                }
                fadeDir_ = 1;
            } else if (fade_ >= 1) {
                fade_ = 1;
                fadeDir_ = 0;
            }
        }
        if (fade_ < 1) {
            wL *= fade_;
            wR *= fade_;
        }
        if (!(wL == wL) || !(wR == wR) || std::fabs(wL) > 1e6 || std::fabs(wR) > 1e6) {
            // un NaN ne passe jamais : tout repart a zero
            clearAll();
            wL = wR = 0;
        }
        outL[s] = static_cast<float>(flush(wL));
        outR[s] = static_cast<float>(flush(wR));
        // le repos : une seconde de silence en entree et en sortie
        if (inL[s] == 0.f && inR[s] == 0.f && std::fabs(wL) < 1e-6 && std::fabs(wR) < 1e-6 && fadeDir_ == 0) {
            if (++silent_ > idleN) {
                idle_ = true;
                silent_ = 0;
            }
        } else
            silent_ = 0;
    }
}

} // namespace mmarp
