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
// Le plugin seul (extra-params.json) ; aux defauts : exactement IR_SECONDS, x1, IR_PRE
double ArpFxLaws::revSeconds(double v) { return IR_SECONDS * std::pow(4.0, 2 * clampd(v, 0, 1) - 1); }
double ArpFxLaws::revToneFactor(double v) { return std::pow(4.0, 2 * clampd(v, 0, 1) - 1); }
double ArpFxLaws::revPreSeconds(double v) { return clampd(v, 0, 1) / 10; }
double ArpFxLaws::shelfDb(double v) { return 12 * (clampd(v, 0, 1) - 0.5); }
// Le rack d'effets du 2026-11-11
double ArpFxLaws::phaserHz(double v) { return 0.05 * std::pow(160.0, clampd(v, 0, 1)); }
double ArpFxLaws::flangerHz(double v) { return 0.03 * std::pow(5 / 0.03, clampd(v, 0, 1)); }
double ArpFxLaws::crushBitDepth(double v) { return 16 - 12 * clampd(v, 0, 1); }
double ArpFxLaws::crushHz(double v, double sr) { return sr * std::pow(std::min(1.0, 2000 / sr), clampd(v, 0, 1)); }
double ArpFxLaws::pumpDb(double v) { return -24 * clampd(v, 0, 1); }
double ArpFxLaws::pumpBeats(int rate) { return rate <= 0 ? 0.5 : rate == 1 ? 1 : 2; }

