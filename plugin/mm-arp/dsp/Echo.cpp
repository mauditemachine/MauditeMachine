// MM-ARP v27 : la page DELAY (voir Echo.h).
#include "Echo.h"

#include <algorithm>
#include <cmath>

namespace mmarp {

namespace {
constexpr double PI = 3.14159265358979323846;
inline double clamp01(double v) { return v != v ? 0 : v < 0 ? 0 : v > 1 ? 1 : v; }
inline double flushd(double v) { return std::fabs(v) < 1e-25 ? 0 : v; }

// la couleur des styles : bande, LP, HP, saturation, modulation, diffusion, souffle, octave, lofi, trois tetes
const EchoVoicing kVoicing[ES_COUNT] = {
    {true, 1, 1, 0, 1, 0, 0, 0, 0, false},           // TAPE : la bande du site
    {false, 0.58, 0.75, 0.35, 0.12, 0, 0.06, 0, 0, false}, // ANALOG : seaux (BBD), sombre et rond
    {false, 1, 1, 0, 0, 0, 0, 0, 0, false},          // DIGITAL : le ping-pong du site
    {true, 0.85, 1, 0, 1.3, 0.3, 0.03, 0, 0, true},   // SPACE : trois tetes et un ressort
    {false, 0.62, 1.6, 0.2, 0, 0, 0.08, 0, 2, false}, // LO-FI : echantillonneur fatigue
    {true, 0.55, 1.8, 0.6, 1, 0, 0.02, 0, 0, false},  // DUB : sombre et chaud
    {true, 0.62, 1.4, 0.15, 3, 0, 0.18, 0, 0, false}, // CASSETTE : usee, pleurage et souffle
    {false, 2.6, 1.8, 0, 0.04, 0.35, 0, 0.55, 0, false}, // CRYSTAL : l'octave au-dessus dans la boucle
};

// les motifs RHYTHM (seize prises)
const float kRhythm[EchoLaws::kRhythms][16] = {
    {1, 0, 0.5f, 0, 0.8f, 0, 0, 0.4f, 1, 0, 0.3f, 0, 0.7f, 0.25f, 0, 0.55f},                 // MACHINE
    {1, 0, 0, 0, 0.8f, 0, 0, 0, 0.6f, 0, 0, 0, 0.45f, 0, 0, 0},                               // FOUR
    {1, 0, 0, 0.8f, 0, 0, 0.7f, 0, 0, 0, 0.6f, 0, 0.5f, 0, 0, 0},                             // CLAVE
    {1, 0, 0, 0.8f, 0, 0, 0.7f, 0, 0.9f, 0, 0, 0.6f, 0, 0, 0.5f, 0},                          // TRESILLO
    {1, 0, 0.6f, 0.6f, 0.9f, 0, 0.5f, 0.5f, 0.8f, 0, 0.4f, 0.4f, 0.6f, 0, 0.3f, 0.3f},         // GALLOP
    {1, 0, 0, 0.8f, 0, 0, 0.65f, 0, 0, 0.5f, 0, 0, 0.4f, 0, 0, 0.3f},                          // DOTTED
    {0, 0, 1, 0, 0, 0, 0.8f, 0, 0, 0, 0.6f, 0, 0, 0, 0.45f, 0},                                // OFFBEAT
    {1, 0, 0, 0, 0, 0, 0, 0.8f, 0, 0, 0, 0.62f, 0, 0.48f, 0.38f, 0.3f},                        // BOUNCE
    {0.12f, 0, 0.22f, 0, 0.34f, 0, 0.46f, 0, 0.58f, 0, 0.7f, 0, 0.82f, 0, 1, 0},               // SWELL
    {1, 0.9f, 0.8f, 0.72f, 0.65f, 0.58f, 0.52f, 0.47f, 0.42f, 0.38f, 0.34f, 0.3f, 0.27f, 0.24f, 0.21f, 0.19f}, // ROLL
    {1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0.7f, 0, 0, 0, 0, 0},                                       // SPARSE
    {1, 0, 0.7f, 0, 0, 0.6f, 0, 0.5f, 0, 0, 0.4f, 0, 0.35f, 0, 0, 0},                          // SKIP
};

bool isPrime(int n) {
    if (n < 2) return false;
    for (int d = 2; d * d <= n; ++d)
        if (n % d == 0) return false;
    return true;
}
} // namespace

/* ---------------- les lois ---------------- */

double EchoLaws::divSixteenths(int i) {
    static const double k[kDivs] = {0.5, 1, 2, 4, 8, 16, 32};
    return k[std::max(0, std::min(kDivs - 1, i))];
}

double EchoLaws::noteMul(int note) { return note == 1 ? 1.5 : note == 2 ? 2.0 / 3.0 : 1.0; }

double EchoLaws::msOf(double v) { return 5 * std::pow(400.0, clamp01(v)); }

double EchoLaws::cutMul(double v) { return std::pow(8.0, 2 * clamp01(v) - 1); }

double EchoLaws::duckRelS(double v) { return 0.03 * std::pow(30.0, clamp01(v)); }

const EchoVoicing& EchoLaws::voicing(int style) { return kVoicing[std::max(0, std::min(ES_COUNT - 1, style))]; }

const float* EchoLaws::rhythm(int i) { return kRhythm[std::max(0, std::min(kRhythms - 1, i))]; }

int EchoLaws::prime(double ms, int avoid) {
    const int c = std::max(3, static_cast<int>(std::lround(ms)));
    for (int d = 0; d < 4000; ++d) {
        for (int s : {c - d, c + d})
            if (s >= 3 && s != avoid && isPrime(s)) return s;
    }
    return c;
}

void EchoLaws::ratios(const EchoSettings& e, double t, double& kL, double& kR) {
    kL = kR = 1;
    const bool single = e.mode == EM_SINGLE, rhythm = e.mode == EM_RHYTHM;
    // GROOVE : la gauche plus longue, la droite plus courte (PING-PONG : un echo sur deux en retard, le swing)
    const double g = clamp01(e.groove) / 3;
    if (g > 0 && !single && !rhythm) {
        kL = 1 + g;
        kR = 1 - g;
    }
    // OFFSET : la droite de -25 % a +25 % du temps
    const double off = (clamp01(e.offset) - 0.5) * 0.5;
    if (off != 0 && !single && !rhythm) kR += off;
    // FEEL : tous les echos en avance ou en retard (+/- 6 % du temps par echo)
    const double feel = (clamp01(e.feel) - 0.5) * 0.12;
    if (feel != 0) {
        kL *= 1 + feel;
        kR *= 1 + feel;
    }
    // PRIME : des temps en nombres premiers de ms, differents a gauche et a droite
    if (e.prime && t > 0.004) {
        const double ms = t * 1000;
        const int pl = prime(ms * kL, -1);
        const int pr = single || rhythm ? pl : prime(ms * kR, pl);
        kL = pl / ms;
        kR = pr / ms;
    }
}

/* ---------------- la chaine dans la boucle ---------------- */

void EchoLoop::prepare(double sr, uint32_t seed) {
    sr_ = sr;
    seed_ = seed ? seed : 1;
    static const double kApMs[4] = {4.7, 3.6, 12.7, 9.3};
    for (int i = 0; i < 4; ++i) ap_[static_cast<size_t>(i)].assign(static_cast<size_t>(std::max(8.0, std::round(kApMs[i] * 0.001 * sr))), 0.f);
    pW_ = std::max(256, static_cast<int>(std::lround(0.045 * sr)));
    pb_.assign(static_cast<size_t>(2 * pW_ + 8), 0.f);
    reset();
}

void EchoLoop::reset() {
    for (auto& a : ap_) std::fill(a.begin(), a.end(), 0.f);
    apW_.fill(0);
    hPh_ = 0;
    held_ = 0;
    lpY_ = 0;
    nY_ = 0;
    rng_ = seed_;
    std::fill(pb_.begin(), pb_.end(), 0.f);
    pw_ = 0;
    pd_ = pW_;
    sLp_ = 0;
}

void EchoLoop::set(double sat, double diff, int lofi, double noise, double shimmer) {
    const double s = clamp01(sat), d = clamp01(diff), z = std::max(0.0, noise), sh = clamp01(shimmer);
    k_ = s > 0 ? 1 + 6 * s : 0;
    g_ = 0.72 * d;
    if (lofi != lofi_) {
        lofi_ = lofi;
        hPh_ = 0;
    }
    // LOFI : 12 kHz et 11 bits ; LO-FI : 8 kHz et 8 bits ; les deux : 6 kHz et 7 bits
    const double fs = lofi >= 3 ? 6000 : lofi == 2 ? 8000 : 12000;
    hInc_ = std::min(1.0, fs / sr_);
    q_ = lofi >= 3 ? 64 : lofi == 2 ? 128 : 1024;
    lpA_ = 1 - std::exp(-2 * PI * std::min(0.45 * sr_, 0.42 * fs) / sr_);
    noise_ = z;
    shim_ = sh;
    on_ = k_ > 0 || g_ > 0 || lofi_ > 0 || noise_ > 0 || shim_ > 0;
}

float EchoLoop::run(float xin, float send) {
    double y = xin;
    if (shim_ > 0) {
        // l'octave au-dessus : deux tetes de lecture a vitesse double, en fondu (sin^2)
        const int N = static_cast<int>(pb_.size());
        pb_[static_cast<size_t>(pw_)] = static_cast<float>(y);
        const auto rd = [&](double d) {
            double pos = pw_ - d;
            while (pos < 0) pos += N;
            const int i0 = static_cast<int>(pos);
            const double f = pos - i0;
            const int i1 = i0 + 1 == N ? 0 : i0 + 1;
            return (1 - f) * pb_[static_cast<size_t>(i0)] + f * pb_[static_cast<size_t>(i1)];
        };
        const double W = pW_;
        const double d1 = pd_;
        double d2 = pd_ + 0.5 * W;
        if (d2 > W) d2 -= W;
        const double s1 = std::sin(PI * d1 / W);
        const double g1 = s1 * s1;
        const double up = g1 * rd(d1) + (1 - g1) * rd(d2);
        pd_ -= 1;
        if (pd_ < 1) pd_ += W;
        if (++pw_ == N) pw_ = 0;
        sLp_ += 0.35 * (up - sLp_);
        y = 0.62 * y + shim_ * sLp_;
    }
    if (g_ > 0) {
        // la diffusion : quatre passe-tout de Schroeder
        for (size_t a = 0; a < 4; ++a) {
            std::vector<float>& b = ap_[a];
            int& w = apW_[a];
            const double z = b[static_cast<size_t>(w)];
            const double o = z - g_ * y;
            b[static_cast<size_t>(w)] = static_cast<float>(flushd(y + g_ * o));
            if (++w == static_cast<int>(b.size())) w = 0;
            y = o;
        }
    }
    if (k_ > 0) y = std::tanh(k_ * y) / k_;
    if (lofi_ > 0) {
        hPh_ += hInc_;
        if (hPh_ >= 1) {
            hPh_ -= 1;
            held_ = std::floor(y * q_ + 0.5) / q_;
        }
        lpY_ += lpA_ * (held_ - lpY_);
        y = lpY_ = flushd(lpY_);
    }
    if (noise_ > 0) {
        rng_ ^= rng_ << 13;
        rng_ ^= rng_ >> 17;
        rng_ ^= rng_ << 5;
        const double wn = (rng_ * (1.0 / 4294967296.0)) * 2 - 1;
        nY_ = 0.7 * nY_ + 0.3 * wn;
        y += noise_ * 0.02 * nY_ * send;
    }
    return static_cast<float>(y);
}

/* ---------------- RHYTHM ---------------- */

void EchoRhythm::prepare(double sr) {
    sr_ = sr;
    buf_.assign(static_cast<size_t>(std::ceil(EchoLaws::kRhythmMaxS * sr)) + 8, 0.f);
    reset();
}

void EchoRhythm::reset() {
    std::fill(buf_.begin(), buf_.end(), 0.f);
    w_ = 0;
    lpY_ = hpY_ = hpX_ = 0;
    oLp_[0] = oLp_[1] = 0;
}

void EchoRhythm::set(const float* levels, double swing, double lpHz, double hpHz) {
    float sum = 0;
    for (int k = 0; k < 16; ++k) {
        lv_[static_cast<size_t>(k)] = std::max(0.f, std::min(1.f, levels[k]));
        sum += lv_[static_cast<size_t>(k)];
    }
    norm_ = 1.f / std::max(1.f, 0.5f * sum);
    swing_ = std::max(0.0, std::min(1.0 / 3, swing));
    lpA_ = 1 - std::exp(-2 * PI * std::min(0.45 * sr_, std::max(200.0, lpHz)) / sr_);
    hpA_ = std::exp(-2 * PI * std::min(0.45 * sr_, std::max(5.0, hpHz)) / sr_);
}

float EchoRhythm::read(double d) const {
    const int N = static_cast<int>(buf_.size());
    double pos = w_ - d;
    while (pos < 0) pos += N;
    const int i0 = static_cast<int>(pos);
    const double f = pos - i0;
    const int i1 = i0 + 1 == N ? 0 : i0 + 1;
    return static_cast<float>((1 - f) * buf_[static_cast<size_t>(i0)] + f * buf_[static_cast<size_t>(i1)]);
}

void EchoRhythm::run(float x, float step, float fb, EchoLoop* loop, float send, float& oL, float& oR) {
    const int N = static_cast<int>(buf_.size());
    const double s = std::max(1.0, static_cast<double>(step) * sr_);
    const double lim = N - 4;
    // la reinjection : la seizieme prise (la fin du motif), filtree et colorée
    double f = read(std::min(lim, 16 * s));
    hpY_ = hpA_ * (hpY_ + f - hpX_);
    hpX_ = f;
    lpY_ += lpA_ * (hpY_ - lpY_);
    hpY_ = flushd(hpY_);
    lpY_ = flushd(lpY_);
    float fv = static_cast<float>(lpY_);
    if (loop) fv = loop->run(fv, send);
    buf_[static_cast<size_t>(w_)] = x + fb * fv;
    double sL = 0, sR = 0;
    for (int k = 1; k <= 16; ++k) {
        const float lv = lv_[static_cast<size_t>(k - 1)];
        if (!(lv > 0)) continue;
        const double d = k * s + ((k & 1) ? swing_ * s : 0);
        if (d > lim) break;
        const double r = read(d) * lv;
        // les prises impaires a gauche, les paires a droite (sans quitter le centre)
        if (k & 1) {
            sL += r;
            sR += 0.55 * r;
        } else {
            sL += 0.55 * r;
            sR += r;
        }
    }
    oLp_[0] += lpA_ * (sL * norm_ - oLp_[0]);
    oLp_[1] += lpA_ * (sR * norm_ - oLp_[1]);
    oLp_[0] = flushd(oLp_[0]);
    oLp_[1] = flushd(oLp_[1]);
    oL = static_cast<float>(oLp_[0]);
    oR = static_cast<float>(oLp_[1]);
    if (++w_ == N) w_ = 0;
}

/* ---------------- DUCKING ---------------- */

void EchoDuck::prepare(double sr) {
    sr_ = sr;
    atk_ = 1 - std::exp(-1 / (0.003 * sr));
    sm_ = 1 - std::exp(-1 / (0.004 * sr));
    reset();
}

void EchoDuck::reset() {
    env_ = 0;
    g_ = 1;
}

void EchoDuck::set(double amount, double releaseS) {
    amt_ = clamp01(amount);
    rel_ = 1 - std::exp(-1 / (std::max(0.005, releaseS) * sr_));
}

float EchoDuck::gain(float dryAbs) {
    const double a = dryAbs;
    env_ += (a > env_ ? atk_ : rel_) * (a - env_);
    env_ = flushd(env_);
    // DUCKING au maximum : les echos se taisent des que le sec depasse -12 dBFS
    const double tgt = 1 - amt_ * std::min(1.0, 4 * env_);
    g_ += sm_ * (tgt - g_);
    if (amt_ <= 0 && g_ > 0.999999) g_ = 1;
    return static_cast<float>(g_);
}

} // namespace mmarp
