// MM-ARP : les effets apres le moteur (voir ArpFx.h). Chaque constante porte le nom et le fichier du site d'ou elle vient.
#include "ArpFx.h"

#include <algorithm>
#include <cfloat>
#include <cmath>
#include <cstring>

namespace mmarp {

namespace {
constexpr double PI = 3.14159265358979323846;
constexpr double TAU = PI * 2;

// synth.ts
constexpr double VOLUME_K = 0.66;
constexpr double MAKEUP_DELAY = 0.35, MAKEUP_REVERB = 0.5;
constexpr float REVERB_BOOST = 1.25f;
constexpr double PP_FB_MIN = 0.35, PP_FB_MAX = 0.68, PP_MAX_S = 2, PP_RETIME_S = 0.2, PP_RETIME_RATE = 0.25;
constexpr float PP_WET = 0.8f, PP_LOWPASS = 4800, PP_HIGHPASS = 260;
constexpr double MONO_OFF_HZ = 10;
constexpr double BUTTER_Q_DB = -3.0103;
constexpr double WEB_Q_DEFAULT = 1; // BiquadFilterNode.Q par defaut (dB)
// sends.ts REVERB_SEND (l'envoi a 1) ; fx.ts IR_DEFAULT (la reverbe du MM-ARP : drums.ts arpReverb, sans forme a elle)
constexpr double REVERB_SEND = 1.0;
constexpr double IR_SECONDS = 2.4, IR_HI_END = 3000, IR_PRE = 0.02;
// glide.ts, insert.ts
constexpr double GLIDE_S = 0.02, UNLINK_S = 0.06;
// chorus.ts JUNO
constexpr double JUNO_RATE_I = 0.513, JUNO_RATE_II = 0.863;
constexpr double JUNO_DMIN = 0.00166, JUNO_DMAX = 0.00535, JUNO_FILTER_DELAY = 0.000106;
constexpr double JUNO_BIQUADS[4][2] = {{9688, 0.549}, {10378, 1.291}, {9688, 0.549}, {10378, 1.291}};
constexpr double JUNO_POLE = 7234, JUNO_WET = 1.16, JUNO_TRIM = 0.633, JUNO_PREROLL_S = 0.008;
// chorus.worklet.js
constexpr int TAPS = 16, HALF = 8, PHASES = 512;

inline double clampd(double v, double lo, double hi) { return std::max(lo, std::min(hi, v)); }
inline double jsRound(double x) { return std::floor(x + 0.5); }

double besselI0(double x) {
    double sum = 1, term = 1;
    for (int k = 1; k < 40; ++k) {
        term *= (x / (2 * k)) * (x / (2 * k));
        sum += term;
        if (term < 1e-12 * sum) break;
    }
    return sum;
}

// chorus.worklet.js SINC : 513 phases x 16 points, Kaiser beta 8, somme des valeurs en double (comme le JS)
const float* sinc() {
    static const std::vector<float> T = [] {
        std::vector<float> t(static_cast<size_t>((PHASES + 1) * TAPS));
        const double beta = 8, i0b = besselI0(beta);
        for (int p = 0; p <= PHASES; ++p) {
            const double f = static_cast<double>(p) / PHASES;
            double sum = 0;
            for (int k = 0; k < TAPS; ++k) {
                const double x = f + (HALF - 1) - k;
                const double s = std::fabs(x) < 1e-9 ? 1 : std::sin(PI * x) / (PI * x);
                const double r = x / HALF;
                const double w = std::fabs(r) >= 1 ? 0 : besselI0(beta * std::sqrt(1 - r * r)) / i0b;
                t[static_cast<size_t>(p * TAPS + k)] = static_cast<float>(s * w);
                sum += s * w;
            }
            for (int k = 0; k < TAPS; ++k) {
                float& v = t[static_cast<size_t>(p * TAPS + k)];
                v = static_cast<float>(v / sum);
            }
        }
        return t;
    }();
    return T.data();
}

// chorus.worklet.js readFrac
inline double readFrac(const float* b, int n, int w, double d) {
    const float* S = sinc();
    double pos = w - d;
    while (pos < 0) pos += n;
    const double fi = std::floor(pos);
    const int i = static_cast<int>(fi);
    const double fp = (pos - fi) * PHASES;
    const double fp0 = std::floor(fp);
    const int p0 = static_cast<int>(fp0);
    const double t = fp - fp0;
    const int a = p0 * TAPS;
    double y0 = 0, y1 = 0;
    int j = i - (HALF - 1);
    if (j < 0) j += n;
    for (int k = 0; k < TAPS; ++k) {
        const double x = b[j];
        y0 += S[a + k] * x;
        y1 += S[a + TAPS + k] * x;
        if (++j == n) j = 0;
    }
    return y0 + t * (y1 - y0);
}

inline double triangle(double p) {
    const double q = p - std::floor(p);
    return q < 0.25 ? 4 * q : q < 0.75 ? 2 - 4 * q : 4 * q - 4;
}

// mulberry32 (fx.ts prng)
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

// FFT complexe radix 2 en place (plugin/mm-rytm/dsp/Fx.cpp)
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
    static const Fft f(detail::Convolver::N);
    return f;
}
} // namespace