namespace detail {

/* ---------------- AudioParam (Blink audio_param_timeline.cc) ---------------- */

void Param::rampTo(double t1s, double t2s, float to, double rate) {
    sr = rate;
    v0 = last;
    v1 = to;
    t1 = t1s;
    t2 = t2s;
    sF = static_cast<long>(std::ceil(t1s * rate - 1e-6));
    eF = static_cast<long>(std::ceil(t2s * rate - 1e-6));
    ramp = true;
    cq = -1;
}

float Param::serial(long cf) const {
    const float srf = static_cast<float>(sr);
    const double dt = t2 - t1;
    const float k = dt > 0 ? static_cast<float>(1 / dt) : 0.f;
    const float vd = v1 - v0;
    const float x = static_cast<float>((static_cast<double>(static_cast<float>(cf) / srf) - t1) * static_cast<double>(k));
    return v0 + x * vd;
}

void Param::run(long cf, int len, float* out) const {
    const float srf = static_cast<float>(sr);
    const double dt = t2 - t1;
    const float k = dt > 0 ? static_cast<float>(1 / dt) : 0.f;
    const float vd = v1 - v0;
    const int tr = (len / 4) * 4;
    if (tr > 0) {
        const float inv = 1 / srf;
        const float base = static_cast<float>(static_cast<double>(static_cast<float>(cf) / srf) - t1);
        const float kv = k * vd;
        float lane[4];
        for (int j = 0; j < 4; ++j) lane[j] = ((inv * static_cast<float>(j)) + base) * kv + v0;
        const float inc = ((4 / srf) * k) * vd;
        for (int g = 0; g < tr; g += 4)
            for (int j = 0; j < 4; ++j) {
                out[g + j] = lane[j];
                lane[j] += inc;
            }
    }
    for (int i = tr; i < len; ++i) out[i] = serial(cf + i);
}

void Param::fill(long k0, int n, float* out) {
    const long q0 = k0 - k0 % 128;
    if (cq != q0) {
        // le bloc entier depuis ici (les echantillons deja rendus ne sont plus lus) : la rampe part de max(debut, sF)
        compute(k0, static_cast<int>(q0 + 128 - k0), cache.data() + (k0 - q0));
        cq = q0;
    }
    std::memcpy(out, cache.data() + (k0 - q0), sizeof(float) * static_cast<size_t>(n));
    if (n > 0) last = out[n - 1];
}

void Param::compute(long k0, int n, float* out) {
    int i = 0;
    while (i < n) {
        const long k = k0 + i;
        if (ramp && k >= eF) {
            v0 = v1;
            ramp = false;
        }
        if (!ramp) {
            for (; i < n; ++i) out[i] = v0;
            break;
        }
        if (k < sF) {
            const int len = static_cast<int>(std::min<long>(n - i, sF - k));
            for (int j = 0; j < len; ++j) out[i + j] = v0;
            i += len;
            continue;
        }
        const int len = static_cast<int>(std::min<long>(n - i, eF - k));
        run(k, len, out + i);
        i += len;
    }
}

float Param::at(long k) {
    if (ramp && k >= eF) {
        v0 = v1;
        ramp = false;
    }
    last = !ramp || k < sF ? v0 : serial(k);
    return last;
}

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

namespace {
constexpr int Q_ = 128;
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
    qQuiet_ = true;
    skipped_ = 0;
}

void TapeDelay::process(const float* inL, const float* inR, const float* times, float fbF, float tapeF, float* oL, float* oR, int N, bool qStart, bool qEnd) {
    float* bL = bL_.data();
    float* bR = bR_.data();
    const int n = static_cast<int>(bL_.size());
    if (qStart) {
        qQuiet_ = true;
        skipped_ = 0;
    }
    double loud = 0;
    if (inL)
        for (int i = 0; i < N; ++i) loud = std::max(loud, std::max(std::fabs(static_cast<double>(inL[i])), std::fabs(static_cast<double>(inR[i]))));
    if (asleep_) {
        if (loud < 1e-9) {
            std::memset(oL, 0, sizeof(float) * static_cast<size_t>(N));
            std::memset(oR, 0, sizeof(float) * static_cast<size_t>(N));
            skipped_ += N;
            return;
        }
        asleep_ = false;
        quiet_ = 0;
        // Le worklet aurait calcule tout le bloc : les echantillons sautes de ce bloc (lignes et filtres a zero, sorties
        // nulles) font seulement avancer les tetes et la ligne
        for (int i = 0; i < skipped_; ++i) {
            phW_ += TAPE_WOW_HZ / sr_;
            if (phW_ >= 1) phW_ -= 1;
            phF_ += TAPE_FLUTTER_HZ / sr_;
            if (phF_ >= 1) phF_ -= 1;
            bL[w_] = 0;
            bR[w_] = 0;
            if (++w_ == n) w_ = 0;
        }
        skipped_ = 0;
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
    if (!(loud < 1e-9 && peak < 1e-7)) qQuiet_ = false;
    if (!qEnd) return;
    if (qQuiet_) {
        quiet_ += Q_;
        if (quiet_ > n) {
            std::fill(bL_.begin(), bL_.end(), 0.f);
            std::fill(bR_.begin(), bR_.end(), 0.f);
            for (Bq* f : {&hpIn_, &hpL_, &hpR_, &lpL_, &lpR_}) f->z1 = f->z2 = 0;
            asleep_ = true;
        }
    } else quiet_ = 0;
}

/* ---------------- la reverb ---------------- */

// Une FFT complexe radix 2, parties reelles et imaginaires a part, que l'on peut faire passe par passe (le travail
// des grands blocs de la convolution est etale) ; les rotations de chaque passe sont rangees a la suite.
struct PFft {
    int n = 0, bits = 0;
    std::vector<int> rev;
    std::vector<float> wr, wi; // la passe de demi-longueur h : [h - 1, 2h - 1)
    explicit PFft(int size) : n(size), rev(static_cast<size_t>(size)), wr(static_cast<size_t>(size)), wi(static_cast<size_t>(size)) {
        while ((1 << bits) < n) ++bits;
        for (int i = 0; i < n; ++i) {
            int r = 0;
            for (int b = 0; b < bits; ++b)
                if (i & (1 << b)) r |= 1 << (bits - 1 - b);
            rev[static_cast<size_t>(i)] = r;
        }
        for (int h = 1; h < n; h <<= 1)
            for (int j = 0; j < h; ++j) {
                const double a = -PI * j / h;
                wr[static_cast<size_t>(h - 1 + j)] = static_cast<float>(std::cos(a));
                wi[static_cast<size_t>(h - 1 + j)] = static_cast<float>(std::sin(a));
            }
    }
    void permute(float* re, float* im) const {
        for (int i = 0; i < n; ++i) {
            const int r = rev[static_cast<size_t>(i)];
            if (i < r) {
                std::swap(re[i], re[r]);
                std::swap(im[i], im[r]);
            }
        }
    }
    // la passe de demi-longueur h (1, 2, 4... n / 2) ; inverse : les rotations conjuguees (sans le 1 / n)
    void pass(float* re, float* im, int h, bool inverse) const {
        const float* cr = &wr[static_cast<size_t>(h - 1)];
        const float* ci = &wi[static_cast<size_t>(h - 1)];
        const float sg = inverse ? -1.f : 1.f;
        for (int i = 0; i < n; i += 2 * h) {
            float* ar = re + i;
            float* ai = im + i;
            float* br = ar + h;
            float* bi = ai + h;
            for (int j = 0; j < h; ++j) {
                const float c = cr[j], d = sg * ci[j];
                const float xr = br[j] * c - bi[j] * d;
                const float xi = br[j] * d + bi[j] * c;
                const float ur = ar[j], ui = ai[j];
                ar[j] = ur + xr;
                ai[j] = ui + xi;
                br[j] = ur - xr;
                bi[j] = ui - xi;
            }
        }
    }
    void forward(float* re, float* im) const {
        permute(re, im);
        for (int h = 1; h < n; h <<= 1) pass(re, im, h, false);
    }
};

namespace {
const PFft& pfft(int stage) {
    static const PFft f0(2 * ReverbIR::kBlock[0]), f1(2 * ReverbIR::kBlock[1]), f2(2 * ReverbIR::kBlock[2]);
    return stage == 0 ? f0 : stage == 1 ? f1 : f2;
}
// le nombre de blocs d'un etage pour une reponse de len echantillons
int stageParts(int s, long len) {
    const long from = ReverbIR::kFrom[s];
    const long to = s + 1 < ReverbIR::kStages ? std::min<long>(len, ReverbIR::kFrom[s + 1]) : len;
    return to > from ? static_cast<int>((to - from + ReverbIR::kBlock[s] - 1) / ReverbIR::kBlock[s]) : 0;
}
long irLength(double seconds, double preDelay, double sr) {
    const long pre = static_cast<long>(jsRound(preDelay * sr));
    return std::max(pre + 2, static_cast<long>(jsRound(seconds * sr)) + pre - static_cast<long>(jsRound(IR_PRE * sr)));
}
// le fondu enchaine de deux reponses (40 ms)
constexpr double XFADE_S = 0.04;
inline float fadeGain(long long pos, int len) {
    if (pos >= len) return 1.f;
    if (pos <= 0) return 0.f;
    const float t = static_cast<float>(pos) / static_cast<float>(len);
    return t * t * (3.f - 2.f * t);
}
// le produit scalaire de la tete (huit sommes en parallele : les compilateurs le vectorisent sans -ffast-math)
inline float dot(const float* a, const float* b, int n) {
    float acc[8] = {0, 0, 0, 0, 0, 0, 0, 0};
    int i = 0;
    for (; i + 8 <= n; i += 8)
        for (int j = 0; j < 8; ++j) acc[j] += a[i + j] * b[i + j];
    float y = ((acc[0] + acc[1]) + (acc[2] + acc[3])) + ((acc[4] + acc[5]) + (acc[6] + acc[7]));
    for (; i < n; ++i) y += a[i] * b[i];
    return y;
}
enum : uint8_t { OP_ZSLOT, OP_LOAD, OP_FPASS, OP_STORE, OP_ZOUT, OP_MAC0, OP_MAC, OP_MIRROR, OP_IPASS, OP_FIN, OP_MIX, OP_MIX0 };
} // namespace

void Convolver::impulse(double seconds, double hiEnd, double preDelay, double sr, std::vector<float>& L, std::vector<float>& R) {
    impulse(seconds, std::max(9000.0, hiEnd), hiEnd, preDelay, sr, L, R);
}

void Convolver::impulse(double seconds, double hiStart, double hiEnd, double preDelay, double sr, std::vector<float>& L, std::vector<float>& R) {
    const long pre = static_cast<long>(jsRound(preDelay * sr));
    const long n = irLength(seconds, preDelay, sr);
    const long len = n - pre;
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

// Thread du message : la reponse et ses spectres
std::shared_ptr<const ReverbIR> Convolver::make(double sr, double size, double tone, double pre) {
    auto r = std::make_shared<ReverbIR>();
    r->sampleRate = sr;
    r->size = std::isfinite(size) ? clampd(size, 0, 1) : 0.5;
    r->tone = std::isfinite(tone) ? clampd(tone, 0, 1) : 0.5;
    r->pre = std::isfinite(pre) ? clampd(pre, 0, 1) : 0.2;
    const double f = ArpFxLaws::revToneFactor(r->tone);
    r->seconds = ArpFxLaws::revSeconds(r->size);
    r->hiStart = std::min(18000.0, 9000.0 * f);
    r->hiEnd = std::min(18000.0, IR_HI_END * f);
    r->preSeconds = ArpFxLaws::revPreSeconds(r->pre);
    impulse(r->seconds, r->hiStart, r->hiEnd, r->preSeconds, sr, r->ir[0], r->ir[1]);
    const long len = static_cast<long>(r->ir[0].size());
    r->length = static_cast<int>(len);
    // la tete : les B premiers points, a l'envers, sans ses zeros de tete (le pre-delai)
    int from = B;
    for (int c = 0; c < 2; ++c)
        for (int i = 0; i < B && i < len; ++i)
            if (r->ir[static_cast<size_t>(c)][static_cast<size_t>(i)] != 0) {
                from = std::min(from, i);
                break;
            }
    r->headFrom = from;
    for (int c = 0; c < 2; ++c) {
        auto& h = r->head[static_cast<size_t>(c)];
        h.assign(static_cast<size_t>(B - from), 0.f);
        for (int k = 0; k < B - from; ++k) {
            const long i = B - 1 - k;
            h[static_cast<size_t>(k)] = i < len ? r->ir[static_cast<size_t>(c)][static_cast<size_t>(i)] : 0.f;
        }
    }
    for (int s = 0; s < ReverbIR::kStages; ++s) {
        const int Bs = ReverbIR::kBlock[s], N = 2 * Bs, K = Bs + 1;
        const int P = stageParts(s, len);
        r->parts[static_cast<size_t>(s)] = P;
        std::vector<float> wr(static_cast<size_t>(N)), wi(static_cast<size_t>(N));
        for (int c = 0; c < 2; ++c) {
            const auto& src = r->ir[static_cast<size_t>(c)];
            auto& re = r->re[static_cast<size_t>(s)][static_cast<size_t>(c)];
            auto& im = r->im[static_cast<size_t>(s)][static_cast<size_t>(c)];
            re.assign(static_cast<size_t>(P) * static_cast<size_t>(K), 0.f);
            im.assign(static_cast<size_t>(P) * static_cast<size_t>(K), 0.f);
            const long to = s + 1 < ReverbIR::kStages ? std::min<long>(len, ReverbIR::kFrom[s + 1]) : len;
            for (int q = 0; q < P; ++q) {
                std::fill(wr.begin(), wr.end(), 0.f);
                std::fill(wi.begin(), wi.end(), 0.f);
                const long o = ReverbIR::kFrom[s] + static_cast<long>(q) * Bs;
                for (int i = 0; i < Bs && o + i < to; ++i) wr[static_cast<size_t>(i)] = src[static_cast<size_t>(o + i)];
                pfft(s).forward(wr.data(), wi.data());
                std::copy(wr.begin(), wr.begin() + K, re.begin() + static_cast<long>(q) * K);
                std::copy(wi.begin(), wi.begin() + K, im.begin() + static_cast<long>(q) * K);
            }
        }
    }
    return r;
}

void Convolver::prepare(double sr, std::shared_ptr<const ReverbIR> ir) {
    sr_ = sr;
    fadeLen_ = std::max(B, static_cast<int>(jsRound(XFADE_S * sr)));
    // la plus longue reponse : SIZE 1, PRE DELAY 1
    const long maxLen = std::max<long>(irLength(ArpFxLaws::revSeconds(1), ArpFxLaws::revPreSeconds(1), sr), ir ? ir->length : 0);
    for (int c = 0; c < 2; ++c) ring_[static_cast<size_t>(c)].assign(2 * RING, 0.f);
    for (int s = 0; s < ReverbIR::kStages; ++s) {
        Stage& st = st_[static_cast<size_t>(s)];
        st.B = ReverbIR::kBlock[s];
        st.N = 2 * st.B;
        st.K = st.B + 1;
        st.fft = &pfft(s);
        st.bits = st.fft->bits;
        st.ticks = s == 0 ? 1 : st.B / B;
        st.cap = std::max(1, stageParts(s, maxLen));
        for (int c = 0; c < 2; ++c) {
            st.fRe[static_cast<size_t>(c)].assign(static_cast<size_t>(st.cap) * static_cast<size_t>(st.K), 0.f);
            st.fIm[static_cast<size_t>(c)].assign(static_cast<size_t>(st.cap) * static_cast<size_t>(st.K), 0.f);
            for (int b = 0; b < 2; ++b) st.out[static_cast<size_t>(b)][static_cast<size_t>(c)].assign(static_cast<size_t>(st.B), 0.f);
        }
        st.wRe.assign(static_cast<size_t>(st.N), 0.f);
        st.wIm.assign(static_cast<size_t>(st.N), 0.f);
        // le plus long travail d'un bloc : deux canaux, l'aller (bits + 2), deux reponses (cap + bits + 2 chacune)
        st.ops.assign(static_cast<size_t>(2 * (st.bits + 2) + 4 * (st.cap + st.bits + 2) + 8), Op{0, 0, 0, 0, 0});
    }
    // hors du thread audio : les reponses d'avant sont liberees ici
    cur_ = std::move(ir);
    next_.reset();
    want_.reset();
    while (takeRetired()) {}
    reset();
}

void Convolver::reset() {
    for (int c = 0; c < 2; ++c) std::fill(ring_[static_cast<size_t>(c)].begin(), ring_[static_cast<size_t>(c)].end(), 0.f);
    // un fondu en cours : la reponse neuve prend la place d'un coup (l'ancienne est rangee, jamais liberee ici)
    if (next_ && pushRetired(cur_)) cur_ = std::move(next_);
    for (Stage& st : st_) {
        for (int c = 0; c < 2; ++c) {
            std::fill(st.fRe[static_cast<size_t>(c)].begin(), st.fRe[static_cast<size_t>(c)].end(), 0.f);
            std::fill(st.fIm[static_cast<size_t>(c)].begin(), st.fIm[static_cast<size_t>(c)].end(), 0.f);
            for (int b = 0; b < 2; ++b) std::fill(st.out[static_cast<size_t>(b)][static_cast<size_t>(c)].begin(), st.out[static_cast<size_t>(b)][static_cast<size_t>(c)].end(), 0.f);
        }
        st.zero = {{true, true}};
        st.cur = 0;
        st.head = 0;
        st.nOps = st.done = st.ticksLeft = 0;
        st.costLeft = 0;
        st.a = st.b = nullptr;
        st.fade0 = st.fadePos = 0;
        st.xf = 0;
        st.T = 0;
    }
    headXf_ = next_ ? 1 : 0;
    headFade_ = 0;
    n_ = 0;
    lastNZ_ = -(1LL << 60);
    fill_ = 0;
    rpos_ = 0;
}

bool Convolver::pushRetired(std::shared_ptr<const ReverbIR>& p) {
    if (!p) return true;
    const unsigned w = retW_.load(std::memory_order_relaxed);
    if (w - retR_.load(std::memory_order_acquire) >= static_cast<unsigned>(kRetired)) return false;
    ret_[w % kRetired] = std::move(p);
    retW_.store(w + 1, std::memory_order_release);
    return true;
}

std::shared_ptr<const ReverbIR> Convolver::takeRetired() {
    const unsigned r = retR_.load(std::memory_order_relaxed);
    if (r == retW_.load(std::memory_order_acquire)) return nullptr;
    std::shared_ptr<const ReverbIR> p = std::move(ret_[r % kRetired]);
    retR_.store(r + 1, std::memory_order_release);
    return p;
}

bool Convolver::set(std::shared_ptr<const ReverbIR>& ir) {
    if (!ir || ir->sampleRate != sr_) return false;
    for (int s = 0; s < ReverbIR::kStages; ++s)
        if (ir->parts[static_cast<size_t>(s)] > st_[static_cast<size_t>(s)].cap) return false;
    // une demande attendait deja : elle est rangee (jamais liberee ici), la derniere gagne
    if (want_ && !pushRetired(want_)) return false;
    want_ = std::move(ir);
    return true;
}

// La demande en attente entre en fondu des que le precedent est fini
void Convolver::promote() {
    if (!want_ || next_) return;
    next_ = std::move(want_);
    for (int s = 0; s < ReverbIR::kStages; ++s) {
        Stage& st = st_[static_cast<size_t>(s)];
        st.fadePos = 0;
        // un etage ou ni l'une ni l'autre n'a de bloc n'a rien a fondre
        st.xf = cur_->parts[static_cast<size_t>(s)] == 0 && next_->parts[static_cast<size_t>(s)] == 0 ? 2 : 0;
    }
    headXf_ = 1;
    headFade_ = 0;
}

// Tous les etages sont passes a la neuve : l'ancienne est rangee pour l'autre thread
void Convolver::retire() {
    if (!next_ || headXf_ != 2) return;
    for (const Stage& st : st_)
        if (st.xf != 2 || (st.b != nullptr && st.done < st.nOps)) return;
    if (!pushRetired(cur_)) return; // la file est pleine : au prochain bloc
    cur_ = std::move(next_);
    for (Stage& st : st_) {
        st.xf = 0;
        st.b = nullptr;
    }
    headXf_ = 0;
}

// Un bloc de l'etage s commence (n_ est un multiple de sa taille) : son travail, etale sur ses ticks
void Convolver::startJob(int s) {
    Stage& st = st_[static_cast<size_t>(s)];
    st.T = n_;
    st.head = (st.head + 1) % st.cap;
    if (next_ && st.xf == 0) {
        st.xf = 1;
        st.fadePos = 0;
    }
    st.a = st.xf == 2 && next_ ? next_.get() : cur_.get();
    st.b = nullptr;
    if (st.xf == 1) {
        st.b = next_.get();
        st.fade0 = st.fadePos;
        st.fadePos += st.B;
        if (st.fadePos >= fadeLen_) st.xf = 2;
    }
    const int pa = st.a->parts[static_cast<size_t>(s)];
    const int pb = st.b ? st.b->parts[static_cast<size_t>(s)] : 0;
    const int need = std::max(pa, pb);
    // le silence : la trame de 2 B est nulle ; tout ce que l'etage convolue est nul
    const bool skipFwd = lastNZ_ < n_ - 2LL * st.B;
    const bool skipOut = need == 0 || lastNZ_ < n_ - static_cast<long long>(need + 1) * st.B;
    int n = 0;
    Op* o = st.ops.data();
    // chaque operation avec son cout (le nombre de valeurs touchees, a peu pres) : le travail s'etale a cout egal
    long long cost = 0;
    const int N = st.N, K = st.K;
    auto push = [&](uint8_t op, int ch, int ir, int arg) {
        int c = 1;
        switch (op) {
            case OP_LOAD: c = 3 * N; break;
            case OP_MIRROR: c = 3 * N; break;
            case OP_FPASS:
            case OP_IPASS: c = arg <= 2 ? 2 * N : N; break;
            case OP_MAC0:
            case OP_MAC: c = 2 * K; break;
            case OP_STORE: c = K; break;
            case OP_FIN:
            case OP_MIX:
            case OP_MIX0: c = st.B; break;
            default: c = K / 4; break;
        }
        cost += c;
        o[n++] = Op{op, static_cast<uint8_t>(ch), static_cast<uint8_t>(ir), arg, c};
    };
    for (int c = 0; c < 2; ++c) {
        if (skipFwd) push(OP_ZSLOT, c, 0, 0);
        else {
            push(OP_LOAD, c, 0, 0);
            for (int h = 1; h < st.N; h <<= 1) push(OP_FPASS, c, 0, h);
            push(OP_STORE, c, 0, 0);
        }
    }
    for (int c = 0; c < 2; ++c) {
        if (skipOut) {
            push(OP_ZOUT, c, 0, 0);
            continue;
        }
        if (pa == 0) push(OP_ZOUT, c, 0, 0);
        else {
            for (int q = 0; q < pa; ++q) push(q == 0 ? OP_MAC0 : OP_MAC, c, 0, q);
            push(OP_MIRROR, c, 0, 0);
            for (int h = 1; h < st.N; h <<= 1) push(OP_IPASS, c, 0, h);
            push(OP_FIN, c, 0, 0);
        }
        if (st.b) {
            if (pb == 0) push(OP_MIX0, c, 1, 0);
            else {
                for (int q = 0; q < pb; ++q) push(q == 0 ? OP_MAC0 : OP_MAC, c, 1, q);
                push(OP_MIRROR, c, 1, 0);
                for (int h = 1; h < st.N; h <<= 1) push(OP_IPASS, c, 1, h);
                push(OP_MIX, c, 1, 0);
            }
        }
    }
    st.nOps = n;
    st.done = 0;
    st.ticksLeft = st.ticks;
    st.costLeft = cost;
    st.zero[static_cast<size_t>(1 - st.cur)] = skipOut || (pa == 0 && !st.b);
}

// Les operations suivantes du bloc en cours, jusqu'a depenser budget (au moins une)
void Convolver::runOps(Stage& st, long long budget) {
    const int s = static_cast<int>(&st - st_.data());
    const int K = st.K, N = st.N, Bs = st.B;
    float* wr = st.wRe.data();
    float* wi = st.wIm.data();
    for (long long spent = 0; st.done < st.nOps && spent < budget; ++st.done) {
        const Op op = st.ops[static_cast<size_t>(st.done)];
        spent += op.cost;
        st.costLeft -= op.cost;
        const size_t c = op.ch;
        float* out = st.out[static_cast<size_t>(1 - st.cur)][c].data();
        switch (op.op) {
            case OP_ZSLOT:
                std::fill_n(st.fRe[c].begin() + static_cast<long>(st.head) * K, K, 0.f);
                std::fill_n(st.fIm[c].begin() + static_cast<long>(st.head) * K, K, 0.f);
                break;
            case OP_LOAD: {
                // la trame : les 2 B echantillons qui finissent a l'instant T (l'anneau a avance depuis)
                const float* x = ring_[c].data() + (rpos_ + RING - static_cast<int>(n_ - st.T) - N);
                const int* rev = st.fft->rev.data();
                for (int i = 0; i < N; ++i) wr[rev[i]] = x[i];
                std::fill_n(wi, N, 0.f);
                break;
            }
            case OP_FPASS:
                st.fft->pass(wr, wi, op.arg, false);
                break;
            case OP_STORE:
                std::copy_n(wr, K, st.fRe[c].begin() + static_cast<long>(st.head) * K);
                std::copy_n(wi, K, st.fIm[c].begin() + static_cast<long>(st.head) * K);
                break;
            case OP_ZOUT:
                std::fill_n(out, Bs, 0.f);
                break;
            case OP_MAC0:
            case OP_MAC: {
                const ReverbIR* ir = op.ir ? st.b : st.a;
                const int slot = ((st.head - op.arg) % st.cap + st.cap) % st.cap;
                const float* xr = st.fRe[c].data() + static_cast<size_t>(slot) * static_cast<size_t>(K);
                const float* xi = st.fIm[c].data() + static_cast<size_t>(slot) * static_cast<size_t>(K);
                const float* hr = ir->re[static_cast<size_t>(s)][c].data() + static_cast<size_t>(op.arg) * static_cast<size_t>(K);
                const float* hi = ir->im[static_cast<size_t>(s)][c].data() + static_cast<size_t>(op.arg) * static_cast<size_t>(K);
                if (op.op == OP_MAC0)
                    for (int k = 0; k < K; ++k) {
                        wr[k] = xr[k] * hr[k] - xi[k] * hi[k];
                        wi[k] = xr[k] * hi[k] + xi[k] * hr[k];
                    }
                else
                    for (int k = 0; k < K; ++k) {
                        wr[k] += xr[k] * hr[k] - xi[k] * hi[k];
                        wi[k] += xr[k] * hi[k] + xi[k] * hr[k];
                    }
                break;
            }
            case OP_MIRROR:
                for (int k = 1; k < N / 2; ++k) {
                    wr[N - k] = wr[k];
                    wi[N - k] = -wi[k];
                }
                st.fft->permute(wr, wi);
                break;
            case OP_IPASS:
                st.fft->pass(wr, wi, op.arg, true);
                break;
            case OP_FIN: {
                const float g = 1.f / static_cast<float>(N);
                for (int i = 0; i < Bs; ++i) out[i] = wr[Bs + i] * g;
                break;
            }
            case OP_MIX: {
                const float g = 1.f / static_cast<float>(N);
                for (int i = 0; i < Bs; ++i) {
                    const float y = wr[Bs + i] * g;
                    out[i] += fadeGain(st.fade0 + i, fadeLen_) * (y - out[i]);
                }
                break;
            }
            case OP_MIX0:
                for (int i = 0; i < Bs; ++i) out[i] -= fadeGain(st.fade0 + i, fadeLen_) * out[i];
                break;
            default:
                break;
        }
    }
}

// Tous les 256 echantillons : les blocs qui commencent, une part du travail des grands blocs
void Convolver::tick() {
    promote();
    for (int s = 0; s < ReverbIR::kStages; ++s) {
        Stage& st = st_[static_cast<size_t>(s)];
        if (n_ % st.B == 0) {
            if (s > 0) {
                // le bloc d'avant est pret (son dernier tick l'a fini) : il sort maintenant
                if (st.done < st.nOps) runOps(st, st.costLeft + 1);
                st.cur = 1 - st.cur;
            }
            startJob(s);
        }
        if (st.done < st.nOps) {
            // une part egale du cout qui reste a chacun des ticks qui restent (le dernier finit tout)
            const int tl = std::max(1, st.ticksLeft);
            runOps(st, tl == 1 ? st.costLeft + 1 : (st.costLeft + tl - 1) / tl);
            if (st.ticksLeft > 0) --st.ticksLeft;
        }
        if (s == 0) st.cur = 1 - st.cur; // les blocs de 256 sortent tout de suite
    }
    retire();
}

void Convolver::process(const float* inL, const float* inR, float* outL, float* outR, int n) {
    const float* in[2] = {inL, inR};
    float* out[2] = {outL, outR};
    int done = 0;
    while (done < n) {
        const int m = std::min(n - done, B - fill_);
        // l'entree dans l'anneau (deux fois : une fenetre toujours contigue)
        bool nz = false;
        for (int c = 0; c < 2; ++c) {
            float* r = ring_[static_cast<size_t>(c)].data();
            const float* x = in[c] + done;
            for (int i = 0; i < m; ++i) {
                const int p = (rpos_ + i) & (RING - 1);
                r[p] = x[i];
                r[p + RING] = x[i];
                if (x[i] != 0) nz = true;
            }
        }
        if (nz) lastNZ_ = n_ + m - 1; // au bloc pres : le silence se compte en blocs
        // la sortie : les etages
        bool first = true;
        for (int s = 0; s < ReverbIR::kStages; ++s) {
            const Stage& st = st_[static_cast<size_t>(s)];
            if (st.zero[static_cast<size_t>(st.cur)]) continue;
            const int at = static_cast<int>(n_ & (st.B - 1));
            for (int c = 0; c < 2; ++c) {
                const float* y = st.out[static_cast<size_t>(st.cur)][static_cast<size_t>(c)].data() + at;
                float* o = out[c] + done;
                if (first)
                    for (int i = 0; i < m; ++i) o[i] = y[i];
                else
                    for (int i = 0; i < m; ++i) o[i] += y[i];
            }
            first = false;
        }
        if (first)
            for (int c = 0; c < 2; ++c) std::fill_n(out[c] + done, m, 0.f);
        // la tete, directe (sautee quand elle est nulle ou que rien n'est entre depuis 256 echantillons)
        const ReverbIR* ha = cur_.get();
        const ReverbIR* hb = headXf_ == 1 ? next_.get() : nullptr;
        if (headXf_ == 2 && next_) ha = next_.get();
        const bool headLive = (ha->headFrom < B || (hb && hb->headFrom < B)) && lastNZ_ > n_ - B;
        if (headLive) {
            for (int c = 0; c < 2; ++c) {
                const float* r = ring_[static_cast<size_t>(c)].data();
                float* o = out[c] + done;
                const int la = B - ha->headFrom;
                const int lb = hb ? B - hb->headFrom : 0;
                for (int i = 0; i < m; ++i) {
                    // x[n - 255 .. n], contigu dans la seconde copie de l'anneau
                    const float* x = r + ((rpos_ + i) & (RING - 1)) + RING - (B - 1);
                    float y = la > 0 ? dot(ha->head[static_cast<size_t>(c)].data(), x, la) : 0.f;
                    if (hb) {
                        const float yb = lb > 0 ? dot(hb->head[static_cast<size_t>(c)].data(), x, lb) : 0.f;
                        y += fadeGain(headFade_ + i, fadeLen_) * (yb - y);
                    }
                    o[i] += y;
                }
            }
        }
        if (headXf_ == 1) {
            headFade_ += m;
            if (headFade_ >= fadeLen_) headXf_ = 2;
        }
        rpos_ = (rpos_ + m) & (RING - 1);
        fill_ += m;
        n_ += m;
        done += m;
        if (fill_ == B) {
            fill_ = 0;
            tick();
        }
    }
}

/* ---------------- la section master du plugin ---------------- */

namespace {
constexpr double RAMP_S = 0.02;
constexpr double BASS_HZ = 120, AIR_HZ = 10000, WIDTH_HZ = 150, SHELF_K = 1.4142135623730951; // 1 / Q, Q = 0.7071
constexpr double WARM_BIAS = 0.06, WARM_GAIN = 2, WARM_REF = 0.3, WARM_DC_HZ = 5;
// la courbe de WARMTH : tanh a peine decalee, gain unite a l'origine, sans son continu a l'origine
inline double warmCurve(double x, double g, double inv, double tb) { return (std::tanh(g * x + WARM_BIAS) - tb) * inv; }
// Une demi-bande de Kaiser (la famille des decimateurs du moteur) : ses points pairs, le centre vaut 1/2 ; les
// points pairs sont normalises a 1/2 (gain 1 au continu, a l'aller comme au retour)
void halfband(int taps, double beta, std::array<double, 32>& even) {
    const double c = (taps - 1) / 2.0, i0b = besselI0(beta);
    double sum = 0;
    const int half = (taps + 1) / 2;
    for (int j = 0; j < half; ++j) {
        const double n = 2 * j - c;
        const double r = n / c;
        const double w = besselI0(beta * std::sqrt(std::max(0.0, 1 - r * r))) / i0b;
        even[static_cast<size_t>(j)] = std::sin(PI * n / 2) / (PI * n) * w;
        sum += even[static_cast<size_t>(j)];
    }
    for (int j = 0; j < half; ++j) even[static_cast<size_t>(j)] *= 0.5 / sum;
}
} // namespace

void Master::prepare(double sr) {
    sr_ = sr;
    rampN_ = std::max(1, static_cast<int>(jsRound(RAMP_S * sr)));
    hbA_.taps = 63;
    hbA_.half = 32;
    hbA_.c = 31;
    halfband(63, 8, hbA_.h);
    hbB_.taps = 31;
    hbB_.half = 16;
    hbB_.c = 15;
    halfband(31, 9, hbB_.h);
    wTb_ = std::tanh(WARM_BIAS);
    dcR_ = std::exp(-2 * PI * WARM_DC_HZ / sr);
    // la compensation de niveau : un sinus de 0.3 garde son RMS (le continu de la courbe retire, comme le bloqueur)
    for (int i = 0; i <= 64; ++i) {
        const double g = WARM_GAIN * i / 64.0;
        if (i == 0) {
            wKtab_[0] = 1;
            continue;
        }
        const double inv = 1 / (g * (1 - wTb_ * wTb_));
        double m = 0, e = 0;
        const int n = 512;
        for (int k = 0; k < n; ++k) {
            const double y = warmCurve(WARM_REF * std::sin(TAU * (k + 0.5) / n), g, inv, wTb_);
            m += y;
            e += y * y;
        }
        m /= n;
        wKtab_[static_cast<size_t>(i)] = (WARM_REF / std::sqrt(2.0)) / std::sqrt(std::max(1e-30, e / n - m * m));
    }
    bG0_ = std::tan(PI * std::min(BASS_HZ, 0.45 * sr) / sr);
    aG0_ = std::tan(PI * std::min(AIR_HZ, 0.45 * sr) / sr);
    const double g = std::tan(PI * std::min(WIDTH_HZ, 0.45 * sr) / sr);
    sF_.k = SHELF_K;
    sF_.a1 = 1 / (1 + g * (g + sF_.k));
    sF_.a2 = g * sF_.a1;
    sF_.a3 = g * sF_.a2;
    reset();
}

void Master::warmClear() {
    for (WarmCh& c : wc_) c = WarmCh();
    wI_ = wIb_ = wJb_ = wJa_ = 0;
}

// les etats a zero, les reglages poses sans rampe
void Master::reset() {
    warmClear();
    bF_.clear();
    aF_.clear();
    sF_.clear();
    wAmt_.setNow(wAmt_.target);
    wOn_.setNow(wAmt_.target > 0 ? 1 : 0);
    bDb_.setNow(bDb_.target);
    aDb_.setNow(aDb_.target);
    sW_.setNow(sW_.target);
    wActive_ = wAmt_.v > 0;
    bActive_ = bDb_.v != 0;
    aActive_ = aDb_.v != 0;
    sActive_ = sW_.v != 1;
    wAt_ = -1;
    if (bActive_) shelf(bF_, false, bDb_.v, bG0_);
    if (aActive_) shelf(aF_, true, aDb_.v, aG0_);
}

void Master::set(double warmth, double bass, double air, double width, bool now) {
    const double w = std::isfinite(warmth) ? clampd(warmth, 0, 1) : 0;
    const double bd = std::isfinite(bass) ? ArpFxLaws::shelfDb(bass) : 0;
    const double ad = std::isfinite(air) ? ArpFxLaws::shelfDb(air) : 0;
    const double sw = std::isfinite(width) ? 2 * clampd(width, 0, 1) : 1;
    if (now) {
        // poses : comme reset pour ce qui change (une section qui s'engage part d'etats a zero)
        if ((w > 0) != wActive_ || wAmt_.moving() || wOn_.moving()) warmClear();
        wHold_ = 0;
        wAmt_.setNow(w);
        wOn_.setNow(w > 0 ? 1 : 0);
        wActive_ = w > 0;
        wAt_ = -1;
        if (!bActive_) bF_.clear();
        bDb_.setNow(bd);
        bActive_ = bd != 0;
        if (bActive_) shelf(bF_, false, bd, bG0_);
        if (!aActive_) aF_.clear();
        aDb_.setNow(ad);
        aActive_ = ad != 0;
        if (aActive_) shelf(aF_, true, ad, aG0_);
        if (!sActive_) sF_.clear();
        sW_.setNow(sw);
        sActive_ = sw != 1;
        return;
    }
    if (w > 0 && !wActive_) {
        // elle s'engage : ses lignes se remplissent d'abord (64 echantillons, sortie inchangee), puis le fondu
        warmClear();
        wActive_ = true;
        wAt_ = -1;
        wHold_ = 64;
    }
    wAmt_.to(w, rampN_);
    wOn_.to(w > 0 ? 1 : 0, rampN_);
    if (bd != 0 && !bActive_) {
        bF_.clear();
        bActive_ = true;
        shelf(bF_, false, bDb_.v, bG0_);
    }
    bDb_.to(bd, rampN_);
    if (ad != 0 && !aActive_) {
        aF_.clear();
        aActive_ = true;
        shelf(aF_, true, aDb_.v, aG0_);
    }
    aDb_.to(ad, rampN_);
    if (sw != 1 && !sActive_) {
        sF_.clear();
        sActive_ = true;
    }
    sW_.to(sw, rampN_);
}

// Un plateau du second ordre (Simper, "SVF linear trapezoidal") : a 0 dB, m0 = 1 et m1 = m2 = 0 : la sortie est l'entree
void Master::shelf(Svf& f, bool high, double db, double g0) {
    const double A = std::pow(10.0, db / 40);
    const double g = high ? g0 * std::sqrt(A) : g0 / std::sqrt(A);
    f.k = SHELF_K;
    f.a1 = 1 / (1 + g * (g + f.k));
    f.a2 = g * f.a1;
    f.a3 = g * f.a2;
    if (high) {
        f.m0 = A * A;
        f.m1 = f.k * (1 - A) * A;
        f.m2 = 1 - A * A;
    } else {
        f.m0 = 1;
        f.m1 = f.k * (A - 1);
        f.m2 = A * A - 1;
    }
}

void Master::warmCoefs(double a) {
    if (a == wAt_) return;
    wAt_ = a;
    wG_ = WARM_GAIN * a;
    wInv_ = wG_ > 1e-6 ? 1 / (wG_ * (1 - wTb_ * wTb_)) : 0;
    const double t = clampd(a, 0, 1) * 64;
    const int i = std::min(63, static_cast<int>(t));
    wK_ = wKtab_[static_cast<size_t>(i)] + (t - i) * (wKtab_[static_cast<size_t>(i + 1)] - wKtab_[static_cast<size_t>(i)]);
}

void Master::process(float* L, float* R, int n) {
    if (bypassed()) return; // tout au neutre : la sortie d'avant, au bit pres
    float* io[2] = {L, R};
    for (int i = 0; i < n; ++i) {
        double x[2] = {L[i], R[i]};
        // 1. WARMTH : y = K (x retarde + la part non lineaire, surechantillonnee x4), fondue avec le sec
        if (wActive_) {
            const double a = wAmt_.next();
            double on = 0;
            if (wHold_ > 0) --wHold_;
            else on = wOn_.next();
            warmCoefs(a);
            const double ms = on;
            const double* eA = hbA_.h.data();
            const double* eB = hbB_.h.data();
            for (int c = 0; c < 2; ++c) {
                WarmCh& w = wc_[c];
                const double xin = x[c];
                w.dry[static_cast<size_t>(wI_ & 63)] = xin;
                w.upA[static_cast<size_t>(wI_ & 63)] = xin;
                // 1x -> 2x : le point pair (les 32 points pairs de la demi-bande), le point impair (un retard de 15)
                double a2[2];
                double acc = 0;
                for (int j = 0; j < 32; ++j) acc += eA[j] * w.upA[static_cast<size_t>((wI_ - j) & 63)];
                a2[0] = 2 * acc;
                a2[1] = w.upA[static_cast<size_t>((wI_ - 15) & 63)];
                double y1 = 0;
                for (int q = 0; q < 2; ++q) {
                    const int ib = wIb_ + q;
                    w.upB[static_cast<size_t>(ib & 31)] = a2[q];
                    // 2x -> 4x
                    double b4[2];
                    acc = 0;
                    for (int j = 0; j < 16; ++j) acc += eB[j] * w.upB[static_cast<size_t>((ib - j) & 31)];
                    b4[0] = 2 * acc;
                    b4[1] = w.upB[static_cast<size_t>((ib - 7) & 31)];
                    for (int r = 0; r < 2; ++r) {
                        // la part non lineaire seule : la courbe moins l'entree
                        const double v = b4[r];
                        const double hv = wInv_ != 0 ? warmCurve(v, wG_, wInv_, wTb_) - v : 0;
                        const int jb = wJb_ + 2 * q + r;
                        w.dnB[static_cast<size_t>(jb & 63)] = hv;
                        if (r == 0) {
                            // 4x -> 2x (apres 2 echantillons de plus : le retard total tombe sur un entier, 39)
                            acc = 0.5 * w.dnB[static_cast<size_t>((jb - 2 - 15) & 63)];
                            for (int j = 0; j < 16; ++j) acc += eB[j] * w.dnB[static_cast<size_t>((jb - 2 - 2 * j) & 63)];
                            const int ja = wJa_ + q;
                            w.dnA[static_cast<size_t>(ja & 63)] = acc;
                            if (q == 0) {
                                // 2x -> 1x
                                y1 = 0.5 * w.dnA[static_cast<size_t>((ja - 31) & 63)];
                                for (int j = 0; j < 32; ++j) y1 += eA[j] * w.dnA[static_cast<size_t>((ja - 2 * j) & 63)];
                            }
                        }
                    }
                }
                // le bloqueur de continu, sur la part non lineaire seule
                const double hd = y1 - w.dcX + dcR_ * w.dcY;
                w.dcX = y1;
                w.dcY = std::fabs(hd) < 1e-30 ? 0 : hd;
                const double y = wK_ * (w.dry[static_cast<size_t>((wI_ - kLatency) & 63)] + w.dcY);
                x[c] = ms >= 1 ? y : xin + ms * (y - xin);
            }
            wI_ += 1;
            wIb_ += 2;
            wJb_ += 4;
            wJa_ += 2;
            if (!wAmt_.moving() && !wOn_.moving() && wAmt_.v == 0) wActive_ = false;
        }
        // 2. BASS, 3. AIR
        for (int e = 0; e < 2; ++e) {
            bool& act = e == 0 ? bActive_ : aActive_;
            if (!act) continue;
            Glide& gl = e == 0 ? bDb_ : aDb_;
            Svf& f = e == 0 ? bF_ : aF_;
            if (gl.moving()) shelf(f, e == 1, gl.next(), e == 0 ? bG0_ : aG0_);
            for (int c = 0; c < 2; ++c) {
                const double v0 = x[c];
                const double v3 = v0 - f.ic2[c];
                const double v1 = f.a1 * f.ic1[c] + f.a2 * v3;
                const double v2 = f.ic2[c] + f.a2 * f.ic1[c] + f.a3 * v3;
                f.ic1[c] = 2 * v1 - f.ic1[c];
                f.ic2[c] = 2 * v2 - f.ic2[c];
                x[c] = f.m0 * v0 + f.m1 * v1 + f.m2 * v2;
            }
            if (!gl.moving() && gl.v == 0) act = false; // 0 dB : la sortie etait deja l'entree, exactement
        }
        // 4. WIDTH : le cote x w (w <= 1), ou le cote + (w - 1) x son passe-haut a 150 Hz (w > 1)
        if (sActive_) {
            const double w = sW_.next();
            const double M = 0.5 * (x[0] + x[1]), S = 0.5 * (x[0] - x[1]);
            const double v3 = S - sF_.ic2[0];
            const double v1 = sF_.a1 * sF_.ic1[0] + sF_.a2 * v3;
            const double v2 = sF_.ic2[0] + sF_.a2 * sF_.ic1[0] + sF_.a3 * v3;
            sF_.ic1[0] = 2 * v1 - sF_.ic1[0];
            sF_.ic2[0] = 2 * v2 - sF_.ic2[0];
            const double hp = S - sF_.k * v1 - v2;
            const double S2 = w <= 1 ? w * S : S + (w - 1) * hp;
            x[0] = M + S2;
            x[1] = M - S2;
            if (!sW_.moving() && sW_.v == 1) sActive_ = false;
        }
        io[0][i] = static_cast<float>(x[0]);
        io[1][i] = static_cast<float>(x[1]);
    }
    // les etats des filtres qui s'eteignent : jamais de sous-normaux (comme le rincage des biquads du site)
    for (Svf* f : {&bF_, &aF_, &sF_})
        for (int c = 0; c < 2; ++c) {
            if (std::fabs(f->ic1[c]) < 1e-20) f->ic1[c] = 0;
            if (std::fabs(f->ic2[c]) < 1e-20) f->ic2[c] = 0;
        }
}

/* ---------------- le rack d'effets du 2026-11-11 : CRUSH, PHASER, FLANGER ---------------- */

namespace {
constexpr double CRUSH_IN = 20;        // la dose de CRUSH / DOWNSAMPLE entre sur 1 / 20 de la course
constexpr double PH_HZ = 800, PH_OCT = 2.5, PH_FB = 0.85;
constexpr double FL_D0_S = 0.0025, FL_FB = 0.8;
constexpr double PUMP_ATK_S = 0.002, PUMP_SLEW_S = 0.0005;
constexpr double SH_WIN_S = 0.09, SH_GAIN = 0.65, SH_LP = 0.2, SH_HP_HZ = 250, SH_POST_HZ = 7000, SH_MAX = 8;
inline double fin01(double v, double def) { return std::isfinite(v) ? clampd(v, 0, 1) : def; }
inline bool isZero(double v) { return !(v < 0 || v > 0); }
inline double flush(double v) { return std::fabs(v) < 1e-20 ? 0 : v; }
// Lagrange d'ordre 3 : la ligne b (masque m) lue d echantillons avant w (d >= 1)
inline double readLag3(const float* b, int m, int w, double d) {
    const int di = static_cast<int>(d);
    const double f = d - di + 1;
    const double c0 = -((f - 1) * (f - 2) * (f - 3)) / 6, c1 = (f * (f - 2) * (f - 3)) / 2, c2 = -(f * (f - 1) * (f - 3)) / 2, c3 = (f * (f - 1) * (f - 2)) / 6;
    return c0 * b[(w - di + 1) & m] + c1 * b[(w - di) & m] + c2 * b[(w - di - 1) & m] + c3 * b[(w - di - 2) & m];
}
} // namespace

void PreFx::prepare(double sr) {
    sr_ = sr;
    rampN_ = std::max(1, static_cast<int>(jsRound(RAMP_S * sr)));
    flD0_ = std::max(8, static_cast<int>(jsRound(FL_D0_S * sr)));
    int len = 64;
    while (len < 2 * flD0_ + 16) len *= 2;
    flMask_ = len - 1;
    for (int c = 0; c < 2; ++c) {
        flDry_[c].assign(static_cast<size_t>(len), 0.f);
        flWet_[c].assign(static_cast<size_t>(len), 0.f);
    }
    reset();
}

// les etats a zero, les reglages poses sans rampe
void PreFx::reset() {
    for (Ramp* r : {&crBits_, &crRate_, &phMix_, &phDepth_, &phFb_, &flMix_, &flDepth_, &flFb_}) r->setNow(r->target);
    crOn_ = crBits_.v > 0 || crRate_.v > 0;
    phOn_ = phMix_.v > 0;
    flOn_ = flMix_.v > 0;
    flOnR_.setNow(flOn_ ? 1 : 0);
    crRateAt_ = crBitsAt_ = -1;
    crPhase_ = 0;
    for (Svf& f : crLp_) f.ic1[0] = f.ic1[1] = f.ic2[0] = f.ic2[1] = 0;
    crPrev_[0] = crPrev_[1] = crHold_[0] = crHold_[1] = 0;
    phPhase_ = 0;
    phCtl_ = -1;
    for (int c = 0; c < 2; ++c) {
        phLast_[c] = flLast_[c] = 0;
        for (double& z : phZ_[c]) z = 0;
        std::fill(flDry_[c].begin(), flDry_[c].end(), 0.f);
        std::fill(flWet_[c].begin(), flWet_[c].end(), 0.f);
    }
    flPhase_ = 0;
    flW_ = 0;
    tick_ = 0;
}

void PreFx::set(const ArpFxSettings& s, bool now) {
    const double cb = fin01(s.crushBits, 0), cr = fin01(s.crushRate, 0);
    const double pm = fin01(s.phMix, 0), pd = fin01(s.phDepth, 0.6), pf = PH_FB * fin01(s.phFb, 0.4);
    const double fm = fin01(s.flMix, 0), fd = fin01(s.flDepth, 0.6);
    const double ff = FL_FB * (std::isfinite(s.flFb) ? clampd(s.flFb, -1, 1) : 0);
    phHz_ = ArpFxLaws::phaserHz(fin01(s.phRate, 0.3));
    flHz_ = ArpFxLaws::flangerHz(fin01(s.flRate, 0.25));
    if (now) {
        // poses : une section qui s'engage part d'etats a zero
        const bool was[3] = {crOn_, phOn_, flOn_};
        crBits_.target = cb;
        crRate_.target = cr;
        phMix_.target = pm;
        phDepth_.target = pd;
        phFb_.target = pf;
        flMix_.target = fm;
        flDepth_.target = fd;
        flFb_.target = ff;
        const double phase[2] = {phPhase_, flPhase_};
        const bool keep = (was[0] || !(cb > 0 || cr > 0)) && (was[1] || !(pm > 0)) && (was[2] || !(fm > 0));
        if (keep) {
            // rien ne s'engage : les etats restent (un reglage pose en cours de jeu)
            for (Ramp* r : {&crBits_, &crRate_, &phMix_, &phDepth_, &phFb_, &flMix_, &flDepth_, &flFb_}) r->setNow(r->target);
            crOn_ = cb > 0 || cr > 0;
            phOn_ = pm > 0;
            flOn_ = fm > 0;
            flOnR_.setNow(flOn_ ? 1 : 0);
        } else {
            reset();
            phPhase_ = phase[0];
            flPhase_ = phase[1];
        }
        return;
    }
    // CRUSH : les etats du reducteur repartent de zero quand il s'engage
    if (cr > 0 && isZero(crRate_.v) && !crRate_.moving()) {
        for (Svf& f : crLp_) f.ic1[0] = f.ic1[1] = f.ic2[0] = f.ic2[1] = 0;
        crPrev_[0] = crPrev_[1] = crHold_[0] = crHold_[1] = 0;
        crPhase_ = 0;
        crRateAt_ = -1;
    }
    if (cb > 0 || cr > 0) crOn_ = true;
    crBits_.to(cb, rampN_);
    crRate_.to(cr, rampN_);
    // PHASER
    if (pm > 0 && !phOn_) {
        for (int c = 0; c < 2; ++c) {
            phLast_[c] = 0;
            for (double& z : phZ_[c]) z = 0;
        }
        phCtl_ = -1;
        phOn_ = true;
        phDepth_.setNow(pd);
        phFb_.setNow(pf);
    }
    phMix_.to(pm, rampN_);
    phDepth_.to(pd, rampN_);
    phFb_.to(pf, rampN_);
    // FLANGER : il s'engage par un fondu vers sa chaine (le sec y est retarde), la dose a sa valeur d'emblee
    if (fm > 0 && !flOn_) {
        for (int c = 0; c < 2; ++c) {
            flLast_[c] = 0;
            std::fill(flDry_[c].begin(), flDry_[c].end(), 0.f);
            std::fill(flWet_[c].begin(), flWet_[c].end(), 0.f);
        }
        flOn_ = true;
        flOnR_.setNow(0);
        flMix_.setNow(fm);
        flDepth_.setNow(fd);
        flFb_.setNow(ff);
    }
    if (fm > 0) {
        flOnR_.to(1, rampN_);
        flMix_.to(fm, rampN_);
    } else
        flOnR_.to(0, rampN_);
    flDepth_.to(fd, rampN_);
    flFb_.to(ff, rampN_);
}

void PreFx::crushCoefs(double vr, double vb) {
    if (vr < crRateAt_ || vr > crRateAt_) {
        crRateAt_ = vr;
        const double fs = ArpFxLaws::crushHz(vr, sr_);
        crInc_ = std::min(1.0, fs / sr_);
        // le passe-bas d'avant : 4e ordre (deux etages Q 0.707) a la moitie du taux vise
        const double g = std::tan(PI * std::min(0.5 * fs, 0.45 * sr_) / sr_);
        for (Svf& f : crLp_) {
            f.a1 = 1 / (1 + g * (g + 1.4142135623730951));
            f.a2 = g * f.a1;
            f.a3 = g * f.a2;
        }
    }
    if (vb < crBitsAt_ || vb > crBitsAt_) {
        crBitsAt_ = vb;
        crQ_ = std::pow(2.0, ArpFxLaws::crushBitDepth(vb) - 1);
    }
}

void PreFx::process(float* L, float* R, int n) {
    if (bypassed()) return; // tout au neutre : l'entree, au bit pres
    for (int i = 0; i < n; ++i) {
        double x[2] = {L[i], R[i]};
        // 1. CRUSH : l'echantillonnage (passe-bas, bloqueur a l'instant exact) puis les bits
        if (crOn_) {
            const double vr = crRate_.next(), vb = crBits_.next();
            crushCoefs(vr, vb);
            if (vr > 0) {
                const double w = std::min(1.0, vr * CRUSH_IN);
                crPhase_ += crInc_;
                const bool tick = crPhase_ >= 1;
                if (tick) crPhase_ -= 1;
                const double back = tick ? crPhase_ / crInc_ : 0; // depuis l'instant de la prise, en echantillons
                for (int c = 0; c < 2; ++c) {
                    double v = x[c];
                    for (Svf& f : crLp_) {
                        const double v3 = v - f.ic2[c];
                        const double v1 = f.a1 * f.ic1[c] + f.a2 * v3;
                        const double v2 = f.ic2[c] + f.a2 * f.ic1[c] + f.a3 * v3;
                        f.ic1[c] = 2 * v1 - f.ic1[c];
                        f.ic2[c] = 2 * v2 - f.ic2[c];
                        v = v2;
                    }
                    if (tick) crHold_[c] = v - (v - crPrev_[c]) * back;
                    crPrev_[c] = v;
                    x[c] += w * (crHold_[c] - x[c]);
                }
            }
            if (vb > 0) {
                const double w = std::min(1.0, vb * CRUSH_IN);
                for (int c = 0; c < 2; ++c) x[c] += w * (std::floor(x[c] * crQ_ + 0.5) / crQ_ - x[c]);
            }
            if (!crRate_.moving() && !crBits_.moving() && isZero(crRate_.v) && isZero(crBits_.v)) crOn_ = false;
        }
        // 2. PHASER : six passe-tout du premier ordre par canal, la droite un quart de cycle apres
        if (phOn_) {
            const double m = phMix_.next(), dep = phDepth_.next(), fb = phFb_.next();
            if (phCtl_ <= 0) {
                // le balayage, toutes les 16 echantillons (le coefficient glisse entre deux)
                const bool first = phCtl_ < 0;
                phCtl_ = kCtl;
                phPhase_ += kCtl * phHz_ / sr_;
                phPhase_ -= std::floor(phPhase_);
                for (int c = 0; c < 2; ++c) {
                    const double lfo = std::sin(TAU * (phPhase_ + 0.25 * c));
                    const double hz = std::min(0.4 * sr_, PH_HZ * std::pow(2.0, PH_OCT * dep * lfo));
                    const double t = std::tan(PI * hz / sr_);
                    const double a = (t - 1) / (t + 1);
                    if (first) phA_[c] = a;
                    phDa_[c] = (a - phA_[c]) / kCtl;
                }
            }
            --phCtl_;
            for (int c = 0; c < 2; ++c) {
                phA_[c] += phDa_[c];
                const double a = phA_[c];
                double y = x[c] + fb * phLast_[c];
                for (double& z : phZ_[c]) {
                    const double o = a * y + z;
                    z = y - a * o;
                    y = o;
                }
                phLast_[c] = y;
                x[c] += 0.5 * m * (y - x[c]);
            }
            if (!phMix_.moving() && isZero(phMix_.v)) phOn_ = false;
        }
        // 3. FLANGER a travers zero : le sec retarde de D0, le mouille balaie de 0 a 2 D0
        if (flOn_) {
            const double on = flOnR_.next(), m = flMix_.next(), dep = flDepth_.next(), fb = flFb_.next();
            flPhase_ += flHz_ / sr_;
            flPhase_ -= std::floor(flPhase_);
            const double afb = std::fabs(fb);
            for (int c = 0; c < 2; ++c) {
                const double lfo = std::sin(TAU * (flPhase_ + 0.25 * c));
                const double d = std::max(1.0, flD0_ * (1 + (1 - dep) * 0.5 + dep * lfo));
                flDry_[c][static_cast<size_t>(flW_)] = static_cast<float>(x[c]);
                flWet_[c][static_cast<size_t>(flW_)] = static_cast<float>(flush(x[c] + fb * flLast_[c]));
                const double dry = flDry_[c][static_cast<size_t>((flW_ - flD0_) & flMask_)];
                const double wet = readLag3(flWet_[c].data(), flMask_, flW_, d);
                flLast_[c] = wet;
                const double y = (dry + m * wet * (1 - 0.45 * afb)) / (1 + 0.3 * m);
                x[c] += on * (y - x[c]);
            }
            flW_ = (flW_ + 1) & flMask_;
            if (!flOnR_.moving() && isZero(flOnR_.v)) flOn_ = false;
        }
        L[i] = static_cast<float>(x[0]);
        R[i] = static_cast<float>(x[1]);
        // jamais de sous-normaux dans les etats qui s'eteignent : rinces tous les 128 echantillons (a son propre
        // compte : le resultat ne depend pas de la taille des blocs)
        if ((++tick_ & 127) == 0)
            for (int c = 0; c < 2; ++c) {
                for (Svf& f : crLp_) {
                    f.ic1[c] = flush(f.ic1[c]);
                    f.ic2[c] = flush(f.ic2[c]);
                }
                for (double& z : phZ_[c]) z = flush(z);
                phLast_[c] = flush(phLast_[c]);
                flLast_[c] = flush(flLast_[c]);
            }
    }
}

/* ---------------- PUMP ---------------- */

void Pump::prepare(double sr) {
    sr_ = sr;
    rampN_ = std::max(1, static_cast<int>(jsRound(RAMP_S * sr)));
    k_ = 1 - std::exp(-1 / (PUMP_SLEW_S * sr));
    reset();
}

void Pump::reset() {
    depth_.setNow(depth_.target);
    on_ = depth_.v > 0;
    g_ = 1;
}

void Pump::set(double depth, int rate, double shape, bool now) {
    const double d = fin01(depth, 0);
    beats_ = ArpFxLaws::pumpBeats(rate);
    shape_ = fin01(shape, 0.5);
    if (now) {
        depth_.setNow(d);
        if (!(d > 0)) g_ = 1;
        on_ = d > 0;
        return;
    }
    if (d > 0 && !on_) {
        on_ = true;
        g_ = 1;
    }
    depth_.to(d, rampN_);
}

void Pump::process(float* L, float* R, int n, double ppq, double pps, bool playing) {
    if (!on_) return; // au neutre : la sortie d'avant, au bit pres
    const bool run = playing && pps > 0 && std::isfinite(ppq);
    const double per = run ? beats_ / pps : 1;          // la periode, en echantillons
    const double atk = std::min(PUMP_ATK_S * sr_, 0.25 * per);
    const double rel = std::max(atk, std::min((0.15 + 0.8 * shape_) * per, per - atk));
    for (int i = 0; i < n; ++i) {
        const double dep = depth_.next();
        double env = 0;
        if (run) {
            const double c = (ppq + i * pps) / beats_;
            const double ph = c - std::floor(c);
            const double since = ph * per, until = per - since;
            if (until < atk) {
                // la plongee, dans les 2 ms qui precedent le temps
                env = 0.5 - 0.5 * std::cos(PI * (1 - until / atk));
            } else if (since < rel) {
                const double u = since / rel;
                env = (1 - u) * (1 - u) * (1 + 2 * u);
            }
        }
        const double tgt = env > 0 && dep > 0 ? std::exp(ArpFxLaws::pumpDb(dep) * env * 0.11512925464970229) : 1;
        g_ += (tgt - g_) * k_;
        if (std::fabs(1 - g_) < 1e-9) g_ = 1;
        L[i] = static_cast<float>(L[i] * g_);
        R[i] = static_cast<float>(R[i] * g_);
        if (!depth_.moving() && isZero(depth_.v) && !(g_ < 1 || g_ > 1)) {
            on_ = false;
            return;
        }
    }
}

/* ---------------- SHIMMER ---------------- */

void Shimmer::prepare(double sr) {
    sr_ = sr;
    rampN_ = std::max(1, static_cast<int>(jsRound(RAMP_S * sr)));
    W_ = 2 * std::max(64, static_cast<int>(jsRound(0.5 * SH_WIN_S * sr)));
    int len = 256;
    while (len < W_ + 8) len *= 2;
    mask_ = len - 1;
    for (auto& b : buf_) b.assign(static_cast<size_t>(len), 0.f);
    win_.assign(static_cast<size_t>(W_), 0.f);
    for (int k = 0; k < W_; ++k) {
        const double sn = std::sin(PI * k / W_);
        win_[static_cast<size_t>(k)] = static_cast<float>(sn * sn);
    }
    // avant la lecture a vitesse double : un passe-bas du 4e ordre a 0.2 x sr, un passe-haut a 250 Hz
    const double g = std::tan(PI * SH_LP);
    for (Svf* f : {&lp1_, &lp2_}) {
        f->a1 = 1 / (1 + g * (g + f->k));
        f->a2 = g * f->a1;
        f->a3 = g * f->a2;
    }
    const double gh = std::tan(PI * std::min(SH_HP_HZ, 0.4 * sr) / sr);
    hp_.a1 = 1 / (1 + gh * (gh + hp_.k));
    hp_.a2 = gh * hp_.a1;
    hp_.a3 = gh * hp_.a2;
    postK_ = 1 - std::exp(-TAU * std::min(SH_POST_HZ, 0.4 * sr) / sr);
    reset();
}

void Shimmer::reset() {
    gain_.setNow(gain_.target);
    on_ = gain_.v > 0;
    for (int c = 0; c < 2; ++c) {
        std::fill(buf_[c].begin(), buf_[c].end(), 0.f);
        hist_[c].fill(0.f);
        post_[c] = 0;
    }
    for (Svf* f : {&lp1_, &lp2_, &hp_}) f->ic1[0] = f->ic1[1] = f->ic2[0] = f->ic2[1] = 0;
    w_ = 0;
    k_ = 0;
    drain_ = 0;
}

void Shimmer::set(double amount, bool now) {
    const double g = SH_GAIN * fin01(amount, 0);
    if (now) {
        const bool was = on_;
        gain_.target = g;
        if (g > 0 && !was) reset();
        gain_.setNow(g);
        on_ = g > 0;
        if (!on_) reset();
        return;
    }
    if (g > 0 && !on_) {
        gain_.setNow(0);
        reset();
        on_ = true;
    }
    gain_.to(g, rampN_);
}

void Shimmer::process(const float* revL, const float* revR, int q0, int n) {
    if (!on_) return;
    const float* in[2] = {revL, revR};
    const int half = W_ / 2;
    for (int i = 0; i < n; ++i) {
        const double gv = gain_.next();
        const int k2 = k_ + half < W_ ? k_ + half : k_ + half - W_;
        const double w1 = win_[static_cast<size_t>(k_)], w2 = 1 - w1;
        for (int c = 0; c < 2; ++c) {
            double v = in[c][i];
            for (Svf* f : {&lp1_, &lp2_}) {
                const double v3 = v - f->ic2[c];
                const double v1 = f->a1 * f->ic1[c] + f->a2 * v3;
                const double v2 = f->ic2[c] + f->a2 * f->ic1[c] + f->a3 * v3;
                f->ic1[c] = 2 * v1 - f->ic1[c];
                f->ic2[c] = 2 * v2 - f->ic2[c];
                v = v2;
            }
            {
                const double v3 = v - hp_.ic2[c];
                const double v1 = hp_.a1 * hp_.ic1[c] + hp_.a2 * v3;
                const double v2 = hp_.ic2[c] + hp_.a2 * hp_.ic1[c] + hp_.a3 * v3;
                hp_.ic1[c] = 2 * v1 - hp_.ic1[c];
                hp_.ic2[c] = 2 * v2 - hp_.ic2[c];
                v = v - hp_.k * v1 - v2;
            }
            float* b = buf_[c].data();
            b[w_] = static_cast<float>(flush(v));
            // deux tetes a vitesse double (le retard descend d'un echantillon par echantillon), en fondu
            const double o = w1 * b[(w_ - (W_ - k_)) & mask_] + w2 * b[(w_ - (W_ - k2)) & mask_];
            post_[c] = flush(post_[c] + (o - post_[c]) * postK_);
            hist_[c][static_cast<size_t>(q0 + i)] = static_cast<float>(clampd(gv * post_[c], -SH_MAX, SH_MAX));
        }
        w_ = (w_ + 1) & mask_;
        if (++k_ == W_) k_ = 0;
        if ((w_ & 127) == 0)
            for (Svf* f : {&lp1_, &lp2_, &hp_})
                for (int c = 0; c < 2; ++c) {
                    f->ic1[c] = flush(f->ic1[c]);
                    f->ic2[c] = flush(f->ic2[c]);
                }
        // coupe : il s'eteint quand tout son retour (128 echantillons) est a zero, ou que tombe la fin du bloc
        if (!gain_.moving() && isZero(gain_.v)) {
            if (++drain_ >= Q) {
                on_ = false;
                return;
            }
        } else
            drain_ = 0;
    }
}

} // namespace detail

/* ---------------- ArpFx ---------------- */

void ArpFx::prepare(double sampleRate, int maxBlock) {
    sr_ = sampleRate;
    maxBlock_ = std::max(1, maxBlock);
    const size_t q = Q;
    for (auto* b : {&bHiL_, &bHiR_, &bJL_, &bJR_, &bTL_, &bTR_, &bTo_L_, &bTo_R_, &bTime_, &bRL_, &bRR_, &bRoL_, &bRoR_, &bPreL_, &bPreR_}) b->assign(q, 0.f);
    pre_.prepare(sr_);
    pump_.prepare(sr_);
    shim_.prepare(sr_);
    juno_.prepare(sr_);
    tape_.prepare(sr_, PP_MAX_S);
    dl_.prepare(PP_MAX_S, sr_);
    dr_.prepare(PP_MAX_S, sr_);
    conv_.prepare(sr_, detail::Convolver::make(sr_, have_ ? cur_.revSize : 0.5, have_ ? cur_.revTone : 0.5, have_ ? cur_.revPre : 0.2));
    master_.prepare(sr_);
    dHp_.set(false, PP_HIGHPASS, static_cast<float>(WEB_Q_DEFAULT), sr_);
    lpL_.set(true, PP_LOWPASS, static_cast<float>(WEB_Q_DEFAULT), sr_);
    lpR_ = lpL_;
    dHpR_ = dHp_;
    dMode_ = dWant_ = have_ ? std::min(2, std::max(0, cur_.dlyMode)) : 0;
    dXf_.setNow(1);
    dFbL_ = dFbR_ = 0;
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
    dHpR_.clear();
    lpL_.clear();
    lpR_.clear();
    lpHist_.fill(0);
    lpHistI_ = 0;
    qFb_ = tFb_.value();
    qTape_ = tAmt_.value();
    if (have_) reset();
}

void ArpFx::glide(detail::Param& p, double target) {
    const double now = static_cast<double>(frame_) / sr_;
    p.rampTo(now, now + GLIDE_S, static_cast<float>(target), sr_);
}

void ArpFx::retime(detail::Param& p, double t) {
    const double now = static_cast<double>(frame_) / sr_;
    const double from = p.value();
    p.rampTo(now, now + std::max(PP_RETIME_S, std::fabs(t - from) / PP_RETIME_RATE), static_cast<float>(t), sr_);
}

// insert.ts ramp : 20 ms, ou tenue jusqu'a notBefore (la branche neuve se remplit) puis 20 ms
void ArpFx::insertRamp(detail::Param& p, float v) {
    const double now = static_cast<double>(frame_) / sr_;
    if (notBefore_ <= now) {
        glide(p, v);
        return;
    }
    p.rampTo(notBefore_, notBefore_ + GLIDE_S, v, sr_);
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
    teardownAt_ = static_cast<double>(frame_) / sr_ + UNLINK_S;
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
        notBefore_ = static_cast<double>(frame_) / sr_ + JUNO_PREROLL_S;
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
    master_.set(s.warmth, s.bass, s.air, s.width, now);
    // Le rack du 2026-11-11
    pre_.set(s, now);
    pump_.set(s.pumpDepth, s.pumpRate, s.pumpShape, now);
    shim_.set(s.shimmer, now);
    const int dm = std::min(2, std::max(0, s.dlyMode));
    if (now) {
        if (dm != dMode_) {
            delayClear();
            dMode_ = dm;
        }
        dWant_ = dm;
        dXf_.setNow(1);
    } else if (dm != dWant_) {
        // le mouille du delay descend (20 ms), les lignes sont videes, il remonte dans le mode neuf
        dWant_ = dm;
        dXf_.to(dm != dMode_ ? 0 : 1, std::max(1, static_cast<int>(jsRound(GLIDE_S * sr_))));
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

void ArpFx::delayClear() {
    std::fill(dl_.buf.begin(), dl_.buf.end(), 0.f);
    std::fill(dr_.buf.begin(), dr_.buf.end(), 0.f);
    dHp_.clear();
    dHpR_.clear();
    lpL_.clear();
    lpR_.clear();
    lpHist_.fill(0);
    dFbL_ = dFbR_ = 0;
}

void ArpFx::reset() {
    pre_.reset();
    pump_.reset();
    shim_.reset();
    dHpR_.clear();
    dFbL_ = dFbR_ = 0;
    dXf_.setNow(1);
    tape_.reset();
    std::fill(dl_.buf.begin(), dl_.buf.end(), 0.f);
    std::fill(dr_.buf.begin(), dr_.buf.end(), 0.f);
    dl_.w = dr_.w = 0;
    conv_.reset();
    master_.reset();
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
        const float* pL = inL + done;
        const float* pR = inR + done;
        if (!pre_.bypassed()) {
            // CRUSH, PHASER, FLANGER : sur une copie de l'entree (au neutre : l'entree elle-meme)
            std::copy(pL, pL + len, bPreL_.data());
            std::copy(pR, pR + len, bPreR_.data());
            pre_.process(bPreL_.data(), bPreR_.data(), len);
            pL = bPreL_.data();
            pR = bPreR_.data();
        }
        processPiece(pL, pR, outL + done, outR + done, len);
        if (!pump_.bypassed()) pump_.process(outL + done, outR + done, len, ppq_ + done * pps_, pps_, playing_);
        done += len;
    }
    ppq_ += n * pps_; // (sans setTransport avant le prochain bloc : la position continue)
    // la section master du plugin, apres tout le reste (contournee au neutre)
    master_.process(outL, outR, n);
}

std::shared_ptr<const ReverbIR> ArpFx::makeReverb(double sampleRate, double size, double tone, double pre) {
    return detail::Convolver::make(sampleRate, size, tone, pre);
}

bool ArpFx::setReverb(std::shared_ptr<const ReverbIR> ir) { return conv_.set(ir); }

// Un morceau d'un bloc de rendu de 128 (jamais a cheval sur deux)
void ArpFx::processPiece(const float* inL, const float* inR, float* outL, float* outR, int n) {
    const bool qStart = frame_ % Q == 0;
    const bool qEnd = (frame_ + n) % Q == 0;
    // Le CHORUS revenu au repos depuis 60 ms : la branche part (insert.ts toDirect)
    if (teardownAt_ >= 0 && static_cast<double>(frame_) / sr_ >= teardownAt_) {
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
    splitHz_.fill(frame_, n, aSplit_.data());
    low_.fill(frame_, n, aLow_.data());
    vol_.fill(frame_, n, aVol_.data());
    dSend_.fill(frame_, n, aDs_.data());
    fb_.fill(frame_, n, aFb_.data());
    dTime_.fill(frame_, n, aDt_.data());
    tSend_.fill(frame_, n, aTs_.data());
    tTime_.fill(frame_, n, aTt_.data());
    rSend_.fill(frame_, n, aRs_.data());
    if (!direct_) {
        dry_.fill(frame_, n, aDry_.data());
        wet_.fill(frame_, n, aWet_.data());
    }
    float* hiL = bHiL_.data();
    float* hiR = bHiR_.data();
    float* lo = bRoL_.data(); // le bas, avant son gain (tampon partage avec la reverb : relu avant elle)
    // 1. BASS MONO : le haut (stereo), le bas en mono (L + R) / 2
    for (int i = 0; i < n; ++i) {
        splitCoefs(aSplit_[static_cast<size_t>(i)]);
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
    bool dXf = dMode_ != dWant_ || dXf_.moving();
    const bool shOn = !shim_.bypassed();
    const int q0 = static_cast<int>(frame_ % Q);
    for (int i = 0; i < n; ++i) {
        float cL, cR;
        if (direct_) {
            cL = hiL[i];
            cR = hiR[i];
        } else {
            const float dg = aDry_[static_cast<size_t>(i)], wg = aWet_[static_cast<size_t>(i)];
            const float jL = branch_ ? bJL_[static_cast<size_t>(i)] : 0.f;
            const float jR = branch_ ? bJR_[static_cast<size_t>(i)] : 0.f;
            cL = hiL[i] * dg + jL * wg;
            cR = hiR[i] * dg + jR * wg;
        }
        const float v = aVol_[static_cast<size_t>(i)];
        const float vL = cL * v, vR = cR * v;
        const float lg = lo[i] * aLow_[static_cast<size_t>(i)];
        dL[i] = vL + lg;
        dR[i] = vR + lg;
        // DELAY : l'envoi, le passe-haut, gauche <-> droite (la droite lit le passe-bas gauche du bloc d'avant)
        const float ds = aDs_[static_cast<size_t>(i)];
        const float fbv = aFb_[static_cast<size_t>(i)];
        const float dt = std::max(0.f, std::min(static_cast<float>(PP_MAX_S), aDt_[static_cast<size_t>(i)]));
        float lpLo, lpRo;
        if (dMode_ == 0) {
            const float sm = 0.5f * (vL * ds + vR * ds);
            const float h = dHp_.run(sm);
            const float rIn = fbv * lpHist_[static_cast<size_t>(lpHistI_)];
            lpRo = lpR_.run(dr_.run(rIn, dt, sr_));
            const float lIn = h + fbv * lpRo;
            lpLo = lpL_.run(dl_.run(lIn, dt, sr_));
            lpHist_[static_cast<size_t>(lpHistI_)] = lpLo;
            if (++lpHistI_ == Q) lpHistI_ = 0;
        } else {
            // STEREO / WIDE (le plugin seul) : deux lignes paralleles, chacune sa reinjection ; WIDE : la gauche a 3/4
            const float hL = dHp_.run(vL * ds);
            const float hR = dHpR_.run(vR * ds);
            lpLo = lpL_.run(dl_.run(hL + fbv * dFbL_, dMode_ == 2 ? dt * 0.75f : dt, sr_));
            lpRo = lpR_.run(dr_.run(hR + fbv * dFbR_, dt, sr_));
            dFbL_ = std::fabs(lpLo) < 1e-20f ? 0.f : lpLo;
            dFbR_ = std::fabs(lpRo) < 1e-20f ? 0.f : lpRo;
        }
        if (dXf) {
            // un changement de mode en cours
            const float g = static_cast<float>(dXf_.next());
            lpLo *= g;
            lpRo *= g;
            if (!dXf_.moving()) {
                if (dMode_ != dWant_) {
                    delayClear();
                    dMode_ = dWant_;
                    dXf_.to(1, std::max(1, static_cast<int>(jsRound(GLIDE_S * sr_))));
                } else
                    dXf = false;
            }
        }
        mL[i] = lpLo;
        mR[i] = lpRo;
        // TAPE : son envoi, son temps (a-rate)
        const float ts = aTs_[static_cast<size_t>(i)];
        tinL[i] = vL * ts;
        tinR[i] = vR * ts;
        times[i] = std::max(0.001f, std::min(4.f, aTt_[static_cast<size_t>(i)]));
        // REVERB : x1.25 puis l'envoi
        const float rs = aRs_[static_cast<size_t>(i)];
        rinL[i] = (vL * REVERB_BOOST) * rs;
        rinR[i] = (vR * REVERB_BOOST) * rs;
        if (shOn) {
            // SHIMMER : la reverb d'il y a 128 echantillons, une octave au-dessus
            rinL[i] += shim_.backL(q0 + i);
            rinR[i] += shim_.backR(q0 + i);
        }
    }
    // 4. la bande
    float* toL = bHiL_.data(); // le haut n'est plus lu
    float* toR = bHiR_.data();
    tape_.process(tinL, tinR, times, qFb_, qTape_, toL, toR, n, qStart, qEnd);
    // 5. la reverb
    float* roL = bRoL_.data();
    float* roR = bRoR_.data();
    conv_.process(rinL, rinR, roL, roR, n);
    if (shOn) shim_.process(roL, roR, q0, n);
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
        if (dMode_ != 0) dHpR_.endQuantum();
        lpL_.endQuantum();
        lpR_.endQuantum();
    }
    frame_ += n;
}

} // namespace mmarp
