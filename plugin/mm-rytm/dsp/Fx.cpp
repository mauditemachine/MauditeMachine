#include "Fx.h"

#include <algorithm>
#include <cmath>
#include <cstring>

namespace mm {

namespace {
constexpr double PI = 3.14159265358979323846;
constexpr double BUTTER_Q = 0.70710678118654752; // le Q de Butterworth (BUTTER_Q_DB du site, ramene en lineaire)
constexpr double RYTM_TRIM = 0.84;               // drums.ts RYTM_TRIM
constexpr double DELAY_SEND = 1.2, REVERB_SEND = 1.0;
constexpr double LINE_W = 1.9447398407953985;    // 2 cos(0.075 pi)
inline double jsRound(double x) { return std::floor(x + 0.5); }
inline bool near(double a, double b) { return std::fabs(a - b) < 1e-6; }
inline double clampd(double v, double lo, double hi) { return std::max(lo, std::min(hi, v)); }

// mulberry32 (sends.ts makeImpulse, audio/trig.ts) : identique bit a bit
struct M32 {
    uint32_t a;
    explicit M32(uint32_t s) : a(s) {}
    double next() {
        a += 0x6D2B79F5u;
        uint32_t t = a;
        t = (t ^ (t >> 15)) * (t | 1u);
        t ^= t + (t ^ (t >> 7)) * (t | 61u);
        return static_cast<double>(t ^ (t >> 14)) / 4294967296.0;
    }
};

// La table d'interpolation du chorus (chorus.worklet.js) : 513 phases x 16 points, sinc fenetre de Kaiser (beta 8)
double besselI0(double x) {
    double s = 1, t = 1;
    for (int k = 1; k <= 40; ++k) {
        t *= (x / (2 * k)) * (x / (2 * k));
        s += t;
        if (t < 1e-12 * s) break;
    }
    return s;
}
const std::vector<float>& sincTable() {
    static const std::vector<float> T = [] {
        std::vector<float> out(513 * 16);
        const double i08 = besselI0(8);
        for (int p = 0; p <= 512; ++p) {
            double sum = 0;
            float row[16];
            for (int k = 0; k < 16; ++k) {
                const double x = p / 512.0 + 7 - k;
                const double r = x / 8;
                double v = 0;
                if (std::fabs(r) < 1) {
                    const double sinc = x == 0 ? 1 : std::sin(PI * x) / (PI * x);
                    v = sinc * besselI0(8 * std::sqrt(1 - r * r)) / i08;
                }
                row[k] = static_cast<float>(v);
                sum += row[k];
            }
            for (int k = 0; k < 16; ++k) out[static_cast<size_t>(p * 16 + k)] = static_cast<float>(row[k] / sum);
        }
        return out;
    }();
    return T;
}

// FFT complexe radix 2 en place (taille ReverbIR::N), facteurs precalcules
struct Fft {
    int n;
    std::vector<std::complex<float>> tw;
    std::vector<int> rev;
    explicit Fft(int size) : n(size), tw(static_cast<size_t>(size / 2)), rev(static_cast<size_t>(size)) {
        for (int k = 0; k < n / 2; ++k) tw[static_cast<size_t>(k)] = std::polar(1.0f, static_cast<float>(-2 * PI * k / n));
        int bits = 0;
        while ((1 << bits) < n) ++bits;
        for (int i = 0; i < n; ++i) {
            int r = 0;
            for (int b = 0; b < bits; ++b)
                if (i & (1 << b)) r |= 1 << (bits - 1 - b);
            rev[static_cast<size_t>(i)] = r;
        }
    }
    void run(std::complex<float>* a, bool inverse) const {
        for (int i = 0; i < n; ++i)
            if (i < rev[static_cast<size_t>(i)]) std::swap(a[i], a[rev[static_cast<size_t>(i)]]);
        for (int len = 2; len <= n; len <<= 1) {
            const int step = n / len;
            for (int i = 0; i < n; i += len)
                for (int j = 0; j < len / 2; ++j) {
                    std::complex<float> w = tw[static_cast<size_t>(j * step)];
                    if (inverse) w = std::conj(w);
                    const std::complex<float> u = a[i + j];
                    const std::complex<float> v = a[i + j + len / 2] * w;
                    a[i + j] = u + v;
                    a[i + j + len / 2] = u - v;
                }
        }
        if (inverse)
            for (int i = 0; i < n; ++i) a[i] /= static_cast<float>(n);
    }
};
const Fft& fft() {
    static const Fft f(ReverbIR::N);
    return f;
}

// Une rampe lineaire sur le bloc (les glissements de 20 ms du site, au bloc pres)
struct Ramp {
    double cur = 0;
    bool init = false;
    template <typename Fn>
    void apply(double target, int n, Fn&& fn) {
        if (!init) {
            cur = target;
            init = true;
        }
        const double step = (target - cur) / std::max(1, n);
        for (int i = 0; i < n; ++i) fn(i, cur + step * (i + 1));
        cur = target;
    }
};
} // namespace

/* ---------------- les lois ---------------- */

double FxLaws::dtoneHz(double v) { return near(v, 0.638) ? 4500 : clampd(800 * std::pow(15.0, clampd(v, 0, 1)), 200, 20000); }
double FxLaws::reverbSeconds(double v) { return near(v, 0.566) ? 2.4 : clampd(0.5 * std::pow(16.0, clampd(v, 0, 1)), 0.1, 10); }
double FxLaws::reverbHiEnd(double v) { return near(v, 0.442) ? 3000 : clampd(1000 * std::pow(12.0, clampd(v, 0, 1)), 200, 20000); }
double FxLaws::reverbPre(double v) { return near(v, 0.167) ? 0.02 : clampd(0.12 * clampd(v, 0, 1), 0, 0.25); }
double FxLaws::xtoneHz(double v) { return near(v, 1) ? 16000 : 1000 * std::pow(16.0, clampd(v, 0, 1)); }
double FxLaws::chorusMul(double v) { return near(v, 0.624) ? 1 : clampd(0.1 * std::pow(40.0, clampd(v, 0, 1)), 0.05, 8); }
double FxLaws::chorusDepth(double v) { return near(v, 0.5) ? 0.007 : clampd(0.014 * clampd(v, 0, 1), 0, 0.02); }
int FxLaws::bitRate(double v) { return near(v, 0) ? 1 : 1 + static_cast<int>(jsRound(clampd(v, 0, 1) * 15)); }
double FxLaws::delaySeconds(double dtime, double bpm) {
    static const int DIVS[6] = {1, 2, 3, 4, 6, 8};
    const int i = static_cast<int>(clampd(jsRound(clampd(dtime, 0, 1) * 5), 0, 5));
    return std::min(2.0, DIVS[i] * 60.0 / std::max(1.0, bpm) / 4);
}
double FxLaws::delayFeedback(double dfb) { return clampd(0.87 * clampd(dfb, 0, 1), 0, 0.9); }

/* ---------------- HELL et la DIST facon Decapitator (2026-11-13) : leurs lois ---------------- */

namespace {
// TIME en SYNC : 1/128 a 1/2 mesure, en doubles croches (1/16 = 1)
constexpr double HELL_DIVS[] = {0.125, 0.25, 0.5, 1, 4.0 / 3, 1.5, 2, 8.0 / 3, 3, 4, 6, 8};
constexpr int HELL_NDIV = 12;
// Un tour du decaleur (RANGE SYNC) ou du LFO (SYNC) : 8 mesures a 1/64, en doubles croches
constexpr double HELL_CYCLES[] = {128, 64, 32, 16, 8, 4, 2, 1, 0.5, 0.25};
constexpr int HELL_NCYC = 10;
// L'envoi et le retour : a envoi 1 et MIX 1, le premier echo ~6 dB au-dessus du son direct (mesure au rendu du moteur :
// a 1.0 et 1.0, HELL n'ajoutait que 0.1 a 1 dB a une piste qui y envoyait a 60 %, trop discret pour un effet de caractere)
constexpr double HELL_SEND = 1.5, HELL_RETURN = 1.3;
constexpr double HELL_MAX_S = 2.0;
// Les deux chaines de passe-tout a 90 degres d'Olli Niemitalo (4 sections du 2e ordre chacune ; 20 Hz a ~0.49 fs)
constexpr double HIL_A[4] = {0.6923878, 0.9360654322959, 0.9882295226860, 0.9987488452737};
constexpr double HIL_B[4] = {0.4021921162426, 0.8561710882420, 0.9722909545651, 0.9952884791278};
// SMEAR : quatre passe-tout en serie (echantillons a 48 kHz), un jeu par cote
constexpr int SMEAR_L[4] = {113, 337, 509, 709};
constexpr int SMEAR_R[4] = {127, 353, 541, 739};
} // namespace

// range : le cran (0 FINE, 1 WIDE, 2 SYNC)
double FxLaws::hellShiftHz(double range, double freq, double bpm) {
    const double u = clampd(2 * freq - 1, -1, 1);
    const double sg = u < 0 ? -1.0 : 1.0, a = std::fabs(u);
    const long r = std::lround(range);
    if (r == 1) return sg * 20000 * a * a * a;
    if (r == 2) {
        if (a < 1e-3) return 0;
        const int k = std::min(HELL_NCYC - 1, static_cast<int>(std::floor(a * HELL_NCYC)));
        return sg * (std::max(1.0, bpm) / 60 * 4) / HELL_CYCLES[k];
    }
    return sg * 200 * a * a;
}
double FxLaws::hellSeconds(double time, bool sync, double bpm) {
    const double t = clampd(time, 0, 1);
    if (sync) {
        const int k = static_cast<int>(std::lround(t * (HELL_NDIV - 1)));
        return std::min(HELL_MAX_S, HELL_DIVS[k] * 60 / std::max(1.0, bpm) / 4);
    }
    return std::min(HELL_MAX_S, 0.00002 * std::pow(50000.0, t));
}
double FxLaws::hellFilterHz(double v) { return 100 * std::pow(200.0, clampd(v, 0, 1)); }
double FxLaws::hellRateHz(double rate, bool sync, double bpm) {
    const double r = clampd(rate, 0, 1);
    if (sync) {
        const int k = static_cast<int>(std::lround(r * (HELL_NCYC - 1)));
        return (std::max(1.0, bpm) / 60 * 4) / HELL_CYCLES[k];
    }
    return 0.02 * std::pow(1000.0, r);
}
double FxLaws::distLowHz(double v) { return v < 0.005 ? 0 : 30 * std::pow(500.0 / 30, clampd(v, 0, 1)); }

DistX DistX::of(const GlobalFx& g) {
    DistX x;
    x.style = static_cast<int>(std::max(0L, std::min(5L, std::lround(clampd(g.xstyle, 0, 1) * 5))));
    x.tilt = clampd(2 * g.xtilt - 1, -1, 1);
    if (std::fabs(x.tilt) < 0.02) x.tilt = 0;
    x.low = clampd(g.xlow, 0, 1);
    if (x.low < 0.005) x.low = 0;
    x.thump = clampd(g.xthump, 0, 1);
    x.punish = g.xpunish >= 0.5 ? 1 : 0;
    x.mix = clampd(g.xmix, 0, 1);
    x.out = clampd(2 * g.xout - 1, -1, 1);
    if (std::fabs(x.out) < 0.005) x.out = 0;
    x.steep = g.xsteep >= 0.5;
    x.autoG = g.xauto >= 0.5;
    return x;
}

/* ---------------- la reponse de la reverb ---------------- */

void ReverbIR::impulse(double seconds, double hiEnd, double preDelay, double sr, std::vector<float>& L, std::vector<float>& R) {
    const long pre = static_cast<long>(jsRound(preDelay * sr));
    const long n = std::max(pre + 2, static_cast<long>(jsRound(seconds * sr)) + pre - static_cast<long>(jsRound(0.02 * sr)));
    const long len = n - pre;
    const double hiStart = std::max(9000.0, hiEnd);
    const long fade = std::max(1L, static_cast<long>(jsRound(0.003 * sr)));
    const double decay = std::exp(std::log(0.001) / static_cast<double>(len));
    const uint32_t seeds[2] = {808, 909};
    for (int ch = 0; ch < 2; ++ch) {
        std::vector<float>& buf = ch == 0 ? L : R;
        buf.assign(static_cast<size_t>(n), 0.f);
        M32 rnd(seeds[ch]);
        double y = 0, a = 0, env = 1, E = 0;
        for (long i = 0; i < len; ++i) {
            if (i % 64 == 0) {
                const double fc = hiStart * std::pow(hiEnd / hiStart, static_cast<double>(i) / static_cast<double>(len));
                a = 1 - std::exp(-2 * PI * fc / sr);
            }
            y += a * (rnd.next() * 2 - 1 - y);
            const double v = y * env * (i < fade ? static_cast<double>(i) / static_cast<double>(fade) : 1);
            buf[static_cast<size_t>(pre + i)] = static_cast<float>(v);
            E += v * v;
            env *= decay;
        }
        const double g = E > 0 ? 1 / std::sqrt(E) : 0;
        for (long i = pre; i < n; ++i) buf[static_cast<size_t>(i)] = static_cast<float>(buf[static_cast<size_t>(i)] * g);
    }
}

std::shared_ptr<ReverbIR> ReverbIR::make(double seconds, double hiEnd, double preDelay, double sr) {
    auto ir = std::make_shared<ReverbIR>();
    std::vector<float> L, R;
    impulse(seconds, hiEnd, preDelay, sr, L, R);
    const int len = static_cast<int>(L.size());
    ir->parts = std::max(1, (len + B - 1) / B);
    std::vector<std::complex<float>> a(static_cast<size_t>(N));
    for (int ch = 0; ch < 2; ++ch) {
        const std::vector<float>& src = ch == 0 ? L : R;
        auto& H = ir->H[static_cast<size_t>(ch)];
        H.assign(static_cast<size_t>(ir->parts * (N / 2 + 1)), {0, 0});
        for (int p = 0; p < ir->parts; ++p) {
            std::fill(a.begin(), a.end(), std::complex<float>(0, 0));
            for (int i = 0; i < B && p * B + i < len; ++i) a[static_cast<size_t>(i)] = src[static_cast<size_t>(p * B + i)];
            fft().run(a.data(), false);
            for (int k = 0; k <= N / 2; ++k) H[static_cast<size_t>(p * (N / 2 + 1) + k)] = a[static_cast<size_t>(k)];
        }
    }
    return ir;
}

/* ---------------- les briques ---------------- */

void FxChain::Bq::lowpass(double f, double sr) {
    f = clampd(f, 20, sr / 2 * 0.999);
    const double w = 2 * PI * f / sr, cw = std::cos(w), alpha = std::sin(w) / (2 * BUTTER_Q), a0 = 1 + alpha;
    b0 = (1 - cw) / 2 / a0; b1 = (1 - cw) / a0; b2 = b0; a1 = -2 * cw / a0; a2 = (1 - alpha) / a0;
}
void FxChain::Bq::highpass(double f, double sr) {
    f = clampd(f, 1, sr / 2 * 0.999);
    const double w = 2 * PI * f / sr, cw = std::cos(w), alpha = std::sin(w) / (2 * BUTTER_Q), a0 = 1 + alpha;
    b0 = (1 + cw) / 2 / a0; b1 = -(1 + cw) / a0; b2 = b0; a1 = -2 * cw / a0; a2 = (1 - alpha) / a0;
}

void FxChain::Bq::lowpassQ(double f, double q, double sr) {
    f = clampd(f, 20, sr / 2 * 0.999);
    const double w = 2 * PI * f / sr, cw = std::cos(w), alpha = std::sin(w) / (2 * q), a0 = 1 + alpha;
    b0 = (1 - cw) / 2 / a0; b1 = (1 - cw) / a0; b2 = b0; a1 = -2 * cw / a0; a2 = (1 - alpha) / a0;
}
void FxChain::Bq::highpassQ(double f, double q, double sr) {
    f = clampd(f, 1, sr / 2 * 0.999);
    const double w = 2 * PI * f / sr, cw = std::cos(w), alpha = std::sin(w) / (2 * q), a0 = 1 + alpha;
    b0 = (1 + cw) / 2 / a0; b1 = -(1 + cw) / a0; b2 = b0; a1 = -2 * cw / a0; a2 = (1 - alpha) / a0;
}

// Les etageres (RBJ, pente 1) : le TONE de la DIST facon Decapitator
void FxChain::Bq::lowShelf(double f, double db, double sr) {
    f = clampd(f, 20, sr / 2 * 0.999);
    const double A = std::pow(10.0, db / 40), w = 2 * PI * f / sr, cw = std::cos(w), al = std::sin(w) / 2 * std::sqrt(2.0), sA = 2 * std::sqrt(A) * al;
    const double a0 = (A + 1) + (A - 1) * cw + sA;
    b0 = A * ((A + 1) - (A - 1) * cw + sA) / a0;
    b1 = 2 * A * ((A - 1) - (A + 1) * cw) / a0;
    b2 = A * ((A + 1) - (A - 1) * cw - sA) / a0;
    a1 = -2 * ((A - 1) + (A + 1) * cw) / a0;
    a2 = ((A + 1) + (A - 1) * cw - sA) / a0;
}
void FxChain::Bq::highShelf(double f, double db, double sr) {
    f = clampd(f, 20, sr / 2 * 0.999);
    const double A = std::pow(10.0, db / 40), w = 2 * PI * f / sr, cw = std::cos(w), al = std::sin(w) / 2 * std::sqrt(2.0), sA = 2 * std::sqrt(A) * al;
    const double a0 = (A + 1) - (A - 1) * cw + sA;
    b0 = A * ((A + 1) + (A - 1) * cw + sA) / a0;
    b1 = -2 * A * ((A - 1) + (A + 1) * cw) / a0;
    b2 = A * ((A + 1) + (A - 1) * cw - sA) / a0;
    a1 = 2 * ((A - 1) - (A + 1) * cw) / a0;
    a2 = ((A + 1) - (A - 1) * cw - sA) / a0;
}

// TONE (tone.ts) : a 0, rien ; sinon un passe-haut puis un passe-bas de Butterworth
void FxChain::Tone::set(double tone, double sr) {
    double t = clampd(tone, -1, 1);
    if (std::fabs(t) < 0.04) t = 0;
    if (t == v) return;
    if (v == 0) {
        hp.clear();
        lp.clear();
    }
    v = t;
    if (v == 0) return;
    hp.highpass(v > 0 ? 20 * std::pow(9.0, v) : 20, sr);
    lp.lowpass(std::min(v < 0 ? 20000 * std::pow(0.045, -v) : 20000.0, 0.95 * sr / 2), sr);
}
void FxChain::Tone::process(float* L, float* R, int n) {
    if (v == 0) return;
    for (int i = 0; i < n; ++i) {
        L[i] = lp.run(0, hp.run(0, L[i]));
        R[i] = lp.run(1, hp.run(1, R[i]));
    }
}

// DIST (fx.ts) : dry k (1 - m), wet k m, la courbe tanh(8 u) bornee, le passe-bas DIST TONE (ouvert a 16 kHz)
void FxChain::Dist::set(double drive, double xtoneHz, double sr) {
    d = clampd(drive, 0, 1);
    const double m = 0.85 * d, k = std::pow(10.0, -9 * d / 20);
    dry = k * (1 - m);
    wet = k * m;
    pre = (1 + 12 * d) / 8;
    lpOn = xtoneHz < 16000;
    if (lpOn && xtoneHz != x) lp.lowpass(clampd(xtoneHz, 20, sr / 2), sr);
    x = xtoneHz;
    // STEEP : deux etages de plus au meme HIGH CUT (36 dB par octave)
    if (!plain && X.steep && lpOn && xFor != xtoneHz) {
        lp2.lowpass(clampd(xtoneHz, 20, sr / 2), sr);
        lp3.lowpass(clampd(xtoneHz, 20, sr / 2), sr);
        xFor = xtoneHz;
    }
}
// Les sous-reglages facon Decapitator : poses une fois (setGlobal), pas a chaque coup
void FxChain::Dist::setX(const DistX& nx, double sr) {
    if (nx == X && !(plain && !nx.plain())) return;
    const bool was = plain;
    X = nx;
    plain = X.plain();
    if (plain) return;
    if (was) {
        lowSh.clear();
        highSh.clear();
        lowCut.clear();
        lp2.clear();
        lp3.clear();
        dc.clear();
        envIn = envOut = 0;
        autoK = 1;
    }
    // TONE : sombre, les graves montent et les aigus baissent (6 dB au bout), autour de 700 Hz, avant la saturation
    tiltOn = X.tilt != 0;
    if (tiltOn) {
        lowSh.lowShelf(700, -6 * X.tilt, sr);
        highSh.highShelf(700, 6 * X.tilt, sr);
    }
    // LOW CUT et THUMP : un passe-haut avant la saturation, sa resonance fait la bosse
    const double lo = FxLaws::distLowHz(X.low);
    lowOn = lo > 0;
    if (lowOn) lowCut.highpassQ(lo, 0.707 + 2.3 * X.thump, sr);
    if (X.steep && lpOn) {
        lp2.lowpass(clampd(x, 20, sr / 2), sr);
        lp3.lowpass(clampd(x, 20, sr / 2), sr);
        xFor = x;
    } else {
        xFor = -1;
    }
    dc.highpass(10, sr);
    outG = std::pow(10.0, 12 * X.out / 20);
    ke = 1 - std::exp(-1 / (0.3 * sr));
}
// Les courbes de saturation (u : le signal deja pousse par DIST et PUNISH)
float FxChain::Dist::shape(float u) const {
    switch (X.style) {
        case 1: // TAPE : une courbe douce et symetrique, qui arrondit
            return static_cast<float>(std::atan(6.0 * u) * (2 / PI));
        case 2: { // DESK : asymetrique et brillante, une console poussee
            const double b = 0.25;
            return static_cast<float>(std::tanh(5.0 * u + b) - std::tanh(b));
        }
        case 3: { // IRON : un coude rond (cubique), le transformateur
            const double v = clampd(4.0 * u, -1.5, 1.5);
            return static_cast<float>(v - (4.0 / 27) * v * v * v);
        }
        case 4: { // TUBE : les harmoniques paires (une triode), son continu retire ensuite
            const double v = clampd(4.0 * u, -16, 16);
            return static_cast<float>(std::tanh(v + 0.3 * v * std::fabs(v)));
        }
        case 5: { // PENT : un coude dur (une pentode), les harmoniques impaires
            const double v = clampd(8.0 * u, -64, 64);
            return static_cast<float>(v / std::pow(1 + std::pow(std::fabs(v), 6.0), 1 / 6.0));
        }
        default: // MM : la DIST d'avant
            return static_cast<float>(std::tanh(8 * clampd(u, -1, 1)));
    }
}
void FxChain::Dist::process(float* L, float* R, int n) {
    if (d <= 0) return;
    if (plain) {
        for (int i = 0; i < n; ++i) {
            float sl = static_cast<float>(std::tanh(8 * clampd(pre * L[i], -1, 1)));
            float sr = static_cast<float>(std::tanh(8 * clampd(pre * R[i], -1, 1)));
            if (lpOn) {
                sl = lp.run(0, sl);
                sr = lp.run(1, sr);
            }
            L[i] = static_cast<float>(dry * L[i] + wet * sl);
            R[i] = static_cast<float>(dry * R[i] + wet * sr);
        }
        return;
    }
    const double pg = pre * (X.punish > 0 ? 10 : 1);
    // AUTO : l'energie d'entree et de sortie (300 ms, ke), le gain qui les egalise, lisse
    for (int i = 0; i < n; ++i) {
        double y[2];
        const float in[2] = {L[i], R[i]};
        for (int c = 0; c < 2; ++c) {
            double u = in[c];
            if (lowOn) u = lowCut.run(c, static_cast<float>(u));
            if (tiltOn) u = highSh.run(c, lowSh.run(c, static_cast<float>(u)));
            float sh = shape(static_cast<float>(pg * u));
            if (X.style == 4) sh = dc.run(c, sh);
            if (lpOn) {
                sh = lp.run(c, sh);
                if (X.steep) sh = lp3.run(c, lp2.run(c, sh));
            }
            y[c] = dry * in[c] + wet * sh;
        }
        if (X.autoG) {
            envIn += ke * ((in[0] * in[0] + in[1] * in[1]) * 0.5 - envIn);
            envOut += ke * ((y[0] * y[0] + y[1] * y[1]) * 0.5 - envOut);
            const double want = envOut > 1e-12 ? clampd(std::sqrt(envIn / envOut), 0.1, 2.0) : 1.0;
            autoK += (want - autoK) * 0.001;
            y[0] *= autoK;
            y[1] *= autoK;
        }
        L[i] = static_cast<float>(((1 - X.mix) * in[0] + X.mix * y[0]) * outG);
        R[i] = static_cast<float>(((1 - X.mix) * in[1] + X.mix * y[1]) * outG);
    }
}

// CHORUS (chorus.ts, chorus.worklet.js 'bus') : deux voix modulees, lues avec la table sinc, en croix gauche / droite
void FxChain::Chorus::prepare(double sr) {
    const int n = static_cast<int>(std::ceil(0.06 * sr)) + 8;
    bl.assign(static_cast<size_t>(n), 0.f);
    br.assign(static_cast<size_t>(n), 0.f);
    w = 0;
    ph[0] = ph[1] = 0;
    ks = 1 - std::exp(-1 / (0.02 * sr));
}
void FxChain::Chorus::set(double amount, double mulV, double depthS) {
    t = clampd(amount, 0, 1);
    mul = mulV;
    depth = depthS;
    const double d = 1 - 0.5 * t, ww = LINE_W * t, kk = 1 / std::sqrt(d * d + 1.16 * ww * ww);
    dry = kk * d;
    wet = kk * ww;
}
void FxChain::Chorus::process(float* L, float* R, int n, double sr) {
    if (t <= 0 || bl.empty()) return;
    const auto& T = sincTable();
    const int N = static_cast<int>(bl.size());
    static const double DEL[2] = {0.014, 0.021}, RATE[2] = {0.53, 0.71};
    const double cA = 0.9723699203976766, cB = 0.2334453638559054; // cos et sin de 0.075 pi
    for (int i = 0; i < n; ++i) {
        const float inL = L[i], inR = R[i];
        bl[static_cast<size_t>(w)] = inL;
        br[static_cast<size_t>(w)] = inR;
        smDepth += (depth - smDepth) * ks;
        smMul += (mul - smMul) * ks;
        double outL = 0, outR = 0;
        for (int v = 0; v < 2; ++v) {
            const double dd = std::max(8.0, (DEL[v] + std::sin(2 * PI * ph[v]) * smDepth) * sr);
            ph[v] += RATE[v] * smMul / sr;
            if (ph[v] >= 1) ph[v] -= 1;
            const std::vector<float>& b = v == 0 ? bl : br;
            double pos = w - dd;
            while (pos < 0) pos += N;
            const double fi = std::floor(pos);
            const int ii = static_cast<int>(fi);
            const double fp = (pos - fi) * 512;
            const int p0 = std::min(511, static_cast<int>(std::floor(fp)));
            const double tt = fp - p0;
            double y0 = 0, y1 = 0;
            for (int k = 0; k < 16; ++k) {
                int j = ii - 7 + k;
                j %= N;
                if (j < 0) j += N;
                const double s = b[static_cast<size_t>(j)];
                y0 += T[static_cast<size_t>(p0 * 16 + k)] * s;
                y1 += T[static_cast<size_t>((p0 + 1) * 16 + k)] * s;
            }
            const double y = y0 + tt * (y1 - y0);
            outL += y * (v == 0 ? cA : cB);
            outR += y * (v == 0 ? cB : cA);
        }
        w = (w + 1) % N;
        L[i] = static_cast<float>(dry * inL + wet * outL);
        R[i] = static_cast<float>(dry * inR + wet * outR);
    }
}

// DELAY (sends.ts) : sum = in + fb y ; y = HP 180 ( LP dtone ( retard (sum) ) )
void FxChain::DelayUnit::prepare(double sr) {
    const int n = static_cast<int>(std::ceil(2.1 * sr)) + 4;
    bl.assign(static_cast<size_t>(n), 0.f);
    br.assign(static_cast<size_t>(n), 0.f);
    w = 0;
    lp.clear();
    hp.clear();
    hp.highpass(180, sr);
}
void FxChain::DelayUnit::process(const float* inL, const float* inR, float* outL, float* outR, int n, double sr) {
    const int N = static_cast<int>(bl.size());
    const double dS = std::max(1.0, time * sr);
    for (int i = 0; i < n; ++i) {
        double pos = w - dS;
        while (pos < 0) pos += N;
        const int i0 = static_cast<int>(pos);
        const int i1 = (i0 + 1) % N;
        const double f = pos - i0;
        const float rl = static_cast<float>(bl[static_cast<size_t>(i0)] * (1 - f) + bl[static_cast<size_t>(i1)] * f);
        const float rr = static_cast<float>(br[static_cast<size_t>(i0)] * (1 - f) + br[static_cast<size_t>(i1)] * f);
        const float yl = hp.run(0, lp.run(0, rl));
        const float yr = hp.run(1, lp.run(1, rr));
        outL[i] = yl;
        outR[i] = yr;
        bl[static_cast<size_t>(w)] = static_cast<float>(inL[i] + fb * yl);
        br[static_cast<size_t>(w)] = static_cast<float>(inR[i] + fb * yr);
        w = (w + 1) % N;
    }
}

// La convolution par blocs (la REVERB : ConvolverNode du site, ici avec un bloc de latence)
// Tout est alloue ici, pour la plus longue reponse possible (10 s + 0.25 s de pre-delai) : attach() n'alloue rien
void FxChain::Convolver::prepare(double sr) {
    const int maxParts = static_cast<int>(std::ceil(10.3 * sr / ReverbIR::B)) + 2;
    for (int c = 0; c < 2; ++c) {
        inBuf[static_cast<size_t>(c)].assign(ReverbIR::N, 0.f);
        outBlock[static_cast<size_t>(c)].assign(ReverbIR::B, 0.f);
        fdl[static_cast<size_t>(c)].assign(static_cast<size_t>(maxParts * (ReverbIR::N / 2 + 1)), {0, 0});
    }
    tmp.assign(ReverbIR::N, {0, 0});
    acc.assign(ReverbIR::N, {0, 0});
    ir = nullptr;
    fill = 0;
    head = 0;
    idle = 1 << 20;
}

void FxChain::Convolver::attach(const ReverbIR* r) {
    // Une reponse plus longue que la place (une autre frequence) : on la garde pour le prochain prepare()
    if (r && static_cast<size_t>(r->parts * (ReverbIR::N / 2 + 1)) > fdl[0].size()) r = nullptr;
    ir = r;
    for (int c = 0; c < 2; ++c) {
        std::fill(inBuf[static_cast<size_t>(c)].begin(), inBuf[static_cast<size_t>(c)].end(), 0.f);
        std::fill(outBlock[static_cast<size_t>(c)].begin(), outBlock[static_cast<size_t>(c)].end(), 0.f);
        if (r) std::fill(fdl[static_cast<size_t>(c)].begin(), fdl[static_cast<size_t>(c)].begin() + r->parts * (ReverbIR::N / 2 + 1), std::complex<float>(0, 0));
    }
    fill = 0;
    head = 0;
    idle = 1 << 20;
}
void FxChain::Convolver::block() {
    constexpr int B = ReverbIR::B, N = ReverbIR::N, K = N / 2 + 1;
    const int parts = ir->parts;
    bool silent = true;
    for (int c = 0; c < 2 && silent; ++c)
        for (int i = B; i < N; ++i)
            if (inBuf[static_cast<size_t>(c)][static_cast<size_t>(i)] != 0) {
                silent = false;
                break;
            }
    idle = silent ? idle + 1 : 0;
    head = (head + 1) % parts;
    for (int c = 0; c < 2; ++c) {
        auto& in = inBuf[static_cast<size_t>(c)];
        auto& F = fdl[static_cast<size_t>(c)];
        auto& out = outBlock[static_cast<size_t>(c)];
        if (idle > parts + 1) {
            // Rien depuis plus que la longueur de la reponse : la queue est finie
            std::fill(F.begin() + head * K, F.begin() + (head + 1) * K, std::complex<float>(0, 0));
            std::fill(out.begin(), out.end(), 0.f);
        } else {
            for (int i = 0; i < N; ++i) tmp[static_cast<size_t>(i)] = in[static_cast<size_t>(i)];
            fft().run(tmp.data(), false);
            for (int k = 0; k < K; ++k) F[static_cast<size_t>(head * K + k)] = tmp[static_cast<size_t>(k)];
            const auto& H = ir->H[static_cast<size_t>(c)];
            std::fill(acc.begin(), acc.end(), std::complex<float>(0, 0));
            for (int p = 0; p < parts; ++p) {
                const int slot = ((head - p) % parts + parts) % parts;
                const std::complex<float>* x = &F[static_cast<size_t>(slot * K)];
                const std::complex<float>* h = &H[static_cast<size_t>(p * K)];
                for (int k = 0; k < K; ++k) acc[static_cast<size_t>(k)] += x[k] * h[k];
            }
            for (int k = 1; k < N / 2; ++k) acc[static_cast<size_t>(N - k)] = std::conj(acc[static_cast<size_t>(k)]);
            fft().run(acc.data(), true);
            for (int i = 0; i < B; ++i) out[static_cast<size_t>(i)] = acc[static_cast<size_t>(B + i)].real();
        }
        // la moitie recente devient l'ancienne
        std::memmove(in.data(), in.data() + B, sizeof(float) * B);
    }
}
void FxChain::Convolver::process(const float* inL, const float* inR, float* outL, float* outR, int n) {
    if (!ir) {
        std::memset(outL, 0, sizeof(float) * static_cast<size_t>(n));
        std::memset(outR, 0, sizeof(float) * static_cast<size_t>(n));
        return;
    }
    constexpr int B = ReverbIR::B;
    for (int i = 0; i < n; ++i) {
        outL[i] = outBlock[0][static_cast<size_t>(fill)];
        outR[i] = outBlock[1][static_cast<size_t>(fill)];
        inBuf[0][static_cast<size_t>(B + fill)] = inL[i];
        inBuf[1][static_cast<size_t>(B + fill)] = inR[i];
        if (++fill == B) {
            block();
            fill = 0;
        }
    }
}

// GLUE (glue.worklet.js) : BIT (repli d'echantillonnage et de bits) puis COMP (detecteur crete et RMS, genou, AUTO)
void FxChain::Glue::process(float* L, float* R, int n, const GlobalFx& g, double sr) {
    const double bits = clampd(g.bits, 0, 1), comp = clampd(g.comp, 0, 1);
    if (bits <= 0 && comp <= 0 && mixB < 1e-4 && mixC < 1e-4) {
        mixB = mixC = 0;
        return; // l'identite exacte
    }
    static const double RATIOS[8] = {1, 1.5, 2, 3, 4, 6, 10, 20};
    static const double HPF[3] = {0, 60, 120};
    const double thr = -40 * clampd(g.cthr, 0, 1);
    const double ratio = RATIOS[static_cast<int>(clampd(jsRound(clampd(g.cratio, 0, 1) * 7), 0, 7))];
    const double knee = 12 * clampd(g.cknee, 0, 1);
    const double atkS = 0.0001 * std::pow(500.0, clampd(g.catk, 0, 1));
    const bool autoRel = g.crel >= 0.996;
    const double relS = 0.02 * std::pow(40.0, clampd(g.crel, 0, 1));
    const bool autoMake = g.cmake <= 0.004;
    const double make = autoMake ? std::min(18.0, (1 - 1 / ratio) * 3.6 * std::log(1 + std::exp((-12.5 - thr) / 3.6))) : -6 + 24 * clampd(g.cmake, 0, 1);
    const double hpf = HPF[static_cast<int>(clampd(jsRound(clampd(g.chpf, 0, 1) * 2), 0, 2))];
    const double kg = 1 - std::exp(-1 / (0.01 * sr)), kp = 1 - std::exp(-1 / (0.02 * sr)), kr = 1 - std::exp(-1 / (0.008 * sr));
    const double pkRel = std::exp(-1 / (0.01 * sr)), atk = std::exp(-1 / (atkS * sr)), rel = std::exp(-1 / (relS * sr));
    const double fast = std::exp(-1 / (0.06 * sr)), slowA = std::exp(-1 / (3 * sr)), slowR = std::exp(-1 / (1.2 * sr));
    const double slope = 1 - 1 / ratio;
    if (first) {
        thrS = thr;
        slopeS = slope;
        kneeS = knee;
        makeS = make;
        first = false;
    }
    const int fac = FxLaws::bitRate(g.brate);
    const double q = std::pow(2.0, 15 - 12 * bits);
    // le passe-haut du detecteur (forme directe I)
    double hb0 = 1, hb1 = 0, hb2 = 0, ha1 = 0, ha2 = 0;
    if (hpf > 0) {
        const double w = 2 * PI * hpf / sr, cw = std::cos(w), al = std::sin(w) / std::sqrt(2.0), a0 = 1 + al;
        hb0 = (1 + cw) / 2 / a0; hb1 = -(1 + cw) / a0; hb2 = hb0; ha1 = -2 * cw / a0; ha2 = (1 - al) / a0;
    }
    for (int i = 0; i < n; ++i) {
        mixB += ((bits > 0 ? 1.0 : 0.0) - mixB) * kg;
        mixC += (comp - mixC) * kg;
        double xs[2] = {L[i], R[i]};
        if (mixB > 1e-4) {
            if (++ph >= fac) {
                ph = 0;
                hold[0] = jsRound(xs[0] * q) / q;
                hold[1] = jsRound(xs[1] * q) / q;
            }
            xs[0] += (hold[0] - xs[0]) * mixB;
            xs[1] += (hold[1] - xs[1]) * mixB;
        }
        if (mixC > 1e-4) {
            thrS += (thr - thrS) * kp;
            slopeS += (slope - slopeS) * kp;
            kneeS += (knee - kneeS) * kp;
            makeS += (make - makeS) * kp;
            double sc[2] = {xs[0], xs[1]};
            if (hpf > 0)
                for (int c = 0; c < 2; ++c) {
                    const double y = hb0 * sc[c] + hb1 * hx1[c] + hb2 * hx2[c] - ha1 * hy1[c] - ha2 * hy2[c];
                    hx2[c] = hx1[c]; hx1[c] = sc[c]; hy2[c] = hy1[c]; hy1[c] = y;
                    sc[c] = y;
                }
            const double e = std::max(std::fabs(sc[0]), std::fabs(sc[1]));
            ms += (e * e - ms) * kr;
            pk = e > pk ? e : pk * pkRel;
            const double lv = 8.685889638 * (0.75 * std::log(pk + 1e-15) + 0.125 * std::log(2 * ms + 1e-30));
            const double o = lv - thrS;
            const double W = kneeS;
            double t;
            if (W > 0.01 && std::fabs(2 * o) < W) t = slopeS * (o + W / 2) * (o + W / 2) / (2 * W);
            else t = o > 0 ? slopeS * o : 0;
            if (autoRel) {
                gr = t > gr ? atk * gr + (1 - atk) * t : fast * gr + (1 - fast) * t;
                slow = t > slow ? slowA * slow + (1 - slowA) * t : slowR * slow + (1 - slowR) * t;
                gr = std::max(gr, slow);
            } else {
                gr = t > gr ? atk * gr + (1 - atk) * t : rel * gr + (1 - rel) * t;
                slow = gr;
            }
            const double gm = 1 + (std::exp((makeS - gr) * 0.115129255) - 1) * mixC;
            xs[0] *= gm;
            xs[1] *= gm;
        } else if (gr != 0 || ms != 0) {
            gr = slow = ms = pk = 0;
            for (int c = 0; c < 2; ++c) hx1[c] = hx2[c] = hy1[c] = hy2[c] = 0;
        }
        L[i] = std::isfinite(xs[0]) ? static_cast<float>(xs[0]) : 0.f;
        R[i] = std::isfinite(xs[1]) ? static_cast<float>(xs[1]) : 0.f;
    }
    if (ms < 1e-15) ms = 0;
    if (pk < 1e-15) pk = 0;
    if (gr < 1e-9) gr = 0;
    if (slow < 1e-9) slow = 0;
}

// LIMITEUR (limiter.worklet.js) : plafond -0.3 dB, 3 ms d'avance, relachement 120 ms, gain lisse en boite
void FxChain::Limiter::prepare(double sr) {
    Lw = std::max(2, static_cast<int>(jsRound(0.003 * sr)));
    rel = 1 - std::exp(-1 / (0.12 * sr));
    ringL.assign(static_cast<size_t>(Lw), 0.f);
    ringR.assign(static_cast<size_t>(Lw), 0.f);
    reqs.assign(static_cast<size_t>(Lw), 1.0);
    box.assign(static_cast<size_t>(Lw), 1.0);
    boxSum = Lw;
    idx = boxIdx = 0;
    g = 1;
}
void FxChain::Limiter::process(float* L, float* R, int n) {
    const double CEIL = std::pow(10.0, -0.3 / 20);
    for (int i = 0; i < n; ++i) {
        const double peak = std::max(std::fabs(static_cast<double>(L[i])), std::fabs(static_cast<double>(R[i])));
        const double req = peak > CEIL ? CEIL / peak : 1;
        reqs[static_cast<size_t>(boxIdx)] = req;
        double target = 1;
        for (double r : reqs) target = std::min(target, r);
        g = target < g ? target : g + (target - g) * rel;
        boxSum += g - box[static_cast<size_t>(boxIdx)];
        box[static_cast<size_t>(boxIdx)] = g;
        boxIdx = (boxIdx + 1) % Lw;
        const double gain = boxSum / Lw;
        const int rd = (idx + 1) % Lw;
        const float dl = ringL[static_cast<size_t>(rd)], dr = ringR[static_cast<size_t>(rd)];
        ringL[static_cast<size_t>(idx)] = L[i];
        ringR[static_cast<size_t>(idx)] = R[i];
        idx = rd;
        const double ol = clampd(dl * gain, -CEIL, CEIL), orr = clampd(dr * gain, -CEIL, CEIL);
        L[i] = std::isfinite(ol) ? static_cast<float>(ol) : 0.f;
        R[i] = std::isfinite(orr) ? static_cast<float>(orr) : 0.f;
    }
    double s = 0;
    for (double b : box) s += b;
    boxSum = s;
}

/* ---------------- HELL (2026-11-13) ---------------- */

// Le decaleur : la chaine A (un echantillon plus tard) donne la voie en phase, la chaine B la voie a 90 degres
void FxChain::Hell::Hilbert::run(double x, double& i, double& q) {
    double a = x, b = x;
    for (int k = 0; k < 4; ++k) {
        const double ca = HIL_A[k] * HIL_A[k];
        const double ya = ca * (a + ys[0][k][1]) - xs[0][k][1];
        xs[0][k][1] = xs[0][k][0];
        xs[0][k][0] = a;
        ys[0][k][1] = ys[0][k][0];
        ys[0][k][0] = ya;
        a = ya;
        const double cb = HIL_B[k] * HIL_B[k];
        const double yb = cb * (b + ys[1][k][1]) - xs[1][k][1];
        xs[1][k][1] = xs[1][k][0];
        xs[1][k][0] = b;
        ys[1][k][1] = ys[1][k][0];
        ys[1][k][0] = yb;
        b = yb;
    }
    // La voie A retardee d'un echantillon, la voie B telle quelle : 90 degres a ~49 dB de rejet de l'autre bande (mesure)
    i = qd;
    qd = a;
    q = b;
}
void FxChain::Hell::Hilbert::clear() {
    for (auto& p : xs)
        for (auto& k : p) k[0] = k[1] = 0;
    for (auto& p : ys)
        for (auto& k : p) k[0] = k[1] = 0;
    qd = 0;
}

void FxChain::Hell::prepare(double sr) {
    len = static_cast<int>(std::ceil((HELL_MAX_S + 0.05) * sr)) + 8;
    for (auto& b : buf) b.assign(static_cast<size_t>(len), 0.f);
    w = 0;
    for (auto& h : hil) h.clear();
    for (int c = 0; c < 2; ++c) {
        for (int k = 0; k < 4; ++k) {
            const int d = std::max(1, static_cast<int>(std::lround((c == 0 ? SMEAR_L[k] : SMEAR_R[k]) * sr / 48000)));
            ap[static_cast<size_t>(c)][static_cast<size_t>(k)].b.assign(static_cast<size_t>(d), 0.f);
            ap[static_cast<size_t>(c)][static_cast<size_t>(k)].w = 0;
        }
        z[c] = dcx[c] = dcy[c] = 0;
        th[c] = 0;
    }
    lp[0].clear();
    anti[0].clear();
    lfoPh = 0;
    fNow = fbNow = 0;
    dNow = -1;
    filtFor = antiFor = -1;
    quiet = 0;
    idle = true;
}

void FxChain::Hell::set(const GlobalFx& g, double bpm, double sr) {
    (void)sr;
    const long range = std::max(0L, std::min(2L, std::lround(clampd(g.hrange, 0, 1) * 2)));
    shiftSync = range == 2;
    fTo = FxLaws::hellShiftHz(static_cast<double>(range), g.hfreq, bpm);
    syncCycleQ = shiftSync && fTo != 0 ? std::max(1.0, bpm) / 60 / std::fabs(fTo) : 0;
    dTo = FxLaws::hellSeconds(g.htime, g.hsync >= 0.5, bpm);
    fbTo = 0.98 * clampd(g.hfb, 0, 1);
    side = clampd(g.hside, 0, 1);
    phase = clampd(g.hphase, 0, 1);
    antiK = clampd(g.hanti, 0, 1);
    filtHz = FxLaws::hellFilterHz(g.hfilt);
    smear = clampd(g.hsmear, 0, 1);
    cross = g.hcross >= 0.5;
    stereo = g.hstereo >= 0.5;
    lfoTarget = static_cast<int>(std::max(0L, std::min(3L, std::lround(clampd(g.hlfo, 0, 1) * 3))));
    lfoSync = g.hlsync >= 0.5;
    lfoHz = FxLaws::hellRateHz(g.hrate, lfoSync, bpm);
    lfoCycleQ = lfoSync && lfoHz > 0 ? std::max(1.0, bpm) / 60 / lfoHz : 0;
    lfoAmt = clampd(g.hamt, 0, 1);
    lfoMax = range == 1 ? 2000 : range == 2 ? std::max(1.0, std::fabs(fTo)) : 200;
}

void FxChain::Hell::process(const float* inL, const float* inR, float* outL, float* outR, int n, double sr, double ppq, double pps, bool playing) {
    bool any = false;
    for (int i = 0; i < n && !any; ++i) any = inL[i] != 0.f || inR[i] != 0.f;
    // Au repos (rien n'entre, la boucle s'est tue) : rien a calculer
    if (!any && idle) {
        std::memset(outL, 0, sizeof(float) * static_cast<size_t>(n));
        std::memset(outR, 0, sizeof(float) * static_cast<size_t>(n));
        return;
    }
    if (any) {
        idle = false;
        quiet = 0;
    }
    // FILTER (le passe-bas avant le decalage) et ANTI (le passe-haut qui garde la bande du bas au-dessus de 0 Hz)
    const double fHz = std::min(filtHz, sr * 0.45);
    if (std::fabs(fHz - filtFor) > 0.5) {
        lp[0].lowpass(fHz, sr);
        filtFor = fHz;
    }
    const double aHz = antiK * (std::fabs(fTo) + (lfoTarget == 1 ? lfoAmt * lfoMax : 0));
    const bool antiOn = aHz >= 20;
    if (antiOn && std::fabs(aHz - antiFor) > 0.01 * aHz) {
        anti[0].highpass(std::min(aHz, sr * 0.45), sr);
        antiFor = aHz;
    }
    const double kf = 1 - std::exp(-1 / (0.02 * sr));
    const double kd = 1 - std::exp(-1 / (0.05 * sr));
    if (dNow < 0) dNow = dTo * sr;
    const double dc = 1 - 2 * PI * 10 / sr;
    const float g = 0.62f;
    double peak = 0;
    for (int i = 0; i < n; ++i) {
        // Le LFO (un sinus) : cale sur la mesure en lecture, libre sinon
        double lfo = 0;
        if (lfoTarget > 0 && lfoAmt > 0) {
            double ph;
            if (lfoSync && playing && lfoCycleQ > 0) {
                ph = std::fmod(std::max(0.0, ppq + i * pps) / lfoCycleQ, 1.0);
            } else {
                lfoPh += lfoHz / sr;
                lfoPh -= std::floor(lfoPh);
                ph = lfoPh;
            }
            lfo = std::sin(2 * PI * ph);
        }
        fNow += (fTo - fNow) * kf;
        fbNow += (fbTo - fbNow) * kf;
        dNow += (dTo * sr - dNow) * kd;
        double y[2];
        for (int c = 0; c < 2; ++c) {
            const double l = c == 1 && stereo ? -lfo : lfo;
            // La phase du decaleur : calee sur la mesure en RANGE SYNC (le meme tour a chaque lecture), libre sinon
            if (shiftSync && playing && syncCycleQ > 0) {
                const double t = std::fmod(std::max(0.0, ppq + i * pps) / syncCycleQ, 1.0);
                th[c] = fTo < 0 ? -t : t;
            } else {
                const double f = fNow + (lfoTarget == 1 ? lfoAmt * lfoMax * l : 0);
                th[c] += f / sr;
                th[c] -= std::floor(th[c]);
            }
            double dS = dNow;
            if (lfoTarget == 3) dS *= 1 + 0.9 * lfoAmt * l;
            dS = clampd(dS, 2, len - 4);
            // La lecture du delay (Hermite, 4 points)
            double rp = w - dS;
            while (rp < 0) rp += len;
            const int i1 = static_cast<int>(rp);
            const double fr = rp - i1;
            const auto& b = buf[static_cast<size_t>(c)];
            const double x0 = b[static_cast<size_t>((i1 - 1 + len) % len)], x1 = b[static_cast<size_t>(i1)];
            const double x2 = b[static_cast<size_t>((i1 + 1) % len)], x3 = b[static_cast<size_t>((i1 + 2) % len)];
            const double c1 = 0.5 * (x2 - x0), c2 = x0 - 2.5 * x1 + 2 * x2 - 0.5 * x3, c3 = 0.5 * (x3 - x0) + 1.5 * (x1 - x2);
            double v = ((c3 * fr + c2) * fr + c1) * fr + x1;
            v = lp[0].run(c, static_cast<float>(v));
            if (antiOn) v = anti[0].run(c, static_cast<float>(v));
            double I, Q;
            hil[static_cast<size_t>(c)].run(v, I, Q);
            double ph = th[c] + phase + (lfoTarget == 2 ? 0.5 * lfoAmt * l : 0);
            const double a = 2 * PI * ph, cs = std::cos(a), sn = std::sin(a);
            const double up = I * cs + Q * sn, dn = I * cs - Q * sn;
            double o = side * up + (1 - side) * dn;
            if (smear > 0) {
                float s2 = static_cast<float>(o);
                for (auto& u : ap[static_cast<size_t>(c)]) s2 = u.run(s2, g);
                o += smear * (s2 - o);
            }
            // Le continu retire (10 Hz)
            const double yo = o - dcx[c] + dc * dcy[c];
            dcx[c] = o;
            dcy[c] = yo;
            y[c] = clampd(yo, -8, 8);
        }
        // CROSS : gauche et droite echangees, a la sortie et dans la boucle
        const double zl = cross ? y[1] : y[0], zr = cross ? y[0] : y[1];
        outL[i] = static_cast<float>(zl);
        outR[i] = static_cast<float>(zr);
        // L'entree plus le retour (adouci : la boucle ne s'emballe jamais)
        buf[0][static_cast<size_t>(w)] = static_cast<float>(inL[i] + std::tanh(fbNow * zl));
        buf[1][static_cast<size_t>(w)] = static_cast<float>(inR[i] + std::tanh(fbNow * zr));
        if (++w >= len) w = 0;
        peak = std::max(peak, std::max(std::fabs(zl), std::fabs(zr)));
    }
    // Le repos : plus rien n'entre et la sortie est restee muette plus longtemps que le delay
    if (any || peak >= 1e-6) quiet = 0;
    else quiet += n;
    if (!any && quiet > static_cast<long>(dNow + 0.2 * sr)) idle = true;
}

void FxChain::hellOnly(const float* inL, const float* inR, float* outL, float* outR, int n) {
    hell_.process(inL, inR, outL, outR, n, sr_, perfPpq_, perfPps_, perfPlaying_);
}
void FxChain::distOnly(double amount, float* L, float* R, int n) {
    Dist d;
    d.setX(distX_, sr_);
    d.set(amount, FxLaws::xtoneHz(g_.xtone), sr_);
    d.process(L, R, n);
}

/* ---------------- la chaine ---------------- */

void FxChain::prepare(double sr) {
    sr_ = sr;
    for (int t = 0; t < kTracks; ++t) {
        tl_[static_cast<size_t>(t)].assign(kMaxBlock, 0.f);
        tr_[static_cast<size_t>(t)].assign(kMaxBlock, 0.f);
        sChorus_[static_cast<size_t>(t)].prepare(sr);
        sTone_[static_cast<size_t>(t)] = Tone{};
        sDist_[static_cast<size_t>(t)] = Dist{};
        sDist_[static_cast<size_t>(t)].setX(distX_, sr);
    }
    padsChorus_.prepare(sr);
    padsTone_ = Tone{};
    kickTone_ = Tone{};
    padsDist_ = Dist{};
    kickDist_ = Dist{};
    padsDist_.setX(distX_, sr);
    kickDist_.setX(distX_, sr);
    delay_.prepare(sr);
    hell_.prepare(sr);
    reverb_.prepare(sr);
    glue_ = Glue{};
    limiter_.prepare(sr);
    for (auto* v : {&padsL_, &padsR_, &kickL_, &kickR_, &revL_, &revR_, &delL_, &delR_, &wetL_, &wetR_, &mL_, &mR_, &hellL_, &hellR_}) v->assign(kMaxBlock, 0.f);
    tail_.fill(0);
    perfFx_.prepare(sr);
    cutG_.fill(1.f);
    throwD_ = throwR_ = 0;
    sideNow_ = 0;
    duck_.assign(kMaxBlock, 1.f);
    perf_ = PerfState{};
}

void FxChain::setPerf(const PerfState& p, double ppq, double ppqPerSample, bool playing) {
    perf_ = p;
    perfPpq_ = ppq;
    perfPps_ = ppqPerSample;
    perfPlaying_ = playing;
}

/* ---------------- PERFORM : le master du live (2026-11-12) ---------------- */

namespace {
// Le beat repeat : la longueur de la boucle en noires (1/4, 1/8, 1/16, 1/32)
constexpr double REPEAT_PPQ[5] = {0, 1, 0.5, 0.25, 0.125};
constexpr double PERF_RING_S = 4.0;   // le tampon du mix
constexpr double PERF_EDGE_S = 0.0015; // le fondu aux bords d'une boucle
constexpr double PERF_XF_S = 0.004;   // vers la boucle ou la bande, et retour
constexpr double TAPE_S = 0.7;        // le tape stop : de la vitesse 1 a l'arret
constexpr double LOW_CUT_HZ = 200;
constexpr double CUT_S = 0.004;       // une piste coupee ou rendue
constexpr double THROW_S = 0.012;     // un envoi jete, ou repris
constexpr double FILTER_Q = 0.9;
} // namespace

void FxChain::Perf::prepare(double sr) {
    const size_t n = static_cast<size_t>(PERF_RING_S * sr) + 8;
    rl.assign(n, 0.f);
    rr.assign(n, 0.f);
    w = 0;
    rDiv = 0;
    rStart = 0;
    rLen = rK = rMix = 0;
    oStart = 0;
    oLen = oK = oMix = 0;
    tOn = false;
    tPos = 0;
    tRate = 1;
    tMix = 0;
    lo1 = Bq{};
    lo2 = Bq{};
    lo1.highpass(LOW_CUT_HZ, sr);
    lo2.highpass(LOW_CUT_HZ, sr);
    gLow = 1;
    fNow = 0;
    fSide = 0;
    fWet = 0;
    f1 = Bq{};
    f2 = Bq{};
    fTick = 0;
}

// L'ordre : le beat repeat et le tape stop (sur le mix entier, ses retours compris), le low cut, le filtre DJ ; le GLUE et le
// LIMITEUR viennent apres. Sans geste, le signal passe tel quel (a l'echantillon pres).
void FxChain::Perf::process(float* L, float* R, int n, const PerfState& p, double ppq, double pps, bool playing, double sr) {
    const long N = static_cast<long>(rl.size());
    const double xfStep = 1.0 / std::max(1.0, PERF_XF_S * sr);
    const double edge = std::max(1.0, PERF_EDGE_S * sr);
    // Un autre repeat (ou aucun) : la boucle repart de la derniere frontiere de la grille, a cet echantillon
    const int want = playing && pps > 0 && p.repeat >= 1 && p.repeat <= 4 ? p.repeat : 0;
    if (want != rDiv) {
        rDiv = want;
        // La boucle qui jouait s'efface pendant que la nouvelle entre (pas de saut)
        if (rMix > 0 && rLen > 0) {
            oStart = rStart;
            oLen = rLen;
            oK = rK;
            oMix = want ? rMix : 0;
        }
        if (want) {
            const double div = REPEAT_PPQ[want];
            const double ph = std::fmod(std::max(0.0, ppq), div);
            const long since = static_cast<long>(std::floor(ph / pps + 0.5));
            rLen = std::max(16.0, div / pps);
            rK = static_cast<double>(std::min<long>(since, static_cast<long>(rLen) - 1));
            rStart = ((w - static_cast<long>(rK)) % N + N) % N;
        }
    }
    // Le tape stop : il part de la tete d'ecriture
    if (p.tape && !tOn) {
        tOn = true;
        tPos = static_cast<double>(w);
        tRate = 1;
    } else if (!p.tape && tOn && tMix <= 0) {
        tOn = false;
    }
    const double tStep = 1.0 / std::max(1.0, TAPE_S * sr);
    const bool any = rDiv || rMix > 0 || oMix > 0 || tOn || tMix > 0;
    // Un echantillon d'une boucle (start, len, k) avec ses bords adoucis
    auto loopAt = [&](long start, double len, double k, double& bL, double& bR) {
        const double kk = std::fmod(k, len);
        const long idx = (start + static_cast<long>(kk)) % N;
        double g = 1;
        if (k >= len - edge && kk >= len - edge) g = (len - kk) / edge;
        if (k >= len && kk < edge) g = std::min(g, kk / edge);
        bL = rl[static_cast<size_t>(idx)] * g;
        bR = rr[static_cast<size_t>(idx)] * g;
    };
    for (int i = 0; i < n; ++i) {
        rl[static_cast<size_t>(w)] = L[i];
        rr[static_cast<size_t>(w)] = R[i];
        if (any) {
            double oL = L[i], oR = R[i];
            // Le beat repeat : la boucle (le premier tour, c'est le direct : il s'ecrit pendant qu'on le lit)
            const double rTo = rDiv ? 1 : 0;
            if (rMix != rTo) rMix = rTo > rMix ? std::min(1.0, rMix + xfStep) : std::max(0.0, rMix - xfStep);
            if (rMix > 0 && rLen > 0) {
                double bL, bR;
                loopAt(rStart, rLen, rK, bL, bR);
                // La boucle d'avant, en fondu
                if (oMix > 0 && oLen > 0) {
                    double cL, cR;
                    loopAt(oStart, oLen, oK, cL, cR);
                    bL = bL + (cL - bL) * oMix;
                    bR = bR + (cR - bR) * oMix;
                    oK += 1;
                    oMix = std::max(0.0, oMix - xfStep);
                }
                oL = oL + (bL - oL) * rMix;
                oR = oR + (bR - oR) * rMix;
                // La boucle avance aussi pendant son fondu de sortie (relachee, elle ne s'arrete pas sur un echantillon)
                rK += 1;
            } else
                oMix = 0;
            // Le tape stop : la bande ralentit (lecture interpolee), puis se tait ; relache, le direct revient
            const double tTo = tOn && p.tape ? 1 : 0;
            if (tMix != tTo) tMix = tTo > tMix ? std::min(1.0, tMix + xfStep) : std::max(0.0, tMix - xfStep);
            if (tMix > 0) {
                const long i0 = static_cast<long>(std::floor(tPos));
                const double fr = tPos - static_cast<double>(i0);
                const size_t a = static_cast<size_t>((i0 % N + N) % N), b = static_cast<size_t>(((i0 + 1) % N + N) % N);
                const double amp = std::min(1.0, tRate * 8); // la fin de la bande se tait
                const double bL = (rl[a] + (rl[b] - rl[a]) * fr) * amp, bR = (rr[a] + (rr[b] - rr[a]) * fr) * amp;
                oL = oL + (bL - oL) * tMix;
                oR = oR + (bR - oR) * tMix;
                // La bande avance encore pendant son fondu de sortie ; elle ne ralentit que tenue
                tPos += tRate;
                if (p.tape) tRate = std::max(0.0, tRate - tStep);
            }
            L[i] = static_cast<float>(oL);
            R[i] = static_cast<float>(oR);
        }
        w = (w + 1) % static_cast<int>(N);
    }
    // Le low cut : le mix passe par un passe-haut (24 dB a 200 Hz), a la part (1 - gLow) ; gLow glisse en 12 ms ; au repos
    // le direct tel quel
    const double lowTo = p.lowCut ? 0 : 1;
    const double lowStep = 1.0 / std::max(1.0, THROW_S * sr);
    if (gLow != lowTo || p.lowCut)
        for (int i = 0; i < n; ++i) {
            if (gLow != lowTo) gLow = lowTo > gLow ? std::min(1.0, gLow + lowStep) : std::max(0.0, gLow - lowStep);
            const double k = 1 - gLow;
            const float a = lo2.run(0, lo1.run(0, L[i])), b = lo2.run(1, lo1.run(1, R[i]));
            L[i] = static_cast<float>(L[i] + (a - L[i]) * k);
            R[i] = static_cast<float>(R[i] + (b - R[i]) * k);
        }
    else {
        lo1.clear();
        lo2.clear();
    }
    // Le filtre DJ : a gauche un passe-bas (20 kHz a 80 Hz), a droite un passe-haut (20 Hz a 8 kHz), 24 dB ; au centre rien.
    // La valeur glisse ; les coefficients tous les 32 echantillons ; changer de cote passe par le centre (etats remis)
    // Le cote ne change qu'une fois le filtre efface (fWet a 0, pres du centre ou il est presque transparent) : il repart
    // alors a froid, et entre en 5 ms
    const double fTo = std::max(-1.0, std::min(1.0, p.filter));
    const double wetStep = 1.0 / std::max(1.0, 0.005 * sr);
    double wetTo = 0;
    for (int i = 0; i < n; ++i) {
        if ((fTick++ & 31) == 0) {
            fNow += (fTo - fNow) * 0.12;
            if (std::fabs(fTo - fNow) < 1e-4) fNow = fTo;
            const int side = std::fabs(fNow) < 0.01 ? 0 : fNow < 0 ? -1 : 1;
            if (side != fSide && fWet <= 0) {
                fSide = side;
                f1.clear();
                f2.clear();
            }
            wetTo = fSide != 0 && side == fSide ? 1 : 0;
            if (fSide < 0) {
                const double f = 20000 * std::pow(80.0 / 20000, std::max(0.0, -fNow));
                f1.lowpassQ(f, FILTER_Q, sr);
                f2.lowpassQ(f, 0.707, sr);
            } else if (fSide > 0) {
                const double f = 20 * std::pow(8000.0 / 20, std::max(0.0, fNow));
                f1.highpassQ(f, FILTER_Q, sr);
                f2.highpassQ(f, 0.707, sr);
            }
        }
        if (fSide == 0) continue;
        if (fWet != wetTo) fWet = wetTo > fWet ? std::min(1.0, fWet + wetStep) : std::max(0.0, fWet - wetStep);
        const float a = f2.run(0, f1.run(0, L[i])), b = f2.run(1, f1.run(1, R[i]));
        L[i] = static_cast<float>(L[i] + (a - L[i]) * fWet);
        R[i] = static_cast<float>(R[i] + (b - R[i]) * fWet);
    }
}

void FxChain::reset() { prepare(sr_); }

void FxChain::setGlobal(const GlobalFx& g, double bpm) {
    g_ = g;
    bpm_ = bpm;
    // Les sous-reglages de la DIST (avant de poser les DIST), HELL
    distX_ = DistX::of(g);
    padsDist_.setX(distX_, sr_);
    kickDist_.setX(distX_, sr_);
    for (auto& d : sDist_) d.setX(distX_, sr_);
    hell_.set(g, bpm, sr_);
    const double x = FxLaws::xtoneHz(g.xtone);
    padsDist_.set(g.drive, x, sr_);
    kickDist_.set(g.drive, x, sr_);
    padsTone_.set(g.tone, sr_);
    kickTone_.set(g.tone, sr_);
    padsChorus_.set(g.chorus, FxLaws::chorusMul(g.crate), FxLaws::chorusDepth(g.cdepth));
    delay_.time = FxLaws::delaySeconds(g.dtime, bpm);
    delay_.fb = FxLaws::delayFeedback(g.dfb);
    delay_.lp.lowpass(std::min(FxLaws::dtoneHz(g.dtone), sr_ / 2), sr_);
    for (int t = 0; t < kTracks; ++t) setSlice(t, slice_[static_cast<size_t>(t)], kick_[static_cast<size_t>(t)]);
}

void FxChain::setSlice(int t, const SliceFx& s, bool kickLane) {
    if (t < 0 || t >= kTracks) return;
    slice_[static_cast<size_t>(t)] = s;
    kick_[static_cast<size_t>(t)] = kickLane;
    sTone_[static_cast<size_t>(t)].set(s.tone, sr_);
    sDist_[static_cast<size_t>(t)].set(s.dist, FxLaws::xtoneHz(g_.xtone), sr_);
    sChorus_[static_cast<size_t>(t)].set(s.chorus, FxLaws::chorusMul(g_.crate), FxLaws::chorusDepth(g_.cdepth));
}

void FxChain::clearTracks(int n) {
    for (int t = 0; t < kTracks; ++t) {
        std::memset(tl_[static_cast<size_t>(t)].data(), 0, sizeof(float) * static_cast<size_t>(n));
        std::memset(tr_[static_cast<size_t>(t)].data(), 0, sizeof(float) * static_cast<size_t>(n));
        active_[static_cast<size_t>(t)] = false;
    }
}

void FxChain::process(float* outL, float* outR, int n) {
    if (nextIR_ != reverb_.ir && !(nextIR_ == nullptr && reverb_.ir == nullptr)) reverb_.attach(nextIR_);
    for (auto* v : {&padsL_, &padsR_, &kickL_, &kickR_, &revL_, &revR_, &delL_, &delR_, &hellL_, &hellR_})
        std::memset(v->data(), 0, sizeof(float) * static_cast<size_t>(n));
    const double lv = g_.level * g_.level; // LEVEL au carre : le bus et les prises des envois
    // Les tranches : TONE, DIST, CHORUS, puis le bus (kick ou pads) et les envois de la piste
    for (int t = 0; t < kTracks; ++t) {
        const size_t ti = static_cast<size_t>(t);
        const SliceFx& s = slice_[ti];
        const bool chorusOn = sChorus_[ti].t > 0;
        if (active_[ti]) tail_[ti] = chorusOn ? static_cast<int>(0.06 * sr_ / 64) + 4 : 0;
        else if (tail_[ti] > 0) --tail_[ti];
        // PERFORM : une piste sans voix prend sa coupe tout de suite (rien ne sonne a adoucir)
        const float cutTo = (perf_.cut >> t) & 1u ? 0.f : 1.f;
        if (!active_[ti]) cutG_[ti] = cutTo;
        if (!active_[ti] && tail_[ti] <= 0) continue;
        float* L = tl_[ti].data();
        float* R = tr_[ti].data();
        // PERFORM : la piste coupee (ou rendue) glisse en 4 ms, avant ses effets (ses queues de DELAY et REVERB restent)
        {
            const float to = cutTo;
            float& g = cutG_[ti];
            if (g != to || to == 0.f) {
                const float st = static_cast<float>(1.0 / std::max(1.0, CUT_S * sr_));
                for (int i = 0; i < n; ++i) {
                    if (g != to) g = to > g ? std::min(1.f, g + st) : std::max(0.f, g - st);
                    L[i] *= g;
                    R[i] *= g;
                }
            }
        }
        sTone_[ti].process(L, R, n);
        sDist_[ti].process(L, R, n);
        if (chorusOn) sChorus_[ti].process(L, R, n, sr_);
        float* bL = kick_[ti] ? kickL_.data() : padsL_.data();
        float* bR = kick_[ti] ? kickR_.data() : padsR_.data();
        const double rs = s.reverb * REVERB_SEND * lv, ds = s.delay * DELAY_SEND * lv, hs = s.hell * HELL_SEND * lv;
        float pk = 0.f;
        for (int i = 0; i < n; ++i) {
            bL[i] += L[i];
            bR[i] += R[i];
            pk = std::max(pk, std::max(std::fabs(L[i]), std::fabs(R[i])));
            if (rs > 0) {
                revL_[static_cast<size_t>(i)] += static_cast<float>(L[i] * rs);
                revR_[static_cast<size_t>(i)] += static_cast<float>(R[i] * rs);
            }
            if (ds > 0) {
                delL_[static_cast<size_t>(i)] += static_cast<float>(L[i] * ds);
                delR_[static_cast<size_t>(i)] += static_cast<float>(R[i] * ds);
            }
            if (hs > 0) {
                hellL_[static_cast<size_t>(i)] += static_cast<float>(L[i] * hs);
                hellR_[static_cast<size_t>(i)] += static_cast<float>(R[i] * hs);
            }
        }
        peak_[ti] = std::max(peak_[ti], static_cast<float>(pk * lv));
    }
    // Le bus des pads : DIST, TONE, CHORUS globaux ; ses envois globaux ; le bus du kick : DIST et TONE seulement
    padsDist_.process(padsL_.data(), padsR_.data(), n);
    padsTone_.process(padsL_.data(), padsR_.data(), n);
    padsChorus_.process(padsL_.data(), padsR_.data(), n, sr_);
    kickDist_.process(kickL_.data(), kickR_.data(), n);
    kickTone_.process(kickL_.data(), kickR_.data(), n);
    const double gr = g_.reverb * REVERB_SEND * lv, gd = g_.delay * DELAY_SEND * lv;
    // PERFORM : DELAY THROW et REVERB WASH, tout le mix (les pads et le kick) part dans l'effet ; l'envoi glisse en 12 ms
    const double thStep = 1.0 / std::max(1.0, THROW_S * sr_);
    const double thDTo = perf_.throwDelay ? 1 : 0, thRTo = perf_.throwReverb ? 1 : 0;
    const bool throwing = throwD_ > 0 || throwR_ > 0 || thDTo > 0 || thRTo > 0;
    // Le SIDECHAIN (2026-11-12, Mika : "dans PERFORM mets un sidechain, pas qui vient de quelque part, juste un sidechain
    // normal") : a chaque temps (une noire de la grille), le gain plonge en 3 ms de la profondeur choisie, puis remonte en
    // courbe sur un demi-temps ; sur tout sauf la voie du kick (les pads et les retours de DELAY et REVERB). A l'arret, rien.
    const double sideTo = perfPlaying_ && perfPps_ > 0 ? std::max(0.0, std::min(1.0, perf_.side)) : 0.0;
    sideNow_ += (sideTo - sideNow_) * 0.5;
    if (std::fabs(sideTo - sideNow_) < 1e-4) sideNow_ = sideTo;
    const bool ducking = sideNow_ > 0;
    if (ducking) {
        const double beatN = 1.0 / perfPps_;           // echantillons par temps
        const double att = std::max(1.0, 0.003 * sr_);
        const double rel = std::max(att + 1, 0.5 * beatN);
        for (int i = 0; i < n; ++i) {
            const double ph = std::fmod(std::max(0.0, perfPpq_ + i * perfPps_), 1.0);
            const double s = ph * beatN;
            double e;
            if (s < att) e = s / att;
            else {
                const double x = std::max(0.0, 1 - (s - att) / rel);
                e = x * x;
            }
            duck_[static_cast<size_t>(i)] = static_cast<float>(1 - sideNow_ * e);
        }
    }
    for (int i = 0; i < n; ++i) {
        const size_t ii = static_cast<size_t>(i);
        if (throwing) {
            if (throwD_ != thDTo) throwD_ = thDTo > throwD_ ? std::min(1.0, throwD_ + thStep) : std::max(0.0, throwD_ - thStep);
            if (throwR_ != thRTo) throwR_ = thRTo > throwR_ ? std::min(1.0, throwR_ + thStep) : std::max(0.0, throwR_ - thStep);
            const double sumL = padsL_[ii] + kickL_[ii], sumR = padsR_[ii] + kickR_[ii];
            if (throwD_ > 0) {
                delL_[ii] += static_cast<float>(sumL * throwD_ * 0.8 * DELAY_SEND * lv);
                delR_[ii] += static_cast<float>(sumR * throwD_ * 0.8 * DELAY_SEND * lv);
            }
            if (throwR_ > 0) {
                revL_[ii] += static_cast<float>(sumL * throwR_ * 0.9 * REVERB_SEND * lv);
                revR_[ii] += static_cast<float>(sumR * throwR_ * 0.9 * REVERB_SEND * lv);
            }
        }
        if (gr > 0) {
            revL_[ii] += static_cast<float>(padsL_[ii] * gr);
            revR_[ii] += static_cast<float>(padsR_[ii] * gr);
        }
        if (gd > 0) {
            delL_[ii] += static_cast<float>(padsL_[ii] * gd);
            delR_[ii] += static_cast<float>(padsR_[ii] * gd);
        }
        const float dk = ducking ? duck_[ii] : 1.f;
        mL_[ii] = static_cast<float>((padsL_[ii] * dk + kickL_[ii]) * lv);
        mR_[ii] = static_cast<float>((padsR_[ii] * dk + kickR_[ii]) * lv);
    }
    // Les retours (sans LEVEL : il est deja sur les prises)
    delay_.process(delL_.data(), delR_.data(), wetL_.data(), wetR_.data(), n, sr_);
    for (int i = 0; i < n; ++i) {
        const float dk = ducking ? duck_[static_cast<size_t>(i)] : 1.f;
        mL_[static_cast<size_t>(i)] += wetL_[static_cast<size_t>(i)] * dk;
        mR_[static_cast<size_t>(i)] += wetR_[static_cast<size_t>(i)] * dk;
    }
    // HELL : son retour (hmix), comme celui du DELAY ; au repos, rien n'est calcule
    hell_.process(hellL_.data(), hellR_.data(), wetL_.data(), wetR_.data(), n, sr_, perfPpq_, perfPps_, perfPlaying_);
    if (!hell_.idle && g_.hmix > 0) {
        const double hm = clampd(g_.hmix, 0, 1) * HELL_RETURN;
        for (int i = 0; i < n; ++i) {
            const float dk = ducking ? duck_[static_cast<size_t>(i)] : 1.f;
            mL_[static_cast<size_t>(i)] += static_cast<float>(wetL_[static_cast<size_t>(i)] * hm) * dk;
            mR_[static_cast<size_t>(i)] += static_cast<float>(wetR_[static_cast<size_t>(i)] * hm) * dk;
        }
    }
    reverb_.process(revL_.data(), revR_.data(), wetL_.data(), wetR_.data(), n);
    for (int i = 0; i < n; ++i) {
        const float dk = ducking ? duck_[static_cast<size_t>(i)] : 1.f;
        mL_[static_cast<size_t>(i)] += wetL_[static_cast<size_t>(i)] * dk;
        mR_[static_cast<size_t>(i)] += wetR_[static_cast<size_t>(i)] * dk;
    }
    // PERFORM : le beat repeat, le tape stop, le low cut et le filtre DJ, avant le GLUE et le LIMITEUR
    perfFx_.process(mL_.data(), mR_.data(), n, perf_, perfPpq_, perfPps_, perfPlaying_, sr_);
    masterOnly(mL_.data(), mR_.data(), n);
    for (int i = 0; i < n; ++i) {
        outL[i] += mL_[static_cast<size_t>(i)];
        outR[i] += mR_[static_cast<size_t>(i)];
    }
}

void FxChain::masterOnly(float* L, float* R, int n) {
    glue_.process(L, R, n, g_, sr_);
    for (int i = 0; i < n; ++i) {
        L[i] = static_cast<float>(L[i] * RYTM_TRIM);
        R[i] = static_cast<float>(R[i] * RYTM_TRIM);
    }
    limiter_.process(L, R, n);
}

} // namespace mm