/* ---------------- les lois (params.ts, synth.ts) ---------------- */

int ArpFxLaws::chorusMode(double v) { return static_cast<int>(clampd(jsRound(clampd(v, 0, 1) * 2), 0, 2)); }
double ArpFxLaws::fxAmount(double v) { return v < 0.02 ? 0 : v; }
double ArpFxLaws::monoLowHz(double v) { return v < 0.04 ? 0 : 40 * std::pow(7.5, (v - 0.04) / 0.96); }
int ArpFxLaws::delaySixteenths(double v) {
    static const int S[5] = {2, 3, 4, 6, 8};
    return S[static_cast<int>(clampd(jsRound(clampd(v, 0, 1) * 4), 0, 4))];
}
double ArpFxLaws::delaySeconds(double dlyTime, double bpm) { return std::min(PP_MAX_S, delaySixteenths(dlyTime) * (60 / bpm / 4)); }
double ArpFxLaws::volGain(double volume, double delay, double reverb) {
    return (volume * volume * VOLUME_K) / (1 + MAKEUP_DELAY * delay + MAKEUP_REVERB * reverb);
}

namespace detail {

/* ---------------- BiquadFilterNode (Blink biquad.cc) ---------------- */

void WebBiquad::set(bool lowpass, float hz, float qDb, double sr) {
    const double nyquist = 0.5 * sr;
    const double cutoff = clampd(static_cast<double>(hz) / nyquist, 0, 1);
    double nb0, nb1, nb2, na0, na1, na2;
    if (cutoff == 1) {
        if (lowpass) {
            nb0 = 1; nb1 = 0; nb2 = 0;
        } else {
            nb0 = 0; nb1 = 0; nb2 = 0;
        }
        na0 = 1; na1 = 0; na2 = 0;
    } else if (cutoff > 0) {
        const double res = std::pow(10.0, static_cast<double>(qDb) / 20);
        const double theta = PI * cutoff;
        const double alpha = std::sin(theta) / (2 * res);
        const double cosw = std::cos(theta);
        const double beta = lowpass ? (1 - cosw) / 2 : (1 + cosw) / 2;
        nb0 = beta;
        nb1 = lowpass ? 2 * beta : -2 * beta;
        nb2 = beta;
        na0 = 1 + alpha;
        na1 = -2 * cosw;
        na2 = 1 - alpha;
    } else {
        if (lowpass) {
            nb0 = 0; nb1 = 0; nb2 = 0;
        } else {
            nb0 = 1; nb1 = 0; nb2 = 0;
        }
        na0 = 1; na1 = 0; na2 = 0;
    }
    const double inv = 1 / na0;
    b0 = nb0 * inv;
    b1 = nb1 * inv;
    b2 = nb2 * inv;
    a1 = na1 * inv;
    a2 = na2 * inv;
}

void WebBiquad::endQuantum() {
    if (x1 == 0.0 && x2 == 0.0 && (y1 != 0.0 || y2 != 0.0) && std::fabs(y1) < FLT_MIN && std::fabs(y2) < FLT_MIN) y1 = y2 = 0;
}

/* ---------------- 'mm-chorus' kind 'juno' ---------------- */

void JunoChorus::prepare(double sr) {
    sr_ = sr;
    buf_.assign(static_cast<size_t>(std::ceil(0.06 * sr)) + 8, 0.f);
    (void)sinc();
}

void JunoChorus::start(double dminIn, double dmaxIn, double rate) {
    std::fill(buf_.begin(), buf_.end(), 0.f);
    w_ = 0;
    rate_ = rate > 0 ? rate : 0.513;
    ph_ = 0;
    const double sr = sr_;
    const double dmin = std::max(dminIn, (HALF + 1) / sr);
    const double dmax = std::min(std::max(dmaxIn, dmin), 0.05);
    c0_ = 0.5 * (1 / dmin + 1 / dmax);
    c1_ = 0.5 * (1 / dmin - 1 / dmax);
    for (int i = 0; i < 4; ++i) {
        const double w0 = (TAU * std::min(JUNO_BIQUADS[i][0], sr * 0.45)) / sr;
        const double al = std::sin(w0) / (2 * JUNO_BIQUADS[i][1]);
        const double cw = std::cos(w0);
        const double a0 = 1 + al;
        bq_[static_cast<size_t>(i * 3)] = (1 - cw) / 2 / a0;
        bq_[static_cast<size_t>(i * 3 + 1)] = (-2 * cw) / a0;
        bq_[static_cast<size_t>(i * 3 + 2)] = (1 - al) / a0;
    }
    bz_.fill(0);
    const double t = std::tan((PI * std::min(JUNO_POLE, sr * 0.45)) / sr);
    pb_ = t / (1 + t);
    pa_ = (1 - t) / (1 + t);
    px_ = 0;
    py_ = 0;
}

void JunoChorus::process(const float* inL, const float* inR, float* oL, float* oR, int N, bool endOfQuantum) {
    float* bL = buf_.data();
    const int n = static_cast<int>(buf_.size());
    const double sr = sr_, c0 = c0_, c1 = c1_, pb = pb_, pa = pa_, dph = rate_ / sr;
    double px = px_, py = py_, ph = ph_;
    int w = w_;
    double* Z = bz_.data();
    const double* B = bq_.data();
    for (int i = 0; i < N; ++i) {
        const double x = 0.5 * (static_cast<double>(inL[i]) + static_cast<double>(inR[i]));
        py = pb * (x + px) + pa * py;
        px = x;
        double y = py;
        for (int j = 0; j < 4; ++j) {
            const double b0 = B[j * 3];
            const double yo = b0 * y + Z[j * 2];
            Z[j * 2] = 2 * b0 * y - B[j * 3 + 1] * yo + Z[j * 2 + 1];
            Z[j * 2 + 1] = b0 * y - B[j * 3 + 2] * yo;
            y = yo;
        }
        bL[w] = static_cast<float>(y);
        const double t = triangle(ph) * c1;
        ph += dph;
        if (ph >= 1) ph -= 1;
        oL[i] = static_cast<float>(readFrac(bL, n, w, sr / (c0 + t)));
        oR[i] = static_cast<float>(readFrac(bL, n, w, sr / (c0 - t)));
        if (++w == n) w = 0;
    }
    if (endOfQuantum) {
        if (std::fabs(py) < 1e-20) py = 0;
        for (double& z : bz_)
            if (std::fabs(z) < 1e-20) z = 0;
    }
    px_ = px;
    py_ = py;
    ph_ = ph;
    w_ = w;
}

/* ---------------- 'mm-tape' ---------------- */

namespace {
constexpr double TAPE_WOW_HZ = 0.55, TAPE_WOW_S = 0.0005, TAPE_FLUTTER_HZ = 6.5, TAPE_FLUTTER_S = 0.00005;
constexpr double TAPE_SAT_MIN = 0.3, TAPE_SAT_SPAN = 1.6, TAPE_HP_IN = 260, TAPE_HP_LOOP = 100, TAPE_LP0 = 4800, TAPE_LP_SPAN = 1600;
const double TAPE_QWEB = std::pow(10.0, 1.0 / 20);
constexpr double SQRT1_2 = 0.70710678118654752440;
} // namespace

void TapeDelay::Bq::make(bool lp, double hz, double sr, double q) {
    const double w0 = (TAU * std::min(hz, sr * 0.45)) / sr;
    const double al = std::sin(w0) / (2 * q);
    const double cw = std::cos(w0);
    const double a0 = 1 + al;
    b0 = (lp ? (1 - cw) / 2 : (1 + cw) / 2) / a0;
    b1 = (lp ? 1 - cw : -(1 + cw)) / a0;
    b2 = b0;
    a1 = (-2 * cw) / a0;
    a2 = (1 - al) / a0;
}

void TapeDelay::prepare(double sr, double maxS) {
    sr_ = sr;
    const double m = maxS > 0 ? std::min(4.0, maxS) : 2;
    const int n = static_cast<int>(std::ceil(m * sr)) + 2 * TAPS + 8;
    bL_.assign(static_cast<size_t>(n), 0.f);
    bR_.assign(static_cast<size_t>(n), 0.f);
    reset();
}

void TapeDelay::reset() {
    std::fill(bL_.begin(), bL_.end(), 0.f);
    std::fill(bR_.begin(), bR_.end(), 0.f);
    w_ = 0;
    hpIn_ = Bq();
    hpIn_.make(false, TAPE_HP_IN, sr_, TAPE_QWEB);
    hpL_ = Bq();
    hpL_.make(false, TAPE_HP_LOOP, sr_, SQRT1_2);
    hpR_ = hpL_;
    lpL_ = Bq();
    lpL_.make(true, TAPE_LP0, sr_, TAPE_QWEB);
    lpR_ = lpL_;
    lpTape_ = -1;
    phW_ = 0;
    phF_ = 0.25;
    quiet_ = 0;
    asleep_ = false;
}

void TapeDelay::process(const float* inL, const float* inR, const float* times, float fbF, float tapeF, float* oL, float* oR, int N) {
    float* bL = bL_.data();
    float* bR = bR_.data();
    const int n = static_cast<int>(bL_.size());
    double loud = 0;
    if (inL)
        for (int i = 0; i < N; ++i) loud = std::max(loud, std::max(std::fabs(static_cast<double>(inL[i])), std::fabs(static_cast<double>(inR[i]))));
    if (asleep_) {
        if (loud < 1e-9) {
            std::memset(oL, 0, sizeof(float) * static_cast<size_t>(N));
            std::memset(oR, 0, sizeof(float) * static_cast<size_t>(N));
            return;
        }
        asleep_ = false;
        quiet_ = 0;
    }
    const double sr = sr_;
    const double fb = fbF;
    const double t = std::max(0.0, std::min(1.0, static_cast<double>(tapeF)));
    if (t != lpTape_) {
        lpTape_ = t;
        Bq g;
        g.make(true, TAPE_LP0 - TAPE_LP_SPAN * t, sr, TAPE_QWEB);
        for (Bq* f : {&lpL_, &lpR_}) {
            f->b0 = g.b0;
            f->b1 = g.b1;
            f->b2 = g.b2;
            f->a1 = g.a1;
            f->a2 = g.a2;
        }
    }
    const double k = TAPE_SAT_MIN + TAPE_SAT_SPAN * t;
    const double wowA = TAPE_WOW_S * t * sr;
    const double fltA = TAPE_FLUTTER_S * t * sr;
    const double dW = TAPE_WOW_HZ / sr;
    const double dF = TAPE_FLUTTER_HZ / sr;
    int w = w_;
    double peak = 0;
    for (int i = 0; i < N; ++i) {
        const double x = inL ? 0.5 * (static_cast<double>(inL[i]) + static_cast<double>(inR[i])) : 0;
        const double xh = hpIn_.run(x);
        const double base = static_cast<double>(times[i]) * sr;
        double d = base + wowA * std::sin(TAU * phW_) + fltA * std::sin(TAU * phF_);
        phW_ += dW;
        if (phW_ >= 1) phW_ -= 1;
        phF_ += dF;
        if (phF_ >= 1) phF_ -= 1;
        if (d < HALF + 1) d = HALF + 1;
        else if (d > n - TAPS - 2) d = n - TAPS - 2;
        const double zL = std::tanh(k * lpL_.run(hpL_.run(readFrac(bL, n, w, d)))) / k;
        const double zR = std::tanh(k * lpR_.run(hpR_.run(readFrac(bR, n, w, d)))) / k;
        oL[i] = static_cast<float>(zL);
        oR[i] = static_cast<float>(zR);
        bL[w] = static_cast<float>(xh + fb * zR);
        bR[w] = static_cast<float>(fb * zL);
        const double a = std::fabs(zL) + std::fabs(zR);
        if (a > peak) peak = a;
        if (++w == n) w = 0;
    }
    w_ = w;
    if (loud < 1e-9 && peak < 1e-7) {
        quiet_ += N;
        if (quiet_ > n) {
            std::fill(bL_.begin(), bL_.end(), 0.f);
            std::fill(bR_.begin(), bR_.end(), 0.f);
            for (Bq* f : {&hpIn_, &hpL_, &hpR_, &lpL_, &lpR_}) f->z1 = f->z2 = 0;
            asleep_ = true;
        }
    } else quiet_ = 0;
}

/* ---------------- la reverb ---------------- */

void Convolver::impulse(double seconds, double hiEnd, double preDelay, double sr, std::vector<float>& L, std::vector<float>& R) {
    const long pre = static_cast<long>(jsRound(preDelay * sr));
    const long n = std::max(pre + 2, static_cast<long>(jsRound(seconds * sr)) + pre - static_cast<long>(jsRound(IR_PRE * sr)));
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
            if ((i & 63) == 0) {
                const double fc = hiStart * std::pow(hiEnd / hiStart, static_cast<double>(i) / static_cast<double>(len));
                a = 1 - std::exp((-2 * PI * fc) / sr);
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

void Convolver::prepare(double sr) {
    std::vector<float> L, R;
    impulse(IR_SECONDS, IR_HI_END, IR_PRE, sr, L, R);
    // Le pre-delai (au moins B echantillons nuls) absorbe la latence d'un bloc de la convolution
    const long pre = static_cast<long>(jsRound(IR_PRE * sr));
    const int skip = static_cast<int>(std::min<long>(B, pre));
    latency_ = B - skip;
    const int len = static_cast<int>(L.size()) - skip;
    parts_ = std::max(1, (len + B - 1) / B);
    std::vector<std::complex<float>> a(static_cast<size_t>(N));
    for (int ch = 0; ch < 2; ++ch) {
        const std::vector<float>& src = ch == 0 ? L : R;
        auto& H = H_[static_cast<size_t>(ch)];
        H.assign(static_cast<size_t>(parts_ * K), {0, 0});
        for (int p = 0; p < parts_; ++p) {
            std::fill(a.begin(), a.end(), std::complex<float>(0, 0));
            for (int i = 0; i < B && p * B + i < len; ++i) a[static_cast<size_t>(i)] = src[static_cast<size_t>(skip + p * B + i)];
            fft().run(a.data(), false);
            for (int k = 0; k < K; ++k) H[static_cast<size_t>(p * K + k)] = a[static_cast<size_t>(k)];
        }
        fdl_[static_cast<size_t>(ch)].assign(static_cast<size_t>(parts_ * K), {0, 0});
        in_[static_cast<size_t>(ch)].assign(N, 0.f);
        out_[static_cast<size_t>(ch)].assign(B, 0.f);
    }
    tmp_.assign(N, {0, 0});
    acc_.assign(N, {0, 0});
    reset();
}

void Convolver::reset() {
    for (int c = 0; c < 2; ++c) {
        std::fill(in_[static_cast<size_t>(c)].begin(), in_[static_cast<size_t>(c)].end(), 0.f);
        std::fill(out_[static_cast<size_t>(c)].begin(), out_[static_cast<size_t>(c)].end(), 0.f);
        std::fill(fdl_[static_cast<size_t>(c)].begin(), fdl_[static_cast<size_t>(c)].end(), std::complex<float>(0, 0));
    }
    fill_ = 0;
    head_ = 0;
    idle_ = 1 << 20;
}

void Convolver::block() {
    bool silent = true;
    for (int c = 0; c < 2 && silent; ++c)
        for (int i = B; i < N; ++i)
            if (in_[static_cast<size_t>(c)][static_cast<size_t>(i)] != 0) {
                silent = false;
                break;
            }
    idle_ = silent ? std::min(idle_ + 1, 1 << 20) : 0;
    head_ = (head_ + 1) % parts_;
    for (int c = 0; c < 2; ++c) {
        auto& in = in_[static_cast<size_t>(c)];
        auto& F = fdl_[static_cast<size_t>(c)];
        auto& out = out_[static_cast<size_t>(c)];
        if (idle_ > parts_ + 1) {
            // Rien depuis plus que la longueur de la reponse : la queue est finie
            std::fill(F.begin() + head_ * K, F.begin() + (head_ + 1) * K, std::complex<float>(0, 0));
            std::fill(out.begin(), out.end(), 0.f);
        } else {
            for (int i = 0; i < N; ++i) tmp_[static_cast<size_t>(i)] = in[static_cast<size_t>(i)];
            fft().run(tmp_.data(), false);
            for (int k = 0; k < K; ++k) F[static_cast<size_t>(head_ * K + k)] = tmp_[static_cast<size_t>(k)];
            const auto& H = H_[static_cast<size_t>(c)];
            std::fill(acc_.begin(), acc_.end(), std::complex<float>(0, 0));
            for (int p = 0; p < parts_; ++p) {
                const int slot = ((head_ - p) % parts_ + parts_) % parts_;
                const std::complex<float>* x = &F[static_cast<size_t>(slot * K)];
                const std::complex<float>* h = &H[static_cast<size_t>(p * K)];
                std::complex<float>* o = acc_.data();
                for (int k = 0; k < K; ++k) o[k] += x[k] * h[k];
            }
            for (int k = 1; k < N / 2; ++k) acc_[static_cast<size_t>(N - k)] = std::conj(acc_[static_cast<size_t>(k)]);
            fft().run(acc_.data(), true);
            for (int i = 0; i < B; ++i) out[static_cast<size_t>(i)] = acc_[static_cast<size_t>(B + i)].real();
        }
        std::memmove(in.data(), in.data() + B, sizeof(float) * B);
    }
}

void Convolver::process(const float* inL, const float* inR, float* outL, float* outR, int n) {
    for (int i = 0; i < n; ++i) {
        outL[i] = out_[0][static_cast<size_t>(fill_)];
        outR[i] = out_[1][static_cast<size_t>(fill_)];
        in_[0][static_cast<size_t>(B + fill_)] = inL[i];
        in_[1][static_cast<size_t>(B + fill_)] = inR[i];
        if (++fill_ == B) {
            block();
            fill_ = 0;
        }
    }
}

} // namespace detail

/* ---------------- ArpFx ---------------- */

void ArpFx::prepare(double sampleRate, int maxBlock) {
    sr_ = sampleRate;
    maxBlock_ = std::max(1, maxBlock);
    const size_t q = Q;
    for (auto* b : {&bHiL_, &bHiR_, &bJL_, &bJR_, &bTL_, &bTR_, &bTo_L_, &bTo_R_, &bTime_, &bRL_, &bRR_, &bRoL_, &bRoR_}) b->assign(q, 0.f);
    juno_.prepare(sr_);
    tape_.prepare(sr_, PP_MAX_S);
    dl_.prepare(PP_MAX_S, sr_);
    dr_.prepare(PP_MAX_S, sr_);
    conv_.prepare(sr_);
    dHp_.set(false, PP_HIGHPASS, static_cast<float>(WEB_Q_DEFAULT), sr_);
    lpL_.set(true, PP_LOWPASS, static_cast<float>(WEB_Q_DEFAULT), sr_);
    lpR_ = lpL_;
    // Le graphe tel que build() le pose avant applyFx : tout a 0, la separation a 10 Hz, le CHORUS en lien direct
    frame_ = 0;
    const double t0 = have_ ? cur_.delaySeconds : 0.375;
    splitHz_.setNow(static_cast<float>(MONO_OFF_HZ));
    low_.setNow(0);
    vol_.setNow(0);
    dSend_.setNow(0);
    fb_.setNow(static_cast<float>(PP_FB_MIN));
    dTime_.setNow(static_cast<float>(t0));
    tSend_.setNow(0);
    tFb_.setNow(0.35f);
    tAmt_.setNow(0.5f);
    tTime_.setNow(static_cast<float>(t0));
    rSend_.setNow(0);
    dry_.setNow(1);
    wet_.setNow(0);
    mode_ = 0;
    direct_ = true;
    branch_ = false;
    notBefore_ = 0;
    teardownAt_ = -1;
    pendingRate_ = 0;
    delayAt_ = t0;
    splitAt_ = -1;
    for (auto& f : hp1_) f.clear();
    for (auto& f : hp2_) f.clear();
    lp1_.clear();
    lp2_.clear();
    dHp_.clear();
    lpL_.clear();
    lpR_.clear();
    lpHist_.fill(0);
    lpHistI_ = 0;
    qFb_ = tFb_.value();
    qTape_ = tAmt_.value();
    if (have_) reset();
}

void ArpFx::glide(detail::Param& p, double target) {
    const double now = static_cast<double>(frame_);
    p.rampTo(now, now + GLIDE_S * sr_, static_cast<float>(target));
}

void ArpFx::retime(detail::Param& p, double t) {
    const double now = static_cast<double>(frame_);
    const double from = p.value();
    p.rampTo(now, now + std::max(PP_RETIME_S, std::fabs(t - from) / PP_RETIME_RATE) * sr_, static_cast<float>(t));
}

// insert.ts ramp : 20 ms, ou tenue jusqu'a notBefore (la branche neuve se remplit) puis 20 ms
void ArpFx::insertRamp(detail::Param& p, float v) {
    const double now = static_cast<double>(frame_);
    if (notBefore_ <= now) {
        glide(p, v);
        return;
    }
    p.rampTo(notBefore_, notBefore_ + GLIDE_S * sr_, v);
}

void ArpFx::insertEngage(float dry, float wet) {
    teardownAt_ = -1;
    if (direct_) {
        // Le lien direct devient un gain a 1, le mouille un gain a 0
        dry_.setNow(1);
        wet_.setNow(0);
        direct_ = false;
    }
    insertRamp(dry_, dry);
    insertRamp(wet_, wet);
}

void ArpFx::insertRelease() {
    if (direct_) return;
    notBefore_ = 0;
    glide(dry_, 1);
    glide(wet_, 0);
    teardownAt_ = static_cast<double>(frame_) + UNLINK_S * sr_;
}

// chorus.ts buildJunoChorus set
void ArpFx::chorusSet(int v) {
    const int m = v >= 2 ? 2 : v >= 1 ? 1 : 0;
    if (m == mode_) return;
    const int was = mode_;
    mode_ = m;
    if (m == 0) {
        insertRelease();
        return;
    }
    const double rate = m == 2 ? JUNO_RATE_II : JUNO_RATE_I;
    if (branch_) pendingRate_ = rate;
    else {
        juno_.start(JUNO_DMIN - JUNO_FILTER_DELAY, JUNO_DMAX - JUNO_FILTER_DELAY, rate);
        pendingRate_ = 0;
        branch_ = true;
        notBefore_ = static_cast<double>(frame_) + JUNO_PREROLL_S * sr_;
    }
    if (was == 0) insertEngage(static_cast<float>(JUNO_TRIM), static_cast<float>(JUNO_TRIM * JUNO_WET));
}

// synth.ts applyFx
void ArpFx::set(const ArpFxSettings& s, bool now) {
    const bool first = !have_;
    const double revWas = have_ ? clampd(cur_.reverb, 0, 1) : 0;
    cur_ = s;
    have_ = true;
    chorusSet(s.chorus);
    // REVERB : Send.set (sends.ts) : bornee, glisse en 20 ms (aussi en now), rien si la valeur ne change pas
    const double rv = std::isfinite(s.reverb) ? clampd(s.reverb, 0, 1) : 0;
    if (first ? rv != 0 : rv != revWas) glide(rSend_, REVERB_SEND * rv);
    const double fb = PP_FB_MIN + (PP_FB_MAX - PP_FB_MIN) * s.delay;
    const double tape = s.tape;
    const bool onTape = tape > 0;
    const double v = ArpFxLaws::volGain(s.volume, s.delay, s.reverb);
    const double hz = s.monoLowHz > 0 ? s.monoLowHz : MONO_OFF_HZ;
    const double low = v;
    // Les bornes des AudioParam du worklet 'mm-tape' (fb 0..0.95, tape 0..1, time 0.001..4)
    const double tfb = clampd(fb, 0, 0.95), tamt = clampd(tape, 0, 1);
    if (now) {
        splitHz_.setNow(static_cast<float>(hz));
        low_.setNow(static_cast<float>(low));
        vol_.setNow(static_cast<float>(v));
        dSend_.setNow(static_cast<float>(onTape ? 0 : s.delay));
        tSend_.setNow(static_cast<float>(onTape ? s.delay : 0));
        fb_.setNow(static_cast<float>(fb));
        tFb_.setNow(static_cast<float>(tfb));
        tAmt_.setNow(static_cast<float>(tamt));
    } else {
        glide(splitHz_, hz);
        glide(low_, low);
        glide(vol_, v);
        glide(dSend_, onTape ? 0 : s.delay);
        glide(tSend_, onTape ? s.delay : 0);
        glide(fb_, fb);
        glide(tFb_, tfb);
        glide(tAmt_, tamt);
    }
    const double t = std::min(PP_MAX_S, std::max(0.001, s.delaySeconds));
    if (now) {
        dTime_.setNow(static_cast<float>(t));
        tTime_.setNow(static_cast<float>(t));
        delayAt_ = t;
    } else if (t != delayAt_) retimeDelay(t);
}

// synth.ts retimeAll
void ArpFx::retimeDelay(double seconds) {
    const double t = std::min(PP_MAX_S, std::max(0.001, seconds));
    if (t == delayAt_) return;
    delayAt_ = t;
    cur_.delaySeconds = t;
    retime(dTime_, t);
    retime(tTime_, t);
}

void ArpFx::reset() {
    tape_.reset();
    std::fill(dl_.buf.begin(), dl_.buf.end(), 0.f);
    std::fill(dr_.buf.begin(), dr_.buf.end(), 0.f);
    dl_.w = dr_.w = 0;
    conv_.reset();
    for (auto& f : hp1_) f.clear();
    for (auto& f : hp2_) f.clear();
    lp1_.clear();
    lp2_.clear();
    dHp_.clear();
    lpL_.clear();
    lpR_.clear();
    lpHist_.fill(0);
    lpHistI_ = 0;
    frame_ = 0;
    splitAt_ = -1;
    pendingRate_ = 0;
    notBefore_ = 0;
    teardownAt_ = -1;
    if (!have_) return;
    // Les reglages poses sans rampe ; le CHORUS engage d'emblee (une ligne neuve)
    const ArpFxSettings s = cur_;
    set(s, true);
    const double rv = std::isfinite(s.reverb) ? clampd(s.reverb, 0, 1) : 0;
    rSend_.setNow(static_cast<float>(REVERB_SEND * rv));
    mode_ = s.chorus >= 2 ? 2 : s.chorus >= 1 ? 1 : 0;
    branch_ = mode_ != 0;
    direct_ = mode_ == 0;
    if (branch_) {
        juno_.start(JUNO_DMIN - JUNO_FILTER_DELAY, JUNO_DMAX - JUNO_FILTER_DELAY, mode_ == 2 ? JUNO_RATE_II : JUNO_RATE_I);
        dry_.setNow(static_cast<float>(JUNO_TRIM));
        wet_.setNow(static_cast<float>(JUNO_TRIM * JUNO_WET));
    } else {
        dry_.setNow(1);
        wet_.setNow(0);
    }
    teardownAt_ = -1;
    notBefore_ = 0;
    qFb_ = tFb_.value();
    qTape_ = tAmt_.value();
}

void ArpFx::splitCoefs(float hz) {
    if (hz == splitAt_) return;
    splitAt_ = hz;
    const float q = static_cast<float>(BUTTER_Q_DB);
    hp1_[0].set(false, hz, q, sr_);
    for (auto* f : {&hp1_[1], &hp2_[0], &hp2_[1]}) {
        f->b0 = hp1_[0].b0;
        f->b1 = hp1_[0].b1;
        f->b2 = hp1_[0].b2;
        f->a1 = hp1_[0].a1;
        f->a2 = hp1_[0].a2;
    }
    lp1_.set(true, hz, q, sr_);
    lp2_.b0 = lp1_.b0;
    lp2_.b1 = lp1_.b1;
    lp2_.b2 = lp1_.b2;
    lp2_.a1 = lp1_.a1;
    lp2_.a2 = lp1_.a2;
}

void ArpFx::process(const float* inL, const float* inR, float* outL, float* outR, int n) {
    int done = 0;
    while (done < n) {
        const int left = Q - static_cast<int>(frame_ % Q);
        const int len = std::min(n - done, left);
        processPiece(inL + done, inR + done, outL + done, outR + done, len);
        done += len;
    }
}

// Un morceau d'un bloc de rendu de 128 (jamais a cheval sur deux)
void ArpFx::processPiece(const float* inL, const float* inR, float* outL, float* outR, int n) {
    const bool qStart = frame_ % Q == 0;
    const bool qEnd = (frame_ + n) % Q == 0;
    // Le CHORUS revenu au repos depuis 60 ms : la branche part (insert.ts toDirect)
    if (teardownAt_ >= 0 && static_cast<double>(frame_) >= teardownAt_) {
        direct_ = true;
        branch_ = false;
        teardownAt_ = -1;
        notBefore_ = 0;
        dry_.setNow(1);
        wet_.setNow(0);
    }
    if (qStart) {
        // Les messages au worklet et les AudioParam k-rate : au debut du bloc de rendu
        if (pendingRate_ > 0) {
            juno_.setRate(pendingRate_);
            pendingRate_ = 0;
        }
        qFb_ = tFb_.at(frame_);
        qTape_ = tAmt_.at(frame_);
    }
    float* hiL = bHiL_.data();
    float* hiR = bHiR_.data();
    float* lo = bRoL_.data(); // le bas, avant son gain (tampon partage avec la reverb : relu avant elle)
    // 1. BASS MONO : le haut (stereo), le bas en mono (L + R) / 2
    for (int i = 0; i < n; ++i) {
        const long k = frame_ + i;
        splitCoefs(splitHz_.at(k));
        hiL[i] = hp2_[0].run(hp1_[0].run(inL[i]));
        hiR[i] = hp2_[1].run(hp1_[1].run(inR[i]));
        const float m = 0.5f * (inL[i] + inR[i]);
        lo[i] = lp2_.run(lp1_.run(m));
    }
    // 2. CHORUS : la ligne du Juno (le mouille seul) tant que la branche existe
    if (branch_) juno_.process(hiL, hiR, bJL_.data(), bJR_.data(), n, qEnd);
    // 3. insert, VOLUME, le bas, le DELAY ping-pong, les entrees de la bande et de la reverb
    float* dL = bTL_.data(); // la somme seche + bas
    float* dR = bTR_.data();
    float* mL = bTo_L_.data(); // la sortie du merge du ping-pong (avant wet)
    float* mR = bTo_R_.data();
    float* tinL = bJL_.data(); // l'entree de la bande (le mouille du Juno est lu avant d'etre ecrase)
    float* tinR = bJR_.data();
    float* times = bTime_.data();
    float* rinL = bRL_.data();
    float* rinR = bRR_.data();
    for (int i = 0; i < n; ++i) {
        const long k = frame_ + i;
        float cL, cR;
        if (direct_) {
            cL = hiL[i];
            cR = hiR[i];
        } else {
            const float dg = dry_.at(k), wg = wet_.at(k);
            const float jL = branch_ ? bJL_[static_cast<size_t>(i)] : 0.f;
            const float jR = branch_ ? bJR_[static_cast<size_t>(i)] : 0.f;
            cL = hiL[i] * dg + jL * wg;
            cR = hiR[i] * dg + jR * wg;
        }
        const float v = vol_.at(k);
        const float vL = cL * v, vR = cR * v;
        const float lg = lo[i] * low_.at(k);
        dL[i] = vL + lg;
        dR[i] = vR + lg;
        // DELAY : l'envoi, le passe-haut, gauche <-> droite (la droite lit le passe-bas gauche du bloc d'avant)
        const float ds = dSend_.at(k);
        const float sm = 0.5f * (vL * ds + vR * ds);
        const float h = dHp_.run(sm);
        const float fbv = fb_.at(k);
        const float dt = dTime_.at(k);
        const float rIn = fbv * lpHist_[static_cast<size_t>(lpHistI_)];
        const float lpRo = lpR_.run(dr_.run(rIn, dt, sr_));
        const float lIn = h + fbv * lpRo;
        const float lpLo = lpL_.run(dl_.run(lIn, dt, sr_));
        lpHist_[static_cast<size_t>(lpHistI_)] = lpLo;
        if (++lpHistI_ == Q) lpHistI_ = 0;
        mL[i] = lpLo;
        mR[i] = lpRo;
        // TAPE : son envoi, son temps (a-rate)
        const float ts = tSend_.at(k);
        tinL[i] = vL * ts;
        tinR[i] = vR * ts;
        times[i] = std::max(0.001f, std::min(4.f, tTime_.at(k)));
        // REVERB : x1.25 puis l'envoi
        const float rs = rSend_.at(k);
        rinL[i] = (vL * REVERB_BOOST) * rs;
        rinR[i] = (vR * REVERB_BOOST) * rs;
    }
    // 4. la bande
    float* toL = bHiL_.data(); // le haut n'est plus lu
    float* toR = bHiR_.data();
    tape_.process(tinL, tinR, times, qFb_, qTape_, toL, toR, n);
    // 5. la reverb
    float* roL = bRoL_.data();
    float* roR = bRoR_.data();
    conv_.process(rinL, rinR, roL, roR, n);
    // 6. la prise : sec + bas, wet x 0.8 (le merge et la bande), la reverb
    for (int i = 0; i < n; ++i) {
        outL[i] = (dL[i] + (mL[i] + toL[i]) * PP_WET) + roL[i];
        outR[i] = (dR[i] + (mR[i] + toR[i]) * PP_WET) + roR[i];
    }
    if (qEnd) {
        for (auto& f : hp1_) f.endQuantum();
        for (auto& f : hp2_) f.endQuantum();
        lp1_.endQuantum();
        lp2_.endQuantum();
        dHp_.endQuantum();
        lpL_.endQuantum();
        lpR_.endQuantum();
    }
    frame_ += n;
}

} // namespace mmarp
